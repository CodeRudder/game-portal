/**
 * IdleGameZone — 放置游戏专区首页
 *
 * 游戏卡片网格展示所有放置游戏，按系列分类筛选，搜索功能。
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IdleGameMeta } from '@/types/idle';
import Header from '@/components/Header';

/** 放置游戏列表 */
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
  {
    id: 'doggo-home',
    name: '狗狗家园',
    description: '收集各种可爱狗狗，升级建筑，打造温馨的狗狗家园！',
    icon: '🐕',
    color: 'text-yellow-400',
    gradient: 'from-yellow-600/20 to-amber-600/20',
    series: '萌宠',
    tags: ['点击', '养成'],
  },
  {
    id: 'kittens-kingdom',
    name: '猫咪王国',
    description: '点击产鱼干，解锁猫咪品种，建设你的猫咪王国！',
    icon: '🐱',
    color: 'text-orange-400',
    gradient: 'from-orange-600/20 to-red-600/20',
    series: '萌宠',
    tags: ['点击', '品种'],
  },
  {
    id: 'penguin-empire',
    name: '企鹅帝国',
    description: '收集冰块，建造设施，征服南极大陆！',
    icon: '🐧',
    color: 'text-blue-400',
    gradient: 'from-blue-600/20 to-cyan-600/20',
    series: '萌宠',
    tags: ['点击', '建造'],
  },
  {
    id: 'ant-kingdom',
    name: '蚂蚁王国',
    description: '建立蚁巢，繁殖工蚁，打造地下蚂蚁帝国！',
    icon: '🐜',
    color: 'text-amber-700',
    gradient: 'from-amber-800/20 to-yellow-900/20',
    series: '自然',
    tags: ['策略', '建造'],
  },
  {
    id: 'dino-ranch',
    name: '恐龙牧场',
    description: '饲养恐龙，升级牧场，打造史前恐龙乐园！',
    icon: '🦕',
    color: 'text-green-400',
    gradient: 'from-green-600/20 to-emerald-600/20',
    series: '自然',
    tags: ['养成', '收集'],
  },
  {
    id: 'idle-xianxia',
    name: '修仙放置',
    description: '修炼灵气，突破境界，踏上修仙之路！',
    icon: '🏔️',
    color: 'text-purple-400',
    gradient: 'from-purple-600/20 to-indigo-600/20',
    series: '仙侠',
    tags: ['修炼', '突破'],
  },
  {
    id: 'sect-rise',
    name: '宗门崛起',
    description: '创建宗门，招收弟子，成就修仙霸业！',
    icon: '⚔️',
    color: 'text-red-400',
    gradient: 'from-red-600/20 to-rose-600/20',
    series: '仙侠',
    tags: ['策略', '经营'],
  },
  {
    id: 'alchemy-master',
    name: '炼金大师',
    description: '调配药剂，炼制神器，成为传奇炼金术士！',
    icon: '⚗️',
    color: 'text-purple-400',
    gradient: 'from-purple-600/20 to-indigo-600/20',
    series: '奇幻',
    tags: ['炼金', '合成'],
  },
  {
    id: 'civ-babylon',
    name: '巴比伦文明',
    description: '建造空中花园，发展两河文明，成就帝国霸业！',
    icon: '🏛️',
    color: 'text-amber-400',
    gradient: 'from-amber-600/20 to-yellow-600/20',
    series: '四大文明',
    tags: ['建造', '文明'],
  },
  {
    id: 'civ-china',
    name: '华夏文明',
    description: '发展农耕丝织，建设万里长城，缔造华夏盛世！',
    icon: '🐉',
    color: 'text-red-400',
    gradient: 'from-red-600/20 to-rose-600/20',
    series: '四大文明',
    tags: ['建造', '文明'],
  },
  {
    id: 'civ-egypt',
    name: '埃及文明',
    description: '建造金字塔，统治尼罗河，成就法老王朝！',
    icon: '🏺',
    color: 'text-yellow-400',
    gradient: 'from-yellow-600/20 to-amber-500/20',
    series: '四大文明',
    tags: ['建造', '文明'],
  },
  {
    id: 'civ-india',
    name: '印度文明',
    description: '种植香料，修建神庙，繁荣恒河流域！',
    icon: '🕉️',
    color: 'text-orange-400',
    gradient: 'from-orange-600/20 to-amber-600/20',
    series: '四大文明',
    tags: ['建造', '文明'],
  },
  {
    id: 'three-kingdoms',
    name: '三国霸业',
    description: '招募武将，攻城略地，一统三国天下！魏蜀吴三足鼎立，谁主沉浮？',
    icon: '⚔️',
    color: 'text-red-500',
    gradient: 'from-red-700/20 to-yellow-600/20',
    series: '三国',
    tags: ['策略', '战斗', '武将'],
  },
  {
    id: 'clan-saga',
    name: '氏族传说',
    description: '统领氏族，征战四方，书写属于你的传奇！',
    icon: '⚔️',
    color: 'text-amber-600',
    gradient: 'from-amber-700/20 to-stone-600/20',
    series: '中世纪',
    tags: ['征战', '氏族'],
  },
  {
    id: 'doomsday',
    name: '末日求生',
    description: '核战之后，收集资源，建立避难所，重建文明！',
    icon: '☢️',
    color: 'text-green-500',
    gradient: 'from-green-600/20 to-lime-600/20',
    series: '末日',
    tags: ['生存', '建造'],
  },
  {
    id: 'dungeon-explore',
    name: '地牢探索',
    description: '深入地下城，击败怪物，收集宝藏和装备！',
    icon: '🏰',
    color: 'text-stone-400',
    gradient: 'from-stone-600/20 to-zinc-600/20',
    series: '奇幻',
    tags: ['探索', '战斗'],
  },
  {
    id: 'island-drift',
    name: '荒岛漂流',
    description: '流落荒岛，采集资源，建造庇护所，等待救援！',
    icon: '🏝️',
    color: 'text-cyan-400',
    gradient: 'from-cyan-600/20 to-teal-600/20',
    series: '生存',
    tags: ['生存', '建造'],
  },
  {
    id: 'modern-city',
    name: '现代都市',
    description: '规划建设，发展经济，打造国际化现代都市！',
    icon: '🏙️',
    color: 'text-blue-400',
    gradient: 'from-blue-600/20 to-sky-600/20',
    series: '都市',
    tags: ['建造', '经营'],
  },
  {
    id: 'space-drift',
    name: '星际漂流',
    description: '驾驶飞船，开采小行星，探索无尽宇宙！',
    icon: '🚀',
    color: 'text-indigo-400',
    gradient: 'from-indigo-600/20 to-violet-600/20',
    series: '科幻',
    tags: ['探索', '采矿'],
  },
  {
    id: 'tribulation',
    name: '天劫修仙',
    description: '渡过天劫，飞升仙界，成就无上大道！',
    icon: '⚡',
    color: 'text-violet-400',
    gradient: 'from-violet-600/20 to-purple-600/20',
    series: '仙侠',
    tags: ['修炼', '渡劫'],
  },
  {
    id: 'wild-survival',
    name: '荒野求生',
    description: '在原始荒野中生存，狩猎采集，对抗自然！',
    icon: '🌲',
    color: 'text-emerald-400',
    gradient: 'from-emerald-600/20 to-green-600/20',
    series: '生存',
    tags: ['生存', '狩猎'],
  },
  {
    id: 'age-of-empires',
    name: '帝国时代',
    description: '从石器时代到帝国时代，发展文明，征服世界！',
    icon: '🏰',
    color: 'text-purple-400',
    gradient: 'from-purple-600/20 to-violet-600/20',
    series: '奇幻',
    tags: ['文明', '征服'],
  },
  {
    id: 'baldurs-gate',
    name: '博德之门',
    description: '探索地下城，招募英雄，挑战博德之门！',
    icon: '⚔️',
    color: 'text-red-400',
    gradient: 'from-red-600/20 to-rose-600/20',
    series: '奇幻',
    tags: ['探索', 'RPG'],
  },
  {
    id: 'egypt-myth',
    name: '埃及神话',
    description: '召唤埃及众神，建造神庙，统治沙漠王国！',
    icon: '🐪',
    color: 'text-amber-400',
    gradient: 'from-amber-600/20 to-yellow-600/20',
    series: '奇幻',
    tags: ['神话', '建造'],
  },
  {
    id: 'final-fantasy',
    name: '最终幻想',
    description: '集结勇者，探索幻想世界，击败最终Boss！',
    icon: '💎',
    color: 'text-indigo-400',
    gradient: 'from-indigo-600/20 to-blue-600/20',
    series: '奇幻',
    tags: ['RPG', '冒险'],
  },
  {
    id: 'greek-gods',
    name: '希腊众神',
    description: '信仰奥林匹斯众神，建设城邦，成就希腊霸业！',
    icon: '⚡',
    color: 'text-yellow-400',
    gradient: 'from-yellow-500/20 to-amber-600/20',
    series: '奇幻',
    tags: ['神话', '建造'],
  },
  {
    id: 'heroes-might',
    name: '英雄无敌',
    description: '招募英雄，建设城堡，征服魔法大陆！',
    icon: '🏇',
    color: 'text-violet-400',
    gradient: 'from-violet-600/20 to-purple-600/20',
    series: '奇幻',
    tags: ['策略', '英雄'],
  },
  {
    id: 'norse-valkyrie',
    name: '北欧女武神',
    description: '召唤女武神，征服九界，书写北欧传奇！',
    icon: '🛡️',
    color: 'text-sky-400',
    gradient: 'from-sky-600/20 to-cyan-600/20',
    series: '奇幻',
    tags: ['北欧', '征战'],
  },
  {
    id: 'red-alert',
    name: '红色警戒',
    description: '建造基地，训练军队，赢得终极战争！',
    icon: '🎖️',
    color: 'text-red-500',
    gradient: 'from-red-600/20 to-orange-600/20',
    series: '科幻',
    tags: ['战争', '基地'],
  },
  {
    id: 'three-kingdoms',
    name: '三国霸业',
    description: '招兵买马，攻城略地，一统三国天下！',
    icon: '🐴',
    color: 'text-red-700',
    gradient: 'from-red-700/20 to-amber-700/20',
    series: '中世纪',
    tags: ['三国', '征服'],
  },
  {
    id: 'total-war',
    name: '全面战争',
    description: '统帅三军，运筹帷幄，成就战争霸业！',
    icon: '🗡️',
    color: 'text-stone-400',
    gradient: 'from-stone-600/20 to-zinc-600/20',
    series: '中世纪',
    tags: ['战争', '策略'],
  },
  {
    id: 'yokai-night',
    name: '百鬼夜行',
    description: '收集妖怪，驱鬼除魔，探索平安京！',
    icon: '👻',
    color: 'text-purple-400',
    gradient: 'from-purple-600/20 to-fuchsia-600/20',
    series: '仙侠',
    tags: ['妖怪', '收集'],
  },
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
