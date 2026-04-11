import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  SPEED_LEVELS,
  SimulationState,
  COLOR_BG,
  COLOR_GRID_LINE,
  COLOR_CELL_ALIVE,
  COLOR_CELL_ALIVE_END,
  COLOR_CELL_GLOW,
  COLOR_CURSOR,
  COLOR_HUD_TEXT,
  COLOR_HUD_VALUE,
  COLOR_HUD_LABEL,
  COLOR_HINT_TEXT,
  COLOR_EXTINCT,
  FONT_HUD,
  PRESET_PATTERNS,
  HUD_HEIGHT,
  HINT_HEIGHT,
} from './constants';
import type { Pattern } from './constants';

// ========== Conway's Game of Life 引擎 ==========

/**
 * Conway's Game of Life 游戏引擎
 *
 * 规则：
 * 1. 活细胞周围少于 2 个活邻居 → 死亡（孤独）
 * 2. 活细胞周围 2~3 个活邻居 → 存活
 * 3. 活细胞周围超过 3 个活邻居 → 死亡（拥挤）
 * 4. 死细胞周围恰好 3 个活邻居 → 复活（繁殖）
 */
export class ConwaysGameOfLifeEngine extends GameEngine {
  // ========== 核心数据 ==========

  /** 网格数据：true = 活，false = 死 */
  private grid: boolean[][] = [];

  /** 当前代数 */
  private generation: number = 0;

  /** 当前活细胞数（缓存） */
  private aliveCells: number = 0;

  /** 模拟状态 */
  private simState: SimulationState = SimulationState.PAUSED;

  /** 速度等级索引（0-based，对应 SPEED_LEVELS） */
  private speedIndex: number = 2; // 默认 5 代/秒

  /** 累积时间（用于控制模拟频率） */
  private accumulatedTime: number = 0;

  /** 是否所有细胞已消亡 */
  private isExtinct: boolean = false;

  // ========== 编辑模式 ==========

  /** 光标行位置 */
  private cursorRow: number = Math.floor(GRID_ROWS / 2);

  /** 光标列位置 */
  private cursorCol: number = Math.floor(GRID_COLS / 2);

  /** 是否处于编辑模式（光标可见） */
  private editMode: boolean = false;

  // ========== 预设图案 ==========

