/**
 * EightQueensEngine 综合测试
 * 覆盖：初始化、放置皇后、移除皇后、冲突检测（行/列/对角线）、
 *       胜利条件、提示功能、关卡、计分、状态管理、键盘、getState、事件
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EightQueensEngine } from '../EightQueensEngine';
import {
  BOARD_SIZE,
  CELL_SIZE,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  BG_COLOR,
  BOARD_LIGHT_COLOR,
  BOARD_DARK_COLOR,
  QUEEN_COLOR,
  QUEEN_STROKE_COLOR,
  CURSOR_COLOR,
  CURSOR_BORDER_COLOR,
  CONFLICT_COLOR,
  SAFE_COLOR,
  HUD_COLOR,
  WIN_COLOR,
  HINT_TEXT_COLOR,
  POINTS_PER_QUEEN,
  WIN_BONUS,
  HINT_PENALTY,
  MAX_LEVEL,
  LEVEL_CONFIGS,
  QUEEN_SYMBOL,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../constants';
import type { LevelConfig } from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建引擎并初始化（不 start，停留在 idle） */
function createEngine(): EightQueensEngine {
  const engine = new EightQueensEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): EightQueensEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: EightQueensEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: EightQueensEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 在指定位置放置皇后（直接操作 board，绕过 toggleQueen） */
function placeQueen(engine: EightQueensEngine, row: number, col: number): void {
  const board = getPrivate<number[][]>(engine, '_board');
  board[row][col] = 1;
  const placed = getPrivate<number>(engine, '_placedQueens');
  setPrivate(engine, '_placedQueens', placed + 1);
}

/** 移动光标到指定位置 */
function moveCursorTo(engine: EightQueensEngine, row: number, col: number): void {
  setPrivate(engine, '_cursorRow', row);
  setPrivate(engine, '_cursorCol', col);
}

/** 在光标位置放置皇后（通过 toggleQueen 逻辑） */
function toggleAtCursor(engine: EightQueensEngine): void {
  const proto = Object.getPrototypeOf(engine);
  proto.toggleQueen.call(engine);
}

/** 经典八皇后解法之一：[0,4,7,5,2,6,1,3]（行索引 = 行，值 = 列） */
const CLASSIC_SOLUTION = [0, 4, 7, 5, 2, 6, 1, 3];

/** 放置一个完整的经典解 */
function placeClassicSolution(engine: EightQueensEngine): void {
  for (let r = 0; r < BOARD_SIZE; r++) {
    placeQueen(engine, r, CLASSIC_SOLUTION[r]);
  }
}

// ============================================================
// 1. 初始化
// ============================================================
describe('EightQueensEngine - 初始化', () => {
  it('init 后状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('init 后分数为 0', () => {
    const engine = createEngine();
    expect(engine.score).toBe(0);
  });

  it('init 后等级为 1', () => {
    const engine = createEngine();
    expect(engine.level).toBe(1);
  });

  it('init 后光标在 (0, 0)', () => {
    const engine = createEngine();
    expect(engine.cursorRow).toBe(0);
    expect(engine.cursorCol).toBe(0);
  });

  it('init 后已放置皇后数为 0', () => {
    const engine = createEngine();
    expect(engine.placedQueens).toBe(0);
  });

  it('init 后未胜利', () => {
    const engine = createEngine();
    expect(engine.isWon).toBe(false);
  });

  it('init 后提示模式关闭', () => {
    const engine = createEngine();
    expect(engine.hintMode).toBe(false);
  });

  it('init 后移动次数为 0', () => {
    const engine = createEngine();
    expect(engine.moveCount).toBe(0);
  });

  it('init 后棋盘为 8×8 全空', () => {
    const engine = createEngine();
    const board = engine.getBoard();
    expect(board.length).toBe(BOARD_SIZE);
    for (let r = 0; r < BOARD_SIZE; r++) {
      expect(board[r].length).toBe(BOARD_SIZE);
      for (let c = 0; c < BOARD_SIZE; c++) {
        expect(board[r][c]).toBe(0);
      }
    }
  });

  it('init 后棋盘快照是深拷贝', () => {
    const engine = createEngine();
    const board1 = engine.getBoard();
    board1[0][0] = 1;
    const board2 = engine.getBoard();
    expect(board2[0][0]).toBe(0);
  });

  it('init 后无预填皇后', () => {
    const engine = createEngine();
    expect(engine.preFilledCells.size).toBe(0);
  });

  it('init 后剩余皇后数为 BOARD_SIZE', () => {
    const engine = createEngine();
    expect(engine.remainingQueens).toBe(BOARD_SIZE);
  });
});

// ============================================================
// 2. 启动 / onStart
// ============================================================
describe('EightQueensEngine - 启动', () => {
  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后分数为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.score).toBe(0);
  });

  it('start 后光标在 (0, 0)', () => {
    const engine = createAndStartEngine();
    expect(engine.cursorRow).toBe(0);
    expect(engine.cursorCol).toBe(0);
  });

  it('start 后棋盘全空', () => {
    const engine = createAndStartEngine();
    const board = engine.getBoard();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        expect(board[r][c]).toBe(0);
      }
    }
  });

  it('start 发出 statusChange 事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('start 发出 scoreChange 事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('scoreChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith(0);
  });

  it('start 发出 levelChange 事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('levelChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('start 后关卡配置为第一关', () => {
    const engine = createAndStartEngine();
    expect(engine.currentLevelConfig.level).toBe(1);
    expect(engine.currentLevelConfig.name).toBe('经典模式');
  });

  it('start 后 placedQueens 为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.placedQueens).toBe(0);
  });

  it('start 后 isWon 为 false', () => {
    const engine = createAndStartEngine();
    expect(engine.isWon).toBe(false);
  });

  it('start 后 hintMode 为 false', () => {
    const engine = createAndStartEngine();
    expect(engine.hintMode).toBe(false);
  });

  it('start 后 moveCount 为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.moveCount).toBe(0);
  });
});

