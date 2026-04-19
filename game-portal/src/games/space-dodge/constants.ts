// ========== Space Dodge 太空陨石躲避 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 飞船
export const SHIP_WIDTH = 40;
export const SHIP_HEIGHT = 30;
export const SHIP_SPEED = 5; // 像素/帧
export const SHIP_Y_OFFSET = 60; // 距底部距离
export const SHIP_HITBOX_SHRINK = 4; // 碰撞盒内缩量（更宽容）

// 陨石
export const METEOR_MIN_RADIUS = 10;
export const METEOR_MAX_RADIUS = 30;
export const METEOR_MIN_SPEED = 2;
export const METEOR_MAX_SPEED = 5;
export const METEOR_SPAWN_INTERVAL_MS = 600; // 初始生成间隔（毫秒）
export const METEOR_SPAWN_INTERVAL_MIN_MS = 200; // 最小生成间隔
export const METEOR_SPAWN_INTERVAL_DECREMENT = 20; // 每级减少的间隔
export const METEOR_SPEED_INCREMENT = 0.3; // 每级速度增量
export const METEOR_MAX_ON_SCREEN = 30; // 屏幕上最大陨石数

// 能量球
export const ORB_RADIUS = 12;
export const ORB_SPEED = 2;
export const ORB_POINTS = 50; // 收集能量球得分
export const ORB_SPAWN_INTERVAL_MS = 5000; // 能量球生成间隔
export const ORB_SPAWN_CHANCE = 0.3; // 每次检查生成的概率
export const ORB_MAX_ON_SCREEN = 3;

// 速度递增
export const SPEED_INCREASE_INTERVAL_SEC = 10; // 每 N 秒升一级
export const MAX_LEVEL = 20;

// 计分
export const SCORE_PER_SECOND = 10; // 每秒生存得分

// 星空背景
export const STAR_COUNT = 80;
export const STAR_MIN_SPEED = 0.5;
export const STAR_MAX_SPEED = 2.5;
export const STAR_MIN_SIZE = 1;
export const STAR_MAX_SIZE = 3;

// 颜色
export const BG_COLOR = '#0a0a1a';
export const SHIP_BODY_COLOR = '#00d4ff';
export const SHIP_WINDOW_COLOR = '#74b9ff';
export const SHIP_FLAME_COLOR = '#ff6348';
export const SHIP_FLAME_INNER_COLOR = '#ffd32a';
export const METEOR_COLORS = ['#8b7355', '#a0522d', '#6b4226', '#8b6914', '#7b6b5a'];
export const METEOR_CRATER_COLOR = '#5a4a3a';
export const ORB_COLOR = '#00ff88';
export const ORB_GLOW_COLOR = 'rgba(0, 255, 136, 0.3)';
export const HUD_COLOR = '#ffffff';
export const HUD_SHADOW_COLOR = 'rgba(0, 0, 0, 0.5)';
export const STAR_COLOR = '#ffffff';
export const GAME_OVER_OVERLAY_COLOR = 'rgba(0, 0, 0, 0.6)';
export const GAME_OVER_TEXT_COLOR = '#ff4757';
export const SCORE_POPUP_COLOR = '#00ff88';
export const SCORE_POPUP_DURATION_MS = 800;
