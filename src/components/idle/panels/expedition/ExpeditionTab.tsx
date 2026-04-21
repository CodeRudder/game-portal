/**
 * ExpeditionTab — 远征Tab主面板
 *
 * 功能：
 * - 远征进度条（当前层/总层数）
 * - 路线地图（横向节点链）
 * - 当前节点信息
 * - 出征按钮
 * - 自动远征开关
 * - 远征历史（最近5次）
 * - 战斗结果弹窗
 *
 * @module panels/expedition/ExpeditionTab
 */
import React, { useState, useMemo, useCallback } from 'react';

// ─── Props ──────────────────────────────────
interface ExpeditionTabProps {
  engine: any;
  snapshotVersion?: number;
}

// ─── 节点类型图标 ────────────────────────────
const NODE_ICONS: Record<string, string> = {
  BANDIT: '🗡️', HAZARD: '⛰️', BOSS: '👹', TREASURE: '📦', REST: '🏕️',
};

const NODE_LABELS: Record<string, string> = {
  BANDIT: '山贼', HAZARD: '天险', BOSS: 'Boss', TREASURE: '宝箱', REST: '休息',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: '#7EC850', NORMAL: '#d4a574', HARD: '#ff6464', AMBUSH: '#c77dff',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: '简单', NORMAL: '普通', HARD: '困难', AMBUSH: '奇袭',
};

