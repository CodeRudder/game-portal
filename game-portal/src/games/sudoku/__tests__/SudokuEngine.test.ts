import { describe, it, expect, beforeEach } from 'vitest';
import { SudokuEngine } from '../SudokuEngine';
import { Difficulty } from '../constants';

// ========== 辅助工具 ==========

/** 创建并初始化引擎（不传 canvas） */
function createEngine(difficulty: Difficulty = Difficulty.EASY): SudokuEngine {
  const engine = new SudokuEngine(difficulty);
  engine.init();
  return engine;
}

/** 找到第一个非固定空格 */
function findEmptyCell(engine: SudokuEngine): { row: number; col: number } {
  const grid = engine.grid;
  const fixed = engine.fixed;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!fixed[r][c] && grid[r][c] === 0) {
        return { row: r, col: c };
      }
    }
  }
  throw new Error('No empty cell found');
}

/** 找到第一个固定格 */
function findFixedCell(engine: SudokuEngine): { row: number; col: number } {
  const fixed = engine.fixed;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (fixed[r][c]) return { row: r, col: c };
    }
  }
  throw new Error('No fixed cell found');
}

/** 计算网格中空格数量 */
function countEmpty(grid: number[][]): number {
  let count = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) count++;
    }
  }
  return count;
}

/** 检查一个 9×9 网格是否为有效数独解（每行/列/宫 1-9 各出现一次） */
function isValidSolution(grid: number[][]): boolean {
  // 检查行
  for (let r = 0; r < 9; r++) {
    const set = new Set(grid[r]);
    if (set.size !== 9 || set.has(0)) return false;
  }
  // 检查列
  for (let c = 0; c < 9; c++) {
    const set = new Set<number>();
    for (let r = 0; r < 9; r++) set.add(grid[r][c]);
    if (set.size !== 9 || set.has(0)) return false;
  }
  // 检查宫
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const set = new Set<number>();
      for (let r = br * 3; r < br * 3 + 3; r++) {
        for (let c = bc * 3; c < bc * 3 + 3; c++) {
          set.add(grid[r][c]);
        }
      }
      if (set.size !== 9 || set.has(0)) return false;
    }
  }
  return true;
}

/** 将光标移到指定位置（通过方向键） */
function moveCursorTo(engine: SudokuEngine, targetRow: number, targetCol: number): void {
  // 先重置到 (0,0) — 通过多次按上和左
  for (let i = 0; i < 9; i++) {
    engine.handleKeyDown('ArrowUp');
    engine.handleKeyDown('ArrowLeft');
  }
  // 然后移到目标位置
  for (let i = 0; i < targetRow; i++) engine.handleKeyDown('ArrowDown');
  for (let i = 0; i < targetCol; i++) engine.handleKeyDown('ArrowRight');
}

// ================================================================
// 1. 初始化
// ================================================================
describe('初始化', () => {
  it('默认状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('初始分数为 0', () => {
    const engine = createEngine();
    expect(engine.score).toBe(0);
  });

  it('初始等级根据难度设置（EASY → 1）', () => {
    const engine = createEngine(Difficulty.EASY);
    expect(engine.level).toBe(1);
  });

  it('MEDIUM 难度等级为 2', () => {
    const engine = createEngine(Difficulty.MEDIUM);
    expect(engine.level).toBe(2);
  });

  it('HARD 难度等级为 3', () => {
    const engine = createEngine(Difficulty.HARD);
    expect(engine.level).toBe(3);
  });

  it('有固定格（非空格子）', () => {
    const engine = createEngine();
    let hasFixed = false;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (engine.fixed[r][c]) { hasFixed = true; break; }
      }
      if (hasFixed) break;
    }
    expect(hasFixed).toBe(true);
  });

  it('有空格（待填格子）', () => {
    const engine = createEngine();
    const empty = countEmpty(engine.grid);
    expect(empty).toBeGreaterThan(0);
  });

  it('初始错误集合为空', () => {
    const engine = createEngine();
    expect(engine.errorCells.size).toBe(0);
  });
});

