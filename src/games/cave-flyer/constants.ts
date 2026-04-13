// ========== Cave Flyer 洞穴飞行 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 直升机
export const HELICOPTER_X = 100; // 屏幕左侧 1/4 处附近
export const HELICOPTER_WIDTH = 36;
export const HELICOPTER_HEIGHT = 20;
export const HELICOPTER_RADIUS = 12; // 碰撞检测半径
export const GRAVITY = 0.35;
export const THRUST_FORCE = -0.65; // 按住时向上的推力
export const MAX_RISE_SPEED = -6;
export const MAX_FALL_SPEED = 8;

// 洞穴地形
export const TERRAIN_SEGMENT_WIDTH = 4; // 每段地形宽度（像素）
export const INITIAL_CAVE_GAP = 300; // 初始洞穴上下间距
export const MIN_CAVE_GAP = 120; // 最小洞穴间距
export const GAP_DECREMENT = 2; // 每级间距缩减量
export const TERRAIN_ROUGHNESS = 0.6; // 地形随机起伏幅度
export const TERRAIN_SMOOTHNESS = 0.85; // 地形平滑系数（0-1，越大越平滑）
export const MIN_CEILING_HEIGHT = 40; // 天花板最低高度
export const MIN_FLOOR_HEIGHT = 40; // 地板最低高度

// 障碍物（石笋）
export const OBSTACLE_WIDTH = 30;
export const OBSTACLE_MIN_HEIGHT = 30;
export const OBSTACLE_MAX_HEIGHT = 80;
export const OBSTACLE_SPAWN_DISTANCE = 300; // 障碍物生成间距（像素）
export const OBSTACLE_GAP = 100; // 障碍物间通过间隙

// 星星
export const STAR_RADIUS = 10;
export const STAR_POINTS = 10; // 每颗星星得分
export const STAR_SPAWN_DISTANCE = 250; // 星星生成间距（像素）
export const STAR_COLLECT_DISTANCE = 22; // 收集距离

// 速度
export const INITIAL_SPEED = 2.5; // 初始滚动速度（像素/帧）
export const SPEED_INCREMENT = 0.12; // 每级速度增量
export const MAX_SPEED = 7;

// 距离计分
export const DISTANCE_SCORE_INTERVAL = 50; // 每 N 像素距离得 1 分
export const DISTANCE_SCORE_POINTS = 1;

// 升级
export const LEVEL_UP_DISTANCE = 800; // 每 N 像素距离升一级

// 颜色
export const CAVE_BG_TOP = '#1a0a2e';
export const CAVE_BG_BOTTOM = '#16213e';
export const CEILING_COLOR = '#4a3728';
export const CEILING_BORDER_COLOR = '#6b5344';
export const FLOOR_COLOR = '#3d2b1f';
export const FLOOR_BORDER_COLOR = '#5c4033';
export const OBSTACLE_COLOR = '#5c4033';
export const OBSTACLE_BORDER_COLOR = '#7a5c47';
export const HELICOPTER_BODY_COLOR = '#ff6348';
export const HELICOPTER_ROTOR_COLOR = '#dfe6e9';
export const HELICOPTER_SKID_COLOR = '#636e72';
export const HELICOPTER_WINDOW_COLOR = '#74b9ff';
export const STAR_COLOR = '#ffd32a';
export const STAR_GLOW_COLOR = 'rgba(255, 211, 42, 0.3)';
export const HUD_COLOR = '#ffffff';
export const HUD_SHADOW_COLOR = 'rgba(0, 0, 0, 0.5)';

// 推力指示器
export const THRUST_INDICATOR_COLOR = 'rgba(255, 165, 0, 0.6)';
export const EXHAUST_COLOR = 'rgba(255, 100, 50, 0.5)';
