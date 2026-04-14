// ========== 画布尺寸 ==========
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 单元格类型 ==========
export const CELL_WALL = 0;
export const CELL_PATH = 1;
export const CELL_COIN = 2;
export const CELL_EXIT = 3;
export const CELL_START = 4;

// ========== 颜色 ==========
export const PLAYER_COLOR = '#00e676';
export const PLAYER_SIZE_RATIO = 0.6;

export const WALL_COLOR = '#1a1a3e';
export const PATH_COLOR = '#2a2a5e';
export const COIN_COLOR = '#ffd700';
export const EXIT_COLOR = '#ff6b35';

export const FOG_COLOR = '#0d0d20';
export const HUD_BG_COLOR = 'rgba(0,0,0,0.8)';
export const HUD_TEXT_COLOR = '#aaaaaa';
export const HUD_SCORE_COLOR = '#00e676';
export const BG_COLOR = '#0d0d20';
export const VISITED_COLOR = '#1e1e4a';

// ========== 计分 ==========
export const COIN_SCORE = 10;
export const LEVEL_COMPLETE_BONUS = 100;

// ========== 移动 ==========
export const MOVE_INTERVAL = 150; // ms

// ========== 关卡增长 ==========
export const COLS_INCREMENT = 2;
export const ROWS_INCREMENT = 2;
export const MAX_COLS = 30;
export const MAX_ROWS = 40;

// ========== 迷雾 ==========
export const FOG_ENABLED_DEFAULT = true;

// ========== 难度配置 ==========
export type DifficultyKey = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  label: string;
  cols: number;
  rows: number;
  fogRadius: number;
  coinCount: number;
}

export const DIFFICULTY_LEVELS: Record<DifficultyKey, DifficultyConfig> = {
  easy: {
    label: '简单',
    cols: 10,
    rows: 12,
    fogRadius: 4,
    coinCount: 5,
  },
  medium: {
    label: '中等',
    cols: 14,
    rows: 18,
    fogRadius: 3,
    coinCount: 8,
  },
  hard: {
    label: '困难',
    cols: 20,
    rows: 26,
    fogRadius: 2,
    coinCount: 12,
  },
};
