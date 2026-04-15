/**
 * BatchOperationHandler 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BatchOperationHandler,
  type BatchResult,
  type BatchAction,
} from '../modules/BatchOperationHandler';

describe('BatchOperationHandler', () => {
  let handler: BatchOperationHandler;

  beforeEach(() => {
    handler = new BatchOperationHandler();
  });

  // ============================================================
  // executeBatch — 基本功能
  // ============================================================

  describe('executeBatch — 基本功能', () => {
    it('应成功执行全部操作', () => {
      const result = handler.executeBatch(
        () => ({ success: true, cost: { gold: 10 }, gain: { xp: 5 } }),
        5,
      );
      expect(result.succeeded).toBe(5);
      expect(result.failed).toBe(0);
      expect(result.totalAttempted).toBe(5);
      expect(result.stoppedReason).toBe('limit_reached');
    });

    it('应在操作失败时停止', () => {
      let count = 0;
      const result = handler.executeBatch(
        () => {
          count++;
          if (count > 3) return { success: false, cost: {}, gain: {} };
          return { success: true, cost: { gold: 10 }, gain: { xp: 5 } };
        },
        10,
      );
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(1);
      expect(result.totalAttempted).toBe(4);
      expect(result.stoppedReason).toBe('resource_exhausted');
    });

    it('首次操作就失败应返回 failed=1', () => {
      const result = handler.executeBatch(
        () => ({ success: false, cost: {}, gain: {} }),
        10,
      );
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.totalAttempted).toBe(1);
      expect(result.stoppedReason).toBe('resource_exhausted');
    });

    it('maxCount 为 1 时应执行一次', () => {
      const result = handler.executeBatch(
        () => ({ success: true, cost: { gold: 5 }, gain: { xp: 1 } }),
        1,
      );
      expect(result.succeeded).toBe(1);
      expect(result.stoppedReason).toBe('limit_reached');
    });

    it('maxCount 为 0 时应返回空结果', () => {
      const result = handler.executeBatch(
        () => ({ success: true, cost: {}, gain: {} }),
        0,
      );
      expect(result.totalAttempted).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.stoppedReason).toBeUndefined();
    });
  });

  // ============================================================
  // executeBatch — 资源累计
  // ============================================================

  describe('executeBatch — 资源累计', () => {
    it('应正确累计消耗和获得', () => {
      const result = handler.executeBatch(
        () => ({ success: true, cost: { gold: 10, gem: 1 }, gain: { xp: 5, item: 1 } }),
        3,
      );
      expect(result.totalCost).toEqual({ gold: 30, gem: 3 });
      expect(result.totalGain).toEqual({ xp: 15, item: 3 });
    });

    it('失败操作也应记录消耗和获得', () => {
      const result = handler.executeBatch(
        () => ({ success: false, cost: { gold: 5 }, gain: { shard: 1 } }),
        10,
      );
      expect(result.totalCost).toEqual({ gold: 5 });
      expect(result.totalGain).toEqual({ shard: 1 });
    });

    it('空消耗和获得应正确处理', () => {
      const result = handler.executeBatch(
        () => ({ success: true, cost: {}, gain: {} }),
        1,
      );
      expect(result.totalCost).toEqual({});
      expect(result.totalGain).toEqual({});
    });

    it('多种不同资源类型应正确合并', () => {
      let i = 0;
      const result = handler.executeBatch(
        () => {
          i++;
          return {
            success: true,
            cost: { [`res${i}`]: i },
            gain: { [`item${i}`]: i },
          };
        },
        3,
      );
      expect(result.totalCost).toEqual({ res1: 1, res2: 2, res3: 3 });
      expect(result.totalGain).toEqual({ item1: 1, item2: 2, item3: 3 });
    });
  });

  // ============================================================
  // executeBatch — 累计计数
  // ============================================================

  describe('executeBatch — 累计计数', () => {
    it('应累计执行次数', () => {
      handler.executeBatch(() => ({ success: true, cost: {}, gain: {} }), 5);
      handler.executeBatch(() => ({ success: true, cost: {}, gain: {} }), 3);
      expect(handler.getTotalExecuted()).toBe(8);
    });

    it('失败操作也应计入累计次数', () => {
      handler.executeBatch(() => ({ success: false, cost: {}, gain: {} }), 10);
      expect(handler.getTotalExecuted()).toBe(1);
    });

    it('maxCount=0 不应增加累计次数', () => {
      handler.executeBatch(() => ({ success: true, cost: {}, gain: {} }), 0);
      expect(handler.getTotalExecuted()).toBe(0);
    });
  });

  // ============================================================
  // executeBatchWhile — 基本功能
  // ============================================================

  describe('executeBatchWhile — 基本功能', () => {
    it('应在条件满足时执行', () => {
      const result = handler.executeBatchWhile(
        () => ({ success: true, cost: {}, gain: {} }),
        () => true,
        5,
      );
      expect(result.succeeded).toBe(5);
      expect(result.stoppedReason).toBe('limit_reached');
    });

    it('应在条件不满足时停止', () => {
      let count = 0;
      const result = handler.executeBatchWhile(
        () => ({ success: true, cost: {}, gain: {} }),
        () => { count++; return count <= 3; },
        10,
      );
      expect(result.succeeded).toBe(3);
      expect(result.totalAttempted).toBe(3);
      expect(result.stoppedReason).toBe('condition_failed');
    });

    it('首次条件不满足应返回空结果', () => {
      const result = handler.executeBatchWhile(
        () => ({ success: true, cost: {}, gain: {} }),
        () => false,
        10,
      );
      expect(result.totalAttempted).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.stoppedReason).toBe('condition_failed');
    });

    it('操作失败应优先于条件检查停止', () => {
      let callCount = 0;
      const result = handler.executeBatchWhile(
        () => {
          callCount++;
          if (callCount > 2) return { success: false, cost: {}, gain: {} };
          return { success: true, cost: {}, gain: {} };
        },
        () => true,
        10,
      );
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.stoppedReason).toBe('resource_exhausted');
    });

    it('maxCount 为 0 时应返回空结果', () => {
      const result = handler.executeBatchWhile(
        () => ({ success: true, cost: {}, gain: {} }),
        () => true,
        0,
      );
      expect(result.totalAttempted).toBe(0);
      expect(result.stoppedReason).toBeUndefined();
    });

    it('maxCount 为 1 时应执行一次', () => {
      const result = handler.executeBatchWhile(
        () => ({ success: true, cost: { gold: 5 }, gain: { xp: 1 } }),
        () => true,
        1,
      );
      expect(result.succeeded).toBe(1);
      expect(result.stoppedReason).toBe('limit_reached');
    });
  });

  // ============================================================
  // executeBatchWhile — 资源与计数
  // ============================================================

  describe('executeBatchWhile — 资源与计数', () => {
    it('应正确累计消耗和获得', () => {
      const result = handler.executeBatchWhile(
        () => ({ success: true, cost: { gold: 10 }, gain: { xp: 5 } }),
        () => true,
        3,
      );
      expect(result.totalCost).toEqual({ gold: 30 });
      expect(result.totalGain).toEqual({ xp: 15 });
    });

    it('应累计执行次数', () => {
      handler.executeBatchWhile(
        () => ({ success: true, cost: {}, gain: {} }),
        () => true,
        4,
      );
      expect(handler.getTotalExecuted()).toBe(4);
    });

    it('与 executeBatch 共享累计计数', () => {
      handler.executeBatch(() => ({ success: true, cost: {}, gain: {} }), 2);
      handler.executeBatchWhile(
        () => ({ success: true, cost: {}, gain: {} }),
        () => true,
        3,
      );
      expect(handler.getTotalExecuted()).toBe(5);
    });
  });

  // ============================================================
  // reset / getTotalExecuted
  // ============================================================

  describe('reset / getTotalExecuted', () => {
    it('初始累计次数应为 0', () => {
      expect(handler.getTotalExecuted()).toBe(0);
    });

    it('reset 应清零累计次数', () => {
      handler.executeBatch(() => ({ success: true, cost: {}, gain: {} }), 10);
      handler.reset();
      expect(handler.getTotalExecuted()).toBe(0);
    });

    it('reset 后应可继续累计', () => {
      handler.executeBatch(() => ({ success: true, cost: {}, gain: {} }), 5);
      handler.reset();
      handler.executeBatch(() => ({ success: true, cost: {}, gain: {} }), 3);
      expect(handler.getTotalExecuted()).toBe(3);
    });
  });

  // ============================================================
  // 边界与综合
  // ============================================================

  describe('边界与综合', () => {
    it('大量批量操作应正确累计', () => {
      const result = handler.executeBatch(
        () => ({ success: true, cost: { gold: 1 }, gain: { xp: 1 } }),
        1000,
      );
      expect(result.succeeded).toBe(1000);
      expect(result.totalCost).toEqual({ gold: 1000 });
      expect(result.totalGain).toEqual({ xp: 1000 });
    });

    it('condition 检查次数应等于 totalAttempted + 1（最后一次失败）', () => {
      let condCount = 0;
      handler.executeBatchWhile(
        () => ({ success: true, cost: {}, gain: {} }),
        () => { condCount++; return condCount <= 2; },
        10,
      );
      // condCount: 1 (true, exec), 2 (true, exec), 3 (false, stop)
      expect(condCount).toBe(3);
    });

    it('BatchAction 使用 vi.fn 应正确追踪调用次数', () => {
      const action = vi.fn(() => ({ success: true, cost: {}, gain: {} }));
      handler.executeBatch(action, 5);
      expect(action).toHaveBeenCalledTimes(5);
    });

    it('executeBatchWhile 中 condition 使用 vi.fn 应正确追踪', () => {
      const condition = vi.fn(() => true);
      handler.executeBatchWhile(
        () => ({ success: true, cost: {}, gain: {} }),
        condition,
        3,
      );
      // condition 被调用 3 次（每次迭代前检查一次）
      expect(condition).toHaveBeenCalledTimes(3);
    });

    it('executeBatch 返回的 BatchResult 应为独立副本', () => {
      const result = handler.executeBatch(
        () => ({ success: true, cost: { gold: 10 }, gain: { xp: 5 } }),
        2,
      );
      result.totalCost['gold'] = 999;
      const result2 = handler.executeBatch(
        () => ({ success: true, cost: { gold: 10 }, gain: { xp: 5 } }),
        2,
      );
      expect(result2.totalCost['gold']).toBe(20);
    });

    it('executeBatchWhile 条件在第 N 次失败时 succeeded 应为 N-1', () => {
      let callCount = 0;
      const result = handler.executeBatchWhile(
        () => ({ success: true, cost: {}, gain: {} }),
        () => { callCount++; return callCount < 5; },
        10,
      );
      expect(result.succeeded).toBe(4);
      expect(result.totalAttempted).toBe(4);
      expect(result.stoppedReason).toBe('condition_failed');
    });

    it('新建 handler 应无累计执行次数', () => {
      const newHandler = new BatchOperationHandler();
      expect(newHandler.getTotalExecuted()).toBe(0);
    });
  });
});
