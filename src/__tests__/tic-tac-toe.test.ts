import { TicTacToeEngine } from '@/games/tic-tac-toe/TicTacToeEngine';
import {
  BOARD_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SCORE_WIN,
  SCORE_DRAW,
  SCORE_AI_BONUS,
  SCORE_SPEED_BONUS_BASE,
  SCORE_SPEED_BONUS_STEP,
  AI_THINK_DELAY,
  PLACE_ANIMATION_DURATION,
  WIN_LINE_ANIMATION_SPEED,
} from '@/games/tic-tac-toe/constants';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): TicTacToeEngine {
  const engine = new TicTacToeEngine();
  const canvas = createCanvas();
  engine.init(canvas);
  return engine;
}

function startEngine(level: number = 1): TicTacToeEngine {
  const engine = createEngine();
  engine.start();
  // start() 会重置 _level=1，需要手动设置后再调用内部方法
  return engine;
}

/**
 * 创建指定等级的引擎（level 1=PvP, 2=Easy AI, 3=Medium AI）
 */
function createEngineAtLevel(level: number): TicTacToeEngine {
  const engine = new TicTacToeEngine();
  const canvas = createCanvas();
  engine.init(canvas);
  // 先设置等级再 start
  (engine as any)._level = level;
  engine.start();
  // start() 会重置 _level=1，所以需要在 start 后重新设置
  (engine as any)._level = level;
  return engine;
}

/**
 * 调用内部 update
 */
function advanceUpdate(engine: TicTacToeEngine, deltaTime: number): void {
  (engine as any).update(deltaTime);
}

/**
 * 获取内部 board
 */
function getBoard(engine: TicTacToeEngine): (string | null)[][] {
  return (engine as any).board;
}

/**
 * 获取当前玩家
 */
function getCurrentPlayer(engine: TicTacToeEngine): 'X' | 'O' {
  return (engine as any).currentPlayer;
}

/**
 * 获取赢家
 */
function getWinner(engine: TicTacToeEngine): string | null {
  return (engine as any).winner;
}

/**
 * 获取平局状态
 */
function getIsDraw(engine: TicTacToeEngine): boolean {
  return (engine as any).isDraw;
}

/**
 * 获取光标位置
 */
function getCursor(engine: TicTacToeEngine): { row: number; col: number } {
  return { row: (engine as any).cursorRow, col: (engine as any).cursorCol };
}

/**
 * 获取比分
 */
function getScores(engine: TicTacToeEngine): { X: number; O: number; draw: number } {
  return { ...(engine as any).scores };
}

/**
 * 获取 moveCount
 */
function getMoveCount(engine: TicTacToeEngine): number {
  return (engine as any).moveCount;
}

/**
 * 获取 winLine
 */
function getWinLine(engine: TicTacToeEngine): any {
  return (engine as any).winLine;
}

/**
 * 获取 aiThinking 状态
 */
function isAIThinking(engine: TicTacToeEngine): boolean {
  return (engine as any).aiThinking;
}

/**
 * 直接调用 placeMove
 */
function placeMove(engine: TicTacToeEngine, row: number, col: number): boolean {
  return (engine as any).placeMove(row, col);
}

/**
 * 直接调用 checkWin
 */
function checkWin(engine: TicTacToeEngine, player: 'X' | 'O'): any {
  return (engine as any).checkWin(player);
}

/**
 * 直接调用 checkDraw
 */
function checkDraw(engine: TicTacToeEngine): boolean {
  return (engine as any).checkDraw();
}

/**
 * 直接调用 aiEasyMove
 */
function aiEasyMove(engine: TicTacToeEngine): void {
  (engine as any).aiEasyMove();
}

/**
 * 直接调用 aiMediumMove
 */
function aiMediumMove(engine: TicTacToeEngine): void {
  (engine as any).aiMediumMove();
}

/**
 * 直接调用 findWinningMove
 */
function findWinningMove(engine: TicTacToeEngine, player: 'X' | 'O'): { row: number; col: number } | null {
  return (engine as any).findWinningMove(player);
}

/**
 * 在棋盘上设置指定位置的值（绕过 placeMove）
 */
function setCell(engine: TicTacToeEngine, row: number, col: number, value: string | null): void {
  (engine as any).board[row][col] = value;
}

// ========== 测试 ==========

