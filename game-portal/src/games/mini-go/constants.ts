// ========== Mini Go 9×9 游戏常量 ==========

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** HUD 区域高度 */
export const HUD_HEIGHT = 80;

/** 棋盘参数 */
export const BOARD_SIZE = 9;
export const CELL_SIZE = 48;
export const BOARD_PADDING = 24;
export const BOARD_OFFSET_X = (CANVAS_WIDTH - CELL_SIZE * (BOARD_SIZE - 1)) / 2;
export const BOARD_OFFSET_Y = HUD_HEIGHT + 20;

/** 棋子类型 */
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

/** 星位坐标 (0-indexed) */
export const STAR_POINTS: [number, number][] = [
  [2, 2], [2, 6],
  [4, 4],
  [6, 2], [6, 6],
];

/** 四个方向 (上、下、左、右) */
export const DIRECTIONS: [number, number][] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

/** 颜色 */
export const BG_COLOR = '#1a1a2e';
export const BOARD_COLOR = '#DCB35C';
export const BOARD_BORDER_COLOR = '#8B6914';
export const GRID_COLOR = '#5C4A1E';
export const BLACK_STONE_COLOR = '#1a1a1a';
export const WHITE_STONE_COLOR = '#f0f0f0';
export const CURSOR_COLOR = 'rgba(255, 80, 80, 0.7)';
export const TERRITORY_BLACK_COLOR = 'rgba(0, 0, 0, 0.3)';
export const TERRITORY_WHITE_COLOR = 'rgba(255, 255, 255, 0.3)';
export const LAST_MOVE_MARKER_COLOR = '#ff4757';
export const TEXT_COLOR = '#ffffff';
export const SCORE_TEXT_COLOR = '#00ff88';

/** 领地类型 */
export const TERRITORY_NONE = 0;
export const TERRITORY_BLACK = 1;
export const TERRITORY_WHITE = 2;

/** 贴目 (中国规则 9×9 通常贴 5.5 目) */
export const KOMI = 5.5;