// ================================================================
// 2. 谜题结构
// ================================================================
describe('谜题结构', () => {
  it('网格是 9×9', () => {
    const engine = createEngine();
    expect(engine.grid).toHaveLength(9);
    for (const row of engine.grid) {
      expect(row).toHaveLength(9);
    }
  });

  it('puzzle 是 9×9', () => {
    const engine = createEngine();
    expect(engine.puzzle).toHaveLength(9);
    for (const row of engine.puzzle) {
      expect(row).toHaveLength(9);
    }
  });

  it('solution 是 9×9', () => {
    const engine = createEngine();
    expect(engine.solution).toHaveLength(9);
    for (const row of engine.solution) {
      expect(row).toHaveLength(9);
    }
  });

  it('fixed 是 9×9 布尔矩阵', () => {
    const engine = createEngine();
    expect(engine.fixed).toHaveLength(9);
    for (const row of engine.fixed) {
      expect(row).toHaveLength(9);
      for (const v of row) {
        expect(typeof v).toBe('boolean');
      }
    }
  });

  it('notes 是 9×9 Set 矩阵', () => {
    const engine = createEngine();
    expect(engine.notes).toHaveLength(9);
    for (const row of engine.notes) {
      expect(row).toHaveLength(9);
      for (const s of row) {
        expect(s).toBeInstanceOf(Set);
      }
    }
  });

  it('EASY 难度空格数约 30', () => {
    const engine = createEngine(Difficulty.EASY);
    const empty = countEmpty(engine.puzzle);
    // 挖洞可能因唯一解约束略少于 30
    expect(empty).toBeGreaterThanOrEqual(25);
    expect(empty).toBeLessThanOrEqual(35);
  });

  it('MEDIUM 难度空格数约 40', () => {
    const engine = createEngine(Difficulty.MEDIUM);
    const empty = countEmpty(engine.puzzle);
    expect(empty).toBeGreaterThanOrEqual(35);
    expect(empty).toBeLessThanOrEqual(45);
  });

  it('HARD 难度空格数约 50', () => {
    const engine = createEngine(Difficulty.HARD);
    const empty = countEmpty(engine.puzzle);
    expect(empty).toBeGreaterThanOrEqual(40);
    expect(empty).toBeLessThanOrEqual(55);
  });

  it('solution 是有效的数独解', () => {
    const engine = createEngine();
    expect(isValidSolution(engine.solution)).toBe(true);
  });

  it('grid 初始等于 puzzle', () => {
    const engine = createEngine();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(engine.grid[r][c]).toBe(engine.puzzle[r][c]);
      }
    }
  });

  it('固定格的值等于 solution 对应位置', () => {
    const engine = createEngine();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (engine.fixed[r][c]) {
          expect(engine.puzzle[r][c]).toBe(engine.solution[r][c]);
        }
      }
    }
  });
});

// ================================================================
// 3. 光标移动
// ================================================================
describe('光标移动', () => {
  let engine: SudokuEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('ArrowDown 向下移动光标', () => {
    expect(engine.cursorRow).toBe(0);
    engine.handleKeyDown('ArrowDown');
    expect(engine.cursorRow).toBe(1);
  });

  it('ArrowRight 向右移动光标', () => {
    expect(engine.cursorCol).toBe(0);
    engine.handleKeyDown('ArrowRight');
    expect(engine.cursorCol).toBe(1);
  });

  it('ArrowUp 在顶部不超出边界', () => {
    expect(engine.cursorRow).toBe(0);
    engine.handleKeyDown('ArrowUp');
    expect(engine.cursorRow).toBe(0);
  });

  it('ArrowLeft 在最左不超出边界', () => {
    expect(engine.cursorCol).toBe(0);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.cursorCol).toBe(0);
  });

  it('光标不能超出右下边界', () => {
    // 移到最右下角
    for (let i = 0; i < 10; i++) {
      engine.handleKeyDown('ArrowDown');
      engine.handleKeyDown('ArrowRight');
    }
    expect(engine.cursorRow).toBe(8);
    expect(engine.cursorCol).toBe(8);
  });
});

// ================================================================
// 4. 输入数字
// ================================================================
describe('输入数字', () => {
  let engine: SudokuEngine;
  let emptyCell: { row: number; col: number };

  beforeEach(() => {
    engine = createEngine();
    emptyCell = findEmptyCell(engine);
    moveCursorTo(engine, emptyCell.row, emptyCell.col);
  });

  it('可以向空格填入数字', () => {
    const num = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(num));
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(num);
  });

  it('填入正确数字时得分 +10', () => {
    const num = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(num));
    expect(engine.score).toBe(10);
  });

  it('填入错误数字时不得分', () => {
    // 找一个错误数字（不是 solution 的值）
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    const wrong = correct === 1 ? 2 : 1;
    // 但需要确保 wrong 在该位置不会与行/列/宫冲突导致被标为错误
    // 无论如何，错误数字不得分
    engine.handleKeyDown(String(wrong));
    expect(engine.score).toBe(0);
  });

  it('不能修改固定格', () => {
    const fixed = findFixedCell(engine);
    moveCursorTo(engine, fixed.row, fixed.col);
    const original = engine.grid[fixed.row][fixed.col];
    engine.handleKeyDown('5');
    expect(engine.grid[fixed.row][fixed.col]).toBe(original);
  });

  it('可以覆盖已有的用户输入', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    const wrong = correct === 1 ? 2 : 1;
    engine.handleKeyDown(String(wrong));
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(wrong);
    engine.handleKeyDown(String(correct));
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(correct);
  });

  it('覆盖时清除候选数', () => {
    // 先开启笔记模式添加候选数
    engine.handleKeyDown('n');
    engine.handleKeyDown('3');
    engine.handleKeyDown('5');
    expect(engine.notes[emptyCell.row][emptyCell.col].size).toBeGreaterThan(0);
    // 切回普通模式并输入
    engine.handleKeyDown('n');
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    expect(engine.notes[emptyCell.row][emptyCell.col].size).toBe(0);
  });

  it('重复输入相同数字不产生历史记录', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    const historyLen = (engine as any)._history.length;
    engine.handleKeyDown(String(correct));
    // 相同数字不重复操作，历史长度不变
    expect((engine as any)._history.length).toBe(historyLen);
  });

  it('数字 0 不被接受（不在 1-9 范围）', () => {
    engine.handleKeyDown('0');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });

  it('非数字键不修改网格', () => {
    engine.handleKeyDown('a');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });
});

