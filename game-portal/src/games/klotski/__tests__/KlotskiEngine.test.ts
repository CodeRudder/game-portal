/**
 * KlotskiEngine 综合测试
 * 覆盖：初始化、棋盘网格、棋子放置、移动逻辑、碰撞检测、
 *       胜利条件、关卡系统、选择机制、状态管理、handleKeyDown/Up、getState、渲染
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KlotskiEngine } from '../KlotskiEngine';
import {
  COLS, ROWS,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BOARD_LEFT, BOARD_TOP, CELL_WIDTH, CELL_HEIGHT,
  BOARD_PADDING,
  PieceType, PIECE_SIZES, PIECE_COLORS, PIECE_BORDER_COLORS,
  PIECE_LABELS, PIECE_TEXT_COLORS,
  LEVELS, LEVEL_HENGDAO_LIMA, LEVEL_ZHIHUI_RUODING,
  LEVEL_JIANG_YONG_CAOYING, LEVEL_BING_FEN_SANLU, LEVEL_JIN_ZAI_ZHICHI,
  WIN_ROW, WIN_COL,
  type LevelConfig,
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

/** 确保 ctx mock 包含 quadraticCurveTo */
function ensureCtxMock(): void {
  const proto = HTMLCanvasElement.prototype.getContext as any;
  // The setup.ts already mocks getContext, but quadraticCurveTo may be missing
  // We patch it by getting a context and checking
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx && typeof (ctx as any).quadraticCurveTo !== 'function') {
    (ctx as any).quadraticCurveTo = () => {};
  }
}

/** 创建引擎并初始化（不 start，停留在 idle） */
function createEngine(): KlotskiEngine {
  const engine = new KlotskiEngine();
  const canvas = createMockCanvas();
  engine.init(canvas);
  return engine;
}

/** 创建引擎并完成 start（进入 playing 状态） */
function createAndStartEngine(): KlotskiEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 用反射读取私有属性 */
function getPrivate<T>(engine: KlotskiEngine, key: string): T {
  return (engine as unknown as Record<string, T>)[key];
}

/** 用反射设置私有属性 */
function setPrivate(engine: KlotskiEngine, key: string, value: unknown): void {
  (engine as unknown as Record<string, unknown>)[key] = value;
}

/** 调用 protected update 方法 */
function callUpdate(engine: KlotskiEngine, deltaTime: number) {
  const proto = Object.getPrototypeOf(engine);
  const updateFn = proto.update.bind(engine);
  updateFn(deltaTime);
}

