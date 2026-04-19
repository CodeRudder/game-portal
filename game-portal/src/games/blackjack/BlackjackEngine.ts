/**
 * 21点 Blackjack 游戏引擎
 *
 * 核心玩法：与庄家比牌点数，尽量接近21点但不超过。
 * - 一副或多副牌（默认1副52张）
 * - 牌面值：A=1或11，2-10=面值，J/Q/K=10
 * - 发牌：玩家2张明牌，庄家1明1暗
 * - 操作：要牌(Hit)、停牌(Stand)、加倍(Double Down)
 * - 庄家规则：小于17必须要牌，17及以上停牌
 * - Blackjack（A+10点牌）赔率1.5倍
 * - 筹码系统：初始1000，可下注
 * - 爆牌（超过21点）立即输
 */

import { GameEngine } from '@/core/GameEngine';
import {
  SUITS,
  RANKS,
  type Suit,
  type Rank,
  getCardColor,
  DEFAULT_DECK_COUNT,
  INITIAL_CHIPS,
  MIN_BET,
  MAX_BET,
  BET_STEP,
  DEALER_STAND_THRESHOLD,
  BLACKJACK_PAYOUT,
  NORMAL_PAYOUT,
  BUST_THRESHOLD,
  BLACKJACK_VALUE,
  GamePhase,
  GameResult,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  CARD_WIDTH,
  CARD_HEIGHT,
  CARD_SPACING,
  CARD_RADIUS,
  KEY_HIT,
  KEY_STAND,
  KEY_DOUBLE,
  KEY_BET_UP,
  KEY_BET_DOWN,
  KEY_NEW_GAME,
  KEY_NEW_GAME_ALT,
  BUTTON_WIDTH,
  BUTTON_HEIGHT,
  BUTTON_RADIUS,
  BUTTON_GAP,
  BUTTON_AREA_Y,
  BUTTON_COLORS,
  BET_BUTTON_WIDTH,
  type ButtonRect,
} from './constants';

// ========== 类型定义 ==========

/** 一张牌 */
export interface Card {
  suit: Suit;
  rank: Rank;
  /** 是否正面朝上 */
  faceUp: boolean;
}

/** 手牌 */
export interface Hand {
  cards: Card[];
}

// ========== 工具函数 ==========

/** 创建一副52张牌 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, faceUp: true });
    }
  }
  return deck;
}

/** 创建多副牌 */
export function createShoe(deckCount: number = DEFAULT_DECK_COUNT): Card[] {
  const shoe: Card[] = [];
  for (let i = 0; i < deckCount; i++) {
    shoe.push(...createDeck());
  }
  return shoe;
}

/** Fisher-Yates 洗牌算法 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** 计算手牌点数（自动处理A的1/11选择） */
export function calculateHandValue(cards: Card[]): number {
  let value = 0;
  let aceCount = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aceCount++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank, 10);
    }
  }

  // 如果超过21点，将A从11降为1
  while (value > BUST_THRESHOLD && aceCount > 0) {
    value -= 10;
    aceCount--;
  }

  return value;
}

/** 判断是否为Blackjack（初始两张牌且点数为21） */
export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && calculateHandValue(cards) === BLACKJACK_VALUE;
}

/** 判断是否爆牌 */
export function isBust(cards: Card[]): boolean {
  return calculateHandValue(cards) > BUST_THRESHOLD;
}

/** 判断是否可以加倍（只有两张牌时） */
export function canDoubleDown(cards: Card[], chips: number, currentBet: number): boolean {
  return cards.length === 2 && chips >= currentBet;
}

// ========== 主引擎类 ==========

export class BlackjackEngine extends GameEngine {
  // 游戏状态
  private deck: Card[] = [];
  private playerHand: Card[] = [];
  private dealerHand: Card[] = [];
  private deckCount: number = DEFAULT_DECK_COUNT;

  // 筹码系统
  private _chips: number = INITIAL_CHIPS;
  private _currentBet: number = MIN_BET;
  private _lastBet: number = MIN_BET;

  // 游戏阶段
  private _phase: GamePhase = GamePhase.BETTING;
  private _result: GameResult | null = null;
  private _resultMessage: string = '';

  // 胜负统计
  private _wins: number = 0;
  private _losses: number = 0;
  private _pushes: number = 0;
  private _blackjacks: number = 0;

