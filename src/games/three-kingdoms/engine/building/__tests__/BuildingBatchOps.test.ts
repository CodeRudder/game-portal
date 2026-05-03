/**
 * 建筑批量操作测试
 *
 * 覆盖：批量升级成功、部分失败、全部失败、资源扣减、异常捕获
 */

import { describe, it, expect } from 'vitest';
import { batchUpgrade } from '../BuildingBatchOps';
import type { BatchUpgradeContext, BatchUpgradeResult } from '../BuildingBatchOps';
import type { BuildingType, BuildingState, UpgradeCheckResult, UpgradeCost } from '../../shared/types';
import type { Resources } from '../../shared/types';

// ── 辅助函数 ──

/** 创建默认资源 */
function makeResources(overrides: Partial<Resources> = {}): Resources {
  return {
    grain: 10000,
    gold: 10000,
    troops: 1000,
    mandate: 10,
    techPoint: 50,
    recruitToken: 0,
    skillBook: 0,
    ...overrides,
  };
}

/** 创建建筑状态 */
function makeBuildingState(type: BuildingType, overrides: Partial<BuildingState> = {}): BuildingState {
  return {
    type,
    level: 1,
    status: 'idle',
    upgradeStartTime: null,
    upgradeEndTime: null,
    ...overrides,
  };
}

/** 创建默认升级费用 */
function makeCost(overrides: Partial<UpgradeCost> = {}): UpgradeCost {
  return { grain: 100, gold: 50, troops: 10, timeSeconds: 30, ...overrides };
}

/** 创建成功的检查结果 */
function canUpgradeResult(): UpgradeCheckResult {
  return { canUpgrade: true, reasons: [] };
}

/** 创建失败的检查结果 */
function cannotUpgradeResult(reason: string): UpgradeCheckResult {
  return { canUpgrade: false, reasons: [reason] };
}

/** 创建批量升级上下文 */
function makeContext(overrides: Partial<BatchUpgradeContext> = {}): BatchUpgradeContext {
  return {
    getBuilding: (type: BuildingType) => makeBuildingState(type),
    checkUpgrade: () => canUpgradeResult(),
    startUpgrade: () => makeCost(),
    ...overrides,
  };
}

// ── 测试 ──

