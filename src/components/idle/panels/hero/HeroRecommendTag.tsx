/**
 * HeroRecommendTag — 推荐武将标记
 *
 * 功能：
 * - 武将卡片上的推荐标记
 * - 显示推荐原因（如"羁绊推荐：桃园结义"）
 * - 金色边框+星标图标，按优先级区分样式
 *
 * 嵌入位置：武将卡片右上角叠加层
 *
 * @module components/idle/panels/hero/HeroRecommendTag
 */

import React from 'react';
import './HeroRecommendTag.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface HeroRecommendTagProps {
  /** 推荐原因 */
  reason: string;
  /** 推荐优先级 */
  priority: 'high' | 'medium' | 'low';
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const PRIORITY_ICONS: Record<HeroRecommendTagProps['priority'], string> = {
  high: '⭐',
  medium: '✦',
  low: '·',
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const HeroRecommendTag: React.FC<HeroRecommendTagProps> = ({ reason, priority }) => {
  return (
    <div
      className={['tk-hero-recommend-tag', `tk-hero-recommend-tag--${priority}`].join(' ')}
      data-testid="hero-recommend-tag"
      title={reason}
    >
      <span className="tk-hero-recommend-tag__icon" aria-hidden="true">
        {PRIORITY_ICONS[priority]}
      </span>
      <span className="tk-hero-recommend-tag__reason">{reason}</span>
    </div>
  );
};

HeroRecommendTag.displayName = 'HeroRecommendTag';

export default HeroRecommendTag;