  // 是否赢（用于 GameContainer 显示）
  public isWin: boolean = false;

  // 庄家动画相关
  private _dealerRevealed: boolean = false;
  private _dealerAnimating: boolean = false;

  // 鼠标悬停状态
  private _hoveredButton: string | null = null;

  // ========== 属性访问器 ==========

  get chips(): number { return this._chips; }
  get currentBet(): number { return this._currentBet; }
  get phase(): GamePhase { return this._phase; }
  get result(): GameResult | null { return this._result; }
  get resultMessage(): string { return this._resultMessage; }
  get wins(): number { return this._wins; }
  get losses(): number { return this._losses; }
  get pushes(): number { return this._pushes; }
  get blackjacks(): number { return this._blackjacks; }
  get dealerRevealed(): boolean { return this._dealerRevealed; }
  get dealerAnimating(): boolean { return this._dealerAnimating; }

  get playerValue(): number {
    return calculateHandValue(this.playerHand);
  }

  get dealerValue(): number {
    return calculateHandValue(this.dealerHand.filter(c => c.faceUp));
  }

  get dealerFullValue(): number {
    return calculateHandValue(this.dealerHand);
  }

  /** 玩家是否可以要牌 */
  get canHit(): boolean {
    return this._phase === GamePhase.PLAYER_TURN && !isBust(this.playerHand);
  }

  /** 玩家是否可以停牌 */
  get canStand(): boolean {
    return this._phase === GamePhase.PLAYER_TURN;
  }

  /** 玩家是否可以加倍 */
  get canDouble(): boolean {
    return this._phase === GamePhase.PLAYER_TURN &&
      canDoubleDown(this.playerHand, this._chips, this._currentBet);
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this.resetGameState();
  }

  protected onStart(): void {
    this.resetGameState();
    this.startNewRound();
  }

