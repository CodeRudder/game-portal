// ========== Battle City 坦克大战常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 网格系统 ==========
export const TILE_SIZE = 16; // 每格 16px
export const MAP_COLS = CANVAS_WIDTH / TILE_SIZE; // 30
export const MAP_ROWS = CANVAS_HEIGHT / TILE_SIZE; // 40

// ========== 地形类型 ==========
export const TERRAIN_EMPTY = 0;
export const TERRAIN_BRICK = 1;
export const TERRAIN_STEEL = 2;
export const TERRAIN_WATER = 3;
export const TERRAIN_TREE = 4;
export const TERRAIN_ICE = 5;

// ========== 坦克尺寸 ==========
export const TANK_SIZE = TILE_SIZE * 2; // 32px（2x2 格子）

// ========== 玩家 ==========
export const PLAYER_SPEED = 120; // 像素/秒
export const PLAYER_COLOR = '#ffd600';
export const INITIAL_LIVES = 3;
export const PLAYER_SPAWN_X = 4 * TILE_SIZE; // 左侧出生点（col 4-5）
export const PLAYER_SPAWN_Y = (MAP_ROWS - 2) * TILE_SIZE;

// ========== 子弹 ==========
export const BULLET_SIZE = 4;
export const BULLET_SPEED = 300; // 像素/秒
export const BULLET_COLOR = '#ffffff';
export const MAX_PLAYER_BULLETS = 2;
export const MAX_ENEMY_BULLETS = 1;

// ========== 方向 ==========
export const DIR_UP = 0;
export const DIR_RIGHT = 1;
export const DIR_DOWN = 2;
export const DIR_LEFT = 3;

// 方向向量
export const DIR_VECTORS: Record<number, { dx: number; dy: number }> = {
  [DIR_UP]: { dx: 0, dy: -1 },
  [DIR_RIGHT]: { dx: 1, dy: 0 },
  [DIR_DOWN]: { dx: 0, dy: 1 },
  [DIR_LEFT]: { dx: -1, dy: 0 },
};

// ========== 敌方坦克 ==========
export const ENEMY_SPEED = 80; // 像素/秒
export const ENEMY_SPEED_FAST = 120;
export const ENEMY_COLOR = '#e53935';
export const ENEMY_COLOR_FAST = '#ff6d00';
export const ENEMY_COLOR_ARMOR = '#8e24aa';
export const ENEMY_SPAWN_INTERVAL = 3000; // 毫秒
export const ENEMY_SPAWN_INTERVAL_PER_LEVEL = -200; // 每级减少
export const ENEMY_SPAWN_INTERVAL_MIN = 1000;
export const ENEMIES_PER_WAVE = 4;
export const ENEMIES_PER_WAVE_PER_LEVEL = 2;
export const ENEMIES_MAX_ON_SCREEN = 4;
export const ENEMY_DIRECTION_CHANGE_INTERVAL = 2000; // 毫秒
export const ENEMY_SHOOT_INTERVAL = 1500; // 毫秒
export const ENEMY_SCORE_BASIC = 100;
export const ENEMY_SCORE_FAST = 200;
export const ENEMY_SCORE_ARMOR = 300;

// 敌方出生点（顶部的三个位置）
export const ENEMY_SPAWN_POSITIONS = [
  { x: TILE_SIZE, y: 0 },
  { x: (MAP_COLS / 2 - 1) * TILE_SIZE, y: 0 },
  { x: (MAP_COLS - 3) * TILE_SIZE, y: 0 },
];

// ========== 基地（鹰标志） ==========
export const BASE_SIZE = TILE_SIZE * 2; // 32px
export const BASE_X = (MAP_COLS / 2 - 1) * TILE_SIZE;
export const BASE_Y = (MAP_ROWS - 2) * TILE_SIZE;
export const BASE_COLOR = '#aaaaaa';
export const BASE_DESTROYED_COLOR = '#333333';

// ========== 道具 ==========
export const POWERUP_SIZE = TILE_SIZE * 2;
export const POWERUP_DURATION = 10000; // 道具持续时间（毫秒）
export const POWERUP_SPAWN_CHANCE = 0.15; // 击杀敌人掉落概率

// 道具类型
export const POWERUP_STAR = 'star'; // 星星：升级坦克
export const POWERUP_SHIELD = 'shield'; // 护盾：无敌
export const POWERUP_BOMB = 'bomb'; // 炸弹：消灭所有敌人
export const POWERUP_CLOCK = 'clock'; // 时钟：冻结敌人

export const POWERUP_TYPES = [POWERUP_STAR, POWERUP_SHIELD, POWERUP_BOMB, POWERUP_CLOCK] as const;
export type PowerUpType = typeof POWERUP_TYPES[number];

// ========== 护盾 ==========
export const SHIELD_DURATION = 8000; // 毫秒
export const SHIELD_COLOR = 'rgba(100, 200, 255, 0.4)';

// ========== 坦克升级 ==========
export const TANK_LEVEL_BASIC = 0;
export const TANK_LEVEL_FAST = 1;
export const TANK_LEVEL_POWER = 2;
export const TANK_LEVEL_ARMOR = 3;
export const TANK_SPEED_PER_LEVEL = 20;
export const TANK_BULLET_SPEED_PER_LEVEL = 50;

// ========== 颜色 ==========
export const BG_COLOR = '#1a1a1a';
export const BRICK_COLOR = '#8d6e63';
export const STEEL_COLOR = '#90a4ae';
export const WATER_COLOR = '#1565c0';
export const TREE_COLOR = '#2e7d32';
export const ICE_COLOR = '#e3f2fd';
export const HUD_COLOR = '#ffffff';
export const SCORE_COLOR = '#ffd600';

// ========== 分数 ==========
export const SCORE_BRICK_DESTROY = 10;

// ========== 关卡地图模板 ==========
// 0=空 1=砖 2=钢 3=水 4=树 5=冰
export const LEVEL_1_MAP: number[][] = [
  // 行 0-1: 敌方出生区域（空）
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // 行 2-3: 第一道砖墙
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
  // 行 10-11: 水域
  [0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0],
  [0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,2,2,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
  // 行 28-29: 树丛
  [0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0],
  // 行 36-37: 基地保护砖墙
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
  // 行 38-39: 基地行
  [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
];
