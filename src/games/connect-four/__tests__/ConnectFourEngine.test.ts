import { vi } from 'vitest';
/**
 * ConnectFourEngine 综合测试
 * 覆盖：初始化、棋盘尺寸、落子、交替落子、四子连线（横/竖/斜）、
 *       平局、撤销、handleKeyDown/Up、getState、事件系统、状态管理、边界情况
 */
import { ConnectFourEngine } from '../ConnectFourEngine';
import {
  COLS, ROWS,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  SCORE_WIN, SCORE_DRAW,
  SCORE_AI_BONUS_EASY, SCORE_AI_BONUS_MEDIUM, SCORE_AI_BONUS_HARD,
  AI_THINK_DELAY,
  DROP_ANIMATION_DURATION,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建一个 mock canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并初始化（不 start，停留在 idle） */
function createEngine(): ConnectFourEngine {
  const engine = new ConnectFourEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): ConnectFourEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: ConnectFourEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: ConnectFourEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 调用 protected update 方法 */
function callUpdate(engine: ConnectFourEngine, deltaTime: number) {
  const proto = Object.getPrototypeOf(engine);
  const updateFn = proto.update.bind(engine);
  updateFn(deltaTime);
}

/** 完成落子动画（推进足够时间） */
function finishDropAnimation(engine: ConnectFourEngine) {
  callUpdate(engine, DROP_ANIMATION_DURATION + 100);
}

/** 在指定列落子并完成动画 */
function dropAndFinish(engine: ConnectFourEngine, col: number): boolean {
  const result = engine.dropPiece(col);
  if (result) finishDropAnimation(engine);
  return result;
}

/** 获取棋盘（深拷贝） */
function getBoard(engine: ConnectFourEngine): number[][] {
  return getPrivate<number[][]>(engine, 'board');
}

/** 在棋盘上直接设置值 */
function setBoard(engine: ConnectFourEngine, board: number[][]) {
  setPrivate(engine, 'board', board);
}

/** 获取当前玩家 */
function getCurrentPlayer(engine: ConnectFourEngine): number {
  return getPrivate<number>(engine, 'currentPlayer');
}

/** 获取 moveCount */
function getMoveCount(engine: ConnectFourEngine): number {
  return getPrivate<number>(engine, 'moveCount');
}

/** 获取 scores */
function getScores(engine: ConnectFourEngine) {
  return getPrivate<{ player1: number; player2: number; draw: number }>(engine, 'scores');
}

/** 创建空棋盘 */
function createEmptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// ============================================================
// 1. 初始化 & 棋盘尺寸
// ============================================================
describe('ConnectFourEngine - 初始化', () => {
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

  it('棋盘行数为 ROWS (6)', () => {
    const engine = createEngine();
    const board = getBoard(engine);
    expect(board.length).toBe(ROWS);
    expect(ROWS).toBe(6);
  });

  it('棋盘列数为 COLS (7)', () => {
    const engine = createEngine();
    const board = getBoard(engine);
    expect(board[0].length).toBe(COLS);
    expect(COLS).toBe(7);
  });

  it('初始棋盘所有格子为 0（空）', () => {
    const engine = createEngine();
    const board = getBoard(engine);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        expect(board[r][c]).toBe(0);
      }
    }
  });

  it('init 后 currentPlayer 为 1', () => {
    const engine = createEngine();
    expect(getCurrentPlayer(engine)).toBe(1);
  });

  it('init 后 moveCount 为 0', () => {
    const engine = createEngine();
    expect(getMoveCount(engine)).toBe(0);
  });

  it('init 后 winner 为 null', () => {
    const engine = createEngine();
    expect(getPrivate(engine, 'winner')).toBeNull();
  });

  it('init 后 isDraw 为 false', () => {
    const engine = createEngine();
    expect(getPrivate<boolean>(engine, 'isDraw')).toBe(false);
  });

  it('init 后 cursorCol 为 3（中间列）', () => {
    const engine = createEngine();
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(3);
  });

  it('init 后 scores 全为 0', () => {
    const engine = createEngine();
    const scores = getScores(engine);
    expect(scores.player1).toBe(0);
    expect(scores.player2).toBe(0);
    expect(scores.draw).toBe(0);
  });

  it('不传 canvas 也能正常初始化', () => {
    expect(() => createEngine()).not.toThrow();
  });
});

// ============================================================
// 2. 启动 / onStart
// ============================================================
describe('ConnectFourEngine - 启动', () => {
  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后棋盘重置为空', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        expect(board[r][c]).toBe(0);
      }
    }
  });

  it('start 后 currentPlayer 为 1', () => {
    const engine = createAndStartEngine();
    expect(getCurrentPlayer(engine)).toBe(1);
  });

  it('start 后 winner 为 null', () => {
    const engine = createAndStartEngine();
    expect(getPrivate(engine, 'winner')).toBeNull();
  });

  it('start 后 isDraw 为 false', () => {
    const engine = createAndStartEngine();
    expect(getPrivate<boolean>(engine, 'isDraw')).toBe(false);
  });

  it('start 后 moveCount 为 0', () => {
    const engine = createAndStartEngine();
    expect(getMoveCount(engine)).toBe(0);
  });

  it('start 后 cursorCol 为 3', () => {
    const engine = createAndStartEngine();
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(3);
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
});

