// ========== Galaga 小蜜蜂常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== HUD ==========
export const HUD_HEIGHT = 40;

// ========== 玩家飞船 ==========
export const PLAYER_WIDTH = 32;
export const PLAYER_HEIGHT = 24;
export const PLAYER_SPEED = 300; // 像素/秒
export const PLAYER_START_X = (CANVAS_WIDTH - PLAYER_WIDTH) / 2;
export const PLAYER_START_Y = CANVAS_HEIGHT - 60;
export const PLAYER_Y = CANVAS_HEIGHT - 60;
export const PLAYER_COLOR = '#4fc3f7';
export const PLAYER_LIVES = 3;

// ========== 玩家子弹 ==========
export const BULLET_WIDTH = 3;
export const BULLET_HEIGHT = 12;
export const BULLET_SPEED = 500; // 像素/秒
export const BULLET_COLOR = '#ffffff';
export const SHOOT_COOLDOWN = 200; // 毫秒，射击冷却时间
export const MAX_BULLETS = 2; // 屏幕上同时存在的最大子弹数

// ========== 敌人通用 ==========
export const ENEMY_WIDTH = 24;
export const ENEMY_HEIGHT = 20;
export const ENEMY_HIT_SCORE = 50;
export const ENEMY_BOSS_HIT_SCORE = 150;

// ========== 敌人类型 ==========
export const ENEMY_TYPE_BASIC = 'basic';
export const ENEMY_TYPE_BOSS = 'boss';
export const ENEMY_TYPE_CAPTURE = 'capture';

// ========== 敌人状态 ==========
export const ENEMY_STATE_FORMATION = 'formation';
export const ENEMY_STATE_DIVE = 'dive';
export const ENEMY_STATE_RETURN = 'return';
export const ENEMY_STATE_CAPTURE = 'capture';
export const ENEMY_STATE_DEAD = 'dead';

// ========== 编队排列 ==========
export const FORMATION_ROWS = 5;
export const FORMATION_COLS = 8;
export const FORMATION_SPACING_X = 44;
export const FORMATION_SPACING_Y = 38;
export const FORMATION_OFFSET_X = 40;
export const FORMATION_OFFSET_Y = 60;
export const FORMATION_SWAY_AMPLITUDE = 20; // 编队左右摆动幅度
export const FORMATION_SWAY_SPEED = 1.5; // 编队摆动速度（弧度/秒）

// ========== 俯冲参数 ==========
export const DIVE_CHANCE = 0.15; // 每秒每个敌人俯冲概率
export const DIVE_CHANCE_PER_LEVEL = 0.02; // 每波增加的俯冲概率
export const DIVE_SPEED = 200; // 俯冲基础速度（像素/秒）
export const DIVE_SPEED_PER_LEVEL = 15; // 每波增加的速度
export const DIVE_CURVE_AMPLITUDE = 40; // 俯冲曲线幅度
export const DIVE_CURVE_FREQUENCY = 2; // 俯冲曲线频率
export const DIVE_RETURN_SPEED = 150; // 俯冲后返回速度

// ========== 捕获参数 ==========
export const CAPTURE_ENEMY_ROW = 0; // 第几行为捕获型敌机（最顶行）
export const CAPTURE_DIVE_SPEED = 120; // 捕获俯冲速度
export const CAPTURE_TRACTOR_BEAM_WIDTH = 40; // 拖曳光束宽度
export const CAPTURE_TRACTOR_BEAM_HEIGHT = 80; // 拖曳光束高度
export const CAPTURE_DURATION = 5000; // 捕获超时（毫秒）

// ========== 救援/双机 ==========
export const RESCUE_HIT_SCORE = 100; // 救援奖励分数
export const DUAL_SHIP_OFFSET_Y = -20; // 双机偏移（在主飞船上方）

// ========== 波次系统 ==========
export const INITIAL_ENEMY_COUNT = FORMATION_COLS * FORMATION_ROWS; // 40
export const WAVE_BONUS = 1000; // 波次奖励分数
export const WAVE_TRANSITION_DELAY = 2000; // 波次间隔（毫秒）

// ========== 爆炸效果 ==========
export const EXPLOSION_DURATION = 500; // 毫秒
export const EXPLOSION_RADIUS = 20; // 像素

// ========== 颜色 ==========
export const BG_COLOR = '#0a0a2e';
export const HUD_COLOR = '#ffffff';
export const ENEMY_COLOR = '#66bb6a';
export const ENEMY_BOSS_COLOR = '#ef5350';
export const EXPLOSION_COLOR = '#ff9800';
export const TRACTOR_BEAM_COLOR = '#ab47bc';
export const STAR_COLOR = '#ffffff';

// ========== 复活 ==========
export const RESPAWN_DELAY = 1500; // 毫秒，复活延迟
export const RESPAWN_INVINCIBLE_DURATION = 2000; // 毫秒，复活后无敌时间

// ========== 敌人子弹（保留兼容） ==========
export const ENEMY_BULLET_WIDTH = 3;
export const ENEMY_BULLET_HEIGHT = 10;
export const ENEMY_BULLET_SPEED = 250; // 像素/秒
export const ENEMY_BULLET_COLOR = '#ff5252';
export const ENEMY_SHOOT_CHANCE_PER_SECOND = 0.02;
export const MAX_DIVING_ENEMIES = 3;
export const DIVE_SHOOT_CHANCE = 0.4;
export const WAVE_ENEMY_INCREMENT = 4;
export const MAX_WAVE_ENEMIES = 40;
export const INVINCIBLE_DURATION = 2000;
export const BULLET_COOLDOWN = 200;
