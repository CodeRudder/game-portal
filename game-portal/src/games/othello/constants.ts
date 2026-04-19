// ========== Othello 黑白棋常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 480;
export const HUD_HEIGHT = 40;

// 棋盘
export const BOARD_SIZE = 8;
export const CELL_SIZE = Math.floor((CANVAS_WIDTH - 40) / BOARD_SIZE);
export const BOARD_OFFSET_X = Math.floor((CANVAS_WIDTH - CELL_SIZE * BOARD_SIZE) / 2);
export const BOARD_OFFSET_Y = HUD_HEIGHT + Math.floor((CANVAS_HEIGHT - HUD_HEIGHT - CELL_SIZE * BOARD_SIZE) / 2);

// 棋子
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

// 方向（8方向）
export const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

// 颜色
export const BG_COLOR = '#0a0a2e';
export const BOARD_COLOR = '#166534';
export const GRID_COLOR = '#15803d';
export const BLACK_COLOR = '#1e293b';
export const WHITE_COLOR = '#f1f5f9';
export const HINT_COLOR = 'rgba(250, 204, 21, 0.3)';

// AI
export const AI_THINK_TIME = 500; // ms

// 棋盘权重（用于 AI 评估）
export const POSITION_WEIGHTS = [
  [100, -20, 10, 5, 5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [10, -2, 1, 1, 1, 1, -2, 10],
  [5, -2, 1, 0, 0, 1, -2, 5],
  [5, -2, 1, 0, 0, 1, -2, 5],
  [10, -2, 1, 1, 1, 1, -2, 10],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [100, -20, 10, 5, 5, 10, -20, 100],
];
