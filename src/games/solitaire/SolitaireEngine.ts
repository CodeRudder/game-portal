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
  CARD_BORDER_COLOR, CARD_SELECTED_COLOR, CARD_HOVER_COLOR, RED_SUIT_COLOR, BLACK_SUIT_COLOR,
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

  // 鼠标交互状态
  private _isDragging: boolean = false;
  private _dragCards: Card[] = [];
  private _dragSource: { area: string; col: number; row: number } | null = null;
  private _dragX: number = 0;
  private _dragY: number = 0;
  private _mouseSelection: { area: string; col: number; row: number } | null = null;
  private _hoverTarget: { area: string; col: number; row: number } | null = null;

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
      this.renderEmptySlot(ctx, STOCK_X, TOP_ROW_Y, '↻',
        this._cursorArea === 'stock',
        this._hoverTarget?.area === 'stock');
    }

    // Waste
    this.renderSlot(ctx, WASTE_X, TOP_ROW_Y);
    if (this._waste.length > 0) {
      const isWasteSelected = this._selection?.source === 'waste';
      const isWasteDragged = this._isDragging && this._dragSource?.area === 'waste';
      if (isWasteDragged) {
        // 拖拽中原位置的牌半透明
        ctx.globalAlpha = 0.3;
        this.renderCardFace(ctx, this._waste[this._waste.length - 1], WASTE_X, TOP_ROW_Y, false);
        ctx.globalAlpha = 1.0;
      } else {
        this.renderCardFace(ctx, this._waste[this._waste.length - 1], WASTE_X, TOP_ROW_Y,
          this._cursorArea === 'waste' || isWasteSelected,
          this._hoverTarget?.area === 'waste' && !isWasteSelected);
      }
    }

    // Foundations
    for (let i = 0; i < 4; i++) {
      const fx = FOUNDATION_X_START + i * FOUNDATION_GAP;
      this.renderSlot(ctx, fx, TOP_ROW_Y);
      const pile = this._foundations[i];
      const isFoundSelected = this._selection?.source === 'foundation' && this._selection?.col === i;
      const isFoundDragged = this._isDragging && this._dragSource?.area === 'foundation' && this._dragSource?.col === i;
      if (pile.length > 0) {
        if (isFoundDragged) {
          ctx.globalAlpha = 0.3;
          this.renderCardFace(ctx, pile[pile.length - 1], fx, TOP_ROW_Y, false);
          ctx.globalAlpha = 1.0;
        } else {
          this.renderCardFace(ctx, pile[pile.length - 1], fx, TOP_ROW_Y,
            (this._cursorArea === 'foundation' && this._cursorCol === i) || isFoundSelected,
            this._hoverTarget?.area === 'foundation' && this._hoverTarget?.col === i && !isFoundSelected);
        }
      } else {
        this.renderEmptySlot(ctx, fx, TOP_ROW_Y, suitSymbol(SUITS[i]),
          this._cursorArea === 'foundation' && this._cursorCol === i,
          this._hoverTarget?.area === 'foundation' && this._hoverTarget?.col === i);
      }
    }

    // Tableau
    for (let col = 0; col < 7; col++) {
      const tx = TABLEAU_X_START + col * TABLEAU_GAP;
      this.renderSlot(ctx, tx, TABLEAU_Y);
      const pile = this._tableau[col];
      if (pile.length === 0) {
        this.renderEmptySlot(ctx, tx, TABLEAU_Y, 'K',
          this._cursorArea === 'tableau' && this._cursorCol === col,
          this._hoverTarget?.area === 'tableau' && this._hoverTarget?.col === col);
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
        const isDraggedFrom = this._isDragging
          && this._dragSource?.area === 'tableau'
          && this._dragSource?.col === col
          && i >= (this._dragSource.row >= 0 ? this._dragSource.row : pile.length - 1);
        const isHovered = this._hoverTarget?.area === 'tableau'
          && this._hoverTarget?.col === col
          && this._hoverTarget?.row === i;

        if (isDraggedFrom) {
          ctx.globalAlpha = 0.3;
        }

        if (card.faceUp) {
          this.renderCardFace(ctx, card, tx, cy, isSelected || isCursor, isHovered && !isSelected);
        } else {
          this.renderCardBack(ctx, tx, cy, false);
        }

        if (isDraggedFrom) {
          ctx.globalAlpha = 1.0;
        }

        cy += card.faceUp ? TABLEAU_OVERLAP_FACE_UP : TABLEAU_OVERLAP_FACE_DOWN;
      }
    }

    // 拖拽中的牌渲染在最上层
    if (this._isDragging && this._dragCards.length > 0) {
      for (let i = 0; i < this._dragCards.length; i++) {
        const card = this._dragCards[i];
        this.renderCardFace(ctx, card, this._dragX, this._dragY + i * TABLEAU_OVERLAP_FACE_UP, true);
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

  // ========== 鼠标交互 ==========

  /** 命中检测：根据画布坐标判断点击了哪个区域 */
  private hitTest(canvasX: number, canvasY: number): { area: string; col: number; row: number } | null {
    // 1. 检查 stock 区域
    if (canvasX >= STOCK_X && canvasX < STOCK_X + CARD_WIDTH &&
        canvasY >= TOP_ROW_Y && canvasY < TOP_ROW_Y + CARD_HEIGHT) {
      return { area: 'stock', col: 0, row: 0 };
    }
    // 2. 检查 waste 区域
    if (canvasX >= WASTE_X && canvasX < WASTE_X + CARD_WIDTH &&
        canvasY >= TOP_ROW_Y && canvasY < TOP_ROW_Y + CARD_HEIGHT) {
      return { area: 'waste', col: 0, row: 0 };
    }
    // 3. 检查 foundation 区域 (4个)
    for (let i = 0; i < 4; i++) {
      const fx = FOUNDATION_X_START + i * FOUNDATION_GAP;
      if (canvasX >= fx && canvasX < fx + CARD_WIDTH &&
          canvasY >= TOP_ROW_Y && canvasY < TOP_ROW_Y + CARD_HEIGHT) {
        return { area: 'foundation', col: i, row: 0 };
      }
    }
    // 4. 检查 tableau 区域 (7列)
    if (canvasY >= TABLEAU_Y) {
      for (let col = 0; col < 7; col++) {
        const cx = TABLEAU_X_START + col * TABLEAU_GAP;
        if (canvasX >= cx && canvasX < cx + CARD_WIDTH) {
          const pile = this._tableau[col];
          // 从底部向上检查每张牌
          for (let i = pile.length - 1; i >= 0; i--) {
            const cy = TABLEAU_Y + i * (pile[i].faceUp ? TABLEAU_OVERLAP_FACE_UP : TABLEAU_OVERLAP_FACE_DOWN);
            if (canvasY >= cy && canvasY < cy + CARD_HEIGHT) {
              return { area: 'tableau', col, row: i };
            }
          }
          // 空列或列底部空白区域
          if (canvasY >= TABLEAU_Y && canvasY < TABLEAU_Y + CARD_HEIGHT) {
            return { area: 'tableau', col, row: -1 };
          }
        }
      }
    }
    return null;
  }

  /** 鼠标点击：选牌/放牌/翻牌 */
  handleClick(canvasX: number, canvasY: number): void {
    if (this._isWin || this._status !== 'playing') return;
    if (this._isDragging) return; // 拖拽中忽略 click

    const hit = this.hitTest(canvasX, canvasY);
    if (!hit) {
      // 点击空白区域取消选择
      this.clearSelection();
      this._mouseSelection = null;
      return;
    }

    // 如果已有选中牌（键盘或鼠标选的），尝试放置
    if (this._selection && this._selectedCards.length > 0) {
      this._cursorArea = hit.area as typeof this._cursorArea;
      this._cursorCol = hit.col;
      this._cursorRow = hit.row >= 0 ? hit.row : 0;
      this.tryPlaceSelection();
      this._mouseSelection = null;
      return;
    }

    // 没有选中牌，根据点击区域处理
    switch (hit.area) {
      case 'stock':
        this.drawFromStock();
        this._mouseSelection = null;
        break;
      case 'waste':
        if (this._waste.length > 0) {
          this._selection = { source: 'waste', col: 0, cardIndex: this._waste.length - 1 };
          this._selectedCards = [this._waste[this._waste.length - 1]];
          this._mouseSelection = hit;
        }
        break;
      case 'foundation': {
        const pile = this._foundations[hit.col];
        if (pile.length > 0) {
          this._selection = { source: 'foundation', col: hit.col, cardIndex: pile.length - 1 };
          this._selectedCards = [pile[pile.length - 1]];
          this._mouseSelection = hit;
        }
        break;
      }
      case 'tableau': {
        const pile = this._tableau[hit.col];
        if (pile.length === 0 || hit.row < 0) {
          this._mouseSelection = null;
          return;
        }
        const row = Math.min(hit.row, pile.length - 1);
        if (!pile[row].faceUp) {
          this._mouseSelection = null;
          return;
        }
        this._selection = { source: 'tableau', col: hit.col, cardIndex: row };
        this._selectedCards = pile.slice(row);
        this._mouseSelection = hit;
        break;
      }
    }
  }

  /** 鼠标双击：自动移到 foundation */
  handleDoubleClick(canvasX: number, canvasY: number): void {
    if (this._isWin || this._status !== 'playing') return;

    const hit = this.hitTest(canvasX, canvasY);
    if (!hit) return;

    let card: Card | null = null;
    let source: 'waste' | 'foundation' | 'tableau' | null = null;
    let sourceCol = 0;

    switch (hit.area) {
      case 'waste':
        if (this._waste.length > 0) {
          card = this._waste[this._waste.length - 1];
          source = 'waste';
        }
        break;
      case 'tableau': {
        const pile = this._tableau[hit.col];
        if (pile.length > 0 && hit.row >= 0) {
          const row = Math.min(hit.row, pile.length - 1);
          // 只有最顶部的牌才能双击移到 foundation
          if (row === pile.length - 1 && pile[row].faceUp) {
            card = pile[row];
            source = 'tableau';
            sourceCol = hit.col;
          }
        }
        break;
      }
      case 'freecell':
        // Solitaire 没有 freecell
        break;
    }

    if (!card || !source) return;

    // 找到能放置的 foundation
    const foundIdx = this.findFoundationTarget(card);
    if (foundIdx >= 0) {
      this._selection = { source, col: sourceCol, cardIndex: source === 'tableau' ? this._tableau[sourceCol].length - 1 : 0 };
      this._selectedCards = [card];
      this._cursorArea = 'foundation';
      this._cursorCol = foundIdx;
      this._cursorRow = 0;
      this.tryPlaceSelection();
    }

    this._mouseSelection = null;
  }

  /** 鼠标按下：开始拖拽 */
  handleMouseDown(canvasX: number, canvasY: number): void {
    if (this._isWin || this._status !== 'playing') return;

    const hit = this.hitTest(canvasX, canvasY);
    if (!hit) return;

    // 确定要拖拽的牌
    let cards: Card[] = [];
    let source: { area: string; col: number; row: number } | null = null;

    switch (hit.area) {
      case 'waste':
        if (this._waste.length > 0) {
          cards = [this._waste[this._waste.length - 1]];
          source = hit;
        }
        break;
      case 'foundation': {
        const pile = this._foundations[hit.col];
        if (pile.length > 0) {
          cards = [pile[pile.length - 1]];
          source = hit;
        }
        break;
      }
      case 'tableau': {
        const pile = this._tableau[hit.col];
        if (pile.length > 0 && hit.row >= 0) {
          const row = Math.min(hit.row, pile.length - 1);
          if (pile[row].faceUp) {
            cards = pile.slice(row);
            source = hit;
          }
        }
        break;
      }
      // stock 不支持拖拽
    }

    if (cards.length === 0 || !source) return;

    // 设置选择状态（用于渲染高亮）
    this._selection = {
      source: source.area as 'tableau' | 'waste' | 'foundation',
      col: source.col,
      cardIndex: source.area === 'tableau' ? Math.max(source.row, 0) : 0,
    };
    this._selectedCards = cards;
    this._mouseSelection = source;

    // 开始拖拽
    this._isDragging = true;
    this._dragCards = cards;
    this._dragSource = source;
    this._dragX = canvasX - CARD_WIDTH / 2;
    this._dragY = canvasY - CARD_HEIGHT / 2;
  }

  /** 鼠标移动：更新拖拽位置和悬停高亮 */
  handleMouseMove(canvasX: number, canvasY: number): void {
    // 更新悬停目标
    this._hoverTarget = this.hitTest(canvasX, canvasY);

    if (!this._isDragging) return;

    this._dragX = canvasX - CARD_WIDTH / 2;
    this._dragY = canvasY - CARD_HEIGHT / 2;
  }

  /** 鼠标松开：结束拖拽，尝试放置 */
  handleMouseUp(canvasX: number, canvasY: number): void {
    if (!this._isDragging) return;

    const hit = this.hitTest(canvasX, canvasY);

    if (hit && this._selection && this._selectedCards.length > 0) {
      // 设置光标到放下位置并尝试放置
      this._cursorArea = hit.area as typeof this._cursorArea;
      this._cursorCol = hit.col;
      this._cursorRow = hit.row >= 0 ? hit.row : 0;

      // 不允许放回原位（tableau 同列同位置）
      const isSamePlace = this._dragSource &&
        this._dragSource.area === hit.area &&
        this._dragSource.col === hit.col;

      if (!isSamePlace) {
        this.tryPlaceSelection();
      } else {
        this.clearSelection();
      }
    } else {
      // 放到无效位置，取消选择
      this.clearSelection();
    }

    // 重置拖拽状态
    this._isDragging = false;
    this._dragCards = [];
    this._dragSource = null;
    this._mouseSelection = null;
  }

  // ========== 键盘控制 ==========

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

  private renderEmptySlot(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, highlight: boolean, hover: boolean = false): void {
    this.renderSlot(ctx, x, y);
    if (hover && !highlight) {
      ctx.strokeStyle = CARD_HOVER_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_WIDTH, CARD_HEIGHT, 4);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
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

  private renderCardFace(ctx: CanvasRenderingContext2D, card: Card, x: number, y: number, highlight: boolean, hover: boolean = false): void {
    // 悬停高亮（仅当未选中时显示）
    if (hover && !highlight) {
      ctx.fillStyle = CARD_HOVER_COLOR;
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, CARD_WIDTH + 4, CARD_HEIGHT + 4, 5);
      ctx.fill();
    }

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
