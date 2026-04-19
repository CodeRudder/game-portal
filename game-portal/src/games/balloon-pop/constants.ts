// ========== Balloon Pop 气球射击常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 气球类型 ==========
export enum BalloonType {
  NORMAL = 'normal',
  SMALL = 'small',
  GOLDEN = 'golden',
  BOMB = 'bomb',
}

// ========== 分数 ==========
export const SCORE_NORMAL = 10;
export const SCORE_SMALL = 25;
export const SCORE_GOLDEN = 50;
export const SCORE_BOMB = -30;

// ========== 气球尺寸 ==========
export const BALLOON_RADIUS_NORMAL = 25;
export const BALLOON_RADIUS_SMALL = 15;
export const BALLOON_RADIUS_GOLDEN = 22;
export const BALLOON_RADIUS_BOMB = 22;

// ========== 气球速度（像素/毫秒） ==========
export const BALLOON_SPEED_MIN = 0.05;
export const BALLOON_SPEED_MAX = 0.12;
export const BALLOON_SPEED_SMALL_MIN = 0.07;
export const BALLOON_SPEED_SMALL_MAX = 0.15;

// ========== 生成间隔（毫秒） ==========
export const SPAWN_INTERVAL_BASE = 800;
export const SPAWN_INTERVAL_DECREASE_PER_LEVEL = 50;
export const SPAWN_INTERVAL_MIN = 300;

// ========== 气球类型概率 ==========
export const SPAWN_CHANCE_NORMAL = 0.55;
export const SPAWN_CHANCE_SMALL = 0.20;
export const SPAWN_CHANCE_GOLDEN = 0.05;
export const SPAWN_CHANCE_BOMB = 0.20;

// ========== 时间限制（秒） ==========
export const GAME_DURATION = 60;

// ========== 连击系统 ==========
/** 连击倍率阈值：连续命中 comboThreshold[n] 次后，倍率为 n+1 */
export const COMBO_MULTIPLIER_THRESHOLDS = [0, 3, 6, 10, 15];
/** 对应的倍率 */
export const COMBO_MULTIPLIERS = [1, 1.5, 2, 2.5, 3];

// ========== 等级系统 ==========
export const LEVEL_UP_SCORE = 150;
export const MAX_LEVEL = 10;

// ========== 准星 ==========
export const CROSSHAIR_SPEED = 0.3; // 像素/毫秒
export const CROSSHAIR_SIZE = 20;

// ========== HUD ==========
export const HUD_HEIGHT = 60;

// ========== 颜色 ==========
export const BG_COLOR = '#1a1a2e';
export const BG_GRADIENT_TOP = '#1a1a2e';
export const BG_GRADIENT_BOTTOM = '#16213e';
export const HUD_COLOR = '#ffffff';
export const HUD_BG_COLOR = 'rgba(0,0,0,0.5)';
export const CROSSHAIR_COLOR = '#ff4757';
export const CROSSHAIR_DOT_COLOR = '#ffffff';

// 气球颜色
export const BALLOON_COLORS = ['#ff6b6b', '#48dbfb', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4', '#f368e0'];
export const GOLDEN_COLOR = '#ffd700';
export const BOMB_COLOR = '#2d3436';
export const BOMB_FUSE_COLOR = '#e17055';

export const SCORE_POPUP_COLOR = '#ffd700';
export const MISS_POPUP_COLOR = '#ff4757';

// ========== 爆炸效果 ==========
export const POP_DURATION = 300; // 毫秒
export const POP_PARTICLES = 8;

// ========== 键盘映射 ==========
export const DIRECTION_KEYS = {
  UP: ['ArrowUp', 'w', 'W'],
  DOWN: ['ArrowDown', 's', 'S'],
  LEFT: ['ArrowLeft', 'a', 'A'],
  RIGHT: ['ArrowRight', 'd', 'D'],
  SHOOT: [' ', 'Space'],
};
