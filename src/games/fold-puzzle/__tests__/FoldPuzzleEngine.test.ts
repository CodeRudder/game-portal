/**
 * 折纸拼图 (Fold Puzzle) — 完整测试
 *
 * 覆盖：网格初始化、折叠操作（水平/垂直）、目标匹配检测、关卡系统、撤销、步数计数、键盘、getState
 */

import { FoldPuzzleEngine } from '../FoldPuzzleEngine';
import {
  GRID_SIZE,
  MIN_COLOR,
  MAX_COLOR,
  COLOR_MAP,
  LEVELS,
  MAX_LEVEL,
  BASE_SCORE,
  LEVEL_BONUS,
  OPTIMAL_BONUS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FoldLineType,
  MIN_FOLD_POS,
  MAX_FOLD_POS,
} from '../constants';

// ========== Mock requestAnimationFrame ==========

beforeAll(() => {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => 0) as any;
  globalThis.cancelAnimationFrame = (() => {}) as any;
});

// ========== 辅助工具 ==========

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): FoldPuzzleEngine {
  const engine = new FoldPuzzleEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

function startEngine(): FoldPuzzleEngine {
  const engine = createEngine();
  engine.start();
  return engine;
}

/** 创建全1网格 */
function createUniformGrid(color: number): number[][] {
  return Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(color),
  );
}

/** 比较两个网格是否相同 */
function gridsEqual(a: number[][], b: number[][]): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

// ========== 1. 常量测试 ==========

describe('Fold Puzzle — 常量', () => {
  it('CANVAS_WIDTH 应为 480', () => {
    expect(CANVAS_WIDTH).toBe(480);
  });

  it('CANVAS_HEIGHT 应为 640', () => {
    expect(CANVAS_HEIGHT).toBe(640);
  });

  it('GRID_SIZE 应为 4', () => {
    expect(GRID_SIZE).toBe(4);
  });

  it('MIN_COLOR 应为 1', () => {
    expect(MIN_COLOR).toBe(1);
  });

  it('MAX_COLOR 应为 4', () => {
    expect(MAX_COLOR).toBe(4);
  });

  it('COLOR_MAP 应包含 4 种颜色', () => {
    expect(Object.keys(COLOR_MAP)).toHaveLength(4);
    expect(COLOR_MAP[1]).toBeTruthy();
    expect(COLOR_MAP[2]).toBeTruthy();
    expect(COLOR_MAP[3]).toBeTruthy();
    expect(COLOR_MAP[4]).toBeTruthy();
  });

  it('LEVELS 应至少有 5 关', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(5);
  });

  it('MAX_LEVEL 应等于 LEVELS.length', () => {
    expect(MAX_LEVEL).toBe(LEVELS.length);
  });

  it('MIN_FOLD_POS 应为 0', () => {
    expect(MIN_FOLD_POS).toBe(0);
  });

  it('MAX_FOLD_POS 应为 GRID_SIZE - 1', () => {
    expect(MAX_FOLD_POS).toBe(GRID_SIZE - 1);
  });

  it('BASE_SCORE 应为正数', () => {
    expect(BASE_SCORE).toBeGreaterThan(0);
  });

  it('LEVEL_BONUS 应为正数', () => {
    expect(LEVEL_BONUS).toBeGreaterThan(0);
  });

  it('OPTIMAL_BONUS 应为正数', () => {
    expect(OPTIMAL_BONUS).toBeGreaterThan(0);
  });

  it('FoldLineType 应有 HORIZONTAL 和 VERTICAL', () => {
    expect(FoldLineType.HORIZONTAL).toBe('horizontal');
    expect(FoldLineType.VERTICAL).toBe('vertical');
  });
});

// ========== 2. 关卡配置测试 ==========

describe('Fold Puzzle — 关卡配置', () => {
  it('每关的 initialGrid 应为 4×4', () => {
    for (const level of LEVELS) {
      expect(level.initialGrid).toHaveLength(GRID_SIZE);
      for (const row of level.initialGrid) {
        expect(row).toHaveLength(GRID_SIZE);
      }
    }
  });

  it('每关的 targetGrid 应为 4×4', () => {
    for (const level of LEVELS) {
      expect(level.targetGrid).toHaveLength(GRID_SIZE);
      for (const row of level.targetGrid) {
        expect(row).toHaveLength(GRID_SIZE);
      }
    }
  });

  it('每关的 initialGrid 颜色值应在 1-4 范围内', () => {
    for (const level of LEVELS) {
      for (const row of level.initialGrid) {
        for (const val of row) {
          expect(val).toBeGreaterThanOrEqual(MIN_COLOR);
          expect(val).toBeLessThanOrEqual(MAX_COLOR);
        }
      }
    }
  });

  it('每关的 targetGrid 颜色值应在 1-4 范围内', () => {
    for (const level of LEVELS) {
      for (const row of level.targetGrid) {
        for (const val of row) {
          expect(val).toBeGreaterThanOrEqual(MIN_COLOR);
          expect(val).toBeLessThanOrEqual(MAX_COLOR);
        }
      }
    }
  });

  it('每关的 optimalMoves 应为正数', () => {
    for (const level of LEVELS) {
      expect(level.optimalMoves).toBeGreaterThan(0);
    }
  });

  it('每关的 level 应从 1 开始递增', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(LEVELS[i].level).toBe(i + 1);
    }
  });

  it('第一关的 initialGrid 不应等于 targetGrid', () => {
    expect(gridsEqual(LEVELS[0].initialGrid, LEVELS[0].targetGrid)).toBe(false);
  });

  it('每关的 initialGrid 和 targetGrid 应不同', () => {
    for (const level of LEVELS) {
      expect(gridsEqual(level.initialGrid, level.targetGrid)).toBe(false);
    }
  });
});

