/**
 * 扫荡系统 — 类型定义
 *
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 * 来源：v4.0 Stage2 扫荡系统
 *
 * @module engine/campaign/sweep.types
 */

import type { StageReward } from './campaign.types';

// ─────────────────────────────────────────────
// 1. 扫荡令
// ─────────────────────────────────────────────

/**
 * 扫荡令来源
 *
 * daily  — 每日任务奖励
 * shop   — 商店购买
 * system — 系统补偿/活动赠送
 */
export type SweepTicketSource = 'daily' | 'shop' | 'system';

/**
 * 扫荡令获取记录
 *
 * 记录一次扫荡令获取的来源和数量
 */
export interface SweepTicketGainRecord {
  /** 来源 */
  source: SweepTicketSource;
  /** 数量 */
  amount: number;
  /** 时间戳（ms） */
  timestamp: number;
}

/**
 * 扫荡令消耗记录
 *
 * 记录一次扫荡令消耗的关卡和数量
 */
export interface SweepTicketCostRecord {
  /** 关卡ID */
  stageId: string;
  /** 消耗数量 */
  amount: number;
  /** 时间戳（ms） */
  timestamp: number;
}

// ─────────────────────────────────────────────
// 2. 扫荡配置
// ─────────────────────────────────────────────

/**
 * 扫荡系统配置
 *
 * 控制扫荡行为的核心参数
 */
export interface SweepConfig {
  /** 每日任务赠送扫荡令数量 */
  dailyTicketReward: number;
  /** 单次扫荡消耗扫荡令数量 */
  sweepCostPerRun: number;
  /** 单次批量扫荡最大次数 */
  maxSweepCount: number;
  /** 自动推图每次最大尝试次数 */
  autoPushMaxAttempts: number;
}

/** 默认扫荡配置 */
export const DEFAULT_SWEEP_CONFIG: SweepConfig = {
  dailyTicketReward: 3,
  sweepCostPerRun: 1,
  maxSweepCount: 10,
  autoPushMaxAttempts: 3,
} as const;

// ─────────────────────────────────────────────
// 3. 扫荡结果
// ─────────────────────────────────────────────

/**
 * 单次扫荡结果
 *
 * 一次扫荡的完整结果数据
 */
export interface SweepResult {
  /** 关卡ID */
  stageId: string;
  /** 使用的星级（取历史最高） */
  stars: number;
  /** 本次扫荡获得的奖励 */
  reward: StageReward;
}

/**
 * 批量扫荡结果
 *
 * 多次扫荡的汇总结果
 */
export interface SweepBatchResult {
  /** 是否全部成功 */
  success: boolean;
  /** 扫荡的关卡ID */
  stageId: string;
  /** 请求的扫荡次数 */
  requestedCount: number;
  /** 实际执行的扫荡次数 */
  executedCount: number;
  /** 各次扫荡的详细结果 */
  results: SweepResult[];
  /** 汇总资源奖励 */
  totalResources: Partial<Record<string, number>>;
  /** 汇总经验奖励 */
  totalExp: number;
  /** 汇总碎片奖励 */
  totalFragments: Record<string, number>;
  /** 消耗的扫荡令数量 */
  ticketsUsed: number;
  /** VIP免费扫荡消耗次数 */
  freeSweepUsed?: number;
  /** 失败原因（success=false时） */
  failureReason?: string;
}

// ─────────────────────────────────────────────
// 4. 自动推图
// ─────────────────────────────────────────────

/**
 * 自动推图进度
 *
 * 记录自动推图的实时进度
 */
export interface AutoPushProgress {
  /** 是否正在运行 */
  isRunning: boolean;
  /** 起始关卡ID */
  startStageId: string;
  /** 当前关卡ID */
  currentStageId: string;
  /** 已尝试次数 */
  attempts: number;
  /** 成功次数 */
  victories: number;
  /** 失败次数 */
  defeats: number;
}

/**
 * 自动推图结果
 *
 * 自动推图完成后的汇总数据
 */
export interface AutoPushResult {
  /** 是否因达到最大尝试次数而停止 */
  reachedMaxAttempts: boolean;
  /** 起始关卡ID */
  startStageId: string;
  /** 最终停止关卡ID */
  endStageId: string;
  /** 总尝试次数 */
  totalAttempts: number;
  /** 成功次数 */
  victories: number;
  /** 失败次数 */
  defeats: number;
  /** 各次扫荡的详细结果 */
  results: SweepResult[];
  /** 汇总资源奖励 */
  totalResources: Partial<Record<string, number>>;
  /** 汇总经验奖励 */
  totalExp: number;
  /** 汇总碎片奖励 */
  totalFragments: Record<string, number>;
  /** 消耗的扫荡令数量 */
  ticketsUsed: number;
}

// ─────────────────────────────────────────────
// 5. 扫荡系统依赖
// ─────────────────────────────────────────────

/**
 * 扫荡系统依赖接口
 *
 * 通过回调解耦战斗引擎和关卡进度系统
 */
export interface SweepDeps {
  /** 模拟战斗并返回是否胜利（自动推图使用） */
  simulateBattle: (stageId: string) => {
    victory: boolean;
    stars: number;
  };
  /** 获取关卡星级（从进度系统查询） */
  getStageStars: (stageId: string) => number;
  /** 检查关卡是否可挑战 */
  canChallenge: (stageId: string) => boolean;
  /** 获取当前最远可挑战关卡ID */
  getFarthestStageId: () => string | null;
  /** 完成关卡（更新进度，自动推图使用） */
  completeStage: (stageId: string, stars: number) => void;
}

// ─────────────────────────────────────────────
// 6. 扫荡系统存档
// ─────────────────────────────────────────────

/**
 * 扫荡系统存档数据
 */
export interface SweepSaveData {
  /** 存档版本号 */
  version: number;
  /** 扫荡令数量 */
  ticketCount: number;
  /** 今日已领取每日扫荡令 */
  dailyTicketClaimed: boolean;
  /** 上次领取每日扫荡令的日期（YYYY-MM-DD） */
  lastDailyTicketDate: string | null;
}
