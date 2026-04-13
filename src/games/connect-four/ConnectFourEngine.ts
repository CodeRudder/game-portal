import { GameEngine } from '@/core/GameEngine';
import {
  COLS,
  ROWS,
  CELL_SIZE,
  CELL_GAP,
  CELL_RADIUS,
  BOARD_PADDING,
  BOARD_TOTAL_WIDTH,
  BOARD_TOTAL_HEIGHT,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  HUD_HEIGHT,
  CURSOR_Y,
  PIECE_RADIUS,
  DROP_ANIMATION_DURATION,
  WIN_HIGHLIGHT_BLINK_SPEED,
  AI_THINK_DELAY,
  AI_DEPTH_EASY,
  AI_DEPTH_MEDIUM,
  AI_DEPTH_HARD,
  SCORE_WIN,
  SCORE_DRAW,
  SCORE_AI_BONUS_EASY,
  SCORE_AI_BONUS_MEDIUM,
  SCORE_AI_BONUS_HARD,
  COLORS,
  FONT_FAMILY,
  FONT_SIZE_HUD,
  FONT_SIZE_STATUS,
  FONT_SIZE_RESULT,
  FOOTER_Y,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './constants';

// ========== 类型定义 ==========

export type CellValue = 0 | 1 | 2; // 0=空, 1=玩家1(红), 2=玩家2/AI(黄)
export type Player = 1 | 2;

type GameMode = 'PvP' | 'Easy AI' | 'Medium AI' | 'Hard AI';

export interface WinCells {
  cells: { row: number; col: number }[];
}

interface DropAnimation {
  col: number;
  targetRow: number;
  player: Player;
  currentY: number;
  targetY: number;
  velocity: number;
  elapsed: number;
  duration: number;
  bouncing: boolean;
}

interface Scores {
  player1: number;
  player2: number;
  draw: number;
}

export interface ConnectFourState {
  board: CellValue[][];
  currentPlayer: Player;
  cursorCol: number;
  winner: Player | null;
  winCells: WinCells | null;
  isDraw: boolean;
  mode: GameMode;
  scores: Scores;
  moveCount: number;
}

// ========== Connect Four 引擎 ==========

export class ConnectFourEngine extends GameEngine {
  // 棋盘状态
  private board: CellValue[][] = [];
  private currentPlayer: Player = 1;
  private cursorCol: number = 3; // 初始光标在中间列
  private winner: Player | null = null;
  private winCells: WinCells | null = null;
  private isDraw: boolean = false;
  private moveCount: number = 0;

  // 动画状态
  private dropAnimation: DropAnimation | null = null;
  private winBlinkElapsed: number = 0;

  // AI 状态
  private aiThinking: boolean = false;
  private aiThinkTimer: number = 0;

  // 计分
  private scores: Scores = { player1: 0, player2: 0, draw: 0 };

  // 结果已计分标记
  private resultScored: boolean = false;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.initBoard();
  }

  protected onStart(): void {
    this.initBoard();
    this.currentPlayer = 1;
    this.winner = null;
    this.winCells = null;
    this.isDraw = false;
    this.moveCount = 0;
    this.cursorCol = 3;
    this.dropAnimation = null;
    this.winBlinkElapsed = 0;
    this.aiThinking = false;
    this.aiThinkTimer = 0;
    this.resultScored = false;
  }

  protected onReset(): void {
    this.initBoard();
    this.currentPlayer = 1;
    this.winner = null;
    this.winCells = null;
    this.isDraw = false;
    this.moveCount = 0;
    this.cursorCol = 3;
    this.dropAnimation = null;
    this.winBlinkElapsed = 0;
    this.aiThinking = false;
    this.aiThinkTimer = 0;
    this.resultScored = false;
  }

  protected onDestroy(): void {
    this.scores = { player1: 0, player2: 0, draw: 0 };
  }

  protected onGameOver(): void {
    // 游戏结束时的额外处理
  }

  // ========== 核心逻辑 ==========

  private initBoard(): void {
    this.board = Array.from({ length: ROWS }, () =>
      Array.from<CellValue>({ length: COLS }).fill(0)
    );
  }

  /** 获取当前游戏模式 */
  getMode(): GameMode {
    switch (this._level) {
      case 2: return 'Easy AI';
      case 3: return 'Medium AI';
      case 4: return 'Hard AI';
      default: return 'PvP';
    }
  }

  /** 判断当前是否为 AI 模式 */
  isAIMode(): boolean {
    return this._level >= 2;
  }

  /** 获取指定列最低的空行 */
  getLowestEmptyRow(col: number): number {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (this.board[row][col] === 0) return row;
    }
    return -1; // 列已满
  }

  /** 检查列是否可以落子 */
  canDrop(col: number): boolean {
    if (col < 0 || col >= COLS) return false;
    return this.board[0][col] === 0;
  }

  /** 执行落子（核心方法） */
  dropPiece(col: number): boolean {
    if (!this.canDrop(col)) return false;
    if (this.winner || this.isDraw) return false;
    if (this.dropAnimation) return false; // 有动画进行中

    const row = this.getLowestEmptyRow(col);
    if (row === -1) return false;

    this.board[row][col] = this.currentPlayer as CellValue;
    this.moveCount++;

    // 启动落子动画
    const targetY = BOARD_OFFSET_Y + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
    this.dropAnimation = {
      col,
      targetRow: row,
      player: this.currentPlayer,
      currentY: CURSOR_Y,
      targetY,
      velocity: 0,
      elapsed: 0,
      duration: DROP_ANIMATION_DURATION,
      bouncing: false,
    };

    // 检查胜利
    const win = this.checkWin(row, col, this.currentPlayer);
    if (win) {
      this.winner = this.currentPlayer;
      this.winCells = win;
      this.scores[this.currentPlayer === 1 ? 'player1' : 'player2']++;
      this.calculateScore();
      setTimeout(() => {
        if (this._status === 'playing' || this._status === 'paused') {
          this.gameOver();
        }
      }, 1200);
      return true;
    }

    // 检查平局
    if (this.checkDraw()) {
      this.isDraw = true;
      this.scores.draw++;
      this.calculateScore();
      setTimeout(() => {
        if (this._status === 'playing' || this._status === 'paused') {
          this.gameOver();
        }
      }, 800);
      return true;
    }

    // 切换玩家
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    return true;
  }

  /** 检查指定位置是否形成四连 */
  checkWin(row: number, col: number, player: Player): WinCells | null {
    // 四个方向：水平、垂直、对角线/、对角线\
    const directions = [
      { dr: 0, dc: 1 },  // 水平
      { dr: 1, dc: 0 },  // 垂直
      { dr: 1, dc: 1 },  // 对角线 /
      { dr: 1, dc: -1 }, // 对角线 \
    ];

    for (const { dr, dc } of directions) {
      const cells: { row: number; col: number }[] = [{ row, col }];

      // 正方向延伸
      for (let i = 1; i < 4; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || this.board[r][c] !== player) break;
        cells.push({ row: r, col: c });
      }

      // 反方向延伸
      for (let i = 1; i < 4; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || this.board[r][c] !== player) break;
        cells.push({ row: r, col: c });
      }

      if (cells.length >= 4) {
        return { cells: cells.slice(0, 4) };
      }
    }

    return null;
  }

  /** 检查是否平局（棋盘满了） */
  checkDraw(): boolean {
    if (this.winner) return false;
    return this.board[0].every((cell) => cell !== 0);
  }

  /** 计算得分 */
  private calculateScore(): void {
    if (this.resultScored) return;
    this.resultScored = true;

    if (this.winner) {
      let points = SCORE_WIN;

      // AI 模式额外加分
      if (this.isAIMode()) {
        switch (this._level) {
          case 2: points += SCORE_AI_BONUS_EASY; break;
          case 3: points += SCORE_AI_BONUS_MEDIUM; break;
          case 4: points += SCORE_AI_BONUS_HARD; break;
        }
      }

      // 速通奖励：步数越少分越高
      const minMoves = 7; // 最少7步可以赢
      const speedBonus = Math.max(0, SCORE_WIN - (this.moveCount - minMoves) * 5);
      points += speedBonus;

      this.addScore(points);
    } else if (this.isDraw) {
      this.addScore(SCORE_DRAW);
    }
  }

  // ========== AI 逻辑 ==========

  private aiMove(): void {
    const depth = this._level === 2 ? AI_DEPTH_EASY
      : this._level === 3 ? AI_DEPTH_MEDIUM
      : AI_DEPTH_HARD;

    const bestCol = this.minimaxRoot(depth);
    if (bestCol !== -1) {
      this.dropPiece(bestCol);
    }
  }

  /** Minimax 入口 */
  private minimaxRoot(depth: number): number {
    const aiPlayer: Player = 2;
    const validCols = this.getValidColumns();
    if (validCols.length === 0) return -1;

    // Easy AI: 加一些随机性
    if (this._level === 2) {
      // 30% 概率随机走
      if (Math.random() < 0.3) {
        return validCols[Math.floor(Math.random() * validCols.length)];
      }
    }

    let bestScore = -Infinity;
    let bestCol = validCols[0];

    // 优先检查中间列（策略优势）
    const orderedCols = this.orderColumns(validCols);

    for (const col of orderedCols) {
      const row = this.getLowestEmptyRow(col);
      if (row === -1) continue;

      this.board[row][col] = aiPlayer as CellValue;

      // 检查是否直接赢了
      if (this.checkWin(row, col, aiPlayer)) {
        this.board[row][col] = 0;
        return col;
      }

      const score = this.minimax(depth - 1, false, -Infinity, Infinity);
      this.board[row][col] = 0;

      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }

    return bestCol;
  }

  /** Minimax + Alpha-Beta 剪枝 */
  private minimax(depth: number, isMaximizing: boolean, alpha: number, beta: number): number {
    // 终止条件
    if (depth === 0 || this.checkDraw()) {
      return this.evaluateBoard();
    }

    const validCols = this.getValidColumns();
    if (validCols.length === 0) return this.evaluateBoard();

    const orderedCols = this.orderColumns(validCols);

    if (isMaximizing) {
      // AI 最大化
      let maxEval = -Infinity;
      for (const col of orderedCols) {
        const row = this.getLowestEmptyRow(col);
        if (row === -1) continue;

        this.board[row][col] = 2 as CellValue;

        // 检查是否赢了
        if (this.checkWin(row, col, 2)) {
          this.board[row][col] = 0;
          return 100000 + depth; // 加 depth 作为快胜奖励
        }

        const evalScore = this.minimax(depth - 1, false, alpha, beta);
        this.board[row][col] = 0;
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break; // 剪枝
      }
      return maxEval;
    } else {
      // 玩家最小化
      let minEval = Infinity;
      for (const col of orderedCols) {
        const row = this.getLowestEmptyRow(col);
        if (row === -1) continue;

        this.board[row][col] = 1 as CellValue;

        // 检查是否玩家赢了
        if (this.checkWin(row, col, 1)) {
          this.board[row][col] = 0;
          return -100000 - depth; // 加 depth 作为快败惩罚
        }

        const evalScore = this.minimax(depth - 1, true, alpha, beta);
        this.board[row][col] = 0;
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break; // 剪枝
      }
      return minEval;
    }
  }

  /** 棋盘评估函数 */
  private evaluateBoard(): number {
    let score = 0;

    // 评估所有可能的四连窗口
    // 水平
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        score += this.evaluateWindow(
          this.board[r][c],
          this.board[r][c + 1],
          this.board[r][c + 2],
          this.board[r][c + 3],
        );
      }
    }

    // 垂直
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - 4; r++) {
        score += this.evaluateWindow(
          this.board[r][c],
          this.board[r + 1][c],
          this.board[r + 2][c],
          this.board[r + 3][c],
        );
      }
    }

    // 对角线 /
    for (let r = 3; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        score += this.evaluateWindow(
          this.board[r][c],
          this.board[r - 1][c + 1],
          this.board[r - 2][c + 2],
          this.board[r - 3][c + 3],
        );
      }
    }

    // 对角线 \
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        score += this.evaluateWindow(
          this.board[r][c],
          this.board[r + 1][c + 1],
          this.board[r + 2][c + 2],
          this.board[r + 3][c + 3],
        );
      }
    }

    // 中间列偏好
    const centerCol = Math.floor(COLS / 2);
    for (let r = 0; r < ROWS; r++) {
      if (this.board[r][centerCol] === 2) score += 3;
      if (this.board[r][centerCol] === 1) score -= 3;
    }

    return score;
  }

  /** 评估四格窗口 */
  private evaluateWindow(a: CellValue, b: CellValue, c: CellValue, d: CellValue): number {
    const window = [a, b, c, d];
    const aiCount = window.filter((v) => v === 2).length;
    const playerCount = window.filter((v) => v === 1).length;
    const emptyCount = window.filter((v) => v === 0).length;

    // 混合（双方都有棋子），无价值
    if (aiCount > 0 && playerCount > 0) return 0;

    if (aiCount === 4) return 100;
    if (aiCount === 3 && emptyCount === 1) return 5;
    if (aiCount === 2 && emptyCount === 2) return 2;

    if (playerCount === 4) return -100;
    if (playerCount === 3 && emptyCount === 1) return -4;
    if (playerCount === 2 && emptyCount === 2) return -1;

    return 0;
  }

  /** 获取所有可落子的列 */
  private getValidColumns(): number[] {
    const cols: number[] = [];
    for (let c = 0; c < COLS; c++) {
      if (this.board[0][c] === 0) cols.push(c);
    }
    return cols;
  }

  /** 列排序：优先中间列（提高剪枝效率） */
  private orderColumns(cols: number[]): number[] {
    const center = Math.floor(COLS / 2);
    return [...cols].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
    // 更新落子动画
    if (this.dropAnimation) {
      this.dropAnimation.elapsed += deltaTime;
      const progress = Math.min(1, this.dropAnimation.elapsed / this.dropAnimation.duration);
      // 简单的重力加速模拟
      this.dropAnimation.currentY = this.dropAnimation.currentY +
        (this.dropAnimation.targetY - this.dropAnimation.currentY) * (progress * progress * (3 - 2 * progress));

      if (progress >= 1) {
        this.dropAnimation = null;
      }
    }

    // 更新胜利闪烁
    if (this.winCells) {
      this.winBlinkElapsed += deltaTime;
    }

    // AI 思考延迟
    if (this.aiThinking && this._status === 'playing') {
      this.aiThinkTimer += deltaTime;
      if (this.aiThinkTimer >= AI_THINK_DELAY) {
        this.aiThinking = false;
        this.aiThinkTimer = 0;
        this.aiMove();
      }
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawHUD(ctx, w);
    this.drawCursorIndicator(ctx);
    this.drawBoard(ctx);
    this.drawPieces(ctx);
    if (this.winCells) {
      this.drawWinHighlight(ctx);
    }
    if (this.winner || this.isDraw) {
      this.drawResult(ctx, w, h);
    }
    this.drawFooter(ctx, w);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, COLORS.backgroundGradient1);
    grad.addColorStop(1, COLORS.backgroundGradient2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 装饰性网格点
    ctx.fillStyle = 'rgba(100, 100, 200, 0.05)';
    for (let x = 0; x < w; x += 30) {
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);
    ctx.strokeStyle = COLORS.hudBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(w, HUD_HEIGHT);
    ctx.stroke();

    // 标题
    ctx.font = `bold ${FONT_SIZE_STATUS}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textPrimary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Connect Four', w / 2, 24);

    // 模式
    ctx.font = `${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`Mode: ${this.getMode()}`, w / 2, 48);

    // 当前玩家指示
    if (!this.winner && !this.isDraw) {
      const color = this.currentPlayer === 1 ? COLORS.player1Color : COLORS.player2Color;
      const thinking = this.aiThinking ? ' (Thinking...)' : '';
      ctx.font = 'bold 16px ' + FONT_FAMILY;
      ctx.fillStyle = color;
      ctx.fillText(`Player ${this.currentPlayer}${thinking}`, w / 2, 70);
    }

    // 比分
    ctx.font = `${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';

    ctx.fillStyle = COLORS.player1Color;
    ctx.fillText(`P1: ${this.scores.player1}`, w / 2 - 100, 95);

    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`Draw: ${this.scores.draw}`, w / 2, 95);

    ctx.fillStyle = COLORS.player2Color;
    ctx.fillText(`P2: ${this.scores.player2}`, w / 2 + 100, 95);
  }

  private drawCursorIndicator(ctx: CanvasRenderingContext2D): void {
    if (this.winner || this.isDraw) return;
    if (this.aiThinking && this.currentPlayer === 2) return;

    const x = BOARD_OFFSET_X + this.cursorCol * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
    const color = this.currentPlayer === 1 ? COLORS.player1Color : COLORS.player2Color;
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);

    ctx.save();
    ctx.shadowColor = this.currentPlayer === 1 ? COLORS.player1Glow : COLORS.player2Glow;
    ctx.shadowBlur = 10 * pulse;
    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(x, CURSOR_Y, PIECE_RADIUS * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBoard(ctx: CanvasRenderingContext2D): void {
    // 棋盘背景
    const bx = BOARD_OFFSET_X - BOARD_PADDING;
    const by = BOARD_OFFSET_Y - BOARD_PADDING;
    const bw = COLS * CELL_SIZE + (COLS - 1) * CELL_GAP + BOARD_PADDING * 2;
    const bh = ROWS * CELL_SIZE + (ROWS - 1) * CELL_GAP + BOARD_PADDING * 2;

    ctx.save();
    ctx.shadowColor = COLORS.boardShadow;
    ctx.shadowBlur = 15;
    ctx.fillStyle = COLORS.boardBg;
    this.roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = COLORS.boardBorder;
    ctx.lineWidth = 2;
    this.roundRect(ctx, bx, by, bw, bh, 12);
    ctx.stroke();
    ctx.restore();

    // 绘制空格
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = BOARD_OFFSET_X + c * (CELL_SIZE + CELL_GAP);
        const y = BOARD_OFFSET_Y + r * (CELL_SIZE + CELL_GAP);

        ctx.fillStyle = COLORS.cellBg;
        this.roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, CELL_RADIUS);
        ctx.fill();

        ctx.strokeStyle = COLORS.cellBorder;
        ctx.lineWidth = 0.5;
        this.roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, CELL_RADIUS);
        ctx.stroke();
      }
    }
  }

  private drawPieces(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.board[r][c];
        if (cell === 0) continue;

        // 跳过正在动画中的棋子
        if (this.dropAnimation && this.dropAnimation.col === c && this.dropAnimation.targetRow === r) {
          continue;
        }

        const x = BOARD_OFFSET_X + c * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
        const y = BOARD_OFFSET_Y + r * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;

        this.drawPiece(ctx, x, y, cell as Player);
      }
    }

    // 绘制正在下落的棋子
    if (this.dropAnimation) {
      const x = BOARD_OFFSET_X + this.dropAnimation.col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
      this.drawPiece(ctx, x, this.dropAnimation.currentY, this.dropAnimation.player);
    }
  }

  private drawPiece(ctx: CanvasRenderingContext2D, x: number, y: number, player: Player): void {
    const color = player === 1 ? COLORS.player1Color : COLORS.player2Color;
    const shadow = player === 1 ? COLORS.player1Shadow : COLORS.player2Shadow;
    const highlight = player === 1 ? COLORS.player1Highlight : COLORS.player2Highlight;

    ctx.save();

    // 阴影
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 8;

    // 主体
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // 高光
    ctx.fillStyle = highlight;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x - 5, y - 5, PIECE_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawWinHighlight(ctx: CanvasRenderingContext2D): void {
    if (!this.winCells) return;

    const blink = Math.sin(this.winBlinkElapsed / WIN_HIGHLIGHT_BLINK_SPEED * Math.PI * 2);
    const alpha = 0.3 + 0.4 * (0.5 + 0.5 * blink);

    for (const cell of this.winCells.cells) {
      const x = BOARD_OFFSET_X + cell.col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
      const y = BOARD_OFFSET_Y + cell.row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = COLORS.winHighlightGlow;
      ctx.shadowBlur = 15;
      ctx.strokeStyle = COLORS.winHighlight;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, PIECE_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawResult(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(15, 14, 23, 0.6)';
    ctx.fillRect(0, HUD_HEIGHT, w, h - HUD_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerY = BOARD_OFFSET_Y + (ROWS * (CELL_SIZE + CELL_GAP) - CELL_GAP) / 2;

    if (this.winner) {
      const color = this.winner === 1 ? COLORS.player1Color : COLORS.player2Color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.font = `bold ${FONT_SIZE_RESULT}px ${FONT_FAMILY}`;
      ctx.fillStyle = color;
      ctx.fillText(`Player ${this.winner} Wins!`, w / 2, centerY - 20);
      ctx.shadowBlur = 0;
    } else if (this.isDraw) {
      ctx.shadowColor = COLORS.textHighlight;
      ctx.shadowBlur = 15;
      ctx.font = `bold ${FONT_SIZE_RESULT}px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.textHighlight;
      ctx.fillText("It's a Draw!", w / 2, centerY - 20);
      ctx.shadowBlur = 0;
    }

    ctx.font = '16px ' + FONT_FAMILY;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText('Press R to play again', w / 2, centerY + 25);
  }

  private drawFooter(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${FONT_SIZE_HUD - 1}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textMuted;
    ctx.fillText('\u2190\u2192: Select Column | Space/Enter: Drop | R: Restart | P: Pause', w / 2, FOOTER_Y);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    // R 键：重新开始
    if (key === 'r' || key === 'R') {
      this.reset();
      this.start();
      return;
    }

    // P 键：暂停/恢复
    if (key === 'p' || key === 'P') {
      if (this._status === 'playing') {
        this.pause();
      } else if (this._status === 'paused') {
        this.resume();
      }
      return;
    }

    if (this._status !== 'playing') return;
    if (this.winner || this.isDraw) return;
    if (this.aiThinking) return;
    if (this.dropAnimation) return;

    // 左右方向键移动光标
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      this.cursorCol = Math.max(0, this.cursorCol - 1);
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      this.cursorCol = Math.min(COLS - 1, this.cursorCol + 1);
    }

    // 空格/回车：落子
    if (key === ' ' || key === 'Enter') {
      // AI 模式下，只有玩家1可以手动落子
      if (this.isAIMode() && this.currentPlayer === 2) return;

      const dropped = this.dropPiece(this.cursorCol);
      if (dropped && this.isAIMode() && this.currentPlayer === 2 && !this.winner && !this.isDraw) {
        this.aiThinking = true;
        this.aiThinkTimer = 0;
      }
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }

  getState(): Record<string, unknown> {
    const state: ConnectFourState = {
      board: this.board.map((row) => [...row]),
      currentPlayer: this.currentPlayer,
      cursorCol: this.cursorCol,
      winner: this.winner,
      winCells: this.winCells ? { cells: [...this.winCells.cells] } : null,
      isDraw: this.isDraw,
      mode: this.getMode(),
      scores: { ...this.scores },
      moveCount: this.moveCount,
    };
    return state as unknown as Record<string, unknown>;
  }

  // ========== 工具方法 ==========

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