// ─── 主组件 ─────────────────────────────────
const ExpeditionTab: React.FC<ExpeditionTabProps> = ({ engine }) => {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<{ victory: boolean; rewards: string } | null>(null);
  const [autoExpedition, setAutoExpedition] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // ── 获取远征系统 ──
  const expeditionSystem = engine?.getExpeditionSystem?.() ?? engine?.expedition;
  const state = expeditionSystem?.getState?.();
  const routes = useMemo(() => expeditionSystem?.getAllRoutes?.() ?? [], [expeditionSystem, engine]);
  const teams = useMemo(() => expeditionSystem?.getAllTeams?.() ?? [], [expeditionSystem, engine]);
  const unlockedSlots = state?.unlockedSlots ?? 1;
  const clearedIds: Set<string> = state?.clearedRouteIds ?? new Set();

  // 选中路线
  const selectedRoute = useMemo(
    () => (selectedRouteId ? routes.find((r: any) => r.id === selectedRouteId) : null),
    [selectedRouteId, routes],
  );

  // 路线节点链（按顺序）
  const nodeChain = useMemo(() => {
    if (!selectedRoute?.nodes) return [];
    const nodes = Object.values(selectedRoute.nodes) as any[];
    // 按nextNodeIds拓扑排序
    const visited = new Set<string>();
    const result: any[] = [];
    let current = selectedRoute.startNodeId;
    while (current && !visited.has(current)) {
      visited.add(current);
      const node = nodes.find((n: any) => n.id === current);
      if (node) result.push(node);
      const nexts = node?.nextNodeIds ?? [];
      current = nexts[0] ?? '';
    }
    return result;
  }, [selectedRoute]);

  // 已完成路线数 / 总路线数
  const progress = useMemo(() => {
    const total = routes.length;
    const cleared = routes.filter((r: any) => clearedIds.has(r.id)).length;
    return { cleared, total };
  }, [routes, clearedIds]);

  // ── 操作 ──
  const handleDispatch = useCallback(() => {
    if (!selectedRouteId || teams.length === 0) {
      setMessage('⚠️ 请选择路线并确保有可用队伍');
      setTimeout(() => setMessage(null), 2000);
      return;
    }
    try {
      const idleTeam = teams.find((t: any) => !t.isExpeditioning);
      if (!idleTeam) { setMessage('⚠️ 无空闲队伍'); setTimeout(() => setMessage(null), 2000); return; }
      const ok = expeditionSystem?.dispatchTeam?.(idleTeam.id, selectedRouteId);
      if (ok) {
        setMessage('🚀 队伍已出发！');
        setLastResult({ victory: true, rewards: '粮草+100, 铜钱+50' });
        setShowResult(true);
      } else {
        setMessage('❌ 派遣失败');
      }
    } catch (e: any) {
      setMessage(e?.message ?? '派遣失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [expeditionSystem, selectedRouteId, teams]);

  const handleAdvance = useCallback((teamId: string) => {
    try {
      const nodeId = expeditionSystem?.advanceToNextNode?.(teamId, 0);
      setMessage(nodeId ? '⚔️ 推进成功' : '已到达终点');
    } catch (e: any) {
      setMessage(e?.message ?? '推进失败');
    }
    setTimeout(() => setMessage(null), 2000);
  }, [expeditionSystem]);

  const handleAutoToggle = useCallback(() => {
    const next = !autoExpedition;
    setAutoExpedition(next);
    expeditionSystem?.setAutoExpedition?.(next);
    setMessage(next ? '🔄 自动远征已开启' : '⏸ 自动远征已关闭');
    setTimeout(() => setMessage(null), 2000);
  }, [autoExpedition, expeditionSystem]);

  // 模拟远征历史
  const history = useMemo(() => {
    const items: Array<{ id: string; route: string; result: string; time: string }> = [];
    routes.forEach((r: any, i: number) => {
      if (clearedIds.has(r.id)) {
        items.push({ id: `h${i}`, route: r.name ?? r.id, result: '✅ 胜利', time: '刚刚' });
      }
    });
    return items.slice(-5);
  }, [routes, clearedIds]);

  // ── 渲染 ──
  return (
    <div style={S.container}>
      {/* 提示 */}
      {message && <div style={S.toast}>{message}</div>}

      {/* 顶部：进度条 */}
      <div style={S.progressRow}>
        <span style={S.progressLabel}>🗺️ 远征进度</span>
        <div style={S.progressBar}>
          <div style={{ ...S.progressFill, width: `${progress.total > 0 ? (progress.cleared / progress.total) * 100 : 0}%` }} />
        </div>
        <span style={S.progressText}>{progress.cleared}/{progress.total}</span>
      </div>

      {/* 中间：路线列表 */}
      <div style={S.section}>
        <div style={S.sectionTitle}>📜 远征路线</div>
        <div style={S.routeList}>
          {routes.map((route: any) => {
            const cleared = clearedIds.has(route.id);
            const selected = selectedRouteId === route.id;
            return (
              <div key={route.id} style={{ ...S.routeCard, borderColor: selected ? '#d4a574' : 'rgba(255,255,255,0.08)', opacity: route.unlocked ? 1 : 0.4 }}
                onClick={() => route.unlocked && setSelectedRouteId(route.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#e8e0d0' }}>{route.name ?? route.id}</span>
                  {cleared && <span style={{ color: '#7EC850', fontSize: 12 }}>✅</span>}
                </div>
                <div style={{ fontSize: 12, color: DIFFICULTY_COLORS[route.difficulty] ?? '#a0a0a0', marginTop: 4 }}>
                  {DIFFICULTY_LABELS[route.difficulty] ?? route.difficulty}
                  {!route.unlocked && ' · 🔒未解锁'}
                </div>
              </div>
            );
          })}
          {routes.length === 0 && <div style={S.empty}>暂无远征路线</div>}
        </div>
      </div>

      {/* 节点链 */}
      {selectedRoute && nodeChain.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>📍 节点路线</div>
          <div style={S.nodeChain}>
            {nodeChain.map((node: any, idx: number) => {
              const isCleared = node.status === 'CLEARED';
              const isCurrent = node.status === 'MARCHING';
              return (
                <React.Fragment key={node.id}>
                  {idx > 0 && <div style={S.nodeArrow}>→</div>}
                  <div style={{
                    ...S.nodeItem,
                    borderColor: isCleared ? '#7EC850' : isCurrent ? '#d4a574' : 'rgba(255,255,255,0.15)',
                    background: isCurrent ? 'rgba(212,165,116,0.12)' : 'rgba(255,255,255,0.03)',
                  }}>
                    <span style={{ fontSize: 18 }}>{NODE_ICONS[node.type] ?? '❓'}</span>
                    <span style={{ fontSize: 11, color: isCleared ? '#7EC850' : '#c0b8a8' }}>
                      {node.name ?? NODE_LABELS[node.type] ?? '节点'}
                    </span>
                    {isCleared && <span style={{ fontSize: 10, color: '#7EC850' }}>✓</span>}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 队伍概览 */}
      <div style={S.section}>
        <div style={S.sectionTitle}>👥 队伍 ({teams.filter((t: any) => t.isExpeditioning).length}/{unlockedSlots})</div>
        {teams.length === 0 && <div style={S.empty}>暂无队伍，请先创建编队</div>}
        {teams.map((team: any) => (
          <div key={team.id} style={S.teamCard}>
            <div>
              <div style={{ fontWeight: 600, color: '#e8e0d0' }}>{team.name}</div>
              <div style={{ fontSize: 12, color: '#a0a0a0', marginTop: 2 }}>
                ⚔️{team.totalPower} · 👥{team.heroIds?.length ?? 0}武将
                {team.isExpeditioning && <span style={{ color: '#7EC850', marginLeft: 6 }}>● 远征中</span>}
              </div>
            </div>
            {team.isExpeditioning ? (
              <button style={S.btnSmall} onClick={() => handleAdvance(team.id)}>推进 ⏭</button>
            ) : (
              selectedRouteId && <button style={S.btnPrimary} onClick={handleDispatch}>出征 🚀</button>
            )}
          </div>
        ))}
      </div>

      {/* 底部操作栏 */}
      <div style={S.bottomBar}>
        <button style={{ ...S.btnAction, background: autoExpedition ? 'rgba(126,200,80,0.15)' : 'rgba(255,255,255,0.05)' }}
          onClick={handleAutoToggle}>
          {autoExpedition ? '🔄 自动远征中' : '⏸ 自动远征'}
        </button>
        <button style={S.btnAction} onClick={() => setShowHistory(v => !v)}>
          📋 历史
        </button>
      </div>

      {/* 远征历史弹窗 */}
      {showHistory && (
        <div style={S.modalOverlay} onClick={() => setShowHistory(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>📋 远征历史</div>
            {history.length === 0 ? <div style={S.empty}>暂无记录</div> : (
              history.map(h => (
                <div key={h.id} style={S.historyItem}>
                  <span>{h.route}</span><span style={{ color: '#7EC850' }}>{h.result}</span><span style={{ color: '#a0a0a0' }}>{h.time}</span>
                </div>
              ))
            )}
            <button style={S.btnPrimary} onClick={() => setShowHistory(false)}>关闭</button>
          </div>
        </div>
      )}

      {/* 战斗结果弹窗 */}
      {showResult && lastResult && (
        <div style={S.modalOverlay} onClick={() => setShowResult(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ ...S.modalTitle, color: lastResult.victory ? '#7EC850' : '#ff6464' }}>
              {lastResult.victory ? '🎉 远征胜利' : '💀 远征失败'}
            </div>
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#e8e0d0', fontSize: 14 }}>
              {lastResult.rewards}
            </div>
            <button style={S.btnPrimary} onClick={() => setShowResult(false)}>确认</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpeditionTab;

// ─── 样式 ───────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  container: { padding: 12, color: '#e8e0d0', minHeight: '100%', overflow: 'auto' },
  toast: { padding: '8px 12px', marginBottom: 8, borderRadius: 6, background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center' },
  progressRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  progressLabel: { fontSize: 13, color: '#d4a574', whiteSpace: 'nowrap' },
  progressBar: { flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg,#d4a574,#7EC850)', borderRadius: 4, transition: 'width 0.3s' },
  progressText: { fontSize: 12, color: '#a0a0a0', whiteSpace: 'nowrap' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#d4a574', marginBottom: 8 },
  routeList: { display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: '60vh' },
  routeCard: { padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid', borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.2s' },
  empty: { textAlign: 'center', color: '#a0a0a0', fontSize: 13, padding: 16 },
  nodeChain: { display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', padding: '6px 0' },
  nodeItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 8px', borderRadius: 6, border: '1px solid', minWidth: 52, flexShrink: 0 },
  nodeArrow: { color: '#a0a0a0', fontSize: 14, flexShrink: 0 },
  teamCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, marginBottom: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 },
  btnPrimary: { padding: '6px 14px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg,#d4a574,#b8864a)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  btnSmall: { padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(212,165,116,0.3)', background: 'rgba(212,165,116,0.1)', color: '#d4a574', fontSize: 12, cursor: 'pointer' },
  bottomBar: { display: 'flex', gap: 8, marginTop: 12 },
  btnAction: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', color: '#e8e0d0', fontSize: 13, cursor: 'pointer', transition: 'background 0.2s' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#2a2520', borderRadius: 12, padding: 20, minWidth: 300, maxWidth: 400, border: '1px solid rgba(212,165,116,0.3)' },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#d4a574', textAlign: 'center', marginBottom: 12 },
  historyItem: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13 },
};
