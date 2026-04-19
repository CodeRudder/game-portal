import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLANE_X,
  PLANE_WIDTH,
  PLANE_HEIGHT,
  PLANE_RADIUS,
  PLANE_SPEED,
  PLANE_MIN_Y,
  PLANE_MAX_Y_BUFFER,
  OBSTACLE_WIDTH,
  OBSTACLE_GAP,
  OBSTACLE_SPEED,
  OBSTACLE_SPAWN_INTERVAL,
  OBSTACLE_MIN_HEIGHT,
  OBSTACLE_CAP_HEIGHT,
  OBSTACLE_CAP_OVERHANG,
  OBSTACLE_COLOR,
  OBSTACLE_BORDER_COLOR,
  OBSTACLE_HIGHLIGHT,
  STAR_SIZE,
  STAR_POINTS,
  STAR_SPAWN_CHANCE,
  STAR_COLLECT_RADIUS,
  SKY_TOP,
  SKY_BOTTOM,
  GROUND_HEIGHT,
  GROUND_COLOR,
  GROUND_DARK,
  GROUND_LINE_COLOR,
  PLANE_BODY_COLOR,
  PLANE_WING_COLOR,
  PLANE_WINDOW_COLOR,
  PLANE_TAIL_COLOR,
  PLANE_ENGINE_COLOR,
  STAR_COLOR,
  STAR_GLOW_COLOR,
  CLOUD_COLOR,
  SCORE_COLOR,
  TRAIL_COLOR,
  SCORE_PER_OBSTACLE,
  LEVEL_UP_SCORE,
  SPEED_INCREMENT,
  GAP_DECREMENT,
  MIN_GAP,
  MAX_SPEED,
  EXPLOSION_DURATION,
  EXPLOSION_PARTICLES,
} from './constants';

// ========== 类型定义 ==========

interface Plane {
  x: number;
  y: number;
  enginePhase: number; // 引擎火焰动画帧
  tilt: number; // 飞机倾斜角度
}

interface Obstacle {
  x: number;
  topHeight: number; // 上柱子高度
  scored: boolean; // 是否已计分
}

interface Star {
  x: number;
  y: number;
  collected: boolean;
  sparkle: number; // 闪烁动画计数器
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Cloud {
  x: number;
  y: number;
  size: number;
  speed: number;
}

// ========== 飞行小鸟 Flappy Plane 引擎 ==========

export class FlappyPlaneEngine extends GameEngine {
  // 飞机状态
  private plane: Plane = {
    x: PLANE_X,
    y: CANVAS_HEIGHT / 2,
    enginePhase: 0,
    tilt: 0,
  };

  // 障碍物列表
  private obstacles: Obstacle[] = [];

  // 星星列表
  private stars: Star[] = [];

  // 爆炸粒子
  private particles: Particle[] = [];

  // 背景云朵
  private clouds: Cloud[] = [];

  // 尾迹
  private trail: { x: number; y: number; alpha: number }[] = [];

  // 计时器
  private obstacleTimer: number = 0;
  private engineTimer: number = 0;
  private explosionTimer: number = 0;
  private starSparkleTimer: number = 0;

  // 当前难度参数
  private currentSpeed: number = OBSTACLE_SPEED;
  private currentGap: number = OBSTACLE_GAP;

  // 输入状态
  private keysPressed: Set<string> = new Set();

  // 星星收集计数
  private starsCollected: number = 0;

  // 地面偏移（滚动效果）
  private groundOffset: number = 0;

  // 是否处于爆炸动画中
  private isExploding: boolean = false;

  // ========== 生命周期 ==========

  protected onInit(): void {
    // 初始化云朵
    this.initClouds();
  }

  protected onStart(): void {
    this.plane = {
      x: PLANE_X,
      y: CANVAS_HEIGHT / 2,
      enginePhase: 0,
      tilt: 0,
    };
    this.obstacles = [];
    this.stars = [];
    this.particles = [];
    this.trail = [];
    this.obstacleTimer = 0;
    this.engineTimer = 0;
    this.explosionTimer = 0;
    this.starSparkleTimer = 0;
    this.currentSpeed = OBSTACLE_SPEED;
    this.currentGap = OBSTACLE_GAP;
    this.groundOffset = 0;
    this.keysPressed.clear();
    this.starsCollected = 0;
    this.isExploding = false;
    this.initClouds();
  }

