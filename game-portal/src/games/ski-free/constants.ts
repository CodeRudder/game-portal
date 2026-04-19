// ========== SkiFree 滑雪大冒险常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 滑雪者 ==========
export const SKIER_WIDTH = 20;
export const SKIER_HEIGHT = 24;
export const SKIER_SPEED_BASE = 150;       // 基础前进速度（像素/秒）
export const SKIER_SPEED_MIN = 80;         // 最低速度
export const SKIER_SPEED_MAX = 400;        // 最高速度
export const SKIER_SPEED_ACCEL = 60;       // 加速增量/秒
export const SKIER_SPEED_BRAKE = 80;       // 刹车减量/秒
export const SKIER_SPEED_FRICTION = 10;    // 自然减速/秒
export const SKIER_TURN_SPEED = 200;       // 左右转向速度（像素/秒）
export const SKIER_COLOR = '#e53935';
export const SKIER_COLOR_CRASHED = '#ff9800';

// ========== 滑雪者方向角度 ==========
export const SKIER_ANGLE_LEFT = -0.4;      // 左转角度（弧度）
export const SKIER_ANGLE_RIGHT = 0.4;      // 右转角度（弧度）
export const SKIER_ANGLE_STRAIGHT = 0;     // 直行角度
export const SKIER_TURN_RATE = 1.5;        // 转向速率（弧度/秒）

// ========== 障碍物 ==========
export const TREE_WIDTH = 28;
export const TREE_HEIGHT = 36;
export const TREE_COLOR = '#2e7d32';
export const TREE_TRUNK_COLOR = '#5d4037';

export const ROCK_WIDTH = 24;
export const ROCK_HEIGHT = 20;
export const ROCK_COLOR = '#757575';

export const SNOW_PILE_WIDTH = 30;
export const SNOW_PILE_HEIGHT = 16;
export const SNOW_PILE_COLOR = '#e0e0e0';

// ========== 跳台 ==========
export const RAMP_WIDTH = 36;
export const RAMP_HEIGHT = 20;
export const RAMP_COLOR = '#1565c0';
export const RAMP_SCORE = 100;

// ========== 跳跃 ==========
export const JUMP_DURATION = 600;          // 跳跃持续时间（毫秒）
export const JUMP_HEIGHT = 40;             // 跳跃视觉高度
export const JUMP_TRICK_SCORE = 50;        // 特技得分

// ========== 雪怪 ==========
export const YETI_WIDTH = 32;
export const YETI_HEIGHT = 40;
export const YETI_COLOR = '#90a4ae';
export const YETI_SPEED = 180;             // 雪怪追逐速度
export const YETI_APPEAR_DISTANCE = 1500;  // 滑行多少距离后雪怪出现
export const YETI_CATCH_DISTANCE = 20;     // 雪怪抓住玩家的距离

// ========== 地形生成 ==========
export const TERRAIN_SPAWN_INTERVAL = 300;  // 生成新障碍物行的间隔（毫秒）
export const TERRAIN_MIN_GAP = 60;         // 障碍物之间最小间距
export const OBSTACLE_DENSITY = 0.12;      // 障碍物生成密度（0-1）
export const RAMP_CHANCE = 0.08;           // 跳台出现概率
export const TREE_CHANCE = 0.55;           // 树木概率（在障碍物中）
export const ROCK_CHANCE = 0.30;           // 岩石概率
export const SNOW_PILE_CHANCE = 0.15;      // 雪堆概率

// ========== 雪花粒子 ==========
export const SNOWFLAKE_COUNT = 40;
export const SNOWFLAKE_SPEED_MIN = 30;
export const SNOWFLAKE_SPEED_MAX = 80;
export const SNOWFLAKE_SIZE_MIN = 1;
export const SNOWFLAKE_SIZE_MAX = 3;

// ========== 计分 ==========
export const DISTANCE_SCORE_RATE = 0.1;    // 每像素距离得分
export const SPEED_BONUS_MULTIPLIER = 0.5; // 速度加成系数

// ========== 颜色 ==========
export const BG_COLOR = '#eceff1';         // 雪地背景
export const SNOW_TRAIL_COLOR = '#b0bec5'; // 滑雪轨迹
export const HUD_COLOR = '#263238';
export const HUD_BG_COLOR = 'rgba(255,255,255,0.7)';
export const SCORE_COLOR = '#1b5e20';

// ========== 碰撞容差 ==========
export const COLLISION_TOLERANCE = 4;      // 碰撞检测容差（像素）

// ========== 障碍物类型 ==========
export const OBSTACLE_TREE = 'tree';
export const OBSTACLE_ROCK = 'rock';
export const OBSTACLE_SNOW_PILE = 'snow_pile';
export const OBSTACLE_RAMP = 'ramp';
export type ObstacleType = typeof OBSTACLE_TREE | typeof OBSTACLE_ROCK | typeof OBSTACLE_SNOW_PILE | typeof OBSTACLE_RAMP;

// ========== 难度递增 ==========
export const DIFFICULTY_INCREASE_RATE = 0.001; // 每像素距离增加的密度
export const MAX_OBSTACLE_DENSITY = 0.25;