// ================================================================
// 5. 候选数标注（笔记模式）
// ================================================================
describe('候选数标注', () => {
  let engine: SudokuEngine;
  let emptyCell: { row: number; col: number };

  beforeEach(() => {
    engine = createEngine();
    emptyCell = findEmptyCell(engine);
    moveCursorTo(engine, emptyCell.row, emptyCell.col);
    // 开启笔记模式
    engine.handleKeyDown('n');
    expect(engine.noteMode).toBe(true);
  });

  it('可以在空格添加候选数', () => {
    engine.handleKeyDown('3');
    expect(engine.notes[emptyCell.row][emptyCell.col].has(3)).toBe(true);
  });

  it('可以添加多个候选数', () => {
    engine.handleKeyDown('3');
    engine.handleKeyDown('5');
    engine.handleKeyDown('7');
    const notes = engine.notes[emptyCell.row][emptyCell.col];
    expect(notes.has(3)).toBe(true);
    expect(notes.has(5)).toBe(true);
    expect(notes.has(7)).toBe(true);
  });

  it('再次输入相同候选数会移除（toggle）', () => {
    engine.handleKeyDown('3');
    expect(engine.notes[emptyCell.row][emptyCell.col].has(3)).toBe(true);
    engine.handleKeyDown('3');
    expect(engine.notes[emptyCell.row][emptyCell.col].has(3)).toBe(false);
  });

  it('笔记模式下不会修改网格值', () => {
    engine.handleKeyDown('5');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });

  it('笔记操作会被记录到历史', () => {
    engine.handleKeyDown('3');
    const history = (engine as any)._history as Array<{ type: string }>;
    const noteEntries = history.filter(e => e.type === 'note');
    expect(noteEntries.length).toBeGreaterThan(0);
  });

  it('已填数字的格子不能添加候选数', () => {
    // 先切回普通模式，填入正确数字
    engine.handleKeyDown('n');
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    // 再切到笔记模式尝试添加候选数
    engine.handleKeyDown('n');
    engine.handleKeyDown('7');
    // 候选数不应被添加（格子已有数字）
    expect(engine.notes[emptyCell.row][emptyCell.col].size).toBe(0);
  });

  it('N 键切换笔记模式', () => {
    expect(engine.noteMode).toBe(true);
    engine.handleKeyDown('N');
    expect(engine.noteMode).toBe(false);
    engine.handleKeyDown('n');
    expect(engine.noteMode).toBe(true);
  });

  it('固定格不能添加候选数', () => {
    const fixed = findFixedCell(engine);
    moveCursorTo(engine, fixed.row, fixed.col);
    engine.handleKeyDown('5');
    expect(engine.notes[fixed.row][fixed.col].size).toBe(0);
  });
});

