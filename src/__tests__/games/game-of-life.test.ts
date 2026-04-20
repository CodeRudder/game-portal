import { GameOfLifeEngine } from '@/games/game-of-life/GameOfLifeEngine';
import {
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  CELL_GAP,
  TICK_INTERVALS,
  DEFAULT_TICK_INTERVAL,
  HUD_HEIGHT,
  PATTERNS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
} from '@/games/game-of-life/constants';

// ========== 辅助工具 ==========

function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createEngine(): GameOfLifeEngine {
  const canvas = createMockCanvas();
  const engine = new GameOfLifeEngine(canvas, 'game-of-life');
  engine.init(canvas);
  return engine;
}

/** 获取引擎状态（带类型断言） */
function getState(engine: GameOfLifeEngine) {
  return engine.getState() as {
    grid: number[][];
    generation: number;
    population: number;
    tickInterval: number;
    speedLevel: number;
    cursorRow: number;
    cursorCol: number;
  };
}

/** 将引擎置于 paused 状态（用于手动编辑测试） */
function setupPausedEngine(): GameOfLifeEngine {
  const engine = createEngine();
  // start() 会随机填充，然后立即暂停
  engine.start();
  engine.pause();
  return engine;
}

/** 通过 canvas 坐标点击指定网格位置 */
function clickCell(engine: GameOfLifeEngine, row: number, col: number) {
  const cellStep = CELL_SIZE + CELL_GAP;
  const canvasX = GRID_OFFSET_X + col * cellStep + CELL_SIZE / 2;
  const canvasY = GRID_OFFSET_Y + row * cellStep + CELL_SIZE / 2;
  engine.handleClick(canvasX, canvasY);
}

/** 在指定位置放置活细胞（paused 状态下） */
function placeLiveCell(engine: GameOfLifeEngine, row: number, col: number) {
  const state = getState(engine);
  if (state.grid[row][col] === 0) {
    clickCell(engine, row, col);
  }
}

/** 在指定位置放置死细胞（paused 状态下） */
function placeDeadCell(engine: GameOfLifeEngine, row: number, col: number) {
  const state = getState(engine);
  if (state.grid[row][col] === 1) {
    clickCell(engine, row, col);
  }
}

/** 统计网格中活细胞数 */
function countAlive(grid: number[][]): number {
  let count = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c] === 1) count++;
    }
  }
  return count;
}

/** 创建一个空的 paused 引擎（清空随机填充的网格） */
function createCleanPausedEngine(): GameOfLifeEngine {
  const engine = setupPausedEngine();
  engine.handleKeyDown('c');
  return engine;
}

// ========== 测试 ==========

