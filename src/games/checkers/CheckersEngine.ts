import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  BOARD_SIZE, CELL_SIZE, BOARD_OFFSET_X, BOARD_OFFSET_Y,
  EMPTY, RED, BLACK, RED_KING, BLACK_KING,
  RED_DIRECTIONS, BLACK_DIRECTIONS, ALL_DIRECTIONS,
  BG_COLOR, LIGHT_CELL_COLOR, DARK_CELL_COLOR,
  RED_COLOR, RED_KING_COLOR, BLACK_COLOR, BLACK_KING_COLOR,
  SELECTED_COLOR, VALID_MOVE_COLOR, CAPTURE_MOVE_COLOR, KING_CROWN_COLOR,
} from './constants';

/** 棋子信息 */
interface PieceInfo {
  row: number;
  col: number;
  type: number;
}

/** 移动信息 */
interface MoveInfo {
  from: { row: number; col: number };
  to: { row: number; col: number };
  captures: { row: number; col: number }[];
  isKingMove: boolean;
}

export class CheckersEngine extends GameEngine {
  // 棋盘 8x8
  private _board: number[][] = [];
  // 当前玩家
  private _currentPlayer: number = RED;
  // 选中的棋子位置
  private _selectedPiece: { row: number; col: number } | null = null;
  // 当前可用的移动
  private _validMoves: MoveInfo[] = [];
  // 是否必须吃子（连跳中）
  private _mustCapture: boolean = false;
  // 连跳中的棋子
  private _capturingPiece: { row: number; col: number } | null = null;
  // 游戏结束标志
  private _gameOver: boolean = false;
  // AI 是否启用
  private _aiEnabled: boolean = true;
  // AI 思考中
  private _aiThinking: boolean = false;
  // 红方棋子数
  private _redCount: number = 12;
  // 黑方棋子数
  private _blackCount: number = 12;
  // 红方吃子数（计分用）
  private _redCaptured: number = 0;
  // 黑方吃子数
  private _blackCaptured: number = 0;
  // 胜者
  private _winner: number | null = null;

  // ========== Getters ==========

  get board(): number[][] { return this._board.map(r => [...r]); }
  get currentPlayer(): number { return this._currentPlayer; }
  get selectedPiece(): { row: number; col: number } | null { return this._selectedPiece; }
  get validMoves(): MoveInfo[] { return [...this._validMoves]; }
  get isGameOver(): boolean { return this._gameOver; }
  get aiEnabled(): boolean { return this._aiEnabled; }
  get redCount(): number { return this._redCount; }
  get blackCount(): number { return this._blackCount; }
  get redCaptured(): number { return this._redCaptured; }
  get blackCaptured(): number { return this._blackCaptured; }
  get winner(): number | null { return this._winner; }
  get isWin(): boolean { return this._winner === RED; }

  // ========== Lifecycle ==========

  protected onInit(): void {
    this._board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
    this._currentPlayer = RED;
    this._selectedPiece = null;
    this._validMoves = [];
    this._mustCapture = false;
    this._capturingPiece = null;
    this._gameOver = false;
    this._aiThinking = false;
    this._winner = null;
    this._redCaptured = 0;
    this._blackCaptured = 0;
    this.setupInitialBoard();
    this.updateCounts();
  }

  protected onStart(): void {
    this.onInit();
  }

