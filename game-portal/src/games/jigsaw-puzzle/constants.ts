// ========== Jigsaw Puzzle 拼图游戏常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// HUD 区域
export const HUD_HEIGHT = 50;

// 网格尺寸
export const GRID_SIZE = 4;
export const TOTAL_PIECES = GRID_SIZE * GRID_SIZE; // 16

// 拼图区域（上方）
export const PUZZLE_AREA_Y = HUD_HEIGHT + 10;
export const PUZZLE_AREA_PADDING = 20;
export const PUZZLE_AREA_SIZE = CANVAS_WIDTH - PUZZLE_AREA_PADDING * 2; // 440

// 单块碎片尺寸
export const PIECE_SIZE = PUZZLE_AREA_SIZE / GRID_SIZE; // 110

// 碎片区域（下方）
export const PIECE_AREA_Y = PUZZLE_AREA_Y + PUZZLE_AREA_SIZE + 20;
export const PIECE_AREA_HEIGHT = CANVAS_HEIGHT - PIECE_AREA_Y - 10;

// 碎片区域网格布局（4×4）
export const PIECE_AREA_COLS = 4;
export const PIECE_AREA_ROWS = 4;
export const PIECE_AREA_GAP = 4;
export const PIECE_AREA_PADDING_X = 20;
export const PIECE_AREA_PADDING_Y = 10;
export const PIECE_DISPLAY_SIZE = (CANVAS_WIDTH - PIECE_AREA_PADDING_X * 2 - PIECE_AREA_GAP * (PIECE_AREA_COLS - 1)) / PIECE_AREA_COLS;

// 颜色
export const BG_COLOR = '#1a1a2e';
export const HUD_BG_COLOR = 'rgba(0,0,0,0.3)';
export const PUZZLE_BG_COLOR = '#16213e';
export const HUD_TEXT_COLOR = '#ffffff';
export const CURSOR_COLOR = '#ffcc00';
export const SELECTED_COLOR = '#00ff88';
export const PLACED_CORRECT_COLOR = 'rgba(0,255,136,0.3)';
export const EMPTY_SLOT_COLOR = 'rgba(255,255,255,0.05)';
export const PIECE_BORDER_COLOR = 'rgba(255,255,255,0.2)';
export const GRID_LINE_COLOR = 'rgba(255,255,255,0.1)';
export const PROGRESS_BAR_BG = 'rgba(255,255,255,0.1)';
export const PROGRESS_BAR_FG = '#00ff88';

// 图案颜色（用颜色块代替图片，每个图案有 4×4 的颜色）
export const PATTERNS: string[][][] = [
  // 图案 1：彩虹渐变
  [
    ['#ff6b6b', '#ff6b6b', '#ffa07a', '#ffa07a'],
    ['#ffd93d', '#ffd93d', '#6bcb77', '#6bcb77'],
    ['#4d96ff', '#4d96ff', '#9b59b6', '#9b59b6'],
    ['#ff6b9d', '#ff6b9d', '#c44569', '#c44569'],
  ],
  // 图案 2：棋盘格
  [
    ['#2c3e50', '#ecf0f1', '#2c3e50', '#ecf0f1'],
    ['#ecf0f1', '#2c3e50', '#ecf0f1', '#2c3e50'],
    ['#2c3e50', '#ecf0f1', '#2c3e50', '#ecf0f1'],
    ['#ecf0f1', '#2c3e50', '#ecf0f1', '#2c3e50'],
  ],
  // 图案 3：对角线
  [
    ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71'],
    ['#e67e22', '#f1c40f', '#2ecc71', '#3498db'],
    ['#f1c40f', '#2ecc71', '#3498db', '#9b59b6'],
    ['#2ecc71', '#3498db', '#9b59b6', '#e74c3c'],
  ],
  // 图案 4：十字
  [
    ['#3498db', '#3498db', '#3498db', '#3498db'],
    ['#3498db', '#e74c3c', '#e74c3c', '#3498db'],
    ['#3498db', '#e74c3c', '#e74c3c', '#3498db'],
    ['#3498db', '#3498db', '#3498db', '#3498db'],
  ],
];

// 打乱次数
export const SHUFFLE_ITERATIONS = 200;

// 动画时长（毫秒）
export const SNAP_ANIMATION_DURATION = 150;

// 字体大小
export const HUD_FONT_SIZE = 16;
export const PIECE_NUMBER_FONT_SIZE = 14;
export const WIN_FONT_SIZE = 28;
export const PROGRESS_FONT_SIZE = 14;

// 碎片编号字体
export const NUMBER_FONT = `bold ${PIECE_NUMBER_FONT_SIZE}px monospace`;
export const HUD_FONT = `bold ${HUD_FONT_SIZE}px monospace`;
export const WIN_FONT = `bold ${WIN_FONT_SIZE}px monospace`;
export const PROGRESS_FONT = `${PROGRESS_FONT_SIZE}px monospace`;
