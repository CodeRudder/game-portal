import { GomokuEngine } from '@/games/gomoku/GomokuEngine';
import {
  BOARD_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  CELL_SIZE,
  AI_SCORES,
  SCORE_WIN,
  SCORE_PER_STONE,
  SCORE_AI_BONUS,
  AI_THINK_DELAY,
} from '@/games/gomoku/constants';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): GomokuEngine {
  const engine = new GomokuEngine();
  const canvas = createCanvas();
  engine.init(canvas);
  return engine;
}

function startEngine(): GomokuEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 调用内部 update */
function advanceUpdate(engine: GomokuEngine, deltaTime: number): void {
  (engine as unknown as { update(d: number): void }).update(deltaTime);
}

/** 获取内部 board */
function getBoard(engine: GomokuEngine): number[][] {
  return (engine as unknown as { board: number[][] }).board;
}

/** 设置棋盘格子 */
function setCell(engine: GomokuEngine, row: number, col: number, value: number): void {
  (engine as unknown as { board: number[][] }).board[row][col] = value;
}

/** 获取当前玩家 */
function getCurrentPlayer(engine: GomokuEngine): number {
  return (engine as unknown as { currentPlayer: number }).currentPlayer;
}

/** 获取赢家 */
function getWinner(engine: GomokuEngine): number {
  return (engine as unknown as { winner: number }).winner;
}

/** 获取平局状态 */
function getIsDraw(engine: GomokuEngine): boolean {
  return (engine as unknown as { isDraw: boolean }).isDraw;
}

/** 获取光标位置 */
function getCursor(engine: GomokuEngine): { row: number; col: number } {
  return {
    row: (engine as unknown as { cursorRow: number }).cursorRow,
    col: (engine as unknown as { cursorCol: number }).cursorCol,
  };
}

/** 获取模式 */
function getMode(engine: GomokuEngine): string {
  return (engine as unknown as { mode: string }).mode;
}

/** 获取 moveCount */
function getMoveCount(engine: GomokuEngine): number {
  return (engine as unknown as { moveCount: number }).moveCount;
}

/** 获取 lastMove */
function getLastMove(engine: GomokuEngine): { row: number; col: number } | null {
  return (engine as unknown as { lastMove: { row: number; col: number } | null }).lastMove;
}

/** 获取 aiThinking */
function isAIThinking(engine: GomokuEngine): boolean {
  return (engine as unknown as { aiThinking: boolean }).aiThinking;
}

/** 直接调用 placeMove */
function placeMove(engine: GomokuEngine, row: number, col: number): boolean {
  return (engine as unknown as { placeMove(r: number, c: number): boolean }).placeMove(row, col);
}

/** 直接调用 checkWin */
function checkWin(engine: GomokuEngine, row: number, col: number, player: number): boolean {
  return (engine as unknown as { checkWin(r: number, c: number, p: number): boolean }).checkWin(row, col, player);
}

/** 直接调用 aiMove */
function aiMove(engine: GomokuEngine): void {
  (engine as unknown as { aiMove(): void }).aiMove();
}

/** 直接调用 checkDraw */
function checkDraw(engine: GomokuEngine): boolean {
  return (engine as unknown as { checkDraw(): boolean }).checkDraw();
}

/** 直接调用 evaluatePosition */
function evaluatePosition(engine: GomokuEngine, row: number, col: number, player: number): number {
  return (engine as unknown as { evaluatePosition(r: number, c: number, p: number): number }).evaluatePosition(row, col, player);
}

/** 设置模式 */
function setMode(engine: GomokuEngine, mode: 'PvP' | 'AI'): void {
  (engine as unknown as { mode: string }).mode = mode;
}

/** 设置 AI 思考状态 */
function setAIThinking(engine: GomokuEngine, val: boolean): void {
  (engine as unknown as { aiThinking: boolean }).aiThinking = val;
}

// ========== 测试 ==========