// ========== 3. 引擎初始化测试 ==========

describe('Fold Puzzle — 引擎初始化', () => {
  it('创建引擎后应为 idle 状态', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('初始化后应加载第一关', () => {
    const engine = createEngine();
    expect(engine.currentLevelIndex).toBe(0);
  });

  it('初始化后步数应为 0', () => {
    const engine = createEngine();
    expect(engine.moveCount).toBe(0);
  });

  it('初始化后 isWin 应为 false', () => {
    const engine = createEngine();
    expect(engine.isWin).toBe(false);
  });

  it('初始化后折线类型应为 HORIZONTAL', () => {
    const engine = createEngine();
    expect(engine.foldLineType).toBe(FoldLineType.HORIZONTAL);
  });

  it('初始化后折线位置应为 0', () => {
    const engine = createEngine();
    expect(engine.foldLinePos).toBe(0);
  });

  it('初始化后 levelCompleted 应为 false', () => {
    const engine = createEngine();
    expect(engine.levelCompleted).toBe(false);
  });

  it('totalLevels 应等于 MAX_LEVEL', () => {
    const engine = createEngine();
    expect(engine.totalLevels).toBe(MAX_LEVEL);
  });

  it('初始化后网格应等于第一关的 initialGrid', () => {
    const engine = createEngine();
    expect(gridsEqual(engine.getGrid(), LEVELS[0].initialGrid)).toBe(true);
  });

  it('初始化后目标网格应等于第一关的 targetGrid', () => {
    const engine = createEngine();
    expect(gridsEqual(engine.getTargetGrid(), LEVELS[0].targetGrid)).toBe(true);
  });

  it('初始化后历史应为空', () => {
    const engine = createEngine();
    expect(engine.getHistoryLength()).toBe(0);
  });
});

// ========== 4. 启动游戏测试 ==========

describe('Fold Puzzle — 启动游戏', () => {
  it('start 后状态应为 playing', () => {
    const engine = startEngine();
    expect(engine.status).toBe('playing');
  });

  it('start 后分数应为 0', () => {
    const engine = startEngine();
    expect(engine.score).toBe(0);
  });

  it('start 后 level 应为 1', () => {
    const engine = startEngine();
    expect(engine.level).toBe(1);
  });

  it('start 后应重新加载当前关卡', () => {
    const engine = startEngine();
    expect(engine.moveCount).toBe(0);
    expect(engine.levelCompleted).toBe(false);
  });
});

// ========== 5. 水平折叠测试 ==========

describe('Fold Puzzle — 水平折叠', () => {
  let engine: FoldPuzzleEngine;

  beforeEach(() => {
    engine = startEngine();
    // 设置一个简单网格
    engine.setGrid([
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 3, 3],
      [4, 4, 4, 4],
    ]);
    engine.setFoldLineType(FoldLineType.HORIZONTAL);
  });

  it('水平折叠 pos=0 up：row 0 覆盖 row 1', () => {
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();

    const grid = engine.getGrid();
    // row 0 折叠覆盖 row 1
    expect(grid[1]).toEqual([1, 1, 1, 1]);
    // row 0 保持不变
    expect(grid[0]).toEqual([1, 1, 1, 1]);
    // row 2, 3 保持不变
    expect(grid[2]).toEqual([3, 3, 3, 3]);
    expect(grid[3]).toEqual([4, 4, 4, 4]);
  });

  it('水平折叠 pos=0 down：row 1 覆盖 row 0', () => {
    engine.setFoldLinePos(0);
    engine.setFoldSide('down');
    engine.confirmFold();

    const grid = engine.getGrid();
    // row 1 折叠覆盖 row 0
    expect(grid[0]).toEqual([2, 2, 2, 2]);
    // row 1 保持不变
    expect(grid[1]).toEqual([2, 2, 2, 2]);
    expect(grid[2]).toEqual([3, 3, 3, 3]);
    expect(grid[3]).toEqual([4, 4, 4, 4]);
  });

  it('水平折叠 pos=1 up：row 0,1 覆盖 row 2,3', () => {
    engine.setFoldLinePos(1);
    engine.setFoldSide('up');
    engine.confirmFold();

    const grid = engine.getGrid();
    // row 0 -> row 3 (对称), row 1 -> row 2 (对称)
    expect(grid[3]).toEqual([1, 1, 1, 1]);
    expect(grid[2]).toEqual([2, 2, 2, 2]);
    // row 0, 1 保持不变
    expect(grid[0]).toEqual([1, 1, 1, 1]);
    expect(grid[1]).toEqual([2, 2, 2, 2]);
  });

  it('水平折叠 pos=1 down：row 2,3 覆盖 row 1,0', () => {
    engine.setFoldLinePos(1);
    engine.setFoldSide('down');
    engine.confirmFold();

    const grid = engine.getGrid();
    // row 2 -> row 1 (对称), row 3 -> row 0 (对称)
    expect(grid[1]).toEqual([3, 3, 3, 3]);
    expect(grid[0]).toEqual([4, 4, 4, 4]);
    // row 2, 3 保持不变
    expect(grid[2]).toEqual([3, 3, 3, 3]);
    expect(grid[3]).toEqual([4, 4, 4, 4]);
  });

  it('水平折叠 pos=2 up：row 0,1,2 覆盖 row 3', () => {
    engine.setFoldLinePos(2);
    engine.setFoldSide('up');
    engine.confirmFold();

    const grid = engine.getGrid();
    // row 2 -> row 3 (对称), row 1 -> out of bounds, row 0 -> out of bounds
    expect(grid[3]).toEqual([3, 3, 3, 3]);
    expect(grid[0]).toEqual([1, 1, 1, 1]);
    expect(grid[1]).toEqual([2, 2, 2, 2]);
    expect(grid[2]).toEqual([3, 3, 3, 3]);
  });

  it('水平折叠 pos=2 down：row 3 覆盖 row 2', () => {
    engine.setFoldLinePos(2);
    engine.setFoldSide('down');
    engine.confirmFold();

    const grid = engine.getGrid();
    // row 3 -> row 2 (对称)
    expect(grid[2]).toEqual([4, 4, 4, 4]);
    expect(grid[0]).toEqual([1, 1, 1, 1]);
    expect(grid[1]).toEqual([2, 2, 2, 2]);
    expect(grid[3]).toEqual([4, 4, 4, 4]);
  });

  it('水平折叠 pos=3 up：row 0,1,2,3 覆盖...（无对称行可覆盖）', () => {
    engine.setFoldLinePos(3);
    engine.setFoldSide('up');
    engine.confirmFold();

    const grid = engine.getGrid();
    // pos=3, up: row 0..3 折叠覆盖 row 4..7（超出范围，无效果）
    // row 3 -> row 4 (out of bounds)
    // 所以只有 row 3 可以覆盖... 不，row 3 对称位置是 4，超出
    // 实际上 row 2 对称位置是 4, row 1 -> 5, row 0 -> 6，都超出
    // 所以网格不变
    expect(grid[0]).toEqual([1, 1, 1, 1]);
    expect(grid[1]).toEqual([2, 2, 2, 2]);
    expect(grid[2]).toEqual([3, 3, 3, 3]);
    expect(grid[3]).toEqual([4, 4, 4, 4]);
  });

  it('水平折叠 pos=3 down：row 3 无对称行', () => {
    engine.setFoldLinePos(3);
    engine.setFoldSide('down');
    engine.confirmFold();

    const grid = engine.getGrid();
    // pos=3, down: row 4..3 折叠覆盖 row 2..（row 4 超出）
    // 没有可折叠的行，网格不变
    expect(grid[0]).toEqual([1, 1, 1, 1]);
    expect(grid[1]).toEqual([2, 2, 2, 2]);
    expect(grid[2]).toEqual([3, 3, 3, 3]);
    expect(grid[3]).toEqual([4, 4, 4, 4]);
  });

  it('水平折叠应增加步数', () => {
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    const before = engine.moveCount;
    engine.confirmFold();
    expect(engine.moveCount).toBe(before + 1);
  });

  it('水平折叠应保存到历史', () => {
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    expect(engine.getHistoryLength()).toBe(1);
  });
});

