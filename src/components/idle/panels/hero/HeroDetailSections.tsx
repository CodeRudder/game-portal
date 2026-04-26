/**
 * HeroDetailSections — 武将详情弹窗的子组件集合
 *
 * 从 HeroDetailModal.tsx 拆分而来，包含：
 * - HeroDetailHeader: 标题栏（名称、阵营、品质、对比/升星按钮）
 * - HeroDetailLeftPanel: 左侧面板（画像、等级、经验、战力、碎片、升级）
 * - HeroDetailSkills: 技能列表
 * - HeroDetailBonds: 羁绊标签
 * - HeroDetailBreakthrough: 突破状态
 */

import React from 'react';
import type { GeneralData, Quality, SkillData } from '@/games/three-kingdoms/engine';
import {
  QUALITY_LABELS,
  QUALITY_BORDER_COLORS,
  FACTION_LABELS,
  HERO_MAX_LEVEL,
} from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { EnhancePreview } from '@/games/three-kingdoms/engine';
import { Toast } from '@/components/idle/common/Toast';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import { FACTION_BONDS, PARTNER_BONDS, BondType } from '@/games/three-kingdoms/engine/hero/bond-config';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 品质对应的头像背景渐变 */
const QUALITY_BG: Record<Quality, string> = {
  COMMON: `linear-gradient(135deg, rgba(158,158,158,0.4) 0%, rgba(158,158,158,0.2) 100%)`,
  FINE: `linear-gradient(135deg, rgba(33,150,243,0.4) 0%, rgba(33,150,243,0.2) 100%)`,
  RARE: `linear-gradient(135deg, rgba(156,39,176,0.4) 0%, rgba(156,39,176,0.2) 100%)`,
  EPIC: `linear-gradient(135deg, rgba(244,67,54,0.4) 0%, rgba(244,67,54,0.2) 100%)`,
  LEGENDARY: `linear-gradient(135deg, rgba(255,152,0,0.4) 0%, rgba(255,152,0,0.2) 100%)`,
};

/** 获取武将参与的羁绊列表 */
function getHeroBondTags(heroId: string): ReadonlyArray<{ id: string; name: string; type: BondType }> {
  const bonds: { id: string; name: string; type: BondType }[] = [];

  // 阵营羁绊（所有武将都参与阵营羁绊）
  for (const fb of FACTION_BONDS) {
    bonds.push({ id: fb.id, name: fb.name, type: fb.type });
  }

  // 搭档羁绊（检查是否包含该武将）
  for (const pb of PARTNER_BONDS) {
    if (pb.generalIds.includes(heroId)) {
      bonds.push({ id: pb.id, name: pb.name, type: pb.type });
    }
  }

  return bonds;
}

/** 格式化数值 */
function formatNum(n: number): string {
  return formatNumber(n);
}

// ─────────────────────────────────────────────
// HeroDetailHeader
// ─────────────────────────────────────────────
interface HeroDetailHeaderProps {
  general: GeneralData;
  onCompare?: (general: GeneralData) => void;
  onStarUp: () => void;
}

export const HeroDetailHeader: React.FC<HeroDetailHeaderProps> = ({
  general,
  onCompare,
  onStarUp,
}) => {
  const borderColor = QUALITY_BORDER_COLORS[general.quality];
  const qualityLabel = QUALITY_LABELS[general.quality];
  const factionLabel = FACTION_LABELS[general.faction];

  return (
    <div className="tk-hero-detail-header" style={{ borderBottomColor: borderColor }}>
      <span className="tk-hero-detail-title-name" data-testid="hero-detail-modal-name">{general.name}</span>
      <span className="tk-hero-detail-title-faction" data-testid="hero-detail-modal-faction">{factionLabel}</span>
      <span className="tk-hero-detail-title-quality" style={{ background: borderColor }}>
        {qualityLabel}
      </span>
      {/* P1-01: 与其他武将对比按钮 */}
      {onCompare && (
        <button
          className="tk-hero-detail-compare-btn"
          onClick={() => onCompare(general)}
          title="与其他武将对比"
        >
          ⚖️ 对比
        </button>
      )}
      {/* P0: 升星按钮 — 打开升星弹窗 */}
      <button
        className="tk-hero-detail-compare-btn"
        onClick={onStarUp}
        title="武将升星"
      >
        ⭐ 升星
      </button>
    </div>
  );
};
HeroDetailHeader.displayName = 'HeroDetailHeader';