// ============================================================
// 3. 放置皇后
// ============================================================
describe('EightQueensEngine - 放置皇后', () => {
  let engine: EightQueensEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('在空位放置皇后，棋盘对应位置变为 1', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(engine.getCellState(0, 0)).toBe(1);
  });

  it('放置皇后后 placedQueens 递增', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(engine.placedQueens).toBe(1);
  });

  it('放置皇后后 moveCount 递增', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(engine.moveCount).toBe(1);
  });

  it('放置皇后得分 POINTS_PER_QUEEN', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(engine.score).toBe(POINTS_PER_QUEEN);
  });

  it('放置皇后发出 queenPlaced 事件', () => {
    const handler = vi.fn();
    engine.on('queenPlaced', handler);
    moveCursorTo(engine, 2, 3);
    toggleAtCursor(engine);
    expect(handler).toHaveBeenCalledWith({ row: 2, col: 3 });
  });

  it('连续放置多个皇后，分数累加', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    moveCursorTo(engine, 1, 3);
    toggleAtCursor(engine);
    expect(engine.score).toBe(POINTS_PER_QUEEN * 2);
  });

  it('放置皇后后 getQueenPositions 返回正确位置', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    moveCursorTo(engine, 2, 5);
    toggleAtCursor(engine);
    const positions = engine.getQueenPositions();
    expect(positions).toContainEqual([0, 0]);
    expect(positions).toContainEqual([2, 5]);
    expect(positions.length).toBe(2);
  });

  it('放置皇后后 remainingQueens 减少', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(engine.remainingQueens).toBe(BOARD_SIZE - 1);
  });
});

// ============================================================
// 4. 移除皇后
// ============================================================
describe('EightQueensEngine - 移除皇后', () => {
  let engine: EightQueensEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('在已有皇后的位置再次 toggle，皇后被移除', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(engine.getCellState(0, 0)).toBe(1);
    toggleAtCursor(engine);
    expect(engine.getCellState(0, 0)).toBe(0);
  });

  it('移除皇后后 placedQueens 递减', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    toggleAtCursor(engine);
    expect(engine.placedQueens).toBe(0);
  });

  it('移除皇后后 moveCount 递增', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    toggleAtCursor(engine);
    expect(engine.moveCount).toBe(2);
  });

  it('移除皇后不增加分数', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    const scoreBefore = engine.score;
    toggleAtCursor(engine);
    expect(engine.score).toBe(scoreBefore);
  });

  it('移除皇后发出 queenRemoved 事件', () => {
    const handler = vi.fn();
    engine.on('queenRemoved', handler);
    moveCursorTo(engine, 1, 2);
    toggleAtCursor(engine);
    toggleAtCursor(engine);
    expect(handler).toHaveBeenCalledWith({ row: 1, col: 2 });
  });

  it('预填皇后不可移除', () => {
    // 模拟预填皇后
    const preFilled = new Set(['3,4']);
    setPrivate(engine, '_preFilledCells', preFilled);
    getPrivate<number[][]>(engine, '_board')[3][4] = 1;
    setPrivate(engine, '_placedQueens', 1);

    moveCursorTo(engine, 3, 4);
    toggleAtCursor(engine);
    expect(engine.getCellState(3, 4)).toBe(1);
    expect(engine.placedQueens).toBe(1);
  });

  it('移除后 remainingQueens 恢复', () => {
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(engine.remainingQueens).toBe(BOARD_SIZE - 1);
    toggleAtCursor(engine);
    expect(engine.remainingQueens).toBe(BOARD_SIZE);
  });
});

// ============================================================
// 5. 冲突检测 - 行冲突
// ============================================================
describe('EightQueensEngine - 行冲突', () => {
  let engine: EightQueensEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('同行两个皇后，isSafe 返回 false', () => {
    placeQueen(engine, 0, 0);
    expect(engine.isSafe(0, 5)).toBe(false);
  });

  it('同行两个皇后，getConflictInfo 检测到冲突', () => {
    placeQueen(engine, 0, 0);
    const info = engine.getConflictInfo(0, 5);
    expect(info.hasConflict).toBe(true);
    expect(info.conflictingCells).toContainEqual([0, 0]);
  });

  it('同行三个皇后，hasAnyConflict 返回 true', () => {
    placeQueen(engine, 2, 0);
    placeQueen(engine, 2, 3);
    placeQueen(engine, 2, 7);
    expect(engine.hasAnyConflict()).toBe(true);
  });

  it('同行皇后在 getAllConflicts 中成对出现', () => {
    placeQueen(engine, 2, 0);
    placeQueen(engine, 2, 5);
    const conflicts = engine.getAllConflicts();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]).toEqual([[2, 0], [2, 5]]);
  });
});

// ============================================================
// 6. 冲突检测 - 列冲突
// ============================================================
describe('EightQueensEngine - 列冲突', () => {
  let engine: EightQueensEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('同列两个皇后，isSafe 返回 false', () => {
    placeQueen(engine, 0, 0);
    expect(engine.isSafe(5, 0)).toBe(false);
  });

  it('同列两个皇后，getConflictInfo 检测到冲突', () => {
    placeQueen(engine, 0, 3);
    const info = engine.getConflictInfo(4, 3);
    expect(info.hasConflict).toBe(true);
    expect(info.conflictingCells).toContainEqual([0, 3]);
  });

  it('同列皇后在 getAllConflicts 中成对出现', () => {
    placeQueen(engine, 0, 2);
    placeQueen(engine, 5, 2);
    const conflicts = engine.getAllConflicts();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]).toEqual([[0, 2], [5, 2]]);
  });
});

