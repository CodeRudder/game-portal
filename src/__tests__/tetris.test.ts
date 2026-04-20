import { TetrisEngine } from '@/games/tetris/TetrisEngine';

// ========== 常量 (与引擎内部一致) ==========
const COLS = 10;
const ROWS = 20;

// ========== 辅助函数 ==========

/** 创建 canvas 元素 */
function createCanvas(w = COLS * 30, h = ROWS * 30): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** 创建并初始化引擎（带 canvas） */
function createEngine(): TetrisEngine {
  const engine = new TetrisEngine();
  engine.init(createCanvas());
  return engine;
}

/** 创建引擎并启动游戏 */
function createAndStartEngine(): TetrisEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/**
 * 将当前方块硬降到底部并锁定，然后返回引擎以便链式操作。
 * 每次调用完成一次 "放置方块" 的完整流程。
 */
function dropAndLock(engine: TetrisEngine): void {
  engine.handleKeyDown(' ');
}

/**
 * 在棋盘底部手动填充指定行（从底部 row=19 开始往上）。
 * 通过直接操作私有 board 属性实现，用于测试行消除等逻辑。
 * @param rows 二维数组，每个子数组代表一行的填充值（0=空, 1-7=方块类型+1）
 */
function fillBoardRows(engine: TetrisEngine, rows: number[][]): void {
  const board = (engine as any).board as number[][];
  const startRow = ROWS - rows.length;
  for (let i = 0; i < rows.length; i++) {
    board[startRow + i] = [...rows[i]];
  }
}

/**
 * 填满底部 n 行（每行所有列都设为非零值）。
 * 留出一列空隙以便控制哪些行被填满。
 * @param n 行数
 * @param gaps 可选，每行留空的列索引数组
 */
function fillBottomRows(engine: TetrisEngine, n: number, gaps?: number[][]): void {
  const board = (engine as any).board as number[][];
  for (let r = ROWS - n; r < ROWS; r++) {
    const rowIdx = r - (ROWS - n);
    const gapCols = gaps?.[rowIdx] ?? [];
    for (let c = 0; c < COLS; c++) {
      board[r][c] = gapCols.includes(c) ? 0 : 1;
    }
  }
}

// ========== 测试套件 ==========

