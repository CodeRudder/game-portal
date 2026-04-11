import { GameEngine } from '@/core/GameEngine';

// ========== 常量配置 ==========

/** 网格尺寸 */
const GRID_COLS = 4;
const GRID_ROWS = 4;
const TOTAL_PAIRS = 8;

/** 画布尺寸 */
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;

/** 布局参数 */
const CARD_PADDING = 12;
const CARD_GAP = 10;
const GRID_OFFSET_Y = 100;

/** 动画时间（毫秒） */
const FLIP_DURATION = 300;
const MISMATCH_DELAY = 800;

/** 计分规则 */
const BASE_SCORE = 1000;
const MISMATCH_PENALTY = 50;

/** 卡牌 emoji 符号集 */
const CARD_SYMBOLS: string[] = ['🎮', '🎲', '🎯', '🎪', '🎨', '🎭', '🎵', '🎸'];

/** 颜色主题 */
const COLORS = {
  /** 页面背景 */
  BG: '#1a1a2e',
  /** 信息栏背景 */
  HEADER_BG: '#16213e',
  /** 卡牌背面 */
  CARD_BACK: '#0f3460',
  /** 卡牌背面边框 */
  CARD_BACK_BORDER: '#1a5276',
  /** 卡牌正面底色 */
  CARD_FRONT: '#ffffff',
  /** 卡牌正面边框 */
  CARD_FRONT_BORDER: '#dfe6e9',
  /** 匹配成功边框 */
  MATCHED_BORDER: '#2ed573',
  /** 匹配成功背景 */
  MATCHED_BG: '#e8f8f0',
  /** 光标选中边框 */
  CURSOR_BORDER: '#ff4757',
  /** 标题文字 */
  TITLE: '#eccc68',
  /** 标签文字 */
  LABEL: '#a4b0be',
  /** 数值文字 */
  VALUE: '#ffffff',
  /** 胜利遮罩 */
  WIN_OVERLAY: 'rgba(26, 26, 46, 0.85)',
  /** 胜利文字 */
  WIN_TEXT: '#2ed573',
} as const;

// ========== 类型定义 ==========

/** 单张卡牌的数据结构 */
interface Card {
  /** 唯一标识 */
  id: number;
  /** 符号索引，对应 CARD_SYMBOLS 数组 */
  symbolIndex: number;
  /** 是否已翻面（正面朝上） */
  isFlipped: boolean;
  /** 是否已匹配成功 */
  isMatched: boolean;
  /** 翻牌动画进度 (0=背面, 1=正面) */
  flipProgress: number;
  /** 翻牌动画方向: 'open' 正在翻开 | 'close' 正在翻回 | null 无动画 */
  flipDirection: 'open' | 'close' | null;
}

// ========== Memory Match 游戏引擎 ==========

export class MemoryMatchEngine extends GameEngine {
  // ========== 游戏状态 ==========

  /** 4×4 卡牌数组（一维，按行优先排列） */
  private cards: Card[] = [];

  /** 当前已翻开且未匹配的卡牌索引列表（最多 2 张） */
  private flippedIndices: number[] = [];

  /** 已匹配成功的对数 */
  private matchedPairs: number = 0;

  /** 键盘光标位置（一维索引） */
  private cursorIndex: number = 0;

  /** 不匹配时翻回的延迟计时器（毫秒） */
  private mismatchTimer: number = 0;

  /** 是否正在等待不匹配翻回（锁定输入） */
  private isLocked: boolean = false;

  /** 卡牌尺寸（根据画布宽度动态计算） */
  private cardWidth: number = 0;
  private cardHeight: number = 0;

