import { CheckersEngine } from '@/games/checkers/CheckersEngine';
import {
  EMPTY, RED, BLACK, RED_KING, BLACK_KING,
  BOARD_SIZE, CELL_SIZE, BOARD_OFFSET_X, BOARD_OFFSET_Y,
} from '@/games/checkers/constants';

// ========== Mock Canvas ==========
function createMockCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 480;
  const ctx = {
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    clearRect: jest.fn(),
    fillText: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    set fillStyle(_v: string) {},
    get fillStyle() { return ''; },
    set strokeStyle(_v: string) {},
    get strokeStyle() { return ''; },
    set lineWidth(_v: number) {},
    get lineWidth() { return 1; },
    set font(_v: string) {},
    get font() { return ''; },
    set textAlign(_v: CanvasTextAlign) {},
    get textAlign() { return 'start' as CanvasTextAlign; },
    set textBaseline(_v: CanvasTextBaseline) {},
    get textBaseline() { return 'alphabetic' as CanvasTextBaseline; },
  };
  jest.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return { canvas, ctx };
}

function createEngine(): CheckersEngine {
  const engine = new CheckersEngine();
  const { canvas } = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

// 坐标转换
function cellToCanvas(row: number, col: number) {
  return {
    x: BOARD_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2,
    y: BOARD_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

// ========== Tests ==========

describe('CheckersEngine', () => {

  // ========== 初始化 ==========
  describe('初始化', () => {
    let engine: CheckersEngine;

    beforeEach(() => {
      engine = createEngine();
    });

    it('应该正确初始化棋盘大小', () => {
      expect((engine as any)._board.length).toBe(8);
      for (let r = 0; r < 8; r++) {
        expect((engine as any)._board[r].length).toBe(8);
      }
    });

    it('应该有 24 个棋子（红 12 + 黑 12）', () => {
      let total = 0;
      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] !== EMPTY) total++;
        }
      }
      expect(total).toBe(24);
    });

    it('红方应该有 12 个棋子', () => {
      expect(engine.redCount).toBe(12);
    });

    it('黑方应该有 12 个棋子', () => {
      expect(engine.blackCount).toBe(12);
    });

    it('初始状态为 idle', () => {
      expect(engine.status).toBe('idle');
    });

    it('红方先手', () => {
      expect(engine.currentPlayer).toBe(RED);
    });

    it('游戏未结束', () => {
      expect(engine.isGameOver).toBe(false);
    });

    it('初始分数为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('初始没有选中棋子', () => {
      expect(engine.selectedPiece).toBeNull();
    });

    it('棋子只在深色格子上', () => {
      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if ((r + c) % 2 === 0) {
            expect(board[r][c]).toBe(EMPTY);
          }
        }
      }
    });

    it('黑方棋子在前 3 行（0-2）', () => {
      const board = (engine as any)._board as number[][];
      let blackInTop = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] === BLACK) blackInTop++;
        }
      }
      expect(blackInTop).toBe(12);
    });

    it('红方棋子在后 3 行（5-7）', () => {
      const board = (engine as any)._board as number[][];
      let redInBottom = 0;
      for (let r = 5; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] === RED) redInBottom++;
        }
      }
      expect(redInBottom).toBe(12);
    });

    it('中间两行（3-4）没有棋子', () => {
      const board = (engine as any)._board as number[][];
      for (let r = 3; r <= 4; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          expect(board[r][c]).toBe(EMPTY);
        }
      }
    });
  });

  // ========== 棋子选择 ==========
  describe('棋子选择', () => {
    let engine: CheckersEngine;

    beforeEach(() => {
      engine = createEngine();
    });

    it('可以选择自己的红方棋子', () => {
      const result = engine.selectPiece(5, 0);
      expect(result).toBe(true);
      expect(engine.selectedPiece).toEqual({ row: 5, col: 0 });
    });

    it('不能选择空格', () => {
      const result = engine.selectPiece(4, 0);
      expect(result).toBe(false);
      expect(engine.selectedPiece).toBeNull();
    });

    it('不能选择对手的棋子', () => {
      const result = engine.selectPiece(0, 1);
      expect(result).toBe(false);
    });

    it('选择棋子后应该有合法移动', () => {
      engine.selectPiece(5, 0);
      expect(engine.validMoves.length).toBeGreaterThan(0);
    });

    it('点击画布可以选择棋子', () => {
      const pos = cellToCanvas(5, 0);
      engine.handleClick(pos.x, pos.y);
      expect(engine.selectedPiece).toEqual({ row: 5, col: 0 });
    });

    it('点击对手棋子不选择', () => {
      const pos = cellToCanvas(0, 1);
      engine.handleClick(pos.x, pos.y);
      expect(engine.selectedPiece).toBeNull();
    });
  });

  // ========== 棋子移动 ==========
  describe('棋子移动', () => {
    let engine: CheckersEngine;

    beforeEach(() => {
      engine = createEngine();
    });

    it('红方棋子可以向前对角线移动', () => {
      engine.selectPiece(5, 0);
      const moves = engine.validMoves;
      // 5,0 只能移动到 4,1
      expect(moves.length).toBe(1);
      expect(moves[0].to).toEqual({ row: 4, col: 1 });
    });

    it('执行移动后棋子位置更新', () => {
      engine.selectPiece(5, 0);
      const move = engine.validMoves[0];
      engine.executeMove(move);
      const board = (engine as any)._board as number[][];
      expect(board[5][0]).toBe(EMPTY);
      expect(board[4][1]).toBe(RED);
    });

    it('移动后切换到黑方', () => {
      engine.selectPiece(5, 0);
      const move = engine.validMoves[0];
      engine.executeMove(move);
      expect(engine.currentPlayer).toBe(BLACK);
    });

    it('点击目标位置执行移动', () => {
      const fromPos = cellToCanvas(5, 0);
      engine.handleClick(fromPos.x, fromPos.y);
      expect(engine.selectedPiece).toEqual({ row: 5, col: 0 });

      const toPos = cellToCanvas(4, 1);
      engine.handleClick(toPos.x, toPos.y);

      const board = (engine as any)._board as number[][];
      expect(board[4][1]).toBe(RED);
      expect(board[5][0]).toBe(EMPTY);
    });

    it('不能移动到被占用的格子', () => {
      const board = (engine as any)._board as number[][];
      board[4][1] = RED; // 己方棋子阻挡路径（不会被吃子）
      engine.selectPiece(5, 0);
      const moves = engine.validMoves;
      expect(moves.length).toBe(0);
    });
  });

  // ========== 吃子 ==========
  describe('吃子', () => {
    it('可以跳过对手棋子吃子', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[5][2] = RED;
      board[4][3] = BLACK;

      engine.selectPiece(5, 2);
      const moves = engine.validMoves;
      const captureMove = moves.find(m => m.captures.length > 0);

      expect(captureMove).toBeDefined();
      expect(captureMove!.to).toEqual({ row: 3, col: 4 });
      expect(captureMove!.captures).toEqual([{ row: 4, col: 3 }]);
    });

    it('吃子后移除被吃棋子', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[5][2] = RED;
      board[4][3] = BLACK;

      engine.selectPiece(5, 2);
      const captureMove = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(captureMove);

      expect(board[4][3]).toBe(EMPTY);
      expect(board[3][4]).toBe(RED);
    });

    it('吃子后加分', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[5][2] = RED;
      board[4][3] = BLACK;

      engine.selectPiece(5, 2);
      const captureMove = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(captureMove);

      expect(engine.score).toBe(10);
    });

    it('有吃子时强制吃子', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;
      board[6][1] = BLACK;
      board[7][4] = RED;

      engine.selectPiece(7, 0);
      const moves = engine.validMoves;
      expect(moves.length).toBe(1);
      expect(moves[0].captures.length).toBe(1);
    });
  });

  // ========== 连跳 ==========
  describe('连跳', () => {
    it('吃子后可以继续连跳', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;
      board[6][1] = BLACK;
      board[4][3] = BLACK;

      engine.selectPiece(7, 0);
      const firstCapture = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(firstCapture);

      expect((engine as any)._mustCapture).toBe(true);
      expect(engine.validMoves.length).toBeGreaterThan(0);
    });

    it('连跳后不切换玩家', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;
      board[6][1] = BLACK;
      board[4][3] = BLACK;

      engine.selectPiece(7, 0);
      const firstCapture = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(firstCapture);

      expect(engine.currentPlayer).toBe(RED);
    });

    it('连跳结束后切换玩家', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;
      board[6][1] = BLACK;
      board[4][3] = BLACK;

      engine.selectPiece(7, 0);
      const firstCapture = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(firstCapture);

      if (engine.validMoves.length > 0) {
        const secondCapture = engine.validMoves[0];
        engine.executeMove(secondCapture);
        expect(engine.currentPlayer).toBe(BLACK);
      }
    });
  });

  // ========== 升变为王 ==========
  describe('升变为王', () => {
    it('红方到达第 0 行升变为王', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[1][2] = RED;

      engine.selectPiece(1, 2);
      const move = engine.validMoves[0];
      engine.executeMove(move);

      expect(board[0][1]).toBe(RED_KING);
    });

    it('黑方到达第 7 行升变为王', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      (engine as any)._currentPlayer = BLACK;
      board[6][1] = BLACK;

      engine.selectPiece(6, 1);
      const move = engine.validMoves[0];
      engine.executeMove(move);

      expect(board[7][0]).toBe(BLACK_KING);
    });

    it('升变后加 5 分', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[1][2] = RED;

      engine.selectPiece(1, 2);
      const move = engine.validMoves[0];
      engine.executeMove(move);

      expect(engine.score).toBe(5);
    });

    it('升变后不能继续连跳', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[2][0] = RED;
      board[1][1] = BLACK;

      engine.selectPiece(2, 0);
      const cap = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(cap);

      expect((engine as any)._mustCapture).toBe(false);
      expect(engine.currentPlayer).toBe(BLACK);
    });
  });

  // ========== 王的移动 ==========
  describe('王的移动', () => {
    it('红方王可以前后移动', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[4][3] = RED_KING;

      engine.selectPiece(4, 3);
      const moves = engine.validMoves;

      const destinations = moves.map(m => `${m.to.row},${m.to.col}`);
      expect(destinations).toContain('3,2');
      expect(destinations).toContain('3,4');
      expect(destinations).toContain('5,2');
      expect(destinations).toContain('5,4');
    });

    it('黑方王可以前后移动', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      (engine as any)._currentPlayer = BLACK;
      board[4][3] = BLACK_KING;

      engine.selectPiece(4, 3);
      const moves = engine.validMoves;

      const destinations = moves.map(m => `${m.to.row},${m.to.col}`);
      expect(destinations).toContain('3,2');
      expect(destinations).toContain('3,4');
      expect(destinations).toContain('5,2');
      expect(destinations).toContain('5,4');
    });

    it('王可以吃子', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[4][3] = RED_KING;
      board[3][2] = BLACK;

      engine.selectPiece(4, 3);
      const moves = engine.validMoves;
      const capture = moves.find(m => m.captures.length > 0);

      expect(capture).toBeDefined();
      expect(capture!.to).toEqual({ row: 2, col: 1 });
    });

    it('王可以向后吃子', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[4][3] = RED_KING;
      board[5][4] = BLACK;

      engine.selectPiece(4, 3);
      const moves = engine.validMoves;
      const capture = moves.find(m => m.captures.length > 0);

      expect(capture).toBeDefined();
      expect(capture!.to).toEqual({ row: 6, col: 5 });
    });
  });

  // ========== AI ==========
  describe('AI', () => {
    it('AI 默认启用', () => {
      const engine = createEngine();
      expect(engine.aiEnabled).toBe(true);
    });

    it('可以禁用 AI', () => {
      const engine = createEngine();
      engine.setAI(false);
      expect(engine.aiEnabled).toBe(false);
    });

    it('AI 在黑方回合自动走棋', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;
      board[0][1] = BLACK;
      board[0][3] = BLACK;

      (engine as any)._currentPlayer = RED;
      engine.selectPiece(7, 0);
      engine.executeMove(engine.validMoves[0]);

      expect(engine.currentPlayer).toBe(BLACK);

      (engine as any).aiMove();

      expect(engine.currentPlayer).toBe(RED);
    });

    it('AI 优先吃子', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[2][1] = BLACK;
      board[3][2] = RED;
      board[2][5] = BLACK;

      (engine as any)._currentPlayer = BLACK;
      (engine as any).aiMove();

      const redCaptured = board[3][2] === EMPTY;
      expect(redCaptured).toBe(true);
    });

    it('AI 无棋可走时游戏结束', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      // 黑棋在最后一行（向下方向越界），无合法移动
      board[7][0] = BLACK;
      board[0][7] = RED;

      (engine as any)._currentPlayer = BLACK;
      (engine as any)._redCount = 1;
      (engine as any)._blackCount = 1;
      (engine as any).aiMove();

      expect(engine.isGameOver).toBe(true);
    });
  });

  // ========== 游戏结束 ==========
  describe('游戏结束', () => {
    it('一方无子则输', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;
      (engine as any)._redCount = 1;
      (engine as any)._blackCount = 0;

      (engine as any).switchPlayer();
      expect(engine.isGameOver).toBe(true);
      expect(engine.winner).toBe(RED);
    });

    it('一方无合法移动则输', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      // 黑棋在最后一行（向下方向越界），红棋在第一行（向上方向越界）
      board[7][0] = BLACK;
      board[0][1] = RED;

      (engine as any)._currentPlayer = BLACK;
      (engine as any)._redCount = 1;
      (engine as any)._blackCount = 1;
      (engine as any).switchPlayer();
      // switchPlayer 后轮到红方，红棋在 (0,1) 向上越界，无合法移动 → 游戏结束
      expect(engine.isGameOver).toBe(true);
    });

    it('游戏结束后不能再移动', () => {
      const engine = createEngine();
      (engine as any)._gameOver = true;

      const pos = cellToCanvas(5, 0);
      engine.handleClick(pos.x, pos.y);
      expect(engine.selectedPiece).toBeNull();
    });

    it('红方胜利时 isWin 为 true', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;
      (engine as any)._redCount = 1;
      (engine as any)._blackCount = 0;
      (engine as any).switchPlayer();

      expect(engine.isWin).toBe(true);
      expect(engine.winner).toBe(RED);
    });

    it('黑方胜利时 isWin 为 false', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[0][1] = BLACK;
      (engine as any)._redCount = 0;
      (engine as any)._blackCount = 1;
      (engine as any).switchPlayer();

      expect(engine.isWin).toBe(false);
      expect(engine.winner).toBe(BLACK);
    });
  });

  // ========== 计分 ==========
  describe('计分', () => {
    it('吃一个子得 10 分', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[5][2] = RED;
      board[4][3] = BLACK;

      engine.selectPiece(5, 2);
      const cap = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(cap);

      expect(engine.score).toBe(10);
    });

    it('连跳吃两个子得 20 分', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;
      board[6][1] = BLACK;
      board[4][3] = BLACK;

      engine.selectPiece(7, 0);
      const firstCap = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(firstCap);

      if (engine.validMoves.length > 0) {
        const secondCap = engine.validMoves[0];
        engine.executeMove(secondCap);
      }

      expect(engine.score).toBe(20);
    });

    it('升变额外加 5 分', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[1][2] = RED;

      engine.selectPiece(1, 2);
      const move = engine.validMoves[0];
      engine.executeMove(move);

      expect(engine.score).toBe(5);
    });
  });

  // ========== 事件 ==========
  describe('事件', () => {
    it('切换玩家时触发 turnChange 事件', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[5][0] = RED;

      const handler = jest.fn();
      engine.on('turnChange', handler);

      engine.selectPiece(5, 0);
      engine.executeMove(engine.validMoves[0]);

      expect(handler).toHaveBeenCalledWith(BLACK);
    });

    it('吃子时触发 capture 事件', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[5][2] = RED;
      board[4][3] = BLACK;

      const handler = jest.fn();
      engine.on('capture', handler);

      engine.selectPiece(5, 2);
      const cap = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(cap);

      expect(handler).toHaveBeenCalled();
    });

    it('分数变化时触发 scoreChange 事件', () => {
      const engine = createEngine();
      const handler = jest.fn();
      engine.on('scoreChange', handler);

      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[5][2] = RED;
      board[4][3] = BLACK;

      engine.selectPiece(5, 2);
      const cap = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(cap);

      expect(handler).toHaveBeenCalledWith(10);
    });

    it('游戏结束时触发 statusChange 事件', () => {
      const engine = createEngine();
      const handler = jest.fn();
      engine.on('statusChange', handler);

      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;
      (engine as any)._redCount = 1;
      (engine as any)._blackCount = 0;
      (engine as any).switchPlayer();

      expect(handler).toHaveBeenCalledWith('gameover');
    });
  });

  // ========== 重置与生命周期 ==========
  describe('重置与生命周期', () => {
    it('重置后恢复初始状态', () => {
      const engine = createEngine();
      engine.selectPiece(5, 0);

      engine.reset();

      expect(engine.selectedPiece).toBeNull();
      expect(engine.isGameOver).toBe(false);
      expect(engine.currentPlayer).toBe(RED);
      expect(engine.redCount).toBe(12);
      expect(engine.blackCount).toBe(12);
      expect(engine.score).toBe(0);
    });

    it('getState 返回正确状态', () => {
      const engine = createEngine();
      const state = engine.getState();

      expect(state.score).toBe(0);
      expect(state.level).toBe(1);
      expect(state.board).toBeDefined();
      expect(state.currentPlayer).toBe(RED);
      expect(state.redCount).toBe(12);
      expect(state.blackCount).toBe(12);
      expect(state.isGameOver).toBe(false);
    });

    it('destroy 后清理状态', () => {
      const engine = createEngine();
      engine.selectPiece(5, 0);
      engine.destroy();

      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
    });
  });

  // ========== 边界情况 ==========
  describe('边界情况', () => {
    it('点击棋盘外不报错', () => {
      const engine = createEngine();
      expect(() => engine.handleClick(-10, -10)).not.toThrow();
      expect(() => engine.handleClick(500, 500)).not.toThrow();
    });

    it('不能移动到棋盘外', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;

      engine.selectPiece(7, 0);
      const moves = engine.validMoves;
      for (const m of moves) {
        expect(m.to.row).toBeGreaterThanOrEqual(0);
        expect(m.to.row).toBeLessThan(BOARD_SIZE);
        expect(m.to.col).toBeGreaterThanOrEqual(0);
        expect(m.to.col).toBeLessThan(BOARD_SIZE);
      }
    });

    it('连跳中不能选择其他棋子', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[7][0] = RED;
      board[6][1] = BLACK;
      board[4][3] = BLACK;
      board[7][4] = RED;

      engine.selectPiece(7, 0);
      const firstCap = engine.validMoves.find(m => m.captures.length > 0)!;
      engine.executeMove(firstCap);

      if ((engine as any)._mustCapture) {
        const otherPos = cellToCanvas(7, 4);
        engine.handleClick(otherPos.x, otherPos.y);
        expect(engine.selectedPiece).not.toEqual({ row: 7, col: 4 });
      }
    });

    it('普通红方棋子不能向后移动', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[4][3] = RED;

      engine.selectPiece(4, 3);
      const moves = engine.validMoves;

      for (const m of moves) {
        expect(m.to.row).toBeLessThan(4);
      }
    });

    it('普通黑方棋子不能向后移动', () => {
      const engine = createEngine();
      const board = (engine as any)._board as number[][];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      (engine as any)._currentPlayer = BLACK;
      board[3][2] = BLACK;

      engine.selectPiece(3, 2);
      const moves = engine.validMoves;

      for (const m of moves) {
        expect(m.to.row).toBeGreaterThan(3);
      }
    });
  });

  // ========== 常量验证 ==========
  describe('常量', () => {
    it('棋盘大小为 8', () => {
      expect(BOARD_SIZE).toBe(8);
    });

    it('红方值为 1', () => {
      expect(RED).toBe(1);
    });

    it('黑方值为 2', () => {
      expect(BLACK).toBe(2);
    });

    it('红王值为 3', () => {
      expect(RED_KING).toBe(3);
    });

    it('黑王值为 4', () => {
      expect(BLACK_KING).toBe(4);
    });

    it('空格值为 0', () => {
      expect(EMPTY).toBe(0);
    });
  });
});
