// ========== Pixel Art 涂色画板 常量配置 ==========

// ========== 画布尺寸 ==========

/** 画布宽度 */
export const CANVAS_WIDTH = 480;

/** 画布高度 */
export const CANVAS_HEIGHT = 640;

// ========== 网格尺寸选项 ==========

/** 支持的网格尺寸 */
export const GRID_SIZES = [16, 32, 64] as const;

/** 默认网格尺寸 */
export const DEFAULT_GRID_SIZE = 16;

// ========== 布局配置 ==========

/** 网格区域在画布中的 X 偏移 */
export const GRID_OFFSET_X = 10;

/** 网格区域在画布中的 Y 偏移（HUD 下方） */
export const GRID_OFFSET_Y = 50;

/** HUD 高度 */
export const HUD_HEIGHT = 45;

/** 调色板区域 Y 偏移（网格下方） */
export const PALETTE_OFFSET_Y = 0; // 动态计算

/** 调色板每行颜色数 */
export const PALETTE_COLS = 8;

/** 调色板色块大小 */
export const PALETTE_CELL_SIZE = 24;

/** 调色板色块间距 */
export const PALETTE_CELL_GAP = 4;

/** 工具栏高度 */
export const TOOLBAR_HEIGHT = 36;

/** 工具栏 Y 偏移 */
export const TOOLBAR_OFFSET_Y = 10;

// ========== 颜色配置 ==========

/** 空白格子的颜色代码 */
export const EMPTY_COLOR = '';

/** 预设调色板颜色（至少 16 种） */
export const PALETTE_COLORS: string[] = [
  '#000000', // 黑色
  '#ffffff', // 白色
  '#ff0000', // 红色
  '#00ff00', // 绿色
  '#0000ff', // 蓝色
  '#ffff00', // 黄色
  '#ff00ff', // 品红
  '#00ffff', // 青色
  '#ff8800', // 橙色
  '#8800ff', // 紫色
  '#ff0088', // 玫红
  '#00ff88', // 翠绿
  '#0088ff', // 天蓝
  '#88ff00', // 黄绿
  '#884400', // 棕色
  '#888888', // 灰色
  '#ff4444', // 浅红
  '#44ff44', // 浅绿
  '#4444ff', // 浅蓝
  '#ffaa44', // 浅橙
  '#aa44ff', // 浅紫
  '#44ffff', // 浅青
  '#ffffaa', // 浅黄
  '#ff44aa', // 浅粉
];

/** 默认选中颜色索引 */
export const DEFAULT_COLOR_INDEX = 0;

// ========== 工具类型 ==========

/** 工具枚举 */
export enum Tool {
  BRUSH = 'brush',
  ERASER = 'eraser',
  FILL = 'fill',
  EYEDROPPER = 'eyedropper',
}

/** 所有工具列表 */
export const ALL_TOOLS: Tool[] = [Tool.BRUSH, Tool.ERASER, Tool.FILL, Tool.EYEDROPPER];

/** 工具名称映射 */
export const TOOL_NAMES: Record<Tool, string> = {
  [Tool.BRUSH]: '画笔',
  [Tool.ERASER]: '橡皮擦',
  [Tool.FILL]: '填充',
  [Tool.EYEDROPPER]: '取色器',
};

/** 工具图标映射 */
export const TOOL_ICONS: Record<Tool, string> = {
  [Tool.BRUSH]: '✏️',
  [Tool.ERASER]: '🧹',
  [Tool.FILL]: '🪣',
  [Tool.EYEDROPPER]: '💉',
};

/** 默认工具 */
export const DEFAULT_TOOL = Tool.BRUSH;

// ========== 渲染颜色 ==========

export const COLORS = {
  /** 背景 */
  background: '#0d0d20',
  /** 网格线 */
  gridLine: 'rgba(255, 255, 255, 0.1)',
  /** 空白格子 */
  emptyCell: '#1a1a2e',
  /** 光标填充 */
  cursorFill: 'rgba(255, 255, 255, 0.3)',
  /** 光标边框 */
  cursorBorder: '#ffffff',
  /** HUD 背景 */
  hudBg: 'rgba(15, 14, 23, 0.9)',
  /** 主文本 */
  textPrimary: '#e2e8f0',
  /** 次要文本 */
  textSecondary: '#94a3b8',
  /** 强调色 */
  accent: '#00ff88',
  /** 选中工具高亮 */
  toolHighlight: '#00ff88',
  /** 选中颜色边框 */
  colorHighlight: '#ffffff',
  /** 调色板背景 */
  paletteBg: 'rgba(30, 30, 50, 0.8)',
};

// ========== 字体 ==========

export const FONT_FAMILY = "'Courier New', monospace";
export const FONT_SIZE_SMALL = 11;
export const FONT_SIZE_NORMAL = 13;
export const FONT_SIZE_LARGE = 16;

// ========== 模板库 ==========

/** 模板定义 */
export interface Template {
  /** 模板名称 */
  name: string;
  /** 模板尺寸 */
  size: number;
  /** 颜色数据：二维数组，空字符串表示空白 */
  data: string[][];
}

