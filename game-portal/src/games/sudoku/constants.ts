// ========== Sudoku 数独常量 ==========

/** 画布尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** HUD 高度（顶部信息栏） */
export const HUD_HEIGHT = 40;

/** 网格参数 */
export const GRID_SIZE = 9;
export const BOX_SIZE = 3; // 宫格 3×3

/** 网格区域起始 Y 坐标 */
export const GRID_OFFSET_Y = HUD_HEIGHT + 20;

/** 网格区域水平边距 */
export const GRID_PADDING = 20;

/** 网格宽度 = 画布宽度 - 2 × 边距 */
export const GRID_WIDTH = CANVAS_WIDTH - 2 * GRID_PADDING;

/** 每格尺寸 */
export const CELL_SIZE = GRID_WIDTH / GRID_SIZE;

/** 有效数字范围 */
export const MIN_NUMBER = 1;
export const MAX_NUMBER = 9;
export const EMPTY_CELL = 0;

/** 数字集合 */
export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

// ========== 难度配置 ==========
export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

/** 各难度挖洞数量 */
export const DIFFICULTY_HOLES: Record<Difficulty, number> = {
  [Difficulty.EASY]: 30,
  [Difficulty.MEDIUM]: 40,
  [Difficulty.HARD]: 50,
};

/** 各难度对应等级 */
export const DIFFICULTY_LEVEL: Record<Difficulty, number> = {
  [Difficulty.EASY]: 1,
  [Difficulty.MEDIUM]: 2,
  [Difficulty.HARD]: 3,
};

// ========== 颜色配置 ==========

/** 背景色 */
export const BG_COLOR = '#f5f5f5';

/** 网格线颜色（细线） */
export const GRID_LINE_COLOR = '#cccccc';

/** 宫格线颜色（粗线） */
export const BOX_LINE_COLOR = '#333333';

/** 固定数字颜色 */
export const FIXED_NUMBER_COLOR = '#333333';

/** 用户输入数字颜色 */
export const USER_NUMBER_COLOR = '#1565c0';

/** 错误数字颜色 */
export const ERROR_NUMBER_COLOR = '#e53935';

/** 选中格子背景色 */
export const SELECTED_CELL_BG = '#bbdefb';

/** 高亮同行/列/宫背景色 */
export const HIGHLIGHT_CELL_BG = '#e3f2fd';

/** 相同数字高亮背景色 */
export const SAME_NUMBER_BG = '#c8e6c9';

/** 候选数文字颜色 */
export const NOTE_TEXT_COLOR = '#888888';

/** HUD 文字颜色 */
export const HUD_TEXT_COLOR = '#333333';

/** 错误格子背景色 */
export const ERROR_CELL_BG = '#ffcdd2';

// ========== 粗线宽度 ==========
export const THIN_LINE_WIDTH = 1;
export const THICK_LINE_WIDTH = 3;

// ========== 候选数标注样式 ==========
export const NOTE_FONT_SIZE = 10;
export const NUMBER_FONT_SIZE = 22;
export const HUD_FONT_SIZE = 14;

// ========== 计分配置 ==========
/** 填对一个数字的基础得分 */
export const CORRECT_FILL_SCORE = 10;
/** 使用提示扣分 */
export const HINT_PENALTY = 20;
/** 完成奖励基础分 */
export const COMPLETION_BONUS = 100;
/** 时间奖励系数（越快越多） */
export const TIME_BONUS_FACTOR = 5;
/** 时间奖励上限（秒） */
export const TIME_BONUS_MAX_SECONDS = 600;

// ========== 唯一解验证最大尝试次数 ==========
export const MAX_SOLUTION_CHECK_LIMIT = 2;
