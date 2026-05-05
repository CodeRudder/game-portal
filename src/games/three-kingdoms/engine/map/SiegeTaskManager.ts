/**
 * 攻占任务管理器
 *
 * 管理异步攻城任务的生命周期：
 * preparing → marching → sieging → settling → returning → completed
 *
 * 与 MarchingSystem 协作：
 * - 创建任务时同步创建行军单位
 * - UI层(WorldMapTab)负责监听 march:arrived 事件并调用 advanceStatus 推进状态
 * - 攻城完成后创建回城行军
 *
 * @module engine/map/SiegeTaskManager
 * @see flows.md MAP-F06-P5~P10
 */

import type {
  SiegeTask,
  SiegeTaskStatus,
  SiegeTaskExpedition,
  SiegeTaskResult,
  SiegeTaskStatusChangedEvent,
  SiegeTaskSaveData,
  SiegeTaskSummary,
  SiegePauseSnapshot,
} from '../../core/map/siege-task.types';
import { isTerminalStatus, SIEGE_TASK_SAVE_VERSION } from '../../core/map/siege-task.types';
import type { SiegeStrategyType } from '../../core/map/siege-enhancer.types';
import type { SiegeCost } from './SiegeSystem';

// ─────────────────────────────────────────────
// 依赖接口
// ─────────────────────────────────────────────

export interface SiegeTaskManagerDeps {
  /** 事件总线 */
  eventBus: {
    emit(event: string, data: unknown): void;
    on(event: string, handler: (data: unknown) => void): void;
    off(event: string, handler: (data: unknown) => void): void;
  };
}

// ─────────────────────────────────────────────
// 事件名
// ─────────────────────────────────────────────

export const SIEGE_TASK_EVENTS = {
  STATUS_CHANGED: 'siegeTask:statusChanged',
  CREATED: 'siegeTask:created',
  COMPLETED: 'siegeTask:completed',
  PAUSED: 'siegeTask:paused',
  RESUMED: 'siegeTask:resumed',
  CANCELLED: 'siegeTask:cancelled',
} as const;

// ─────────────────────────────────────────────
// SiegeTaskManager
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 攻占锁常量
// ─────────────────────────────────────────────

/** Siege lock timeout (ms) - auto-release after 5 minutes */
const SIEGE_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

let nextTaskId = 1;

export class SiegeTaskManager {
  private tasks: Map<string, SiegeTask> = new Map();
  private deps: SiegeTaskManagerDeps | null = null;

  /** Active siege locks: targetId → { taskId, lockedAt } */
  private siegeLocks: Map<string, { taskId: string; lockedAt: number }> = new Map();

  /** Set of task IDs whose rewards have been claimed */
  private claimedRewards: Set<string> = new Set();

  /** 设置依赖 */
  setDependencies(deps: SiegeTaskManagerDeps): void {
    this.deps = deps;
  }

  // ── 任务创建 ─────────────────────────────────