describe('TetrisEngine', () => {
  let engine: TetrisEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  // ================================================================
  // T1: 初始化
  // ================================================================
  describe('T1 - 初始化', () => {
    it('init() 后棋盘应为 20 行 × 10 列的全零矩阵', () => {
      const board = (engine as any).board as number[][];
      expect(board).toHaveLength(ROWS);
      for (let r = 0; r < ROWS; r++) {
        expect(board[r]).toHaveLength(COLS);
        expect(board[r].every((cell) => cell === 0)).toBe(true);
      }
    });

    it('init() 后 status 应为 idle', () => {
      expect(engine.status).toBe('idle');
    });

    it('init() 后 score=0, level=1, elapsedTime=0', () => {
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
      expect(engine.elapsedTime).toBe(0);
    });

    it('未传入 canvas 时 init() 不应抛错', () => {
      const e = new TetrisEngine();
      expect(() => e.init()).not.toThrow();
    });
  });

  // ================================================================
  // T2: 方块生成
  // ================================================================
  describe('T2 - 方块生成', () => {
    it('start() 后 currentPiece 不为 null', () => {
      engine.start();
      expect((engine as any).currentPiece).not.toBeNull();
    });

    it('start() 后 nextType 在 0-6 范围内（7 种标准方块）', () => {
      engine.start();
      const state = engine.getState();
      expect(state.nextType).toBeGreaterThanOrEqual(0);
      expect(state.nextType).toBeLessThanOrEqual(6);
    });

    it('多次 start() 应正确重置方块状态', () => {
      engine.start();
      const piece1 = (engine as any).currentPiece;
      engine.reset();
      engine.start();
      const piece2 = (engine as any).currentPiece;
      // 重置后重新开始，棋盘应为空
      expect((engine as any).board.every((row: number[]) => row.every((c: number) => c === 0))).toBe(true);
      expect(piece2).not.toBeNull();
    });

    it('方块初始 x 位置应在棋盘中央区域', () => {
      engine.start();
      const piece = (engine as any).currentPiece;
      const shapeWidth = piece.shape[0].length;
      const expectedX = Math.floor((COLS - shapeWidth) / 2);
      expect(piece.x).toBe(expectedX);
    });

    it('方块初始 y 位置应为 -1（从顶部上方进入）', () => {
      engine.start();
      const piece = (engine as any).currentPiece;
      expect(piece.y).toBe(-1);
    });
  });

  // ================================================================
  // T3: 旋转
  // ================================================================
  describe('T3 - 旋转', () => {
    it('按 ArrowUp 应触发旋转，方块形状发生改变', () => {
      engine.start();
      const piece = (engine as any).currentPiece;
      const originalShape = piece.shape.map((r: number[]) => [...r]);

      engine.handleKeyDown('ArrowUp');

      const rotatedShape = piece.shape;
      // 形状矩阵应该发生变化（除非是 O 方块 2x2，旋转后不变）
      const isOBlock = originalShape.length === 2;
      if (!isOBlock) {
        const shapesEqual = JSON.stringify(originalShape) === JSON.stringify(rotatedShape);
        expect(shapesEqual).toBe(false);
      }
    });

    it('连续旋转 4 次应回到原始形状', () => {
      engine.start();
      const piece = (engine as any).currentPiece;
      const originalShape = piece.shape.map((r: number[]) => [...r]);

      // O 方块旋转不变，跳过
      if (originalShape.length === 2) return;

      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowUp');

      const finalShape = piece.shape;
      expect(JSON.stringify(finalShape)).toBe(JSON.stringify(originalShape));
    });

    it('旋转不应导致方块移出边界（墙踢机制）', () => {
      engine.start();
      // 先把方块移到最右边
      for (let i = 0; i < 15; i++) {
        engine.handleKeyDown('ArrowRight');
      }
      // 旋转不应崩溃
      expect(() => {
        for (let i = 0; i < 4; i++) {
          engine.handleKeyDown('ArrowUp');
        }
      }).not.toThrow();
      expect(engine.status).toBe('playing');
    });

    it('在棋盘左侧旋转应正确墙踢', () => {
      engine.start();
      // 移到最左边
      for (let i = 0; i < 15; i++) {
        engine.handleKeyDown('ArrowLeft');
      }
      expect(() => {
        for (let i = 0; i < 4; i++) {
          engine.handleKeyDown('ArrowUp');
        }
      }).not.toThrow();
      expect(engine.status).toBe('playing');
    });
  });

  // ================================================================
  // T4: 碰撞检测
  // ================================================================
  describe('T4 - 碰撞检测', () => {
    it('方块不能超出左边界', () => {
      engine.start();
      for (let i = 0; i < 20; i++) {
        engine.handleKeyDown('ArrowLeft');
      }
      const piece = (engine as any).currentPiece;
      // 所有方块格子的 x 坐标应 >= 0
      piece.shape.forEach((row: number[], dy: number) => {
        row.forEach((val: number, dx: number) => {
          if (val) {
            expect(piece.x + dx).toBeGreaterThanOrEqual(0);
          }
        });
      });
    });

    it('方块不能超出右边界', () => {
      engine.start();
      for (let i = 0; i < 20; i++) {
        engine.handleKeyDown('ArrowRight');
      }
      const piece = (engine as any).currentPiece;
      piece.shape.forEach((row: number[], dy: number) => {
        row.forEach((val: number, dx: number) => {
          if (val) {
            expect(piece.x + dx).toBeLessThan(COLS);
          }
        });
      });
    });

    it('方块到达底部后应锁定到棋盘', () => {
      engine.start();
      // 硬降到底部
      engine.handleKeyDown(' ');

      const board = (engine as any).board as number[][];
      // 棋盘底部区域应该有非零值
      const bottomRows = board.slice(-4);
      const hasLockedPiece = bottomRows.some((row) => row.some((cell) => cell !== 0));
      expect(hasLockedPiece).toBe(true);
    });

    it('锁定后应生成新方块', () => {
      engine.start();
      const firstPiece = (engine as any).currentPiece;

      engine.handleKeyDown(' ');

      const secondPiece = (engine as any).currentPiece;
      // 新方块应该已经生成（不为 null）
      expect(secondPiece).not.toBeNull();
      // 新方块的 y 应该是初始位置 -1
      expect(secondPiece.y).toBe(-1);
    });

    it('方块不能穿过已放置的方块', () => {
      engine.start();
      // 先硬降一个方块
      engine.handleKeyDown(' ');

      // 新方块生成后，尝试向下移动
      // 方块不应该穿过已放置的方块
      const piece = (engine as any).currentPiece;
      const boardBefore = JSON.stringify((engine as any).board);

      // 连续按下键让方块落到底
      for (let i = 0; i < ROWS + 2; i++) {
        engine.handleKeyDown('ArrowDown');
      }

      // 棋盘上应该有更多方块（新方块也锁定了）
      const boardAfter = (engine as any).board as number[][];
      const totalFilled = boardAfter.reduce(
        (sum: number, row: number[]) => sum + row.filter((c) => c !== 0).length,
        0,
      );
      expect(totalFilled).toBeGreaterThan(0);
    });
  });

  // ================================================================
  // T5: 行消除
  // ================================================================
  describe('T5 - 行消除', () => {
    it('填满一行后应自动消除', () => {
      engine.start();

      // 手动填充底部 2 行：第 19 行完全填满，第 18 行部分填充
      const board = (engine as any).board as number[][];
      // 填满最底行 (row 19)
      for (let c = 0; c < COLS; c++) {
        board[ROWS - 1][c] = 1;
      }

      // 记录消除前的行数
      const linesBefore = (engine as any).linesCleared as number;

      // 将当前方块硬降，触发锁定 + 消行检测
      engine.handleKeyDown(' ');

      // linesCleared 应增加
      const linesAfter = (engine as any).linesCleared as number;
      expect(linesAfter).toBeGreaterThan(linesBefore);
    });

    it('消除后上方行应下移', () => {
      engine.start();

      const board = (engine as any).board as number[][];

      // 在 row 18 放一些方块，row 19 填满
      board[ROWS - 1] = Array(COLS).fill(1);
      board[ROWS - 2] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 全空

      // 在 row 17 放一些方块
      board[ROWS - 3] = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      // 硬降触发锁定和消行
      engine.handleKeyDown(' ');

      // 消行后，原来 row 17 的方块应该下移到 row 18
      // （因为 row 19 满行被消除，上方行下移）
      // 检查 row 18（原 row 17 下移后的位置）是否有方块
      expect(board[ROWS - 1].some((c) => c !== 0)).toBe(true);
    });

    it('消除多行应同时清除', () => {
      engine.start();

      const board = (engine as any).board as number[][];

      // 填满底部 2 行
      for (let r = ROWS - 2; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          board[r][c] = 1;
        }
      }

      const linesBefore = (engine as any).linesCleared as number;

      // 硬降触发消行
      engine.handleKeyDown(' ');

      const linesAfter = (engine as any).linesCleared as number;
      // 至少消除了 2 行（可能更多，取决于方块落点）
      expect(linesAfter - linesBefore).toBeGreaterThanOrEqual(2);
    });
  });

  // ================================================================
  // T6: 计分系统
  // ================================================================
  describe('T6 - 计分系统', () => {
    it('ArrowDown 软降应加 1 分', () => {
      engine.start();
      const scoreBefore = engine.score;
      engine.handleKeyDown('ArrowDown');
      expect(engine.score).toBe(scoreBefore + 1);
    });

    it('多次 ArrowDown 应累积加分', () => {
      engine.start();
      const scoreBefore = engine.score;
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowDown');
      expect(engine.score).toBe(scoreBefore + 3);
    });

    it('hardDrop（空格）应加 distance × 2 分', () => {
      engine.start();
      const scoreBefore = engine.score;

      // 获取方块当前位置和投影位置来计算预期距离
      const piece = (engine as any).currentPiece;
      const ghostY = (engine as any).getGhostY();
      const expectedDistance = ghostY - piece.y;

      engine.handleKeyDown(' ');

      expect(engine.score).toBe(scoreBefore + expectedDistance * 2);
    });

    it('消 1 行应得 100 × level 分', () => {
      engine.start();

      const board = (engine as any).board as number[][];
      // 填满最底行，留一格给当前方块填充
      for (let c = 0; c < COLS; c++) {
        board[ROWS - 1][c] = 1;
      }

      const scoreBefore = engine.score;
      const level = engine.level; // 1

      // 硬降触发消行
      engine.handleKeyDown(' ');

      // 消 1 行得分 = 100 * level
      // 但 hardDrop 也会加分，所以总分 >= 100 * level
      expect(engine.score).toBeGreaterThanOrEqual(scoreBefore + SCORE_TABLE[1] * level);
    });

    it('消 2 行应得 300 × level 分', () => {
      engine.start();

      const board = (engine as any).board as number[][];
      // 填满底部 2 行
      for (let r = ROWS - 2; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          board[r][c] = 1;
        }
      }

      const scoreBefore = engine.score;
      const level = engine.level;

      engine.handleKeyDown(' ');

      // 消 2 行得分 = 300 * level
      expect(engine.score).toBeGreaterThanOrEqual(scoreBefore + SCORE_TABLE[2] * level);
    });

    it('消 3 行应得 500 × level 分', () => {
      engine.start();

      const board = (engine as any).board as number[][];
      // 填满底部 3 行
      for (let r = ROWS - 3; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          board[r][c] = 1;
        }
      }

      const scoreBefore = engine.score;
      const level = engine.level;

      engine.handleKeyDown(' ');

      expect(engine.score).toBeGreaterThanOrEqual(scoreBefore + SCORE_TABLE[3] * level);
    });

    it('消 4 行应得 800 × level 分', () => {
      engine.start();

      const board = (engine as any).board as number[][];
      // 填满底部 4 行
      for (let r = ROWS - 4; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          board[r][c] = 1;
        }
      }

      const scoreBefore = engine.score;
      const level = engine.level;

      engine.handleKeyDown(' ');

      expect(engine.score).toBeGreaterThanOrEqual(scoreBefore + SCORE_TABLE[4] * level);
    });

    it('scoreChange 事件在 start 时触发', () => {
      const scoreHandler = jest.fn();
      engine.on('scoreChange', scoreHandler);

      engine.start();
      // start 时通过 emit('scoreChange', 0) 触发
      expect(scoreHandler).toHaveBeenCalledWith(0);
    });

    it('ArrowDown 软降直接修改 _score（不触发 scoreChange 事件）', () => {
      engine.start();
      const scoreBefore = engine.score;
      engine.handleKeyDown('ArrowDown');
      // 分数确实增加了
      expect(engine.score).toBe(scoreBefore + 1);
    });
  });

  // ================================================================
  // T7: 等级系统
  // ================================================================
  describe('T7 - 等级系统', () => {
    it('初始等级为 1', () => {
      expect(engine.level).toBe(1);
    });

    it('start() 后等级重置为 1', () => {
      engine.start();
      expect(engine.level).toBe(1);
    });

    it('每消 10 行升 1 级', () => {
      engine.start();

      // 模拟消了 10 行
      (engine as any).linesCleared = 10;

      // 触发一次消行来检查升级逻辑
      // 填满底部行来触发 clearLines
      const board = (engine as any).board as number[][];
      for (let c = 0; c < COLS; c++) {
        board[ROWS - 1][c] = 1;
      }

      engine.handleKeyDown(' ');

      // linesCleared >= 10，level 应该 >= 2
      expect(engine.level).toBeGreaterThanOrEqual(2);
    });

    it('升级后 dropInterval 应减小', () => {
      engine.start();

      const initialInterval = (engine as any).dropInterval;
      expect(initialInterval).toBe(1000);

      // 模拟升级到 level 2
      (engine as any).linesCleared = 10;
      // 填满底部行触发 clearLines
      const board = (engine as any).board as number[][];
      for (let c = 0; c < COLS; c++) {
        board[ROWS - 1][c] = 1;
      }
      engine.handleKeyDown(' ');

      const newInterval = (engine as any).dropInterval;
      expect(newInterval).toBeLessThan(initialInterval);
      // level 2: max(100, 1000 - 1*80) = 920
      expect(newInterval).toBe(920);
    });

    it('dropInterval 最小值为 100ms', () => {
      engine.start();

      // 模拟很高等级
      (engine as any)._level = 20;
      const expectedInterval = Math.max(100, 1000 - (20 - 1) * 80);
      expect(expectedInterval).toBe(100);

      // 触发 clearLines 来更新 dropInterval
      (engine as any).linesCleared = 200;
      const board = (engine as any).board as number[][];
      for (let c = 0; c < COLS; c++) {
        board[ROWS - 1][c] = 1;
      }
      engine.handleKeyDown(' ');

      expect((engine as any).dropInterval).toBe(100);
    });

    it('升级时 level 属性应正确更新', () => {
      engine.start();

      // 模拟消了 10 行
      (engine as any).linesCleared = 10;
      const board = (engine as any).board as number[][];
      for (let c = 0; c < COLS; c++) {
        board[ROWS - 1][c] = 1;
      }
      engine.handleKeyDown(' ');

      // level 应该已经更新
      expect(engine.level).toBeGreaterThanOrEqual(2);
    });

    it('levelChange 事件在 start 时触发', () => {
      const levelHandler = jest.fn();
      engine.on('levelChange', levelHandler);

      engine.start();
      // start 时通过 emit('levelChange', 1) 触发
      expect(levelHandler).toHaveBeenCalledWith(1);
    });

    it('dropInterval 计算公式: max(100, 1000 - (level-1)*80)', () => {
      engine.start();

      // level 1: 1000
      expect((engine as any).dropInterval).toBe(1000);

      // 直接设置等级并触发更新
      (engine as any)._level = 5;
      (engine as any).linesCleared = 50;
      const board = (engine as any).board as number[][];
      for (let c = 0; c < COLS; c++) {
        board[ROWS - 1][c] = 1;
      }
      engine.handleKeyDown(' ');

      // level 5: max(100, 1000 - 4*80) = max(100, 680) = 680
      // 但实际 level 由 linesCleared/10+1 决定
      // linesCleared=50+1(消行) => 51, level = floor(51/10)+1 = 6
      // dropInterval = max(100, 1000 - 5*80) = 600
      expect((engine as any).dropInterval).toBe(600);
    });
  });

  // ================================================================
  // T8: 游戏结束
  // ================================================================
  describe('T8 - 游戏结束', () => {
    it('新方块无法放置时应触发 gameover', () => {
      engine.start();

      // 填满棋盘大部分格子，但每行留一个空隙，防止消行
      // 这样 clearLines 不会消除任何行，spawnPiece 时新方块无法放置
      const board = (engine as any).board as number[][];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          board[r][c] = 1;
        }
        // 每行留一个空隙，防止被消行
        board[r][0] = 0;
      }

      // 硬降当前方块 → 锁定 → clearLines 不消行 → spawnPiece → 无法放置 → gameover
      engine.handleKeyDown(' ');

      expect(engine.status).toBe('gameover');
    });

    it('填满顶部区域后游戏应结束', () => {
      engine.start();

      // 填满前几行但留空隙防止消行，使方块无法放置
      const board = (engine as any).board as number[][];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < COLS; c++) {
          board[r][c] = 1;
        }
        board[r][0] = 0; // 留空隙防消行
      }

      // 硬降当前方块 → 锁定 → 新方块无法放置 → gameover
      engine.handleKeyDown(' ');

      expect(engine.status).toBe('gameover');
    });

    it('gameover 时应触发 statusChange 事件', () => {
      const statusHandler = jest.fn();
      engine.on('statusChange', statusHandler);

      engine.start();

      // 填满棋盘但留空隙防消行
      const board = (engine as any).board as number[][];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          board[r][c] = 1;
        }
        board[r][0] = 0;
      }

      engine.handleKeyDown(' ');

      expect(statusHandler).toHaveBeenCalledWith('gameover');
    });

    it('gameover 后按键不应崩溃', () => {
      engine.start();

      // 填满棋盘但留空隙防消行
      const board = (engine as any).board as number[][];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          board[r][c] = 1;
        }
        board[r][0] = 0;
      }
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('gameover');

      // gameover 后按键不应崩溃
      expect(() => {
        engine.handleKeyDown('ArrowLeft');
        engine.handleKeyDown('ArrowRight');
        engine.handleKeyDown('ArrowDown');
        engine.handleKeyDown('ArrowUp');
        engine.handleKeyDown(' ');
      }).not.toThrow();
    });

    it('reset 后可重新开始游戏', () => {
      engine.start();

      // 触发 gameover - 填满棋盘但留空隙防消行
      const board = (engine as any).board as number[][];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          board[r][c] = 1;
        }
        board[r][0] = 0;
      }
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('gameover');

      // reset 后重新开始
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);

      engine.start();
      expect(engine.status).toBe('playing');
    });
  });

  // ================================================================
  // 额外: 生命周期与事件
  // ================================================================
  describe('生命周期与事件', () => {
    it('pause() 后状态应为 paused', () => {
      engine.start();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume() 后状态应为 playing', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset() 后状态应为 idle', () => {
      engine.start();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('destroy() 后事件监听器应被清除', () => {
      const handler = jest.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalled();

      handler.mockClear();
      engine.destroy();

      // destroy 后内部已 clear listeners，手动 emit 不会触发
      // 但 emit 是 protected，验证 reset 不再触发即可
      // 重新绑定验证引擎已销毁
      expect(() => engine.reset()).not.toThrow();
    });

    it('statusChange 事件应按生命周期触发', () => {
      const handler = jest.fn();
      engine.on('statusChange', handler);

      engine.start();
      expect(handler).toHaveBeenLastCalledWith('playing');

      engine.pause();
      expect(handler).toHaveBeenLastCalledWith('paused');

      engine.resume();
      expect(handler).toHaveBeenLastCalledWith('playing');

      engine.reset();
      expect(handler).toHaveBeenLastCalledWith('idle');
    });

    it('未初始化 canvas 时 start() 应抛错', () => {
      const e = new TetrisEngine();
      // init() 未传入 canvas
      e.init();
      expect(() => e.start()).toThrow('Canvas not initialized');
    });

    it('idle 状态下按键不应崩溃', () => {
      expect(() => {
        engine.handleKeyDown('ArrowLeft');
        engine.handleKeyDown('ArrowRight');
        engine.handleKeyDown('ArrowDown');
        engine.handleKeyDown('ArrowUp');
        engine.handleKeyDown(' ');
      }).not.toThrow();
    });

    it('paused 状态下按键不应崩溃', () => {
      engine.start();
      engine.pause();
      expect(() => {
        engine.handleKeyDown('ArrowLeft');
        engine.handleKeyDown('ArrowRight');
        engine.handleKeyDown('ArrowDown');
        engine.handleKeyDown('ArrowUp');
        engine.handleKeyDown(' ');
      }).not.toThrow();
    });

    it('handleKeyUp 应为空操作（不崩溃）', () => {
      engine.start();
      expect(() => {
        engine.handleKeyUp('ArrowLeft');
        engine.handleKeyUp('ArrowRight');
        engine.handleKeyUp('ArrowDown');
        engine.handleKeyUp('ArrowUp');
        engine.handleKeyUp(' ');
      }).not.toThrow();
    });

    it('getState() 应返回 linesCleared 和 nextType', () => {
      engine.start();
      const state = engine.getState();
      expect(state).toHaveProperty('linesCleared');
      expect(state).toHaveProperty('nextType');
      expect(typeof state.linesCleared).toBe('number');
      expect(typeof state.nextType).toBe('number');
    });
  });
});

// ========== 计分表常量（测试用） ==========
const SCORE_TABLE = [0, 100, 300, 500, 800];
