import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  SHIP_WIDTH, SHIP_HEIGHT, SHIP_SPEED, SHIP_Y, SHIP_COLOR,
  BULLET_WIDTH, BULLET_HEIGHT, BULLET_SPEED, BULLET_COLOR, MAX_BULLETS,
  ALIEN_WIDTH, ALIEN_HEIGHT, ALIEN_PADDING,
  ALIEN_ROWS, ALIEN_COLS, ALIEN_SPEED_BASE, ALIEN_SPEED_INCREASE,
  ALIEN_DROP, ALIEN_SHOOT_CHANCE, ALIEN_COLORS, ALIEN_SCORES,
  BUNKER_COUNT, BUNKER_WIDTH, BUNKER_HEIGHT, BUNKER_BLOCK_SIZE, BUNKER_Y, BUNKER_COLOR,
  INITIAL_LIVES, BG_COLOR, HUD_COLOR,
} from './constants';

interface Bullet {
  x: number;
  y: number;
  dy: number;
  isAlien: boolean;
  alive: boolean;
}

interface Alien {
  x: number;
  y: number;
  row: number;
  col: number;
  alive: boolean;
  color: string;
  score: number;
}

interface BunkerBlock {
  x: number;
  y: number;
  alive: boolean;
}

export class SpaceInvadersEngine extends GameEngine {
  private _shipX: number = 0;
  private _lives: number = INITIAL_LIVES;
  private _aliens: Alien[] = [];
  private _bullets: Bullet[] = [];
  private _bunkers: BunkerBlock[][] = [];
  private _alienDir: number = 1; // 1=right, -1=left
  private _alienSpeed: number = ALIEN_SPEED_BASE;
  private _aliensAlive: number = 0;
  private _totalAliens: number = 0;
  private _keys: Set<string> = new Set();
  private _shootCooldown: number = 0;

  get shipX(): number { return this._shipX; }
  get lives(): number { return this._lives; }
  get aliens(): Alien[] { return this._aliens; }
  get bullets(): Bullet[] { return this._bullets; }
  get aliensAlive(): number { return this._aliensAlive; }
  get alienDir(): number { return this._alienDir; }

  protected onInit(): void {
    this._shipX = (CANVAS_WIDTH - SHIP_WIDTH) / 2;
    this._lives = INITIAL_LIVES;
    this._aliens = this.createAliens();
    this._bullets = [];
    this._bunkers = this.createBunkers();
    this._alienDir = 1;
    this._alienSpeed = ALIEN_SPEED_BASE;
    this._aliensAlive = ALIEN_ROWS * ALIEN_COLS;
    this._totalAliens = ALIEN_ROWS * ALIEN_COLS;
    this._keys.clear();
    this._shootCooldown = 0;
  }

  protected onStart(): void {
    this.onInit();
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000;

    // Ship movement
    if (this._keys.has('ArrowLeft') || this._keys.has('a')) {
      this._shipX = Math.max(0, this._shipX - SHIP_SPEED * dt);
    }
    if (this._keys.has('ArrowRight') || this._keys.has('d')) {
      this._shipX = Math.min(CANVAS_WIDTH - SHIP_WIDTH, this._shipX + SHIP_SPEED * dt);
    }

    // Shoot cooldown
    if (this._shootCooldown > 0) this._shootCooldown -= deltaTime;

    // Move bullets
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      bullet.y += bullet.dy * dt;
      // Out of bounds
      if (bullet.y < HUD_HEIGHT || bullet.y > CANVAS_HEIGHT) {
        bullet.alive = false;
      }
    }

    // Move aliens
    let shouldDrop = false;
    for (const alien of this._aliens) {
      if (!alien.alive) continue;
      alien.x += this._alienDir * this._alienSpeed * dt;
      if (alien.x <= 0 || alien.x + ALIEN_WIDTH >= CANVAS_WIDTH) {
        shouldDrop = true;
      }
    }
    if (shouldDrop) {
      this._alienDir = -this._alienDir;
      for (const alien of this._aliens) {
        alien.y += ALIEN_DROP;
      }
    }

    // Alien shooting
    const aliveAliens = this._aliens.filter(a => a.alive);
    for (const alien of aliveAliens) {
      if (Math.random() < ALIEN_SHOOT_CHANCE) {
        this._bullets.push({
          x: alien.x + ALIEN_WIDTH / 2,
          y: alien.y + ALIEN_HEIGHT,
          dy: BULLET_SPEED * 0.7,
          isAlien: true,
          alive: true,
        });
      }
    }

    // Bullet-alien collisions
    for (const bullet of this._bullets) {
      if (!bullet.alive || bullet.isAlien) continue;
      for (const alien of this._aliens) {
        if (!alien.alive) continue;
        if (this.rectCollision(
          bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT,
          alien.x, alien.y, ALIEN_WIDTH, ALIEN_HEIGHT
        )) {
          bullet.alive = false;
          alien.alive = false;
          this._aliensAlive--;
          this.addScore(alien.score);
          this._alienSpeed = ALIEN_SPEED_BASE + (this._totalAliens - this._aliensAlive) * ALIEN_SPEED_INCREASE;
          break;
        }
      }
    }

    // Bullet-ship collisions
    for (const bullet of this._bullets) {
      if (!bullet.alive || !bullet.isAlien) continue;
      if (this.rectCollision(
        bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT,
        this._shipX, SHIP_Y, SHIP_WIDTH, SHIP_HEIGHT
      )) {
        bullet.alive = false;
        this._lives--;
        this.emit('loseLife', this._lives);
        if (this._lives <= 0) {
          this.gameOver();
          return;
        }
      }
    }

