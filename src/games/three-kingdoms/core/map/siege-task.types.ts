/**
 * 攻占任务类型定义
 *
 * 异步攻城流程的核心数据结构：
 * 确认→创建任务→行军→到达→攻城→结算→回城
 *
 * @module core/map/siege-task.types
 * @see flows.md MAP-F06-P5~P10
 */

import type { SiegeStrategyType } from './siege-enhancer.types';
import type { SiegeCost } from '../../engine/map/SiegeSystem';
import type { CasualtyResult } from '../../engine/map/expedition-types';

// ─────────────────────────────────────────────
// 攻占任务状态
// ─────────────────────────────────────────────

/** 攻占任务状态枚举 */
export type SiegeTaskStatus =
  | 'preparing'   // 准备中（已确认，等待行军出发）
  | 'marching'    // 行军中（精灵在地图上移动）
  | 'sieging'     // 攻城中（城防衰减/战斗过程）
  | 'settling'    // 结算中（计算伤亡/奖励）
  | 'returning'   // 回城中（编队沿原路返回）
  | 'completed';  // 已完成（结果已展示，编队已回收）

/** 攻占任务状态是否为终态 */
export function isTerminalStatus(status: SiegeTaskStatus): boolean {
  return status === 'completed';
}

// ─────────────────────────────────────────────
// 攻占任务核心接口
// ─────────────────────────────────────────────

/** 攻占任务编队摘要 */
export interface SiegeTaskExpedition {
  /** 编队ID */
  forceId: string;
  /** 将领ID */
  heroId: string;
  /** 将领名称 */
  heroName: string;
  /** 出征兵力 */
  troops: number;
}

/** 攻占任务 */
export interface SiegeTask {
  /** 任务唯一ID */
  id: string;
  /** 当前状态 */
  status: SiegeTaskStatus;
  /** 目标领土ID */
  targetId: string;
  /** 目标领土名称 */
  targetName: string;
  /** 出发城市ID */
  sourceId: string;
  /** 出发城市名称 */
  sourceName: string;
  /** 选定的攻城策略 */
  strategy: SiegeStrategyType | null;
  /** 编队信息 */
  expedition: SiegeTaskExpedition;
  /** 攻城消耗预估 */
  cost: SiegeCost;
  /** 创建时间戳 */
  createdAt: number;
  /** 行军出发时间戳 */
  marchStartedAt: number | null;
  /** 预计到达时间戳 */
  estimatedArrival: number | null;
  /** 行军到达时间戳 */
  arrivedAt: number | null;
  /** 攻城完成时间戳 */
  siegeCompletedAt: number | null;
  /** 回城到达时间戳 */
  returnCompletedAt: number | null;
  /** 行军路径点 */
  marchPath: Array<{ x: number; y: number }>;
  /** 攻城结果（攻城完成后填充） */
  result: SiegeTaskResult | null;
}

/** 攻占任务结果 */
export interface SiegeTaskResult {
  /** 是否胜利 */
  victory: boolean;
  /** 占领信息（胜利时有值） */
  capture?: {
    territoryId: string;
    newOwner: string;
    previousOwner: string;
  };
  /** 伤亡结果 */
  casualties: CasualtyResult | null;
  /** 实际消耗 */
  actualCost: SiegeCost;
  /** 奖励倍率 */
  rewardMultiplier: number;
  /** 策略特殊效果是否触发 */
  specialEffectTriggered: boolean;
  /** 失败原因 */
  failureReason?: string;
}

// ─────────────────────────────────────────────
// 攻占任务事件
// ─────────────────────────────────────────────

/** 攻占任务状态变更事件 */
export interface SiegeTaskStatusChangedEvent {
  /** 任务ID */
  taskId: string;
  /** 旧状态 */
  from: SiegeTaskStatus;
  /** 新状态 */
  to: SiegeTaskStatus;
  /** 任务数据快照 */
  task: SiegeTask;
}

// ─────────────────────────────────────────────
// 序列化
// ─────────────────────────────────────────────

/** 攻占任务保存版本 */
export const SIEGE_TASK_SAVE_VERSION = 1;

/** 攻占任务保存数据 */
export interface SiegeTaskSaveData {
  version: number;
  tasks: SiegeTask[];
}
