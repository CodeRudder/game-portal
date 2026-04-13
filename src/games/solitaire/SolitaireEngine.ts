import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  CARD_WIDTH, CARD_HEIGHT,
  CARD_GAP, TABLEAU_OVERLAP_FACE_DOWN, TABLEAU_OVERLAP_FACE_UP,
  TOP_ROW_Y, TABLEAU_Y,
  STOCK_X, WASTE_X,
  FOUNDATION_X_START, FOUNDATION_GAP,
  TABLEAU_X_START, TABLEAU_GAP,
  BG_COLOR, CARD_BACK_COLOR, CARD_BACK_PATTERN, CARD_FACE_COLOR,
  CARD_BORDER_COLOR, CARD_SELECTED_COLOR, RED_SUIT_COLOR, BLACK_SUIT_COLOR,
  EMPTY_SLOT_COLOR, HUD_COLOR, WIN_COLOR,
  SUITS, RANKS,
  SCORE_FLIP, SCORE_FOUNDATION, SCORE_FOUNDATION_BACK,
  rankValue, isRedSuit, suitSymbol,
  type Suit, type Rank,
} from './constants';

// ========== 牌的类型 ==========

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

// ========== 选择状态 ==========

export interface Selection {
  source: 'tableau' | 'waste' | 'foundation';
  col: number;       // tableau 列号(0-6) 或 foundation 列号(0-3)
  cardIndex: number; // 在列中的起始索引
}

// ========== 自动完成状态 ==========

type AutoCompletePhase = 'idle' | 'running' | 'done';

export class SolitaireEngine extends GameEngine {
  // 游戏区域
  private _stock: Card[] = [];
  private _waste: Card[] = [];
  private _foundations: Card[][] = [[], [], [], []];
  private _tableau: Card[][] = [[], [], [], [], [], [], []];

  // 选择状态
  private _selection: Selection | null = null;
  private _selectedCards: Card[] = [];

  // 光标
  private _cursorArea: 'stock' | 'waste' | 'foundation' | 'tableau' = 'stock';
  private _cursorCol: number = 0;
  private _cursorRow: number = 0; // tableau 中的行索引

  // 计数
  private _moves: number = 0;
  private _flipCount: number = 0;

  // 自动完成
  private _autoCompletePhase: AutoCompletePhase = 'idle';
  private _autoCompleteTimer: number = 0;

  // 胜利
  private _isWin: boolean = false;

  // ========== Public Getters ==========

  get stock(): Card[] { return this._stock; }
  get waste(): Card[] { return this._waste; }
  get foundations(): Card[][] { return this._foundations; }
  get tableau(): Card[][] { return this._tableau; }
  get selection(): Selection | null { return this._selection; }
  get selectedCards(): Card[] { return this._selectedCards; }
  get cursorArea(): string { return this._cursorArea; }
  get cursorCol(): number { return this._cursorCol; }
  get cursorRow(): number { return this._cursorRow; }
  get moves(): number { return this._moves; }
  get isWin(): boolean { return this._isWin; }
  get autoCompletePhase(): string { return this._autoCompletePhase; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this.resetState();
  }

  protected onStart(): void {
    this.resetState();
    this.createDeck();
    this.shuffleDeck();
    this.dealCards();
  }

