import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_SPEED, PADDLE_COLOR,
  LEFT_PADDLE_X, RIGHT_PADDLE_X, PADDLE_START_Y,
  BALL_RADIUS, BALL_INITIAL_SPEED, BALL_MAX_SPEED, BALL_SPEED_INCREMENT, BALL_COLOR,
  WIN_SCORE, AI_BASE_SPEED, AI_SPEED_PER_LEVEL, AI_TRACKING_ERROR,
  BG_COLOR, HUD_COLOR, NET_COLOR, SERVE_DELAY,
} from './constants';

interface BallState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
}

export class PongEngine extends GameEngine {
  // 挡板位置
  private _leftPaddleY: number = PADDLE_START_Y;
  private _rightPaddleY: number = PADDLE_START_Y;

  // 球
  private _ball: BallState | null = null;

  // 分数
  private _playerScore: number = 0;
  private _aiScore: number = 0;

  // 输入状态
  private _upPressed: boolean = false;
  private _downPressed: boolean = false;

  // AI
  private _aiTargetY: number = PADDLE_START_Y;
  private _aiReactionTimer: number = 0;

  // 发球
  private _serving: boolean = true;
  private _serveTimer: number = 0;

  // 胜利
  private _isWin: boolean = false;

  // ========== Public Getters ==========

  get playerScore(): number { return this._playerScore; }
  get aiScore(): number { return this._aiScore; }
  get isWin(): boolean { return this._isWin; }
  get ballX(): number { return this._ball?.x ?? 0; }
  get ballY(): number { return this._ball?.y ?? 0; }
  get leftPaddleY(): number { return this._leftPaddleY; }
  get rightPaddleY(): number { return this._rightPaddleY; }
  get serving(): boolean { return this._serving; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._leftPaddleY = PADDLE_START_Y;
    this._rightPaddleY = PADDLE_START_Y;
    this._ball = null;
  }

