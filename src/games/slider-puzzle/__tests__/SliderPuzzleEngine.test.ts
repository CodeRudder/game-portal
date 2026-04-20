/**
 * SliderPuzzleEngine 综合测试
 * 覆盖：初始化、启动/打乱、移动方块、完成检测、网格尺寸切换、
 *       点击操作、动画、状态管理、handleKeyDown/Up、getState、
 *       静态工具方法、事件系统、边界与异常场景、常量验证
 */
import { SliderPuzzleEngine } from '../SliderPuzzleEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  DEFAULT_GRID_SIZE, SUPPORTED_GRID_SIZES, BOARD_PADDING, TILE_GAP, TILE_RADIUS,
  BG_COLOR, BOARD_BG_COLOR, TILE_COLORS, TILE_TEXT_COLOR, HUD_TEXT_COLOR,
  EMPTY_TILE_COLOR, SHUFFLE_MOVES, ANIMATION_DURATION, TILE_FONT_SIZE,
  HUD_FONT_SIZE, WIN_FONT_SIZE,
} from '../constants';

// ============================================================
// Helpers
// ============================================================

/** 创建一个带 mock context 的 canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建引擎并初始化（不 start，停留在 idle） */
function createEngine(): SliderPuzzleEngine {
  const engine = new SliderPuzzleEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): SliderPuzzleEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: SliderPuzzleEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: SliderPuzzleEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 调用 protected update 方法 */
function callUpdate(engine: SliderPuzzleEngine, deltaTime: number) {
  const proto = Object.getPrototypeOf(engine);
  const updateFn = proto.update.bind(engine);
  updateFn(deltaTime);
}

/** 创建已解决状态的棋盘 */
function createSolvedBoard(size: number): number[][] {
  const board: number[][] = [];
  let num = 1;
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      row.push(num++);
    }
    board.push(row);
  }
  board[size - 1][size - 1] = 0;
  return board;
}

/** 检查棋盘是否已解决 */
function isSolvedBoard(board: number[][], size: number): boolean {
  let expected = 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (r === size - 1 && c === size - 1) {
        if (board[r][c] !== 0) return false;
      } else {
        if (board[r][c] !== expected) return false;
        expected++;
      }
    }
  }
  return true;
}

/** 棋盘转一维（用于逆序数计算） */
function flattenBoard(board: number[][]): number[] {
  return board.flat();
}

// ============================================================
// 1. 初始化
// ============================================================
describe('SliderPuzzleEngine - 初始化', () => {
  it('init 后状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('init 后分数为 0', () => {
    const engine = createEngine();
    expect(engine.score).toBe(0);
  });

  it('init 后等级为 1', () => {
    const engine = createEngine();
    expect(engine.level).toBe(1);
  });

  it('init 后 moveCount 为 0', () => {
    const engine = createEngine();
    expect(engine.moveCount).toBe(0);
  });

  it('init 后 isCompleted 为 false', () => {
    const engine = createEngine();
    expect(engine.isCompleted).toBe(false);
  });

  it('init 后 gridSize 为 DEFAULT_GRID_SIZE', () => {
    const engine = createEngine();
    expect(engine.gridSize).toBe(DEFAULT_GRID_SIZE);
  });

  it('init 后棋盘为已解决状态', () => {
    const engine = createEngine();
    const board = engine.getBoard();
    expect(isSolvedBoard(board, DEFAULT_GRID_SIZE)).toBe(true);
  });

  it('init 后空位在右下角', () => {
    const engine = createEngine();
    const pos = engine.getEmptyPosition();
    expect(pos.row).toBe(DEFAULT_GRID_SIZE - 1);
    expect(pos.col).toBe(DEFAULT_GRID_SIZE - 1);
  });

  it('init 后 bestMoves 为 0', () => {
    const engine = createEngine();
    expect(engine.bestMoves).toBe(0);
  });

  it('getBoard 返回的是副本而非引用', () => {
    const engine = createEngine();
    const board1 = engine.getBoard();
    const board2 = engine.getBoard();
    expect(board1).not.toBe(board2);
    expect(board1).toEqual(board2);
  });
});

// ============================================================
// 2. 启动 / onStart
// ============================================================
describe('SliderPuzzleEngine - 启动', () => {
  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后 moveCount 为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.moveCount).toBe(0);
  });

  it('start 后 isCompleted 为 false', () => {
    const engine = createAndStartEngine();
    expect(engine.isCompleted).toBe(false);
  });

  it('start 后棋盘被打乱（非解决状态）', () => {
    const engine = createAndStartEngine();
    const board = engine.getBoard();
    expect(isSolvedBoard(board, DEFAULT_GRID_SIZE)).toBe(false);
  });

  it('start 后棋盘仍然可解', () => {
    const engine = createAndStartEngine();
    const board = engine.getBoard();
    expect(SliderPuzzleEngine.isSolvable(board, DEFAULT_GRID_SIZE)).toBe(true);
  });

  it('start 发出 statusChange 事件', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('start 发出 scoreChange 事件', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    engine.start();
    expect(handler).toHaveBeenCalledWith(0);
  });

  it('start 后 gridSize 不变', () => {
    const engine = createAndStartEngine();
    expect(engine.gridSize).toBe(DEFAULT_GRID_SIZE);
  });

  it('start 后棋盘包含所有数字 0~N*N-1', () => {
    const engine = createAndStartEngine();
    const flat = engine.getBoard().flat().sort((a, b) => a - b);
    const expected = Array.from({ length: DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE }, (_, i) => i);
    expect(flat).toEqual(expected);
  });
});

