import { describe, it, expect, beforeEach } from "vitest";
import { LightsOutEngine } from "../LightsOutEngine";
import { GRID_SIZE, GRID_CELLS, LEVEL_CONFIGS, MAX_LEVEL } from "../constants";

// ========== 辅助工具 ==========

function createEngine(): LightsOutEngine {
  const engine = new LightsOutEngine();
  engine.init();
  return engine;
}

function startEngine(): LightsOutEngine {
  const engine = createEngine();
  // 模拟 start() 但不依赖 canvas
  (engine as any)._status = "playing";
  engine["generatePuzzle"]();
  return engine;
}

function countLights(grid: boolean[][]): number {
  return grid.flat().filter(Boolean).length;
}

function allOff(grid: boolean[][]): boolean {
  return grid.every((row) => row.every((cell) => !cell));
}

function makeGrid(pattern: number[][]): boolean[][] {
  return pattern.map((row) => row.map((v) => v === 1));
}

function setPlaying(engine: LightsOutEngine): void {
  (engine as any)._status = "playing";
}

// ========== 1. 构造与初始化 ==========

describe("构造与初始化", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("创建实例不抛错", () => {
    expect(() => new LightsOutEngine()).not.toThrow();
  });

  it("初始化后状态为 idle", () => {
    expect(engine.status).toBe("idle");
  });

  it("初始分数为 0", () => {
    expect(engine.score).toBe(0);
  });

  it("初始等级为 1", () => {
    expect(engine.level).toBe(1);
  });

  it("初始网格为 5x5", () => {
    const grid = engine.getGrid();
    expect(grid).toHaveLength(5);
    expect(grid[0]).toHaveLength(5);
  });

  it("初始所有灯灭", () => {
    const grid = engine.getGrid();
    expect(allOff(grid)).toBe(true);
  });

  it("初始光标在中心 (2,2)", () => {
    const cursor = engine.getCursor();
    expect(cursor).toEqual({ row: 2, col: 2 });
  });

  it("初始步数为 0", () => {
    expect(engine.getSteps()).toBe(0);
  });

  it("初始最优步数为 0", () => {
    expect(engine.getOptimalSteps()).toBe(0);
  });
});

// ========== 2. getGrid ==========

describe("getGrid", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("返回 5x5 布尔数组", () => {
    const grid = engine.getGrid();
    expect(grid).toHaveLength(5);
    for (const row of grid) {
      expect(row).toHaveLength(5);
      for (const cell of row) {
        expect(typeof cell).toBe("boolean");
      }
    }
  });

  it("返回副本，修改不影响原数据", () => {
    const grid1 = engine.getGrid();
    grid1[0][0] = true;
    const grid2 = engine.getGrid();
    expect(grid2[0][0]).toBe(false);
  });

  it("初始全为 false", () => {
    const grid = engine.getGrid();
    expect(grid.flat().every((v) => v === false)).toBe(true);
  });

  it("翻转后反映正确状态", () => {
    setPlaying(engine);
    engine.toggle(2, 2);
    const grid = engine.getGrid();
    expect(grid[2][2]).toBe(true);
  });
});

// ========== 3. getCursor ==========

describe("getCursor", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("返回 {row, col} 对象", () => {
    const cursor = engine.getCursor();
    expect(cursor).toHaveProperty("row");
    expect(cursor).toHaveProperty("col");
    expect(typeof cursor.row).toBe("number");
    expect(typeof cursor.col).toBe("number");
  });

  it("返回副本，修改不影响原数据", () => {
    const cursor1 = engine.getCursor();
    cursor1.row = 0;
    const cursor2 = engine.getCursor();
    expect(cursor2.row).toBe(2);
  });

  it("移动后反映新位置", () => {
    engine.moveCursor(-1, 0);
    expect(engine.getCursor()).toEqual({ row: 1, col: 2 });
  });
});

// ========== 4. toggle - 中心格 ==========

