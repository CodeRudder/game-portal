import { GameEngine } from "@/core/GameEngine";
import {
  GRID_SIZE,
  GRID_CELLS,
  LEVEL_CONFIGS,
  MAX_LEVEL,
  BASE_SCORE,
  OPTIMAL_BONUS,
  LEVEL_MULTIPLIER,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  GRID_PADDING,
  CELL_GAP,
  COLORS,
  type LevelConfig,
} from "./constants";

export interface CursorPosition {
  row: number;
  col: number;
}

export class LightsOutEngine extends GameEngine {
  private grid: boolean[][] = [];
  private cursor: CursorPosition = { row: 2, col: 2 };
  private steps = 0;
  private optimalSteps = 0;

  // ========== 公开 API ==========

  getGrid(): boolean[][] {
    return this.grid.map((row) => [...row]);
  }

  getCursor(): CursorPosition {
    return { ...this.cursor };
  }

  getSteps(): number {
    return this.steps;
  }

  getOptimalSteps(): number {
    return this.optimalSteps;
  }

  isSolved(): boolean {
    return this.grid.every((row) => row.every((cell) => !cell));
  }

  setGrid(grid: boolean[][]): void {
    this.grid = grid.map((row) => [...row]);
  }

  // ========== 核心逻辑 ==========

  toggle(row: number, col: number): void {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
    const targets = this.getNeighbors(row, col);
    for (const [r, c] of targets) {
      this.grid[r][c] = !this.grid[r][c];
    }
    this.steps++;
    this.emit("toggle", { row, col, steps: this.steps });

    if (this.isSolved()) {
      this.handleWin();
    }
  }

  moveCursor(dr: number, dc: number): void {
    const newRow = Math.max(0, Math.min(GRID_SIZE - 1, this.cursor.row + dr));
    const newCol = Math.max(0, Math.min(GRID_SIZE - 1, this.cursor.col + dc));
    this.cursor.row = newRow;
    this.cursor.col = newCol;
  }

