// ========== Chips Challenge 芯片挑战常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 网格 ==========

export const GRID_COLS = 10;
export const GRID_ROWS = 12;

// ========== 格子尺寸 ==========

export const CELL_SIZE = 40;
export const HUD_HEIGHT = 54;

// ========== 地形类型（Cell 枚举） ==========

export enum Cell {
  EMPTY = 0,
  WALL = 1,
  WATER = 2,
  ICE = 3,
  CHIP = 4,
  EXIT = 5,
  KEY_RED = 6,
  KEY_BLUE = 7,
  KEY_GREEN = 8,
  DOOR_RED = 9,
  DOOR_BLUE = 10,
  DOOR_GREEN = 11,
  FIRE = 12,
  BOOTS_FIRE = 13,
  BOOTS_WATER = 14,
  BLOCK = 15,
  PLAYER = 99,
  EXIT_OPEN = 100,
}

// ========== 方向 ==========

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export const DIR: Record<Direction, { dx: number; dy: number }> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

// ========== 兼容旧常量名 ==========

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_WATER = 2;
export const TILE_ICE = 3;
export const TILE_CHIP = 4;
export const TILE_EXIT = 5;
export const TILE_KEY_RED = 6;
export const TILE_KEY_BLUE = 7;
export const TILE_KEY_GREEN = 8;
export const TILE_DOOR_RED = 9;
export const TILE_DOOR_BLUE = 10;
export const TILE_DOOR_GREEN = 11;
export const TILE_FIRE = 12;
export const TILE_FIRE_BOOTS = 13;
export const TILE_WATER_BOOTS = 14;

export type TileType = typeof TILE_FLOOR | typeof TILE_WALL | typeof TILE_WATER |
  typeof TILE_ICE | typeof TILE_CHIP | typeof TILE_EXIT |
  typeof TILE_KEY_RED | typeof TILE_KEY_BLUE | typeof TILE_KEY_GREEN |
  typeof TILE_DOOR_RED | typeof TILE_DOOR_BLUE | typeof TILE_DOOR_GREEN |
  typeof TILE_FIRE | typeof TILE_FIRE_BOOTS | typeof TILE_WATER_BOOTS;

// ========== 颜色 ==========

export const COLOR_FLOOR = '#e8eaf6';
export const COLOR_WALL = '#1a237e';
export const COLOR_WATER = '#1565c0';
export const COLOR_ICE = '#b3e5fc';
export const COLOR_CHIP = '#ffd600';
export const COLOR_EXIT = '#00e676';
export const COLOR_KEY_RED = '#ff1744';
export const COLOR_KEY_BLUE = '#2979ff';
export const COLOR_KEY_GREEN = '#00c853';
export const COLOR_DOOR_RED = '#d50000';
export const COLOR_DOOR_BLUE = '#0d47a1';
export const COLOR_DOOR_GREEN = '#1b5e20';
export const COLOR_FIRE = '#ff6d00';
export const COLOR_FIRE_BOOTS = '#ff9100';
export const COLOR_WATER_BOOTS = '#00b0ff';
export const COLOR_PLAYER = '#e040fb';
export const COLOR_BG = '#0d0d20';
export const COLOR_HUD_BG = 'rgba(0,0,0,0.75)';
export const COLOR_HUD_TEXT = '#ffffff';
export const COLOR_HUD_SCORE = '#ffd600';

/** 引擎使用的颜色集合 */
export const COLORS = {
  BG: COLOR_BG,
  FLOOR: COLOR_FLOOR,
  WALL: COLOR_WALL,
  WALL_TOP: '#283593',
  WATER: COLOR_WATER,
  WATER_DARK: '#0d47a1',
  ICE: COLOR_ICE,
  CHIP: COLOR_CHIP,
  CHIP_GLOW: 'rgba(255,255,255,0.4)',
  EXIT: COLOR_EXIT,
  EXIT_CLOSED: '#b71c1c',
  EXIT_OPEN: '#00c853',
  KEY_RED: COLOR_KEY_RED,
  KEY_BLUE: COLOR_KEY_BLUE,
  KEY_GREEN: COLOR_KEY_GREEN,
  DOOR_RED: COLOR_DOOR_RED,
  DOOR_BLUE: COLOR_DOOR_BLUE,
  DOOR_GREEN: COLOR_DOOR_GREEN,
  FIRE: COLOR_FIRE,
  FIRE_YELLOW: '#ffea00',
  BOOTS_WATER: COLOR_WATER_BOOTS,
  BOOTS_FIRE: COLOR_FIRE_BOOTS,
  BLOCK: '#8d6e63',
  BLOCK_TOP: '#a1887f',
  PLAYER: COLOR_PLAYER,
  HUD_BG: COLOR_HUD_BG,
  HUD_TEXT: COLOR_HUD_TEXT,
  HUD_SCORE: COLOR_HUD_SCORE,
  HUD_ACCENT: '#00e5ff',
};

