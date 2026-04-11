import { GameEngine } from '@/core/GameEngine';
import {
  BOARD_SIZE,
  CELL_SIZE,
  CELL_GAP,
  CELL_RADIUS,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  HUD_HEIGHT,
  COLORS,
  MARK_PADDING,
  X_LINE_WIDTH,
  O_LINE_WIDTH,
  WIN_LINE_WIDTH,
  WIN_LINE_ANIMATION_SPEED,
  PLACE_ANIMATION_DURATION,
  PLACE_ANIMATION_SCALE_START,
  AI_THINK_DELAY,
  SCORE_WIN,
  SCORE_DRAW,
  SCORE_AI_BONUS,
  SCORE_SPEED_BONUS_BASE,
  SCORE_SPEED_BONUS_STEP,
  FONT_FAMILY,
  FONT_SIZE_HUD,
  FONT_SIZE_STATUS,
  FONT_SIZE_RESULT,
  FOOTER_Y,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './constants';

// ========== 类型定义 ==========

type CellValue = null | 'X' | 'O';
type Player = 'X' | 'O';
type GameMode = 'PvP' | 'Easy AI' | 'Medium AI';

interface WinLine {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

interface PlaceAnimation {
  row: number;
  col: number;
  player: Player;
  elapsed: number;
  duration: number;
}

interface Scores {
  X: number;
  O: number;
  draw: number;
}

interface TicTacToeState {
  board: (string | null)[][];
  currentPlayer: Player;
  cursorRow: number;
  cursorCol: number;
  winner: Player | null;
  winLine: WinLine | null;
  isDraw: boolean;
  mode: GameMode;
  scores: Scores;
}

// ========== Tic-Tac-Toe 引擎 ==========

export class TicTacToeEngine extends GameEngine {
  // 棋盘状态
  private board: CellValue[][] = [];
  private currentPlayer: Player = 'X';
  private cursorRow: number = 1;
  private cursorCol: number = 1;
  private winner: Player | null = null;
  private winLine: WinLine | null = null;
  private isDraw: boolean = false;
  private moveCount: number = 0;

  // 动画状态
  private placeAnimations: PlaceAnimation[] = [];
  private winLineProgress: number = 0; // 0~1 胜利线动画进度
  private winLineAnimating: boolean = false;

  // AI 状态
  private aiThinking: boolean = false;
  private aiThinkTimer: number = 0;

  // 计分
  private scores: Scores = { X: 0, O: 0, draw: 0 };

  // 结果已计分标记（防止重复计分）
  private resultScored: boolean = false;

  // ========== 生命周期 ==========

  protected onInit(): void {
    // 初始化棋盘
    this.initBoard();
  }

  protected onStart(): void {
    this.initBoard();
    this.currentPlayer = 'X';
    this.winner = null;
    this.winLine = null;
    this.isDraw = false;
    this.moveCount = 0;
    this.placeAnimations = [];
    this.winLineProgress = 0;
    this.winLineAnimating = false;
    this.aiThinking = false;
    this.aiThinkTimer = 0;
    this.resultScored = false;

    // 根据 _level 设置游戏模式
    this.applyLevel(this._level);
  }

  protected onReset(): void {
    this.initBoard();
    this.currentPlayer = 'X';
    this.winner = null;
    this.winLine = null;
    this.isDraw = false;
    this.moveCount = 0;
    this.placeAnimations = [];
    this.winLineProgress = 0;
    this.winLineAnimating = false;
    this.aiThinking = false;
    this.aiThinkTimer = 0;
    this.resultScored = false;
  }

  protected onDestroy(): void {
    this.scores = { X: 0, O: 0, draw: 0 };
  }

  protected onGameOver(): void {
    // 游戏结束时的额外处理
  }

  // ========== 核心逻辑 ==========

  private initBoard(): void {
    this.board = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => null)
    );
  }

  private applyLevel(level: number): void {
    // Level 1: PvP, Level 2: Easy AI, Level 3: Medium AI
    // level 由外部 setLevel 或 start() 控制
  }

  /** 获取当前游戏模式 */
  private getMode(): GameMode {
    switch (this._level) {
      case 2: return 'Easy AI';
      case 3: return 'Medium AI';
      default: return 'PvP';
    }
  }

  /** 判断当前是否为 AI 模式 */
  private isAIMode(): boolean {
    return this._level >= 2;
  }

  /** 落子 */
  private placeMove(row: number, col: number): boolean {
    if (this.board[row][col] !== null) return false;
    if (this.winner || this.isDraw) return false;

    this.board[row][col] = this.currentPlayer;
    this.moveCount++;

    // 添加落子动画
    this.placeAnimations.push({
      row,
      col,
      player: this.currentPlayer,
      elapsed: 0,
      duration: PLACE_ANIMATION_DURATION,
    });

    // 检查胜利
    const win = this.checkWin(this.currentPlayer);
    if (win) {
      this.winner = this.currentPlayer;
      this.winLine = win;
      this.winLineAnimating = true;
      this.winLineProgress = 0;
      this.scores[this.currentPlayer]++;
      this.calculateScore();
      // 延迟触发 gameOver，让胜利动画播放
      setTimeout(() => {
        if (this._status === 'playing' || this._status === 'paused') {
          this.gameOver();
        }
      }, WIN_LINE_ANIMATION_SPEED + 600);
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
    this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
    return true;
  }

  /** 检查胜利，返回胜利线坐标或 null */
  private checkWin(player: Player): WinLine | null {
    // 检查行
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (
        this.board[r][0] === player &&
        this.board[r][1] === player &&
        this.board[r][2] === player
      ) {
        return { startRow: r, startCol: 0, endRow: r, endCol: 2 };
      }
    }

    // 检查列
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (
        this.board[0][c] === player &&
        this.board[1][c] === player &&
        this.board[2][c] === player
      ) {
        return { startRow: 0, startCol: c, endRow: 2, endCol: c };
      }
    }

    // 检查对角线（左上到右下）
    if (
      this.board[0][0] === player &&
      this.board[1][1] === player &&
      this.board[2][2] === player
    ) {
      return { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    }

    // 检查对角线（右上到左下）
    if (
      this.board[0][2] === player &&
      this.board[1][1] === player &&
      this.board[2][0] === player
    ) {
      return { startRow: 0, startCol: 2, endRow: 2, endCol: 0 };
    }

    return null;
  }

  /** 检查平局 */
  private checkDraw(): boolean {
    if (this.winner) return false;
    return this.board.every((row) => row.every((cell) => cell !== null));
  }

  /** 计算得分 */
  private calculateScore(): void {
    if (this.resultScored) return;
    this.resultScored = true;

    if (this.winner) {
      // 胜利基础分
      let points = SCORE_WIN;

      // AI 模式额外加分
      if (this.isAIMode()) {
        points += SCORE_AI_BONUS;
      }

      // 速通奖励：步数越少分越高（最少5步胜利）
      const speedBonus = Math.max(0, SCORE_SPEED_BONUS_BASE - (this.moveCount - 5) * SCORE_SPEED_BONUS_STEP);
      points += speedBonus;

      this.addScore(points);
    } else if (this.isDraw) {
      this.addScore(SCORE_DRAW);
    }
  }

  // ========== AI 逻辑 ==========

  /** AI 执行落子 */
  private aiMove(): void {
    if (this._level === 2) {
      this.aiEasyMove();
    } else if (this._level === 3) {
      this.aiMediumMove();
    }
  }

  /** 简单 AI：随机落子 */
  private aiEasyMove(): void {
    const emptyCells: { row: number; col: number }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] === null) {
          emptyCells.push({ row: r, col: c });
        }
      }
    }
    if (emptyCells.length === 0) return;

    const choice = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    this.placeMove(choice.row, choice.col);

    // 移动光标到 AI 落子位置
    this.cursorRow = choice.row;
    this.cursorCol = choice.col;
  }

  /** 中等 AI：策略优先 */
  private aiMediumMove(): void {
    const aiPlayer: Player = 'O';
    const humanPlayer: Player = 'X';

    // 1. 能赢就赢
    const winMove = this.findWinningMove(aiPlayer);
    if (winMove) {
      this.placeMove(winMove.row, winMove.col);
      this.cursorRow = winMove.row;
      this.cursorCol = winMove.col;
      return;
    }

    // 2. 对手要赢就堵
    const blockMove = this.findWinningMove(humanPlayer);
    if (blockMove) {
      this.placeMove(blockMove.row, blockMove.col);
      this.cursorRow = blockMove.row;
      this.cursorCol = blockMove.col;
      return;
    }

    // 3. 占中心
    if (this.board[1][1] === null) {
      this.placeMove(1, 1);
      this.cursorRow = 1;
      this.cursorCol = 1;
      return;
    }

    // 4. 占角
    const corners = [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      { row: 2, col: 0 },
      { row: 2, col: 2 },
    ];
    const emptyCorners = corners.filter((c) => this.board[c.row][c.col] === null);
    if (emptyCorners.length > 0) {
      // 优先占对角
      const choice = emptyCorners[Math.floor(Math.random() * emptyCorners.length)];
      this.placeMove(choice.row, choice.col);
      this.cursorRow = choice.row;
      this.cursorCol = choice.col;
      return;
    }

    // 5. 占边
    const edges = [
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 2, col: 1 },
    ];
    const emptyEdges = edges.filter((e) => this.board[e.row][e.col] === null);
    if (emptyEdges.length > 0) {
      const choice = emptyEdges[Math.floor(Math.random() * emptyEdges.length)];
      this.placeMove(choice.row, choice.col);
      this.cursorRow = choice.row;
      this.cursorCol = choice.col;
    }
  }

  /** 查找能让指定玩家获胜的落子位置 */
  private findWinningMove(player: Player): { row: number; col: number } | null {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== null) continue;
        // 模拟落子
        this.board[r][c] = player;
        const win = this.checkWin(player);
        // 撤销
        this.board[r][c] = null;
        if (win) return { row: r, col: c };
      }
    }
    return null;
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
    // 更新落子动画
    this.placeAnimations = this.placeAnimations.filter((anim) => {
      anim.elapsed += deltaTime;
      return anim.elapsed < anim.duration;
    });

    // 更新胜利线动画
    if (this.winLineAnimating) {
      this.winLineProgress += deltaTime / WIN_LINE_ANIMATION_SPEED;
      if (this.winLineProgress >= 1) {
        this.winLineProgress = 1;
        this.winLineAnimating = false;
      }
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
    // 背景
    this.drawBackground(ctx, w, h);

    // HUD
    this.drawHUD(ctx, w);

    // 棋盘
    this.drawBoard(ctx);

    // 标记（X 和 O）
    this.drawMarks(ctx);

    // 光标
    this.drawCursor(ctx);

    // 胜利线
    if (this.winLine) {
      this.drawWinLine(ctx);
    }

    // 结果提示
    if (this.winner || this.isDraw) {
      this.drawResult(ctx, w, h);
    }

    // 底部提示
    this.drawFooter(ctx, w);
  }

  // ========== 渲染辅助方法 ==========

  /** 绘制背景 */
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

  /** 绘制 HUD 区域 */
  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);
    ctx.strokeStyle = COLORS.hudBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(w, HUD_HEIGHT);
    ctx.stroke();

    // 游戏标题和模式
    ctx.font = `bold ${FONT_SIZE_STATUS}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textPrimary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tic-Tac-Toe', w / 2, 24);

    ctx.font = `${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`Mode: ${this.getMode()}`, w / 2, 48);

    // 当前玩家指示
    if (!this.winner && !this.isDraw) {
      const playerColor = this.currentPlayer === 'X' ? COLORS.xColor : COLORS.oColor;
      const thinking = this.aiThinking ? ' (Thinking...)' : '';
      ctx.font = `bold 16px ${FONT_FAMILY}`;
      ctx.fillStyle = playerColor;
      ctx.fillText(`Current: ${this.currentPlayer}${thinking}`, w / 2, 72);
    }

    // 比分
    ctx.font = `${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';

    // X 比分
    ctx.fillStyle = COLORS.xColor;
    ctx.fillText(`X: ${this.scores.X}`, w / 2 - 100, 100);

    // 平局
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`Draw: ${this.scores.draw}`, w / 2, 100);

    // O 比分
    ctx.fillStyle = COLORS.oColor;
    ctx.fillText(`O: ${this.scores.O}`, w / 2 + 100, 100);
  }

  /** 绘制棋盘 */
  private drawBoard(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = GRID_OFFSET_X + c * (CELL_SIZE + CELL_GAP);
        const y = GRID_OFFSET_Y + r * (CELL_SIZE + CELL_GAP);

        // 格子背景
        ctx.fillStyle = COLORS.cellBg;
        this.roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, CELL_RADIUS);
        ctx.fill();

        // 格子边框
        ctx.strokeStyle = COLORS.cellBorder;
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, CELL_RADIUS);
        ctx.stroke();

        // 发光效果
        ctx.shadowColor = COLORS.gridLineGlow;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 0.5;
        this.roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, CELL_RADIUS);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  /** 绘制标记（X 和 O） */
  private drawMarks(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = this.board[r][c];
        if (cell === null) continue;

        const x = GRID_OFFSET_X + c * (CELL_SIZE + CELL_GAP);
        const y = GRID_OFFSET_Y + r * (CELL_SIZE + CELL_GAP);

        // 检查是否有进行中的动画
        const anim = this.placeAnimations.find((a) => a.row === r && a.col === c);
        let scale = 1;
        if (anim) {
          const progress = anim.elapsed / anim.duration;
          // 弹性缓动
          scale = PLACE_ANIMATION_SCALE_START +
            (1 - PLACE_ANIMATION_SCALE_START) * this.easeOutBack(progress);
        }

        ctx.save();
        const cx = x + CELL_SIZE / 2;
        const cy = y + CELL_SIZE / 2;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        if (cell === 'X') {
          this.drawX(ctx, x, y);
        } else {
          this.drawO(ctx, x, y);
        }

        ctx.restore();
      }
    }
  }

  /** 绘制 X 标记 */
  private drawX(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const pad = MARK_PADDING;
    const x1 = x + pad;
    const y1 = y + pad;
    const x2 = x + CELL_SIZE - pad;
    const y2 = y + CELL_SIZE - pad;

    // 发光效果
    ctx.shadowColor = COLORS.xShadow;
    ctx.shadowBlur = 12;

    ctx.strokeStyle = COLORS.xColor;
    ctx.lineWidth = X_LINE_WIDTH;
    ctx.lineCap = 'round';

    // 第一条线
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // 第二条线
    ctx.beginPath();
    ctx.moveTo(x2, y1);
    ctx.lineTo(x1, y2);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  /** 绘制 O 标记 */
  private drawO(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const cx = x + CELL_SIZE / 2;
    const cy = y + CELL_SIZE / 2;
    const radius = CELL_SIZE * 0.32;

    // 发光效果
    ctx.shadowColor = COLORS.oShadow;
    ctx.shadowBlur = 12;

    ctx.strokeStyle = COLORS.oColor;
    ctx.lineWidth = O_LINE_WIDTH;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  /** 绘制光标高亮 */
  private drawCursor(ctx: CanvasRenderingContext2D): void {
    // 游戏结束后不显示光标
    if (this.winner || this.isDraw) return;
    // AI 思考中不显示光标
    if (this.aiThinking && this.currentPlayer === 'O') return;

    const x = GRID_OFFSET_X + this.cursorCol * (CELL_SIZE + CELL_GAP);
    const y = GRID_OFFSET_Y + this.cursorRow * (CELL_SIZE + CELL_GAP);

    // 光标背景
    ctx.fillStyle = COLORS.cursorBg;
    this.roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, CELL_RADIUS);
    ctx.fill();

    // 光标边框（脉冲动画）
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    ctx.strokeStyle = COLORS.cursorBorder;
    ctx.lineWidth = 2 + pulse;
    ctx.shadowColor = COLORS.cursorGlow;
    ctx.shadowBlur = 8 + pulse * 6;
    this.roundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, CELL_RADIUS);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /** 绘制胜利线 */
  private drawWinLine(ctx: CanvasRenderingContext2D): void {
    if (!this.winLine) return;

    const startX = GRID_OFFSET_X + this.winLine.startCol * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
    const startY = GRID_OFFSET_Y + this.winLine.startRow * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
    const endX = GRID_OFFSET_X + this.winLine.endCol * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
    const endY = GRID_OFFSET_Y + this.winLine.endRow * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;

    // 根据动画进度计算当前终点
    const currentEndX = startX + (endX - startX) * this.winLineProgress;
    const currentEndY = startY + (endY - startY) * this.winLineProgress;

    // 发光效果（多层）
    ctx.save();

    // 外层光晕
    ctx.shadowColor = COLORS.winLineShadow;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = COLORS.winLineGlow;
    ctx.lineWidth = WIN_LINE_WIDTH + 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(currentEndX, currentEndY);
    ctx.stroke();

    // 主线
    ctx.shadowColor = COLORS.winLineGlow;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = COLORS.winLine;
    ctx.lineWidth = WIN_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(currentEndX, currentEndY);
    ctx.stroke();

    // 内层高亮
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(currentEndX, currentEndY);
    ctx.stroke();

    ctx.restore();
  }

  /** 绘制结果提示 */
  private drawResult(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(15, 14, 23, 0.6)';
    ctx.fillRect(0, HUD_HEIGHT, w, h - HUD_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerY = GRID_OFFSET_Y + (BOARD_SIZE * (CELL_SIZE + CELL_GAP) - CELL_GAP) / 2;

    if (this.winner) {
      const color = this.winner === 'X' ? COLORS.xColor : COLORS.oColor;

      // 发光文字
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.font = `bold ${FONT_SIZE_RESULT}px ${FONT_FAMILY}`;
      ctx.fillStyle = color;
      ctx.fillText(`${this.winner} Wins!`, w / 2, centerY - 20);
      ctx.shadowBlur = 0;
    } else if (this.isDraw) {
      ctx.shadowColor = COLORS.textHighlight;
      ctx.shadowBlur = 15;
      ctx.font = `bold ${FONT_SIZE_RESULT}px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.textHighlight;
      ctx.fillText("It's a Draw!", w / 2, centerY - 20);
      ctx.shadowBlur = 0;
    }

    // 提示重新开始
    ctx.font = `16px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText('Press R to play again', w / 2, centerY + 25);
  }

  /** 绘制底部提示 */
  private drawFooter(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${FONT_SIZE_HUD - 1}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textMuted;

    const controls = '↑↓←→/WASD: Move | Space/Enter: Place | R: Restart | P: Pause';
    ctx.fillText(controls, w / 2, FOOTER_Y);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    // R 键：重新开始（任何状态都可触发）
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

    // 游戏未在运行状态，不处理游戏操作
    if (this._status !== 'playing') return;

    // 游戏已结束，不处理操作
    if (this.winner || this.isDraw) return;

    // AI 思考中，不处理玩家操作
    if (this.aiThinking) return;

    // 方向键 / WASD：移动光标
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.cursorRow = Math.max(0, this.cursorRow - 1);
    } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
      this.cursorRow = Math.min(BOARD_SIZE - 1, this.cursorRow + 1);
    } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      this.cursorCol = Math.max(0, this.cursorCol - 1);
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      this.cursorCol = Math.min(BOARD_SIZE - 1, this.cursorCol + 1);
    }

    // 空格/回车：落子
    if (key === ' ' || key === 'Enter') {
      // AI 模式下，只有 X（玩家）可以手动落子
      if (this.isAIMode() && this.currentPlayer === 'O') return;

      const placed = this.placeMove(this.cursorRow, this.cursorCol);
      if (placed && this.isAIMode() && this.currentPlayer === 'O' && !this.winner && !this.isDraw) {
        // 触发 AI 思考
        this.aiThinking = true;
        this.aiThinkTimer = 0;
      }
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }

  getState(): Record<string, unknown> {
    const state: TicTacToeState = {
      board: this.board.map((row) => [...row]),
      currentPlayer: this.currentPlayer,
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
      winner: this.winner,
      winLine: this.winLine,
      isDraw: this.isDraw,
      mode: this.getMode(),
      scores: { ...this.scores },
    };
    return state as unknown as Record<string, unknown>;
  }

  // ========== 工具方法 ==========

  /** 绘制圆角矩形路径 */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
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

  /** easeOutBack 缓动函数 */
  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
}
