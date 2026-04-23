/**
 * 引擎层 — 数值验证器辅助模块
 *
 * 从 BalanceValidator 中拆分出来，包含：
 *   - 默认经济配置（从 BalanceCalculator 导入，保持单一数据源）
 *   - 验证汇总构建函数
 *   - 总体等级判定函数
 *
 * @module engine/unification/BalanceValidatorHelpers
 */

import type {
  ValidationEntry,
  ValidationLevel,
  BalanceSummary,
} from '../../core/unification';

// 从权威数据源 BalanceCalculator 重导出，避免重复定义
export { DEFAULT_ECONOMY_CONFIGS } from './BalanceCalculator';

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
