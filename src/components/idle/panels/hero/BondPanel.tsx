/**
 * BondPanel — 武将羁绊面板
 *
 * 功能：
 * - 显示当前编队的阵营分布（魏/蜀/吴/群雄各几人）
 * - 显示已激活的羁绊列表（阵营羁绊 + 搭档羁绊）
 * - 每个羁绊显示名称、效果描述、激活状态
 * - 未激活羁绊灰色显示
 *
 * Props:
 * - heroIds: 当前编队武将ID列表
 * - heroFactionMap: 武将→阵营映射（可选，默认使用内置映射）
 * - bondCatalog: 全部羁绊配置列表（可选，默认使用内置配置）
 *
 * @module components/idle/panels/hero/BondPanel
 */

import React, { useMemo } from 'react';
import {
  HERO_FACTION_MAP,
  FACTION_TIER_MAP,
  PARTNER_BOND_CONFIGS,
  ALL_FACTIONS,
  FACTION_NAMES,
} from '@/games/three-kingdoms/engine/hero/faction-bond-config';
import type {
  FactionId,
  BondConfig,
  FactionTierDef,
  BondEffect,
} from '@/games/three-kingdoms/engine/hero/faction-bond-config';
import './BondPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface BondPanelProps {
  /** 当前编队武将ID列表 */
  heroIds: string[];
  /** 武将→阵营映射（可选，默认使用内置 HERO_FACTION_MAP） */
  heroFactionMap?: Readonly<Record<string, FactionId>>;
  /** 全部羁绊配置列表（可选，默认从阵营+搭档配置构建） */
  bondCatalog?: BondConfig[];
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 阵营图标映射 */
const FACTION_ICONS: Record<FactionId, string> = {
  wei: '🔵',
  shu: '🟢',
  wu: '🔴',
  neutral: '🟡',
};

/** 阵营 CSS class 映射 */
const FACTION_CLASS: Record<FactionId, string> = {
  wei: 'bond-faction-wei',
  shu: 'bond-faction-shu',
  wu: 'bond-faction-wu',
  neutral: 'bond-faction-qun',
};

/** 属性中英文映射 */
const STAT_LABELS: Record<string, string> = {
  attackBonus: '攻击',
  defenseBonus: '防御',
  hpBonus: '生命',
  critBonus: '暴击',
  strategyBonus: '策略',
};

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/**
 * 格式化加成效果为可读字符串
 */
function formatEffect(effect: BondEffect): string {
  const parts: string[] = [];
  if (effect.attackBonus > 0) parts.push(`攻击+${Math.round(effect.attackBonus * 100)}%`);
  if (effect.defenseBonus > 0) parts.push(`防御+${Math.round(effect.defenseBonus * 100)}%`);
  if (effect.hpBonus > 0) parts.push(`生命+${Math.round(effect.hpBonus * 100)}%`);
  if (effect.critBonus > 0) parts.push(`暴击+${Math.round(effect.critBonus * 100)}%`);
  if (effect.strategyBonus > 0) parts.push(`策略+${Math.round(effect.strategyBonus * 100)}%`);
  return parts.join('，');
}

/**
 * 判断阵营羁绊是否激活
 */
function isFactionBondActive(
  faction: FactionId,
  requiredCount: number,
  factionCounts: Record<string, number>,
): boolean {
  return (factionCounts[faction] ?? 0) >= requiredCount;
}

/**
 * 判断搭档羁绊是否激活
 */
function isPartnerBondActive(
  bond: BondConfig,
  heroIdSet: Set<string>,
): boolean {
  const matched = bond.requiredHeroes.filter(id => heroIdSet.has(id));
  return matched.length >= bond.minCount;
}

// ─────────────────────────────────────────────
// 子组件：阵营分布条
// ─────────────────────────────────────────────

/** 阵营分布条目 */
interface FactionDistributionItem {
  faction: FactionId;
  label: string;
  icon: string;
  count: number;
  cssClass: string;
}

const FactionDistributionBar: React.FC<{
  items: FactionDistributionItem[];
  total: number;
}> = React.memo(({ items, total }) => (
  <div className="bond-faction-distribution" data-testid="bond-faction-distribution">
    <div className="bond-faction-bar">
      {items.map(item => (
        <div
          key={item.faction}
          className={`bond-faction-segment ${item.cssClass}`}
          style={{ width: total > 0 ? `${(item.count / total) * 100}%` : '0%' }}
          data-testid={`bond-faction-segment-${item.faction}`}
        />
      ))}
    </div>
    <div className="bond-faction-labels">
      {items.map(item => (
        <span key={item.faction} className={`bond-faction-label ${item.cssClass}`}>
          {item.icon} {item.label}: {item.count}人
        </span>
      ))}
    </div>
  </div>
));
FactionDistributionBar.displayName = 'FactionDistributionBar';

// ─────────────────────────────────────────────
// 子组件：羁绊卡片
// ─────────────────────────────────────────────

interface BondCardData {
  id: string;
  name: string;
  type: 'faction' | 'partner';
  description: string;
  effectText: string;
  isActive: boolean;
  faction?: FactionId;
  minRequired: number;
  currentCount: number;
}

