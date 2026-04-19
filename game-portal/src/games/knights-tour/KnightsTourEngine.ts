/**
 * KnightsTourEngine — 骑士巡游游戏引擎
 *
 * 目标：国际象棋马走日字（L 形移动），尝试遍历棋盘每一格恰好一次。
 * - 点击/方向键+回车选择起始格
 * - 马走日字（L 形移动）：显示可走位置
 * - 已走过的格子标记步数
 * - 走到死胡同（无可用位置）则游戏失败
 * - 遍历全部格子则胜利
 * - 提示功能：Warnsdorff 启发式（优先走向出口最少的格子）
 * - 撤销功能（回退一步）
 * - 计时和步数统计
 */
import { GameEngine } from '@/core/GameEngine';
import {
  DEFAULT_BOARD_SIZE,
  MIN_BOARD_SIZE,
  MAX_BOARD_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BG_COLOR,
  BOARD_LIGHT_COLOR,
  BOARD_DARK_COLOR,
  KNIGHT_COLOR,
  KNIGHT_STROKE_COLOR,
  VISITED_LIGHT_COLOR,
  VISITED_DARK_COLOR,
  MOVEABLE_COLOR,
  MOVEABLE_BORDER_COLOR,
  HINT_COLOR,
  HINT_BORDER_COLOR,
  CURSOR_COLOR,
  CURSOR_BORDER_COLOR,
  DEAD_END_COLOR,
  WIN_COLOR,
  LOSE_COLOR,
  HUD_COLOR,
  HINT_TEXT_COLOR,
  STEP_NUMBER_COLOR,
  POINTS_PER_STEP,
  WIN_BONUS,
  HINT_PENALTY,
  KNIGHT_SYMBOL,
  KNIGHT_MOVES,
  BOARD_OFFSET_Y,
  calcBoardOffsetX,
  calcCellSize,
} from './constants';

// ========== 类型 ==========

/** 游戏阶段 */
export type GamePhase = 'selectStart' | 'playing' | 'won' | 'lost';

/** 棋盘单元格：-1 = 未访问, >= 1 = 步数 */
export type CellValue = number;

/** 移动历史条目 */
export interface MoveRecord {
  row: number;
  col: number;
  step: number;
}

// ========== KnightsTourEngine ==========

export class KnightsTourEngine extends GameEngine {
  // 棋盘状态
  private _board: CellValue[][] = [];
  private _boardSize: number = DEFAULT_BOARD_SIZE;
  private _knightRow: number = -1;
  private _knightCol: number = -1;
  private _stepCount: number = 0;
  private _totalCells: number = 0;
  private _phase: GamePhase = 'selectStart';
  private _isWin: boolean = false;

  // 光标（用于 selectStart 阶段和选择可走位置）
  private _cursorRow: number = 0;
  private _cursorCol: number = 0;

  // 可走位置列表
  private _moveablePositions: Array<[number, number]> = [];
  private _selectedMoveIndex: number = 0;

  // 提示
  private _hintPosition: [number, number] | null = null;
  private _hintActive: boolean = false;

  // 移动历史（用于撤销）
  private _moveHistory: MoveRecord[] = [];

  // ========== Public Getters ==========

  get boardSize(): number { return this._boardSize; }
  get knightRow(): number { return this._knightRow; }
  get knightCol(): number { return this._knightCol; }
  get stepCount(): number { return this._stepCount; }
  get totalCells(): number { return this._totalCells; }
  get phase(): GamePhase { return this._phase; }
  get isWin(): boolean { return this._isWin; }
  get cursorRow(): number { return this._cursorRow; }
  get cursorCol(): number { return this._cursorCol; }
  get moveablePositions(): Array<[number, number]> { return [...this._moveablePositions]; }
  get selectedMoveIndex(): number { return this._selectedMoveIndex; }
  get hintPosition(): [number, number] | null { return this._hintPosition; }
  get hintActive(): boolean { return this._hintActive; }
  get moveHistory(): MoveRecord[] { return [...this._moveHistory]; }

  /** 获取棋盘快照（只读） */
  getBoard(): CellValue[][] {
    return this._board.map(row => [...row]);
  }

  /** 获取当前格子大小 */
  get cellSize(): number {
    return calcCellSize(this._boardSize);
  }

