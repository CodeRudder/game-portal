/**
 * BondCard — 羁绊卡片 & 羁绊详情弹窗
 *
 * 从 BondCollectionPanel 中提取的子组件：
 * - BondCard：羁绊卡片（名称、状态、描述、武将标签、展开详情）
 * - BondDetailPopup：羁绊详情弹窗（完整效果 + 激活条件 + 参与武将列表）
 *
 * 共享常量：
 * - STAT_LABELS：属性中英文映射
 * - FACTION_ICONS：阵营图标映射
 *
 * @module components/idle/panels/hero/BondCard
 */

import React from 'react';
import { BondType } from '@/games/three-kingdoms/engine/hero/bond-config';
import type { BondEffect } from '@/games/three-kingdoms/engine/hero/bond-config';
import type { BondCatalogItem } from './BondCollectionPanel';

// ─────────────────────────────────────────────
// 共享常量
// ─────────────────────────────────────────────

/** 属性中英文映射 */
export const STAT_LABELS: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  intelligence: '智力',
  speed: '速度',
  hp: '生命',
  critRate: '暴击率',
  critDamage: '暴击伤害',
  skillDamage: '技能伤害',
  passiveTriggerRate: '被动触发率',
  skillRange: '技能范围',
};

/** 阵营图标映射 */
export const FACTION_ICONS: Record<string, string> = {
  shu: '🟢',
  wei: '🔵',
  wu: '🔴',
  qun: '🟡',
};

// ─────────────────────────────────────────────
// 子组件：羁绊卡片
// ─────────────────────────────────────────────

export interface BondCardProps {
  bond: BondCatalogItem;
  ownedHeroIds: string[];
  isExpanded: boolean;
  onToggle: (bondId: string) => void;
}