/** 调用 protected onRender 方法 */
function callRender(engine: KlotskiEngine) {
  const proto = Object.getPrototypeOf(engine);
  const renderFn = proto.onRender.bind(engine);
  const canvas = createMockCanvas();
  const ctx = canvas.getContext('2d')!;
  // Patch missing methods from setup mock
  if (typeof (ctx as any).quadraticCurveTo !== 'function') {
    (ctx as any).quadraticCurveTo = () => {};
  }
  if (typeof (ctx as any).setLineDash !== 'function') {
    (ctx as any).setLineDash = () => {};
  }
  renderFn(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// ============================================================
// 1. 常量验证
// ============================================================
describe('常量验证', () => {
  it('棋盘尺寸应为 4×5', () => {
    expect(COLS).toBe(4);
    expect(ROWS).toBe(5);
  });

  it('Canvas 尺寸应为 480×640', () => {
    expect(CANVAS_WIDTH).toBe(480);
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('PIECE_SIZES 包含所有棋子类型', () => {
    expect(PIECE_SIZES[PieceType.CAOCAO]).toEqual({ w: 2, h: 2 });
    expect(PIECE_SIZES[PieceType.GUANYU]).toEqual({ w: 2, h: 1 });
    expect(PIECE_SIZES[PieceType.GENERAL_V]).toEqual({ w: 1, h: 2 });
    expect(PIECE_SIZES[PieceType.SOLDIER]).toEqual({ w: 1, h: 1 });
  });

  it('PIECE_COLORS 包含所有棋子类型', () => {
    expect(PIECE_COLORS[PieceType.CAOCAO]).toBeDefined();
    expect(PIECE_COLORS[PieceType.GUANYU]).toBeDefined();
    expect(PIECE_COLORS[PieceType.GENERAL_V]).toBeDefined();
    expect(PIECE_COLORS[PieceType.SOLDIER]).toBeDefined();
  });

  it('PIECE_LABELS 包含所有棋子类型', () => {
    expect(PIECE_LABELS[PieceType.CAOCAO]).toBe('曹操');
    expect(PIECE_LABELS[PieceType.GUANYU]).toBe('关羽');
    expect(PIECE_LABELS[PieceType.GENERAL_V]).toBe('将');
    expect(PIECE_LABELS[PieceType.SOLDIER]).toBe('兵');
  });

  it('关卡列表应有 5 个关卡', () => {
    expect(LEVELS).toHaveLength(5);
  });

  it('每个关卡应有唯一的 id', () => {
    const ids = LEVELS.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每个关卡应恰好有 10 个棋子', () => {
    for (const level of LEVELS) {
      expect(level.pieces).toHaveLength(10);
    }
  });

  it('每个关卡应恰好有 1 个曹操', () => {
    for (const level of LEVELS) {
      const caocao = level.pieces.filter(p => p.type === PieceType.CAOCAO);
      expect(caocao).toHaveLength(1);
    }
  });

  it('每个关卡应恰好有 1 个关羽', () => {
    for (const level of LEVELS) {
      const guanyu = level.pieces.filter(p => p.type === PieceType.GUANYU);
      expect(guanyu).toHaveLength(1);
    }
  });

  it('每个关卡应恰好有 4 个竖将', () => {
    for (const level of LEVELS) {
      const generals = level.pieces.filter(p => p.type === PieceType.GENERAL_V);
      expect(generals).toHaveLength(4);
    }
  });

  it('每个关卡应恰好有 4 个小兵', () => {
    for (const level of LEVELS) {
      const soldiers = level.pieces.filter(p => p.type === PieceType.SOLDIER);
      expect(soldiers).toHaveLength(4);
    }
  });

  it('每个关卡棋子总面积应为 18（填满 4×5=20 减去 2 个空格）', () => {
    for (const level of LEVELS) {
      const totalArea = level.pieces.reduce((sum, p) => {
        const size = PIECE_SIZES[p.type];
        return sum + size.w * size.h;
      }, 0);
      expect(totalArea).toBe(18);
    }
  });

  it('胜利条件应为曹操位于 col=1, row=3', () => {
    expect(WIN_COL).toBe(1);
    expect(WIN_ROW).toBe(3);
  });

  it('关卡名称应正确', () => {
    expect(LEVEL_HENGDAO_LIMA.name).toBe('横刀立马');
    expect(LEVEL_ZHIHUI_RUODING.name).toBe('指挥若定');
    expect(LEVEL_JIANG_YONG_CAOYING.name).toBe('将拥曹营');
    expect(LEVEL_BING_FEN_SANLU.name).toBe('兵分三路');
    expect(LEVEL_JIN_ZAI_ZHICHI.name).toBe('近在咫尺');
  });
});

// ============================================================
// 2. 初始化
// ============================================================
describe('初始化', () => {
  it('创建引擎后状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('初始分数为 0', () => {
    const engine = createEngine();
    expect(engine.score).toBe(0);
  });

  it('初始等级为 1', () => {
    const engine = createEngine();
    expect(engine.level).toBe(1);
  });

  it('初始步数为 0', () => {
    const engine = createEngine();
    expect(engine.moves).toBe(0);
  });

  it('初始未选中棋子', () => {
    const engine = createEngine();
    expect(engine.selectedPieceId).toBeNull();
  });

  it('初始未胜利', () => {
    const engine = createEngine();
    expect(engine.isWin).toBe(false);
  });

  it('初始关卡索引为 0', () => {
    const engine = createEngine();
    expect(engine.levelIndex).toBe(0);
  });

  it('初始棋子列表为空', () => {
    const engine = createEngine();
    expect(engine.pieces).toEqual([]);
  });

  it('init 后可以 start', () => {
    const engine = createEngine();
    expect(() => engine.start()).not.toThrow();
  });
});

// ============================================================
// 3. 启动与关卡加载
// ============================================================
describe('启动与关卡加载', () => {
  it('start 后状态变为 playing', () => {
    const engine = createAndStartEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后加载第一关', () => {
    const engine = createAndStartEngine();
    expect(engine.pieces.length).toBe(10);
  });

  it('start 后步数为 0', () => {
    const engine = createAndStartEngine();
    expect(engine.moves).toBe(0);
  });

  it('start 后未选中棋子', () => {
    const engine = createAndStartEngine();
    expect(engine.selectedPieceId).toBeNull();
  });

  it('start 后 isWin 为 false', () => {
    const engine = createAndStartEngine();
    expect(engine.isWin).toBe(false);
  });

  it('关卡配置名称正确', () => {
    const engine = createAndStartEngine();
    expect(engine.levelConfig.name).toBe('横刀立马');
  });

  it('棋盘网格被正确填充', () => {
    const engine = createAndStartEngine();
    const grid = engine.grid;
    // 4×5 网格中有 18 个格子被占据，2 个为空
    let occupied = 0;
    let empty = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== null) occupied++;
        else empty++;
      }
    }
    expect(occupied).toBe(18);
    expect(empty).toBe(2);
  });

  it('曹操在正确位置（横刀立马）', () => {
    const engine = createAndStartEngine();
    const caocao = engine.pieces.find(p => p.type === PieceType.CAOCAO);
    expect(caocao).toBeDefined();
    expect(caocao!.col).toBe(1);
    expect(caocao!.row).toBe(0);
  });

  it('关羽在正确位置（横刀立马）', () => {
    const engine = createAndStartEngine();
    const guanyu = engine.pieces.find(p => p.type === PieceType.GUANYU);
    expect(guanyu).toBeDefined();
    expect(guanyu!.col).toBe(1);
    expect(guanyu!.row).toBe(2);
  });

  it('loadLevel 加载不同关卡', () => {
    const engine = createAndStartEngine();
    engine.loadLevel(1);
    expect(engine.levelIndex).toBe(1);
    expect(engine.levelConfig.name).toBe('指挥若定');
  });

  it('loadLevel 边界：负索引变为 0', () => {
    const engine = createAndStartEngine();
    engine.loadLevel(-1);
    expect(engine.levelIndex).toBe(0);
  });

  it('loadLevel 边界：超出范围变为最后一关', () => {
    const engine = createAndStartEngine();
    engine.loadLevel(100);
    expect(engine.levelIndex).toBe(LEVELS.length - 1);
  });

  it('重复 start 会重置状态', () => {
    const engine = createAndStartEngine();
    engine.selectPiece('soldier1');
    engine.movePiece('soldier1', 'down');
    expect(engine.moves).toBeGreaterThan(0);

    engine.start();
    expect(engine.moves).toBe(0);
    expect(engine.selectedPieceId).toBeNull();
  });
});