describe("toggle - 中心格", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
    setPlaying(engine);
  });

  it("翻转中心格影响 5 个格子（自身+4邻居）", () => {
    engine.toggle(2, 2);
    const grid = engine.getGrid();
    const affected = [
      [1, 2],
      [2, 1],
      [2, 2],
      [2, 3],
      [3, 2],
    ];
    for (const [r, c] of affected) {
      expect(grid[r][c]).toBe(true);
    }
    expect(countLights(grid)).toBe(5);
  });

  it("翻转中心格不影响对角格", () => {
    engine.toggle(2, 2);
    const grid = engine.getGrid();
    expect(grid[1][1]).toBe(false);
    expect(grid[1][3]).toBe(false);
    expect(grid[3][1]).toBe(false);
    expect(grid[3][3]).toBe(false);
  });

  it("同一格翻转两次恢复原状", () => {
    const original = engine.getGrid();
    engine.toggle(2, 2);
    engine.toggle(2, 2);
    expect(engine.getGrid()).toEqual(original);
  });

  it("翻转增加步数", () => {
    engine.toggle(2, 2);
    expect(engine.getSteps()).toBe(1);
    engine.toggle(2, 2);
    expect(engine.getSteps()).toBe(2);
  });
});

// ========== 5. toggle - 四角格 ==========

describe("toggle - 四角格", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
    setPlaying(engine);
  });

  it("左上角 (0,0) 影响 3 格", () => {
    engine.toggle(0, 0);
    const grid = engine.getGrid();
    expect(grid[0][0]).toBe(true);
    expect(grid[0][1]).toBe(true);
    expect(grid[1][0]).toBe(true);
    expect(countLights(grid)).toBe(3);
  });

  it("右上角 (0,4) 影响 3 格", () => {
    engine.toggle(0, 4);
    const grid = engine.getGrid();
    expect(grid[0][4]).toBe(true);
    expect(grid[0][3]).toBe(true);
    expect(grid[1][4]).toBe(true);
    expect(countLights(grid)).toBe(3);
  });

  it("左下角 (4,0) 影响 3 格", () => {
    engine.toggle(4, 0);
    const grid = engine.getGrid();
    expect(grid[4][0]).toBe(true);
    expect(grid[3][0]).toBe(true);
    expect(grid[4][1]).toBe(true);
    expect(countLights(grid)).toBe(3);
  });

  it("右下角 (4,4) 影响 3 格", () => {
    engine.toggle(4, 4);
    const grid = engine.getGrid();
    expect(grid[4][4]).toBe(true);
    expect(grid[3][4]).toBe(true);
    expect(grid[4][3]).toBe(true);
    expect(countLights(grid)).toBe(3);
  });

  it("四角各翻一次共 12 个亮灯（无重叠）", () => {
    engine.toggle(0, 0);
    engine.toggle(0, 4);
    engine.toggle(4, 0);
    engine.toggle(4, 4);
    expect(countLights(engine.getGrid())).toBe(12);
  });

  it("角落翻转两次恢复", () => {
    engine.toggle(0, 0);
    engine.toggle(0, 0);
    expect(allOff(engine.getGrid())).toBe(true);
  });
});

// ========== 6. toggle - 边缘格 ==========

