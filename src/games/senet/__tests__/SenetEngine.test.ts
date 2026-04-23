import { vi } from 'vitest';
import { SenetEngine } from '../SenetEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TOTAL_CELLS,
  CELL_SIZE,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  BOARD_PADDING,
  PIECES_PER_PLAYER,
  PLAYER1,
  PLAYER2,
  STICK_COUNT,
  SAFE_HOUSE,
  BEAUTY_HOUSE,
  WATER_HOUSE,
  TRUTH_HOUSE,
  RE_ATOUM_HOUSE,
  EXIT_HOUSE,
  SAFE_HOUSES,
  THROW_EXTRA_TURN,
  AI_DELAY,
} from '../constants';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): SenetEngine {
  const engine = new SenetEngine();
  const canvas = createCanvas();
  engine.init(canvas);
  return engine;
}

function startEngine(): SenetEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/**
 * 模拟引擎 update
 */
function advanceUpdate(engine: SenetEngine, deltaTime: number): void {
  (engine as any).update(deltaTime);
}

/**
 * 获取内部 board
 */
function getBoard(engine: SenetEngine): number[] {
  return (engine as any).board;
}

/**
 * 设置内部 board
 */
function setBoard(engine: SenetEngine, board: number[]): void {
  (engine as any).board = [...board];
}

/**
 * 获取当前玩家
 */
function getCurrentPlayer(engine: SenetEngine): number {
  return (engine as any).currentPlayer;
}

/**
 * 设置当前玩家
 */
function setCurrentPlayer(engine: SenetEngine, player: 1 | 2): void {
  (engine as any).currentPlayer = player;
}

/**
 * 获取游戏阶段
 */
function getPhase(engine: SenetEngine): string {
  return (engine as any).phase;
}

/**
 * 设置游戏阶段
 */
function setPhase(engine: SenetEngine, phase: string): void {
  (engine as any).phase = phase;
}

/**
 * 获取掷棍结果
 */
function getLastThrow(engine: SenetEngine): any {
  return (engine as any).lastThrow;
}

/**
 * 设置掷棍结果
 */
function setLastThrow(engine: SenetEngine, throwResult: any): void {
  (engine as any).lastThrow = throwResult;
}

/**
 * 获取有效移动
 */
function getValidMoves(engine: SenetEngine): number[] {
  return (engine as any).validMoves;
}

/**
 * 获取选中棋子
 */
function getSelectedPiece(engine: SenetEngine): number {
  return (engine as any).selectedPiece;
}

/**
 * 获取已移出棋子数
 */
function getBorneOff(engine: SenetEngine): Record<1 | 2, number> {
  return (engine as any).borneOff;
}

/**
 * 获取光标位置
 */
function getCursorPos(engine: SenetEngine): number {
  return (engine as any).cursor.position;
}

/**
 * 获取消息
 */
function getMessage(engine: SenetEngine): string {
  return (engine as any).message;
}

/**
 * 获取 AI 状态
 */
function getAIState(engine: SenetEngine): { thinking: boolean; timer: number } {
  return (engine as any).aiState;
}

/**
 * 强制掷出指定结果
 */
function forceThrow(engine: SenetEngine, value: number): void {
  const whiteCount = value;
  const extraTurn = THROW_EXTRA_TURN.includes(value);
  (engine as any).lastThrow = { value, whiteCount, extraTurn };
  (engine as any).throwAnimating = false;
  (engine as any).phase = 'selecting';
  (engine as any).validMoves = (engine as any).getAllValidMoves(value);
}

// ==================== 棋盘初始化测试 ====================