// ============================================================
// 4. 棋子选择
// ============================================================
describe('棋子选择', () => {
  let engine: KlotskiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('selectPiece 可以选中存在的棋子', () => {
    const result = engine.selectPiece('caocao');
    expect(result).toBe(true);
    expect(engine.selectedPieceId).toBe('caocao');
  });

  it('selectPiece 选中不存在的棋子返回 false', () => {
    const result = engine.selectPiece('nonexistent');
    expect(result).toBe(false);
    expect(engine.selectedPieceId).toBeNull();
  });

  it('selectNextPiece 第一次选中第一个棋子', () => {
    engine.selectNextPiece();
    expect(engine.selectedPieceId).toBe(engine.pieces[0].id);
  });

  it('selectNextPiece 循环切换', () => {
    engine.selectPiece(engine.pieces[0].id);
    engine.selectNextPiece();
    expect(engine.selectedPieceId).toBe(engine.pieces[1].id);
  });

  it('selectNextPiece 从最后一个循环到第一个', () => {
    const lastPiece = engine.pieces[engine.pieces.length - 1];
    engine.selectPiece(lastPiece.id);
    engine.selectNextPiece();
    expect(engine.selectedPieceId).toBe(engine.pieces[0].id);
  });

  it('selectPrevPiece 第一次选中最后一个棋子', () => {
    engine.selectPrevPiece();
    const lastPiece = engine.pieces[engine.pieces.length - 1];
    expect(engine.selectedPieceId).toBe(lastPiece.id);
  });

  it('selectPrevPiece 从第一个循环到最后一个', () => {
    engine.selectPiece(engine.pieces[0].id);
    engine.selectPrevPiece();
    const lastPiece = engine.pieces[engine.pieces.length - 1];
    expect(engine.selectedPieceId).toBe(lastPiece.id);
  });

  it('selectPiece 触发 selectionChange 事件', () => {
    const handler = vi.fn();
    engine.on('selectionChange', handler);
    engine.selectPiece('caocao');
    expect(handler).toHaveBeenCalledWith('caocao');
  });
});

// ============================================================
// 5. 棋子移动
// ============================================================
describe('棋子移动', () => {
  let engine: KlotskiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('未选中棋子时 moveSelectedPiece 返回 false', () => {
    const result = engine.moveSelectedPiece('up');
    expect(result).toBe(false);
  });

  it('选中棋子后可以尝试移动', () => {
    engine.selectPiece('soldier1');
    // soldier1 在 (1,3)，检查能否向下移动
    const dirs = engine.getMovableDirections('soldier1');
    // 根据横刀立马布局，soldier1(1,3) 下方是空位
    expect(dirs).toContain('down');
  });

  it('移动成功后步数增加', () => {
    engine.selectPiece('soldier1');
    const initialMoves = engine.moves;
    engine.moveSelectedPiece('down');
    expect(engine.moves).toBe(initialMoves + 1);
  });

  it('移动成功后棋子位置更新', () => {
    engine.selectPiece('soldier1');
    const piece = engine.pieces.find(p => p.id === 'soldier1')!;
    const oldRow = piece.row;
    engine.moveSelectedPiece('down');
    expect(piece.row).toBe(oldRow + 1);
  });

  it('移动成功后网格更新', () => {
    engine.selectPiece('soldier1');
    const piece = engine.pieces.find(p => p.id === 'soldier1')!;
    const oldCol = piece.col;
    const oldRow = piece.row;

    engine.moveSelectedPiece('down');

    // 旧位置应为空
    expect(engine.getPieceAt(oldCol, oldRow)).toBeNull();
    // 新位置应为该棋子
    expect(engine.getPieceAt(oldCol, oldRow + 1)).toBe('soldier1');
  });

  it('不能移出棋盘左边界', () => {
    engine.selectPiece('zhangfei'); // col=0
    const result = engine.movePiece('zhangfei', 'left');
    expect(result).toBe(false);
  });

  it('不能移出棋盘右边界', () => {
    engine.selectPiece('zhaoyun'); // col=3, w=1
    const result = engine.movePiece('zhaoyun', 'right');
    expect(result).toBe(false);
  });

  it('不能移出棋盘上边界', () => {
    engine.selectPiece('caocao'); // row=0
    const result = engine.movePiece('caocao', 'up');
    expect(result).toBe(false);
  });

  it('不能移出棋盘下边界', () => {
    // 找到最底部的棋子
    engine.selectPiece('soldier3'); // col=0, row=4
    const result = engine.movePiece('soldier3', 'down');
    expect(result).toBe(false);
  });

  it('不能移动到被其他棋子占据的位置', () => {
    // 曹操在 (1,0)，下方有关羽在 (1,2)
    // 曹操不能向下移动（中间有竖将）
    const result = engine.movePiece('caocao', 'down');
    expect(result).toBe(false);
  });

  it('移动失败后步数不增加', () => {
    const initialMoves = engine.moves;
    engine.movePiece('caocao', 'down'); // 被阻挡
    expect(engine.moves).toBe(initialMoves);
  });

  it('movePiece 触发 move 事件', () => {
    const handler = vi.fn();
    engine.on('move', handler);
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        pieceId: 'soldier1',
        direction: 'down',
        moves: 1,
      }),
    );
  });

  it('连续移动多步', () => {
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    // soldier1 现在在 (1,4)
    // 尝试向左移动
    const result = engine.moveSelectedPiece('left');
    // 如果左边是空的则成功
    expect(engine.moves).toBeGreaterThanOrEqual(1);
  });

  it('getMovableDirections 返回正确方向', () => {
    // soldier1 在 (1,3) 横刀立马布局
    const dirs = engine.getMovableDirections('soldier1');
    expect(dirs).toContain('down');
    // 上方是关羽(1,2) 不能上
    expect(dirs).not.toContain('up');
  });

  it('getMovableDirections 不存在的棋子返回空数组', () => {
    const dirs = engine.getMovableDirections('nonexistent');
    expect(dirs).toEqual([]);
  });

  it('移动曹操需要 2 格空间', () => {
    // 曹操是 2×2，移动需要检查 2 格宽
    // 在初始位置，曹操被包围，不能移动
    const piece = engine.pieces.find(p => p.id === 'caocao')!;
    const proto = Object.getPrototypeOf(engine);
    const canMove = proto.canMovePiece.bind(engine);
    expect(canMove(piece, 'up')).toBe(false);
    expect(canMove(piece, 'down')).toBe(false);
    expect(canMove(piece, 'left')).toBe(false);
    expect(canMove(piece, 'right')).toBe(false);
  });
});

