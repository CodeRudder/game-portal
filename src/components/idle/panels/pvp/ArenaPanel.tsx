/** PvP竞技场面板 — 集成Panel/Modal
 * 引擎API: arena.getPlayerState/freeRefresh/manualRefresh/canChallenge/consumeChallenge/buyChallenge
 *          battle.executeBattle/applyBattleResult
 * @module panels/pvp/ArenaPanel */
import React, { useState, useMemo, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';
import Modal from '@/components/idle/common/Modal';

const RANK_META: Record<string, { label: string; icon: string; color: string }> = {
  BRONZE: { label: '青铜', icon: '🥉', color: '#CD7F32' }, SILVER: { label: '白银', icon: '🥈', color: '#C0C0C0' },
  GOLD: { label: '黄金', icon: '🥇', color: '#FFD700' }, PLATINUM: { label: '铂金', icon: '💎', color: '#E5E4E2' },
  DIAMOND: { label: '钻石', icon: '💠', color: '#B9F2FF' }, MASTER: { label: '大师', icon: '🔥', color: '#FF6B6B' },
  KING: { label: '王者', icon: '👑', color: '#FFD700' },
};
const DIV_LABELS: Record<string, string> = { I: 'I', II: 'II', III: 'III', IV: 'IV', V: 'V' };

function parseRank(rankId: string) {
  const tier = rankId.split('_')[0] ?? 'BRONZE';
  const div = rankId.split('_')[1] ?? '';
  const m = RANK_META[tier] ?? RANK_META.BRONZE;
  return { ...m, full: m.label + (div ? ` ${DIV_LABELS[div] ?? div}` : '') };
}

interface ArenaPanelProps { engine: any; visible: boolean; onClose: () => void; }

export default function ArenaPanel({ engine, visible, onClose }: ArenaPanelProps) {
  const [battleResult, setBattleResult] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const arena = engine?.getArenaSystem?.() ?? engine?.arena;
  const battle = engine?.getPvPBattleSystem?.() ?? engine?.pvpBattle;
  const seasonSys = engine?.getArenaSeasonSystem?.() ?? engine?.arenaSeason;
  const ps = arena?.getPlayerState?.() ?? arena?.state;
  const seasonData = seasonSys?.getSeasonData?.() ?? engine?.seasonData ?? null;

  const rank = useMemo(() => parseRank(ps?.rankId ?? 'BRONZE_V'), [ps?.rankId]);
  const opponents: any[] = ps?.opponents ?? [];
  const seasonDaysLeft = useMemo(() =>
    seasonData ? (seasonSys?.getRemainingDays?.(seasonData, Date.now()) ?? null) : null,
    [seasonData, seasonSys]);

  const flash = useCallback((msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 2500); }, []);

  const handleChallenge = useCallback((opp: any) => {
    if (!arena?.canChallenge?.(ps)) { flash('挑战次数不足'); return; }
    setBusyId(opp.playerId);
    try {
      const consumed = arena.consumeChallenge(ps);
      const result = battle?.executeBattle?.(consumed, { ...opp, playerId: opp.playerId, score: opp.score ?? 0 });
      if (result) { battle?.applyBattleResult?.(consumed, result); setBattleResult(result); }
    } catch (e: any) { flash(e?.message ?? '挑战失败'); }
    setBusyId(null);
  }, [arena, battle, ps, flash]);

  const handleRefresh = useCallback(() => {
    try {
      arena?.canFreeRefresh?.(ps, Date.now())
        ? arena.freeRefresh(ps, arena.getAllPlayers?.() ?? [], Date.now())
        : arena?.manualRefresh?.(ps, arena.getAllPlayers?.() ?? [], Date.now());
      flash('对手已刷新');
    } catch (e: any) { flash(e?.message ?? '刷新失败'); }
  }, [arena, ps, flash]);

  const handleBuy = useCallback(() => {
    try { const r = arena?.buyChallenge?.(ps); if (r) flash(`购买成功，消耗${r.cost}元宝`); }
    catch (e: any) { flash(e?.message ?? '购买失败'); }
  }, [arena, ps, flash]);

  return (
    <>
      <SharedPanel title="⚔️ 竞技场" visible={visible} onClose={onClose} width="380px">
        <div style={s.container} data-testid="arena-panel">
          {/* 段位 */}
          <div style={s.rankBanner} data-testid="arena-panel-rank">
            <span style={{ fontSize: 28 }}>{rank.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ ...s.rankLabel, color: rank.color }}>{rank.full}</div>
              <div style={s.scoreText}>积分 {ps?.score ?? 0} · 排名 #{ps?.ranking || '—'}</div>
            </div>
          </div>
          {/* 赛季 */}
          {seasonData && (
            <div style={s.bar}>🏆 赛季 {seasonData.seasonId}
              {seasonDaysLeft !== null && <span style={{ color: '#a0a0a0' }}>剩余{seasonDaysLeft}天</span>}
            </div>
          )}
          {/* 挑战次数 */}
          <div style={s.infoRow}>
            <span>今日挑战：<b style={{ color: (ps?.dailyChallengesLeft ?? 0) > 0 ? '#7EC850' : '#ff6464' }}>{ps?.dailyChallengesLeft ?? 0}次</b></span>
            <button style={s.smBtn} data-testid="arena-panel-buy-challenge" onClick={handleBuy}>+购买</button>
          </div>
          {message && <div style={s.toast} data-testid="arena-panel-toast">{message}</div>}
          {/* 对手 */}
          <div style={s.header}><span>挑战对手</span><button style={s.smBtn} data-testid="arena-panel-refresh" onClick={handleRefresh}>🔄 刷新</button></div>
          {opponents.length > 0 ? opponents.map((o: any) => (
            <div key={o.playerId} style={s.oppCard} data-testid={`arena-panel-opponent-${o.playerId}`}>
              <div><div style={s.oppName}>{o.playerName ?? '对手'}</div><div style={s.oppMeta}>⚔️{o.power ?? '?'} · #{o.ranking ?? '?'}</div></div>
              <button style={{ ...s.chalBtn, opacity: busyId === o.playerId ? 0.5 : 1 }} disabled={busyId === o.playerId}
                data-testid={`arena-panel-challenge-${o.playerId}`}
                onClick={() => handleChallenge(o)}>{busyId === o.playerId ? '...' : '挑战'}</button>
            </div>
          )) : <div style={s.empty}>暂无对手，请刷新</div>}
          <div style={s.bar}>🪙 竞技币：{ps?.arenaCoins ?? 0}</div>
          {/* 防守日志 */}
          {(ps?.defenseLogs?.length ?? 0) > 0 && (
            <><div style={{ ...s.header, marginTop: 6 }}>🛡️ 防守日志</div>
            {ps.defenseLogs.slice(0, 3).map((l: any) => (
              <div key={l.id} style={s.logItem}>
                <span>{l.attackerName ?? '未知'}</span>
                <span style={{ color: l.defenderWon ? '#7EC850' : '#ff6464' }}>{l.defenderWon ? '防守成功' : '防守失败'}</span>
              </div>
            ))}</>
          )}
        </div>
      </SharedPanel>
      <Modal visible={!!battleResult} type={battleResult?.attackerWon ? 'success' : 'danger'}
        title={battleResult?.attackerWon ? '🎉 挑战胜利' : '💔 挑战失败'}
        confirmText="确定" onConfirm={() => setBattleResult(null)} onCancel={() => setBattleResult(null)} width="300px">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#a0a0a0' }}>积分变化：
            <span style={{ color: battleResult?.scoreChange >= 0 ? '#7EC850' : '#ff6464' }}>
              {battleResult?.scoreChange >= 0 ? '+' : ''}{battleResult?.scoreChange}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>战斗回合：{battleResult?.totalTurns ?? 0}</div>
        </div>
      </Modal>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { padding: 8, color: '#e8e0d0' },
  rankBanner: { display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'linear-gradient(135deg,rgba(212,165,116,0.12),rgba(255,215,0,0.08))', borderRadius: 'var(--tk-radius-lg)' as any, marginBottom: 8 },
  rankLabel: { fontSize: 18, fontWeight: 700 }, scoreText: { fontSize: 12, color: '#a0a0a0', marginTop: 2 },
  bar: { display: 'flex', justifyContent: 'space-between', padding: '6px 10', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--tk-radius-md)' as any, fontSize: 12, marginBottom: 6 },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 6 },
  smBtn: { padding: '3px 8px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-sm)' as any, background: 'transparent', color: '#d4a574', fontSize: 11, cursor: 'pointer' },
  toast: { padding: '6px 10', marginBottom: 6, borderRadius: 'var(--tk-radius-md)' as any, background: 'rgba(212,165,116,0.2)', color: '#d4a574', fontSize: 12, textAlign: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#d4a574', marginBottom: 6 },
  oppCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--tk-radius-md)' as any, marginBottom: 4 },
  oppName: { fontSize: 13, fontWeight: 600 }, oppMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  chalBtn: { padding: '5px 14px', border: 'none', borderRadius: 'var(--tk-radius-sm)' as any, background: '#B8423A', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  empty: { textAlign: 'center', padding: 16, color: '#666', fontSize: 12 },
  logItem: { display: 'flex', justifyContent: 'space-between', padding: '4px 6', fontSize: 11, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--tk-radius-sm)' as any, marginBottom: 2 },
};
