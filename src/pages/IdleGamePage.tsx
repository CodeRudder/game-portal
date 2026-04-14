/**
 * IdleGamePage — 放置游戏详情页
 *
 * 路由: /idle/:gameId
 * 根据 gameId 创建对应的引擎并渲染 IdleGamePlayer。
 */
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';

/** 放置游戏注册信息 */
interface IdleGameConfig {
  name: string;
  icon: string;
  description: string;
  legacyRoute: string; // 当前指向原始 GameContainer 路由
}

const IDLE_GAME_REGISTRY: Record<string, IdleGameConfig> = {
  'cookie-clicker': {
    name: 'Cookie Clicker',
    icon: '🍪',
    description: '点击生产饼干，购买升级自动产出，打造你的饼干帝国！',
    legacyRoute: '/game/cookie-clicker',
  },
};

export default function IdleGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const config = gameId ? IDLE_GAME_REGISTRY[gameId] : undefined;

  if (!config) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex flex-col items-center justify-center py-32">
          <div className="mb-4 text-6xl">🤔</div>
          <h2 className="mb-4 font-game text-lg text-gp-neon">游戏未找到</h2>
          <button
            onClick={() => navigate('/idle')}
            className="rounded-xl bg-gp-accent px-6 py-3 text-white transition hover:bg-gp-accent/80"
          >
            返回放置游戏专区
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 标题区 */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate('/idle')}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            ←
          </button>
          <div>
            <h1 className="font-game text-lg text-gp-gold">
              {config.icon} {config.name}
            </h1>
            <p className="text-sm text-gray-400">{config.description}</p>
          </div>
        </div>

        {/* 游戏区域 */}
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="text-5xl">{config.icon}</div>
          <p className="text-center text-sm text-gray-400">
            此游戏正在接入放置游戏专区，当前请通过原始入口游玩
          </p>
          <button
            onClick={() => navigate(config.legacyRoute)}
            className="rounded-xl bg-gradient-to-r from-gp-accent to-gp-neon px-6 py-3 text-sm font-bold text-white shadow-lg shadow-gp-accent/30 transition hover:shadow-gp-accent/50"
          >
            🎮 开始游戏
          </button>
          <button
            onClick={() => navigate('/idle')}
            className="text-sm text-gray-500 hover:text-gp-neon transition-colors"
          >
            ← 返回放置游戏专区
          </button>
        </div>
      </div>
    </div>
  );
}
