// ========== Chinese Chess 中国象棋常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 棋盘尺寸：9列10行
export const COLS = 9;
export const ROWS = 10;

// 格子大小与边距
export const CELL_SIZE = 56;
export const BOARD_PADDING_X = Math.floor((CANVAS_WIDTH - (COLS - 1) * CELL_SIZE) / 2); // 32
export const BOARD_PADDING_Y = 32;

// 棋子类型枚举
export const PIECE_NONE = 0;
export const PIECE_KING = 1;      // 将/帅
export const PIECE_ADVISOR = 2;   // 士/仕
export const PIECE_BISHOP = 3;    // 象/相
export const PIECE_KNIGHT = 4;    // 马
export const PIECE_ROOK = 5;      // 车
export const PIECE_CANNON = 6;    // 炮
export const PIECE_PAWN = 7;      // 兵/卒

// 玩家方
export const RED = 1;    // 红方（下方）
export const BLACK = 2;  // 黑方（上方）

// 九宫格范围
export const RED_PALACE = { minCol: 3, maxCol: 5, minRow: 7, maxRow: 9 };
export const BLACK_PALACE = { minCol: 3, maxCol: 5, minRow: 0, maxRow: 2 };

// 河界行
export const RIVER_TOP = 4;    // 黑方河岸
export const RIVER_BOTTOM = 5; // 红方河岸

// 棋子中文名
export const PIECE_NAMES_RED: Record<number, string> = {
  [PIECE_KING]: '帅',
  [PIECE_ADVISOR]: '仕',
  [PIECE_BISHOP]: '相',
  [PIECE_KNIGHT]: '馬',
  [PIECE_ROOK]: '車',
  [PIECE_CANNON]: '炮',
  [PIECE_PAWN]: '兵',
};

export const PIECE_NAMES_BLACK: Record<number, string> = {
  [PIECE_KING]: '将',
  [PIECE_ADVISOR]: '士',
  [PIECE_BISHOP]: '象',
  [PIECE_KNIGHT]: '馬',
  [PIECE_ROOK]: '車',
  [PIECE_CANNON]: '砲',
  [PIECE_PAWN]: '卒',
};

// 棋子分值（用于 AI 评估）
export const PIECE_VALUES: Record<number, number> = {
  [PIECE_KING]: 10000,
  [PIECE_ROOK]: 600,
  [PIECE_CANNON]: 300,
  [PIECE_KNIGHT]: 270,
  [PIECE_BISHOP]: 120,
  [PIECE_ADVISOR]: 120,
  [PIECE_PAWN]: 30, // 过河兵会加分
};

// 颜色
export const BG_COLOR = '#f0d9b5';
export const BOARD_LINE_COLOR = '#4a3520';
export const RIVER_COLOR = '#f0d9b5';
export const RIVER_TEXT_COLOR = '#4a3520';
export const RED_PIECE_COLOR = '#c0392b';
export const RED_PIECE_BG = '#f5e6cc';
export const BLACK_PIECE_COLOR = '#1a1a2e';
export const BLACK_PIECE_BG = '#f5e6cc';
export const SELECTED_COLOR = 'rgba(46, 204, 113, 0.6)';
export const VALID_MOVE_COLOR = 'rgba(52, 152, 219, 0.5)';
export const CURSOR_COLOR = 'rgba(241, 196, 15, 0.5)';
export const CHECK_COLOR = 'rgba(231, 76, 60, 0.4)';
export const LAST_MOVE_COLOR = 'rgba(241, 196, 15, 0.3)';

// 棋子半径
export const PIECE_RADIUS = 24;

// AI
export const AI_THINK_TIME = 300; // ms

// 光标移动速度
export const CURSOR_MOVE_DELAY = 120; // ms