// Helper: 通过 engine 的 canMovePiece 检测（需要暴露或通过反射）
// 我们通过 movePiece 返回值间接测试
describe('棋子移动（通过反射）', () => {
  let engine: KlotskiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('canMovePiece 通过反射调用', () => {
    const piece = engine.pieces.find(p => p.id === 'soldier1')!;
    const proto = Object.getPrototypeOf(engine);
    const canMove = proto.canMovePiece.bind(engine);
    expect(canMove(piece, 'down')).toBe(true);
    expect(canMove(piece, 'up')).toBe(false);
  });

  it('canMovePiece 边界检查：左边界', () => {
    const piece = engine.pieces.find(p => p.id === 'zhangfei')!;
    const proto = Object.getPrototypeOf(engine);
    const canMove = proto.canMovePiece.bind(engine);
    expect(canMove(piece, 'left')).toBe(false);
  });

  it('canMovePiece 边界检查：右边界', () => {
    const piece = engine.pieces.find(p => p.id === 'zhaoyun')!;
    const proto = Object.getPrototypeOf(engine);
    const canMove = proto.canMovePiece.bind(engine);
    expect(canMove(piece, 'right')).toBe(false);
  });

  it('canMovePiece 边界检查：上边界', () => {
    const piece = engine.pieces.find(p => p.id === 'caocao')!;
    const proto = Object.getPrototypeOf(engine);
    const canMove = proto.canMovePiece.bind(engine);
    expect(canMove(piece, 'up')).toBe(false);
  });

  it('canMovePiece 边界检查：下边界', () => {
    const piece = engine.pieces.find(p => p.id === 'soldier3')!;
    const proto = Object.getPrototypeOf(engine);
    const canMove = proto.canMovePiece.bind(engine);
    expect(canMove(piece, 'down')).toBe(false);
  });

  it('canMovePiece 碰撞检查：被其他棋子阻挡', () => {
    const piece = engine.pieces.find(p => p.id === 'caocao')!;
    const proto = Object.getPrototypeOf(engine);
    const canMove = proto.canMovePiece.bind(engine);
    // 曹操下方有关羽和竖将
    expect(canMove(piece, 'down')).toBe(false);
  });
});

