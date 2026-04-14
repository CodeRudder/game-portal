/**
 * Cookie Clicker 放置类游戏引擎
 *
 * 核心玩法：
 * - 点击/空格键产生饼干
 * - 购买升级自动生产饼干（每秒产量）
 * - 升级价格随购买次数递增 (base * 1.15^n)
 * - 上下键选择升级，回车购买
 * - 数字格式化 (K, M, B, T)
 */
import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COOKIES_PER_CLICK,
  PRICE_MULTIPLIER,
  PRODUCTION_TICK_MS,
  UPGRADES,
  UPGRADE_PANEL,
  COOKIE_DRAW,
  COLORS,
  NUMBER_SUFFIXES,
  type UpgradeDef,
} from './constants';

/** 升级购买记录 */
export interface UpgradeState {
  id: string;
  count: number;
}

/** 游戏状态（用于 getState / 序列化） */
export interface CookieClickerState {
  [key: string]: unknown;
  cookies: number;
  totalCookies: number;
  totalClicks: number;
  cps: number;
  upgrades: UpgradeState[];
  selectedIndex: number;
}

export class CookieClickerEngine extends GameEngine {
  // ========== 游戏状态 ==========

  /** 当前饼干数（浮点） */
  private _cookies: number = 0;
  /** 累计饼干总数 */
  private _totalCookies: number = 0;
  /** 累计点击次数 */
  private _totalClicks: number = 0;
  /** 每秒饼干产量 */
  private _cps: number = 0;
  /** 各升级已购数量 */
  private _upgradeCounts: number[] = [];
  /** 当前选中的升级索引 */
  private _selectedIndex: number = 0;
  /** 生产计时器（毫秒） */
  private _productionTimer: number = 0;
  /** 点击动画效果（缩放） */
  private _clickScale: number = 1;
  /** 点击动画计时器 */
  private _clickAnimTimer: number = 0;
  /** 飘字效果列表 */
  private _floatingTexts: Array<{ text: string; x: number; y: number; life: number; maxLife: number }> = [];
  /** Cookie 旋转角度 */
  private _cookieRotation: number = 0;

  // ========== 公开属性 ==========

  get cookies(): number {
    return this._cookies;
  }

  get totalCookies(): number {
    return this._totalCookies;
  }

  get totalClicks(): number {
    return this._totalClicks;
  }

  get cps(): number {
    return this._cps;
  }

  get selectedIndex(): number {
    return this._selectedIndex;
  }

  get upgradeCounts(): number[] {
    return [...this._upgradeCounts];
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    this._upgradeCounts = UPGRADES.map(() => 0);
    this._cookies = 0;
    this._totalCookies = 0;
    this._totalClicks = 0;
    this._cps = 0;
    this._selectedIndex = 0;
    this._productionTimer = 0;
    this._clickScale = 1;
    this._clickAnimTimer = 0;
    this._floatingTexts = [];
    this._cookieRotation = 0;
  }

  protected onStart(): void {
    // 重置状态（start 已由基类重置 score/level/elapsedTime）
    this.onInit();
  }

  protected onReset(): void {
    this.onInit();
  }

  // ========== 核心逻辑 ==========

  /** 鼠标点击事件（委托给 click） */
  handleClick(_canvasX: number, _canvasY: number): void {
    this.click();
  }

  /**
   * 点击产生饼干
   * @returns 本次获得的饼干数
   */
  click(): number {
    if (this._status !== 'playing') return 0;
    const gained = COOKIES_PER_CLICK;
    this._cookies += gained;
    this._totalCookies += gained;
    this._totalClicks++;
    this.addScore(gained);

    // 触发点击动画
    this._clickScale = 1.15;
    this._clickAnimTimer = 150;

    // 飘字效果
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    this._floatingTexts.push({
      text: `+${gained}`,
      x: COOKIE_DRAW.centerX + Math.cos(angle) * dist,
      y: COOKIE_DRAW.centerY + Math.sin(angle) * dist,
      life: 800,
      maxLife: 800,
    });

    this.emit('stateChange');
    return gained;
  }

  /**
   * 获取升级当前价格
   * @param index 升级索引
   */
  getUpgradePrice(index: number): number {
    if (index < 0 || index >= UPGRADES.length) return Infinity;
    const upgrade = UPGRADES[index];
    const count = this._upgradeCounts[index];
    return Math.floor(upgrade.basePrice * Math.pow(PRICE_MULTIPLIER, count));
  }

