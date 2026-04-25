/**
 * 引擎层 — 数值平衡工具函数
 *
 * 从 BalanceCalculator 中提取的纯工具/计算函数。
 * BalanceCalculator、BalanceReport、BalanceValidator 均从此模块导入，
 * 避免三者之间形成直接耦合或循环依赖。
 *
 * 包含：
 *   - 通用工具函数（范围判断、偏差计算、ID生成、验证条目构建）
 *   - 纯计算函数（战力计算、转生倍率计算、资源曲线生成）
 *
 * @module engine/unification/BalanceUtils
 */

import type {
  ValidationEntry,
  ValidationLevel,
  BalanceDimension,
  NumericRange,
  ResourceBalanceConfig,
  ResourceCurvePoint,
  HeroBaseStats,
  RebirthBalanceConfig,
} from '../../core/unification';

// ─────────────────────────────────────────────
// 通用工具函数
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

  if (config.curveType === 'logarithmic') {
    // 对数衰减曲线：multiplier = base + perRebirth × ln(1 + count) / ln(2)
    // 高转生次数时倍率增长自然放缓，避免线性失控
    const logIncrement = config.perRebirthIncrement * Math.log(1 + count) / Math.log(2);
    const multiplier = Math.min(config.baseMultiplier + logIncrement, config.maxMultiplier);
    return Math.round(multiplier * 100) / 100;
  }

  // 原有递减曲线逻辑（linear / diminishing / accelerating）
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
    const consumptionRate = productionRate * 0.65;
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
