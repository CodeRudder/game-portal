/**
 * BondCollectionPanel — 羁绊图鉴面板
 *
 * 功能：
 * - Tab切换：已激活羁绊 / 全部羁绊图鉴
 * - 羁绊卡片展示：名称、参与武将、效果描述、当前等级
 * - 已激活羁绊高亮显示，未激活灰色
 * - 点击羁绊卡片展示详情（参与武将列表+属性加成数值）
 * - 阵营羁绊和历史羁绊分组展示
 *
 * 嵌入位置：武将详情弹窗的"羁绊"Tab 或独立入口
 * 引擎依赖：BondSystem / bond-config
 *
 * @module components/idle/panels/hero/BondCollectionPanel
 */

import React, { useState, useMemo, useCallback } from 'react';
import type {
  ActiveBond,
  FactionBondDefinition,
  PartnerBondDefinition,
  BondEffect,
} from '@/games/three-kingdoms/engine/hero/bond-config';
import { BondType, FACTION_BONDS, PARTNER_BONDS } from '@/games/three-kingdoms/engine/hero/bond-config';
import type { ActiveBondWithFaction } from './hero-ui.types';
import './BondCollectionPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

/** 羁绊图鉴条目（全部羁绊列表中的单条） */
export interface BondCatalogItem {
  /** 羁绊ID */
  id: string;
  /** 羁绊名称 */
  name: string;
  /** 羁绊类型 */
  type: BondType;
  /** 对应阵营（阵营羁绊） */
  faction?: string;
  /** 参与武将ID列表 */
  heroIds: string[];
  /** 参与武将名称列表（用于展示） */
  heroNames: string[];
  /** 效果描述 */
  description: string;
  /** 当前等级（0=未激活） */
  level: number;
  /** 属性加成列表 */
  effects: BondEffect[];
  /** 是否已激活 */
  isActive: boolean;
  /** 最低激活人数 */
  minRequired: number;
}

