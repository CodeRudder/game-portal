// ========== 扫雷游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// HUD 区域高度
export const HUD_HEIGHT = 50;

// ========== 难度配置 ==========
export interface DifficultyConfig {
  rows: number;
  cols: number;
  mines: number;
  level: number;
  label: string;
}

export const DIFFICULTIES: Record<string, DifficultyConfig> = {
  beginner: { rows: 9, cols: 9, mines: 10, level: 1, label: '初级' },
  intermediate: { rows: 16, cols: 16, mines: 40, level: 2, label: '中级' },
  expert: { rows: 16, cols: 30, mines: 99, level: 3, label: '高级' },
};

export type DifficultyKey = keyof typeof DIFFICULTIES;

// ========== 格子状态 ==========
export enum CellState {
  HIDDEN = 'hidden',
  REVEALED = 'revealed',
  FLAGGED = 'flagged',
}

// ========== 颜色 ==========
export const COLORS = {
  // 背景
  BG: '#1a1a2e',
  HUD_BG: '#16213e',
  HUD_TEXT: '#e0e0e0',
  HUD_ACCENT: '#00b4d8',

  // 格子
  HIDDEN_FILL: '#4a5568',
  HIDDEN_LIGHT: '#718096',
  HIDDEN_DARK: '#2d3748',
  REVEALED_FILL: '#2a2a3e',
  REVEALED_BORDER: '#3a3a5e',

  // 数字颜色（1-8）
  NUM_COLORS: [
    '',        // 0 不显示
    '#3b82f6', // 1 蓝
    '#22c55e', // 2 绿
    '#ef4444', // 3 红
    '#1e3a8a', // 4 深蓝
    '#991b1b', // 5 深红
    '#06b6d4', // 6 青
    '#1f2937', // 7 黑
    '#6b7280', // 8 灰
  ],

  // 旗帜
  FLAG_RED: '#ef4444',
  FLAG_POLE: '#d4d4d8',

  // 地雷
  MINE_BODY: '#1f2937',
  MINE_SPIKE: '#374151',
  MINE_BG: '#dc2626',

  // 光标
  CURSOR_COLOR: '#00b4d8',

  // 表情按钮
  FACE_SMILE: '😊',
  FACE_DEAD: '😵',
  FACE_COOL: '😎',
  FACE_SURPRISE: '😮',
};

// ========== 计分 ==========
export const SCORE_PER_CELL = 10;        // 每揭开一个安全格得 10 分
export const WIN_BONUS_BEGINNER = 100;    // 初级胜利奖励
export const WIN_BONUS_INTERMEDIATE = 300; // 中级胜利奖励
export const WIN_BONUS_EXPERT = 500;      // 高级胜利奖励
export const TIME_BONUS_FACTOR = 2;       // 时间奖励系数（越快奖励越高）

// ========== 格子边距 ==========
export const GRID_PADDING = 10;
