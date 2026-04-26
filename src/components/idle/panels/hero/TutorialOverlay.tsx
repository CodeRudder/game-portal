/**
 * TutorialOverlay — 新手引导遮罩层组件
 *
 * 功能：
 * - 半透明遮罩层覆盖全屏
 * - 高亮目标区域（支持圆形/矩形）
 * - 引导文字提示框（带箭头指向目标）
 * - "下一步"和"跳过"按钮
 * - 步骤指示器（1/4, 2/4...）
 *
 * @module components/idle/panels/hero/TutorialOverlay
 */

import React, { useMemo } from 'react';
import './TutorialOverlay.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 高亮区域形状 */
export type HighlightShape = 'rect' | 'circle';

/** 目标区域坐标（相对于视口） */
export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TutorialOverlayProps {
  /** 当前步骤索引（0-based） */
  currentStep: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 步骤标题 */
  title: string;
  /** 步骤描述 */
  description: string;
  /** 高亮目标区域（不传则居中显示） */
  targetRect?: TargetRect;
  /** 高亮形状，默认 rect */
  highlightShape?: HighlightShape;
  /** 点击"下一步"回调 */
  onNext: () => void;
  /** 点击"跳过"回调 */
  onSkip: () => void;
}

// ─────────────────────────────────────────────
// Helper: 计算提示框位置与箭头方向
// ─────────────────────────────────────────────

interface TooltipPosition {
  top: number;
  left: number;
  arrowDir: 'up' | 'down' | 'left' | 'right' | 'none';
}

const TOOLTIP_WIDTH = 320;
const TOOLTIP_OFFSET = 16;

/**
 * 根据目标区域计算提示框位置，避免溢出视口
 */
function calcTooltipPosition(rect?: TargetRect): TooltipPosition {
  if (!rect) {
    return { top: 50, left: 50, arrowDir: 'none' };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  // 优先显示在目标下方
  if (cy + rect.height / 2 + TOOLTIP_OFFSET + 160 < vh) {
    return {
      top: rect.y + rect.height + TOOLTIP_OFFSET,
      left: Math.max(16, Math.min(cx - TOOLTIP_WIDTH / 2, vw - TOOLTIP_WIDTH - 16)),
      arrowDir: 'up',
    };
  }

  // 目标上方
  if (rect.y - TOOLTIP_OFFSET - 160 > 0) {
    return {
      top: rect.y - TOOLTIP_OFFSET - 160,
      left: Math.max(16, Math.min(cx - TOOLTIP_WIDTH / 2, vw - TOOLTIP_WIDTH - 16)),
      arrowDir: 'down',
    };
  }

  // 目标右侧
  if (rect.x + rect.width + TOOLTIP_OFFSET + TOOLTIP_WIDTH < vw) {
    return {
      top: cy - 60,
      left: rect.x + rect.width + TOOLTIP_OFFSET,
      arrowDir: 'left',
    };
  }

  // 目标左侧
  return {
    top: cy - 60,
    left: Math.max(16, rect.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET),
    arrowDir: 'right',
  };
}

// ─────────────────────────────────────────────
// Sub: 高亮区域
// ─────────────────────────────────────────────

interface HighlightAreaProps {
  rect: TargetRect;
  shape: HighlightShape;
}

const HighlightArea: React.FC<HighlightAreaProps> = ({ rect, shape }) => {
  const style: React.CSSProperties =
    shape === 'circle'
      ? {
          position: 'absolute',
          left: rect.x + rect.width / 2,
          top: rect.y + rect.height / 2,
          width: Math.max(rect.width, rect.height),
          height: Math.max(rect.width, rect.height),
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          border: '2px solid rgba(196, 149, 106, 0.7)',
          pointerEvents: 'none',
          zIndex: 10,
        }
      : {
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          borderRadius: 8,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          border: '2px solid rgba(196, 149, 106, 0.7)',
          pointerEvents: 'none',
          zIndex: 10,
        };

  return <div className="tk-tutorial-highlight" style={style} data-testid="tutorial-highlight" />;
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  currentStep,
  totalSteps,
  title,
  description,
  targetRect,
  highlightShape = 'rect',
  onNext,
  onSkip,
}) => {
  const isLastStep = currentStep >= totalSteps - 1;

  // 提示框位置
  const pos = useMemo(() => calcTooltipPosition(targetRect), [targetRect]);
  const isCentered = !targetRect;

  // 步骤指示器文本
  const stepIndicator = `${currentStep + 1}/${totalSteps}`;

  return (
    <div
      className="tk-tutorial-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Tutorial step ${currentStep + 1}`}
      data-testid="tutorial-overlay"
    >
      {/* 半透明遮罩 */}
      <div className="tk-tutorial-backdrop" onClick={onSkip} data-testid="tutorial-backdrop" />

      {/* 高亮目标区域 */}
      {targetRect && <HighlightArea rect={targetRect} shape={highlightShape} />}

      {/* 提示框 */}
      <div
        className={[
          'tk-tutorial-tooltip',
          `tk-tutorial-tooltip--arrow-${pos.arrowDir}`,
          isCentered ? 'tk-tutorial-tooltip--centered' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={
          isCentered
            ? undefined
            : { position: 'absolute', top: pos.top, left: pos.left }
        }
        data-testid="tutorial-tooltip"
      >
        {/* 步骤指示器 */}
        <div className="tk-tutorial-step-indicator" data-testid="tutorial-step-indicator">
          {stepIndicator}
        </div>

        {/* 标题 */}
        <h3 className="tk-tutorial-tooltip__title">{title}</h3>

        {/* 描述 */}
        <p className="tk-tutorial-tooltip__desc">{description}</p>

        {/* 操作按钮 */}
        <div className="tk-tutorial-tooltip__actions">
          <button
            className="tk-tutorial-btn tk-tutorial-btn--skip"
            onClick={onSkip}
            data-testid="tutorial-btn-skip"
          >
            跳过
          </button>
          <button
            className="tk-tutorial-btn tk-tutorial-btn--next"
            onClick={onNext}
            data-testid="tutorial-btn-next"
          >
            {isLastStep ? '完成' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
};

TutorialOverlay.displayName = 'TutorialOverlay';

export default TutorialOverlay;
