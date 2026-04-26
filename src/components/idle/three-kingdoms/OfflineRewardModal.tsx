/**
 * OfflineRewardModal — 离线收益弹窗组件
 *
 * 职责：展示玩家离线期间获得的资源收益
 * 从 ThreeKingdomsGame.tsx 拆分出来
 */

import React, { useCallback } from 'react';
import Modal from '@/components/idle/common/Modal';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import type { OfflineEarnings } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 格式化离线时长 */
function formatOfflineDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}天${h % 24}小时`;
  if (h > 0) return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  return `${m}分钟`;
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface OfflineRewardModalProps {
  /** 离线收益数据 */
  reward: OfflineEarnings;
  /** 领取回调 */
  onClaim: () => void;
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

const OfflineRewardModal: React.FC<OfflineRewardModalProps> = ({ reward, onClaim }) => {
  return (
    <Modal
      visible
      type="info"
      title="离线收益"
      confirmText="领取收益"
      onConfirm={onClaim}
      onCancel={onClaim}
      width="420px"
      data-testid="offline-reward-modal"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#e8e0d0' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 'var(--tk-radius-lg)' as any,
          fontSize: '13px',
        }}>
          <span>⏱ 离线时长：{formatOfflineDuration(reward.offlineSeconds)}</span>
          {reward.isCapped && <span style={{ color: '#e8a735' }}>⚠️ 已达上限</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {([
            { key: 'grain' as const, label: '粮草', icon: '🌾', color: '#7EC850' },
            { key: 'gold' as const, label: '铜钱', icon: '💰', color: '#C9A84C' },
            { key: 'troops' as const, label: '兵力', icon: '⚔️', color: '#B8423A' },
            { key: 'mandate' as const, label: '天命', icon: '✨', color: '#7B5EA7' },
            { key: 'techPoint' as const, label: '科技点', icon: '🔬', color: '#4FC3F7' },
            { key: 'recruitToken' as const, label: '招贤令', icon: '📜', color: '#E8A030' },
          ]).map(({ key, label, icon, color }) => {
            const val = reward.earned[key];
            if (val <= 0) return null;
            return (
              <div key={key} data-testid={`offline-reward-${key}`} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 'var(--tk-radius-md)' as any,
              }}>
                <span>{icon}</span>
                <span>{label}</span>
                <span style={{ color, marginLeft: 'auto', fontWeight: 600 }}>+{formatNumber(val)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

OfflineRewardModal.displayName = 'OfflineRewardModal';

export default OfflineRewardModal;