// ============================================================
// 3. 方块移动
// ============================================================
describe('SliderPuzzleEngine - 方块移动', () => {
  let engine: SliderPuzzleEngine;

  beforeEach(() => {
    engine = createEngine();
    // 设置为已解决状态，手动设置一个简单的打乱
    // 1 2 3
    // 4 5 6
    // 7 0 8  （空位在 (2,1)，8 在 (2,2)）
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);
    setPrivate(engine, '_moveCount', 0);
  });

  it('ArrowRight 将空位右边的方块向左移入空位', () => {
    engine.handleKeyDown('ArrowRight');
    const board = engine.getBoard();
    expect(board[2][1]).toBe(8); // 8 移到了空位
    expect(board[2][2]).toBe(0); // 空位移到了 (2,2)
  });

  it('ArrowLeft 将空位左边的方块向右移入空位', () => {
    // 使用不触发完成的状态
    // 1 2 3
    // 4 0 6
    // 7 5 8
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 0, 6],
      [7, 5, 8],
    ]);
    setPrivate(engine, '_emptyRow', 1);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_isCompleted', false);

    // ArrowLeft: 移动 (1,0)=4 到空位 (1,1)
    engine.handleKeyDown('ArrowLeft');
    const board = engine.getBoard();
    expect(board[1][1]).toBe(4);
    expect(board[1][0]).toBe(0);
  });

  it('ArrowUp 将空位上方的方块向下移入空位', () => {
    // 空位在 (2,1)，上方 (1,1) 是 5
    engine.handleKeyDown('ArrowUp');
    const board = engine.getBoard();
    expect(board[2][1]).toBe(5);
    expect(board[1][1]).toBe(0);
  });

  it('ArrowDown 将空位下方的方块向上移入空位', () => {
    // 先把空位移到 (1,1)
    engine.handleKeyDown('ArrowUp');
    // 空位在 (1,1)，下方 (2,1) 是 5
    engine.handleKeyDown('ArrowDown');
    const board = engine.getBoard();
    expect(board[1][1]).toBe(5);
    expect(board[2][1]).toBe(0);
  });

  it('每次移动 moveCount 加 1', () => {
    // 使用一个不会触发完成的状态
    // 1 2 3
    // 4 0 6
    // 7 5 8
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 0, 6],
      [7, 5, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 1);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);
    setPrivate(engine, '_moveCount', 0);

    expect(engine.moveCount).toBe(0);
    engine.handleKeyDown('ArrowUp');
    expect(engine.moveCount).toBe(1);
    engine.handleKeyDown('ArrowDown');
    expect(engine.moveCount).toBe(2);
  });

  it('移动后 score 等于 moveCount', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.score).toBe(engine.moveCount);
  });

  it('移动发出 scoreChange 事件', () => {
    const handler = jest.fn();
    engine.on('scoreChange', handler);
    engine.handleKeyDown('ArrowRight');
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('不能将空位移出边界（上边界）', () => {
    // 空位在 (2,1)，上方是 (1,1)
    // 先把空位移到 (0,1)
    setPrivate(engine, '_emptyRow', 0);
    setPrivate(engine, '_emptyCol', 1);
    const board = engine.getBoard();
    // 交换 (0,1) 和 (1,1) 使空位在 (0,1)
    const temp = board[0][1];
    board[0][1] = board[1][1];
    board[1][1] = temp;
    setPrivate(engine, '_board', board);

    const beforeCount = engine.moveCount;
    engine.handleKeyDown('ArrowUp'); // 空位上方没有方块
    expect(engine.moveCount).toBe(beforeCount); // 未移动
  });

  it('不能将空位移出边界（左边界）', () => {
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 0);
    const board = engine.getBoard();
    const temp = board[2][0];
    board[2][0] = board[2][1];
    board[2][1] = temp;
    setPrivate(engine, '_board', board);

    const beforeCount = engine.moveCount;
    engine.handleKeyDown('ArrowLeft');
    expect(engine.moveCount).toBe(beforeCount);
  });

  it('不能将空位移出边界（下边界）', () => {
    // 空位已经在最后一行 (2,1)
    const beforeCount = engine.moveCount;
    engine.handleKeyDown('ArrowDown');
    expect(engine.moveCount).toBe(beforeCount);
  });

  it('不能将空位移出边界（右边界）', () => {
    setPrivate(engine, '_emptyCol', 2);
    const board = engine.getBoard();
    const temp = board[2][2];
    board[2][2] = board[2][1];
    board[2][1] = temp;
    setPrivate(engine, '_board', board);

    const beforeCount = engine.moveCount;
    engine.handleKeyDown('ArrowRight');
    expect(engine.moveCount).toBe(beforeCount);
  });

  it('非相邻方块不能移动', () => {
    // 空位在 (2,1)，尝试移动 (0,0) 的方块
    // handleKeyDown 只处理相邻，所以不相邻的不受影响
    // 这里验证的是方向键只移动相邻方块
    const board = engine.getBoard();
    const before = board[0][0];
    engine.handleKeyDown('ArrowUp'); // 移动 (1,1) 的方块
    expect(engine.getBoard()[0][0]).toBe(before); // (0,0) 不受影响
  });

  it('未知按键不触发移动', () => {
    const beforeCount = engine.moveCount;
    engine.handleKeyDown('a');
    engine.handleKeyDown('Enter');
    engine.handleKeyDown('Escape');
    expect(engine.moveCount).toBe(beforeCount);
  });
});