describe('BuildingBatchOps — batchUpgrade', () => {
  describe('正常路径', () => {
    it('单个建筑升级成功', () => {
      const resources = makeResources();
      const ctx = makeContext();

      const result = batchUpgrade(['castle'], resources, ctx);

      expect(result.succeeded).toHaveLength(1);
      expect(result.succeeded[0].type).toBe('castle');
      expect(result.failed).toHaveLength(0);
    });

    it('多个建筑按顺序升级成功', () => {
      const resources = makeResources();
      const ctx = makeContext();

      const result = batchUpgrade(['castle', 'farmland', 'market'], resources, ctx);

      expect(result.succeeded).toHaveLength(3);
      expect(result.succeeded.map((s) => s.type)).toEqual(['castle', 'farmland', 'market']);
      expect(result.failed).toHaveLength(0);
    });

    it('累计计算总费用', () => {
      const resources = makeResources();
      const ctx = makeContext({
        startUpgrade: (type: BuildingType) => {
          const costs: Record<string, UpgradeCost> = {
            castle: makeCost({ grain: 200, gold: 100, troops: 20, timeSeconds: 60 }),
            farmland: makeCost({ grain: 150, gold: 50, troops: 10, timeSeconds: 30 }),
          };
          return costs[type] ?? makeCost();
        },
      });

      const result = batchUpgrade(['castle', 'farmland'], resources, ctx);

      expect(result.totalCost.grain).toBe(350);
      expect(result.totalCost.gold).toBe(150);
      expect(result.totalCost.troops).toBe(30);
      expect(result.totalCost.timeSeconds).toBe(90);
    });

    it('每个成功项记录升级费用', () => {
      const expectedCost = makeCost({ grain: 500, gold: 200 });
      const ctx = makeContext({
        startUpgrade: () => expectedCost,
      });

      const result = batchUpgrade(['castle'], makeResources(), ctx);

      expect(result.succeeded[0].cost).toEqual(expectedCost);
    });
  });

  describe('资源扣减', () => {
    it('后续建筑使用扣减后的资源进行检查', () => {
      let checkCalls: Array<{ type: BuildingType; resources: Resources }> = [];

      const ctx = makeContext({
        checkUpgrade: (type: BuildingType, resources?: Resources) => {
          checkCalls.push({ type, resources: resources! });
          return canUpgradeResult();
        },
        startUpgrade: () => makeCost({ grain: 3000, gold: 2000 }),
      });

      const resources = makeResources({ grain: 5000, gold: 5000 });
      batchUpgrade(['castle', 'farmland'], resources, ctx);

      // 第一次调用时资源为初始值
      expect(checkCalls[0].resources.grain).toBe(5000);
      // 第二次调用时粮草应已扣减
      expect(checkCalls[1].resources.grain).toBe(2000);
    });

    it('资源耗尽后后续建筑检查失败', () => {
      const ctx = makeContext({
        checkUpgrade: (_type: BuildingType, resources?: Resources) => {
          if (resources && resources.grain < 100) {
            return cannotUpgradeResult('粮草不足');
          }
          return canUpgradeResult();
        },
        startUpgrade: () => makeCost({ grain: 8000, gold: 0, troops: 0 }),
      });

      const resources = makeResources({ grain: 8000, gold: 10000 });
      const result = batchUpgrade(['castle', 'farmland'], resources, ctx);

      expect(result.succeeded).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('粮草不足');
    });
  });

  describe('部分失败', () => {
    it('不可升级的建筑跳过并记录失败原因', () => {
      const ctx = makeContext({
        checkUpgrade: (type: BuildingType) => {
          if (type === 'farmland') {
            return cannotUpgradeResult('等级不足');
          }
          return canUpgradeResult();
        },
      });

      const result = batchUpgrade(['castle', 'farmland', 'market'], makeResources(), ctx);

      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].type).toBe('farmland');
      expect(result.failed[0].reason).toBe('等级不足');
    });

    it('多个检查失败都记录', () => {
      const ctx = makeContext({
        checkUpgrade: () => cannotUpgradeResult('条件不满足'),
      });

      const result = batchUpgrade(['castle', 'farmland'], makeResources(), ctx);

      expect(result.succeeded).toHaveLength(0);
      expect(result.failed).toHaveLength(2);
    });
  });

  describe('异常路径', () => {
    it('startUpgrade 抛出异常时记录为失败', () => {
      const ctx = makeContext({
        startUpgrade: () => {
          throw new Error('升级队列已满');
        },
      });

      const result = batchUpgrade(['castle'], makeResources(), ctx);

      expect(result.succeeded).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('升级队列已满');
    });

    it('startUpgrade 抛出非 Error 对象时记录未知错误', () => {
      const ctx = makeContext({
        startUpgrade: () => {
          throw 'string error';
        },
      });

      const result = batchUpgrade(['castle'], makeResources(), ctx);

      expect(result.failed[0].reason).toBe('未知错误');
    });

    it('异常后继续处理后续建筑', () => {
      let callCount = 0;
      const ctx = makeContext({
        startUpgrade: () => {
          callCount++;
          if (callCount === 1) throw new Error('第一次失败');
          return makeCost();
        },
      });

      const result = batchUpgrade(['castle', 'farmland'], makeResources(), ctx);

      expect(result.failed).toHaveLength(1);
      expect(result.succeeded).toHaveLength(1);
      expect(result.succeeded[0].type).toBe('farmland');
    });

    it('异常的建筑不计入总费用', () => {
      const ctx = makeContext({
        startUpgrade: (type: BuildingType) => {
          if (type === 'castle') throw new Error('失败');
          return makeCost({ grain: 100 });
        },
      });

      const result = batchUpgrade(['castle', 'farmland'], makeResources(), ctx);

      expect(result.totalCost.grain).toBe(100);
    });
  });

  describe('边界条件', () => {
    it('空列表返回空结果', () => {
      const result = batchUpgrade([], makeResources(), makeContext());

      expect(result.succeeded).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.totalCost).toEqual({ grain: 0, gold: 0, ore: 0, wood: 0, troops: 0, timeSeconds: 0 });
    });

    it('多个失败原因合并显示', () => {
      const ctx = makeContext({
        checkUpgrade: () => ({
          canUpgrade: false,
          reasons: ['条件A不满足', '条件B不满足'],
        }),
      });

      const result = batchUpgrade(['castle'], makeResources(), ctx);

      expect(result.failed[0].reason).toBe('条件A不满足；条件B不满足');
    });
  });
});
