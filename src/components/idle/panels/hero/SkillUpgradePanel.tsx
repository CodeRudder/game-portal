/**
 * SkillUpgradePanel — 技能升级面板
 *
 * 功能：
 * - 展示武将所有技能（主动+被动+阵营+觉醒）
 * - 每个技能显示：图标、名称、等级、描述、CD
 * - 升级按钮：显示消耗（技能书+铜钱），资源不足时灰色
 * - 突破解锁的技能显示锁图标+解锁条件
 * - 技能等级上限受武将星级限制
 *
 * 嵌入位置：武将详情弹窗的"技能"Tab
 * 引擎依赖：SkillUpgradeSystem
 *
 * @module components/idle/panels/hero/SkillUpgradePanel
 */

import React, { useMemo, useCallback } from 'react';
import type { SkillData, SkillType } from '@/games/three-kingdoms/engine/hero/hero.types';
import './SkillUpgradePanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

/** 技能升级材料信息 */
export interface SkillUpgradeCost {
  /** 技能书消耗 */
  skillBook: number;
  /** 铜钱消耗 */
  gold: number;
}

/** 技能解锁条件 */
export interface SkillUnlockCondition {
  /** 突破阶段要求 */
  breakthroughStage: number;
  /** 描述文本 */
  description: string;
}

/** UI层技能数据（含升级信息） */
export interface SkillItem extends SkillData {
  /** 技能升级消耗（当前等级→下一级） */
  upgradeCost?: SkillUpgradeCost;
  /** 技能等级上限 */
  levelCap: number;
  /** 是否已解锁 */
  unlocked: boolean;
  /** 解锁条件（未解锁时显示） */
  unlockCondition?: SkillUnlockCondition;
  /** 冷却时间（秒） */
  cooldown?: number;
}

export interface SkillUpgradePanelProps {
  /** 武将ID */
  heroId: string;
  /** 技能列表（外部传入优先，否则使用 engineDataSource） */
  skills?: SkillItem[];
  /** 当前技能书数量（外部传入优先） */
  skillBookAmount?: number;
  /** 当前铜钱数量（外部传入优先） */
  goldAmount?: number;
  /** 升级回调（外部传入优先） */
  onUpgrade?: (heroId: string, skillIndex: number) => void;
  /** 关闭回调 */
  onClose: () => void;
  /**
   * 引擎数据源（P1-1 桥接）
   * 当提供此参数时，skills/skillBookAmount/goldAmount/onUpgrade
   * 从引擎数据自动获取，无需手动传入。
   */
  engineDataSource?: {
    skills: SkillItem[];
    skillBookAmount: number;
    goldAmount: number;
    upgradeSkill: (heroId: string, skillIndex: number) => void;
  };
}

// ─────────────────────────────────────────────
// 常量映射
// ─────────────────────────────────────────────

/** 技能类型 → 标签 */
const SKILL_TYPE_LABELS: Record<SkillType, string> = {
  active: '主动',
  passive: '被动',
  faction: '阵营',
  awaken: '觉醒',
};

/** 技能类型 → 图标 */
const SKILL_TYPE_ICONS: Record<SkillType, string> = {
  active: '⚔️',
  passive: '🛡️',
  faction: '🏛️',
  awaken: '✨',
};

/** 技能等级 → 消耗表（与引擎对齐） */
const UPGRADE_COST_TABLE: Record<number, SkillUpgradeCost> = {
  1: { skillBook: 1, gold: 500 },
  2: { skillBook: 1, gold: 1500 },
  3: { skillBook: 2, gold: 4000 },
  4: { skillBook: 2, gold: 10000 },
};
const DEFAULT_COST: SkillUpgradeCost = { skillBook: 2, gold: 10000 };

/** 获取升级消耗 */
function getUpgradeCost(level: number): SkillUpgradeCost {
  return UPGRADE_COST_TABLE[level] ?? DEFAULT_COST;
}