/** 内置模板 */
export const TEMPLATES: Template[] = [
  {
    name: '心形',
    size: 16,
    data: createHeartTemplate(),
  },
  {
    name: '星星',
    size: 16,
    data: createStarTemplate(),
  },
  {
    name: '笑脸',
    size: 16,
    data: createSmileyTemplate(),
  },
  {
    name: '钻石',
    size: 16,
    data: createDiamondTemplate(),
  },
  {
    name: '箭头',
    size: 16,
    data: createArrowTemplate(),
  },
];

// ========== 模板生成辅助函数 ==========

function createEmptyGrid(size: number): string[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => EMPTY_COLOR));
}

function createHeartTemplate(): string[][] {
  const grid = createEmptyGrid(16);
  const heart = '#ff0000';
  // 心形图案
  const pattern = [
    [3, 4], [3, 5], [3, 9], [3, 10],
    [4, 3], [4, 4], [4, 5], [4, 6], [4, 8], [4, 9], [4, 10], [4, 11],
    [5, 3], [5, 4], [5, 5], [5, 6], [5, 7], [5, 8], [5, 9], [5, 10], [5, 11],
    [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10],
    [7, 5], [7, 6], [7, 7], [7, 8], [7, 9],
    [8, 6], [8, 7], [8, 8],
    [9, 7],
  ];
  for (const [r, c] of pattern) {
    grid[r][c] = heart;
  }
  return grid;
}

function createStarTemplate(): string[][] {
  const grid = createEmptyGrid(16);
  const star = '#ffff00';
  const pattern = [
    [2, 7], [2, 8],
    [3, 7], [3, 8],
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
    [7, 0], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7], [7, 8], [7, 9], [7, 10], [7, 11], [7, 12], [7, 13], [7, 14], [7, 15],
    [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13],
    [9, 4], [9, 5], [9, 6], [9, 7], [9, 8], [9, 9], [9, 10], [9, 11],
    [10, 3], [10, 4], [10, 5], [10, 6], [10, 7], [10, 8], [10, 9], [10, 10], [10, 11], [10, 12],
    [11, 5], [11, 6], [11, 7], [11, 8], [11, 9],
    [12, 6], [12, 7], [12, 8],
    [13, 5], [13, 9],
    [14, 4], [14, 10],
  ];
  for (const [r, c] of pattern) {
    grid[r][c] = star;
  }
  return grid;
}

function createSmileyTemplate(): string[][] {
  const grid = createEmptyGrid(16);
  const face = '#ffff00';
  const eye = '#000000';
  const mouth = '#000000';
  // 脸部轮廓
  const facePattern = [
    [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10],
    [4, 4], [4, 11],
    [5, 3], [5, 12],
    [6, 3], [6, 12],
    [7, 3], [7, 12],
    [8, 3], [8, 12],
    [9, 3], [9, 12],
    [10, 3], [10, 12],
    [11, 4], [11, 11],
    [12, 5], [12, 6], [12, 7], [12, 8], [12, 9], [12, 10],
  ];
  for (const [r, c] of facePattern) {
    grid[r][c] = face;
  }
  // 眼睛
  grid[5][6] = eye;
  grid[5][9] = eye;
  grid[6][6] = eye;
  grid[6][9] = eye;
  // 嘴巴
  const mouthPattern = [
    [9, 5], [9, 10],
    [10, 6], [10, 7], [10, 8], [10, 9],
  ];
  for (const [r, c] of mouthPattern) {
    grid[r][c] = mouth;
  }
  return grid;
}

function createDiamondTemplate(): string[][] {
  const grid = createEmptyGrid(16);
  const diamond = '#0088ff';
  const pattern = [
    [0, 7], [0, 8],
    [1, 6], [1, 7], [1, 8], [1, 9],
    [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10],
    [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11],
    [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [4, 11], [4, 12],
    [5, 4], [5, 5], [5, 6], [5, 7], [5, 8], [5, 9], [5, 10], [5, 11],
    [6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10],
    [7, 6], [7, 7], [7, 8], [7, 9],
    [8, 7], [8, 8],
  ];
  for (const [r, c] of pattern) {
    grid[r][c] = diamond;
  }
  return grid;
}

function createArrowTemplate(): string[][] {
  const grid = createEmptyGrid(16);
  const arrow = '#00ff00';
  const pattern = [
    [1, 7], [1, 8],
    [2, 6], [2, 7], [2, 8], [2, 9],
    [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10],
    [4, 7], [4, 8],
    [5, 7], [5, 8],
    [6, 7], [6, 8],
    [7, 7], [7, 8],
    [8, 7], [8, 8],
    [9, 7], [9, 8],
    [10, 7], [10, 8],
    [11, 7], [11, 8],
    [12, 7], [12, 8],
    [13, 7], [13, 8],
    [14, 7], [14, 8],
  ];
  for (const [r, c] of pattern) {
    grid[r][c] = arrow;
  }
  return grid;
}

// ========== 存储键 ==========

/** localStorage 存储前缀 */
export const STORAGE_KEY_PREFIX = 'gp_pixel_art_';

/** 最大保存数量 */
export const MAX_SAVES = 10;
