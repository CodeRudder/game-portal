/**
 * 装备系统面板 — 装备列表、详情、强化/锻造入口
 *
 * 读取引擎 EquipmentSystem 数据，展示装备背包与操作。
 * 参考: ui/components/EquipmentBag.tsx（孤立组件）
 *
 * @module panels/equipment/EquipmentPanel
 */
import React, { useState, useMemo, useCallback } from 'react';
import type {
  EquipmentInstance,
  EquipmentRarity,
  EquipmentSlot,
  BagSortMode,
} from '@/games/three-kingdoms/core/equipment';
import {
  SLOT_LABELS, SLOT_ICONS, RARITY_LABELS,
  EQUIPMENT_SLOTS, EQUIPMENT_RARITIES,
} from '@/games/three-kingdoms/core/equipment';
import { EQUIP_QUALITY_COLORS } from '../../common/constants';
import { formatNumber } from '@/components/idle/utils/formatNumber';
/** 品质颜色（使用统一常量覆盖引擎默认值） */
const RARITY_COLORS = EQUIP_QUALITY_COLORS;

// ─── Props ──────────────────────────────────
interface EquipmentPanelProps {
  engine: any;
}

// ─── 品质排序权重 ───────────────────────────
const RARITY_ORDER: Record<EquipmentRarity, number> = {
  white: 1, green: 2, blue: 3, purple: 4, gold: 5,
};

const SORT_OPTIONS: { value: BagSortMode; label: string }[] = [
  { value: 'rarity_desc', label: '品质↓' },
  { value: 'level_desc', label: '等级↓' },
  { value: 'slot_type', label: '部位' },
];

// ─── 工具函数 ───────────────────────────────
function formatStat(n: number): string {
  return formatNumber(n);
}

