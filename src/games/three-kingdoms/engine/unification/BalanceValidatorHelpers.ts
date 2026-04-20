/**
 * 引擎层 — 数值验证器辅助模块
 *
 * 从 BalanceValidator 中拆分出来，包含：
 *   - 默认经济配置
 *   - 验证汇总构建函数
 *   - 总体等级判定函数
 *
 * @module engine/unification/BalanceValidatorHelpers
 */

import type {
  ValidationEntry,
  ValidationLevel,
  BalanceSummary,
  EconomyBalanceConfig,
} from '../../core/unification';

// ─────────────────────────────────────────────
// 默认经济配置
// ─────────────────────────────────────────────

/** 默认经济配置（4种货币的获取/消耗/通胀阈值） */
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

// ─────────────────────────────────────────────
// 验证辅助函数
// ─────────────────────────────────────────────

/** 从验证条目列表构建汇总 */
export function buildSummary(entries: ValidationEntry[]): BalanceSummary {
  const passCount = entries.filter(e => e.level === 'pass').length;
  const warningCount = entries.filter(e => e.level === 'warning').length;
  const failCount = entries.filter(e => e.level === 'fail').length;
  const totalChecks = entries.length;

  return {
    totalChecks,
    passCount,
    warningCount,
    failCount,
    passRate: totalChecks > 0 ? passCount / totalChecks : 0,
  };
}

/** 根据汇总确定总体验证等级 */
export function determineOverallLevel(summary: BalanceSummary): ValidationLevel {
  if (summary.failCount > 0) return 'fail';
  if (summary.warningCount > 0) return 'warning';
  return 'pass';
}
