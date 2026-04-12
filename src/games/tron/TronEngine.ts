import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  GRID_SIZE,
  GRID_COLS,
  GRID_ROWS,
  INITIAL_SPEED,
  SPEED_INCREASE,
  MIN_SPEED,
  SPEED_SCORE_INTERVAL,
  PLAYER_COLORS,
  TRAIL_COLORS,
  HEAD_COLORS,
  GRID_BG_COLOR,
  GRID_LINE_COLOR,
  Direction,
  OPPOSITE,
  DIR_DELTA,
} from './constants';

interface Player {
  row: number;
  col: number;
  direction: Direction;
  trail: { row: number; col: number }[];
  alive: boolean;
  score: number;
}

interface GridCell {
  occupied: boolean;
  playerIndex: number; // -1 if empty
}

export class TronEngine extends GameEngine {
  private players: Player[] = [];
  private grid: GridCell[][] = [];
  private speed: number = INITIAL_SPEED;
  private moveTimer: number = 0;
  private aiEnabled: boolean = false;
  private roundOver: boolean = false;
  private winner: number = -1; // -1=none, 0=P1, 1=P2, 2=draw
  private gridOffsetY: number = HUD_HEIGHT;

  constructor() {
    super();
  }

  // ========== 公开属性 ==========

  get playerCount(): number {
    return this.players.length;
  }

  get isAIEnabled(): boolean {
    return this.aiEnabled;
  }

  get roundWinner(): number {
    return this.winner;
  }

  getPlayer(index: number): Player {
    return this.players[index];
  }

  isPlayerAlive(index: number): boolean {
    return this.players[index]?.alive ?? false;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.aiEnabled = false;
    this.initGrid();
    this.initPlayers();
  }

  protected onStart(): void {
    this.speed = INITIAL_SPEED;
    this.moveTimer = 0;
    this.roundOver = false;
    this.winner = -1;
    this.initGrid();
    this.initPlayers();
  }

  protected update(deltaTime: number): void {
    if (this.roundOver) return;

    this.moveTimer += deltaTime;
    if (this.moveTimer >= this.speed) {
      this.moveTimer -= this.speed;

      // AI move
      if (this.aiEnabled && this.players[1].alive) {
        this.aiMove(1);
      }

      this.movePlayers();
      this.checkCollisions();

      if (this.roundOver) {
        this.finishRound();
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = GRID_BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * GRID_SIZE, HUD_HEIGHT);
      ctx.lineTo(c * GRID_SIZE, HUD_HEIGHT + GRID_ROWS * GRID_SIZE);
      ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, HUD_HEIGHT + r * GRID_SIZE);
      ctx.lineTo(GRID_COLS * GRID_SIZE, HUD_HEIGHT + r * GRID_SIZE);
      ctx.stroke();
    }

