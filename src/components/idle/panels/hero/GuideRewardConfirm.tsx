/**
 * GuideRewardConfirm — 引导完成奖励确认弹窗
 *
 * 从 GuideOverlay.tsx 拆分而来，解决单文件超过500行的问题。
 *
 * 功能：
 * - 引导完成后展示所有步骤奖励汇总
 * - 淡入+缩放动画效果
 * - 一键收取所有奖励
 *
 * @module components/idle/panels/hero/GuideRewardConfirm
 */

import React from 'react';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface GuideRewardConfirmProps {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 奖励文本（多行用 \n 分隔） */
  rewardText: string;
  /** 确认回调（收取奖励） */
  onConfirm: () => void;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

/**
 * GuideRewardConfirm — 引导完成奖励确认弹窗
 *
 * 显示所有步骤奖励汇总，用户点击"收下奖励"后关闭。
 */
export const GuideRewardConfirm: React.FC<GuideRewardConfirmProps> = ({
  visible,
  rewardText,
  onConfirm,
}) => {
  if (!visible) return null;

  return (
    <div className="tk-guide-overlay tk-guide-overlay--reward" role="dialog" aria-modal="true" aria-label="奖励确认">
      <div className="tk-guide-reward-confirm" data-testid="guide-reward-confirm">
        <div className="tk-guide-reward-confirm__icon">🎉</div>
        <div className="tk-guide-reward-confirm__title">引导完成！奖励已发放</div>
        <div className="tk-guide-reward-confirm__text">
          {rewardText.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        <button
          className="tk-guide-btn tk-guide-btn--next"
          onClick={onConfirm}
          data-testid="guide-reward-confirm-ok"
        >
          收下奖励
        </button>
      </div>
    </div>
  );
};

GuideRewardConfirm.displayName = 'GuideRewardConfirm';
export default GuideRewardConfirm;
