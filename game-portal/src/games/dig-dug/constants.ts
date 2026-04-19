// ========== Dig Dug 挖掘者常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 网格系统 ==========
export const COLS = 15;
export const ROWS = 20;
export const CELL_SIZE = CANVAS_WIDTH / COLS; // 32px

// ========== 玩家 ==========
export const PLAYER_SPEED = 4; // 格/秒
export const PLAYER_COLOR = '#4fc3f7';
export const INITIAL_LIVES = 3;

// ========== 充气泵 ==========
export const PUMP_RANGE = 4; // 泵射程（格数）
export const PUMP_EXTEND_SPEED = 12; // 格/秒
export const PUMP_RETRACT_SPEED = 12; // 格/秒
export const PUMP_INFLATE_PER_PUMP = 1; // 每次充气膨胀等级
export const INFLATE_TO_POP = 4; // 膨胀到 4 级爆炸
export const PUMP_COOLDOWN = 0; // 充气冷却（秒），0 = 无冷却

// ========== 怪物 ==========
export const MONSTER_SPEED = 2; // 格/秒
export const MONSTER_SPEED_PER_LEVEL = 0.15; // 每级增加速度
export const MONSTER_GHOST_SPEED = 1.5; // 穿墙模式速度
export const GHOST_CHANCE_BASE = 0.003; // 每帧进入穿墙模式的基础概率
export const GHOST_CHANCE_PER_LEVEL = 0.0005; // 每级增加概率
export const GHOST_DURATION_MIN = 2; // 穿墙模式最短持续时间（秒）
export const GHOST_DURATION_MAX = 4; // 穿墙模式最长持续时间（秒）

// Pooka
export const POOKA_COLOR = '#ff6d00';
export const POOKA_SCORE_SHALLOW = 200; // 浅层（0-4行）得分
export const POOKA_SCORE_MEDIUM = 300; // 中层（5-9行）得分
export const POOKA_SCORE_DEEP = 400; // 深层（10-14行）得分
export const POOKA_SCORE_VERY_DEEP = 500; // 极深层（15-19行）得分

// Fygar
export const FYGAR_COLOR = '#4caf50';
export const FYGAR_SCORE_SHALLOW = 300;
export const FYGAR_SCORE_MEDIUM = 400;
export const FYGAR_SCORE_DEEP = 500;
export const FYGAR_SCORE_VERY_DEEP = 600;
export const FYGAR_FIRE_RANGE = 3; // 火焰射程（格数）
export const FYGAR_FIRE_DURATION = 1.0; // 火焰持续时间（秒）
export const FYGAR_FIRE_COOLDOWN = 3.0; // 火焰冷却时间（秒）
export const FYGAR_FIRE_CHANCE = 0.008; // 每帧喷火概率
export const FYGAR_FIRE_SCORE = 0; // 用火焰杀死玩家不得分

// ========== 岩石 ==========
export const ROCK_FALL_DELAY = 0.4; // 挖空下方后延迟掉落（秒）
export const ROCK_FALL_SPEED = 10; // 掉落速度（格/秒）
export const ROCK_SCORE = 1000; // 砸死怪物得分
export const ROCKS_PER_LEVEL = 2; // 每关岩石数量

// ========== 关卡 ==========
export const POOKA_BASE_COUNT = 2; // 初始 Pooka 数量
export const FYGAR_BASE_COUNT = 1; // 初始 Fygar 数量
export const POOKA_PER_LEVEL = 1; // 每关增加 Pooka
export const FYGAR_PER_LEVEL = 0.5; // 每关增加 Fygar（每2关+1）
export const MONSTERS_PER_LEVEL_MAX = 8; // 每关最多怪物数

// ========== 颜色 ==========
export const BG_COLOR = '#1a1a2e';
export const DIRT_COLORS = ['#8B6914', '#7B5B0F', '#6B4D0A', '#5B3F05', '#4B3100'];
export const TUNNEL_COLOR = '#0d0d1a';
export const ROCK_COLOR = '#9e9e9e';
export const HUD_COLOR = '#ffffff';
export const SCORE_COLOR = '#ffd600';
export const PUMP_COLOR = '#ffeb3b';
export const FIRE_COLOR = '#ff5722';

// ========== 方向 ==========
export const DIR_UP = 'up';
export const DIR_DOWN = 'down';
export const DIR_LEFT = 'left';
export const DIR_RIGHT = 'right';

// ========== 深度区域 ==========
export const DEPTH_SHALLOW_END = 5; // 行 0-4
export const DEPTH_MEDIUM_END = 10; // 行 5-9
export const DEPTH_DEEP_END = 15; // 行 10-14
// 行 15-19 = 极深层