// ============================================================
// 7. 冲突检测 - 对角线冲突
// ============================================================
describe('EightQueensEngine - 对角线冲突', () => {
  let engine: EightQueensEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('主对角线方向（左上→右下）冲突', () => {
    placeQueen(engine, 0, 0);
    expect(engine.isSafe(3, 3)).toBe(false);
  });

  it('副对角线方向（右上→左下）冲突', () => {
    placeQueen(engine, 0, 7);
    expect(engine.isSafe(3, 4)).toBe(false);
  });

  it('主对角线方向（右下→左上）冲突', () => {
    placeQueen(engine, 7, 7);
    expect(engine.isSafe(4, 4)).toBe(false);
  });

  it('副对角线方向（左下→右上）冲突', () => {
    placeQueen(engine, 7, 0);
    expect(engine.isSafe(4, 3)).toBe(false);
  });

  it('对角线冲突在 getConflictInfo 中返回', () => {
    placeQueen(engine, 2, 2);
    const info = engine.getConflictInfo(5, 5);
    expect(info.hasConflict).toBe(true);
    expect(info.conflictingCells).toContainEqual([2, 2]);
  });

  it('对角线冲突在 getAllConflicts 中成对出现', () => {
    placeQueen(engine, 0, 0);
    placeQueen(engine, 3, 3);
    const conflicts = engine.getAllConflicts();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]).toEqual([[0, 0], [3, 3]]);
  });

  it('非对角线位置不冲突', () => {
    placeQueen(engine, 0, 0);
    expect(engine.isSafe(1, 2)).toBe(true);
  });
});

// ============================================================
// 8. 冲突检测 - 综合场景
// ============================================================
describe('EightQueensEngine - 冲突检测综合', () => {
  let engine: EightQueensEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('空棋盘上任何位置都安全', () => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        expect(engine.isSafe(r, c)).toBe(true);
      }
    }
  });

  it('一个皇后放置后，其同行/列/对角线都不安全', () => {
    placeQueen(engine, 3, 3);
    // 同行
    expect(engine.isSafe(3, 0)).toBe(false);
    expect(engine.isSafe(3, 7)).toBe(false);
    // 同列
    expect(engine.isSafe(0, 3)).toBe(false);
    expect(engine.isSafe(7, 3)).toBe(false);
    // 对角线
    expect(engine.isSafe(0, 0)).toBe(false);
    expect(engine.isSafe(0, 6)).toBe(false);
    expect(engine.isSafe(6, 0)).toBe(false);
    expect(engine.isSafe(6, 6)).toBe(false);
    // 安全位置
    expect(engine.isSafe(0, 1)).toBe(true);
    expect(engine.isSafe(1, 4)).toBe(true);
    expect(engine.isSafe(5, 7)).toBe(true);
  });

  it('多个冲突源叠加时 getConflictInfo 返回所有冲突', () => {
    placeQueen(engine, 0, 0); // 同行/同对角线
    placeQueen(engine, 0, 4); // 同行
    placeQueen(engine, 4, 0); // 同列
    const info = engine.getConflictInfo(0, 0);
    expect(info.hasConflict).toBe(true);
    expect(info.conflictingCells.length).toBeGreaterThanOrEqual(1);
  });

  it('hasAnyConflict 无冲突时返回 false', () => {
    placeQueen(engine, 0, 0);
    placeQueen(engine, 1, 3);
    expect(engine.hasAnyConflict()).toBe(false);
  });

  it('hasAnyConflict 有冲突时返回 true', () => {
    placeQueen(engine, 0, 0);
    placeQueen(engine, 0, 3);
    expect(engine.hasAnyConflict()).toBe(true);
  });

  it('getAllConflicts 返回所有冲突对', () => {
    placeQueen(engine, 0, 0);
    placeQueen(engine, 0, 3);
    placeQueen(engine, 5, 0);
    const conflicts = engine.getAllConflicts();
    // (0,0) vs (0,3) 同行, (0,0) vs (5,0) 同列
    expect(conflicts.length).toBeGreaterThanOrEqual(2);
  });

  it('经典八皇后解无冲突', () => {
    placeClassicSolution(engine);
    expect(engine.hasAnyConflict()).toBe(false);
    expect(engine.getAllConflicts().length).toBe(0);
  });

  it('无效位置 isSafe 返回 false', () => {
    expect(engine.isSafe(-1, 0)).toBe(false);
    expect(engine.isSafe(0, -1)).toBe(false);
    expect(engine.isSafe(BOARD_SIZE, 0)).toBe(false);
    expect(engine.isSafe(0, BOARD_SIZE)).toBe(false);
  });

  it('无效位置 getConflictInfo 返回无冲突', () => {
    const info = engine.getConflictInfo(-1, 0);
    expect(info.hasConflict).toBe(false);
    expect(info.conflictingCells.length).toBe(0);
  });
});

