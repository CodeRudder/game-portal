/**
 * 三国霸业 v1.0 — 资源栏组件
 *
 * 设计稿：[RES-1] 资源栏 (A区 1280×56px)
 * 显示4种资源：粮草/铜钱/兵力/天命
 * 每个资源显示：图标 + 数值 + 产出速率 + 容量进度条（有上限的资源）
 * RES-CAP-02: 资源接近/达到上限时显示警告提示
 *
 * 响应式：PC 1280×56px / 手机 375×48px
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Resources, ProductionRate, ResourceCap, ResourceType } from '@/games/three-kingdoms/engine';
import { RESOURCE_LABELS } from '@/games/three-kingdoms/engine';
import { BUILDING_LABELS, BUILDING_ICONS } from '@/games/three-kingdoms/engine';
import type { BuildingState, BuildingType } from '@/games/three-kingdoms/engine';
import { BUILDING_DEFS } from '@/games/three-kingdoms/engine';
import { formatNumber } from '@/components/idle/utils/formatNumber';
import './ResourceBar.css';

interface ResourceBarProps {
  resources: Resources;
  rates: ProductionRate;
  caps: ResourceCap;
  /** RES-CAP-02: 即将获得的临时收入（如战斗奖励），用于预判溢出 */
  pendingGains?: Partial<Record<ResourceType, number>>;
  /** 建筑状态，用于收支详情弹窗 */
  buildings?: Record<BuildingType, BuildingState>;
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

/** 资源脉冲动画颜色 — 功能点#12 粒子效果 */
const RESOURCE_PULSE_COLORS: Record<ResourceType, string> = {
  grain: 'rgba(126, 200, 80, 0.6)',   // 绿色
  gold: 'rgba(201, 168, 76, 0.6)',     // 金色
  troops: 'rgba(184, 66, 58, 0.6)',    // 红色
  mandate: 'rgba(123, 94, 167, 0.6)',  // 紫色
};

