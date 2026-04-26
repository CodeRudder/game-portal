/** 远征系统面板 — 集成Panel/Modal
 * 引擎API: expedition.getState/getAllRoutes/getAllTeams/getClearedRouteIds/getRouteStars/dispatchTeam/advanceToNextNode/completeRoute
 * @module panels/expedition/ExpeditionPanel */
import React, { useState, useMemo, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';
import Modal from '@/components/idle/common/Modal';
import './ExpeditionPanel.css';

const NODE_ICONS: Record<string, string> = { BANDIT: '🗡️', HAZARD: '⛰️', BOSS: '👹', TREASURE: '📦', REST: '🏕️' };
const STATUS_ICONS: Record<string, string> = { CLEARED: '✅', MARCHING: '🏃', AVAILABLE: '⏳', LOCKED: '🔒' };
const DIFF_COLORS: Record<string, string> = { EASY: '#7EC850', NORMAL: '#5B9BD5', HARD: '#D4A574', AMBUSH: '#B8423A' };
const DIFF_LABELS: Record<string, string> = { EASY: '简单', NORMAL: '普通', HARD: '困难', AMBUSH: '奇袭' };

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
};

export default function ExpeditionPanel({ engine, visible, onClose }: ExpeditionPanelProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<any>(null);

  const exp = engine?.getExpeditionSystem?.() ?? engine?.expedition;
  const state = exp?.getState?.();
  const rawRoutes = useMemo(() => exp?.getAllRoutes?.() ?? [], [exp]);
  const routes: any[] = Array.isArray(rawRoutes) ? rawRoutes : rawRoutes ? Object.values(rawRoutes as Record<string, any>) : [];
  const rawTeams = useMemo(() => exp?.getAllTeams?.() ?? [], [exp]);
  const teams: any[] = Array.isArray(rawTeams) ? rawTeams : rawTeams ? Object.values(rawTeams as Record<string, any>) : [];
  const unlockedSlots = state?.unlockedSlots ?? exp?.getUnlockedSlots?.() ?? 1;
  const clearedIds: Set<string> = exp?.getClearedRouteIds?.() ?? new Set();

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
        setBattleResult({ nodeId, nodeName: node?.name ?? nodeId, victory: true });
        flash('⚔️ 推进成功');
      } else { flash('已到达终点或无法推进'); }
    } catch (e: any) { flash(e?.message ?? '推进失败'); }
  }, [exp, flash]);

  const handleComplete = useCallback((teamId: string) => {
    try { const ok = exp?.completeRoute?.(teamId, 3); flash(ok ? '🎉 路线通关！' : '完成失败'); }
    catch (e: any) { flash(e?.message ?? '完成失败'); }
  }, [exp, flash]);

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
          {routes.length > 0 && (
            <div style={{
              marginBottom: 8, padding: '8px 10px',
              background: 'rgba(212,165,116,0.06)',
              border: '1px solid rgba(212,165,116,0.15)',
              borderRadius: 'var(--tk-radius-md)' as any,
            }} data-testid="expedition-panel-progress">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#d4a574', fontWeight: 600 }}>🗺️ 路线进度</span>
                <span style={{ fontSize: 12, color: '#a0a0a0' }} data-testid="expedition-panel-progress-text">
                  {clearedIds.size}/{routes.length} 通关
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
                  width: `${routes.length > 0 ? (clearedIds.size / routes.length) * 100 : 0}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          )}
          {/* 队伍 */}
          <div style={s.title}>👥 队伍</div>
          {teams.map((t: any) => (
            <div key={t.id} style={s.teamCard} className="tk-expedition-team-card" data-testid={`expedition-panel-team-${t.id}`}>
              <div style={{ flex: 1 }}>
                <div style={s.teamName}>{t.name}</div>
                <div style={s.teamMeta}>⚔️{t.totalPower} · 兵力{t.troopCount}/{t.maxTroops}
                  {t.isExpeditioning && <span style={{ color: '#7EC850', marginLeft: 4 }}>● 远征中</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }} className="tk-expedition-team-actions">
                {t.isExpeditioning ? (<>
                  <button style={s.btn} data-testid={`expedition-panel-advance-${t.id}`} onClick={() => handleAdvance(t.id)}>推进 ⏭</button>
                  <button style={s.btn} data-testid={`expedition-panel-complete-${t.id}`} onClick={() => handleComplete(t.id)}>完成 ✅</button>
                </>) : selectedRouteId && (
                  <button style={s.btn} data-testid={`expedition-panel-dispatch-${t.id}`} onClick={() => handleDispatch(t.id, selectedRouteId)}>出发 🚀</button>
                )}
              </div>
            </div>
          ))}
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
                </div>
              </div>
            );
          })}
          {/* 节点进度 */}
          {selectedRoute && (<>
            <div style={{ ...s.title, marginTop: 8 }}>📍 {selectedRoute.name} 节点</div>
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
      <Modal visible={!!battleResult} type="success" title="⚔️ 节点战斗"
        confirmText="继续" onConfirm={() => setBattleResult(null)} onCancel={() => setBattleResult(null)} width="280px">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14 }}>{battleResult?.nodeName ?? '未知节点'}</div>
          <div style={{ fontSize: 13, color: '#7EC850', marginTop: 4 }}>✅ 战斗胜利</div>
        </div>
      </Modal>
    </>
  );
}