  protected update(deltaTime: number): void {
    if (this._autoCompletePhase === 'running') {
      this._autoCompleteTimer += deltaTime;
      if (this._autoCompleteTimer >= 150) {
        this._autoCompleteTimer = 0;
        if (!this.autoCompleteStep()) {
          this._autoCompletePhase = 'done';
          this.checkWin();
        }
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Stock
    this.renderSlot(ctx, STOCK_X, TOP_ROW_Y);
    if (this._stock.length > 0) {
      this.renderCardBack(ctx, STOCK_X, TOP_ROW_Y, this._cursorArea === 'stock');
    } else {
      this.renderEmptySlot(ctx, STOCK_X, TOP_ROW_Y, '↻', this._cursorArea === 'stock');
    }

    // Waste
    this.renderSlot(ctx, WASTE_X, TOP_ROW_Y);
    if (this._waste.length > 0) {
      this.renderCardFace(ctx, this._waste[this._waste.length - 1], WASTE_X, TOP_ROW_Y,
        this._cursorArea === 'waste');
    }

    // Foundations
    for (let i = 0; i < 4; i++) {
      const fx = FOUNDATION_X_START + i * FOUNDATION_GAP;
      this.renderSlot(ctx, fx, TOP_ROW_Y);
      const pile = this._foundations[i];
      if (pile.length > 0) {
        this.renderCardFace(ctx, pile[pile.length - 1], fx, TOP_ROW_Y,
          this._cursorArea === 'foundation' && this._cursorCol === i);
      } else {
        this.renderEmptySlot(ctx, fx, TOP_ROW_Y, suitSymbol(SUITS[i]),
          this._cursorArea === 'foundation' && this._cursorCol === i);
      }
    }

    // Tableau
    for (let col = 0; col < 7; col++) {
      const tx = TABLEAU_X_START + col * TABLEAU_GAP;
      this.renderSlot(ctx, tx, TABLEAU_Y);
      const pile = this._tableau[col];
      if (pile.length === 0) {
        this.renderEmptySlot(ctx, tx, TABLEAU_Y, 'K',
          this._cursorArea === 'tableau' && this._cursorCol === col);
        continue;
      }
      let cy = TABLEAU_Y;
      for (let i = 0; i < pile.length; i++) {
        const card = pile[i];
        const isSelected = this._selection !== null
          && this._selection.source === 'tableau'
          && this._selection.col === col
          && i >= this._selection.cardIndex;
        const isCursor = this._cursorArea === 'tableau'
          && this._cursorCol === col
          && i === this._cursorRow;
        if (card.faceUp) {
          this.renderCardFace(ctx, card, tx, cy, isSelected || isCursor);
        } else {
          this.renderCardBack(ctx, tx, cy, false);
        }
        cy += card.faceUp ? TABLEAU_OVERLAP_FACE_UP : TABLEAU_OVERLAP_FACE_DOWN;
      }
    }

    // HUD: 分数和移动次数
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${this._score}  Moves: ${this._moves}`, w - 10, CANVAS_HEIGHT - 10);
    ctx.textAlign = 'left';

    // 胜利画面
    if (this._isWin) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = WIN_COLOR;
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('YOU WIN!', w / 2, h / 2 - 20);
      ctx.font = '20px monospace';
      ctx.fillStyle = HUD_COLOR;
      ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 30);
      ctx.fillText('Press R to restart', w / 2, h / 2 + 60);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this.resetState();
  }

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    if (this._isWin) {
      if (key === 'r' || key === 'R') {
        this.reset();
        this.start();
      }
      return;
    }

    switch (key) {
      case ' ':
        this.handleSpace();
        break;
      case 'ArrowUp':
        this.handleArrowUp();
        break;
      case 'ArrowDown':
        this.handleArrowDown();
        break;
      case 'ArrowLeft':
        this.handleArrowLeft();
        break;
      case 'ArrowRight':
        this.handleArrowRight();
        break;
      case 'Enter':
        this.handleEnter();
        break;
      case 'Escape':
        this.handleEscape();
        break;
      case 'a':
      case 'A':
        this.tryAutoComplete();
        break;
      case 'r':
      case 'R':
        if (this._status === 'idle') {
          this.start();
        } else {
          this.reset();
          this.start();
        }
        break;
      default:
        // 数字键 1-7 选择 tableau 列
        if (key >= '1' && key <= '7') {
          this._cursorArea = 'tableau';
          this._cursorCol = parseInt(key) - 1;
          this._cursorRow = this.getDefaultCursorRow(this._cursorCol);
        }
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // Solitaire 不需要持续按键
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      moves: this._moves,
      stockCount: this._stock.length,
      wasteCount: this._waste.length,
      foundationCounts: this._foundations.map(f => f.length),
      tableauCounts: this._tableau.map(t => t.length),
      selection: this._selection,
      cursorArea: this._cursorArea,
      cursorCol: this._cursorCol,
      cursorRow: this._cursorRow,
      isWin: this._isWin,
    };
  }

  // ========== Game Logic ==========

  /** 创建一副标准52张牌 */
  private createDeck(): void {
    this._stock = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this._stock.push({ suit, rank, faceUp: false });
      }
    }
  }

  /** 洗牌 (Fisher-Yates) */
  private shuffleDeck(): void {
    for (let i = this._stock.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._stock[i], this._stock[j]] = [this._stock[j], this._stock[i]];
    }
  }

  /** 发牌：Klondike 标准发牌 */
  private dealCards(): void {
    this._tableau = [[], [], [], [], [], [], []];
    this._waste = [];
    this._foundations = [[], [], [], []];

    // 发到 tableau：第 i 列发 i+1 张，最上面一张面朝上
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = this._stock.pop()!;
        if (row === col) {
          card.faceUp = true;
        }
        this._tableau[col].push(card);
      }
    }
    // 剩余牌留在 stock
  }

  /** 重置所有状态 */
  private resetState(): void {
    this._stock = [];
    this._waste = [];
    this._foundations = [[], [], [], []];
    this._tableau = [[], [], [], [], [], [], []];
    this._selection = null;
    this._selectedCards = [];
    this._cursorArea = 'stock';
    this._cursorCol = 0;
    this._cursorRow = 0;
    this._moves = 0;
    this._flipCount = 0;
    this._autoCompletePhase = 'idle';
    this._autoCompleteTimer = 0;
    this._isWin = false;
  }

  /** 空格键：翻 stock / 取消选择 */
  private handleSpace(): void {
    if (this._status === 'idle') {
      this.start();
      return;
    }

    if (this._selection) {
      this.clearSelection();
      return;
    }

    if (this._cursorArea === 'stock') {
      this.drawFromStock();
    }
  }

  /** 从 stock 翻牌 */
  drawFromStock(): void {
    if (this._stock.length === 0) {
      // 回收 waste 到 stock
      if (this._waste.length > 0) {
        this._stock = this._waste.reverse();
        this._stock.forEach(c => c.faceUp = false);
        this._waste = [];
      }
      return;
    }
    const card = this._stock.pop()!;
    card.faceUp = true;
    this._waste.push(card);
    this._flipCount++;
    this.addScore(SCORE_FLIP);
    this._moves++;
  }

  /** Enter 键：选择 / 放置 */
  private handleEnter(): void {
    if (this._status !== 'playing') return;

    if (this._selection) {
      this.tryPlaceSelection();
    } else {
      this.tryPickUp();
    }
  }

  /** 尝试拾取当前光标位置的牌 */
  private tryPickUp(): void {
    switch (this._cursorArea) {
      case 'waste':
        if (this._waste.length > 0) {
          this._selection = { source: 'waste', col: 0, cardIndex: this._waste.length - 1 };
          this._selectedCards = [this._waste[this._waste.length - 1]];
        }
        break;
      case 'foundation':
        if (this._foundations[this._cursorCol].length > 0) {
          const pile = this._foundations[this._cursorCol];
          this._selection = { source: 'foundation', col: this._cursorCol, cardIndex: pile.length - 1 };
          this._selectedCards = [pile[pile.length - 1]];
        }
        break;
      case 'tableau': {
        const pile = this._tableau[this._cursorCol];
        if (pile.length === 0) return;
        const row = Math.min(this._cursorRow, pile.length - 1);
        if (!pile[row].faceUp) return;
        this._selection = { source: 'tableau', col: this._cursorCol, cardIndex: row };
        this._selectedCards = pile.slice(row);
        break;
      }
    }
  }

  /** 尝试放置选中的牌 */
  private tryPlaceSelection(): void {
    if (!this._selection || this._selectedCards.length === 0) {
      this.clearSelection();
      return;
    }

    const firstCard = this._selectedCards[0];
    let placed = false;

    switch (this._cursorArea) {
      case 'foundation':
        if (this._selectedCards.length === 1) {
          placed = this.tryPlaceOnFoundation(firstCard, this._cursorCol);
        }
        break;
      case 'tableau':
        placed = this.tryPlaceOnTableau(firstCard, this._cursorCol);
        break;
      case 'waste':
        // 不能放到 waste
        break;
      case 'stock':
        // 不能放到 stock
        break;
    }

    if (placed) {
      this.removeCardsFromSource();
      this._moves++;
      this.flipTopTableauCard();
      this.clearSelection();
      this.checkWin();
    } else {
      this.clearSelection();
    }
  }

  /** 尝试放到 foundation */
  private tryPlaceOnFoundation(card: Card, foundIdx: number): boolean {
    const pile = this._foundations[foundIdx];
    if (pile.length === 0) {
      if (card.rank !== 'A') return false;
      pile.push(card);
      this.addScore(SCORE_FOUNDATION);
      return true;
    }
    const topCard = pile[pile.length - 1];
    if (card.suit === topCard.suit && rankValue(card.rank) === rankValue(topCard.rank) + 1) {
      pile.push(card);
      if (this._selection!.source === 'foundation') {
        this.addScore(SCORE_FOUNDATION_BACK);
      } else {
        this.addScore(SCORE_FOUNDATION);
      }
      return true;
    }
    return false;
  }

  /** 尝试放到 tableau */
  private tryPlaceOnTableau(card: Card, col: number): boolean {
    const pile = this._tableau[col];
    if (pile.length === 0) {
      if (card.rank !== 'K') return false;
      pile.push(card);
      // 从 foundation 移回不扣分（只有放到 foundation 再移回才扣分，这里不处理）
      return true;
    }
    const topCard = pile[pile.length - 1];
    if (!topCard.faceUp) return false;
    if (isRedSuit(card.suit) !== isRedSuit(topCard.suit)
      && rankValue(card.rank) === rankValue(topCard.rank) - 1) {
      pile.push(card);
      return true;
    }
    return false;
  }

  /** 从源位置移除已放置的牌 */
  private removeCardsFromSource(): void {
    if (!this._selection) return;
    const { source, col, cardIndex } = this._selection;

    switch (source) {
      case 'waste':
        this._waste.pop();
        break;
      case 'foundation':
        this._foundations[col].pop();
        break;
      case 'tableau':
        this._tableau[col].splice(cardIndex);
        break;
    }
  }

  /** 翻开 tableau 列最顶部的牌 */
  private flipTopTableauCard(): void {
    for (let col = 0; col < 7; col++) {
      const pile = this._tableau[col];
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        pile[pile.length - 1].faceUp = true;
        this._flipCount++;
        this.addScore(SCORE_FLIP);
      }
    }
  }

  /** 清除选择状态 */
  private clearSelection(): void {
    this._selection = null;
    this._selectedCards = [];
  }

  /** 检查是否胜利 */
  private checkWin(): void {
    const total = this._foundations.reduce((sum, f) => sum + f.length, 0);
    if (total === 52) {
      this._isWin = true;
      this.gameOver();
    }
  }

  /** 自动完成：检查是否所有牌面朝上 */
  private canAutoComplete(): boolean {
    if (this._stock.length > 0) return false;
    if (this._waste.length > 0) return true; // waste 牌都是面朝上的
    for (const pile of this._tableau) {
      for (const card of pile) {
        if (!card.faceUp) return false;
      }
    }
    return true;
  }

  /** 触发自动完成 */
  tryAutoComplete(): void {
    if (this._status !== 'playing') return;
    if (this._autoCompletePhase !== 'idle') return;
    if (!this.canAutoComplete()) return;
    this._autoCompletePhase = 'running';
    this._autoCompleteTimer = 0;
  }

  /** 自动完成一步 */
  private autoCompleteStep(): boolean {
    // 尝试从 waste 移到 foundation
    if (this._waste.length > 0) {
      const card = this._waste[this._waste.length - 1];
      const foundIdx = this.findFoundationTarget(card);
      if (foundIdx >= 0) {
        this._waste.pop();
        this._foundations[foundIdx].push(card);
        this.addScore(SCORE_FOUNDATION);
        this._moves++;
        return true;
      }
    }

    // 尝试从 tableau 移到 foundation
    for (let col = 0; col < 7; col++) {
      const pile = this._tableau[col];
      if (pile.length === 0) continue;
      const card = pile[pile.length - 1];
      if (!card.faceUp) continue;
      const foundIdx = this.findFoundationTarget(card);
      if (foundIdx >= 0) {
        pile.pop();
        this._foundations[foundIdx].push(card);
        this.addScore(SCORE_FOUNDATION);
        this._moves++;
        return true;
      }
    }

    return false;
  }

  /** 找到能放置牌的 foundation 索引 */
  private findFoundationTarget(card: Card): number {
    for (let i = 0; i < 4; i++) {
      const pile = this._foundations[i];
      if (pile.length === 0) {
        if (card.rank === 'A') return i;
      } else {
        const topCard = pile[pile.length - 1];
        if (card.suit === topCard.suit && rankValue(card.rank) === rankValue(topCard.rank) + 1) {
          return i;
        }
      }
    }
    return -1;
  }

  // ========== 光标移动 ==========

  private handleArrowUp(): void {
    if (this._cursorArea === 'tableau') {
      if (this._cursorRow > 0) {
        this._cursorRow--;
      } else {
        // 移到顶部行
        this._cursorArea = 'stock';
        this._cursorCol = 0;
        this._cursorRow = 0;
      }
    } else if (this._cursorArea === 'foundation') {
      this._cursorArea = 'stock';
      this._cursorCol = 0;
    } else if (this._cursorArea === 'waste') {
      this._cursorArea = 'stock';
      this._cursorCol = 0;
    }
  }

  private handleArrowDown(): void {
    if (this._cursorArea === 'stock' || this._cursorArea === 'waste') {
      this._cursorArea = 'tableau';
      this._cursorCol = 0;
      this._cursorRow = this.getDefaultCursorRow(0);
    } else if (this._cursorArea === 'foundation') {
      this._cursorArea = 'tableau';
      this._cursorCol = this._cursorCol;
      this._cursorRow = this.getDefaultCursorRow(this._cursorCol);
    } else if (this._cursorArea === 'tableau') {
      const pile = this._tableau[this._cursorCol];
      if (pile.length > 0 && this._cursorRow < pile.length - 1) {
        this._cursorRow++;
      }
    }
  }

  private handleArrowLeft(): void {
    if (this._cursorArea === 'tableau') {
      if (this._cursorCol > 0) {
        this._cursorCol--;
        this._cursorRow = this.getDefaultCursorRow(this._cursorCol);
      }
    } else if (this._cursorArea === 'foundation') {
      if (this._cursorCol > 0) {
        this._cursorCol--;
      } else {
        this._cursorArea = 'waste';
      }
    } else if (this._cursorArea === 'waste') {
      this._cursorArea = 'stock';
    }
  }

  private handleArrowRight(): void {
    if (this._cursorArea === 'stock') {
      this._cursorArea = 'waste';
    } else if (this._cursorArea === 'waste') {
      this._cursorArea = 'foundation';
      this._cursorCol = 0;
    } else if (this._cursorArea === 'foundation') {
      if (this._cursorCol < 3) {
        this._cursorCol++;
      }
    } else if (this._cursorArea === 'tableau') {
      if (this._cursorCol < 6) {
        this._cursorCol++;
        this._cursorRow = this.getDefaultCursorRow(this._cursorCol);
      }
    }
  }

  private handleEscape(): void {
    if (this._selection) {
      this.clearSelection();
    }
  }

  /** 获取列的默认光标行（最后一张面朝上的牌） */
  private getDefaultCursorRow(col: number): number {
    const pile = this._tableau[col];
    if (pile.length === 0) return 0;
    // 找最后一张面朝上的牌
    for (let i = pile.length - 1; i >= 0; i--) {
      if (pile[i].faceUp) return i;
    }
    return 0;
  }

  // ========== 渲染辅助 ==========

  private renderSlot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = EMPTY_SLOT_COLOR;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, 4);
    ctx.fill();
  }

  private renderEmptySlot(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, highlight: boolean): void {
    this.renderSlot(ctx, x, y);
    if (highlight) {
      ctx.strokeStyle = CARD_SELECTED_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, 4);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private renderCardBack(ctx: CanvasRenderingContext2D, x: number, y: number, highlight: boolean): void {
    // 卡片背景
    ctx.fillStyle = highlight ? CARD_SELECTED_COLOR : CARD_BACK_COLOR;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, 4);
    ctx.fill();

    // 边框
    ctx.strokeStyle = CARD_BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, 4);
    ctx.stroke();

    // 内部图案
    ctx.fillStyle = CARD_BACK_PATTERN;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, CARD_WIDTH - 8, CARD_HEIGHT - 8, 2);
    ctx.fill();

    // 菱形图案
    ctx.fillStyle = CARD_BACK_COLOR;
    const cx = x + CARD_WIDTH / 2;
    const cy = y + CARD_HEIGHT / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx + 10, cy);
    ctx.lineTo(cx, cy + 15);
    ctx.lineTo(cx - 10, cy);
    ctx.closePath();
    ctx.fill();
  }

  private renderCardFace(ctx: CanvasRenderingContext2D, card: Card, x: number, y: number, highlight: boolean): void {
    // 选中高亮
    if (highlight) {
      ctx.fillStyle = CARD_SELECTED_COLOR;
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, CARD_WIDTH + 4, CARD_HEIGHT + 4, 5);
      ctx.fill();
    }

    // 卡片背景
    ctx.fillStyle = CARD_FACE_COLOR;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, 4);
    ctx.fill();

    // 边框
    ctx.strokeStyle = CARD_BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, 4);
    ctx.stroke();

    // 文字颜色
    const color = isRedSuit(card.suit) ? RED_SUIT_COLOR : BLACK_SUIT_COLOR;
    ctx.fillStyle = color;

    // 左上角 rank 和 suit
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(card.rank, x + 4, y + 16);
    ctx.font = '14px monospace';
    ctx.fillText(suitSymbol(card.suit), x + 4, y + 30);

    // 中央大花色
    ctx.font = '28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(suitSymbol(card.suit), x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2 + 8);

    // 右下角 rank（倒置）
    ctx.save();
    ctx.translate(x + CARD_WIDTH - 4, y + CARD_HEIGHT - 6);
    ctx.rotate(Math.PI);
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(card.rank, 0, 10);
    ctx.font = '14px monospace';
    ctx.fillText(suitSymbol(card.suit), 0, 24);
    ctx.restore();

    ctx.textAlign = 'left';
  }

  // ========== Public Helpers (for testing) ==========

  /** 获取指定 foundation 的顶部牌 */
  getFoundationTop(index: number): Card | undefined {
    const pile = this._foundations[index];
    return pile.length > 0 ? pile[pile.length - 1] : undefined;
  }

  /** 获取指定 tableau 列的顶部牌 */
  getTableauTop(col: number): Card | undefined {
    const pile = this._tableau[col];
    return pile.length > 0 ? pile[pile.length - 1] : undefined;
  }

  /** 获取 waste 顶部牌 */
  getWasteTop(): Card | undefined {
    return this._waste.length > 0 ? this._waste[this._waste.length - 1] : undefined;
  }

  /** 计算所有 foundation 中的牌数 */
  getTotalFoundationCards(): number {
    return this._foundations.reduce((sum, f) => sum + f.length, 0);
  }

  /** 计算所有面朝上的牌数（包括 waste + tableau 面朝上 + foundation） */
  getFaceUpCardCount(): number {
    let count = this._waste.length;
    for (const pile of this._tableau) {
      for (const card of pile) {
        if (card.faceUp) count++;
      }
    }
    count += this.getTotalFoundationCards();
    return count;
  }

  /** 计算所有面朝下的牌数 */
  getFaceDownCardCount(): number {
    let count = this._stock.length;
    for (const pile of this._tableau) {
      for (const card of pile) {
        if (!card.faceUp) count++;
      }
    }
    return count;
  }
}
