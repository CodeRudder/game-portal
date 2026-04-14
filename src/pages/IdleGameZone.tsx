/**
 * IdleGameZone — 放置游戏专区首页
 *
 * 游戏卡片网格展示所有放置游戏，按系列分类筛选，搜索功能。
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IdleGameMeta } from '@/types/idle';
import Header from '@/components/Header';

/** 放置游戏列表（目前只有 Cookie Clicker，后续扩展） */
const IDLE_GAMES: IdleGameMeta[] = [
  {
    id: 'cookie-clicker',
    name: 'Cookie Clicker',
    description: '点击生产饼干，购买升级自动产出，打造你的饼干帝国！',
    icon: '🍪',
    color: 'text-amber-400',
    gradient: 'from-amber-600/20 to-orange-600/20',
    series: '经典',
    tags: ['点击', '生产'],
  },
  // 后续添加更多放置游戏...
];

/** 所有系列 */
const ALL_SERIES: string[] = ['全部', ...Array.from(new Set(IDLE_GAMES.map((g) => g.series).filter((s): s is string => Boolean(s))))];

export default function IdleGameZone() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('全部');

  const filtered = useMemo(() => {
    let result = IDLE_GAMES;

    // 搜索
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // 系列筛选
    if (seriesFilter !== '全部') {
      result = result.filter((g) => g.series === seriesFilter);
    }

    return result;
  }, [search, seriesFilter]);

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden py-12 text-center sm:py-16">
        <div className="absolute inset-0 bg-gradient-to-b from-gp-gold/5 via-transparent to-transparent" />
        <div className="absolute left-1/2 top-1/4 h-48 w-48 -translate-x-1/2 rounded-full bg-gp-gold/10 blur-[80px]" />
        <div className="relative mx-auto max-w-3xl px-4">
          <h1 className="font-game text-xl leading-relaxed text-gp-gold sm:text-2xl md:text-3xl">
            🌙 放置游戏专区
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-gray-400 sm:text-base">
            挂机也能变强！离线收益、自动产出、升级解锁，打造属于你的放置帝国
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-gray-500">
            <span className="rounded-full bg-white/5 px-3 py-1.5 backdrop-blur-sm">⏰ 离线收益</span>
            <span className="rounded-full bg-white/5 px-3 py-1.5 backdrop-blur-sm">📈 自动产出</span>
            <span className="rounded-full bg-white/5 px-3 py-1.5 backdrop-blur-sm">💾 自动存档</span>
            <span className="rounded-full bg-white/5 px-3 py-1.5 backdrop-blur-sm">🏆 本地排名</span>
          </div>
        </div>
      </section>

      {/* 搜索与筛选 */}
      <section className="mx-auto max-w-5xl px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* 搜索 */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索放置游戏..."
              className="w-full rounded-xl border border-white/10 bg-gp-card py-2.5 pl-10 pr-4 text-sm text-gray-300 placeholder:text-gray-600 focus:border-gp-accent/50 focus:outline-none"
            />
          </div>

          {/* 系列筛选 */}
          <div className="flex gap-2 overflow-x-auto">
            {ALL_SERIES.map((series) => (
              <button
                key={series}
                onClick={() => setSeriesFilter(series)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs transition ${
                  seriesFilter === series
                    ? 'bg-gp-gold text-black'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {series}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 游戏列表 */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <div className="mb-2 text-4xl">🔍</div>
            <p>没有找到匹配的游戏</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((game, i) => (
              <div
                key={game.id}
                className="game-card group cursor-pointer rounded-2xl border border-white/5 bg-gp-card p-6 backdrop-blur-sm animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
                onClick={() => navigate(`/idle/${game.id}`)}
              >
                <div
                  className={`mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br ${game.gradient} text-3xl`}
                >
                  {game.icon}
                </div>
                <h3 className={`font-game text-sm ${game.color} mb-2`}>{game.name}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{game.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {game.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-500"
                    >
                      {tag}
                    </span>
                  ))}
                  {game.series && (
                    <span className="rounded-full bg-gp-gold/10 px-2 py-0.5 text-xs text-gp-gold">
                      {game.series}
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-gp-accent opacity-0 transition-opacity group-hover:opacity-100">
                  开始游戏
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-gray-600">
        <p>放置游戏专区 — 离线也能玩！</p>
      </footer>
    </div>
  );
}
