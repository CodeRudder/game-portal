/**
 * ResourceCost — 资源消耗展示原子组件
 *
 * 显示资源消耗列表（图标 + 名称 + 数量），不足时标红。
 * 支持横向和纵向布局。
 *
 * 资源类型：
 *   - copper          铜钱
 *   - recruitToken    招贤令
 *   - breakthroughStone 突破石
 *   - fragment        碎片
 *   - exp             经验
 */
import React from 'react';
import './ResourceCost.css';

// ─────────────────────────────────────────────
// Props 接口
// ─────────────────────────────────────────────
export interface ResourceCostItem {
  /** 资源类型 */
  type: 'copper' | 'recruitToken' | 'breakthroughStone' | 'fragment' | 'exp';
  /** 资源名称 */
  name: string;
  /** 需求数量 */
  required: number;
  /** 当前持有数量 */
  current: number;
}

export interface ResourceCostProps {
  /** 资源消耗列表 */
  items: ResourceCostItem[];
  /** 布局方向：horizontal(横向) / vertical(纵向) */
  layout?: 'horizontal' | 'vertical';
  /** 自定义类名 */
  className?: string;
}

// ─────────────────────────────────────────────
// 资源类型 → 图标映射
// ─────────────────────────────────────────────
const RESOURCE_ICONS: Record<ResourceCostItem['type'], string> = {
  copper: '🪙',
  recruitToken: '📜',
  breakthroughStone: '💎',
  fragment: '🧩',
  exp: '⭐',
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 格式化数量 */
function formatResourceAmount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
const ResourceCost: React.FC<ResourceCostProps> = ({
  items,
  layout = 'vertical',
  className = '',
}) => {
  const rootClass = [
    'tk-resource-cost',
    `tk-resource-cost--${layout}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} data-testid="resource-cost">
      {items.map((item) => {
        const isInsufficient = item.current < item.required;
        const itemClass = [
          'tk-resource-cost__item',
          isInsufficient ? 'tk-resource-cost__item--insufficient' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={item.type}
            className={itemClass}
            data-testid={`resource-cost-${item.type}`}
          >
            {/* 图标 */}
            <span className="tk-resource-cost__icon" aria-hidden="true">
              {RESOURCE_ICONS[item.type]}
            </span>

            {/* 名称 + 数量 */}
            <span className="tk-resource-cost__info">
              <span className="tk-resource-cost__name">{item.name}</span>
              <span className="tk-resource-cost__amount">
                <span
                  className={`tk-resource-cost__current ${isInsufficient ? 'tk-resource-cost__current--lack' : ''}`}
                >
                  {formatResourceAmount(item.current)}
                </span>
                <span className="tk-resource-cost__separator">/</span>
                <span className="tk-resource-cost__required">
                  {formatResourceAmount(item.required)}
                </span>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default ResourceCost;
