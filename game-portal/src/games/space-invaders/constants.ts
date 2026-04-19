// ========== Space Invaders 常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 480;
export const HUD_HEIGHT = 40;

// 玩家飞船
export const SHIP_WIDTH = 36;
export const SHIP_HEIGHT = 24;
export const SHIP_SPEED = 300; // px/s
export const SHIP_Y = CANVAS_HEIGHT - 50;
export const SHIP_COLOR = '#22d3ee';

// 子弹
export const BULLET_WIDTH = 3;
export const BULLET_HEIGHT = 10;
export const BULLET_SPEED = 400; // px/s
export const BULLET_COLOR = '#fbbf24';
export const MAX_BULLETS = 3;

// 外星人
export const ALIEN_WIDTH = 28;
export const ALIEN_HEIGHT = 20;
export const ALIEN_PADDING = 8;
export const ALIEN_ROWS = 5;
export const ALIEN_COLS = 8;
export const ALIEN_SPEED_BASE = 40; // px/s
export const ALIEN_SPEED_INCREASE = 5; // per alien killed
export const ALIEN_DROP = 15;
export const ALIEN_SHOOT_CHANCE = 0.002; // per alien per frame
export const ALIEN_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];
export const ALIEN_SCORES = [30, 25, 20, 15, 10]; // top to bottom

// 防护掩体
export const BUNKER_COUNT = 4;
export const BUNKER_WIDTH = 48;
export const BUNKER_HEIGHT = 32;
export const BUNKER_BLOCK_SIZE = 8;
export const BUNKER_Y = SHIP_Y - 60;
export const BUNKER_COLOR = '#22c55e';

// 游戏规则
export const INITIAL_LIVES = 3;
export const BG_COLOR = '#0a0a2e';
export const HUD_COLOR = '#ffffff';