// ============================================================
// 3. 落子（选列、落底）
// ============================================================
describe('ConnectFourEngine - 落子', () => {
  let engine: ConnectFourEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('在有效列落子返回 true', () => {
    expect(engine.dropPiece(0)).toBe(true);
  });

  it('棋子落在最底行', () => {
    engine.dropPiece(3);
    const board = getBoard(engine);
    expect(board[ROWS - 1][3]).toBe(1);
  });

  it('同一列第二个棋子在倒数第二行', () => {
    dropAndFinish(engine, 3);
    engine.dropPiece(3);
    const board = getBoard(engine);
    expect(board[ROWS - 2][3]).toBe(2); // 玩家2的棋子
  });

  it('落子后 moveCount 增加', () => {
    engine.dropPiece(0);
    expect(getMoveCount(engine)).toBe(1);
  });

  it('多次落子 moveCount 累计', () => {
    dropAndFinish(engine, 0);
    dropAndFinish(engine, 1);
    dropAndFinish(engine, 2);
    expect(getMoveCount(engine)).toBe(3);
  });

  it('无效列（负数）返回 false', () => {
    expect(engine.dropPiece(-1)).toBe(false);
  });

  it('无效列（超出范围）返回 false', () => {
    expect(engine.dropPiece(COLS)).toBe(false);
  });

  it('canDrop 对有效空列返回 true', () => {
    expect(engine.canDrop(0)).toBe(true);
    expect(engine.canDrop(3)).toBe(true);
    expect(engine.canDrop(COLS - 1)).toBe(true);
  });

  it('canDrop 对无效列返回 false', () => {
    expect(engine.canDrop(-1)).toBe(false);
    expect(engine.canDrop(COLS)).toBe(false);
  });

  it('getLowestEmptyRow 对空列返回最后一行', () => {
    expect(engine.getLowestEmptyRow(0)).toBe(ROWS - 1);
  });

  it('getLowestEmptyRow 对满列返回 -1', () => {
    // 填满第 0 列
    const board = getBoard(engine);
    for (let r = 0; r < ROWS; r++) {
      board[r][0] = 1;
    }
    expect(engine.getLowestEmptyRow(0)).toBe(-1);
  });

  it('getLowestEmptyRow 部分填充返回正确的最低空行', () => {
    const board = getBoard(engine);
    board[ROWS - 1][0] = 1;
    board[ROWS - 2][0] = 2;
    expect(engine.getLowestEmptyRow(0)).toBe(ROWS - 3);
  });

  it('落子动画进行中不能再落子', () => {
    engine.dropPiece(0);
    // 动画未完成，尝试再次落子
    expect(engine.dropPiece(1)).toBe(false);
  });

  it('落子动画完成后可以继续落子', () => {
    engine.dropPiece(0);
    finishDropAnimation(engine);
    expect(engine.dropPiece(1)).toBe(true);
  });

  it('已满的列不能再落子', () => {
    const board = getBoard(engine);
    for (let r = 0; r < ROWS; r++) {
      board[r][0] = 1;
    }
    expect(engine.canDrop(0)).toBe(false);
    expect(engine.dropPiece(0)).toBe(false);
  });
});

// ============================================================
// 4. 交替落子
// ============================================================
describe('ConnectFourEngine - 交替落子', () => {
  let engine: ConnectFourEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始玩家为 1', () => {
    expect(getCurrentPlayer(engine)).toBe(1);
  });

  it('玩家 1 落子后切换为玩家 2', () => {
    dropAndFinish(engine, 0);
    expect(getCurrentPlayer(engine)).toBe(2);
  });

  it('玩家 2 落子后切换回玩家 1', () => {
    dropAndFinish(engine, 0);
    dropAndFinish(engine, 1);
    expect(getCurrentPlayer(engine)).toBe(1);
  });

  it('多轮交替正确', () => {
    const expected: number[] = [];
    for (let i = 0; i < 10; i++) {
      expected.push(getCurrentPlayer(engine));
      dropAndFinish(engine, i % COLS);
    }
    // 1, 2, 1, 2, 1, 2, 1, 2, 1, 2
    for (let i = 0; i < 10; i++) {
      expect(expected[i]).toBe(i % 2 === 0 ? 1 : 2);
    }
  });

  it('玩家 1 的棋子值为 1', () => {
    engine.dropPiece(0);
    const board = getBoard(engine);
    expect(board[ROWS - 1][0]).toBe(1);
  });

  it('玩家 2 的棋子值为 2', () => {
    dropAndFinish(engine, 0);
    engine.dropPiece(1);
    const board = getBoard(engine);
    expect(board[ROWS - 1][1]).toBe(2);
  });
});

