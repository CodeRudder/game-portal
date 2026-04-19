import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BALL_RADIUS,
  BALL_INITIAL_X,
  BALL_Y,
  BALL_MOVE_SPEED,
  BALL_COLOR,
  BALL_GLOW_COLOR,
  ROAD_LEFT,
  ROAD_RIGHT,
  ROAD_WIDTH,
  ROAD_COLOR,
  ROAD_LINE_COLOR,
  ROAD_EDGE_COLOR,
  ObstacleType,
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  GAP_WIDTH,
  BLOCK_COLOR,
  BLOCK_GLOW_COLOR,
  MOVING_BLOCK_COLOR,
  MOVING_BLOCK_GLOW_COLOR,
  INITIAL_OBSTACLE_INTERVAL,
  MIN_OBSTACLE_INTERVAL,
  OBSTACLE_INTERVAL_DECREASE,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  SPEED_INCREMENT_SCORE,
  MAX_SPEED,
  HITBOX_SHRINK,
  SCORE_PER_FRAME,
  STAR_COUNT,
  LANE_LINE_COUNT,
  LANE_LINE_HEIGHT,
  LANE_LINE_GAP,
  BG_COLOR_TOP,
  BG_COLOR_BOTTOM,
  STAR_COLOR,
  SCORE_COLOR,
  DISTANCE_COLOR,
  SPEED_INDICATOR_COLOR,
  LEVEL_UP_SCORE,
  MAX_LEVEL,
} from './constants';

// ========== 类型定义 ==========

/** 球体对象 */
interface Ball {
  x: number;
  y: number;
  radius: number;
  rotation: number; // 滚动旋转角度
}

/** 障碍物对象 */
interface Obstacle {
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  speed?: number; // 移动方块的横向速度
  direction?: number; // 移动方向 1 或 -1
  passed: boolean; // 是否已经被球通过（用于计分）
}

/** 背景星星 */
interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  speed: number;
}

/** 车道线段 */
interface LaneLine {
  y: number;
}

// ========== Slope Ball 引擎 ==========

export class SlopeBallEngine extends GameEngine {
  // 球体
  private ball: Ball = this.createBall();

  // 障碍物列表
  private obstacles: Obstacle[] = [];

  // 背景星星
  private stars: Star[] = [];

  // 车道线段
  private laneLines: LaneLine[] = [];

  // 当前游戏速度
  private speed: number = INITIAL_SPEED;

  // 障碍物生成计时器
  private obstacleTimer: number = 0;
  private currentObstacleInterval: number = INITIAL_OBSTACLE_INTERVAL;

  // 车道线滚动偏移
  private laneOffset: number = 0;

  // 距离（米）
  private distance: number = 0;

  // 按键状态
  private keysDown: Set<string> = new Set();

