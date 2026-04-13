import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_RADIUS,
  BALL_INITIAL_X,
  BALL_INITIAL_Y,
  BALL_HORIZONTAL_SPEED,
  GRAVITY,
  MAX_FALL_SPEED,
  PLATFORM_HEIGHT,
  PLATFORM_GAP_WIDTH,
  WIDE_GAP_WIDTH,
  PLATFORM_SPEED,
  PLATFORM_SPAWN_INTERVAL,
  PLATFORM_INITIAL_COUNT,
  PLATFORM_MIN_Y,
  MOVING_GAP_SPEED,
  MOVING_GAP_RANGE,
  SPEED_INCREMENT,
  SPEED_LEVEL_INTERVAL,
  MAX_PLATFORM_SPEED,
  BG_COLOR,
  BALL_COLOR,
  BALL_GLOW_COLOR,
  PLATFORM_COLOR,
  PLATFORM_BORDER_COLOR,
  WIDE_PLATFORM_COLOR,
  WIDE_PLATFORM_BORDER_COLOR,
  MOVING_PLATFORM_COLOR,
  MOVING_PLATFORM_BORDER_COLOR,
  SCORE_COLOR,
  GAME_OVER_COLOR,
  TOP_DANGER_ZONE,
  SCORE_PER_PLATFORM,
  PlatformType,
} from './constants';

// ========== 类型定义 ==========

interface Ball {
  x: number;
  y: number;
  velocityY: number;
}

interface PlatformGap {
  x: number;       // 间隙起始X坐标
  width: number;   // 间隙宽度
  baseX: number;   // 移动间隙的基准X（用于移动计算）
}

interface Platform {
  y: number;           // 平台Y坐标（顶部）
  type: PlatformType;  // 平台类型
  gap: PlatformGap;    // 间隙信息
  scored: boolean;     // 是否已计分
  movePhase: number;   // 移动间隙的相位
}

// ========== Fall Down 引擎 ==========

export class FallDownEngine extends GameEngine {
  // 球状态
  private ball: Ball = {
    x: BALL_INITIAL_X,
    y: BALL_INITIAL_Y,
    velocityY: 0,
  };

  // 平台列表
  private platforms: Platform[] = [];

  // 按键状态
  private keysPressed: Set<string> = new Set();

  // 当前平台速度
  private currentPlatformSpeed: number = PLATFORM_SPEED;

  // 下一平台生成Y坐标
  private nextPlatformY: number = 0;

  // 随机数种子（用于可预测的测试）
  private _seed: number = 0;
  private _useFixedSeed: boolean = false;

  // ========== 生命周期 ==========

  protected onInit(): void {
    // 初始化不做额外操作
  }

  protected onStart(): void {
    this.ball = {
      x: BALL_INITIAL_X,
      y: BALL_INITIAL_Y,
      velocityY: 0,
    };
    this.platforms = [];
    this.keysPressed.clear();
    this.currentPlatformSpeed = PLATFORM_SPEED;
    this.nextPlatformY = 0;

    // 生成初始平台
    this.generateInitialPlatforms();
  }

  protected onReset(): void {
    this.ball = {
      x: BALL_INITIAL_X,
      y: BALL_INITIAL_Y,
      velocityY: 0,
    };
    this.platforms = [];
    this.keysPressed.clear();
    this.currentPlatformSpeed = PLATFORM_SPEED;
    this.nextPlatformY = 0;
  }

  // ========== 游戏更新 ==========

