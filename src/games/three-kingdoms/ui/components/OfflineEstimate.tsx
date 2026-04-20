/**
 * 三国霸业 — 离线预估面板组件
 *
 * 滑块选择预估时长，展示各资源预估收益和效率系数。
 * 帮助玩家规划离线策略。
 *
 * @module ui/components/OfflineEstimate
 */

import { useState, useCallback, useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import type { Resources, ProductionRate } from '../../shared/types';

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

/** 滑块预设时长（小时） */
const PRESET_HOURS = [1, 2, 4, 8, 12, 24, 48, 72];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface OfflineEstimateProps {
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.floor(n).toString();
}

/** 5档衰减效率 */
const DECAY_TIERS = [
  { startHours: 0, endHours: 2, efficiency: 1.0, label: '0-2h' },
  { startHours: 2, endHours: 6, efficiency: 0.8, label: '2-6h' },
  { startHours: 6, endHours: 12, efficiency: 0.6, label: '6-12h' },
  { startHours: 12, endHours: 24, efficiency: 0.4, label: '12-24h' },
  { startHours: 24, endHours: 48, efficiency: 0.2, label: '24-48h' },
];

const MAX_OFFLINE_HOURS = 72;

/** 计算预估收益 */
function estimateEarnings(
  hours: number,
  rates: ProductionRate,
): { earned: Resources; overallEfficiency: number; isCapped: boolean } {
  const cappedHours = Math.min(hours, MAX_OFFLINE_HOURS);
  const isCapped = hours > MAX_OFFLINE_HOURS;
  let totalWeighted = 0;
  const earned: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0 };

  for (const tier of DECAY_TIERS) {
    if (cappedHours <= tier.startHours) break;
    const secondsInTier = (Math.min(cappedHours, tier.endHours) - tier.startHours) * 3600;
    if (secondsInTier <= 0) continue;

    for (const key of RESOURCE_ORDER) {
      earned[key] += rates[key] * secondsInTier * tier.efficiency;
    }
    totalWeighted += secondsInTier * tier.efficiency;
  }

  const totalSeconds = cappedHours * 3600;
  const overallEfficiency = totalSeconds > 0 ? totalWeighted / totalSeconds : 1.0;

  return { earned, overallEfficiency, isCapped };
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * OfflineEstimate — 离线预估面板
 *
 * @example
 * ```tsx
 * <OfflineEstimate />
 * ```
 */
export function OfflineEstimate({ className }: OfflineEstimateProps) {
  const { snapshot } = useGameContext();
  const [hours, setHours] = useState(8);

  const estimate = useMemo(() => {
    if (!snapshot) return null;
    return estimateEarnings(hours, snapshot.productionRates);
  }, [hours, snapshot]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHours(Number(e.target.value));
  }, []);

  const handlePreset = useCallback((h: number) => {
    setHours(h);
  }, []);

  if (!snapshot) {
    return <div style={styles.loading}>加载中...</div>;
  }

  const efficiencyPercent = estimate ? Math.round(estimate.overallEfficiency * 100) : 0;

  return (
    <div
      style={styles.container}
      className={`tk-offline-estimate ${className ?? ''}`.trim()}
      role="region"
      aria-label="离线预估"
    >
      <div style={styles.title}>📈 离线收益预估</div>

      {/* 时长选择 */}
      <div style={styles.sliderSection}>
        <div style={styles.sliderHeader}>
          <span>预估时长</span>
          <span style={styles.hoursDisplay}>{hours}小时</span>
        </div>
        <input
          type="range"
          min="1"
          max="72"
          value={hours}
          onChange={handleSliderChange}
          style={styles.slider}
          aria-label="预估离线时长"
        />
        <div style={styles.presetRow}>
          {PRESET_HOURS.map((h) => (
            <button
              key={h}
              style={{
                ...styles.presetBtn,
                ...(h === hours ? styles.presetBtnActive : {}),
              }}
              onClick={() => handlePreset(h)}
            >
              {h < 24 ? `${h}h` : `${h / 24}d`}
            </button>
          ))}
        </div>
      </div>

      {/* 效率系数 */}
      <div style={styles.efficiencyBar}>
        <span style={styles.efficiencyLabel}>综合效率</span>
        <div style={styles.efficiencyBarBg}>
          <div
            style={{
              ...styles.efficiencyBarFill,
              width: `${efficiencyPercent}%`,
              backgroundColor: efficiencyPercent > 60 ? '#7EC850' : efficiencyPercent > 30 ? '#d4a017' : '#B8423A',
            }}
          />
        </div>
        <span style={styles.efficiencyValue}>{efficiencyPercent}%</span>
      </div>

      {/* 各资源预估 */}
      {estimate && (
        <div style={styles.estimateGrid}>
          {RESOURCE_ORDER.map((key) => {
            const meta = RESOURCE_META[key];
            return (
              <div key={key} style={styles.estimateItem}>
                <span style={styles.estimateIcon}>{meta.icon}</span>
                <span style={styles.estimateLabel}>{meta.label}</span>
                <span style={{ ...styles.estimateValue, color: meta.color }}>
                  +{formatNumber(estimate.earned[key])}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 封顶提示 */}
      {estimate?.isCapped && (
        <div style={styles.capNotice}>
          ⚠️ 超过{MAX_OFFLINE_HOURS}小时后收益不再增加
        </div>
      )}
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
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#d4a574',
    marginBottom: '12px',
  },
  sliderSection: {
    padding: '12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '13px',
  },
  hoursDisplay: {
    fontWeight: 700,
    color: '#d4a574',
    fontSize: '15px',
  },
  slider: {
    width: '100%',
    accentColor: '#d4a574',
    cursor: 'pointer',
  },
  presetRow: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  presetBtn: {
    padding: '4px 8px',
    border: '1px solid rgba(212, 165, 116, 0.2)',
    borderRadius: '4px',
    background: 'transparent',
    color: '#a0a0a0',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  presetBtnActive: {
    background: 'rgba(212, 165, 116, 0.2)',
    color: '#d4a574',
    borderColor: '#d4a574',
  },
  efficiencyBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    marginBottom: '12px',
    fontSize: '12px',
  },
  efficiencyLabel: { color: '#a0a0a0', whiteSpace: 'nowrap' },
  efficiencyBarBg: {
    flex: 1,
    height: '8px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  efficiencyBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  efficiencyValue: { fontWeight: 700, color: '#e8e0d0', minWidth: '36px', textAlign: 'right' },
  estimateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '8px',
  },
  estimateItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '6px',
  },
  estimateIcon: { fontSize: '18px' },
  estimateLabel: { fontSize: '12px', color: '#a0a0a0', flex: 1 },
  estimateValue: { fontSize: '14px', fontWeight: 700 },
  capNotice: {
    fontSize: '12px',
    color: '#d4a017',
    textAlign: 'center',
    padding: '8px',
    marginTop: '8px',
  },
};