const BondCardItem: React.FC<{ bond: BondCardData }> = React.memo(({ bond }) => (
  <div
    className={`bond-card ${bond.isActive ? 'bond-card--active' : 'bond-card--inactive'}`}
    data-testid={`bond-card-${bond.id}`}
  >
    <div className="bond-card__header">
      <span className="bond-card__name">{bond.name}</span>
      <span
        className={`bond-card__status ${bond.isActive ? 'bond-card__status--active' : ''}`}
        data-testid={`bond-status-${bond.id}`}
      >
        {bond.isActive ? '已激活' : '未激活'}
      </span>
    </div>
    <div className="bond-card__effect" data-testid={`bond-effect-${bond.id}`}>
      {bond.effectText}
    </div>
    <div className="bond-card__progress">
      <span data-testid={`bond-progress-${bond.id}`}>
        {bond.currentCount}/{bond.minRequired}
      </span>
    </div>
    {bond.faction && (
      <span className={`bond-card__faction-tag ${FACTION_CLASS[bond.faction]}`}>
        {FACTION_NAMES[bond.faction]}
      </span>
    )}
  </div>
));
BondCardItem.displayName = 'BondCardItem';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const BondPanel: React.FC<BondPanelProps> = ({
  heroIds,
  heroFactionMap,
  bondCatalog: externalBondCatalog,
}) => {
  const factionMap = heroFactionMap ?? HERO_FACTION_MAP;

  // ── 1. 计算阵营分布 ──
  const { factionCounts, distributionItems } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of ALL_FACTIONS) {
      counts[f] = 0;
    }
    for (const id of heroIds) {
      const faction = factionMap[id];
      if (faction) {
        counts[faction] = (counts[faction] ?? 0) + 1;
      }
    }

    const items: FactionDistributionItem[] = ALL_FACTIONS.map(f => ({
      faction: f,
      label: FACTION_NAMES[f],
      icon: FACTION_ICONS[f],
      count: counts[f] ?? 0,
      cssClass: FACTION_CLASS[f],
    }));

    return { factionCounts: counts, distributionItems: items };
  }, [heroIds, factionMap]);

  // ── 2. 构建羁绊列表（阵营 + 搭档） ──
  const allBonds = useMemo(() => {
    const heroIdSet = new Set(heroIds);
    const bonds: BondCardData[] = [];

    // 阵营羁绊（每个阵营取最高激活等级）
    for (const faction of ALL_FACTIONS) {
      const tiers = FACTION_TIER_MAP[faction];
      const factionCount = factionCounts[faction] ?? 0;

      // 找到最高匹配的 tier
      let bestActiveTier: FactionTierDef | null = null;
      for (const tier of tiers) {
        if (factionCount >= tier.requiredCount) {
          bestActiveTier = tier;
        }
      }

      // 如果有激活的 tier，只显示最高等级
      if (bestActiveTier) {
        bonds.push({
          id: `faction_${faction}`,
          name: `${FACTION_NAMES[faction]}阵营${bestActiveTier.tierName}羁绊`,
          type: 'faction',
          description: bestActiveTier.description,
          effectText: formatEffect(bestActiveTier.effect),
          isActive: true,
          faction,
          minRequired: bestActiveTier.requiredCount,
          currentCount: factionCount,
        });
      } else {
        // 未激活：显示最低等级门槛
        const firstTier = tiers[0];
        bonds.push({
          id: `faction_${faction}`,
          name: `${FACTION_NAMES[faction]}阵营羁绊`,
          type: 'faction',
          description: firstTier.description,
          effectText: formatEffect(firstTier.effect),
          isActive: false,
          faction,
          minRequired: firstTier.requiredCount,
          currentCount: factionCount,
        });
      }
    }

    // 搭档羁绊
    const partnerBonds = externalBondCatalog
      ? externalBondCatalog.filter(b => b.type === 'partner')
      : PARTNER_BOND_CONFIGS;

    for (const bond of partnerBonds) {
      const matched = bond.requiredHeroes.filter(id => heroIdSet.has(id));
      const active = matched.length >= bond.minCount;

      bonds.push({
        id: bond.id,
        name: bond.name,
        type: 'partner',
        description: bond.description,
        effectText: formatEffect(bond.effect),
        isActive: active,
        minRequired: bond.minCount,
        currentCount: matched.length,
      });
    }

    return bonds;
  }, [heroIds, factionCounts, externalBondCatalog]);

  // ── 3. 分组：已激活 / 未激活 ──
  const activeBonds = useMemo(() => allBonds.filter(b => b.isActive), [allBonds]);
  const inactiveBonds = useMemo(() => allBonds.filter(b => !b.isActive), [allBonds]);

  // ── 渲染 ──
  return (
    <div className="bond-panel" data-testid="bond-panel">
      {/* 标题 */}
      <div className="bond-panel__title">
        <h3>羁绊面板</h3>
        <span className="bond-panel__count" data-testid="bond-active-count">
          已激活 {activeBonds.length}/{allBonds.length}
        </span>
      </div>

      {/* 阵营分布 */}
      <FactionDistributionBar
        items={distributionItems}
        total={heroIds.length}
      />

      {/* 已激活羁绊 */}
      {activeBonds.length > 0 && (
        <div className="bond-section">
          <div className="bond-section__title">已激活羁绊</div>
          <div className="bond-grid" data-testid="bond-grid-active">
            {activeBonds.map(bond => (
              <BondCardItem key={bond.id} bond={bond} />
            ))}
          </div>
        </div>
      )}

      {/* 未激活羁绊 */}
      {inactiveBonds.length > 0 && (
        <div className="bond-section">
          <div className="bond-section__title bond-section__title--inactive">未激活羁绊</div>
          <div className="bond-grid" data-testid="bond-grid-inactive">
            {inactiveBonds.map(bond => (
              <BondCardItem key={bond.id} bond={bond} />
            ))}
          </div>
        </div>
      )}

      {/* 空编队提示 */}
      {heroIds.length === 0 && (
        <div className="bond-panel__empty" data-testid="bond-panel-empty">
          当前编队为空，请先添加武将
        </div>
      )}
    </div>
  );
};

BondPanel.displayName = 'BondPanel';
export default BondPanel;
