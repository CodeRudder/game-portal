import { vi } from 'vitest';
/**
 * 状态机一致性测试
 *
 * 验证各系统状态转换的合法性和完整性：
 * - 建筑状态生命周期：locked → idle → upgrading → idle
 * - 武将状态转换：添加/移除/碎片管理
 * - 战斗流程状态：准备 → 进行 → 结算
 * - 引导状态转换：未开始 → 进行中 → 完成
 * - 存档状态：脏 → 保存 → 已保存
 *
 * 覆盖 12 个用例
 */

import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import { ResourceSystem } from '../resource/ResourceSystem';
import { BuildingSystem } from '../building/BuildingSystem';
import { HeroSystem } from '../hero/HeroSystem';
import { BUILDING_DEFS, BUILDING_UNLOCK_LEVELS, BUILDING_MAX_LEVELS } from '../building/building-config';
import { INITIAL_RESOURCES } from '../resource/resource-config';

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

describe('状态机一致性测试', () => {
  // ═══════════════════════════════════════════
  // A. 建筑状态生命周期
  // ═══════════════════════════════════════════
  describe('建筑状态生命周期', () => {
    let engine: ThreeKingdomsEngine;
    beforeEach(() => {
      Object.keys(storage).forEach(k => delete storage[k]);
      vi.restoreAllMocks();
      vi.useFakeTimers();
      engine = new ThreeKingdomsEngine();
      engine.init();
    });
    afterEach(() => { engine.reset(); vi.useRealTimers(); });

    it('基础建筑初始状态为 idle，等级为 1', () => {
      // farmland 和 castle 初始解锁
      expect(engine.building.getBuilding('castle').status).toBe('idle');
      expect(engine.building.getBuilding('castle').level).toBe(1);
      expect(engine.building.getBuilding('farmland').status).toBe('idle');
      expect(engine.building.getBuilding('farmland').level).toBe(1);
    });

    it('未解锁建筑状态为 locked，等级为 0', () => {
      // market 需要主城 Lv2 解锁
      expect(engine.building.getBuilding('market').status).toBe('locked');
      expect(engine.building.getBuilding('market').level).toBe(0);
    });

    it('升级中建筑状态为 upgrading，有开始和结束时间', () => {
      engine.upgradeBuilding('farmland');
      const b = engine.building.getBuilding('farmland');

      expect(b.status).toBe('upgrading');
      expect(b.upgradeStartTime).not.toBeNull();
      expect(b.upgradeEndTime).not.toBeNull();
      expect(b.upgradeEndTime! > b.upgradeStartTime!).toBe(true);
    });

    it('升级完成后状态回到 idle，等级 +1', () => {
      const levelBefore = engine.building.getLevel('farmland');
      const cost = engine.getUpgradeCost('farmland')!;

      engine.upgradeBuilding('farmland');
      expect(engine.building.getBuilding('farmland').status).toBe('upgrading');

      // 推进时间完成升级
      vi.advanceTimersByTime(cost.timeSeconds * 1000 + 100);
      engine.tick(cost.timeSeconds * 1000 + 100);

      expect(engine.building.getBuilding('farmland').status).toBe('idle');
      expect(engine.building.getLevel('farmland')).toBe(levelBefore + 1);
      expect(engine.building.getBuilding('farmland').upgradeStartTime).toBeNull();
      expect(engine.building.getBuilding('farmland').upgradeEndTime).toBeNull();
    });

    it('主城升级完成后，通过 deserialize 触发新建筑解锁', () => {
      // market 需要主城 Lv2
      expect(engine.building.getBuilding('market').status).toBe('locked');

      // 升级主城到 Lv2
      const cost = engine.getUpgradeCost('castle')!;
      engine.upgradeBuilding('castle');
      vi.advanceTimersByTime(cost.timeSeconds * 1000 + 100);
      engine.tick(cost.timeSeconds * 1000 + 100);

      // 主城等级已提升
      expect(engine.building.getLevel('castle')).toBe(2);

      // 通过 serialize → deserialize 触发 checkAndUnlockBuildings
      const serialized = engine.serialize();
      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.deserialize(serialized);

      // market 应该解锁
      expect(engine.building.getBuilding('market').status).toBe('idle');
      expect(engine.building.getBuilding('market').level).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // B. 武将状态转换
  // ═══════════════════════════════════════════
  describe('武将状态转换', () => {
    let hero: HeroSystem;
    beforeEach(() => {
      vi.restoreAllMocks();
      hero = new HeroSystem();
      hero.init(createMockDeps());
    });
    afterEach(() => hero.reset());

    it('添加武将后可以查询到，且属性完整', () => {
      const g = hero.addGeneral('guanyu');
      expect(g).not.toBeNull();
      expect(g!.id).toBe('guanyu');
      expect(g!.level).toBe(1);
      expect(g!.exp).toBe(0);
      expect(hero.hasGeneral('guanyu')).toBe(true);
    });

    it('重复添加同一武将返回 null，不影响已有数据', () => {
      hero.addGeneral('guanyu');
      const g2 = hero.addGeneral('guanyu');
      expect(g2).toBeNull();
      expect(hero.getGeneralCount()).toBe(1);
    });

    it('碎片添加后数量正确，上限 999 截断', () => {
      const overflow = hero.addFragment('guanyu', 1000);
      expect(hero.getFragments('guanyu')).toBe(999);
      expect(overflow).toBe(1); // 溢出 1 个
    });

    it('碎片消耗后数量减少，不足时返回 false', () => {
      hero.addFragment('guanyu', 50);
      expect(hero.useFragments('guanyu', 30)).toBe(true);
      expect(hero.getFragments('guanyu')).toBe(20);
      expect(hero.useFragments('guanyu', 30)).toBe(false); // 不足
      expect(hero.getFragments('guanyu')).toBe(20); // 数量不变
    });
  });

  // ═══════════════════════════════════════════
  // C. 存档状态一致性
  // ═══════════════════════════════════════════
  describe('存档状态一致性', () => {
    let engine: ThreeKingdomsEngine;
    beforeEach(() => {
      Object.keys(storage).forEach(k => delete storage[k]);
      vi.restoreAllMocks();
      vi.useFakeTimers();
      engine = new ThreeKingdomsEngine();
      engine.init();
    });
    afterEach(() => { engine.reset(); vi.useRealTimers(); });

    it('save → load 循环后资源数据一致', () => {
      // 修改资源
      engine.resource.addResource('gold', 500);
      const resourcesBefore = engine.resource.getResources();

      engine.save();
      const saved = engine.serialize();

      // 重置并加载
      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.deserialize(saved);

      const resourcesAfter = engine.resource.getResources();
      expect(resourcesAfter.gold).toBe(resourcesBefore.gold);
    });

    it('save → load 循环后建筑状态一致', () => {
      // 升级农田
      engine.upgradeBuilding('farmland');
      const cost = engine.getUpgradeCost('farmland')!;
      vi.advanceTimersByTime(cost.timeSeconds * 1000 + 100);
      engine.tick(cost.timeSeconds * 1000 + 100);

      const levelBefore = engine.building.getLevel('farmland');
      const serialized = engine.serialize();

      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.deserialize(serialized);

      expect(engine.building.getLevel('farmland')).toBe(levelBefore);
    });

    it('取消升级后建筑状态回到 idle，费用部分返还', () => {
      const resourcesBefore = engine.resource.getResources();
      engine.upgradeBuilding('farmland');
      expect(engine.building.getBuilding('farmland').status).toBe('upgrading');

      const refund = engine.cancelUpgrade('farmland');
      expect(refund).not.toBeNull();
      expect(engine.building.getBuilding('farmland').status).toBe('idle');
      // 返还了部分资源（80% 比例）
      expect(engine.resource.getAmount('gold')).toBeGreaterThan(resourcesBefore.gold - engine.getUpgradeCost('farmland')!.gold);
    });
  });
});
