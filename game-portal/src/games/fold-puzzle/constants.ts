// ========== 折纸拼图 (Fold Puzzle) 常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 网格配置
export const GRID_SIZE = 4; // 4×4 网格

// 颜色编号（1-4 代表四种颜色）
export const MIN_COLOR = 1;
export const MAX_COLOR = 4;

// 颜色映射（渲染用）
export const COLOR_MAP: Record<number, string> = {
  1: '#FF4444', // 红
  2: '#44AAFF', // 蓝
  3: '#44DD44', // 绿
  4: '#FFAA00', // 橙
};

export const COLOR_NAMES: Record<number, string> = {
  1: '红',
  2: '蓝',
  3: '绿',
  4: '橙',
};

// 折叠方向
export enum FoldDirection {
  HORIZONTAL_UP = 'horizontal-up',     // 水平折线，下侧向上折叠
  HORIZONTAL_DOWN = 'horizontal-down', // 水平折线，上侧向下折叠
  VERTICAL_LEFT = 'vertical-left',     // 垂直折线，右侧向左折叠
  VERTICAL_RIGHT = 'vertical-right',   // 垂直折线，左侧向右折叠
}

// 折线类型
export enum FoldLineType {
  HORIZONTAL = 'horizontal', // 水平折线（在 row 之间）
  VERTICAL = 'vertical',     // 垂直折线（在 col 之间）
}

// 关卡配置
export interface LevelConfig {
  level: number;
  /** 初始网格（4×4 颜色编号） */
  initialGrid: number[][];
  /** 目标网格（4×4 颜色编号） */
  targetGrid: number[][];
  /** 最优步数（用于评分） */
  optimalMoves: number;
}

// 关卡定义
export const LEVELS: LevelConfig[] = [
  {
    level: 1,
    initialGrid: [
      [1, 1, 2, 2],
      [1, 1, 2, 2],
      [3, 3, 4, 4],
      [3, 3, 4, 4],
    ],
    targetGrid: [
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 3, 3],
      [4, 4, 4, 4],
    ],
    optimalMoves: 2,
  },
  {
    level: 2,
    initialGrid: [
      [1, 2, 1, 2],
      [1, 2, 1, 2],
      [3, 4, 3, 4],
      [3, 4, 3, 4],
    ],
    targetGrid: [
      [1, 1, 2, 2],
      [3, 3, 4, 4],
      [1, 1, 2, 2],
      [3, 3, 4, 4],
    ],
    optimalMoves: 3,
  },
  {
    level: 3,
    initialGrid: [
      [1, 2, 3, 4],
      [1, 2, 3, 4],
      [1, 2, 3, 4],
      [1, 2, 3, 4],
    ],
    targetGrid: [
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 3, 3],
      [4, 4, 4, 4],
    ],
    optimalMoves: 3,
  },
  {
    level: 4,
    initialGrid: [
      [4, 3, 2, 1],
      [3, 2, 1, 4],
      [2, 1, 4, 3],
      [1, 4, 3, 2],
    ],
    targetGrid: [
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 3, 3],
      [4, 4, 4, 4],
    ],
    optimalMoves: 5,
  },
  {
    level: 5,
    initialGrid: [
      [2, 4, 1, 3],
      [3, 1, 4, 2],
      [4, 2, 3, 1],
      [1, 3, 2, 4],
    ],
    targetGrid: [
      [1, 2, 3, 4],
      [4, 3, 2, 1],
      [1, 2, 3, 4],
      [4, 3, 2, 1],
    ],
    optimalMoves: 6,
  },
  {
    level: 6,
    initialGrid: [
      [1, 3, 2, 4],
      [4, 2, 3, 1],
      [2, 4, 1, 3],
      [3, 1, 4, 2],
    ],
    targetGrid: [
      [1, 1, 2, 2],
      [3, 3, 4, 4],
      [1, 1, 2, 2],
      [3, 3, 4, 4],
    ],
    optimalMoves: 4,
  },
  {
    level: 7,
    initialGrid: [
      [3, 1, 4, 2],
      [2, 4, 1, 3],
      [4, 2, 3, 1],
      [1, 3, 2, 4],
    ],
    targetGrid: [
      [4, 4, 4, 4],
      [3, 3, 3, 3],
      [2, 2, 2, 2],
      [1, 1, 1, 1],
    ],
    optimalMoves: 5,
  },
];

export const MAX_LEVEL = LEVELS.length;

// 计分
export const BASE_SCORE = 100;
export const LEVEL_BONUS = 50;
export const OPTIMAL_BONUS = 30;

// 布局
export const GRID_PADDING = 40;
export const CELL_GAP = 4;
export const HUD_HEIGHT = 60;

// 颜色
export const COLORS = {
  BG: '#0f0f23',
  HUD_BG: '#1a1a3e',
  HUD_TEXT: '#e0e0e0',
  HUD_ACCENT: '#00d4ff',
  GRID_BORDER: '#4a4a6a',
  GRID_BG: '#1a1a2e',
  CELL_BORDER: '#3a3a5a',
  FOLD_LINE: '#ffdd44',
  FOLD_LINE_GLOW: 'rgba(255,221,68,0.4)',
  TARGET_BG: '#1e1e3e',
  TARGET_BORDER: '#5a5a8a',
  CURSOR_COLOR: '#00ff88',
  WIN_TEXT: '#00ff88',
  WIN_GLOW: 'rgba(0,255,136,0.3)',
  OVERLAY_BG: 'rgba(0,0,0,0.7)',
  DIRECTION_ARROW: '#ffffff',
  SELECTED_FOLD: '#ffdd44',
};

// 折线位置范围
// 水平折线位置：0-3（在 row i 和 row i+1 之间，或者理解为 row 0..i 折叠到 row i+1..）
// 垂直折线位置：0-3
export const MIN_FOLD_POS = 0;
export const MAX_FOLD_POS = GRID_SIZE - 1; // 3
