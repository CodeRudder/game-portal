// ========== 华容道 Klotski 常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 棋盘网格：4 列 × 5 行
export const COLS = 4;
export const ROWS = 5;

// 棋盘绘制区域（居中，留出 HUD 和底部出口）
export const BOARD_PADDING = 20;
export const HUD_HEIGHT = 50;
export const BOARD_TOP = HUD_HEIGHT + BOARD_PADDING;
export const BOARD_BOTTOM = CANVAS_HEIGHT - BOARD_PADDING;
export const BOARD_LEFT = BOARD_PADDING;
export const BOARD_RIGHT = CANVAS_WIDTH - BOARD_PADDING;
export const BOARD_WIDTH = BOARD_RIGHT - BOARD_LEFT;
export const BOARD_HEIGHT = BOARD_BOTTOM - BOARD_TOP;
export const CELL_WIDTH = BOARD_WIDTH / COLS;
export const CELL_HEIGHT = BOARD_HEIGHT / ROWS;

// 出口位置（底部中间 2 格宽）
export const EXIT_LEFT = BOARD_LEFT + CELL_WIDTH;
export const EXIT_RIGHT = BOARD_LEFT + CELL_WIDTH * 3;
export const EXIT_Y = BOARD_BOTTOM;

// ========== 棋子类型 ==========
export enum PieceType {
  CAOCAO = 'caocao',       // 曹操 2×2
  GUANYU = 'guanyu',       // 关羽 2×1 横
  GENERAL_V = 'general_v', // 竖将 1×2
  SOLDIER = 'soldier',     // 小兵 1×1
}

// 棋子尺寸映射
export const PIECE_SIZES: Record<PieceType, { w: number; h: number }> = {
  [PieceType.CAOCAO]: { w: 2, h: 2 },
  [PieceType.GUANYU]: { w: 2, h: 1 },
  [PieceType.GENERAL_V]: { w: 1, h: 2 },
  [PieceType.SOLDIER]: { w: 1, h: 1 },
};

// 棋子颜色
export const PIECE_COLORS: Record<PieceType, string> = {
  [PieceType.CAOCAO]: '#d32f2f',     // 红色 - 曹操
  [PieceType.GUANYU]: '#388e3c',     // 绿色 - 关羽
  [PieceType.GENERAL_V]: '#1976d2',  // 蓝色 - 竖将
  [PieceType.SOLDIER]: '#f9a825',    // 黄色 - 小兵
};

// 棋子边框颜色
export const PIECE_BORDER_COLORS: Record<PieceType, string> = {
  [PieceType.CAOCAO]: '#b71c1c',
  [PieceType.GUANYU]: '#1b5e20',
  [PieceType.GENERAL_V]: '#0d47a1',
  [PieceType.SOLDIER]: '#f57f17',
};

// 棋子文字
export const PIECE_LABELS: Record<PieceType, string> = {
  [PieceType.CAOCAO]: '曹操',
  [PieceType.GUANYU]: '关羽',
  [PieceType.GENERAL_V]: '将',
  [PieceType.SOLDIER]: '兵',
};

// 棋子文字颜色
export const PIECE_TEXT_COLORS: Record<PieceType, string> = {
  [PieceType.CAOCAO]: '#ffffff',
  [PieceType.GUANYU]: '#ffffff',
  [PieceType.GENERAL_V]: '#ffffff',
  [PieceType.SOLDIER]: '#000000',
};

// ========== 绘制参数 ==========
export const PIECE_GAP = 4;           // 棋子间距
export const PIECE_RADIUS = 6;        // 圆角
export const SELECTED_BORDER_WIDTH = 3;
export const SELECTED_GLOW_COLOR = '#ffeb3b';

// 背景颜色
export const BG_COLOR = '#3e2723';           // 深棕色背景
export const BOARD_BG_COLOR = '#5d4037';     // 棋盘背景
export const BOARD_BORDER_COLOR = '#8d6e63'; // 棋盘边框
export const GRID_LINE_COLOR = 'rgba(141,110,99,0.3)';
export const EXIT_COLOR = '#4e342e';
export const HUD_TEXT_COLOR = '#ffffff';
export const HINT_COLOR = '#ffcc02';

// ========== 关卡定义 ==========
export interface PieceConfig {
  id: string;
  type: PieceType;
  col: number;
  row: number;
  label?: string; // 自定义标签
}

export interface LevelConfig {
  id: number;
  name: string;
  pieces: PieceConfig[];
  // 最少步数（参考值）
  minSteps: number;
}

// 经典关卡：横刀立马
export const LEVEL_HENGDAO_LIMA: LevelConfig = {
  id: 1,
  name: '横刀立马',
  minSteps: 81,
  pieces: [
    { id: 'caocao', type: PieceType.CAOCAO, col: 1, row: 0 },
    { id: 'guanyu', type: PieceType.GUANYU, col: 1, row: 2 },
    { id: 'zhangfei', type: PieceType.GENERAL_V, col: 0, row: 0, label: '张飞' },
    { id: 'zhaoyun', type: PieceType.GENERAL_V, col: 3, row: 0, label: '赵云' },
    { id: 'machao', type: PieceType.GENERAL_V, col: 0, row: 2, label: '马超' },
    { id: 'huangzhong', type: PieceType.GENERAL_V, col: 3, row: 2, label: '黄忠' },
    { id: 'soldier1', type: PieceType.SOLDIER, col: 1, row: 3 },
    { id: 'soldier2', type: PieceType.SOLDIER, col: 2, row: 3 },
    { id: 'soldier3', type: PieceType.SOLDIER, col: 0, row: 4 },
    { id: 'soldier4', type: PieceType.SOLDIER, col: 3, row: 4 },
  ],
};

