// ========== 祖玛 Zuma 游戏常量 ==========

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 球的半径 */
export const BALL_RADIUS = 14;

/** 球直径 */
export const BALL_DIAMETER = BALL_RADIUS * 2;

/** 发射器位置（画布中心） */
export const SHOOTER_X = CANVAS_WIDTH / 2;
export const SHOOTER_Y = CANVAS_HEIGHT / 2;

/** 发射器长度 */
export const SHOOTER_LENGTH = 30;

/** 发射器旋转速度（弧度/帧） */
export const SHOOTER_ROTATE_SPEED = 0.05;

/** 射出球速度（像素/帧） */
export const SHOT_SPEED = 8;

/** 球链基础移动速度（路径点/帧） */
export const CHAIN_SPEED_BASE = 0.3;

/** 每关速度增量 */
export const CHAIN_SPEED_PER_LEVEL = 0.05;

/** 初始球颜色数量 */
export const INITIAL_COLOR_COUNT = 3;

/** 最大球颜色数量 */
export const MAX_COLOR_COUNT = 6;

/** 每几关增加一种颜色 */
export const COLORS_PER_LEVELS = 3;

/** 消除最少连球数 */
export const MIN_MATCH = 3;

/** 基础消除得分（每个球） */
export const BASE_SCORE_PER_BALL = 10;

/** 连锁消除额外加分倍率 */
export const COMBO_MULTIPLIER = 1.5;

/** 初始球链长度 */
export const INITIAL_CHAIN_LENGTH = 20;

/** 每关增加的球链长度 */
export const CHAIN_LENGTH_PER_LEVEL = 5;

/** 最大球链长度 */
export const MAX_CHAIN_LENGTH = 60;

/** 路径点数量（预计算） */
export const PATH_POINTS_COUNT = 600;

/** 球颜色定义 */
export const BALL_COLORS = [
  '#ff4757', // 红
  '#2ed573', // 绿
  '#1e90ff', // 蓝
  '#ffa502', // 橙
  '#a55eea', // 紫
  '#ff6b81', // 粉
];

/** 球颜色名称 */
export const BALL_COLOR_NAMES = [
  'red',
  'green',
  'blue',
  'orange',
  'purple',
  'pink',
];

/** 背景色 */
export const BG_COLOR = '#1a0a2e';

/** 轨道颜色 */
export const TRACK_COLOR = '#2d1b4e';

/** 发射器颜色 */
export const SHOOTER_COLOR = '#ffffff';

/** 发射器外圈颜色 */
export const SHOOTER_RING_COLOR = '#6c5ce7';

/** 文字颜色 */
export const TEXT_COLOR = '#ffffff';

/** 分数文字颜色 */
export const SCORE_COLOR = '#ffd700';

/** 路径安全距离（终点判定） */
export const END_ZONE_DISTANCE = 20;
