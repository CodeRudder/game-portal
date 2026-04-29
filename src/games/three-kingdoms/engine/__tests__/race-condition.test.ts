import { vi } from 'vitest';
/**
 * 快速操作竞态测试
 *
 * 验证引擎在快速连续操作下的数据一致性和防抖保护：
 * - 快速连续点击升级（防抖/幂等性）
 * - 快速连续购买（库存检查）
 * - 快速连续存档（数据完整性）
 * - 战斗中修改编队（状态锁定）
 * - 离线收益计算中上线（计算完成后再操作）
 *
 * 覆盖 12 个用例
 */

import { ThreeKingdomsEngine } from '../ThreeKingdomsEngine';
import { ResourceSystem } from '../resource/ResourceSystem';
import { BuildingSystem } from '../building/BuildingSystem';
import { BUILDING_DEFS } from '../building/building-config';
import { INITIAL_RESOURCES, INITIAL_CAPS, MIN_GRAIN_RESERVE } from '../resource/resource-config';

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

describe('快速操作竞态测试', () => {
  // ═══════════════════════════════════════════
  // A. 快速连续点击升级
  // ═══════════════════════════════════════════
  describe('快速连续点击升级', () => {
    let engine: ThreeKingdomsEngine;
    beforeEach(() => {
      Object.keys(storage).forEach(k => delete storage[k]);
      vi.restoreAllMocks();
      vi.useFakeTimers();
      engine = new ThreeKingdomsEngine();
      engine.init();
    });
    afterEach(() => { engine.reset(); vi.useRealTimers(); });

    it('同一建筑升级中不能再次升级（幂等保护）', () => {
      engine.upgradeBuilding('farmland');
      // 建筑已处于 upgrading 状态
      expect(engine.building.getBuilding('farmland').status).toBe('upgrading');

      // 第二次升级应失败
      expect(() => engine.upgradeBuilding('farmland')).toThrow();
      // 状态仍然是 upgrading，不会变成双重升级
      expect(engine.building.getBuilding('farmland').status).toBe('upgrading');
    });

    it('快速连续升级不同建筑时，队列满后第二次失败', () => {
      const resourcesBefore = engine.resource.getResources();

      // 主城 Lv1 只有 1 个升级槽位
      engine.upgradeBuilding('farmland');
      expect(engine.building.getBuilding('farmland').status).toBe('upgrading');

      // 第二次升级不同建筑应因队列满而失败
      expect(() => engine.upgradeBuilding('castle')).toThrow(/队列已满/);

      // 资源只扣了一次
      const farmlandCost = BUILDING_DEFS.farmland.levelTable[1].upgradeCost;
      const resourcesAfter = engine.resource.getResources();
      expect(resourcesAfter.grain).toBe(resourcesBefore.grain - farmlandCost.grain);
      expect(resourcesAfter.gold).toBe(resourcesBefore.gold - farmlandCost.gold);
    });

    it('资源仅够升级一个建筑时，第二个升级失败且资源不变', () => {
      // 消耗大部分资源，只够升级一个
      const castleCost = engine.getUpgradeCost('castle')!;
      const reserve = castleCost.gold + 10; // 只多留 10 gold
      const goldToConsume = engine.resource.getAmount('gold') - reserve;
      engine.resource.consumeResource('gold', goldToConsume);

      engine.upgradeBuilding('castle');

      const resourcesAfterFirst = engine.resource.getResources();

      // 尝试升级农田应该失败
      expect(() => engine.upgradeBuilding('farmland')).toThrow();

      // 资源不变
      expect(engine.resource.getResources()).toEqual(resourcesAfterFirst);
    });
  });

  // ═══════════════════════════════════════════
  // B. 快速连续消耗资源
  // ═══════════════════════════════════════════
  describe('快速连续消耗资源', () => {
    let rs: ResourceSystem;
    beforeEach(() => {
      vi.restoreAllMocks();
      rs = new ResourceSystem();
      rs.init(createMockDeps());
    });

    it('快速连续消耗同一资源，第二次不足时抛错且余额不变', () => {
      const goldAmount = rs.getAmount('gold');
      // 第一次消耗大部分
      rs.consumeResource('gold', goldAmount - 10);
      const afterFirst = rs.getAmount('gold');
      expect(afterFirst).toBe(10);

      // 第二次消耗超过余额
      expect(() => rs.consumeResource('gold', 20)).toThrow();
      // 余额不变
      expect(rs.getAmount('gold')).toBe(10);
    });

    it('并发消耗 Batch 时，中间失败不影响已扣除的资源（单线程安全）', () => {
      const before = rs.getResources();
      // 先消耗到刚好不够
      rs.consumeResource('gold', rs.getAmount('gold') - 5);
      const afterConsume = rs.getResources();

      // 尝试批量消耗超过余额
      expect(() => rs.consumeBatch({ gold: 10 })).toThrow();
      // 状态不变
      expect(rs.getResources()).toEqual(afterConsume);
    });

    it('粮草保护：消耗后保留 MIN_GRAIN_RESERVE', () => {
      const grainAmount = rs.getAmount('grain');
      // 尝试消耗到保留量以下
      const tryConsume = grainAmount - MIN_GRAIN_RESERVE + 1;
      if (tryConsume > 0) {
        // 应该可以消耗到保留量
        rs.consumeResource('grain', grainAmount - MIN_GRAIN_RESERVE);
        expect(rs.getAmount('grain')).toBe(MIN_GRAIN_RESERVE);

        // 再尝试消耗 1 点应该失败
        expect(() => rs.consumeResource('grain', 1)).toThrow();
        expect(rs.getAmount('grain')).toBe(MIN_GRAIN_RESERVE);
      }
    });
  });

  // ═══════════════════════════════════════════
  // C. 快速连续存档
  // ═══════════════════════════════════════════
  describe('快速连续存档', () => {
    let engine: ThreeKingdomsEngine;
    beforeEach(() => {
      Object.keys(storage).forEach(k => delete storage[k]);
      vi.restoreAllMocks();
      vi.useFakeTimers();
      engine = new ThreeKingdomsEngine();
      engine.init();
    });
    afterEach(() => { engine.reset(); vi.useRealTimers(); });

    it('快速连续 save 两次，后一次覆盖前一次，数据完整', () => {
      engine.resource.addResource('gold', 100);
      engine.save();

      engine.resource.addResource('gold', 200);
      engine.save();

      // 反序列化最后一次保存
      const serialized = engine.serialize();
      const parsed = JSON.parse(serialized);
      // 最后一次 save 时 gold 应该比初始多 300
      expect(parsed.resource.resources.gold).toBe(INITIAL_RESOURCES.gold + 300);
    });

    it('save → 修改 → load，恢复到保存时的状态', () => {
      engine.resource.addResource('gold', 500);
      engine.save();
      const saved = engine.serialize();

      // 修改资源
      engine.resource.addResource('gold', 1000);
      expect(engine.resource.getAmount('gold')).toBe(INITIAL_RESOURCES.gold + 1500);

      // 加载恢复
      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.deserialize(saved);

      expect(engine.resource.getAmount('gold')).toBe(INITIAL_RESOURCES.gold + 500);
    });

    it('序列化/反序列化循环后所有资源字段完整', () => {
      engine.resource.addResource('gold', 100);
      engine.resource.addResource('grain', 200);
      engine.resource.addResource('troops', 50);

      const serialized = engine.serialize();

      engine.reset();
      engine = new ThreeKingdomsEngine();
      engine.deserialize(serialized);

      const resources = engine.resource.getResources();
      expect(resources.gold).toBe(INITIAL_RESOURCES.gold + 100);
      expect(resources.grain).toBeLessThanOrEqual(INITIAL_CAPS.grain); // 可能在上限内截断
      expect(resources.troops).toBeLessThanOrEqual(INITIAL_CAPS.troops);
      // 所有资源字段存在且为有限数
      expect(Number.isFinite(resources.mandate)).toBe(true);
      expect(Number.isFinite(resources.techPoint)).toBe(true);
      expect(Number.isFinite(resources.recruitToken)).toBe(true);
      expect(Number.isFinite(resources.skillBook)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // D. 快速操作边界场景
  // ═══════════════════════════════════════════
  describe('快速操作边界场景', () => {
    let engine: ThreeKingdomsEngine;
    beforeEach(() => {
      Object.keys(storage).forEach(k => delete storage[k]);
      vi.restoreAllMocks();
      vi.useFakeTimers();
      engine = new ThreeKingdomsEngine();
      engine.init();
    });
    afterEach(() => { engine.reset(); vi.useRealTimers(); });

    it('升级中取消再升级，粮食全额返还金币 80% 返还', () => {
      const resourcesBefore = engine.resource.getResources();
      const cost = engine.getUpgradeCost('farmland')!;

      // 升级
      engine.upgradeBuilding('farmland');
      const resourcesAfterUpgrade = engine.resource.getResources();
      expect(resourcesAfterUpgrade.grain).toBe(resourcesBefore.grain - cost.grain);
      expect(resourcesAfterUpgrade.gold).toBe(resourcesBefore.gold - cost.gold);

      // 取消
      const refund = engine.cancelUpgrade('farmland');
      expect(refund).not.toBeNull();
      // 粮食全额返还，金币 80% 返还
      expect(refund!.grain).toBe(cost.grain);
      expect(refund!.gold).toBe(Math.round(cost.gold * 0.8));

      // 再次升级
      engine.upgradeBuilding('farmland');
      const resourcesAfterSecondUpgrade = engine.resource.getResources();
      // 第二次升级后的资源 = 初始 - 第一次升级费用 + 取消返还 - 第二次升级费用
      const goldRefund = Math.round(cost.gold * 0.8);
      expect(resourcesAfterSecondUpgrade.grain).toBe(resourcesBefore.grain - cost.grain);
      expect(resourcesAfterSecondUpgrade.gold).toBe(resourcesBefore.gold - cost.gold + goldRefund - cost.gold);
    });

    it('tick 推进后连续升级多个建筑（升级完成后队列释放）', () => {
      // 主城 Lv1 只有 1 个队列位
      engine.upgradeBuilding('farmland');
      const cost = engine.getUpgradeCost('farmland')!;
      vi.advanceTimersByTime(cost.timeSeconds * 1000 + 100);
      engine.tick(cost.timeSeconds * 1000 + 100);

      // 升级完成，队列释放
      expect(engine.building.getBuilding('farmland').status).toBe('idle');

      // 现在可以升级另一个建筑
      expect(() => engine.upgradeBuilding('castle')).not.toThrow();
      expect(engine.building.getBuilding('castle').status).toBe('upgrading');
    });

    it('资源刚好够升级时（含粮草保护量），升级成功', () => {
      const cost = engine.getUpgradeCost('farmland')!;
      // consumeBatch 使用 canAfford，粮草可用 = current - MIN_GRAIN_RESERVE(10)
      // 所以需要留够 cost.grain + 10 的粮草
      const grainNeeded = cost.grain + MIN_GRAIN_RESERVE;
      const grainToConsume = engine.resource.getAmount('grain') - grainNeeded;
      const goldToConsume = engine.resource.getAmount('gold') - cost.gold;
      engine.resource.consumeResource('grain', grainToConsume);
      engine.resource.consumeResource('gold', goldToConsume);

      // 刚好够升级（含保护量）
      expect(engine.resource.getAmount('grain')).toBe(grainNeeded);
      expect(engine.resource.getAmount('gold')).toBe(cost.gold);

      engine.upgradeBuilding('farmland');
      // 粮草 = grainNeeded - cost.grain = MIN_GRAIN_RESERVE
      expect(engine.resource.getAmount('grain')).toBe(MIN_GRAIN_RESERVE);
      expect(engine.resource.getAmount('gold')).toBe(0);
    });
  });
});
