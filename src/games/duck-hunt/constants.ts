// ========== Duck Hunt 打鸭子常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 准心（玩家控制） ==========
export const CROSSHAIR_SIZE = 24;
export const CROSSHAIR_SPEED = 300; // pixels per second
export const CROSSHAIR_COLOR = '#ff1744';

// ========== 鸭子 ==========
export const DUCK_WIDTH = 40;
export const DUCK_HEIGHT = 32;
export const DUCK_SPEED_BASE = 120; // pixels per second
export const DUCK_SPEED_PER_LEVEL = 15; // 每级增加速度
export const DUCK_SPEED_MAX = 280;
export const DUCK_SCORE_NORMAL = 100;
export const DUCK_SCORE_FAST = 200;
export const DUCK_SCORE_ZIGZAG = 300;
export const DUCK_HIT_RADIUS = 24; // 碰撞检测半径

// ========== 飞行模式 ==========
export const FLIGHT_STRAIGHT = 'straight';
export const FLIGHT_WAVE = 'wave';
export const FLIGHT_RANDOM = 'random';

// ========== 回合设置 ==========
export const DUCKS_PER_ROUND = 10;
export const BULLETS_PER_ROUND = 3;
export const INITIAL_ROUNDS = 3; // 初始生命数（可玩的回合数）

// ========== 鸭子生成 ==========
export const DUCK_SPAWN_DELAY = 800; // ms，鸭子之间的生成间隔
export const DUCK_ESCAPE_Y = -50; // 鸭子飞出顶部后判定为逃逸
export const DUCK_FALL_SPEED = 200; // pixels per second，被击中后下落速度

// ========== 猎犬 ==========
export const DOG_WIDTH = 48;
export const DOG_HEIGHT = 40;
export const DOG_JUMP_DURATION = 800; // ms
export const DOG_LAUGH_DURATION = 1200; // ms
export const DOG_HIDE_Y = CANVAS_HEIGHT; // 草丛底部
export const DOG_PEAK_Y = CANVAS_HEIGHT - 200; // 跳跃最高点

// ========== 草丛 ==========
export const GRASS_HEIGHT = 80;
export const GRASS_Y = CANVAS_HEIGHT - GRASS_HEIGHT;
export const GRASS_COLOR = '#2e7d32';
export const GRASS_DARK_COLOR = '#1b5e20';

// ========== 颜色 ==========
export const BG_COLOR = '#87ceeb'; // 天空蓝
export const BG_CLOUD_COLOR = '#ffffff';
export const DUCK_COLOR_NORMAL = '#8d6e63';
export const DUCK_COLOR_FAST = '#1565c0';
export const DUCK_COLOR_ZIGZAG = '#e65100';
export const DUCK_WING_COLOR = '#5d4037';
export const DOG_COLOR = '#d4a574';
export const DOG_SPOT_COLOR = '#8d6e63';
export const HUD_COLOR = '#ffffff';
export const SCORE_COLOR = '#ffd600';
export const BULLET_HUD_COLOR = '#ffab00';

// ========== 飞行方向 ==========
export const DIR_LEFT = -1;
export const DIR_RIGHT = 1;

// ========== 回合过渡 ==========
export const ROUND_TRANSITION_DURATION = 2000; // ms，回合间过渡时间
export const ROUND_RESULT_DURATION = 1500; // ms，回合结果显示时间
