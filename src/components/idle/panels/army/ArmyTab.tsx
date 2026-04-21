/**
 * ArmyTab — 军队编组Tab主面板
 *
 * 功能：
 * - 编队战力总览
 * - 5个阵位（前排×2 + 后排×3）龟型布局
 * - 武将选择列表（未上阵武将）
 * - 快速编队（一键最强阵容）
 * - 保存/加载编队方案
 *
 * @module panels/army/ArmyTab
 */
import React, { useState, useMemo, useCallback } from 'react';

// ─── Props ──────────────────────────────────
interface ArmyTabProps {
  engine: any;
  snapshotVersion?: number;
}

// ─── 阵位配置 ────────────────────────────────
/** 前排2 + 后排3 = 5个阵位 */
const SLOTS = [
  { id: 0, label: '前排左', row: 'front', col: 0 },
  { id: 1, label: '前排右', row: 'front', col: 1 },
  { id: 2, label: '后排左', row: 'back', col: 0 },
  { id: 3, label: '后排中', row: 'back', col: 1 },
  { id: 4, label: '后排右', row: 'back', col: 2 },
];

const FACTION_ICONS: Record<string, string> = {
  wei: '🔵', shu: '🔴', wu: '🟢', qun: '🟡', neutral: '⚪',
};

import { HERO_QUALITY_COLORS } from '../../common/constants';
/** 品质颜色（使用统一常量） */
const QUALITY_COLORS = HERO_QUALITY_COLORS;

