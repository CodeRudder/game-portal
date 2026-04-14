import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ALL_ELEMENTS,
  COMBINATION_RULES,
  ElementCategory,
  SlotType,
  COLORS,
  HUD_HEIGHT,
  SLOT_AREA_HEIGHT,
  ELEMENT_ITEM_SIZE,
  ELEMENT_ITEM_GAP,
  ELEMENTS_PER_ROW,
  GRID_TOP_OFFSET,
  ELEMENT_GRID_PADDING,
  DISCOVERY_ANIMATION_DURATION,
  getBasicElementIds,
  getElementById,
  findCombination,
  getTotalElementCount,
  getAllElementIds,
  type ElementDef,
} from './constants';

// ========== 游戏状态接口 ==========

export interface DoodleGodState {
  discoveredIds: string[];
  selectedSlot: SlotType;
  firstElementId: string | null;
  secondElementId: string | null;
  cursorIndex: number;
  scrollOffset: number;
  isWin: boolean;
  discoveryAnimation: {
    active: boolean;
    elementId: string | null;
    startTime: number;
  };
  lastDiscovery: string | null;
  totalDiscovered: number;
  totalElements: number;
}

// ========== 涂鸦上帝引擎 ==========

export class DoodleGodEngine extends GameEngine {
  // 已发现的元素 ID 集合
  private discoveredIds: Set<string> = new Set();
  // 当前选择槽位
  private selectedSlot: SlotType = SlotType.FIRST;
  // 第一个选择的元素
  private firstElementId: string | null = null;
  // 第二个选择的元素
  private secondElementId: string | null = null;
  // 光标在元素网格中的索引
  private cursorIndex: number = 0;
  // 滚动偏移量
  private scrollOffset: number = 0;
  // 是否胜利
  public isWin: boolean = false;
  // 发现动画状态
  private discoveryAnimation = {
    active: false,
    elementId: null as string | null,
    startTime: 0,
  };
  // 最近发现的元素
  private lastDiscovery: string | null = null;
  // 发现历史（用于计分）
  private discoveryCount: number = 0;

  // ========== 公开 API ==========

  /** 获取已发现的元素 ID 列表 */
  getDiscoveredIds(): string[] {
    return [...this.discoveredIds];
  }

  /** 获取已发现元素数量 */
  getDiscoveredCount(): number {
    return this.discoveredIds.size;
  }

  /** 获取总元素数 */
  getTotalElements(): number {
    return getTotalElementCount();
  }

  /** 获取当前选择槽位 */
  getSelectedSlot(): SlotType {
    return this.selectedSlot;
  }

  /** 获取第一个选择的元素 */
  getFirstElementId(): string | null {
    return this.firstElementId;
  }

  /** 获取第二个选择的元素 */
  getSecondElementId(): string | null {
    return this.secondElementId;
  }

  /** 获取光标索引 */
  getCursorIndex(): number {
    return this.cursorIndex;
  }

  /** 获取滚动偏移量 */
  getScrollOffset(): number {
    return this.scrollOffset;
  }

  /** 获取最近发现的元素 */
  getLastDiscovery(): string | null {
    return this.lastDiscovery;
  }

  /** 获取发现动画状态 */
  getDiscoveryAnimation() {
    return { ...this.discoveryAnimation };
  }

  /** 获取进度百分比 */
  getProgress(): number {
    return Math.round((this.discoveredIds.size / getTotalElementCount()) * 100);
  }

  /** 检查元素是否已发现 */
  isDiscovered(elementId: string): boolean {
    return this.discoveredIds.has(elementId);
  }

  /** 获取已发现元素的定义列表 */
  getDiscoveredElements(): ElementDef[] {
    return ALL_ELEMENTS.filter((e) => this.discoveredIds.has(e.id));
  }

  /** 获取未发现元素的定义列表 */
  getUndiscoveredElements(): ElementDef[] {
    return ALL_ELEMENTS.filter((e) => !this.discoveredIds.has(e.id));
  }

