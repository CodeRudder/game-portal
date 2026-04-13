import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  HUD_HEIGHT, FOOTER_HEIGHT,
  GAME_AREA_TOP, GAME_AREA_BOTTOM, GAME_AREA_HEIGHT,
  PLAYER_1, PLAYER_2, NO_PLAYER,
  LINE_HORIZONTAL, LINE_VERTICAL,
  GRID_SIZES, DEFAULT_GRID_SIZE,
  BG_COLOR, DOT_COLOR, DOT_RADIUS,
  LINE_COLOR, LINE_HIGHLIGHT_COLOR, LINE_DRAWN_COLOR,
  PLAYER1_COLOR, PLAYER2_COLOR,
  PLAYER1_BOX_COLOR, PLAYER2_BOX_COLOR,
  CURSOR_COLOR, TEXT_COLOR, SCORE_COLOR,
  LINE_WIDTH, LINE_HIGHLIGHT_WIDTH,
  AI_THINK_DELAY,
} from './constants';
import type { GridSize, LineDirection } from './constants';

// ========== 游戏状态接口 ==========

export interface LinePosition {
  row: number;
  col: number;
  direction: LineDirection;
}

export interface BoxCompletion {
  row: number;
  col: number;
  player: number;
}

/**
 * DotsAndBoxesEngine — 点与线游戏引擎
 *
 * 核心数据结构：
 * - horizontalLines[row][col]: 水平线段，row 从 0 到 rows，col 从 0 到 cols-1
 * - verticalLines[row][col]: 垂直线段，row 从 0 到 rows-1，col 从 0 到 cols
 * - boxes[row][col]: 方格归属，row/col 从 0 到 rows-1（即 gridPoints-1）
 *
 * 对于 gridPoints=5（5个点）：4×4 方格
 * - horizontalLines: 5 行 × 4 列
 * - verticalLines: 4 行 × 5 列
 * - boxes: 4 × 4
 */
export class DotsAndBoxesEngine extends GameEngine {
  // 网格参数
  private _gridPoints: GridSize = DEFAULT_GRID_SIZE;
  private _rows: number = DEFAULT_GRID_SIZE - 1; // 方格行数
  private _cols: number = DEFAULT_GRID_SIZE - 1; // 方格列数

  // 线段状态：0 = 未画，1/2 = 玩家画的
  private _horizontalLines: number[][] = [];
  private _verticalLines: number[][] = [];

  // 方格归属：0 = 未占，1/2 = 玩家占
  private _boxes: number[][] = [];

  // 玩家状态
  private _currentPlayer: number = PLAYER_1;
  private _scores: [number, number] = [0, 0]; // [P1, P2]
  private _totalBoxes: number = 0;
  private _completedBoxes: number = 0;

  // 光标
  private _cursorRow: number = 0;
  private _cursorCol: number = 0;
  private _cursorDirection: LineDirection = LINE_HORIZONTAL;

  // AI
  private _aiEnabled: boolean = true;
  private _aiThinking: boolean = false;
  private _aiTimer: ReturnType<typeof setTimeout> | null = null;

  // 游戏结束
  private _gameOver: boolean = false;
  private _winner: number = NO_PLAYER;
  private _isWin: boolean = false;

  // 额外回合标记
  private _extraTurn: boolean = false;

  // 布局计算
  private _cellSize: number = 0;
  private _boardOffsetX: number = 0;
  private _boardOffsetY: number = 0;

  // ========== Getters ==========