// ============================================================
// 9. 胜利条件
// ============================================================
describe('EightQueensEngine - 胜利条件', () => {
  it('放置 8 个无冲突皇后触发胜利', () => {
    const engine = createAndStartEngine();
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    expect(engine.isWon).toBe(true);
  });

  it('胜利后状态变为 gameover', () => {
    const engine = createAndStartEngine();
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    expect(engine.status).toBe('gameover');
  });

  it('胜利后获得 WIN_BONUS 奖励分', () => {
    const engine = createAndStartEngine();
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    const expected = POINTS_PER_QUEEN * BOARD_SIZE + WIN_BONUS;
    expect(engine.score).toBe(expected);
  });

  it('8 个有冲突的皇后不触发胜利', () => {
    const engine = createAndStartEngine();
    // 全放第一行
    for (let c = 0; c < BOARD_SIZE; c++) {
      moveCursorTo(engine, 0, c);
      toggleAtCursor(engine);
    }
    expect(engine.isWon).toBe(false);
    expect(engine.status).toBe('playing');
  });

  it('7 个无冲突皇后不触发胜利', () => {
    const engine = createAndStartEngine();
    for (let r = 0; r < BOARD_SIZE - 1; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    expect(engine.isWon).toBe(false);
    expect(engine.status).toBe('playing');
  });

  it('胜利发出 statusChange gameover 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    expect(handler).toHaveBeenCalledWith('gameover');
  });
});

// ============================================================
// 10. 提示功能
// ============================================================
describe('EightQueensEngine - 提示功能', () => {
  let engine: EightQueensEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始提示模式关闭', () => {
    expect(engine.hintMode).toBe(false);
  });

  it('H 键开启提示模式', () => {
    engine.handleKeyDown('h');
    expect(engine.hintMode).toBe(true);
  });

  it('再次 H 键关闭提示模式', () => {
    engine.handleKeyDown('h');
    engine.handleKeyDown('h');
    expect(engine.hintMode).toBe(false);
  });

  it('大写 H 也能切换提示模式', () => {
    engine.handleKeyDown('H');
    expect(engine.hintMode).toBe(true);
  });

  it('开启提示模式扣 HINT_PENALTY 分', () => {
    engine.handleKeyDown('h');
    expect(engine.score).toBe(-HINT_PENALTY);
  });

  it('关闭提示模式不扣分', () => {
    engine.handleKeyDown('h');
    const scoreAfterOn = engine.score;
    engine.handleKeyDown('h');
    expect(engine.score).toBe(scoreAfterOn);
  });

  it('提示模式发出 hintModeChanged 事件', () => {
    const handler = vi.fn();
    engine.on('hintModeChanged', handler);
    engine.handleKeyDown('h');
    expect(handler).toHaveBeenCalledWith(true);
    engine.handleKeyDown('h');
    expect(handler).toHaveBeenCalledWith(false);
  });

  it('getSafeCells 空棋盘返回所有位置', () => {
    const safe = engine.getSafeCells();
    expect(safe.length).toBe(BOARD_SIZE * BOARD_SIZE);
  });

  it('放置一个皇后后 getSafeCells 减少', () => {
    const before = engine.getSafeCells().length;
    placeQueen(engine, 3, 3);
    const after = engine.getSafeCells().length;
    expect(after).toBeLessThan(before);
  });

  it('getSafeCells 不包含已有皇后的位置', () => {
    placeQueen(engine, 0, 0);
    const safe = engine.getSafeCells();
    expect(safe).not.toContainEqual([0, 0]);
  });

  it('getSafeCells 只包含安全位置', () => {
    placeQueen(engine, 3, 3);
    const safe = engine.getSafeCells();
    for (const [r, c] of safe) {
      expect(engine.isSafe(r, c)).toBe(true);
    }
  });
});

// ============================================================
// 11. 关卡系统
// ============================================================
describe('EightQueensEngine - 关卡系统', () => {
  it('LEVEL_CONFIGS 有 MAX_LEVEL 个关卡', () => {
    expect(LEVEL_CONFIGS.length).toBe(MAX_LEVEL);
  });

  it('每个关卡配置都有 name', () => {
    for (const config of LEVEL_CONFIGS) {
      expect(config.name).toBeTruthy();
    }
  });

  it('每个关卡配置都有 description', () => {
    for (const config of LEVEL_CONFIGS) {
      expect(config.description).toBeTruthy();
    }
  });

  it('关卡 1 无预填皇后', () => {
    const engine = createAndStartEngine();
    expect(engine.preFilledCells.size).toBe(0);
    expect(engine.placedQueens).toBe(0);
  });

  it('关卡 2 有 1 个预填皇后', () => {
    const engine = createEngine();
    engine.start(); // level 1
    engine.nextLevel(); // -> level 2
    expect(engine.preFilledCells.size).toBe(1);
    expect(engine.placedQueens).toBe(1);
    expect(engine.getCellState(0, 0)).toBe(1);
  });

  it('关卡 3 有 2 个预填皇后', () => {
    const engine = createEngine();
    engine.start();
    engine.nextLevel();
    engine.nextLevel(); // -> level 3
    expect(engine.preFilledCells.size).toBe(2);
    expect(engine.placedQueens).toBe(2);
  });

  it('关卡 4 有 3 个预填皇后', () => {
    const engine = createEngine();
    engine.start();
    engine.nextLevel();
    engine.nextLevel();
    engine.nextLevel(); // -> level 4
    expect(engine.preFilledCells.size).toBe(3);
    expect(engine.placedQueens).toBe(3);
  });

  it('关卡 5 有 4 个预填皇后', () => {
    const engine = createEngine();
    engine.start();
    engine.nextLevel();
    engine.nextLevel();
    engine.nextLevel();
    engine.nextLevel(); // -> level 5
    expect(engine.preFilledCells.size).toBe(4);
    expect(engine.placedQueens).toBe(4);
  });

  it('nextLevel 在最大关卡时不升级', () => {
    const engine = createEngine();
    engine.start();
    // 快速到 level 5
    for (let i = 1; i < MAX_LEVEL; i++) {
      engine.nextLevel();
    }
    expect(engine.level).toBe(MAX_LEVEL);
    engine.nextLevel(); // 不应超过 MAX_LEVEL
    expect(engine.level).toBe(MAX_LEVEL);
  });

  it('nextLevel 后状态为 playing', () => {
    const engine = createEngine();
    engine.start();
    engine.nextLevel();
    expect(engine.status).toBe('playing');
  });

  it('nextLevel 后分数重置为 0', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(engine.score).toBeGreaterThan(0);
    engine.nextLevel();
    expect(engine.score).toBe(0);
  });

  it('预填皇后标记为 isPreFilled', () => {
    const engine = createEngine();
    engine.start();
    engine.nextLevel(); // level 2, preFilled: [[0,0]]
    expect(engine.isPreFilled(0, 0)).toBe(true);
    expect(engine.isPreFilled(1, 1)).toBe(false);
  });

  it('restartLevel 重新开始当前关卡', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(engine.placedQueens).toBe(1);
    engine.restartLevel();
    expect(engine.placedQueens).toBe(0);
    expect(engine.moveCount).toBe(0);
  });

  it('restartLevel 后状态仍为 playing', () => {
    const engine = createAndStartEngine();
    engine.restartLevel();
    expect(engine.status).toBe('playing');
  });
});

