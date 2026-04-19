// ========== Reaction Test 反应力测试常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 状态机 ==========
export enum ReactionPhase {
  /** 等待阶段：显示"等待..."，随机延迟后变绿 */
  WAITING = 'waiting',
  /** 就绪阶段：屏幕变绿，开始计时 */
  READY = 'ready',
  /** 反应阶段：用户已按键/点击，记录反应时间 */
  REACTING = 'reacting',
  /** 结果阶段：显示反应时间，可重试 */
  RESULT = 'result',
  /** 过早按键：在 waiting 阶段就按了 */
  TOO_EARLY = 'too-early',
}

// ========== 随机延迟（毫秒） ==========
/** 最小等待时间 */
export const WAIT_MIN_MS = 1000;
/** 最大等待时间 */
export const WAIT_MAX_MS = 5000;

// ========== 多轮测试 ==========
/** 默认每轮测试次数 */
export const DEFAULT_ROUNDS = 5;
/** 最大测试轮数 */
export const MAX_ROUNDS = 10;
/** 最小测试轮数 */
export const MIN_ROUNDS = 1;

// ========== 评级阈值（毫秒） ==========
export const RATING_LEGENDARY = 150;  // 传奇
export const RATING_EXCELLENT = 200;  // 优秀
export const RATING_GOOD = 250;       // 良好
export const RATING_AVERAGE = 300;    // 一般
export const RATING_SLOW = 350;       // 较慢
// > 350 = 需要练习

// ========== 颜色 ==========
export const COLOR_BG_WAITING = '#1a1a2e';
export const COLOR_BG_READY = '#00b894';
export const COLOR_BG_TOO_EARLY = '#d63031';
export const COLOR_BG_RESULT = '#0d0d20';
export const COLOR_TEXT_PRIMARY = '#ffffff';
export const COLOR_TEXT_SECONDARY = '#b2bec3';
export const COLOR_TEXT_ACCENT = '#00cec9';
export const COLOR_TEXT_HIGHLIGHT = '#ffeaa7';
export const COLOR_TEXT_DANGER = '#ff7675';
export const COLOR_TEXT_SUCCESS = '#55efc4';
export const COLOR_PROGRESS_BG = '#2d3436';
export const COLOR_PROGRESS_FILL = '#00b894';
export const COLOR_BAR_BG = 'rgba(255,255,255,0.1)';
export const COLOR_BAR_FILL = '#00cec9';

// ========== 布局 ==========
export const HUD_HEIGHT = 80;
export const CONTENT_CENTER_Y = 320;
export const PROGRESS_BAR_HEIGHT = 8;
export const PROGRESS_BAR_MARGIN = 40;
export const ROUND_INDICATOR_SIZE = 32;
export const ROUND_INDICATOR_GAP = 12;

// ========== 字体 ==========
export const FONT_FAMILY = "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
export const FONT_SIZE_TITLE = 36;
export const FONT_SIZE_SUBTITLE = 20;
export const FONT_SIZE_TIME = 72;
export const FONT_SIZE_HINT = 16;
export const FONT_SIZE_ROUND = 14;

// ========== localStorage 键 ==========
export const STORAGE_KEY_BEST = 'reaction_test_best_ms';
export const STORAGE_KEY_HISTORY = 'reaction_test_history';

// ========== 动画 ==========
export const PULSE_ANIMATION_SPEED = 2; // 脉冲动画速度
export const RESULT_DISPLAY_DELAY = 300; // 结果显示延迟（毫秒）

// ========== 评级标签 ==========
export const RATING_LABELS: { max: number; label: string; color: string }[] = [
  { max: RATING_LEGENDARY, label: '🧠 传奇！', color: '#ffeaa7' },
  { max: RATING_EXCELLENT, label: '⚡ 优秀', color: '#55efc4' },
  { max: RATING_GOOD, label: '👍 良好', color: '#00cec9' },
  { max: RATING_AVERAGE, label: '👌 一般', color: '#74b9ff' },
  { max: RATING_SLOW, label: '🐢 较慢', color: '#fdcb6e' },
  { max: Infinity, label: '💪 需要练习', color: '#ff7675' },
];
