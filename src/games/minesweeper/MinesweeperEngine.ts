import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  DIFFICULTIES,
  CellState,
  COLORS,
  SCORE_PER_CELL,
  WIN_BONUS_BEGINNER,
  WIN_BONUS_INTERMEDIATE,
  WIN_BONUS_EXPERT,
  TIME_BONUS_FACTOR,
  GRID_PADDING,
} from './constants';
import type { DifficultyKey, DifficultyConfig } from './constants';

// ========== 内部数据结构 ==========

/** 单个格子的完整数据 */
interface Cell {
  row: number;
  col: number;
  isMine: boolean;
  state: CellState;
  adjacentMines: number;
}

/** 难度对应的胜利奖励 */
const WIN_BONUS_MAP: Record<string, number> = {
  beginner: WIN_BONUS_BEGINNER,
  intermediate: WIN_BONUS_INTERMEDIATE,
  expert: WIN_BONUS_EXPERT,
};

// ========== 扫雷引擎 ==========

export class MinesweeperEngine extends GameEngine {
  // ---- 棋盘 ----
  private rows = 0;
  private cols = 0;
  private totalMines = 0;
  private board: Cell[][] = [];
  private minesGenerated = false; // 首次点击后才生成地雷
  private _isWin = false;
  private _firstClick = true;

  // ---- 难度 ----
  private difficultyKey: DifficultyKey = 'beginner';

  // ---- 光标（键盘控制） ----
  private cursorRow = 0;
  private cursorCol = 0;

  // ---- 计时 ----
  private _timer = 0; // 游戏内计时（秒）

  // ---- 标记计数 ----
  private _flagCount = 0;
  private _revealedCount = 0;

  // ---- 表情状态（用于渲染） ----
  private _faceState = 'smile'; // 'smile' | 'dead' | 'cool' | 'surprise'

  // ---- 渲染缓存 ----
  private cellSize = 0;
  private gridOffsetX = 0;
  private gridOffsetY = 0;

  // ========== 公开属性 ==========

  get isWin(): boolean {
    return this._isWin;
  }

  get flagCount(): number {
    return this._flagCount;
  }

  get revealedCount(): number {
    return this._revealedCount;
  }

  get timer(): number {
    return this._timer;
  }

