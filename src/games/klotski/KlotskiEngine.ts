/**
 * 华容道 (Klotski) 游戏引擎
 *
 * 经典滑块益智游戏：4×5 棋盘，通过滑动棋子将曹操移到底部出口。
 * 继承自 GameEngine 基类，遵循项目统一的游戏引擎接口。
 */
import { GameEngine } from '@/core/GameEngine';
import {
  COLS, ROWS,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BOARD_LEFT, BOARD_TOP, CELL_WIDTH, CELL_HEIGHT,
  BOARD_PADDING, BOARD_WIDTH, BOARD_HEIGHT, BOARD_BOTTOM, BOARD_RIGHT,
  EXIT_LEFT, EXIT_RIGHT, EXIT_Y,
  PIECE_GAP, PIECE_RADIUS, SELECTED_BORDER_WIDTH, SELECTED_GLOW_COLOR,
  BG_COLOR, BOARD_BG_COLOR, BOARD_BORDER_COLOR, GRID_LINE_COLOR,
  EXIT_COLOR, HUD_TEXT_COLOR, HINT_COLOR,
  PieceType, PIECE_SIZES, PIECE_COLORS, PIECE_BORDER_COLORS,
  PIECE_LABELS, PIECE_TEXT_COLORS,
  LEVELS, WIN_ROW, WIN_COL,
  type LevelConfig, type PieceConfig,
} from './constants';

// ========== 内部数据结构 ==========

/** 运行时棋子状态 */
export interface Piece {
  id: string;
  type: PieceType;
  col: number;  // 网格列 (0-based)
  row: number;  // 网格行 (0-based)
  w: number;    // 占据列数
  h: number;    // 占据行数
  label: string;
}

/** 移动方向 */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** 方向偏移量 */
const DIR_OFFSETS: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

export class KlotskiEngine extends GameEngine {
  // ========== 游戏状态 ==========

  /** 当前棋子列表 */
  private _pieces: Piece[] = [];

  /** 4×5 占位网格：grid[row][col] = pieceId 或 null */
  private _grid: (string | null)[][] = [];

  /** 当前选中棋子的 id */
  private _selectedPieceId: string | null = null;

  /** 移动步数 */
  private _moves: number = 0;

  /** 当前关卡索引 */
  private _levelIndex: number = 0;

  /** 是否已胜利 */
  private _isWin: boolean = false;

  // ========== Public Getters ==========

