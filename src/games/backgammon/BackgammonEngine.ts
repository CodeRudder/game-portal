import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BOARD_MARGIN_X, BOARD_MARGIN_TOP, BAR_WIDTH, BORDER_WIDTH,
  POINT_WIDTH, POINT_HEIGHT, CHECKER_RADIUS, POINT_COUNT,
  CHECKERS_PER_PLAYER,
  BG_COLOR, BOARD_COLOR, BOARD_BORDER_COLOR, BAR_COLOR,
  POINT_LIGHT_COLOR, POINT_DARK_COLOR,
  WHITE_CHECKER_COLOR, WHITE_CHECKER_BORDER,
  BLACK_CHECKER_COLOR, BLACK_CHECKER_BORDER,
  SELECTED_COLOR, VALID_TARGET_COLOR,
  DICE_BG_COLOR, DICE_DOT_COLOR, HUD_TEXT_COLOR,
  BEAR_OFF_ZONE_COLOR, HIGHLIGHT_COLOR,
  PLAYER_WHITE, PLAYER_BLACK,
  WHITE_DIRECTION, BLACK_DIRECTION,
  WHITE_HOME_RANGE, BLACK_HOME_RANGE,
  AI_THINK_TIME,
  GamePhase,
  INITIAL_BOARD,
} from './constants';

/** 骰子结果 */
interface DiceState {
  values: number[];
  remaining: number[]; // 剩余可用骰子值
}

/** 移动信息 */
interface MoveInfo {
  from: number;   // 起始点 (1-24, 0=bar, 25=bear-off)
  to: number;     // 目标点 (1-24, 25=bear-off)
  die: number;    // 使用的骰子值
}

export class BackgammonEngine extends GameEngine {
  // 棋盘: points[1..24], 正数=白子数, 负数=黑子数
  private _points: number[] = [];
  // 白方 bar 上的棋子数
  private _whiteBar: number = 0;
  // 黑方 bar 上的棋子数
  private _blackBar: number = 0;
  // 白方已归巢棋子数
  private _whiteBorneOff: number = 0;
  // 黑方已归巢棋子数
  private _blackBorneOff: number = 0;
  // 当前玩家
  private _currentPlayer: number = PLAYER_WHITE;
  // 骰子状态
  private _dice: DiceState = { values: [], remaining: [] };
  // 游戏阶段
  private _phase: GamePhase = GamePhase.ROLL_DICE;
  // 选中的起点 (1-24, 0=bar)
  private _selectedFrom: number = -1;
  // 当前可用的目标点
  private _validTargets: number[] = [];
  // 光标位置 (用于键盘导航)
  private _cursor: number = 1;
  // 胜者
  private _winner: number | null = null;
  // 是否赢了
  private _isWin: boolean = false;
  // AI 是否启用
  private _aiEnabled: boolean = true;
  // AI 是否在思考
  private _aiThinking: boolean = false;
  // AI 定时器
  private _aiTimer: ReturnType<typeof setTimeout> | null = null;
  // 消息提示
  private _message: string = '';
  // 移动历史（用于撤销）
  private _moveHistory: Array<{
    points: number[];
    whiteBar: number;
    blackBar: number;
    whiteBorneOff: number;
    blackBorneOff: number;
  }> = [];

  // ========== Getters ==========

  get points(): number[] { return [...this._points]; }
  get whiteBar(): number { return this._whiteBar; }
  get blackBar(): number { return this._blackBar; }
  get whiteBorneOff(): number { return this._whiteBorneOff; }
  get blackBorneOff(): number { return this._blackBorneOff; }
  get currentPlayer(): number { return this._currentPlayer; }
  get dice(): DiceState { return { ...this._dice }; }
  get phase(): GamePhase { return this._phase; }
  get selectedFrom(): number { return this._selectedFrom; }
  get validTargets(): number[] { return [...this._validTargets]; }
  get cursor(): number { return this._cursor; }
  get winner(): number | null { return this._winner; }
  get isWin(): boolean { return this._isWin; }
  get aiEnabled(): boolean { return this._aiEnabled; }
  get aiThinking(): boolean { return this._aiThinking; }
  get message(): string { return this._message; }

  // ========== Lifecycle ==========

  protected onInit(): void {
    this.resetBoard();
  }

  protected onStart(): void {
    this.resetBoard();
    this._phase = GamePhase.ROLL_DICE;
    this._currentPlayer = PLAYER_WHITE;
    this._message = '按 D 或空格掷骰子';
  }

  protected update(_deltaTime: number): void {
    // 回合制游戏，不需要持续更新
  }

