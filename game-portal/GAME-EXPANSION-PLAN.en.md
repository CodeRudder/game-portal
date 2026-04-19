# Game Portal — Game Expansion Plan

> **Project**: Game Portal  
> **Current Version**: v1.0 (Tetris / Snake / Sokoban)  
> **Planned Versions**: v2.0 → v5.0  
> **Created**: 2026-04-11  
> **Test Baseline**: 6 files, 156 cases, all passing  

---

## 1. Overview

This plan organizes 20 candidate mini-games into **4 batches** of 5 games each, grouped by complexity and genre. Each batch is estimated at 1–2 weeks of development.

```
v1.0 ████████░░░░░░░░░░░░ Complete (3 games)
v2.0 ████████████░░░░░░░░ Batch 1 (5 games) — Beginner + Puzzle
v3.0 ████████████████░░░░ Batch 2 (5 games) — Reaction + Strategy
v4.0 ████████████████████░ Batch 3 (5 games) — Arcade + Board
v5.0 █████████████████████ Batch 4 (5 games) — Advanced + Versus
```

**Final Goal**: 23 games (3 existing + 20 new) covering six genres: Puzzle, Reaction, Strategy, Arcade, Simulation, and Versus.

---

## 2. Candidate Game List

### Implemented (v1.0)

| # | Game | Genre | Status |
|---|------|-------|--------|
| — | Tetris | Reaction / Arcade | ✅ Complete |
| — | Snake | Reaction / Arcade | ✅ Complete |
| — | Sokoban | Puzzle / Logic | ✅ Complete |

### New Candidates (Top 20)

| # | Game | Genre | Complexity | Description |
|---|------|-------|------------|-------------|
| 1 | Minesweeper | Puzzle / Logic | ⭐⭐ | Classic grid deduction — reveal safe cells, flag mines |
| 2 | 2048 | Puzzle / Numbers | ⭐⭐ | 4×4 sliding tile merge — goal: reach 2048 |
| 3 | Tron / Light Cycles | Reaction / Versus | ⭐⭐ | Two light trails, last one standing wins |
| 4 | Breakout | Reaction / Arcade | ⭐⭐⭐ | Paddle + ball, destroy all bricks |
| 5 | Pac-Man | Arcade / Chase | ⭐⭐⭐ | Maze eating dots, dodging ghosts, power pellets |
| 6 | Flappy Bird | Reaction / Arcade | ⭐ | Tap to fly through pipe gaps |
| 7 | Gomoku | Strategy / Board | ⭐⭐ | 15×15 board, first to connect five wins |
| 8 | Snake 2P | Reaction / Versus | ⭐⭐⭐ | Two-player same-screen Snake |
| 9 | Checkers | Strategy / Board | ⭐⭐⭐ | 8×8 board, jump-capture opponent pieces |
| 10 | Conway's Game of Life | Simulation / Sandbox | ⭐ | Cellular automaton — set initial state, watch evolution |
| 11 | Memory Match | Puzzle / Memory | ⭐ | Flip cards to find matching pairs |
| 12 | Pinball | Reaction / Arcade | ⭐⭐⭐⭐ | Ball physics, flippers, scoring zones |
| 13 | Othello | Strategy / Board | ⭐⭐⭐ | 8×8 board, flip opponent discs by sandwiching |
| 14 | Tic-Tac-Toe | Strategy / Board | ⭐ | 3×3 minimal board game |
| 15 | Match-3 | Puzzle / Casual | ⭐⭐⭐ | Swap adjacent gems, match three to clear |
| 16 | Dino Runner | Reaction / Endless | ⭐⭐ | Chrome offline dinosaur — jump/duck obstacles |
| 17 | Space Invaders | Shooter / Arcade | ⭐⭐⭐ | Classic space shooter, dodge enemy fire |
| 18 | Sudoku | Puzzle / Logic | ⭐⭐ | 9×9 number fill, no repeats in row/column/box |
| 19 | Pipe Mania | Puzzle / Strategy | ⭐⭐ | Rotate pipe segments to connect water flow |
| 20 | Tetris 2P | Reaction / Versus | ⭐⭐⭐⭐ | Two-player competitive Tetris, line-clear attacks |

---

## 3. Batch Development Plan

