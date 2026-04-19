/**
 * BatchOperationHandler — 放置游戏批量操作处理器
 *
 * 批量执行操作（如批量购买 10 个建筑升级、批量合成），
 * 支持最大批量数限制、资源不足时自动停止、条件中断等。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 无状态工具类（不需要 loadState/saveState）
 * - 每次批量操作返回详细的执行结果
 * - 支持累计执行次数统计
 *
 * @module engines/idle/modules/BatchOperationHandler
 */

// ============================================================
// 类型定义
// ============================================================

/** 批量操作结果 */
export interface BatchResult {
  /** 尝试总数 */
  totalAttempted: number;
  /** 成功数 */
  succeeded: number;
  /** 失败数 */
  failed: number;
  /** 总消耗资源 */
  totalCost: Record<string, number>;
  /** 总获得资源 */
  totalGain: Record<string, number>;
  /** 停止原因（未停止时为 undefined） */
  stoppedReason?: 'resource_exhausted' | 'limit_reached' | 'condition_failed';
}

/** 单次批量操作回调 */
export type BatchAction = () => {
  /** 本次操作是否成功 */
  success: boolean;
  /** 本次操作消耗的资源 */
  cost: Record<string, number>;
  /** 本次操作获得的资源 */
  gain: Record<string, number>;
};

// ============================================================
// 辅助函数
// ============================================================

/**
 * 将资源增量合并到目标映射中
 *
 * @param target - 目标资源映射
 * @param delta - 增量资源映射
 */
function mergeResources(target: Record<string, number>, delta: Record<string, number>): void {
  for (const [key, value] of Object.entries(delta)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

/**
 * 创建空的批量操作结果
 *
 * @returns 空结果
 */
function emptyResult(): BatchResult {
  return {
    totalAttempted: 0,
    succeeded: 0,
    failed: 0,
    totalCost: {},
    totalGain: {},
  };
}

// ============================================================
// BatchOperationHandler 实现
// ============================================================

/**
 * 批量操作处理器 — 批量执行操作并汇总结果
 *
 * @example
 * ```typescript
 * const handler = new BatchOperationHandler();
 * const result = handler.executeBatch(
 *   () => {
 *     if (gold < 10) return { success: false, cost: {}, gain: {} };
 *     gold -= 10;
 *     return { success: true, cost: { gold: 10 }, gain: { xp: 5 } };
 *   },
 *   10,
 * );
 * console.log(result.succeeded); // 成功次数
 * ```
 */
export class BatchOperationHandler {
  /** 累计执行次数 */
  private totalExecuted: number = 0;

  // ============================================================
  // 初始化
  // ============================================================

  constructor() {
    // 初始化 — 无状态工具类
  }

  // ============================================================
  // 批量执行
  // ============================================================

  /**
   * 批量执行操作
   *
   * 重复调用 action 直到达到 maxCount 次或 action 返回失败。
   * 当 action 返回 success: false 时，自动以 'resource_exhausted' 停止。
   *
   * @param action - 单次操作回调
   * @param maxCount - 最大执行次数
   * @returns 批量执行结果
   */
  executeBatch(action: BatchAction, maxCount: number): BatchResult {
    const result = emptyResult();
    for (let i = 0; i < maxCount; i++) {
      result.totalAttempted++;
      const step = action();
      if (step.success) {
        result.succeeded++;
        mergeResources(result.totalCost, step.cost);
        mergeResources(result.totalGain, step.gain);
      } else {
        result.failed++;
        // 失败时仍然记录消耗和获得
        mergeResources(result.totalCost, step.cost);
        mergeResources(result.totalGain, step.gain);
        result.stoppedReason = 'resource_exhausted';
        break;
      }
    }
    if (maxCount > 0 && result.totalAttempted === maxCount && !result.stoppedReason) {
      result.stoppedReason = 'limit_reached';
    }
    this.totalExecuted += result.totalAttempted;
    return result;
  }

  /**
   * 条件批量执行
   *
   * 每次执行前额外检查 condition，不满足时以 'condition_failed' 停止。
   *
   * @param action - 单次操作回调
   * @param condition - 继续执行的条件（返回 false 时停止）
   * @param maxCount - 最大执行次数
   * @returns 批量执行结果
   */
  executeBatchWhile(action: BatchAction, condition: () => boolean, maxCount: number): BatchResult {
    const result = emptyResult();
    for (let i = 0; i < maxCount; i++) {
      // 先检查外部条件
      if (!condition()) {
        result.stoppedReason = 'condition_failed';
        break;
      }
      result.totalAttempted++;
      const step = action();
      if (step.success) {
        result.succeeded++;
        mergeResources(result.totalCost, step.cost);
        mergeResources(result.totalGain, step.gain);
      } else {
        result.failed++;
        mergeResources(result.totalCost, step.cost);
        mergeResources(result.totalGain, step.gain);
        result.stoppedReason = 'resource_exhausted';
        break;
      }
    }
    if (maxCount > 0 && result.totalAttempted === maxCount && !result.stoppedReason) {
      result.stoppedReason = 'limit_reached';
    }
    this.totalExecuted += result.totalAttempted;
    return result;
  }

  // ============================================================
  // 统计
  // ============================================================

  /**
   * 重置累计执行次数
   */
  reset(): void {
    this.totalExecuted = 0;
  }

  /**
   * 获取累计执行次数
   *
   * @returns 累计执行次数
   */
  getTotalExecuted(): number {
    return this.totalExecuted;
  }
}