  protected onReset(): void {
    this.plane = {
      x: PLANE_X,
      y: CANVAS_HEIGHT / 2,
      enginePhase: 0,
      tilt: 0,
    };
    this.obstacles = [];
    this.stars = [];
    this.particles = [];
    this.trail = [];
    this.obstacleTimer = 0;
    this.engineTimer = 0;
    this.explosionTimer = 0;
    this.starSparkleTimer = 0;
    this.groundOffset = 0;
    this.keysPressed.clear();
    this.starsCollected = 0;
    this.isExploding = false;
  }

  protected onGameOver(): void {
    this.isExploding = false;
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 16.667; // 标准化到 60fps

    // 如果正在爆炸动画，只更新粒子
    if (this.isExploding) {
      this.updateParticles(dt);
      this.explosionTimer += deltaTime;
      if (this.explosionTimer >= EXPLOSION_DURATION) {
        this.gameOver();
      }
      return;
    }

    // 更新飞机位置
    this.updatePlane(dt);

    // 更新障碍物
    this.updateObstacles(dt);

    // 更新星星
    this.updateStars(dt);

    // 更新尾迹
    this.updateTrail();

    // 更新地面滚动
    this.groundOffset = (this.groundOffset + this.currentSpeed * dt) % 24;

    // 更新引擎火焰动画
    this.engineTimer += deltaTime;
    if (this.engineTimer > 80) {
      this.engineTimer = 0;
      this.plane.enginePhase = (this.plane.enginePhase + 1) % 4;
    }

    // 更新星星闪烁
    this.starSparkleTimer += deltaTime;

    // 更新云朵
    this.updateClouds(dt);

    // 碰撞检测
    if (this.checkCollision()) {
      this.startExplosion();
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

    // 云朵
    this.clouds.forEach((cloud) => this.drawCloud(ctx, cloud));

    // 障碍物
    this.obstacles.forEach((obs) => this.drawObstacle(ctx, obs));

    // 星星
    this.stars.forEach((star) => {
      if (!star.collected) this.drawStar(ctx, star);
    });

    // 尾迹
    this.drawTrail(ctx);

    // 地面
    this.drawGround(ctx, w, h);

    // 飞机（爆炸时不画飞机）
    if (!this.isExploding) {
      this.drawPlane(ctx);
    }

    // 爆炸粒子
    this.particles.forEach((p) => this.drawParticle(ctx, p));

    // HUD 分数
    this.drawHUD(ctx, w);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    this.keysPressed.add(key);
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.keysPressed.add('up');
    }
    if (key === 'ArrowDown' || key === 's' || key === 'S') {
      this.keysPressed.add('down');
    }
  }

  handleKeyUp(key: string): void {
    this.keysPressed.delete(key);
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.keysPressed.delete('up');
    }
    if (key === 'ArrowDown' || key === 's' || key === 'S') {
      this.keysPressed.delete('down');
    }
  }

  getState(): Record<string, unknown> {
    return {
      planeY: this.plane.y,
      planeTilt: this.plane.tilt,
      obstacleCount: this.obstacles.length,
      starCount: this.stars.filter((s) => !s.collected).length,
      starsCollected: this.starsCollected,
      currentSpeed: this.currentSpeed,
      currentGap: this.currentGap,
      score: this._score,
      level: this._level,
      isExploding: this.isExploding,
    };
  }

  // ========== 公共方法 ==========

  /** 获取已收集星星数 */
  getStarsCollected(): number {
    return this.starsCollected;
  }

  /** 获取当前速度 */
  getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  /** 获取当前间隙 */
  getCurrentGap(): number {
    return this.currentGap;
  }

  // ========== 私有方法：更新逻辑 ==========