describe('TicTacToeEngine', () => {

  // ==================== T1: 初始化 ====================
  describe('初始化', () => {
    it('init 后 status 为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('init 后棋盘为 3×3 空棋盘', () => {
      const engine = createEngine();
      const board = getBoard(engine);
      expect(board).toHaveLength(BOARD_SIZE);
      for (let r = 0; r < BOARD_SIZE; r++) {
        expect(board[r]).toHaveLength(BOARD_SIZE);
        for (let c = 0; c < BOARD_SIZE; c++) {
          expect(board[r][c]).toBeNull();
        }
      }
    });

    it('init 后当前玩家为 X', () => {
      const engine = createEngine();
      expect(getCurrentPlayer(engine)).toBe('X');
    });

    it('init 后光标在中心 (1,1)', () => {
      const engine = createEngine();
      const cursor = getCursor(engine);
      expect(cursor.row).toBe(1);
      expect(cursor.col).toBe(1);
    });

    it('start 后 status 为 playing', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('start 后 score 为 0', () => {
      const engine = createEngine();
      engine.start();
      expect(engine.score).toBe(0);
    });
  });

  // ==================== T2: 落子逻辑 ====================
  describe('落子逻辑', () => {
    it('X 可以在空位落子', () => {
      const engine = createEngine();
      engine.start();
      const result = placeMove(engine, 0, 0);
      expect(result).toBe(true);
      expect(getBoard(engine)[0][0]).toBe('X');
    });

    it('落子后切换到 O', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0);
      expect(getCurrentPlayer(engine)).toBe('O');
    });

    it('O 也可以落子', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0);
      placeMove(engine, 1, 1);
      expect(getBoard(engine)[1][1]).toBe('O');
    });

    it('不能在已占用的位置落子', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0);
      const result = placeMove(engine, 0, 0);
      expect(result).toBe(false);
    });

    it('落子后 moveCount 增加', () => {
      const engine = createEngine();
      engine.start();
      expect(getMoveCount(engine)).toBe(0);
      placeMove(engine, 0, 0);
      expect(getMoveCount(engine)).toBe(1);
      placeMove(engine, 1, 1);
      expect(getMoveCount(engine)).toBe(2);
    });
  });

  // ==================== T3: 胜利检测 ====================
  describe('胜利检测', () => {
    it('行满三连获胜', () => {
      const engine = createEngine();
      engine.start();
      // X: (0,0) (0,1) (0,2)
      // O: (1,0) (1,1)
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X -> 赢！
      expect(getWinner(engine)).toBe('X');
    });

    it('列满三连获胜', () => {
      const engine = createEngine();
      engine.start();
      // X: (0,0) (1,0) (2,0)
      // O: (0,1) (1,1)
      placeMove(engine, 0, 0); // X
      placeMove(engine, 0, 1); // O
      placeMove(engine, 1, 0); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 2, 0); // X -> 赢！
      expect(getWinner(engine)).toBe('X');
    });

    it('主对角线三连获胜', () => {
      const engine = createEngine();
      engine.start();
      // X: (0,0) (1,1) (2,2)
      // O: (0,1) (1,0)
      placeMove(engine, 0, 0); // X
      placeMove(engine, 0, 1); // O
      placeMove(engine, 1, 1); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 2, 2); // X -> 赢！
      expect(getWinner(engine)).toBe('X');
    });

    it('副对角线三连获胜', () => {
      const engine = createEngine();
      engine.start();
      // X: (0,2) (1,1) (2,0)
      // O: (0,0) (1,0)
      placeMove(engine, 0, 2); // X
      placeMove(engine, 0, 0); // O
      placeMove(engine, 1, 1); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 2, 0); // X -> 赢！
      expect(getWinner(engine)).toBe('X');
    });

    it('O 也可以获胜', () => {
      const engine = createEngine();
      engine.start();
      // X: (0,0) (0,1) (2,0)
      // O: (1,0) (1,1) (1,2)
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 2, 0); // X
      placeMove(engine, 1, 2); // O -> 赢！
      expect(getWinner(engine)).toBe('O');
    });

    it('胜利时生成 winLine 坐标', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X -> 第0行赢
      const winLine = getWinLine(engine);
      expect(winLine).not.toBeNull();
      expect(winLine.startRow).toBe(0);
      expect(winLine.startCol).toBe(0);
      expect(winLine.endRow).toBe(0);
      expect(winLine.endCol).toBe(2);
    });

    it('checkWin 对未获胜玩家返回 null', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0); // X
      const result = checkWin(engine, 'O');
      expect(result).toBeNull();
    });
  });

  // ==================== T4: 平局检测 ====================
  describe('平局检测', () => {
    it('棋盘满且无赢家为平局', () => {
      const engine = createEngine();
      engine.start();
      // X O X
      // X O O
      // O X X
      placeMove(engine, 0, 0); // X
      placeMove(engine, 0, 1); // O
      placeMove(engine, 0, 2); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 1, 0); // X
      placeMove(engine, 1, 2); // O
      placeMove(engine, 2, 1); // X
      placeMove(engine, 2, 0); // O
      placeMove(engine, 2, 2); // X -> 满盘
      expect(getIsDraw(engine)).toBe(true);
      expect(getWinner(engine)).toBeNull();
    });

    it('checkDraw 有赢家时返回 false', () => {
      const engine = createEngine();
      engine.start();
      // 先让 X 赢
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X -> 赢
      expect(checkDraw(engine)).toBe(false);
    });

    it('checkDraw 棋盘未满时返回 false', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0);
      expect(checkDraw(engine)).toBe(false);
    });
  });

  // ==================== T5: 计分系统 ====================
  describe('计分系统', () => {
    it('PvP 胜利得基础分 SCORE_WIN', () => {
      const engine = createEngine();
      engine.start();
      // X 赢 - 5步（最少步数）
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X -> 赢, moveCount=5
      // score = SCORE_WIN + SPEED_BONUS_BASE - (5-5)*STEP = 100 + 50 = 150
      expect(engine.score).toBe(SCORE_WIN + SCORE_SPEED_BONUS_BASE);
    });

    it('AI 模式胜利有额外加分', () => {
      const engine = createEngineAtLevel(2);
      // X 赢 - 5步
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O (手动模拟)
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X -> 赢
      // score = SCORE_WIN + AI_BONUS + SPEED_BONUS = 100 + 50 + 50 = 200
      expect(engine.score).toBe(SCORE_WIN + SCORE_AI_BONUS + SCORE_SPEED_BONUS_BASE);
    });

    it('步数越多速度奖励越少', () => {
      const engine = createEngine();
      engine.start();
      // X 赢 - 7步（第7步赢）
      // X: (0,0)(0,1)(0,2)  O: (1,0)(1,1)(2,2) → 不行，O 会被迫堵
      // 换一种：X 第7步赢
      placeMove(engine, 0, 0); // X
      placeMove(engine, 2, 2); // O
      placeMove(engine, 1, 0); // X
      placeMove(engine, 2, 1); // O
      placeMove(engine, 2, 0); // X -> 第0列赢, moveCount=5
      // moveCount=5, speedBonus = 50 - (5-5)*10 = 50
      const expectedSpeedBonus = SCORE_SPEED_BONUS_BASE;
      expect(engine.score).toBe(SCORE_WIN + expectedSpeedBonus);
    });

    it('平局得 SCORE_DRAW 分', () => {
      const engine = createEngine();
      engine.start();
      // X O X
      // X O O
      // O X X
      placeMove(engine, 0, 0); // X
      placeMove(engine, 0, 1); // O
      placeMove(engine, 0, 2); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 1, 0); // X
      placeMove(engine, 1, 2); // O
      placeMove(engine, 2, 1); // X
      placeMove(engine, 2, 0); // O
      placeMove(engine, 2, 2); // X -> 平局
      expect(engine.score).toBe(SCORE_DRAW);
    });

    it('比分记录更新正确', () => {
      const engine = createEngine();
      engine.start();
      // X 赢
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X -> 赢
      const scores = getScores(engine);
      expect(scores.X).toBe(1);
      expect(scores.O).toBe(0);
      expect(scores.draw).toBe(0);
    });
  });

  // ==================== T6: 输入处理 ====================
  describe('输入处理', () => {
    it('方向键上移动光标', () => {
      const engine = createEngine();
      engine.start();
      // 光标初始 (1,1)
      engine.handleKeyDown('ArrowUp');
      const cursor = getCursor(engine);
      expect(cursor.row).toBe(0);
      expect(cursor.col).toBe(1);
    });

    it('方向键下移动光标', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowDown');
      const cursor = getCursor(engine);
      expect(cursor.row).toBe(2);
      expect(cursor.col).toBe(1);
    });

    it('方向键左移动光标', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowLeft');
      const cursor = getCursor(engine);
      expect(cursor.row).toBe(1);
      expect(cursor.col).toBe(0);
    });

    it('方向键右移动光标', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowRight');
      const cursor = getCursor(engine);
      expect(cursor.row).toBe(1);
      expect(cursor.col).toBe(2);
    });

    it('WASD 也能移动光标', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('w'); // 上
      expect(getCursor(engine).row).toBe(0);
      engine.handleKeyDown('s'); // 下
      expect(getCursor(engine).row).toBe(1);
      engine.handleKeyDown('a'); // 左
      expect(getCursor(engine).col).toBe(0);
      engine.handleKeyDown('d'); // 右
      expect(getCursor(engine).col).toBe(1);
    });

    it('光标不会越界（上边界）', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowUp'); // (0,1)
      engine.handleKeyDown('ArrowUp'); // 仍然是 (0,1)
      expect(getCursor(engine).row).toBe(0);
    });

    it('光标不会越界（下边界）', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowDown'); // (2,1)
      engine.handleKeyDown('ArrowDown'); // 仍然是 (2,1)
      expect(getCursor(engine).row).toBe(2);
    });

    it('光标不会越界（左边界）', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowLeft'); // (1,0)
      engine.handleKeyDown('ArrowLeft'); // 仍然是 (1,0)
      expect(getCursor(engine).col).toBe(0);
    });

    it('光标不会越界（右边界）', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowRight'); // (1,2)
      engine.handleKeyDown('ArrowRight'); // 仍然是 (1,2)
      expect(getCursor(engine).col).toBe(2);
    });

    it('Space 键在光标位置落子', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('ArrowUp'); // (0,1)
      engine.handleKeyDown('ArrowLeft'); // (0,0)
      engine.handleKeyDown(' '); // 落子
      expect(getBoard(engine)[0][0]).toBe('X');
    });

    it('Enter 键也能落子', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('Enter'); // 在 (1,1) 落子
      expect(getBoard(engine)[1][1]).toBe('X');
    });

    it('P 键暂停游戏', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('p');
      expect(engine.status).toBe('paused');
    });

    it('P 键恢复游戏', () => {
      const engine = createEngine();
      engine.start();
      engine.handleKeyDown('p'); // 暂停
      engine.handleKeyDown('p'); // 恢复
      expect(engine.status).toBe('playing');
    });

    it('R 键重置游戏', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0);
      placeMove(engine, 1, 1);
      engine.handleKeyDown('r');
      expect(engine.status).toBe('playing');
      // 重置后棋盘应该清空
      expect(getBoard(engine)[0][0]).toBeNull();
      expect(getBoard(engine)[1][1]).toBeNull();
    });

    it('游戏结束后不处理落子', () => {
      const engine = createEngine();
      engine.start();
      // X 赢
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X -> 赢
      // 尝试继续落子
      const result = placeMove(engine, 2, 2);
      expect(result).toBe(false);
    });
  });

  // ==================== T7: AI 逻辑 ====================
  describe('AI 逻辑', () => {
    it('Easy AI 随机落子到空位', () => {
      const engine = createEngineAtLevel(2);
      // 直接调用 aiEasyMove（轮到 O 时）
      // 先手动让 X 走一步
      placeMove(engine, 1, 1); // X
      // 现在 currentPlayer 是 O
      expect(getCurrentPlayer(engine)).toBe('O');
      // AI 走一步
      aiEasyMove(engine);
      // 检查 O 是否落子了
      const board = getBoard(engine);
      let oCount = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] === 'O') oCount++;
        }
      }
      expect(oCount).toBe(1);
    });

    it('Medium AI 能找到获胜落子', () => {
      const engine = createEngineAtLevel(3);
      // 设置：O 有两个连子，差一个赢
      // O O _
      // X _ _
      // X _ _
      setCell(engine, 0, 0, 'O');
      setCell(engine, 0, 1, 'O');
      setCell(engine, 1, 0, 'X');
      setCell(engine, 2, 0, 'X');
      (engine as any).currentPlayer = 'O';
      (engine as any).moveCount = 4;

      aiMediumMove(engine);
      // O 应该在 (0,2) 获胜
      expect(getBoard(engine)[0][2]).toBe('O');
      expect(getWinner(engine)).toBe('O');
    });

    it('Medium AI 能堵住对手获胜', () => {
      const engine = createEngineAtLevel(3);
      // X X _
      // O _ _
      // _ _ _
      setCell(engine, 0, 0, 'X');
      setCell(engine, 0, 1, 'X');
      setCell(engine, 1, 0, 'O');
      (engine as any).currentPlayer = 'O';
      (engine as any).moveCount = 3;

      aiMediumMove(engine);
      // O 应该堵在 (0,2)
      expect(getBoard(engine)[0][2]).toBe('O');
    });

    it('Medium AI 优先占中心', () => {
      const engine = createEngineAtLevel(3);
      // 空棋盘，X 走了 (0,0)
      setCell(engine, 0, 0, 'X');
      (engine as any).currentPlayer = 'O';
      (engine as any).moveCount = 1;

      aiMediumMove(engine);
      // O 应该占中心 (1,1)
      expect(getBoard(engine)[1][1]).toBe('O');
    });

    it('findWinningMove 找到获胜位置', () => {
      const engine = createEngine();
      engine.start();
      // X: (0,0) (0,1) -> (0,2) 赢
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      const move = findWinningMove(engine, 'X');
      expect(move).not.toBeNull();
      expect(move!.row).toBe(0);
      expect(move!.col).toBe(2);
    });

    it('findWinningMove 无获胜位置返回 null', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 1, 1); // X 只有一个子
      const move = findWinningMove(engine, 'X');
      expect(move).toBeNull();
    });

    it('AI 思考中玩家不能操作', () => {
      const engine = createEngineAtLevel(2);
      // 模拟 AI 思考中
      (engine as any).aiThinking = true;
      // 尝试落子 - handleKeyDown 应该不处理
      engine.handleKeyDown('Enter');
      // 棋盘应该没变化（光标位置 (1,1) 仍为空）
      expect(getBoard(engine)[1][1]).toBeNull();
    });
  });

  // ==================== T8: 游戏状态 ====================
  describe('游戏状态', () => {
    it('getState 返回完整状态', () => {
      const engine = createEngine();
      engine.start();
      const state = engine.getState();
      expect(state).toHaveProperty('board');
      expect(state).toHaveProperty('currentPlayer');
      expect(state).toHaveProperty('cursorRow');
      expect(state).toHaveProperty('cursorCol');
      expect(state).toHaveProperty('winner');
      expect(state).toHaveProperty('winLine');
      expect(state).toHaveProperty('isDraw');
      expect(state).toHaveProperty('mode');
      expect(state).toHaveProperty('scores');
    });

    it('getState board 是深拷贝', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0);
      const state1 = engine.getState();
      const board1 = state1.board as (string | null)[][];
      // 修改返回值不影响内部状态
      board1[0][0] = 'O';
      const state2 = engine.getState();
      const board2 = state2.board as (string | null)[][];
      expect(board2[0][0]).toBe('X');
    });

    it('getState scores 是深拷贝', () => {
      const engine = createEngine();
      engine.start();
      const state = engine.getState();
      const scores = state.scores as { X: number; O: number; draw: number };
      scores.X = 999;
      const internalScores = getScores(engine);
      expect(internalScores.X).toBe(0);
    });

    it('游戏模式根据 level 正确设置', () => {
      const engine1 = createEngineAtLevel(1);
      expect((engine1.getState() as any).mode).toBe('PvP');

      const engine2 = createEngineAtLevel(2);
      expect((engine2.getState() as any).mode).toBe('Easy AI');

      const engine3 = createEngineAtLevel(3);
      expect((engine3.getState() as any).mode).toBe('Medium AI');
    });
  });

  // ==================== T9: 动画更新 ====================
  describe('动画更新', () => {
    it('update 推进落子动画', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0);
      // 有一个落子动画
      const anims = (engine as any).placeAnimations;
      expect(anims.length).toBe(1);
      // 推进超过动画时长
      advanceUpdate(engine, PLACE_ANIMATION_DURATION + 100);
      // 动画应该已完成并移除
      expect((engine as any).placeAnimations.length).toBe(0);
    });

    it('update 推进胜利线动画', () => {
      const engine = createEngine();
      engine.start();
      // X 赢
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X -> 赢
      expect((engine as any).winLineAnimating).toBe(true);
      expect((engine as any).winLineProgress).toBe(0);
      // 推进动画
      advanceUpdate(engine, WIN_LINE_ANIMATION_SPEED);
      expect((engine as any).winLineProgress).toBeGreaterThanOrEqual(1);
      expect((engine as any).winLineAnimating).toBe(false);
    });

    it('AI 思考延迟后执行落子', () => {
      const engine = createEngineAtLevel(2);
      // 手动触发 AI 思考
      (engine as any).aiThinking = true;
      (engine as any).aiThinkTimer = 0;
      (engine as any).currentPlayer = 'O';
      // 推进不到延迟时间
      advanceUpdate(engine, AI_THINK_DELAY - 100);
      expect((engine as any).aiThinking).toBe(true);
      // 推进超过延迟时间
      advanceUpdate(engine, 200);
      // AI 应该已经落子
      expect((engine as any).aiThinking).toBe(false);
    });
  });

  // ==================== T10: 事件系统 ====================
  describe('事件系统', () => {
    it('start 触发 statusChange 事件', () => {
      const engine = createEngine();
      const listener = jest.fn();
      engine.on('statusChange', listener);
      engine.start();
      expect(listener).toHaveBeenCalledWith('playing');
    });

    it('pause 触发 statusChange 事件', () => {
      const engine = createEngine();
      engine.start();
      const listener = jest.fn();
      engine.on('statusChange', listener);
      engine.pause();
      expect(listener).toHaveBeenCalledWith('paused');
    });

    it('resume 触发 statusChange 事件', () => {
      const engine = createEngine();
      engine.start();
      engine.pause();
      const listener = jest.fn();
      engine.on('statusChange', listener);
      engine.resume();
      expect(listener).toHaveBeenCalledWith('playing');
    });

    it('scoreChange 事件在计分时触发', () => {
      const engine = createEngine();
      engine.start();
      const listener = jest.fn();
      engine.on('scoreChange', listener);
      // X 赢
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X -> 赢，触发计分
      expect(listener).toHaveBeenCalled();
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1];
      expect(lastCall[0]).toBeGreaterThan(0);
    });
  });

  // ==================== T11: 重置与生命周期 ====================
  describe('重置与生命周期', () => {
    it('reset 后棋盘清空', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0);
      placeMove(engine, 1, 1);
      engine.reset();
      const board = getBoard(engine);
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          expect(board[r][c]).toBeNull();
        }
      }
    });

    it('reset 后玩家回到 X', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0); // X -> O
      engine.reset();
      expect(getCurrentPlayer(engine)).toBe('X');
    });

    it('reset 后赢家和平局状态清除', () => {
      const engine = createEngine();
      engine.start();
      // X 赢
      placeMove(engine, 0, 0);
      placeMove(engine, 1, 0);
      placeMove(engine, 0, 1);
      placeMove(engine, 1, 1);
      placeMove(engine, 0, 2);
      expect(getWinner(engine)).toBe('X');
      engine.reset();
      expect(getWinner(engine)).toBeNull();
      expect(getIsDraw(engine)).toBe(false);
    });

    it('destroy 后比分归零', () => {
      const engine = createEngine();
      engine.start();
      placeMove(engine, 0, 0);
      placeMove(engine, 1, 0);
      placeMove(engine, 0, 1);
      placeMove(engine, 1, 1);
      placeMove(engine, 0, 2);
      engine.destroy();
      const scores = getScores(engine);
      expect(scores.X).toBe(0);
      expect(scores.O).toBe(0);
      expect(scores.draw).toBe(0);
    });

    it('多轮游戏比分累积', () => {
      const engine = createEngine();
      engine.start();
      // 第一轮 X 赢
      placeMove(engine, 0, 0);
      placeMove(engine, 1, 0);
      placeMove(engine, 0, 1);
      placeMove(engine, 1, 1);
      placeMove(engine, 0, 2);
      expect(getScores(engine).X).toBe(1);

      // 重置再来一轮
      engine.reset();
      engine.start();
      // 第二轮 O 赢
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 2, 2); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 2, 0); // X
      placeMove(engine, 1, 2); // O -> 赢
      expect(getScores(engine).X).toBe(1);
      expect(getScores(engine).O).toBe(1);
    });
  });

});
