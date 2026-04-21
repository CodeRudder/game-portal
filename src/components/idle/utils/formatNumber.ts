/**
 * 统一数字格式化工具
 *
 * 规则：
 * - < 1000         → 整数字符串
 * - 1K ~ 999.9K    → 保留1位小数 + K（去除 .0）
 * - 1M ~ 999.9M    → 保留1位小数 + M（去除 .0）
 * - ≥ 1B           → 保留1位小数 + B（去除 .0）
 */
export function formatNumber(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
}
