// ========== Checkers 跳棋常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 480;
export const HUD_HEIGHT = 40;

// 棋盘
export const BOARD_SIZE = 8;
export const CELL_SIZE = Math.floor((CANVAS_WIDTH - 40) / BOARD_SIZE);
export const BOARD_OFFSET_X = Math.floor((CANVAS_WIDTH - CELL_SIZE * BOARD_SIZE) / 2);
export const BOARD_OFFSET_Y = HUD_HEIGHT + Math.floor((CANVAS_HEIGHT - HUD_HEIGHT - CELL_SIZE * BOARD_SIZE) / 2);

// 棋子类型
export const EMPTY = 0;
export const RED = 1;       // 红方（玩家）— 向上移动
export const BLACK = 2;     // 黑方（AI）— 向下移动
export const RED_KING = 3;
export const BLACK_KING = 4;

// 方向
export const RED_DIRECTIONS = [[-1, -1], [-1, 1]];       // 红方向上
export const BLACK_DIRECTIONS = [[1, -1], [1, 1]];       // 黑方向下
export const ALL_DIRECTIONS = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // 王可四方向

// 颜色
export const BG_COLOR = '#0a0a2e';
export const LIGHT_CELL_COLOR = '#e8d5b5';
export const DARK_CELL_COLOR = '#8b6914';
export const RED_COLOR = '#dc2626';
export const RED_KING_COLOR = '#b91c1c';
export const BLACK_COLOR = '#1e293b';
export const BLACK_KING_COLOR = '#0f172a';
export const SELECTED_COLOR = 'rgba(250, 204, 21, 0.5)';
export const VALID_MOVE_COLOR = 'rgba(34, 197, 94, 0.4)';
export const CAPTURE_MOVE_COLOR = 'rgba(239, 68, 68, 0.4)';
export const KING_CROWN_COLOR = '#fbbf24';

// AI
export const AI_THINK_TIME = 400; // ms
