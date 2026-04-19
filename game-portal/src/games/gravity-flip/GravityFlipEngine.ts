import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  CEILING_Y,
  PLAY_AREA_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_X,
  GRAVITY,
  FLIP_VELOCITY,
  MAX_VELOCITY,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  SPEED_INCREMENT_DISTANCE,
  MAX_SPEED,
  ObstacleType,
  SPIKE_WIDTH,
  SPIKE_HEIGHT,
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  MIN_OBSTACLE_INTERVAL,
  MAX_OBSTACLE_INTERVAL,
  MIN_OBSTACLE_GAP,
  HITBOX_SHRINK,
  PARTICLE_COUNT,
  PARTICLE_LIFETIME,
  PARTICLE_SPEED,
  PARTICLE_SIZE,
  SCORE_PER_DISTANCE,
  BG_COLOR,
  GROUND_COLOR,
  CEILING_COLOR,
  PLAYER_COLOR,
  PLAYER_GLOW_COLOR,
  SPIKE_COLOR,
  BLOCK_COLOR,
  PARTICLE_COLOR,
  SCORE_COLOR,
  GAME_OVER_COLOR,
  TRAIL_COLOR,
  GravityDirection,
  STAR_COUNT,
  STAR_MIN_SIZE,
  STAR_MAX_SIZE,
} from './constants';

// ========== 类型定义 ==========

/** 玩家对象 */
interface Player {
  x: number;
  y: number;
  velocity: number;
  gravityDir: GravityDirection;
}

/** 障碍物对象 */
interface Obstacle {
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  passed: boolean; // 是否已经被玩家通过（用于计分）
}

/** 粒子对象 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/** 背景星星 */
interface Star {
  x: number;
  y: number;
  size: number;
  speed: number; // 视差速度
  brightness: number;
}

/** 尾迹点 */
interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

// ========== Gravity Flip 引擎 ==========

export class GravityFlipEngine extends GameEngine {
  // 玩家
  private player: Player = this.createPlayer();

  // 障碍物列表
  private obstacles: Obstacle[] = [];

  // 粒子列表
  private particles: Particle[] = [];

  // 背景星星
  private stars: Star[] = [];

  // 尾迹
  private trail: TrailPoint[] = [];

  // 当前游戏速度（障碍物滚动速度）
  private speed: number = INITIAL_SPEED;

  // 障碍物生成计时器
  private obstacleTimer: number = 0;
  private nextObstacleInterval: number = MIN_OBSTACLE_INTERVAL;

  // 距离（用于计分和难度）
  private distance: number = 0;

  // 上次障碍物 X 位置（用于保证最小间距）
  private lastObstacleX: number = CANVAS_WIDTH;

