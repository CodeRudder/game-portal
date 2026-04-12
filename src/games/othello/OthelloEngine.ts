import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  BOARD_SIZE, CELL_SIZE, BOARD_OFFSET_X, BOARD_OFFSET_Y,
  EMPTY, BLACK, WHITE,
  DIRECTIONS, POSITION_WEIGHTS,
  BG_COLOR, BOARD_COLOR, GRID_COLOR, BLACK_COLOR, WHITE_COLOR, HINT_COLOR,
} from './constants';

export class OthelloEngine extends GameEngine {
  private _board: number[][] = [];
  private _currentPlayer: number = BLACK;
  private _blackCount: number = 2;
  private _whiteCount: number = 2;
  private _validMoves: { row: number; col: number }[] = [];
  private _gameOver: boolean = false;
  private _aiEnabled: boolean = true;
  private _aiThinking: boolean = false;
  private _passCount: number = 0;
  private _lastMove: { row: number; col: number } | null = null;

  get board(): number[][] { return this._board.map(r => [...r]); }
  get currentPlayer(): number { return this._currentPlayer; }
  get blackCount(): number { return this._blackCount; }
  get whiteCount(): number { return this._whiteCount; }
  get validMoves(): { row: number; col: number }[] { return [...this._validMoves]; }
  get isGameOver(): boolean { return this._gameOver; }
  get aiEnabled(): boolean { return this._aiEnabled; }
  get lastMove(): { row: number; col: number } | null { return this._lastMove; }

  protected onInit(): void {
    this._board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
    // Initial 4 pieces
    const mid = BOARD_SIZE / 2;
    this._board[mid - 1][mid - 1] = WHITE;
    this._board[mid - 1][mid] = BLACK;
    this._board[mid][mid - 1] = BLACK;
    this._board[mid][mid] = WHITE;
    this._currentPlayer = BLACK;
    this._gameOver = false;
    this._passCount = 0;
    this._lastMove = null;
    this._aiThinking = false;
    this.updateCounts();
    this._validMoves = this.getValidMoves(this._currentPlayer);
  }

  protected onStart(): void {
    this.onInit();
  }

