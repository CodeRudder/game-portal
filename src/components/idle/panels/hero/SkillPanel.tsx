/**
 * SkillPanel — 技能面板组件
 *
 * 功能：
 * - 技能列表（每个技能一个卡片）
 * - 技能名称 + 等级 + CD
 * - 技能描述
 * - 升级按钮（显示所需材料：技能书 + 铜钱）
 * - 技能效果预览（升级前后对比）
 * - 突破解锁技能标记
 *
 * @module components/idle/panels/hero/SkillPanel
 */

import React, { useCallback } from 'react';
import './SkillPanel.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 技能类型 */
export type SkillType = 'active' | 'passive' | 'faction' | 'awaken';

/** 升级消耗 */
export interface SkillUpgradeCost {
  skillBook: number;
  gold: number;
}

/** 解锁条件 */
export interface SkillUnlockCondition {
  breakthroughStage: number;
  description: string;
}

/** 技能效果项 */
export interface SkillEffectItem {
  label: string;
  currentValue: number | string;
  nextValue: number | string;
}

/** UI 层技能数据 */
export interface SkillItem {
  id: string;
  name: string;
  type: SkillType;
  level: number;
  levelCap: number;
  description: string;
  cooldown?: number;
  unlocked: boolean;
  isBreakthrough?: boolean;
  upgradeCost?: SkillUpgradeCost;
  unlockCondition?: SkillUnlockCondition;
  /** 升级前后效果对比 */
  effects?: SkillEffectItem[];
}

