/**
 * BondPanel — 武将羁绊面板
 * 阵营分布 + 羁绊列表 + 总加成预览 + 好感度提示
 * @module components/idle/panels/hero/BondPanel
 */

import React, { useMemo, useState } from 'react';
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
import BondCollectionProgress from './BondCollectionProgress';
import BondCardItem from './BondCardItem';
import type { BondCardData, BondTierComparison } from './BondCardItem';
import './BondPanel.css';

// ─────────────────────────────────────────────
// 故事事件配置（N-12-5: 好感度UI入口增强）
// ─────────────────────────────────────────────

interface StoryEventDef {
  id: string;
  title: string;
  requiredHeroes: string[];
  minFavorability: number;
  minLevel: number;
}

const STORY_EVENTS: StoryEventDef[] = [
  { id: 'story_001', title: '桃园结义', requiredHeroes: ['刘备', '关羽', '张飞'], minFavorability: 50, minLevel: 5 },
  { id: 'story_002', title: '三顾茅庐', requiredHeroes: ['刘备', '诸葛亮'], minFavorability: 60, minLevel: 10 },
  { id: 'story_003', title: '赤壁之战', requiredHeroes: ['周瑜', '诸葛亮', '曹操'], minFavorability: 70, minLevel: 15 },
  { id: 'story_004', title: '过五关斩六将', requiredHeroes: ['关羽'], minFavorability: 80, minLevel: 20 },
  { id: 'story_005', title: '草船借箭', requiredHeroes: ['诸葛亮', '曹操'], minFavorability: 55, minLevel: 12 },
];

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
  /** 查看羁绊图鉴回调 — 点击后切换到 BondCollectionPanel */
  onViewCollection?: () => void;
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
 * 安全的浮点数加法 — 避免浮点精度丢失
 *
 * 例如 0.1 + 0.2 = 0.30000000000000004 → 修正为 0.3
 * 使用「转为整数运算再转回」的方式确保精度。
 */
function safeAdd(a: number, b: number): number {
  // 取两者小数位数中的最大值
  const precision = Math.max(
    (String(a).split('.')[1] || '').length,
    (String(b).split('.')[1] || '').length,
  );
  const factor = Math.pow(10, precision);
  return (Math.round(a * factor) + Math.round(b * factor)) / factor;
}

