import { GameEngine } from '@/core/GameEngine';
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
  COLORS,
  HUD_HEIGHT,
  FONT_FAMILY,
  FONT_SIZE_HUD,
  SCORE_PER_GENERATION,
  SCORE_ALIVE_BONUS,
  PATTERNS,
  Pattern,
} from './constants';

// ========== 类型定义 ==========

/** 网格单元：0 = 死亡，1 = 存活 */
type Cell = 0 | 1;

/** 键盘光标位置 */
interface CursorPos {
  row: number;
  col: number;
}

interface GameOfLifeState {
  grid: Cell[][];
  generation: number;
  population: number;
  tickInterval: number;
  speedLevel: number;
  cursorRow: number;
  cursorCol: number;
}

// ========== Conway's Game of Life 引擎 ==========

export class GameOfLifeEngine extends GameEngine {
  // 网格（双缓冲）
  private grid: Cell[][] = [];
  private nextGrid: Cell[][] = [];

  // 模拟状态
  private generation: number = 0;
  private population: number = 0;
  private tickInterval: number = DEFAULT_TICK_INTERVAL;
  private tickAccumulator: number = 0;
  private speedLevel: number = 2; // 对应 TICK_INTERVALS[2] = 200ms

  // 键盘光标
  private cursor: CursorPos = { row: Math.floor(GRID_ROWS / 2), col: Math.floor(GRID_COLS / 2) };
  private cursorVisible: boolean = false;

  // 鼠标悬停
  private hoverCell: { row: number; col: number } | null = null;