export interface SkillPanelProps {
  /** 武将ID */
  heroId: string;
  /** 技能列表 */
  skills: SkillItem[];
  /** 当前技能书数量 */
  skillBookAmount: number;
  /** 当前铜钱数量 */
  goldAmount: number;
  /** 升级回调 */
  onUpgrade: (heroId: string, skillIndex: number) => void;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const TYPE_LABELS: Record<SkillType, string> = {
  active: '主动',
  passive: '被动',
  faction: '阵营',
  awaken: '觉醒',
};

const TYPE_ICONS: Record<SkillType, string> = {
  active: '⚔️',
  passive: '🛡️',
  faction: '🏛️',
  awaken: '✨',
};

// ─────────────────────────────────────────────
// Sub: 效果对比行
// ─────────────────────────────────────────────

const EffectCompare: React.FC<{ effects: SkillEffectItem[] }> = ({ effects }) => (
  <div className="tk-skillpanel-effect-compare" data-testid="skill-effect-compare">
    {effects.map((eff, i) => (
      <div key={i} className="tk-skillpanel-effect-row">
        <span className="tk-skillpanel-effect-label">{eff.label}</span>
        <span className="tk-skillpanel-effect-current">{eff.currentValue}</span>
        <span className="tk-skillpanel-effect-arrow">→</span>
        <span className="tk-skillpanel-effect-next">{eff.nextValue}</span>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────
// Sub: 单个技能卡片
// ─────────────────────────────────────────────

interface SkillCardProps {
  skill: SkillItem;
  index: number;
  heroId: string;
  skillBookAmount: number;
  goldAmount: number;
  onUpgrade: (heroId: string, skillIndex: number) => void;
}

const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  index,
  heroId,
  skillBookAmount,
  goldAmount,
  onUpgrade,
}) => {
  const cost = skill.upgradeCost ?? { skillBook: 1, gold: 500 };
  const isMaxLevel = skill.level >= skill.levelCap;
  const canAfford = skillBookAmount >= cost.skillBook && goldAmount >= cost.gold;
  const canUpgrade = skill.unlocked && !isMaxLevel && canAfford;

  const handleUpgrade = useCallback(() => {
    onUpgrade(heroId, index);
  }, [onUpgrade, heroId, index]);

  return (
    <div
      className={[
        'tk-skillpanel-card',
        !skill.unlocked ? 'tk-skillpanel-card--locked' : '',
        skill.isBreakthrough ? 'tk-skillpanel-card--breakthrough' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`skill-panel-card-${index}`}
    >
      {/* 图标 */}
      <div className="tk-skillpanel-card__icon">
        <span>{TYPE_ICONS[skill.type]}</span>
        {!skill.unlocked && <span className="tk-skillpanel-card__lock">🔒</span>}
        {skill.isBreakthrough && skill.unlocked && (
          <span className="tk-skillpanel-card__breakthrough-badge">突破</span>
        )}
      </div>

      {/* 信息 */}
      <div className="tk-skillpanel-card__info">
        <div className="tk-skillpanel-card__header">
          <span className="tk-skillpanel-card__name">{skill.name}</span>
          <span className={`tk-skillpanel-card__type tk-skillpanel-card__type--${skill.type}`}>
            {TYPE_LABELS[skill.type]}
          </span>
          <span className="tk-skillpanel-card__level">
            Lv.{skill.level}/{skill.levelCap}
          </span>
        </div>
        <p className="tk-skillpanel-card__desc">{skill.description}</p>
        {skill.cooldown != null && skill.cooldown > 0 && (
          <span className="tk-skillpanel-card__cd">⏱ CD: {skill.cooldown}s</span>
        )}

        {/* 效果对比 */}
        {skill.effects && skill.effects.length > 0 && !isMaxLevel && skill.unlocked && (
          <EffectCompare effects={skill.effects} />
        )}
      </div>

      {/* 操作 */}
      <div className="tk-skillpanel-card__actions">
        {!skill.unlocked ? (
          <span className="tk-skillpanel-lock-hint">
            {skill.unlockCondition?.description ?? '未解锁'}
          </span>
        ) : isMaxLevel ? (
          <span className="tk-skillpanel-max-label">✅ 已满级</span>
        ) : (
          <>
            <div className="tk-skillpanel-cost">
              <span className="tk-skillpanel-cost__item">
                📖{' '}
                <span
                  className={
                    skillBookAmount >= cost.skillBook
                      ? 'tk-skillpanel-cost--sufficient'
                      : 'tk-skillpanel-cost--insufficient'
                  }
                >
                  {cost.skillBook}
                </span>
              </span>
              <span className="tk-skillpanel-cost__item">
                🪙{' '}
                <span
                  className={
                    goldAmount >= cost.gold
                      ? 'tk-skillpanel-cost--sufficient'
                      : 'tk-skillpanel-cost--insufficient'
                  }
                >
                  {cost.gold.toLocaleString()}
                </span>
              </span>
            </div>
            <button
              className="tk-skillpanel-upgrade-btn"
              onClick={handleUpgrade}
              disabled={!canUpgrade}
              data-testid={`btn-skillpanel-upgrade-${index}`}
            >
              升级
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

const SkillPanel: React.FC<SkillPanelProps> = ({
  heroId,
  skills,
  skillBookAmount,
  goldAmount,
  onUpgrade,
}) => {
  if (skills.length === 0) {
    return (
      <div className="tk-skillpanel" data-testid="skill-panel">
        <div className="tk-skillpanel__empty">暂无技能数据</div>
      </div>
    );
  }

  return (
    <div className="tk-skillpanel" role="region" aria-label="技能面板" data-testid="skill-panel">
      <div className="tk-skillpanel__header">
        <span className="tk-skillpanel__title">⚔️ 技能面板</span>
        <span className="tk-skillpanel__count">共 {skills.length} 个技能</span>
      </div>
      <div className="tk-skillpanel-list" role="list">
        {skills.map((skill, index) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            index={index}
            heroId={heroId}
            skillBookAmount={skillBookAmount}
            goldAmount={goldAmount}
            onUpgrade={onUpgrade}
          />
        ))}
      </div>
    </div>
  );
};

SkillPanel.displayName = 'SkillPanel';

export default SkillPanel;