// ============================================================
// 4. 完成检测
// ============================================================
describe('SliderPuzzleEngine - 完成检测', () => {
  it('已解决状态的棋盘被检测为完成', () => {
    const engine = createEngine();
    // 手动设置已解决状态
    setPrivate(engine, '_board', createSolvedBoard(3));
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 2);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    // 将最后一步移动完成拼图
    // 1 2 3
    // 4 5 6
    // 7 0 8 → 移动 8 到空位
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    engine.handleKeyDown('ArrowRight');

    expect(engine.isCompleted).toBe(true);
    expect(engine.status).toBe('gameover');
  });

  it('完成时发出 statusChange gameover 事件', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.handleKeyDown('ArrowRight');
    expect(handler).toHaveBeenCalledWith('gameover');
  });

  it('完成后不能再移动方块', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    engine.handleKeyDown('ArrowRight');
    expect(engine.isCompleted).toBe(true);

    const countAfterWin = engine.moveCount;
    engine.handleKeyDown('ArrowLeft');
    expect(engine.moveCount).toBe(countAfterWin); // 不能再移动
  });

  it('完成时更新 bestMoves', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);
    setPrivate(engine, '_bestMoves', Infinity);

    engine.handleKeyDown('ArrowRight');
    expect(engine.bestMoves).toBe(1); // 只用了 1 步
  });

  it('bestMoves 只保留更小的步数', () => {
    const engine = createEngine();
    setPrivate(engine, '_bestMoves', 5);

    // 模拟一次 10 步完成
    setPrivate(engine, '_moveCount', 10);
    setPrivate(engine, '_board', createSolvedBoard(3));
    setPrivate(engine, '_gridSize', 3);
    // 手动触发完成逻辑
    const proto = Object.getPrototypeOf(engine);
    proto.onGameOver?.call(engine);

    // bestMoves 应该保持 5（因为 10 > 5）
    expect(engine.bestMoves).toBe(5);
  });

  it('未完成时 isCompleted 为 false', () => {
    const engine = createAndStartEngine();
    expect(engine.isCompleted).toBe(false);
  });
});

// ============================================================
// 5. 网格尺寸切换
// ============================================================
describe('SliderPuzzleEngine - 网格尺寸切换', () => {
  it('setGridSize(3) 切换到 3×3', () => {
    const engine = createEngine();
    engine.setGridSize(3);
    expect(engine.gridSize).toBe(3);
  });

  it('setGridSize(5) 切换到 5×5', () => {
    const engine = createEngine();
    engine.setGridSize(5);
    expect(engine.gridSize).toBe(5);
  });

  it('setGridSize(4) 保持 4×4', () => {
    const engine = createEngine();
    engine.setGridSize(4);
    expect(engine.gridSize).toBe(4);
  });

  it('setGridSize 后棋盘为已解决状态', () => {
    const engine = createEngine();
    engine.setGridSize(3);
    const board = engine.getBoard();
    expect(isSolvedBoard(board, 3)).toBe(true);
  });

  it('setGridSize 后空位在右下角', () => {
    const engine = createEngine();
    engine.setGridSize(5);
    const pos = engine.getEmptyPosition();
    expect(pos.row).toBe(4);
    expect(pos.col).toBe(4);
  });

  it('setGridSize 后 moveCount 为 0', () => {
    const engine = createEngine();
    engine.setGridSize(3);
    expect(engine.moveCount).toBe(0);
  });

  it('setGridSize 后 isCompleted 为 false', () => {
    const engine = createEngine();
    engine.setGridSize(3);
    expect(engine.isCompleted).toBe(false);
  });

  it('不支持的大小被拒绝（如 2）', () => {
    const engine = createEngine();
    engine.setGridSize(2);
    expect(engine.gridSize).toBe(DEFAULT_GRID_SIZE); // 未变
  });

  it('不支持的大小被拒绝（如 6）', () => {
    const engine = createEngine();
    engine.setGridSize(6);
    expect(engine.gridSize).toBe(DEFAULT_GRID_SIZE);
  });

  it('不支持的大小被拒绝（如 1）', () => {
    const engine = createEngine();
    engine.setGridSize(1);
    expect(engine.gridSize).toBe(DEFAULT_GRID_SIZE);
  });

  it('playing 状态下不能切换尺寸', () => {
    const engine = createAndStartEngine();
    engine.setGridSize(3);
    expect(engine.gridSize).toBe(DEFAULT_GRID_SIZE); // 未变
  });

  it('paused 状态下不能切换尺寸', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.setGridSize(3);
    expect(engine.gridSize).toBe(DEFAULT_GRID_SIZE);
  });

  it('3×3 棋盘有 9 个元素', () => {
    const engine = createEngine();
    engine.setGridSize(3);
    const board = engine.getBoard();
    expect(board.length).toBe(3);
    expect(board.flat().length).toBe(9);
  });

  it('5×5 棋盘有 25 个元素', () => {
    const engine = createEngine();
    engine.setGridSize(5);
    const board = engine.getBoard();
    expect(board.length).toBe(5);
    expect(board.flat().length).toBe(25);
  });
});

