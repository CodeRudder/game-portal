// ========== Snake 2P 双人贪吃蛇常量 ==========

// 画布
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 网格
export const CELL_SIZE = 20;
export const COLS = CANVAS_WIDTH / CELL_SIZE;   // 24
export const ROWS = CANVAS_HEIGHT / CELL_SIZE;  // 32

// HUD 区域高度（顶部信息栏，按像素）
export const HUD_HEIGHT = 0; // 网格化，不单独留 HUD

// 蛇
export const INITIAL_LENGTH = 3;
export const SNAKE_SPEED = 150; // 毫秒/步，基础移动间隔
export const SPEED_INCREMENT = 5; // 每吃一个食物加速（毫秒减少）
export const MIN_SPEED = 60; // 最快速度下限

// 食物
export const FOOD_SCORE = 10;
export const SPECIAL_FOOD_SCORE = 30;
export const SPECIAL_FOOD_CHANCE = 0.15; // 特殊食物出现概率
export const SPECIAL_FOOD_TTL = 5000; // 特殊食物存活时间（毫秒）
export const MAX_FOOD_ON_BOARD = 3; // 场上最多同时存在的食物数

// 颜色
export const BG_COLOR = '#1a1a2e';
export const GRID_COLOR = 'rgba(255, 255, 255, 0.03)';
export const SNAKE1_COLOR = '#4fc3f7';       // 玩家1 蓝色
export const SNAKE1_HEAD_COLOR = '#29b6f6';
export const SNAKE2_COLOR = '#ef5350';        // 玩家2 红色
export const SNAKE2_HEAD_COLOR = '#e53935';
export const FOOD_COLOR = '#66bb6a';          // 普通食物 绿色
export const SPECIAL_FOOD_COLOR = '#ffd54f';  // 特殊食物 金色
export const HUD_COLOR = '#ffffff';
export const WALL_COLOR = 'rgba(255, 255, 255, 0.1)';

// 方向
export const DIRECTIONS = {
  UP:    { x:  0, y: -1 },
  DOWN:  { x:  0, y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x:  1, y:  0 },
} as const;

export type DirectionKey = keyof typeof DIRECTIONS;
export type Direction = { x: number; y: number };

// 玩家1 起始位置（左侧）
export const P1_START_X = Math.floor(COLS * 0.25);
export const P1_START_Y = Math.floor(ROWS / 2);
export const P1_START_DIR: Direction = DIRECTIONS.RIGHT;

// 玩家2 起始位置（右侧）
export const P2_START_X = Math.floor(COLS * 0.75) - INITIAL_LENGTH + 1;
export const P2_START_Y = Math.floor(ROWS / 2);
export const P2_START_DIR: Direction = DIRECTIONS.LEFT;