// ─── 主组件 ─────────────────────────────────
export default function EquipmentPanel({ engine }: EquipmentPanelProps) {
  const [slotFilter, setSlotFilter] = useState<EquipmentSlot | null>(null);
  const [sortMode, setSortMode] = useState<BagSortMode>('rarity_desc');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); }, []);

  // 获取装备系统
  const eqSystem = engine?.getEquipmentSystem?.() ?? engine?.equipment;
  const allItems: EquipmentInstance[] = useMemo(
    () => eqSystem?.getAllEquipments?.() ?? [],
    [eqSystem],
  );
  const bagCapacity = eqSystem?.getBagCapacity?.() ?? 100;
  const bagUsed = allItems.length;

  // 筛选 + 排序
  const displayItems = useMemo(() => {
    let items = allItems;
    if (slotFilter) items = items.filter(e => e.slot === slotFilter);
    const sorted = [...items];
    switch (sortMode) {
      case 'rarity_desc':
        sorted.sort((a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0));
        break;
      case 'level_desc':
        sorted.sort((a, b) => b.enhanceLevel - a.enhanceLevel);
        break;
      case 'slot_type':
        sorted.sort((a, b) => EQUIPMENT_SLOTS.indexOf(a.slot) - EQUIPMENT_SLOTS.indexOf(b.slot));
        break;
      default:
        sorted.sort((a, b) => b.acquiredAt - a.acquiredAt);
    }
    return sorted;
  }, [allItems, slotFilter, sortMode]);

  // 选中装备
  const selectedEquip = useMemo(
    () => (selectedUid ? allItems.find(e => e.uid === selectedUid) : null),
    [selectedUid, allItems],
  );

  // 操作
  const handleDecompose = useCallback((uid: string) => {
    try {
      const result = eqSystem?.decompose?.(uid);
      if (result && !result.success) {
        flash(result.reason ?? '分解失败');
      }
    } catch (e: any) {
      flash(e?.message ?? '分解操作失败');
    }
    setSelectedUid(null);
  }, [eqSystem, flash]);

  return (
    <div style={styles.container}>
      {/* 顶部信息栏 */}
      <div style={styles.header}>
        <span style={styles.title}>🎒 装备背包</span>
        <span style={styles.capacity}>{bagUsed}/{bagCapacity}</span>
      </div>

      {/* 消息提示 */}
      {toast && <div style={styles.toast}>{toast}</div>}

      {/* 筛选栏 */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <button
            style={{ ...styles.filterBtn, ...(slotFilter === null ? styles.activeBtn : {}) }}
            onClick={() => setSlotFilter(null)}
          >全部</button>
          {EQUIPMENT_SLOTS.map(slot => (
            <button
              key={slot}
              style={{ ...styles.filterBtn, ...(slotFilter === slot ? styles.activeBtn : {}) }}
              onClick={() => setSlotFilter(slot)}
            >{SLOT_ICONS[slot]}</button>
          ))}
        </div>
        <div style={styles.filterGroup}>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              style={{ ...styles.sortBtn, ...(sortMode === opt.value ? styles.activeSortBtn : {}) }}
              onClick={() => setSortMode(opt.value)}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* 装备列表 */}
      <div style={styles.grid}>
        {displayItems.map(eq => (
          <div
            key={eq.uid}
            style={{
              ...styles.card,
              borderColor: selectedUid === eq.uid ? '#d4a574' : RARITY_COLORS[eq.rarity] + '40',
            }}
            onClick={() => setSelectedUid(eq.uid)}
          >
            <div style={{ ...styles.rarityBar, backgroundColor: RARITY_COLORS[eq.rarity] }} />
            <div style={styles.cardHeader}>
              <span>{SLOT_ICONS[eq.slot]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: RARITY_COLORS[eq.rarity], fontSize: 13, fontWeight: 600 }}>
                  {eq.name}
                </div>
                <div style={{ fontSize: 10, color: '#a0a0a0' }}>
                  {SLOT_LABELS[eq.slot]} · +{eq.enhanceLevel}
                  {eq.isEquipped ? ' · 已装备' : ''}
                </div>
              </div>
            </div>
            <div style={styles.statRow}>
              <span style={{ color: '#a0a0a0' }}>{eq.mainStat.type}</span>
              <span style={{ color: RARITY_COLORS[eq.rarity], fontWeight: 600 }}>
                {formatStat(eq.mainStat.value)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {displayItems.length === 0 && (
        <div style={styles.empty}>暂无装备</div>
      )}

      {/* 装备详情弹窗 */}
      {selectedEquip && (
        <div style={styles.detailOverlay} onClick={() => setSelectedUid(null)}>
          <div style={styles.detailPanel} onClick={e => e.stopPropagation()}>
            <div style={{ ...styles.detailTitle, color: RARITY_COLORS[selectedEquip.rarity] }}>
              {selectedEquip.name}
            </div>
            <div style={styles.detailMeta}>
              {RARITY_LABELS[selectedEquip.rarity]} · {SLOT_LABELS[selectedEquip.slot]} · +{selectedEquip.enhanceLevel}
            </div>
            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>主属性</div>
              <div>{selectedEquip.mainStat.type}: {formatStat(selectedEquip.mainStat.value)}</div>
            </div>
            {selectedEquip.subStats.length > 0 && (
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>副属性</div>
                {selectedEquip.subStats.map((ss, i) => (
                  <div key={i}>{ss.type}: {formatStat(ss.value)}</div>
                ))}
              </div>
            )}
            {selectedEquip.specialEffect && (
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>特效</div>
                <div>{selectedEquip.specialEffect.description}</div>
              </div>
            )}
            <div style={styles.detailActions}>
              {/* 强化按钮 — 调用 EquipmentEnhanceSystem */}
              <button
                style={styles.enhanceBtn}
                onClick={() => {
                  try {
                    const enhanceSys = engine?.getEquipmentEnhanceSystem?.() ?? engine?.equipmentEnhance;
                    if (!enhanceSys) return;
                    const enhanceCost = enhanceSys.getEnhanceCost?.(selectedEquip);
                    const currentGold = engine?.getResources?.()?.gold ?? engine?.getCurrencySystem?.()?.getBalance?.('copper') ?? 0;
                    if (enhanceCost && currentGold < enhanceCost) {
                      flash('💰 铜钱不足，无法强化');
                      return;
                    }
                    const result = enhanceSys.enhance?.(selectedEquip.uid, false);
                    if (result) {
                      const label = result.outcome === 'success'
                        ? `强化成功 → +${result.currentLevel}`
                        : result.outcome === 'downgrade'
                          ? `强化降级 → +${result.currentLevel}`
                          : `强化失败（+${result.currentLevel}）`;
                      flash(label);
                    }
                  } catch (e: any) {
                    flash(e?.message ?? '强化操作失败');
                  }
                  setSelectedUid(null);
                }}
              >⬆️ 强化</button>
              {/* 锻造按钮 — 调用 EquipmentForgeSystem 基础锻造 */}
              {!selectedEquip.isEquipped && (
                <button
                  style={styles.forgeBtn}
                  onClick={() => {
                  try {
                    const forgeSys = engine?.getEquipmentForgeSystem?.() ?? engine?.equipmentForge;
                    if (!forgeSys) return;
                    const forgeCost = forgeSys.getForgeCost?.('basic');
                    const currentGold = engine?.getResources?.()?.gold ?? engine?.getCurrencySystem?.()?.getBalance?.('copper') ?? 0;
                    if (forgeCost && currentGold < forgeCost) {
                      flash('💰 铜钱不足，无法锻造');
                      return;
                    }
                    const result = forgeSys.basicForge?.();
                    flash(result?.success ? `锻造成功: ${result.equipment?.name ?? '新装备'}` : '锻造失败');
                  } catch (e: any) {
                    flash(e?.message ?? '锻造操作失败');
                  }
                  setSelectedUid(null);
                }}
                >🔥 锻造</button>
              )}
              {!selectedEquip.isEquipped && (
                <button style={styles.decomposeBtn} onClick={() => handleDecompose(selectedEquip.uid)}>
                  分解
                </button>
              )}
              <button style={styles.closeBtn} onClick={() => setSelectedUid(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 样式 ───────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: 600, color: '#d4a574' },
  capacity: { fontSize: 12, color: '#a0a0a0' },
  toast: {
    padding: '6px 12px', marginBottom: 8, borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center',
  },
  filterBar: { marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 },
  filterGroup: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  filterBtn: {
    padding: '4px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 11, cursor: 'pointer',
  },
  activeBtn: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574' },
  sortBtn: {
    padding: '3px 6px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'transparent', color: '#666', fontSize: 10, cursor: 'pointer',
  },
  activeSortBtn: { background: 'rgba(212,165,116,0.1)', color: '#d4a574', borderColor: 'rgba(212,165,116,0.3)' },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8,
  },
  card: {
    display: 'flex', flexDirection: 'column', gap: 4, padding: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,165,116,0.2)',
    borderRadius: 'var(--tk-radius-lg)' as any, cursor: 'pointer', position: 'relative', overflow: 'hidden',
  },
  rarityBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 },
  statRow: { display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' },
  empty: { textAlign: 'center', padding: 24, color: '#666', fontSize: 13 },
  detailOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--tk-z-modal)' as any,
  },
  detailPanel: {
    background: '#1a1a2e', border: '1px solid #d4a574', borderRadius: 'var(--tk-radius-xl)' as any, padding: 20,
    minWidth: 300, maxWidth: 400, color: '#e8e0d0',
  },
  detailTitle: { fontSize: 18, fontWeight: 600, marginBottom: 4 },
  detailMeta: { fontSize: 12, color: '#a0a0a0', marginBottom: 12 },
  detailSection: { marginBottom: 10, fontSize: 13 },
  detailLabel: { color: '#d4a574', fontSize: 12, marginBottom: 2 },
  detailActions: { display: 'flex', gap: 8, marginTop: 16 },
  decomposeBtn: {
    flex: 1, padding: '8px', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(255,100,100,0.15)', color: '#ff6464', fontSize: 13, cursor: 'pointer',
  },
  enhanceBtn: {
    flex: 1, padding: '8px', border: '1px solid rgba(100,180,255,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(100,180,255,0.15)', color: '#64b4ff', fontSize: 13, cursor: 'pointer',
  },
  forgeBtn: {
    flex: 1, padding: '8px', border: '1px solid rgba(255,180,60,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(255,180,60,0.15)', color: '#ffb43c', fontSize: 13, cursor: 'pointer',
  },
  closeBtn: {
    flex: 1, padding: '8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 13, cursor: 'pointer',
  },
};