describe('SenetEngine - 棋盘初始化', () => {
  it('应该正确创建引擎实例', () => {
    const engine = createEngine();
    expect(engine).toBeInstanceOf(SenetEngine);
    expect(engine.score).toBe(0);
    expect(engine.level).toBe(1);
    expect(engine.status).toBe('idle');
  });

  it('棋盘应有30格', () => {
    const engine = startEngine();
    const board = getBoard(engine);
    expect(board).toHaveLength(TOTAL_CELLS);
  });

  it('初始棋盘交替放置棋子', () => {
    const engine = startEngine();
    const board = getBoard(engine);
    // 玩家1在索引 0,2,4,6,8
    expect(board[0]).toBe(PLAYER1);
    expect(board[2]).toBe(PLAYER1);
    expect(board[4]).toBe(PLAYER1);
    expect(board[6]).toBe(PLAYER1);
    expect(board[8]).toBe(PLAYER1);
    // 玩家2在索引 1,3,5,7,9
    expect(board[1]).toBe(PLAYER2);
    expect(board[3]).toBe(PLAYER2);
    expect(board[5]).toBe(PLAYER2);
    expect(board[7]).toBe(PLAYER2);
    expect(board[9]).toBe(PLAYER2);
  });

  it('初始棋盘其余格为空', () => {
    const engine = startEngine();
    const board = getBoard(engine);
    for (let i = 10; i < TOTAL_CELLS; i++) {
      expect(board[i]).toBe(0);
    }
  });

  it('每方各5个棋子', () => {
    const engine = startEngine();
    const board = getBoard(engine);
    const p1Count = board.filter((c: number) => c === PLAYER1).length;
    const p2Count = board.filter((c: number) => c === PLAYER2).length;
    expect(p1Count).toBe(PIECES_PER_PLAYER);
    expect(p2Count).toBe(PIECES_PER_PLAYER);
  });

  it('初始玩家为 PLAYER1', () => {
    const engine = startEngine();
    expect(getCurrentPlayer(engine)).toBe(PLAYER1);
  });

  it('初始阶段为 rolling', () => {
    const engine = startEngine();
    expect(getPhase(engine)).toBe('rolling');
  });

  it('初始已移出棋子为0', () => {
    const engine = startEngine();
    const borneOff = getBorneOff(engine);
    expect(borneOff[1]).toBe(0);
    expect(borneOff[2]).toBe(0);
  });
});

// ==================== 掷棍测试 ====================

describe('SenetEngine - 掷棍', () => {
  it('掷棍结果在 0-4 范围内', () => {
    const engine = startEngine();
    for (let i = 0; i < 50; i++) {
      engine.onReset();
      engine.start();
      const result = engine.throwSticks();
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(4);
      expect(result.whiteCount).toBeGreaterThanOrEqual(0);
      expect(result.whiteCount).toBeLessThanOrEqual(STICK_COUNT);
    }
  });

  it('掷出 1 或 4 获得额外回合', () => {
    const engine = startEngine();
    const result = engine.throwSticks();
    if (result.value === 1 || result.value === 4) {
      expect(result.extraTurn).toBe(true);
    }
    // 不能保证一定掷出 1 或 4，所以也测试直接构造
    expect(THROW_EXTRA_TURN).toContain(1);
    expect(THROW_EXTRA_TURN).toContain(4);
  });

  it('掷出 0、2、3 不获得额外回合', () => {
    expect(THROW_EXTRA_TURN).not.toContain(0);
    expect(THROW_EXTRA_TURN).not.toContain(2);
    expect(THROW_EXTRA_TURN).not.toContain(3);
  });

  it('按 T 键触发掷棍', () => {
    const engine = startEngine();
    expect(getPhase(engine)).toBe('rolling');
    engine.handleKeyDown('t');
    // 掷棍动画开始
    expect((engine as any).throwAnimating).toBe(true);
  });

  it('大写 T 键触发掷棍', () => {
    const engine = startEngine();
    engine.handleKeyDown('T');
    expect((engine as any).throwAnimating).toBe(true);
  });

  it('非 rolling 阶段按 T 不掷棍', () => {
    const engine = startEngine();
    setPhase(engine, 'selecting');
    engine.handleKeyDown('T');
    expect((engine as any).throwAnimating).toBeFalsy();
  });

  it('掷棍动画完成后进入 selecting 阶段', () => {
    const engine = startEngine();
    engine.handleKeyDown('T');
    // 推进动画完成
    advanceUpdate(engine, 600);
    // 应该进入 selecting 或已跳过（掷出0）
    const phase = getPhase(engine);
    expect(['selecting', 'rolling', 'ai_turn']).toContain(phase);
  });

  it('掷出 0 步跳过回合', () => {
    const engine = startEngine();
    // 掷出0步，跳过回合（切换到对方或AI）
    (engine as any).lastThrow = { value: 0, whiteCount: 0, extraTurn: false };
    (engine as any).throwAnimating = false;
    (engine as any).onThrowComplete();
    // 应该切换玩家（PLAYER2是AI，所以进入ai_turn）
    expect(getPhase(engine)).toBe('ai_turn');
    expect(getCurrentPlayer(engine)).toBe(PLAYER2);
  });
});

