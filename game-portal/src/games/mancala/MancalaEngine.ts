import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PITS_PER_SIDE, INITIAL_SEEDS, TOTAL_PITS,
  PLAYER_STORE, AI_STORE,
  PLAYER_PITS, AI_PITS,
  BG_COLOR, BOARD_COLOR, BOARD_BORDER_COLOR,
  PIT_COLOR, PIT_HOVER_COLOR, PIT_ACTIVE_COLOR,
  STORE_COLOR, STORE_PLAYER_COLOR, STORE_AI_COLOR,
  SEED_COLOR, SEED_SHADOW, TEXT_COLOR, TEXT_DIM_COLOR,
  HIGHLIGHT_COLOR, VALID_MOVE_COLOR,
  BOARD_MARGIN_X, BOARD_MARGIN_Y, BOARD_PADDING,
  STORE_WIDTH, PIT_WIDTH, PIT_HEIGHT, PIT_GAP, PIT_RADIUS,
  SEED_RADIUS, STORE_HEIGHT,
  AI_THINK_DELAY, AI_DIFFICULTY_MEDIUM,
  SEED_ANIM_DURATION, PIT_ANIM_DURATION,
  HUD_HEIGHT, FONT_FAMILY,
} from './constants';

// ========== 类型定义 ==========

/** 玩家标识 */
export type Player = 'player' | 'ai';

/** 播种动画状态 */
export interface SowAnimation {
  /** 当前正在放入种子的目标坑索引 */
  currentPit: number;
  /** 还需放入的种子数 */
  remaining: number;
  /** 起始坑 */
  fromPit: number;
  /** 已完成的动画步骤 */
  completedSteps: number[];
}

/** 游戏结果 */
export interface MancalaResult {
  winner: Player | 'draw';
  playerStore: number;
  aiStore: number;
}

// ========== MancalaEngine ==========

export class MancalaEngine extends GameEngine {
  // 棋盘状态：索引 0-5 玩家凹坑, 6 玩家仓库, 7-12 AI凹坑, 13 AI仓库
  private _board: number[] = [];

  // 当前回合
  private _currentPlayer: Player = 'player';

  // 是否正在播放播种动画
  private _animating: boolean = false;
  private _sowAnimation: SowAnimation | null = null;
  private _animTimer: number = 0;

  // AI 相关
  private _aiThinking: boolean = false;
  private _aiThinkTimer: number = 0;
  private _aiDifficulty: number = AI_DIFFICULTY_MEDIUM;

  // 玩家仓库分数（用于 _score 基类兼容）
  private _playerStore: number = 0;
  private _aiStoreScore: number = 0;

  // 游戏结果
  private _result: MancalaResult | null = null;

  // 上一步高亮
  private _lastMovePit: number = -1;
  private _lastCapturePits: number[] = [];

  // 有效走法
  private _validMoves: number[] = [];

  // 悬停凹坑
  private _hoverPit: number = -1;

  // 额外回合标志
  private _extraTurn: boolean = false;

  // 历史记录（用于撤销/回放）
  private _moveHistory: Array<{
    board: number[];
    player: Player;
  }> = [];

  // ========== Public Getters ==========

