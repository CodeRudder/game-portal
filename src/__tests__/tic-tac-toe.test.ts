import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TicTacToeEngine } from '@/games/tic-tac-toe/TicTacToeEngine';
import {
  BOARD_SIZE,
  SCORE_WIN,
  SCORE_DRAW,
  SCORE_AI_BONUS,
  SCORE_SPEED_BONUS_BASE,
  SCORE_SPEED_BONUS_STEP,
  AI_THINK_DELAY,
  PLACE_ANIMATION_DURATION,
  WIN_LINE_ANIMATION_SPEED,
} from '@/games/tic-tac-toe/constants';

// ========== Helper Functions ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

function createEngine(level = 1): TicTacToeEngine {
  const engine = new TicTacToeEngine();
  engine.setLevel(level);
  engine.init(createCanvas());
  return engine;
}

function startEngine(level = 1): TicTacToeEngine {
  const engine = createEngine(level);
  engine.start();
  return engine;
}

/**
 * 在指定位置落子（直接调用私有方法 placeMove）
 */
function placeMove(engine: TicTacToeEngine, row: number, col: number): boolean {
  return (engine as any).placeMove(row, col);
}

/**
 * 设置棋盘到特定状态（直接写入 board 数组）
 */
function setBoard(engine: TicTacToeEngine, board: (string | null)[][]): void {
  (engine as any).board = board;
}

// ========== 测试 ==========