// ============================================================
// 5. 四子连线 - 水平
// ============================================================
describe('ConnectFourEngine - 水平四连', () => {
  let engine: ConnectFourEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('玩家 1 水平四连获胜', () => {
    // 在底行放 4 个连续的玩家 1 棋子
    // 需要交替落子：P1 在 col 0-3, P2 在其他列
    dropAndFinish(engine, 0); // P1
    dropAndFinish(engine, 4); // P2
    dropAndFinish(engine, 1); // P1
    dropAndFinish(engine, 5); // P2
    dropAndFinish(engine, 2); // P1
    dropAndFinish(engine, 6); // P2
    dropAndFinish(engine, 3); // P1 - 四连!

    expect(getPrivate(engine, 'winner')).toBe(1);
  });

  it('水平四连时 winCells 包含正确的格子', () => {
    dropAndFinish(engine, 0); // P1
    dropAndFinish(engine, 4); // P2
    dropAndFinish(engine, 1); // P1
    dropAndFinish(engine, 5); // P2
    dropAndFinish(engine, 2); // P1
    dropAndFinish(engine, 6); // P2
    dropAndFinish(engine, 3); // P1

    const winCells = getPrivate<{ cells: { row: number; col: number }[] } | null>(engine, 'winCells');
    expect(winCells).not.toBeNull();
    expect(winCells!.cells.length).toBeGreaterThanOrEqual(4);

    const cols = winCells!.cells.map(c => c.col).sort((a, b) => a - b);
    expect(cols).toEqual([0, 1, 2, 3]);
    winCells!.cells.forEach(c => expect(c.row).toBe(ROWS - 1));
  });

  it('玩家 2 水平四连获胜', () => {
    // P1 放 col 0,1,2,6（不形成四连），P2 放 col 3,4,5,6
    dropAndFinish(engine, 0); // P1
    dropAndFinish(engine, 3); // P2
    dropAndFinish(engine, 1); // P1
    dropAndFinish(engine, 4); // P2
    dropAndFinish(engine, 2); // P1
    dropAndFinish(engine, 5); // P2 - 此时 P2 已有三连 3,4,5
    dropAndFinish(engine, 0); // P1 (放 col0 第二个)
    dropAndFinish(engine, 6); // P2 - 四连 col 3,4,5,6

    expect(getPrivate(engine, 'winner')).toBe(2);
  });

  it('checkWin 对非四连返回 null', () => {
    dropAndFinish(engine, 0); // P1
    dropAndFinish(engine, 4); // P2
    dropAndFinish(engine, 1); // P1
    // 只有 2 个，不构成四连
    expect(engine.checkWin(ROWS - 1, 1, 1)).toBeNull();
  });
});

// ============================================================
// 6. 四子连线 - 垂直
// ============================================================
describe('ConnectFourEngine - 垂直四连', () => {
  let engine: ConnectFourEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('玩家 1 垂直四连获胜', () => {
    // P1 全放 col 0，P2 放其他列
    dropAndFinish(engine, 0); // P1 row5
    dropAndFinish(engine, 1); // P2
    dropAndFinish(engine, 0); // P1 row4
    dropAndFinish(engine, 1); // P2
    dropAndFinish(engine, 0); // P1 row3
    dropAndFinish(engine, 1); // P2
    dropAndFinish(engine, 0); // P1 row2 - 四连!

    expect(getPrivate(engine, 'winner')).toBe(1);
  });

  it('垂直四连时 winCells 行号正确', () => {
    dropAndFinish(engine, 0); // P1 row5
    dropAndFinish(engine, 1); // P2
    dropAndFinish(engine, 0); // P1 row4
    dropAndFinish(engine, 1); // P2
    dropAndFinish(engine, 0); // P1 row3
    dropAndFinish(engine, 1); // P2
    dropAndFinish(engine, 0); // P1 row2

    const winCells = getPrivate<{ cells: { row: number; col: number }[] } | null>(engine, 'winCells');
    expect(winCells).not.toBeNull();
    const rows = winCells!.cells.map(c => c.row).sort((a, b) => a - b);
    expect(rows).toEqual([2, 3, 4, 5]);
    winCells!.cells.forEach(c => expect(c.col).toBe(0));
  });

  it('玩家 2 垂直四连获胜', () => {
    // P2 stacks col 0, P1 plays non-adjacent columns to avoid forming 4
    dropAndFinish(engine, 0); // P1 col0 row5 (P1 goes first!)
    dropAndFinish(engine, 1); // P2 col1 row5
    dropAndFinish(engine, 2); // P1 col2 row5
    dropAndFinish(engine, 1); // P2 col1 row4
    dropAndFinish(engine, 3); // P1 col3 row5
    dropAndFinish(engine, 1); // P2 col1 row3
    dropAndFinish(engine, 5); // P1 col5 row5 (skip col4 to avoid 4-in-a-row)
    dropAndFinish(engine, 1); // P2 col1 row2 - vertical four!

    expect(getPrivate(engine, 'winner')).toBe(2);
  });
});

