import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChineseChessEngine } from '../ChineseChessEngine';
import {
  COLS, ROWS,
  PIECE_NONE, PIECE_KING, PIECE_ADVISOR, PIECE_BISHOP, PIECE_KNIGHT,
  PIECE_ROOK, PIECE_CANNON, PIECE_PAWN,
  RED, BLACK,
  RED_PALACE, BLACK_PALACE, RIVER_TOP, RIVER_BOTTOM,
} from '../constants';

// Helper: create engine with canvas
function createEngine(): ChineseChessEngine {
  const engine = new ChineseChessEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

// Helper: count pieces of a side
function countPieces(engine: ChineseChessEngine, side: number): number {
  let count = 0;
  const board = (engine as any).board;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && board[r][c]!.side === side) count++;
    }
  }
  return count;
}

// Helper: find piece position
function findPiece(engine: ChineseChessEngine, type: number, side: number): { row: number; col: number } | null {
  const board = (engine as any).board;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (p && p.type === type && p.side === side) return { row: r, col: c };
    }
  }
  return null;
}

// Helper: place piece on board (bypass normal flow)
function placePiece(engine: ChineseChessEngine, row: number, col: number, type: number, side: number): void {
  (engine as any).board[row][col] = { type, side };
}

// Helper: clear board
function clearBoard(engine: ChineseChessEngine): void {
  const board = (engine as any).board;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      board[r][c] = null;
    }
  }
}

// ==================== 棋盘初始化 ====================

describe('棋盘初始化', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('棋盘应为 10 行 9 列', () => {
    const board = (engine as any).board;
    expect(board.length).toBe(10);
    expect(board[0].length).toBe(9);
  });

  it('红方应有 16 个棋子', () => {
    expect(countPieces(engine, RED)).toBe(16);
  });

  it('黑方应有 16 个棋子', () => {
    expect(countPieces(engine, BLACK)).toBe(16);
  });

  it('棋盘上应有 32 个棋子', () => {
    expect(countPieces(engine, RED) + countPieces(engine, BLACK)).toBe(32);
  });

  it('红帅应在 (9,4)', () => {
    const king = findPiece(engine, PIECE_KING, RED);
    expect(king).toEqual({ row: 9, col: 4 });
  });

  it('黑将应在 (0,4)', () => {
    const king = findPiece(engine, PIECE_KING, BLACK);
    expect(king).toEqual({ row: 0, col: 4 });
  });

  it('红方车在 (9,0) 和 (9,8)', () => {
    const board = (engine as any).board;
    expect(board[9][0]).toEqual({ type: PIECE_ROOK, side: RED });
    expect(board[9][8]).toEqual({ type: PIECE_ROOK, side: RED });
  });

  it('黑方车在 (0,0) 和 (0,8)', () => {
    const board = (engine as any).board;
    expect(board[0][0]).toEqual({ type: PIECE_ROOK, side: BLACK });
    expect(board[0][8]).toEqual({ type: PIECE_ROOK, side: BLACK });
  });

  it('红方马在 (9,1) 和 (9,7)', () => {
    const board = (engine as any).board;
    expect(board[9][1]).toEqual({ type: PIECE_KNIGHT, side: RED });
    expect(board[9][7]).toEqual({ type: PIECE_KNIGHT, side: RED });
  });

  it('红方炮在 (7,1) 和 (7,7)', () => {
    const board = (engine as any).board;
    expect(board[7][1]).toEqual({ type: PIECE_CANNON, side: RED });
    expect(board[7][7]).toEqual({ type: PIECE_CANNON, side: RED });
  });

  it('红方兵在 (6,0), (6,2), (6,4), (6,6), (6,8)', () => {
    const board = (engine as any).board;
    expect(board[6][0]).toEqual({ type: PIECE_PAWN, side: RED });
    expect(board[6][2]).toEqual({ type: PIECE_PAWN, side: RED });
    expect(board[6][4]).toEqual({ type: PIECE_PAWN, side: RED });
    expect(board[6][6]).toEqual({ type: PIECE_PAWN, side: RED });
    expect(board[6][8]).toEqual({ type: PIECE_PAWN, side: RED });
  });

  it('黑方卒在 (3,0), (3,2), (3,4), (3,6), (3,8)', () => {
    const board = (engine as any).board;
    expect(board[3][0]).toEqual({ type: PIECE_PAWN, side: BLACK });
    expect(board[3][2]).toEqual({ type: PIECE_PAWN, side: BLACK });
    expect(board[3][4]).toEqual({ type: PIECE_PAWN, side: BLACK });
    expect(board[3][6]).toEqual({ type: PIECE_PAWN, side: BLACK });
    expect(board[3][8]).toEqual({ type: PIECE_PAWN, side: BLACK });
  });

  it('红方仕在 (9,3) 和 (9,5)', () => {
    const board = (engine as any).board;
    expect(board[9][3]).toEqual({ type: PIECE_ADVISOR, side: RED });
    expect(board[9][5]).toEqual({ type: PIECE_ADVISOR, side: RED });
  });

  it('红方相在 (9,2) 和 (9,6)', () => {
    const board = (engine as any).board;
    expect(board[9][2]).toEqual({ type: PIECE_BISHOP, side: RED });
    expect(board[9][6]).toEqual({ type: PIECE_BISHOP, side: RED });
  });

  it('初始走棋方为红方', () => {
    expect((engine as any).currentTurn).toBe(RED);
  });

  it('初始游戏未结束', () => {
    expect((engine as any).gameOverFlag).toBe(false);
  });

  it('初始无将军', () => {
    expect((engine as any).isCheckFlag).toBe(false);
  });

  it('初始光标在 (9,4)', () => {
    expect((engine as any).cursorPos).toEqual({ row: 9, col: 4 });
  });
});