describe("toggle - 边缘格", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
    setPlaying(engine);
  });

  it("上边缘 (0,2) 影响 4 格", () => {
    engine.toggle(0, 2);
    const grid = engine.getGrid();
    expect(grid[0][2]).toBe(true);
    expect(grid[0][1]).toBe(true);
    expect(grid[0][3]).toBe(true);
    expect(grid[1][2]).toBe(true);
    expect(countLights(grid)).toBe(4);
  });

  it("左边缘 (2,0) 影响 4 格", () => {
    engine.toggle(2, 0);
    const grid = engine.getGrid();
    expect(grid[2][0]).toBe(true);
    expect(grid[1][0]).toBe(true);
    expect(grid[3][0]).toBe(true);
    expect(grid[2][1]).toBe(true);
    expect(countLights(grid)).toBe(4);
  });

  it("下边缘 (4,2) 影响 4 格", () => {
    engine.toggle(4, 2);
    const grid = engine.getGrid();
    expect(grid[4][2]).toBe(true);
    expect(grid[4][1]).toBe(true);
    expect(grid[4][3]).toBe(true);
    expect(grid[3][2]).toBe(true);
    expect(countLights(grid)).toBe(4);
  });

  it("右边缘 (2,4) 影响 4 格", () => {
    engine.toggle(2, 4);
    const grid = engine.getGrid();
    expect(grid[2][4]).toBe(true);
    expect(grid[1][4]).toBe(true);
    expect(grid[3][4]).toBe(true);
    expect(grid[2][3]).toBe(true);
    expect(countLights(grid)).toBe(4);
  });

  it("边缘格翻转两次恢复", () => {
    engine.toggle(0, 2);
    engine.toggle(0, 2);
    expect(allOff(engine.getGrid())).toBe(true);
  });
});

// ========== 7. toggle - 边界检查 ==========

describe("toggle - 边界与非法参数", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
    setPlaying(engine);
  });

  it("负行号不抛错", () => {
    expect(() => engine.toggle(-1, 0)).not.toThrow();
  });

  it("负列号不抛错", () => {
    expect(() => engine.toggle(0, -1)).not.toThrow();
  });

  it("超出范围的行号不抛错", () => {
    expect(() => engine.toggle(5, 0)).not.toThrow();
  });

  it("超出范围的列号不抛错", () => {
    expect(() => engine.toggle(0, 5)).not.toThrow();
  });

  it("非法参数不改变网格", () => {
    const before = engine.getGrid();
    engine.toggle(-1, -1);
    engine.toggle(5, 5);
    engine.toggle(10, 10);
    expect(engine.getGrid()).toEqual(before);
  });

  it("非法参数不增加步数", () => {
    engine.toggle(-1, 0);
    engine.toggle(0, 5);
    expect(engine.getSteps()).toBe(0);
  });
});

// ========== 8. isSolved ==========

