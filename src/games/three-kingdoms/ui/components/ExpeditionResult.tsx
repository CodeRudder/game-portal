/**
 * 三国霸业 — 远征结果面板组件
 *
 * 展示远征收益、事件、发现。
 * 包含评级、奖励列表、特殊发现。
 *
 * @module ui/components/ExpeditionResult
 */

import { useCallback, useMemo } from 'react';
import { Modal } from './Modal';
import {
  GRADE_LABELS,
  GRADE_STARS,
} from '../../core/expedition/expedition.types';
import type {
  ExpeditionReward,
  ExpeditionBattleResult,
  DropItem,
  BattleGrade,
} from '../../core/expedition/expedition.types';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface ExpeditionResultProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 战斗结果 */
  battleResult: ExpeditionBattleResult | null;
  /** 远征奖励 */
  reward: ExpeditionReward | null;
  /** 发现物品列表 */
  discoveries?: DropItem[];
  /** 关闭回调 */
  onClose: () => void;
  /** 继续远征回调 */
  onContinue?: () => void;
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.floor(n).toString();
}

const GRADE_COLORS: Record<BattleGrade, string> = {
  GREAT_VICTORY: '#FFD700',
  MINOR_VICTORY: '#7EC850',
  PYRRHIC_VICTORY: '#d4a017',
  NARROW_DEFEAT: '#B8423A',
};

const DROP_TYPE_ICONS: Record<string, string> = {
  equip_fragment: '🔧',
  hero_fragment: '🧩',
  skill_book: '📖',
  rare_material: '💎',
  legendary_equip: '⚔️',
};

// ─────────────────────────────────────────────
// 子组件：奖励项
// ─────────────────────────────────────────────

interface RewardRowProps {
  icon: string;
  label: string;
  value: number;
  color?: string;
}

function RewardRow({ icon, label, value, color = '#e8e0d0' }: RewardRowProps) {
  return (
    <div style={rowStyles.container}>
      <span style={rowStyles.icon}>{icon}</span>
      <span style={rowStyles.label}>{label}</span>
      <span style={{ ...rowStyles.value, color }}>
        {value > 0 ? `+${formatNumber(value)}` : '—'}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 子组件：发现物品
// ─────────────────────────────────────────────

interface DiscoveryItemProps {
  item: DropItem;
}

function DiscoveryItem({ item }: DiscoveryItemProps) {
  const icon = DROP_TYPE_ICONS[item.type] ?? '🎁';
  return (
    <div style={discStyles.container}>
      <span style={discStyles.icon}>{icon}</span>
      <div style={discStyles.info}>
        <span style={discStyles.name}>{item.name}</span>
        <span style={discStyles.type}>{item.type.replace(/_/g, ' ')}</span>
      </div>
      <span style={discStyles.count}>×{item.count}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * ExpeditionResult — 远征结果面板
 *
 * @example
 * ```tsx
 * <ExpeditionResult
 *   isOpen={show}
 *   battleResult={result}
 *   reward={reward}
 *   onClose={() => setShow(false)}
 * />
 * ```
 */
export function ExpeditionResult({
  isOpen,
  battleResult,
  reward,
  discoveries = [],
  onClose,
  onContinue,
  className,
}: ExpeditionResultProps) {
  const gradeColor = battleResult ? GRADE_COLORS[battleResult.grade] : '#a0a0a0';
  const stars = battleResult ? GRADE_STARS[battleResult.grade] : 0;
  const isVictory = battleResult ? stars > 0 : false;

  const handleContinue = useCallback(() => {
    onContinue?.();
    onClose();
  }, [onContinue, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="远征结果"
      type="info"
      confirmText="关闭"
    >
      <div
        style={styles.container}
        className={`tk-expedition-result ${className ?? ''}`.trim()}
        role="region"
        aria-label="远征结果"
      >
        {/* 评级横幅 */}
        {battleResult && (
          <div style={{
            ...styles.gradeBanner,
            background: `linear-gradient(135deg, ${gradeColor}20, ${gradeColor}08)`,
          }}>
            <div style={{ ...styles.gradeLabel, color: gradeColor }}>
              {GRADE_LABELS[battleResult.grade]}
            </div>
            <div style={styles.gradeStars}>
              {Array.from({ length: 3 }, (_, i) => (
                <span key={i} style={{ opacity: i < stars ? 1 : 0.2 }}>⭐</span>
              ))}
            </div>
            <div style={styles.gradeDetails}>
              <span>回合数：{battleResult.totalTurns}</span>
              {battleResult.allyDeaths > 0 && (
                <span style={styles.deathCount}>阵亡：{battleResult.allyDeaths}</span>
              )}
            </div>
          </div>
        )}

        {/* 奖励列表 */}
        {reward && (
          <div style={styles.rewardSection}>
            <div style={styles.sectionTitle}>🎁 远征奖励</div>
            <RewardRow icon="🌾" label="粮草" value={reward.grain} color="#7EC850" />
            <RewardRow icon="💰" label="铜钱" value={reward.gold} color="#C9A84C" />
            <RewardRow icon="⛏️" label="铁矿" value={reward.iron} color="#8B7355" />
            <RewardRow icon="🔧" label="装备碎片" value={reward.equipFragments} color="#9B59B6" />
            <RewardRow icon="📊" label="经验值" value={reward.exp} color="#5B9BD5" />
          </div>
        )}

        {/* 掉落物品 */}
        {reward && reward.drops.length > 0 && (
          <div style={styles.dropSection}>
            <div style={styles.sectionTitle}>✨ 战利品</div>
            {reward.drops.map((drop, idx) => (
              <DiscoveryItem key={drop.id + idx} item={drop} />
            ))}
          </div>
        )}

        {/* 特殊发现 */}
        {discoveries.length > 0 && (
          <div style={styles.discoverySection}>
            <div style={styles.sectionTitle}>🔍 特殊发现</div>
            {discoveries.map((d, idx) => (
              <DiscoveryItem key={d.id + idx} item={d} />
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div style={styles.actions}>
          <button style={styles.closeBtn} onClick={onClose}>
            返回
          </button>
          {isVictory && onContinue && (
            <button style={styles.continueBtn} onClick={handleContinue}>
              继续远征
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
  gradeBanner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '14px',
    borderRadius: '10px',
  },
  gradeLabel: { fontSize: '20px', fontWeight: 700 },
  gradeStars: { fontSize: '18px', display: 'flex', gap: '2px' },
  gradeDetails: {
    display: 'flex',
    gap: '12px',
    fontSize: '11px',
    color: '#a0a0a0',
    marginTop: '4px',
  },
  deathCount: { color: '#B8423A' },
  rewardSection: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '8px',
  },
  dropSection: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
  },
  discoverySection: {
    padding: '8px 12px',
    background: 'rgba(212, 165, 116, 0.06)',
    borderRadius: '8px',
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
  continueBtn: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '6px',
    background: 'linear-gradient(135deg, #d4a574, #B8423A)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

const rowStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  icon: { fontSize: '14px', width: '20px', textAlign: 'center' },
  label: { flex: 1, fontSize: '12px', color: '#a0a0a0' },
  value: { fontSize: '13px', fontWeight: 600 },
};

const discStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0',
  },
  icon: { fontSize: '16px' },
  info: { flex: 1 },
  name: { fontSize: '12px', color: '#e8e0d0', display: 'block' },
  type: { fontSize: '10px', color: '#666' },
  count: { fontSize: '13px', fontWeight: 600, color: '#d4a574' },
};
