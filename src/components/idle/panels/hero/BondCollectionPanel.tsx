/**
 * BondCollectionPanel — 羁绊图鉴面板
 *
 * 功能：
 * - Tab切换：已激活羁绊 / 全部羁绊图鉴
 * - 羁绊卡片展示：名称、参与武将、效果描述、当前等级
 * - 已激活羁绊高亮显示，未激活灰色
 * - 点击羁绊卡片展示详情（参与武将列表+属性加成数值）
 * - 阵营羁绊和历史羁绊分组展示
 * - [增强] 当前编队阵营分布可视化
 * - [增强] 羁绊详情弹窗（点击查看完整效果+激活条件）
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
import { FACTION_ICONS, STAT_LABELS } from './BondCard';
import BondCard from './BondCard';
import { BondDetailPopup } from './BondCard';
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
        typeof item.type === 'string' &&
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

  // ── 阵营分布统计 ──
  const factionDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const heroId of formationHeroIds) {
      // 尝试从 heroFactionMap 获取阵营
      const faction = heroFactionMap?.[heroId];
      if (faction) {
        dist[faction] = (dist[faction] || 0) + 1;
      }
    }
    return dist;
  }, [formationHeroIds, heroFactionMap]);

  const totalFormationHeroes = formationHeroIds.length;

  return (
    <div className="tk-bond-panel" role="region" aria-label="羁绊图鉴" data-testid="bond-collection-panel">
      {/* ── 阵营分布可视化 ── */}
      {totalFormationHeroes > 0 && (
        <div className="tk-bond-faction-dist" data-testid="bond-faction-distribution">
          <div className="tk-bond-faction-dist-title">编队阵营分布</div>
          <div className="tk-bond-faction-dist-bar">
            {Object.entries(factionDistribution).map(([faction, count]) => {
              const pct = totalFormationHeroes > 0 ? (count / totalFormationHeroes) * 100 : 0;
              return (
                <div
                  key={faction}
                  className={`tk-bond-faction-segment tk-bond-faction-segment--${faction}`}
                  style={{ width: `${pct}%` }}
                  title={`${FACTION_ICONS[faction] ?? ''} ${faction}: ${count}人`}
                  data-testid={`faction-segment-${faction}`}
                />
              );
            })}
          </div>
          <div className="tk-bond-faction-dist-legend">
            {Object.entries(factionDistribution).map(([faction, count]) => (
              <span key={faction} className="tk-bond-faction-legend-item" data-testid={`faction-legend-${faction}`}>
                <span className={`tk-bond-faction-dot tk-bond-faction-dot--${faction}`} />
                {FACTION_ICONS[faction] ?? ''} {count}
              </span>
            ))}
          </div>
        </div>
      )}

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

      {/* ── 羁绊详情弹窗 ── */}
      {expandedBondId && (() => {
        const bond = catalog.find((b) => b.id === expandedBondId);
        if (!bond) return null;
        return (
          <BondDetailPopup
            bond={bond}
            ownedHeroIds={ownedHeroIds}
            onClose={() => setExpandedBondId(null)}
          />
        );
      })()}
    </div>
  );
};

BondCollectionPanel.displayName = 'BondCollectionPanel';

export default BondCollectionPanel;