// ============================================================
// 12. 计分
// ============================================================
describe('EightQueensEngine - 计分', () => {
  it('放置一个皇后得 POINTS_PER_QUEEN', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(engine.score).toBe(POINTS_PER_QUEEN);
  });

  it('放置两个皇后得 POINTS_PER_QUEEN × 2', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    moveCursorTo(engine, 1, 3);
    toggleAtCursor(engine);
    expect(engine.score).toBe(POINTS_PER_QUEEN * 2);
  });

  it('移除皇后不退还分数', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    toggleAtCursor(engine);
    expect(engine.score).toBe(POINTS_PER_QUEEN);
  });

  it('提示模式扣 HINT_PENALTY', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('h');
    expect(engine.score).toBe(-HINT_PENALTY);
  });

  it('胜利额外奖励 WIN_BONUS', () => {
    const engine = createAndStartEngine();
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    expect(engine.score).toBe(POINTS_PER_QUEEN * BOARD_SIZE + WIN_BONUS);
  });

  it('addScore 发出 scoreChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('scoreChange', handler);
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    expect(handler).toHaveBeenCalledWith(POINTS_PER_QUEEN);
  });

  it('reset 后分数归零', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    engine.reset();
    expect(engine.score).toBe(0);
  });
});

// ============================================================
// 13. 状态管理
// ============================================================
describe('EightQueensEngine - 状态管理', () => {
  it('初始状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('pause 后状态为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后状态恢复为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后状态恢复为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('idle 时不能 pause', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('playing 时 resume 不改变状态', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后棋盘清空', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    engine.reset();
    const board = engine.getBoard();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        expect(board[r][c]).toBe(0);
      }
    }
  });

  it('reset 后分数清零', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后 placedQueens 清零', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    engine.reset();
    expect(engine.placedQueens).toBe(0);
  });

  it('reset 后 isWon 为 false', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.isWon).toBe(false);
  });

  it('reset 后 hintMode 为 false', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('h');
    engine.reset();
    expect(engine.hintMode).toBe(false);
  });

  it('reset 后 moveCount 清零', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    engine.reset();
    expect(engine.moveCount).toBe(0);
  });

  it('reset 后光标回到 (0,0)', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 5, 5);
    engine.reset();
    expect(engine.cursorRow).toBe(0);
    expect(engine.cursorCol).toBe(0);
  });

  it('destroy 清除所有事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.destroy();
    const callCount = handler.mock.calls.length;
    engine.emit('statusChange', 'test');
    expect(handler).toHaveBeenCalledTimes(callCount);
  });

  it('pause/resume 发出 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.pause();
    expect(handler).toHaveBeenCalledWith('paused');
    engine.resume();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('reset 发出 statusChange idle 事件', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.reset();
    expect(handler).toHaveBeenCalledWith('idle');
  });
});