// ==================== 将/帅 走法 ====================

describe('将/帅 走法', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
    placePiece(engine, 3, 4, PIECE_PAWN, RED); // 防止飞将
  });

  it('帅可以在九宫内直走一步', () => {
    const moves = engine.getValidMoves(9, 4);
    expect(moves.some(m => m.row === 8 && m.col === 4)).toBe(true);
  });

  it('帅不能走出九宫格', () => {
    placePiece(engine, 9, 3, PIECE_KING, RED);
    (engine as any).board[9][4] = null;
    const moves = engine.getValidMoves(9, 3);
    // col=2 不在九宫格内
    expect(moves.some(m => m.col === 2)).toBe(false);
  });

  it('帅不能走到 col=2（九宫外）', () => {
    placePiece(engine, 8, 3, PIECE_KING, RED);
    (engine as any).board[9][4] = null;
    const moves = engine.getValidMoves(8, 3);
    expect(moves.some(m => m.col === 2)).toBe(false);
  });

  it('帅不能走到 row=6（九宫外）', () => {
    const moves = engine.getValidMoves(9, 4);
    expect(moves.some(m => m.row === 6)).toBe(false);
  });

  it('帅可以吃对方棋子', () => {
    placePiece(engine, 8, 4, PIECE_PAWN, BLACK);
    const moves = engine.getValidMoves(9, 4);
    expect(moves.some(m => m.row === 8 && m.col === 4)).toBe(true);
  });

  it('帅不能吃己方棋子', () => {
    placePiece(engine, 8, 4, PIECE_ADVISOR, RED);
    const moves = engine.getValidMoves(9, 4);
    expect(moves.some(m => m.row === 8 && m.col === 4)).toBe(false);
  });

  it('将可以在九宫内直走一步', () => {
    const moves = engine.getValidMoves(0, 4);
    expect(moves.some(m => m.row === 1 && m.col === 4)).toBe(true);
  });

  it('将不能走出九宫格到 row=3', () => {
    const moves = engine.getValidMoves(0, 4);
    expect(moves.some(m => m.row === 3)).toBe(false);
  });

  it('将可以左右移动', () => {
    const moves = engine.getValidMoves(0, 4);
    expect(moves.some(m => m.row === 0 && m.col === 3)).toBe(true);
    expect(moves.some(m => m.row === 0 && m.col === 5)).toBe(true);
  });
});

// ==================== 士/仕 走法 ====================

describe('士/仕 走法', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
    placePiece(engine, 3, 4, PIECE_PAWN, RED); // 防止飞将
  });

  it('仕可以在九宫内斜走一格', () => {
    placePiece(engine, 8, 4, PIECE_ADVISOR, RED);
    const moves = engine.getValidMoves(8, 4);
    expect(moves.some(m => m.row === 9 && m.col === 3)).toBe(true);
    expect(moves.some(m => m.row === 9 && m.col === 5)).toBe(true);
  });

  it('仕不能走出九宫格', () => {
    placePiece(engine, 7, 3, PIECE_ADVISOR, RED);
    const moves = engine.getValidMoves(7, 3);
    // col=2 不在九宫格内
    expect(moves.some(m => m.col === 2)).toBe(false);
  });

  it('仕不能直走', () => {
    placePiece(engine, 9, 3, PIECE_ADVISOR, RED);
    const moves = engine.getValidMoves(9, 3);
    expect(moves.some(m => m.row === 8 && m.col === 3)).toBe(false);
  });

  it('士在九宫中心有四个走法', () => {
    placePiece(engine, 1, 4, PIECE_ADVISOR, BLACK);
    const moves = engine.getValidMoves(1, 4);
    expect(moves.length).toBe(4);
  });

  it('仕不能吃己方棋子', () => {
    placePiece(engine, 9, 3, PIECE_ADVISOR, RED);
    placePiece(engine, 8, 4, PIECE_ADVISOR, RED);
    const moves = engine.getValidMoves(9, 3);
    expect(moves.some(m => m.row === 8 && m.col === 4)).toBe(false);
  });
});

