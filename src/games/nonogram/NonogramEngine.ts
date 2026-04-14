import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  FOOTER_HEIGHT,
  Difficulty,
  DIFFICULTY_SIZE,
  DIFFICULTY_LEVEL,
  DIFFICULTY_MULTIPLIER,
  CellState,
  BG_COLOR,
  GRID_BG_COLOR,
  CELL_EMPTY_COLOR,
  CELL_FILLED_COLOR,
  CELL_MARKED_COLOR,
  CELL_CURSOR_COLOR,
  CELL_ERROR_COLOR,
  GRID_LINE_COLOR,
  GRID_THICK_COLOR,
  CLUE_TEXT_COLOR,
  CLUE_COMPLETED_COLOR,
  HUD_TEXT_COLOR,
  MARK_X_COLOR,
  WIN_OVERLAY_COLOR,
  THIN_LINE_WIDTH,
  THICK_LINE_WIDTH,
  CLUE_FONT_SIZE_EASY,
  CLUE_FONT_SIZE_MEDIUM,
  CLUE_FONT_SIZE_HARD,
  HUD_FONT_SIZE,
  MARK_X_FONT_SIZE,
  COMPLETION_BASE_SCORE,
  TIME_BONUS_FACTOR,
  TIME_BONUS_MAX_SECONDS,
  PRESET_PUZZLES,
  PresetPuzzle,
} from './constants';

// ========== 类型定义 ==========

/** 光标位置 */
export interface CursorPosition {
  row: number;
  col: number;
}

/** 行/列提示 */
export interface ClueGroup {
  clues: number[];
  completed: boolean;
}

/** 引擎对外状态 */
export interface NonogramState {
  [key: string]: unknown;
  gridSize: number;
  grid: CellState[][];
  solution: number[][];
  rowClues: number[][];
  colClues: number[][];
  cursor: CursorPosition;
  difficulty: Difficulty;
  isComplete: boolean;
  hasErrors: boolean;
  errorCells: boolean[][];
  elapsedTime: number;
  puzzleName: string;
}

// ========== 引擎实现 ==========

export class NonogramEngine extends GameEngine {
  // 游戏数据
  private gridSize: number = 5;
  private grid: CellState[][] = [];
  private solution: number[][] = [];
  private rowClues: number[][] = [];
  private colClues: number[][] = [];
  private cursor: CursorPosition = { row: 0, col: 0 };
  private difficulty: Difficulty = Difficulty.EASY;
  private isComplete: boolean = false;
  private puzzleName: string = '';

  // 错误检测
  private errorCells: boolean[][] = [];
  private showErrors: boolean = true;

  // 预设谜题索引
  private currentPuzzleIndex: number = -1;

  // ========== 公共属性 ==========

  get isWin(): boolean {
    return this.isComplete;
  }

  get currentDifficulty(): Difficulty {
    return this.difficulty;
  }

  get currentGridSize(): number {
    return this.gridSize;
  }

