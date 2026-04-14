import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_SPEED,
  PADDLE_COLOR_P1, PADDLE_COLOR_P2,
  LEFT_PADDLE_X, RIGHT_PADDLE_X, PADDLE_START_Y,
  BALL_RADIUS, BALL_INITIAL_SPEED, BALL_MAX_SPEED, BALL_SPEED_INCREMENT, BALL_COLOR,
  WIN_SCORE, LEAD_BY,
  AI_REACTION_DELAY, AI_BASE_SPEED, AI_TRACKING_ERROR,
  BG_COLOR, HUD_COLOR, NET_COLOR, SCORE_COLOR_P1, SCORE_COLOR_P2,
  SERVE_DELAY, MAX_BOUNCE_ANGLE,
} from './constants';

// ========== 球状态 ==========
interface BallState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
}

// ========== 游戏模式 ==========
export type Pong2PMode = '2p' | 'ai';

// ========== 主引擎 ==========
export class Pong2PEngine extends GameEngine {
  // 挡板位置
  private _leftPaddleY: number = PADDLE_START_Y;
  private _rightPaddleY: number = PADDLE_START_Y;

  // 球
  private _ball: BallState | null = null;

  // 分数
  private _p1Score: number = 0;
  private _p2Score: number = 0;

  // 输入状态
  private _p1UpPressed: boolean = false;
  private _p1DownPressed: boolean = false;
  private _p2UpPressed: boolean = false;
  private _p2DownPressed: boolean = false;

  // AI
  private _mode: Pong2PMode = '2p';
  private _aiTargetY: number = PADDLE_START_Y;
  private _aiReactionTimer: number = 0;
  private _aiReady: boolean = false;

  // 发球
  private _serving: boolean = true;
  private _serveTimer: number = 0;
  private _serveDirection: 1 | -1 = 1; // 1=向右, -1=向左

  // 胜利
  private _isWin: boolean = false;
  private _winner: 1 | 2 | null = null;

  // 回合计数（用于球速递增）
  private _rallyCount: number = 0;

  // ========== Public Getters ==========

  get p1Score(): number { return this._p1Score; }
  get p2Score(): number { return this._p2Score; }
  get isWin(): boolean { return this._isWin; }
  get winner(): 1 | 2 | null { return this._winner; }
  get ballX(): number { return this._ball?.x ?? 0; }
  get ballY(): number { return this._ball?.y ?? 0; }
  get ballDx(): number { return this._ball?.dx ?? 0; }
  get ballDy(): number { return this._ball?.dy ?? 0; }
  get ballSpeed(): number { return this._ball?.speed ?? 0; }
  get leftPaddleY(): number { return this._leftPaddleY; }
  get rightPaddleY(): number { return this._rightPaddleY; }
  get serving(): boolean { return this._serving; }
  get mode(): Pong2PMode { return this._mode; }
  get rallyCount(): number { return this._rallyCount; }
  get serveDirection(): 1 | -1 { return this._serveDirection; }

  // ========== 模式设置 ==========

