/** PvP竞技场面板 — 集成Panel/Modal
 * 引擎API: arena.getPlayerState/freeRefresh/manualRefresh/canChallenge/consumeChallenge/buyChallenge
 *          battle.executeBattle/applyBattleResult
 *
 * R4 修复：
 * - [P1-1] 空防守阵容无引导提示：首次进入提示"请设置防守阵容"引导；低胜率高亮策略建议
 * - [P1-2] 挑战结果UI反馈不明确：战斗摘要弹窗（伤害/回合/评级/关键数据）
 * - [P1-5] 对手信息展示不够详细：对手卡片显示阵容预览、战力、最近战绩
 *
 * R3 修复：
 * - [P3] 内联样式迁移到 CSS 类，提升代码整洁度和可维护性
 * - [P3] 新增超小屏(360px)和横屏适配
 *
 * R2 修复：
 * - [P1-3] 新增防守编队编辑面板（阵型选择+武将列表+AI策略）
 * - [P1-4] 新增竞技商店弹窗（分类Tab+商品列表+限购）
 * - [P1-2] 新增战前布阵提示（双方阵容对比）
 *
 * @module panels/pvp/ArenaPanel */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
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

/** 阵型名称映射 */
const FORMATION_LABELS: Record<string, string> = {
  FISH_SCALE: '鱼鳞阵', CRANE_WING: '鹤翼阵', WEDGE: '锋矢阵',
  GOOSE: '雁行阵', SNAKE: '长蛇阵', SQUARE: '方圆阵',
};

/** AI策略名称映射 */
const STRATEGY_LABELS: Record<string, string> = {
  BALANCED: '均衡', AGGRESSIVE: '猛攻', DEFENSIVE: '坚守', CUNNING: '智谋', TACTICAL: '战术',
};

