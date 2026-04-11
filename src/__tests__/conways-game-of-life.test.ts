import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConwaysGameOfLifeEngine } from '@/games/conways-game-of-life/ConwaysGameOfLifeEngine';
import {
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  SPEED_LEVELS,
  SimulationState,
  PRESET_PATTERNS,
  PATTERN_GLIDER,
  PATTERN_LWSS,
  PATTERN_R_PENTOMINO,
  PATTERN_PULSAR,
  PATTERN_GOSPER_GUN,
} from '@/games/conways-game-of-life/constants';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

function createEngine() {
  const canvas = createCanvas();
  const engine = new ConwaysGameOfLifeEngine();
  engine.init(canvas);
  return { canvas, engine };
}

function startEngine() {
  const { canvas, engine } = createEngine();
  engine.start();
  return { canvas, engine };
}

/**
 * 模拟 update 调用，传入 deltaTime 毫秒
 */
function advanceUpdate(engine: ConwaysGameOfLifeEngine, deltaTime: number): void {
  (engine as any).update(deltaTime);
}

/**
 * 获取引擎的私有 grid
 */
function getGrid(engine: ConwaysGameOfLifeEngine): boolean[][] {
  return (engine as any).grid;
}

/**
 * 设置网格中指定位置为活/死
 */
function setCell(engine: ConwaysGameOfLifeEngine, row: number, col: number, alive: boolean): void {
  (engine as any).grid[row][col] = alive;
}

/**
 * 统计网格中活细胞数
 */
function countGridAlive(grid: boolean[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell) count++;
    }
  }
  return count;
}

// ========== 测试 ==========

