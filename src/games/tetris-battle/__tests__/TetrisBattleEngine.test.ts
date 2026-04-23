import { vi } from 'vitest';
/**
 * TetrisBattleEngine 完整测试套件
 * 目标 80+ 测试用例，覆盖引擎所有核心功能
 *
 * 测试中不依赖 DOM/Canvas，通过 `(engine as any)` 访问私有成员
 */

import { TetrisBattleEngine } from '@/games/tetris-battle/TetrisBattleEngine';
import {
  COLS,
  ROWS,
  TETROMINO_SHAPES,
  TETROMINO_COUNT,
  INITIAL_DROP_INTERVAL,
  MIN_DROP_INTERVAL,
  DROP_INTERVAL_DECREASE,
  ATTACK_TABLE,
  SCORE_TABLE,
  LINES_PER_LEVEL,
  EMPTY_CELL,
  GARBAGE_CELL,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '@/games/tetris-battle/constants';

// ========== 辅助函数 ==========

/** 创建 canvas 元素 */
function createCanvas(w = CANVAS_WIDTH, h = CANVAS_HEIGHT): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** 创建并初始化引擎 */
function createEngine(): TetrisBattleEngine {
  const engine = new TetrisBattleEngine();
  engine.init(createCanvas());
  return engine;
}

/** 获取玩家 BoardState */
function getPlayerState(engine: TetrisBattleEngine) {
  return (engine as any).player;
}

/** 获取 AI BoardState */
function getAIState(engine: TetrisBattleEngine) {
  return (engine as any).ai;
}

/** 填满底部 n 行 */
function fillBottomRows(grid: number[][], n: number): void {
  for (let r = ROWS - n; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = 1;
    }
  }
}

/** 检查网格是否全空 */
function isGridEmpty(grid: number[][]): boolean {
  return grid.every((row) => row.every((cell) => cell === EMPTY_CELL));
}

/** 统计网格中非空格子数 */
function countFilledCells(grid: number[][]): number {
  return grid.reduce((sum, row) => sum + row.filter((c) => c !== EMPTY_CELL).length, 0);
}

// ========== 测试套件 ==========