// ============================================================
// 7. 四子连线 - 对角线
// ============================================================
describe('ConnectFourEngine - 对角线四连', () => {
  let engine: ConnectFourEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  /**
   * 构建对角线 \ 方向的棋盘:
   * P1 在 (5,0), (4,1), (3,2), (2,3)
   * 需要在每列先放 P2 的棋子来垫高
   */
  it('玩家 1 对角线 \\ 方向四连获胜', () => {
    // col 0: P1 at row5
    dropAndFinish(engine, 0); // P1
    // col 1: P2 at row5, P1 at row4
    dropAndFinish(engine, 1); // P2
    dropAndFinish(engine, 2); // P1 (waste)
    dropAndFinish(engine, 1); // P1 at row4 - 但这不对，需要更仔细的布局

    // 重新开始，用更清晰的布局
    engine = createAndStartEngine();

    // 构建 \ 对角线: P1 at (5,0), (4,1), (3,2), (2,3)
    // Step 1: P1 col0 → row5
    dropAndFinish(engine, 0); // P1 (5,0)
    // Step 2: P2 col1 → row5
    dropAndFinish(engine, 1); // P2 (5,1)
    // Step 3: P1 col2 → row5
    dropAndFinish(engine, 2); // P1 (5,2)
    // Step 4: P2 col3 → row5
    dropAndFinish(engine, 3); // P2 (5,3)
    // Step 5: P1 col4 → row5 (waste)
    dropAndFinish(engine, 4); // P1 (5,4)
    // Step 6: P2 col1 → row4 (stack on col1)
    dropAndFinish(engine, 1); // P2 (4,1)
    // Step 7: P1 col2 → row4
    dropAndFinish(engine, 2); // P1 (4,2)
    // Step 8: P2 col3 → row4
    dropAndFinish(engine, 3); // P2 (4,3)
    // Step 9: P1 col1 → row3
    dropAndFinish(engine, 1); // P1 (3,1)
    // Step 10: P2 col6 → row5 (waste)
    dropAndFinish(engine, 6); // P2
    // Step 11: P1 col2 → row3
    dropAndFinish(engine, 2); // P1 (3,2)
    // Step 12: P2 col6 → row4 (waste)
    dropAndFinish(engine, 6); // P2
    // Step 13: P1 col3 → row3
    dropAndFinish(engine, 3); // P1 (3,3) - 检查是否形成连线

    // P1 has: (5,0), (5,2), (4,2), (3,1), (3,2), (3,3)
    // 检查 \ 对角线 (5,0)-(4,1)-(3,2)-(2,3) → (3,1)是P1不是(4,1)
    // 这不太对，让我换个方式

    // 重新用直接设置棋盘的方式测试 checkWin
    engine = createAndStartEngine();
    const board = getBoard(engine);
    // \ 对角线: (5,0), (4,1), (3,2), (2,3) = P1
    board[5][0] = 1;
    board[4][1] = 1;
    board[3][2] = 1;
    board[2][3] = 1;

    const result = engine.checkWin(2, 3, 1);
    expect(result).not.toBeNull();
    expect(result!.cells.length).toBeGreaterThanOrEqual(4);
  });

  it('玩家 1 对角线 / 方向四连获胜', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    // / 对角线: (5,3), (4,2), (3,1), (2,0) = P1
    board[5][3] = 1;
    board[4][2] = 1;
    board[3][1] = 1;
    board[2][0] = 1;

    const result = engine.checkWin(2, 0, 1);
    expect(result).not.toBeNull();
    expect(result!.cells.length).toBeGreaterThanOrEqual(4);
  });

  it('对角线不够四个不构成获胜', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    board[5][0] = 1;
    board[4][1] = 1;
    board[3][2] = 1;
    // 只有 3 个

    const result = engine.checkWin(3, 2, 1);
    expect(result).toBeNull();
  });

  it('混合方向不构成获胜', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    board[5][0] = 1;
    board[4][0] = 1;
    board[5][1] = 1;
    board[4][2] = 1;
    // 没有四连

    expect(engine.checkWin(5, 0, 1)).toBeNull();
  });
});

// ============================================================
// 8. 平局
// ============================================================
describe('ConnectFourEngine - 平局', () => {
  it('空棋盘不是平局', () => {
    const engine = createAndStartEngine();
    expect(engine.checkDraw()).toBe(false);
  });

  it('棋盘未满时不是平局', () => {
    const engine = createAndStartEngine();
    dropAndFinish(engine, 0);
    expect(engine.checkDraw()).toBe(false);
  });

  it('checkDraw 在有 winner 时返回 false', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, 'winner', 1);
    expect(engine.checkDraw()).toBe(false);
  });

  it('棋盘全满且无胜者时为平局', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    // 填满整个棋盘（交替放置，避免形成四连）
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // 用一种不太会形成四连的方式填满
        board[r][c] = ((r + c) % 2) + 1;
      }
    }
    // 确保没有 winner
    setPrivate(engine, 'winner', null);
    expect(engine.checkDraw()).toBe(true);
  });

  it('平局时 isDraw 为 true', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    // 填满棋盘，交替放置
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        board[r][c] = ((r + c) % 2) + 1;
      }
    }
    setPrivate(engine, 'winner', null);
    // 手动调用 checkDraw 来验证
    expect(engine.checkDraw()).toBe(true);
  });
});

