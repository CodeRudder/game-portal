// ========== Conway's Game of Life 常量配置 ==========

// ========== Canvas 尺寸（与 GameContainer 统一） ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 网格配置 ==========

/** 每个细胞的像素大小 */
export const CELL_SIZE = 10;

/** 网格列数（留边距：480 - 2×10 = 460 → 460/10 = 46） */
export const GRID_COLS = 46;

/** 网格行数（留边距：640 - HUD顶部50 - 底部提示40 - 2×5 = 540 → 540/10 = 54，取58行利用更多空间） */
export const GRID_ROWS = 58;

/** 网格 X 偏移（居中：480 - 46×10 = 20 → 左偏移 10） */
export const GRID_OFFSET_X = Math.floor((CANVAS_WIDTH - GRID_COLS * CELL_SIZE) / 2);

/** 网格 Y 偏移（顶部留空给 HUD） */
export const GRID_OFFSET_Y = 50;

// ========== 速度配置 ==========

/** 速度等级（代/秒），level 1~6 对应不同速率 */
export const SPEED_LEVELS = [1, 2, 5, 10, 20, 30];

/** 根据等级索引获取每代间隔（毫秒） */
export function getTickInterval(levelIndex: number): number {
  const speed = SPEED_LEVELS[Math.min(levelIndex, SPEED_LEVELS.length - 1)];
  return 1000 / speed;
}

// ========== 模拟状态 ==========

export enum SimulationState {
  RUNNING = 'running',
  PAUSED = 'paused',
  EDITING = 'editing',
}

// ========== 颜色方案（科技感深色主题） ==========

/** 主背景色 */
export const COLOR_BG = '#0a0a1a';

/** 网格线颜色（极淡） */
export const COLOR_GRID_LINE = '#1a1a3a';

/** 活细胞主色 */
export const COLOR_CELL_ALIVE = '#00ff88';

/** 活细胞渐变终止色 */
export const COLOR_CELL_ALIVE_END = '#00b894';

/** 活细胞发光色 */
export const COLOR_CELL_GLOW = 'rgba(0, 255, 136, 0.3)';

/** 光标边框色（编辑模式） */
export const COLOR_CURSOR = '#ffd700';

/** HUD 文字色 */
export const COLOR_HUD_TEXT = '#a0a0c0';

/** HUD 数值色 */
export const COLOR_HUD_VALUE = '#00ff88';

/** HUD 标签色 */
export const COLOR_HUD_LABEL = '#6060a0';

/** 底部提示文字色 */
export const COLOR_HINT_TEXT = '#404070';

/** "所有生命已消亡" 提示色 */
export const COLOR_EXTINCT = '#ff4757';

/** HUD 字体 */
export const FONT_HUD = '"Courier New", "Consolas", monospace';

// ========== 预设图案 ==========

/** 预设图案定义：相对坐标偏移数组 [row, col] */
export interface Pattern {
  name: string;
  /** 图案描述 */
  description: string;
  /** 活细胞相对坐标 [row, col] */
  cells: [number, number][];
}

/** 滑翔机 (Glider) — 5 个细胞，经典移动图案 */
export const PATTERN_GLIDER: Pattern = {
  name: 'Glider',
  description: '滑翔机 — 最经典的移动图案',
  cells: [
    [0, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
};

/** 轻量级飞船 (LWSS) — 9 个细胞 */
export const PATTERN_LWSS: Pattern = {
  name: 'LWSS',
  description: '轻量级飞船 — 水平移动的飞船',
  cells: [
    [0, 1],
    [0, 4],
    [1, 0],
    [2, 0],
    [2, 4],
    [3, 0],
    [3, 1],
    [3, 2],
    [3, 3],
  ],
};

/** R-pentomino — 5 个细胞，长寿命图案（需要 1103 代才稳定） */
export const PATTERN_R_PENTOMINO: Pattern = {
  name: 'R-pentomino',
  description: 'R-五格骨牌 — 5个细胞却产生复杂演化',
  cells: [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
};

/** 脉冲星 (Pulsar) — 48 个细胞，周期 3 振荡器 */
export const PATTERN_PULSAR: Pattern = {
  name: 'Pulsar',
  description: '脉冲星 — 周期3振荡器，对称之美',
  cells: [
    // 上左
    [0, 2], [0, 3], [0, 4],
    [2, 0], [3, 0], [4, 0],
    [2, 5], [3, 5], [4, 5],
    [5, 2], [5, 3], [5, 4],
    // 上右
    [0, 8], [0, 9], [0, 10],
    [2, 7], [3, 7], [4, 7],
    [2, 12], [3, 12], [4, 12],
    [5, 8], [5, 9], [5, 10],
    // 下左
    [7, 2], [7, 3], [7, 4],
    [8, 0], [9, 0], [10, 0],
    [8, 5], [9, 5], [10, 5],
    [12, 2], [12, 3], [12, 4],
    // 下右
    [7, 8], [7, 9], [7, 10],
    [8, 7], [9, 7], [10, 7],
    [8, 12], [9, 12], [10, 12],
    [12, 8], [12, 9], [12, 10],
  ],
};

/** 高斯帕滑翔机枪 (Gosper Glider Gun) — 36 个细胞，无限产生滑翔机 */
export const PATTERN_GOSPER_GUN: Pattern = {
  name: 'Gosper Gun',
  description: '高斯帕滑翔机枪 — 持续产生滑翔机',
  cells: [
    // 左方块
    [0, 24],
    [1, 22], [1, 24],
    // 左结构
    [2, 12], [2, 13], [2, 20], [2, 21], [2, 34], [2, 35],
    [3, 11], [3, 15], [3, 20], [3, 21], [3, 34], [3, 35],
    [4, 0], [4, 1], [4, 10], [4, 16], [4, 20], [4, 21],
    [5, 0], [5, 1], [5, 10], [5, 14], [5, 16], [5, 17], [5, 22], [5, 24],
    [6, 10], [6, 16], [6, 24],
    [7, 11], [7, 15],
    [8, 12], [8, 13],
  ],
};

/** 所有预设图案列表（按 P 键循环切换） */
export const PRESET_PATTERNS: Pattern[] = [
  PATTERN_GLIDER,
  PATTERN_LWSS,
  PATTERN_R_PENTOMINO,
  PATTERN_PULSAR,
  PATTERN_GOSPER_GUN,
];

// ========== HUD 布局 ==========

/** HUD 区域高度（顶部） */
export const HUD_HEIGHT = 45;

/** 底部提示区域高度 */
export const HINT_HEIGHT = 35;