describe("isSolved", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("全灭返回 true", () => {
    expect(engine.isSolved()).toBe(true);
  });

  it("一盏灯亮返回 false", () => {
    engine.setGrid(makeGrid([[1, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]));
    expect(engine.isSolved()).toBe(false);
  });

  it("所有灯亮返回 false", () => {
    engine.setGrid(makeGrid([[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [1, 1, 1, 1, 1]]));
    expect(engine.isSolved()).toBe(false);
  });

  it("翻转后可解", () => {
    setPlaying(engine);
    engine.toggle(2, 2);
    expect(engine.isSolved()).toBe(false);
    engine.toggle(2, 2);
    expect(engine.isSolved()).toBe(true);
  });

  it("棋盘模式不解决", () => {
    engine.setGrid(
      makeGrid([
        [1, 0, 1, 0, 1],
        [0, 1, 0, 1, 0],
        [1, 0, 1, 0, 1],
        [0, 1, 0, 1, 0],
        [1, 0, 1, 0, 1],
      ]),
    );
    expect(engine.isSolved()).toBe(false);
  });
});

// ========== 9. moveCursor ==========

describe("moveCursor", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("向上移动 row 减 1", () => {
    engine.moveCursor(-1, 0);
    expect(engine.getCursor().row).toBe(1);
  });

  it("向下移动 row 加 1", () => {
    engine.moveCursor(1, 0);
    expect(engine.getCursor().row).toBe(3);
  });

  it("向左移动 col 减 1", () => {
    engine.moveCursor(0, -1);
    expect(engine.getCursor().col).toBe(1);
  });

  it("向右移动 col 加 1", () => {
    engine.moveCursor(0, 1);
    expect(engine.getCursor().col).toBe(3);
  });

  it("上边界不超出", () => {
    engine.moveCursor(0, -2); // col=0
    engine.moveCursor(-1, 0); // row=1
    engine.moveCursor(-1, 0); // row=0
    engine.moveCursor(-1, 0); // 保持 row=0
    expect(engine.getCursor().row).toBe(0);
  });

  it("下边界不超出", () => {
    engine.moveCursor(0, 2); // col=4
    engine.moveCursor(1, 0); // row=3
    engine.moveCursor(1, 0); // row=4
    engine.moveCursor(1, 0); // 保持 row=4
    expect(engine.getCursor().row).toBe(4);
  });

  it("左边界不超出", () => {
    engine.moveCursor(-2, 0); // row=0
    engine.moveCursor(0, -1); // col=1
    engine.moveCursor(0, -1); // col=0
    engine.moveCursor(0, -1); // 保持 col=0
    expect(engine.getCursor().col).toBe(0);
  });

  it("右边界不超出", () => {
    engine.moveCursor(0, 2); // col=4
    engine.moveCursor(0, 1); // 保持 col=4
    expect(engine.getCursor().col).toBe(4);
  });

  it("对角移动（先上后右）", () => {
    engine.moveCursor(-1, 0);
    engine.moveCursor(0, 1);
    expect(engine.getCursor()).toEqual({ row: 1, col: 3 });
  });

  it("移动到 (0,0)", () => {
    engine.moveCursor(-2, 0);
    engine.moveCursor(0, -2);
    expect(engine.getCursor()).toEqual({ row: 0, col: 0 });
  });

  it("移动到 (4,4)", () => {
    engine.moveCursor(2, 0);
    engine.moveCursor(0, 2);
    expect(engine.getCursor()).toEqual({ row: 4, col: 4 });
  });
});

// ========== 10. GF(2) 高斯消元求解 ==========

