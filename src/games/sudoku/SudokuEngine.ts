import { GameEngine } from '@/core/GameEngine';
import {
  GRID_SIZE,
  BOX_SIZE,
  MIN_NUMBER,
  MAX_NUMBER,
  EMPTY_CELL,
  NUMBERS,
  Difficulty,
  DIFFICULTY_HOLES,
  DIFFICULTY_LEVEL,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  GRID_OFFSET_Y,
  GRID_PADDING,
  GRID_WIDTH,
  CELL_SIZE,
  BG_COLOR,
  GRID_LINE_COLOR,
  BOX_LINE_COLOR,
  FIXED_NUMBER_COLOR,
  USER_NUMBER_COLOR,
  ERROR_NUMBER_COLOR,
  SELECTED_CELL_BG,
  HIGHLIGHT_CELL_BG,
  SAME_NUMBER_BG,
  NOTE_TEXT_COLOR,
  HUD_TEXT_COLOR,
  ERROR_CELL_BG,
  THIN_LINE_WIDTH,
  THICK_LINE_WIDTH,
  NOTE_FONT_SIZE,
  NUMBER_FONT_SIZE,
  HUD_FONT_SIZE,
  CORRECT_FILL_SCORE,
  HINT_PENALTY,
  COMPLETION_BONUS,
  TIME_BONUS_FACTOR,
  TIME_BONUS_MAX_SECONDS,
  MAX_SOLUTION_CHECK_LIMIT,
} from './constants';

// ========== 类型定义 ==========

/** 单格坐标 */
export interface CellPosition {
  row: number;
  col: number;
}

/** 撤销历史记录条目 */
export interface HistoryEntry {
  /** 操作类型 */
  type: 'fill' | 'erase' | 'note' | 'hint';
  /** 操作位置 */
  row: number;
  col: number;
  /** 之前的值 */
  prevValue: number;
  /** 之后的值 */
  newValue: number;
  /** 之前的候选数 */
  prevNotes: Set<number>;
  /** 之后的候选数 */
  newNotes: Set<number>;
}

/** 引擎对外状态 */
export interface SudokuState {
  /** 当前网格 */
  grid: number[][];
  /** 初始谜题 */
  puzzle: number[][];
  /** 完整解 */
  solution: number[][];
  /** 固定格标记 */
  fixed: boolean[][];
  /** 候选数标注 */
  notes: number[][][];
  /** 光标行 */
  cursorRow: number;
  /** 光标列 */
  cursorCol: number;
  /** 笔记模式 */
  noteMode: boolean;
  /** 错误格子 */
  errorCells: string[];
  /** 是否填满 */
  isComplete: boolean;
  /** 是否全部正确 */
  isCorrect: boolean;
  /** 分数 */
  score: number;
  /** 等级 */
  level: number;
  /** 用时（秒） */
  elapsedTime: number;
  /** 游戏状态 */
  status: string;
  /** 难度 */
  difficulty: string;
  /** 提示次数 */
  hintCount: number;
}

/**
 * SudokuEngine — 数独游戏引擎
 *
 * 核心功能：
 * - 回溯法生成完整解，再随机挖洞，保证唯一解
 * - 方向键移动光标，1-9 输入数字，N 切换笔记模式
 * - Delete/Backspace 擦除，H 提示，Z 撤销
 * - 自动检测冲突，填满后自动验证
 * - 计分系统：填对 + 时间奖励 - 提示扣分
 */
export class SudokuEngine extends GameEngine {
  // ========== 网格数据 ==========

  /** 初始谜题（0=空格） */
  private _puzzle: number[][] = [];
  /** 完整解 */
  private _solution: number[][] = [];
  /** 当前玩家填写状态 */
  private _grid: number[][] = [];
  /** 固定数字标记 */
  private _fixed: boolean[][] = [];
  /** 候选数标注（每格一个 Set<number>） */
  private _notes: Set<number>[][] = [];

  // ========== 光标与模式 ==========

  /** 光标行 */
  private _cursorRow: number = 0;
  /** 光标列 */
  private _cursorCol: number = 0;
  /** 笔记模式 */
  private _noteMode: boolean = false;

  // ========== 错误检测 ==========

  /** 错误格子集合（"row,col" 格式） */
  private _errorCells: Set<string> = new Set();

  // ========== 历史/撤销 ==========

  /** 操作历史栈 */
  private _history: HistoryEntry[] = [];

