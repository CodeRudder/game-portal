/**
 * 响应式布局管理器
 *
 * 职责：
 * - #1 7级断点体系检测与切换
 * - #2 画布缩放算法（PC/平板等比缩放 + 移动端流式布局 + 4K上限）
 * - #3 留白区域处理（居中+侧边装饰+背景填充+信息面板）
 * - #12 左手模式布局镜像
 * - #14 字体大小三档切换
 *
 * 设计原则：
 * - 纯计算引擎，不操作DOM
 * - 通过回调通知布局变更
 * - 可在测试环境中完整验证
 *
 * @module engine/responsive/ResponsiveLayoutManager
 */

import {
  Breakpoint,
  BREAKPOINT_WIDTHS,
  CANVAS_BASE_WIDTH,
  CANVAS_BASE_HEIGHT,
  SCALE_MAX,
  WhitespaceStrategy,
  type CanvasScaleResult,
  type ResponsiveLayoutSnapshot,
  type OnLayoutChange,
  FontSizeLevel,
  FONT_SIZE_MAP,
} from '../../core/responsive/responsive.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 断点检测顺序（从大到小） */
const BREAKPOINT_ORDER: Breakpoint[] = [
  Breakpoint.DesktopL,
  Breakpoint.Desktop,
  Breakpoint.TabletL,
  Breakpoint.Tablet,
  Breakpoint.MobileL,
  Breakpoint.Mobile,
  Breakpoint.MobileS,
];

/** 移动端断点集合 */
const MOBILE_BREAKPOINTS = new Set<Breakpoint>([
  Breakpoint.MobileL,
  Breakpoint.Mobile,
  Breakpoint.MobileS,
]);

/** 平板断点集合 */
const TABLET_BREAKPOINTS = new Set<Breakpoint>([
  Breakpoint.TabletL,
  Breakpoint.Tablet,
]);

/** 桌面端断点集合 */
const DESKTOP_BREAKPOINTS = new Set<Breakpoint>([
  Breakpoint.DesktopL,
  Breakpoint.Desktop,
]);

// ─────────────────────────────────────────────
// ResponsiveLayoutManager
// ─────────────────────────────────────────────

/**
 * 响应式布局管理器
 *
 * 管理断点检测、画布缩放、留白处理。
 * 纯计算引擎，不直接操作DOM。
 */
export class ResponsiveLayoutManager {
  // ── 内部状态 ──
  private _currentBreakpoint: Breakpoint = Breakpoint.Desktop;
  private _viewportWidth: number = CANVAS_BASE_WIDTH;
  private _viewportHeight: number = CANVAS_BASE_HEIGHT;
  private _devicePixelRatio: number = 1;
  private _orientation: 'portrait' | 'landscape' = 'landscape';
  private _leftHandMode: boolean = false;
  private _fontSize: FontSizeLevel = FontSizeLevel.Medium;

  // ── 回调列表 ──
  private readonly _listeners: Set<OnLayoutChange> = new Set();

  // ─────────────────────────────────────────
  // 公共属性
  // ─────────────────────────────────────────

  /** 当前断点 */
  get currentBreakpoint(): Breakpoint {
    return this._currentBreakpoint;
  }

  /** 当前视口宽度 */
  get viewportWidth(): number {
    return this._viewportWidth;
  }

  /** 当前视口高度 */
  get _viewportHeightValue(): number {
    return this._viewportHeight;
  }

  /** 是否移动端 */
  get isMobile(): boolean {
    return MOBILE_BREAKPOINTS.has(this._currentBreakpoint);
  }

  /** 是否平板 */
  get isTablet(): boolean {
    return TABLET_BREAKPOINTS.has(this._currentBreakpoint);
  }

  /** 是否桌面端 */
  get isDesktop(): boolean {
    return DESKTOP_BREAKPOINTS.has(this._currentBreakpoint);
  }

  /** 左手模式 */
  get leftHandMode(): boolean {
    return this._leftHandMode;
  }

