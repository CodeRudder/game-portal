// ========== Tower of Hanoi 河内塔常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 盘数范围
export const MIN_DISKS = 3;
export const MAX_DISKS = 8;
export const DEFAULT_DISKS = 4;

// 柱子
export const PEG_COUNT = 3;
export const PEG_WIDTH = 8;
export const PEG_HEIGHT = 320;
export const PEG_BASE_WIDTH = 140;
export const PEG_BASE_HEIGHT = 8;

// 柱子 X 位置（均匀分布）
export const PEG_POSITIONS: number[] = [
  CANVAS_WIDTH * (1 / 4),
  CANVAS_WIDTH * (2 / 4),
  CANVAS_WIDTH * (3 / 4),
];

// 柱子底部 Y（留出底部空间）
export const PEG_BOTTOM_Y = CANVAS_HEIGHT - 80;

// 盘子
export const DISK_MIN_WIDTH = 30;
export const DISK_MAX_WIDTH = 120;
export const DISK_HEIGHT = 24;
export const DISK_GAP = 2;
export const DISK_CORNER_RADIUS = 4;

// 盘子颜色（从大到小，最多 8 个）
export const DISK_COLORS: string[] = [
  '#ef5350', // 红
  '#ff9800', // 橙
  '#ffeb3b', // 黄
  '#66bb6a', // 绿
  '#42a5f5', // 蓝
  '#ab47bc', // 紫
  '#26c6da', // 青
  '#ec407a', // 粉
];

// 选中高亮颜色
export const DISK_SELECTED_COLOR = '#ffffff';
export const DISK_SELECTED_BORDER = '#ffd54f';

// HUD
export const HUD_HEIGHT = 60;
export const HUD_BG_COLOR = 'rgba(0, 0, 0, 0.6)';

// 颜色
export const BG_COLOR = '#1a1a2e';
export const PEG_COLOR = '#8d6e63';
export const PEG_BASE_COLOR = '#6d4c41';
export const TEXT_COLOR = '#ffffff';
export const HIGHLIGHT_COLOR = '#ffd54f';
export const CURSOR_COLOR = 'rgba(255, 213, 79, 0.4)';
export const WIN_TEXT_COLOR = '#66bb6a';
export const MIN_MOVES_COLOR = '#aaaaaa';

// 字体
export const FONT_FAMILY = 'monospace';
export const FONT_SIZE_LARGE = 28;
export const FONT_SIZE_MEDIUM = 18;
export const FONT_SIZE_SMALL = 14;

// 动画
export const MOVE_ANIMATION_DURATION = 150; // 毫秒