describe('TicTacToeEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // ================================================================
  // 1. 初始化
  // ================================================================
  describe('初始化', () => {
    it('引擎创建后 init() 前默认状态正确', () => {
      const engine = new TicTacToeEngine();
      // init 之前，board 尚未被初始化（空数组）
      expect((engine as any).board).toEqual([]);
      expect((engine as any).currentPlayer).toBe('X');
      expect((engine as any).cursorRow).toBe(1);
      expect((engine as any).cursorCol).toBe(1);
      expect((engine as any).winner).toBeNull();
      expect((engine as any).isDraw).toBe(false);
      expect((engine as any).moveCount).toBe(0);
    });

    it('init() 后棋盘初始化为 3x3 全 null', () => {
      const engine = createEngine();
      const board = (engine as any).board;
      expect(board).toHaveLength(BOARD_SIZE);
      for (let r = 0; r < BOARD_SIZE; r++) {
        expect(board[r]).toHaveLength(BOARD_SIZE);
        for (let c = 0; c < BOARD_SIZE; c++) {
          expect(board[r][c]).toBeNull();
        }
      }
    });

    it('start() 后状态正确（status=playing）', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
      expect((engine as any).currentPlayer).toBe('X');
      expect((engine as any).winner).toBeNull();
      expect((engine as any).isDraw).toBe(false);
      expect((engine as any).moveCount).toBe(0);
      // start() 重置 _level=1，所以 level 回到 1
      expect(engine.level).toBe(1);
    });

    it('getMode() 根据 level 返回正确模式', () => {
      const engine = createEngine();
      // level=1 → PvP
      engine.setLevel(1);
      expect((engine as any).getMode()).toBe('PvP');

      // level=2 → Easy AI
      engine.setLevel(2);
      expect((engine as any).getMode()).toBe('Easy AI');

      // level=3 → Medium AI
      engine.setLevel(3);
      expect((engine as any).getMode()).toBe('Medium AI');
    });

    it('getState() 返回完整状态快照', () => {
      const engine = startEngine();
      const state = engine.getState() as any;

      expect(state).toHaveProperty('board');
      expect(state).toHaveProperty('currentPlayer', 'X');
      expect(state).toHaveProperty('cursorRow', 1);
      expect(state).toHaveProperty('cursorCol', 1);
      expect(state).toHaveProperty('winner', null);
      expect(state).toHaveProperty('winLine', null);
      expect(state).toHaveProperty('isDraw', false);
      expect(state).toHaveProperty('mode', 'PvP');
      expect(state).toHaveProperty('scores');
      expect(state.scores).toEqual({ X: 0, O: 0, draw: 0 });
    });
  });

  // ================================================================
  // 2. 落子逻辑
  // ================================================================
  describe('落子逻辑', () => {
    it('X 可以在空位落子，board 更新', () => {
      const engine = startEngine();
      const result = placeMove(engine, 0, 0);
      expect(result).toBe(true);
      expect((engine as any).board[0][0]).toBe('X');
    });

    it('落子后切换到 O', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0);
      expect((engine as any).currentPlayer).toBe('O');
    });

    it('O 也可以落子，然后切回 X', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      expect((engine as any).board[1][0]).toBe('O');
      expect((engine as any).currentPlayer).toBe('X');
    });

    it('不能在已占位置落子（返回 false）', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X 占位
      const result = placeMove(engine, 0, 0); // 再落同一位置
      expect(result).toBe(false);
      expect((engine as any).board[0][0]).toBe('X'); // 仍为 X
    });

    it('落子增加 moveCount', () => {
      const engine = startEngine();
      expect((engine as any).moveCount).toBe(0);
      placeMove(engine, 0, 0);
      expect((engine as any).moveCount).toBe(1);
      placeMove(engine, 1, 0);
      expect((engine as any).moveCount).toBe(2);
    });

    it('游戏结束后不能再落子', () => {
      const engine = startEngine();
      // 制造胜利：X 占第一行
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins

      // winner 已设置，再落子应失败
      const result = placeMove(engine, 2, 2);
      expect(result).toBe(false);
    });
  });

  // ================================================================
  // 3. 胜利检测
  // ================================================================
  describe('胜利检测', () => {
    it('X 横行胜利（第一行）', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins row 0

      expect((engine as any).winner).toBe('X');
    });

    it('X 竖列胜利（第二列）', () => {
      const engine = startEngine();
      placeMove(engine, 0, 1); // X
      placeMove(engine, 0, 0); // O
      placeMove(engine, 1, 1); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 2, 1); // X wins col 1

      expect((engine as any).winner).toBe('X');
    });

    it('X 主对角线胜利', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 0, 1); // O
      placeMove(engine, 1, 1); // X
      placeMove(engine, 0, 2); // O
      placeMove(engine, 2, 2); // X wins diag

      expect((engine as any).winner).toBe('X');
    });

    it('X 副对角线胜利', () => {
      const engine = startEngine();
      placeMove(engine, 0, 2); // X
      placeMove(engine, 0, 0); // O
      placeMove(engine, 1, 1); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 2, 0); // X wins anti-diag

      expect((engine as any).winner).toBe('X');
    });

    it('O 也能胜利', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 2, 2); // X (不在同一行)
      placeMove(engine, 1, 2); // O wins row 1

      expect((engine as any).winner).toBe('O');
    });

    it('胜利时设置 winLine 坐标（行胜利）', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins row 0

      expect((engine as any).winLine).toEqual({
        startRow: 0,
        startCol: 0,
        endRow: 0,
        endCol: 2,
      });
    });

    it('胜利时 scores 对应玩家+1', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins

      expect((engine as any).scores.X).toBe(1);
      expect((engine as any).scores.O).toBe(0);
      expect((engine as any).scores.draw).toBe(0);
    });
  });

  // ================================================================
  // 4. 平局检测
  // ================================================================
  describe('平局检测', () => {
    it('棋盘满且无胜者 → isDraw=true', () => {
      const engine = startEngine();
      // X O X
      // X O O
      // O X X
      placeMove(engine, 0, 0); // X
      placeMove(engine, 0, 1); // O
      placeMove(engine, 0, 2); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 1, 0); // X
      placeMove(engine, 2, 0); // O
      placeMove(engine, 1, 2); // X
      placeMove(engine, 2, 2); // O
      placeMove(engine, 2, 1); // X → 棋盘满，平局

      expect((engine as any).isDraw).toBe(true);
      expect((engine as any).winner).toBeNull();
    });

    it('平局时 scores.draw+1', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 0, 1); // O
      placeMove(engine, 0, 2); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 1, 0); // X
      placeMove(engine, 2, 0); // O
      placeMove(engine, 1, 2); // X
      placeMove(engine, 2, 2); // O
      placeMove(engine, 2, 1); // X → 平局

      expect((engine as any).scores.draw).toBe(1);
    });

    it('平局时正确计分（SCORE_DRAW=50）', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 0, 1); // O
      placeMove(engine, 0, 2); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 1, 0); // X
      placeMove(engine, 2, 0); // O
      placeMove(engine, 1, 2); // X
      placeMove(engine, 2, 2); // O
      placeMove(engine, 2, 1); // X → 平局

      expect(engine.score).toBe(SCORE_DRAW);
    });
  });

  // ================================================================
  // 5. 计分系统
  // ================================================================
  describe('计分系统', () => {
    it('PvP 胜利得分 = SCORE_WIN + speedBonus（5步赢 = 100+50=150）', () => {
      const engine = startEngine();
      // X 5步赢（X 走 3 步，O 走 2 步，moveCount=5）
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins, moveCount=5

      const speedBonus = Math.max(0, SCORE_SPEED_BONUS_BASE - (5 - 5) * SCORE_SPEED_BONUS_STEP);
      expect(speedBonus).toBe(50);
      expect(engine.score).toBe(SCORE_WIN + speedBonus); // 100 + 50 = 150
    });

    it('AI 模式胜利得分 = SCORE_WIN + SCORE_AI_BONUS + speedBonus（5步赢 = 200）', () => {
      const engine = startEngine(2); // Level 2 = Easy AI
      // start() 会重置 level=1，需要重新设置
      engine.setLevel(2);

      // 直接操作棋盘模拟 X 5步赢
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O (手动)
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O (手动)
      placeMove(engine, 0, 2); // X wins, moveCount=5

      const speedBonus = Math.max(0, SCORE_SPEED_BONUS_BASE - (5 - 5) * SCORE_SPEED_BONUS_STEP);
      expect(engine.score).toBe(SCORE_WIN + SCORE_AI_BONUS + speedBonus); // 100 + 50 + 50 = 200
    });

    it('平局得分 = SCORE_DRAW（50）', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 0, 1); // O
      placeMove(engine, 0, 2); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 1, 0); // X
      placeMove(engine, 2, 0); // O
      placeMove(engine, 1, 2); // X
      placeMove(engine, 2, 2); // O
      placeMove(engine, 2, 1); // X → 平局

      expect(engine.score).toBe(SCORE_DRAW); // 50
    });

    it('不同步数的速通奖励（7步=100+30=130）', () => {
      const engine = startEngine();
      // moveCount=7: X=4 O=3, X 最后一步赢
      // X: (0,0), (0,1), (1,0), (2,0) → 第 0 列赢
      // O: (1,1), (2,2), (0,2)
      placeMove(engine, 0, 0); // X (1)
      placeMove(engine, 1, 1); // O (2)
      placeMove(engine, 0, 1); // X (3)
      placeMove(engine, 2, 2); // O (4)
      placeMove(engine, 1, 0); // X (5)
      placeMove(engine, 0, 2); // O (6)
      placeMove(engine, 2, 0); // X (7) wins col 0

      expect((engine as any).moveCount).toBe(7);
      const speedBonus = Math.max(0, SCORE_SPEED_BONUS_BASE - (7 - 5) * SCORE_SPEED_BONUS_STEP);
      expect(speedBonus).toBe(30);
      expect(engine.score).toBe(SCORE_WIN + speedBonus); // 100 + 30 = 130
    });

    it('9步胜利 speedBonus = max(0, 50-(9-5)*10) = 10 → 总分 110', () => {
      const engine = startEngine();
      // moveCount=9: X=5 O=4, X 最后一步赢
      // Row 0: X O X
      // Row 1: O X O
      // Row 2: X X .  → X 落 (2,2) → row 2 全 X → 赢！moveCount=9
      placeMove(engine, 0, 0); // X (1)
      placeMove(engine, 0, 1); // O (2)
      placeMove(engine, 1, 1); // X (3)
      placeMove(engine, 0, 2); // O (4)
      placeMove(engine, 2, 0); // X (5)
      placeMove(engine, 1, 0); // O (6)
      placeMove(engine, 2, 1); // X (7)
      placeMove(engine, 1, 2); // O (8)
      placeMove(engine, 2, 2); // X (9) wins row 2

      expect((engine as any).moveCount).toBe(9);
      const speedBonus = Math.max(0, SCORE_SPEED_BONUS_BASE - (9 - 5) * SCORE_SPEED_BONUS_STEP);
      expect(speedBonus).toBe(10);
      expect(engine.score).toBe(SCORE_WIN + speedBonus); // 100 + 10 = 110
    });

    it('列胜利时 winLine 坐标正确', () => {
      const engine = startEngine();
      placeMove(engine, 0, 1); // X
      placeMove(engine, 0, 0); // O
      placeMove(engine, 1, 1); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 2, 1); // X wins col 1

      expect((engine as any).winLine).toEqual({
        startRow: 0,
        startCol: 1,
        endRow: 2,
        endCol: 1,
      });
    });

    it('resultScored 防止重复计分', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins

      const scoreAfterFirst = engine.score;
      // 手动再次调用 calculateScore（模拟重复调用）
      (engine as any).calculateScore();
      expect(engine.score).toBe(scoreAfterFirst); // 没有重复加分
    });
  });

  // ================================================================
  // 6. 光标与输入
  // ================================================================
  describe('光标与输入', () => {
    it('ArrowUp 移动光标上移', () => {
      const engine = startEngine();
      (engine as any).cursorRow = 1;
      engine.handleKeyDown('ArrowUp');
      expect((engine as any).cursorRow).toBe(0);
    });

    it('W 键移动光标上移', () => {
      const engine = startEngine();
      (engine as any).cursorRow = 2;
      engine.handleKeyDown('w');
      expect((engine as any).cursorRow).toBe(1);
    });

    it('ArrowDown 移动光标下移', () => {
      const engine = startEngine();
      (engine as any).cursorRow = 1;
      engine.handleKeyDown('ArrowDown');
      expect((engine as any).cursorRow).toBe(2);
    });

    it('S 键移动光标下移', () => {
      const engine = startEngine();
      (engine as any).cursorRow = 0;
      engine.handleKeyDown('s');
      expect((engine as any).cursorRow).toBe(1);
    });

    it('ArrowLeft 移动光标左移', () => {
      const engine = startEngine();
      (engine as any).cursorCol = 2;
      engine.handleKeyDown('ArrowLeft');
      expect((engine as any).cursorCol).toBe(1);
    });

    it('A 键移动光标左移', () => {
      const engine = startEngine();
      (engine as any).cursorCol = 1;
      engine.handleKeyDown('a');
      expect((engine as any).cursorCol).toBe(0);
    });

    it('ArrowRight 移动光标右移', () => {
      const engine = startEngine();
      (engine as any).cursorCol = 0;
      engine.handleKeyDown('ArrowRight');
      expect((engine as any).cursorCol).toBe(1);
    });

    it('D 键移动光标右移', () => {
      const engine = startEngine();
      (engine as any).cursorCol = 1;
      engine.handleKeyDown('d');
      expect((engine as any).cursorCol).toBe(2);
    });

    it('光标不超出上边界', () => {
      const engine = startEngine();
      (engine as any).cursorRow = 0;
      engine.handleKeyDown('ArrowUp');
      expect((engine as any).cursorRow).toBe(0);
    });

    it('光标不超出下边界', () => {
      const engine = startEngine();
      (engine as any).cursorRow = BOARD_SIZE - 1;
      engine.handleKeyDown('ArrowDown');
      expect((engine as any).cursorRow).toBe(BOARD_SIZE - 1);
    });

    it('光标不超出左边界', () => {
      const engine = startEngine();
      (engine as any).cursorCol = 0;
      engine.handleKeyDown('ArrowLeft');
      expect((engine as any).cursorCol).toBe(0);
    });

    it('光标不超出右边界', () => {
      const engine = startEngine();
      (engine as any).cursorCol = BOARD_SIZE - 1;
      engine.handleKeyDown('ArrowRight');
      expect((engine as any).cursorCol).toBe(BOARD_SIZE - 1);
    });

    it('Space 在光标位置落子', () => {
      const engine = startEngine();
      (engine as any).cursorRow = 2;
      (engine as any).cursorCol = 2;
      engine.handleKeyDown(' ');
      expect((engine as any).board[2][2]).toBe('X');
    });

    it('Enter 在光标位置落子', () => {
      const engine = startEngine();
      (engine as any).cursorRow = 0;
      (engine as any).cursorCol = 1;
      engine.handleKeyDown('Enter');
      expect((engine as any).board[0][1]).toBe('X');
    });
  });

  // ================================================================
  // 7. 键盘快捷键
  // ================================================================
  describe('键盘快捷键', () => {
    it('R 键重置并重新开始游戏', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      expect((engine as any).moveCount).toBe(2);

      engine.handleKeyDown('r');
      // reset + start → 重新开始
      expect((engine as any).moveCount).toBe(0);
      expect((engine as any).board[0][0]).toBeNull();
      expect(engine.status).toBe('playing');
    });

    it('大写 R 键也能重置', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0);
      engine.handleKeyDown('R');
      expect((engine as any).moveCount).toBe(0);
    });

    it('P 键暂停游戏（playing→paused）', () => {
      const engine = startEngine();
      engine.handleKeyDown('p');
      expect(engine.status).toBe('paused');
    });

    it('P 键恢复游戏（paused→playing）', () => {
      const engine = startEngine();
      engine.handleKeyDown('p'); // pause
      expect(engine.status).toBe('paused');
      engine.handleKeyDown('p'); // resume
      expect(engine.status).toBe('playing');
    });

    it('大写 P 键也能暂停/恢复', () => {
      const engine = startEngine();
      engine.handleKeyDown('P');
      expect(engine.status).toBe('paused');
      engine.handleKeyDown('P');
      expect(engine.status).toBe('playing');
    });

    it('游戏结束后不处理方向键', () => {
      const engine = startEngine();
      // 制造胜利
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins

      const prevRow = (engine as any).cursorRow;
      const prevCol = (engine as any).cursorCol;
      engine.handleKeyDown('ArrowDown');
      // 光标不应移动（游戏已结束）
      expect((engine as any).cursorRow).toBe(prevRow);
      expect((engine as any).cursorCol).toBe(prevCol);
    });

    it('AI 思考中不处理玩家操作', () => {
      const engine = startEngine(2);
      engine.setLevel(2);
      (engine as any).aiThinking = true;

      const prevRow = (engine as any).cursorRow;
      engine.handleKeyDown('ArrowDown');
      expect((engine as any).cursorRow).toBe(prevRow); // 光标未移动
    });
  });

  // ================================================================
  // 8. AI 逻辑
  // ================================================================
  describe('AI 逻辑', () => {
    it('isAIMode() 在 level>=2 时返回 true', () => {
      const engine = createEngine();
      engine.setLevel(1);
      expect((engine as any).isAIMode()).toBe(false);
      engine.setLevel(2);
      expect((engine as any).isAIMode()).toBe(true);
      engine.setLevel(3);
      expect((engine as any).isAIMode()).toBe(true);
    });

    it('AI 模式下 O 回合时 Space 键被忽略', () => {
      const engine = startEngine(2);
      engine.setLevel(2);
      // X 先落子
      placeMove(engine, 0, 0);
      // 现在是 O 回合，在 AI 模式下 Space 应被忽略
      (engine as any).cursorRow = 1;
      (engine as any).cursorCol = 1;
      engine.handleKeyDown(' ');
      // O 不应被放置（因为是 AI 回合）
      expect((engine as any).board[1][1]).toBeNull();
    });

    it('Level 2 (Easy AI): AI 通过 update() 延迟落子', () => {
      const engine = startEngine(2);
      engine.setLevel(2);

      // X 先落子
      placeMove(engine, 0, 0);
      // 触发 AI 思考
      (engine as any).aiThinking = true;
      (engine as any).aiThinkTimer = 0;

      // 模拟 update 累积时间
      (engine as any).update(AI_THINK_DELAY - 1);
      expect((engine as any).aiThinking).toBe(true); // 还没到延迟

      (engine as any).update(1); // 累积到 AI_THINK_DELAY
      expect((engine as any).aiThinking).toBe(false); // AI 已执行

      // AI 应该已经落子了（O）
      let oCount = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if ((engine as any).board[r][c] === 'O') oCount++;
        }
      }
      expect(oCount).toBe(1);
    });

    it('Level 3 (Medium AI): AI 能找到获胜位置（findWinningMove）', () => {
      const engine = startEngine(3);
      engine.setLevel(3);
      // 设置棋盘让 O 有一个获胜位置
      // O O .
      // X . X
      // . . .
      setBoard(engine, [
        ['O', 'O', null],
        ['X', null, 'X'],
        [null, null, null],
      ]);
      (engine as any).currentPlayer = 'O';

      const winMove = (engine as any).findWinningMove('O');
      expect(winMove).toEqual({ row: 0, col: 2 });
    });

    it('Level 3 (Medium AI): AI 能堵住玩家获胜位置', () => {
      const engine = startEngine(3);
      engine.setLevel(3);
      // 设置棋盘让 X 有一个获胜位置
      // X X .
      // O . .
      // . . .
      setBoard(engine, [
        ['X', 'X', null],
        ['O', null, null],
        [null, null, null],
      ]);
      (engine as any).currentPlayer = 'O';

      const blockMove = (engine as any).findWinningMove('X');
      expect(blockMove).toEqual({ row: 0, col: 2 });
    });

    it('Level 3 (Medium AI): AI 优先占中心', () => {
      const engine = startEngine(3);
      engine.setLevel(3);
      // 空棋盘，只有 X 走了角落
      setBoard(engine, [
        ['X', null, null],
        [null, null, null],
        [null, null, null],
      ]);
      (engine as any).currentPlayer = 'O';
      (engine as any).winner = null;
      (engine as any).isDraw = false;

      // AI 没有获胜位置，也没有需要堵的位置 → 应占中心
      (engine as any).aiMediumMove();
      expect((engine as any).board[1][1]).toBe('O');
    });
  });

  // ================================================================
  // 9. 动画与更新
  // ================================================================
  describe('动画与更新', () => {
    it('update() 推进落子动画（elapsed 增加）', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0);
      const anim = (engine as any).placeAnimations[0];
      expect(anim).toBeDefined();
      const prevElapsed = anim.elapsed;

      (engine as any).update(50);
      expect(anim.elapsed).toBe(prevElapsed + 50);
    });

    it('动画完成后从队列移除', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0);
      expect((engine as any).placeAnimations).toHaveLength(1);

      // 推进时间超过动画时长
      (engine as any).update(PLACE_ANIMATION_DURATION + 10);
      expect((engine as any).placeAnimations).toHaveLength(0);
    });

    it('胜利线动画进度增加', () => {
      const engine = startEngine();
      // 制造胜利
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins

      expect((engine as any).winLineAnimating).toBe(true);
      expect((engine as any).winLineProgress).toBe(0);

      // 推进动画
      (engine as any).update(WIN_LINE_ANIMATION_SPEED / 2);
      expect((engine as any).winLineProgress).toBeCloseTo(0.5, 1);
    });

    it('胜利线动画完成后停止（progress=1）', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0);
      placeMove(engine, 1, 0);
      placeMove(engine, 0, 1);
      placeMove(engine, 1, 1);
      placeMove(engine, 0, 2); // X wins

      // 推进超过动画时长
      (engine as any).update(WIN_LINE_ANIMATION_SPEED + 100);
      expect((engine as any).winLineProgress).toBe(1);
      expect((engine as any).winLineAnimating).toBe(false);
    });

    it('AI 思考计时器累积', () => {
      const engine = startEngine(2);
      engine.setLevel(2);
      (engine as any).aiThinking = true;
      (engine as any).aiThinkTimer = 0;

      (engine as any).update(200);
      expect((engine as any).aiThinkTimer).toBe(200);

      (engine as any).update(200);
      expect((engine as any).aiThinkTimer).toBe(400);
    });
  });

  // ================================================================
  // 10. 重置与销毁
  // ================================================================
  describe('重置与销毁', () => {
    it('reset() 清空棋盘和状态', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0);
      placeMove(engine, 1, 0);
      placeMove(engine, 0, 1);
      placeMove(engine, 1, 1);
      placeMove(engine, 0, 2); // X wins

      engine.reset();
      expect((engine as any).moveCount).toBe(0);
      expect((engine as any).winner).toBeNull();
      expect((engine as any).winLine).toBeNull();
      expect((engine as any).isDraw).toBe(false);
      expect((engine as any).currentPlayer).toBe('X');
      expect((engine as any).resultScored).toBe(false);
      // 棋盘应清空
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          expect((engine as any).board[r][c]).toBeNull();
        }
      }
    });

    it('destroy() 清空比分', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0);
      placeMove(engine, 1, 0);
      placeMove(engine, 0, 1);
      placeMove(engine, 1, 1);
      placeMove(engine, 0, 2); // X wins → scores.X = 1

      expect((engine as any).scores.X).toBe(1);
      engine.destroy();
      expect((engine as any).scores).toEqual({ X: 0, O: 0, draw: 0 });
    });

    it('连续多局比分累积', () => {
      const engine = createEngine();
      engine.start();

      // 第一局：X 赢
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins
      expect((engine as any).scores.X).toBe(1);

      // 第二局：通过 R 键重新开始
      engine.handleKeyDown('r');
      expect((engine as any).scores.X).toBe(1); // 比分保留

      // X 再赢一局
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins
      expect((engine as any).scores.X).toBe(2);
    });
  });

  // ================================================================
  // 11. setTimeout 与 gameOver 延迟调用
  // ================================================================
  describe('setTimeout 延迟 gameOver', () => {
    it('胜利后 setTimeout 延迟调用 gameOver()', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 1, 0); // O
      placeMove(engine, 0, 1); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 0, 2); // X wins

      // 此时 status 仍为 playing（gameOver 延迟执行）
      expect(engine.status).toBe('playing');

      // 推进定时器（WIN_LINE_ANIMATION_SPEED + 600）
      vi.advanceTimersByTime(WIN_LINE_ANIMATION_SPEED + 600);
      expect(engine.status).toBe('gameover');
    });

    it('平局后 setTimeout 延迟调用 gameOver()', () => {
      const engine = startEngine();
      placeMove(engine, 0, 0); // X
      placeMove(engine, 0, 1); // O
      placeMove(engine, 0, 2); // X
      placeMove(engine, 1, 1); // O
      placeMove(engine, 1, 0); // X
      placeMove(engine, 2, 0); // O
      placeMove(engine, 1, 2); // X
      placeMove(engine, 2, 2); // O
      placeMove(engine, 2, 1); // X → 平局

      expect(engine.status).toBe('playing');
      vi.advanceTimersByTime(800);
      expect(engine.status).toBe('gameover');
    });
  });
});