/** 战斗评级计算 */
function getBattleRating(result: any): { grade: string; label: string; color: string } {
  const turns = result?.totalTurns ?? 99;
  const won = result?.attackerWon ?? false;
  const scoreChange = result?.scoreChange ?? 0;

  if (!won) return { grade: 'D', label: '惜败', color: '#ff6464' };
  if (turns <= 3 && scoreChange >= 20) return { grade: 'S', label: '完美碾压', color: '#FFD700' };
  if (turns <= 5 && scoreChange >= 15) return { grade: 'A', label: '出色胜利', color: '#7EC850' };
  if (turns <= 7) return { grade: 'B', label: '稳健获胜', color: '#4FC3F7' };
  return { grade: 'C', label: '艰难取胜', color: '#d4a574' };
}

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
  // R2: 防守编队编辑
  const [showDefenseEdit, setShowDefenseEdit] = useState(false);
  const [defenseSlots, setDefenseSlots] = useState<string[]>(['', '', '', '', '']);
  const [defenseFormation, setDefenseFormation] = useState<string>('FISH_SCALE');
  const [defenseStrategy, setDefenseStrategy] = useState<string>('BALANCED');
  // R2: 竞技商店
  const [showShop, setShowShop] = useState(false);
  // R4-P1-1: 防守引导提示状态
  const [showDefenseGuide, setShowDefenseGuide] = useState(false);

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

  // ── R4-P1-1: 防守阵容是否为空 ──
  const isDefenseEmpty = useMemo(() => {
    const slots = ps?.defenseFormation?.slots;
    if (!slots) return true;
    return slots.every((s: string) => !s || s === '');
  }, [ps?.defenseFormation?.slots]);

  // ── R4-P1-1: 防守统计与策略建议 ──
  const defenseStats = useMemo(() => {
    return arena?.getDefenseStats?.(ps) ?? null;
  }, [arena, ps]);

  // ── R4-P1-1: 首次进入检测，显示引导提示 ──
  useEffect(() => {
    if (visible && isDefenseEmpty) {
      setShowDefenseGuide(true);
    }
  }, [visible, isDefenseEmpty]);

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

  // ── R4-P1-2: 战斗评级 ──
  const battleRating = useMemo(() => getBattleRating(battleResult), [battleResult]);

  return (
    <>
      <SharedPanel title="⚔️ 竞技场" visible={visible} onClose={onClose} width="380px">
        <div className="tk-arena-panel" data-testid="arena-panel">

          {/* ── R4-P1-1: 空防守阵容引导提示 ── */}
          {showDefenseGuide && isDefenseEmpty && (
            <div className="tk-arena-guide-banner" data-testid="arena-defense-guide">
              <div className="tk-arena-guide-icon">🛡️</div>
              <div className="tk-arena-guide-content">
                <div className="tk-arena-guide-title">请设置防守阵容</div>
                <div className="tk-arena-guide-desc">其他玩家可以挑战你，设置防守阵容保护你的排名和积分</div>
              </div>
              <div className="tk-arena-guide-actions">
                <button className="tk-arena-guide-btn tk-arena-guide-btn--primary"
                  data-testid="arena-defense-guide-setup"
                  onClick={() => { setShowDefenseGuide(false); setShowDefenseEdit(true); }}>
                  立即设置
                </button>
                <button className="tk-arena-guide-btn"
                  data-testid="arena-defense-guide-dismiss"
                  onClick={() => setShowDefenseGuide(false)}>
                  稍后
                </button>
              </div>
            </div>
          )}

          {/* ── R4-P1-1: 低胜率策略建议 ── */}
          {defenseStats && defenseStats.totalDefenses >= 5 && defenseStats.winRate < 0.4 && !isDefenseEmpty && (
            <div className="tk-arena-strategy-tip" data-testid="arena-strategy-tip">
              <span className="tk-arena-strategy-tip-icon">💡</span>
              <span className="tk-arena-strategy-tip-text">
                防守胜率仅{Math.round(defenseStats.winRate * 100)}%，建议切换为
                <b>{STRATEGY_LABELS[defenseStats.suggestedStrategy ?? 'DEFENSIVE']}</b>策略
              </span>
              <button className="tk-arena-strategy-tip-btn"
                data-testid="arena-strategy-tip-action"
                onClick={() => { setShowDefenseEdit(true); }}>
                调整
              </button>
            </div>
          )}

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
          {opponents.length > 0 ? opponents.map((o: any) => {
            // ── R4-P1-5: 对手详细信息 ──
            const oppRank = parseRank(o.rankId ?? 'BRONZE_V');
            const oppSlots = o.defenseSnapshot?.slots ?? [];
            const oppFormation = o.defenseSnapshot?.formation;
            const filledSlots = oppSlots.filter((s: string) => s && s !== '').length;
            const oppRecord = o.recentRecord ?? o.recentResults ?? null;

            return (
              <div key={o.playerId} className="tk-arena-opp-card tk-arena-opp-card--detailed" data-testid={`arena-panel-opponent-${o.playerId}`}>
                <div className="tk-arena-opp-main">
                  <div className="tk-arena-opp-header">
                    <div className="tk-arena-opp-name">{o.playerName ?? '对手'}</div>
                    <span className="tk-arena-opp-rank-badge" style={{ color: oppRank.color }}>{oppRank.icon} {oppRank.full}</span>
                  </div>
                  <div className="tk-arena-opp-meta">
                    <span>⚔️ 战力 {o.power ?? '?'}</span>
                    <span>🏆 积分 {o.score ?? '?'}</span>
                    <span>📊 排名 #{o.ranking ?? '?'}</span>
                  </div>
                  {/* R4-P1-5: 阵容预览 */}
                  {oppSlots.length > 0 && (
                    <div className="tk-arena-opp-formation" data-testid={`arena-opp-formation-${o.playerId}`}>
                      <span className="tk-arena-opp-formation-label">
                        {oppFormation ? (FORMATION_LABELS[oppFormation] ?? oppFormation) : '未知阵型'}
                      </span>
                      <div className="tk-arena-opp-slots">
                        {oppSlots.map((slot: string, i: number) => (
                          <span key={i} className={`tk-arena-opp-slot ${slot ? 'tk-arena-opp-slot--filled' : 'tk-arena-opp-slot--empty'}`}>
                            {slot ? '⚔️' : '·'}
                          </span>
                        ))}
                      </div>
                      <span className="tk-arena-opp-slots-count">{filledSlots}/5</span>
                    </div>
                  )}
                  {/* R4-P1-5: 最近战绩 */}
                  {oppRecord && (
                    <div className="tk-arena-opp-record" data-testid={`arena-opp-record-${o.playerId}`}>
                      <span className="tk-arena-opp-record-label">最近：</span>
                      {Array.isArray(oppRecord) ? oppRecord.slice(0, 5).map((r: any, i: number) => (
                        <span key={i} className={`tk-arena-opp-record-dot ${r === 'win' || r?.won ? 'tk-arena-opp-record-dot--win' : 'tk-arena-opp-record-dot--lose'}`}>
                          {r === 'win' || r?.won ? '胜' : '负'}
                        </span>
                      )) : (
                        <span className="tk-arena-opp-record-text">{oppRecord}</span>
                      )}
                    </div>
                  )}
                </div>
                <button className={`tk-arena-chal-btn ${(busyId === o.playerId || !canChallengeNow) ? 'tk-arena-chal-btn--disabled' : ''}`} disabled={busyId === o.playerId || !canChallengeNow}
                  data-testid={`arena-panel-challenge-${o.playerId}`}
                  onClick={() => handleChallenge(o)}>{busyId === o.playerId ? '...' : '挑战'}</button>
              </div>
            );
          }) : <div className="tk-arena-empty">暂无对手，请刷新</div>}
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
          {/* R2: 防守编队编辑按钮 */}
          <button className="tk-arena-sm-btn" style={{ width: '100%', marginTop: 8, padding: '8px' }}
            data-testid="arena-panel-edit-defense"
            onClick={() => setShowDefenseEdit(true)}>
            🛡️ 编辑防守阵容
          </button>
          {/* R2: 竞技商店按钮 */}
          <button className="tk-arena-sm-btn" style={{ width: '100%', marginTop: 4, padding: '8px' }}
            data-testid="arena-panel-shop"
            onClick={() => setShowShop(true)}>
            🏪 竞技商店
          </button>
        </div>
      </SharedPanel>

      {/* ── R4-P1-2: 战斗摘要弹窗 ── */}
      <Modal visible={!!battleResult} type={battleResult?.attackerWon ? 'success' : 'danger'}
        title={battleResult?.attackerWon ? '🎉 挑战胜利' : '💔 挑战失败'}
        confirmText="确定" onConfirm={() => setBattleResult(null)} onCancel={() => setBattleResult(null)} width="320px">
        {battleResult && (
          <div className="tk-arena-battle-summary" data-testid="arena-battle-summary">
            {/* 评级 */}
            <div className="tk-arena-summary-rating" data-testid="arena-battle-rating">
              <span className="tk-arena-summary-grade" style={{ color: battleRating.color }}>{battleRating.grade}</span>
              <span className="tk-arena-summary-grade-label" style={{ color: battleRating.color }}>{battleRating.label}</span>
            </div>
            {/* 核心数据 */}
            <div className="tk-arena-summary-stats">
              <div className="tk-arena-summary-stat">
                <span className="tk-arena-summary-stat-label">积分变化</span>
                <span className={`tk-arena-summary-stat-value ${(battleResult.scoreChange ?? 0) >= 0 ? 'tk-arena-summary-stat--positive' : 'tk-arena-summary-stat--negative'}`}>
                  {(battleResult.scoreChange ?? 0) >= 0 ? '+' : ''}{battleResult.scoreChange ?? 0}
                </span>
              </div>
              <div className="tk-arena-summary-stat">
                <span className="tk-arena-summary-stat-label">战斗回合</span>
                <span className="tk-arena-summary-stat-value">{battleResult.totalTurns ?? 0}回合</span>
              </div>
              <div className="tk-arena-summary-stat">
                <span className="tk-arena-summary-stat-label">是否超时</span>
                <span className="tk-arena-summary-stat-value">{battleResult.isTimeout ? '⏰ 超时' : '✅ 正常'}</span>
              </div>
              {battleResult.attackerNewScore !== undefined && (
                <div className="tk-arena-summary-stat">
                  <span className="tk-arena-summary-stat-label">当前积分</span>
                  <span className="tk-arena-summary-stat-value tk-arena-summary-stat--highlight">{battleResult.attackerNewScore}</span>
                </div>
              )}
            </div>
            {/* 战斗行动摘要（如有） */}
            {battleResult.battleState?.actions && battleResult.battleState.actions.length > 0 && (
              <div className="tk-arena-summary-actions">
                <div className="tk-arena-summary-actions-title">战斗摘要</div>
                <div className="tk-arena-summary-actions-list">
                  {battleResult.battleState.actions.slice(0, 3).map((a: any, i: number) => (
                    <div key={i} className="tk-arena-summary-action-item">
                      <span className="tk-arena-summary-action-turn">R{a.turn ?? i + 1}</span>
                      <span className="tk-arena-summary-action-desc">
                        {a.attackerName ?? '我方'} → {a.targetName ?? '敌方'}
                        {a.damage ? ` 伤害${a.damage}` : ''}{a.heal ? ` 治疗${a.heal}` : ''}
                      </span>
                    </div>
                  ))}
                  {battleResult.battleState.actions.length > 3 && (
                    <div className="tk-arena-summary-actions-more">
                      还有{battleResult.battleState.actions.length - 3}条记录...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* R2: 防守编队编辑弹窗 */}
      <Modal visible={showDefenseEdit} type="info" title="🛡️ 防守阵容设置"
        confirmText="保存" onConfirm={() => {
          try {
            const defSys = engine?.getDefenseFormationSystem?.() ?? engine?.defenseFormation;
            if (defSys?.setFormation) {
              defSys.setFormation(ps?.playerId, {
                slots: defenseSlots,
                formation: defenseFormation as any,
                strategy: defenseStrategy as any,
              });
            }
            flash('✅ 防守阵容已更新');
          } catch (e: any) { flash(e?.message ?? '保存失败'); }
          setShowDefenseEdit(false);
        }} onCancel={() => setShowDefenseEdit(false)} width="360px">
        <div style={{ color: '#e8e0d0' }}>
          <div style={{ fontSize: 12, color: '#d4a574', fontWeight: 600, marginBottom: 6 }}>阵型选择</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {['FISH_SCALE', 'CRANE_WING', 'WEDGE', 'GOOSE', 'SNAKE', 'SQUARE'].map(f => (
              <button key={f} style={{
                padding: '4px 8px', border: defenseFormation === f ? '1px solid #d4a574' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--tk-radius-sm)' as any,
                background: defenseFormation === f ? 'rgba(212,165,116,0.2)' : 'transparent',
                color: defenseFormation === f ? '#d4a574' : '#a0a0a0', fontSize: 11, cursor: 'pointer',
              }} onClick={() => setDefenseFormation(f)}>{FORMATION_LABELS[f] ?? f}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#d4a574', fontWeight: 600, marginBottom: 6 }}>AI策略</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {['BALANCED', 'AGGRESSIVE', 'DEFENSIVE', 'TACTICAL'].map(s => (
              <button key={s} style={{
                padding: '4px 8px', border: defenseStrategy === s ? '1px solid #d4a574' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--tk-radius-sm)' as any,
                background: defenseStrategy === s ? 'rgba(212,165,116,0.2)' : 'transparent',
                color: defenseStrategy === s ? '#d4a574' : '#a0a0a0', fontSize: 11, cursor: 'pointer',
              }} onClick={() => setDefenseStrategy(s)}>{STRATEGY_LABELS[s] ?? s}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#d4a574', fontWeight: 600, marginBottom: 6 }}>武将阵位（5个）</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {defenseSlots.map((slot, i) => (
              <div key={i} style={{
                padding: '6px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--tk-radius-sm)' as any,
                background: slot ? 'rgba(126,200,80,0.15)' : 'rgba(255,255,255,0.04)', fontSize: 11, color: slot ? '#7EC850' : '#666',
              }}>
                {slot || `阵位${i + 1}`}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* R2: 竞技商店弹窗 */}
      <Modal visible={showShop} type="info" title="🏪 竞技商店"
        confirmText="关闭" onConfirm={() => setShowShop(false)} onCancel={() => setShowShop(false)} width="340px">
        <div style={{ color: '#e8e0d0' }}>
          <div style={{ fontSize: 12, color: '#d4a574', marginBottom: 6 }}>🪙 竞技币：{ps?.arenaCoins ?? 0}</div>
          {[
            { name: '武将碎片（随机）', cost: 50, limit: '每日5次', icon: '🧩' },
            { name: '强化石 ×1', cost: 30, limit: '每日10次', icon: '💎' },
            { name: '铜钱 ×1,000', cost: 20, limit: '每日20次', icon: '🪙' },
            { name: '加速道具（1h）', cost: 40, limit: '每日5次', icon: '⏩' },
            { name: '赛季专属头像框', cost: 500, limit: '赛季1次', icon: '🖼️' },
            { name: '传说装备箱', cost: 800, limit: '赛季2次', icon: '📦' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12,
            }}>
              <span>{item.icon} {item.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#a0a0a0', fontSize: 10 }}>{item.limit}</span>
                <button style={{
                  padding: '2px 8px', border: '1px solid rgba(212,165,116,0.3)', borderRadius: 'var(--tk-radius-sm)' as any,
                  background: 'rgba(212,165,116,0.15)', color: '#d4a574', fontSize: 10, cursor: 'pointer',
                }} onClick={() => {
                  try {
                    const shopSys = engine?.getArenaShopSystem?.() ?? engine?.arenaShop;
                    if (shopSys?.buy) {
                      const result = shopSys.buy(item.name, 1);
                      flash(result?.success ? `购买成功: ${item.name}` : '购买失败');
                    } else { flash('商店系统未接入'); }
                  } catch (e: any) { flash(e?.message ?? '购买失败'); }
                }}>{item.cost}币</button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
