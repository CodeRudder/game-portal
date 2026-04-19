// ========== Conway's Game of Life 常量配置 ==========

// ========== 网格配置 ==========

/** 每个细胞像素大小 */
export const CELL_SIZE = 10;

/** 细胞间距（像素） */
export const CELL_GAP = 1;

/** 网格列数 */
export const GRID_COLS = 48;

/** 网格行数 */
export const GRID_ROWS = 58;

/** 网格 X 偏移（像素） */
export const GRID_OFFSET_X = 0;

/** 网格 Y 偏移（像素），无 HUD 时从顶部开始 */
export const GRID_OFFSET_Y = 0;

// ========== 速度配置（毫秒） ==========

/** 各等级对应的 tick 间隔（毫秒） */
export const TICK_INTERVALS: Record<number, number> = {
  1: 300,   // Level 1: 慢速
  2: 200,   // Level 2: 中速
  3: 100,   // Level 3: 快速
  4: 50,    // Level 4: 极速
  5: 20,    // Level 5: 超极速
};

/** 默认 tick 间隔 */
export const DEFAULT_TICK_INTERVAL = 200;

// ========== 画布尺寸 ==========

/** 画布宽度 */
export const CANVAS_WIDTH = 480;

/** 画布高度 */
export const CANVAS_HEIGHT = 640;

// ========== 颜色配置 ==========

/** 游戏中使用的所有颜色 */
export const COLORS = {
  /** 背景 */
  background: '#0d0d20',
  /** 网格线 */
  gridLine: 'rgba(255, 255, 255, 0.03)',
  /** 存活细胞 */
  cellAlive: '#00ff88',
  /** 存活细胞发光 */
  cellAliveGlow: 'rgba(0, 255, 136, 0.3)',
  /** 死亡细胞 */
  cellDead: 'rgba(255, 255, 255, 0.02)',
  /** 鼠标悬停细胞 */
  cellHover: 'rgba(0, 255, 136, 0.15)',
  /** 键盘光标填充 */
  cursor: 'rgba(0, 255, 136, 0.4)',
  /** 键盘光标边框 */
  cursorBorder: '#00ff88',
  /** 主文本颜色 */
  textPrimary: '#e2e8f0',
  /** 次要文本颜色 */
  textSecondary: '#94a3b8',
  /** 弱化文本颜色 */
  textMuted: '#64748b',
  /** 强调色 */
  accent: '#00ff88',
  /** HUD 背景 */
  hudBg: 'rgba(15, 14, 23, 0.85)',
  /** 代数文本颜色 */
  generationText: '#00ff88',
  /** 存活数文本颜色 */
  populationText: '#38bdf8',
};

// ========== HUD 配置 ==========

/** HUD 高度（像素） */
export const HUD_HEIGHT = 40;

/** 字体族 */
export const FONT_FAMILY = "'Courier New', monospace";

/** HUD 字号 */
export const FONT_SIZE_HUD = 13;

// ========== 分数配置 ==========

/** 每经过一代的基础得分 */
export const SCORE_PER_GENERATION = 1;

/** 每个存活细胞的奖励系数 */
export const SCORE_ALIVE_BONUS = 0.1;

// ========== 预设图案 ==========

/** 图案定义 */
export interface Pattern {
  /** 图案名称 */
  name: string;
  /** 存活细胞坐标列表 [行, 列] */
  cells: [number, number][];
}

/** 内置预设图案列表 */
export const PATTERNS: Pattern[] = [
  {
    name: 'Glider',
    cells: [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  },
  {
    name: 'Blinker',
    cells: [[0, 0], [0, 1], [0, 2]],
  },
  {
    name: 'Toad',
    cells: [[0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2]],
  },
  {
    name: 'Beacon',
    cells: [[0, 0], [0, 1], [1, 0], [2, 3], [3, 2], [3, 3]],
  },
  {
    name: 'Pulsar',
    cells: [
      [0, 2], [0, 3], [0, 4], [0, 8], [0, 9], [0, 10],
      [2, 0], [2, 5], [2, 7], [2, 12],
      [3, 0], [3, 5], [3, 7], [3, 12],
      [4, 0], [4, 5], [4, 7], [4, 12],
      [5, 2], [5, 3], [5, 4], [5, 8], [5, 9], [5, 10],
      [7, 2], [7, 3], [7, 4], [7, 8], [7, 9], [7, 10],
      [8, 0], [8, 5], [8, 7], [8, 12],
      [9, 0], [9, 5], [9, 7], [9, 12],
      [10, 0], [10, 5], [10, 7], [10, 12],
      [12, 2], [12, 3], [12, 4], [12, 8], [12, 9], [12, 10],
    ],
  },
  {
    name: 'Gosper Gun',
    cells: [
      [0, 24], [1, 22], [1, 24], [2, 12], [2, 13], [2, 20], [2, 21], [2, 34], [2, 35],
      [3, 11], [3, 15], [3, 20], [3, 21], [3, 34], [3, 35], [4, 0], [4, 1], [4, 10],
      [4, 16], [4, 20], [4, 21], [5, 0], [5, 1], [5, 10], [5, 14], [5, 16], [5, 17],
      [5, 22], [5, 24], [6, 10], [6, 16], [6, 24], [7, 11], [7, 15], [8, 12], [8, 13],
    ],
  },
  {
    name: 'R-pentomino',
    cells: [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]],
  },
  {
    name: 'Diehard',
    cells: [[0, 6], [1, 0], [1, 1], [2, 1], [2, 5], [2, 6], [2, 7]],
  },
  {
    name: 'Acorn',
    cells: [[0, 1], [1, 3], [2, 0], [2, 1], [2, 4], [2, 5], [2, 6]],
  },
];
