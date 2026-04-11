import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  LEVEL_CONFIGS,
  CARD_PADDING,
  CARD_GAP,
  GRID_OFFSET_Y,
  GRID_OFFSET_BOTTOM,
  CARD_RADIUS,
  FLIP_DURATION,
  MISMATCH_DELAY,
  MATCH_GLOW_DURATION,
  WIN_DELAY,
  BASE_SCORE,
  SCORE_BASE_MATCH,
  SCORE_COMBO_BONUS,
  SCORE_MISMATCH_PENALTY,
  SCORE_MIN,
  TIME_BONUS_MAX,
  TIME_BONUS_THRESHOLD,
  COLORS,
  CARD_SYMBOLS,
  type CardState,
  type LevelConfig,
} from './constants';

// ========== 类型定义 ==========

/** 单张卡牌数据 */
interface Card {
  /** 唯一标识 */
  id: number;
  /** 符号索引 → CARD_SYMBOLS 数组下标 */
  symbolIndex: number;
  /** 是否已翻面（正面朝上） */
  isFlipped: boolean;
  /** 是否已匹配成功 */
  isMatched: boolean;
  /** 当前状态 */
  state: CardState;
  /** 翻转动画进度 (0=完全背面, 1=完全正面) */
  flipProgress: number;
  /** 翻转动画方向 */
  flipDirection: 'open' | 'close' | null;
  /** 匹配成功发光动画剩余时间 (ms) */
  glowTimer: number;
}

/** 游戏内部状态快照（供 getState 返回） */
interface MemoryMatchState {
  cards: Card[];
  cols: number;
  rows: number;
  steps: number;
  pairs: number;
  combo: number;
  maxCombo: number;
  selectedRow: number;
  selectedCol: number;
  firstCard: number | null;
  secondCard: number | null;
  /** @deprecated 使用 pairs */
  matchedPairs: number;
  totalPairs: number;
  cursorIndex: number;
  score: number;
  level: number;
  elapsedTime: number;
  isWin: boolean;
}

// ========== Memory Match 游戏引擎 ==========

export class MemoryMatchEngine extends GameEngine {
  // ========== 网格配置 ==========

  private cols: number = 4;
  private rows: number = 4;
  private totalPairs: number = 8;
  private levelConfig: LevelConfig = LEVEL_CONFIGS[1];

  /** 保存初始化时的关卡（防止基类 start() 重置 _level 为 1 后丢失） */
  private _initialLevel: number = 1;

  // ========== 卡牌状态 ==========

  /** 卡牌数组（一维，行优先排列） */
  private cards: Card[] = [];

  /** 当前已翻开且未匹配的卡牌索引列表（最多 2 张） */
  private flippedIndices: number[] = [];

  /** 已匹配成功的对数 */
  private matchedPairs: number = 0;

  // ========== 光标 ==========

  /** 键盘光标位置（一维索引） */
  private cursorIndex: number = 0;

  // ========== 计分/统计 ==========

  /** 翻牌步数（每翻 2 张算 1 步） */
  private steps: number = 0;
  /** 当前连击数（连续匹配不中断） */
  private combo: number = 0;
  /** 最大连击数 */
  private maxCombo: number = 0;
  /** 是否胜利 */
  private isWin: boolean = false;

  // ========== 动画/锁定 ==========

  /** 不匹配时翻回的延迟计时器（毫秒） */
  private mismatchTimer: number = 0;

  /** 是否正在等待不匹配翻回（锁定输入） */
  private isLocked: boolean = false;

  // ========== 布局缓存 ==========