  setMode(mode: Pong2PMode): void {
    this._mode = mode;
  }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._leftPaddleY = PADDLE_START_Y;
    this._rightPaddleY = PADDLE_START_Y;
    this._ball = null;
    this._p1Score = 0;
    this._p2Score = 0;
    this._serving = true;
    this._serveTimer = 0;
    this._serveDirection = 1;
    this._isWin = false;
    this._winner = null;
    this._rallyCount = 0;
    this._p1UpPressed = false;
    this._p1DownPressed = false;
    this._p2UpPressed = false;
    this._p2DownPressed = false;
    this._aiReady = false;
    this._aiReactionTimer = 0;
    this._aiTargetY = PADDLE_START_Y;
  }

  protected onStart(): void {
    this._p1Score = 0;
    this._p2Score = 0;
    this._serving = true;
    this._serveTimer = 0;
    this._serveDirection = 1;
    this._isWin = false;
    this._winner = null;
    this._rallyCount = 0;
    this._leftPaddleY = PADDLE_START_Y;
    this._rightPaddleY = PADDLE_START_Y;
    this._ball = null;
  }

  protected update(deltaTime: number): void {
    if (this._serving) {
      this._serveTimer += deltaTime;
      if (this._serveTimer >= SERVE_DELAY) {
        this.serveBall();
      }
      // 发球期间也可以移动挡板
      this.movePaddles(deltaTime);
      return;
    }

    // 移动挡板
    this.movePaddles(deltaTime);

    // AI 逻辑
    if (this._mode === 'ai') {
      this.updateAI(deltaTime);
    }

    // 移动球
    if (this._ball) {
      this.moveBall();
      this.checkCollisions();
      this.checkScore();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 中线
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = NET_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, HUD_HEIGHT);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // HUD 分数
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = SCORE_COLOR_P1;
    ctx.fillText(String(this._p1Score), w / 4, 36);
    ctx.fillStyle = SCORE_COLOR_P2;
    ctx.fillText(String(this._p2Score), (w * 3) / 4, 36);

    // 分隔线
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, HUD_HEIGHT, w, 1);

    // 左挡板 (P1)
    ctx.fillStyle = PADDLE_COLOR_P1;
    ctx.fillRect(LEFT_PADDLE_X, this._leftPaddleY, PADDLE_WIDTH, PADDLE_HEIGHT);

    // 右挡板 (P2)
    ctx.fillStyle = PADDLE_COLOR_P2;
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
      ctx.font = '14px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText('准备发球...', w / 2, h / 2);
    }

    // 模式标签
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'left';
    ctx.fillText(this._mode === 'ai' ? 'AI' : '2P', 8, 14);

    // 胜利画面
    if (this._isWin) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = this._winner === 1 ? SCORE_COLOR_P1 : SCORE_COLOR_P2;
      ctx.fillText(`P${this._winner} 获胜!`, w / 2, h / 2 - 20);
      ctx.font = '18px monospace';
      ctx.fillStyle = HUD_COLOR;
      ctx.fillText(`${this._p1Score} : ${this._p2Score}`, w / 2, h / 2 + 20);
    }
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {
    // 游戏结束处理
  }

  // ========== 键盘处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    // P1: W/S
    if (key === 'w' || key === 'W') this._p1UpPressed = true;
    if (key === 's' || key === 'S') this._p1DownPressed = true;

    // P2: ↑/↓
    if (key === 'ArrowUp') this._p2UpPressed = true;
    if (key === 'ArrowDown') this._p2DownPressed = true;

    // 模式切换 (T 键)
    if (key === 't' || key === 'T') {
      this._mode = this._mode === '2p' ? 'ai' : '2p';
    }
  }

  handleKeyUp(key: string): void {
    // P1: W/S
    if (key === 'w' || key === 'W') this._p1UpPressed = false;
    if (key === 's' || key === 'S') this._p1DownPressed = false;

    // P2: ↑/↓
    if (key === 'ArrowUp') this._p2UpPressed = false;
    if (key === 'ArrowDown') this._p2DownPressed = false;
  }

  // ========== 状态序列化 ==========

  getState(): Record<string, unknown> {
    return {
      p1Score: this._p1Score,
      p2Score: this._p2Score,
      ball: this._ball ? { ...this._ball } : null,
      leftPaddleY: this._leftPaddleY,
      rightPaddleY: this._rightPaddleY,
      mode: this._mode,
      serving: this._serving,
      winner: this._winner,
      rallyCount: this._rallyCount,
    };
  }

  // ========== 核心逻辑 ==========

  private movePaddles(deltaTime: number): void {
    const dt = deltaTime / 16.67; // 归一化到 60fps

    // P1 左挡板
    if (this._p1UpPressed) {
      this._leftPaddleY = Math.max(HUD_HEIGHT, this._leftPaddleY - PADDLE_SPEED * dt);
    }
    if (this._p1DownPressed) {
      this._leftPaddleY = Math.min(
        CANVAS_HEIGHT - PADDLE_HEIGHT,
        this._leftPaddleY + PADDLE_SPEED * dt
      );
    }

    // P2 右挡板（AI 模式下由 AI 控制）
    if (this._mode === '2p') {
      if (this._p2UpPressed) {
        this._rightPaddleY = Math.max(HUD_HEIGHT, this._rightPaddleY - PADDLE_SPEED * dt);
      }
      if (this._p2DownPressed) {
        this._rightPaddleY = Math.min(
          CANVAS_HEIGHT - PADDLE_HEIGHT,
          this._rightPaddleY + PADDLE_SPEED * dt
        );
      }
    } else {
      // AI 移动
      this.moveAI(dt);
    }
  }

  private moveBall(): void {
    if (!this._ball) return;
    this._ball.x += this._ball.dx;
    this._ball.y += this._ball.dy;
  }

  private checkCollisions(): void {
    if (!this._ball) return;

    // 上下边界反弹
    if (this._ball.y - BALL_RADIUS <= HUD_HEIGHT) {
      this._ball.y = HUD_HEIGHT + BALL_RADIUS;
      this._ball.dy = Math.abs(this._ball.dy);
    }
    if (this._ball.y + BALL_RADIUS >= CANVAS_HEIGHT) {
      this._ball.y = CANVAS_HEIGHT - BALL_RADIUS;
      this._ball.dy = -Math.abs(this._ball.dy);
    }

    // 左挡板碰撞
    if (
      this._ball.dx < 0 &&
      this._ball.x - BALL_RADIUS <= LEFT_PADDLE_X + PADDLE_WIDTH &&
      this._ball.x + BALL_RADIUS >= LEFT_PADDLE_X &&
      this._ball.y >= this._leftPaddleY &&
      this._ball.y <= this._leftPaddleY + PADDLE_HEIGHT
    ) {
      this.bounceOffPaddle('left');
    }

    // 右挡板碰撞
    if (
      this._ball.dx > 0 &&
      this._ball.x + BALL_RADIUS >= RIGHT_PADDLE_X &&
      this._ball.x - BALL_RADIUS <= RIGHT_PADDLE_X + PADDLE_WIDTH &&
      this._ball.y >= this._rightPaddleY &&
      this._ball.y <= this._rightPaddleY + PADDLE_HEIGHT
    ) {
      this.bounceOffPaddle('right');
    }
  }

  private bounceOffPaddle(side: 'left' | 'right'): void {
    if (!this._ball) return;

    const paddleY = side === 'left' ? this._leftPaddleY : this._rightPaddleY;
    const paddleCenterY = paddleY + PADDLE_HEIGHT / 2;

    // 球击中挡板的相对位置 [-1, 1]
    const relativeIntersectY = (this._ball.y - paddleCenterY) / (PADDLE_HEIGHT / 2);
    const clampedIntersect = Math.max(-1, Math.min(1, relativeIntersectY));

    // 反弹角度
    const bounceAngle = clampedIntersect * MAX_BOUNCE_ANGLE;

    // 增加速度
    this._rallyCount++;
    this._ball.speed = Math.min(
      BALL_MAX_SPEED,
      this._ball.speed + BALL_SPEED_INCREMENT
    );

    // 设置新方向
    const direction = side === 'left' ? 1 : -1;
    this._ball.dx = direction * this._ball.speed * Math.cos(bounceAngle);
    this._ball.dy = this._ball.speed * Math.sin(bounceAngle);

    // 防止球卡在挡板内
    if (side === 'left') {
      this._ball.x = LEFT_PADDLE_X + PADDLE_WIDTH + BALL_RADIUS;
    } else {
      this._ball.x = RIGHT_PADDLE_X - BALL_RADIUS;
    }
  }

  private checkScore(): void {
    if (!this._ball) return;

    // 球出左边界 → P2 得分
    if (this._ball.x + BALL_RADIUS < 0) {
      this._p2Score++;
      this.emit('scoreChange', this._p1Score * 100 + this._p2Score);
      this.prepareServe(-1);
      this.checkWin();
      return;
    }

    // 球出右边界 → P1 得分
    if (this._ball.x - BALL_RADIUS > CANVAS_WIDTH) {
      this._p1Score++;
      this.emit('scoreChange', this._p1Score * 100 + this._p2Score);
      this.prepareServe(1);
      this.checkWin();
      return;
    }
  }

  private prepareServe(direction: 1 | -1): void {
    this._serving = true;
    this._serveTimer = 0;
    this._serveDirection = direction;
    this._ball = null;
    this._rallyCount = 0;
  }

  private serveBall(): void {
    this._serving = false;

    // 随机垂直角度
    const angle = (Math.random() - 0.5) * MAX_BOUNCE_ANGLE;
    const speed = BALL_INITIAL_SPEED;

    this._ball = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: this._serveDirection * speed * Math.cos(angle),
      dy: speed * Math.sin(angle),
      speed,
    };
  }

  private checkWin(): void {
    const p1 = this._p1Score;
    const p2 = this._p2Score;

    // 先到 WIN_SCORE 且领先至少 LEAD_BY 分
    if (p1 >= WIN_SCORE && p1 - p2 >= LEAD_BY) {
      this._isWin = true;
      this._winner = 1;
      this._score = p1;
      this.gameOver();
    } else if (p2 >= WIN_SCORE && p2 - p1 >= LEAD_BY) {
      this._isWin = true;
      this._winner = 2;
      this._score = p2;
      this.gameOver();
    }
  }

  // ========== AI 逻辑 ==========

  private updateAI(deltaTime: number): void {
    if (!this._ball) return;

    // 球向左移动时AI不跟踪（回到中间）
    if (this._ball.dx <= 0) {
      this._aiReady = false;
      this._aiReactionTimer = 0;
      return;
    }

    // 反应延迟
    this._aiReactionTimer += deltaTime / 1000;
    if (this._aiReactionTimer >= AI_REACTION_DELAY) {
      this._aiReactionTimer = 0;
      this._aiReady = true;
      // 预测球到达右侧的 Y 位置
      const error = (Math.random() - 0.5) * AI_TRACKING_ERROR * 2;
      this._aiTargetY = this._ball.y + error;
    }
  }

  private moveAI(dt: number): void {
    if (!this._aiReady) return;

    const paddleCenter = this._rightPaddleY + PADDLE_HEIGHT / 2;
    const diff = this._aiTargetY - paddleCenter;

    if (Math.abs(diff) > 4) {
      const moveAmount = AI_BASE_SPEED * dt;
      if (diff > 0) {
        this._rightPaddleY = Math.min(
          CANVAS_HEIGHT - PADDLE_HEIGHT,
          this._rightPaddleY + moveAmount
        );
      } else {
        this._rightPaddleY = Math.max(HUD_HEIGHT, this._rightPaddleY - moveAmount);
      }
    }
  }
}
