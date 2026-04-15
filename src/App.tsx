import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import IdleGameZone from './pages/IdleGameZone';
import IdleGamePage from './pages/IdleGamePage';
import { PixiPOC } from './poc/pixi-poc';
import { SpritePOC } from './poc/sprite-poc';
import ThreeKingdomsPixiGame from './components/idle/ThreeKingdomsPixiGame';

function App() {
  return (
    <div className="min-h-screen bg-gp-dark stars-bg">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:gameType" element={<GamePage />} />
        <Route path="/idle" element={<IdleGameZone />} />
        <Route path="/idle/:gameId" element={<IdleGamePage />} />
        <Route path="/poc/pixi" element={<PixiPOC />} />
        <Route path="/poc/sprite-demo" element={<SpritePOC />} />
        <Route path="/games/three-kingdoms-pixi" element={<ThreeKingdomsPixiGame />} />
      </Routes>
    </div>
  );
}

export default App;
