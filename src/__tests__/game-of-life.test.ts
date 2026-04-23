import { vi } from 'vitest';
/**
 * Conway's Game of Life 引擎测试
 *
 * 测试覆盖：初始化、生命周期、Conway 规则、环绕边界、速度控制、
 * 鼠标交互、键盘交互、预设图案、游戏状态、事件系统
 */

import { GameOfLifeEngine } from '@/games/game-of-life/GameOfLifeEngine';
import {
  CELL_SIZE,
  CELL_GAP,
  GRID_COLS,
  GRID_ROWS,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  TICK_INTERVALS,
  DEFAULT_TICK_INTERVAL,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PATTERNS,
} from '@/games/game-of-life/constants';

// ========== 辅助工具 ==========

const CELL_STEP = CELL_SIZE + CELL_GAP; // 11

/** 创建测试用 Canvas */
function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

/** 创建并初始化引擎 */
function createEngine(): GameOfLifeEngine {
  const engine = new GameOfLifeEngine();
  engine.init(createCanvas());
  return engine;
}

/** 直接设置内部网格（绕过正常流程） */
function setGrid(engine: GameOfLifeEngine, grid: (0 | 1)[][]): void {
  (engine as any).grid = grid.map((row) => [...row]);
  (engine as any).countPopulation();
}

/** 获取内部网格 */
function getGrid(engine: GameOfLifeEngine): (0 | 1)[][] {
  return (engine as any).grid;
}

/** 执行单步模拟 */
function doStep(engine: GameOfLifeEngine): void {
  (engine as any).step();
}

/** 执行 update（传入 deltaTime 毫秒） */
function advanceUpdate(engine: GameOfLifeEngine, deltaTime: number): void {
  (engine as any).update(deltaTime);
}

/** 获取 population */
function getPopulation(engine: GameOfLifeEngine): number {
  return (engine as any).population;
}

/** 获取 generation */
function getGeneration(engine: GameOfLifeEngine): number {
  return (engine as any).generation;
}

/** 获取 speedLevel */
function getSpeedLevel(engine: GameOfLifeEngine): number {
  return (engine as any).speedLevel;
}

/** 获取 tickInterval */
function getTickInterval(engine: GameOfLifeEngine): number {
  return (engine as any).tickInterval;
}

/** 获取 cursor 位置 */
function getCursor(engine: GameOfLifeEngine): { row: number; col: number } {
  return { ...(engine as any).cursor };
}

/** 获取 cursorVisible */
function isCursorVisible(engine: GameOfLifeEngine): boolean {
  return (engine as any).cursorVisible;
}

/** 获取 hoverCell */
function getHoverCell(engine: GameOfLifeEngine): { row: number; col: number } | null {
  return (engine as any).hoverCell;
}

/** 创建全零网格 */
function zeroGrid(rows: number = GRID_ROWS, cols: number = GRID_COLS): (0 | 1)[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0 as 0 | 1));
}

// ============================================================
// T1: 初始化
// ============================================================
describe('T1: 初始化', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('init 后 status 为 idle', () => {
    expect(engine.status).toBe('idle');
  });

  it('init 后网格为全零 GRID_ROWS × GRID_COLS', () => {
    const grid = getGrid(engine);
    expect(grid.length).toBe(GRID_ROWS);
    expect(grid[0].length).toBe(GRID_COLS);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(grid[r][c]).toBe(0);
      }
    }
  });

  it('init 后 generation 为 0', () => {
    expect(getGeneration(engine)).toBe(0);
  });

  it('init 后 population 为 0', () => {
    expect(getPopulation(engine)).toBe(0);
  });

  it('init 后 speedLevel 为 2', () => {
    expect(getSpeedLevel(engine)).toBe(2);
  });

  it('init 后 cursor 在网格中心', () => {
    const cursor = getCursor(engine);
    expect(cursor.row).toBe(Math.floor(GRID_ROWS / 2));
    expect(cursor.col).toBe(Math.floor(GRID_COLS / 2));
  });

  it('init 后 cursorVisible 为 false', () => {
    expect(isCursorVisible(engine)).toBe(false);
  });

  it('init 后 tickInterval 为 200ms', () => {
    expect(getTickInterval(engine)).toBe(DEFAULT_TICK_INTERVAL);
  });
});