  /** 网格起始 X 坐标（居中对齐） */
  private gridStartX: number = 0;

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    // 计算卡牌布局尺寸
    this.calculateLayout();
    // 初始化卡牌（不洗牌，等 start 时再洗）
    this.cards = this.createCards();
  }

  protected onStart(): void {
    // 重置所有游戏状态
    this.cards = this.createShuffledCards();
    this.flippedIndices = [];
    this.matchedPairs = 0;
    this.cursorIndex = 0;
    this.mismatchTimer = 0;
    this.isLocked = false;

    // 设置基础分
    this._score = BASE_SCORE;
    this.emit('scoreChange', this._score);
  }

  protected onReset(): void {
    this.cards = this.createCards();
    this.flippedIndices = [];
    this.matchedPairs = 0;
    this.cursorIndex = 0;
    this.mismatchTimer = 0;
    this.isLocked = false;
  }

  protected update(deltaTime: number): void {
    // 更新翻牌动画
    this.updateFlipAnimations(deltaTime);

    // 更新不匹配翻回计时器
    if (this.isLocked && this.mismatchTimer > 0) {
      this.mismatchTimer -= deltaTime;
      if (this.mismatchTimer <= 0) {
        this.mismatchTimer = 0;
        this.resolveMismatch();
      }
    }
  }

  // ========== 渲染实现 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, w, h);

    // 顶部信息栏
    this.drawHeader(ctx, w);

    // 卡牌网格
    this.drawGrid(ctx, w);

    // 胜利遮罩
    if (this._status === 'gameover') {
      this.drawWinOverlay(ctx, w, h);
    }
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case 'ArrowUp':
        this.moveCursor(-GRID_COLS);
        break;
      case 'ArrowDown':
        this.moveCursor(GRID_COLS);
        break;
      case 'ArrowLeft':
        this.moveCursor(-1);
        break;
      case 'ArrowRight':
        this.moveCursor(1);
        break;
      case 'Enter':
      case ' ':
        this.flipCardAt(this.cursorIndex);
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // Memory Match 不需要处理按键释放
  }

  getState(): Record<string, unknown> {
    return {
      cards: this.cards.map((card) => ({
        id: card.id,
        symbolIndex: card.symbolIndex,
        isFlipped: card.isFlipped,
        isMatched: card.isMatched,
      })),
      matchedPairs: this.matchedPairs,
      totalPairs: TOTAL_PAIRS,
      cursorIndex: this.cursorIndex,
      score: this._score,
      elapsedTime: this._elapsedTime,
    };
  }

  // ========== 公共方法（供鼠标/触摸交互调用） ==========

  /**
   * 处理鼠标/触摸点击
   * @param x 点击的画布 X 坐标
   * @param y 点击的画布 Y 坐标
   */
  handleClick(x: number, y: number): void {
    if (this._status !== 'playing') return;

    // 计算点击落在哪张卡牌上
    const cardIndex = this.getCardAtPosition(x, y);
    if (cardIndex !== -1) {
      // 同步光标位置
      this.cursorIndex = cardIndex;
      this.flipCardAt(cardIndex);
    }
  }

  // ========== 核心游戏逻辑 ==========

  /**
   * 翻开指定索引的卡牌
   */
  private flipCardAt(index: number): void {
    // 安全检查
    if (index < 0 || index >= this.cards.length) return;

    const card = this.cards[index];

    // 不能翻已翻开、已匹配、或锁定状态的卡牌
    if (card.isFlipped || card.isMatched || this.isLocked) return;

    // 翻开卡牌
    card.isFlipped = true;
    card.flipDirection = 'open';
    card.flipProgress = 0;
    this.flippedIndices.push(index);

    // 同步光标
    this.cursorIndex = index;

    // 翻了两张牌，检查匹配
    if (this.flippedIndices.length === 2) {
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
      // 匹配成功
      card1.isMatched = true;
      card2.isMatched = true;
      this.matchedPairs++;
      this.flippedIndices = [];

      // 检查是否全部匹配完成
      if (this.matchedPairs >= TOTAL_PAIRS) {
        // 延迟一小段时间再显示胜利，让玩家看到最后一张翻开的动画
        setTimeout(() => {
          this.gameOver();
        }, FLIP_DURATION + 200);
      }
    } else {
      // 不匹配：锁定输入，延迟翻回
      this.isLocked = true;
      this.mismatchTimer = MISMATCH_DELAY;

      // 扣分
      this._score = Math.max(0, this._score - MISMATCH_PENALTY);
      this.emit('scoreChange', this._score);
    }
  }

  /**
   * 处理不匹配翻回逻辑（延迟后调用）
   */
  private resolveMismatch(): void {
    for (const index of this.flippedIndices) {
      const card = this.cards[index];
      card.flipDirection = 'close';
      // flipProgress 会在 update 中从 1 递减到 0
      card.flipProgress = 1;
      card.isFlipped = false;
    }
    this.flippedIndices = [];
    this.isLocked = false;
  }

  /**
   * 移动键盘光标
   */
  private moveCursor(delta: number): void {
    const newIndex = this.cursorIndex + delta;

    // 边界检查：不能超出网格范围
    if (newIndex < 0 || newIndex >= GRID_COLS * GRID_ROWS) return;

    // 水平移动时不能跨行
    const currentRow = Math.floor(this.cursorIndex / GRID_COLS);
    const newRow = Math.floor(newIndex / GRID_COLS);
    if (delta === -1 && currentRow !== newRow) return;
    if (delta === 1 && currentRow !== newRow) return;

    this.cursorIndex = newIndex;
  }

  // ========== 动画更新 ==========

  /**
   * 更新所有卡牌的翻牌动画进度
   */
  private updateFlipAnimations(deltaTime: number): void {
    const step = deltaTime / FLIP_DURATION; // 每毫秒的动画进度

    for (const card of this.cards) {
      if (card.flipDirection === 'open') {
        card.flipProgress += step;
        if (card.flipProgress >= 1) {
          card.flipProgress = 1;
          card.flipDirection = null;
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

  // ========== 卡牌创建与洗牌 ==========

  /**
   * 创建未洗牌的卡牌数组（8 对，顺序排列）
   */
  private createCards(): Card[] {
    const cards: Card[] = [];
    for (let i = 0; i < TOTAL_PAIRS; i++) {
      // 每个符号创建两张卡牌
      cards.push(this.createCard(i * 2, i));
      cards.push(this.createCard(i * 2 + 1, i));
    }
    return cards;
  }

  /**
   * 创建并洗牌的卡牌数组
   */
  private createShuffledCards(): Card[] {
    const cards = this.createCards();
    this.fisherYatesShuffle(cards);
    return cards;
  }

  /**
   * 创建单张卡牌
   */
  private createCard(id: number, symbolIndex: number): Card {
    return {
      id,
      symbolIndex,
      isFlipped: false,
      isMatched: false,
      flipProgress: 0,
      flipDirection: null,
    };
  }

  /**
   * Fisher-Yates 洗牌算法（原地打乱）
   */
  private fisherYatesShuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      // 生成 [0, i] 范围内的随机整数
      const j = Math.floor(Math.random() * (i + 1));
      // 交换位置
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // ========== 布局计算 ==========

  /**
   * 根据画布尺寸计算卡牌布局参数
   */
  private calculateLayout(): void {
    const totalGapX = CARD_GAP * (GRID_COLS - 1);
    this.cardWidth = (CANVAS_WIDTH - 2 * CARD_PADDING - totalGapX) / GRID_COLS;
    this.cardHeight = this.cardWidth; // 正方形卡牌
    this.gridStartX = CARD_PADDING;
  }

  /**
   * 获取指定行列卡牌的渲染坐标
   */
  private getCardPosition(index: number): { x: number; y: number } {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);
    return {
      x: this.gridStartX + col * (this.cardWidth + CARD_GAP),
      y: GRID_OFFSET_Y + row * (this.cardHeight + CARD_GAP),
    };
  }

  /**
   * 根据画布坐标找到对应的卡牌索引
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

  // ========== 渲染辅助方法 ==========

  /**
   * 绘制顶部信息栏（标题 + 分数 + 匹配数 + 用时）
   */
  private drawHeader(ctx: CanvasRenderingContext2D, w: number): void {
    // 信息栏背景
    ctx.fillStyle = COLORS.HEADER_BG;
    ctx.fillRect(0, 0, w, GRID_OFFSET_Y - 10);

    // 标题 "Memory Match"
    ctx.fillStyle = COLORS.TITLE;
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Memory Match', w / 2, 28);

    // 信息指标行
    const infoY = 65;
    const infoItems = [
      { label: '分数', value: this._score.toString() },
      { label: '匹配', value: `${this.matchedPairs}/${TOTAL_PAIRS}` },
      { label: '用时', value: this.formatTime(this._elapsedTime) },
    ];

    const itemWidth = w / infoItems.length;

    infoItems.forEach((item, i) => {
      const cx = itemWidth * i + itemWidth / 2;

      // 标签
      ctx.fillStyle = COLORS.LABEL;
      ctx.font = '12px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, cx, infoY - 10);

      // 数值
      ctx.fillStyle = COLORS.VALUE;
      ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
      ctx.fillText(item.value, cx, infoY + 12);
    });
  }

  /**
   * 绘制卡牌网格
   */
  private drawGrid(ctx: CanvasRenderingContext2D, _w: number): void {
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

    // 计算翻牌缩放效果
    let scaleX = 1;
    if (card.flipDirection === 'open') {
      // 0→0.5: 缩小到 0 (显示背面消失)
      // 0.5→1: 放大到 1 (显示正面出现)
      if (card.flipProgress < 0.5) {
        scaleX = 1 - card.flipProgress * 2;
      } else {
        scaleX = (card.flipProgress - 0.5) * 2;
      }
    } else if (card.flipDirection === 'close') {
      // 1→0.5: 缩小到 0 (显示正面消失)
      // 0.5→0: 放大到 1 (显示背面出现)
      if (card.flipProgress > 0.5) {
        scaleX = (card.flipProgress - 0.5) * 2;
      } else {
        scaleX = 1 - card.flipProgress * 2;
      }
    }

    // 确保最小缩放值，避免完全消失
    scaleX = Math.max(0.02, scaleX);

    // 判断当前应该显示正面还是背面
    const showFront =
      card.isMatched || card.flipProgress > 0.5 || (card.isFlipped && card.flipDirection === null);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX, 1);

    const halfW = this.cardWidth / 2;
    const halfH = this.cardHeight / 2;
    const radius = 8;

    if (showFront) {
      // ===== 正面 =====
      // 背景
      ctx.fillStyle = card.isMatched ? COLORS.MATCHED_BG : COLORS.CARD_FRONT;
      ctx.beginPath();
      ctx.roundRect(-halfW, -halfH, this.cardWidth, this.cardHeight, radius);
      ctx.fill();

      // 边框
      ctx.strokeStyle = card.isMatched ? COLORS.MATCHED_BORDER : COLORS.CARD_FRONT_BORDER;
      ctx.lineWidth = card.isMatched ? 3 : 1.5;
      ctx.beginPath();
      ctx.roundRect(-halfW, -halfH, this.cardWidth, this.cardHeight, radius);
      ctx.stroke();

      // Emoji 符号
      const emoji = CARD_SYMBOLS[card.symbolIndex];
      ctx.font = `${Math.floor(this.cardWidth * 0.5)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000000';
      ctx.fillText(emoji, 0, 2);
    } else {
      // ===== 背面 =====
      // 背景填充
      ctx.fillStyle = COLORS.CARD_BACK;
      ctx.beginPath();
      ctx.roundRect(-halfW, -halfH, this.cardWidth, this.cardHeight, radius);
      ctx.fill();

      // 边框
      ctx.strokeStyle = COLORS.CARD_BACK_BORDER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-halfW, -halfH, this.cardWidth, this.cardHeight, radius);
      ctx.stroke();

      // 背面装饰图案（菱形）
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      const patternSize = Math.min(halfW, halfH) * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -patternSize);
      ctx.lineTo(patternSize, 0);
      ctx.lineTo(0, patternSize);
      ctx.lineTo(-patternSize, 0);
      ctx.closePath();
      ctx.stroke();

      // 中心小圆点
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 光标选中高亮（红色边框）
    if (index === this.cursorIndex && this._status === 'playing') {
      ctx.strokeStyle = COLORS.CURSOR_BORDER;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-halfW, -halfH, this.cardWidth, this.cardHeight, radius);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 绘制胜利遮罩
   */
  private drawWinOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = COLORS.WIN_OVERLAY;
    ctx.fillRect(0, 0, w, h);

    // 胜利标题
    ctx.fillStyle = COLORS.WIN_TEXT;
    ctx.font = 'bold 42px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎉 恭喜通关！', w / 2, h / 2 - 50);

    // 最终分数
    ctx.fillStyle = COLORS.VALUE;
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`最终得分: ${this._score}`, w / 2, h / 2 + 10);

    // 用时
    ctx.fillStyle = COLORS.LABEL;
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`用时: ${this.formatTime(this._elapsedTime)}`, w / 2, h / 2 + 50);

    // 提示重新开始
    ctx.fillStyle = COLORS.TITLE;
    ctx.font = '16px "Segoe UI", Arial, sans-serif';
    ctx.fillText('点击「重新开始」再来一局', w / 2, h / 2 + 90);
  }

  // ========== 工具方法 ==========

  /**
   * 格式化时间为 mm:ss 格式
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