  get board(): number[] { return [...this._board]; }
  get currentPlayer(): Player { return this._currentPlayer; }
  get animating(): boolean { return this._animating; }
  get aiThinking(): boolean { return this._aiThinking; }
  get result(): MancalaResult | null { return this._result; }
  get playerStoreSeeds(): number { return this._board[PLAYER_STORE] ?? 0; }
  get aiStoreSeeds(): number { return this._board[AI_STORE] ?? 0; }
  get validMoves(): number[] { return [...this._validMoves]; }
  get hoverPit(): number { return this._hoverPit; }
  get extraTurn(): boolean { return this._extraTurn; }
  get moveHistory(): Array<{ board: number[]; player: Player }> { return [...this._moveHistory]; }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this.resetBoard();
  }

  protected onStart(): void {
    this.resetBoard();
    this._currentPlayer = 'player';
    this._result = null;
    this._animating = false;
    this._sowAnimation = null;
    this._aiThinking = false;
    this._aiThinkTimer = 0;
    this._lastMovePit = -1;
    this._lastCapturePits = [];
    this._extraTurn = false;
    this._hoverPit = -1;
    this._moveHistory = [];
    this.updateValidMoves();
  }

  protected update(deltaTime: number): void {
    // 播种动画更新
    if (this._animating && this._sowAnimation) {
      this._animTimer += deltaTime;
      if (this._animTimer >= SEED_ANIM_DURATION) {
        this._animTimer = 0;
        this.advanceSowAnimation();
      }
      return;
    }

    // AI 回合
    if (this._currentPlayer === 'ai' && !this._animating && this._status === 'playing') {
      if (!this._aiThinking) {
        this._aiThinking = true;
        this._aiThinkTimer = 0;
      } else {
        this._aiThinkTimer += deltaTime;
        if (this._aiThinkTimer >= AI_THINK_DELAY) {
          this._aiThinking = false;
          this.executeAIMove();
        }
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    this.renderBoard(ctx, w, h);
    this.renderHUD(ctx, w);
    this.renderGameOver(ctx, w, h);
  }

  protected onReset(): void {
    this.resetBoard();
    this._currentPlayer = 'player';
    this._result = null;
    this._animating = false;
    this._sowAnimation = null;
    this._aiThinking = false;
    this._aiThinkTimer = 0;
    this._lastMovePit = -1;
    this._lastCapturePits = [];
    this._extraTurn = false;
    this._hoverPit = -1;
    this._moveHistory = [];
    this._validMoves = [];
  }

  protected onGameOver(): void {
    this._result = this.calculateResult();
    this.emit('gameResult', this._result);
  }

  handleKeyDown(key: string): void {
    // 数字键 1-6 选择凹坑
    const pitIndex = parseInt(key, 10);
    if (pitIndex >= 1 && pitIndex <= 6) {
      this.selectPit(pitIndex - 1); // 转换为 0-5 索引
      return;
    }

    // 空格键：开始/重新开始
    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      }
    }
  }

  handleKeyUp(_key: string): void {
    // Mancala 不需要 keyUp 逻辑
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      board: this.board,
      currentPlayer: this._currentPlayer,
      playerStoreSeeds: this.playerStoreSeeds,
      aiStoreSeeds: this.aiStoreSeeds,
      animating: this._animating,
      aiThinking: this._aiThinking,
      result: this._result,
      validMoves: this._validMoves,
      hoverPit: this._hoverPit,
      extraTurn: this._extraTurn,
    };
  }

  // ========== 公共方法 ==========

  /** 选择凹坑（玩家操作） */
  selectPit(pitIndex: number): boolean {
    // 校验状态
    if (this._status !== 'playing') return false;
    if (this._currentPlayer !== 'player') return false;
    if (this._animating) return false;
    if (!PLAYER_PITS.includes(pitIndex as any)) return false;
    if (this._board[pitIndex] === 0) return false;

    this.executeMove(pitIndex);
    return true;
  }

  /** 设置 AI 难度 */
  setAIDifficulty(difficulty: number): void {
    this._aiDifficulty = Math.max(0, Math.min(1, difficulty));
  }

  /** 设置悬停凹坑 */
  setHoverPit(pitIndex: number): void {
    this._hoverPit = pitIndex;
  }

  /** 获取对面坑索引 */
  getOppositePit(pitIndex: number): number {
    // 玩家坑 0-5 对面是 AI 坑 12-7
    if (pitIndex >= 0 && pitIndex <= 5) {
      return 12 - pitIndex;
    }
    // AI 坑 7-12 对面是玩家坑 5-0
    if (pitIndex >= 7 && pitIndex <= 12) {
      return 12 - pitIndex;
    }
    return -1; // 仓库没有对面
  }

  /** 获取坑中的种子数 */
  getSeeds(pitIndex: number): number {
    return this._board[pitIndex] ?? 0;
  }

  /** 获取一方所有坑的种子总数（不含仓库） */
  getSideTotal(player: Player): number {
    const pits = player === 'player' ? PLAYER_PITS : AI_PITS;
    return pits.reduce<number>((sum, i) => sum + this._board[i], 0);
  }

  // ========== 核心游戏逻辑 ==========

  /** 重置棋盘 */
  private resetBoard(): void {
    this._board = new Array(TOTAL_PITS).fill(INITIAL_SEEDS);
    this._board[PLAYER_STORE] = 0;
    this._board[AI_STORE] = 0;
    this._playerStore = 0;
    this._aiStoreScore = 0;
  }

  /** 更新有效走法列表 */
  private updateValidMoves(): void {
    const pits = this._currentPlayer === 'player' ? PLAYER_PITS : AI_PITS;
    this._validMoves = pits.filter(i => this._board[i] > 0);
  }

  /** 执行一次走子（含动画启动） */
  private executeMove(pitIndex: number): void {
    // 保存历史
    this._moveHistory.push({
      board: [...this._board],
      player: this._currentPlayer,
    });

    const seeds = this._board[pitIndex];
    this._board[pitIndex] = 0;
    this._lastMovePit = pitIndex;
    this._lastCapturePits = [];
    this._extraTurn = false;

    // 启动播种动画
    this._animating = true;
    this._sowAnimation = {
      currentPit: pitIndex,
      remaining: seeds,
      fromPit: pitIndex,
      completedSteps: [],
    };
    this._animTimer = 0;
  }

  /** 推进播种动画一步 */
  private advanceSowAnimation(): void {
    if (!this._sowAnimation) return;

    const anim = this._sowAnimation;
    anim.remaining--;

    // 找到下一个坑（跳过对方仓库）
    const nextPit = this.getNextPit(anim.currentPit, this._currentPlayer);
    anim.currentPit = nextPit;
    anim.completedSteps.push(nextPit);

    // 放一颗种子
    this._board[nextPit]++;

    // 检查是否还有种子
    if (anim.remaining <= 0) {
      this._animating = false;
      this._sowAnimation = null;
      this.handleLanding(nextPit);
    }
  }

  /** 获取下一个坑索引（逆时针，跳过对方仓库） */
  private getNextPit(current: number, player: Player): number {
    let next = (current + 1) % TOTAL_PITS;

    // 跳过对方仓库
    if (player === 'player' && next === AI_STORE) {
      next = (next + 1) % TOTAL_PITS;
    } else if (player === 'ai' && next === PLAYER_STORE) {
      next = (next + 1) % TOTAL_PITS;
    }

    return next;
  }

  /** 处理最后一颗种子落地 */
  private handleLanding(landPit: number): void {
    const isPlayer = this._currentPlayer === 'player';
    const ownStore = isPlayer ? PLAYER_STORE : AI_STORE;
    const ownPits = isPlayer ? PLAYER_PITS : AI_PITS;

    // 1. 落在自己仓库 → 额外回合
    if (landPit === ownStore) {
      this._extraTurn = true;
      this.emit('extraTurn', this._currentPlayer);
      // 不切换玩家，检查游戏是否结束
      if (!this.checkGameEnd()) {
        this.updateValidMoves();
        // 如果当前玩家没有可用走法，切换
        if (this._validMoves.length === 0) {
          this.switchPlayer();
        }
      }
      return;
    }

    // 2. 落在自己空坑 → 吃子（对面坑 + 自己这颗种子收入仓库）
    if ((ownPits as readonly number[]).includes(landPit) && this._board[landPit] === 1) {
      const oppositePit = this.getOppositePit(landPit);
      const capturedSeeds = this._board[oppositePit];

      if (capturedSeeds > 0) {
        this._lastCapturePits = [landPit, oppositePit];
        this._board[oppositePit] = 0;
        this._board[landPit] = 0;
        this._board[ownStore] += capturedSeeds + 1; // 对面种子 + 自己的1颗
        this.emit('capture', {
          player: this._currentPlayer,
          pit: landPit,
          oppositePit,
          seeds: capturedSeeds + 1,
        });
      }
    }

    // 3. 切换玩家
    this._extraTurn = false;
    if (!this.checkGameEnd()) {
      this.switchPlayer();
    }
  }

  /** 切换当前玩家 */
  private switchPlayer(): void {
    this._currentPlayer = this._currentPlayer === 'player' ? 'ai' : 'player';
    this.updateValidMoves();
    this.emit('turnChange', this._currentPlayer);
  }

  /** 检查游戏是否结束 */
  private checkGameEnd(): boolean {
    const playerTotal = this.getSideTotal('player');
    const aiTotal = this.getSideTotal('ai');

    if (playerTotal === 0 || aiTotal === 0) {
      // 收集剩余种子到各自仓库
      this.collectRemainingSeeds();
      this.addScore(this._board[PLAYER_STORE]);
      this.gameOver();
      return true;
    }

    return false;
  }

  /** 收集所有剩余种子到仓库 */
  private collectRemainingSeeds(): void {
    for (const pit of PLAYER_PITS) {
      this._board[PLAYER_STORE] += this._board[pit];
      this._board[pit] = 0;
    }
    for (const pit of AI_PITS) {
      this._board[AI_STORE] += this._board[pit];
      this._board[pit] = 0;
    }
  }

  /** 计算游戏结果 */
  private calculateResult(): MancalaResult {
    const ps = this._board[PLAYER_STORE];
    const as = this._board[AI_STORE];
    let winner: Player | 'draw';
    if (ps > as) winner = 'player';
    else if (as > ps) winner = 'ai';
    else winner = 'draw';
    return { winner, playerStore: ps, aiStore: as };
  }

  // ========== AI 逻辑 ==========

  /** 执行 AI 走子 */
  private executeAIMove(): void {
    if (this._status !== 'playing') return;
    if (this._currentPlayer !== 'ai') return;

    const move = this.chooseAIMove();
    if (move === -1) return; // 无可用走法

    this.executeMove(move);
  }

  /** AI 选择走法 */
  private chooseAIMove(): number {
    const availableMoves = AI_PITS.filter(i => this._board[i] > 0);
    if (availableMoves.length === 0) return -1;

    // 根据难度决定是否使用最优策略
    if (Math.random() < this._aiDifficulty) {
      return this.getBestMove(availableMoves);
    } else {
      // 随机走法
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }
  }

  /** 获取最优走法（贪心 + 简单评估） */
  private getBestMove(availableMoves: readonly number[]): number {
    let bestMove = availableMoves[0];
    let bestScore = -Infinity;

    for (const move of availableMoves) {
      const score = this.evaluateMove(move);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  /** 评估一步走法的分数 */
  private evaluateMove(pitIndex: number): number {
    const seeds = this._board[pitIndex];
    let score = 0;

    // 模拟播种
    let current = pitIndex;
    let lastPit = pitIndex;

    for (let i = 0; i < seeds; i++) {
      current = (current + 1) % TOTAL_PITS;
      // 跳过玩家仓库
      if (current === PLAYER_STORE) {
        current = (current + 1) % TOTAL_PITS;
      }
      lastPit = current;
    }

    // 1. 落在自己仓库 → 额外回合（高分奖励）
    if (lastPit === AI_STORE) {
      score += 10;
    }

    // 2. 落在自己空坑 → 吃子
    if (AI_PITS.includes(lastPit as any)) {
      const seedsAfterSow = (lastPit === pitIndex) ? 1 : this._board[lastPit] + 1;
      if (seedsAfterSow === 1) {
        // 模拟播种后该坑只有1颗（即原本为空）
        const oppositePit = this.getOppositePit(lastPit);
        const captured = this._board[oppositePit];
        if (captured > 0) {
          score += captured + 1; // 吃到的种子数
        }
      }
    }

    // 3. 避免给玩家创造吃子机会
    // 简单启发：避免落在对面为空的坑
    if (AI_PITS.includes(lastPit as any)) {
      const oppositePit = this.getOppositePit(lastPit);
      if (this._board[oppositePit] === 0 && this._board[lastPit] === 0) {
        // 这里会变成空坑，对面如果有种子就可能被吃
        score -= 2;
      }
    }

    // 4. 基础：倾向于种子多的坑
    score += seeds * 0.1;

    return score;
  }

  // ========== 渲染方法 ==========

  /** 渲染棋盘 */
  private renderBoard(ctx: CanvasRenderingContext2D, _w: number, _h: number): void {
    const boardX = BOARD_MARGIN_X;
    const boardY = BOARD_MARGIN_Y;
    const boardW = CANVAS_WIDTH - BOARD_MARGIN_X * 2;
    const boardH = CANVAS_HEIGHT - BOARD_MARGIN_Y * 2 - 20;

    // 棋盘背景
    ctx.fillStyle = BOARD_COLOR;
    this.roundRect(ctx, boardX, boardY, boardW, boardH, 12);
    ctx.fill();

    // 棋盘边框
    ctx.strokeStyle = BOARD_BORDER_COLOR;
    ctx.lineWidth = 3;
    this.roundRect(ctx, boardX, boardY, boardW, boardH, 12);
    ctx.stroke();

    // 仓库
    this.renderStore(ctx, PLAYER_STORE, boardX + BOARD_PADDING, boardY + (boardH - STORE_HEIGHT) / 2, STORE_WIDTH, STORE_HEIGHT, STORE_PLAYER_COLOR, '你');
    this.renderStore(ctx, AI_STORE, boardX + boardW - BOARD_PADDING - STORE_WIDTH, boardY + (boardH - STORE_HEIGHT) / 2, STORE_WIDTH, STORE_HEIGHT, STORE_AI_COLOR, 'AI');

    // AI 凹坑（上方，从左到右：索引 12, 11, 10, 9, 8, 7）
    const pitStartX = boardX + BOARD_PADDING + STORE_WIDTH + PIT_GAP;
    const aiPitY = boardY + (boardH - STORE_HEIGHT) / 2 + 10;
    const playerPitY = boardY + (boardH + STORE_HEIGHT) / 2 - PIT_HEIGHT - 10;

    for (let i = 0; i < PITS_PER_SIDE; i++) {
      const aiPitIndex = 12 - i; // 12, 11, 10, 9, 8, 7
      const px = pitStartX + i * (PIT_WIDTH + PIT_GAP);
      this.renderPit(ctx, aiPitIndex, px, aiPitY, PIT_WIDTH, PIT_HEIGHT, false);
    }

    // 玩家凹坑（下方，从左到右：索引 0, 1, 2, 3, 4, 5）
    for (let i = 0; i < PITS_PER_SIDE; i++) {
      const px = pitStartX + i * (PIT_WIDTH + PIT_GAP);
      const isValid = this._validMoves.includes(i) && this._currentPlayer === 'player';
      const isHover = this._hoverPit === i;
      this.renderPit(ctx, i, px, playerPitY, PIT_WIDTH, PIT_HEIGHT, isValid, isHover);
    }

    // 凹坑标签
    ctx.fillStyle = TEXT_DIM_COLOR;
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    for (let i = 0; i < PITS_PER_SIDE; i++) {
      const px = pitStartX + i * (PIT_WIDTH + PIT_GAP) + PIT_WIDTH / 2;
      // 玩家标签
      ctx.fillText(`${i + 1}`, px, playerPitY + PIT_HEIGHT + 16);
      // AI 标签
      ctx.fillText(`${6 - i}`, px, aiPitY - 6);
    }
    ctx.textAlign = 'left';
  }

  /** 渲染单个凹坑 */
  private renderPit(
    ctx: CanvasRenderingContext2D,
    pitIndex: number,
    x: number, y: number,
    w: number, h: number,
    isValid: boolean = false,
    isHover: boolean = false,
  ): void {
    // 有效走法高亮
    if (isValid) {
      ctx.fillStyle = VALID_MOVE_COLOR;
      this.roundRect(ctx, x - 2, y - 2, w + 4, h + 4, PIT_RADIUS + 2);
      ctx.fill();
    }

    // 悬停效果
    if (isHover && isValid) {
      ctx.fillStyle = PIT_HOVER_COLOR;
    } else if (this._lastMovePit === pitIndex) {
      ctx.fillStyle = PIT_ACTIVE_COLOR;
    } else {
      ctx.fillStyle = PIT_COLOR;
    }

    this.roundRect(ctx, x, y, w, h, PIT_RADIUS);
    ctx.fill();

    // 种子数
    const seeds = this._board[pitIndex];
    if (seeds > 0) {
      // 绘制种子
      this.renderSeeds(ctx, x + w / 2, y + h / 2, seeds, Math.min(w, h) / 2 - 8);

      // 数字标签
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = `bold 14px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${seeds}`, x + w / 2, y + h / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  /** 渲染种子（散布效果） */
  private renderSeeds(ctx: CanvasRenderingContext2D, cx: number, cy: number, count: number, radius: number): void {
    // 简化：只显示少量代表性种子圆点
    const maxVisible = Math.min(count, 8);
    for (let i = 0; i < maxVisible; i++) {
      const angle = (i / maxVisible) * Math.PI * 2 - Math.PI / 2;
      const r = radius * 0.6;
      const sx = cx + Math.cos(angle) * r;
      const sy = cy + Math.sin(angle) * r;

      // 种子阴影
      ctx.fillStyle = SEED_SHADOW;
      ctx.beginPath();
      ctx.arc(sx + 1, sy + 1, SEED_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // 种子
      ctx.fillStyle = SEED_COLOR;
      ctx.beginPath();
      ctx.arc(sx, sy, SEED_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 渲染仓库 */
  private renderStore(
    ctx: CanvasRenderingContext2D,
    storeIndex: number,
    x: number, y: number,
    w: number, h: number,
    color: string,
    label: string,
  ): void {
    ctx.fillStyle = color;
    this.roundRect(ctx, x, y, w, h, 10);
    ctx.fill();

    // 标签
    ctx.fillStyle = TEXT_DIM_COLOR;
    ctx.font = `11px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + 18);

    // 种子数
    const seeds = this._board[storeIndex];
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `bold 22px ${FONT_FAMILY}`;
    ctx.fillText(`${seeds}`, x + w / 2, y + h / 2 + 8);

    ctx.textAlign = 'left';
  }

  /** 渲染 HUD */
  private renderHUD(ctx: CanvasRenderingContext2D, _w: number): void {
    // 顶部信息栏
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);

    // 标题
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText('MANCALA', CANVAS_WIDTH / 2, 24);

    // 回合指示
    if (this._status === 'playing') {
      ctx.font = `13px ${FONT_FAMILY}`;
      if (this._aiThinking) {
        ctx.fillStyle = HIGHLIGHT_COLOR;
        ctx.fillText('AI 思考中...', CANVAS_WIDTH / 2, 46);
      } else if (this._animating) {
        ctx.fillStyle = HIGHLIGHT_COLOR;
        ctx.fillText('播种中...', CANVAS_WIDTH / 2, 46);
      } else if (this._extraTurn) {
        ctx.fillStyle = '#66bb6a';
        ctx.fillText('额外回合！', CANVAS_WIDTH / 2, 46);
      } else {
        ctx.fillStyle = this._currentPlayer === 'player' ? '#64b5f6' : '#ef5350';
        const turnText = this._currentPlayer === 'player' ? '你的回合 (按 1-6)' : 'AI 的回合';
        ctx.fillText(turnText, CANVAS_WIDTH / 2, 46);
      }
    }

    ctx.textAlign = 'left';
  }

  /** 渲染游戏结束画面 */
  private renderGameOver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this._status !== 'gameover' || !this._result) return;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);

    // 结果面板
    const panelW = 300;
    const panelH = 180;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    ctx.fillStyle = '#2a1a3e';
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.fill();
    ctx.strokeStyle = HIGHLIGHT_COLOR;
    ctx.lineWidth = 2;
    this.roundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.stroke();

    ctx.textAlign = 'center';

    // 标题
    const resultText = this._result.winner === 'player' ? '🎉 你赢了！'
      : this._result.winner === 'ai' ? '😢 AI 赢了'
      : '🤝 平局';
    const resultColor = this._result.winner === 'player' ? '#66bb6a'
      : this._result.winner === 'ai' ? '#ef5350'
      : HIGHLIGHT_COLOR;

    ctx.fillStyle = resultColor;
    ctx.font = `bold 28px ${FONT_FAMILY}`;
    ctx.fillText(resultText, w / 2, panelY + 50);

    // 分数
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `20px ${FONT_FAMILY}`;
    ctx.fillText(`${this._result.playerStore} : ${this._result.aiStore}`, w / 2, panelY + 95);

    // 提示
    ctx.fillStyle = TEXT_DIM_COLOR;
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillText('按空格键重新开始', w / 2, panelY + 140);

    ctx.textAlign = 'left';
  }

  /** 绘制圆角矩形 */
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
