import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import IdleGameZone from './pages/IdleGameZone';
import IdleGamePage from './pages/IdleGamePage';

function App() {
  return (
    <div className="min-h-screen bg-gp-dark stars-bg">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:gameType" element={<GamePage />} />
        <Route path="/idle" element={<IdleGameZone />} />
        <Route path="/idle/:gameId" element={<IdleGamePage />} />
      </Routes>
    </div>
  );
}

export default App;