  protected update(deltaTime: number): void {
    const dt = deltaTime / 16.667; // 标准化到 60fps

    // 更新球水平位置
    this.updateBallHorizontal(dt);

    // 更新球垂直位置（重力）
    this.updateBallVertical(dt);

    // 更新平台位置（上升）
    this.updatePlatforms(dt);

    // 碰撞检测：球与平台
    this.handlePlatformCollision();

    // 生成新平台
    this.generateNewPlatforms();

    // 移除超出顶部的平台
    this.removeOffscreenPlatforms();

    // 检查游戏结束：球被推到顶部
    if (this.ball.y - BALL_RADIUS <= 0) {
      this.gameOver();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 顶部危险区域
    ctx.fillStyle = 'rgba(255, 71, 87, 0.15)';
    ctx.fillRect(0, 0, w, TOP_DANGER_ZONE);

    // 平台
    this.platforms.forEach((platform) => this.drawPlatform(ctx, platform));

    // 球
    this.drawBall(ctx);

    // 分数
    this.drawScore(ctx, w);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (key === ' ') {
      if (this._status === 'idle' || this._status === 'gameover') {
        this.start();
      }
      return;
    }
    this.keysPressed.add(key);
  }

  handleKeyUp(key: string): void {
    this.keysPressed.delete(key);
  }

  getState(): Record<string, unknown> {
    return {
      ballX: this.ball.x,
      ballY: this.ball.y,
      ballVelocityY: this.ball.velocityY,
      platformCount: this.platforms.length,
      currentSpeed: this.currentPlatformSpeed,
      score: this._score,
    };
  }

  // ========== 公共方法（供测试使用） ==========

  /** 设置固定随机种子（测试用） */
  setSeed(seed: number): void {
    this._seed = seed;
    this._useFixedSeed = true;
  }

  /** 获取球状态（测试用） */
  getBallState(): { x: number; y: number; velocityY: number } {
    return { ...this.ball };
  }

  /** 获取平台列表（测试用） */
  getPlatforms(): Platform[] {
    return [...this.platforms];
  }

  /** 获取当前平台速度（测试用） */
  getCurrentPlatformSpeed(): number {
    return this.currentPlatformSpeed;
  }

  /** 获取按键状态（测试用） */
  getKeysPressed(): Set<string> {
    return new Set(this.keysPressed);
  }

  // ========== 私有方法 ==========

  /** 伪随机数生成器（可固定种子） */
  private random(): number {
    if (this._useFixedSeed) {
      this._seed = (this._seed * 1664525 + 1013904223) & 0xffffffff;
      return (this._seed >>> 0) / 0xffffffff;
    }
    return Math.random();
  }

  /** 更新球水平位置 */
  private updateBallHorizontal(dt: number): void {
    const speed = BALL_HORIZONTAL_SPEED * dt;

    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('a') || this.keysPressed.has('A')) {
      this.ball.x -= speed;
    }
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('d') || this.keysPressed.has('D')) {
      this.ball.x += speed;
    }