  protected update(_deltaTime: number): void {
    // 21点是回合制游戏，不需要实时更新
    // 但可以处理庄家动画等
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.renderTable(ctx, w, h);
    this.renderDealerHand(ctx, w, h);
    this.renderPlayerHand(ctx, w, h);
    this.renderUI(ctx, w, h);
    this.renderResult(ctx, w, h);
    this.renderButtons(ctx);
  }

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case KEY_HIT:
        this.hit();
        break;
      case KEY_STAND:
        this.stand();
        break;
      case KEY_DOUBLE:
        this.doubleDown();
        break;
      case KEY_BET_UP:
        this.increaseBet();
        break;
      case KEY_BET_DOWN:
        this.decreaseBet();
        break;
      case KEY_NEW_GAME:
      case KEY_NEW_GAME_ALT:
        if (this._phase === GamePhase.SETTLEMENT) {
          this.startNewRound();
        }
        break;
    }
  }

  /** 鼠标点击：命中检测并执行对应操作 */
  handleClick(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') return;

    const buttons = this.getActiveButtons();
    for (const btn of buttons) {
      if (btn.enabled && this.isPointInRect(canvasX, canvasY, btn)) {
        this.executeButtonAction(btn.action);
        return;
      }
    }
  }

  /** 鼠标移动：更新悬停状态 */
  handleMouseMove(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') return;

    const buttons = this.getActiveButtons();
    let found = false;
    for (const btn of buttons) {
      if (this.isPointInRect(canvasX, canvasY, btn)) {
        this._hoveredButton = btn.action;
        found = true;
        break;
      }
    }
    if (!found) {
      this._hoveredButton = null;
    }
  }

  handleKeyUp(_key: string): void {
    // 21点不需要keyup处理
  }

  getState(): Record<string, unknown> {
    return {
      chips: this._chips,
      currentBet: this._currentBet,
      phase: this._phase,
      result: this._result,
      playerHand: this.playerHand,
      dealerHand: this.dealerHand,
      playerValue: this.playerValue,
      dealerValue: this.dealerFullValue,
      wins: this._wins,
      losses: this._losses,
      pushes: this._pushes,
      blackjacks: this._blackjacks,
    };
  }

  // ========== 游戏逻辑 ==========

  /** 重置游戏状态 */
  private resetGameState(): void {
    this.deck = shuffleDeck(createShoe(this.deckCount));
    this.playerHand = [];
    this.dealerHand = [];
    this._chips = INITIAL_CHIPS;
    this._currentBet = MIN_BET;
    this._lastBet = MIN_BET;
    this._phase = GamePhase.BETTING;
    this._result = null;
    this._resultMessage = '';
    this._wins = 0;
    this._losses = 0;
    this._pushes = 0;
    this._blackjacks = 0;
    this.isWin = false;
    this._dealerRevealed = false;
    this._dealerAnimating = false;
  }

  /** 开始新一局 */
  startNewRound(): void {
    // 检查筹码是否足够
    if (this._chips < MIN_BET) {
      this._resultMessage = '筹码不足！游戏结束';
      this._phase = GamePhase.SETTLEMENT;
      this.isWin = false;
      this.gameOver();
      return;
    }

    // 检查牌组是否需要重新洗牌（剩余少于15张）
    if (this.deck.length < 15) {
      this.deck = shuffleDeck(createShoe(this.deckCount));
    }

    // 恢复上一局的赌注
    this._currentBet = Math.min(this._lastBet, this._chips);
    if (this._currentBet < MIN_BET) {
      this._currentBet = Math.min(MIN_BET, this._chips);
    }

    // 清空手牌
    this.playerHand = [];
    this.dealerHand = [];
    this._result = null;
    this._resultMessage = '';
    this.isWin = false;
    this._dealerRevealed = false;
    this._dealerAnimating = false;

    // 进入下注阶段
    this._phase = GamePhase.BETTING;
    this.emit('stateChange', this.getState());
  }

  /** 下注并开始发牌 */
  placeBet(): void {
    if (this._phase !== GamePhase.BETTING) return;
    if (this._currentBet > this._chips) {
      this._currentBet = this._chips;
    }
    if (this._currentBet < MIN_BET) return;

    // 扣除赌注
    this._chips -= this._currentBet;
    this._lastBet = this._currentBet;

    // 发牌
    this.dealCards();

    this.emit('stateChange', this.getState());
  }

  /** 发牌：玩家2张明牌，庄家1明1暗 */
  private dealCards(): void {
    // 玩家第一张牌
    this.playerHand.push(this.drawCard(true));
    // 庄家第一张牌（明牌）
    this.dealerHand.push(this.drawCard(true));
    // 玩家第二张牌
    this.playerHand.push(this.drawCard(true));
    // 庄家第二张牌（暗牌）
    this.dealerHand.push(this.drawCard(false));

    // 检查是否有Blackjack
    const playerBJ = isBlackjack(this.playerHand);
    const dealerBJ = isBlackjack(this.dealerHand);

    if (playerBJ || dealerBJ) {
      // 翻开庄家暗牌
      this.revealDealerCards();

      if (playerBJ && dealerBJ) {
        // 双方都是Blackjack，平局
        this.settleRound(GameResult.PUSH, '双方 Blackjack！平局');
      } else if (playerBJ) {
        // 玩家Blackjack
        this._blackjacks++;
        this.settleRound(GameResult.BLACKJACK, '🎉 Blackjack！');
      } else {
        // 庄家Blackjack
        this.settleRound(GameResult.LOSE, '庄家 Blackjack！');
      }
      return;
    }

    // 进入玩家回合
    this._phase = GamePhase.PLAYER_TURN;
  }

  /** 从牌组抽一张牌 */
  private drawCard(faceUp: boolean): Card {
    const card = this.deck.pop()!;
    card.faceUp = faceUp;
    return card;
  }

  /** 要牌 (Hit) */
  hit(): void {
    if (this._phase !== GamePhase.PLAYER_TURN) return;

    this.playerHand.push(this.drawCard(true));

    if (isBust(this.playerHand)) {
      // 玩家爆牌
      this.revealDealerCards();
      this.settleRound(GameResult.PLAYER_BUST, '💥 爆牌！你输了');
    } else if (calculateHandValue(this.playerHand) === BLACKJACK_VALUE) {
      // 玩家达到21点，自动停牌
      this.stand();
    }

    this.emit('stateChange', this.getState());
  }

  /** 停牌 (Stand) */
  stand(): void {
    if (this._phase !== GamePhase.PLAYER_TURN) return;

    this._phase = GamePhase.DEALER_TURN;
    this._dealerAnimating = true;

    // 翻开庄家暗牌
    this.revealDealerCards();

    // 庄家按规则要牌
    this.dealerPlay();

    this.emit('stateChange', this.getState());
  }

  /** 加倍 (Double Down) */
  doubleDown(): void {
    if (this._phase !== GamePhase.PLAYER_TURN) return;
    if (!canDoubleDown(this.playerHand, this._chips, this._currentBet)) return;

    // 扣除额外赌注
    this._chips -= this._currentBet;
    this._currentBet *= 2;

    // 只能再要一张牌
    this.playerHand.push(this.drawCard(true));

    if (isBust(this.playerHand)) {
      this.revealDealerCards();
      this.settleRound(GameResult.PLAYER_BUST, '💥 爆牌！你输了');
    } else {
      // 自动停牌
      this._phase = GamePhase.DEALER_TURN;
      this._dealerAnimating = true;
      this.revealDealerCards();
      this.dealerPlay();
    }

    this.emit('stateChange', this.getState());
  }

  /** 翻开庄家所有牌 */
  private revealDealerCards(): void {
    this._dealerRevealed = true;
    for (const card of this.dealerHand) {
      card.faceUp = true;
    }
  }

  /** 庄家按规则要牌 */
  private dealerPlay(): void {
    while (calculateHandValue(this.dealerHand) < DEALER_STAND_THRESHOLD) {
      this.dealerHand.push(this.drawCard(true));
    }

    this._dealerAnimating = false;

    // 判定结果
    this.determineWinner();
  }

  /** 判定胜负 */
  private determineWinner(): void {
    const playerValue = calculateHandValue(this.playerHand);
    const dealerValue = calculateHandValue(this.dealerHand);

    if (isBust(this.dealerHand)) {
      this.settleRound(GameResult.DEALER_BUST, '🎉 庄家爆牌！你赢了');
    } else if (playerValue > dealerValue) {
      this.settleRound(GameResult.WIN, '🎉 你赢了！');
    } else if (playerValue < dealerValue) {
      this.settleRound(GameResult.LOSE, '你输了');
    } else {
      this.settleRound(GameResult.PUSH, '平局');
    }
  }

  /** 结算 */
  private settleRound(result: GameResult, message: string): void {
    this._result = result;
    this._resultMessage = message;
    this._phase = GamePhase.SETTLEMENT;

    let winnings = 0;
    switch (result) {
      case GameResult.BLACKJACK:
        winnings = Math.floor(this._currentBet * (1 + BLACKJACK_PAYOUT));
        this._chips += winnings;
        this._wins++;
        this.isWin = true;
        this.addScore(Math.floor(this._currentBet * BLACKJACK_PAYOUT));
        break;
      case GameResult.WIN:
      case GameResult.DEALER_BUST:
        winnings = this._currentBet * 2;
        this._chips += winnings;
        this._wins++;
        this.isWin = true;
        this.addScore(this._currentBet);
        break;
      case GameResult.PUSH:
        // 平局退还赌注
        this._chips += this._currentBet;
        this._pushes++;
        this.isWin = false;
        break;
      case GameResult.LOSE:
      case GameResult.PLAYER_BUST:
        this._losses++;
        this.isWin = false;
        break;
    }

    this.emit('stateChange', this.getState());

    // 检查是否破产
    if (this._chips < MIN_BET) {
      this._resultMessage += ' — 筹码不足！';
    }
  }

  /** 增加赌注 */
  increaseBet(): void {
    if (this._phase !== GamePhase.BETTING) return;
    this._currentBet = Math.min(this._currentBet + BET_STEP, Math.min(MAX_BET, this._chips));
    this.emit('stateChange', this.getState());
  }

  /** 减少赌注 */
  decreaseBet(): void {
    if (this._phase !== GamePhase.BETTING) return;
    this._currentBet = Math.max(this._currentBet - BET_STEP, MIN_BET);
    this.emit('stateChange', this.getState());
  }

  /** 设置赌注金额 */
  setBet(amount: number): void {
    if (this._phase !== GamePhase.BETTING) return;
    this._currentBet = Math.max(MIN_BET, Math.min(amount, Math.min(MAX_BET, this._chips)));
    this.emit('stateChange', this.getState());
  }

  /** 设置牌组数量 */
  setDeckCount(count: number): void {
    this.deckCount = Math.max(1, Math.min(count, 8));
  }

  /** 获取牌组剩余张数 */
  getDeckRemaining(): number {
    return this.deck.length;
  }

  // ========== 按钮辅助方法 ==========

  /** 获取当前阶段的活动按钮列表 */
  private getActiveButtons(): ButtonRect[] {
    const centerX = CANVAS_WIDTH / 2;

    if (this._phase === GamePhase.BETTING) {
      // 下注阶段：[−50] [+50] [+100] 按钮 + [发牌] 按钮
      const betButtons: ButtonRect[] = [];

      // 下注调整按钮行（在发牌按钮上方）
      const betRowY = BUTTON_AREA_Y - BUTTON_HEIGHT - 12;
      const betGap = 12;
      const totalBetWidth = 3 * BET_BUTTON_WIDTH + 2 * betGap;
      const betStartX = centerX - totalBetWidth / 2;

      betButtons.push({
        x: betStartX,
        y: betRowY,
        width: BET_BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        label: '−50',
        action: 'betDown50',
        enabled: this._currentBet > MIN_BET,
        bgColor: BUTTON_COLORS.BET_DOWN_BG,
        hoverColor: BUTTON_COLORS.BET_DOWN_HOVER,
        disabledColor: '#7a4a10',
      });

      betButtons.push({
        x: betStartX + BET_BUTTON_WIDTH + betGap,
        y: betRowY,
        width: BET_BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        label: '+50',
        action: 'betUp50',
        enabled: this._currentBet + 50 <= Math.min(MAX_BET, this._chips),
        bgColor: BUTTON_COLORS.BET_UP_BG,
        hoverColor: BUTTON_COLORS.BET_UP_HOVER,
        disabledColor: '#165a30',
      });

      betButtons.push({
        x: betStartX + 2 * (BET_BUTTON_WIDTH + betGap),
        y: betRowY,
        width: BET_BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        label: '+100',
        action: 'betUp100',
        enabled: this._currentBet + 100 <= Math.min(MAX_BET, this._chips),
        bgColor: BUTTON_COLORS.BET_UP_BG,
        hoverColor: BUTTON_COLORS.BET_UP_HOVER,
        disabledColor: '#165a30',
      });

      // 发牌按钮
      betButtons.push({
        x: centerX - BUTTON_WIDTH / 2,
        y: BUTTON_AREA_Y,
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        label: '发牌',
        action: 'deal',
        enabled: this._currentBet >= MIN_BET && this._currentBet <= this._chips,
        bgColor: BUTTON_COLORS.DEAL_BG,
        hoverColor: BUTTON_COLORS.DEAL_HOVER,
        disabledColor: BUTTON_COLORS.DEAL_DISABLED,
      });

      return betButtons;
    }

    if (this._phase === GamePhase.PLAYER_TURN) {
      // 玩家回合：[Hit] [Stand] [Double Down] 按钮
      const buttons: ButtonRect[] = [];
      const totalWidth = 3 * BUTTON_WIDTH + 2 * BUTTON_GAP;
      const startX = centerX - totalWidth / 2;

      buttons.push({
        x: startX,
        y: BUTTON_AREA_Y,
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        label: '要牌',
        action: 'hit',
        enabled: this.canHit,
        bgColor: BUTTON_COLORS.HIT_BG,
        hoverColor: BUTTON_COLORS.HIT_HOVER,
        disabledColor: BUTTON_COLORS.HIT_DISABLED,
      });

      buttons.push({
        x: startX + BUTTON_WIDTH + BUTTON_GAP,
        y: BUTTON_AREA_Y,
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        label: '停牌',
        action: 'stand',
        enabled: this.canStand,
        bgColor: BUTTON_COLORS.STAND_BG,
        hoverColor: BUTTON_COLORS.STAND_HOVER,
        disabledColor: BUTTON_COLORS.STAND_DISABLED,
      });

      buttons.push({
        x: startX + 2 * (BUTTON_WIDTH + BUTTON_GAP),
        y: BUTTON_AREA_Y,
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        label: '加倍',
        action: 'double',
        enabled: this.canDouble,
        bgColor: BUTTON_COLORS.DOUBLE_BG,
        hoverColor: BUTTON_COLORS.DOUBLE_HOVER,
        disabledColor: BUTTON_COLORS.DOUBLE_DISABLED,
      });

      return buttons;
    }

    if (this._phase === GamePhase.DEALER_TURN || this._phase === GamePhase.SETTLEMENT) {
      // 庄家回合 / 结算阶段：[New Game] 按钮
      return [{
        x: centerX - BUTTON_WIDTH / 2,
        y: BUTTON_AREA_Y,
        width: BUTTON_WIDTH,
        height: BUTTON_HEIGHT,
        label: '新一局',
        action: 'newgame',
        enabled: this._phase === GamePhase.SETTLEMENT && this._chips >= MIN_BET,
        bgColor: BUTTON_COLORS.NEW_GAME_BG,
        hoverColor: BUTTON_COLORS.NEW_GAME_HOVER,
        disabledColor: BUTTON_COLORS.DEAL_DISABLED,
      }];
    }

    return [];
  }

  /** 判断点是否在矩形内 */
  private isPointInRect(px: number, py: number, rect: { x: number; y: number; width: number; height: number }): boolean {
    return px >= rect.x && px <= rect.x + rect.width &&
           py >= rect.y && py <= rect.y + rect.height;
  }

  /** 执行按钮动作 */
  private executeButtonAction(action: string): void {
    switch (action) {
      case 'deal':
        this.placeBet();
        break;
      case 'hit':
        this.hit();
        break;
      case 'stand':
        this.stand();
        break;
      case 'double':
        this.doubleDown();
        break;
      case 'newgame':
        if (this._phase === GamePhase.SETTLEMENT) {
          this.startNewRound();
        }
        break;
      case 'betUp100':
        if (this._phase === GamePhase.BETTING) {
          this.setBet(this._currentBet + 100);
        }
        break;
      case 'betUp50':
        if (this._phase === GamePhase.BETTING) {
          this.setBet(this._currentBet + 50);
        }
        break;
      case 'betDown50':
        if (this._phase === GamePhase.BETTING) {
          this.setBet(this._currentBet - 50);
        }
        break;
    }
  }

  /** 渲染操作按钮 */
  private renderButtons(ctx: CanvasRenderingContext2D): void {
    const buttons = this.getActiveButtons();

    for (const btn of buttons) {
      const isHovered = this._hoveredButton === btn.action;

      // 按钮背景
      if (!btn.enabled) {
        ctx.fillStyle = btn.disabledColor;
      } else if (isHovered) {
        ctx.fillStyle = btn.hoverColor;
      } else {
        ctx.fillStyle = btn.bgColor;
      }

      this.roundRect(ctx, btn.x, btn.y, btn.width, btn.height, BUTTON_RADIUS);
      ctx.fill();

      // 悬停时加边框
      if (isHovered && btn.enabled) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        this.roundRect(ctx, btn.x, btn.y, btn.width, btn.height, BUTTON_RADIUS);
        ctx.stroke();
      }

      // 按钮文字
      ctx.fillStyle = btn.enabled ? BUTTON_COLORS.TEXT : BUTTON_COLORS.TEXT_DISABLED;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2);
      ctx.textBaseline = 'alphabetic'; // 重置
    }
  }

  // ========== 渲染方法 ==========

  /** 渲染牌桌背景 */
  private renderTable(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 牌桌背景
    ctx.fillStyle = COLORS.TABLE_GREEN;
    ctx.fillRect(0, 0, w, h);

    // 牌桌边框
    ctx.strokeStyle = COLORS.TABLE_BORDER;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // 内部椭圆装饰
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.4, h * 0.35, 0, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.TABLE_BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /** 渲染庄家手牌 */
  private renderDealerHand(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    // 庄家标签
    ctx.fillStyle = COLORS.TEXT_WHITE;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('庄家', w / 2, 50);

    // 庄家点数
    if (this._dealerRevealed) {
      ctx.fillStyle = COLORS.TEXT_GOLD;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${this.dealerFullValue}`, w / 2, 70);
    } else if (this.dealerHand.length > 0) {
      ctx.fillStyle = COLORS.TEXT_GRAY;
      ctx.font = '14px sans-serif';
      ctx.fillText(`${this.dealerValue}+?`, w / 2, 70);
    }

    // 渲染庄家牌
    this.renderHand(ctx, this.dealerHand, w / 2, 90);
  }

  /** 渲染玩家手牌 */
  private renderPlayerHand(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 玩家标签
    ctx.fillStyle = COLORS.TEXT_WHITE;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('玩家', w / 2, h - 195);

    // 玩家点数
    if (this.playerHand.length > 0) {
      const val = this.playerValue;
      ctx.fillStyle = val > BUST_THRESHOLD ? COLORS.TEXT_RED : COLORS.TEXT_GOLD;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${val}`, w / 2, h - 175);
    }

    // 渲染玩家牌
    this.renderHand(ctx, this.playerHand, w / 2, h - 165);
  }

  /** 渲染一组手牌 */
  private renderHand(ctx: CanvasRenderingContext2D, cards: Card[], centerX: number, topY: number): void {
    const totalWidth = cards.length > 0
      ? CARD_WIDTH + (cards.length - 1) * (CARD_WIDTH + CARD_SPACING)
      : 0;
    const startX = centerX - totalWidth / 2;

    for (let i = 0; i < cards.length; i++) {
      const x = startX + i * (CARD_WIDTH + CARD_SPACING);
      this.renderCard(ctx, cards[i], x, topY);
    }
  }

  /** 渲染单张牌 */
  private renderCard(ctx: CanvasRenderingContext2D, card: Card, x: number, y: number): void {
    if (card.faceUp) {
      // 正面
      ctx.fillStyle = COLORS.CARD_WHITE;
      this.roundRect(ctx, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
      ctx.fill();
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;
      this.roundRect(ctx, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
      ctx.stroke();

      // 花色和面值
      const color = getCardColor(card.suit);
      ctx.fillStyle = color === 'red' ? '#cc0000' : '#000000';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.rank, x + CARD_WIDTH / 2, y + 25);
      ctx.font = '20px sans-serif';
      ctx.fillText(card.suit, x + CARD_WIDTH / 2, y + 50);

      // 左上角小字
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(card.rank, x + 5, y + 14);
      ctx.fillText(card.suit, x + 5, y + 26);
    } else {
      // 背面
      ctx.fillStyle = COLORS.CARD_BACK;
      this.roundRect(ctx, x, y, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
      ctx.fill();

      // 背面花纹
      ctx.fillStyle = COLORS.CARD_BACK_PATTERN;
      this.roundRect(ctx, x + 4, y + 4, CARD_WIDTH - 8, CARD_HEIGHT - 8, CARD_RADIUS - 2);
      ctx.fill();

      // 中间装饰
      ctx.fillStyle = COLORS.CARD_BACK;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2 + 7);
    }
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

  /** 渲染UI（筹码、赌注、操作提示） */
  private renderUI(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 筹码显示
    ctx.fillStyle = COLORS.TEXT_GOLD;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`💰 ${this._chips}`, 20, 30);

    // 赌注显示
    ctx.fillStyle = COLORS.TEXT_WHITE;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`赌注: ${this._currentBet}`, w - 20, 30);

    // 统计信息
    ctx.fillStyle = COLORS.TEXT_GRAY;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`胜: ${this._wins}  负: ${this._losses}  平: ${this._pushes}`, 20, h - 15);

    // 阶段提示
    ctx.textAlign = 'center';
    if (this._phase === GamePhase.BETTING) {
      ctx.fillStyle = COLORS.TEXT_GOLD;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('↑↓ 调整赌注 · 点击按钮 · 空格/Enter 开始', w / 2, h / 2);
    } else if (this._phase === GamePhase.PLAYER_TURN) {
      ctx.fillStyle = COLORS.TEXT_WHITE;
      ctx.font = '12px sans-serif';
      ctx.fillText('H 要牌 · S 停牌 · D 加倍', w / 2, h / 2 + 30);
    }
  }

  /** 渲染结果信息 */
  private renderResult(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this._phase !== GamePhase.SETTLEMENT || !this._resultMessage) return;

    // 半透明遮罩
    ctx.fillStyle = COLORS.OVERLAY_BG;
    ctx.fillRect(0, h / 2 - 50, w, 100);

    // 结果消息
    const isPositive = this._result === GameResult.WIN ||
      this._result === GameResult.BLACKJACK ||
      this._result === GameResult.DEALER_BUST;
    ctx.fillStyle = isPositive ? COLORS.TEXT_GREEN : COLORS.TEXT_RED;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this._resultMessage, w / 2, h / 2 - 10);

    // 继续提示
    ctx.fillStyle = COLORS.TEXT_GRAY;
    ctx.font = '14px sans-serif';
    ctx.fillText('空格/Enter 继续下一局', w / 2, h / 2 + 25);
  }

  // ========== 生命周期覆写 ==========

  protected onReset(): void {
    this.resetGameState();
  }

  protected onGameOver(): void {
    this._phase = GamePhase.SETTLEMENT;
  }
}