  private updatePlane(dt: number): void {
    const movingUp = this.keysPressed.has('up');
    const movingDown = this.keysPressed.has('down');

    if (movingUp && !movingDown) {
      this.plane.y -= PLANE_SPEED * dt;
      this.plane.tilt = Math.max(-0.3, this.plane.tilt - 0.05 * dt);
    } else if (movingDown && !movingUp) {
      this.plane.y += PLANE_SPEED * dt;
      this.plane.tilt = Math.min(0.3, this.plane.tilt + 0.05 * dt);
    } else {
      // 回正
      if (this.plane.tilt > 0) {
        this.plane.tilt = Math.max(0, this.plane.tilt - 0.03 * dt);
      } else if (this.plane.tilt < 0) {
        this.plane.tilt = Math.min(0, this.plane.tilt + 0.03 * dt);
      }
    }

    // 边界限制
    const minY = PLANE_MIN_Y + PLANE_RADIUS;
    const maxY = CANVAS_HEIGHT - GROUND_HEIGHT - PLANE_MAX_Y_BUFFER - PLANE_RADIUS;
    this.plane.y = Math.max(minY, Math.min(maxY, this.plane.y));
  }

  private updateObstacles(dt: number): void {
    // 生成新障碍物
    this.obstacleTimer += 16.667 * dt;
    if (this.obstacleTimer >= OBSTACLE_SPAWN_INTERVAL) {
      this.obstacleTimer = 0;
      this.spawnObstacle();
    }

    // 移动障碍物
    this.obstacles.forEach((obs) => {
      obs.x -= this.currentSpeed * dt;
    });

    // 计分：飞机通过障碍物
    this.obstacles.forEach((obs) => {
      if (!obs.scored && obs.x + OBSTACLE_WIDTH < this.plane.x) {
        obs.scored = true;
        this.addScore(SCORE_PER_OBSTACLE);

        // 升级检查
        const newLevel = Math.floor(this._score / LEVEL_UP_SCORE) + 1;
        if (newLevel > this._level) {
          this.setLevel(newLevel);
          this.increaseDifficulty();
        }
      }
    });

    // 移除屏幕外障碍物
    this.obstacles = this.obstacles.filter((obs) => obs.x + OBSTACLE_WIDTH > -10);
  }

  private updateStars(dt: number): void {
    // 移动星星
    this.stars.forEach((star) => {
      if (!star.collected) {
        star.x -= this.currentSpeed * dt;
        star.sparkle += dt;
      }
    });

    // 收集检测
    this.stars.forEach((star) => {
      if (!star.collected) {
        const dx = star.x - this.plane.x;
        const dy = star.y - this.plane.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < STAR_COLLECT_RADIUS) {
          star.collected = true;
          this.starsCollected++;
          this.addScore(STAR_POINTS);
        }
      }
    });

