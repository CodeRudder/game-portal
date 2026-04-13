import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  DEFAULT_GRID_SIZE, SUPPORTED_GRID_SIZES, BOARD_PADDING, TILE_GAP, TILE_RADIUS,
  BG_COLOR, BOARD_BG_COLOR, TILE_COLORS, TILE_TEXT_COLOR, HUD_TEXT_COLOR,
  EMPTY_TILE_COLOR, SHUFFLE_MOVES, ANIMATION_DURATION, TILE_FONT_SIZE,
  HUD_FONT_SIZE, WIN_FONT_SIZE,
} from './constants';

// ========== 方向定义 ==========

const DIRECTIONS = [
  { dr: -1, dc: 0 }, // 上
  { dr: 1, dc: 0 },  // 下
  { dr: 0, dc: -1 }, // 左
  { dr: 0, dc: 1 },  // 右
] as const;

// ========== 动画状态 ==========

interface TileAnimation {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  progress: number; // 0 ~ 1
}

// ========== SliderPuzzleEngine ==========

export class SliderPuzzleEngine extends GameEngine {
  // 网格尺寸
  private _gridSize: number = DEFAULT_GRID_SIZE;

  // 棋盘状态：0 表示空位，1~N 表示方块编号
  private _board: number[][] = [];

  // 空位位置
  private _emptyRow: number = 0;
  private _emptyCol: number = 0;

  // 移动计数
  private _moveCount: number = 0;

  // 是否完成
  private _isCompleted: boolean = false;

  // 最佳记录（本次游戏会话内的最少步数）
  private _bestMoves: number = Infinity;

  // 当前动画
  private _animation: TileAnimation | null = null;

  // 动画中的方块编号
  private _animatingTile: number = 0;

  // ========== Public Getters ==========

  get gridSize(): number { return this._gridSize; }
  get moveCount(): number { return this._moveCount; }
  get isCompleted(): boolean { return this._isCompleted; }
  get bestMoves(): number { return this._bestMoves === Infinity ? 0 : this._bestMoves; }

  /** 获取棋盘的只读副本 */
  getBoard(): number[][] {
    return this._board.map(row => [...row]);
  }

