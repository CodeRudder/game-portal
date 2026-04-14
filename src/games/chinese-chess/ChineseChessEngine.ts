import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLS,
  ROWS,
  CELL_SIZE,
  BOARD_PADDING_X,
  BOARD_PADDING_Y,
  PIECE_NONE,
  PIECE_KING,
  PIECE_ADVISOR,
  PIECE_BISHOP,
  PIECE_KNIGHT,
  PIECE_ROOK,
  PIECE_CANNON,
  PIECE_PAWN,
  RED,
  BLACK,
  RED_PALACE,
  BLACK_PALACE,
  RIVER_TOP,
  RIVER_BOTTOM,
  PIECE_NAMES_RED,
  PIECE_NAMES_BLACK,
  PIECE_VALUES,
  BG_COLOR,
  BOARD_LINE_COLOR,
  RIVER_COLOR,
  RIVER_TEXT_COLOR,
  RED_PIECE_COLOR,
  RED_PIECE_BG,
  BLACK_PIECE_COLOR,
  BLACK_PIECE_BG,
  SELECTED_COLOR,
  VALID_MOVE_COLOR,
  CURSOR_COLOR,
  CHECK_COLOR,
  LAST_MOVE_COLOR,
  PIECE_RADIUS,
  AI_THINK_TIME,
  CURSOR_MOVE_DELAY,
} from './constants';

// ========== 类型定义 ==========

export interface Piece {
  type: number;   // PIECE_KING 等
  side: number;   // RED 或 BLACK
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured: Piece | null;
}

export type Board = (Piece | null)[][];

// ========== 主引擎 ==========

