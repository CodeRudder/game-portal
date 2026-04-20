/**
 * 引擎层 — 视觉规范默认值与工具函数
 *
 * 从 VisualConsistencyChecker 中拆分出来，包含：
 *   - 动画规范默认值（过渡/状态/反馈/入场/退场）
 *   - 配色规范默认值（品质/阵营/功能/状态）
 *   - 颜色工具函数（解析/比较）
 *
 * @module engine/unification/VisualSpecDefaults
 */

import type {
  AnimationSpec,
  QualityColorDef,
  FactionColorDef,
  FunctionalColorDef,
  StatusColorDef,
} from '../../core/unification';

// ─────────────────────────────────────────────
// 动画规范默认值
// ─────────────────────────────────────────────

/** 过渡动画规范 */
export const TRANSITION_SPECS: AnimationSpec[] = [
  {
    id: 'ANI-T-001', category: 'transition',
    standardDurationMs: 300, durationToleranceMs: 50,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-T-002', category: 'transition',
    standardDurationMs: 200, durationToleranceMs: 30,
    standardEasing: 'ease-in', standardDelayMs: 0,
  },
  {
    id: 'ANI-T-003', category: 'transition',
    standardDurationMs: 200, durationToleranceMs: 30,
    standardEasing: 'ease-in-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-T-004', category: 'transition',
    standardDurationMs: 500, durationToleranceMs: 80,
    standardEasing: 'ease', standardDelayMs: 0,
  },
  {
    id: 'ANI-T-005', category: 'transition',
    standardDurationMs: 250, durationToleranceMs: 40,
    standardEasing: 'spring(1,0.8)', standardDelayMs: 0,
  },
];

/** 状态变化动画规范 */
export const STATE_CHANGE_SPECS: AnimationSpec[] = [
  {
    id: 'ANI-S-001', category: 'state_change',
    standardDurationMs: 150, durationToleranceMs: 30,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-S-002', category: 'state_change',
    standardDurationMs: 80, durationToleranceMs: 20,
    standardEasing: 'ease-in', standardDelayMs: 0,
  },
  {
    id: 'ANI-S-003', category: 'state_change',
    standardDurationMs: 120, durationToleranceMs: 20,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-S-004', category: 'state_change',
    standardDurationMs: 200, durationToleranceMs: 30,
    standardEasing: 'ease-in-out', standardDelayMs: 0,
  },
];

/** 反馈动画规范 */
export const FEEDBACK_SPECS: AnimationSpec[] = [
  {
    id: 'ANI-F-001', category: 'feedback',
    standardDurationMs: 800, durationToleranceMs: 100,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-F-002', category: 'feedback',
    standardDurationMs: 1000, durationToleranceMs: 150,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-F-003', category: 'feedback',
    standardDurationMs: 2000, durationToleranceMs: 200,
    standardEasing: 'ease-in-out', standardDelayMs: 0,
  },
];

/** 入场动画规范 */
export const ENTRANCE_SPECS: AnimationSpec[] = [
  {
    id: 'ANI-E-001', category: 'entrance',
    standardDurationMs: 300, durationToleranceMs: 50,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
];

/** 退场动画规范 */
export const EXIT_SPECS: AnimationSpec[] = [
  {
    id: 'ANI-X-001', category: 'exit',
    standardDurationMs: 200, durationToleranceMs: 30,
    standardEasing: 'ease-in', standardDelayMs: 0,
  },
];

/** 所有默认动画规范 */
export const ALL_ANIMATION_SPECS: AnimationSpec[] = [
  ...TRANSITION_SPECS,
  ...STATE_CHANGE_SPECS,
  ...FEEDBACK_SPECS,
  ...ENTRANCE_SPECS,
  ...EXIT_SPECS,
];

// ─────────────────────────────────────────────
// 配色规范默认值
// ─────────────────────────────────────────────

/** 品质色 */
export const DEFAULT_QUALITY_COLORS: QualityColorDef[] = [
  { quality: 'COMMON', primaryColor: '#9E9E9E', borderColor: '#757575', backgroundColor: '#F5F5F5', textColor: '#424242' },
  { quality: 'FINE', primaryColor: '#4CAF50', borderColor: '#388E3C', backgroundColor: '#E8F5E9', textColor: '#1B5E20' },
  { quality: 'RARE', primaryColor: '#2196F3', borderColor: '#1565C0', backgroundColor: '#E3F2FD', textColor: '#0D47A1' },
  { quality: 'EPIC', primaryColor: '#9C27B0', borderColor: '#7B1FA2', backgroundColor: '#F3E5F5', textColor: '#4A148C' },
  { quality: 'LEGENDARY', primaryColor: '#FF9800', borderColor: '#E65100', backgroundColor: '#FFF3E0', textColor: '#BF360C' },
];

/** 阵营色 */
export const DEFAULT_FACTION_COLORS: FactionColorDef[] = [
  { faction: 'wei', primaryColor: '#1565C0', secondaryColor: '#42A5F5', backgroundColor: '#E3F2FD' },
  { faction: 'shu', primaryColor: '#2E7D32', secondaryColor: '#66BB6A', backgroundColor: '#E8F5E9' },
  { faction: 'wu', primaryColor: '#C62828', secondaryColor: '#EF5350', backgroundColor: '#FFEBEE' },
  { faction: 'neutral', primaryColor: '#616161', secondaryColor: '#9E9E9E', backgroundColor: '#F5F5F5' },
];

/** 功能色 */
export const DEFAULT_FUNCTIONAL_COLORS: FunctionalColorDef[] = [
  { name: 'confirm', description: '确认操作', standardColor: '#4CAF50', hueTolerance: 15 },
  { name: 'cancel', description: '取消操作', standardColor: '#F44336', hueTolerance: 15 },
  { name: 'warning', description: '警告提示', standardColor: '#FF9800', hueTolerance: 15 },
  { name: 'info', description: '信息提示', standardColor: '#2196F3', hueTolerance: 15 },
  { name: 'gold', description: '高级货币', standardColor: '#FFD700', hueTolerance: 10 },
];

/** 状态色 */
export const DEFAULT_STATUS_COLORS: StatusColorDef[] = [
  { status: 'online', standardColor: '#4CAF50', usage: '在线/正常/完成' },
  { status: 'offline', standardColor: '#9E9E9E', usage: '离线/未开始' },
  { status: 'busy', standardColor: '#FF9800', usage: '忙碌/进行中' },
  { status: 'error', standardColor: '#F44336', usage: '错误/失败' },
  { status: 'locked', standardColor: '#616161', usage: '锁定/不可用' },
];

// ─────────────────────────────────────────────
// 颜色工具函数
// ─────────────────────────────────────────────

/** 解析十六进制颜色为 RGB */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/** 计算两个颜色的色差（CIE76 简化版，归一化到 0~100） */
export function colorDifference(c1: string, c2: string): number {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  if (!rgb1 || !rgb2) return 100;

  const dr = rgb1.r - rgb2.r;
  const dg = rgb1.g - rgb2.g;
  const db = rgb1.b - rgb2.b;

  const distance = Math.sqrt(dr * dr + dg * dg + db * db);
  return Math.round((distance / 441.67) * 100); // 441.67 = sqrt(255^2 * 3)
}