  // 是否为胜利状态（此游戏无胜利条件）
  public isWin: boolean = false;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.initStars();
    this.initLaneLines();
  }

  protected onStart(): void {
    this.ball = this.createBall();
    this.obstacles = [];
    this.speed = INITIAL_SPEED;
    this.obstacleTimer = 0;
    this.currentObstacleInterval = INITIAL_OBSTACLE_INTERVAL;
    this.laneOffset = 0;
    this.distance = 0;
    this.keysDown.clear();
    this.isWin = false;
    this.initStars();
    this.initLaneLines();
  }

  protected onReset(): void {
    this.ball = this.createBall();
    this.obstacles = [];
    this.speed = INITIAL_SPEED;
    this.obstacleTimer = 0;
    this.currentObstacleInterval = INITIAL_OBSTACLE_INTERVAL;
    this.laneOffset = 0;
    this.distance = 0;
    this.keysDown.clear();
    this.isWin = false;
    this.initStars();
    this.initLaneLines();
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
    const dt = deltaTime / 16.667; // 标准化到 60fps

    // 更新球体位置
    this.updateBall(dt);

    // 更新球体旋转
    this.ball.rotation += this.speed * dt * 0.1;

    // 更新障碍物
    this.updateObstacles(dt);

    // 更新背景
    this.updateStars(dt);
    this.updateLaneLines(dt);

    // 计分（基于速度和距离）
    const scoreDelta = SCORE_PER_FRAME * this.speed * dt;
    this.addScore(scoreDelta);
    this.distance += this.speed * dt * 0.5;

    // 难度递增
    this.updateDifficulty();

    // 碰撞检测
    if (this.checkCollision()) {
      this.gameOver();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景渐变
    this.renderBackground(ctx, w, h);

    // 星星
    this.renderStars(ctx);

    // 斜坡跑道
    this.renderRoad(ctx, w, h);

    // 车道线
    this.renderLaneLines(ctx, w);

    // 障碍物
    this.renderObstacles(ctx);

    // 球体
    this.renderBall(ctx);

    // HUD
    this.renderHUD(ctx, w);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    this.keysDown.add(key);

    if (this._status !== 'playing') return;

    // 无需额外处理，球在 update 中根据 keysDown 移动
  }

  handleKeyUp(key: string): void {
    this.keysDown.delete(key);
  }

  getState(): Record<string, unknown> {
    return {
      ballX: this.ball.x,
      ballY: this.ball.y,
      ballRadius: this.ball.radius,
      ballRotation: this.ball.rotation,
      speed: this.speed,
      distance: this.distance,
      obstacleCount: this.obstacles.length,
      score: this._score,
      level: this._level,
      status: this._status,
      keysDown: Array.from(this.keysDown),
    };
  }

  // ========== 公共方法（供测试使用） ==========

  /** 获取球体状态 */
  getBallState(): { x: number; y: number; radius: number; rotation: number } {
    return { ...this.ball };
  }

  /** 获取当前速度 */
  getCurrentSpeed(): number {
    return this.speed;
  }

  /** 获取障碍物列表 */
  getObstacles(): Obstacle[] {
    return [...this.obstacles];
  }

  /** 获取距离 */
  getDistance(): number {
    return this.distance;
  }

  /** 获取按键状态 */
  getKeysDown(): Set<string> {
    return new Set(this.keysDown);
  }

  /** 获取当前障碍物生成间隔 */
  getObstacleInterval(): number {
    return this.currentObstacleInterval;
  }

  // ========== 私有方法：初始化 ==========

  private createBall(): Ball {
    return {
      x: BALL_INITIAL_X,
      y: BALL_Y,
      radius: BALL_RADIUS,
      rotation: 0,
    };
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (BALL_Y - 50),
        size: 0.5 + Math.random() * 2,
        brightness: 0.3 + Math.random() * 0.7,
        speed: 0.2 + Math.random() * 0.8,
      });
    }
  }

  private initLaneLines(): void {
    this.laneLines = [];
    const totalHeight = LANE_LINE_HEIGHT + LANE_LINE_GAP;
    for (let i = 0; i < LANE_LINE_COUNT; i++) {
      this.laneLines.push({
        y: i * totalHeight,
      });
    }
  }

  // ========== 私有方法：更新 ==========

  private updateBall(dt: number): void {
    // 左右移动
    const moveAmount = BALL_MOVE_SPEED * dt;
    if (this.keysDown.has('ArrowLeft') || this.keysDown.has('a') || this.keysDown.has('A')) {
      this.ball.x -= moveAmount;
    }
    if (this.keysDown.has('ArrowRight') || this.keysDown.has('d') || this.keysDown.has('D')) {
      this.ball.x += moveAmount;
    }

    // 边界限制
    this.ball.x = Math.max(ROAD_LEFT + this.ball.radius, Math.min(ROAD_RIGHT - this.ball.radius, this.ball.x));
  }

  private updateObstacles(dt: number): void {
    // 生成新障碍物
    this.obstacleTimer += 16.667 * dt;
    if (this.obstacleTimer >= this.currentObstacleInterval) {
      this.obstacleTimer = 0;
      this.spawnObstacle();
      // 逐渐缩短生成间隔
      this.currentObstacleInterval = Math.max(
        MIN_OBSTACLE_INTERVAL,
        this.currentObstacleInterval - OBSTACLE_INTERVAL_DECREASE
      );
    }

    // 移动障碍物（向下移动，模拟球向下滚动）
    for (const obs of this.obstacles) {
      obs.y += this.speed * dt;

      // 移动方块横向移动
      if (obs.type === ObstacleType.MOVING_BLOCK && obs.speed && obs.direction) {
        obs.x += obs.speed * obs.direction * dt;
        // 碰到边界反弹
        if (obs.x <= ROAD_LEFT || obs.x + obs.width >= ROAD_RIGHT) {
          obs.direction *= -1;
          obs.x = Math.max(ROAD_LEFT, Math.min(ROAD_RIGHT - obs.width, obs.x));
        }
      }

      // 标记已通过
      if (!obs.passed && obs.y > this.ball.y + this.ball.radius) {
        obs.passed = true;
      }
    }

    // 移除屏幕外障碍物
    this.obstacles = this.obstacles.filter((obs) => obs.y < CANVAS_HEIGHT + 50);
  }

  private updateStars(dt: number): void {
    for (const star of this.stars) {
      star.y += star.speed * this.speed * 0.3 * dt;
      // 闪烁效果
      star.brightness = 0.3 + Math.abs(Math.sin(Date.now() * 0.001 + star.x)) * 0.7;
      // 循环
      if (star.y > BALL_Y - 50) {
        star.y = -5;
        star.x = Math.random() * CANVAS_WIDTH;
      }
    }
  }

  private updateLaneLines(dt: number): void {
    const totalHeight = LANE_LINE_HEIGHT + LANE_LINE_GAP;
    this.laneOffset = (this.laneOffset + this.speed * dt) % totalHeight;

    for (const line of this.laneLines) {
      line.y += this.speed * dt;
      if (line.y > CANVAS_HEIGHT) {
        line.y -= totalHeight * LANE_LINE_COUNT;
      }
    }
  }

  private updateDifficulty(): void {
    // 速度递增
    const speedLevel = Math.floor(this._score / SPEED_INCREMENT_SCORE);
    this.speed = Math.min(MAX_SPEED, INITIAL_SPEED + speedLevel * SPEED_INCREMENT);

    // 等级
    const newLevel = Math.min(MAX_LEVEL, Math.floor(this._score / LEVEL_UP_SCORE) + 1);
    if (newLevel !== this._level) {
      this.setLevel(newLevel);
    }
  }

  // ========== 私有方法：生成 ==========

  private spawnObstacle(): void {
    const rand = Math.random();
    let obstacle: Obstacle;

    if (rand < 0.5) {
      // 普通方块
      const x = ROAD_LEFT + Math.random() * (ROAD_WIDTH - BLOCK_WIDTH);
      obstacle = {
        type: ObstacleType.BLOCK,
        x,
        y: -BLOCK_HEIGHT,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      };
    } else if (rand < 0.8) {
      // 间隙（两侧有墙，中间有通道）
      const gapX = ROAD_LEFT + Math.random() * (ROAD_WIDTH - GAP_WIDTH);
      obstacle = {
        type: ObstacleType.GAP,
        x: gapX,
        y: -BLOCK_HEIGHT,
        width: GAP_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      };
    } else {
      // 移动方块
      const x = ROAD_LEFT + Math.random() * (ROAD_WIDTH - BLOCK_WIDTH);
      obstacle = {
        type: ObstacleType.MOVING_BLOCK,
        x,
        y: -BLOCK_HEIGHT,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        speed: 1.5 + Math.random() * 2,
        direction: Math.random() < 0.5 ? 1 : -1,
        passed: false,
      };
    }

    this.obstacles.push(obstacle);
  }

  // ========== 私有方法：碰撞检测 ==========

  private checkCollision(): boolean {
    const ballBox = {
      x: this.ball.x - this.ball.radius + HITBOX_SHRINK,
      y: this.ball.y - this.ball.radius + HITBOX_SHRINK,
      width: (this.ball.radius - HITBOX_SHRINK) * 2,
      height: (this.ball.radius - HITBOX_SHRINK) * 2,
    };

    for (const obs of this.obstacles) {
      if (obs.type === ObstacleType.GAP) {
        // 间隙类型：球必须在间隙内才安全，否则碰撞
        // 左侧墙壁碰撞
        const leftWall = {
          x: ROAD_LEFT,
          y: obs.y,
          width: obs.x - ROAD_LEFT,
          height: obs.height,
        };
        // 右侧墙壁碰撞
        const rightWall = {
          x: obs.x + obs.width,
          y: obs.y,
          width: ROAD_RIGHT - (obs.x + obs.width),
          height: obs.height,
        };

        if (this.rectsOverlap(ballBox, leftWall) || this.rectsOverlap(ballBox, rightWall)) {
          return true;
        }
      } else {
        // 方块类型：直接碰撞检测
        const obsBox = {
          x: obs.x + HITBOX_SHRINK,
          y: obs.y + HITBOX_SHRINK,
          width: obs.width - HITBOX_SHRINK * 2,
          height: obs.height - HITBOX_SHRINK * 2,
        };

        if (this.rectsOverlap(ballBox, obsBox)) {
          return true;
        }
      }
    }

    return false;
  }

  private rectsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  // ========== 私有方法：渲染 ==========

  private renderBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, BG_COLOR_TOP);
    gradient.addColorStop(1, BG_COLOR_BOTTOM);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  private renderStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this.stars) {
      ctx.fillStyle = STAR_COLOR;
      ctx.globalAlpha = star.brightness;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderRoad(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    // 跑道主体
    ctx.fillStyle = ROAD_COLOR;
    ctx.fillRect(ROAD_LEFT, 0, ROAD_WIDTH, CANVAS_HEIGHT);

    // 跑道边缘发光效果
    const edgeGradient = ctx.createLinearGradient(ROAD_LEFT - 10, 0, ROAD_LEFT + 10, 0);
    edgeGradient.addColorStop(0, 'transparent');
    edgeGradient.addColorStop(0.5, ROAD_EDGE_COLOR);
    edgeGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGradient;
    ctx.fillRect(ROAD_LEFT - 10, 0, 20, CANVAS_HEIGHT);

    const edgeGradient2 = ctx.createLinearGradient(ROAD_RIGHT - 10, 0, ROAD_RIGHT + 10, 0);
    edgeGradient2.addColorStop(0, 'transparent');
    edgeGradient2.addColorStop(0.5, ROAD_EDGE_COLOR);
    edgeGradient2.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGradient2;
    ctx.fillRect(ROAD_RIGHT - 10, 0, 20, CANVAS_HEIGHT);

    // 左右边线
    ctx.strokeStyle = ROAD_EDGE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ROAD_LEFT, 0);
    ctx.lineTo(ROAD_LEFT, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ROAD_RIGHT, 0);
    ctx.lineTo(ROAD_RIGHT, CANVAS_HEIGHT);
    ctx.stroke();
  }

  private renderLaneLines(ctx: CanvasRenderingContext2D, _w: number): void {
    ctx.strokeStyle = ROAD_LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([LANE_LINE_HEIGHT, LANE_LINE_GAP]);

    // 中线
    const centerX = CANVAS_WIDTH / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, -this.laneOffset);
    ctx.lineTo(centerX, CANVAS_HEIGHT);
    ctx.stroke();

    // 1/4 线
    const quarterX1 = ROAD_LEFT + ROAD_WIDTH * 0.25;
    ctx.beginPath();
    ctx.moveTo(quarterX1, -this.laneOffset);
    ctx.lineTo(quarterX1, CANVAS_HEIGHT);
    ctx.stroke();

    // 3/4 线
    const quarterX2 = ROAD_LEFT + ROAD_WIDTH * 0.75;
    ctx.beginPath();
    ctx.moveTo(quarterX2, -this.laneOffset);
    ctx.lineTo(quarterX2, CANVAS_HEIGHT);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  private renderObstacles(ctx: CanvasRenderingContext2D): void {
    for (const obs of this.obstacles) {
      switch (obs.type) {
        case ObstacleType.BLOCK:
          this.renderBlock(ctx, obs);
          break;
        case ObstacleType.GAP:
          this.renderGap(ctx, obs);
          break;
        case ObstacleType.MOVING_BLOCK:
          this.renderMovingBlock(ctx, obs);
          break;
      }
    }
  }

  private renderBlock(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    // 发光效果
    ctx.shadowColor = BLOCK_GLOW_COLOR;
    ctx.shadowBlur = 10;
    ctx.fillStyle = BLOCK_COLOR;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = '#ff6b7a';
    ctx.lineWidth = 1;
    ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
  }

  private renderGap(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    // 左侧墙壁
    ctx.shadowColor = BLOCK_GLOW_COLOR;
    ctx.shadowBlur = 8;
    ctx.fillStyle = BLOCK_COLOR;
    if (obs.x > ROAD_LEFT) {
      ctx.fillRect(ROAD_LEFT, obs.y, obs.x - ROAD_LEFT, obs.height);
    }
    // 右侧墙壁
    const rightStart = obs.x + obs.width;
    if (rightStart < ROAD_RIGHT) {
      ctx.fillRect(rightStart, obs.y, ROAD_RIGHT - rightStart, obs.height);
    }
    ctx.shadowBlur = 0;

    // 间隙指示器（绿色箭头标记安全区域）
    ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  }

  private renderMovingBlock(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    // 发光效果
    ctx.shadowColor = MOVING_BLOCK_GLOW_COLOR;
    ctx.shadowBlur = 12;
    ctx.fillStyle = MOVING_BLOCK_COLOR;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = '#ffb833';
    ctx.lineWidth = 1;
    ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

    // 移动方向指示器
    if (obs.direction) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      const arrow = obs.direction > 0 ? '→' : '←';
      ctx.fillText(arrow, obs.x + obs.width / 2, obs.y + obs.height / 2 + 3);
    }
  }

  private renderBall(ctx: CanvasRenderingContext2D): void {
    const { x, y, radius, rotation } = this.ball;

    // 球体光晕
    ctx.shadowColor = BALL_GLOW_COLOR;
    ctx.shadowBlur = 20;

    // 球体主体
    ctx.fillStyle = BALL_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 球体旋转纹理（十字线）
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;

    // 横线
    ctx.beginPath();
    ctx.moveTo(-radius * 0.7, 0);
    ctx.lineTo(radius * 0.7, 0);
    ctx.stroke();

    // 竖线
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.7);
    ctx.lineTo(0, radius * 0.7);
    ctx.stroke();

    ctx.restore();

    // 球体高光
    const highlightGradient = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // 分数
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.floor(this._score)}`, 15, 30);

    // 距离
    ctx.fillStyle = DISTANCE_COLOR;
    ctx.font = '12px monospace';
    ctx.fillText(`${Math.floor(this.distance)}m`, 15, 48);

    // 速度指示器
    ctx.fillStyle = SPEED_INDICATOR_COLOR;
    ctx.textAlign = 'right';
    ctx.font = '12px monospace';
    ctx.fillText(`SPD ${this.speed.toFixed(1)}`, w - 15, 30);

    // 等级
    ctx.fillStyle = SCORE_COLOR;
    ctx.fillText(`LV ${this._level}`, w - 15, 48);
  }
}
