// ========== Memory Match 游戏常量 ==========

// Canvas 尺寸（与 GameContainer 统一）
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 网格配置 ==========

export const GRID_COLS = 4; // 列数
export const GRID_ROWS = 4; // 行数
export const TOTAL_PAIRS = 8; // 配对总数 = (4 * 4) / 2

// ========== 卡牌布局 ==========

export const CARD_PADDING = 12; // 网格区域内边距
export const CARD_GAP = 10; // 卡牌间距
export const GRID_OFFSET_Y = 100; // 网格区域顶部偏移（给标题/分数区域）
export const CARD_RADIUS = 8; // 卡牌圆角

// 根据画布和布局参数推导卡牌尺寸
// 卡牌宽度 = (画布宽度 - 两侧内边距 - 列间间距) / 列数
// 卡牌高度 = (画布高度 - 顶部偏移 - 底部内边距 - 行间间距) / 行数
export const CARD_WIDTH =
  (CANVAS_WIDTH - CARD_PADDING * 2 - CARD_GAP * (GRID_COLS - 1)) / GRID_COLS;
export const CARD_HEIGHT =
  (CANVAS_HEIGHT - GRID_OFFSET_Y - CARD_PADDING - CARD_GAP * (GRID_ROWS - 1)) / GRID_ROWS;

// ========== 动画配置 ==========

export const FLIP_DURATION = 300; // 翻牌动画时长（毫秒）
export const MISMATCH_DELAY = 800; // 不匹配时翻回延迟（毫秒）
export const MATCH_ANIMATION_DURATION = 500; // 匹配成功动画时长（毫秒）

// ========== 计分配置 ==========

export const BASE_SCORE = 1000; // 基础分数
export const MISMATCH_PENALTY = 50; // 每次不匹配扣分
export const TIME_BONUS_FACTOR = 2; // 时间奖励系数

// ========== 颜色配置 ==========

export const COLORS = {
  background: '#1a1a2e', // 画布背景
  cardBack: '#16213e', // 卡牌背面
  cardBackBorder: '#0f3460', // 卡牌背面边框
  cardFront: '#e2e8f0', // 卡牌正面
  cardFrontBorder: '#cbd5e1', // 卡牌正面边框
  cardMatched: '#48bb78', // 已匹配卡牌
  cardMatchedBorder: '#38a169', // 已匹配卡牌边框
  textPrimary: '#ffffff', // 主文字
  textSecondary: '#a0aec0', // 次要文字
  headerBg: '#0f3460', // 标题区域背景
  accent: '#e94560', // 强调色
  scoreColor: '#ffd700', // 分数颜色
  comboColor: '#ff6b6b', // 连击颜色
} as const;

// ========== 卡牌符号 ==========

/** 8 个 emoji 符号，对应 TOTAL_PAIRS 对配对 */
export const CARD_SYMBOLS = ['🎮', '🎲', '🎯', '🎪', '🎨', '🎭', '🎵', '🎸'] as const;