  /** 获取空位位置 */
  getEmptyPosition(): { row: number; col: number } {
    return { row: this._emptyRow, col: this._emptyCol };
  }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._gridSize = DEFAULT_GRID_SIZE;
    this._board = this.createSolvedBoard(this._gridSize);
    this.syncEmptyPosition();
    this._moveCount = 0;
    this._isCompleted = false;
    this._animation = null;
    this._animatingTile = 0;
  }

  protected onStart(): void {
    this._moveCount = 0;
    this._isCompleted = false;
    this._animation = null;
    this._animatingTile = 0;
    this._board = this.createSolvedBoard(this._gridSize);
    this.syncEmptyPosition();
    this.shuffle();
    // 确保打乱后不是已完成状态
    while (this.checkSolved()) {
      this.shuffle();
    }
  }

  protected update(deltaTime: number): void {
    // 更新动画
    if (this._animation) {
      this._animation.progress += deltaTime / ANIMATION_DURATION;
      if (this._animation.progress >= 1) {
        this._animation = null;
        this._animatingTile = 0;
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD 区域
    this.renderHUD(ctx, w);

    // 棋盘背景
    const boardX = BOARD_PADDING;
    const boardY = HUD_HEIGHT + BOARD_PADDING;
    const boardSize = w - BOARD_PADDING * 2;
    ctx.fillStyle = BOARD_BG_COLOR;
    ctx.beginPath();
    ctx.roundRect(boardX, boardY, boardSize, boardSize, 8);
    ctx.fill();

    // 计算方块尺寸
    const tileSize = (boardSize - TILE_GAP * (this._gridSize + 1)) / this._gridSize;
    const color = TILE_COLORS[this._gridSize] || TILE_COLORS[4];

    // 渲染方块
    for (let r = 0; r < this._gridSize; r++) {
      for (let c = 0; c < this._gridSize; c++) {
        const tileNum = this._board[r][c];
        const tileX = boardX + TILE_GAP + c * (tileSize + TILE_GAP);
        const tileY = boardY + TILE_GAP + r * (tileSize + TILE_GAP);

        if (tileNum === 0) {
          // 空位
          ctx.fillStyle = EMPTY_TILE_COLOR;
          ctx.beginPath();
          ctx.roundRect(tileX, tileY, tileSize, tileSize, TILE_RADIUS);
          ctx.fill();
          continue;
        }

        // 动画偏移
        let drawX = tileX;
        let drawY = tileY;
        if (this._animation && tileNum === this._animatingTile) {
          const fromX = boardX + TILE_GAP + this._animation.fromCol * (tileSize + TILE_GAP);
          const fromY = boardY + TILE_GAP + this._animation.fromRow * (tileSize + TILE_GAP);
          const progress = Math.min(this._animation.progress, 1);
          // 使用 ease-out 缓动
          const eased = 1 - (1 - progress) * (1 - progress);
          drawX = fromX + (tileX - fromX) * eased;
          drawY = fromY + (tileY - fromY) * eased;
        }

        // 方块背景
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, tileSize, tileSize, TILE_RADIUS);
        ctx.fill();

        // 方块高光
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, tileSize, tileSize / 2, [TILE_RADIUS, TILE_RADIUS, 0, 0]);
        ctx.fill();

        // 方块文字
        ctx.fillStyle = TILE_TEXT_COLOR;
        ctx.font = `bold ${TILE_FONT_SIZE[this._gridSize] || 28}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          String(tileNum),
          drawX + tileSize / 2,
          drawY + tileSize / 2,
        );
      }
    }

    // 完成提示
    if (this._isCompleted) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#66bb6a';
      ctx.font = `bold ${WIN_FONT_SIZE}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎉 完成！', w / 2, h / 2 - 20);
      ctx.fillStyle = HUD_TEXT_COLOR;
      ctx.font = `${HUD_FONT_SIZE}px monospace`;
      ctx.fillText(`${this._moveCount} 步`, w / 2, h / 2 + 20);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '14px monospace';
      ctx.fillText('按 Space 重新开始', w / 2, h / 2 + 55);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  protected onReset(): void {
    this._board = this.createSolvedBoard(this._gridSize);
    this.syncEmptyPosition();
    this._moveCount = 0;
    this._isCompleted = false;
    this._animation = null;
    this._animatingTile = 0;
  }

  protected onPause(): void {}

  protected onResume(): void {}

  protected onDestroy(): void {}

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      }
      return;
    }

    if (this._status !== 'playing' || this._isCompleted) return;

    // 方向键移动：将方块滑入空位
    // ArrowUp → 空位上方的方块向下移入空位（即 emptyRow-1 的方块移到 emptyRow）
    // ArrowDown → 空位下方的方块向上移入空位
    // ArrowLeft → 空位左边的方块向右移入空位
    // ArrowRight → 空位右边的方块向左移入空位
    let targetRow = this._emptyRow;
    let targetCol = this._emptyCol;

    switch (key) {
      case 'ArrowUp':
        targetRow = this._emptyRow - 1;
        break;
      case 'ArrowDown':
        targetRow = this._emptyRow + 1;
        break;
      case 'ArrowLeft':
        targetCol = this._emptyCol - 1;
        break;
      case 'ArrowRight':
        targetCol = this._emptyCol + 1;
        break;
      default:
        return;
    }

    this.moveTile(targetRow, targetCol);
  }

  handleKeyUp(_key: string): void {
    // 滑块拼图不需要持续按键
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      gridSize: this._gridSize,
      board: this.getBoard(),
      moveCount: this._moveCount,
      isCompleted: this._isCompleted,
      bestMoves: this.bestMoves,
      emptyRow: this._emptyRow,
      emptyCol: this._emptyCol,
    };
  }

  // ========== 公共方法 ==========

  /**
   * 设置网格尺寸（仅在 idle 状态下可设置）
   */
  setGridSize(size: number): void {
    if (this._status !== 'idle') return;
    if (!SUPPORTED_GRID_SIZES.includes(size as any)) return;
    this._gridSize = size;
    this._board = this.createSolvedBoard(size);
    this.syncEmptyPosition();
    this._moveCount = 0;
    this._isCompleted = false;
  }

  /**
   * 点击指定行列的方块（用于鼠标/触摸操作）
   */
  clickTile(row: number, col: number): void {
    if (this._status !== 'playing' || this._isCompleted) return;
    if (row < 0 || row >= this._gridSize || col < 0 || col >= this._gridSize) return;
    if (this._board[row][col] === 0) return;

    // 检查是否与空位相邻
    const isAdjacent =
      (Math.abs(row - this._emptyRow) === 1 && col === this._emptyCol) ||
      (Math.abs(col - this._emptyCol) === 1 && row === this._emptyRow);

    if (isAdjacent) {
      this.moveTile(row, col);
    }
  }

  // ========== 私有方法 ==========

  /**
   * 创建已解决状态的棋盘
   * 1 2 3
   * 4 5 6
   * 7 8 0  （0 = 空位在右下角）
   */
  private createSolvedBoard(size: number): number[][] {
    const board: number[][] = [];
    let num = 1;
    for (let r = 0; r < size; r++) {
      const row: number[] = [];
      for (let c = 0; c < size; c++) {
        row.push(num);
        num++;
      }
      board.push(row);
    }
    board[size - 1][size - 1] = 0; // 右下角为空位
    return board;
  }

  /**
   * 同步空位位置到 _emptyRow / _emptyCol
   */
  private syncEmptyPosition(): void {
    for (let r = 0; r < this._gridSize; r++) {
      for (let c = 0; c < this._gridSize; c++) {
        if (this._board[r][c] === 0) {
          this._emptyRow = r;
          this._emptyCol = c;
          return;
        }
      }
    }
  }

  /**
   * 通过随机合法移动来打乱棋盘（保证可解）
   */
  private shuffle(): void {
    const moves = SHUFFLE_MOVES[this._gridSize] || 200;
    let lastDir = -1;

    for (let i = 0; i < moves; i++) {
      // 获取可移动方向（不回头）
      const validDirs = DIRECTIONS
        .map((d, idx) => ({ ...d, idx }))
        .filter(d => {
          const nr = this._emptyRow + d.dr;
          const nc = this._emptyCol + d.dc;
          return nr >= 0 && nr < this._gridSize && nc >= 0 && nc < this._gridSize;
        })
        .filter(d => {
          // 避免立即回退（反方向）
          const opposite = [1, 0, 3, 2];
          return d.idx !== opposite[lastDir];
        });

      // 如果所有方向都被过滤（不太可能），则用全部合法方向
      const candidates = validDirs.length > 0 ? validDirs :
        DIRECTIONS
          .map((d, idx) => ({ ...d, idx }))
          .filter(d => {
            const nr = this._emptyRow + d.dr;
            const nc = this._emptyCol + d.dc;
            return nr >= 0 && nr < this._gridSize && nc >= 0 && nc < this._gridSize;
          });

      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      const nr = this._emptyRow + chosen.dr;
      const nc = this._emptyCol + chosen.dc;

      // 交换
      this._board[this._emptyRow][this._emptyCol] = this._board[nr][nc];
      this._board[nr][nc] = 0;
      this._emptyRow = nr;
      this._emptyCol = nc;
      lastDir = chosen.idx;
    }
  }

  /**
   * 移动指定位置的方块到空位
   */
  private moveTile(row: number, col: number): void {
    // 边界检查
    if (row < 0 || row >= this._gridSize || col < 0 || col >= this._gridSize) return;
    // 必须与空位相邻
    const isAdjacent =
      (Math.abs(row - this._emptyRow) === 1 && col === this._emptyCol) ||
      (Math.abs(col - this._emptyCol) === 1 && row === this._emptyRow);
    if (!isAdjacent) return;
    // 不能移动空位本身
    if (this._board[row][col] === 0) return;

    // 设置动画
    const tileNum = this._board[row][col];
    this._animation = {
      fromRow: row,
      fromCol: col,
      toRow: this._emptyRow,
      toCol: this._emptyCol,
      progress: 0,
    };
    this._animatingTile = tileNum;

    // 交换
    this._board[this._emptyRow][this._emptyCol] = tileNum;
    this._board[row][col] = 0;
    this._emptyRow = row;
    this._emptyCol = col;

    // 计步
    this._moveCount++;
    this._score = this._moveCount; // score 记录步数（越少越好）
    this.emit('scoreChange', this._score);

    // 检查是否完成
    if (this.checkSolved()) {
      this._isCompleted = true;
      // 更新最佳记录
      if (this._moveCount < this._bestMoves) {
        this._bestMoves = this._moveCount;
      }
      this.gameOver();
    }
  }

  /**
   * 检查拼图是否已解决
   */
  private checkSolved(): boolean {
    let expected = 1;
    for (let r = 0; r < this._gridSize; r++) {
      for (let c = 0; c < this._gridSize; c++) {
        if (r === this._gridSize - 1 && c === this._gridSize - 1) {
          if (this._board[r][c] !== 0) return false;
        } else {
          if (this._board[r][c] !== expected) return false;
          expected++;
        }
      }
    }
    return true;
  }

  /**
   * 渲染 HUD 区域
   */
  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 步数
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.font = `bold ${HUD_FONT_SIZE}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`步数: ${this._moveCount}`, 16, HUD_HEIGHT / 2 + 6);

    // 网格尺寸
    ctx.textAlign = 'center';
    ctx.fillText(`${this._gridSize}×${this._gridSize}`, w / 2, HUD_HEIGHT / 2 + 6);

    // 最佳记录
    ctx.textAlign = 'right';
    const bestStr = this._bestMoves === Infinity ? '--' : String(this._bestMoves);
    ctx.fillText(`最佳: ${bestStr}`, w - 16, HUD_HEIGHT / 2 + 6);

    ctx.textAlign = 'left';
  }

  // ========== 静态工具方法（供测试使用） ==========

  /**
   * 计算逆序数
   */
  static countInversions(board: number[]): number {
    let inversions = 0;
    const filtered = board.filter(n => n !== 0);
    for (let i = 0; i < filtered.length; i++) {
      for (let j = i + 1; j < filtered.length; j++) {
        if (filtered[i] > filtered[j]) inversions++;
      }
    }
    return inversions;
  }

  /**
   * 判断棋盘是否可解
   * 对于 N×N 拼图：
   * - N 为奇数：逆序数为偶数时可解
   * - N 为偶数：逆序数 + 空位所在行（从底部数起）的奇偶性为偶数时可解
   */
  static isSolvable(board: number[][], gridSize: number): boolean {
    const flat = board.flat();
    const inversions = SliderPuzzleEngine.countInversions(flat);

    if (gridSize % 2 === 1) {
      // 奇数尺寸：逆序数为偶数时可解
      return inversions % 2 === 0;
    } else {
      // 偶数尺寸：空位从底部数起所在行（1-indexed）
      let emptyRowFromBottom = 0;
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (board[r][c] === 0) {
            emptyRowFromBottom = gridSize - r;
          }
        }
      }
      // 偶数尺寸：(inversions + emptyRowFromBottom) 为奇数时可解
      return (inversions + emptyRowFromBottom) % 2 !== 0;
    }
  }
}