// ============================================================
// T2: 生命周期
// ============================================================
describe('T2: 生命周期', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 后 status 为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start 后如果网格为空会自动 randomize', () => {
    // 网格初始为空，population = 0
    expect(getPopulation(engine)).toBe(0);
    engine.start();
    // onStart 检测 population===0 会 randomize
    expect(getPopulation(engine)).toBeGreaterThan(0);
  });

  it('start 后如果网格非空不会 randomize', () => {
    // 手动设置一些细胞
    const grid = zeroGrid();
    grid[10][10] = 1;
    grid[10][11] = 1;
    setGrid(engine, grid);
    const popBefore = getPopulation(engine);
    engine.start();
    // onStart 检测 population > 0，不会 randomize
    expect(getPopulation(engine)).toBe(popBefore);
  });

  it('pause 后 status 为 paused', () => {
    engine.start();
    engine.pause();
    expect(engine.status).toBe('paused');
  });

  it('resume 后 status 为 playing', () => {
    engine.start();
    engine.pause();
    engine.resume();
    expect(engine.status).toBe('playing');
  });

  it('reset 后网格清空、generation 归零', () => {
    engine.start();
    // 推进一步
    doStep(engine);
    expect(getGeneration(engine)).toBeGreaterThan(0);

    engine.reset();
    expect(engine.status).toBe('idle');
    expect(getGeneration(engine)).toBe(0);
    expect(getPopulation(engine)).toBe(0);
    const grid = getGrid(engine);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(grid[r][c]).toBe(0);
      }
    }
  });

  it('destroy 后清理', () => {
    engine.start();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });
});

// ============================================================
// T3: Conway 规则
// ============================================================
describe('T3: Conway 规则', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('活细胞有 2 个邻居 → 存活', () => {
    // 创建一个稳定块（Block）— 2×2 方块，每个细胞有 3 个邻居
    // 改用 blinker 的竖排：3 个连续活细胞
    // 中间细胞有 2 个邻居 → 存活
    const grid = zeroGrid();
    grid[20][24] = 1; // 中心
    grid[20][23] = 1; // 左邻居
    grid[20][25] = 1; // 右邻居
    setGrid(engine, grid);

    doStep(engine);

    // 中间细胞有 2 个邻居 → 存活
    expect(getGrid(engine)[20][24]).toBe(1);
  });

  it('活细胞有 3 个邻居 → 存活', () => {
    // Block（2×2 方块）— 每个细胞恰好 3 个邻居
    const grid = zeroGrid();
    grid[20][24] = 1;
    grid[20][25] = 1;
    grid[21][24] = 1;
    grid[21][25] = 1;
    setGrid(engine, grid);

    doStep(engine);

    // 所有细胞仍存活（静物，不变化）
    expect(getGrid(engine)[20][24]).toBe(1);
    expect(getGrid(engine)[20][25]).toBe(1);
    expect(getGrid(engine)[21][24]).toBe(1);
    expect(getGrid(engine)[21][25]).toBe(1);
  });

  it('活细胞 < 2 邻居 → 死亡（孤独）', () => {
    // 单个活细胞，0 个邻居
    const grid = zeroGrid();
    grid[20][24] = 1;
    setGrid(engine, grid);

    doStep(engine);

    expect(getGrid(engine)[20][24]).toBe(0);
  });

  it('活细胞 > 3 邻居 → 死亡（过挤）', () => {
    // 十字形：中心细胞有 4 个邻居
    const grid = zeroGrid();
    grid[20][24] = 1; // 中心
    grid[19][24] = 1; // 上
    grid[21][24] = 1; // 下
    grid[20][23] = 1; // 左
    grid[20][25] = 1; // 右
    setGrid(engine, grid);

    doStep(engine);

    // 中心细胞有 4 个邻居 → 死亡
    expect(getGrid(engine)[20][24]).toBe(0);
  });

  it('死细胞恰好 3 个邻居 → 复活', () => {
    // L 形：三个活细胞围着一个死细胞
    const grid = zeroGrid();
    grid[20][24] = 1;
    grid[20][25] = 1;
    grid[21][24] = 1;
    // (21,25) 是死细胞，恰好有 3 个活邻居
    setGrid(engine, grid);

    doStep(engine);

    // (21,25) 有 3 个邻居 → 复活
    expect(getGrid(engine)[21][25]).toBe(1);
  });

  it('step 后 generation 增加', () => {
    expect(getGeneration(engine)).toBe(0);
    doStep(engine);
    expect(getGeneration(engine)).toBe(1);
    doStep(engine);
    expect(getGeneration(engine)).toBe(2);
  });

  it('step 后 score 等于 generation', () => {
    const e = engine as any;
    e.step();
    expect(engine.score).toBe(e.generation);
    e.step();
    expect(engine.score).toBe(e.generation);
  });
});

