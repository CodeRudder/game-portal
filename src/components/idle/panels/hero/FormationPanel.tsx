/**
 * FormationPanel — 编队管理面板
 * 创建/删除/重命名编队 · 激活切换 · 拖拽编辑 · 战力展示 · 阵容收藏
 *
 * R5 修复：
 * - [P2] 精简代码至500行以内，抽取羁绊预览为独立工具函数
 * - [P3] savedSlots持久化已通过localStorage实现（R4遗留已验证）
 * - [P3] handleLoadSlot加载结果校验已完善（R4遗留已验证）
 * - [P3] FormationGrid移动端媒体查询已在CSS中完善
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { GeneralData, FormationData } from '@/games/three-kingdoms/engine';
import { QUALITY_BORDER_COLORS, MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION, FACTION_LABELS } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { ActiveBond, BondPotentialTip } from '@/games/three-kingdoms/core/bond';
import { BOND_NAMES } from '@/games/three-kingdoms/core/bond';
import { PARTNER_BONDS } from '@/games/three-kingdoms/engine/hero/bond-config';
import FormationSaveSlot, { type FormationSlotData } from './FormationSaveSlot';
import './FormationPanel.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface FormationPanelProps {
  engine: ThreeKingdomsEngine;
  snapshotVersion: number;
}

// ─────────────────────────────────────────────
// 工具函数：编队数据标准化
// ─────────────────────────────────────────────
function normalizeFormations(raw: unknown): FormationData[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, FormationData>);
  return [];
}

/** 收集其他编队中已使用的武将ID */
function collectOtherUsedIds(formations: FormationData[], excludeId: string): Set<string> {
  const ids = new Set<string>();
  for (const f of formations) {
    if (f.id === excludeId) continue;
    for (const s of f.slots) { if (s) ids.add(s); }
  }
  return ids;
}

/** 按防御降序排列武将（防御最高的排前排） */
function sortByDefenseDesc(ids: string[], getGeneral: (id: string) => GeneralData | undefined): string[] {
  return [...ids].sort((a, b) => {
    const ga = getGeneral(a), gb = getGeneral(b);
    if (!ga || !gb) return 0;
    const defDiff = (gb.baseStats?.defense ?? 0) - (ga.baseStats?.defense ?? 0);
    return defDiff !== 0 ? defDiff : gb.level - ga.level;
  });
}