// ==================== 象/相 走法 ====================

describe('象/相 走法', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
    placePiece(engine, 3, 4, PIECE_PAWN, RED); // 防止飞将
  });

  it('相走田字格', () => {
    placePiece(engine, 7, 4, PIECE_BISHOP, RED);
    const moves = engine.getValidMoves(7, 4);
    expect(moves.some(m => m.row === 9 && m.col === 2)).toBe(true);
    expect(moves.some(m => m.row === 9 && m.col === 6)).toBe(true);
    expect(moves.some(m => m.row === 5 && m.col === 2)).toBe(true);
    expect(moves.some(m => m.row === 5 && m.col === 6)).toBe(true);
  });

  it('相不能过河', () => {
    placePiece(engine, 7, 4, PIECE_BISHOP, RED);
    const moves = engine.getValidMoves(7, 4);
    // row 3 在河对岸
    expect(moves.some(m => m.row <= RIVER_TOP)).toBe(false);
  });

  it('象不能过河到红方区域', () => {
    placePiece(engine, 2, 4, PIECE_BISHOP, BLACK);
    const moves = engine.getValidMoves(2, 4);
    expect(moves.some(m => m.row >= RIVER_BOTTOM)).toBe(false);
  });

  it('相不能走被塞象眼的田字', () => {
    placePiece(engine, 7, 4, PIECE_BISHOP, RED);
    // 塞象眼：从(7,4)到(9,2)的象眼在(8,3)
    placePiece(engine, 8, 3, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(7, 4);
    expect(moves.some(m => m.row === 9 && m.col === 2)).toBe(false);
  });

  it('相在角落位置走法受限', () => {
    placePiece(engine, 9, 2, PIECE_BISHOP, RED);
    const moves = engine.getValidMoves(9, 2);
    // 只能走到 (7,0) 和 (7,4)
    expect(moves.length).toBe(2);
  });

  it('相可以吃对方棋子', () => {
    placePiece(engine, 7, 4, PIECE_BISHOP, RED);
    placePiece(engine, 5, 2, PIECE_PAWN, BLACK);
    const moves = engine.getValidMoves(7, 4);
    expect(moves.some(m => m.row === 5 && m.col === 2)).toBe(true);
  });
});

// ==================== 马 走法 ====================

describe('马 走法', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
    placePiece(engine, 3, 4, PIECE_PAWN, RED); // 防止飞将
  });

  it('马走日字格', () => {
    placePiece(engine, 5, 4, PIECE_KNIGHT, RED);
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 3 && m.col === 3)).toBe(true);
    expect(moves.some(m => m.row === 3 && m.col === 5)).toBe(true);
    expect(moves.some(m => m.row === 4 && m.col === 2)).toBe(true);
    expect(moves.some(m => m.row === 4 && m.col === 6)).toBe(true);
    expect(moves.some(m => m.row === 6 && m.col === 2)).toBe(true);
    expect(moves.some(m => m.row === 6 && m.col === 6)).toBe(true);
    expect(moves.some(m => m.row === 7 && m.col === 3)).toBe(true);
    expect(moves.some(m => m.row === 7 && m.col === 5)).toBe(true);
  });

  it('马不能走蹩马腿', () => {
    placePiece(engine, 5, 4, PIECE_KNIGHT, RED);
    // 蹩马腿：向上走日字时，先经过(4,4)
    placePiece(engine, 4, 4, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 3 && m.col === 3)).toBe(false);
    expect(moves.some(m => m.row === 3 && m.col === 5)).toBe(false);
  });

  it('马蹩马腿只影响一个方向', () => {
    placePiece(engine, 5, 4, PIECE_KNIGHT, RED);
    // 蹩上方马腿
    placePiece(engine, 4, 4, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(5, 4);
    // 左右方向不受影响
    expect(moves.some(m => m.row === 4 && m.col === 2)).toBe(true);
    expect(moves.some(m => m.row === 4 && m.col === 6)).toBe(true);
  });

  it('马横向蹩腿', () => {
    placePiece(engine, 5, 4, PIECE_KNIGHT, RED);
    // 向左走日字时，先经过(5,3)
    placePiece(engine, 5, 3, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 4 && m.col === 2)).toBe(false);
    expect(moves.some(m => m.row === 6 && m.col === 2)).toBe(false);
  });

  it('马在边角走法受限', () => {
    placePiece(engine, 0, 0, PIECE_KNIGHT, RED);
    const moves = engine.getValidMoves(0, 0);
    expect(moves.length).toBe(2); // (1,2) and (2,1)
  });

  it('马可以吃对方棋子', () => {
    placePiece(engine, 5, 4, PIECE_KNIGHT, RED);
    placePiece(engine, 3, 5, PIECE_PAWN, BLACK);
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 3 && m.col === 5)).toBe(true);
  });

  it('马不能吃己方棋子', () => {
    placePiece(engine, 5, 4, PIECE_KNIGHT, RED);
    placePiece(engine, 3, 5, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 3 && m.col === 5)).toBe(false);
  });
});

