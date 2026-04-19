/**
 * CanvasUIRenderer — Canvas UI 渲染工具类
 *
 * 纯静态工具类，提供放置游戏常用 UI 绘制方法：
 * - 圆角矩形路径
 * - 资源面板（顶部资源条）
 * - 建筑列表（可滚动建筑卡片）
 * - 飘字效果
 * - 徽章（声望等级、成就标记）
 * - 底部操作提示
 * - 标题栏
 * - 渐变背景
 * - 进度条
 * - 面板背景
 *
 * 设计原则：
 * - 纯静态方法，无状态，不依赖任何外部库
 * - 只使用 Canvas 2D API
 * - 不使用任何 neon/glow/闪烁效果
 */

// ============================================================
// 类型定义
// ============================================================

/** 资源显示项 */
export interface ResourceDisplayItem {
  id: string;
  icon: string;
  name: string;
  amount: string;          // 已格式化的数量文本
  perSecond: string;       // 已格式化的产出文本（如 "+1.5K/s"），空字符串表示无产出
  color?: string;          // 自定义颜色
}

/** 建筑列表项 */
export interface BuildingDisplayItem {
  id: string;
  icon: string;
  name: string;
  level: number;
  productionText: string;  // 如 "Lv.5 (+2.3K/s)"
  costText: string;        // 如 "🐟1.5K"
  affordable: boolean;
  selected: boolean;
}

/** 飘字效果 */
export interface FloatingText {
  text: string;
  x: number;
  y: number;
  life: number;            // 剩余生命（ms）
  maxLife: number;         // 总生命（ms）
  color: string;
}

/** 徽章 */
export interface BadgeOptions {
  text: string;
  x: number;
  y: number;
  color: string;
  bgColor?: string;
  fontSize?: number;
  padding?: number;
  radius?: number;
}

/** 资源面板配置 */
export interface ResourcePanelConfig {
  startX: number;
  startY: number;
  itemWidth: number;
  fontLarge?: string;
  fontSmall?: string;
  colorPrimary?: string;
  colorProduction?: string;
}

/** 建筑列表配置 */
export interface BuildingListConfig {
  startY: number;
  itemWidth: number;
  itemHeight: number;
  itemPadding: number;
  itemMarginX: number;
  title?: string;
  colorSelectedBg?: string;
  colorSelectedBorder?: string;
  colorPanelBg?: string;
  colorAffordable?: string;
  colorUnaffordable?: string;
}

/** UI 主题颜色 */
export interface UIColorScheme {
  bgGradient1: string;
  bgGradient2: string;
  textPrimary: string;
  textSecondary: string;
  textDim: string;
  accentGold: string;
  accentGreen: string;
  panelBg: string;
  selectedBg: string;
  selectedBorder: string;
  affordable: string;
  unaffordable: string;
}

// ============================================================
// 默认颜色常量
// ============================================================

/** 默认主题色 */
const DEFAULT_COLORS: UIColorScheme = {
  bgGradient1: '#1a1a2e',
  bgGradient2: '#16213e',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0a0',
  textDim: '#666666',
  accentGold: '#f0c040',
  accentGreen: '#4caf50',
  panelBg: 'rgba(30, 30, 50, 0.85)',
  selectedBg: 'rgba(240, 192, 64, 0.15)',
  selectedBorder: '#f0c040',
  affordable: '#4caf50',
  unaffordable: '#888888',
};

// ============================================================
// CanvasUIRenderer 静态工具类
// ============================================================

/**
 * Canvas UI 渲染器
 *
 * 所有方法均为 static，不持有任何状态。
 * 调用方负责管理 Canvas 上下文和绘制时机。
 */
export class CanvasUIRenderer {
  // ================================================================
  // 1. roundRect — 绘制圆角矩形路径
  // ================================================================