export class ChineseChessEngine extends GameEngine {
  // 棋盘状态
  protected board: Board = [];
  protected currentTurn: number = RED;
  protected selectedPos: Position | null = null;
  protected validMoves: Position[] = [];
  protected cursorPos: Position = { row: 9, col: 4 };
  protected moveHistory: Move[] = [];
  protected isCheckFlag = false;
  protected isCheckmateFlag = false;
  protected gameOverFlag = false;
  protected winner: number | null = null;
  public isWin = false;
  protected lastMove: { from: Position; to: Position } | null = null;
  protected aiThinking = false;
  protected lastCursorMove = 0;
  protected aiTimer: ReturnType<typeof setTimeout> | null = null;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.initBoard();
  }

  protected onStart(): void {
    this.initBoard();
    this.currentTurn = RED;
    this.selectedPos = null;
    this.validMoves = [];
    this.cursorPos = { row: 9, col: 4 };
    this.moveHistory = [];
    this.isCheckFlag = false;
    this.isCheckmateFlag = false;
    this.gameOverFlag = false;
    this.winner = null;
    this.isWin = false;
    this.lastMove = null;
    this.aiThinking = false;
  }

  protected onReset(): void {
    this.initBoard();
    this.currentTurn = RED;
    this.selectedPos = null;
    this.validMoves = [];
    this.cursorPos = { row: 9, col: 4 };
    this.moveHistory = [];
    this.isCheckFlag = false;
    this.isCheckmateFlag = false;
    this.gameOverFlag = false;
    this.winner = null;
    this.isWin = false;
    this.lastMove = null;
    this.aiThinking = false;
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  protected onDestroy(): void {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  protected update(_deltaTime: number): void {
    // 棋类游戏不需要持续更新
  }

  // ========== 棋盘初始化 ==========

  protected initBoard(): void {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

    // 黑方（上方，row 0-4）
    this.board[0][0] = { type: PIECE_ROOK, side: BLACK };
    this.board[0][1] = { type: PIECE_KNIGHT, side: BLACK };
    this.board[0][2] = { type: PIECE_BISHOP, side: BLACK };
    this.board[0][3] = { type: PIECE_ADVISOR, side: BLACK };
    this.board[0][4] = { type: PIECE_KING, side: BLACK };
    this.board[0][5] = { type: PIECE_ADVISOR, side: BLACK };
    this.board[0][6] = { type: PIECE_BISHOP, side: BLACK };
    this.board[0][7] = { type: PIECE_KNIGHT, side: BLACK };
    this.board[0][8] = { type: PIECE_ROOK, side: BLACK };
    this.board[2][1] = { type: PIECE_CANNON, side: BLACK };
    this.board[2][7] = { type: PIECE_CANNON, side: BLACK };
    this.board[3][0] = { type: PIECE_PAWN, side: BLACK };
    this.board[3][2] = { type: PIECE_PAWN, side: BLACK };
    this.board[3][4] = { type: PIECE_PAWN, side: BLACK };
    this.board[3][6] = { type: PIECE_PAWN, side: BLACK };
    this.board[3][8] = { type: PIECE_PAWN, side: BLACK };

    // 红方（下方，row 5-9）
    this.board[9][0] = { type: PIECE_ROOK, side: RED };
    this.board[9][1] = { type: PIECE_KNIGHT, side: RED };
    this.board[9][2] = { type: PIECE_BISHOP, side: RED };
    this.board[9][3] = { type: PIECE_ADVISOR, side: RED };
    this.board[9][4] = { type: PIECE_KING, side: RED };
    this.board[9][5] = { type: PIECE_ADVISOR, side: RED };
    this.board[9][6] = { type: PIECE_BISHOP, side: RED };
    this.board[9][7] = { type: PIECE_KNIGHT, side: RED };
    this.board[9][8] = { type: PIECE_ROOK, side: RED };
    this.board[7][1] = { type: PIECE_CANNON, side: RED };
    this.board[7][7] = { type: PIECE_CANNON, side: RED };
    this.board[6][0] = { type: PIECE_PAWN, side: RED };
    this.board[6][2] = { type: PIECE_PAWN, side: RED };
    this.board[6][4] = { type: PIECE_PAWN, side: RED };
    this.board[6][6] = { type: PIECE_PAWN, side: RED };
    this.board[6][8] = { type: PIECE_PAWN, side: RED };
  }

  // ========== 棋子移动规则 ==========

  /** 获取某个位置的合法移动目标列表 */
  getValidMoves(row: number, col: number): Position[] {
    const piece = this.board[row][col];
    if (!piece) return [];

    const moves: Position[] = [];
    switch (piece.type) {
      case PIECE_KING:
        this.getKingMoves(row, col, piece.side, moves);
        break;
      case PIECE_ADVISOR:
        this.getAdvisorMoves(row, col, piece.side, moves);
        break;
      case PIECE_BISHOP:
        this.getBishopMoves(row, col, piece.side, moves);
        break;
      case PIECE_KNIGHT:
        this.getKnightMoves(row, col, piece.side, moves);
        break;
      case PIECE_ROOK:
        this.getRookMoves(row, col, piece.side, moves);
        break;
      case PIECE_CANNON:
        this.getCannonMoves(row, col, piece.side, moves);
        break;
      case PIECE_PAWN:
        this.getPawnMoves(row, col, piece.side, moves);
        break;
    }

    // 过滤掉会导致自己被将军或将帅对面的移动
    return moves.filter(m => {
      const captured = this.board[m.row][m.col];
      this.board[m.row][m.col] = piece;
      this.board[row][col] = null;
      const legal = !this.isInCheck(piece.side) && !this.kingsOpposing();
      this.board[row][col] = piece;
      this.board[m.row][m.col] = captured;
      return legal;
    });
  }

  /** 将/帅：九宫内一步直走 */
  protected getKingMoves(row: number, col: number, side: number, moves: Position[]): void {
    const palace = side === RED ? RED_PALACE : BLACK_PALACE;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= palace.minRow && nr <= palace.maxRow && nc >= palace.minCol && nc <= palace.maxCol) {
        const target = this.board[nr][nc];
        if (!target || target.side !== side) {
          moves.push({ row: nr, col: nc });
        }
      }
    }
  }

  /** 士/仕：九宫内斜走一格 */
  protected getAdvisorMoves(row: number, col: number, side: number, moves: Position[]): void {
    const palace = side === RED ? RED_PALACE : BLACK_PALACE;
    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= palace.minRow && nr <= palace.maxRow && nc >= palace.minCol && nc <= palace.maxCol) {
        const target = this.board[nr][nc];
        if (!target || target.side !== side) {
          moves.push({ row: nr, col: nc });
        }
      }
    }
  }

  /** 象/相：走"田"字，不能过河，有蹩脚 */
  protected getBishopMoves(row: number, col: number, side: number, moves: Position[]): void {
    const dirs = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
    const blocks = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // 蹩脚点

    for (let i = 0; i < dirs.length; i++) {
      const nr = row + dirs[i][0];
      const nc = col + dirs[i][1];
      const br = row + blocks[i][0];
      const bc = col + blocks[i][1];

      // 边界检查
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;

      // 不能过河
      if (side === RED && nr < RIVER_BOTTOM) continue;
      if (side === BLACK && nr > RIVER_TOP) continue;

      // 蹩脚检查
      if (this.board[br][bc]) continue;

      const target = this.board[nr][nc];
      if (!target || target.side !== side) {
        moves.push({ row: nr, col: nc });
      }
    }
  }

  /** 马：走"日"字，有蹩脚 */
  protected getKnightMoves(row: number, col: number, side: number, moves: Position[]): void {
    // 8 个方向及对应的蹩脚位置
    const knightDirs: [number, number, number, number][] = [
      [-2, -1, -1, 0], [-2, 1, -1, 0],
      [2, -1, 1, 0], [2, 1, 1, 0],
      [-1, -2, 0, -1], [-1, 2, 0, 1],
      [1, -2, 0, -1], [1, 2, 0, 1],
    ];

    for (const [dr, dc, br, bc] of knightDirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;

      // 蹩脚检查
      if (this.board[row + br][col + bc]) continue;

      const target = this.board[nr][nc];
      if (!target || target.side !== side) {
        moves.push({ row: nr, col: nc });
      }
    }
  }

  /** 车：直线任意格 */
  protected getRookMoves(row: number, col: number, side: number, moves: Position[]): void {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      let nr = row + dr;
      let nc = col + dc;
      while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        const target = this.board[nr][nc];
        if (!target) {
          moves.push({ row: nr, col: nc });
        } else {
          if (target.side !== side) {
            moves.push({ row: nr, col: nc });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  /** 炮：直线移动，吃子需隔一个棋子（炮架） */
  protected getCannonMoves(row: number, col: number, side: number, moves: Position[]): void {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      let nr = row + dr;
      let nc = col + dc;
      let jumped = false;
      while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        const target = this.board[nr][nc];
        if (!jumped) {
          if (!target) {
            moves.push({ row: nr, col: nc });
          } else {
            jumped = true; // 找到炮架
          }
        } else {
          if (target) {
            if (target.side !== side) {
              moves.push({ row: nr, col: nc });
            }
            break; // 无论是否吃子，遇到第二个棋子就停
          }
        }
        nr += dr;
        nc += dc;
      }
    }
  }

  /** 兵/卒：过河前只能前进，过河后可左右 */
  protected getPawnMoves(row: number, col: number, side: number, moves: Position[]): void {
    const forward = side === RED ? -1 : 1;
    const crossedRiver = side === RED ? row <= RIVER_TOP : row >= RIVER_BOTTOM;

    // 前进
    const fr = row + forward;
    if (fr >= 0 && fr < ROWS) {
      const target = this.board[fr][col];
      if (!target || target.side !== side) {
        moves.push({ row: fr, col: col });
      }
    }

    // 过河后可左右
    if (crossedRiver) {
      for (const dc of [-1, 1]) {
        const nc = col + dc;
        if (nc >= 0 && nc < COLS) {
          const target = this.board[row][nc];
          if (!target || target.side !== side) {
            moves.push({ row: row, col: nc });
          }
        }
      }
    }
  }

  // ========== 将军与将杀检测 ==========

  /** 检查指定方是否被将军 */
  isInCheck(side: number): boolean {
    // 找到己方将/帅的位置
    let kingRow = -1, kingCol = -1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.board[r][c];
        if (p && p.type === PIECE_KING && p.side === side) {
          kingRow = r;
          kingCol = c;
          break;
        }
      }
      if (kingRow >= 0) break;
    }
    if (kingRow < 0) return true; // 将/帅不存在（被吃了）

    // 检查对方所有棋子是否能攻击到将/帅
    const opponent = side === RED ? BLACK : RED;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.board[r][c];
        if (p && p.side === opponent) {
          const rawMoves = this.getRawMoves(r, c);
          if (rawMoves.some(m => m.row === kingRow && m.col === kingCol)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /** 获取原始移动（不考虑将军过滤，用于检测是否被攻击） */
  protected getRawMoves(row: number, col: number): Position[] {
    const piece = this.board[row][col];
    if (!piece) return [];
    const moves: Position[] = [];
    switch (piece.type) {
      case PIECE_KING: this.getKingMoves(row, col, piece.side, moves); break;
      case PIECE_ADVISOR: this.getAdvisorMoves(row, col, piece.side, moves); break;
      case PIECE_BISHOP: this.getBishopMoves(row, col, piece.side, moves); break;
      case PIECE_KNIGHT: this.getKnightMoves(row, col, piece.side, moves); break;
      case PIECE_ROOK: this.getRookMoves(row, col, piece.side, moves); break;
      case PIECE_CANNON: this.getCannonMoves(row, col, piece.side, moves); break;
      case PIECE_PAWN: this.getPawnMoves(row, col, piece.side, moves); break;
    }
    return moves;
  }

  /** 检查将帅是否对面（同一列无棋子阻隔） */
  kingsOpposing(): boolean {
    let redKingRow = -1, redKingCol = -1;
    let blackKingRow = -1, blackKingCol = -1;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.board[r][c];
        if (p && p.type === PIECE_KING) {
          if (p.side === RED) { redKingRow = r; redKingCol = c; }
          else { blackKingRow = r; blackKingCol = c; }
        }
      }
    }

    if (redKingCol !== blackKingCol) return false;

    // 检查两将之间是否有棋子
    const minRow = Math.min(redKingRow, blackKingRow);
    const maxRow = Math.max(redKingRow, blackKingRow);
    for (let r = minRow + 1; r < maxRow; r++) {
      if (this.board[r][redKingCol]) return false;
    }
    return true;
  }

  /** 检查指定方是否被将杀（无合法移动） */
  isCheckmate(side: number): boolean {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.board[r][c];
        if (p && p.side === side) {
          if (this.getValidMoves(r, c).length > 0) return false;
        }
      }
    }
    return true;
  }

  // ========== 执行移动 ==========

  /** 执行移动，返回移动记录 */
  makeMove(from: Position, to: Position): Move | null {
    const piece = this.board[from.row][from.col];
    if (!piece) return null;

    const captured = this.board[to.row][to.col];
    const move: Move = { from, to, piece, captured };

    this.board[to.row][to.col] = piece;
    this.board[from.row][from.col] = null;

    this.moveHistory.push(move);
    this.lastMove = { from, to };

    // 吃子计分
    if (captured) {
      this.addScore(PIECE_VALUES[captured.type] || 0);
    }

    // 检查是否吃掉了对方的将/帅
    if (captured && captured.type === PIECE_KING) {
      this.gameOverFlag = true;
      this.winner = piece.side;
      this.isWin = piece.side === RED;
    }

    // 切换回合
    this.currentTurn = this.currentTurn === RED ? BLACK : RED;

    // 检查对方是否被将军
    this.isCheckFlag = this.isInCheck(this.currentTurn);

    // 检查对方是否被将杀
    if (this.isCheckFlag && this.isCheckmate(this.currentTurn)) {
      this.isCheckmateFlag = true;
      this.gameOverFlag = true;
      this.winner = this.currentTurn === RED ? BLACK : RED;
      this.isWin = this.winner === RED;
    }

    // 如果没有合法移动但没被将军（困毙）
    if (!this.isCheckFlag && this.isCheckmate(this.currentTurn)) {
      this.gameOverFlag = true;
      this.winner = this.currentTurn === RED ? BLACK : RED;
      this.isWin = this.winner === RED;
    }

    if (this.gameOverFlag) {
      this.addScore(this.winner === RED ? 1 : 0);
      this.gameOver();
    }

    return move;
  }

  // ========== AI ==========

  /** AI 走棋（贪心策略） */
  protected aiMove(): void {
    if (this.gameOverFlag) return;

    const allMoves: { from: Position; to: Position; score: number }[] = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.board[r][c];
        if (p && p.side === BLACK) {
          const moves = this.getValidMoves(r, c);
          for (const m of moves) {
            const score = this.evaluateMove(r, c, m.row, m.col);
            allMoves.push({ from: { row: r, col: c }, to: m, score });
          }
        }
      }
    }

    if (allMoves.length === 0) {
      // 无走法可走，判负
      this.gameOverFlag = true;
      this.winner = RED;
      this.isWin = true;
      this.addScore(1);
      this.gameOver();
      return;
    }

    // 按分数排序，选最高分（加一点随机性）
    allMoves.sort((a, b) => b.score - a.score);
    const bestScore = allMoves[0].score;
    const bestMoves = allMoves.filter(m => m.score === bestScore);
    const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];

    this.selectedPos = null;
    this.validMoves = [];
    this.makeMove(chosen.from, chosen.to);
    this.emit('stateChange');
  }

  /** 触发 AI 走棋（延迟执行） */
  triggerAI(): void {
    if (this.aiThinking || this.gameOverFlag) return;
    this.aiThinking = true;
    this.aiTimer = setTimeout(() => {
      this.aiThinking = false;
      this.aiMove();
      this.render();
    }, AI_THINK_TIME);
  }

  /** 评估一步移动的分数（贪心策略） */
  protected evaluateMove(fromRow: number, fromCol: number, toRow: number, toCol: number): number {
    const piece = this.board[fromRow][fromCol]!;
    const target = this.board[toRow][toCol];
    let score = 0;

    // 吃子分值
    if (target) {
      score += PIECE_VALUES[target.type] || 0;
    }

    // 位置分：向前推进
    if (piece.side === BLACK) {
      score += toRow * 2; // 黑方向下推进
    } else {
      score += (ROWS - 1 - toRow) * 2;
    }

    // 兵过河加分
    if (piece.type === PIECE_PAWN) {
      if (piece.side === BLACK && toRow >= RIVER_BOTTOM) {
        score += 50;
      }
      if (piece.side === RED && toRow <= RIVER_TOP) {
        score += 50;
      }
    }

    // 控制中心
    const centerDist = Math.abs(toCol - 4);
    score += (4 - centerDist) * 3;

    // 模拟移动检查是否将军对方
    const captured = this.board[toRow][toCol];
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;
    const opponentSide = piece.side === RED ? BLACK : RED;
    if (this.isInCheck(opponentSide)) {
      score += 200;
    }
    // 检查移动后自己是否被将军（惩罚）
    if (this.isInCheck(piece.side)) {
      score -= 5000;
    }
    this.board[fromRow][fromCol] = piece;
    this.board[toRow][toCol] = captured;

    return score;
  }

  // ========== 键盘控制 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing' || this.gameOverFlag) return;
    if (this.aiThinking) return;

    const now = Date.now();

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        if (now - this.lastCursorMove >= CURSOR_MOVE_DELAY) {
          this.cursorPos.row = Math.max(0, this.cursorPos.row - 1);
          this.lastCursorMove = now;
          this.render();
        }
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        if (now - this.lastCursorMove >= CURSOR_MOVE_DELAY) {
          this.cursorPos.row = Math.min(ROWS - 1, this.cursorPos.row + 1);
          this.lastCursorMove = now;
          this.render();
        }
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        if (now - this.lastCursorMove >= CURSOR_MOVE_DELAY) {
          this.cursorPos.col = Math.max(0, this.cursorPos.col - 1);
          this.lastCursorMove = now;
          this.render();
        }
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (now - this.lastCursorMove >= CURSOR_MOVE_DELAY) {
          this.cursorPos.col = Math.min(COLS - 1, this.cursorPos.col + 1);
          this.lastCursorMove = now;
          this.render();
        }
        break;
      case ' ':
        this.handleSelect();
        break;
      case 'q':
      case 'Q':
        this.selectedPos = null;
        this.validMoves = [];
        this.render();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }

  /** 处理选择/落子 */
  protected handleSelect(): void {
    const { row, col } = this.cursorPos;

    if (this.selectedPos) {
      // 已选中棋子，尝试移动
      if (this.validMoves.some(m => m.row === row && m.col === col)) {
        // 合法移动
        this.makeMove(this.selectedPos, { row, col });
        this.selectedPos = null;
        this.validMoves = [];
        this.render();
        // 触发 AI
        if (!this.gameOverFlag && this.currentTurn === BLACK) {
          this.triggerAI();
        }
      } else {
        // 点击了非合法位置
        const piece = this.board[row][col];
        if (piece && piece.side === this.currentTurn) {
          // 选择另一个己方棋子
          this.selectedPos = { row, col };
          this.validMoves = this.getValidMoves(row, col);
          this.render();
        } else {
          // 取消选择
          this.selectedPos = null;
          this.validMoves = [];
          this.render();
        }
      }
    } else {
      // 未选中，选择棋子
      const piece = this.board[row][col];
      if (piece && piece.side === this.currentTurn) {
        this.selectedPos = { row, col };
        this.validMoves = this.getValidMoves(row, col);
        this.render();
      }
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    this.drawBoard(ctx);
    this.drawLastMove(ctx);
    this.drawPieces(ctx);
    this.drawSelection(ctx);
    this.drawValidMoves(ctx);
    this.drawCursor(ctx);
    this.drawCheckHighlight(ctx);
    this.drawStatus(ctx);
  }

  /** 绘制棋盘 */
  protected drawBoard(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = BOARD_LINE_COLOR;
    ctx.lineWidth = 1.5;

    // 横线
    for (let r = 0; r < ROWS; r++) {
      const y = BOARD_PADDING_Y + r * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(BOARD_PADDING_X, y);
      ctx.lineTo(BOARD_PADDING_X + (COLS - 1) * CELL_SIZE, y);
      ctx.stroke();
    }

    // 竖线（上下半区分开，中间河界只有边线）
    for (let c = 0; c < COLS; c++) {
      // 上半区
      ctx.beginPath();
      ctx.moveTo(BOARD_PADDING_X + c * CELL_SIZE, BOARD_PADDING_Y);
      ctx.lineTo(BOARD_PADDING_X + c * CELL_SIZE, BOARD_PADDING_Y + RIVER_TOP * CELL_SIZE);
      ctx.stroke();
      // 下半区
      ctx.beginPath();
      ctx.moveTo(BOARD_PADDING_X + c * CELL_SIZE, BOARD_PADDING_Y + RIVER_BOTTOM * CELL_SIZE);
      ctx.lineTo(BOARD_PADDING_X + c * CELL_SIZE, BOARD_PADDING_Y + (ROWS - 1) * CELL_SIZE);
      ctx.stroke();
    }

    // 河界边线（左右边线贯穿）
    ctx.beginPath();
    ctx.moveTo(BOARD_PADDING_X, BOARD_PADDING_Y + RIVER_TOP * CELL_SIZE);
    ctx.lineTo(BOARD_PADDING_X, BOARD_PADDING_Y + RIVER_BOTTOM * CELL_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(BOARD_PADDING_X + (COLS - 1) * CELL_SIZE, BOARD_PADDING_Y + RIVER_TOP * CELL_SIZE);
    ctx.lineTo(BOARD_PADDING_X + (COLS - 1) * CELL_SIZE, BOARD_PADDING_Y + RIVER_BOTTOM * CELL_SIZE);
    ctx.stroke();

    // 楚河汉界文字
    const riverY = BOARD_PADDING_Y + (RIVER_TOP + 0.5) * CELL_SIZE;
    ctx.fillStyle = RIVER_TEXT_COLOR;
    ctx.font = 'bold 22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚 河', BOARD_PADDING_X + 2 * CELL_SIZE, riverY);
    ctx.fillText('漢 界', BOARD_PADDING_X + 6 * CELL_SIZE, riverY);

    // 九宫斜线
    this.drawPalaceDiagonals(ctx, RED_PALACE);
    this.drawPalaceDiagonals(ctx, BLACK_PALACE);
  }

  /** 绘制九宫斜线 */
  protected drawPalaceDiagonals(ctx: CanvasRenderingContext2D, palace: typeof RED_PALACE): void {
    const x1 = BOARD_PADDING_X + palace.minCol * CELL_SIZE;
    const y1 = BOARD_PADDING_Y + palace.minRow * CELL_SIZE;
    const x2 = BOARD_PADDING_X + palace.maxCol * CELL_SIZE;
    const y2 = BOARD_PADDING_Y + palace.maxRow * CELL_SIZE;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y1);
    ctx.lineTo(x1, y2);
    ctx.stroke();
  }

  /** 绘制上一步移动标记 */
  protected drawLastMove(ctx: CanvasRenderingContext2D): void {
    if (!this.lastMove) return;
    ctx.fillStyle = LAST_MOVE_COLOR;
    for (const pos of [this.lastMove.from, this.lastMove.to]) {
      const x = BOARD_PADDING_X + pos.col * CELL_SIZE;
      const y = BOARD_PADDING_Y + pos.row * CELL_SIZE;
      ctx.beginPath();
      ctx.arc(x, y, PIECE_RADIUS + 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 绘制棋子 */
  protected drawPieces(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = this.board[r][c];
        if (!piece) continue;
        this.drawPiece(ctx, r, c, piece);
      }
    }
  }

  /** 绘制单个棋子 */
  protected drawPiece(ctx: CanvasRenderingContext2D, row: number, col: number, piece: Piece): void {
    const x = BOARD_PADDING_X + col * CELL_SIZE;
    const y = BOARD_PADDING_Y + row * CELL_SIZE;

    // 棋子背景
    ctx.fillStyle = RED_PIECE_BG;
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 棋子边框
    ctx.strokeStyle = piece.side === RED ? RED_PIECE_COLOR : BLACK_PIECE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // 内圈
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS - 4, 0, Math.PI * 2);
    ctx.stroke();

    // 棋子文字
    const names = piece.side === RED ? PIECE_NAMES_RED : PIECE_NAMES_BLACK;
    ctx.fillStyle = piece.side === RED ? RED_PIECE_COLOR : BLACK_PIECE_COLOR;
    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(names[piece.type] || '?', x, y + 1);
  }

  /** 绘制选中状态 */
  protected drawSelection(ctx: CanvasRenderingContext2D): void {
    if (!this.selectedPos) return;
    const x = BOARD_PADDING_X + this.selectedPos.col * CELL_SIZE;
    const y = BOARD_PADDING_Y + this.selectedPos.row * CELL_SIZE;
    ctx.fillStyle = SELECTED_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS + 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 绘制合法移动位置 */
  protected drawValidMoves(ctx: CanvasRenderingContext2D): void {
    for (const m of this.validMoves) {
      const x = BOARD_PADDING_X + m.col * CELL_SIZE;
      const y = BOARD_PADDING_Y + m.row * CELL_SIZE;
      const target = this.board[m.row][m.col];
      if (target) {
        // 吃子标记：红色圆环
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, PIECE_RADIUS + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // 空位标记：蓝色小圆点
        ctx.fillStyle = VALID_MOVE_COLOR;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** 绘制光标 */
  protected drawCursor(ctx: CanvasRenderingContext2D): void {
    const x = BOARD_PADDING_X + this.cursorPos.col * CELL_SIZE;
    const y = BOARD_PADDING_Y + this.cursorPos.row * CELL_SIZE;
    ctx.strokeStyle = CURSOR_COLOR;
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** 绘制将军高亮 */
  protected drawCheckHighlight(ctx: CanvasRenderingContext2D): void {
    if (!this.isCheckFlag) return;
    // 找到被将军方的将/帅
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = this.board[r][c];
        if (p && p.type === PIECE_KING && p.side === this.currentTurn) {
          const x = BOARD_PADDING_X + c * CELL_SIZE;
          const y = BOARD_PADDING_Y + r * CELL_SIZE;
          ctx.fillStyle = CHECK_COLOR;
          ctx.beginPath();
          ctx.arc(x, y, PIECE_RADIUS + 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  /** 绘制状态文字 */
  protected drawStatus(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = BOARD_LINE_COLOR;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    let text = this.currentTurn === RED ? '红方走棋' : '黑方走棋';
    if (this.isCheckFlag) text = (this.currentTurn === RED ? '红方' : '黑方') + ' 被将军！';
    if (this.gameOverFlag) {
      text = this.winner === RED ? '红方胜！' : '黑方胜！';
    }
    if (this.aiThinking) text = 'AI 思考中...';

    ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 24);
  }

  // ========== 状态导出 ==========

  getState(): Record<string, unknown> {
    return {
      board: this.board.map(row => row.map(cell => cell ? { type: cell.type, side: cell.side } : null)),
      currentTurn: this.currentTurn,
      selectedPos: this.selectedPos,
      cursorPos: this.cursorPos,
      moveHistory: this.moveHistory,
      isCheck: this.isCheckFlag,
      isCheckmate: this.isCheckmateFlag,
      gameOver: this.gameOverFlag,
      winner: this.winner,
      lastMove: this.lastMove,
    };
  }
}