// ==================== 车 走法 ====================

describe('车 走法', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 0, PIECE_KING, RED);
    placePiece(engine, 0, 8, PIECE_KING, BLACK);
  });

  it('车可以直线任意格', () => {
    placePiece(engine, 5, 4, PIECE_ROOK, RED);
    const moves = engine.getValidMoves(5, 4);
    // 向上
    expect(moves.some(m => m.row === 4 && m.col === 4)).toBe(true);
    expect(moves.some(m => m.row === 0 && m.col === 4)).toBe(true);
    // 向下
    expect(moves.some(m => m.row === 6 && m.col === 4)).toBe(true);
    // 向左
    expect(moves.some(m => m.row === 5 && m.col === 0)).toBe(true);
    // 向右
    expect(moves.some(m => m.row === 5 && m.col === 8)).toBe(true);
  });

  it('车遇到己方棋子停止', () => {
    placePiece(engine, 5, 4, PIECE_ROOK, RED);
    placePiece(engine, 3, 4, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 2 && m.col === 4)).toBe(false);
    expect(moves.some(m => m.row === 3 && m.col === 4)).toBe(false);
  });

  it('车可以吃对方棋子并停止', () => {
    placePiece(engine, 5, 4, PIECE_ROOK, RED);
    placePiece(engine, 3, 4, PIECE_PAWN, BLACK);
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 3 && m.col === 4)).toBe(true);
    expect(moves.some(m => m.row === 2 && m.col === 4)).toBe(false);
  });

  it('车在角落走法受限', () => {
    placePiece(engine, 0, 0, PIECE_ROOK, RED);
    const moves = engine.getValidMoves(0, 0);
    // 只能向右和向下
    expect(moves.every(m => m.row === 0 || m.col === 0)).toBe(true);
  });

  it('车不能斜走', () => {
    placePiece(engine, 5, 4, PIECE_ROOK, RED);
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row !== 5 && m.col !== 4)).toBe(false);
  });
});

// ==================== 炮 走法 ====================

describe('炮 走法', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 0, PIECE_KING, RED);
    placePiece(engine, 0, 8, PIECE_KING, BLACK);
  });

  it('炮可以直线走空位', () => {
    placePiece(engine, 5, 4, PIECE_CANNON, RED);
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 4 && m.col === 4)).toBe(true);
    expect(moves.some(m => m.row === 6 && m.col === 4)).toBe(true);
  });

  it('炮吃子需隔一子（翻山）', () => {
    placePiece(engine, 5, 4, PIECE_CANNON, RED);
    placePiece(engine, 3, 4, PIECE_PAWN, RED); // 炮架
    placePiece(engine, 1, 4, PIECE_PAWN, BLACK); // 目标
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 1 && m.col === 4)).toBe(true);
  });

  it('炮不能直接吃子（无炮架）', () => {
    placePiece(engine, 5, 4, PIECE_CANNON, RED);
    placePiece(engine, 3, 4, PIECE_PAWN, BLACK);
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 3 && m.col === 4)).toBe(false);
  });

  it('炮遇到己方棋子停止走', () => {
    placePiece(engine, 5, 4, PIECE_CANNON, RED);
    placePiece(engine, 3, 4, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(5, 4);
    // 不能走到(3,4)因为己方棋子
    expect(moves.some(m => m.row === 3 && m.col === 4)).toBe(false);
  });

  it('炮翻山后不能吃己方棋子', () => {
    placePiece(engine, 5, 4, PIECE_CANNON, RED);
    placePiece(engine, 3, 4, PIECE_PAWN, RED); // 炮架
    placePiece(engine, 1, 4, PIECE_PAWN, RED); // 己方棋子
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 1 && m.col === 4)).toBe(false);
  });

  it('炮可以横向翻山吃子', () => {
    placePiece(engine, 5, 4, PIECE_CANNON, RED);
    placePiece(engine, 5, 6, PIECE_PAWN, RED); // 炮架
    placePiece(engine, 5, 8, PIECE_PAWN, BLACK); // 目标
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 5 && m.col === 8)).toBe(true);
  });

  it('炮不能跳过两个棋子吃子', () => {
    placePiece(engine, 5, 4, PIECE_CANNON, RED);
    placePiece(engine, 3, 4, PIECE_PAWN, RED); // 炮架1
    placePiece(engine, 2, 4, PIECE_PAWN, RED); // 炮架2
    placePiece(engine, 1, 4, PIECE_PAWN, BLACK); // 目标
    const moves = engine.getValidMoves(5, 4);
    expect(moves.some(m => m.row === 1 && m.col === 4)).toBe(false);
  });
});

// ==================== 兵/卒 走法 ====================