describe('GomokuEngine', () => {

  // ==================== T1: 初始化 ====================
  describe('初始化', () => {
    it('init 后 status 为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('init 后棋盘为 15×15 空棋盘（全 0）', () => {
      const engine = createEngine();
      const board = getBoard(engine);
      expect(board).toHaveLength(BOARD_SIZE);
      for (let r = 0; r < BOARD_SIZE; r++) {
        expect(board[r]).toHaveLength(BOARD_SIZE);
        for (let c = 0; c < BOARD_SIZE; c++) {
          expect(board[r][c]).toBe(0);
        }
      }
    });

    it('init 后当前玩家为黑（1）', () => {
      const engine = createEngine();
      expect(getCurrentPlayer(engine)).toBe(1);
    });

    it('init 后光标在天元 (7,7)', () => {
      const engine = createEngine();
      const cursor = getCursor(engine);
      expect(cursor.row).toBe(7);
      expect(cursor.col).toBe(7);
    });

    it('init 后无赢家', () => {
      const engine = createEngine();
      expect(getWinner(engine)).toBe(0);
    });

    it('start 后 status 为 playing', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
    });

    it('start 后 score 为 0', () => {
      const engine = startEngine();
      expect(engine.score).toBe(0);
    });

    it('start 后 isWin 为 false', () => {
      const engine = startEngine();
      expect(engine.isWin).toBe(false);
    });
  });

  // ==================== T2: 落子逻辑 ====================
  describe('落子逻辑', () => {
    it('黑棋可以在空位落子', () => {
      const engine = startEngine();
      const result = placeMove(engine, 7, 7);
      expect(result).toBe(true);
      expect(getBoard(engine)[7][7]).toBe(1);
    });

    it('落子后切换到白棋', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      expect(getCurrentPlayer(engine)).toBe(2);
    });

    it('白棋也可以落子', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7); // 黑
      placeMove(engine, 7, 8); // 白
      expect(getBoard(engine)[7][8]).toBe(2);
    });

    it('不能在已占用的位置落子', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      const result = placeMove(engine, 7, 7);
      expect(result).toBe(false);
    });

    it('落子后 moveCount 增加', () => {
      const engine = startEngine();
      expect(getMoveCount(engine)).toBe(0);
      placeMove(engine, 7, 7);
      expect(getMoveCount(engine)).toBe(1);
      placeMove(engine, 7, 8);
      expect(getMoveCount(engine)).toBe(2);
    });

    it('落子后 lastMove 更新', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      const last = getLastMove(engine);
      expect(last).toEqual({ row: 7, col: 7 });
    });

    it('不能在越界位置落子', () => {
      const engine = startEngine();
      expect(placeMove(engine, -1, 0)).toBe(false);
      expect(placeMove(engine, 0, -1)).toBe(false);
      expect(placeMove(engine, BOARD_SIZE, 0)).toBe(false);
      expect(placeMove(engine, 0, BOARD_SIZE)).toBe(false);
    });
  });

  // ==================== T3: 胜负检测（四方向连五） ====================
  describe('胜负检测', () => {
    it('水平方向连五获胜', () => {
      const engine = startEngine();
      // 黑: (7,3)(7,4)(7,5)(7,6)(7,7)
      // 白: (8,3)(8,4)(8,5)(8,6)
      placeMove(engine, 7, 3); // 黑
      placeMove(engine, 8, 3); // 白
      placeMove(engine, 7, 4); // 黑
      placeMove(engine, 8, 4); // 白
      placeMove(engine, 7, 5); // 黑
      placeMove(engine, 8, 5); // 白
      placeMove(engine, 7, 6); // 黑
      placeMove(engine, 8, 6); // 白
      placeMove(engine, 7, 7); // 黑 → 连五
      expect(getWinner(engine)).toBe(1);
      expect(engine.isWin).toBe(true);
    });

    it('垂直方向连五获胜', () => {
      const engine = startEngine();
      // 黑: (3,7)(4,7)(5,7)(6,7)(7,7)
      // 白: (3,8)(4,8)(5,8)(6,8)
      placeMove(engine, 3, 7); // 黑
      placeMove(engine, 3, 8); // 白
      placeMove(engine, 4, 7); // 黑
      placeMove(engine, 4, 8); // 白
      placeMove(engine, 5, 7); // 黑
      placeMove(engine, 5, 8); // 白
      placeMove(engine, 6, 7); // 黑
      placeMove(engine, 6, 8); // 白
      placeMove(engine, 7, 7); // 黑 → 连五
      expect(getWinner(engine)).toBe(1);
    });

    it('左上→右下对角线连五获胜', () => {
      const engine = startEngine();
      // 黑: (3,3)(4,4)(5,5)(6,6)(7,7)
      // 白: (3,4)(4,5)(5,6)(6,7)
      placeMove(engine, 3, 3); // 黑
      placeMove(engine, 3, 4); // 白
      placeMove(engine, 4, 4); // 黑
      placeMove(engine, 4, 5); // 白
      placeMove(engine, 5, 5); // 黑
      placeMove(engine, 5, 6); // 白
      placeMove(engine, 6, 6); // 黑
      placeMove(engine, 6, 7); // 白
      placeMove(engine, 7, 7); // 黑 → 连五
      expect(getWinner(engine)).toBe(1);
    });

    it('右上→左下对角线连五获胜', () => {
      const engine = startEngine();
      // 黑: (3,11)(4,10)(5,9)(6,8)(7,7)
      // 白: (3,10)(4,9)(5,8)(6,7)
      placeMove(engine, 3, 11); // 黑
      placeMove(engine, 3, 10); // 白
      placeMove(engine, 4, 10); // 黑
      placeMove(engine, 4, 9);  // 白
      placeMove(engine, 5, 9);  // 黑
      placeMove(engine, 5, 8);  // 白
      placeMove(engine, 6, 8);  // 黑
      placeMove(engine, 6, 7);  // 白
      placeMove(engine, 7, 7);  // 黑 → 连五
      expect(getWinner(engine)).toBe(1);
    });

    it('白棋也可以获胜', () => {
      const engine = startEngine();
      // 黑: (7,3)(7,4)(7,5)(7,6)(0,0)
      // 白: (8,3)(8,4)(8,5)(8,6)(8,7)
      placeMove(engine, 7, 3); // 黑
      placeMove(engine, 8, 3); // 白
      placeMove(engine, 7, 4); // 黑
      placeMove(engine, 8, 4); // 白
      placeMove(engine, 7, 5); // 黑
      placeMove(engine, 8, 5); // 白
      placeMove(engine, 7, 6); // 黑
      placeMove(engine, 8, 6); // 白
      placeMove(engine, 0, 0); // 黑（不连五）
      placeMove(engine, 8, 7); // 白 → 连五
      expect(getWinner(engine)).toBe(2);
    });

    it('四子不获胜', () => {
      const engine = startEngine();
      placeMove(engine, 7, 3); // 黑
      placeMove(engine, 8, 3); // 白
      placeMove(engine, 7, 4); // 黑
      placeMove(engine, 8, 4); // 白
      placeMove(engine, 7, 5); // 黑
      placeMove(engine, 8, 5); // 白
      placeMove(engine, 7, 6); // 黑 → 四子
      expect(getWinner(engine)).toBe(0);
    });

    it('游戏结束后不能继续落子', () => {
      const engine = startEngine();
      // 黑连五
      for (let i = 0; i < 5; i++) {
        placeMove(engine, 7, 3 + i); // 黑
        if (i < 4) placeMove(engine, 8, 3 + i); // 白
      }
      expect(getWinner(engine)).toBe(1);
      // 尝试继续落子
      const result = placeMove(engine, 0, 0);
      expect(result).toBe(false);
    });
  });

  // ==================== T4: 边界条件 ====================
  describe('边界条件', () => {
    it('棋盘角落可以落子', () => {
      const engine = startEngine();
      expect(placeMove(engine, 0, 0)).toBe(true);
      expect(getBoard(engine)[0][0]).toBe(1);
    });

    it('棋盘右下角可以落子', () => {
      const engine = startEngine();
      expect(placeMove(engine, 14, 14)).toBe(true);
      expect(getBoard(engine)[14][14]).toBe(1);
    });

    it('角落连五也能检测', () => {
      const engine = startEngine();
      // 黑: (0,0)(0,1)(0,2)(0,3)(0,4) — 顶行
      // 白: (1,0)(1,1)(1,2)(1,3)
      for (let i = 0; i < 5; i++) {
        placeMove(engine, 0, i); // 黑
        if (i < 4) placeMove(engine, 1, i); // 白
      }
      expect(getWinner(engine)).toBe(1);
    });

    it('checkDraw 棋盘未满时返回 false', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      expect(checkDraw(engine)).toBe(false);
    });
  });

  // ==================== T5: AI 逻辑 ====================
  describe('AI 逻辑', () => {
    it('AI 能在空棋盘落子（下天元）', () => {
      const engine = startEngine();
      setMode(engine, 'AI');
      // AI 棋盘为空时，应下天元
      aiMove(engine);
      // AI 应该在某个位置落子了
      const board = getBoard(engine);
      let count = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] !== 0) count++;
        }
      }
      expect(count).toBeGreaterThan(0);
    });

    it('AI 会堵住对手的连四', () => {
      const engine = startEngine();
      setMode(engine, 'AI');
      // 黑棋有四子连，差一个赢
      // 黑: (7,3)(7,4)(7,5)(7,6)  白: (8,0)(8,1)(8,2)
      setCell(engine, 7, 3, 1);
      setCell(engine, 7, 4, 1);
      setCell(engine, 7, 5, 1);
      setCell(engine, 7, 6, 1);
      setCell(engine, 8, 0, 2);
      setCell(engine, 8, 1, 2);
      setCell(engine, 8, 2, 2);
      (engine as unknown as { currentPlayer: number }).currentPlayer = 2;

      aiMove(engine);
      // AI 应该堵在 (7,2) 或 (7,7)
      const board = getBoard(engine);
      expect(board[7][2] === 2 || board[7][7] === 2).toBe(true);
    });

    it('AI 评估位置分数大于 0 对有棋型的位置', () => {
      const engine = startEngine();
      // 放几个黑子形成活二
      setCell(engine, 7, 7, 1);
      setCell(engine, 7, 8, 1);
      const score = evaluatePosition(engine, 7, 9, 1);
      expect(score).toBeGreaterThan(0);
    });

    it('AI 思考延迟后执行落子', () => {
      const engine = startEngine();
      setMode(engine, 'AI');
      setAIThinking(engine, true);
      (engine as unknown as { aiThinkTimer: number }).aiThinkTimer = 0;
      (engine as unknown as { currentPlayer: number }).currentPlayer = 2;

      // 推进不到延迟时间
      advanceUpdate(engine, AI_THINK_DELAY - 100);
      expect(isAIThinking(engine)).toBe(true);

      // 推进超过延迟时间
      advanceUpdate(engine, 200);
      expect(isAIThinking(engine)).toBe(false);
    });

    it('AI 不会在棋盘外落子', () => {
      const engine = startEngine();
      setMode(engine, 'AI');
      // 只有一个黑子在天元
      setCell(engine, 7, 7, 1);
      (engine as unknown as { currentPlayer: number }).currentPlayer = 2;
      aiMove(engine);
      const board = getBoard(engine);
      // 检查 AI 落子位置合法
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          expect(board[r][c]).toBeGreaterThanOrEqual(0);
          expect(board[r][c]).toBeLessThanOrEqual(2);
        }
      }
    });
  });

  // ==================== T6: 键盘控制 ====================
  describe('键盘控制', () => {
    it('方向键上移动光标', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp');
      expect(getCursor(engine).row).toBe(6);
    });

    it('方向键下移动光标', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowDown');
      expect(getCursor(engine).row).toBe(8);
    });

    it('方向键左移动光标', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowLeft');
      expect(getCursor(engine).col).toBe(6);
    });

    it('方向键右移动光标', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowRight');
      expect(getCursor(engine).col).toBe(8);
    });

    it('WASD 也能移动光标', () => {
      const engine = startEngine();
      engine.handleKeyDown('w');
      expect(getCursor(engine).row).toBe(6);
      engine.handleKeyDown('s');
      expect(getCursor(engine).row).toBe(7);
      engine.handleKeyDown('a');
      expect(getCursor(engine).col).toBe(6);
      engine.handleKeyDown('d');
      expect(getCursor(engine).col).toBe(7);
    });

    it('光标不会越界上边界', () => {
      const engine = startEngine();
      for (let i = 0; i < 20; i++) engine.handleKeyDown('ArrowUp');
      expect(getCursor(engine).row).toBe(0);
    });

    it('光标不会越界下边界', () => {
      const engine = startEngine();
      for (let i = 0; i < 20; i++) engine.handleKeyDown('ArrowDown');
      expect(getCursor(engine).row).toBe(BOARD_SIZE - 1);
    });

    it('空格键在光标位置落子', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp'); // (6,7)
      engine.handleKeyDown('ArrowLeft'); // (6,6)
      engine.handleKeyDown(' ');
      expect(getBoard(engine)[6][6]).toBe(1);
    });

    it('Enter 键也能落子', () => {
      const engine = startEngine();
      engine.handleKeyDown('Enter');
      expect(getBoard(engine)[7][7]).toBe(1);
    });

    it('R 键重置游戏', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      placeMove(engine, 7, 8);
      engine.handleKeyDown('r');
      expect(engine.status).toBe('playing');
      expect(getBoard(engine)[7][7]).toBe(0);
    });
  });

  // ==================== T7: 模式切换 ====================
  describe('模式切换', () => {
    it('T 键切换模式为 AI', () => {
      const engine = startEngine();
      expect(getMode(engine)).toBe('PvP');
      engine.handleKeyDown('t');
      expect(getMode(engine)).toBe('AI');
    });

    it('再次按 T 切换回 PvP', () => {
      const engine = startEngine();
      engine.handleKeyDown('t'); // → AI
      engine.handleKeyDown('t'); // → PvP
      expect(getMode(engine)).toBe('PvP');
    });

    it('切换模式后游戏重置', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      engine.handleKeyDown('t');
      // 切换后棋盘应清空
      expect(getBoard(engine)[7][7]).toBe(0);
    });
  });

  // ==================== T8: 重置 ====================
  describe('重置', () => {
    it('reset 后棋盘清空', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      placeMove(engine, 7, 8);
      engine.reset();
      const board = getBoard(engine);
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          expect(board[r][c]).toBe(0);
        }
      }
    });

    it('reset 后玩家回到黑棋', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      engine.reset();
      expect(getCurrentPlayer(engine)).toBe(1);
    });

    it('reset 后赢家和平局状态清除', () => {
      const engine = startEngine();
      // 黑连五
      for (let i = 0; i < 5; i++) {
        placeMove(engine, 7, 3 + i);
        if (i < 4) placeMove(engine, 8, 3 + i);
      }
      expect(getWinner(engine)).toBe(1);
      engine.reset();
      expect(getWinner(engine)).toBe(0);
      expect(getIsDraw(engine)).toBe(false);
    });

    it('reset 后 isWin 为 false', () => {
      const engine = startEngine();
      for (let i = 0; i < 5; i++) {
        placeMove(engine, 7, 3 + i);
        if (i < 4) placeMove(engine, 8, 3 + i);
      }
      engine.reset();
      expect(engine.isWin).toBe(false);
    });
  });

  // ==================== T9: 事件发射 ====================
  describe('事件发射', () => {
    it('start 触发 statusChange 事件', () => {
      const engine = createEngine();
      const listener = vi.fn();
      engine.on('statusChange', listener);
      engine.start();
      expect(listener).toHaveBeenCalledWith('playing');
    });

    it('pause 触发 statusChange 事件', () => {
      const engine = startEngine();
      const listener = vi.fn();
      engine.on('statusChange', listener);
      engine.pause();
      expect(listener).toHaveBeenCalledWith('paused');
    });

    it('resume 触发 statusChange 事件', () => {
      const engine = startEngine();
      engine.pause();
      const listener = vi.fn();
      engine.on('statusChange', listener);
      engine.resume();
      expect(listener).toHaveBeenCalledWith('playing');
    });

    it('reset 触发 statusChange 事件', () => {
      const engine = startEngine();
      const listener = vi.fn();
      engine.on('statusChange', listener);
      engine.reset();
      expect(listener).toHaveBeenCalledWith('idle');
    });

    it('scoreChange 事件在胜利时触发', () => {
      const engine = startEngine();
      const listener = vi.fn();
      engine.on('scoreChange', listener);
      // 黑连五
      for (let i = 0; i < 5; i++) {
        placeMove(engine, 7, 3 + i);
        if (i < 4) placeMove(engine, 8, 3 + i);
      }
      expect(listener).toHaveBeenCalled();
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1];
      expect(lastCall[0]).toBeGreaterThan(0);
    });
  });

  // ==================== T10: 鼠标点击坐标转换 ====================
  describe('鼠标点击坐标转换', () => {
    it('handleClick 将 canvas 坐标转换为棋盘坐标并落子', () => {
      const engine = startEngine();
      // 天元 (7,7) 的 canvas 坐标
      const canvasX = GRID_OFFSET_X + 7 * CELL_SIZE;
      const canvasY = GRID_OFFSET_Y + 7 * CELL_SIZE;
      engine.handleClick(canvasX, canvasY);
      expect(getBoard(engine)[7][7]).toBe(1);
    });

    it('handleClick 点击偏移位置也能正确对齐到最近交叉点', () => {
      const engine = startEngine();
      // 点击 (0,0) 附近，偏移半个格子
      const canvasX = GRID_OFFSET_X + 0 * CELL_SIZE + 5;
      const canvasY = GRID_OFFSET_Y + 0 * CELL_SIZE + 5;
      engine.handleClick(canvasX, canvasY);
      expect(getBoard(engine)[0][0]).toBe(1);
    });

    it('handleClick 点击棋盘外不落子', () => {
      const engine = startEngine();
      engine.handleClick(0, 0); // 左上角，不在棋盘上
      // 检查是否落子
      let hasStone = false;
      const board = getBoard(engine);
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] !== 0) hasStone = true;
        }
      }
      expect(hasStone).toBe(false);
    });

    it('handleClick 更新光标位置', () => {
      const engine = startEngine();
      const canvasX = GRID_OFFSET_X + 3 * CELL_SIZE;
      const canvasY = GRID_OFFSET_Y + 5 * CELL_SIZE;
      engine.handleClick(canvasX, canvasY);
      expect(getCursor(engine)).toEqual({ row: 5, col: 3 });
    });

    it('handleClick 在 AI 思考中不处理', () => {
      const engine = startEngine();
      setAIThinking(engine, true);
      const canvasX = GRID_OFFSET_X + 7 * CELL_SIZE;
      const canvasY = GRID_OFFSET_Y + 7 * CELL_SIZE;
      engine.handleClick(canvasX, canvasY);
      expect(getBoard(engine)[7][7]).toBe(0);
    });

    it('handleClick 在 AI 模式下白棋回合不处理', () => {
      const engine = startEngine();
      setMode(engine, 'AI');
      placeMove(engine, 7, 7); // 黑下
      // 现在轮到白棋（AI），handleClick 不应生效
      const canvasX = GRID_OFFSET_X + 7 * CELL_SIZE;
      const canvasY = GRID_OFFSET_Y + 7 * CELL_SIZE + CELL_SIZE;
      engine.handleClick(canvasX, canvasY);
      expect(getBoard(engine)[7][8]).toBe(0);
    });
  });

  // ==================== T11: 计分系统 ====================
  describe('计分系统', () => {
    it('PvP 胜利得分 = SCORE_WIN + moveCount * SCORE_PER_STONE', () => {
      const engine = startEngine();
      // 黑连五，9 步
      for (let i = 0; i < 5; i++) {
        placeMove(engine, 7, 3 + i);
        if (i < 4) placeMove(engine, 8, 3 + i);
      }
      const expectedScore = SCORE_WIN + getMoveCount(engine) * SCORE_PER_STONE;
      expect(engine.score).toBe(expectedScore);
    });

    it('AI 模式胜利有额外加分', () => {
      const engine = startEngine();
      setMode(engine, 'AI');
      for (let i = 0; i < 5; i++) {
        placeMove(engine, 7, 3 + i);
        if (i < 4) placeMove(engine, 8, 3 + i);
      }
      const expectedScore = SCORE_WIN + getMoveCount(engine) * SCORE_PER_STONE + SCORE_AI_BONUS;
      expect(engine.score).toBe(expectedScore);
    });
  });

  // ==================== T12: getState ====================
  describe('getState', () => {
    it('返回完整状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state).toHaveProperty('board');
      expect(state).toHaveProperty('currentPlayer');
      expect(state).toHaveProperty('cursorRow');
      expect(state).toHaveProperty('cursorCol');
      expect(state).toHaveProperty('winner');
      expect(state).toHaveProperty('isDraw');
      expect(state).toHaveProperty('mode');
      expect(state).toHaveProperty('moveCount');
      expect(state).toHaveProperty('lastMove');
      expect(state).toHaveProperty('isWin');
    });

    it('board 是深拷贝', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      const state1 = engine.getState();
      const board1 = state1.board as number[][];
      board1[7][7] = 2; // 修改返回值
      const state2 = engine.getState();
      const board2 = state2.board as number[][];
      expect(board2[7][7]).toBe(1); // 内部状态不变
    });
  });

});
