/**
 * 三国霸业 — 竞技场面板组件
 *
 * 排行榜 + 挑战 + 赛季信息。
 * 展示当前段位、积分、对手列表、赛季倒计时。
 *
 * @module ui/components/ArenaPanel
 */

import { useCallback, useMemo } from 'react';
import { useDebouncedAction } from '../hooks/useDebouncedAction';
import { useToast } from './ToastProvider';
import type { ArenaPlayerState, ArenaOpponent, SeasonData } from '../../core/pvp/pvp.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const RANK_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  BRONZE: { label: '青铜', icon: '🥉', color: '#CD7F32' },
  SILVER: { label: '白银', icon: '🥈', color: '#C0C0C0' },
  GOLD: { label: '黄金', icon: '🥇', color: '#FFD700' },
  PLATINUM: { label: '铂金', icon: '💎', color: '#E5E4E2' },
  DIAMOND: { label: '钻石', icon: '💠', color: '#B9F2FF' },
  MASTER: { label: '大师', icon: '🔥', color: '#FF6B6B' },
  KING: { label: '王者', icon: '👑', color: '#FFD700' },
};

function getRankDisplay(rankId: string): { label: string; icon: string; color: string } {
  const tier = rankId.split('_')[0];
  const meta = RANK_LABELS[tier] ?? RANK_LABELS.BRONZE;
  const division = rankId.split('_')[1] ?? '';
  const divLabel = division ? ` ${division}` : '';
  return { ...meta, label: meta.label + divLabel };
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface ArenaPanelProps {
  /** 竞技场玩家状态 */
  playerState: ArenaPlayerState | null;
  /** 赛季数据 */
  seasonData: SeasonData | null;
  /** 挑战对手回调 */
  onChallenge?: (opponentId: string) => void;
  /** 刷新对手回调 */
  onRefresh?: () => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 子组件：对手卡片
// ─────────────────────────────────────────────

interface OpponentCardProps {
  opponent: ArenaOpponent;
  onChallenge: () => void;
}

function OpponentCard({ opponent, onChallenge, isLoading }: OpponentCardProps & { isLoading?: boolean }) {
  const rankDisplay = getRankDisplay(opponent.rankId);

  return (
    <div style={cardStyles.container}>
      <div style={cardStyles.info}>
        <div style={cardStyles.nameRow}>
          <span style={cardStyles.name}>{opponent.playerName}</span>
          <span style={{ ...cardStyles.rank, color: rankDisplay.color }}>
            {rankDisplay.icon} {rankDisplay.label}
          </span>
        </div>
        <div style={cardStyles.stats}>
          <span>⚔️ {opponent.power}</span>
          <span>积分 {opponent.score}</span>
          <span>排名 #{opponent.ranking}</span>
        </div>
      </div>
      <button
        style={{
          ...cardStyles.challengeBtn,
          ...(isLoading ? cardStyles.challengeBtnLoading : {}),
        }}
        onClick={onChallenge}
        disabled={isLoading}
      >
        {isLoading ? '挑战中...' : '挑战'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * ArenaPanel — 竞技场面板
 *
 * @example
 * ```tsx
 * <ArenaPanel
 *   playerState={arenaState}
 *   seasonData={season}
 *   onChallenge={(id) => engine.challenge(id)}
 * />
 * ```
 */
export function ArenaPanel({
  playerState,
  seasonData,
  onChallenge,
  onRefresh,
  className,
}: ArenaPanelProps) {
  const { addToast } = useToast();
  const rankDisplay = useMemo(
    () => (playerState ? getRankDisplay(playerState.rankId) : null),
    [playerState],
  );

  const seasonDaysLeft = useMemo(() => {
    if (!seasonData) return null;
    const now = Date.now();
    const remaining = Math.max(0, seasonData.endTime - now);
    return Math.ceil(remaining / (24 * 3600 * 1000));
  }, [seasonData]);

  const handleChallenge = useCallback(
    (id: string) => {
      // R16: 检查挑战次数
      if (playerState && (playerState.dailyChallengesLeft ?? 0) <= 0) {
        addToast('今日挑战次数已用完', 'warning');
        return;
      }
      try {
        onChallenge?.(id);
        // R16: 挑战成功 Toast
        addToast('挑战已发起！', 'success');
      } catch (error) {
        console.error('竞技场挑战失败:', error);
        addToast('竞技场挑战失败', 'error');
      }
    },
    [onChallenge, playerState, addToast],
  );

  // P0-UI-02: 防抖包裹
  const { action: debouncedChallenge, isActing: isChallenging } = useDebouncedAction(
    (id: string) => handleChallenge(id),
    500,
  );

  if (!playerState) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div
      style={styles.container}
      className={`tk-arena-panel ${className ?? ''}`.trim()}
      role="region"
      aria-label="竞技场"
    >
      {/* 段位信息 */}
      {rankDisplay && (
        <div style={styles.rankBanner}>
          <span style={styles.rankIcon}>{rankDisplay.icon}</span>
          <div style={styles.rankInfo}>
            <div style={{ ...styles.rankName, color: rankDisplay.color }}>{rankDisplay.label}</div>
            <div style={styles.rankScore}>积分：{playerState.score}</div>
          </div>
          <div style={styles.rankPosition}>排名 #{playerState.ranking || '—'}</div>
        </div>
      )}

      {/* 赛季信息 */}
      {seasonData && (
        <div style={styles.seasonBar}>
          <span>🏆 赛季 {seasonData.seasonId}</span>
          <span style={styles.seasonDays}>
            第{seasonData.currentDay}天 · 剩余{seasonDaysLeft}天
          </span>
        </div>
      )}

      {/* 挑战次数 */}
      <div style={styles.challengeInfo}>
        <span>今日挑战：剩余 {playerState.dailyChallengesLeft ?? 0} 次</span>
        {(playerState.dailyBoughtChallenges ?? 0) > 0 && (
          <span style={styles.boughtInfo}>（已购买 {playerState.dailyBoughtChallenges} 次）</span>
        )}
      </div>

      {/* 对手列表 */}
      <div style={styles.opponentsHeader}>
        <span style={styles.opponentsTitle}>挑战对手</span>
        <button style={styles.refreshBtn} onClick={onRefresh}>
          🔄 刷新
        </button>
      </div>

      <div style={styles.opponentList}>
        {(playerState.opponents ?? []).length > 0 ? (
          (playerState.opponents ?? []).map((opp) => (
            <OpponentCard
              key={opp.playerId}
              opponent={opp}
              onChallenge={() => debouncedChallenge(opp.playerId)}
              isLoading={isChallenging}
            />
          ))
        ) : (
          <div style={styles.empty}>暂无对手，请刷新</div>
        )}
      </div>

      {/* 竞技币 */}
      <div style={styles.coinBar}>
        🪙 竞技币：{playerState.arenaCoins ?? 0}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px',
    color: '#e8e0d0',
  },
  loading: {
    padding: '24px',
    textAlign: 'center',
    color: '#a0a0a0',
  },
  rankBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, rgba(212, 165, 116, 0.12), rgba(255, 215, 0, 0.08))',
    borderRadius: '10px',
    marginBottom: '10px',
  },
  rankIcon: { fontSize: '32px' },
  rankInfo: { flex: 1 },
  rankName: { fontSize: '18px', fontWeight: 700 },
  rankScore: { fontSize: '12px', color: '#a0a0a0', marginTop: '2px' },
  rankPosition: { fontSize: '14px', fontWeight: 600, color: '#d4a574' },
  seasonBar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '6px',
    fontSize: '12px',
    marginBottom: '10px',
  },
  seasonDays: { color: '#a0a0a0' },
  challengeInfo: {
    fontSize: '12px',
    color: '#a0a0a0',
    marginBottom: '10px',
    padding: '6px 0',
  },
  boughtInfo: { fontSize: '10px', color: '#666' },
  opponentsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  opponentsTitle: { fontSize: '14px', fontWeight: 600, color: '#d4a574' },
  refreshBtn: {
    padding: '4px 10px',
    border: '1px solid rgba(212, 165, 116, 0.3)',
    borderRadius: '4px',
    background: 'transparent',
    color: '#d4a574',
    fontSize: '12px',
    cursor: 'pointer',
  },
  opponentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '10px',
  },
  empty: {
    textAlign: 'center',
    padding: '16px',
    color: '#666',
    fontSize: '12px',
  },
  coinBar: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#C9A84C',
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '6px',
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  name: { fontSize: '13px', fontWeight: 600, color: '#e8e0d0' },
  rank: { fontSize: '11px', fontWeight: 600 },
  stats: {
    display: 'flex',
    gap: '8px',
    fontSize: '11px',
    color: '#a0a0a0',
  },
  challengeBtn: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: '4px',
    background: '#B8423A',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  challengeBtnLoading: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};
