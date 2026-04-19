/**
 * EightQueensEngine — 八皇后游戏引擎
 *
 * 目标：在 8×8 棋盘上放置 8 个皇后，使其互不攻击。
 * - 同行、同列、同对角线上不能有两个皇后
 * - 方向键移动光标，空格/回车放置或移除皇后
 * - 实时冲突检测与安全提示
 * - 多关卡支持（含预填皇后）
 */
import { GameEngine } from '@/core/GameEngine';
import {
  BOARD_SIZE,
  CELL_SIZE,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  BG_COLOR,
  BOARD_LIGHT_COLOR,
  BOARD_DARK_COLOR,
  QUEEN_COLOR,
  QUEEN_STROKE_COLOR,
  CURSOR_COLOR,
  CURSOR_BORDER_COLOR,
  CONFLICT_COLOR,
  SAFE_COLOR,
  HUD_COLOR,
  WIN_COLOR,
  HINT_TEXT_COLOR,
  POINTS_PER_QUEEN,
  WIN_BONUS,
  HINT_PENALTY,
  MAX_LEVEL,
  LEVEL_CONFIGS,
  QUEEN_SYMBOL,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './constants';
import type { LevelConfig } from './constants';

// ========== 类型 ==========

/** 棋盘单元格状态 */
export type CellState = 0 | 1; // 0 = 空, 1 = 有皇后

/** 冲突信息 */
export interface ConflictInfo {
  hasConflict: boolean;
  conflictingCells: Array<[number, number]>; // 与当前位置冲突的皇后位置列表
}

// ========== EightQueensEngine ==========

export class EightQueensEngine extends GameEngine {
  // 棋盘状态
  private _board: CellState[][] = [];
  private _cursorRow: number = 0;
  private _cursorCol: number = 0;
  private _placedQueens: number = 0;
  private _isWon: boolean = false;
  private _hintMode: boolean = false;
  private _moveCount: number = 0;

  // 关卡
  private _currentLevelConfig: LevelConfig = LEVEL_CONFIGS[0];

  // 预填的皇后位置（不可移除）
  private _preFilledCells: Set<string> = new Set();

  // ========== Public Getters ==========

  get cursorRow(): number { return this._cursorRow; }
  get cursorCol(): number { return this._cursorCol; }
  get placedQueens(): number { return this._placedQueens; }
  get isWon(): boolean { return this._isWon; }
  get hintMode(): boolean { return this._hintMode; }
  get moveCount(): number { return this._moveCount; }
  get currentLevel(): number { return this._level; }

  /** 获取棋盘快照（只读） */
  getBoard(): CellState[][] {
    return this._board.map(row => [...row]);
  }

  /** 获取当前关卡配置 */
  get currentLevelConfig(): LevelConfig {
    return this._currentLevelConfig;
  }

  /** 获取预填位置集合 */
  get preFilledCells(): Set<string> {
    return new Set(this._preFilledCells);
  }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._board = this.createEmptyBoard();
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._placedQueens = 0;
    this._isWon = false;
    this._hintMode = false;
    this._moveCount = 0;
    this._preFilledCells = new Set();
  }

  protected onStart(): void {
    this._board = this.createEmptyBoard();
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._placedQueens = 0;
    this._isWon = false;
    this._hintMode = false;
    this._moveCount = 0;
    this._preFilledCells = new Set();

    // 加载关卡配置
    const levelIndex = Math.min(this._level - 1, LEVEL_CONFIGS.length - 1);
    this._currentLevelConfig = LEVEL_CONFIGS[levelIndex];

    // 放置预填皇后
    if (this._currentLevelConfig.preFilled) {
      for (const [row, col] of this._currentLevelConfig.preFilled) {
        if (this.isValidPosition(row, col)) {
          this._board[row][col] = 1;
          this._preFilledCells.add(`${row},${col}`);
          this._placedQueens++;
        }
      }
    }
  }

  protected update(_deltaTime: number): void {
    // 八皇后是回合制游戏，update 主要用于计时
    // 实际逻辑在 handleKeyDown 中处理
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD 信息
    this.renderHUD(ctx, w);

    // 棋盘
    this.renderBoard(ctx);

    // 冲突高亮
    this.renderConflicts(ctx);

    // 安全提示
    if (this._hintMode) {
      this.renderSafeHints(ctx);
    }

    // 光标
    this.renderCursor(ctx);

    // 皇后
    this.renderQueens(ctx);

    // 胜利画面
    if (this._status === 'gameover' && this._isWon) {
      this.renderWinScreen(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._board = this.createEmptyBoard();
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._placedQueens = 0;
    this._isWon = false;
    this._hintMode = false;
    this._moveCount = 0;
    this._preFilledCells = new Set();
  }

  protected onGameOver(): void {
    // 胜利时的回调
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
      // N 键进入下一关
      if (key === 'n' || key === 'N') {
        this.nextLevel();
        return;
      }
      return;
    }

    if (this._status !== 'playing') return;

    // 方向键移动光标
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.moveCursor(-1, 0);
    } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
      this.moveCursor(1, 0);
    } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      this.moveCursor(0, -1);
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      this.moveCursor(0, 1);
    }
    // 空格/回车 放置或移除皇后
    else if (key === ' ' || key === 'Enter') {
      this.toggleQueen();
    }
    // H 键切换提示模式
    else if (key === 'h' || key === 'H') {
      this.toggleHintMode();
    }
    // R 键重新开始当前关卡
    else if (key === 'r' || key === 'R') {
      this.restartLevel();
    }
  }

  handleKeyUp(_key: string): void {
    // 八皇后不需要持续按键处理
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      cursorRow: this._cursorRow,
      cursorCol: this._cursorCol,
      placedQueens: this._placedQueens,
      isWon: this._isWon,
      hintMode: this._hintMode,
      moveCount: this._moveCount,
      board: this.getBoard(),
      preFilledCells: [...this._preFilledCells],
      currentLevel: this._currentLevelConfig.level,
      currentLevelName: this._currentLevelConfig.name,
    };
  }

  // ========== 公开方法（供测试和外部调用） ==========

  /** 检测指定位置是否安全（不与任何已放置的皇后冲突） */
  isSafe(row: number, col: number): boolean {
    if (!this.isValidPosition(row, col)) return false;

    // 检查同行
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (c !== col && this._board[row][c] === 1) return false;
    }

    // 检查同列
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (r !== row && this._board[r][col] === 1) return false;
    }

    // 检查左上对角线
    for (let r = row - 1, c = col - 1; r >= 0 && c >= 0; r--, c--) {
      if (this._board[r][c] === 1) return false;
    }

    // 检查右下对角线
    for (let r = row + 1, c = col + 1; r < BOARD_SIZE && c < BOARD_SIZE; r++, c++) {
      if (this._board[r][c] === 1) return false;
    }

    // 检查右上对角线
    for (let r = row - 1, c = col + 1; r >= 0 && c < BOARD_SIZE; r--, c++) {
      if (this._board[r][c] === 1) return false;
    }

    // 检查左下对角线
    for (let r = row + 1, c = col - 1; r < BOARD_SIZE && c >= 0; r++, c--) {
      if (this._board[r][c] === 1) return false;
    }

    return true;
  }

  /** 获取指定位置的冲突信息 */
  getConflictInfo(row: number, col: number): ConflictInfo {
    const conflictingCells: Array<[number, number]> = [];

    if (!this.isValidPosition(row, col)) {
      return { hasConflict: false, conflictingCells };
    }

    // 同行
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (c !== col && this._board[row][c] === 1) {
        conflictingCells.push([row, c]);
      }
    }

    // 同列
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (r !== row && this._board[r][col] === 1) {
        conflictingCells.push([r, col]);
      }
    }

    // 左上对角线
    for (let r = row - 1, c = col - 1; r >= 0 && c >= 0; r--, c--) {
      if (this._board[r][c] === 1) conflictingCells.push([r, c]);
    }

    // 右下对角线
    for (let r = row + 1, c = col + 1; r < BOARD_SIZE && c < BOARD_SIZE; r++, c++) {
      if (this._board[r][c] === 1) conflictingCells.push([r, c]);
    }

    // 右上对角线
    for (let r = row - 1, c = col + 1; r >= 0 && c < BOARD_SIZE; r--, c++) {
      if (this._board[r][c] === 1) conflictingCells.push([r, c]);
    }

    // 左下对角线
    for (let r = row + 1, c = col - 1; r < BOARD_SIZE && c >= 0; r++, c--) {
      if (this._board[r][c] === 1) conflictingCells.push([r, c]);
    }

    return {
      hasConflict: conflictingCells.length > 0,
      conflictingCells,
    };
  }

  /** 检查整个棋盘是否有冲突 */
  hasAnyConflict(): boolean {
    const queens: Array<[number, number]> = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] === 1) {
          queens.push([r, c]);
        }
      }
    }

    for (let i = 0; i < queens.length; i++) {
      for (let j = i + 1; j < queens.length; j++) {
        if (this.areQueensConflicting(queens[i], queens[j])) {
          return true;
        }
      }
    }
    return false;
  }

  /** 获取所有冲突的皇后对 */
  getAllConflicts(): Array<[[number, number], [number, number]]> {
    const queens: Array<[number, number]> = [];
    const conflicts: Array<[[number, number], [number, number]]> = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] === 1) {
          queens.push([r, c]);
        }
      }
    }

    for (let i = 0; i < queens.length; i++) {
      for (let j = i + 1; j < queens.length; j++) {
        if (this.areQueensConflicting(queens[i], queens[j])) {
          conflicts.push([queens[i], queens[j]]);
        }
      }
    }

    return conflicts;
  }

  /** 切换到下一关 */
  nextLevel(): void {
    if (this._level < MAX_LEVEL) {
      const nextLvl = this._level + 1;
      this.reset();
      this.start();
      // start() resets _level to 1, so we must set it after and reload config
      this._level = nextLvl;
      this._currentLevelConfig = LEVEL_CONFIGS[Math.min(nextLvl - 1, LEVEL_CONFIGS.length - 1)];
      // Re-place pre-filled queens for the correct level
      this._board = this.createEmptyBoard();
      this._placedQueens = 0;
      this._preFilledCells = new Set();
      if (this._currentLevelConfig.preFilled) {
        for (const [row, col] of this._currentLevelConfig.preFilled) {
          if (this.isValidPosition(row, col)) {
            this._board[row][col] = 1;
            this._preFilledCells.add(`${row},${col}`);
            this._placedQueens++;
          }
        }
      }
    }
  }

  /** 重新开始当前关卡 */
  restartLevel(): void {
    this.reset();
    this.start();
  }

  /** 检查位置是否有效 */
  isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  /** 检查指定位置是否为预填皇后 */
  isPreFilled(row: number, col: number): boolean {
    return this._preFilledCells.has(`${row},${col}`);
  }

  /** 获取指定位置的单元格状态 */
  getCellState(row: number, col: number): CellState {
    if (!this.isValidPosition(row, col)) return 0;
    return this._board[row][col];
  }

  /** 获取所有安全位置 */
  getSafeCells(): Array<[number, number]> {
    const safeCells: Array<[number, number]> = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] === 0 && this.isSafe(r, c)) {
          safeCells.push([r, c]);
        }
      }
    }
    return safeCells;
  }

  /** 获取所有已放置皇后的位置 */
  getQueenPositions(): Array<[number, number]> {
    const positions: Array<[number, number]> = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] === 1) {
          positions.push([r, c]);
        }
      }
    }
    return positions;
  }

  /** 计算剩余需要放置的皇后数 */
  get remainingQueens(): number {
    return BOARD_SIZE - this._placedQueens;
  }

  // ========== Private Methods ==========

  /** 创建空棋盘 */
  private createEmptyBoard(): CellState[][] {
    return Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => 0 as CellState)
    );
  }

  /** 移动光标 */
  private moveCursor(dRow: number, dCol: number): void {
    const newRow = this._cursorRow + dRow;
    const newCol = this._cursorCol + dCol;
    if (this.isValidPosition(newRow, newCol)) {
      this._cursorRow = newRow;
      this._cursorCol = newCol;
    }
  }

  /** 在光标位置放置或移除皇后 */
  private toggleQueen(): void {
    const row = this._cursorRow;
    const col = this._cursorCol;

    // 预填皇后不可移除
    if (this.isPreFilled(row, col)) return;

    if (this._board[row][col] === 1) {
      // 移除皇后
      this._board[row][col] = 0;
      this._placedQueens--;
      this._moveCount++;
      this.emit('queenRemoved', { row, col });
    } else {
      // 放置皇后
      this._board[row][col] = 1;
      this._placedQueens++;
      this._moveCount++;
      this.addScore(POINTS_PER_QUEEN);
      this.emit('queenPlaced', { row, col });

      // 检查是否胜利
      if (this._placedQueens === BOARD_SIZE && !this.hasAnyConflict()) {
        this._isWon = true;
        this.addScore(WIN_BONUS);
        this.gameOver();
      }
    }
  }

  /** 切换提示模式 */
  private toggleHintMode(): void {
    this._hintMode = !this._hintMode;
    if (this._hintMode) {
      // 提示模式有少量扣分
      this.addScore(-HINT_PENALTY);
    }
    this.emit('hintModeChanged', this._hintMode);
  }

  /** 检查两个皇后是否互相攻击 */
  private areQueensConflicting(
    pos1: [number, number],
    pos2: [number, number]
  ): boolean {
    const [r1, c1] = pos1;
    const [r2, c2] = pos2;

    // 同行
    if (r1 === r2) return true;
    // 同列
    if (c1 === c2) return true;
    // 同对角线（|dr| == |dc|）
    if (Math.abs(r1 - r2) === Math.abs(c1 - c2)) return true;

    return false;
  }

  // ========== 渲染方法 ==========

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';

    // 关卡名称
    ctx.fillText(
      `Level ${this._level}: ${this._currentLevelConfig.name}`,
      w / 2,
      24
    );

    // 皇后计数
    ctx.font = '14px monospace';
    ctx.fillText(
      `Queens: ${this._placedQueens} / ${BOARD_SIZE}`,
      w / 2,
      48
    );

    // 操作提示
    ctx.font = '12px monospace';
    ctx.fillStyle = HINT_TEXT_COLOR;
    ctx.fillText(
      'Arrow/WASD: Move | Space/Enter: Place | H: Hint | R: Restart',
      w / 2,
      70
    );

    if (this._hintMode) {
      ctx.fillStyle = SAFE_COLOR.replace('0.3', '1');
      ctx.fillText('💡 Hint Mode ON', w / 2, 86);
    }

    ctx.textAlign = 'left';
  }

  private renderBoard(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = BOARD_OFFSET_X + c * CELL_SIZE;
        const y = BOARD_OFFSET_Y + r * CELL_SIZE;

        ctx.fillStyle = (r + c) % 2 === 0 ? BOARD_LIGHT_COLOR : BOARD_DARK_COLOR;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }

    // 棋盘边框
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      BOARD_OFFSET_X,
      BOARD_OFFSET_Y,
      BOARD_SIZE * CELL_SIZE,
      BOARD_SIZE * CELL_SIZE
    );
  }

  private renderConflicts(ctx: CanvasRenderingContext2D): void {
    const conflicts = this.getAllConflicts();
    const conflictSet = new Set<string>();

    for (const [[r1, c1], [r2, c2]] of conflicts) {
      conflictSet.add(`${r1},${c1}`);
      conflictSet.add(`${r2},${c2}`);
    }

    for (const key of conflictSet) {
      const [r, c] = key.split(',').map(Number);
      const x = BOARD_OFFSET_X + c * CELL_SIZE;
      const y = BOARD_OFFSET_Y + r * CELL_SIZE;

      ctx.fillStyle = CONFLICT_COLOR;
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    }
  }

  private renderSafeHints(ctx: CanvasRenderingContext2D): void {
    const safeCells = this.getSafeCells();
    for (const [r, c] of safeCells) {
      const x = BOARD_OFFSET_X + c * CELL_SIZE;
      const y = BOARD_OFFSET_Y + r * CELL_SIZE;

      ctx.fillStyle = SAFE_COLOR;
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    }
  }

  private renderCursor(ctx: CanvasRenderingContext2D): void {
    const x = BOARD_OFFSET_X + this._cursorCol * CELL_SIZE;
    const y = BOARD_OFFSET_Y + this._cursorRow * CELL_SIZE;

    ctx.fillStyle = CURSOR_COLOR;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

    ctx.strokeStyle = CURSOR_BORDER_COLOR;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);
  }

  private renderQueens(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] === 1) {
          const x = BOARD_OFFSET_X + c * CELL_SIZE + CELL_SIZE / 2;
          const y = BOARD_OFFSET_Y + r * CELL_SIZE + CELL_SIZE / 2;

          // 皇后符号
          ctx.fillStyle = QUEEN_COLOR;
          ctx.font = `bold ${CELL_SIZE * 0.7}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(QUEEN_SYMBOL, x, y);

          // 描边
          ctx.strokeStyle = QUEEN_STROKE_COLOR;
          ctx.lineWidth = 1;
          ctx.strokeText(QUEEN_SYMBOL, x, y);

          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      }
    }
  }

  private renderWinScreen(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = WIN_COLOR;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 Victory! 🎉', w / 2, h / 2 - 40);

    ctx.fillStyle = HUD_COLOR;
    ctx.font = '18px monospace';
    ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 10);
    ctx.fillText(`Moves: ${this._moveCount}`, w / 2, h / 2 + 40);

    ctx.font = '14px monospace';
    ctx.fillStyle = HINT_TEXT_COLOR;
    ctx.fillText('Space: Replay | N: Next Level', w / 2, h / 2 + 80);

    ctx.textAlign = 'left';
  }
}