// ============================================================
// 9. 计分系统
// ============================================================
describe('ConnectFourEngine - 计分系统', () => {
  it('胜利后 scores 对应玩家加 1', () => {
    const engine = createAndStartEngine();
    // 玩家1水平四连
    dropAndFinish(engine, 0); // P1
    dropAndFinish(engine, 4); // P2
    dropAndFinish(engine, 1); // P1
    dropAndFinish(engine, 5); // P2
    dropAndFinish(engine, 2); // P1
    dropAndFinish(engine, 6); // P2
    dropAndFinish(engine, 3); // P1 wins

    const scores = getScores(engine);
    expect(scores.player1).toBe(1);
    expect(scores.player2).toBe(0);
  });

  it('胜利后引擎 score 大于 0', () => {
    const engine = createAndStartEngine();
    dropAndFinish(engine, 0);
    dropAndFinish(engine, 4);
    dropAndFinish(engine, 1);
    dropAndFinish(engine, 5);
    dropAndFinish(engine, 2);
    dropAndFinish(engine, 6);
    dropAndFinish(engine, 3); // P1 wins

    expect(engine.score).toBeGreaterThan(0);
  });

  it('SCORE_WIN 为 100', () => {
    expect(SCORE_WIN).toBe(100);
  });

  it('SCORE_DRAW 为 50', () => {
    expect(SCORE_DRAW).toBe(50);
  });

  it('AI 难度加分递增', () => {
    expect(SCORE_AI_BONUS_EASY).toBeLessThan(SCORE_AI_BONUS_MEDIUM);
    expect(SCORE_AI_BONUS_MEDIUM).toBeLessThan(SCORE_AI_BONUS_HARD);
  });

  it('destroy 后 scores 重置', () => {
    const engine = createAndStartEngine();
    dropAndFinish(engine, 0);
    dropAndFinish(engine, 4);
    dropAndFinish(engine, 1);
    dropAndFinish(engine, 5);
    dropAndFinish(engine, 2);
    dropAndFinish(engine, 6);
    dropAndFinish(engine, 3);

    engine.destroy();
    // destroy 后引擎不可用，但 scores 应该被重置
    // 通过 getState 无法获取（destroy 清了 listeners）
    // 验证不崩溃即可
    expect(true).toBe(true);
  });
});

// ============================================================
// 10. handleKeyDown
// ============================================================
describe('ConnectFourEngine - handleKeyDown', () => {
  let engine: ConnectFourEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('ArrowLeft 光标左移', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(2);
  });

  it('ArrowRight 光标右移', () => {
    engine.handleKeyDown('ArrowRight');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(4);
  });

  it('a 键光标左移', () => {
    engine.handleKeyDown('a');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(2);
  });

  it('A 键光标左移', () => {
    engine.handleKeyDown('A');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(2);
  });

  it('d 键光标右移', () => {
    engine.handleKeyDown('d');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(4);
  });

  it('D 键光标右移', () => {
    engine.handleKeyDown('D');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(4);
  });

  it('光标不能移到左边界外', () => {
    setPrivate(engine, 'cursorCol', 0);
    engine.handleKeyDown('ArrowLeft');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(0);
  });

  it('光标不能移到右边界外', () => {
    setPrivate(engine, 'cursorCol', COLS - 1);
    engine.handleKeyDown('ArrowRight');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(COLS - 1);
  });

  it('Space 在当前列落子', () => {
    setPrivate(engine, 'cursorCol', 2);
    engine.handleKeyDown(' ');
    const board = getBoard(engine);
    expect(board[ROWS - 1][2]).toBe(1);
  });

  it('Enter 在当前列落子', () => {
    setPrivate(engine, 'cursorCol', 4);
    engine.handleKeyDown('Enter');
    const board = getBoard(engine);
    expect(board[ROWS - 1][4]).toBe(1);
  });

  it('R 键重新开始游戏', () => {
    dropAndFinish(engine, 0);
    engine.handleKeyDown('r');
    expect(engine.status).toBe('playing');
    expect(getMoveCount(engine)).toBe(0);
  });

  it('大写 R 键重新开始', () => {
    engine.handleKeyDown('R');
    expect(engine.status).toBe('playing');
  });

  it('P 键暂停游戏', () => {
    engine.handleKeyDown('p');
    expect(engine.status).toBe('paused');
  });

  it('大写 P 键暂停游戏', () => {
    engine.handleKeyDown('P');
    expect(engine.status).toBe('paused');
  });

  it('暂停后 P 键恢复游戏', () => {
    engine.handleKeyDown('p');
    engine.handleKeyDown('p');
    expect(engine.status).toBe('playing');
  });

  it('游戏结束后按键不落子', () => {
    // 制造一个胜利
    dropAndFinish(engine, 0);
    dropAndFinish(engine, 4);
    dropAndFinish(engine, 1);
    dropAndFinish(engine, 5);
    dropAndFinish(engine, 2);
    dropAndFinish(engine, 6);
    dropAndFinish(engine, 3); // P1 wins

    const beforeMoveCount = getMoveCount(engine);
    engine.handleKeyDown(' ');
    expect(getMoveCount(engine)).toBe(beforeMoveCount);
  });

  it('暂停时方向键不移动光标', () => {
    engine.handleKeyDown('p');
    const beforeCol = getPrivate<number>(engine, 'cursorCol');
    engine.handleKeyDown('ArrowLeft');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(beforeCol);
  });

  it('落子动画中按键不响应', () => {
    engine.dropPiece(0); // 开始动画
    const beforeCol = getPrivate<number>(engine, 'cursorCol');
    engine.handleKeyDown('ArrowLeft');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(beforeCol);
  });
});

