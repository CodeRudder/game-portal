/**
 * IdleResourceBar — 资源显示栏
 *
 * 显示所有已解锁资源的当前数量和每秒产出。
 * PC 横排，手机竖排。
 */
import { type Resource } from '@/types/idle';

interface IdleResourceBarProps {
  resources: Resource[];
  formatNumber: (n: number) => string;
}

export default function IdleResourceBar({ resources, formatNumber }: IdleResourceBarProps) {
  const unlocked = resources.filter((r) => r.unlocked);

  if (unlocked.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/5 bg-gp-card/80 px-3 py-2 backdrop-blur-sm">
      {/* PC: 横排; 手机: 竖排 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
        {unlocked.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">{r.name}</span>
              <span className="font-game text-sm text-gp-neon">
                {formatNumber(r.amount)}
              </span>
            </div>
            {r.perSecond > 0 && (
              <span className="text-xs text-gp-green">
                +{formatNumber(r.perSecond)}/s
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
