// ========== Breakout 打砖块常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;
export const HUD_HEIGHT = 40;

// 挡板
export const PADDLE_WIDTH = 80;
export const PADDLE_HEIGHT = 12;
export const PADDLE_Y = CANVAS_HEIGHT - 40;
export const PADDLE_SPEED = 8;
export const PADDLE_COLOR = '#4fc3f7';

// 弹球
export const BALL_RADIUS = 6;
export const BALL_SPEED = 4;
export const BALL_SPEED_INCREASE = 0.5;
export const BALL_MAX_SPEED = 8;
export const BALL_COLOR = '#ffffff';

// 砖块
export const BRICK_ROWS = 5;
export const BRICK_COLS = 8;
export const BRICK_WIDTH = 52;
export const BRICK_HEIGHT = 20;
export const BRICK_PADDING = 4;
export const BRICK_OFFSET_TOP = HUD_HEIGHT + 30;
export const BRICK_OFFSET_LEFT = Math.floor(
  (CANVAS_WIDTH - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING)) / 2
);

export const BRICK_COLORS = ['#ef5350', '#ff9800', '#ffeb3b', '#66bb6a', '#42a5f5'];
export const BRICK_SCORES = [50, 40, 30, 20, 10];

// 生命
export const INITIAL_LIVES = 3;

// 颜色
export const BG_COLOR = '#0a0a2e';
export const HUD_COLOR = '#ffffff';
