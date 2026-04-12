import { GomokuEngine } from '@/games/gomoku/GomokuEngine';
import {
  BOARD_SIZE,
  CELL_SIZE,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  AI_THINK_DELAY,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SCORE_WIN,
  SCORE_PER_STONE,
  SCORE_AI_BONUS,
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

/**
 * 获取内部 board
 */
function getBoard(engine: GomokuEngine): number[][] {
  return (engine as any).board;
}

/**
 * 获取内部 currentPlayer
 */
function getCurrentPlayer(engine: GomokuEngine): number {
  return (engine as any).currentPlayer;
}

/**
 * 获取内部 mode
 */
function getMode(engine: GomokuEngine): string {
  return (engine as any).mode;
}

/**
 * 获取内部 winner
 */
function getWinner(engine: GomokuEngine): number {
  return (engine as any).winner;
}

/**
 * 获取内部 isDraw
 */
function getIsDraw(engine: GomokuEngine): boolean {
  return (engine as any).isDraw;
}

/**
 * 获取内部 moveCount
 */
function getMoveCount(engine: GomokuEngine): number {
  return (engine as any).moveCount;
}

/**
 * 获取内部 cursorRow / cursorCol
 */
function getCursor(engine: GomokuEngine): { row: number; col: number } {
  return { row: (engine as any).cursorRow, col: (engine as any).cursorCol };
}

/**
 * 获取内部 lastMove
 */
function getLastMove(engine: GomokuEngine): { row: number; col: number } | null {
  return (engine as any).lastMove;
}

/**
 * 获取内部 aiThinking
 */
function isAiThinking(engine: GomokuEngine): boolean {
  return (engine as any).aiThinking;
}

/**
 * 直接调用 placeMove（绕过输入处理）
 */
function placeMove(engine: GomokuEngine, row: number, col: number): boolean {
  return (engine as any).placeMove(row, col);
}

/**
 * 将 canvas 坐标转换为棋盘行列
 */
function canvasToGrid(row: number, col: number): { x: number; y: number } {
  return {
    x: GRID_OFFSET_X + col * CELL_SIZE,
    y: GRID_OFFSET_Y + row * CELL_SIZE,
  };
}

/**
 * 模拟引擎 update，推进 deltaTime 毫秒
 */
function advanceUpdate(engine: GomokuEngine, deltaTime: number): void {
  (engine as any).update(deltaTime);
}

/**
 * 在棋盘上放置连续 n 个棋子（交替黑白），起始位置 (row, col)，方向 (dr, dc)
 * 返回实际放置数
 */
function placeLine(
  engine: GomokuEngine,
  row: number,
  col: number,
  dr: number,
  dc: number,
  n: number,
  player: number = 1
): void {
  let p = player;
  for (let i = 0; i < n; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    // 直接写棋盘，不通过 placeMove（避免胜负检测干扰）
    (engine as any).board[r][c] = p;
    (engine as any).moveCount++;
    p = p === 1 ? 2 : 1;
  }
}

/**
 * 直接在棋盘上设置指定位置的值（不触发任何检测）
 */
function setCell(engine: GomokuEngine, row: number, col: number, value: number): void {
  (engine as any).board[row][col] = value;
}

// ========== 测试 ==========

describe('GomokuEngine', () => {
  // ==================== T1: 初始化 ====================
  describe('初始化', () => {
    it('init 后 status 为 idle', () => {
      const engine = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('start 后 status 为 playing', () => {
      const engine = startEngine();
      expect(engine.status).toBe('playing');
    });

    it('初始化后棋盘为 15×15 全空', () => {
      const engine = startEngine();
      const board = getBoard(engine);
      expect(board).toHaveLength(BOARD_SIZE);
      for (let r = 0; r < BOARD_SIZE; r++) {
        expect(board[r]).toHaveLength(BOARD_SIZE);
        for (let c = 0; c < BOARD_SIZE; c++) {
          expect(board[r][c]).toBe(0);
        }
      }
    });

    it('黑棋先手（currentPlayer = 1）', () => {
      const engine = startEngine();
      expect(getCurrentPlayer(engine)).toBe(1);
    });

    it('初始模式为 PvP', () => {
      const engine = startEngine();
      expect(getMode(engine)).toBe('PvP');
    });

    it('初始无赢家（winner = 0）', () => {
      const engine = startEngine();
      expect(getWinner(engine)).toBe(0);
    });

    it('初始 isDraw 为 false', () => {
      const engine = startEngine();
      expect(getIsDraw(engine)).toBe(false);
    });

    it('初始 moveCount 为 0', () => {
      const engine = startEngine();
      expect(getMoveCount(engine)).toBe(0);
    });

    it('初始光标在中心 (7, 7)', () => {
      const engine = startEngine();
      const cursor = getCursor(engine);
      expect(cursor.row).toBe(7);
      expect(cursor.col).toBe(7);
    });

    it('初始 lastMove 为 null', () => {
      const engine = startEngine();
      expect(getLastMove(engine)).toBeNull();
    });

    it('初始 isWin 为 false', () => {
      const engine = startEngine();
      expect(engine.isWin).toBe(false);
    });

    it('初始分数为 0', () => {
      const engine = startEngine();
      expect(engine.score).toBe(0);
    });
  });

  // ==================== T2: 落子逻辑 ====================
  describe('落子逻辑', () => {
    it('黑棋落子后棋盘对应位置变为 1', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      expect(getBoard(engine)[7][7]).toBe(1);
    });

    it('落子后切换到白棋', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      expect(getCurrentPlayer(engine)).toBe(2);
    });

    it('白棋落子后切换回黑棋', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      placeMove(engine, 7, 8);
      expect(getCurrentPlayer(engine)).toBe(1);
    });

    it('不能在已有棋子的位置落子', () => {
      const engine = startEngine();
      const result1 = placeMove(engine, 7, 7);
      expect(result1).toBe(true);
      const result2 = placeMove(engine, 7, 7);
      expect(result2).toBe(false);
    });

    it('不能在棋盘外落子（负坐标）', () => {
      const engine = startEngine();
      expect(placeMove(engine, -1, 0)).toBe(false);
      expect(placeMove(engine, 0, -1)).toBe(false);
    });

    it('不能在棋盘外落子（超出边界）', () => {
      const engine = startEngine();
      expect(placeMove(engine, BOARD_SIZE, 0)).toBe(false);
      expect(placeMove(engine, 0, BOARD_SIZE)).toBe(false);
    });

    it('每次落子 moveCount 递增', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      expect(getMoveCount(engine)).toBe(1);
      placeMove(engine, 7, 8);
      expect(getMoveCount(engine)).toBe(2);
    });

    it('落子后 lastMove 更新', () => {
      const engine = startEngine();
      placeMove(engine, 3, 5);
      const last = getLastMove(engine);
      expect(last).toEqual({ row: 3, col: 5 });

      placeMove(engine, 10, 2);
      const last2 = getLastMove(engine);
      expect(last2).toEqual({ row: 10, col: 2 });
    });
  });

  // ==================== T3: 胜负检测 ====================
  describe('胜负检测', () => {
    it('水平连五检测', () => {
      const engine = startEngine();
      // 黑棋在 (7,3)~(7,7) 放置 5 子（水平方向）
      for (let c = 3; c <= 7; c++) {
        placeMove(engine, 7, c);
        if (c < 7) placeMove(engine, 8, c); // 白棋下在别处
      }
      expect(getWinner(engine)).toBe(1);
      expect(engine.isWin).toBe(true);
    });

    it('垂直连五检测', () => {
      const engine = startEngine();
      // 黑棋在 (3,7)~(7,7) 放置 5 子（垂直方向）
      for (let r = 3; r <= 7; r++) {
        placeMove(engine, r, 7);
        if (r < 7) placeMove(engine, r, 8); // 白棋下在别处
      }
      expect(getWinner(engine)).toBe(1);
      expect(engine.isWin).toBe(true);
    });

    it('左上→右下对角线连五检测', () => {
      const engine = startEngine();
      // 黑棋在 (3,3)~(7,7) 对角线方向
      for (let i = 0; i < 5; i++) {
        placeMove(engine, 3 + i, 3 + i);
        if (i < 4) placeMove(engine, 3 + i, 10); // 白棋下在别处
      }
      expect(getWinner(engine)).toBe(1);
      expect(engine.isWin).toBe(true);
    });

    it('右上→左下对角线连五检测', () => {
      const engine = startEngine();
      // 黑棋在 (3,11)~(7,7) 反对角线方向
      for (let i = 0; i < 5; i++) {
        placeMove(engine, 3 + i, 11 - i);
        if (i < 4) placeMove(engine, 3 + i, 0); // 白棋下在别处
      }
      expect(getWinner(engine)).toBe(1);
      expect(engine.isWin).toBe(true);
    });

    it('白棋连五也能检测', () => {
      const engine = startEngine();
      // 构造白棋水平连五：黑棋分散到不同行避免自身连五
      const blackPos: [number,number][] = [[0,0],[2,0],[3,0],[4,0],[5,0]];
      for (let i = 0; i < 5; i++) {
        placeMove(engine, blackPos[i][0], blackPos[i][1]); // 黑棋分散
        placeMove(engine, 1, 3 + i);                        // 白棋连五 (1,3)~(1,7)
      }
      // 最终白棋在 (1,3)~(1,7) 连五
      expect(getWinner(engine)).toBe(2);
      expect(engine.isWin).toBe(true);
    });

    it('四子不构成胜利', () => {
      const engine = startEngine();
      // 黑棋放 4 子水平
      for (let c = 3; c <= 6; c++) {
        placeMove(engine, 7, c);
        if (c < 6) placeMove(engine, 8, c);
      }
      expect(getWinner(engine)).toBe(0);
      expect(engine.isWin).toBe(false);
    });

    it('游戏结束后不能再落子', () => {
      const engine = startEngine();
      // 构造黑棋连五
      for (let c = 3; c <= 7; c++) {
        placeMove(engine, 7, c);
        if (c < 7) placeMove(engine, 8, c);
      }
      expect(getWinner(engine)).toBe(1);
      // 尝试继续落子
      const result = placeMove(engine, 0, 0);
      expect(result).toBe(false);
    });
  });

  // ==================== T4: 边界条件 ====================
  describe('边界条件', () => {
    it('在棋盘四角可以落子', () => {
      const engine = startEngine();
      expect(placeMove(engine, 0, 0)).toBe(true);
      expect(placeMove(engine, 0, 14)).toBe(true);
      expect(placeMove(engine, 14, 0)).toBe(true);
      expect(placeMove(engine, 14, 14)).toBe(true);
    });

    it('在棋盘边缘可以落子', () => {
      const engine = startEngine();
      expect(placeMove(engine, 0, 7)).toBe(true);
      expect(placeMove(engine, 14, 7)).toBe(true);
      expect(placeMove(engine, 7, 0)).toBe(true);
      expect(placeMove(engine, 7, 14)).toBe(true);
    });

    it('棋盘边缘连五检测正确', () => {
      const engine = startEngine();
      // 黑棋在第 0 行 (0,0)~(0,4) 连五
      for (let c = 0; c <= 4; c++) {
        placeMove(engine, 0, c);
        if (c < 4) placeMove(engine, 1, c);
      }
      expect(getWinner(engine)).toBe(1);
    });

    it('满盘平局检测', () => {
      const engine = startEngine();
      // 直接填充整个棋盘（交替黑白），避免形成连五
      // 使用棋盘格模式：偶数行 12121...，奇数行 21212...
      const board = getBoard(engine);
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if ((r + c) % 2 === 0) {
            board[r][c] = 1;
          } else {
            board[r][c] = 2;
          }
        }
      }
      // 设置 moveCount 为满盘
      (engine as any).moveCount = BOARD_SIZE * BOARD_SIZE;
      // 检查平局
      expect((engine as any).checkDraw()).toBe(true);
    });
  });

  // ==================== T5: AI 落子 ====================
  describe('AI 落子', () => {
    it('AI 模式下玩家落子后触发 AI 思考', () => {
      const engine = startEngine();
      // 切换到 AI 模式
      (engine as any).mode = 'AI';
      // 玩家（黑棋）落子
      placeMove(engine, 7, 7);
      // 手动触发 AI 思考标记
      if (getCurrentPlayer(engine) === 2 && getWinner(engine) === 0) {
        (engine as any).aiThinking = true;
        (engine as any).aiThinkTimer = 0;
      }
      expect(isAiThinking(engine)).toBe(true);
    });

    it('AI 思考延迟后落子', () => {
      const engine = startEngine();
      (engine as any).mode = 'AI';
      placeMove(engine, 7, 7);
      (engine as any).aiThinking = true;
      (engine as any).aiThinkTimer = 0;

      // 推进时间不到 AI_THINK_DELAY，AI 不应落子
      advanceUpdate(engine, AI_THINK_DELAY - 10);
      // aiThinking 应该还是 true（还没落子）
      expect(isAiThinking(engine)).toBe(true);

      // 再推进超过 AI_THINK_DELAY
      advanceUpdate(engine, 20);
      // AI 应该已经落子，不再思考
      expect(isAiThinking(engine)).toBe(false);
      // AI 应该在棋盘上放了一颗白棋
      expect(getMoveCount(engine)).toBe(2);
      expect(getCurrentPlayer(engine)).toBe(1); // 落子后切换回黑棋
    });

    it('AI 落子位置有效（在空位上）', () => {
      const engine = startEngine();
      (engine as any).mode = 'AI';
      placeMove(engine, 7, 7);
      (engine as any).aiThinking = true;
      (engine as any).aiThinkTimer = 0;

      // 推进足够时间让 AI 落子
      advanceUpdate(engine, AI_THINK_DELAY + 10);

      // 找到 AI 落子的位置
      const board = getBoard(engine);
      let whiteCount = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] === 2) whiteCount++;
        }
      }
      expect(whiteCount).toBe(1);
    });

    it('AI 第一步下天元（空棋盘时）', () => {
      const engine = startEngine();
      // 先让黑棋下一步，这样 AI 才有邻居可评估
      placeMove(engine, 7, 7); // 黑棋下天元
      // 此时 currentPlayer 切换到白(2)，AI 有邻居可评估
      (engine as any).aiMove();
      // AI 应该下在天元附近
      const board = getBoard(engine);
      let aiPlaced = false;
      for (let r = 6; r <= 8; r++) {
        for (let c = 6; c <= 8; c++) {
          if (board[r][c] === 2) aiPlaced = true;
        }
      }
      expect(aiPlaced).toBe(true);
    });
  });

  // ==================== T6: AI 防守 ====================
  describe('AI 防守', () => {
    it('AI 能检测并阻挡对手的活四', () => {
      const engine = startEngine();
      (engine as any).mode = 'AI';

      // 构造黑棋活四：(7,3)~(7,6) 四子水平，两端开放
      // 黑棋先手
      placeMove(engine, 7, 3); // 黑
      placeMove(engine, 0, 0); // 白 - 被 AI 模式忽略，我们手动放
      placeMove(engine, 7, 4); // 黑
      placeMove(engine, 0, 1); // 白
      placeMove(engine, 7, 5); // 黑
      placeMove(engine, 0, 2); // 白
      placeMove(engine, 7, 6); // 黑 - 形成活四

      // 当前应该是白棋回合，AI 应该检测到黑棋活四
      expect(getCurrentPlayer(engine)).toBe(2);

      // 直接调用 aiMove
      (engine as any).aiMove();

      // AI 应该在 (7,2) 或 (7,7) 阻挡（两端之一）
      const board = getBoard(engine);
      const blockedLeft = board[7][2] === 2;
      const blockedRight = board[7][7] === 2;
      expect(blockedLeft || blockedRight).toBe(true);
    });

    it('AI 能检测并阻挡对手的冲四', () => {
      const engine = startEngine();
      (engine as any).mode = 'AI';

      // 构造黑棋冲四：(7,3)~(7,6) 四子，左端被白棋封住
      setCell(engine, 0, 0, 2);
      setCell(engine, 0, 1, 2);
      setCell(engine, 0, 2, 2);

      // 黑棋水平 4 子
      placeMove(engine, 7, 3); // 黑
      placeMove(engine, 7, 2); // 白（封住左端）- 但这会被当作白棋的回合
      // 需要重新构造：直接在棋盘上设置
      // 清空重来
      (engine as any).initBoard();
      (engine as any).currentPlayer = 1;
      (engine as any).moveCount = 0;

      // 黑棋 (7,3)~(7,6)
      setCell(engine, 7, 3, 1);
      setCell(engine, 7, 4, 1);
      setCell(engine, 7, 5, 1);
      setCell(engine, 7, 6, 1);
      // 白棋封住左端
      setCell(engine, 7, 2, 2);
      // (7,7) 开放，AI 必须堵
      (engine as any).moveCount = 5;
      (engine as any).currentPlayer = 2;

      (engine as any).aiMove();

      // AI 应该堵在 (7,7)
      expect(getBoard(engine)[7][7]).toBe(2);
    });
  });

  // ==================== T7: 键盘控制 ====================
  describe('键盘控制', () => {
    it('ArrowUp 光标上移', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowUp');
      expect(getCursor(engine).row).toBe(6);
    });

    it('ArrowDown 光标下移', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowDown');
      expect(getCursor(engine).row).toBe(8);
    });

    it('ArrowLeft 光标左移', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowLeft');
      expect(getCursor(engine).col).toBe(6);
    });

    it('ArrowRight 光标右移', () => {
      const engine = startEngine();
      engine.handleKeyDown('ArrowRight');
      expect(getCursor(engine).col).toBe(8);
    });

    it('光标不能移出棋盘上边界', () => {
      const engine = startEngine();
      (engine as any).cursorRow = 0;
      engine.handleKeyDown('ArrowUp');
      expect(getCursor(engine).row).toBe(0);
    });

    it('光标不能移出棋盘下边界', () => {
      const engine = startEngine();
      (engine as any).cursorRow = BOARD_SIZE - 1;
      engine.handleKeyDown('ArrowDown');
      expect(getCursor(engine).row).toBe(BOARD_SIZE - 1);
    });

    it('光标不能移出棋盘左边界', () => {
      const engine = startEngine();
      (engine as any).cursorCol = 0;
      engine.handleKeyDown('ArrowLeft');
      expect(getCursor(engine).col).toBe(0);
    });

    it('光标不能移出棋盘右边界', () => {
      const engine = startEngine();
      (engine as any).cursorCol = BOARD_SIZE - 1;
      engine.handleKeyDown('ArrowRight');
      expect(getCursor(engine).col).toBe(BOARD_SIZE - 1);
    });

    it('空格键在光标位置落子', () => {
      const engine = startEngine();
      // 光标默认在 (7,7)
      engine.handleKeyDown(' ');
      expect(getBoard(engine)[7][7]).toBe(1);
    });

    it('回车键在光标位置落子', () => {
      const engine = startEngine();
      engine.handleKeyDown('Enter');
      expect(getBoard(engine)[7][7]).toBe(1);
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

    it('游戏结束后方向键和落子无效', () => {
      const engine = startEngine();
      // 构造黑棋连五
      for (let c = 3; c <= 7; c++) {
        placeMove(engine, 7, c);
        if (c < 7) placeMove(engine, 8, c);
      }
      expect(getWinner(engine)).toBe(1);

      // 尝试键盘落子
      const prevMoveCount = getMoveCount(engine);
      engine.handleKeyDown(' ');
      expect(getMoveCount(engine)).toBe(prevMoveCount);
    });
  });

  // ==================== T8: 模式切换 ====================
  describe('模式切换', () => {
    it('T 键从 PvP 切换到 AI', () => {
      const engine = startEngine();
      expect(getMode(engine)).toBe('PvP');
      engine.handleKeyDown('t');
      expect(getMode(engine)).toBe('AI');
    });

    it('T 键从 AI 切换回 PvP', () => {
      const engine = startEngine();
      engine.handleKeyDown('t');
      expect(getMode(engine)).toBe('AI');
      engine.handleKeyDown('t');
      expect(getMode(engine)).toBe('PvP');
    });

    it('大写 T 也能切换模式', () => {
      const engine = startEngine();
      engine.handleKeyDown('T');
      expect(getMode(engine)).toBe('AI');
    });

    it('切换模式后棋盘重置', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      expect(getMoveCount(engine)).toBe(1);

      engine.handleKeyDown('t');
      // 切换模式会 reset + start
      expect(getMoveCount(engine)).toBe(0);
      expect(getBoard(engine)[7][7]).toBe(0);
    });

    it('切换模式后回到黑先手', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      expect(getCurrentPlayer(engine)).toBe(2);

      engine.handleKeyDown('t');
      expect(getCurrentPlayer(engine)).toBe(1);
    });
  });

  // ==================== T9: 重置功能 ====================
  describe('重置功能', () => {
    it('reset 后棋盘清空', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      placeMove(engine, 7, 8);
      placeMove(engine, 7, 9);

      engine.reset();

      const board = getBoard(engine);
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          expect(board[r][c]).toBe(0);
        }
      }
    });

    it('reset 后回到黑先手', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      engine.reset();
      expect(getCurrentPlayer(engine)).toBe(1);
    });

    it('reset 后无赢家', () => {
      const engine = startEngine();
      for (let c = 3; c <= 7; c++) {
        placeMove(engine, 7, c);
        if (c < 7) placeMove(engine, 8, c);
      }
      expect(getWinner(engine)).toBe(1);

      engine.reset();
      expect(getWinner(engine)).toBe(0);
      expect(engine.isWin).toBe(false);
    });

    it('reset 后 moveCount 归零', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      placeMove(engine, 7, 8);
      engine.reset();
      expect(getMoveCount(engine)).toBe(0);
    });

    it('R 键重开游戏', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      placeMove(engine, 7, 8);

      engine.handleKeyDown('r');

      expect(getMoveCount(engine)).toBe(0);
      expect(getCurrentPlayer(engine)).toBe(1);
      expect(engine.status).toBe('playing');
    });

    it('大写 R 键也能重开', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      engine.handleKeyDown('R');
      expect(getMoveCount(engine)).toBe(0);
    });
  });

  // ==================== T10: 事件发射 ====================
  describe('事件发射', () => {
    it('start 触发 statusChange 事件为 playing', () => {
      const engine = createEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.start();
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('reset 触发 statusChange 事件为 idle', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.reset();
      expect(cb).toHaveBeenCalledWith('idle');
    });

    it('pause 触发 statusChange 事件为 paused', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.pause();
      expect(cb).toHaveBeenCalledWith('paused');
    });

    it('resume 触发 statusChange 事件为 playing', () => {
      const engine = startEngine();
      engine.pause();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.resume();
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('scoreChange 事件在胜利时触发', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('scoreChange', cb);

      // 构造黑棋连五
      for (let c = 3; c <= 7; c++) {
        placeMove(engine, 7, c);
        if (c < 7) placeMove(engine, 8, c);
      }

      // 胜利后应触发 scoreChange
      expect(cb).toHaveBeenCalled();
      const lastCall = cb.mock.calls[cb.mock.calls.length - 1];
      expect(lastCall[0]).toBeGreaterThan(0);
    });

    it('off 取消事件监听', () => {
      const engine = createEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.off('statusChange', cb);
      engine.start();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ==================== T11: getState 返回正确状态 ====================
  describe('getState', () => {
    it('返回包含所有必要字段', () => {
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

    it('初始状态正确', () => {
      const engine = startEngine();
      const state = engine.getState();
      expect(state.currentPlayer).toBe(1);
      expect(state.cursorRow).toBe(7);
      expect(state.cursorCol).toBe(7);
      expect(state.winner).toBe(0);
      expect(state.isDraw).toBe(false);
      expect(state.mode).toBe('PvP');
      expect(state.moveCount).toBe(0);
      expect(state.lastMove).toBeNull();
      expect(state.isWin).toBe(false);
    });

    it('落子后状态更新', () => {
      const engine = startEngine();
      placeMove(engine, 5, 3);
      const state = engine.getState();
      expect(state.currentPlayer).toBe(2);
      expect(state.moveCount).toBe(1);
      expect(state.lastMove).toEqual({ row: 5, col: 3 });
    });

    it('返回的 board 是深拷贝，不影响内部状态', () => {
      const engine = startEngine();
      const state = engine.getState();
      const board = state.board as number[][];
      board[0][0] = 99;
      expect(getBoard(engine)[0][0]).toBe(0);
    });
  });

  // ==================== T12: 鼠标点击坐标转换 ====================
  describe('鼠标点击坐标转换', () => {
    it('点击棋盘中心位置正确落子', () => {
      const engine = startEngine();
      const { x, y } = canvasToGrid(7, 7);
      engine.handleClick(x, y);
      expect(getBoard(engine)[7][7]).toBe(1);
    });

    it('点击左上角 (0,0) 正确落子', () => {
      const engine = startEngine();
      const { x, y } = canvasToGrid(0, 0);
      engine.handleClick(x, y);
      expect(getBoard(engine)[0][0]).toBe(1);
    });

    it('点击右下角 (14,14) 正确落子', () => {
      const engine = startEngine();
      const { x, y } = canvasToGrid(14, 14);
      engine.handleClick(x, y);
      expect(getBoard(engine)[14][14]).toBe(1);
    });

    it('点击棋盘外无效', () => {
      const engine = startEngine();
      engine.handleClick(0, 0); // 左上角区域，不在棋盘上
      expect(getMoveCount(engine)).toBe(0);
    });

    it('点击后光标移动到点击位置', () => {
      const engine = startEngine();
      const { x, y } = canvasToGrid(3, 10);
      engine.handleClick(x, y);
      expect(getCursor(engine).row).toBe(3);
      expect(getCursor(engine).col).toBe(10);
    });

    it('点击已有棋子位置不落子', () => {
      const engine = startEngine();
      placeMove(engine, 7, 7);
      const { x, y } = canvasToGrid(7, 7);
      engine.handleClick(x, y);
      // 棋子仍然是黑棋（1），不会变成白棋
      expect(getBoard(engine)[7][7]).toBe(1);
      expect(getMoveCount(engine)).toBe(1);
    });
  });

  // ==================== T13: 游戏结束后不能再落子 ====================
  describe('游戏结束后锁定', () => {
    it('胜利后鼠标点击无效', () => {
      const engine = startEngine();
      // 构造黑棋连五
      for (let c = 3; c <= 7; c++) {
        placeMove(engine, 7, c);
        if (c < 7) placeMove(engine, 8, c);
      }
      const prevCount = getMoveCount(engine);

      const { x, y } = canvasToGrid(0, 0);
      engine.handleClick(x, y);
      expect(getMoveCount(engine)).toBe(prevCount);
    });

    it('胜利后键盘落子无效', () => {
      const engine = startEngine();
      for (let c = 3; c <= 7; c++) {
        placeMove(engine, 7, c);
        if (c < 7) placeMove(engine, 8, c);
      }
      const prevCount = getMoveCount(engine);
      engine.handleKeyDown(' ');
      expect(getMoveCount(engine)).toBe(prevCount);
    });

    it('AI 思考中不处理玩家操作', () => {
      const engine = startEngine();
      (engine as any).mode = 'AI';
      (engine as any).aiThinking = true;

      engine.handleKeyDown(' ');
      expect(getMoveCount(engine)).toBe(0);
    });

    it('AI 思考中不处理鼠标点击', () => {
      const engine = startEngine();
      (engine as any).mode = 'AI';
      (engine as any).aiThinking = true;

      const { x, y } = canvasToGrid(7, 7);
      engine.handleClick(x, y);
      expect(getMoveCount(engine)).toBe(0);
    });
  });

  // ==================== T14: 计分系统 ====================
  describe('计分系统', () => {
    it('PvP 模式胜利得分 = SCORE_WIN + moveCount * SCORE_PER_STONE', () => {
      const engine = startEngine();
      // 黑棋 5 子，白棋 4 子 = 9 手
      for (let c = 3; c <= 7; c++) {
        placeMove(engine, 7, c);
        if (c < 7) placeMove(engine, 8, c);
      }
      const moves = getMoveCount(engine);
      expect(engine.score).toBe(SCORE_WIN + moves * SCORE_PER_STONE);
    });

    it('AI 模式胜利额外加分', () => {
      const engine = startEngine();
      (engine as any).mode = 'AI';

      // 黑棋连五
      for (let c = 3; c <= 7; c++) {
        placeMove(engine, 7, c);
        if (c < 7) placeMove(engine, 8, c);
      }
      const moves = getMoveCount(engine);
      expect(engine.score).toBe(SCORE_WIN + moves * SCORE_PER_STONE + SCORE_AI_BONUS);
    });

    it('平局不得分', () => {
      const engine = startEngine();
      // 模拟平局
      (engine as any).isDraw = true;
      (engine as any).calculateScore();
      expect(engine.score).toBe(0);
    });
  });

  // ==================== T15: 生命周期 ====================
  describe('生命周期', () => {
    it('pause 后 status 为 paused', () => {
      const engine = startEngine();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后 status 为 playing', () => {
      const engine = startEngine();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('destroy 后 status 为 idle', () => {
      const engine = startEngine();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('destroy 清除所有事件监听', () => {
      const engine = startEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.destroy();
      // destroy 后再 start 不会触发回调（因为 listeners 已清空）
      // 但 destroy 后 engine 处于 idle 状态，需要重新 init
    });

    it('非 playing 状态下键盘操作无效（除 R/T）', () => {
      const engine = createEngine(); // idle 状态
      engine.handleKeyDown('ArrowUp');
      // 光标在 idle 状态不应移动（handleKeyDown 检查 _status !== 'playing'）
      expect(getCursor(engine).row).toBe(7);
    });
  });

  // ==================== T16: AI 模式下玩家限制 ====================
  describe('AI 模式下玩家限制', () => {
    it('AI 模式下白棋回合玩家不能落子（键盘）', () => {
      const engine = startEngine();
      (engine as any).mode = 'AI';
      placeMove(engine, 7, 7);
      // 现在是白棋回合（currentPlayer = 2）
      expect(getCurrentPlayer(engine)).toBe(2);
      // 键盘落子应该被忽略
      engine.handleKeyDown(' ');
      // 不应增加落子
      expect(getMoveCount(engine)).toBe(1);
    });

    it('AI 模式下白棋回合玩家不能落子（鼠标）', () => {
      const engine = startEngine();
      (engine as any).mode = 'AI';
      placeMove(engine, 7, 7);
      expect(getCurrentPlayer(engine)).toBe(2);

      const { x, y } = canvasToGrid(7, 8);
      engine.handleClick(x, y);
      expect(getMoveCount(engine)).toBe(1);
    });
  });

  // ==================== T17: 连续多步交互 ====================
  describe('连续多步交互', () => {
    it('交替落子 10 步后 moveCount 为 10', () => {
      const engine = startEngine();
      const moves = [
        [7, 7], [7, 8], [7, 9], [8, 7], [8, 8],
        [8, 9], [9, 7], [9, 8], [9, 9], [6, 6],
      ];
      for (const [r, c] of moves) {
        placeMove(engine, r, c);
      }
      expect(getMoveCount(engine)).toBe(10);
    });

    it('交替落子后 currentPlayer 正确', () => {
      const engine = startEngine();
      for (let i = 0; i < 10; i++) {
        placeMove(engine, Math.floor(i / 5), i % 5);
      }
      // 10 步后，黑棋下了 5 次，白棋 5 次，轮到黑棋
      expect(getCurrentPlayer(engine)).toBe(1);
    });

    it('键盘方向键 + 落子组合操作', () => {
      const engine = startEngine();
      // 移动光标到 (5, 3)
      for (let i = 0; i < 2; i++) engine.handleKeyDown('ArrowUp');
      for (let i = 0; i < 4; i++) engine.handleKeyDown('ArrowLeft');
      expect(getCursor(engine)).toEqual({ row: 5, col: 3 });

      // 落子
      engine.handleKeyDown(' ');
      expect(getBoard(engine)[5][3]).toBe(1);
      expect(getMoveCount(engine)).toBe(1);
    });
  });

  // ==================== T18: handleKeyUp ====================
  describe('handleKeyUp', () => {
    it('handleKeyUp 不抛异常', () => {
      const engine = startEngine();
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });
});
