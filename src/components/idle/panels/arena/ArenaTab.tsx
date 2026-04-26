/**
 * ArenaTab — 竞技场主Tab面板
 *
 * 功能：排行榜、挑战对手、赛季信息、防守阵容、战斗记录
 * 使用 engine props 模式，与 EquipmentTab 一致。
 *
 * @module panels/arena/ArenaTab
 */
import React, { useState, useMemo, useCallback } from 'react';
import './ArenaTab.css';

// ─── Props ──────────────────────────────────
interface ArenaTabProps {
  engine: any;
  snapshotVersion?: number;
  /** 是否显示（弹窗模式） */
  visible?: boolean;
  /** 关闭回调（弹窗模式） */
  onClose?: () => void;
}

// ─── 段位配置 ────────────────────────────────
const RANK_TIERS: Record<string, { label: string; icon: string; color: string }> = {
  BRONZE: { label: '青铜', icon: '🥉', color: '#CD7F32' },
  SILVER: { label: '白银', icon: '🥈', color: '#C0C0C0' },
  GOLD: { label: '黄金', icon: '🥇', color: '#FFD700' },
  PLATINUM: { label: '铂金', icon: '💎', color: '#E5E4E2' },
  DIAMOND: { label: '钻石', icon: '💠', color: '#B9F2FF' },
  MASTER: { label: '大师', icon: '🔥', color: '#FF6B6B' },
  KING: { label: '王者', icon: '👑', color: '#FFD700' },
};

function getRankMeta(rankId: string) {
  const tier = (rankId ?? 'BRONZE_V').split('_')[0];
  const div = (rankId ?? 'BRONZE_V').split('_')[1] ?? '';
  const meta = RANK_TIERS[tier] ?? RANK_TIERS.BRONZE;
  return { ...meta, label: meta.label + (div ? ` ${div}` : '') };
}