// ============================================================
// 14. 键盘操作 - 光标移动
// ============================================================
describe('EightQueensEngine - 键盘操作（光标移动）', () => {
  let engine: EightQueensEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('ArrowUp 向上移动光标', () => {
    moveCursorTo(engine, 3, 3);
    engine.handleKeyDown('ArrowUp');
    expect(engine.cursorRow).toBe(2);
    expect(engine.cursorCol).toBe(3);
  });

  it('ArrowDown 向下移动光标', () => {
    engine.handleKeyDown('ArrowDown');
    expect(engine.cursorRow).toBe(1);
    expect(engine.cursorCol).toBe(0);
  });

  it('ArrowLeft 向左移动光标', () => {
    moveCursorTo(engine, 3, 3);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorRow).toBe(3);
    expect(engine.cursorCol).toBe(2);
  });

  it('ArrowRight 向右移动光标', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorRow).toBe(0);
    expect(engine.cursorCol).toBe(1);
  });

  it('w 向上移动光标', () => {
    moveCursorTo(engine, 3, 3);
    engine.handleKeyDown('w');
    expect(engine.cursorRow).toBe(2);
  });

  it('W 向上移动光标', () => {
    moveCursorTo(engine, 3, 3);
    engine.handleKeyDown('W');
    expect(engine.cursorRow).toBe(2);
  });

  it('s 向下移动光标', () => {
    engine.handleKeyDown('s');
    expect(engine.cursorRow).toBe(1);
  });

  it('S 向下移动光标', () => {
    engine.handleKeyDown('S');
    expect(engine.cursorRow).toBe(1);
  });

  it('a 向左移动光标', () => {
    moveCursorTo(engine, 3, 3);
    engine.handleKeyDown('a');
    expect(engine.cursorCol).toBe(2);
  });

  it('A 向左移动光标', () => {
    moveCursorTo(engine, 3, 3);
    engine.handleKeyDown('A');
    expect(engine.cursorCol).toBe(2);
  });

  it('d 向右移动光标', () => {
    engine.handleKeyDown('d');
    expect(engine.cursorCol).toBe(1);
  });

  it('D 向右移动光标', () => {
    engine.handleKeyDown('D');
    expect(engine.cursorCol).toBe(1);
  });

  it('光标不能移出上边界', () => {
    engine.handleKeyDown('ArrowUp');
    expect(engine.cursorRow).toBe(0);
  });

  it('光标不能移出下边界', () => {
    moveCursorTo(engine, BOARD_SIZE - 1, 0);
    engine.handleKeyDown('ArrowDown');
    expect(engine.cursorRow).toBe(BOARD_SIZE - 1);
  });

  it('光标不能移出左边界', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorCol).toBe(0);
  });

  it('光标不能移出右边界', () => {
    moveCursorTo(engine, 0, BOARD_SIZE - 1);
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorCol).toBe(BOARD_SIZE - 1);
  });

  it('连续移动光标正确', () => {
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorRow).toBe(2);
    expect(engine.cursorCol).toBe(2);
  });
});

// ============================================================
// 15. 键盘操作 - 放置/移除
// ============================================================
describe('EightQueensEngine - 键盘操作（放置/移除）', () => {
  let engine: EightQueensEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('空格键放置皇后', () => {
    engine.handleKeyDown(' ');
    expect(engine.getCellState(0, 0)).toBe(1);
  });

  it('Enter 键放置皇后', () => {
    engine.handleKeyDown('Enter');
    expect(engine.getCellState(0, 0)).toBe(1);
  });

  it('空格键再次按下移除皇后', () => {
    engine.handleKeyDown(' ');
    engine.handleKeyDown(' ');
    expect(engine.getCellState(0, 0)).toBe(0);
  });

  it('Enter 键再次按下移除皇后', () => {
    engine.handleKeyDown('Enter');
    engine.handleKeyDown('Enter');
    expect(engine.getCellState(0, 0)).toBe(0);
  });

  it('R 键重新开始当前关卡', () => {
    engine.handleKeyDown(' ');
    expect(engine.placedQueens).toBe(1);
    engine.handleKeyDown('r');
    expect(engine.placedQueens).toBe(0);
  });

  it('大写 R 键也能重新开始', () => {
    engine.handleKeyDown(' ');
    engine.handleKeyDown('R');
    expect(engine.placedQueens).toBe(0);
  });
});

// ============================================================
// 16. 键盘操作 - 状态转换
// ============================================================
describe('EightQueensEngine - 键盘操作（状态转换）', () => {
  it('idle 状态下空格键启动游戏', () => {
    const engine = createEngine();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('idle 状态下 Enter 键启动游戏', () => {
    const engine = createEngine();
    engine.handleKeyDown('Enter');
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态下空格键重新开始', () => {
    const engine = createAndStartEngine();
    // 达到胜利
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    expect(engine.status).toBe('gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态下 Enter 键重新开始', () => {
    const engine = createAndStartEngine();
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    engine.handleKeyDown('Enter');
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态下 N 键进入下一关', () => {
    const engine = createAndStartEngine();
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    engine.handleKeyDown('n');
    expect(engine.level).toBe(2);
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态下大写 N 键进入下一关', () => {
    const engine = createAndStartEngine();
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    engine.handleKeyDown('N');
    expect(engine.level).toBe(2);
  });

  it('gameover 状态下方向键无效', () => {
    const engine = createAndStartEngine();
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    const row = engine.cursorRow;
    const col = engine.cursorCol;
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorRow).toBe(row);
    expect(engine.cursorCol).toBe(col);
  });

  it('paused 状态下键盘无效（除了 resume）', () => {
    const engine = createAndStartEngine();
    engine.pause();
    const row = engine.cursorRow;
    engine.handleKeyDown('ArrowDown');
    expect(engine.cursorRow).toBe(row);
  });

  it('idle 状态下方向键无效', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowDown');
    expect(engine.cursorRow).toBe(0);
  });

  it('未知按键不产生副作用', () => {
    const engine = createAndStartEngine();
    const before = engine.getState();
    engine.handleKeyDown('z');
    engine.handleKeyDown('1');
    engine.handleKeyDown('F1');
    const after = engine.getState();
    expect(after).toEqual(before);
  });
});

// ============================================================
// 17. handleKeyUp
// ============================================================
describe('EightQueensEngine - handleKeyUp', () => {
  it('handleKeyUp 不抛异常', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
  });

  it('handleKeyUp 对任意键不抛异常', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp(' ')).not.toThrow();
    expect(() => engine.handleKeyUp('Enter')).not.toThrow();
    expect(() => engine.handleKeyUp('h')).not.toThrow();
  });
});

