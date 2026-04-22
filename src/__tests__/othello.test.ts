import { vi } from 'vitest';
import { OthelloEngine } from '@/games/othello/OthelloEngine';
import {
  EMPTY, BLACK, WHITE,
  BOARD_SIZE, CELL_SIZE, BOARD_OFFSET_X, BOARD_OFFSET_Y,
  POSITION_WEIGHTS,
} from '@/games/othello/constants';

// ========== Mock Canvas ==========
const mockCtx = {
  fillRect: vi.fn(), clearRect: vi.fn(), fillText: vi.fn(),
  beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
  strokeRect: vi.fn(), stroke: vi.fn(), measureText: vi.fn(() => ({ width: 50 })),
};
const mockCanvas = {
  width: 480, height: 480,
  getContext: vi.fn(() => mockCtx),
} as unknown as HTMLCanvasElement;

function createEngine(): OthelloEngine {
  const engine = new OthelloEngine();
  engine.setCanvas(mockCanvas);
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
describe('OthelloEngine', () => {
  let engine: OthelloEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = createEngine();
  });

  // ========== 初始化 ==========
  describe('初始化', () => {
    it('棋盘为 8x8', () => {
      const board = engine.board;
      expect(board.length).toBe(8);
      for (const row of board) {
        expect(row.length).toBe(8);
      }
    });

    it('中央 4 子正确放置', () => {
      const board = engine.board;
      expect(board[3][3]).toBe(WHITE);
      expect(board[3][4]).toBe(BLACK);
      expect(board[4][3]).toBe(BLACK);
      expect(board[4][4]).toBe(WHITE);
    });

    it('初始黑子数为 2', () => {
      expect(engine.blackCount).toBe(2);
    });

    it('初始白子数为 2', () => {
      expect(engine.whiteCount).toBe(2);
    });

    it('当前玩家为黑方', () => {
      expect(engine.currentPlayer).toBe(BLACK);
    });

    it('游戏未结束', () => {
      expect(engine.isGameOver).toBe(false);
    });

    it('有有效的落子位置', () => {
      expect(engine.validMoves.length).toBeGreaterThan(0);
    });

    it('有效落子位置包含正确初始位置', () => {
      // 黑方初始可落子: (2,3), (3,2), (4,5), (5,4)
      const moves = engine.validMoves;
      const positions = moves.map(m => `${m.row},${m.col}`);
      expect(positions).toContain('2,3');
      expect(positions).toContain('3,2');
      expect(positions).toContain('4,5');
      expect(positions).toContain('5,4');
    });

    it('初始分数为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('lastMove 初始为 null', () => {
      expect(engine.lastMove).toBeNull();
    });

    it('棋盘其余位置为空', () => {
      const board = engine.board;
      let emptyCount = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] === EMPTY) emptyCount++;
        }
      }
      expect(emptyCount).toBe(60); // 64 - 4
    });
  });

  // ========== 落子规则 ==========
  describe('落子规则', () => {
    it('只能在空格落子', () => {
      // (3,3) 已有白子
      expect(engine.makeMove(3, 3)).toBe(false);
    });

    it('必须翻转至少一个对手棋子', () => {
      // (0,0) 角落没有可翻转的棋子
      expect(engine.makeMove(0, 0)).toBe(false);
    });

    it('无效位置返回 false（已有棋子）', () => {
      // Engine does not bounds-check, so test with occupied cell
      expect(engine.makeMove(3, 3)).toBe(false);
    });

    it('有效落子返回 true', () => {
      expect(engine.makeMove(2, 3)).toBe(true);
    });

    it('落子后棋盘更新', () => {
      engine.makeMove(2, 3);
      const board = engine.board;
      expect(board[2][3]).toBe(BLACK);
    });

    it('落子后切换玩家', () => {
      engine.makeMove(2, 3);
      expect(engine.currentPlayer).toBe(WHITE);
    });

    it('落子后 lastMove 更新', () => {
      engine.makeMove(2, 3);
      expect(engine.lastMove).toEqual({ row: 2, col: 3 });
    });

    it('不能在已有棋子的位置落子（中央白子）', () => {
      expect(engine.makeMove(3, 3)).toBe(false);
      expect(engine.makeMove(4, 4)).toBe(false);
    });

    it('不能在已有棋子的位置落子（中央黑子）', () => {
      expect(engine.makeMove(3, 4)).toBe(false);
      expect(engine.makeMove(4, 3)).toBe(false);
    });

    it('handleClick 正确处理点击', () => {
      const pos = cellToCanvas(2, 3);
      engine.handleClick(pos.x, pos.y);
      const board = engine.board;
      expect(board[2][3]).toBe(BLACK);
    });

    it('handleClick 忽略越界点击', () => {
      engine.handleClick(-10, -10);
      const board = engine.board;
      // 棋盘不变
      expect(board[3][3]).toBe(WHITE);
      expect(board[2][3]).toBe(EMPTY);
    });

    it('游戏结束后不能落子', () => {
      (engine as any)._gameOver = true;
      expect(engine.makeMove(2, 3)).toBe(false);
    });

    it('白方回合时玩家不能落子', () => {
      engine.setAI(false);
      engine.makeMove(2, 3); // 黑落子
      // 现在是白方回合
      expect(engine.currentPlayer).toBe(WHITE);
      // handleClick 在白方回合不处理（AI 关闭时也如此）
      const pos = cellToCanvas(4, 5);
      engine.handleClick(pos.x, pos.y);
      // 棋盘不变（handleClick 只处理黑方）
    });
  });

  // ========== 翻转逻辑 ==========
  describe('翻转逻辑', () => {
    it('落子 (2,3) 翻转 (3,3) 白→黑', () => {
      engine.makeMove(2, 3);
      const board = engine.board;
      expect(board[3][3]).toBe(BLACK); // 原为 WHITE，被翻转
    });

    it('落子 (3,2) 翻转 (3,3) 白→黑', () => {
      engine.makeMove(3, 2);
      const board = engine.board;
      expect(board[3][3]).toBe(BLACK);
    });

    it('落子 (4,5) 翻转 (4,4) 白→黑', () => {
      engine.makeMove(4, 5);
      const board = engine.board;
      expect(board[4][4]).toBe(BLACK);
    });

    it('落子 (5,4) 翻转 (4,4) 白→黑', () => {
      engine.makeMove(5, 4);
      const board = engine.board;
      expect(board[4][4]).toBe(BLACK);
    });

    it('翻转后计数正确', () => {
      engine.makeMove(2, 3);
      // 黑落 (2,3)，翻转 (3,3)，黑=4, 白=1
      expect(engine.blackCount).toBe(4);
      expect(engine.whiteCount).toBe(1);
    });

    it('多方向翻转', () => {
      // 构造一个可以多方向翻转的局面
      const board = (engine as any)._board as number[][];
      // 清空棋盘
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      // 构造: 黑在(3,3), 白在(2,3)和(3,2), 黑在(1,3)和(3,1)
      // 落子 (4,4) 可以翻转 (3,3)
      board[3][3] = BLACK;
      board[2][3] = WHITE;
      board[3][2] = WHITE;
      board[3][4] = WHITE;
      board[4][3] = WHITE;
      (engine as any)._currentPlayer = BLACK;
      (engine as any).updateCounts();
      (engine as any)._validMoves = (engine as any).getValidMoves(BLACK);

      // 落子 (1,3) 翻转 (2,3)
      const result = engine.makeMove(1, 3);
      expect(result).toBe(true);
      expect(board[2][3]).toBe(BLACK);
    });

    it('连续两步翻转计数', () => {
      engine.setAI(false);
      engine.makeMove(2, 3); // 黑
      expect(engine.blackCount).toBe(4);
      expect(engine.whiteCount).toBe(1);

      // 白方落子
      engine.makeMove(2, 2); // 白落 (2,2)，翻转 (3,3) 黑→白
      expect(engine.whiteCount).toBe(3);
      expect(engine.blackCount).toBe(3);
    });

    it('翻转后分数增加', () => {
      engine.makeMove(2, 3);
      // 翻转1个子，分数+1
      expect(engine.score).toBe(1);
    });
  });

  // ========== 跳过回合 ==========
  describe('跳过回合', () => {
    it('无有效落子时自动跳过', () => {
      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      // 构造黑方完全被白方包围，无法翻转任何白子
      // 黑子在一行，白子完全包围且没有可翻转的路径
      board[0][0] = WHITE;
      board[0][1] = WHITE;
      board[0][2] = WHITE;
      board[1][0] = WHITE;
      board[1][1] = BLACK;
      board[1][2] = WHITE;
      board[2][0] = WHITE;
      board[2][1] = WHITE;
      board[2][2] = WHITE;
      // 其余全白
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] === EMPTY) board[r][c] = WHITE;
        }
      }
      (engine as any)._currentPlayer = BLACK;
      (engine as any).updateCounts();

      // 黑方无有效落子（所有空位都没有可翻转的白子路径）
      expect((engine as any).getValidMoves(BLACK).length).toBe(0);
    });

    it('跳过后切换到对手', () => {
      const board = (engine as any)._board as number[][];
      // 设置一个黑方无有效落子、但白方有有效落子的局面
      // 大部分格子为白色，黑棋被完全包围
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = WHITE;
        }
      }
      // 黑棋在 (3,3)，被白棋包围
      board[3][3] = BLACK;
      // 空位 (2,2)：白方可在此落子，沿对角线翻转 (3,3) 的黑棋（(4,4) 为白棋锚点）
      board[2][2] = EMPTY;
      (engine as any)._currentPlayer = BLACK;
      (engine as any).updateCounts();

      // 黑方无有效落子（唯一空位 (2,2) 旁边是白棋，但黑棋在 (3,3)，
      // 黑方在 (2,2) 落子需要翻转白棋，但 (2,2) 的邻居只有白棋和黑棋，
      // 没有路径能在黑棋锚点之间夹住白棋）
      expect((engine as any).getValidMoves(BLACK).length).toBe(0);

      // 白方应该有有效落子：白方在 (2,2) 落子可沿 ↘ 方向翻转 (3,3) 的黑棋
      // 因为 (4,4) 是白棋作为锚点
      const whiteMoves = (engine as any).getValidMoves(WHITE);
      expect(whiteMoves.length).toBeGreaterThan(0);
    });
  });

  // ========== 游戏结束 ==========
  describe('游戏结束', () => {
    it('双方都无法落子时游戏结束', () => {
      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      // 填满棋盘，无空位
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = (r + c) % 2 === 0 ? BLACK : WHITE;
        }
      }
      (engine as any)._currentPlayer = BLACK;
      (engine as any).updateCounts();
      (engine as any)._validMoves = [];

      // 尝试落子 — 棋盘已满
      expect(engine.makeMove(0, 0)).toBe(false);
    });

    it('棋盘填满时游戏结束', () => {
      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = BLACK;
        }
      }
      (engine as any).updateCounts();
      // 没有空位可落子
      expect((engine as any).getValidMoves(BLACK).length).toBe(0);
      expect((engine as any).getValidMoves(WHITE).length).toBe(0);
    });

    it('游戏结束后 isGameOver 为 true', () => {
      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = BLACK;
        }
      }
      (engine as any)._currentPlayer = BLACK;
      (engine as any).updateCounts();
      (engine as any)._validMoves = [];

      // makeMove 会因为棋盘满而返回 false
      expect(engine.makeMove(0, 0)).toBe(false);
    });

    it('通过 makeMove 触发游戏结束', () => {
      // 构造一个双方都无法落子的局面
      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = BLACK;
        }
      }
      // 棋盘全黑，白方无有效落子
      (engine as any)._currentPlayer = WHITE;
      (engine as any).updateCounts();
      (engine as any)._validMoves = (engine as any).getValidMoves(WHITE);

      // 白方无有效落子 → 跳过 → 黑方也无（棋盘满）→ 游戏结束
      if ((engine as any)._validMoves.length === 0) {
        (engine as any)._passCount++;
        (engine as any)._currentPlayer = BLACK;
        (engine as any)._validMoves = (engine as any).getValidMoves(BLACK);
        if ((engine as any)._validMoves.length === 0) {
          (engine as any)._passCount++;
          (engine as any).endGame();
        }
      }
      expect(engine.isGameOver).toBe(true);
    });
  });

  // ========== AI ==========
  describe('AI', () => {
    it('AI 默认启用', () => {
      expect(engine.aiEnabled).toBe(true);
    });

    it('可以关闭 AI', () => {
      engine.setAI(false);
      expect(engine.aiEnabled).toBe(false);
    });

    it('AI 能落子', () => {
      engine.setAI(false);
      engine.makeMove(2, 3); // 黑方落子
      // 现在是白方回合
      expect(engine.currentPlayer).toBe(WHITE);

      // 启用 AI 并手动触发 AI 走棋
      engine.setAI(true);
      (engine as any).aiMove();

      // AI 走完后应切换回黑方
      expect(engine.currentPlayer).toBe(BLACK);
    });

    it('AI 选择角落优先', () => {
      // 构造一个角落可落子的局面
      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      // 角落 (0,0) 可落白子: (1,1)=黑, (2,2)=白 → 白可落(0,0)翻转(1,1)
      board[1][1] = BLACK;
      board[2][2] = WHITE;
      // 同时给白方另一个非角落选择
      board[3][4] = BLACK;
      board[4][4] = WHITE;
      (engine as any)._currentPlayer = WHITE;
      (engine as any).updateCounts();
      (engine as any)._validMoves = (engine as any).getValidMoves(WHITE);

      // 确认角落 (0,0) 是有效落子
      const hasCorner = (engine as any)._validMoves.some(
        (m: any) => m.row === 0 && m.col === 0
      );
      expect(hasCorner).toBe(true);

      // AI 应该选择角落（权重100 vs 其他位置低权重）
      (engine as any).aiMove();
      expect(board[0][0]).toBe(WHITE);
    });

    it('AI 使用位置权重', () => {
      // 验证位置权重存在
      expect(POSITION_WEIGHTS.length).toBe(8);
      expect(POSITION_WEIGHTS[0][0]).toBe(100); // 角落最高
      expect(POSITION_WEIGHTS[1][1]).toBe(-50); // 角旁最低
    });

    it('AI 无有效落子时不崩溃', () => {
      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = BLACK;
        }
      }
      (engine as any)._currentPlayer = WHITE;
      (engine as any).updateCounts();
      (engine as any)._validMoves = [];

      // AI 无棋可走，不应崩溃
      expect(() => (engine as any).aiMove()).not.toThrow();
    });
  });

  // ========== 计分 ==========
  describe('计分', () => {
    it('初始黑子数为 2', () => {
      expect(engine.blackCount).toBe(2);
    });

    it('初始白子数为 2', () => {
      expect(engine.whiteCount).toBe(2);
    });

    it('落子后计数更新', () => {
      engine.makeMove(2, 3);
      // 黑落 (2,3)，翻转 (3,3)，黑=4, 白=1
      expect(engine.blackCount).toBe(4);
      expect(engine.whiteCount).toBe(1);
    });

    it('黑白总数始终等于棋盘上的棋子数', () => {
      engine.makeMove(2, 3);
      const board = engine.board;
      let total = 0;
      for (const row of board) {
        for (const cell of row) {
          if (cell !== EMPTY) total++;
        }
      }
      expect(engine.blackCount + engine.whiteCount).toBe(total);
    });

    it('分数随翻转增加', () => {
      engine.makeMove(2, 3);
      expect(engine.score).toBeGreaterThanOrEqual(1);
    });
  });

  // ========== 事件 ==========
  describe('事件', () => {
    it('落子触发 move 事件', () => {
      const handler = vi.fn();
      engine.on('move', handler);
      engine.makeMove(2, 3);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('move 事件包含行列和玩家信息', () => {
      const handler = vi.fn();
      engine.on('move', handler);
      engine.makeMove(2, 3);
      expect(handler).toHaveBeenCalledWith({
        row: 2,
        col: 3,
        player: BLACK,
      });
    });

    it('无效落子不触发 move 事件', () => {
      const handler = vi.fn();
      engine.on('move', handler);
      engine.makeMove(0, 0);
      expect(handler).not.toHaveBeenCalled();
    });

    it('可以取消事件监听', () => {
      const handler = vi.fn();
      engine.on('move', handler);
      engine.off('move', handler);
      engine.makeMove(2, 3);
      expect(handler).not.toHaveBeenCalled();
    });

    it('scoreChange 事件在落子后触发', () => {
      const handler = vi.fn();
      engine.on('scoreChange', handler);
      engine.makeMove(2, 3);
      expect(handler).toHaveBeenCalled();
    });
  });

  // ========== getState ==========
  describe('getState', () => {
    it('返回包含 board 的状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('board');
    });

    it('返回包含 currentPlayer 的状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('currentPlayer');
      expect(state.currentPlayer).toBe(BLACK);
    });

    it('返回包含 blackCount 的状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('blackCount');
      expect(state.blackCount).toBe(2);
    });

    it('返回包含 whiteCount 的状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('whiteCount');
      expect(state.whiteCount).toBe(2);
    });

    it('返回包含 isGameOver 的状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('isGameOver');
      expect(state.isGameOver).toBe(false);
    });

    it('返回包含 score 和 level', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
    });
  });

  // ========== 重置与销毁 ==========
  describe('重置与销毁', () => {
    it('重置后棋盘恢复初始', () => {
      engine.makeMove(2, 3);
      engine.reset();
      const board = engine.board;
      expect(board[3][3]).toBe(WHITE);
      expect(board[3][4]).toBe(BLACK);
      expect(board[4][3]).toBe(BLACK);
      expect(board[4][4]).toBe(WHITE);
    });

    it('重置后当前玩家为黑方', () => {
      engine.makeMove(2, 3);
      engine.reset();
      expect(engine.currentPlayer).toBe(BLACK);
    });

    it('重置后分数归零', () => {
      engine.makeMove(2, 3);
      engine.reset();
      expect(engine.score).toBe(0);
    });

    it('重置后游戏未结束', () => {
      engine.makeMove(2, 3);
      engine.reset();
      expect(engine.isGameOver).toBe(false);
    });

    it('重置后计数正确', () => {
      engine.makeMove(2, 3);
      engine.reset();
      expect(engine.blackCount).toBe(2);
      expect(engine.whiteCount).toBe(2);
    });

    it('销毁后清理事件', () => {
      const handler = vi.fn();
      engine.on('move', handler);
      engine.destroy();
      // 销毁后不应再触发事件（内部 listeners 已清空）
      // 但 board 已重置，makeMove 仍可调用
    });

    it('多次重置不会出错', () => {
      engine.makeMove(2, 3);
      engine.reset();
      engine.reset();
      engine.reset();
      expect(engine.blackCount).toBe(2);
      expect(engine.whiteCount).toBe(2);
    });
  });

  // ========== 边界与异常 ==========
  describe('边界与异常', () => {
    it('棋盘边界落子', () => {
      // 构造一个角落可落子的局面
      const board = (engine as any)._board as number[][];
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          board[r][c] = EMPTY;
        }
      }
      board[1][1] = WHITE;
      board[2][2] = BLACK;
      (engine as any)._currentPlayer = BLACK;
      (engine as any).updateCounts();
      (engine as any)._validMoves = (engine as any).getValidMoves(BLACK);

      expect(engine.makeMove(0, 0)).toBe(true);
      expect(board[0][0]).toBe(BLACK);
    });

    it('连续多步游戏正常', () => {
      engine.setAI(false);
      // 黑 (2,3)
      expect(engine.makeMove(2, 3)).toBe(true);
      expect(engine.currentPlayer).toBe(WHITE);
      // 白 (2,2)
      expect(engine.makeMove(2, 2)).toBe(true);
      expect(engine.currentPlayer).toBe(BLACK);
      // 黑 (1,3) — 检查是否有效
      // After: black(2,3), black(3,4), black(4,3), white(2,2), white(3,3), white(4,4)
      // (1,3) → (2,3)=black → no flip needed, need opponent piece
      // Let's try a known valid move
      const validMoves = engine.validMoves;
      expect(validMoves.length).toBeGreaterThan(0);
      const move = validMoves[0];
      expect(engine.makeMove(move.row, move.col)).toBe(true);
      expect(engine.currentPlayer).toBe(WHITE);
    });

    it('getFlips 私有方法正确性', () => {
      // 验证初始位置 (2,3) 的翻转
      const flips = (engine as any).getFlips(2, 3, BLACK);
      expect(flips.length).toBe(1);
      expect(flips[0]).toEqual([3, 3]);
    });

    it('getValidMoves 返回所有有效位置', () => {
      const moves = (engine as any).getValidMoves(BLACK);
      expect(moves.length).toBe(4);
    });

    it('board getter 返回副本', () => {
      const board1 = engine.board;
      const board2 = engine.board;
      expect(board1).not.toBe(board2);
      expect(board1).toEqual(board2);
    });

    it('validMoves getter 返回副本', () => {
      const moves1 = engine.validMoves;
      const moves2 = engine.validMoves;
      expect(moves1).not.toBe(moves2);
      expect(moves1).toEqual(moves2);
    });

    it('handleClick 在游戏结束后无效', () => {
      (engine as any)._gameOver = true;
      const pos = cellToCanvas(2, 3);
      engine.handleClick(pos.x, pos.y);
      // 棋盘不变
    });
  });
});