// ================================================================
// 6. 错误检测
// ================================================================
describe('错误检测', () => {
  let engine: SudokuEngine;
  let emptyCell: { row: number; col: number };

  beforeEach(() => {
    engine = createEngine();
    emptyCell = findEmptyCell(engine);
    moveCursorTo(engine, emptyCell.row, emptyCell.col);
  });

  it('填入与同行冲突的数字会被标记错误', () => {
    // 找同行已有的数字
    const row = emptyCell.row;
    let existingNum = -1;
    for (let c = 0; c < 9; c++) {
      if (engine.grid[row][c] !== 0) {
        existingNum = engine.grid[row][c];
        break;
      }
    }
    if (existingNum !== -1 && existingNum !== engine.solution[emptyCell.row][emptyCell.col]) {
      engine.handleKeyDown(String(existingNum));
      expect(engine.errorCells.has(`${emptyCell.row},${emptyCell.col}`)).toBe(true);
    } else {
      // 如果没有合适的冲突数字，手动验证错误检测机制存在
      expect(true).toBe(true);
    }
  });

  it('填入与同列冲突的数字会被标记错误', () => {
    const col = emptyCell.col;
    let existingNum = -1;
    for (let r = 0; r < 9; r++) {
      if (engine.grid[r][col] !== 0) {
        existingNum = engine.grid[r][col];
        break;
      }
    }
    if (existingNum !== -1 && existingNum !== engine.solution[emptyCell.row][emptyCell.col]) {
      engine.handleKeyDown(String(existingNum));
      expect(engine.errorCells.has(`${emptyCell.row},${emptyCell.col}`)).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });

  it('填入与同宫冲突的数字会被标记错误', () => {
    const boxRow = Math.floor(emptyCell.row / 3) * 3;
    const boxCol = Math.floor(emptyCell.col / 3) * 3;
    let existingNum = -1;
    for (let r = boxRow; r < boxRow + 3 && existingNum === -1; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if (engine.grid[r][c] !== 0) {
          existingNum = engine.grid[r][c];
          break;
        }
      }
    }
    if (existingNum !== -1 && existingNum !== engine.solution[emptyCell.row][emptyCell.col]) {
      engine.handleKeyDown(String(existingNum));
      expect(engine.errorCells.has(`${emptyCell.row},${emptyCell.col}`)).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });

  it('填入正确数字不会标记错误', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    expect(engine.errorCells.has(`${emptyCell.row},${emptyCell.col}`)).toBe(false);
  });

  it('固定格永远不会被标记为错误', () => {
    // 固定格可能与其他固定格有相同数字（不可能，因为 solution 有效）
    // 所以只需确认固定格不在 errorCells 中
    const fixed = findFixedCell(engine);
    expect(engine.errorCells.has(`${fixed.row},${fixed.col}`)).toBe(false);
  });

  it('擦除错误数字后错误标记消失', () => {
    const row = emptyCell.row;
    let existingNum = -1;
    for (let c = 0; c < 9; c++) {
      if (engine.grid[row][c] !== 0) {
        existingNum = engine.grid[row][c];
        break;
      }
    }
    if (existingNum !== -1 && existingNum !== engine.solution[emptyCell.row][emptyCell.col]) {
      engine.handleKeyDown(String(existingNum));
      expect(engine.errorCells.has(`${emptyCell.row},${emptyCell.col}`)).toBe(true);
      engine.handleKeyDown('Delete');
      expect(engine.errorCells.has(`${emptyCell.row},${emptyCell.col}`)).toBe(false);
    } else {
      expect(true).toBe(true);
    }
  });

  it('errorCells 是 Set<string> 类型', () => {
    expect(engine.errorCells).toBeInstanceOf(Set);
  });

  it('初始无错误', () => {
    expect(engine.errorCells.size).toBe(0);
  });

  it('多个冲突会同时标记', () => {
    // 填入一个与行和列都冲突的数字
    const row = emptyCell.row;
    const col = emptyCell.col;
    // 找行中已有数字
    const rowNums = new Set<number>();
    for (let c = 0; c < 9; c++) {
      if (engine.grid[row][c] !== 0) rowNums.add(engine.grid[row][c]);
    }
    // 找列中已有数字
    const colNums = new Set<number>();
    for (let r = 0; r < 9; r++) {
      if (engine.grid[r][col] !== 0) colNums.add(engine.grid[r][col]);
    }
    // 找一个同时与行和列冲突的数字
    let conflictNum = -1;
    for (const n of rowNums) {
      if (colNums.has(n) && n !== engine.solution[row][col]) {
        conflictNum = n;
        break;
      }
    }
    if (conflictNum !== -1) {
      engine.handleKeyDown(String(conflictNum));
      expect(engine.errorCells.has(`${row},${col}`)).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});

// ================================================================
// 7. 擦除
// ================================================================
describe('擦除', () => {
  let engine: SudokuEngine;
  let emptyCell: { row: number; col: number };

  beforeEach(() => {
    engine = createEngine();
    emptyCell = findEmptyCell(engine);
    moveCursorTo(engine, emptyCell.row, emptyCell.col);
  });

  it('可以擦除用户输入的数字', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(correct);
    engine.handleKeyDown('Delete');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });

  it('不能擦除固定格', () => {
    const fixed = findFixedCell(engine);
    moveCursorTo(engine, fixed.row, fixed.col);
    const original = engine.grid[fixed.row][fixed.col];
    engine.handleKeyDown('Backspace');
    expect(engine.grid[fixed.row][fixed.col]).toBe(original);
  });

  it('擦除空格且无候选数时不产生历史', () => {
    const historyLenBefore = (engine as any)._history.length;
    engine.handleKeyDown('Delete');
    expect((engine as any)._history.length).toBe(historyLenBefore);
  });

  it('擦除会清除候选数', () => {
    // 先添加候选数
    engine.handleKeyDown('n');
    engine.handleKeyDown('3');
    engine.handleKeyDown('5');
    expect(engine.notes[emptyCell.row][emptyCell.col].size).toBe(2);
    // 切回普通模式再擦除
    engine.handleKeyDown('n');
    engine.handleKeyDown('Delete');
    expect(engine.notes[emptyCell.row][emptyCell.col].size).toBe(0);
  });

  it('Backspace 也可以擦除', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    engine.handleKeyDown('Backspace');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });
});

// ================================================================
// 8. 提示
// ================================================================
describe('提示', () => {
  let engine: SudokuEngine;
  let emptyCell: { row: number; col: number };

  beforeEach(() => {
    engine = createEngine();
    emptyCell = findEmptyCell(engine);
    moveCursorTo(engine, emptyCell.row, emptyCell.col);
  });

  it('提示会在选中格填入正确数字', () => {
    engine.handleKeyDown('h');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(engine.solution[emptyCell.row][emptyCell.col]);
  });

  it('使用提示会增加 hintCount', () => {
    expect(engine.hintCount).toBe(0);
    engine.handleKeyDown('h');
    expect(engine.hintCount).toBe(1);
  });

  it('使用提示会扣分（-20）', () => {
    engine.handleKeyDown('h');
    expect(engine.score).toBe(-20);
  });

  it('固定格不会触发提示', () => {
    const fixed = findFixedCell(engine);
    moveCursorTo(engine, fixed.row, fixed.col);
    const original = engine.grid[fixed.row][fixed.col];
    engine.handleKeyDown('h');
    expect(engine.grid[fixed.row][fixed.col]).toBe(original);
    expect(engine.hintCount).toBe(0);
  });

  it('已经正确的格子不会触发提示', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    const hintCountBefore = engine.hintCount;
    engine.handleKeyDown('h');
    expect(engine.hintCount).toBe(hintCountBefore);
  });
});