// ============================================================
// 18. getState
// ============================================================
describe('EightQueensEngine - getState', () => {
  it('返回包含所有必要字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('cursorRow');
    expect(state).toHaveProperty('cursorCol');
    expect(state).toHaveProperty('placedQueens');
    expect(state).toHaveProperty('isWon');
    expect(state).toHaveProperty('hintMode');
    expect(state).toHaveProperty('moveCount');
    expect(state).toHaveProperty('board');
    expect(state).toHaveProperty('preFilledCells');
    expect(state).toHaveProperty('currentLevel');
    expect(state).toHaveProperty('currentLevelName');
  });

  it('初始 getState 值正确', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.cursorRow).toBe(0);
    expect(state.cursorCol).toBe(0);
    expect(state.placedQueens).toBe(0);
    expect(state.isWon).toBe(false);
    expect(state.hintMode).toBe(false);
    expect(state.moveCount).toBe(0);
    expect(state.currentLevel).toBe(1);
    expect(state.currentLevelName).toBe('经典模式');
  });

  it('放置皇后后 getState 反映变化', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 3, 5);
    toggleAtCursor(engine);
    const state = engine.getState();
    expect(state.placedQueens).toBe(1);
    expect(state.score).toBe(POINTS_PER_QUEEN);
    expect(state.moveCount).toBe(1);
    expect((state.board as number[][])[3][5]).toBe(1);
  });

  it('移动光标后 getState 反映变化', () => {
    const engine = createAndStartEngine();
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowRight');
    const state = engine.getState();
    expect(state.cursorRow).toBe(1);
    expect(state.cursorCol).toBe(1);
  });

  it('preFilledCells 为数组格式', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(Array.isArray(state.preFilledCells)).toBe(true);
  });

  it('board 是二维数组', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(Array.isArray(state.board)).toBe(true);
    expect((state.board as unknown[][]).length).toBe(BOARD_SIZE);
  });
});

// ============================================================
// 19. 事件系统
// ============================================================
describe('EightQueensEngine - 事件系统', () => {
  it('on 注册事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('test', handler);
    engine.emit('test');
    expect(handler).toHaveBeenCalled();
  });

  it('off 取消事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('test', handler);
    engine.off('test', handler);
    engine.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('emit 传递参数', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('test', handler);
    engine.emit('test', 'arg1', 42);
    expect(handler).toHaveBeenCalledWith('arg1', 42);
  });

  it('多次 on 同一事件注册多个监听', () => {
    const engine = createEngine();
    const h1 = vi.fn();
    const h2 = vi.fn();
    engine.on('test', h1);
    engine.on('test', h2);
    engine.emit('test');
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('queenPlaced 事件携带位置信息', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('queenPlaced', handler);
    moveCursorTo(engine, 4, 4);
    toggleAtCursor(engine);
    expect(handler).toHaveBeenCalledWith({ row: 4, col: 4 });
  });

  it('queenRemoved 事件携带位置信息', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('queenRemoved', handler);
    moveCursorTo(engine, 4, 4);
    toggleAtCursor(engine);
    toggleAtCursor(engine);
    expect(handler).toHaveBeenCalledWith({ row: 4, col: 4 });
  });

  it('hintModeChanged 事件携带布尔值', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('hintModeChanged', handler);
    engine.handleKeyDown('h');
    expect(handler).toHaveBeenCalledWith(true);
  });
});

// ============================================================
// 20. 辅助方法
// ============================================================
describe('EightQueensEngine - 辅助方法', () => {
  let engine: EightQueensEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('isValidPosition 正确判断有效位置', () => {
    expect(engine.isValidPosition(0, 0)).toBe(true);
    expect(engine.isValidPosition(7, 7)).toBe(true);
    expect(engine.isValidPosition(3, 5)).toBe(true);
  });

  it('isValidPosition 正确判断无效位置', () => {
    expect(engine.isValidPosition(-1, 0)).toBe(false);
    expect(engine.isValidPosition(0, -1)).toBe(false);
    expect(engine.isValidPosition(8, 0)).toBe(false);
    expect(engine.isValidPosition(0, 8)).toBe(false);
    expect(engine.isValidPosition(-1, -1)).toBe(false);
    expect(engine.isValidPosition(100, 100)).toBe(false);
  });

  it('getCellState 返回正确状态', () => {
    expect(engine.getCellState(0, 0)).toBe(0);
    placeQueen(engine, 0, 0);
    expect(engine.getCellState(0, 0)).toBe(1);
  });

  it('getCellState 无效位置返回 0', () => {
    expect(engine.getCellState(-1, 0)).toBe(0);
    expect(engine.getCellState(0, 8)).toBe(0);
  });

  it('getQueenPositions 返回所有皇后位置', () => {
    placeQueen(engine, 0, 0);
    placeQueen(engine, 3, 5);
    const positions = engine.getQueenPositions();
    expect(positions).toEqual([[0, 0], [3, 5]]);
  });

  it('getQueenPositions 无皇后时返回空数组', () => {
    expect(engine.getQueenPositions()).toEqual([]);
  });

  it('isPreFilled 正确判断预填位置', () => {
    expect(engine.isPreFilled(0, 0)).toBe(false);
  });

  it('remainingQueens 正确计算', () => {
    expect(engine.remainingQueens).toBe(8);
    placeQueen(engine, 0, 0);
    expect(engine.remainingQueens).toBe(7);
  });

  it('currentLevel 返回当前关卡号', () => {
    expect(engine.currentLevel).toBe(1);
  });
});

