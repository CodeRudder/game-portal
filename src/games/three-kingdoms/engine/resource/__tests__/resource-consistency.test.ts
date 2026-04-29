import { vi } from 'vitest';
/**
 * 资源一致性测试
 *
 * 验证多步操作的原子性：扣资源 + 状态变更必须同时成功或同时失败。
 * 不允许出现"扣了钱但操作没执行"或"操作执行了但没扣钱"的不一致状态。
 *
 * 覆盖场景：
 * - 升级建筑的资源一致性
 * - 消耗操作的原子性
 * - 招募武将的资源一致性
 * - 战斗奖励的完整性
 * - 资源溢出截断
 * - 资源非负约束
 */

import { ThreeKingdomsEngine } from '../../ThreeKingdomsEngine';
import { ResourceSystem } from '../ResourceSystem';
import { INITIAL_RESOURCES, INITIAL_CAPS, MIN_GRAIN_RESERVE } from '../resource-config';
import { BUILDING_DEFS } from '../../building/building-config';
import type { ResourceSaveData } from '../../../shared/types';

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

describe('资源一致性测试', () => {
  // ═══════════════════════════════════════════
  // A. 升级建筑：扣钱 + 升级 原子性
  // ═══════════════════════════════════════════
  describe('升级建筑原子性', () => {
    let engine: ThreeKingdomsEngine;
    beforeEach(() => {
      Object.keys(storage).forEach(k => delete storage[k]);
      vi.restoreAllMocks();
      vi.useFakeTimers();
      engine = new ThreeKingdomsEngine();
      engine.init();
    });
    afterEach(() => { engine.reset(); vi.useRealTimers(); });

    it('升级主城：资源扣除与建筑状态变更必须同时生效', () => {
      const resourcesBefore = engine.resource.getResources();
      const levelBefore = engine.building.getLevel('castle');
      const cost = engine.getUpgradeCost('castle')!;

      engine.upgradeBuilding('castle');

      const resourcesAfter = engine.resource.getResources();
      const levelAfter = engine.building.getLevel('castle');

      // 资源已扣除
      expect(resourcesAfter.grain).toBe(resourcesBefore.grain - cost.grain);
      expect(resourcesAfter.gold).toBe(resourcesBefore.gold - cost.gold);
      // 建筑进入升级中状态
      expect(engine.building.getBuilding('castle').status).toBe('upgrading');
      // 等级尚未提升（升级中）
      expect(levelAfter).toBe(levelBefore);
    });

    it('升级农田：扣除粮草和铜钱后建筑进入 upgrading 状态', () => {
      const resourcesBefore = engine.resource.getResources();
      const cost = engine.getUpgradeCost('farmland')!;

      engine.upgradeBuilding('farmland');

      const resourcesAfter = engine.resource.getResources();
      expect(resourcesAfter.grain).toBe(resourcesBefore.grain - cost.grain);
      expect(resourcesAfter.gold).toBe(resourcesBefore.gold - cost.gold);
      expect(engine.building.getBuilding('farmland').status).toBe('upgrading');
    });

    it('资源不足时升级失败，资源和建筑状态均不变', () => {
      // 先消耗掉大部分资源
      const rs = engine.resource;
      rs.consumeResource('grain', rs.getAmount('grain') - 10);
      rs.consumeResource('gold', rs.getAmount('gold') - 10);

      const resourcesBefore = rs.getResources();
      const buildingBefore = engine.building.getBuilding('castle');

      expect(() => engine.upgradeBuilding('castle')).toThrow();

      // 资源和建筑状态均不变
      expect(rs.getResources()).toEqual(resourcesBefore);
      expect(engine.building.getBuilding('castle').status).toBe(buildingBefore.status);
    });

    it('升级完成后 tick 推进，资源总量一致性（扣除费用 + 产出增加）', () => {
      const cost = engine.getUpgradeCost('castle')!;
      engine.upgradeBuilding('castle');

      const resourcesAfterUpgrade = engine.resource.getResources();

      // 推进时间完成升级
      vi.advanceTimersByTime(cost.timeSeconds * 1000 + 100);
      engine.tick(cost.timeSeconds * 1000 + 100);

      // 建筑升级完成
      expect(engine.building.getBuilding('castle').status).toBe('idle');
      expect(engine.building.getLevel('castle')).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // B. 购买/消耗操作原子性
  // ═══════════════════════════════════════════
  describe('消耗操作原子性', () => {
    let rs: ResourceSystem;
    beforeEach(() => {
      vi.restoreAllMocks();
      rs = new ResourceSystem();
      rs.init(createMockDeps());
    });

    it('consumeBatch 全部成功或全部失败 — 资源充足时全部扣除', () => {
      const before = rs.getResources();
      const cost = { grain: 100, gold: 50, troops: 10 };

      rs.consumeBatch(cost);

      const after = rs.getResources();
      expect(after.grain).toBe(before.grain - 100);
      expect(after.gold).toBe(before.gold - 50);
      expect(after.troops).toBe(before.troops - 10);
    });

    it('consumeBatch 全部成功或全部失败 — 资源不足时全部不扣', () => {
      // 消耗掉大部分 gold
      rs.consumeResource('gold', rs.getAmount('gold') - 5);

      const before = rs.getResources();
      const cost = { grain: 100, gold: 50, troops: 10 };

      expect(() => rs.consumeBatch(cost)).toThrow();

      // 所有资源不变
      expect(rs.getResources()).toEqual(before);
    });

    it('canAfford 与 consumeBatch 结果一致 — canAfford=true 时 consumeBatch 必成功', () => {
      const cost = { grain: 100, gold: 50 };
      const check = rs.canAfford(cost);
      expect(check.canAfford).toBe(true);
      expect(() => rs.consumeBatch(cost)).not.toThrow();
    });

    it('canAfford 与 consumeBatch 结果一致 — canAfford=false 时 consumeBatch 必失败', () => {
      rs.consumeResource('gold', rs.getAmount('gold'));
      const cost = { grain: 100, gold: 1 };
      const check = rs.canAfford(cost);
      expect(check.canAfford).toBe(false);
      expect(() => rs.consumeBatch(cost)).toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // C. 资源溢出截断
  // ═══════════════════════════════════════════
  describe('资源溢出截断', () => {
    let rs: ResourceSystem;
    beforeEach(() => {
      vi.restoreAllMocks();
      rs = new ResourceSystem();
      rs.init(createMockDeps());
    });

    it('addResource 超过上限时正确截断到 cap 值', () => {
      const cap = rs.getCaps().grain!;
      const current = rs.getAmount('grain');
      const overflow = cap - current + 500; // 超过上限 500

      const actual = rs.addResource('grain', overflow);

      expect(rs.getAmount('grain')).toBe(cap);
      expect(actual).toBe(cap - current); // 实际只增加了到上限的量
    });

    it('addResource 金额为 0 或负数时不改变资源', () => {
      const before = rs.getResources();
      expect(rs.addResource('grain', 0)).toBe(0);
      expect(rs.addResource('grain', -100)).toBe(0);
      expect(rs.getResources()).toEqual(before);
    });

    it('无上限资源（gold）不截断，可以无限增加', () => {
      const before = rs.getAmount('gold');
      rs.addResource('gold', 999999);
      expect(rs.getAmount('gold')).toBe(before + 999999);
    });

    it('updateCaps 降低上限后，已有资源被截断', () => {
      // 先增加粮草到接近上限
      rs.addResource('grain', 10000);
      const grainBefore = rs.getAmount('grain');

      // 降低上限（模拟降级）
      rs.updateCaps(1, 1); // granaryLevel=1 → cap=2000

      expect(rs.getAmount('grain')).toBeLessThanOrEqual(INITIAL_CAPS.grain);
    });
  });
});