// ─── 主组件 ─────────────────────────────────
const ArmyTab: React.FC<ArmyTabProps> = ({ engine }) => {
  // 本地阵位状态：string[] 长度5，空字符串=空位
  const [slots, setSlots] = useState<string[]>(['', '', '', '', '']);
  const [message, setMessage] = useState<string | null>(null);

  // ── 获取引擎数据 ──
  const heroSystem = engine?.getHeroSystem?.();
  const formationSystem = engine?.getFormationSystem?.();
  const allHeroes = useMemo(() => heroSystem?.getAllGenerals?.() ?? [], [heroSystem, engine]);
  const formations = useMemo(() => formationSystem?.getAllFormations?.() ?? [], [formationSystem, engine]);
  const activeFormation = useMemo(() => formationSystem?.getActiveFormation?.() ?? null, [formationSystem, engine]);

  // 武将名称映射
  const heroMap = useMemo(() => {
    const m: Record<string, any> = {};
    allHeroes.forEach((h: any) => { m[h.id] = h; });
    return m;
  }, [allHeroes]);

  // 已上阵武将ID集合
  const deployedIds = useMemo(() => new Set(slots.filter(Boolean)), [slots]);

  // 未上阵武将
  const availableHeroes = useMemo(() => allHeroes.filter((h: any) => !deployedIds.has(h.id)), [allHeroes, deployedIds]);

  // 编队总战力
  const totalPower = useMemo(() => {
    return slots.reduce((sum, heroId) => {
      const hero = heroMap[heroId];
      return sum + (hero?.power ?? 0);
    }, 0);
  }, [slots, heroMap]);

  // 兵种组成
  const factionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    slots.forEach(heroId => {
      const hero = heroMap[heroId];
      if (hero) {
        const f = hero.faction ?? 'neutral';
        counts[f] = (counts[f] ?? 0) + 1;
      }
    });
    return counts;
  }, [slots, heroMap]);

  // ── 操作 ──
  const handleAddHero = useCallback((heroId: string) => {
    setSlots(prev => {
      const emptyIdx = prev.indexOf('');
      if (emptyIdx === -1) { setMessage('⚠️ 编队已满'); setTimeout(() => setMessage(null), 2000); return prev; }
      if (prev.includes(heroId)) return prev;
      const next = [...prev];
      next[emptyIdx] = heroId;
      return next;
    });
  }, []);

  const handleRemoveHero = useCallback((slotIdx: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[slotIdx] = '';
      return next;
    });
  }, []);

  // 快速编队：按战力降序取前5
  const handleAutoFormation = useCallback(() => {
    const sorted = [...allHeroes].sort((a: any, b: any) => (b.power ?? 0) - (a.power ?? 0));
    const top5 = sorted.slice(0, 5).map((h: any) => h.id);
    while (top5.length < 5) top5.push('');
    setSlots(top5);
    setMessage('✨ 已自动编组最强阵容');
    setTimeout(() => setMessage(null), 2000);
  }, [allHeroes]);

  // 保存编队
  const handleSave = useCallback(() => {
    try {
      const heroIds = slots.filter(Boolean);
      if (heroIds.length === 0) { setMessage('⚠️ 编队为空'); setTimeout(() => setMessage(null), 2000); return; }
      let fId = activeFormation?.id ?? formations[0]?.id;
      if (!fId) {
        const created = formationSystem?.createFormation?.('1');
        fId = created?.id ?? '1';
      }
      formationSystem?.setFormation?.(fId, heroIds);
      setMessage('💾 编队已保存');
    } catch (e: any) {
      setMessage(e?.message ?? '保存失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [slots, formationSystem, activeFormation, formations]);

  // 加载编队
  const handleLoad = useCallback(() => {
    try {
      const f = activeFormation ?? formations[0];
      if (!f) { setMessage('⚠️ 无可用编队'); setTimeout(() => setMessage(null), 2000); return; }
      const loaded = f.slots ?? [];
      const padded = [...loaded];
      while (padded.length < 5) padded.push('');
      setSlots(padded.slice(0, 5));
      setMessage('📂 编队已加载');
    } catch (e: any) {
      setMessage(e?.message ?? '加载失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [activeFormation, formations]);

  // ── 渲染 ──
  return (
    <div style={S.container} data-testid="army-tab">
      {message && <div style={S.toast}>{message}</div>}

      {/* 顶部：战力总览 */}
      <div style={S.powerRow}>
        <span style={S.powerLabel}>⚔️ 编队战力</span>
        <span style={S.powerValue}>{totalPower.toLocaleString()}</span>
      </div>

      {/* 兵种组成 */}
      <div style={S.factionRow}>
        {Object.entries(factionCounts).map(([f, count]) => (
          <span key={f} style={S.factionBadge}>
            {FACTION_ICONS[f] ?? '⚪'} {count}
          </span>
        ))}
        {Object.keys(factionCounts).length === 0 && <span style={{ color: '#a0a0a0', fontSize: 12 }}>暂无武将</span>}
      </div>

      {/* 中间：阵位（龟型布局） */}
      <div style={S.formationBox}>
        <div style={S.formationTitle}>🛡️ 阵型</div>
        {/* 后排 3 */}
        <div style={S.backRow} className="tk-army-formation-row">
          {SLOTS.filter(s => s.row === 'back').map(slot => (
            <SlotCard key={slot.id} slot={slot} heroId={slots[slot.id]} heroMap={heroMap} onRemove={() => handleRemoveHero(slot.id)} />
          ))}
        </div>
        {/* 前排 2 */}
        <div style={S.frontRow} className="tk-army-formation-row">
          {SLOTS.filter(s => s.row === 'front').map(slot => (
            <SlotCard key={slot.id} slot={slot} heroId={slots[slot.id]} heroMap={heroMap} onRemove={() => handleRemoveHero(slot.id)} />
          ))}
        </div>
      </div>

      {/* 武将选择列表 */}
      <div style={S.section}>
        <div style={S.sectionTitle}>👤 可用武将 ({availableHeroes.length})</div>
        <div style={S.heroGrid} className="tk-army-hero-grid">
          {availableHeroes.map((hero: any) => (
            <div key={hero.id} style={S.heroCard} onClick={() => handleAddHero(hero.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{FACTION_ICONS[hero.faction] ?? '⚪'}</span>
                <span style={{ color: QUALITY_COLORS[hero.quality] ?? '#e8e0d0', fontWeight: 600, fontSize: 13 }}>
                  {hero.name ?? hero.id}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#a0a0a0', marginTop: 2 }}>⚔️{hero.power ?? 0} Lv.{hero.level ?? 1}</div>
            </div>
          ))}
          {availableHeroes.length === 0 && <div style={S.empty}>暂无可用武将</div>}
        </div>
      </div>

      {/* 底部按钮 */}
      <div style={S.bottomBar}>
        <button style={S.btnPrimary} onClick={handleAutoFormation}>✨ 快速编队</button>
        <button style={S.btnSecondary} onClick={handleSave}>💾 保存</button>
        <button style={S.btnSecondary} onClick={handleLoad}>📂 加载</button>
      </div>
    </div>
  );
};

// ─── 阵位子组件 ──────────────────────────────
interface SlotCardProps {
  slot: { id: number; label: string };
  heroId: string;
  heroMap: Record<string, any>;
  onRemove: () => void;
}

const SlotCard: React.FC<SlotCardProps> = ({ slot, heroId, heroMap, onRemove }) => {
  const hero = heroId ? heroMap[heroId] : null;
  return (
    <div style={{ ...S.slotCard, borderColor: hero ? (QUALITY_COLORS[hero.quality] ?? '#d4a574') : 'rgba(255,255,255,0.1)' }}
      className="tk-army-slot-card"
      onClick={hero ? onRemove : undefined}>
      {hero ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: QUALITY_COLORS[hero.quality] ?? '#e8e0d0' }}>
            {FACTION_ICONS[hero.faction] ?? ''} {hero.name ?? heroId}
          </div>
          <div style={{ fontSize: 10, color: '#a0a0a0', marginTop: 2 }}>⚔️{hero.power ?? 0}</div>
        </>
      ) : (
        <div style={{ color: '#666', fontSize: 12 }}>{slot.label}</div>
      )}
    </div>
  );
};

export default ArmyTab;

// ─── 样式 ───────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  container: { padding: 12, color: '#e8e0d0', minHeight: '100%', overflow: 'auto' },
  toast: { padding: '8px 12px', marginBottom: 8, borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center' },
  powerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', marginBottom: 8, borderRadius: 'var(--tk-radius-lg)' as any, background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)' },
  powerLabel: { fontSize: 14, color: '#d4a574', fontWeight: 600 },
  powerValue: { fontSize: 18, color: '#7EC850', fontWeight: 700 },
  factionRow: { display: 'flex', gap: 8, marginBottom: 12 },
  factionBadge: { padding: '2px 8px', borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(255,255,255,0.06)', fontSize: 12, color: '#c0b8a8' },
  formationBox: { padding: 12, marginBottom: 14, borderRadius: 'var(--tk-radius-lg)' as any, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' },
  formationTitle: { fontSize: 13, fontWeight: 600, color: '#d4a574', marginBottom: 10, textAlign: 'center' },
  backRow: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 },
  frontRow: { display: 'flex', justifyContent: 'center', gap: 8 },
  slotCard: { width: 90, height: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--tk-radius-lg)' as any, border: '1px solid', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'border-color 0.2s' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#d4a574', marginBottom: 8 },
  heroGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 },
  heroCard: { padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-md)' as any, cursor: 'pointer', transition: 'background 0.2s' },
  empty: { textAlign: 'center', color: '#a0a0a0', fontSize: 13, padding: 16 },
  bottomBar: { display: 'flex', gap: 8, marginTop: 12 },
  btnPrimary: { flex: 1, padding: '8px 12px', borderRadius: 'var(--tk-radius-lg)' as any, border: 'none', background: 'linear-gradient(135deg,#d4a574,#b8864a)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  btnSecondary: { flex: 1, padding: '8px 12px', borderRadius: 'var(--tk-radius-lg)' as any, border: '1px solid rgba(212,165,116,0.3)', background: 'rgba(212,165,116,0.1)', color: '#d4a574', fontSize: 13, cursor: 'pointer' },
};
