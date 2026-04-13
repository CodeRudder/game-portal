// ========== Bubble Shooter 泡泡龙常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 泡泡参数
export const BUBBLE_RADIUS = 18;
export const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;

// 网格参数
export const COLS = 13; // 偶数行列数
export const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3); // ≈ 31.18
export const INITIAL_ROWS = 7; // 初始预填行数

// 发射器参数
export const SHOOTER_X = CANVAS_WIDTH / 2;
export const SHOOTER_Y = CANVAS_HEIGHT - 40;
export const SHOOTER_SPEED = 12; // 像素/帧
export const AIM_SPEED = 0.03; // 弧度/帧
export const MIN_ANGLE = -Math.PI + 0.15; // 接近水平左
export const MAX_ANGLE = -0.15; // 接近水平右

// 游戏线
export const DEAD_LINE_Y = CANVAS_HEIGHT - 80; // 泡泡堆到此线则 gameover

// 颜色
export const BUBBLE_COLORS = [
  '#ef5350', // 红
  '#42a5f5', // 蓝
  '#66bb6a', // 绿
  '#fdd835', // 黄
  '#ab47bc', // 紫
  '#ff7043', // 橙
  '#26c6da', // 青
  '#ec407a', // 粉
] as const;

export type BubbleColorIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// 等级 → 可用颜色数量
export function getColorsForLevel(level: number): number {
  return Math.min(3 + level, BUBBLE_COLORS.length);
}

// 得分
export const POP_SCORE = 10; // 每个消除泡泡
export const DROP_SCORE = 15; // 每个掉落泡泡（额外加分）
export const MIN_MATCH = 3; // 最少消除数

// 颜色
export const BG_COLOR = '#0d1b2a';
export const SHOOTER_COLOR = '#e0e0e0';
export const DEAD_LINE_COLOR = 'rgba(239, 83, 80, 0.4)';
