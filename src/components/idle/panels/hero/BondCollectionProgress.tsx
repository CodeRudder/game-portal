/**
 * BondCollectionProgress — 羁绊收集进度
 *
 * 功能：
 * - 显示羁绊收集总进度（X/20已激活）
 * - 进度条+百分比
 * - 按类型分类显示（阵营羁绊、搭档羁绊）
 *
 * 嵌入位置：武将羁绊面板顶部概览
 *
 * @module components/idle/panels/hero/BondCollectionProgress
 */

import React, { useMemo } from 'react';
import './BondCollectionProgress.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface BondCollectionProgressProps {
  /** 羁绊总数 */
  totalBonds: number;
  /** 已激活羁绊数 */
  activatedBonds: number;
  /** 阵营羁绊已激活数 */
  factionActivated: number;
  /** 阵营羁绊总数 */
  factionTotal: number;
  /** 搭档羁绊已激活数 */
  partnerActivated: number;
  /** 搭档羁绊总数 */
  partnerTotal: number;
}

// ─────────────────────────────────────────────
// 子组件：分类进度行
// ─────────────────────────────────────────────

interface CategoryRowProps {
  label: string;
  activated: number;
  total: number;
  icon: string;
}

const CategoryRow: React.FC<CategoryRowProps> = ({ label, activated, total, icon }) => {
  const percent = total > 0 ? Math.round((activated / total) * 100) : 0;

  return (
    <div className="tk-bond-progress__category" data-testid="bond-category-row">
      <div className="tk-bond-progress__category-header">
        <span className="tk-bond-progress__category-icon">{icon}</span>
        <span className="tk-bond-progress__category-label">{label}</span>
        <span className="tk-bond-progress__category-count">
          {activated}/{total}
        </span>
      </div>
      <div className="tk-bond-progress__bar-track">
        <div
          className="tk-bond-progress__bar-fill"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const BondCollectionProgress: React.FC<BondCollectionProgressProps> = ({
  totalBonds,
  activatedBonds,
  factionActivated,
  factionTotal,
  partnerActivated,
  partnerTotal,
}) => {
  const totalPercent = useMemo(() => {
    if (totalBonds <= 0) return 0;
    return Math.round((activatedBonds / totalBonds) * 100);
  }, [activatedBonds, totalBonds]);

  return (
    <div
      className="tk-bond-progress"
      role="region"
      aria-label="羁绊收集进度"
      data-testid="bond-collection-progress"
    >
      {/* 总进度 */}
      <div className="tk-bond-progress__total">
        <div className="tk-bond-progress__total-header">
          <span className="tk-bond-progress__total-label">羁绊收集</span>
          <span className="tk-bond-progress__total-count">
            {activatedBonds}/{totalBonds} 已激活
          </span>
          <span className="tk-bond-progress__total-percent">{totalPercent}%</span>
        </div>
        <div className="tk-bond-progress__bar-track tk-bond-progress__bar-track--total">
          <div
            className="tk-bond-progress__bar-fill tk-bond-progress__bar-fill--total"
            style={{ width: `${totalPercent}%` }}
            role="progressbar"
            aria-valuenow={totalPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            data-testid="bond-total-bar"
          />
        </div>
      </div>

      {/* 分类进度 */}
      <div className="tk-bond-progress__categories">
        <CategoryRow
          label="阵营羁绊"
          activated={factionActivated}
          total={factionTotal}
          icon="🏛️"
        />
        <CategoryRow
          label="搭档羁绊"
          activated={partnerActivated}
          total={partnerTotal}
          icon="🤝"
        />
      </div>
    </div>
  );
};

BondCollectionProgress.displayName = 'BondCollectionProgress';

export default BondCollectionProgress;