/**
 * 格式化加成效果为可读字符串
 *
 * 使用 safeAdd 累加后 Math.round 取整，确保显示精度。
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

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const BondPanel: React.FC<BondPanelProps> = ({
  heroIds,
  heroFactionMap,
  bondCatalog: externalBondCatalog,
  onViewCollection,
}) => {
  const factionMap = heroFactionMap ?? HERO_FACTION_MAP;

  // ── 0. 对 heroIds 去重，避免重复ID导致阵营计数错误 ──
  const uniqueHeroIds = useMemo(() => [...new Set(heroIds)], [heroIds]);
  const heroIdSet = useMemo(() => new Set(uniqueHeroIds), [uniqueHeroIds]);

  // ── 羁绊卡片展开状态 ──
  const [expandedBondId, setExpandedBondId] = useState<string | null>(null);
  const handleToggleBond = useMemo(
    () => (id: string) => setExpandedBondId(prev => prev === id ? null : id),
    [],
  );

  // ── 1. 计算阵营分布 ──
  const { factionCounts, distributionItems } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of ALL_FACTIONS) {
      counts[f] = 0;
    }
    for (const id of uniqueHeroIds) {
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
  }, [uniqueHeroIds, factionMap]);

  // ── 2. 构建羁绊列表（阵营 + 搭档） ──
  const allBonds = useMemo(() => {
    const bonds: BondCardData[] = [];

    // 阵营羁绊（每个阵营取最高激活等级）
    for (const faction of ALL_FACTIONS) {
      const tiers = FACTION_TIER_MAP[faction];
      const factionCount = factionCounts[faction] ?? 0;

      // 找到最高匹配的 tier
      let bestActiveTier: FactionTierDef | null = null;
      let bestActiveTierIndex = -1;
      for (let ti = 0; ti < tiers.length; ti++) {
        if (factionCount >= tiers[ti].requiredCount) {
          bestActiveTier = tiers[ti];
          bestActiveTierIndex = ti;
        }
      }

      // 构建羁绊等级效果对比
      const tierComparison: BondTierComparison | undefined = (() => {
        if (bestActiveTier) {
          const nextTier = bestActiveTierIndex < tiers.length - 1 ? tiers[bestActiveTierIndex + 1] : null;
          return {
            currentTier: bestActiveTier.tierName,
            currentEffect: formatEffect(bestActiveTier.effect),
            nextTier: nextTier?.tierName ?? null,
            nextEffect: nextTier ? formatEffect(nextTier.effect) : null,
            nextRequired: nextTier?.requiredCount ?? null,
          };
        }
        // 未激活：显示第一级信息
        const firstTier = tiers[0];
        return {
          currentTier: '未激活',
          currentEffect: '无效果',
          nextTier: firstTier.tierName,
          nextEffect: formatEffect(firstTier.effect),
          nextRequired: firstTier.requiredCount,
        };
      })();

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
          tierComparison,
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
          tierComparison,
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
  }, [uniqueHeroIds, heroIdSet, factionCounts, externalBondCatalog]);

  // ── 3. 分组：已激活 / 未激活 ──
  const activeBonds = useMemo(() => allBonds.filter(b => b.isActive), [allBonds]);
  const inactiveBonds = useMemo(() => allBonds.filter(b => !b.isActive), [allBonds]);

  // ── 4. 计算编队羁绊总加成 ──
  // 使用 safeAdd 浮点安全累加，避免 0.1+0.2=0.30000000000000004
  const totalBonus = useMemo(() => {
    const bonus: Record<string, number> = {
      attackBonus: 0,
      defenseBonus: 0,
      hpBonus: 0,
      critBonus: 0,
      strategyBonus: 0,
    };
    // 遍历所有激活的羁绊，累加效果
    for (const bond of activeBonds) {
      // 阵营羁绊：从 FACTION_TIER_MAP 获取精确效果
      if (bond.type === 'faction' && bond.faction) {
        const tiers = FACTION_TIER_MAP[bond.faction];
        const factionCount = factionCounts[bond.faction] ?? 0;
        for (const tier of tiers) {
          if (factionCount >= tier.requiredCount) {
            bonus.attackBonus = safeAdd(bonus.attackBonus, tier.effect.attackBonus);
            bonus.defenseBonus = safeAdd(bonus.defenseBonus, tier.effect.defenseBonus);
            bonus.hpBonus = safeAdd(bonus.hpBonus, tier.effect.hpBonus);
            bonus.critBonus = safeAdd(bonus.critBonus, tier.effect.critBonus);
            bonus.strategyBonus = safeAdd(bonus.strategyBonus, tier.effect.strategyBonus);
          }
        }
      }
      // 搭档羁绊：从 PARTNER_BOND_CONFIGS 获取精确效果
      if (bond.type === 'partner') {
        const partnerBonds = externalBondCatalog
          ? externalBondCatalog.filter(b => b.type === 'partner')
          : PARTNER_BOND_CONFIGS;
        const config = partnerBonds.find(b => b.id === bond.id);
        if (config) {
          bonus.attackBonus = safeAdd(bonus.attackBonus, config.effect.attackBonus);
          bonus.defenseBonus = safeAdd(bonus.defenseBonus, config.effect.defenseBonus);
          bonus.hpBonus = safeAdd(bonus.hpBonus, config.effect.hpBonus);
          bonus.critBonus = safeAdd(bonus.critBonus, config.effect.critBonus);
          bonus.strategyBonus = safeAdd(bonus.strategyBonus, config.effect.strategyBonus);
        }
      }
    }
    return bonus;
  }, [activeBonds, factionCounts, externalBondCatalog]);

  // 格式化总加成为可读文本
  const totalBonusText = useMemo(() => {
    const parts: string[] = [];
    if (totalBonus.attackBonus > 0) parts.push(`攻击+${Math.round(totalBonus.attackBonus * 100)}%`);
    if (totalBonus.defenseBonus > 0) parts.push(`防御+${Math.round(totalBonus.defenseBonus * 100)}%`);
    if (totalBonus.hpBonus > 0) parts.push(`生命+${Math.round(totalBonus.hpBonus * 100)}%`);
    if (totalBonus.critBonus > 0) parts.push(`暴击+${Math.round(totalBonus.critBonus * 100)}%`);
    if (totalBonus.strategyBonus > 0) parts.push(`策略+${Math.round(totalBonus.strategyBonus * 100)}%`);
    return parts.join('，');
  }, [totalBonus]);

  // ── 渲染 ──
  return (
    <div className="bond-panel" data-testid="bond-panel">
      {/* 标题 */}
      <div className="bond-panel__title">
        <h3>羁绊面板</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="bond-panel__count" data-testid="bond-active-count">
            已激活 {activeBonds.length}/{allBonds.length}
          </span>
          {onViewCollection && (
            <button
              className="bond-panel__collection-btn"
              data-testid="bond-panel-view-collection"
              onClick={onViewCollection}
              title="查看羁绊图鉴"
            >
              📖 图鉴
            </button>
          )}
        </div>
      </div>

      {/* 阵营分布 */}
      <FactionDistributionBar
        items={distributionItems}
        total={uniqueHeroIds.length}
      />

      {/* 羁绊收集进度总览 */}
      <BondCollectionProgress
        totalBonds={allBonds.length}
        activatedBonds={activeBonds.length}
        factionActivated={activeBonds.filter(b => b.type === 'faction').length}
        factionTotal={allBonds.filter(b => b.type === 'faction').length}
        partnerActivated={activeBonds.filter(b => b.type === 'partner').length}
        partnerTotal={allBonds.filter(b => b.type === 'partner').length}
      />

      {/* 编队羁绊总加成预览 */}
      {activeBonds.length > 0 && totalBonusText && (
        <div className="bond-panel__total-bonus" data-testid="bond-total-bonus">
          <div className="bond-panel__total-bonus-header">
            <span className="bond-panel__total-bonus-icon">⚔️</span>
            <span className="bond-panel__total-bonus-title">编队羁绊总加成</span>
            <span className="bond-panel__total-bonus-count">{activeBonds.length} 个羁绊生效</span>
          </div>
          <div className="bond-panel__total-bonus-effects" data-testid="bond-total-bonus-effects">
            {totalBonus.attackBonus > 0 && (
              <span className="bond-panel__bonus-item bond-panel__bonus-item--attack">
                🗡️ 攻击 +{Math.round(totalBonus.attackBonus * 100)}%
              </span>
            )}
            {totalBonus.defenseBonus > 0 && (
              <span className="bond-panel__bonus-item bond-panel__bonus-item--defense">
                🛡️ 防御 +{Math.round(totalBonus.defenseBonus * 100)}%
              </span>
            )}
            {totalBonus.hpBonus > 0 && (
              <span className="bond-panel__bonus-item bond-panel__bonus-item--hp">
                ❤️ 生命 +{Math.round(totalBonus.hpBonus * 100)}%
              </span>
            )}
            {totalBonus.critBonus > 0 && (
              <span className="bond-panel__bonus-item bond-panel__bonus-item--crit">
                ⚡ 暴击 +{Math.round(totalBonus.critBonus * 100)}%
              </span>
            )}
            {totalBonus.strategyBonus > 0 && (
              <span className="bond-panel__bonus-item bond-panel__bonus-item--strategy">
                🔮 策略 +{Math.round(totalBonus.strategyBonus * 100)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* 已激活羁绊 */}
      {activeBonds.length > 0 && (
        <div className="bond-section">
          <div className="bond-section__title">已激活羁绊</div>
          <div className="bond-grid" data-testid="bond-grid-active">
            {activeBonds.map(bond => (
              <BondCardItem key={bond.id} bond={bond} isExpanded={expandedBondId === bond.id} onToggle={handleToggleBond} />
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
              <BondCardItem key={bond.id} bond={bond} isExpanded={expandedBondId === bond.id} onToggle={handleToggleBond} />
            ))}
          </div>
        </div>
      )}

      {/* 空编队提示 */}
      {uniqueHeroIds.length === 0 && (
        <div className="bond-panel__empty" data-testid="bond-panel-empty">
          当前编队为空，请先添加武将
        </div>
      )}

      {/* 好感度与故事事件入口 */}
      {uniqueHeroIds.length > 0 && (
        <div className="bond-panel__favorability-hint" data-testid="bond-favorability-hint">
          <div className="bond-panel__favorability-hint-icon">💝</div>
          <div className="bond-panel__favorability-hint-text">
            <span className="bond-panel__favorability-hint-title">好感度系统</span>
            <span className="bond-panel__favorability-hint-desc">
              特定武将组合达到好感度要求后可触发专属故事事件（如「桃园结义」需刘备+关羽+张飞好感度≥50且等级≥5）
            </span>
            <div className="bond-panel__favorability-hint-bonds" data-testid="bond-favorability-bonds">
              {/* 显示搭档羁绊的好感度状态标签 */}
              {allBonds.filter(b => b.type === 'partner').slice(0, 3).map(bond => (
                <span key={bond.id} className="bond-panel__favorability-bond-tag">
                  {bond.isActive ? '✅' : '🔓'} {bond.name}
                </span>
              ))}
              {allBonds.filter(b => b.type === 'partner').length > 3 && (
                <span className="bond-panel__favorability-bond-more">
                  +{allBonds.filter(b => b.type === 'partner').length - 3} 更多
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 故事事件入口（N-12-5: 好感度UI入口增强） */}
      {uniqueHeroIds.length > 0 && (
        <div className="bond-panel__story-events" data-testid="bond-story-events">
          <div className="bond-panel__story-events-header">
            <span className="bond-panel__story-events-icon">📜</span>
            <span className="bond-panel__story-events-title">故事事件</span>
          </div>
          <div className="bond-panel__story-events-list">
            {STORY_EVENTS.map(event => {
              const hasHeroes = event.requiredHeroes.every(h => heroIdSet.has(h));
              return (
                <div key={event.id}
                  className={`bond-panel__story-event ${hasHeroes ? 'bond-panel__story-event--available' : 'bond-panel__story-event--locked'}`}
                  data-testid={`bond-story-event-${event.id}`}>
                  <span className="bond-panel__story-event-name">{event.title}</span>
                  <span className="bond-panel__story-event-heroes">
                    {event.requiredHeroes.join(' + ')}
                  </span>
                  <span className="bond-panel__story-event-requirement">
                    {hasHeroes ? '✅ 武将已齐' : `需 ${event.requiredHeroes.filter(h => !heroIdSet.has(h)).join('、')}`}
                  </span>
                  {event.minLevel > 0 && (
                    <span className="bond-panel__story-event-level">等级≥{event.minLevel}</span>
                  )}
                  {event.minFavorability > 0 && (
                    <span className="bond-panel__story-event-favor">好感≥{event.minFavorability}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

BondPanel.displayName = 'BondPanel';
export default BondPanel;
