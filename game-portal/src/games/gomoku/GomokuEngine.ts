import { GameEngine } from '@/core/GameEngine';
import {
  BOARD_SIZE,
  CELL_SIZE,
  STONE_RADIUS,
  BOARD_PADDING,
  GRID_WIDTH,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  HUD_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  STAR_POINTS,
  AI_THINK_DELAY,
  AI_SCORES,
  SCORE_WIN,
  SCORE_PER_STONE,
  SCORE_AI_BONUS,
  SCORE_LEVEL_BONUS,
  FONT_FAMILY,
  FONT_SIZE_HUD,
  FONT_SIZE_STATUS,
  FOOTER_Y,
} from './constants';

// ========== 类型定义 ==========

/** 棋盘格子值：0=空, 1=黑, 2=白 */
type CellValue = 0 | 1 | 2;

/** 游戏模式 */
type GameMode = 'PvP' | 'AI';

/** 方向向量 */
interface Direction {
  dr: number;
  dc: number;
}

/** Gomoku 引擎状态 */
interface GomokuState {
  board: CellValue[][];
  currentPlayer: CellValue;
  cursorRow: number;
  cursorCol: number;
  winner: CellValue;
  isDraw: boolean;
  mode: GameMode;
  moveCount: number;
  lastMove: { row: number; col: number } | null;
  isWin: boolean;
}

// 四个检测方向：水平、垂直、左上-右下对角线、右上-左下对角线
const DIRECTIONS: Direction[] = [
  { dr: 0, dc: 1 },  // 水平
  { dr: 1, dc: 0 },  // 垂直
  { dr: 1, dc: 1 },  // 左上→右下对角线
  { dr: 1, dc: -1 }, // 右上→左下对角线
];

// ========== 五子棋引擎 ==========

