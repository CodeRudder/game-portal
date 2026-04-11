// ========== Flappy Bird 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 地面
export const GROUND_HEIGHT = 60;

// 小鸟
export const BIRD_X = 80;
export const BIRD_WIDTH = 34;
export const BIRD_HEIGHT = 26;
export const BIRD_RADIUS = 13; // 碰撞检测半径
export const GRAVITY = 0.45;
export const JUMP_FORCE = -7.5;
export const MAX_FALL_SPEED = 10;
export const BIRD_ROTATION_SPEED = 0.08;

// 管道
export const PIPE_WIDTH = 52;
export const PIPE_GAP = 140; // 上下管道间距
export const PIPE_SPEED = 2.5; // 像素/帧
export const PIPE_SPAWN_INTERVAL = 1600; // 毫秒
export const PIPE_MIN_HEIGHT = 60; // 管道最短高度
export const PIPE_COLOR = '#2ed573';
export const PIPE_BORDER_COLOR = '#1e9c4f';
export const PIPE_CAP_HEIGHT = 24;
export const PIPE_CAP_OVERHANG = 4;

// 颜色
export const SKY_TOP = '#4ec5f1';
export const SKY_BOTTOM = '#d4f1f9';
export const GROUND_COLOR = '#deb887';
export const GROUND_DARK = '#c4a265';
export const BIRD_BODY_COLOR = '#ffd32a';
export const BIRD_WING_COLOR = '#ff9f1a';
export const BIRD_BEAK_COLOR = '#ff6348';
export const BIRD_EYE_COLOR = '#2f3542';

// 分数
export const SCORE_PER_PIPE = 1;
export const LEVEL_UP_SCORE = 10; // 每 10 分升一级

// 难度递增
export const SPEED_INCREMENT = 0.15; // 每级速度增量
export const GAP_DECREMENT = 3; // 每级间距缩减量
export const MIN_GAP = 100; // 最小间距
