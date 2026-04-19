# 🎮 Game Portal

A pure front-end mini-game portal featuring a dark neon theme, pixel-art font, and responsive layout. Currently includes 8 classic Canvas games across puzzle, reaction, strategy, and simulation categories.

[**中文**](./README.md)

---

## ✨ Features

- 🎮 Eight classic games: Tetris, Snake, Sokoban, Flappy Bird, 2048, Memory Match, Tic-Tac-Toe, Conway's Game of Life
- 🏆 Game records & high scores (localStorage persistence)
- 🎨 Dark neon theme with pixel-art font (Press Start 2P)
- 📱 Responsive design for desktop and mobile
- ⚡ Canvas rendering with a unified engine abstraction layer
- 🧪 518 test cases, 100% pass rate
- 🐳 Docker multi-stage build (~25MB final image)
- 🚀 One-click Vercel deployment

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + TypeScript 5 |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Game Rendering | Canvas API |
| Routing | react-router-dom v6 |
| Testing | Vitest + @testing-library/react |
| Containerization | Docker + Nginx (multi-stage build) |
| Deployment | Vercel / Docker |

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Development mode (http://localhost:3000)
npm run dev

# Build
npm run build

# Preview build output
npm run preview

# Run tests (518 cases)
npm test

# Test coverage
npm run test:coverage
```

### Docker Deployment

```bash
# One-click deploy
./deploy-docker.sh

# Or build manually
docker build -t game-portal .
docker run -p 8080:80 game-portal

# docker-compose (production)
docker compose up -d

# docker-compose (dev mode with hot reload)
docker compose --profile dev up
```

## 🌐 Live Demo

| Environment | URL |
|-------------|-----|
| Vercel (v2.0) | https://skill-deploy-u7xvhb5l1p-agent-skill-vercel.vercel.app |

> Use the [Claim URL](https://vercel.com/claim-deployment?code=2dea1012-1232-4078-95c6-ea953efee223) to link this deployment to your Vercel account for management.

## 📁 Project Structure

```
game-portal/
├── src/
│   ├── core/               # GameEngine abstract base class
│   ├── games/              # Game engine implementations
│   │   ├── tetris/         # Tetris
│   │   ├── snake/          # Snake
│   │   ├── sokoban/        # Sokoban
│   │   ├── flappy-bird/    # Flappy Bird
│   │   ├── 2048/           # 2048
│   │   ├── memory-match/   # Memory Match
│   │   ├── tic-tac-toe/    # Tic-Tac-Toe
│   │   └── game-of-life/   # Conway's Game of Life
│   ├── components/         # React components
│   │   ├── GameContainer   # Game container (Canvas + HUD + Overlay)
│   │   ├── GameCard        # Game card
│   │   ├── ScoreBoard      # Leaderboard
│   │   └── Header          # Navigation bar
│   ├── pages/              # Pages
│   │   ├── HomePage        # Home page (game list)
│   │   └── GamePage        # Game page (dynamic loading)
│   ├── services/           # Data services (localStorage)
│   ├── types/              # TypeScript type definitions
│   └── __tests__/          # Test files (13 files, 518 cases)
├── Dockerfile              # Multi-stage build (Node 20 + Nginx)
├── docker-compose.yml      # Production + dev dual-mode
├── nginx.conf              # Gzip + SPA fallback + security headers
├── deploy-docker.sh        # One-click deploy script
├── GAME-EXPANSION-PLAN.md  # Game Expansion Plan (Chinese)
└── DEPLOY.md               # Deployment guide
```

## 🎯 Game Engine Architecture

All game engines extend the `GameEngine` abstract base class with a unified lifecycle and event system:

```
GameEngine (abstract)
├── Lifecycle: init → start → pause → resume → gameover
├── Event system: on / off / emit (stateChange, scoreChange, levelChange)
└── 7 abstract methods: onInit, onStart, update, onRender, handleKeyDown, handleKeyUp, getState
```

### Implemented Games (v2.0)

| Game | Engine | Test Cases | Category |
|------|--------|-----------|----------|
| 🟦 Tetris | TetrisEngine | 53 | Reaction/Arcade |
| 🐍 Snake | SnakeEngine | 29 | Reaction/Arcade |
| 📦 Sokoban | SokobanEngine | 41 | Puzzle/Logic |
| 🐦 Flappy Bird | FlappyBirdEngine | 46 | Reaction/Arcade |
| 🔢 2048 | TwentyFortyEightEngine | 48 | Puzzle/Numbers |
| 🃏 Memory Match | MemoryMatchEngine | 43 | Puzzle/Memory |
| ❌⭕ Tic-Tac-Toe | TicTacToeEngine | 64 | Strategy/Board |
| 🧬 Game of Life | GameOfLifeEngine | 86 | Simulation/Sandbox |

### Test Coverage

| Test File | Cases | Coverage |
|-----------|-------|----------|
| tetris.test.ts | 53 | Init, piece generation, rotation, collision, line clear, scoring, levels, game over |
| snake.test.ts | 29 | Init, movement, turning, food, collision, speed, boundaries |
| sokoban.test.ts | 41 | Init, movement, box pushing, win detection, undo, levels, events |
| flappy-bird.test.ts | 46 | Gravity, jump, pipe generation, collision, scoring, difficulty scaling |
| 2048.test.ts | 48 | Grid ops, slide & merge, score calculation, game over detection, animation |
| memory-match.test.ts | 43 | Card flip, pair matching, timer, difficulty levels, combo system |
| tic-tac-toe.test.ts | 64 | Move logic, win detection, AI (Minimax), scoring, reset |
| game-of-life.test.ts | 86 | Cell rules, generation evolution, boundary handling, interaction, Canvas rendering |
| game-container.test.tsx | 6 | Engine binding, lifecycle, event propagation |
| storage.test.ts | 21 | 5 sub-services + GAME_META |
| routing.test.tsx | 6 | Home rendering, game navigation, 404 handling |
| **Total** | **518** | — |

## 🗺 Expansion Plan

v2.0 Batch 1 complete ✅. Planned v3.0 → v5.0 across three batches, adding 15 new games (Minesweeper, Gomoku, Dino Runner, Breakout, Pac-Man, etc.).

See → [GAME-EXPANSION-PLAN.en.md](./GAME-EXPANSION-PLAN.en.md)

## 📄 Documentation

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | Project README (Chinese) |
| [README.en.md](./README.en.md) | Project README (English) |
| [GAME-EXPANSION-PLAN.md](./GAME-EXPANSION-PLAN.md) | Game Expansion Plan (Chinese) |
| [GAME-EXPANSION-PLAN.en.md](./GAME-EXPANSION-PLAN.en.md) | Game Expansion Plan (English) |
| [DEPLOY.md](./DEPLOY.md) | Deployment Guide |

## 📝 License

MIT
