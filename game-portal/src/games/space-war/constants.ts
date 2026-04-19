// ========== Space War 常量 ==========

/** 画布尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 飞船参数 */
export const SHIP_SIZE = 15;
export const SHIP_THRUST = 200;          // 推力加速度 (px/s²)
export const SHIP_ROTATION_SPEED = 4.5;  // 旋转速度 (rad/s)
export const SHIP_MAX_SPEED = 250;       // 最大速度 (px/s)
export const SHIP_FRICTION = 0.98;       // 摩擦系数 (每帧乘)
export const SHIP_COLOR_P1 = '#00ff88';  // 玩家1颜色（绿）
export const SHIP_COLOR_P2 = '#ff4757';  // 玩家2颜色（红）

/** 子弹参数 */
export const BULLET_SPEED = 400;         // 子弹速度 (px/s)
export const BULLET_LIFETIME = 1500;     // 子弹存活时间 (ms)
export const BULLET_COOLDOWN = 300;      // 子弹冷却时间 (ms)
export const BULLET_RADIUS = 3;          // 子弹半径
export const BULLET_COLOR_P1 = '#00ff88';
export const BULLET_COLOR_P2 = '#ff4757';

/** 小行星参数 */
export const ASTEROID_COUNT = 5;         // 小行星数量
export const ASTEROID_MIN_RADIUS = 12;
export const ASTEROID_MAX_RADIUS = 30;
export const ASTEROID_MIN_SPEED = 15;
export const ASTEROID_MAX_SPEED = 50;
export const ASTEROID_COLOR = '#8b7355';
export const ASTEROID_ROTATION_SPEED = 1.5;

/** 胜利条件 */
export const WINS_NEEDED = 2;            // 3局2胜

/** 粒子效果 */
export const PARTICLE_COUNT = 12;
export const PARTICLE_LIFETIME = 600;
export const PARTICLE_SPEED = 80;

/** 背景星星 */
export const STAR_COUNT = 80;

/** 回合间延迟 (ms) */
export const ROUND_DELAY = 2000;

/** AI 参数 */
export const AI_THINK_INTERVAL = 100;    // AI 思考间隔 (ms)
export const AI_ACCURACY = 0.7;          // AI 瞄准精度 (0-1)
export const AI_SHOOT_RANGE = 350;       // AI 射程
export const AI_THRUST_CHANCE = 0.02;    // AI 每帧推进概率

/** HUD 颜色 */
export const HUD_COLOR = '#ffffff';
export const BG_COLOR = '#0a0a1a';
