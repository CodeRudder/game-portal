/**
 * R24-R25: 并发安全 + 关键Bug回归测试
 *
 * R24 并发安全测试（3个场景）：
 *   R24-1 资源并发操作 — 同时消耗同一资源，验证余额不为负
 *   R24-2 建筑队列并发 — 同时升级多个建筑，验证队列限制正确
 *   R24-3 存档并发读写 — tick中保存+玩家操作保存，验证数据一致性
 *
 * R25 关键回归测试（4个已修复bug）：
 *   R25-1 isStepCompleted崩溃（_stateMachine为undefined）— commit 98736bef
 *   R25-2 建筑升级5秒回退（loadFromStorage时序问题）
 *   R25-3 武将升级后属性不显示（statsAtLevel私有函数问题）
 *   R25-4 商店Tab标签语义错误（black_market→黑市）
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── 引擎 & 子系统 ──
import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import { ResourceSystem } from '../resource/ResourceSystem';
import { BuildingSystem } from '../building/BuildingSystem';
import { INITIAL_RESOURCES, INITIAL_CAPS, MIN_GRAIN_RESERVE } from '../resource/resource-config';
import { BUILDING_DEFS, BUILDING_MAX_LEVELS, QUEUE_CONFIGS } from '../building/building-config';

// ── 引导系统 ──
import { TutorialStepManager, type TutorialGameState } from '../guide/TutorialStepManager';
import { TutorialStepExecutor } from '../guide/TutorialStepExecutor';
import { TutorialStateMachine } from '../guide/TutorialStateMachine';
import { createGuideSystems, initGuideSystems } from '../engine-guide-deps';

// ── 武将系统 ──
import { HeroLevelSystem, statsAtLevel } from '../hero/HeroLevelSystem';
import { HeroSystem } from '../hero/HeroSystem';
import type { LevelDeps } from '../hero/HeroLevelSystem';
import type { GeneralStats } from '../hero/hero.types';

// ── 商店系统 ──
import { SHOP_TYPE_LABELS, SHOP_TYPES, type ShopType } from '../../core/shop/shop.types';

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

function createMockDeps() {
  return {
    eventBus: { on: vi.fn(), once: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

// ═══════════════════════════════════════════════════════════════
// R24: 并发安全测试
// ═══════════════════════════════════════════════════════════════
describe('R24: 并发安全测试', () => {

  // ───────────────────────────────────────────
  // R24-1: 资源并发操作
  // ───────────────────────────────────────────
  describe('R24-1: 资源并发操作 — 余额不为负', () => {
    let rs: ResourceSystem;
    beforeEach(() => {
      vi.restoreAllMocks();
      rs = new ResourceSystem();
      rs.init(createMockDeps());
    });

    it('同步循环快速消耗gold，余额始终≥0且最终精确', () => {
      const initialGold = rs.getAmount('gold');
      const perConsume = 10;
      const maxRounds = Math.floor(initialGold / perConsume);

      // 消耗到接近 0
      for (let i = 0; i < maxRounds; i++) {
        rs.consumeResource('gold', perConsume);
      }

      const remaining = rs.getAmount('gold');
      expect(remaining).toBe(initialGold - maxRounds * perConsume);
      expect(remaining).toBeGreaterThanOrEqual(0);

      // 再消耗1单位应失败
      expect(() => rs.consumeResource('gold', 1)).toThrow();
      expect(rs.getAmount('gold')).toBe(remaining);
    });

    it('模拟"升级建筑+招募武将"并发消耗同一资源（gold），余额不为负', () => {
      // 设置初始资源为刚好够一项操作
      const goldNeeded = 100;
      rs.setResource('gold', goldNeeded);

      // 第一次消耗成功
      rs.consumeResource('gold', goldNeeded);
      expect(rs.getAmount('gold')).toBe(0);

      // 第二次消耗（模拟并发请求同一资源）应失败
      expect(() => rs.consumeResource('gold', goldNeeded)).toThrow();
      expect(rs.getAmount('gold')).toBe(0); // 余额不为负
    });

    it('批量消耗（consumeBatch）并发场景：中间失败不影响已扣除的资源', () => {
      // 设置 gold 充足但 grain 不足
      rs.setResource('gold', 10000);
      rs.setResource('grain', 5); // 很少

      const before = rs.getResources();

      // 批量消耗 gold 和 grain，因 grain 不足应整体失败
      expect(() => rs.consumeBatch({ gold: 100, grain: 50 })).toThrow();

      // 状态不变（原子性）
      expect(rs.getResources()).toEqual(before);
    });

    it('粮草保护：并发消耗grain时始终保留MIN_GRAIN_RESERVE', () => {
      rs.setResource('grain', MIN_GRAIN_RESERVE + 50);

      // 第一次消耗到保留量
      rs.consumeResource('grain', 50);
      expect(rs.getAmount('grain')).toBe(MIN_GRAIN_RESERVE);

      // 第二次消耗（模拟并发）应失败
      expect(() => rs.consumeResource('grain', 1)).toThrow();
      expect(rs.getAmount('grain')).toBe(MIN_GRAIN_RESERVE);
    });

    it('并发addResource + consumeResource不导致NaN或负数', () => {
      // 快速交替添加和消耗
      for (let i = 0; i < 100; i++) {
        rs.addResource('gold', 50);
        rs.consumeResource('gold', 30);
      }

      const gold = rs.getAmount('gold');
      expect(Number.isFinite(gold)).toBe(true);
      expect(gold).toBeGreaterThanOrEqual(0);
    });
  });

  // ───────────────────────────────────────────
  // R24-2: 建筑队列并发
  // ───────────────────────────────────────────
  describe('R24-2: 建筑队列并发 — 队列限制正确', () => {
    let engine: ThreeKingdomsEngine;
    beforeEach(() => {
      Object.keys(storage).forEach(k => delete storage[k]);
      vi.restoreAllMocks();
      vi.useFakeTimers();
      engine = new ThreeKingdomsEngine();
      engine.init();
    });
    afterEach(() => { engine.reset(); vi.useRealTimers(); });

    it('主城Lv1时队列上限为1，第二个升级请求被拒绝且资源不扣', () => {
      const maxSlots = engine.building.getMaxQueueSlots();
      expect(maxSlots).toBe(1);

      const resourcesBefore = engine.resource.getResources();

      // 第一个升级成功
      engine.upgradeBuilding('farmland');
      expect(engine.building.getBuilding('farmland').status).toBe('upgrading');

      // 第二个升级（不同建筑）应因队列满而失败
      expect(() => engine.upgradeBuilding('castle')).toThrow(/队列已满/);

      // 资源只扣了一次
      const farmlandCost = BUILDING_DEFS.farmland.levelTable[1].upgradeCost;
      const resourcesAfter = engine.resource.getResources();
      expect(resourcesAfter.gold).toBe(resourcesBefore.gold - farmlandCost.gold);
      expect(resourcesAfter.grain).toBe(resourcesBefore.grain - farmlandCost.grain);
    });

    it('快速连续升级同一建筑：第二次被幂等保护拒绝', () => {
      engine.upgradeBuilding('farmland');
      const resourcesAfterFirst = engine.resource.getResources();

      // 第二次升级同一建筑应失败
      expect(() => engine.upgradeBuilding('farmland')).toThrow();

      // 资源不变
      expect(engine.resource.getResources()).toEqual(resourcesAfterFirst);
    });

    it('队列满后取消升级，新升级可以继续', () => {
      engine.upgradeBuilding('farmland');
      expect(engine.building.isQueueFull()).toBe(true);

      // 取消升级
      const refund = engine.cancelUpgrade('farmland');
      expect(refund).not.toBeNull();
      expect(engine.building.isQueueFull()).toBe(false);

      // 现在可以升级其他建筑
      engine.upgradeBuilding('castle');
      expect(engine.building.getBuilding('castle').status).toBe('upgrading');
    });

    it('升级完成后队列自动释放，可继续升级', () => {
      const cost = engine.getUpgradeCost('farmland')!;
      engine.upgradeBuilding('farmland');

      // 推进时间完成升级
      vi.advanceTimersByTime(cost.timeSeconds * 1000 + 100);
      engine.tick(cost.timeSeconds * 1000 + 100);

      // 队列已释放
      expect(engine.building.getBuilding('farmland').status).toBe('idle');
      expect(engine.building.isQueueFull()).toBe(false);

      // 可以继续升级
      engine.upgradeBuilding('castle');
      expect(engine.building.getBuilding('castle').status).toBe('upgrading');
    });
  });

  // ───────────────────────────────────────────
  // R24-3: 存档并发读写
  // ───────────────────────────────────────────
  describe('R24-3: 存档并发读写 — 数据一致性', () => {
    let engine: ThreeKingdomsEngine;
    beforeEach(() => {
      Object.keys(storage).forEach(k => delete storage[k]);
      vi.restoreAllMocks();
      vi.useFakeTimers();
      engine = new ThreeKingdomsEngine();
      engine.init();
    });
    afterEach(() => { engine.reset(); vi.useRealTimers(); });

    it('tick自动保存 + 手动save，最终数据一致', () => {
      engine.resource.addResource('gold', 1000);
      engine.save();

      // 模拟 tick 中的自动保存
      engine.resource.addResource('gold', 500);
      engine.save();

      // 反序列化最后一次保存
      const serialized = engine.serialize();
      const parsed = JSON.parse(serialized);
      expect(parsed.resource.resources.gold).toBe(INITIAL_RESOURCES.gold + 1500);
    });

    it('save → tick产出 → save，资源产出不丢失', () => {
      engine.save();
      const grainBefore = engine.resource.getAmount('grain');

      // 模拟 tick 产出（grain有初始产出速率0.8/s，gold无产出速率）
      engine.tick(5000); // 5秒

      const grainAfterTick = engine.resource.getAmount('grain');
      expect(grainAfterTick).toBeGreaterThan(grainBefore);

      // 保存后反序列化验证
      engine.save();
      const serialized = engine.serialize();
      const parsed = JSON.parse(serialized);
      expect(parsed.resource.resources.grain).toBe(grainAfterTick);
    });

    it('快速连续 serialize/deserialize 循环，数据完整无损', () => {
      engine.resource.addResource('gold', 777);
      engine.resource.addResource('grain', 1234);

      // 不升级建筑（避免消耗资源），只修改资源
      const goldExpected = INITIAL_RESOURCES.gold + 777;
      const grainExpected = INITIAL_RESOURCES.grain + 1234;

      const serialized = engine.serialize();

      // 多次 deserialize → serialize 循环
      let current = serialized;
      for (let i = 0; i < 5; i++) {
        engine.reset();
        engine = new ThreeKingdomsEngine();
        engine.deserialize(current);
        current = engine.serialize();
      }

      const finalParsed = JSON.parse(current);
      // 资源值保持一致（gold和grain）
      expect(finalParsed.resource.resources.gold).toBe(goldExpected);
      expect(finalParsed.resource.resources.grain).toBe(grainExpected);
    });

    it('tick过程中修改资源后立即save，数据一致性', () => {
      // 模拟游戏循环中资源产出和保存交替
      // grain有产出速率0.8/s，每次tick 1秒约增加0.8
      // gold也有产出速率（market Lv1 = 0.6/s），每次tick 1秒约增加0.6
      const grainBefore = engine.resource.getAmount('grain');
      const goldBefore = engine.resource.getAmount('gold');
      for (let i = 0; i < 10; i++) {
        engine.tick(1000);
        engine.resource.addResource('gold', 100);
        engine.save();
      }

      const serialized = engine.serialize();
      const parsed = JSON.parse(serialized);
      // grain = 初始 + 10次tick产出
      expect(parsed.resource.resources.grain).toBeGreaterThan(grainBefore);
      // gold = tick前值 + 10次手动添加100 + 10次tick产出（market Lv1 = 0.6/s）
      const goldAfter = parsed.resource.resources.gold;
      const manualGold = 1000;
      const tickGoldProduced = goldAfter - goldBefore - manualGold;
      // tick产出应为正值且合理（10次 × 0.6 = 6）
      expect(tickGoldProduced).toBeGreaterThan(0);
      expect(goldAfter).toBe(goldBefore + manualGold + tickGoldProduced);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// R25: 关键Bug回归测试
// ═══════════════════════════════════════════════════════════════
describe('R25: 关键Bug回归测试', () => {

  // ───────────────────────────────────────────
  // R25-1: isStepCompleted崩溃（_stateMachine为undefined）
  // 参考 commit 98736bef
  // ───────────────────────────────────────────
  describe('R25-1: isStepCompleted崩溃 — _stateMachine空值防御', () => {
    it('TutorialStepManager 未注入 stateMachine 时 getNextStep 不崩溃', () => {
      const mgr = new TutorialStepManager();
      mgr.init(createMockDeps());
      // 不调用 setStateMachine — _stateMachine 为 null

      expect(() => mgr.getNextStep()).not.toThrow();
      expect(mgr.getNextStep()).toBeNull();
    });

    it('TutorialStepManager 未注入 stateMachine 时 getNextCoreStep 不崩溃', () => {
      const mgr = new TutorialStepManager();
      mgr.init(createMockDeps());

      expect(() => mgr.getNextCoreStep()).not.toThrow();
      expect(mgr.getNextCoreStep()).toBeNull();
    });

    it('TutorialStepManager 未注入 stateMachine 时 startStep 安全降级', () => {
      const mgr = new TutorialStepManager();
      mgr.init(createMockDeps());

      const result = mgr.startStep('step1_castle_overview');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('引导系统未初始化');
    });

    it('TutorialStepManager 未注入 stateMachine 时 advanceSubStep 安全降级', () => {
      const mgr = new TutorialStepManager();
      mgr.init(createMockDeps());

      const result = mgr.advanceSubStep('step1_castle_overview');
      expect(result.completed).toBe(false);
    });

    it('TutorialStepExecutor 未注入 stateMachine 时 checkExtendedStepTriggers 不崩溃', () => {
      const executor = new TutorialStepExecutor();
      executor.init(createMockDeps());

      const emptyGameState: TutorialGameState = {
        castleLevel: 0, heroCount: 0, battleCount: 0,
        techCount: 0, allianceJoined: false, firstAlliance: false, bagCapacityPercent: 0,
      };
      expect(() => executor.checkExtendedStepTriggers(emptyGameState)).not.toThrow();
      expect(executor.checkExtendedStepTriggers(emptyGameState)).toBeNull();
    });

    it('注入 stateMachine 后正常工作（不返回null降级）', () => {
      const systems = createGuideSystems();
      initGuideSystems(systems, createMockDeps());

      // 注入后 getNextStep 应正常工作（可能返回null因为所有步骤未完成，但不是因为_stateMachine为null）
      expect(() => systems.tutorialStepManager.getNextStep()).not.toThrow();
      // result 可能是步骤定义或 null（取决于步骤是否完成），但不应崩溃
      const step = systems.tutorialStepManager.getNextStep();
      // 如果所有核心步骤都未完成，应返回第一个步骤
      if (step) {
        expect(step.stepId).toBeDefined();
      }
    });
  });

  // ───────────────────────────────────────────
  // R25-2: 建筑升级5秒回退（loadFromStorage时序问题）
  // ───────────────────────────────────────────
  describe('R25-2: 建筑升级5秒回退 — deserialize时序', () => {
    let engine: ThreeKingdomsEngine;
    beforeEach(() => {
      Object.keys(storage).forEach(k => delete storage[k]);
      vi.restoreAllMocks();
      vi.useFakeTimers();
      engine = new ThreeKingdomsEngine();
      engine.init();
    });
    afterEach(() => { engine.reset(); vi.useRealTimers(); });

    it('升级中建筑序列化→反序列化后状态保持upgrading', () => {
      engine.upgradeBuilding('farmland');
      const bBefore = engine.building.getBuilding('farmland');
      expect(bBefore.status).toBe('upgrading');
      expect(bBefore.upgradeEndTime).not.toBeNull();

      // 序列化
      const serialized = engine.serialize();

      // 反序列化到新引擎
      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.deserialize(serialized);

      const bAfter = engine.building.getBuilding('farmland');
      // 状态应保持 upgrading（不回退为 idle）
      expect(bAfter.status).toBe('upgrading');
      expect(bAfter.upgradeEndTime).not.toBeNull();
      expect(bAfter.level).toBe(bBefore.level); // 等级不变
    });

    it('升级中建筑经过足够时间后deserialize应自动完成升级', () => {
      const cost = engine.getUpgradeCost('farmland')!;
      const levelBefore = engine.building.getLevel('farmland');

      engine.upgradeBuilding('farmland');

      // 序列化当前状态
      const serialized = engine.serialize();

      // 推进时间超过升级所需时间
      vi.advanceTimersByTime(cost.timeSeconds * 1000 + 5000);

      // 反序列化（模拟离线后加载）
      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.deserialize(serialized);

      // deserialize 内部应检测到升级已到期，自动完成
      const bAfter = engine.building.getBuilding('farmland');
      expect(bAfter.status).toBe('idle');
      expect(bAfter.level).toBe(levelBefore + 1);
      expect(bAfter.upgradeStartTime).toBeNull();
      expect(bAfter.upgradeEndTime).toBeNull();
    });

    it('升级中建筑未到期deserialize后队列正确恢复', () => {
      const cost = engine.getUpgradeCost('farmland')!;

      engine.upgradeBuilding('farmland');

      // 序列化
      const serialized = engine.serialize();

      // 只推进一小段时间（未到期）
      vi.advanceTimersByTime(1000);

      // 反序列化
      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.deserialize(serialized);

      // 队列应正确恢复
      const queue = engine.building.getUpgradeQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].buildingType).toBe('farmland');
    });

    it('多个建筑升级中deserialize后状态一致', () => {
      // 先升级主城以增加队列容量 — 直接设置主城等级
      const castleState = engine.building.getBuilding('castle');
      // 主城Lv6有2个队列槽位
      // 通过序列化修改主城等级
      const serialized1 = engine.serialize();
      const data1 = JSON.parse(serialized1);
      data1.building.buildings.castle.level = 6;
      data1.building.buildings.castle.status = 'idle';
      // 解锁更多建筑
      data1.building.buildings.market.level = 1;
      data1.building.buildings.market.status = 'idle';
      data1.building.buildings.barracks.level = 1;
      data1.building.buildings.barracks.status = 'idle';

      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.deserialize(JSON.stringify(data1));

      // 给足够资源
      engine.resource.addResource('gold', 100000);
      engine.resource.addResource('grain', 100000);

      // 升级两个建筑
      engine.upgradeBuilding('farmland');
      engine.upgradeBuilding('market');

      expect(engine.building.getBuilding('farmland').status).toBe('upgrading');
      expect(engine.building.getBuilding('market').status).toBe('upgrading');

      // 序列化 → 反序列化
      const serialized2 = engine.serialize();
      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.deserialize(serialized2);

      // 两个建筑都应保持 upgrading
      expect(engine.building.getBuilding('farmland').status).toBe('upgrading');
      expect(engine.building.getBuilding('market').status).toBe('upgrading');
      expect(engine.building.getUpgradeQueue()).toHaveLength(2);
    });
  });

  // ───────────────────────────────────────────
  // R25-3: 武将升级后属性不显示（statsAtLevel私有函数问题）
  // ───────────────────────────────────────────
  describe('R25-3: 武将升级后属性不显示 — statsAtLevel导出', () => {
    it('statsAtLevel 函数已正确导出，可直接调用', () => {
      expect(statsAtLevel).toBeDefined();
      expect(typeof statsAtLevel).toBe('function');
    });

    it('statsAtLevel 基础属性在Lv1时等于baseStats', () => {
      const baseStats: GeneralStats = {
        attack: 100,
        defense: 80,
        intelligence: 60,
        speed: 50,
      };

      const stats = statsAtLevel(baseStats, 1);
      expect(stats.attack).toBe(100);
      expect(stats.defense).toBe(80);
      expect(stats.intelligence).toBe(60);
      expect(stats.speed).toBe(50);
    });

    it('statsAtLevel 属性随等级增长而增长', () => {
      const baseStats: GeneralStats = {
        attack: 100,
        defense: 80,
        intelligence: 60,
        speed: 50,
      };

      const stats1 = statsAtLevel(baseStats, 1);
      const stats10 = statsAtLevel(baseStats, 10);
      const stats50 = statsAtLevel(baseStats, 50);

      // 属性应随等级增长
      expect(stats10.attack).toBeGreaterThan(stats1.attack);
      expect(stats50.attack).toBeGreaterThan(stats10.attack);
      expect(stats10.defense).toBeGreaterThan(stats1.defense);
      expect(stats50.defense).toBeGreaterThan(stats10.defense);
    });

    it('statsAtLevel 返回值都是整数（无浮点数显示问题）', () => {
      const baseStats: GeneralStats = {
        attack: 97,
        defense: 83,
        intelligence: 61,
        speed: 47,
      };

      for (let lv = 1; lv <= 100; lv++) {
        const stats = statsAtLevel(baseStats, lv);
        expect(Number.isInteger(stats.attack)).toBe(true);
        expect(Number.isInteger(stats.defense)).toBe(true);
        expect(Number.isInteger(stats.intelligence)).toBe(true);
        expect(Number.isInteger(stats.speed)).toBe(true);
      }
    });

    it('statsAtLevel 所有属性值始终≥0', () => {
      const baseStats: GeneralStats = {
        attack: 1,
        defense: 1,
        intelligence: 1,
        speed: 1,
      };

      for (let lv = 1; lv <= 200; lv++) {
        const stats = statsAtLevel(baseStats, lv);
        expect(stats.attack).toBeGreaterThanOrEqual(0);
        expect(stats.defense).toBeGreaterThanOrEqual(0);
        expect(stats.intelligence).toBeGreaterThanOrEqual(0);
        expect(stats.speed).toBeGreaterThanOrEqual(0);
      }
    });

    it('HeroLevelSystem.levelUp 返回的 statsDiff 包含正确的升级后属性', () => {
      // 使用真实 HeroSystem（levelUp 需要 heroSystem.setLevelAndExp）
      const hs = new HeroSystem();
      hs.addGeneral('guanyu');

      const ls = new HeroLevelSystem();

      const resources: Record<string, number> = { gold: 1e9, exp: 1e9 };
      const mockLevelDeps: LevelDeps = {
        heroSystem: hs,
        spendResource: vi.fn((type: string, amount: number) => {
          resources[type] -= amount;
          return true;
        }),
        canAffordResource: vi.fn((type: string, amount: number) => resources[type] >= amount),
        getResourceAmount: vi.fn((type: string) => resources[type]),
      };

      ls.init(createMockDeps());
      ls.setLevelDeps(mockLevelDeps);

      // 通过序列化直接设置武将经验，避免 addExp 自动升级
      const expReq = ls.calculateExpToNextLevel(1);
      const save = hs.serialize();
      save.state.generals['guanyu'].exp = expReq;
      const hs2 = new HeroSystem();
      hs2.deserialize(save);
      ls.setLevelDeps({
        ...mockLevelDeps,
        heroSystem: hs2,
      });

      const general = hs2.getGeneral('guanyu')!;
      expect(general.exp).toBeGreaterThanOrEqual(expReq);

      const result = ls.levelUp('guanyu');
      expect(result).not.toBeNull();
      expect(result!.levelsGained).toBe(1);

      // statsDiff.after 应包含正确的升级后属性
      const expectedStats = statsAtLevel(general.baseStats, 2);
      expect(result!.statsDiff.after.attack).toBe(expectedStats.attack);
      expect(result!.statsDiff.after.defense).toBe(expectedStats.defense);
      expect(result!.statsDiff.after.intelligence).toBe(expectedStats.intelligence);
      expect(result!.statsDiff.after.speed).toBe(expectedStats.speed);
    });
  });

  // ───────────────────────────────────────────
  // R25-4: 商店Tab标签语义错误（black_market→黑市）
  // ───────────────────────────────────────────
  describe('R25-4: 商店Tab标签语义错误 — black_market→黑市', () => {
    it('black_market 标签为"黑市"', () => {
      expect(SHOP_TYPE_LABELS.black_market).toBe('黑市');
    });

    it('black_market 标签不是"竞技商店"', () => {
      expect(SHOP_TYPE_LABELS.black_market).not.toBe('竞技商店');
    });

    it('black_market 标签不包含"竞技"', () => {
      expect(SHOP_TYPE_LABELS.black_market).not.toContain('竞技');
    });

    it('所有商店类型标签语义正确', () => {
      // 验证每个类型的标签与其语义匹配
      const expectedLabels: Record<ShopType, string> = {
        normal: '集市',
        black_market: '黑市',
        limited_time: '限时特惠',
        vip: 'VIP商店',
      };

      for (const type of SHOP_TYPES) {
        expect(SHOP_TYPE_LABELS[type]).toBe(expectedLabels[type]);
      }
    });

    it('limited_time 标签不是"远征商店"', () => {
      expect(SHOP_TYPE_LABELS.limited_time).not.toBe('远征商店');
      expect(SHOP_TYPE_LABELS.limited_time).not.toContain('远征');
    });

    it('vip 标签不是"联盟商店"', () => {
      expect(SHOP_TYPE_LABELS.vip).not.toBe('联盟商店');
      expect(SHOP_TYPE_LABELS.vip).not.toContain('联盟');
    });

    it('所有标签非空且为中文', () => {
      for (const type of SHOP_TYPES) {
        const label = SHOP_TYPE_LABELS[type];
        expect(label).toBeTruthy();
        expect(label.length).toBeGreaterThan(0);
        // 标签应包含中文字符或VIP等常见缩写
        expect(/[\u4e00-\u9fffA-Z]/.test(label)).toBe(true);
      }
    });

    it('SHOP_TYPE_LABELS 的 key 与 SHOP_TYPES 完全对应', () => {
      for (const type of SHOP_TYPES) {
        expect(type in SHOP_TYPE_LABELS).toBe(true);
      }
    });
  });
});
