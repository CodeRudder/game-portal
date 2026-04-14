import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  BOARD_SIZE, CELL_SIZE, BOARD_OFFSET_X, BOARD_OFFSET_Y,
  EMPTY, BLACK, WHITE,
  DIRECTIONS, STAR_POINTS,
  BG_COLOR, BOARD_COLOR, BOARD_BORDER_COLOR, GRID_COLOR,
  BLACK_STONE_COLOR, WHITE_STONE_COLOR, CURSOR_COLOR,
  TERRITORY_BLACK_COLOR, TERRITORY_WHITE_COLOR,
  LAST_MOVE_MARKER_COLOR, TEXT_COLOR, SCORE_TEXT_COLOR,
  TERRITORY_BLACK, TERRITORY_WHITE,
  KOMI,
} from './constants';

/** 落子结果 */
export interface MoveResult {
  success: boolean;
  captured: number;
  reason?: string;
}

/** AI 难度 */
export type AIDifficulty = 'easy' | 'medium' | 'hard';

/**
 * 围棋 9×9 Mini Go 游戏引擎
 *
 * 核心规则：
 * - 黑先白后交替落子
 * - 提子规则：无气的棋子被提走
 * - 禁入点：不能自杀（除非能提对方子）
 * - 劫争：不能立即回提（Ko 规则）
 * - 虚手（Pass）：双方连续 Pass 则终局
 * - 领地计算：数子法（中国规则简化）
 * - 白方使用贪心 AI 策略
 */
export class MiniGoEngine extends GameEngine {
  // ========== 棋盘状态 ==========
  private _board: number[][] = [];
  private _currentPlayer: number = BLACK;
  private _cursorRow: number = 4;
  private _cursorCol: number = 4;
  private _blackCaptures: number = 0; // 黑方提子数
  private _whiteCaptures: number = 0; // 白方提子数
  private _lastMove: { row: number; col: number } | null = null;
  private _previousBoard: number[][] | null = null; // 用于 Ko 检测
  private _passCount: number = 0;
  private _gameOver: boolean = false;
  private _moveHistory: { row: number; col: number; player: number }[] = [];
  private _moveCount: number = 0;

  // ========== 领地计算结果 ==========
  private _territory: number[][] = [];
  private _blackTerritory: number = 0;
  private _whiteTerritory: number = 0;
  private _blackScore: number = 0;
  private _whiteScore: number = 0;
  private _showTerritory: boolean = false;
  private _winner: number = EMPTY; // EMPTY=平局

  // ========== AI ==========
  private _aiEnabled: boolean = true;
  private _aiThinking: boolean = false;
  private _aiDifficulty: AIDifficulty = 'medium';

  // ========== 公共属性 ==========

  get board(): number[][] { return this._board.map(r => [...r]); }
  get currentPlayer(): number { return this._currentPlayer; }
  get cursorRow(): number { return this._cursorRow; }
  get cursorCol(): number { return this._cursorCol; }
  get blackCaptures(): number { return this._blackCaptures; }
  get whiteCaptures(): number { return this._whiteCaptures; }
  get lastMove(): { row: number; col: number } | null { return this._lastMove; }
  get passCount(): number { return this._passCount; }
  get isGameOver(): boolean { return this._gameOver; }
  get moveHistory(): { row: number; col: number; player: number }[] { return [...this._moveHistory]; }
  get moveCount(): number { return this._moveCount; }
  get territory(): number[][] { return this._territory.map(r => [...r]); }
  get blackTerritory(): number { return this._blackTerritory; }
  get whiteTerritory(): number { return this._whiteTerritory; }
  get blackScore(): number { return this._blackScore; }
  get whiteScore(): number { return this._whiteScore; }
  get showTerritory(): boolean { return this._showTerritory; }
  get winner(): number { return this._winner; }
  get aiEnabled(): boolean { return this._aiEnabled; }
  get aiThinking(): boolean { return this._aiThinking; }
  get aiDifficulty(): AIDifficulty { return this._aiDifficulty; }
  get isWin(): boolean {
    if (!this._gameOver) return false;
    return this._winner === BLACK;
  }