describe('ConwaysGameOfLifeEngine', () => {
  // ==================== T1: 初始化 ====================
  describe('初始化', () => {
    it('init 后 status 为 idle', () => {
      const { engine } = createEngine();
      expect(engine.status).toBe('idle');
    });

    it('网格初始化为全空（所有 cell = false）', () => {
      const { engine } = createEngine();
      const grid = getGrid(engine);
      expect(grid.length).toBe(GRID_ROWS);
      expect(grid[0].length).toBe(GRID_COLS);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          expect(grid[r][c]).toBe(false);
        }
      }
    });

    it('generation = 0, aliveCells = 0', () => {
      const { engine } = createEngine();
      const state = engine.getState();
      expect(state.generation).toBe(0);
      expect(state.aliveCells).toBe(0);
    });

    it('simState 为 PAUSED', () => {
      const { engine } = createEngine();
      expect((engine as any).simState).toBe(SimulationState.PAUSED);
    });

    it('speedIndex 为默认值 2（对应 5 代/秒）', () => {
      const { engine } = createEngine();
      expect((engine as any).speedIndex).toBe(2);
    });
  });

  // ==================== T2: 生命周期 ====================
  describe('生命周期', () => {
    it('onInit() 正确初始化网格', () => {
      const { engine } = createEngine();
      const grid = getGrid(engine);
      expect(grid).toHaveLength(GRID_ROWS);
      expect(grid[0]).toHaveLength(GRID_COLS);
    });

    it('start() 后放置默认图案（Glider）并进入 RUNNING', () => {
      const { engine } = startEngine();
      expect((engine as any).simState).toBe(SimulationState.RUNNING);
      // Glider 有 5 个活细胞
      expect(engine.getState().aliveCells).toBe(5);
    });

    it('reset() 清空网格和计数器', () => {
      const { engine } = startEngine();
      engine.reset();
      expect((engine as any).simState).toBe(SimulationState.PAUSED);
      expect((engine as any).generation).toBe(0);
      expect((engine as any).aliveCells).toBe(0);
      expect((engine as any).isExtinct).toBe(false);
      const grid = getGrid(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          expect(grid[r][c]).toBe(false);
        }
      }
    });

    it('onRender() 不抛异常', () => {
      const { canvas, engine } = startEngine();
      expect(() => {
        engine.render();
      }).not.toThrow();
    });

    it('update() 不抛异常', () => {
      const { engine } = startEngine();
      expect(() => {
        advanceUpdate(engine, 100);
      }).not.toThrow();
    });
  });

  // ==================== T3: Conway 规则 ====================
  describe('Conway 规则', () => {
    it('活细胞 < 2 邻居 → 死亡（孤独）', () => {
      const { engine } = startEngine();
      // 清空网格，放置一个只有 1 个邻居的活细胞
      let grid = getGrid(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      // 放置两个相邻活细胞（各只有 1 个邻居）
      grid[10][10] = true;
      grid[10][11] = true;
      (engine as any).countAliveCells();

      // 推进一代
      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);

      // advanceGeneration() 创建新网格，需要重新获取引用
      grid = getGrid(engine);
      // 两个细胞都只有 1 个邻居，应该死亡
      expect(grid[10][10]).toBe(false);
      expect(grid[10][11]).toBe(false);
    });

    it('活细胞 = 2 邻居 → 存活', () => {
      const { engine } = startEngine();
      let grid = getGrid(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      // 放置水平三连：中间细胞有 2 个邻居
      grid[10][9] = true;
      grid[10][10] = true;
      grid[10][11] = true;
      (engine as any).countAliveCells();

      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);

      // advanceGeneration() 创建新网格，需要重新获取引用
      grid = getGrid(engine);
      // 中间细胞有 2 个邻居，应存活
      expect(grid[10][10]).toBe(true);
    });

    it('活细胞 = 3 邻居 → 存活', () => {
      const { engine } = startEngine();
      let grid = getGrid(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      // 放置 2x2 方块：每个细胞有 3 个邻居
      grid[10][10] = true;
      grid[10][11] = true;
      grid[11][10] = true;
      grid[11][11] = true;
      (engine as any).countAliveCells();

      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);

      // advanceGeneration() 创建新网格，需要重新获取引用
      grid = getGrid(engine);
      // 2x2 方块是静物，所有细胞应存活
      expect(grid[10][10]).toBe(true);
      expect(grid[10][11]).toBe(true);
      expect(grid[11][10]).toBe(true);
      expect(grid[11][11]).toBe(true);
    });

    it('活细胞 > 3 邻居 → 死亡（过挤）', () => {
      const { engine } = startEngine();
      let grid = getGrid(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      // 放置一个中心细胞 + 4 个邻居（过挤）
      grid[10][10] = true; // center
      grid[9][10] = true;  // top
      grid[11][10] = true; // bottom
      grid[10][9] = true;  // left
      grid[10][11] = true; // right
      (engine as any).countAliveCells();

      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);

      // advanceGeneration() 创建新网格，需要重新获取引用
      grid = getGrid(engine);
      // 中心细胞有 4 个邻居，应死亡
      expect(grid[10][10]).toBe(false);
    });

    it('死细胞 = 3 邻居 → 新生', () => {
      const { engine } = startEngine();
      let grid = getGrid(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      // 放置 L 形三个活细胞
      grid[9][10] = true;
      grid[10][9] = true;
      grid[10][10] = true;
      // (9,9) 有 3 个邻居 → 应新生
      (engine as any).countAliveCells();

      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);

      // advanceGeneration() 创建新网格，需要重新获取引用
      grid = getGrid(engine);
      // (9,9) 应该变为活（3个邻居）
      expect(grid[9][9]).toBe(true);
    });

    it('死细胞 ≠ 3 邻居 → 保持死亡', () => {
      const { engine } = startEngine();
      let grid = getGrid(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      // 只放一个活细胞
      grid[10][10] = true;
      // (9,9) 只有 1 个邻居 → 保持死亡
      (engine as any).countAliveCells();

      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);

      grid = getGrid(engine);
      expect(grid[9][9]).toBe(false);
    });

    it('边界细胞正确计算邻居（不环绕）', () => {
      const { engine } = startEngine();
      let grid = getGrid(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      // 角落 (0,0) 有 3 个活邻居 → 新生
      grid[0][1] = true;
      grid[1][0] = true;
      grid[1][1] = true;
      (engine as any).countAliveCells();

      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);

      // advanceGeneration() 创建新网格，需要重新获取引用
      grid = getGrid(engine);
      // (0,0) 有 3 个邻居，应新生
      expect(grid[0][0]).toBe(true);
    });

    it('空网格推进一代仍为空', () => {
      const { engine } = startEngine();
      let grid = getGrid(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      (engine as any).countAliveCells();
      (engine as any).generation = 0;
      (engine as any).isExtinct = false;

      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);

      // advanceGeneration() 创建新网格，需要重新获取引用
      grid = getGrid(engine);
      // 空网格应保持空（但 generation 会增加）
      expect((engine as any).aliveCells).toBe(0);
      // 所有细胞仍为 false
      let allDead = true;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (grid[r][c]) { allDead = false; break; }
        }
        if (!allDead) break;
      }
      expect(allDead).toBe(true);
    });
  });

  // ==================== T4: 速度控制 ====================
  describe('速度控制', () => {
    it('默认速度等级为 2（5 代/秒）', () => {
      const { engine } = startEngine();
      expect((engine as any).speedIndex).toBe(2);
      expect(engine.getState().speed).toBe(5);
    });

    it('按键 1~6 切换速度等级', () => {
      const { engine } = startEngine();

      engine.handleKeyDown('1');
      expect((engine as any).speedIndex).toBe(0);
      expect(engine.getState().speed).toBe(1);

      engine.handleKeyDown('3');
      expect((engine as any).speedIndex).toBe(2);
      expect(engine.getState().speed).toBe(5);

      engine.handleKeyDown('6');
      expect((engine as any).speedIndex).toBe(5);
      expect(engine.getState().speed).toBe(30);
    });

    it('update() 根据速度正确推进代数（低速）', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('1'); // 1 代/秒 = 1000ms 间隔

      const genBefore = (engine as any).generation;

      // 500ms 不够触发一代
      advanceUpdate(engine, 500);
      expect((engine as any).generation).toBe(genBefore);

      // 再来 600ms，累计 1100ms > 1000ms，触发一代
      advanceUpdate(engine, 600);
      expect((engine as any).generation).toBe(genBefore + 1);
    });

    it('update() 高速时单次 update 可能推进一代', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('6'); // 30 代/秒 ≈ 33ms 间隔

      const genBefore = (engine as any).generation;

      // 100ms > 33ms，足以触发一代
      advanceUpdate(engine, 100);
      expect((engine as any).generation).toBeGreaterThan(genBefore);
    });

    it('PAUSED 状态下 update() 不推进', () => {
      const { engine } = startEngine();
      engine.handleKeyDown(' '); // 暂停
      expect((engine as any).simState).toBe(SimulationState.PAUSED);

      const genBefore = (engine as any).generation;
      advanceUpdate(engine, 10000); // 即使很长时间
      expect((engine as any).generation).toBe(genBefore);
    });
  });

  // ==================== T5: 键盘输入 ====================
  describe('键盘输入', () => {
    it('Space 暂停/继续切换', () => {
      const { engine } = startEngine();
      expect((engine as any).simState).toBe(SimulationState.RUNNING);

      engine.handleKeyDown(' ');
      expect((engine as any).simState).toBe(SimulationState.PAUSED);

      engine.handleKeyDown(' ');
      expect((engine as any).simState).toBe(SimulationState.RUNNING);
    });

    it('N 手动推进一代（暂停时）', () => {
      const { engine } = startEngine();
      engine.handleKeyDown(' '); // 暂停
      const genBefore = (engine as any).generation;

      engine.handleKeyDown('n');
      expect((engine as any).generation).toBe(genBefore + 1);
    });

    it('N 在运行时无效', () => {
      const { engine } = startEngine();
      expect((engine as any).simState).toBe(SimulationState.RUNNING);

      const genBefore = (engine as any).generation;
      engine.handleKeyDown('n');
      // 运行时 stepOneGeneration 直接 return
      expect((engine as any).generation).toBe(genBefore);
    });

    it('R 重置清空网格', () => {
      const { engine } = startEngine();
      // 推进几代
      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval * 3);

      engine.handleKeyDown('r');
      expect((engine as any).generation).toBe(0);
      expect((engine as any).aliveCells).toBe(0);
      expect((engine as any).simState).toBe(SimulationState.PAUSED);
    });

    it('P 切换预设图案', () => {
      const { engine } = startEngine();
      expect((engine as any).patternIndex).toBe(0);

      engine.handleKeyDown('p');
      expect((engine as any).patternIndex).toBe(1);

      engine.handleKeyDown('P');
      expect((engine as any).patternIndex).toBe(2);
    });

    it('P 循环回到第一个图案', () => {
      const { engine } = startEngine();
      // 循环完所有图案
      for (let i = 0; i < PRESET_PATTERNS.length; i++) {
        engine.handleKeyDown('p');
      }
      // 应回到 0
      expect((engine as any).patternIndex).toBe(0);
    });

    it('E 切换编辑模式', () => {
      const { engine } = startEngine();
      expect((engine as any).editMode).toBe(false);

      engine.handleKeyDown('e');
      expect((engine as any).editMode).toBe(true);

      engine.handleKeyDown('E');
      expect((engine as any).editMode).toBe(false);
    });

    it('进入编辑模式时自动暂停', () => {
      const { engine } = startEngine();
      expect((engine as any).simState).toBe(SimulationState.RUNNING);

      engine.handleKeyDown('e');
      expect((engine as any).editMode).toBe(true);
      expect((engine as any).simState).toBe(SimulationState.PAUSED);
    });

    it('方向键移动光标（编辑模式）', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('e'); // 进入编辑模式

      const startRow = (engine as any).cursorRow;
      const startCol = (engine as any).cursorCol;

      engine.handleKeyDown('ArrowUp');
      expect((engine as any).cursorRow).toBe(Math.max(0, startRow - 1));

      engine.handleKeyDown('ArrowDown');
      expect((engine as any).cursorRow).toBe(startRow);

      engine.handleKeyDown('ArrowLeft');
      expect((engine as any).cursorCol).toBe(Math.max(0, startCol - 1));

      engine.handleKeyDown('ArrowRight');
      expect((engine as any).cursorCol).toBe(startCol);
    });

    it('方向键在非编辑模式不移动光标', () => {
      const { engine } = startEngine();
      expect((engine as any).editMode).toBe(false);

      const startRow = (engine as any).cursorRow;
      const startCol = (engine as any).cursorCol;

      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowLeft');
      engine.handleKeyDown('ArrowRight');

      expect((engine as any).cursorRow).toBe(startRow);
      expect((engine as any).cursorCol).toBe(startCol);
    });

    it('Enter 切换光标位置细胞（编辑模式）', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('e'); // 进入编辑模式

      const row = (engine as any).cursorRow;
      const col = (engine as any).cursorCol;
      const wasAlive = getGrid(engine)[row][col];

      engine.handleKeyDown('Enter');
      expect(getGrid(engine)[row][col]).toBe(!wasAlive);

      engine.handleKeyDown('Enter');
      expect(getGrid(engine)[row][col]).toBe(wasAlive);
    });

    it('Enter 在非编辑模式不切换细胞', () => {
      const { engine } = startEngine();
      expect((engine as any).editMode).toBe(false);

      const row = (engine as any).cursorRow;
      const col = (engine as any).cursorCol;
      const beforeGrid = getGrid(engine)[row][col];

      engine.handleKeyDown('Enter');
      expect(getGrid(engine)[row][col]).toBe(beforeGrid);
    });
  });

  // ==================== T6: 鼠标/触摸交互 ====================
  describe('鼠标/触摸交互', () => {
    it('handleClick() 正确坐标转换并切换细胞', () => {
      const { engine } = startEngine();
      const grid = getGrid(engine);

      // 清空网格
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      (engine as any).countAliveCells();

      // 点击网格中心位置
      const targetRow = 5;
      const targetCol = 5;
      const clickX = GRID_OFFSET_X + targetCol * CELL_SIZE + CELL_SIZE / 2;
      const clickY = GRID_OFFSET_Y + targetRow * CELL_SIZE + CELL_SIZE / 2;

      engine.handleClick(clickX, clickY);

      expect(grid[targetRow][targetCol]).toBe(true);
    });

    it('点击活细胞使其死亡', () => {
      const { engine } = startEngine();
      const grid = getGrid(engine);

      // 设置一个活细胞
      grid[5][5] = true;
      (engine as any).countAliveCells();

      const clickX = GRID_OFFSET_X + 5 * CELL_SIZE + 1;
      const clickY = GRID_OFFSET_Y + 5 * CELL_SIZE + 1;

      engine.handleClick(clickX, clickY);
      expect(grid[5][5]).toBe(false);
    });

    it('点击死细胞使其复活', () => {
      const { engine } = startEngine();
      const grid = getGrid(engine);

      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      (engine as any).countAliveCells();

      const clickX = GRID_OFFSET_X + 10 * CELL_SIZE + 1;
      const clickY = GRID_OFFSET_Y + 10 * CELL_SIZE + 1;

      engine.handleClick(clickX, clickY);
      expect(grid[10][10]).toBe(true);
    });

    it('点击超出网格范围不报错', () => {
      const { engine } = startEngine();

      // 点击左上角偏移区域之外
      expect(() => {
        engine.handleClick(0, 0);
      }).not.toThrow();

      // 点击右下角超出网格
      expect(() => {
        engine.handleClick(10000, 10000);
      }).not.toThrow();

      // 点击负坐标
      expect(() => {
        engine.handleClick(-100, -100);
      }).not.toThrow();
    });

    it('handleClick 同步光标位置', () => {
      const { engine } = startEngine();
      const targetRow = 10;
      const targetCol = 15;
      const clickX = GRID_OFFSET_X + targetCol * CELL_SIZE + 1;
      const clickY = GRID_OFFSET_Y + targetRow * CELL_SIZE + 1;

      engine.handleClick(clickX, clickY);
      expect((engine as any).cursorRow).toBe(targetRow);
      expect((engine as any).cursorCol).toBe(targetCol);
    });
  });

  // ==================== T7: 预设图案 ====================
  describe('预设图案', () => {
    it('放置 Glider 图案正确', () => {
      const { engine } = startEngine();
      // 默认 start() 放置 Glider
      const grid = getGrid(engine);
      const alive = countGridAlive(grid);
      expect(alive).toBe(PATTERN_GLIDER.cells.length);
    });

    it('放置 LWSS 图案正确', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('p'); // index 0 → 1 = LWSS
      expect((engine as any).patternIndex).toBe(1);

      const grid = getGrid(engine);
      const alive = countGridAlive(grid);
      expect(alive).toBe(PATTERN_LWSS.cells.length);
    });

    it('放置 R-pentomino 图案正确', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('p');
      engine.handleKeyDown('p'); // index 2 = R-pentomino

      const grid = getGrid(engine);
      const alive = countGridAlive(grid);
      expect(alive).toBe(PATTERN_R_PENTOMINO.cells.length);
    });

    it('放置 Pulsar 图案正确', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('p');
      engine.handleKeyDown('p');
      engine.handleKeyDown('p'); // index 3 = Pulsar

      const grid = getGrid(engine);
      const alive = countGridAlive(grid);
      expect(alive).toBe(PATTERN_PULSAR.cells.length);
    });

    it('放置 Gosper Gun 图案正确', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('p');
      engine.handleKeyDown('p');
      engine.handleKeyDown('p');
      engine.handleKeyDown('p'); // index 4 = Gosper Gun

      const grid = getGrid(engine);
      const alive = countGridAlive(grid);
      // Gosper Gun 居中放置时，部分细胞可能超出网格边界
      // 所以实际放置的细胞数 <= PATTERN_GOSPER_GUN.cells.length
      expect(alive).toBeGreaterThan(0);
      expect(alive).toBeLessThanOrEqual(PATTERN_GOSPER_GUN.cells.length);
    });

    it('P 键循环图案后重置 generation', () => {
      const { engine } = startEngine();
      // 推进几代
      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval * 3);
      expect((engine as any).generation).toBeGreaterThan(0);

      engine.handleKeyDown('p');
      expect((engine as any).generation).toBe(0);
    });
  });

  // ==================== T8: 状态管理 ====================
  describe('状态管理', () => {
    it('getState() 返回正确结构', () => {
      const { engine } = startEngine();
      const state = engine.getState();

      expect(state).toHaveProperty('generation');
      expect(state).toHaveProperty('aliveCells');
      expect(state).toHaveProperty('speed');
      expect(state).toHaveProperty('speedIndex');
      expect(state).toHaveProperty('simState');
      expect(state).toHaveProperty('isExtinct');
      expect(state).toHaveProperty('editMode');
      expect(state).toHaveProperty('currentPattern');
      expect(state).toHaveProperty('grid');
    });

    it('代数随模拟推进增加', () => {
      const { engine } = startEngine();
      expect((engine as any).generation).toBe(0);

      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);
      expect((engine as any).generation).toBe(1);

      advanceUpdate(engine, tickInterval);
      expect((engine as any).generation).toBe(2);
    });

    it('活细胞计数正确更新', () => {
      const { engine } = startEngine();
      // 开始时有 Glider 的 5 个细胞
      expect((engine as any).aliveCells).toBe(5);

      // 点击添加一个细胞
      const clickX = GRID_OFFSET_X + 0 * CELL_SIZE + 1;
      const clickY = GRID_OFFSET_Y + 0 * CELL_SIZE + 1;
      engine.handleClick(clickX, clickY);

      expect((engine as any).aliveCells).toBe(6);
    });

    it('所有细胞死亡时自动暂停并标记灭绝', () => {
      const { engine } = startEngine();
      // 清空网格
      const grid = getGrid(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      // 放置一个会立即死亡的细胞（无邻居）
      grid[20][20] = true;
      (engine as any).aliveCells = 1;
      (engine as any).generation = 0;
      (engine as any).isExtinct = false;

      // 推进一代
      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);

      expect((engine as any).isExtinct).toBe(true);
      expect((engine as any).simState).toBe(SimulationState.PAUSED);
    });

    it('灭绝后 Space 不能继续运行', () => {
      const { engine } = startEngine();
      // 触发灭绝
      (engine as any).isExtinct = true;
      (engine as any).simState = SimulationState.PAUSED;

      engine.handleKeyDown(' ');
      // 灭绝状态下不能继续
      expect((engine as any).simState).toBe(SimulationState.PAUSED);
    });

    it('灭绝后 N 不推进', () => {
      const { engine } = startEngine();
      (engine as any).isExtinct = true;
      (engine as any).simState = SimulationState.PAUSED;

      const gen = (engine as any).generation;
      engine.handleKeyDown('n');
      expect((engine as any).generation).toBe(gen);
    });

    it('手动编辑细胞后重置灭绝状态', () => {
      const { engine } = startEngine();
      (engine as any).isExtinct = true;
      (engine as any).simState = SimulationState.PAUSED;

      // 点击添加细胞
      const clickX = GRID_OFFSET_X + 5 * CELL_SIZE + 1;
      const clickY = GRID_OFFSET_Y + 5 * CELL_SIZE + 1;
      engine.handleClick(clickX, clickY);

      expect((engine as any).isExtinct).toBe(false);
    });
  });

  // ==================== T9: 渲染 ====================
  describe('渲染', () => {
    it('onRender() 不抛异常', () => {
      const { engine } = startEngine();
      expect(() => engine.render()).not.toThrow();
    });

    it('onRender() 暂停状态不抛异常', () => {
      const { engine } = startEngine();
      engine.handleKeyDown(' ');
      expect((engine as any).simState).toBe(SimulationState.PAUSED);
      expect(() => engine.render()).not.toThrow();
    });

    it('onRender() 编辑模式不抛异常', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('e');
      expect((engine as any).editMode).toBe(true);
      expect(() => engine.render()).not.toThrow();
    });

    it('onRender() 灭绝状态不抛异常', () => {
      const { engine } = startEngine();
      (engine as any).isExtinct = true;
      expect(() => engine.render()).not.toThrow();
    });
  });

  // ==================== T10: 边界条件 ====================
  describe('边界条件', () => {
    it('网格边界细胞可正确切换', () => {
      const { engine } = startEngine();
      const grid = getGrid(engine);

      // 清空
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      (engine as any).countAliveCells();

      // 点击左上角边界
      const clickX = GRID_OFFSET_X + 1;
      const clickY = GRID_OFFSET_Y + 1;
      engine.handleClick(clickX, clickY);
      expect(grid[0][0]).toBe(true);

      // 点击右下角边界
      const clickX2 = GRID_OFFSET_X + (GRID_COLS - 1) * CELL_SIZE + 1;
      const clickY2 = GRID_OFFSET_Y + (GRID_ROWS - 1) * CELL_SIZE + 1;
      engine.handleClick(clickX2, clickY2);
      expect(grid[GRID_ROWS - 1][GRID_COLS - 1]).toBe(true);
    });

    it('大量 update() 不导致异常', () => {
      const { engine } = startEngine();
      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];

      expect(() => {
        for (let i = 0; i < 500; i++) {
          advanceUpdate(engine, tickInterval);
        }
      }).not.toThrow();
    });

    it('连续快速操作不报错', () => {
      const { engine } = startEngine();

      expect(() => {
        // 快速连续按键
        for (let i = 0; i < 50; i++) {
          engine.handleKeyDown(' ');
          engine.handleKeyDown('n');
          engine.handleKeyDown('e');
          engine.handleKeyDown('ArrowUp');
          engine.handleKeyDown('ArrowDown');
          engine.handleKeyDown('Enter');
        }
        engine.handleKeyDown('r'); // 最后重置
      }).not.toThrow();
    });

    it('光标不能移出网格上边界', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('e'); // 编辑模式
      (engine as any).cursorRow = 0;

      engine.handleKeyDown('ArrowUp');
      expect((engine as any).cursorRow).toBe(0);
    });

    it('光标不能移出网格下边界', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('e');
      (engine as any).cursorRow = GRID_ROWS - 1;

      engine.handleKeyDown('ArrowDown');
      expect((engine as any).cursorRow).toBe(GRID_ROWS - 1);
    });

    it('光标不能移出网格左边界', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('e');
      (engine as any).cursorCol = 0;

      engine.handleKeyDown('ArrowLeft');
      expect((engine as any).cursorCol).toBe(0);
    });

    it('光标不能移出网格右边界', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('e');
      (engine as any).cursorCol = GRID_COLS - 1;

      engine.handleKeyDown('ArrowRight');
      expect((engine as any).cursorCol).toBe(GRID_COLS - 1);
    });

    it('速度索引不会越界（超出上限被 clamp）', () => {
      const { engine } = startEngine();
      // 速度索引最大是 5
      engine.handleKeyDown('6');
      expect((engine as any).speedIndex).toBe(5);
    });
  });

  // ==================== T11: 生命周期与事件 ====================
  describe('生命周期与事件', () => {
    it('pause 后 simState 为 PAUSED', () => {
      const { engine } = startEngine();
      engine.pause();
      expect((engine as any).simState).toBe(SimulationState.PAUSED);
    });

    it('resume 后 simState 为 RUNNING', () => {
      const { engine } = startEngine();
      engine.pause();
      engine.resume();
      expect((engine as any).simState).toBe(SimulationState.RUNNING);
    });

    it('start 触发 statusChange 事件为 playing', () => {
      const { engine } = createEngine();
      const cb = vi.fn();
      engine.on('statusChange', cb);
      engine.start();
      expect(cb).toHaveBeenCalledWith('playing');
    });

    it('score 跟随 generation', () => {
      const { engine } = startEngine();
      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);
      expect(engine.score).toBe(1);

      advanceUpdate(engine, tickInterval);
      expect(engine.score).toBe(2);
    });

    it('level 在推进一代后跟踪 aliveCells', () => {
      const { engine } = startEngine();
      // level 初始为 1（基类 start() 设置）
      expect(engine.level).toBe(1);

      // 推进一代后，level 更新为 aliveCells
      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      advanceUpdate(engine, tickInterval);
      // Glider 仍然是 5 个细胞
      expect(engine.level).toBe(5);
    });

    it('reset 后 score 归零，level 由基类重置为 1', () => {
      const { engine } = startEngine();
      engine.reset();
      expect(engine.score).toBe(0);
      // 基类 reset() 设置 _level = 1
      expect(engine.level).toBe(1);
    });

    it('destroy 不抛异常', () => {
      const { engine } = startEngine();
      expect(() => engine.destroy()).not.toThrow();
    });
  });

  // ==================== T12: Glider 运动验证 ====================
  describe('Glider 运动验证', () => {
    it('Glider 推进 4 代后保持 5 个活细胞（经典对角移动）', () => {
      const { engine } = startEngine();
      let grid = getGrid(engine);

      // 记录初始活细胞位置
      const getAlivePositions = (g: boolean[][]): string[] => {
        const positions: string[] = [];
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            if (g[r][c]) positions.push(`${r},${c}`);
          }
        }
        return positions.sort();
      };

      const initialAlive = getAlivePositions(grid);
      expect(initialAlive.length).toBe(5);

      // 推进 4 代
      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      for (let i = 0; i < 4; i++) {
        advanceUpdate(engine, tickInterval);
      }

      grid = getGrid(engine);
      const afterAlive = getAlivePositions(grid);

      // 活细胞数应仍为 5（Glider 是移动图案）
      expect(afterAlive.length).toBe(5);

      // Glider 应向右下方移动（row+1, col+1）
      for (let i = 0; i < initialAlive.length; i++) {
        const [ir, ic] = initialAlive[i].split(',').map(Number);
        const [ar, ac] = afterAlive[i].split(',').map(Number);
        expect(ar).toBe(ir + 1);
        expect(ac).toBe(ic + 1);
      }
    });
  });

  // ==================== T13: 2x2 Block 静物验证 ====================
  describe('静物验证', () => {
    it('2x2 Block 推进多代不变', () => {
      const { engine } = startEngine();
      const grid = getGrid(engine);

      // 清空并放置 2x2 方块
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          grid[r][c] = false;
        }
      }
      grid[10][10] = true;
      grid[10][11] = true;
      grid[11][10] = true;
      grid[11][11] = true;
      (engine as any).countAliveCells();

      // 推进 10 代
      const tickInterval = 1000 / SPEED_LEVELS[(engine as any).speedIndex];
      for (let i = 0; i < 10; i++) {
        advanceUpdate(engine, tickInterval);
      }

      // 2x2 方块应保持不变
      expect(grid[10][10]).toBe(true);
      expect(grid[10][11]).toBe(true);
      expect(grid[11][10]).toBe(true);
      expect(grid[11][11]).toBe(true);
      expect((engine as any).aliveCells).toBe(4);
    });
  });

  // ==================== T14: handleKeyUp ====================
  describe('handleKeyUp', () => {
    it('handleKeyUp 不抛异常', () => {
      const { engine } = startEngine();
      expect(() => {
        engine.handleKeyUp(' ');
        engine.handleKeyUp('ArrowUp');
        engine.handleKeyUp('Enter');
        engine.handleKeyUp('unknown');
      }).not.toThrow();
    });
  });

  // ==================== T15: getState 返回网格副本 ====================
  describe('getState 网格副本', () => {
    it('getState 返回的 grid 是副本，不影响内部状态', () => {
      const { engine } = startEngine();
      const state1 = engine.getState();
      const gridCopy = state1.grid as boolean[][];

      // 修改返回的 grid
      gridCopy[0][0] = true;

      // 内部 grid 不应受影响
      expect(getGrid(engine)[0][0]).toBe(false);
    });
  });

  // ==================== T16: 累积时间精度 ====================
  describe('累积时间', () => {
    it('累积时间正确累加和消耗', () => {
      const { engine } = startEngine();
      engine.handleKeyDown('3'); // 5 代/秒 = 200ms

      // 先暂停
      engine.handleKeyDown(' ');
      // 重置 accumulatedTime
      (engine as any).accumulatedTime = 0;
      // 恢复
      engine.handleKeyDown(' ');

      const gen0 = (engine as any).generation;

      // 150ms 不够
      advanceUpdate(engine, 150);
      expect((engine as any).generation).toBe(gen0);

      // 再 100ms，累计 250ms > 200ms，触发一代
      advanceUpdate(engine, 100);
      expect((engine as any).generation).toBe(gen0 + 1);
      // 剩余 50ms
      expect((engine as any).accumulatedTime).toBe(50);
    });
  });
});
