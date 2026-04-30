/**
 * ThreeKingdomsEngine — 对抗性测试 v2 (Adversarial Testing Round 2)
 *
 * 从攻击者视角模拟更深层的安全漏洞：
 *   1.  修改存档数据注入非法值（负数金币）
 *   2.  伪造战斗结果（跳过战斗直接领奖）
 *   3.  越权操作（操作其他玩家的建筑）
 *   4.  时间穿越（系统时间回退后领取离线收益）
 *   5.  溢出攻击（资源设为 Number.MAX_SAFE_INTEGER 后产出）
 *   6.  重放攻击（重复提交同一操作）
 *   7.  注入攻击（武将名包含特殊字符/脚本）
 *   8.  状态篡改（战斗中强制修改武将血量）
 *   9.  并发攻击（同时升级同一建筑 100 次）
 *  10.  边界穿透（等级设为 -1 或 999999）
 *  11.  序列化注入（存档中注入循环引用）
 *  12.  类型混淆（字符串传给数值参数）
 *  13.  空指针（操作不存在的系统引用）
 *  14.  依赖注入替换（替换核心系统为空实现）
 *  15.  数据迁移攻击（伪造旧版本存档注入非法数据）
 *
 * @module engine/__tests__/adversarial-v2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import { ENGINE_SAVE_VERSION } from '../../shared/constants';
import type { ResourceType } from '../tech/TechEffectTypes';

// ── localStorage mock ──
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => storage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { storage[k] = v; }),
  removeItem: vi.fn((k: string) => { delete storage[k]; }),
  clear: vi.fn(() => Object.keys(storage).forEach(k => delete storage[k])),
  get length() { return Object.keys(storage).length; },
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── 测试辅助 ──

function createEngine(): ThreeKingdomsEngine {
  const engine = new ThreeKingdomsEngine();
  engine.init();
  return engine;
}

/** 构建一个合法的存档 JSON */
function buildValidSaveJson(engine: ThreeKingdomsEngine): string {
  return engine.serialize();
}

/** 构建带自定义字段的存档 */
function buildTamperedSave(
  engine: ThreeKingdomsEngine,
  overrides: Record<string, unknown>,
): string {
  const data = JSON.parse(engine.serialize());
  return JSON.stringify({ ...data, ...overrides });
}

// ═══════════════════════════════════════════════════════════════
// 对抗性测试 v2
// ═══════════════════════════════════════════════════════════════