// ========== 玩家 ==========

export const PLAYER_SIZE_RATIO = 0.7;

// ========== 计分 ==========

export const CHIP_SCORE = 50;
export const LEVEL_COMPLETE_BONUS = 1000;

// ========== 工具函数 ==========

/** 深拷贝网格 */
export function cloneGrid(grid: number[][]): number[][] {
  return grid.map(row => [...row]);
}

/** 统计地图上剩余芯片数量 */
export function countChips(grid: number[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === Cell.CHIP) count++;
    }
  }
  return count;
}

/** 在网格中查找玩家位置（Cell.PLAYER 或 tile 值 99） */
export function findPlayer(grid: number[][]): { x: number; y: number } | null {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === Cell.PLAYER) {
        return { x, y };
      }
    }
  }
  return null;
}

// ========== 关卡数据 ==========

export interface LevelData {
  grid: number[][];
  chipsRequired: number;
  name: string;
}

// 玩家标记值（用于关卡网格中表示起始位置）
const P = Cell.PLAYER; // 99

export const LEVELS: LevelData[] = [
  {
    name: '初入迷宫',
    chipsRequired: 3,
    grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,P,0,0,1,0,4,0,0,1],
      [1,0,1,0,1,0,1,1,0,1],
      [1,0,1,0,0,0,0,1,0,1],
      [1,0,1,1,1,1,0,1,0,1],
      [1,0,0,0,0,1,0,0,4,1],
      [1,1,1,0,1,1,1,1,0,1],
      [1,4,0,0,0,0,0,1,0,1],
      [1,0,1,1,1,1,0,1,0,1],
      [1,0,0,0,0,1,0,0,0,1],
      [1,0,1,1,0,0,0,1,5,1],
      [1,1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: '钥匙与门',
    chipsRequired: 2,
    grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,P,0,0,1,0,6,0,0,1],
      [1,0,1,0,1,0,1,1,0,1],
      [1,0,1,0,9,0,0,1,0,1],
      [1,0,1,1,1,1,0,1,4,1],
      [1,0,0,0,0,1,0,0,0,1],
      [1,1,1,0,1,1,1,1,0,1],
      [1,4,0,0,0,0,0,1,0,1],
      [1,0,1,1,1,1,0,1,0,1],
      [1,0,0,0,0,1,0,0,0,1],
      [1,0,1,1,0,0,0,1,5,1],
      [1,1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: '冰面滑行',
    chipsRequired: 3,
    grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,P,0,3,3,3,0,4,0,1],
      [1,0,1,0,1,0,1,1,0,1],
      [1,0,1,0,0,0,0,1,0,1],
      [1,0,1,1,1,1,0,1,0,1],
      [1,4,0,3,3,1,0,0,0,1],
      [1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,0,0,0,1,4,1],
      [1,0,1,1,1,1,0,1,0,1],
      [1,0,0,3,0,1,0,0,0,1],
      [1,0,1,1,0,0,4,1,5,1],
      [1,1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: '水域陷阱',
    chipsRequired: 2,
    grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,P,0,0,1,0,14,0,0,1],
      [1,0,1,0,1,0,1,1,0,1],
      [1,0,1,0,2,2,2,1,0,1],
      [1,0,1,1,1,1,0,1,4,1],
      [1,0,0,0,0,1,0,0,0,1],
      [1,1,1,0,1,1,1,1,0,1],
      [1,4,0,0,0,0,0,1,0,1],
      [1,0,1,1,1,1,0,1,0,1],
      [1,0,0,2,2,1,0,0,0,1],
      [1,0,1,1,0,0,0,1,5,1],
      [1,1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: '综合挑战',
    chipsRequired: 4,
    grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,P,6,0,1,0,7,0,0,1],
      [1,0,1,0,9,0,1,1,0,1],
      [1,0,1,0,0,0,10,1,0,1],
      [1,0,1,1,1,1,0,1,4,1],
      [1,4,0,3,3,1,0,0,0,1],
      [1,1,1,0,1,1,1,1,0,1],
      [1,0,0,0,2,2,0,1,4,1],
      [1,0,1,1,1,1,0,1,0,1],
      [1,4,0,3,0,1,0,0,0,1],
      [1,0,1,1,0,0,4,1,5,1],
      [1,1,1,1,1,1,1,1,1,1],
    ],
  },
];

export const TOTAL_LEVELS = LEVELS.length;
