// ========== Mahjong Solitaire (麻将消除) 游戏常量 ==========

// ========== Canvas 尺寸 ==========

/** 画布宽度 */
export const CANVAS_WIDTH = 480;

/** 画布高度 */
export const CANVAS_HEIGHT = 640;

// ========== 牌面尺寸 ==========

/** 牌面宽度 */
export const TILE_WIDTH = 36;

/** 牌面高度 */
export const TILE_HEIGHT = 48;

/** 层间偏移量（上方牌相对于下方牌的像素偏移） */
export const LAYER_OFFSET_X = 4;

/** 层间偏移量 Y */
export const LAYER_OFFSET_Y = 6;

// ========== HUD ==========

/** HUD 高度（顶部状态栏） */
export const HUD_HEIGHT = 50;

// ========== 计分规则 ==========

/** 基础消除得分 */
export const SCORE_PER_MATCH = 100;

/** 洗牌惩罚分数 */
export const SHUFFLE_PENALTY = 200;

/** 提示惩罚分数 */
export const HINT_PENALTY = 50;

// ========== 动画参数 ==========

/** 消除动画持续时间（毫秒） */
export const REMOVE_ANIM_DURATION = 300;

/** 提示高亮持续显示时间（毫秒） */
export const HINT_DURATION = 2000;

/** 提示闪烁间隔（毫秒） */
export const HINT_BLINK_INTERVAL = 300;

// ========== 洗牌 ==========

/** 最大洗牌次数 */
export const MAX_SHUFFLES = 3;

// ========== 麻将牌面定义 ==========

/** 牌面类型 */
export enum TileSuit {
  /** 万子 */
  WAN = 'wan',
  /** 条子 */
  TIAO = 'tiao',
  /** 筒子 */
  TONG = 'tong',
  /** 风牌 */
  FENG = 'feng',
  /** 箭牌 */
  JIAN = 'jian',
}

/** 牌面符号（万/条/筒各 1-9，风东南西北，箭中发白） */
export const TILE_FACES: readonly string[] = [
  // 万子 1-9
  '一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万',
  // 条子 1-9
  '一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条',
  // 筒子 1-9
  '一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒',
  // 风牌
  '东', '南', '西', '北',
  // 箭牌
  '中', '发', '白',
];

/** 牌面简短符号（用于 Canvas 绘制） */
export const TILE_SHORT_SYMBOLS: readonly string[] = [
  // 万子
  '万1', '万2', '万3', '万4', '万5', '万6', '万7', '万8', '万9',
  // 条子
  '条1', '条2', '条3', '条4', '条5', '条6', '条7', '条8', '条9',
  // 筒子
  '筒1', '筒2', '筒3', '筒4', '筒5', '筒6', '筒7', '筒8', '筒9',
  // 风牌
  '东', '南', '西', '北',
  // 箭牌
  '中', '发', '白',
];

/** 牌面颜色（按花色分组） */
export const TILE_COLORS: readonly string[] = [
  // 万子 - 红色系
  '#e74c3c', '#e74c3c', '#e74c3c', '#e74c3c', '#e74c3c',
  '#e74c3c', '#e74c3c', '#e74c3c', '#e74c3c',
  // 条子 - 绿色系
  '#27ae60', '#27ae60', '#27ae60', '#27ae60', '#27ae60',
  '#27ae60', '#27ae60', '#27ae60', '#27ae60',
  // 筒子 - 蓝色系
  '#2980b9', '#2980b9', '#2980b9', '#2980b9', '#2980b9',
  '#2980b9', '#2980b9', '#2980b9', '#2980b9',
  // 风牌 - 紫色系
  '#8e44ad', '#8e44ad', '#8e44ad', '#8e44ad',
  // 箭牌 - 特殊色
  '#e74c3c', '#27ae60', '#95a5a6',
];

/** 牌面背景色（按花色分组） */
export const TILE_BG_COLORS: readonly string[] = [
  // 万子
  '#3d1111', '#3d1111', '#3d1111', '#3d1111', '#3d1111',
  '#3d1111', '#3d1111', '#3d1111', '#3d1111',
  // 条子
  '#113d1a', '#113d1a', '#113d1a', '#113d1a', '#113d1a',
  '#113d1a', '#113d1a', '#113d1a', '#113d1a',
  // 筒子
  '#11293d', '#11293d', '#11293d', '#11293d', '#11293d',
  '#11293d', '#11293d', '#11293d', '#11293d',
  // 风牌
  '#2d113d', '#2d113d', '#2d113d', '#2d113d',
  // 箭牌
  '#3d1111', '#113d1a', '#2d2d2d',
];

/** 牌面总数（34 种） */
export const TOTAL_TILE_TYPES = 34;

/** 每种牌的数量 */
export const TILES_PER_TYPE = 4;

/** 牌面总数（34 × 4 = 136） */
export const TOTAL_TILES = TOTAL_TILE_TYPES * TILES_PER_TYPE; // 136

// ========== 颜色方案 ==========

