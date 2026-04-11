import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_HEIGHT,
  BIRD_X,
  BIRD_WIDTH,
  BIRD_HEIGHT,
  BIRD_RADIUS,
  GRAVITY,
  JUMP_FORCE,
  MAX_FALL_SPEED,
  BIRD_ROTATION_SPEED,
  PIPE_WIDTH,
  PIPE_GAP,
  PIPE_SPEED,
  PIPE_SPAWN_INTERVAL,
  PIPE_MIN_HEIGHT,
  PIPE_COLOR,
  PIPE_BORDER_COLOR,
  PIPE_CAP_HEIGHT,
  PIPE_CAP_OVERHANG,
  SKY_TOP,
  SKY_BOTTOM,
  GROUND_COLOR,
  GROUND_DARK,
  BIRD_BODY_COLOR,
  BIRD_WING_COLOR,
  BIRD_BEAK_COLOR,
  BIRD_EYE_COLOR,
  SCORE_PER_PIPE,
  LEVEL_UP_SCORE,
  SPEED_INCREMENT,
  GAP_DECREMENT,
  MIN_GAP,
} from './constants';

// ========== 类型定义 ==========

interface Bird {
  x: number;
  y: number;
  velocity: number;
  rotation: number;
  wingPhase: number; // 翅膀动画帧
}

interface Pipe {
  x: number;
  topHeight: number; // 上管道高度
  scored: boolean; // 是否已计分
}

// ========== Flappy Bird 引擎 ==========

export class FlappyBirdEngine extends GameEngine {
  // 小鸟状态
  private bird: Bird = {
    x: BIRD_X,
    y: CANVAS_HEIGHT / 2,
    velocity: 0,
    rotation: 0,
    wingPhase: 0,
  };

  // 管道列表
  private pipes: Pipe[] = [];

  // 计时器
  private pipeTimer: number = 0;
  private wingTimer: number = 0;

  // 当前难度参数
  private currentSpeed: number = PIPE_SPEED;
  private currentGap: number = PIPE_GAP;

  // 地面偏移（滚动效果）
  private groundOffset: number = 0;

  // ========== 生命周期 ==========

  protected onInit(): void {
    // 初始化不做额外操作
  }

  protected onStart(): void {
    this.bird = {
      x: BIRD_X,
      y: CANVAS_HEIGHT / 2,
      velocity: 0,
      rotation: 0,
      wingPhase: 0,
    };
    this.pipes = [];
    this.pipeTimer = 0;
    this.wingTimer = 0;
    this.currentSpeed = PIPE_SPEED;
    this.currentGap = PIPE_GAP;
    this.groundOffset = 0;
  }

  protected onReset(): void {
    this.bird = {
      x: BIRD_X,
      y: CANVAS_HEIGHT / 2,
      velocity: 0,
      rotation: 0,
      wingPhase: 0,
    };
    this.pipes = [];
    this.pipeTimer = 0;
    this.wingTimer = 0;
    this.groundOffset = 0;
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 16.667; // 标准化到 60fps

    // 更新小鸟物理
    this.updateBird(dt);

    // 更新管道
    this.updatePipes(dt);

    // 更新地面滚动
    this.groundOffset = (this.groundOffset + this.currentSpeed * dt) % 24;

    // 更新翅膀动画
    this.wingTimer += deltaTime;
    if (this.wingTimer > 120) {
      this.wingTimer = 0;
      this.bird.wingPhase = (this.bird.wingPhase + 1) % 3;
    }

    // 碰撞检测
    if (this.checkCollision()) {
      this.gameOver();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变背景
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h - GROUND_HEIGHT);
    skyGrad.addColorStop(0, SKY_TOP);
    skyGrad.addColorStop(1, SKY_BOTTOM);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h - GROUND_HEIGHT);

    // 远景装饰云朵
    this.drawClouds(ctx, w, h);

    // 管道
    this.pipes.forEach((pipe) => this.drawPipe(ctx, pipe));

    // 地面
    this.drawGround(ctx, w, h);