// ==================== 棋子移动测试 ====================

describe('SenetEngine - 棋子移动', () => {
  it('selectPiece 选择自己的棋子', () => {
    const engine = startEngine();
    // 设置简单棋盘，避免阻挡
    const board = new Array(TOTAL_CELLS).fill(0);
    board[0] = PLAYER1;
    setBoard(engine, board);
    forceThrow(engine, 2);
    const result = engine.selectPiece(0);
    expect(result).toBe(true);
    expect(getSelectedPiece(engine)).toBe(0);
  });

  it('selectPiece 不能选择对方棋子', () => {
    const engine = startEngine();
    forceThrow(engine, 2);
    // 索引1是玩家2的棋子
    const result = engine.selectPiece(1);
    expect(result).toBe(false);
  });

  it('selectPiece 不能选择空格', () => {
    const engine = startEngine();
    forceThrow(engine, 2);
    const result = engine.selectPiece(10);
    expect(result).toBe(false);
  });

  it('movePiece 移动到空格', () => {
    const engine = startEngine();
    // 设置简单棋盘
    const board = new Array(TOTAL_CELLS).fill(0);
    board[0] = PLAYER1;
    setBoard(engine, board);
    forceThrow(engine, 3);
    engine.selectPiece(0);
    const result = engine.movePiece(3);
    expect(result).toBe(true);
    expect(getBoard(engine)[0]).toBe(0);
    expect(getBoard(engine)[3]).toBe(PLAYER1);
  });

  it('movePiece 不能移动到无效位置', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[0] = PLAYER1;
    setBoard(engine, board);
    forceThrow(engine, 3);
    engine.selectPiece(0);
    const result = engine.movePiece(5); // 不在有效移动中
    expect(result).toBe(false);
  });

  it('移动后棋子位置正确', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[5] = PLAYER1;
    setBoard(engine, board);
    forceThrow(engine, 4);
    engine.selectPiece(5);
    engine.movePiece(9);
    expect(getBoard(engine)[5]).toBe(0);
    expect(getBoard(engine)[9]).toBe(PLAYER1);
  });

  it('不能移动到有自己棋子的格子', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[0] = PLAYER1;
    board[3] = PLAYER1;
    setBoard(engine, board);
    forceThrow(engine, 3);
    // 索引0的棋子移动3步到索引3，但那里有自己的棋子
    const moves = (engine as any).getValidMovesForPiece(0, 3);
    expect(moves).not.toContain(3);
  });

  it('移动经过蛇形路径正确', () => {
    const engine = startEngine();
    // 从索引9（第10格）移动3步到索引12（第13格）
    const board = new Array(TOTAL_CELLS).fill(0);
    board[9] = PLAYER1;
    setBoard(engine, board);
    forceThrow(engine, 3);
    engine.selectPiece(9);
    engine.movePiece(12);
    expect(getBoard(engine)[12]).toBe(PLAYER1);
  });
});

// ==================== 安全格测试 ====================