  // 放置模式（键盘选择预设图案时）
  private selectedPatternIndex: number = -1; // -1 表示无预设

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.initGrid();
    this.generation = 0;
    this.population = 0;
    this.tickAccumulator = 0;
    this.cursor = { row: Math.floor(GRID_ROWS / 2), col: Math.floor(GRID_COLS / 2) };
    this.cursorVisible = false;
    this.selectedPatternIndex = -1;
    this.applySpeedLevel(this.speedLevel);
  }

  protected onStart(): void {
    // 如果网格为空，随机填充
    if (this.population === 0) {
      this.randomize(0.3);
    }
    this.applySpeedLevel(this.speedLevel);
    this.cursorVisible = false;
  }

  protected onReset(): void {
    this.initGrid();
    this.generation = 0;
    this.population = 0;
    this.tickAccumulator = 0;
    this.cursorVisible = false;
    this.selectedPatternIndex = -1;
  }

  protected onDestroy(): void {
    // 清理
  }

  protected onGameOver(): void {
    // Game of Life 没有 game over，但保留接口
  }

  // ========== 核心逻辑 ==========

  /** 初始化空网格 */
  private initGrid(): void {
    this.grid = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => 0 as Cell)
    );
    this.nextGrid = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => 0 as Cell)
    );
  }

  /** 随机填充网格 */
  private randomize(density: number = 0.3): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        this.grid[r][c] = Math.random() < density ? 1 : 0;
      }
    }
    this.countPopulation();
  }

  /** 清空网格 */
  private clearGrid(): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        this.grid[r][c] = 0;
      }
    }
    this.population = 0;
  }

  /** 统计存活细胞数 */
  private countPopulation(): void {
    let count = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c]) count++;
      }
    }
    this.population = count;
  }

  /** 计算邻居数（环绕边界） */
  private countNeighbors(row: number, col: number): number {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = (row + dr + GRID_ROWS) % GRID_ROWS;
        const c = (col + dc + GRID_COLS) % GRID_COLS;
        count += this.grid[r][c];
      }
    }
    return count;
  }

  /** 执行一代模拟（Conway 规则） */
  private step(): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const neighbors = this.countNeighbors(r, c);
        const alive = this.grid[r][c] === 1;

        // Conway's Game of Life 规则
        if (alive) {
          // 活细胞：2 或 3 个邻居存活 → 存活，否则死亡
          this.nextGrid[r][c] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
        } else {
          // 死细胞：恰好 3 个邻居 → 复活
          this.nextGrid[r][c] = (neighbors === 3) ? 1 : 0;
        }
      }
    }

    // 交换缓冲区
    [this.grid, this.nextGrid] = [this.nextGrid, this.grid];

    this.generation++;
    this.countPopulation();

    // 更新分数 = 世代数
    this._score = this.generation;
    this.emit('scoreChange', this._score);
  }

  /** 切换指定位置的细胞 */
  private toggleCell(row: number, col: number): void {
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;
    this.grid[row][col] = this.grid[row][col] === 0 ? 1 : 0;
    this.countPopulation();
  }

  /** 设置指定位置的细胞为存活 */
  private setCell(row: number, col: number, value: Cell): void {
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;
    this.grid[row][col] = value;
  }

  /** 在指定位置放置预设图案 */
  private placePattern(pattern: Pattern, centerRow: number, centerCol: number): void {
    for (const [dr, dc] of pattern.cells) {
      const r = (centerRow + dr + GRID_ROWS) % GRID_ROWS;
      const c = (centerCol + dc + GRID_COLS) % GRID_COLS;
      this.grid[r][c] = 1;
    }
    this.countPopulation();
  }

  /** 应用速度等级 */
  private applySpeedLevel(level: number): void {
    this.speedLevel = Math.max(1, Math.min(5, level));
    this.tickInterval = TICK_INTERVALS[this.speedLevel] ?? DEFAULT_TICK_INTERVAL;
    // 同步到引擎 level
    this._level = this.speedLevel;
    this.emit('levelChange', this._level);
  }

  /** 加速（减小 tick 间隔） */
  private speedUp(): void {
    if (this.speedLevel < 5) {
      this.applySpeedLevel(this.speedLevel + 1);
    }
  }

  /** 减速（增大 tick 间隔） */
  private speedDown(): void {
    if (this.speedLevel > 1) {
      this.applySpeedLevel(this.speedLevel - 1);
    }
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
    // 累积时间，按 tick 间隔步进
    this.tickAccumulator += deltaTime;
    while (this.tickAccumulator >= this.tickInterval) {
      this.tickAccumulator -= this.tickInterval;
      this.step();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    this.drawBackground(ctx, w, h);

    // 网格
    this.drawGrid(ctx);

    // 鼠标悬停高亮
    if (this.hoverCell) {
      this.drawHoverCell(ctx);
    }

    // 键盘光标
    if (this.cursorVisible) {
      this.drawCursor(ctx);
    }

    // HUD
    this.drawHUD(ctx, w);

    // 暂停提示
    if (this._status === 'paused') {
      this.drawPauseOverlay(ctx, w, h);
    }
  }

  /** 绘制背景 */
  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);
  }

  /** 绘制网格和细胞 */
  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const cellStep = CELL_SIZE + CELL_GAP;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = GRID_OFFSET_X + c * cellStep;
        const y = GRID_OFFSET_Y + r * cellStep;

        if (this.grid[r][c] === 1) {
          // 存活细胞 — 带发光效果
          ctx.shadowColor = COLORS.cellAliveGlow;
          ctx.shadowBlur = 6;
          ctx.fillStyle = COLORS.cellAlive;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          ctx.shadowBlur = 0;
        } else {
          // 死亡细胞（淡色背景）
          ctx.fillStyle = COLORS.cellDead;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // 网格线（整体覆盖一层）
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = GRID_OFFSET_Y + r * cellStep - CELL_GAP / 2;
      ctx.beginPath();
      ctx.moveTo(GRID_OFFSET_X, y);
      ctx.lineTo(GRID_OFFSET_X + GRID_COLS * cellStep, y);
      ctx.stroke();
    }
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = GRID_OFFSET_X + c * cellStep - CELL_GAP / 2;
      ctx.beginPath();
      ctx.moveTo(x, GRID_OFFSET_Y);
      ctx.lineTo(x, GRID_OFFSET_Y + GRID_ROWS * cellStep);
      ctx.stroke();
    }
  }

  /** 绘制鼠标悬停高亮 */
  private drawHoverCell(ctx: CanvasRenderingContext2D): void {
    if (!this.hoverCell) return;
    const cellStep = CELL_SIZE + CELL_GAP;
    const x = GRID_OFFSET_X + this.hoverCell.col * cellStep;
    const y = GRID_OFFSET_Y + this.hoverCell.row * cellStep;

    ctx.fillStyle = COLORS.cellHover;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
  }

  /** 绘制键盘光标 */
  private drawCursor(ctx: CanvasRenderingContext2D): void {
    const cellStep = CELL_SIZE + CELL_GAP;
    const x = GRID_OFFSET_X + this.cursor.col * cellStep;
    const y = GRID_OFFSET_Y + this.cursor.row * cellStep;

    // 脉冲动画
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);

    // 填充
    ctx.fillStyle = COLORS.cursor;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

    // 边框
    ctx.strokeStyle = COLORS.cursorBorder;
    ctx.lineWidth = 1.5 + pulse;
    ctx.strokeRect(x - 0.5, y - 0.5, CELL_SIZE + 1, CELL_SIZE + 1);
  }

  /** 绘制 HUD */
  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 分隔线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(w, HUD_HEIGHT);
    ctx.stroke();

    ctx.textBaseline = 'middle';
    const cy = HUD_HEIGHT / 2;

    // 世代数
    ctx.font = `bold ${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.generationText;
    ctx.fillText(`GEN ${this.generation}`, 10, cy);

    // 存活细胞数
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.populationText;
    ctx.fillText(`POP ${this.population}`, w / 2, cy);

    // 速度等级
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`SPD ${this.speedLevel}`, w - 10, cy);
  }

  /** 绘制暂停覆盖层 */
  private drawPauseOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(13, 13, 32, 0.4)';
    ctx.fillRect(0, HUD_HEIGHT, w, h - HUD_HEIGHT);

    // 暂停文字
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 20px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textPrimary;
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 15;
    ctx.fillText('⏸ 已暂停', w / 2, h / 2);
    ctx.shadowBlur = 0;

    ctx.font = `${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('空格 继续 · 点击编辑细胞', w / 2, h / 2 + 28);
  }

  // ========== 公开方法（供 GameContainer 调用） ==========

  /** 处理鼠标/触摸点击 */
  handleClick(canvasX: number, canvasY: number): void {
    const cellStep = CELL_SIZE + CELL_GAP;
    const col = Math.floor((canvasX - GRID_OFFSET_X) / cellStep);
    const row = Math.floor((canvasY - GRID_OFFSET_Y) / cellStep);

    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;

    // 暂停或 idle 状态下可编辑
    if (this._status === 'paused' || this._status === 'idle') {
      this.toggleCell(row, col);
    }
  }

  /** 处理鼠标移动（悬停效果） */
  handleMouseMove(canvasX: number, canvasY: number): void {
    const cellStep = CELL_SIZE + CELL_GAP;
    const col = Math.floor((canvasX - GRID_OFFSET_X) / cellStep);
    const row = Math.floor((canvasY - GRID_OFFSET_Y) / cellStep);

    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
      this.hoverCell = { row, col };
    } else {
      this.hoverCell = null;
    }
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    // 空格：暂停/继续
    if (key === ' ') {
      if (this._status === 'playing') {
        this.pause();
      } else if (this._status === 'paused') {
        this.resume();
      } else if (this._status === 'idle') {
        this.start();
      }
      return;
    }

    // Enter：开始/重新开始
    if (key === 'Enter') {
      if (this._status === 'idle' || this._status === 'gameover') {
        this.start();
      }
      return;
    }

    // R 键：随机填充
    if (key === 'r' || key === 'R') {
      this.randomize(0.3);
      this.generation = 0;
      this._score = 0;
      this.emit('scoreChange', 0);
      return;
    }

    // C 键：清空网格
    if (key === 'c' || key === 'C') {
      this.clearGrid();
      this.generation = 0;
      this._score = 0;
      this.emit('scoreChange', 0);
      return;
    }

    // N 键：单步推进（暂停时）
    if (key === 'n' || key === 'N') {
      if (this._status === 'paused' || this._status === 'idle') {
        this.step();
      }
      return;
    }

    // +/= 键：加速
    if (key === '+' || key === '=') {
      this.speedUp();
      return;
    }

    // -/_ 键：减速
    if (key === '-' || key === '_') {
      this.speedDown();
      return;
    }

    // ↑↓ 键：调整速度 / 移动光标
    if (key === 'ArrowUp') {
      if (this.cursorVisible) {
        this.cursor.row = Math.max(0, this.cursor.row - 1);
      } else {
        this.speedUp();
      }
      return;
    }
    if (key === 'ArrowDown') {
      if (this.cursorVisible) {
        this.cursor.row = Math.min(GRID_ROWS - 1, this.cursor.row + 1);
      } else {
        this.speedDown();
      }
      return;
    }

    // ← → 键：移动光标
    if (key === 'ArrowLeft') {
      this.cursorVisible = true;
      this.cursor.col = Math.max(0, this.cursor.col - 1);
      return;
    }
    if (key === 'ArrowRight') {
      this.cursorVisible = true;
      this.cursor.col = Math.min(GRID_COLS - 1, this.cursor.col + 1);
      return;
    }

    // 数字键 1-9：放置预设图案
    const numKey = parseInt(key);
    if (numKey >= 1 && numKey <= 9 && numKey <= PATTERNS.length) {
      const pattern = PATTERNS[numKey - 1];
      const centerRow = this.cursorVisible ? this.cursor.row : Math.floor(GRID_ROWS / 2);
      const centerCol = this.cursorVisible ? this.cursor.col : Math.floor(GRID_COLS / 2);
      this.placePattern(pattern, centerRow, centerCol);
      return;
    }

    // Tab 键：切换光标显示
    if (key === 'Tab') {
      this.cursorVisible = !this.cursorVisible;
      return;
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }

  getState(): Record<string, unknown> {
    const state: GameOfLifeState = {
      grid: this.grid.map((row) => [...row]),
      generation: this.generation,
      population: this.population,
      tickInterval: this.tickInterval,
      speedLevel: this.speedLevel,
      cursorRow: this.cursor.row,
      cursorCol: this.cursor.col,
    };
    return state as unknown as Record<string, unknown>;
  }
}