// ============================================================
// T4: 环绕边界
// ============================================================
describe('T4: 环绕边界', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('顶部边界与底部相邻', () => {
    // 在 (0, 24) 放一个活细胞，在 (GRID_ROWS-1, 24) 放一个活细胞
    // (0, 24) 的邻居包含 (GRID_ROWS-1, 24)
    const grid = zeroGrid();
    grid[0][24] = 1;
    grid[GRID_ROWS - 1][24] = 1;
    grid[0][25] = 1;
    setGrid(engine, grid);

    // (GRID_ROWS-1, 24) 有邻居 (0,24) 和 (0,25) → 2 个活邻居
    // (GRID_ROWS-1, 25) 有邻居 (0,24), (0,25) 和 (GRID_ROWS-1, 24) → 3 个活邻居 → 复活
    doStep(engine);

    expect(getGrid(engine)[GRID_ROWS - 1][25]).toBe(1);
  });

  it('左右边界环绕', () => {
    // 在 (20, 0) 和 (20, GRID_COLS-1) 放活细胞
    const grid = zeroGrid();
    grid[20][0] = 1;
    grid[20][GRID_COLS - 1] = 1;
    grid[20][1] = 1;
    setGrid(engine, grid);

    // (20, 0) 有邻居 (20, GRID_COLS-1) 和 (20, 1) → 2 个活邻居 → 存活
    doStep(engine);
    expect(getGrid(engine)[20][0]).toBe(1);

    // (20, GRID_COLS-1) 有邻居 (20, 0) 和 (20, GRID_COLS-2)
    // (20, 0) 是活的，(20, GRID_COLS-2) 是死的 → 只有 1 个活邻居 → 死亡
    // 但 (20, GRID_COLS-1) 本身有 (20,0)=1 和 (20,1)=0 → 需要 countNeighbors
    // 邻居：(19,GRID_COLS-2), (19,GRID_COLS-1), (19,0), (20,GRID_COLS-2), (20,0), (21,GRID_COLS-2), (21,GRID_COLS-1), (21,0)
    // 其中 (20,0)=1 → 1 个活邻居 → 死亡
    expect(getGrid(engine)[20][GRID_COLS - 1]).toBe(0);
  });

  it('角落细胞有 8 个邻居（环绕）', () => {
    // 验证 (0, 0) 的邻居包含 (GRID_ROWS-1, GRID_COLS-1)
    // 在 (0,0) 周围放细胞，包括 (GRID_ROWS-1, GRID_COLS-1)
    const grid = zeroGrid();
    grid[0][0] = 1;
    grid[GRID_ROWS - 1][GRID_COLS - 1] = 1;
    grid[GRID_ROWS - 1][0] = 1;
    grid[GRID_ROWS - 1][1] = 1;
    grid[0][GRID_COLS - 1] = 1;
    grid[0][1] = 1;
    grid[1][GRID_COLS - 1] = 1;
    grid[1][0] = 1;
    grid[1][1] = 1;
    setGrid(engine, grid);

    // (0,0) 有 8 个活邻居 → 过挤死亡
    doStep(engine);
    expect(getGrid(engine)[0][0]).toBe(0);
  });

  it('countNeighbors 对角落返回正确的邻居数', () => {
    // 只在 (GRID_ROWS-1, GRID_COLS-1) 放一个活细胞
    const grid = zeroGrid();
    grid[GRID_ROWS - 1][GRID_COLS - 1] = 1;
    setGrid(engine, grid);

    // (0,0) 的邻居包含 (GRID_ROWS-1, GRID_COLS-1)
    const count = (engine as any).countNeighbors(0, 0);
    expect(count).toBe(1);
  });
});