  /** 获取所有元素（按发现状态） */
  getAllElementsWithState(): { element: ElementDef; discovered: boolean }[] {
    return ALL_ELEMENTS.map((e) => ({
      element: e,
      discovered: this.discoveredIds.has(e.id),
    }));
  }

  /** 获取按类别分组的已发现元素 */
  getDiscoveredByCategory(): Record<string, ElementDef[]> {
    const result: Record<string, ElementDef[]> = {};
    for (const cat of Object.values(ElementCategory)) {
      result[cat] = [];
    }
    for (const el of this.getDiscoveredElements()) {
      if (!result[el.category]) {
        result[el.category] = [];
      }
      result[el.category].push(el);
    }
    return result;
  }

  /** 尝试组合两个元素，返回新元素 ID 或 null */
  tryCombine(a: string, b: string): string | null {
    if (!this.discoveredIds.has(a) || !this.discoveredIds.has(b)) {
      return null;
    }
    const result = findCombination(a, b);
    if (result === null) {
      return null;
    }
    // 检查结果元素是否有效
    const elementDef = getElementById(result);
    if (!elementDef) {
      return null;
    }
    // 无论是否已发现，都返回结果
    return result;
  }

  /** 发现一个元素（用于测试和内部调用） */
  discoverElement(elementId: string): boolean {
    const elementDef = getElementById(elementId);
    if (!elementDef) return false;
    if (this.discoveredIds.has(elementId)) return false;

    this.discoveredIds.add(elementId);
    this.lastDiscovery = elementId;
    this.discoveryCount++;
    this.addScore(10);

    // 触发发现动画
    this.discoveryAnimation = {
      active: true,
      elementId,
      startTime: Date.now(),
    };

    this.emit('discovery', elementId);
    this.emit('stateChange');

    // 检查是否全部发现
    if (this.discoveredIds.size >= getTotalElementCount()) {
      this.isWin = true;
      this.emit('win');
      // 游戏胜利
      this.gameOver();
    }

    return true;
  }

  /** 选择一个元素到当前槽位 */
  selectElement(elementId: string): boolean {
    if (this._status !== 'playing') return false;
    if (!this.discoveredIds.has(elementId)) return false;

    if (this.selectedSlot === SlotType.FIRST) {
      this.firstElementId = elementId;
      this.selectedSlot = SlotType.SECOND;
    } else {
      this.secondElementId = elementId;
      // 自动尝试组合
      this.attemptCombination();
    }

    this.emit('stateChange');
    return true;
  }

  /** 尝试执行当前两个选择元素的组合 */
  attemptCombination(): string | null {
    if (!this.firstElementId || !this.secondElementId) return null;

    const result = this.tryCombine(this.firstElementId, this.secondElementId);
    if (result !== null) {
      const isNew = !this.discoveredIds.has(result);
      if (isNew) {
        this.discoverElement(result);
      } else {
        // 已发现的组合，提示
        this.emit('alreadyDiscovered', result);
      }
      this.clearSelection();
      return result;
    }

    // 无效组合
    this.emit('invalidCombination');
    this.clearSelection();
    return null;
  }

  /** 清除选择 */
  clearSelection(): void {
    this.firstElementId = null;
    this.secondElementId = null;
    this.selectedSlot = SlotType.FIRST;
    this.emit('stateChange');
  }

  /** 切换选择槽位 */
  toggleSlot(): void {
    if (this.selectedSlot === SlotType.FIRST) {
      this.selectedSlot = SlotType.SECOND;
    } else {
      this.selectedSlot = SlotType.FIRST;
    }
    this.emit('stateChange');
  }

  /** 设置光标位置 */
  setCursorIndex(index: number): void {
    const total = ALL_ELEMENTS.length;
    this.cursorIndex = Math.max(0, Math.min(index, total - 1));
    this.emit('stateChange');
  }

  /** 获取当前光标所在的元素 ID */
  getCursorElementId(): string {
    return ALL_ELEMENTS[this.cursorIndex]?.id ?? '';
  }

