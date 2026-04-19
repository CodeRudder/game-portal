// ========== 国际象棋常量 ==========

/** 棋盘尺寸 */
export const BOARD_SIZE = 8;

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 棋盘偏移（居中显示） */
export const BOARD_OFFSET_X = 0;
export const BOARD_OFFSET_Y = 80;

/** 格子大小 */
export const CELL_SIZE = 60;

/** 信息栏高度 */
export const INFO_BAR_HEIGHT = 80;
export const BOTTOM_BAR_HEIGHT = CANVAS_HEIGHT - INFO_BAR_HEIGHT - BOARD_SIZE * CELL_SIZE;

/** 颜色 */
export const COLORS = {
  LIGHT_SQUARE: '#F0D9B5',
  DARK_SQUARE: '#B58863',
  HIGHLIGHT: 'rgba(255, 255, 0, 0.4)',
  SELECTED: 'rgba(0, 200, 0, 0.5)',
  VALID_MOVE: 'rgba(0, 150, 255, 0.4)',
  CHECK: 'rgba(255, 0, 0, 0.5)',
  LAST_MOVE: 'rgba(155, 199, 0, 0.41)',
  CURSOR: 'rgba(255, 255, 255, 0.6)',
  WHITE_PIECE: '#FFFFFF',
  BLACK_PIECE: '#000000',
  BG: '#1a1a2e',
  INFO_BG: '#16213e',
  TEXT: '#E0E0E0',
  NEON: '#00ff88',
  ACCENT: '#6c5ce7',
};

/** 棋子类型 */
export enum PieceType {
  PAWN = 'pawn',
  ROOK = 'rook',
  KNIGHT = 'knight',
  BISHOP = 'bishop',
  QUEEN = 'queen',
  KING = 'king',
}

/** 颜色 */
export enum Color {
  WHITE = 'white',
  BLACK = 'black',
}

/** 棋子 Unicode 符号 */
export const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
  [Color.WHITE]: {
    [PieceType.KING]: '♔',
    [PieceType.QUEEN]: '♕',
    [PieceType.ROOK]: '♖',
    [PieceType.BISHOP]: '♗',
    [PieceType.KNIGHT]: '♘',
    [PieceType.PAWN]: '♙',
  },
  [Color.BLACK]: {
    [PieceType.KING]: '♚',
    [PieceType.QUEEN]: '♛',
    [PieceType.ROOK]: '♜',
    [PieceType.BISHOP]: '♝',
    [PieceType.KNIGHT]: '♞',
    [PieceType.PAWN]: '♟',
  },
};

/** 棋子价值（用于 AI 评估） */
export const PIECE_VALUES: Record<string, number> = {
  [PieceType.PAWN]: 100,
  [PieceType.KNIGHT]: 320,
  [PieceType.BISHOP]: 330,
  [PieceType.ROOK]: 500,
  [PieceType.QUEEN]: 900,
  [PieceType.KING]: 20000,
};

/** 棋子位置评估表（白方视角，从上到下 row 0-7） */
export const POSITION_TABLES: Record<string, number[][]> = {
  [PieceType.PAWN]: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  [PieceType.KNIGHT]: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  [PieceType.BISHOP]: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  [PieceType.ROOK]: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0],
  ],
  [PieceType.QUEEN]: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ],
  [PieceType.KING]: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ],
};

/** AI 搜索深度 */
export const AI_DEPTH = 2;