  /** 卡牌宽度 */
  private cardWidth: number = 0;
  /** 卡牌高度 */
  private cardHeight: number = 0;
  /** 网格起始 X 坐标（居中对齐） */
  private gridStartX: number = 0;
  /** 网格起始 Y 坐标 */
  private gridStartY: number = GRID_OFFSET_Y;
  /** init 阶段保存的 level，防止 start() 被基类重置 */
  private _initLevel: number = 1;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this._initLevel = this._level;
    this.applyLevelConfig(this._level);
    this.calculateLayout();
    this.cards = this.createCards();
  }

  protected onStart(): void {
    // 基类 start() 已将 _level 重置为 1，用 onInit 时保存的值恢复
    this._level = this._initLevel;
    this.applyLevelConfig(this._level);
    this.calculateLayout();

    // 重新洗牌
    this.cards = this.createShuffledCards();
    this.flippedIndices = [];
    this.matchedPairs = 0;
    this.cursorIndex = 0;
    this.steps = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.isWin = false;
    this.mismatchTimer = 0;
    this.isLocked = false;

    // 设置基础初始分（基类 start() 已将 _score 设为 0，这里覆盖为 BASE_SCORE）
    this._score = BASE_SCORE;
    this.emit('scoreChange', this._score);
  }

  protected onReset(): void {
    this.applyLevelConfig(this._level);
    this.calculateLayout();
    this.cards = this.createCards();
    this.flippedIndices = [];
    this.matchedPairs = 0;
    this.cursorIndex = 0;
    this.steps = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.isWin = false;
    this.mismatchTimer = 0;
    this.isLocked = false;
  }

  protected onPause(): void {
    // 暂停无需额外处理
  }

  protected onResume(): void {
    // 恢复无需额外处理
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
    // 1. 更新翻牌动画
    this.updateFlipAnimations(deltaTime);

    // 2. 更新匹配发光动画
    this.updateGlowAnimations(deltaTime);

    // 3. 更新不匹配翻回计时器
    if (this.isLocked && this.mismatchTimer > 0) {
      this.mismatchTimer -= deltaTime;
      if (this.mismatchTimer <= 0) {
        this.mismatchTimer = 0;
        this.resolveMismatch();
      }
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景渐变
    this.drawBackground(ctx, w, h);

    // HUD 信息栏
    this.drawHUD(ctx, w);

    // 卡牌网格
    this.drawGrid(ctx);

    // 暂停遮罩
    if (this._status === 'paused') {
      this.drawPauseOverlay(ctx, w, h);
    }

    // 胜利遮罩
    if (this._status === 'gameover' && this.isWin) {
      this.drawWinOverlay(ctx, w, h);
    }
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status === 'paused' && key !== 'p' && key !== 'P') return;

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.moveCursor(-this.cols);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.moveCursor(this.cols);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.moveCursor(-1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.moveCursor(1);
        break;
      case 'Enter':
      case ' ':
        if (this._status === 'playing') {
          this.flipCardAt(this.cursorIndex);
        }
        break;
      case 'p':
      case 'P':
        // 暂停/恢复由外部 GameContainer 处理
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // Memory Match 不需要处理按键释放
  }

  getState(): Record<string, unknown> {
    const state: MemoryMatchState = {
      cards: this.cards.map((c) => ({ ...c })),
      cols: this.cols,
      rows: this.rows,
      steps: this.steps,
      pairs: this.matchedPairs,
      combo: this.combo,
      maxCombo: this.maxCombo,
      selectedRow: Math.floor(this.cursorIndex / this.cols),
      selectedCol: this.cursorIndex % this.cols,
      firstCard: this.flippedIndices.length > 0 ? this.flippedIndices[0] : null,
      secondCard: this.flippedIndices.length > 1 ? this.flippedIndices[1] : null,
      matchedPairs: this.matchedPairs,
      totalPairs: this.totalPairs,
      cursorIndex: this.cursorIndex,
      score: this._score,
      level: this._level,
      elapsedTime: this._elapsedTime,
      isWin: this.isWin,
    };
    return state as unknown as Record<string, unknown>;
  }

  // ========== 公共方法：鼠标/触摸 ==========

  /**
   * 处理鼠标/触摸点击
   * @param x 画布 X 坐标
   * @param y 画布 Y 坐标
   */
  handleClick(x: number, y: number): void {
    if (this._status !== 'playing') return;

    const index = this.getCardAtPosition(x, y);
    if (index !== -1) {
      // 同步光标位置
      this.cursorIndex = index;
      this.flipCardAt(index);
    }
  }

  // ========== 核心游戏逻辑 ==========

  /**
   * 翻开指定索引的卡牌
   */
  private flipCardAt(index: number): void {
    if (index < 0 || index >= this.cards.length) return;
    if (this.isLocked) return;

    const card = this.cards[index];

    // 不能翻已翻开、已匹配的卡牌
    if (card.isFlipped || card.isMatched) return;
    // 不能翻正在动画中的卡牌
    if (card.state === 'flipped') return;

    // 翻开卡牌
    card.isFlipped = true;
    card.state = 'flipped';
    card.flipDirection = 'open';
    card.flipProgress = 0;
    this.flippedIndices.push(index);

    // 翻了两张 → 检查匹配
    if (this.flippedIndices.length === 2) {
      this.steps++;
      this.checkMatch();
    }
  }

  /**
   * 检查当前翻开的 2 张卡牌是否匹配
   */
  private checkMatch(): void {
    const [i1, i2] = this.flippedIndices;
    const card1 = this.cards[i1];
    const card2 = this.cards[i2];

    if (card1.symbolIndex === card2.symbolIndex) {
      // ✅ 匹配成功
      card1.isMatched = true;
      card2.isMatched = true;
      card1.state = 'matched';
      card2.state = 'matched';
      card1.glowTimer = MATCH_GLOW_DURATION;
      card2.glowTimer = MATCH_GLOW_DURATION;
      this.matchedPairs++;

      // 连击
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // 计分：基础分 + 连击奖励
      const comboBonus = Math.max(0, this.combo - 1) * SCORE_COMBO_BONUS;
      const totalPoints = SCORE_BASE_MATCH + comboBonus;
      this.addScore(totalPoints);

      this.flippedIndices = [];

      // 检查是否全部匹配完成
      if (this.matchedPairs >= this.totalPairs) {
        this.handleWin();
      }
    } else {
      // ❌ 不匹配
      this.combo = 0; // 重置连击
      this.isLocked = true;
      this.mismatchTimer = MISMATCH_DELAY;

      // 扣分（最低 0）
      const newScore = Math.max(SCORE_MIN, this._score - SCORE_MISMATCH_PENALTY);
      if (newScore !== this._score) {
        this._score = newScore;
        this.emit('scoreChange', this._score);
      }
    }
  }

  /**
   * 处理不匹配翻回
   */
  private resolveMismatch(): void {
    for (const index of this.flippedIndices) {
      const card = this.cards[index];
      card.flipDirection = 'close';
      card.flipProgress = 1;
      card.isFlipped = false;
      card.state = 'hidden';
    }
    this.flippedIndices = [];
    this.isLocked = false;
  }

  /**
   * 处理胜利
   */
  private handleWin(): void {
    this.isWin = true;

    // 时间奖励
    const timeSeconds = this._elapsedTime;
    if (timeSeconds < TIME_BONUS_THRESHOLD) {
      const timeBonus = Math.floor(
        TIME_BONUS_MAX * (1 - timeSeconds / TIME_BONUS_THRESHOLD)
      );
      this.addScore(timeBonus);
    }

    // 延迟一小段时间再触发 gameover（让玩家看到最后一张翻开动画）
    setTimeout(() => {
      this.gameOver(); // 基类方法：status='gameover', emit('statusChange', 'gameover')
    }, WIN_DELAY);
  }

  // ========== 光标移动 ==========

  /**
   * 移动键盘光标（线性索引偏移）
   * @param delta 索引偏移量
   */
  private moveCursor(delta: number): void {
    if (this._status !== 'playing') return;

    const newIndex = this.cursorIndex + delta;

    // 边界检查：不能超出网格范围
    if (newIndex < 0 || newIndex >= this.cols * this.rows) return;

    // 水平移动时不能跨行
    const currentRow = Math.floor(this.cursorIndex / this.cols);
    const newRow = Math.floor(newIndex / this.cols);
    if (delta === -1 && currentRow !== newRow) return;
    if (delta === 1 && currentRow !== newRow) return;

    this.cursorIndex = newIndex;
  }

  // ========== 动画更新 ==========

  /**
   * 更新翻牌动画进度
   */
  private updateFlipAnimations(deltaTime: number): void {
    const step = deltaTime / FLIP_DURATION;

    for (const card of this.cards) {
      if (card.flipDirection === 'open') {
        card.flipProgress += step;
        if (card.flipProgress >= 1) {
          card.flipProgress = 1;
          card.flipDirection = null;
          // 翻开动画完成后更新状态
          if (card.state === 'flipped') {
            card.state = 'revealed';
          }
        }
      } else if (card.flipDirection === 'close') {
        card.flipProgress -= step;
        if (card.flipProgress <= 0) {
          card.flipProgress = 0;
          card.flipDirection = null;
        }
      }
    }
  }

  /**
   * 更新匹配发光动画计时器
   */
  private updateGlowAnimations(deltaTime: number): void {
    for (const card of this.cards) {
      if (card.glowTimer > 0) {
        card.glowTimer = Math.max(0, card.glowTimer - deltaTime);
      }
    }
  }

  // ========== 卡牌创建与洗牌 ==========

  /**
   * 创建未洗牌的卡牌数组
   */
  private createCards(): Card[] {
    const cards: Card[] = [];
    for (let i = 0; i < this.totalPairs; i++) {
      cards.push(this.makeCard(i * 2, i));
      cards.push(this.makeCard(i * 2 + 1, i));
    }
    return cards;
  }

  /**
   * 创建并洗牌的卡牌数组
   */
  private createShuffledCards(): Card[] {
    const cards = this.createCards();
    this.shuffle(cards);
    return cards;
  }

  /**
   * 创建单张卡牌
   */
  private makeCard(id: number, symbolIndex: number): Card {
    return {
      id,
      symbolIndex,
      isFlipped: false,
      isMatched: false,
      state: 'hidden',
      flipProgress: 0,
      flipDirection: null,
      glowTimer: 0,
    };
  }

  /**
   * Fisher-Yates 洗牌算法（原地打乱）
   */
  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // ========== 布局计算 ==========

  /**
   * 根据等级配置设置网格参数
   */
  private applyLevelConfig(level: number): void {
    const cfg = LEVEL_CONFIGS[level] || LEVEL_CONFIGS[1];
    this.levelConfig = cfg;
    this.cols = cfg.cols;
    this.rows = cfg.rows;
    this.totalPairs = cfg.totalPairs;
  }

  /**
   * 计算卡牌布局尺寸
   */
  private calculateLayout(): void {
    const availableWidth = CANVAS_WIDTH - 2 * CARD_PADDING;
    const availableHeight = CANVAS_HEIGHT - GRID_OFFSET_Y - GRID_OFFSET_BOTTOM;

    const totalGapX = CARD_GAP * (this.cols - 1);
    const totalGapY = CARD_GAP * (this.rows - 1);

    // 计算卡牌尺寸（保持正方形）
    const maxCardW = (availableWidth - totalGapX) / this.cols;
    const maxCardH = (availableHeight - totalGapY) / this.rows;

    this.cardWidth = Math.floor(Math.min(maxCardW, maxCardH));
    this.cardHeight = this.cardWidth;

    // 水平居中
    const gridWidth = this.cols * this.cardWidth + totalGapX;
    this.gridStartX = (CANVAS_WIDTH - gridWidth) / 2;

    // 垂直居中（在可用区域内）
    const gridHeight = this.rows * this.cardHeight + totalGapY;
    this.gridStartY = GRID_OFFSET_Y + (availableHeight - gridHeight) / 2;
  }

  /**
   * 获取卡牌渲染坐标
   */
  private getCardPosition(index: number): { x: number; y: number } {
    const col = index % this.cols;
    const row = Math.floor(index / this.cols);
    return {
      x: this.gridStartX + col * (this.cardWidth + CARD_GAP),
      y: this.gridStartY + row * (this.cardHeight + CARD_GAP),
    };
  }

  /**
   * 根据画布坐标找到卡牌索引
   * @returns 卡牌索引，未命中返回 -1
   */
  private getCardAtPosition(x: number, y: number): number {
    for (let i = 0; i < this.cards.length; i++) {
      const pos = this.getCardPosition(i);
      if (
        x >= pos.x &&
        x <= pos.x + this.cardWidth &&
        y >= pos.y &&
        y <= pos.y + this.cardHeight
      ) {
        return i;
      }
    }
    return -1;
  }

  // ========== 渲染方法 ==========

  /**
   * 绘制背景
   */
  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, COLORS.backgroundGradient1);
    grad.addColorStop(1, COLORS.backgroundGradient2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * 绘制 HUD 信息栏
   */
  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, w, GRID_OFFSET_Y - 8);

    // 底部分割线
    ctx.strokeStyle = COLORS.hudBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, GRID_OFFSET_Y - 8);
    ctx.lineTo(w, GRID_OFFSET_Y - 8);
    ctx.stroke();

    // 标题
    ctx.fillStyle = COLORS.hudTitle;
    ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🃏 Memory Match', w / 2, 22);

    // 等级标签
    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(this.levelConfig.label, w - 16, 22);

    // 信息指标行
    const infoY = 58;
    const items = [
      { label: '步数', value: this.steps.toString(), color: COLORS.hudValue },
      { label: '配对', value: `${this.matchedPairs}/${this.totalPairs}`, color: COLORS.hudValue },
      { label: '连击', value: `×${this.combo}`, color: this.combo > 1 ? COLORS.hudCombo : COLORS.hudValue },
      { label: '分数', value: this._score.toString(), color: COLORS.hudScore },
      { label: '用时', value: this.formatTime(this._elapsedTime), color: COLORS.hudTime },
    ];

    const itemWidth = w / items.length;

    items.forEach((item, i) => {
      const cx = itemWidth * i + itemWidth / 2;

      // 标签
      ctx.fillStyle = COLORS.hudLabel;
      ctx.font = '11px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, cx, infoY - 10);

      // 数值
      ctx.fillStyle = item.color;
      ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
      ctx.fillText(item.value, cx, infoY + 10);
    });

    // 连击高亮提示
    if (this.combo >= 3) {
      ctx.fillStyle = COLORS.hudCombo;
      ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🔥 ${this.combo} 连击！`, w / 2, infoY + 32);
    }
  }

  /**
   * 绘制卡牌网格
   */
  private drawGrid(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.cards.length; i++) {
      this.drawCard(ctx, i);
    }
  }

  /**
   * 绘制单张卡牌
   */
  private drawCard(ctx: CanvasRenderingContext2D, index: number): void {
    const card = this.cards[index];
    const pos = this.getCardPosition(index);
    const cx = pos.x + this.cardWidth / 2;
    const cy = pos.y + this.cardHeight / 2;

    // ===== 翻转缩放效果 =====
    let scaleX = 1;
    if (card.flipDirection === 'open') {
      // 0→0.5: 缩小到 0（背面消失）
      // 0.5→1: 放大到 1（正面出现）
      scaleX = card.flipProgress < 0.5
        ? 1 - card.flipProgress * 2
        : (card.flipProgress - 0.5) * 2;
    } else if (card.flipDirection === 'close') {
      // 1→0.5: 缩小到 0（正面消失）
      // 0.5→0: 放大到 1（背面出现）
      scaleX = card.flipProgress > 0.5
        ? (card.flipProgress - 0.5) * 2
        : 1 - card.flipProgress * 2;
    }
    scaleX = Math.max(0.02, scaleX);

    // 判断当前显示正面还是背面
    const showFront =
      card.isMatched ||
      card.flipProgress > 0.5 ||
      (card.isFlipped && card.flipDirection === null);

    // 是否为光标选中
    const isSelected = index === this.cursorIndex;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX, 1);

    const halfW = this.cardWidth / 2;
    const halfH = this.cardHeight / 2;

    // ===== 阴影 =====
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    if (showFront) {
      this.drawCardFront(ctx, card, halfW, halfH);
    } else {
      this.drawCardBack(ctx, halfW, halfH);
    }

    // 清除阴影（避免影响边框和光标绘制）
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // ===== 匹配发光效果 =====
    if (card.isMatched && card.glowTimer > 0) {
      const glowAlpha = card.glowTimer / MATCH_GLOW_DURATION;
      ctx.strokeStyle = COLORS.matchedGlow;
      ctx.lineWidth = 4;
      ctx.globalAlpha = glowAlpha;
      ctx.beginPath();
      ctx.roundRect(-halfW - 2, -halfH - 2, this.cardWidth + 4, this.cardHeight + 4, CARD_RADIUS + 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ===== 光标选中高亮 =====
    if (isSelected && this._status === 'playing') {
      // 外发光
      ctx.strokeStyle = COLORS.cursorGlow;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(-halfW - 3, -halfH - 3, this.cardWidth + 6, this.cardHeight + 6, CARD_RADIUS + 3);
      ctx.stroke();

      // 亮色边框
      ctx.strokeStyle = COLORS.cursorBorder;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-halfW, -halfH, this.cardWidth, this.cardHeight, CARD_RADIUS);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 绘制卡牌正面
   */
  private drawCardFront(ctx: CanvasRenderingContext2D, card: Card, halfW: number, halfH: number): void {
    const isMatched = card.isMatched;

    // 背景
    ctx.fillStyle = isMatched ? COLORS.matchedBg : COLORS.cardFront;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, this.cardWidth, this.cardHeight, CARD_RADIUS);
    ctx.fill();

    // 边框
    ctx.strokeStyle = isMatched ? COLORS.matchedBorder : COLORS.cardFrontBorder;
    ctx.lineWidth = isMatched ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, this.cardWidth, this.cardHeight, CARD_RADIUS);
    ctx.stroke();

    // Emoji 符号
    const emoji = CARD_SYMBOLS[card.symbolIndex] || '?';
    const fontSize = Math.floor(this.cardWidth * 0.45);
    ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(emoji, 0, 2);
  }

  /**
   * 绘制卡牌背面（带装饰花纹）
   */
  private drawCardBack(ctx: CanvasRenderingContext2D, halfW: number, halfH: number): void {
    // 渐变背景
    const grad = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
    grad.addColorStop(0, COLORS.cardBack1);
    grad.addColorStop(1, COLORS.cardBack2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, this.cardWidth, this.cardHeight, CARD_RADIUS);
    ctx.fill();

    // 边框
    ctx.strokeStyle = COLORS.cardBackBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, this.cardWidth, this.cardHeight, CARD_RADIUS);
    ctx.stroke();

    // 装饰图案：菱形
    const patternSize = Math.min(halfW, halfH) * 0.45;

    ctx.strokeStyle = COLORS.cardBackPattern;
    ctx.lineWidth = 1.5;

    // 外菱形
    ctx.beginPath();
    ctx.moveTo(0, -patternSize);
    ctx.lineTo(patternSize, 0);
    ctx.lineTo(0, patternSize);
    ctx.lineTo(-patternSize, 0);
    ctx.closePath();
    ctx.stroke();

    // 内菱形
    const innerSize = patternSize * 0.55;
    ctx.beginPath();
    ctx.moveTo(0, -innerSize);
    ctx.lineTo(innerSize, 0);
    ctx.lineTo(0, innerSize);
    ctx.lineTo(-innerSize, 0);
    ctx.closePath();
    ctx.stroke();

    // 中心圆点
    ctx.fillStyle = COLORS.cardBackCenter;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // 四角小圆点装饰
    const dotOffset = patternSize * 0.75;
    const dotRadius = 2.5;
    ctx.fillStyle = COLORS.cardBackPattern;
    const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [dx, dy] of corners) {
      ctx.beginPath();
      ctx.arc(dx * dotOffset, dy * dotOffset, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 绘制暂停遮罩
   */
  private drawPauseOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(15, 14, 23, 0.75)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = COLORS.hudTitle;
    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ 已暂停', w / 2, h / 2 - 15);

    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '16px "Segoe UI", Arial, sans-serif';
    ctx.fillText('按 P 键继续', w / 2, h / 2 + 25);
  }

  /**
   * 绘制胜利遮罩
   */
  private drawWinOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = COLORS.winOverlay;
    ctx.fillRect(0, 0, w, h);

    const centerY = h / 2;

    // 胜利标题
    ctx.fillStyle = COLORS.winTitle;
    ctx.font = 'bold 40px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎉 恭喜通关！', w / 2, centerY - 70);

    // 统计信息
    ctx.fillStyle = COLORS.hudValue;
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`最终得分: ${this._score}`, w / 2, centerY - 15);

    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(
      `步数: ${this.steps}  |  最大连击: ${this.maxCombo}  |  用时: ${this.formatTime(this._elapsedTime)}`,
      w / 2,
      centerY + 25
    );

    // 等级提示
    const nextLevel = this._level < 3 ? this._level + 1 : null;
    if (nextLevel) {
      ctx.fillStyle = COLORS.winSubtitle;
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`下一关: ${LEVEL_CONFIGS[nextLevel].label}`, w / 2, centerY + 65);
    }

    // 重新开始提示
    ctx.fillStyle = COLORS.winPrompt;
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillText('点击「重新开始」再来一局', w / 2, centerY + 105);
  }

  // ========== 工具方法 ==========

  /**
   * 格式化时间为 mm:ss
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
