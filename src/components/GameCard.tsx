import { useNavigate } from 'react-router-dom';
import { GameType } from '@/types';

interface GameCardProps {
  type: GameType;
}

const gameInfo: Record<GameType, { title: string; description: string; icon: string; color: string; gradient: string }> = {
  [GameType.TETRIS]: {
    title: '俄罗斯方块',
    description: '经典消行游戏，旋转、移动、消除，挑战你的极限速度！',
    icon: '🧱',
    color: 'text-cyan-400',
    gradient: 'from-cyan-600/20 to-blue-600/20',
  },
  [GameType.SNAKE]: {
    title: '贪吃蛇',
    description: '控制小蛇吃食物，越长越难操控，你能坚持多久？',
    icon: '🐍',
    color: 'text-green-400',
    gradient: 'from-green-600/20 to-emerald-600/20',
  },
  [GameType.SOKOBAN]: {
    title: '推箱子',
    description: '动动脑筋，把所有箱子推到目标位置，考验你的空间思维！',
    icon: '📦',
    color: 'text-orange-400',
    gradient: 'from-orange-600/20 to-red-600/20',
  },
  [GameType.FLAPPY_BIRD]: {
    title: 'Flappy Bird',
    description: '点击屏幕控制小鸟飞行，穿越管道，看你能飞多远！',
    icon: '🐦',
    color: 'text-yellow-400',
    gradient: 'from-yellow-600/20 to-amber-600/20',
  },
};

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