    // 轨迹
    for (let pi = 0; pi < this.players.length; pi++) {
      const player = this.players[pi];
      ctx.fillStyle = TRAIL_COLORS[pi];
      for (const cell of player.trail) {
        ctx.fillRect(
          cell.col * GRID_SIZE,
          HUD_HEIGHT + cell.row * GRID_SIZE,
          GRID_SIZE,
          GRID_SIZE
        );
      }

      // 头部
      if (player.alive) {
        ctx.fillStyle = HEAD_COLORS[pi];
        ctx.fillRect(
          player.col * GRID_SIZE,
          HUD_HEIGHT + player.row * GRID_SIZE,
          GRID_SIZE,
          GRID_SIZE
        );
      }
    }

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`P1: ${this.players[0]?.score ?? 0}`, 10, 20);
    ctx.textAlign = 'center';
    ctx.fillText(`Speed: ${this.speed}ms`, w / 2, 20);
    ctx.textAlign = 'right';
    ctx.fillText(`P2: ${this.players[1]?.score ?? 0}${this.aiEnabled ? ' (AI)' : ''}`, w - 10, 20);

    // 游戏状态
    if (this._status === 'idle') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('按空格开始', w / 2, h / 2 - 20);
      ctx.font = '14px monospace';
      ctx.fillText('P1: WASD | P2: 方向键', w / 2, h / 2 + 10);
    }

    if (this.roundOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      if (this.winner === 2) {
        ctx.fillText('平局！', w / 2, h / 2 - 10);
      } else {
        ctx.fillText(`P${this.winner + 1} 获胜！`, w / 2, h / 2 - 10);
      }
      ctx.font = '14px monospace';
      ctx.fillText('按 R 重来', w / 2, h / 2 + 20);
    }
  }

  protected onReset(): void {
    this.initGrid();
    this.initPlayers();
    this.speed = INITIAL_SPEED;
    this.moveTimer = 0;
    this.roundOver = false;
    this.winner = -1;
  }

  protected onGameOver(): void {
    // Game over handled per round
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (key === ' ' && this._status === 'idle') {
      // Space starts game - handled by start() externally
      return;
    }

    if (key === 'r' || key === 'R') {
      if (this.roundOver) {
        this.reset();
        return;
      }
    }

    if (this._status !== 'playing' || this.roundOver) return;

    // Player 1: WASD
    const p1 = this.players[0];
    if (p1.alive) {
      switch (key.toLowerCase()) {
        case 'w':
          if (p1.direction !== OPPOSITE[Direction.UP]) p1.direction = Direction.UP;
          break;
        case 's':
          if (p1.direction !== OPPOSITE[Direction.DOWN]) p1.direction = Direction.DOWN;
          break;
        case 'a':
          if (p1.direction !== OPPOSITE[Direction.LEFT]) p1.direction = Direction.LEFT;
          break;
        case 'd':
          if (p1.direction !== OPPOSITE[Direction.RIGHT]) p1.direction = Direction.RIGHT;
          break;
      }
    }

    // Player 2: Arrow keys (only if not AI)
    if (!this.aiEnabled) {
      const p2 = this.players[1];
      if (p2.alive) {
        switch (key) {
          case 'ArrowUp':
            if (p2.direction !== OPPOSITE[Direction.UP]) p2.direction = Direction.UP;
            break;
          case 'ArrowDown':
            if (p2.direction !== OPPOSITE[Direction.DOWN]) p2.direction = Direction.DOWN;
            break;
          case 'ArrowLeft':
            if (p2.direction !== OPPOSITE[Direction.LEFT]) p2.direction = Direction.LEFT;
            break;
          case 'ArrowRight':
            if (p2.direction !== OPPOSITE[Direction.RIGHT]) p2.direction = Direction.RIGHT;
            break;
        }
      }
    }
  }

  handleKeyUp(_key: string): void {
    // No action needed
  }

  getState(): Record<string, unknown> {
    return {
      players: this.players.map(p => ({
        row: p.row,
        col: p.col,
        direction: p.direction,
        trail: [...p.trail],
        alive: p.alive,
        score: p.score,
      })),
      speed: this.speed,
      roundOver: this.roundOver,
      winner: this.winner,
      aiEnabled: this.aiEnabled,
    };
  }

  // ========== AI ==========

  setAI(enabled: boolean): void {
    this.aiEnabled = enabled;
  }

  private aiMove(playerIndex: number): void {
    const player = this.players[playerIndex];
    if (!player.alive) return;

    const currentDir = player.direction;
    const opposite = OPPOSITE[currentDir];

    // Evaluate each possible direction
    const directions = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]
      .filter(d => d !== opposite); // Can't reverse

    let bestDir = currentDir;
    let bestScore = -Infinity;

    for (const dir of directions) {
      const delta = DIR_DELTA[dir];
      const nextRow = player.row + delta.dr;
      const nextCol = player.col + delta.dc;

      // Check if this direction is safe
      if (!this.isInBounds(nextRow, nextCol) || this.grid[nextRow][nextCol].occupied) {
        // Unsafe — skip unless all directions are unsafe
        continue;
      }

      // Score: prefer center, prefer longer survival
      let score = 0;

      // Prefer center of grid
      const centerRow = GRID_ROWS / 2;
      const centerCol = GRID_COLS / 2;
      const distToCenter = Math.abs(nextRow - centerRow) + Math.abs(nextCol - centerCol);
      score -= distToCenter * 0.1;

      // Prefer directions with more open space (look ahead)
      let openCells = 0;
      for (let look = 1; look <= 5; look++) {
        const lookRow = player.row + delta.dr * look;
        const lookCol = player.col + delta.dc * look;
        if (this.isInBounds(lookRow, lookCol) && !this.grid[lookRow][lookCol].occupied) {
          openCells++;
        }
      }
      score += openCells * 2;

      // Slight preference for current direction (stability)
      if (dir === currentDir) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }

    player.direction = bestDir;
  }

  // ========== 核心逻辑 ==========

  private initGrid(): void {
    this.grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        this.grid[r][c] = { occupied: false, playerIndex: -1 };
      }
    }
  }

  private initPlayers(): void {
    // P1: top-left area, facing right
    // P2: bottom-right area, facing left
    const p1StartRow = Math.floor(GRID_ROWS * 0.25);
    const p1StartCol = Math.floor(GRID_COLS * 0.25);
    const p2StartRow = Math.floor(GRID_ROWS * 0.75);
    const p2StartCol = Math.floor(GRID_COLS * 0.75);

    this.players = [
      {
        row: p1StartRow,
        col: p1StartCol,
        direction: Direction.RIGHT,
        trail: [{ row: p1StartRow, col: p1StartCol }],
        alive: true,
        score: 0,
      },
      {
        row: p2StartRow,
        col: p2StartCol,
        direction: Direction.LEFT,
        trail: [{ row: p2StartRow, col: p2StartCol }],
        alive: true,
        score: 0,
      },
    ];

    // Mark starting positions on grid
    this.grid[p1StartRow][p1StartCol] = { occupied: true, playerIndex: 0 };
    this.grid[p2StartRow][p2StartCol] = { occupied: true, playerIndex: 1 };
  }

  private movePlayers(): void {
    for (let pi = 0; pi < this.players.length; pi++) {
      const player = this.players[pi];
      if (!player.alive) continue;

      const delta = DIR_DELTA[player.direction];
      player.row += delta.dr;
      player.col += delta.dc;
    }
  }

  private checkCollisions(): void {
    let p1Dead = false;
    let p2Dead = false;

    for (let pi = 0; pi < this.players.length; pi++) {
      const player = this.players[pi];
      if (!player.alive) continue;

      // Wall collision
      if (!this.isInBounds(player.row, player.col)) {
        player.alive = false;
        if (pi === 0) p1Dead = true;
        else p2Dead = true;
        continue;
      }

      // Trail collision (check if cell is already occupied)
      if (this.grid[player.row][player.col].occupied) {
        player.alive = false;
        if (pi === 0) p1Dead = true;
        else p2Dead = true;
        continue;
      }

      // Check if both players moved to the same cell
      const other = this.players[1 - pi];
      if (other.alive && player.row === other.row && player.col === other.col) {
        player.alive = false;
        if (pi === 0) p1Dead = true;
        else p2Dead = true;
      }
    }

    // If any player died, round is over
    if (p1Dead || p2Dead) {
      this.roundOver = true;

      if (p1Dead && p2Dead) {
        this.winner = 2; // Draw
      } else if (p1Dead) {
        this.winner = 1; // P2 wins
      } else {
        this.winner = 0; // P1 wins
      }
    } else {
      // Mark new positions on grid and add to trail
      for (let pi = 0; pi < this.players.length; pi++) {
        const player = this.players[pi];
        if (!player.alive) continue;

        this.grid[player.row][player.col] = { occupied: true, playerIndex: pi };
        player.trail.push({ row: player.row, col: player.col });
      }
    }
  }

  private finishRound(): void {
    // Calculate scores
    for (let pi = 0; pi < this.players.length; pi++) {
      const player = this.players[pi];
      // Score = trail length
      player.score = player.trail.length;

      // Winner bonus
      if (this.winner === pi) {
        player.score += 10;
      }
    }

    // Update engine score (sum of both players for leaderboard)
    const totalScore = this.players.reduce((sum, p) => sum + p.score, 0);
    this._score = totalScore;
    this.emit('scoreChange', this._score);

    // End game
    this.gameOver();
  }

  private isInBounds(row: number, col: number): boolean {
    return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS;
  }

  // ========== 测试辅助 ==========

  /** 获取网格（测试用） */
  getGrid(): GridCell[][] {
    return this.grid;
  }

  /** 获取速度（测试用） */
  getSpeed(): number {
    return this.speed;
  }
}