describe("solveOptimal - GF(2) 求解", () => {
  it("全灭最优步数为 0", () => {
    const grid = makeGrid([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    expect(LightsOutEngine.solveOptimal(grid).size).toBe(0);
  });

  it("仅中心亮，最优 1 步", () => {
    const grid = makeGrid([
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    expect(LightsOutEngine.solveOptimal(grid).size).toBe(1);
  });

  it("解包含正确的格子索引", () => {
    // 只有 (2,2) 被翻转时产生十字形
    const grid = makeGrid([
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const solution = LightsOutEngine.solveOptimal(grid);
    expect(solution.has(2 * 5 + 2)).toBe(true); // index 12
  });

  it("仅左上角亮，最优 1 步", () => {
    // 翻转 (0,0) 产生 (0,0),(0,1),(1,0) 三个亮灯
    const grid = makeGrid([
      [1, 1, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    expect(LightsOutEngine.solveOptimal(grid).size).toBe(1);
    expect(LightsOutEngine.solveOptimal(grid).has(0)).toBe(true);
  });

  it("两步翻转最优不超过 2 步", () => {
    // 分别翻转 (0,0) 和 (4,4)，无重叠
    const grid = makeGrid([
      [1, 1, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1],
      [0, 0, 0, 1, 1],
    ]);
    const solution = LightsOutEngine.solveOptimal(grid);
    // 最优解最多 2 步（可能存在更短的等价解）
    expect(solution.size).toBeLessThanOrEqual(2);
    // 解确实能熄灭所有灯
    const testGrid = grid.map((row) => [...row]);
    for (const idx of solution) {
      const r = Math.floor(idx / GRID_SIZE);
      const c = idx % GRID_SIZE;
      const neighbors = [[r, c]];
      if (r > 0) neighbors.push([r - 1, c]);
      if (r < GRID_SIZE - 1) neighbors.push([r + 1, c]);
      if (c > 0) neighbors.push([r, c - 1]);
      if (c < GRID_SIZE - 1) neighbors.push([r, c + 1]);
      for (const [nr, nc] of neighbors) {
        testGrid[nr][nc] = !testGrid[nr][nc];
      }
    }
    expect(allOff(testGrid)).toBe(true);
  });

  it("翻转两次同一格 = 0 步（抵消）", () => {
    // (2,2) 翻转两次回到全灭
    const grid = makeGrid([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    expect(LightsOutEngine.solveOptimal(grid).size).toBe(0);
  });

  it("求解后应用解确实熄灭所有灯", () => {
    // 创建一个随机网格
    const grid = makeGrid([
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 1, 0, 1],
    ]);
    const solution = LightsOutEngine.solveOptimal(grid);

    // 应用解
    const testGrid = grid.map((row) => [...row]);
    for (const idx of solution) {
      const r = Math.floor(idx / GRID_SIZE);
      const c = idx % GRID_SIZE;
      const neighbors = [[r, c]];
      if (r > 0) neighbors.push([r - 1, c]);
      if (r < GRID_SIZE - 1) neighbors.push([r + 1, c]);
      if (c > 0) neighbors.push([r, c - 1]);
      if (c < GRID_SIZE - 1) neighbors.push([r, c + 1]);
      for (const [nr, nc] of neighbors) {
        testGrid[nr][nc] = !testGrid[nr][nc];
      }
    }

    expect(allOff(testGrid)).toBe(true);
  });

  it("全亮网格可解", () => {
    const grid = makeGrid([
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
    ]);
    const solution = LightsOutEngine.solveOptimal(grid);
    expect(solution.size).toBeGreaterThan(0);
  });

  it("应用全亮的解确实熄灭", () => {
    const grid = makeGrid([
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
    ]);
    const solution = LightsOutEngine.solveOptimal(grid);
    const testGrid = grid.map((row) => [...row]);
    for (const idx of solution) {
      const r = Math.floor(idx / GRID_SIZE);
      const c = idx % GRID_SIZE;
      const neighbors = [[r, c]];
      if (r > 0) neighbors.push([r - 1, c]);
      if (r < GRID_SIZE - 1) neighbors.push([r + 1, c]);
      if (c > 0) neighbors.push([r, c - 1]);
      if (c < GRID_SIZE - 1) neighbors.push([r, c + 1]);
      for (const [nr, nc] of neighbors) {
        testGrid[nr][nc] = !testGrid[nr][nc];
      }
    }
    expect(allOff(testGrid)).toBe(true);
  });
});

// ========== 11. 谜题生成 ==========

describe("generatePuzzle", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
    setPlaying(engine);
  });

  it("生成后网格非全灭", () => {
    engine.generatePuzzle();
    expect(allOff(engine.getGrid())).toBe(false);
  });

  it("生成后步数重置为 0", () => {
    engine.toggle(0, 0); // 产生一些步数
    engine.generatePuzzle();
    expect(engine.getSteps()).toBe(0);
  });

  it("生成后最优步数 > 0", () => {
    engine.generatePuzzle();
    expect(engine.getOptimalSteps()).toBeGreaterThan(0);
  });

  it("生成的谜题有解（应用最优解后全灭）", () => {
    engine.generatePuzzle();
    const grid = engine.getGrid();
    const solution = LightsOutEngine.solveOptimal(grid);
    const testGrid = grid.map((row) => [...row]);
    for (const idx of solution) {
      const r = Math.floor(idx / GRID_SIZE);
      const c = idx % GRID_SIZE;
      const neighbors = [[r, c]];
      if (r > 0) neighbors.push([r - 1, c]);
      if (r < GRID_SIZE - 1) neighbors.push([r + 1, c]);
      if (c > 0) neighbors.push([r, c - 1]);
      if (c < GRID_SIZE - 1) neighbors.push([r, c + 1]);
      for (const [nr, nc] of neighbors) {
        testGrid[nr][nc] = !testGrid[nr][nc];
      }
    }
    expect(allOff(testGrid)).toBe(true);
  });

  it("多次生成可能产生不同谜题", () => {
    const grids: string[] = [];
    for (let i = 0; i < 10; i++) {
      engine.generatePuzzle();
      grids.push(JSON.stringify(engine.getGrid()));
    }
    const unique = new Set(grids);
    // 至少有一次不同（概率极高）
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it("等级 2 谜题的平均最优步数 >= 等级 1", () => {
    let total1 = 0;
    let total2 = 0;
    for (let i = 0; i < 20; i++) {
      (engine as any)._level = 1;
      engine.generatePuzzle();
      total1 += engine.getOptimalSteps();
      (engine as any)._level = 2;
      engine.generatePuzzle();
      total2 += engine.getOptimalSteps();
    }
    expect(total2 / 20).toBeGreaterThanOrEqual(total1 / 20 - 1); // 允许轻微波动
  });
});

// ========== 12. 步数统计 ==========

describe("步数统计", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
    setPlaying(engine);
  });

  it("初始步数为 0", () => {
    expect(engine.getSteps()).toBe(0);
  });

  it("每次翻转步数加 1", () => {
    engine.toggle(0, 0);
    expect(engine.getSteps()).toBe(1);
    engine.toggle(1, 1);
    expect(engine.getSteps()).toBe(2);
    engine.toggle(2, 2);
    expect(engine.getSteps()).toBe(3);
  });

  it("生成新谜题重置步数", () => {
    engine.toggle(0, 0);
    engine.toggle(1, 1);
    expect(engine.getSteps()).toBe(2);
    engine.generatePuzzle();
    expect(engine.getSteps()).toBe(0);
  });

  it("步数与位置无关", () => {
    engine.toggle(0, 0);
    engine.toggle(4, 4);
    engine.toggle(2, 2);
    expect(engine.getSteps()).toBe(3);
  });

  it("连续翻转正确累计", () => {
    for (let i = 0; i < 10; i++) {
      engine.toggle(i % 5, i % 5);
    }
    expect(engine.getSteps()).toBe(10);
  });
});

// ========== 13. handleKeyDown ==========

describe("handleKeyDown", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
    setPlaying(engine);
  });

  it("ArrowUp 向上移动光标", () => {
    engine.handleKeyDown("ArrowUp");
    expect(engine.getCursor().row).toBe(1);
  });

  it("ArrowDown 向下移动光标", () => {
    engine.handleKeyDown("ArrowDown");
    expect(engine.getCursor().row).toBe(3);
  });

  it("ArrowLeft 向左移动光标", () => {
    engine.handleKeyDown("ArrowLeft");
    expect(engine.getCursor().col).toBe(1);
  });

  it("ArrowRight 向右移动光标", () => {
    engine.handleKeyDown("ArrowRight");
    expect(engine.getCursor().col).toBe(3);
  });

  it("空格翻转光标位置的灯", () => {
    engine.handleKeyDown(" ");
    const grid = engine.getGrid();
    expect(grid[2][2]).toBe(true);
  });

  it("非 playing 状态不响应方向键", () => {
    (engine as any)._status = "idle";
    engine.handleKeyDown("ArrowUp");
    expect(engine.getCursor().row).toBe(2);
  });

  it("非 playing 状态不响应空格", () => {
    (engine as any)._status = "idle";
    engine.handleKeyDown(" ");
    expect(engine.getSteps()).toBe(0);
  });

  it("未知按键不产生影响", () => {
    engine.handleKeyDown("a");
    engine.handleKeyDown("Enter");
    engine.handleKeyDown("Escape");
    expect(engine.getCursor()).toEqual({ row: 2, col: 2 });
    expect(engine.getSteps()).toBe(0);
  });

  it("连续按键正确处理", () => {
    engine.handleKeyDown("ArrowUp");
    engine.handleKeyDown("ArrowUp");
    engine.handleKeyDown("ArrowLeft");
    expect(engine.getCursor()).toEqual({ row: 0, col: 1 });
  });
});

// ========== 14. handleKeyUp ==========

describe("handleKeyUp", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("不抛错", () => {
    expect(() => engine.handleKeyUp("ArrowUp")).not.toThrow();
  });

  it("返回 void", () => {
    expect(engine.handleKeyUp(" ")).toBeUndefined();
  });

  it("不影响游戏状态", () => {
    setPlaying(engine);
    const before = engine.getState();
    engine.handleKeyUp("ArrowUp");
    expect(engine.getState()).toEqual(before);
  });
});

// ========== 15. getState ==========

describe("getState", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
    setPlaying(engine);
  });

  it("返回包含 grid 的对象", () => {
    expect(engine.getState()).toHaveProperty("grid");
  });

  it("返回包含 cursor 的对象", () => {
    expect(engine.getState()).toHaveProperty("cursor");
  });

  it("返回包含 steps 的对象", () => {
    expect(engine.getState()).toHaveProperty("steps");
  });

  it("返回包含 optimalSteps 的对象", () => {
    expect(engine.getState()).toHaveProperty("optimalSteps");
  });

  it("返回包含 isSolved 的对象", () => {
    expect(engine.getState()).toHaveProperty("isSolved");
  });

  it("返回包含 level 的对象", () => {
    expect(engine.getState()).toHaveProperty("level");
  });

  it("返回包含 score 的对象", () => {
    expect(engine.getState()).toHaveProperty("score");
  });

  it("state 中的 grid 与 getGrid() 一致", () => {
    engine.toggle(2, 2);
    expect(engine.getState().grid).toEqual(engine.getGrid());
  });
});

