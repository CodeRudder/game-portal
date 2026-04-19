// ========== Slope Ball 游戏常量 ==========

// Canvas 尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 球体参数 ==========
export const BALL_RADIUS = 14;
export const BALL_INITIAL_X = CANVAS_WIDTH / 2;
export const BALL_Y = 520; // 球在画面中的固定垂直位置
export const BALL_MOVE_SPEED = 5; // 左右移动速度（像素/帧）
export const BALL_COLOR = '#00ff88';
export const BALL_GLOW_COLOR = 'rgba(0, 255, 136, 0.3)';

// ========== 斜坡/跑道参数 ==========
export const ROAD_LEFT = 40;
export const ROAD_RIGHT = CANVAS_WIDTH - 40;
export const ROAD_WIDTH = ROAD_RIGHT - ROAD_LEFT;
export const ROAD_COLOR = '#1a1a3e';
export const ROAD_LINE_COLOR = '#2a2a5e';
export const ROAD_EDGE_COLOR = '#3a3a7e';

// ========== 障碍物参数 ==========
export enum ObstacleType {
  BLOCK = 'block',
  GAP = 'gap',
  MOVING_BLOCK = 'moving_block',
}

export const BLOCK_WIDTH = 50;
export const BLOCK_HEIGHT = 20;
export const GAP_WIDTH = 80;
export const BLOCK_COLOR = '#ff4757';
export const BLOCK_GLOW_COLOR = 'rgba(255, 71, 87, 0.4)';
export const MOVING_BLOCK_COLOR = '#ffa502';
export const MOVING_BLOCK_GLOW_COLOR = 'rgba(255, 165, 2, 0.4)';

// 障碍物生成间隔（毫秒）
export const INITIAL_OBSTACLE_INTERVAL = 1200;
export const MIN_OBSTACLE_INTERVAL = 400;
export const OBSTACLE_INTERVAL_DECREASE = 5; // 每次生成后间隔减少量

// ========== 速度参数 ==========
export const INITIAL_SPEED = 3;
export const SPEED_INCREMENT = 0.15;
export const SPEED_INCREMENT_SCORE = 50; // 每50分加速
export const MAX_SPEED = 12;

// ========== 碰撞检测容差 ==========
export const HITBOX_SHRINK = 4;

// ========== 计分 ==========
export const SCORE_PER_FRAME = 0.1; // 每帧基础分

// ========== 视觉效果 ==========
export const STAR_COUNT = 60;
export const LANE_LINE_COUNT = 12;
export const LANE_LINE_HEIGHT = 30;
export const LANE_LINE_GAP = 25;
export const PERSPECTIVE_RATIO = 0.6; // 透视缩放比

// ========== 颜色主题 ==========
export const BG_COLOR_TOP = '#0a0a1a';
export const BG_COLOR_BOTTOM = '#1a1a3e';
export const STAR_COLOR = '#ffffff';
export const SCORE_COLOR = '#00ff88';
export const DISTANCE_COLOR = '#a0a0c0';
export const SPEED_INDICATOR_COLOR = '#ffa502';

// ========== 难度 ==========
export const LEVEL_UP_SCORE = 200; // 每200分升一级
export const MAX_LEVEL = 10;