  protected onStart(): void {
    this._playerScore = 0;
    this._aiScore = 0;
    this._upPressed = false;
    this._downPressed = false;
    this._isWin = false;
    this._leftPaddleY = PADDLE_START_Y;
    this._rightPaddleY = PADDLE_START_Y;
    this._aiTargetY = PADDLE_START_Y;
    this._aiReactionTimer = 0;
    this.resetServe();
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000; // 转秒

    if (this._serving) {
      this._serveTimer -= deltaTime;
      if (this._serveTimer <= 0) {
        this._serving = false;
        this.launchBall();
      }
      return;
    }

    if (!this._ball) return;

    // 玩家挡板移动
    this.movePlayerPaddle();

    // AI 挡板移动
    this.moveAIPaddle(dt);

    // 移动球
    this.moveBall();

    // 碰撞检测
    this.checkWallCollision();
    this.checkPaddleCollision();
    this.checkScoring();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this._playerScore}`, w / 2 - 60, 28);
    ctx.fillText(':', w / 2, 28);
    ctx.fillText(`${this._aiScore}`, w / 2 + 60, 28);
    ctx.textAlign = 'left';

    // 中线
    ctx.strokeStyle = NET_COLOR;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(w / 2, HUD_HEIGHT);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // 左挡板（玩家）
    ctx.fillStyle = PADDLE_COLOR;
    ctx.fillRect(LEFT_PADDLE_X, this._leftPaddleY, PADDLE_WIDTH, PADDLE_HEIGHT);

    // 右挡板（AI）
    ctx.fillStyle = '#ef5350';
    ctx.fillRect(RIGHT_PADDLE_X, this._rightPaddleY, PADDLE_WIDTH, PADDLE_HEIGHT);

    // 球
    if (this._ball) {
      ctx.fillStyle = BALL_COLOR;
      ctx.beginPath();
      ctx.arc(this._ball.x, this._ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    // 发球提示
    if (this._serving && this._status === 'playing') {
      ctx.fillStyle = HUD_COLOR;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Ready...', w / 2, h / 2 + 40);
      ctx.textAlign = 'left';
    }

    // 胜利/失败提示
    if (this._status === 'gameover') {
      ctx.fillStyle = this._isWin ? '#66bb6a' : '#ef5350';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this._isWin ? 'YOU WIN!' : 'YOU LOSE', w / 2, h / 2);
      ctx.font = '16px monospace';
      ctx.fillStyle = HUD_COLOR;
      ctx.fillText(`${this._playerScore} : ${this._aiScore}`, w / 2, h / 2 + 40);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this._playerScore = 0;
    this._aiScore = 0;
    this._upPressed = false;
    this._downPressed = false;
    this._isWin = false;
    this._leftPaddleY = PADDLE_START_Y;
    this._rightPaddleY = PADDLE_START_Y;
    this._ball = null;
    this._serving = true;
    this._serveTimer = 0;
    this._aiTargetY = PADDLE_START_Y;
    this._aiReactionTimer = 0;
  }

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') this._upPressed = true;
    if (key === 'ArrowDown' || key === 's' || key === 'S') this._downPressed = true;
    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      }
    }
  }

  handleKeyUp(key: string): void {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') this._upPressed = false;
    if (key === 'ArrowDown' || key === 's' || key === 'S') this._downPressed = false;
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      playerScore: this._playerScore,
      aiScore: this._aiScore,
      ballX: this.ballX,
      ballY: this.ballY,
      leftPaddleY: this._leftPaddleY,
      rightPaddleY: this._rightPaddleY,
      serving: this._serving,
      isWin: this._isWin,
    };
  }

  // ========== Private Methods ==========

  private resetServe(): void {
    this._serving = true;
    this._serveTimer = SERVE_DELAY;
    this._ball = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: 0,
      dy: 0,
      speed: BALL_INITIAL_SPEED + (this._level - 1) * BALL_SPEED_INCREMENT * 2,
    };
  }

  private launchBall(): void {
    if (!this._ball) return;
    const angle = (Math.random() - 0.5) * Math.PI * 0.5;
    const direction = Math.random() < 0.5 ? 1 : -1;
    this._ball.dx = direction * this._ball.speed * Math.cos(angle);
    this._ball.dy = this._ball.speed * Math.sin(angle);
  }

  private movePlayerPaddle(): void {
    if (this._upPressed) {
      this._leftPaddleY = Math.max(HUD_HEIGHT, this._leftPaddleY - PADDLE_SPEED);
    }
    if (this._downPressed) {
      this._leftPaddleY = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, this._leftPaddleY + PADDLE_SPEED);
    }
  }

  private moveAIPaddle(dt: number): void {
    if (!this._ball) return;

    // AI 反应延迟
    this._aiReactionTimer += dt;
    const reactionDelay = Math.max(0.05, 0.2 - this._level * 0.02);
    if (this._aiReactionTimer >= reactionDelay) {
      this._aiReactionTimer = 0;
      // 计算目标位置（带跟踪误差）
      const errorRange = Math.max(0, AI_TRACKING_ERROR - this._level * 5);
      this._aiTargetY = this._ball.y + (Math.random() - 0.5) * errorRange;
    }

    // AI 移动速度
    const aiSpeed = AI_BASE_SPEED + this._level * AI_SPEED_PER_LEVEL;
    const paddleCenter = this._rightPaddleY + PADDLE_HEIGHT / 2;
    const diff = this._aiTargetY - paddleCenter;

    if (Math.abs(diff) > 2) {
      if (diff > 0) {
        this._rightPaddleY = Math.min(
          CANVAS_HEIGHT - PADDLE_HEIGHT,
          this._rightPaddleY + Math.min(aiSpeed, diff)
        );
      } else {
        this._rightPaddleY = Math.max(
          HUD_HEIGHT,
          this._rightPaddleY + Math.max(-aiSpeed, diff)
        );
      }
    }
  }

  private moveBall(): void {
    if (!this._ball) return;
    this._ball.x += this._ball.dx;
    this._ball.y += this._ball.dy;
  }

  private checkWallCollision(): void {
    if (!this._ball) return;
    const ball = this._ball;

    // 上下墙壁
    if (ball.y - BALL_RADIUS <= HUD_HEIGHT) {
      ball.y = HUD_HEIGHT + BALL_RADIUS;
      ball.dy = Math.abs(ball.dy);
    }
    if (ball.y + BALL_RADIUS >= CANVAS_HEIGHT) {
      ball.y = CANVAS_HEIGHT - BALL_RADIUS;
      ball.dy = -Math.abs(ball.dy);
    }
  }

  private checkPaddleCollision(): void {
    if (!this._ball) return;
    const ball = this._ball;

    // 左挡板碰撞（玩家）
    if (
      ball.dx < 0 &&
      ball.x - BALL_RADIUS <= LEFT_PADDLE_X + PADDLE_WIDTH &&
      ball.x + BALL_RADIUS >= LEFT_PADDLE_X &&
      ball.y >= this._leftPaddleY &&
      ball.y <= this._leftPaddleY + PADDLE_HEIGHT
    ) {
      ball.x = LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS;
      const hitPos = (ball.y - this._leftPaddleY) / PADDLE_HEIGHT;
      const angle = (hitPos - 0.5) * Math.PI * 0.7;
      ball.speed = Math.min(ball.speed + BALL_SPEED_INCREMENT, BALL_MAX_SPEED);
      ball.dx = ball.speed * Math.cos(angle);
      ball.dy = ball.speed * Math.sin(angle);
    }

    // 右挡板碰撞（AI）
    if (
      ball.dx > 0 &&
      ball.x + BALL_RADIUS >= RIGHT_PADDLE_X &&
      ball.x - BALL_RADIUS <= RIGHT_PADDLE_X + PADDLE_WIDTH &&
      ball.y >= this._rightPaddleY &&
      ball.y <= this._rightPaddleY + PADDLE_HEIGHT
    ) {
      ball.x = RIGHT_PADDLE_X - BALL_RADIUS;
      const hitPos = (ball.y - this._rightPaddleY) / PADDLE_HEIGHT;
      const angle = (hitPos - 0.5) * Math.PI * 0.7;
      ball.speed = Math.min(ball.speed + BALL_SPEED_INCREMENT, BALL_MAX_SPEED);
      ball.dx = -ball.speed * Math.cos(angle);
      ball.dy = ball.speed * Math.sin(angle);
    }
  }

  private checkScoring(): void {
    if (!this._ball) return;
    const ball = this._ball;

    // 球出左边界 → AI 得分
    if (ball.x + BALL_RADIUS < 0) {
      this._aiScore++;
      if (this._aiScore >= WIN_SCORE) {
        this._isWin = false;
        this.addScore(this._playerScore);
        this.gameOver();
      } else {
        this.resetServe();
      }
    }

    // 球出右边界 → 玩家得分
    if (ball.x - BALL_RADIUS > CANVAS_WIDTH) {
      this._playerScore++;
      if (this._playerScore >= WIN_SCORE) {
        this._isWin = true;
        this.addScore(this._playerScore);
        this.gameOver();
      } else {
        this.resetServe();
      }
    }
  }
}