  protected onReset(): void {
    if (this._aiTimer) {
      clearTimeout(this._aiTimer);
      this._aiTimer = null;
    }
    this.resetBoard();
    this._phase = GamePhase.ROLL_DICE;
    this._currentPlayer = PLAYER_WHITE;
    this._message = '';
  }

  protected onDestroy(): void {
    if (this._aiTimer) {
      clearTimeout(this._aiTimer);
      this._aiTimer = null;
    }
  }

  protected onGameOver(): void {
    this._phase = GamePhase.GAME_OVER;
    if (this._winner === PLAYER_WHITE) {
      this._message = '🎉 白方获胜！';
    } else {
      this._message = '💀 黑方获胜！';
    }
  }

  // ========== 棋盘初始化 ==========

  private resetBoard(): void {
    this._points = [...INITIAL_BOARD]; // 复制初始布局
    this._whiteBar = 0;
    this._blackBar = 0;
    this._whiteBorneOff = 0;
    this._blackBorneOff = 0;
    this._dice = { values: [], remaining: [] };
    this._selectedFrom = -1;
    this._validTargets = [];
    this._cursor = 1;
    this._winner = null;
    this._isWin = false;
    this._aiThinking = false;
    this._moveHistory = [];
    this._message = '';
  }

  // ========== 掷骰子 ==========

  rollDice(): void {
    if (this._phase !== GamePhase.ROLL_DICE) return;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    this._dice.values = [d1, d2];

    if (d1 === d2) {
      // 双骰：可走 4 次
      this._dice.remaining = [d1, d1, d1, d1];
    } else {
      this._dice.remaining = [d1, d2];
    }

    // 检查是否有合法移动
    const moves = this.getAllValidMoves(this._currentPlayer, this._dice.remaining);
    if (moves.length === 0) {
      this._message = `${this._currentPlayer === PLAYER_WHITE ? '白方' : '黑方'}无法移动，跳过回合`;
      this.endTurn();
      return;
    }

    this._phase = GamePhase.SELECT_CHECKER;
    this._selectedFrom = -1;
    this._validTargets = [];
    this._message = '选择要移动的棋子';

    // 如果是 AI 回合
    if (this._currentPlayer === PLAYER_BLACK && this._aiEnabled) {
      this.startAITurn();
    }
  }

  // ========== 移动逻辑 ==========

  /** 获取某个点上的棋子数量（正数） */
  private getCheckerCount(point: number): number {
    return Math.abs(this._points[point]);
  }

  /** 获取某个点上的棋子所属玩家 */
  private getCheckerOwner(point: number): number {
    if (this._points[point] > 0) return PLAYER_WHITE;
    if (this._points[point] < 0) return PLAYER_BLACK;
    return 0;
  }

  /** 计算目标点编号 */
  private getTargetPoint(from: number, die: number, player: number): number {
    if (player === PLAYER_WHITE) {
      return from - die; // 白方向低号移动
    } else {
      return from + die; // 黑方向高号移动
    }
  }

  /** 检查目标点是否可以落子 */
  private canLandOn(point: number, player: number): boolean {
    if (point < 1 || point > 24) return false;
    const owner = this.getCheckerOwner(point);
    if (owner === 0 || owner === player) return true;
    // 对方只有 1 子（落单），可以打
    return this.getCheckerCount(point) === 1;
  }

  /** 检查某方所有棋子是否都在内盘 */
  isAllInHome(player: number): boolean {
    if (player === PLAYER_WHITE) {
      if (this._whiteBar > 0) return false;
      for (let i = 7; i <= 24; i++) {
        if (this._points[i] > 0) return false;
      }
      return true;
    } else {
      if (this._blackBar > 0) return false;
      for (let i = 1; i <= 18; i++) {
        if (this._points[i] < 0) return false;
      }
      return true;
    }
  }

  /** 检查是否可以归巢（bearing off） */
  private canBearOff(from: number, die: number, player: number): boolean {
    if (!this.isAllInHome(player)) return false;

    if (player === PLAYER_WHITE) {
      const target = from - die;
      if (target === 0) return true; // 精确归巢
      if (target < 0) {
        // 只有当 from 是内盘中最远的点时才允许超额归巢
        for (let i = from + 1; i <= 6; i++) {
          if (this._points[i] > 0) return false;
        }
        return true;
      }
      return false;
    } else {
      const target = from + die;
      if (target === 25) return true; // 精确归巢
      if (target > 25) {
        // 只有当 from 是内盘中最远的点时才允许超额归巢
        for (let i = from - 1; i >= 19; i--) {
          if (this._points[i] < 0) return false;
        }
        return true;
      }
      return false;
    }
  }

