// ========== Gravity Flip 重力翻转 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 地面和天花板
export const GROUND_Y = 560;
export const CEILING_Y = 40;
export const PLAY_AREA_HEIGHT = GROUND_Y - CEILING_Y; // 可用游戏区域高度

// 角色
export const PLAYER_WIDTH = 30;
export const PLAYER_HEIGHT = 30;
export const PLAYER_X = 80; // 角色固定 X 位置

// 物理参数
export const GRAVITY = 0.5; // 每帧加速度
export const FLIP_VELOCITY = -8; // 翻转时初始速度（反方向）
export const MAX_VELOCITY = 12; // 最大速度限制

// 速度参数（障碍物滚动速度）
export const INITIAL_SPEED = 4;
export const SPEED_INCREMENT = 0.15;
export const SPEED_INCREMENT_DISTANCE = 200; // 每200距离加速
export const MAX_SPEED = 12;

// 障碍物类型
export enum ObstacleType {
  GROUND_SPIKE = 'ground_spike',     // 地面尖刺
  CEILING_SPIKE = 'ceiling_spike',   // 天花板尖刺
  MIDDLE_BLOCK = 'middle_block',     // 中间方块
  DOUBLE_SPIKE = 'double_spike',     // 双面尖刺（上下都有）
}

// 尖刺尺寸
export const SPIKE_WIDTH = 30;
export const SPIKE_HEIGHT = 40;

// 中间方块尺寸
export const BLOCK_WIDTH = 40;
export const BLOCK_HEIGHT = 40;

// 障碍物生成间隔
export const MIN_OBSTACLE_INTERVAL = 600; // 毫秒
export const MAX_OBSTACLE_INTERVAL = 1500; // 毫秒
export const MIN_OBSTACLE_GAP = 200; // 障碍物之间最小间距（像素）

// 碰撞检测容差
export const HITBOX_SHRINK = 4;

// 粒子效果
export const PARTICLE_COUNT = 12; // 每次翻转生成的粒子数
export const PARTICLE_LIFETIME = 500; // 粒子生命周期（毫秒）
export const PARTICLE_SPEED = 4; // 粒子速度
export const PARTICLE_SIZE = 4; // 粒子大小

// 计分
export const SCORE_PER_DISTANCE = 0.1; // 每像素距离得分

// 颜色
export const BG_COLOR = '#0d0d20';
export const GROUND_COLOR = '#2ed573';
export const CEILING_COLOR = '#2ed573';
export const PLAYER_COLOR = '#ff4757';
export const PLAYER_GLOW_COLOR = '#ff6b81';
export const SPIKE_COLOR = '#ffa502';
export const BLOCK_COLOR = '#1e90ff';
export const PARTICLE_COLOR = '#00ff88';
export const SCORE_COLOR = '#ffffff';
export const GAME_OVER_COLOR = '#ff4757';
export const TRAIL_COLOR = '#ff475780';

// 重力方向
export enum GravityDirection {
  DOWN = 'down',
  UP = 'up',
}

// 星星（背景装饰）
export const STAR_COUNT = 50;
export const STAR_MIN_SIZE = 1;
export const STAR_MAX_SIZE = 3;
