// ========== Eight Queens 八皇后常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 棋盘
export const BOARD_SIZE = 8;
export const CELL_SIZE = 50;
export const BOARD_OFFSET_X = (CANVAS_WIDTH - BOARD_SIZE * CELL_SIZE) / 2; // 40
export const BOARD_OFFSET_Y = 100;

// HUD
export const HUD_HEIGHT = 90;

// 颜色
export const BG_COLOR = '#1a1a2e';
export const BOARD_LIGHT_COLOR = '#e8d5b5';
export const BOARD_DARK_COLOR = '#b58863';
export const QUEEN_COLOR = '#ffd700';
export const QUEEN_STROKE_COLOR = '#b8860b';
export const CURSOR_COLOR = 'rgba(100, 200, 255, 0.5)';
export const CURSOR_BORDER_COLOR = '#64c8ff';
export const CONFLICT_COLOR = 'rgba(255, 80, 80, 0.4)';
export const SAFE_COLOR = 'rgba(80, 255, 80, 0.3)';
export const HUD_COLOR = '#ffffff';
export const WIN_COLOR = '#66bb6a';
export const HINT_TEXT_COLOR = '#aaaaaa';

// 得分
export const POINTS_PER_QUEEN = 100;
export const WIN_BONUS = 500;
export const HINT_PENALTY = 20;

// 关卡配置
export const MAX_LEVEL = 5;

// 关卡定义：每个关卡可以有预填的皇后位置
// null 表示标准模式（无预填）
export interface LevelConfig {
  level: number;
  name: string;
  preFilled: Array<[number, number]> | null; // [row, col] 预填的皇后位置
  description: string;
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: 1,
    name: '经典模式',
    preFilled: null,
    description: '标准八皇后，自由放置',
  },
  {
    level: 2,
    name: '引导入门',
    preFilled: [[0, 0]],
    description: '第一行第一列已放置皇后',
  },
  {
    level: 3,
    name: '双重约束',
    preFilled: [[0, 4], [4, 2]],
    description: '两个皇后已预置',
  },
  {
    level: 4,
    name: '三重挑战',
    preFilled: [[0, 1], [3, 5], [6, 2]],
    description: '三个皇后已预置',
  },
  {
    level: 5,
    name: '大师之路',
    preFilled: [[0, 3], [2, 6], [4, 0], [6, 4]],
    description: '四个皇后已预置，仅剩四步',
  },
];

// 皇后符号
export const QUEEN_SYMBOL = '♛';