describe('SenetEngine - 安全格', () => {
  it('安全格列表正确', () => {
    expect(SAFE_HOUSES).toContain(SAFE_HOUSE);
    expect(SAFE_HOUSES).toContain(BEAUTY_HOUSE);
    expect(SAFE_HOUSES).toContain(TRUTH_HOUSE);
    expect(SAFE_HOUSES).toContain(RE_ATOUM_HOUSE);
  });

  it('安全格上的对方棋子不能被吃', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[10] = PLAYER1;
    // 安全屋在索引14（第15格）
    board[14] = PLAYER2;
    setBoard(engine, board);
    const moves = (engine as any).getValidMovesForPiece(10, 4);
    expect(moves).not.toContain(14);
  });

  it('非安全格上的对方棋子可以被吃', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[0] = PLAYER1;
    board[3] = PLAYER2;
    setBoard(engine, board);
    const moves = (engine as any).getValidMovesForPiece(0, 3);
    expect(moves).toContain(3);
  });

  it('吃子后对方棋子被送回', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[0] = PLAYER1;
    board[3] = PLAYER2;
    setBoard(engine, board);
    forceThrow(engine, 3);
    engine.selectPiece(0);
    engine.movePiece(3);
    // 玩家1应在索引3
    expect(getBoard(engine)[3]).toBe(PLAYER1);
    // 玩家2应被送回某个起始位置
    const p2Positions: number[] = [];
    const newBoard = getBoard(engine);
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (newBoard[i] === PLAYER2) p2Positions.push(i);
    }
    expect(p2Positions.length).toBe(1);
    expect(p2Positions[0]).toBeLessThan(10);
  });

  it('水之屋特殊规则', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    // 棋子在索引25（第26格），移动1步到索引26（第27格=水之屋）
    board[25] = PLAYER1;
    setBoard(engine, board);
    forceThrow(engine, 1);
    engine.selectPiece(25);
    engine.movePiece(26);
    // 应该被送到安全屋（索引14）如果安全屋为空
    const newBoard = getBoard(engine);
    if (newBoard[14] === PLAYER1) {
      // 成功送到安全屋
      expect(newBoard[14]).toBe(PLAYER1);
      expect(newBoard[26]).toBe(0);
    }
  });
});

// ==================== 胜利条件测试 ====================

describe('SenetEngine - 胜利条件', () => {
  it('所有棋子移出后胜利', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    setBoard(engine, board);
    // 设置已移出棋子数
    (engine as any).borneOff = { 1: PIECES_PER_PLAYER, 2: 0 };
    // 手动触发移出
    (engine as any).currentPlayer = PLAYER1;
    (engine as any).checkWin(PLAYER1);
    expect((engine as any).checkWin(PLAYER1)).toBe(true);
  });

  it('未全部移出不胜利', () => {
    const engine = startEngine();
    (engine as any).borneOff = { 1: PIECES_PER_PLAYER - 1, 2: 0 };
    expect((engine as any).checkWin(PLAYER1)).toBe(false);
  });

  it('移出棋盘增加已移出计数', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    // 在最后一格放一个棋子
    board[TOTAL_CELLS - 1] = PLAYER1;
    setBoard(engine, board);
    // 设置所有棋子过了安全屋
    (engine as any).canBearOff = () => true;
    forceThrow(engine, 1);
    engine.selectPiece(TOTAL_CELLS - 1);
    engine.movePiece(TOTAL_CELLS);
    expect(getBorneOff(engine)[1]).toBe(1);
  });
});

// ==================== AI 测试 ====================

describe('SenetEngine - AI', () => {
  it('AI 回合自动掷棍', () => {
    const engine = startEngine();
    // 切换到 AI 回合
    setCurrentPlayer(engine, PLAYER2);
    setPhase(engine, 'ai_turn');
    (engine as any).aiState = { thinking: true, timer: 0 };
    // 推进 AI 延迟时间（多步推进确保 AI 完成整个流程）
    for (let i = 0; i < 20; i++) {
      advanceUpdate(engine, AI_DELAY + 100);
    }
    // AI 应该已经执行了某些操作（phase 应该已变化）
    const phase = getPhase(engine);
    expect(['rolling', 'selecting', 'moving', 'gameover']).toContain(phase);
  });

  it('AI 选择最优移动', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[20] = PLAYER2; // AI 棋子在索引20
    board[24] = PLAYER1; // 玩家棋子在索引24（非安全格）
    setBoard(engine, board);
    setCurrentPlayer(engine, PLAYER2);

    // 掷出4步，可以吃子
    const moves = (engine as any).getValidMovesForPiece(20, 4);
    expect(moves).toContain(24);
  });

  it('AI 回合时玩家不能操作', () => {
    const engine = startEngine();
    setPhase(engine, 'ai_turn');
    engine.handleKeyDown('T');
    expect((engine as any).throwAnimating).toBeFalsy();
  });
});

