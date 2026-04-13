// ========== Asteroids 小行星常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 飞船
export const SHIP_SIZE = 15;               // 飞船大小（半径）
export const SHIP_THRUST = 200;             // 推力加速度 (px/s²)
export const SHIP_ROTATION_SPEED = 4;       // 旋转速度 (rad/s)
export const SHIP_MAX_SPEED = 300;          // 最大速度 (px/s)
export const SHIP_FRICTION = 0.99;          // 摩擦系数（每帧衰减）
export const SHIP_COLOR = '#4fc3f7';
export const SHIP_INVINCIBLE_TIME = 2000;   // 重生无敌时间 (ms)

// 子弹
export const BULLET_SPEED = 400;            // 子弹速度 (px/s)
export const BULLET_LIFETIME = 1500;        // 子弹存活时间 (ms)
export const BULLET_COOLDOWN = 200;         // 发射冷却 (ms)
export const BULLET_RADIUS = 2;
export const BULLET_COLOR = '#ffffff';

// 小行星
export const ASTEROID_SIZE_LARGE = 40;
export const ASTEROID_SIZE_MEDIUM = 20;
export const ASTEROID_SIZE_SMALL = 10;
export const ASTEROID_SPEED_BASE = 50;      // 基础速度 (px/s)
export const ASTEROID_SPEED_VARIANCE = 60;  // 速度随机范围
export const ASTEROID_COLOR = '#aaaaaa';
export const ASTEROID_ROTATION_SPEED = 2;   // 旋转速度 (rad/s)

// 波次系统
export const INITIAL_ASTEROID_COUNT = 4;    // 第一波小行星数量
export const ASTEROIDS_PER_WAVE = 2;        // 每波增加数量
export const MAX_ASTEROID_WAVE = 12;        // 最大小行星数量

// 得分
export const SCORE_LARGE = 20;
export const SCORE_MEDIUM = 50;
export const SCORE_SMALL = 100;

// 生命
export const INITIAL_LIVES = 3;

// 颜色
export const BG_COLOR = '#0a0a2e';
export const HUD_COLOR = '#ffffff';

// 粒子效果
export const PARTICLE_COUNT = 8;
export const PARTICLE_LIFETIME = 500;
export const PARTICLE_SPEED = 100;
