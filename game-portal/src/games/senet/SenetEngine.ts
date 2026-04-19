import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BOARD_COLS,
  BOARD_ROWS,
  TOTAL_CELLS,
  CELL_SIZE,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  BOARD_PADDING,
  PIECES_PER_PLAYER,
  PLAYER1,
  PLAYER2,
  STICK_COUNT,
  SAFE_HOUSE,
  BEAUTY_HOUSE,
  WATER_HOUSE,
  TRUTH_HOUSE,
  RE_ATOUM_HOUSE,
  EXIT_HOUSE,
  SAFE_HOUSES,
  THROW_EXTRA_TURN,
  BG_COLOR,
  BOARD_COLOR,
  BOARD_BORDER_COLOR,
  CELL_COLOR,
  CELL_DARK_COLOR,
  SAFE_CELL_COLOR,
  WATER_CELL_COLOR,
  PLAYER1_COLOR,
  PLAYER2_COLOR,
  PLAYER1_BORDER,
  PLAYER2_BORDER,
  HIGHLIGHT_COLOR,
  SELECTED_COLOR,
  VALID_MOVE_COLOR,
  SCORE_COLOR,
  STICK_WHITE,
  STICK_DARK,
  TEXT_COLOR,
  PATH_COLOR,
  AI_DELAY,
} from './constants';

// ========== 类型定义 ==========

/** 棋子位置（-1 表示未在棋盘上，-2 表示已移出） */
type CellValue = 0 | 1 | 2; // 0=空, 1=玩家1, 2=玩家2

/** 游戏阶段 */
type GamePhase = 'rolling' | 'selecting' | 'moving' | 'ai_turn' | 'gameover';

/** 掷棍结果 */
interface ThrowResult {
  value: number; // 步数 0-4
  whiteCount: number; // 白面朝上的数量
  extraTurn: boolean; // 是否获得额外回合
}

/** AI 状态 */
interface AIState {
  thinking: boolean;
  timer: number;
}

/** 选择光标 */
interface Cursor {
  position: number; // 当前光标位置（棋盘索引 0-29）
}

// ========== Senet 塞尼特引擎 ==========

export class SenetEngine extends GameEngine {
  // 棋盘：30 格，0=空, 1=玩家1棋子, 2=玩家2棋子
  private board: CellValue[] = new Array(TOTAL_CELLS).fill(0);

  // 当前玩家
  private currentPlayer: 1 | 2 = PLAYER1;

  // 游戏阶段
  private phase: GamePhase = 'rolling';

  // 掷棍结果
  private lastThrow: ThrowResult | null = null;

  // 有效移动列表
  private validMoves: number[] = [];

  // 选中的棋子位置（-1=未选中）
  private selectedPiece: number = -1;

  // 光标
  private cursor: Cursor = { position: 0 };

  // 已移出棋盘的棋子数
  private borneOff: Record<1 | 2, number> = { 1: 0, 2: 0 };

  // AI 状态
  private aiState: AIState = { thinking: false, timer: 0 };

  // 是否胜利
  public isWin: boolean = false;

  // 掷棍动画
  private throwAnimTimer: number = 0;
  private throwAnimDuration: number = 500;
  private throwAnimating: boolean = false;

  // 消息
  private message: string = '按 T 掷棍开始游戏';

  // 按键状态
  private keysDown: Set<string> = new Set();

