/**
 * 引擎层 — 引导遮罩与高亮系统
 *
 * 管理引导过程中的聚焦遮罩、元素高亮裁切和引导气泡：
 *   #15 聚焦遮罩 — 半透明黑色遮罩+目标元素高亮裁切+引导手指动画
 *   #16 引导气泡 — 目标元素旁气泡提示+文字说明+箭头指向+自动定位
 *
 * @module engine/guide/TutorialMaskSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  TutorialMaskConfig,
  TutorialBubbleConfig,
  BubblePosition,
  TutorialSubStep,
} from '../../core/guide';
import { DEFAULT_MASK_CONFIG } from '../../core/guide';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 高亮区域边界 */
export interface HighlightBounds {
  /** 左上角X坐标 */
  x: number;
  /** 左上角Y坐标 */
  y: number;
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
}

/** 遮罩渲染数据（供UI层消费） */
export interface MaskRenderData {
  /** 是否显示遮罩 */
  visible: boolean;
  /** 遮罩透明度 */
  opacity: number;
  /** 高亮区域边界 */
  highlightBounds: HighlightBounds | null;
  /** 高亮区域内边距 */
  padding: number;
  /** 高亮区域圆角 */
  borderRadius: number;
  /** 是否显示引导手指动画 */
  showHandAnimation: boolean;
  /** 手指动画目标位置（相对于高亮区域中心） */
  handTarget: { x: number; y: number } | null;
  /** 是否允许点击穿透（非高亮区域） */
  blockNonTargetClicks: boolean;
}

/** 气泡渲染数据（供UI层消费） */
export interface BubbleRenderData {
  /** 是否显示气泡 */
  visible: boolean;
  /** 气泡文本 */
  text: string;
  /** 气泡位置 */
  position: BubblePosition;
  /** 气泡箭头指向坐标 */
  arrowTarget: { x: number; y: number } | null;
  /** 气泡最大宽度 */
  maxWidth: number;
  /** 自动定位结果（计算后的实际位置） */
  computedPosition: BubblePosition;
}

/** 引导遮罩系统完整渲染数据 */
export interface TutorialOverlayRenderData {
  /** 遮罩渲染数据 */
  mask: MaskRenderData;
  /** 气泡渲染数据 */
  bubble: BubbleRenderData;
}

/** 元素位置查询回调 */
export type ElementBoundsProvider = (selector: string) => HighlightBounds | null;

/** 视口尺寸 */
export interface ViewportSize {
  width: number;
  height: number;
}

// ─────────────────────────────────────────────
// 内部状态
// ─────────────────────────────────────────────

/** 遮罩系统内部状态 */
interface TutorialMaskInternalState {
  /** 是否激活 */
  active: boolean;
  /** 当前遮罩配置 */
  maskConfig: TutorialMaskConfig;
  /** 当前气泡配置 */
  bubbleConfig: TutorialBubbleConfig | null;
  /** 当前高亮的目标选择器 */
  targetSelector: string | null;
  /** 当前高亮区域边界 */
  highlightBounds: HighlightBounds | null;
  /** 是否处于重玩简化遮罩模式 */
  simplifiedMode: boolean;
  /** 视口尺寸 */
  viewportSize: ViewportSize;
}

// ─────────────────────────────────────────────
// TutorialMaskSystem 类
// ─────────────────────────────────────────────

/**
 * 引导遮罩与高亮系统
 *
 * 管理引导过程中的聚焦遮罩、元素高亮裁切和引导气泡定位。
 * 本类只负责计算和提供渲染数据，不直接操作DOM。
 */
export class TutorialMaskSystem implements ISubsystem {
  readonly name = 'tutorial-mask';

  private deps!: ISystemDeps;
  private state: TutorialMaskInternalState = this.createInitialState();

