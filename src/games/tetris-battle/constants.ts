/**
 * Tetris Battle 游戏常量定义
 *
 * 包含画布尺寸、棋盘参数、方块定义、颜色、速度、
 * 攻击映射、AI 参数和控制键映射等所有游戏配置。
 *
 * @module tetris-battle/constants
 */

// ==================== 画布尺寸 ====================

/** 画布宽度（像素） */
export const CANVAS_WIDTH = 480;
/** 画布高度（像素） */
export const CANVAS_HEIGHT = 640;

// ==================== 棋盘参数 ====================

/** 棋盘列数 */
export const COLS = 10;
/** 棋盘行数 */
export const ROWS = 20;
/** 每格单元格大小（像素） */
export const CELL_SIZE = 14;

// ==================== 布局参数 ====================

/** 棋盘水平边距 */
export const BOARD_MARGIN_X = 20;
/** 棋盘垂直边距（顶部） */
export const BOARD_MARGIN_Y = 60;
/** 两个棋盘之间的间距 */
export const BOARD_GAP = 40;

/** 玩家1棋盘左上角 X 坐标 */
export const BOARD1_OFFSET_X = BOARD_MARGIN_X;
/** 玩家2棋盘左上角 X 坐标 */
export const BOARD2_OFFSET_X = BOARD_MARGIN_X + COLS * CELL_SIZE + BOARD_GAP;
/** 棋盘左上角 Y 坐标（两个棋盘相同） */
export const BOARD_OFFSET_Y = BOARD_MARGIN_Y;

/** 预览区域宽度（像素） */
export const PREVIEW_WIDTH = 80;
/** 预览区域高度（像素） */
export const PREVIEW_HEIGHT = 60;

// ==================== 方块定义 ====================

/**
 * 7 种标准俄罗斯方块形状
 *
 * 索引顺序: I(0), O(1), T(2), S(3), Z(4), J(5), L(6)
 * 每种方块用二维矩阵表示，1 表示有方块，0 表示空。
 */
