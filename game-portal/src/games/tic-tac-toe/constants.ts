// ========== Tic-Tac-Toe 井字棋常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 棋盘尺寸
export const BOARD_SIZE = 3;

// 棋盘布局
export const CELL_SIZE = 120; // 每格像素大小
export const CELL_GAP = 8; // 格子间距
export const GRID_PADDING = 16; // 网格内边距
export const CELL_RADIUS = 8; // 格子圆角

// 棋盘居中计算
export const GRID_TOTAL_SIZE = BOARD_SIZE * CELL_SIZE + (BOARD_SIZE - 1) * CELL_GAP + GRID_PADDING * 2;
export const GRID_OFFSET_X = (CANVAS_WIDTH - GRID_TOTAL_SIZE) / 2 + GRID_PADDING;
export const GRID_OFFSET_Y = 140; // 留出 HUD 空间

// HUD 区域
export const HUD_HEIGHT = 120;

// 颜色方案
export const COLORS = {
  // 背景
  background: '#0f0e17',
  backgroundGradient1: '#0f0e17',
  backgroundGradient2: '#1a1a2e',

  // 网格
  gridLine: '#2a2a4a',
  gridLineGlow: 'rgba(100, 100, 200, 0.3)',
  cellBg: 'rgba(30, 30, 60, 0.6)',
  cellHover: 'rgba(60, 60, 120, 0.4)',
  cellBorder: 'rgba(80, 80, 150, 0.4)',

  // X 标记（蓝色系）
  xColor: '#4fc3f7',
  xGlow: 'rgba(79, 195, 247, 0.4)',
  xShadow: 'rgba(79, 195, 247, 0.6)',
  xStroke: '#29b6f6',

  // O 标记（红色系）
  oColor: '#ef5350',
  oGlow: 'rgba(239, 83, 80, 0.4)',
  oShadow: 'rgba(239, 83, 80, 0.6)',
  oStroke: '#e53935',

  // 光标
  cursorBorder: '#ffd54f',
  cursorGlow: 'rgba(255, 213, 79, 0.5)',
  cursorBg: 'rgba(255, 213, 79, 0.08)',

  // 胜利线
  winLine: '#ffd54f',
  winLineGlow: 'rgba(255, 213, 79, 0.6)',
  winLineShadow: 'rgba(255, 213, 79, 0.3)',

  // 文字
  textPrimary: '#e0e0e0',
  textSecondary: '#9e9e9e',
  textMuted: '#616161',
  textHighlight: '#ffd54f',

  // HUD
  hudBg: 'rgba(15, 14, 23, 0.85)',
  hudBorder: 'rgba(80, 80, 150, 0.3)',

  // 按钮
  btnBg: 'rgba(60, 60, 120, 0.5)',
  btnBorder: 'rgba(100, 100, 200, 0.5)',
  btnText: '#e0e0e0',
} as const;

// 标记绘制参数
export const MARK_PADDING = 28; // 标记距格子边距
export const X_LINE_WIDTH = 6; // X 线条宽度
export const O_LINE_WIDTH = 5; // O 线条宽度
export const O_RADIUS_RATIO = 0.32; // O 半径占格子比例

// 胜利线参数
export const WIN_LINE_WIDTH = 8;
export const WIN_LINE_ANIMATION_SPEED = 800; // 胜利线动画时长（ms）

// 落子动画
export const PLACE_ANIMATION_DURATION = 200; // 落子动画时长（ms）
export const PLACE_ANIMATION_SCALE_START = 0.3; // 起始缩放
export const PLACE_ANIMATION_SCALE_END = 1.0; // 结束缩放

// AI 参数
export const AI_THINK_DELAY = 500; // AI 思考延迟（ms）

// 计分参数
export const SCORE_WIN = 100; // 胜利基础分
export const SCORE_DRAW = 50; // 平局分
export const SCORE_AI_BONUS = 50; // AI 模式胜利额外加分
export const SCORE_SPEED_BONUS_BASE = 50; // 速通奖励基数
export const SCORE_SPEED_BONUS_STEP = 10; // 每少一步额外奖励

// 字体
export const FONT_FAMILY = "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export const FONT_SIZE_HUD = 14;
export const FONT_SIZE_TITLE = 18;
export const FONT_SIZE_STATUS = 24;
export const FONT_SIZE_RESULT = 32;

// 底部提示区
export const FOOTER_Y = CANVAS_HEIGHT - 60;