export class GomokuEngine extends GameEngine {
  /** 棋盘状态 15×15 */
  private board: CellValue[][] = [];
  /** 当前玩家 1=黑(先手), 2=白 */
  private currentPlayer: CellValue = 1;
  /** 光标行 */
  private cursorRow: number = 7;
  /** 光标列 */
  private cursorCol: number = 7;
  /** 赢家 0=无 */
  private winner: CellValue = 0;
  /** 是否平局 */
  private isDraw: boolean = false;
  /** 落子计数 */
  private moveCount: number = 0;
  /** 最后一手位置 */
  private lastMove: { row: number; col: number } | null = null;
  /** 游戏模式 */
  private mode: GameMode = 'PvP';
  /** AI 是否在思考中 */
  private aiThinking: boolean = false;
  /** AI 思考计时器 */
  private aiThinkTimer: number = 0;
  /** 胜利标记（对外暴露） */
  public isWin: boolean = false;
  /** 结果已计分标记 */
  private resultScored: boolean = false;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.initBoard();
  }

  protected onStart(): void {
    this.initBoard();
    this.currentPlayer = 1;
    this.winner = 0;
    this.isDraw = false;
    this.moveCount = 0;
    this.lastMove = null;
    this.aiThinking = false;
    this.aiThinkTimer = 0;
    this.isWin = false;
    this.resultScored = false;
  }

  protected onReset(): void {
    this.initBoard();
    this.currentPlayer = 1;
    this.winner = 0;
    this.isDraw = false;
    this.moveCount = 0;
    this.lastMove = null;
    this.aiThinking = false;
    this.aiThinkTimer = 0;
    this.isWin = false;
    this.resultScored = false;
  }

  protected onDestroy(): void {
    // 清理资源
  }

  protected onGameOver(): void {
    // 游戏结束回调
  }

  // ========== 核心逻辑 ==========

  /** 初始化空棋盘 */
  private initBoard(): void {
    this.board = Array.from({ length: BOARD_SIZE }, () =>
      Array.from<CellValue>({ length: BOARD_SIZE }).fill(0)
    );
  }

  /** 切换游戏模式 */
  private toggleMode(): void {
    this.mode = this.mode === 'PvP' ? 'AI' : 'PvP';
    // 切换模式后重置当前对局
    this.reset();
    this.start();
  }

  /** 落子 */
  private placeMove(row: number, col: number): boolean {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
    if (this.board[row][col] !== 0) return false;
    if (this.winner !== 0 || this.isDraw) return false;

    this.board[row][col] = this.currentPlayer;
    this.moveCount++;
    this.lastMove = { row, col };

    // 检查胜利
    if (this.checkWin(row, col, this.currentPlayer)) {
      this.winner = this.currentPlayer;
      this.isWin = true;
      this.calculateScore();
      setTimeout(() => {
        if (this._status === 'playing' || this._status === 'paused') {
          this.gameOver();
        }
      }, 500);
      return true;
    }

    // 检查平局
    if (this.checkDraw()) {
      this.isDraw = true;
      this.calculateScore();
      setTimeout(() => {
        if (this._status === 'playing' || this._status === 'paused') {
          this.gameOver();
        }
      }, 500);
      return true;
    }

    // 切换玩家
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    return true;
  }

  /** 检查指定位置是否形成连五 */
  private checkWin(row: number, col: number, player: CellValue): boolean {
    for (const { dr, dc } of DIRECTIONS) {
      let count = 1; // 包含当前位置

      // 正方向计数
      for (let i = 1; i < 5; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.board[r][c] !== player) break;
        count++;
      }

      // 反方向计数
      for (let i = 1; i < 5; i++) {
        const r = row - dr * i;
        const c = col - dc * i;
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
        if (this.board[r][c] !== player) break;
        count++;
      }

      if (count >= 5) return true;
    }
    return false;
  }

  /** 检查平局（棋盘满） */
  private checkDraw(): boolean {
    if (this.winner !== 0) return false;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] === 0) return false;
      }
    }
    return true;
  }

  /** 计算得分 */
  private calculateScore(): void {
    if (this.resultScored) return;
    this.resultScored = true;

    if (this.winner !== 0) {
      let points = SCORE_WIN;
      points += this.moveCount * SCORE_PER_STONE;

      if (this.mode === 'AI') {
        points += SCORE_AI_BONUS;
      }

      points += (this._level - 1) * SCORE_LEVEL_BONUS;

      this.addScore(points);
    }
  }

  // ========== AI 逻辑 ==========

  /** AI 选择最佳落子位置 */
  private aiMove(): void {
    const aiPlayer: CellValue = 2; // AI 执白
    const humanPlayer: CellValue = 1; // 人类执黑

    let bestScore = -1;
    let bestRow = -1;
    let bestCol = -1;

    // 遍历所有空位评分
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.board[r][c] !== 0) continue;

        // 只考虑附近有棋子的位置（优化搜索范围）
        if (!this.hasNeighbor(r, c, 2)) continue;

        // 评估 AI 己方得分
        const aiScore = this.evaluatePosition(r, c, aiPlayer);
        // 评估对手得分（防守）
        const humanScore = this.evaluatePosition(r, c, humanPlayer);

        // 总分 = 己方进攻 + 对方防守
        const totalScore = aiScore + humanScore * 0.9;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestRow = r;
          bestCol = c;
        }
      }
    }

    // 如果没找到（例如第一步），下天元
    if (bestRow === -1 || bestCol === -1) {
      bestRow = 7;
      bestCol = 7;
    }

    // 落子
    this.placeMove(bestRow, bestCol);
    this.cursorRow = bestRow;
    this.cursorCol = bestCol;
  }

  /** 检查指定位置附近是否有棋子 */
  private hasNeighbor(row: number, col: number, distance: number): boolean {
    for (let dr = -distance; dr <= distance; dr++) {
      for (let dc = -distance; dc <= distance; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
          if (this.board[r][c] !== 0) return true;
        }
      }
    }
    return false;
  }

  /** 评估某个空位对指定玩家的得分 */
  private evaluatePosition(row: number, col: number, player: CellValue): number {
    let totalScore = 0;

    for (const { dr, dc } of DIRECTIONS) {
      const pattern = this.getPattern(row, col, dr, dc, player);
      totalScore += this.scorePattern(pattern);
    }

    return totalScore;
  }

  /**
   * 获取在 (row, col) 放置 player 棋子后，沿 (dr, dc) 方向的棋型信息。
   * 返回 { count: 连子数, openEnds: 开放端数 }
   */
  private getPattern(
    row: number, col: number,
    dr: number, dc: number,
    player: CellValue
  ): { count: number; openEnds: number } {
    let count = 1; // 包含当前位置
    let openEnds = 0;

    // 正方向
    let blocked = false;
    for (let i = 1; i <= 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
        blocked = true;
        break;
      }
      if (this.board[r][c] === player) {
        count++;
      } else if (this.board[r][c] === 0) {
        break;
      } else {
        blocked = true;
        break;
      }
    }
    if (!blocked) openEnds++;

    // 反方向
    blocked = false;
    for (let i = 1; i <= 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
        blocked = true;
        break;
      }
      if (this.board[r][c] === player) {
        count++;
      } else if (this.board[r][c] === 0) {
        break;
      } else {
        blocked = true;
        break;
      }
    }
    if (!blocked) openEnds++;

    return { count, openEnds };
  }

  /** 根据棋型计算分数 */
  private scorePattern(pattern: { count: number; openEnds: number }): number {
    const { count, openEnds } = pattern;

    // 两端都封死，无价值
    if (openEnds === 0 && count < 5) return 0;

    // 连五
    if (count >= 5) return AI_SCORES.FIVE;

    // 根据开放端数评分
    if (openEnds === 2) {
      // 活棋型（两端开放）
      switch (count) {
        case 4: return AI_SCORES.LIVE_FOUR;
        case 3: return AI_SCORES.LIVE_THREE;
        case 2: return AI_SCORES.LIVE_TWO;
        case 1: return AI_SCORES.LIVE_ONE;
        default: return 0;
      }
    } else {
      // 眠棋型（一端开放）或冲棋型
      switch (count) {
        case 4: return AI_SCORES.RUSH_FOUR;
        case 3: return AI_SCORES.SLEEP_THREE;
        case 2: return AI_SCORES.SLEEP_TWO;
        case 1: return AI_SCORES.SLEEP_ONE;
        default: return 0;
      }
    }
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
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
    this.drawBoard(ctx);
    this.drawStarPoints(ctx);
    this.drawStones(ctx);
    this.drawCursor(ctx);
    this.drawLastMoveMarker(ctx);
    this.drawResult(ctx, w, h);
    this.drawFooter(ctx, w);
  }

  /** 绘制背景 */
  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, COLORS.backgroundGradient1);
    grad.addColorStop(1, COLORS.backgroundGradient2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
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

    // 标题
    ctx.font = `bold ${FONT_SIZE_STATUS}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textPrimary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('五子棋 Gomoku', w / 2, 20);

    // 模式
    ctx.font = `${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`模式: ${this.mode === 'AI' ? '人机对战' : '双人对弈'}`, w / 2 - 80, 48);

    // 当前玩家
    if (this.winner === 0 && !this.isDraw) {
      const playerName = this.currentPlayer === 1 ? '⚫ 黑' : '⚪ 白';
      const thinking = this.aiThinking ? ' (思考中...)' : '';
      ctx.fillStyle = COLORS.textAccent;
      ctx.font = `bold ${FONT_SIZE_HUD}px ${FONT_FAMILY}`;
      ctx.fillText(`当前: ${playerName}${thinking}`, w / 2 + 80, 48);
    }
  }

  /** 绘制棋盘 */
  private drawBoard(ctx: CanvasRenderingContext2D): void {
    // 棋盘背景（木色）
    const boardLeft = GRID_OFFSET_X - BOARD_PADDING;
    const boardTop = GRID_OFFSET_Y - BOARD_PADDING;
    const boardW = GRID_WIDTH + BOARD_PADDING * 2;
    const boardH = GRID_WIDTH + BOARD_PADDING * 2;

    // 外框
    ctx.fillStyle = COLORS.boardBorder;
    ctx.fillRect(boardLeft - 2, boardTop - 2, boardW + 4, boardH + 4);

    // 木色背景
    const boardGrad = ctx.createLinearGradient(boardLeft, boardTop, boardLeft + boardW, boardTop + boardH);
    boardGrad.addColorStop(0, COLORS.boardBgLight);
    boardGrad.addColorStop(0.5, COLORS.boardBg);
    boardGrad.addColorStop(1, COLORS.boardBgLight);
    ctx.fillStyle = boardGrad;
    ctx.fillRect(boardLeft, boardTop, boardW, boardH);

    // 网格线
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;

    for (let i = 0; i < BOARD_SIZE; i++) {
      // 水平线
      const y = GRID_OFFSET_Y + i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(GRID_OFFSET_X, y);
      ctx.lineTo(GRID_OFFSET_X + GRID_WIDTH, y);
      ctx.stroke();

      // 垂直线
      const x = GRID_OFFSET_X + i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, GRID_OFFSET_Y);
      ctx.lineTo(x, GRID_OFFSET_Y + GRID_WIDTH);
      ctx.stroke();
    }
  }

  /** 绘制星位标记 */
  private drawStarPoints(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.starPoint;
    for (const [r, c] of STAR_POINTS) {
      const x = GRID_OFFSET_X + c * CELL_SIZE;
      const y = GRID_OFFSET_Y + r * CELL_SIZE;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 绘制棋子 */
  private drawStones(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = this.board[r][c];
        if (cell === 0) continue;

        const x = GRID_OFFSET_X + c * CELL_SIZE;
        const y = GRID_OFFSET_Y + r * CELL_SIZE;

        this.drawStone(ctx, x, y, cell);
      }
    }
  }

  /** 绘制单个棋子 */
  private drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, player: CellValue): void {
    const radius = STONE_RADIUS;

    // 阴影
    ctx.save();
    ctx.shadowColor = COLORS.stoneShadow;
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    if (player === 1) {
      // 黑棋
      const grad = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, radius * 0.1,
        x, y, radius
      );
      grad.addColorStop(0, COLORS.blackStoneHighlight);
      grad.addColorStop(1, COLORS.blackStone);
      ctx.fillStyle = grad;
    } else {
      // 白棋
      const grad = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, radius * 0.1,
        x, y, radius
      );
      grad.addColorStop(0, COLORS.whiteStoneHighlight);
      grad.addColorStop(1, COLORS.whiteStone);
      ctx.fillStyle = grad;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 白棋边框
    if (player === 2) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** 绘制光标高亮 */
  private drawCursor(ctx: CanvasRenderingContext2D): void {
    if (this.winner !== 0 || this.isDraw) return;
    if (this.aiThinking && this.currentPlayer === 2) return;

    const x = GRID_OFFSET_X + this.cursorCol * CELL_SIZE;
    const y = GRID_OFFSET_Y + this.cursorRow * CELL_SIZE;

    // 半透明预览棋子
    const previewColor = this.currentPlayer === 1
      ? COLORS.cursorPreview
      : COLORS.cursorPreviewWhite;

    ctx.fillStyle = previewColor;
    ctx.beginPath();
    ctx.arc(x, y, STONE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 脉冲边框
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + pulse * 0.5})`;
    ctx.lineWidth = 2 + pulse;
    ctx.beginPath();
    ctx.arc(x, y, STONE_RADIUS + 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** 绘制最后一手标记 */
  private drawLastMoveMarker(ctx: CanvasRenderingContext2D): void {
    if (!this.lastMove) return;

    const x = GRID_OFFSET_X + this.lastMove.col * CELL_SIZE;
    const y = GRID_OFFSET_Y + this.lastMove.row * CELL_SIZE;

    ctx.fillStyle = COLORS.lastMoveMarker;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 绘制结果提示 */
  private drawResult(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.winner === 0 && !this.isDraw) return;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(15, 14, 23, 0.5)';
    ctx.fillRect(0, HUD_HEIGHT, w, h - HUD_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerY = GRID_OFFSET_Y + GRID_WIDTH / 2;

    if (this.winner !== 0) {
      const winnerName = this.winner === 1 ? '⚫ 黑棋' : '⚪ 白棋';
      ctx.shadowColor = COLORS.textAccent;
      ctx.shadowBlur = 20;
      ctx.font = `bold ${FONT_SIZE_STATUS + 8}px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.textAccent;
      ctx.fillText(`${winnerName} 获胜！`, w / 2, centerY - 15);
      ctx.shadowBlur = 0;
    } else if (this.isDraw) {
      ctx.shadowColor = COLORS.textPrimary;
      ctx.shadowBlur = 15;
      ctx.font = `bold ${FONT_SIZE_STATUS + 8}px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText('平局！', w / 2, centerY - 15);
      ctx.shadowBlur = 0;
    }

    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText('按 R 重开', w / 2, centerY + 20);
  }

  /** 绘制底部提示 */
  private drawFooter(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${FONT_SIZE_HUD - 1}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textSecondary;

    const controls = '↑↓←→ 移动 · 空格/回车 落子 · T 切换模式 · R 重开';
    ctx.fillText(controls, w / 2, FOOTER_Y);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    // R 键：重新开始
    if (key === 'r' || key === 'R') {
      this.reset();
      this.start();
      return;
    }

    // T 键：切换模式
    if (key === 't' || key === 'T') {
      this.toggleMode();
      return;
    }

    // 游戏未在运行状态
    if (this._status !== 'playing') return;

    // 游戏已结束
    if (this.winner !== 0 || this.isDraw) return;

    // AI 思考中不处理玩家操作
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
      // AI 模式下，只有黑棋（玩家）可以手动落子
      if (this.mode === 'AI' && this.currentPlayer === 2) return;

      const placed = this.placeMove(this.cursorRow, this.cursorCol);
      if (placed && this.mode === 'AI' && this.currentPlayer === 2 && this.winner === 0 && !this.isDraw) {
        // 触发 AI 思考
        this.aiThinking = true;
        this.aiThinkTimer = 0;
      }
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }

  // ========== 鼠标点击 ==========

  /** 处理鼠标/触摸点击，将 canvas 坐标转换为棋盘坐标并落子 */
  handleClick(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') return;
    if (this.winner !== 0 || this.isDraw) return;
    if (this.aiThinking) return;

    // 将 canvas 坐标转换为棋盘行列
    const col = Math.round((canvasX - GRID_OFFSET_X) / CELL_SIZE);
    const row = Math.round((canvasY - GRID_OFFSET_Y) / CELL_SIZE);

    // 边界检查
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return;

    // AI 模式下只有黑棋可以手动落子
    if (this.mode === 'AI' && this.currentPlayer === 2) return;

    // 更新光标位置
    this.cursorRow = row;
    this.cursorCol = col;

    const placed = this.placeMove(row, col);
    if (placed && this.mode === 'AI' && this.currentPlayer === 2 && this.winner === 0 && !this.isDraw) {
      this.aiThinking = true;
      this.aiThinkTimer = 0;
    }
  }

  // ========== 状态导出 ==========

  getState(): Record<string, unknown> {
    const state: GomokuState = {
      board: this.board.map((row) => [...row]),
      currentPlayer: this.currentPlayer,
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
      winner: this.winner,
      isDraw: this.isDraw,
      mode: this.mode,
      moveCount: this.moveCount,
      lastMove: this.lastMove ? { ...this.lastMove } : null,
      isWin: this.isWin,
    };
    return state as unknown as Record<string, unknown>;
  }
}