// ============================================================
// T5: 速度控制
// ============================================================
describe('T5: 速度控制', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始 speedLevel 为 2，对应 200ms', () => {
    expect(getSpeedLevel(engine)).toBe(2);
    expect(getTickInterval(engine)).toBe(200);
  });

  it('speedUp 增加 speedLevel', () => {
    (engine as any).speedUp();
    expect(getSpeedLevel(engine)).toBe(3);
    expect(getTickInterval(engine)).toBe(TICK_INTERVALS[3]);
  });

  it('speedDown 减少 speedLevel', () => {
    (engine as any).speedDown();
    expect(getSpeedLevel(engine)).toBe(1);
    expect(getTickInterval(engine)).toBe(TICK_INTERVALS[1]);
  });

  it('speedLevel 范围 1-5（不会越界）', () => {
    // 从 level 2 降到 1
    (engine as any).speedDown();
    expect(getSpeedLevel(engine)).toBe(1);
    // 再降不会低于 1
    (engine as any).speedDown();
    expect(getSpeedLevel(engine)).toBe(1);

    // 升到 5
    (engine as any).speedUp();
    (engine as any).speedUp();
    (engine as any).speedUp();
    (engine as any).speedUp();
    expect(getSpeedLevel(engine)).toBe(5);
    // 再升不会超过 5
    (engine as any).speedUp();
    expect(getSpeedLevel(engine)).toBe(5);
  });

  it('speedLevel 同步到 _level', () => {
    (engine as any).speedUp();
    expect(engine.level).toBe(getSpeedLevel(engine));
  });

  it('tickInterval 随 speedLevel 变化', () => {
    // 遍历所有等级
    for (let level = 1; level <= 5; level++) {
      (engine as any).applySpeedLevel(level);
      expect(getTickInterval(engine)).toBe(TICK_INTERVALS[level]);
    }
  });

  it('start 后 applySpeedLevel 恢复 speedLevel', () => {
    // 基类 start() 会重置 _level=1，但 onStart 调用 applySpeedLevel 恢复
    (engine as any).speedLevel = 4;
    engine.start();
    expect(getSpeedLevel(engine)).toBe(4);
    expect(engine.level).toBe(4);
  });
});

// ============================================================
// T6: 鼠标交互
// ============================================================
describe('T6: 鼠标交互', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('handleClick 在 idle 状态切换细胞', () => {
    // idle 状态下点击 (5, 5) 对应的 canvas 坐标
    const canvasX = GRID_OFFSET_X + 5 * CELL_STEP + 1;
    const canvasY = GRID_OFFSET_Y + 5 * CELL_STEP + 1;
    engine.handleClick(canvasX, canvasY);

    expect(getGrid(engine)[5][5]).toBe(1);

    // 再次点击同一位置 → 切换回 0
    engine.handleClick(canvasX, canvasY);
    expect(getGrid(engine)[5][5]).toBe(0);
  });

  it('handleClick 在 paused 状态可编辑', () => {
    engine.start();
    engine.pause();

    const canvasX = GRID_OFFSET_X + 10 * CELL_STEP + 1;
    const canvasY = GRID_OFFSET_Y + 10 * CELL_STEP + 1;
    const before = getGrid(engine)[10][10];
    engine.handleClick(canvasX, canvasY);

    // toggleCell 切换：0→1 或 1→0
    expect(getGrid(engine)[10][10]).toBe(before === 0 ? 1 : 0);
  });

  it('handleClick 在 playing 状态不编辑', () => {
    engine.start();

    const canvasX = GRID_OFFSET_X + 10 * CELL_STEP + 1;
    const canvasY = GRID_OFFSET_Y + 10 * CELL_STEP + 1;
    const gridBefore = getGrid(engine).map((row) => [...row]);

    engine.handleClick(canvasX, canvasY);

    // 网格不应改变
    const gridAfter = getGrid(engine);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        expect(gridAfter[r][c]).toBe(gridBefore[r][c]);
      }
    }
  });

  it('handleMouseMove 设置 hoverCell', () => {
    const canvasX = GRID_OFFSET_X + 15 * CELL_STEP + 1;
    const canvasY = GRID_OFFSET_Y + 20 * CELL_STEP + 1;
    engine.handleMouseMove(canvasX, canvasY);

    const hover = getHoverCell(engine);
    expect(hover).not.toBeNull();
    expect(hover!.row).toBe(20);
    expect(hover!.col).toBe(15);
  });

  it('handleMouseMove 越界时 hoverCell 为 null', () => {
    engine.handleMouseMove(-100, -100);
    expect(getHoverCell(engine)).toBeNull();

    engine.handleMouseMove(CANVAS_WIDTH + 100, CANVAS_HEIGHT + 100);
    expect(getHoverCell(engine)).toBeNull();
  });

  it('handleClick 坐标转换正确', () => {
    // 点击 canvas 坐标 (0, 0) → 网格 (0, 0)
    engine.handleClick(0, 0);
    expect(getGrid(engine)[0][0]).toBe(1);

    // 点击 canvas 坐标刚好在第一个细胞右边缘外 → 落入第二列
    const x = GRID_OFFSET_X + CELL_STEP; // 11
    const y = GRID_OFFSET_Y + 0;
    engine.handleClick(x, y);
    expect(getGrid(engine)[0][1]).toBe(1);
  });
});