  // ========== 统计 ==========

  /** 提示使用次数 */
  private _hintCount: number = 0;
  /** 当前难度 */
  private _difficulty: Difficulty = Difficulty.EASY;

  // ========== 公开 Getter ==========

  /** 光标行 */
  get cursorRow(): number { return this._cursorRow; }
  /** 光标列 */
  get cursorCol(): number { return this._cursorCol; }
  /** 是否笔记模式 */
  get noteMode(): boolean { return this._noteMode; }
  /** 错误格子集合 */
  get errorCells(): Set<string> { return this._errorCells; }
  /** 当前网格 */
  get grid(): number[][] { return this._grid; }
  /** 初始谜题 */
  get puzzle(): number[][] { return this._puzzle; }
  /** 完整解 */
  get solution(): number[][] { return this._solution; }
  /** 固定标记 */
  get fixed(): boolean[][] { return this._fixed; }
  /** 候选数标注 */
  get notes(): Set<number>[][] { return this._notes; }
  /** 提示次数 */
  get hintCount(): number { return this._hintCount; }
  /** 难度 */
  get difficulty(): Difficulty { return this._difficulty; }

  /** 是否所有格子都已填满 */
  get isComplete(): boolean {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this._grid[r][c] === EMPTY_CELL) return false;
      }
    }
    return true;
  }

  /** 是否全部正确（grid === solution） */
  get isCorrect(): boolean {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this._grid[r][c] !== this._solution[r][c]) return false;
      }
    }
    return true;
  }

  constructor(difficulty: Difficulty = Difficulty.EASY) {
    super();
    this._difficulty = difficulty;
  }

  // ========== GameEngine 生命周期 ==========

  protected onInit(): void {
    this.generatePuzzle();
  }

  protected onStart(): void {
    // 开始计时（基类已处理 _startTime）
  }

  protected update(_deltaTime: number): void {
    // 更新计时（基类 gameLoop 已处理 _elapsedTime）
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this.renderHUD(ctx, w);

    // 网格背景与高亮
    this.renderHighlights(ctx);

    // 网格线
    this.renderGridLines(ctx);

    // 数字与候选数
    this.renderNumbers(ctx);

    // 选中格边框
    this.renderCursor(ctx);
  }

  protected onReset(): void {
    this.generatePuzzle();
    this._noteMode = false;
    this._hintCount = 0;
    this._history = [];
    this._cursorRow = 0;
    this._cursorCol = 0;
  }

  protected onPause(): void {
    // 暂停时不做额外处理
  }

  protected onResume(): void {
    // 恢复时不做额外处理
  }

  protected onDestroy(): void {
    this._history = [];
  }

  protected onGameOver(): void {
    // 游戏完成时触发
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status === 'gameover') return;

    // 方向键移动光标
    if (key === 'ArrowUp') {
      this._cursorRow = Math.max(0, this._cursorRow - 1);
      return;
    }
    if (key === 'ArrowDown') {
      this._cursorRow = Math.min(GRID_SIZE - 1, this._cursorRow + 1);
      return;
    }
    if (key === 'ArrowLeft') {
      this._cursorCol = Math.max(0, this._cursorCol - 1);
      return;
    }
    if (key === 'ArrowRight') {
      this._cursorCol = Math.min(GRID_SIZE - 1, this._cursorCol + 1);
      return;
    }

    // 数字键 1-9
    const num = parseInt(key, 10);
    if (num >= MIN_NUMBER && num <= MAX_NUMBER) {
      this.inputNumber(num);
      return;
    }

    // 擦除
    if (key === 'Delete' || key === 'Backspace') {
      this.eraseCell();
      return;
    }

    // 切换笔记模式
    if (key === 'n' || key === 'N') {
      this._noteMode = !this._noteMode;
      return;
    }

    // 提示
    if (key === 'h' || key === 'H') {
      this.giveHint();
      return;
    }

    // 撤销
    if (key === 'z' || key === 'Z') {
      this.undo();
      return;
    }
  }

  handleKeyUp(_key: string): void {
    // 无特殊处理
  }

  // ========== 状态导出 ==========

  getState(): Record<string, unknown> {
    // 将 notes Set 转为普通数组以便序列化
    const notesArray: number[][][] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      notesArray[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        notesArray[r][c] = Array.from(this._notes[r][c]).sort();
      }
    }

    return {
      grid: this._grid.map(row => [...row]),
      puzzle: this._puzzle.map(row => [...row]),
      solution: this._solution.map(row => [...row]),
      fixed: this._fixed.map(row => [...row]),
      notes: notesArray,
      cursorRow: this._cursorRow,
      cursorCol: this._cursorCol,
      noteMode: this._noteMode,
      errorCells: Array.from(this._errorCells),
      isComplete: this.isComplete,
      isCorrect: this.isCorrect,
      score: this._score,
      level: this._level,
      elapsedTime: this._elapsedTime,
      status: this._status,
      difficulty: this._difficulty,
      hintCount: this._hintCount,
    };
  }

  // ========== 公开方法 ==========

  /**
   * 处理鼠标/触摸点击，将画布坐标转换为格子选中
   * @param canvasX 画布 X 坐标
   * @param canvasY 画布 Y 坐标
   */
  handleClick(canvasX: number, canvasY: number): void {
    // 计算相对于网格的行列
    const col = Math.floor((canvasX - GRID_PADDING) / CELL_SIZE);
    const row = Math.floor((canvasY - GRID_OFFSET_Y) / CELL_SIZE);

    // 边界检查
    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
      this._cursorRow = row;
      this._cursorCol = col;
    }
  }

  /**
   * 设置难度并重新生成谜题
   * @param difficulty 难度等级
   */
  setDifficulty(difficulty: Difficulty): void {
    this._difficulty = difficulty;
    this._level = DIFFICULTY_LEVEL[difficulty];
    this.generatePuzzle();
  }

  // ========== 谜题生成 ==========

  /**
   * 生成数独谜题：先填满完整解，再挖洞
   */
  private generatePuzzle(): void {
    // 生成完整解
    this._solution = this.createEmptyGrid();
    this.fillGrid(this._solution);

    // 复制为谜题
    this._puzzle = this._solution.map(row => [...row]);

    // 挖洞
    const holes = DIFFICULTY_HOLES[this._difficulty];
    this.digHoles(this._puzzle, holes);

    // 初始化玩家网格
    this._grid = this._puzzle.map(row => [...row]);

    // 初始化固定标记
    this._fixed = this._puzzle.map(row =>
      row.map(v => v !== EMPTY_CELL)
    );

    // 初始化候选数
    this._notes = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      this._notes[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        this._notes[r][c] = new Set<number>();
      }
    }

    // 重置错误和状态
    this._errorCells = new Set();
    this._hintCount = 0;
    this._history = [];
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._noteMode = false;
    this._level = DIFFICULTY_LEVEL[this._difficulty];
  }

  /**
   * 创建空 9×9 网格
   */
  private createEmptyGrid(): number[][] {
    return Array.from({ length: GRID_SIZE }, () =>
      Array(GRID_SIZE).fill(EMPTY_CELL)
    );
  }

  /**
   * 用回溯法填充完整数独解
   * @param grid 9×9 网格
   * @returns 是否成功
   */
  private fillGrid(grid: number[][]): boolean {
    // 找到第一个空格
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === EMPTY_CELL) {
          // 随机打乱数字顺序
          const nums = this.shuffleArray([...NUMBERS]);
          for (const num of nums) {
            if (this.isValidPlacement(grid, r, c, num)) {
              grid[r][c] = num;
              if (this.fillGrid(grid)) return true;
              grid[r][c] = EMPTY_CELL;
            }
          }
          return false; // 所有数字都不行，回溯
        }
      }
    }
    return true; // 所有格子都填满了
  }

  /**
   * 检查在 (row, col) 放置 num 是否合法
   */
  private isValidPlacement(grid: number[][], row: number, col: number, num: number): boolean {
    // 检查行
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[row][c] === num) return false;
    }
    // 检查列
    for (let r = 0; r < GRID_SIZE; r++) {
      if (grid[r][col] === num) return false;
    }
    // 检查宫
    const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
    const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
    for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
      for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
        if (grid[r][c] === num) return false;
      }
    }
    return true;
  }

  /**
   * 随机挖洞，保证唯一解
   * @param grid 谜题网格（会被修改）
   * @param holes 挖洞数量
   */
  private digHoles(grid: number[][], holes: number): void {
    // 生成所有位置并打乱
    const positions: CellPosition[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        positions.push({ row: r, col: c });
      }
    }
    this.shuffleArray(positions);

    let dug = 0;
    for (const pos of positions) {
      if (dug >= holes) break;

      const { row, col } = pos;
      const backup = grid[row][col];
      grid[row][col] = EMPTY_CELL;

      // 验证唯一解
      if (this.countSolutions(grid) === 1) {
        dug++;
      } else {
        // 恢复，保证唯一解
        grid[row][col] = backup;
      }
    }
  }

  /**
   * 计算网格解的数量（最多计数到 MAX_SOLUTION_CHECK_LIMIT 即停止）
   */
  private countSolutions(grid: number[][]): number {
    const copy = grid.map(row => [...row]);
    let count = 0;

    const solve = (): boolean => {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (copy[r][c] === EMPTY_CELL) {
            for (const num of NUMBERS) {
              if (this.isValidPlacement(copy, r, c, num)) {
                copy[r][c] = num;
                if (solve()) return true;
                copy[r][c] = EMPTY_CELL;
              }
            }
            return false;
          }
        }
      }
      count++;
      return count >= MAX_SOLUTION_CHECK_LIMIT;
    };

    solve();
    return count;
  }

  /**
   * Fisher-Yates 洗牌算法
   */
  private shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ========== 数字输入 ==========

  /**
   * 向选中格输入数字
   * @param num 数字 1-9
   */
  private inputNumber(num: number): void {
    const row = this._cursorRow;
    const col = this._cursorCol;

    // 不能修改固定格
    if (this._fixed[row][col]) return;

    if (this._noteMode) {
      // 笔记模式：添加/移除候选数
      this.toggleNote(row, col, num);
    } else {
      // 普通模式：填入数字
      const prevValue = this._grid[row][col];
      const prevNotes = new Set(this._notes[row][col]);

      if (prevValue === num) return; // 相同数字不重复操作

      this._grid[row][col] = num;
      // 填入数字时清除该格候选数
      this._notes[row][col] = new Set();

      // 记录历史
      this._history.push({
        type: 'fill',
        row,
        col,
        prevValue,
        newValue: num,
        prevNotes,
        newNotes: new Set(),
      });

      // 检测是否正确
      if (num === this._solution[row][col]) {
        this.addScore(CORRECT_FILL_SCORE);
      }

      // 更新错误检测
      this.detectErrors();

      // 自动检查完成
      this.checkCompletion();
    }
  }

  /**
   * 切换候选数标注
   */
  private toggleNote(row: number, col: number, num: number): void {
    if (this._fixed[row][col]) return;
    if (this._grid[row][col] !== EMPTY_CELL) return; // 已填数字的格子不能加候选数

    const prevNotes = new Set(this._notes[row][col]);

    if (this._notes[row][col].has(num)) {
      this._notes[row][col].delete(num);
    } else {
      this._notes[row][col].add(num);
    }

    // 记录历史
    this._history.push({
      type: 'note',
      row,
      col,
      prevValue: EMPTY_CELL,
      newValue: EMPTY_CELL,
      prevNotes,
      newNotes: new Set(this._notes[row][col]),
    });
  }

  // ========== 擦除 ==========

  /**
   * 擦除选中格的用户输入
   */
  private eraseCell(): void {
    const row = this._cursorRow;
    const col = this._cursorCol;

    // 不能擦除固定格
    if (this._fixed[row][col]) return;
    // 空格且无候选数，无需擦除
    if (this._grid[row][col] === EMPTY_CELL && this._notes[row][col].size === 0) return;

    const prevValue = this._grid[row][col];
    const prevNotes = new Set(this._notes[row][col]);

    this._grid[row][col] = EMPTY_CELL;
    this._notes[row][col] = new Set();

    // 记录历史
    this._history.push({
      type: 'erase',
      row,
      col,
      prevValue,
      newValue: EMPTY_CELL,
      prevNotes,
      newNotes: new Set(),
    });

    // 更新错误检测
    this.detectErrors();
  }

  // ========== 提示 ==========

  /**
   * 给出一个提示：在选中格填入正确数字
   */
  private giveHint(): void {
    const row = this._cursorRow;
    const col = this._cursorCol;

    // 固定格不需要提示
    if (this._fixed[row][col]) return;
    // 已经正确的格子不需要提示
    if (this._grid[row][col] === this._solution[row][col]) return;

    const prevValue = this._grid[row][col];
    const prevNotes = new Set(this._notes[row][col]);
    const correctValue = this._solution[row][col];

    this._grid[row][col] = correctValue;
    this._notes[row][col] = new Set();
    this._hintCount++;

    // 记录历史
    this._history.push({
      type: 'hint',
      row,
      col,
      prevValue,
      newValue: correctValue,
      prevNotes,
      newNotes: new Set(),
    });

    // 提示扣分
    this.addScore(-HINT_PENALTY);

    // 更新错误检测
    this.detectErrors();

    // 自动检查完成
    this.checkCompletion();
  }

  // ========== 撤销 ==========

  /**
   * 撤销上一步操作
   */
  private undo(): void {
    if (this._history.length === 0) return;

    const entry = this._history.pop()!;
    const { row, col, prevValue, prevNotes } = entry;

    this._grid[row][col] = prevValue;
    this._notes[row][col] = new Set(prevNotes);

    // 如果之前是填对得分，撤销时扣回
    if (entry.type === 'fill' && entry.newValue === this._solution[row][col]) {
      this.addScore(-CORRECT_FILL_SCORE);
    }
    // 如果之前是提示扣分，撤销时回补
    if (entry.type === 'hint') {
      this._hintCount--;
      this.addScore(HINT_PENALTY);
    }

    // 更新错误检测
    this.detectErrors();
  }

  // ========== 错误检测 ==========

  /**
   * 检测所有冲突格子
   * 检查行、列、宫中是否有重复数字
   */
  private detectErrors(): void {
    this._errorCells = new Set();

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const val = this._grid[r][c];
        if (val === EMPTY_CELL) continue;
        if (this._fixed[r][c]) continue; // 固定格不标错误

        if (this.hasConflict(r, c, val)) {
          this._errorCells.add(`${r},${c}`);
        }
      }
    }
  }

  /**
   * 检查 (row, col) 的值是否与同行/列/宫冲突
   */
  private hasConflict(row: number, col: number, val: number): boolean {
    // 检查行
    for (let c = 0; c < GRID_SIZE; c++) {
      if (c !== col && this._grid[row][c] === val) return true;
    }
    // 检查列
    for (let r = 0; r < GRID_SIZE; r++) {
      if (r !== row && this._grid[r][col] === val) return true;
    }
    // 检查宫
    const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
    const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
    for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
      for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
        if (r !== row || c !== col) {
          if (this._grid[r][c] === val) return true;
        }
      }
    }
    return false;
  }

  // ========== 自动完成检查 ==========

  /**
   * 检查是否填满且全部正确
   */
  private checkCompletion(): void {
    if (!this.isComplete) return;
    if (!this.isCorrect) return;

    // 计算时间奖励
    const timeBonus = Math.max(
      0,
      Math.floor((TIME_BONUS_MAX_SECONDS - this._elapsedTime) * TIME_BONUS_FACTOR)
    );
    this.addScore(COMPLETION_BONUS + timeBonus);

    this.gameOver();
  }

  // ========== 渲染方法 ==========

  /**
   * 渲染 HUD（顶部信息栏）
   */
  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.font = `${HUD_FONT_SIZE}px monospace`;

    const diffLabel = this._difficulty === Difficulty.EASY ? '简单'
      : this._difficulty === Difficulty.MEDIUM ? '中等' : '困难';

    ctx.fillText(`分数: ${this._score}`, 10, 25);
    ctx.fillText(`难度: ${diffLabel}`, 160, 25);
    ctx.fillText(`时间: ${Math.floor(this._elapsedTime)}s`, 320, 25);

    if (this._noteMode) {
      ctx.fillStyle = '#1565c0';
      ctx.fillText('[笔记]', 430, 25);
    }
  }

  /**
   * 渲染格子高亮（选中格、同行/列/宫、相同数字）
   */
  private renderHighlights(ctx: CanvasRenderingContext2D): void {
    const selectedVal = this._grid[this._cursorRow][this._cursorCol];

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = GRID_PADDING + c * CELL_SIZE;
        const y = GRID_OFFSET_Y + r * CELL_SIZE;

        // 同行/列/宫高亮
        const sameRow = r === this._cursorRow;
        const sameCol = c === this._cursorCol;
        const sameBox = Math.floor(r / BOX_SIZE) === Math.floor(this._cursorRow / BOX_SIZE)
          && Math.floor(c / BOX_SIZE) === Math.floor(this._cursorCol / BOX_SIZE);

        if (sameRow || sameCol || sameBox) {
          ctx.fillStyle = HIGHLIGHT_CELL_BG;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }

        // 相同数字高亮
        if (selectedVal !== EMPTY_CELL && this._grid[r][c] === selectedVal) {
          ctx.fillStyle = SAME_NUMBER_BG;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }

        // 错误格子背景
        if (this._errorCells.has(`${r},${c}`)) {
          ctx.fillStyle = ERROR_CELL_BG;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }

        // 选中格背景
        if (r === this._cursorRow && c === this._cursorCol) {
          ctx.fillStyle = SELECTED_CELL_BG;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }
      }
    }
  }

  /**
   * 渲染网格线
   */
  private renderGridLines(ctx: CanvasRenderingContext2D): void {
    // 细线
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = THIN_LINE_WIDTH;

    for (let i = 0; i <= GRID_SIZE; i++) {
      const x = GRID_PADDING + i * CELL_SIZE;
      const y = GRID_OFFSET_Y + i * CELL_SIZE;

      // 竖线
      ctx.beginPath();
      ctx.moveTo(x, GRID_OFFSET_Y);
      ctx.lineTo(x, GRID_OFFSET_Y + GRID_WIDTH);
      ctx.stroke();

      // 横线
      ctx.beginPath();
      ctx.moveTo(GRID_PADDING, y);
      ctx.lineTo(GRID_PADDING + GRID_WIDTH, y);
      ctx.stroke();
    }

    // 粗线（宫格边框）
    ctx.strokeStyle = BOX_LINE_COLOR;
    ctx.lineWidth = THICK_LINE_WIDTH;

    for (let i = 0; i <= BOX_SIZE; i++) {
      const x = GRID_PADDING + i * BOX_SIZE * CELL_SIZE;
      const y = GRID_OFFSET_Y + i * BOX_SIZE * CELL_SIZE;

      // 竖线
      ctx.beginPath();
      ctx.moveTo(x, GRID_OFFSET_Y);
      ctx.lineTo(x, GRID_OFFSET_Y + GRID_WIDTH);
      ctx.stroke();

      // 横线
      ctx.beginPath();
      ctx.moveTo(GRID_PADDING, y);
      ctx.lineTo(GRID_PADDING + GRID_WIDTH, y);
      ctx.stroke();
    }
  }

  /**
   * 渲染数字和候选数
   */
  private renderNumbers(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = GRID_PADDING + c * CELL_SIZE;
        const y = GRID_OFFSET_Y + r * CELL_SIZE;
        const val = this._grid[r][c];

        if (val !== EMPTY_CELL) {
          // 渲染数字
          const isError = this._errorCells.has(`${r},${c}`);
          const isFixed = this._fixed[r][c];

          if (isError) {
            ctx.fillStyle = ERROR_NUMBER_COLOR;
          } else if (isFixed) {
            ctx.fillStyle = FIXED_NUMBER_COLOR;
          } else {
            ctx.fillStyle = USER_NUMBER_COLOR;
          }

          ctx.font = `bold ${NUMBER_FONT_SIZE}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            val.toString(),
            x + CELL_SIZE / 2,
            y + CELL_SIZE / 2
          );
        } else {
          // 渲染候选数
          const notes = this._notes[r][c];
          if (notes.size > 0) {
            ctx.fillStyle = NOTE_TEXT_COLOR;
            ctx.font = `${NOTE_FONT_SIZE}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const noteCellSize = CELL_SIZE / BOX_SIZE;
            for (const n of notes) {
              const nr = Math.floor((n - 1) / BOX_SIZE);
              const nc = (n - 1) % BOX_SIZE;
              ctx.fillText(
                n.toString(),
                x + nc * noteCellSize + noteCellSize / 2,
                y + nr * noteCellSize + noteCellSize / 2
              );
            }
          }
        }
      }
    }

    // 重置对齐
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * 渲染光标（选中格边框）
   */
  private renderCursor(ctx: CanvasRenderingContext2D): void {
    const x = GRID_PADDING + this._cursorCol * CELL_SIZE;
    const y = GRID_OFFSET_Y + this._cursorRow * CELL_SIZE;

    // 选中格背景
    ctx.fillStyle = SELECTED_CELL_BG;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

    // 选中格边框
    ctx.strokeStyle = '#1565c0';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }
}
