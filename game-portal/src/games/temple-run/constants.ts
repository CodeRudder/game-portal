// ========== Temple Run Lite 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 跑道参数
export const LANE_COUNT = 3;
export const LANE_WIDTH = 80;
export const LANE_SPACING = 100; // 跑道中心间距
export const CENTER_LANE_X = CANVAS_WIDTH / 2;

// 角色参数
export const PLAYER_WIDTH = 40;
export const PLAYER_HEIGHT = 60;
export const PLAYER_Y = 480; // 角色底部 y 坐标
export const PLAYER_SWITCH_SPEED = 12; // 跑道切换速度

// 跳跃参数
export const GRAVITY = 0.8;
export const JUMP_FORCE = -16;
export const SLIDE_DURATION = 500; // 滑铲持续时间（毫秒）

// 速度参数
export const INITIAL_SPEED = 5;
export const SPEED_INCREMENT = 0.15;
export const SPEED_INCREMENT_SCORE = 200; // 每200分加速
export const MAX_SPEED = 15;

// 障碍物参数
export const OBSTACLE_WIDTH = 60;
export const OBSTACLE_HEIGHT_HIGH = 70; // 高障碍（需滑铲）
export const OBSTACLE_HEIGHT_LOW = 40;  // 低障碍（需跳跃）
export const OBSTACLE_HEIGHT_FULL = 80; // 全宽障碍（需切换跑道）
export const MIN_OBSTACLE_INTERVAL = 800;
export const MAX_OBSTACLE_INTERVAL = 2000;
export const OBSTACLE_SPAWN_Y = -100; // 障碍物生成 y 坐标

// 金币参数
export const COIN_SIZE = 20;
export const COIN_SCORE = 10;
export const COIN_SPAWN_INTERVAL = 600;
export const MIN_COIN_INTERVAL = 300;

// 碰撞检测容差
export const HITBOX_SHRINK = 8;

// 透视参数
export const PERSPECTIVE_RATIO = 0.4; // 顶部缩放比例
export const HORIZON_Y = 200; // 地平线 y 坐标
export const GROUND_Y = 550; // 地面底部 y 坐标

// 颜色
export const BG_COLOR = '#1a0a2e';
export const GROUND_COLOR = '#2d1b4e';
export const LANE_COLOR = '#3d2b5e';
export const LANE_LINE_COLOR = '#6d4b8e';
export const PLAYER_COLOR = '#00ff88';
export const OBSTACLE_HIGH_COLOR = '#ff4757';
export const OBSTACLE_LOW_COLOR = '#ffa502';
export const OBSTACLE_FULL_COLOR = '#ff6b81';
export const COIN_COLOR = '#ffd700';
export const COIN_GLOW_COLOR = '#ffed4a';
export const SCORE_COLOR = '#ffffff';
export const SKY_COLOR_TOP = '#0d0221';
export const SKY_COLOR_BOTTOM = '#1a0a2e';

// 障碍物类型
export enum ObstacleType {
  HIGH = 'high',   // 高障碍 - 需要滑铲
  LOW = 'low',     // 低障碍 - 需要跳跃
  FULL = 'full',   // 全宽障碍 - 需要切换跑道
}