  protected update(_deltaTime: number): void {
    // AI move
    if (this._aiEnabled && this._currentPlayer === WHITE && !this._gameOver && !this._aiThinking) {
      this._aiThinking = true;
      this.aiMove();
      this._aiThinking = false;
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Board
    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(BOARD_OFFSET_X, BOARD_OFFSET_Y, CELL_SIZE * BOARD_SIZE, CELL_SIZE * BOARD_SIZE);

    // Grid lines
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let i = 0; i <= BOARD_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_OFFSET_X + i * CELL_SIZE, BOARD_OFFSET_Y);
      ctx.lineTo(BOARD_OFFSET_X + i * CELL_SIZE, BOARD_OFFSET_Y + BOARD_SIZE * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(BOARD_OFFSET_X, BOARD_OFFSET_Y + i * CELL_SIZE);
      ctx.lineTo(BOARD_OFFSET_X + BOARD_SIZE * CELL_SIZE, BOARD_OFFSET_Y + i * CELL_SIZE);
      ctx.stroke();
    }

    // Valid move hints
    ctx.fillStyle = HINT_COLOR;
    for (const move of this._validMoves) {
      ctx.beginPath();
      ctx.arc(
        BOARD_OFFSET_X + move.col * CELL_SIZE + CELL_SIZE / 2,
        BOARD_OFFSET_Y + move.row * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 4, 0, Math.PI * 2
      );
      ctx.fill();
    }

    // Pieces
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] === EMPTY) continue;
        ctx.fillStyle = this._board[r][c] === BLACK ? BLACK_COLOR : WHITE_COLOR;
        ctx.beginPath();
        ctx.arc(
          BOARD_OFFSET_X + c * CELL_SIZE + CELL_SIZE / 2,
          BOARD_OFFSET_Y + r * CELL_SIZE + CELL_SIZE / 2,
          CELL_SIZE / 2 - 4, 0, Math.PI * 2
        );
        ctx.fill();
      }
    }

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText(`Black: ${this._blackCount}`, 10, 25);
    ctx.fillText(`White: ${this._whiteCount}`, 380, 25);
    ctx.fillText(this._currentPlayer === BLACK ? "Black's turn" : "White's turn", 180, 25);
  }

  protected onReset(): void { this.onInit(); }
  protected onGameOver(): void {}

  handleKeyDown(_key: string): void {}
  handleKeyUp(_key: string): void {}

  getState(): Record<string, unknown> {
    return {
      score: this._score, level: this._level,
      board: this._board, currentPlayer: this._currentPlayer,
      blackCount: this._blackCount, whiteCount: this._whiteCount,
      isGameOver: this._gameOver, validMoves: this._validMoves,
    };
  }

  // ========== Public Methods ==========

  handleClick(canvasX: number, canvasY: number): void {
    if (this._gameOver || this._currentPlayer !== BLACK) return;
    const col = Math.floor((canvasX - BOARD_OFFSET_X) / CELL_SIZE);
    const row = Math.floor((canvasY - BOARD_OFFSET_Y) / CELL_SIZE);
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;
    this.makeMove(row, col);
  }

  makeMove(row: number, col: number): boolean {
    if (this._gameOver) return false;
    if (this._board[row][col] !== EMPTY) return false;
    const flips = this.getFlips(row, col, this._currentPlayer);
    if (flips.length === 0) return false;

    // Place piece
    this._board[row][col] = this._currentPlayer;
    this._lastMove = { row, col };

    // Flip pieces
    for (const [r, c] of flips) {
      this._board[r][c] = this._currentPlayer;
    }

    this.updateCounts();
    this.addScore(flips.length);

    // Switch player
    this._passCount = 0;
    this._currentPlayer = this._currentPlayer === BLACK ? WHITE : BLACK;
    this._validMoves = this.getValidMoves(this._currentPlayer);

    // Check if current player can move
    if (this._validMoves.length === 0) {
      this._passCount++;
      this._currentPlayer = this._currentPlayer === BLACK ? WHITE : BLACK;
      this._validMoves = this.getValidMoves(this._currentPlayer);
      if (this._validMoves.length === 0) {
        // Both can't move - game over
        this._passCount++;
        this.endGame();
      }
    }

    this.emit('move', { row, col, player: this._board[row][col] });
    return true;
  }

  setAI(enabled: boolean): void {
    this._aiEnabled = enabled;
  }

  // ========== Private Methods ==========

  private getFlips(row: number, col: number, player: number): [number, number][] {
    const allFlips: [number, number][] = [];
    const opponent = player === BLACK ? WHITE : BLACK;

    for (const [dr, dc] of DIRECTIONS) {
      const flips: [number, number][] = [];
      let r = row + dr;
      let c = col + dc;

      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && this._board[r][c] === opponent) {
        flips.push([r, c]);
        r += dr;
        c += dc;
      }

      if (flips.length > 0 && r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && this._board[r][c] === player) {
        allFlips.push(...flips);
      }
    }

    return allFlips;
  }

  private getValidMoves(player: number): { row: number; col: number }[] {
    const moves: { row: number; col: number }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] === EMPTY && this.getFlips(r, c, player).length > 0) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  }

  private updateCounts(): void {
    this._blackCount = 0;
    this._whiteCount = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] === BLACK) this._blackCount++;
        else if (this._board[r][c] === WHITE) this._whiteCount++;
      }
    }
  }

  private aiMove(): void {
    if (this._validMoves.length === 0) return;

    let bestMove = this._validMoves[0];
    let bestScore = -Infinity;

    for (const move of this._validMoves) {
      const flips = this.getFlips(move.row, move.col, WHITE);
      let score = flips.length * 3;
      score += POSITION_WEIGHTS[move.row][move.col];
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    this.makeMove(bestMove.row, bestMove.col);
  }

  private endGame(): void {
    this._gameOver = true;
    this.gameOver();
  }
}
