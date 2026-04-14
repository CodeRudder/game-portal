import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  GRID_SIZE, TOTAL_PIECES,
  PUZZLE_AREA_Y, PUZZLE_AREA_PADDING, PUZZLE_AREA_SIZE, PIECE_SIZE,
  PIECE_AREA_Y, PIECE_AREA_GAP, PIECE_AREA_PADDING_X, PIECE_AREA_PADDING_Y,
  PIECE_AREA_COLS, PIECE_DISPLAY_SIZE,
  BG_COLOR, HUD_BG_COLOR, PUZZLE_BG_COLOR, HUD_TEXT_COLOR,
  CURSOR_COLOR, SELECTED_COLOR, PLACED_CORRECT_COLOR,
  EMPTY_SLOT_COLOR, PIECE_BORDER_COLOR, GRID_LINE_COLOR,
  PROGRESS_BAR_BG, PROGRESS_BAR_FG,
  PATTERNS, SHUFFLE_ITERATIONS,
  HUD_FONT, NUMBER_FONT, WIN_FONT, PROGRESS_FONT,
} from './constants';

// ========== 碎片接口 ==========

export interface PuzzlePiece {
  /** 碎片唯一 ID（0 ~ TOTAL_PIECES-1），对应正确位置 */
  id: number;
  /** 碎片当前在碎片区域的索引位置（-1 表示已放置到拼图区域） */
  slotIndex: number;
  /** 碎片是否已正确放置到拼图区域 */
  isPlaced: boolean;
  /** 碎片在碎片区域中的行 */
  areaRow: number;
  /** 碎片在碎片区域中的列 */
  areaCol: number;
}

// ========== JigsawPuzzleEngine ==========

export class JigsawPuzzleEngine extends GameEngine {
  // 当前图案索引
  private _patternIndex: number = 0;

  // 碎片列表
  private _pieces: PuzzlePiece[] = [];

  // 光标在碎片区域的位置（row, col）
  private _cursorRow: number = 0;
  private _cursorCol: number = 0;

  // 光标是否在拼图区域
  private _cursorInPuzzle: boolean = false;

  // 光标在拼图区域的行/列
  private _puzzleCursorRow: number = 0;
  private _puzzleCursorCol: number = 0;

  // 当前选中的碎片 ID（-1 表示无选中）
  private _selectedPieceId: number = -1;

  // 已正确放置的碎片数
  private _placedCount: number = 0;

  // 步数
  private _moveCount: number = 0;

  // 是否完成
  private _isCompleted: boolean = false;

  // 是否胜利
  public isWin: boolean = false;

  // ========== Public Getters ==========

  get patternIndex(): number { return this._patternIndex; }
  get placedCount(): number { return this._placedCount; }
  get moveCount(): number { return this._moveCount; }
  get isCompleted(): boolean { return this._isCompleted; }
  get cursorRow(): number { return this._cursorRow; }
  get cursorCol(): number { return this._cursorCol; }
  get cursorInPuzzle(): boolean { return this._cursorInPuzzle; }
  get puzzleCursorRow(): number { return this._puzzleCursorRow; }
  get puzzleCursorCol(): number { return this._puzzleCursorCol; }
  get selectedPieceId(): number { return this._selectedPieceId; }

  /** 获取碎片列表的只读副本 */
  getPieces(): PuzzlePiece[] {
    return this._pieces.map(p => ({ ...p }));
  }

