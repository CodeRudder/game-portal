/**
 * 统一数字格式化工具（中文单位）
 *
 * 规则：
 * - < 10000        → 整数字符串
 * - 1万 ~ 9999.9万 → 保留1位小数 + 万（去除 .0）
 * - ≥ 1亿          → 保留1位小数 + 亿（去除 .0）
 */
export function formatNumber(n: number): string {
  if (n < 10000) return String(Math.floor(n));
  if (n < 1_0000_0000) return (n / 1_0000).toFixed(1).replace(/\.0$/, '') + '万';
  return (n / 1_0000_0000).toFixed(1).replace(/\.0$/, '') + '亿';
}