describe('兵/卒 走法', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 0, PIECE_KING, RED);
    placePiece(engine, 0, 8, PIECE_KING, BLACK);
  });

  it('红兵过河前只能前进', () => {
    placePiece(engine, 6, 4, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(6, 4);
    expect(moves.length).toBe(1);
    expect(moves[0]).toEqual({ row: 5, col: 4 });
  });

  it('红兵过河后可左右', () => {
    placePiece(engine, 4, 4, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(4, 4);
    expect(moves.some(m => m.row === 3 && m.col === 4)).toBe(true); // 前
    expect(moves.some(m => m.row === 4 && m.col === 3)).toBe(true); // 左
    expect(moves.some(m => m.row === 4 && m.col === 5)).toBe(true); // 右
  });

  it('红兵不能后退', () => {
    placePiece(engine, 4, 4, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(4, 4);
    expect(moves.some(m => m.row === 5 && m.col === 4)).toBe(false);
  });

  it('黑卒过河前只能前进（向下）', () => {
    placePiece(engine, 3, 4, PIECE_PAWN, BLACK);
    const moves = engine.getValidMoves(3, 4);
    expect(moves.length).toBe(1);
    expect(moves[0]).toEqual({ row: 4, col: 4 });
  });

  it('黑卒过河后可左右', () => {
    placePiece(engine, 6, 4, PIECE_PAWN, BLACK);
    const moves = engine.getValidMoves(6, 4);
    expect(moves.some(m => m.row === 7 && m.col === 4)).toBe(true); // 前
    expect(moves.some(m => m.row === 6 && m.col === 3)).toBe(true); // 左
    expect(moves.some(m => m.row === 6 && m.col === 5)).toBe(true); // 右
  });

  it('黑卒不能后退', () => {
    placePiece(engine, 6, 4, PIECE_PAWN, BLACK);
    const moves = engine.getValidMoves(6, 4);
    expect(moves.some(m => m.row === 5 && m.col === 4)).toBe(false);
  });

  it('兵在最左边不能向左', () => {
    placePiece(engine, 4, 0, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(4, 0);
    expect(moves.some(m => m.col === -1)).toBe(false);
  });

  it('兵可以吃对方棋子', () => {
    placePiece(engine, 6, 4, PIECE_PAWN, RED);
    placePiece(engine, 5, 4, PIECE_PAWN, BLACK);
    const moves = engine.getValidMoves(6, 4);
    expect(moves.some(m => m.row === 5 && m.col === 4)).toBe(true);
  });
});

// ==================== 飞将规则 ====================

describe('飞将规则', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
  });

  it('两将对面无子为飞将', () => {
    expect(engine.kingsOpposing()).toBe(true);
  });

  it('两将之间有子不是飞将', () => {
    placePiece(engine, 5, 4, PIECE_PAWN, RED);
    expect(engine.kingsOpposing()).toBe(false);
  });

  it('两将不在同一列不是飞将', () => {
    clearBoard(engine);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 0, 3, PIECE_KING, BLACK);
    expect(engine.kingsOpposing()).toBe(false);
  });

  it('走子后不能导致飞将', () => {
    // 设置一个场景：红方帅在(9,4)，黑将在(0,4)，中间有一个红炮在(5,4)
    placePiece(engine, 5, 4, PIECE_CANNON, RED);
    // 红炮移开后会导致飞将
    const moves = engine.getValidMoves(5, 4);
    // 红炮不能走到其他列然后让将帅对面（如果移到非4列位置）
    // 实际上红炮在(5,4)移走后帅和将直接对面，所以红炮不能离开第4列
    // 除非走到第4列的其他位置
    const canLeaveCol = moves.some(m => m.col !== 4);
    // 移到非4列会导致飞将，所以不能移
    expect(canLeaveCol).toBe(false);
  });

  it('飞将时帅不能直接吃将（需隔子）', () => {
    // 将帅对面，帅不能直接"飞"过去吃将
    const moves = engine.getValidMoves(9, 4);
    // 帅只能走九宫格内一步
    expect(moves.some(m => m.row === 0)).toBe(false);
  });
});

// ==================== 将军检测 ====================

describe('将军检测', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
  });

  it('车将军', () => {
    placePiece(engine, 0, 3, PIECE_ROOK, RED);
    expect(engine.isInCheck(BLACK)).toBe(true);
  });

  it('马将军', () => {
    placePiece(engine, 2, 3, PIECE_KNIGHT, RED);
    expect(engine.isInCheck(BLACK)).toBe(true);
  });

  it('炮翻山将军', () => {
    placePiece(engine, 2, 4, PIECE_CANNON, RED);
    placePiece(engine, 1, 4, PIECE_PAWN, BLACK); // 炮架
    expect(engine.isInCheck(BLACK)).toBe(true);
  });

  it('兵将军', () => {
    placePiece(engine, 1, 4, PIECE_PAWN, RED);
    expect(engine.isInCheck(BLACK)).toBe(true);
  });

  it('无子攻击时不将军', () => {
    expect(engine.isInCheck(RED)).toBe(false);
    expect(engine.isInCheck(BLACK)).toBe(false);
  });

  it('不能走后自己被将军', () => {
    placePiece(engine, 8, 4, PIECE_KING, RED);
    (engine as any).board[9][4] = null;
    placePiece(engine, 0, 4, PIECE_ROOK, BLACK); // 黑车在同一列
    // 帅不能走到(7,4)因为会被黑车攻击
    const moves = engine.getValidMoves(8, 4);
    expect(moves.some(m => m.row === 7 && m.col === 4)).toBe(false);
  });
});

