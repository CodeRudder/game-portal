/**
 * 六角棋 (Hex) 游戏引擎
 *
 * 核心玩法：
 * - 11×11 六角形棋盘
 * - 红方连接上下边，蓝方连接左右边
 * - 交替在空格放置棋子
 * - BFS 检测是否连通对边
 * - 交换规则（Swap Rule）：第二步后可选择交换颜色
 * - 简单 AI：随机落子 + 基础策略
 *
 * 键盘控制：
 * - 方向键：移动光标（六角网格移动）
 * - 空格：落子
 * - S：交换（Swap，仅在第二步后可用）
 */
import { GameEngine } from '@/core/GameEngine';
import {
  BOARD_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CELL_EMPTY,
  CELL_RED,
  CELL_BLUE,
  PLAYER_RED,
  PLAYER_BLUE,
  COLOR_RED,
  COLOR_RED_LIGHT,
  COLOR_RED_DARK,
  COLOR_BLUE,
  COLOR_BLUE_LIGHT,
  COLOR_BLUE_DARK,
  COLOR_BOARD_BG,
  COLOR_CELL_EMPTY,
  COLOR_CELL_BORDER,
  COLOR_CURSOR,
  COLOR_TEXT,
  COLOR_TEXT_DIM,
  HEX_RADIUS,
  HEX_GAP,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  SCORE_WIN,
  AI_THINK_DELAY,
  MODE_PVP,
  MODE_PVE,
  HEX_NEIGHBORS_EVEN,
  HEX_NEIGHBORS_ODD,
} from './constants';

// ========== 类型定义 ==========

/** 棋盘格子类型 */
type CellValue = typeof CELL_EMPTY | typeof CELL_RED | typeof CELL_BLUE;

/** 坐标点 */
interface Point {
  x: number;
  y: number;
}

/** 游戏模式 */
type GameMode = typeof MODE_PVP | typeof MODE_PVE;

// ========== 引擎实现 ==========