  /** 获取某个棋子的所有合法目标 */
  getValidMovesForChecker(from: number, player: number, remaining: number[]): number[] {
    const targets: number[] = [];
    const usedDice = new Set<number>();

    for (const die of remaining) {
      if (usedDice.has(die)) continue;
      usedDice.add(die);

      const target = this.getTargetPoint(from, die, player);

      // 归巢
      if (player === PLAYER_WHITE && target <= 0) {
        if (this.canBearOff(from, die, player)) {
          targets.push(25); // 25 表示归巢
        }
        continue;
      }
      if (player === PLAYER_BLACK && target >= 25) {
        if (this.canBearOff(from, die, player)) {
          targets.push(25);
        }
        continue;
      }

      // 普通移动
      if (target >= 1 && target <= 24 && this.canLandOn(target, player)) {
        targets.push(target);
      }
    }

    return targets;
  }

  /** 获取 bar 上棋子的合法目标 */
  private getBarMoves(player: number, remaining: number[]): number[] {
    const targets: number[] = [];
    const usedDice = new Set<number>();

    for (const die of remaining) {
      if (usedDice.has(die)) continue;
      usedDice.add(die);

      let target: number;
      if (player === PLAYER_WHITE) {
        target = 25 - die; // 白方从 point 25-die 进入
      } else {
        target = die; // 黑方从 point die 进入
      }

      if (target >= 1 && target <= 24 && this.canLandOn(target, player)) {
        targets.push(target);
      }
    }

    return targets;
  }

  /** 获取所有合法移动 */
  getAllValidMoves(player: number, remaining: number[]): MoveInfo[] {
    const moves: MoveInfo[] = [];

    // 如果 bar 上有棋子，必须先进入
    const barCount = player === PLAYER_WHITE ? this._whiteBar : this._blackBar;
    if (barCount > 0) {
      const targets = this.getBarMoves(player, remaining);
      for (const target of targets) {
        const die = this.getDieForMove(0, target, player, remaining);
        if (die !== null) {
          moves.push({ from: 0, to: target, die });
        }
      }
      return moves;
    }

    // 普通移动
    for (let i = 1; i <= 24; i++) {
      if (this.getCheckerOwner(i) !== player) continue;
      const targets = this.getValidMovesForChecker(i, player, remaining);
      for (const target of targets) {
        const die = this.getDieForMove(i, target, player, remaining);
        if (die !== null) {
          moves.push({ from: i, to: target, die });
        }
      }
    }

    return moves;
  }

  /** 计算某步移动需要用哪个骰子 */
  private getDieForMove(from: number, to: number, player: number, remaining: number[]): number | null {
    if (to === 25) {
      // 归巢
      if (from === 0) return null;
      if (player === PLAYER_WHITE) {
        const exactDie = from; // from - 0 = from
        if (remaining.includes(exactDie)) return exactDie;
        // 超额归巢：找大于 from 的最小骰子
        const sorted = [...remaining].sort((a, b) => a - b);
        for (const d of sorted) {
          if (d > from) return d;
        }
        return null;
      } else {
        const exactDie = 25 - from;
        if (remaining.includes(exactDie)) return exactDie;
        const sorted = [...remaining].sort((a, b) => a - b);
        for (const d of sorted) {
          if (d > 25 - from) return d;
        }
        return null;
      }
    }

    if (from === 0) {
      // 从 bar 进入
      let die: number;
      if (player === PLAYER_WHITE) {
        die = 25 - to;
      } else {
        die = to;
      }
      return remaining.includes(die) ? die : null;
    }

    // 普通移动
    const die = player === PLAYER_WHITE ? from - to : to - from;
    return remaining.includes(die) ? die : null;
  }

