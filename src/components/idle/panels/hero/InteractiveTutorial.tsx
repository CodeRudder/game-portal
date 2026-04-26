/**
 * InteractiveTutorial — 交互式新手教程组件
 *
 * 功能：
 * - 全屏半透明遮罩
 * - 高亮当前步骤目标元素（通过 CSS 选择器定位）
 * - 引导气泡（步骤标题 + 描述 + 导航按钮）
 * - 步骤进度指示器（小圆点）
 * - 跳过 / 上一步 / 下一步 / 完成 按钮
 * - 完成动画（缩放 + 渐隐）
 *
 * @module components/idle/panels/hero/InteractiveTutorial
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './InteractiveTutorial.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 教程步骤定义 */
export interface TutorialStep {
  /** CSS 选择器，定位需要高亮的元素 */
  targetSelector: string;
  /** 步骤标题 */
  title: string;
  /** 步骤描述 */
  description: string;
  /** 气泡相对于高亮元素的位置 */
  position: 'top' | 'bottom' | 'left' | 'right';
}

/** 组件属性 */
export interface InteractiveTutorialProps {
  /** 教程步骤列表 */
  steps: TutorialStep[];
  /** 当前步骤索引（0-based） */
  currentStep: number;
  /** 下一步回调 */
  onNext: () => void;
  /** 上一步回调 */
  onPrev: () => void;
  /** 跳过回调 */
  onSkip: () => void;
  /** 完成回调 */
  onComplete: () => void;
}

/** 高亮区域坐标信息 */
interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ─────────────────────────────────────────────
// Helper: 计算气泡位置
// ─────────────────────────────────────────────

function getTooltipStyle(
  rect: HighlightRect,
  position: TutorialStep['position']
): React.CSSProperties {
  const gap = 12;
  switch (position) {
    case 'top':
      return { top: rect.top - gap, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' };
    case 'bottom':
      return { top: rect.top + rect.height + gap, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - gap, transform: 'translate(-100%, -50%)' };
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.left + rect.width + gap, transform: 'translateY(-50%)' };
    default:
      return { top: rect.top + rect.height + gap, left: rect.left, transform: 'translateX(-50%)' };
  }
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
  steps,
  currentStep,
  onNext,
  onPrev,
  onSkip,
  onComplete,
}) => {
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [completed, setCompleted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // 定位高亮目标元素
  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (el) {
      const { top, left, width, height } = el.getBoundingClientRect();
      setHighlightRect({ top, left, width, height });
    } else {
      // 目标元素未找到时居中显示
      setHighlightRect({ top: window.innerHeight / 2 - 30, left: window.innerWidth / 2 - 60, width: 120, height: 60 });
    }
  }, [step]);

  // 完成动画
  const handleComplete = useCallback(() => {
    setCompleted(true);
    setTimeout(() => {
      onComplete();
    }, 600);
  }, [onComplete]);

  // 无步骤时返回 null
  if (!step) return null;

  // ── 完成动画 ──
  if (completed) {
    return (
      <div className="it-overlay" data-testid="tutorial-overlay">
        <div className="it-complete-animation" data-testid="tutorial-complete">
          <span className="it-complete-icon">✅</span>
          <p className="it-complete-text">教程完成！</p>
        </div>
      </div>
    );
  }

  const tooltipStyle = highlightRect ? getTooltipStyle(highlightRect, step.position) : {};

  return (
    <div className="it-overlay" data-testid="tutorial-overlay">
      {/* 遮罩层（使用 box-shadow 模拟镂空效果） */}
      {highlightRect && (
        <div
          className="it-highlight"
          data-testid="tutorial-highlight"
          style={{
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
          }}
        />
      )}

      {/* 引导气泡 */}
      <div
        ref={tooltipRef}
        className={`it-tooltip it-tooltip--${step.position}`}
        data-testid="tutorial-tooltip"
        style={tooltipStyle}
      >
        {/* 标题 */}
        <h3 className="it-tooltip__title" data-testid="tutorial-title">
          {step.title}
        </h3>

        {/* 描述 */}
        <p className="it-tooltip__desc" data-testid="tutorial-description">
          {step.description}
        </p>

        {/* 步骤进度指示器 */}
        <div className="it-progress" data-testid="tutorial-progress">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`it-progress__dot ${i === currentStep ? 'it-progress__dot--active' : ''}`}
            />
          ))}
          <span className="it-progress__text" data-testid="tutorial-step-counter">
            {currentStep + 1}/{steps.length}
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="it-actions">
          {/* 跳过 */}
          <button
            className="it-btn it-btn--skip"
            data-testid="tutorial-skip"
            onClick={onSkip}
          >
            跳过
          </button>

          {/* 上一步（第 2 步起显示） */}
          {!isFirst && (
            <button
              className="it-btn it-btn--prev"
              data-testid="tutorial-prev"
              onClick={onPrev}
            >
              上一步
            </button>
          )}

          {/* 下一步 / 完成 */}
          {isLast ? (
            <button
              className="it-btn it-btn--complete"
              data-testid="tutorial-complete-btn"
              onClick={handleComplete}
            >
              完成
            </button>
          ) : (
            <button
              className="it-btn it-btn--next"
              data-testid="tutorial-next"
              onClick={onNext}
            >
              下一步
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractiveTutorial;
