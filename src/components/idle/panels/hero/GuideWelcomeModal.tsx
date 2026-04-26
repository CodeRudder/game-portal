/**
 * GuideWelcomeModal — 新手引导欢迎弹窗
 *
 * 首次进入游戏时显示的欢迎弹窗，引导用户开始新手教程。
 * 包含欢迎标题、简要介绍、开始引导按钮和跳过按钮。
 *
 * 功能：
 * - 三国主题欢迎界面
 * - 引导概览（步骤数量和内容预览）
 * - 开始引导/跳过引导按钮
 * - 淡入+缩放动画效果
 * - ARIA无障碍支持
 * - 移动端安全区域适配
 *
 * @module components/idle/panels/hero/GuideWelcomeModal
 */

import React from 'react';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface GuideWelcomeModalProps {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 引导步骤数量 */
  stepCount: number;
  /** 点击开始引导回调 */
  onStart: () => void;
  /** 点击跳过回调 */
  onSkip: () => void;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

/**
 * GuideWelcomeModal — 新手引导欢迎弹窗
 *
 * 首次进入游戏时展示欢迎界面，提供引导概览和操作入口。
 */
export const GuideWelcomeModal: React.FC<GuideWelcomeModalProps> = ({
  visible,
  stepCount,
  onStart,
  onSkip,
}) => {
  if (!visible) return null;

  return (
    <div
      className="tk-guide-overlay tk-guide-overlay--welcome"
      role="dialog"
      aria-modal="true"
      aria-label="新手引导欢迎"
    >
      <div className="tk-guide-welcome" data-testid="guide-welcome-modal">
        {/* 装饰图标 */}
        <div className="tk-guide-welcome__decor">
          <span className="tk-guide-welcome__decor-icon">⚔️</span>
          <span className="tk-guide-welcome__decor-sub">三国霸业</span>
        </div>

        {/* 欢迎标题 */}
        <h2 className="tk-guide-welcome__title" data-testid="guide-welcome-title">
          🏯 欢迎来到三国霸业
        </h2>

        {/* 引导介绍 */}
        <p className="tk-guide-welcome__desc" data-testid="guide-welcome-desc">
          主公，天下大势，合久必分，分久必合。
          <br />
          让我们用 <strong>{stepCount}</strong> 个简单步骤，
          <br />
          带您快速掌握争霸天下的核心玩法！
        </p>

        {/* 步骤预览 */}
        <div className="tk-guide-welcome__preview" data-testid="guide-welcome-preview">
          <div className="tk-guide-welcome__preview-item">
            <span className="tk-guide-welcome__preview-icon">🎮</span>
            <span>招募武将</span>
          </div>
          <div className="tk-guide-welcome__preview-item">
            <span className="tk-guide-welcome__preview-icon">📋</span>
            <span>查看属性</span>
          </div>
          <div className="tk-guide-welcome__preview-item">
            <span className="tk-guide-welcome__preview-icon">✅</span>
            <span>强化升级</span>
          </div>
          <div className="tk-guide-welcome__preview-item">
            <span className="tk-guide-welcome__preview-icon">⚔️</span>
            <span>排兵布阵</span>
          </div>
          <div className="tk-guide-welcome__preview-item">
            <span className="tk-guide-welcome__preview-icon">💰</span>
            <span>资源管理</span>
          </div>
          <div className="tk-guide-welcome__preview-item">
            <span className="tk-guide-welcome__preview-icon">🔬</span>
            <span>科技研究</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="tk-guide-welcome__actions">
          <button
            className="tk-guide-btn tk-guide-btn--next tk-guide-welcome__btn-start"
            data-testid="guide-welcome-start"
            onClick={onStart}
          >
            🚀 开始引导
          </button>
          <button
            className="tk-guide-btn tk-guide-btn--skip tk-guide-welcome__btn-skip"
            data-testid="guide-welcome-skip"
            onClick={onSkip}
          >
            跳过，稍后再说
          </button>
        </div>
      </div>
    </div>
  );
};

GuideWelcomeModal.displayName = 'GuideWelcomeModal';
export default GuideWelcomeModal;
