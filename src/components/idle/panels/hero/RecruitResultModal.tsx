/**
 * RecruitResultModal — 招募结果弹窗
 *
 * 从 RecruitModal 中拆出的独立招募结果展示弹窗。
 * 功能：
 *   - 卡牌翻转动画（0.3秒）
 *   - 武将品质揭示
 *   - 武将信息展示
 *   - "再次招募"和"查看武将"按钮
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { RecruitResult, Quality } from '@/games/three-kingdoms/engine';
import { QUALITY_LABELS, QUALITY_BORDER_COLORS } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { QualityBadge } from './atoms';
import './RecruitResultModal.css';

// ─────────────────────────────────────────────
// Props 接口
// ─────────────────────────────────────────────
export interface RecruitResultModalProps {
  /** 招募结果数据 */
  result: RecruitResult;
  /** 引擎实例 */
  engine: ThreeKingdomsEngine;
  /** 再次招募回调 */
  onRecruitAgain?: () => void;
  /** 查看武将回调 */
  onViewHero?: (heroId: string) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

// ─────────────────────────────────────────────
// 品质揭示动画 CSS class 映射
// ─────────────────────────────────────────────
const QUALITY_REVEAL_ANIM: Record<Quality, string> = {
  COMMON: 'tk-result-reveal-common',
  FINE: 'tk-result-reveal-fine',
  RARE: 'tk-result-reveal-rare',
  EPIC: 'tk-result-reveal-epic',
  LEGENDARY: 'tk-result-reveal-legendary',
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const RecruitResultModal: React.FC<RecruitResultModalProps> = ({
  result,
  engine,
  onRecruitAgain,
  onViewHero,
  onClose,
}) => {
  // 卡牌翻转状态
  const [isRevealed, setIsRevealed] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // 自动触发翻转动画
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFlipping(true);
      // 翻转完成后揭示
      setTimeout(() => {
        setIsRevealed(true);
        setIsFlipping(false);
      }, 300); // 0.3秒翻转动画
    }, 200); // 初始延迟
    return () => clearTimeout(timer);
  }, [result]);

  const borderColor = QUALITY_BORDER_COLORS[result.quality];
  const qualityLabel = QUALITY_LABELS[result.quality];
  const animClass = QUALITY_REVEAL_ANIM[result.quality];

  const handleRecruitAgain = useCallback(() => {
    onRecruitAgain?.();
  }, [onRecruitAgain]);

  const handleViewHero = useCallback(() => {
    if (result.general?.id) {
      onViewHero?.(result.general.id);
    }
  }, [result.general?.id, onViewHero]);

  return (
    <div
      className="tk-recruit-result-overlay"
      data-testid="recruit-result-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="tk-recruit-result-modal"
        data-testid="recruit-result-modal"
        role="dialog"
        aria-modal="true"
        aria-label="招募结果"
      >
        {/* 关闭按钮 */}
        <button
          className="tk-recruit-result-modal__close"
          onClick={onClose}
          aria-label="关闭"
        >
          ✕
        </button>

        {/* 卡牌翻转区域 */}
        <div className="tk-recruit-result-modal__card-area">
          <div
            className={`tk-recruit-result-card ${isFlipping ? 'tk-recruit-result-card--flipping' : ''} ${isRevealed ? 'tk-recruit-result-card--revealed' : ''} ${animClass}`}
            style={{ borderColor: isRevealed ? borderColor : 'rgba(100,100,100,0.3)' }}
          >
            {/* 背面 */}
            <div className="tk-recruit-result-card__back">
              <span className="tk-recruit-result-card__back-text">?</span>
            </div>

            {/* 正面 */}
            <div className="tk-recruit-result-card__front">
              {/* 品质揭示光效层 */}
              <div className="tk-recruit-result-card__glow" style={{ background: borderColor }} />

              {/* 品质标签 */}
              <QualityBadge quality={result.quality} size="normal" className="tk-recruit-result-card__quality" />

              {/* 武将头像 */}
              <div className="tk-recruit-result-card__portrait" style={{ borderColor }}>
                <span className="tk-recruit-result-card__portrait-char">
                  {result.general?.name?.charAt(0) ?? '?'}
                </span>
              </div>

              {/* 武将名称 */}
              <div className="tk-recruit-result-card__name">
                {result.general?.name ?? '???'}
              </div>

              {/* 新获得 / 重复 */}
              {result.isDuplicate ? (
                <div className="tk-recruit-result-card__dup">
                  已拥有 → 碎片×{result.fragmentCount}
                </div>
              ) : (
                <div className="tk-recruit-result-card__new">✨ 新获得</div>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="tk-recruit-result-modal__actions">
          <button
            className="tk-recruit-result-modal__btn tk-recruit-result-modal__btn--again"
            onClick={handleRecruitAgain}
            data-testid="recruit-result-again-btn"
          >
            🔄 再次招募
          </button>
          {result.general && !result.isDuplicate && (
            <button
              className="tk-recruit-result-modal__btn tk-recruit-result-modal__btn--view"
              onClick={handleViewHero}
              data-testid="recruit-result-view-btn"
            >
              👁️ 查看武将
            </button>
          )}
          <button
            className="tk-recruit-result-modal__btn tk-recruit-result-modal__btn--close"
            onClick={onClose}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

RecruitResultModal.displayName = 'RecruitResultModal';

export default RecruitResultModal;