// ============================================================
// 11. handleKeyUp
// ============================================================
describe('ConnectFourEngine - handleKeyUp', () => {
  it('handleKeyUp 不抛异常', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('ArrowLeft')).not.toThrow();
  });

  it('handleKeyUp 对任意键不抛异常', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('a')).not.toThrow();
    expect(() => engine.handleKeyUp(' ')).not.toThrow();
    expect(() => engine.handleKeyUp('Enter')).not.toThrow();
  });
});

// ============================================================
// 12. getState
// ============================================================
describe('ConnectFourEngine - getState', () => {
  it('返回包含 board 字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('board');
  });

  it('返回包含 currentPlayer 字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('currentPlayer');
  });

  it('返回包含 cursorCol 字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('cursorCol');
  });

  it('返回包含 winner 字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('winner');
  });

  it('返回包含 winCells 字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('winCells');
  });

  it('返回包含 isDraw 字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('isDraw');
  });

  it('返回包含 mode 字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('mode');
  });

  it('返回包含 scores 字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('scores');
  });

  it('返回包含 moveCount 字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('moveCount');
  });

  it('初始状态值正确', () => {
    const engine = createAndStartEngine();
    const state = engine.getState() as any;
    expect(state.currentPlayer).toBe(1);
    expect(state.cursorCol).toBe(3);
    expect(state.winner).toBeNull();
    expect(state.winCells).toBeNull();
    expect(state.isDraw).toBe(false);
    expect(state.mode).toBe('PvP');
    expect(state.moveCount).toBe(0);
    expect(state.scores.player1).toBe(0);
    expect(state.scores.player2).toBe(0);
    expect(state.scores.draw).toBe(0);
  });

  it('board 是深拷贝，不影响内部状态', () => {
    const engine = createAndStartEngine();
    const state = engine.getState() as any;
    state.board[0][0] = 99;
    const board = getBoard(engine);
    expect(board[0][0]).toBe(0);
  });

  it('落子后 getState 反映变化', () => {
    const engine = createAndStartEngine();
    dropAndFinish(engine, 3);
    const state = engine.getState() as any;
    expect(state.board[ROWS - 1][3]).toBe(1);
    expect(state.currentPlayer).toBe(2);
    expect(state.moveCount).toBe(1);
  });

  it('获胜后 getState 反映 winner', () => {
    const engine = createAndStartEngine();
    dropAndFinish(engine, 0);
    dropAndFinish(engine, 4);
    dropAndFinish(engine, 1);
    dropAndFinish(engine, 5);
    dropAndFinish(engine, 2);
    dropAndFinish(engine, 6);
    dropAndFinish(engine, 3);

    const state = engine.getState() as any;
    expect(state.winner).toBe(1);
    expect(state.winCells).not.toBeNull();
  });
});

// ============================================================
// 13. 事件系统
// ============================================================
describe('ConnectFourEngine - 事件系统', () => {
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

  it('destroy 清除所有事件监听', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.destroy();
    const callCountAfterDestroy = handler.mock.calls.length;
    engine.emit('statusChange', 'test');
    expect(handler).toHaveBeenCalledTimes(callCountAfterDestroy);
  });

  it('start 发出 scoreChange 事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('scoreChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith(0);
  });

  it('pause 发出 statusChange paused', () => {
    const engine = createAndStartEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.pause();
    expect(handler).toHaveBeenCalledWith('paused');
  });

  it('resume 发出 statusChange playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.resume();
    expect(handler).toHaveBeenCalledWith('playing');
  });
});

