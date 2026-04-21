/**
 * 三国霸业 — 武将列表面板
 *
 * 展示已拥有的武将列表，支持：
 *   - 按品质筛选（全部/普通/精良/稀有/史诗/传说）
 *   - 按阵营筛选（全部/蜀/魏/吴/群）
 *   - 按等级/品质/战力排序
 *   - 点击武将卡片触发详情查看
 *
 * @module ui/components/HeroListPanel
 */

import { useState, useMemo, useCallback } from 'react';
import { useGameContext } from '../context/GameContext';
import type { Quality, Faction } from '../../engine/hero/hero.types';
import { Quality as Q, QUALITY_ORDER, QUALITY_LABELS, QUALITY_BORDER_COLORS, FACTION_LABELS, FACTIONS } from '../../engine/hero/hero.types';
import type { GeneralData } from '../../engine/hero/hero.types';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

type QualityFilter = 'all' | Quality;
type FactionFilter = 'all' | Faction;
type SortKey = 'level' | 'quality' | 'power';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface HeroListPanelProps {
  /** 点击武将回调，传入武将ID */
  onHeroClick?: (heroId: string) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 计算武将战力（简化版） */
function calcPower(hero: GeneralData): number {
  const s = hero.baseStats;
  return Math.round((s.attack + s.defense + s.intelligence + s.speed) * (1 + hero.level * 0.1));
}

/** 品质筛选选项 */
const QUALITY_FILTERS: { value: QualityFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: Q.COMMON, label: '普通' },
  { value: Q.FINE, label: '精良' },
  { value: Q.RARE, label: '稀有' },
  { value: Q.EPIC, label: '史诗' },
  { value: Q.LEGENDARY, label: '传说' },
];

/** 阵营筛选选项 */
const FACTION_FILTERS: { value: FactionFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  ...FACTIONS.map((f) => ({ value: f as FactionFilter, label: FACTION_LABELS[f] })),
];

/** 排序选项 */
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'level', label: '等级' },
  { value: 'quality', label: '品质' },
  { value: 'power', label: '战力' },
];

// ─────────────────────────────────────────────
// 子组件：武将卡片
// ─────────────────────────────────────────────

interface HeroCardProps {
  hero: GeneralData;
  power: number;
  onClick: (id: string) => void;
}

function HeroCard({ hero, power, onClick }: HeroCardProps) {
  const borderColor = QUALITY_BORDER_COLORS[hero.quality];
  const qualityLabel = QUALITY_LABELS[hero.quality];

  return (
    <div
      style={{
        ...cardStyles.container,
        borderLeftColor: borderColor,
      }}
      onClick={() => onClick(hero.id)}
      role="button"
      tabIndex={0}
      aria-label={`${hero.name} ${qualityLabel} 等级${hero.level}`}
    >
      {/* 品质标签 */}
      <div style={{ ...cardStyles.badge, backgroundColor: borderColor + '30', color: borderColor }}>
        {qualityLabel}
      </div>

      {/* 名称 */}
      <div style={cardStyles.name}>{hero.name}</div>

      {/* 阵营 + 等级 */}
      <div style={cardStyles.meta}>
        <span>{FACTION_LABELS[hero.faction]}</span>
        <span>Lv.{hero.level}</span>
      </div>

      {/* 战力 */}
      <div style={cardStyles.power}>
        ⚔️ {power.toLocaleString()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * HeroListPanel — 武将列表面板
 *
 * @example
 * ```tsx
 * <HeroListPanel onHeroClick={(id) => setSelectedHero(id)} />
 * ```
 */
export function HeroListPanel({ onHeroClick, className }: HeroListPanelProps) {
  const { snapshot } = useGameContext();
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');
  const [factionFilter, setFactionFilter] = useState<FactionFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('quality');

  // 筛选 + 排序
  const heroes = useMemo(() => {
    if (!snapshot?.heroes) return [];

    let list = [...snapshot.heroes];

    // 品质筛选
    if (qualityFilter !== 'all') {
      list = list.filter((h) => h.quality === qualityFilter);
    }

    // 阵营筛选
    if (factionFilter !== 'all') {
      list = list.filter((h) => h.faction === factionFilter);
    }

    // 排序
    list.sort((a, b) => {
      switch (sortKey) {
        case 'level':
          return b.level - a.level;
        case 'quality':
          return QUALITY_ORDER[b.quality] - QUALITY_ORDER[a.quality];
        case 'power':
          return calcPower(b) - calcPower(a);
        default:
          return 0;
      }
    });

    return list;
  }, [snapshot, qualityFilter, factionFilter, sortKey]);

  const handleHeroClick = useCallback(
    (id: string) => onHeroClick?.(id),
    [onHeroClick],
  );

  if (!snapshot) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div
      style={styles.container}
      className={`tk-hero-list ${className ?? ''}`.trim()}
      role="region"
      aria-label="武将列表"
    >
      {/* 标题 */}
      <div style={styles.title}>
        武将 ({snapshot.heroes?.length ?? 0})
      </div>

      {/* 筛选栏 */}
      <div style={styles.filterBar}>
        {/* 品质筛选 */}
        <div style={styles.filterGroup}>
          {QUALITY_FILTERS.map((f) => (
            <button
              key={f.value}
              style={{
                ...styles.filterBtn,
                ...(qualityFilter === f.value ? styles.filterBtnActive : {}),
              }}
              onClick={() => setQualityFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 阵营 + 排序 */}
        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            {FACTION_FILTERS.map((f) => (
              <button
                key={f.value}
                style={{
                  ...styles.filterBtn,
                  ...(factionFilter === f.value ? styles.filterBtnActive : {}),
                }}
                onClick={() => setFactionFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <select
            style={styles.select}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="排序方式"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}排序</option>
            ))}
          </select>
        </div>
      </div>

      {/* 武将列表 */}
      {heroes.length === 0 ? (
        <div style={styles.empty}>暂无武将</div>
      ) : (
        <div style={styles.grid}>
          {heroes.map((hero) => (
            <HeroCard
              key={hero.id}
              hero={hero}
              power={calcPower(hero)}
              onClick={handleHeroClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    color: '#e8e0d0',
  },
  loading: {
    padding: '24px',
    textAlign: 'center',
    color: '#a0a0a0',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '8px',
  },
  filterBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '12px',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  filterGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    flex: 1,
  },
  filterBtn: {
    padding: '3px 8px',
    fontSize: '11px',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '4px',
    background: 'transparent',
    color: '#a0a0a0',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  filterBtnActive: {
    borderColor: '#d4a574',
    color: '#d4a574',
    backgroundColor: 'rgba(212, 165, 116, 0.1)',
  },
  select: {
    padding: '3px 8px',
    fontSize: '11px',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '4px',
    background: 'rgba(13, 17, 23, 0.95)',
    color: '#e8e0d0',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '8px',
  },
  empty: {
    padding: '32px',
    textAlign: 'center',
    color: '#a0a0a0',
    fontSize: '13px',
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(212, 165, 116, 0.15)',
    borderLeft: '3px solid',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  },
  badge: {
    alignSelf: 'flex-start',
    padding: '1px 6px',
    fontSize: '10px',
    fontWeight: 700,
    borderRadius: '3px',
  },
  name: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e8e0d0',
  },
  meta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#a0a0a0',
  },
  power: {
    fontSize: '12px',
    color: '#d4a574',
    fontWeight: 600,
  },
};