    // Bullet-bunker collisions
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      for (const bunker of this._bunkers) {
        for (const block of bunker) {
          if (!block.alive) continue;
          if (this.rectCollision(
            bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT,
            block.x, block.y, BUNKER_BLOCK_SIZE, BUNKER_BLOCK_SIZE
          )) {
            bullet.alive = false;
            block.alive = false;
            break;
          }
        }
        if (!bullet.alive) break;
      }
    }

    // Clean up dead bullets
    this._bullets = this._bullets.filter(b => b.alive);

    // Check aliens reached bottom
    for (const alien of this._aliens) {
      if (alien.alive && alien.y + ALIEN_HEIGHT >= SHIP_Y) {
        this.gameOver();
        return;
      }
    }

    // Check win
    if (this._aliensAlive <= 0) {
      this.nextLevel();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD
    ctx.fillStyle = HUD_COLOR;
    ctx.font = '14px monospace';
    ctx.fillText(`Score: ${this._score}`, 10, 25);
    ctx.fillText(`Level: ${this._level}`, 200, 25);
    ctx.fillText(`Lives: ${this._lives}`, 400, 25);

    // Bunkers
    ctx.fillStyle = BUNKER_COLOR;
    for (const bunker of this._bunkers) {
      for (const block of bunker) {
        if (!block.alive) continue;
        ctx.fillRect(block.x, block.y, BUNKER_BLOCK_SIZE, BUNKER_BLOCK_SIZE);
      }
    }

    // Aliens
    for (const alien of this._aliens) {
      if (!alien.alive) continue;
      ctx.fillStyle = alien.color;
      ctx.fillRect(alien.x, alien.y, ALIEN_WIDTH, ALIEN_HEIGHT);
    }

    // Ship
    ctx.fillStyle = SHIP_COLOR;
    ctx.fillRect(this._shipX, SHIP_Y, SHIP_WIDTH, SHIP_HEIGHT);

    // Bullets
    ctx.fillStyle = BULLET_COLOR;
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      ctx.fillStyle = bullet.isAlien ? '#ef4444' : BULLET_COLOR;
      ctx.fillRect(bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT);
    }
  }

  protected onReset(): void { this.onInit(); }
  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    this._keys.add(key);
    if (key === ' ' && this._shootCooldown <= 0) {
      this.shoot();
    }
  }

  handleKeyUp(key: string): void {
    this._keys.delete(key);
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score, level: this._level, lives: this._lives,
      shipX: this._shipX, aliensAlive: this._aliensAlive,
      totalAliens: this._totalAliens, alienSpeed: this._alienSpeed,
    };
  }

  // ========== Private ==========

  private createAliens(): Alien[] {
    const aliens: Alien[] = [];
    const totalW = ALIEN_COLS * (ALIEN_WIDTH + ALIEN_PADDING) - ALIEN_PADDING;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    for (let r = 0; r < ALIEN_ROWS; r++) {
      for (let c = 0; c < ALIEN_COLS; c++) {
        aliens.push({
          x: startX + c * (ALIEN_WIDTH + ALIEN_PADDING),
          y: HUD_HEIGHT + 20 + r * (ALIEN_HEIGHT + ALIEN_PADDING),
          row: r, col: c, alive: true,
          color: ALIEN_COLORS[r],
          score: ALIEN_SCORES[r],
        });
      }
    }
    return aliens;
  }

  private createBunkers(): BunkerBlock[][] {
    const bunkers: BunkerBlock[][] = [];
    const spacing = CANVAS_WIDTH / (BUNKER_COUNT + 1);
    for (let i = 0; i < BUNKER_COUNT; i++) {
      const bx = spacing * (i + 1) - BUNKER_WIDTH / 2;
      const blocks: BunkerBlock[] = [];
      const cols = BUNKER_WIDTH / BUNKER_BLOCK_SIZE;
      const rows = BUNKER_HEIGHT / BUNKER_BLOCK_SIZE;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          blocks.push({
            x: bx + c * BUNKER_BLOCK_SIZE,
            y: BUNKER_Y + r * BUNKER_BLOCK_SIZE,
            alive: true,
          });
        }
      }
      bunkers.push(blocks);
    }
    return bunkers;
  }

  private shoot(): void {
    const playerBullets = this._bullets.filter(b => !b.isAlien && b.alive);
    if (playerBullets.length >= MAX_BULLETS) return;
    this._bullets.push({
      x: this._shipX + SHIP_WIDTH / 2 - BULLET_WIDTH / 2,
      y: SHIP_Y - BULLET_HEIGHT,
      dy: -BULLET_SPEED,
      isAlien: false,
      alive: true,
    });
    this._shootCooldown = 200; // ms
  }

  private rectCollision(
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number
  ): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  private nextLevel(): void {
    this._level++;
    this.setLevel(this._level);
    this._aliens = this.createAliens();
    this._bullets = [];
    this._bunkers = this.createBunkers();
    this._alienDir = 1;
    this._alienSpeed = ALIEN_SPEED_BASE + this._level * 10;
    this._aliensAlive = ALIEN_ROWS * ALIEN_COLS;
    this._totalAliens = ALIEN_ROWS * ALIEN_COLS;
    this.emit('levelChange', this._level);
  }
}
