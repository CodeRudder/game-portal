// ========== Dino Runner 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 地面
export const GROUND_Y = 500;

// 恐龙
export const DINO_WIDTH = 44;
export const DINO_HEIGHT = 48;
export const DINO_DUCK_WIDTH = 58;
export const DINO_DUCK_HEIGHT = 30;
export const DINO_X = 60;

// 物理
export const GRAVITY = 0.6;
export const JUMP_FORCE = -12;

// 障碍物类型
export enum ObstacleType {
  SMALL_CACTUS = 'small_cactus',
  LARGE_CACTUS = 'large_cactus',
  PTERODACTYL = 'pterodactyl',
}

// 小仙人掌
export const SMALL_CACTUS_WIDTH = 20;
export const SMALL_CACTUS_HEIGHT = 40;

// 大仙人掌
export const LARGE_CACTUS_WIDTH = 30;
export const LARGE_CACTUS_HEIGHT = 60;

// 翼龙
export const PTERO_WIDTH = 46;
export const PTERO_HEIGHT = 40;
export const PTERO_LOW_Y = 420; // 低飞 - 需要下蹲
export const PTERO_HIGH_Y = 360; // 高飞 - 需要跳跃

// 速度参数
export const INITIAL_SPEED = 6;
export const SPEED_INCREMENT = 0.2;
export const SPEED_INCREMENT_SCORE = 100; // 每100分加速
export const MAX_SPEED = 14;

// 障碍物生成间隔
export const MIN_OBSTACLE_INTERVAL = 800; // 毫秒
export const MAX_OBSTACLE_INTERVAL = 2000; // 毫秒

// 碰撞检测容差（缩小hitbox）
export const HITBOX_SHRINK = 6;

// 夜间模式
export const NIGHT_MODE_INTERVAL = 700; // 每700分切换

// 云朵
export const CLOUD_SPEED_RATIO = 0.3; // 云朵速度为游戏速度的比例
export const CLOUD_MIN_Y = 40;
export const CLOUD_MAX_Y = 200;
export const CLOUD_SPAWN_INTERVAL = 3000; // 毫秒

// 颜色 - 日间
export const BG_COLOR_DAY = '#f7f7f7';
export const GROUND_COLOR_DAY = '#535353';
export const DINO_COLOR_DAY = '#535353';
export const CACTUS_COLOR_DAY = '#535353';
export const CLOUD_COLOR_DAY = '#c8c8c8';
export const SCORE_COLOR_DAY = '#535353';
export const PTERO_COLOR_DAY = '#535353';

// 颜色 - 夜间
export const BG_COLOR_NIGHT = '#1a1a2e';
export const GROUND_COLOR_NIGHT = '#e0e0e0';
export const DINO_COLOR_NIGHT = '#e0e0e0';
export const CACTUS_COLOR_NIGHT = '#e0e0e0';
export const CLOUD_COLOR_NIGHT = '#3a3a5c';
export const SCORE_COLOR_NIGHT = '#e0e0e0';
export const PTERO_COLOR_NIGHT = '#e0e0e0';

// 地面纹理
export const GROUND_LINE_SPACING = 20;

// 跑步动画
export const RUN_ANIM_INTERVAL = 100; // 毫秒