  protected update(_deltaTime: number): void {
    // AI 回合
    if (this._aiEnabled && this._currentPlayer === BLACK && !this._gameOver && !this._aiThinking) {
      this._aiThinking = true;
      this.aiMove();
      this._aiThinking = false;
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 绘制棋盘格子
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = BOARD_OFFSET_X + c * CELL_SIZE;
        const y = BOARD_OFFSET_Y + r * CELL_SIZE;
        const isDark = (r + c) % 2 === 1;
        ctx.fillStyle = isDark ? DARK_CELL_COLOR : LIGHT_CELL_COLOR;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }

    // 绘制选中高亮
    if (this._selectedPiece) {
      const x = BOARD_OFFSET_X + this._selectedPiece.col * CELL_SIZE;
      const y = BOARD_OFFSET_Y + this._selectedPiece.row * CELL_SIZE;
      ctx.fillStyle = SELECTED_COLOR;
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    }

    // 绘制可移动位置提示
    for (const move of this._validMoves) {
      const x = BOARD_OFFSET_X + move.to.col * CELL_SIZE;
      const y = BOARD_OFFSET_Y + move.to.row * CELL_SIZE;
      ctx.fillStyle = move.captures.length > 0 ? CAPTURE_MOVE_COLOR : VALID_MOVE_COLOR;
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    }

    // 绘制棋子
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = this._board[r][c];
        if (piece === EMPTY) continue;

        const cx = BOARD_OFFSET_X + c * CELL_SIZE + CELL_SIZE / 2;
        const cy = BOARD_OFFSET_Y + r * CELL_SIZE + CELL_SIZE / 2;
        const radius = CELL_SIZE / 2 - 6;

        // 棋子底色
        if (piece === RED || piece === RED_KING) {
          ctx.fillStyle = piece === RED_KING ? RED_KING_COLOR : RED_COLOR;
        } else {
          ctx.fillStyle = piece === BLACK_KING ? BLACK_KING_COLOR : BLACK_COLOR;
        }

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // 王冠标记
        if (piece === RED_KING || piece === BLACK_KING) {
          ctx.fillStyle = KING_CROWN_COLOR;
          ctx.font = `bold ${Math.floor(CELL_SIZE / 3)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('♛', cx, cy);
        }
      }
    }

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`红: ${this._redCount}`, 10, 25);
    ctx.textAlign = 'right';
    ctx.fillText(`黑: ${this._blackCount}`, CANVAS_WIDTH - 10, 25);
    ctx.textAlign = 'center';
    ctx.fillText(
      this._gameOver
        ? (this._winner === RED ? '红方胜！' : this._winner === BLACK ? '黑方胜！' : '平局！')
        : (this._currentPlayer === RED ? '红方回合' : '黑方回合'),
      CANVAS_WIDTH / 2, 25
    );
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {}

  handleKeyDown(_key: string): void {}
  handleKeyUp(_key: string): void {}

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      board: this._board,
      currentPlayer: this._currentPlayer,
      redCount: this._redCount,
      blackCount: this._blackCount,
      isGameOver: this._gameOver,
      winner: this._winner,
    };
  }

  // ========== Public Methods ==========

  /** 处理画布点击 */
  handleClick(canvasX: number, canvasY: number): void {
    if (this._gameOver || this._currentPlayer !== RED) return;

    const col = Math.floor((canvasX - BOARD_OFFSET_X) / CELL_SIZE);
    const row = Math.floor((canvasY - BOARD_OFFSET_Y) / CELL_SIZE);

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;

    // 检查是否点击了可移动位置
    const move = this._validMoves.find(m => m.to.row === row && m.to.col === col);
    if (move && this._selectedPiece) {
      this.executeMove(move);
      return;
    }

    // 连跳中不能选其他棋子
    if (this._mustCapture && this._capturingPiece) return;

    // 选择棋子
    this.selectPiece(row, col);
  }

  /** 选择棋子 */
  selectPiece(row: number, col: number): boolean {
    const piece = this._board[row][col];
    if (piece === EMPTY) return false;
    if (!this.isOwnPiece(piece, this._currentPlayer)) return false;

    this._selectedPiece = { row, col };
    this._validMoves = this.getMovesForPiece(row, col);

    // 如果有强制吃子，只保留吃子移动
    if (this.hasAnyCapture(this._currentPlayer)) {
      this._validMoves = this._validMoves.filter(m => m.captures.length > 0);
    }

    return true;
  }

  /** 执行移动 */
  executeMove(move: MoveInfo): boolean {
    if (this._gameOver) return false;

    const { from, to, captures } = move;
    const piece = this._board[from.row][from.col];
    if (piece === EMPTY) return false;

    // 移动棋子
    this._board[to.row][to.col] = piece;
    this._board[from.row][from.col] = EMPTY;

    // 移除被吃棋子
    for (const cap of captures) {
      this._board[cap.row][cap.col] = EMPTY;
    }

    // 更新吃子计数
    if (this._currentPlayer === RED) {
      this._redCaptured += captures.length;
    } else {
      this._blackCaptured += captures.length;
    }

    // 计分
    this.addScore(captures.length * 10);

    // 检查升变
    let promoted = false;
    if (piece === RED && to.row === 0) {
      this._board[to.row][to.col] = RED_KING;
      promoted = true;
      this.addScore(5);
    } else if (piece === BLACK && to.row === BOARD_SIZE - 1) {
      this._board[to.row][to.col] = BLACK_KING;
      promoted = true;
    }

    this.updateCounts();

    // 检查连跳（吃子后且未升变）
    if (captures.length > 0 && !promoted) {
      const furtherCaptures = this.getCapturesForPiece(to.row, to.col);
      if (furtherCaptures.length > 0) {
        // 连跳：保持当前玩家，锁定棋子
        this._mustCapture = true;
        this._capturingPiece = { row: to.row, col: to.col };
        this._selectedPiece = { row: to.row, col: to.col };
        this._validMoves = furtherCaptures;
        this.emit('capture', { from, to, captures, multiJump: true });
        return true;
      }
    }

    // 结束回合
    this._mustCapture = false;
    this._capturingPiece = null;
    this._selectedPiece = null;
    this._validMoves = [];
    this.emit('capture', { from, to, captures, multiJump: false });
    this.switchPlayer();
    return true;
  }

  /** 设置 AI */
  setAI(enabled: boolean): void {
    this._aiEnabled = enabled;
  }

  /** 获取指定棋子的所有合法移动 */
  getMovesForPiece(row: number, col: number): MoveInfo[] {
    const piece = this._board[row][col];
    if (piece === EMPTY) return [];

    const moves: MoveInfo[] = [];
    const captures = this.getCapturesForPiece(row, col);

    // 有吃子时只返回吃子移动
    if (captures.length > 0) return captures;

    // 普通移动
    const directions = this.getDirections(piece);
    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (this.isInBounds(nr, nc) && this._board[nr][nc] === EMPTY) {
        moves.push({
          from: { row, col },
          to: { row: nr, col: nc },
          captures: [],
          isKingMove: piece === RED_KING || piece === BLACK_KING,
        });
      }
    }

    return moves;
  }

  /** 获取指定棋子的吃子移动 */
  getCapturesForPiece(row: number, col: number): MoveInfo[] {
    const piece = this._board[row][col];
    if (piece === EMPTY) return [];

    const captures: MoveInfo[] = [];
    const directions = this.getDirections(piece);
    const opponent = this._currentPlayer === RED ? BLACK : RED;

    for (const [dr, dc] of directions) {
      const mr = row + dr;   // 中间位置（被跳过的）
      const mc = col + dc;
      const nr = row + 2 * dr; // 目标位置
      const nc = col + 2 * dc;

      if (this.isInBounds(nr, nc) && this._board[nr][nc] === EMPTY) {
        const midPiece = this._board[mr][mc];
        if (midPiece !== EMPTY && this.isOpponentPiece(midPiece, this._currentPlayer)) {
          captures.push({
            from: { row, col },
            to: { row: nr, col: nc },
            captures: [{ row: mr, col: mc }],
            isKingMove: piece === RED_KING || piece === BLACK_KING,
          });
        }
      }
    }

    return captures;
  }

  // ========== Private Methods ==========

  /** 初始化棋盘 */
  private setupInitialBoard(): void {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        // 只在深色格子上放棋子
        if ((r + c) % 2 === 1) {
          if (r < 3) {
            this._board[r][c] = BLACK; // 黑方在上 3 行
          } else if (r > 4) {
            this._board[r][c] = RED;   // 红方在下 3 行
          }
        }
      }
    }
  }

  /** 更新棋子计数 */
  private updateCounts(): void {
    this._redCount = 0;
    this._blackCount = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = this._board[r][c];
        if (p === RED || p === RED_KING) this._redCount++;
        else if (p === BLACK || p === BLACK_KING) this._blackCount++;
      }
    }
  }

  /** 获取棋子移动方向 */
  private getDirections(piece: number): number[][] {
    if (piece === RED) return RED_DIRECTIONS;
    if (piece === BLACK) return BLACK_DIRECTIONS;
    return ALL_DIRECTIONS; // 王
  }

  /** 判断是否在棋盘内 */
  private isInBounds(row: number, col: number): boolean {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  /** 判断是否是自己的棋子 */
  private isOwnPiece(piece: number, player: number): boolean {
    if (player === RED) return piece === RED || piece === RED_KING;
    return piece === BLACK || piece === BLACK_KING;
  }

  /** 判断是否是对手的棋子 */
  private isOpponentPiece(piece: number, player: number): boolean {
    if (player === RED) return piece === BLACK || piece === BLACK_KING;
    return piece === RED || piece === RED_KING;
  }

  /** 判断某方是否有吃子移动 */
  private hasAnyCapture(player: number): boolean {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.isOwnPiece(this._board[r][c], player)) {
          if (this.getCapturesForPiece(r, c).length > 0) return true;
        }
      }
    }
    return false;
  }

  /** 判断某方是否有合法移动 */
  private hasAnyMove(player: number): boolean {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.isOwnPiece(this._board[r][c], player)) {
          if (this.getMovesForPiece(r, c).length > 0) return true;
        }
      }
    }
    return false;
  }

  /** 切换玩家 */
  private switchPlayer(): void {
    this._currentPlayer = this._currentPlayer === RED ? BLACK : RED;

    // 检查下一个玩家是否有合法移动
    if (!this.hasAnyMove(this._currentPlayer)) {
      this.endGame();
    } else if (this._redCount === 0 || this._blackCount === 0) {
      this.endGame();
    }

    this.emit('turnChange', this._currentPlayer);
  }

  /** 结束游戏 */
  private endGame(): void {
    this._gameOver = true;
    if (this._redCount > this._blackCount) {
      this._winner = RED;
    } else if (this._blackCount > this._redCount) {
      this._winner = BLACK;
    } else {
      this._winner = null; // 平局
    }
    this.gameOver();
  }

  /** AI 移动 */
  private aiMove(): void {
    if (this._gameOver) return;

    // 收集所有合法移动
    const allMoves: MoveInfo[] = [];

    // 如果有强制吃子
    if (this.hasAnyCapture(BLACK)) {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (this.isOwnPiece(this._board[r][c], BLACK)) {
            const captures = this.getCapturesForPiece(r, c);
            allMoves.push(...captures);
          }
        }
      }
    } else {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (this.isOwnPiece(this._board[r][c], BLACK)) {
            const moves = this.getMovesForPiece(r, c);
            allMoves.push(...moves);
          }
        }
      }
    }

    if (allMoves.length === 0) {
      this.endGame();
      return;
    }

    // AI 策略：优先吃子 > 升变 > 随机
    const move = this.chooseBestMove(allMoves);
    if (move) {
      this._selectedPiece = move.from;
      this.executeMove(move);

      // 处理连跳
      while (this._mustCapture && this._capturingPiece && this._validMoves.length > 0) {
        const nextMove = this._validMoves[0];
        this.executeMove(nextMove);
      }

      // 清理 AI 状态
      this._selectedPiece = null;
      this._validMoves = [];
    }
  }

  /** AI 选择最佳移动 */
  private chooseBestMove(moves: MoveInfo[]): MoveInfo | null {
    if (moves.length === 0) return null;

    // 优先吃子
    const captures = moves.filter(m => m.captures.length > 0);
    if (captures.length > 0) {
      // 多吃子优先
      captures.sort((a, b) => b.captures.length - a.captures.length);
      return captures[0];
    }

    // 优先升变
    const promotionMoves = moves.filter(m => {
      const piece = this._board[m.from.row][m.from.col];
      return piece === BLACK && m.to.row === BOARD_SIZE - 1;
    });
    if (promotionMoves.length > 0) {
      return promotionMoves[Math.floor(Math.random() * promotionMoves.length)];
    }

    // 随机
    return moves[Math.floor(Math.random() * moves.length)];
  }
}