    // 移除屏幕外和已收集的星星
    this.stars = this.stars.filter((star) => !star.collected && star.x > -STAR_SIZE);
  }

  private updateTrail(): void {
    // 添加新的尾迹点
    this.trail.push({
      x: this.plane.x - PLANE_WIDTH / 2,
      y: this.plane.y,
      alpha: 1,
    });

    // 衰减和清理
    this.trail.forEach((t) => {
      t.alpha -= 0.05;
      t.x -= this.currentSpeed * 0.5;
    });
    this.trail = this.trail.filter((t) => t.alpha > 0);
  }

  private updateParticles(dt: number): void {
    this.particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.1 * dt; // 重力
      p.life -= dt;
    });
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private updateClouds(dt: number): void {
    this.clouds.forEach((cloud) => {
      cloud.x -= cloud.speed * dt;
      if (cloud.x + cloud.size < 0) {
        cloud.x = CANVAS_WIDTH + cloud.size;
        cloud.y = Math.random() * (CANVAS_HEIGHT - GROUND_HEIGHT - 100) + 30;
      }
    });
  }

  private spawnObstacle(): void {
    const playAreaHeight = CANVAS_HEIGHT - GROUND_HEIGHT;
    const gap = this.currentGap;
    const minTop = OBSTACLE_MIN_HEIGHT;
    const maxTop = playAreaHeight - gap - OBSTACLE_MIN_HEIGHT;
    const topHeight = Math.random() * (maxTop - minTop) + minTop;

    this.obstacles.push({
      x: CANVAS_WIDTH + 10,
      topHeight,
      scored: false,
    });

    // 概率生成星星在间隙中
    if (Math.random() < STAR_SPAWN_CHANCE) {
      const starY = topHeight + gap / 2;
      this.stars.push({
        x: CANVAS_WIDTH + 10 + OBSTACLE_WIDTH / 2,
        y: starY,
        collected: false,
        sparkle: 0,
      });
    }
  }

  private increaseDifficulty(): void {
    this.currentSpeed = Math.min(
      MAX_SPEED,
      OBSTACLE_SPEED + (this._level - 1) * SPEED_INCREMENT
    );
    this.currentGap = Math.max(MIN_GAP, OBSTACLE_GAP - (this._level - 1) * GAP_DECREMENT);
  }

  // ========== 碰撞检测 ==========

  private checkCollision(): boolean {
    const px = this.plane.x;
    const py = this.plane.y;
    const pr = PLANE_RADIUS;

    // 地面碰撞
    if (py + pr >= CANVAS_HEIGHT - GROUND_HEIGHT) {
      return true;
    }

    // 天花板碰撞
    if (py - pr <= 0) {
      return true;
    }

    // 障碍物碰撞（圆形 vs 矩形简化检测）
    for (const obs of this.obstacles) {
      const obsLeft = obs.x;
      const obsRight = obs.x + OBSTACLE_WIDTH;
      const gapTop = obs.topHeight;
      const gapBottom = obs.topHeight + this.currentGap;

      // 飞机水平范围与障碍物重叠
      if (px + pr > obsLeft && px - pr < obsRight) {
        // 碰上柱子或下柱子
        if (py - pr < gapTop || py + pr > gapBottom) {
          return true;
        }
      }
    }

    return false;
  }

  // ========== 爆炸效果 ==========

  private startExplosion(): void {
    this.isExploding = true;
    this.explosionTimer = 0;

    // 生成爆炸粒子
    const colors = ['#ff6b6b', '#ffd93d', '#ff9f43', '#e8e8e8', '#a8a8d0'];
    for (let i = 0; i < EXPLOSION_PARTICLES; i++) {
      const angle = (Math.PI * 2 * i) / EXPLOSION_PARTICLES;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x: this.plane.x,
        y: this.plane.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 20 + Math.random() * 15,
        maxLife: 35,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4,
      });
    }
  }

  // ========== 渲染辅助 ==========

  private drawPlane(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.plane.x, this.plane.y);
    ctx.rotate(this.plane.tilt);

    // 引擎火焰
    this.drawEngineFlame(ctx);

    // 机身
    ctx.fillStyle = PLANE_BODY_COLOR;
    ctx.beginPath();
    ctx.ellipse(0, 0, PLANE_WIDTH / 2, PLANE_HEIGHT / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b0b0d0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 上机翼
    ctx.fillStyle = PLANE_WING_COLOR;
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.lineTo(4, -2);
    ctx.lineTo(0, -PLANE_HEIGHT / 2 - 8);
    ctx.closePath();
    ctx.fill();

    // 下机翼
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(4, 2);
    ctx.lineTo(0, PLANE_HEIGHT / 2 + 8);
    ctx.closePath();
    ctx.fill();

    // 尾翼
    ctx.fillStyle = PLANE_TAIL_COLOR;
    ctx.beginPath();
    ctx.moveTo(-PLANE_WIDTH / 2, -2);
    ctx.lineTo(-PLANE_WIDTH / 2 - 6, -8);
    ctx.lineTo(-PLANE_WIDTH / 2 + 2, -2);
    ctx.closePath();
    ctx.fill();

    // 驾驶舱窗户
    ctx.fillStyle = PLANE_WINDOW_COLOR;
    ctx.beginPath();
    ctx.ellipse(8, -2, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3dbdb5';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // 窗户高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(9, -3, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawEngineFlame(ctx: CanvasRenderingContext2D): void {
    const flameLength = 6 + this.plane.enginePhase * 3;
    const flameWidth = 4 + this.plane.enginePhase;

    ctx.fillStyle = PLANE_ENGINE_COLOR;
    ctx.beginPath();
    ctx.moveTo(-PLANE_WIDTH / 2, -flameWidth / 2);
    ctx.lineTo(-PLANE_WIDTH / 2 - flameLength, 0);
    ctx.lineTo(-PLANE_WIDTH / 2, flameWidth / 2);
    ctx.closePath();
    ctx.fill();

    // 内焰
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-PLANE_WIDTH / 2, -flameWidth / 4);
    ctx.lineTo(-PLANE_WIDTH / 2 - flameLength * 0.5, 0);
    ctx.lineTo(-PLANE_WIDTH / 2, flameWidth / 4);
    ctx.closePath();
    ctx.fill();
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    const playAreaHeight = CANVAS_HEIGHT - GROUND_HEIGHT;
    const gap = this.currentGap;

    // 上柱子
    this.drawPillarSegment(ctx, obs.x, 0, OBSTACLE_WIDTH, obs.topHeight, true);

    // 下柱子
    const bottomTop = obs.topHeight + gap;
    const bottomHeight = playAreaHeight - bottomTop;
    this.drawPillarSegment(ctx, obs.x, bottomTop, OBSTACLE_WIDTH, bottomHeight, false);
  }

  private drawPillarSegment(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    isTop: boolean
  ): void {
    if (h <= 0) return;

    // 柱子主体
    ctx.fillStyle = OBSTACLE_COLOR;
    ctx.fillRect(x, y, w, h);

    // 边框
    ctx.strokeStyle = OBSTACLE_BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // 高光
    ctx.fillStyle = OBSTACLE_HIGHLIGHT;
    ctx.fillRect(x + 4, y, 6, h);

    // 暗面
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(x + w - 10, y, 6, h);

    // 柱帽
    const capY = isTop ? y + h - OBSTACLE_CAP_HEIGHT : y;
    ctx.fillStyle = OBSTACLE_COLOR;
    ctx.fillRect(
      x - OBSTACLE_CAP_OVERHANG,
      capY,
      w + OBSTACLE_CAP_OVERHANG * 2,
      OBSTACLE_CAP_HEIGHT
    );
    ctx.strokeStyle = OBSTACLE_BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      x - OBSTACLE_CAP_OVERHANG,
      capY,
      w + OBSTACLE_CAP_OVERHANG * 2,
      OBSTACLE_CAP_HEIGHT
    );

    // 帽子高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(
      x - OBSTACLE_CAP_OVERHANG + 3,
      capY + 2,
      6,
      OBSTACLE_CAP_HEIGHT - 4
    );
  }

  private drawStar(ctx: CanvasRenderingContext2D, star: Star): void {
    ctx.save();
    ctx.translate(star.x, star.y);

    // 光晕
    const glowSize = STAR_SIZE + 4 + Math.sin(star.sparkle * 0.1) * 3;
    ctx.fillStyle = STAR_GLOW_COLOR;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
    ctx.fill();

    // 星星形状
    ctx.fillStyle = STAR_COLOR;
    ctx.beginPath();
    const spikes = 5;
    const outerRadius = STAR_SIZE / 2;
    const innerRadius = outerRadius * 0.4;
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const sx = Math.cos(angle) * radius;
      const sy = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();

    // 星星中心高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawTrail(ctx: CanvasRenderingContext2D): void {
    this.trail.forEach((t) => {
      ctx.fillStyle = TRAIL_COLOR.replace('0.4', String(t.alpha * 0.4));
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
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

    // 顶部线条
    ctx.fillStyle = GROUND_LINE_COLOR;
    ctx.fillRect(0, groundY, w, 2);
  }

  private drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud): void {
    ctx.fillStyle = CLOUD_COLOR;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.size * 0.5, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 0.35, cloud.y - cloud.size * 0.15, cloud.size * 0.4, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.size * 0.7, cloud.y, cloud.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // 分数显示
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(this._score), w / 2, 36);

    // 等级显示
    ctx.fillStyle = '#a8a8d0';
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`LV ${this._level}`, 12, 24);

    // 星星收集数
    if (this.starsCollected > 0) {
      ctx.fillStyle = STAR_COLOR;
      ctx.textAlign = 'right';
      ctx.fillText(`⭐ ${this.starsCollected}`, w - 12, 24);
    }
  }

  // ========== 初始化 ==========

  private initClouds(): void {
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (CANVAS_HEIGHT - GROUND_HEIGHT - 100) + 30,
        size: 20 + Math.random() * 40,
        speed: 0.3 + Math.random() * 0.5,
      });
    }
  }
}