export const TETROMINO_SHAPES: number[][][] = [
  // I - 长条（4×4 矩阵）
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // O - 方块（2×2 矩阵）
  [
    [1, 1],
    [1, 1],
  ],
  // T - T 形（3×3 矩阵）
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  // S - S 形（3×3 矩阵）
  [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  // Z - Z 形（3×3 矩阵）
  [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  // J - J 形（3×3 矩阵）
  [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  // L - L 形（3×3 矩阵）
  [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
];

/** 方块类型数量（固定为 7） */
export const TETROMINO_COUNT = TETROMINO_SHAPES.length;

/**
 * 方块颜色（与 TETROMINO_SHAPES 索引对应）
 *
 * 索引 0=I, 1=O, 2=T, 3=S, 4=Z, 5=J, 6=L
 */
export const TETROMINO_COLORS: string[] = [
  '#00f3ff', // I - 青色
  '#ffd700', // O - 金色
  '#a855f7', // T - 紫色
  '#00b894', // S - 绿色
  '#e17055', // Z - 红色
  '#3b82f6', // J - 蓝色
  '#fd79a8', // L - 粉色
];

/**
 * 幽灵方块颜色（半透明版本，用于投影显示）
 */
export const GHOST_COLORS: string[] = [
  'rgba(0,243,255,0.15)',   // I
  'rgba(255,215,0,0.15)',   // O
  'rgba(168,85,247,0.15)',  // T
  'rgba(0,184,148,0.15)',   // S
  'rgba(225,112,85,0.15)',  // Z
  'rgba(59,130,246,0.15)',  // J
  'rgba(253,121,168,0.15)', // L
];

/** 垃圾行颜色（灰色） */
export const GARBAGE_COLOR = '#636e72';

/** 空格标识（棋盘上无方块） */
export const EMPTY_CELL = 0;

/** 垃圾行标识（棋盘上的垃圾行方块类型索引，值为 8） */
export const GARBAGE_CELL = 8;

// ==================== 速度参数 ====================

/** 初始下落间隔（毫秒） */
export const INITIAL_DROP_INTERVAL = 1000;
/** 最小下落间隔（毫秒） */
export const MIN_DROP_INTERVAL = 100;
/** 每级减少的下落间隔（毫秒） */
export const DROP_INTERVAL_DECREASE = 80;

/** 软降加速因子（除以该值加速下落） */
export const SOFT_DROP_FACTOR = 20;

// ==================== 攻击系统 ====================

/**
 * 消行数 → 攻击行数映射
 *
 * - 消 1 行 = 0 攻击行（无攻击）
 * - 消 2 行 = 1 攻击行
 * - 消 3 行 = 2 攻击行
 * - 消 4 行（Tetris）= 4 攻击行
 */
export const ATTACK_TABLE: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 4,
};

/**
 * 消行计分表
 *
 * 索引 0=无, 1=单行, 2=双行, 3=三行, 4=四行
 * 实际得分 = SCORE_TABLE[消行数] × 当前等级
 */
export const SCORE_TABLE: number[] = [0, 100, 300, 500, 800];

/** 攻击得分（每发送一行垃圾行额外得分） */
export const ATTACK_SCORE_PER_LINE = 50;

// ==================== AI 参数 ====================

/** AI 简单难度决策间隔（毫秒） */
export const AI_EASY_INTERVAL = 1500;
/** AI 中等难度决策间隔（毫秒） */
export const AI_MEDIUM_INTERVAL = 800;

/**
 * AI 评估权重 - 中等难度
 *
 * 用于启发式评估函数，计算最优放置位置。
 * 正值表示奖励，负值表示惩罚。
 */
export const AI_WEIGHTS = {
  /** 高度惩罚权重（越高越差） */
  height: -0.51,
  /** 空洞惩罚权重（空洞越多越差） */
  holes: -7.6,
  /** 消行奖励权重（消行越多越好） */
  linesCleared: 8.0,
  /** 凹凸度惩罚权重（表面越不平整越差） */
  bumpiness: -0.36,
  /** 聚合高度惩罚权重 */
  aggregateHeight: -0.1,
} as const;

/** AI 随机操作概率（简单难度下有一定概率随机选择） */
export const AI_EASY_RANDOM_CHANCE = 0.3;

// ==================== 控制键映射 ====================

/**
 * 玩家1控制键（WASD + 空格）
 */
export const PLAYER1_KEYS = {
  /** 左移 */
  left: 'a',
  /** 右移 */
  right: 'd',
  /** 软降 */
  down: 's',
  /** 旋转 */
  rotate: 'w',
  /** 硬降 */
  hardDrop: ' ',
} as const;

/**
 * 玩家2控制键（方向键 + Enter）
 * 用于双人模式（可选）
 */
export const PLAYER2_KEYS = {
  /** 左移 */
  left: 'ArrowLeft',
  /** 右移 */
  right: 'ArrowRight',
  /** 软降 */
  down: 'ArrowDown',
  /** 旋转 */
  rotate: 'ArrowUp',
  /** 硬降 */
  hardDrop: 'Enter',
} as const;

// ==================== 方向常量 ====================

/** 左移方向 */
export const DIR_LEFT = -1;
/** 右移方向 */
export const DIR_RIGHT = 1;

// ==================== 等级系统 ====================

/** 每级所需消行数 */
export const LINES_PER_LEVEL = 10;

// ==================== 方块类型索引常量 ====================

/** I 方块类型索引 */
export const PIECE_I = 0;
/** O 方块类型索引 */
export const PIECE_O = 1;
/** T 方块类型索引 */
export const PIECE_T = 2;
/** S 方块类型索引 */
export const PIECE_S = 3;
/** Z 方块类型索引 */
export const PIECE_Z = 4;
/** J 方块类型索引 */
export const PIECE_J = 5;
/** L 方块类型索引 */
export const PIECE_L = 6;
