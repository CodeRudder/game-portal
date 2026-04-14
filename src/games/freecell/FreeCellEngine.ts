import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CARD_WIDTH,
  CARD_HEIGHT,
  CARD_GAP,
  TOP_ROW_Y,
  TABLEAU_Y,
  FREECELL_X_START,
  FREECELL_GAP,
  FOUNDATION_X_START,
  FOUNDATION_GAP,
  TABLEAU_X_START,
  TABLEAU_GAP,
  TABLEAU_OVERLAP,
  BG_COLOR,
  CARD_FACE_COLOR,
  CARD_BORDER_COLOR,
  CARD_SELECTED_COLOR,
  RED_SUIT_COLOR,
  BLACK_SUIT_COLOR,
  EMPTY_SLOT_COLOR,
  EMPTY_SLOT_BORDER,
  HUD_COLOR,
  WIN_COLOR,
  CURSOR_COLOR,
  SUITS,
  RANKS,
  Area,
  type Card,
  type Suit,
  type Rank,
  createDeck,
  shuffleDeck,
  rankValue,
  isRedSuit,
  isOppositeColor,
  suitSymbol,
  foundationIndex,
  isValidSequence,
  maxMovableCards,
  SCORE_FOUNDATION,
  SCORE_MOVE_TO_FREECELL,
  SCORE_MOVE_FROM_FREECELL,
  SCORE_AUTO_COMPLETE,
} from './constants';

// ========== 游戏状态接口 ==========
export interface FreeCellState {
  tableau: Card[][];       // 8列牌
  freeCells: (Card | null)[]; // 4个自由单元格
  foundations: (Card | null)[][];  // 4个基础堆（每堆可能为空或有多张已排序的牌）
  selected: { area: Area; index: number; cardIndex?: number } | null;
  cursor: { area: Area; index: number; cardIndex?: number };
  moveCount: number;
  isWin: boolean;
  seed: number;
}

export class FreeCellEngine extends GameEngine {
  // 游戏数据
  private tableau: Card[][] = [];
  private freeCells: (Card | null)[] = [null, null, null, null];
  private foundations: Card[][] = [[], [], [], []];

  // 选择状态
  private selected: { area: Area; index: number; cardIndex?: number } | null = null;

  // 光标状态
  private cursor: { area: Area; index: number; cardIndex?: number } = {
    area: Area.TABLEAU,
    index: 0,
    cardIndex: 0,
  };

  // 统计
  private moveCount = 0;
  private _isWin = false;
  private seed = 0;

  // 公开属性
  get isWin(): boolean { return this._isWin; }

  // ========== 生命周期方法 ==========

  protected onInit(): void {
    this.dealCards();
  }

  protected onStart(): void {
    this.dealCards();
  }