/** 格式化数值：使用统一 formatNumber，compact 模式同标准模式 */
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
  pendingGain,
}: {
  type: ResourceType;
  value: number;
  rate: number;
  cap: number | null;
  /** RES-CAP-02: 即将获得的临时收入 */
  pendingGain?: number;
}) {
  const icon = RESOURCE_ICONS[type];
  const label = RESOURCE_LABELS[type];
  const color = RESOURCE_COLORS[type];
  const hasCap = cap !== null;
  const percentage = hasCap ? Math.min(value / cap!, 1) : 0;
  const rateText = formatRate(rate);

  // ── 功能点#12: 资源产出脉冲动画 ──
  const prevValueRef = useRef(value);
  const [pulsing, setPulsing] = useState(false);
  const pulseColor = RESOURCE_PULSE_COLORS[type];

  useEffect(() => {
    if (prevValueRef.current !== value) {
      // 仅在数值增加时触发脉冲（产出反馈）
      if (value > prevValueRef.current) {
        setPulsing(true);
        const timer = setTimeout(() => setPulsing(false), 400);
        return () => clearTimeout(timer);
      }
      prevValueRef.current = value;
    }
  }, [value]);

  // RES-CAP-02: 计算溢出情况
  const overflowInfo = useMemo(() => {
    if (!hasCap || cap === null || !pendingGain || pendingGain <= 0) return null;
    const totalAfterGain = value + pendingGain;
    if (totalAfterGain <= cap) return null;
    const wasted = totalAfterGain - cap;
    return { wasted, totalAfterGain, cap };
  }, [hasCap, cap, value, pendingGain]);

  // 容量警告颜色
  const barColor = useMemo(() => {
    if (!hasCap) return color;
    if (percentage >= 0.95) return '#e74c3c'; // 红
    if (percentage >= 0.8) return '#e67e22';  // 橙
    return color;
  }, [hasCap, percentage, color]);

  // RES-CAP-02: 容量警告级别文本
  const warningLevel = useMemo(() => {
    if (!hasCap) return null;
    if (percentage >= 1) return 'full';
    if (percentage >= 0.95) return 'urgent';
    if (percentage >= 0.8) return 'warning';
    return null;
  }, [hasCap, percentage]);

  return (
    <div
      className={`tk-res-item ${warningLevel ? `tk-res-item--${warningLevel}` : ''} ${pulsing ? 'tk-res-item--pulse' : ''}`}
      data-testid={`resource-bar-item-${type}`}
      style={pulsing ? { '--tk-pulse-color': pulseColor } as React.CSSProperties : undefined}
      title={`${label} ${formatAmount(value)}${overflowInfo ? `（溢出 ${formatAmount(overflowInfo.wasted)}）` : ''}`}
    >
      {/* 图标 */}
      <span className="tk-res-icon" data-testid={`resource-bar-${type}-icon`}>{icon}</span>

      {/* 数值区 */}
      <div className="tk-res-info">
        <div className="tk-res-value-row">
          <span
            className={`tk-res-value ${warningLevel ? `tk-res-value--${warningLevel}` : ''}`}
            data-testid={`resource-bar-${type}-value`}
            style={{ color: warningLevel ? undefined : color }}
          >
            {formatAmount(value)}
          </span>
          {hasCap && (
            <span className="tk-res-cap" data-testid={`resource-bar-${type}-cap`}>
              /{formatAmount(cap!)}
            </span>
          )}
          {/* RES-CAP-02: 接近上限警告图标 */}
          {warningLevel && !overflowInfo && (
            <span className="tk-res-nearcap-badge" title={`${label}接近上限`}>⚠️</span>
          )}
          {/* RES-CAP-02: 溢出警告标记 */}
          {overflowInfo && (
            <span className="tk-res-overflow-badge" title={`奖励溢出 ${formatAmount(overflowInfo.wasted)}，升级仓库可避免`}>
              ⚠️
            </span>
          )}
        </div>
        {/* 产出速率 */}
        <span
          className={`tk-res-rate ${rate > 0 ? 'tk-res-rate--positive' : rate < 0 ? 'tk-res-rate--negative' : ''}`}
        >
          {rateText}
        </span>
        {/* RES-CAP-02: 容量警告文本 */}
        {warningLevel && (
          <span className={`tk-res-cap-warning tk-res-cap-warning--${warningLevel}`}>
            {warningLevel === 'full' ? '已满' : warningLevel === 'urgent' ? '将满' : '接近上限'}
          </span>
        )}
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
export default function ResourceBar({ resources, rates, caps, pendingGains, buildings }: ResourceBarProps) {
  const [showDetails, setShowDetails] = useState(false);

  // 收支详情：计算各建筑的产出明细
  const productionBreakdown = useMemo(() => {
    if (!buildings) return [];
    const items: Array<{ building: BuildingType; label: string; icon: string; resource: ResourceType; amount: number }> = [];
    for (const [type, state] of Object.entries(buildings)) {
      const def = BUILDING_DEFS[type as BuildingType];
      if (!def?.production || state.level <= 0) continue;
      const lv = state.level;
      const data = def.levelTable[lv - 1];
      const amount = data?.production ?? 0;
      if (amount <= 0) continue;
      items.push({
        building: type as BuildingType,
        label: BUILDING_LABELS[type as BuildingType],
        icon: BUILDING_ICONS[type as BuildingType],
        resource: def.production.resourceType as ResourceType,
        amount,
      });
    }
    return items;
  }, [buildings]);

  // RES-CAP-02: 计算整体溢出警告（用于全局提示）
  const overflowWarnings = useMemo(() => {
    const warnings: Array<{ type: ResourceType; label: string; wasted: number }> = [];
    for (const type of RESOURCE_ORDER) {
      const cap = caps[type];
      if (cap === null) continue;
      const gain = pendingGains?.[type];
      if (!gain || gain <= 0) continue;
      const total = resources[type] + gain;
      if (total > cap) {
        warnings.push({
          type,
          label: RESOURCE_LABELS[type],
          wasted: total - cap,
        });
      }
    }
    return warnings;
  }, [resources, caps, pendingGains]);

  return (
    <div className="tk-resource-bar" data-testid="resource-bar" role="status" aria-label="资源栏">
      {/* 游戏标题 */}
      <div className="tk-res-title" data-testid="resource-bar-title">三国霸业</div>

      {/* 资源列表 */}
      {RESOURCE_ORDER.map(type => (
        <ResourceItem
          key={type}
          type={type}
          value={resources[type]}
          rate={rates[type]}
          cap={caps[type]}
          pendingGain={pendingGains?.[type]}
        />
      ))}

      {/* RES-CAP-02: 全局溢出警告横幅 */}
      {overflowWarnings.length > 0 && (
        <div className="tk-res-overflow-banner" data-testid="resource-bar-overflow-banner" role="alert">
          ⚠️ {overflowWarnings.map(w => `${w.label}溢出${formatAmount(w.wasted)}`).join('、')}，升级仓库可避免损失
        </div>
      )}

      {/* 收支详情按钮 */}
      <button
        className="tk-res-detail-btn"
        data-testid="resource-bar-detail-btn"
        onClick={() => setShowDetails(true)}
        aria-label="收支详情"
        title="收支详情"
      >
        📊
      </button>

      {/* 收支详情弹窗 */}
      {showDetails && (
        <div className="tk-res-detail-overlay" data-testid="resource-bar-detail-overlay" onClick={() => setShowDetails(false)}>
          <div className="tk-res-detail-modal" data-testid="resource-bar-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="tk-res-detail-header">
              <h3>资源收支</h3>
              <button className="tk-res-detail-close" data-testid="resource-bar-detail-close" onClick={() => setShowDetails(false)}>✕</button>
            </div>
            <div className="tk-res-detail-body">
              {/* 产出列表 */}
              <div className="tk-res-detail-section">
                <h4>产出</h4>
                {productionBreakdown.length === 0 ? (
                  <div className="tk-res-detail-empty">暂无建筑产出</div>
                ) : (
                  productionBreakdown.map(item => (
                    <div key={item.building} className="tk-res-detail-row">
                      <span className="tk-res-detail-label">{item.icon} {item.label}</span>
                      <span className="tk-res-detail-value tk-res-detail-positive">
                        +{item.amount.toFixed(1)}/秒 {RESOURCE_ICONS[item.resource]}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {/* 净收入 */}
              <div className="tk-res-detail-section tk-res-detail-net">
                <h4>净收入</h4>
                {RESOURCE_ORDER.map(type => (
                  <div key={type} className="tk-res-detail-row">
                    <span className="tk-res-detail-label">{RESOURCE_ICONS[type]} {RESOURCE_LABELS[type]}</span>
                    <span className={`tk-res-detail-value ${rates[type] >= 0 ? 'tk-res-detail-positive' : 'tk-res-detail-negative'}`}>
                      {rates[type] >= 0 ? '+' : ''}{rates[type].toFixed(1)}/秒
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
