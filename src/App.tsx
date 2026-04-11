import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';

function App() {
  return (
    <div className="min-h-screen bg-gp-dark stars-bg">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:gameType" element={<GamePage />} />
      </Routes>
    </div>
  );
}

export default App;