  /** 当前选中的预设图案索引 */
  private patternIndex: number = 0;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.grid = this.createEmptyGrid();
    this.generation = 0;
    this.aliveCells = 0;
    this.simState = SimulationState.PAUSED;
    this.isExtinct = false;
    this.accumulatedTime = 0;
    this.editMode = false;
    this.speedIndex = 2;
    this.patternIndex = 0;
  }

  protected onStart(): void {
    // 放置默认图案（滑翔机），居中偏左上
    this.placePattern(PRESET_PATTERNS[0], Math.floor(GRID_ROWS / 4), Math.floor(GRID_COLS / 4));
    this.countAliveCells();
    this.simState = SimulationState.RUNNING;
  }

  protected onReset(): void {
    this.grid = this.createEmptyGrid();
    this.generation = 0;
    this.aliveCells = 0;
    this.simState = SimulationState.PAUSED;
    this.isExtinct = false;
    this.accumulatedTime = 0;
    this.editMode = false;
  }

  protected onDestroy(): void {
    this.grid = [];
  }

  protected onPause(): void {
    if (this.simState === SimulationState.RUNNING) {
      this.simState = SimulationState.PAUSED;
    }
  }

  protected onResume(): void {
    if (this.simState === SimulationState.PAUSED && !this.isExtinct) {
      this.simState = SimulationState.RUNNING;
      this.accumulatedTime = 0;
    }
  }

  // ========== 游戏循环 ==========

  protected update(deltaTime: number): void {
    // 非运行状态不更新
    if (this.simState !== SimulationState.RUNNING) return;

    // 根据速度等级累积时间
    const tickInterval = 1000 / SPEED_LEVELS[Math.min(this.speedIndex, SPEED_LEVELS.length - 1)];
    this.accumulatedTime += deltaTime;

    // 到达间隔则推进一代
    if (this.accumulatedTime >= tickInterval) {
      this.accumulatedTime -= tickInterval;
      this.advanceGeneration();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 1. 深色背景
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, w, h);

    // 2. 绘制网格线
    this.drawGridLines(ctx);

    // 3. 绘制活细胞
    this.drawAliveCells(ctx);

    // 4. 绘制光标（编辑模式）
    if (this.editMode) {
      this.drawCursor(ctx);
    }

    // 5. HUD 顶部信息
    this.drawHUD(ctx, w);

    // 6. 底部快捷键提示
    this.drawHints(ctx, w, h);

    // 7. 消亡提示
    if (this.isExtinct) {
      this.drawExtinctOverlay(ctx, w, h);
    }
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    switch (key) {
      // 空格：暂停/继续
      case ' ':
        this.togglePause();
        break;

      // R：重置（清空网格）
      case 'r':
      case 'R':
        this.resetGrid();
        break;

      // N：推进一代（暂停时）
      case 'n':
      case 'N':
        this.stepOneGeneration();
        break;

      // 1~6：切换速度等级
      case '1': case '2': case '3':
      case '4': case '5': case '6':
        this.setSpeed(parseInt(key) - 1);
        break;

      // P：切换预设图案
      case 'p':
      case 'P':
        this.cyclePattern();
        break;

      // E：切换编辑模式
      case 'e':
      case 'E':
        this.toggleEditMode();
        break;

      // 方向键：移动光标（编辑模式）
      case 'ArrowUp':
        if (this.editMode) this.cursorRow = Math.max(0, this.cursorRow - 1);
        break;
      case 'ArrowDown':
        if (this.editMode) this.cursorRow = Math.min(GRID_ROWS - 1, this.cursorRow + 1);
        break;
      case 'ArrowLeft':
        if (this.editMode) this.cursorCol = Math.max(0, this.cursorCol - 1);
        break;
      case 'ArrowRight':
        if (this.editMode) this.cursorCol = Math.min(GRID_COLS - 1, this.cursorCol + 1);
        break;

      // Enter：切换光标位置细胞状态
      case 'Enter':
        if (this.editMode) {
          this.toggleCell(this.cursorRow, this.cursorCol);
        }
        break;

      default:
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // Game of Life 不需要处理按键释放
  }

  /**
   * 处理鼠标/触摸点击
   * 将 canvas 坐标转为网格坐标，切换细胞状态
   */
  handleClick(canvasX: number, canvasY: number): void {
    const col = Math.floor((canvasX - GRID_OFFSET_X) / CELL_SIZE);
    const row = Math.floor((canvasY - GRID_OFFSET_Y) / CELL_SIZE);

    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
      this.toggleCell(row, col);

      // 同步光标位置
      this.cursorRow = row;
      this.cursorCol = col;
    }
  }

  getState(): Record<string, unknown> {
    return {
      generation: this.generation,
      aliveCells: this.aliveCells,
      speed: SPEED_LEVELS[Math.min(this.speedIndex, SPEED_LEVELS.length - 1)],
      speedIndex: this.speedIndex,
      simState: this.simState,
      isExtinct: this.isExtinct,
      editMode: this.editMode,
      currentPattern: PRESET_PATTERNS[this.patternIndex].name,
      grid: this.grid.map((row) => [...row]),
    };
  }

  // ========== 核心逻辑 ==========

  /**
   * 推进一代：应用 Conway 规则
   */
  private advanceGeneration(): void {
    const nextGrid = this.createEmptyGrid();

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const neighbors = this.countNeighbors(r, c);
        const isAlive = this.grid[r][c];

        if (isAlive) {
          // 规则 1 & 2 & 3：活细胞
          nextGrid[r][c] = neighbors === 2 || neighbors === 3;
        } else {
          // 规则 4：死细胞复活
          nextGrid[r][c] = neighbors === 3;
        }
      }
    }

    this.grid = nextGrid;
    this.generation++;
    this.countAliveCells();

    // 更新分数（代数作为分数）
    this._score = this.generation;
    this.emit('scoreChange', this._score);

    // 更新等级（活细胞数）
    this._level = this.aliveCells;
    this.emit('levelChange', this._level);

    // 检测是否所有细胞消亡
    if (this.aliveCells === 0 && this.generation > 0) {
      this.isExtinct = true;
      this.simState = SimulationState.PAUSED;
    }
  }

  /**
   * 计算指定位置的活邻居数量（8 方向）
   */
  private countNeighbors(row: number, col: number): number {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue; // 跳过自身
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
          if (this.grid[nr][nc]) count++;
        }
      }
    }
    return count;
  }

  /**
   * 统计活细胞数
   */
  private countAliveCells(): void {
    let count = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c]) count++;
      }
    }
    this.aliveCells = count;
  }

  // ========== 操作方法 ==========

  /**
   * 切换暂停/继续
   */
  private togglePause(): void {
    if (this.simState === SimulationState.RUNNING) {
      this.simState = SimulationState.PAUSED;
    } else if (this.simState === SimulationState.PAUSED && !this.isExtinct) {
      this.simState = SimulationState.RUNNING;
      this.accumulatedTime = 0;
    }
  }

  /**
   * 重置网格（清空）
   */
  private resetGrid(): void {
    this.grid = this.createEmptyGrid();
    this.generation = 0;
    this.aliveCells = 0;
    this.simState = SimulationState.PAUSED;
    this.isExtinct = false;
    this.accumulatedTime = 0;
    this._score = 0;
    this._level = 0;
    this.emit('scoreChange', 0);
    this.emit('levelChange', 0);
  }

  /**
   * 推进一代（手动步进，暂停状态下使用）
   */
  private stepOneGeneration(): void {
    if (this.simState === SimulationState.RUNNING) return;
    if (this.isExtinct) return;
    this.advanceGeneration();
  }

  /**
   * 设置速度等级
   */
  private setSpeed(index: number): void {
    this.speedIndex = Math.max(0, Math.min(index, SPEED_LEVELS.length - 1));
  }

  /**
   * 循环切换预设图案并放置到网格中央
   */
  private cyclePattern(): void {
    this.patternIndex = (this.patternIndex + 1) % PRESET_PATTERNS.length;
    const pattern = PRESET_PATTERNS[this.patternIndex];

    // 清空网格并放置图案到中央
    this.grid = this.createEmptyGrid();
    this.generation = 0;
    this.isExtinct = false;

    // 计算图案边界以居中放置
    const centerRow = Math.floor(GRID_ROWS / 2);
    const centerCol = Math.floor(GRID_COLS / 2);
    this.placePattern(pattern, centerRow, centerCol);

    this.countAliveCells();
    this.simState = SimulationState.PAUSED;
    this.accumulatedTime = 0;
  }

  /**
   * 切换编辑模式
   */
  private toggleEditMode(): void {
    this.editMode = !this.editMode;
    if (this.editMode) {
      // 进入编辑模式时暂停模拟
      if (this.simState === SimulationState.RUNNING) {
        this.simState = SimulationState.PAUSED;
      }
    }
  }

  /**
   * 切换指定位置的细胞状态
   */
  private toggleCell(row: number, col: number): void {
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;
    this.grid[row][col] = !this.grid[row][col];
    this.countAliveCells();
    this.isExtinct = false; // 手动编辑后重置消亡状态
  }

  /**
   * 将预设图案放置到网格上
   */
  private placePattern(pattern: Pattern, centerRow: number, centerCol: number): void {
    for (const [dr, dc] of pattern.cells) {
      const r = centerRow + dr;
      const c = centerCol + dc;
      if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
        this.grid[r][c] = true;
      }
    }
  }

  // ========== 渲染辅助 ==========

  /**
   * 绘制网格线（极淡）
   */
  private drawGridLines(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = COLOR_GRID_LINE;
    ctx.lineWidth = 0.5;

    // 水平线
    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = GRID_OFFSET_Y + r * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(GRID_OFFSET_X, y);
      ctx.lineTo(GRID_OFFSET_X + GRID_COLS * CELL_SIZE, y);
      ctx.stroke();
    }

    // 垂直线
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = GRID_OFFSET_X + c * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, GRID_OFFSET_Y);
      ctx.lineTo(x, GRID_OFFSET_Y + GRID_ROWS * CELL_SIZE);
      ctx.stroke();
    }
  }

  /**
   * 绘制活细胞（带发光效果）
   */
  private drawAliveCells(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!this.grid[r][c]) continue;

        const x = GRID_OFFSET_X + c * CELL_SIZE;
        const y = GRID_OFFSET_Y + r * CELL_SIZE;
        const padding = 1; // 细胞内边距，留出网格线空间

        // 发光效果（外层光晕）
        ctx.fillStyle = COLOR_CELL_GLOW;
        ctx.fillRect(x - 1, y - 1, CELL_SIZE + 2, CELL_SIZE + 2);

        // 细胞主体渐变
        const gradient = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE);
        gradient.addColorStop(0, COLOR_CELL_ALIVE);
        gradient.addColorStop(1, COLOR_CELL_ALIVE_END);

        ctx.fillStyle = gradient;
        ctx.fillRect(
          x + padding,
          y + padding,
          CELL_SIZE - 2 * padding,
          CELL_SIZE - 2 * padding
        );
      }
    }
  }

  /**
   * 绘制编辑光标
   */
  private drawCursor(ctx: CanvasRenderingContext2D): void {
    const x = GRID_OFFSET_X + this.cursorCol * CELL_SIZE;
    const y = GRID_OFFSET_Y + this.cursorRow * CELL_SIZE;

    ctx.strokeStyle = COLOR_CURSOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }

  /**
   * 绘制 HUD 顶部信息栏
   */
  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = 'rgba(10, 10, 26, 0.9)';
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 分隔线
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(w, HUD_HEIGHT);
    ctx.stroke();

    const y = 16;
    const lineH = 16;

    // 第一行：代数 + 活细胞数
    ctx.font = `bold 12px ${FONT_HUD}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // 代数
    ctx.fillStyle = COLOR_HUD_LABEL;
    ctx.fillText('GEN', 10, y);
    ctx.fillStyle = COLOR_HUD_VALUE;
    ctx.fillText(`${this.generation}`, 45, y);

    // 活细胞
    ctx.fillStyle = COLOR_HUD_LABEL;
    ctx.fillText('ALIVE', 120, y);
    ctx.fillStyle = COLOR_HUD_VALUE;
    ctx.fillText(`${this.aliveCells}`, 168, y);

    // 速度
    const speed = SPEED_LEVELS[Math.min(this.speedIndex, SPEED_LEVELS.length - 1)];
    ctx.fillStyle = COLOR_HUD_LABEL;
    ctx.fillText('SPD', 250, y);
    ctx.fillStyle = COLOR_HUD_VALUE;
    ctx.fillText(`${speed}/s`, 280, y);

    // 状态
    ctx.textAlign = 'right';
    if (this.simState === SimulationState.RUNNING) {
      ctx.fillStyle = '#00ff88';
      ctx.fillText('▶ RUNNING', w - 10, y);
    } else if (this.simState === SimulationState.PAUSED) {
      ctx.fillStyle = '#ffa502';
      ctx.fillText('⏸ PAUSED', w - 10, y);
    } else {
      ctx.fillStyle = COLOR_HUD_TEXT;
      ctx.fillText('EDITING', w - 10, y);
    }

    // 第二行：当前图案名称
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOR_HINT_TEXT;
    ctx.font = `10px ${FONT_HUD}`;
    ctx.fillText(`Pattern: ${PRESET_PATTERNS[this.patternIndex].name}`, 10, y + lineH);

    // 编辑模式指示
    if (this.editMode) {
      ctx.textAlign = 'right';
      ctx.fillStyle = COLOR_CURSOR;
      ctx.fillText('✏ EDIT MODE', w - 10, y + lineH);
    }
  }

  /**
   * 绘制底部快捷键提示
   */
  private drawHints(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const hintY = h - HINT_HEIGHT;

    // 背景
    ctx.fillStyle = 'rgba(10, 10, 26, 0.9)';
    ctx.fillRect(0, hintY, w, HINT_HEIGHT);

    // 分隔线
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hintY);
    ctx.lineTo(w, hintY);
    ctx.stroke();

    ctx.font = `10px ${FONT_HUD}`;
    ctx.fillStyle = COLOR_HINT_TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const line1 = 'SPACE:Pause  N:Step  R:Reset  P:Pattern  1-6:Speed  E:Edit';
    ctx.fillText(line1, w / 2, hintY + 12);

    const line2 = this.editMode
      ? '↑↓←→:Move  ENTER:Toggle Cell  Click:Toggle'
      : 'Click:Toggle Cell  E:Enter Edit Mode';
    ctx.fillText(line2, w / 2, hintY + 25);
  }

  /**
   * 绘制"所有生命已消亡"覆盖提示
   */
  private drawExtinctOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(10, 10, 26, 0.6)';
    ctx.fillRect(0, HUD_HEIGHT, w, h - HUD_HEIGHT - HINT_HEIGHT);

    // 中央提示文字
    ctx.font = `bold 28px ${FONT_HUD}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOR_EXTINCT;

    const centerY = (HUD_HEIGHT + h - HINT_HEIGHT) / 2;
    ctx.fillText('ALL LIFE HAS PERISHED', w / 2, centerY - 15);

    ctx.font = `14px ${FONT_HUD}`;
    ctx.fillStyle = COLOR_HUD_TEXT;
    ctx.fillText(`Survived ${this.generation} generations`, w / 2, centerY + 20);

    ctx.font = `12px ${FONT_HUD}`;
    ctx.fillStyle = COLOR_HINT_TEXT;
    ctx.fillText('Press R to reset or P to load a pattern', w / 2, centerY + 45);
  }

  // ========== 工具方法 ==========

  /**
   * 创建空网格
   */
  private createEmptyGrid(): boolean[][] {
    return Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => false)
    );
  }
}
