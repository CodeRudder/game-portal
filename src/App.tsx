import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════
// Eager-loaded — 仅路由框架本身（无页面组件）
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Lazy-loaded 页面 — 所有页面按需加载，减小首屏 bundle 体积
// ═══════════════════════════════════════════════════════════════

// ── 核心页面 ──
const HomePage = lazy(() => import('./pages/HomePage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const IdleGameZone = lazy(() => import('./pages/IdleGameZone'));
const IdleGamePage = lazy(() => import('./pages/IdleGamePage'));

// ── POC 页面 ──
const PixiPOC = lazy(() => import('./poc/pixi-poc/PixiPOC'));
const SpritePOC = lazy(() => import('./poc/sprite-poc/SpritePOC'));

// ── PixiJS 高品质放置游戏 — 每个游戏独立路由，独立 chunk ──
const ThreeKingdomsGame = lazy(() => import('./components/idle/ThreeKingdomsGame'));
const CivChinaPixiGame = lazy(() => import('./components/idle/CivChinaPixiGame'));
const CivEgyptPixiGame = lazy(() => import('./components/idle/CivEgyptPixiGame'));
const CivBabylonPixiGame = lazy(() => import('./components/idle/CivBabylonPixiGame'));
const CivIndiaPixiGame = lazy(() => import('./components/idle/CivIndiaPixiGame'));
const TotalWarPixiGame = lazy(() => import('./components/idle/TotalWarPixiGame'));
const HeroesMightPixiGame = lazy(() => import('./components/idle/HeroesMightPixiGame'));
const AgeOfEmpiresPixiGame = lazy(() => import('./components/idle/AgeOfEmpiresPixiGame'));

/** 游戏加载时的通用 fallback */
function GameLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gp-dark">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gp-accent border-t-transparent" />
        <p className="text-sm text-gray-400">正在加载游戏引擎…</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gp-dark stars-bg">
      <Suspense fallback={<GameLoader />}>
        <Routes>
          {/* ── 首页 & 列表页 ── */}
          <Route path="/" element={<HomePage />} />
          <Route path="/game/:gameType" element={<GamePage />} />
          <Route path="/idle" element={<IdleGameZone />} />

          {/* ── 放置游戏详情页（通用动态路由，兼容旧链接） ── */}
          <Route path="/idle/:gameId" element={<IdleGamePage />} />

          {/* ── POC 页面 ── */}
          <Route path="/poc/pixi" element={<PixiPOC />} />
          <Route path="/poc/sprite-demo" element={<SpritePOC />} />

          {/* ── 三国霸业 — 独立路由，独立 chunk ── */}
          <Route path="/games/three-kingdoms-pixi" element={<ThreeKingdomsGame />} />

          {/* ── PixiJS 文明 & 策略游戏 — 独立路由，独立 chunk ── */}
          <Route path="/games/civ-china-pixi" element={<CivChinaPixiGame />} />
          <Route path="/games/civ-egypt-pixi" element={<CivEgyptPixiGame />} />
          <Route path="/games/civ-babylon-pixi" element={<CivBabylonPixiGame />} />
          <Route path="/games/civ-india-pixi" element={<CivIndiaPixiGame />} />
          <Route path="/games/total-war-pixi" element={<TotalWarPixiGame />} />
          <Route path="/games/heroes-might-pixi" element={<HeroesMightPixiGame />} />
          <Route path="/games/age-of-empires-pixi" element={<AgeOfEmpiresPixiGame />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
