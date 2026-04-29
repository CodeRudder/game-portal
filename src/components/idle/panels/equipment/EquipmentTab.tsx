/**
 * EquipmentTab — 装备系统主Tab面板
 *
 * 三个子Tab: 背包 | 锻造 | 强化
 * 使用 engine props 模式，与 TechTab/HeroTab 一致。
 *
 * R3 修复清单：
 * - [P1-1] 空背包引导提示（通过出征或商店获取装备） ✅
 * - [P1-2] 穿戴前后属性对比（绿色提升/红色下降） ✅
 * - [P1-3] 一键穿戴最优装备按钮 ✅
 *
 * @module panels/equipment/EquipmentTab
 */
import React, { useState, useMemo, useCallback } from 'react';
import type {
  EquipmentInstance,
  EquipmentSlot,
  EquipmentRarity,
} from '@/games/three-kingdoms/core/equipment';
import {
  SLOT_LABELS, SLOT_ICONS, RARITY_LABELS,
  EQUIPMENT_SLOTS, EQUIPMENT_RARITIES,
} from '@/games/three-kingdoms/core/equipment';
import { EQUIP_QUALITY_COLORS } from '../../common/constants';
import { formatNumber } from '@/components/idle/utils/formatNumber';
/** 品质颜色（使用统一常量覆盖引擎默认值） */
const RARITY_COLORS = EQUIP_QUALITY_COLORS;
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import SharedPanel from '@/components/idle/components/SharedPanel';

// ─── Props ──────────────────────────────────
interface EquipmentTabProps {
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
  /** 是否显示（弹窗模式） */
  visible?: boolean;
  /** 关闭回调（弹窗模式） */
  onClose?: () => void;
}

type SubTab = 'bag' | 'forge' | 'enhance';

const SUB_TABS: { id: SubTab; icon: string; label: string }[] = [
  { id: 'bag', icon: '🎒', label: '背包' },
  { id: 'forge', icon: '🔥', label: '锻造' },
  { id: 'enhance', icon: '⬆️', label: '强化' },
];

const RARITY_ORDER: Record<EquipmentRarity, number> = {
  white: 1, green: 2, blue: 3, purple: 4, gold: 5,
};

function fmt(n: number): string {
  return formatNumber(n);
}