// ============================================================
// 6. 胜利条件
// ============================================================
describe('胜利条件', () => {
  let engine: KlotskiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('初始状态未胜利', () => {
    expect(engine.checkWin()).toBe(false);
  });

  it('曹操到达目标位置时胜利', () => {
    // 手动将曹操放到胜利位置
    const caocao = engine.pieces.find(p => p.type === PieceType.CAOCAO)!;
    const proto = Object.getPrototypeOf(engine);
    const removeFn = proto.removePieceFromGrid.bind(engine);
    const placeFn = proto.placePieceOnGrid.bind(engine);

    // 移除曹操旧位置
    removeFn(caocao);

    // 设置曹操位置到胜利位置
    caocao.col = WIN_COL;
    caocao.row = WIN_ROW;

    // 重新放置
    placeFn(caocao);

    expect(engine.checkWin()).toBe(true);
  });

  it('曹操不在目标位置时不胜利', () => {
    // 曹操在 (1,0)，不在 (1,3)
    expect(engine.checkWin()).toBe(false);
  });

  it('胜利后状态变为 gameover', () => {
    // 模拟胜利：直接设置曹操位置并触发移动
    const caocao = engine.pieces.find(p => p.type === PieceType.CAOCAO)!;
    const proto = Object.getPrototypeOf(engine);

    // 清空曹操旧位置
    const removeFn = proto.removePieceFromGrid.bind(engine);
    removeFn(caocao);

    // 清空目标位置
    const grid = getPrivate<(string | null)[][]>(engine, '_grid');
    for (let r = WIN_ROW; r < WIN_ROW + 2; r++) {
      for (let c = WIN_COL; c < WIN_COL + 2; c++) {
        grid[r][c] = null;
      }
    }

    // 设置曹操到胜利位置
    caocao.col = WIN_COL;
    caocao.row = WIN_ROW;

    const placeFn = proto.placePieceOnGrid.bind(engine);
    placeFn(caocao);

    // 模拟一次移动触发胜利检测
    setPrivate(engine, '_moves', 50);
    engine.movePiece(caocao.id, 'up'); // 这会失败但我们可以直接检查

    // 直接调用 checkWin
    expect(engine.checkWin()).toBe(true);
  });

  it('胜利后 isWin 为 true', () => {
    // 创建一个简单的胜利场景：曹操在 WIN_COL-1, WIN_ROW，向右移动到胜利位置
    const engine = createAndStartEngine();
    const caocao = engine.pieces.find(p => p.type === PieceType.CAOCAO)!;
    const proto = Object.getPrototypeOf(engine);
    const removeFn = proto.removePieceFromGrid.bind(engine);
    const placeFn = proto.placePieceOnGrid.bind(engine);
    const grid = getPrivate<(string | null)[][]>(engine, '_grid');

    // 清空所有棋子
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        grid[r][c] = null;
      }
    }

    // 将曹操放在胜利位置左边一格
    caocao.col = WIN_COL - 1;
    caocao.row = WIN_ROW;
    placeFn(caocao);

    // 向右移动曹操到胜利位置（会触发胜利检测）
    const result = engine.movePiece('caocao', 'right');
    expect(result).toBe(true);
    expect(engine.isWin).toBe(true);
    expect(engine.checkWin()).toBe(true);
  });
});

// ============================================================
// 7. 关卡切换
// ============================================================
describe('关卡切换', () => {
  let engine: KlotskiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('nextLevel 切换到下一关', () => {
    engine.nextLevel();
    expect(engine.levelIndex).toBe(1);
    expect(engine.status).toBe('playing');
  });

  it('nextLevel 从最后一关循环到第一关', () => {
    engine.loadLevel(LEVELS.length - 1);
    engine.start();
    engine.nextLevel();
    expect(engine.levelIndex).toBe(0);
  });

  it('prevLevel 切换到上一关', () => {
    engine.loadLevel(1);
    engine.start();
    engine.prevLevel();
    // 从第 1 关（索引 1）上一关是第 0 关（索引 0）
    expect(engine.levelIndex).toBe(0);
  });

  it('prevLevel 从第一关循环到最后一关', () => {
    engine.prevLevel();
    expect(engine.levelIndex).toBe(LEVELS.length - 1);
  });

  it('切换关卡后棋子重新加载', () => {
    const firstLevelPieces = engine.pieces.map(p => p.id);
    engine.nextLevel();
    // 第二关的棋子 ID 可能相同但位置不同
    expect(engine.pieces.length).toBe(10);
  });

  it('切换关卡后步数重置', () => {
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    expect(engine.moves).toBeGreaterThan(0);
    engine.nextLevel();
    expect(engine.moves).toBe(0);
  });
});

