/**
 * 引擎层 — 数值计算器（配置常量 + 重导出）
 *
 * 提供5大平衡维度的默认配置常量。
 * 工具函数和纯计算函数已提取到 BalanceUtils.ts，此处通过重导出保持向后兼容。
 *
 * 依赖关系（解耦后）：
 *   BalanceUtils → core/unification (types only)
 *   BalanceCalculator → BalanceUtils + core/unification (仅配置常量)
 *   BalanceReport → BalanceUtils + core/unification (不再依赖 BalanceCalculator)
 *   BalanceValidator → BalanceUtils + BalanceReport + BalanceCalculator
 *
 * @module engine/unification/BalanceCalculator
 */

import type {
  ResourceBalanceConfig,
  HeroBaseStats,
  BattleDifficultyConfig,
  EconomyBalanceConfig,
  RebirthBalanceConfig,
} from '../../core/unification';

// ─────────────────────────────────────────────
// 从 BalanceUtils 重导出（保持向后兼容）
// ─────────────────────────────────────────────
export {
  generateId,
  inRange,
  calcDeviation,
  makeEntry,
  calcPower,
  calcRebirthMultiplier,
  generateResourceCurve,
} from './BalanceUtils';

// ─────────────────────────────────────────────
// 默认配置常量
// ─────────────────────────────────────────────

/** 默认资源平衡配置 */
export const DEFAULT_RESOURCE_CONFIGS: ResourceBalanceConfig[] = [
  {
    resourceType: 'grain',
    earlyGameDailyRange: { min: 500, max: 2000 },
    midGameDailyRange: { min: 5000, max: 20000 },
    lateGameDailyRange: { min: 50000, max: 200000 },
    productionConsumptionRatio: { min: 1.2, max: 3.0 },
    maxDeviationPercent: 30,
  },
  {
    resourceType: 'gold',
    earlyGameDailyRange: { min: 200, max: 1000 },
    midGameDailyRange: { min: 2000, max: 10000 },
    lateGameDailyRange: { min: 20000, max: 100000 },
    productionConsumptionRatio: { min: 1.0, max: 2.5 },
    maxDeviationPercent: 30,
  },
  {
    resourceType: 'troops',
    earlyGameDailyRange: { min: 100, max: 500 },
    midGameDailyRange: { min: 1000, max: 5000 },
    lateGameDailyRange: { min: 10000, max: 50000 },
    productionConsumptionRatio: { min: 0.8, max: 2.0 },
    maxDeviationPercent: 30,
  },
  {
    resourceType: 'mandate',
    earlyGameDailyRange: { min: 10, max: 50 },
    midGameDailyRange: { min: 50, max: 200 },
    lateGameDailyRange: { min: 200, max: 1000 },
    productionConsumptionRatio: { min: 0.5, max: 1.5 },
    maxDeviationPercent: 40,
  },
];

/** 默认武将品质基础属性 */
export const HERO_BASE_STATS: Record<string, HeroBaseStats> = {
  COMMON: { attack: 30, defense: 25, hp: 200, speed: 20 },
  FINE: { attack: 45, defense: 38, hp: 300, speed: 30 },
  RARE: { attack: 65, defense: 55, hp: 450, speed: 45 },
  EPIC: { attack: 90, defense: 75, hp: 650, speed: 60 },
  LEGENDARY: { attack: 120, defense: 100, hp: 900, speed: 80 },
};

/** 默认战斗难度配置 */
export const DEFAULT_BATTLE_CONFIG: BattleDifficultyConfig = {
  totalChapters: 5,
  stagesPerChapter: 3,
  firstStagePower: 500,
  lastStagePower: 80000,
  curveType: 'exponential',
  growthFactor: 1.35,
  bossMultiplier: 1.5,
};

/** 默认经济配置 */
export const DEFAULT_ECONOMY_CONFIGS: EconomyBalanceConfig[] = [
  {
    currency: 'copper',
    dailyAcquisitionRange: { min: 5000, max: 50000 },
    dailyConsumptionRange: { min: 3000, max: 40000 },
    acquisitionConsumptionRatio: { min: 1.0, max: 2.0 },
    inflationWarningThreshold: 0.5,
  },
  {
    currency: 'mandate',
    dailyAcquisitionRange: { min: 10, max: 100 },
    dailyConsumptionRange: { min: 5, max: 80 },
    acquisitionConsumptionRatio: { min: 1.0, max: 3.0 },
    inflationWarningThreshold: 0.6,
  },
  {
    currency: 'recruit',
    dailyAcquisitionRange: { min: 1, max: 10 },
    dailyConsumptionRange: { min: 0, max: 8 },
    acquisitionConsumptionRatio: { min: 1.0, max: 5.0 },
    inflationWarningThreshold: 0.7,
  },
  {
    currency: 'ingot',
    dailyAcquisitionRange: { min: 0, max: 5 },
    dailyConsumptionRange: { min: 0, max: 3 },
    acquisitionConsumptionRatio: { min: 0.5, max: 3.0 },
    inflationWarningThreshold: 0.4,
  },
];

/** 默认转生配置 */
export const DEFAULT_REBIRTH_CONFIG: RebirthBalanceConfig = {
  maxRebirthCount: 20,
  baseMultiplier: 1.0,
  perRebirthIncrement: 0.15,
  maxMultiplier: 10.0,
  curveType: 'diminishing',
  decayFactor: 0.92,
};