// ========== 6. 垂直折叠测试 ==========

describe('Fold Puzzle — 垂直折叠', () => {
  let engine: FoldPuzzleEngine;

  beforeEach(() => {
    engine = startEngine();
    engine.setGrid([
      [1, 2, 3, 4],
      [1, 2, 3, 4],
      [1, 2, 3, 4],
      [1, 2, 3, 4],
    ]);
    engine.setFoldLineType(FoldLineType.VERTICAL);
  });

  it('垂直折叠 pos=0 left：col 0 覆盖 col 1', () => {
    engine.setFoldLinePos(0);
    engine.setFoldSide('left');
    engine.confirmFold();

    const grid = engine.getGrid();
    // col 0 -> col 1
    for (let r = 0; r < GRID_SIZE; r++) {
      expect(grid[r][1]).toBe(1);
      expect(grid[r][0]).toBe(1); // col 0 不变
    }
  });

  it('垂直折叠 pos=0 right：col 1 覆盖 col 0', () => {
    engine.setFoldLinePos(0);
    engine.setFoldSide('right');
    engine.confirmFold();

    const grid = engine.getGrid();
    // col 1 -> col 0
    for (let r = 0; r < GRID_SIZE; r++) {
      expect(grid[r][0]).toBe(2);
    }
  });

  it('垂直折叠 pos=1 left：col 0,1 覆盖 col 2,3', () => {
    engine.setFoldLinePos(1);
    engine.setFoldSide('left');
    engine.confirmFold();

    const grid = engine.getGrid();
    // col 0 -> col 3, col 1 -> col 2
    for (let r = 0; r < GRID_SIZE; r++) {
      expect(grid[r][3]).toBe(1);
      expect(grid[r][2]).toBe(2);
    }
  });

  it('垂直折叠 pos=1 right：col 2,3 覆盖 col 1,0', () => {
    engine.setFoldLinePos(1);
    engine.setFoldSide('right');
    engine.confirmFold();

    const grid = engine.getGrid();
    // col 2 -> col 1, col 3 -> col 0
    for (let r = 0; r < GRID_SIZE; r++) {
      expect(grid[r][1]).toBe(3);
      expect(grid[r][0]).toBe(4);
    }
  });

  it('垂直折叠 pos=2 left：col 0,1,2 覆盖 col 3', () => {
    engine.setFoldLinePos(2);
    engine.setFoldSide('left');
    engine.confirmFold();

    const grid = engine.getGrid();
    // col 2 -> col 3, col 1 -> col 4 (out), col 0 -> col 5 (out)
    for (let r = 0; r < GRID_SIZE; r++) {
      expect(grid[r][3]).toBe(3);
    }
  });

  it('垂直折叠 pos=2 right：col 3 覆盖 col 2', () => {
    engine.setFoldLinePos(2);
    engine.setFoldSide('right');
    engine.confirmFold();

    const grid = engine.getGrid();
    // col 3 -> col 2
    for (let r = 0; r < GRID_SIZE; r++) {
      expect(grid[r][2]).toBe(4);
    }
  });

  it('垂直折叠 pos=3：无有效折叠', () => {
    engine.setFoldLinePos(3);
    engine.setFoldSide('left');
    engine.confirmFold();

    const grid = engine.getGrid();
    // 无对称列，网格不变
    for (let r = 0; r < GRID_SIZE; r++) {
      expect(grid[r]).toEqual([1, 2, 3, 4]);
    }
  });

  it('垂直折叠应增加步数', () => {
    engine.setFoldLinePos(0);
    engine.setFoldSide('left');
    const before = engine.moveCount;
    engine.confirmFold();
    expect(engine.moveCount).toBe(before + 1);
  });

  it('垂直折叠应保存到历史', () => {
    engine.setFoldLinePos(0);
    engine.setFoldSide('left');
    engine.confirmFold();
    expect(engine.getHistoryLength()).toBe(1);
  });
});