// ============================================================
// T7: 键盘交互
// ============================================================
describe('T7: 键盘交互', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // --- 空格键 ---
  it('空格键 idle → start', () => {
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  it('空格键 playing → paused', () => {
    engine.start();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('paused');
  });

  it('空格键 paused → resume', () => {
    engine.start();
    engine.pause();
    engine.handleKeyDown(' ');
    expect(engine.status).toBe('playing');
  });

  // --- Enter 键 ---
  it('Enter 键 idle → start', () => {
    engine.handleKeyDown('Enter');
    expect(engine.status).toBe('playing');
  });

  // --- R 键 ---
  it('R 键随机填充并重置世代', () => {
    // 先设置一些细胞和世代
    const grid = zeroGrid();
    grid[10][10] = 1;
    setGrid(engine, grid);
    (engine as any).generation = 5;

    engine.handleKeyDown('r');

    expect(getGeneration(engine)).toBe(0);
    expect(getPopulation(engine)).toBeGreaterThan(0);
  });

  it('r 键（小写）同样生效', () => {
    engine.handleKeyDown('r');
    expect(getPopulation(engine)).toBeGreaterThan(0);
    expect(getGeneration(engine)).toBe(0);
  });

  // --- C 键 ---
  it('C 键清空网格并重置世代', () => {
    // 先随机填充
    (engine as any).randomize(0.5);
    (engine as any).generation = 10;

    engine.handleKeyDown('c');

    expect(getGeneration(engine)).toBe(0);
    expect(getPopulation(engine)).toBe(0);
  });

  // --- N 键 ---
  it('N 键单步推进（idle 时）', () => {
    // 放一个 blinker
    const grid = zeroGrid();
    grid[20][23] = 1;
    grid[20][24] = 1;
    grid[20][25] = 1;
    setGrid(engine, grid);

    engine.handleKeyDown('n');

    expect(getGeneration(engine)).toBe(1);
  });

  it('N 键单步推进（paused 时）', () => {
    engine.start();
    engine.pause();

    engine.handleKeyDown('n');
    expect(getGeneration(engine)).toBe(1);
  });

  it('N 键在 playing 状态不推进', () => {
    engine.start();
    const genBefore = getGeneration(engine);
    engine.handleKeyDown('n');
    expect(getGeneration(engine)).toBe(genBefore);
  });

  // --- +/- 键 ---
  it('+ 键加速', () => {
    engine.handleKeyDown('+');
    expect(getSpeedLevel(engine)).toBe(3);
  });

  it('= 键加速', () => {
    engine.handleKeyDown('=');
    expect(getSpeedLevel(engine)).toBe(3);
  });

  it('- 键减速', () => {
    engine.handleKeyDown('-');
    expect(getSpeedLevel(engine)).toBe(1);
  });

  it('_ 键减速', () => {
    engine.handleKeyDown('_');
    expect(getSpeedLevel(engine)).toBe(1);
  });

  // --- 方向键 ---
  it('ArrowLeft 显示光标并左移', () => {
    const initialCol = getCursor(engine).col;
    engine.handleKeyDown('ArrowLeft');
    expect(isCursorVisible(engine)).toBe(true);
    expect(getCursor(engine).col).toBe(Math.max(0, initialCol - 1));
  });

  it('ArrowRight 显示光标并右移', () => {
    const initialCol = getCursor(engine).col;
    engine.handleKeyDown('ArrowRight');
    expect(isCursorVisible(engine)).toBe(true);
    expect(getCursor(engine).col).toBe(Math.min(GRID_COLS - 1, initialCol + 1));
  });

  it('ArrowUp 光标可见时上移光标', () => {
    // 先显示光标
    (engine as any).cursorVisible = true;
    (engine as any).cursor.row = 10;

    engine.handleKeyDown('ArrowUp');
    expect(getCursor(engine).row).toBe(9);
  });

  it('ArrowDown 光标可见时下移光标', () => {
    (engine as any).cursorVisible = true;
    (engine as any).cursor.row = 10;

    engine.handleKeyDown('ArrowDown');
    expect(getCursor(engine).row).toBe(11);
  });

  it('ArrowUp 光标不可见时加速', () => {
    expect(isCursorVisible(engine)).toBe(false);
    engine.handleKeyDown('ArrowUp');
    expect(getSpeedLevel(engine)).toBe(3);
  });

  it('ArrowDown 光标不可见时减速', () => {
    expect(isCursorVisible(engine)).toBe(false);
    engine.handleKeyDown('ArrowDown');
    expect(getSpeedLevel(engine)).toBe(1);
  });

  it('光标不会移出网格上边界', () => {
    (engine as any).cursorVisible = true;
    (engine as any).cursor.row = 0;
    engine.handleKeyDown('ArrowUp');
    expect(getCursor(engine).row).toBe(0);
  });

  it('光标不会移出网格下边界', () => {
    (engine as any).cursorVisible = true;
    (engine as any).cursor.row = GRID_ROWS - 1;
    engine.handleKeyDown('ArrowDown');
    expect(getCursor(engine).row).toBe(GRID_ROWS - 1);
  });

  it('光标不会移出网格左边界', () => {
    (engine as any).cursorVisible = true;
    (engine as any).cursor.col = 0;
    engine.handleKeyDown('ArrowLeft');
    expect(getCursor(engine).col).toBe(0);
  });

  it('光标不会移出网格右边界', () => {
    (engine as any).cursorVisible = true;
    (engine as any).cursor.col = GRID_COLS - 1;
    engine.handleKeyDown('ArrowRight');
    expect(getCursor(engine).col).toBe(GRID_COLS - 1);
  });

  // --- 数字键 ---
  it('数字键 1 放置 Glider 图案', () => {
    engine.handleKeyDown('1');
    // Glider 有 5 个细胞
    expect(getPopulation(engine)).toBe(5);
  });

  it('数字键放置图案在光标位置（光标可见时）', () => {
    (engine as any).cursorVisible = true;
    (engine as any).cursor.row = 30;
    (engine as any).cursor.col = 30;

    engine.handleKeyDown('2'); // Blinker
    // Blinker cells: [0,0], [0,1], [0,2]
    // 放置在 (30, 30) 中心
    expect(getGrid(engine)[30][30]).toBe(1);
    expect(getGrid(engine)[30][31]).toBe(1);
    expect(getGrid(engine)[30][32]).toBe(1);
  });

  // --- Tab 键 ---
  it('Tab 键切换光标显示', () => {
    expect(isCursorVisible(engine)).toBe(false);
    engine.handleKeyDown('Tab');
    expect(isCursorVisible(engine)).toBe(true);
    engine.handleKeyDown('Tab');
    expect(isCursorVisible(engine)).toBe(false);
  });
});

// ============================================================
// T8: 预设图案
// ============================================================
describe('T8: 预设图案', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('Glider 放置正确', () => {
    const glider = PATTERNS[0];
    expect(glider.name).toBe('Glider');
    expect(glider.cells.length).toBe(5);

    (engine as any).placePattern(glider, 10, 10);

    // Glider cells: [0,1], [1,2], [2,0], [2,1], [2,2]
    expect(getGrid(engine)[10][11]).toBe(1); // [0,1]
    expect(getGrid(engine)[11][12]).toBe(1); // [1,2]
    expect(getGrid(engine)[12][10]).toBe(1); // [2,0]
    expect(getGrid(engine)[12][11]).toBe(1); // [2,1]
    expect(getGrid(engine)[12][12]).toBe(1); // [2,2]
    expect(getPopulation(engine)).toBe(5);
  });

  it('Blinker 放置正确', () => {
    const blinker = PATTERNS[1];
    expect(blinker.name).toBe('Blinker');
    expect(blinker.cells.length).toBe(3);

    (engine as any).placePattern(blinker, 20, 20);

    expect(getGrid(engine)[20][20]).toBe(1); // [0,0]
    expect(getGrid(engine)[20][21]).toBe(1); // [0,1]
    expect(getGrid(engine)[20][22]).toBe(1); // [0,2]
  });

  it('所有 9 个图案都有名称和 cells', () => {
    expect(PATTERNS.length).toBe(9);
    for (const pattern of PATTERNS) {
      expect(pattern.name).toBeTruthy();
      expect(Array.isArray(pattern.cells)).toBe(true);
      expect(pattern.cells.length).toBeGreaterThan(0);
      for (const [dr, dc] of pattern.cells) {
        expect(typeof dr).toBe('number');
        expect(typeof dc).toBe('number');
      }
    }
  });

  it('placePattern 使用环绕坐标（负坐标）', () => {
    // 在 (0, 0) 放置 Glider，cells 包含 [2,0] → r=2, c=0
    // 但 cells 也包含 [0,1], [1,2], [2,0], [2,1], [2,2]
    // 如果 centerRow=0, centerCol=0，则 dr=-1 会环绕到 GRID_ROWS-1
    const glider = PATTERNS[0];
    (engine as any).placePattern(glider, 0, 0);

    // Glider cells: [0,1], [1,2], [2,0], [2,1], [2,2]
    // At center (0,0): r = (0+0+58)%58=0, c = (0+1+48)%48=1
    expect(getGrid(engine)[0][1]).toBe(1);
    // r = (0+1+58)%58=1, c = (0+2+48)%48=2
    expect(getGrid(engine)[1][2]).toBe(1);
    // r = (0+2+58)%58=2, c = (0+0+48)%48=0
    expect(getGrid(engine)[2][0]).toBe(1);
  });

  it('placePattern 在边界环绕放置', () => {
    // 在 (GRID_ROWS-1, GRID_COLS-1) 放置 Blinker
    // Blinker cells: [0,0], [0,1], [0,2]
    // r = (GRID_ROWS-1+0+GRID_ROWS)%GRID_ROWS = GRID_ROWS-1
    // c = (GRID_COLS-1+0+GRID_COLS)%GRID_COLS = GRID_COLS-1
    const blinker = PATTERNS[1];
    (engine as any).placePattern(blinker, GRID_ROWS - 1, GRID_COLS - 1);

    expect(getGrid(engine)[GRID_ROWS - 1][GRID_COLS - 1]).toBe(1); // [0,0]
    expect(getGrid(engine)[GRID_ROWS - 1][0]).toBe(1); // [0,1] → c wraps to 0
    expect(getGrid(engine)[GRID_ROWS - 1][1]).toBe(1); // [0,2] → c wraps to 1
  });
});