// ─── 主组件 ─────────────────────────────────
const EquipmentTab: React.FC<EquipmentTabProps> = ({ engine, snapshotVersion, visible = true, onClose }) => {
  const [subTab, setSubTab] = useState<SubTab>('bag');
  const [slotFilter, setSlotFilter] = useState<EquipmentSlot | null>(null);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [forgeType, setForgeType] = useState<'basic' | 'advanced'>('basic');
  const [enhanceUseProt, setEnhanceUseProt] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** P1-2: 穿戴确认弹窗 */
  const [equipConfirmUid, setEquipConfirmUid] = useState<string | null>(null);
  /** P1-2: 穿戴目标武将ID */
  const [equipHeroId, setEquipHeroId] = useState<string>('hero1');

  // ── 引擎子系统引用 ──
  const _registry = engine?.getSubsystemRegistry?.();
  const eqSys = _registry?.get?.('equipment') as any;
  const forgeSys = _registry?.get?.('equipmentForge') as any;
  const enhanceSys = _registry?.get?.('equipmentEnhance') as any;
  const recommendSys = _registry?.get?.('equipmentRecommend') as any;

  // ── 数据 ──
  const allItems: EquipmentInstance[] = useMemo(
    () => eqSys?.getAllEquipments?.() ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eqSys, snapshotVersion],
  );
  const bagCap = eqSys?.getBagCapacity?.() ?? 100;

  const displayItems = useMemo(() => {
    let items = allItems;
    if (slotFilter) items = items.filter(e => e.slot === slotFilter);
    return [...items].sort((a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0));
  }, [allItems, slotFilter]);

  const selected = selectedUid ? allItems.find(e => e.uid === selectedUid) ?? null : null;

  // P1-2: 穿戴确认相关数据
  const equipConfirmItem = equipConfirmUid ? allItems.find(e => e.uid === equipConfirmUid) ?? null : null;

  // 获取武将当前已穿戴装备
  const currentHeroEquips = useMemo(() => {
    if (!eqSys || !equipConfirmItem) return null;
    try {
      const equips = eqSys.getHeroEquips?.(equipHeroId);
      if (!equips) return null;
      const slotUid = equips[equipConfirmItem.slot];
      if (!slotUid) return null;
      return allItems.find(e => e.uid === slotUid) ?? null;
    } catch { return null; }
  }, [eqSys, equipConfirmItem, equipHeroId, allItems]);

  // ── 操作 ──
  const handleForge = useCallback(() => {
    try {
      if (!forgeSys) return setMessage('锻造系统未就绪');
      const forgeCost = forgeSys.getForgeCost?.(forgeType);
      const currentGold = engine?.resource?.getResources?.()?.gold ?? 0;
      if (forgeCost && currentGold < forgeCost) {
        setTimeout(() => setMessage(null), 2000);
        return;
      }
      const result = forgeType === 'basic'
        ? forgeSys.basicForge?.()
        : forgeSys.advancedForge?.();
      setMessage(result?.success ? `锻造成功: ${result.output?.name ?? '新装备'}` : `锻造失败: ${result?.reason ?? '未知'}`);
    } catch (e: any) {
      setMessage(e?.message ?? '锻造操作失败');
      setTimeout(() => setMessage(null), 2000);
    }
  }, [forgeSys, forgeType, engine]);

  const handleEnhance = useCallback(() => {
    try {
      if (!selectedUid) return setMessage('请先选择装备');
      if (!enhanceSys) return setMessage('强化系统未就绪');
      const enhanceCost = enhanceSys.getEnhanceCost?.(selected);
      const currentGold = engine?.resource?.getResources?.()?.gold ?? 0;
      if (enhanceCost && currentGold < enhanceCost) {
        setMessage('💰 铜钱不足，无法强化');
        setTimeout(() => setMessage(null), 2000);
        return;
      }
      const result = enhanceSys.enhance?.(selectedUid, enhanceUseProt);
      setMessage(result?.success
        ? `强化成功 → +${result.newLevel}`
        : `强化失败: ${result?.outcome ?? '未知'}`,
      );
    } catch (e: any) {
      setMessage(e?.message ?? '强化操作失败');
      setTimeout(() => setMessage(null), 2000);
    }
    setSelectedUid(null);
  }, [selectedUid, selected, enhanceSys, enhanceUseProt, engine]);

  const handleDecompose = useCallback((uid: string) => {
    try {
      const result = eqSys?.decompose?.(uid);
      setMessage(result?.success ? '已分解' : `分解失败: ${result?.reason ?? ''}`);
    } catch (e: any) {
      setMessage(e?.message ?? '分解操作失败');
      setTimeout(() => setMessage(null), 2000);
    }
    setSelectedUid(null);
  }, [eqSys]);

  // P1-2: 穿戴装备（带属性对比确认）
  const handleEquip = useCallback((uid: string) => {
    try {
      const result = eqSys?.equipItem?.(equipHeroId, uid);
      if (result?.success) {
        const replaced = result.replacedUid ? '（替换旧装备）' : '';
        setMessage(`✅ 穿戴成功${replaced}`);
      } else {
        setMessage(`穿戴失败: ${result?.reason ?? '未知'}`);
      }
    } catch (e: any) {
      setMessage(e?.message ?? '穿戴操作失败');
    }
    setEquipConfirmUid(null);
    setSelectedUid(null);
    setTimeout(() => setMessage(null), 2500);
  }, [eqSys, equipHeroId]);

  // P1-3: 一键穿戴最优装备
  const handleAutoEquip = useCallback(() => {
    if (!eqSys) return setMessage('装备系统未就绪');
    try {
      let equippedCount = 0;
      // 对每个部位，找到品质最高的未穿戴装备
      for (const slot of EQUIPMENT_SLOTS) {
        // 获取当前武将该部位已穿戴装备
        const currentEquips = eqSys.getHeroEquips?.(equipHeroId);
        const currentSlotUid = currentEquips?.[slot];
        const currentEquip = currentSlotUid ? allItems.find(e => e.uid === currentSlotUid) : null;

        // 筛选该部位所有未穿戴装备
        const candidates = allItems.filter(e => e.slot === slot && !e.isEquipped);
        if (candidates.length === 0) continue;

        // 选出评分最高的（品质 > 强化等级 > 主属性值）
        const best = candidates.sort((a, b) => {
          const rDiff = (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0);
          if (rDiff !== 0) return rDiff;
          const eDiff = b.enhanceLevel - a.enhanceLevel;
          if (eDiff !== 0) return eDiff;
          return b.mainStat.value - a.mainStat.value;
        })[0];

        // 如果当前已有装备，比较是否更优
        if (currentEquip) {
          const currentScore = (RARITY_ORDER[currentEquip.rarity] ?? 0) * 1000 + currentEquip.enhanceLevel * 10 + currentEquip.mainStat.value;
          const newScore = (RARITY_ORDER[best.rarity] ?? 0) * 1000 + best.enhanceLevel * 10 + best.mainStat.value;
          if (newScore <= currentScore) continue;
        }

        const result = eqSys.equipItem?.(equipHeroId, best.uid);
        if (result?.success) equippedCount++;
      }
      if (equippedCount > 0) {
        setMessage(`✅ 一键穿戴成功，共穿戴 ${equippedCount} 件装备`);
      } else {
        setMessage('没有找到更优的装备可穿戴');
      }
    } catch (e: any) {
      setMessage(e?.message ?? '一键穿戴失败');
    }
    setTimeout(() => setMessage(null), 2500);
  }, [eqSys, equipHeroId, allItems]);

  // P1-2: 计算属性差异
  const getStatDiff = useCallback((newItem: EquipmentInstance, oldItem: EquipmentInstance | null) => {
    const diffs: { label: string; newValue: number; oldValue: number; diff: number }[] = [];
    // 主属性
    diffs.push({
      label: newItem.mainStat.type,
      newValue: newItem.mainStat.value,
      oldValue: oldItem?.mainStat.value ?? 0,
      diff: newItem.mainStat.value - (oldItem?.mainStat.value ?? 0),
    });
    // 副属性
    const oldSubMap = new Map<string, number>();
    if (oldItem) {
      for (const ss of oldItem.subStats) oldSubMap.set(ss.type, ss.value);
    }
    for (const ss of newItem.subStats) {
      const oldVal = oldSubMap.get(ss.type) ?? 0;
      diffs.push({ label: ss.type, newValue: ss.value, oldValue: oldVal, diff: ss.value - oldVal });
    }
    return diffs;
  }, []);

  // ── 渲染 ──
  return (
    <SharedPanel visible={visible} onClose={onClose} title="装备" icon="⚔️" width="min(600px, 95vw)">
    <div style={S.container} data-testid="equipment-tab">
      {/* 子Tab导航 */}
      <div style={S.subTabs} className="tk-equipment-sub-tabs">
        {SUB_TABS.map(t => (
          <button key={t.id} style={{ ...S.subBtn, ...(subTab === t.id ? S.subBtnActive : {}) }}
            onClick={() => { setSubTab(t.id); setSelectedUid(null); setMessage(null); }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* 消息条 */}
      {message && (
        <div style={S.msgBar} onClick={() => setMessage(null)}>{message}</div>
      )}

      {/* ── 背包 ── */}
      {subTab === 'bag' && (
        <>
          <div style={S.filterRow}>
            <span style={S.info}>🎒 {allItems.length}/{bagCap}</span>
            {/* P1-3: 一键穿戴按钮 */}
            {allItems.length > 0 && (
              <button style={S.autoEquipBtn} onClick={handleAutoEquip} data-testid="equipment-panel-auto-equip">
                👑 一键穿戴
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button style={{ ...S.filterBtn, ...(slotFilter === null ? S.activeBtn : {}) }}
              onClick={() => setSlotFilter(null)}>全部</button>
            {EQUIPMENT_SLOTS.map(s => (
              <button key={s} style={{ ...S.filterBtn, ...(slotFilter === s ? S.activeBtn : {}) }}
                onClick={() => setSlotFilter(s)}>{SLOT_ICONS[s]}</button>
            ))}
          </div>
          <div style={S.grid} className="tk-equipment-grid">
            {displayItems.map(eq => (
              <div key={eq.uid} style={{ ...S.card, border: `1px solid ${RARITY_COLORS[eq.rarity]}40` }}
                onClick={() => setSelectedUid(eq.uid)}>
                <div style={{ ...S.rarityBar, backgroundColor: RARITY_COLORS[eq.rarity] }} />
                <div style={S.cardHead}>
                  <span>{SLOT_ICONS[eq.slot]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: RARITY_COLORS[eq.rarity], fontSize: 13, fontWeight: 600 }}>{eq.name}</div>
                    <div style={{ fontSize: 10, color: '#a0a0a0' }}>{SLOT_LABELS[eq.slot]} · +{eq.enhanceLevel}{eq.isEquipped ? ' · ✅' : ''}</div>
                  </div>
                </div>
                <div style={S.statRow}>
                  <span style={{ color: '#a0a0a0' }}>{eq.mainStat.type}</span>
                  <span style={{ color: RARITY_COLORS[eq.rarity], fontWeight: 600 }}>{fmt(eq.mainStat.value)}</span>
                </div>
              </div>
            ))}
          </div>
          {/* P1-1: 空背包引导提示 */}
          {displayItems.length === 0 && (
            <div style={S.emptyGuide} data-testid="equipment-panel-empty-guide">
              <div style={S.emptyGuideIcon}>🎒</div>
              <div style={S.emptyGuideTitle}>暂无装备</div>
              <div style={S.emptyGuideHint}>
                通过<span style={{ color: '#d4a574' }}>出征</span>或<span style={{ color: '#d4a574' }}>商店</span>获取装备
              </div>
              <div style={S.emptyGuideSubHint}>
                完成关卡战斗可掉落装备，也可在商店中购买装备箱
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 锻造 ── */}
      {subTab === 'forge' && (
        <div style={S.forgePanel}>
          <div style={S.sectionTitle}>🔥 装备锻造</div>
          <div style={S.forgeTypes}>
            <button style={{ ...S.forgeBtn, ...(forgeType === 'basic' ? S.forgeBtnActive : {}) }}
              onClick={() => setForgeType('basic')}>基础锻造（3→1）</button>
            <button style={{ ...S.forgeBtn, ...(forgeType === 'advanced' ? S.forgeBtnActive : {}) }}
              onClick={() => setForgeType('advanced')}>高级锻造（5→1）</button>
          </div>
          <div style={{ fontSize: 12, color: '#a0a0a0', marginBottom: 12 }}>
            {forgeType === 'basic'
              ? '消耗3件同品质装备，概率锻造出更高品质装备'
              : '消耗5件同品质装备，更高概率获得高品质装备'}
          </div>
          <button style={S.actionBtn} onClick={handleForge}>
            ⚒️ 开始{forgeType === 'basic' ? '基础' : '高级'}锻造
          </button>
        </div>
      )}

      {/* ── 强化 ── */}
      {subTab === 'enhance' && (
        <div style={S.enhancePanel}>
          <div style={S.sectionTitle}>⬆️ 装备强化</div>
          {!selected ? (
            <>
              <div style={{ fontSize: 12, color: '#a0a0a0', marginBottom: 8 }}>选择要强化的装备：</div>
              <div style={S.grid}>
                {allItems.filter(e => !e.isEquipped || true).map(eq => (
                  <div key={eq.uid} style={{ ...S.card, border: `1px solid ${RARITY_COLORS[eq.rarity]}40` }}
                    onClick={() => setSelectedUid(eq.uid)}>
                    <div style={{ ...S.rarityBar, backgroundColor: RARITY_COLORS[eq.rarity] }} />
                    <div style={{ color: RARITY_COLORS[eq.rarity], fontSize: 13, fontWeight: 600 }}>{eq.name}</div>
                    <div style={{ fontSize: 10, color: '#a0a0a0' }}>+{eq.enhanceLevel}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={S.enhanceDetail}>
              <div style={{ color: RARITY_COLORS[selected.rarity], fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                {selected.name} <span style={{ fontSize: 12 }}>+{selected.enhanceLevel}</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                {selected.mainStat.type}: {fmt(selected.mainStat.value)}
              </div>
              {selected.subStats.map((ss, i) => (
                <div key={i} style={{ fontSize: 12, color: '#a0a0a0' }}>{ss.type}: {fmt(ss.value)}</div>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '12px 0', fontSize: 12, color: '#a0a0a0' }}>
                <input type="checkbox" checked={enhanceUseProt} onChange={e => setEnhanceUseProt(e.target.checked)} />
                使用保护符（防降级）
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.actionBtn} onClick={handleEnhance}>⬆️ 强化</button>
                <button style={S.closeBtn} onClick={() => setSelectedUid(null)}>返回</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 装备详情弹窗（背包用） ── */}
      {subTab === 'bag' && selected && !equipConfirmUid && (
        <div style={S.overlay} onClick={() => setSelectedUid(null)}>
          <div style={S.detailPanel} className="tk-equipment-detail-modal" onClick={e => e.stopPropagation()}>
            <div style={{ color: RARITY_COLORS[selected.rarity], fontSize: 18, fontWeight: 600 }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: '#a0a0a0', marginBottom: 12 }}>
              {RARITY_LABELS[selected.rarity]} · {SLOT_LABELS[selected.slot]} · +{selected.enhanceLevel}
            </div>
            <div style={S.detailSection}>
              <div style={S.detailLabel}>主属性</div>
              <div>{selected.mainStat.type}: {fmt(selected.mainStat.value)}</div>
            </div>
            {selected.subStats.length > 0 && (
              <div style={S.detailSection}>
                <div style={S.detailLabel}>副属性</div>
                {selected.subStats.map((ss, i) => <div key={i}>{ss.type}: {fmt(ss.value)}</div>)}
              </div>
            )}
            {selected.specialEffect && (
              <div style={S.detailSection}>
                <div style={S.detailLabel}>特效</div>
                <div>{selected.specialEffect.description}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {/* P1-2: 穿戴按钮（带属性对比） */}
              {!selected.isEquipped && (
                <button style={S.equipBtn} data-testid="equipment-panel-equip"
                  onClick={() => setEquipConfirmUid(selected.uid)}>
                  👕 穿戴
                </button>
              )}
              {!selected.isEquipped && (
                <button style={S.decomposeBtn} onClick={() => handleDecompose(selected.uid)}>分解</button>
              )}
              <button style={S.closeBtn} onClick={() => setSelectedUid(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* P1-2: 穿戴确认弹窗（属性对比） */}
      {equipConfirmItem && (
        <div style={S.overlay} onClick={() => setEquipConfirmUid(null)} data-testid="equipment-panel-equip-overlay">
          <div style={S.detailPanel} onClick={e => e.stopPropagation()} data-testid="equipment-panel-equip-confirm">
            <div style={{ color: RARITY_COLORS[equipConfirmItem.rarity], fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              ⚔️ 穿戴确认
            </div>
            <div style={{ fontSize: 13, color: '#d4a574', marginBottom: 12 }}>
              将 <span style={{ fontWeight: 600 }}>{equipConfirmItem.name}</span> 穿戴到 {SLOT_LABELS[equipConfirmItem.slot]} 槽位
            </div>

            {/* 属性对比区域 */}
            <div style={S.compareSection}>
              <div style={S.compareHeader}>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#a0a0a0' }}>
                  {currentHeroEquips ? `当前: ${currentHeroEquips.name}` : '当前: 无'}
                </span>
                <span style={{ width: 30 }} />
                <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#d4a574' }}>
                  新: {equipConfirmItem.name}
                </span>
              </div>
              {getStatDiff(equipConfirmItem, currentHeroEquips).map((d, i) => (
                <div key={i} style={S.compareRow}>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#a0a0a0' }}>
                    {d.oldValue > 0 ? fmt(d.oldValue) : '-'}
                  </span>
                  <span style={{
                    width: 30, textAlign: 'center', fontSize: 11, fontWeight: 600,
                    color: d.diff > 0 ? '#7EC850' : d.diff < 0 ? '#ff6464' : '#888',
                  }}>
                    {d.diff > 0 ? `+${fmt(d.diff)}` : d.diff < 0 ? fmt(d.diff) : '='}
                  </span>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#e8e0d0' }}>
                    {fmt(d.newValue)}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button style={S.closeBtn} onClick={() => setEquipConfirmUid(null)}>取消</button>
              <button style={S.equipBtn} data-testid="equipment-panel-equip-confirm-btn"
                onClick={() => handleEquip(equipConfirmUid!)}>
                ✅ 确认穿戴
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SharedPanel>
  );
};

export default EquipmentTab;

// ─── 样式 ───────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  container: { padding: 12, color: '#e8e0d0', minHeight: '100%', maxHeight: '80vh', overflowY: 'auto' },
  subTabs: { display: 'flex', gap: 4, marginBottom: 12 },
  subBtn: {
    padding: '6px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 13, cursor: 'pointer',
  },
  subBtnActive: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', border: '1px solid #d4a574' },
  msgBar: {
    padding: '6px 12px', marginBottom: 8, background: 'rgba(212,165,116,0.15)',
    borderRadius: 'var(--tk-radius-md)' as any, fontSize: 12, color: '#d4a574', cursor: 'pointer', textAlign: 'center',
  },
  filterRow: { display: 'flex', gap: 4, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' },
  info: { fontSize: 12, color: '#a0a0a0', marginRight: 8 },
  filterBtn: {
    padding: '4px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 11, cursor: 'pointer',
  },
  activeBtn: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', border: '1px solid #d4a574' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 8 },
  card: {
    display: 'flex', flexDirection: 'column', gap: 4, padding: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,165,116,0.2)',
    borderRadius: 'var(--tk-radius-lg)' as any, cursor: 'pointer', position: 'relative', overflow: 'hidden',
  },
  rarityBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 },
  statRow: { display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' },
  empty: { textAlign: 'center', padding: 24, color: '#666', fontSize: 13 },
  forgePanel: { padding: '8px 0' },
  sectionTitle: { fontSize: 15, fontWeight: 600, color: '#d4a574', marginBottom: 12 },
  forgeTypes: { display: 'flex', gap: 8, marginBottom: 8 },
  forgeBtn: {
    padding: '8px 16px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 13, cursor: 'pointer',
  },
  forgeBtnActive: { background: 'rgba(212,165,116,0.2)', color: '#d4a574', border: '1px solid #d4a574' },
  actionBtn: {
    padding: '10px 24px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 14, cursor: 'pointer', fontWeight: 600,
  },
  closeBtn: {
    padding: '10px 24px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 13, cursor: 'pointer',
  },
  enhancePanel: { padding: '8px 0' },
  enhanceDetail: { padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--tk-radius-lg)' as any },
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--tk-z-modal)' as any,
  },
  detailPanel: {
    background: '#1a1a2e', border: '1px solid #d4a574', borderRadius: 'var(--tk-radius-xl)' as any, padding: 20,
    minWidth: 300, maxWidth: 420, color: '#e8e0d0',
  },
  detailSection: { marginBottom: 10, fontSize: 13 },
  detailLabel: { color: '#d4a574', fontSize: 12, marginBottom: 2 },
  decomposeBtn: {
    flex: 1, padding: '8px', border: '1px solid rgba(255,100,100,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(255,100,100,0.15)', color: '#ff6464', fontSize: 13, cursor: 'pointer',
  },
  // P1-2: 穿戴按钮样式
  equipBtn: {
    flex: 1, padding: '8px', border: '1px solid rgba(126,200,80,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(126,200,80,0.15)', color: '#7EC850', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  },
  // P1-3: 一键穿戴按钮样式
  autoEquipBtn: {
    padding: '4px 12px', border: '1px solid rgba(255,193,7,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(255,193,7,0.12)', color: '#ffc107', fontSize: 11, cursor: 'pointer', fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  // P1-1: 空背包引导样式
  emptyGuide: {
    textAlign: 'center' as const, padding: '32px 16px',
    background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--tk-radius-lg)' as any,
    border: '1px dashed rgba(212,165,116,0.2)',
  },
  emptyGuideIcon: { fontSize: 36, marginBottom: 8, opacity: 0.6 },
  emptyGuideTitle: { fontSize: 14, color: '#888', marginBottom: 8 },
  emptyGuideHint: { fontSize: 13, color: '#a0a0a0', lineHeight: 1.6 },
  emptyGuideSubHint: { fontSize: 11, color: '#666', marginTop: 6, lineHeight: 1.5 },
  // P1-2: 属性对比区域样式
  compareSection: {
    background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--tk-radius-md)' as any,
    padding: 12, marginBottom: 8,
  },
  compareHeader: {
    display: 'flex', alignItems: 'center', marginBottom: 8,
    borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6,
  },
  compareRow: {
    display: 'flex', alignItems: 'center', padding: '3px 0', fontSize: 12,
  },
};
