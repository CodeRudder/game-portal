import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRAVITY,
  BALL_RADIUS, BALL_START_X, BALL_START_Y, BALL_COLOR, BALL_LINE_COLOR,
  MIN_ANGLE, MAX_ANGLE, DEFAULT_ANGLE, ANGLE_STEP,
  MIN_POWER, MAX_POWER, POWER_CHARGE_RATE,
  HOOP_WIDTH, HOOP_RIM_RADIUS, HOOP_NET_HEIGHT,
  HOOP_RIM_COLOR, HOOP_NET_COLOR,
  HOOP_MIN_X, HOOP_MAX_X, HOOP_MIN_Y, HOOP_MAX_Y,
  HOOP_BACKBOARD_WIDTH, HOOP_BACKBOARD_HEIGHT, HOOP_BACKBOARD_COLOR,
  SCORE_NORMAL, SCORE_SWISH,
  COMBO_MULTIPLIERS,
  TIME_LIMIT,
  BALL_GONE_Y, BALL_GONE_X_MAX, BALL_GONE_X_MIN,
  SWISH_THRESHOLD,
  RIM_BOUNCE_THRESHOLD, RIM_BOUNCE_FACTOR,
  BACKBOARD_BOUNCE_FACTOR,
  BG_COLOR, GROUND_COLOR, GROUND_Y,
  AIM_LINE_COLOR, POWER_BAR_COLOR, POWER_BAR_BG_COLOR,
  TEXT_COLOR, COMBO_COLOR, TIMER_COLOR,
  TRAJECTORY_COLOR, TRAJECTORY_DOT_COUNT,
  HUD_HEIGHT, HUD_COLOR,
} from './constants';

// ========== 类型定义 ==========

/** 篮球飞行状态 */
export type BallPhase = 'ready' | 'flying' | 'scored' | 'missed';

/** 篮筐位置 */
export interface HoopPosition {
  x: number;       // 筐口中心 X
  y: number;       // 筐口 Y（上沿）
}

/** 飞行中的篮球 */
export interface FlyingBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hitRim: boolean;  // 是否碰过筐沿
}

// ========== 引擎实现 ==========

export class BasketballHoopsEngine extends GameEngine {
  // 投篮参数
  private _angle: number = DEFAULT_ANGLE;
  private _power: number = MIN_POWER;
  private _charging: boolean = false;
  private _upPressed: boolean = false;
  private _downPressed: boolean = false;

  // 篮球状态
  private _ballPhase: BallPhase = 'ready';
  private _ball: FlyingBall | null = null;

  // 篮筐
  private _hoop: HoopPosition = { x: 350, y: 200 };

  // 得分 & 连击
  private _combo: number = 0;
  private _maxCombo: number = 0;
  private _totalShots: number = 0;
  private _madeShots: number = 0;
  private _swishCount: number = 0;

  // 时间
  private _timeRemaining: number = TIME_LIMIT;

  // 得分动画
  private _scorePopup: { text: string; x: number; y: number; alpha: number } | null = null;

  // ========== Public Getters ==========

  get angle(): number { return this._angle; }
  get power(): number { return this._power; }
  get charging(): boolean { return this._charging; }
  get ballPhase(): BallPhase { return this._ballPhase; }
  get ball(): FlyingBall | null { return this._ball; }
  get hoop(): HoopPosition { return { ...this._hoop }; }
  get combo(): number { return this._combo; }
  get maxCombo(): number { return this._maxCombo; }
  get totalShots(): number { return this._totalShots; }
  get madeShots(): number { return this._madeShots; }
  get swishCount(): number { return this._swishCount; }
  get timeRemaining(): number { return this._timeRemaining; }
  get scorePopup(): typeof this._scorePopup { return this._scorePopup; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this.resetBall();
    this.randomizeHoop();
  }

