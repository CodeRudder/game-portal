import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  GRID_SIZE, COLS, ROWS,
  WALL, DOT, POWER_PELLET, EMPTY, GHOST_HOME,
  PLAYER_SPEED, INITIAL_LIVES,
  GHOST_SPEED, GHOST_COUNT, FRIGHTENED_DURATION,
  DOT_SCORE, POWER_PELLET_SCORE, GHOST_SCORE, GHOST_SCORE_MULTIPLIER,
  BG_COLOR, WALL_COLOR, DOT_COLOR, PLAYER_COLOR, GHOST_COLORS, FRIGHTENED_COLOR,
  DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_NONE,
  DIR_DELTA,
  MAZE_TEMPLATE,
} from './constants';

interface Position {
  x: number;
  y: number;
}

interface Ghost {
  x: number;
  y: number;
  dir: number;
  color: string;
  frightened: boolean;
  eaten: boolean;
  homeTimer: number;
}

export class PacmanEngine extends GameEngine {
  private _lives: number = INITIAL_LIVES;
  private _maze: number[][] = [];
  private _playerX: number = 9;
  private _playerY: number = 15;
  private _playerDir: number = DIR_NONE;
  private _nextDir: number = DIR_NONE;
  private _ghosts: Ghost[] = [];
  private _dotCount: number = 0;
  private _totalDots: number = 0;
  private _frightenedTimer: number = 0;
  private _ghostsEatenCombo: number = 0;
  private _moveTimer: number = 0;
  private _ghostMoveTimer: number = 0;

  // Public getters
  get lives(): number { return this._lives; }
  get playerX(): number { return this._playerX; }
  get playerY(): number { return this._playerY; }
  get playerDir(): number { return this._playerDir; }
  get ghosts(): Ghost[] { return this._ghosts; }
  get dotCount(): number { return this._dotCount; }
  get totalDots(): number { return this._totalDots; }
  get maze(): number[][] { return this._maze; }
  get frightenedTimer(): number { return this._frightenedTimer; }

  protected onInit(): void {
    this.initMaze();
    this.initPlayer();
    this.initGhosts();
  }

