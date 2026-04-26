/** PvP竞技场面板 — 集成Panel/Modal
 * 引擎API: arena.getPlayerState/freeRefresh/manualRefresh/canChallenge/consumeChallenge/buyChallenge
 *          battle.executeBattle/applyBattleResult
 *
 * R4 修复：
 * - [P3] 内联样式迁移到 CSS 类，提升代码整洁度和可维护性
 * - [P3] 新增超小屏(360px)和横屏适配
 *
 * @module panels/pvp/ArenaPanel */
import React, { useState, useMemo, useCallback } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';
import Modal from '@/components/idle/common/Modal';
import './ArenaPanel.css';

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

  // ACC-07-37 [P1]: 挑战次数是否可用（用于按钮视觉禁用）
  const canChallengeNow = arena?.canChallenge?.(ps) ?? false;

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

  // 挑战次数剩余
  const challengesLeft = ps?.dailyChallengesLeft ?? 0;

  return (
    <>
      <SharedPanel title="⚔️ 竞技场" visible={visible} onClose={onClose} width="380px">
        <div className="tk-arena-panel" data-testid="arena-panel">
          {/* 段位 */}
          <div className="tk-arena-rank-banner" data-testid="arena-panel-rank">
            <span className="tk-arena-rank-icon">{rank.icon}</span>
            <div className="tk-arena-rank-info">
              <div className="tk-arena-rank-label" style={{ '--tk-rank-color': rank.color } as React.CSSProperties}>{rank.full}</div>
              <div className="tk-arena-score-text">积分 {ps?.score ?? 0} · 排名 #{ps?.ranking || '—'}</div>
            </div>
          </div>
          {/* 赛季 */}
          {seasonData && (
            <div className="tk-arena-bar">🏆 赛季 {seasonData.seasonId}
              {seasonDaysLeft !== null && <span className="tk-arena-bar-secondary">剩余{seasonDaysLeft}天</span>}
            </div>
          )}
          {/* 挑战次数 */}
          <div className="tk-arena-info-row">
            <span>今日挑战：<b className={`tk-arena-challenges-left ${challengesLeft > 0 ? 'tk-arena-challenges-left--available' : 'tk-arena-challenges-left--exhausted'}`}>{challengesLeft}次</b></span>
            <button className="tk-arena-sm-btn" data-testid="arena-panel-buy-challenge" onClick={handleBuy}>+购买</button>
          </div>
          {message && <div className="tk-arena-toast" data-testid="arena-panel-toast">{message}</div>}
          {/* 对手 */}
          <div className="tk-arena-header"><span>挑战对手</span><button className="tk-arena-sm-btn" data-testid="arena-panel-refresh" onClick={handleRefresh}>🔄 刷新</button></div>
          {opponents.length > 0 ? opponents.map((o: any) => (
            <div key={o.playerId} className="tk-arena-opp-card" data-testid={`arena-panel-opponent-${o.playerId}`}>
              <div><div className="tk-arena-opp-name">{o.playerName ?? '对手'}</div><div className="tk-arena-opp-meta">⚔️{o.power ?? '?'} · #{o.ranking ?? '?'}</div></div>
              <button className={`tk-arena-chal-btn ${(busyId === o.playerId || !canChallengeNow) ? 'tk-arena-chal-btn--disabled' : ''}`} disabled={busyId === o.playerId || !canChallengeNow}
                data-testid={`arena-panel-challenge-${o.playerId}`}
                onClick={() => handleChallenge(o)}>{busyId === o.playerId ? '...' : '挑战'}</button>
            </div>
          )) : <div className="tk-arena-empty">暂无对手，请刷新</div>}
          <div className="tk-arena-bar">🪙 竞技币：{ps?.arenaCoins ?? 0}</div>
          {/* 防守日志 */}
          {(ps?.defenseLogs?.length ?? 0) > 0 && (
            <><div className="tk-arena-header tk-arena-log-section">🛡️ 防守日志</div>
            {ps.defenseLogs.slice(0, 3).map((l: any) => (
              <div key={l.id} className="tk-arena-log-item">
                <span>{l.attackerName ?? '未知'}</span>
                <span className={l.defenderWon ? 'tk-arena-log-result--win' : 'tk-arena-log-result--lose'}>{l.defenderWon ? '防守成功' : '防守失败'}</span>
              </div>
            ))}</>
          )}
        </div>
      </SharedPanel>
      <Modal visible={!!battleResult} type={battleResult?.attackerWon ? 'success' : 'danger'}
        title={battleResult?.attackerWon ? '🎉 挑战胜利' : '💔 挑战失败'}
        confirmText="确定" onConfirm={() => setBattleResult(null)} onCancel={() => setBattleResult(null)} width="300px">
        <div className="tk-arena-result">
          <div className="tk-arena-result-score">积分变化：
            <span className={battleResult?.scoreChange >= 0 ? 'tk-arena-result-change--positive' : 'tk-arena-result-change--negative'}>
              {battleResult?.scoreChange >= 0 ? '+' : ''}{battleResult?.scoreChange}
            </span>
          </div>
          <div className="tk-arena-result-turns">战斗回合：{battleResult?.totalTurns ?? 0}</div>
        </div>
      </Modal>
    </>
  );
}