  /** 获取当前可见的元素行范围 */
  getVisibleRowRange(): { startRow: number; endRow: number } {
    const gridHeight = CANVAS_HEIGHT - GRID_TOP_OFFSET;
    const rowHeight = ELEMENT_ITEM_SIZE + ELEMENT_ITEM_GAP;
    const totalRows = Math.ceil(ALL_ELEMENTS.length / ELEMENTS_PER_ROW);
    const visibleRows = Math.floor(gridHeight / rowHeight);

    const startRow = Math.floor(this.scrollOffset / rowHeight);
    const endRow = Math.min(startRow + visibleRows, totalRows);

    return { startRow, endRow };
  }

  /** 滚动到指定行 */
  scrollToRow(row: number): void {
    const rowHeight = ELEMENT_ITEM_SIZE + ELEMENT_ITEM_GAP;
    const gridHeight = CANVAS_HEIGHT - GRID_TOP_OFFSET;
    const totalRows = Math.ceil(ALL_ELEMENTS.length / ELEMENTS_PER_ROW);
    const maxScroll = Math.max(0, totalRows * rowHeight - gridHeight);

    this.scrollOffset = Math.max(0, Math.min(row * rowHeight, maxScroll));
  }

  /** 确保光标可见 */
  ensureCursorVisible(): void {
    const cursorRow = Math.floor(this.cursorIndex / ELEMENTS_PER_ROW);
    const { startRow, endRow } = this.getVisibleRowRange();
    if (cursorRow < startRow) {
      this.scrollToRow(cursorRow);
    } else if (cursorRow >= endRow) {
      this.scrollToRow(cursorRow - (endRow - startRow - 1));
    }
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    // 初始化基础元素
    this.discoveredIds = new Set(getBasicElementIds());
    this.cursorIndex = 0;
    this.scrollOffset = 0;
    this.firstElementId = null;
    this.secondElementId = null;
    this.selectedSlot = SlotType.FIRST;
    this.isWin = false;
    this.lastDiscovery = null;
    this.discoveryCount = 0;
    this.discoveryAnimation = { active: false, elementId: null, startTime: 0 };
  }

  protected onStart(): void {
    // 游戏开始时重置
    this.onInit();
  }