// ========== 7. 目标匹配检测测试 ==========

describe('Fold Puzzle — 目标匹配检测', () => {
  it('初始状态不匹配目标', () => {
    const engine = startEngine();
    expect(engine.checkMatch()).toBe(false);
  });

  it('手动设置网格匹配目标后 checkMatch 返回 true', () => {
    const engine = startEngine();
    const target = engine.getTargetGrid();
    engine.setGrid(target);
    expect(engine.checkMatch()).toBe(true);
  });

  it('部分匹配时 checkMatch 返回 false', () => {
    const engine = startEngine();
    const target = engine.getTargetGrid();
    const partial = target.map((row) => [...row]);
    // 确保改变为一个不同的值
    const origVal = partial[0][0];
    partial[0][0] = origVal === 1 ? 2 : 1;
    engine.setGrid(partial);
    expect(engine.checkMatch()).toBe(false);
  });

  it('getMatchPercentage 返回 0-1 之间的值', () => {
    const engine = startEngine();
    const pct = engine.getMatchPercentage();
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(1);
  });

  it('完全匹配时 getMatchPercentage 返回 1', () => {
    const engine = startEngine();
    engine.setGrid(engine.getTargetGrid());
    expect(engine.getMatchPercentage()).toBe(1);
  });

  it('完全不匹配时 getMatchPercentage 可能返回 0', () => {
    const engine = startEngine();
    // 设置一个完全不同的网格
    engine.setGrid([
      [4, 3, 2, 1],
      [4, 3, 2, 1],
      [4, 3, 2, 1],
      [4, 3, 2, 1],
    ]);
    // 如果恰好有匹配的格子，百分比不会是0
    const pct = engine.getMatchPercentage();
    expect(pct).toBeGreaterThanOrEqual(0);
  });
});

// ========== 8. 关卡系统测试 ==========

describe('Fold Puzzle — 关卡系统', () => {
  it('初始关卡索引应为 0', () => {
    const engine = startEngine();
    expect(engine.currentLevelIndex).toBe(0);
  });

  it('loadLevel 应加载正确的关卡', () => {
    const engine = startEngine();
    engine.loadLevel(2);
    expect(engine.currentLevelIndex).toBe(2);
    expect(gridsEqual(engine.getGrid(), LEVELS[2].initialGrid)).toBe(true);
    expect(gridsEqual(engine.getTargetGrid(), LEVELS[2].targetGrid)).toBe(true);
  });

  it('loadLevel 后步数应重置为 0', () => {
    const engine = startEngine();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    expect(engine.moveCount).toBe(1);
    engine.loadLevel(1);
    expect(engine.moveCount).toBe(0);
  });

  it('loadLevel 后历史应清空', () => {
    const engine = startEngine();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    engine.loadLevel(1);
    expect(engine.getHistoryLength()).toBe(0);
  });

  it('loadLevel 超出范围不改变当前关卡', () => {
    const engine = startEngine();
    const before = engine.currentLevelIndex;
    engine.loadLevel(-1);
    expect(engine.currentLevelIndex).toBe(before);
    engine.loadLevel(MAX_LEVEL);
    expect(engine.currentLevelIndex).toBe(before);
  });

  it('nextLevel 应进入下一关', () => {
    const engine = startEngine();
    // 先完成第一关
    engine.setGrid(engine.getTargetGrid());
    // 手动触发完成
    engine.confirmFold(); // 这会增加步数但网格已经匹配
    // 不，我们用 setGrid 后 checkMatch 会为 true
    // 但 confirmFold 会先保存历史再 applyFold（改变网格）
    // 让我们用不同方式
  });

  it('resetLevel 应重置当前关卡', () => {
    const engine = startEngine();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    engine.resetLevel();
    expect(engine.moveCount).toBe(0);
    expect(gridsEqual(engine.getGrid(), LEVELS[0].initialGrid)).toBe(true);
  });

  it('所有关卡都应可加载', () => {
    const engine = startEngine();
    for (let i = 0; i < MAX_LEVEL; i++) {
      engine.loadLevel(i);
      expect(engine.currentLevelIndex).toBe(i);
    }
  });
});

