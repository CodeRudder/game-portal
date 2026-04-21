/**
 * 三国霸业 v1.0 — 资源栏组件
 *
 * 设计稿：[RES-1] 资源栏 (A区 1280×56px)
 * 显示4种资源：粮草/铜钱/兵力/天命
 * 每个资源显示：图标 + 数值 + 产出速率 + 容量进度条（有上限的资源）
 *
 * 响应式：PC 1280×56px / 手机 375×48px
 */

import React, { useMemo } from 'react';
import type { Resources, ProductionRate, ResourceCap, ResourceType } from '@/games/three-kingdoms/engine';
import { RESOURCE_LABELS } from '@/games/three-kingdoms/engine';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import './ResourceBar.css';

interface ResourceBarProps {
  resources: Resources;
  rates: ProductionRate;
  caps: ResourceCap;
}

/** 资源图标映射 */
const RESOURCE_ICONS: Record<ResourceType, string> = {
  grain: '🌾',
  gold: '💰',
  troops: '⚔️',
  mandate: '👑',
};

/** 资源颜色映射 — [SPEC-1] */
const RESOURCE_COLORS: Record<ResourceType, string> = {
  grain: '#7EC850',
  gold: '#C9A84C',
  troops: '#B8423A',
  mandate: '#7B5EA7',
};

/** 资源排列顺序 */
const RESOURCE_ORDER: ResourceType[] = ['grain', 'gold', 'troops', 'mandate'];

/** 格式化数值：使用统一 formatNumber */
function formatAmount(value: number, _compact: boolean = false): string {
  return formatNumber(value);
}

/** 格式化产出速率 */
function formatRate(rate: number): string {
  if (rate === 0) return '';
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}/秒`;
}

// ─── 单个资源项 ──────────────────────────────────
function ResourceItem({
  type,
  value,
  rate,
  cap,
}: {
  type: ResourceType;
  value: number;
  rate: number;
  cap: number | null;
}) {
  const icon = RESOURCE_ICONS[type];
  const label = RESOURCE_LABELS[type];
  const color = RESOURCE_COLORS[type];
  const hasCap = cap !== null;
  const percentage = hasCap ? Math.min(value / cap!, 1) : 0;
  const rateText = formatRate(rate);

  // 容量警告颜色
  const barColor = useMemo(() => {
    if (!hasCap) return color;
    if (percentage >= 0.95) return '#e74c3c'; // 红
    if (percentage >= 0.8) return '#e67e22';  // 橙
    return color;
  }, [hasCap, percentage, color]);

  return (
    <div className="tk-res-item" title={`${label} ${formatAmount(value)}`}>
      {/* 图标 */}
      <span className="tk-res-icon">{icon}</span>

      {/* 数值区 */}
      <div className="tk-res-info">
        <div className="tk-res-value-row">
          <span className="tk-res-value" style={{ color }}>
            {formatAmount(value)}
          </span>
          {hasCap && (
            <span className="tk-res-cap">
              /{formatAmount(cap!)}
            </span>
          )}
        </div>
        {/* 产出速率 */}
        <span
          className={`tk-res-rate ${rate > 0 ? 'tk-res-rate--positive' : rate < 0 ? 'tk-res-rate--negative' : ''}`}
        >
          {rateText}
        </span>
      </div>

      {/* 容量进度条 — 仅粮草和兵力显示 */}
      {hasCap && (
        <div className="tk-res-cap-bar">
          <div
            className="tk-res-cap-bar-fill"
            style={{
              width: `${percentage * 100}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── 资源栏主组件 ────────────────────────────────
export default function ResourceBar({ resources, rates, caps }: ResourceBarProps) {
  return (
    <div className="tk-resource-bar" role="status" aria-label="资源栏">
      {/* 游戏标题 */}
      <div className="tk-res-title">三国霸业</div>

      {/* 资源列表 */}
      {RESOURCE_ORDER.map(type => (
        <ResourceItem
          key={type}
          type={type}
          value={resources[type]}
          rate={rates[type]}
          cap={caps[type]}
        />
      ))}
    </div>
  );
}
