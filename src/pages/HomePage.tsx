import { GameType } from '@/types';
import Header from '../components/Header';
import GameCard from '../components/GameCard';
import ScoreBoard from '../components/ScoreBoard';

const GAMES: GameType[] = [GameType.TETRIS, GameType.SNAKE, GameType.SOKOBAN, GameType.FLAPPY_BIRD, GameType.G2048, GameType.MEMORY_MATCH, GameType.TIC_TAC_TOE, GameType.GAME_OF_LIFE, GameType.MINESWEEPER, GameType.GOMOKU, GameType.DINO_RUNNER, GameType.TRON, GameType.PIPE_MANIA, GameType.BREAKOUT, GameType.PACMAN];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden py-16 text-center sm:py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-gp-accent/5 via-transparent to-transparent" />
        {/* 装饰性光晕 */}
        <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-gp-accent/10 blur-[100px]" />
        <div className="relative mx-auto max-w-3xl px-4">
          <h1 className="font-game text-2xl leading-relaxed text-gp-neon neon-text sm:text-3xl md:text-4xl">
            Game Portal
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-gray-400 sm:text-lg">
            经典小游戏合集 — 俄罗斯方块、贪吃蛇、推箱子，即点即玩，无需安装
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-gray-500 sm:gap-3">
            <span className="rounded-full bg-white/5 px-3 py-1.5 backdrop-blur-sm">✨ 纯前端</span>
            <span className="rounded-full bg-white/5 px-3 py-1.5 backdrop-blur-sm">💾 本地存储</span>
            <span className="rounded-full bg-white/5 px-3 py-1.5 backdrop-blur-sm">🎮 即点即玩</span>
            <span className="rounded-full bg-white/5 px-3 py-1.5 backdrop-blur-sm">📱 多端适配</span>
          </div>
        </div>
      </section>

      {/* 游戏列表 */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {GAMES.map((type, i) => (
            <div key={type} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              <GameCard type={type} />
            </div>
          ))}
        </div>
      </section>

      {/* 排行榜 */}
      <ScoreBoard />

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-gray-600">
        <p>Game Portal © 2026 — Built with React + TypeScript + Tailwind CSS</p>
      </footer>
    </div>
  );
}
