/**
 * OfflineRewardModal — 离线奖励弹窗
 *
 * 功能：
 * - 离线>10秒后上线，弹出离线奖励弹窗
 * - 显示离线时长(格式: X小时X分)
 * - 列出所有离线事件(资源积累/山贼袭击/商队经过等)
 * - 显示资源奖励汇总(金币/粮草/兵力分别显示)
 * - 点击"领取"将资源加入产出系统
 * - 领取后弹窗关闭，资源数量更新
 * - 离线时长上限24小时(超过按24小时计算)
 * - 关闭后不重复弹出
 *
 * @module components/idle/panels/map/OfflineRewardModal
 */

import React, { useMemo } from 'react';
import SharedPanel from '@/components/idle/components/SharedPanel';
import type { OfflineEvent } from '@/games/three-kingdoms/engine/map/OfflineEventSystem';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export interface OfflineRewardModalProps {
  /** 是否显示弹窗 */
  visible: boolean;
  /** 离线时长(毫秒) */
  offlineDuration: number;
  /** 离线事件列表 */
  events: OfflineEvent[];
  /** 领取奖励回调 */
  onClaim: () => void;
  /** 关闭弹窗回调 */
  onClose: () => void;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 最大离线时长(毫秒) — 24小时 */
const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000;

/** 资源图标映射 */
const RESOURCE_ICONS: Record<string, string> = {
  gold: '💰',
  grain: '🌾',
  troops: '⚔️',
  mandate: '👑',
};

/** 资源名称映射 */
const RESOURCE_LABELS: Record<string, string> = {
  gold: '金币',
  grain: '粮草',
  troops: '兵力',
  mandate: '天命',
};

/** 事件类型图标 */
const EVENT_TYPE_ICONS: Record<string, string> = {
  resource_accumulate: '📦',
  bandit_raid: '🗡️',
  caravan_visit: '🐫',
  refugee_arrival: '👥',
  trade_complete: '🤝',
  morale_change: '😊',
};

/** 事件类型名称 */
const EVENT_TYPE_LABELS: Record<string, string> = {
  resource_accumulate: '资源积累',
  bandit_raid: '山贼袭击',
  caravan_visit: '商队经过',
  refugee_arrival: '流民涌入',
  trade_complete: '贸易完成',
  morale_change: '士气变化',
};

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  wrap: { padding: 16, color: '#e8e0d0', minHeight: '100%' },
  durationBox: {
    textAlign: 'center',
    padding: '16px 12px',
    marginBottom: 16,
    borderRadius: 'var(--tk-radius-lg)' as any,
    background: 'rgba(212,165,116,0.08)',
    border: '1px solid rgba(212,165,116,0.2)',
  },
  durationIcon: { fontSize: 36, marginBottom: 6 },
  durationTitle: { fontSize: 18, fontWeight: 700, color: '#d4a574' },
  durationSub: { fontSize: 12, color: '#a0a0a0', marginTop: 4 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1px solid rgba(212,165,116,0.2)',
  },
  rewardCard: {
    padding: 12,
    background: 'rgba(126,200,80,0.06)',
    border: '1px solid rgba(126,200,80,0.15)',
    borderRadius: 'var(--tk-radius-lg)' as any,
  },
  resourceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    fontSize: 14,
  },
  resourceLabel: { color: '#a0a0a0', display: 'flex', alignItems: 'center', gap: 6 },
  resourceValue: { color: '#7EC850', fontWeight: 700, fontSize: 16 },
  eventList: { maxHeight: 200, overflowY: 'auto' as const },
  eventItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '8px 10px',
    marginBottom: 4,
    borderRadius: 6,
    background: 'rgba(255,255,255,0.03)',
    fontSize: 13,
    lineHeight: 1.4,
  },
  eventIcon: { fontSize: 16, flexShrink: 0, marginTop: 1 },
  eventContent: { flex: 1 },
  eventType: { color: '#d4a574', fontSize: 11, marginBottom: 2 },
  eventDesc: { color: '#e8e0d0' },
  divider: { height: 1, background: 'rgba(255,255,255,0.08)', margin: '12px 0' },
  noRewardHint: {
    textAlign: 'center' as const,
    padding: 16,
    color: '#a0a0a0',
    fontSize: 13,
  },
  claimBtn: {
    display: 'block',
    width: '100%',
    padding: '14px 24px',
    marginTop: 16,
    border: '1px solid rgba(126,200,80,0.4)',
    borderRadius: 'var(--tk-radius-lg)' as any,
    background: 'rgba(126,200,80,0.15)',
    color: '#7EC850',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
  },
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/**
 * 格式化离线时长: X小时X分
 */