  /** 字体大小档位 */
  get fontSize(): FontSizeLevel {
    return this._fontSize;
  }

  /** 字体像素值 */
  get fontSizePx(): number {
    return FONT_SIZE_MAP[this._fontSize];
  }

  // ─────────────────────────────────────────
  // 断点检测 (#1)
  // ─────────────────────────────────────────

  /**
   * 根据视口宽度计算断点
   *
   * @param width - 视口宽度（px）
   * @returns 匹配的断点
   */
  detectBreakpoint(width: number): Breakpoint {
    for (const bp of BREAKPOINT_ORDER) {
      if (width >= BREAKPOINT_WIDTHS[bp]) {
        return bp;
      }
    }
    // 兜底：最小断点
    return Breakpoint.MobileS;
  }

  /**
   * 更新视口尺寸并重新计算断点
   *
   * @param width - 新视口宽度
   * @param height - 新视口高度
   * @param devicePixelRatio - 设备像素比
   * @returns 是否发生了断点变更
   */
  updateViewport(
    width: number,
    height: number,
    devicePixelRatio: number = 1,
  ): boolean {
    const prevBreakpoint = this._currentBreakpoint;

    this._viewportWidth = width;
    this._viewportHeight = height;
    this._devicePixelRatio = devicePixelRatio;
    this._orientation = width >= height ? 'landscape' : 'portrait';
    this._currentBreakpoint = this.detectBreakpoint(width);

    const changed = prevBreakpoint !== this._currentBreakpoint;

    // 通知所有监听者
    if (changed) {
      this._notifyListeners();
    }

    return changed;
  }

  // ─────────────────────────────────────────
  // 画布缩放算法 (#2)
  // ─────────────────────────────────────────

  /**
   * 计算画布缩放参数
   *
   * PC/平板端：等比缩放 scale = min(viewW/1280, viewH/800)，上限2.0
   * 移动端：流式布局 scale=1, canvasW=viewW, canvasH=viewH
   *
   * @param viewportWidth - 视口宽度
   * @param viewportHeight - 视口高度
   * @param breakpoint - 当前断点（可选，自动检测）
   * @returns 缩放计算结果
   */
  calculateCanvasScale(
    viewportWidth: number,
    viewportHeight: number,
    breakpoint?: Breakpoint,
  ): CanvasScaleResult {
    const bp = breakpoint ?? this.detectBreakpoint(viewportWidth);

    // 移动端：流式布局
    if (MOBILE_BREAKPOINTS.has(bp)) {
      return {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        whitespaceStrategy: WhitespaceStrategy.CenterFilled,
        canvasWidth: viewportWidth,
        canvasHeight: viewportHeight,
      };
    }

    // PC/平板端：等比缩放
    const rawScale = Math.min(
      viewportWidth / CANVAS_BASE_WIDTH,
      viewportHeight / CANVAS_BASE_HEIGHT,
    );
    const scale = Math.min(rawScale, SCALE_MAX);

    const canvasWidth = CANVAS_BASE_WIDTH * scale;
    const canvasHeight = CANVAS_BASE_HEIGHT * scale;
    const offsetX = (viewportWidth - canvasWidth) / 2;
    const offsetY = (viewportHeight - canvasHeight) / 2;

    // 根据断点选择留白策略
    const whitespaceStrategy = this._selectWhitespaceStrategy(bp, scale);

    return {
      scale,
      offsetX: Math.max(0, offsetX),
      offsetY: Math.max(0, offsetY),
      whitespaceStrategy,
      canvasWidth,
      canvasHeight,
    };
  }

  // ─────────────────────────────────────────
  // 留白区域处理 (#3)
  // ─────────────────────────────────────────

  /**
   * 计算留白区域信息
   *
   * @param viewportWidth - 视口宽度
   * @param canvasWidth - 缩放后画布宽度
   * @returns 左右留白宽度
   */
  calculateWhitespace(viewportWidth: number, canvasWidth: number): {
    leftWidth: number;
    rightWidth: number;
    totalWidth: number;
  } {
    const totalWidth = Math.max(0, viewportWidth - canvasWidth);
    const leftWidth = totalWidth / 2;
    const rightWidth = totalWidth - leftWidth;
    return { leftWidth, rightWidth, totalWidth };
  }