  // ─── 生命周期 ───────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 遮罩系统为事件驱动，无需每帧更新
  }

  getState(): TutorialMaskInternalState {
    return { ...this.state };
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  // ─── 遮罩控制 API (#15) ─────────────────

  /**
   * 激活遮罩
   *
   * @param config - 遮罩配置（可选，使用默认值）
   */
  activate(config?: Partial<TutorialMaskConfig>): void {
    this.state.active = true;
    this.state.maskConfig = { ...DEFAULT_MASK_CONFIG, ...config };
  }

  /**
   * 停用遮罩
   */
  deactivate(): void {
    this.state.active = false;
    this.state.targetSelector = null;
    this.state.highlightBounds = null;
    this.state.bubbleConfig = null;
  }

  /**
   * 设置高亮目标
   *
   * @param selector - 目标元素CSS选择器
   * @param boundsProvider - 元素位置查询回调
   */
  setHighlightTarget(
    selector: string,
    boundsProvider: ElementBoundsProvider,
  ): { success: boolean; reason?: string } {
    if (!this.state.active) {
      return { success: false, reason: '遮罩未激活' };
    }

    const bounds = boundsProvider(selector);
    if (!bounds) {
      return { success: false, reason: `无法获取元素 ${selector} 的位置` };
    }

    this.state.targetSelector = selector;
    this.state.highlightBounds = this.applyPadding(bounds);

    return { success: true };
  }

  /**
   * 清除高亮目标
   */
  clearHighlightTarget(): void {
    this.state.targetSelector = null;
    this.state.highlightBounds = null;
  }

  /**
   * 设置简化遮罩模式（重玩模式使用）
   *
   * @param simplified - 是否简化
   */
  setSimplifiedMode(simplified: boolean): void {
    this.state.simplifiedMode = simplified;
    if (simplified) {
      this.state.maskConfig = {
        ...this.state.maskConfig,
        opacity: 0.5,
        showHandAnimation: false,
      };
    }
  }

  /**
   * 设置视口尺寸
   */
  setViewportSize(size: ViewportSize): void {
    this.state.viewportSize = size;
  }

  // ─── 气泡控制 API (#16) ─────────────────

  /**
   * 显示引导气泡
   *
   * @param config - 气泡配置
   */
  showBubble(config: TutorialBubbleConfig): void {
    this.state.bubbleConfig = config;
  }

  /**
   * 隐藏引导气泡
   */
  hideBubble(): void {
    this.state.bubbleConfig = null;
  }

  /**
   * 为子步骤设置遮罩和气泡
   *
   * @param subStep - 当前子步骤
   * @param boundsProvider - 元素位置查询回调
   */
  setupForSubStep(
    subStep: TutorialSubStep,
    boundsProvider: ElementBoundsProvider,
  ): { success: boolean; reason?: string } {
    // 激活遮罩
    if (!this.state.active) {
      this.activate();
    }

    // 设置高亮目标
    const targetResult = this.setHighlightTarget(subStep.targetSelector, boundsProvider);
    if (!targetResult.success) {
      return targetResult;
    }

    // 显示气泡
    this.showBubble({
      text: subStep.text,
      position: 'auto',
      arrowTarget: subStep.targetSelector,
      autoPosition: true,
      maxWidth: 280,
    });

    return { success: true };
  }

  // ─── 渲染数据 API ─────────────────────

  /**
   * 获取完整的遮罩+气泡渲染数据
   */
  getRenderData(): TutorialOverlayRenderData {
    const maskRenderData: MaskRenderData = {
      visible: this.state.active,
      opacity: this.state.simplifiedMode ? 0.5 : this.state.maskConfig.opacity,
      highlightBounds: this.state.highlightBounds,
      padding: this.state.maskConfig.padding,
      borderRadius: this.state.maskConfig.borderRadius,
      showHandAnimation: this.state.maskConfig.showHandAnimation && !this.state.simplifiedMode,
      handTarget: this.computeHandTarget(),
      blockNonTargetClicks: !this.state.simplifiedMode,
    };

    const bubbleRenderData: BubbleRenderData = this.computeBubbleRenderData();

    return {
      mask: maskRenderData,
      bubble: bubbleRenderData,
    };
  }

  /**
   * 获取遮罩渲染数据
   */
  getMaskRenderData(): MaskRenderData {
    return this.getRenderData().mask;
  }

  /**
   * 获取气泡渲染数据
   */
  getBubbleRenderData(): BubbleRenderData {
    return this.getRenderData().bubble;
  }

  // ─── 查询 API ───────────────────────────

  /**
   * 是否激活
   */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * 是否处于简化模式
   */
  isSimplifiedMode(): boolean {
    return this.state.simplifiedMode;
  }

  /**
   * 获取当前高亮目标选择器
   */
  getTargetSelector(): string | null {
    return this.state.targetSelector;
  }

  /**
   * 获取当前高亮区域
   */
  getHighlightBounds(): HighlightBounds | null {
    return this.state.highlightBounds;
  }

  // ─── 内部方法 ───────────────────────────

  /** 创建初始状态 */
  private createInitialState(): TutorialMaskInternalState {
    return {
      active: false,
      maskConfig: { ...DEFAULT_MASK_CONFIG },
      bubbleConfig: null,
      targetSelector: null,
      highlightBounds: null,
      simplifiedMode: false,
      viewportSize: { width: 375, height: 667 },
    };
  }

  /** 应用内边距到高亮区域 */
  private applyPadding(bounds: HighlightBounds): HighlightBounds {
    const padding = this.state.maskConfig.padding;
    return {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
    };
  }

  /** 计算引导手指动画目标位置 */
  private computeHandTarget(): { x: number; y: number } | null {
    if (!this.state.highlightBounds) return null;
    const { x, y, width, height } = this.state.highlightBounds;
    return {
      x: x + width / 2,
      y: y + height / 2,
    };
  }

  /** 计算气泡渲染数据 */
  private computeBubbleRenderData(): BubbleRenderData {
    const defaultBubble: BubbleRenderData = {
      visible: false,
      text: '',
      position: 'bottom',
      arrowTarget: null,
      maxWidth: 280,
      computedPosition: 'bottom',
    };

    if (!this.state.bubbleConfig || !this.state.active) {
      return defaultBubble;
    }

    const cfg = this.state.bubbleConfig;
    const computedPosition = cfg.autoPosition
      ? this.computeAutoPosition()
      : cfg.position;

    const arrowTarget = this.state.highlightBounds
      ? { x: this.state.highlightBounds.x + this.state.highlightBounds.width / 2,
          y: this.state.highlightBounds.y + this.state.highlightBounds.height / 2 }
      : null;

    return {
      visible: true,
      text: cfg.text,
      position: cfg.position,
      arrowTarget,
      maxWidth: cfg.maxWidth,
      computedPosition,
    };
  }

  /** 自动计算气泡位置 (#16) */
  private computeAutoPosition(): BubblePosition {
    if (!this.state.highlightBounds) return 'bottom';

    const { y, height } = this.state.highlightBounds;
    const viewportHeight = this.state.viewportSize.height;
    const bubbleEstimatedHeight = 80;

    const spaceAbove = y;
    const spaceBelow = viewportHeight - (y + height);

    // 优先放在下方
    if (spaceBelow >= bubbleEstimatedHeight) return 'bottom';
    // 空间不足则放在上方
    if (spaceAbove >= bubbleEstimatedHeight) return 'top';
    // 都不够则放在右侧
    return 'right';
  }
}
