# 🎮 Game Portal

A pure front-end mini-game portal featuring a dark neon theme, pixel-art font, and responsive layout. Currently includes three classic Canvas games — Tetris, Snake, and Sokoban — with plans to expand to 23 titles.

[**中文**](./README.md)

---

## ✨ Features

- 🎮 Three classic games: Tetris, Snake, Sokoban
- 🏆 Game records & high scores (localStorage persistence)
- 🎨 Dark neon theme with pixel-art font (Press Start 2P)
- 📱 Responsive design for desktop and mobile
- ⚡ Canvas rendering with a unified engine abstraction layer
- 🧪 156 test cases, 100% pass rate
- 🐳 Docker multi-stage build (~25MB final image)

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

# Run tests (156 cases)
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

## 📁 Project Structure

```
game-portal/
├── src/
│   ├── core/               # GameEngine abstract base class
│   ├── games/              # Game engine implementations
│   │   ├── tetris/         # Tetris
│   │   ├── snake/          # Snake
│   │   └── sokoban/        # Sokoban
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
│   └── __tests__/          # Test files (6 files, 156 cases)
├── Dockerfile              # Multi-stage build (Node 20 + Nginx)
├── docker-compose.yml      # Production + dev dual-mode
├── nginx.conf              # Gzip + SPA fallback + security headers
├── deploy-docker.sh        # One-click deploy script
├── GAME-EXPANSION-PLAN.md  # Game Expansion Plan (Chinese)
├── GAME-EXPANSION-PLAN.en.md # Game Expansion Plan (English)
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

### Implemented Games

| Game | Engine | Test Cases |
|------|--------|-----------|
| 🟦 Tetris | TetrisEngine | 53 |
| 🐍 Snake | SnakeEngine | 29 |
| 📦 Sokoban | SokobanEngine | 41 |

### Test Coverage

| Test File | Cases | Coverage |
|-----------|-------|----------|
| tetris.test.ts | 53 | Init, piece generation, rotation, collision, line clear, scoring, levels, game over |
| snake.test.ts | 29 | Init, movement, turning, food, collision, speed, boundaries |
| sokoban.test.ts | 41 | Init, movement, box pushing, win detection, undo, levels, events |
| game-container.test.tsx | 6 | Engine binding, lifecycle, event propagation |
| storage.test.ts | 21 | 5 sub-services + GAME_META |
| routing.test.tsx | 6 | Home rendering, game navigation, 404 handling |
| **Total** | **156** | — |

## 🗺 Expansion Plan

Planned v2.0 → v5.0 across four batches, adding 20 new games (Minesweeper, 2048, Flappy Bird, Gomoku, Dino Runner, Breakout, Pac-Man, etc.) with a GameRegistry mechanism for hot-pluggable game modules.

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