  /** 获取棋盘偏移X */
  get boardOffsetX(): number {
    return calcBoardOffsetX(this._boardSize);
  }

  /** 剩余未访问的格子数 */
  get remainingCells(): number {
    return this._totalCells - this._stepCount;
  }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._boardSize = DEFAULT_BOARD_SIZE;
    this._totalCells = this._boardSize * this._boardSize;
    this._board = this.createEmptyBoard();
    this._knightRow = -1;
    this._knightCol = -1;
    this._stepCount = 0;
    this._phase = 'selectStart';
    this._isWin = false;
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._moveablePositions = [];
    this._selectedMoveIndex = 0;
    this._hintPosition = null;
    this._hintActive = false;
    this._moveHistory = [];
  }

  protected onStart(): void {
    this._board = this.createEmptyBoard();
    this._knightRow = -1;
    this._knightCol = -1;
    this._stepCount = 0;
    this._phase = 'selectStart';
    this._isWin = false;
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._moveablePositions = [];
    this._selectedMoveIndex = 0;
    this._hintPosition = null;
    this._hintActive = false;
    this._moveHistory = [];
  }

  protected update(_deltaTime: number): void {
    // 回合制游戏，update 主要用于计时
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD 信息
    this.renderHUD(ctx, w);

    // 棋盘
    this.renderBoard(ctx);

    // 已访问格子（步数标记）
    this.renderVisited(ctx);

    // 可走位置
    if (this._phase === 'playing') {
      this.renderMoveable(ctx);
    }

    // 提示高亮
    if (this._hintActive && this._hintPosition) {
      this.renderHint(ctx);
    }

    // 光标（selectStart 阶段）
    if (this._phase === 'selectStart') {
      this.renderCursor(ctx);
    }

    // 骑士
    if (this._knightRow >= 0 && this._knightCol >= 0) {
      this.renderKnight(ctx);
    }

    // 选中可走位置指示器
    if (this._phase === 'playing' && this._moveablePositions.length > 0) {
      this.renderSelectedMove(ctx);
    }

    // 底部信息
    this.renderFooter(ctx, w, h);

    // 胜利/失败画面
    if (this._phase === 'won') {
      this.renderWinScreen(ctx, w, h);
    } else if (this._phase === 'lost') {
      this.renderLoseScreen(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._board = this.createEmptyBoard();
    this._knightRow = -1;
    this._knightCol = -1;
    this._stepCount = 0;
    this._phase = 'selectStart';
    this._isWin = false;
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._moveablePositions = [];
    this._selectedMoveIndex = 0;
    this._hintPosition = null;
    this._hintActive = false;
    this._moveHistory = [];
  }

  protected onGameOver(): void {
    // 游戏结束回调
  }

  handleKeyDown(key: string): void {
    if (this._status === 'idle') {
      if (key === ' ' || key === 'Enter') {
        this.start();
        return;
      }
    }

    if (this._status === 'gameover') {
      if (key === ' ' || key === 'Enter') {
        this.reset();
        this.start();
        return;
      }
      if (key === 'n' || key === 'N') {
        this.newGame();
        return;
      }
      return;
    }

    if (this._status !== 'playing') return;

    // R 键重新开始
    if (key === 'r' || key === 'R') {
      this.reset();
      this.start();
      return;
    }

    // N 键新游戏
    if (key === 'n' || key === 'N') {
      this.newGame();
      return;
    }

    // 选择起始位置阶段
    if (this._phase === 'selectStart') {
      this.handleSelectStartKey(key);
      return;
    }

    // 游戏进行中
    if (this._phase === 'playing') {
      this.handlePlayingKey(key);
      return;
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要持续按键处理
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      boardSize: this._boardSize,
      knightRow: this._knightRow,
      knightCol: this._knightCol,
      stepCount: this._stepCount,
      totalCells: this._totalCells,
      phase: this._phase,
      isWin: this._isWin,
      cursorRow: this._cursorRow,
      cursorCol: this._cursorCol,
      moveablePositions: this._moveablePositions,
      selectedMoveIndex: this._selectedMoveIndex,
      hintActive: this._hintActive,
      hintPosition: this._hintPosition,
      moveHistory: this._moveHistory,
      board: this.getBoard(),
    };
  }

  // ========== 公开方法（供测试和外部调用） ==========

  /** 设置棋盘大小（仅在 selectStart 阶段有效） */
  setBoardSize(size: number): void {
    if (size < MIN_BOARD_SIZE || size > MAX_BOARD_SIZE) return;
    if (this._phase !== 'selectStart') return;
    this._boardSize = size;
    this._totalCells = size * size;
    this._board = this.createEmptyBoard();
    this._cursorRow = Math.min(this._cursorRow, size - 1);
    this._cursorCol = Math.min(this._cursorCol, size - 1);
  }

  /** 检查位置是否在棋盘内 */
  isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this._boardSize && col >= 0 && col < this._boardSize;
  }

  /** 检查位置是否未访问 */
  isUnvisited(row: number, col: number): boolean {
    if (!this.isValidPosition(row, col)) return false;
    return this._board[row][col] === -1;
  }

  /** 获取从指定位置出发的所有合法 L 形移动位置 */
  getValidMoves(row: number, col: number): Array<[number, number]> {
    const moves: Array<[number, number]> = [];
    for (const [dr, dc] of KNIGHT_MOVES) {
      const nr = row + dr;
      const nc = col + dc;
      if (this.isValidPosition(nr, nc) && this.isUnvisited(nr, nc)) {
        moves.push([nr, nc]);
      }
    }
    return moves;
  }

  /** 计算从指定位置出发可走的位置数（出口数） */
  countExits(row: number, col: number): number {
    return this.getValidMoves(row, col).length;
  }

  /** Warnsdorff 启发式：返回最优移动位置（出口最少的格子） */
  getWarnsdorffBest(): [number, number] | null {
    if (this._moveablePositions.length === 0) return null;

    let bestPos: [number, number] | null = null;
    let minExits = Infinity;

    for (const [r, c] of this._moveablePositions) {
      // 临时标记为已访问，计算从该位置出发的出口数
      this._board[r][c] = this._stepCount + 1;
      const exits = this.countExits(r, c);
      this._board[r][c] = -1; // 恢复

      if (exits < minExits) {
        minExits = exits;
        bestPos = [r, c];
      }
    }

    return bestPos;
  }

  /** 选择起始位置 */
  selectStartPosition(row: number, col: number): boolean {
    if (this._phase !== 'selectStart') return false;
    if (!this.isValidPosition(row, col)) return false;

    this._knightRow = row;
    this._knightCol = col;
    this._stepCount = 1;
    this._board[row][col] = 1;
    this._phase = 'playing';
    this._moveHistory = [{ row, col, step: 1 }];

    // 计算可走位置
    this._moveablePositions = this.getValidMoves(row, col);
    this._selectedMoveIndex = 0;

    // 检查是否立即死胡同
    if (this._moveablePositions.length === 0 && this._totalCells > 1) {
      this._phase = 'lost';
      this._isWin = false;
      this.gameOver();
      return true;
    }

    // 检查是否直接胜利（1x1 棋盘）
    if (this._stepCount === this._totalCells) {
      this._phase = 'won';
      this._isWin = true;
      this.addScore(WIN_BONUS);
      this.gameOver();
      return true;
    }

    this.addScore(POINTS_PER_STEP);
    this.emit('knightPlaced', { row, col });
    return true;
  }

  /** 移动骑士到指定位置 */
  moveKnight(row: number, col: number): boolean {
    if (this._phase !== 'playing') return false;
    if (this._knightRow < 0) return false;

    // 检查是否为合法移动
    const isValidMove = this._moveablePositions.some(
      ([r, c]) => r === row && c === col
    );
    if (!isValidMove) return false;

    // 执行移动
    this._knightRow = row;
    this._knightCol = col;
    this._stepCount++;
    this._board[row][col] = this._stepCount;
    this._moveHistory.push({ row, col, step: this._stepCount });

    // 清除提示
    this._hintPosition = null;
    this._hintActive = false;

    // 检查胜利
    if (this._stepCount === this._totalCells) {
      this._phase = 'won';
      this._isWin = true;
      this.addScore(WIN_BONUS);
      this.gameOver();
      return true;
    }

    // 计算新的可走位置
    this._moveablePositions = this.getValidMoves(row, col);
    this._selectedMoveIndex = 0;

    // 检查死胡同
    if (this._moveablePositions.length === 0) {
      this._phase = 'lost';
      this._isWin = false;
      this.gameOver();
      return true;
    }

    this.addScore(POINTS_PER_STEP);
    this.emit('knightMoved', { row, col, step: this._stepCount });
    return true;
  }

  /** 撤销上一步移动 */
  undoMove(): boolean {
    if (this._phase !== 'playing') return false;
    if (this._moveHistory.length <= 1) return false; // 不能撤销起始位置

    // 如果游戏已经结束（lost），允许撤销恢复
    // 但由于 phase 已经不是 playing，这里无法到达
    // 所以 undoMove 只在 playing 阶段有效

    // 移除最后一步
    const lastMove = this._moveHistory.pop()!;
    this._board[lastMove.row][lastMove.col] = -1;
    this._stepCount--;

    // 恢复骑士位置到上一步
    const prevMove = this._moveHistory[this._moveHistory.length - 1];
    this._knightRow = prevMove.row;
    this._knightCol = prevMove.col;

    // 重新计算可走位置
    this._moveablePositions = this.getValidMoves(this._knightRow, this._knightCol);
    this._selectedMoveIndex = 0;

    // 清除提示
    this._hintPosition = null;
    this._hintActive = false;

    // 调整分数
    this.addScore(-POINTS_PER_STEP);

    this.emit('moveUndone', { row: prevMove.row, col: prevMove.col, step: this._stepCount });
    return true;
  }

  /** 显示提示（Warnsdorff 最优位置） */
  showHint(): [number, number] | null {
    if (this._phase !== 'playing') return null;
    if (this._moveablePositions.length === 0) return null;

    const best = this.getWarnsdorffBest();
    if (best) {
      this._hintPosition = best;
      this._hintActive = true;
      this.addScore(-HINT_PENALTY);
      this.emit('hintShown', best);
    }
    return best;
  }

  /** 隐藏提示 */
  hideHint(): void {
    this._hintPosition = null;
    this._hintActive = false;
  }

  /** 新游戏（保持当前棋盘大小） */
  newGame(): void {
    const size = this._boardSize;
    this.reset();
    this._boardSize = size;
    this._totalCells = size * size;
    this._board = this.createEmptyBoard();
    this.start();
  }

  /** 获取指定位置的单元格值 */
  getCellValue(row: number, col: number): CellValue {
    if (!this.isValidPosition(row, col)) return 0;
    return this._board[row][col];
  }

  /** 检查是否可以从当前位置到达目标位置（L 形移动） */
  isKnightMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const dr = Math.abs(toRow - fromRow);
    const dc = Math.abs(toCol - fromCol);
    return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
  }

  /** 获取 Warnsdorff 排序后的可走位置（从优到劣） */
  getWarnsdorffSorted(): Array<[number, number]> {
    if (this._moveablePositions.length === 0) return [];

    const scored = this._moveablePositions.map(([r, c]) => {
      this._board[r][c] = this._stepCount + 1;
      const exits = this.countExits(r, c);
      this._board[r][c] = -1;
      return { pos: [r, c] as [number, number], exits };
    });

    scored.sort((a, b) => a.exits - b.exits);
    return scored.map(s => s.pos);
  }

  // ========== Private Methods ==========

  /** 创建空棋盘（所有格子为 -1 表示未访问） */
  private createEmptyBoard(): CellValue[][] {
    return Array.from({ length: this._boardSize }, () =>
      Array.from({ length: this._boardSize }, () => -1 as CellValue)
    );
  }

  /** 处理选择起始位置的按键 */
  private handleSelectStartKey(key: string): void {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.moveCursor(-1, 0);
    } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
      this.moveCursor(1, 0);
    } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      this.moveCursor(0, -1);
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      this.moveCursor(0, 1);
    } else if (key === ' ' || key === 'Enter') {
      this.selectStartPosition(this._cursorRow, this._cursorCol);
    } else if (key === '1') {
      this.setBoardSize(5);
    } else if (key === '2') {
      this.setBoardSize(6);
    } else if (key === '3') {
      this.setBoardSize(8);
    }
  }

  /** 处理游戏进行中的按键 */
  private handlePlayingKey(key: string): void {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.navigateMoves(-1);
    } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
      this.navigateMoves(1);
    } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      this.navigateMoves(-1);
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      this.navigateMoves(1);
    } else if (key === ' ' || key === 'Enter') {
      // 确认移动到当前选中的可走位置
      if (this._moveablePositions.length > 0) {
        const [r, c] = this._moveablePositions[this._selectedMoveIndex];
        this.moveKnight(r, c);
      }
    } else if (key === 'h' || key === 'H') {
      this.showHint();
    } else if (key === 'u' || key === 'U') {
      this.undoMove();
    }
  }

  /** 移动光标（selectStart 阶段） */
  private moveCursor(dRow: number, dCol: number): void {
    const newRow = this._cursorRow + dRow;
    const newCol = this._cursorCol + dCol;
    if (this.isValidPosition(newRow, newCol)) {
      this._cursorRow = newRow;
      this._cursorCol = newCol;
    }
  }

  /** 在可走位置间导航 */
  private navigateMoves(direction: number): void {
    if (this._moveablePositions.length === 0) return;
    this._selectedMoveIndex = (this._selectedMoveIndex + direction + this._moveablePositions.length) % this._moveablePositions.length;
  }

  // ========== 渲染方法 ==========

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';

    // 标题
    ctx.fillText(`Knight's Tour (${this._boardSize}×${this._boardSize})`, w / 2, 24);

    // 步数
    ctx.font = '14px monospace';
    ctx.fillText(
      `Steps: ${this._stepCount} / ${this._totalCells}`,
      w / 2,
      48
    );

    // 阶段提示
    ctx.font = '12px monospace';
    ctx.fillStyle = HINT_TEXT_COLOR;
    if (this._phase === 'selectStart') {
      ctx.fillText('Arrow/WASD: Move | Space/Enter: Place Knight | 1:5×5  2:6×6  3:8×8', w / 2, 70);
    } else if (this._phase === 'playing') {
      ctx.fillText('↑↓: Select | Space: Move | H: Hint | U: Undo | R: Restart', w / 2, 70);
    }

    // 分数
    ctx.fillStyle = '#ffd700';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${this._score}`, w - 20, 24);

    // 时间
    ctx.fillStyle = HINT_TEXT_COLOR;
    ctx.fillText(`Time: ${Math.floor(this._elapsedTime)}s`, w - 20, 42);

    ctx.textAlign = 'left';
  }

  private renderBoard(ctx: CanvasRenderingContext2D): void {
    const cs = this.cellSize;
    const ox = this.boardOffsetX;
    const oy = BOARD_OFFSET_Y;

    for (let r = 0; r < this._boardSize; r++) {
      for (let c = 0; c < this._boardSize; c++) {
        const x = ox + c * cs;
        const y = oy + r * cs;

        if (this._board[r][c] === -1) {
          ctx.fillStyle = (r + c) % 2 === 0 ? BOARD_LIGHT_COLOR : BOARD_DARK_COLOR;
        } else {
          ctx.fillStyle = (r + c) % 2 === 0 ? VISITED_LIGHT_COLOR : VISITED_DARK_COLOR;
        }
        ctx.fillRect(x, y, cs, cs);
      }
    }

    // 棋盘边框
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, this._boardSize * cs, this._boardSize * cs);
  }

  private renderVisited(ctx: CanvasRenderingContext2D): void {
    const cs = this.cellSize;
    const ox = this.boardOffsetX;
    const oy = BOARD_OFFSET_Y;

    for (let r = 0; r < this._boardSize; r++) {
      for (let c = 0; c < this._boardSize; c++) {
        const val = this._board[r][c];
        if (val > 0) {
          const x = ox + c * cs + cs / 2;
          const y = oy + r * cs + cs / 2;

          ctx.fillStyle = STEP_NUMBER_COLOR;
          ctx.font = `bold ${Math.max(cs * 0.35, 10)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(val), x, y);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }
    }
  }

  private renderMoveable(ctx: CanvasRenderingContext2D): void {
    const cs = this.cellSize;
    const ox = this.boardOffsetX;
    const oy = BOARD_OFFSET_Y;

    for (const [r, c] of this._moveablePositions) {
      const x = ox + c * cs;
      const y = oy + r * cs;

      ctx.fillStyle = MOVEABLE_COLOR;
      ctx.fillRect(x, y, cs, cs);

      ctx.strokeStyle = MOVEABLE_BORDER_COLOR;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
    }
  }

  private renderHint(ctx: CanvasRenderingContext2D): void {
    if (!this._hintPosition) return;
    const cs = this.cellSize;
    const ox = this.boardOffsetX;
    const oy = BOARD_OFFSET_Y;
    const [r, c] = this._hintPosition;

    const x = ox + c * cs;
    const y = oy + r * cs;

    ctx.fillStyle = HINT_COLOR;
    ctx.fillRect(x, y, cs, cs);

    ctx.strokeStyle = HINT_BORDER_COLOR;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, cs - 3, cs - 3);
  }

  private renderCursor(ctx: CanvasRenderingContext2D): void {
    const cs = this.cellSize;
    const ox = this.boardOffsetX;
    const oy = BOARD_OFFSET_Y;

    const x = ox + this._cursorCol * cs;
    const y = oy + this._cursorRow * cs;

    ctx.fillStyle = CURSOR_COLOR;
    ctx.fillRect(x, y, cs, cs);

    ctx.strokeStyle = CURSOR_BORDER_COLOR;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, cs - 3, cs - 3);
  }

  private renderKnight(ctx: CanvasRenderingContext2D): void {
    const cs = this.cellSize;
    const ox = this.boardOffsetX;
    const oy = BOARD_OFFSET_Y;

    const x = ox + this._knightCol * cs + cs / 2;
    const y = oy + this._knightRow * cs + cs / 2;

    // 骑士背景高亮
    ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.fillRect(ox + this._knightCol * cs, oy + this._knightRow * cs, cs, cs);

    ctx.fillStyle = KNIGHT_COLOR;
    ctx.font = `bold ${Math.max(cs * 0.7, 16)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(KNIGHT_SYMBOL, x, y);

    ctx.strokeStyle = KNIGHT_STROKE_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeText(KNIGHT_SYMBOL, x, y);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private renderSelectedMove(ctx: CanvasRenderingContext2D): void {
    if (this._selectedMoveIndex >= this._moveablePositions.length) return;
    const [r, c] = this._moveablePositions[this._selectedMoveIndex];
    const cs = this.cellSize;
    const ox = this.boardOffsetX;
    const oy = BOARD_OFFSET_Y;

    const x = ox + c * cs;
    const y = oy + r * cs;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
    ctx.setLineDash([]);
  }

  private renderFooter(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const footerY = BOARD_OFFSET_Y + this._boardSize * this.cellSize + 20;

    ctx.fillStyle = HINT_TEXT_COLOR;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';

    if (this._phase === 'playing') {
      const remaining = this.remainingCells;
      ctx.fillText(`Remaining: ${remaining} cells`, w / 2, footerY);

      if (this._hintActive) {
        ctx.fillStyle = '#ffd700';
        ctx.fillText('💡 Hint active', w / 2, footerY + 18);
      }
    }

    ctx.textAlign = 'left';
  }

  private renderWinScreen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = WIN_COLOR;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 Tour Complete! 🎉', w / 2, h / 2 - 40);

    ctx.fillStyle = HUD_COLOR;
    ctx.font = '18px monospace';
    ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 10);
    ctx.fillText(`Steps: ${this._stepCount} / ${this._totalCells}`, w / 2, h / 2 + 40);
    ctx.fillText(`Time: ${Math.floor(this._elapsedTime)}s`, w / 2, h / 2 + 65);

    ctx.font = '14px monospace';
    ctx.fillStyle = HINT_TEXT_COLOR;
    ctx.fillText('Space: Replay | N: New Game', w / 2, h / 2 + 100);

    ctx.textAlign = 'left';
  }

  private renderLoseScreen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = LOSE_COLOR;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('💀 Dead End! 💀', w / 2, h / 2 - 40);

    ctx.fillStyle = HUD_COLOR;
    ctx.font = '18px monospace';
    ctx.fillText(`Steps: ${this._stepCount} / ${this._totalCells}`, w / 2, h / 2 + 10);
    ctx.fillText(`Time: ${Math.floor(this._elapsedTime)}s`, w / 2, h / 2 + 40);

    ctx.font = '14px monospace';
    ctx.fillStyle = HINT_TEXT_COLOR;
    ctx.fillText('Space: Retry | N: New Game | R: Restart', w / 2, h / 2 + 80);

    ctx.textAlign = 'left';
  }
}