  get currentPuzzleName(): string {
    return this.puzzleName;
  }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.loadPuzzle(Difficulty.EASY);
  }

  protected onStart(): void {
    // 重置网格但保留谜题
    this.resetGrid();
    this.isComplete = false;
    // 检查初始完成状态（如全空谜题）
    this.checkCompletion();
  }

  protected update(_deltaTime: number): void {
    // 数织是回合制，不需要每帧更新
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.renderGame(ctx, w, h);
  }

  protected onReset(): void {
    this.resetGrid();
    this.isComplete = false;
  }

  protected onGameOver(): void {
    // 数织不会 Game Over，只有胜利
  }

  // ========== 键盘处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.moveCursor(-1, 0);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.moveCursor(1, 0);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.moveCursor(0, -1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.moveCursor(0, 1);
        break;
      case ' ':
        this.toggleFill();
        break;
      case 'x':
      case 'X':
        this.toggleMark();
        break;
      case 'r':
      case 'R':
        this.resetCurrentPuzzle();
        break;
      case 'n':
      case 'N':
        this.newPuzzle();
        break;
      case '1':
        this.changeDifficulty(Difficulty.EASY);
        break;
      case '2':
        this.changeDifficulty(Difficulty.MEDIUM);
        break;
      case '3':
        this.changeDifficulty(Difficulty.HARD);
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 数织不需要 keyUp 事件
  }

  // ========== 状态获取 ==========

  getState(): Record<string, unknown> {
    return {
      gridSize: this.gridSize,
      grid: this.grid.map(row => [...row]),
      solution: this.solution.map(row => [...row]),
      rowClues: this.rowClues.map(row => [...row]),
      colClues: this.colClues.map(col => [...col]),
      cursor: { ...this.cursor },
      difficulty: this.difficulty,
      isComplete: this.isComplete,
      errorCells: this.errorCells.map(row => [...row]),
      elapsedTime: this._elapsedTime,
      puzzleName: this.puzzleName,
    } as NonogramState;
  }

  // ========== 核心逻辑 ==========

  /** 加载谜题 */
  loadPuzzle(difficulty: Difficulty, puzzleIndex?: number): void {
    this.difficulty = difficulty;
    this.gridSize = DIFFICULTY_SIZE[difficulty];

    // 筛选对应难度的预设谜题
    const matchingPuzzles = PRESET_PUZZLES.filter(p => p.size === this.gridSize);

    if (puzzleIndex !== undefined && puzzleIndex >= 0 && puzzleIndex < matchingPuzzles.length) {
      this.currentPuzzleIndex = puzzleIndex;
    } else {
      // 随机选择
      this.currentPuzzleIndex = Math.floor(Math.random() * matchingPuzzles.length);
    }

    const puzzle = matchingPuzzles[this.currentPuzzleIndex];
    this.puzzleName = puzzle.name;
    this.solution = puzzle.solution.map(row => [...row]);

    // 计算提示
    this.rowClues = this.calculateRowClues(this.solution);
    this.colClues = this.calculateColClues(this.solution);

    // 初始化网格
    this.initGrid();

    // 设置等级
    this.setLevel(DIFFICULTY_LEVEL[difficulty]);
  }

  /** 从自定义解决方案加载 */
  loadFromSolution(solution: number[][], name: string = ''): void {
    this.gridSize = solution.length;
    this.solution = solution.map(row => [...row]);
    this.puzzleName = name;
    this.rowClues = this.calculateRowClues(this.solution);
    this.colClues = this.calculateColClues(this.solution);
    this.initGrid();
  }

  /** 初始化网格 */
  private initGrid(): void {
    this.grid = [];
    this.errorCells = [];
    for (let r = 0; r < this.gridSize; r++) {
      this.grid.push(new Array(this.gridSize).fill(CellState.EMPTY));
      this.errorCells.push(new Array(this.gridSize).fill(false));
    }
    this.cursor = { row: 0, col: 0 };
    this.isComplete = false;
  }

  /** 重置网格（保留谜题） */
  private resetGrid(): void {
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        this.grid[r][c] = CellState.EMPTY;
        this.errorCells[r][c] = false;
      }
    }
    this.cursor = { row: 0, col: 0 };
    this.isComplete = false;
  }

  /** 重置当前谜题 */
  resetCurrentPuzzle(): void {
    this.resetGrid();
    this.emit('stateChange');
  }

  /** 新谜题 */
  newPuzzle(): void {
    this.loadPuzzle(this.difficulty);
    this.emit('stateChange');
  }

  /** 切换难度 */
  changeDifficulty(difficulty: Difficulty): void {
    if (this.difficulty === difficulty) return;
    this.loadPuzzle(difficulty);
    this.emit('stateChange');
  }

  /** 移动光标 */
  moveCursor(dr: number, dc: number): void {
    const newRow = Math.max(0, Math.min(this.gridSize - 1, this.cursor.row + dr));
    const newCol = Math.max(0, Math.min(this.gridSize - 1, this.cursor.col + dc));
    this.cursor = { row: newRow, col: newCol };
    this.emit('stateChange');
  }

  /** 涂色/取消涂色 */
  toggleFill(): void {
    const { row, col } = this.cursor;
    if (this.isComplete) return;

    if (this.grid[row][col] === CellState.FILLED) {
      this.grid[row][col] = CellState.EMPTY;
    } else {
      this.grid[row][col] = CellState.FILLED;
    }

    this.updateErrors();
    this.checkCompletion();
    this.emit('stateChange');
  }

  /** 标记空白/取消标记 */
  toggleMark(): void {
    const { row, col } = this.cursor;
    if (this.isComplete) return;

    if (this.grid[row][col] === CellState.MARKED) {
      this.grid[row][col] = CellState.EMPTY;
    } else {
      this.grid[row][col] = CellState.MARKED;
    }

    this.updateErrors();
    this.emit('stateChange');
  }

  /** 设置指定格子状态（供测试和点击使用） */
  setCell(row: number, col: number, state: CellState): void {
    if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) return;
    if (this.isComplete) return;
    this.grid[row][col] = state;
    this.updateErrors();
    this.checkCompletion();
    this.emit('stateChange');
  }

  /** 获取指定格子状态 */
  getCell(row: number, col: number): CellState {
    if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) {
      return CellState.EMPTY;
    }
    return this.grid[row][col];
  }

  /** 设置光标位置 */
  setCursor(row: number, col: number): void {
    this.cursor = {
      row: Math.max(0, Math.min(this.gridSize - 1, row)),
      col: Math.max(0, Math.min(this.gridSize - 1, col)),
    };
  }

  // ========== 提示计算 ==========

  /** 计算行提示 */
  calculateRowClues(solution: number[][]): number[][] {
    return solution.map(row => this.calculateLineClues(row));
  }

  /** 计算列提示 */
  calculateColClues(solution: number[][]): number[][] {
    const clues: number[][] = [];
    for (let c = 0; c < solution[0].length; c++) {
      const col = solution.map(row => row[c]);
      clues.push(this.calculateLineClues(col));
    }
    return clues;
  }

  /** 计算单行/列的连续段 */
  calculateLineClues(line: number[]): number[] {
    const clues: number[] = [];
    let count = 0;

    for (const cell of line) {
      if (cell === 1) {
        count++;
      } else {
        if (count > 0) {
          clues.push(count);
          count = 0;
        }
      }
    }
    if (count > 0) {
      clues.push(count);
    }

    return clues.length > 0 ? clues : [0];
  }

  /** 获取当前网格某行的涂色段 */
  getPlayerRowClues(row: number): number[] {
    const line = this.grid[row].map(cell => cell === CellState.FILLED ? 1 : 0);
    return this.calculateLineClues(line);
  }

  /** 获取当前网格某列的涂色段 */
  getPlayerColClues(col: number): number[] {
    const line = this.grid.map(row => row[col] === CellState.FILLED ? 1 : 0);
    return this.calculateLineClues(line);
  }

  // ========== 错误检测 ==========

  /** 更新错误标记 */
  private updateErrors(): void {
    if (!this.showErrors) return;

    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        // 涂色但答案为空白 → 错误
        if (this.grid[r][c] === CellState.FILLED && this.solution[r][c] === 0) {
          this.errorCells[r][c] = true;
        } else {
          this.errorCells[r][c] = false;
        }
      }
    }
  }

  /** 检查是否有错误 */
  hasErrorsInGrid(): boolean {
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.errorCells[r][c]) return true;
      }
    }
    return false;
  }

  /** 获取错误格子数 */
  getErrorCount(): number {
    let count = 0;
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.errorCells[r][c]) count++;
      }
    }
    return count;
  }

  /** 设置错误检测开关 */
  setShowErrors(show: boolean): void {
    this.showErrors = show;
    if (!show) {
      // 清除所有错误标记
      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          this.errorCells[r][c] = false;
        }
      }
    } else {
      this.updateErrors();
    }
  }

  // ========== 完成检测 ==========

  /** 检查谜题是否完成 */
  checkCompletion(): boolean {
    // 每个格子必须匹配答案
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const isFilledInSolution = this.solution[r][c] === 1;
        const isFilledByPlayer = this.grid[r][c] === CellState.FILLED;

        if (isFilledInSolution !== isFilledByPlayer) {
          return false;
        }
      }
    }

    // 全部匹配 → 胜利
    this.isComplete = true;
    this.calculateScore();
    this.gameOver();
    return true;
  }

  /** 检查某行是否完成 */
  isRowComplete(row: number): boolean {
    const playerClues = this.getPlayerRowClues(row);
    const expectedClues = this.rowClues[row];
    return this.cluesMatch(playerClues, expectedClues);
  }

  /** 检查某列是否完成 */
  isColComplete(col: number): boolean {
    const playerClues = this.getPlayerColClues(col);
    const expectedClues = this.colClues[col];
    return this.cluesMatch(playerClues, expectedClues);
  }

  /** 比较两组提示是否匹配 */
  private cluesMatch(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }

  /** 计算得分 */
  private calculateScore(): void {
    const base = COMPLETION_BASE_SCORE;
    const diffMultiplier = DIFFICULTY_MULTIPLIER[this.difficulty];
    const timeBonus = Math.max(0, Math.floor((TIME_BONUS_MAX_SECONDS - this._elapsedTime) * TIME_BONUS_FACTOR / 10));
    const total = base * diffMultiplier + timeBonus;
    this._score = total;
    this.emit('scoreChange', this._score);
  }

  // ========== 渲染 ==========

  private renderGame(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 清空画布
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 计算5区域布局
    const maxRowClueLen = Math.max(...this.rowClues.map(r => r.length));
    const maxColClueLen = Math.max(...this.colClues.map(c => c.length));

    const clueFontSize = this.getClueFontSize();
    ctx.font = `${clueFontSize}px monospace`;

    const clueCellSize = clueFontSize + 4;
    const rowClueWidth = maxRowClueLen * clueCellSize;
    const colClueHeight = maxColClueLen * clueCellSize;

    const gridAreaWidth = w - rowClueWidth - 20;
    const gridAreaHeight = h - HUD_HEIGHT - colClueHeight - FOOTER_HEIGHT - 20;
    const cellSize = Math.floor(Math.min(gridAreaWidth / this.gridSize, gridAreaHeight / this.gridSize));

    const gridStartX = rowClueWidth + 10;
    const gridStartY = HUD_HEIGHT + colClueHeight + 10;

    // 渲染 HUD
    this.renderHUD(ctx, w);

    // 渲染列提示
    this.renderColClues(ctx, gridStartX, HUD_HEIGHT + 10, cellSize, clueFontSize);

    // 渲染行提示
    this.renderRowClues(ctx, 10, gridStartY, cellSize, clueFontSize, rowClueWidth);

    // 渲染网格
    this.renderGrid(ctx, gridStartX, gridStartY, cellSize);

    // 渲染光标
    this.renderCursor(ctx, gridStartX, gridStartY, cellSize);

    // 渲染胜利画面
    if (this.isComplete) {
      this.renderWinOverlay(ctx, w, h);
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.font = `${HUD_FONT_SIZE}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`数织 ${this.puzzleName}`, 10, 24);

    ctx.textAlign = 'right';
    const timeStr = this.formatTime(this._elapsedTime);
    ctx.fillText(`${timeStr} | ${this.gridSize}×${this.gridSize}`, w - 10, 24);
  }

  private renderRowClues(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    cellSize: number, fontSize: number,
    clueWidth: number
  ): void {
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < this.gridSize; r++) {
      const clues = this.rowClues[r];
      const completed = this.isRowComplete(r);
      ctx.fillStyle = completed ? CLUE_COMPLETED_COLOR : CLUE_TEXT_COLOR;

      for (let i = 0; i < clues.length; i++) {
        const textX = x + clueWidth - (clues.length - i) * (fontSize + 4);
        const textY = y + r * cellSize + cellSize / 2;
        ctx.fillText(String(clues[i]), textX, textY);
      }
    }
  }

  private renderColClues(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    cellSize: number, fontSize: number
  ): void {
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (let c = 0; c < this.gridSize; c++) {
      const clues = this.colClues[c];
      const completed = this.isColComplete(c);
      ctx.fillStyle = completed ? CLUE_COMPLETED_COLOR : CLUE_TEXT_COLOR;

      for (let i = 0; i < clues.length; i++) {
        const textX = x + c * cellSize + cellSize / 2;
        const textY = y + (i + 1) * (fontSize + 4);
        ctx.fillText(String(clues[i]), textX, textY);
      }
    }
  }

  private renderGrid(
    ctx: CanvasRenderingContext2D,
    startX: number, startY: number,
    cellSize: number
  ): void {
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const x = startX + c * cellSize;
        const y = startY + r * cellSize;
        const state = this.grid[r][c];

        // 背景
        if (state === CellState.FILLED) {
          ctx.fillStyle = CELL_FILLED_COLOR;
          ctx.fillRect(x, y, cellSize, cellSize);
        } else if (state === CellState.MARKED) {
          ctx.fillStyle = CELL_MARKED_COLOR;
          ctx.fillRect(x, y, cellSize, cellSize);

          // 绘制 X 标记
          ctx.strokeStyle = MARK_X_COLOR;
          ctx.lineWidth = 2;
          const pad = cellSize * 0.25;
          ctx.beginPath();
          ctx.moveTo(x + pad, y + pad);
          ctx.lineTo(x + cellSize - pad, y + cellSize - pad);
          ctx.moveTo(x + cellSize - pad, y + pad);
          ctx.lineTo(x + pad, y + cellSize - pad);
          ctx.stroke();
        } else {
          ctx.fillStyle = CELL_EMPTY_COLOR;
          ctx.fillRect(x, y, cellSize, cellSize);
        }

        // 错误高亮
        if (this.errorCells[r][c]) {
          ctx.fillStyle = CELL_ERROR_COLOR;
          ctx.fillRect(x, y, cellSize, cellSize);
        }

        // 网格线
        ctx.strokeStyle = GRID_LINE_COLOR;
        ctx.lineWidth = THIN_LINE_WIDTH;
        ctx.strokeRect(x, y, cellSize, cellSize);
      }
    }

    // 粗线（每5格）
    ctx.strokeStyle = GRID_THICK_COLOR;
    ctx.lineWidth = THICK_LINE_WIDTH;
    const totalSize = this.gridSize * cellSize;

    for (let i = 0; i <= this.gridSize; i += 5) {
      // 水平线
      ctx.beginPath();
      ctx.moveTo(startX, startY + i * cellSize);
      ctx.lineTo(startX + totalSize, startY + i * cellSize);
      ctx.stroke();

      // 垂直线
      ctx.beginPath();
      ctx.moveTo(startX + i * cellSize, startY);
      ctx.lineTo(startX + i * cellSize, startY + totalSize);
      ctx.stroke();
    }
  }

  private renderCursor(
    ctx: CanvasRenderingContext2D,
    startX: number, startY: number,
    cellSize: number
  ): void {
    const x = startX + this.cursor.col * cellSize;
    const y = startY + this.cursor.row * cellSize;

    ctx.fillStyle = CELL_CURSOR_COLOR;
    ctx.fillRect(x, y, cellSize, cellSize);

    // 光标边框
    ctx.strokeStyle = '#00b894';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
  }

  private renderWinOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = WIN_OVERLAY_COLOR;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#00b894';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎉 恭喜通关！', w / 2, h / 2 - 30);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '16px monospace';
    ctx.fillText(`得分: ${this._score}  用时: ${this.formatTime(this._elapsedTime)}`, w / 2, h / 2 + 20);

    ctx.fillStyle = '#a0aec0';
    ctx.font = '14px monospace';
    ctx.fillText('按 N 开始新谜题', w / 2, h / 2 + 55);
  }

  // ========== 工具方法 ==========

  private getClueFontSize(): number {
    if (this.gridSize <= 5) return CLUE_FONT_SIZE_EASY;
    if (this.gridSize <= 10) return CLUE_FONT_SIZE_MEDIUM;
    return CLUE_FONT_SIZE_HARD;
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // ========== 静态工具方法（供测试使用） ==========

  /** 验证谜题解是否合法 */
  static validateSolution(solution: number[][]): boolean {
    const size = solution.length;
    if (size === 0) return false;
    for (const row of solution) {
      if (row.length !== size) return false;
      for (const cell of row) {
        if (cell !== 0 && cell !== 1) return false;
      }
    }
    return true;
  }

  /** 从解决方案生成提示 */
  static generateClues(solution: number[][]): { rowClues: number[][]; colClues: number[][] } {
    const engine = new NonogramEngine();
    return {
      rowClues: engine.calculateRowClues(solution),
      colClues: engine.calculateColClues(solution),
    };
  }

  /** 获取预设谜题数量 */
  static getPresetCount(size?: number): number {
    if (size !== undefined) {
      return PRESET_PUZZLES.filter(p => p.size === size).length;
    }
    return PRESET_PUZZLES.length;
  }
}
