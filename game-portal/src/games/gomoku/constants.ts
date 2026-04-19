// ========== 五子棋（Gomoku）游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 棋盘参数
export const BOARD_SIZE = 15; // 15×15 标准棋盘
export const CELL_SIZE = 28; // 每格像素大小
export const STONE_RADIUS = 12; // 棋子半径
export const BOARD_PADDING = 30; // 棋盘边距

// 棋盘居中计算
// 网格区域宽度 = (BOARD_SIZE - 1) * CELL_SIZE
export const GRID_WIDTH = (BOARD_SIZE - 1) * CELL_SIZE; // 14 * 28 = 392
export const GRID_OFFSET_X = (CANVAS_WIDTH - GRID_WIDTH) / 2; // (480 - 392) / 2 = 44
export const GRID_OFFSET_Y = 80; // 顶部留出 HUD 空间
// 棋盘底部 y = GRID_OFFSET_Y + GRID_WIDTH = 80 + 392 = 472

// HUD 区域
export const HUD_HEIGHT = 70;

// 颜色方案
export const COLORS = {
  // 棋盘背景（木色）
  boardBg: '#DEB887',
  boardBgLight: '#E8C97A',
  boardBorder: '#8B6914',
  gridLine: '#5C4033',

  // 棋子
  blackStone: '#1a1a1a',
  blackStoneHighlight: '#444444',
  whiteStone: '#f0f0f0',
  whiteStoneHighlight: '#ffffff',
  stoneShadow: 'rgba(0, 0, 0, 0.3)',

  // 标记
  lastMoveMarker: '#ff4757',
  cursorPreview: 'rgba(0, 0, 0, 0.25)',
  cursorPreviewWhite: 'rgba(255, 255, 255, 0.3)',

  // HUD
  hudBg: 'rgba(30, 20, 10, 0.9)',
  hudBorder: 'rgba(139, 105, 20, 0.5)',
  textPrimary: '#f0e6d3',
  textSecondary: '#b8a88a',
  textAccent: '#ffd700',

  // 背景
  background: '#1a1410',
  backgroundGradient1: '#1a1410',
  backgroundGradient2: '#2a1f15',

  // 星位
  starPoint: '#5C4033',
} as const;

// 星位坐标（天元 + 四星）
export const STAR_POINTS: [number, number][] = [
  [3, 3], [3, 11], [11, 3], [11, 11], // 四角星
  [7, 7], // 天元
];

// AI 参数
export const AI_THINK_DELAY = 300; // AI 思考延迟（ms）

// 计分参数
export const SCORE_WIN = 100; // 胜利基础分
export const SCORE_PER_STONE = 5; // 每颗棋子得分
export const SCORE_AI_BONUS = 50; // AI 模式额外加分
export const SCORE_LEVEL_BONUS = 30; // 等级加成（每级）

// 字体
export const FONT_FAMILY = "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export const FONT_SIZE_HUD = 14;
export const FONT_SIZE_STATUS = 16;

// 底部提示区
export const FOOTER_Y = CANVAS_HEIGHT - 30;

// AI 评分权重
export const AI_SCORES = {
  FIVE: 1000000,       // 连五
  LIVE_FOUR: 100000,   // 活四
  RUSH_FOUR: 10000,    // 冲四
  LIVE_THREE: 5000,    // 活三
  SLEEP_THREE: 500,    // 眠三
  LIVE_TWO: 200,       // 活二
  SLEEP_TWO: 50,       // 眠二
  LIVE_ONE: 10,        // 活一
  SLEEP_ONE: 2,        // 眠一
} as const;
