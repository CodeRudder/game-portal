import { GameEngine } from '@/core/GameEngine';
import {
  SUITS,
  RANKS,
  PAYOUT_TABLE,
  HAND_RANK_NAMES,
  RANK_NAMES,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DEFAULT_CREDITS,
  MIN_BET,
  MAX_BET,
  BET_STEP,
  HAND_SIZE,
  GamePhase,
  HandRank,
  VP_BUTTON_WIDTH,
  VP_BUTTON_HEIGHT,
  VP_BUTTON_RADIUS,
  VP_BUTTON_Y,
  VP_CARD_WIDTH,
  VP_CARD_HEIGHT,
  VP_CARD_GAP,
  VP_BUTTON_COLORS,
  VP_BET_BUTTON_WIDTH,
  VP_BET_BUTTON_HEIGHT,
  type VPButtonRect,
} from './constants';
import type { Card, Suit, Rank, VideoPokerState } from './constants';

export class VideoPokerEngine extends GameEngine {
  // ========== 游戏状态 ==========
  private phase: GamePhase = GamePhase.IDLE;
  private hand: (Card | null)[] = new Array(HAND_SIZE).fill(null);
  private held: boolean[] = new Array(HAND_SIZE).fill(false);
  private credits: number = DEFAULT_CREDITS;
  private bet: number = MIN_BET;
  private lastWin: number = 0;
  private handRank: HandRank | null = null;
  private deck: Card[] = [];

  // 鼠标悬停状态
  private _hoveredCardIndex: number = -1; // -1 表示没有悬停
  private _hoveredButton: string | null = null;

  // ========== 牌组操作 ==========