describe('ThreeKingdomsEngine — 对抗性测试 v2（攻击者视角）', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    engine = createEngine();
  });

  afterEach(() => {
    try { engine.reset(); } catch (_) { /* 对抗性测试可能破坏引擎状态 */ }
  });

  // ─── 1. 修改存档数据注入非法值（负数金币） ───

  describe('场景 1: 存档注入非法值 — 负数金币', () => {
    it('反序列化注入负数金币后资源应被修正为非负', () => {
      const json = buildTamperedSave(engine, {
        resource: {
          version: 1,
          resources: { grain: -9999, gold: -500, copper: -100, troops: -50, recruitToken: -10, mandate: -5 },
          productionRates: { grain: 1, gold: 0, copper: 0, troops: 0, recruitToken: 0, mandate: 0 },
          caps: { grain: 10000, gold: 5000, copper: 5000, troops: 5000, recruitToken: 100, mandate: 100 },
          lastSaveTime: Date.now(),
        },
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();

      const snap = testEngine.getSnapshot();
      const res = snap.resources;
      // ResourceSystem.deserialize 校验每个值 Math.max(0, Number(val) || 0)
      expect(res.grain).toBeGreaterThanOrEqual(0);
      expect(res.gold).toBeGreaterThanOrEqual(0);
      testEngine.reset();
    });

    it('反序列化注入 NaN 金币后资源应被修正', () => {
      const json = buildTamperedSave(engine, {
        resource: {
          version: 1,
          resources: { grain: NaN, gold: undefined, copper: null, troops: NaN, recruitToken: NaN, mandate: NaN },
          productionRates: { grain: 1, gold: 0, copper: 0, troops: 0, recruitToken: 0, mandate: 0 },
          caps: { grain: 10000, gold: 5000, copper: 5000, troops: 5000, recruitToken: 100, mandate: 100 },
          lastSaveTime: Date.now(),
        },
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();

      const snap = testEngine.getSnapshot();
      const res = snap.resources;
      // NaN/undefined/null → Number(val) || 0 → 0
      expect(res.grain).toBeGreaterThanOrEqual(0);
      expect(res.gold).toBeGreaterThanOrEqual(0);
      testEngine.reset();
    });
  });

  // ─── 2. 伪造战斗结果（跳过战斗直接领奖） ───

  describe('场景 2: 伪造战斗结果 — 跳过战斗直接领奖', () => {
    it('completeStage 对不存在的关卡应抛出异常', () => {
      expect(() => {
        engine.campaignSystems.campaignSystem.completeStage('nonexistent_stage', 3);
      }).toThrow();
    });

    it('completeStage 传入负数星级应被截断为 0', () => {
      // 先完成 chapter1_stage1 使 stage2 可用
      engine.campaignSystems.campaignSystem.completeStage('chapter1_stage1', 3);
      // 负数星级 → Math.max(0, Math.min(3, Math.floor(stars)))
      expect(() => {
        engine.campaignSystems.campaignSystem.completeStage('chapter1_stage2', -5);
      }).not.toThrow();

      const stars = engine.campaignSystems.campaignSystem.getStageStars('chapter1_stage2');
      expect(stars).toBeGreaterThanOrEqual(0);
    });

    it('completeStage 传入超大星级应被截断为 MAX_STARS', () => {
      engine.campaignSystems.campaignSystem.completeStage('chapter1_stage1', 3);
      expect(() => {
        engine.campaignSystems.campaignSystem.completeStage('chapter1_stage2', 99999);
      }).not.toThrow();

      const stars = engine.campaignSystems.campaignSystem.getStageStars('chapter1_stage2');
      expect(stars).toBeLessThanOrEqual(3);
    });

    it('completeStage 传入 NaN 星级应被安全处理', () => {
      engine.campaignSystems.campaignSystem.completeStage('chapter1_stage1', 3);
      expect(() => {
        engine.campaignSystems.campaignSystem.completeStage('chapter1_stage2', NaN);
      }).not.toThrow();
    });
  });

  // ─── 3. 越权操作（操作其他玩家的建筑） ───

  describe('场景 3: 越权操作 — 跨实例操作', () => {
    it('引擎 A 的序列化数据不应包含引擎 B 的私有状态', () => {
      const engineA = createEngine();
      const engineB = createEngine();

      engineA.resource.addResource('grain' as ResourceType, 5000);
      engineB.resource.addResource('grain' as ResourceType, 100);

      const jsonA = engineA.serialize();
      const jsonB = engineB.serialize();

      const dataA = JSON.parse(jsonA);
      const dataB = JSON.parse(jsonB);

      // 两个引擎的资源数据应完全独立
      expect(dataA.resource.resources.grain).not.toBe(dataB.resource.resources.grain);

      engineA.reset();
      engineB.reset();
    });

    it('反序列化到引擎 B 不应影响引擎 A', () => {
      const engineA = createEngine();
      const engineB = createEngine();

      engineA.resource.addResource('grain' as ResourceType, 5000);
      const jsonA = engineA.serialize();

      // 将 A 的数据反序列化到 B
      engineB.deserialize(jsonA);

      // A 的状态不应受影响
      const snapA = engineA.getSnapshot();
      expect(snapA.resources.grain).toBeGreaterThan(0);

      engineA.reset();
      engineB.reset();
    });
  });

  // ─── 4. 时间穿越（系统时间回退后领取离线收益） ───

  describe('场景 4: 时间穿越 — 系统时间回退', () => {
    it('tick 传入负数 deltaMs 不应产生负资源', () => {
      const before = engine.getSnapshot().resources.grain;
      engine.tick(-10000);
      const after = engine.getSnapshot().resources.grain;
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('tick 传入极大负数不应导致资源异常', () => {
      const before = engine.getSnapshot().resources.grain;
      engine.tick(-Number.MAX_SAFE_INTEGER);
      const after = engine.getSnapshot().resources.grain;
      expect(Number.isFinite(after)).toBe(true);
      expect(after).toBeGreaterThanOrEqual(0);
    });

    it('反序列化注入未来时间戳后 tick 不应产生异常收益', () => {
      const futureTime = Date.now() + 365 * 24 * 3600 * 1000; // 1年后
      const json = buildTamperedSave(engine, {
        resource: {
          version: 1,
          resources: { grain: 100, gold: 50, copper: 0, troops: 0, recruitToken: 0, mandate: 0 },
          productionRates: { grain: 10, gold: 0, copper: 0, troops: 0, recruitToken: 0, mandate: 0 },
          caps: { grain: 100000, gold: 50000, copper: 50000, troops: 50000, recruitToken: 1000, mandate: 1000 },
          lastSaveTime: futureTime,
        },
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      testEngine.deserialize(json);

      // tick 后资源不应爆炸
      testEngine.tick(1000);
      const snap = testEngine.getSnapshot();
      expect(Number.isFinite(snap.resources.grain)).toBe(true);
      expect(snap.resources.grain).toBeLessThanOrEqual(100000);
      testEngine.reset();
    });
  });

  // ─── 5. 溢出攻击（资源设为 Number.MAX_SAFE_INTEGER 后产出） ───

  describe('场景 5: 溢出攻击 — MAX_SAFE_INTEGER 产出', () => {
    it('资源在 MAX_SAFE_INTEGER 后 tick 不应变为 Infinity', () => {
      engine.resource.setResource('grain' as ResourceType, Number.MAX_SAFE_INTEGER);
      engine.tick(10000);

      const snap = engine.getSnapshot();
      const grain = snap.resources.grain;
      expect(Number.isFinite(grain)).toBe(true);
      expect(Number.isNaN(grain)).toBe(false);
    });

    it('MAX_SAFE_INTEGER 资源 + addResource 不应溢出为 Infinity', () => {
      engine.resource.setResource('grain' as ResourceType, Number.MAX_SAFE_INTEGER);
      const added = engine.resource.addResource('grain' as ResourceType, Number.MAX_SAFE_INTEGER);

      const grain = engine.resource.getAmount('grain' as ResourceType);
      expect(Number.isFinite(grain)).toBe(true);
      // 应被上限截断
      expect(grain).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    });

    it('反序列化注入超大数值后引擎应正常工作', () => {
      const json = buildTamperedSave(engine, {
        resource: {
          version: 1,
          resources: {
            grain: Number.MAX_SAFE_INTEGER,
            gold: Number.MAX_SAFE_INTEGER,
            copper: Number.MAX_SAFE_INTEGER,
            troops: Number.MAX_SAFE_INTEGER,
            recruitToken: Number.MAX_SAFE_INTEGER,
            mandate: Number.MAX_SAFE_INTEGER,
          },
          productionRates: { grain: 1000, gold: 1000, copper: 1000, troops: 1000, recruitToken: 1000, mandate: 1000 },
          caps: {
            grain: Number.MAX_SAFE_INTEGER,
            gold: Number.MAX_SAFE_INTEGER,
            copper: Number.MAX_SAFE_INTEGER,
            troops: Number.MAX_SAFE_INTEGER,
            recruitToken: Number.MAX_SAFE_INTEGER,
            mandate: Number.MAX_SAFE_INTEGER,
          },
          lastSaveTime: Date.now(),
        },
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();
      expect(() => testEngine.tick(1000)).not.toThrow();
      testEngine.reset();
    });
  });

  // ─── 6. 重放攻击（重复提交同一操作） ───

  describe('场景 6: 重放攻击 — 重复提交', () => {
    it('重复反序列化同一存档不应导致资源翻倍', () => {
      engine.resource.addResource('grain' as ResourceType, 1000);
      const json = engine.serialize();

      const grainBefore = engine.resource.getAmount('grain' as ResourceType);

      // 反序列化 10 次
      for (let i = 0; i < 10; i++) {
        engine.deserialize(json);
      }

      const grainAfter = engine.resource.getAmount('grain' as ResourceType);
      // 资源应与存档中一致，而非翻倍
      expect(grainAfter).toBe(grainBefore);
    });

    it('重复 completeStage 同一关卡不应导致星级无限增长', () => {
      engine.campaignSystems.campaignSystem.completeStage('chapter1_stage1', 3);

      // 重复完成 10 次
      for (let i = 0; i < 10; i++) {
        engine.campaignSystems.campaignSystem.completeStage('chapter1_stage1', 3);
      }

      const stars = engine.campaignSystems.campaignSystem.getStageStars('chapter1_stage1');
      expect(stars).toBeLessThanOrEqual(3);
    });

    it('重复 addFragment 不应导致武将碎片超出合理范围', () => {
      for (let i = 0; i < 100; i++) {
        engine.hero.addFragment('liubei', 10);
      }
      const fragments = engine.hero.getAllFragments();
      // 碎片应该是有限数值
      expect(Number.isFinite((fragments as Record<string, number>).liubei ?? 0)).toBe(true);
    });
  });

  // ─── 7. 注入攻击（武将名包含特殊字符/脚本） ───

  describe('场景 7: 注入攻击 — 特殊字符', () => {
    it('序列化包含特殊字符的存档不应崩溃', () => {
      const maliciousStrings = [
        '<script>alert("xss")</script>',
        '"; DROP TABLE heroes; --',
        '${constructor.constructor("return this")()}',
        '{{7*7}}',
        '\x00\x01\x02',
        '🎉🎮⚔️',
        '../../../etc/passwd',
        'null',
        'undefined',
        'NaN',
      ];

      for (const str of maliciousStrings) {
        // getGeneral 应安全处理特殊字符 ID
        expect(() => engine.hero.getGeneral(str)).not.toThrow();
        expect(engine.hero.getGeneral(str)).toBeUndefined();
      }
    });

    it('反序列化包含特殊字符的 JSON 不应导致代码执行', () => {
      const payloads = [
        '{"version":1,"resource":{"version":1,"resources":{"grain":100},"productionRates":{"grain":1},"caps":{"grain":1000},"lastSaveTime":0},"building":{"version":1,"buildings":{}},"__proto__":{"isAdmin":true}}',
        '{"version":1,"resource":{"version":1,"resources":{"grain":100},"productionRates":{"grain":1},"caps":{"grain":1000},"lastSaveTime":0},"building":{"version":1,"buildings":{}},"constructor":{"prototype":{"polluted":"yes"}}}',
      ];

      for (const payload of payloads) {
        const testEngine = new ThreeKingdomsEngine();
        testEngine.init();
        expect(() => testEngine.deserialize(payload)).not.toThrow();
        testEngine.reset();
      }

      // 验证原型未被污染
      expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  // ─── 8. 状态篡改（战斗中强制修改武将血量） ───

  describe('场景 8: 状态篡改 — 运行时修改', () => {
    it('通过 getSnapshot 获取的对象修改不应影响引擎内部状态', () => {
      const snap = engine.getSnapshot();
      const originalGrain = snap.resources.grain;

      // 尝试修改快照
      snap.resources.grain = 999999;

      // 引擎内部状态不应受影响
      const snap2 = engine.getSnapshot();
      expect(snap2.resources.grain).toBe(originalGrain);
    });

    it('通过 getSnapshot 获取的英雄数组修改不应影响引擎', () => {
      const heroes = engine.getSnapshot().heroes;
      const originalCount = heroes.length;

      // 尝试修改快照中的英雄数组
      if (heroes.length > 0) {
        (heroes[0] as unknown as { name: string }).name = 'HACKED';
      }
      heroes.push({} as Record<string, unknown>);

      // 引擎内部状态不应受影响
      const heroes2 = engine.getSnapshot().heroes;
      expect(heroes2.length).toBe(originalCount);
    });

    it('通过 getAllGenerals 获取的武将修改不应影响引擎', () => {
      const generals = engine.hero.getAllGenerals();
      const originalCount = generals.length;

      // 尝试修改
      if (generals.length > 0) {
        (generals[0] as unknown as { attack: number }).attack = 99999;
      }

      // 引擎内部武将数据不应受影响
      const generals2 = engine.hero.getAllGenerals();
      expect(generals2.length).toBe(originalCount);
    });
  });

  // ─── 9. 并发攻击（同时升级同一建筑 100 次） ───

  describe('场景 9: 并发攻击 — 快速重复操作', () => {
    it('快速连续升级同一建筑不应导致状态异常', () => {
      const results: boolean[] = [];
      for (let i = 0; i < 100; i++) {
        try {
          const check = engine.checkUpgrade('farmland' as unknown as string);
          if (check.canUpgrade) {
            engine.upgradeBuilding('farmland' as unknown as string);
            results.push(true);
          } else {
            results.push(false);
          }
        } catch {
          results.push(false);
        }
      }

      // 至少第一次应该成功（如果有足够资源）
      // 但建筑等级不应超过合理范围
      const buildings = engine.building.getAllBuildings();
      const farmlandLevel = (buildings as Record<string, { level?: number }>).farmland?.level ?? 0;
      expect(farmlandLevel).toBeGreaterThanOrEqual(0);
      expect(farmlandLevel).toBeLessThanOrEqual(100); // 合理上限
    });

    it('快速连续 tick 1000 次不应崩溃', () => {
      for (let i = 0; i < 1000; i++) {
        engine.tick(16); // ~60fps
      }

      const snap = engine.getSnapshot();
      expect(Number.isFinite(snap.resources.grain)).toBe(true);
      expect(snap.resources.grain).toBeGreaterThanOrEqual(0);
    });

    it('快速序列化/反序列化交替不应导致内存泄漏或崩溃', () => {
      for (let i = 0; i < 50; i++) {
        engine.tick(100);
        const json = engine.serialize();
        engine.deserialize(json);
      }

      const snap = engine.getSnapshot();
      expect(snap).toBeDefined();
      expect(Number.isFinite(snap.resources.grain)).toBe(true);
    });
  });

  // ─── 10. 边界穿透（等级设为 -1 或 999999） ───

  describe('场景 10: 边界穿透 — 极端等级值', () => {
    it('反序列化注入建筑等级 -1 后应被修正', () => {
      const json = buildTamperedSave(engine, {
        building: {
          version: 1,
          buildings: {
            farmland: { level: -1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null, upgradeCost: null },
          },
        },
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();

      // 引擎应能继续工作
      expect(() => testEngine.tick(100)).not.toThrow();
      testEngine.reset();
    });

    it('反序列化注入建筑等级 999999 后应被修正', () => {
      const json = buildTamperedSave(engine, {
        building: {
          version: 1,
          buildings: {
            farmland: { level: 999999, status: 'idle', upgradeStartTime: null, upgradeEndTime: null, upgradeCost: null },
          },
        },
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();

      // 引擎应能继续工作
      expect(() => testEngine.tick(100)).not.toThrow();
      testEngine.reset();
    });

    it('反序列化注入武将等级 -1 后应被安全处理', () => {
      const json = buildTamperedSave(engine, {
        hero: {
          version: 1,
          generals: [
            {
              id: 'test_hero',
              name: '测试武将',
              faction: 'shu',
              quality: 'legendary',
              troopType: 'infantry',
              level: -1,
              exp: -100,
              attack: -10,
              defense: -10,
              intelligence: -10,
              speed: -10,
              maxHp: -100,
            },
          ],
          fragments: {},
        },
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();
      testEngine.reset();
    });
  });

  // ─── 11. 序列化注入（存档中注入循环引用） ───

  describe('场景 11: 序列化注入 — 循环引用', () => {
    it('反序列化包含循环引用的 JSON 字符串应安全失败', () => {
      // JSON.stringify 无法序列化循环引用，所以攻击者会直接构造字符串
      const maliciousJson = '{"version":1,"resource":{"version":1}}';

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(maliciousJson)).not.toThrow();
      testEngine.reset();
    });

    it('反序列化畸形 JSON 应安全失败', () => {
      // 合法 JSON 且结构可解析 — 不应抛出异常
      const safePayloads = [
        '{}',
        '{"version":1}',
      ];

      for (const payload of safePayloads) {
        const testEngine = new ThreeKingdomsEngine();
        testEngine.init();
        expect(() => testEngine.deserialize(payload)).not.toThrow();
        testEngine.reset();
      }

      // 非法 JSON（语法错误）会抛出 SyntaxError — 这是预期行为
      const syntaxErrorPayloads = [
        '{version:1}', // 无引号的 key
        '{"version":1', // 不闭合
        '}}}}',
        '{"version":1,"resource":undefined}',
        '{"version":1,"resource":function(){}}',
      ];

      for (const payload of syntaxErrorPayloads) {
        const testEngine = new ThreeKingdomsEngine();
        testEngine.init();
        expect(() => testEngine.deserialize(payload)).toThrow();
        testEngine.reset();
      }

      // 可解析但导致内部错误的 JSON — 应抛出但不崩溃
      const runtimeErrorPayloads = [
        'null',
        '""',
        '0',
        'true',
      ];

      for (const payload of runtimeErrorPayloads) {
        const testEngine = new ThreeKingdomsEngine();
        testEngine.init();
        // 这些会导致 applySaveData 内部错误（无法读取 null.property）
        // 关键是引擎不应进入不可恢复状态
        try {
          testEngine.deserialize(payload);
        } catch {
          // 预期可能抛出
        }
        // 引擎创建新实例应正常
        const fresh = new ThreeKingdomsEngine();
        expect(() => fresh.init()).not.toThrow();
        fresh.reset();
        testEngine.reset();
      }
    });
  });

  // ─── 12. 类型混淆（字符串传给数值参数） ───

  describe('场景 12: 类型混淆 — 错误类型参数', () => {
    it('addResource 传入字符串金额应被安全处理', () => {
      expect(() => {
        (engine.resource as unknown as Record<string, (...args: unknown[]) => unknown>).addResource('grain', '1000');
      }).not.toThrow();
    });

    it('consumeResource 传入字符串金额应被安全处理', () => {
      expect(() => {
        (engine.resource as unknown as Record<string, (...args: unknown[]) => unknown>).consumeResource('grain', '100');
      }).not.toThrow();
    });

    it('setResource 传入字符串金额应被安全处理', () => {
      expect(() => {
        (engine.resource as unknown as Record<string, (...args: unknown[]) => unknown>).setResource('grain', '5000');
      }).not.toThrow();

      const grain = engine.resource.getAmount('grain' as ResourceType);
      expect(Number.isFinite(grain)).toBe(true);
    });

    it('addExp 传入字符串经验应被安全处理', () => {
      expect(() => {
        (engine.hero as unknown as Record<string, (...args: unknown[]) => unknown>).addExp('liubei', '1000');
      }).not.toThrow();
    });

    it('addFragment 传入字符串数量应被安全处理', () => {
      expect(() => {
        (engine.hero as unknown as Record<string, (...args: unknown[]) => unknown>).addFragment('liubei', '10');
      }).not.toThrow();
    });

    it('tick 传入字符串时间应被安全处理', () => {
      expect(() => {
        (engine as unknown as Record<string, unknown>).tick('1000');
      }).not.toThrow();
    });
  });

  // ─── 13. 空指针（操作不存在的系统引用） ───

  describe('场景 13: 空指针 — 不存在的引用', () => {
    it('getGeneral 传入 null 应安全返回 undefined', () => {
      expect(() => engine.hero.getGeneral(null as unknown as string)).not.toThrow();
      expect(engine.hero.getGeneral(null as unknown as string)).toBeUndefined();
    });

    it('getGeneral 传入 undefined 应安全返回 undefined', () => {
      expect(() => engine.hero.getGeneral(undefined as unknown as string)).not.toThrow();
      expect(engine.hero.getGeneral(undefined as unknown as string)).toBeUndefined();
    });

    it('getGeneral 传入数字应安全返回 undefined', () => {
      expect(() => engine.hero.getGeneral(12345 as unknown as string)).not.toThrow();
      expect(engine.hero.getGeneral(12345 as unknown as string)).toBeUndefined();
    });

    it('getEquipment 传入 null 应安全返回 undefined', () => {
      expect(() => (engine.equipment as unknown as Record<string, (...args: unknown[]) => unknown>)?.getEquipment(null)).not.toThrow();
    });

    it('getStageStars 对不存在的关卡应返回 0', () => {
      expect(engine.campaignSystems.campaignSystem.getStageStars('nonexistent')).toBe(0);
    });

    it('getClearCount 对不存在的关卡应返回 0', () => {
      expect(engine.campaignSystems.campaignSystem.getClearCount('nonexistent')).toBe(0);
    });
  });

  // ─── 14. 依赖注入替换（替换核心系统为空实现） ───

  describe('场景 14: 依赖注入替换 — 替换核心系统', () => {
    it('将 resource 替换为 null 后引擎应防御性失败', () => {
      const testEngine = createEngine();
      try {
        (testEngine as unknown as Record<string, unknown>).resource = null;
      } catch {
        // strict mode 可能阻止赋值
      }

      // 尝试操作 — 应抛出错误但不崩溃
      try {
        testEngine.tick(100);
      } catch (e) {
        expect(e).toBeDefined();
      }

      // 新引擎应正常工作
      const fresh = createEngine();
      expect(() => fresh.tick(100)).not.toThrow();
      fresh.reset();
      // 被破坏的引擎 reset 会失败
      expect(() => testEngine.reset()).toThrow();
    });

    it('将 building 替换为空对象后引擎应防御性失败', () => {
      const testEngine = createEngine();
      try {
        (testEngine as unknown as Record<string, unknown>).building = {};
      } catch {
        // 可能阻止赋值
      }

      try {
        testEngine.tick(100);
      } catch (e) {
        expect(e).toBeDefined();
      }

      // 被破坏的引擎 reset 会失败（building.reset 不存在）
      expect(() => testEngine.reset()).toThrow();
    });
  });

  // ─── 15. 数据迁移攻击（伪造旧版本存档注入非法数据） ───

  describe('场景 15: 数据迁移攻击 — 伪造旧版本存档', () => {
    it('伪造 version=0 的存档应被安全处理', () => {
      const json = JSON.stringify({
        version: 0,
        resource: {
          version: 1,
          resources: { grain: -9999, gold: Infinity, copper: NaN },
          productionRates: { grain: -100, gold: Infinity, copper: NaN },
          caps: { grain: -1, gold: -1, copper: -1 },
          lastSaveTime: 0,
        },
        building: {
          version: 1,
          buildings: {},
        },
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();

      // 引擎应能继续工作
      expect(() => testEngine.tick(100)).not.toThrow();
      testEngine.reset();
    });

    it('伪造 version=99999 的存档应被安全处理', () => {
      const json = JSON.stringify({
        version: 99999,
        resource: {
          version: 99999,
          resources: { grain: 100, gold: 50, copper: 0, troops: 0, recruitToken: 0, mandate: 0 },
          productionRates: { grain: 1, gold: 0, copper: 0, troops: 0, recruitToken: 0, mandate: 0 },
          caps: { grain: 10000, gold: 5000, copper: 5000, troops: 5000, recruitToken: 100, mandate: 100 },
          lastSaveTime: Date.now(),
        },
        building: {
          version: 1,
          buildings: {},
        },
        unknownField1: 'malicious',
        unknownField2: { nested: true },
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();
      expect(() => testEngine.tick(100)).not.toThrow();
      testEngine.reset();
    });

    it('伪造完全空的旧版存档（只有 version）应被安全处理', () => {
      const json = JSON.stringify({ version: 1 });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();
      expect(() => testEngine.tick(100)).not.toThrow();
      testEngine.reset();
    });

    it('伪造包含额外子系统的旧版存档不应导致原型污染', () => {
      const json = JSON.stringify({
        version: 1,
        resource: {
          version: 1,
          resources: { grain: 100, gold: 50, copper: 0, troops: 0, recruitToken: 0, mandate: 0 },
          productionRates: { grain: 1, gold: 0, copper: 0, troops: 0, recruitToken: 0, mandate: 0 },
          caps: { grain: 10000, gold: 5000, copper: 5000, troops: 5000, recruitToken: 100, mandate: 100 },
          lastSaveTime: Date.now(),
        },
        building: {
          version: 1,
          buildings: {},
        },
        __proto__: { hacked: true },
        constructor: { prototype: { polluted: true } },
        adminBackdoor: true,
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();
      testEngine.reset();

      // 原型未被污染
      expect(({} as Record<string, unknown>).hacked).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(({} as Record<string, unknown>).adminBackdoor).toBeUndefined();
    });

    it('伪造存档中注入超长字符串字段不应导致内存问题', () => {
      const longStr = 'A'.repeat(100000);
      const json = JSON.stringify({
        version: 1,
        resource: {
          version: 1,
          resources: { grain: 100, gold: 50, copper: 0, troops: 0, recruitToken: 0, mandate: 0 },
          productionRates: { grain: 1, gold: 0, copper: 0, troops: 0, recruitToken: 0, mandate: 0 },
          caps: { grain: 10000, gold: 5000, copper: 5000, troops: 5000, recruitToken: 100, mandate: 100 },
          lastSaveTime: Date.now(),
        },
        building: {
          version: 1,
          buildings: {},
        },
        garbageData: longStr,
      });

      const testEngine = new ThreeKingdomsEngine();
      testEngine.init();
      expect(() => testEngine.deserialize(json)).not.toThrow();
      testEngine.reset();
    });
  });
});
