// ========== Geometry Dash Lite 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 地面
export const GROUND_Y = 540; // 地面 Y 坐标
export const CEILING_Y = 40; // 天花板 Y 坐标

// 玩家方块
export const PLAYER_SIZE = 36; // 方块边长
export const PLAYER_X = 80; // 方块固定 X 位置（屏幕左侧）

// 物理
export const GRAVITY = 0.65; // 重力加速度
export const JUMP_FORCE = -13; // 跳跃初速度
export const LONG_PRESS_EXTRA_FORCE = -0.35; // 长按额外向上力（每帧）
export const MAX_UPWARD_VELOCITY = -15; // 最大向上速度限制
export const MAX_FALL_VELOCITY = 18; // 最大下落速度限制

// 速度参数
export const INITIAL_SPEED = 5; // 初始滚动速度
export const SPEED_INCREMENT = 0.4; // 每个进度段的速度增量
export const SPEED_INCREMENT_INTERVAL = 10; // 每隔多少百分比加速
export const MAX_SPEED = 14; // 最大速度

// 障碍物类型
export enum ObstacleType {
  SPIKE = 'spike', // 尖刺（三角形）
  BLOCK = 'block', // 方块
  PILLAR = 'pillar', // 柱子
}

// 障碍物尺寸
export const SPIKE_WIDTH = 36;
export const SPIKE_HEIGHT = 36;
export const BLOCK_SIZE = 36;
export const PILLAR_WIDTH = 36;
export const PILLAR_MIN_HEIGHT = 72;
export const PILLAR_MAX_HEIGHT = 180;

// 碰撞检测容差（缩小 hitbox 使游戏更友好）
export const HITBOX_SHRINK = 6;

// 障碍物生成
export const MIN_OBSTACLE_GAP = 200; // 障碍物之间最小间距（像素）
export const MAX_OBSTACLE_GAP = 400; // 障碍物之间最大间距（像素）

// 关卡总长度（障碍物总跨度，像素）
export const LEVEL_LENGTH = 8000;

// 进度
export const PROGRESS_SCALE = 100; // 进度百分比换算系数

// 颜色
export const BG_COLOR = '#1a0a2e';
export const BG_GRADIENT_TOP = '#0d0221';
export const BG_GRADIENT_BOTTOM = '#1a0a2e';
export const GROUND_COLOR = '#2d1b69';
export const GROUND_LINE_COLOR = '#6c3ce0';
export const CEILING_COLOR = '#2d1b69';
export const PLAYER_COLOR = '#00ff88';
export const PLAYER_OUTLINE_COLOR = '#00cc6a';
export const SPIKE_COLOR = '#ff4757';
export const BLOCK_COLOR = '#ff6b81';
export const PILLAR_COLOR = '#ff4757';
export const PROGRESS_BAR_BG = '#1a1a3e';
export const PROGRESS_BAR_FILL = '#00ff88';
export const PROGRESS_TEXT_COLOR = '#ffffff';
export const SCORE_COLOR = '#ffffff';
export const DEATH_OVERLAY_COLOR = 'rgba(255, 0, 0, 0.3)';
export const PARTICLE_COLOR = '#ff4757';

// 粒子效果
export const DEATH_PARTICLE_COUNT = 20;
export const PARTICLE_MIN_SPEED = 2;
export const PARTICLE_MAX_SPEED = 8;
export const PARTICLE_LIFETIME = 800; // 毫秒

// 地面装饰
export const GROUND_PATTERN_SPACING = 48;

// 关卡定义类型
export interface LevelObstacle {
  type: ObstacleType;
  /** 障碍物相对于关卡起点的 X 偏移 */
  x: number;
  /** 障碍物 Y 位置（从地面算起的偏移，0 = 地面） */
  yOffset: number;
  width: number;
  height: number;
}

export interface LevelDefinition {
  id: number;
  name: string;
  obstacles: LevelObstacle[];
  length: number;
}

