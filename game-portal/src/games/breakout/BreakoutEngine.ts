import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_Y, PADDLE_SPEED, PADDLE_COLOR,
  BALL_RADIUS, BALL_SPEED, BALL_SPEED_INCREASE, BALL_MAX_SPEED, BALL_COLOR,
  BRICK_ROWS, BRICK_COLS, BRICK_WIDTH, BRICK_HEIGHT, BRICK_PADDING,
  BRICK_OFFSET_TOP, BRICK_OFFSET_LEFT, BRICK_COLORS, BRICK_SCORES,
  INITIAL_LIVES, BG_COLOR, HUD_COLOR,
} from './constants';

export interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
}

export interface Brick {
  x: number;
  y: number;
  row: number;
  col: number;
  alive: boolean;
  color: string;
  score: number;
}

export class BreakoutEngine extends GameEngine {
  private _paddleX: number = 0;
  private _ball: Ball | null = null;
  private _bricks: Brick[] = [];
  private _lives: number = INITIAL_LIVES;
  private _ballLaunched: boolean = false;
  private _leftPressed: boolean = false;
  private _rightPressed: boolean = false;
  private _totalBricks: number = 0;
  private _remainingBricks: number = 0;

  constructor() {
    super();
  }

  // ========== Public Getters ==========
  get paddleX(): number { return this._paddleX; }
  get ball(): Ball | null { return this._ball; }
  get bricks(): Brick[] { return this._bricks; }
  get lives(): number { return this._lives; }
  get ballLaunched(): boolean { return this._ballLaunched; }
  get remainingBricks(): number { return this._remainingBricks; }
  get totalBricks(): number { return this._totalBricks; }

  // ========== GameEngine Abstract Methods ==========
  protected onInit(): void {
    this.resetPaddle();
    this.resetBall();
    this.buildBricks();
  }

  protected onStart(): void {
    this._lives = INITIAL_LIVES;
    this._ballLaunched = false;
    this._leftPressed = false;
    this._rightPressed = false;
    this.resetPaddle();
    this.resetBall();
    this.buildBricks();
  }