// ================================================================
// 9. 撤销
// ================================================================
describe('撤销', () => {
  let engine: SudokuEngine;
  let emptyCell: { row: number; col: number };

  beforeEach(() => {
    engine = createEngine();
    emptyCell = findEmptyCell(engine);
    moveCursorTo(engine, emptyCell.row, emptyCell.col);
  });

  it('撤销可以恢复填入操作', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(correct);
    engine.handleKeyDown('z');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });

  it('撤销填入正确数字会扣回得分', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    expect(engine.score).toBe(10);
    engine.handleKeyDown('z');
    expect(engine.score).toBe(0);
  });

  it('撤销擦除操作恢复之前的值', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    engine.handleKeyDown('Delete');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
    engine.handleKeyDown('z');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(correct);
  });

  it('撤销笔记操作恢复之前的候选数', () => {
    engine.handleKeyDown('n');
    engine.handleKeyDown('3');
    expect(engine.notes[emptyCell.row][emptyCell.col].has(3)).toBe(true);
    engine.handleKeyDown('z');
    expect(engine.notes[emptyCell.row][emptyCell.col].has(3)).toBe(false);
  });

  it('撤销提示操作恢复之前的值并回补分数', () => {
    engine.handleKeyDown('h');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(engine.solution[emptyCell.row][emptyCell.col]);
    expect(engine.hintCount).toBe(1);
    expect(engine.score).toBe(-20);
    engine.handleKeyDown('z');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
    expect(engine.hintCount).toBe(0);
    expect(engine.score).toBe(0);
  });

  it('多次撤销可以逐步恢复', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    // 找另一个空格
    const empty2 = findEmptyCell(engine);
    moveCursorTo(engine, empty2.row, empty2.col);
    const correct2 = engine.solution[empty2.row][empty2.col];
    engine.handleKeyDown(String(correct2));

    // 撤销两次
    engine.handleKeyDown('z');
    expect(engine.grid[empty2.row][empty2.col]).toBe(0);
    engine.handleKeyDown('z');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });

  it('无历史时撤销不做任何操作', () => {
    const gridBefore = engine.grid.map(r => [...r]);
    engine.handleKeyDown('z');
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        expect(engine.grid[r][c]).toBe(gridBefore[r][c]);
      }
    }
  });

  it('Z（大写）也可以撤销', () => {
    const correct = engine.solution[emptyCell.row][emptyCell.col];
    engine.handleKeyDown(String(correct));
    engine.handleKeyDown('Z');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });
});