### Batch 1 — v2.0 (Beginner + Puzzle)

**Goal**: Quickly expand the game library with low-complexity, high-recognition titles. Validate the extensible architecture.

| # | Game | Complexity | Est. Time | Key Implementation |
|---|------|------------|-----------|-------------------|
| B1-1 | **Flappy Bird** | ⭐ | 1 day | Gravity simulation, pipe generation, collision, tap-to-jump |
| B1-2 | **2048** | ⭐⭐ | 1.5 days | 4×4 grid, slide-merge logic, transition animations, scoring |
| B1-3 | **Memory Match** | ⭐ | 1 day | Card flip animation, pair matching, timer, difficulty levels |
| B1-4 | **Tic-Tac-Toe** | ⭐ | 1 day | 3×3 board, Minimax AI, win/draw detection |
| B1-5 | **Conway's Game of Life** | ⭐ | 1 day | Cellular automaton rules, Canvas grid render, play/pause/step |

**Acceptance Criteria**:
- Each game has an independent Engine class extending `GameEngine`
- Complete Vitest test suite (≥ 15 cases per game)
- Game Portal home page GameCard display + route integration
- Zero build errors, all tests passing

**Architecture Tasks** (pre-Batch 1):
- [ ] Refactor `GameEngine` base class — extract common lifecycle (init → start → pause → resume → gameover)
- [ ] Unified game registration mechanism (GameRegistry) — new games only need registration config, no route changes
- [ ] Extract shared UI components (GameOverlay / GameHUD / GameControls)
- [ ] Establish game config schema (gridSize / controls / difficultyLevels)

---

### Batch 2 — v3.0 (Reaction + Strategy)

**Goal**: Introduce medium-complexity games with strategic depth and reaction-based gameplay.

| # | Game | Complexity | Est. Time | Key Implementation |
|---|------|------------|-----------|-------------------|
| B2-1 | **Minesweeper** | ⭐⭐ | 2 days | Cell state machine, recursive reveal, mine generation, timer |
| B2-2 | **Gomoku** | ⭐⭐ | 2 days | 15×15 board, win detection (4-direction connect-5), AI (heuristic scoring) |
| B2-3 | **Dino Runner** | ⭐⭐ | 1.5 days | Parallax scrolling, obstacle generation, jump/duck, speed ramp |
| B2-4 | **Tron / Light Cycles** | ⭐⭐ | 2 days | Dual trail system, direction control, collision, AI opponent |
| B2-5 | **Pipe Mania** | ⭐⭐ | 2 days | Pipe types (straight/bend/T/cross), rotation, BFS flow validation |

**Acceptance Criteria**:
- Minesweeper supports 3 difficulty levels (Beginner 9×9/10, Intermediate 16×16/40, Expert 30×16/99)
- Gomoku supports PvP + PvAI (AI scoring ≥ medium level)
- Dino Runner supports keyboard + touch input
- ≥ 20 test cases per game

---

### Batch 3 — v4.0 (Arcade + Board)

**Goal**: Introduce classic arcade and board games with enhanced visual presentation.

| # | Game | Complexity | Est. Time | Key Implementation |
|---|------|------------|-----------|-------------------|
| B3-1 | **Breakout** | ⭐⭐⭐ | 2.5 days | Ball physics (angle reflection), brick layouts, power-ups, paddle control |
| B3-2 | **Pac-Man** | ⭐⭐⭐ | 3 days | Maze data structure, ghost AI (chase/scatter/frightened), power pellets |
| B3-3 | **Space Invaders** | ⭐⭐⭐ | 2.5 days | Enemy formation movement, bullet system, collision, wave stages |
| B3-4 | **Othello** | ⭐⭐⭐ | 2 days | 8×8 board, sandwich-flip logic, valid move calculation, AI (position weight table) |
| B3-5 | **Checkers** | ⭐⭐⭐ | 2.5 days | Piece movement rules, jump-capture logic, king promotion, AI (Minimax + α-β pruning) |

**Acceptance Criteria**:
- Breakout supports multi-level (≥ 3 brick layouts) and power-up drops
- Pac-Man recreates classic 4-ghost AI behavior patterns
- Space Invaders supports multi-wave + boss stages
- Board game AI difficulty is configurable (Easy / Medium / Hard)
- ≥ 25 test cases per game

