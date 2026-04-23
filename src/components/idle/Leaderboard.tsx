/**
 * Leaderboard — 本地排名组件
 *
 * 使用 LocalStorage 存储排名数据，支持多个排名维度，自己的排名高亮。
 */
import { useState, useEffect, useCallback } from 'react';
import type { IdleLeaderboardEntry } from '@/types/idle';

interface LeaderboardProps {
  gameId: string;
  dimensions: { key: string; label: string }[];
  currentValues?: Record<string, number>;
  formatNumber: (n: number) => string;
}

const STORAGE_KEY_PREFIX = 'idle-leaderboard';

function getStorageKey(gameId: string): string {
  return `${STORAGE_KEY_PREFIX}-${gameId}`;
}

function loadEntries(gameId: string): IdleLeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(getStorageKey(gameId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(gameId: string, entries: IdleLeaderboardEntry[]): void {
  localStorage.setItem(getStorageKey(gameId), JSON.stringify(entries));
}

export default function Leaderboard({
  gameId,
  dimensions,
  currentValues,
  formatNumber,
}: LeaderboardProps) {
  const [entries, setEntries] = useState<IdleLeaderboardEntry[]>([]);
  const [activeDimension, setActiveDimension] = useState(dimensions[0]?.key ?? '');

  useEffect(() => {
    setEntries(loadEntries(gameId));
  }, [gameId]);

  const submitScore = useCallback(
    (dimension: string, value: number, label: string) => {
      const all = loadEntries(gameId);
      const entry: IdleLeaderboardEntry = {
        rank: 0,
        gameId,
        dimension,
        value,
        label,
        date: new Date().toISOString(),
      };
      all.push(entry);
      // Sort by value descending within dimension
      const dimEntries = all
        .filter((e) => e.dimension === dimension)
        .sort((a, b) => b.value - a.value)
        .slice(0, 20);
      dimEntries.forEach((e, i) => (e.rank = i + 1));
      // Keep only ranked entries
      const otherDimEntries = all.filter((e) => e.dimension !== dimension);
      saveEntries(gameId, [...otherDimEntries, ...dimEntries]);
      setEntries([...otherDimEntries, ...dimEntries]);
    },
    [gameId]
  );

  const filteredEntries = entries
    .filter((e) => e.dimension === activeDimension)
    .sort((a, b) => a.rank - b.rank);

  const isOwn = (entry: IdleLeaderboardEntry) => {
    // 最新的一个同值条目视为自己的
    if (!currentValues) return false;
    return entry.value === currentValues[entry.dimension];
  };

  return (
    <div className="flex flex-col gap-3" data-testid="leaderboard">
      {/* 维度切换 */}
      {dimensions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto" data-testid="leaderboard-dimensions">
          {dimensions.map((dim) => (
            <button
              key={dim.key}
              onClick={() => setActiveDimension(dim.key)}
              data-testid={`leaderboard-dimension-${dim.key}`}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition ${
                activeDimension === dim.key
                  ? 'bg-gp-accent text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {dim.label}
            </button>
          ))}
        </div>
      )}

      {/* 排名列表 */}
      {filteredEntries.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-500">
          暂无排名记录
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {filteredEntries.map((entry, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                isOwn(entry)
                  ? 'border border-gp-accent/30 bg-gp-accent/10'
                  : 'bg-white/5'
              }`}
              data-testid={`leaderboard-entry-${idx}`}
            >
              <span
                className={`w-8 text-center font-game text-xs ${
                  entry.rank === 1
                    ? 'text-gp-gold'
                    : entry.rank === 2
                    ? 'text-gray-300'
                    : entry.rank === 3
                    ? 'text-orange-400'
                    : 'text-gray-500'
                }`}
              >
                {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
              </span>
              <span className="flex-1 text-gray-300">{entry.label}</span>
              <span className="font-game text-xs text-gp-neon">
                {formatNumber(entry.value)}
              </span>
              <span className="text-xs text-gray-600">
                {new Date(entry.date).toLocaleDateString('zh-CN')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 提交按钮（调试/手动提交） */}
      {currentValues && (
        <button
          onClick={() => {
            const dim = dimensions.find((d) => d.key === activeDimension);
            if (dim && currentValues[dim.key] !== undefined) {
              submitScore(dim.key, currentValues[dim.key], dim.label);
            }
          }}
          data-testid="leaderboard-submit"
          className="rounded-lg bg-gp-accent/20 px-3 py-2 text-xs text-gp-accent hover:bg-gp-accent/30"
        >
          📊 提交当前成绩
        </button>
      )}
    </div>
  );
}