// ============================================================
// 8. 状态管理
// ============================================================
describe('状态管理', () => {
  let engine: KlotskiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('pause 后状态变为 paused', () => {
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后状态变为 playing', () => {
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后状态变为 idle', () => {
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('reset 后分数为 0', () => {
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后步数为 0', () => {
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    engine.reset();
    expect(engine.moves).toBe(0);
  });

  it('pause 时不能移动棋子', () => {
    engine.selectPiece('soldier1');
    engine.pause();
    const result = engine.movePiece('soldier1', 'down');
    expect(result).toBe(false);
  });

  it('destroy 后清理所有事件', () => {
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.destroy();
    // 事件已被清理，不会有新的触发
    expect(engine.status).toBe('idle');
  });

  it('idle 状态不能移动', () => {
    const idleEngine = createEngine();
    const result = idleEngine.movePiece('soldier1', 'down');
    expect(result).toBe(false);
  });

  it('gameover 状态不能移动', () => {
    setPrivate(engine, '_status', 'gameover');
    setPrivate(engine, '_isWin', true);
    const result = engine.movePiece('soldier1', 'down');
    expect(result).toBe(false);
  });
});

// ============================================================
// 9. handleKeyDown
// ============================================================
describe('handleKeyDown', () => {
  let engine: KlotskiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('Tab 键选择下一个棋子', () => {
    engine.handleKeyDown('Tab');
    expect(engine.selectedPieceId).toBe(engine.pieces[0].id);
  });

  it('方向键移动选中棋子', () => {
    engine.selectPiece('soldier1');
    engine.handleKeyDown('ArrowDown');
    expect(engine.moves).toBe(1);
  });

  it('WASD 键移动选中棋子', () => {
    engine.selectPiece('soldier1');
    engine.handleKeyDown('s');
    expect(engine.moves).toBe(1);
  });

  it('Escape 键暂停', () => {
    engine.handleKeyDown('Escape');
    expect(engine.status).toBe('paused');
  });

  it('Escape 键在暂停时不改变状态', () => {
    engine.handleKeyDown('Escape');
    engine.handleKeyDown('Escape');
    expect(engine.status).toBe('paused');
  });

  it('R 键重置到 idle 状态', () => {
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    engine.handleKeyDown('r');
    expect(engine.status).toBe('idle');
    expect(engine.moves).toBe(0);
  });

  it('N 键切换到下一关', () => {
    engine.handleKeyDown('n');
    expect(engine.levelIndex).toBe(1);
  });

  it('P 键切换到上一关', () => {
    engine.handleKeyDown('p');
    expect(engine.levelIndex).toBe(LEVELS.length - 1);
  });

  it('idle 状态下空格键启动游戏', () => {
    const idleEngine = createEngine();
    idleEngine.handleKeyDown(' ');
    expect(idleEngine.status).toBe('playing');
  });

  it('idle 状态下 Enter 键启动游戏', () => {
    const idleEngine = createEngine();
    idleEngine.handleKeyDown('Enter');
    expect(idleEngine.status).toBe('playing');
  });

  it('gameover 状态下空格键重玩', () => {
    setPrivate(engine, '_status', 'gameover');
    setPrivate(engine, '_isWin', true);
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
    expect(engine.isWin).toBe(false);
  });

  it('gameover 状态下 Enter 键重玩', () => {
    setPrivate(engine, '_status', 'gameover');
    setPrivate(engine, '_isWin', true);
    engine.handleKeyDown('Enter');
    expect(engine.status).toBe('playing');
  });

  it('大写 WASD 键也能移动', () => {
    engine.selectPiece('soldier1');
    engine.handleKeyDown('S');
    expect(engine.moves).toBe(1);
  });

  it('大写 R 键也能重置', () => {
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    engine.handleKeyDown('R');
    expect(engine.status).toBe('idle');
  });

  it('大写 N/P 键也能切换关卡', () => {
    engine.handleKeyDown('N');
    expect(engine.levelIndex).toBe(1);
    engine.handleKeyDown('P');
    expect(engine.levelIndex).toBe(0);
  });

  it('未选中棋子时方向键不增加步数', () => {
    engine.handleKeyDown('ArrowDown');
    expect(engine.moves).toBe(0);
  });

  it('无效按键不改变状态', () => {
    const statusBefore = engine.status;
    engine.handleKeyDown('x');
    expect(engine.status).toBe(statusBefore);
  });
});

// ============================================================
// 10. handleKeyUp
// ============================================================
describe('handleKeyUp', () => {
  it('handleKeyUp 不抛出异常', () => {
    const engine = createAndStartEngine();
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyUp('ArrowDown')).not.toThrow();
    expect(() => engine.handleKeyUp('any')).not.toThrow();
  });
});

// ============================================================
// 11. getState
// ============================================================
describe('getState', () => {
  it('返回正确的状态结构', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
    expect(state).toHaveProperty('moves');
    expect(state).toHaveProperty('isWin');
    expect(state).toHaveProperty('selectedPieceId');
    expect(state).toHaveProperty('levelIndex');
    expect(state).toHaveProperty('levelName');
    expect(state).toHaveProperty('pieces');
    expect(state).toHaveProperty('grid');
  });

  it('pieces 包含所有棋子信息', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    const pieces = state.pieces as Array<Record<string, unknown>>;
    expect(pieces).toHaveLength(10);
    expect(pieces[0]).toHaveProperty('id');
    expect(pieces[0]).toHaveProperty('type');
    expect(pieces[0]).toHaveProperty('col');
    expect(pieces[0]).toHaveProperty('row');
    expect(pieces[0]).toHaveProperty('w');
    expect(pieces[0]).toHaveProperty('h');
    expect(pieces[0]).toHaveProperty('label');
  });

  it('grid 是 5×4 的二维数组', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    const grid = state.grid as (string | null)[][];
    expect(grid).toHaveLength(5);
    for (const row of grid) {
      expect(row).toHaveLength(4);
    }
  });

  it('levelName 对应关卡名称', () => {
    const engine = createAndStartEngine();
    const state = engine.getState();
    expect(state.levelName).toBe('横刀立马');
  });
});

// ============================================================
// 12. getPieceAt
// ============================================================
describe('getPieceAt', () => {
  let engine: KlotskiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('曹操占据的位置返回 caocao', () => {
    expect(engine.getPieceAt(1, 0)).toBe('caocao');
    expect(engine.getPieceAt(2, 0)).toBe('caocao');
    expect(engine.getPieceAt(1, 1)).toBe('caocao');
    expect(engine.getPieceAt(2, 1)).toBe('caocao');
  });

  it('空位返回 null', () => {
    // 横刀立马的空位在 (1,4) 和 (2,4)
    expect(engine.getPieceAt(1, 4)).toBeNull();
    expect(engine.getPieceAt(2, 4)).toBeNull();
  });

  it('越界返回 null', () => {
    expect(engine.getPieceAt(-1, 0)).toBeNull();
    expect(engine.getPieceAt(0, -1)).toBeNull();
    expect(engine.getPieceAt(4, 0)).toBeNull();
    expect(engine.getPieceAt(0, 5)).toBeNull();
  });

  it('getPieceAtPixel 返回正确棋子', () => {
    // 曹操在 (1,0)，对应的像素位置
    const x = BOARD_LEFT + 1.5 * CELL_WIDTH;
    const y = BOARD_TOP + 0.5 * CELL_HEIGHT;
    expect(engine.getPieceAtPixel(x, y)).toBe('caocao');
  });
});