function formatOfflineDuration(ms: number): string {
  const cappedMs = Math.min(ms, MAX_OFFLINE_MS);
  const totalMinutes = Math.floor(cappedMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分`;
  if (hours > 0) return `${hours}小时`;
  if (minutes > 0) return `${minutes}分`;
  return '不到1分钟';
}

/**
 * 从事件列表中汇总资源奖励
 */
function summarizeRewards(events: OfflineEvent[]): Record<string, number> {
  const rewards: Record<string, number> = { gold: 0, grain: 0, troops: 0, mandate: 0 };

  for (const event of events) {
    const data = event.data;

    switch (event.type) {
      case 'resource_accumulate': {
        const resource = data.resource as string;
        const amount = data.amount as number;
        if (resource && amount) {
          rewards[resource] = (rewards[resource] || 0) + amount;
        }
        break;
      }
      case 'caravan_visit':
      case 'trade_complete': {
        const goldGained = data.goldGained as number;
        if (goldGained) rewards.gold += goldGained;
        break;
      }
      case 'refugee_arrival': {
        const troopsGained = data.troopsGained as number;
        const grainCost = data.grainCost as number;
        if (troopsGained) rewards.troops += troopsGained;
        if (grainCost) rewards.grain -= grainCost;
        break;
      }
      case 'bandit_raid': {
        const troopsLost = data.troopsLost as number;
        const goldLost = data.goldLost as number;
        if (troopsLost) rewards.troops -= troopsLost;
        if (goldLost) rewards.gold -= goldLost;
        break;
      }
      // morale_change 不影响资源
    }
  }

  // 确保没有负值（损失不能超过积累）
  for (const key of Object.keys(rewards)) {
    rewards[key] = Math.max(0, rewards[key]);
  }

  return rewards;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const OfflineRewardModal: React.FC<OfflineRewardModalProps> = ({
  visible,
  offlineDuration,
  events,
  onClaim,
  onClose,
}) => {
  // ── 格式化离线时长 ──
  const formattedDuration = useMemo(
    () => formatOfflineDuration(offlineDuration),
    [offlineDuration],
  );

  // ── 资源奖励汇总 ──
  const rewardSummary = useMemo(() => summarizeRewards(events), [events]);

  // ── 是否有净奖励 ──
  const hasRewards = useMemo(
    () => Object.values(rewardSummary).some((v) => v > 0),
    [rewardSummary],
  );

  // ── 事件统计 ──
  const eventStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const event of events) {
      stats[event.type] = (stats[event.type] || 0) + 1;
    }
    return stats;
  }, [events]);

  // ── 是否达到上限 ──
  const isCapped = offlineDuration > MAX_OFFLINE_MS;

  return (
    <SharedPanel
      visible={visible}
      title="离线奖励"
      icon="🎁"
      onClose={onClose}
      width="440px"
      data-testid="offline-reward-modal"
    >
      <div style={s.wrap} data-testid="offline-reward-content">
        {/* ── 离线时长 ── */}
        <div style={s.durationBox} data-testid="offline-duration">
          <div style={s.durationIcon}>⏰</div>
          <div style={s.durationTitle}>
            离线 {formattedDuration}
          </div>
          {isCapped && (
            <div style={s.durationSub}>
              (已按24小时上限计算)
            </div>
          )}
        </div>

        {/* ── 资源奖励汇总 ── */}
        <div style={s.section} data-testid="offline-rewards-summary">
          <div style={s.sectionTitle}>资源奖励</div>
          {hasRewards ? (
            <div style={s.rewardCard}>
              {Object.entries(rewardSummary).map(([resource, amount]) =>
                amount > 0 ? (
                  <div key={resource} style={s.resourceRow}>
                    <span style={s.resourceLabel}>
                      <span>{RESOURCE_ICONS[resource] ?? '📦'}</span>
                      <span>{RESOURCE_LABELS[resource] ?? resource}</span>
                    </span>
                    <span style={s.resourceValue}>+{amount.toLocaleString()}</span>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <div style={s.noRewardHint}>离线期间无资源奖励</div>
          )}
        </div>

        {/* ── 事件列表 ── */}
        {events.length > 0 && (
          <div style={s.section} data-testid="offline-events-list">
            <div style={s.sectionTitle}>
              离线事件 ({events.length})
            </div>
            <div style={s.eventList}>
              {events.slice(0, 20).map((event) => (
                <div
                  key={event.id}
                  style={s.eventItem}
                  data-testid={`offline-event-${event.id}`}
                >
                  <span style={s.eventIcon}>
                    {EVENT_TYPE_ICONS[event.type] ?? '📋'}
                  </span>
                  <div style={s.eventContent}>
                    <div style={s.eventType}>
                      {EVENT_TYPE_LABELS[event.type] ?? event.type}
                    </div>
                    <div style={s.eventDesc}>{event.description}</div>
                  </div>
                </div>
              ))}
              {events.length > 20 && (
                <div style={{ ...s.eventItem, justifyContent: 'center', color: '#a0a0a0' }}>
                  ...还有 {events.length - 20} 个事件
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 事件统计 ── */}
        {events.length > 0 && (
          <div style={s.section} data-testid="offline-event-stats">
            <div style={s.sectionTitle}>事件统计</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(eventStats).map(([type, count]) => (
                <div
                  key={type}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    fontSize: 12,
                    color: '#a0a0a0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{EVENT_TYPE_ICONS[type] ?? '📋'}</span>
                  <span>{EVENT_TYPE_LABELS[type] ?? type}</span>
                  <span style={{ color: '#d4a574', fontWeight: 600 }}>x{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={s.divider} />

        {/* ── 领取按钮 ── */}
        <button
          style={s.claimBtn}
          onClick={onClaim}
          data-testid="offline-reward-claim"
        >
          领取奖励
        </button>
      </div>
    </SharedPanel>
  );
};

export default OfflineRewardModal;