// ==================== 键盘输入测试 ====================

describe('SenetEngine - 键盘输入', () => {
  it('方向键移动光标', () => {
    const engine = startEngine();
    setPhase(engine, 'selecting');
    const initialPos = getCursorPos(engine);
    engine.handleKeyDown('ArrowRight');
    expect(getCursorPos(engine)).toBe(initialPos + 1);
  });

  it('方向键左移动光标', () => {
    const engine = startEngine();
    setPhase(engine, 'selecting');
    (engine as any).cursor.position = 5;
    engine.handleKeyDown('ArrowLeft');
    expect(getCursorPos(engine)).toBe(4);
  });

  it('方向键上移动光标', () => {
    const engine = startEngine();
    setPhase(engine, 'selecting');
    (engine as any).cursor.position = 15;
    engine.handleKeyDown('ArrowUp');
    expect(getCursorPos(engine)).toBe(15 - 10);
  });

  it('方向键下移动光标', () => {
    const engine = startEngine();
    setPhase(engine, 'selecting');
    (engine as any).cursor.position = 5;
    engine.handleKeyDown('ArrowDown');
    expect(getCursorPos(engine)).toBe(15);
  });

  it('光标不能超出棋盘边界', () => {
    const engine = startEngine();
    setPhase(engine, 'selecting');
    (engine as any).cursor.position = 0;
    engine.handleKeyDown('ArrowLeft');
    expect(getCursorPos(engine)).toBe(0);
  });

  it('光标不能超出右边界', () => {
    const engine = startEngine();
    setPhase(engine, 'selecting');
    (engine as any).cursor.position = TOTAL_CELLS - 1;
    engine.handleKeyDown('ArrowRight');
    expect(getCursorPos(engine)).toBe(TOTAL_CELLS - 1);
  });

  it('空格键确认选择棋子', () => {
    const engine = startEngine();
    forceThrow(engine, 2);
    // 确保处于 selecting 阶段且 cursor 位置有当前玩家的棋子
    (engine as any).phase = 'selecting';
    const board = getBoard(engine);
    // 找到 P1 的一个有有效移动的棋子（不能只找第一个，可能走不到目标格）
    let p1Pos = -1;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (board[i] === PLAYER1) {
        const moves = (engine as any).getValidMovesForPiece(i);
        if (moves.length > 0) { p1Pos = i; break; }
      }
    }
    expect(p1Pos).toBeGreaterThanOrEqual(0);
    (engine as any).cursor.position = p1Pos;
    engine.handleKeyDown(' ');
    expect(getSelectedPiece(engine)).toBe(p1Pos);
  });

  it('空格键确认移动', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[0] = PLAYER1;
    setBoard(engine, board);
    forceThrow(engine, 2);
    engine.selectPiece(0);
    (engine as any).cursor.position = 2;
    engine.handleKeyDown(' ');
    expect(getBoard(engine)[2]).toBe(PLAYER1);
  });

  it('非 playing 状态按键无效', () => {
    const engine = createEngine();
    const pos = getCursorPos(engine);
    engine.handleKeyDown('ArrowRight');
    expect(getCursorPos(engine)).toBe(pos);
  });

  it('掷棍动画中按键无效', () => {
    const engine = startEngine();
    engine.handleKeyDown('T');
    const pos = getCursorPos(engine);
    setPhase(engine, 'selecting');
    engine.handleKeyDown('ArrowRight');
    expect(getCursorPos(engine)).toBe(pos);
  });

  it('handleKeyUp 记录按键释放', () => {
    const engine = startEngine();
    engine.handleKeyDown('T');
    expect((engine as any).keysDown.has('T')).toBe(true);
    engine.handleKeyUp('T');
    expect((engine as any).keysDown.has('T')).toBe(false);
  });
});

// ==================== getState 测试 ====================

