/**
 * 三国霸业 — 军队面板组件
 *
 * 编队管理 + 兵种配置 + 战力显示。
 * 展示当前编队列表、各编队武将配置和总战力。
 *
 * @module ui/components/ArmyPanel
 */

import { useCallback, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import type { FormationData } from '../../engine/hero/HeroFormation';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const FACTION_ICONS: Record<string, string> = {
  wei: '🔵',
  shu: '🔴',
  wu: '🟢',
  qun: '🟡',
  neutral: '⚪',
};

const FACTION_LABELS: Record<string, string> = {
  wei: '魏',
  shu: '蜀',
  wu: '吴',
  qun: '群',
  neutral: '中立',
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface ArmyPanelProps {
  /** 点击编队回调 */
  onFormationSelect?: (formationId: string) => void;
  /** 点击武将回调 */
  onHeroClick?: (heroId: string) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function formatPower(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.floor(n).toString();
}

// ─────────────────────────────────────────────
// 子组件：编队卡片
// ─────────────────────────────────────────────

interface FormationCardProps {
  formation: FormationData;
  isActive: boolean;
  heroes: { id: string; name: string; faction: string; power: number }[];
  onSelect: () => void;
  onHeroClick: (heroId: string) => void;
}

function FormationCard({ formation, isActive, heroes, onSelect, onHeroClick }: FormationCardProps) {
  const totalPower = heroes.reduce((s, h) => s + h.power, 0);

  return (
    <div
      style={{
        ...cardStyles.container,
        borderColor: isActive ? '#d4a574' : 'rgba(212, 165, 116, 0.2)',
      }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`编队 ${formation.id}`}
    >
      {/* 编队头部 */}
      <div style={cardStyles.header}>
        <span style={cardStyles.name}>
          {isActive ? '⭐ ' : ''}编队 {formation.id.slice(0, 4)}
        </span>
        <span style={cardStyles.power}>
          ⚔️ {formatPower(totalPower)}
        </span>
      </div>

      {/* 武将列表 */}
      <div style={cardStyles.heroGrid}>
        {formation.generalIds.map((heroId, idx) => {
          const hero = heroes.find((h) => h.id === heroId);
          if (!hero) {
            return (
              <div key={idx} style={cardStyles.emptySlot}>
                <span style={cardStyles.emptyIcon}>➕</span>
                <span style={cardStyles.emptyLabel}>空位</span>
              </div>
            );
          }
          return (
            <div
              key={heroId}
              style={cardStyles.heroSlot}
              onClick={(e) => { e.stopPropagation(); onHeroClick(heroId); }}
              role="button"
              tabIndex={0}
            >
              <span style={cardStyles.heroIcon}>{FACTION_ICONS[hero.faction] ?? '⚪'}</span>
              <span style={cardStyles.heroName}>{hero.name}</span>
              <span style={cardStyles.heroFaction}>{FACTION_LABELS[hero.faction] ?? hero.faction}</span>
            </div>
          );
        })}
      </div>

      {/* 激活标记 */}
      {isActive && <div style={cardStyles.activeBadge}>当前编队</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * ArmyPanel — 军队面板
 *
 * @example
 * ```tsx
 * <ArmyPanel onFormationSelect={(id) => console.log(id)} />
 * ```
 */
export function ArmyPanel({ onFormationSelect, onHeroClick, className }: ArmyPanelProps) {
  const { engine, snapshot } = useGameContext();

  const formations = useMemo(() => engine.getFormations(), [engine, snapshot]);
  const activeFormationId = useMemo(() => {
    const af = engine.getActiveFormation();
    return af?.id ?? null;
  }, [engine, snapshot]);

  // 构建武将映射
  const heroMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; faction: string; power: number }>();
    if (!snapshot) return map;
    for (const g of snapshot.heroes) {
      map.set(g.id, {
        id: g.id,
        name: g.name,
        faction: g.faction,
        power: g.power,
      });
    }
    return map;
  }, [snapshot]);

  const handleFormationSelect = useCallback(
    (id: string) => { onFormationSelect?.(id); },
    [onFormationSelect],
  );

  const handleHeroClick = useCallback(
    (id: string) => { onHeroClick?.(id); },
    [onHeroClick],
  );

  if (!snapshot) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div
      style={styles.container}
      className={`tk-army-panel ${className ?? ''}`.trim()}
      role="region"
      aria-label="军队面板"
    >
      {/* 总战力 */}
      <div style={styles.totalPower}>
        <span style={styles.totalPowerLabel}>全军战力</span>
        <span style={styles.totalPowerValue}>⚔️ {formatPower(snapshot.totalPower)}</span>
      </div>

      <div style={styles.title}>编队管理</div>

      {/* 编队列表 */}
      <div style={styles.formationList}>
        {formations.map((f) => (
          <FormationCard
            key={f.id}
            formation={f}
            isActive={f.id === activeFormationId}
            heroes={f.generalIds.map((id) => heroMap.get(id)!).filter(Boolean)}
            onSelect={() => handleFormationSelect(f.id)}
            onHeroClick={handleHeroClick}
          />
        ))}
      </div>

      {/* 兵力信息 */}
      <div style={styles.troopInfo}>
        <span>兵力：{formatPower(snapshot.resources.troops)}</span>
        <span style={styles.troopCap}>
          上限 {formatPower(snapshot.caps.troops)}
        </span>
      </div>
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
  totalPower: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: 'linear-gradient(135deg, rgba(212, 165, 116, 0.15), rgba(184, 66, 58, 0.1))',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  totalPowerLabel: { fontSize: '13px', color: '#a0a0a0' },
  totalPowerValue: { fontSize: '18px', fontWeight: 700, color: '#d4a574' },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '8px',
  },
  formationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  troopInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#a0a0a0',
  },
  troopCap: { color: '#666' },
};

const cardStyles: Record<string, React.CSSProperties> = {
  container: {
    padding: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  name: { fontSize: '13px', fontWeight: 600, color: '#e8e0d0' },
  power: { fontSize: '13px', fontWeight: 700, color: '#d4a574' },
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '4px',
  },
  heroSlot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '6px 4px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  heroIcon: { fontSize: '16px' },
  heroName: { fontSize: '11px', color: '#e8e0d0', textAlign: 'center' },
  heroFaction: { fontSize: '10px', color: '#a0a0a0' },
  emptySlot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '6px 4px',
    border: '1px dashed rgba(255,255,255,0.1)',
    borderRadius: '4px',
  },
  emptyIcon: { fontSize: '14px', color: '#666' },
  emptyLabel: { fontSize: '10px', color: '#666' },
  activeBadge: {
    marginTop: '6px',
    fontSize: '10px',
    color: '#d4a574',
    textAlign: 'center',
    padding: '2px 8px',
    background: 'rgba(212, 165, 116, 0.15)',
    borderRadius: '10px',
  },
};