// ========== 16. 等级递进 ==========

describe("等级递进", () => {
  it("初始等级为 1", () => {
    const engine = createEngine();
    expect(engine.level).toBe(1);
  });

  it("LEVEL_CONFIGS 包含 6 个等级", () => {
    expect(LEVEL_CONFIGS).toHaveLength(6);
  });

  it("高等级的最小点击数更大", () => {
    for (let i = 1; i < LEVEL_CONFIGS.length; i++) {
      expect(LEVEL_CONFIGS[i].minClicks).toBeGreaterThanOrEqual(LEVEL_CONFIGS[i - 1].minClicks);
    }
  });

  it("MAX_LEVEL 等于 LEVEL_CONFIGS 长度", () => {
    expect(MAX_LEVEL).toBe(LEVEL_CONFIGS.length);
  });

  it("等级 1 使用入门配置", () => {
    expect(LEVEL_CONFIGS[0].label).toBe("入门");
  });

  it("等级 6 使用大师配置", () => {
    expect(LEVEL_CONFIGS[5].label).toBe("大师");
  });
});

// ========== 17. 事件系统 ==========

describe("事件系统", () => {
  let engine: LightsOutEngine;

  beforeEach(() => {
    engine = createEngine();
    setPlaying(engine);
  });

  it("toggle 触发 'toggle' 事件", () => {
    let fired = false;
    engine.on("toggle", () => {
      fired = true;
    });
    engine.toggle(2, 2);
    expect(fired).toBe(true);
  });

  it("toggle 事件包含正确步数", () => {
    let steps = -1;
    engine.on("toggle", (data: any) => {
      steps = data.steps;
    });
    engine.toggle(0, 0);
    engine.toggle(1, 1);
    expect(steps).toBe(2);
  });

  it("toggle 事件包含正确坐标", () => {
    let coords: any = null;
    engine.on("toggle", (data: any) => {
      coords = { row: data.row, col: data.col };
    });
    engine.toggle(3, 4);
    expect(coords).toEqual({ row: 3, col: 4 });
  });

  it("解题完成触发 'win' 事件", () => {
    // 设置只有一个灯亮的简单谜题
    engine.setGrid(makeGrid([
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
    ]));
    let winFired = false;
    engine.on("win", () => {
      winFired = true;
    });
    engine.toggle(2, 2); // 翻转中心即可解
    expect(winFired).toBe(true);
  });

  it("win 事件包含关卡信息", () => {
    engine.setGrid(makeGrid([
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
    ]));
    let winData: any = null;
    engine.on("win", (data: any) => {
      winData = data;
    });
    engine.toggle(2, 2);
    expect(winData).not.toBeNull();
    expect(winData.level).toBe(1);
    expect(winData.steps).toBe(1);
  });
});

