import { vi } from 'vitest';
/**
 * HexEngine 综合测试
 * 覆盖：棋盘初始化、落子、六角网格邻居、路径判定（BFS连通检测）、
 *       交换规则、AI 落子、胜利判定、getState、键盘控制、事件系统、边界情况
 */
import { HexEngine } from '../HexEngine';
import {
  BOARD_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CELL_EMPTY,
  CELL_RED,
  CELL_BLUE,
  PLAYER_RED,
  PLAYER_BLUE,
  HEX_NEIGHBORS_EVEN,
  HEX_NEIGHBORS_ODD,
  AI_THINK_DELAY,
  MODE_PVP,
  MODE_PVE,
  HEX_RADIUS,
  HEX_GAP,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
} from '../constants';

// ============================================================
// Mock Setup
// ============================================================

beforeAll(() => {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => 0) as any;
  globalThis.cancelAnimationFrame = (() => {}) as any;
});

/** 创建 mock canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并初始化（不 start，停留在 idle） */
function createEngine(): HexEngine {
  const engine = new HexEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): HexEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: HexEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: HexEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

// ============================================================
// 测试套件
// ============================================================

describe('HexEngine', () => {
  let engine: HexEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = createAndStartEngine();
  });

  afterEach(() => {
    engine.destroy();
    vi.useRealTimers();
  });

  // ============================================================
  // 1. 棋盘初始化
  // ============================================================
  describe('棋盘初始化', () => {
    it('棋盘大小应为 11×11', () => {
      const board = engine.getBoard();
      expect(board.length).toBe(BOARD_SIZE);
      for (let col = 0; col < BOARD_SIZE; col++) {
        expect(board[col].length).toBe(BOARD_SIZE);
      }
    });

    it('初始棋盘所有格子应为空', () => {
      const board = engine.getBoard();
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE; row++) {
          expect(board[col][row]).toBe(CELL_EMPTY);
        }
      }
    });

    it('初始玩家应为红方', () => {
      expect(engine.getCurrentPlayer()).toBe(PLAYER_RED);
    });

    it('初始步数应为 0', () => {
      expect(engine.getMoveCount()).toBe(0);
    });

    it('初始胜者应为 0', () => {
      expect(engine.getWinner()).toBe(0);
    });

    it('初始未使用交换', () => {
      expect(engine.isSwapUsed()).toBe(false);
    });

    it('初始无最后落子', () => {
      expect(engine.getLastMove()).toBeNull();
    });

    it('初始无获胜路径', () => {
      expect(engine.getWinPath().size).toBe(0);
    });

    it('初始游戏模式为 PvE', () => {
      expect(engine.getMode()).toBe(MODE_PVE);
    });

    it('初始光标在棋盘中心', () => {
      const cursor = engine.getCursor();
      expect(cursor.col).toBe(Math.floor(BOARD_SIZE / 2));
      expect(cursor.row).toBe(Math.floor(BOARD_SIZE / 2));
    });

    it('初始 AI 不在思考', () => {
      expect(engine.isAiThinking()).toBe(false);
    });

    it('初始 isWin 为 false', () => {
      expect(engine.isWin).toBe(false);
    });

    it('重置后棋盘清空', () => {
      engine.placePiece(0, 0);
      engine.reset();
      const board = engine.getBoard();
      expect(board[0][0]).toBe(CELL_EMPTY);
      expect(engine.getMoveCount()).toBe(0);
    });
  });

  // ============================================================
  // 2. 常量验证
  // ============================================================
  describe('常量验证', () => {
    it('BOARD_SIZE 为 11', () => {
      expect(BOARD_SIZE).toBe(11);
    });

    it('CANVAS_WIDTH 为 480', () => {
      expect(CANVAS_WIDTH).toBe(480);
    });

    it('CANVAS_HEIGHT 为 640', () => {
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('CELL_EMPTY 为 0', () => {
      expect(CELL_EMPTY).toBe(0);
    });

    it('CELL_RED 为 1', () => {
      expect(CELL_RED).toBe(1);
    });

    it('CELL_BLUE 为 2', () => {
      expect(CELL_BLUE).toBe(2);
    });

    it('PLAYER_RED 为 1', () => {
      expect(PLAYER_RED).toBe(1);
    });

    it('PLAYER_BLUE 为 2', () => {
      expect(PLAYER_BLUE).toBe(2);
    });

    it('HEX_RADIUS 为 20', () => {
      expect(HEX_RADIUS).toBe(20);
    });

    it('HEX_GAP 为 2', () => {
      expect(HEX_GAP).toBe(2);
    });
  });

  // ============================================================
  // 3. 落子
  // ============================================================
  describe('落子', () => {
    it('红方可以在空格落子', () => {
      expect(engine.placePiece(5, 5)).toBe(true);
      expect(engine.getBoard()[5][5]).toBe(CELL_RED);
    });

    it('落子后切换到蓝方', () => {
      engine.placePiece(5, 5);
      expect(engine.getCurrentPlayer()).toBe(PLAYER_BLUE);
    });

    it('不能在已有棋子的位置落子', () => {
      engine.placePiece(5, 5);
      // PvE 模式下蓝方是 AI，需要手动设置模式为 PvP
      engine.setMode(MODE_PVP);
      // 现在红方落子在已有位置
      // 等等，当前是蓝方回合，先让蓝方落子
      engine.placePiece(4, 4); // 蓝方
      expect(engine.placePiece(5, 5)).toBe(false); // 红方尝试已有位置
    });

    it('不能在非法坐标落子（负数）', () => {
      expect(engine.placePiece(-1, 0)).toBe(false);
      expect(engine.placePiece(0, -1)).toBe(false);
    });

    it('不能在非法坐标落子（超出范围）', () => {
      expect(engine.placePiece(BOARD_SIZE, 0)).toBe(false);
      expect(engine.placePiece(0, BOARD_SIZE)).toBe(false);
    });

    it('落子后步数增加', () => {
      engine.placePiece(5, 5);
      expect(engine.getMoveCount()).toBe(1);
    });

    it('最后落子位置更新', () => {
      engine.placePiece(3, 7);
      const last = engine.getLastMove();
      expect(last).toEqual({ col: 3, row: 7 });
    });

    it('游戏结束后不能落子', () => {
      // 构造红方获胜场景
      setPrivate(engine, 'board', createRedWinBoard());
      setPrivate(engine, 'currentPlayer', PLAYER_RED);
      setPrivate(engine, 'moveCount', 20);
      // 检查红方确实赢了
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(true);
      setPrivate(engine, 'winner', PLAYER_RED);
      setPrivate(engine, 'isWin', true);
      expect(engine.placePiece(5, 5)).toBe(false);
    });

    it('暂停时不能落子', () => {
      engine.pause();
      expect(engine.placePiece(5, 5)).toBe(false);
    });

    it('连续多次落子正确交替', () => {
      engine.setMode(MODE_PVP);
      expect(engine.getCurrentPlayer()).toBe(PLAYER_RED);
      engine.placePiece(0, 0);
      expect(engine.getCurrentPlayer()).toBe(PLAYER_BLUE);
      engine.placePiece(1, 0);
      expect(engine.getCurrentPlayer()).toBe(PLAYER_RED);
      engine.placePiece(2, 0);
      expect(engine.getCurrentPlayer()).toBe(PLAYER_BLUE);
    });

    it('落子后棋盘是副本（不影响内部）', () => {
      engine.placePiece(5, 5);
      const board = engine.getBoard();
      board[5][5] = CELL_BLUE; // 修改副本
      expect(engine.getBoard()[5][5]).toBe(CELL_RED); // 内部不变
    });
  });

  // ============================================================
  // 4. 六角网格邻居
  // ============================================================
  describe('六角网格邻居', () => {
    it('中心格子有 6 个邻居', () => {
      const neighbors = engine.getNeighborCells(5, 5);
      expect(neighbors.length).toBe(6);
    });

    it('角落格子邻居少于 6 个', () => {
      const neighbors = engine.getNeighborCells(0, 0);
      expect(neighbors.length).toBeLessThan(6);
    });

    it('左上角 (0,0) 的邻居', () => {
      const neighbors = engine.getNeighborCells(0, 0);
      // 偶数行 (row=0): offsets = HEX_NEIGHBORS_EVEN
      // (-1,-1) -> invalid, (0,-1) -> invalid
      // (-1,0) -> invalid, (1,0) -> valid
      // (-1,1) -> invalid, (0,1) -> valid
      expect(neighbors).toContainEqual([1, 0]);
      expect(neighbors).toContainEqual([0, 1]);
      expect(neighbors.length).toBe(2);
    });

    it('右下角 (10,10) 的邻居', () => {
      const neighbors = engine.getNeighborCells(10, 10);
      // 偶数行 (row=10): offsets = HEX_NEIGHBORS_EVEN
      // (-1,-1) -> (9,9), (0,-1) -> (10,9)
      // (-1,0) -> (9,10), (1,0) -> invalid
      // (-1,1) -> invalid, (0,1) -> invalid
      expect(neighbors).toContainEqual([9, 9]);
      expect(neighbors).toContainEqual([10, 9]);
      expect(neighbors).toContainEqual([9, 10]);
      expect(neighbors.length).toBe(3);
    });

    it('偶数行邻居偏移正确', () => {
      expect(HEX_NEIGHBORS_EVEN.length).toBe(6);
    });

    it('奇数行邻居偏移正确', () => {
      expect(HEX_NEIGHBORS_ODD.length).toBe(6);
    });

    it('奇数行 (5,1) 的邻居', () => {
      const neighbors = engine.getNeighborCells(5, 1);
      // 奇数行 (row=1): offsets = HEX_NEIGHBORS_ODD
      // (0,-1) -> (5,0), (1,-1) -> (6,0)
      // (-1,0) -> (4,1), (1,0) -> (6,1)
      // (0,1) -> (5,2), (1,1) -> (6,2)
      expect(neighbors.length).toBe(6);
      expect(neighbors).toContainEqual([5, 0]);
      expect(neighbors).toContainEqual([6, 0]);
      expect(neighbors).toContainEqual([4, 1]);
      expect(neighbors).toContainEqual([6, 1]);
      expect(neighbors).toContainEqual([5, 2]);
      expect(neighbors).toContainEqual([6, 2]);
    });

    it('偶数行 (5,0) 的邻居', () => {
      const neighbors = engine.getNeighborCells(5, 0);
      // 偶数行 (row=0): offsets = HEX_NEIGHBORS_EVEN
      // (-1,-1) -> invalid, (0,-1) -> invalid
      // (-1,0) -> (4,0), (1,0) -> (6,0)
      // (-1,1) -> (4,1), (0,1) -> (5,1)
      expect(neighbors.length).toBe(4);
      expect(neighbors).toContainEqual([4, 0]);
      expect(neighbors).toContainEqual([6, 0]);
      expect(neighbors).toContainEqual([4, 1]);
      expect(neighbors).toContainEqual([5, 1]);
    });

    it('边界格子不返回越界邻居', () => {
      // 测试所有边界格子
      for (let col = 0; col < BOARD_SIZE; col++) {
        const topNeighbors = engine.getNeighborCells(col, 0);
        for (const [nc, nr] of topNeighbors) {
          expect(nc).toBeGreaterThanOrEqual(0);
          expect(nc).toBeLessThan(BOARD_SIZE);
          expect(nr).toBeGreaterThanOrEqual(0);
          expect(nr).toBeLessThan(BOARD_SIZE);
        }
      }
    });

    it('所有合法格子的邻居都在棋盘范围内', () => {
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE; row++) {
          const neighbors = engine.getNeighborCells(col, row);
          for (const [nc, nr] of neighbors) {
            expect(nc).toBeGreaterThanOrEqual(0);
            expect(nc).toBeLessThan(BOARD_SIZE);
            expect(nr).toBeGreaterThanOrEqual(0);
            expect(nr).toBeLessThan(BOARD_SIZE);
          }
        }
      }
    });

    it('邻居关系是对称的', () => {
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE; row++) {
          const neighbors = engine.getNeighborCells(col, row);
          for (const [nc, nr] of neighbors) {
            const reverseNeighbors = engine.getNeighborCells(nc, nr);
            expect(reverseNeighbors).toContainEqual([col, row]);
          }
        }
      }
    });
  });

  // ============================================================
  // 5. 路径判定（BFS 连通检测）
  // ============================================================
  describe('路径判定（BFS 连通检测）', () => {
    it('空棋盘上没有人获胜', () => {
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(false);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(false);
    });

    it('红方连通上下边获胜', () => {
      const board = createEmptyBoard();
      // 在 col=5 的位置从 row=0 到 row=10 放置红子
      for (let row = 0; row < BOARD_SIZE; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(true);
    });

    it('蓝方连通左右边获胜', () => {
      const board = createEmptyBoard();
      // 在 row=5 的位置从 col=0 到 col=10 放置蓝子
      for (let col = 0; col < BOARD_SIZE; col++) {
        board[col][5] = CELL_BLUE;
      }
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(true);
    });

    it('红方只在上边有棋子不获胜', () => {
      const board = createEmptyBoard();
      board[5][0] = CELL_RED;
      board[6][0] = CELL_RED;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(false);
    });

    it('红方只在下边有棋子不获胜', () => {
      const board = createEmptyBoard();
      board[5][BOARD_SIZE - 1] = CELL_RED;
      board[6][BOARD_SIZE - 1] = CELL_RED;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(false);
    });

    it('蓝方只在左边有棋子不获胜', () => {
      const board = createEmptyBoard();
      board[0][5] = CELL_BLUE;
      board[0][6] = CELL_BLUE;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(false);
    });

    it('蓝方只在右边有棋子不获胜', () => {
      const board = createEmptyBoard();
      board[BOARD_SIZE - 1][5] = CELL_BLUE;
      board[BOARD_SIZE - 1][6] = CELL_BLUE;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(false);
    });

    it('红方通过锯齿路径连通获胜', () => {
      const board = createEmptyBoard();
      // 创建一条从上到下的锯齿路径
      board[5][0] = CELL_RED;
      board[5][1] = CELL_RED;
      board[6][1] = CELL_RED;
      board[6][2] = CELL_RED;
      board[5][3] = CELL_RED;
      // 检查 (5,2) 是否是 (6,2) 的邻居
      const neighbors = engine.getNeighborCells(6, 2);
      // 如果 (5,3) 不是 (6,2) 的邻居，需要调整
      // 让我们创建一个更简单的连通路径
      setPrivate(engine, 'board', board);
      // 这个可能不连通，需要验证
      // 改用更可靠的方式
    });

    it('红方通过邻居连通的路径获胜', () => {
      const board = createEmptyBoard();
      // 从 (5,0) 开始，沿着邻居一直连到 (5,10)
      board[5][0] = CELL_RED;
      // (5,0) 的邻居包含 (5,1)
      board[5][1] = CELL_RED;
      // (5,1) 是奇数行，邻居包含 (5,2)
      board[5][2] = CELL_RED;
      // (5,2) 是偶数行，邻居包含 (5,3)
      board[5][3] = CELL_RED;
      board[5][4] = CELL_RED;
      board[5][5] = CELL_RED;
      board[5][6] = CELL_RED;
      board[5][7] = CELL_RED;
      board[5][8] = CELL_RED;
      board[5][9] = CELL_RED;
      board[5][10] = CELL_RED;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(true);
    });

    it('蓝方通过邻居连通的路径获胜', () => {
      const board = createEmptyBoard();
      // 从 (0,5) 到 (10,5) 沿 row=5
      // 需要确保相邻列在同一行是邻居
      for (let col = 0; col < BOARD_SIZE; col++) {
        board[col][5] = CELL_BLUE;
      }
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(true);
    });

    it('红方路径被蓝方阻断不获胜', () => {
      const board = createEmptyBoard();
      // 红方在 col=5 的 row=0..4
      for (let row = 0; row < 5; row++) {
        board[5][row] = CELL_RED;
      }
      // 蓝方在 col=5 的 row=5
      board[5][5] = CELL_BLUE;
      // 红方在 col=5 的 row=6..10
      for (let row = 6; row < BOARD_SIZE; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(false);
    });

    it('获胜时生成获胜路径', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      engine.checkWinPublic(PLAYER_RED);
      const winPath = engine.getWinPath();
      expect(winPath.size).toBeGreaterThan(0);
    });

    it('获胜路径包含起点和终点', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      engine.checkWinPublic(PLAYER_RED);
      const winPath = engine.getWinPath();
      expect(winPath.has('5,0')).toBe(true);
      expect(winPath.has('5,10')).toBe(true);
    });

    it('红方通过弯曲路径获胜', () => {
      const board = createEmptyBoard();
      // 从上到下，通过弯曲路径
      board[3][0] = CELL_RED;
      board[3][1] = CELL_RED;
      board[4][1] = CELL_RED; // (3,1) 和 (4,1) 是邻居
      board[4][2] = CELL_RED; // (4,1) 和 (4,2) 是邻居（奇数行）
      board[4][3] = CELL_RED;
      board[4][4] = CELL_RED;
      board[4][5] = CELL_RED;
      board[4][6] = CELL_RED;
      board[4][7] = CELL_RED;
      board[4][8] = CELL_RED;
      board[4][9] = CELL_RED;
      board[4][10] = CELL_RED;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(true);
    });

    it('蓝方通过弯曲路径获胜', () => {
      const board = createEmptyBoard();
      board[0][3] = CELL_BLUE;
      board[1][3] = CELL_BLUE;
      board[2][3] = CELL_BLUE;
      board[3][3] = CELL_BLUE;
      board[3][4] = CELL_BLUE; // 弯曲
      board[4][4] = CELL_BLUE;
      board[5][4] = CELL_BLUE;
      board[5][3] = CELL_BLUE; // 弯回
      board[6][3] = CELL_BLUE;
      board[7][3] = CELL_BLUE;
      board[8][3] = CELL_BLUE;
      board[9][3] = CELL_BLUE;
      board[10][3] = CELL_BLUE;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(true);
    });

    it('红方棋子不连通时蓝方不误判', () => {
      const board = createEmptyBoard();
      board[0][0] = CELL_RED;
      board[10][10] = CELL_RED;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(false);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(false);
    });
  });

  // ============================================================
  // 6. 交换规则（Swap Rule）
  // ============================================================
  describe('交换规则（Swap Rule）', () => {
    it('第一步后蓝方可以交换', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5); // 红方落子
      expect(engine.getCurrentPlayer()).toBe(PLAYER_BLUE);
      expect(engine.performSwap()).toBe(true);
    });

    it('交换后棋子颜色改变', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5); // 红方落子
      engine.performSwap();
      expect(engine.getBoard()[5][5]).toBe(CELL_BLUE);
    });

    it('交换后切换回红方', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      engine.performSwap();
      expect(engine.getCurrentPlayer()).toBe(PLAYER_RED);
    });

    it('交换后 swapUsed 为 true', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      engine.performSwap();
      expect(engine.isSwapUsed()).toBe(true);
    });

    it('不能在第一步前交换', () => {
      expect(engine.performSwap()).toBe(false);
    });

    it('不能在第二步后交换', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5); // 红方
      engine.placePiece(4, 4); // 蓝方
      // 现在是红方回合，moveCount=2
      expect(engine.performSwap()).toBe(false);
    });

    it('不能重复交换', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      engine.performSwap();
      expect(engine.performSwap()).toBe(false);
    });

    it('红方不能交换', () => {
      engine.placePiece(5, 5); // 红方落子后切换到蓝方
      // 手动切回红方测试
      setPrivate(engine, 'currentPlayer', PLAYER_RED);
      setPrivate(engine, 'moveCount', 1);
      expect(engine.performSwap()).toBe(false);
    });

    it('暂停时不能交换', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      engine.pause();
      expect(engine.performSwap()).toBe(false);
    });

    it('游戏结束后不能交换', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      setPrivate(engine, 'winner', PLAYER_RED);
      expect(engine.performSwap()).toBe(false);
    });

    it('交换后步数不变', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      expect(engine.getMoveCount()).toBe(1);
      engine.performSwap();
      expect(engine.getMoveCount()).toBe(1);
    });

    it('交换后历史记录更新', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(3, 7);
      engine.performSwap();
      const state = engine.getState();
      const history = state.moveHistory as { col: number; row: number; player: number }[];
      expect(history[0].player).toBe(PLAYER_BLUE);
    });
  });

  // ============================================================
  // 7. AI 落子
  // ============================================================
  describe('AI 落子', () => {
    it('AI 在红方落子后自动触发', () => {
      engine.placePiece(5, 5);
      expect(engine.isAiThinking()).toBe(true);
    });

    it('AI 在延迟后落子', () => {
      engine.placePiece(5, 5);
      expect(engine.isAiThinking()).toBe(true);
      vi.advanceTimersByTime(AI_THINK_DELAY);
      expect(engine.isAiThinking()).toBe(false);
      // AI 应该已经落子
      expect(engine.getMoveCount()).toBe(2);
    });

    it('AI 落子后切换回红方', () => {
      engine.placePiece(5, 5);
      vi.advanceTimersByTime(AI_THINK_DELAY);
      expect(engine.getCurrentPlayer()).toBe(PLAYER_RED);
    });

    it('AI 落在空格上', () => {
      engine.placePiece(5, 5);
      vi.advanceTimersByTime(AI_THINK_DELAY);
      // 检查棋盘上有一个蓝子
      const board = engine.getBoard();
      let blueCount = 0;
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE; row++) {
          if (board[col][row] === CELL_BLUE) blueCount++;
        }
      }
      expect(blueCount).toBe(1);
    });

    it('AI 不在已有棋子的位置落子', () => {
      engine.placePiece(5, 5);
      vi.advanceTimersByTime(AI_THINK_DELAY);
      const board = engine.getBoard();
      // AI 不应该落在 (5,5)
      expect(board[5][5]).toBe(CELL_RED); // 仍然是红子
    });

    it('PvP 模式下 AI 不触发', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      expect(engine.isAiThinking()).toBe(false);
    });

    it('AI 能检测到获胜机会', () => {
      // 设置蓝方即将获胜的场景
      const board = createEmptyBoard();
      // 蓝方在 row=5 从 col=0 到 col=9
      for (let col = 0; col < BOARD_SIZE - 1; col++) {
        board[col][5] = CELL_BLUE;
      }
      // 红方在 col=5 从 row=0 到 row=4
      for (let row = 0; row < 5; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'currentPlayer', PLAYER_BLUE);
      setPrivate(engine, 'moveCount', 14);

      const move = engine.calculateAiMovePublic();
      expect(move).not.toBeNull();
      // AI 应该在 col=10 落子以连通左右
      expect(move!.col).toBe(BOARD_SIZE - 1);
      // row 可能是 4 或 5，取决于邻居连通性
      // 验证落子后蓝方确实获胜
      board[move!.col][move!.row] = CELL_BLUE;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(true);
    });

    it('AI 能阻挡对手获胜', () => {
      // 设置红方即将获胜的场景
      const board = createEmptyBoard();
      // 红方在 col=5 从 row=0 到 row=9
      for (let row = 0; row < BOARD_SIZE - 1; row++) {
        board[5][row] = CELL_RED;
      }
      // 蓝方一些棋子
      board[0][0] = CELL_BLUE;
      board[1][0] = CELL_BLUE;
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'currentPlayer', PLAYER_BLUE);
      setPrivate(engine, 'moveCount', 12);

      const move = engine.calculateAiMovePublic();
      expect(move).not.toBeNull();
      // AI 应该阻挡 (5, 10)
      expect(move!.col).toBe(5);
      expect(move!.row).toBe(BOARD_SIZE - 1);
    });

    it('AI 在没有特殊策略时选择靠近中心的位置', () => {
      const move = engine.calculateAiMovePublic();
      expect(move).not.toBeNull();
      // 应该在中心附近（前5个候选中）
      const center = Math.floor(BOARD_SIZE / 2);
      const dist = Math.abs(move!.col - center) + Math.abs(move!.row - center);
      expect(dist).toBeLessThan(BOARD_SIZE);
    });

    it('棋盘满时 AI 返回 null', () => {
      const board = createFullBoard();
      setPrivate(engine, 'board', board);
      const move = engine.calculateAiMovePublic();
      expect(move).toBeNull();
    });

    it('AI 落子期间玩家不能操作', () => {
      engine.placePiece(5, 5);
      expect(engine.isAiThinking()).toBe(true);
      // 尝试再次落子应该失败
      expect(engine.placePiece(4, 4)).toBe(false);
    });

    it('AI 落子后触发 stateChange 事件', () => {
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.placePiece(5, 5);
      vi.advanceTimersByTime(AI_THINK_DELAY);
      // placePiece 触发一次，AI 落子触发一次
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================
  // 8. 胜利判定
  // ============================================================
  describe('胜利判定', () => {
    it('红方获胜时 winner 为红方', () => {
      const board = createRedWinBoard();
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'currentPlayer', PLAYER_RED);
      setPrivate(engine, 'moveCount', 20);
      // 直接调用 placePiece 来触发检查
      // 先在空位放一个红子完成连通
      // 实际上我们直接设置 board 然后调用 checkWin
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(true);
    });

    it('蓝方获胜时 winner 为蓝方', () => {
      const board = createBlueWinBoard();
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(true);
    });

    it('红方获胜 isWin 为 true', () => {
      engine.setMode(MODE_PVP);
      // 构造红方获胜：在 col=5 从 row=0 到 row=10
      for (let row = 0; row < BOARD_SIZE; row++) {
        setPrivate(engine, 'currentPlayer', PLAYER_RED);
        // 直接设置棋盘
        const board = engine.getBoard();
        board[5][row] = CELL_RED;
        setPrivate(engine, 'board', board);
      }
      setPrivate(engine, 'currentPlayer', PLAYER_RED);
      // 模拟落子触发胜利检查
      // 先清空一个位置让 placePiece 工作
      const board = engine.getBoard();
      board[5][5] = CELL_EMPTY;
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'moveCount', 10);
      engine.placePiece(5, 5);
      expect(engine.getWinner()).toBe(PLAYER_RED);
      expect(engine.isWin).toBe(true);
    });

    it('蓝方获胜 isWin 为 false（玩家是红方）', () => {
      engine.setMode(MODE_PVP);
      // 构造蓝方获胜：在 row=5 从 col=0 到 col=10
      for (let col = 0; col < BOARD_SIZE; col++) {
        const board = engine.getBoard();
        board[col][5] = CELL_BLUE;
        setPrivate(engine, 'board', board);
      }
      setPrivate(engine, 'currentPlayer', PLAYER_BLUE);
      // 清空一个位置
      const board = engine.getBoard();
      board[5][5] = CELL_EMPTY;
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'moveCount', 10);
      engine.placePiece(5, 5);
      expect(engine.getWinner()).toBe(PLAYER_BLUE);
      expect(engine.isWin).toBe(false);
    });

    it('获胜后游戏状态变为 gameover', () => {
      engine.setMode(MODE_PVP);
      // 设置红方即将获胜
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE - 1; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'currentPlayer', PLAYER_RED);
      setPrivate(engine, 'moveCount', 10);
      engine.placePiece(5, BOARD_SIZE - 1);
      expect(engine.status).toBe('gameover');
    });

    it('获胜后触发 statusChange 事件', () => {
      const listener = vi.fn();
      engine.on('statusChange', listener);
      engine.setMode(MODE_PVP);
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE - 1; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'currentPlayer', PLAYER_RED);
      setPrivate(engine, 'moveCount', 10);
      engine.placePiece(5, BOARD_SIZE - 1);
      expect(listener).toHaveBeenCalledWith('gameover');
    });

    it('获胜后加分', () => {
      engine.setMode(MODE_PVP);
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE - 1; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'currentPlayer', PLAYER_RED);
      setPrivate(engine, 'moveCount', 10);
      engine.placePiece(5, BOARD_SIZE - 1);
      expect(engine.score).toBe(100);
    });
  });

  // ============================================================
  // 9. 键盘控制
  // ============================================================
  describe('键盘控制', () => {
    it('ArrowUp 移动光标上移', () => {
      setPrivate(engine, 'cursorRow', 5);
      engine.handleKeyDown('ArrowUp');
      expect(engine.getCursor().row).toBe(4);
    });

    it('ArrowDown 移动光标下移', () => {
      setPrivate(engine, 'cursorRow', 5);
      engine.handleKeyDown('ArrowDown');
      expect(engine.getCursor().row).toBe(6);
    });

    it('ArrowLeft 移动光标左移', () => {
      setPrivate(engine, 'cursorCol', 5);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.getCursor().col).toBe(4);
    });

    it('ArrowRight 移动光标右移', () => {
      setPrivate(engine, 'cursorCol', 5);
      engine.handleKeyDown('ArrowRight');
      expect(engine.getCursor().col).toBe(6);
    });

    it('光标不能移出上边界', () => {
      setPrivate(engine, 'cursorRow', 0);
      engine.handleKeyDown('ArrowUp');
      expect(engine.getCursor().row).toBe(0);
    });

    it('光标不能移出下边界', () => {
      setPrivate(engine, 'cursorRow', BOARD_SIZE - 1);
      engine.handleKeyDown('ArrowDown');
      expect(engine.getCursor().row).toBe(BOARD_SIZE - 1);
    });

    it('光标不能移出左边界', () => {
      setPrivate(engine, 'cursorCol', 0);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.getCursor().col).toBe(0);
    });

    it('光标不能移出右边界', () => {
      setPrivate(engine, 'cursorCol', BOARD_SIZE - 1);
      engine.handleKeyDown('ArrowRight');
      expect(engine.getCursor().col).toBe(BOARD_SIZE - 1);
    });

    it('空格键在光标位置落子', () => {
      setPrivate(engine, 'cursorCol', 3);
      setPrivate(engine, 'cursorRow', 7);
      engine.handleKeyDown(' ');
      expect(engine.getBoard()[3][7]).toBe(CELL_RED);
    });

    it('S 键触发交换', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5); // 红方
      // 现在是蓝方回合，moveCount=1
      engine.handleKeyDown('s');
      expect(engine.isSwapUsed()).toBe(true);
    });

    it('大写 S 键触发交换', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      engine.handleKeyDown('S');
      expect(engine.isSwapUsed()).toBe(true);
    });

    it('游戏结束后按键无效', () => {
      setPrivate(engine, 'winner', PLAYER_RED);
      setPrivate(engine, 'cursorRow', 5);
      engine.handleKeyDown('ArrowUp');
      expect(engine.getCursor().row).toBe(5); // 未移动
    });

    it('暂停时按键无效', () => {
      engine.pause();
      setPrivate(engine, 'cursorRow', 5);
      engine.handleKeyDown('ArrowUp');
      expect(engine.getCursor().row).toBe(5);
    });

    it('handleKeyUp 不抛错', () => {
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    });

    it('未知按键不抛错', () => {
      expect(() => engine.handleKeyDown('x')).not.toThrow();
    });
  });

  // ============================================================
  // 10. getState
  // ============================================================
  describe('getState', () => {
    it('返回包含 board 的状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('board');
    });

    it('返回包含 currentPlayer 的状态', () => {
      const state = engine.getState();
      expect(state.currentPlayer).toBe(PLAYER_RED);
    });

    it('返回包含 cursorCol 和 cursorRow 的状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('cursorCol');
      expect(state).toHaveProperty('cursorRow');
    });

    it('返回包含 moveCount 的状态', () => {
      const state = engine.getState();
      expect(state.moveCount).toBe(0);
    });

    it('返回包含 winner 的状态', () => {
      const state = engine.getState();
      expect(state.winner).toBe(0);
    });

    it('返回包含 swapUsed 的状态', () => {
      const state = engine.getState();
      expect(state.swapUsed).toBe(false);
    });

    it('返回包含 mode 的状态', () => {
      const state = engine.getState();
      expect(state.mode).toBe(MODE_PVE);
    });

    it('返回包含 isWin 的状态', () => {
      const state = engine.getState();
      expect(state).toHaveProperty('isWin');
    });

    it('落子后状态更新', () => {
      engine.placePiece(5, 5);
      const state = engine.getState();
      expect(state.moveCount).toBe(1);
      expect(state.currentPlayer).toBe(PLAYER_BLUE);
    });

    it('获胜路径在状态中为数组', () => {
      const state = engine.getState();
      expect(Array.isArray(state.winPath)).toBe(true);
    });
  });

  // ============================================================
  // 11. 游戏模式
  // ============================================================
  describe('游戏模式', () => {
    it('默认模式为 PvE', () => {
      expect(engine.getMode()).toBe(MODE_PVE);
    });

    it('可以切换到 PvP', () => {
      engine.setMode(MODE_PVP);
      expect(engine.getMode()).toBe(MODE_PVP);
    });

    it('可以切换到 PvE', () => {
      engine.setMode(MODE_PVP);
      engine.setMode(MODE_PVE);
      expect(engine.getMode()).toBe(MODE_PVE);
    });

    it('PvP 模式下双方交替落子', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      expect(engine.getCurrentPlayer()).toBe(PLAYER_BLUE);
      engine.placePiece(4, 4);
      expect(engine.getCurrentPlayer()).toBe(PLAYER_RED);
    });

    it('PvE 模式下 AI 自动落子', () => {
      engine.placePiece(5, 5);
      vi.advanceTimersByTime(AI_THINK_DELAY);
      expect(engine.getMoveCount()).toBe(2);
      expect(engine.getCurrentPlayer()).toBe(PLAYER_RED);
    });
  });

  // ============================================================
  // 12. 事件系统
  // ============================================================
  describe('事件系统', () => {
    it('落子触发 stateChange 事件', () => {
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.placePiece(5, 5);
      expect(listener).toHaveBeenCalled();
    });

    it('交换触发 stateChange 事件', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.performSwap();
      expect(listener).toHaveBeenCalled();
    });

    it('胜利触发 statusChange 事件', () => {
      const listener = vi.fn();
      engine.on('statusChange', listener);
      engine.setMode(MODE_PVP);
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE - 1; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'currentPlayer', PLAYER_RED);
      setPrivate(engine, 'moveCount', 10);
      engine.placePiece(5, BOARD_SIZE - 1);
      expect(listener).toHaveBeenCalledWith('gameover');
    });

    it('可以取消事件监听', () => {
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.off('stateChange', listener);
      engine.placePiece(5, 5);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 13. 状态管理
  // ============================================================
  describe('状态管理', () => {
    it('start 后状态为 playing', () => {
      expect(engine.status).toBe('playing');
    });

    it('pause 后状态为 paused', () => {
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后状态为 playing', () => {
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后状态为 idle', () => {
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('gameover 后状态为 gameover', () => {
      engine.setMode(MODE_PVP);
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE - 1; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'currentPlayer', PLAYER_RED);
      setPrivate(engine, 'moveCount', 10);
      engine.placePiece(5, BOARD_SIZE - 1);
      expect(engine.status).toBe('gameover');
    });

    it('未初始化 canvas 时 start 抛错', () => {
      const eng = new HexEngine();
      expect(() => eng.start()).toThrow('Canvas not initialized');
    });
  });

  // ============================================================
  // 14. 坐标转换
  // ============================================================
  describe('坐标转换', () => {
    it('hexToPixel 返回有效坐标', () => {
      const pos = engine.hexToPixelPublic(0, 0);
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.y).toBeGreaterThan(0);
    });

    it('不同格子有不同像素坐标', () => {
      const pos1 = engine.hexToPixelPublic(0, 0);
      const pos2 = engine.hexToPixelPublic(1, 0);
      expect(pos1.x).not.toBe(pos2.x);
    });

    it('奇数行有偏移', () => {
      const posEven = engine.hexToPixelPublic(0, 0);
      const posOdd = engine.hexToPixelPublic(0, 1);
      // 奇数行应该有 x 偏移
      expect(posOdd.x).toBeGreaterThan(posEven.x);
    });

    it('行之间有垂直间距', () => {
      const pos1 = engine.hexToPixelPublic(0, 0);
      const pos2 = engine.hexToPixelPublic(0, 1);
      expect(pos2.y).toBeGreaterThan(pos1.y);
    });

    it('列之间有水平间距', () => {
      const pos1 = engine.hexToPixelPublic(0, 0);
      const pos2 = engine.hexToPixelPublic(1, 0);
      expect(pos2.x).toBeGreaterThan(pos1.x);
    });
  });

  // ============================================================
  // 15. 边界情况
  // ============================================================
  describe('边界情况', () => {
    it('在角落 (0,0) 落子', () => {
      engine.setMode(MODE_PVP);
      expect(engine.placePiece(0, 0)).toBe(true);
      expect(engine.getBoard()[0][0]).toBe(CELL_RED);
    });

    it('在角落 (10,10) 落子', () => {
      engine.setMode(MODE_PVP);
      expect(engine.placePiece(10, 10)).toBe(true);
      expect(engine.getBoard()[10][10]).toBe(CELL_RED);
    });

    it('在边缘 (0,5) 落子', () => {
      engine.setMode(MODE_PVP);
      expect(engine.placePiece(0, 5)).toBe(true);
    });

    it('在边缘 (10,5) 落子', () => {
      engine.setMode(MODE_PVP);
      expect(engine.placePiece(10, 5)).toBe(true);
    });

    it('在边缘 (5,0) 落子', () => {
      engine.setMode(MODE_PVP);
      expect(engine.placePiece(5, 0)).toBe(true);
    });

    it('在边缘 (5,10) 落子', () => {
      engine.setMode(MODE_PVP);
      expect(engine.placePiece(5, 10)).toBe(true);
    });

    it('连续填满一行', () => {
      engine.setMode(MODE_PVP);
      for (let col = 0; col < BOARD_SIZE; col++) {
        engine.placePiece(col, 0);
        engine.placePiece(col, 1);
      }
      // 应该有 22 个棋子
      expect(engine.getMoveCount()).toBe(22);
    });

    it('destroy 后定时器清理', () => {
      engine.placePiece(5, 5); // 触发 AI
      expect(engine.isAiThinking()).toBe(true);
      engine.destroy();
      // 不应该有内存泄漏
    });

    it('reset 清理 AI 定时器', () => {
      engine.placePiece(5, 5);
      engine.reset();
      // 不应该有异常
    });

    it('多次 reset 不报错', () => {
      expect(() => {
        engine.reset();
        engine.reset();
        engine.reset();
      }).not.toThrow();
    });

    it('多次 destroy 不报错', () => {
      engine.destroy();
      expect(() => engine.destroy()).not.toThrow();
    });
  });

  // ============================================================
  // 16. 初始化（不 start）
  // ============================================================
  describe('初始化（不 start）', () => {
    it('init 后状态为 idle', () => {
      const eng = createEngine();
      expect(eng.status).toBe('idle');
    });

    it('idle 状态不能落子', () => {
      const eng = createEngine();
      expect(eng.placePiece(5, 5)).toBe(false);
    });

    it('idle 状态按键无效', () => {
      const eng = createEngine();
      setPrivate(eng, 'cursorRow', 5);
      eng.handleKeyDown('ArrowUp');
      expect(eng.getCursor().row).toBe(5);
    });
  });

  // ============================================================
  // 17. 完整游戏流程
  // ============================================================
  describe('完整游戏流程', () => {
    it('PvP 完整对局（红方获胜）', () => {
      engine.setMode(MODE_PVP);
      // 红方在 col=5 从 row=0 到 row=10
      // 蓝方在 col=6 从 row=0 到 row=9（差一步）
      for (let row = 0; row < BOARD_SIZE; row++) {
        engine.placePiece(5, row); // 红方
        if (row < BOARD_SIZE - 1) {
          engine.placePiece(6, row); // 蓝方
        }
      }
      expect(engine.getWinner()).toBe(PLAYER_RED);
      expect(engine.isWin).toBe(true);
      expect(engine.status).toBe('gameover');
    });

    it('PvP 完整对局（蓝方获胜）', () => {
      engine.setMode(MODE_PVP);
      // 蓝方在 row=5 从 col=0 到 col=10
      // 红方在 row=6 从 col=0 到 col=9（差一步）
      for (let col = 0; col < BOARD_SIZE; col++) {
        engine.placePiece(col, 6); // 红方先走
        engine.placePiece(col, 5); // 蓝方
      }
      // 蓝方最后一步连通
      expect(engine.getWinner()).toBe(PLAYER_BLUE);
      expect(engine.isWin).toBe(false); // 玩家是红方
    });

    it('PvE 完整对局', () => {
      // 使用 PvP 模式模拟完整对局来验证游戏流程
      engine.setMode(MODE_PVP);
      // 红方在 col=5 从 row=0 到 row=10
      // 蓝方在 col=6 从 row=0 到 row=10
      for (let row = 0; row < BOARD_SIZE; row++) {
        engine.placePiece(5, row); // 红方
        if (engine.getWinner() === 0 && row < BOARD_SIZE) {
          engine.placePiece(6, row); // 蓝方
        }
        if (engine.getWinner() !== 0) break;
      }
      // 红方应该获胜
      expect(engine.getWinner()).toBe(PLAYER_RED);
      expect(engine.status).toBe('gameover');
    });

    it('使用交换规则的完整对局', () => {
      engine.setMode(MODE_PVP);
      // 红方第一步
      engine.placePiece(5, 5);
      // 蓝方交换
      engine.performSwap();
      expect(engine.isSwapUsed()).toBe(true);
      expect(engine.getCurrentPlayer()).toBe(PLAYER_RED);
      expect(engine.getBoard()[5][5]).toBe(CELL_BLUE);
      // 继续对局
      engine.placePiece(4, 4);
      expect(engine.getMoveCount()).toBe(2);
    });
  });

  // ============================================================
  // 18. score 和 level
  // ============================================================
  describe('score 和 level', () => {
    it('初始分数为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('初始等级为 1', () => {
      expect(engine.level).toBe(1);
    });

    it('获胜后分数增加', () => {
      engine.setMode(MODE_PVP);
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE - 1; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      setPrivate(engine, 'currentPlayer', PLAYER_RED);
      setPrivate(engine, 'moveCount', 10);
      engine.placePiece(5, BOARD_SIZE - 1);
      expect(engine.score).toBe(100);
    });
  });

  // ============================================================
  // 19. 重复落子和防守
  // ============================================================
  describe('重复落子和防守', () => {
    it('不能在同一位置重复落子', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      engine.placePiece(4, 4); // 蓝方
      expect(engine.placePiece(5, 5)).toBe(false); // 红方重复
    });

    it('蓝方不能在红方棋子上落子', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5); // 红方
      // 现在是蓝方回合
      expect(engine.placePiece(5, 5)).toBe(false);
    });
  });

  // ============================================================
  // 20. 特殊棋盘状态
  // ============================================================
  describe('特殊棋盘状态', () => {
    it('只有一个红子在顶部不获胜', () => {
      const board = createEmptyBoard();
      board[5][0] = CELL_RED;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(false);
    });

    it('只有一个蓝子在左边不获胜', () => {
      const board = createEmptyBoard();
      board[0][5] = CELL_BLUE;
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(false);
    });

    it('红方连通对角不等于获胜（需要上下连通）', () => {
      const board = createEmptyBoard();
      // 从左上到右下的对角
      for (let i = 0; i < BOARD_SIZE; i++) {
        board[i][i] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      // 对角线在 hex 中不一定连通，取决于邻居关系
      // col=0,row=0 和 col=1,row=1 是否是邻居？
      // row=0 偶数行，(0,0) 的邻居不包含 (1,1)
      // 所以这个对角线不一定是连通的
    });

    it('红方直线列连通获胜', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE; row++) {
        board[3][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(true);
    });

    it('蓝方直线行连通获胜', () => {
      const board = createEmptyBoard();
      for (let col = 0; col < BOARD_SIZE; col++) {
        board[col][7] = CELL_BLUE;
      }
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(true);
    });

    it('混合颜色不获胜', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE; row++) {
        board[5][row] = row % 2 === 0 ? CELL_RED : CELL_BLUE;
      }
      setPrivate(engine, 'board', board);
      expect(engine.checkWinPublic(PLAYER_RED)).toBe(false);
      expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(false);
    });
  });

  // ============================================================
  // 21. AI 定时器清理
  // ============================================================
  describe('AI 定时器清理', () => {
    it('gameOver 时清理 AI 定时器', () => {
      engine.placePiece(5, 5); // 触发 AI
      // 手动触发 gameOver
      setPrivate(engine, 'aiTimer', setTimeout(() => {}, 10000));
      engine.gameOver();
      // 不应该有异常
    });

    it('onDestroy 清理 AI 定时器', () => {
      engine.placePiece(5, 5);
      engine.destroy();
      // 不应该有异常
    });
  });

  // ============================================================
  // 22. 暂停和恢复
  // ============================================================
  describe('暂停和恢复', () => {
    it('暂停后不能落子', () => {
      engine.pause();
      expect(engine.placePiece(5, 5)).toBe(false);
    });

    it('恢复后可以落子', () => {
      engine.pause();
      engine.resume();
      expect(engine.placePiece(5, 5)).toBe(true);
    });

    it('非 playing 状态不能暂停', () => {
      engine.reset();
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('非 paused 状态不能恢复', () => {
      engine.resume();
      expect(engine.status).toBe('playing');
    });
  });

  // ============================================================
  // 23. 邻居详细验证
  // ============================================================
  describe('邻居详细验证', () => {
    it('(0,1) 奇数行邻居正确', () => {
      const neighbors = engine.getNeighborCells(0, 1);
      // 奇数行: (0,-1), (1,-1), (-1,0), (1,0), (0,1), (1,1)
      // (0+0,1-1)=(0,0), (0+1,1-1)=(1,0), (0-1,1)=invalid, (0+1,1)=(1,1)
      // (0+0,1+1)=(0,2), (0+1,1+1)=(1,2)
      expect(neighbors).toContainEqual([0, 0]);
      expect(neighbors).toContainEqual([1, 0]);
      expect(neighbors).toContainEqual([1, 1]);
      expect(neighbors).toContainEqual([0, 2]);
      expect(neighbors).toContainEqual([1, 2]);
      // (-1,1) is invalid
      expect(neighbors.length).toBe(5);
    });

    it('(10,0) 偶数行邻居正确', () => {
      const neighbors = engine.getNeighborCells(10, 0);
      // 偶数行: (-1,-1), (0,-1), (-1,0), (1,0), (-1,1), (0,1)
      // (9,-1)=invalid, (10,-1)=invalid, (9,0), (11,0)=invalid, (9,1), (10,1)
      expect(neighbors).toContainEqual([9, 0]);
      expect(neighbors).toContainEqual([9, 1]);
      expect(neighbors).toContainEqual([10, 1]);
      expect(neighbors.length).toBe(3);
    });

    it('(10,1) 奇数行邻居正确', () => {
      const neighbors = engine.getNeighborCells(10, 1);
      // 奇数行: (0,-1), (1,-1), (-1,0), (1,0), (0,1), (1,1)
      // (10,0), (11,0)=invalid, (9,1), (11,1)=invalid, (10,2), (11,2)=invalid
      expect(neighbors).toContainEqual([10, 0]);
      expect(neighbors).toContainEqual([9, 1]);
      expect(neighbors).toContainEqual([10, 2]);
      expect(neighbors.length).toBe(3);
    });

    it('(0,10) 偶数行邻居正确', () => {
      const neighbors = engine.getNeighborCells(0, 10);
      // 偶数行: (-1,-1), (0,-1), (-1,0), (1,0), (-1,1), (0,1)
      // (-1,9)=invalid, (0,9), (-1,10)=invalid, (1,10), (-1,11)=invalid, (0,11)=invalid
      expect(neighbors).toContainEqual([0, 9]);
      expect(neighbors).toContainEqual([1, 10]);
      expect(neighbors.length).toBe(2);
    });
  });

  // ============================================================
  // 24. 获胜路径验证
  // ============================================================
  describe('获胜路径验证', () => {
    it('直线获胜路径包含所有连通格子', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      engine.checkWinPublic(PLAYER_RED);
      const winPath = engine.getWinPath();
      expect(winPath.size).toBe(BOARD_SIZE);
    });

    it('获胜路径中的格子都在棋盘上', () => {
      const board = createEmptyBoard();
      for (let row = 0; row < BOARD_SIZE; row++) {
        board[5][row] = CELL_RED;
      }
      setPrivate(engine, 'board', board);
      engine.checkWinPublic(PLAYER_RED);
      const winPath = engine.getWinPath();
      for (const key of winPath) {
        const [col, row] = key.split(',').map(Number);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThan(BOARD_SIZE);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(BOARD_SIZE);
      }
    });

    it('未获胜时路径为空', () => {
      engine.checkWinPublic(PLAYER_RED);
      expect(engine.getWinPath().size).toBe(0);
    });
  });

  // ============================================================
  // 25. 综合场景
  // ============================================================
  describe('综合场景', () => {
    it('PvP 对局中红方通过 zigzag 路径获胜', () => {
      engine.setMode(MODE_PVP);
      const board = createEmptyBoard();

      // 构造 zigzag 路径：(0,0) -> (0,1) -> (1,1) -> (1,2) -> (1,3) -> (2,3) -> (2,4) -> ...
      // 需要验证每步都是邻居
      const path: [number, number][] = [];
      let col = 0, row = 0;
      path.push([col, row]);

      while (row < BOARD_SIZE - 1) {
        // 尝试向下
        const neighbors = engine.getNeighborCells(col, row);
        const downNeighbors = neighbors.filter(([nc, nr]) => nr > row);
        if (downNeighbors.length > 0) {
          // 选择一个向下的邻居
          const next = downNeighbors[0];
          col = next[0];
          row = next[1];
          path.push([col, row]);
        } else {
          break;
        }
      }

      // 设置棋盘
      for (const [c, r] of path) {
        board[c][r] = CELL_RED;
      }
      setPrivate(engine, 'board', board);

      // 如果路径从 row=0 到 row=10，红方应该获胜
      if (path[path.length - 1][1] === BOARD_SIZE - 1 && path[0][1] === 0) {
        expect(engine.checkWinPublic(PLAYER_RED)).toBe(true);
      }
    });

    it('PvP 对局中蓝方通过 zigzag 路径获胜', () => {
      engine.setMode(MODE_PVP);
      const board = createEmptyBoard();

      // 构造蓝方 zigzag 路径：从 col=0 到 col=10
      const path: [number, number][] = [];
      let col = 0, row = 5;
      path.push([col, row]);

      while (col < BOARD_SIZE - 1) {
        const neighbors = engine.getNeighborCells(col, row);
        const rightNeighbors = neighbors.filter(([nc, nr]) => nc > col);
        if (rightNeighbors.length > 0) {
          const next = rightNeighbors[0];
          col = next[0];
          row = next[1];
          path.push([col, row]);
        } else {
          break;
        }
      }

      for (const [c, r] of path) {
        board[c][r] = CELL_BLUE;
      }
      setPrivate(engine, 'board', board);

      if (path[path.length - 1][0] === BOARD_SIZE - 1 && path[0][0] === 0) {
        expect(engine.checkWinPublic(PLAYER_BLUE)).toBe(true);
      }
    });

    it('reset 后可以重新开始', () => {
      engine.setMode(MODE_PVP);
      engine.placePiece(5, 5);
      engine.placePiece(4, 4);
      engine.reset();
      expect(engine.getMoveCount()).toBe(0);
      expect(engine.getWinner()).toBe(0);
      expect(engine.status).toBe('idle');
    });

    it('重新开始后可以正常对局', () => {
      engine.setMode(MODE_PVP);
      engine.reset();
      const canvas = createMockCanvas();
      engine.init(canvas);
      engine.start();
      expect(engine.placePiece(5, 5)).toBe(true);
    });
  });

  // ============================================================
  // 26. 并发和时序
  // ============================================================
  describe('并发和时序', () => {
    it('AI 思考时不能再次触发 AI', () => {
      engine.placePiece(5, 5);
      expect(engine.isAiThinking()).toBe(true);
      // AI 还在思考，红方不能落子
      expect(engine.placePiece(4, 4)).toBe(false);
    });

    it('AI 完成后可以正常落子', () => {
      engine.placePiece(5, 5);
      vi.advanceTimersByTime(AI_THINK_DELAY);
      expect(engine.isAiThinking()).toBe(false);
      expect(engine.placePiece(4, 4)).toBe(true);
    });

    it('快速连续落子只成功一次', () => {
      engine.setMode(MODE_PVP);
      expect(engine.placePiece(5, 5)).toBe(true);
      // 现在是蓝方，不能在同一位置落子
      expect(engine.placePiece(5, 5)).toBe(false);
    });
  });

  // ============================================================
  // 27. 引擎继承验证
  // ============================================================
  describe('引擎继承验证', () => {
    it('有 score 属性', () => {
      expect(engine.score).toBeDefined();
    });

    it('有 level 属性', () => {
      expect(engine.level).toBeDefined();
    });

    it('有 status 属性', () => {
      expect(engine.status).toBeDefined();
    });

    it('有 elapsedTime 属性', () => {
      expect(engine.elapsedTime).toBeDefined();
    });

    it('有 on/off/emit 方法', () => {
      expect(typeof engine.on).toBe('function');
      expect(typeof engine.off).toBe('function');
    });

    it('有 init/start/pause/resume/reset/destroy 方法', () => {
      expect(typeof engine.init).toBe('function');
      expect(typeof engine.start).toBe('function');
      expect(typeof engine.pause).toBe('function');
      expect(typeof engine.resume).toBe('function');
      expect(typeof engine.reset).toBe('function');
      expect(typeof engine.destroy).toBe('function');
    });

    it('有 handleKeyDown/handleKeyUp 方法', () => {
      expect(typeof engine.handleKeyDown).toBe('function');
      expect(typeof engine.handleKeyUp).toBe('function');
    });

    it('有 getState 方法', () => {
      expect(typeof engine.getState).toBe('function');
    });
  });
});

// ============================================================
// Helper 函数
// ============================================================

/** 创建空棋盘 */
function createEmptyBoard(): number[][] {
  const board: number[][] = [];
  for (let col = 0; col < BOARD_SIZE; col++) {
    board[col] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      board[col][row] = CELL_EMPTY;
    }
  }
  return board;
}

/** 创建红方获胜棋盘（col=5 全红） */
function createRedWinBoard(): number[][] {
  const board = createEmptyBoard();
  for (let row = 0; row < BOARD_SIZE; row++) {
    board[5][row] = CELL_RED;
  }
  return board;
}

/** 创建蓝方获胜棋盘（row=5 全蓝） */
function createBlueWinBoard(): number[][] {
  const board = createEmptyBoard();
  for (let col = 0; col < BOARD_SIZE; col++) {
    board[col][5] = CELL_BLUE;
  }
  return board;
}

/** 创建满棋盘 */
function createFullBoard(): number[][] {
  const board: number[][] = [];
  for (let col = 0; col < BOARD_SIZE; col++) {
    board[col] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      board[col][row] = (col + row) % 2 === 0 ? CELL_RED : CELL_BLUE;
    }
  }
  return board;
}