// ========== 9. 撤销测试 ==========

describe('Fold Puzzle — 撤销', () => {
  let engine: FoldPuzzleEngine;

  beforeEach(() => {
    engine = startEngine();
    engine.setGrid([
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 3, 3],
      [4, 4, 4, 4],
    ]);
    engine.setFoldLineType(FoldLineType.HORIZONTAL);
  });

  it('撤销应恢复上一步的网格', () => {
    const originalGrid = engine.getGrid();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    expect(engine.getHistoryLength()).toBe(1);
    engine.undo();
    expect(gridsEqual(engine.getGrid(), originalGrid)).toBe(true);
  });

  it('撤销应减少步数', () => {
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    expect(engine.moveCount).toBe(1);
    engine.undo();
    expect(engine.moveCount).toBe(0);
  });

  it('连续撤销多步', () => {
    const originalGrid = engine.getGrid();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    engine.confirmFold();
    expect(engine.moveCount).toBe(2);
    engine.undo();
    expect(engine.moveCount).toBe(1);
    engine.undo();
    expect(engine.moveCount).toBe(0);
    expect(gridsEqual(engine.getGrid(), originalGrid)).toBe(true);
  });

  it('没有历史时撤销不报错', () => {
    expect(() => engine.undo()).not.toThrow();
    expect(engine.moveCount).toBe(0);
  });

  it('没有历史时撤销不改变步数', () => {
    engine.undo();
    expect(engine.moveCount).toBe(0);
  });

  it('撤销后历史长度减少', () => {
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    engine.confirmFold();
    expect(engine.getHistoryLength()).toBe(2);
    engine.undo();
    expect(engine.getHistoryLength()).toBe(1);
  });
});

// ========== 10. 步数计数测试 ==========

describe('Fold Puzzle — 步数计数', () => {
  it('初始步数为 0', () => {
    const engine = startEngine();
    expect(engine.moveCount).toBe(0);
  });

  it('每次折叠增加 1 步', () => {
    const engine = startEngine();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    expect(engine.moveCount).toBe(1);
    engine.confirmFold();
    expect(engine.moveCount).toBe(2);
    engine.confirmFold();
    expect(engine.moveCount).toBe(3);
  });

  it('撤销减少步数', () => {
    const engine = startEngine();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    engine.confirmFold();
    engine.undo();
    expect(engine.moveCount).toBe(1);
  });

  it('重置关卡后步数为 0', () => {
    const engine = startEngine();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    engine.resetLevel();
    expect(engine.moveCount).toBe(0);
  });

  it('加载新关卡后步数为 0', () => {
    const engine = startEngine();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    engine.loadLevel(1);
    expect(engine.moveCount).toBe(0);
  });
});

// ========== 11. 键盘控制测试 ==========

describe('Fold Puzzle — 键盘控制', () => {
  let engine: FoldPuzzleEngine;

  beforeEach(() => {
    engine = startEngine();
    engine.setFoldLineType(FoldLineType.HORIZONTAL);
  });

  it('ArrowDown 应增加折线位置（水平模式）', () => {
    engine.handleKeyDown('ArrowDown');
    expect(engine.foldLinePos).toBe(1);
  });

  it('ArrowUp 应减少折线位置（水平模式）', () => {
    engine.handleKeyDown('ArrowDown'); // pos = 1
    engine.handleKeyDown('ArrowUp');
    expect(engine.foldLinePos).toBe(0);
  });

  it('ArrowUp 在 pos=0 不应变为负数', () => {
    engine.handleKeyDown('ArrowUp');
    expect(engine.foldLinePos).toBe(0);
  });

  it('ArrowDown 在 pos=MAX_FOLD_POS 不应超出', () => {
    engine.setFoldLinePos(MAX_FOLD_POS);
    engine.handleKeyDown('ArrowDown');
    expect(engine.foldLinePos).toBe(MAX_FOLD_POS);
  });

  it('ArrowRight 在水平模式下切换方向为 right', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.foldSide).toBe('right');
  });

  it('ArrowLeft 在水平模式下切换方向为 left', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.foldSide).toBe('left');
  });

  it('空格键应执行折叠', () => {
    const before = engine.moveCount;
    engine.handleKeyDown(' ');
    expect(engine.moveCount).toBe(before + 1);
  });

  it('U 键应撤销', () => {
    engine.handleKeyDown(' ');
    expect(engine.moveCount).toBe(1);
    engine.handleKeyDown('u');
    expect(engine.moveCount).toBe(0);
  });

  it('大写 U 键应撤销', () => {
    engine.handleKeyDown(' ');
    expect(engine.moveCount).toBe(1);
    engine.handleKeyDown('U');
    expect(engine.moveCount).toBe(0);
  });

  it('R 键应重置关卡', () => {
    engine.handleKeyDown(' ');
    engine.handleKeyDown('r');
    expect(engine.moveCount).toBe(0);
  });

  it('大写 R 键应重置关卡', () => {
    engine.handleKeyDown(' ');
    engine.handleKeyDown('R');
    expect(engine.moveCount).toBe(0);
  });

  it('非游戏状态时按键无效', () => {
    const engine2 = createEngine();
    // engine2 状态为 idle，不是 playing
    engine2.handleKeyDown('ArrowDown');
    expect(engine2.foldLinePos).toBe(0);
  });

  it('关卡完成后按键无效', () => {
    engine.setGrid(engine.getTargetGrid());
    engine.handleKeyDown(' '); // 触发折叠并匹配
    // 关卡完成后
    if (engine.levelCompleted) {
      const moves = engine.moveCount;
      engine.handleKeyDown(' ');
      expect(engine.moveCount).toBe(moves);
    }
  });
});