  /** 执行移动 */
  makeMove(from: number, to: number): boolean {
    const player = this._currentPlayer;
    const remaining = this._dice.remaining;
    const die = this.getDieForMove(from, to, player, remaining);
    if (die === null) return false;

    // 保存移动前状态
    this._moveHistory.push({
      points: [...this._points],
      whiteBar: this._whiteBar,
      blackBar: this._blackBar,
      whiteBorneOff: this._whiteBorneOff,
      blackBorneOff: this._blackBorneOff,
    });

    // 从起点移除棋子
    if (from === 0) {
      // 从 bar 移动
      if (player === PLAYER_WHITE) {
        this._whiteBar--;
      } else {
        this._blackBar--;
      }
    } else {
      if (player === PLAYER_WHITE) {
        this._points[from]--;
      } else {
        this._points[from]++;
      }
    }

    // 在目标点放置棋子
    if (to === 25) {
      // 归巢
      if (player === PLAYER_WHITE) {
        this._whiteBorneOff++;
      } else {
        this._blackBorneOff++;
      }
    } else {
      // 检查是否打子
      const targetOwner = this.getCheckerOwner(to);
      if (targetOwner !== 0 && targetOwner !== player) {
        // 打子！对方棋子被送到 bar
        if (targetOwner === PLAYER_WHITE) {
          this._points[to] = 0;
          this._whiteBar++;
        } else {
          this._points[to] = 0;
          this._blackBar++;
        }
      }
      // 放置棋子
      if (player === PLAYER_WHITE) {
        this._points[to]++;
      } else {
        this._points[to]--;
      }
    }

    // 消耗骰子
    const dieIndex = this._dice.remaining.indexOf(die);
    if (dieIndex !== -1) {
      this._dice.remaining.splice(dieIndex, 1);
    }

    this._selectedFrom = -1;
    this._validTargets = [];

    // 加分
    this.addScore(die * 10);
    if (to === 25) this.addScore(50); // 归巢奖励

    // 检查胜利
    if (this.checkWin(player)) {
      this._winner = player;
      this._isWin = player === PLAYER_WHITE;
      this.gameOver();
      return true;
    }

    // 检查是否还有剩余骰子
    if (this._dice.remaining.length === 0) {
      this.endTurn();
    } else {
      // 检查剩余移动
      const moves = this.getAllValidMoves(player, this._dice.remaining);
      if (moves.length === 0) {
        this._message = '没有更多合法移动';
        this.endTurn();
      } else {
        this._phase = GamePhase.SELECT_CHECKER;
        this._message = `剩余骰子: ${this._dice.remaining.join(', ')}`;
        // AI 继续移动
        if (this._currentPlayer === PLAYER_BLACK && this._aiEnabled) {
          this.startAITurn();
        }
      }
    }

    return true;
  }

  /** 选择起点 */
  selectFrom(from: number): boolean {
    const player = this._currentPlayer;
    const remaining = this._dice.remaining;

    // 检查 bar
    const barCount = player === PLAYER_WHITE ? this._whiteBar : this._blackBar;
    if (barCount > 0 && from !== 0) {
      this._message = '必须先将 bar 上的棋子移回棋盘';
      return false;
    }

    // 检查是否有棋子
    if (from !== 0 && this.getCheckerOwner(from) !== player) {
      return false;
    }

    // 获取合法目标
    let targets: number[];
    if (from === 0) {
      targets = this.getBarMoves(player, remaining);
    } else {
      targets = this.getValidMovesForChecker(from, player, remaining);
    }

    if (targets.length === 0) {
      this._message = '该棋子没有合法移动';
      return false;
    }

    this._selectedFrom = from;
    this._validTargets = targets;
    this._phase = GamePhase.SELECT_TARGET;
    this._message = '选择目标位置';
    return true;
  }

  /** 选择目标点 */
  selectTo(to: number): boolean {
    if (this._selectedFrom === -1) return false;
    if (!this._validTargets.includes(to)) return false;
    return this.makeMove(this._selectedFrom, to);
  }

  /** 结束回合 */
  private endTurn(): void {
    this._dice = { values: [], remaining: [] };
    this._selectedFrom = -1;
    this._validTargets = [];

    // 切换玩家
    this._currentPlayer = this._currentPlayer === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;
    this._phase = GamePhase.ROLL_DICE;
    this._message = `${this._currentPlayer === PLAYER_WHITE ? '白方' : '黑方'}回合 — 按空格/D掷骰子`;

    // AI 回合
    if (this._currentPlayer === PLAYER_BLACK && this._aiEnabled && this._phase !== GamePhase.GAME_OVER) {
      this.startAITurn();
    }
  }

  /** 检查胜利 */
  private checkWin(player: number): boolean {
    if (player === PLAYER_WHITE) {
      return this._whiteBorneOff >= CHECKERS_PER_PLAYER;
    } else {
      return this._blackBorneOff >= CHECKERS_PER_PLAYER;
    }
  }

  // ========== AI ==========

  private startAITurn(): void {
    this._phase = GamePhase.AI_TURN;
    this._aiThinking = true;
    this._message = 'AI 思考中...';

    this._aiTimer = setTimeout(() => {
      this.aiRollAndMove();
    }, AI_THINK_TIME);
  }

  private aiRollAndMove(): void {
    if (this._phase === GamePhase.GAME_OVER) return;

    // 掷骰子
    this.rollDice();
    if (this._phase === GamePhase.ROLL_DICE) {
      // 无法移动，已跳过
      this._aiThinking = false;
      return;
    }

    this.aiMakeNextMove();
  }

