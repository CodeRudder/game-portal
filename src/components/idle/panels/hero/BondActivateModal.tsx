/**
 * BondActivateModal — 羁绊激活弹窗
 *
 * 功能：
 * - 弹窗显示羁绊详情
 * - 羁绊名称+图标
 * - 参与武将列表（头像+名字）
 * - 羁绊效果详细描述
 * - 激活/未激活状态
 * - 关闭按钮
 *
 * @module components/idle/panels/hero/BondActivateModal
 */

import React, { useMemo } from 'react';
import './BondActivateModal.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface BondActivateModalProps {
  /** 羁绊ID */
  bondId: string;
  /** 羁绊名称 */
  bondName: string;
  /** 羁绊类型 */
  bondType: 'faction' | 'partner';
  /** 参与武将列表 */
  requiredHeroes: {
    id: string;
    name: string;
    inTeam: boolean;
  }[];
  /** 羁绊效果 */
  effect: {
    attackBonus: number;
    defenseBonus: number;
    hpBonus: number;
    critBonus: number;
    strategyBonus?: number;
  };
  /** 是否已激活 */
  isActive: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const BOND_TYPE_LABELS: Record<string, string> = {
  faction: '阵营羁绊',
  partner: '搭档羁绊',
};

const BOND_TYPE_ICONS: Record<string, string> = {
  faction: '⚔️',
  partner: '🤝',
};

// ─────────────────────────────────────────────
// 子组件：效果条目
// ─────────────────────────────────────────────

interface EffectRowProps {
  label: string;
  value: number;
  suffix: string;
}

const EffectRow: React.FC<EffectRowProps> = React.memo(({ label, value, suffix }) => {
  if (value <= 0) return null;
  return (
    <div className="tk-bond-modal__effect-row" data-testid="bond-effect-row">
      <span className="tk-bond-modal__effect-label">{label}</span>
      <span className="tk-bond-modal__effect-value">+{value}{suffix}</span>
    </div>
  );
});
EffectRow.displayName = 'EffectRow';

// ─────────────────────────────────────────────
// 子组件：武将头像
// ─────────────────────────────────────────────

interface HeroAvatarProps {
  name: string;
  inTeam: boolean;
}

const HeroAvatar: React.FC<HeroAvatarProps> = React.memo(({ name, inTeam }) => (
  <div className={`tk-bond-modal__hero ${inTeam ? 'tk-bond-modal__hero--active' : 'tk-bond-modal__hero--inactive'}`}>
    <div className="tk-bond-modal__hero-avatar" data-testid="bond-hero-avatar">
      {name.charAt(0)}
    </div>
    <span className="tk-bond-modal__hero-name">{name}</span>
    <span className="tk-bond-modal__hero-status">
      {inTeam ? '已上阵' : '未上阵'}
    </span>
  </div>
));
HeroAvatar.displayName = 'HeroAvatar';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const BondActivateModal: React.FC<BondActivateModalProps> = ({
  bondId,
  bondName,
  bondType,
  requiredHeroes,
  effect,
  isActive,
  onClose,
}) => {
  /** 已上阵武将数量 */
  const activeCount = useMemo(
    () => requiredHeroes.filter(h => h.inTeam).length,
    [requiredHeroes],
  );

  /** 遮罩点击关闭 */
  const handleOverlayClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div
      className="tk-bond-modal-overlay"
      onClick={handleOverlayClick}
      data-testid="bond-modal-overlay"
    >
      <div className="tk-bond-modal" data-testid="bond-modal">
        {/* ── 头部 ── */}
        <div className="tk-bond-modal__header">
          <div className="tk-bond-modal__icon">{BOND_TYPE_ICONS[bondType]}</div>
          <div className="tk-bond-modal__title-group">
            <h3 className="tk-bond-modal__name" data-testid="bond-name">{bondName}</h3>
            <span className="tk-bond-modal__type">{BOND_TYPE_LABELS[bondType]}</span>
          </div>
          <div
            className={`tk-bond-modal__status ${isActive ? 'tk-bond-modal__status--active' : 'tk-bond-modal__status--inactive'}`}
            data-testid="bond-status"
          >
            {isActive ? '已激活' : '未激活'}
          </div>
        </div>

        {/* ── 参与武将 ── */}
        <div className="tk-bond-modal__section">
          <div className="tk-bond-modal__section-title">
            参与武将 ({activeCount}/{requiredHeroes.length})
          </div>
          <div className="tk-bond-modal__heroes" data-testid="bond-heroes">
            {requiredHeroes.map(hero => (
              <HeroAvatar key={hero.id} name={hero.name} inTeam={hero.inTeam} />
            ))}
          </div>
        </div>

        {/* ── 羁绊效果 ── */}
        <div className="tk-bond-modal__section">
          <div className="tk-bond-modal__section-title">羁绊效果</div>
          <div className="tk-bond-modal__effects" data-testid="bond-effects">
            <EffectRow label="攻击加成" value={effect.attackBonus} suffix="%" />
            <EffectRow label="防御加成" value={effect.defenseBonus} suffix="%" />
            <EffectRow label="生命加成" value={effect.hpBonus} suffix="%" />
            <EffectRow label="暴击加成" value={effect.critBonus} suffix="%" />
            <EffectRow label="策略加成" value={effect.strategyBonus ?? 0} suffix="%" />
          </div>
        </div>

        {/* ── 关闭按钮 ── */}
        <button
          className="tk-bond-modal__close-btn"
          onClick={onClose}
          data-testid="bond-close-btn"
        >
          关闭
        </button>
      </div>
    </div>
  );
};

BondActivateModal.displayName = 'BondActivateModal';
export default BondActivateModal;