---

### Batch 4 — v5.0 (Advanced + Versus)

**Goal**: High-complexity games with multiplayer versus and advanced physics simulation.

| # | Game | Complexity | Est. Time | Key Implementation |
|---|------|------------|-----------|-------------------|
| B4-1 | **Match-3** | ⭐⭐⭐ | 3 days | Gem grid, swap detection, chain-clear animations, drop fill, combo system |
| B4-2 | **Sudoku** | ⭐⭐ | 2 days | Puzzle generation, unique-solution validation, candidate notes, undo system |
| B4-3 | **Pinball** | ⭐⭐⭐⭐ | 4 days | Physics engine (gravity/elastic collision), flipper control, scoring zones, multi-ball |
| B4-4 | **Snake 2P** | ⭐⭐⭐ | 2.5 days | Dual keyboard mapping (WASD + arrows), collision rules, score sync |
| B4-5 | **Tetris 2P** | ⭐⭐⭐⭐ | 4 days | Dual independent boards, line-clear attack, garbage lines, versus UI |

**Acceptance Criteria**:
- Match-3 supports chain-clear animations and combo scoring
- Sudoku generator ensures unique solution, 3 difficulty levels
- Pinball physics runs smoothly at ≥ 60fps
- Versus games support local 2-player + AI opponent modes
- ≥ 30 test cases per game

---

## 4. Technical Architecture

### 4.1 Engine Architecture (GameEngine Base Class Extension)

```
GameEngine (Abstract Base)
├── Core Lifecycle
│   ├── init()          — Initialize game state
│   ├── start()         — Start game loop
│   ├── pause()         — Pause
│   ├── resume()        — Resume
│   ├── reset()         — Reset
│   └── destroy()       — Cleanup & release resources
├── Game Loop
│   ├── update(dt)      — Logic frame update
│   └── render(ctx)     — Canvas render
├── Input Handling
│   ├── handleKeyDown()
│   ├── handleKeyUp()
│   └── handleClick()
├── State Management
│   ├── getState()      — Serialize state
│   └── loadState()     — Restore state (save/load)
└── Events (EventEmitter)
    ├── stateChange     — State change
    ├── scoreChange     — Score change
    ├── levelChange     — Level change
    └── gameover        — Game over
```

### 4.2 Game Registry

```typescript
// Game Registration Schema
interface GameRegistration {
  id: string;                    // Unique ID, e.g. 'minesweeper'
  name: string;                  // Display name
  nameEn: string;                // English name
  icon: string;                  // Icon (emoji or SVG)
  category: GameCategory;        // Category
  difficulty: 1 | 2 | 3 | 4;    // Complexity
  controls: ControlScheme;       // Control scheme
  engine: new () => GameEngine;  // Engine constructor
  thumbnail?: string;            // Thumbnail
  description: string;           // Description
  tags: string[];                // Tags
}

type GameCategory = 'puzzle' | 'arcade' | 'strategy' | 'reaction' | 'simulation' | 'versus';

// Registration example
GameRegistry.register({
  id: 'flappy-bird',
  name: 'Flappy Bird',
  nameEn: 'Flappy Bird',
  icon: '🐦',
  category: 'arcade',
  difficulty: 1,
  controls: { type: 'click', description: 'Tap / Space to jump' },
  engine: FlappyBirdEngine,
  description: 'Tap to fly through pipe gaps',
  tags: ['reaction', 'arcade', 'casual']
});
```

### 4.3 Project Directory Structure (Post-Expansion)