  protected update(_deltaTime: number): void {
    // 检查自动完成
    if (this._status === 'playing' && !this._isWin) {
      this.tryAutoComplete();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    this.renderFreeCellSlots(ctx);
    this.renderFoundationSlots(ctx);
    this.renderFreeCellCards(ctx);
    this.renderFoundationCards(ctx);
    this.renderTableau(ctx);
    this.renderCursor(ctx);
    this.renderHUD(ctx);

    if (this._isWin) {
      this.renderWin(ctx, w, h);
    }
  }

  protected onReset(): void {
    this.selected = null;
    this.cursor = { area: Area.TABLEAU, index: 0, cardIndex: 0 };
    this.moveCount = 0;
    this._isWin = false;
    this.dealCards();
  }

  protected onPause(): void {}
  protected onResume(): void {}
  protected onDestroy(): void {}
  protected onGameOver(): void {}

  // ========== 牌组操作 ==========

  /** 洗牌并发牌 */
  private dealCards(): void {
    const deck = shuffleDeck(createDeck());
    this.tableau = Array.from({ length: 8 }, () => []);
    this.freeCells = [null, null, null, null];
    this.foundations = [[], [], [], []];
    this.selected = null;
    this.moveCount = 0;
    this._isWin = false;

    // 前4列7张，后4列6张
    for (let i = 0; i < 52; i++) {
      this.tableau[i % 8].push(deck[i]);
    }

    // 更新光标 cardIndex
    this.updateCursorCardIndex();
  }

  /** 使用指定种子发牌（用于测试/重复游戏） */
  dealWithSeed(seed: number): void {
    this.seed = seed;
    // 使用简单的伪随机数生成器
    const deck = createDeck();
    const shuffled = this.seededShuffle(deck, seed);
    this.tableau = Array.from({ length: 8 }, () => []);
    this.freeCells = [null, null, null, null];
    this.foundations = [[], [], [], []];
    this.selected = null;
    this.moveCount = 0;
    this._isWin = false;

    for (let i = 0; i < 52; i++) {
      this.tableau[i % 8].push(shuffled[i]);
    }
    this.updateCursorCardIndex();
  }

  /** 伪随机洗牌 */
  private seededShuffle(deck: Card[], seed: number): Card[] {
    const shuffled = [...deck];
    let s = seed;
    for (let i = shuffled.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ========== 游戏逻辑 ==========

  /** 获取空闲自由单元格数量 */
  getEmptyFreeCellCount(): number {
    return this.freeCells.filter(c => c === null).length;
  }

  /** 获取空列数量 */
  getEmptyColumnCount(): number {
    return this.tableau.filter(col => col.length === 0).length;
  }

  /** 获取基础堆顶牌 */
  getFoundationTop(fIndex: number): Card | null {
    const pile = this.foundations[fIndex];
    return pile.length > 0 ? pile[pile.length - 1] : null;
  }

  /** 检查是否可以放到基础堆 */
  canMoveToFoundation(card: Card, fIndex: number): boolean {
    const top = this.getFoundationTop(fIndex);
    if (top === null) {
      // 只能放 A，且基础堆索引必须匹配花色
      return card.rank === 'A' && foundationIndex(card.suit) === fIndex;
    }
    // 必须同花色，且比顶牌大1
    return card.suit === top.suit && rankValue(card.rank) === rankValue(top.rank) + 1;
  }

  /** 检查是否可以放到列 */
  canMoveToTableau(card: Card, colIndex: number): boolean {
    const col = this.tableau[colIndex];
    if (col.length === 0) return true; // 空列可以放任何牌
    const topCard = col[col.length - 1];
    return isOppositeColor(card.suit, topCard.suit) && rankValue(card.rank) === rankValue(topCard.rank) - 1;
  }

  /** 检查列底部的有效序列长度 */
  getSequenceLength(colIndex: number): number {
    const col = this.tableau[colIndex];
    if (col.length === 0) return 0;
    let len = 1;
    for (let i = col.length - 2; i >= 0; i--) {
      const prev = col[i];
      const curr = col[i + 1];
      if (isOppositeColor(prev.suit, curr.suit) && rankValue(prev.rank) === rankValue(curr.rank) + 1) {
        len++;
      } else {
        break;
      }
    }
    return len;
  }

  /** 获取列中从指定位置开始的序列 */
  getSequenceFrom(colIndex: number, cardIndex: number): Card[] {
    const col = this.tableau[colIndex];
    if (cardIndex >= col.length) return [];
    const seq = col.slice(cardIndex);
    return isValidSequence(seq) ? seq : [];
  }

  /** 计算可移动的最大牌数 */
  getMaxMovable(isToEmpty: boolean): number {
    const emptyFreeCells = this.getEmptyFreeCellCount();
    const emptyColumns = this.getEmptyColumnCount();
    return maxMovableCards(emptyFreeCells, emptyColumns, isToEmpty);
  }

  /** 移动牌到基础堆 */
  moveToFoundation(card: Card, fromArea: Area, fromIndex: number): boolean {
    const fIndex = foundationIndex(card.suit);
    if (!this.canMoveToFoundation(card, fIndex)) return false;

    // 从来源移除
    if (fromArea === Area.TABLEAU) {
      const col = this.tableau[fromIndex];
      if (col.length === 0 || col[col.length - 1] !== card) return false;
      col.pop();
    } else if (fromArea === Area.FREECELL) {
      if (this.freeCells[fromIndex] !== card) return false;
      this.freeCells[fromIndex] = null;
    } else {
      return false;
    }

    this.foundations[fIndex].push(card);
    this.moveCount++;
    this.addScore(SCORE_FOUNDATION);
    this.emit('stateChange');
    this.checkWin();
    return true;
  }

  /** 移动牌到自由单元格 */
  moveToFreeCell(card: Card, fromArea: Area, fromIndex: number, toIndex: number): boolean {
    if (this.freeCells[toIndex] !== null) return false;

    // 从来源移除
    if (fromArea === Area.TABLEAU) {
      const col = this.tableau[fromIndex];
      if (col.length === 0 || col[col.length - 1] !== card) return false;
      col.pop();
    } else if (fromArea === Area.FREECELL) {
      if (this.freeCells[fromIndex] !== card) return false;
      this.freeCells[fromIndex] = null;
    } else {
      return false;
    }

    this.freeCells[toIndex] = card;
    this.moveCount++;
    this.addScore(SCORE_MOVE_TO_FREECELL);
    this.emit('stateChange');
    return true;
  }

  /** 移动序列到列 */
  moveSequenceToTableau(
    cards: Card[],
    fromArea: Area,
    fromIndex: number,
    fromCardIndex: number,
    toColIndex: number
  ): boolean {
    if (cards.length === 0) return false;
    if (!isValidSequence(cards)) return false;

    const isToEmpty = this.tableau[toColIndex].length === 0;
    const maxCards = this.getMaxMovable(isToEmpty);
    if (cards.length > maxCards) return false;

    // 检查目标列是否可以接收
    const bottomCard = cards[0];
    if (!this.canMoveToTableau(bottomCard, toColIndex)) return false;

    // 从来源移除
    if (fromArea === Area.TABLEAU) {
      this.tableau[fromIndex].splice(fromCardIndex);
    } else if (fromArea === Area.FREECELL) {
      if (cards.length !== 1) return false; // 自由单元格只能移1张
      this.freeCells[fromIndex] = null;
    } else {
      return false;
    }

    // 添加到目标列
    this.tableau[toColIndex].push(...cards);
    this.moveCount++;

    if (fromArea === Area.FREECELL) {
      this.addScore(SCORE_MOVE_FROM_FREECELL);
    }
    this.emit('stateChange');
    return true;
  }

  /** 尝试自动将可以放到基础堆的牌移动 */
  tryAutoMoveToFoundation(card: Card, fromArea: Area, fromIndex: number): boolean {
    const fIndex = foundationIndex(card.suit);
    if (!this.canMoveToFoundation(card, fIndex)) return false;

    // 安全检查：只有当所有比它小的异色牌都已经在基础堆时才自动移动
    if (!this.isSafeAutoMove(card)) return false;

    return this.moveToFoundation(card, fromArea, fromIndex);
  }

  /** 安全自动移动检查 */
  private isSafeAutoMove(card: Card): boolean {
    const value = rankValue(card.rank);
    // A 和 2 总是安全的
    if (value <= 2) return true;

    // 检查所有异色花色的基础堆顶部值是否 >= value - 1
    for (const suit of SUITS) {
      if (isOppositeColor(suit, card.suit)) {
        const fIdx = foundationIndex(suit);
        const top = this.getFoundationTop(fIdx);
        const topValue = top ? rankValue(top.rank) : 0;
        if (topValue < value - 1) return false;
      }
    }
    return true;
  }

  /** 自动完成：当所有牌已排好序时自动移到基础堆 */
  tryAutoComplete(): void {
    let moved = true;
    while (moved) {
      moved = false;
      // 检查列顶牌
      for (let i = 0; i < 8; i++) {
        const col = this.tableau[i];
        if (col.length === 0) continue;
        const topCard = col[col.length - 1];
        if (this.isSafeAutoMove(topCard)) {
          if (this.moveToFoundation(topCard, Area.TABLEAU, i)) {
            moved = true;
          }
        }
      }
      // 检查自由单元格
      for (let i = 0; i < 4; i++) {
        const card = this.freeCells[i];
        if (card && this.isSafeAutoMove(card)) {
          if (this.moveToFoundation(card, Area.FREECELL, i)) {
            moved = true;
          }
        }
      }
    }
  }

  /** 强制自动完成所有可移到基础堆的牌（按 A 键触发） */
  autoCompleteAll(): void {
    let moved = true;
    while (moved) {
      moved = false;
      // 检查列顶牌
      for (let i = 0; i < 8; i++) {
        const col = this.tableau[i];
        if (col.length === 0) continue;
        const topCard = col[col.length - 1];
        const fIndex = foundationIndex(topCard.suit);
        if (this.canMoveToFoundation(topCard, fIndex)) {
          if (this.moveToFoundation(topCard, Area.TABLEAU, i)) {
            moved = true;
          }
        }
      }
      // 检查自由单元格
      for (let i = 0; i < 4; i++) {
        const card = this.freeCells[i];
        if (card) {
          const fIndex = foundationIndex(card.suit);
          if (this.canMoveToFoundation(card, fIndex)) {
            if (this.moveToFoundation(card, Area.FREECELL, i)) {
              moved = true;
            }
          }
        }
      }
    }
  }

  /** 检查胜利 */
  private checkWin(): void {
    const totalInFoundation = this.foundations.reduce((sum, pile) => sum + pile.length, 0);
    if (totalInFoundation === 52) {
      this._isWin = true;
      this.addScore(SCORE_AUTO_COMPLETE * 52);
      this.gameOver();
    }
  }

  /** 检查是否还有可用移动 */
  hasValidMoves(): boolean {
    // 检查每个列顶牌是否可以移到基础堆或自由单元格
    for (let i = 0; i < 8; i++) {
      const col = this.tableau[i];
      if (col.length === 0) continue;
      const topCard = col[col.length - 1];

      // 能移到基础堆？
      const fIndex = foundationIndex(topCard.suit);
      if (this.canMoveToFoundation(topCard, fIndex)) return true;

      // 能移到自由单元格？
      if (this.getEmptyFreeCellCount() > 0) return true;

      // 能移到其他列？
      for (let j = 0; j < 8; j++) {
        if (j === i) continue;
        if (this.canMoveToTableau(topCard, j)) return true;
      }
    }

    // 检查自由单元格中的牌
    for (let i = 0; i < 4; i++) {
      const card = this.freeCells[i];
      if (!card) continue;

      // 能移到基础堆？
      const fIndex = foundationIndex(card.suit);
      if (this.canMoveToFoundation(card, fIndex)) return true;

      // 能移到列？
      for (let j = 0; j < 8; j++) {
        if (this.canMoveToTableau(card, j)) return true;
      }
    }

    return false;
  }

  // ========== 选择与放置 ==========

  /** 选择/放置操作 */
  handleSelect(): void {
    if (this._status !== 'playing') return;

    const { area, index, cardIndex } = this.cursor;

    if (this.selected === null) {
      // 选择牌
      this.selectCard(area, index, cardIndex);
    } else {
      // 尝试放置
      this.placeCard(area, index);
    }
  }

  /** 选择牌 */
  private selectCard(area: Area, index: number, cardIndex?: number): void {
    if (area === Area.TABLEAU) {
      const col = this.tableau[index];
      if (col.length === 0) return;

      // 确定从哪里开始选择
      const ci = cardIndex ?? col.length - 1;
      if (ci < 0 || ci >= col.length) return;

      // 检查从 ci 到底部是否形成有效序列
      const seq = col.slice(ci);
      if (!isValidSequence(seq)) return;

      this.selected = { area, index, cardIndex: ci };
    } else if (area === Area.FREECELL) {
      const card = this.freeCells[index];
      if (card === null) return;
      this.selected = { area, index };
    } else if (area === Area.FOUNDATION) {
      const pile = this.foundations[index];
      if (pile.length === 0) return;
      this.selected = { area, index };
    }
  }

  /** 放置牌 */
  private placeCard(area: Area, index: number): void {
    const sel = this.selected;
    if (!sel) return;

    let success = false;

    if (area === Area.FOUNDATION) {
      // 放到基础堆
      success = this.placeOnFoundation(sel, index);
    } else if (area === Area.FREECELL) {
      // 放到自由单元格
      success = this.placeOnFreeCell(sel, index);
    } else if (area === Area.TABLEAU) {
      // 放到列
      success = this.placeOnTableau(sel, index);
    }

    this.selected = null;
    if (success) {
      this.updateCursorCardIndex();
    }
  }

  /** 放置到基础堆 */
  private placeOnFoundation(sel: NonNullable<FreeCellState['selected']>, fIndex: number): boolean {
    let card: Card;
    if (sel.area === Area.TABLEAU) {
      const col = this.tableau[sel.index];
      if (sel.cardIndex !== undefined && sel.cardIndex !== col.length - 1) return false; // 只能移单张到基础堆
      card = col[col.length - 1];
    } else if (sel.area === Area.FREECELL) {
      const c = this.freeCells[sel.index];
      if (!c) return false;
      card = c;
    } else {
      return false;
    }

    return this.moveToFoundation(card, sel.area, sel.index);
  }

  /** 放置到自由单元格 */
  private placeOnFreeCell(sel: NonNullable<FreeCellState['selected']>, fcIndex: number): boolean {
    if (this.freeCells[fcIndex] !== null) return false;

    let card: Card;
    if (sel.area === Area.TABLEAU) {
      const col = this.tableau[sel.index];
      if (sel.cardIndex !== undefined && sel.cardIndex !== col.length - 1) return false; // 只能移单张
      card = col[col.length - 1];
    } else if (sel.area === Area.FREECELL) {
      const c = this.freeCells[sel.index];
      if (!c) return false;
      card = c;
    } else {
      return false;
    }

    return this.moveToFreeCell(card, sel.area, sel.index, fcIndex);
  }

  /** 放置到列 */
  private placeOnTableau(sel: NonNullable<FreeCellState['selected']>, colIndex: number): boolean {
    if (sel.area === Area.TABLEAU && sel.index === colIndex) return false; // 不能放回原位

    let cards: Card[];
    let fromCardIndex: number;

    if (sel.area === Area.TABLEAU) {
      const col = this.tableau[sel.index];
      fromCardIndex = sel.cardIndex ?? col.length - 1;
      cards = col.slice(fromCardIndex);
    } else if (sel.area === Area.FREECELL) {
      const c = this.freeCells[sel.index];
      if (!c) return false;
      cards = [c];
      fromCardIndex = 0;
    } else {
      return false;
    }

    return this.moveSequenceToTableau(cards, sel.area, sel.index, fromCardIndex, colIndex);
  }

  // ========== 键盘控制 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

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
        this.handleSelect();
        break;
      case 'a':
      case 'A':
        this.autoCompleteAll();
        break;
      case 'Escape':
        this.selected = null;
        break;
      case '1':
      case '2':
      case '3':
      case '4': {
        const fIndex = parseInt(key) - 1;
        if (this.selected) {
          this.placeCard(Area.FOUNDATION, fIndex);
          this.selected = null;
        } else {
          // 快速移当前光标处的牌到基础堆
          this.quickMoveToFoundation(fIndex);
        }
        break;
      }
    }
  }

  handleKeyUp(_key: string): void {
    // FreeCell 不需要 keyUp 逻辑
  }

  /** 快速移动光标处的牌到基础堆 */
  private quickMoveToFoundation(fIndex: number): void {
    const { area, index } = this.cursor;
    let card: Card | null = null;

    if (area === Area.TABLEAU) {
      const col = this.tableau[index];
      if (col.length > 0) card = col[col.length - 1];
    } else if (area === Area.FREECELL) {
      card = this.freeCells[index];
    }

    if (card) {
      this.moveToFoundation(card, area, index);
      this.updateCursorCardIndex();
    }
  }

  // ========== 光标导航 ==========

  private moveCursorUp(): void {
    const { area, index } = this.cursor;
    if (area === Area.TABLEAU) {
      const col = this.tableau[index];
      const ci = this.cursor.cardIndex ?? col.length - 1;
      if (ci > 0) {
        this.cursor.cardIndex = ci - 1;
      } else {
        // 移到自由单元格/基础堆
        this.cursor = { area: Area.FREECELL, index: Math.min(index, 3) };
      }
    }
  }

  private moveCursorDown(): void {
    const { area, index } = this.cursor;
    if (area === Area.FREECELL || area === Area.FOUNDATION) {
      this.cursor = { area: Area.TABLEAU, index: Math.min(index, 7), cardIndex: 0 };
      this.updateCursorCardIndex();
    } else if (area === Area.TABLEAU) {
      const col = this.tableau[index];
      const ci = this.cursor.cardIndex ?? 0;
      if (ci < col.length - 1) {
        this.cursor.cardIndex = ci + 1;
      }
    }
  }

  private moveCursorLeft(): void {
    const { area, index } = this.cursor;
    if (area === Area.TABLEAU) {
      if (index > 0) {
        this.cursor = { area: Area.TABLEAU, index: index - 1 };
        this.updateCursorCardIndex();
      }
    } else if (area === Area.FOUNDATION) {
      if (index > 0) {
        this.cursor = { area: Area.FOUNDATION, index: index - 1 };
      } else {
        // 移到自由单元格最右边
        this.cursor = { area: Area.FREECELL, index: 3 };
      }
    } else if (area === Area.FREECELL) {
      if (index > 0) {
        this.cursor = { area: Area.FREECELL, index: index - 1 };
      }
    }
  }

  private moveCursorRight(): void {
    const { area, index } = this.cursor;
    if (area === Area.TABLEAU) {
      if (index < 7) {
        this.cursor = { area: Area.TABLEAU, index: index + 1 };
        this.updateCursorCardIndex();
      }
    } else if (area === Area.FREECELL) {
      if (index < 3) {
        this.cursor = { area: Area.FREECELL, index: index + 1 };
      } else {
        // 移到基础堆最左边
        this.cursor = { area: Area.FOUNDATION, index: 0 };
      }
    } else if (area === Area.FOUNDATION) {
      if (index < 3) {
        this.cursor = { area: Area.FOUNDATION, index: index + 1 };
      }
    }
  }

  /** 更新光标的 cardIndex 使其在有效范围内 */
  private updateCursorCardIndex(): void {
    if (this.cursor.area === Area.TABLEAU) {
      const col = this.tableau[this.cursor.index];
      if (col.length === 0) {
        this.cursor.cardIndex = 0;
      } else {
        const ci = this.cursor.cardIndex ?? 0;
        this.cursor.cardIndex = Math.min(ci, col.length - 1);
      }
    }
  }

  // ========== 渲染方法 ==========

  private renderFreeCellSlots(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < 4; i++) {
      const x = FREECELL_X_START + i * FREECELL_GAP;
      this.renderEmptySlot(ctx, x, TOP_ROW_Y, 'FC');
    }
  }

