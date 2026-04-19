// ========== Slider Puzzle 滑块拼图常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// HUD 区域
export const HUD_HEIGHT = 60;

// 默认网格尺寸
export const DEFAULT_GRID_SIZE = 4;

// 支持的网格尺寸
export const SUPPORTED_GRID_SIZES = [3, 4, 5] as const;

// 拼图区域边距
export const BOARD_PADDING = 40;

// 方块间距
export const TILE_GAP = 4;

// 方块圆角
export const TILE_RADIUS = 6;

// 颜色
export const BG_COLOR = '#1a1a2e';
export const BOARD_BG_COLOR = '#16213e';
export const TILE_COLORS: Record<number, string> = {
  3: '#4fc3f7', // 3×3 蓝色系
  4: '#66bb6a', // 4×4 绿色系
  5: '#ffa726', // 5×5 橙色系
};
export const TILE_TEXT_COLOR = '#ffffff';
export const HUD_TEXT_COLOR = '#ffffff';
export const EMPTY_TILE_COLOR = 'rgba(255,255,255,0.05)';

// 打乱步数（保证可解）
export const SHUFFLE_MOVES: Record<number, number> = {
  3: 100,
  4: 200,
  5: 300,
};

// 动画时长（毫秒）
export const ANIMATION_DURATION = 120;

// 字体大小
export const TILE_FONT_SIZE: Record<number, number> = {
  3: 36,
  4: 28,
  5: 22,
};
export const HUD_FONT_SIZE = 18;
export const WIN_FONT_SIZE = 32;
