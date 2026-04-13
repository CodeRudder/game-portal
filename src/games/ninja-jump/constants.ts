// ========== Ninja Jump 忍者跳跃常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 忍者（玩家） ==========
export const PLAYER_WIDTH = 32;
export const PLAYER_HEIGHT = 32;
export const PLAYER_SPEED = 280; // 水平移动速度（像素/秒）
export const PLAYER_COLOR = '#1a1a2e';
export const JUMP_VELOCITY = -620; // 跳跃初速度（向上为负）
export const GRAVITY = 1400; // 重力加速度（像素/秒²）
export const INITIAL_LIVES = 3;

// ========== 平台 ==========
export const PLATFORM_WIDTH = 70;
export const PLATFORM_HEIGHT = 12;
export const PLATFORM_COLOR_NORMAL = '#4caf50';
export const PLATFORM_COLOR_MOVING = '#2196f3';
export const PLATFORM_COLOR_FRAGILE = '#ff9800';
export const PLATFORM_COLOR_SPRING = '#e040fb';
export const PLATFORM_SPACING = 80; // 平台之间的最小垂直间距
export const PLATFORMS_ON_SCREEN = 10; // 同时在屏幕上的平台数
export const MOVING_PLATFORM_SPEED = 80; // 移动平台速度（像素/秒）
export const MOVING_PLATFORM_RANGE = 120; // 移动平台移动范围
export const SPRING_JUMP_MULTIPLIER = 1.8; // 弹簧平台跳跃倍率

// ========== 道具 ==========
export const POWERUP_SIZE = 20;
export const POWERUP_DART_COLOR = '#f44336';
export const POWERUP_SHIELD_COLOR = '#00bcd4';
export const POWERUP_MAGNET_COLOR = '#ffeb3b';
export const POWERUP_DART_DURATION = 8000; // 飞镖持续时间（毫秒）
export const POWERUP_SHIELD_DURATION = 6000; // 护盾持续时间（毫秒）
export const POWERUP_MAGNET_DURATION = 7000; // 磁铁持续时间（毫秒）
export const POWERUP_MAGNET_RANGE = 150; // 磁铁吸引范围
export const POWERUP_MAGNET_FORCE = 200; // 磁铁吸引力
export const POWERUP_SPAWN_CHANCE = 0.12; // 道具生成概率

// ========== 飞镖（武器） ==========
export const DART_WIDTH = 8;
export const DART_HEIGHT = 16;
export const DART_SPEED = 500; // 飞镖速度（像素/秒，向上）
export const DART_COLOR = '#f44336';
export const MAX_DARTS = 3; // 同时存在的飞镖数

// ========== 敌人 ==========
export const ENEMY_FLYING_SIZE = 28;
export const ENEMY_FLYING_SPEED = 100; // 飞行忍者速度
export const ENEMY_FLYING_COLOR = '#d32f2f';
export const ENEMY_ROCK_SIZE = 24;
export const ENEMY_ROCK_SPEED = 180; // 落石速度
export const ENEMY_ROCK_COLOR = '#795548';
export const ENEMY_SPAWN_INTERVAL_BASE = 4000; // 基础生成间隔（毫秒）
export const ENEMY_SPAWN_INTERVAL_MIN = 1500; // 最小生成间隔
export const ENEMY_SCORE = 50; // 消灭敌人得分

// ========== 难度 ==========
export const DIFFICULTY_INTERVAL = 2000; // 每 2000 分提升难度
export const MAX_DIFFICULTY_LEVEL = 10;

// ========== 分数 ==========
export const HEIGHT_SCORE_MULTIPLIER = 1; // 每像素高度得 1 分

// ========== 颜色 ==========
export const BG_COLOR = '#0d1117';
export const HUD_COLOR = '#ffffff';
export const SCORE_COLOR = '#ffd600';
export const SHIELD_COLOR = 'rgba(0, 188, 212, 0.4)';

// ========== 方向 ==========
export const DIR_LEFT = -1;
export const DIR_RIGHT = 1;
