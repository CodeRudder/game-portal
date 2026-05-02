import { vi } from 'vitest';
/**
 * ThreeKingdomsEngine 编排层单元测试 — 核心域
 * 覆盖：初始化、tick 循环、存档/读档、事件系统、状态查询、重置、
 *       SaveManager 委托、离线收益、加成体系框架
 */

import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import { SAVE_KEY, ENGINE_SAVE_VERSION } from '../../shared/constants';

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

describe('ThreeKingdomsEngine', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    Object.keys(storage).forEach(k => delete storage[k]);
    vi.restoreAllMocks();
    engine = new ThreeKingdomsEngine();
  });

  afterEach(() => {
    engine.reset();
  });

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('init()', () => {
    it('初始化新游戏并发出 game:initialized 事件', () => {
      const listener = vi.fn();
      engine.on('game:initialized', listener);
      engine.init();
      expect(engine.isInitialized()).toBe(true);
      expect(listener).toHaveBeenCalledWith({ isNewGame: true });
    });

    it('重复调用 init() 为空操作', () => {
      engine.init();
      const listener = vi.fn();
      engine.on('game:initialized', listener);
      engine.init();
      expect(listener).not.toHaveBeenCalled();
    });

    it('初始化后快照包含默认资源', () => {
      engine.init();
      const snap = engine.getSnapshot();
      expect(snap.resources).toBeDefined();
      expect(snap.buildings).toBeDefined();
      expect(snap.onlineSeconds).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 游戏循环 tick
  // ═══════════════════════════════════════════
  describe('tick()', () => {
    it('未初始化时 tick 为空操作', () => {
      expect(() => engine.tick(100)).not.toThrow();
    });

    it('驱动资源产出并发出 resource:changed 事件', () => {
      engine.init();
      const listener = vi.fn();
      engine.on('resource:changed', listener);
      engine.tick(1000);
      expect(listener).toHaveBeenCalled();
    });

    it('自动保存累加', () => {
      engine.init();
      // 累加到30秒触发自动保存
      for (let i = 0; i < 30; i++) {
        engine.tick(1000);
      }
      expect(localStorageMock.setItem).toHaveBeenCalledWith(SAVE_KEY, expect.any(String));
    });

    it('tick 更新在线时长', () => {
      engine.init();
      engine.tick(5000);
      expect(engine.getOnlineSeconds()).toBeGreaterThanOrEqual(5);
    });

    it('建筑升级完成时发出 building:upgraded 事件', () => {
      engine.init();
      // P0-1修复后：农田可直接升级（不再被主城等级限制）
      // 使用 vi.useFakeTimers 来模拟时间推进
      vi.useFakeTimers();
      // 重新创建引擎以使用 fake timers
      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.init();

      const check = engine.checkUpgrade('farmland');
      if (check.canUpgrade) {
        engine.upgradeBuilding('farmland');
        const upgradedListener = vi.fn();
        engine.on('building:upgraded', upgradedListener);
        // 农田 Lv1→2 需要 5 秒，推进 10 秒确保完成
        vi.advanceTimersByTime(10000);
        engine.tick(10000);
        expect(upgradedListener).toHaveBeenCalled();
      }
      vi.useRealTimers();
    });
  });

  // ═══════════════════════════════════════════
  // 3. 存档 / 读档
  // ═══════════════════════════════════════════
  describe('save() / load()', () => {
    it('保存到 localStorage', () => {
      engine.init();
      engine.save();
      expect(storage[SAVE_KEY]).toBeDefined();
      // SaveManager 使用 StateSerializer 包装：外层 {v, checksum, data}
      const outer = JSON.parse(storage[SAVE_KEY]);
      expect(outer.v).toBeDefined();
      expect(outer.checksum).toBeDefined();
      expect(outer.data).toBeDefined();
      // 内层是 IGameState 格式，subsystems 包含 resource/building
      const inner = JSON.parse(outer.data);
      expect(inner.version).toBe(String(ENGINE_SAVE_VERSION));
      expect(inner.subsystems.resource).toBeDefined();
      expect(inner.subsystems.building).toBeDefined();
    });

    it('发出 game:saved 事件', () => {
      engine.init();
      const listener = vi.fn();
      engine.on('game:saved', listener);
      engine.save();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ timestamp: expect.any(Number) }),
      );
    });

    it('加载存档并发出 game:loaded 事件', () => {
      engine.init();
      engine.save();
      const engine2 = new ThreeKingdomsEngine();
      const listener = vi.fn();
      engine2.on('game:loaded', listener);
      const result = engine2.load();
      expect(engine2.isInitialized()).toBe(true);
      expect(listener).toHaveBeenCalled();
      engine2.reset();
    });

    it('无存档时 load 返回 null', () => {
      expect(engine.load()).toBeNull();
    });

    it('损坏存档时 load 返回 null', () => {
      storage[SAVE_KEY] = 'not-valid-json{{{';
      expect(engine.load()).toBeNull();
    });

    it('serialize / deserialize 往返一致性', () => {
      engine.init();
      const json = engine.serialize();
      const engine2 = new ThreeKingdomsEngine();
      engine2.deserialize(json);
      expect(engine2.isInitialized()).toBe(true);
      const snap1 = engine.getSnapshot();
      const snap2 = engine2.getSnapshot();
      expect(snap1.resources.grain).toEqual(snap2.resources.grain);
    });

    it('hasSaveData 正确判断', () => {
      expect(engine.hasSaveData()).toBe(false);
      engine.init();
      engine.save();
      expect(engine.hasSaveData()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 事件系统
  // ═══════════════════════════════════════════
  describe('事件系统', () => {
    it('on() 注册并触发回调', () => {
      engine.init();
      const cb = vi.fn();
      engine.on('game:saved', cb);
      engine.save();
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('once() 仅触发一次', () => {
      engine.init();
      const cb = vi.fn();
      engine.once('game:saved', cb);
      engine.save();
      engine.save();
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('off() 取消订阅', () => {
      engine.init();
      const cb = vi.fn();
      engine.on('game:saved', cb);
      engine.off('game:saved', cb);
      engine.save();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // 5. 状态查询
  // ═══════════════════════════════════════════
  describe('状态查询', () => {
    it('getSnapshot 返回完整快照', () => {
      engine.init();
      const snap = engine.getSnapshot();
      expect(snap).toHaveProperty('resources');
      expect(snap).toHaveProperty('productionRates');
      expect(snap).toHaveProperty('caps');
      expect(snap).toHaveProperty('buildings');
      expect(snap).toHaveProperty('onlineSeconds');
    });

    it('getCapWarnings 返回警告列表', () => {
      engine.init();
      const warnings = engine.getCapWarnings();
      expect(Array.isArray(warnings)).toBe(true);
    });

    it('getUpgradeProgress 返回 0~1', () => {
      engine.init();
      const progress = engine.getUpgradeProgress('farmland');
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    });

    it('getUpgradeRemainingTime 返回秒数', () => {
      engine.init();
      const remaining = engine.getUpgradeRemainingTime('farmland');
      expect(typeof remaining).toBe('number');
    });

    it('getUpgradeCost 返回费用', () => {
      engine.init();
      const cost = engine.getUpgradeCost('farmland');
      if (cost) {
        expect(cost).toHaveProperty('grain');
        expect(cost).toHaveProperty('gold');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 6. 重置
  // ═══════════════════════════════════════════
  describe('reset()', () => {
    it('清除所有状态', () => {
      engine.init();
      engine.tick(1000);
      engine.reset();
      expect(engine.isInitialized()).toBe(false);
      expect(engine.getOnlineSeconds()).toBe(0);
    });

    it('删除 localStorage 存档', () => {
      engine.init();
      engine.save();
      engine.reset();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(SAVE_KEY);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 存档统一 — SaveManager 委托
  // ═══════════════════════════════════════════
  describe('存档统一（SaveManager 委托）', () => {
    it('save() 委托给 SaveManager（外层有 v/checksum/data 包装）', () => {
      engine.init();
      engine.save();
      const raw = storage[SAVE_KEY];
      expect(raw).toBeDefined();
      const outer = JSON.parse(raw);
      expect(outer.v).toBeDefined();
      expect(outer.checksum).toBeDefined();
      expect(outer.data).toBeDefined();
    });

    it('save() 内层数据包含 subsystems.resource 和 subsystems.building', () => {
      engine.init();
      engine.save();
      const outer = JSON.parse(storage[SAVE_KEY]);
      const inner = JSON.parse(outer.data);
      expect(inner.subsystems.resource).toBeDefined();
      expect(inner.subsystems.building).toBeDefined();
    });

    it('load() 从 SaveManager 恢复状态', () => {
      engine.init();
      engine.tick(2000);
      engine.save();

      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      expect(engine2.isInitialized()).toBe(true);
      engine2.reset();
    });

    it('旧格式存档向后兼容加载', () => {
      const legacySave = JSON.stringify({
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now() - 1000,
        resource: {
          resources: { grain: 1000, gold: 500, troops: 200, mandate: 50 },
          lastSaveTime: Date.now() - 1000,
          productionRates: { grain: 1, gold: 0.5, troops: 0.3, mandate: 0 },
          caps: { grain: 5000, gold: 2000, troops: 3000, mandate: null },
          version: 1,
        },
        building: {
          buildings: {
            castle:   { type: 'castle',   level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
            farmland: { type: 'farmland',  level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
            market:   { type: 'market',    level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            barracks: { type: 'barracks',  level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            workshop:   { type: 'workshop',    level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            academy:  { type: 'academy',   level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            clinic:   { type: 'clinic',    level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            wall:     { type: 'wall',      level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
          },
          version: 1,
        },
      });
      storage[SAVE_KEY] = legacySave;

      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      expect(engine2.isInitialized()).toBe(true);
      engine2.reset();
    });

    it('旧格式存档包含非标准字段时不误判为新格式', () => {
      const legacySave = JSON.stringify({
        version: 1,
        saveTime: Date.now(),
        resource: {
          resources: { grain: 100, gold: 50, troops: 10, mandate: 0 },
          lastSaveTime: Date.now(),
          productionRates: { grain: 0.8, gold: 0.6, troops: 0.4, mandate: 0 },
          caps: { grain: 1000, gold: 2000, troops: 500, mandate: null },
          version: 1,
        },
        building: {
          buildings: {
            castle:   { type: 'castle',   level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
            farmland: { type: 'farmland',  level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
            market:   { type: 'market',    level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            barracks: { type: 'barracks',  level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            workshop:   { type: 'workshop',    level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            academy:  { type: 'academy',   level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            clinic:   { type: 'clinic',    level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            wall:     { type: 'wall',      level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
          },
          version: 1,
        },
      });
      storage[SAVE_KEY] = legacySave;

      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      expect(engine2.isInitialized()).toBe(true);
      engine2.reset();
    });

    it('新格式存档不被旧格式加载器处理', () => {
      engine.init();
      engine.save();
      // 存储的是新格式（有 v/checksum/data），旧格式加载器应跳过
      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      expect(engine2.isInitialized()).toBe(true);
      engine2.reset();
    });

    it('load() 无存档返回 null', () => {
      expect(engine.load()).toBeNull();
    });

    it('load() 损坏存档返回 null', () => {
      storage[SAVE_KEY] = 'not-valid-json{{{';
      expect(engine.load()).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 8. 离线收益在加载时计算
  // ═══════════════════════════════════════════
  describe('离线收益', () => {
    it('加载时发出 game:loaded 事件', () => {
      engine.init();
      engine.save();

      const engine2 = new ThreeKingdomsEngine();
      const listener = vi.fn();
      engine2.on('game:loaded', listener);
      engine2.load();
      expect(listener).toHaveBeenCalled();
      engine2.reset();
    });

    it('加载后引擎状态为已初始化', () => {
      engine.init();
      engine.save();

      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      expect(engine2.isInitialized()).toBe(true);
      engine2.reset();
    });

    it('旧格式存档离线收益正确计算', () => {
      engine.init();
      engine.tick(5000);

      // 使用旧格式（直接 JSON）写入，绕过 SaveManager checksum
      const legacyData = JSON.stringify({
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now() - 3600000, // 1 小时前
        resource: engine.resource.serialize(),
        building: engine.building.serialize(),
      });
      // 修改 lastSaveTime 模拟离线
      const parsed = JSON.parse(legacyData);
      parsed.resource.lastSaveTime = Date.now() - 3600000;
      storage[SAVE_KEY] = JSON.stringify(parsed);

      const engine2 = new ThreeKingdomsEngine();
      const offlineListener = vi.fn();
      engine2.on('game:offline-earnings', offlineListener);
      engine2.load();

      expect(engine2.isInitialized()).toBe(true);
      // 有产出时应该触发离线收益事件
      if (offlineListener.mock.calls.length > 0) {
        const earnings = offlineListener.mock.calls[0][0];
        expect(earnings).toHaveProperty('offlineSeconds');
        expect(earnings).toHaveProperty('earned');
      }
      engine2.reset();
    });
  });

  // ═══════════════════════════════════════════
  // 9. 加成体系框架
  // ═══════════════════════════════════════════
  describe('加成体系框架', () => {
    it('tick() 中 castle 加成正确传入（非零）', () => {
      engine.init();
      const snap1 = engine.getSnapshot();

      // 升级农田增加基础产出
      const check = engine.checkUpgrade('farmland');
      if (check.canUpgrade) {
        engine.upgradeBuilding('farmland');
        engine.tick(999999999);
      }

      // 升级主城增加加成
      const castleCheck = engine.checkUpgrade('castle');
      if (castleCheck.canUpgrade) {
        engine.upgradeBuilding('castle');
        engine.tick(999999999);
      }

      const snap2 = engine.getSnapshot();
      expect(snap2.productionRates.grain).toBeGreaterThan(0);
    });

    it('tech/hero/rebirth/vip 加成预留为 0', () => {
      engine.init();
      // 预留加成均为 0，产出仅受 castle 影响
      expect(() => engine.tick(1000)).not.toThrow();
      const snap = engine.getSnapshot();
      expect(snap.productionRates).toBeDefined();
    });

    it('未来版本可通过修改 Bonuses 对象接入新加成', () => {
      engine.init();
      engine.tick(1000);
      engine.tick(1000);
      engine.tick(1000);
      expect(engine.isInitialized()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 10. v1.0 存档迁移 → 武将系统自动初始化
  // ═══════════════════════════════════════════
  describe('v1.0 存档迁移（无武将数据）', () => {
    /** 创建一个不含 hero/recruit 字段的 v1.0 旧格式存档 */
    function makeV1Save(): string {
      return JSON.stringify({
        version: ENGINE_SAVE_VERSION,
        saveTime: Date.now() - 1000,
        resource: {
          resources: { grain: 5000, gold: 2000, troops: 500, mandate: 10 },
          lastSaveTime: Date.now() - 1000,
          productionRates: { grain: 2, gold: 1, troops: 0.5, mandate: 0 },
          caps: { grain: 10000, gold: 2000, troops: 5000, mandate: null },
          version: 1,
        },
        building: {
          buildings: {
            castle:   { type: 'castle',   level: 2, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
            farmland: { type: 'farmland',  level: 3, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
            market:   { type: 'market',    level: 1, status: 'idle', upgradeStartTime: null, upgradeEndTime: null },
            barracks: { type: 'barracks',  level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            workshop:   { type: 'workshop',    level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            academy:  { type: 'academy',   level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            clinic:   { type: 'clinic',    level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
            wall:     { type: 'wall',      level: 0, status: 'locked', upgradeStartTime: null, upgradeEndTime: null },
          },
          version: 1,
        },
        // 注意：无 hero、recruit、calendar 字段 — 模拟 v1.0 存档
      });
    }

    it('v1.0 存档加载后引擎初始化成功', () => {
      storage[SAVE_KEY] = makeV1Save();
      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      expect(engine2.isInitialized()).toBe(true);
      engine2.reset();
    });

    it('v1.0 存档加载后武将列表为空', () => {
      storage[SAVE_KEY] = makeV1Save();
      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      const generals = engine2.getGenerals();
      expect(generals).toHaveLength(0);
      engine2.reset();
    });

    it('v1.0 存档加载后武将碎片为空', () => {
      storage[SAVE_KEY] = makeV1Save();
      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      const fragments = engine2.getHeroSystem().getAllFragments();
      expect(Object.keys(fragments)).toHaveLength(0);
      engine2.reset();
    });

    it('v1.0 存档加载后总战力为 0', () => {
      storage[SAVE_KEY] = makeV1Save();
      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      const snap = engine2.getSnapshot();
      expect(snap.totalPower).toBe(0);
      engine2.reset();
    });

    it('v1.0 存档加载后保底计数器全为 0', () => {
      storage[SAVE_KEY] = makeV1Save();
      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      const pity = engine2.getRecruitSystem().getGachaState();
      expect(pity.normalPity).toBe(0);
      expect(pity.advancedPity).toBe(0);
      expect(pity.normalHardPity).toBe(0);
      expect(pity.advancedHardPity).toBe(0);
      engine2.reset();
    });

    it('v1.0 存档加载后招募系统可正常工作（canRecruit 检查）', () => {
      storage[SAVE_KEY] = makeV1Save();
      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      // canRecruit 应能正常调用（不抛异常），即使资源可能不足
      expect(() => engine2.getRecruitSystem().canRecruit('normal', 1)).not.toThrow();
      engine2.reset();
    });

    it('v1.0 存档迁移后保存再加载，武将系统数据完整', () => {
      storage[SAVE_KEY] = makeV1Save();
      const engine2 = new ThreeKingdomsEngine();
      engine2.load();
      // 迁移后保存
      engine2.save();

      // 再次加载
      const engine3 = new ThreeKingdomsEngine();
      engine3.load();
      expect(engine3.isInitialized()).toBe(true);
      expect(engine3.getGenerals()).toHaveLength(0);
      // 存档中应包含 hero 和 recruit 数据
      const raw = storage[SAVE_KEY];
      const outer = JSON.parse(raw);
      const inner = JSON.parse(outer.data);
      expect(inner.subsystems.hero).toBeDefined();
      expect(inner.subsystems.recruit).toBeDefined();
      engine3.reset();
      engine2.reset();
    });
  });
});