  /**
   * 购买升级
   * @param index 升级索引
   * @returns 是否购买成功
   */
  buyUpgrade(index: number): boolean {
    if (this._status !== 'playing') return false;
    if (index < 0 || index >= UPGRADES.length) return false;

    const price = this.getUpgradePrice(index);
    if (this._cookies < price) return false;

    this._cookies -= price;
    this._upgradeCounts[index]++;
    this.recalculateCps();
    this.emit('stateChange');
    return true;
  }

  /**
   * 重新计算每秒产量
   */
  private recalculateCps(): void {
    let total = 0;
    for (let i = 0; i < UPGRADES.length; i++) {
      total += UPGRADES[i].cps * this._upgradeCounts[i];
    }
    this._cps = Math.round(total * 10) / 10; // 保留1位小数
  }

  // ========== 游戏循环 ==========

  update(deltaTime: number): void {
    if (this._status !== 'playing') return;

    // 自动生产
    this._productionTimer += deltaTime;
    while (this._productionTimer >= PRODUCTION_TICK_MS) {
      this._productionTimer -= PRODUCTION_TICK_MS;
      const produced = this._cps; // 每秒产量
      if (produced > 0) {
        this._cookies += produced;
        this._totalCookies += produced;
        this.addScore(produced);
      }
    }

    // 点击动画衰减
    if (this._clickAnimTimer > 0) {
      this._clickAnimTimer -= deltaTime;
      if (this._clickAnimTimer <= 0) {
        this._clickScale = 1;
        this._clickAnimTimer = 0;
      } else {
        // 线性插值回 1
        this._clickScale = 1 + 0.15 * (this._clickAnimTimer / 150);
      }
    }

    // Cookie 缓慢旋转
    this._cookieRotation += deltaTime * 0.0002;

    // 飘字更新
    this._floatingTexts = this._floatingTexts.filter((ft) => {
      ft.life -= deltaTime;
      ft.y -= deltaTime * 0.04; // 向上飘动
      return ft.life > 0;
    });

    this.emit('stateChange');
  }

  // ========== 渲染 ==========

  onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    this.drawBackground(ctx, w, h);

    // Cookie
    this.drawCookie(ctx);

    // 飘字
    this.drawFloatingTexts(ctx);

    // 信息面板
    this.drawInfoPanel(ctx, w);

