/**
 * EconomyOverview — 经济总览组件
 *
 * 功能：
 * - 资源总览卡片（招贤令/铜钱/突破石/技能书，各显示余额+图标）
 * - 日产出/日消耗面板
 * - 经济平衡指示器（产出>消耗=绿色，产出<消耗=红色）
 * - 资源获取途径快捷入口（商店/日常任务/远征）
 * - 推荐操作提示（如"突破石不足，建议扫荡关卡X"）
 *
 * @module components/idle/panels/hero/EconomyOverview
 */

import React, { useMemo } from 'react';
import './EconomyOverview.css';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

/** 资源余额 */
export interface ResourceBalances {
  recruitTokens: number;
  copper: number;
  breakthroughStones: number;
  skillBooks: number;
}

/** 日产出/日消耗数据 */
export interface DailyFlow {
  /** 资源类型 key */
  resourceKey: string;
  /** 日产出 */
  production: number;
  /** 日消耗 */
  consumption: number;
}

/** 快捷入口 */
export interface QuickEntry {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
}

/** 推荐操作 */
export interface Recommendation {
  message: string;
  priority: 'info' | 'warning' | 'urgent';
}

export interface EconomyOverviewProps {
  /** 资源余额 */
  balances: ResourceBalances;
  /** 日产出/日消耗 */
  dailyFlows: DailyFlow[];
  /** 快捷入口 */
  quickEntries?: QuickEntry[];
  /** 推荐操作列表 */
  recommendations?: Recommendation[];
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const RESOURCE_CARDS: { key: keyof ResourceBalances; label: string; icon: string }[] = [
  { key: 'recruitTokens', label: '招贤令', icon: '📜' },
  { key: 'copper', label: '铜钱', icon: '🪙' },
  { key: 'breakthroughStones', label: '突破石', icon: '🔮' },
  { key: 'skillBooks', label: '技能书', icon: '📖' },
];

// ─────────────────────────────────────────────
// 子组件：资源卡片
// ─────────────────────────────────────────────

interface ResourceCardProps {
  icon: string;
  label: string;
  amount: number;
}

const ResourceCard: React.FC<ResourceCardProps> = React.memo(({ icon, label, amount }) => (
  <div className="eo-card" data-testid={`eo-card-${label}`}>
    <span className="eo-card__icon">{icon}</span>
    <span className="eo-card__label">{label}</span>
    <span className="eo-card__amount">{amount.toLocaleString()}</span>
  </div>
));
ResourceCard.displayName = 'ResourceCard';

// ─────────────────────────────────────────────
// 子组件：日产出/消耗行
// ─────────────────────────────────────────────

interface FlowRowProps {
  flow: DailyFlow;
}

const FlowRow: React.FC<FlowRowProps> = React.memo(({ flow }) => {
  const balance = flow.production - flow.consumption;
  const isPositive = balance >= 0;
  return (
    <div className="eo-flow-row" data-testid={`eo-flow-${flow.resourceKey}`}>
      <span className="eo-flow-row__key">{flow.resourceKey}</span>
      <span className="eo-flow-row__prod">+{flow.production}</span>
      <span className="eo-flow-row__cons">-{flow.consumption}</span>
      <span className={`eo-flow-row__balance ${isPositive ? 'eo-flow-row__balance--positive' : 'eo-flow-row__balance--negative'}`}>
        {isPositive ? `+${balance}` : `${balance}`}
      </span>
    </div>
  );
});
FlowRow.displayName = 'FlowRow';

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────

const EconomyOverview: React.FC<EconomyOverviewProps> = ({
  balances,
  dailyFlows,
  quickEntries = [],
  recommendations = [],
}) => {
  /** 整体经济平衡 */
  const overallBalance = useMemo(() => {
    const totalProd = dailyFlows.reduce((s, f) => s + f.production, 0);
    const totalCons = dailyFlows.reduce((s, f) => s + f.consumption, 0);
    return totalProd - totalCons;
  }, [dailyFlows]);

  const isBalanced = overallBalance >= 0;

  return (
    <div className="eo-panel" data-testid="economy-overview">
      {/* 标题 */}
      <div className="eo-header">
        <h3 className="eo-title">经济总览</h3>
      </div>

      {/* 资源总览卡片 */}
      <div className="eo-cards" data-testid="eo-cards">
        {RESOURCE_CARDS.map(({ key, label, icon }) => (
          <ResourceCard key={key} icon={icon} label={label} amount={balances[key]} />
        ))}
      </div>

      {/* 日产出/日消耗面板 */}
      <div className="eo-flows" data-testid="eo-flows">
        <div className="eo-flows__header">
          <span>资源</span>
          <span>日产出</span>
          <span>日消耗</span>
          <span>净额</span>
        </div>
        {dailyFlows.map((flow) => (
          <FlowRow key={flow.resourceKey} flow={flow} />
        ))}
      </div>

      {/* 经济平衡指示器 */}
      <div className={`eo-balance-indicator ${isBalanced ? 'eo-balance-indicator--positive' : 'eo-balance-indicator--negative'}`} data-testid="eo-balance-indicator">
        <span className="eo-balance-indicator__icon">{isBalanced ? '✅' : '⚠️'}</span>
        <span className="eo-balance-indicator__text">
          {isBalanced ? '经济盈余' : '经济赤字'}：{isBalanced ? `+${overallBalance}` : `${overallBalance}`}/日
        </span>
      </div>

      {/* 快捷入口 */}
      {quickEntries.length > 0 && (
        <div className="eo-entries" data-testid="eo-quick-entries">
          <div className="eo-entries__title">资源获取途径</div>
          <div className="eo-entries__list">
            {quickEntries.map((entry) => (
              <button
                key={entry.key}
                className="eo-entry-btn"
                onClick={entry.onClick}
                data-testid={`eo-entry-${entry.key}`}
              >
                <span>{entry.icon}</span>
                <span>{entry.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 推荐操作 */}
      {recommendations.length > 0 && (
        <div className="eo-recommendations" data-testid="eo-recommendations">
          <div className="eo-recommendations__title">推荐操作</div>
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className={`eo-rec-item eo-rec-item--${rec.priority}`}
              data-testid={`eo-rec-${i}`}
            >
              {rec.priority === 'urgent' && '🔴 '}
              {rec.priority === 'warning' && '🟡 '}
              {rec.priority === 'info' && '🔵 '}
              {rec.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

EconomyOverview.displayName = 'EconomyOverview';
export default EconomyOverview;
