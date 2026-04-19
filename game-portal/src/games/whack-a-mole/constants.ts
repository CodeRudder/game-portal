// ========== Whack-a-Mole 打地鼠常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 网格 ==========
export const GRID_ROWS = 3;
export const GRID_COLS = 3;
export const TOTAL_HOLES = GRID_ROWS * GRID_COLS;

// ========== 地鼠生命周期（毫秒） ==========
/** 地鼠从洞中冒出的动画时长 */
export const MOLE_APPEAR_DURATION = 300;
/** 地鼠停留时长（基础值，随等级缩短） */
export const MOLE_STAY_DURATION_BASE = 1500;
/** 每升一级停留时间减少量 */
export const MOLE_STAY_DURATION_DECREASE_PER_LEVEL = 100;
/** 地鼠停留最短时间 */
export const MOLE_STAY_DURATION_MIN = 400;
/** 地鼠缩回洞中的动画时长 */
export const MOLE_HIDE_DURATION = 200;

// ========== 地鼠生成间隔（毫秒） ==========
/** 生成间隔基础值 */
export const SPAWN_INTERVAL_BASE = 1200;
/** 每升一级间隔减少量 */
export const SPAWN_INTERVAL_DECREASE_PER_LEVEL = 80;
/** 生成间隔最短值 */
export const SPAWN_INTERVAL_MIN = 400;

// ========== 同时出现的最大地鼠数 ==========
export const MAX_ACTIVE_MOLES_BASE = 1;
export const MAX_ACTIVE_MOLES_PER_LEVEL = 0; // 每 3 级增加 1
export const MAX_ACTIVE_MOLES_LEVEL_STEP = 3;
export const MAX_ACTIVE_MOLES_MAX = 4;

// ========== 分数 ==========
export const HIT_SCORE_BASE = 10;
export const HIT_SCORE_PER_LEVEL = 2;
export const COMBO_BONUS = 5;
export const MISS_PENALTY = 0; // miss 不扣分

// ========== 时间限制（秒） ==========
export const GAME_DURATION = 60;

// ========== 等级升级 ==========
export const LEVEL_UP_SCORE = 100; // 每 100 分升一级
export const MAX_LEVEL = 10;

// ========== 地鼠状态 ==========
export enum MoleState {
  HIDDEN = 'hidden',
  APPEARING = 'appearing',
  VISIBLE = 'visible',
  HIDING = 'hiding',
  WHACKED = 'whacked',
}

// ========== 颜色 ==========
export const BG_COLOR = '#2d5a27';
export const HOLE_COLOR = '#1a3a15';
export const HOLE_RIM_COLOR = '#3d7a35';
export const MOLE_COLOR = '#8B4513';
export const MOLE_FACE_COLOR = '#D2691E';
export const MOLE_WHACKED_COLOR = '#FF6347';
export const HUD_COLOR = '#ffffff';
export const HUD_BG_COLOR = 'rgba(0,0,0,0.5)';
export const CURSOR_COLOR = '#FFD700';
export const SCORE_POPUP_COLOR = '#FFD700';
export const GRASS_COLOR = '#4a8c3f';

// ========== 布局 ==========
export const HUD_HEIGHT = 60;
export const GRID_PADDING_X = 40;
export const GRID_PADDING_Y = 80;
export const HOLE_RADIUS = 35;
export const MOLE_RADIUS = 25;
export const CURSOR_RADIUS = 30;

// ========== 键盘映射 ==========
/** 数字键 1-9 对应的洞位索引映射 */
export const KEY_HOLE_MAP: Record<string, number> = {
  '1': 0, '2': 1, '3': 2,
  '4': 3, '5': 4, '6': 5,
  '7': 6, '8': 7, '9': 8,
};

/** 方向键移动映射 */
export const DIRECTION_KEYS = {
  UP: ['ArrowUp', 'w', 'W'],
  DOWN: ['ArrowDown', 's', 'S'],
  LEFT: ['ArrowLeft', 'a', 'A'],
  RIGHT: ['ArrowRight', 'd', 'D'],
  WHACK: [' ', 'Space', 'Enter'],
};