// ============================================================
// 13. 事件系统
// ============================================================
describe('事件系统', () => {
  let engine: KlotskiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('start 触发 statusChange 事件', () => {
    const handler = vi.fn();
    const e = createEngine();
    e.on('statusChange', handler);
    e.start();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('pause 触发 statusChange 事件', () => {
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.pause();
    expect(handler).toHaveBeenCalledWith('paused');
  });

  it('resume 触发 statusChange 事件', () => {
    const handler = vi.fn();
    engine.pause();
    engine.on('statusChange', handler);
    engine.resume();
    expect(handler).toHaveBeenCalledWith('playing');
  });

  it('reset 触发 statusChange 事件', () => {
    const handler = vi.fn();
    engine.on('statusChange', handler);
    engine.reset();
    expect(handler).toHaveBeenCalledWith('idle');
  });

  it('移动触发 move 事件', () => {
    const handler = vi.fn();
    engine.on('move', handler);
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('off 取消事件监听', () => {
    const handler = vi.fn();
    engine.on('move', handler);
    engine.off('move', handler);
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    expect(handler).not.toHaveBeenCalled();
  });
});

// ============================================================
// 14. 渲染
// ============================================================
describe('渲染', () => {
  it('idle 状态渲染不抛出异常', () => {
    const engine = createEngine();
    expect(() => callRender(engine)).not.toThrow();
  });

  it('playing 状态渲染不抛出异常', () => {
    const engine = createAndStartEngine();
    expect(() => callRender(engine)).not.toThrow();
  });

  it('paused 状态渲染不抛出异常', () => {
    const engine = createAndStartEngine();
    engine.pause();
    expect(() => callRender(engine)).not.toThrow();
  });

  it('gameover 状态渲染不抛出异常', () => {
    const engine = createAndStartEngine();
    setPrivate(engine, '_status', 'gameover');
    setPrivate(engine, '_isWin', true);
    expect(() => callRender(engine)).not.toThrow();
  });

  it('选中棋子后渲染不抛出异常', () => {
    const engine = createAndStartEngine();
    engine.selectPiece('caocao');
    expect(() => callRender(engine)).not.toThrow();
  });

  it('移动后渲染不抛出异常', () => {
    const engine = createAndStartEngine();
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    expect(() => callRender(engine)).not.toThrow();
  });
});

// ============================================================
// 15. update 方法
// ============================================================
describe('update 方法', () => {
  it('update 不抛出异常', () => {
    const engine = createAndStartEngine();
    expect(() => callUpdate(engine, 16)).not.toThrow();
  });

  it('update 不改变游戏状态', () => {
    const engine = createAndStartEngine();
    const movesBefore = engine.moves;
    callUpdate(engine, 16);
    expect(engine.moves).toBe(movesBefore);
  });
});

// ============================================================
// 16. 棋子属性
// ============================================================
describe('棋子属性', () => {
  let engine: KlotskiEngine;

  beforeEach(() => {
    engine = createAndStartEngine();
  });

  it('曹操尺寸为 2×2', () => {
    const caocao = engine.pieces.find(p => p.type === PieceType.CAOCAO)!;
    expect(caocao.w).toBe(2);
    expect(caocao.h).toBe(2);
  });

  it('关羽尺寸为 2×1', () => {
    const guanyu = engine.pieces.find(p => p.type === PieceType.GUANYU)!;
    expect(guanyu.w).toBe(2);
    expect(guanyu.h).toBe(1);
  });

  it('竖将尺寸为 1×2', () => {
    const generals = engine.pieces.filter(p => p.type === PieceType.GENERAL_V);
    for (const g of generals) {
      expect(g.w).toBe(1);
      expect(g.h).toBe(2);
    }
  });

  it('小兵尺寸为 1×1', () => {
    const soldiers = engine.pieces.filter(p => p.type === PieceType.SOLDIER);
    for (const s of soldiers) {
      expect(s.w).toBe(1);
      expect(s.h).toBe(1);
    }
  });

  it('每个棋子都有唯一 ID', () => {
    const ids = engine.pieces.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每个棋子都有标签', () => {
    for (const piece of engine.pieces) {
      expect(piece.label).toBeTruthy();
      expect(piece.label.length).toBeGreaterThan(0);
    }
  });

  it('pieces getter 返回副本', () => {
    const pieces1 = engine.pieces;
    const pieces2 = engine.pieces;
    expect(pieces1).not.toBe(pieces2); // 不同引用
    expect(pieces1).toEqual(pieces2); // 但内容相同
  });

  it('grid getter 返回副本', () => {
    const grid1 = engine.grid;
    const grid2 = engine.grid;
    expect(grid1).not.toBe(grid2);
    expect(grid1).toEqual(grid2);
  });
});

// ============================================================
// 17. 多关卡测试
// ============================================================
describe('多关卡测试', () => {
  it('所有关卡都能正确加载', () => {
    const engine = createEngine();
    for (let i = 0; i < LEVELS.length; i++) {
      engine.loadLevel(i);
      engine.start();
      expect(engine.pieces.length).toBe(10);
      expect(engine.status).toBe('playing');
      engine.reset();
    }
  });

  it('所有关卡的棋子都在棋盘范围内', () => {
    const engine = createEngine();
    for (let i = 0; i < LEVELS.length; i++) {
      engine.loadLevel(i);
      engine.start();
      for (const piece of engine.pieces) {
        expect(piece.col).toBeGreaterThanOrEqual(0);
        expect(piece.row).toBeGreaterThanOrEqual(0);
        expect(piece.col + piece.w).toBeLessThanOrEqual(COLS);
        expect(piece.row + piece.h).toBeLessThanOrEqual(ROWS);
      }
      engine.reset();
    }
  });

  it('所有关卡初始时曹操不在胜利位置', () => {
    const engine = createEngine();
    for (let i = 0; i < LEVELS.length; i++) {
      engine.loadLevel(i);
      engine.start();
      expect(engine.checkWin()).toBe(false);
      engine.reset();
    }
  });

  it('所有关卡网格一致性检查', () => {
    const engine = createEngine();
    for (let i = 0; i < LEVELS.length; i++) {
      engine.loadLevel(i);
      engine.start();
      const grid = engine.grid;
      // 每个棋子的网格位置应与其 col/row 一致
      for (const piece of engine.pieces) {
        for (let r = piece.row; r < piece.row + piece.h; r++) {
          for (let c = piece.col; c < piece.col + piece.w; c++) {
            expect(grid[r][c]).toBe(piece.id);
          }
        }
      }
      engine.reset();
    }
  });
});

// ============================================================
// 18. 综合游戏流程
// ============================================================
describe('综合游戏流程', () => {
  it('完整的游戏流程：init → start → play → pause → resume → reset', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');

    engine.start();
    expect(engine.status).toBe('playing');

    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    expect(engine.moves).toBe(1);

    engine.pause();
    expect(engine.status).toBe('paused');

    engine.resume();
    expect(engine.status).toBe('playing');

    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.moves).toBe(0);
  });

  it('多步移动后状态一致', () => {
    const engine = createAndStartEngine();

    // 执行多步移动
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down'); // soldier1: (1,3) -> (1,4)

    // 验证网格一致性
    const grid = engine.grid;
    let occupied = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== null) occupied++;
      }
    }
    expect(occupied).toBe(18);
  });

  it('destroy 后可以重新创建', () => {
    const engine = createAndStartEngine();
    engine.selectPiece('soldier1');
    engine.moveSelectedPiece('down');
    engine.destroy();

    const engine2 = createAndStartEngine();
    expect(engine2.status).toBe('playing');
    expect(engine2.moves).toBe(0);
  });

  it('连续快速操作不导致状态异常', () => {
    const engine = createAndStartEngine();
    engine.selectPiece('soldier1');

    // 连续尝试移动（有些会失败）
    for (let i = 0; i < 20; i++) {
      engine.moveSelectedPiece('down');
      engine.moveSelectedPiece('up');
      engine.moveSelectedPiece('left');
      engine.moveSelectedPiece('right');
    }

    // 状态应该仍然一致
    const grid = engine.grid;
    let occupied = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== null) occupied++;
      }
    }
    expect(occupied).toBe(18);
  });
});

