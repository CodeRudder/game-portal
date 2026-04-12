// ========== Tron 贪吃虫常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;
export const HUD_HEIGHT = 50;

export const GRID_SIZE = 10; // 每个格子像素
export const GRID_COLS = Math.floor(CANVAS_WIDTH / GRID_SIZE); // 48
export const GRID_ROWS = Math.floor((CANVAS_HEIGHT - HUD_HEIGHT) / GRID_SIZE); // 59

export const INITIAL_SPEED = 80; // ms per move
export const SPEED_INCREASE = 2; // 每10分加速量(ms减少)
export const MIN_SPEED = 30;
export const SPEED_SCORE_INTERVAL = 50; // 每多少分加速一次

export const PLAYER_COLORS = ['#00ff88', '#ff4488']; // 玩家1绿，玩家2粉
export const TRAIL_COLORS = ['rgba(0, 204, 102, 0.6)', 'rgba(204, 51, 102, 0.6)'];
export const HEAD_COLORS = ['#00ffaa', '#ff66aa'];

export const GRID_BG_COLOR = '#0a0a1a';
export const GRID_LINE_COLOR = '#1a1a3a';

export enum Direction {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
}

export const OPPOSITE: Record<Direction, Direction> = {
  [Direction.UP]: Direction.DOWN,
  [Direction.DOWN]: Direction.UP,
  [Direction.LEFT]: Direction.RIGHT,
  [Direction.RIGHT]: Direction.LEFT,
};

export const DIR_DELTA: Record<Direction, { dr: number; dc: number }> = {
  [Direction.UP]: { dr: -1, dc: 0 },
  [Direction.DOWN]: { dr: 1, dc: 0 },
  [Direction.LEFT]: { dr: 0, dc: -1 },
  [Direction.RIGHT]: { dr: 0, dc: 1 },
};