// ─────────────────────────────────────────────
// HeroDetailLeftPanel
// ─────────────────────────────────────────────
interface HeroDetailLeftPanelProps {
  general: GeneralData;
  engine: ThreeKingdomsEngine;
  power: number;
  expProgress: { current: number; required: number; percentage: number } | null;
  fragments: number;
  synthesizeProgress: { current: number; required: number };
  canSynth: boolean;
  targetLevel: number;
  enhancePreview: EnhancePreview | null;
  isEnhancing: boolean;
  isSynthesizing: boolean;
  onTargetLevelChange: (level: number) => void;
  onEnhanceMax: () => void;
  onEnhance: () => void;
  onSynthesize: () => void;
}

export const HeroDetailLeftPanel: React.FC<HeroDetailLeftPanelProps> = ({
  general,
  engine,
  power,
  expProgress,
  fragments,
  synthesizeProgress,
  canSynth,
  targetLevel,
  enhancePreview,
  isEnhancing,
  isSynthesizing,
  onTargetLevelChange: _onTargetLevelChange,
  onEnhanceMax,
  onEnhance,
  onSynthesize,
}) => {
  const borderColor = QUALITY_BORDER_COLORS[general.quality];

  return (
    <div className="tk-hero-detail-left">
      {/* 画像 */}
      <div
        className="tk-hero-detail-portrait"
        style={{ background: QUALITY_BG[general.quality], borderColor }}
      >
        <span className="tk-hero-detail-portrait-char">{general.name}</span>
      </div>
      <div className="tk-hero-detail-level-badge" style={{ borderColor }}>
        Lv.{general.level}
      </div>

      {/* 经验条 */}
      {expProgress && expProgress.required > 0 && (
        <div className="tk-hero-detail-exp-section">
          <div className="tk-hero-detail-exp-label">
            经验 {expProgress.current}/{expProgress.required}
          </div>
          <div className="tk-hero-detail-exp-bar">
            <div
              className="tk-hero-detail-exp-fill"
              style={{ width: `${expProgress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* 战力 */}
      <div className="tk-hero-detail-power" data-testid="hero-detail-modal-power">
        ⚔️ 战力 <strong>{power.toLocaleString('zh-CN')}</strong>
      </div>

      {/* 碎片 + 合成 */}
      <div className="tk-hero-detail-fragments">
        <div className="tk-hero-detail-fragments-header">
          <span>💎 碎片 {fragments}/{synthesizeProgress.required}</span>
        </div>
        <div className="tk-hero-detail-fragments-bar">
          <div
            className="tk-hero-detail-fragments-fill"
            style={{ width: `${Math.min(100, (synthesizeProgress.current / synthesizeProgress.required) * 100)}%` }}
          />
        </div>
        <button
          className={`tk-hero-detail-synthesize-btn ${canSynth ? 'tk-hero-detail-synthesize-btn--active' : ''}`}
          disabled={!canSynth || isSynthesizing}
          onClick={onSynthesize}
        >
          {isSynthesizing ? '合成中...' : canSynth ? '✨ 碎片合成' : `碎片合成 (${synthesizeProgress.current}/${synthesizeProgress.required})`}
        </button>
      </div>

      {/* 升级操作区 */}
      <div className="tk-hero-detail-enhance">
        <div className="tk-hero-detail-enhance-header">
          <span className="tk-hero-detail-enhance-title">强化升级</span>
          <button className="tk-hero-detail-enhance-max-btn" onClick={onEnhanceMax}>
            +5级
          </button>
        </div>

        <div className="tk-hero-detail-enhance-target">
          <span className="tk-hero-detail-enhance-label">
            目标等级: Lv.{targetLevel}
          </span>
        </div>

        {enhancePreview && (
          <div className="tk-hero-detail-enhance-preview">
            <div className="tk-hero-detail-enhance-cost">
              💰 {formatNum(enhancePreview.totalGold)} 铜钱
            </div>
            <div className="tk-hero-detail-enhance-power-diff">
              战力: {formatNum(enhancePreview.powerBefore)} → {formatNum(enhancePreview.powerAfter)}
              <span className="tk-hero-detail-enhance-power-gain">
                (+{formatNum(enhancePreview.powerAfter - enhancePreview.powerBefore)})
              </span>
            </div>
            <div className="tk-hero-detail-enhance-affordable">
              {enhancePreview.affordable ? '✅ 资源充足' : '❌ 资源不足'}
            </div>
          </div>
        )}

        <button
          className="tk-hero-detail-enhance-btn"
          data-testid="hero-detail-modal-enhance-btn"
          disabled={!enhancePreview?.affordable || isEnhancing || targetLevel <= general.level}
          onClick={onEnhance}
        >
          {isEnhancing ? '升级中...' : `升级至 Lv.${targetLevel}`}
        </button>
      </div>
    </div>
  );
};
HeroDetailLeftPanel.displayName = 'HeroDetailLeftPanel';

// ─────────────────────────────────────────────
// HeroDetailSkills
// ─────────────────────────────────────────────
interface HeroDetailSkillsProps {
  skills: readonly SkillData[];
}

export const HeroDetailSkills: React.FC<HeroDetailSkillsProps> = ({ skills }) => (
  <div className="tk-hero-detail-skills">
    <h4 className="tk-hero-detail-section-title">技能</h4>
    {skills.length === 0 ? (
      <div className="tk-hero-detail-skill-empty">暂无技能</div>
    ) : (
      skills.map((skill: SkillData) => (
        <div key={skill.id} className="tk-hero-detail-skill-item">
          <div className="tk-hero-detail-skill-header">
            <span className="tk-hero-detail-skill-name">{skill.name}</span>
            <span className="tk-hero-detail-skill-type">
              {skill.type === 'active' ? '主动' :
                skill.type === 'passive' ? '被动' :
                  skill.type === 'faction' ? '阵营' : '觉醒'}
            </span>
            <span className="tk-hero-detail-skill-level">Lv.{skill.level}</span>
          </div>
          <div className="tk-hero-detail-skill-desc">{skill.description}</div>
        </div>
      ))
    )}
  </div>
);
HeroDetailSkills.displayName = 'HeroDetailSkills';

// ─────────────────────────────────────────────
// HeroDetailBonds
// ─────────────────────────────────────────────
interface HeroDetailBondsProps {
  heroId: string;
}

export const HeroDetailBonds: React.FC<HeroDetailBondsProps> = ({ heroId }) => {
  const bondTags = getHeroBondTags(heroId);

  return (
    <div className="tk-hero-detail-bonds" data-testid="hero-detail-bonds">
      <h4 className="tk-hero-detail-section-title">参与羁绊</h4>
      {bondTags.length === 0 ? (
        <div className="tk-hero-detail-skill-empty">暂无羁绊</div>
      ) : (
        <div className="tk-hero-detail-bond-tags">
          {bondTags.map((bond) => (
            <span
              key={bond.id}
              className={`tk-hero-detail-bond-tag tk-hero-detail-bond-tag--${bond.type === BondType.FACTION ? 'faction' : 'partner'}`}
              data-testid={`hero-bond-tag-${bond.id}`}
            >
              {bond.type === BondType.FACTION ? '🏛️' : '🤝'} {bond.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
HeroDetailBonds.displayName = 'HeroDetailBonds';

// ─────────────────────────────────────────────
// HeroDetailBreakthrough
// ─────────────────────────────────────────────
interface HeroDetailBreakthroughProps {
  engine: ThreeKingdomsEngine;
  generalId: string;
  currentLevel: number;
}

export const HeroDetailBreakthrough: React.FC<HeroDetailBreakthroughProps> = ({
  engine,
  generalId,
  currentLevel,
}) => {
  const starSystem = engine.getHeroStarSystem?.();
  if (!starSystem) return null;

  const stage = starSystem.getBreakthroughStage(generalId);
  const levelCap = starSystem.getLevelCap(generalId);

  return (
    <div className="tk-hero-detail-breakthrough" data-testid="hero-detail-breakthrough">
      <h4 className="tk-hero-detail-section-title">突破状态</h4>
      <div className="tk-hero-detail-breakthrough-info">
        <div className="tk-hero-detail-breakthrough-row">
          <span className="tk-hero-detail-breakthrough-label">突破阶段</span>
          <span className="tk-hero-detail-breakthrough-value" data-testid="breakthrough-stage">
            {stage > 0 ? `第${stage}阶` : '未突破'}
          </span>
        </div>
        <div className="tk-hero-detail-breakthrough-row">
          <span className="tk-hero-detail-breakthrough-label">等级上限</span>
          <span className="tk-hero-detail-breakthrough-value" data-testid="breakthrough-level-cap">
            Lv.{levelCap}
          </span>
        </div>
        {currentLevel >= levelCap && (
          <div className="tk-hero-detail-breakthrough-hint" data-testid="breakthrough-hint">
            ⚠️ 已达等级上限，需突破才能继续升级
          </div>
        )}
      </div>
    </div>
  );
};
HeroDetailBreakthrough.displayName = 'HeroDetailBreakthrough';
