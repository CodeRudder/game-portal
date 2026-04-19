/**
 * IdleOfflineReport — 离线收益报告弹窗
 *
 * 显示离线时长和获得的各类资源，点击"收取"按钮关闭。
 */
import { type OfflineReport } from '@/types/idle';

interface IdleOfflineReportProps {
  report: OfflineReport;
  formatNumber: (n: number) => string;
  getResourceName: (id: string) => string;
  onCollect: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天 ${hours % 24}小时`;
  if (hours > 0) return `${hours}小时 ${minutes % 60}分钟`;
  if (minutes > 0) return `${minutes}分钟`;
  return `${seconds}秒`;
}

export default function IdleOfflineReport({
  report,
  formatNumber,
  getResourceName,
  onCollect,
}: IdleOfflineReportProps) {
  const entries = Object.entries(report.earnedResources).filter(([, v]) => v > 0);

  if (entries.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-sm rounded-2xl border border-gp-accent/30 bg-gp-card p-6 text-center">
          <div className="mb-2 text-4xl">⏰</div>
          <h3 className="font-game text-sm text-gp-neon">欢迎回来！</h3>
          <p className="mt-2 text-sm text-gray-400">离线时间较短，暂无收益</p>
          <button
            onClick={onCollect}
            className="mt-4 rounded-xl bg-gradient-to-r from-gp-accent to-gp-neon px-6 py-2 text-sm font-bold text-white"
          >
            继续
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm animate-slide-up rounded-2xl border border-gp-accent/30 bg-gp-card p-6">
        {/* 标题 */}
        <div className="mb-4 text-center">
          <div className="mb-2 text-4xl">🌙</div>
          <h3 className="font-game text-sm text-gp-neon">离线收益报告</h3>
          <p className="mt-1 text-xs text-gray-400">
            离线时长: <span className="text-gp-gold">{formatDuration(report.offlineMs)}</span>
          </p>
        </div>

        {/* 资源列表 */}
        <div className="mb-4 flex flex-col gap-2">
          {entries.map(([resId, amount]) => (
            <div
              key={resId}
              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
            >
              <span className="text-sm text-gray-300">{getResourceName(resId)}</span>
              <span className="font-game text-sm text-gp-neon">+{formatNumber(amount)}</span>
            </div>
          ))}
        </div>

        {/* 收取按钮 */}
        <button
          onClick={onCollect}
          className="btn-pulse w-full rounded-xl bg-gradient-to-r from-gp-accent to-gp-neon px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-gp-accent/30"
        >
          💰 收取
        </button>
      </div>
    </div>
  );
}