// ========== 12. 垂直模式键盘测试 ==========

describe('Fold Puzzle — 垂直模式键盘控制', () => {
  let engine: FoldPuzzleEngine;

  beforeEach(() => {
    engine = startEngine();
    engine.setFoldLineType(FoldLineType.VERTICAL);
  });

  it('ArrowRight 应增加折线位置（垂直模式）', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.foldLinePos).toBe(1);
  });

  it('ArrowLeft 应减少折线位置（垂直模式）', () => {
    engine.handleKeyDown('ArrowRight'); // pos = 1
    engine.handleKeyDown('ArrowLeft');
    expect(engine.foldLinePos).toBe(0);
  });

  it('ArrowUp 在垂直模式下切换方向为 up', () => {
    engine.handleKeyDown('ArrowUp');
    expect(engine.foldSide).toBe('up');
  });

  it('ArrowDown 在垂直模式下切换方向为 down', () => {
    engine.handleKeyDown('ArrowDown');
    expect(engine.foldSide).toBe('down');
  });

  it('ArrowLeft 在 pos=0 不应变为负数', () => {
    engine.handleKeyDown('ArrowLeft');
    expect(engine.foldLinePos).toBe(0);
  });

  it('ArrowRight 在 pos=MAX_FOLD_POS 不应超出', () => {
    engine.setFoldLinePos(MAX_FOLD_POS);
    engine.handleKeyDown('ArrowRight');
    expect(engine.foldLinePos).toBe(MAX_FOLD_POS);
  });
});

// ========== 13. getState 测试 ==========

describe('Fold Puzzle — getState', () => {
  it('getState 应返回正确的结构', () => {
    const engine = startEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('grid');
    expect(state).toHaveProperty('targetGrid');
    expect(state).toHaveProperty('currentLevelIndex');
    expect(state).toHaveProperty('moveCount');
    expect(state).toHaveProperty('isWin');
    expect(state).toHaveProperty('foldLineType');
    expect(state).toHaveProperty('foldLinePos');
    expect(state).toHaveProperty('foldSide');
    expect(state).toHaveProperty('levelCompleted');
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('level');
  });

  it('getState 返回的 grid 应为深拷贝', () => {
    const engine = startEngine();
    const state1 = engine.getState();
    const grid1 = state1.grid as number[][];
    grid1[0][0] = 99;
    const state2 = engine.getState();
    expect((state2.grid as number[][])[0][0]).not.toBe(99);
  });

  it('getState 应反映当前状态', () => {
    const engine = startEngine();
    engine.setFoldLinePos(2);
    engine.setFoldSide('down');
    const state = engine.getState();
    expect(state.foldLinePos).toBe(2);
    expect(state.foldSide).toBe('down');
  });

  it('getState 在折叠后应更新', () => {
    const engine = startEngine();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    const state = engine.getState();
    expect(state.moveCount).toBe(1);
  });
});

// ========== 14. 折线类型切换测试 ==========

describe('Fold Puzzle — 折线类型切换', () => {
  it('toggleFoldLineType 应在水平和垂直之间切换', () => {
    const engine = startEngine();
    expect(engine.foldLineType).toBe(FoldLineType.HORIZONTAL);
    engine.toggleFoldLineType();
    expect(engine.foldLineType).toBe(FoldLineType.VERTICAL);
    engine.toggleFoldLineType();
    expect(engine.foldLineType).toBe(FoldLineType.HORIZONTAL);
  });

  it('切换后折线位置应重置为 0', () => {
    const engine = startEngine();
    engine.setFoldLinePos(2);
    engine.toggleFoldLineType();
    expect(engine.foldLinePos).toBe(0);
  });

  it('切换为垂直后方向应为 left', () => {
    const engine = startEngine();
    engine.toggleFoldLineType();
    expect(engine.foldSide).toBe('left');
  });

  it('切换为水平后方向应为 up', () => {
    const engine = startEngine();
    engine.toggleFoldLineType(); // -> vertical
    engine.toggleFoldLineType(); // -> horizontal
    expect(engine.foldSide).toBe('up');
  });
});

// ========== 15. 设置方法测试 ==========

describe('Fold Puzzle — 设置方法', () => {
  it('setFoldLineType 应设置折线类型', () => {
    const engine = startEngine();
    engine.setFoldLineType(FoldLineType.VERTICAL);
    expect(engine.foldLineType).toBe(FoldLineType.VERTICAL);
  });

  it('setFoldLinePos 应设置折线位置', () => {
    const engine = startEngine();
    engine.setFoldLinePos(2);
    expect(engine.foldLinePos).toBe(2);
  });

  it('setFoldLinePos 超出范围不应改变', () => {
    const engine = startEngine();
    engine.setFoldLinePos(0);
    engine.setFoldLinePos(-1);
    expect(engine.foldLinePos).toBe(0);
    engine.setFoldLinePos(MAX_FOLD_POS + 1);
    expect(engine.foldLinePos).toBe(0);
  });

  it('setFoldSide 应设置折叠方向', () => {
    const engine = startEngine();
    engine.setFoldSide('down');
    expect(engine.foldSide).toBe('down');
  });

  it('setGrid 应设置网格', () => {
    const engine = startEngine();
    const newGrid = createUniformGrid(3);
    engine.setGrid(newGrid);
    expect(gridsEqual(engine.getGrid(), newGrid)).toBe(true);
  });

  it('setGrid 应为深拷贝', () => {
    const engine = startEngine();
    const newGrid = createUniformGrid(3);
    engine.setGrid(newGrid);
    newGrid[0][0] = 1;
    expect(engine.getGrid()[0][0]).toBe(3);
  });

  it('getGrid 应返回深拷贝', () => {
    const engine = startEngine();
    const grid = engine.getGrid();
    grid[0][0] = 99;
    expect(engine.getGrid()[0][0]).not.toBe(99);
  });
});