const BondCard: React.FC<BondCardProps> = ({
  bond,
  ownedHeroIds,
  isExpanded,
  onToggle,
}) => {
  const { id, name, type, faction, heroIds, heroNames, description, level, effects, isActive, minRequired } = bond;

  const cardClass = [
    'tk-bond-card',
    isActive ? 'tk-bond-card--active' : 'tk-bond-card--inactive',
  ].filter(Boolean).join(' ');

  const icon = type === BondType.FACTION
    ? (faction ? FACTION_ICONS[faction] ?? '🏛️' : '🏛️')
    : '🤝';

  return (
    <div
      className={cardClass}
      onClick={() => onToggle(id)}
      data-testid={`bond-card-${id}`}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
    >
      {/* 头部 */}
      <div className="tk-bond-card__header">
        <div className="tk-bond-card__name-row">
          <span className="tk-bond-card__icon">{icon}</span>
          <span className="tk-bond-card__name">{name}</span>
          {level > 0 && <span className="tk-bond-card__level">Lv.{level}</span>}
        </div>
        <span className={`tk-bond-card__status-tag ${isActive ? 'tk-bond-card__status-tag--active' : 'tk-bond-card__status-tag--inactive'}`}>
          {isActive ? '已激活' : '未激活'}
        </span>
      </div>

      {/* 描述 */}
      <div className="tk-bond-card__desc">{description}</div>

      {/* 参与武将标签 */}
      {heroIds.length > 0 && (
        <div className="tk-bond-card__heroes">
          {heroIds.map((heroId, i) => {
            const owned = ownedHeroIds.includes(heroId);
            const displayName = heroNames[i] || heroId;
            return (
              <span
                key={heroId}
                className={`tk-bond-hero-tag ${owned ? 'tk-bond-hero-tag--owned' : 'tk-bond-hero-tag--missing'}`}
              >
                {owned ? '✓' : '✗'} {displayName}
              </span>
            );
          })}
        </div>
      )}

      {/* 展开详情 */}
      {isExpanded && (
        <div className="tk-bond-card__detail" data-testid={`bond-detail-${id}`}>
          {effects.map((eff, i) => (
            <div key={i} className="tk-bond-detail-row">
              <span className="tk-bond-detail-label">{STAT_LABELS[eff.stat] ?? eff.stat}</span>
              <span className={`tk-bond-detail-value ${!isActive ? 'tk-bond-detail-value--inactive' : ''}`}>
                {isActive ? `+${Math.round(eff.value * 100)}%` : `+${Math.round(eff.value * 100)}% (未激活)`}
              </span>
            </div>
          ))}
          {!isActive && minRequired > 0 && (
            <div className="tk-bond-detail-row">
              <span className="tk-bond-detail-label">激活条件</span>
              <span className="tk-bond-detail-value--inactive" style={{ fontWeight: 500, color: 'var(--tk-text-muted)' }}>
                需要 {minRequired} 名武将
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// 子组件：羁绊详情弹窗
// ─────────────────────────────────────────────

export interface BondDetailPopupProps {
  bond: BondCatalogItem;
  ownedHeroIds: string[];
  onClose: () => void;
}

export const BondDetailPopup: React.FC<BondDetailPopupProps> = ({ bond, ownedHeroIds, onClose }) => {
  const { id, name, type, faction, heroIds, heroNames, description, level, effects, isActive, minRequired } = bond;

  const icon = type === BondType.FACTION
    ? (faction ? FACTION_ICONS[faction] ?? '🏛️' : '🏛️')
    : '🤝';

  const ownedCount = heroIds.filter((hId) => ownedHeroIds.includes(hId)).length;

  return (
    <div className="tk-bond-popup-overlay" data-testid="bond-detail-popup" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tk-bond-popup" role="dialog" aria-modal="true" aria-label={`${name} 羁绊详情`}>
        <button className="tk-bond-popup-close" onClick={onClose} aria-label="关闭">✕</button>

        <div className="tk-bond-popup-header">
          <span className="tk-bond-popup-icon">{icon}</span>
          <span className="tk-bond-popup-name">{name}</span>
          <span className={`tk-bond-popup-status ${isActive ? 'tk-bond-popup-status--active' : 'tk-bond-popup-status--inactive'}`}>
            {isActive ? `已激活 Lv.${level}` : '未激活'}
          </span>
        </div>

        <div className="tk-bond-popup-desc">{description}</div>

        {/* 效果列表 */}
        <div className="tk-bond-popup-section">
          <h4 className="tk-bond-popup-section-title">属性加成</h4>
          <div className="tk-bond-popup-effects">
            {effects.map((eff, i) => (
              <div key={i} className="tk-bond-popup-effect-row">
                <span className="tk-bond-popup-effect-label">{STAT_LABELS[eff.stat] ?? eff.stat}</span>
                <span className={`tk-bond-popup-effect-value ${!isActive ? 'tk-bond-popup-effect-value--inactive' : ''}`}>
                  +{Math.round(eff.value * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 参与武将 */}
        <div className="tk-bond-popup-section">
          <h4 className="tk-bond-popup-section-title">
            参与武将 ({ownedCount}/{heroIds.length})
          </h4>
          <div className="tk-bond-popup-heroes">
            {heroIds.map((heroId, i) => {
              const owned = ownedHeroIds.includes(heroId);
              const displayName = heroNames[i] || heroId;
              return (
                <div
                  key={heroId}
                  className={`tk-bond-popup-hero ${owned ? 'tk-bond-popup-hero--owned' : 'tk-bond-popup-hero--missing'}`}
                >
                  <span className="tk-bond-popup-hero-icon">{owned ? '✓' : '✗'}</span>
                  <span className="tk-bond-popup-hero-name">{displayName}</span>
                  {!owned && <span className="tk-bond-popup-hero-hint">未拥有</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 激活条件 */}
        {!isActive && (
          <div className="tk-bond-popup-section">
            <h4 className="tk-bond-popup-section-title">激活条件</h4>
            <div className="tk-bond-popup-condition">
              需要 {minRequired} 名武将同时上阵
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BondCard;
