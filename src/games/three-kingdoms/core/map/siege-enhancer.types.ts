/**
 * 核心层 — 攻城增强类型定义
 *
 * 定义胜率预估、攻城奖励和征服规则的类型。
 * 供 SiegeEnhancer 引擎层使用。
 *
 * @module core/map/siege-enhancer.types
 */

import type { TerritoryProduction } from './territory.types';

// ─────────────────────────────────────────────
// 1. 胜率预估
// ─────────────────────────────────────────────

/**
 * 胜率预估结果
 *
 * 基于攻防双方战力计算的胜率预估。
 */
export interface WinRateEstimate {
  /** 胜率（0~1） */
  winRate: number;
  /** 攻击方有效战力 */
  attackerPower: number;
  /** 防守方有效战力（含驻防加成） */
  defenderPower: number;
  /** 预估损失兵力比例（0~1） */
  estimatedLossRate: number;
  /** 预估评级 */
  rating: BattleRating;
}

/** 战斗评级 */
export type BattleRating = 'easy' | 'moderate' | 'hard' | 'very_hard' | 'impossible';

/** 评级阈值配置 */
export const BATTLE_RATING_THRESHOLDS: Record<BattleRating, { min: number; max: number }> = {
  easy: { min: 0.75, max: 1.0 },
  moderate: { min: 0.50, max: 0.75 },
  hard: { min: 0.30, max: 0.50 },
  very_hard: { min: 0.15, max: 0.30 },
  impossible: { min: 0.0, max: 0.15 },
} as const;

// ─────────────────────────────────────────────
// 2. 攻城奖励
// ─────────────────────────────────────────────

/**
 * 攻城奖励
 *
 * 攻城成功后获得的资源、道具和经验奖励。
 */
export interface SiegeReward {
  /** 资源奖励 */
  resources: TerritoryProduction;
  /** 领土经验奖励 */
  territoryExp: number;
  /** 道具奖励列表 */
  items: SiegeRewardItem[];
}

/** 攻城道具奖励 */
export interface SiegeRewardItem {
  /** 道具ID */
  itemId: string;
  /** 道具名称 */
  itemName: string;
  /** 数量 */
  quantity: number;
  /** 稀有度 */
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

// ─────────────────────────────────────────────
// 3. 征服流程
// ─────────────────────────────────────────────

/** 征服阶段 */
export type ConquestPhase = 'check' | 'battle' | 'capture' | 'reward';

/**
 * 征服结果
 *
 * 完整的征服流程结果，包含所有阶段的信息。
 */
export interface ConquestResult {
  /** 是否成功 */
  success: boolean;
  /** 当前阶段 */
  phase: ConquestPhase;
  /** 目标领土ID */
  targetId: string;
  /** 目标领土名称 */
  targetName: string;
  /** 胜率预估 */
  winRateEstimate: WinRateEstimate | null;
  /** 战斗是否胜利 */
  battleVictory: boolean;
  /** 占领信息 */
  capture: { territoryId: string; previousOwner: string } | null;
  /** 攻城奖励 */
  reward: SiegeReward | null;
  /** 失败原因 */
  failureReason?: string;
}

// ─────────────────────────────────────────────
// 4. 奖励配置常量
// ─────────────────────────────────────────────

/** 基础攻城奖励系数 */
export const SIEGE_REWARD_CONFIG = {
  /** 基础粮食奖励 × 领土等级 */
  baseGrain: 50,
  /** 基础金币奖励 × 领土等级 */
  baseGold: 30,
  /** 基础兵力奖励 × 领土等级 */
  baseTroops: 20,
  /** 基础天命奖励 × 领土等级 */
  baseMandate: 5,
  /** 领土经验奖励 × 领土等级 */
  baseTerritoryExp: 100,
  /** 关卡额外奖励倍率 */
  passBonusMultiplier: 1.5,
  /** 都城额外奖励倍率 */
  capitalBonusMultiplier: 2.0,
} as const;

/** 攻城增强存档版本 */
export const SIEGE_ENHANCER_SAVE_VERSION = 1;

/** 攻城增强存档数据 */
export interface SiegeEnhancerSaveData {
  /** 累计发放的奖励次数 */
  totalRewardsGranted: number;
  /** 版本号 */
  version: number;
}
