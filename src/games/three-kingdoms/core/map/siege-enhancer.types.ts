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

// ─────────────────────────────────────────────
// 5. 攻城策略（MAP-F06-02 R2/R5）
// ─────────────────────────────────────────────

/** 攻城策略类型 */
export type SiegeStrategyType = 'forceAttack' | 'siege' | 'nightRaid' | 'insider';

/** 攻城策略四维配置 */
export interface SiegeStrategyConfig {
  /** 策略类型 */
  type: SiegeStrategyType;
  /** 策略名称 */
  name: string;
  /** 策略描述 */
  description: string;
  /** 时间倍率 */
  timeMultiplier: number;
  /** 兵力损耗倍率 */
  troopCostMultiplier: number;
  /** 奖励倍率 */
  rewardMultiplier: number;
  /** 成功率修正(加法) */
  winRateBonus: number;
  /** 特殊效果描述 */
  specialEffect: string;
  /** 前置道具ID(null=无前置) */
  requiredItem: string | null;
  /** 策略定位 */
  positioning: string;
}

/** 攻城策略配置表 */
export const SIEGE_STRATEGY_CONFIGS: Record<SiegeStrategyType, SiegeStrategyConfig> = {
  forceAttack: {
    type: 'forceAttack',
    name: '强攻',
    description: '不惜代价强攻城门，速度最快但损耗最高',
    timeMultiplier: 0.5,
    troopCostMultiplier: 1.5,
    rewardMultiplier: 0.9,
    winRateBonus: -0.10,
    specialEffect: '城防损坏(占领后城防-50%)',
    requiredItem: null,
    positioning: '速攻手',
  },
  siege: {
    type: 'siege',
    name: '围困',
    description: '围而不攻，断其粮道，损耗最低但耗时最长',
    timeMultiplier: 2.0,
    troopCostMultiplier: 0.8,
    rewardMultiplier: 1.0,
    winRateBonus: 0.10,
    specialEffect: '民心下降(占领后产出-20%持续24h)',
    requiredItem: null,
    positioning: '稳扎稳打',
  },
  nightRaid: {
    type: 'nightRaid',
    name: '夜袭',
    description: '趁夜色突袭，需要夜袭令，高风险高回报',
    timeMultiplier: 0.8,
    troopCostMultiplier: 1.2,
    rewardMultiplier: 1.2,
    winRateBonus: 0.05,
    specialEffect: '夜间额外+10%成功率',
    requiredItem: 'item-night-raid-token',
    positioning: '奇袭者',
  },
  insider: {
    type: 'insider',
    name: '内应',
    description: '联络城中内应，需要内应信，成功率最高奖励最丰',
    timeMultiplier: 1.0,
    troopCostMultiplier: 1.0,
    rewardMultiplier: 1.5,
    winRateBonus: 0.20,
    specialEffect: '+20%成功率，城防完整保留',
    requiredItem: 'item-insider-letter',
    positioning: '智取型',
  },
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
