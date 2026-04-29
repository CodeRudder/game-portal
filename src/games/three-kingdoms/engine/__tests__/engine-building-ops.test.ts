/**
 * engine-building-ops.ts 单元测试
 *
 * 覆盖：
 * - checkBuildingUpgrade: 委托给 BuildingSystem.checkUpgrade
 * - getBuildingUpgradeCost: 返回费用/null
 * - executeBuildingUpgrade: 前置检查、资源消耗、建筑升级、事件发出
 * - cancelBuildingUpgrade: 取消升级、80% 资源返还、事件发出
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  checkBuildingUpgrade,
  getBuildingUpgradeCost,
  executeBuildingUpgrade,
  cancelBuildingUpgrade,
} from '../engine-building-ops';
import type { BuildingOpsContext } from '../engine-building-ops';
import type { ResourceSystem } from '../resource/ResourceSystem';
import type { BuildingSystem } from '../building/BuildingSystem';
import type { EventBus } from '../../../core/events/EventBus';
import type { UpgradeCheckResult, UpgradeCost } from '../building/building.types';

// ── Mock factories ──────────────────────────────────

function createMockContext(overrides?: {
  resources?: Record<string, number>;
  canUpgrade?: boolean;
  cost?: UpgradeCost | null;
  cancelRefund?: UpgradeCost | null;
  costExplicit?: boolean;
}): BuildingOpsContext {
  const resources = overrides?.resources ?? { grain: 1000, gold: 1000, troops: 500 };

  const resource: ResourceSystem = {
    getResources: vi.fn(() => resources),
    consumeBatch: vi.fn(),
    addResource: vi.fn(),
  } as unknown as ResourceSystem;

  const checkResult: UpgradeCheckResult = {
    canUpgrade: overrides?.canUpgrade ?? true,
    reasons: [],
  };

  const defaultCost: UpgradeCost = { grain: 100, gold: 100, troops: 50 };
  const costValue = overrides?.costExplicit
    ? overrides.cost
    : (overrides?.cost ?? defaultCost);

  const building: BuildingSystem = {
    checkUpgrade: vi.fn(() => checkResult),
    getUpgradeCost: vi.fn(() => costValue),
    startUpgrade: vi.fn(),
    cancelUpgrade: vi.fn(() => overrides?.cancelRefund ?? null),
  } as unknown as BuildingSystem;

  const bus: EventBus = {
    emit: vi.fn(),
  } as unknown as EventBus;

  return { resource, building, bus };
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('engine-building-ops', () => {
  // ── checkBuildingUpgrade ───────────────────────────

  describe('checkBuildingUpgrade()', () => {
    it('委托给 building.checkUpgrade 并返回结果', () => {
      const ctx = createMockContext({ canUpgrade: true });
      const result = checkBuildingUpgrade(ctx, 'farmland');
      expect(result.canUpgrade).toBe(true);
      expect(ctx.building.checkUpgrade).toHaveBeenCalledWith('farmland', expect.any(Object));
    });

    it('不可升级时返回原因', () => {
      const ctx = createMockContext({ canUpgrade: false });
      // Override reasons
      (ctx.building.checkUpgrade as ReturnType<typeof vi.fn>).mockReturnValue({
        canUpgrade: false,
        reasons: ['资源不足'],
      });
      const result = checkBuildingUpgrade(ctx, 'farmland');
      expect(result.canUpgrade).toBe(false);
      expect(result.reasons).toContain('资源不足');
    });
  });

  // ── getBuildingUpgradeCost ─────────────────────────

  describe('getBuildingUpgradeCost()', () => {
    it('返回升级费用', () => {
      const cost: UpgradeCost = { grain: 200, gold: 300, troops: 100 };
      const ctx = createMockContext({ cost });
      expect(getBuildingUpgradeCost(ctx, 'barracks')).toEqual(cost);
    });

    it('返回 null 当无费用信息', () => {
      const ctx = createMockContext({ costExplicit: true, cost: null });
      expect(getBuildingUpgradeCost(ctx, 'farmland')).toBeNull();
    });
  });

  // ── executeBuildingUpgrade ─────────────────────────

  describe('executeBuildingUpgrade()', () => {
    it('成功执行升级：消耗资源、启动升级、发出事件', () => {
      const ctx = createMockContext({ canUpgrade: true });

      executeBuildingUpgrade(ctx, 'farmland');

      // 检查资源消耗
      expect(ctx.resource.consumeBatch).toHaveBeenCalledWith({
        grain: 100,
        gold: 100,
        troops: 50,
      });

      // 检查启动升级
      expect(ctx.building.startUpgrade).toHaveBeenCalledWith('farmland', expect.any(Object));

      // 检查事件发出
      expect(ctx.bus.emit).toHaveBeenCalledWith(
        'building:upgrade-start',
        expect.objectContaining({
          type: 'farmland',
          cost: expect.objectContaining({ grain: 100, gold: 100, troops: 50 }),
        }),
      );
      expect(ctx.bus.emit).toHaveBeenCalledWith(
        'resource:changed',
        expect.objectContaining({ resources: expect.any(Object) }),
      );
    });

    it('不可升级时抛出错误', () => {
      const ctx = createMockContext({ canUpgrade: false });
      (ctx.building.checkUpgrade as ReturnType<typeof vi.fn>).mockReturnValue({
        canUpgrade: false,
        reasons: ['资源不足', '等级已满'],
      });

      expect(() => executeBuildingUpgrade(ctx, 'farmland')).toThrow(
        /无法升级.*资源不足.*等级已满/,
      );
    });

    it('费用为 null 时抛出错误', () => {
      const ctx = createMockContext({ canUpgrade: true, costExplicit: true, cost: null });

      expect(() => executeBuildingUpgrade(ctx, 'farmland')).toThrow(
        /无法获取.*升级费用/,
      );
    });
  });

  // ── cancelBuildingUpgrade ──────────────────────────

  describe('cancelBuildingUpgrade()', () => {
    it('成功取消并返还资源', () => {
      const refund: UpgradeCost = { grain: 80, gold: 80, troops: 40 };
      const ctx = createMockContext({ cancelRefund: refund });

      const result = cancelBuildingUpgrade(ctx, 'farmland');

      expect(result).toEqual(refund);
      expect(ctx.resource.addResource).toHaveBeenCalledWith('grain', 80);
      expect(ctx.resource.addResource).toHaveBeenCalledWith('gold', 80);
      expect(ctx.resource.addResource).toHaveBeenCalledWith('troops', 40);
      expect(ctx.bus.emit).toHaveBeenCalledWith(
        'resource:changed',
        expect.objectContaining({ resources: expect.any(Object) }),
      );
    });

    it('返还金额为 0 的资源不调用 addResource', () => {
      const refund: UpgradeCost = { grain: 80, gold: 0, troops: 0 };
      const ctx = createMockContext({ cancelRefund: refund });

      cancelBuildingUpgrade(ctx, 'farmland');

      expect(ctx.resource.addResource).toHaveBeenCalledWith('grain', 80);
      // gold 和 troops 为 0，不应调用 addResource
      expect(ctx.resource.addResource).not.toHaveBeenCalledWith('gold', expect.anything());
      expect(ctx.resource.addResource).not.toHaveBeenCalledWith('troops', expect.anything());
    });

    it('无升级可取消时返回 null', () => {
      const ctx = createMockContext({ cancelRefund: null });

      const result = cancelBuildingUpgrade(ctx, 'farmland');

      expect(result).toBeNull();
      expect(ctx.resource.addResource).not.toHaveBeenCalled();
      expect(ctx.bus.emit).not.toHaveBeenCalled();
    });
  });
});