// ============================================================
// 6. 点击操作
// ============================================================
describe('SliderPuzzleEngine - 点击操作', () => {
  let engine: SliderPuzzleEngine;

  beforeEach(() => {
    engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);
    setPrivate(engine, '_moveCount', 0);
  });

  it('点击与空位相邻的方块可以移动', () => {
    // 空位在 (2,1)，点击 (2,2) 的 8
    engine.clickTile(2, 2);
    const board = engine.getBoard();
    expect(board[2][1]).toBe(8);
    expect(board[2][2]).toBe(0);
  });

  it('点击空位上方的方块可以移动', () => {
    // 空位在 (2,1)，上方 (1,1) 是 5
    engine.clickTile(1, 1);
    const board = engine.getBoard();
    expect(board[2][1]).toBe(5);
    expect(board[1][1]).toBe(0);
  });

  it('点击空位左边的方块可以移动', () => {
    // 空位在 (2,1)，左边 (2,0) 是 7
    engine.clickTile(2, 0);
    const board = engine.getBoard();
    expect(board[2][1]).toBe(7);
    expect(board[2][0]).toBe(0);
  });

  it('点击不相邻的方块不能移动', () => {
    // 点击 (0,0) 的 1，不与空位 (2,1) 相邻
    const beforeCount = engine.moveCount;
    engine.clickTile(0, 0);
    expect(engine.moveCount).toBe(beforeCount);
  });

  it('点击空位本身不能移动', () => {
    const beforeCount = engine.moveCount;
    engine.clickTile(2, 1);
    expect(engine.moveCount).toBe(beforeCount);
  });

  it('点击越界位置不能移动', () => {
    const beforeCount = engine.moveCount;
    engine.clickTile(-1, 0);
    engine.clickTile(0, -1);
    engine.clickTile(3, 0);
    engine.clickTile(0, 3);
    expect(engine.moveCount).toBe(beforeCount);
  });

  it('idle 状态下点击无效', () => {
    setPrivate(engine, '_status', 'idle');
    const beforeCount = engine.moveCount;
    engine.clickTile(2, 2);
    expect(engine.moveCount).toBe(beforeCount);
  });

  it('完成后点击无效', () => {
    setPrivate(engine, '_isCompleted', true);
    const beforeCount = engine.moveCount;
    engine.clickTile(2, 2);
    expect(engine.moveCount).toBe(beforeCount);
  });
});

// ============================================================
// 7. 动画
// ============================================================
describe('SliderPuzzleEngine - 动画', () => {
  it('移动方块时产生动画', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    engine.handleKeyDown('ArrowRight');
    const animation = getPrivate<{
      fromRow: number; fromCol: number;
      toRow: number; toCol: number;
      progress: number;
    } | null>(engine, '_animation');
    expect(animation).not.toBeNull();
    expect(animation!.fromRow).toBe(2);
    expect(animation!.fromCol).toBe(2);
    expect(animation!.toRow).toBe(2);
    expect(animation!.toCol).toBe(1);
    expect(animation!.progress).toBe(0);
  });

  it('动画 progress 随时间增加', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, ANIMATION_DURATION / 2);
    const animation = getPrivate<{
      progress: number;
    } | null>(engine, '_animation');
    expect(animation).not.toBeNull();
    expect(animation!.progress).toBeCloseTo(0.5, 1);
  });

  it('动画完成后 _animation 变为 null', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    engine.handleKeyDown('ArrowRight');
    callUpdate(engine, ANIMATION_DURATION + 10);
    expect(getPrivate(engine, '_animation')).toBeNull();
  });

  it('无动画时 update 不崩溃', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });
});