  private renderFoundationSlots(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < 4; i++) {
      const x = FOUNDATION_X_START + i * FOUNDATION_GAP;
      const symbol = suitSymbol(SUITS[i]);
      this.renderEmptySlot(ctx, x, TOP_ROW_Y, symbol);
    }
  }

  private renderEmptySlot(ctx: CanvasRenderingContext2D, x: number, y: number, label: string): void {
    ctx.fillStyle = EMPTY_SLOT_COLOR;
    ctx.strokeStyle = EMPTY_SLOT_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
  }

  private renderFreeCellCards(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < 4; i++) {
      const card = this.freeCells[i];
      if (card) {
        const x = FREECELL_X_START + i * FREECELL_GAP;
        const isSelected = this.selected?.area === Area.FREECELL && this.selected?.index === i;
        this.renderCard(ctx, x, TOP_ROW_Y, card, isSelected);
      }
    }
  }

  private renderFoundationCards(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < 4; i++) {
      const pile = this.foundations[i];
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        const x = FOUNDATION_X_START + i * FOUNDATION_GAP;
        const isSelected = this.selected?.area === Area.FOUNDATION && this.selected?.index === i;
        this.renderCard(ctx, x, TOP_ROW_Y, topCard, isSelected);
      }
    }
  }

  private renderTableau(ctx: CanvasRenderingContext2D): void {
    for (let col = 0; col < 8; col++) {
      const x = TABLEAU_X_START + col * TABLEAU_GAP;
      const cards = this.tableau[col];

      if (cards.length === 0) {
        this.renderEmptySlot(ctx, x, TABLEAU_Y, '');
        continue;
      }

      for (let row = 0; row < cards.length; row++) {
        const y = TABLEAU_Y + row * TABLEAU_OVERLAP;
        const isSelected =
          this.selected?.area === Area.TABLEAU &&
          this.selected?.index === col &&
          this.selected?.cardIndex !== undefined &&
          row >= this.selected.cardIndex;
        this.renderCard(ctx, x, y, cards[row], isSelected);
      }
    }
  }

  private renderCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    card: Card,
    isSelected: boolean
  ): void {
    // 牌面背景
    ctx.fillStyle = isSelected ? CARD_SELECTED_COLOR : CARD_FACE_COLOR;
    ctx.strokeStyle = CARD_BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, 4);
    ctx.fill();
    ctx.stroke();

    // 花色颜色
    const color = isRedSuit(card.suit) ? RED_SUIT_COLOR : BLACK_SUIT_COLOR;
    ctx.fillStyle = color;

    // 左上角 - 牌面值
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(card.rank, x + 4, y + 3);

    // 左上角 - 花色符号
    ctx.font = '11px serif';
    ctx.fillText(suitSymbol(card.suit), x + 4, y + 17);

    // 中心大花色
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suitSymbol(card.suit), x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);

    // 右下角（倒置）
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(card.rank, x + CARD_WIDTH - 4, y + CARD_HEIGHT - 3);

    ctx.font = '11px serif';
    ctx.fillText(suitSymbol(card.suit), x + CARD_WIDTH - 4, y + CARD_HEIGHT - 17);
  }

  private renderCursor(ctx: CanvasRenderingContext2D): void {
    const { area, index, cardIndex } = this.cursor;
    let x: number, y: number;

    if (area === Area.FREECELL) {
      x = FREECELL_X_START + index * FREECELL_GAP;
      y = TOP_ROW_Y;
    } else if (area === Area.FOUNDATION) {
      x = FOUNDATION_X_START + index * FOUNDATION_GAP;
      y = TOP_ROW_Y;
    } else {
      x = TABLEAU_X_START + index * TABLEAU_GAP;
      const col = this.tableau[index];
      const ci = cardIndex ?? (col.length > 0 ? col.length - 1 : 0);
      y = TABLEAU_Y + ci * TABLEAU_OVERLAP;
    }

    ctx.strokeStyle = CURSOR_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, CARD_WIDTH + 4, CARD_HEIGHT + 4, 6);
    ctx.stroke();
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = HUD_COLOR;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`移动: ${this.moveCount}`, 10, CANVAS_HEIGHT - 5);

    ctx.textAlign = 'right';
    const foundationCount = this.foundations.reduce((sum, pile) => sum + pile.length, 0);
    ctx.fillText(`完成: ${foundationCount}/52`, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 5);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px monospace';
    ctx.fillText('方向键导航 · 空格选择 · A 自动完成 · 1-4 基础堆', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 5);
  }

  private renderWin(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = WIN_COLOR;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎉 恭喜通关！', w / 2, h / 2 - 30);

    ctx.fillStyle = HUD_COLOR;
    ctx.font = '16px sans-serif';
    ctx.fillText(`移动次数: ${this.moveCount}`, w / 2, h / 2 + 20);
    ctx.fillText(`得分: ${this._score}`, w / 2, h / 2 + 50);
  }

  // ========== 状态序列化 ==========

  getState(): Record<string, unknown> {
    return {
      tableau: this.tableau.map(col => col.map(c => ({ suit: c.suit, rank: c.rank }))),
      freeCells: this.freeCells.map(c => c ? { suit: c.suit, rank: c.rank } : null),
      foundations: this.foundations.map(pile => pile.map(c => ({ suit: c.suit, rank: c.rank }))),
      selected: this.selected,
      cursor: this.cursor,
      moveCount: this.moveCount,
      isWin: this._isWin,
      score: this._score,
      seed: this.seed,
    } as FreeCellState;
  }

  // ========== 公开方法（供测试和外部调用） ==========

  /** 获取列 */
  getTableau(): Card[][] {
    return this.tableau;
  }

  /** 获取自由单元格 */
  getFreeCells(): (Card | null)[] {
    return this.freeCells;
  }

  /** 获取基础堆 */
  getFoundations(): Card[][] {
    return this.foundations;
  }

  /** 获取移动次数 */
  getMoveCount(): number {
    return this.moveCount;
  }

  /** 获取选择状态 */
  getSelected(): FreeCellState['selected'] {
    return this.selected;
  }

  /** 获取光标状态 */
  getCursor(): FreeCellState['cursor'] {
    return this.cursor;
  }

  /** 设置光标（测试用） */
  setCursor(area: Area, index: number, cardIndex?: number): void {
    this.cursor = { area, index, cardIndex };
  }

  /** 设置选择（测试用） */
  setSelected(sel: FreeCellState['selected']): void {
    this.selected = sel;
  }
}