  /** 创建一副52张标准扑克牌 */
  static createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank });
      }
    }
    return deck;
  }

  /** Fisher-Yates 洗牌算法 */
  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /** 从牌组顶部发一张牌 */
  drawCard(): Card | undefined {
    return this.deck.pop();
  }

  // ========== 牌型判定 ==========

  /** 判定5张牌的牌型（从高到低检查） */
  static evaluateHand(cards: Card[]): HandRank {
    if (cards.length !== HAND_SIZE) return HandRank.HIGH_CARD;

    const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
    const suits = cards.map((c) => c.suit);

    const isFlush = suits.every((s) => s === suits[0]);
    const isStraight = VideoPokerEngine.isConsecutive(ranks);
    // 特殊顺子：A-2-3-4-5（wheel）
    const isWheelStraight =
      ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 4 && ranks[3] === 5 && ranks[4] === 14;

    const rankCounts = VideoPokerEngine.getRankCounts(ranks);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    // 皇家同花顺：同花的 A-K-Q-J-10
    if (isFlush && isStraight && ranks[0] === 10) {
      return HandRank.ROYAL_FLUSH;
    }

    // 同花顺：同花连续5张
    if (isFlush && (isStraight || isWheelStraight)) {
      return HandRank.STRAIGHT_FLUSH;
    }

    // 四条
    if (counts[0] === 4) {
      return HandRank.FOUR_OF_A_KIND;
    }

    // 葫芦：三条+一对
    if (counts[0] === 3 && counts[1] === 2) {
      return HandRank.FULL_HOUSE;
    }

    // 同花
    if (isFlush) {
      return HandRank.FLUSH;
    }

    // 顺子
    if (isStraight || isWheelStraight) {
      return HandRank.STRAIGHT;
    }

    // 三条
    if (counts[0] === 3) {
      return HandRank.THREE_OF_A_KIND;
    }

    // 两对
    if (counts[0] === 2 && counts[1] === 2) {
      return HandRank.TWO_PAIR;
    }

    // 一对(Jacks or Better)
    if (counts[0] === 2) {
      const pairRank = VideoPokerEngine.getPairRank(rankCounts);
      if (pairRank !== null && pairRank >= 11) {
        return HandRank.JACKS_OR_BETTER;
      }
    }

    return HandRank.HIGH_CARD;
  }

  /** 检查牌面值是否连续 */
  private static isConsecutive(sortedRanks: number[]): boolean {
    for (let i = 1; i < sortedRanks.length; i++) {
      if (sortedRanks[i] !== sortedRanks[i - 1] + 1) return false;
    }
    return true;
  }

  /** 统计每个牌面值出现次数 */
  private static getRankCounts(sortedRanks: number[]): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const r of sortedRanks) {
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }

  /** 获取对子的牌面值 */
  private static getPairRank(rankCounts: Record<number, number>): number | null {
    for (const [rank, count] of Object.entries(rankCounts)) {
      if (count === 2) return Number(rank);
    }
    return null;
  }

  /** 计算赢取筹码 */
  static calculateWinnings(cards: Card[], bet: number): { handRank: HandRank; win: number } {
    const handRank = VideoPokerEngine.evaluateHand(cards);
    const multiplier = PAYOUT_TABLE[handRank];
    const win = bet * multiplier;
    return { handRank, win };
  }

  // ========== 游戏操作 ==========

  /** 发初始5张牌 */
  deal(): void {
    if (this.credits < this.bet) return;

    // 扣除下注
    this.credits -= this.bet;
    this.lastWin = 0;
    this.handRank = null;

    // 洗牌并发牌
    this.deck = VideoPokerEngine.shuffleDeck(VideoPokerEngine.createDeck());
    this.hand = [];
    this.held = new Array(HAND_SIZE).fill(false);

    for (let i = 0; i < HAND_SIZE; i++) {
      const card = this.drawCard();
      this.hand.push(card!);
    }

    this.phase = GamePhase.HOLDING;
    this.emit('stateChange', this.getState());
  }

  /** 切换保留状态 */
  toggleHold(index: number): void {
    if (index < 0 || index >= HAND_SIZE) return;
    if (this.phase !== GamePhase.HOLDING) return;
    this.held[index] = !this.held[index];
    this.emit('stateChange', this.getState());
  }

  /** 换牌（替换未保留的牌） */
  draw(): void {
    if (this.phase !== GamePhase.HOLDING) return;

    this.phase = GamePhase.DRAWING;

    // 替换未保留的牌
    for (let i = 0; i < HAND_SIZE; i++) {
      if (!this.held[i]) {
        const card = this.drawCard();
        this.hand[i] = card ?? null;
      }
    }

    // 判定牌型
    const validHand = this.hand.filter((c): c is Card => c !== null);
    const result = VideoPokerEngine.calculateWinnings(validHand, this.bet);

    this.handRank = result.handRank;
    this.lastWin = result.win;
    this.credits += result.win;
    this.addScore(result.win);

    this.phase = GamePhase.RESULT;
    this.emit('stateChange', this.getState());

    // 结果阶段结束后自动进入 idle
    // 玩家按空格/Enter 开始新一局
  }

  /** 开始新一局 */
  newRound(): void {
    if (this.phase !== GamePhase.RESULT && this.phase !== GamePhase.IDLE) return;

    this.phase = GamePhase.IDLE;
    this.hand = new Array(HAND_SIZE).fill(null);
    this.held = new Array(HAND_SIZE).fill(false);
    this.handRank = null;
    this.lastWin = 0;

    if (this.credits <= 0) {
      this.credits = DEFAULT_CREDITS;
    }

    this.emit('stateChange', this.getState());
  }

  /** 调整下注 */
  adjustBet(delta: number): void {
    if (this.phase !== GamePhase.IDLE && this.phase !== GamePhase.RESULT) return;
    const newBet = this.bet + delta * BET_STEP;
    this.bet = Math.max(MIN_BET, Math.min(MAX_BET, newBet));
    // 确保不超过当前筹码
    this.bet = Math.min(this.bet, this.credits);
    this.emit('stateChange', this.getState());
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this.phase = GamePhase.IDLE;
    this.hand = new Array(HAND_SIZE).fill(null);
    this.held = new Array(HAND_SIZE).fill(false);
    this.credits = DEFAULT_CREDITS;
    this.bet = MIN_BET;
    this.lastWin = 0;
    this.handRank = null;
    this.deck = [];
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onStart(): void {
    this.onInit();
    this.deal();
  }

  protected update(_deltaTime: number): void {
    // Video Poker 不需要持续更新，基于回合制
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, w, h);

    this.renderHeader(ctx, w);
    this.renderPayTable(ctx, w);
    this.renderHand(ctx, w, h);
    this.renderHeldIndicators(ctx, w, h);
    this.renderControls(ctx, w, h);
    this.renderResult(ctx, w, h);
  }

  // ========== 按钮辅助方法 ==========

  /** 获取5张牌的渲染位置 */
  private getCardPositions(): { x: number; y: number }[] {
    const totalWidth = HAND_SIZE * VP_CARD_WIDTH + (HAND_SIZE - 1) * VP_CARD_GAP;
    const startX = (CANVAS_WIDTH - totalWidth) / 2;
    const startY = CANVAS_HEIGHT / 2 - VP_CARD_HEIGHT / 2 + 20;

    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < HAND_SIZE; i++) {
      positions.push({
        x: startX + i * (VP_CARD_WIDTH + VP_CARD_GAP),
        y: startY,
      });
    }
    return positions;
  }

  /** 获取 Deal/Draw 按钮定义 */
  private getDealDrawButton(): VPButtonRect {
    const centerX = CANVAS_WIDTH / 2;
    let label: string;
    let action: string;
    let enabled: boolean;

    if (this.phase === GamePhase.IDLE || this.phase === GamePhase.RESULT) {
      label = '发牌';
      action = 'deal';
      enabled = this.credits >= this.bet;
    } else if (this.phase === GamePhase.HOLDING) {
      label = '换牌';
      action = 'draw';
      enabled = true;
    } else {
      label = '发牌';
      action = 'deal';
      enabled = false;
    }

    return {
      x: centerX - VP_BUTTON_WIDTH / 2,
      y: VP_BUTTON_Y,
      width: VP_BUTTON_WIDTH,
      height: VP_BUTTON_HEIGHT,
      label,
      action,
      enabled,
      bgColor: VP_BUTTON_COLORS.DEAL_DRAW_BG,
      hoverColor: VP_BUTTON_COLORS.DEAL_DRAW_HOVER,
      disabledColor: VP_BUTTON_COLORS.DEAL_DRAW_DISABLED,
    };
  }

  /** 判断点击位置对应哪张牌（返回 -1 表示没有） */
  private getCardIndexAtPoint(px: number, py: number): number {
    const positions = this.getCardPositions();
    for (let i = 0; i < HAND_SIZE; i++) {
      const { x, y } = positions[i];
      if (px >= x && px <= x + VP_CARD_WIDTH && py >= y && py <= y + VP_CARD_HEIGHT) {
        return i;
      }
    }
    return -1;
  }

  /** 获取下注调整按钮列表（仅在 IDLE/RESULT 阶段显示） */
  private getBetButtons(): VPButtonRect[] {
    if (this.phase !== GamePhase.IDLE && this.phase !== GamePhase.RESULT) {
      return [];
    }

    const centerX = CANVAS_WIDTH / 2;
    const gap = 12;
    const totalWidth = 2 * VP_BET_BUTTON_WIDTH + gap;
    const startX = centerX - totalWidth / 2;
    const y = VP_BUTTON_Y - VP_BET_BUTTON_HEIGHT - 10;

    return [
      {
        x: startX,
        y,
        width: VP_BET_BUTTON_WIDTH,
        height: VP_BET_BUTTON_HEIGHT,
        label: '−1',
        action: 'betDown',
        enabled: this.bet > MIN_BET,
        bgColor: VP_BUTTON_COLORS.BET_DOWN_BG,
        hoverColor: VP_BUTTON_COLORS.BET_DOWN_HOVER,
        disabledColor: '#7a4a10',
      },
      {
        x: startX + VP_BET_BUTTON_WIDTH + gap,
        y,
        width: VP_BET_BUTTON_WIDTH,
        height: VP_BET_BUTTON_HEIGHT,
        label: '+1',
        action: 'betUp',
        enabled: this.bet < Math.min(MAX_BET, this.credits),
        bgColor: VP_BUTTON_COLORS.BET_UP_BG,
        hoverColor: VP_BUTTON_COLORS.BET_UP_HOVER,
        disabledColor: '#165a30',
      },
    ];
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
        if (this.phase === GamePhase.IDLE || this.phase === GamePhase.RESULT) {
          this.newRound();
          this.deal();
        }
        break;
      case 'draw':
        if (this.phase === GamePhase.HOLDING) {
          this.draw();
        }
        break;
      case 'betUp':
        if (this.phase === GamePhase.IDLE || this.phase === GamePhase.RESULT) {
          this.adjustBet(1);
        }
        break;
      case 'betDown':
        if (this.phase === GamePhase.IDLE || this.phase === GamePhase.RESULT) {
          this.adjustBet(-1);
        }
        break;
    }
  }

  /** 渲染 Deal/Draw 按钮 */
  private renderDealDrawButton(ctx: CanvasRenderingContext2D): void {
    const button = this.getDealDrawButton();
    const isHovered = this._hoveredButton === button.action;

    // 按钮背景
    if (!button.enabled) {
      ctx.fillStyle = button.disabledColor;
    } else if (isHovered) {
      ctx.fillStyle = button.hoverColor;
    } else {
      ctx.fillStyle = button.bgColor;
    }

    this.roundRect(ctx, button.x, button.y, button.width, button.height, VP_BUTTON_RADIUS);
    ctx.fill();

    // 悬停时加边框
    if (isHovered && button.enabled) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      this.roundRect(ctx, button.x, button.y, button.width, button.height, VP_BUTTON_RADIUS);
      ctx.stroke();
    }

    // 按钮文字
    ctx.fillStyle = button.enabled ? VP_BUTTON_COLORS.TEXT : VP_BUTTON_COLORS.TEXT_DISABLED;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2);
    ctx.textBaseline = 'alphabetic';
  }

  private renderHeader(ctx: CanvasRenderingContext2D, w: number): void {
    // 标题
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VIDEO POKER', w / 2, 28);

    // 筹码和下注信息
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`筹码: ${this.credits}`, 15, 52);
    ctx.textAlign = 'center';
    ctx.fillText(`下注: ${this.bet}`, w / 2, 52);
    if (this.lastWin > 0) {
      ctx.fillStyle = '#00ff88';
      ctx.textAlign = 'right';
      ctx.fillText(`赢得: ${this.lastWin}`, w - 15, 52);
    }
  }

  private renderPayTable(ctx: CanvasRenderingContext2D, w: number): void {
    const startY = 68;
    const lineHeight = 16;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';

    const entries: [string, number, string][] = [
      ['皇家同花顺', 800, '#ffd700'],
      ['同花顺', 50, '#ffd700'],
      ['四条', 25, '#ff6b6b'],
      ['葫芦', 9, '#ff6b6b'],
      ['同花', 6, '#4ecdc4'],
      ['顺子', 4, '#4ecdc4'],
      ['三条', 3, '#45b7d1'],
      ['两对', 2, '#96ceb4'],
      ['一对(J+)', 1, '#a8a8a8'],
    ];

    entries.forEach(([name, payout, color], i) => {
      const y = startY + i * lineHeight;
      const isHighlighted = this.handRank && HAND_RANK_NAMES[this.handRank] === name;

      if (isHighlighted) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.fillRect(10, y - 11, w - 20, lineHeight);
      }

      ctx.fillStyle = isHighlighted ? '#ffd700' : color;
      ctx.textAlign = 'left';
      ctx.fillText(name, 15, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${payout}x`, w - 15, y);
    });
  }

  private renderHand(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const cardWidth = VP_CARD_WIDTH;
    const cardHeight = VP_CARD_HEIGHT;
    const gap = VP_CARD_GAP;
    const totalWidth = HAND_SIZE * cardWidth + (HAND_SIZE - 1) * gap;
    const startX = (w - totalWidth) / 2;
    const startY = h / 2 - cardHeight / 2 + 20;

    this.hand.forEach((card, i) => {
      const x = startX + i * (cardWidth + gap);
      const y = startY;

      // 悬停高亮效果（在牌后面绘制发光边框）
      const isHovered = this._hoveredCardIndex === i && this.phase === GamePhase.HOLDING;
      if (isHovered) {
        ctx.shadowColor = VP_BUTTON_COLORS.CARD_HOVER_BORDER;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = VP_BUTTON_COLORS.CARD_HOVER_BORDER;
        ctx.lineWidth = 3;
        this.roundRect(ctx, x - 2, y - 2, cardWidth + 4, cardHeight + 4, 8);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (card) {
        // 卡牌背景
        const isHeld = this.held[i];
        ctx.fillStyle = isHeld ? '#1a3a5c' : '#1c1c3a';
        ctx.strokeStyle = isHeld ? '#ffd700' : (isHovered ? '#ffd700' : '#444466');
        ctx.lineWidth = isHeld ? 2 : 1;

        // 圆角矩形
        this.roundRect(ctx, x, y, cardWidth, cardHeight, 6);
        ctx.fill();
        ctx.stroke();

        // 花色和牌面值
        const suitSymbol = SUIT_SYMBOLS[card.suit];
        const rankName = RANK_NAMES[card.rank];
        const color = SUIT_COLORS[card.suit];

        ctx.fillStyle = color;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(rankName, x + cardWidth / 2, y + 35);

        ctx.font = '28px serif';
        ctx.fillText(suitSymbol, x + cardWidth / 2, y + 72);

        // 左上角小字
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${rankName}${suitSymbol}`, x + 5, y + 14);
      } else {
        // 空位占位
        ctx.fillStyle = '#111122';
        ctx.strokeStyle = '#333355';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, cardWidth, cardHeight, 6);
        ctx.fill();
        ctx.stroke();
      }
    });
  }

  private renderHeldIndicators(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.phase !== GamePhase.HOLDING) return;

    const cardWidth = VP_CARD_WIDTH;
    const gap = VP_CARD_GAP;
    const totalWidth = HAND_SIZE * cardWidth + (HAND_SIZE - 1) * gap;
    const startX = (w - totalWidth) / 2;
    const startY = h / 2 - 50 / 2 + 20 + VP_CARD_HEIGHT + 8;

    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i < HAND_SIZE; i++) {
      const x = startX + i * (cardWidth + gap) + cardWidth / 2;
      if (this.held[i]) {
        ctx.fillStyle = '#ffd700';
        ctx.fillText('HELD', x, startY);
      } else {
        ctx.fillStyle = '#555577';
        ctx.fillText(`[${i + 1}]`, x, startY);
      }
    }
  }

  private renderControls(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 渲染下注调整按钮（IDLE/RESULT 阶段）
    this.renderBetButtons(ctx);

    // 渲染 Deal/Draw 按钮
    this.renderDealDrawButton(ctx);

    // 键盘提示（保留在按钮下方）
    const y = VP_BUTTON_Y + VP_BUTTON_HEIGHT + 12;

    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666688';

    if (this.phase === GamePhase.IDLE) {
      ctx.fillText('↑↓ 或点击按钮调整下注 (1-5)', w / 2, y);
    } else if (this.phase === GamePhase.HOLDING) {
      ctx.fillStyle = '#7788aa';
      ctx.fillText('点击选牌 · 按 1-5 保留/取消', w / 2, y);
    } else if (this.phase === GamePhase.RESULT) {
      ctx.fillStyle = '#7788aa';
      ctx.fillText('点击按钮或按空格开始新一局', w / 2, y);
    }
  }

  /** 渲染下注调整按钮 */
  private renderBetButtons(ctx: CanvasRenderingContext2D): void {
    const betButtons = this.getBetButtons();

    for (const btn of betButtons) {
      const isHovered = this._hoveredButton === btn.action;

      // 按钮背景
      if (!btn.enabled) {
        ctx.fillStyle = btn.disabledColor;
      } else if (isHovered) {
        ctx.fillStyle = btn.hoverColor;
      } else {
        ctx.fillStyle = btn.bgColor;
      }

      this.roundRect(ctx, btn.x, btn.y, btn.width, btn.height, VP_BUTTON_RADIUS);
      ctx.fill();

      // 悬停时加边框
      if (isHovered && btn.enabled) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        this.roundRect(ctx, btn.x, btn.y, btn.width, btn.height, VP_BUTTON_RADIUS);
        ctx.stroke();
      }

      // 按钮文字
      ctx.fillStyle = btn.enabled ? VP_BUTTON_COLORS.TEXT : VP_BUTTON_COLORS.TEXT_DISABLED;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2);
      ctx.textBaseline = 'alphabetic';
    }
  }

  private renderResult(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.phase !== GamePhase.RESULT || !this.handRank) return;

    const y = h / 2 + 100;
    ctx.textAlign = 'center';

    if (this.lastWin > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`${HAND_RANK_NAMES[this.handRank]}!`, w / 2, y);
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`赢得 ${this.lastWin} 筹码`, w / 2, y + 25);
    } else {
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '16px monospace';
      ctx.fillText(`${HAND_RANK_NAMES[this.handRank]}`, w / 2, y);
      ctx.fillStyle = '#888888';
      ctx.font = '13px monospace';
      ctx.fillText('再来一局!', w / 2, y + 22);
    }
  }

  /** 绘制圆角矩形辅助方法 */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  handleKeyDown(key: string): void {
    switch (key) {
      case '1': case '2': case '3': case '4': case '5':
        this.toggleHold(parseInt(key) - 1);
        break;
      case ' ':
      case 'Enter':
        if (this.phase === GamePhase.IDLE || this.phase === GamePhase.RESULT) {
          this.newRound();
          this.deal();
        } else if (this.phase === GamePhase.HOLDING) {
          this.draw();
        }
        break;
      case 'ArrowUp':
        this.adjustBet(1);
        break;
      case 'ArrowDown':
        this.adjustBet(-1);
        break;
    }
  }

  /** 鼠标点击：点击选牌或操作按钮 */
  handleClick(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') return;

    // 检测是否点击了 Deal/Draw 按钮
    const button = this.getDealDrawButton();
    if (button.enabled && this.isPointInRect(canvasX, canvasY, button)) {
      this.executeButtonAction(button.action);
      return;
    }

    // 检测是否点击了下注调整按钮
    const betButtons = this.getBetButtons();
    for (const btn of betButtons) {
      if (btn.enabled && this.isPointInRect(canvasX, canvasY, btn)) {
        this.executeButtonAction(btn.action);
        return;
      }
    }

    // 检测是否点击了手牌（仅在 HOLDING 阶段）
    if (this.phase === GamePhase.HOLDING) {
      const cardIndex = this.getCardIndexAtPoint(canvasX, canvasY);
      if (cardIndex >= 0) {
        this.toggleHold(cardIndex);
      }
    }
  }

  /** 鼠标移动：更新悬停状态 */
  handleMouseMove(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') return;

    // 检测悬停在 Deal/Draw 按钮上
    const button = this.getDealDrawButton();
    if (this.isPointInRect(canvasX, canvasY, button)) {
      this._hoveredButton = button.action;
      this._hoveredCardIndex = -1;
      return;
    }

    // 检测悬停在下注调整按钮上
    const betButtons = this.getBetButtons();
    for (const btn of betButtons) {
      if (this.isPointInRect(canvasX, canvasY, btn)) {
        this._hoveredButton = btn.action;
        this._hoveredCardIndex = -1;
        return;
      }
    }

    this._hoveredButton = null;
    // 检测悬停在牌上
    this._hoveredCardIndex = this.getCardIndexAtPoint(canvasX, canvasY);
  }

  handleKeyUp(_key: string): void {
    // Video Poker 不需要 keyUp 处理
  }

  getState(): Record<string, unknown> {
    return {
      phase: this.phase,
      hand: this.hand,
      held: this.held,
      credits: this.credits,
      bet: this.bet,
      lastWin: this.lastWin,
      handRank: this.handRank,
      deckSize: this.deck.length,
    } as VideoPokerState & { deckSize: number };
  }

  // ========== 公开访问器（供测试使用） ==========

  getPhase(): GamePhase { return this.phase; }
  getCredits(): number { return this.credits; }
  getBet(): number { return this.bet; }
  getLastWin(): number { return this.lastWin; }
  getHandRank(): HandRank | null { return this.handRank; }
  getHand(): (Card | null)[] { return [...this.hand]; }
  getHeld(): boolean[] { return [...this.held]; }
  getDeck(): Card[] { return [...this.deck]; }
  getDeckSize(): number { return this.deck.length; }

  /** 设置筹码（供测试使用） */
  setCredits(credits: number): void { this.credits = credits; }

  /** 强制设置阶段（供测试使用） */
  setPhase(phase: GamePhase): void { this.phase = phase; }

  /** 强制设置手牌（供测试使用） */
  setHand(cards: (Card | null)[]): void {
    this.hand = [...cards];
    while (this.hand.length < HAND_SIZE) {
      this.hand.push(null);
    }
  }

  /** 强制设置保留状态（供测试使用） */
  setHeld(held: boolean[]): void {
    this.held = [...held];
    while (this.held.length < HAND_SIZE) {
      this.held.push(false);
    }
  }

  /** 设置牌组（供测试使用，控制发牌顺序） */
  setDeck(deck: Card[]): void {
    this.deck = [...deck];
  }
}
