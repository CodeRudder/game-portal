import { MinesweeperEngine } from '@/games/minesweeper/MinesweeperEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  DIFFICULTIES,
  CellState,
  SCORE_PER_CELL,
  WIN_BONUS_BEGINNER,
  WIN_BONUS_INTERMEDIATE,
  WIN_BONUS_EXPERT,
  TIME_BONUS_FACTOR,
  GRID_PADDING,
} from '@/games/minesweeper/constants';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): MinesweeperEngine {
  const engine = new MinesweeperEngine();
  const canvas = createCanvas();
  engine.init(canvas);
  return engine;
}

/**
 * 模拟引擎 update，推进 deltaTime 毫秒
 */
function advanceUpdate(engine: MinesweeperEngine, deltaTime: number): void {
  (engine as any).update(deltaTime);
}

/**
 * 获取内部 board 二维数组
 */
function getBoard(engine: MinesweeperEngine): any[][] {
  return (engine as any).board;
}

/**
 * 获取格子大小
 */
function getCellSize(engine: MinesweeperEngine): number {
  return (engine as any).cellSize;
}

/**
 * 获取网格偏移量
 */
function getGridOffset(engine: MinesweeperEngine): { x: number; y: number } {
  return {
    x: (engine as any).gridOffsetX,
    y: (engine as any).gridOffsetY,
  };
}

/**
 * 将棋盘坐标转换为 canvas 像素坐标（格子中心）
 */
function cellToPixel(engine: MinesweeperEngine, row: number, col: number): { x: number; y: number } {
  const offset = getGridOffset(engine);
  const size = getCellSize(engine);
  return {
    x: offset.x + col * size + size / 2,
    y: offset.y + row * size + size / 2,
  };
}

/**
 * 执行首次左键点击（生成地雷 + 揭开）
 */
function doFirstClick(engine: MinesweeperEngine, row: number, col: number): void {
  const pos = cellToPixel(engine, row, col);
  engine.handleClick(pos.x, pos.y);
}

/**
 * 在指定格子右键标旗
 */
function doRightClick(engine: MinesweeperEngine, row: number, col: number): void {
  const pos = cellToPixel(engine, row, col);
  engine.handleRightClick(pos.x, pos.y);
}

/**
 * 在指定格子左键点击
 */
function doLeftClick(engine: MinesweeperEngine, row: number, col: number): void {
  const pos = cellToPixel(engine, row, col);
  engine.handleClick(pos.x, pos.y);
}

/**
 * 统计棋盘上地雷总数
 */
function countMines(engine: MinesweeperEngine): number {
  const board = getBoard(engine);
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.isMine) count++;
    }
  }
  return count;
}

/**
 * 统计棋盘上指定状态的格子数
 */
function countCellState(engine: MinesweeperEngine, state: CellState): number {
  const board = getBoard(engine);
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.state === state) count++;
    }
  }
  return count;
}

/**
 * 获取指定格子
 */
function getCell(engine: MinesweeperEngine, row: number, col: number) {
  return getBoard(engine)[row][col];
}

// ========== 测试 ==========

