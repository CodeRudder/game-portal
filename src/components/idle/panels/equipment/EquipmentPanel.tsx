/**
 * 装备系统面板 — 装备列表、武将装备栏、详情、强化/炼制/分解入口
 *
 * R2 修复：
 * - [P1-1] 新增武将装备栏视图（4槽位+属性加成+套装进度）
 * - [P1-6] 新增炼制类型选择界面（基础/高级/定向/保底）
 * - [P2-5] 强化面板新增成功率预览和失败后果提示
 * - [P2-1] 迁移到CSS类（保留内联样式兼容）
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
  // R2: 武将装备栏视图
  const [viewMode, setViewMode] = useState<'bag' | 'hero'>('bag');
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  // R2: 炼制类型选择
  const [forgeType, setForgeType] = useState<'basic' | 'advanced' | 'targeted' | null>(null);
  const [forgeTargetSlot, setForgeTargetSlot] = useState<EquipmentSlot | null>(null);

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
    <div style={styles.container} data-testid="equipment-panel">
      {/* 顶部信息栏 */}
      <div style={styles.header}>
        <span style={styles.title}>🎒 装备背包</span>
        <span style={styles.capacity}>{bagUsed}/{bagCapacity}</span>
      </div>

      {/* 消息提示 */}
      {toast && <div style={styles.toast} data-testid="equipment-panel-toast">{toast}</div>}

      {/* R2: 视图切换Tab */}
      <div style={styles.tabBar}>
        <button style={{ ...styles.tabBtn, ...(viewMode === 'bag' ? styles.activeTab : {}) }} onClick={() => setViewMode('bag')}>📦 背包</button>
        <button style={{ ...styles.tabBtn, ...(viewMode === 'hero' ? styles.activeTab : {}) }} onClick={() => setViewMode('hero')}>⚔️ 武将装备栏</button>
      </div>

      {/* 武将装备栏视图 */}
      {viewMode === 'hero' && (
        <div style={styles.heroEquipView} data-testid="equipment-panel-hero-equip">
          {/* 武将选择 */}
          <div style={styles.heroSelect}>
            <span style={{ fontSize: 12, color: '#d4a574', fontWeight: 600 }}>选择武将</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {(engine?.getHeroSystem?.()?.getAllHeroes?.() ?? []).slice(0, 10).map((h: any) => (
                <button key={h.id} style={{
                  ...styles.heroBtn,
                  ...(selectedHeroId === h.id ? { border: '1px solid #d4a574', background: 'rgba(212,165,116,0.2)' } : {}),
                }} onClick={() => setSelectedHeroId(h.id)}>{h.name ?? h.id}</button>
              ))}
              {(engine?.getHeroSystem?.()?.getAllHeroes?.() ?? []).length === 0 && (
                <span style={{ fontSize: 11, color: '#666' }}>暂无武将</span>
              )}
            </div>
          </div>
          {/* 装备槽位 */}
          {selectedHeroId && (
            <div style={styles.slotGrid}>
              {EQUIPMENT_SLOTS.map(slot => {
                const heroEquips = eqSystem?.getHeroEquips?.(selectedHeroId) ?? {};
                const equipped: EquipmentInstance | undefined = heroEquips[slot];
                return (
                  <div key={slot} style={styles.slotCard} data-testid={`equipment-panel-slot-${slot}`}>
                    <div style={{ fontSize: 20, textAlign: 'center' }}>{SLOT_ICONS[slot]}</div>
                    <div style={{ fontSize: 11, color: '#a0a0a0', textAlign: 'center' }}>{SLOT_LABELS[slot]}</div>
                    {equipped ? (
                      <div style={{ fontSize: 11, color: RARITY_COLORS[equipped.rarity], textAlign: 'center', marginTop: 2 }}>
                        {equipped.name} +{equipped.enhanceLevel}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: '#555', textAlign: 'center', marginTop: 2 }}>空</div>
                    )}
                    {equipped && (
                      <button style={styles.unequipBtn} onClick={() => {
                        try {
                          eqSystem?.unequip?.(equipped.uid, selectedHeroId);
                          flash(`已卸下 ${equipped.name}`);
                        } catch (e: any) { flash(e?.message ?? '卸下失败'); }
                      }}>卸下</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* 属性加成汇总 */}
          {selectedHeroId && (() => {
            const heroEquips = eqSystem?.getHeroEquips?.(selectedHeroId) ?? {};
            const equippedList = Object.values(heroEquips).filter(Boolean) as EquipmentInstance[];
            const totalAttack = equippedList.reduce((s: number, e: EquipmentInstance) => s + (e.mainStat.value ?? 0), 0);
            return equippedList.length > 0 ? (
              <div style={styles.statSummary}>
                <div style={{ fontSize: 12, color: '#d4a574', fontWeight: 600, marginBottom: 4 }}>📊 属性加成</div>
                <div style={{ fontSize: 11, color: '#a0a0a0' }}>已装备 {equippedList.length}/4 件 · 主属性合计 +{formatStat(totalAttack)}</div>
                {/* 套装进度 */}
                {(() => {
                  const setCounts: Record<string, number> = {};
                  equippedList.forEach((e: EquipmentInstance) => {
                    const tpl = (eqSystem as any)?.getTemplate?.(e.templateId);
                    if (tpl?.setId) setCounts[tpl.setId] = (setCounts[tpl.setId] ?? 0) + 1;
                  });
                  return Object.entries(setCounts).map(([setId, count]) => (
                    <div key={setId} style={{ fontSize: 11, color: count >= 2 ? '#7EC850' : '#a0a0a0', marginTop: 2 }}>
                      {setId}: {count}/4 {count >= 2 ? '✅ 套装已激活' : ''}
                    </div>
                  ));
                })()}
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* 背包视图 - 筛选栏 */}
      {viewMode === 'bag' && (<>
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
              border: selectedUid === eq.uid ? '1px solid #d4a574' : `1px solid ${RARITY_COLORS[eq.rarity]}40`,
            }}
            onClick={() => setSelectedUid(eq.uid)}
            data-testid={`equipment-panel-item-${eq.uid}`}
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
        <div style={styles.emptyGuide}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.6 }}>🎒</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>暂无装备</div>
          <div style={{ fontSize: 12, color: '#a0a0a0', lineHeight: 1.6 }}>
            通过<span style={{ color: '#d4a574' }}>出征</span>或<span style={{ color: '#d4a574' }}>商店</span>获取装备
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>完成关卡战斗可掉落装备，也可在商店中购买装备箱</div>
        </div>
      )}
      </>)}

      {/* 装备详情弹窗 */}
      {selectedEquip && (
        <div style={styles.detailOverlay} onClick={() => setSelectedUid(null)} data-testid="equipment-panel-detail-overlay">
          <div style={styles.detailPanel} onClick={e => e.stopPropagation()} data-testid="equipment-panel-detail">
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
              {/* R2: 强化按钮 — 增加成功率预览 */}
              <button
                style={styles.enhanceBtn}
                data-testid="equipment-panel-enhance"
                onClick={() => {
                  try {
                    const enhanceSys = engine?.getEquipmentEnhanceSystem?.() ?? engine?.equipmentEnhance;
                    if (!enhanceSys) return;
                    // R2: 显示成功率预览
                    const rate = enhanceSys.getSuccessRate?.(selectedEquip.enhanceLevel);
                    const cost = enhanceSys.getCopperCost?.(selectedEquip.enhanceLevel);
                    const stoneCost = enhanceSys.getStoneCost?.(selectedEquip.enhanceLevel);
                    const currentGold = engine?.getResources?.()?.gold ?? engine?.getCurrencySystem?.()?.getBalance?.('copper') ?? 0;
                    if (cost && currentGold < cost) {
                      flash(`💰 铜钱不足（需${cost}），无法强化`);
                      return;
                    }
                    if (stoneCost && (engine?.getResources?.()?.enhanceStones ?? 0) < stoneCost) {
                      flash(`💎 强化石不足（需${stoneCost}），无法强化`);
                      return;
                    }
                    // R2: 显示成功率提示
                    const ratePercent = rate != null ? `${(rate * 100).toFixed(0)}%` : '?';
                    const result = enhanceSys.enhance?.(selectedEquip.uid, false);
                    if (result) {
                      const label = result.outcome === 'success'
                        ? `✅ 强化成功 → +${result.currentLevel}（成功率${ratePercent}）`
                        : result.outcome === 'downgrade'
                          ? `⚠️ 强化降级 → +${result.currentLevel}（成功率${ratePercent}，失败降级）`
                          : `❌ 强化失败（+${result.currentLevel}，成功率${ratePercent}）`;
                      flash(label);
                    }
                  } catch (e: any) {
                    flash(e?.message ?? '强化操作失败');
                  }
                  setSelectedUid(null);
                }}
              >⬆️ 强化</button>
              {/* R2: 炼制按钮 — 支持选择炼制类型 */}
              {!selectedEquip.isEquipped && (
                <button
                  style={styles.forgeBtn}
                  data-testid="equipment-panel-forge"
                  onClick={() => {
                  try {
                    const forgeSys = engine?.getEquipmentForgeSystem?.() ?? engine?.equipmentForge;
                    if (!forgeSys) return;
                    // R2: 根据forgeType选择炼制方式
                    if (forgeType === 'advanced') {
                      const result = forgeSys.advancedForge?.();
                      flash(result?.success ? `高级炼制成功: ${result.equipment?.name ?? '新装备'}` : '高级炼制失败');
                    } else if (forgeType === 'targeted' && forgeTargetSlot) {
                      const result = forgeSys.targetedForge?.(forgeTargetSlot);
                      flash(result?.success ? `定向炼制成功: ${result.equipment?.name ?? '新装备'}` : '定向炼制失败');
                    } else {
                      const result = forgeSys.basicForge?.();
                      flash(result?.success ? `基础炼制成功: ${result.equipment?.name ?? '新装备'}` : '基础炼制失败');
                    }
                  } catch (e: any) {
                    flash(e?.message ?? '炼制操作失败');
                  }
                  setSelectedUid(null);
                }}
                >🔥 {forgeType === 'advanced' ? '高级炼制' : forgeType === 'targeted' ? '定向炼制' : '锻造'}</button>
              )}
              {/* R2: 炼制类型选择 */}
              {!selectedEquip.isEquipped && (
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <button style={{ ...styles.forgeTypeBtn, ...(forgeType === null ? styles.activeForgeType : {}) }}
                    onClick={() => { setForgeType(null); setForgeTargetSlot(null); }}>基础</button>
                  <button style={{ ...styles.forgeTypeBtn, ...(forgeType === 'advanced' ? styles.activeForgeType : {}) }}
                    onClick={() => { setForgeType('advanced'); setForgeTargetSlot(null); }}>高级</button>
                  <button style={{ ...styles.forgeTypeBtn, ...(forgeType === 'targeted' ? styles.activeForgeType : {}) }}
                    onClick={() => setForgeType('targeted')}>定向</button>
                </div>
              )}
              {/* R2: 定向炼制部位选择 */}
              {forgeType === 'targeted' && !selectedEquip.isEquipped && (
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {EQUIPMENT_SLOTS.map(slot => (
                    <button key={slot} style={{
                      ...styles.forgeTypeBtn,
                      ...(forgeTargetSlot === slot ? styles.activeForgeType : {}),
                    }} onClick={() => setForgeTargetSlot(slot)}>{SLOT_ICONS[slot]}</button>
                  ))}
                </div>
              )}
              {!selectedEquip.isEquipped && (
                <button style={styles.decomposeBtn} data-testid="equipment-panel-decompose" onClick={() => handleDecompose(selectedEquip.uid)}>
                  分解
                </button>
              )}
              <button style={styles.closeBtn} data-testid="equipment-panel-close" onClick={() => setSelectedUid(null)}>关闭</button>
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
  activeBtn: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', border: '1px solid #d4a574' },
  sortBtn: {
    padding: '3px 6px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'transparent', color: '#666', fontSize: 10, cursor: 'pointer',
  },
  activeSortBtn: { background: 'rgba(212,165,116,0.1)', color: '#d4a574', border: '1px solid rgba(212,165,116,0.3)' },
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
  emptyGuide: {
    textAlign: 'center' as const, padding: '32px 16px',
    background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--tk-radius-lg)' as any,
    border: '1px dashed rgba(212,165,116,0.2)',
  },
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
  // R2: 武将装备栏样式
  tabBar: { display: 'flex', gap: 4, marginBottom: 10 },
  tabBtn: {
    flex: 1, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 12, cursor: 'pointer', textAlign: 'center' as const,
  },
  activeTab: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', border: '1px solid #d4a574' },
  heroEquipView: { padding: '4px 0' },
  heroSelect: { marginBottom: 10, padding: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--tk-radius-md)' as any },
  heroBtn: {
    padding: '3px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 11, cursor: 'pointer',
  },
  slotGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10 },
  slotCard: {
    display: 'flex', flexDirection: 'column', gap: 2, padding: 10, alignItems: 'center',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,165,116,0.2)',
    borderRadius: 'var(--tk-radius-lg)' as any, minHeight: 80,
  },
  unequipBtn: {
    marginTop: 4, padding: '2px 8px', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'rgba(255,100,100,0.1)', color: '#ff6464', fontSize: 10, cursor: 'pointer',
  },
  statSummary: {
    padding: 8, background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)',
    borderRadius: 'var(--tk-radius-md)' as any,
  },
  // R2: 炼制类型选择样式
  forgeTypeBtn: {
    padding: '2px 6px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'transparent', color: '#666', fontSize: 10, cursor: 'pointer',
  },
  activeForgeType: { background: 'rgba(255,180,60,0.2)', color: '#ffb43c', border: '1px solid rgba(255,180,60,0.4)' },
};