// ==================== 将杀检测 ====================

describe('将杀检测', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
  });

  it('单车将杀（简单场景）', () => {
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 1, 3, PIECE_ROOK, RED);
    placePiece(engine, 1, 5, PIECE_ROOK, RED);
    // 黑将被双车封锁
    expect(engine.isCheckmate(BLACK)).toBe(true);
  });

  it('有逃路时不是将杀', () => {
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 1, 3, PIECE_ROOK, RED);
    // 黑将可以逃到(0,5)
    expect(engine.isCheckmate(BLACK)).toBe(false);
  });

  it('有子可挡时不是将杀', () => {
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 2, 4, PIECE_ADVISOR, BLACK);
    placePiece(engine, 3, 4, PIECE_ROOK, RED);
    // 仕可以挡住车的攻击
    expect(engine.isCheckmate(BLACK)).toBe(false);
  });

  it('无棋子时不是将杀', () => {
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    expect(engine.isCheckmate(BLACK)).toBe(false);
  });
});

// ==================== 走棋执行 ====================

describe('走棋执行', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 0, PIECE_KING, RED);
    placePiece(engine, 0, 8, PIECE_KING, BLACK);
    (engine as any).currentTurn = RED;
  });

  it('走棋后切换走棋方', () => {
    placePiece(engine, 7, 4, PIECE_ROOK, RED);
    engine.makeMove({ row: 7, col: 4 }, { row: 5, col: 4 });
    expect((engine as any).currentTurn).toBe(BLACK);
  });

  it('吃子后计分', () => {
    placePiece(engine, 7, 4, PIECE_ROOK, RED);
    placePiece(engine, 5, 4, PIECE_PAWN, BLACK);
    const initialScore = engine.score;
    engine.makeMove({ row: 7, col: 4 }, { row: 5, col: 4 });
    expect(engine.score).toBeGreaterThan(initialScore);
  });

  it('走棋后棋子位置更新', () => {
    placePiece(engine, 7, 4, PIECE_ROOK, RED);
    engine.makeMove({ row: 7, col: 4 }, { row: 5, col: 4 });
    const board = (engine as any).board;
    expect(board[7][4]).toBeNull();
    expect(board[5][4]).toEqual({ type: PIECE_ROOK, side: RED });
  });

  it('记录最后一步走法', () => {
    placePiece(engine, 7, 4, PIECE_ROOK, RED);
    engine.makeMove({ row: 7, col: 4 }, { row: 5, col: 4 });
    expect((engine as any).lastMove).toEqual({
      from: { row: 7, col: 4 },
      to: { row: 5, col: 4 },
    });
  });
});

// ==================== AI ====================

describe('AI', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 0, PIECE_KING, RED);
    placePiece(engine, 0, 8, PIECE_KING, BLACK);
    (engine as any).currentTurn = BLACK;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('AI 启用后走棋', () => {
    placePiece(engine, 2, 4, PIECE_ROOK, BLACK);
    (engine as any).aiMove();
    expect((engine as any).currentTurn).toBe(RED);
  });

  it('AI 优先吃高价值棋子', () => {
    placePiece(engine, 2, 4, PIECE_ROOK, BLACK);
    placePiece(engine, 2, 3, PIECE_PAWN, RED);  // 低价值
    placePiece(engine, 2, 5, PIECE_ROOK, RED);   // 高价值
    (engine as any).aiMove();
    // AI 应该选择吃红车，黑车移动到(2,5)
    const board = (engine as any).board;
    expect(board[2][5]).toEqual({ type: PIECE_ROOK, side: BLACK });
    expect(board[2][4]).toBeNull();
  });

  it('AI 无走法时判负', () => {
    // 黑方只有将，被完全封锁
    clearBoard(engine);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 0, 3, PIECE_KING, BLACK);
    placePiece(engine, 1, 3, PIECE_ROOK, RED);
    placePiece(engine, 1, 5, PIECE_ROOK, RED);
    (engine as any).currentTurn = BLACK;
    (engine as any).aiMove();
    expect((engine as any).gameOverFlag).toBe(true);
    expect((engine as any).winner).toBe(RED);
  });

  it('AI 走棋后状态变化', () => {
    placePiece(engine, 2, 4, PIECE_ROOK, BLACK);
    const stateBefore = (engine as any).board.map((row: any[]) => [...row]);
    (engine as any).aiMove();
    const stateAfter = (engine as any).board;
    // 棋盘应该有变化
    let changed = false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (stateBefore[r][c] !== stateAfter[r][c]) {
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
    expect(changed).toBe(true);
  });
});

