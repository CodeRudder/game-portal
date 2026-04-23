/**
 * Tutorial mask - types and constants
 *
 * Extracted from TutorialMaskSystem.ts.
 */

import type { TutorialMaskConfig, BubblePosition, TutorialBubbleConfig, TutorialSubStep } from '../../core/guide/guide.types';
import { DEFAULT_MASK_CONFIG } from '../../core/guide';
// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

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
export interface TutorialMaskInternalState {
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
