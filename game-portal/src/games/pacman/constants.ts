// ========== Pac-Man 常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 480;
export const HUD_HEIGHT = 40;

// 网格
export const GRID_SIZE = 24;
export const COLS = 19;
export const ROWS = 21;

// 地图元素
export const WALL = 1;
export const DOT = 2;
export const POWER_PELLET = 3;
export const EMPTY = 0;
export const GHOST_HOME = 4;

// 玩家
export const PLAYER_SPEED = 2;
export const INITIAL_LIVES = 3;

// 幽灵
export const GHOST_SPEED = 1.8;
export const GHOST_COUNT = 3;
export const FRIGHTENED_DURATION = 8000;

// 计分
export const DOT_SCORE = 10;
export const POWER_PELLET_SCORE = 50;
export const GHOST_SCORE = 200;
export const GHOST_SCORE_MULTIPLIER = 2;

// 颜色
export const BG_COLOR = '#0a0a2e';
export const WALL_COLOR = '#1e3a5f';
export const DOT_COLOR = '#fbbf24';
export const PLAYER_COLOR = '#facc15';
export const GHOST_COLORS = ['#ef4444', '#f472b6', '#22d3ee'];
export const FRIGHTENED_COLOR = '#3b82f6';

// 方向
export const DIR_UP = 0;
export const DIR_DOWN = 1;
export const DIR_LEFT = 2;
export const DIR_RIGHT = 3;
export const DIR_NONE = -1;

export const DIR_DELTA: Record<number, { dx: number; dy: number }> = {
  [DIR_UP]: { dx: 0, dy: -1 },
  [DIR_DOWN]: { dx: 0, dy: 1 },
  [DIR_LEFT]: { dx: -1, dy: 0 },
  [DIR_RIGHT]: { dx: 1, dy: 0 },
};

// 经典简化迷宫（19x21）
export const MAZE_TEMPLATE: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,0,1,1,4,1,1,0,1,2,1,1,1,1],
  [0,0,0,0,2,0,0,1,0,0,0,1,0,0,2,0,0,0,0],
  [1,1,1,1,2,1,0,1,0,0,0,1,0,1,2,1,1,1,1],
  [0,0,0,1,2,1,0,1,1,1,1,1,0,1,2,1,0,0,0],
  [1,1,1,1,2,1,0,0,0,0,0,0,0,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
  [1,3,2,1,2,2,2,2,2,0,2,2,2,2,2,1,2,3,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];
