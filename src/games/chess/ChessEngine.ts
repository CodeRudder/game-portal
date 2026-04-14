import { GameEngine } from '@/core/GameEngine';
import {
  BOARD_SIZE,
  COLORS,
  PieceType,
  Color,
  PIECE_SYMBOLS,
  PIECE_VALUES,
  POSITION_TABLES,
  AI_DEPTH,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CELL_SIZE,
  INFO_BAR_HEIGHT,
} from './constants';

// ========== 类型定义 ==========

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece | null;
  isEnPassant?: boolean;
  isCastling?: boolean;
  promotion?: PieceType;
}

export type Board = (Piece | null)[][];

interface CastlingRights {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}

// ========== 主引擎 ==========

export class ChessEngine extends GameEngine {
  // 棋盘状态
  protected board: Board = [];
  protected currentTurn: Color = Color.WHITE;
  protected selectedPos: Position | null = null;
  protected validMoves: Position[] = [];
  protected cursorPos: Position = { row: 0, col: 0 };
  protected moveHistory: Move[] = [];
  protected castlingRights: CastlingRights = {
    whiteKingSide: true,
    whiteQueenSide: true,
    blackKingSide: true,
    blackQueenSide: true,
  };
  protected enPassantTarget: Position | null = null;
  protected isCheckFlag = false;
  protected isCheckmateFlag = false;
  protected isStalemateFlag = false;
  protected gameOverFlag = false;
  protected winner: Color | null = null;
  protected lastMove: { from: Position; to: Position } | null = null;
  protected isWin = false;
  protected capturedPieces: { white: Piece[]; black: Piece[] } = { white: [], black: [] };
  protected aiThinking = false;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.initBoard();
  }

  protected onStart(): void {
    this.initBoard();
    this.currentTurn = Color.WHITE;
    this.selectedPos = null;
    this.validMoves = [];
    this.cursorPos = { row: 0, col: 0 };
    this.moveHistory = [];
    this.castlingRights = {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true,
    };
    this.enPassantTarget = null;
    this.isCheckFlag = false;
    this.isCheckmateFlag = false;
    this.isStalemateFlag = false;
    this.gameOverFlag = false;
    this.winner = null;
    this.lastMove = null;
    this.isWin = false;
    this.capturedPieces = { white: [], black: [] };
    this.aiThinking = false;
    this._score = 0;
  }

  protected update(_deltaTime: number): void {
    // 棋类游戏不需要持续更新
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.renderBoard(ctx, w, h);
  }

  protected onReset(): void {
    this.initBoard();
    this.currentTurn = Color.WHITE;
    this.selectedPos = null;
    this.validMoves = [];
    this.cursorPos = { row: 0, col: 0 };
    this.moveHistory = [];
    this.castlingRights = {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true,
    };
    this.enPassantTarget = null;
    this.isCheckFlag = false;
    this.isCheckmateFlag = false;
    this.isStalemateFlag = false;
    this.gameOverFlag = false;
    this.winner = null;
    this.lastMove = null;
    this.isWin = false;
    this.capturedPieces = { white: [], black: [] };
    this.aiThinking = false;
  }

  // ========== 棋盘初始化 ==========

  initBoard(): void {
    this.board = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => null)
    );

    // 黑方（上方 row 0-1）
    const backRow: PieceType[] = [
      PieceType.ROOK, PieceType.KNIGHT, PieceType.BISHOP, PieceType.QUEEN,
      PieceType.KING, PieceType.BISHOP, PieceType.KNIGHT, PieceType.ROOK,
    ];
    for (let c = 0; c < BOARD_SIZE; c++) {
      this.board[0][c] = { type: backRow[c], color: Color.BLACK };
      this.board[1][c] = { type: PieceType.PAWN, color: Color.BLACK };
      this.board[6][c] = { type: PieceType.PAWN, color: Color.WHITE };
      this.board[7][c] = { type: backRow[c], color: Color.WHITE };
    }
  }

  // ========== 棋盘操作 ==========

  getBoard(): Board {
    return this.board;
  }

  getPiece(pos: Position): Piece | null {
    if (!this.isInBounds(pos)) return null;
    return this.board[pos.row][pos.col];
  }

  setPiece(pos: Position, piece: Piece | null): void {
    if (this.isInBounds(pos)) {
      this.board[pos.row][pos.col] = piece;
    }
  }

  isInBounds(pos: Position): boolean {
    return pos.row >= 0 && pos.row < BOARD_SIZE && pos.col >= 0 && pos.col < BOARD_SIZE;
  }

  cloneBoard(board?: Board): Board {
    const src = board ?? this.board;
    return src.map(row => row.map(cell => cell ? { ...cell } : null));
  }

  // ========== 移动生成 ==========

  /**
   * 获取某个位置的棋子的所有伪合法移动（不考虑自己是否被将）
   */
  getPseudoLegalMoves(pos: Position, board?: Board): Position[] {
    const piece = board ? board[pos.row][pos.col] : this.getPiece(pos);
    if (!piece) return [];

    switch (piece.type) {
      case PieceType.PAWN:
        return this.getPawnMoves(pos, piece.color, board);
      case PieceType.ROOK:
        return this.getSlidingMoves(pos, piece.color, [[0, 1], [0, -1], [1, 0], [-1, 0]], board);
      case PieceType.BISHOP:
        return this.getSlidingMoves(pos, piece.color, [[1, 1], [1, -1], [-1, 1], [-1, -1]], board);
      case PieceType.QUEEN:
        return this.getSlidingMoves(pos, piece.color, [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]], board);
      case PieceType.KNIGHT:
        return this.getKnightMoves(pos, piece.color, board);
      case PieceType.KING:
        return this.getKingMoves(pos, piece.color, board);
      default:
        return [];
    }
  }

  private getPawnMoves(pos: Position, color: Color, board?: Board): Position[] {
    const moves: Position[] = [];
    const b = board ?? this.board;
    const direction = color === Color.WHITE ? -1 : 1;
    const startRow = color === Color.WHITE ? 6 : 1;

    // 前进一格
    const oneStep: Position = { row: pos.row + direction, col: pos.col };
    if (this.isInBounds(oneStep) && !b[oneStep.row][oneStep.col]) {
      moves.push(oneStep);

      // 首次前进两格
      const twoStep: Position = { row: pos.row + 2 * direction, col: pos.col };
      if (pos.row === startRow && this.isInBounds(twoStep) && !b[twoStep.row][twoStep.col]) {
        moves.push(twoStep);
      }
    }

    // 斜吃
    for (const dc of [-1, 1]) {
      const diag: Position = { row: pos.row + direction, col: pos.col + dc };
      if (!this.isInBounds(diag)) continue;
      const target = b[diag.row][diag.col];
      if (target && target.color !== color) {
        moves.push(diag);
      }
      // 吃过路兵
      if (!board) {
        if (this.enPassantTarget && this.enPassantTarget.row === diag.row && this.enPassantTarget.col === diag.col) {
          moves.push(diag);
        }
      }
    }

    return moves;
  }

  private getSlidingMoves(pos: Position, color: Color, directions: number[][], board?: Board): Position[] {
    const moves: Position[] = [];
    const b = board ?? this.board;

    for (const [dr, dc] of directions) {
      let r = pos.row + dr;
      let c = pos.col + dc;
      while (this.isInBounds({ row: r, col: c })) {
        const target = b[r][c];
        if (!target) {
          moves.push({ row: r, col: c });
        } else {
          if (target.color !== color) {
            moves.push({ row: r, col: c });
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }

    return moves;
  }

  private getKnightMoves(pos: Position, color: Color, board?: Board): Position[] {
    const moves: Position[] = [];
    const b = board ?? this.board;
    const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

    for (const [dr, dc] of offsets) {
      const np: Position = { row: pos.row + dr, col: pos.col + dc };
      if (this.isInBounds(np)) {
        const target = b[np.row][np.col];
        if (!target || target.color !== color) {
          moves.push(np);
        }
      }
    }

    return moves;
  }

  private getKingMoves(pos: Position, color: Color, board?: Board): Position[] {
    const moves: Position[] = [];
    const b = board ?? this.board;

    // 常规移动（8个方向各1格）
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const np: Position = { row: pos.row + dr, col: pos.col + dc };
        if (this.isInBounds(np)) {
          const target = b[np.row][np.col];
          if (!target || target.color !== color) {
            moves.push(np);
          }
        }
      }
    }

    // 王车易位（仅在真实棋盘上考虑，clone 时不考虑）
    if (!board) {
      const kingRow = color === Color.WHITE ? 7 : 0;
      if (pos.row === kingRow && pos.col === 4) {
        // 短易位
        const canKingSide = color === Color.WHITE
          ? this.castlingRights.whiteKingSide
          : this.castlingRights.blackKingSide;
        if (canKingSide && !b[kingRow][5] && !b[kingRow][6]) {
          const rook = b[kingRow][7];
          if (rook && rook.type === PieceType.ROOK && rook.color === color) {
            // 检查路径上是否被攻击
            if (
              !this.isSquareAttacked({ row: kingRow, col: 4 }, color === Color.WHITE ? Color.BLACK : Color.WHITE) &&
              !this.isSquareAttacked({ row: kingRow, col: 5 }, color === Color.WHITE ? Color.BLACK : Color.WHITE) &&
              !this.isSquareAttacked({ row: kingRow, col: 6 }, color === Color.WHITE ? Color.BLACK : Color.WHITE)
            ) {
              moves.push({ row: kingRow, col: 6 });
            }
          }
        }
        // 长易位
        const canQueenSide = color === Color.WHITE
          ? this.castlingRights.whiteQueenSide
          : this.castlingRights.blackQueenSide;
        if (canQueenSide && !b[kingRow][1] && !b[kingRow][2] && !b[kingRow][3]) {
          const rook = b[kingRow][0];
          if (rook && rook.type === PieceType.ROOK && rook.color === color) {
            if (
              !this.isSquareAttacked({ row: kingRow, col: 4 }, color === Color.WHITE ? Color.BLACK : Color.WHITE) &&
              !this.isSquareAttacked({ row: kingRow, col: 3 }, color === Color.WHITE ? Color.BLACK : Color.WHITE) &&
              !this.isSquareAttacked({ row: kingRow, col: 2 }, color === Color.WHITE ? Color.BLACK : Color.WHITE)
            ) {
              moves.push({ row: kingRow, col: 2 });
            }
          }
        }
      }
    }

    return moves;
  }

  /**
   * 获取合法移动（过滤掉会导致自己被将的移动）
   */
  getLegalMoves(pos: Position): Position[] {
    const piece = this.getPiece(pos);
    if (!piece) return [];

    const pseudoMoves = this.getPseudoLegalMoves(pos);
    return pseudoMoves.filter(to => {
      const savedBoard = this.cloneBoard();
      const savedEP = this.enPassantTarget;
      const savedCastling = { ...this.castlingRights };

      // 模拟移动
      this.simulateMove(pos, to);

      // 检查自己的王是否被将
      const kingPos = this.findKing(piece.color);
      const inCheck = kingPos ? this.isSquareAttacked(kingPos, piece.color === Color.WHITE ? Color.BLACK : Color.WHITE) : true;

      // 恢复棋盘
      this.board = savedBoard;
      this.enPassantTarget = savedEP;
      this.castlingRights = savedCastling;

      return !inCheck;
    });
  }

  /**
   * 模拟移动（不更新游戏状态，仅修改棋盘）
   */
  private simulateMove(from: Position, to: Position): void {
    const piece = this.board[from.row][from.col];
    if (!piece) return;

    // 吃过路兵
    if (piece.type === PieceType.PAWN && this.enPassantTarget &&
      to.row === this.enPassantTarget.row && to.col === this.enPassantTarget.col) {
      const capturedRow = piece.color === Color.WHITE ? to.row + 1 : to.row - 1;
      this.board[capturedRow][to.col] = null;
    }

    // 王车易位
    if (piece.type === PieceType.KING && Math.abs(to.col - from.col) === 2) {
      const row = from.row;
      if (to.col === 6) {
        // 短易位
        this.board[row][5] = this.board[row][7];
        this.board[row][7] = null;
      } else if (to.col === 2) {
        // 长易位
        this.board[row][3] = this.board[row][0];
        this.board[row][0] = null;
      }
    }

    this.board[to.row][to.col] = piece;
    this.board[from.row][from.col] = null;
  }

  // ========== 攻击检测 ==========

  /**
   * 检查某个格子是否被指定颜色攻击
   */
  isSquareAttacked(pos: Position, byColor: Color, board?: Board): boolean {
    const b = board ?? this.board;

    // 兵攻击
    const pawnDir = byColor === Color.WHITE ? 1 : -1;
    for (const dc of [-1, 1]) {
      const ap: Position = { row: pos.row + pawnDir, col: pos.col + dc };
      if (this.isInBounds(ap)) {
        const p = b[ap.row][ap.col];
        if (p && p.type === PieceType.PAWN && p.color === byColor) return true;
      }
    }

    // 马攻击
    const knightOffsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (const [dr, dc] of knightOffsets) {
      const np: Position = { row: pos.row + dr, col: pos.col + dc };
      if (this.isInBounds(np)) {
        const p = b[np.row][np.col];
        if (p && p.type === PieceType.KNIGHT && p.color === byColor) return true;
      }
    }

    // 直线攻击（车、后）
    const straightDirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dr, dc] of straightDirs) {
      let r = pos.row + dr;
      let c = pos.col + dc;
      while (this.isInBounds({ row: r, col: c })) {
        const p = b[r][c];
        if (p) {
          if (p.color === byColor && (p.type === PieceType.ROOK || p.type === PieceType.QUEEN)) return true;
          break;
        }
        r += dr;
        c += dc;
      }
    }

    // 对角线攻击（象、后）
    const diagDirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [dr, dc] of diagDirs) {
      let r = pos.row + dr;
      let c = pos.col + dc;
      while (this.isInBounds({ row: r, col: c })) {
        const p = b[r][c];
        if (p) {
          if (p.color === byColor && (p.type === PieceType.BISHOP || p.type === PieceType.QUEEN)) return true;
          break;
        }
        r += dr;
        c += dc;
      }
    }

    // 王攻击
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const np: Position = { row: pos.row + dr, col: pos.col + dc };
        if (this.isInBounds(np)) {
          const p = b[np.row][np.col];
          if (p && p.type === PieceType.KING && p.color === byColor) return true;
        }
      }
    }

    return false;
  }

  /**
   * 查找王的位置
   */
  findKing(color: Color, board?: Board): Position | null {
    const b = board ?? this.board;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = b[r][c];
        if (p && p.type === PieceType.KING && p.color === color) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  /**
   * 检查指定颜色是否被将
   */
  isInCheck(color: Color): boolean {
    const kingPos = this.findKing(color);
    if (!kingPos) return false;
    const opponent = color === Color.WHITE ? Color.BLACK : Color.WHITE;
    return this.isSquareAttacked(kingPos, opponent);
  }

  /**
   * 检查指定颜色是否有合法移动
   */
  hasLegalMoves(color: Color): boolean {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = this.board[r][c];
        if (p && p.color === color) {
          const moves = this.getLegalMoves({ row: r, col: c });
          if (moves.length > 0) return true;
        }
      }
    }
    return false;
  }

  // ========== 移动执行 ==========

  /**
   * 执行移动
   */
  makeMove(from: Position, to: Position): Move | null {
    const piece = this.getPiece(from);
    if (!piece) return null;

    const captured = this.getPiece(to);
    let isEnPassant = false;
    let isCastling = false;

    // 记录移动
    const move: Move = {
      from: { ...from },
      to: { ...to },
      piece: { ...piece },
      captured: captured ? { ...captured } : null,
    };

    // 吃过路兵
    if (piece.type === PieceType.PAWN && this.enPassantTarget &&
      to.row === this.enPassantTarget.row && to.col === this.enPassantTarget.col) {
      isEnPassant = true;
      move.isEnPassant = true;
      const capturedRow = piece.color === Color.WHITE ? to.row + 1 : to.row - 1;
      const epCaptured = this.board[capturedRow][to.col];
      if (epCaptured) {
        move.captured = { ...epCaptured };
        this.capturedPieces[epCaptured.color].push({ ...epCaptured });
      }
      this.board[capturedRow][to.col] = null;
    }

    // 记录被吃的棋子
    if (captured) {
      this.capturedPieces[captured.color].push({ ...captured });
    }

    // 王车易位
    if (piece.type === PieceType.KING && Math.abs(to.col - from.col) === 2) {
      isCastling = true;
      move.isCastling = true;
      const row = from.row;
      if (to.col === 6) {
        // 短易位
        this.board[row][5] = this.board[row][7];
        this.board[row][7] = null;
      } else if (to.col === 2) {
        // 长易位
        this.board[row][3] = this.board[row][0];
        this.board[row][0] = null;
      }
    }

    // 移动棋子
    this.board[to.row][to.col] = piece;
    this.board[from.row][from.col] = null;

    // 兵升变（自动升变为后）
    if (piece.type === PieceType.PAWN) {
      const promotionRow = piece.color === Color.WHITE ? 0 : 7;
      if (to.row === promotionRow) {
        this.board[to.row][to.col] = { type: PieceType.QUEEN, color: piece.color };
        move.promotion = PieceType.QUEEN;
      }
    }

    // 更新过路兵目标
    this.enPassantTarget = null;
    if (piece.type === PieceType.PAWN && Math.abs(to.row - from.row) === 2) {
      this.enPassantTarget = {
        row: (from.row + to.row) / 2,
        col: from.col,
      };
    }

    // 更新易位权利
    if (piece.type === PieceType.KING) {
      if (piece.color === Color.WHITE) {
        this.castlingRights.whiteKingSide = false;
        this.castlingRights.whiteQueenSide = false;
      } else {
        this.castlingRights.blackKingSide = false;
        this.castlingRights.blackQueenSide = false;
      }
    }
    if (piece.type === PieceType.ROOK) {
      if (from.row === 7 && from.col === 0) this.castlingRights.whiteQueenSide = false;
      if (from.row === 7 && from.col === 7) this.castlingRights.whiteKingSide = false;
      if (from.row === 0 && from.col === 0) this.castlingRights.blackQueenSide = false;
      if (from.row === 0 && from.col === 7) this.castlingRights.blackKingSide = false;
    }
    // 如果车被吃，也失去易位权利
    if (to.row === 7 && to.col === 0) this.castlingRights.whiteQueenSide = false;
    if (to.row === 7 && to.col === 7) this.castlingRights.whiteKingSide = false;
    if (to.row === 0 && to.col === 0) this.castlingRights.blackQueenSide = false;
    if (to.row === 0 && to.col === 7) this.castlingRights.blackKingSide = false;

    // 记录最后一步
    this.lastMove = { from: { ...from }, to: { ...to } };

    // 计分
    if (captured || isEnPassant) {
      const capturedPiece = captured || (move.captured);
      if (capturedPiece) {
        this.addScore(PIECE_VALUES[capturedPiece.type] || 0);
      }
    }

    // 保存移动历史
    this.moveHistory.push(move);

    // 切换回合
    this.currentTurn = this.currentTurn === Color.WHITE ? Color.BLACK : Color.WHITE;

    // 检查将军/将杀/和棋
    this.isCheckFlag = this.isInCheck(this.currentTurn);
    if (!this.hasLegalMoves(this.currentTurn)) {
      if (this.isCheckFlag) {
        this.isCheckmateFlag = true;
        this.gameOverFlag = true;
        this.winner = this.currentTurn === Color.WHITE ? Color.BLACK : Color.WHITE;
        this.isWin = this.winner === Color.WHITE;
        this.addScore(5000);
      } else {
        this.isStalemateFlag = true;
        this.gameOverFlag = true;
        this.isWin = false;
      }
    }

    return move;
  }

  // ========== AI ==========

  /**
   * AI 落子
   */
  aiMove(): void {
    if (this.gameOverFlag || this.currentTurn !== Color.BLACK) return;

    this.aiThinking = true;
    const bestMove = this.findBestMove();
    if (bestMove) {
      this.makeMove(bestMove.from, bestMove.to);
    }
    this.aiThinking = false;
  }

  /**
   * 寻找最佳移动（Minimax + Alpha-Beta 剪枝）
   */
  findBestMove(): { from: Position; to: Position } | null {
    let bestScore = -Infinity;
    let bestMove: { from: Position; to: Position } | null = null;

    const moves = this.getAllMoves(Color.BLACK);
    // 打乱移动顺序增加随机性
    this.shuffleArray(moves);

    for (const move of moves) {
      const savedBoard = this.cloneBoard();
      const savedEP = this.enPassantTarget;
      const savedCastling = { ...this.castlingRights };

      this.simulateMove(move.from, move.to);
      // 处理升变
      const piece = this.board[move.to.row][move.to.col];
      if (piece && piece.type === PieceType.PAWN && move.to.row === 7) {
        this.board[move.to.row][move.to.col] = { type: PieceType.QUEEN, color: Color.BLACK };
      }

      const score = this.minimax(AI_DEPTH - 1, -Infinity, Infinity, false);

      this.board = savedBoard;
      this.enPassantTarget = savedEP;
      this.castlingRights = savedCastling;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private minimax(depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
    if (depth === 0) {
      return this.evaluateBoard();
    }

    const color = isMaximizing ? Color.BLACK : Color.WHITE;
    const moves = this.getAllMoves(color);

    if (moves.length === 0) {
      const kingPos = this.findKing(color);
      if (kingPos) {
        const opponent = color === Color.WHITE ? Color.BLACK : Color.WHITE;
        if (this.isSquareAttacked(kingPos, opponent)) {
          return isMaximizing ? -100000 + (AI_DEPTH - depth) : 100000 - (AI_DEPTH - depth);
        }
      }
      return 0; // 和棋
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const savedBoard = this.cloneBoard();
        const savedEP = this.enPassantTarget;
        const savedCastling = { ...this.castlingRights };

        this.simulateMove(move.from, move.to);
        const piece = this.board[move.to.row][move.to.col];
        if (piece && piece.type === PieceType.PAWN) {
          const promoRow = piece.color === Color.WHITE ? 0 : 7;
          if (move.to.row === promoRow) {
            this.board[move.to.row][move.to.col] = { type: PieceType.QUEEN, color: piece.color };
          }
        }

        const evalScore = this.minimax(depth - 1, alpha, beta, false);

        this.board = savedBoard;
        this.enPassantTarget = savedEP;
        this.castlingRights = savedCastling;

        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const savedBoard = this.cloneBoard();
        const savedEP = this.enPassantTarget;
        const savedCastling = { ...this.castlingRights };

        this.simulateMove(move.from, move.to);
        const piece = this.board[move.to.row][move.to.col];
        if (piece && piece.type === PieceType.PAWN) {
          const promoRow = piece.color === Color.WHITE ? 0 : 7;
          if (move.to.row === promoRow) {
            this.board[move.to.row][move.to.col] = { type: PieceType.QUEEN, color: piece.color };
          }
        }

        const evalScore = this.minimax(depth - 1, alpha, beta, true);

        this.board = savedBoard;
        this.enPassantTarget = savedEP;
        this.castlingRights = savedCastling;

        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /**
   * 获取指定颜色的所有伪合法移动
   */
  getAllMoves(color: Color): { from: Position; to: Position }[] {
    const moves: { from: Position; to: Position }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = this.board[r][c];
        if (p && p.color === color) {
          const from: Position = { row: r, col: c };
          const pseudoMoves = this.getPseudoLegalMoves(from);
          // 过滤非法移动（导致自己被将）
          for (const to of pseudoMoves) {
            const savedBoard = this.cloneBoard();
            const savedEP = this.enPassantTarget;
            const savedCastling = { ...this.castlingRights };
            this.simulateMove(from, to);
            const kingPos = this.findKing(color);
            const opponent = color === Color.WHITE ? Color.BLACK : Color.WHITE;
            const legal = kingPos ? !this.isSquareAttacked(kingPos, opponent) : false;
            this.board = savedBoard;
            this.enPassantTarget = savedEP;
            this.castlingRights = savedCastling;
            if (legal) {
              moves.push({ from, to });
            }
          }
        }
      }
    }
    return moves;
  }

  /**
   * 评估棋盘（从黑方视角，正值有利于黑方）
   */
  evaluateBoard(): number {
    let score = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = this.board[r][c];
        if (!p) continue;

        const value = PIECE_VALUES[p.type];
        // 位置评估
        const posTable = POSITION_TABLES[p.type];
        const posRow = p.color === Color.WHITE ? r : 7 - r;
        const posValue = posTable[posRow][c];

        if (p.color === Color.BLACK) {
          score += value + posValue;
        } else {
          score -= value + posValue;
        }
      }
    }
    return score;
  }

  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // ========== 键盘控制 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing' || this.gameOverFlag) return;
    if (this.aiThinking) return;

    switch (key) {
      case 'ArrowUp':
        this.cursorPos.row = Math.max(0, this.cursorPos.row - 1);
        break;
      case 'ArrowDown':
        this.cursorPos.row = Math.min(BOARD_SIZE - 1, this.cursorPos.row + 1);
        break;
      case 'ArrowLeft':
        this.cursorPos.col = Math.max(0, this.cursorPos.col - 1);
        break;
      case 'ArrowRight':
        this.cursorPos.col = Math.min(BOARD_SIZE - 1, this.cursorPos.col + 1);
        break;
      case ' ':
        this.handleSpacePress();
        break;
      case 'q':
      case 'Q':
        this.selectedPos = null;
        this.validMoves = [];
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }

  private handleSpacePress(): void {
    const pos = { ...this.cursorPos };

    if (this.currentTurn !== Color.WHITE) return;

    if (this.selectedPos) {
      // 已有选中棋子
      if (pos.row === this.selectedPos.row && pos.col === this.selectedPos.col) {
        // 点击同一位置，取消选择
        this.selectedPos = null;
        this.validMoves = [];
        return;
      }

      // 尝试移动
      const isValid = this.validMoves.some(m => m.row === pos.row && m.col === pos.col);
      if (isValid) {
        this.makeMove(this.selectedPos, pos);
        this.selectedPos = null;
        this.validMoves = [];

        // AI 回合
        if (!this.gameOverFlag && (this.currentTurn as string) === Color.BLACK) {
          // 使用 setTimeout 让渲染有机会更新
          setTimeout(() => {
            if (this._status === 'playing' && !this.gameOverFlag) {
              this.aiMove();
              if (this.gameOverFlag) {
                this.gameOver();
              }
            }
          }, 100);
        }
      } else {
        // 尝试选择另一个己方棋子
        const piece = this.getPiece(pos);
        if (piece && piece.color === Color.WHITE) {
          this.selectedPos = pos;
          this.validMoves = this.getLegalMoves(pos);
        } else {
          this.selectedPos = null;
          this.validMoves = [];
        }
      }
    } else {
      // 选择棋子
      const piece = this.getPiece(pos);
      if (piece && piece.color === Color.WHITE) {
        this.selectedPos = pos;
        this.validMoves = this.getLegalMoves(pos);
      }
    }
  }

  // ========== 渲染 ==========

  private renderBoard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, w, h);

    // 信息栏
    this.renderInfoBar(ctx, w);

    // 棋盘
    const offsetY = INFO_BAR_HEIGHT;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = c * CELL_SIZE;
        const y = offsetY + r * CELL_SIZE;

        // 格子颜色
        const isLight = (r + c) % 2 === 0;
        ctx.fillStyle = isLight ? COLORS.LIGHT_SQUARE : COLORS.DARK_SQUARE;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // 最后一步高亮
        if (this.lastMove) {
          if ((r === this.lastMove.from.row && c === this.lastMove.from.col) ||
            (r === this.lastMove.to.row && c === this.lastMove.to.col)) {
            ctx.fillStyle = COLORS.LAST_MOVE;
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          }
        }

        // 选中高亮
        if (this.selectedPos && r === this.selectedPos.row && c === this.selectedPos.col) {
          ctx.fillStyle = COLORS.SELECTED;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }

        // 合法移动标记
        if (this.validMoves.some(m => m.row === r && m.col === c)) {
          const piece = this.board[r][c];
          if (piece) {
            // 有棋子的位置用环形标记
            ctx.strokeStyle = COLORS.VALID_MOVE;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 2 - 4, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            // 空格用圆点标记
            ctx.fillStyle = COLORS.VALID_MOVE;
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, 8, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 将军高亮
        if (this.isCheckFlag) {
          const kingPos = this.findKing(this.currentTurn);
          if (kingPos && r === kingPos.row && c === kingPos.col) {
            ctx.fillStyle = COLORS.CHECK;
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          }
        }

        // 棋子
        const p = this.board[r][c];
        if (p) {
          ctx.font = `${CELL_SIZE - 12}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = p.color === Color.WHITE ? COLORS.WHITE_PIECE : COLORS.BLACK_PIECE;
          ctx.fillText(PIECE_SYMBOLS[p.color][p.type], x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 2);
        }
      }
    }

    // 光标
    const cx = this.cursorPos.col * CELL_SIZE;
    const cy = offsetY + this.cursorPos.row * CELL_SIZE;
    ctx.strokeStyle = COLORS.CURSOR;
    ctx.lineWidth = 3;
    ctx.strokeRect(cx + 2, cy + 2, CELL_SIZE - 4, CELL_SIZE - 4);

    // 底部信息
    this.renderBottomBar(ctx, w, h);
  }

  private renderInfoBar(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = COLORS.INFO_BG;
    ctx.fillRect(0, 0, w, INFO_BAR_HEIGHT);

    // 标题
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = COLORS.NEON;
    ctx.textAlign = 'center';
    ctx.fillText('♚ 国际象棋', w / 2, 25);

    // 当前回合
    ctx.font = '14px monospace';
    ctx.fillStyle = COLORS.TEXT;
    const turnText = this.gameOverFlag
      ? (this.isCheckmateFlag ? `将杀! ${this.winner === Color.WHITE ? '白方' : '黑方'}胜!` :
        '和棋!')
      : `${this.currentTurn === Color.WHITE ? '白方' : '黑方'}回合${this.isCheckFlag ? ' - 将军!' : ''}`;
    ctx.fillText(turnText, w / 2, 48);

    // 分数
    ctx.font = '12px monospace';
    ctx.fillStyle = COLORS.ACCENT;
    ctx.textAlign = 'left';
    ctx.fillText(`分数: ${this._score}`, 10, 68);

    // 提示
    ctx.textAlign = 'right';
    ctx.fillStyle = '#888';
    ctx.fillText('方向键移动 · 空格选择 · Q取消', w - 10, 68);
  }

  private renderBottomBar(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const bottomY = INFO_BAR_HEIGHT + BOARD_SIZE * CELL_SIZE;
    ctx.fillStyle = COLORS.INFO_BG;
    ctx.fillRect(0, bottomY, w, h - bottomY);

    // 被吃棋子
    ctx.font = '18px serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.TEXT;
    ctx.fillText('白方吃子:', 10, bottomY + 25);
    const whiteCaptured = this.capturedPieces.black;
    ctx.fillText(whiteCaptured.map(p => PIECE_SYMBOLS[p.color][p.type]).join(''), 100, bottomY + 25);

    ctx.fillText('黑方吃子:', 10, bottomY + 50);
    const blackCaptured = this.capturedPieces.white;
    ctx.fillText(blackCaptured.map(p => PIECE_SYMBOLS[p.color][p.type]).join(''), 100, bottomY + 50);

    // 游戏状态
    if (this.gameOverFlag) {
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = this.isCheckmateFlag ? '#ff4757' : '#ffd32a';
      ctx.textAlign = 'center';
      const statusText = this.isCheckmateFlag
        ? `${this.winner === Color.WHITE ? '白方' : '黑方'}获胜!`
        : '和棋!';
      ctx.fillText(statusText, w / 2, bottomY + 75);
    }
  }

  // ========== 状态 ==========

  getState(): Record<string, unknown> {
    return {
      board: this.cloneBoard(),
      currentTurn: this.currentTurn,
      isCheck: this.isCheckFlag,
      isCheckmate: this.isCheckmateFlag,
      isStalemate: this.isStalemateFlag,
      gameOver: this.gameOverFlag,
      winner: this.winner,
      moveHistory: this.moveHistory,
      castlingRights: { ...this.castlingRights },
      enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
      cursorPos: { ...this.cursorPos },
      selectedPos: this.selectedPos ? { ...this.selectedPos } : null,
      validMoves: [...this.validMoves],
      score: this._score,
    };
  }
}
