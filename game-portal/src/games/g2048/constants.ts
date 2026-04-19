// ========== 2048 游戏常量 ==========

// Canvas 尺寸（与 GameContainer 统一）
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 网格参数
export const GRID_SIZE = 4; // 4×4 网格
export const INITIAL_TILES = 2; // 初始方块数量

// 新方块生成概率
export const TILE_2_CHANCE = 0.9; // 90% 概率生成 2
export const TILE_4_CHANCE = 0.1; // 10% 概率生成 4

// 胜利目标
export const WIN_TILE = 2048;

// ========== 渲染参数 ==========

// 棋盘布局
export const BOARD_PADDING = 12; // 棋盘内边距
export const GAP = 10; // 方块间距
export const BOARD_MARGIN_TOP = 80; // 棋盘顶部留白（给标题/分数区域）

// 根据画布宽度计算方块大小
// 棋盘宽度 = CANVAS_WIDTH - 2 * BOARD_PADDING
// 方块大小 = (棋盘宽度 - (GRID_SIZE+1) * GAP) / GRID_SIZE
export const BOARD_WIDTH = CANVAS_WIDTH - 2 * BOARD_PADDING;
export const CELL_SIZE = (BOARD_WIDTH - (GRID_SIZE + 1) * GAP) / GRID_SIZE;

// 圆角半径
export const BOARD_RADIUS = 8; // 棋盘圆角
export const CELL_RADIUS = 6; // 方块圆角
export const EMPTY_CELL_RADIUS = 4; // 空位圆角

// 字体
export const TILE_FONT_FAMILY = '"Clear Sans", "Helvetica Neue", Arial, sans-serif';

// ========== 动画参数 ==========
export const SLIDE_ANIMATION_MS = 120; // 滑动动画时长（毫秒）
export const MERGE_ANIMATION_MS = 150; // 合并动画时长
export const NEW_TILE_ANIMATION_MS = 100; // 新方块出现动画时长

// ========== 颜色映射 ==========

/** 棋盘背景色（经典 2048） */
export const BOARD_BG_COLOR = '#bbada0';

/** 空格占位色 */
export const EMPTY_CELL_COLOR = '#cdc1b4';

/** 方块颜色映射：数值 → { 背景, 文字 } */
export const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  2:    { bg: '#eee4da', text: '#776e65' },
  4:    { bg: '#ede0c8', text: '#776e65' },
  8:    { bg: '#f2b179', text: '#f9f6f2' },
  16:   { bg: '#f59563', text: '#f9f6f2' },
  32:   { bg: '#f67c5f', text: '#f9f6f2' },
  64:   { bg: '#f65e3b', text: '#f9f6f2' },
  128:  { bg: '#edcf72', text: '#f9f6f2' },
  256:  { bg: '#edcc61', text: '#f9f6f2' },
  512:  { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
};

/** 超过 2048 的方块默认颜色 */
export const SUPER_TILE_COLOR = { bg: '#3c3a32', text: '#f9f6f2' };

/** 标题区域背景色 */
export const HEADER_BG_COLOR = '#faf8ef';

/** 标题文字色 */
export const TITLE_COLOR = '#776e65';

/** 分数文字色 */
export const SCORE_LABEL_COLOR = '#bbada0';
export const SCORE_VALUE_COLOR = '#776e65';
