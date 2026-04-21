/**
 * 三国霸业 — 装备背包面板组件
 *
 * 装备列表 + 筛选 + 排序 + 穿戴。
 * 支持按部位/品质筛选，多种排序方式，装备穿戴操作。
 *
 * @module ui/components/EquipmentBag
 */

import { useState, useCallback, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import { useToast } from './ToastProvider';
import type {
  EquipmentInstance,
  EquipmentSlot,
  EquipmentRarity,
  BagSortMode,
} from '../../core/equipment';
import {
  SLOT_LABELS,
  SLOT_ICONS,
  RARITY_LABELS,
  RARITY_COLORS,
  EQUIPMENT_SLOTS,
  EQUIPMENT_RARITIES,
} from '../../core/equipment';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface EquipmentBagProps {
  /** 装备列表（可选，不传则使用空列表） */
  equipments?: EquipmentInstance[];
  /** 点击装备回调 */
  onEquipClick?: (uid: string) => void;
  /** 穿戴装备回调 */
  onEquip?: (uid: string) => void;
  /** 卸下装备回调 */
  onUnequip?: (uid: string) => void;
  /** 分解装备回调 */
  onDecompose?: (uid: string) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function formatStat(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : Math.floor(n).toString();
}

/** 排序装备 */
function sortEquipments(items: EquipmentInstance[], mode: BagSortMode): EquipmentInstance[] {
  const sorted = [...items];
  switch (mode) {
    case 'rarity_desc':
      sorted.sort((a, b) => (RARITY_ORDER_MAP[b.rarity] ?? 0) - (RARITY_ORDER_MAP[a.rarity] ?? 0));
      break;
    case 'rarity_asc':
      sorted.sort((a, b) => (RARITY_ORDER_MAP[a.rarity] ?? 0) - (RARITY_ORDER_MAP[b.rarity] ?? 0));
      break;
    case 'level_desc':
      sorted.sort((a, b) => b.enhanceLevel - a.enhanceLevel);
      break;
    case 'level_asc':
      sorted.sort((a, b) => a.enhanceLevel - b.enhanceLevel);
      break;
    case 'slot_type':
      sorted.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
      break;
    case 'acquired_time':
    default:
      sorted.sort((a, b) => b.acquiredAt - a.acquiredAt);
      break;
  }
  return sorted;
}

const RARITY_ORDER_MAP: Record<EquipmentRarity, number> = {
  white: 1, green: 2, blue: 3, purple: 4, gold: 5,
};

const SLOT_ORDER: string[] = ['weapon', 'armor', 'accessory', 'mount'];

const SORT_LABELS: Record<BagSortMode, string> = {
  rarity_desc: '品质↓',
  rarity_asc: '品质↑',
  level_desc: '等级↓',
  level_asc: '等级↑',
  slot_type: '部位',
  acquired_time: '时间',
};

// ─────────────────────────────────────────────
// 子组件：装备卡片
// ─────────────────────────────────────────────

interface EquipCardProps {
  equip: EquipmentInstance;
  onEquip: (uid: string) => void;
  onUnequip: (uid: string) => void;
  onClick: (uid: string) => void;
}

function EquipCard({ equip, onEquip, onUnequip, onClick }: EquipCardProps) {
  const rarityColor = RARITY_COLORS[equip.rarity];

  return (
    <div
      style={{ ...cardStyles.container, borderColor: rarityColor + '60' }}
      onClick={() => onClick(equip.uid)}
      role="button"
      tabIndex={0}
      aria-label={`${equip.name} ${RARITY_LABELS[equip.rarity]}`}
    >
      {/* 品质指示条 */}
      <div style={{ ...cardStyles.rarityBar, backgroundColor: rarityColor }} />

      {/* 头部 */}
      <div style={cardStyles.header}>
        <span style={cardStyles.icon}>{SLOT_ICONS[equip.slot]}</span>
        <div style={cardStyles.titleArea}>
          <div style={{ ...cardStyles.name, color: rarityColor }}>{equip.name}</div>
          <div style={cardStyles.meta}>
            {SLOT_LABELS[equip.slot]} · +{equip.enhanceLevel}
          </div>
        </div>
      </div>

      {/* 主属性 */}
      <div style={cardStyles.statRow}>
        <span style={cardStyles.statLabel}>{equip.mainStat.type}</span>
        <span style={{ ...cardStyles.statValue, color: rarityColor }}>
          {formatStat(equip.mainStat.value)}
        </span>
      </div>

      {/* 操作按钮 */}
      <div style={cardStyles.actions}>
        {equip.isEquipped ? (
          <button
            style={cardStyles.unequipBtn}
            onClick={(e) => { e.stopPropagation(); onUnequip(equip.uid); }}
          >
            卸下
          </button>
        ) : (
          <button
            style={cardStyles.equipBtn}
            onClick={(e) => { e.stopPropagation(); onEquip(equip.uid); }}
          >
            穿戴
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * EquipmentBag — 装备背包面板
 *
 * @example
 * ```tsx
 * <EquipmentBag
 *   equipments={items}
 *   onEquip={(uid) => engine.equip(uid)}
 * />
 * ```
 */
export function EquipmentBag({
  equipments = [],
  onEquipClick,
  onEquip,
  onUnequip,
  onDecompose,
  className,
}: EquipmentBagProps) {
  // 筛选状态
  const [slotFilter, setSlotFilter] = useState<EquipmentSlot | null>(null);
  const [rarityFilter, setRarityFilter] = useState<EquipmentRarity | null>(null);
  const [sortMode, setSortMode] = useState<BagSortMode>('rarity_desc');
  const { addToast } = useToast();

  // 筛选 + 排序
  const filteredItems = useMemo(() => {
    let items = equipments;
    if (slotFilter) items = items.filter((e) => e.slot === slotFilter);
    if (rarityFilter) items = items.filter((e) => e.rarity === rarityFilter);
    return sortEquipments(items, sortMode);
  }, [equipments, slotFilter, rarityFilter, sortMode]);

  const handleEquipClick = useCallback(
    (uid: string) => { onEquipClick?.(uid); },
    [onEquipClick],
  );

  const handleEquip = useCallback(
    (uid: string) => {
      try {
        onEquip?.(uid);
        // R16: 穿戴成功 Toast
        const equip = equipments.find((e) => e.uid === uid);
        if (equip) addToast(`${equip.name} 已穿戴`, 'success');
      } catch (error) {
        console.error('装备穿戴失败:', error);
        addToast('装备穿戴失败', 'error');
      }
    },
    [onEquip, equipments, addToast],
  );

  const handleUnequip = useCallback(
    (uid: string) => {
      try {
        onUnequip?.(uid);
        // R16: 卸下成功 Toast
        const equip = equipments.find((e) => e.uid === uid);
        if (equip) addToast(`${equip.name} 已卸下`, 'info');
      } catch (error) {
        console.error('装备卸下失败:', error);
        addToast('装备卸下失败', 'error');
      }
    },
    [onUnequip, equipments, addToast],
  );

  return (
    <div
      style={styles.container}
      className={`tk-equipment-bag ${className ?? ''}`.trim()}
      role="region"
      aria-label="装备背包"
    >
      <div style={styles.title}>🎒 装备背包 ({equipments.length})</div>

      {/* 筛选栏 */}
      <div style={styles.filterBar}>
        {/* 部位筛选 */}
        <div style={styles.filterGroup}>
          <button
            style={{ ...styles.filterBtn, ...(slotFilter === null ? styles.filterBtnActive : {}) }}
            onClick={() => setSlotFilter(null)}
          >
            全部
          </button>
          {EQUIPMENT_SLOTS.map((slot) => (
            <button
              key={slot}
              style={{ ...styles.filterBtn, ...(slotFilter === slot ? styles.filterBtnActive : {}) }}
              onClick={() => setSlotFilter(slot)}
            >
              {SLOT_ICONS[slot]}
            </button>
          ))}
        </div>

        {/* 品质筛选 */}
        <div style={styles.filterGroup}>
          {EQUIPMENT_RARITIES.map((r) => (
            <button
              key={r}
              style={{
                ...styles.filterBtn,
                ...(rarityFilter === r ? { ...styles.filterBtnActive, borderColor: RARITY_COLORS[r] } : {}),
              }}
              onClick={() => setRarityFilter(rarityFilter === r ? null : r)}
            >
              <span style={{ color: RARITY_COLORS[r] }}>{RARITY_LABELS[r]}</span>
            </button>
          ))}
        </div>

        {/* 排序 */}
        <div style={styles.sortRow}>
          {(Object.keys(SORT_LABELS) as BagSortMode[]).map((mode) => (
            <button
              key={mode}
              style={{ ...styles.sortBtn, ...(sortMode === mode ? styles.sortBtnActive : {}) }}
              onClick={() => setSortMode(mode)}
            >
              {SORT_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* 装备列表 */}
      {filteredItems.length > 0 ? (
        <div style={styles.grid}>
          {filteredItems.map((equip) => (
            <EquipCard
              key={equip.uid}
              equip={equip}
              onEquip={handleEquip}
              onUnequip={handleUnequip}
              onClick={handleEquipClick}
            />
          ))}
        </div>
      ) : (
        <div style={styles.empty}>暂无装备</div>
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
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '12px',
  },
  filterBar: {
    marginBottom: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filterGroup: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '4px 8px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    background: 'transparent',
    color: '#a0a0a0',
    fontSize: '11px',
    cursor: 'pointer',
  },
  filterBtnActive: {
    background: 'rgba(212, 165, 116, 0.2)',
    color: '#d4a574',
    borderColor: '#d4a574',
  },
  sortRow: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  sortBtn: {
    padding: '3px 6px',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '3px',
    background: 'transparent',
    color: '#666',
    fontSize: '10px',
    cursor: 'pointer',
  },
  sortBtnActive: {
    background: 'rgba(212, 165, 116, 0.1)',
    color: '#d4a574',
    borderColor: 'rgba(212, 165, 116, 0.3)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '8px',
  },
  empty: {
    textAlign: 'center',
    padding: '24px',
    color: '#666',
    fontSize: '13px',
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
  },
  rarityBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '3px',
  },
  icon: { fontSize: '18px' },
  titleArea: { flex: 1, minWidth: 0 },
  name: { fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: '10px', color: '#a0a0a0' },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    padding: '2px 0',
  },
  statLabel: { color: '#a0a0a0' },
  statValue: { fontWeight: 600 },
  actions: {
    display: 'flex',
    gap: '4px',
    marginTop: '2px',
  },
  equipBtn: {
    flex: 1,
    padding: '4px',
    border: '1px solid rgba(212, 165, 116, 0.3)',
    borderRadius: '4px',
    background: 'rgba(212, 165, 116, 0.15)',
    color: '#d4a574',
    fontSize: '11px',
    cursor: 'pointer',
  },
  unequipBtn: {
    flex: 1,
    padding: '4px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '4px',
    background: 'transparent',
    color: '#a0a0a0',
    fontSize: '11px',
    cursor: 'pointer',
  },
};