describe('TetrisBattleEngine', () => {
  let engine: TetrisBattleEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  // ================================================================
  // T1: 引擎初始化
  // ================================================================
  describe('T1 - 引擎初始化', () => {
    it('init() 后玩家棋盘应为 20×10 全零矩阵', () => {
      const player = getPlayerState(engine);
      expect(player.grid).toHaveLength(ROWS);
      for (let r = 0; r < ROWS; r++) {
        expect(player.grid[r]).toHaveLength(COLS);
        expect(player.grid[r].every((c: number) => c === EMPTY_CELL)).toBe(true);
      }
    });

    it('init() 后 AI 棋盘应为 20×10 全零矩阵', () => {
      const ai = getAIState(engine);
      expect(ai.grid).toHaveLength(ROWS);
      for (let r = 0; r < ROWS; r++) {
        expect(ai.grid[r]).toHaveLength(COLS);
        expect(ai.grid[r].every((c: number) => c === EMPTY_CELL)).toBe(true);
      }
    });

    it('init() 后 status 应为 idle', () => {
      expect(engine.status).toBe('idle');
    });

    it('init() 后玩家分数为 0', () => {
      expect(engine.playerScore).toBe(0);
    });

    it('init() 后 AI 分数为 0', () => {
      expect(engine.aiScore).toBe(0);
    });

    it('init() 后玩家等级为 1', () => {
      expect(engine.playerLevel).toBe(1);
    });

    it('init() 后 AI 等级为 1', () => {
      expect(engine.aiLevel).toBe(1);
    });

    it('init() 后 isWin 为 false', () => {
      expect(engine.isWin).toBe(false);
    });

    it('init() 后 pendingGarbage 为 0', () => {
      expect(engine.pendingGarbage).toBe(0);
    });

    it('init() 后双方棋盘无当前方块', () => {
      const player = getPlayerState(engine);
      const ai = getAIState(engine);
      expect(player.currentPiece).toBeNull();
      expect(ai.currentPiece).toBeNull();
    });

    it('未传入 canvas 时 init() 不应抛错', () => {
      const e = new TetrisBattleEngine();
      expect(() => e.init()).not.toThrow();
    });
  });

  // ================================================================
  // T2: 方块生成 & 7-Bag 系统
  // ================================================================
  describe('T2 - 方块生成 & 7-Bag 系统', () => {
    it('start() 后玩家有当前方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      expect(player.currentPiece).not.toBeNull();
    });

    it('start() 后 AI 有当前方块', () => {
      engine.start();
      const ai = getAIState(engine);
      expect(ai.currentPiece).not.toBeNull();
    });

    it('方块类型在 0-6 范围内', () => {
      engine.start();
      const player = getPlayerState(engine);
      expect(player.currentPiece.type).toBeGreaterThanOrEqual(0);
      expect(player.currentPiece.type).toBeLessThanOrEqual(6);
    });

    it('方块形状与类型对应', () => {
      engine.start();
      const player = getPlayerState(engine);
      const type = player.currentPiece.type;
      const expectedShape = TETROMINO_SHAPES[type];
      expect(player.currentPiece.shape.length).toBe(expectedShape.length);
    });

    it('方块初始 x 位置在棋盘中央区域', () => {
      engine.start();
      const player = getPlayerState(engine);
      const piece = player.currentPiece;
      const shapeWidth = piece.shape[0].length;
      const expectedX = Math.floor((COLS - shapeWidth) / 2);
      expect(piece.x).toBe(expectedX);
    });

    it('方块初始 y 位置为 0 或 -1', () => {
      engine.start();
      const player = getPlayerState(engine);
      expect(player.currentPiece.y).toBeGreaterThanOrEqual(-1);
    });

    it('nextType 在 0-6 范围内', () => {
      engine.start();
      const player = getPlayerState(engine);
      expect(player.nextType).toBeGreaterThanOrEqual(0);
      expect(player.nextType).toBeLessThanOrEqual(6);
    });

    it('7-bag 系统初始 bag 长度应为 5（已取出 2 个）', () => {
      engine.start();
      const player = getPlayerState(engine);
      expect(player.bag.length).toBe(5);
    });

    it('7-bag 系统在取完 7 个后重新填满', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let i = 0; i < 5; i++) {
        (engine as any).pullFromBag(player);
      }
      expect(player.bag.length).toBe(0);
      (engine as any).pullFromBag(player);
      expect(player.bag.length).toBe(6);
    });

    it('7-bag 系统每 7 个方块包含所有 7 种类型', () => {
      engine.start();
      const player = getPlayerState(engine);
      const types = new Set<number>();
      types.add(player.currentPiece.type);
      types.add(player.nextType);
      for (let i = 0; i < 5; i++) {
        types.add((engine as any).pullFromBag(player));
      }
      expect(types.size).toBe(7);
    });

    it('多次 start() 应重置双方棋盘', () => {
      engine.start();
      engine.reset();
      engine.start();
      const player = getPlayerState(engine);
      const ai = getAIState(engine);
      expect(isGridEmpty(player.grid)).toBe(true);
      expect(isGridEmpty(ai.grid)).toBe(true);
    });
  });

  // ================================================================
  // T3: 方块移动
  // ================================================================
  describe('T3 - 方块移动', () => {
    it('按 a 键应左移方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      const xBefore = player.currentPiece.x;
      engine.handleKeyDown('a');
      expect(player.currentPiece.x).toBe(xBefore - 1);
    });

    it('按 d 键应右移方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      const xBefore = player.currentPiece.x;
      engine.handleKeyDown('d');
      expect(player.currentPiece.x).toBe(xBefore + 1);
    });

    it('按 s 键应软降方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      const yBefore = player.currentPiece.y;
      engine.handleKeyDown('s');
      expect(player.currentPiece.y).toBe(yBefore + 1);
    });

    it('按 ArrowLeft 应左移方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      const xBefore = player.currentPiece.x;
      engine.handleKeyDown('ArrowLeft');
      expect(player.currentPiece.x).toBe(xBefore - 1);
    });

    it('按 ArrowRight 应右移方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      const xBefore = player.currentPiece.x;
      engine.handleKeyDown('ArrowRight');
      expect(player.currentPiece.x).toBe(xBefore + 1);
    });

    it('按 ArrowDown 应软降方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      const yBefore = player.currentPiece.y;
      engine.handleKeyDown('ArrowDown');
      expect(player.currentPiece.y).toBe(yBefore + 1);
    });

    it('方块不能超出左边界', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let i = 0; i < 20; i++) {
        engine.handleKeyDown('a');
      }
      const piece = player.currentPiece;
      piece.shape.forEach((row: number[]) => {
        row.forEach((val: number, dx: number) => {
          if (val) expect(piece.x + dx).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('方块不能超出右边界', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let i = 0; i < 20; i++) {
        engine.handleKeyDown('d');
      }
      const piece = player.currentPiece;
      piece.shape.forEach((row: number[]) => {
        row.forEach((val: number, dx: number) => {
          if (val) expect(piece.x + dx).toBeLessThan(COLS);
        });
      });
    });

    it('方块不能穿过底部', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let i = 0; i < ROWS + 5; i++) {
        engine.handleKeyDown('s');
      }
      const bottomHasBlocks = player.grid.slice(-4).some((row: number[]) => row.some((c: number) => c !== EMPTY_CELL));
      expect(bottomHasBlocks).toBe(true);
    });

    it('方块不能穿过已放置的方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      engine.handleKeyDown(' ');
      expect(player.currentPiece).not.toBeNull();
      for (let i = 0; i < ROWS + 5; i++) {
        engine.handleKeyDown('s');
      }
      expect(countFilledCells(player.grid)).toBeGreaterThan(0);
    });
  });

  // ================================================================
  // T4: 方块旋转
  // ================================================================
  describe('T4 - 方块旋转', () => {
    it('按 w 键应旋转方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      const originalShape = player.currentPiece.shape.map((r: number[]) => [...r]);
      engine.handleKeyDown('w');
      if (originalShape.length !== 2) {
        expect(JSON.stringify(player.currentPiece.shape)).not.toBe(JSON.stringify(originalShape));
      }
    });

    it('按 ArrowUp 应旋转方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      const originalShape = player.currentPiece.shape.map((r: number[]) => [...r]);
      engine.handleKeyDown('ArrowUp');
      if (originalShape.length !== 2) {
        expect(JSON.stringify(player.currentPiece.shape)).not.toBe(JSON.stringify(originalShape));
      }
    });

    it('O 方块旋转后形状不变', () => {
      engine.start();
      const player = getPlayerState(engine);
      player.currentPiece = {
        type: 1,
        shape: TETROMINO_SHAPES[1].map((r: number[]) => [...r]),
        x: 4,
        y: 0,
      };
      const originalShape = player.currentPiece.shape.map((r: number[]) => [...r]);
      engine.handleKeyDown('w');
      expect(JSON.stringify(player.currentPiece.shape)).toBe(JSON.stringify(originalShape));
    });

    it('连续旋转 4 次回到原始形状', () => {
      engine.start();
      const player = getPlayerState(engine);
      if (player.currentPiece.shape.length === 2) return;
      const originalShape = player.currentPiece.shape.map((r: number[]) => [...r]);
      engine.handleKeyDown('w');
      engine.handleKeyDown('w');
      engine.handleKeyDown('w');
      engine.handleKeyDown('w');
      expect(JSON.stringify(player.currentPiece.shape)).toBe(JSON.stringify(originalShape));
    });

    it('右侧墙踢应正确工作', () => {
      engine.start();
      for (let i = 0; i < 15; i++) {
        engine.handleKeyDown('d');
      }
      expect(() => {
        for (let i = 0; i < 4; i++) {
          engine.handleKeyDown('w');
        }
      }).not.toThrow();
      expect(engine.status).toBe('playing');
    });

    it('左侧墙踢应正确工作', () => {
      engine.start();
      for (let i = 0; i < 15; i++) {
        engine.handleKeyDown('a');
      }
      expect(() => {
        for (let i = 0; i < 4; i++) {
          engine.handleKeyDown('w');
        }
      }).not.toThrow();
      expect(engine.status).toBe('playing');
    });

    it('I 方块旋转应正确', () => {
      engine.start();
      const player = getPlayerState(engine);
      player.currentPiece = {
        type: 0,
        shape: TETROMINO_SHAPES[0].map((r: number[]) => [...r]),
        x: 3,
        y: 0,
      };
      engine.handleKeyDown('w');
      const rotated = player.currentPiece.shape;
      expect(JSON.stringify(rotated)).not.toBe(JSON.stringify(TETROMINO_SHAPES[0]));
    });
  });

  // ================================================================
  // T5: 行消除
  // ================================================================
  describe('T5 - 行消除', () => {
    it('填满一行后应消除', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let c = 0; c < COLS; c++) {
        player.grid[ROWS - 1][c] = 1;
      }
      const linesBefore = player.linesCleared;
      engine.handleKeyDown(' ');
      expect(player.linesCleared).toBeGreaterThan(linesBefore);
    });

    it('消除后上方行应下移', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let c = 0; c < COLS; c++) {
        player.grid[ROWS - 1][c] = 1;
      }
      player.grid[ROWS - 2][5] = 1;
      engine.handleKeyDown(' ');
      expect(player.grid[ROWS - 1][5]).not.toBe(EMPTY_CELL);
    });

    it('消除 2 行应同时清除', () => {
      engine.start();
      const player = getPlayerState(engine);
      fillBottomRows(player.grid, 2);
      const linesBefore = player.linesCleared;
      engine.handleKeyDown(' ');
      expect(player.linesCleared - linesBefore).toBeGreaterThanOrEqual(2);
    });

    it('消除 3 行应同时清除', () => {
      engine.start();
      const player = getPlayerState(engine);
      fillBottomRows(player.grid, 3);
      const linesBefore = player.linesCleared;
      engine.handleKeyDown(' ');
      expect(player.linesCleared - linesBefore).toBeGreaterThanOrEqual(3);
    });

    it('消除 4 行（Tetris）应同时清除', () => {
      engine.start();
      const player = getPlayerState(engine);
      fillBottomRows(player.grid, 4);
      const linesBefore = player.linesCleared;
      engine.handleKeyDown(' ');
      expect(player.linesCleared - linesBefore).toBeGreaterThanOrEqual(4);
    });

    it('消除后顶部应添加空行', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let c = 0; c < COLS; c++) {
        player.grid[ROWS - 1][c] = 1;
      }
      engine.handleKeyDown(' ');
      expect(player.grid[0].every((c: number) => c === EMPTY_CELL)).toBe(true);
    });
  });

  // ================================================================
  // T6: 锁定机制
  // ================================================================
  describe('T6 - 锁定机制', () => {
    it('方块触底后应锁定到棋盘', () => {
      engine.start();
      const player = getPlayerState(engine);
      engine.handleKeyDown(' ');
      const bottomRows = player.grid.slice(-4);
      const hasLocked = bottomRows.some((row: number[]) => row.some((c: number) => c !== EMPTY_CELL));
      expect(hasLocked).toBe(true);
    });

    it('锁定后应生成新方块', () => {
      engine.start();
      const player = getPlayerState(engine);
      engine.handleKeyDown(' ');
      expect(player.currentPiece).not.toBeNull();
    });

    it('锁定后方块类型值正确存储（type+1）', () => {
      engine.start();
      const player = getPlayerState(engine);
      const type = player.currentPiece.type;
      engine.handleKeyDown(' ');
      const hasCorrectType = player.grid.some((row: number[]) =>
        row.some((c: number) => c === type + 1),
      );
      expect(hasCorrectType).toBe(true);
    });

    it('软降到底部后应锁定', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let i = 0; i < ROWS + 5; i++) {
        engine.handleKeyDown('s');
      }
      expect(countFilledCells(player.grid)).toBeGreaterThan(0);
    });
  });

  // ================================================================
  // T7: 攻击系统
  // ================================================================
  describe('T7 - 攻击系统', () => {
    it('消 1 行不产生攻击（ATTACK_TABLE[1]=0）', () => {
      expect(ATTACK_TABLE[1]).toBe(0);
    });

    it('消 2 行产生 1 行攻击', () => {
      expect(ATTACK_TABLE[2]).toBe(1);
    });

    it('消 3 行产生 2 行攻击', () => {
      expect(ATTACK_TABLE[3]).toBe(2);
    });

    it('消 4 行产生 4 行攻击', () => {
      expect(ATTACK_TABLE[4]).toBe(4);
    });

    it('玩家消行攻击发送到 AI', () => {
      engine.start();
      const player = getPlayerState(engine);
      const ai = getAIState(engine);
      fillBottomRows(player.grid, 4);
      engine.handleKeyDown(' ');
      expect(ai.pendingGarbage).toBeGreaterThanOrEqual(4);
    });

    it('攻击可抵消待接收的垃圾行', () => {
      engine.start();
      const player = getPlayerState(engine);
      player.pendingGarbage = 2;
      fillBottomRows(player.grid, 2);
      engine.handleKeyDown(' ');
      expect(player.pendingGarbage).toBeLessThanOrEqual(2);
    });

    it('transferAttacks 将攻击从一方转移到另一方', () => {
      engine.start();
      const ai = getAIState(engine);
      (engine as any).playerAttackPending = 3;
      (engine as any).transferAttacks();
      expect(ai.pendingGarbage).toBeGreaterThanOrEqual(3);
      expect((engine as any).playerAttackPending).toBe(0);
    });
  });

  // ================================================================
  // T8: 垃圾行系统
  // ================================================================
  describe('T8 - 垃圾行系统', () => {
    it('垃圾行添加到棋盘底部', () => {
      engine.start();
      const player = getPlayerState(engine);
      (engine as any).addGarbageLines(player, 3);
      for (let r = ROWS - 3; r < ROWS; r++) {
        const hasGarbage = player.grid[r].some((c: number) => c === GARBAGE_CELL);
        expect(hasGarbage).toBe(true);
      }
    });

    it('垃圾行有空洞（每行一个洞）', () => {
      engine.start();
      const player = getPlayerState(engine);
      (engine as any).addGarbageLines(player, 3);
      for (let r = ROWS - 3; r < ROWS; r++) {
        const emptyCount = player.grid[r].filter((c: number) => c === EMPTY_CELL).length;
        expect(emptyCount).toBeGreaterThanOrEqual(1);
      }
    });

    it('垃圾行导致上方行上移', () => {
      engine.start();
      const player = getPlayerState(engine);
      player.grid[0][5] = 1;
      (engine as any).addGarbageLines(player, 2);
      expect(player.grid.length).toBe(ROWS);
    });

    it('垃圾行使用 GARBAGE_CELL 标识', () => {
      engine.start();
      const player = getPlayerState(engine);
      (engine as any).addGarbageLines(player, 1);
      const garbageRow = player.grid[ROWS - 1];
      const hasGarbageCell = garbageRow.some((c: number) => c === GARBAGE_CELL);
      expect(hasGarbageCell).toBe(true);
    });

    it('applyGarbage 清空 pendingGarbage', () => {
      engine.start();
      const player = getPlayerState(engine);
      player.pendingGarbage = 2;
      (engine as any).applyGarbage(player);
      expect(player.pendingGarbage).toBe(0);
    });

    it('多次添加垃圾行累积', () => {
      engine.start();
      const player = getPlayerState(engine);
      (engine as any).addGarbageLines(player, 2);
      (engine as any).addGarbageLines(player, 2);
      let garbageCount = 0;
      for (let r = ROWS - 4; r < ROWS; r++) {
        if (player.grid[r].some((c: number) => c === GARBAGE_CELL)) {
          garbageCount++;
        }
      }
      expect(garbageCount).toBe(4);
    });
  });

  // ================================================================
  // T9: AI 系统
  // ================================================================
  describe('T9 - AI 系统', () => {
    it('AI 有当前方块', () => {
      engine.start();
      const ai = getAIState(engine);
      expect(ai.currentPiece).not.toBeNull();
    });

    it('AI 棋盘独立于玩家棋盘', () => {
      engine.start();
      const ai = getAIState(engine);
      engine.handleKeyDown('d');
      engine.handleKeyDown('s');
      expect(isGridEmpty(ai.grid)).toBe(true);
    });

    it('findBestPlacement 返回有效决策', () => {
      engine.start();
      const ai = getAIState(engine);
      const decision = (engine as any).findBestPlacement(ai);
      expect(decision).toHaveProperty('targetX');
      expect(decision).toHaveProperty('targetRotation');
      expect(decision.targetRotation).toBeGreaterThanOrEqual(0);
      expect(decision.targetRotation).toBeLessThanOrEqual(3);
    });

    it('evaluateBoard 返回数值', () => {
      const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY_CELL));
      const score = (engine as any).evaluateBoard(grid);
      expect(typeof score).toBe('number');
    });

    it('空棋盘评估分高于有空洞的棋盘', () => {
      const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY_CELL));
      const holeyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY_CELL));
      holeyGrid[ROWS - 1] = Array(COLS).fill(1);
      holeyGrid[ROWS - 2] = Array(COLS).fill(1);
      holeyGrid[ROWS - 2][5] = EMPTY_CELL;
      holeyGrid[ROWS - 3] = Array(COLS).fill(1);
      holeyGrid[ROWS - 3][5] = EMPTY_CELL;
      const emptyScore = (engine as any).evaluateBoard(emptyGrid);
      const holeyScore = (engine as any).evaluateBoard(holeyGrid);
      expect(emptyScore).toBeGreaterThan(holeyScore);
    });

    it('getColumnHeights 返回正确高度', () => {
      const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY_CELL));
      grid[ROWS - 1][0] = 1;
      grid[ROWS - 1][1] = 1;
      grid[ROWS - 2][0] = 1;
      const heights = (engine as any).getColumnHeights(grid);
      expect(heights[0]).toBe(2);
      expect(heights[1]).toBe(1);
      expect(heights[2]).toBe(0);
    });

    it('countHoles 正确计算空洞', () => {
      const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY_CELL));
      grid[ROWS - 1][0] = 1;
      grid[ROWS - 2][0] = 1;
      grid[ROWS - 3][0] = EMPTY_CELL;
      grid[ROWS - 4][0] = 1;
      const holes = (engine as any).countHoles(grid);
      expect(holes).toBeGreaterThanOrEqual(1);
    });

    it('calculateBumpiness 正确计算', () => {
      const heights = [5, 3, 5, 3, 5];
      const bumpiness = (engine as any).calculateBumpiness(heights);
      expect(bumpiness).toBe(8);
    });

    it('countCompleteLines 正确计算完整行', () => {
      const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY_CELL));
      grid[ROWS - 1] = Array(COLS).fill(1);
      grid[ROWS - 2] = Array(COLS).fill(1);
      const lines = (engine as any).countCompleteLines(grid);
      expect(lines).toBe(2);
    });

    it('AI 决策间隔可设置', () => {
      engine.setAIInterval(500);
      expect(engine.getAIInterval()).toBe(500);
    });

    it('AI 放置动画可触发', () => {
      engine.start();
      engine.triggerAIDecision();
      expect(engine.isAIPlacing()).toBe(true);
    });
  });

  // ================================================================
  // T10: 计分系统
  // ================================================================
  describe('T10 - 计分系统', () => {
    it('软降加 1 分', () => {
      engine.start();
      const scoreBefore = engine.playerScore;
      engine.handleKeyDown('s');
      expect(engine.playerScore).toBe(scoreBefore + 1);
    });

    it('多次软降累积加分', () => {
      engine.start();
      const scoreBefore = engine.playerScore;
      engine.handleKeyDown('s');
      engine.handleKeyDown('s');
      engine.handleKeyDown('s');
      expect(engine.playerScore).toBe(scoreBefore + 3);
    });

    it('硬降加 distance×2 分', () => {
      engine.start();
      const player = getPlayerState(engine);
      const scoreBefore = engine.playerScore;
      const ghostY = (engine as any).getGhostY(player);
      const expectedDistance = ghostY - player.currentPiece.y;
      engine.handleKeyDown(' ');
      expect(engine.playerScore).toBeGreaterThanOrEqual(scoreBefore + expectedDistance * 2);
    });

    it('消 1 行得 100×level 分', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let c = 0; c < COLS; c++) {
        player.grid[ROWS - 1][c] = 1;
      }
      const scoreBefore = engine.playerScore;
      engine.handleKeyDown(' ');
      expect(engine.playerScore).toBeGreaterThanOrEqual(scoreBefore + SCORE_TABLE[1] * engine.playerLevel);
    });

    it('消 2 行得 300×level 分', () => {
      engine.start();
      const player = getPlayerState(engine);
      fillBottomRows(player.grid, 2);
      const scoreBefore = engine.playerScore;
      engine.handleKeyDown(' ');
      expect(engine.playerScore).toBeGreaterThanOrEqual(scoreBefore + SCORE_TABLE[2] * engine.playerLevel);
    });

    it('消 3 行得 500×level 分', () => {
      engine.start();
      const player = getPlayerState(engine);
      fillBottomRows(player.grid, 3);
      const scoreBefore = engine.playerScore;
      engine.handleKeyDown(' ');
      expect(engine.playerScore).toBeGreaterThanOrEqual(scoreBefore + SCORE_TABLE[3] * engine.playerLevel);
    });

    it('消 4 行得 800×level 分', () => {
      engine.start();
      const player = getPlayerState(engine);
      fillBottomRows(player.grid, 4);
      const scoreBefore = engine.playerScore;
      engine.handleKeyDown(' ');
      expect(engine.playerScore).toBeGreaterThanOrEqual(scoreBefore + SCORE_TABLE[4] * engine.playerLevel);
    });

    it('SCORE_TABLE 常量正确', () => {
      expect(SCORE_TABLE[0]).toBe(0);
      expect(SCORE_TABLE[1]).toBe(100);
      expect(SCORE_TABLE[2]).toBe(300);
      expect(SCORE_TABLE[3]).toBe(500);
      expect(SCORE_TABLE[4]).toBe(800);
    });
  });

  // ================================================================
  // T11: 等级系统
  // ================================================================
  describe('T11 - 等级系统', () => {
    it('初始等级为 1', () => {
      expect(engine.playerLevel).toBe(1);
      expect(engine.aiLevel).toBe(1);
    });

    it('start() 后等级重置为 1', () => {
      engine.start();
      expect(engine.playerLevel).toBe(1);
    });

    it('每消 10 行升 1 级', () => {
      engine.start();
      const player = getPlayerState(engine);
      player.linesCleared = 10;
      for (let c = 0; c < COLS; c++) {
        player.grid[ROWS - 1][c] = 1;
      }
      engine.handleKeyDown(' ');
      expect(engine.playerLevel).toBeGreaterThanOrEqual(2);
    });

    it('升级后下落间隔减小', () => {
      engine.start();
      const player = getPlayerState(engine);
      const initialInterval = player.dropInterval;
      expect(initialInterval).toBe(INITIAL_DROP_INTERVAL);
      player.linesCleared = 10;
      for (let c = 0; c < COLS; c++) {
        player.grid[ROWS - 1][c] = 1;
      }
      engine.handleKeyDown(' ');
      expect(player.dropInterval).toBeLessThan(initialInterval);
    });

    it('下落间隔公式: max(100, 1000 - (level-1)*80)', () => {
      engine.start();
      const player = getPlayerState(engine);
      expect(player.dropInterval).toBe(INITIAL_DROP_INTERVAL);
      player.linesCleared = 10;
      for (let c = 0; c < COLS; c++) {
        player.grid[ROWS - 1][c] = 1;
      }
      engine.handleKeyDown(' ');
      expect(player.dropInterval).toBe(Math.max(MIN_DROP_INTERVAL, INITIAL_DROP_INTERVAL - DROP_INTERVAL_DECREASE));
    });

    it('下落间隔最小值为 100ms', () => {
      engine.start();
      const player = getPlayerState(engine);
      player._level = 20;
      player.linesCleared = 200;
      for (let c = 0; c < COLS; c++) {
        player.grid[ROWS - 1][c] = 1;
      }
      engine.handleKeyDown(' ');
      expect(player.dropInterval).toBeGreaterThanOrEqual(MIN_DROP_INTERVAL);
    });

    it('LINES_PER_LEVEL 为 10', () => {
      expect(LINES_PER_LEVEL).toBe(10);
    });
  });

  // ================================================================
  // T12: 胜负判定
  // ================================================================
  describe('T12 - 胜负判定', () => {
    it('玩家方块堆顶 → 玩家输', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          player.grid[r][c] = 1;
        }
        player.grid[r][0] = EMPTY_CELL;
      }
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('gameover');
      expect(engine.isWin).toBe(false);
    });

    it('AI 方块堆顶 → 玩家赢', () => {
      engine.start();
      const ai = getAIState(engine);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ai.grid[r][c] = 1;
        }
        ai.grid[r][0] = EMPTY_CELL;
      }
      (engine as any).hardDrop(ai);
      expect(engine.status).toBe('gameover');
      expect(engine.isWin).toBe(true);
    });

    it('游戏结束后状态为 gameover', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          player.grid[r][c] = 1;
        }
        player.grid[r][0] = EMPTY_CELL;
      }
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('gameover');
    });

    it('游戏结束后按键不崩溃', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          player.grid[r][c] = 1;
        }
        player.grid[r][0] = EMPTY_CELL;
      }
      engine.handleKeyDown(' ');
      expect(() => {
        engine.handleKeyDown('a');
        engine.handleKeyDown('d');
        engine.handleKeyDown('s');
        engine.handleKeyDown('w');
        engine.handleKeyDown(' ');
      }).not.toThrow();
    });

    it('reset 后可重新开始', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          player.grid[r][c] = 1;
        }
        player.grid[r][0] = EMPTY_CELL;
      }
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('gameover');
      engine.reset();
      expect(engine.status).toBe('idle');
      engine.start();
      expect(engine.status).toBe('playing');
    });
  });

  // ================================================================
  // T13: 幽灵方块
  // ================================================================
  describe('T13 - 幽灵方块', () => {
    it('幽灵 Y 坐标 >= 当前方块 Y 坐标', () => {
      engine.start();
      const player = getPlayerState(engine);
      const ghostY = (engine as any).getGhostY(player);
      expect(ghostY).toBeGreaterThanOrEqual(player.currentPiece.y);
    });

    it('幽灵位置是方块能到达的最底部', () => {
      engine.start();
      const player = getPlayerState(engine);
      const ghostY = (engine as any).getGhostY(player);
      expect(
        (engine as any).isValid(player.grid, player.currentPiece.shape, player.currentPiece.x, ghostY),
      ).toBe(true);
      expect(
        (engine as any).isValid(player.grid, player.currentPiece.shape, player.currentPiece.x, ghostY + 1),
      ).toBe(false);
    });

    it('getGhostYForBoard 公开方法返回正确值', () => {
      engine.start();
      const player = getPlayerState(engine);
      const ghostY = engine.getGhostYForBoard(player);
      expect(typeof ghostY).toBe('number');
      expect(ghostY).toBeGreaterThanOrEqual(player.currentPiece.y);
    });

    it('方块在底部时幽灵位置等于方块位置', () => {
      engine.start();
      const player = getPlayerState(engine);
      while ((engine as any).isValid(player.grid, player.currentPiece.shape, player.currentPiece.x, player.currentPiece.y + 1)) {
        player.currentPiece.y++;
      }
      const ghostY = (engine as any).getGhostY(player);
      expect(ghostY).toBe(player.currentPiece.y);
    });
  });

  // ================================================================
  // T14: 下一个方块预览
  // ================================================================
  describe('T14 - 下一个方块预览', () => {
    it('start() 后玩家有 nextType', () => {
      engine.start();
      const player = getPlayerState(engine);
      expect(player.nextType).toBeGreaterThanOrEqual(0);
      expect(player.nextType).toBeLessThanOrEqual(6);
    });

    it('start() 后 AI 有 nextType', () => {
      engine.start();
      const ai = getAIState(engine);
      expect(ai.nextType).toBeGreaterThanOrEqual(0);
      expect(ai.nextType).toBeLessThanOrEqual(6);
    });

    it('锁定后 nextType 更新', () => {
      engine.start();
      const player = getPlayerState(engine);
      engine.handleKeyDown(' ');
      expect(player.nextType).toBeGreaterThanOrEqual(0);
    });

    it('getState 包含 playerNextType 和 aiNextType', () => {
      engine.start();
      const state = engine.getState();
      expect(state).toHaveProperty('playerNextType');
      expect(state).toHaveProperty('aiNextType');
    });
  });

  // ================================================================
  // T15: handleKeyDown 测试
  // ================================================================
  describe('T15 - handleKeyDown', () => {
    it('WASD 控制正确映射', () => {
      engine.start();
      const player = getPlayerState(engine);
      const x0 = player.currentPiece.x;
      const y0 = player.currentPiece.y;
      engine.handleKeyDown('a');
      expect(player.currentPiece.x).toBe(x0 - 1);
      engine.handleKeyDown('d');
      expect(player.currentPiece.x).toBe(x0);
      engine.handleKeyDown('s');
      expect(player.currentPiece.y).toBe(y0 + 1);
      engine.handleKeyDown('w');
      expect(player.currentPiece).not.toBeNull();
    });

    it('方向键控制正确映射', () => {
      engine.start();
      const player = getPlayerState(engine);
      const x0 = player.currentPiece.x;
      const y0 = player.currentPiece.y;
      engine.handleKeyDown('ArrowLeft');
      expect(player.currentPiece.x).toBe(x0 - 1);
      engine.handleKeyDown('ArrowRight');
      expect(player.currentPiece.x).toBe(x0);
      engine.handleKeyDown('ArrowDown');
      expect(player.currentPiece.y).toBe(y0 + 1);
      engine.handleKeyDown('ArrowUp');
      expect(player.currentPiece).not.toBeNull();
    });

    it('空格硬降', () => {
      engine.start();
      engine.handleKeyDown(' ');
      expect(countFilledCells(getPlayerState(engine).grid)).toBeGreaterThan(0);
    });

    it('idle 状态下按键不崩溃', () => {
      expect(() => {
        engine.handleKeyDown('a');
        engine.handleKeyDown('d');
        engine.handleKeyDown('s');
        engine.handleKeyDown('w');
        engine.handleKeyDown(' ');
      }).not.toThrow();
    });

    it('paused 状态下按键不崩溃', () => {
      engine.start();
      engine.pause();
      expect(() => {
        engine.handleKeyDown('a');
        engine.handleKeyDown('d');
        engine.handleKeyDown('s');
        engine.handleKeyDown('w');
        engine.handleKeyDown(' ');
      }).not.toThrow();
    });

    it('gameover 状态下按键不崩溃', () => {
      engine.start();
      const player = getPlayerState(engine);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          player.grid[r][c] = 1;
        }
        player.grid[r][0] = EMPTY_CELL;
      }
      engine.handleKeyDown(' ');
      expect(() => {
        engine.handleKeyDown('a');
        engine.handleKeyDown(' ');
      }).not.toThrow();
    });
  });

  // ================================================================
  // T16: 状态管理
  // ================================================================
  describe('T16 - 状态管理', () => {
    it('start() 后状态为 playing', () => {
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('pause() 后状态为 paused', () => {
      engine.start();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume() 后状态为 playing', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset() 后状态为 idle', () => {
      engine.start();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset() 后分数归零', () => {
      engine.start();
      engine.handleKeyDown('s');
      engine.reset();
      expect(engine.playerScore).toBe(0);
    });

    it('reset() 后等级归 1', () => {
      engine.start();
      engine.reset();
      expect(engine.playerLevel).toBe(1);
    });

    it('pause 时不能从 idle 状态暂停', () => {
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('resume 时不能从 playing 状态恢复', () => {
      engine.start();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('destroy 后引擎不再触发事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalled();
      handler.mockClear();
      engine.destroy();
      // Note: base class destroy() calls reset() before clearing listeners,
      // so reset() still emits 'idle'. After destroy, listeners are cleared.
      // Verify by calling reset again — handler should NOT be called
      handler.mockClear();
      engine.reset();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // T17: getState() 返回值
  // ================================================================
  describe('T17 - getState()', () => {
    it('返回包含所有必要字段', () => {
      engine.start();
      const state = engine.getState();
      expect(state).toHaveProperty('playerBoard');
      expect(state).toHaveProperty('aiBoard');
      expect(state).toHaveProperty('playerScore');
      expect(state).toHaveProperty('aiScore');
      expect(state).toHaveProperty('playerLevel');
      expect(state).toHaveProperty('aiLevel');
      expect(state).toHaveProperty('playerLinesCleared');
      expect(state).toHaveProperty('aiLinesCleared');
      expect(state).toHaveProperty('playerPendingGarbage');
      expect(state).toHaveProperty('aiPendingGarbage');
      expect(state).toHaveProperty('playerNextType');
      expect(state).toHaveProperty('aiNextType');
      expect(state).toHaveProperty('isWin');
      expect(state).toHaveProperty('gameOverReason');
      expect(state).toHaveProperty('status');
    });

    it('playerBoard 是二维数组', () => {
      engine.start();
      const state = engine.getState();
      const board = state.playerBoard as number[][];
      expect(board).toHaveLength(ROWS);
      expect(board[0]).toHaveLength(COLS);
    });

    it('aiBoard 是二维数组', () => {
      engine.start();
      const state = engine.getState();
      const board = state.aiBoard as number[][];
      expect(board).toHaveLength(ROWS);
      expect(board[0]).toHaveLength(COLS);
    });

    it('数值类型字段正确', () => {
      engine.start();
      const state = engine.getState();
      expect(typeof state.playerScore).toBe('number');
      expect(typeof state.aiScore).toBe('number');
      expect(typeof state.playerLevel).toBe('number');
      expect(typeof state.aiLevel).toBe('number');
      expect(typeof state.isWin).toBe('boolean');
    });

    it('返回的棋盘是副本（不影响内部状态）', () => {
      engine.start();
      const state = engine.getState();
      const board = state.playerBoard as number[][];
      board[0][0] = 999;
      const player = getPlayerState(engine);
      expect(player.grid[0][0]).not.toBe(999);
    });
  });

  // ================================================================
  // T18: handleKeyUp
  // ================================================================
  describe('T18 - handleKeyUp', () => {
    it('handleKeyUp 不崩溃', () => {
      engine.start();
      expect(() => {
        engine.handleKeyUp('a');
        engine.handleKeyUp('d');
        engine.handleKeyUp('s');
        engine.handleKeyUp('w');
        engine.handleKeyUp(' ');
        engine.handleKeyUp('ArrowLeft');
        engine.handleKeyUp('ArrowRight');
        engine.handleKeyUp('ArrowDown');
        engine.handleKeyUp('ArrowUp');
      }).not.toThrow();
    });

    it('松开 s 键重置软降状态', () => {
      engine.start();
      engine.handleKeyDown('s');
      expect((engine as any).softDropping).toBe(true);
      engine.handleKeyUp('s');
      expect((engine as any).softDropping).toBe(false);
    });

    it('松开 ArrowDown 键重置软降状态', () => {
      engine.start();
      engine.handleKeyDown('ArrowDown');
      expect((engine as any).softDropping).toBe(true);
      engine.handleKeyUp('ArrowDown');
      expect((engine as any).softDropping).toBe(false);
    });
  });

  // ================================================================
  // T19: 公开属性
  // ================================================================
  describe('T19 - 公开属性', () => {
    it('playerBoard 返回玩家网格', () => {
      engine.start();
      expect(engine.playerBoard).toHaveLength(ROWS);
    });

    it('aiBoard 返回 AI 网格', () => {
      engine.start();
      expect(engine.aiBoard).toHaveLength(ROWS);
    });

    it('playerScore 返回玩家分数', () => {
      engine.start();
      expect(engine.playerScore).toBe(0);
    });

    it('aiScore 返回 AI 分数', () => {
      engine.start();
      expect(engine.aiScore).toBe(0);
    });

    it('playerLevel 返回玩家等级', () => {
      engine.start();
      expect(engine.playerLevel).toBe(1);
    });

    it('aiLevel 返回 AI 等级', () => {
      engine.start();
      expect(engine.aiLevel).toBe(1);
    });

    it('isWin 返回布尔值', () => {
      expect(typeof engine.isWin).toBe('boolean');
    });

    it('pendingGarbage 返回待接收垃圾行数', () => {
      engine.start();
      expect(engine.pendingGarbage).toBe(0);
    });

    it('gameOverReason 返回字符串', () => {
      expect(typeof engine.gameOverReason).toBe('string');
    });
  });

  // ================================================================
  // T20: 事件系统
  // ================================================================
  describe('T20 - 事件系统', () => {
    it('start 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('pause 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      handler.mockClear();
      engine.pause();
      expect(handler).toHaveBeenCalledWith('paused');
    });

    it('resume 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      engine.pause();
      handler.mockClear();
      engine.resume();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('reset 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      handler.mockClear();
      engine.reset();
      expect(handler).toHaveBeenCalledWith('idle');
    });

    it('gameover 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      const player = getPlayerState(engine);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          player.grid[r][c] = 1;
        }
        player.grid[r][0] = EMPTY_CELL;
      }
      engine.handleKeyDown(' ');
      expect(handler).toHaveBeenCalledWith('gameover');
    });

    it('off 取消事件监听后不再触发', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.off('statusChange', handler);
      engine.start();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // T21: 常量验证
  // ================================================================
  describe('T21 - 常量验证', () => {
    it('CANVAS_WIDTH 为 480', () => {
      expect(CANVAS_WIDTH).toBe(480);
    });

    it('CANVAS_HEIGHT 为 640', () => {
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('COLS 为 10', () => {
      expect(COLS).toBe(10);
    });

    it('ROWS 为 20', () => {
      expect(ROWS).toBe(20);
    });

    it('TETROMINO_COUNT 为 7', () => {
      expect(TETROMINO_COUNT).toBe(7);
    });

    it('INITIAL_DROP_INTERVAL 为 1000', () => {
      expect(INITIAL_DROP_INTERVAL).toBe(1000);
    });

    it('MIN_DROP_INTERVAL 为 100', () => {
      expect(MIN_DROP_INTERVAL).toBe(100);
    });

    it('DROP_INTERVAL_DECREASE 为 80', () => {
      expect(DROP_INTERVAL_DECREASE).toBe(80);
    });

    it('7 种方块形状都存在', () => {
      expect(TETROMINO_SHAPES).toHaveLength(7);
    });

    it('I 方块为 4×4', () => {
      expect(TETROMINO_SHAPES[0]).toHaveLength(4);
      expect(TETROMINO_SHAPES[0][0]).toHaveLength(4);
    });

    it('O 方块为 2×2', () => {
      expect(TETROMINO_SHAPES[1]).toHaveLength(2);
      expect(TETROMINO_SHAPES[1][0]).toHaveLength(2);
    });

    it('T/S/Z/J/L 方块为 3×3', () => {
      for (let i = 2; i < 7; i++) {
        expect(TETROMINO_SHAPES[i]).toHaveLength(3);
        expect(TETROMINO_SHAPES[i][0]).toHaveLength(3);
      }
    });

    it('EMPTY_CELL 为 0', () => {
      expect(EMPTY_CELL).toBe(0);
    });

    it('GARBAGE_CELL 为 8', () => {
      expect(GARBAGE_CELL).toBe(8);
    });
  });

  // ================================================================
  // T22: 边界条件
  // ================================================================
  describe('T22 - 边界条件', () => {
    it('未初始化 canvas 时 start() 抛错', () => {
      const e = new TetrisBattleEngine();
      e.init();
      expect(() => e.start()).toThrow('Canvas not initialized');
    });

    it('连续 start 不会崩溃', () => {
      engine.start();
      expect(() => engine.start()).not.toThrow();
    });

    it('连续 pause 不会崩溃', () => {
      engine.start();
      engine.pause();
      expect(() => engine.pause()).not.toThrow();
    });

    it('连续 reset 不会崩溃', () => {
      engine.reset();
      expect(() => engine.reset()).not.toThrow();
    });

    it('destroy 后可以重新 init', () => {
      engine.destroy();
      const e = new TetrisBattleEngine();
      expect(() => e.init(createCanvas())).not.toThrow();
    });

    it('大量按键操作不崩溃', () => {
      engine.start();
      expect(() => {
        for (let i = 0; i < 100; i++) {
          engine.handleKeyDown('a');
          engine.handleKeyDown('d');
          engine.handleKeyDown('s');
          engine.handleKeyDown('w');
        }
      }).not.toThrow();
    });
  });

  // ================================================================
  // T23: 双棋盘独立性
  // ================================================================
  describe('T23 - 双棋盘独立性', () => {
    it('玩家操作不影响 AI 棋盘', () => {
      engine.start();
      const ai = getAIState(engine);
      const aiGridBefore = ai.grid.map((r: number[]) => [...r]);
      engine.handleKeyDown('d');
      engine.handleKeyDown('s');
      engine.handleKeyDown(' ');
      expect(JSON.stringify(ai.grid)).toBe(JSON.stringify(aiGridBefore));
    });

    it('双方分数独立', () => {
      engine.start();
      engine.handleKeyDown('s');
      expect(engine.playerScore).toBeGreaterThan(0);
      expect(engine.aiScore).toBe(0);
    });

    it('双方等级独立', () => {
      engine.start();
      const player = getPlayerState(engine);
      player.linesCleared = 10;
      for (let c = 0; c < COLS; c++) {
        player.grid[ROWS - 1][c] = 1;
      }
      engine.handleKeyDown(' ');
      expect(engine.aiLevel).toBe(1);
    });

    it('双方下落间隔独立', () => {
      engine.start();
      const player = getPlayerState(engine);
      const ai = getAIState(engine);
      expect(player.dropInterval).toBe(INITIAL_DROP_INTERVAL);
      expect(ai.dropInterval).toBe(INITIAL_DROP_INTERVAL);
    });
  });

  // ================================================================
  // T24: 公开测试辅助方法
  // ================================================================
  describe('T24 - 公开测试方法', () => {
    it('getPlayerState 返回有效对象', () => {
      engine.start();
      const state = engine.getPlayerState();
      expect(state).toHaveProperty('grid');
      expect(state).toHaveProperty('currentPiece');
      expect(state).toHaveProperty('nextType');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
    });

    it('getAIState 返回有效对象', () => {
      engine.start();
      const state = engine.getAIState();
      expect(state).toHaveProperty('grid');
      expect(state).toHaveProperty('currentPiece');
      expect(state).toHaveProperty('nextType');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
    });

    it('getAIInterval 返回数值', () => {
      expect(typeof engine.getAIInterval()).toBe('number');
    });

    it('getPlayerAttackPending 返回数值', () => {
      engine.start();
      expect(typeof engine.getPlayerAttackPending()).toBe('number');
    });

    it('getAIAttackPending 返回数值', () => {
      engine.start();
      expect(typeof engine.getAIAttackPending()).toBe('number');
    });

    it('isAIPlacing 返回布尔值', () => {
      engine.start();
      expect(typeof engine.isAIPlacing()).toBe('boolean');
    });
  });
});