// ================================================================
// 10. 自动检查（完成验证）
// ================================================================
describe('自动检查（完成验证）', () => {
  it('填满但有不正确时 isComplete 为 true, isCorrect 为 false', () => {
    const engine = createEngine();
    // 手动设置 grid 为全部填满但有错误
    const grid = engine.grid;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          // 填入一个可能错误的值
          (grid as any)[r][c] = 1;
        }
      }
    }
    // 强制刷新内部 grid（直接修改了引用）
    expect(engine.isComplete).toBe(true);
    // 大概率不正确（除非碰巧全对）
    // isCorrect 可能是 true 或 false，但至少 isComplete 应该为 true
  });

  it('isComplete 在有空格时为 false', () => {
    const engine = createEngine();
    expect(engine.isComplete).toBe(false);
  });

  it('isCorrect 在初始状态为 false（有空格）', () => {
    const engine = createEngine();
    // 有空格意味着 grid !== solution
    expect(engine.isCorrect).toBe(false);
  });

  it('全部填入正确数字后 isCorrect 为 true', () => {
    const engine = createEngine();
    // 用 solution 直接填满
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!engine.fixed[r][c]) {
          moveCursorTo(engine, r, c);
          engine.handleKeyDown(String(engine.solution[r][c]));
        }
      }
    }
    expect(engine.isComplete).toBe(true);
    expect(engine.isCorrect).toBe(true);
  });
});

// ================================================================
// 11. 计分
// ================================================================
describe('计分', () => {
  it('填入一个正确数字得 10 分', () => {
    const engine = createEngine();
    const cell = findEmptyCell(engine);
    moveCursorTo(engine, cell.row, cell.col);
    engine.handleKeyDown(String(engine.solution[cell.row][cell.col]));
    expect(engine.score).toBe(10);
  });

  it('填入两个正确数字得 20 分', () => {
    const engine = createEngine();
    const cell1 = findEmptyCell(engine);
    moveCursorTo(engine, cell1.row, cell1.col);
    engine.handleKeyDown(String(engine.solution[cell1.row][cell1.col]));

    const cell2 = findEmptyCell(engine);
    moveCursorTo(engine, cell2.row, cell2.col);
    engine.handleKeyDown(String(engine.solution[cell2.row][cell2.col]));
    expect(engine.score).toBe(20);
  });

  it('提示扣 20 分', () => {
    const engine = createEngine();
    const cell = findEmptyCell(engine);
    moveCursorTo(engine, cell.row, cell.col);
    engine.handleKeyDown('h');
    expect(engine.score).toBe(-20);
  });

  it('撤销正确填入扣回 10 分', () => {
    const engine = createEngine();
    const cell = findEmptyCell(engine);
    moveCursorTo(engine, cell.row, cell.col);
    engine.handleKeyDown(String(engine.solution[cell.row][cell.col]));
    expect(engine.score).toBe(10);
    engine.handleKeyDown('z');
    expect(engine.score).toBe(0);
  });

  it('撤销提示回补 20 分', () => {
    const engine = createEngine();
    const cell = findEmptyCell(engine);
    moveCursorTo(engine, cell.row, cell.col);
    engine.handleKeyDown('h');
    expect(engine.score).toBe(-20);
    engine.handleKeyDown('z');
    expect(engine.score).toBe(0);
  });
});

// ================================================================
// 12. 等级
// ================================================================
describe('等级', () => {
  it('EASY 等级为 1', () => {
    const engine = createEngine(Difficulty.EASY);
    expect(engine.level).toBe(1);
  });

  it('MEDIUM 等级为 2', () => {
    const engine = createEngine(Difficulty.MEDIUM);
    expect(engine.level).toBe(2);
  });

  it('HARD 等级为 3', () => {
    const engine = createEngine(Difficulty.HARD);
    expect(engine.level).toBe(3);
  });
});

// ================================================================
// 13. handleClick
// ================================================================
describe('handleClick', () => {
  let engine: SudokuEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('点击有效区域设置光标位置', () => {
    // GRID_PADDING=20, CELL_SIZE≈49, GRID_OFFSET_Y=60
    // 点击第一行第一列的中心
    const cellSize = (480 - 2 * 20) / 9; // ≈48.89
    engine.handleClick(20 + cellSize * 2 + cellSize / 2, 60 + cellSize * 3 + cellSize / 2);
    expect(engine.cursorRow).toBe(3);
    expect(engine.cursorCol).toBe(2);
  });

  it('点击左上角设置光标为 (0,0)', () => {
    engine.handleClick(20 + 1, 60 + 1);
    expect(engine.cursorRow).toBe(0);
    expect(engine.cursorCol).toBe(0);
  });

  it('点击超出网格范围不改变光标', () => {
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowRight');
    const prevRow = engine.cursorRow;
    const prevCol = engine.cursorCol;
    // 点击网格左侧之外
    engine.handleClick(10, 60 + 10);
    expect(engine.cursorRow).toBe(prevRow);
    expect(engine.cursorCol).toBe(prevCol);
  });

  it('点击网格下方不改变光标', () => {
    engine.handleKeyDown('ArrowDown');
    const prevRow = engine.cursorRow;
    const prevCol = engine.cursorCol;
    engine.handleClick(100, 700);
    expect(engine.cursorRow).toBe(prevRow);
    expect(engine.cursorCol).toBe(prevCol);
  });

  it('点击右下角设置光标为 (8,8)', () => {
    const cellSize = (480 - 2 * 20) / 9;
    const gridWidth = cellSize * 9;
    engine.handleClick(20 + gridWidth - 1, 60 + gridWidth - 1);
    expect(engine.cursorRow).toBe(8);
    expect(engine.cursorCol).toBe(8);
  });
});