  /** 获取图案颜色 */
  getPatternColor(pieceId: number): string {
    const row = Math.floor(pieceId / GRID_SIZE);
    const col = pieceId % GRID_SIZE;
    return PATTERNS[this._patternIndex][row][col];
  }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._patternIndex = 0;
    this._pieces = [];
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._cursorInPuzzle = false;
    this._puzzleCursorRow = 0;
    this._puzzleCursorCol = 0;
    this._selectedPieceId = -1;
    this._placedCount = 0;
    this._moveCount = 0;
    this._isCompleted = false;
    this.isWin = false;
  }

  protected onStart(): void {
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._cursorInPuzzle = false;
    this._puzzleCursorRow = 0;
    this._puzzleCursorCol = 0;
    this._selectedPieceId = -1;
    this._placedCount = 0;
    this._moveCount = 0;
    this._isCompleted = false;
    this.isWin = false;
    this.generatePieces();
    this.shufflePieces();
    // 确保打乱后不是完成状态
    while (this.checkAllPlaced()) {
      this.shufflePieces();
    }
  }

  protected update(_deltaTime: number): void {
    // 拼图游戏不需要持续更新逻辑，由键盘事件驱动
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD 区域
    this.renderHUD(ctx, w);

    // 拼图区域
    this.renderPuzzleArea(ctx, w);

    // 碎片区域
    this.renderPieceArea(ctx, w);

    // 完成提示
    if (this._isCompleted) {
      this.renderWinOverlay(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._pieces = [];
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._cursorInPuzzle = false;
    this._puzzleCursorRow = 0;
    this._puzzleCursorCol = 0;
    this._selectedPieceId = -1;
    this._placedCount = 0;
    this._moveCount = 0;
    this._isCompleted = false;
    this.isWin = false;
  }

  protected onPause(): void {}

  protected onResume(): void {}

  protected onDestroy(): void {}

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    // 空格键：开始 / 选择放置
    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
        return;
      }
      if (this._status === 'gameover') {
        this.reset();
        this.start();
        return;
      }
      if (this._status === 'playing' && !this._isCompleted) {
        this.handleSelect();
      }
      return;
    }

    // R 键：重置
    if (key === 'r' || key === 'R') {
      this.reset();
      return;
    }

    // Tab 键：切换光标区域
    if (key === 'Tab') {
      if (this._status === 'playing' && !this._isCompleted) {
        this._cursorInPuzzle = !this._cursorInPuzzle;
      }
      return;
    }

    // N 键：切换图案（仅 idle 状态）
    if (key === 'n' || key === 'N') {
      if (this._status === 'idle') {
        this._patternIndex = (this._patternIndex + 1) % PATTERNS.length;
      }
      return;
    }

    if (this._status !== 'playing' || this._isCompleted) return;

    // 方向键移动
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
    }
  }

  handleKeyUp(_key: string): void {
    // 拼图游戏不需要持续按键
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      patternIndex: this._patternIndex,
      pieces: this.getPieces(),
      placedCount: this._placedCount,
      moveCount: this._moveCount,
      isCompleted: this._isCompleted,
      isWin: this.isWin,
      cursorRow: this._cursorRow,
      cursorCol: this._cursorCol,
      cursorInPuzzle: this._cursorInPuzzle,
      puzzleCursorRow: this._puzzleCursorRow,
      puzzleCursorCol: this._puzzleCursorCol,
      selectedPieceId: this._selectedPieceId,
      elapsedTime: this._elapsedTime,
    };
  }

  // ========== 公共方法 ==========

  /**
   * 设置图案索引（仅 idle 状态下可设置）
   */
  setPatternIndex(index: number): void {
    if (this._status !== 'idle') return;
    if (index < 0 || index >= PATTERNS.length) return;
    this._patternIndex = index;
  }

  /**
   * 获取碎片在碎片区域中指定位置的碎片 ID
   */
  getPieceAtSlot(slotRow: number, slotCol: number): number {
    const slotIndex = slotRow * PIECE_AREA_COLS + slotCol;
    const piece = this._pieces.find(p => p.slotIndex === slotIndex && !p.isPlaced);
    return piece ? piece.id : -1;
  }

  /**
   * 获取拼图区域指定位置是否已放置碎片
   */
  isSlotPlaced(row: number, col: number): boolean {
    const targetId = row * GRID_SIZE + col;
    const piece = this._pieces.find(p => p.id === targetId);
    return piece ? piece.isPlaced : false;
  }

  /**
   * 手动放置碎片（用于测试和外部调用）
   */
  placePiece(pieceId: number, targetRow: number, targetCol: number): boolean {
    if (this._status !== 'playing' || this._isCompleted) return false;
    const piece = this._pieces.find(p => p.id === pieceId);
    if (!piece || piece.isPlaced) return false;

    const correctRow = Math.floor(pieceId / GRID_SIZE);
    const correctCol = pieceId % GRID_SIZE;

    if (targetRow === correctRow && targetCol === correctCol) {
      piece.isPlaced = true;
      piece.slotIndex = -1;
      this._placedCount++;
      this._moveCount++;
      this._score = this._placedCount;
      this.emit('scoreChange', this._score);
      this.emit('stateChange', this.getState());

      if (this.checkAllPlaced()) {
        this._isCompleted = true;
        this.isWin = true;
        this.gameOver();
      }
      return true;
    }
    return false;
  }

  // ========== 私有方法 ==========

  /**
   * 生成碎片（按顺序）
   */
  private generatePieces(): void {
    this._pieces = [];
    for (let i = 0; i < TOTAL_PIECES; i++) {
      const row = Math.floor(i / PIECE_AREA_COLS);
      const col = i % PIECE_AREA_COLS;
      this._pieces.push({
        id: i,
        slotIndex: i,
        isPlaced: false,
        areaRow: row,
        areaCol: col,
      });
    }
  }

  /**
   * 打乱碎片（Fisher-Yates 洗牌）
   */
  private shufflePieces(): void {
    // 收集未放置碎片的 slotIndex
    const indices = this._pieces
      .filter(p => !p.isPlaced)
      .map(p => p.slotIndex);

    // Fisher-Yates 洗牌
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // 重新分配 slotIndex
    let idx = 0;
    for (const piece of this._pieces) {
      if (!piece.isPlaced) {
        piece.slotIndex = indices[idx];
        piece.areaRow = Math.floor(indices[idx] / PIECE_AREA_COLS);
        piece.areaCol = indices[idx] % PIECE_AREA_COLS;
        idx++;
      }
    }
  }

  /**
   * 移动光标
   */
  private moveCursor(dr: number, dc: number): void {
    if (this._cursorInPuzzle) {
      // 在拼图区域移动光标
      const newRow = this._puzzleCursorRow + dr;
      const newCol = this._puzzleCursorCol + dc;
      if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
        this._puzzleCursorRow = newRow;
        this._puzzleCursorCol = newCol;
      }
    } else {
      // 在碎片区域移动光标
      const newRow = this._cursorRow + dr;
      const newCol = this._cursorCol + dc;
      if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
        this._cursorRow = newRow;
        this._cursorCol = newCol;
      }
    }
  }

  /**
   * 处理选择/放置操作
   */
  private handleSelect(): void {
    if (this._selectedPieceId === -1) {
      // 没有选中的碎片 → 尝试选择当前光标位置的碎片
      if (this._cursorInPuzzle) return; // 拼图区域不能选择

      const slotIndex = this._cursorRow * PIECE_AREA_COLS + this._cursorCol;
      const piece = this._pieces.find(p => p.slotIndex === slotIndex && !p.isPlaced);
      if (piece) {
        this._selectedPieceId = piece.id;
        // 自动切换到拼图区域
        this._cursorInPuzzle = true;
      }
    } else {
      // 已有选中的碎片 → 尝试放置到拼图区域
      if (!this._cursorInPuzzle) {
        // 在碎片区域按空格 → 取消选择
        this._selectedPieceId = -1;
        return;
      }

      // 检查目标位置
      const targetRow = this._puzzleCursorRow;
      const targetCol = this._puzzleCursorCol;
      const pieceId = this._selectedPieceId;

      const correctRow = Math.floor(pieceId / GRID_SIZE);
      const correctCol = pieceId % GRID_SIZE;

      if (targetRow === correctRow && targetCol === correctCol) {
        // 正确位置 → 吸附放置
        this.placePiece(pieceId, targetRow, targetCol);
      } else {
        // 错误位置 → 增加步数但不放置
        this._moveCount++;
      }

      // 无论成功与否，取消选中
      this._selectedPieceId = -1;
      this._cursorInPuzzle = false;
    }
  }

  /**
   * 检查是否所有碎片都已正确放置
   */
  private checkAllPlaced(): boolean {
    return this._pieces.every(p => p.isPlaced);
  }

  // ========== 渲染方法 ==========

  /**
   * 渲染 HUD 区域
   */
  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = HUD_BG_COLOR;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 步数
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.font = HUD_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`步数: ${this._moveCount}`, 16, HUD_HEIGHT / 2);

    // 进度
    ctx.textAlign = 'center';
    ctx.fillText(`${this._placedCount}/${TOTAL_PIECES}`, w / 2, HUD_HEIGHT / 2);

    // 时间
    ctx.textAlign = 'right';
    const timeStr = this._status === 'idle' ? '0:00' : this.formatTime(this._elapsedTime);
    ctx.fillText(`⏱ ${timeStr}`, w - 16, HUD_HEIGHT / 2);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // 进度条
    const barY = HUD_HEIGHT - 4;
    const barH = 4;
    ctx.fillStyle = PROGRESS_BAR_BG;
    ctx.fillRect(0, barY, w, barH);
    ctx.fillStyle = PROGRESS_BAR_FG;
    ctx.fillRect(0, barY, w * (this._placedCount / TOTAL_PIECES), barH);
  }

  /**
   * 渲染拼图区域
   */
  private renderPuzzleArea(ctx: CanvasRenderingContext2D, _w: number): void {
    const areaX = PUZZLE_AREA_PADDING;
    const areaY = PUZZLE_AREA_Y;

    // 拼图区域背景
    ctx.fillStyle = PUZZLE_BG_COLOR;
    ctx.beginPath();
    ctx.roundRect(areaX, areaY, PUZZLE_AREA_SIZE, PUZZLE_AREA_SIZE, 8);
    ctx.fill();

    // 网格线
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const x = areaX + i * PIECE_SIZE;
      const y = areaY + i * PIECE_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, areaY);
      ctx.lineTo(x, areaY + PUZZLE_AREA_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(areaX, y);
      ctx.lineTo(areaX + PUZZLE_AREA_SIZE, y);
      ctx.stroke();
    }

    // 渲染已放置的碎片和空槽位
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = areaX + c * PIECE_SIZE;
        const y = areaY + r * PIECE_SIZE;
        const targetId = r * GRID_SIZE + c;
        const piece = this._pieces.find(p => p.id === targetId);

        if (piece && piece.isPlaced) {
          // 已放置 → 显示颜色块
          ctx.fillStyle = this.getPatternColor(targetId);
          ctx.fillRect(x + 2, y + 2, PIECE_SIZE - 4, PIECE_SIZE - 4);
          // 正确放置标记
          ctx.fillStyle = PLACED_CORRECT_COLOR;
          ctx.fillRect(x + 2, y + 2, PIECE_SIZE - 4, PIECE_SIZE - 4);
        } else {
          // 空槽位
          ctx.fillStyle = EMPTY_SLOT_COLOR;
          ctx.fillRect(x + 2, y + 2, PIECE_SIZE - 4, PIECE_SIZE - 4);
          // 显示目标编号
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.font = NUMBER_FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(targetId + 1), x + PIECE_SIZE / 2, y + PIECE_SIZE / 2);
        }
      }
    }

    // 拼图区域光标
    if (this._cursorInPuzzle && this._status === 'playing') {
      const cx = areaX + this._puzzleCursorCol * PIECE_SIZE;
      const cy = areaY + this._puzzleCursorRow * PIECE_SIZE;
      ctx.strokeStyle = this._selectedPieceId !== -1 ? SELECTED_COLOR : CURSOR_COLOR;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx + 1, cy + 1, PIECE_SIZE - 2, PIECE_SIZE - 2);
    }
  }

  /**
   * 渲染碎片区域
   */
  private renderPieceArea(ctx: CanvasRenderingContext2D, _w: number): void {
    const startX = PIECE_AREA_PADDING_X;
    const startY = PIECE_AREA_Y + PIECE_AREA_PADDING_Y;

    // 渲染碎片
    for (const piece of this._pieces) {
      if (piece.isPlaced) continue;

      const x = startX + piece.areaCol * (PIECE_DISPLAY_SIZE + PIECE_AREA_GAP);
      const y = startY + piece.areaRow * (PIECE_DISPLAY_SIZE + PIECE_AREA_GAP);

      // 碎片颜色
      ctx.fillStyle = this.getPatternColor(piece.id);
      ctx.beginPath();
      ctx.roundRect(x, y, PIECE_DISPLAY_SIZE, PIECE_DISPLAY_SIZE, 4);
      ctx.fill();

      // 碎片边框
      ctx.strokeStyle = PIECE_BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, PIECE_DISPLAY_SIZE, PIECE_DISPLAY_SIZE, 4);
      ctx.stroke();

      // 碎片编号
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = NUMBER_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(piece.id + 1), x + PIECE_DISPLAY_SIZE / 2, y + PIECE_DISPLAY_SIZE / 2);

      // 选中高亮
      if (piece.id === this._selectedPieceId) {
        ctx.strokeStyle = SELECTED_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x - 1, y - 1, PIECE_DISPLAY_SIZE + 2, PIECE_DISPLAY_SIZE + 2, 5);
        ctx.stroke();
      }
    }

    // 碎片区域光标（仅当未选中碎片且不在拼图区域时显示）
    if (!this._cursorInPuzzle && this._selectedPieceId === -1 && this._status === 'playing') {
      const cx = startX + this._cursorCol * (PIECE_DISPLAY_SIZE + PIECE_AREA_GAP);
      const cy = startY + this._cursorRow * (PIECE_DISPLAY_SIZE + PIECE_AREA_GAP);
      ctx.strokeStyle = CURSOR_COLOR;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 1, cy - 1, PIECE_DISPLAY_SIZE + 2, PIECE_DISPLAY_SIZE + 2);
    }
  }

  /**
   * 渲染完成提示
   */
  private renderWinOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#00ff88';
    ctx.font = WIN_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎉 拼图完成！', w / 2, h / 2 - 30);

    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.font = HUD_FONT;
    ctx.fillText(`${this._moveCount} 步 · ${this.formatTime(this._elapsedTime)}`, w / 2, h / 2 + 10);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = PROGRESS_FONT;
    ctx.fillText('按 Space 再来一局 · R 重置', w / 2, h / 2 + 45);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * 格式化时间
   */
  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