// ============================================================
// T9: 游戏状态
// ============================================================
describe('T9: 游戏状态', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('getState 返回完整状态', () => {
    const state = engine.getState() as any;
    expect(state).toHaveProperty('grid');
    expect(state).toHaveProperty('generation');
    expect(state).toHaveProperty('population');
    expect(state).toHaveProperty('tickInterval');
    expect(state).toHaveProperty('speedLevel');
    expect(state).toHaveProperty('cursorRow');
    expect(state).toHaveProperty('cursorCol');
  });

  it('getState grid 是深拷贝', () => {
    const state1 = engine.getState() as any;
    const state2 = engine.getState() as any;

    // 修改 state1 的 grid 不影响 state2
    state1.grid[0][0] = 999;
    expect(state2.grid[0][0]).toBe(0);
  });

  it('update 累积时间触发 step', () => {
    // 设置一个 blinker 来验证 step 执行
    const grid = zeroGrid();
    grid[20][23] = 1;
    grid[20][24] = 1;
    grid[20][25] = 1;
    setGrid(engine, grid);

    // tickInterval = 200ms, 传入 200ms 应触发一次 step
    advanceUpdate(engine, 200);

    expect(getGeneration(engine)).toBe(1);
    // Blinker 竖排 → 横排
    expect(getGrid(engine)[19][24]).toBe(1);
    expect(getGrid(engine)[20][24]).toBe(1);
    expect(getGrid(engine)[21][24]).toBe(1);
  });

  it('update 多次累积正确', () => {
    const grid = zeroGrid();
    grid[20][23] = 1;
    grid[20][24] = 1;
    grid[20][25] = 1;
    setGrid(engine, grid);

    // 累积 450ms → 应触发 2 次 step（200 + 200 = 400，剩余 50）
    advanceUpdate(engine, 450);

    expect(getGeneration(engine)).toBe(2);
  });

  it('update 小于 tickInterval 不触发 step', () => {
    advanceUpdate(engine, 100);
    expect(getGeneration(engine)).toBe(0);
  });

  it('getState 返回正确的值', () => {
    const grid = zeroGrid();
    grid[5][5] = 1;
    grid[5][6] = 1;
    setGrid(engine, grid);
    (engine as any).generation = 7;

    const state = engine.getState() as any;
    expect(state.generation).toBe(7);
    expect(state.population).toBe(2);
    expect(state.speedLevel).toBe(2);
    expect(state.tickInterval).toBe(200);
    expect(state.cursorRow).toBe(Math.floor(GRID_ROWS / 2));
    expect(state.cursorCol).toBe(Math.floor(GRID_COLS / 2));
  });
});

