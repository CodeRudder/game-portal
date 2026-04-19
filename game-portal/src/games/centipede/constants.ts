// ========== Centipede 蜈蚣常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 网格系统
export const COLS = 30;
export const ROWS = 30;
export const CELL_SIZE = CANVAS_WIDTH / COLS; // 16px
export const GRID_ROWS = ROWS; // 30 rows
export const HUD_HEIGHT = 0; // No separate HUD — score drawn on top

// 玩家区域（底部 4 行为玩家可活动区域）
export const PLAYER_ZONE_START_ROW = 26; // row 26-29

// ========== 玩家 ==========
export const PLAYER_SIZE = CELL_SIZE;
export const PLAYER_SPEED = 160; // pixels per second
export const PLAYER_COLOR = '#4fc3f7';
export const INITIAL_LIVES = 3;

// ========== 子弹 ==========
export const BULLET_WIDTH = 2;
export const BULLET_HEIGHT = 6;
export const BULLET_SPEED = 400; // pixels per second
export const BULLET_COLOR = '#ffffff';
export const MAX_BULLETS = 1; // 只能有一颗子弹在屏幕上

// ========== 蜈蚣 ==========
export const CENTIPEDE_INITIAL_LENGTH = 12; // 初始节数
export const CENTIPEDE_SPEED_BASE = 60; // pixels per second（水平移动速度）
export const CENTIPEDE_SPEED_PER_LEVEL = 8; // 每级增加速度
export const CENTIPEDE_DROP_SPEED = CELL_SIZE; // 每次下移一格
export const CENTIPEDE_SEGMENT_SIZE = CELL_SIZE;
export const CENTIPEDE_HEAD_COLOR = '#ff1744';
export const CENTIPEDE_BODY_COLOR = '#ff6d00';
export const CENTIPEDE_SCORE_HEAD = 100;
export const CENTIPEDE_SCORE_BODY = 10;

// ========== 蘑菇 ==========
export const MUSHROOM_SIZE = CELL_SIZE;
export const MUSHROOM_COLOR = '#66bb6a';
export const MUSHROOM_DAMAGED_COLOR = '#388e3c';
export const MUSHROOM_HEALTH = 4; // 需要击中 4 次才消除
export const MUSHROOM_SCORE = 1;
export const INITIAL_MUSHROOM_COUNT = 30; // 初始蘑菇数量
export const MUSHROOM_ZONE_START_ROW = 2; // 蘑菇不生成在顶部 2 行
export const MUSHROOM_ZONE_END_ROW = 25; // 蘑菇不生成在玩家区域

// ========== 蜘蛛 ==========
export const SPIDER_WIDTH = CELL_SIZE * 1.5;
export const SPIDER_HEIGHT = CELL_SIZE * 1.5;
export const SPIDER_SPEED_BASE = 100; // pixels per second
export const SPIDER_SPEED_PER_LEVEL = 15;
export const SPIDER_COLOR = '#e040fb';
export const SPIDER_SCORE = 300;
export const SPIDER_SPAWN_CHANCE = 0.005; // 每帧生成概率
export const SPIDER_MIN_SPAWN_INTERVAL = 3000; // 最小生成间隔（毫秒）
export const SPIDER_VERTICAL_RANGE = CELL_SIZE * 3; // 垂直移动范围

// ========== 波次 ==========
export const CENTIPEDE_LENGTH_PER_LEVEL = 2; // 每级增加的节数
export const CENTIPEDE_MAX_LENGTH = 20;

// ========== 颜色 ==========
export const BG_COLOR = '#0a0a0a';
export const GRID_COLOR = 'rgba(255,255,255,0.03)';
export const HUD_COLOR = '#ffffff';
export const SCORE_COLOR = '#ffd600';

// ========== 方向 ==========
export const DIR_LEFT = -1;
export const DIR_RIGHT = 1;