export interface BondCollectionPanelProps {
  /** 已拥有的武将ID列表（外部传入优先） */
  ownedHeroIds?: string[];
  /** 已激活的羁绊列表（外部传入优先） */
  activeBonds?: ActiveBond[];
  /** 编队中的武将ID列表（外部传入优先） */
  formationHeroIds?: string[];
  /** 全部羁绊图鉴数据（由外部从引擎配置构建） */
  bondCatalog?: BondCatalogItem[];
  /** 武将→阵营映射（用于阵营羁绊过滤） */
  heroFactionMap?: Record<string, string>;
  /** 关闭回调 */
  onClose: () => void;
  /**
   * 引擎数据源（P1-1 桥接）
   * 当提供此参数时，ownedHeroIds/activeBonds/formationHeroIds/bondCatalog/heroFactionMap
   * 从引擎数据自动获取，无需手动传入。
   */
  engineDataSource?: {
    ownedHeroIds: string[];
    activeBonds: ActiveBond[];
    formationHeroIds: string[];
    bondCatalog: BondCatalogItem[];
    heroFactionMap: Record<string, string>;
  };
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const STAT_LABELS: Record<string, string> = {
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

const FACTION_ICONS: Record<string, string> = {
  shu: '🟢',
  wei: '🔵',
  wu: '🔴',
  qun: '🟡',
};

const TAB_KEYS = {
  active: 'active',
  all: 'all',
} as const;

type TabKey = typeof TAB_KEYS[keyof typeof TAB_KEYS];

// ─────────────────────────────────────────────
// 从引擎配置构建图鉴数据
// ─────────────────────────────────────────────

function buildBondCatalog(
  ownedHeroIds: string[],
  activeBonds: ActiveBond[],
  formationHeroIds: string[],
  heroFactionMap?: Record<string, string>,
): BondCatalogItem[] {
  const items: BondCatalogItem[] = [];
  const activeBondIds = new Set(activeBonds.map((b) => b.bondId));

  // 构建阵营→武将映射（用于阵营羁绊过滤）
  // 优先使用外部传入的 heroFactionMap，否则从 activeBonds 的 participants 反推
  const factionHeroMap: Record<string, Set<string>> = {};
  if (heroFactionMap) {
    for (const [heroId, faction] of Object.entries(heroFactionMap)) {
      if (!factionHeroMap[faction]) factionHeroMap[faction] = new Set();
      factionHeroMap[faction].add(heroId);
    }
  } else {
    // 从已激活羁绊的 participants 反推阵营归属
    for (const bond of activeBonds) {
      if (bond.type === BondType.FACTION) {
        const faction = (bond as unknown as ActiveBondWithFaction).faction;
        if (faction) {
          if (!factionHeroMap[faction]) factionHeroMap[faction] = new Set();
          bond.participants.forEach((id) => factionHeroMap[faction].add(id));
        }
      }
    }
  }

  // 阵营羁绊
  for (const fb of FACTION_BONDS) {
    const isActive = activeBondIds.has(fb.id);
    const activeBond = activeBonds.find((b) => b.bondId === fb.id);
    const highestTier = fb.tiers[fb.tiers.length - 1];

    // 收集该阵营的已拥有武将：编队中 + 属于该阵营 + 已拥有
    const factionHeroSet = factionHeroMap[fb.faction];
    const factionHeroes = formationHeroIds.filter((heroId) => {
      if (!ownedHeroIds.includes(heroId)) return false;
      if (factionHeroSet) return factionHeroSet.has(heroId);
      // 无阵营映射时，回退：从 activeBond 的 participants 判断
      if (activeBond) return activeBond.participants.includes(heroId);
      return false;
    });
    const desc = fb.tiers.map((t) =>
      `${t.requiredCount}人: ${t.effects.map((e) => `${STAT_LABELS[e.stat] ?? e.stat}+${Math.round(e.value * 100)}%`).join(', ')}`
    ).join(' | ');

    items.push({
      id: fb.id,
      name: fb.name,
      type: BondType.FACTION,
      faction: fb.faction,
      heroIds: factionHeroes,
      heroNames: [],
      description: desc,
      level: activeBond?.level ?? 0,
      effects: highestTier.effects as BondEffect[],
      isActive,
      minRequired: fb.tiers[0]?.requiredCount ?? 2,
    });
  }

  // 搭档羁绊
  for (const pb of PARTNER_BONDS) {
    const isActive = activeBondIds.has(pb.id);
    const activeBond = activeBonds.find((b) => b.bondId === pb.id);
    const ownedCount = pb.generalIds.filter((id) => ownedHeroIds.includes(id)).length;

    const desc = pb.effects.map((e) =>
      `${STAT_LABELS[e.stat] ?? e.stat}+${Math.round(e.value * 100)}%`
    ).join(', ');

    items.push({
      id: pb.id,
      name: pb.name,
      type: BondType.PARTNER,
      heroIds: [...pb.generalIds],
      heroNames: [],
      description: desc,
      level: activeBond?.level ?? 0,
      effects: pb.effects as BondEffect[],
      isActive,
      minRequired: pb.minRequired,
    });
  }

  return items;
}

// ─────────────────────────────────────────────
// 子组件：羁绊卡片
// ─────────────────────────────────────────────

interface BondCardProps {
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
// 主组件
// ─────────────────────────────────────────────

const BondCollectionPanel: React.FC<BondCollectionPanelProps> = ({
  ownedHeroIds: externalOwnedHeroIds,
  activeBonds: externalActiveBonds,
  formationHeroIds: externalFormationHeroIds,
  bondCatalog: externalCatalog,
  heroFactionMap: externalHeroFactionMap,
  onClose,
  engineDataSource,
}) => {
  // 优先使用外部传入数据，否则使用引擎数据源
  const rawOwnedHeroIds = externalOwnedHeroIds ?? engineDataSource?.ownedHeroIds ?? [];
  const rawActiveBonds = externalActiveBonds ?? engineDataSource?.activeBonds ?? [];
  const formationHeroIds = externalFormationHeroIds ?? engineDataSource?.formationHeroIds ?? [];
  const heroFactionMap = externalHeroFactionMap ?? engineDataSource?.heroFactionMap;

  // ── Props 校验：过滤非法数据 ──
  const ownedHeroIds = useMemo(() =>
    rawOwnedHeroIds.filter((id): id is string => typeof id === 'string' && id.length > 0),
  [rawOwnedHeroIds]);

  const activeBonds = useMemo(() =>
    rawActiveBonds.filter((b) =>
      b.bondId && typeof b.bondId === 'string' &&
      b.name && typeof b.name === 'string' &&
      Array.isArray(b.participants),
    ),
  [rawActiveBonds]);
  const [activeTab, setActiveTab] = useState<TabKey>(TAB_KEYS.active);
  const [expandedBondId, setExpandedBondId] = useState<string | null>(null);

  // 构建图鉴数据
  const catalog = useMemo(() => {
    if (externalCatalog) {
      // 校验外部传入的图鉴数据完整性
      return externalCatalog.filter((item) =>
        item.id && typeof item.id === 'string' &&
        item.name && typeof item.name === 'string' &&
        typeof item.type === 'number' &&
        Array.isArray(item.effects) &&
        typeof item.isActive === 'boolean',
      );
    }
    return buildBondCatalog(ownedHeroIds, activeBonds, formationHeroIds, heroFactionMap);
  }, [externalCatalog, ownedHeroIds, activeBonds, formationHeroIds, heroFactionMap]);

  // 分组：阵营羁绊 / 搭档羁绊
  const factionBonds = useMemo(
    () => catalog.filter((b) => b.type === BondType.FACTION),
    [catalog],
  );
  const partnerBonds = useMemo(
    () => catalog.filter((b) => b.type === BondType.PARTNER),
    [catalog],
  );

  // 当前Tab过滤
  const filteredFaction = useMemo(() => {
    if (activeTab === TAB_KEYS.active) return factionBonds.filter((b) => b.isActive);
    return factionBonds;
  }, [activeTab, factionBonds]);

  const filteredPartner = useMemo(() => {
    if (activeTab === TAB_KEYS.active) return partnerBonds.filter((b) => b.isActive);
    return partnerBonds;
  }, [activeTab, partnerBonds]);

  const isEmpty = filteredFaction.length === 0 && filteredPartner.length === 0;

  const handleToggle = useCallback((bondId: string) => {
    setExpandedBondId((prev) => (prev === bondId ? null : bondId));
  }, []);

  return (
    <div className="tk-bond-panel" role="region" aria-label="羁绊图鉴" data-testid="bond-collection-panel">
      {/* Tab 切换 */}
      <div className="tk-bond-tabs" role="tablist">
        <button
          className={`tk-bond-tab ${activeTab === TAB_KEYS.active ? 'tk-bond-tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_KEYS.active)}
          role="tab"
          aria-selected={activeTab === TAB_KEYS.active}
          data-testid="tab-active-bonds"
        >
          已激活 ({activeBonds.length})
        </button>
        <button
          className={`tk-bond-tab ${activeTab === TAB_KEYS.all ? 'tk-bond-tab--active' : ''}`}
          onClick={() => setActiveTab(TAB_KEYS.all)}
          role="tab"
          aria-selected={activeTab === TAB_KEYS.all}
          data-testid="tab-all-bonds"
        >
          全部图鉴 ({catalog.length})
        </button>
      </div>

      {/* 羁绊列表 */}
      {isEmpty ? (
        <div className="tk-bond-panel__empty">
          {activeTab === TAB_KEYS.active ? '暂无激活的羁绊' : '暂无羁绊数据'}
        </div>
      ) : (
        <div className="tk-bond-list">
          {/* 阵营羁绊 */}
          {filteredFaction.length > 0 && (
            <>
              <div className="tk-bond-group-title">🏛️ 阵营羁绊</div>
              {filteredFaction.map((bond) => (
                <BondCard
                  key={bond.id}
                  bond={bond}
                  ownedHeroIds={ownedHeroIds}
                  isExpanded={expandedBondId === bond.id}
                  onToggle={handleToggle}
                />
              ))}
            </>
          )}

          {/* 搭档羁绊 */}
          {filteredPartner.length > 0 && (
            <>
              <div className="tk-bond-group-title">🤝 搭档羁绊</div>
              {filteredPartner.map((bond) => (
                <BondCard
                  key={bond.id}
                  bond={bond}
                  ownedHeroIds={ownedHeroIds}
                  isExpanded={expandedBondId === bond.id}
                  onToggle={handleToggle}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

BondCollectionPanel.displayName = 'BondCollectionPanel';

export default BondCollectionPanel;