  generatePuzzle(): void {
    const config = this.getLevelConfig();
    const numClicks =
      config.minClicks +
      Math.floor(Math.random() * (config.maxClicks - config.minClicks + 1));

    // Reset to all-off
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));

    // Randomly toggle N distinct cells
    const clicked = new Set<number>();
    const attempts = numClicks * 3;
    for (let i = 0; i < attempts && clicked.size < numClicks; i++) {
      const idx = Math.floor(Math.random() * GRID_CELLS);
      clicked.add(idx);
    }

    for (const idx of clicked) {
      const r = Math.floor(idx / GRID_SIZE);
      const c = idx % GRID_SIZE;
      const targets = this.getNeighbors(r, c);
      for (const [tr, tc] of targets) {
        this.grid[tr][tc] = !this.grid[tr][tc];
      }
    }

    // Recalculate optimal steps using GF(2) solver
    const solution = LightsOutEngine.solveOptimal(this.grid);
    this.optimalSteps = solution.size;
    this.steps = 0;

    // Ensure puzzle is not trivially solved (all off)
    if (this.isSolved()) {
      // Retry with one more click
      const r = Math.floor(Math.random() * GRID_SIZE);
      const c = Math.floor(Math.random() * GRID_SIZE);
      const targets = this.getNeighbors(r, c);
      for (const [tr, tc] of targets) {
        this.grid[tr][tc] = !this.grid[tr][tc];
      }
      const newSolution = LightsOutEngine.solveOptimal(this.grid);
      this.optimalSteps = newSolution.size;
    }
  }

  // ========== GF(2) 高斯消元求解最优步数 ==========

  static solveOptimal(grid: boolean[][]): Set<number> {
    const size = GRID_CELLS;

    // 增广矩阵 [A | b]，每行 size+1 列
    const matrix: number[][] = Array.from({ length: size }, () => Array(size + 1).fill(0));

    // 构建矩阵：A[i][j] = 1 当且仅当点击 j 会影响 i
    for (let i = 0; i < size; i++) {
      const ri = Math.floor(i / GRID_SIZE);
      const ci = i % GRID_SIZE;
      for (let j = 0; j < size; j++) {
        const rj = Math.floor(j / GRID_SIZE);
        const cj = j % GRID_SIZE;
        if (Math.abs(ri - rj) + Math.abs(ci - cj) <= 1) {
          matrix[i][j] = 1;
        }
      }
      matrix[i][size] = grid[ri][ci] ? 1 : 0;
    }

    // 高斯消元（RREF），记录主元列
    const pivotCols: number[] = [];
    let pivotRow = 0;
    for (let col = 0; col < size; col++) {
      let found = -1;
      for (let row = pivotRow; row < size; row++) {
        if (matrix[row][col] === 1) {
          found = row;
          break;
        }
      }
      if (found === -1) continue;

      if (found !== pivotRow) {
        [matrix[pivotRow], matrix[found]] = [matrix[found], matrix[pivotRow]];
      }

      for (let row = 0; row < size; row++) {
        if (row !== pivotRow && matrix[row][col] === 1) {
          for (let k = 0; k <= size; k++) {
            matrix[row][k] ^= matrix[pivotRow][k];
          }
        }
      }
      pivotCols.push(col);
      pivotRow++;
    }

    const rank = pivotRow;
    const nullDim = size - rank;

    // 特解
    const particular: number[] = Array(size).fill(0);
    for (let i = 0; i < rank; i++) {
      particular[pivotCols[i]] = matrix[i][size];
    }

    if (nullDim === 0) {
      // 唯一解
      const solution = new Set<number>();
      for (let i = 0; i < size; i++) {
        if (particular[i] === 1) solution.add(i);
      }
      return solution;
    }

    // 构造零空间基
    const pivotColSet = new Set(pivotCols);
    const freeCols: number[] = [];
    for (let c = 0; c < size; c++) {
      if (!pivotColSet.has(c)) freeCols.push(c);
    }

    const nullBasis: number[][] = [];
    for (const fc of freeCols) {
      const vec = Array(size).fill(0);
      vec[fc] = 1;
      for (let i = 0; i < rank; i++) {
        vec[pivotCols[i]] = matrix[i][fc];
      }
      nullBasis.push(vec);
    }

    // 枚举所有 2^nullDim 个解，找最小权重
    let bestWeight = size + 1;
    let bestSolution = particular;
    const limit = 1 << nullDim;

    for (let mask = 0; mask < limit; mask++) {
      const sol = [...particular];
      for (let b = 0; b < nullDim; b++) {
        if (mask & (1 << b)) {
          for (let i = 0; i < size; i++) {
            sol[i] ^= nullBasis[b][i];
          }
        }
      }
      const weight = sol.reduce((s, v) => s + v, 0);
      if (weight < bestWeight) {
        bestWeight = weight;
        bestSolution = sol;
      }
    }

    const solution = new Set<number>();
    for (let i = 0; i < size; i++) {
      if (bestSolution[i] === 1) solution.add(i);
    }
    return solution;
  }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    this.cursor = { row: 2, col: 2 };
    this.steps = 0;
    this.optimalSteps = 0;
  }

  protected onStart(): void {
    this.generatePuzzle();
  }

  protected onReset(): void {
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    this.cursor = { row: 2, col: 2 };
    this.steps = 0;
    this.optimalSteps = 0;
  }

  protected update(_deltaTime: number): void {
    // 点灯游戏不需要持续更新，由输入驱动
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const cellSize = Math.floor(
      (Math.min(w, CANVAS_WIDTH) - GRID_PADDING * 2 - CELL_GAP * (GRID_SIZE - 1)) / GRID_SIZE,
    );
    const gridWidth = cellSize * GRID_SIZE + CELL_GAP * (GRID_SIZE - 1);
    const gridHeight = cellSize * GRID_SIZE + CELL_GAP * (GRID_SIZE - 1);
    const offsetX = (w - gridWidth) / 2;
    const offsetY = HUD_HEIGHT + (h - HUD_HEIGHT - gridHeight) / 2;

    // HUD
    this.renderHUD(ctx, w);

    // 网格
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = offsetX + c * (cellSize + CELL_GAP);
        const y = offsetY + r * (cellSize + CELL_GAP);

        // 灯泡
        if (this.grid[r][c]) {
          ctx.shadowColor = COLORS.LIGHT_ON_GLOW;
          ctx.shadowBlur = 12;
          ctx.fillStyle = COLORS.LIGHT_ON;
        } else {
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.fillStyle = COLORS.LIGHT_OFF;
        }
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 6);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = COLORS.LIGHT_BORDER;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 光标
        if (r === this.cursor.row && c === this.cursor.col) {
          ctx.strokeStyle = COLORS.CURSOR_COLOR;
          ctx.lineWidth = COLORS.CURSOR_WIDTH;
          ctx.beginPath();
          ctx.roundRect(x - 2, y - 2, cellSize + 4, cellSize + 4, 8);
          ctx.stroke();
        }
      }
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = COLORS.HUD_BG;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.font = "bold 16px monospace";
    ctx.textBaseline = "middle";

    const y = HUD_HEIGHT / 2;
    ctx.fillText(`等级: ${this._level}`, 15, y);
    ctx.fillText(`步数: ${this.steps}`, 130, y);

    const optimalText = `最优: ${this.optimalSteps}`;
    ctx.fillStyle = COLORS.HUD_ACCENT;
    ctx.fillText(optimalText, 250, y);

    const config = this.getLevelConfig();
    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.font = "12px monospace";
    ctx.fillText(config.label, 380, y);
  }

  handleKeyDown(key: string): void {
    if (this._status !== "playing") return;

    switch (key) {
      case "ArrowUp":
        this.moveCursor(-1, 0);
        break;
      case "ArrowDown":
        this.moveCursor(1, 0);
        break;
      case "ArrowLeft":
        this.moveCursor(0, -1);
        break;
      case "ArrowRight":
        this.moveCursor(0, 1);
        break;
      case " ":
        this.toggle(this.cursor.row, this.cursor.col);
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 点灯游戏不需要 keyUp 处理
  }

  getState(): Record<string, unknown> {
    return {
      grid: this.getGrid(),
      cursor: this.getCursor(),
      steps: this.steps,
      optimalSteps: this.optimalSteps,
      isSolved: this.isSolved(),
      level: this._level,
      score: this._score,
    };
  }

  // ========== 内部方法 ==========

  private getNeighbors(row: number, col: number): [number, number][] {
    const neighbors: [number, number][] = [[row, col]];
    if (row > 0) neighbors.push([row - 1, col]);
    if (row < GRID_SIZE - 1) neighbors.push([row + 1, col]);
    if (col > 0) neighbors.push([row, col - 1]);
    if (col < GRID_SIZE - 1) neighbors.push([row, col + 1]);
    return neighbors;
  }

  private getLevelConfig(): LevelConfig {
    const idx = Math.min(this._level - 1, LEVEL_CONFIGS.length - 1);
    return LEVEL_CONFIGS[idx];
  }

  private handleWin(): void {
    const efficiency = this.optimalSteps > 0 ? this.optimalSteps / this.steps : 1;
    const levelBonus = this._level * LEVEL_MULTIPLIER;
    const optimalBonus = efficiency >= 1 ? OPTIMAL_BONUS : 0;
    this.addScore(BASE_SCORE + levelBonus + optimalBonus);

    const wonLevel = this._level;
    this.emit("win", {
      level: wonLevel,
      steps: this.steps,
      optimalSteps: this.optimalSteps,
      score: this._score,
    });

    // 下一关（不立即生成新谜题，保持全灭状态供检测）
    if (this._level < MAX_LEVEL) {
      this.setLevel(this._level + 1);
    } else {
      this.gameOver();
    }
  }
}