// ==================== 键盘控制 ====================

describe('键盘控制', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
    (engine as any)._status = 'playing';
  });

  it('方向键上移动光标', () => {
    const { row } = (engine as any).cursorPos;
    engine.handleKeyDown('ArrowUp');
    expect((engine as any).cursorPos.row).toBe(row - 1);
  });

  it('方向键下移动光标', () => {
    engine.handleKeyDown('ArrowUp');
    (engine as any).lastCursorMove = 0; // 重置节流
    const { row } = (engine as any).cursorPos;
    engine.handleKeyDown('ArrowDown');
    expect((engine as any).cursorPos.row).toBe(row + 1);
  });

  it('方向键左移动光标', () => {
    const { col } = (engine as any).cursorPos;
    engine.handleKeyDown('ArrowLeft');
    expect((engine as any).cursorPos.col).toBe(col - 1);
  });

  it('方向键右移动光标', () => {
    const { col } = (engine as any).cursorPos;
    engine.handleKeyDown('ArrowRight');
    expect((engine as any).cursorPos.col).toBe(col + 1);
  });

  it('光标不能超出上边界', () => {
    for (let i = 0; i < 20; i++) {
      (engine as any).lastCursorMove = 0; // 重置节流
      engine.handleKeyDown('ArrowUp');
    }
    expect((engine as any).cursorPos.row).toBe(0);
  });

  it('光标不能超出下边界', () => {
    for (let i = 0; i < 20; i++) {
      (engine as any).lastCursorMove = 0; // 重置节流
      engine.handleKeyDown('ArrowDown');
    }
    expect((engine as any).cursorPos.row).toBe(ROWS - 1);
  });

  it('光标不能超出左边界', () => {
    for (let i = 0; i < 20; i++) {
      (engine as any).lastCursorMove = 0; // 重置节流
      engine.handleKeyDown('ArrowLeft');
    }
    expect((engine as any).cursorPos.col).toBe(0);
  });

  it('光标不能超出右边界', () => {
    for (let i = 0; i < 20; i++) {
      (engine as any).lastCursorMove = 0; // 重置节流
      engine.handleKeyDown('ArrowRight');
    }
    expect((engine as any).cursorPos.col).toBe(COLS - 1);
  });

  it('空格选择棋子', () => {
    // 光标在(9,4)是帅
    (engine as any).cursorPos = { row: 9, col: 4 };
    engine.handleKeyDown(' ');
    expect((engine as any).selectedPos).toEqual({ row: 9, col: 4 });
    expect((engine as any).validMoves.length).toBeGreaterThan(0);
  });

  it('空格取消选择', () => {
    (engine as any).cursorPos = { row: 9, col: 4 };
    engine.handleKeyDown(' '); // 选择帅
    // 移到(8,3) - 空位且不是合法目标
    (engine as any).cursorPos = { row: 8, col: 3 };
    engine.handleKeyDown(' '); // 取消
    expect((engine as any).selectedPos).toBeNull();
  });

  it('空格移动棋子', () => {
    (engine as any).cursorPos = { row: 6, col: 4 };
    engine.handleKeyDown(' '); // 选择兵
    (engine as any).lastCursorMove = 0; // 重置节流
    engine.handleKeyDown('ArrowUp'); // 移到(5,4)
    engine.handleKeyDown(' '); // 移动
    const board = (engine as any).board;
    expect(board[5][4]).toEqual({ type: PIECE_PAWN, side: RED });
    expect(board[6][4]).toBeNull();
  });

  it('游戏结束后不响应键盘', () => {
    (engine as any).gameOverFlag = true;
    const { row, col } = (engine as any).cursorPos;
    engine.handleKeyDown('ArrowUp');
    expect((engine as any).cursorPos.row).toBe(row);
  });

  it('handleKeyUp 不抛异常', () => {
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
  });
});

// ==================== getState ====================

describe('getState', () => {
  let engine: ChineseChessEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('返回棋盘状态', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('board');
    expect(state).toHaveProperty('currentTurn');
    expect(state).toHaveProperty('cursorPos');
    expect(state).toHaveProperty('selectedPos');
    expect(state).toHaveProperty('gameOver');
    expect(state).toHaveProperty('winner');
    expect(state).toHaveProperty('isCheck');
    expect(state).toHaveProperty('lastMove');
  });

  it('board 为 10x9 数组', () => {
    const state = engine.getState();
    const board = state.board as (any | null)[][];
    expect(board.length).toBe(10);
    expect(board[0].length).toBe(9);
  });

  it('初始 currentTurn 为 RED', () => {
    const state = engine.getState();
    expect(state.currentTurn).toBe(RED);
  });

  it('初始 gameOver 为 false', () => {
    const state = engine.getState();
    expect(state.gameOver).toBe(false);
  });

  it('初始 winner 为 null', () => {
    const state = engine.getState();
    expect(state.winner).toBeNull();
  });
});

