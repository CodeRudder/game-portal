/**
 * 消消乐（Match-3）游戏常量
 *
 * 包含画布尺寸、网格参数、宝石样式、动画时间、计分规则、关卡配置等所有常量。
 * 所有数值经过精心设计，确保 8×8 网格在 480×640 画布上完美居中显示。
 */

// ========== Canvas 尺寸 ==========

/** 画布宽度 */
export const CANVAS_WIDTH = 480;

/** 画布高度 */
export const CANVAS_HEIGHT = 640;

/** HUD 区域高度（顶部信息栏） */
export const HUD_HEIGHT = 40;

// ========== 网格参数 ==========

/** 网格行数 */
export const GRID_ROWS = 8;

/** 网格列数 */
export const GRID_COLS = 8;

/** 宝石种类数量（6 种颜色+形状） */
export const GEM_TYPE_COUNT = 6;

// ========== 渲染布局 ==========

/** 棋盘外边距 */
export const BOARD_PADDING = 16;

/** 宝石间距 */
export const GEM_GAP = 4;

/**
 * 单个宝石尺寸
 * 计算方式：(CANVAS_WIDTH - 2 * BOARD_PADDING - (GRID_COLS + 1) * GEM_GAP) / GRID_COLS
 * = (480 - 32 - 36) / 8 = 412 / 8 = 51.5 → 51
 */
export const GEM_SIZE = Math.floor(
  (CANVAS_WIDTH - 2 * BOARD_PADDING - (GRID_COLS + 1) * GEM_GAP) / GRID_COLS
);

/** 棋盘实际宽度 */
export const BOARD_WIDTH = GRID_COLS * GEM_SIZE + (GRID_COLS + 1) * GEM_GAP;

/** 棋盘实际高度 */
export const BOARD_HEIGHT = GRID_ROWS * GEM_SIZE + (GRID_ROWS + 1) * GEM_GAP;

/** 棋盘左侧 X 坐标（居中） */
export const BOARD_LEFT = Math.floor((CANVAS_WIDTH - BOARD_WIDTH) / 2);

/** 棋盘顶部 Y 坐标 */
export const BOARD_TOP = HUD_HEIGHT + 10;

/** 宝石圆角半径 */
export const GEM_RADIUS = 6;

// ========== 宝石颜色定义 ==========

/** 宝石主色 */
export const GEM_COLORS: readonly string[] = [
  '#FF4444', // 红色 - 类型 0
  '#44AAFF', // 蓝色 - 类型 1
  '#44CC44', // 绿色 - 类型 2
  '#FFAA00', // 橙色 - 类型 3
  '#CC44FF', // 紫色 - 类型 4
  '#FFDD44', // 黄色 - 类型 5
];

/** 宝石高亮色（选中状态） */
export const GEM_HIGHLIGHT_COLORS: readonly string[] = [
  '#FF8888', // 浅红
  '#88CCFF', // 浅蓝
  '#88EE88', // 浅绿
  '#FFCC44', // 浅橙
  '#DD88FF', // 浅紫
  '#FFEE88', // 浅黄
];

/** 宝石形状（色盲友好区分） */
export type GemShape = 'circle' | 'diamond' | 'square' | 'triangle' | 'star' | 'hexagon';

/** 宝石形状列表 */
export const GEM_SHAPES: readonly GemShape[] = [
  'circle',   // 类型 0
  'diamond',  // 类型 1
  'square',   // 类型 2
  'triangle', // 类型 3
  'star',     // 类型 4
  'hexagon',  // 类型 5
];

// ========== 动画参数 ==========

/** 交换动画时长（毫秒） */
export const SWAP_ANIMATION_MS = 200;

/** 消除闪烁动画时长（毫秒） */
export const REMOVE_ANIMATION_MS = 300;

/** 下落动画速度（像素/秒） */
export const FALL_SPEED = 600;

// ========== 计分参数 ==========

/** 三消得分 */
export const SCORE_MATCH3 = 100;

/** 四消得分 */
export const SCORE_MATCH4 = 200;

/** 五消得分 */
export const SCORE_MATCH5 = 500;

/** L 形 / T 形额外奖励分 */
export const SCORE_SPECIAL_SHAPE = 150;

/** 连击倍率基础值 */
export const COMBO_MULTIPLIER_BASE = 1.0;

/** 连击倍率每次递增值 */
export const COMBO_MULTIPLIER_INCREMENT = 0.5;

// ========== 关卡参数 ==========

/** 各关卡目标分数 */
export const LEVEL_TARGETS: readonly number[] = [
  1000,   // 第 1 关
  2500,   // 第 2 关
  4500,   // 第 3 关
  7000,   // 第 4 关
  10000,  // 第 5 关
  14000,  // 第 6 关
  19000,  // 第 7 关
  25000,  // 第 8 关
  32000,  // 第 9 关
  40000,  // 第 10 关
];

/** 每关时间限制（秒） */
export const TIME_PER_LEVEL = 120;

// ========== UI 颜色 ==========

/** 棋盘背景色 */
export const BOARD_BG_COLOR = '#2a2a3e';

/** HUD 背景色 */
export const HUD_BG_COLOR = '#1e1e30';

/** 空格背景色 */
export const EMPTY_CELL_COLOR = '#3a3a5e';

/** 选中框颜色 */
export const SELECTION_COLOR = '#FFFFFF';

/** 选中框线宽 */
export const SELECTION_BORDER_WIDTH = 3;

/** 光标颜色 */
export const CURSOR_COLOR = 'rgba(255, 255, 255, 0.5)';

/** 光标线宽 */
export const CURSOR_BORDER_WIDTH = 2;

/** 文字颜色 */
export const TEXT_COLOR = '#FFFFFF';

/** 次要文字颜色 */
export const TEXT_SECONDARY_COLOR = '#AAAACC';

/** 字体 */
export const FONT_FAMILY = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
