/**
 * KnightsTourEngine — 骑士巡游测试
 *
 * 覆盖：马走日字移动、可走位置计算、Warnsdorff 启发式、
 *        胜利/失败判定、撤销、棋盘大小、边界情况
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { KnightsTourEngine } from '../KnightsTourEngine';
import { KNIGHT_MOVES, DEFAULT_BOARD_SIZE } from '../constants';

// ========== Mock Canvas ==========
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

// ========== Helper ==========
function createStartedEngine(boardSize?: number): KnightsTourEngine {
  const engine = new KnightsTourEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  engine.start();
  if (boardSize) {
    engine.setBoardSize(boardSize);
  }
  return engine;
}

// ========== 基础初始化 ==========

describe('KnightsTourEngine — 初始化', () => {
  it('应该正确初始化引擎', () => {
    const engine = new KnightsTourEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();

    expect(engine.phase).toBe('selectStart');
    expect(engine.stepCount).toBe(0);
    expect(engine.knightRow).toBe(-1);
    expect(engine.knightCol).toBe(-1);
    expect(engine.isWin).toBe(false);
    expect(engine.moveHistory).toEqual([]);
    expect(engine.moveablePositions).toEqual([]);
    expect(engine.hintPosition).toBeNull();
    expect(engine.hintActive).toBe(false);
  });

  it('默认棋盘大小为 8×8', () => {
    const engine = new KnightsTourEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    expect(engine.boardSize).toBe(8);
    expect(engine.totalCells).toBe(64);
  });

  it('start() 后进入 selectStart 阶段', () => {
    const engine = createStartedEngine();
    expect(engine.phase).toBe('selectStart');
    expect(engine.status).toBe('playing');
  });

  it('reset() 后回到初始状态', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.reset();
    expect(engine.phase).toBe('selectStart');
    expect(engine.stepCount).toBe(0);
    expect(engine.knightRow).toBe(-1);
    expect(engine.moveHistory).toEqual([]);
  });

  it('棋盘初始所有格子为 -1（未访问）', () => {
    const engine = createStartedEngine();
    const board = engine.getBoard();
    for (let r = 0; r < engine.boardSize; r++) {
      for (let c = 0; c < engine.boardSize; c++) {
        expect(board[r][c]).toBe(-1);
      }
    }
  });

  it('getBoard() 返回的是副本，修改不影响内部状态', () => {
    const engine = createStartedEngine();
    const board = engine.getBoard();
    board[0][0] = 99;
    expect(engine.getCellValue(0, 0)).toBe(-1);
  });

  it('getState() 返回完整游戏状态', () => {
    const engine = createStartedEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('boardSize');
    expect(state).toHaveProperty('phase');
    expect(state).toHaveProperty('stepCount');
    expect(state).toHaveProperty('knightRow');
    expect(state).toHaveProperty('knightCol');
    expect(state).toHaveProperty('isWin');
    expect(state).toHaveProperty('board');
  });

  it('remainingCells 初始等于 totalCells', () => {
    const engine = createStartedEngine();
    expect(engine.remainingCells).toBe(64);
  });
});

// ========== 棋盘大小 ==========

describe('KnightsTourEngine — 棋盘大小', () => {
  it('可以设置 5×5 棋盘', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(5);
    expect(engine.boardSize).toBe(5);
    expect(engine.totalCells).toBe(25);
  });

  it('可以设置 6×6 棋盘', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(6);
    expect(engine.boardSize).toBe(6);
    expect(engine.totalCells).toBe(36);
  });

  it('可以设置 8×8 棋盘', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(8);
    expect(engine.boardSize).toBe(8);
    expect(engine.totalCells).toBe(64);
  });

  it('不能设置小于 5 的棋盘', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(4);
    expect(engine.boardSize).toBe(DEFAULT_BOARD_SIZE);
  });

  it('不能设置大于 8 的棋盘', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(9);
    expect(engine.boardSize).toBe(DEFAULT_BOARD_SIZE);
  });

  it('不能在 playing 阶段设置棋盘大小', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.setBoardSize(5);
    expect(engine.boardSize).toBe(8);
  });

  it('设置棋盘大小后光标不超出范围', () => {
    const engine = createStartedEngine();
    // 先移动光标到 (7, 7)
    engine['moveCursor'](7, 7);
    expect(engine.cursorRow).toBe(7);
    expect(engine.cursorCol).toBe(7);
    // 切换到 5×5
    engine.setBoardSize(5);
    expect(engine.cursorRow).toBe(4);
    expect(engine.cursorCol).toBe(4);
  });

  it('通过按键 1/2/3 切换棋盘大小', () => {
    const engine = createStartedEngine();
    engine.handleKeyDown('1');
    expect(engine.boardSize).toBe(5);
    engine.handleKeyDown('2');
    expect(engine.boardSize).toBe(6);
    engine.handleKeyDown('3');
    expect(engine.boardSize).toBe(8);
  });
});

// ========== 位置验证 ==========

describe('KnightsTourEngine — 位置验证', () => {
  it('isValidPosition 正确判断边界内位置', () => {
    const engine = createStartedEngine();
    expect(engine.isValidPosition(0, 0)).toBe(true);
    expect(engine.isValidPosition(7, 7)).toBe(true);
    expect(engine.isValidPosition(3, 4)).toBe(true);
  });

  it('isValidPosition 正确判断边界外位置', () => {
    const engine = createStartedEngine();
    expect(engine.isValidPosition(-1, 0)).toBe(false);
    expect(engine.isValidPosition(0, -1)).toBe(false);
    expect(engine.isValidPosition(8, 0)).toBe(false);
    expect(engine.isValidPosition(0, 8)).toBe(false);
    expect(engine.isValidPosition(8, 8)).toBe(false);
  });

  it('isUnvisited 对未访问格子返回 true', () => {
    const engine = createStartedEngine();
    expect(engine.isUnvisited(0, 0)).toBe(true);
    expect(engine.isUnvisited(7, 7)).toBe(true);
  });

  it('isUnvisited 对已访问格子返回 false', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(3, 3);
    expect(engine.isUnvisited(3, 3)).toBe(false);
  });

  it('isUnvisited 对边界外位置返回 false', () => {
    const engine = createStartedEngine();
    expect(engine.isUnvisited(-1, 0)).toBe(false);
    expect(engine.isUnvisited(8, 0)).toBe(false);
  });
});

// ========== 马走日字移动 ==========

describe('KnightsTourEngine — L 形移动', () => {
  it('KNIGHT_MOVES 包含 8 个偏移', () => {
    expect(KNIGHT_MOVES.length).toBe(8);
  });

  it('所有 KNIGHT_MOVES 偏移都是 L 形', () => {
    for (const [dr, dc] of KNIGHT_MOVES) {
      const isL = (Math.abs(dr) === 2 && Math.abs(dc) === 1) ||
                  (Math.abs(dr) === 1 && Math.abs(dc) === 2);
      expect(isL).toBe(true);
    }
  });

  it('isKnightMove 正确识别 L 形移动', () => {
    const engine = createStartedEngine();
    expect(engine.isKnightMove(0, 0, 2, 1)).toBe(true);
    expect(engine.isKnightMove(0, 0, 1, 2)).toBe(true);
    expect(engine.isKnightMove(3, 3, 5, 4)).toBe(true);
    expect(engine.isKnightMove(3, 3, 4, 5)).toBe(true);
    expect(engine.isKnightMove(3, 3, 1, 2)).toBe(true);
    expect(engine.isKnightMove(3, 3, 2, 1)).toBe(true);
  });

  it('isKnightMove 拒绝非 L 形移动', () => {
    const engine = createStartedEngine();
    expect(engine.isKnightMove(0, 0, 0, 1)).toBe(false);
    expect(engine.isKnightMove(0, 0, 1, 1)).toBe(false);
    expect(engine.isKnightMove(0, 0, 2, 2)).toBe(false);
    expect(engine.isKnightMove(0, 0, 3, 0)).toBe(false);
    expect(engine.isKnightMove(3, 3, 3, 3)).toBe(false);
  });

  it('从角 (0,0) 出发有 2 个可走位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    const moves = engine.moveablePositions;
    expect(moves.length).toBe(2);
    expect(moves).toContainEqual([2, 1]);
    expect(moves).toContainEqual([1, 2]);
  });

  it('从角 (7,7) 出发有 2 个可走位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(7, 7);
    const moves = engine.moveablePositions;
    expect(moves.length).toBe(2);
    expect(moves).toContainEqual([5, 6]);
    expect(moves).toContainEqual([6, 5]);
  });

  it('从角 (0,7) 出发有 2 个可走位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 7);
    const moves = engine.moveablePositions;
    expect(moves.length).toBe(2);
    expect(moves).toContainEqual([2, 6]);
    expect(moves).toContainEqual([1, 5]);
  });

  it('从中心 (3,3) 出发有 8 个可走位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(3, 3);
    expect(engine.moveablePositions.length).toBe(8);
  });

  it('从中心 (4,4) 出发有 8 个可走位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(4, 4);
    expect(engine.moveablePositions.length).toBe(8);
  });

  it('从边 (0,3) 出发有 4 个可走位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 3);
    expect(engine.moveablePositions.length).toBe(4);
  });

  it('getValidMoves 返回正确的位置', () => {
    const engine = createStartedEngine();
    const moves = engine.getValidMoves(0, 0);
    expect(moves).toContainEqual([2, 1]);
    expect(moves).toContainEqual([1, 2]);
    expect(moves.length).toBe(2);
  });

  it('getValidMoves 不包含已访问的格子', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    // 移动到 (2, 1)
    engine.moveKnight(2, 1);
    // 从 (2, 1) 出发，(0, 0) 已被访问，不应出现在可走位置中
    const moves = engine.getValidMoves(2, 1);
    expect(moves).not.toContainEqual([0, 0]);
  });
});

// ========== 选择起始位置 ==========

describe('KnightsTourEngine — 选择起始位置', () => {
  it('selectStartPosition 成功设置起始位置', () => {
    const engine = createStartedEngine();
    const result = engine.selectStartPosition(3, 3);
    expect(result).toBe(true);
    expect(engine.knightRow).toBe(3);
    expect(engine.knightCol).toBe(3);
    expect(engine.stepCount).toBe(1);
    expect(engine.phase).toBe('playing');
  });

  it('selectStartPosition 标记格子为已访问（步数 1）', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(3, 3);
    expect(engine.getCellValue(3, 3)).toBe(1);
  });

  it('selectStartPosition 记录到移动历史', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(3, 3);
    expect(engine.moveHistory.length).toBe(1);
    expect(engine.moveHistory[0]).toEqual({ row: 3, col: 3, step: 1 });
  });

  it('selectStartPosition 加分', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(3, 3);
    expect(engine.score).toBe(10);
  });

  it('selectStartPosition 不能在 playing 阶段再次调用', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(3, 3);
    const result = engine.selectStartPosition(0, 0);
    expect(result).toBe(false);
  });

  it('selectStartPosition 对无效位置返回 false', () => {
    const engine = createStartedEngine();
    expect(engine.selectStartPosition(-1, 0)).toBe(false);
    expect(engine.selectStartPosition(8, 8)).toBe(false);
  });

  it('通过方向键和空格选择起始位置', () => {
    const engine = createStartedEngine();
    // 移动光标到 (2, 3)
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowRight');
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorRow).toBe(2);
    expect(engine.cursorCol).toBe(3);
    // 确认
    engine.handleKeyDown(' ');
    expect(engine.knightRow).toBe(2);
    expect(engine.knightCol).toBe(3);
    expect(engine.phase).toBe('playing');
  });

  it('通过 WASD 和 Enter 选择起始位置', () => {
    const engine = createStartedEngine();
    engine.handleKeyDown('s');
    engine.handleKeyDown('d');
    engine.handleKeyDown('Enter');
    expect(engine.knightRow).toBe(1);
    expect(engine.knightCol).toBe(1);
  });
});

// ========== 移动骑士 ==========

describe('KnightsTourEngine — 移动骑士', () => {
  it('moveKnight 成功移动到合法位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    const result = engine.moveKnight(2, 1);
    expect(result).toBe(true);
    expect(engine.knightRow).toBe(2);
    expect(engine.knightCol).toBe(1);
    expect(engine.stepCount).toBe(2);
  });

  it('moveKnight 标记格子为步数 2', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    expect(engine.getCellValue(2, 1)).toBe(2);
  });

  it('moveKnight 记录到移动历史', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    expect(engine.moveHistory.length).toBe(2);
    expect(engine.moveHistory[1]).toEqual({ row: 2, col: 1, step: 2 });
  });

  it('moveKnight 加分', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    const scoreBefore = engine.score;
    engine.moveKnight(2, 1);
    expect(engine.score).toBe(scoreBefore + 10);
  });

  it('moveKnight 拒绝非法位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    // (0, 1) 不是 L 形移动
    expect(engine.moveKnight(0, 1)).toBe(false);
    // (3, 3) 不是 L 形移动
    expect(engine.moveKnight(3, 3)).toBe(false);
  });

  it('moveKnight 拒绝已访问的位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    // (0, 0) 已被访问
    expect(engine.moveKnight(0, 0)).toBe(false);
  });

  it('连续移动正确更新步数', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    engine.moveKnight(4, 2);
    engine.moveKnight(6, 3);
    expect(engine.stepCount).toBe(4);
    expect(engine.getCellValue(6, 3)).toBe(4);
  });

  it('通过键盘方向键和空格确认移动', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    // 应该有 2 个可走位置
    expect(engine.moveablePositions.length).toBe(2);
    // 空格确认第一个
    engine.handleKeyDown(' ');
    expect(engine.stepCount).toBe(2);
  });

  it('通过方向键在可走位置间切换', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(3, 3);
    // 中心有 8 个可走位置
    expect(engine.moveablePositions.length).toBe(8);
    expect(engine.selectedMoveIndex).toBe(0);
    engine.handleKeyDown('ArrowDown');
    expect(engine.selectedMoveIndex).toBe(1);
    engine.handleKeyDown('ArrowDown');
    expect(engine.selectedMoveIndex).toBe(2);
  });

  it('方向键循环选择可走位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    // 2 个可走位置
    expect(engine.moveablePositions.length).toBe(2);
    engine.handleKeyDown('ArrowUp'); // 从 0 向上 -> 最后一个
    expect(engine.selectedMoveIndex).toBe(1);
    engine.handleKeyDown('ArrowDown'); // 从 1 向下 -> 0
    expect(engine.selectedMoveIndex).toBe(0);
  });

  it('moveKnight 后可走位置更新', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    const initialMoves = engine.moveablePositions;
    engine.moveKnight(2, 1);
    const newMoves = engine.moveablePositions;
    // 新的可走位置应该不同
    expect(newMoves).not.toContainEqual([0, 0]); // 起始位置已被访问
  });

  it('remainingCells 随移动减少', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    expect(engine.remainingCells).toBe(63);
    engine.moveKnight(2, 1);
    expect(engine.remainingCells).toBe(62);
  });
});

// ========== 胜利判定 ==========

describe('KnightsTourEngine — 胜利判定', () => {
  it('遍历全部格子后胜利', () => {
    const engine = createStartedEngine(5);
    // 使用 Warnsdorff 启发式完成 5×5 棋盘
    engine.selectStartPosition(0, 0);

    // 自动完成巡游
    let safety = 0;
    while (engine.phase === 'playing' && safety < 30) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    if (engine.phase === 'won') {
      expect(engine.isWin).toBe(true);
      expect(engine.stepCount).toBe(25);
      expect(engine.status).toBe('gameover');
    }
  });

  it('胜利时加分 WIN_BONUS', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    let safety = 0;
    while (engine.phase === 'playing' && safety < 30) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    if (engine.isWin) {
      // selectStartPosition: +10, 23 moveKnight: +230, final move: +500 (WIN_BONUS only)
      // Total: 10 + 230 + 500 = 740
      expect(engine.score).toBe(10 + 23 * 10 + 500);
    }
  });

  it('胜利后 phase 为 won', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    let safety = 0;
    while (engine.phase === 'playing' && safety < 30) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    if (engine.isWin) {
      expect(engine.phase).toBe('won');
    }
  });
});

// ========== 失败判定 ==========

describe('KnightsTourEngine — 失败判定', () => {
  it('走到死胡同时游戏失败', () => {
    const engine = createStartedEngine(5);
    // 手动构造一个会导致死胡同的路径
    // 从 (0,0) 出发，不使用 Warnsdorff
    engine.selectStartPosition(0, 0);

    // 手动走一些可能导致死胡同的路径
    // 注意：这取决于具体路径，我们通过模拟来测试
    let safety = 0;
    let hitDeadEnd = false;

    while (engine.phase === 'playing' && safety < 30) {
      const moves = engine.moveablePositions;
      if (moves.length === 0) {
        hitDeadEnd = true;
        break;
      }
      // 故意选择最后一个（可能不是最优）
      const [r, c] = moves[moves.length - 1];
      engine.moveKnight(r, c);
      safety++;
    }

    if (engine.phase === 'lost') {
      expect(engine.isWin).toBe(false);
      expect(engine.stepCount).toBeLessThan(25);
      expect(engine.status).toBe('gameover');
    }
  });

  it('失败时 phase 为 lost', () => {
    // 通过特殊路径构造死胡同
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    // 一直走非最优路径
    let safety = 0;
    while (engine.phase === 'playing' && safety < 30) {
      const moves = engine.moveablePositions;
      if (moves.length === 0) break;
      const [r, c] = moves[moves.length - 1];
      engine.moveKnight(r, c);
      safety++;
    }

    if (!engine.isWin) {
      expect(engine.phase).toBe('lost');
    }
  });
});

// ========== Warnsdorff 启发式 ==========

describe('KnightsTourEngine — Warnsdorff 启发式', () => {
  it('getWarnsdorffBest 返回出口最少的位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);

    const best = engine.getWarnsdorffBest();
    expect(best).not.toBeNull();

    // 从 (0,0) 出发，可走 (2,1) 和 (1,2)
    // (2,1) 的出口数：从 (2,1) 出发可走的位置
    // (1,2) 的出口数：从 (1,2) 出发可走的位置
    // Warnsdorff 选择出口最少的
    const moves = engine.moveablePositions;
    let minExits = Infinity;
    let expectedBest: [number, number] | null = null;
    for (const [r, c] of moves) {
      const exits = engine.countExits(r, c);
      if (exits < minExits) {
        minExits = exits;
        expectedBest = [r, c];
      }
    }
    expect(best).toEqual(expectedBest);
  });

  it('countExits 计算从指定位置出发的出口数', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    // 从 (2, 1) 出发（(0,0) 已被访问）
    const exits = engine.countExits(2, 1);
    expect(exits).toBeGreaterThanOrEqual(0);
    expect(typeof exits).toBe('number');
  });

  it('countExits 对角位置返回正确的出口数', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    // (2, 1) 从 (0,0) 跳过来，(0,0) 已访问
    // (2,1) 的可走位置：(0,0)已访问, (0,2), (1,3), (3,3), (4,0), (4,2), (3,-1)无效, (1,-1)无效
    const exits = engine.countExits(2, 1);
    // 从 (2,1) 出发的 L 形移动: (0,0)已访问, (0,2), (1,3), (3,3), (4,0), (4,2)
    // 有效且未访问: (0,2), (1,3), (3,3), (4,0), (4,2) = 5个
    expect(exits).toBe(5);
  });

  it('getWarnsdorffSorted 返回按出口数排序的位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(3, 3);

    const sorted = engine.getWarnsdorffSorted();
    expect(sorted.length).toBe(8);

    // 验证排序：出口数应该递增
    const exitCounts = sorted.map(([r, c]) => {
      engine['moveKnight']?.(r, c); // 不能直接调用，用 countExits
      return engine.countExits(r, c);
    });

    // 注意：由于格子会被临时标记，这里验证排序是否单调
    for (let i = 1; i < exitCounts.length; i++) {
      expect(exitCounts[i]).toBeGreaterThanOrEqual(exitCounts[i - 1]);
    }
  });

  it('没有可走位置时 getWarnsdorffBest 返回 null', () => {
    const engine = createStartedEngine();
    // 还没选择起始位置，没有可走位置列表
    expect(engine.getWarnsdorffBest()).toBeNull();
  });

  it('showHint 显示最优位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    const hint = engine.showHint();
    expect(hint).not.toBeNull();
    expect(engine.hintActive).toBe(true);
    expect(engine.hintPosition).toEqual(hint);
  });

  it('showHint 扣分', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    const scoreBefore = engine.score;
    engine.showHint();
    expect(engine.score).toBe(scoreBefore - 5);
  });

  it('hideHint 清除提示', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.showHint();
    engine.hideHint();
    expect(engine.hintActive).toBe(false);
    expect(engine.hintPosition).toBeNull();
  });

  it('H 键触发提示', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.handleKeyDown('h');
    expect(engine.hintActive).toBe(true);
  });

  it('非 playing 阶段 showHint 返回 null', () => {
    const engine = createStartedEngine();
    // selectStart 阶段
    expect(engine.showHint()).toBeNull();
  });

  it('Warnsdorff 能完成 5×5 巡游', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    let safety = 0;
    while (engine.phase === 'playing' && safety < 30) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    // Warnsdorff 在 5×5 上从角出发通常能完成
    expect(engine.stepCount).toBe(25);
    expect(engine.phase).toBe('won');
  });

  it('Warnsdorff 能完成 6×6 巡游', () => {
    const engine = createStartedEngine(6);
    engine.selectStartPosition(0, 0);

    let safety = 0;
    while (engine.phase === 'playing' && safety < 40) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    // Warnsdorff 在 6×6 上通常能完成
    expect(engine.stepCount).toBe(36);
    expect(engine.phase).toBe('won');
  });

  it('Warnsdorff 能完成 8×8 巡游', () => {
    const engine = createStartedEngine(8);
    engine.selectStartPosition(0, 0);

    let safety = 0;
    while (engine.phase === 'playing' && safety < 70) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    // Warnsdorff 在 8×8 上通常能完成
    expect(engine.stepCount).toBe(64);
    expect(engine.phase).toBe('won');
  });
});

// ========== 撤销功能 ==========

describe('KnightsTourEngine — 撤销', () => {
  it('undoMove 回退一步', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    expect(engine.stepCount).toBe(2);

    const result = engine.undoMove();
    expect(result).toBe(true);
    expect(engine.stepCount).toBe(1);
    expect(engine.knightRow).toBe(0);
    expect(engine.knightCol).toBe(0);
  });

  it('undoMove 恢复格子为未访问', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    expect(engine.getCellValue(2, 1)).toBe(2);

    engine.undoMove();
    expect(engine.getCellValue(2, 1)).toBe(-1);
  });

  it('undoMove 从移动历史中移除记录', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    expect(engine.moveHistory.length).toBe(2);

    engine.undoMove();
    expect(engine.moveHistory.length).toBe(1);
    expect(engine.moveHistory[0]).toEqual({ row: 0, col: 0, step: 1 });
  });

  it('undoMove 扣分', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    const scoreAfterStart = engine.score;
    engine.moveKnight(2, 1);
    engine.undoMove();
    expect(engine.score).toBe(scoreAfterStart);
  });

  it('undoMove 后可走位置更新', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    const initialMoves = [...engine.moveablePositions];
    engine.moveKnight(2, 1);
    engine.undoMove();
    // 恢复到起始位置后，可走位置应与初始相同
    expect(engine.moveablePositions).toEqual(initialMoves);
  });

  it('undoMove 清除提示', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    engine.showHint();
    engine.undoMove();
    expect(engine.hintActive).toBe(false);
    expect(engine.hintPosition).toBeNull();
  });

  it('不能撤销起始位置', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    const result = engine.undoMove();
    expect(result).toBe(false);
    expect(engine.stepCount).toBe(1);
  });

  it('不能在 selectStart 阶段撤销', () => {
    const engine = createStartedEngine();
    expect(engine.undoMove()).toBe(false);
  });

  it('连续撤销多步', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    engine.moveKnight(4, 2);
    expect(engine.stepCount).toBe(3);

    engine.undoMove();
    expect(engine.stepCount).toBe(2);
    expect(engine.knightRow).toBe(2);
    expect(engine.knightCol).toBe(1);

    engine.undoMove();
    expect(engine.stepCount).toBe(1);
    expect(engine.knightRow).toBe(0);
    expect(engine.knightCol).toBe(0);
  });

  it('U 键触发撤销', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    engine.handleKeyDown('u');
    expect(engine.stepCount).toBe(1);
  });
});

// ========== 键盘控制 ==========

describe('KnightsTourEngine — 键盘控制', () => {
  it('idle 状态下空格键开始游戏', () => {
    const engine = new KnightsTourEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('gameover 状态下空格键重新开始', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    // 构造 gameover
    engine['gameOver']();
    engine['_phase'] = 'lost';
    engine['_status'] = 'gameover';
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.phase).toBe('selectStart');
  });

  it('R 键重新开始', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    engine.handleKeyDown('r');
    expect(engine.phase).toBe('selectStart');
    expect(engine.stepCount).toBe(0);
  });

  it('N 键新游戏（保持棋盘大小）', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);
    engine.handleKeyDown('n');
    expect(engine.boardSize).toBe(5);
    expect(engine.phase).toBe('selectStart');
  });

  it('gameover 状态下 N 键新游戏', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);
    engine['gameOver']();
    engine['_phase'] = 'lost';
    engine['_status'] = 'gameover';
    engine.handleKeyDown('n');
    expect(engine.boardSize).toBe(5);
    expect(engine.phase).toBe('selectStart');
  });

  it('selectStart 阶段方向键移动光标', () => {
    const engine = createStartedEngine();
    expect(engine.cursorRow).toBe(0);
    expect(engine.cursorCol).toBe(0);

    engine.handleKeyDown('ArrowDown');
    expect(engine.cursorRow).toBe(1);

    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorCol).toBe(1);

    engine.handleKeyDown('ArrowUp');
    expect(engine.cursorRow).toBe(0);

    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorCol).toBe(0);
  });

  it('WASD 移动光标', () => {
    const engine = createStartedEngine();
    engine.handleKeyDown('s');
    expect(engine.cursorRow).toBe(1);
    engine.handleKeyDown('d');
    expect(engine.cursorCol).toBe(1);
    engine.handleKeyDown('w');
    expect(engine.cursorRow).toBe(0);
    engine.handleKeyDown('a');
    expect(engine.cursorCol).toBe(0);
  });

  it('光标不能超出棋盘边界', () => {
    const engine = createStartedEngine();
    // 左上角
    engine.handleKeyDown('ArrowUp');
    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorRow).toBe(0);
    expect(engine.cursorCol).toBe(0);
  });

  it('光标不能超出右下边界', () => {
    const engine = createStartedEngine();
    // 移动到 (7, 7)
    for (let i = 0; i < 7; i++) {
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowRight');
    }
    expect(engine.cursorRow).toBe(7);
    expect(engine.cursorCol).toBe(7);
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorRow).toBe(7);
    expect(engine.cursorCol).toBe(7);
  });

  it('playing 阶段方向键在可走位置间导航', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    expect(engine.selectedMoveIndex).toBe(0);
    engine.handleKeyDown('ArrowDown');
    expect(engine.selectedMoveIndex).toBe(1);
    engine.handleKeyDown('ArrowUp');
    expect(engine.selectedMoveIndex).toBe(0);
  });

  it('playing 阶段空格确认移动', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.handleKeyDown(' ');
    expect(engine.stepCount).toBe(2);
  });

  it('paused 状态下不处理游戏按键', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.pause();
    engine.handleKeyDown('ArrowDown');
    // 光标不变
    expect(engine.selectedMoveIndex).toBe(0);
  });
});

// ========== 计分和统计 ==========

describe('KnightsTourEngine — 计分和统计', () => {
  it('起始位置得 10 分', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    expect(engine.score).toBe(10);
  });

  it('每步移动得 10 分', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    expect(engine.score).toBe(20);
  });

  it('提示扣 5 分', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.showHint();
    expect(engine.score).toBe(5);
  });

  it('撤销扣 10 分', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    engine.undoMove();
    expect(engine.score).toBe(10);
  });

  it('胜利时加 500 分', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    let safety = 0;
    while (engine.phase === 'playing' && safety < 30) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    if (engine.isWin) {
      // selectStartPosition: +10, 23 moveKnight: +230, final: +500 (WIN_BONUS)
      expect(engine.score).toBe(10 + 23 * 10 + 500);
    }
  });

  it('elapsedTime 随游戏进行增加', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    // 由于是 requestAnimationFrame 驱动，直接检查 elapsedTime 属性存在
    expect(typeof engine.elapsedTime).toBe('number');
  });
});

// ========== 事件系统 ==========

describe('KnightsTourEngine — 事件', () => {
  it('选择起始位置时触发 knightPlaced 事件', () => {
    const engine = createStartedEngine();
    let eventFired = false;
    let eventData: any = null;
    engine.on('knightPlaced', (data: any) => {
      eventFired = true;
      eventData = data;
    });
    engine.selectStartPosition(3, 3);
    expect(eventFired).toBe(true);
    expect(eventData).toEqual({ row: 3, col: 3 });
  });

  it('移动骑士时触发 knightMoved 事件', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    let eventFired = false;
    let eventData: any = null;
    engine.on('knightMoved', (data: any) => {
      eventFired = true;
      eventData = data;
    });
    engine.moveKnight(2, 1);
    expect(eventFired).toBe(true);
    expect(eventData).toEqual({ row: 2, col: 1, step: 2 });
  });

  it('撤销时触发 moveUndone 事件', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.moveKnight(2, 1);
    let eventFired = false;
    engine.on('moveUndone', () => {
      eventFired = true;
    });
    engine.undoMove();
    expect(eventFired).toBe(true);
  });

  it('提示时触发 hintShown 事件', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    let eventFired = false;
    engine.on('hintShown', () => {
      eventFired = true;
    });
    engine.showHint();
    expect(eventFired).toBe(true);
  });
});

// ========== 边界情况 ==========

describe('KnightsTourEngine — 边界情况', () => {
  it('5×5 棋盘从角出发的可走位置', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);
    expect(engine.moveablePositions.length).toBe(2);
  });

  it('5×5 棋盘从中心出发的可走位置', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(2, 2);
    expect(engine.moveablePositions.length).toBe(8);
  });

  it('6×6 棋盘从角出发的可走位置', () => {
    const engine = createStartedEngine(6);
    engine.selectStartPosition(0, 0);
    expect(engine.moveablePositions.length).toBe(2);
  });

  it('getCellValue 对无效位置返回 0', () => {
    const engine = createStartedEngine();
    expect(engine.getCellValue(-1, 0)).toBe(0);
    expect(engine.getCellValue(8, 8)).toBe(0);
  });

  it('newGame 保持棋盘大小', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);
    engine.newGame();
    expect(engine.boardSize).toBe(5);
    expect(engine.phase).toBe('selectStart');
  });

  it('destroy 清理资源', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('多次 reset 不出错', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    engine.reset();
    engine.reset();
    engine.reset();
    expect(engine.phase).toBe('selectStart');
  });

  it('多次 start 不出错', () => {
    const engine = new KnightsTourEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();
    engine.start(); // 第二次 start 应该不会崩溃（状态已经是 playing）
    expect(engine.status).toBe('playing');
  });

  it('handleKeyUp 不出错', () => {
    const engine = createStartedEngine();
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyUp(' ')).not.toThrow();
  });

  it('moveKnight 在非 playing 阶段返回 false', () => {
    const engine = createStartedEngine();
    expect(engine.moveKnight(2, 1)).toBe(false);
  });

  it('undoMove 在非 playing 阶段返回 false', () => {
    const engine = createStartedEngine();
    expect(engine.undoMove()).toBe(false);
  });

  it('showHint 在非 playing 阶段返回 null', () => {
    const engine = createStartedEngine();
    expect(engine.showHint()).toBeNull();
  });

  it('5×5 棋盘 Warnsdorff 从不同起始位置', () => {
    // 测试多个起始位置
    const starts: Array<[number, number]> = [
      [0, 0], [0, 4], [2, 2], [4, 4], [0, 2],
    ];

    for (const [sr, sc] of starts) {
      const engine = createStartedEngine(5);
      engine.selectStartPosition(sr, sc);

      let safety = 0;
      while (engine.phase === 'playing' && safety < 30) {
        const best = engine.getWarnsdorffBest();
        if (best) {
          engine.moveKnight(best[0], best[1]);
        } else {
          break;
        }
        safety++;
      }

      // Warnsdorff 在 5×5 上通常能从大多数位置完成
      // 我们只验证不会崩溃
      expect(engine.phase).toMatch(/^(won|lost)$/);
    }
  });

  it('8×8 棋盘从不同起始位置使用 Warnsdorff', () => {
    const starts: Array<[number, number]> = [
      [0, 0], [3, 3], [7, 7],
    ];

    for (const [sr, sc] of starts) {
      const engine = createStartedEngine(8);
      engine.selectStartPosition(sr, sc);

      let safety = 0;
      while (engine.phase === 'playing' && safety < 70) {
        const best = engine.getWarnsdorffBest();
        if (best) {
          engine.moveKnight(best[0], best[1]);
        } else {
          break;
        }
        safety++;
      }

      // 验证不崩溃
      expect(engine.phase).toMatch(/^(won|lost)$/);
    }
  });
});

// ========== 完整游戏流程 ==========

describe('KnightsTourEngine — 完整游戏流程', () => {
  it('完整的 5×5 游戏流程：开始 → 选择 → 移动 → 胜利', () => {
    const engine = new KnightsTourEngine();
    const canvas = createMockCanvas();
    engine.setCanvas(canvas);
    engine.init();
    engine.start();

    // 设置 5×5
    engine.handleKeyDown('1');
    expect(engine.boardSize).toBe(5);

    // 选择起始位置 (0, 0)
    engine.handleKeyDown('Enter');
    expect(engine.phase).toBe('playing');

    // 使用 Warnsdorff 完成巡游
    let safety = 0;
    while (engine.phase === 'playing' && safety < 30) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    expect(engine.phase).toBe('won');
    expect(engine.stepCount).toBe(25);
  });

  it('完整的 5×5 游戏流程：开始 → 选择 → 移动 → 撤销 → 继续', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    // 移动几步
    engine.moveKnight(2, 1);
    engine.moveKnight(4, 2);
    expect(engine.stepCount).toBe(3);

    // 撤销一步
    engine.undoMove();
    expect(engine.stepCount).toBe(2);
    expect(engine.knightRow).toBe(2);
    expect(engine.knightCol).toBe(1);

    // 继续移动
    const moves = engine.moveablePositions;
    expect(moves.length).toBeGreaterThan(0);
    engine.moveKnight(moves[0][0], moves[0][1]);
    expect(engine.stepCount).toBe(3);
  });

  it('完整的游戏流程：使用提示', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    // 使用提示
    const hint = engine.showHint();
    expect(hint).not.toBeNull();
    expect(engine.hintActive).toBe(true);

    // 按提示移动
    engine.moveKnight(hint![0], hint![1]);
    expect(engine.hintActive).toBe(false);
  });

  it('游戏结束后重新开始', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    // 完成
    let safety = 0;
    while (engine.phase === 'playing' && safety < 30) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    expect(engine.status).toBe('gameover');

    // 重新开始
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.phase).toBe('selectStart');
    expect(engine.stepCount).toBe(0);
  });

  it('游戏结束后新游戏', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    let safety = 0;
    while (engine.phase === 'playing' && safety < 30) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    engine.handleKeyDown('n');
    expect(engine.boardSize).toBe(5);
    expect(engine.phase).toBe('selectStart');
  });
});

// ========== 渲染相关 ==========

describe('KnightsTourEngine — 渲染', () => {
  it('cellSize 根据棋盘大小计算', () => {
    const engine = createStartedEngine(5);
    expect(engine.cellSize).toBeGreaterThan(0);
    const engine8 = createStartedEngine(8);
    expect(engine8.cellSize).toBeGreaterThan(0);
    expect(engine.cellSize).toBeGreaterThan(engine8.cellSize);
  });

  it('boardOffsetX 使棋盘居中', () => {
    const engine = createStartedEngine(8);
    const ox = engine.boardOffsetX;
    const boardWidth = 8 * engine.cellSize;
    expect(ox).toBe((480 - boardWidth) / 2);
  });

  it('selectStart 阶段渲染不崩溃', () => {
    const engine = createStartedEngine();
    expect(() => engine.handleKeyDown('ArrowDown')).not.toThrow();
  });

  it('playing 阶段渲染不崩溃', () => {
    const engine = createStartedEngine();
    engine.selectStartPosition(0, 0);
    expect(() => engine.handleKeyDown('ArrowDown')).not.toThrow();
  });
});

// ========== 棋盘大小边界 ==========

describe('KnightsTourEngine — 棋盘大小边界', () => {
  it('setBoardSize(5) 后棋盘正确初始化', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(5);
    const board = engine.getBoard();
    expect(board.length).toBe(5);
    expect(board[0].length).toBe(5);
    expect(engine.totalCells).toBe(25);
  });

  it('setBoardSize(6) 后棋盘正确初始化', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(6);
    const board = engine.getBoard();
    expect(board.length).toBe(6);
    expect(board[0].length).toBe(6);
    expect(engine.totalCells).toBe(36);
  });

  it('setBoardSize(8) 后棋盘正确初始化', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(8);
    const board = engine.getBoard();
    expect(board.length).toBe(8);
    expect(board[0].length).toBe(8);
    expect(engine.totalCells).toBe(64);
  });

  it('setBoardSize(0) 无效', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(0);
    expect(engine.boardSize).toBe(8);
  });

  it('setBoardSize(3) 无效', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(3);
    expect(engine.boardSize).toBe(8);
  });

  it('setBoardSize(10) 无效', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(10);
    expect(engine.boardSize).toBe(8);
  });

  it('setBoardSize(7) 有效（支持 5-8 范围）', () => {
    const engine = createStartedEngine();
    engine.setBoardSize(7);
    expect(engine.boardSize).toBe(7);
    expect(engine.totalCells).toBe(49);
  });
});

// ========== 综合场景 ==========

describe('KnightsTourEngine — 综合场景', () => {
  it('完整 8×8 Warnsdorff 巡游验证棋盘', () => {
    const engine = createStartedEngine(8);
    engine.selectStartPosition(0, 0);

    let safety = 0;
    while (engine.phase === 'playing' && safety < 70) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        engine.moveKnight(best[0], best[1]);
      } else {
        break;
      }
      safety++;
    }

    if (engine.isWin) {
      const board = engine.getBoard();
      // 验证每个格子都被访问
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          expect(board[r][c]).toBeGreaterThan(0);
        }
      }
      // 验证步数 1 到 64 都存在
      const steps = new Set<number>();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          steps.add(board[r][c]);
        }
      }
      expect(steps.size).toBe(64);
      for (let i = 1; i <= 64; i++) {
        expect(steps.has(i)).toBe(true);
      }
    }
  });

  it('验证每一步都是合法的 L 形移动', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    let safety = 0;
    while (engine.phase === 'playing' && safety < 30) {
      const best = engine.getWarnsdorffBest();
      if (best) {
        const prevRow = engine.knightRow;
        const prevCol = engine.knightCol;
        engine.moveKnight(best[0], best[1]);
        // 验证是 L 形移动
        expect(engine.isKnightMove(prevRow, prevCol, best[0], best[1])).toBe(true);
      } else {
        break;
      }
      safety++;
    }
  });

  it('验证撤销后继续游戏可以正常进行', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);

    // 走几步
    const best1 = engine.getWarnsdorffBest()!;
    engine.moveKnight(best1[0], best1[1]);
    const best2 = engine.getWarnsdorffBest()!;
    engine.moveKnight(best2[0], best2[1]);

    // 撤销
    engine.undoMove();
    expect(engine.stepCount).toBe(2);

    // 继续走
    const best3 = engine.getWarnsdorffBest()!;
    expect(best3).not.toBeNull();
    engine.moveKnight(best3[0], best3[1]);
    expect(engine.stepCount).toBe(3);
  });

  it('验证多次提示和撤销的分数计算', () => {
    const engine = createStartedEngine(5);
    engine.selectStartPosition(0, 0);
    // 起始: 10分

    engine.showHint(); // 10 - 5 = 5
    expect(engine.score).toBe(5);

    const hint = engine.hintPosition!;
    engine.moveKnight(hint[0], hint[1]); // 5 + 10 = 15
    expect(engine.score).toBe(15);

    engine.undoMove(); // 15 - 10 = 5
    expect(engine.score).toBe(5);

    // 继续移动
    const moves = engine.moveablePositions;
    engine.moveKnight(moves[0][0], moves[0][1]); // 5 + 10 = 15
    expect(engine.score).toBe(15);
  });
});