// ========== 预设关卡 ==========
export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    name: '初次起跑',
    length: LEVEL_LENGTH,
    obstacles: [
      // 第一段：简单尖刺
      { type: ObstacleType.SPIKE, x: 400, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 600, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 850, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      // 第二段：方块
      { type: ObstacleType.BLOCK, x: 1100, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 1350, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 1550, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      // 第三段：连续尖刺
      { type: ObstacleType.SPIKE, x: 1850, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 1900, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 2200, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      // 第四段：柱子
      { type: ObstacleType.PILLAR, x: 2500, yOffset: 0, width: PILLAR_WIDTH, height: 108 },
      { type: ObstacleType.SPIKE, x: 2800, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 2850, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      // 第五段：混合
      { type: ObstacleType.BLOCK, x: 3100, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 3200, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 3500, yOffset: 0, width: PILLAR_WIDTH, height: 90 },
      { type: ObstacleType.SPIKE, x: 3800, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 3850, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 3900, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      // 第六段：密集区
      { type: ObstacleType.BLOCK, x: 4200, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.BLOCK, x: 4260, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 4500, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 4800, yOffset: 0, width: PILLAR_WIDTH, height: 144 },
      { type: ObstacleType.SPIKE, x: 5100, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 5150, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 5400, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 5500, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 5800, yOffset: 0, width: PILLAR_WIDTH, height: 120 },
      { type: ObstacleType.SPIKE, x: 6100, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 6150, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 6200, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 6500, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.BLOCK, x: 6560, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 6800, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 7100, yOffset: 0, width: PILLAR_WIDTH, height: 144 },
      { type: ObstacleType.SPIKE, x: 7400, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 7450, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 7700, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
    ],
  },
  {
    id: 2,
    name: '节奏加速',
    length: LEVEL_LENGTH * 1.2,
    obstacles: [
      // 更密集的障碍物序列
      { type: ObstacleType.SPIKE, x: 350, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 400, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 650, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 800, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 1000, yOffset: 0, width: PILLAR_WIDTH, height: 108 },
      { type: ObstacleType.SPIKE, x: 1250, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 1300, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 1350, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 1600, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.BLOCK, x: 1660, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.PILLAR, x: 1900, yOffset: 0, width: PILLAR_WIDTH, height: 144 },
      { type: ObstacleType.SPIKE, x: 2200, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 2400, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 2550, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 2600, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 2850, yOffset: 0, width: PILLAR_WIDTH, height: 126 },
      { type: ObstacleType.SPIKE, x: 3100, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 3150, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 3200, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 3450, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.PILLAR, x: 3700, yOffset: 0, width: PILLAR_WIDTH, height: 162 },
      { type: ObstacleType.SPIKE, x: 4000, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 4200, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 4350, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 4400, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 4650, yOffset: 0, width: PILLAR_WIDTH, height: 144 },
      { type: ObstacleType.SPIKE, x: 4900, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 4950, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 5000, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 5050, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 5300, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.BLOCK, x: 5360, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.PILLAR, x: 5600, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.SPIKE, x: 5900, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 5950, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 6200, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 6400, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 6650, yOffset: 0, width: PILLAR_WIDTH, height: 144 },
      { type: ObstacleType.SPIKE, x: 6900, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 6950, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 7000, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 7250, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.PILLAR, x: 7500, yOffset: 0, width: PILLAR_WIDTH, height: 162 },
      { type: ObstacleType.SPIKE, x: 7800, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 7850, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 8100, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 8300, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 8350, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 8400, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 8700, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.SPIKE, x: 9000, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 9050, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 9300, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 9500, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
    ],
  },
  {
    id: 3,
    name: '极限挑战',
    length: LEVEL_LENGTH * 1.5,
    obstacles: [
      // 极高难度密集障碍物
      { type: ObstacleType.SPIKE, x: 300, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 350, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 550, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 650, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 800, yOffset: 0, width: PILLAR_WIDTH, height: 144 },
      { type: ObstacleType.SPIKE, x: 1000, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 1050, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 1100, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 1300, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.BLOCK, x: 1360, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.BLOCK, x: 1420, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.PILLAR, x: 1650, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.SPIKE, x: 1900, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 1950, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 2000, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 2050, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 2250, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.PILLAR, x: 2450, yOffset: 0, width: PILLAR_WIDTH, height: 162 },
      { type: ObstacleType.SPIKE, x: 2700, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 2750, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 2950, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.BLOCK, x: 3010, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.PILLAR, x: 3200, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.SPIKE, x: 3450, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 3500, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 3550, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 3750, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.PILLAR, x: 3950, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.SPIKE, x: 4200, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 4250, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 4300, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 4350, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 4400, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 4600, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.BLOCK, x: 4660, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.PILLAR, x: 4900, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.SPIKE, x: 5150, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 5200, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 5250, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 5500, yOffset: 0, width: PILLAR_WIDTH, height: 162 },
      { type: ObstacleType.BLOCK, x: 5750, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 5900, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 5950, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 6000, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 6050, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 6300, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.BLOCK, x: 6550, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.BLOCK, x: 6610, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 6800, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 6850, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 6900, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 7150, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.SPIKE, x: 7400, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 7450, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 7500, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 7550, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 7750, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.PILLAR, x: 8000, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.SPIKE, x: 8250, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 8300, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 8350, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 8550, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.BLOCK, x: 8610, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 8850, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 8900, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 8950, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 9000, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 9250, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.SPIKE, x: 9550, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 9600, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 9650, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 9900, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 10100, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 10150, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 10200, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 10250, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.PILLAR, x: 10500, yOffset: 0, width: PILLAR_WIDTH, height: 180 },
      { type: ObstacleType.SPIKE, x: 10800, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 10850, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.BLOCK, x: 11100, yOffset: 0, width: BLOCK_SIZE, height: BLOCK_SIZE },
      { type: ObstacleType.SPIKE, x: 11300, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 11350, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
      { type: ObstacleType.SPIKE, x: 11400, yOffset: 0, width: SPIKE_WIDTH, height: SPIKE_HEIGHT },
    ],
  },
];