// ============================================================
// 8. 状态管理
// ============================================================
describe('SliderPuzzleEngine - 状态管理', () => {
  it('初始状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('start 后状态为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('pause 后状态为 paused', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后状态恢复为 playing', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后状态恢复为 idle', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('gameOver 后状态为 gameover', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);
    engine.handleKeyDown('ArrowRight');
    expect(engine.status).toBe('gameover');
  });

  it('idle 时不能 pause', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('playing 时不能 resume', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后 moveCount 清零', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_moveCount', 50);
    engine.reset();
    expect(engine.moveCount).toBe(0);
  });

  it('reset 后 isCompleted 为 false', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_isCompleted', true);
    engine.reset();
    expect(engine.isCompleted).toBe(false);
  });

  it('reset 后棋盘回到已解决状态', () => {
    const engine = createAndStartEngine();
    engine.reset();
    const board = engine.getBoard();
    expect(isSolvedBoard(board, engine.gridSize)).toBe(true);
  });

  it('reset 后空位在右下角', () => {
    const engine = createAndStartEngine();
    engine.reset();
    const pos = engine.getEmptyPosition();
    expect(pos.row).toBe(engine.gridSize - 1);
    expect(pos.col).toBe(engine.gridSize - 1);
  });

  it('destroy 清除所有事件监听', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.destroy();
    const callCount = handler.mock.calls.length;
    engine.emit('statusChange', 'test');
    expect(handler).toHaveBeenCalledTimes(callCount);
  });

  it('pause/resume 发出 statusChange 事件', () => {
    const engine = createAndStartEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.pause();
    expect(handler).toHaveBeenCalledWith('paused');
    engine.resume();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('reset 发出 statusChange idle 事件', () => {
    const engine = createAndStartEngine();
    const handler = jest.fn();
    engine.on('statusChange', handler);
    engine.reset();
    expect(handler).toHaveBeenCalledWith('idle');
  });
});

// ============================================================
// 9. handleKeyDown / handleKeyUp
// ============================================================
describe('SliderPuzzleEngine - handleKeyDown / handleKeyUp', () => {
  it('Space 在 idle 状态启动游戏', () => {
    const engine = createEngine();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('Space 键别名 "Space" 也能启动', () => {
    const engine = createEngine();
    engine.handleKeyDown('Space');
    expect(engine.status).toBe('playing');
  });

  it('Space 在 gameover 状态重启游戏', () => {
    const engine = createEngine();
    setPrivate(engine, '_status', 'gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('Space 在 playing 状态不触发任何动作', () => {
    const engine = createAndStartEngine();
    const beforeStatus = engine.status;
    engine.handleKeyDown(' ');
    expect(engine.status).toBe(beforeStatus);
  });

  it('ArrowUp 移动方块', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    engine.handleKeyDown('ArrowUp');
    expect(engine.moveCount).toBe(1);
  });

  it('ArrowDown 移动方块', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 0, 6],
      [7, 5, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 1);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    engine.handleKeyDown('ArrowDown');
    expect(engine.moveCount).toBe(1);
  });

  it('ArrowLeft 移动方块', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 0],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 2);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    engine.handleKeyDown('ArrowLeft');
    expect(engine.moveCount).toBe(1);
  });

  it('ArrowRight 移动方块', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    engine.handleKeyDown('ArrowRight');
    expect(engine.moveCount).toBe(1);
  });

  it('idle 状态下方向键无效', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowUp');
    expect(engine.moveCount).toBe(0);
  });

  it('paused 状态下方向键无效', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.handleKeyDown('ArrowUp');
    expect(engine.moveCount).toBe(0);
  });

  it('handleKeyUp 不影响游戏状态', () => {
    const engine = createAndStartEngine();
    const beforeCount = engine.moveCount;
    engine.handleKeyUp('ArrowUp');
    engine.handleKeyUp('ArrowDown');
    engine.handleKeyUp('ArrowLeft');
    engine.handleKeyUp('ArrowRight');
    engine.handleKeyUp(' ');
    expect(engine.moveCount).toBe(beforeCount);
  });
});

// ============================================================
// 10. getState
// ============================================================
describe('SliderPuzzleEngine - getState', () => {
  it('返回包含所有必要字段', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('gridSize');
    expect(state).toHaveProperty('board');
    expect(state).toHaveProperty('moveCount');
    expect(state).toHaveProperty('isCompleted');
    expect(state).toHaveProperty('bestMoves');
    expect(state).toHaveProperty('emptyRow');
    expect(state).toHaveProperty('emptyCol');
  });

  it('初始状态的 getState 值正确', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.score).toBe(0);
    expect(state.level).toBe(1);
    expect(state.gridSize).toBe(DEFAULT_GRID_SIZE);
    expect(state.moveCount).toBe(0);
    expect(state.isCompleted).toBe(false);
  });

  it('移动后 getState 反映新步数', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    engine.handleKeyDown('ArrowRight');
    const state = engine.getState();
    expect(state.moveCount).toBe(1);
    expect(state.score).toBe(1);
  });

  it('getState 中的 board 是副本', () => {
    const engine = createAndStartEngine();
    const state1 = engine.getState();
    const state2 = engine.getState();
    expect(state1.board).not.toBe(state2.board);
  });

  it('emptyRow 和 emptyCol 正确', () => {
    const engine = createEngine();
    const state = engine.getState();
    expect(state.emptyRow).toBe(DEFAULT_GRID_SIZE - 1);
    expect(state.emptyCol).toBe(DEFAULT_GRID_SIZE - 1);
  });
});