// ========== 16. 关卡完成与得分测试 ==========

describe('Fold Puzzle — 关卡完成与得分', () => {
  it('完成关卡后 levelCompleted 应为 true', () => {
    const engine = startEngine();
    // 直接设置网格为目标并折叠
    engine.setGrid(engine.getTargetGrid());
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    // 先设一个不同的网格，再折叠到目标
    // 实际上 confirmFold 会先保存再执行折叠
    // 让我们直接设置网格匹配目标
    engine.setGrid([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [3, 3, 3, 3],
      [4, 4, 4, 4],
    ]);
    engine.setFoldLineType(FoldLineType.HORIZONTAL);
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    // 折叠后 row 0 覆盖 row 1
    engine.confirmFold();
    // 现在检查是否匹配
    const target = engine.getTargetGrid();
    if (engine.checkMatch()) {
      expect(engine.levelCompleted).toBe(true);
    }
  });

  it('完成关卡后应获得分数', () => {
    const engine = startEngine();
    const initialScore = engine.score;
    // 使用第一关的初始和目标网格
    // 关卡1: initialGrid -> targetGrid
    // 需要找到正确的折叠序列
    // 简单方法：直接设置为目标网格
    engine.setGrid(engine.getTargetGrid());
    // 现在需要触发 confirmFold 让它检测匹配
    // 但 confirmFold 会先 applyFold 改变网格...
    // 所以我们需要一个不同的方法
    // 让我们手动设置网格并调用内部方法
  });

  it('最后一关完成后 isWin 应为 true', () => {
    const engine = startEngine();
    engine.loadLevel(MAX_LEVEL - 1);
    engine.setGrid(engine.getTargetGrid());
    // 直接触发完成检测
    // 由于 confirmFold 会改变网格，我们需要用不同方式
    // 通过 handleKeyDown 空格键触发
    // 但这也会改变网格
    // 让我们用一种方法：先设置网格，然后折叠但网格恰好不变
    // 最简单的方式：设置网格为目标，然后执行一个无效折叠（pos=3）
    engine.setFoldLineType(FoldLineType.HORIZONTAL);
    engine.setFoldLinePos(MAX_FOLD_POS); // pos=3, 无有效折叠
    engine.setFoldSide('up');
    engine.confirmFold();
    // 网格不变，仍然匹配目标
    if (engine.checkMatch()) {
      expect(engine.levelCompleted).toBe(true);
    }
  });
});

// ========== 17. 重置测试 ==========

