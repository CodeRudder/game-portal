// ========== Connect Four 四子棋常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 棋盘尺寸
export const COLS = 7;
export const ROWS = 6;

// 棋盘布局
export const CELL_SIZE = 60; // 每格像素大小
export const CELL_GAP = 6; // 格子间距
export const CELL_RADIUS = 8; // 格子圆角
export const BOARD_PADDING = 12; // 棋盘内边距

// 棋子参数
export const PIECE_RADIUS = 24; // 棋子半径
export const PIECE_PADDING = 6; // 棋子距格子边距

// 棋盘居中计算
export const BOARD_TOTAL_WIDTH = COLS * CELL_SIZE + (COLS - 1) * CELL_GAP + BOARD_PADDING * 2;
export const BOARD_TOTAL_HEIGHT = ROWS * CELL_SIZE + (ROWS - 1) * CELL_GAP + BOARD_PADDING * 2;
export const BOARD_OFFSET_X = (CANVAS_WIDTH - BOARD_TOTAL_WIDTH) / 2 + BOARD_PADDING;
export const BOARD_OFFSET_Y = 130; // 留出 HUD 空间

// HUD 区域
export const HUD_HEIGHT = 110;

// 光标指示器
export const CURSOR_Y = BOARD_OFFSET_Y - 30; // 光标指示器 Y 位置（棋盘上方）
export const CURSOR_ANIMATION_SPEED = 300; // 光标移动动画时长（ms）

// 落子动画
export const DROP_ANIMATION_DURATION = 300; // 落子动画时长（ms）
export const DROP_ANIMATION_BOUNCE = 0.15; // 弹跳幅度

// 胜利高亮
export const WIN_HIGHLIGHT_BLINK_SPEED = 500; // 胜利高亮闪烁速度（ms）

// AI 参数
export const AI_THINK_DELAY = 400; // AI 思考延迟（ms）

// AI 难度搜索深度
export const AI_DEPTH_EASY = 1;
export const AI_DEPTH_MEDIUM = 4;
export const AI_DEPTH_HARD = 6;

// 计分参数
export const SCORE_WIN = 100; // 胜利基础分
export const SCORE_DRAW = 50; // 平局分
export const SCORE_AI_BONUS_EASY = 30; // Easy AI 模式胜利额外加分
export const SCORE_AI_BONUS_MEDIUM = 60; // Medium AI 模式胜利额外加分
export const SCORE_AI_BONUS_HARD = 100; // Hard AI 模式胜利额外加分
export const SCORE_SPEED_BONUS_BASE = 50; // 速通奖励基数
export const SCORE_SPEED_BONUS_STEP = 5; // 每少一步额外奖励

// 颜色方案
export const COLORS = {
  // 背景
  background: '#0f0e17',
  backgroundGradient1: '#0f0e17',
  backgroundGradient2: '#1a1a2e',

  // 棋盘
  boardBg: '#1a237e',
  boardBorder: '#283593',
  boardShadow: 'rgba(26, 35, 126, 0.6)',
  cellBg: '#0d1137',
  cellBorder: 'rgba(40, 53, 147, 0.5)',

  // 玩家1 棋子（红色系）
  player1Color: '#ef5350',
  player1Glow: 'rgba(239, 83, 80, 0.5)',
  player1Shadow: 'rgba(239, 83, 80, 0.7)',
  player1Highlight: '#ff8a80',

  // 玩家2 棋子（黄色系）
  player2Color: '#ffd54f',
  player2Glow: 'rgba(255, 213, 79, 0.5)',
  player2Shadow: 'rgba(255, 213, 79, 0.7)',
  player2Highlight: '#ffe082',

  // 光标
  cursorColor: '#4fc3f7',
  cursorGlow: 'rgba(79, 195, 247, 0.6)',

  // 胜利高亮
  winHighlight: '#ffffff',
  winHighlightGlow: 'rgba(255, 255, 255, 0.8)',

  // 文字
  textPrimary: '#e0e0e0',
  textSecondary: '#9e9e9e',
  textMuted: '#616161',
  textHighlight: '#ffd54f',

  // HUD
  hudBg: 'rgba(15, 14, 23, 0.85)',
  hudBorder: 'rgba(80, 80, 150, 0.3)',
} as const;

// 字体
export const FONT_FAMILY = "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export const FONT_SIZE_HUD = 14;
export const FONT_SIZE_STATUS = 22;
export const FONT_SIZE_RESULT = 32;

// 底部提示区
export const FOOTER_Y = CANVAS_HEIGHT - 40;