  get gridPoints(): number { return this._gridPoints; }
  get rows(): number { return this._rows; }
  get cols(): number { return this._cols; }
  get currentPlayer(): number { return this._currentPlayer; }
  get scores(): [number, number] { return [this._scores[0], this._scores[1]]; }
  get player1Score(): number { return this._scores[0]; }
  get player2Score(): number { return this._scores[1]; }
  get totalBoxes(): number { return this._totalBoxes; }
  get completedBoxes(): number { return this._completedBoxes; }
  get isGameOver(): boolean { return this._gameOver; }
  get winner(): number { return this._winner; }
  get isWin(): boolean { return this._isWin; }
  get aiEnabled(): boolean { return this._aiEnabled; }
  get aiThinking(): boolean { return this._aiThinking; }
  get cursorRow(): number { return this._cursorRow; }
  get cursorCol(): number { return this._cursorCol; }
  get cursorDirection(): LineDirection { return this._cursorDirection; }
  get extraTurn(): boolean { return this._extraTurn; }
  get horizontalLines(): number[][] { return this._horizontalLines.map(r => [...r]); }
  get verticalLines(): number[][] { return this._verticalLines.map(r => [...r]); }
  get boxes(): number[][] { return this._boxes.map(r => [...r]); }

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.clearAITimer();
    this._aiThinking = false;
    this._gameOver = false;
    this._winner = NO_PLAYER;
    this._isWin = false;
    this._extraTurn = false;
    this._currentPlayer = PLAYER_1;
    this._scores = [0, 0];
    this._completedBoxes = 0;
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._cursorDirection = LINE_HORIZONTAL;
    this.initGrid();
    this.calculateLayout();
  }

  protected onStart(): void {
    this.onInit();
  }

  protected update(_deltaTime: number): void {
    // AI 自动下棋
    if (this._aiEnabled && this._currentPlayer === PLAYER_2 && !this._gameOver && !this._aiThinking) {
      this.scheduleAIMove();
    }
  }

  protected onReset(): void {
    this.clearAITimer();
    this.onInit();
  }

  protected onDestroy(): void {
    this.clearAITimer();
  }

  protected onGameOver(): void {
    this.clearAITimer();
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    this.renderHUD(ctx, w);
    this.renderBoard(ctx);
    this.renderFooter(ctx, w, h);
  }

  // ========== 键盘处理 ==========

  handleKeyDown(key: string): void {
    if (this._gameOver) {
      if (key === 'r' || key === 'R') {
        this.reset();
        this.start();
      }
      return;
    }

    if (this._aiThinking) return;

    switch (key) {
      case 'ArrowUp':
        this.moveCursorUp();
        break;
      case 'ArrowDown':
        this.moveCursorDown();
        break;
      case 'ArrowLeft':
        this.moveCursorLeft();
        break;
      case 'ArrowRight':
        this.moveCursorRight();
        break;
      case ' ':
      case 'Enter':
        this.drawCurrentLine();
        break;
      case 'Tab':
        this.toggleCursorDirection();
        break;
      case 'r':
      case 'R':
        this.reset();
        this.start();
        break;
      case '1':
        this.changeGridSize(3);
        break;
      case '2':
        this.changeGridSize(5);
        break;
      case '3':
        this.changeGridSize(7);
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 无需处理
  }

  getState(): Record<string, unknown> {
    return {
      gridPoints: this._gridPoints,
      currentPlayer: this._currentPlayer,
      scores: [...this._scores],
      totalBoxes: this._totalBoxes,
      completedBoxes: this._completedBoxes,
      isGameOver: this._gameOver,
      winner: this._winner,
      isWin: this._isWin,
      aiEnabled: this._aiEnabled,
      cursorRow: this._cursorRow,
      cursorCol: this._cursorCol,
      cursorDirection: this._cursorDirection,
      horizontalLines: this._horizontalLines,
      verticalLines: this._verticalLines,
      boxes: this._boxes,
    };
  }

  // ========== 公共方法 ==========

  /**
   * 画线 — 核心游戏逻辑
   * @returns 是否成功画线
   */
  drawLine(row: number, col: number, direction: LineDirection, player: number): boolean {
    if (this._gameOver) return false;
    if (player !== this._currentPlayer) return false;

    const lines = direction === LINE_HORIZONTAL ? this._horizontalLines : this._verticalLines;

    // 边界检查
    if (row < 0 || col < 0 || row >= lines.length || col >= lines[0].length) return false;
    // 已画检查
    if (lines[row][col] !== NO_PLAYER) return false;

    // 画线
    lines[row][col] = player;

    // 检查是否完成方格
    const completedBoxes = this.findCompletedBoxes(row, col, direction, player);

    if (completedBoxes.length > 0) {
      // 标记方格
      for (const box of completedBoxes) {
        this._boxes[box.row][box.col] = player;
        this._scores[player - 1]++;
        this._completedBoxes++;
      }
      this._extraTurn = true;

      // 更新分数（用 P1 分数作为主分数显示）
      this.addScore(completedBoxes.length);

      this.emit('boxCompleted', completedBoxes);

      // 检查游戏结束
      if (this._completedBoxes >= this._totalBoxes) {
        this.endGame();
        return true;
      }

      // 完成方格获得额外回合（不切换玩家）
      this.emit('stateChange', this.getState());
      return true;
    }

    // 没完成方格，切换玩家
    this._extraTurn = false;
    this.switchPlayer();
    this.emit('stateChange', this.getState());
    return true;
  }

  /**
   * 画当前光标位置的线
   */
  drawCurrentLine(): boolean {
    if (this._gameOver) return false;
    if (this._aiThinking) return false;
    if (this._aiEnabled && this._currentPlayer === PLAYER_2) return false;

    return this.drawLine(this._cursorRow, this._cursorCol, this._cursorDirection, this._currentPlayer);
  }

  /**
   * 切换光标方向
   */
  toggleCursorDirection(): void {
    this._cursorDirection =
      this._cursorDirection === LINE_HORIZONTAL ? LINE_VERTICAL : LINE_HORIZONTAL;
    this.clampCursor();
  }

  /**
   * 移动光标
   */
  moveCursorUp(): void {
    if (this._cursorDirection === LINE_HORIZONTAL) {
      // 水平线：row 上移
      this._cursorRow = Math.max(0, this._cursorRow - 1);
    } else {
      // 垂直线：row 上移
      this._cursorRow = Math.max(0, this._cursorRow - 1);
    }
  }

  moveCursorDown(): void {
    if (this._cursorDirection === LINE_HORIZONTAL) {
      this._cursorRow = Math.min(this.getMaxRow(LINE_HORIZONTAL), this._cursorRow + 1);
    } else {
      this._cursorRow = Math.min(this.getMaxRow(LINE_VERTICAL), this._cursorRow + 1);
    }
  }

  moveCursorLeft(): void {
    this._cursorCol = Math.max(0, this._cursorCol - 1);
  }

  moveCursorRight(): void {
    this._cursorCol = Math.min(this.getMaxCol(this._cursorDirection), this._cursorCol + 1);
  }

  /**
   * 切换网格大小
   */
  changeGridSize(size: GridSize): void {
    if (!GRID_SIZES.includes(size)) return;
    if (size === this._gridPoints) return;
    this._gridPoints = size;
    this.reset();
    this.start();
  }

  /**
   * 设置 AI 开关
   */
  setAI(enabled: boolean): void {
    this._aiEnabled = enabled;
  }

  /**
   * 获取指定方向的最大行索引
   */
  getMaxRow(direction: LineDirection): number {
    const len = direction === LINE_HORIZONTAL ? this._gridPoints : this._rows;
    return len - 1;
  }

  /**
   * 获取指定方向的最大列索引
   */
  getMaxCol(direction: LineDirection): number {
    const len = direction === LINE_HORIZONTAL ? this._cols : this._gridPoints;
    return len - 1;
  }

  /**
   * 检查某条线是否已画
   */
  isLineDrawn(row: number, col: number, direction: LineDirection): boolean {
    const lines = direction === LINE_HORIZONTAL ? this._horizontalLines : this._verticalLines;
    if (row < 0 || row >= lines.length || col < 0 || col >= (lines[0]?.length ?? 0)) return false;
    return lines[row][col] !== NO_PLAYER;
  }

  /**
   * 获取某条线的归属玩家
   */
  getLineOwner(row: number, col: number, direction: LineDirection): number {
    const lines = direction === LINE_HORIZONTAL ? this._horizontalLines : this._verticalLines;
    if (row < 0 || row >= lines.length || col < 0 || col >= (lines[0]?.length ?? 0)) return NO_PLAYER;
    return lines[row][col];
  }

  /**
   * 获取方格归属
   */
  getBoxOwner(row: number, col: number): number {
    if (row < 0 || row >= this._rows || col < 0 || col >= this._cols) return NO_PLAYER;
    return this._boxes[row][col];
  }

  /**
   * 获取方格的四条边状态
   */
  getBoxSides(row: number, col: number): { top: boolean; bottom: boolean; left: boolean; right: boolean } {
    if (row < 0 || row >= this._rows || col < 0 || col >= this._cols) {
      return { top: false, bottom: false, left: false, right: false };
    }
    return {
      top: this._horizontalLines[row][col] !== NO_PLAYER,
      bottom: this._horizontalLines[row + 1][col] !== NO_PLAYER,
      left: this._verticalLines[row][col] !== NO_PLAYER,
      right: this._verticalLines[row][col + 1] !== NO_PLAYER,
    };
  }

  /**
   * 获取方格已画边数
   */
  getBoxSideCount(row: number, col: number): number {
    const sides = this.getBoxSides(row, col);
    let count = 0;
    if (sides.top) count++;
    if (sides.bottom) count++;
    if (sides.left) count++;
    if (sides.right) count++;
    return count;
  }

  /**
   * 获取所有可画的线
   */
  getAvailableLines(): LinePosition[] {
    const lines: LinePosition[] = [];
    for (let r = 0; r < this._horizontalLines.length; r++) {
      for (let c = 0; c < this._horizontalLines[r].length; c++) {
        if (this._horizontalLines[r][c] === NO_PLAYER) {
          lines.push({ row: r, col: c, direction: LINE_HORIZONTAL });
        }
      }
    }
    for (let r = 0; r < this._verticalLines.length; r++) {
      for (let c = 0; c < this._verticalLines[r].length; c++) {
        if (this._verticalLines[r][c] === NO_PLAYER) {
          lines.push({ row: r, col: c, direction: LINE_VERTICAL });
        }
      }
    }
    return lines;
  }

  // ========== 私有方法 ==========

  /**
   * 初始化网格数据
   */
  private initGrid(): void {
    this._rows = this._gridPoints - 1;
    this._cols = this._gridPoints - 1;
    this._totalBoxes = this._rows * this._cols;

    // 水平线段：gridPoints 行 × cols 列
    this._horizontalLines = Array.from(
      { length: this._gridPoints },
      () => Array(this._cols).fill(NO_PLAYER)
    );

    // 垂直线段：rows 行 × gridPoints 列
    this._verticalLines = Array.from(
      { length: this._rows },
      () => Array(this._gridPoints).fill(NO_PLAYER)
    );

    // 方格
    this._boxes = Array.from(
      { length: this._rows },
      () => Array(this._cols).fill(NO_PLAYER)
    );
  }

  /**
   * 计算布局参数
   */
  private calculateLayout(): void {
    const maxCellW = (CANVAS_WIDTH - 60) / this._cols;
    const maxCellH = (GAME_AREA_HEIGHT - 40) / this._rows;
    this._cellSize = Math.floor(Math.min(maxCellW, maxCellH));

    const boardW = this._cellSize * this._cols;
    const boardH = this._cellSize * this._rows;
    this._boardOffsetX = Math.floor((CANVAS_WIDTH - boardW) / 2);
    this._boardOffsetY = Math.floor(GAME_AREA_TOP + (GAME_AREA_HEIGHT - boardH) / 2);
  }

  /**
   * 查找画线后完成的方格
   */
  private findCompletedBoxes(
    lineRow: number,
    lineCol: number,
    direction: LineDirection,
    player: number
  ): BoxCompletion[] {
    const completed: BoxCompletion[] = [];

    if (direction === LINE_HORIZONTAL) {
      // 水平线可能影响上方方格和下方方格
      // 上方方格：boxes[lineRow - 1][lineCol]（bottom 边）
      if (lineRow > 0 && this.isBoxComplete(lineRow - 1, lineCol)) {
        completed.push({ row: lineRow - 1, col: lineCol, player });
      }
      // 下方方格：boxes[lineRow][lineCol]（top 边）
      if (lineRow < this._rows && this.isBoxComplete(lineRow, lineCol)) {
        completed.push({ row: lineRow, col: lineCol, player });
      }
    } else {
      // 垂直线可能影响左方方格和右方方格
      // 左方方格：boxes[lineRow][lineCol - 1]（right 边）
      if (lineCol > 0 && this.isBoxComplete(lineRow, lineCol - 1)) {
        completed.push({ row: lineRow, col: lineCol - 1, player });
      }
      // 右方方格：boxes[lineRow][lineCol]（left 边）
      if (lineCol < this._cols && this.isBoxComplete(lineRow, lineCol)) {
        completed.push({ row: lineRow, col: lineCol, player });
      }
    }

    return completed;
  }

  /**
   * 检查方格是否完成（四边都已画）
   */
  private isBoxComplete(row: number, col: number): boolean {
    if (row < 0 || row >= this._rows || col < 0 || col >= this._cols) return false;
    if (this._boxes[row][col] !== NO_PLAYER) return false; // 已被占

    const top = this._horizontalLines[row][col] !== NO_PLAYER;
    const bottom = this._horizontalLines[row + 1][col] !== NO_PLAYER;
    const left = this._verticalLines[row][col] !== NO_PLAYER;
    const right = this._verticalLines[row][col + 1] !== NO_PLAYER;

    return top && bottom && left && right;
  }

  /**
   * 切换玩家
   */
  private switchPlayer(): void {
    this._currentPlayer = this._currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;
  }

  /**
   * 限制光标在有效范围内
   */
  private clampCursor(): void {
    const maxRow = this.getMaxRow(this._cursorDirection);
    const maxCol = this.getMaxCol(this._cursorDirection);
    this._cursorRow = Math.min(this._cursorRow, maxRow);
    this._cursorCol = Math.min(this._cursorCol, maxCol);
  }

  /**
   * 结束游戏
   */
  private endGame(): void {
    this._gameOver = true;
    if (this._scores[0] > this._scores[1]) {
      this._winner = PLAYER_1;
      this._isWin = true;
    } else if (this._scores[1] > this._scores[0]) {
      this._winner = PLAYER_2;
      this._isWin = false;
    } else {
      this._winner = NO_PLAYER; // 平局
      this._isWin = false;
    }
    this.gameOver();
  }

  /**
   * 清除 AI 定时器
   */
  private clearAITimer(): void {
    if (this._aiTimer !== null) {
      clearTimeout(this._aiTimer);
      this._aiTimer = null;
    }
  }

  /**
   * 安排 AI 下棋
   */
  private scheduleAIMove(): void {
    if (this._aiThinking) return;
    this._aiThinking = true;
    this._aiTimer = setTimeout(() => {
      this._aiThinking = false;
      this._aiTimer = null;
      if (this._gameOver || this._currentPlayer !== PLAYER_2) return;
      this.aiMove();
    }, AI_THINK_DELAY);
  }

  /**
   * AI 下棋策略
   * 1. 优先完成方格（得分）
   * 2. 避免给对手送分（不画第3条边，除非没有其他选择）
   * 3. 随机选择
   */
  private aiMove(): void {
    const available = this.getAvailableLines();
    if (available.length === 0) return;

    // 策略 1：找到能完成方格的线
    const completingLines = available.filter(line => this.wouldCompleteBox(line));
    if (completingLines.length > 0) {
      const chosen = completingLines[Math.floor(Math.random() * completingLines.length)];
      this.drawLine(chosen.row, chosen.col, chosen.direction, PLAYER_2);
      return;
    }

    // 策略 2：找到不会给对手送分的线（不会创建3边方格）
    const safeLines = available.filter(line => !this.wouldCreate3SideBox(line));
    if (safeLines.length > 0) {
      const chosen = safeLines[Math.floor(Math.random() * safeLines.length)];
      this.drawLine(chosen.row, chosen.col, chosen.direction, PLAYER_2);
      return;
    }

    // 策略 3：被迫选择，选给对手最少送分的线
    // 优先选择只给对手创建1个3边方格的线
    let bestLine = available[0];
    let minCost = Infinity;
    for (const line of available) {
      const cost = this.countCreated3SideBoxes(line);
      if (cost < minCost) {
        minCost = cost;
        bestLine = line;
      }
    }
    this.drawLine(bestLine.row, bestLine.col, bestLine.direction, PLAYER_2);
  }

  /**
   * 检查画某条线是否能完成方格
   */
  private wouldCompleteBox(line: LinePosition): boolean {
    const { row, col, direction } = line;
    if (direction === LINE_HORIZONTAL) {
      if (row > 0 && this.getBoxSideCount(row - 1, col) === 3) return true;
      if (row < this._rows && this.getBoxSideCount(row, col) === 3) return true;
    } else {
      if (col > 0 && this.getBoxSideCount(row, col - 1) === 3) return true;
      if (col < this._cols && this.getBoxSideCount(row, col) === 3) return true;
    }
    return false;
  }

  /**
   * 检查画某条线是否会创建3边方格（给对手送分）
   */
  private wouldCreate3SideBox(line: LinePosition): boolean {
    return this.countCreated3SideBoxes(line) > 0;
  }

  /**
   * 计算画某条线会创建多少个3边方格
   */
  private countCreated3SideBoxes(line: LinePosition): number {
    const { row, col, direction } = line;
    let count = 0;

    if (direction === LINE_HORIZONTAL) {
      if (row > 0 && this._boxes[row - 1][col] === NO_PLAYER) {
        const sides = this.getBoxSideCount(row - 1, col);
        if (sides === 2) count++;
      }
      if (row < this._rows && this._boxes[row][col] === NO_PLAYER) {
        const sides = this.getBoxSideCount(row, col);
        if (sides === 2) count++;
      }
    } else {
      if (col > 0 && this._boxes[row][col - 1] === NO_PLAYER) {
        const sides = this.getBoxSideCount(row, col - 1);
        if (sides === 2) count++;
      }
      if (col < this._cols && this._boxes[row][col] === NO_PLAYER) {
        const sides = this.getBoxSideCount(row, col);
        if (sides === 2) count++;
      }
    }

    return count;
  }

  // ========== 渲染辅助 ==========

  private renderHUD(ctx: CanvasRenderingContext2D, _w: number): void {
    // HUD 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);

    // 玩家1分数
    ctx.fillStyle = PLAYER1_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`P1: ${this._scores[0]}`, 20, 25);

    // 玩家2分数
    ctx.fillStyle = PLAYER2_COLOR;
    ctx.textAlign = 'right';
    ctx.fillText(`${this._scores[1]} :P2`, CANVAS_WIDTH - 20, 25);

    // 当前玩家指示
    ctx.fillStyle = this._currentPlayer === PLAYER_1 ? PLAYER1_COLOR : PLAYER2_COLOR;
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px monospace';
    const turnText = this._gameOver
      ? (this._winner === NO_PLAYER ? '平局!' : `P${this._winner} 胜!`)
      : `P${this._currentPlayer} 的回合${this._extraTurn ? ' (额外)' : ''}`;
    ctx.fillText(turnText, CANVAS_WIDTH / 2, 25);

    // 网格大小
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this._gridPoints}×${this._gridPoints} | 按 1/2/3 切换`, CANVAS_WIDTH / 2, 48);
  }

  private renderBoard(ctx: CanvasRenderingContext2D): void {
    const ox = this._boardOffsetX;
    const oy = this._boardOffsetY;
    const cs = this._cellSize;

    // 绘制已完成的方格
    for (let r = 0; r < this._rows; r++) {
      for (let c = 0; c < this._cols; c++) {
        if (this._boxes[r][c] !== NO_PLAYER) {
          ctx.fillStyle = this._boxes[r][c] === PLAYER_1 ? PLAYER1_BOX_COLOR : PLAYER2_BOX_COLOR;
          ctx.fillRect(ox + c * cs, oy + r * cs, cs, cs);

          // 方格中心标记
          ctx.fillStyle = this._boxes[r][c] === PLAYER_1 ? PLAYER1_COLOR : PLAYER2_COLOR;
          ctx.font = `bold ${Math.floor(cs * 0.4)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`P${this._boxes[r][c]}`, ox + c * cs + cs / 2, oy + r * cs + cs / 2);
        }
      }
    }

    // 绘制已画的水平线
    for (let r = 0; r < this._horizontalLines.length; r++) {
      for (let c = 0; c < this._horizontalLines[r].length; c++) {
        const x1 = ox + c * cs;
        const x2 = ox + (c + 1) * cs;
        const y = oy + r * cs;

        if (this._horizontalLines[r][c] !== NO_PLAYER) {
          ctx.strokeStyle = this._horizontalLines[r][c] === PLAYER_1 ? PLAYER1_COLOR : PLAYER2_COLOR;
          ctx.lineWidth = LINE_WIDTH;
          ctx.lineCap = 'round';
        } else {
          // 未画的线：显示浅色虚线
          ctx.strokeStyle = LINE_COLOR;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
        }

        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 绘制已画的垂直线
    for (let r = 0; r < this._verticalLines.length; r++) {
      for (let c = 0; c < this._verticalLines[r].length; c++) {
        const x = ox + c * cs;
        const y1 = oy + r * cs;
        const y2 = oy + (r + 1) * cs;

        if (this._verticalLines[r][c] !== NO_PLAYER) {
          ctx.strokeStyle = this._verticalLines[r][c] === PLAYER_1 ? PLAYER1_COLOR : PLAYER2_COLOR;
          ctx.lineWidth = LINE_WIDTH;
          ctx.lineCap = 'round';
        } else {
          ctx.strokeStyle = LINE_COLOR;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
        }

        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 绘制光标高亮
    if (!this._gameOver && !(this._aiEnabled && this._currentPlayer === PLAYER_2)) {
      this.renderCursor(ctx);
    }

    // 绘制点
    for (let r = 0; r < this._gridPoints; r++) {
      for (let c = 0; c < this._gridPoints; c++) {
        const x = ox + c * cs;
        const y = oy + r * cs;
        ctx.fillStyle = DOT_COLOR;
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderCursor(ctx: CanvasRenderingContext2D): void {
    const ox = this._boardOffsetX;
    const oy = this._boardOffsetY;
    const cs = this._cellSize;

    ctx.strokeStyle = CURSOR_COLOR;
    ctx.lineWidth = LINE_HIGHLIGHT_WIDTH;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.8;

    if (this._cursorDirection === LINE_HORIZONTAL) {
      const x1 = ox + this._cursorCol * cs;
      const x2 = ox + (this._cursorCol + 1) * cs;
      const y = oy + this._cursorRow * cs;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    } else {
      const x = ox + this._cursorCol * cs;
      const y1 = oy + this._cursorRow * cs;
      const y2 = oy + (this._cursorRow + 1) * cs;
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  private renderFooter(ctx: CanvasRenderingContext2D, _w: number, _h: number): void {
    const footerY = CANVAS_HEIGHT - FOOTER_HEIGHT;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, footerY, CANVAS_WIDTH, FOOTER_HEIGHT);

    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('方向键移动 | 空格画线 | Tab切换方向 | R重开', CANVAS_WIDTH / 2, footerY + FOOTER_HEIGHT / 2);
  }
}