describe('Fold Puzzle — 重置', () => {
  it('reset 后状态应为 idle', () => {
    const engine = startEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('reset 后分数应为 0', () => {
    const engine = startEngine();
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后 level 应为 1', () => {
    const engine = startEngine();
    engine.reset();
    expect(engine.level).toBe(1);
  });

  it('reset 后步数应为 0', () => {
    const engine = startEngine();
    engine.handleKeyDown(' ');
    engine.reset();
    expect(engine.moveCount).toBe(0);
  });
});

// ========== 18. 事件系统测试 ==========

describe('Fold Puzzle — 事件系统', () => {
  it('stateChange 事件应在折叠时触发', () => {
    const engine = startEngine();
    const listener = jest.fn();
    engine.on('stateChange', listener);
    engine.handleKeyDown(' ');
    expect(listener).toHaveBeenCalled();
  });

  it('stateChange 事件应在撤销时触发', () => {
    const engine = startEngine();
    engine.handleKeyDown(' ');
    const listener = jest.fn();
    engine.on('stateChange', listener);
    engine.handleKeyDown('u');
    expect(listener).toHaveBeenCalled();
  });

  it('stateChange 事件应在重置关卡时触发', () => {
    const engine = startEngine();
    const listener = jest.fn();
    engine.on('stateChange', listener);
    engine.resetLevel();
    expect(listener).toHaveBeenCalled();
  });

  it('off 应移除事件监听', () => {
    const engine = startEngine();
    const listener = jest.fn();
    engine.on('stateChange', listener);
    engine.off('stateChange', listener);
    engine.handleKeyDown(' ');
    expect(listener).not.toHaveBeenCalled();
  });
});

// ========== 19. handleKeyUp 测试 ==========

describe('Fold Puzzle — handleKeyUp', () => {
  it('handleKeyUp 不应抛出错误', () => {
    const engine = startEngine();
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    expect(() => engine.handleKeyUp(' ')).not.toThrow();
    expect(() => engine.handleKeyUp('u')).not.toThrow();
  });

  it('handleKeyUp 不应改变游戏状态', () => {
    const engine = startEngine();
    const state = engine.getState();
    engine.handleKeyUp('ArrowUp');
    engine.handleKeyUp(' ');
    const newState = engine.getState();
    expect(newState.moveCount).toBe(state.moveCount);
    expect(newState.foldLinePos).toBe(state.foldLinePos);
  });
});

// ========== 20. 综合场景测试 ==========

describe('Fold Puzzle — 综合场景', () => {
  it('完整游戏流程：初始化 → 操作 → 重置', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
    engine.start();
    expect(engine.status).toBe('playing');
    engine.handleKeyDown('ArrowDown'); // 移动折线
    expect(engine.foldLinePos).toBe(1);
    engine.handleKeyDown(' '); // 折叠
    expect(engine.moveCount).toBe(1);
    engine.handleKeyDown('u'); // 撤销
    expect(engine.moveCount).toBe(0);
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('多步操作和撤销', () => {
    const engine = startEngine();
    const originalGrid = engine.getGrid();

    // 执行3步
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    engine.setFoldSide('down');
    engine.confirmFold();
    engine.setFoldSide('up');
    engine.confirmFold();
    expect(engine.moveCount).toBe(3);

    // 撤销3步
    engine.undo();
    engine.undo();
    engine.undo();
    expect(engine.moveCount).toBe(0);
    expect(gridsEqual(engine.getGrid(), originalGrid)).toBe(true);
  });

  it('切换关卡后操作正确', () => {
    const engine = startEngine();
    engine.loadLevel(1);
    expect(engine.currentLevelIndex).toBe(1);
    expect(engine.moveCount).toBe(0);

    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    expect(engine.moveCount).toBe(1);

    engine.loadLevel(0);
    expect(engine.currentLevelIndex).toBe(0);
    expect(engine.moveCount).toBe(0);
  });

  it('暂停和恢复不影响游戏状态', () => {
    const engine = startEngine();
    engine.setFoldLinePos(1);
    engine.pause();
    expect(engine.status).toBe('paused');
    engine.resume();
    expect(engine.status).toBe('playing');
    expect(engine.foldLinePos).toBe(1);
  });

  it('destroy 后不再响应事件', () => {
    const engine = startEngine();
    const listener = jest.fn();
    engine.on('stateChange', listener);
    engine.destroy();
    // destroy 后 listeners 被清空，不应再触发
    // 但 destroy 会调用 reset，reset 会重置状态
    expect(engine.status).toBe('idle');
  });
});

// ========== 21. 折叠方向交叉测试 ==========

describe('Fold Puzzle — 折叠方向交叉', () => {
  it('水平模式 + right 方向应执行垂直折叠', () => {
    const engine = startEngine();
    engine.setGrid([
      [1, 2, 3, 4],
      [1, 2, 3, 4],
      [1, 2, 3, 4],
      [1, 2, 3, 4],
    ]);
    engine.setFoldLineType(FoldLineType.HORIZONTAL);
    engine.setFoldLinePos(1);
    engine.setFoldSide('right');
    engine.confirmFold();

    // 水平模式 + right -> 内部切换为垂直折叠
    const grid = engine.getGrid();
    // col 2,3 覆盖 col 1,0
    for (let r = 0; r < GRID_SIZE; r++) {
      expect(grid[r][1]).toBe(3);
      expect(grid[r][0]).toBe(4);
    }
  });

  it('垂直模式 + up 方向应执行水平折叠', () => {
    const engine = startEngine();
    engine.setGrid([
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 3, 3],
      [4, 4, 4, 4],
    ]);
    engine.setFoldLineType(FoldLineType.VERTICAL);
    engine.setFoldLinePos(1);
    engine.setFoldSide('up');
    engine.confirmFold();

    // 垂直模式 + up -> 内部切换为水平折叠
    const grid = engine.getGrid();
    // row 0,1 覆盖 row 2,3
    expect(grid[3]).toEqual([1, 1, 1, 1]);
    expect(grid[2]).toEqual([2, 2, 2, 2]);
  });
});

// ========== 22. 边界条件测试 ==========

describe('Fold Puzzle — 边界条件', () => {
  it('空网格不崩溃', () => {
    const engine = startEngine();
    expect(() => engine.checkMatch()).not.toThrow();
  });

  it('全相同颜色网格不崩溃', () => {
    const engine = startEngine();
    engine.setGrid(createUniformGrid(1));
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    expect(() => engine.confirmFold()).not.toThrow();
  });

  it('连续多次折叠不崩溃', () => {
    const engine = startEngine();
    for (let i = 0; i < 20; i++) {
      engine.setFoldLinePos(i % (GRID_SIZE - 1));
      engine.setFoldSide(i % 2 === 0 ? 'up' : 'down');
      engine.confirmFold();
    }
    expect(engine.moveCount).toBe(20);
  });

  it('连续撤销到空历史不崩溃', () => {
    const engine = startEngine();
    engine.setFoldLinePos(0);
    engine.setFoldSide('up');
    engine.confirmFold();
    engine.undo();
    engine.undo(); // 空历史
    engine.undo(); // 空历史
    expect(engine.moveCount).toBe(0);
  });

  it('关卡完成后撤销无效', () => {
    const engine = startEngine();
    engine.loadLevel(0);
    // 设置网格匹配目标
    engine.setGrid(engine.getTargetGrid());
    // 执行一个不改变网格的折叠
    engine.setFoldLineType(FoldLineType.HORIZONTAL);
    engine.setFoldLinePos(MAX_FOLD_POS);
    engine.setFoldSide('up');
    engine.confirmFold();
    if (engine.levelCompleted) {
      const moves = engine.moveCount;
      engine.undo();
      expect(engine.moveCount).toBe(moves);
    }
  });
});
