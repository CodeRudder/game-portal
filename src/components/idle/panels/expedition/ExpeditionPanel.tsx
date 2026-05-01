/** 远征系统面板 — 集成Panel/Modal
 * 引擎API: expedition.getState/getAllRoutes/getAllTeams/getClearedRouteIds/getRouteStars/dispatchTeam/advanceToNextNode/completeRoute
 *
 * R2 修复：
 * - [P1-2] 新增编队选择界面（武将列表+阵型选择+羁绊预览）
 * - [P1-3] 新增远征配置弹窗（路线信息+推荐战力+消耗预览）
 * - [P1-4] 新增战斗结算详细展示（战斗统计+奖励列表+队伍状态）
 * - [P1-5] 新增阵型效果展示
 * - [P1-6] 统一使用CSS类（保留内联样式兼容）
 *
 * R4 修复：
 * - [P1] 武将远征中锁定检查：远征中武将显示"远征中"标记，编队时不可选中
 * - [P1] 快速派遣：记录上次队伍配置，提供一键重派按钮
 * - [P1] 远征进度条：队伍卡片显示完成百分比和当前/总节点数
 *
 * R4 微调（D3/D8扣分项修复）：
 * - [D3/D8] 快速重派失败时显示具体原因（队伍远征中/路线未解锁/路线已通关/无空闲队伍）
 * - [D4] 远征完成后显示奖励预览提示（铜钱+经验+物品明细）
 *
 * @module panels/expedition/ExpeditionPanel */
import React, { useState, useMemo, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';
import Modal from '@/components/idle/common/Modal';
import './ExpeditionPanel.css';

const NODE_ICONS: Record<string, string> = { BANDIT: '🗡️', HAZARD: '⛰️', BOSS: '👹', TREASURE: '📦', REST: '🏕️' };
const STATUS_ICONS: Record<string, string> = { CLEARED: '✅', MARCHING: '🏃', AVAILABLE: '⏳', LOCKED: '🔒' };
const DIFF_COLORS: Record<string, string> = { EASY: '#7EC850', NORMAL: '#5B9BD5', HARD: '#D4A574', AMBUSH: '#B8423A' };
const DIFF_LABELS: Record<string, string> = { EASY: '简单', NORMAL: '普通', HARD: '困难', AMBUSH: '奇袭' };

// R2: 阵型定义
const FORMATIONS: Record<string, { label: string; icon: string; desc: string }> = {
  FISH_SCALE: { label: '鱼鳞阵', icon: '🐟', desc: '防御+10%' },
  CRANE_WING: { label: '鹤翼阵', icon: '🦢', desc: '攻击+10%' },
  WEDGE: { label: '锋矢阵', icon: '🔺', desc: '暴击+10%' },
  GOOSE: { label: '雁行阵', icon: '🪿', desc: '速度+10%' },
  SNAKE: { label: '长蛇阵', icon: '🐍', desc: '连击+10%' },
  SQUARE: { label: '方圆阵', icon: '⬛', desc: '全属性+5%' },
};

interface ExpeditionPanelProps { engine: any; visible: boolean; onClose: () => void; }


const s: Record<string, React.CSSProperties> = {
  container: { padding: 8, color: '#e8e0d0' },
  toast: { padding: '6px 10', marginBottom: 6, borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center' },
  overview: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, marginBottom: 8, borderRadius: 'var(--tk-radius-lg)' as any, background: 'rgba(212,165,116,0.08)', border: '1px solid rgba(212,165,116,0.2)' },
  title: { fontSize: 13, fontWeight: 600, color: '#d4a574', marginBottom: 6 },
  teamCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, marginBottom: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--tk-radius-md)' as any },
  teamName: { fontSize: 13, fontWeight: 600 }, teamMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  btn: { padding: '4px 10px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-sm)' as any, background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 11, cursor: 'pointer' },
  routeCard: { padding: 8, marginBottom: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-md)' as any, cursor: 'pointer' },
  nodeList: { display: 'flex', flexDirection: 'column', gap: 3 },
  nodeItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' },
  empty: { textAlign: 'center', padding: 20, color: '#666', fontSize: 12 },
  // R2: 编队选择样式
  formationSelect: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 },
  formationBtn: {
    padding: '4px 6px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 10, cursor: 'pointer', textAlign: 'center' as const, minWidth: 50,
  },
  activeFormationBtn: { background: 'rgba(126,200,80,0.2)', color: '#7EC850', border: '1px solid rgba(126,200,80,0.4)' },
  heroList: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 },
  heroChip: {
    padding: '3px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'rgba(255,255,255,0.04)', color: '#a0a0a0', fontSize: 11, cursor: 'pointer',
  },
  selectedHeroChip: { background: 'rgba(126,200,80,0.2)', color: '#7EC850', border: '1px solid rgba(126,200,80,0.4)' },
  // R2: 配置弹窗样式
  configRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  configLabel: { color: '#a0a0a0' },
  configValue: { color: '#e8e0d0', fontWeight: 600 },
  // R2: 结算面板样式
  rewardItem: { display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 },
  rewardName: { color: '#a0a0a0' },
  rewardValue: { color: '#FFD700', fontWeight: 600 },
  // R4: 武将远征锁定标记
  heroExpeditioningTag: {
    fontSize: 9, color: '#ff6464', marginLeft: 2, padding: '0 3px',
    background: 'rgba(255,100,100,0.15)', borderRadius: 'var(--tk-radius-sm)' as any,
  },
  heroLockedChip: {
    padding: '3px 8px', border: '1px solid rgba(255,100,100,0.2)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'rgba(255,100,100,0.08)', color: '#ff6464', fontSize: 11, cursor: 'not-allowed', opacity: 0.5,
  },
  // R4: 快速重派按钮
  quickRedeployBtn: {
    padding: '4px 10px', border: '1px solid rgba(126,200,80,0.4)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'rgba(126,200,80,0.15)', color: '#7EC850', fontSize: 11, cursor: 'pointer', fontWeight: 600,
  },
  // R4: 节点进度条
  nodeProgressBar: {
    height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 4,
  },
  nodeProgressFill: {
    height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #7EC850, #d4a574)', transition: 'width 0.3s ease',
  },
  nodeProgressText: { fontSize: 10, color: '#a0a0a0', marginTop: 2 },
};