  // ========== 生命周期方法 ==========

  protected onInit(): void {
    this._board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
    this._currentPlayer = BLACK;
    this._cursorRow = 4;
    this._cursorCol = 4;
    this._blackCaptures = 0;
    this._whiteCaptures = 0;
    this._lastMove = null;
    this._previousBoard = null;
    this._passCount = 0;
    this._gameOver = false;
    this._moveHistory = [];
    this._moveCount = 0;
    this._territory = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    this._blackTerritory = 0;
    this._whiteTerritory = 0;
    this._blackScore = 0;
    this._whiteScore = 0;
    this._showTerritory = false;
    this._winner = EMPTY;
    this._aiThinking = false;
  }

  protected onStart(): void {
    this.onInit();
  }

  protected update(_deltaTime: number): void {
    // AI 回合
    if (this._aiEnabled && this._currentPlayer === WHITE && !this._gameOver && !this._aiThinking) {
      this._aiThinking = true;
      this.aiMove();
      this._aiThinking = false;
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 棋盘底色
    const boardLeft = BOARD_OFFSET_X - CELL_SIZE / 2;
    const boardTop = BOARD_OFFSET_Y - CELL_SIZE / 2;
    const boardSize = CELL_SIZE * (BOARD_SIZE - 1) + CELL_SIZE;

    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(boardLeft, boardTop, boardSize, boardSize);

    // 棋盘边框
    ctx.strokeStyle = BOARD_BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(boardLeft, boardTop, boardSize, boardSize);

    // 网格线
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let i = 0; i < BOARD_SIZE; i++) {
      // 横线
      ctx.beginPath();
      ctx.moveTo(BOARD_OFFSET_X, BOARD_OFFSET_Y + i * CELL_SIZE);
      ctx.lineTo(BOARD_OFFSET_X + (BOARD_SIZE - 1) * CELL_SIZE, BOARD_OFFSET_Y + i * CELL_SIZE);
      ctx.stroke();
      // 竖线
      ctx.beginPath();
      ctx.moveTo(BOARD_OFFSET_X + i * CELL_SIZE, BOARD_OFFSET_Y);
      ctx.lineTo(BOARD_OFFSET_X + i * CELL_SIZE, BOARD_OFFSET_Y + (BOARD_SIZE - 1) * CELL_SIZE);
      ctx.stroke();
    }

    // 星位
    ctx.fillStyle = GRID_COLOR;
    for (const [r, c] of STAR_POINTS) {
      ctx.beginPath();
      ctx.arc(
        BOARD_OFFSET_X + c * CELL_SIZE,
        BOARD_OFFSET_Y + r * CELL_SIZE,
        4, 0, Math.PI * 2
      );
      ctx.fill();
    }

    // 领地显示
    if (this._showTerritory) {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (this._territory[r][c] === TERRITORY_BLACK) {
            ctx.fillStyle = TERRITORY_BLACK_COLOR;
            ctx.fillRect(
              BOARD_OFFSET_X + c * CELL_SIZE - CELL_SIZE / 4,
              BOARD_OFFSET_Y + r * CELL_SIZE - CELL_SIZE / 4,
              CELL_SIZE / 2, CELL_SIZE / 2
            );
          } else if (this._territory[r][c] === TERRITORY_WHITE) {
            ctx.fillStyle = TERRITORY_WHITE_COLOR;
            ctx.fillRect(
              BOARD_OFFSET_X + c * CELL_SIZE - CELL_SIZE / 4,
              BOARD_OFFSET_Y + r * CELL_SIZE - CELL_SIZE / 4,
              CELL_SIZE / 2, CELL_SIZE / 2
            );
          }
        }
      }
    }

    // 棋子
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] === EMPTY) continue;
        const cx = BOARD_OFFSET_X + c * CELL_SIZE;
        const cy = BOARD_OFFSET_Y + r * CELL_SIZE;
        const radius = CELL_SIZE / 2 - 3;

        if (this._board[r][c] === BLACK) {
          ctx.fillStyle = BLACK_STONE_COLOR;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          // 光泽效果
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.beginPath();
          ctx.arc(cx - radius * 0.25, cy - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = WHITE_STONE_COLOR;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          // 边框
          ctx.strokeStyle = '#999';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // 最后一手标记
    if (this._lastMove) {
      const cx = BOARD_OFFSET_X + this._lastMove.col * CELL_SIZE;
      const cy = BOARD_OFFSET_Y + this._lastMove.row * CELL_SIZE;
      ctx.fillStyle = LAST_MOVE_MARKER_COLOR;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 光标
    if (!this._gameOver) {
      const cx = BOARD_OFFSET_X + this._cursorCol * CELL_SIZE;
      const cy = BOARD_OFFSET_Y + this._cursorRow * CELL_SIZE;
      ctx.strokeStyle = CURSOR_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL_SIZE / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HUD 信息
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 14px monospace';

    if (this._gameOver) {
      ctx.fillStyle = SCORE_TEXT_COLOR;
      ctx.font = 'bold 16px monospace';
      const resultText = this._winner === BLACK ? '⚫ 黑胜！' :
        this._winner === WHITE ? '⚪ 白胜！' : '平局！';
      ctx.fillText(resultText, 10, 20);
      ctx.font = '12px monospace';
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(`黑: ${this._blackScore.toFixed(1)}  白: ${this._whiteScore.toFixed(1)} (贴${KOMI})`, 10, 40);
    } else {
      const turnText = this._currentPlayer === BLACK ? '⚫ 黑方落子' : '⚪ 白方思考...';
      ctx.fillText(turnText, 10, 20);
    }

    ctx.font = '12px monospace';
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`提子 黑:${this._blackCaptures} 白:${this._whiteCaptures}`, 10, h - 20);
    ctx.fillText(`手数: ${this._moveCount}`, 300, h - 20);

    // 控制提示
    ctx.font = '11px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('方向键移动 空格落子 P虚手', 100, h - 5);
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    if (this._gameOver) return;

    switch (key) {
      case 'ArrowUp':
        this._cursorRow = Math.max(0, this._cursorRow - 1);
        break;
      case 'ArrowDown':
        this._cursorRow = Math.min(BOARD_SIZE - 1, this._cursorRow + 1);
        break;
      case 'ArrowLeft':
        this._cursorCol = Math.max(0, this._cursorCol - 1);
        break;
      case 'ArrowRight':
        this._cursorCol = Math.min(BOARD_SIZE - 1, this._cursorCol + 1);
        break;
      case ' ':
        if (this._currentPlayer === BLACK) {
          this.placeStone(this._cursorRow, this._cursorCol);
        }
        break;
      case 'p':
      case 'P':
        if (this._currentPlayer === BLACK) {
          this.pass();
        }
        break;
    }
  }

  handleKeyUp(_key: string): void {}

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      board: this._board,
      currentPlayer: this._currentPlayer,
      cursorRow: this._cursorRow,
      cursorCol: this._cursorCol,
      blackCaptures: this._blackCaptures,
      whiteCaptures: this._whiteCaptures,
      lastMove: this._lastMove,
      passCount: this._passCount,
      isGameOver: this._gameOver,
      moveHistory: this._moveHistory,
      moveCount: this._moveCount,
      territory: this._territory,
      blackTerritory: this._blackTerritory,
      whiteTerritory: this._whiteTerritory,
      blackScore: this._blackScore,
      whiteScore: this._whiteScore,
      winner: this._winner,
      aiEnabled: this._aiEnabled,
    };
  }

  // ========== 公共方法 ==========

  /**
   * 在指定位置落子
   * @returns MoveResult 包含是否成功、提子数和失败原因
   */
  placeStone(row: number, col: number): MoveResult {
    if (this._gameOver) {
      return { success: false, captured: 0, reason: '游戏已结束' };
    }

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return { success: false, captured: 0, reason: '超出棋盘范围' };
    }

    if (this._board[row][col] !== EMPTY) {
      return { success: false, captured: 0, reason: '此处已有棋子' };
    }

    // 保存当前棋盘状态（用于 Ko 检测）
    const savedBoard = this._board.map(r => [...r]);
    const savedPreviousBoard = this._previousBoard;

    // 临时放置棋子
    this._board[row][col] = this._currentPlayer;

    // 计算对方被提的子
    const opponent = this._currentPlayer === BLACK ? WHITE : BLACK;
    let totalCaptured = 0;
    const capturedPositions: [number, number][] = [];

    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && this._board[nr][nc] === opponent) {
        const group = this.getGroup(nr, nc);
        const liberties = this.getGroupLiberties(group);
        if (liberties === 0) {
          // 提子
          for (const [gr, gc] of group) {
            this._board[gr][gc] = EMPTY;
            capturedPositions.push([gr, gc]);
          }
          totalCaptured += group.length;
        }
      }
    }

    // 检查自杀
    const selfGroup = this.getGroup(row, col);
    const selfLiberties = this.getGroupLiberties(selfGroup);
    if (selfLiberties === 0) {
      // 自杀 — 恢复棋盘
      this._board = savedBoard;
      return { success: false, captured: 0, reason: '禁入点（自杀）' };
    }

    // 检查 Ko（劫争）
    if (this.isKoViolation(this._board)) {
      this._board = savedBoard;
      return { success: false, captured: 0, reason: '劫争禁手' };
    }

    // 落子成功
    this._previousBoard = savedBoard;
    this._lastMove = { row, col };
    this._passCount = 0;
    this._moveCount++;
    this._moveHistory.push({ row, col, player: this._currentPlayer });

    // 更新提子数
    if (this._currentPlayer === BLACK) {
      this._blackCaptures += totalCaptured;
    } else {
      this._whiteCaptures += totalCaptured;
    }

    // 更新分数（用提子数作为分数）
    this.addScore(totalCaptured);

    // 切换玩家
    this._currentPlayer = opponent;

    this.emit('move', { row, col, player: this._currentPlayer === WHITE ? BLACK : WHITE, captured: totalCaptured });
    this.emit('stateChange', this.getState());

    return { success: true, captured: totalCaptured };
  }

  /**
   * 虚手（Pass）
   */
  pass(): void {
    if (this._gameOver) return;

    this._passCount++;
    this._moveCount++;
    this._moveHistory.push({ row: -1, col: -1, player: this._currentPlayer });

    const passer = this._currentPlayer;
    this._currentPlayer = this._currentPlayer === BLACK ? WHITE : BLACK;

    this.emit('pass', { player: passer });
    this.emit('stateChange', this.getState());

    // 双方连续 Pass → 终局
    if (this._passCount >= 2) {
      this.endGame();
    }
  }

  /**
   * 设置 AI 是否启用
   */
  setAI(enabled: boolean): void {
    this._aiEnabled = enabled;
  }

  /**
   * 设置 AI 难度
   */
  setAIDifficulty(difficulty: AIDifficulty): void {
    this._aiDifficulty = difficulty;
  }

  /**
   * 获取指定位置的合法状态
   */
  isValidMove(row: number, col: number): boolean {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
    if (this._board[row][col] !== EMPTY) return false;
    if (this._gameOver) return false;

    // 模拟落子
    const testBoard = this._board.map(r => [...r]);
    testBoard[row][col] = this._currentPlayer;

    const opponent = this._currentPlayer === BLACK ? WHITE : BLACK;
    let captured = 0;

    // 检查是否能提对方的子
    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && testBoard[nr][nc] === opponent) {
        const group = this.getGroupOnBoard(testBoard, nr, nc);
        const liberties = this.getGroupLibertiesOnBoard(testBoard, group);
        if (liberties === 0) {
          captured += group.length;
          for (const [gr, gc] of group) {
            testBoard[gr][gc] = EMPTY;
          }
        }
      }
    }

    // 检查自杀
    const selfGroup = this.getGroupOnBoard(testBoard, row, col);
    const selfLiberties = this.getGroupLibertiesOnBoard(testBoard, selfGroup);
    if (selfLiberties === 0) return false;

    // 检查 Ko
    if (this.isKoViolation(testBoard)) return false;

    return true;
  }

  /**
   * 获取所有合法落子位置
   */
  getValidMoves(): { row: number; col: number }[] {
    const moves: { row: number; col: number }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.isValidMove(r, c)) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  }

  /**
   * 计算领地（中国规则简化版：数子法）
   * 黑方得分 = 黑子数 + 黑方领地
   * 白方得分 = 白子数 + 白方领地 + 贴目
   */
  calculateTerritory(): { blackTerritory: number; whiteTerritory: number; blackScore: number; whiteScore: number; territory: number[][] } {
    const territory = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    const visited = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(false));

    let blackTerritory = 0;
    let whiteTerritory = 0;
    let blackStones = 0;
    let whiteStones = 0;

    // 计算棋子数
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] === BLACK) blackStones++;
        else if (this._board[r][c] === WHITE) whiteStones++;
      }
    }

    // 使用 flood fill 确定领地
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this._board[r][c] !== EMPTY || visited[r][c]) continue;

        // BFS 找到连通的空点区域
        const region: [number, number][] = [];
        const queue: [number, number][] = [[r, c]];
        visited[r][c] = true;
        let touchesBlack = false;
        let touchesWhite = false;

        while (queue.length > 0) {
          const [cr, cc] = queue.shift()!;
          region.push([cr, cc]);

          for (const [dr, dc] of DIRECTIONS) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;

            if (this._board[nr][nc] === BLACK) {
              touchesBlack = true;
            } else if (this._board[nr][nc] === WHITE) {
              touchesWhite = true;
            } else if (!visited[nr][nc]) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }

        // 判断领地归属
        if (touchesBlack && !touchesWhite) {
          for (const [pr, pc] of region) {
            territory[pr][pc] = TERRITORY_BLACK;
          }
          blackTerritory += region.length;
        } else if (touchesWhite && !touchesBlack) {
          for (const [pr, pc] of region) {
            territory[pr][pc] = TERRITORY_WHITE;
          }
          whiteTerritory += region.length;
        }
        // 同时接触黑白 → 中立，不计入任何一方领地
      }
    }

    // 中国规则：数子法
    const blackScore = blackStones + blackTerritory;
    const whiteScore = whiteStones + whiteTerritory + KOMI;

    this._territory = territory;
    this._blackTerritory = blackTerritory;
    this._whiteTerritory = whiteTerritory;
    this._blackScore = blackScore;
    this._whiteScore = whiteScore;

    return { blackTerritory, whiteTerritory, blackScore, whiteScore, territory };
  }

  // ========== 私有方法 ==========

  /**
   * 获取指定位置所属的棋子组（连通分量）
   */
  private getGroup(row: number, col: number): [number, number][] {
    return this.getGroupOnBoard(this._board, row, col);
  }

  private getGroupOnBoard(board: number[][], row: number, col: number): [number, number][] {
    const color = board[row][col];
    if (color === EMPTY) return [];

    const group: [number, number][] = [];
    const visited = new Set<string>();
    const queue: [number, number][] = [[row, col]];
    visited.add(`${row},${col}`);

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      group.push([r, c]);

      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr;
        const nc = c + dc;
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && !visited.has(key) && board[nr][nc] === color) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }

    return group;
  }

  /**
   * 获取棋子组的气数
   */
  private getGroupLiberties(group: [number, number][]): number {
    return this.getGroupLibertiesOnBoard(this._board, group);
  }

  private getGroupLibertiesOnBoard(board: number[][], group: [number, number][]): number {
    const liberties = new Set<string>();

    for (const [r, c] of group) {
      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === EMPTY) {
          liberties.add(`${nr},${nc}`);
        }
      }
    }

    return liberties.size;
  }

  /**
   * 检测 Ko（劫争）违规
   * 比较当前棋盘是否与上上步棋盘相同
   */
  private isKoViolation(board: number[][]): boolean {
    if (!this._previousBoard) return false;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] !== this._previousBoard[r][c]) return false;
      }
    }

    return true;
  }

  /**
   * 终局处理
   */
  private endGame(): void {
    this._gameOver = true;
    this._showTerritory = true;
    this.calculateTerritory();

    // 判定胜负
    if (this._blackScore > this._whiteScore) {
      this._winner = BLACK;
    } else if (this._whiteScore > this._blackScore) {
      this._winner = WHITE;
    } else {
      this._winner = EMPTY; // 平局
    }

    this.gameOver();
  }

  /**
   * AI 落子（贪心策略）
   *
   * 优先级：
   * 1. 提子（吃掉对方的子）
   * 2. 扩展领地（靠近自己棋子的空位）
   * 3. 防守（阻止对方扩展）
   * 4. 随机落子
   */
  private aiMove(): void {
    if (this._gameOver || this._currentPlayer !== WHITE) return;

    const validMoves = this.getValidMoves();

    // 如果没有合法落子，Pass
    if (validMoves.length === 0) {
      this.pass();
      return;
    }

    let bestMove = validMoves[0];
    let bestScore = -Infinity;

    for (const move of validMoves) {
      let score = 0;

      // 1. 提子优先级最高
      const captureCount = this.simulateCaptureCount(move.row, move.col, WHITE);
      score += captureCount * 50;

      // 2. 检查落子后自身的气数
      const selfLiberties = this.simulateSelfLiberties(move.row, move.col, WHITE);
      score += selfLiberties * 3;

      // 3. 靠近己方棋子（领地扩展）
      const friendlyNeighbors = this.countFriendlyNeighbors(move.row, move.col, WHITE);
      score += friendlyNeighbors * 2;

      // 4. 靠近对方棋子（攻击性）
      const enemyNeighbors = this.countFriendlyNeighbors(move.row, move.col, BLACK);
      score += enemyNeighbors * 1;

      // 5. 位置权重（中心优先）
      const centerDist = Math.abs(move.row - 4) + Math.abs(move.col - 4);
      score += (8 - centerDist) * 0.5;

      // 6. 避免落子在只有1气的位置（容易被提）
      if (selfLiberties <= 1 && captureCount === 0) {
        score -= 20;
      }

      // 难度调整
      if (this._aiDifficulty === 'easy') {
        score += (Math.random() - 0.5) * 30;
      } else if (this._aiDifficulty === 'hard') {
        // 困难模式：更注重提子和防守
        score += captureCount * 20;
        if (selfLiberties <= 1 && captureCount === 0) {
          score -= 40;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    // 如果最佳分数太低，考虑 Pass
    if (bestScore < -10 && this._moveCount > 20) {
      this.pass();
    } else {
      this.placeStone(bestMove.row, bestMove.col);
    }
  }

  /**
   * 模拟落子后的提子数
   */
  private simulateCaptureCount(row: number, col: number, player: number): number {
    const testBoard = this._board.map(r => [...r]);
    testBoard[row][col] = player;

    const opponent = player === BLACK ? WHITE : BLACK;
    let captured = 0;

    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && testBoard[nr][nc] === opponent) {
        const group = this.getGroupOnBoard(testBoard, nr, nc);
        const liberties = this.getGroupLibertiesOnBoard(testBoard, group);
        if (liberties === 0) {
          captured += group.length;
          for (const [gr, gc] of group) {
            testBoard[gr][gc] = EMPTY;
          }
        }
      }
    }

    return captured;
  }

  /**
   * 模拟落子后自身的气数
   */
  private simulateSelfLiberties(row: number, col: number, player: number): number {
    const testBoard = this._board.map(r => [...r]);
    testBoard[row][col] = player;

    // 先处理提子
    const opponent = player === BLACK ? WHITE : BLACK;
    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && testBoard[nr][nc] === opponent) {
        const group = this.getGroupOnBoard(testBoard, nr, nc);
        const liberties = this.getGroupLibertiesOnBoard(testBoard, group);
        if (liberties === 0) {
          for (const [gr, gc] of group) {
            testBoard[gr][gc] = EMPTY;
          }
        }
      }
    }

    const selfGroup = this.getGroupOnBoard(testBoard, row, col);
    return this.getGroupLibertiesOnBoard(testBoard, selfGroup);
  }

  /**
   * 计算相邻的友方棋子数
   */
  private countFriendlyNeighbors(row: number, col: number, player: number): number {
    let count = 0;
    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && this._board[nr][nc] === player) {
        count++;
      }
    }
    return count;
  }
}
