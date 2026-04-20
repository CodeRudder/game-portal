/**
 * 三国霸业 — PvP战斗结果面板组件
 *
 * 展示胜负结果、排名变化、战斗奖励。
 * 支持胜利/失败两种视觉状态。
 *
 * @module ui/components/PvPBattleResult
 */

import { useCallback, useMemo } from 'react';
import { Modal } from './Modal';
import type { PvPBattleResult as PvPBattleResultType } from '../../core/pvp/pvp.types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface PvPBattleResultProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 战斗结果数据 */
  result: PvPBattleResultType | null;
  /** 关闭回调 */
  onClose: () => void;
  /** 再来一次回调 */
  onRetry?: () => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function getRankChangeDisplay(scoreChange: number, won: boolean): { text: string; color: string } {
  if (won) {
    return { text: `+${scoreChange}`, color: '#7EC850' };
  }
  return { text: `${scoreChange}`, color: '#B8423A' };
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * PvPBattleResult — PvP战斗结果面板
 *
 * @example
 * ```tsx
 * <PvPBattleResult
 *   isOpen={show}
 *   result={battleResult}
 *   onClose={() => setShow(false)}
 * />
 * ```
 */
export function PvPBattleResult({
  isOpen,
  result,
  onClose,
  onRetry,
  className,
}: PvPBattleResultProps) {
  const isVictory = result?.attackerWon ?? false;

  const scoreDisplay = useMemo(() => {
    if (!result) return null;
    return getRankChangeDisplay(result.scoreChange, isVictory);
  }, [result, isVictory]);

  const handleRetry = useCallback(() => {
    onRetry?.();
    onClose();
  }, [onRetry, onClose]);

  if (!result) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isVictory ? '🎉 胜利' : '💀 失败'}
      type="info"
      confirmText="关闭"
    >
      <div
        style={styles.container}
        className={`tk-pvp-battle-result ${className ?? ''}`.trim()}
        role="region"
        aria-label="PvP战斗结果"
      >
        {/* 结果横幅 */}
        <div style={{
          ...styles.banner,
          background: isVictory
            ? 'linear-gradient(135deg, rgba(126, 200, 80, 0.2), rgba(212, 165, 116, 0.1))'
            : 'linear-gradient(135deg, rgba(184, 66, 58, 0.2), rgba(100, 40, 40, 0.1))',
        }}>
          <span style={{
            ...styles.resultIcon,
            color: isVictory ? '#7EC850' : '#B8423A',
          }}>
            {isVictory ? '🏆' : '💔'}
          </span>
          <span style={{
            ...styles.resultText,
            color: isVictory ? '#7EC850' : '#B8423A',
          }}>
            {isVictory ? '大获全胜' : '惜败而归'}
          </span>
        </div>

        {/* 战斗详情 */}
        <div style={styles.details}>
          {/* 回合数 */}
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>战斗回合</span>
            <span style={styles.detailValue}>{result.totalTurns} 回合</span>
          </div>

          {/* 超时 */}
          {result.isTimeout && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>超时判定</span>
              <span style={styles.timeoutTag}>超时</span>
            </div>
          )}

          {/* 积分变化 */}
          {scoreDisplay && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>积分变化</span>
              <span style={{ ...styles.scoreChange, color: scoreDisplay.color }}>
                {scoreDisplay.text}
              </span>
            </div>
          )}

          {/* 新积分 */}
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>当前积分</span>
            <span style={styles.detailValue}>{result.attackerNewScore}</span>
          </div>

          {/* 对手积分 */}
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>对手积分</span>
            <span style={styles.detailValue}>{result.defenderNewScore}</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={styles.actions}>
          <button style={styles.closeBtn} onClick={onClose}>
            返回
          </button>
          {onRetry && (
            <button style={styles.retryBtn} onClick={handleRetry}>
              再来一次
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    color: '#e8e0d0',
  },
  banner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '16px',
    borderRadius: '10px',
  },
  resultIcon: { fontSize: '36px' },
  resultText: { fontSize: '18px', fontWeight: 700 },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  detailLabel: { fontSize: '12px', color: '#a0a0a0' },
  detailValue: { fontSize: '13px', fontWeight: 600 },
  timeoutTag: {
    fontSize: '11px',
    padding: '2px 6px',
    background: 'rgba(212, 160, 23, 0.2)',
    color: '#d4a017',
    borderRadius: '3px',
  },
  scoreChange: {
    fontSize: '16px',
    fontWeight: 700,
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  closeBtn: {
    flex: 1,
    padding: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    background: 'transparent',
    color: '#a0a0a0',
    fontSize: '13px',
    cursor: 'pointer',
  },
  retryBtn: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '6px',
    background: '#B8423A',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