  /**
   * 应用左手模式镜像偏移
   *
   * 左手模式下，左右留白互换
   *
   * @param whitespace - 原始留白
   * @returns 镜像后的留白
   */
  applyLeftHandMirror(whitespace: {
    leftWidth: number;
    rightWidth: number;
    totalWidth: number;
  }): { leftWidth: number; rightWidth: number; totalWidth: number } {
    if (!this._leftHandMode) {
      return whitespace;
    }
    return {
      leftWidth: whitespace.rightWidth,
      rightWidth: whitespace.leftWidth,
      totalWidth: whitespace.totalWidth,
    };
  }

  // ─────────────────────────────────────────
  // 设置操作
  // ─────────────────────────────────────────

  /**
   * 设置左手模式
   *
   * @param enabled - 是否启用
   */
  setLeftHandMode(enabled: boolean): void {
    this._leftHandMode = enabled;
    this._notifyListeners();
  }

  /**
   * 设置字体大小档位
   *
   * @param level - 字体大小档位
   */
  setFontSize(level: FontSizeLevel): void {
    this._fontSize = level;
    this._notifyListeners();
  }

  // ─────────────────────────────────────────
  // 快照
  // ─────────────────────────────────────────

  /**
   * 获取当前布局快照
   */
  getSnapshot(): ResponsiveLayoutSnapshot {
    const canvasScale = this.calculateCanvasScale(
      this._viewportWidth,
      this._viewportHeight,
      this._currentBreakpoint,
    );

    return {
      breakpoint: this._currentBreakpoint,
      viewportWidth: this._viewportWidth,
      viewportHeight: this._viewportHeight,
      isMobile: this.isMobile,
      isTablet: this.isTablet,
      isDesktop: this.isDesktop,
      canvasScale,
      devicePixelRatio: this._devicePixelRatio,
      orientation: this._orientation,
    };
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  /**
   * 注册布局变更监听器
   *
   * @param listener - 回调函数
   * @returns 取消注册函数
   */
  onLayoutChange(listener: OnLayoutChange): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * 清除所有监听器
   */
  clearListeners(): void {
    this._listeners.clear();
  }

  // ─────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────

  /**
   * 根据断点和缩放比选择留白策略
   */
  private _selectWhitespaceStrategy(
    bp: Breakpoint,
    _scale: number,
  ): WhitespaceStrategy {
    if (DESKTOP_BREAKPOINTS.has(bp)) {
      // 桌面端：侧边装饰纹理
      return WhitespaceStrategy.CenterDecorated;
    }
    if (TABLET_BREAKPOINTS.has(bp)) {
      // 平板端：背景填充
      return WhitespaceStrategy.CenterFilled;
    }
    return WhitespaceStrategy.CenterFilled;
  }

  /**
   * 通知所有监听器
   */
  private _notifyListeners(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this._listeners) {
      listener(snapshot);
    }
  }

  // ─────────────────────────────────────────
  // 静态工具方法
  // ─────────────────────────────────────────

  /**
   * 判断给定断点是否为移动端
   */
  static isMobileBreakpoint(bp: Breakpoint): boolean {
    return MOBILE_BREAKPOINTS.has(bp);
  }

  /**
   * 判断给定断点是否为平板端
   */
  static isTabletBreakpoint(bp: Breakpoint): boolean {
    return TABLET_BREAKPOINTS.has(bp);
  }

  /**
   * 判断给定断点是否为桌面端
   */
  static isDesktopBreakpoint(bp: Breakpoint): boolean {
    return DESKTOP_BREAKPOINTS.has(bp);
  }

  /**
   * 获取所有断点列表（从大到小）
   */
  static getAllBreakpoints(): Breakpoint[] {
    return [...BREAKPOINT_ORDER];
  }
}