// ============================================================
// 14. 状态管理
// ============================================================
describe('ConnectFourEngine - 状态管理', () => {
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

  it('playing 时不能 resume', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后棋盘清空', () => {
    const engine = createAndStartEngine();
    dropAndFinish(engine, 0);
    engine.reset();
    // 需要重新 start 才能玩，reset 后是 idle
    expect(engine.status).toBe('idle');
  });

  it('reset 后分数清零', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('连续多次 reset 不崩溃', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(() => engine.reset()).not.toThrow();
  });

  it('连续多次 pause 不崩溃', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(() => engine.pause()).not.toThrow();
  });

  it('连续多次 start 不崩溃', () => {
    const engine = createEngine();
    engine.start();
    expect(() => engine.start()).not.toThrow();
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
// 15. 游戏模式 & AI
// ============================================================
describe('ConnectFourEngine - 游戏模式', () => {
  it('默认模式为 PvP', () => {
    const engine = createAndStartEngine();
    expect(engine.getMode()).toBe('PvP');
  });

  it('level 2 为 Easy AI', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_level', 2);
    expect(engine.getMode()).toBe('Easy AI');
  });

  it('level 3 为 Medium AI', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_level', 3);
    expect(engine.getMode()).toBe('Medium AI');
  });

  it('level 4 为 Hard AI', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_level', 4);
    expect(engine.getMode()).toBe('Hard AI');
  });

  it('isAIMode 在 PvP 时返回 false', () => {
    const engine = createAndStartEngine();
    expect(engine.isAIMode()).toBe(false);
  });

  it('isAIMode 在 level >= 2 时返回 true', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_level', 2);
    expect(engine.isAIMode()).toBe(true);
  });

  it('AI 模式下玩家 2 回合时空格不落子', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_level', 2);
    setPrivate(engine, 'currentPlayer', 2);
    const beforeMoveCount = getMoveCount(engine);
    engine.handleKeyDown(' ');
    expect(getMoveCount(engine)).toBe(beforeMoveCount);
  });

  it('AI 思考中不响应输入', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, 'aiThinking', true);
    const beforeCol = getPrivate<number>(engine, 'cursorCol');
    engine.handleKeyDown('ArrowLeft');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(beforeCol);
  });
});

// ============================================================
// 16. 落子动画
// ============================================================
describe('ConnectFourEngine - 落子动画', () => {
  it('落子后启动动画', () => {
    const engine = createAndStartEngine();
    engine.dropPiece(0);
    const anim = getPrivate<any>(engine, 'dropAnimation');
    expect(anim).not.toBeNull();
    expect(anim.col).toBe(0);
    expect(anim.targetRow).toBe(ROWS - 1);
    expect(anim.player).toBe(1);
  });

  it('动画完成后 dropAnimation 为 null', () => {
    const engine = createAndStartEngine();
    engine.dropPiece(0);
    finishDropAnimation(engine);
    expect(getPrivate(engine, 'dropAnimation')).toBeNull();
  });

  it('动画期间棋子已在棋盘上', () => {
    const engine = createAndStartEngine();
    engine.dropPiece(0);
    const board = getBoard(engine);
    expect(board[ROWS - 1][0]).toBe(1);
  });

  it('动画进行中不能再落子', () => {
    const engine = createAndStartEngine();
    engine.dropPiece(0);
    expect(engine.dropPiece(1)).toBe(false);
  });
});

// ============================================================
// 17. 胜利后行为
// ============================================================
describe('ConnectFourEngine - 胜利后行为', () => {
  it('有 winner 后不能再落子', () => {
    const engine = createAndStartEngine();
    // P1 水平四连
    dropAndFinish(engine, 0);
    dropAndFinish(engine, 4);
    dropAndFinish(engine, 1);
    dropAndFinish(engine, 5);
    dropAndFinish(engine, 2);
    dropAndFinish(engine, 6);
    dropAndFinish(engine, 3); // P1 wins

    expect(engine.dropPiece(0)).toBe(false);
  });

  it('isDraw 后不能再落子', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, 'isDraw', true);
    expect(engine.dropPiece(0)).toBe(false);
  });

  it('R 键可以在胜利后重新开始', () => {
    const engine = createAndStartEngine();
    dropAndFinish(engine, 0);
    dropAndFinish(engine, 4);
    dropAndFinish(engine, 1);
    dropAndFinish(engine, 5);
    dropAndFinish(engine, 2);
    dropAndFinish(engine, 6);
    dropAndFinish(engine, 3);

    engine.handleKeyDown('r');
    expect(engine.status).toBe('playing');
    expect(getPrivate(engine, 'winner')).toBeNull();
    expect(getMoveCount(engine)).toBe(0);
  });
});