    // 小鸟
    this.drawBird(ctx);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.flap();
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }

  getState(): Record<string, unknown> {
    return {
      birdY: this.bird.y,
      birdVelocity: this.bird.velocity,
      pipeCount: this.pipes.length,
      currentSpeed: this.currentSpeed,
      currentGap: this.currentGap,
    };
  }

  // ========== 公共方法（供 GameContainer 点击调用） ==========

  /** 点击/触摸跳跃 */
  flap(): void {
    if (this._status !== 'playing') return;
    this.bird.velocity = JUMP_FORCE;
  }

  // ========== 私有方法 ==========

  private updateBird(dt: number): void {
    // 重力
    this.bird.velocity += GRAVITY * dt;
    this.bird.velocity = Math.min(this.bird.velocity, MAX_FALL_SPEED);
    this.bird.y += this.bird.velocity * dt;

    // 旋转：上升时仰头，下落时俯冲
    if (this.bird.velocity < 0) {
      this.bird.rotation = Math.max(-0.5, this.bird.rotation - BIRD_ROTATION_SPEED * dt * 2);
    } else {
      this.bird.rotation = Math.min(Math.PI / 4, this.bird.rotation + BIRD_ROTATION_SPEED * dt);
    }

    // 天花板限制
    if (this.bird.y < BIRD_RADIUS) {
      this.bird.y = BIRD_RADIUS;
      this.bird.velocity = 0;
    }
  }

  private updatePipes(dt: number): void {
    // 生成新管道
    this.pipeTimer += 16.667 * dt; // 近似每帧 16.667ms
    if (this.pipeTimer >= PIPE_SPAWN_INTERVAL) {
      this.pipeTimer = 0;
      this.spawnPipe();
    }

    // 移动管道
    this.pipes.forEach((pipe) => {
      pipe.x -= this.currentSpeed * dt;
    });

    // 计分：小鸟通过管道
    this.pipes.forEach((pipe) => {
      if (!pipe.scored && pipe.x + PIPE_WIDTH < this.bird.x) {
        pipe.scored = true;
        this.addScore(SCORE_PER_PIPE);

        // 升级检查
        const newLevel = Math.floor(this._score / LEVEL_UP_SCORE) + 1;
        if (newLevel > this._level) {
          this.setLevel(newLevel);
          this.increaseDifficulty();
        }
      }
    });

    // 移除屏幕外管道
    this.pipes = this.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -10);
  }

  private spawnPipe(): void {
    const playAreaHeight = CANVAS_HEIGHT - GROUND_HEIGHT;
    const gap = this.currentGap;
    const minTop = PIPE_MIN_HEIGHT;
    const maxTop = playAreaHeight - gap - PIPE_MIN_HEIGHT;
    const topHeight = Math.random() * (maxTop - minTop) + minTop;

    this.pipes.push({
      x: CANVAS_WIDTH + 10,
      topHeight,
      scored: false,
    });
  }

  private increaseDifficulty(): void {
    this.currentSpeed = PIPE_SPEED + (this._level - 1) * SPEED_INCREMENT;
    this.currentGap = Math.max(MIN_GAP, PIPE_GAP - (this._level - 1) * GAP_DECREMENT);
  }

  // ========== 碰撞检测 ==========

  private checkCollision(): boolean {
    const bx = this.bird.x;
    const by = this.bird.y;
    const br = BIRD_RADIUS;

    // 地面碰撞
    if (by + br >= CANVAS_HEIGHT - GROUND_HEIGHT) {
      return true;
    }

    // 天花板碰撞
    if (by - br <= 0) {
      return true;
    }

    // 管道碰撞（圆形 vs 矩形简化检测）
    for (const pipe of this.pipes) {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + PIPE_WIDTH;
      const gapTop = pipe.topHeight;
      const gapBottom = pipe.topHeight + this.currentGap;

      // 小鸟水平范围与管道重叠
      if (bx + br > pipeLeft && bx - br < pipeRight) {
        // 碰上管道或下管道
        if (by - br < gapTop || by + br > gapBottom) {
          return true;
        }
      }
    }

    return false;
  }

  // ========== 渲染辅助 ==========

  private drawBird(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.bird.x, this.bird.y);
    ctx.rotate(this.bird.rotation);

    // 身体
    ctx.fillStyle = BIRD_BODY_COLOR;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_WIDTH / 2, BIRD_HEIGHT / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8b80e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 翅膀
    ctx.fillStyle = BIRD_WING_COLOR;
    const wingY = this.bird.wingPhase === 0 ? -2 : this.bird.wingPhase === 1 ? -6 : 2;
    ctx.beginPath();
    ctx.ellipse(-4, wingY, 10, 6, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(8, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BIRD_EYE_COLOR;
    ctx.beginPath();
    ctx.arc(9, -5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 喙
    ctx.fillStyle = BIRD_BEAK_COLOR;
    ctx.beginPath();
    ctx.moveTo(14, -1);
    ctx.lineTo(22, 2);
    ctx.lineTo(14, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe): void {
    const playAreaHeight = CANVAS_HEIGHT - GROUND_HEIGHT;
    const gap = this.currentGap;

    // 上管道
    const topPipeBottom = pipe.topHeight;
    this.drawPipeSegment(ctx, pipe.x, 0, PIPE_WIDTH, topPipeBottom, true);

    // 下管道
    const bottomPipeTop = pipe.topHeight + gap;
    this.drawPipeSegment(ctx, pipe.x, bottomPipeTop, PIPE_WIDTH, playAreaHeight - bottomPipeTop, false);
  }

  private drawPipeSegment(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    isTop: boolean
  ): void {
    if (h <= 0) return;

    // 管道主体
    ctx.fillStyle = PIPE_COLOR;
    ctx.fillRect(x, y, w, h);

    // 管道边框
    ctx.strokeStyle = PIPE_BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // 管道高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(x + 4, y, 6, h);

    // 管道暗面
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(x + w - 10, y, 6, h);

    // 管道帽
    const capY = isTop ? y + h - PIPE_CAP_HEIGHT : y;
    ctx.fillStyle = PIPE_COLOR;
    ctx.fillRect(x - PIPE_CAP_OVERHANG, capY, w + PIPE_CAP_OVERHANG * 2, PIPE_CAP_HEIGHT);
    ctx.strokeStyle = PIPE_BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - PIPE_CAP_OVERHANG, capY, w + PIPE_CAP_OVERHANG * 2, PIPE_CAP_HEIGHT);

    // 帽子高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(x - PIPE_CAP_OVERHANG + 3, capY + 2, 6, PIPE_CAP_HEIGHT - 4);
  }

  private drawGround(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const groundY = h - GROUND_HEIGHT;

    // 地面主体
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, groundY, w, GROUND_HEIGHT);

    // 地面纹理条纹
    ctx.fillStyle = GROUND_DARK;
    for (let i = -1; i < w / 24 + 1; i++) {
      const x = i * 24 - this.groundOffset;
      ctx.fillRect(x, groundY, 12, 4);
    }

    // 顶部草地线
    ctx.fillStyle = '#2ed573';
    ctx.fillRect(0, groundY, w, 4);
  }

  private drawClouds(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    // 固定位置的装饰云
    this.drawCloud(ctx, 60, 80, 40);
    this.drawCloud(ctx, 200, 50, 30);
    this.drawCloud(ctx, 350, 100, 35);
    this.drawCloud(ctx, 420, 40, 25);
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.35, y - size * 0.15, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.7, y, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}
