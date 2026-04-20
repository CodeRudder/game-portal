/**
 * 三国霸业 — 离线收益弹窗组件
 *
 * 展示离线时长、效率系数、各资源收益、来源占比。
 * 支持翻倍领取和普通领取。
 *
 * @module ui/components/OfflineRewardModal
 */

import { useCallback, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import { Modal } from './Modal';
import type { Resources, ResourceType } from '../../shared/types';
import type { OfflineSnapshot, DoubleRequest } from '../../engine/offline/offline.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const RESOURCE_META: Record<keyof Resources, { label: string; icon: string; color: string }> = {
  grain:   { label: '粮草', icon: '🌾', color: '#7EC850' },
  gold:    { label: '铜钱', icon: '💰', color: '#C9A84C' },
  troops:  { label: '兵力', icon: '⚔️', color: '#B8423A' },
  mandate: { label: '天命', icon: '✨', color: '#7B5EA7' },
};

const RESOURCE_ORDER: (keyof Resources)[] = ['grain', 'gold', 'troops', 'mandate'];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface OfflineRewardModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 离线快照数据 */
  snapshot: OfflineSnapshot | null;
  /** 可用翻倍选项 */
  availableDoubles?: DoubleRequest[];
  /** 关闭回调 */
  onClose: () => void;
  /** 领取回调（isDoubled: 是否翻倍） */
  onClaim?: (isDoubled: boolean) => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 格式化大数字 */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.floor(n).toString();
}

/** 格式化离线时长 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return '刚刚';
  if (seconds < 60) return `${Math.floor(seconds)}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const d = Math.floor(h / 24);
  if (d > 0) { const rh = h % 24; return rh > 0 ? `${d}天${rh}小时` : `${d}天`; }
  if (h > 0) { return m > 0 ? `${h}小时${m}分钟` : `${h}小时`; }
  return `${m}分钟`;
}

/** 计算资源来源占比 */
function getSourceBreakdown(tierDetails: OfflineSnapshot['tierDetails']): { tierId: string; percent: number }[] {
  if (!tierDetails.length) return [];
  const totalGrain = tierDetails.reduce((s, t) => s + t.earned.grain, 0) || 1;
  return tierDetails.map((t) => ({
    tierId: t.tierId,
    percent: Math.round((t.earned.grain / totalGrain) * 100),
  }));
}

// ─────────────────────────────────────────────
// 子组件：资源收益项
// ─────────────────────────────────────────────

interface RewardItemProps {
  type: keyof Resources;
  value: number;
}

function RewardItem({ type, value }: RewardItemProps) {
  const meta = RESOURCE_META[type];
  return (
    <div style={styles.rewardItem}>
      <span style={styles.rewardIcon}>{meta.icon}</span>
      <span style={styles.rewardLabel}>{meta.label}</span>
      <span style={{ ...styles.rewardValue, color: meta.color }}>+{formatNumber(value)}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * OfflineRewardModal — 离线收益弹窗
 *
 * @example
 * ```tsx
 * <OfflineRewardModal
 *   isOpen={show}
 *   snapshot={offlineSnapshot}
 *   onClose={() => setShow(false)}
 *   onClaim={(doubled) => { ... }}
 * />
 * ```
 */
export function OfflineRewardModal({
  isOpen,
  snapshot,
  availableDoubles = [],
  onClose,
  onClaim,
  className,
}: OfflineRewardModalProps) {
  const breakdown = useMemo(
    () => (snapshot ? getSourceBreakdown(snapshot.tierDetails) : []),
    [snapshot],
  );

  const handleClaim = useCallback(
    (doubled: boolean) => { onClaim?.(doubled); onClose(); },
    [onClaim, onClose],
  );

  if (!snapshot) return null;

  const efficiencyPercent = Math.round(snapshot.overallEfficiency * 100);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="离线收益" type="info" confirmText="领取">
      <div
        style={styles.container}
        className={`tk-offline-reward-modal ${className ?? ''}`.trim()}
        role="region"
        aria-label="离线收益详情"
      >
        {/* 离线时长 */}
        <div style={styles.header}>
          <div style={styles.duration}>
            <span style={styles.durationIcon}>⏱</span>
            <span>离线时长：{formatDuration(snapshot.offlineSeconds)}</span>
          </div>
          <div style={styles.efficiency}>
            <span style={styles.efficiencyIcon}>📊</span>
            <span>效率系数：{efficiencyPercent}%</span>
          </div>
        </div>

        {/* 各资源收益 */}
        <div style={styles.rewardGrid}>
          {RESOURCE_ORDER.map((key) => (
            <RewardItem key={key} type={key} value={snapshot.totalEarned[key]} />
          ))}
        </div>

        {/* 来源占比 */}
        {breakdown.length > 0 && (
          <div style={styles.breakdown}>
            <div style={styles.breakdownTitle}>来源占比</div>
            {breakdown.map((b) => (
              <div key={b.tierId} style={styles.breakdownRow}>
                <span style={styles.breakdownLabel}>{b.tierId}</span>
                <div style={styles.breakdownBarBg}>
                  <div style={{ ...styles.breakdownBarFill, width: `${b.percent}%` }} />
                </div>
                <span style={styles.breakdownPercent}>{b.percent}%</span>
              </div>
            ))}
          </div>
        )}

        {/* 封顶提示 */}
        {snapshot.isCapped && (
          <div style={styles.capNotice}>⚠️ 已达到离线收益上限</div>
        )}

        {/* 翻倍按钮 */}
        {availableDoubles.length > 0 && (
          <div style={styles.doubleActions}>
            {availableDoubles.map((d, i) => (
              <button
                key={d.source}
                style={{ ...styles.doubleBtn, backgroundColor: i === 0 ? '#d4a574' : '#5B9BD5' }}
                onClick={() => handleClaim(true)}
              >
                {d.description}
              </button>
            ))}
          </div>
        )}

        {/* 普通领取 */}
        <button style={styles.claimBtn} onClick={() => handleClaim(false)}>
          领取收益
        </button>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    fontSize: '13px',
  },
  duration: { display: 'flex', alignItems: 'center', gap: '4px' },
  durationIcon: { fontSize: '16px' },
  efficiency: { display: 'flex', alignItems: 'center', gap: '4px' },
  efficiencyIcon: { fontSize: '16px' },
  rewardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '8px',
  },
  rewardItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '6px',
  },
  rewardIcon: { fontSize: '18px' },
  rewardLabel: { fontSize: '12px', color: '#a0a0a0', flex: 1 },
  rewardValue: { fontSize: '14px', fontWeight: 700 },
  breakdown: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
  },
  breakdownTitle: { fontSize: '12px', color: '#d4a574', marginBottom: '6px' },
  breakdownRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
    fontSize: '11px',
  },
  breakdownLabel: { width: '60px', color: '#a0a0a0' },
  breakdownBarBg: {
    flex: 1,
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    background: '#d4a574',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  breakdownPercent: { width: '36px', textAlign: 'right', color: '#a0a0a0' },
  capNotice: {
    fontSize: '12px',
    color: '#d4a017',
    textAlign: 'center',
    padding: '6px',
  },
  doubleActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  doubleBtn: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#1a1a2e',
    cursor: 'pointer',
    minWidth: '120px',
  },
  claimBtn: {
    width: '100%',
    padding: '10px',
    border: '1px solid rgba(212, 165, 116, 0.3)',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#e8e0d0',
    background: 'rgba(212, 165, 116, 0.15)',
    cursor: 'pointer',
  },
};
