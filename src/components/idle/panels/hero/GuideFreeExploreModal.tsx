/**
 * GuideFreeExploreModal — 引导完成后自由探索过渡弹窗
 *
 * 在新手引导全部完成后显示，告知用户引导已结束，
 * 接下来可以自由探索游戏世界。
 *
 * 功能：
 * - 庆祝动画 + 祝贺文案
 * - 推荐行动引导（3个推荐方向）
 * - 平滑过渡到自由游戏阶段
 *
 * @module components/idle/panels/hero/GuideFreeExploreModal
 */

import React from 'react';
import { DEFAULT_RECOMMENDED_ACTIONS } from '@/games/three-kingdoms/core/guide';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface GuideFreeExploreModalProps {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 确认回调（开始自由探索） */
  onConfirm: () => void;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

/**
 * GuideFreeExploreModal — 自由探索过渡弹窗
 *
 * 引导完成后展示，引导用户进入自由探索阶段。
 * 显示3个推荐行动方向，帮助用户平滑过渡。
 */
export const GuideFreeExploreModal: React.FC<GuideFreeExploreModalProps> = ({
  visible,
  onConfirm,
}) => {
  if (!visible) return null;

  return (
    <div className="tk-guide-overlay tk-guide-overlay--free-explore" role="dialog" aria-modal="true" aria-label="自由探索">
      <div className="tk-guide-free-explore" data-testid="guide-free-explore">
        {/* 庆祝图标 */}
        <div className="tk-guide-free-explore__icon">🎊</div>

        {/* 标题 */}
        <div className="tk-guide-free-explore__title">
          恭喜完成引导！接下来自由探索吧
        </div>

        {/* 描述 */}
        <div className="tk-guide-free-explore__desc">
          你已经掌握了基本玩法，接下来可以自由探索三国世界。
          以下是推荐的探索方向：
        </div>

        {/* 推荐行动列表 */}
        <div className="tk-guide-free-explore__actions-list">
          {DEFAULT_RECOMMENDED_ACTIONS.map((action) => (
            <div key={action.id} className="tk-guide-free-explore__action-item">
              <span className="tk-guide-free-explore__action-icon">
                {action.id === 'upgrade_building' && '🏗️'}
                {action.id === 'recruit_more' && '⚔️'}
                {action.id === 'explore_map' && '🗺️'}
              </span>
              <div className="tk-guide-free-explore__action-info">
                <div className="tk-guide-free-explore__action-title">{action.title}</div>
                <div className="tk-guide-free-explore__action-desc">{action.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 确认按钮 */}
        <button
          className="tk-guide-btn tk-guide-btn--next tk-guide-free-explore__btn"
          onClick={onConfirm}
          data-testid="guide-free-explore-ok"
        >
          开始自由探索
        </button>
      </div>
    </div>
  );
};

GuideFreeExploreModal.displayName = 'GuideFreeExploreModal';
export default GuideFreeExploreModal;
