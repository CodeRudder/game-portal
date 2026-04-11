import { useParams, useNavigate } from 'react-router-dom';
import { GameType } from '@/types';
import Header from '../components/Header';
import GameContainer from '../components/GameContainer';
import { gameInfo } from '../components/GameCard';

// 枚举值是小写：tetris, snake, sokoban
const VALID_TYPES: Record<string, GameType> = {
  tetris: GameType.TETRIS,
  snake: GameType.SNAKE,
  sokoban: GameType.SOKOBAN,
  'flappy-bird': GameType.FLAPPY_BIRD,
  'g2048': GameType.G2048,
};

export default function GamePage() {
  const { gameType } = useParams<{ gameType: string }>();
  const navigate = useNavigate();

  const type = gameType ? VALID_TYPES[gameType.toLowerCase()] : undefined;
  const isValid = !!type;
  const info = type ? gameInfo[type] : null;

  if (!isValid || !info) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex flex-col items-center justify-center py-32">
          <div className="mb-4 text-6xl">🤔</div>
          <h2 className="mb-4 font-game text-lg text-gp-neon">游戏未找到</h2>
          <button
            onClick={() => navigate('/')}
            className="rounded-xl bg-gp-accent px-6 py-3 text-white transition hover:bg-gp-accent/80"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* 标题区 */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            ←
          </button>
          <div>
            <h1 className={`font-game text-lg ${info.color}`}>{info.icon} {info.title}</h1>
            <p className="text-sm text-gray-400">{info.description}</p>
          </div>
        </div>

        {/* 游戏区域 */}
        <div className="flex justify-center">
          <GameContainer gameType={type} />
        </div>
      </div>
    </div>
  );
}