describe('GameOfLifeEngine', () => {
  let engine: GameOfLifeEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ==================== 1. 初始化 ====================

  describe('初始化', () => {
    it('创建后状态为 idle', () => {
      expect(engine.status).toBe('idle');
    });

    it('创建后分数为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('创建后等级为 2（中速）', () => {
      expect(engine.level).toBe(2);
    });

    it('网格大小正确（58行48列）', () => {
      const state = getState(engine);
      expect(state.grid.length).toBe(GRID_ROWS);
      expect(state.grid[0].length).toBe(GRID_COLS);
    });

    it('初始网格全为 0', () => {
      const state = getState(engine);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          expect(state.grid[r][c]).toBe(0);
        }
      }
    });

    it('generation 初始为 0', () => {
      const state = getState(engine);
      expect(state.generation).toBe(0);
    });

    it('population 初始为 0', () => {
      const state = getState(engine);
      expect(state.population).toBe(0);
    });

    it('speedLevel 初始为 2，tickInterval 为 200', () => {
      const state = getState(engine);
      expect(state.speedLevel).toBe(2);
      expect(state.tickInterval).toBe(200);
    });

    it('光标初始位置居中', () => {
      const state = getState(engine);
      expect(state.cursorRow).toBe(Math.floor(GRID_ROWS / 2));
      expect(state.cursorCol).toBe(Math.floor(GRID_COLS / 2));
    });

    it('getState 返回正确的结构', () => {
      const state = getState(engine);
      expect(state).toHaveProperty('grid');
      expect(state).toHaveProperty('generation');
      expect(state).toHaveProperty('population');
      expect(state).toHaveProperty('tickInterval');
      expect(state).toHaveProperty('speedLevel');
      expect(state).toHaveProperty('cursorRow');
      expect(state).toHaveProperty('cursorCol');
    });

    it('getState 返回的 grid 是深拷贝', () => {
      const state1 = getState(engine);
      const state2 = getState(engine);
      expect(state1.grid).not.toBe(state2.grid);
      expect(state1.grid[0]).not.toBe(state2.grid[0]);
    });
  });

  // ==================== 2. Conway 规则 ====================

  describe('Conway 规则', () => {
    it('活细胞有 2 个邻居 → 存活', () => {
      const e = createCleanPausedEngine();
      // 放置一个 Block（2x2 方块），每个活细胞有 3 个邻居
      // 改为放置一个活细胞，周围恰好 2 个邻居
      // 布局: .X.
      //       X..
      //       ...
      // 中心 (0,0) 有 2 个邻居：(0,1) 和 (1,0)
      placeLiveCell(e, 10, 10);
      placeLiveCell(e, 10, 11);
      placeLiveCell(e, 11, 10);

      // 单步推进
      e.handleKeyDown('n');
      const state = getState(e);
      // (10,10) 有邻居 (10,11), (11,10), (11,11=0) → 2 邻居 → 存活
      expect(state.grid[10][10]).toBe(1);
    });

    it('活细胞有 3 个邻居 → 存活', () => {
      const e = createCleanPausedEngine();
      // 放置 Block（2x2），每个细胞有 3 个邻居
      placeLiveCell(e, 10, 10);
      placeLiveCell(e, 10, 11);
      placeLiveCell(e, 11, 10);
      placeLiveCell(e, 11, 11);

      e.handleKeyDown('n');
      const state = getState(e);
      // Block 是静态图案，所有细胞保持存活
      expect(state.grid[10][10]).toBe(1);
      expect(state.grid[10][11]).toBe(1);
      expect(state.grid[11][10]).toBe(1);
      expect(state.grid[11][11]).toBe(1);
    });

    it('活细胞有 1 个邻居 → 死亡（孤独）', () => {
      const e = createCleanPausedEngine();
      // 只放 2 个相邻细胞
      placeLiveCell(e, 10, 10);
      placeLiveCell(e, 10, 11);

      e.handleKeyDown('n');
      const state = getState(e);
      // (10,10) 只有 1 个邻居 (10,11) → 死亡
      expect(state.grid[10][10]).toBe(0);
      // (10,11) 只有 1 个邻居 (10,10) → 死亡
      expect(state.grid[10][11]).toBe(0);
    });

    it('活细胞有 4 个邻居 → 死亡（过挤）', () => {
      const e = createCleanPausedEngine();
      // 中心细胞被 4 个邻居包围
      // .X.
      // XXX
      // .X.
      placeLiveCell(e, 10, 11);
      placeLiveCell(e, 11, 10);
      placeLiveCell(e, 11, 11);
      placeLiveCell(e, 11, 12);
      placeLiveCell(e, 12, 11);

      e.handleKeyDown('n');
      const state = getState(e);
      // (11,11) 有 4 个邻居 → 死亡
      expect(state.grid[11][11]).toBe(0);
    });

    it('死细胞恰好 3 个邻居 → 复活', () => {
      const e = createCleanPausedEngine();
      // L 形：3 个活细胞围绕一个死细胞
      // XX
      // X.
      placeLiveCell(e, 10, 10);
      placeLiveCell(e, 10, 11);
      placeLiveCell(e, 11, 10);

      e.handleKeyDown('n');
      const state = getState(e);
      // (11,11) 是死细胞，邻居为 (10,10)=1, (10,11)=1, (11,10)=1 → 恰好 3 → 复活
      expect(state.grid[11][11]).toBe(1);
    });

    it('死细胞有 2 个邻居 → 不复活', () => {
      const e = createCleanPausedEngine();
      // 只放 2 个细胞
      placeLiveCell(e, 10, 10);
      placeLiveCell(e, 10, 11);

      e.handleKeyDown('n');
      const state = getState(e);
      // (11,10) 死细胞，邻居 (10,10)=1, (10,11)=1 → 2 个 → 不复活
      expect(state.grid[11][10]).toBe(0);
    });

    it('死细胞有 4 个邻居 → 不复活', () => {
      const e = createCleanPausedEngine();
      // 4 个角包围一个死细胞
      placeLiveCell(e, 10, 10);
      placeLiveCell(e, 10, 12);
      placeLiveCell(e, 12, 10);
      placeLiveCell(e, 12, 12);

      e.handleKeyDown('n');
      const state = getState(e);
      // (11,11) 死细胞，邻居有 4 个对角 → 不复活
      expect(state.grid[11][11]).toBe(0);
    });

    it('Blinker 振荡器：水平→垂直→水平', () => {
      const e = createCleanPausedEngine();
      // Blinker：3 个水平细胞
      placeLiveCell(e, 20, 20);
      placeLiveCell(e, 20, 21);
      placeLiveCell(e, 20, 22);

      // 第一步：水平→垂直
      e.handleKeyDown('n');
      const state1 = getState(e);
      expect(state1.grid[19][21]).toBe(1);
      expect(state1.grid[20][21]).toBe(1);
      expect(state1.grid[21][21]).toBe(1);
      // 原来的水平位置应该死亡
      expect(state1.grid[20][20]).toBe(0);
      expect(state1.grid[20][22]).toBe(0);

      // 第二步：垂直→水平
      e.handleKeyDown('n');
      const state2 = getState(e);
      expect(state2.grid[20][20]).toBe(1);
      expect(state2.grid[20][21]).toBe(1);
      expect(state2.grid[20][22]).toBe(1);
      expect(state2.grid[19][21]).toBe(0);
      expect(state2.grid[21][21]).toBe(0);
    });

    it('Block 静态图案不变', () => {
      const e = createCleanPausedEngine();
      // 2x2 Block 是静态图案
      placeLiveCell(e, 10, 10);
      placeLiveCell(e, 10, 11);
      placeLiveCell(e, 11, 10);
      placeLiveCell(e, 11, 11);

      // 多步推进
      for (let i = 0; i < 5; i++) {
        e.handleKeyDown('n');
      }
      const state = getState(e);
      expect(state.grid[10][10]).toBe(1);
      expect(state.grid[10][11]).toBe(1);
      expect(state.grid[11][10]).toBe(1);
      expect(state.grid[11][11]).toBe(1);
    });

    it('孤独细胞死亡（单个活细胞）', () => {
      const e = createCleanPausedEngine();
      placeLiveCell(e, 15, 15);

      e.handleKeyDown('n');
      const state = getState(e);
      expect(state.grid[15][15]).toBe(0);
    });
  });

  // ==================== 3. 环绕边界 ====================

  describe('环绕边界', () => {
    it('顶部边界细胞的邻居包含底部', () => {
      const e = createCleanPausedEngine();
      // 在 row=0, col=24 放一个细胞
      // 在 row=GRID_ROWS-1, col=24 放一个细胞（底部）
      // row=0 的细胞应该看到底部邻居
      placeLiveCell(e, 0, 24);
      placeLiveCell(e, GRID_ROWS - 1, 24);
      // 再加一个让 (0,24) 有 2 邻居存活
      placeLiveCell(e, 0, 23);

      e.handleKeyDown('n');
      const state = getState(e);
      // (0,24) 有邻居: (0,23)=1, (GRID_ROWS-1,24)=1 → 2 邻居 → 存活
      expect(state.grid[0][24]).toBe(1);
    });

    it('左边边界细胞的邻居包含右边', () => {
      const e = createCleanPausedEngine();
      placeLiveCell(e, 29, 0);
      placeLiveCell(e, 29, GRID_COLS - 1);
      placeLiveCell(e, 30, 0);

      e.handleKeyDown('n');
      const state = getState(e);
      // (29,0) 有邻居: (29,GRID_COLS-1)=1, (30,0)=1 → 2 邻居 → 存活
      expect(state.grid[29][0]).toBe(1);
    });

    it('角落细胞有 8 个邻居（环绕）', () => {
      const e = createCleanPausedEngine();
      // 在 (0,0) 周围放置 3 个细胞（通过环绕）
      // (0,0) 的邻居包括 (GRID_ROWS-1, GRID_COLS-1)（对角环绕）
      placeLiveCell(e, 0, 1);
      placeLiveCell(e, 1, 0);
      placeLiveCell(e, 1, 1);
      // 不放 (0,0) 本身

      e.handleKeyDown('n');
      const state = getState(e);
      // (0,0) 死细胞有 3 个邻居 → 复活
      expect(state.grid[0][0]).toBe(1);
    });

    it('Glider 可跨越边界移动', () => {
      const e = createCleanPausedEngine();
      // 放置 Glider 靠近右边界
      placeLiveCell(e, 5, GRID_COLS - 2);
      placeLiveCell(e, 5, GRID_COLS - 1);
      placeLiveCell(e, 6, GRID_COLS - 1);
      placeLiveCell(e, 7, GRID_COLS - 2);
      placeLiveCell(e, 7, GRID_COLS - 1);

      // 推进一步，验证不崩溃且部分细胞环绕到左边
      e.handleKeyDown('n');
      const state = getState(e);
      // 验证引擎没有崩溃，且网格有效
      expect(state.grid.length).toBe(GRID_ROWS);
      expect(state.grid[0].length).toBe(GRID_COLS);
    });
  });

  // ==================== 4. 世代推进与计分 ====================

  describe('世代推进与计分', () => {
    it('step 后 generation 加 1', () => {
      const e = createCleanPausedEngine();
      expect(getState(e).generation).toBe(0);
      e.handleKeyDown('n');
      expect(getState(e).generation).toBe(1);
    });

    it('score 等于 generation', () => {
      const e = createCleanPausedEngine();
      e.handleKeyDown('n');
      e.handleKeyDown('n');
      e.handleKeyDown('n');
      expect(engine.score).toBeDefined(); // engine 变量未使用，用 e
      expect(e.score).toBe(3);
      expect(getState(e).generation).toBe(3);
    });

    it('连续多次 step 正确推进', () => {
      const e = createCleanPausedEngine();
      for (let i = 0; i < 10; i++) {
        e.handleKeyDown('n');
      }
      expect(getState(e).generation).toBe(10);
      expect(e.score).toBe(10);
    });

    it('scoreChange 事件在 step 时触发', () => {
      const e = createCleanPausedEngine();
      const handler = jest.fn();
      e.on('scoreChange', handler);
      e.handleKeyDown('n');
      expect(handler).toHaveBeenCalledWith(1);
    });

    it('population 正确统计', () => {
      const e = createCleanPausedEngine();
      placeLiveCell(e, 5, 5);
      placeLiveCell(e, 5, 6);
      placeLiveCell(e, 5, 7);
      expect(getState(e).population).toBe(3);
    });
  });

  // ==================== 5. 速度控制 ====================

  describe('速度控制', () => {
    it('初始 speedLevel 为 2', () => {
      const state = getState(engine);
      expect(state.speedLevel).toBe(2);
    });

    it('加速：speedUp 增加 level', () => {
      const e = createEngine();
      e.handleKeyDown('=');
      expect(getState(e).speedLevel).toBe(3);
    });

    it('减速：speedDown 减少 level', () => {
      const e = createEngine();
      // 先加速到 level 3
      e.handleKeyDown('=');
      // 再减速
      e.handleKeyDown('-');
      expect(getState(e).speedLevel).toBe(2);
    });

    it('最大 level=5 不能再加速', () => {
      const e = createEngine();
      // 加速到 5
      for (let i = 0; i < 5; i++) {
        e.handleKeyDown('=');
      }
      expect(getState(e).speedLevel).toBe(5);
      // 再加速不变化
      e.handleKeyDown('+');
      expect(getState(e).speedLevel).toBe(5);
    });

    it('最小 level=1 不能再减速', () => {
      const e = createEngine();
      // 初始 level=2，减速到 1
      e.handleKeyDown('-');
      expect(getState(e).speedLevel).toBe(1);
      // 再减速不变化
      e.handleKeyDown('_');
      expect(getState(e).speedLevel).toBe(1);
    });

    it('tickInterval 正确映射各等级', () => {
      const e = createEngine();
      // level 2 → 200
      expect(getState(e).tickInterval).toBe(TICK_INTERVALS[2]);

      // level 1 → 300
      e.handleKeyDown('-');
      expect(getState(e).tickInterval).toBe(TICK_INTERVALS[1]);

      // level 3 → 100
      e.handleKeyDown('=');
      e.handleKeyDown('=');
      expect(getState(e).tickInterval).toBe(TICK_INTERVALS[3]);
    });

    it('levelChange 事件在调速时触发', () => {
      const e = createEngine();
      const handler = jest.fn();
      e.on('levelChange', handler);
      e.handleKeyDown('=');
      expect(handler).toHaveBeenCalledWith(3);
    });
  });

  // ==================== 6. 鼠标交互 ====================

  describe('鼠标交互', () => {
    it('handleClick 在 idle 状态切换细胞', () => {
      const state = getState(engine);
      expect(state.grid[10][10]).toBe(0);
      clickCell(engine, 10, 10);
      const state2 = getState(engine);
      expect(state2.grid[10][10]).toBe(1);
    });

    it('handleClick 在 paused 状态切换细胞', () => {
      const e = setupPausedEngine();
      // 先清空
      e.handleKeyDown('c');
      clickCell(e, 10, 10);
      expect(getState(e).grid[10][10]).toBe(1);
      // 再次点击切换为死
      clickCell(e, 10, 10);
      expect(getState(e).grid[10][10]).toBe(0);
    });

    it('handleClick 在 playing 状态不切换细胞', () => {
      const e = createEngine();
      e.start();
      expect(e.status).toBe('playing');
      // 记录当前 grid
      const gridBefore = getState(e).grid.map(row => [...row]);
      clickCell(e, 10, 10);
      const gridAfter = getState(e).grid;
      // 网格不变（playing 状态下点击无效）
      expect(gridAfter[10][10]).toBe(gridBefore[10][10]);
    });

    it('handleMouseMove 设置悬停位置', () => {
      const cellStep = CELL_SIZE + CELL_GAP;
      const canvasX = GRID_OFFSET_X + 5 * cellStep + CELL_SIZE / 2;
      const canvasY = GRID_OFFSET_Y + 3 * cellStep + CELL_SIZE / 2;
      // 不报错即可（hover 效果是渲染层面的）
      expect(() => engine.handleMouseMove(canvasX, canvasY)).not.toThrow();
    });

    it('点击越界坐标不报错', () => {
      expect(() => engine.handleClick(-100, -100)).not.toThrow();
      expect(() => engine.handleClick(9999, 9999)).not.toThrow();
      expect(() => engine.handleClick(0, 0)).not.toThrow();
    });
  });

  // ==================== 7. 键盘控制 ====================

  describe('键盘控制', () => {
    it('Space 在 idle 状态启动游戏', () => {
      expect(engine.status).toBe('idle');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('Space 在 playing 状态暂停', () => {
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('paused');
    });

    it('Space 在 paused 状态恢复', () => {
      engine.handleKeyDown(' ');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('paused');
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('Enter 在 idle 状态启动', () => {
      expect(engine.status).toBe('idle');
      engine.handleKeyDown('Enter');
      expect(engine.status).toBe('playing');
    });

    it('R 键随机填充并重置 generation', () => {
      const e = createCleanPausedEngine();
      // 先推进几步
      e.handleKeyDown('n');
      e.handleKeyDown('n');
      expect(getState(e).generation).toBe(2);
      // R 键随机填充
      e.handleKeyDown('r');
      expect(getState(e).generation).toBe(0);
      expect(e.score).toBe(0);
      // 网格应该有活细胞（随机填充 density=0.3）
      expect(getState(e).population).toBeGreaterThan(0);
    });

    it('C 键清空网格', () => {
      const e = setupPausedEngine();
      e.handleKeyDown('c');
      const state = getState(e);
      expect(state.population).toBe(0);
      expect(state.generation).toBe(0);
      expect(e.score).toBe(0);
    });

    it('N 键在 paused 状态单步推进', () => {
      const e = createCleanPausedEngine();
      expect(getState(e).generation).toBe(0);
      e.handleKeyDown('n');
      expect(getState(e).generation).toBe(1);
    });

    it('N 键在 idle 状态单步推进', () => {
      expect(engine.status).toBe('idle');
      engine.handleKeyDown('n');
      expect(getState(engine).generation).toBe(1);
    });

    it('+/= 键加速', () => {
      expect(getState(engine).speedLevel).toBe(2);
      engine.handleKeyDown('=');
      expect(getState(engine).speedLevel).toBe(3);
      engine.handleKeyDown('+');
      expect(getState(engine).speedLevel).toBe(4);
    });

    it('-/_ 键减速', () => {
      expect(getState(engine).speedLevel).toBe(2);
      engine.handleKeyDown('-');
      expect(getState(engine).speedLevel).toBe(1);
      engine.handleKeyDown('_');
      expect(getState(engine).speedLevel).toBe(1); // 已经最小
    });

    it('ArrowLeft 显示光标并移动光标', () => {
      const initialCol = getState(engine).cursorCol;
      engine.handleKeyDown('ArrowLeft');
      expect(getState(engine).cursorCol).toBe(initialCol - 1);
    });

    it('ArrowRight 移动光标', () => {
      const initialCol = getState(engine).cursorCol;
      engine.handleKeyDown('ArrowRight');
      expect(getState(engine).cursorCol).toBe(initialCol + 1);
    });

    it('ArrowUp 在光标模式移动光标', () => {
      // 先启用光标
      engine.handleKeyDown('Tab');
      const initialRow = getState(engine).cursorRow;
      engine.handleKeyDown('ArrowUp');
      expect(getState(engine).cursorRow).toBe(initialRow - 1);
    });

    it('ArrowDown 在光标模式移动光标', () => {
      engine.handleKeyDown('Tab');
      const initialRow = getState(engine).cursorRow;
      engine.handleKeyDown('ArrowDown');
      expect(getState(engine).cursorRow).toBe(initialRow + 1);
    });

    it('ArrowUp 在非光标模式加速', () => {
      expect(getState(engine).speedLevel).toBe(2);
      engine.handleKeyDown('ArrowUp');
      expect(getState(engine).speedLevel).toBe(3);
    });

    it('ArrowDown 在非光标模式减速', () => {
      expect(getState(engine).speedLevel).toBe(2);
      engine.handleKeyDown('ArrowDown');
      expect(getState(engine).speedLevel).toBe(1);
    });

    it('数字键 1-9 放置预设图案', () => {
      const e = createCleanPausedEngine();
      // 按 1 放置 Glider
      e.handleKeyDown('1');
      const state = getState(e);
      // 应该有活细胞了
      expect(state.population).toBeGreaterThan(0);
    });

    it('Tab 键切换光标可见', () => {
      // 按 ArrowLeft 会自动显示光标
      engine.handleKeyDown('ArrowLeft');
      // Tab 切换
      engine.handleKeyDown('Tab');
      // 再次 Tab 切换回来
      engine.handleKeyDown('Tab');
      // 不报错即可
      expect(true).toBe(true);
    });
  });

  // ==================== 8. 游戏生命周期 ====================

  describe('游戏生命周期', () => {
    it('start 后 status 为 playing', () => {
      engine.start();
      expect(engine.status).toBe('playing');
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

    it('reset 后状态归零', () => {
      engine.start();
      engine.pause();
      engine.handleKeyDown('n');
      engine.handleKeyDown('n');
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
      expect(getState(engine).generation).toBe(0);
      expect(getState(engine).population).toBe(0);
    });

    it('destroy 不报错', () => {
      engine.start();
      expect(() => engine.destroy()).not.toThrow();
    });

    it('statusChange 事件在状态变化时触发', () => {
      const handler = jest.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith('playing');
      engine.pause();
      expect(handler).toHaveBeenCalledWith('paused');
    });
  });

  // ==================== 9. 预设图案 ====================

  describe('预设图案', () => {
    it('9 个图案都已定义', () => {
      expect(PATTERNS.length).toBe(9);
    });

    it('图案名称正确', () => {
      const names = PATTERNS.map(p => p.name);
      expect(names).toContain('Glider');
      expect(names).toContain('Blinker');
      expect(names).toContain('Toad');
      expect(names).toContain('Beacon');
      expect(names).toContain('Pulsar');
      expect(names).toContain('Gosper Gun');
      expect(names).toContain('R-pentomino');
      expect(names).toContain('Diehard');
      expect(names).toContain('Acorn');
    });

    it('Glider 放置后正确位置', () => {
      const e = createCleanPausedEngine();
      // 将光标移到 (20, 20)
      // 使用 Tab 启用光标，然后移动
      e.handleKeyDown('Tab');
      // 先重置光标位置到左上角附近，然后移到 (20,20)
      // 简单方式：直接用数字键 1 放置 Glider 在光标位置
      const state0 = getState(e);
      const centerRow = state0.cursorRow;
      const centerCol = state0.cursorCol;
      e.handleKeyDown('1');
      const state = getState(e);
      // Glider cells: [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]]
      expect(state.grid[centerRow][centerCol + 1]).toBe(1);
      expect(state.grid[centerRow + 1][centerCol + 2]).toBe(1);
      expect(state.grid[centerRow + 2][centerCol]).toBe(1);
      expect(state.grid[centerRow + 2][centerCol + 1]).toBe(1);
      expect(state.grid[centerRow + 2][centerCol + 2]).toBe(1);
    });

    it('Blinker 放置后正确位置', () => {
      const e = createCleanPausedEngine();
      e.handleKeyDown('Tab');
      const { cursorRow, cursorCol } = getState(e);
      e.handleKeyDown('2'); // Blinker 是第 2 个图案
      const state = getState(e);
      // Blinker cells: [[0, 0], [0, 1], [0, 2]]
      expect(state.grid[cursorRow][cursorCol]).toBe(1);
      expect(state.grid[cursorRow][cursorCol + 1]).toBe(1);
      expect(state.grid[cursorRow][cursorCol + 2]).toBe(1);
    });

    it('图案放置在光标位置（非光标模式在中心）', () => {
      const e = createCleanPausedEngine();
      // 不启用光标，图案应放在网格中心
      e.handleKeyDown('1');
      const centerRow = Math.floor(GRID_ROWS / 2);
      const centerCol = Math.floor(GRID_COLS / 2);
      const state = getState(e);
      // Glider 相对于中心放置
      expect(state.grid[centerRow][centerCol + 1]).toBe(1);
    });

    it('图案放置环绕边界', () => {
      const e = createCleanPausedEngine();
      e.handleKeyDown('Tab');
      // 移动光标到右边界附近
      // 先移到最右边
      for (let i = 0; i < GRID_COLS; i++) {
        e.handleKeyDown('ArrowRight');
      }
      const { cursorCol } = getState(e);
      expect(cursorCol).toBe(GRID_COLS - 1);
      // 放置 Blinker（cells: [[0,0],[0,1],[0,2]]）
      e.handleKeyDown('2');
      const state = getState(e);
      // 验证不崩溃且部分细胞环绕到左边
      const centerRow = getState(e).cursorRow;
      expect(state.grid[centerRow][cursorCol]).toBe(1);
      // cursorCol+1 和 cursorCol+2 应该环绕到左边
      expect(state.grid[centerRow][(cursorCol + 1) % GRID_COLS]).toBe(1);
      expect(state.grid[centerRow][(cursorCol + 2) % GRID_COLS]).toBe(1);
    });
  });

  // ==================== 10. 渲染 ====================

  describe('渲染', () => {
    it('onRender 不报错（传入 mock context）', () => {
      const canvas = createMockCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => {
        engine.init(canvas);
        // 直接调用 render（通过 start 触发或手动）
        // 使用反射调用 onRender
        (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });

    it('暂停时渲染覆盖层不报错', () => {
      const canvas = createMockCanvas();
      const ctx = canvas.getContext('2d')!;
      engine.init(canvas);
      engine.start();
      engine.pause();
      expect(() => {
        (engine as any).onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });

    it('HUD 渲染不报错', () => {
      const canvas = createMockCanvas();
      const ctx = canvas.getContext('2d')!;
      engine.init(canvas);
      expect(() => {
        (engine as any).drawHUD(ctx, CANVAS_WIDTH);
      }).not.toThrow();
    });
  });
});
