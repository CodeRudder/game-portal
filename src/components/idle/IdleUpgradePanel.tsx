/**
 * IdleUpgradePanel — 升级面板
 *
 * 显示可购买的升级列表，每个升级显示名称、描述、当前费用、已购数量。
 * 费用不足时灰色禁用。
 */
import { type Upgrade } from '@/types/idle';

interface IdleUpgradePanelProps {
  upgrades: Upgrade[];
  getUpgradeCost: (id: string) => Record<string, number>;
  canAfford: (cost: Record<string, number>) => boolean;
  formatNumber: (n: number) => string;
  getResourceName: (id: string) => string;
  onPurchase: (id: string) => void;
}

export default function IdleUpgradePanel({
  upgrades,
  getUpgradeCost,
  canAfford,
  formatNumber,
  getResourceName,
  onPurchase,
}: IdleUpgradePanelProps) {
  const available = upgrades.filter((u) => u.unlocked && u.level < u.maxLevel);

  if (available.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500" data-testid="idle-upgrade-panel">
        <span className="text-3xl mb-2">🔒</span>
        <span className="text-sm">暂无可购买的升级</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="idle-upgrade-panel">
      {available.map((upgrade) => {
        const cost = getUpgradeCost(upgrade.id);
        const affordable = canAfford(cost);
        const maxed = upgrade.level >= upgrade.maxLevel;

        return (
          <button
            key={upgrade.id}
            disabled={!affordable || maxed}
            onClick={() => onPurchase(upgrade.id)}
            className={`
              group flex items-start gap-3 rounded-xl border p-3 text-left transition
              ${
                affordable && !maxed
                  ? 'border-gp-accent/30 bg-gp-card hover:border-gp-accent/60 hover:bg-gp-accent/10'
                  : 'border-white/5 bg-gp-card/50 opacity-50 cursor-not-allowed'
              }
            `}
          >
            {/* 图标 */}
            {upgrade.icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xl">
                {upgrade.icon}
              </div>
            )}

            {/* 信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{upgrade.name}</span>
                {upgrade.level > 0 && (
                  <span className="rounded-full bg-gp-accent/20 px-2 py-0.5 text-xs text-gp-accent">
                    Lv.{upgrade.level}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{upgrade.description}</p>

              {/* 费用 */}
              <div className="mt-1.5 flex flex-wrap gap-2">
                {Object.entries(cost).map(([resId, amount]) => (
                  <span
                    key={resId}
                    className={`text-xs ${
                      affordable ? 'text-gp-gold' : 'text-red-400'
                    }`}
                  >
                    {getResourceName(resId)}: {formatNumber(amount)}
                  </span>
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