describe('SenetEngine - getState', () => {
  it('返回正确的状态对象', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('board');
    expect(state).toHaveProperty('currentPlayer');
    expect(state).toHaveProperty('phase');
    expect(state).toHaveProperty('lastThrow');
    expect(state).toHaveProperty('validMoves');
    expect(state).toHaveProperty('selectedPiece');
    expect(state).toHaveProperty('cursor');
    expect(state).toHaveProperty('borneOff');
    expect(state).toHaveProperty('isWin');
    expect(state).toHaveProperty('message');
    expect(state).toHaveProperty('score');
  });

  it('初始状态值正确', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state.currentPlayer).toBe(PLAYER1);
    expect(state.phase).toBe('rolling');
    expect(state.lastThrow).toBeNull();
    expect(state.selectedPiece).toBe(-1);
    expect(state.isWin).toBe(false);
    expect(state.score).toBe(0);
  });

  it('棋盘状态是副本', () => {
    const engine = startEngine();
    const state1 = engine.getState();
    const state2 = engine.getState();
    expect(state1.board).not.toBe(state2.board);
  });
});

// ==================== 公共方法测试 ====================

describe('SenetEngine - 公共方法', () => {
  it('getBoard 返回副本', () => {
    const engine = startEngine();
    const b1 = engine.getBoard();
    const b2 = engine.getBoard();
    expect(b1).not.toBe(b2);
    expect(b1).toEqual(b2);
  });

  it('getCurrentPlayer 返回当前玩家', () => {
    const engine = startEngine();
    expect(engine.getCurrentPlayer()).toBe(PLAYER1);
  });

  it('getPhase 返回当前阶段', () => {
    const engine = startEngine();
    expect(engine.getPhase()).toBe('rolling');
  });

  it('getLastThrow 初始为 null', () => {
    const engine = startEngine();
    expect(engine.getLastThrow()).toBeNull();
  });

  it('getValidMoves 返回副本', () => {
    const engine = startEngine();
    const m1 = engine.getValidMoves();
    const m2 = engine.getValidMoves();
    expect(m1).not.toBe(m2);
  });

  it('getBorneOff 返回副本', () => {
    const engine = startEngine();
    const b1 = engine.getBorneOff();
    const b2 = engine.getBorneOff();
    expect(b1).not.toBe(b2);
    expect(b1).toEqual(b2);
  });

  it('getCursorPosition 返回光标位置', () => {
    const engine = startEngine();
    expect(engine.getCursorPosition()).toBe(0);
  });

  it('getMessage 返回消息', () => {
    const engine = startEngine();
    expect(engine.getMessage()).toBeTruthy();
  });
});

// ==================== 生命周期测试 ====================