export const COLORS = {
  // 背景
  background: '#0f0e17',

  // HUD
  hudBg: '#1a1a2e',
  hudBorder: '#2d2b55',
  hudLabel: '#a4b0be',
  hudValue: '#ffffff',
  hudScore: '#ffd700',
  hudMoves: '#7bed9f',
  hudTimer: '#70a1ff',

  // 牌面
  tileFace: '#f5f0e1',
  tileBack: '#1a1a2e',
  tileBorder: '#3d3a5c',
  tileSelectedBorder: '#ff6348',
  tileSelectedGlow: 'rgba(255, 99, 72, 0.5)',
  tileFreeBorder: '#4ecdc4',
  tileBlockedBorder: '#2d2d3d',

  // 提示
  hintBorder: '#ffd700',
  hintGlow: 'rgba(255, 215, 0, 0.5)',

  // 消除
  removeFlash: 'rgba(255, 255, 255, 0.6)',

  // 胜利
  winOverlay: 'rgba(15, 14, 23, 0.88)',
  winTitle: '#2ed573',
  winSubtitle: '#ffd700',

  // 光标
  cursorBorder: '#00d2ff',
  cursorGlow: 'rgba(0, 210, 255, 0.4)',
} as const;

// ========== 龟形布局定义 ==========

/**
 * 龟形布局模板
 * 每层是一个二维布尔数组，true 表示该位置有牌
 * 层0在最底部，层越大越靠上
 */
export interface LayoutLayer {
  /** 列数 */
  cols: number;
  /** 行数 */
  rows: number;
  /** 布局掩码：true 表示该位置有牌 */
  mask: boolean[][];
}

/**
 * 经典龟形布局（5层，共 136 张牌 = 34种 × 4）
 *
 * 层0 (底): 12×8 龟形底座 — 58 张
 * 层1: 10×6 — 42 张
 * 层2: 8×4 — 24 张
 * 层3: 6×2 — 10 张
 * 层4 (顶): 2×1 — 2 张
 * 总计: 58 + 42 + 24 + 10 + 2 = 136 ✓
 */
export const TURTLE_LAYOUT: LayoutLayer[] = [
  // 层0: 12×8 龟形底座 (58 tiles)
  {
    cols: 12,
    rows: 8,
    mask: [
      // row 0: 头部突出 (2)
      [false, false, false, false, true,  true,  false, false, false, false, false, false],
      // row 1: 头部+肩 (4)
      [false, false, false, true,  true,  true,  true,  false, false, false, false, false],
      // row 2: 宽体 (8)
      [false, false, true,  true,  true,  true,  true,  true,  true,  false, false, false],
      // row 3: 宽体 (10)
      [false, true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  false],
      // row 4: 最宽 (12)
      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true],
      // row 5: 宽体 (10)
      [false, true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  false],
      // row 6: 尾部 (8)
      [false, false, true,  true,  true,  true,  true,  true,  true,  false, false, false],
      // row 7: 尾尖 (4)
      [false, false, false, true,  true,  true,  true,  false, false, false, false, false],
    ],
  },
  // 层1: 10×6 (42 tiles)
  {
    cols: 10,
    rows: 6,
    mask: [
      [false, false, false, true,  true,  true,  true,  false, false, false],
      [false, false, true,  true,  true,  true,  true,  true,  false, false],
      [false, true,  true,  true,  true,  true,  true,  true,  true,  false],
      [true,  true,  true,  true,  true,  true,  true,  true,  true,  true],
      [false, true,  true,  true,  true,  true,  true,  true,  true,  false],
      [false, false, true,  true,  true,  true,  true,  true,  false, false],
    ],
  },
  // 层2: 8×4 (24 tiles)
  {
    cols: 8,
    rows: 4,
    mask: [
      [false, false, true,  true,  true,  true,  false, false],
      [false, true,  true,  true,  true,  true,  true,  false],
      [true,  true,  true,  true,  true,  true,  true,  true],
      [false, true,  true,  true,  true,  true,  true,  false],
    ],
  },
  // 层3: 6×2 (10 tiles)
  {
    cols: 6,
    rows: 2,
    mask: [
      [false, true,  true,  true,  true,  false],
      [true,  true,  true,  true,  true,  true],
    ],
  },
  // 层4: 2×1 (2 tiles, 顶部)
  {
    cols: 2,
    rows: 1,
    mask: [
      [true, true],
    ],
  },
];

/**
 * 计算布局总牌数
 */
export function countLayoutTiles(layout: LayoutLayer[]): number {
  let count = 0;
  for (const layer of layout) {
    for (const row of layer.mask) {
      for (const cell of row) {
        if (cell) count++;
      }
    }
  }
  return count;
}

/**
 * 简化布局（用于测试）：2 层，共 6 张牌
 */
export const SIMPLE_LAYOUT: LayoutLayer[] = [
  {
    cols: 4,
    rows: 1,
    mask: [[true, true, true, true]],
  },
  {
    cols: 2,
    rows: 1,
    mask: [[true, true]],
  },
];

/**
 * 小型布局（用于测试）：1 层，共 8 张牌
 */
export const TINY_LAYOUT: LayoutLayer[] = [
  {
    cols: 4,
    rows: 2,
    mask: [
      [true, true, true, true],
      [true, true, true, true],
    ],
  },
];

/**
 * 配对测试布局：1 层 4 张牌（2 对）
 */
export const PAIR_LAYOUT: LayoutLayer[] = [
  {
    cols: 4,
    rows: 1,
    mask: [[true, true, true, true]],
  },
];

// ========== 游戏状态 ==========

/** 光标位置 */
export interface CursorPosition {
  /** 层号 */
  layer: number;
  /** 行号 */
  row: number;
  /** 列号 */
  col: number;
}