describe('MinesweeperEngine', () => {
  // ==================== T1: 初始化 ====================
  describe('初始化', () => {
    it('init 后 status 为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('init 后默认难度为 beginner（9x9，10雷）', () => {
      const engine = createEngine();
      expect(engine.currentDifficulty).toBe('beginner');
      const state = engine.getState();
      expect(state.rows).toBe(9);
      expect(state.cols).toBe(9);
      expect(state.totalMines).toBe(10);
    });

    it('init 后棋盘已构建（9x9 = 81 格）', () => {
      const engine = createEngine();
      const board = getBoard(engine);
      expect(board).toHaveLength(9);
      board.forEach((row) => expect(row).toHaveLength(9));
    });

    it('init 后所有格子为 HIDDEN 状态', () => {
      const engine = createEngine();
      expect(countCellState(engine, CellState.HIDDEN)).toBe(81);
    });

    it('init 后棋盘无地雷（首次点击后才生成）', () => {
      const engine = createEngine();
      expect(countMines(engine)).toBe(0);
    });

    it('init 后分数、旗帜数、揭开数、计时器均为 0', () => {
      const engine = createEngine();
      expect(engine.score).toBe(0);
      expect(engine.flagCount).toBe(0);
      expect(engine.revealedCount).toBe(0);
      expect(engine.timer).toBe(0);
    });

    it('init 后 isWin 为 false', () => {
      const engine = createEngine();
      expect(engine.isWin).toBe(false);
    });

    it('未 init 直接 start 抛出异常', () => {
      const engine = new MinesweeperEngine();
      expect(() => engine.start()).toThrow('Canvas not initialized');
    });
  });

  // ==================== T2: 地雷生成（首次点击安全） ====================
  describe('地雷生成', () => {
    it('首次左键点击后生成地雷', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      expect(countMines(engine)).toBe(10);
    });

    it('首次点击位置无地雷', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      expect(getCell(engine, 4, 4).isMine).toBe(false);
    });

    it('首次点击位置的 8 邻居无地雷', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          expect(getCell(engine, 4 + dr, 4 + dc).isMine).toBe(false);
        }
      }
    });

    it('角落首次点击安全区域正确', () => {
      const engine = createEngine();
      doFirstClick(engine, 0, 0);
      // 左上角只有 3 个邻居 + 自身 = 4 个安全格
      const safeCells = [
        [0, 0], [0, 1], [1, 0], [1, 1],
      ];
      safeCells.forEach(([r, c]) => {
        expect(getCell(engine, r, c).isMine).toBe(false);
      });
      expect(countMines(engine)).toBe(10);
    });

    it('中级难度生成 40 颗地雷', () => {
      const engine = createEngine();
      engine.setDifficulty('intermediate');
      doFirstClick(engine, 8, 8);
      expect(countMines(engine)).toBe(40);
    });

    it('高级难度生成 99 颗地雷', () => {
      const engine = createEngine();
      engine.setDifficulty('expert');
      doFirstClick(engine, 8, 15);
      expect(countMines(engine)).toBe(99);
    });

    it('地雷生成后 minesGenerated 标记为 true', () => {
      const engine = createEngine();
      expect(engine.getState().minesGenerated).toBe(false);
      doFirstClick(engine, 4, 4);
      expect(engine.getState().minesGenerated).toBe(true);
    });
  });

  // ==================== T3: 揭开格子 ====================
  describe('揭开格子', () => {
    it('左键点击揭开单个格子', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // 首次点击已揭开 (4,4)
      expect(getCell(engine, 4, 4).state).toBe(CellState.REVEALED);
    });

    it('揭开安全格后 revealedCount 增加', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // 点击 (4,4) 是空白区域，会 BFS 展开，所以 revealedCount > 1
      expect(engine.revealedCount).toBeGreaterThan(0);
    });

    it('点击空白格触发 BFS 递归展开', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // 点击中心空白格，因为安全区 3x3=9 格无雷，
      // 且这些格子周围也无雷（因为邻居格可能也是0），
              // 所以 BFS 会展开大量格子
      expect(engine.revealedCount).toBeGreaterThan(1);
    });

    it('已揭开的格子再次点击无效', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      const countBefore = engine.revealedCount;
      doLeftClick(engine, 4, 4);
      expect(engine.revealedCount).toBe(countBefore);
    });

    it('揭开安全格得分（每格 10 分）', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      expect(engine.score).toBe(engine.revealedCount * SCORE_PER_CELL);
    });

    it('gameover 后点击无效', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);

      // 手动设置 gameover
      (engine as any)._status = 'gameover';
      const countBefore = engine.revealedCount;

      doLeftClick(engine, 0, 0);
      expect(engine.revealedCount).toBe(countBefore);
    });
  });

  // ==================== T4: 标旗操作 ====================
  describe('标旗操作', () => {
    it('右键点击隐藏格标旗', () => {
      const engine = createEngine();
      // 先启动游戏
      doFirstClick(engine, 4, 4);
      // 找到一个仍为 HIDDEN 的格子来标旗
      const board = getBoard(engine);
      let flagR = -1, flagC = -1;
      outer:
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c].state === CellState.HIDDEN) {
            flagR = r;
            flagC = c;
            break outer;
          }
        }
      }
      doRightClick(engine, flagR, flagC);
      expect(getCell(engine, flagR, flagC).state).toBe(CellState.FLAGGED);
    });

    it('标旗后 flagCount 增加', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // 找到一个仍为 HIDDEN 且不在 (4,4) 邻居中的格子来标旗
      const board = getBoard(engine);
      let flagR = -1, flagC = -1;
      outer: for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c].state === CellState.HIDDEN) {
            flagR = r; flagC = c;
            break outer;
          }
        }
      }
      doRightClick(engine, flagR, flagC);
      expect(engine.flagCount).toBe(1);
    });

    it('再次右键已标旗格子取消标旗', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // 找到一个仍为 HIDDEN 的格子来标旗
      const board = getBoard(engine);
      let flagR = -1, flagC = -1;
      outer:
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c].state === CellState.HIDDEN) {
            flagR = r;
            flagC = c;
            break outer;
          }
        }
      }
      doRightClick(engine, flagR, flagC);
      expect(engine.flagCount).toBe(1);
      doRightClick(engine, flagR, flagC);
      expect(getCell(engine, flagR, flagC).state).toBe(CellState.HIDDEN);
      expect(engine.flagCount).toBe(0);
    });

    it('已揭开的格子不能标旗', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // (4,4) 已揭开
      doRightClick(engine, 4, 4);
      expect(getCell(engine, 4, 4).state).toBe(CellState.REVEALED);
      expect(engine.flagCount).toBe(0);
    });

    it('多个格子标旗计数正确', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // 找到3个仍为 HIDDEN 的格子
      const board = getBoard(engine);
      const hiddenCells: { r: number; c: number }[] = [];
      for (let r = 0; r < 9 && hiddenCells.length < 3; r++) {
        for (let c = 0; c < 9 && hiddenCells.length < 3; c++) {
          if (board[r][c].state === CellState.HIDDEN) {
            hiddenCells.push({ r, c });
          }
        }
      }
      hiddenCells.forEach(({ r, c }) => doRightClick(engine, r, c));
      expect(engine.flagCount).toBe(hiddenCells.length);
    });

    it('混合标旗和取消标旗计数正确', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      const board = getBoard(engine);
      const hiddenCells: { r: number; c: number }[] = [];
      for (let r = 0; r < 9 && hiddenCells.length < 2; r++) {
        for (let c = 0; c < 9 && hiddenCells.length < 2; c++) {
          if (board[r][c].state === CellState.HIDDEN) {
            hiddenCells.push({ r, c });
          }
        }
      }
      doRightClick(engine, hiddenCells[0].r, hiddenCells[0].c); // +1
      doRightClick(engine, hiddenCells[1].r, hiddenCells[1].c); // +1
      doRightClick(engine, hiddenCells[0].r, hiddenCells[0].c); // -1（取消）
      expect(engine.flagCount).toBe(1);
    });
  });

  // ==================== T5: 数字计算 ====================
  describe('数字计算', () => {
    it('非雷格子的 adjacentMines 反映周围地雷数', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // 验证所有非雷格子的 adjacentMines 正确
      const board = getBoard(engine);
      const rows = (engine as any).rows;
      const cols = (engine as any).cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = board[r][c];
          if (cell.isMine) {
            expect(cell.adjacentMines).toBe(-1);
          } else {
            // 手动计算周围地雷数
            let expected = 0;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isMine) {
                  expected++;
                }
              }
            }
            expect(cell.adjacentMines).toBe(expected);
          }
        }
      }
    });

    it('安全区域（首次点击 3x3）内格子 adjacentMines 为 0', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // (4,4) 及其 8 邻居无雷，且安全区 3x3 内的格子周围也全是安全区格子
      // 所以安全区中心 (4,4) 的 adjacentMines 必为 0
      expect(getCell(engine, 4, 4).adjacentMines).toBe(0);
    });
  });

  // ==================== T6: 胜利检测 ====================
  describe('胜利检测', () => {
    it('揭开所有非雷格后 isWin 为 true', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);

      // 手动揭开所有非雷格子
      const board = getBoard(engine);
      const rows = (engine as any).rows;
      const cols = (engine as any).cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = board[r][c];
          if (!cell.isMine && cell.state === CellState.HIDDEN) {
            cell.state = CellState.REVEALED;
            (engine as any)._revealedCount++;
          }
        }
      }

      // 触发 checkWin
      (engine as any).checkWin();
      expect(engine.isWin).toBe(true);
    });

    it('胜利后 status 为 gameover', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);

      const board = getBoard(engine);
      const rows = (engine as any).rows;
      const cols = (engine as any).cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = board[r][c];
          if (!cell.isMine && cell.state === CellState.HIDDEN) {
            cell.state = CellState.REVEALED;
            (engine as any)._revealedCount++;
          }
        }
      }
      (engine as any).checkWin();
      expect(engine.status).toBe('gameover');
    });

    it('胜利后获得基础奖励分', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);

      const board = getBoard(engine);
      const rows = (engine as any).rows;
      const cols = (engine as any).cols;
      const safeCells = rows * cols - 10; // beginner: 81 - 10 = 71
      // 先记录揭开格子得分
      let revealedForScore = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = board[r][c];
          if (!cell.isMine && cell.state === CellState.HIDDEN) {
            cell.state = CellState.REVEALED;
            (engine as any)._revealedCount++;
            revealedForScore++;
          }
        }
      }
      const scoreBefore = engine.score;
      (engine as any).checkWin();
      // 胜利后分数应包含: 之前的分数 + WIN_BONUS_BEGINNER + 时间奖励
      expect(engine.score).toBeGreaterThan(scoreBefore);
      expect(engine.score).toBeGreaterThanOrEqual(scoreBefore + WIN_BONUS_BEGINNER);
    });

    it('未揭开所有安全格时不会胜利', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // 只揭开了一些格子，未全部揭开
      expect(engine.isWin).toBe(false);
    });
  });

  // ==================== T7: 失败检测 ====================
  describe('失败检测', () => {
    it('点击地雷格触发 gameover', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);

      // 手动找一个地雷格子并点击
      const board = getBoard(engine);
      let mineRow = -1, mineCol = -1;
      outer:
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c].isMine) {
            mineRow = r;
            mineCol = c;
            break outer;
          }
        }
      }
      expect(mineRow).toBeGreaterThanOrEqual(0);

      doLeftClick(engine, mineRow, mineCol);
      expect(engine.status).toBe('gameover');
    });

    it('踩雷后 isWin 为 false', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);

      const board = getBoard(engine);
      let mineRow = -1, mineCol = -1;
      outer:
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c].isMine) {
            mineRow = r;
            mineCol = c;
            break outer;
          }
        }
      }

      doLeftClick(engine, mineRow, mineCol);
      expect(engine.isWin).toBe(false);
    });

    it('踩雷后所有地雷被揭开', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);

      const board = getBoard(engine);
      let mineRow = -1, mineCol = -1;
      outer:
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c].isMine) {
            mineRow = r;
            mineCol = c;
            break outer;
          }
        }
      }

      doLeftClick(engine, mineRow, mineCol);

      // 所有未标旗的地雷应被揭开
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = board[r][c];
          if (cell.isMine && cell.state !== CellState.FLAGGED) {
            expect(cell.state).toBe(CellState.REVEALED);
          }
        }
      }
    });
  });

  // ==================== T8: 难度切换 ====================
  describe('难度切换', () => {
    it('setDifficulty("intermediate") 切换到 16x16', () => {
      const engine = createEngine();
      engine.setDifficulty('intermediate');
      const state = engine.getState();
      expect(state.rows).toBe(16);
      expect(state.cols).toBe(16);
      expect(state.totalMines).toBe(40);
    });

    it('setDifficulty("expert") 切换到 16x30', () => {
      const engine = createEngine();
      engine.setDifficulty('expert');
      const state = engine.getState();
      expect(state.rows).toBe(16);
      expect(state.cols).toBe(30);
      expect(state.totalMines).toBe(99);
    });

    it('setDifficulty 后棋盘重建', () => {
      const engine = createEngine();
      engine.setDifficulty('intermediate');
      const board = getBoard(engine);
      expect(board).toHaveLength(16);
      board.forEach((row: any[]) => expect(row).toHaveLength(16));
    });

    it('setDifficulty 后状态重置为 idle', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      expect(engine.status).toBe('playing');

      engine.setDifficulty('intermediate');
      expect(engine.status).toBe('idle');
    });

    it('setDifficulty 后计数器归零', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      engine.setDifficulty('intermediate');
      expect(engine.flagCount).toBe(0);
      expect(engine.revealedCount).toBe(0);
      expect(engine.score).toBe(0);
    });

    it('setDifficulty 传入无效 key 不改变棋盘', () => {
      const engine = createEngine();
      const stateBefore = engine.getState();
      engine.setDifficulty('invalid');
      const stateAfter = engine.getState();
      expect(stateAfter.rows).toBe(stateBefore.rows);
      expect(stateAfter.cols).toBe(stateBefore.cols);
    });

    it('setDifficulty 后 currentDifficulty 更新', () => {
      const engine = createEngine();
      engine.setDifficulty('expert');
      expect(engine.currentDifficulty).toBe('expert');
    });
  });

  // ==================== T9: 计时器功能 ====================
  describe('计时器功能', () => {
    it('idle 状态下 timer 为 0', () => {
      const engine = createEngine();
      expect(engine.timer).toBe(0);
    });

    it('update 更新 timer 值', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // 手动设置 elapsedTime 模拟时间流逝
      (engine as any)._elapsedTime = 5.3;
      advanceUpdate(engine, 16.667);
      expect(engine.timer).toBeCloseTo(5.3, 1);
    });
  });

  // ==================== T10: 重置功能 ====================
  describe('重置功能', () => {
    it('reset 后 status 为 idle', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后棋盘重建为空白', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      engine.reset();
      expect(countMines(engine)).toBe(0);
      expect(countCellState(engine, CellState.HIDDEN)).toBe(81);
    });

    it('reset 后计数器归零', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      engine.reset();
      expect(engine.flagCount).toBe(0);
      expect(engine.revealedCount).toBe(0);
      expect(engine.score).toBe(0);
      expect(engine.isWin).toBe(false);
    });

    it('reset 后可重新开始游戏', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      engine.reset();
      // 重新点击开始
      doFirstClick(engine, 4, 4);
      expect(engine.status).toBe('playing');
      expect(countMines(engine)).toBe(10);
    });
  });

  // ==================== T11: 事件发射 ====================
  describe('事件发射', () => {
    it('start 触发 statusChange 为 playing', () => {
      const engine = createEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      // handleClick 中 idle → start
      doFirstClick(engine, 4, 4);
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('揭开格子触发 scoreChange 事件', () => {
      const engine = createEngine();
      const cb = vi.fn();
      engine.on('scoreChange', cb);
      doFirstClick(engine, 4, 4);
      // 至少触发过一次 scoreChange（揭开格子得分）
      expect(cb).toHaveBeenCalled();
      // 最后一次调用的分数应等于当前分数
      const lastCall = cb.mock.calls[cb.mock.calls.length - 1];
      expect(lastCall[0]).toBe(engine.score);
    });

    it('gameover 触发 statusChange 为 gameover', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);

      const cb = vi.fn();
      engine.on('statusChange', cb);

      // 找地雷并点击
      const board = getBoard(engine);
      let mineRow = -1, mineCol = -1;
      outer:
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c].isMine) {
            mineRow = r;
            mineCol = c;
            break outer;
          }
        }
      }
      doLeftClick(engine, mineRow, mineCol);
      expect(cb).toHaveBeenCalledWith('gameover');
    });

    it('reset 触发 statusChange 为 idle', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.reset();
      expect(cb).toHaveBeenCalledWith('idle');
    });

    it('reset 触发 scoreChange 为 0', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      const cb = vi.fn();
      engine.on('scoreChange', cb);
      engine.reset();
      expect(cb).toHaveBeenCalledWith(0);
    });
  });

  // ==================== T12: handleKeyDown ====================
  describe('handleKeyDown', () => {
    it('ArrowUp 移动光标上移', () => {
      const engine = createEngine();
      (engine as any).cursorRow = 4;
      (engine as any).cursorCol = 4;
      engine.handleKeyDown('ArrowUp');
      expect((engine as any).cursorRow).toBe(3);
    });

    it('ArrowDown 移动光标下移', () => {
      const engine = createEngine();
      (engine as any).cursorRow = 4;
      engine.handleKeyDown('ArrowDown');
      expect((engine as any).cursorRow).toBe(5);
    });

    it('ArrowLeft 移动光标左移', () => {
      const engine = createEngine();
      (engine as any).cursorCol = 4;
      engine.handleKeyDown('ArrowLeft');
      expect((engine as any).cursorCol).toBe(3);
    });

    it('ArrowRight 移动光标右移', () => {
      const engine = createEngine();
      (engine as any).cursorCol = 4;
      engine.handleKeyDown('ArrowRight');
      expect((engine as any).cursorCol).toBe(5);
    });

    it('光标不会移出上边界', () => {
      const engine = createEngine();
      (engine as any).cursorRow = 0;
      engine.handleKeyDown('ArrowUp');
      expect((engine as any).cursorRow).toBe(0);
    });

    it('光标不会移出下边界', () => {
      const engine = createEngine();
      (engine as any).cursorRow = 8; // beginner 最后一行
      engine.handleKeyDown('ArrowDown');
      expect((engine as any).cursorRow).toBe(8);
    });

    it('光标不会移出左边界', () => {
      const engine = createEngine();
      (engine as any).cursorCol = 0;
      engine.handleKeyDown('ArrowLeft');
      expect((engine as any).cursorCol).toBe(0);
    });

    it('光标不会移出右边界', () => {
      const engine = createEngine();
      (engine as any).cursorCol = 8;
      engine.handleKeyDown('ArrowRight');
      expect((engine as any).cursorCol).toBe(8);
    });

    it('W/A/S/D 也可移动光标', () => {
      const engine = createEngine();
      (engine as any).cursorRow = 4;
      (engine as any).cursorCol = 4;

      engine.handleKeyDown('w');
      expect((engine as any).cursorRow).toBe(3);

      engine.handleKeyDown('s');
      expect((engine as any).cursorRow).toBe(4);

      engine.handleKeyDown('a');
      expect((engine as any).cursorCol).toBe(3);

      engine.handleKeyDown('d');
      expect((engine as any).cursorCol).toBe(4);
    });

    it('空格键揭开光标所在格子', () => {
      const engine = createEngine();
      (engine as any).cursorRow = 4;
      (engine as any).cursorCol = 4;
      engine.handleKeyDown(' ');
      // 空格首次点击会生成地雷并揭开
      expect(getCell(engine, 4, 4).state).toBe(CellState.REVEALED);
      expect(countMines(engine)).toBe(10);
    });

    it('F 键切换标旗', () => {
      const engine = createEngine();
      // 先启动游戏
      doFirstClick(engine, 4, 4);
      // 找到一个仍为 HIDDEN 的格子
      const board = getBoard(engine);
      let flagR = -1, flagC = -1;
      outer:
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c].state === CellState.HIDDEN) {
            flagR = r;
            flagC = c;
            break outer;
          }
        }
      }
      // 设置光标位置
      (engine as any).cursorRow = flagR;
      (engine as any).cursorCol = flagC;
      engine.handleKeyDown('f');
      expect(getCell(engine, flagR, flagC).state).toBe(CellState.FLAGGED);
      engine.handleKeyDown('F');
      expect(getCell(engine, flagR, flagC).state).toBe(CellState.HIDDEN);
    });

    it('1 键切换到初级难度', () => {
      const engine = createEngine();
      engine.setDifficulty('expert');
      engine.handleKeyDown('1');
      expect(engine.currentDifficulty).toBe('beginner');
    });

    it('2 键切换到中级难度', () => {
      const engine = createEngine();
      engine.handleKeyDown('2');
      expect(engine.currentDifficulty).toBe('intermediate');
    });

    it('3 键切换到高级难度', () => {
      const engine = createEngine();
      engine.handleKeyDown('3');
      expect(engine.currentDifficulty).toBe('expert');
    });

    it('gameover 后按键无效', () => {
      const engine = createEngine();
      (engine as any)._status = 'gameover';
      (engine as any).cursorRow = 4;
      const rowBefore = (engine as any).cursorRow;
      engine.handleKeyDown('ArrowUp');
      // gameover 状态下直接返回，不处理方向键
      expect((engine as any).cursorRow).toBe(rowBefore);
    });
  });

  // ==================== T13: handleClick ====================
  describe('handleClick', () => {
    it('左键点击揭开格子', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      expect(getCell(engine, 4, 4).state).toBe(CellState.REVEALED);
    });

    it('右键点击标旗', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      // 找到一个仍为 HIDDEN 的格子来标旗
      const board = getBoard(engine);
      let flagR = -1, flagC = -1;
      outer:
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c].state === CellState.HIDDEN) {
            flagR = r;
            flagC = c;
            break outer;
          }
        }
      }
      doRightClick(engine, flagR, flagC);
      expect(getCell(engine, flagR, flagC).state).toBe(CellState.FLAGGED);
    });

    it('idle 状态下左键点击自动启动游戏', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
      doFirstClick(engine, 4, 4);
      expect(engine.status).toBe('playing');
    });

    it('点击表情按钮触发重置', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      expect(engine.status).toBe('playing');

      // 点击表情按钮（画布中央，HUD 中央）
      const faceX = CANVAS_WIDTH / 2;
      const faceY = HUD_HEIGHT / 2;
      engine.handleClick(faceX, faceY);
      expect(engine.status).toBe('idle');
    });

    it('点击网格外坐标不揭开任何格子', () => {
      const engine = createEngine();
      // 点击画布左上角（网格外）
      engine.handleClick(0, 0);
      // handleClick 在 idle 状态下会先 start()，但坐标在网格外不会揭开格子
      // 也不会生成地雷（因为坐标不在网格内）
      expect((engine as any).minesGenerated).toBe(false);
      expect(engine.revealedCount).toBe(0);
    });

    it('gameover 后点击无效', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      (engine as any)._status = 'gameover';
      const countBefore = engine.revealedCount;
      doLeftClick(engine, 0, 0);
      expect(engine.revealedCount).toBe(countBefore);
    });
  });

  // ==================== T14: getState 返回值 ====================
  describe('getState', () => {
    it('返回所有关键状态字段', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('rows');
      expect(state).toHaveProperty('cols');
      expect(state).toHaveProperty('totalMines');
      expect(state).toHaveProperty('flagCount');
      expect(state).toHaveProperty('revealedCount');
      expect(state).toHaveProperty('timer');
      expect(state).toHaveProperty('isWin');
      expect(state).toHaveProperty('difficulty');
    });

    it('初始状态值正确', () => {
      const engine = createEngine();
      const state = engine.getState();
      expect(state.rows).toBe(9);
      expect(state.cols).toBe(9);
      expect(state.totalMines).toBe(10);
      expect(state.flagCount).toBe(0);
      expect(state.revealedCount).toBe(0);
      expect(state.timer).toBe(0);
      expect(state.isWin).toBe(false);
      expect(state.difficulty).toBe('beginner');
    });

    it('游戏进行中状态实时更新', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      const state = engine.getState();
      expect(state.revealedCount).toBeGreaterThan(0);
      expect(state.minesGenerated).toBe(true);
    });
  });

  // ==================== T15: 边界条件 ====================
  describe('边界条件', () => {
    it('handleKeyUp 不抛异常', () => {
      const engine = createEngine();
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });

    it('destroy 后状态正确', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      engine.destroy();
      expect(engine.status).toBe('idle');
      expect(getBoard(engine)).toHaveLength(0);
    });

    it('连续多次 reset 不出错', () => {
      const engine = createEngine();
      doFirstClick(engine, 4, 4);
      engine.reset();
      engine.reset();
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.revealedCount).toBe(0);
    });

    it('中级难度棋盘大小正确', () => {
      const engine = createEngine();
      engine.setDifficulty('intermediate');
      const board = getBoard(engine);
      expect(board).toHaveLength(16);
      board.forEach((row: any[]) => expect(row).toHaveLength(16));
    });

    it('高级难度棋盘大小正确', () => {
      const engine = createEngine();
      engine.setDifficulty('expert');
      const board = getBoard(engine);
      expect(board).toHaveLength(16);
      board.forEach((row: any[]) => expect(row).toHaveLength(30));
    });

    it('格子大小至少为 16', () => {
      const engine = createEngine();
      engine.setDifficulty('expert');
      expect(getCellSize(engine)).toBeGreaterThanOrEqual(16);
    });

    it('首次右键标旗不生成地雷', () => {
      const engine = createEngine();
      // 在 idle 状态下右键标旗
      doRightClick(engine, 0, 0);
      // 右键不会触发生成地雷（只有左键首次点击才生成）
      expect((engine as any).minesGenerated).toBe(false);
      // 但标旗应该生效（handleClick 中 idle → start，然后右键标旗）
      // 注意：根据引擎逻辑，idle 状态下右键会先 start，然后标旗
      // 但标旗不需要先生成地雷
      expect(engine.flagCount).toBe(1);
    });

    it('右键标旗后再次左键点击会作为首次点击生成地雷', () => {
      const engine = createEngine();
      // 先右键标旗启动游戏但不生成地雷
      doRightClick(engine, 0, 0);
      expect((engine as any).minesGenerated).toBe(false);
      expect(engine.flagCount).toBe(1);
      // 再左键点击另一个格子 - _firstClick 仍为 true，会生成地雷
      doLeftClick(engine, 1, 1);
      expect((engine as any).minesGenerated).toBe(true);
      expect(getCell(engine, 1, 1).state).toBe(CellState.REVEALED);
    });
  });
});
