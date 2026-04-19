// ========== Tank Duel 双人坦克常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 网格系统 ==========
export const TILE_SIZE = 32; // 每格 32px
export const MAP_COLS = CANVAS_WIDTH / TILE_SIZE; // 15
export const MAP_ROWS = CANVAS_HEIGHT / TILE_SIZE; // 20

// ========== 地形类型 ==========
export const TERRAIN_EMPTY = 0;
export const TERRAIN_BRICK = 1; // 砖墙（可破坏）
export const TERRAIN_STEEL = 2; // 钢墙（不可破坏）

// ========== 坦克 ==========
export const TANK_SIZE = TILE_SIZE; // 坦克占 1 格
export const TANK_SPEED = 150; // 像素/秒
export const TANK_COLOR_P1 = '#4fc3f7'; // 玩家1 蓝色
export const TANK_COLOR_P2 = '#ef5350'; // 玩家2 红色

// ========== 子弹 ==========
export const BULLET_SIZE = 6;
export const BULLET_SPEED = 300; // 像素/秒
export const BULLET_COLOR_P1 = '#81d4fa';
export const BULLET_COLOR_P2 = '#ef9a9a';
export const MAX_BULLETS_PER_TANK = 3; // 每个坦克最多同时3颗子弹
export const SHOOT_COOLDOWN = 300; // 射击冷却（毫秒）

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

// ========== 游戏规则 ==========
export const WINS_NEEDED = 2; // 3局2胜
export const ROUND_RESET_DELAY = 1500; // 回合重置延迟（毫秒）

// ========== 玩家出生点 ==========
export const P1_SPAWN = { x: 1 * TILE_SIZE, y: (MAP_ROWS - 2) * TILE_SIZE };
export const P2_SPAWN = { x: (MAP_COLS - 2) * TILE_SIZE, y: 1 * TILE_SIZE };

// ========== 颜色 ==========
export const BG_COLOR = '#1a1a2e';
export const BRICK_COLOR = '#8d6e63';
export const STEEL_COLOR = '#78909c';
export const GRID_COLOR = 'rgba(255,255,255,0.03)';
export const HUD_COLOR = '#ffffff';
export const SCORE_COLOR = '#ffd600';

// ========== AI ==========
export const AI_THINK_INTERVAL = 500; // AI 思考间隔（毫秒）
export const AI_SHOOT_CHANCE = 0.6; // AI 射击概率
export const AI_DIRECTION_CHANGE_INTERVAL = 1500; // AI 方向变化间隔

// ========== 地图模板 ==========
// 0=空 1=砖 2=钢
// 15列 x 20行
export const DEFAULT_MAP: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,0,0,0,0,0,0,0,0,1,0,0],
  [0,0,0,1,0,0,2,0,2,0,0,1,0,0,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,1,0,0,0,2,0,0,0,2,0,0,0,1,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [0,0,2,0,1,0,0,0,0,0,1,0,2,0,0],
  [0,0,0,0,1,0,0,0,0,0,1,0,0,0,0],
  [0,1,0,0,0,0,0,2,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,0,0,0,0,0,2,0,0,0,0,0,1,0],
  [0,0,0,0,1,0,0,0,0,0,1,0,0,0,0],
  [0,0,2,0,1,0,0,0,0,0,1,0,2,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [0,1,0,0,0,2,0,0,0,2,0,0,0,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,0,0,1,0,0,2,0,2,0,0,1,0,0,0],
  [0,0,0,1,0,0,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];