  /**
   * 创建攻占任务
   * 同一目标同一时刻只允许一个攻占任务（siege lock）
   * @returns 新创建的 SiegeTask，若目标已被锁定则返回 null
   */
  createTask(params: {
    targetId: string;
    targetName: string;
    sourceId: string;
    sourceName: string;
    strategy: SiegeStrategyType | null;
    expedition: SiegeTaskExpedition;
    cost: SiegeCost;
    marchPath: Array<{ x: number; y: number }>;
    faction: 'wei' | 'shu' | 'wu' | 'neutral';
  }): SiegeTask | null {
    // 先尝试获取锁
    const taskId = `siege-task-${nextTaskId}`;
    if (!this.acquireSiegeLock(params.targetId, taskId)) {
      return null;
    }

    nextTaskId++;

    const task: SiegeTask = {
      id: taskId,
      status: 'preparing',
      targetId: params.targetId,
      targetName: params.targetName,
      sourceId: params.sourceId,
      sourceName: params.sourceName,
      strategy: params.strategy,
      expedition: params.expedition,
      cost: params.cost,
      createdAt: Date.now(),
      marchStartedAt: null,
      estimatedArrival: null,
      arrivedAt: null,
      siegeCompletedAt: null,
      returnCompletedAt: null,
      marchPath: params.marchPath,
      result: null,
      pausedAt: null,
      pauseSnapshot: null,
      faction: params.faction,
    };

    this.tasks.set(task.id, task);
    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.CREATED, { task });
    return task;
  }

  // ── 状态转换 ─────────────────────────────────

  /**
   * 推进任务状态
   * 只允许合法的状态转换
   */
  advanceStatus(taskId: string, newStatus: SiegeTaskStatus): SiegeTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    if (!this.isValidTransition(task.status, newStatus)) {
      return null;
    }

    const oldStatus = task.status;
    task.status = newStatus;

    // 更新时间戳
    if (newStatus === 'marching' && !task.marchStartedAt) {
      task.marchStartedAt = Date.now();
    } else if (newStatus === 'sieging' && !task.arrivedAt) {
      task.arrivedAt = Date.now();
    } else if (newStatus === 'returning' && !task.siegeCompletedAt) {
      task.siegeCompletedAt = Date.now();
    } else if (newStatus === 'completed') {
      task.returnCompletedAt = Date.now();
    }

    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.STATUS_CHANGED, {
      taskId,
      from: oldStatus,
      to: newStatus,
      task,
    } satisfies SiegeTaskStatusChangedEvent);

    if (newStatus === 'completed') {
      this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.COMPLETED, { task });
      // Release siege lock on completion
      this.releaseSiegeLock(task.targetId);
    }

    return task;
  }

  /**
   * 设置行军预估到达时间
   */
  setEstimatedArrival(taskId: string, eta: number): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.estimatedArrival = eta;
    }
  }

  /**
   * 设置攻城结果
   */
  setResult(taskId: string, result: SiegeTaskResult): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.result = result;
    }
  }

  // ── 查询 ─────────────────────────────────────

  /** 获取任务 */
  getTask(taskId: string): SiegeTask | null {
    return this.tasks.get(taskId) ?? null;
  }

  /** 获取所有活跃任务（非终态） */
  getActiveTasks(): SiegeTask[] {
    return Array.from(this.tasks.values()).filter((t) => !isTerminalStatus(t.status));
  }

  /** 获取所有任务 */
  getAllTasks(): SiegeTask[] {
    return Array.from(this.tasks.values());
  }

  /** 按状态获取任务 */
  getTasksByStatus(status: SiegeTaskStatus): SiegeTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === status);
  }

  /** 按目标获取任务 */
  getTaskByTarget(targetId: string): SiegeTask | null {
    for (const task of this.tasks.values()) {
      if (task.targetId === targetId && !isTerminalStatus(task.status)) {
        return task;
      }
    }
    return null;
  }

  /** 检查目标是否正在被攻占 */
  isTargetUnderSiege(targetId: string): boolean {
    return this.getTaskByTarget(targetId) !== null;
  }

  /** 活跃任务数量 */
  get activeCount(): number {
    return this.getActiveTasks().length;
  }

  // ── 异常终止（escape hatch）─────────────────────

  /**
   * 强制取消攻占任务（异常终止逃生舱）
   *
   * 绕过正常状态转换表，将处于任何活跃状态（marching/sieging/settling/returning/paused）
   * 的任务强制设为 completed，并释放攻占锁。
   *
   * 用于外部异常场景（如行军被取消时任务卡在 marching），正常流程仍应使用
   * advanceStatus 按状态表推进。
   *
   * @param taskId - 任务ID
   * @returns true 表示成功取消并释放锁，false 表示任务不存在或已是终态
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || isTerminalStatus(task.status)) return false;

    const oldStatus = task.status;
    task.status = 'completed';
    task.returnCompletedAt = Date.now();

    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.STATUS_CHANGED, {
      taskId,
      from: oldStatus,
      to: 'completed',
      task,
    } satisfies SiegeTaskStatusChangedEvent);

    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.COMPLETED, { task });
    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.CANCELLED, {
      taskId,
      targetId: task.targetId,
    });

    this.releaseSiegeLock(task.targetId);

    return true;
  }

  // ── 攻城中断处理 ─────────────────────────────────

  /**
   * 暂停攻城任务
   *
   * 仅允许从 'sieging' 状态暂停。保存当前攻城进度快照
   * (defenseRatio, elapsedBattleTime) 用于后续恢复。
   *
   * @param taskId - 任务ID
   * @param snapshot - 暂停时的进度快照（可选，默认 defenseRatio=1, elapsedBattleTime=0）
   * @returns true 表示暂停成功，false 表示任务不存在或状态不允许
   */
  pauseSiege(taskId: string, snapshot?: Partial<SiegePauseSnapshot>): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'sieging') return false;

    if (!this.isValidTransition(task.status, 'paused')) return false;

    const now = Date.now();

    // Save pause snapshot
    const pauseSnapshot: SiegePauseSnapshot = {
      defenseRatio: snapshot?.defenseRatio ?? 1,
      elapsedBattleTime: snapshot?.elapsedBattleTime ?? 0,
    };

    const oldStatus = task.status;
    task.status = 'paused';
    task.pausedAt = now;
    task.pauseSnapshot = pauseSnapshot;

    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.STATUS_CHANGED, {
      taskId,
      from: oldStatus,
      to: 'paused',
      task,
    } satisfies SiegeTaskStatusChangedEvent);

    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.PAUSED, {
      taskId,
      pauseSnapshot,
    });

    return true;
  }

  /**
   * 恢复暂停的攻城任务
   *
   * 将任务从 'paused' 恢复到 'sieging' 状态。
   * 调用方可通过 task.pauseSnapshot 获取保存的进度数据。
   *
   * @param taskId - 任务ID
   * @returns true 表示恢复成功，false 表示任务不存在或状态不允许
   */
  resumeSiege(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return false;

    if (!this.isValidTransition(task.status, 'sieging')) return false;

    const oldStatus = task.status;
    task.status = 'sieging';

    // Clear pause metadata
    const savedSnapshot = task.pauseSnapshot;
    task.pausedAt = null;
    task.pauseSnapshot = null;

    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.STATUS_CHANGED, {
      taskId,
      from: oldStatus,
      to: 'sieging',
      task,
    } satisfies SiegeTaskStatusChangedEvent);

    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.RESUMED, {
      taskId,
      savedSnapshot,
    });

    return true;
  }

  /**
   * 取消攻城任务（从暂停状态）
   *
   * 将任务从 'paused' 转为 'returning'，同时通知外部系统
   * 创建回城行军。释放攻占锁。
   *
   * @param taskId - 任务ID
   * @param marchingSystem - 行军系统引用，用于创建回城行军
   * @returns true 表示取消成功，false 表示任务不存在或状态不允许
   */
  cancelSiege(taskId: string, marchingSystem: {
    createReturnMarch(params: {
      fromCityId: string;
      toCityId: string;
      troops: number;
      general: string;
      faction: string;
      siegeTaskId?: string;
    }): unknown | null;
  } | null): boolean {
    const task = this.tasks.get(taskId);
    if (!task || (task.status !== 'paused' && task.status !== 'sieging' && task.status !== 'settling')) return false;

    // 自动暂停活跃攻城以允许撤退
    if (task.status === 'sieging') {
      task.status = 'paused';
      task.pausedAt = Date.now();
      task.pauseSnapshot = { defenseRatio: 1, elapsedBattleTime: 0 };
      this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.STATUS_CHANGED, {
        taskId,
        from: 'sieging',
        to: 'paused',
        task,
      } satisfies SiegeTaskStatusChangedEvent);
    }

    if (!this.isValidTransition(task.status, 'returning')) return false;

    const oldStatus = task.status;
    task.status = 'returning';
    task.siegeCompletedAt = Date.now();

    // Clear pause metadata
    task.pausedAt = null;
    task.pauseSnapshot = null;

    // Create return march via MarchingSystem if provided
    if (marchingSystem) {
      // R29修复：考虑已计算的伤亡，扣除损失的兵力
      const troopsLost = task.result?.casualties?.troopsLost ?? 0;
      const returnTroops = Math.max(0, task.expedition.troops - troopsLost);
      const returnMarch = marchingSystem.createReturnMarch({
        fromCityId: task.targetId,
        toCityId: task.sourceId,
        troops: returnTroops,
        general: task.expedition.heroName,
        faction: task.faction,
        siegeTaskId: task.id,
      });
      if (returnMarch) {
        // Return march created — external system will advance to 'completed' via advanceStatus
      } else {
        // 回城不可达时直接完成任务
        task.status = 'completed';
        task.returnCompletedAt = Date.now();
        this.releaseSiegeLock(task.targetId);
        this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.COMPLETED, { task });
        this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.CANCELLED, { taskId, targetId: task.targetId });
        return true;
      }
    }

    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.STATUS_CHANGED, {
      taskId,
      from: oldStatus,
      to: 'returning',
      task,
    } satisfies SiegeTaskStatusChangedEvent);

    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.CANCELLED, {
      taskId,
      targetId: task.targetId,
    });

    // #4 修复: cancelSiege时立即释放攻占锁，允许其他任务锁定该目标
    this.releaseSiegeLock(task.targetId);

    return true;
  }

  // ── 攻占锁管理 ─────────────────────────────────

  /**
   * 尝试获取攻占锁
   * @returns true 表示成功获取锁，false 表示目标已被锁定
   */
  acquireSiegeLock(targetId: string, taskId: string): boolean {
    // Inline timeout check: release expired locks on this target before acquiring
    const existingLock = this.siegeLocks.get(targetId);
    if (existingLock && Date.now() - existingLock.lockedAt >= SIEGE_LOCK_TIMEOUT_MS) {
      this.siegeLocks.delete(targetId);
    }

    if (this.siegeLocks.has(targetId)) {
      return false; // Still locked (not expired)
    }
    this.siegeLocks.set(targetId, { taskId, lockedAt: Date.now() });
    return true;
  }

  /**
   * 释放攻占锁
   */
  releaseSiegeLock(targetId: string): void {
    this.siegeLocks.delete(targetId);
  }

  /**
   * 检查目标是否被锁定
   */
  isSiegeLocked(targetId: string): boolean {
    return this.siegeLocks.has(targetId);
  }

  /**
   * 检查并释放超时锁（应在 update 循环中调用）
   */
  checkLockTimeout(): void {
    const now = Date.now();
    for (const [targetId, lock] of this.siegeLocks) {
      if (now - lock.lockedAt >= SIEGE_LOCK_TIMEOUT_MS) {
        this.siegeLocks.delete(targetId);
      }
    }
  }

  // ── 任务摘要与奖励 ─────────────────────────────

  /**
   * 获取任务摘要（UI面板展示用）
   *
   * 包含进度百分比、结果、奖励信息等派生数据
   */
  getTaskSummary(taskId: string): SiegeTaskSummary | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    let marchProgress: number | null = null;
    let siegeProgress: number | null = null;

    if (task.status === 'marching') {
      if (task.marchStartedAt && task.estimatedArrival) {
        const total = task.estimatedArrival - task.marchStartedAt;
        const elapsed = Date.now() - task.marchStartedAt;
        marchProgress = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;
      } else {
        marchProgress = 50; // placeholder
      }
    }

    if (task.status === 'sieging' || task.status === 'paused') {
      // Siege progress is externally provided via defenseRatios; default to 50% placeholder
      siegeProgress = 50;
    }

    let result: 'victory' | 'defeat' | null = null;
    let rewards: SiegeTaskSummary['rewards'] = null;

    if (task.status === 'completed' && task.result) {
      result = task.result.victory ? 'victory' : 'defeat';
      if (task.result.victory) {
        rewards = {
          rewardMultiplier: task.result.rewardMultiplier,
          territoryCaptured: !!task.result.capture,
        };
      }
    }

    return {
      taskId: task.id,
      targetName: task.targetName,
      status: task.status,
      strategy: task.strategy,
      marchProgress,
      siegeProgress,
      result,
      rewards,
      rewardClaimed: this.claimedRewards.has(task.id),
    };
  }

  /**
   * 标记任务奖励为已领取
   * @returns true if successfully claimed, false if already claimed or task not found/completed
   */
  claimReward(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || !task.result?.victory || this.claimedRewards.has(taskId)) return false;
    this.claimedRewards.add(taskId);
    this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.STATUS_CHANGED, {
      taskId,
      from: 'completed',
      to: 'completed',
      task,
      rewardClaimed: true,
    });
    return true;
  }

  /** Public getter for claimed reward task IDs */
  getClaimedRewards(): Set<string> {
    return new Set(this.claimedRewards);
  }

  // ── 清理 ─────────────────────────────────────

  /** 移除已完成的任务（历史记录清理） */
  removeCompletedTasks(): number {
    let removed = 0;
    for (const [id, task] of this.tasks) {
      if (isTerminalStatus(task.status)) {
        // Ensure lock is released for completed tasks
        this.releaseSiegeLock(task.targetId);
        this.tasks.delete(id);
        removed++;
      }
    }
    return removed;
  }

  // ── 序列化 ─────────────────────────────────────

  /** 导出保存数据 */
  serialize(): SiegeTaskSaveData {
    return {
      version: SIEGE_TASK_SAVE_VERSION,
      tasks: Array.from(this.tasks.values()),
    };
  }

  /** 从保存数据恢复 */
  deserialize(data: SiegeTaskSaveData): void {
    this.tasks.clear();
    this.siegeLocks.clear();
    if (data?.tasks) {
      for (const task of data.tasks) {
        this.tasks.set(task.id, task);
      }
    }
    // 从非终态任务重建攻占锁
    for (const task of this.tasks.values()) {
      if (!isTerminalStatus(task.status)) {
        this.siegeLocks.set(task.targetId, { taskId: task.id, lockedAt: task.createdAt || Date.now() });
      }
    }
    // 更新ID计数器
    let maxId = 0;
    for (const task of this.tasks.values()) {
      const numMatch = task.id.match(/siege-task-(\d+)/);
      if (numMatch) {
        maxId = Math.max(maxId, parseInt(numMatch[1], 10));
      }
    }
    nextTaskId = maxId + 1;
  }

  // ── 私有方法 ─────────────────────────────────

  /** 合法状态转换表 */
  private isValidTransition(from: SiegeTaskStatus, to: SiegeTaskStatus): boolean {
    const transitions: Record<SiegeTaskStatus, SiegeTaskStatus[]> = {
      preparing: ['marching'],
      marching: ['sieging'],
      sieging: ['settling', 'paused'],
      settling: ['returning'],
      returning: ['completed'],
      completed: [],
      paused: ['sieging', 'returning'],
    };
    return transitions[from]?.includes(to) ?? false;
  }
}