export class HexEngine extends GameEngine {
  // ---------- 棋盘状态 ----------
  /** 棋盘数据 [col][row]，col=0..10, row=0..10 */
  private board: CellValue[][] = [];
  /** 当前玩家 */
  private currentPlayer: typeof PLAYER_RED | typeof PLAYER_BLUE = PLAYER_RED;
  /** 光标位置 */
  private cursorCol: number = Math.floor(BOARD_SIZE / 2);
  private cursorRow: number = Math.floor(BOARD_SIZE / 2);
  /** 已落子步数 */
  private moveCount: number = 0;
  /** 胜者（0=无，1=红，2=蓝） */
  private winner: number = 0;
  /** 是否已使用交换 */
  private swapUsed: boolean = false;
  /** 游戏模式 */
  private mode: GameMode = MODE_PVE;
  /** AI 是否正在思考 */
  private aiThinking: boolean = false;
  /** AI 思考计时器 */
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  /** 获胜路径 */
  private winPath: Set<string> = new Set();
  /** 最后落子位置 */
  private lastMove: { col: number; row: number } | null = null;
  /** 是否胜利 */
  public isWin: boolean = false;
  /** 移动历史（用于交换规则） */
  private moveHistory: { col: number; row: number; player: number }[] = [];

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.initBoard();
  }

  protected onStart(): void {
    this.initBoard();
    this.currentPlayer = PLAYER_RED;
    this.moveCount = 0;
    this.winner = 0;
    this.swapUsed = false;
    this.aiThinking = false;
    this.winPath = new Set();
    this.lastMove = null;
    this.isWin = false;
    this.moveHistory = [];
    this.cursorCol = Math.floor(BOARD_SIZE / 2);
    this.cursorRow = Math.floor(BOARD_SIZE / 2);
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  protected update(_deltaTime: number): void {
    // Hex 是回合制游戏，不需要帧更新逻辑
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 清空背景
    ctx.fillStyle = COLOR_BOARD_BG;
    ctx.fillRect(0, 0, w, h);

    this.renderTitle(ctx, w);
    this.renderBorderLabels(ctx);
    this.renderBoard(ctx);
    this.renderCursor(ctx);
    this.renderStatus(ctx, w, h);
  }

  protected onReset(): void {
    this.initBoard();
    this.currentPlayer = PLAYER_RED;
    this.moveCount = 0;
    this.winner = 0;
    this.swapUsed = false;
    this.aiThinking = false;
    this.winPath = new Set();
    this.lastMove = null;
    this.isWin = false;
    this.moveHistory = [];
    this.cursorCol = Math.floor(BOARD_SIZE / 2);
    this.cursorRow = Math.floor(BOARD_SIZE / 2);
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  protected onGameOver(): void {
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

  // ========== 公共方法 ==========

  /** 切换游戏模式 */
  setMode(mode: GameMode): void {
    this.mode = mode;
  }

  /** 获取游戏模式 */
  getMode(): GameMode {
    return this.mode;
  }

  /** 获取当前玩家 */
  getCurrentPlayer(): number {
    return this.currentPlayer;
  }

  /** 获取棋盘副本 */
  getBoard(): CellValue[][] {
    return this.board.map(col => [...col]);
  }

  /** 获取光标位置 */
  getCursor(): { col: number; row: number } {
    return { col: this.cursorCol, row: this.cursorRow };
  }

  /** 获取步数 */
  getMoveCount(): number {
    return this.moveCount;
  }

  /** 获取胜者 */
  getWinner(): number {
    return this.winner;
  }

  /** 是否已交换 */
  isSwapUsed(): boolean {
    return this.swapUsed;
  }

  /** 获取最后落子位置 */
  getLastMove(): { col: number; row: number } | null {
    return this.lastMove;
  }

  /** 获取获胜路径 */
  getWinPath(): Set<string> {
    return new Set(this.winPath);
  }

  /** AI 是否正在思考 */
  isAiThinking(): boolean {
    return this.aiThinking;
  }

  /**
   * 在指定位置落子
   * @returns 是否成功落子
   */
  placePiece(col: number, row: number): boolean {
    if (this._status !== 'playing') return false;
    if (this.winner !== 0) return false;
    if (this.aiThinking) return false;
    if (!this.isValidPosition(col, row)) return false;
    if (this.board[col][row] !== CELL_EMPTY) return false;

    const cellValue = this.currentPlayer === PLAYER_RED ? CELL_RED : CELL_BLUE;
    this.board[col][row] = cellValue;
    this.moveHistory.push({ col, row, player: this.currentPlayer });
    this.lastMove = { col, row };
    this.moveCount++;

    // 检查胜利
    if (this.checkWin(this.currentPlayer)) {
      this.winner = this.currentPlayer;
      this.isWin = this.currentPlayer === PLAYER_RED;
      this.addScore(SCORE_WIN);
      this.emit('stateChange');
      this.gameOver();
      return true;
    }

    // 切换玩家
    this.switchPlayer();
    this.emit('stateChange');

    // AI 回合
    if (this.mode === MODE_PVE && this.currentPlayer === PLAYER_BLUE && this.winner === 0) {
      this.triggerAiMove();
    }

    return true;
  }

  /**
   * 执行交换规则（Swap Rule）
   * 第二步后，蓝方可以选择交换颜色（即拿走红方的第一步棋子作为自己的）
   * @returns 是否成功交换
   */
  performSwap(): boolean {
    if (this._status !== 'playing') return false;
    if (this.moveCount !== 1) return false; // 只能在第一步后交换
    if (this.swapUsed) return false;
    if (this.currentPlayer !== PLAYER_BLUE) return false; // 只有蓝方可以交换
    if (this.aiThinking) return false;
    if (this.winner !== 0) return false; // 游戏已结束

    // 交换：将红方的第一步改为蓝方的
    const firstMove = this.moveHistory[0];
    if (!firstMove) return false;

    this.board[firstMove.col][firstMove.row] = CELL_BLUE;
    firstMove.player = PLAYER_BLUE;
    this.swapUsed = true;

    // 切换回红方
    this.switchPlayer();
    this.emit('stateChange');

    return true;
  }

  // ========== 键盘处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;
    if (this.winner !== 0) return;

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
        this.placePiece(this.cursorCol, this.cursorRow);
        break;
      case 's':
      case 'S':
        this.performSwap();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // Hex 不需要 keyUp 逻辑
  }

  // ========== getState ==========

  getState(): Record<string, unknown> {
    return {
      board: this.getBoard(),
      currentPlayer: this.currentPlayer,
      cursorCol: this.cursorCol,
      cursorRow: this.cursorRow,
      moveCount: this.moveCount,
      winner: this.winner,
      swapUsed: this.swapUsed,
      mode: this.mode,
      aiThinking: this.aiThinking,
      lastMove: this.lastMove,
      winPath: Array.from(this.winPath),
      isWin: this.isWin,
      moveHistory: this.moveHistory.map(m => ({ ...m })),
    };
  }

  // ========== 私有方法 ==========

  /** 初始化棋盘 */
  private initBoard(): void {
    this.board = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      this.board[col] = [];
      for (let row = 0; row < BOARD_SIZE; row++) {
        this.board[col][row] = CELL_EMPTY;
      }
    }
  }

  /** 检查坐标是否合法 */
  private isValidPosition(col: number, row: number): boolean {
    return col >= 0 && col < BOARD_SIZE && row >= 0 && row < BOARD_SIZE;
  }

  /** 切换玩家 */
  private switchPlayer(): void {
    this.currentPlayer = this.currentPlayer === PLAYER_RED ? PLAYER_BLUE : PLAYER_RED;
  }

  /** 获取六角格的邻居坐标 */
  private getNeighbors(col: number, row: number): [number, number][] {
    const neighbors: [number, number][] = [];
    const offsets = row % 2 === 0 ? HEX_NEIGHBORS_EVEN : HEX_NEIGHBORS_ODD;

    for (const [dc, dr] of offsets) {
      const nc = col + dc;
      const nr = row + dr;
      if (this.isValidPosition(nc, nr)) {
        neighbors.push([nc, nr]);
      }
    }

    return neighbors;
  }

  /**
   * 公开的获取邻居方法（用于测试）
   */
  getNeighborCells(col: number, row: number): [number, number][] {
    return this.getNeighbors(col, row);
  }

  /**
   * BFS 检测玩家是否连通对边
   * 红方：连接上边 (row=0) 到下边 (row=BOARD_SIZE-1)
   * 蓝方：连接左边 (col=0) 到右边 (col=BOARD_SIZE-1)
   */
  private checkWin(player: number): boolean {
    const cellValue = player === PLAYER_RED ? CELL_RED : CELL_BLUE;
    const visited: boolean[][] = Array.from({ length: BOARD_SIZE }, () =>
      Array(BOARD_SIZE).fill(false)
    );
    const parent: Map<string, string | null> = new Map();
    const queue: [number, number][] = [];

    // 起始边
    if (player === PLAYER_RED) {
      // 红方从上边开始
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (this.board[col][0] === cellValue) {
          queue.push([col, 0]);
          visited[col][0] = true;
          parent.set(`${col},0`, null);
        }
      }
    } else {
      // 蓝方从左边开始
      for (let row = 0; row < BOARD_SIZE; row++) {
        if (this.board[0][row] === cellValue) {
          queue.push([0, row]);
          visited[0][row] = true;
          parent.set(`0,${row}`, null);
        }
      }
    }

    // BFS
    while (queue.length > 0) {
      const [col, row] = queue.shift()!;

      // 检查是否到达对边
      if (player === PLAYER_RED && row === BOARD_SIZE - 1) {
        this.traceWinPath(parent, col, row);
        return true;
      }
      if (player === PLAYER_BLUE && col === BOARD_SIZE - 1) {
        this.traceWinPath(parent, col, row);
        return true;
      }

      // 扩展邻居
      for (const [nc, nr] of this.getNeighbors(col, row)) {
        if (!visited[nc][nr] && this.board[nc][nr] === cellValue) {
          visited[nc][nr] = true;
          queue.push([nc, nr]);
          parent.set(`${nc},${nr}`, `${col},${row}`);
        }
      }
    }

    return false;
  }

  /** 追踪获胜路径 */
  private traceWinPath(parent: Map<string, string | null>, endCol: number, endRow: number): void {
    this.winPath = new Set();
    let key: string | null = `${endCol},${endRow}`;
    while (key !== null) {
      this.winPath.add(key);
      key = parent.get(key) ?? null;
    }
  }

  /**
   * 公开的胜利检测方法（用于测试）
   */
  checkWinPublic(player: number): boolean {
    return this.checkWin(player);
  }

  // ========== AI ==========

  /** 触发 AI 落子 */
  private triggerAiMove(): void {
    this.aiThinking = true;
    this.aiTimer = setTimeout(() => {
      this.aiThinking = false;
      this.aiTimer = null;
      if (this._status !== 'playing' || this.winner !== 0) return;
      const move = this.calculateAiMove();
      if (move) {
        this.placePiece(move.col, move.row);
      }
    }, AI_THINK_DELAY);
  }

  /** 计算 AI 落子位置 */
  private calculateAiMove(): { col: number; row: number } | null {
    const emptyCells: { col: number; row: number }[] = [];

    for (let col = 0; col < BOARD_SIZE; col++) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        if (this.board[col][row] === CELL_EMPTY) {
          emptyCells.push({ col, row });
        }
      }
    }

    if (emptyCells.length === 0) return null;

    // 策略1: 检查能否直接赢
    for (const cell of emptyCells) {
      this.board[cell.col][cell.row] = CELL_BLUE;
      if (this.checkWin(PLAYER_BLUE)) {
        this.board[cell.col][cell.row] = CELL_EMPTY;
        return cell;
      }
      this.board[cell.col][cell.row] = CELL_EMPTY;
    }

    // 策略2: 检查是否需要阻挡对手
    for (const cell of emptyCells) {
      this.board[cell.col][cell.row] = CELL_RED;
      if (this.checkWin(PLAYER_RED)) {
        this.board[cell.col][cell.row] = CELL_EMPTY;
        return cell;
      }
      this.board[cell.col][cell.row] = CELL_EMPTY;
    }

    // 策略3: 选择靠近中心的空格
    const center = Math.floor(BOARD_SIZE / 2);
    emptyCells.sort((a, b) => {
      const distA = Math.abs(a.col - center) + Math.abs(a.row - center);
      const distB = Math.abs(b.col - center) + Math.abs(b.row - center);
      return distA - distB;
    });

    // 从前5个中随机选择（增加变化性）
    const topN = Math.min(5, emptyCells.length);
    const idx = Math.floor(Math.random() * topN);
    return emptyCells[idx];
  }

  /**
   * 公开的 AI 计算方法（用于测试）
   */
  calculateAiMovePublic(): { col: number; row: number } | null {
    return this.calculateAiMove();
  }

  // ========== 光标移动 ==========

  private moveCursorUp(): void {
    if (this.cursorRow > 0) {
      this.cursorRow--;
    }
  }

  private moveCursorDown(): void {
    if (this.cursorRow < BOARD_SIZE - 1) {
      this.cursorRow++;
    }
  }

  private moveCursorLeft(): void {
    if (this.cursorCol > 0) {
      this.cursorCol--;
    }
  }

  private moveCursorRight(): void {
    if (this.cursorCol < BOARD_SIZE - 1) {
      this.cursorCol++;
    }
  }

  // ========== 渲染方法 ==========

  /** 渲染标题 */
  private renderTitle(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('六角棋 Hex', w / 2, 30);

    // 模式指示
    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = COLOR_TEXT_DIM;
    ctx.fillText(
      this.mode === MODE_PVE ? '🎮 人机对战' : '👥 双人对战',
      w / 2,
      50
    );
  }

  /** 渲染边界标签 */
  private renderBorderLabels(ctx: CanvasRenderingContext2D): void {
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';

    // 上边 - 红方
    ctx.fillStyle = COLOR_RED;
    for (let col = 0; col < BOARD_SIZE; col++) {
      const pos = this.hexToPixel(col, 0);
      ctx.fillText('R', pos.x, pos.y - HEX_RADIUS - 6);
    }

    // 下边 - 红方
    for (let col = 0; col < BOARD_SIZE; col++) {
      const pos = this.hexToPixel(col, BOARD_SIZE - 1);
      ctx.fillText('R', pos.x, pos.y + HEX_RADIUS + 14);
    }

    // 左边 - 蓝方
    ctx.fillStyle = COLOR_BLUE;
    for (let row = 0; row < BOARD_SIZE; row++) {
      const pos = this.hexToPixel(0, row);
      ctx.save();
      ctx.translate(pos.x - HEX_RADIUS - 10, pos.y);
      ctx.fillText('B', 0, 5);
      ctx.restore();
    }

    // 右边 - 蓝方
    for (let row = 0; row < BOARD_SIZE; row++) {
      const pos = this.hexToPixel(BOARD_SIZE - 1, row);
      ctx.fillText('B', pos.x + HEX_RADIUS + 10, pos.y + 5);
    }
  }

  /** 渲染棋盘 */
  private renderBoard(ctx: CanvasRenderingContext2D): void {
    for (let col = 0; col < BOARD_SIZE; col++) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        const pos = this.hexToPixel(col, row);
        const cell = this.board[col][row];
        const isWinCell = this.winPath.has(`${col},${row}`);
        const isLastMove = this.lastMove?.col === col && this.lastMove?.row === row;

        this.renderHexCell(ctx, pos.x, pos.y, cell, isWinCell, isLastMove);
      }
    }
  }

  /** 渲染单个六角格 */
  private renderHexCell(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    cell: CellValue,
    isWinCell: boolean,
    isLastMove: boolean
  ): void {
    const r = HEX_RADIUS;

    // 绘制六角形路径
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // 填充颜色
    if (cell === CELL_RED) {
      ctx.fillStyle = isWinCell ? COLOR_RED_LIGHT : COLOR_RED;
    } else if (cell === CELL_BLUE) {
      ctx.fillStyle = isWinCell ? COLOR_BLUE_LIGHT : COLOR_BLUE;
    } else {
      ctx.fillStyle = COLOR_CELL_EMPTY;
    }
    ctx.fill();

    // 边框
    ctx.strokeStyle = isWinCell ? '#f1c40f' : COLOR_CELL_BORDER;
    ctx.lineWidth = isWinCell ? 2.5 : 1;
    ctx.stroke();

    // 最后落子标记
    if (isLastMove && cell !== CELL_EMPTY) {
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  /** 渲染光标 */
  private renderCursor(ctx: CanvasRenderingContext2D): void {
    if (this.winner !== 0) return;
    const pos = this.hexToPixel(this.cursorCol, this.cursorRow);
    const r = HEX_RADIUS + 3;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = pos.x + r * Math.cos(angle);
      const y = pos.y + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.strokeStyle = COLOR_CURSOR;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  /** 渲染状态信息 */
  private renderStatus(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const y = h - 50;
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Courier New", monospace';

    if (this.winner !== 0) {
      const color = this.winner === PLAYER_RED ? COLOR_RED : COLOR_BLUE;
      const name = this.winner === PLAYER_RED ? '红方' : '蓝方';
      ctx.fillStyle = color;
      ctx.fillText(`🎉 ${name} 获胜！`, w / 2, y);
    } else if (this.aiThinking) {
      ctx.fillStyle = COLOR_BLUE;
      ctx.fillText('🤔 AI 思考中...', w / 2, y);
    } else {
      const color = this.currentPlayer === PLAYER_RED ? COLOR_RED : COLOR_BLUE;
      const name = this.currentPlayer === PLAYER_RED ? '红方' : '蓝方';
      ctx.fillStyle = color;
      ctx.fillText(`当前: ${name}`, w / 2, y);

      // 交换提示
      if (this.moveCount === 1 && this.currentPlayer === PLAYER_BLUE && !this.swapUsed) {
        ctx.font = '12px "Courier New", monospace';
        ctx.fillStyle = COLOR_TEXT_DIM;
        ctx.fillText('按 S 可交换', w / 2, y + 20);
      }
    }

    // 步数
    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = COLOR_TEXT_DIM;
    ctx.textAlign = 'left';
    ctx.fillText(`步数: ${this.moveCount}`, 10, h - 10);
  }

  /** 六角格坐标转像素坐标 */
  private hexToPixel(col: number, row: number): Point {
    const r = HEX_RADIUS + HEX_GAP;
    const x = BOARD_OFFSET_X + col * r * Math.sqrt(3) + (row % 2 === 1 ? r * Math.sqrt(3) / 2 : 0);
    const y = BOARD_OFFSET_Y + row * r * 1.5;
    return { x, y };
  }

  /** 公开的坐标转换方法（用于测试） */
  hexToPixelPublic(col: number, row: number): Point {
    return this.hexToPixel(col, row);
  }
}