// ─────────────────────────────────────────────
// 子组件：单个技能卡片
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
  const { name, type, level, description, levelCap, unlocked, unlockCondition, cooldown } = skill;

  // 升级消耗（优先使用外部传入，否则用本地表查）
  const cost = skill.upgradeCost ?? getUpgradeCost(level);
  const isMaxLevel = level >= levelCap;
  const canAfford = skillBookAmount >= cost.skillBook && goldAmount >= cost.gold;
  const canUpgrade = unlocked && !isMaxLevel && canAfford;

  const handleUpgrade = useCallback(() => {
    onUpgrade(heroId, index);
  }, [onUpgrade, heroId, index]);

  return (
    <div
      className={['tk-skill-card', !unlocked ? 'tk-skill-card--locked' : ''].filter(Boolean).join(' ')}
      data-testid={`skill-card-${index}`}
    >
      {/* 图标 */}
      <div className="tk-skill-card__icon-wrap">
        <span aria-hidden="true">{SKILL_TYPE_ICONS[type]}</span>
        {!unlocked && <span className="tk-skill-card__lock-badge">🔒</span>}
      </div>

      {/* 信息 */}
      <div className="tk-skill-card__info">
        <div className="tk-skill-card__name-row">
          <span className="tk-skill-card__name">{name}</span>
          <span className={`tk-skill-card__type-tag tk-skill-card__type-tag--${type}`}>
            {SKILL_TYPE_LABELS[type]}
          </span>
          <span className="tk-skill-card__level">Lv.{level}/{levelCap}</span>
        </div>
        <div className="tk-skill-card__desc">{description}</div>
        {(cooldown != null && cooldown > 0) && (
          <div className="tk-skill-card__meta">
            <span>⏱ CD: {cooldown}s</span>
          </div>
        )}
      </div>

      {/* 操作 */}
      <div className="tk-skill-card__actions">
        {!unlocked ? (
          <>
            <div className="tk-skill-lock-hint">
              {unlockCondition?.description ?? '未解锁'}
            </div>
          </>
        ) : isMaxLevel ? (
          <span className="tk-skill-max-label">✅ 已满级</span>
        ) : (
          <>
            <div className="tk-skill-cost">
              <span className="tk-skill-cost__item">
                📖 <span className={`tk-skill-cost__value ${skillBookAmount >= cost.skillBook ? 'tk-skill-cost__value--sufficient' : 'tk-skill-cost__value--insufficient'}`}>
                  {cost.skillBook}
                </span>
              </span>
              <span className="tk-skill-cost__item">
                🪙 <span className={`tk-skill-cost__value ${goldAmount >= cost.gold ? 'tk-skill-cost__value--sufficient' : 'tk-skill-cost__value--insufficient'}`}>
                  {cost.gold.toLocaleString()}
                </span>
              </span>
            </div>
            <button
              className="tk-skill-upgrade-btn"
              onClick={handleUpgrade}
              disabled={!canUpgrade}
              data-testid={`btn-upgrade-skill-${index}`}
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
// 主组件
// ─────────────────────────────────────────────

const SkillUpgradePanel: React.FC<SkillUpgradePanelProps> = ({
  heroId,
  skills: externalSkills,
  skillBookAmount: externalSkillBookAmount,
  goldAmount: externalGoldAmount,
  onUpgrade: externalOnUpgrade,
  onClose,
  engineDataSource,
}) => {
  // 优先使用外部传入数据，否则使用引擎数据源
  const skills = externalSkills ?? engineDataSource?.skills ?? [];
  const skillBookAmount = externalSkillBookAmount ?? engineDataSource?.skillBookAmount ?? 0;
  const goldAmount = externalGoldAmount ?? engineDataSource?.goldAmount ?? 0;
  const onUpgrade = externalOnUpgrade ?? engineDataSource?.upgradeSkill ?? (() => {});
  // 计算技能等级上限提示
  const maxCap = useMemo(() => {
    if (skills.length === 0) return 0;
    return Math.max(...skills.map((s) => s.levelCap));
  }, [skills]);

  if (skills.length === 0) {
    return (
      <div className="tk-skill-panel" data-testid="skill-upgrade-panel">
        <div className="tk-skill-panel__empty">暂无技能数据</div>
      </div>
    );
  }

  return (
    <div className="tk-skill-panel" role="region" aria-label="技能升级" data-testid="skill-upgrade-panel">
      {/* 头部 */}
      <div className="tk-skill-panel__header">
        <span className="tk-skill-panel__title">⚔️ 技能升级</span>
        <span className="tk-skill-panel__cap-hint">等级上限: {maxCap}</span>
      </div>

      {/* 技能列表 */}
      <div className="tk-skill-list" role="list">
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

SkillUpgradePanel.displayName = 'SkillUpgradePanel';

export default SkillUpgradePanel;
