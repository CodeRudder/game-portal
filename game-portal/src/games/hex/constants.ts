/**
 * 六角棋 (Hex) 游戏常量
 * 11×11 六角形棋盘，红蓝双方各连接对边
 */

// ========== 棋盘尺寸 ==========
/** 棋盘边长（标准 11×11） */
export const BOARD_SIZE = 11;

// ========== Canvas 尺寸 ==========
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 格子状态 ==========
/** 空格 */
export const CELL_EMPTY = 0;
/** 红方（玩家1） */
export const CELL_RED = 1;
/** 蓝方（玩家2 / AI） */
export const CELL_BLUE = 2;

// ========== 玩家 ==========
export const PLAYER_RED = 1;
export const PLAYER_BLUE = 2;

// ========== 颜色 ==========
export const COLOR_RED = '#e74c3c';
export const COLOR_RED_LIGHT = '#ff6b6b';
export const COLOR_RED_DARK = '#c0392b';
export const COLOR_BLUE = '#3498db';
export const COLOR_BLUE_LIGHT = '#5dade2';
export const COLOR_BLUE_DARK = '#2980b9';
export const COLOR_BOARD_BG = '#1a1a2e';
export const COLOR_CELL_EMPTY = '#2d2d44';
export const COLOR_CELL_BORDER = '#4a4a6a';
export const COLOR_CURSOR = '#f1c40f';
export const COLOR_TEXT = '#ecf0f1';
export const COLOR_TEXT_DIM = '#95a5a6';

// ========== 六角形尺寸 ==========
/** 六角形半径（中心到顶点） */
export const HEX_RADIUS = 20;
/** 六角形间距 */
export const HEX_GAP = 2;

// ========== 布局偏移 ==========
/** 棋盘左上角偏移 X */
export const BOARD_OFFSET_X = 55;
/** 棋盘左上角偏移 Y */
export const BOARD_OFFSET_Y = 80;

// ========== 分数 ==========
export const SCORE_WIN = 100;
export const SCORE_LOSE = 0;
export const SCORE_DRAW = 50;

// ========== AI ==========
/** AI 思考延迟（ms） */
export const AI_THINK_DELAY = 300;

// ========== 游戏模式 ==========
export const MODE_PVP = 'pvp';
export const MODE_PVE = 'pve';

// ========== 键盘映射 ==========
export const KEY_UP = 'ArrowUp';
export const KEY_DOWN = 'ArrowDown';
export const KEY_LEFT = 'ArrowLeft';
export const KEY_RIGHT = 'ArrowRight';
export const KEY_SPACE = ' ';
export const KEY_SWAP = 's';
export const KEY_SWAP_UPPER = 'S';

// ========== 六角网格邻居偏移（pointy-top, odd-r offset）==========
/**
 * 偶数行邻居: (-1,-1), (0,-1), (-1,0), (1,0), (-1,1), (0,1)
 * 奇数行邻居: (0,-1), (1,-1), (-1,0), (1,0), (0,1), (1,1)
 */
export const HEX_NEIGHBORS_EVEN: [number, number][] = [
  [-1, -1], [0, -1],   // 上左, 上右
  [-1, 0],  [1, 0],    // 左, 右
  [-1, 1],  [0, 1],    // 下左, 下右
];

export const HEX_NEIGHBORS_ODD: [number, number][] = [
  [0, -1], [1, -1],    // 上左, 上右
  [-1, 0], [1, 0],     // 左, 右
  [0, 1],  [1, 1],     // 下左, 下右
];

// ========== 六角方向键移动偏移 ==========
/**
 * 方向键在六角网格中的移动映射
 * 上: 向上移动（减小 row）
 * 下: 向下移动（增大 row）
 * 左: 向左移动（减小 col）
 * 右: 向右移动（增大 col）
 */