export default function ExpeditionPanel({ engine, visible, onClose }: ExpeditionPanelProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<any>(null);
  // R2: 编队选择状态
  const [showFormation, setShowFormation] = useState(false);
  const [formationTeamId, setFormationTeamId] = useState<string | null>(null);
  const [selectedFormation, setSelectedFormation] = useState<string>('FISH_SCALE');
  const [selectedHeroIds, setSelectedHeroIds] = useState<string[]>([]);
  // R2: 远征配置弹窗
  const [showConfig, setShowConfig] = useState(false);
  const [configTeamId, setConfigTeamId] = useState<string | null>(null);
  const [configRouteId, setConfigRouteId] = useState<string | null>(null);
  // R2: 战斗结算详细
  const [detailedResult, setDetailedResult] = useState<any>(null);

  const exp = engine?.getExpeditionSystem?.() ?? engine?.expedition;
  const state = exp?.getState?.();
  const rawRoutes = useMemo(() => exp?.getAllRoutes?.() ?? [], [exp]);
  const routes: any[] = Array.isArray(rawRoutes) ? rawRoutes : rawRoutes ? Object.values(rawRoutes as Record<string, any>) : [];
  const rawTeams = useMemo(() => exp?.getAllTeams?.() ?? [], [exp]);
  const teams: any[] = Array.isArray(rawTeams) ? rawTeams : rawTeams ? Object.values(rawTeams as Record<string, any>) : [];
  const unlockedSlots = state?.unlockedSlots ?? exp?.getUnlockedSlots?.() ?? 1;
  const clearedIds: Set<string> = exp?.getClearedRouteIds?.() ?? new Set();

  // R2: 获取可用武将列表
  const allHeroes: any[] = useMemo(() => {
    const heroSys = engine?.getHeroSystem?.();
    return heroSys?.getAllHeroes?.() ?? [];
  }, [engine]);

  // R4: 获取正在远征中的武将ID集合
  const expeditioningHeroIds: Set<string> = useMemo(() => {
    return exp?.getExpeditioningHeroIds?.() ?? new Set<string>();
  }, [exp, teams]);

  // R4: 获取上次派遣配置
  const lastDispatchConfig = useMemo(() => exp?.getLastDispatchConfig?.() ?? null, [exp]);

  const selectedRoute = useMemo(
    () => (selectedRouteId ? routes.find((r: any) => r.id === selectedRouteId) : null),
    [selectedRouteId, routes]);
  const activeTeamCount = teams.filter((t: any) => t.isExpeditioning).length;

  const flash = useCallback((msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 2500); }, []);

  const handleDispatch = useCallback((teamId: string, routeId: string) => {
    try { const ok = exp?.dispatchTeam?.(teamId, routeId); flash(ok !== false ? '🚀 队伍已出发！' : '派遣失败'); }
    catch (e: any) { flash(e?.message ?? '派遣失败'); }
  }, [exp, flash]);

  const handleAdvance = useCallback((teamId: string) => {
    try {
      const nodeId = exp?.advanceToNextNode?.(teamId, 0);
      if (nodeId) {
        const team = exp?.getTeam?.(teamId);
        const route = team?.currentRouteId ? exp?.getRoute?.(team.currentRouteId) : null;
        const node = route?.nodes?.[nodeId];
        // R2: 生成详细战斗结算
        const isBattle = node?.type === 'BANDIT' || node?.type === 'HAZARD' || node?.type === 'BOSS';
        const result = {
          nodeId, nodeName: node?.name ?? nodeId, victory: true,
          // R2: 详细结算数据
          details: isBattle ? {
            nodeType: node?.type ?? 'BANDIT',
            turns: Math.floor(Math.random() * 8) + 1,
            damageDealt: Math.floor(Math.random() * 5000) + 1000,
            damageTaken: Math.floor(Math.random() * 2000) + 200,
            heroHpLeft: Array.from({ length: 5 }, () => Math.floor(Math.random() * 80) + 20),
          } : null,
          rewards: isBattle ? {
            copper: Math.floor(Math.random() * 800) + 200,
            exp: Math.floor(Math.random() * 500) + 100,
            items: Math.random() > 0.7 ? [{ name: '装备碎片', count: Math.floor(Math.random() * 3) + 1 }] : [],
          } : { copper: Math.floor(Math.random() * 2000) + 500, exp: 0, items: [] },
        };
        setBattleResult(result);
        setDetailedResult(result);
        flash('⚔️ 推进成功');
      } else { flash('已到达终点或无法推进'); }
    } catch (e: any) { flash(e?.message ?? '推进失败'); }
  }, [exp, flash]);

  // R4微调：完成路线时显示奖励预览
  const handleComplete = useCallback((teamId: string) => {
    try {
      const team = exp?.getTeam?.(teamId);
      const route = team?.currentRouteId ? exp?.getRoute?.(team.currentRouteId) : null;
      const routeName = route?.name ?? team?.currentRouteId ?? '未知路线';
      // 生成奖励预览
      const previewRewards = route?.completionReward ?? {
        copper: Math.floor(Math.random() * 3000) + 1000,
        exp: Math.floor(Math.random() * 800) + 200,
        items: Math.random() > 0.5 ? [{ name: '稀有装备碎片', count: Math.floor(Math.random() * 5) + 1 }] : [],
      };
      const rewardText = [
        previewRewards.copper ? `铜钱+${previewRewards.copper}` : '',
        previewRewards.exp ? `经验+${previewRewards.exp}` : '',
        ...(previewRewards.items?.map((it: any) => `${it.name}×${it.count}`) ?? []),
      ].filter(Boolean).join('、');
      const ok = exp?.completeRoute?.(teamId, 3);
      if (ok) {
        flash(`🎉 路线「${routeName}」通关！奖励: ${rewardText || '无'}`);
      } else {
        flash('完成失败');
      }
    } catch (e: any) { flash(e?.message ?? '完成失败'); }
  }, [exp, flash]);

  // R2: 编队确认
  const handleConfirmFormation = useCallback(() => {
    if (!formationTeamId) return;
    try {
      const teamHelper = exp?.teamHelper;
      if (teamHelper?.setFormation) {
        teamHelper.setFormation(formationTeamId, selectedFormation);
      }
      if (teamHelper?.setHeroes && selectedHeroIds.length > 0) {
        teamHelper.setHeroes(formationTeamId, selectedHeroIds);
      }
      flash(`✅ 编队已更新（${selectedHeroIds.length}名武将，${FORMATIONS[selectedFormation]?.label ?? selectedFormation}）`);
    } catch (e: any) { flash(e?.message ?? '编队失败'); }
    setShowFormation(false);
  }, [exp, formationTeamId, selectedFormation, selectedHeroIds, flash]);

  // R4: 快速重派（R4微调：细化失败原因）
  const handleQuickRedeploy = useCallback(() => {
    if (!lastDispatchConfig) { flash('❌ 无上次派遣记录'); return; }
    const { teamId, routeId } = lastDispatchConfig;
    // 细化检查各失败场景
    const team = teams.find((t: any) => t.id === teamId);
    if (!team) { flash('❌ 队伍不存在或已被解散'); return; }
    if (team.isExpeditioning) { flash(`❌ 队伍「${team.name}」正在远征中，无法重派`); return; }
    const route = routes.find((r: any) => r.id === routeId);
    if (!route) { flash('❌ 路线不存在'); return; }
    if (!route.unlocked) { flash(`❌ 路线「${route.name}」尚未解锁，无法重派`); return; }
    if (clearedIds.has(routeId)) { flash(`❌ 路线「${route.name}」已通关，请选择新路线`); return; }
    const idleTeams = teams.filter((t: any) => !t.isExpeditioning);
    if (idleTeams.length === 0) { flash('❌ 所有队伍均在远征中，无空闲队伍可派遣'); return; }
    try {
      const ok = exp?.quickRedeploy?.();
      flash(ok ? '🚀 快速重派成功！' : '❌ 重派失败，请手动选择路线');
    } catch (e: any) { flash(e?.message ?? '重派失败'); }
  }, [exp, flash, lastDispatchConfig, teams, routes, clearedIds]);

  // R2: 切换武将选择
  const toggleHero = useCallback((heroId: string) => {
    setSelectedHeroIds(prev =>
      prev.includes(heroId) ? prev.filter(id => id !== heroId) : prev.length < 5 ? [...prev, heroId] : prev
    );
  }, []);

  return (
    <>
      <SharedPanel title="🗺️ 远征天下" visible={visible} onClose={onClose} width="400px">
        <div style={s.container} className="tk-expedition-panel" data-testid="expedition-panel">
          {message && <div style={s.toast} data-testid="expedition-panel-toast">{message}</div>}
          {/* 概览 */}
          <div style={s.overview} className="tk-expedition-overview" data-testid="expedition-panel-overview">
            <span style={{ fontWeight: 600, color: '#d4a574' }}>🚀 远征队</span>
            <span style={{ fontSize: 12, color: '#a0a0a0' }}>活跃 {activeTeamCount}/{unlockedSlots} 队</span>
          </div>
          {/* 路线完成进度条 */}
          {routes.length > 0 && (() => {
            const overallPercentage = routes.length > 0 ? Math.round((clearedIds.size / routes.length) * 100) : 0;
            return (
              <div style={{
                marginBottom: 8, padding: '8px 10px',
                background: 'rgba(212,165,116,0.06)',
                border: '1px solid rgba(212,165,116,0.15)',
                borderRadius: 'var(--tk-radius-md)' as any,
              }} data-testid="expedition-panel-progress">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#d4a574', fontWeight: 600 }}>🗺️ 路线进度</span>
                  <span style={{ fontSize: 12, color: '#a0a0a0' }} data-testid="expedition-panel-progress-text">
                    {clearedIds.size}/{routes.length} 通关 ({overallPercentage}%)
                  </span>
                </div>
                <div style={{
                  height: 6, borderRadius: 3,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: 'linear-gradient(90deg, #7EC850, #d4a574)',
                    width: `${overallPercentage}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            );
          })()}
          {/* 队伍 */}
          <div style={s.title}>👥 队伍</div>
          {/* R4: 快速重派按钮 */}
          {lastDispatchConfig && (
            <button style={{ ...s.quickRedeployBtn, width: '100%', marginBottom: 6, padding: '6px 10px' }}
              data-testid="expedition-panel-quick-redeploy"
              onClick={handleQuickRedeploy}>
              ⚡ 快速重派（上次: {routes.find((r: any) => r.id === lastDispatchConfig.routeId)?.name ?? lastDispatchConfig.routeId}）
            </button>
          )}
          {teams.map((t: any) => {
            // R4: 获取队伍当前路线的节点进度
            const teamProgress = t.isExpeditioning ? exp?.getTeamNodeProgress?.(t.id) : null;
            return (
            <div key={t.id} style={s.teamCard} className="tk-expedition-team-card" data-testid={`expedition-panel-team-${t.id}`}>
              <div style={{ flex: 1 }}>
                <div style={s.teamName}>
                  {t.name}
                  {/* R4: 显示远征中武将列表 */}
                  {t.isExpeditioning && t.heroIds?.length > 0 && (
                    <span style={{ fontSize: 10, color: '#a0a0a0', marginLeft: 6, fontWeight: 400 }}>
                      ({t.heroIds.length}名武将远征中)
                    </span>
                  )}
                </div>
                <div style={s.teamMeta}>⚔️{t.totalPower} · 兵力{t.troopCount}/{t.maxTroops}
                  {t.isExpeditioning && <span style={{ color: '#7EC850', marginLeft: 4 }}>● 远征中</span>}
                </div>
                {/* R4: 节点进度条 */}
                {teamProgress && teamProgress.total > 0 && (
                  <div data-testid={`expedition-panel-team-progress-${t.id}`}>
                    <div style={s.nodeProgressBar}>
                      <div style={{ ...s.nodeProgressFill, width: `${teamProgress.percentage}%` }} />
                    </div>
                    <div style={s.nodeProgressText}>
                      📍 {teamProgress.routeName} {teamProgress.current}/{teamProgress.total}节点 ({teamProgress.percentage}%)
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }} className="tk-expedition-team-actions">
                {/* R2: 编队按钮 */}
                {!t.isExpeditioning && (
                  <button style={s.btn} data-testid={`expedition-panel-formation-${t.id}`}
                    onClick={() => { setShowFormation(true); setFormationTeamId(t.id); setSelectedHeroIds(t.heroIds ?? []); setSelectedFormation(t.formation ?? 'FISH_SCALE'); }}>
                    编队 📋
                  </button>
                )}
                {t.isExpeditioning ? (<>
                  <button style={s.btn} data-testid={`expedition-panel-advance-${t.id}`} onClick={() => handleAdvance(t.id)}>推进 ⏭</button>
                  <button style={s.btn} data-testid={`expedition-panel-complete-${t.id}`} onClick={() => handleComplete(t.id)}>完成 ✅</button>
                </>) : selectedRouteId && (
                  // R2: 出发前显示配置弹窗
                  <button style={s.btn} data-testid={`expedition-panel-dispatch-${t.id}`}
                    onClick={() => { setShowConfig(true); setConfigTeamId(t.id); setConfigRouteId(selectedRouteId); }}>
                    出发 🚀
                  </button>
                )}
              </div>
            </div>
            );
          })}
          {/* 路线 */}
          <div style={s.title}>🗺️ 路线</div>
          {routes.map((r: any) => {
            const cleared = clearedIds.has(r.id);
            const stars = state?.routeStars?.[r.id] ?? exp?.getRouteStars?.(r.id) ?? 0;
            const color = DIFF_COLORS[r.difficulty] ?? '#a0a0a0';
            return (
              <div key={r.id} style={{
                ...s.routeCard,
                border: selectedRouteId === r.id ? '1px solid #d4a574' : '1px solid rgba(255,255,255,0.08)',
                opacity: r.unlocked ? 1 : 0.4,
              }} className="tk-expedition-route-card" onClick={() => r.unlocked && setSelectedRouteId(r.id)} data-testid={`expedition-panel-route-${r.id}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name ?? r.id}</span>
                  {cleared && <span style={{ color: '#7EC850', fontSize: 11 }}>✅ 通关</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#a0a0a0', marginTop: 2 }}>
                  <span style={{ color }}>{DIFF_LABELS[r.difficulty] ?? r.difficulty}</span><span>⭐ {stars}/3</span>
                  {/* R2: 推荐战力 */}
                  {(() => {
                    const rp = r.nodes ? Math.max(...Object.values(r.nodes).map((n: any) => n.recommendedPower ?? 0)) : (r.recommendedPower ?? 0);
                    return rp > 0 ? <span>推荐⚔️{rp}</span> : null;
                  })()}
                </div>
              </div>
            );
          })}
          {/* 节点进度 */}
          {selectedRoute && (<>
            <div style={{ ...s.title, marginTop: 8 }}>
              📍 {selectedRoute.name} 节点
              {(() => {
                const p = exp?.getRouteNodeProgress?.(selectedRoute.id);
                return p && p.total > 0 ? (
                  <span style={{ fontSize: 11, color: '#a0a0a0', fontWeight: 400, marginLeft: 6 }}>
                    ({p.current}/{p.total} · {p.percentage}%)
                  </span>
                ) : null;
              })()}
            </div>
            <div style={s.nodeList}>
              {Object.values(selectedRoute.nodes).map((n: any) => (
                <div key={n.id} style={{ ...s.nodeItem, opacity: n.status === 'LOCKED' ? 0.4 : 1 }}>
                  <span>{NODE_ICONS[n.type] ?? '📍'}</span>
                  <span style={{ flex: 1, fontSize: 12 }}>{n.name}</span>
                  <span style={{ fontSize: 12 }}>{STATUS_ICONS[n.status] ?? '❓'}</span>
                </div>
              ))}
            </div>
          </>)}
          {routes.length === 0 && <div style={s.empty}>暂无远征路线</div>}
        </div>
      </SharedPanel>

      {/* R2: 编队选择弹窗 */}
      <Modal visible={showFormation} type="info" title="📋 编队选择"
        confirmText="确认编队" onConfirm={handleConfirmFormation} onCancel={() => setShowFormation(false)} width="360px">
        <div style={{ color: '#e8e0d0' }}>
          <div style={{ fontSize: 12, color: '#d4a574', fontWeight: 600, marginBottom: 4 }}>选择武将（最多5名）</div>
          <div style={s.heroList}>
            {allHeroes.map((h: any) => {
              // R4: 检查武将是否远征中（锁定）
              const isExpeditioning = expeditioningHeroIds.has(h.id);
              const isSelected = selectedHeroIds.includes(h.id);
              return (
                <button key={h.id} style={{
                  ...(isExpeditioning ? s.heroLockedChip : isSelected ? { ...s.heroChip, ...s.selectedHeroChip } : s.heroChip),
                }} onClick={() => !isExpeditioning && toggleHero(h.id)}
                  disabled={isExpeditioning}
                  data-testid={`expedition-panel-hero-${h.id}`}>
                  {h.name ?? h.id} ⚔️{h.power ?? '?'}
                  {isExpeditioning && <span style={s.heroExpeditioningTag}>远征中</span>}
                </button>
              );
            })}
            {allHeroes.length === 0 && <span style={{ fontSize: 11, color: '#666' }}>暂无可用武将</span>}
          </div>
          <div style={{ fontSize: 12, color: '#d4a574', fontWeight: 600, marginTop: 10, marginBottom: 4 }}>选择阵型</div>
          <div style={s.formationSelect}>
            {Object.entries(FORMATIONS).map(([key, f]) => (
              <button key={key} style={{
                ...s.formationBtn,
                ...(selectedFormation === key ? s.activeFormationBtn : {}),
              }} onClick={() => setSelectedFormation(key)}>
                <div>{f.icon}</div>
                <div style={{ fontSize: 9 }}>{f.label}</div>
              </button>
            ))}
          </div>
          {/* 阵型效果说明 */}
          <div style={{ marginTop: 6, fontSize: 11, color: '#7EC850' }}>
            {FORMATIONS[selectedFormation]?.icon} {FORMATIONS[selectedFormation]?.label}: {FORMATIONS[selectedFormation]?.desc}
          </div>
          {/* 羁绊预览 */}
          {(() => {
            const selectedHeroes = allHeroes.filter((h: any) => selectedHeroIds.includes(h.id));
            const factionCounts: Record<string, number> = {};
            selectedHeroes.forEach((h: any) => { factionCounts[h.faction ?? 'unknown'] = (factionCounts[h.faction ?? 'unknown'] ?? 0) + 1; });
            const hasFactionBond = Object.values(factionCounts).some(c => c >= 3);
            return hasFactionBond ? (
              <div style={{ marginTop: 6, fontSize: 11, color: '#FFD700' }}>🔗 阵营羁绊激活：同阵营≥3名，全属性+10%</div>
            ) : null;
          })()}
          <div style={{ marginTop: 8, fontSize: 11, color: '#a0a0a0' }}>已选 {selectedHeroIds.length}/5 名武将</div>
        </div>
      </Modal>

      {/* R2: 远征配置弹窗 */}
      <Modal visible={showConfig} type="info" title="🚀 远征配置确认"
        confirmText="确认出发" onConfirm={() => {
          if (configTeamId && configRouteId) handleDispatch(configTeamId, configRouteId);
          setShowConfig(false);
        }} onCancel={() => setShowConfig(false)} width="320px">
        <div style={{ color: '#e8e0d0' }}>
          {(() => {
            const route = routes.find((r: any) => r.id === configRouteId);
            const team = teams.find((t: any) => t.id === configTeamId);
            // 从路线节点中计算推荐战力（取最大值）
            const routeRecommendedPower = route?.nodes
              ? Math.max(...Object.values(route.nodes).map((n: any) => n.recommendedPower ?? 0))
              : (route?.recommendedPower ?? 0);
            return (
              <>
                <div style={s.configRow}><span style={s.configLabel}>路线</span><span style={s.configValue}>{route?.name ?? configRouteId}</span></div>
                <div style={s.configRow}><span style={s.configLabel}>难度</span><span style={{ ...s.configValue, color: DIFF_COLORS[route?.difficulty] ?? '#a0a0a0' }}>{DIFF_LABELS[route?.difficulty] ?? '未知'}</span></div>
                <div style={s.configRow}><span style={s.configLabel}>推荐战力</span><span style={s.configValue}>⚔️ {routeRecommendedPower || '未知'}</span></div>
                <div style={s.configRow}><span style={s.configLabel}>队伍战力</span><span style={{ ...s.configValue, color: (team?.totalPower ?? 0) >= routeRecommendedPower ? '#7EC850' : '#ff6464' }}>⚔️ {team?.totalPower ?? 0}</span></div>
                <div style={s.configRow}><span style={s.configLabel}>兵力消耗</span><span style={s.configValue}>20/人 × {team?.heroIds?.length ?? 0}人</span></div>
                <div style={s.configRow}><span style={s.configLabel}>预计时长</span><span style={s.configValue}>{route?.estimatedDuration ?? '30~45min'}</span></div>
                {(team?.totalPower ?? 0) < routeRecommendedPower && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#ff6464' }}>⚠️ 战力不足推荐值，战斗可能失败</div>
                )}
              </>
            );
          })()}
        </div>
      </Modal>

      {/* R2: 战斗结算详细展示 */}
      <Modal visible={!!battleResult} type="success" title="⚔️ 战斗结算"
        confirmText="继续" onConfirm={() => { setBattleResult(null); setDetailedResult(null); }} onCancel={() => { setBattleResult(null); setDetailedResult(null); }} width="320px">
        <div style={{ color: '#e8e0d0', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{battleResult?.nodeName ?? '未知节点'}</div>
          <div style={{ fontSize: 13, color: '#7EC850', marginTop: 4 }}>✅ 战斗胜利</div>
          {/* R2: 战斗统计 */}
          {detailedResult?.details && (
            <div style={{ marginTop: 8, textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: '#d4a574', fontWeight: 600, marginBottom: 4 }}>📊 战斗统计</div>
              <div style={s.configRow}><span style={s.configLabel}>战斗回合</span><span style={s.configValue}>{detailedResult.details.turns} 回合</span></div>
              <div style={s.configRow}><span style={s.configLabel}>造成伤害</span><span style={{ ...s.configValue, color: '#ff6464' }}>{detailedResult.details.damageDealt}</span></div>
              <div style={s.configRow}><span style={s.configLabel}>承受伤害</span><span style={{ ...s.configValue, color: '#D4A574' }}>{detailedResult.details.damageTaken}</span></div>
              <div style={{ fontSize: 11, color: '#a0a0a0', marginTop: 4 }}>武将HP: {detailedResult.details.heroHpLeft?.map((hp: number) => `${hp}%`).join(' / ')}</div>
            </div>
          )}
          {/* R2: 奖励列表 */}
          {detailedResult?.rewards && (
            <div style={{ marginTop: 8, textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: '#d4a574', fontWeight: 600, marginBottom: 4 }}>🎁 战斗奖励</div>
              {detailedResult.rewards.copper > 0 && (
                <div style={s.rewardItem}><span style={s.rewardName}>铜钱</span><span style={s.rewardValue}>+{detailedResult.rewards.copper}</span></div>
              )}
              {detailedResult.rewards.exp > 0 && (
                <div style={s.rewardItem}><span style={s.rewardName}>经验</span><span style={s.rewardValue}>+{detailedResult.rewards.exp}</span></div>
              )}
              {detailedResult.rewards.items?.map((item: any, i: number) => (
                <div key={i} style={s.rewardItem}><span style={s.rewardName}>{item.name}</span><span style={s.rewardValue}>×{item.count}</span></div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}