/**
 * 三国霸业 — 资源栏组件
 *
 * 顶部固定资源栏，显示 4 种核心资源：粮草/铜钱/兵力/天命。
 * 每个资源项显示图标、名称、当前值、产出速率。
 * 容量接近上限时显示进度条和警告色。
 *
 * @module ui/components/ResourceBar
 */

import { useGameContext } from '../context/GameContext';
import type { ResourceType, Resources, ProductionRate, ResourceCap } from '../../shared/types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const RESOURCE_CONFIG: {
  type: ResourceType;
  label: string;
  icon: string;
  color: string;
}[] = [
  { type: 'grain', label: '粮草', icon: '🌾', color: '#7EC850' },
  { type: 'gold', label: '铜钱', icon: '💰', color: '#C9A84C' },
  { type: 'troops', label: '兵力', icon: '⚔️', color: '#B8423A' },
  { type: 'mandate', label: '天命', icon: '✨', color: '#7B5EA7' },
];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

export interface ResourceBarProps {
  /** 额外类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 格式化大数字：10000 → 1.0万 */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.floor(n).toString();
}

/** 计算容量使用百分比 */
function getCapPercent(current: number, cap: number | null): number {
  if (cap === null || cap <= 0) return 0;
  return Math.min((current / cap) * 100, 100);
}

/** 根据容量百分比返回警告颜色 */
function getCapColor(percent: number): string {
  if (percent >= 95) return '#b8423a';
  if (percent >= 80) return '#d4a017';
  if (percent >= 60) return '#d4a574';
  return 'rgba(212, 165, 116, 0.2)';
}

// ─────────────────────────────────────────────
// 子组件：单个资源项
// ─────────────────────────────────────────────

interface ResourceItemProps {
  icon: string;
  label: string;
  color: string;
  value: number;
  rate: number;
  cap: number | null;
}

function ResourceItem({ icon, label, color, value, rate, cap }: ResourceItemProps) {
  const capPercent = getCapPercent(value, cap);
  const showCap = cap !== null && cap > 0;

  return (
    <div style={styles.item}>
      {/* 图标 */}
      <span style={styles.icon}>{icon}</span>

      {/* 信息区 */}
      <div style={styles.info}>
        <div style={styles.labelRow}>
          <span style={styles.label}>{label}</span>
          {rate > 0 && (
            <span style={{ ...styles.rate, color }}>
              +{rate.toFixed(1)}/s
            </span>
          )}
        </div>

        {/* 数值 */}
        <div style={styles.valueRow}>
          <span style={styles.value}>{formatNumber(value)}</span>
          {showCap && (
            <span style={styles.cap}>
              /{formatNumber(cap!)}
            </span>
          )}
        </div>

        {/* 容量进度条 */}
        {showCap && (
          <div style={styles.barBg}>
            <div
              style={{
                ...styles.barFill,
                width: `${capPercent}%`,
                backgroundColor: getCapColor(capPercent),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

/**
 * ResourceBar — 资源栏组件
 *
 * @example
 * ```tsx
 * <ResourceBar />
 * ```
 */
export function ResourceBar({ className }: ResourceBarProps) {
  const { snapshot } = useGameContext();

  if (!snapshot) {
    return <div style={styles.container} className={className}>加载中...</div>;
  }

  const { resources, productionRates, caps } = snapshot;

  return (
    <div
      style={styles.container}
      className={`tk-resource-bar ${className ?? ''}`.trim()}
      role="status"
      aria-label="资源栏"
    >
      {RESOURCE_CONFIG.map((cfg) => (
        <ResourceItem
          key={cfg.type}
          icon={cfg.icon}
          label={cfg.label}
          color={cfg.color}
          value={resources[cfg.type]}
          rate={productionRates[cfg.type]}
          cap={caps[cfg.type]}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 样式
// ─────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: '4px',
    padding: '8px 12px',
    background: 'rgba(13, 17, 23, 0.95)',
    borderBottom: '1px solid rgba(212, 165, 116, 0.3)',
    color: '#e8e0d0',
    fontSize: '13px',
    flexWrap: 'wrap',
    minHeight: '52px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    minWidth: '0',
    flex: '1 1 auto',
  },
  icon: {
    fontSize: '18px',
    flexShrink: 0,
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    minWidth: '0',
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  label: {
    fontSize: '11px',
    color: '#a0a0a0',
    whiteSpace: 'nowrap',
  },
  rate: {
    fontSize: '10px',
    fontWeight: 600,
  },
  valueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '2px',
  },
  value: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#e8e0d0',
  },
  cap: {
    fontSize: '10px',
    color: '#a0a0a0',
  },
  barBg: {
    width: '100%',
    height: '3px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
};
