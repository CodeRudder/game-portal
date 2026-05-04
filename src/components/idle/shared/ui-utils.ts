/**
 * ui-utils — UI 层共享工具函数
 *
 * 从多个组件中提取的重复工具函数统一入口：
 * - formatNum()       数字格式化（中文单位）
 * - getResourceLabel() 资源中文名获取
 *
 * @module components/idle/shared/ui-utils
 */

import { RESOURCE_LABELS } from '@/games/three-kingdoms/engine';
import type { ResourceType } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// 数字格式化
// ─────────────────────────────────────────────

/**
 * 格式化数字为中文单位（万/亿）
 *
 * 规则：
 * - < 10000        → 整数 + 千分位
 * - 1万 ~ 9999.9万 → 保留1位小数 + 万
 * - ≥ 1亿          → 保留1位小数 + 亿
 *
 * @param n - 要格式化的数字
 * @returns 格式化后的字符串
 */
export function formatNum(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1).replace(/\.0$/, '')}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return n.toLocaleString();
}

// ─────────────────────────────────────────────
// 资源标签
// ─────────────────────────────────────────────

/**
 * 获取资源中文名
 *
 * 支持标准资源类型和碎片类型（fragment_xxx → xxx碎片）。
 * 回退到原始 type 字符串。
 *
 * @param type - 资源类型标识
 * @returns 资源中文名
 */
export function getResourceLabel(type: string): string {
  if (type.startsWith('fragment_')) {
    const heroName = type.replace('fragment_', '');
    return `${heroName}碎片`;
  }
  return RESOURCE_LABELS[type as ResourceType] ?? type;
}
