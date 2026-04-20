/**
 * 引擎层 — 数值计算器
 *
 * 提供数值验证所需的常量配置、工具函数和纯计算逻辑。
 *
 * 包含：
 *   - 5大平衡维度的默认配置常量
 *   - 通用工具函数（范围判断、偏差计算、ID生成等）
 *   - 纯计算函数（战力计算、转生倍率计算、曲线生成等）
 *
 * @module engine/unification/BalanceCalculator
 */

import type {
  ValidationEntry,
  ValidationLevel,
  BalanceDimension,
  NumericRange,
  ResourceBalanceConfig,
  ResourceCurvePoint,
  HeroBaseStats,
  BattleDifficultyConfig,
  EconomyBalanceConfig,
  RebirthBalanceConfig,
  RebirthMultiplierPoint,
} from '../../core/unification';

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

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成唯一 ID */
export function generateId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** 判断数值是否在范围内 */
export function inRange(value: number, range: NumericRange): boolean {
  return value >= range.min && value <= range.max;
}

/** 计算偏差百分比 */
export function calcDeviation(actual: number, expected: number): number {
  if (expected === 0) return actual === 0 ? 0 : 100;
  return Math.abs((actual - expected) / expected) * 100;
}

/** 创建验证条目 */
export function makeEntry(
  featureId: string,
  dimension: BalanceDimension,
  level: ValidationLevel,
  actual: number,
  expected: number | NumericRange,
  message: string,
): ValidationEntry {
  const expectedNum = typeof expected === 'number' ? expected : (expected.min + expected.max) / 2;
  return {
    featureId,
    dimension,
    level,
    actual,
    expected,
    deviation: calcDeviation(actual, expectedNum),
    message,
  };
}

// ─────────────────────────────────────────────
// 纯计算函数
// ─────────────────────────────────────────────

/** 计算战力 */
export function calcPower(stats: HeroBaseStats, levelFactor: number, starFactor: number): number {
  return Math.floor(
    (stats.attack * 2 + stats.defense * 1.5 + stats.hp * 0.5 + stats.speed * 1) *
    levelFactor * starFactor,
  );
}

/** 计算转生倍率（递减曲线） */
export function calcRebirthMultiplier(count: number, config: RebirthBalanceConfig): number {
  if (count <= 0) return 1.0;
  let multiplier = config.baseMultiplier;
  for (let i = 1; i <= count; i++) {
    const increment = config.perRebirthIncrement * Math.pow(config.decayFactor, i - 1);
    multiplier = Math.min(multiplier + increment, config.maxMultiplier);
  }
  return Math.round(multiplier * 100) / 100;
}

/** 生成资源曲线数据点 */
export function generateResourceCurve(config: ResourceBalanceConfig): ResourceCurvePoint[] {
  const points: ResourceCurvePoint[] = [];
  const days = [1, 7, 14, 30, 60, 90];
  const earlyDaily = (config.earlyGameDailyRange.min + config.earlyGameDailyRange.max) / 2;
  const growthRate = 1.08;

  let totalProduced = 0;
  let totalConsumed = 0;

  for (const day of days) {
    const productionRate = (earlyDaily / 86400) * Math.pow(growthRate, day - 1);
    const consumptionRate = productionRate * (0.5 + Math.random() * 0.3);
    totalProduced += productionRate * 86400;
    totalConsumed += consumptionRate * 86400;

    points.push({
      day,
      productionRate: Math.round(productionRate * 1000) / 1000,
      totalProduced: Math.floor(totalProduced),
      totalConsumed: Math.floor(totalConsumed),
      netIncome: Math.floor(totalProduced - totalConsumed),
    });
  }

  return points;
}

// ─────────────────────────────────────────────
// 从 BalanceReport 重导出（保持向后兼容）
// ─────────────────────────────────────────────

export {
  validateSingleResource,
  validateSingleHero,
  calculateStagePoints,
  validateEconomy,
  validateRebirth,
} from './BalanceReport';

/** 计算转生倍率数据点 */
export function calculateRebirthPoints(cfg: RebirthBalanceConfig): RebirthMultiplierPoint[] {
  const points: RebirthMultiplierPoint[] = [];
  let prevMultiplier = 1.0;

  for (let count = 1; count <= cfg.maxRebirthCount; count++) {
    const multiplier = calcRebirthMultiplier(count, cfg);
    const increment = multiplier - prevMultiplier;

    points.push({
      rebirthCount: count,
      multiplier,
      increment: Math.round(increment * 1000) / 1000,
      cumulativeAcceleration: multiplier,
    });

    prevMultiplier = multiplier;
  }

  return points;
}