    // 边界穿越（wrap around）
    if (this.ball.x < -BALL_RADIUS) {
      this.ball.x = CANVAS_WIDTH + BALL_RADIUS;
    } else if (this.ball.x > CANVAS_WIDTH + BALL_RADIUS) {
      this.ball.x = -BALL_RADIUS;
    }
  }

  /** 更新球垂直位置（重力） */
  private updateBallVertical(dt: number): void {
    this.ball.velocityY += GRAVITY * dt;
    this.ball.velocityY = Math.min(this.ball.velocityY, MAX_FALL_SPEED);
    this.ball.y += this.ball.velocityY * dt;

    // 底部边界
    if (this.ball.y + BALL_RADIUS > CANVAS_HEIGHT) {
      this.ball.y = CANVAS_HEIGHT - BALL_RADIUS;
      this.ball.velocityY = 0;
    }
  }

  /** 更新平台位置（上升） */
  private updatePlatforms(dt: number): void {
    const moveAmount = this.currentPlatformSpeed * dt;

    for (const platform of this.platforms) {
      platform.y -= moveAmount; // 平台向上移动

      // 移动间隙平台：更新间隙位置
      if (platform.type === PlatformType.MOVING) {
        platform.movePhase += MOVING_GAP_SPEED * dt * 0.05;
        const offset = Math.sin(platform.movePhase) * MOVING_GAP_RANGE / 2;
        platform.gap.x = platform.gap.baseX + offset;
        // 确保间隙在画布范围内
        platform.gap.x = Math.max(0, Math.min(CANVAS_WIDTH - platform.gap.width, platform.gap.x));
      }
    }

    // 球也随平台一起上升（如果站在平台上）
    // 注意：碰撞处理在 handlePlatformCollision 中
  }

  /** 碰撞检测：球与平台 */
  private handlePlatformCollision(): void {
    const ballBottom = this.ball.y + BALL_RADIUS;
    const ballTop = this.ball.y - BALL_RADIUS;
    const ballLeft = this.ball.x - BALL_RADIUS;
    const ballRight = this.ball.x + BALL_RADIUS;

    for (const platform of this.platforms) {
      const platTop = platform.y;
      const platBottom = platform.y + PLATFORM_HEIGHT;
      const gapLeft = platform.gap.x;
      const gapRight = platform.gap.x + platform.gap.width;

      // 球是否在平台的Y范围内
      if (ballBottom >= platTop && ballBottom <= platBottom + 2 && this.ball.velocityY >= 0) {
        // 球是否在间隙内（可以穿过）
        const ballInGap = ballRight > gapLeft && ballLeft < gapRight;

        if (!ballInGap) {
          // 球在平台上（非间隙区域），被平台推着上升
          this.ball.y = platTop - BALL_RADIUS;
          this.ball.velocityY = 0;

          // 球跟随平台上升
          this.ball.y -= this.currentPlatformSpeed;

          // 计分：球穿过平台（平台从下方经过球）
          if (!platform.scored) {
            // 不在这里计分，因为球在平台上面
          }
        } else {
          // 球穿过间隙
          if (!platform.scored) {
            platform.scored = true;
            this.addScore(SCORE_PER_PLATFORM);
            this.checkLevelUp();
          }
        }
      }
    }
  }

  /** 检查升级 */
  private checkLevelUp(): void {
    const newLevel = Math.floor(this._score / SPEED_LEVEL_INTERVAL) + 1;
    if (newLevel > this._level) {
      this.setLevel(newLevel);
      this.currentPlatformSpeed = Math.min(
        PLATFORM_SPEED + (newLevel - 1) * SPEED_INCREMENT,
        MAX_PLATFORM_SPEED
      );
    }
  }

  /** 生成初始平台 */
  private generateInitialPlatforms(): void {
    // 从底部开始生成平台，留出空间
    let y = CANVAS_HEIGHT - 60;

    for (let i = 0; i < PLATFORM_INITIAL_COUNT; i++) {
      const platform = this.createPlatform(y);
      this.platforms.push(platform);
      y -= PLATFORM_SPAWN_INTERVAL;
    }

    this.nextPlatformY = y;
  }

  /** 生成新平台 */
  private generateNewPlatforms(): void {
    // 当最高的平台上升到一定位置时，在底部生成新平台
    while (this.nextPlatformY > PLATFORM_MIN_Y) {
      // 找到当前最低的平台
      let lowestY = 0;
      for (const p of this.platforms) {
        if (p.y > lowestY) lowestY = p.y;
      }

      const newY = lowestY + PLATFORM_SPAWN_INTERVAL;
      if (newY <= CANVAS_HEIGHT + 50) {
        const platform = this.createPlatform(newY);
        this.platforms.push(platform);
        this.nextPlatformY = newY;
      } else {
        break;
      }
    }
  }

  /** 创建一个平台 */
  private createPlatform(y: number): Platform {
    // 随机选择平台类型
    const rand = this.random();
    let type: PlatformType;
    if (rand < 0.6) {
      type = PlatformType.NORMAL;
    } else if (rand < 0.85) {
      type = PlatformType.WIDE;
    } else {
      type = PlatformType.MOVING;
    }

    const gapWidth = type === PlatformType.WIDE ? WIDE_GAP_WIDTH : PLATFORM_GAP_WIDTH;
    const maxGapX = CANVAS_WIDTH - gapWidth;
    const gapX = this.random() * maxGapX;

    return {
      y,
      type,
      gap: {
        x: gapX,
        width: gapWidth,
        baseX: gapX,
      },
      scored: false,
      movePhase: this.random() * Math.PI * 2,
    };
  }

  /** 移除超出顶部的平台 */
  private removeOffscreenPlatforms(): void {
    this.platforms = this.platforms.filter((p) => p.y > PLATFORM_MIN_Y);
  }

  // ========== 绘制方法 ==========

  /** 绘制球 */
  private drawBall(ctx: CanvasRenderingContext2D): void {
    // 发光效果
    ctx.save();
    ctx.shadowColor = BALL_GLOW_COLOR;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = BALL_COLOR;
    ctx.fill();
    ctx.restore();

    // 球体高光
    ctx.beginPath();
    ctx.arc(this.ball.x - 3, this.ball.y - 3, BALL_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
  }

  /** 绘制平台 */
  private drawPlatform(ctx: CanvasRenderingContext2D, platform: Platform): void {
    const { y, gap, type } = platform;
    const gapLeft = gap.x;
    const gapRight = gap.x + gap.width;

    // 选择颜色
    let fillColor: string, borderColor: string;
    switch (type) {
      case PlatformType.WIDE:
        fillColor = WIDE_PLATFORM_COLOR;
        borderColor = WIDE_PLATFORM_BORDER_COLOR;
        break;
      case PlatformType.MOVING:
        fillColor = MOVING_PLATFORM_COLOR;
        borderColor = MOVING_PLATFORM_BORDER_COLOR;
        break;
      default:
        fillColor = PLATFORM_COLOR;
        borderColor = PLATFORM_BORDER_COLOR;
    }

    // 左侧平台段
    if (gapLeft > 0) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(0, y, gapLeft, PLATFORM_HEIGHT);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(0, y, gapLeft, PLATFORM_HEIGHT);
    }

    // 右侧平台段
    if (gapRight < CANVAS_WIDTH) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(gapRight, y, CANVAS_WIDTH - gapRight, PLATFORM_HEIGHT);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(gapRight, y, CANVAS_WIDTH - gapRight, PLATFORM_HEIGHT);
    }
  }

  /** 绘制分数 */
  private drawScore(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.save();
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = SCORE_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText(`${this._score}`, w / 2, 50);
    ctx.restore();
  }
}
