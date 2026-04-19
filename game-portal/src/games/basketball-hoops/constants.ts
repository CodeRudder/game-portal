// ========== 疯狂投篮 Basketball Hoops — 常量定义 ==========

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 重力加速度 (px/s²) */
export const GRAVITY = 800;

/** 篮球 */
export const BALL_RADIUS = 14;
export const BALL_START_X = 80;
export const BALL_START_Y = 540;
export const BALL_COLOR = '#ff8c00';
export const BALL_LINE_COLOR = '#cc6600';

/** 投篮角度范围 (弧度) */
export const MIN_ANGLE = Math.PI / 8;       // 22.5°
export const MAX_ANGLE = Math.PI * 3 / 8;   // 67.5°
export const DEFAULT_ANGLE = Math.PI / 4;   // 45°
export const ANGLE_STEP = Math.PI / 180;    // 1° per update tick

/** 力度范围 */
export const MIN_POWER = 200;
export const MAX_POWER = 700;
export const POWER_CHARGE_RATE = 400;       // px/s 蓄力速率

/** 篮筐 */
export const HOOP_WIDTH = 60;               // 筐口宽度
export const HOOP_RIM_RADIUS = 4;           // 筐沿半径
export const HOOP_NET_HEIGHT = 30;          // 篮网高度
export const HOOP_RIM_COLOR = '#ff4444';
export const HOOP_NET_COLOR = '#ffffff';
export const HOOP_MIN_X = 250;
export const HOOP_MAX_X = 420;
export const HOOP_MIN_Y = 120;
export const HOOP_MAX_Y = 280;
export const HOOP_BACKBOARD_WIDTH = 8;
export const HOOP_BACKBOARD_HEIGHT = 60;
export const HOOP_BACKBOARD_COLOR = '#cccccc';

/** 得分 */
export const SCORE_NORMAL = 2;              // 普通进球
export const SCORE_SWISH = 3;               // 空心入网（不碰筐沿直接进）

/** 连击奖励倍率 */
export const COMBO_MULTIPLIERS = [1, 1, 1.5, 2, 2.5, 3, 3.5, 4];

/** 时间限制 (秒) */
export const TIME_LIMIT = 60;

/** 球飞行状态检测阈值 */
export const BALL_GONE_Y = CANVAS_HEIGHT + 50;  // 球飞出屏幕底部
export const BALL_GONE_X_MAX = CANVAS_WIDTH + 50;
export const BALL_GONE_X_MIN = -50;

/** 空心入网检测：球心离筐口中心的水平偏移阈值 */
export const SWISH_THRESHOLD = 10;

/** 碰筐检测：球心到筐沿端点的距离阈值 */
export const RIM_BOUNCE_THRESHOLD = BALL_RADIUS + HOOP_RIM_RADIUS + 2;

/** 碰筐反弹系数 */
export const RIM_BOUNCE_FACTOR = 0.5;

/** 篮板碰撞检测 */
export const BACKBOARD_BOUNCE_FACTOR = 0.6;

/** 颜色 */
export const BG_COLOR = '#1a1a2e';
export const GROUND_COLOR = '#2d2d44';
export const GROUND_Y = 580;
export const AIM_LINE_COLOR = 'rgba(255, 255, 255, 0.5)';
export const POWER_BAR_COLOR = '#00ff88';
export const POWER_BAR_BG_COLOR = 'rgba(255, 255, 255, 0.2)';
export const TEXT_COLOR = '#ffffff';
export const COMBO_COLOR = '#ffdd00';
export const TIMER_COLOR = '#ff4757';
export const TRAJECTORY_COLOR = 'rgba(255, 255, 255, 0.2)';
export const TRAJECTORY_DOT_COUNT = 15;

/** HUD */
export const HUD_HEIGHT = 50;
export const HUD_COLOR = 'rgba(0, 0, 0, 0.5)';