  protected onStart(): void {
    this._timeRemaining = TIME_LIMIT;
    this._combo = 0;
    this._maxCombo = 0;
    this._totalShots = 0;
    this._madeShots = 0;
    this._swishCount = 0;
    this._scorePopup = null;
    this._angle = DEFAULT_ANGLE;
    this._power = MIN_POWER;
    this._charging = false;
    this.resetBall();
    this.randomizeHoop();
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000;

    // 更新时间
    this._timeRemaining -= dt;
    if (this._timeRemaining <= 0) {
      this._timeRemaining = 0;
      this.gameOver();
      return;
    }

    // 调节角度
    if (this._upPressed) {
      this._angle = Math.min(MAX_ANGLE, this._angle + ANGLE_STEP);
    }
    if (this._downPressed) {
      this._angle = Math.max(MIN_ANGLE, this._angle - ANGLE_STEP);
    }

    // 蓄力
    if (this._charging && this._ballPhase === 'ready') {
      this._power = Math.min(MAX_POWER, this._power + POWER_CHARGE_RATE * dt);
    }

    // 更新篮球飞行
    if (this._ballPhase === 'flying' && this._ball) {
      this.updateBallPhysics(dt);
    }

    // 更新得分弹出动画
    if (this._scorePopup) {
      this._scorePopup.alpha -= dt * 1.5;
      this._scorePopup.y -= 40 * dt;
      if (this._scorePopup.alpha <= 0) {
        this._scorePopup = null;
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 地面
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);

    // 篮板
    this.renderBackboard(ctx);

    // 篮筐
    this.renderHoop(ctx);

    // 投篮轨迹预览（ready 状态）
    if (this._ballPhase === 'ready') {
      this.renderTrajectoryPreview(ctx);
      this.renderAimLine(ctx);
      this.renderPowerBar(ctx);
    }

    // 篮球
    this.renderBall(ctx);

    // 得分弹出
    this.renderScorePopup(ctx);

    // HUD
    this.renderHUD(ctx, w);
  }

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this._upPressed = true;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this._downPressed = true;
        break;
      case ' ':
        if (this._ballPhase === 'ready' && !this._charging) {
          this._charging = true;
        }
        break;
    }
  }

  handleKeyUp(key: string): void {
    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this._upPressed = false;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this._downPressed = false;
        break;
      case ' ':
        if (this._charging && this._ballPhase === 'ready') {
          this._charging = false;
          this.shoot();
        }
        break;
    }
  }

  getState(): Record<string, unknown> {
    return {
      angle: this._angle,
      power: this._power,
      ballPhase: this._ballPhase,
      ball: this._ball ? { ...this._ball } : null,
      hoop: { ...this._hoop },
      score: this._score,
      combo: this._combo,
      maxCombo: this._maxCombo,
      totalShots: this._totalShots,
      madeShots: this._madeShots,
      swishCount: this._swishCount,
      timeRemaining: this._timeRemaining,
      charging: this._charging,
    };
  }

  protected onReset(): void {
    this.resetBall();
    this._timeRemaining = TIME_LIMIT;
    this._combo = 0;
    this._maxCombo = 0;
    this._totalShots = 0;
    this._madeShots = 0;
    this._swishCount = 0;
    this._scorePopup = null;
    this._angle = DEFAULT_ANGLE;
    this._power = MIN_POWER;
    this._charging = false;
    this._upPressed = false;
    this._downPressed = false;
  }

  // ========== 游戏逻辑 ==========

  /** 重置篮球到起始位置 */
  resetBall(): void {
    this._ballPhase = 'ready';
    this._ball = null;
    this._power = MIN_POWER;
    this._charging = false;
  }

  /** 随机化篮筐位置 */
  randomizeHoop(): void {
    const x = HOOP_MIN_X + Math.random() * (HOOP_MAX_X - HOOP_MIN_X);
    const y = HOOP_MIN_Y + Math.random() * (HOOP_MAX_Y - HOOP_MIN_Y);
    this._hoop = { x: Math.round(x), y: Math.round(y) };
  }

  /** 投篮 */
  shoot(): void {
    if (this._ballPhase !== 'ready') return;

    const vx = this._power * Math.cos(this._angle);
    const vy = -this._power * Math.sin(this._angle);

    this._ball = {
      x: BALL_START_X,
      y: BALL_START_Y,
      vx,
      vy,
      hitRim: false,
    };
    this._ballPhase = 'flying';
    this._totalShots++;
  }

  /** 更新篮球物理 */
  updateBallPhysics(dt: number): void {
    if (!this._ball) return;

    // 重力
    this._ball.vy += GRAVITY * dt;

    // 位移
    this._ball.x += this._ball.vx * dt;
    this._ball.y += this._ball.vy * dt;

    // 碰筐检测
    this.checkRimCollision();

    // 碰篮板检测
    this.checkBackboardCollision();

    // 进球检测
    this.checkScoring();

    // 出界检测
    this.checkOutOfBounds();
  }

  /** 碰筐沿检测 */
  private checkRimCollision(): void {
    if (!this._ball) return;

    const leftRimX = this._hoop.x - HOOP_WIDTH / 2;
    const rightRimX = this._hoop.x + HOOP_WIDTH / 2;
    const rimY = this._hoop.y;

    // 检测与左筐沿碰撞
    const dxL = this._ball.x - leftRimX;
    const dyL = this._ball.y - rimY;
    const distL = Math.sqrt(dxL * dxL + dyL * dyL);

    if (distL < RIM_BOUNCE_THRESHOLD) {
      this._ball.hitRim = true;
      // 简单反弹
      const nx = dxL / distL;
      const ny = dyL / distL;
      const dot = this._ball.vx * nx + this._ball.vy * ny;
      this._ball.vx = (this._ball.vx - 2 * dot * nx) * RIM_BOUNCE_FACTOR;
      this._ball.vy = (this._ball.vy - 2 * dot * ny) * RIM_BOUNCE_FACTOR;
      // 推出碰撞区
      this._ball.x = leftRimX + nx * RIM_BOUNCE_THRESHOLD;
      this._ball.y = rimY + ny * RIM_BOUNCE_THRESHOLD;
      return;
    }

    // 检测与右筐沿碰撞
    const dxR = this._ball.x - rightRimX;
    const dyR = this._ball.y - rimY;
    const distR = Math.sqrt(dxR * dxR + dyR * dyR);

    if (distR < RIM_BOUNCE_THRESHOLD) {
      this._ball.hitRim = true;
      const nx = dxR / distR;
      const ny = dyR / distR;
      const dot = this._ball.vx * nx + this._ball.vy * ny;
      this._ball.vx = (this._ball.vx - 2 * dot * nx) * RIM_BOUNCE_FACTOR;
      this._ball.vy = (this._ball.vy - 2 * dot * ny) * RIM_BOUNCE_FACTOR;
      this._ball.x = rightRimX + nx * RIM_BOUNCE_THRESHOLD;
      this._ball.y = rimY + ny * RIM_BOUNCE_THRESHOLD;
    }
  }

  /** 碰篮板检测 */
  private checkBackboardCollision(): void {
    if (!this._ball) return;

    const bbX = this._hoop.x + HOOP_WIDTH / 2 + HOOP_BACKBOARD_WIDTH / 2 + 2;
    const bbTop = this._hoop.y - HOOP_BACKBOARD_HEIGHT / 2;
    const bbBottom = this._hoop.y + HOOP_BACKBOARD_HEIGHT / 2;

    if (
      this._ball.x + BALL_RADIUS > bbX - HOOP_BACKBOARD_WIDTH / 2 &&
      this._ball.x - BALL_RADIUS < bbX + HOOP_BACKBOARD_WIDTH / 2 &&
      this._ball.y > bbTop &&
      this._ball.y < bbBottom
    ) {
      this._ball.hitRim = true;
      this._ball.vx = -Math.abs(this._ball.vx) * BACKBOARD_BOUNCE_FACTOR;
      this._ball.x = bbX - HOOP_BACKBOARD_WIDTH / 2 - BALL_RADIUS - 1;
    }
  }

  /** 进球检测 */
  private checkScoring(): void {
    if (!this._ball || this._ballPhase !== 'flying') return;

    const hoopLeft = this._hoop.x - HOOP_WIDTH / 2;
    const hoopRight = this._hoop.x + HOOP_WIDTH / 2;
    const rimY = this._hoop.y;

    // 球从上方穿过筐口：球心在筐口水平范围内，球心 Y 刚过筐口 Y，且球在下降
    if (
      this._ball.x > hoopLeft + BALL_RADIUS &&
      this._ball.x < hoopRight - BALL_RADIUS &&
      this._ball.y > rimY &&
      this._ball.y < rimY + HOOP_NET_HEIGHT &&
      this._ball.vy > 0
    ) {
      this.onScored();
    }
  }

  /** 进球处理 */
  private onScored(): void {
    if (!this._ball) return;
    this._ballPhase = 'scored';
    this._madeShots++;

    // 判断是否空心入网
    const isSwish = !this._ball.hitRim &&
      Math.abs(this._ball!.x - this._hoop.x) < SWISH_THRESHOLD;

    if (isSwish) {
      this._swishCount++;
    }

    // 计算得分
    const baseScore = isSwish ? SCORE_SWISH : SCORE_NORMAL;
    const comboIndex = Math.min(this._combo, COMBO_MULTIPLIERS.length - 1);
    const multiplier = COMBO_MULTIPLIERS[comboIndex];
    const points = Math.round(baseScore * multiplier);

    this.addScore(points);
    this._combo++;
    if (this._combo > this._maxCombo) {
      this._maxCombo = this._combo;
    }

    // 得分弹出
    const popupText = isSwish
      ? `空心入网! +${points}`
      : `+${points}`;
    this._scorePopup = {
      text: this._combo > 1 ? `${popupText} (${this._combo}连击!)` : popupText,
      x: this._hoop.x,
      y: this._hoop.y - 30,
      alpha: 1.5,
    };

    // 延迟重置
    setTimeout(() => {
      if (this._status === 'playing') {
        this.resetBall();
        this.randomizeHoop();
      }
    }, 500);
  }

  /** 出界检测 */
  private checkOutOfBounds(): void {
    if (!this._ball || this._ballPhase !== 'flying') return;

    if (
      this._ball.y > BALL_GONE_Y ||
      this._ball.x > BALL_GONE_X_MAX ||
      this._ball.x < BALL_GONE_X_MIN
    ) {
      this._ballPhase = 'missed';
      this._combo = 0;

      // 延迟重置
      setTimeout(() => {
        if (this._status === 'playing') {
          this.resetBall();
          this.randomizeHoop();
        }
      }, 500);
    }
  }

  // ========== 渲染方法 ==========

  private renderBall(ctx: CanvasRenderingContext2D): void {
    let bx: number, by: number;

    if (this._ballPhase === 'ready') {
      bx = BALL_START_X;
      by = BALL_START_Y;
    } else if (this._ball) {
      bx = this._ball.x;
      by = this._ball.y;
    } else {
      return;
    }

    // 篮球主体
    ctx.beginPath();
    ctx.arc(bx, by, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = BALL_COLOR;
    ctx.fill();
    ctx.strokeStyle = BALL_LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 篮球纹路
    ctx.beginPath();
    ctx.moveTo(bx - BALL_RADIUS, by);
    ctx.lineTo(bx + BALL_RADIUS, by);
    ctx.strokeStyle = BALL_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx, by - BALL_RADIUS);
    ctx.lineTo(bx, by + BALL_RADIUS);
    ctx.stroke();
  }

  private renderHoop(ctx: CanvasRenderingContext2D): void {
    const leftX = this._hoop.x - HOOP_WIDTH / 2;
    const rightX = this._hoop.x + HOOP_WIDTH / 2;
    const rimY = this._hoop.y;

    // 篮网
    ctx.strokeStyle = HOOP_NET_COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    const netSegments = 5;
    for (let i = 0; i <= netSegments; i++) {
      const x = leftX + (HOOP_WIDTH / netSegments) * i;
      ctx.beginPath();
      ctx.moveTo(x, rimY);
      ctx.lineTo(this._hoop.x + (x - this._hoop.x) * 0.5, rimY + HOOP_NET_HEIGHT);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 筐沿
    ctx.beginPath();
    ctx.arc(leftX, rimY, HOOP_RIM_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = HOOP_RIM_COLOR;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rightX, rimY, HOOP_RIM_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = HOOP_RIM_COLOR;
    ctx.fill();

    // 连接线
    ctx.beginPath();
    ctx.moveTo(leftX, rimY);
    ctx.lineTo(rightX, rimY);
    ctx.strokeStyle = HOOP_RIM_COLOR;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private renderBackboard(ctx: CanvasRenderingContext2D): void {
    const bbX = this._hoop.x + HOOP_WIDTH / 2 + 2;
    const bbTop = this._hoop.y - HOOP_BACKBOARD_HEIGHT / 2;

    ctx.fillStyle = HOOP_BACKBOARD_COLOR;
    ctx.fillRect(bbX, bbTop, HOOP_BACKBOARD_WIDTH, HOOP_BACKBOARD_HEIGHT);

    // 篮板边框
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 1;
    ctx.strokeRect(bbX, bbTop, HOOP_BACKBOARD_WIDTH, HOOP_BACKBOARD_HEIGHT);
  }

  private renderAimLine(ctx: CanvasRenderingContext2D): void {
    const len = 50;
    const endX = BALL_START_X + len * Math.cos(this._angle);
    const endY = BALL_START_Y - len * Math.sin(this._angle);

    ctx.beginPath();
    ctx.moveTo(BALL_START_X, BALL_START_Y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = AIM_LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private renderTrajectoryPreview(ctx: CanvasRenderingContext2D): void {
    const vx = this._power * Math.cos(this._angle);
    const vy = -this._power * Math.sin(this._angle);
    const dt = 0.05;

    ctx.fillStyle = TRAJECTORY_COLOR;
    for (let i = 1; i <= TRAJECTORY_DOT_COUNT; i++) {
      const t = i * dt;
      const px = BALL_START_X + vx * t;
      const py = BALL_START_Y + vy * t + 0.5 * GRAVITY * t * t;

      if (py > GROUND_Y || px > CANVAS_WIDTH || px < 0) break;

      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderPowerBar(ctx: CanvasRenderingContext2D): void {
    const barX = 20;
    const barY = CANVAS_HEIGHT - 40;
    const barWidth = 120;
    const barHeight = 12;
    const fillRatio = (this._power - MIN_POWER) / (MAX_POWER - MIN_POWER);

    // 背景
    ctx.fillStyle = POWER_BAR_BG_COLOR;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // 填充
    const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
    gradient.addColorStop(0, '#00ff88');
    gradient.addColorStop(0.5, '#ffff00');
    gradient.addColorStop(1, '#ff4444');
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barWidth * fillRatio, barHeight);

    // 边框
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // 标签
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('POWER', barX + barWidth / 2, barY - 4);
  }

  private renderScorePopup(ctx: CanvasRenderingContext2D): void {
    if (!this._scorePopup || this._scorePopup.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.min(1, this._scorePopup.alpha);
    ctx.fillStyle = COMBO_COLOR;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this._scorePopup.text, this._scorePopup.x, this._scorePopup.y);
    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = HUD_COLOR;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 分数
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`分数: ${this._score}`, 10, 22);

    // 连击
    if (this._combo > 1) {
      ctx.fillStyle = COMBO_COLOR;
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${this._combo}连击!`, 10, 42);
    }

    // 时间
    ctx.fillStyle = this._timeRemaining <= 10 ? TIMER_COLOR : TEXT_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`⏱ ${Math.ceil(this._timeRemaining)}s`, w - 10, 22);

    // 角度
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    const angleDeg = Math.round(this._angle * 180 / Math.PI);
    ctx.fillText(`角度: ${angleDeg}°`, w / 2, 22);

    // 命中率
    if (this._totalShots > 0) {
      const pct = Math.round((this._madeShots / this._totalShots) * 100);
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`命中: ${this._madeShots}/${this._totalShots} (${pct}%)`, w - 10, 42);
    }
  }
}