```
src/
├── engines/                    # Game engines
│   ├── core/
│   │   ├── GameEngine.ts       # Abstract base class
│   │   ├── GameRegistry.ts     # Registry center
│   │   └── types.ts            # Common types
│   ├── tetris/
│   │   └── TetrisEngine.ts
│   ├── snake/
│   │   └── SnakeEngine.ts
│   ├── sokoban/
│   │   └── SokobanEngine.ts
│   ├── flappy-bird/
│   │   └── FlappyBirdEngine.ts
│   ├── 2048/
│   │   └── TwentyFortyEightEngine.ts
│   ├── ... (each game in its own directory)
│   └── index.ts                # Unified export + auto-registration
├── components/
│   ├── game/
│   │   ├── GameContainer.tsx   # Generic container
│   │   ├── GameCard.tsx        # Home page card
│   │   ├── GameOverlay.tsx     # Pause/game-over overlay
│   │   ├── GameHUD.tsx         # Generic info bar
│   │   └── GameControls.tsx    # Generic control panel
│   └── layout/
│       ├── Header.tsx
│       └── Footer.tsx
├── pages/
│   ├── HomePage.tsx            # Auto-render cards from Registry
│   └── GamePage.tsx            # Dynamic Engine loading
├── services/
│   └── StorageService.ts
├── types/
│   └── index.ts
├── __tests__/
│   ├── engines/                # Per-engine test directories
│   │   ├── tetris.test.ts
│   │   ├── flappy-bird.test.ts
│   │   └── ...
│   ├── components/
│   │   ├── game-container.test.tsx
│   │   └── ...
│   └── integration/
│       └── routing.test.tsx
└── App.tsx
```

### 4.4 Shared Components

| Component | Responsibility | Reuse |
|-----------|---------------|-------|
| `GameContainer` | Canvas lifecycle + Engine binding | All games |
| `GameOverlay` | Pause/game-over/victory popup | All games |
| `GameHUD` | Score/level/time/steps display | Most games |
| `GameControls` | D-pad/buttons (mobile-friendly) | Arcade/strategy |
| `GameCard` | Home page game card | Home page list |
| `DifficultySelector` | Difficulty picker | Minesweeper/Sudoku/Gomoku |
| `ScoreBoard` | Leaderboard component | All games |

---

## 5. Development Workflow

### 5.1 Single Game Development SOP

```
1. Engine Development
   ├── Create engine directory src/engines/<game-id>/
   ├── Implement <Name>Engine extends GameEngine
   ├── Complete 7 abstract methods + game-specific logic
   └── Export via src/engines/index.ts

2. Test Writing
   ├── Create src/__tests__/engines/<game-id>.test.ts
   ├── Basic tests (init/state/reset) ≥ 5 cases
   ├── Core logic tests ≥ 10 cases
   └── Edge case / error tests ≥ 5 cases

3. Registration
   ├── GameRegistry.register({...})
   ├── Auto-display on home page (no route changes)
   └── GamePage dynamic Engine loading

4. Integration Verification
   ├── Full npm test passes
   ├── npm run build zero errors
   └── Docker build verification
```

### 5.2 Quality Gates

| Metric | Standard |
|--------|----------|
| Test Cases | ≥ 15 (⭐) / 20 (⭐⭐) / 25 (⭐⭐⭐) / 30 (⭐⭐⭐⭐) |
| Test Pass Rate | 100% |
| Build Errors | 0 |
| TypeScript Strict Mode | No `any` |
| Canvas Performance | ≥ 60fps (standard scenes) |

---

## 6. Milestone Timeline

```
2026-04  ████████  v1.0 Complete (Tetris + Snake + Sokoban)
2026-04  ░░░░░░░░  v2.0 Batch 1 (Flappy Bird / 2048 / Memory Match / Tic-Tac-Toe / Game of Life)
2026-05  ░░░░░░░░  v3.0 Batch 2 (Minesweeper / Gomoku / Dino Runner / Tron / Pipe Mania)
2026-05  ░░░░░░░░  v4.0 Batch 3 (Breakout / Pac-Man / Space Invaders / Othello / Checkers)
2026-06  ░░░░░░░░  v5.0 Batch 4 (Match-3 / Sudoku / Pinball / Snake 2P / Tetris 2P)
```

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Insufficient Engine base class abstraction | New games require hacks | Refactor base class before Batch 1, establish GameRegistry |
| Canvas performance bottleneck (Pinball physics) | Frame rate drops | Use requestAnimationFrame + spatial partitioning for collision |
| AI algorithm complexity (board games) | Extended dev cycles | Implement simple AI first, iterate later |
| Test case bloat | Maintenance cost | Isolate by engine directory, CI runs per batch |
| Mobile adaptation | Poor touch experience | Unified GameControls component, auto-detect touch |

---

## 8. Next Steps

- [ ] User selects games from Top 20 for first batch
- [ ] Refactor GameEngine base class + establish GameRegistry
- [ ] Begin Batch 1 development (v2.0)
