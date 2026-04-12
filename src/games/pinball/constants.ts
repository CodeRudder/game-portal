// ========== Pinball 弹珠台常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;
export const HUD_HEIGHT = 40;

// ========== 物理参数 ==========
export const GRAVITY = 0.15;             // 重力加速度（像素/帧²）
export const FRICTION = 0.999;           // 速度衰减系数
export const RESTITUTION = 0.6;          // 弹性系数（碰撞后速度保留比例）
export const WALL_RESTITUTION = 0.7;     // 墙壁弹性系数
export const MAX_BALL_SPEED = 15;        // 球最大速度
export const MIN_BALL_SPEED = 0.5;       // 球最小速度阈值

// ========== 弹珠 ==========
export const BALL_RADIUS = 8;
export const BALL_COLOR = '#e0e0e0';
export const BALL_HIGHLIGHT = '#ffffff';

// ========== 挡板（Flipper）==========
export const FLIPPER_LENGTH = 70;        // 挡板长度
export const FLIPPER_WIDTH = 12;         // 挡板宽度
export const FLIPPER_REST_ANGLE = 0.45;  // 静止时角度（弧度，相对水平）
export const FLIPPER_ACTIVE_ANGLE = -0.45; // 激活时角度
export const FLIPPER_ANGULAR_VELOCITY = 0.25; // 翻转角速度（弧度/帧）
export const FLIPPER_Y = 580;           // 挡板 Y 坐标
export const LEFT_FLIPPER_X = 130;      // 左挡板枢轴 X
export const RIGHT_FLIPPER_X = 350;     // 右挡板枢轴 X
export const FLIPPER_COLOR = '#ff6f00';
export const FLIPPER_PIVOT_COLOR = '#ffab00';

// ========== Bumper（得分区）==========
export const BUMPER_RADIUS = 22;
export const BUMPER_HIT_DURATION = 10;   // 碰撞闪烁持续帧数
export const BUMPER_RESTITUTION = 1.2;   // bumper 弹性（>1 给球加速）

export interface BumperDef {
  x: number;
  y: number;
  radius: number;
  score: number;
  color: string;
}

export const BUMPER_DEFS: BumperDef[] = [
  { x: 240, y: 180, radius: 28, score: 100, color: '#ff1744' },
  { x: 150, y: 260, radius: 22, score: 75,  color: '#ff9100' },
  { x: 330, y: 260, radius: 22, score: 75,  color: '#ff9100' },
  { x: 200, y: 140, radius: 18, score: 50,  color: '#ffea00' },
  { x: 280, y: 140, radius: 18, score: 50,  color: '#ffea00' },
  { x: 240, y: 340, radius: 20, score: 150, color: '#d500f9' },
  { x: 120, y: 360, radius: 16, score: 50,  color: '#ffea00' },
  { x: 360, y: 360, radius: 16, score: 50,  color: '#ffea00' },
];

// ========== 墙壁/斜面 ==========
export interface WallDef {
  x1: number; y1: number;
  x2: number; y2: number;
}

// 底部排水口两侧的导轨
export const WALL_DEFS: WallDef[] = [
  // 左侧导轨（从左壁到左挡板）
  { x1: 30, y1: 500, x2: LEFT_FLIPPER_X - 10, y2: FLIPPER_Y },
  // 右侧导轨（从右壁到右挡板）
  { x1: CANVAS_WIDTH - 30, y1: 500, x2: RIGHT_FLIPPER_X + 10, y2: FLIPPER_Y },
  // 顶部弧线近似线段
  { x1: 30, y1: 80, x2: 80, y2: HUD_HEIGHT + 10 },
  { x1: 80, y1: HUD_HEIGHT + 10, x2: 400, y2: HUD_HEIGHT + 10 },
  { x1: 400, y1: HUD_HEIGHT + 10, x2: 450, y2: 80 },
];

// ========== 发射器 ==========
export const LAUNCHER_X = 455;           // 发射器 X 位置（右侧通道）
export const LAUNCHER_Y = 610;           // 发射器底部 Y
export const LAUNCHER_WIDTH = 20;        // 发射器通道宽度
export const LAUNCHER_MAX_POWER = 18;    // 最大发射力
export const LAUNCHER_CHARGE_RATE = 0.3; // 蓄力速率
export const LAUNCHER_COLOR = '#76ff03';

// ========== 生命系统 ==========
export const INITIAL_LIVES = 3;

// ========== 多球模式 ==========
export const MULTI_BALL_SCORE = 2000;    // 触发多球模式的分数阈值
export const MULTI_BALL_COUNT = 3;       // 多球模式球数
export const MULTI_BALL_SPEED = 6;       // 多球模式初始速度

// ========== 连击系统 ==========
export const COMBO_TIMEOUT = 120;        // 连击超时帧数（约2秒）
export const COMBO_MULTIPLIER_BASE = 1;  // 基础连击倍率
export const COMBO_MULTIPLIER_STEP = 0.5; // 每次连击增加的倍率
export const MAX_COMBO_MULTIPLIER = 5;   // 最大连击倍率

// ========== 粒子特效 ==========
export const PARTICLE_COUNT = 8;         // 每次碰撞产生的粒子数
export const PARTICLE_LIFE = 30;         // 粒子生命帧数
export const PARTICLE_MAX_SPEED = 4;     // 粒子最大速度
export const PARTICLE_MIN_SIZE = 1;      // 粒子最小尺寸
export const PARTICLE_MAX_SIZE = 4;      // 粒子最大尺寸

// ========== 台面边界 ==========
export const TABLE_LEFT = 30;
export const TABLE_RIGHT = CANVAS_WIDTH - 30;
export const TABLE_TOP = HUD_HEIGHT;
export const TABLE_BOTTOM = CANVAS_HEIGHT;

// ========== 颜色 ==========
export const BG_COLOR = '#1a1a2e';
export const TABLE_COLOR = '#16213e';
export const WALL_COLOR = '#0f3460';
export const RAIL_COLOR = '#533483';
export const HUD_COLOR = '#ffffff';
export const DRAIN_COLOR = '#e94560';

// ========== 得分区 ==========
export interface ScoreLaneDef {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  color: string;
}

export const SCORE_LANES: ScoreLaneDef[] = [
  { x: 80, y: 420, width: 60, height: 8, score: 200, color: '#00e5ff' },
  { x: 160, y: 420, width: 60, height: 8, score: 200, color: '#00e5ff' },
  { x: 260, y: 420, width: 60, height: 8, score: 200, color: '#00e5ff' },
  { x: 340, y: 420, width: 60, height: 8, score: 200, color: '#00e5ff' },
];

// ========== 等级系统 ==========
export const LEVEL_SCORE_THRESHOLD = 3000; // 每 3000 分升一级
export const LEVEL_SPEED_INCREASE = 0.02;  // 每级重力增加
