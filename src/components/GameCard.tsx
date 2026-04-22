/**
 * GameCard 组件
 *
 * 游戏卡片展示组件，用于首页游戏列表。
 * 显示游戏图标、标题、描述和操作入口。
 */
import { useNavigate } from 'react-router-dom';
import { GameType } from '@/types';
import { gameInfo } from '@/data/gameInfo';

interface GameCardProps {
  type: GameType;
}

export default function GameCard({ type }: GameCardProps) {
  const navigate = useNavigate();
  const info = gameInfo[type];

  return (
    <div
      className="game-card group cursor-pointer rounded-2xl border border-white/5 bg-gp-card p-6 backdrop-blur-sm"
      onClick={() => navigate(`/game/${type}`)}
    >
      <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br ${info.gradient} text-3xl`}>
        {info.icon}
      </div>
      <h3 className={`font-game text-sm ${info.color} mb-2`}>{info.title}</h3>
      <p className="text-sm leading-relaxed text-gray-400">{info.description}</p>
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <span className="rounded-full bg-white/5 px-2 py-1">⌨️ 键盘</span>
        <span className="rounded-full bg-white/5 px-2 py-1">🎯 单人</span>
      </div>
      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-gp-accent opacity-0 transition-opacity group-hover:opacity-100">
        开始游戏
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

export { gameInfo };