/** 获取编队中已激活的搭档羁绊 */
function getActivePartnerBonds(heroIds: string[]) {
  if (heroIds.length === 0) return [];
  const result: Array<{ id: string; name: string; effects: ReadonlyArray<{ stat: string; value: number }> }> = [];
  for (const bond of PARTNER_BONDS) {
    if (bond.generalIds.filter((id) => heroIds.includes(id)).length >= bond.minRequired) {
      result.push({ id: bond.id, name: bond.name, effects: bond.effects });
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const FormationPanel: React.FC<FormationPanelProps> = ({ engine, snapshotVersion }) => {
  const formationSystem = engine.getFormationSystem();
  const heroSystem = engine.getHeroSystem();
  const dispatchSystem = engine.getHeroDispatchSystem();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const isCreatingRef = useRef(false);
  const [isCreating, setIsCreating] = useState(false);

  // ── 阵容收藏（localStorage持久化） ──
  const SAVED_SLOTS_KEY = 'tk-formation-saved-slots';
  const [savedSlots, setSavedSlots] = useState<FormationSlotData[]>(() => {
    try { const raw = localStorage.getItem(SAVED_SLOTS_KEY); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(SAVED_SLOTS_KEY, JSON.stringify(savedSlots)); } catch { /* 静默 */ }
  }, [savedSlots]);

  // ── 获取数据 ──
  const formations = useMemo(() => {
    void snapshotVersion;
    return normalizeFormations(formationSystem.getAllFormations());
  }, [formationSystem, snapshotVersion]);

  const activeId = formationSystem.getActiveFormationId();
  const allGenerals = engine.getGenerals();

  // ── 编队战力 ──
  const getFormationPower = useCallback(
    (f: FormationData) => formationSystem.calculateFormationPower(
      f, (id) => heroSystem.getGeneral(id) as GeneralData | undefined,
      (g) => heroSystem.calculatePower(g, engine.getHeroStarSystem().getStar(g.id)),
    ),
    [formationSystem, heroSystem, engine],
  );

  // ── 创建编队（含防抖） ──
  const handleCreate = useCallback(() => {
    if (isCreating || isCreatingRef.current) return;
    isCreatingRef.current = true; setIsCreating(true);
    try { formationSystem.createFormation(); } finally { setIsCreating(false); isCreatingRef.current = false; }
  }, [formationSystem, isCreating]);

  const handleActivate = useCallback((id: string) => formationSystem.setActiveFormation(id), [formationSystem]);
  const handleDelete = useCallback((id: string) => {
    formationSystem.deleteFormation(id);
    if (editingId === id) setEditingId(null);
  }, [formationSystem, editingId]);

  const handleRenameStart = useCallback((f: FormationData) => { setRenameId(f.id); setRenameValue(f.name); }, []);
  const handleRenameConfirm = useCallback(() => {
    if (renameId && renameValue.trim()) formationSystem.renameFormation(renameId, renameValue.trim());
    setRenameId(null);
  }, [formationSystem, renameId, renameValue]);

  const handleAddHero = useCallback((fid: string, gid: string) => formationSystem.addToFormation(fid, gid), [formationSystem]);
  const handleRemoveHero = useCallback((fid: string, gid: string) => formationSystem.removeFromFormation(fid, gid), [formationSystem]);

  // ── 一键自动编队 ──
  const handleAutoFormation = useCallback((formationId: string) => {
    const used = collectOtherUsedIds(formations, formationId);
    const candidates = allGenerals.filter((g) => !used.has(g.id));
    if (candidates.length === 0) return;
    const getG = (id: string) => heroSystem.getGeneral(id) as GeneralData | undefined;
    const calcP = (g: GeneralData) => heroSystem.calculatePower(g, engine.getHeroStarSystem().getStar(g.id));
    const topN = [...candidates].sort((a, b) => calcP(b) - calcP(a)).slice(0, MAX_SLOTS_PER_FORMATION);
    const defenseSorted = sortByDefenseDesc(topN.map((g) => g.id), getG);
    const formation = formationSystem.getFormation(formationId);
    if (!formation) return;
    for (let i = 0; i < MAX_SLOTS_PER_FORMATION; i++) {
      const e = formation.slots[i]; if (e) formationSystem.removeFromFormation(formationId, e);
    }
    for (const heroId of defenseSorted) formationSystem.addToFormation(formationId, heroId);
  }, [formationSystem, heroSystem, engine, allGenerals, formations]);

  // ── 可用武将（排除其他编队武将） ──
  const availableGenerals = useMemo(() => {
    if (!editingId) return [];
    const f = formationSystem.getFormation(editingId);
    if (!f) return [];
    const otherUsed = collectOtherUsedIds(formations, editingId);
    return allGenerals.filter((g) => !otherUsed.has(g.id));
  }, [editingId, allGenerals, formationSystem, snapshotVersion, formations]);

  const bondSystem = engine.getBondSystem();

  // ── 阵容收藏回调 ──
  const handleSaveSlot = useCallback((name: string) => {
    const aid = formationSystem.getActiveFormationId();
    const af = aid ? formationSystem.getFormation(aid) : null;
    if (!af) return;
    setSavedSlots((prev) => [...prev, {
      id: `slot-${Date.now()}`, name,
      heroIds: af.slots.filter((s: string) => s !== ''),
    }]);
  }, [formationSystem]);

  const handleLoadSlot = useCallback((slotId: string) => {
    const slot = savedSlots.find((s) => s.id === slotId);
    if (!slot) return;
    const aid = formationSystem.getActiveFormationId();
    if (!aid) return;
    const allF = normalizeFormations(formationSystem.getAllFormations());
    const otherUsed = collectOtherUsedIds(allF, aid);
    const getG = (id: string) => heroSystem.getGeneral(id);
    const validIds = slot.heroIds.filter((id) => !otherUsed.has(id) && !!getG(id));
    if (validIds.length === 0) { console.warn('阵容加载失败：保存的武将均不可用'); return; }
    const sorted = sortByDefenseDesc(validIds, getG as (id: string) => GeneralData | undefined);
    const cur = formationSystem.getFormation(aid);
    if (cur) { for (const h of cur.slots) { if (h) formationSystem.removeFromFormation(aid, h); } }
    for (const h of sorted) formationSystem.addToFormation(aid, h);
  }, [savedSlots, formationSystem, heroSystem]);

  const handleDeleteSlot = useCallback((slotId: string) => {
    setSavedSlots((prev) => prev.filter((s) => s.id !== slotId));
  }, []);

  const getBondPreview = useCallback((f: FormationData) => {
    const heroes = f.slots.filter((s) => s !== '').map((id) => heroSystem.getGeneral(id))
      .filter((g): g is GeneralData => g !== undefined);
    if (heroes.length === 0) return null;
    return bondSystem.getFormationPreview(f.id, heroes);
  }, [bondSystem, heroSystem]);

  // ── 渲染武将槽位 ──
  const renderSlot = (heroId: string, idx: number, fid: string, isFront: boolean) => {
    const rowCls = isFront ? 'tk-formation-slot--front' : 'tk-formation-slot--back';
    if (!heroId) return <div key={idx} className={`tk-formation-slot tk-formation-slot--empty ${rowCls}`}>{idx + 1}</div>;
    const hero = heroSystem.getGeneral(heroId);
    const dispatched = dispatchSystem?.getHeroDispatchBuilding?.(heroId);
    return (
      <div key={idx} className={`tk-formation-slot ${rowCls}${dispatched ? ' tk-formation-slot--dispatched' : ''}`}
        style={hero ? { borderColor: QUALITY_BORDER_COLORS[hero.quality] } : {}}
        title={dispatched ? `${hero?.name ?? heroId} 已派遣至建筑` : undefined}>
        <span className="tk-formation-slot-name">{hero?.name ?? heroId}</span>
        {dispatched && <span className="tk-formation-slot-dispatch-badge" title="已派遣">🏗️</span>}
        {editingId === fid && <button className="tk-formation-slot-remove" onClick={() => handleRemoveHero(fid, heroId)}>✕</button>}
      </div>
    );
  };

  // ── 渲染羁绊信息 ──
  const renderBonds = (f: FormationData) => {
    const preview = getBondPreview(f);
    const partners = getActivePartnerBonds(f.slots.filter((s) => s !== ''));
    if (!preview && partners.length === 0) return null;
    return (
      <div className="tk-formation-bonds">
        {preview && preview.activeBonds.length > 0 && (
          <div className="tk-formation-bonds-active">
            {preview.activeBonds.map((bond: ActiveBond, idx: number) => (
              <span key={idx} className="tk-formation-bond-tag tk-formation-bond-tag--active">
                {bond.effect.icon} {bond.effect.name}
                <span className="tk-formation-bond-count">({FACTION_LABELS[bond.faction]}×{bond.heroCount})</span>
              </span>
            ))}
          </div>
        )}
        {partners.length > 0 && (
          <div className="tk-formation-bonds-partner">
            {partners.map((b) => (
              <span key={b.id} className="tk-formation-bond-tag tk-formation-bond-tag--partner">
                🤝 {b.name}
                <span className="tk-formation-bond-count">({b.effects.map((e) => `${e.stat}+${(e.value * 100).toFixed(0)}%`).join(', ')})</span>
              </span>
            ))}
          </div>
        )}
        {preview && preview.totalBonuses && Object.keys(preview.totalBonuses).length > 0 && (
          <div className="tk-formation-bonds-bonus">
            {Object.entries(preview.totalBonuses).map(([k, v]) => (
              <span key={k} className="tk-formation-bond-bonus">
                {k === 'attack' ? '攻击' : k === 'defense' ? '防御' : k === 'intelligence' ? '智力' : k === 'speed' ? '速度' : k}+{((v as number) * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        )}
        {preview && preview.potentialBonds.length > 0 && (
          <div className="tk-formation-bonds-potential">
            {preview.potentialBonds.map((tip: BondPotentialTip, idx: number) => (
              <span key={idx} className="tk-formation-bond-tag tk-formation-bond-tag--potential">
                还差{tip.missingCount}名{FACTION_LABELS[tip.suggestedFaction]}武将激活「{BOND_NAMES[tip.type]}」
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── 渲染 ──
  return (
    <div className="tk-formation-panel" data-testid="formation-panel">
      <div className="tk-formation-header">
        <span className="tk-formation-title">⚔️ 编队管理</span>
        <button className="tk-formation-create-btn" data-testid="formation-panel-create-btn"
          onClick={handleCreate} disabled={formations.length >= MAX_FORMATIONS || isCreating}>
          + 创建编队
        </button>
      </div>

      {formations.length === 0 ? (
        <div className="tk-formation-empty"><p>尚无编队，点击「创建编队」开始组建</p></div>
      ) : (
        <div className="tk-formation-list">
          {formations.map((f) => {
            const isActive = f.id === activeId;
            const isEditing = f.id === editingId;
            const isRenaming = f.id === renameId;
            const members = f.slots.filter((s: string) => s !== '');
            return (
              <div key={f.id} className={`tk-formation-card ${isActive ? 'tk-formation-card--active' : ''}`}
                data-testid={`formation-panel-card-${f.id}`}>
                {/* 卡片头部 */}
                <div className="tk-formation-card-header">
                  {isRenaming ? (
                    <input className="tk-formation-rename-input" inputMode="text" enterKeyHint="done"
                      value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameConfirm} onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
                      maxLength={10} autoFocus />
                  ) : (
                    <span className="tk-formation-name" onClick={() => handleRenameStart(f)} title="点击重命名">{f.name}</span>
                  )}
                  <div className="tk-formation-card-actions">
                    {!isActive && <button className="tk-formation-activate-btn" data-testid={`formation-panel-activate-btn-${f.id}`} onClick={() => handleActivate(f.id)}>激活</button>}
                    {isActive && <span className="tk-formation-active-badge">当前</span>}
                    <button className="tk-formation-edit-btn" onClick={() => setEditingId(isEditing ? null : f.id)}>{isEditing ? '收起' : '编辑'}</button>
                    <button className="tk-formation-delete-btn" onClick={() => handleDelete(f.id)}>✕</button>
                  </div>
                </div>
                <div className="tk-formation-power">战力: {getFormationPower(f).toLocaleString('zh-CN')}</div>
                {renderBonds(f)}
                {/* 编队槽位：前排/后排 */}
                <div className="tk-formation-slots">
                  <div className="tk-formation-row-label tk-formation-row-label--front">前排</div>
                  {f.slots.slice(0, 3).map((heroId: string, idx: number) => renderSlot(heroId, idx, f.id, true))}
                  <div className="tk-formation-row-label tk-formation-row-label--back">后排</div>
                  {f.slots.slice(3, 6).map((heroId: string, idx: number) => renderSlot(heroId, idx + 3, f.id, false))}
                </div>
                {/* 编辑模式 */}
                {isEditing && (
                  <div className="tk-formation-add-section">
                    <div className="tk-formation-add-label">
                      添加武将 ({members.length}/{MAX_SLOTS_PER_FORMATION})
                      <button className="tk-formation-auto-btn" data-testid={`formation-panel-auto-btn-${f.id}`}
                        onClick={() => handleAutoFormation(f.id)} disabled={availableGenerals.length === 0}
                        title="自动选择战力最高的武将填入编队">🤖 一键编队</button>
                    </div>
                    {members.length < MAX_SLOTS_PER_FORMATION && availableGenerals.length > 0 && (
                      <div className="tk-formation-add-list">
                        {availableGenerals.map((g) => {
                          const isDisp = !!dispatchSystem?.getHeroDispatchBuilding?.(g.id);
                          return (
                            <button key={g.id}
                              className={`tk-formation-add-hero${isDisp ? ' tk-formation-add-hero--dispatched' : ''}`}
                              style={{ borderColor: QUALITY_BORDER_COLORS[g.quality] }}
                              onClick={() => handleAddHero(f.id, g.id)}
                              title={isDisp ? `${g.name}（已派遣至建筑）` : undefined}>
                              {g.name}{isDisp && <span className="tk-formation-add-hero-dispatch">🏗️</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {availableGenerals.length === 0 && members.length < MAX_SLOTS_PER_FORMATION && (
                      <div className="tk-formation-add-empty">所有武将已在编队中</div>
                    )}
                    <div className="tk-formation-save-inline">
                      <FormationSaveSlot slots={savedSlots} onSave={handleSaveSlot}
                        onLoad={handleLoadSlot} onDelete={handleDeleteSlot} maxSlots={3} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <FormationSaveSlot slots={savedSlots} onSave={handleSaveSlot}
        onLoad={handleLoadSlot} onDelete={handleDeleteSlot} maxSlots={3} />
    </div>
  );
};

FormationPanel.displayName = 'FormationPanel';
export default FormationPanel;