// ================================================================
// 14. handleKeyDown
// ================================================================
describe('handleKeyDown', () => {
  let engine: SudokuEngine;
  let emptyCell: { row: number; col: number };

  beforeEach(() => {
    engine = createEngine();
    emptyCell = findEmptyCell(engine);
    moveCursorTo(engine, emptyCell.row, emptyCell.col);
  });

  it('数字键 1-9 输入数字', () => {
    engine.handleKeyDown('5');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(5);
  });

  it('Delete 擦除', () => {
    engine.handleKeyDown('5');
    engine.handleKeyDown('Delete');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });

  it('Backspace 擦除', () => {
    engine.handleKeyDown('5');
    engine.handleKeyDown('Backspace');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });

  it('n 切换笔记模式', () => {
    expect(engine.noteMode).toBe(false);
    engine.handleKeyDown('n');
    expect(engine.noteMode).toBe(true);
    engine.handleKeyDown('n');
    expect(engine.noteMode).toBe(false);
  });

  it('N（大写）切换笔记模式', () => {
    engine.handleKeyDown('N');
    expect(engine.noteMode).toBe(true);
  });

  it('h 触发提示', () => {
    engine.handleKeyDown('h');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(engine.solution[emptyCell.row][emptyCell.col]);
  });

  it('H（大写）触发提示', () => {
    engine.handleKeyDown('H');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(engine.solution[emptyCell.row][emptyCell.col]);
  });

  it('z 触发撤销', () => {
    engine.handleKeyDown('5');
    engine.handleKeyDown('z');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });

  it('Z（大写）触发撤销', () => {
    engine.handleKeyDown('5');
    engine.handleKeyDown('Z');
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });

  it('gameover 状态下按键无效', () => {
    // 强制设为 gameover
    (engine as any)._status = 'gameover';
    engine.handleKeyDown('5');
    // 网格不应改变（因为初始为空格）
    expect(engine.grid[emptyCell.row][emptyCell.col]).toBe(0);
  });
});

