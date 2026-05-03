/**
 * 出征编队类型定义
 *
 * 出征编队用于攻城/资源占领，必须包含至少一个将领和士兵。
 * 将领从编队(Formation)中选择，士兵从总兵力中调用。
 *
 * @module engine/map/expedition-types
 */

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 出征编队最大数量 */
const MAX_EXPEDITION_FORCES = 3;

/** 每个编队最少兵力 */
const MIN_TROOPS_PER_FORCE = 100;

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 出征编队状态 */
export type ExpeditionForceStatus = 'ready' | 'marching' | 'fighting' | 'returning';

/** 将领受伤等级 */
export type InjuryLevel = 'none' | 'minor' | 'moderate' | 'severe';

/** 出征编队 */
export interface ExpeditionForce {
  /** 编队ID */
  id: string;
  /** 将领ID（必须） */
  heroId: string;
  /** 士兵数量（必须 > 0） */
  troops: number;
  /** 编队状态 */
  status: ExpeditionForceStatus;
  /** 目标领土ID（出征时设置） */
  targetId?: string;
  /** 出征开始时间 */
  startTime?: number;
}

/** 出征编队创建参数 */
export interface CreateExpeditionForceParams {
  heroId: string;
  troops: number;
}

/** 出征编队校验错误码 */
export type ExpeditionErrorCode =
  | 'HERO_REQUIRED'
  | 'TROOPS_REQUIRED'
  | 'HERO_BUSY'
  | 'HERO_INJURED'
  | 'INSUFFICIENT_TROOPS'
  | 'FORCE_NOT_FOUND'
  | 'FORCE_NOT_READY'
  | 'MAX_FORCES_REACHED';

/** 出征编队校验结果 */
export interface ExpeditionValidationResult {
  valid: boolean;
  errorCode?: ExpeditionErrorCode;
  errorMessage?: string;
}

/** 战斗伤亡结果 */
export interface CasualtyResult {
  /** 士兵损失数量 */
  troopsLost: number;
  /** 士兵损失百分比 */
  troopsLostPercent: number;
  /** 将领是否受伤 */
  heroInjured: boolean;
  /** 将领受伤等级 */
  injuryLevel: InjuryLevel;
  /** 战斗结果类型 */
  battleResult: 'victory' | 'defeat' | 'rout';
}

/** 出征结果 */
export interface ExpeditionResult {
  /** 是否成功发起 */
  launched: boolean;
  /** 编队ID */
  forceId: string;
  /** 目标领土ID */
  targetId: string;
  /** 战斗伤亡 */
  casualties?: CasualtyResult;
  /** 失败原因 */
  failureReason?: string;
  /** 错误码 */
  errorCode?: ExpeditionErrorCode;
}

/** 出征编队存档数据 */
export interface ExpeditionSaveData {
  version: number;
  forces: Record<string, ExpeditionForce>;
  /** 将领受伤状态 (heroId -> InjuryLevel) */
  heroInjuries: Record<string, InjuryLevel>;
}

// ─────────────────────────────────────────────
// 伤亡配置
// ─────────────────────────────────────────────

/** 伤亡率配置 */
export const CASUALTY_RATES = {
  /** 胜利: 损失 5%~15% 兵力 */
  victory: { min: 0.05, max: 0.15 },
  /** 失败: 损失 20%~40% 兵力 */
  defeat: { min: 0.20, max: 0.40 },
  /** 惨败: 损失 50%~80% 兵力 */
  rout: { min: 0.50, max: 0.80 },
} as const;

/** 武将受伤概率配置 */
export const HERO_INJURY_RATES = {
  /** 胜利: 10% 概率轻伤 */
  victory: { probability: 0.10, level: 'minor' as InjuryLevel },
  /** 失败: 30% 概率中伤 */
  defeat: { probability: 0.30, level: 'moderate' as InjuryLevel },
  /** 惨败: 50% 概率重伤 */
  rout: { probability: 0.50, level: 'severe' as InjuryLevel },
} as const;

/** 受伤等级对战力的影响 */
export const INJURY_POWER_MULTIPLIER: Record<InjuryLevel, number> = {
  none: 1.0,
  minor: 0.9,    // 轻伤: 战力-10%
  moderate: 0.7, // 中伤: 战力-30%
  severe: 0.5,   // 重伤: 战力-50%
};

/** 受伤恢复时间（毫秒） */
export const INJURY_RECOVERY_TIME: Record<InjuryLevel, number> = {
  none: 0,
  minor: 30 * 60 * 1000,      // 30分钟
  moderate: 2 * 60 * 60 * 1000, // 2小时
  severe: 6 * 60 * 60 * 1000,   // 6小时
};