    // 升级列表
    this.drawUpgradeList(ctx, w, h);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, COLORS.bgGradient1);
    gradient.addColorStop(1, COLORS.bgGradient2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 装饰性背景圆点
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 30; i++) {
      const x = ((i * 73 + 17) % w);
      const y = ((i * 97 + 43) % h);
      const r = 2 + (i % 4);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.accent;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawCookie(ctx: CanvasRenderingContext2D): void {
    const cx = COOKIE_DRAW.centerX;
    const cy = COOKIE_DRAW.centerY;
    const r = COOKIE_DRAW.radius * this._clickScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this._cookieRotation);

    // 阴影
    ctx.beginPath();
    ctx.arc(4, 4, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Cookie 主体
    const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    gradient.addColorStop(0, COLORS.cookieHighlight);
    gradient.addColorStop(0.7, COLORS.cookie);
    gradient.addColorStop(1, COLORS.cookieShadow);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Cookie 边缘
    ctx.strokeStyle = COLORS.cookieShadow;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 巧克力碎片
    for (let i = 0; i < COOKIE_DRAW.chipCount; i++) {
      const angle = (i / COOKIE_DRAW.chipCount) * Math.PI * 2;
      const dist = r * 0.55;
      const chipX = Math.cos(angle) * dist;
      const chipY = Math.sin(angle) * dist;
      ctx.beginPath();
      ctx.arc(chipX, chipY, COOKIE_DRAW.chipRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#6b3a1f';
      ctx.fill();
    }

    ctx.restore();
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this._floatingTexts) {
      const alpha = ft.life / ft.maxLife;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.accentGold;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawInfoPanel(ctx: CanvasRenderingContext2D, w: number): void {
    // 饼干数量
    ctx.font = 'bold 36px "Segoe UI", monospace';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.textAlign = 'center';
    ctx.fillText(formatNumber(this._cookies), w / 2, 80);

    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText('cookies', w / 2, 100);

    // 每秒产量
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.accentGreen;
    ctx.fillText(`per second: ${formatNumber(this._cps)}`, w / 2, 120);

    // 总点击数
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`total clicks: ${this._totalClicks}`, w / 2, 138);
  }

  private drawUpgradeList(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const panel = UPGRADE_PANEL;

    // 标题
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.textAlign = 'center';
    ctx.fillText('— Upgrades —', w / 2, panel.startY - 10);

    for (let i = 0; i < UPGRADES.length; i++) {
      const upgrade = UPGRADES[i];
      const count = this._upgradeCounts[i];
      const price = this.getUpgradePrice(i);
      const affordable = this._cookies >= price;
      const selected = i === this._selectedIndex;

      const y = panel.startY + i * (panel.itemHeight + panel.itemPadding);
      const x = panel.itemMarginX;

      // 选中高亮
      if (selected) {
        ctx.fillStyle = COLORS.selectedBg;
        ctx.strokeStyle = COLORS.selectedBorder;
        ctx.lineWidth = 2;
        this.roundRect(ctx, x, y, panel.itemWidth, panel.itemHeight, 8);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.panelBg;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, panel.itemWidth, panel.itemHeight, 8);
        ctx.fill();
        ctx.stroke();
      }

      // 图标
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(upgrade.icon, x + 12, y + 33);

      // 名称 + 数量
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.fillText(`${upgrade.name}`, x + 46, y + 22);

      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(`×${count}  (+${formatNumber(upgrade.cps * count)}/s)`, x + 46, y + 40);

      // 价格（右对齐）
      ctx.font = 'bold 13px "Segoe UI", monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = affordable ? COLORS.affordable : COLORS.unaffordable;
      ctx.fillText(formatNumber(price), x + panel.itemWidth - 12, y + 32);
    }

    // 底部提示
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText('↑↓ 选择 · Enter 购买 · 空格 点击', w / 2, h - 12);
  }

  /** 圆角矩形辅助 */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ): void {
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

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case ' ':
        // 空格键 = 点击
        this.click();
        break;
      case 'ArrowUp':
        // 向上选择升级
        this._selectedIndex = Math.max(0, this._selectedIndex - 1);
        this.emit('stateChange');
        break;
      case 'ArrowDown':
        // 向下选择升级
        this._selectedIndex = Math.min(UPGRADES.length - 1, this._selectedIndex + 1);
        this.emit('stateChange');
        break;
      case 'Enter':
        // 回车购买选中的升级
        this.buyUpgrade(this._selectedIndex);
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // Cookie Clicker 无需处理 keyUp
  }

  // ========== 状态序列化 ==========

  getState(): CookieClickerState {
    return {
      cookies: this._cookies,
      totalCookies: this._totalCookies,
      totalClicks: this._totalClicks,
      cps: this._cps,
      upgrades: UPGRADES.map((u, i) => ({ id: u.id, count: this._upgradeCounts[i] })),
      selectedIndex: this._selectedIndex,
    };
  }

  /**
   * 从状态恢复（用于存档读取）
   */
  loadState(state: CookieClickerState): void {
    this._cookies = state.cookies;
    this._totalCookies = state.totalCookies;
    this._totalClicks = state.totalClicks;
    this._cps = state.cps;
    this._selectedIndex = state.selectedIndex ?? 0;
    for (const us of state.upgrades) {
      const idx = UPGRADES.findIndex((u) => u.id === us.id);
      if (idx >= 0) {
        this._upgradeCounts[idx] = us.count;
      }
    }
    this.recalculateCps();
    this.emit('stateChange');
  }
}

// ========== 工具函数 ==========

/**
 * 数字格式化：大数转换为 K / M / B / T 后缀表示
 * @param value 数值
 * @param decimals 小数位数（默认1）
 */
export function formatNumber(value: number, decimals: number = 1): string {
  if (value < 0) return '-' + formatNumber(-value, decimals);

  for (const [threshold, suffix] of NUMBER_SUFFIXES) {
    if (value >= threshold) {
      const formatted = value / threshold;
      // 检查是否为整数（考虑浮点精度）
      if (Math.abs(formatted - Math.round(formatted)) < 1e-9) {
        return `${Math.round(formatted)}${suffix}`;
      }
      return `${formatted.toFixed(decimals)}${suffix}`;
    }
  }

  // 小于 1000 的整数直接显示
  if (value === Math.floor(value)) {
    return Math.floor(value).toString();
  }

  // 小于 1000 的小数保留1位
  return value.toFixed(decimals);
}
