// ========== Mahjong Connect (连连看) 游戏常量 ==========

// ========== Canvas 尺寸 ==========

/** 画布宽度 */
export const CANVAS_WIDTH = 480;

/** 画布高度 */
export const CANVAS_HEIGHT = 640;

// ========== 网格配置 ==========

/** 网格行数（不含外围） */
export const GRID_ROWS = 8;

/** 网格列数（不含外围） */
export const GRID_COLS = 10;

/** 图案类型数量（默认关卡） */
export const PATTERN_COUNT = 10;

// ========== 牌面布局 ==========

/** HUD 高度（顶部状态栏） */
export const HUD_HEIGHT = 60;

/** 网格区域内边距 */
export const GRID_PADDING = 12;

/** 牌面间距 */
export const TILE_GAP = 4;

/** 牌面圆角 */
export const TILE_RADIUS = 6;

// ========== 关卡配置 ==========

/** 单个关卡配置 */
export interface LevelConfig {
  /** 网格行数 */
  rows: number;
  /** 网格列数 */
  cols: number;
  /** 图案种类数 */
  patternCount: number;
  /** 关卡标签 */
  label: string;
}

/** 关卡递进配置表 */
export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: { rows: 6, cols: 8, patternCount: 8, label: '简单 6×8' },
  2: { rows: 8, cols: 10, patternCount: 10, label: '中等 8×10' },
  3: { rows: 8, cols: 12, patternCount: 12, label: '困难 8×12' },
  4: { rows: 10, cols: 12, patternCount: 15, label: '专家 10×12' },
};

/** 默认关卡等级 */
export const DEFAULT_LEVEL = 1;

// ========== 动画参数 ==========

/** 连线动画持续时间（毫秒） */
export const CONNECT_ANIM_DURATION = 400;

/** 消除动画持续时间（毫秒） */
export const REMOVE_ANIM_DURATION = 300;

/** 提示高亮闪烁间隔（毫秒） */
export const HINT_BLINK_INTERVAL = 500;

/** 提示高亮持续显示时间（毫秒） */
export const HINT_DURATION = 3000;

// ========== 计分规则 ==========

/** 基础消除得分 */
export const SCORE_BASE_MATCH = 100;

/** 连击奖励基数（× combo 数） */
export const SCORE_COMBO_BONUS = 50;

/** 时间奖励（每剩余 1 秒） */
export const SCORE_TIME_BONUS = 5;

/** 洗牌惩罚分数 */
export const SHUFFLE_PENALTY = 200;

/** 提示惩罚分数 */
export const HINT_PENALTY = 50;

/** 连击超时（毫秒），超过此时间未消除则重置连击 */
export const COMBO_TIMEOUT = 5000;

// ========== 图案定义 ==========

/** 图案 emoji 符号（最多 20 种） */
export const TILE_SYMBOLS: readonly string[] = [
  '🌸', '🍀', '⭐', '🔥', '💎',
  '🎵', '🎯', '🌙', '❤️', '☀️',
  '🍎', '🍊', '🦋', '🐱', '🌺',
  '🎪', '🎨', '🌟', '🎲', '🦊',
] as const;

/** 图案对应颜色（用于背景） */
export const TILE_COLORS: readonly string[] = [
  '#ff6b6b', '#51cf66', '#ffd43b', '#ff922b', '#339af0',
  '#cc5de8', '#20c997', '#845ef7', '#f06595', '#fab005',
  '#e03131', '#f08c00', '#1098ad', '#7048e8', '#c2255c',
  '#862e9c', '#364fc7', '#087f5b', '#d9480f', '#5c940d',
] as const;

// ========== 颜色方案 ==========

export const COLORS = {
  // 背景
  background: '#0f0e17',
  backgroundGradient1: '#0f0e17',
  backgroundGradient2: '#1a1a2e',

  // HUD
  hudBg: '#1a1a2e',
  hudBorder: '#2d2b55',
  hudTitle: '#eccc68',
  hudLabel: '#a4b0be',
  hudValue: '#ffffff',
  hudScore: '#ffd700',
  hudCombo: '#ff6b6b',
  hudLevel: '#7bed9f',

  // 牌面
  tileBg: '#16213e',
  tileBgHover: '#1e2d50',
  tileBorder: '#2d3a5c',
  tileSelectedBorder: '#ff6348',
  tileSelectedGlow: 'rgba(255, 99, 72, 0.4)',
  tileMatchedBg: '#1a3a1a',
  tileMatchedBorder: '#28a745',

  // 连线
  connectLine: '#00d2ff',
  connectLineGlow: 'rgba(0, 210, 255, 0.6)',

  // 提示
  hintBorder: '#ffd700',
  hintGlow: 'rgba(255, 215, 0, 0.5)',

  // 消除动画
  removeFlash: 'rgba(255, 255, 255, 0.8)',

  // 无解提示
  noMatchText: '#ff4757',
  shuffleText: '#ffa502',

  // 胜利
  winOverlay: 'rgba(15, 14, 23, 0.88)',
  winTitle: '#2ed573',
  winSubtitle: '#ffd700',
  winPrompt: '#a4b0be',
} as const;

// ========== 路径连接 ==========

/** 最大拐弯数 */
export const MAX_TURNS = 2;

// ========== 洗牌 ==========

/** 最大洗牌次数 */
export const MAX_SHUFFLES = 3;