// ========== 18. 生命周期 ==========

describe("生命周期", () => {
  it("onInit 设置初始状态", () => {
    const engine = new LightsOutEngine();
    engine.init();
    expect(engine.getGrid()).toHaveLength(5);
    expect(engine.getSteps()).toBe(0);
    expect(engine.getCursor()).toEqual({ row: 2, col: 2 });
  });

  it("onReset 恢复初始状态", () => {
    const engine = createEngine();
    setPlaying(engine);
    engine.toggle(2, 2);
    engine.moveCursor(1, 0);
    engine.reset();
    expect(engine.getSteps()).toBe(0);
    expect(allOff(engine.getGrid())).toBe(true);
  });

  it("reset 后状态为 idle", () => {
    const engine = createEngine();
    setPlaying(engine);
    engine.reset();
    expect(engine.status).toBe("idle");
  });

  it("init 可多次调用", () => {
    const engine = new LightsOutEngine();
    engine.init();
    engine.toggle(2, 2); // 无影响因为不是 playing
    engine.init();
    expect(allOff(engine.getGrid())).toBe(true);
  });

  it("destroy 后清理监听器", () => {
    const engine = createEngine();
    let called = false;
    engine.on("toggle", () => {
      called = true;
    });
    engine.destroy();
    setPlaying(engine);
    engine.toggle(2, 2);
    expect(called).toBe(false);
  });
});