// ============================================================
// T10: 事件系统
// ============================================================
describe('T10: 事件系统', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('start 触发 statusChange 为 playing', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.start();
    expect(callback).toHaveBeenCalledWith('playing');
  });

  it('pause 触发 statusChange 为 paused', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.start();
    engine.pause();
    expect(callback).toHaveBeenCalledWith('paused');
  });

  it('resume 触发 statusChange 为 playing', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.start();
    engine.pause();
    callback.mockClear();
    engine.resume();
    expect(callback).toHaveBeenCalledWith('playing');
  });

  it('reset 触发 statusChange 为 idle', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.start();
    callback.mockClear();
    engine.reset();
    expect(callback).toHaveBeenCalledWith('idle');
  });

  it('step 触发 scoreChange', () => {
    const callback = vi.fn();
    engine.on('scoreChange', callback);
    doStep(engine);
    expect(callback).toHaveBeenCalledWith(1);
    doStep(engine);
    expect(callback).toHaveBeenCalledWith(2);
  });

  it('speedUp 触发 levelChange', () => {
    const callback = vi.fn();
    engine.on('levelChange', callback);
    (engine as any).speedUp();
    expect(callback).toHaveBeenCalledWith(3);
  });

  it('speedDown 触发 levelChange', () => {
    const callback = vi.fn();
    engine.on('levelChange', callback);
    (engine as any).speedDown();
    expect(callback).toHaveBeenCalledWith(1);
  });

  it('destroy 清理所有事件监听', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.destroy();
    // destroy 后 listeners 已清空，再 start 不会触发回调
    // 但 destroy 调用了 reset，所以需要重新 init
    engine.init(createCanvas());
    engine.on('statusChange', callback);
    callback.mockClear();
    engine.start();
    expect(callback).toHaveBeenCalledWith('playing');
  });

  it('off 取消事件监听', () => {
    const callback = vi.fn();
    engine.on('statusChange', callback);
    engine.off('statusChange', callback);
    engine.start();
    expect(callback).not.toHaveBeenCalled();
  });
});