// 经典关卡：指挥若定
export const LEVEL_ZHIHUI_RUODING: LevelConfig = {
  id: 2,
  name: '指挥若定',
  minSteps: 70,
  pieces: [
    { id: 'caocao', type: PieceType.CAOCAO, col: 1, row: 0 },
    { id: 'guanyu', type: PieceType.GUANYU, col: 1, row: 2 },
    { id: 'zhangfei', type: PieceType.GENERAL_V, col: 0, row: 0, label: '张飞' },
    { id: 'zhaoyun', type: PieceType.GENERAL_V, col: 3, row: 0, label: '赵云' },
    { id: 'machao', type: PieceType.GENERAL_V, col: 0, row: 2, label: '马超' },
    { id: 'huangzhong', type: PieceType.GENERAL_V, col: 3, row: 2, label: '黄忠' },
    { id: 'soldier1', type: PieceType.SOLDIER, col: 0, row: 4 },
    { id: 'soldier2', type: PieceType.SOLDIER, col: 1, row: 3 },
    { id: 'soldier3', type: PieceType.SOLDIER, col: 2, row: 3 },
    { id: 'soldier4', type: PieceType.SOLDIER, col: 3, row: 4 },
  ],
};

// 经典关卡：将拥曹营
export const LEVEL_JIANG_YONG_CAOYING: LevelConfig = {
  id: 3,
  name: '将拥曹营',
  minSteps: 96,
  pieces: [
    { id: 'caocao', type: PieceType.CAOCAO, col: 1, row: 0 },
    { id: 'guanyu', type: PieceType.GUANYU, col: 0, row: 4 },
    { id: 'zhangfei', type: PieceType.GENERAL_V, col: 0, row: 0, label: '张飞' },
    { id: 'zhaoyun', type: PieceType.GENERAL_V, col: 3, row: 0, label: '赵云' },
    { id: 'machao', type: PieceType.GENERAL_V, col: 0, row: 2, label: '马超' },
    { id: 'huangzhong', type: PieceType.GENERAL_V, col: 3, row: 2, label: '黄忠' },
    { id: 'soldier1', type: PieceType.SOLDIER, col: 1, row: 2 },
    { id: 'soldier2', type: PieceType.SOLDIER, col: 2, row: 2 },
    { id: 'soldier3', type: PieceType.SOLDIER, col: 1, row: 3 },
    { id: 'soldier4', type: PieceType.SOLDIER, col: 2, row: 3 },
  ],
};

// 经典关卡：兵分三路
export const LEVEL_BING_FEN_SANLU: LevelConfig = {
  id: 4,
  name: '兵分三路',
  minSteps: 72,
  pieces: [
    { id: 'caocao', type: PieceType.CAOCAO, col: 1, row: 0 },
    { id: 'guanyu', type: PieceType.GUANYU, col: 1, row: 3 },
    { id: 'zhangfei', type: PieceType.GENERAL_V, col: 0, row: 0, label: '张飞' },
    { id: 'zhaoyun', type: PieceType.GENERAL_V, col: 3, row: 0, label: '赵云' },
    { id: 'machao', type: PieceType.GENERAL_V, col: 0, row: 2, label: '马超' },
    { id: 'huangzhong', type: PieceType.GENERAL_V, col: 3, row: 2, label: '黄忠' },
    { id: 'soldier1', type: PieceType.SOLDIER, col: 1, row: 2 },
    { id: 'soldier2', type: PieceType.SOLDIER, col: 2, row: 2 },
    { id: 'soldier3', type: PieceType.SOLDIER, col: 0, row: 4 },
    { id: 'soldier4', type: PieceType.SOLDIER, col: 3, row: 4 },
  ],
};

// 经典关卡：近在咫尺
export const LEVEL_JIN_ZAI_ZHICHI: LevelConfig = {
  id: 5,
  name: '近在咫尺',
  minSteps: 100,
  pieces: [
    { id: 'caocao', type: PieceType.CAOCAO, col: 1, row: 0 },
    { id: 'guanyu', type: PieceType.GUANYU, col: 1, row: 2 },
    { id: 'zhangfei', type: PieceType.GENERAL_V, col: 0, row: 0, label: '张飞' },
    { id: 'zhaoyun', type: PieceType.GENERAL_V, col: 3, row: 0, label: '赵云' },
    { id: 'machao', type: PieceType.GENERAL_V, col: 0, row: 2, label: '马超' },
    { id: 'huangzhong', type: PieceType.GENERAL_V, col: 3, row: 2, label: '黄忠' },
    { id: 'soldier1', type: PieceType.SOLDIER, col: 1, row: 4 },
    { id: 'soldier2', type: PieceType.SOLDIER, col: 2, row: 4 },
    { id: 'soldier3', type: PieceType.SOLDIER, col: 0, row: 4 },
    { id: 'soldier4', type: PieceType.SOLDIER, col: 3, row: 4 },
  ],
};

// 所有关卡
export const LEVELS: LevelConfig[] = [
  LEVEL_HENGDAO_LIMA,
  LEVEL_ZHIHUI_RUODING,
  LEVEL_JIANG_YONG_CAOYING,
  LEVEL_BING_FEN_SANLU,
  LEVEL_JIN_ZAI_ZHICHI,
];

// 胜利目标行（曹操需要到达 row=3，即底部出口位置）
export const WIN_ROW = 3;
export const WIN_COL = 1;