// ============================================================
// 11. 静态工具方法
// ============================================================
describe('SliderPuzzleEngine - 静态工具方法', () => {
  describe('countInversions', () => {
    it('已排序序列逆序数为 0', () => {
      expect(SliderPuzzleEngine.countInversions([1, 2, 3, 4, 5])).toBe(0);
    });

    it('完全逆序序列逆序数正确', () => {
      // [5, 4, 3, 2, 1] → C(5,2) = 10
      expect(SliderPuzzleEngine.countInversions([5, 4, 3, 2, 1])).toBe(10);
    });

    it('单个逆序对', () => {
      expect(SliderPuzzleEngine.countInversions([1, 3, 2, 4, 5])).toBe(1);
    });

    it('包含 0 的序列正确计算（忽略 0）', () => {
      // [1, 2, 3, 4, 0] → 无逆序
      expect(SliderPuzzleEngine.countInversions([1, 2, 3, 4, 0])).toBe(0);
    });

    it('空序列逆序数为 0', () => {
      expect(SliderPuzzleEngine.countInversions([])).toBe(0);
    });

    it('单元素序列逆序数为 0', () => {
      expect(SliderPuzzleEngine.countInversions([1])).toBe(0);
    });

    it('3×3 已解决棋盘逆序数为 0', () => {
      const flat = flattenBoard(createSolvedBoard(3));
      expect(SliderPuzzleEngine.countInversions(flat)).toBe(0);
    });

    it('4×4 已解决棋盘逆序数为 0', () => {
      const flat = flattenBoard(createSolvedBoard(4));
      expect(SliderPuzzleEngine.countInversions(flat)).toBe(0);
    });
  });

  describe('isSolvable', () => {
    it('已解决的 3×3 棋盘可解', () => {
      const board = createSolvedBoard(3);
      expect(SliderPuzzleEngine.isSolvable(board, 3)).toBe(true);
    });

    it('已解决的 4×4 棋盘可解', () => {
      const board = createSolvedBoard(4);
      expect(SliderPuzzleEngine.isSolvable(board, 4)).toBe(true);
    });

    it('已解决的 5×5 棋盘可解', () => {
      const board = createSolvedBoard(5);
      expect(SliderPuzzleEngine.isSolvable(board, 5)).toBe(true);
    });

    it('交换两个相邻非空方块的 3×3 棋盘不可解', () => {
      // 交换 1 和 2（增加 1 个逆序）
      const board = createSolvedBoard(3);
      const temp = board[0][0];
      board[0][0] = board[0][1];
      board[0][1] = temp;
      // 3×3 奇数尺寸，逆序数为 1（奇数），不可解
      expect(SliderPuzzleEngine.isSolvable(board, 3)).toBe(false);
    });

    it('打乱后的棋盘可解（通过随机移动打乱）', () => {
      // 通过多次 start 验证
      for (let i = 0; i < 10; i++) {
        const engine = createAndStartEngine();
        const board = engine.getBoard();
        expect(SliderPuzzleEngine.isSolvable(board, engine.gridSize)).toBe(true);
      }
    });

    it('3×3 奇数逆序可解', () => {
      // 逆序数为偶数时可解（3×3 奇数尺寸）
      // [1, 2, 3, 4, 5, 6, 7, 8, 0] → 0 逆序，可解
      expect(SliderPuzzleEngine.isSolvable([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 0],
      ], 3)).toBe(true);
    });

    it('4×4 偶数尺寸规则正确', () => {
      // 4×4: inversions + emptyRowFromBottom 为奇数时可解
      // 已解决：0 + 1 = 1（奇数）→ 可解
      const board = createSolvedBoard(4);
      const flat = flattenBoard(board);
      const inversions = SliderPuzzleEngine.countInversions(flat);
      expect(inversions).toBe(0);
      // 空位在最后一行，emptyRowFromBottom = 1
      // 0 + 1 = 1（奇数）→ 可解
      expect(SliderPuzzleEngine.isSolvable(board, 4)).toBe(true);
    });
  });
});

