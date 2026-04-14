// ========== 飞行小鸟 Flappy Plane 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 飞机
export const PLANE_X = 80;
export const PLANE_WIDTH = 40;
export const PLANE_HEIGHT = 28;
export const PLANE_RADIUS = 14; // 碰撞检测半径
export const PLANE_SPEED = 5; // 上下移动速度（像素/帧）
export const PLANE_MIN_Y = 10; // 最小 Y 坐标
export const PLANE_MAX_Y_BUFFER = 10; // 距底部缓冲

// 障碍物（上下柱子）
export const OBSTACLE_WIDTH = 56;
export const OBSTACLE_GAP = 160; // 上下柱子间隙大小
export const OBSTACLE_SPEED = 2.5; // 像素/帧
export const OBSTACLE_SPAWN_INTERVAL = 1500; // 毫秒
export const OBSTACLE_MIN_HEIGHT = 50; // 柱子最短高度
export const OBSTACLE_CAP_HEIGHT = 20;
export const OBSTACLE_CAP_OVERHANG = 4;
export const OBSTACLE_COLOR = '#5f6caf';
export const OBSTACLE_BORDER_COLOR = '#3d4a8c';
export const OBSTACLE_HIGHLIGHT = 'rgba(255, 255, 255, 0.15)';

// 星星
export const STAR_SIZE = 16;
export const STAR_POINTS = 3; // 每颗星星加分
export const STAR_SPAWN_CHANCE = 0.6; // 60% 概率在障碍物间隙中生成星星
export const STAR_COLLECT_RADIUS = 20; // 收集判定半径

// 颜色
export const SKY_TOP = '#1a1a3e';
export const SKY_BOTTOM = '#2d2d6b';
export const GROUND_HEIGHT = 40;
export const GROUND_COLOR = '#2a2a5a';
export const GROUND_DARK = '#1e1e4a';
export const GROUND_LINE_COLOR = '#4a4a8a';
export const PLANE_BODY_COLOR = '#e8e8e8';
export const PLANE_WING_COLOR = '#a8a8d0';
export const PLANE_WINDOW_COLOR = '#4ecdc4';
export const PLANE_TAIL_COLOR = '#ff6b6b';
export const PLANE_ENGINE_COLOR = '#ffd93d';
export const STAR_COLOR = '#ffd93d';
export const STAR_GLOW_COLOR = 'rgba(255, 217, 61, 0.3)';
export const CLOUD_COLOR = 'rgba(255, 255, 255, 0.08)';
export const SCORE_COLOR = '#ffd93d';
export const TRAIL_COLOR = 'rgba(255, 217, 61, 0.4)';

// 计分
export const SCORE_PER_OBSTACLE = 1; // 穿越一个障碍+1分
export const LEVEL_UP_SCORE = 5; // 每 5 分升一级

// 难度递增
export const SPEED_INCREMENT = 0.2; // 每级速度增量
export const GAP_DECREMENT = 4; // 每级间距缩减量
export const MIN_GAP = 90; // 最小间隙
export const MAX_SPEED = 8; // 最大速度上限

// 爆炸效果
export const EXPLOSION_DURATION = 500; // 毫秒
export const EXPLOSION_PARTICLES = 12;