  protected update(_deltaTime: number): void {
    if (!this._ballLaunched || !this._ball) return;

    // 移动挡板
    if (this._leftPressed) {
      this._paddleX = Math.max(0, this._paddleX - PADDLE_SPEED);
    }
    if (this._rightPressed) {
      this._paddleX = Math.min(CANVAS_WIDTH - PADDLE_WIDTH, this._paddleX + PADDLE_SPEED);
    }

    // 移动弹球
    const ball = this._ball;
    ball.x += ball.dx;
    ball.y += ball.dy;

    // 左右墙壁碰撞
    if (ball.x - BALL_RADIUS <= 0) {
      ball.x = BALL_RADIUS;
      ball.dx = Math.abs(ball.dx);
    }
    if (ball.x + BALL_RADIUS >= CANVAS_WIDTH) {
      ball.x = CANVAS_WIDTH - BALL_RADIUS;
      ball.dx = -Math.abs(ball.dx);
    }
    // 顶部碰撞
    if (ball.y - BALL_RADIUS <= HUD_HEIGHT) {
      ball.y = HUD_HEIGHT + BALL_RADIUS;
      ball.dy = Math.abs(ball.dy);
    }

    // 挡板碰撞
    if (
      ball.dy > 0 &&
      ball.y + BALL_RADIUS >= PADDLE_Y &&
      ball.y + BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT + ball.speed &&
      ball.x >= this._paddleX &&
      ball.x <= this._paddleX + PADDLE_WIDTH
    ) {
      ball.y = PADDLE_Y - BALL_RADIUS;
      const hitPos = (ball.x - this._paddleX) / PADDLE_WIDTH;
      const angle = (hitPos - 0.5) * Math.PI * 0.7;
      ball.dx = ball.speed * Math.sin(angle);
      ball.dy = -ball.speed * Math.cos(angle);
    }

    // 砖块碰撞
    for (const brick of this._bricks) {
      if (!brick.alive) continue;
      if (this.ballBrickCollision(ball, brick)) {
        brick.alive = false;
        this._remainingBricks--;
        this.addScore(brick.score);

        const brickCX = brick.x + BRICK_WIDTH / 2;
        const brickCY = brick.y + BRICK_HEIGHT / 2;
        const dx = ball.x - brickCX;
        const dy = ball.y - brickCY;
        if (Math.abs(dx / BRICK_WIDTH) > Math.abs(dy / BRICK_HEIGHT)) {
          ball.dx = -ball.dx;
        } else {
          ball.dy = -ball.dy;
        }
        break;
      }
    }

    // 球落底
    if (ball.y + BALL_RADIUS > CANVAS_HEIGHT) {
      this._lives--;
      if (this._lives <= 0) {
        this.gameOver();
      } else {
        this._ballLaunched = false;
        this.resetBall();
        this.resetPaddle();
        this.emit('statusChange', 'playing');
      }
    }

    // 过关检测
    if (this._remainingBricks <= 0) {
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

    // 砖块
    for (const brick of this._bricks) {
      if (!brick.alive) continue;
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, BRICK_WIDTH, BRICK_HEIGHT);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(brick.x, brick.y, BRICK_WIDTH, BRICK_HEIGHT);
    }

    // 挡板
    ctx.fillStyle = PADDLE_COLOR;
    ctx.fillRect(this._paddleX, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT);

    // 弹球
    if (this._ball) {
      ctx.fillStyle = BALL_COLOR;
      ctx.beginPath();
      ctx.arc(this._ball.x, this._ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  protected onReset(): void {
    this._lives = INITIAL_LIVES;
    this._ballLaunched = false;
    this._leftPressed = false;
    this._rightPressed = false;
    this.resetPaddle();
    this.resetBall();
    this.buildBricks();
  }

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') this._leftPressed = true;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') this._rightPressed = true;
    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'playing' && !this._ballLaunched) {
        this.launchBall();
      }
    }
  }

  handleKeyUp(key: string): void {
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') this._leftPressed = false;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') this._rightPressed = false;
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      lives: this._lives,
      paddleX: this._paddleX,
      ballLaunched: this._ballLaunched,
      remainingBricks: this._remainingBricks,
      totalBricks: this._totalBricks,
    };
  }

  // ========== Public Methods ==========
  launchBall(): void {
    if (this._ball && !this._ballLaunched) {
      const angle = (Math.random() - 0.5) * Math.PI * 0.5;
      this._ball.dx = this._ball.speed * Math.sin(angle);
      this._ball.dy = -this._ball.speed * Math.cos(angle);
      this._ballLaunched = true;
    }
  }

  // ========== Private Methods ==========
  private resetPaddle(): void {
    this._paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2;
  }

  private resetBall(): void {
    const speed = BALL_SPEED + (this._level - 1) * BALL_SPEED_INCREASE;
    this._ball = {
      x: this._paddleX + PADDLE_WIDTH / 2,
      y: PADDLE_Y - BALL_RADIUS - 1,
      dx: 0,
      dy: 0,
      speed: Math.min(speed, BALL_MAX_SPEED),
    };
  }

  private buildBricks(): void {
    this._bricks = [];
    const rows = BRICK_ROWS + Math.floor((this._level - 1) / 2);
    const maxRows = Math.min(rows, 8);
    for (let r = 0; r < maxRows; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        this._bricks.push({
          x: BRICK_OFFSET_LEFT + c * (BRICK_WIDTH + BRICK_PADDING),
          y: BRICK_OFFSET_TOP + r * (BRICK_HEIGHT + BRICK_PADDING),
          row: r,
          col: c,
          alive: true,
          color: BRICK_COLORS[r % BRICK_COLORS.length],
          score: BRICK_SCORES[r % BRICK_SCORES.length],
        });
      }
    }
    this._totalBricks = this._bricks.length;
    this._remainingBricks = this._bricks.length;
  }

  private ballBrickCollision(ball: Ball, brick: Brick): boolean {
    const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + BRICK_WIDTH));
    const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + BRICK_HEIGHT));
    const distX = ball.x - closestX;
    const distY = ball.y - closestY;
    return (distX * distX + distY * distY) <= (BALL_RADIUS * BALL_RADIUS);
  }

  private nextLevel(): void {
    this._level++;
    this.setLevel(this._level);
    this._ballLaunched = false;
    this.resetPaddle();
    this.resetBall();
    this.buildBricks();
    this.emit('levelChange', this._level);
  }
}
