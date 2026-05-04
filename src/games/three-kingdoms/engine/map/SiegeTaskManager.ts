/**
 * 攻占任务管理器
 *
 * 管理异步攻城任务的生命周期：
 * preparing → marching → sieging → settling → returning → completed
 *
 * 与 MarchingSystem 协作：
 * - 创建任务时同步创建行军单位
 * - 监听 march:arrived 事件推进状态
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
} as const;

// ─────────────────────────────────────────────
// SiegeTaskManager
// ─────────────────────────────────────────────

let nextTaskId = 1;

export class SiegeTaskManager {
  private tasks: Map<string, SiegeTask> = new Map();
  private deps: SiegeTaskManagerDeps | null = null;

  /** 设置依赖 */
  setDependencies(deps: SiegeTaskManagerDeps): void {
    this.deps = deps;
  }

  // ── 任务创建 ─────────────────────────────────

  /**
   * 创建攻占任务
   * @returns 新创建的 SiegeTask
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
  }): SiegeTask {
    const task: SiegeTask = {
      id: `siege-task-${nextTaskId++}`,
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

  // ── 清理 ─────────────────────────────────────

  /** 移除已完成的任务（历史记录清理） */
  removeCompletedTasks(): number {
    let removed = 0;
    for (const [id, task] of this.tasks) {
      if (isTerminalStatus(task.status)) {
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
    if (data?.tasks) {
      for (const task of data.tasks) {
        this.tasks.set(task.id, task);
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
      sieging: ['settling'],
      settling: ['returning'],
      returning: ['completed'],
      completed: [],
    };
    return transitions[from]?.includes(to) ?? false;
  }
}
