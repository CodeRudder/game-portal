// ========== Knight's Tour 骑士巡游常量 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 棋盘默认尺寸
export const DEFAULT_BOARD_SIZE = 8;
export const MIN_BOARD_SIZE = 5;
export const MAX_BOARD_SIZE = 8;

// 棋盘单元格大小（动态计算）
export const MAX_CELL_SIZE = 56;
export const MIN_CELL_SIZE = 40;

// 棋盘偏移
export const BOARD_OFFSET_Y = 110;

// HUD
export const HUD_HEIGHT = 100;

// 颜色
export const BG_COLOR = '#1a1a2e';
export const BOARD_LIGHT_COLOR = '#e8d5b5';
export const BOARD_DARK_COLOR = '#b58863';
export const KNIGHT_COLOR = '#ffd700';
export const KNIGHT_STROKE_COLOR = '#b8860b';
export const VISITED_LIGHT_COLOR = '#a8d8a8';
export const VISITED_DARK_COLOR = '#7ab87a';
export const MOVEABLE_COLOR = 'rgba(100, 200, 255, 0.4)';
export const MOVEABLE_BORDER_COLOR = '#64c8ff';
export const HINT_COLOR = 'rgba(255, 215, 0, 0.5)';
export const HINT_BORDER_COLOR = '#ffd700';
export const CURSOR_COLOR = 'rgba(255, 100, 100, 0.5)';
export const CURSOR_BORDER_COLOR = '#ff6464';
export const DEAD_END_COLOR = 'rgba(255, 80, 80, 0.3)';
export const WIN_COLOR = '#66bb6a';
export const LOSE_COLOR = '#ff4757';
export const HUD_COLOR = '#ffffff';
export const HINT_TEXT_COLOR = '#aaaaaa';
export const STEP_NUMBER_COLOR = '#333333';

// 得分
export const POINTS_PER_STEP = 10;
export const WIN_BONUS = 500;
export const HINT_PENALTY = 5;

// 骑士符号
export const KNIGHT_SYMBOL = '♞';

// 骑士的 L 形移动偏移量
export const KNIGHT_MOVES: Array<[number, number]> = [
  [-2, -1], [-2, 1],
  [-1, -2], [-1, 2],
  [1, -2], [1, 2],
  [2, -1], [2, 1],
];

// 棋盘大小选项
export interface BoardSizeOption {
  size: number;
  label: string;
}

export const BOARD_SIZE_OPTIONS: BoardSizeOption[] = [
  { size: 5, label: '5×5' },
  { size: 6, label: '6×6' },
  { size: 8, label: '8×8' },
];

// 计算棋盘偏移 X（居中）
export function calcBoardOffsetX(boardSize: number): number {
  const cellSize = calcCellSize(boardSize);
  return (CANVAS_WIDTH - boardSize * cellSize) / 2;
}

// 计算单元格大小
export function calcCellSize(boardSize: number): number {
  const maxBoardWidth = CANVAS_WIDTH - 40; // 两侧各留20px
  const maxBoardHeight = CANVAS_HEIGHT - BOARD_OFFSET_Y - 120; // 底部留120px给信息
  const maxByWidth = Math.floor(maxBoardWidth / boardSize);
  const maxByHeight = Math.floor(maxBoardHeight / boardSize);
  const size = Math.min(maxByWidth, maxByHeight, MAX_CELL_SIZE);
  return Math.max(size, MIN_CELL_SIZE);
}