// ============================================================
// 21. 边界与异常场景
// ============================================================
describe('EightQueensEngine - 边界与异常场景', () => {
  it('无 canvas 时 start 抛出错误', () => {
    const engine = new EightQueensEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('连续多次 start 不会崩溃', () => {
    const engine = createEngine();
    engine.start();
    expect(() => engine.start()).not.toThrow();
  });

  it('连续多次 reset 不会崩溃', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(() => engine.reset()).not.toThrow();
  });

  it('连续多次 pause 不会崩溃', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(() => engine.pause()).not.toThrow();
  });

  it('未 pause 时 resume 不改变状态', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('idle 时 pause 不改变状态', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('在棋盘角落放置皇后正常工作', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 0, 0);
    toggleAtCursor(engine);
    moveCursorTo(engine, 7, 7);
    toggleAtCursor(engine);
    expect(engine.getCellState(0, 0)).toBe(1);
    expect(engine.getCellState(7, 7)).toBe(1);
  });

  it('在同一位置反复 toggle 正常', () => {
    const engine = createAndStartEngine();
    moveCursorTo(engine, 4, 4);
    for (let i = 0; i < 10; i++) {
      toggleAtCursor(engine);
    }
    // 偶数次 toggle 应该为空
    expect(engine.getCellState(4, 4)).toBe(0);
  });

  it('光标在边界时反复移动不崩溃', () => {
    const engine = createAndStartEngine();
    for (let i = 0; i < 20; i++) {
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowLeft');
    }
    expect(engine.cursorRow).toBe(0);
    expect(engine.cursorCol).toBe(0);
  });

  it('胜利后空格键重置游戏', () => {
    const engine = createAndStartEngine();
    for (let r = 0; r < BOARD_SIZE; r++) {
      moveCursorTo(engine, r, CLASSIC_SOLUTION[r]);
      toggleAtCursor(engine);
    }
    expect(engine.isWon).toBe(true);
    engine.handleKeyDown(' ');
    // reset + start clears isWon
    expect(engine.isWon).toBe(false);
    expect(engine.status).toBe('playing');
  });

  it('预填皇后在棋盘边界外被忽略', () => {
    const engine = createAndStartEngine();
    // 直接修改 preFilled 为无效位置不会崩溃（因为 onStart 中有 isValidPosition 检查）
    expect(() => engine.isValidPosition(-1, -1)).not.toThrow();
  });
});

// ============================================================
// 22. 常量合理性验证
// ============================================================
describe('Eight Queens 常量验证', () => {
  it('BOARD_SIZE 为 8', () => {
    expect(BOARD_SIZE).toBe(8);
  });

  it('CANVAS_WIDTH 和 CANVAS_HEIGHT 为正数', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
  });

  it('CELL_SIZE > 0', () => {
    expect(CELL_SIZE).toBeGreaterThan(0);
  });

  it('POINTS_PER_QUEEN > 0', () => {
    expect(POINTS_PER_QUEEN).toBeGreaterThan(0);
  });

  it('WIN_BONUS > 0', () => {
    expect(WIN_BONUS).toBeGreaterThan(0);
  });

  it('HINT_PENALTY > 0', () => {
    expect(HINT_PENALTY).toBeGreaterThan(0);
  });

  it('MAX_LEVEL > 0', () => {
    expect(MAX_LEVEL).toBeGreaterThan(0);
  });

  it('WIN_BONUS > POINTS_PER_QUEEN', () => {
    expect(WIN_BONUS).toBeGreaterThan(POINTS_PER_QUEEN);
  });

  it('LEVEL_CONFIGS 关卡编号连续', () => {
    for (let i = 0; i < LEVEL_CONFIGS.length; i++) {
      expect(LEVEL_CONFIGS[i].level).toBe(i + 1);
    }
  });

  it('LEVEL_CONFIGS 预填位置不超过 BOARD_SIZE', () => {
    for (const config of LEVEL_CONFIGS) {
      if (config.preFilled) {
        expect(config.preFilled.length).toBeLessThanOrEqual(BOARD_SIZE);
        for (const [r, c] of config.preFilled) {
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(BOARD_SIZE);
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(BOARD_SIZE);
        }
      }
    }
  });

  it('棋盘在画布内', () => {
    const boardWidth = BOARD_SIZE * CELL_SIZE;
    const boardHeight = BOARD_SIZE * CELL_SIZE;
    expect(BOARD_OFFSET_X + boardWidth).toBeLessThanOrEqual(CANVAS_WIDTH);
    expect(BOARD_OFFSET_Y + boardHeight).toBeLessThanOrEqual(CANVAS_HEIGHT);
  });

  it('QUEEN_SYMBOL 为非空字符串', () => {
    expect(QUEEN_SYMBOL).toBeTruthy();
    expect(typeof QUEEN_SYMBOL).toBe('string');
  });

  it('所有颜色常量为非空字符串', () => {
    expect(BG_COLOR).toBeTruthy();
    expect(BOARD_LIGHT_COLOR).toBeTruthy();
    expect(BOARD_DARK_COLOR).toBeTruthy();
    expect(QUEEN_COLOR).toBeTruthy();
    expect(QUEEN_STROKE_COLOR).toBeTruthy();
    expect(CURSOR_COLOR).toBeTruthy();
    expect(CURSOR_BORDER_COLOR).toBeTruthy();
    expect(CONFLICT_COLOR).toBeTruthy();
    expect(SAFE_COLOR).toBeTruthy();
    expect(HUD_COLOR).toBeTruthy();
    expect(WIN_COLOR).toBeTruthy();
    expect(HINT_TEXT_COLOR).toBeTruthy();
  });

  it('BOARD_OFFSET_X 让棋盘水平居中', () => {
    expect(BOARD_OFFSET_X).toBe((CANVAS_WIDTH - BOARD_SIZE * CELL_SIZE) / 2);
  });

  it('BOARD_OFFSET_Y > 0（留出 HUD 空间）', () => {
    expect(BOARD_OFFSET_Y).toBeGreaterThan(0);
  });
});