  private aiMakeNextMove(): void {
    if (this._phase === GamePhase.GAME_OVER) {
      this._aiThinking = false;
      return;
    }

    if (this._dice.remaining.length === 0) {
      this._aiThinking = false;
      return;
    }

    const moves = this.getAllValidMoves(this._currentPlayer, this._dice.remaining);
    if (moves.length === 0) {
      this._aiThinking = false;
      this.endTurn();
      return;
    }

    // 简单 AI 策略：优先打子 > 归巢 > 前进最多
    const move = this.aiChooseMove(moves);
    this.makeMove(move.from, move.to);

    if (this._phase !== GamePhase.GAME_OVER && this._dice.remaining.length > 0 && this._currentPlayer === PLAYER_BLACK) {
      this._aiTimer = setTimeout(() => {
        this.aiMakeNextMove();
      }, 300);
    } else {
      this._aiThinking = false;
    }
  }

  private aiChooseMove(moves: MoveInfo[]): MoveInfo {
    // 优先级：归巢 > 打子 > 前进距离最大
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      let score = 0;

      // 归巢加分
      if (move.to === 25) score += 100;

      // 打子加分
      if (move.to >= 1 && move.to <= 24) {
        const targetOwner = this.getCheckerOwner(move.to);
        if (targetOwner === PLAYER_WHITE && this.getCheckerCount(move.to) === 1) {
          score += 50;
        }
      }

      // 前进距离加分（黑方向高号移动）
      if (move.from === 0) {
        score += move.to * 2; // 从 bar 进入越远越好
      } else if (move.to === 25) {
        score += 80;
      } else {
        score += (move.to - move.from) * 2;
      }

      // 避免留 blots（落单棋子）
      if (move.to >= 1 && move.to <= 24) {
        const countAfter = Math.abs(this._points[move.to]) + (this.getCheckerOwner(move.to) === PLAYER_BLACK ? 0 : 0);
        if (countAfter === 0) {
          // 将在新位置只有 1 个棋子
          score -= 20;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  // ========== 键盘控制 ==========

  handleKeyDown(key: string): void {
    if (this._phase === GamePhase.GAME_OVER) return;

    switch (key) {
      case ' ':
      case 'd':
      case 'D':
        this.handleAction();
        break;
      case 'ArrowLeft':
        this.moveCursor(-1);
        break;
      case 'ArrowRight':
        this.moveCursor(1);
        break;
      case 'ArrowUp':
        this.moveCursor(-6);
        break;
      case 'ArrowDown':
        this.moveCursor(6);
        break;
      case 'Escape':
        this.cancelSelection();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 无需处理
  }

  private handleAction(): void {
    if (this._phase === GamePhase.ROLL_DICE) {
      if (this._currentPlayer === PLAYER_WHITE || !this._aiEnabled) {
        this.rollDice();
      }
    } else if (this._phase === GamePhase.SELECT_CHECKER) {
      if (this._currentPlayer === PLAYER_WHITE || !this._aiEnabled) {
        // 如果 bar 上有棋子，自动选择 bar
        const barCount = this._currentPlayer === PLAYER_WHITE ? this._whiteBar : this._blackBar;
        if (barCount > 0) {
          this.selectFrom(0);
        } else {
          this.selectFrom(this._cursor);
        }
      }
    } else if (this._phase === GamePhase.SELECT_TARGET) {
      if (this._currentPlayer === PLAYER_WHITE || !this._aiEnabled) {
        this.selectTo(this._cursor);
      }
    }
  }

  private moveCursor(delta: number): void {
    if (this._phase !== GamePhase.SELECT_CHECKER && this._phase !== GamePhase.SELECT_TARGET) return;

    let newCursor = this._cursor + delta;
    if (newCursor < 1) newCursor = 1;
    if (newCursor > 24) newCursor = 24;
    this._cursor = newCursor;
  }

  private cancelSelection(): void {
    if (this._phase === GamePhase.SELECT_TARGET) {
      this._phase = GamePhase.SELECT_CHECKER;
      this._selectedFrom = -1;
      this._validTargets = [];
      this._message = '选择要移动的棋子';
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    this.drawBoard(ctx, w, h);
    this.drawPoints(ctx);
    this.drawCheckers(ctx);
    this.drawBar(ctx, w, h);
    this.drawBearOffZones(ctx, w, h);
    this.drawDice(ctx, w, h);
    this.drawHUD(ctx, w, h);
    this.drawHighlights(ctx);
  }

  private drawBoard(ctx: CanvasRenderingContext2D, _w: number, _h: number): void {
    const boardX = BOARD_MARGIN_X;
    const boardY = BOARD_MARGIN_TOP;
    const boardW = CANVAS_WIDTH - 2 * BOARD_MARGIN_X;
    const boardH = CANVAS_HEIGHT - BOARD_MARGIN_TOP - 40;

    // 棋盘背景
    ctx.fillStyle = BOARD_COLOR;
    ctx.fillRect(boardX, boardY, boardW, boardH);

    // 边框
    ctx.strokeStyle = BOARD_BORDER_COLOR;
    ctx.lineWidth = BORDER_WIDTH;
    ctx.strokeRect(boardX, boardY, boardW, boardH);

    // 中间 bar
    const barX = CANVAS_WIDTH / 2 - BAR_WIDTH / 2;
    ctx.fillStyle = BAR_COLOR;
    ctx.fillRect(barX, boardY, BAR_WIDTH, boardH);
  }

  private drawPoints(ctx: CanvasRenderingContext2D): void {
    const boardY = BOARD_MARGIN_TOP;
    const midY = boardY + (CANVAS_HEIGHT - BOARD_MARGIN_TOP - 40) / 2;

    for (let i = 0; i < 24; i++) {
      const pointNum = i + 1;
      const { x, isTop } = this.getPointPosition(pointNum);

      ctx.fillStyle = i % 2 === 0 ? POINT_LIGHT_COLOR : POINT_DARK_COLOR;
      ctx.beginPath();

      if (isTop) {
        ctx.moveTo(x, boardY);
        ctx.lineTo(x + POINT_WIDTH, boardY);
        ctx.lineTo(x + POINT_WIDTH / 2, boardY + POINT_HEIGHT);
      } else {
        ctx.moveTo(x + POINT_WIDTH / 2, midY);
        ctx.lineTo(x, CANVAS_HEIGHT - 40);
        ctx.lineTo(x + POINT_WIDTH, CANVAS_HEIGHT - 40);
      }

      ctx.closePath();
      ctx.fill();

      // 点号标注
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      if (isTop) {
        ctx.fillText(String(pointNum), x + POINT_WIDTH / 2, boardY + POINT_HEIGHT + 12);
      } else {
        ctx.fillText(String(pointNum), x + POINT_WIDTH / 2, CANVAS_HEIGHT - 42);
      }
    }
  }

  private getPointPosition(pointNum: number): { x: number; isTop: boolean } {
    let col: number;
    let isTop: boolean;

    if (pointNum >= 13 && pointNum <= 18) {
      // 上排左（13-18）
      col = pointNum - 13;
      isTop = true;
    } else if (pointNum >= 19 && pointNum <= 24) {
      // 上排右（19-24）
      col = pointNum - 19 + 6;
      isTop = true;
    } else if (pointNum >= 7 && pointNum <= 12) {
      // 下排左（7-12）
      col = 12 - pointNum;
      isTop = false;
    } else {
      // 下排右（1-6）
      col = 6 - pointNum + 6;
      isTop = false;
    }

    const x = BOARD_MARGIN_X + col * POINT_WIDTH + (col >= 6 ? BAR_WIDTH : 0);
    return { x, isTop };
  }

  private drawCheckers(ctx: CanvasRenderingContext2D): void {
    for (let i = 1; i <= 24; i++) {
      const count = this.getCheckerCount(i);
      if (count === 0) continue;

      const owner = this.getCheckerOwner(i);
      const { x, isTop } = this.getPointPosition(i);

      const maxShow = Math.min(count, 5);
      for (let j = 0; j < maxShow; j++) {
        const cx = x + POINT_WIDTH / 2;
        let cy: number;
        if (isTop) {
          cy = BOARD_MARGIN_TOP + CHECKER_RADIUS + 2 + j * (CHECKER_RADIUS * 2 + 1);
        } else {
          cy = CANVAS_HEIGHT - 40 - CHECKER_RADIUS - 2 - j * (CHECKER_RADIUS * 2 + 1);
        }

        this.drawChecker(ctx, cx, cy, owner);
      }

      // 如果超过 5 个，显示数字
      if (count > 5) {
        const cx = x + POINT_WIDTH / 2;
        let cy: number;
        if (isTop) {
          cy = BOARD_MARGIN_TOP + CHECKER_RADIUS + 2 + 4 * (CHECKER_RADIUS * 2 + 1);
        } else {
          cy = CANVAS_HEIGHT - 40 - CHECKER_RADIUS - 2 - 4 * (CHECKER_RADIUS * 2 + 1);
        }
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(count), cx, cy);
      }
    }
  }

  private drawChecker(ctx: CanvasRenderingContext2D, cx: number, cy: number, player: number): void {
    ctx.beginPath();
    ctx.arc(cx, cy, CHECKER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = player === PLAYER_WHITE ? WHITE_CHECKER_COLOR : BLACK_CHECKER_COLOR;
    ctx.fill();
    ctx.strokeStyle = player === PLAYER_WHITE ? WHITE_CHECKER_BORDER : BLACK_CHECKER_BORDER;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 内圈装饰
    ctx.beginPath();
    ctx.arc(cx, cy, CHECKER_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = player === PLAYER_WHITE ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawBar(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    const barX = w / 2 - BAR_WIDTH / 2;
    const midY = BOARD_MARGIN_TOP + (CANVAS_HEIGHT - BOARD_MARGIN_TOP - 40) / 2;

    // 白方 bar 棋子（下半部分）
    for (let i = 0; i < this._whiteBar; i++) {
      const cx = barX + BAR_WIDTH / 2;
      const cy = midY + CHECKER_RADIUS + 5 + i * (CHECKER_RADIUS * 2 + 2);
      this.drawChecker(ctx!, cx, cy, PLAYER_WHITE);
    }

    // 黑方 bar 棋子（上半部分）
    for (let i = 0; i < this._blackBar; i++) {
      const cx = barX + BAR_WIDTH / 2;
      const cy = midY - CHECKER_RADIUS - 5 - i * (CHECKER_RADIUS * 2 + 2);
      this.drawChecker(ctx!, cx, cy, PLAYER_BLACK);
    }

    // Bar 数量标注
    if (this._whiteBar > 0) {
      ctx!.fillStyle = HUD_TEXT_COLOR;
      ctx!.font = 'bold 12px monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText(`W:${this._whiteBar}`, barX + BAR_WIDTH / 2, CANVAS_HEIGHT - 20);
    }
    if (this._blackBar > 0) {
      ctx!.fillStyle = HUD_TEXT_COLOR;
      ctx!.font = 'bold 12px monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText(`B:${this._blackBar}`, barX + BAR_WIDTH / 2, BOARD_MARGIN_TOP - 5);
    }
  }

  private drawBearOffZones(ctx: CanvasRenderingContext2D, _w: number, _h: number): void {
    const zoneW = 30;
    const zoneH = 60;
    const midY = BOARD_MARGIN_TOP + (CANVAS_HEIGHT - BOARD_MARGIN_TOP - 40) / 2;

    // 白方归巢区（右侧中间偏下）
    const whiteX = CANVAS_WIDTH - BOARD_MARGIN_X - zoneW;
    const whiteY = midY + 5;
    ctx.fillStyle = BEAR_OFF_ZONE_COLOR;
    ctx.fillRect(whiteX, whiteY, zoneW, zoneH);
    ctx.strokeStyle = BOARD_BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(whiteX, whiteY, zoneW, zoneH);
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`W:${this._whiteBorneOff}`, whiteX + zoneW / 2, whiteY + zoneH / 2 + 4);

    // 黑方归巢区（右侧中间偏上）
    const blackY = midY - zoneH - 5;
    ctx.fillStyle = BEAR_OFF_ZONE_COLOR;
    ctx.fillRect(whiteX, blackY, zoneW, zoneH);
    ctx.strokeStyle = BOARD_BORDER_COLOR;
    ctx.strokeRect(whiteX, blackY, zoneW, zoneH);
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.fillText(`B:${this._blackBorneOff}`, whiteX + zoneW / 2, blackY + zoneH / 2 + 4);
  }

  private drawDice(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this._dice.values.length === 0) return;

    const diceSize = 32;
    const gap = 10;
    const totalW = diceSize * 2 + gap;
    const startX = (w - totalW) / 2;
    const diceY = h - 35;

    for (let i = 0; i < 2; i++) {
      const dx = startX + i * (diceSize + gap);
      const used = i < this._dice.values.length - this._dice.remaining.length ||
        !this._dice.remaining.includes(this._dice.values[i]);

      // 骰子背景
      ctx.fillStyle = used ? 'rgba(255,248,231,0.4)' : DICE_BG_COLOR;
      ctx.beginPath();
      ctx.roundRect(dx, diceY, diceSize, diceSize, 5);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 骰子点数
      if (!used || i < this._dice.values.length) {
        this.drawDiceDots(ctx, dx, diceY, diceSize, this._dice.values[i]);
      }
    }

    // 显示剩余骰子
    if (this._dice.remaining.length > 0) {
      ctx.fillStyle = HUD_TEXT_COLOR;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`剩余: [${this._dice.remaining.join(',')}]`, w / 2, diceY - 5);
    }
  }

  private drawDiceDots(ctx: CanvasRenderingContext2D, dx: number, dy: number, size: number, value: number): void {
    const dotR = 3;
    const cx = dx + size / 2;
    const cy = dy + size / 2;
    const off = size * 0.28;

    ctx.fillStyle = DICE_DOT_COLOR;

    const positions: Record<number, Array<[number, number]>> = {
      1: [[cx, cy]],
      2: [[cx - off, cy - off], [cx + off, cy + off]],
      3: [[cx - off, cy - off], [cx, cy], [cx + off, cy + off]],
      4: [[cx - off, cy - off], [cx + off, cy - off], [cx - off, cy + off], [cx + off, cy + off]],
      5: [[cx - off, cy - off], [cx + off, cy - off], [cx, cy], [cx - off, cy + off], [cx + off, cy + off]],
      6: [[cx - off, cy - off], [cx + off, cy - off], [cx - off, cy], [cx + off, cy], [cx - off, cy + off], [cx + off, cy + off]],
    };

    const dots = positions[value] || [];
    for (const [px, py] of dots) {
      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHUD(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    // 标题
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🎲 双陆棋 Backgammon', w / 2, 20);

    // 当前玩家
    ctx.font = '12px monospace';
    const playerText = this._currentPlayer === PLAYER_WHITE ? '⚪ 白方回合' : '⚫ 黑方回合';
    ctx.fillText(playerText, w / 2, 38);

    // 消息
    if (this._message) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '11px monospace';
      ctx.fillText(this._message, w / 2, CANVAS_HEIGHT - 8);
    }

    // 分数
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`分数: ${this._score}`, BOARD_MARGIN_X, CANVAS_HEIGHT - 8);
  }

  private drawHighlights(ctx: CanvasRenderingContext2D): void {
    // 高亮选中的棋子
    if (this._selectedFrom >= 1 && this._selectedFrom <= 24) {
      const { x, isTop } = this.getPointPosition(this._selectedFrom);
      ctx.fillStyle = SELECTED_COLOR;
      ctx.fillRect(x, isTop ? BOARD_MARGIN_TOP : CANVAS_HEIGHT - 40 - POINT_HEIGHT, POINT_WIDTH, POINT_HEIGHT);
    }

    // 高亮合法目标
    for (const target of this._validTargets) {
      if (target >= 1 && target <= 24) {
        const { x, isTop } = this.getPointPosition(target);
        ctx.fillStyle = VALID_TARGET_COLOR;
        ctx.fillRect(x, isTop ? BOARD_MARGIN_TOP : CANVAS_HEIGHT - 40 - POINT_HEIGHT, POINT_WIDTH, POINT_HEIGHT);
      } else if (target === 25) {
        // 归巢高亮
        const midY = BOARD_MARGIN_TOP + (CANVAS_HEIGHT - BOARD_MARGIN_TOP - 40) / 2;
        const zoneW = 30;
        const zoneH = 60;
        const zoneX = CANVAS_WIDTH - BOARD_MARGIN_X - zoneW;
        const zoneY = this._currentPlayer === PLAYER_WHITE ? midY + 5 : midY - zoneH - 5;
        ctx.fillStyle = VALID_TARGET_COLOR;
        ctx.fillRect(zoneX, zoneY, zoneW, zoneH);
      }
    }

    // 光标高亮
    if ((this._phase === GamePhase.SELECT_CHECKER || this._phase === GamePhase.SELECT_TARGET) && this._cursor >= 1 && this._cursor <= 24) {
      const { x, isTop } = this.getPointPosition(this._cursor);
      ctx.strokeStyle = HIGHLIGHT_COLOR.replace('0.3', '0.8');
      ctx.lineWidth = 2;
      ctx.strokeRect(x, isTop ? BOARD_MARGIN_TOP : CANVAS_HEIGHT - 40 - POINT_HEIGHT, POINT_WIDTH, POINT_HEIGHT);
    }
  }

  // ========== getState ==========

  getState(): Record<string, unknown> {
    return {
      points: this._points,
      whiteBar: this._whiteBar,
      blackBar: this._blackBar,
      whiteBorneOff: this._whiteBorneOff,
      blackBorneOff: this._blackBorneOff,
      currentPlayer: this._currentPlayer,
      dice: this._dice,
      phase: this._phase,
      selectedFrom: this._selectedFrom,
      validTargets: this._validTargets,
      cursor: this._cursor,
      winner: this._winner,
      isWin: this._isWin,
      score: this._score,
      level: this._level,
      message: this._message,
    };
  }
}
