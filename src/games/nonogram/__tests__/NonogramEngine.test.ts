import { NonogramEngine } from '../NonogramEngine';
import {
  CellState,
  Difficulty,
  DIFFICULTY_SIZE,
  PRESET_PUZZLES,
} from '../constants';

// ========== 辅助函数 ==========

/** 创建 mock canvas */
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

/** 创建并初始化引擎（使用 mock canvas） */
function createEngine(difficulty: Difficulty = Difficulty.EASY): NonogramEngine {
  const engine = new NonogramEngine();
  engine.init(createMockCanvas());
  return engine;
}

/** 创建5×5爱心谜题的解决方案 */
function createHeartSolution(): number[][] {
  return [
    [0, 1, 0, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
  ];
}

/** 创建全空解决方案 */
function createEmptySolution(size: number): number[][] {
  return Array.from({ length: size }, () => new Array(size).fill(0));
}

/** 创建全满解决方案 */
function createFullSolution(size: number): number[][] {
  return Array.from({ length: size }, () => new Array(size).fill(1));
}

/** 创建棋盘格解决方案 */
function createCheckerSolution(size: number): number[][] {
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (r + c) % 2)
  );
}

/** 填充整个网格（匹配解决方案） */
function fillAllCorrect(engine: NonogramEngine): void {
  const state = engine.getState() as any;
  const solution = state.solution as number[][];
  const size = state.gridSize as number;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (solution[r][c] === 1) {
        engine.setCursor(r, c);
        engine.toggleFill();
      }
    }
  }
}

// ========== 测试开始 ==========

