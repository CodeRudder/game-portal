// ========== Frogger 青蛙过河常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;
export const HUD_HEIGHT = 40;

// ========== 网格 ==========
export const COLS = 12;
export const ROWS = 15;
export const CELL_SIZE = CANVAS_WIDTH / COLS; // 40

// ========== 青蛙 ==========
export const FROG_SIZE = CELL_SIZE - 4;       // 36 (留 2px 间距)
export const FROG_START_COL = Math.floor(COLS / 2); // 6
export const FROG_START_ROW = ROWS - 1;       // 14 (最底行)
export const FROG_JUMP_DURATION = 120;         // 跳跃动画持续时间 ms

// ========== 行类型定义（从上到下，row 0 ~ row 14）==========
// Row 0:  终点区（goal）
// Row 1-3: 河流（木头/乌龟）
// Row 4:  中间休息区
// Row 5-7: 车道（也可扩展）
// Row 8:  安全区
// Row 9-11: 车道
// Row 12: 安全区
// Row 13-14: 起始区

export const GOAL_ROW = 0;
export const RIVER_ROWS = [1, 2, 3];
export const MID_REST_ROW = 4;
export const ROAD_A_ROWS = [5, 6, 7];
export const SAFE_ROW_A = 8;
export const ROAD_B_ROWS = [9, 10, 11];
export const SAFE_ROW_B = 12;
export const START_ROWS = [13, 14];

// ========== 终点目标 ==========
export const GOAL_COUNT = 5;
export const GOAL_WIDTH = CELL_SIZE;
export const GOAL_POSITIONS: number[] = [1, 3, 5, 7, 9]; // col positions (0-indexed)

// ========== 车道配置 ==========
export interface LaneConfig {
  row: number;
  speed: number;       // 像素/秒（正=向右，负=向左）
  direction: 1 | -1;   // 1=右, -1=左
  vehicleType: 'car' | 'truck' | 'racecar';
  vehicleWidth: number; // 占几格
  gap: number;          // 车辆间距（格数）
  color: string;
}

export const LANE_CONFIGS: LaneConfig[] = [
  { row: 5,  speed: 80,  direction: -1, vehicleType: 'car',     vehicleWidth: 1, gap: 3, color: '#e74c3c' },
  { row: 6,  speed: 60,  direction: 1,  vehicleType: 'truck',   vehicleWidth: 2, gap: 4, color: '#f39c12' },
  { row: 7,  speed: 120, direction: -1, vehicleType: 'racecar', vehicleWidth: 1, gap: 2, color: '#9b59b6' },
  { row: 9,  speed: 70,  direction: 1,  vehicleType: 'car',     vehicleWidth: 1, gap: 3, color: '#2ecc71' },
  { row: 10, speed: 100, direction: -1, vehicleType: 'truck',   vehicleWidth: 2, gap: 4, color: '#3498db' },
  { row: 11, speed: 90,  direction: 1,  vehicleType: 'racecar', vehicleWidth: 1, gap: 2, color: '#e67e22' },
];

// ========== 河流配置 ==========
export interface RiverLaneConfig {
  row: number;
  speed: number;
  direction: 1 | -1;
  objectType: 'log' | 'turtle';
  objectWidth: number; // 占几格
  gap: number;
  color: string;
  canDive: boolean;      // 乌龟是否会潜水
  diveCycleDuration: number; // 潜水周期 ms
  diveDuration: number;      // 潜水持续时间 ms
}

export const RIVER_CONFIGS: RiverLaneConfig[] = [
  { row: 1, speed: 50,  direction: 1,  objectType: 'log',    objectWidth: 3, gap: 2, color: '#8B4513', canDive: false, diveCycleDuration: 0, diveDuration: 0 },
  { row: 2, speed: 70,  direction: -1, objectType: 'turtle', objectWidth: 2, gap: 2, color: '#2d6a4f', canDive: true,  diveCycleDuration: 4000, diveDuration: 1500 },
  { row: 3, speed: 40,  direction: 1,  objectType: 'log',    objectWidth: 4, gap: 2, color: '#A0522D', canDive: false, diveCycleDuration: 0, diveDuration: 0 },
];

// ========== 生命系统 ==========
export const INITIAL_LIVES = 3;

// ========== 计时器 ==========
export const ROUND_TIME_LIMIT = 30; // 每轮秒数

// ========== 计分 ==========
export const SCORE_FORWARD = 10;       // 每前进一步
export const SCORE_GOAL = 50;          // 到达一个终点
export const SCORE_TIME_BONUS_MAX = 100; // 时间奖励上限
export const SCORE_LEVEL_COMPLETE = 200; // 通关奖励

// ========== 关卡递进 ==========
export const SPEED_INCREMENT_PER_LEVEL = 0.2; // 每关速度增加 20%

// ========== 碰撞检测 ==========
export const COLLISION_TOLERANCE = 2; // 像素容差

// ========== 颜色 ==========
export const BG_COLOR = '#1a1a2e';
export const GRASS_COLOR = '#2d6a4f';
export const ROAD_COLOR = '#2c2c3a';
export const WATER_COLOR = '#1a5276';
export const GOAL_COLOR = '#f1c40f';
export const FROG_COLOR = '#27ae60';
export const HUD_COLOR = '#ffffff';
export const FROG_DEAD_COLOR = '#e74c3c';