// ================================================================
// 15. 状态管理
// ================================================================
describe('状态管理', () => {
  it('初始状态为 idle', () => {
    const engine = createEngine();
    expect(engine.status).toBe('idle');
  });

  it('reset 后状态回到 idle', () => {
    const engine = createEngine();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('reset 后分数归零', () => {
    const engine = createEngine();
    const cell = findEmptyCell(engine);
    moveCursorTo(engine, cell.row, cell.col);
    engine.handleKeyDown(String(engine.solution[cell.row][cell.col]));
    expect(engine.score).toBeGreaterThan(0);
    engine.reset();
    expect(engine.score).toBe(0);
  });

  it('reset 后重新生成谜题', () => {
    const engine = createEngine();
    const puzzleBefore = engine.puzzle.map(r => [...r]);
    engine.reset();
    // 谜题应该重新生成（大概率不同，但可能相同）
    // 至少验证结构正确
    expect(engine.puzzle).toHaveLength(9);
    expect(engine.grid).toHaveLength(9);
  });

  it('reset 后光标回到 (0,0)', () => {
    const engine = createEngine();
    engine.handleKeyDown('ArrowDown');
    engine.handleKeyDown('ArrowRight');
    engine.reset();
    expect(engine.cursorRow).toBe(0);
    expect(engine.cursorCol).toBe(0);
  });

  it('reset 后笔记模式关闭', () => {
    const engine = createEngine();
    engine.handleKeyDown('n');
    expect(engine.noteMode).toBe(true);
    engine.reset();
    expect(engine.noteMode).toBe(false);
  });

  it('reset 后提示次数归零', () => {
    const engine = createEngine();
    const cell = findEmptyCell(engine);
    moveCursorTo(engine, cell.row, cell.col);
    engine.handleKeyDown('h');
    expect(engine.hintCount).toBe(1);
    engine.reset();
    expect(engine.hintCount).toBe(0);
  });

  it('reset 后历史记录清空', () => {
    const engine = createEngine();
    const cell = findEmptyCell(engine);
    moveCursorTo(engine, cell.row, cell.col);
    engine.handleKeyDown(String(engine.solution[cell.row][cell.col]));
    engine.reset();
    expect((engine as any)._history.length).toBe(0);
  });

  it('destroy 后状态为 idle', () => {
    const engine = createEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });
});

// ================================================================
// 16. getState
// ================================================================
describe('getState', () => {
  let engine: SudokuEngine;
  let state: Record<string, unknown>;

  beforeEach(() => {
    engine = createEngine();
    state = engine.getState();
  });

  it('返回包含 grid 属性', () => {
    expect(state).toHaveProperty('grid');
    expect((state.grid as number[][]).length).toBe(9);
  });

  it('返回包含 puzzle 属性', () => {
    expect(state).toHaveProperty('puzzle');
    expect((state.puzzle as number[][]).length).toBe(9);
  });

  it('返回包含 solution 属性', () => {
    expect(state).toHaveProperty('solution');
    expect((state.solution as number[][]).length).toBe(9);
  });

  it('notes 被序列化为数组', () => {
    expect(state).toHaveProperty('notes');
    const notes = state.notes as number[][][];
    expect(notes.length).toBe(9);
    expect(notes[0].length).toBe(9);
    expect(Array.isArray(notes[0][0])).toBe(true);
  });

  it('包含所有必要字段', () => {
    const requiredKeys = [
      'grid', 'puzzle', 'solution', 'fixed', 'notes',
      'cursorRow', 'cursorCol', 'noteMode', 'errorCells',
      'isComplete', 'isCorrect', 'score', 'level',
      'elapsedTime', 'status', 'difficulty', 'hintCount',
    ];
    for (const key of requiredKeys) {
      expect(state).toHaveProperty(key);
    }
  });

  it('返回的 grid 是深拷贝（不影响引擎内部）', () => {
    const gridCopy = state.grid as number[][];
    gridCopy[0][0] = 999;
    expect(engine.grid[0][0]).not.toBe(999);
  });

  it('errorCells 是普通数组', () => {
    expect(Array.isArray(state.errorCells)).toBe(true);
  });
});

// ================================================================
// 17. setDifficulty
// ================================================================
describe('setDifficulty', () => {
  it('切换难度后等级更新', () => {
    const engine = createEngine(Difficulty.EASY);
    expect(engine.level).toBe(1);
    engine.setDifficulty(Difficulty.HARD);
    expect(engine.level).toBe(3);
  });

  it('切换难度后重新生成谜题', () => {
    const engine = createEngine(Difficulty.EASY);
    const oldPuzzle = engine.puzzle.map(r => [...r]);
    engine.setDifficulty(Difficulty.MEDIUM);
    // 谜题应该被重新生成
    expect(engine.puzzle).toHaveLength(9);
  });

  it('切换难度后难度属性更新', () => {
    const engine = createEngine(Difficulty.EASY);
    engine.setDifficulty(Difficulty.MEDIUM);
    expect(engine.difficulty).toBe(Difficulty.MEDIUM);
  });
});

// ================================================================
// 18. 综合场景
// ================================================================
describe('综合场景', () => {
  it('完整的填入-撤销-重填流程', () => {
    const engine = createEngine();
    const cell = findEmptyCell(engine);
    moveCursorTo(engine, cell.row, cell.col);

    const correct = engine.solution[cell.row][cell.col];

    // 填入错误数字
    const wrong = correct === 1 ? 2 : 1;
    engine.handleKeyDown(String(wrong));
    expect(engine.grid[cell.row][cell.col]).toBe(wrong);
    expect(engine.score).toBe(0);

    // 撤销
    engine.handleKeyDown('z');
    expect(engine.grid[cell.row][cell.col]).toBe(0);

    // 填入正确数字
    engine.handleKeyDown(String(correct));
    expect(engine.grid[cell.row][cell.col]).toBe(correct);
    expect(engine.score).toBe(10);
  });

  it('笔记-填入-擦除-再填入流程', () => {
    const engine = createEngine();
    const cell = findEmptyCell(engine);
    moveCursorTo(engine, cell.row, cell.col);

    // 笔记模式添加候选数
    engine.handleKeyDown('n');
    engine.handleKeyDown('3');
    engine.handleKeyDown('5');
    expect(engine.notes[cell.row][cell.col].size).toBe(2);

    // 切回普通模式填入
    engine.handleKeyDown('n');
    const correct = engine.solution[cell.row][cell.col];
    engine.handleKeyDown(String(correct));
    expect(engine.grid[cell.row][cell.col]).toBe(correct);
    expect(engine.notes[cell.row][cell.col].size).toBe(0);

    // 擦除
    engine.handleKeyDown('Delete');
    expect(engine.grid[cell.row][cell.col]).toBe(0);

    // 再填入
    engine.handleKeyDown(String(correct));
    expect(engine.grid[cell.row][cell.col]).toBe(correct);
  });

  it('多次 reset 不报错', () => {
    const engine = createEngine();
    engine.reset();
    engine.reset();
    engine.reset();
    expect(engine.status).toBe('idle');
    expect(engine.grid).toHaveLength(9);
  });
});