  get pieces(): Piece[] { return [...this._pieces]; }
  get selectedPieceId(): string | null { return this._selectedPieceId; }
  get moves(): number { return this._moves; }
  get isWin(): boolean { return this._isWin; }
  get levelIndex(): number { return this._levelIndex; }
  get levelConfig(): LevelConfig { return LEVELS[this._levelIndex]; }
  get grid(): (string | null)[][] { return this._grid.map(row => [...row]); }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._pieces = [];
    this._grid = this.createEmptyGrid();
    this._selectedPieceId = null;
    this._moves = 0;
    this._isWin = false;
    this._levelIndex = 0;
  }

  protected onStart(): void {
    this.loadLevel(this._levelIndex);
    this._moves = 0;
    this._isWin = false;
    this._selectedPieceId = null;
  }

  protected update(_deltaTime: number): void {
    // 华容道是回合制游戏，update 主要用于计时和动画
    // 实际游戏逻辑在 handleKeyDown 中处理
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this.renderHUD(ctx, w);

    // 棋盘背景
    ctx.fillStyle = BOARD_BG_COLOR;
    ctx.fillRect(BOARD_LEFT, BOARD_TOP, BOARD_WIDTH, BOARD_HEIGHT);

    // 网格线
    this.renderGrid(ctx);

    // 出口标记
    this.renderExit(ctx);

    // 棋盘边框
    ctx.strokeStyle = BOARD_BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_LEFT, BOARD_TOP, BOARD_WIDTH, BOARD_HEIGHT);

    // 棋子
    this.renderPieces(ctx);

    // 胜利提示
    if (this._status === 'gameover' && this._isWin) {
      this.renderWinOverlay(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._pieces = [];
    this._grid = this.createEmptyGrid();
    this._selectedPieceId = null;
    this._moves = 0;
    this._isWin = false;
  }

  protected onGameOver(): void {
    // 胜利时的处理
  }

  handleKeyDown(key: string): void {
    if (this._status === 'idle') {
      if (key === ' ' || key === 'Space' || key === 'Enter') {
        this.start();
      }
      return;
    }

    if (this._status === 'gameover') {
      if (key === ' ' || key === 'Space' || key === 'Enter') {
        this.reset();
        this.start();
      }
      return;
    }

    if (this._status !== 'playing') return;

    switch (key) {
      // 选择棋子：Tab 切换
      case 'Tab':
        this.selectNextPiece();
        break;

      // 移动选中棋子
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.moveSelectedPiece('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.moveSelectedPiece('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.moveSelectedPiece('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.moveSelectedPiece('right');
        break;

      // 重置当前关卡
      case 'r':
      case 'R':
        this.reset();
        break;

      // 切换关卡
      case 'n':
      case 'N':
        this.nextLevel();
        break;
      case 'p':
      case 'P':
        this.prevLevel();
        break;

      // 暂停/继续
      case 'Escape':
        if (this._status === 'playing') {
          this.pause();
        }
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 华容道不需要持续按键处理
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      moves: this._moves,
      isWin: this._isWin,
      selectedPieceId: this._selectedPieceId,
      levelIndex: this._levelIndex,
      levelName: this.levelConfig.name,
      pieces: this._pieces.map(p => ({
        id: p.id,
        type: p.type,
        col: p.col,
        row: p.row,
        w: p.w,
        h: p.h,
        label: p.label,
      })),
      grid: this._grid.map(row => [...row]),
    };
  }

  // ========== 公共方法（供 UI 调用） ==========

  /**
   * 加载指定关卡
   */
  loadLevel(levelIndex: number): void {
    const idx = Math.max(0, Math.min(levelIndex, LEVELS.length - 1));
    this._levelIndex = idx;
    this.setLevel(idx + 1);
    const config = LEVELS[idx];

    this._pieces = [];
    this._grid = this.createEmptyGrid();
    this._selectedPieceId = null;
    this._moves = 0;
    this._isWin = false;

    for (const pc of config.pieces) {
      const size = PIECE_SIZES[pc.type];
      const label = pc.label ?? PIECE_LABELS[pc.type];
      const piece: Piece = {
        id: pc.id,
        type: pc.type,
        col: pc.col,
        row: pc.row,
        w: size.w,
        h: size.h,
        label,
      };
      this._pieces.push(piece);
      this.placePieceOnGrid(piece);
    }
  }

  /**
   * 选择指定 ID 的棋子
   */
  selectPiece(pieceId: string): boolean {
    const piece = this._pieces.find(p => p.id === pieceId);
    if (!piece) return false;
    this._selectedPieceId = pieceId;
    this.emit('selectionChange', pieceId);
    return true;
  }

  /**
   * 选择下一个棋子（Tab 切换）
   */
  selectNextPiece(): void {
    if (this._pieces.length === 0) return;

    if (!this._selectedPieceId) {
      this._selectedPieceId = this._pieces[0].id;
      this.emit('selectionChange', this._selectedPieceId);
      return;
    }

    const currentIndex = this._pieces.findIndex(p => p.id === this._selectedPieceId);
    const nextIndex = (currentIndex + 1) % this._pieces.length;
    this._selectedPieceId = this._pieces[nextIndex].id;
    this.emit('selectionChange', this._selectedPieceId);
  }

  /**
   * 选择上一个棋子
   */
  selectPrevPiece(): void {
    if (this._pieces.length === 0) return;

    if (!this._selectedPieceId) {
      this._selectedPieceId = this._pieces[this._pieces.length - 1].id;
      this.emit('selectionChange', this._selectedPieceId);
      return;
    }

    const currentIndex = this._pieces.findIndex(p => p.id === this._selectedPieceId);
    const prevIndex = (currentIndex - 1 + this._pieces.length) % this._pieces.length;
    this._selectedPieceId = this._pieces[prevIndex].id;
    this.emit('selectionChange', this._selectedPieceId);
  }

  /**
   * 移动当前选中的棋子
   * @returns 是否移动成功
   */
  moveSelectedPiece(direction: Direction): boolean {
    if (!this._selectedPieceId) return false;
    return this.movePiece(this._selectedPieceId, direction);
  }

  /**
   * 移动指定棋子
   * @returns 是否移动成功
   */
  movePiece(pieceId: string, direction: Direction): boolean {
    if (this._status !== 'playing') return false;
    if (this._isWin) return false;

    const piece = this._pieces.find(p => p.id === pieceId);
    if (!piece) return false;

    const offset = DIR_OFFSETS[direction];
    const newCol = piece.col + offset.dc;
    const newRow = piece.row + offset.dr;

    if (!this.canMovePiece(piece, direction)) return false;

    // 从网格中移除旧位置
    this.removePieceFromGrid(piece);
    // 更新位置
    piece.col = newCol;
    piece.row = newRow;
    // 放置到网格新位置
    this.placePieceOnGrid(piece);

    this._moves++;
    this.emit('move', { pieceId, direction, moves: this._moves });

    // 检查胜利条件
    if (this.checkWin()) {
      this._isWin = true;
      this.addScore(Math.max(0, 1000 - this._moves * 5));
      this.gameOver();
    }

    return true;
  }

  /**
   * 检测指定棋子是否可以朝某方向移动
   */
  canMovePiece(piece: Piece, direction: Direction): boolean {
    const offset = DIR_OFFSETS[direction];
    const newCol = piece.col + offset.dc;
    const newRow = piece.row + offset.dr;

    // 边界检查
    if (newCol < 0 || newCol + piece.w > COLS) return false;
    if (newRow < 0 || newRow + piece.h > ROWS) return false;

    // 碰撞检查：新位置上的格子不能被其他棋子占据
    for (let r = newRow; r < newRow + piece.h; r++) {
      for (let c = newCol; c < newCol + piece.w; c++) {
        const occupant = this._grid[r][c];
        if (occupant !== null && occupant !== piece.id) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 获取指定棋子可以移动的方向列表
   */
  getMovableDirections(pieceId: string): Direction[] {
    const piece = this._pieces.find(p => p.id === pieceId);
    if (!piece) return [];

    const directions: Direction[] = [];
    for (const dir of ['up', 'down', 'left', 'right'] as Direction[]) {
      if (this.canMovePiece(piece, dir)) {
        directions.push(dir);
      }
    }
    return directions;
  }

  /**
   * 切换到下一关
   */
  nextLevel(): void {
    const nextIdx = (this._levelIndex + 1) % LEVELS.length;
    this._levelIndex = nextIdx;
    this.reset();
    this.start();
  }

  /**
   * 切换到上一关
   */
  prevLevel(): void {
    const prevIdx = (this._levelIndex - 1 + LEVELS.length) % LEVELS.length;
    this._levelIndex = prevIdx;
    this.reset();
    this.start();
  }

  /**
   * 检查是否胜利
   */
  checkWin(): boolean {
    const caocao = this._pieces.find(p => p.type === PieceType.CAOCAO);
    if (!caocao) return false;
    return caocao.col === WIN_COL && caocao.row === WIN_ROW;
  }

  /**
   * 获取指定位置的棋子 ID
   */
  getPieceAt(col: number, row: number): string | null {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return this._grid[row][col];
  }

  /**
   * 根据 canvas 坐标获取棋子 ID
   */
  getPieceAtPixel(x: number, y: number): string | null {
    const col = Math.floor((x - BOARD_LEFT) / CELL_WIDTH);
    const row = Math.floor((y - BOARD_TOP) / CELL_HEIGHT);
    return this.getPieceAt(col, row);
  }

  // ========== 私有方法 ==========

  /**
   * 创建空的 4×5 网格
   */
  private createEmptyGrid(): (string | null)[][] {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  /**
   * 将棋子放置到网格上
   */
  private placePieceOnGrid(piece: Piece): void {
    for (let r = piece.row; r < piece.row + piece.h; r++) {
      for (let c = piece.col; c < piece.col + piece.w; c++) {
        this._grid[r][c] = piece.id;
      }
    }
  }

  /**
   * 从网格中移除棋子
   */
  private removePieceFromGrid(piece: Piece): void {
    for (let r = piece.row; r < piece.row + piece.h; r++) {
      for (let c = piece.col; c < piece.col + piece.w; c++) {
        if (this._grid[r][c] === piece.id) {
          this._grid[r][c] = null;
        }
      }
    }
  }

  // ========== 渲染方法 ==========

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`第 ${this._levelIndex + 1} 关: ${this.levelConfig.name}`, BOARD_PADDING, 22);

    ctx.textAlign = 'right';
    ctx.fillText(`步数: ${this._moves}`, w - BOARD_PADDING, 22);

    ctx.font = '12px monospace';
    ctx.fillStyle = HINT_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText('Tab:选择 ↑↓←→:移动 N/P:换关 R:重置', w / 2, 42);
    ctx.textAlign = 'left';
  }

  private renderGrid(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 1;

    // 竖线
    for (let c = 0; c <= COLS; c++) {
      const x = BOARD_LEFT + c * CELL_WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, BOARD_TOP);
      ctx.lineTo(x, BOARD_TOP + BOARD_HEIGHT);
      ctx.stroke();
    }

    // 横线
    for (let r = 0; r <= ROWS; r++) {
      const y = BOARD_TOP + r * CELL_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(BOARD_LEFT, y);
      ctx.lineTo(BOARD_LEFT + BOARD_WIDTH, y);
      ctx.stroke();
    }
  }

  private renderExit(ctx: CanvasRenderingContext2D): void {
    // 出口标记（底部中间两格）
    ctx.fillStyle = EXIT_COLOR;
    ctx.fillRect(EXIT_LEFT, EXIT_Y - 4, EXIT_RIGHT - EXIT_LEFT, 8);

    // 出口箭头指示
    ctx.fillStyle = HINT_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▼ 出口 ▼', (EXIT_LEFT + EXIT_RIGHT) / 2, EXIT_Y + 20);
    ctx.textAlign = 'left';
  }

  private renderPieces(ctx: CanvasRenderingContext2D): void {
    for (const piece of this._pieces) {
      this.renderPiece(ctx, piece);
    }
  }

  private renderPiece(ctx: CanvasRenderingContext2D, piece: Piece): void {
    const x = BOARD_LEFT + piece.col * CELL_WIDTH + PIECE_GAP / 2;
    const y = BOARD_TOP + piece.row * CELL_HEIGHT + PIECE_GAP / 2;
    const w = piece.w * CELL_WIDTH - PIECE_GAP;
    const h = piece.h * CELL_HEIGHT - PIECE_GAP;

    const isSelected = this._selectedPieceId === piece.id;

    // 选中时的发光效果
    if (isSelected) {
      ctx.shadowColor = SELECTED_GLOW_COLOR;
      ctx.shadowBlur = 12;
    }

    // 棋子主体
    ctx.fillStyle = PIECE_COLORS[piece.type];
    this.roundRect(ctx, x, y, w, h, PIECE_RADIUS);
    ctx.fill();

    // 棋子边框
    ctx.strokeStyle = PIECE_BORDER_COLORS[piece.type];
    ctx.lineWidth = isSelected ? SELECTED_BORDER_WIDTH : 1.5;
    this.roundRect(ctx, x, y, w, h, PIECE_RADIUS);
    ctx.stroke();

    // 清除阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 选中时的额外高亮边框
    if (isSelected) {
      ctx.strokeStyle = SELECTED_GLOW_COLOR;
      ctx.lineWidth = 2;
      this.roundRect(ctx, x - 2, y - 2, w + 4, h + 4, PIECE_RADIUS + 2);
      ctx.stroke();
    }

    // 棋子文字
    ctx.fillStyle = PIECE_TEXT_COLORS[piece.type];
    const fontSize = piece.type === PieceType.CAOCAO ? 22 :
                     piece.type === PieceType.GUANYU ? 16 :
                     piece.type === PieceType.GENERAL_V ? 14 : 14;
    ctx.font = `bold ${fontSize}px "SimHei", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(piece.label, x + w / 2, y + h / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  private renderWinOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    // 胜利文字
    ctx.fillStyle = '#ffeb3b';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 恭喜过关！', w / 2, h / 2 - 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = '20px monospace';
    ctx.fillText(`总步数: ${this._moves}`, w / 2, h / 2 + 10);
    ctx.fillText(`得分: ${this._score}`, w / 2, h / 2 + 40);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#bdbdbd';
    ctx.fillText('按 空格键 重玩 | N 下一关', w / 2, h / 2 + 80);
    ctx.textAlign = 'left';
  }

  /** 绘制圆角矩形路径 */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    radius: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