  protected onStart(): void {
    this._lives = INITIAL_LIVES;
    this.initMaze();
    this.initPlayer();
    this.initGhosts();
    this._frightenedTimer = 0;
    this._ghostsEatenCombo = 0;
    this._moveTimer = 0;
    this._ghostMoveTimer = 0;
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000;

    // Update frightened timer
    if (this._frightenedTimer > 0) {
      this._frightenedTimer -= deltaTime;
      if (this._frightenedTimer <= 0) {
        this._frightenedTimer = 0;
        this._ghostsEatenCombo = 0;
        for (const g of this._ghosts) {
          g.frightened = false;
        }
      }
    }

    // Move player
    this._moveTimer += dt;
    if (this._moveTimer >= 1 / PLAYER_SPEED) {
      this._moveTimer -= 1 / PLAYER_SPEED;
      this.movePlayer();
    }

    // Move ghosts
    this._ghostMoveTimer += dt;
    if (this._ghostMoveTimer >= 1 / GHOST_SPEED) {
      this._ghostMoveTimer -= 1 / GHOST_SPEED;
      this.moveGhosts();
    }

    // Check collisions
    this.checkCollisions();

    // Check win
    if (this._dotCount >= this._totalDots) {
      this.nextLevel();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    const offsetX = Math.floor((w - COLS * GRID_SIZE) / 2);
    const offsetY = HUD_HEIGHT;

    // Draw maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this._maze[r][c];
        const x = offsetX + c * GRID_SIZE;
        const y = offsetY + r * GRID_SIZE;
        if (cell === WALL) {
          ctx.fillStyle = WALL_COLOR;
          ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE);
        } else if (cell === DOT) {
          ctx.fillStyle = DOT_COLOR;
          ctx.beginPath();
          ctx.arc(x + GRID_SIZE / 2, y + GRID_SIZE / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === POWER_PELLET) {
          ctx.fillStyle = DOT_COLOR;
          ctx.beginPath();
          ctx.arc(x + GRID_SIZE / 2, y + GRID_SIZE / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw player
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(
      offsetX + this._playerX * GRID_SIZE + GRID_SIZE / 2,
      offsetY + this._playerY * GRID_SIZE + GRID_SIZE / 2,
      GRID_SIZE / 2 - 2, 0, Math.PI * 2
    );
    ctx.fill();

    // Draw ghosts
    for (const ghost of this._ghosts) {
      if (ghost.eaten) continue;
      ctx.fillStyle = ghost.frightened ? FRIGHTENED_COLOR : ghost.color;
      ctx.beginPath();
      ctx.arc(
        offsetX + ghost.x * GRID_SIZE + GRID_SIZE / 2,
        offsetY + ghost.y * GRID_SIZE + GRID_SIZE / 2,
        GRID_SIZE / 2 - 2, 0, Math.PI * 2
      );
      ctx.fill();
    }

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText(`Score: ${this._score}`, 10, 25);
    ctx.fillText(`Level: ${this._level}`, 200, 25);
    ctx.fillText(`Lives: ${this._lives}`, 400, 25);
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    switch (key) {
      case 'ArrowUp': case 'w': case 'W':
        this._nextDir = DIR_UP;
        break;
      case 'ArrowDown': case 's': case 'S':
        this._nextDir = DIR_DOWN;
        break;
      case 'ArrowLeft': case 'a': case 'A':
        this._nextDir = DIR_LEFT;
        break;
      case 'ArrowRight': case 'd': case 'D':
        this._nextDir = DIR_RIGHT;
        break;
    }
  }

  handleKeyUp(_key: string): void {}

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      lives: this._lives,
      playerX: this._playerX,
      playerY: this._playerY,
      playerDir: this._playerDir,
      dotCount: this._dotCount,
      totalDots: this._totalDots,
      frightenedTimer: this._frightenedTimer,
    };
  }

  // ========== Private Methods ==========

  private initMaze(): void {
    this._maze = MAZE_TEMPLATE.map(row => [...row]);
    this._totalDots = 0;
    this._dotCount = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this._maze[r][c] === DOT || this._maze[r][c] === POWER_PELLET) {
          this._totalDots++;
        }
      }
    }
  }

  private initPlayer(): void {
    this._playerX = 9;
    this._playerY = 15;
    this._playerDir = DIR_NONE;
    this._nextDir = DIR_NONE;
  }

  private initGhosts(): void {
    this._ghosts = [];
    const startPositions = [
      { x: 9, y: 9 },
      { x: 8, y: 9 },
      { x: 10, y: 9 },
    ];
    for (let i = 0; i < GHOST_COUNT; i++) {
      this._ghosts.push({
        x: startPositions[i].x,
        y: startPositions[i].y,
        dir: DIR_UP,
        color: GHOST_COLORS[i],
        frightened: false,
        eaten: false,
        homeTimer: i * 3000, // stagger release
      });
    }
  }

  private isWalkable(x: number, y: number): boolean {
    if (y < 0 || y >= ROWS) return false;
    // Tunnel wrapping
    if (x < 0 || x >= COLS) return true;
    const cell = this._maze[y][x];
    return cell !== WALL;
  }

  private movePlayer(): void {
    // Try next direction first
    if (this._nextDir !== DIR_NONE) {
      const delta = DIR_DELTA[this._nextDir];
      const nx = this._playerX + delta.dx;
      const ny = this._playerY + delta.dy;
      // Handle tunnel
      const wrappedX = nx < 0 ? COLS - 1 : nx >= COLS ? 0 : nx;
      if (this.isWalkable(wrappedX, ny)) {
        this._playerDir = this._nextDir;
      }
    }

    // Move in current direction
    if (this._playerDir !== DIR_NONE) {
      const delta = DIR_DELTA[this._playerDir];
      let nx = this._playerX + delta.dx;
      let ny = this._playerY + delta.dy;
      // Tunnel wrapping
      if (nx < 0) nx = COLS - 1;
      else if (nx >= COLS) nx = 0;

      if (this.isWalkable(nx, ny)) {
        this._playerX = nx;
        this._playerY = ny;
        this.collectDot();
      }
    }
  }

  private collectDot(): void {
    const cell = this._maze[this._playerY][this._playerX];
    if (cell === DOT) {
      this._maze[this._playerY][this._playerX] = EMPTY;
      this._dotCount++;
      this.addScore(DOT_SCORE);
    } else if (cell === POWER_PELLET) {
      this._maze[this._playerY][this._playerX] = EMPTY;
      this._dotCount++;
      this.addScore(POWER_PELLET_SCORE);
      this.activateFrightened();
    }
  }

  private activateFrightened(): void {
    this._frightenedTimer = FRIGHTENED_DURATION;
    this._ghostsEatenCombo = 0;
    for (const g of this._ghosts) {
      if (!g.eaten) {
        g.frightened = true;
      }
    }
  }

  private moveGhosts(): void {
    for (const ghost of this._ghosts) {
      if (ghost.eaten) continue;

      // Home timer - ghost stays in box
      if (ghost.homeTimer > 0) {
        ghost.homeTimer -= 1000 / GHOST_SPEED;
        continue;
      }

      // Get possible directions
      const possibleDirs: number[] = [];
      for (const dir of [DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT]) {
        const delta = DIR_DELTA[dir];
        const nx = ghost.x + delta.dx;
        const ny = ghost.y + delta.dy;
        const wrappedX = nx < 0 ? COLS - 1 : nx >= COLS ? 0 : nx;
        if (this.isWalkable(wrappedX, ny)) {
          // Don't reverse direction unless no other choice
          if (dir !== this.oppositeDir(ghost.dir) || possibleDirs.length === 0) {
            possibleDirs.push(dir);
          }
        }
      }

      if (possibleDirs.length === 0) {
        // Must reverse
        ghost.dir = this.oppositeDir(ghost.dir);
      } else if (ghost.frightened) {
        // Random direction when frightened
        ghost.dir = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
      } else {
        // Chase: pick direction closest to player
        let bestDir = possibleDirs[0];
        let bestDist = Infinity;
        for (const dir of possibleDirs) {
          const delta = DIR_DELTA[dir];
          const nx = ghost.x + delta.dx;
          const ny = ghost.y + delta.dy;
          const wrappedX = nx < 0 ? COLS - 1 : nx >= COLS ? 0 : nx;
          const dist = Math.abs(wrappedX - this._playerX) + Math.abs(ny - this._playerY);
          if (dist < bestDist) {
            bestDist = dist;
            bestDir = dir;
          }
        }
        ghost.dir = bestDir;
      }

      // Move
      const delta = DIR_DELTA[ghost.dir];
      let nx = ghost.x + delta.dx;
      let ny = ghost.y + delta.dy;
      if (nx < 0) nx = COLS - 1;
      else if (nx >= COLS) nx = 0;

      if (this.isWalkable(nx, ny)) {
        ghost.x = nx;
        ghost.y = ny;
      }
    }
  }

  private oppositeDir(dir: number): number {
    switch (dir) {
      case DIR_UP: return DIR_DOWN;
      case DIR_DOWN: return DIR_UP;
      case DIR_LEFT: return DIR_RIGHT;
      case DIR_RIGHT: return DIR_LEFT;
      default: return DIR_NONE;
    }
  }

  private checkCollisions(): void {
    for (const ghost of this._ghosts) {
      if (ghost.eaten) continue;
      if (ghost.x === this._playerX && ghost.y === this._playerY) {
        if (ghost.frightened) {
          // Eat ghost
          ghost.eaten = true;
          this._ghostsEatenCombo++;
          const bonus = GHOST_SCORE * Math.pow(GHOST_SCORE_MULTIPLIER, this._ghostsEatenCombo - 1);
          this.addScore(bonus);
          this.emit('eatGhost', { x: ghost.x, y: ghost.y, score: bonus });
        } else {
          // Player dies
          this._lives--;
          this.emit('loseLife', this._lives);
          if (this._lives <= 0) {
            this.gameOver();
          } else {
            this.initPlayer();
            this.initGhosts();
          }
        }
      }
    }
  }

  private nextLevel(): void {
    this._level++;
    this.setLevel(this._level);
    this.initMaze();
    this.initPlayer();
    this.initGhosts();
    this._frightenedTimer = 0;
    this._ghostsEatenCombo = 0;
    this.emit('levelChange', this._level);
  }
}