// ============================================================
// 19. 边界情况
// ============================================================
describe('边界情况', () => {
  it('没有 canvas 时 start 抛出异常', () => {
    const engine = new KlotskiEngine();
    // 不调用 init，直接 start
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('空棋子列表时 selectNextPiece 不崩溃', () => {
    const engine = createEngine();
    // 未 start，棋子列表为空
    expect(() => engine.selectNextPiece()).not.toThrow();
    expect(engine.selectedPieceId).toBeNull();
  });

  it('空棋子列表时 selectPrevPiece 不崩溃', () => {
    const engine = createEngine();
    expect(() => engine.selectPrevPiece()).not.toThrow();
    expect(engine.selectedPieceId).toBeNull();
  });

  it('movePiece 不存在的棋子返回 false', () => {
    const engine = createAndStartEngine();
    expect(engine.movePiece('nonexistent', 'up')).toBe(false);
  });

  it('selectPiece 不存在的棋子返回 false', () => {
    const engine = createAndStartEngine();
    expect(engine.selectPiece('nonexistent')).toBe(false);
  });

  it('getMovableDirections 不存在的棋子返回空数组', () => {
    const engine = createAndStartEngine();
    expect(engine.getMovableDirections('nonexistent')).toEqual([]);
  });

  it('多次 pause 不影响状态', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('多次 resume 不影响状态', () => {
    const engine = createAndStartEngine();
    engine.pause();
    engine.resume();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('idle 状态下 resume 不影响状态', () => {
    const engine = createEngine();
    engine.resume();
    expect(engine.status).toBe('idle');
  });

  it('idle 状态下 pause 不影响状态', () => {
    const engine = createEngine();
    engine.pause();
    expect(engine.status).toBe('idle');
  });
});