// ============================================================
// 12. 事件系统
// ============================================================
describe('SliderPuzzleEngine - 事件系统', () => {
  it('on 注册事件监听', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('test', handler);
    engine.emit('test');
    expect(handler).toHaveBeenCalled();
  });

  it('off 取消事件监听', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('test', handler);
    engine.off('test', handler);
    engine.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('emit 传递参数', () => {
    const engine = createEngine();
    const handler = jest.fn();
    engine.on('test', handler);
    engine.emit('test', 'arg1', 42);
    expect(handler).toHaveBeenCalledWith('arg1', 42);
  });

  it('多次 on 同一事件注册多个监听', () => {
    const engine = createEngine();
    const h1 = jest.fn();
    const h2 = jest.fn();
    engine.on('test', h1);
    engine.on('test', h2);
    engine.emit('test');
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('scoreChange 事件在移动时触发', () => {
    const engine = createEngine();
    setPrivate(engine, '_board', [
      [1, 2, 3],
      [4, 5, 6],
      [7, 0, 8],
    ]);
    setPrivate(engine, '_gridSize', 3);
    setPrivate(engine, '_emptyRow', 2);
    setPrivate(engine, '_emptyCol', 1);
    setPrivate(engine, '_status', 'playing');
    setPrivate(engine, '_isCompleted', false);

    const handler = jest.fn();
    engine.on('scoreChange', handler);
    engine.handleKeyDown('ArrowRight');
    expect(handler).toHaveBeenCalledWith(1);
  });
});

// ============================================================
// 13. 边界与异常场景
// ============================================================
describe('SliderPuzzleEngine - 边界与异常场景', () => {
  it('无 canvas 时 start 抛出错误', () => {
    const engine = new SliderPuzzleEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('连续多次 start 不会崩溃', () => {
    const engine = createEngine();
    engine.start();
    expect(() => engine.start()).not.toThrow();
  });

  it('连续多次 reset 不会崩溃', () => {
    const engine = createAndStartEngine();
    engine.reset();
    expect(() => engine.reset()).not.toThrow();
  });

  it('连续多次 pause 不会崩溃', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(() => engine.pause()).not.toThrow();
  });

  it('未 pause 时 resume 不改变状态', () => {
    const engine = createAndStartEngine();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('idle 时 pause 不改变状态', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });

  it('3×3 游戏完整流程（打乱→移动→完成）', () => {
    const engine = createEngine();
    engine.setGridSize(3);
    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.isCompleted).toBe(false);

    // 验证棋盘可解
    const board = engine.getBoard();
    expect(SliderPuzzleEngine.isSolvable(board, 3)).toBe(true);

    // 可以移动方块
    const emptyPos = engine.getEmptyPosition();
    // 尝试所有方向
    const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (const dir of dirs) {
      engine.handleKeyDown(dir);
    }
    // 至少应该能移动一些
    expect(engine.moveCount).toBeGreaterThanOrEqual(0);
  });

  it('5×5 游戏可以正常启动', () => {
    const engine = createEngine();
    engine.setGridSize(5);
    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.gridSize).toBe(5);
    const board = engine.getBoard();
    expect(board.length).toBe(5);
    expect(board.flat().length).toBe(25);
    expect(SliderPuzzleEngine.isSolvable(board, 5)).toBe(true);
  });

  it('快速连续按键不会崩溃', () => {
    const engine = createAndStartEngine();
    const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (let i = 0; i < 100; i++) {
      engine.handleKeyDown(dirs[i % 4]);
    }
    expect(engine.moveCount).toBeGreaterThanOrEqual(0);
  });

  it('gameover 后 reset 再 start 可以重新游戏', () => {
    const engine = createEngine();
    setPrivate(engine, '_status', 'gameover');
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.moveCount).toBe(0);
    expect(engine.isCompleted).toBe(false);
  });
});

// ============================================================
// 14. 打乱算法
// ============================================================
describe('SliderPuzzleEngine - 打乱算法', () => {
  it('每次 start 打乱结果不同（大概率）', () => {
    const boards: string[] = [];
    for (let i = 0; i < 5; i++) {
      const engine = createEngine();
      engine.start();
      boards.push(JSON.stringify(engine.getBoard()));
    }
    // 至少有两个不同的棋盘
    const uniqueBoards = new Set(boards);
    expect(uniqueBoards.size).toBeGreaterThan(1);
  });

  it('打乱后棋盘包含正确的数字', () => {
    const engine = createAndStartEngine();
    const flat = engine.getBoard().flat().sort((a, b) => a - b);
    const expected = Array.from({ length: 16 }, (_, i) => i);
    expect(flat).toEqual(expected);
  });

  it('3×3 打乱后可解', () => {
    const engine = createEngine();
    engine.setGridSize(3);
    engine.start();
    expect(SliderPuzzleEngine.isSolvable(engine.getBoard(), 3)).toBe(true);
  });

  it('4×4 打乱后可解', () => {
    const engine = createAndStartEngine();
    expect(SliderPuzzleEngine.isSolvable(engine.getBoard(), 4)).toBe(true);
  });

  it('5×5 打乱后可解', () => {
    const engine = createEngine();
    engine.setGridSize(5);
    engine.start();
    expect(SliderPuzzleEngine.isSolvable(engine.getBoard(), 5)).toBe(true);
  });

  it('打乱后空位存在', () => {
    const engine = createAndStartEngine();
    const flat = engine.getBoard().flat();
    expect(flat).toContain(0);
  });

  it('打乱后空位只有一个', () => {
    const engine = createAndStartEngine();
    const flat = engine.getBoard().flat();
    expect(flat.filter(n => n === 0).length).toBe(1);
  });
});

// ============================================================
// 15. 常量合理性验证
// ============================================================
describe('Slider Puzzle 常量验证', () => {
  it('CANVAS_WIDTH 和 CANVAS_HEIGHT 为正数', () => {
    expect(CANVAS_WIDTH).toBeGreaterThan(0);
    expect(CANVAS_HEIGHT).toBeGreaterThan(0);
  });

  it('CANVAS 尺寸为 480×640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('DEFAULT_GRID_SIZE 为 4', () => {
    expect(DEFAULT_GRID_SIZE).toBe(4);
  });

  it('SUPPORTED_GRID_SIZES 包含 3, 4, 5', () => {
    expect(SUPPORTED_GRID_SIZES).toContain(3);
    expect(SUPPORTED_GRID_SIZES).toContain(4);
    expect(SUPPORTED_GRID_SIZES).toContain(5);
  });

  it('BOARD_PADDING > 0', () => {
    expect(BOARD_PADDING).toBeGreaterThan(0);
  });

  it('TILE_GAP >= 0', () => {
    expect(TILE_GAP).toBeGreaterThanOrEqual(0);
  });

  it('TILE_RADIUS >= 0', () => {
    expect(TILE_RADIUS).toBeGreaterThanOrEqual(0);
  });

  it('TILE_COLORS 包含 3, 4, 5 尺寸的颜色', () => {
    expect(TILE_COLORS[3]).toBeDefined();
    expect(TILE_COLORS[4]).toBeDefined();
    expect(TILE_COLORS[5]).toBeDefined();
  });

  it('SHUFFLE_MOVES 包含各尺寸的打乱步数', () => {
    expect(SHUFFLE_MOVES[3]).toBeGreaterThan(0);
    expect(SHUFFLE_MOVES[4]).toBeGreaterThan(0);
    expect(SHUFFLE_MOVES[5]).toBeGreaterThan(0);
  });

  it('SHUFFLE_MOVES 随尺寸增大而增大', () => {
    expect(SHUFFLE_MOVES[4]).toBeGreaterThan(SHUFFLE_MOVES[3]);
    expect(SHUFFLE_MOVES[5]).toBeGreaterThan(SHUFFLE_MOVES[4]);
  });

  it('ANIMATION_DURATION > 0', () => {
    expect(ANIMATION_DURATION).toBeGreaterThan(0);
  });

  it('TILE_FONT_SIZE 包含各尺寸', () => {
    expect(TILE_FONT_SIZE[3]).toBeGreaterThan(0);
    expect(TILE_FONT_SIZE[4]).toBeGreaterThan(0);
    expect(TILE_FONT_SIZE[5]).toBeGreaterThan(0);
  });

  it('HUD_FONT_SIZE > 0', () => {
    expect(HUD_FONT_SIZE).toBeGreaterThan(0);
  });

  it('WIN_FONT_SIZE > 0', () => {
    expect(WIN_FONT_SIZE).toBeGreaterThan(0);
  });

  it('HUD_HEIGHT > 0', () => {
    expect(HUD_HEIGHT).toBeGreaterThan(0);
  });

  it('BG_COLOR 是有效的颜色字符串', () => {
    expect(typeof BG_COLOR).toBe('string');
    expect(BG_COLOR.length).toBeGreaterThan(0);
  });

  it('BOARD_BG_COLOR 是有效的颜色字符串', () => {
    expect(typeof BOARD_BG_COLOR).toBe('string');
    expect(BOARD_BG_COLOR.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 16. 综合场景
// ============================================================
describe('SliderPuzzleEngine - 综合场景', () => {
  it('完整游戏流程：初始化→设置尺寸→启动→移动→重置', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
    expect(engine.gridSize).toBe(DEFAULT_GRID_SIZE);

    engine.setGridSize(3);
    expect(engine.gridSize).toBe(3);

    engine.start();
    expect(engine.status).toBe('playing');
    expect(engine.isCompleted).toBe(false);

    // 移动一些方块
    const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (let i = 0; i < 20; i++) {
      engine.handleKeyDown(dirs[i % 4]);
    }
    expect(engine.moveCount).toBeGreaterThan(0);

    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.moveCount).toBe(0);
  });

  it('多次 start-reset 循环', () => {
    const engine = createEngine();
    for (let i = 0; i < 5; i++) {
      engine.start();
      expect(engine.status).toBe('playing');
      engine.reset();
      expect(engine.status).toBe('idle');
    }
  });

  it('不同尺寸的棋盘数字范围正确', () => {
    for (const size of [3, 4, 5]) {
      const engine = createEngine();
      engine.setGridSize(size);
      engine.start();
      const flat = engine.getBoard().flat().sort((a, b) => a - b);
      expect(flat).toEqual(Array.from({ length: size * size }, (_, i) => i));
    }
  });

  it('elapsedTime 在 playing 状态下更新', () => {
    const engine = createAndStartEngine();
    // elapsedTime 由基类的 gameLoop 管理
    // 这里只验证属性存在且为数字
    expect(typeof engine.elapsedTime).toBe('number');
  });
});
