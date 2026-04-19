import { Link, useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-gp-accent/20 bg-gp-dark/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-gp-accent to-gp-neon text-xl font-bold">
            🎮
          </div>
          <span className="font-game text-sm text-gp-neon neon-text">
            Game Portal
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-400 hover:text-gp-neon transition-colors"
          >
            🏠 首页
          </button>
          <button
            onClick={() => navigate('/idle')}
            className="text-sm text-gray-400 hover:text-gp-gold transition-colors"
          >
            🌙 放置专区
          </button>
          <button
            onClick={() => {
              const el = document.getElementById('scoreboard');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-sm text-gray-400 hover:text-gp-neon transition-colors"
          >
            🏆 排行榜
          </button>
        </nav>
      </div>
    </header>
  );
}