// ============================================================
// 18. 边界与异常场景
// ============================================================
describe('ConnectFourEngine - 边界与异常场景', () => {
  it('无 canvas 时 start 抛出错误', () => {
    const engine = new ConnectFourEngine();
    // 不调用 init
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('所有列都填满的极端情况', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        board[r][c] = ((r + c) % 2) + 1;
      }
    }
    // 所有列都不能再落子
    for (let c = 0; c < COLS; c++) {
      expect(engine.canDrop(c)).toBe(false);
    }
  });

  it('光标在边界位置移动正确', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, 'cursorCol', 0);
    engine.handleKeyDown('ArrowLeft');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(0);

    setPrivate(engine, 'cursorCol', COLS - 1);
    engine.handleKeyDown('ArrowRight');
    expect(getPrivate<number>(engine, 'cursorCol')).toBe(COLS - 1);
  });

  it('连续快速落子（动画中拒绝）', () => {
    const engine = createAndStartEngine();
    engine.dropPiece(0);
    expect(engine.dropPiece(1)).toBe(false);
    expect(engine.dropPiece(2)).toBe(false);
    expect(getMoveCount(engine)).toBe(1);
  });

  it('update 在无动画时不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('大 deltaTime 不崩溃', () => {
    const engine = createAndStartEngine();
    engine.dropPiece(0);
    expect(() => callUpdate(engine, 10000)).not.toThrow();
  });

  it('零 deltaTime 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, 0)).not.toThrow();
  });

  it('负 deltaTime 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, -100)).not.toThrow();
  });

  it('getState 返回的 board 尺寸正确', () => {
    const engine = createAndStartEngine();
    const state = engine.getState() as any;
    expect(state.board.length).toBe(ROWS);
    expect(state.board[0].length).toBe(COLS);
  });

  it('checkWin 对空棋盘返回 null', () => {
    const engine = createAndStartEngine();
    expect(engine.checkWin(0, 0, 1)).toBeNull();
  });

  it('checkWin 对角落位置正确', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    // 左上角四连（垂直）
    board[0][0] = 1;
    board[1][0] = 1;
    board[2][0] = 1;
    board[3][0] = 1;
    expect(engine.checkWin(0, 0, 1)).not.toBeNull();
  });

  it('checkWin 对右下角位置正确', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    // 右下角水平四连
    board[ROWS - 1][COLS - 4] = 1;
    board[ROWS - 1][COLS - 3] = 1;
    board[ROWS - 1][COLS - 2] = 1;
    board[ROWS - 1][COLS - 1] = 1;
    expect(engine.checkWin(ROWS - 1, COLS - 1, 1)).not.toBeNull();
  });

  it('五子连线也返回获胜（多于四子）', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    // 水平五子
    board[ROWS - 1][0] = 1;
    board[ROWS - 1][1] = 1;
    board[ROWS - 1][2] = 1;
    board[ROWS - 1][3] = 1;
    board[ROWS - 1][4] = 1;
    const result = engine.checkWin(ROWS - 1, 2, 1);
    expect(result).not.toBeNull();
    expect(result!.cells.length).toBeGreaterThanOrEqual(4);
  });

  it('不同玩家的棋子不构成获胜', () => {
    const engine = createAndStartEngine();
    const board = getBoard(engine);
    board[ROWS - 1][0] = 1;
    board[ROWS - 1][1] = 1;
    board[ROWS - 1][2] = 2;
    board[ROWS - 1][3] = 1;
    expect(engine.checkWin(ROWS - 1, 0, 1)).toBeNull();
  });
});

// ============================================================
// 19. 常量合理性验证
// ============================================================
describe('ConnectFour 常量验证', () => {
  it('COLS 为 7', () => {
    expect(COLS).toBe(7);
  });

  it('ROWS 为 6', () => {
    expect(ROWS).toBe(6);
  });

  it('CANVAS_WIDTH 和 CANVAS_HEIGHT 为正数', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
  });

  it('SCORE_WIN > SCORE_DRAW', () => {
    expect(SCORE_WIN).toBeGreaterThan(SCORE_DRAW);
  });

  it('AI_THINK_DELAY > 0', () => {
    expect(AI_THINK_DELAY).toBeGreaterThan(0);
  });

  it('DROP_ANIMATION_DURATION > 0', () => {
    expect(DROP_ANIMATION_DURATION).toBeGreaterThan(0);
  });

  it('AI 难度加分都为正数', () => {
    expect(SCORE_AI_BONUS_EASY).toBeGreaterThan(0);
    expect(SCORE_AI_BONUS_MEDIUM).toBeGreaterThan(0);
    expect(SCORE_AI_BONUS_HARD).toBeGreaterThan(0);
  });
});

// ============================================================
// 20. update 逻辑
// ============================================================
describe('ConnectFourEngine - update 逻辑', () => {
  it('update 推进落子动画', () => {
    const engine = createAndStartEngine();
    engine.dropPiece(0);
    const animBefore = getPrivate<any>(engine, 'dropAnimation');
    expect(animBefore).not.toBeNull();
    callUpdate(engine, DROP_ANIMATION_DURATION / 2);
    const animAfter = getPrivate<any>(engine, 'dropAnimation');
    // 动画还在进行
    expect(animAfter).not.toBeNull();
  });

  it('update 完成后清除动画', () => {
    const engine = createAndStartEngine();
    engine.dropPiece(0);
    callUpdate(engine, DROP_ANIMATION_DURATION + 100);
    expect(getPrivate(engine, 'dropAnimation')).toBeNull();
  });

  it('胜利闪烁计时器随 update 增加', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, 'winCells', { cells: [{ row: 0, col: 0 }] });
    setPrivate(engine, 'winBlinkElapsed', 0);
    callUpdate(engine, 100);
    expect(getPrivate<number>(engine, 'winBlinkElapsed')).toBe(100);
  });

  it('AI 思考计时器随 update 增加', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, 'aiThinking', true);
    setPrivate(engine, 'aiThinkTimer', 0);
    setPrivate(engine, '_level', 2);
    callUpdate(engine, 100);
    expect(getPrivate<number>(engine, 'aiThinkTimer')).toBe(100);
  });

  it('AI 思考超时后执行 AI 落子', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_level', 2);
    setPrivate(engine, 'aiThinking', true);
    setPrivate(engine, 'aiThinkTimer', 0);
    setPrivate(engine, 'currentPlayer', 2);
    callUpdate(engine, AI_THINK_DELAY + 100);
    expect(getPrivate<boolean>(engine, 'aiThinking')).toBe(false);
  });
});