  /**
   * 在 Canvas 上下文中创建圆角矩形路径。
   * 仅创建路径，不执行 fill 或 stroke，由调用方决定如何渲染。
   *
   * @param ctx   - Canvas 2D 上下文
   * @param x     - 矩形左上角 X 坐标
   * @param y     - 矩形左上角 Y 坐标
   * @param w     - 矩形宽度
   * @param h     - 矩形高度
   * @param r     - 圆角半径（如果超过宽高一半则自动裁剪）
   */
  static roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    // 确保半径不超过宽高的一半
    const maxRadius = Math.min(Math.abs(w) / 2, Math.abs(h) / 2);
    const radius = Math.max(0, Math.min(r, maxRadius));

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }

  // ================================================================
  // 2. drawResourcePanel — 绘制资源面板
  // ================================================================

  /**
   * 绘制顶部资源面板，自动横向排列多个资源项。
   * 每个资源项显示：图标 + 名称 + 数量 + 每秒产出。
   *
   * @param ctx       - Canvas 2D 上下文
   * @param resources - 资源显示项数组
   * @param config    - 资源面板布局配置
   */
  static drawResourcePanel(
    ctx: CanvasRenderingContext2D,
    resources: ResourceDisplayItem[],
    config: ResourcePanelConfig,
  ): void {
    if (resources.length === 0) return;

    const {
      startX,
      startY,
      itemWidth,
      fontLarge = 'bold 16px "Segoe UI", Arial, sans-serif',
      fontSmall = '12px "Segoe UI", Arial, sans-serif',
      colorPrimary = DEFAULT_COLORS.textPrimary,
      colorProduction = DEFAULT_COLORS.accentGreen,
    } = config;

    const itemHeight = 64;
    const itemGap = 8;
    const innerPadding = 10;

    for (let i = 0; i < resources.length; i++) {
      const res = resources[i];
      const x = startX + i * (itemWidth + itemGap);
      const y = startY;

      // 绘制资源项背景面板
      CanvasUIRenderer.drawPanel(
        ctx,
        x,
        y,
        itemWidth,
        itemHeight,
        DEFAULT_COLORS.panelBg,
        'rgba(255, 255, 255, 0.08)',
        8,
      );

      // 图标（emoji）
      ctx.font = '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(res.icon, x + innerPadding, y + 22);

      // 资源名称
      ctx.font = fontSmall;
      ctx.fillStyle = DEFAULT_COLORS.textSecondary;
      ctx.fillText(res.name, x + innerPadding + 28, y + 16);

      // 资源数量
      ctx.font = fontLarge;
      ctx.fillStyle = res.color ?? colorPrimary;
      ctx.fillText(res.amount, x + innerPadding + 28, y + 36);

      // 每秒产出
      if (res.perSecond) {
        ctx.font = fontSmall;
        ctx.fillStyle = colorProduction;
        ctx.fillText(res.perSecond, x + innerPadding + 28, y + 52);
      }
    }
  }

  // ================================================================
  // 3. drawBuildingList — 绘制建筑列表
  // ================================================================

  /**
   * 绘制建筑列表，支持选中高亮和可购买/不可购买颜色区分。
   * 自动根据 canvasWidth 计算每行可容纳的建筑卡片数量。
   *
   * @param ctx         - Canvas 2D 上下文
   * @param buildings   - 建筑显示项数组
   * @param config      - 建筑列表布局配置
   * @param canvasWidth - 画布宽度（用于计算每行卡片数）
   */
  static drawBuildingList(
    ctx: CanvasRenderingContext2D,
    buildings: BuildingDisplayItem[],
    config: BuildingListConfig,
    canvasWidth: number,
  ): void {
    if (buildings.length === 0) return;

    const {
      startY,
      itemWidth,
      itemHeight,
      itemPadding,
      itemMarginX,
      title,
      colorSelectedBg = DEFAULT_COLORS.selectedBg,
      colorSelectedBorder = DEFAULT_COLORS.selectedBorder,
      colorPanelBg = DEFAULT_COLORS.panelBg,
      colorAffordable = DEFAULT_COLORS.affordable,
      colorUnaffordable = DEFAULT_COLORS.unaffordable,
    } = config;

    // 计算每行可容纳的卡片数
    const itemsPerRow = Math.max(1, Math.floor(
      (canvasWidth - itemMarginX) / (itemWidth + itemMarginX),
    ));

    // 如果有标题，先绘制标题
    let currentY = startY;
    if (title) {
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = DEFAULT_COLORS.textPrimary;
      ctx.fillText(title, itemMarginX, currentY + 10);
      currentY += 28;
    }

    for (let i = 0; i < buildings.length; i++) {
      const building = buildings[i];
      const col = i % itemsPerRow;
      const row = Math.floor(i / itemsPerRow);

      const x = itemMarginX + col * (itemWidth + itemMarginX);
      const y = currentY + row * (itemHeight + itemPadding);

      // 绘制卡片背景
      if (building.selected) {
        // 选中状态：使用高亮背景
        CanvasUIRenderer.drawPanel(
          ctx,
          x,
          y,
          itemWidth,
          itemHeight,
          colorSelectedBg,
          colorSelectedBorder,
          8,
        );
      } else {
        // 普通状态
        CanvasUIRenderer.drawPanel(
          ctx,
          x,
          y,
          itemWidth,
          itemHeight,
          colorPanelBg,
          'rgba(255, 255, 255, 0.06)',
          8,
        );
      }

      // 绘制图标
      ctx.font = '20px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(building.icon, x + 10, y + 20);

      // 绘制建筑名称
      ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = building.selected
        ? DEFAULT_COLORS.accentGold
        : DEFAULT_COLORS.textPrimary;
      ctx.fillText(building.name, x + 36, y + 16);

      // 绘制等级与产出文本
      ctx.font = '11px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = DEFAULT_COLORS.textSecondary;
      ctx.fillText(building.productionText, x + 36, y + 32);

      // 绘制费用文本（根据可购买状态使用不同颜色）
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = building.affordable ? colorAffordable : colorUnaffordable;
      ctx.fillText(building.costText, x + 10, y + itemHeight - 12);
    }
  }

  // ================================================================
  // 4. drawFloatingTexts — 绘制飘字效果
  // ================================================================

  /**
   * 绘制飘字效果列表。
   * 根据 life / maxLife 计算透明度，越接近消亡越透明。
   * 飘字会随生命值减少向上漂移。
   *
   * @param ctx   - Canvas 2D 上下文
   * @param texts - 飘字效果数组
   */
  static drawFloatingTexts(
    ctx: CanvasRenderingContext2D,
    texts: FloatingText[],
  ): void {
    for (const ft of texts) {
      if (ft.life <= 0) continue;

      // 计算透明度：从 1.0 线性衰减到 0.0
      const alpha = Math.max(0, Math.min(1, ft.life / ft.maxLife));

      // 计算向上漂移的偏移量（最大漂移 40px）
      const drift = (1 - ft.life / ft.maxLife) * 40;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 绘制文字阴影以增强可读性
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillText(ft.text, ft.x + 1, ft.y - drift + 1);

      // 绘制文字本体
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y - drift);

      ctx.restore();
    }
  }

  // ================================================================
  // 5. drawBadge — 绘制徽章
  // ================================================================

  /**
   * 绘制胶囊形徽章（如声望等级、成就标记）。
   * 包含圆角矩形背景 + 居中文字。
   *
   * @param ctx     - Canvas 2D 上下文
   * @param options - 徽章配置选项
   */
  static drawBadge(
    ctx: CanvasRenderingContext2D,
    options: BadgeOptions,
  ): void {
    const {
      text,
      x,
      y,
      color,
      bgColor = 'rgba(0, 0, 0, 0.6)',
      fontSize = 12,
      padding = 6,
      radius = 10,
    } = options;

    // 先测量文字宽度以确定背景尺寸
    ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const badgeWidth = textWidth + padding * 2;
    const badgeHeight = fontSize + padding * 2;

    // 绘制背景胶囊
    const bgX = x - badgeWidth / 2;
    const bgY = y - badgeHeight / 2;
    CanvasUIRenderer.roundRect(ctx, bgX, bgY, badgeWidth, badgeHeight, radius);
    ctx.fillStyle = bgColor;
    ctx.fill();

    // 绘制文字
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  // ================================================================
  // 6. drawBottomHint — 绘制底部操作提示
  // ================================================================

  /**
   * 在画布底部绘制操作提示文字。
   *
   * @param ctx           - Canvas 2D 上下文
   * @param text          - 提示文字内容
   * @param canvasWidth   - 画布宽度
   * @param canvasHeight  - 画布高度
   * @param color         - 文字颜色（可选，默认灰色）
   */
  static drawBottomHint(
    ctx: CanvasRenderingContext2D,
    text: string,
    canvasWidth: number,
    canvasHeight: number,
    color?: string,
  ): void {
    ctx.font = '13px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = color ?? DEFAULT_COLORS.textDim;
    ctx.fillText(text, canvasWidth / 2, canvasHeight - 12);
  }

  // ================================================================
  // 7. drawTitle — 绘制标题栏
  // ================================================================

  /**
   * 在画布顶部绘制居中标题。
   *
   * @param ctx           - Canvas 2D 上下文
   * @param title         - 标题文本
   * @param canvasWidth   - 画布宽度
   * @param y             - 标题 Y 坐标（可选，默认 30）
   * @param color         - 标题颜色（可选，默认金色）
   */
  static drawTitle(
    ctx: CanvasRenderingContext2D,
    title: string,
    canvasWidth: number,
    y?: number,
    color?: string,
  ): void {
    const titleY = y ?? 30;
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color ?? DEFAULT_COLORS.accentGold;
    ctx.fillText(title, canvasWidth / 2, titleY);
  }

  // ================================================================
  // 8. drawGradientBg — 绘制线性渐变背景
  // ================================================================

  /**
   * 绘制从上到下的线性渐变背景，覆盖整个画布区域。
   *
   * @param ctx     - Canvas 2D 上下文
   * @param w       - 画布宽度
   * @param h       - 画布高度
   * @param color1  - 渐变起始色（顶部）
   * @param color2  - 渐变结束色（底部）
   */
  static drawGradientBg(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    color1: string,
    color2: string,
  ): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  // ================================================================
  // 9. drawProgressBar — 绘制进度条
  // ================================================================

  /**
   * 绘制水平进度条。
   * 包含背景轨道、填充条和可选边框。
   *
   * @param ctx         - Canvas 2D 上下文
   * @param x           - 进度条左上角 X 坐标
   * @param y           - 进度条左上角 Y 坐标
   * @param w           - 进度条宽度
   * @param h           - 进度条高度
   * @param progress    - 进度值 [0, 1]
   * @param fillColor   - 填充颜色
   * @param bgColor     - 背景颜色（可选）
   * @param borderColor - 边框颜色（可选）
   */
  static drawProgressBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    progress: number,
    fillColor: string,
    bgColor?: string,
    borderColor?: string,
  ): void {
    // 裁剪进度值到 [0, 1] 区间
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const barRadius = h / 2;

    // 绘制背景轨道
    CanvasUIRenderer.roundRect(ctx, x, y, w, h, barRadius);
    ctx.fillStyle = bgColor ?? 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    // 绘制填充条（仅在 progress > 0 时绘制）
    if (clampedProgress > 0) {
      const fillWidth = Math.max(h, w * clampedProgress);
      CanvasUIRenderer.roundRect(ctx, x, y, fillWidth, h, barRadius);
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    // 绘制边框（可选）
    if (borderColor) {
      CanvasUIRenderer.roundRect(ctx, x, y, w, h, barRadius);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // ================================================================
  // 10. drawPanel — 绘制面板背景
  // ================================================================

  /**
   * 绘制圆角矩形面板，支持自定义背景色、边框色和圆角半径。
   * 同时执行 fill 和 stroke（如果提供了 borderColor）。
   *
   * @param ctx         - Canvas 2D 上下文
   * @param x           - 面板左上角 X 坐标
   * @param y           - 面板左上角 Y 坐标
   * @param w           - 面板宽度
   * @param h           - 面板高度
   * @param bgColor     - 背景颜色（可选，默认半透明深色）
   * @param borderColor - 边框颜色（可选，不提供则不绘制边框）
   * @param radius      - 圆角半径（可选，默认 8）
   */
  static drawPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    bgColor?: string,
    borderColor?: string,
    radius?: number,
  ): void {
    const r = radius ?? 8;

    // 绘制背景填充
    CanvasUIRenderer.roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = bgColor ?? DEFAULT_COLORS.panelBg;
    ctx.fill();

    // 绘制边框（如果提供了边框颜色）
    if (borderColor) {
      CanvasUIRenderer.roundRect(ctx, x, y, w, h, r);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