  get currentDifficulty(): DifficultyKey {
    return this.difficultyKey;
  }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.applyDifficulty('beginner');
    this.buildBoard();
    this.calculateGridLayout();
  }

  protected onStart(): void {
    this._firstClick = true;
    this._timer = 0;
    this._faceState = 'smile';
  }

  protected update(deltaTime: number): void {
    if (this._status !== 'playing') return;

    // 更新计时器（deltaTime 是毫秒）
    this._timer = this._elapsedTime;

    // 如果还没生成地雷，不检查胜负
    if (!this.minesGenerated) return;

    // 检查胜利
    this.checkWin();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 清空背景
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, w, h);

    this.renderHUD(ctx, w);
    this.renderGrid(ctx);
  }

  protected onReset(): void {
    this.buildBoard();
    this.minesGenerated = false;
    this._firstClick = true;
    this._isWin = false;
    this._flagCount = 0;
    this._revealedCount = 0;
    this._timer = 0;
    this._faceState = 'smile';
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.calculateGridLayout();
  }

  protected onDestroy(): void {
    this.board = [];
  }

  protected onGameOver(): void {
    // 游戏结束时显示所有地雷
    this.revealAllMines();
  }

  // ========== 核心逻辑 ==========

  /** 根据难度配置初始化棋盘尺寸 */
  private applyDifficulty(key: DifficultyKey): void {
    const config = DIFFICULTIES[key];
    this.difficultyKey = key;
    this.rows = config.rows;
    this.cols = config.cols;
    this.totalMines = config.mines;
  }

  /** 构建空白棋盘（无地雷） */
  private buildBoard(): void {
    this.board = [];
    for (let r = 0; r < this.rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          row: r,
          col: c,
          isMine: false,
          state: CellState.HIDDEN,
          adjacentMines: 0,
        });
      }
      this.board.push(row);
    }
  }

  /** 计算网格布局参数（格子大小、偏移） */
  private calculateGridLayout(): void {
    const availableWidth = CANVAS_WIDTH - GRID_PADDING * 2;
    const availableHeight = CANVAS_HEIGHT - HUD_HEIGHT - GRID_PADDING * 2;

    this.cellSize = Math.floor(Math.min(availableWidth / this.cols, availableHeight / this.rows));
    // 确保格子大小至少为 16
    this.cellSize = Math.max(16, this.cellSize);

    const gridWidth = this.cellSize * this.cols;
    const gridHeight = this.cellSize * this.rows;

    this.gridOffsetX = Math.floor((CANVAS_WIDTH - gridWidth) / 2);
    this.gridOffsetY = HUD_HEIGHT + Math.floor((CANVAS_HEIGHT - HUD_HEIGHT - gridHeight) / 2);
  }

  /**
   * 生成地雷（首次点击后调用）
   * 保证点击位置及其 8 邻居不放雷
   */
  private generateMines(safeRow: number, safeCol: number): void {
    // 安全区域集合
    const safeSet = new Set<string>();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeRow + dr;
        const nc = safeCol + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          safeSet.add(`${nr},${nc}`);
        }
      }
    }

    // 候选位置（排除安全区）
    const candidates: { r: number; c: number }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!safeSet.has(`${r},${c}`)) {
          candidates.push({ r, c });
        }
      }
    }

    // Fisher-Yates 洗牌，取前 totalMines 个
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const mineCount = Math.min(this.totalMines, candidates.length);
    for (let i = 0; i < mineCount; i++) {
      const { r, c } = candidates[i];
      this.board[r][c].isMine = true;
    }

    // 计算每个格子的相邻地雷数
    this.calculateAdjacentMines();
    this.minesGenerated = true;
  }

  /** 计算所有格子的 adjacentMines */
  private calculateAdjacentMines(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c].isMine) {
          this.board[r][c].adjacentMines = -1;
          continue;
        }
        let count = 0;
        this.forEachNeighbor(r, c, (nr, nc) => {
          if (this.board[nr][nc].isMine) count++;
        });
        this.board[r][c].adjacentMines = count;
      }
    }
  }

  /** 遍历 8 邻居 */
  private forEachNeighbor(row: number, col: number, fn: (r: number, c: number) => void): void {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          fn(nr, nc);
        }
      }
    }
  }

  /**
   * 揭开格子
   * 如果是空白格（adjacentMines === 0），BFS 展开邻居
   */
  private revealCell(row: number, col: number): void {
    if (this._status === 'gameover') return;
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    const cell = this.board[row][col];
    if (cell.state !== CellState.HIDDEN) return;

    cell.state = CellState.REVEALED;
    this._revealedCount++;

    if (cell.isMine) {
      // 踩雷
      this._faceState = 'dead';
      this.gameOver();
      return;
    }

    // 加分
    this.addScore(SCORE_PER_CELL);

    // 如果是空白格，BFS 展开
    if (cell.adjacentMines === 0) {
      const queue: { r: number; c: number }[] = [];
      this.forEachNeighbor(row, col, (nr, nc) => {
        const neighbor = this.board[nr][nc];
        if (neighbor.state === CellState.HIDDEN && !neighbor.isMine) {
          neighbor.state = CellState.REVEALED;
          this._revealedCount++;
          this.addScore(SCORE_PER_CELL);
          if (neighbor.adjacentMines === 0) {
            queue.push({ r: nr, c: nc });
          }
        }
      });

      // BFS
      while (queue.length > 0) {
        const { r, c } = queue.shift()!;
        this.forEachNeighbor(r, c, (nr, nc) => {
          const neighbor = this.board[nr][nc];
          if (neighbor.state === CellState.HIDDEN && !neighbor.isMine) {
            neighbor.state = CellState.REVEALED;
            this._revealedCount++;
            this.addScore(SCORE_PER_CELL);
            if (neighbor.adjacentMines === 0) {
              queue.push({ r: nr, c: nc });
            }
          }
        });
      }
    }

    // 检查胜利
    this.checkWin();
  }

  /** 切换标旗 */
  private toggleFlag(row: number, col: number): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    const cell = this.board[row][col];
    if (cell.state === CellState.REVEALED) return;

    if (cell.state === CellState.HIDDEN) {
      cell.state = CellState.FLAGGED;
      this._flagCount++;
    } else if (cell.state === CellState.FLAGGED) {
      cell.state = CellState.HIDDEN;
      this._flagCount--;
    }
  }

  /** 检查胜利条件 */
  private checkWin(): void {
    const totalSafe = this.rows * this.cols - this.totalMines;
    if (this._revealedCount >= totalSafe) {
      this._isWin = true;
      this._faceState = 'cool';

      // 胜利奖励
      const bonus = WIN_BONUS_MAP[this.difficultyKey] ?? WIN_BONUS_BEGINNER;
      this.addScore(bonus);

      // 时间奖励
      const timeBonus = Math.max(0, Math.floor((bonus * TIME_BONUS_FACTOR) / (1 + this._timer)));
      this.addScore(timeBonus);

      this.gameOver();
    }
  }

  /** 游戏结束时揭开所有地雷 */
  private revealAllMines(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.board[r][c];
        if (cell.isMine && cell.state !== CellState.FLAGGED) {
          cell.state = CellState.REVEALED;
        }
      }
    }
  }

  // ========== 公开方法 ==========

  /**
   * 处理鼠标点击
   * @param x canvas 坐标 x
   * @param y canvas 坐标 y
   * @param isRightClick 是否右键
   */
  handleClick(x: number, y: number, isRightClick: boolean): void {
    if (this._status === 'gameover') return;

    // 检查表情按钮点击（重置）
    const faceBtnX = CANVAS_WIDTH / 2;
    const faceBtnY = HUD_HEIGHT / 2;
    const faceBtnR = 18;
    const distToFace = Math.sqrt((x - faceBtnX) ** 2 + (y - faceBtnY) ** 2);
    if (distToFace <= faceBtnR) {
      this.reset();
      return;
    }

    // 如果是 idle 状态，先启动游戏
    if (this._status === 'idle') {
      this.start();
    }

    // 计算格子坐标
    const col = Math.floor((x - this.gridOffsetX) / this.cellSize);
    const row = Math.floor((y - this.gridOffsetY) / this.cellSize);

    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;

    // 首次点击生成地雷（保证安全，仅左键）
    if (this._firstClick && !isRightClick) {
      this._firstClick = false;
      this.generateMines(row, col);
    }

    if (isRightClick) {
      // 右键标旗（不需要先生成地雷）
      this.toggleFlag(row, col);
    } else {
      if (!this.minesGenerated) return;
      this._faceState = 'surprise';
      this.revealCell(row, col);
      if (this._status === 'playing') {
        this._faceState = 'smile';
      }
    }
  }

  /** 切换难度并重置 */
  setDifficulty(key: string): void {
    if (!DIFFICULTIES[key]) return;
    this.applyDifficulty(key as DifficultyKey);
    this.reset();
  }

  /** 键盘事件处理 */
  handleKeyDown(key: string): void {
    if (this._status === 'gameover') return;

    // 难度切换（任何时候都可以）
    if (key === '1') {
      this.setDifficulty('beginner');
      return;
    }
    if (key === '2') {
      this.setDifficulty('intermediate');
      return;
    }
    if (key === '3') {
      this.setDifficulty('expert');
      return;
    }

    // 方向键移动光标
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.cursorRow = Math.max(0, this.cursorRow - 1);
      return;
    }
    if (key === 'ArrowDown' || key === 's' || key === 'S') {
      this.cursorRow = Math.min(this.rows - 1, this.cursorRow + 1);
      return;
    }
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      this.cursorCol = Math.max(0, this.cursorCol - 1);
      return;
    }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      this.cursorCol = Math.min(this.cols - 1, this.cursorCol + 1);
      return;
    }

    // 空格揭开格子
    if (key === ' ') {
      if (this._status === 'idle') {
        this.start();
      }
      if (this._firstClick) {
        this._firstClick = false;
        this.generateMines(this.cursorRow, this.cursorCol);
      }
      if (this._status === 'playing' && this.minesGenerated) {
        this.revealCell(this.cursorRow, this.cursorCol);
      }
      return;
    }

    // F 键标旗
    if (key === 'f' || key === 'F') {
      if (this._status === 'idle') {
        this.start();
      }
      if (this._status === 'playing') {
        this.toggleFlag(this.cursorRow, this.cursorCol);
      }
      return;
    }
  }

  handleKeyUp(_key: string): void {
    // 扫雷不需要 keyUp 处理
  }

  getState(): Record<string, unknown> {
    return {
      rows: this.rows,
      cols: this.cols,
      totalMines: this.totalMines,
      flagCount: this._flagCount,
      revealedCount: this._revealedCount,
      timer: this._timer,
      isWin: this._isWin,
      difficulty: this.difficultyKey,
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
      minesGenerated: this.minesGenerated,
    };
  }

  // ========== 渲染方法 ==========

  /** 渲染 HUD 区域 */
  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = COLORS.HUD_BG;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 底部分割线
    ctx.strokeStyle = COLORS.HUD_ACCENT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(w, HUD_HEIGHT);
    ctx.stroke();

    // 剩余雷数（左侧）
    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const minesLeft = this.totalMines - this._flagCount;
    ctx.fillText(`💣 ${minesLeft}`, 12, HUD_HEIGHT / 2);

    // 计时器（右侧）
    ctx.textAlign = 'right';
    const timeStr = Math.floor(this._timer).toString().padStart(3, '0');
    ctx.fillText(`⏱ ${timeStr}`, w - 12, HUD_HEIGHT / 2);

    // 表情按钮（中间）
    const faceX = w / 2;
    const faceY = HUD_HEIGHT / 2;
    const faceR = 18;

    // 按钮背景
    ctx.fillStyle = COLORS.HIDDEN_FILL;
    ctx.beginPath();
    ctx.arc(faceX, faceY, faceR, 0, Math.PI * 2);
    ctx.fill();

    // 按钮边框
    ctx.strokeStyle = COLORS.HIDDEN_LIGHT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(faceX, faceY, faceR, 0, Math.PI * 2);
    ctx.stroke();

    // 表情文字
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const faceMap: Record<string, string> = {
      smile: COLORS.FACE_SMILE,
      dead: COLORS.FACE_DEAD,
      cool: COLORS.FACE_COOL,
      surprise: COLORS.FACE_SURPRISE,
    };
    ctx.fillText(faceMap[this._faceState] ?? COLORS.FACE_SMILE, faceX, faceY);
  }

  /** 渲染游戏网格 */
  private renderGrid(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.gridOffsetX + c * this.cellSize;
        const y = this.gridOffsetY + r * this.cellSize;
        const cell = this.board[r][c];

        this.renderCell(ctx, x, y, cell);

        // 光标高亮
        if (r === this.cursorRow && c === this.cursorCol) {
          ctx.strokeStyle = COLORS.CURSOR_COLOR;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, this.cellSize - 2, this.cellSize - 2);
        }
      }
    }
  }

  /** 渲染单个格子 */
  private renderCell(ctx: CanvasRenderingContext2D, x: number, y: number, cell: Cell): void {
    const size = this.cellSize;

    if (cell.state === CellState.HIDDEN) {
      this.renderHiddenCell(ctx, x, y, size);
    } else if (cell.state === CellState.FLAGGED) {
      this.renderHiddenCell(ctx, x, y, size);
      this.renderFlag(ctx, x, y, size);

      // 游戏结束时，错误标旗标记
      if (this._status === 'gameover' && !cell.isMine) {
        this.renderWrongFlag(ctx, x, y, size);
      }
    } else if (cell.state === CellState.REVEALED) {
      if (cell.isMine) {
        this.renderMine(ctx, x, y, size);
      } else {
        this.renderRevealedCell(ctx, x, y, size, cell.adjacentMines);
      }
    }
  }

  /** 渲染未揭开格子（3D 凸起效果） */
  private renderHiddenCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    // 主体
    ctx.fillStyle = COLORS.HIDDEN_FILL;
    ctx.fillRect(x, y, size, size);

    // 高光（左上）
    ctx.fillStyle = COLORS.HIDDEN_LIGHT;
    ctx.fillRect(x, y, size, 2);
    ctx.fillRect(x, y, 2, size);

    // 阴影（右下）
    ctx.fillStyle = COLORS.HIDDEN_DARK;
    ctx.fillRect(x, y + size - 2, size, 2);
    ctx.fillRect(x + size - 2, y, 2, size);

    // 边框
    ctx.strokeStyle = COLORS.HIDDEN_DARK;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, size, size);
  }

  /** 渲染已揭开格子 */
  private renderRevealedCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, num: number): void {
    // 背景
    ctx.fillStyle = COLORS.REVEALED_FILL;
    ctx.fillRect(x, y, size, size);

    // 边框
    ctx.strokeStyle = COLORS.REVEALED_BORDER;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, size, size);

    // 数字
    if (num > 0 && num < COLORS.NUM_COLORS.length) {
      ctx.fillStyle = COLORS.NUM_COLORS[num];
      ctx.font = `bold ${Math.floor(size * 0.6)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num.toString(), x + size / 2, y + size / 2);
    }
  }

  /** 渲染旗帜（红色三角 + 杆） */
  private renderFlag(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const cx = x + size / 2;
    const top = y + size * 0.2;
    const bottom = y + size * 0.8;

    // 杆
    ctx.strokeStyle = COLORS.FLAG_POLE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, bottom);
    ctx.stroke();

    // 三角旗
    ctx.fillStyle = COLORS.FLAG_RED;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + size * 0.3, top + size * 0.2);
    ctx.lineTo(cx, top + size * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  /** 渲染地雷 */
  private renderMine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size * 0.25;

    // 背景（红色高亮）
    ctx.fillStyle = COLORS.MINE_BG;
    ctx.fillRect(x, y, size, size);

    // 地雷主体
    ctx.fillStyle = COLORS.MINE_BODY;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // 刺
    ctx.strokeStyle = COLORS.MINE_SPIKE;
    ctx.lineWidth = 2;
    const spikeLen = r * 1.5;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 4) * i;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r * 0.5, cy + Math.sin(angle) * r * 0.5);
      ctx.lineTo(cx + Math.cos(angle) * spikeLen, cy + Math.sin(angle) * spikeLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(angle) * r * 0.5, cy - Math.sin(angle) * r * 0.5);
      ctx.lineTo(cx - Math.cos(angle) * spikeLen, cy - Math.sin(angle) * spikeLen);
      ctx.stroke();
    }

    // 高光
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 渲染错误标旗（X 标记） */
  private renderWrongFlag(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    const pad = size * 0.2;
    ctx.beginPath();
    ctx.moveTo(x + pad, y + pad);
    ctx.lineTo(x + size - pad, y + size - pad);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size - pad, y + pad);
    ctx.lineTo(x + pad, y + size - pad);
    ctx.stroke();
  }
}
