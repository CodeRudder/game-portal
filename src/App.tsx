import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import IdleGameZone from './pages/IdleGameZone';
import IdleGamePage from './pages/IdleGamePage';
import { PixiPOC } from './poc/pixi-poc';
import { SpritePOC } from './poc/sprite-poc';
import ThreeKingdomsGame from './components/idle/ThreeKingdomsGame';
import { GameErrorBoundary } from './components/idle/three-kingdoms/GameErrorBoundary';

// ═══════════════════════════════════════════════════════════════
// Lazy-loaded PixiJS 游戏组件 — 减小首屏 bundle 体积
// ═══════════════════════════════════════════════════════════════
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
      <Routes>
        {/* 原有路由 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:gameType" element={<GamePage />} />
        <Route path="/idle" element={<IdleGameZone />} />
        <Route path="/idle/:gameId" element={<IdleGamePage />} />
        <Route path="/poc/pixi" element={<PixiPOC />} />
        <Route path="/poc/sprite-demo" element={<SpritePOC />} />
        <Route path="/games/three-kingdoms-pixi" element={<GameErrorBoundary><ThreeKingdomsGame /></GameErrorBoundary>} />

        {/* PixiJS 文明 & 策略游戏路由 — lazy loaded */}
        <Route
          path="/games/civ-china-pixi"
          element={<Suspense fallback={<GameLoader />}><CivChinaPixiGame /></Suspense>}
        />
        <Route
          path="/games/civ-egypt-pixi"
          element={<Suspense fallback={<GameLoader />}><CivEgyptPixiGame /></Suspense>}
        />
        <Route
          path="/games/civ-babylon-pixi"
          element={<Suspense fallback={<GameLoader />}><CivBabylonPixiGame /></Suspense>}
        />
        <Route
          path="/games/civ-india-pixi"
          element={<Suspense fallback={<GameLoader />}><CivIndiaPixiGame /></Suspense>}
        />
        <Route
          path="/games/total-war-pixi"
          element={<Suspense fallback={<GameLoader />}><TotalWarPixiGame /></Suspense>}
        />
        <Route
          path="/games/heroes-might-pixi"
          element={<Suspense fallback={<GameLoader />}><HeroesMightPixiGame /></Suspense>}
        />
        <Route
          path="/games/age-of-empires-pixi"
          element={<Suspense fallback={<GameLoader />}><AgeOfEmpiresPixiGame /></Suspense>}
        />
      </Routes>
    </div>
  );
}

export default App;
