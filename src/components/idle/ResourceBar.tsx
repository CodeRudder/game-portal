/**
 * ResourceBar — 资源栏组件
 * 设计规范: A区 1280×56px, 显示4种资源
 */
import type { FC } from 'react';
import type { Resources, ProductionRate, ResourceCap } from '@/games/three-kingdoms/engine/resource/resource.types';
import './ResourceBar.css';

interface ResourceBarProps {
  resources: Resources;
  rates: ProductionRate;
  caps: ResourceCap;
}

const RESOURCE_CONFIG = [
  { key: 'grain' as const, icon: '🌾', label: '粮草', hasCap: true },
  { key: 'gold' as const, icon: '💰', label: '铜钱', hasCap: false },
  { key: 'troops' as const, icon: '⚔️', label: '兵力', hasCap: true },
  { key: 'mandate' as const, icon: '👑', label: '天命', hasCap: false },
];

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

export const ResourceBar: FC<ResourceBarProps> = ({ resources, rates, caps }) => {
  return (
    <div className="resource-bar">
      {RESOURCE_CONFIG.map(({ key, icon, label, hasCap }) => {
        const amount = resources[key];
        const rate = rates[key];
        const cap = caps[key];
        const capValue = cap ?? 0;
        const isPositive = rate > 0;
        const capPercent = hasCap && capValue > 0 ? (amount / capValue) * 100 : 0;

        return (
          <div key={key} className={`resource-item ${key}`}>
            <span className="resource-icon">{icon}</span>
            <div className="resource-info">
              <span className="resource-value">
                {formatNumber(amount)}
                {hasCap && capValue > 0 ? `/${formatNumber(capValue)}` : ''}
              </span>
              <span className={`resource-rate ${isPositive ? 'positive' : 'negative'}`}>
                {isPositive ? '+' : ''}{rate.toFixed(1)}/秒
              </span>
            </div>
            {hasCap && capValue > 0 && (
              <div className="resource-cap-bar">
                <div
                  className={`resource-cap-fill ${
                    capPercent > 95 ? 'danger' : capPercent > 80 ? 'warning' : ''
                  }`}
                  style={{ width: `${Math.min(capPercent, 100)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