// ─── 主组件 ─────────────────────────────────
const ArenaTab: React.FC<ArenaTabProps> = ({ engine, snapshotVersion, visible = true, onClose }) => {
  if (!visible) return null;
  const [message, setMessage] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<any>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [showDefense, setShowDefense] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ── 引擎子系统 ──
  const arenaSys = engine?.getArenaSystem?.() ?? engine?.arena;
  const seasonSys = engine?.getSeasonSystem?.() ?? engine?.season;
  const rankingSys = engine?.getRankingSystem?.() ?? engine?.ranking;

  // ── 玩家状态 ──
  const ps = useMemo(() => arenaSys?.getPlayerState?.() ?? arenaSys?.state ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arenaSys, snapshotVersion]);

  // ── 赛季数据 ──
  const season = useMemo(() => seasonSys?.getSeasonData?.() ?? seasonSys?.data ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seasonSys, snapshotVersion]);

  // ── 排行榜 ──
  const rankings = useMemo(() => rankingSys?.getTopRankings?.(10) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rankingSys, snapshotVersion]);

  // ── 派生数据 ──
  const rankMeta = getRankMeta(ps?.rankId);
  const opponents: any[] = ps?.opponents ?? [];
  const defenseLogs: any[] = ps?.defenseLogs ?? [];
  const seasonDaysLeft = season ? Math.max(0, Math.ceil((season.endTime - Date.now()) / 86400000)) : 0;

  // ── 操作 ──
  const flash = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2500);
  }, []);

  const handleChallenge = useCallback((oppId: string) => {
    if (!ps || (ps.dailyChallengesLeft ?? 0) <= 0) return flash('⚔️ 今日挑战次数不足，请明日再来或购买额外次数');
    try {
      if (!arenaSys?.executeBattle) {
        flash('竞技场系统维护中，请稍后再试');
        return;
      }
      const result = arenaSys.executeBattle(oppId);
      setBattleResult(result);
    } catch (e: any) {
      flash(e?.message ?? '挑战失败');
    }
  }, [ps, arenaSys, flash]);

  const handleRefresh = useCallback(() => {
    try {
      const allPlayers = arenaSys?.getAllPlayers?.() ?? [];
      arenaSys?.freeRefresh?.(ps, allPlayers, Date.now());
      flash('对手已刷新');
    } catch (e: any) {
      flash(e?.message ?? '刷新失败');
    }
  }, [arenaSys, ps, flash]);

  const handleBuyChallenge = useCallback(() => {
    try {
      const r = arenaSys?.buyChallenge?.(ps);
      if (r) flash(`购买成功，消耗${r.cost}元宝`);
    } catch (e: any) {
      flash(e?.message ?? '购买失败');
    }
  }, [arenaSys, ps, flash]);

  // ── 渲染 ──
  return (
    <div style={S.container} data-testid="arena-tab">
      {/* 赛季信息条 */}
      <div style={S.seasonBar}>
        <div style={S.rankBadge}>
          <span style={{ color: rankMeta.color }}>{rankMeta.icon} {rankMeta.label}</span>
        </div>
        <div style={S.scoreRow}>
          <span>积分 <b>{ps?.score ?? 0}</b></span>
          <span>排名 <b>#{ps?.ranking || '—'}</b></span>
        </div>
        {season && (
          <div style={S.seasonInfo}>
            🏆 赛季{season.seasonId} · 第{season.currentDay}天 · 剩余{seasonDaysLeft}天
          </div>
        )}
        <div style={S.challengeRow}>
          <span>今日挑战: <b style={{ color: (ps?.dailyChallengesLeft ?? 0) > 0 ? '#7EC850' : '#ff6464' }}>
            {ps?.dailyChallengesLeft ?? 0}次
          </b></span>
          <button style={S.buyBtn} onClick={handleBuyChallenge}>+购买</button>
        </div>
        <div style={S.coinRow}>🪙 竞技币：{ps?.arenaCoins ?? 0}</div>
      </div>

      {/* 消息条 */}
      {message && <div style={S.toast}>{message}</div>}

      {/* 对手列表 */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <span>⚔️ 挑战对手</span>
          <button style={S.refreshBtn} onClick={handleRefresh}>🔄 刷新</button>
        </div>
        {opponents.length > 0 ? (
          <div style={S.oppList}>
            {opponents.map((opp: any) => {
              const oppRank = getRankMeta(opp.rankId);
              return (
                <div key={opp.playerId} style={S.oppCard}>
                  <div style={S.oppInfo}>
                    <div style={S.oppName}>{opp.playerName ?? '对手'}</div>
                    <div style={S.oppMeta}>
                      <span style={{ color: oppRank.color }}>{oppRank.icon} {oppRank.label}</span>
                      <span>⚔️ {opp.power ?? '?'}</span>
                      <span>排名 #{opp.ranking ?? '?'}</span>
                    </div>
                  </div>
                  <button
                    className={`tk-arena-challenge-btn ${((ps?.dailyChallengesLeft ?? 0) <= 0) ? 'tk-arena-challenge-btn--disabled' : ''}`}
                    style={S.challengeBtn}
                    disabled={(ps?.dailyChallengesLeft ?? 0) <= 0}
                    onClick={() => handleChallenge(opp.playerId)}
                  >挑战</button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={S.empty}>暂无对手，请刷新</div>
        )}
      </div>

      {/* 功能按钮 */}
      <div style={S.actionBar} className="tk-arena-actions">
        <button style={S.actionBtn} className="tk-arena-action-btn" onClick={() => setShowRanking(true)}>📊 排行榜</button>
        <button style={S.actionBtn} className="tk-arena-action-btn" onClick={() => setShowDefense(true)}>🛡️ 防守阵容</button>
        <button style={S.actionBtn} className="tk-arena-action-btn" onClick={() => setShowHistory(true)}>📜 战斗记录</button>
      </div>

      {/* ── 弹窗：战斗结果 ── */}
      {battleResult && (
        <div style={S.overlay} onClick={() => setBattleResult(null)}>
          <div style={S.modal} className="tk-arena-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 28, textAlign: 'center' }}>
              {battleResult.victory ? '🎉 胜利' : '😤 失败'}
            </div>
            <div style={{ textAlign: 'center', color: '#a0a0a0', marginTop: 8 }}>
              积分变化: <span style={{ color: battleResult.victory ? '#7EC850' : '#ff6464' }}>
                {battleResult.victory ? '+' : ''}{battleResult.scoreChange}
              </span>
            </div>
            <button style={S.modalBtn} onClick={() => setBattleResult(null)}>确定</button>
          </div>
        </div>
      )}

      {/* ── 弹窗：排行榜 ── */}
      {showRanking && (
        <div style={S.overlay} onClick={() => setShowRanking(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>📊 排行榜</div>
            {rankings.length > 0 ? (
              <div style={S.rankList}>
                {rankings.map((r: any, i: number) => (
                  <div key={r.playerId ?? i} style={S.rankItem}>
                    <span style={{ ...S.rankNum, color: i < 3 ? '#FFD700' : '#a0a0a0' }}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : `${i + 1}`}
                    </span>
                    <span style={{ flex: 1 }}>{r.playerName ?? `玩家${i + 1}`}</span>
                    <span style={{ color: '#a0a0a0' }}>⚔️ {r.power ?? '-'}</span>
                    <span style={{ color: '#d4a574', marginLeft: 8 }}>{r.score ?? 0}分</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={S.empty}>暂无排行数据</div>
            )}
            <button style={S.modalBtn} onClick={() => setShowRanking(false)}>关闭</button>
          </div>
        </div>
      )}

      {/* ── 弹窗：防守阵容 ── */}
      {showDefense && (
        <div style={S.overlay} onClick={() => setShowDefense(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>🛡️ 防守阵容</div>
            <div style={{ fontSize: 13, color: '#a0a0a0', marginBottom: 8 }}>
              阵型: {ps?.defenseFormation?.formation ?? '鱼鳞阵'} · 策略: {ps?.defenseFormation?.strategy ?? '均衡'}
            </div>
            <div style={S.formationSlots}>
              {(ps?.defenseFormation?.slots ?? ['','','','','']).map((heroId: string, i: number) => (
                <div key={i} style={{
                  ...S.slot,
                  ...(heroId ? { border: '1px solid #d4a574', background: 'rgba(212,165,116,0.1)' } : {}),
                }}>
                  {heroId ? `武将${i + 1}` : `空位${i + 1}`}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 8, textAlign: 'center' }}>
              防守统计: {defenseLogs.length}场 ·
              胜{defenseLogs.filter((l: any) => l.defenderWon).length}场
            </div>
            <button style={S.modalBtn} onClick={() => setShowDefense(false)}>关闭</button>
          </div>
        </div>
      )}

      {/* ── 弹窗：战斗记录 ── */}
      {showHistory && (
        <div style={S.overlay} onClick={() => setShowHistory(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>📜 战斗记录</div>
            {defenseLogs.length > 0 ? (
              <div style={S.logList}>
                {defenseLogs.slice(0, 5).map((log: any) => (
                  <div key={log.id} style={S.logItem}>
                    <span>{log.attackerName ?? '未知'}</span>
                    <span style={{ color: log.defenderWon ? '#7EC850' : '#ff6464' }}>
                      {log.defenderWon ? '防守成功' : '防守失败'}
                    </span>
                    <span style={{ color: '#666' }}>{log.turns ?? '?'}回合</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={S.empty}>暂无战斗记录</div>
            )}
            <button style={S.modalBtn} onClick={() => setShowHistory(false)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArenaTab;

// ─── 样式 ───────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  container: { padding: 12, color: '#e8e0d0', minHeight: '100%' },
  seasonBar: {
    padding: 12, marginBottom: 10, borderRadius: 'var(--tk-radius-lg)' as any,
    background: 'linear-gradient(135deg, rgba(212,165,116,0.12), rgba(255,215,0,0.08))',
    border: '1px solid rgba(212,165,116,0.2)',
  },
  rankBadge: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  scoreRow: { display: 'flex', gap: 16, fontSize: 13, color: '#a0a0a0', marginBottom: 4 },
  seasonInfo: { fontSize: 11, color: '#a0a0a0', marginBottom: 4 },
  challengeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, marginBottom: 4 },
  buyBtn: {
    padding: '3px 10px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'rgba(212,165,116,0.1)', color: '#d4a574', fontSize: 11, cursor: 'pointer',
  },
  coinRow: { fontSize: 12, color: '#C9A84C' },
  toast: {
    padding: '6px 12px', marginBottom: 8, borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center',
  },
  section: { marginBottom: 10 },
  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 14, fontWeight: 600, color: '#d4a574', marginBottom: 8,
  },
  refreshBtn: {
    padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-sm)' as any,
    background: 'transparent', color: '#a0a0a0', fontSize: 11, cursor: 'pointer',
  },
  oppList: { display: 'flex', flexDirection: 'column', gap: 6 },
  oppCard: {
    display: 'flex', alignItems: 'center', gap: 8, padding: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--tk-radius-lg)' as any,
  },
  oppInfo: { flex: 1, minWidth: 0 },
  oppName: { fontSize: 14, fontWeight: 600, color: '#e8e0d0' },
  oppMeta: { display: 'flex', gap: 8, fontSize: 11, color: '#a0a0a0', marginTop: 2 },
  challengeBtn: {
    padding: '6px 16px', border: 'none', borderRadius: 'var(--tk-radius-md)' as any,
    background: '#B8423A', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  disabled: { opacity: 0.4, cursor: 'not-allowed' },
  empty: { textAlign: 'center', padding: 20, color: '#666', fontSize: 13 },
  actionBar: { display: 'flex', gap: 8, marginBottom: 10 },
  actionBtn: {
    flex: 1, padding: '8px 0', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'rgba(212,165,116,0.1)', color: '#d4a574', fontSize: 12, cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--tk-z-modal)' as any,
  },
  modal: {
    background: '#1a1a2e', border: '1px solid #d4a574', borderRadius: 'var(--tk-radius-xl)' as any,
    padding: 20, minWidth: 280, maxWidth: 400, color: '#e8e0d0',
  },
  modalTitle: { fontSize: 16, fontWeight: 600, color: '#d4a574', marginBottom: 12, textAlign: 'center' },
  modalBtn: {
    display: 'block', margin: '14px auto 0', padding: '8px 24px',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-md)' as any,
    background: 'transparent', color: '#a0a0a0', cursor: 'pointer',
  },
  rankList: { display: 'flex', flexDirection: 'column', gap: 4 },
  rankItem: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
    fontSize: 13, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--tk-radius-sm)' as any,
  },
  rankNum: { width: 28, textAlign: 'center', fontWeight: 600 },
  formationSlots: { display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' },
  slot: {
    width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 'var(--tk-radius-lg)' as any, fontSize: 11, color: '#666',
  },
  logList: { display: 'flex', flexDirection: 'column', gap: 4 },
  logItem: {
    display: 'flex', justifyContent: 'space-between', padding: '6px 8px',
    fontSize: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--tk-radius-sm)' as any,
  },
};