// ==================== 生命周期 ====================

describe('生命周期', () => {
  it('init 初始化棋盘', () => {
    const engine = new ChineseChessEngine();
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 640;
    engine.setCanvas(canvas);
    engine.init();
    expect((engine as any).board.length).toBe(10);
  });

  it('start 重置状态', () => {
    const engine = createEngine();
    engine.start();
    expect((engine as any).currentTurn).toBe(RED);
    expect((engine as any).gameOverFlag).toBe(false);
    expect(engine.score).toBe(0);
  });

  it('reset 重置所有状态', () => {
    const engine = createEngine();
    engine.start();
    engine.reset();
    expect((engine as any).currentTurn).toBe(RED);
    expect((engine as any).gameOverFlag).toBe(false);
    expect((engine as any).selectedPos).toBeNull();
  });

  it('destroy 清理资源', () => {
    const engine = createEngine();
    engine.start();
    engine.destroy();
    expect((engine as any).gameOverFlag).toBe(false);
    expect((engine as any).aiTimer).toBeNull();
  });

  it('isWin 在红方胜利时为 true', () => {
    const engine = createEngine();
    expect(engine.isWin).toBe(false);
    (engine as any).isWin = true;
    expect(engine.isWin).toBe(true);
  });
});

// ==================== 综合场景 ====================

describe('综合场景', () => {
  it('完整走棋流程：红兵前进', () => {
    const engine = createEngine();
    (engine as any)._status = 'playing';
    (engine as any).cursorPos = { row: 6, col: 4 };
    engine.handleKeyDown(' '); // 选择兵
    (engine as any).lastCursorMove = 0; // 重置节流
    engine.handleKeyDown('ArrowUp');
    engine.handleKeyDown(' '); // 移动到(5,4)
    expect((engine as any).board[5][4]).toEqual({ type: PIECE_PAWN, side: RED });
    expect((engine as any).currentTurn).toBe(BLACK);
  });

  it('红车吃黑卒', () => {
    const engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 0, PIECE_KING, RED);
    placePiece(engine, 0, 8, PIECE_KING, BLACK);
    placePiece(engine, 5, 0, PIECE_ROOK, RED);
    placePiece(engine, 3, 0, PIECE_PAWN, BLACK);
    (engine as any).currentTurn = RED;

    const moves = engine.getValidMoves(5, 0);
    expect(moves.some(m => m.row === 3 && m.col === 0)).toBe(true);

    engine.makeMove({ row: 5, col: 0 }, { row: 3, col: 0 });
    expect((engine as any).board[3][0]).toEqual({ type: PIECE_ROOK, side: RED });
    expect(engine.score).toBeGreaterThan(0);
  });

  it('马蹩腿综合测试', () => {
    const engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 4, PIECE_KING, RED);
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
    placePiece(engine, 5, 5, PIECE_KNIGHT, RED);
    // 蹩右腿
    placePiece(engine, 5, 6, PIECE_PAWN, RED);
    const moves = engine.getValidMoves(5, 5);
    // 不能走到(4,7)和(6,7)
    expect(moves.some(m => m.row === 4 && m.col === 7)).toBe(false);
    expect(moves.some(m => m.row === 6 && m.col === 7)).toBe(false);
    // 可以走到其他方向
    expect(moves.some(m => m.row === 3 && m.col === 4)).toBe(true);
  });

  it('炮翻山吃子综合', () => {
    const engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 9, 0, PIECE_KING, RED);
    placePiece(engine, 0, 8, PIECE_KING, BLACK);
    placePiece(engine, 5, 0, PIECE_CANNON, RED);
    placePiece(engine, 3, 0, PIECE_PAWN, RED); // 炮架
    placePiece(engine, 2, 0, PIECE_ROOK, BLACK); // 目标
    const moves = engine.getValidMoves(5, 0);
    expect(moves.some(m => m.row === 2 && m.col === 0)).toBe(true);
  });

  it('飞将阻止走法', () => {
    const engine = createEngine();
    clearBoard(engine);
    placePiece(engine, 8, 4, PIECE_KING, RED);
    placePiece(engine, 0, 4, PIECE_KING, BLACK);
    placePiece(engine, 5, 4, PIECE_ROOK, RED);
    // 红车不能离开第4列，否则将帅对面
    const moves = engine.getValidMoves(5, 4);
    const nonCol4Moves = moves.filter(m => m.col !== 4);
    expect(nonCol4Moves.length).toBe(0);
  });
});