describe('NonogramEngine', () => {
  let engine: NonogramEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ==========================================
  // 1. 初始化测试
  // ==========================================
  describe('初始化', () => {
    it('应该正确初始化引擎', () => {
      expect(engine).toBeDefined();
      expect(engine.score).toBe(0);
      expect(engine.level).toBe(1);
      expect(engine.status).toBe('idle');
    });

    it('默认应该是 EASY 难度', () => {
      expect(engine.currentDifficulty).toBe(Difficulty.EASY);
    });

    it('默认网格大小应该是 5×5', () => {
      expect(engine.currentGridSize).toBe(5);
    });

    it('初始化后网格应该全部为空', () => {
      const state = engine.getState() as any;
      const grid = state.grid as CellState[][];
      for (const row of grid) {
        for (const cell of row) {
          expect(cell).toBe(CellState.EMPTY);
        }
      }
    });

    it('初始化后光标应该在 (0, 0)', () => {
      const state = engine.getState() as any;
      expect(state.cursor).toEqual({ row: 0, col: 0 });
    });

    it('初始化后不应该完成', () => {
      const state = engine.getState() as any;
      expect(state.isComplete).toBe(false);
    });

    it('初始化后不应该有错误', () => {
      expect(engine.hasErrorsInGrid()).toBe(false);
    });
  });

  // ==========================================
  // 2. 提示计算测试
  // ==========================================
  describe('提示计算', () => {
    it('应该正确计算全空行的提示', () => {
      expect(engine.calculateLineClues([0, 0, 0, 0, 0])).toEqual([0]);
    });

    it('应该正确计算全满行的提示', () => {
      expect(engine.calculateLineClues([1, 1, 1, 1, 1])).toEqual([5]);
    });

    it('应该正确计算单格涂色的提示', () => {
      expect(engine.calculateLineClues([1, 0, 0, 0, 0])).toEqual([1]);
      expect(engine.calculateLineClues([0, 0, 0, 0, 1])).toEqual([1]);
      expect(engine.calculateLineClues([0, 0, 1, 0, 0])).toEqual([1]);
    });

    it('应该正确计算多段涂色的提示', () => {
      expect(engine.calculateLineClues([1, 1, 0, 1, 0])).toEqual([2, 1]);
      expect(engine.calculateLineClues([1, 0, 1, 0, 1])).toEqual([1, 1, 1]);
      expect(engine.calculateLineClues([0, 1, 1, 0, 1])).toEqual([2, 1]);
    });

    it('应该正确计算爱心图案的行提示', () => {
      const solution = createHeartSolution();
      const clues = engine.calculateRowClues(solution);
      expect(clues[0]).toEqual([1, 1]);  // 0,1,0,1,0
      expect(clues[1]).toEqual([5]);      // 1,1,1,1,1
      expect(clues[2]).toEqual([5]);      // 1,1,1,1,1
      expect(clues[3]).toEqual([3]);      // 0,1,1,1,0
      expect(clues[4]).toEqual([1]);      // 0,0,1,0,0
    });

    it('应该正确计算爱心图案的列提示', () => {
      const solution = createHeartSolution();
      const clues = engine.calculateColClues(solution);
      expect(clues[0]).toEqual([2]);      // 0,1,1,0,0
      expect(clues[1]).toEqual([4]);      // 1,1,1,1,0
      expect(clues[2]).toEqual([4]);      // 0,1,1,1,1
      expect(clues[3]).toEqual([4]);      // 1,1,1,1,0
      expect(clues[4]).toEqual([2]);      // 0,1,1,0,0
    });

    it('应该正确计算全空解决方案的提示', () => {
      const solution = createEmptySolution(5);
      const rowClues = engine.calculateRowClues(solution);
      const colClues = engine.calculateColClues(solution);
      for (const clue of rowClues) {
        expect(clue).toEqual([0]);
      }
      for (const clue of colClues) {
        expect(clue).toEqual([0]);
      }
    });

    it('应该正确计算全满解决方案的提示', () => {
      const solution = createFullSolution(5);
      const rowClues = engine.calculateRowClues(solution);
      const colClues = engine.calculateColClues(solution);
      for (const clue of rowClues) {
        expect(clue).toEqual([5]);
      }
      for (const clue of colClues) {
        expect(clue).toEqual([5]);
      }
    });

    it('应该正确计算棋盘格的提示', () => {
      const solution = createCheckerSolution(5);
      const rowClues = engine.calculateRowClues(solution);
      // 行: 0,1,0,1,0 → [1,1], 1,0,1,0,1 → [1,1,1]
      expect(rowClues[0]).toEqual([1, 1]);
      expect(rowClues[1]).toEqual([1, 1, 1]);
      expect(rowClues[2]).toEqual([1, 1]);
      expect(rowClues[3]).toEqual([1, 1, 1]);
      expect(rowClues[4]).toEqual([1, 1]);
    });

    it('应该正确计算长段提示', () => {
      expect(engine.calculateLineClues([1, 1, 1, 0, 1, 1, 0, 1])).toEqual([3, 2, 1]);
      expect(engine.calculateLineClues([0, 0, 1, 1, 1, 1, 1, 0, 0])).toEqual([5]);
    });

    it('应该正确处理单元素行', () => {
      expect(engine.calculateLineClues([0])).toEqual([0]);
      expect(engine.calculateLineClues([1])).toEqual([1]);
    });

    it('应该正确处理空数组', () => {
      expect(engine.calculateLineClues([])).toEqual([0]);
    });
  });

  // ==========================================
  // 3. 涂色逻辑测试
  // ==========================================
  describe('涂色逻辑', () => {
    beforeEach(() => {
      engine.start();
    });

    it('空格键应该切换涂色状态', () => {
      engine.setCursor(0, 0);
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);

      engine.handleKeyDown(' ');
      expect(engine.getCell(0, 0)).toBe(CellState.FILLED);

      engine.handleKeyDown(' ');
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);
    });

    it('X键应该切换标记状态', () => {
      engine.setCursor(0, 0);
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);

      engine.handleKeyDown('x');
      expect(engine.getCell(0, 0)).toBe(CellState.MARKED);

      engine.handleKeyDown('x');
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);
    });

    it('大写X也应该切换标记状态', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown('X');
      expect(engine.getCell(0, 0)).toBe(CellState.MARKED);
    });

    it('涂色后可以再标记', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown(' ');
      expect(engine.getCell(0, 0)).toBe(CellState.FILLED);

      engine.handleKeyDown('x');
      expect(engine.getCell(0, 0)).toBe(CellState.MARKED);
    });

    it('标记后可以再涂色', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown('x');
      expect(engine.getCell(0, 0)).toBe(CellState.MARKED);

      engine.handleKeyDown(' ');
      expect(engine.getCell(0, 0)).toBe(CellState.FILLED);
    });

    it('setCell 应该正确设置格子状态', () => {
      engine.setCell(2, 3, CellState.FILLED);
      expect(engine.getCell(2, 3)).toBe(CellState.FILLED);

      engine.setCell(2, 3, CellState.MARKED);
      expect(engine.getCell(2, 3)).toBe(CellState.MARKED);

      engine.setCell(2, 3, CellState.EMPTY);
      expect(engine.getCell(2, 3)).toBe(CellState.EMPTY);
    });

    it('setCell 越界应该被忽略', () => {
      engine.setCell(-1, 0, CellState.FILLED);
      engine.setCell(0, -1, CellState.FILLED);
      engine.setCell(5, 0, CellState.FILLED);
      engine.setCell(0, 5, CellState.FILLED);
      engine.setCell(100, 100, CellState.FILLED);
      // 不应抛出异常
    });

    it('getCell 越界应该返回 EMPTY', () => {
      expect(engine.getCell(-1, 0)).toBe(CellState.EMPTY);
      expect(engine.getCell(0, -1)).toBe(CellState.EMPTY);
      expect(engine.getCell(5, 0)).toBe(CellState.EMPTY);
      expect(engine.getCell(0, 5)).toBe(CellState.EMPTY);
    });

    it('完成后不应该允许操作', () => {
      fillAllCorrect(engine);
      expect((engine.getState() as any).isComplete).toBe(true);

      const prevCell = engine.getCell(0, 0);
      engine.setCursor(0, 0);
      engine.handleKeyDown(' ');
      // 格子状态不应改变
      expect(engine.getCell(0, 0)).toBe(prevCell);
    });
  });

  // ==========================================
  // 4. 光标移动测试
  // ==========================================
  describe('光标移动', () => {
    beforeEach(() => {
      engine.start();
    });

    it('方向键下应该向下移动光标', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown('ArrowDown');
      const state = engine.getState() as any;
      expect(state.cursor.row).toBe(1);
      expect(state.cursor.col).toBe(0);
    });

    it('方向键上应该向上移动光标', () => {
      engine.setCursor(2, 0);
      engine.handleKeyDown('ArrowUp');
      const state = engine.getState() as any;
      expect(state.cursor.row).toBe(1);
    });

    it('方向键右应该向右移动光标', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown('ArrowRight');
      const state = engine.getState() as any;
      expect(state.cursor.col).toBe(1);
    });

    it('方向键左应该向左移动光标', () => {
      engine.setCursor(0, 2);
      engine.handleKeyDown('ArrowLeft');
      const state = engine.getState() as any;
      expect(state.cursor.col).toBe(1);
    });

    it('WASD 也应该移动光标', () => {
      engine.setCursor(2, 2);
      engine.handleKeyDown('w');
      expect((engine.getState() as any).cursor.row).toBe(1);

      engine.handleKeyDown('s');
      expect((engine.getState() as any).cursor.row).toBe(2);

      engine.handleKeyDown('a');
      expect((engine.getState() as any).cursor.col).toBe(1);

      engine.handleKeyDown('d');
      expect((engine.getState() as any).cursor.col).toBe(2);
    });

    it('大写 WASD 也应该移动光标', () => {
      engine.setCursor(2, 2);
      engine.handleKeyDown('W');
      expect((engine.getState() as any).cursor.row).toBe(1);
      engine.handleKeyDown('S');
      expect((engine.getState() as any).cursor.row).toBe(2);
      engine.handleKeyDown('A');
      expect((engine.getState() as any).cursor.col).toBe(1);
      engine.handleKeyDown('D');
      expect((engine.getState() as any).cursor.col).toBe(2);
    });

    it('光标不应该超出上边界', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown('ArrowUp');
      expect((engine.getState() as any).cursor.row).toBe(0);
    });

    it('光标不应该超出下边界', () => {
      engine.setCursor(4, 0);
      engine.handleKeyDown('ArrowDown');
      expect((engine.getState() as any).cursor.row).toBe(4);
    });

    it('光标不应该超出左边界', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown('ArrowLeft');
      expect((engine.getState() as any).cursor.col).toBe(0);
    });

    it('光标不应该超出右边界', () => {
      engine.setCursor(0, 4);
      engine.handleKeyDown('ArrowRight');
      expect((engine.getState() as any).cursor.col).toBe(4);
    });

    it('setCursor 应该正确设置位置', () => {
      engine.setCursor(3, 4);
      expect((engine.getState() as any).cursor).toEqual({ row: 3, col: 4 });
    });

    it('setCursor 越界应该被钳制', () => {
      engine.setCursor(-1, -1);
      expect((engine.getState() as any).cursor).toEqual({ row: 0, col: 0 });

      engine.setCursor(100, 100);
      expect((engine.getState() as any).cursor).toEqual({ row: 4, col: 4 });
    });

    it('连续移动光标应该正确', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown('ArrowRight');
      engine.handleKeyDown('ArrowRight');
      expect((engine.getState() as any).cursor).toEqual({ row: 2, col: 3 });
    });
  });

  // ==========================================
  // 5. 完成检测测试
  // ==========================================
  describe('完成检测', () => {
    beforeEach(() => {
      engine.start();
    });

    it('正确填充所有格子应该判定完成', () => {
      fillAllCorrect(engine);
      expect((engine.getState() as any).isComplete).toBe(true);
    });

    it('部分填充不应该判定完成', () => {
      engine.setCursor(0, 1);
      engine.handleKeyDown(' ');
      expect((engine.getState() as any).isComplete).toBe(false);
    });

    it('全部涂色但有多余格子不应该完成', () => {
      // 全部涂色（包括应该空的格子）
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          engine.setCell(r, c, CellState.FILLED);
        }
      }
      expect((engine.getState() as any).isComplete).toBe(false);
    });

    it('checkCompletion 应该在完全匹配时返回 true', () => {
      const state = engine.getState() as any;
      const solution = state.solution as number[][];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (solution[r][c] === 1) {
            engine.setCell(r, c, CellState.FILLED);
          }
        }
      }
      // 需要最后一次触发 checkCompletion
      expect((engine.getState() as any).isComplete).toBe(true);
    });

    it('完成后应该计算得分', () => {
      fillAllCorrect(engine);
      expect(engine.score).toBeGreaterThan(0);
    });

    it('完成后应该触发 gameover 状态', () => {
      fillAllCorrect(engine);
      expect(engine.status).toBe('gameover');
    });

    it('isWin 应该反映完成状态', () => {
      expect(engine.isWin).toBe(false);
      fillAllCorrect(engine);
      expect(engine.isWin).toBe(true);
    });

    it('行完成检测应该正确', () => {
      const state = engine.getState() as any;
      const solution = state.solution as number[][];
      // 填满第一行
      for (let c = 0; c < 5; c++) {
        if (solution[0][c] === 1) {
          engine.setCell(0, c, CellState.FILLED);
        }
      }
      // 检查第一行的提示是否匹配
      const playerClues = engine.getPlayerRowClues(0);
      const expectedClues = state.rowClues[0];
      expect(playerClues).toEqual(expectedClues);
    });

    it('列完成检测应该正确', () => {
      const state = engine.getState() as any;
      const solution = state.solution as number[][];
      // 填满第一列
      for (let r = 0; r < 5; r++) {
        if (solution[r][0] === 1) {
          engine.setCell(r, 0, CellState.FILLED);
        }
      }
      const playerClues = engine.getPlayerColClues(0);
      const expectedClues = state.colClues[0];
      expect(playerClues).toEqual(expectedClues);
    });

    it('isRowComplete 应该正确判断', () => {
      const state = engine.getState() as any;
      const solution = state.solution as number[][];
      // 填满第二行（全满行）
      for (let c = 0; c < 5; c++) {
        if (solution[1][c] === 1) {
          engine.setCell(1, c, CellState.FILLED);
        }
      }
      expect(engine.isRowComplete(1)).toBe(true);
    });

    it('isColComplete 应该正确判断', () => {
      const state = engine.getState() as any;
      const solution = state.solution as number[][];
      for (let r = 0; r < 5; r++) {
        if (solution[r][2] === 1) {
          engine.setCell(r, 2, CellState.FILLED);
        }
      }
      expect(engine.isColComplete(2)).toBe(true);
    });

    it('全空解决方案应该通过完成检测', () => {
      engine.loadFromSolution(createEmptySolution(5), '空');
      engine.start();
      // 不需要涂任何格子就应该完成
      expect((engine.getState() as any).isComplete).toBe(true);
    });
  });

  // ==========================================
  // 6. 错误检测测试
  // ==========================================
  describe('错误检测', () => {
    beforeEach(() => {
      engine.start();
    });

    it('在错误位置涂色应该标记错误', () => {
      const state = engine.getState() as any;
      const solution = state.solution as number[][];

      // 找一个应该为0的位置
      let found = false;
      for (let r = 0; r < 5 && !found; r++) {
        for (let c = 0; c < 5 && !found; c++) {
          if (solution[r][c] === 0) {
            engine.setCell(r, c, CellState.FILLED);
            found = true;
          }
        }
      }
      expect(engine.hasErrorsInGrid()).toBe(true);
    });

    it('在正确位置涂色不应该标记错误', () => {
      const state = engine.getState() as any;
      const solution = state.solution as number[][];

      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (solution[r][c] === 1) {
            engine.setCell(r, c, CellState.FILLED);
          }
        }
      }
      expect(engine.hasErrorsInGrid()).toBe(false);
    });

    it('getErrorCount 应该返回正确数量', () => {
      const state = engine.getState() as any;
      const solution = state.solution as number[][];

      let errorCount = 0;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (solution[r][c] === 0) {
            engine.setCell(r, c, CellState.FILLED);
            errorCount++;
          }
        }
      }
      expect(engine.getErrorCount()).toBe(errorCount);
    });

    it('取消错误涂色应该清除错误标记', () => {
      const state = engine.getState() as any;
      const solution = state.solution as number[][];

      // 找一个应该为0的位置并涂色
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (solution[r][c] === 0) {
            engine.setCell(r, c, CellState.FILLED);
            expect(engine.hasErrorsInGrid()).toBe(true);

            // 取消涂色
            engine.setCell(r, c, CellState.EMPTY);
            expect(engine.hasErrorsInGrid()).toBe(false);
            return;
          }
        }
      }
    });

    it('标记 X 不应该产生错误', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown('x');
      expect(engine.hasErrorsInGrid()).toBe(false);
    });

    it('关闭错误检测后不应该标记错误', () => {
      engine.setShowErrors(false);
      const state = engine.getState() as any;
      const solution = state.solution as number[][];

      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (solution[r][c] === 0) {
            engine.setCell(r, c, CellState.FILLED);
          }
        }
      }
      expect(engine.hasErrorsInGrid()).toBe(false);
    });

    it('重新开启错误检测应该更新错误标记', () => {
      const state = engine.getState() as any;
      const solution = state.solution as number[][];

      engine.setShowErrors(false);

      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (solution[r][c] === 0) {
            engine.setCell(r, c, CellState.FILLED);
          }
        }
      }

      engine.setShowErrors(true);
      expect(engine.hasErrorsInGrid()).toBe(true);
    });
  });

  // ==========================================
  // 7. 多尺寸测试
  // ==========================================
  describe('多尺寸', () => {
    it('5×5 网格应该正确工作', () => {
      engine.loadPuzzle(Difficulty.EASY);
      expect(engine.currentGridSize).toBe(5);
      const state = engine.getState() as any;
      expect(state.grid.length).toBe(5);
      expect(state.grid[0].length).toBe(5);
    });

    it('10×10 网格应该正确工作', () => {
      engine.loadPuzzle(Difficulty.MEDIUM);
      expect(engine.currentGridSize).toBe(10);
      const state = engine.getState() as any;
      expect(state.grid.length).toBe(10);
      expect(state.grid[0].length).toBe(10);
    });

    it('15×15 网格应该正确工作', () => {
      engine.loadPuzzle(Difficulty.HARD);
      expect(engine.currentGridSize).toBe(15);
      const state = engine.getState() as any;
      expect(state.grid.length).toBe(15);
      expect(state.grid[0].length).toBe(15);
    });

    it('切换难度应该改变网格大小', () => {
      engine.loadPuzzle(Difficulty.EASY);
      expect(engine.currentGridSize).toBe(5);

      engine.loadPuzzle(Difficulty.MEDIUM);
      expect(engine.currentGridSize).toBe(10);

      engine.loadPuzzle(Difficulty.HARD);
      expect(engine.currentGridSize).toBe(15);
    });

    it('10×10 网格光标应该正确移动', () => {
      engine.loadPuzzle(Difficulty.MEDIUM);
      engine.start();
      engine.setCursor(9, 9);
      engine.handleKeyDown('ArrowDown');
      expect((engine.getState() as any).cursor.row).toBe(9);
      engine.handleKeyDown('ArrowRight');
      expect((engine.getState() as any).cursor.col).toBe(9);
    });

    it('15×15 网格光标应该正确移动', () => {
      engine.loadPuzzle(Difficulty.HARD);
      engine.start();
      engine.setCursor(14, 14);
      engine.handleKeyDown('ArrowDown');
      expect((engine.getState() as any).cursor.row).toBe(14);
      engine.handleKeyDown('ArrowRight');
      expect((engine.getState() as any).cursor.col).toBe(14);
    });

    it('DIFFICULTY_SIZE 常量应该正确', () => {
      expect(DIFFICULTY_SIZE[Difficulty.EASY]).toBe(5);
      expect(DIFFICULTY_SIZE[Difficulty.MEDIUM]).toBe(10);
      expect(DIFFICULTY_SIZE[Difficulty.HARD]).toBe(15);
    });
  });

  // ==========================================
  // 8. 预设谜题测试
  // ==========================================
  describe('预设谜题', () => {
    it('预设谜题数量应该至少10个', () => {
      expect(PRESET_PUZZLES.length).toBeGreaterThanOrEqual(10);
    });

    it('每个预设谜题应该有合法的解决方案', () => {
      for (const puzzle of PRESET_PUZZLES) {
        expect(NonogramEngine.validateSolution(puzzle.solution)).toBe(true);
      }
    });

    it('每个预设谜题应该有名称', () => {
      for (const puzzle of PRESET_PUZZLES) {
        expect(puzzle.name.length).toBeGreaterThan(0);
      }
    });

    it('每个预设谜题的尺寸应该正确', () => {
      for (const puzzle of PRESET_PUZZLES) {
        expect(puzzle.solution.length).toBe(puzzle.size);
        for (const row of puzzle.solution) {
          expect(row.length).toBe(puzzle.size);
        }
      }
    });

    it('应该有 5×5 的谜题', () => {
      const easy = PRESET_PUZZLES.filter(p => p.size === 5);
      expect(easy.length).toBeGreaterThanOrEqual(1);
    });

    it('应该有 10×10 的谜题', () => {
      const medium = PRESET_PUZZLES.filter(p => p.size === 10);
      expect(medium.length).toBeGreaterThanOrEqual(1);
    });

    it('应该有 15×15 的谜题', () => {
      const hard = PRESET_PUZZLES.filter(p => p.size === 15);
      expect(hard.length).toBeGreaterThanOrEqual(1);
    });

    it('应该能加载指定索引的预设谜题', () => {
      const easyPuzzles = PRESET_PUZZLES.filter(p => p.size === 5);
      engine.loadPuzzle(Difficulty.EASY, 0);
      expect(engine.currentPuzzleName).toBe(easyPuzzles[0].name);
    });

    it('加载无效索引应该随机选择', () => {
      // 不应该抛出异常
      engine.loadPuzzle(Difficulty.EASY, 999);
      expect(engine.currentGridSize).toBe(5);
    });

    it('loadFromSolution 应该正确加载自定义谜题', () => {
      const customSolution = [
        [1, 0],
        [0, 1],
      ];
      engine.loadFromSolution(customSolution, '自定义');
      expect(engine.currentGridSize).toBe(2);
      expect(engine.currentPuzzleName).toBe('自定义');
      const state = engine.getState() as any;
      expect(state.rowClues).toEqual([[1], [1]]);
      expect(state.colClues).toEqual([[1], [1]]);
    });

    it('getPresetCount 应该返回正确数量', () => {
      expect(NonogramEngine.getPresetCount()).toBe(PRESET_PUZZLES.length);
      expect(NonogramEngine.getPresetCount(5)).toBe(PRESET_PUZZLES.filter(p => p.size === 5).length);
      expect(NonogramEngine.getPresetCount(10)).toBe(PRESET_PUZZLES.filter(p => p.size === 10).length);
      expect(NonogramEngine.getPresetCount(15)).toBe(PRESET_PUZZLES.filter(p => p.size === 15).length);
    });
  });

  // ==========================================
  // 9. 键盘控制测试
  // ==========================================
  describe('键盘控制', () => {
    beforeEach(() => {
      engine.start();
    });

    it('R 键应该重置当前谜题', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown(' ');
      expect(engine.getCell(0, 0)).toBe(CellState.FILLED);

      engine.handleKeyDown('r');
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);
    });

    it('大写 R 也应该重置', () => {
      engine.setCursor(0, 0);
      engine.handleKeyDown(' ');
      engine.handleKeyDown('R');
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);
    });

    it('N 键应该加载新谜题', () => {
      const oldName = engine.currentPuzzleName;
      engine.handleKeyDown('n');
      // 新谜题网格应该全空
      const state = engine.getState() as any;
      for (const row of state.grid) {
        for (const cell of row) {
          expect(cell).toBe(CellState.EMPTY);
        }
      }
    });

    it('1 键应该切换到简单难度', () => {
      engine.loadPuzzle(Difficulty.HARD);
      expect(engine.currentDifficulty).toBe(Difficulty.HARD);

      engine.handleKeyDown('1');
      expect(engine.currentDifficulty).toBe(Difficulty.EASY);
      expect(engine.currentGridSize).toBe(5);
    });

    it('2 键应该切换到中等难度', () => {
      engine.handleKeyDown('2');
      expect(engine.currentDifficulty).toBe(Difficulty.MEDIUM);
      expect(engine.currentGridSize).toBe(10);
    });

    it('3 键应该切换到困难难度', () => {
      engine.handleKeyDown('3');
      expect(engine.currentDifficulty).toBe(Difficulty.HARD);
      expect(engine.currentGridSize).toBe(15);
    });

    it('非 playing 状态下不应该响应游戏操作', () => {
      engine.pause();
      engine.setCursor(0, 0);
      engine.handleKeyDown(' ');
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);
    });

    it('handleKeyUp 不应该抛出异常', () => {
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
    });
  });

  // ==========================================
  // 10. 计时功能测试
  // ==========================================
  describe('计时功能', () => {
    it('初始化后 elapsedTime 应该为 0', () => {
      expect(engine.elapsedTime).toBe(0);
    });

    it('getState 应该包含 elapsedTime', () => {
      const state = engine.getState() as any;
      expect(state).toHaveProperty('elapsedTime');
    });
  });

  // ==========================================
  // 11. 生命周期测试
  // ==========================================
  describe('生命周期', () => {
    it('init 不传 canvas 不应该抛出异常', () => {
      const e = new NonogramEngine();
      expect(() => e.init()).not.toThrow();
    });

    it('reset 应该清空网格', () => {
      engine.start();
      engine.setCursor(0, 0);
      engine.handleKeyDown(' ');
      expect(engine.getCell(0, 0)).toBe(CellState.FILLED);

      engine.reset();
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);
      expect(engine.status).toBe('idle');
    });

    it('destroy 应该正常执行', () => {
      engine.start();
      expect(() => engine.destroy()).not.toThrow();
      expect(engine.status).toBe('idle');
    });

    it('pause 应该暂停游戏', () => {
      engine.start();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 应该恢复游戏', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });
  });

  // ==========================================
  // 12. 状态获取测试
  // ==========================================
  describe('getState', () => {
    it('应该返回完整的状态对象', () => {
      const state = engine.getState() as any;
      expect(state).toHaveProperty('gridSize');
      expect(state).toHaveProperty('grid');
      expect(state).toHaveProperty('solution');
      expect(state).toHaveProperty('rowClues');
      expect(state).toHaveProperty('colClues');
      expect(state).toHaveProperty('cursor');
      expect(state).toHaveProperty('difficulty');
      expect(state).toHaveProperty('isComplete');
      expect(state).toHaveProperty('errorCells');
      expect(state).toHaveProperty('elapsedTime');
      expect(state).toHaveProperty('puzzleName');
    });

    it('返回的 grid 应该是深拷贝', () => {
      const state1 = engine.getState() as any;
      state1.grid[0][0] = CellState.FILLED;
      const state2 = engine.getState() as any;
      expect(state2.grid[0][0]).toBe(CellState.EMPTY);
    });

    it('返回的 cursor 应该是独立的对象', () => {
      const state1 = engine.getState() as any;
      state1.cursor.row = 99;
      const state2 = engine.getState() as any;
      expect(state2.cursor.row).not.toBe(99);
    });
  });

  // ==========================================
  // 13. 静态方法测试
  // ==========================================
  describe('静态方法', () => {
    it('validateSolution 应该验证合法解决方案', () => {
      expect(NonogramEngine.validateSolution(createHeartSolution())).toBe(true);
      expect(NonogramEngine.validateSolution(createEmptySolution(5))).toBe(true);
      expect(NonogramEngine.validateSolution(createFullSolution(5))).toBe(true);
    });

    it('validateSolution 应该拒绝非法解决方案', () => {
      // 空数组
      expect(NonogramEngine.validateSolution([])).toBe(false);
      // 不规则形状
      expect(NonogramEngine.validateSolution([[1, 0], [1]])).toBe(false);
      // 包含非法值
      expect(NonogramEngine.validateSolution([[1, 2], [0, 1]])).toBe(false);
      expect(NonogramEngine.validateSolution([[1, -1], [0, 1]])).toBe(false);
    });

    it('generateClues 应该正确生成提示', () => {
      const solution = createHeartSolution();
      const { rowClues, colClues } = NonogramEngine.generateClues(solution);
      expect(rowClues.length).toBe(5);
      expect(colClues.length).toBe(5);
      expect(rowClues[0]).toEqual([1, 1]);
      expect(rowClues[1]).toEqual([5]);
    });
  });

  // ==========================================
  // 14. 事件系统测试
  // ==========================================
  describe('事件系统', () => {
    it('应该触发 stateChange 事件', () => {
      let triggered = false;
      engine.start();
      engine.on('stateChange', () => { triggered = true; });
      engine.setCursor(0, 0);
      engine.handleKeyDown('ArrowDown');
      expect(triggered).toBe(true);
    });

    it('应该在完成时触发 scoreChange', () => {
      let newScore = 0;
      engine.start();
      engine.on('scoreChange', (score: number) => { newScore = score; });
      fillAllCorrect(engine);
      expect(newScore).toBeGreaterThan(0);
    });

    it('应该在完成时触发 statusChange', () => {
      let newStatus = '';
      engine.start();
      engine.on('statusChange', (status: string) => { newStatus = status; });
      fillAllCorrect(engine);
      expect(newStatus).toBe('gameover');
    });
  });

  // ==========================================
  // 15. 边界情况测试
  // ==========================================
  describe('边界情况', () => {
    it('1×1 全涂色谜题应该正确工作', () => {
      engine.loadFromSolution([[1]], '单格');
      engine.start();
      engine.setCursor(0, 0);
      engine.handleKeyDown(' ');
      expect((engine.getState() as any).isComplete).toBe(true);
    });

    it('1×1 全空谜题应该直接完成', () => {
      engine.loadFromSolution([[0]], '空格');
      engine.start();
      expect((engine.getState() as any).isComplete).toBe(true);
    });

    it('交替涂色取消应该正确', () => {
      engine.start();
      engine.setCursor(0, 0);

      // 反复切换
      for (let i = 0; i < 10; i++) {
        engine.handleKeyDown(' ');
      }
      // 偶数次切换应该回到原位
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);
    });

    it('交替标记取消应该正确', () => {
      engine.start();
      engine.setCursor(0, 0);

      for (let i = 0; i < 10; i++) {
        engine.handleKeyDown('x');
      }
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);
    });

    it('loadFromSolution 应该重置完成状态', () => {
      engine.start();
      fillAllCorrect(engine);
      expect(engine.isWin).toBe(true);

      engine.loadFromSolution(createHeartSolution(), '新谜题');
      expect(engine.isWin).toBe(false);
    });
  });

  // ==========================================
  // 16. 谜题生成与切换测试
  // ==========================================
  describe('谜题生成与切换', () => {
    it('changeDifficulty 应该切换到新难度', () => {
      engine.start();
      engine.changeDifficulty(Difficulty.MEDIUM);
      expect(engine.currentDifficulty).toBe(Difficulty.MEDIUM);
      expect(engine.currentGridSize).toBe(10);
    });

    it('changeDifficulty 相同难度时仍然重新加载', () => {
      engine.changeDifficulty(Difficulty.EASY);
      expect(engine.currentDifficulty).toBe(Difficulty.EASY);
      expect(engine.currentGridSize).toBe(5);
    });

    it('newPuzzle 应该保持相同难度', () => {
      engine.loadPuzzle(Difficulty.MEDIUM);
      engine.start();
      engine.newPuzzle();
      expect(engine.currentDifficulty).toBe(Difficulty.MEDIUM);
      expect(engine.currentGridSize).toBe(10);
    });

    it('resetCurrentPuzzle 应该清空网格但保留谜题', () => {
      engine.start();
      const name = engine.currentPuzzleName;
      engine.setCursor(0, 0);
      engine.handleKeyDown(' ');

      engine.resetCurrentPuzzle();
      expect(engine.getCell(0, 0)).toBe(CellState.EMPTY);
      expect(engine.currentPuzzleName).toBe(name);
    });
  });

  // ==========================================
  // 17. 玩家提示获取测试
  // ==========================================
  describe('玩家提示获取', () => {
    it('getPlayerRowClues 空网格应该返回 [0]', () => {
      engine.start();
      expect(engine.getPlayerRowClues(0)).toEqual([0]);
    });

    it('getPlayerColClues 空网格应该返回 [0]', () => {
      engine.start();
      expect(engine.getPlayerColClues(0)).toEqual([0]);
    });

    it('getPlayerRowClues 涂色后应该返回正确提示', () => {
      engine.start();
      engine.setCell(0, 0, CellState.FILLED);
      engine.setCell(0, 1, CellState.FILLED);
      engine.setCell(0, 3, CellState.FILLED);
      expect(engine.getPlayerRowClues(0)).toEqual([2, 1]);
    });

    it('getPlayerColClues 涂色后应该返回正确提示', () => {
      engine.start();
      engine.setCell(0, 0, CellState.FILLED);
      engine.setCell(1, 0, CellState.FILLED);
      engine.setCell(3, 0, CellState.FILLED);
      expect(engine.getPlayerColClues(0)).toEqual([2, 1]);
    });

    it('标记格子不应该影响提示计算', () => {
      engine.start();
      engine.setCell(0, 0, CellState.MARKED);
      engine.setCell(0, 1, CellState.FILLED);
      expect(engine.getPlayerRowClues(0)).toEqual([1]);
    });
  });

  // ==========================================
  // 18. 预设谜题完整性验证
  // ==========================================
  describe('预设谜题完整性', () => {
    it('每个预设谜题应该能被正确完成', () => {
      for (const puzzle of PRESET_PUZZLES) {
        const e = createEngine();
        e.loadFromSolution(puzzle.solution, puzzle.name);
        e.start();

        // 填充所有正确格子
        for (let r = 0; r < puzzle.size; r++) {
          for (let c = 0; c < puzzle.size; c++) {
            if (puzzle.solution[r][c] === 1) {
              e.setCell(r, c, CellState.FILLED);
            }
          }
        }

        expect((e.getState() as any).isComplete).toBe(true);
        e.destroy();
      }
    });

    it('每个预设谜题的行列提示应该一致', () => {
      for (const puzzle of PRESET_PUZZLES) {
        const e = createEngine();
        e.loadFromSolution(puzzle.solution, puzzle.name);

        const state = e.getState() as any;
        // 验证行提示
        for (let r = 0; r < puzzle.size; r++) {
          const expected = e.calculateLineClues(puzzle.solution[r]);
          expect(state.rowClues[r]).toEqual(expected);
        }
        // 验证列提示
        for (let c = 0; c < puzzle.size; c++) {
          const col = puzzle.solution.map(row => row[c]);
          const expected = e.calculateLineClues(col);
          expect(state.colClues[c]).toEqual(expected);
        }
        e.destroy();
      }
    });
  });

  // ==========================================
  // 19. CellState 枚举测试
  // ==========================================
  describe('CellState 枚举', () => {
    it('应该有正确的枚举值', () => {
      expect(CellState.EMPTY).toBe(0);
      expect(CellState.FILLED).toBe(1);
      expect(CellState.MARKED).toBe(2);
    });
  });

  // ==========================================
  // 20. 综合场景测试
  // ==========================================
  describe('综合场景', () => {
    it('完整游戏流程：开始→涂色→完成', () => {
      const e = new NonogramEngine();
      e.init(createMockCanvas());
      e.loadFromSolution(createHeartSolution(), '爱心');

      expect(e.status).toBe('idle');
      e.start();
      expect(e.status).toBe('playing');

      fillAllCorrect(e);
      expect(e.isWin).toBe(true);
      expect(e.status).toBe('gameover');
      expect(e.score).toBeGreaterThan(0);

      e.destroy();
    });

    it('完整游戏流程：开始→暂停→恢复→完成', () => {
      const e = new NonogramEngine();
      e.init(createMockCanvas());
      e.loadFromSolution(createHeartSolution(), '爱心');
      e.start();

      e.pause();
      expect(e.status).toBe('paused');

      e.resume();
      expect(e.status).toBe('playing');

      fillAllCorrect(e);
      expect(e.isWin).toBe(true);

      e.destroy();
    });

    it('完整游戏流程：开始→重置→重新开始', () => {
      const e = new NonogramEngine();
      e.init(createMockCanvas());
      e.loadFromSolution(createHeartSolution(), '爱心');
      e.start();

      // 涂一些格子
      e.setCell(0, 1, CellState.FILLED);
      e.setCell(0, 3, CellState.FILLED);

      // 重置
      e.reset();
      expect(e.status).toBe('idle');
      expect(e.getCell(0, 1)).toBe(CellState.EMPTY);
      expect(e.getCell(0, 3)).toBe(CellState.EMPTY);

      // 重新开始
      e.start();
      fillAllCorrect(e);
      expect(e.isWin).toBe(true);

      e.destroy();
    });

    it('错误涂色→修正→完成', () => {
      const e = new NonogramEngine();
      e.init(createMockCanvas());
      e.loadFromSolution(createHeartSolution(), '爱心');
      e.start();

      // 错误涂色
      e.setCell(0, 0, CellState.FILLED);
      expect(e.hasErrorsInGrid()).toBe(true);

      // 修正
      e.setCell(0, 0, CellState.EMPTY);
      expect(e.hasErrorsInGrid()).toBe(false);

      // 完成
      fillAllCorrect(e);
      expect(e.isWin).toBe(true);

      e.destroy();
    });

    it('10×10 谜题完整流程', () => {
      const e = new NonogramEngine();
      e.init(createMockCanvas());
      e.loadPuzzle(Difficulty.MEDIUM);
      e.start();

      const state = e.getState() as any;
      const solution = state.solution as number[][];
      const size = state.gridSize as number;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (solution[r][c] === 1) {
            e.setCell(r, c, CellState.FILLED);
          }
        }
      }

      expect(e.isWin).toBe(true);
      expect(e.score).toBeGreaterThan(0);

      e.destroy();
    });

    it('15×15 谜题完整流程', () => {
      const e = new NonogramEngine();
      e.init(createMockCanvas());
      e.loadPuzzle(Difficulty.HARD);
      e.start();

      const state = e.getState() as any;
      const solution = state.solution as number[][];
      const size = state.gridSize as number;

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (solution[r][c] === 1) {
            e.setCell(r, c, CellState.FILLED);
          }
        }
      }

      expect(e.isWin).toBe(true);
      expect(e.score).toBeGreaterThan(0);

      e.destroy();
    });
  });
});