  protected update(deltaTime: number): void {
    // 更新发现动画
    if (this.discoveryAnimation.active) {
      const elapsed = Date.now() - this.discoveryAnimation.startTime;
      if (elapsed > DISCOVERY_ANIMATION_DURATION) {
        this.discoveryAnimation.active = false;
        this.discoveryAnimation.elementId = null;
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    this.renderHUD(ctx, w);
    this.renderSlotArea(ctx, w);
    this.renderElementGrid(ctx, w, h);
    this.renderDiscoveryAnimation(ctx, w, h);

    if (this.isWin) {
      this.renderWinScreen(ctx, w, h);
    }
  }

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
      case 'Enter':
        this.selectCurrentElement();
        break;
      case 'Tab':
        this.toggleSlot();
        break;
      case 'Escape':
        this.clearSelection();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 涂鸦上帝不需要 key up 事件
  }

  getState(): Record<string, unknown> {
    return {
      discoveredIds: [...this.discoveredIds],
      selectedSlot: this.selectedSlot,
      firstElementId: this.firstElementId,
      secondElementId: this.secondElementId,
      cursorIndex: this.cursorIndex,
      scrollOffset: this.scrollOffset,
      isWin: this.isWin,
      discoveryAnimation: { ...this.discoveryAnimation },
      lastDiscovery: this.lastDiscovery,
      totalDiscovered: this.discoveredIds.size,
      totalElements: getTotalElementCount(),
      progress: this.getProgress(),
    } as DoodleGodState;
  }

  // ========== 键盘导航 ==========

  private moveCursorUp(): void {
    if (this.cursorIndex >= ELEMENTS_PER_ROW) {
      this.cursorIndex -= ELEMENTS_PER_ROW;
      this.ensureCursorVisible();
      this.emit('stateChange');
    }
  }

  private moveCursorDown(): void {
    const maxIndex = ALL_ELEMENTS.length - 1;
    if (this.cursorIndex + ELEMENTS_PER_ROW <= maxIndex) {
      this.cursorIndex += ELEMENTS_PER_ROW;
      this.ensureCursorVisible();
      this.emit('stateChange');
    }
  }

  private moveCursorLeft(): void {
    if (this.cursorIndex > 0) {
      this.cursorIndex--;
      this.ensureCursorVisible();
      this.emit('stateChange');
    }
  }

  private moveCursorRight(): void {
    const maxIndex = ALL_ELEMENTS.length - 1;
    if (this.cursorIndex < maxIndex) {
      this.cursorIndex++;
      this.ensureCursorVisible();
      this.emit('stateChange');
    }
  }

  /** 选择当前光标所在元素 */
  selectCurrentElement(): boolean {
    const elementId = this.getCursorElementId();
    if (!elementId) return false;
    return this.selectElement(elementId);
  }

  // ========== 渲染方法 ==========

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 标题
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('涂鸦上帝', 10, 22);

    // 进度
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '12px monospace';
    ctx.fillText(
      `${this.discoveredIds.size}/${getTotalElementCount()} (${this.getProgress()}%)`,
      10,
      40
    );

    // 进度条
    const barX = 160;
    const barY = 15;
    const barW = w - 170;
    const barH = 8;
    ctx.fillStyle = '#1e1e4a';
    ctx.fillRect(barX, barY, barW, barH);
    const progress = this.discoveredIds.size / getTotalElementCount();
    ctx.fillStyle = COLORS.neon;
    ctx.fillRect(barX, barY, barW * progress, barH);

    // 发现数/总数
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`分数: ${this._score}`, w - 10, 40);
    ctx.textAlign = 'left';
  }

  private renderSlotArea(ctx: CanvasRenderingContext2D, w: number): void {
    const y = HUD_HEIGHT + 5;
    const slotW = (w - 30) / 2;
    const slotH = 55;

    // 第一个槽位
    this.renderSlot(ctx, 10, y, slotW, slotH, SlotType.FIRST);
    // 加号
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+', w / 2, y + slotH / 2 + 7);
    // 第二个槽位
    this.renderSlot(ctx, w / 2 + 5, y, slotW, slotH, SlotType.SECOND);

    ctx.textAlign = 'left';
  }

  private renderSlot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    slot: SlotType
  ): void {
    const isActive = this.selectedSlot === slot;
    const elementId = slot === SlotType.FIRST ? this.firstElementId : this.secondElementId;

    // 背景
    ctx.fillStyle = isActive ? COLORS.slotActive : COLORS.slotBg;
    ctx.strokeStyle = isActive ? COLORS.accent : COLORS.slotBorder;
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    if (elementId) {
      const el = getElementById(elementId);
      if (el) {
        ctx.font = '22px serif';
        ctx.textAlign = 'center';
        ctx.fillText(el.emoji, x + w / 2, y + 28);
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = '12px monospace';
        ctx.fillText(el.name, x + w / 2, y + 46);
      }
    } else {
      ctx.fillStyle = COLORS.textLocked;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(slot === SlotType.FIRST ? '选择元素 1' : '选择元素 2', x + w / 2, y + h / 2 + 4);
    }

    ctx.textAlign = 'left';
  }

  private renderElementGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gridY = GRID_TOP_OFFSET;
    const gridHeight = h - gridY;
    const rowHeight = ELEMENT_ITEM_SIZE + ELEMENT_ITEM_GAP;
    const totalRows = Math.ceil(ALL_ELEMENTS.length / ELEMENTS_PER_ROW);

    // 裁剪区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, gridY, w, gridHeight);
    ctx.clip();

    for (let i = 0; i < ALL_ELEMENTS.length; i++) {
      const el = ALL_ELEMENTS[i];
      const row = Math.floor(i / ELEMENTS_PER_ROW);
      const col = i % ELEMENTS_PER_ROW;

      const x = ELEMENT_GRID_PADDING + col * (ELEMENT_ITEM_SIZE + ELEMENT_ITEM_GAP);
      const y = gridY + row * rowHeight - this.scrollOffset;

      // 跳过不可见的元素
      if (y + ELEMENT_ITEM_SIZE < gridY || y > h) continue;

      const discovered = this.discoveredIds.has(el.id);
      const isCursor = i === this.cursorIndex;
      const isSelected =
        el.id === this.firstElementId || el.id === this.secondElementId;

      this.renderElementItem(ctx, x, y, el, discovered, isCursor, isSelected);
    }

    ctx.restore();

    // 滚动条
    if (totalRows * rowHeight > gridHeight) {
      const scrollBarH = Math.max(20, (gridHeight / (totalRows * rowHeight)) * gridHeight);
      const maxScroll = totalRows * rowHeight - gridHeight;
      const scrollBarY =
        gridY + (maxScroll > 0 ? (this.scrollOffset / maxScroll) * (gridHeight - scrollBarH) : 0);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(w - 6, scrollBarY, 4, scrollBarH);
    }
  }

  private renderElementItem(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    el: ElementDef,
    discovered: boolean,
    isCursor: boolean,
    isSelected: boolean
  ): void {
    const size = ELEMENT_ITEM_SIZE;

    // 背景
    if (discovered) {
      ctx.fillStyle = isSelected ? COLORS.elementSelected : COLORS.elementBg;
    } else {
      ctx.fillStyle = COLORS.elementLocked;
    }

    if (isCursor) {
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = 'transparent';
      ctx.lineWidth = 0;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 6);
    ctx.fill();
    if (isCursor) {
      ctx.stroke();
    }

    if (discovered) {
      // emoji
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      ctx.fillText(el.emoji, x + size / 2, y + 28);
      // 名称
      ctx.fillStyle = COLORS.textPrimary;
      ctx.font = '9px monospace';
      ctx.fillText(el.name, x + size / 2, y + 48);
    } else {
      // 问号
      ctx.fillStyle = COLORS.textLocked;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', x + size / 2, y + 35);
    }

    ctx.textAlign = 'left';
  }

  private renderDiscoveryAnimation(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {
    if (!this.discoveryAnimation.active || !this.discoveryAnimation.elementId) return;

    const el = getElementById(this.discoveryAnimation.elementId);
    if (!el) return;

    const elapsed = Date.now() - this.discoveryAnimation.startTime;
    const progress = Math.min(elapsed / DISCOVERY_ANIMATION_DURATION, 1);
    const alpha = progress < 0.8 ? 1 : 1 - (progress - 0.8) / 0.2;

    ctx.save();
    ctx.globalAlpha = alpha;

    // 半透明背景
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, w, h);

    // 发现卡片
    const cardW = 200;
    const cardH = 120;
    const cardX = (w - cardW) / 2;
    const cardY = (h - cardH) / 2;

    ctx.fillStyle = '#1e1e4a';
    ctx.strokeStyle = COLORS.neon;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    // 文字
    ctx.fillStyle = COLORS.neon;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('✨ 新发现！', w / 2, cardY + 25);

    ctx.font = '36px serif';
    ctx.fillText(el.emoji, w / 2, cardY + 70);

    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(el.name, w / 2, cardY + 100);

    ctx.textAlign = 'left';
    ctx.restore();
  }

  private renderWinScreen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 恭喜通关！', w / 2, h / 2 - 30);

    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = '16px monospace';
    ctx.fillText(`你发现了全部 ${getTotalElementCount()} 种元素！`, w / 2, h / 2 + 10);
    ctx.fillText(`最终得分: ${this._score}`, w / 2, h / 2 + 40);

    ctx.textAlign = 'left';
    ctx.restore();
  }

  // ========== 重置 ==========

  protected onReset(): void {
    this.onInit();
  }
}