  // 翻转次数
  private flipCount: number = 0;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.initStars();
  }

  protected onStart(): void {
    this.player = this.createPlayer();
    this.obstacles = [];
    this.particles = [];
    this.trail = [];
    this.speed = INITIAL_SPEED;
    this.obstacleTimer = 0;
    this.nextObstacleInterval = this.randomInterval();
    this.distance = 0;
    this.lastObstacleX = CANVAS_WIDTH;
    this.flipCount = 0;
    this.initStars();
  }

  protected onReset(): void {
    this.player = this.createPlayer();
    this.obstacles = [];
    this.particles = [];
    this.trail = [];
    this.speed = INITIAL_SPEED;
    this.obstacleTimer = 0;
    this.nextObstacleInterval = this.randomInterval();
    this.distance = 0;
    this.lastObstacleX = CANVAS_WIDTH;
    this.flipCount = 0;
    this.initStars();
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
    const dt = deltaTime / 16.667; // 标准化到 60fps

    // 更新玩家物理
    this.updatePlayer(dt);

    // 更新障碍物
    this.updateObstacles(dt);

    // 更新粒子
    this.updateParticles(deltaTime);

    // 更新尾迹
    this.updateTrail();

    // 更新星星（视差滚动）
    this.updateStars(dt);

    // 更新距离和计分
    this.distance += this.speed * dt;
    this.addScore(this.speed * dt * SCORE_PER_DISTANCE);

    // 难度递增
    this.updateDifficulty();

    // 碰撞检测
    if (this.checkCollision()) {
      this.gameOver();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 星星
    this.renderStars(ctx);

    // 地面和天花板
    this.renderBoundaries(ctx, w);

    // 尾迹
    this.renderTrail(ctx);

    // 障碍物
    this.renderObstacles(ctx);

    // 玩家
    this.renderPlayer(ctx);

    // 粒子
    this.renderParticles(ctx);

    // 分数
    this.renderScore(ctx, w);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') {
      // 游戏结束后按 R 重开
      if (key === 'r' || key === 'R') {
        this.reset();
        this.start();
      }
      return;
    }

    if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.flipGravity();
    }

    if (key === 'r' || key === 'R') {
      this.reset();
      this.start();
    }
  }

  handleKeyUp(_key: string): void {
    // 暂无需要处理的按键释放
  }

  getState(): Record<string, unknown> {
    return {
      playerY: this.player.y,
      playerVelocity: this.player.velocity,
      gravityDirection: this.player.gravityDir,
      speed: this.speed,
      distance: this.distance,
      obstacleCount: this.obstacles.length,
      flipCount: this.flipCount,
      score: this._score,
    };
  }

  // ========== 公共方法（供测试和外部调用） ==========

  /** 翻转重力（外部调用入口） */
  flip(): void {
    this.flipGravity();
  }

  /** 获取玩家状态 */
  getPlayerState(): { x: number; y: number; velocity: number; gravityDir: GravityDirection } {
    return {
      x: this.player.x,
      y: this.player.y,
      velocity: this.player.velocity,
      gravityDir: this.player.gravityDir,
    };
  }

  /** 获取当前速度 */
  getCurrentSpeed(): number {
    return this.speed;
  }

  /** 获取距离 */
  getDistance(): number {
    return this.distance;
  }

  /** 获取障碍物列表 */
  getObstacles(): Obstacle[] {
    return [...this.obstacles];
  }

  /** 获取粒子列表 */
  getParticles(): Particle[] {
    return [...this.particles];
  }

  /** 获取翻转次数 */
  getFlipCount(): number {
    return this.flipCount;
  }

  /** 获取重力方向 */
  getGravityDirection(): GravityDirection {
    return this.player.gravityDir;
  }

  // ========== 私有方法：初始化 ==========

  private createPlayer(): Player {
    return {
      x: PLAYER_X,
      y: GROUND_Y - PLAYER_HEIGHT,
      velocity: 0,
      gravityDir: GravityDirection.DOWN,
    };
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: STAR_MIN_SIZE + Math.random() * (STAR_MAX_SIZE - STAR_MIN_SIZE),
        speed: 0.2 + Math.random() * 0.8,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
  }

  // ========== 私有方法：更新 ==========

  private updatePlayer(dt: number): void {
    // 应用重力加速度
    const gravityForce = this.player.gravityDir === GravityDirection.DOWN ? GRAVITY : -GRAVITY;
    this.player.velocity += gravityForce * dt;

    // 限制最大速度
    this.player.velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, this.player.velocity));

    // 更新位置
    this.player.y += this.player.velocity * dt;

    // 边界检测 - 地面
    const groundLimit = GROUND_Y - PLAYER_HEIGHT;
    if (this.player.y >= groundLimit) {
      this.player.y = groundLimit;
      this.player.velocity = 0;
    }

    // 边界检测 - 天花板
    const ceilingLimit = CEILING_Y;
    if (this.player.y <= ceilingLimit) {
      this.player.y = ceilingLimit;
      this.player.velocity = 0;
    }
  }

  private updateObstacles(dt: number): void {
    // 生成新障碍物
    this.obstacleTimer += 16.667 * dt;
    if (this.obstacleTimer >= this.nextObstacleInterval) {
      // 检查最小间距
      const lastObs = this.obstacles[this.obstacles.length - 1];
      if (!lastObs || lastObs.x <= CANVAS_WIDTH - MIN_OBSTACLE_GAP) {
        this.obstacleTimer = 0;
        this.nextObstacleInterval = this.randomInterval();
        this.spawnObstacle();
      }
    }

    // 移动障碍物
    for (const obs of this.obstacles) {
      obs.x -= this.speed * dt;

      // 标记已通过的障碍物
      if (!obs.passed && obs.x + obs.width < this.player.x) {
        obs.passed = true;
      }
    }

    // 移除屏幕外的障碍物
    this.obstacles = this.obstacles.filter((obs) => obs.x + obs.width > -50);
  }

  private updateParticles(deltaTime: number): void {
    // 更新粒子生命周期
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= deltaTime;
    }

    // 移除过期粒子
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private updateTrail(): void {
    // 添加新的尾迹点
    this.trail.push({
      x: this.player.x + PLAYER_WIDTH / 2,
      y: this.player.y + PLAYER_HEIGHT / 2,
      alpha: 1,
    });

    // 淡出尾迹
    for (const t of this.trail) {
      t.alpha -= 0.05;
    }

    // 移除消失的尾迹
    this.trail = this.trail.filter((t) => t.alpha > 0);
  }

  private updateStars(dt: number): void {
    for (const star of this.stars) {
      star.x -= star.speed * this.speed * dt * 0.3;
      if (star.x < -5) {
        star.x = CANVAS_WIDTH + 5;
        star.y = Math.random() * CANVAS_HEIGHT;
      }
    }
  }

  private updateDifficulty(): void {
    const level = Math.floor(this.distance / SPEED_INCREMENT_DISTANCE) + 1;
    if (level !== this._level) {
      this.setLevel(level);
    }
    this.speed = Math.min(MAX_SPEED, INITIAL_SPEED + (level - 1) * SPEED_INCREMENT);
  }

  // ========== 私有方法：生成 ==========

  private spawnObstacle(): void {
    const rand = Math.random();
    let obstacle: Obstacle;

    if (rand < 0.3) {
      // 地面尖刺
      obstacle = {
        type: ObstacleType.GROUND_SPIKE,
        x: CANVAS_WIDTH + 10,
        y: GROUND_Y - SPIKE_HEIGHT,
        width: SPIKE_WIDTH,
        height: SPIKE_HEIGHT,
        passed: false,
      };
    } else if (rand < 0.6) {
      // 天花板尖刺
      obstacle = {
        type: ObstacleType.CEILING_SPIKE,
        x: CANVAS_WIDTH + 10,
        y: CEILING_Y,
        width: SPIKE_WIDTH,
        height: SPIKE_HEIGHT,
        passed: false,
      };
    } else if (rand < 0.85) {
      // 中间方块
      const midY = CEILING_Y + PLAY_AREA_HEIGHT / 2 - BLOCK_HEIGHT / 2;
      obstacle = {
        type: ObstacleType.MIDDLE_BLOCK,
        x: CANVAS_WIDTH + 10,
        y: midY + (Math.random() - 0.5) * 80, // 上下随机偏移
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        passed: false,
      };
    } else {
      // 双面尖刺
      obstacle = {
        type: ObstacleType.DOUBLE_SPIKE,
        x: CANVAS_WIDTH + 10,
        y: CEILING_Y, // y 代表天花板尖刺的位置
        width: SPIKE_WIDTH,
        height: SPIKE_HEIGHT * 2 + 60, // 整体高度（上下尖刺加中间空隙）
        passed: false,
      };
    }

    this.obstacles.push(obstacle);
    this.lastObstacleX = obstacle.x;
  }

  // ========== 私有方法：碰撞检测 ==========

  private checkCollision(): boolean {
    const playerBox = {
      x: this.player.x + HITBOX_SHRINK,
      y: this.player.y + HITBOX_SHRINK,
      width: PLAYER_WIDTH - HITBOX_SHRINK * 2,
      height: PLAYER_HEIGHT - HITBOX_SHRINK * 2,
    };

    for (const obs of this.obstacles) {
      if (obs.type === ObstacleType.DOUBLE_SPIKE) {
        // 双面尖刺：检测上下两个尖刺
        const topSpike = {
          x: obs.x + HITBOX_SHRINK,
          y: obs.y + HITBOX_SHRINK,
          width: obs.width - HITBOX_SHRINK * 2,
          height: SPIKE_HEIGHT - HITBOX_SHRINK * 2,
        };
        const bottomSpike = {
          x: obs.x + HITBOX_SHRINK,
          y: GROUND_Y - SPIKE_HEIGHT + HITBOX_SHRINK,
          width: obs.width - HITBOX_SHRINK * 2,
          height: SPIKE_HEIGHT - HITBOX_SHRINK * 2,
        };
        if (this.rectsOverlap(playerBox, topSpike) || this.rectsOverlap(playerBox, bottomSpike)) {
          return true;
        }
      } else {
        const obsBox = {
          x: obs.x + HITBOX_SHRINK,
          y: obs.y + HITBOX_SHRINK,
          width: obs.width - HITBOX_SHRINK * 2,
          height: obs.height - HITBOX_SHRINK * 2,
        };
        if (this.rectsOverlap(playerBox, obsBox)) {
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

  // ========== 私有方法：重力翻转 ==========

  private flipGravity(): void {
    if (this._status !== 'playing') return;

    // 切换重力方向
    this.player.gravityDir =
      this.player.gravityDir === GravityDirection.DOWN ? GravityDirection.UP : GravityDirection.DOWN;

    // 给予初始翻转速度
    this.player.velocity =
      this.player.gravityDir === GravityDirection.DOWN ? FLIP_VELOCITY : -FLIP_VELOCITY;

    // 增加翻转计数
    this.flipCount++;

    // 生成翻转粒子效果
    this.spawnFlipParticles();
  }

  // ========== 私有方法：粒子效果 ==========

  private spawnFlipParticles(): void {
    const cx = this.player.x + PLAYER_WIDTH / 2;
    const cy = this.player.y + PLAYER_HEIGHT / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
      const spd = PARTICLE_SPEED * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 10,
        y: cy + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: PARTICLE_LIFETIME * (0.5 + Math.random() * 0.5),
        maxLife: PARTICLE_LIFETIME,
        size: PARTICLE_SIZE * (0.5 + Math.random() * 0.5),
      });
    }
  }

  // ========== 私有方法：工具 ==========

  private randomInterval(): number {
    return MIN_OBSTACLE_INTERVAL + Math.random() * (MAX_OBSTACLE_INTERVAL - MIN_OBSTACLE_INTERVAL);
  }

  // ========== 私有方法：渲染 ==========

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const x = this.player.x;
    const y = this.player.y;
    const w = PLAYER_WIDTH;
    const h = PLAYER_HEIGHT;

    // 发光效果
    ctx.shadowColor = PLAYER_GLOW_COLOR;
    ctx.shadowBlur = 15;

    // 主体
    ctx.fillStyle = PLAYER_COLOR;
    ctx.fillRect(x, y, w, h);

    // 眼睛（根据重力方向调整）
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    const eyeY = this.player.gravityDir === GravityDirection.DOWN ? y + 8 : y + h - 16;
    ctx.fillRect(x + 8, eyeY, 5, 5);
    ctx.fillRect(x + 18, eyeY, 5, 5);

    // 瞳孔
    ctx.fillStyle = '#000000';
    const pupilY = eyeY + 1;
    ctx.fillRect(x + 10, pupilY, 2, 3);
    ctx.fillRect(x + 20, pupilY, 2, 3);

    // 重力方向指示箭头
    ctx.fillStyle = PLAYER_GLOW_COLOR;
    if (this.player.gravityDir === GravityDirection.DOWN) {
      // 向下箭头
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h + 5);
      ctx.lineTo(x + w / 2 - 5, y + h - 2);
      ctx.lineTo(x + w / 2 + 5, y + h - 2);
      ctx.closePath();
      ctx.fill();
    } else {
      // 向上箭头
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y - 5);
      ctx.lineTo(x + w / 2 - 5, y + 2);
      ctx.lineTo(x + w / 2 + 5, y + 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderObstacles(ctx: CanvasRenderingContext2D): void {
    for (const obs of this.obstacles) {
      switch (obs.type) {
        case ObstacleType.GROUND_SPIKE:
          this.renderSpike(ctx, obs.x, obs.y, obs.width, obs.height, false);
          break;
        case ObstacleType.CEILING_SPIKE:
          this.renderSpike(ctx, obs.x, obs.y, obs.width, obs.height, true);
          break;
        case ObstacleType.MIDDLE_BLOCK:
          this.renderBlock(ctx, obs.x, obs.y, obs.width, obs.height);
          break;
        case ObstacleType.DOUBLE_SPIKE:
          this.renderSpike(ctx, obs.x, CEILING_Y, obs.width, SPIKE_HEIGHT, true);
          this.renderSpike(ctx, obs.x, GROUND_Y - SPIKE_HEIGHT, obs.width, SPIKE_HEIGHT, false);
          break;
      }
    }
  }

  /** 渲染尖刺 */
  private renderSpike(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    isCeiling: boolean,
  ): void {
    ctx.fillStyle = SPIKE_COLOR;
    ctx.strokeStyle = '#cc8400';
    ctx.lineWidth = 1;

    if (isCeiling) {
      // 天花板尖刺 - 向下
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x + w, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // 地面尖刺 - 向上
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  /** 渲染中间方块 */
  private renderBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    // 方块主体
    ctx.fillStyle = BLOCK_COLOR;
    ctx.fillRect(x, y, w, h);

    // 边框
    ctx.strokeStyle = '#1565c0';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // 内部 X 标记
    ctx.strokeStyle = '#1565c080';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + w - 4, y + h - 4);
    ctx.moveTo(x + w - 4, y + 4);
    ctx.lineTo(x + 4, y + h - 4);
    ctx.stroke();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = PARTICLE_COLOR;
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private renderTrail(ctx: CanvasRenderingContext2D): void {
    for (const t of this.trail) {
      ctx.fillStyle = TRAIL_COLOR;
      ctx.globalAlpha = t.alpha * 0.3;
      ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  private renderStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this.stars) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = star.brightness;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  private renderBoundaries(ctx: CanvasRenderingContext2D, w: number): void {
    // 地面
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, GROUND_Y, w, CANVAS_HEIGHT - GROUND_Y);

    // 地面顶部线条
    ctx.strokeStyle = GROUND_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(w, GROUND_Y);
    ctx.stroke();

    // 天花板
    ctx.fillStyle = CEILING_COLOR;
    ctx.fillRect(0, 0, w, CEILING_Y);

    // 天花板底部线条
    ctx.beginPath();
    ctx.moveTo(0, CEILING_Y);
    ctx.lineTo(w, CEILING_Y);
    ctx.stroke();
  }

  private renderScore(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';

    const displayScore = Math.floor(this._score).toString().padStart(5, '0');
    ctx.fillText(displayScore, w - 20, 30);

    // 速度指示
    ctx.font = '12px monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText(`SPD ${this.speed.toFixed(1)}`, w - 20, 50);

    // 重力方向指示
    ctx.textAlign = 'left';
    ctx.font = '14px monospace';
    ctx.fillStyle = this.player.gravityDir === GravityDirection.DOWN ? '#2ed573' : '#ffa502';
    const arrow = this.player.gravityDir === GravityDirection.DOWN ? '↓' : '↑';
    ctx.fillText(`G ${arrow}`, 10, 25);
  }
}