  // 上一次更新时间
  private lastUpdateTime: number = 0;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.setupBoard();
  }

  protected onStart(): void {
    this.setupBoard();
    this.currentPlayer = PLAYER1;
    this.phase = 'rolling';
    this.lastThrow = null;
    this.validMoves = [];
    this.selectedPiece = -1;
    this.cursor = { position: 0 };
    this.borneOff = { 1: 0, 2: 0 };
    this.aiState = { thinking: false, timer: 0 };
    this.isWin = false;
    this.throwAnimating = false;
    this.throwAnimTimer = 0;
    this.message = '按 T 掷棍开始游戏';
    this.keysDown.clear();
    this._score = 0;
  }

  protected onReset(): void {
    this.setupBoard();
    this.currentPlayer = PLAYER1;
    this.phase = 'rolling';
    this.lastThrow = null;
    this.validMoves = [];
    this.selectedPiece = -1;
    this.cursor = { position: 0 };
    this.borneOff = { 1: 0, 2: 0 };
    this.aiState = { thinking: false, timer: 0 };
    this.isWin = false;
    this.throwAnimating = false;
    this.throwAnimTimer = 0;
    this.message = '按 T 掷棍开始游戏';
    this.keysDown.clear();
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
    this.lastUpdateTime = deltaTime;

    // 掷棍动画
    if (this.throwAnimating) {
      this.throwAnimTimer += deltaTime;
      if (this.throwAnimTimer >= this.throwAnimDuration) {
        this.throwAnimating = false;
        this.throwAnimTimer = 0;
        this.onThrowComplete();
      }
    }

    // AI 回合
    if (this.phase === 'ai_turn' && !this.throwAnimating) {
      this.aiState.timer += deltaTime;
      if (this.aiState.timer >= AI_DELAY) {
        this.aiState.timer = 0;
        this.executeAITurn();
      }
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 标题
    this.renderTitle(ctx, w);

    // 棋盘
    this.renderBoard(ctx);

    // 棋子
    this.renderPieces(ctx);

    // 光标
    this.renderCursor(ctx);

    // 有效移动高亮
    this.renderValidMoves(ctx);

    // 掷棍区域
    this.renderSticks(ctx, w);

    // 信息面板
    this.renderInfoPanel(ctx, w, h);

    // 消息
    this.renderMessage(ctx, w);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    this.keysDown.add(key);

    if (this._status !== 'playing') return;
    if (this.phase === 'ai_turn') return;
    if (this.throwAnimating) return;

    switch (key) {
      case 't':
      case 'T':
        if (this.phase === 'rolling') {
          this.throwSticks();
        }
        break;
      case 'ArrowUp':
        this.moveCursor(-BOARD_COLS);
        break;
      case 'ArrowDown':
        this.moveCursor(BOARD_COLS);
        break;
      case 'ArrowLeft':
        this.moveCursor(-1);
        break;
      case 'ArrowRight':
        this.moveCursor(1);
        break;
      case ' ':
        this.handleConfirm();
        break;
    }
  }

  handleKeyUp(key: string): void {
    this.keysDown.delete(key);
  }

  getState(): Record<string, unknown> {
    return {
      board: [...this.board],
      currentPlayer: this.currentPlayer,
      phase: this.phase,
      lastThrow: this.lastThrow,
      validMoves: [...this.validMoves],
      selectedPiece: this.selectedPiece,
      cursor: this.cursor.position,
      borneOff: { ...this.borneOff },
      isWin: this.isWin,
      message: this.message,
      score: this._score,
    };
  }

  // ========== 公共方法 ==========

  /** 获取棋盘状态 */
  getBoard(): CellValue[] {
    return [...this.board];
  }

  /** 获取当前玩家 */
  getCurrentPlayer(): 1 | 2 {
    return this.currentPlayer;
  }

  /** 获取游戏阶段 */
  getPhase(): GamePhase {
    return this.phase;
  }

  /** 获取掷棍结果 */
  getLastThrow(): ThrowResult | null {
    return this.lastThrow;
  }

  /** 获取有效移动 */
  getValidMoves(): number[] {
    return [...this.validMoves];
  }

  /** 获取已移出棋子数 */
  getBorneOff(): Record<1 | 2, number> {
    return { ...this.borneOff };
  }

  /** 获取光标位置 */
  getCursorPosition(): number {
    return this.cursor.position;
  }

  /** 获取消息 */
  getMessage(): string {
    return this.message;
  }

  /** 掷棍（公共方法，供测试和 AI 使用） */
  throwSticks(): ThrowResult {
    const result = this.performThrow();
    this.lastThrow = result;
    this.throwAnimating = true;
    this.throwAnimTimer = 0;

    if (result.value === 0) {
      // 掷出 0 步，跳过回合
      this.message = `掷出 0 步，跳过回合`;
    } else {
      this.message = `掷出 ${result.value} 步${result.extraTurn ? '（额外回合）' : ''}`;
    }

    return result;
  }

  /** 选择棋子 */
  selectPiece(position: number): boolean {
    if (this.phase !== 'selecting') return false;
    if (position < 0 || position >= TOTAL_CELLS) return false;
    if (this.board[position] !== this.currentPlayer) return false;

    // 检查该棋子是否有有效移动
    const moves = this.getValidMovesForPiece(position);
    if (moves.length === 0) return false;

    this.selectedPiece = position;
    this.validMoves = moves;
    this.phase = 'moving';
    this.message = `选择目标位置，空格确认`;
    return true;
  }

  /** 移动棋子 */
  movePiece(target: number): boolean {
    if (this.phase !== 'moving') return false;
    if (this.selectedPiece < 0) return false;
    if (!this.validMoves.includes(target)) return false;

    return this.executeMove(this.selectedPiece, target);
  }

  // ========== 私有方法：初始化 ==========

  /** 初始化棋盘：交替放置棋子 */
  private setupBoard(): void {
    this.board = new Array(TOTAL_CELLS).fill(0);
    // 玩家1 棋子放在奇数格（1,3,5,7,9 → 索引 0,2,4,6,8）
    // 玩家2 棋子放在偶数格（2,4,6,8,10 → 索引 1,3,5,7,9）
    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      this.board[i * 2] = PLAYER1;     // 索引 0,2,4,6,8
      this.board[i * 2 + 1] = PLAYER2; // 索引 1,3,5,7,9
    }
  }

  // ========== 私有方法：棋盘路径 ==========

  /** 棋盘索引 → 行列坐标 */
  private indexToRowCol(index: number): { row: number; col: number } {
    if (index < 10) {
      return { row: 0, col: index };
    } else if (index < 20) {
      return { row: 1, col: 19 - index };
    } else {
      return { row: 2, col: index - 20 };
    }
  }

  /** 行列坐标 → 棋盘索引 */
  private rowColToIndex(row: number, col: number): number {
    if (row === 0) return col;
    if (row === 1) return 19 - col;
    return 20 + col;
  }

  /** 获取格子的像素坐标（中心点） */
  private getCellCenter(index: number): { x: number; y: number } {
    const { row, col } = this.indexToRowCol(index);
    const x = BOARD_OFFSET_X + col * (CELL_SIZE + BOARD_PADDING) + CELL_SIZE / 2;
    const y = BOARD_OFFSET_Y + row * (CELL_SIZE + BOARD_PADDING) + CELL_SIZE / 2;
    return { x, y };
  }

  // ========== 私有方法：掷棍 ==========

  /** 执行掷棍 */
  private performThrow(): ThrowResult {
    let whiteCount = 0;
    for (let i = 0; i < STICK_COUNT; i++) {
      if (Math.random() < 0.5) whiteCount++;
    }
    const value = whiteCount; // 0-4
    const extraTurn = THROW_EXTRA_TURN.includes(value);
    return { value, whiteCount, extraTurn };
  }

  /** 掷棍动画完成 */
  private onThrowComplete(): void {
    const result = this.lastThrow!;

    if (result.value === 0) {
      // 掷出 0 步，跳过回合
      this.endTurn();
      return;
    }

    // 计算所有有效移动
    this.validMoves = this.getAllValidMoves(result.value);

    if (this.validMoves.length === 0) {
      // 无有效移动，跳过回合
      this.message = `无有效移动，跳过回合`;
      this.endTurn();
      return;
    }

    // 进入选择阶段
    this.phase = 'selecting';
    this.selectedPiece = -1;
    this.message = `掷出 ${result.value} 步，选择棋子`;
  }

  // ========== 私有方法：移动规则 ==========

  /** 获取所有有效移动 */
  private getAllValidMoves(steps: number): number[] {
    const moves: number[] = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.board[i] === this.currentPlayer) {
        const pieceMoves = this.getValidMovesForPiece(i, steps);
        for (const target of pieceMoves) {
          if (!moves.includes(target)) {
            moves.push(target);
          }
        }
      }
    }
    return moves;
  }

  /** 获取某个棋子的有效移动 */
  private getValidMovesForPiece(from: number, steps?: number): number[] {
    const moveSteps = steps ?? this.lastThrow?.value ?? 0;
    if (moveSteps === 0) return [];

    const target = from + moveSteps;
    const moves: number[] = [];

    // 移出棋盘
    if (target >= TOTAL_CELLS) {
      // 只有在所有棋子都过了安全屋（第15格）才能移出
      if (this.canBearOff(this.currentPlayer)) {
        // 精确移出或超过时，检查是否可以
        if (target === TOTAL_CELLS) {
          moves.push(TOTAL_CELLS); // 精确移出
        } else {
          // 超过时，如果有棋子在最高位置也可以移出
          const highestPos = this.getHighestPiecePosition(this.currentPlayer);
          if (from === highestPos) {
            moves.push(TOTAL_CELLS);
          }
        }
      }
      return moves;
    }

    // 检查目标格是否可以移动
    if (this.canMoveTo(target, this.currentPlayer)) {
      moves.push(target);
    }

    return moves;
  }

  /** 检查是否可以移动到目标格 */
  private canMoveTo(target: number, player: 1 | 2): boolean {
    if (target < 0 || target >= TOTAL_CELLS) return false;

    const occupant = this.board[target];

    // 空格可以移动
    if (occupant === 0) return true;

    // 自己的棋子不能移动到已有自己棋子的格子
    if (occupant === player) return false;

    // 对方棋子在安全屋不能被吃
    if (SAFE_HOUSES.includes(target + 1)) return false;

    // 对方棋子可以被吃（送回起点）
    return true;
  }

  /** 检查玩家是否可以移出棋子（所有棋子都过了安全屋） */
  private canBearOff(player: 1 | 2): boolean {
    for (let i = 0; i < SAFE_HOUSE - 1; i++) { // 安全屋之前（索引 < 14）
      if (this.board[i] === player) return false;
    }
    return true;
  }

  /** 获取玩家在棋盘上最高位置的棋子 */
  private getHighestPiecePosition(player: 1 | 2): number {
    let highest = -1;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.board[i] === player) {
        highest = i;
      }
    }
    return highest;
  }

  /** 执行移动 */
  private executeMove(from: number, target: number): boolean {
    const player = this.currentPlayer;
    const opponent = player === PLAYER1 ? PLAYER2 : PLAYER1;

    // 清除原位置
    this.board[from] = 0;

    if (target >= TOTAL_CELLS) {
      // 移出棋盘
      this.borneOff[player]++;
      this.addScore(player === PLAYER1 ? 10 : 0);
      this.message = `棋子移出棋盘！`;
    } else {
      // 检查是否吃子
      if (this.board[target] === opponent) {
        // 送回起点
        const startPos = this.findEmptyStartPos();
        if (startPos >= 0) {
          this.board[startPos] = opponent;
        }
        this.message = `吃掉对方棋子！`;
      } else {
        this.message = `移动到第 ${target + 1} 格`;
      }

      this.board[target] = player;

      // 水之屋特殊规则：掉入水之屋回到安全屋
      if (target + 1 === WATER_HOUSE) {
        const safeIdx = SAFE_HOUSE - 1; // 安全屋索引
        if (this.board[safeIdx] === 0) {
          this.board[target] = 0;
          this.board[safeIdx] = player;
          this.message = `掉入水之屋，回到安全屋！`;
        }
        // 如果安全屋被占，留在水之屋
      }
    }

    // 检查胜利
    if (this.checkWin(player)) {
      this.phase = 'gameover';
      this.isWin = player === PLAYER1;
      this.message = player === PLAYER1 ? '恭喜，你赢了！' : 'AI 赢了！';
      this.gameOver();
      return true;
    }

    // 结束回合
    this.selectedPiece = -1;
    this.validMoves = [];
    this.endTurn();
    return true;
  }

  /** 找到空起始位置 */
  private findEmptyStartPos(): number {
    for (let i = 0; i < 10; i++) {
      if (this.board[i] === 0) return i;
    }
    return -1;
  }

  /** 结束回合 */
  private endTurn(): void {
    const extraTurn = this.lastThrow?.extraTurn ?? false;

    if (extraTurn) {
      // 额外回合
      this.message += '（额外回合）';
    } else {
      // 切换玩家
      this.currentPlayer = this.currentPlayer === PLAYER1 ? PLAYER2 : PLAYER1;
    }

    this.phase = 'rolling';
    this.lastThrow = null;
    this.selectedPiece = -1;
    this.validMoves = [];

    // AI 回合
    if (this.currentPlayer === PLAYER2) {
      this.phase = 'ai_turn';
      this.aiState = { thinking: true, timer: 0 };
      this.message = 'AI 思考中...';
    } else {
      this.message = '按 T 掷棍';
    }
  }

  /** 检查胜利 */
  private checkWin(player: 1 | 2): boolean {
    return this.borneOff[player] >= PIECES_PER_PLAYER;
  }

  // ========== 私有方法：AI ==========

  /** 执行 AI 回合 */
  private executeAITurn(): void {
    // 掷棍
    const result = this.throwSticks();
    // throwSticks 会设置 throwAnimating，但 AI 直接处理
    this.throwAnimating = false;

    if (result.value === 0) {
      this.endTurn();
      return;
    }

    // 获取所有可能的移动
    const allMoves: { from: number; target: number }[] = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.board[i] === PLAYER2) {
        const moves = this.getValidMovesForPiece(i, result.value);
        for (const target of moves) {
          allMoves.push({ from: i, target });
        }
      }
    }

    if (allMoves.length === 0) {
      this.endTurn();
      return;
    }

    // AI 策略：优先移出 > 吃子 > 前进最远 > 安全屋 > 任意
    let bestMove = allMoves[0];

    // 优先移出
    const bearOffMove = allMoves.find(m => m.target >= TOTAL_CELLS);
    if (bearOffMove) {
      bestMove = bearOffMove;
    } else {
      // 优先吃子
      const captureMove = allMoves.find(m =>
        m.target < TOTAL_CELLS &&
        this.board[m.target] === PLAYER1 &&
        !SAFE_HOUSES.includes(m.target + 1)
      );
      if (captureMove) {
        bestMove = captureMove;
      } else {
        // 优先前进最远的棋子
        const sorted = [...allMoves].sort((a, b) => b.from - a.from);
        bestMove = sorted[0];
      }
    }

    // 执行移动
    this.selectedPiece = bestMove.from;
    this.validMoves = [bestMove.target];
    this.executeMove(bestMove.from, bestMove.target);
  }

  // ========== 私有方法：输入 ==========

  /** 移动光标 */
  private moveCursor(delta: number): void {
    if (this.phase !== 'selecting' && this.phase !== 'moving') return;

    let newPos = this.cursor.position + delta;
    newPos = Math.max(0, Math.min(TOTAL_CELLS - 1, newPos));
    this.cursor.position = newPos;
  }

  /** 确认操作 */
  private handleConfirm(): void {
    if (this.phase === 'selecting') {
      // 选择棋子
      this.selectPiece(this.cursor.position);
    } else if (this.phase === 'moving') {
      // 移动棋子
      if (this.validMoves.includes(this.cursor.position)) {
        this.movePiece(this.cursor.position);
      }
    }
  }

  // ========== 私有方法：渲染 ==========

  private renderTitle(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏛 塞尼特 Senet', w / 2, 40);

    // 当前玩家指示
    ctx.font = '14px sans-serif';
    const playerText = this.currentPlayer === PLAYER1 ? '⚪ 你的回合' : '⚫ AI 回合';
    ctx.fillText(playerText, w / 2, 65);
  }

  private renderBoard(ctx: CanvasRenderingContext2D): void {
    const boardWidth = BOARD_COLS * (CELL_SIZE + BOARD_PADDING) - BOARD_PADDING;
    const boardHeight = BOARD_ROWS * (CELL_SIZE + BOARD_PADDING) - BOARD_PADDING;

    // 棋盘背景
    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(
      BOARD_OFFSET_X - 6,
      BOARD_OFFSET_Y - 6,
      boardWidth + 12,
      boardHeight + 12
    );

    // 棋盘边框
    ctx.strokeStyle = BOARD_BORDER_COLOR;
    ctx.lineWidth = 3;
    ctx.strokeRect(
      BOARD_OFFSET_X - 6,
      BOARD_OFFSET_Y - 6,
      boardWidth + 12,
      boardHeight + 12
    );

    // 绘制格子
    for (let i = 0; i < TOTAL_CELLS; i++) {
      const { row, col } = this.indexToRowCol(i);
      const x = BOARD_OFFSET_X + col * (CELL_SIZE + BOARD_PADDING);
      const y = BOARD_OFFSET_Y + row * (CELL_SIZE + BOARD_PADDING);

      // 格子颜色
      let color = CELL_COLOR;
      if ((row + col) % 2 === 1) color = CELL_DARK_COLOR;

      // 特殊格子
      const cellNum = i + 1;
      if (SAFE_HOUSES.includes(cellNum)) {
        color = SAFE_CELL_COLOR;
      } else if (cellNum === WATER_HOUSE) {
        color = WATER_CELL_COLOR;
      } else if (cellNum === BEAUTY_HOUSE) {
        color = '#ff69b4';
      }

      ctx.fillStyle = color;
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      // 格子边框
      ctx.strokeStyle = BOARD_BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

      // 格子编号（特殊格）
      if (cellNum >= 15 || cellNum <= 10) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${cellNum}`, x + CELL_SIZE / 2, y + CELL_SIZE - 4);
      }

      // 特殊格标记
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      if (cellNum === SAFE_HOUSE) {
        ctx.fillStyle = '#8b6914';
        ctx.fillText('☥', x + CELL_SIZE / 2, y + 14);
      } else if (cellNum === BEAUTY_HOUSE) {
        ctx.fillStyle = '#fff';
        ctx.fillText('♡', x + CELL_SIZE / 2, y + 14);
      } else if (cellNum === WATER_HOUSE) {
        ctx.fillStyle = '#fff';
        ctx.fillText('≋', x + CELL_SIZE / 2, y + 14);
      } else if (cellNum === TRUTH_HOUSE) {
        ctx.fillStyle = '#8b6914';
        ctx.fillText('◉', x + CELL_SIZE / 2, y + 14);
      } else if (cellNum === RE_ATOUM_HOUSE) {
        ctx.fillStyle = '#8b6914';
        ctx.fillText('☀', x + CELL_SIZE / 2, y + 14);
      } else if (cellNum === EXIT_HOUSE) {
        ctx.fillStyle = '#8b6914';
        ctx.fillText('△', x + CELL_SIZE / 2, y + 14);
      }
    }

    // 绘制蛇形路径指示
    ctx.strokeStyle = PATH_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i < TOTAL_CELLS - 1; i++) {
      const from = this.getCellCenter(i);
      const to = this.getCellCenter(i + 1);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private renderPieces(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (this.board[i] === 0) continue;

      const { x, y } = this.getCellCenter(i);
      const player = this.board[i];
      const radius = CELL_SIZE / 2 - 6;

      // 棋子阴影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
      ctx.fill();

      // 棋子本体
      ctx.fillStyle = player === PLAYER1 ? PLAYER1_COLOR : PLAYER2_COLOR;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // 棋子边框
      ctx.strokeStyle = player === PLAYER1 ? PLAYER1_BORDER : PLAYER2_BORDER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 选中高亮
      if (this.selectedPiece === i) {
        ctx.strokeStyle = SELECTED_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private renderCursor(ctx: CanvasRenderingContext2D): void {
    if (this.phase !== 'selecting' && this.phase !== 'moving') return;

    const { x, y } = this.getCellCenter(this.cursor.position);

    ctx.strokeStyle = HIGHLIGHT_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    // 光标方框
    const size = CELL_SIZE + 4;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    ctx.setLineDash([]);
  }

  private renderValidMoves(ctx: CanvasRenderingContext2D): void {
    if (this.phase !== 'moving') return;

    for (const target of this.validMoves) {
      if (target >= TOTAL_CELLS) continue; // 移出棋盘不在棋盘上显示

      const { x, y } = this.getCellCenter(target);
      ctx.fillStyle = VALID_MOVE_COLOR;
      ctx.beginPath();
      ctx.arc(x, y, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderSticks(ctx: CanvasRenderingContext2D, w: number): void {
    const stickY = BOARD_OFFSET_Y + BOARD_ROWS * (CELL_SIZE + BOARD_PADDING) + 30;
    const stickWidth = 12;
    const stickHeight = 50;
    const stickGap = 20;
    const totalWidth = STICK_COUNT * stickWidth + (STICK_COUNT - 1) * stickGap;
    const startX = (w - totalWidth) / 2;

    // 标签
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('掷棍', w / 2, stickY - 10);

    for (let i = 0; i < STICK_COUNT; i++) {
      const x = startX + i * (stickWidth + stickGap);

      let isWhite = false;
      if (this.throwAnimating) {
        // 动画中随机显示
        isWhite = Math.random() > 0.5;
      } else if (this.lastThrow) {
        isWhite = i < this.lastThrow.whiteCount;
      }

      // 棍子阴影
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 2, stickY + 2, stickWidth, stickHeight);

      // 棍子本体
      ctx.fillStyle = isWhite ? STICK_WHITE : STICK_DARK;
      ctx.fillRect(x, stickY, stickWidth, stickHeight);

      // 边框
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, stickY, stickWidth, stickHeight);
    }

    // 掷棍结果
    if (this.lastThrow && !this.throwAnimating) {
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${this.lastThrow.value} 步${this.lastThrow.extraTurn ? ' (额外回合)' : ''}`,
        w / 2,
        stickY + stickHeight + 25
      );
    }
  }

  private renderInfoPanel(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panelY = h - 120;

    // 已移出棋子
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⚪ 已移出: ${this.borneOff[PLAYER1]}/${PIECES_PER_PLAYER}`, 20, panelY);
    ctx.fillText(`⚫ 已移出: ${this.borneOff[PLAYER2]}/${PIECES_PER_PLAYER}`, 20, panelY + 22);

    // 操作提示
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    if (this.phase === 'rolling' && this.currentPlayer === PLAYER1) {
      ctx.fillText('按 T 掷棍', w / 2, panelY + 50);
    } else if (this.phase === 'selecting') {
      ctx.fillText('方向键移动光标 · 空格选择棋子', w / 2, panelY + 50);
    } else if (this.phase === 'moving') {
      ctx.fillText('方向键选择目标 · 空格确认移动', w / 2, panelY + 50);
    }
  }

  private renderMessage(ctx: CanvasRenderingContext2D, w: number): void {
    if (!this.message) return;

    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.message, w / 2, 90);
  }
}