// ========== 19. 综合游戏流程 ==========

describe("综合游戏流程", () => {
  it("完整游戏流程：生成→操作→解谜→胜利", () => {
    const engine = createEngine();
    setPlaying(engine);

    // 手动设置简单谜题
    engine.setGrid(makeGrid([
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
    ]));

    expect(engine.isSolved()).toBe(false);

    // 移动光标到中心
    // 光标初始在 (2,2)，已在中心

    // 翻转中心
    engine.toggle(2, 2);
    expect(engine.isSolved()).toBe(true);
    expect(engine.getSteps()).toBe(1);
  });

  it("通过光标键盘操作完成游戏", () => {
    const engine = createEngine();
    setPlaying(engine);

    // 设置左上角谜题
    engine.setGrid(makeGrid([
      [1, 1, 0, 0, 0],
      [1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]));

    // 移动光标到 (0,0)
    engine.handleKeyDown("ArrowUp");
    engine.handleKeyDown("ArrowUp");
    engine.handleKeyDown("ArrowLeft");
    engine.handleKeyDown("ArrowLeft");
    expect(engine.getCursor()).toEqual({ row: 0, col: 0 });

    // 翻转
    engine.handleKeyDown(" ");
    expect(engine.isSolved()).toBe(true);
  });

  it("多次翻转后回到全灭", () => {
    const engine = createEngine();
    setPlaying(engine);

    engine.toggle(0, 0);
    engine.toggle(0, 0);
    expect(engine.isSolved()).toBe(true);
    expect(engine.getSteps()).toBe(2);
  });

  it("setGrid 设置自定义网格", () => {
    const engine = createEngine();
    const custom = makeGrid([
      [1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    engine.setGrid(custom);
    expect(engine.getGrid()).toEqual(custom);
  });

  it("setGrid 不影响原数组", () => {
    const engine = createEngine();
    const custom = makeGrid([
      [1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    engine.setGrid(custom);
    custom[0][0] = false;
    expect(engine.getGrid()[0][0]).toBe(true);
  });
});
