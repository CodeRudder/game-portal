/**
 * SkillUpgradePreview — 技能升级预览
 *
 * 功能：
 * - 显示技能当前等级和效果
 * - 显示升级后效果预览（对比）
 * - 显示升级所需材料（技能书+铜钱）
 * - 升级按钮（资源不足时禁用）
 *
 * 嵌入位置：武将详情弹窗技能升级子面板
 *
 * @module components/idle/panels/hero/SkillUpgradePreview
 */

import React, { useCallback } from 'react';
import './SkillUpgradePreview.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface SkillUpgradePreviewProps {
  /** 技能名称 */
  skillName: string;
  /** 当前等级 */
  currentLevel: number;
  /** 当前效果描述 */
  currentEffect: string;
  /** 升级后效果描述 */
  nextEffect: string;
  /** 升级消耗 */
  cost: { skillBooks: number; copper: number };
  /** 是否可升级（资源充足且未满级） */
  canUpgrade: boolean;
  /** 升级回调 */
  onUpgrade: () => void;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const SkillUpgradePreview: React.FC<SkillUpgradePreviewProps> = ({
  skillName,
  currentLevel,
  currentEffect,
  nextEffect,
  cost,
  canUpgrade,
  onUpgrade,
}) => {
  const handleUpgrade = useCallback(() => {
    if (canUpgrade) {
      onUpgrade();
    }
  }, [canUpgrade, onUpgrade]);

  return (
    <div
      className="tk-skill-preview"
      role="region"
      aria-label={`${skillName}升级预览`}
      data-testid="skill-upgrade-preview"
    >
      {/* 头部：技能名称 + 当前等级 */}
      <div className="tk-skill-preview__header">
        <span className="tk-skill-preview__name">{skillName}</span>
        <span className="tk-skill-preview__level">Lv.{currentLevel}</span>
      </div>

      {/* 效果对比区域 */}
      <div className="tk-skill-preview__compare">
        {/* 当前效果 */}
        <div className="tk-skill-preview__effect tk-skill-preview__effect--current">
          <div className="tk-skill-preview__effect-label">当前效果</div>
          <div className="tk-skill-preview__effect-text">{currentEffect}</div>
        </div>

        {/* 箭头分隔 */}
        <div className="tk-skill-preview__arrow" aria-hidden="true">
          →
        </div>

        {/* 升级后效果 */}
        <div className="tk-skill-preview__effect tk-skill-preview__effect--next">
          <div className="tk-skill-preview__effect-label">升级效果</div>
          <div className="tk-skill-preview__effect-text">{nextEffect}</div>
        </div>
      </div>

      {/* 升级消耗 */}
      <div className="tk-skill-preview__cost">
        <span className="tk-skill-preview__cost-label">升级消耗</span>
        <div className="tk-skill-preview__cost-items">
          <span className="tk-skill-preview__cost-item" aria-label={`技能书 ${cost.skillBooks}`}>
            📖 <span className="tk-skill-preview__cost-value">{cost.skillBooks}</span>
          </span>
          <span className="tk-skill-preview__cost-item" aria-label={`铜钱 ${cost.copper}`}>
            🪙 <span className="tk-skill-preview__cost-value">{cost.copper.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* 升级按钮 */}
      <button
        className="tk-skill-preview__btn"
        onClick={handleUpgrade}
        disabled={!canUpgrade}
        data-testid="btn-skill-preview-upgrade"
      >
        {canUpgrade ? '升级' : '资源不足'}
      </button>
    </div>
  );
};

SkillUpgradePreview.displayName = 'SkillUpgradePreview';

export default SkillUpgradePreview;