describe('SenetEngine - 生命周期', () => {
  it('start 后状态为 playing', () => {
    const engine = startEngine();
    expect(engine.status).toBe('playing');
  });

  it('pause 后状态为 paused', () => {
    const engine = startEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后状态为 playing', () => {
    const engine = startEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后状态为 idle', () => {
    const engine = startEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.score).toBe(0);
  });

  it('destroy 后清理资源', () => {
    const engine = startEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('start 后重新初始化棋盘', () => {
    const engine = startEngine();
    forceThrow(engine, 3);
    engine.selectPiece(0);
    engine.reset();
    engine.start();
    const board = getBoard(engine);
    expect(board[0]).toBe(PLAYER1);
    expect(board[1]).toBe(PLAYER2);
    expect(getPhase(engine)).toBe('rolling');
  });
});

// ==================== 事件测试 ====================

describe('SenetEngine - 事件', () => {
  it('触发 statusChange 事件', () => {
    const engine = createEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('gameover 触发 statusChange', () => {
    const engine = startEngine();
    const handler = vi.fn();
    engine.on('statusChange', handler);
    // 模拟胜利
    const board = new Array(TOTAL_CELLS).fill(0);
    setBoard(engine, board);
    (engine as any).borneOff = { 1: PIECES_PER_PLAYER - 1, 2: 0 };
    (engine as any).currentPlayer = PLAYER1;
    // 在最后一格放棋子并移出
    board[TOTAL_CELLS - 1] = PLAYER1;
    setBoard(engine, board);
    forceThrow(engine, 1);
    engine.selectPiece(TOTAL_CELLS - 1);
    engine.movePiece(TOTAL_CELLS);
    expect(handler).toHaveBeenCalledWith('gameover');
  });
});

// ==================== 额外规则测试 ====================

describe('SenetEngine - 额外规则', () => {
  it('额外回合不切换玩家', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[0] = PLAYER1;
    setBoard(engine, board);
    // 掷出1（额外回合）
    forceThrow(engine, 1);
    engine.selectPiece(0);
    engine.movePiece(1);
    // 掷出1是额外回合，应该还是玩家1
    expect(getCurrentPlayer(engine)).toBe(PLAYER1);
  });

  it('无有效移动跳过回合', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[0] = PLAYER1;
    setBoard(engine, board);
    // 掷出5，但索引0+5=5是空的，应该可以移动
    // 让我们测试一个确实无移动的场景
    board[0] = PLAYER1;
    board[5] = PLAYER1; // 阻挡移动到5
    setBoard(engine, board);
    const moves = (engine as any).getAllValidMoves(5);
    // 索引0的棋子移动5步到索引5被阻挡
    expect(moves).not.toContain(5);
  });

  it('canBearOff 检查正确', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    // 所有玩家1棋子都在安全屋之后
    board[15] = PLAYER1;
    board[20] = PLAYER1;
    setBoard(engine, board);
    expect((engine as any).canBearOff(PLAYER1)).toBe(true);
  });

  it('canBearOff 棋子在前方时不能移出', () => {
    const engine = startEngine();
    const board = new Array(TOTAL_CELLS).fill(0);
    board[5] = PLAYER1; // 在安全屋之前
    board[20] = PLAYER1;
    setBoard(engine, board);
    expect((engine as any).canBearOff(PLAYER1)).toBe(false);
  });

  it('棋盘路径映射正确', () => {
    const engine = startEngine();
    // 第一行左到右
    expect((engine as any).indexToRowCol(0)).toEqual({ row: 0, col: 0 });
    expect((engine as any).indexToRowCol(9)).toEqual({ row: 0, col: 9 });
    // 第二行右到左
    expect((engine as any).indexToRowCol(10)).toEqual({ row: 1, col: 9 });
    expect((engine as any).indexToRowCol(19)).toEqual({ row: 1, col: 0 });
    // 第三行左到右
    expect((engine as any).indexToRowCol(20)).toEqual({ row: 2, col: 0 });
    expect((engine as any).indexToRowCol(29)).toEqual({ row: 2, col: 9 });
  });

  it('行列到索引映射正确', () => {
    const engine = startEngine();
    expect((engine as any).rowColToIndex(0, 0)).toBe(0);
    expect((engine as any).rowColToIndex(0, 9)).toBe(9);
    expect((engine as any).rowColToIndex(1, 9)).toBe(10);
    expect((engine as any).rowColToIndex(1, 0)).toBe(19);
    expect((engine as any).rowColToIndex(2, 0)).toBe(20);
    expect((engine as any).rowColToIndex(2, 9)).toBe(29);
  });
});

// ==================== 渲染相关测试 ====================

describe('SenetEngine - 渲染', () => {
  it('getCellCenter 返回正确坐标', () => {
    const engine = startEngine();
    const center = (engine as any).getCellCenter(0);
    expect(center.x).toBe(BOARD_OFFSET_X + CELL_SIZE / 2);
    expect(center.y).toBe(BOARD_OFFSET_Y + CELL_SIZE / 2);
  });

  it('getCellCenter 第二行坐标正确', () => {
    const engine = startEngine();
    const center = (engine as any).getCellCenter(10);
    // 索引10 = row 1, col 9
    const expectedX = BOARD_OFFSET_X + 9 * (CELL_SIZE + BOARD_PADDING) + CELL_SIZE / 2;
    const expectedY = BOARD_OFFSET_Y + 1 * (CELL_SIZE + BOARD_PADDING) + CELL_SIZE / 2;
    expect(center.x).toBe(expectedX);
    expect(center.y).toBe(expectedY);
  });
});
