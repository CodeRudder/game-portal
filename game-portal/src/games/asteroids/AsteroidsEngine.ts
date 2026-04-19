import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  SHIP_SIZE, SHIP_THRUST, SHIP_ROTATION_SPEED, SHIP_MAX_SPEED,
  SHIP_FRICTION, SHIP_COLOR, SHIP_INVINCIBLE_TIME,
  BULLET_SPEED, BULLET_LIFETIME, BULLET_COOLDOWN, BULLET_RADIUS, BULLET_COLOR,
  ASTEROID_SIZE_LARGE, ASTEROID_SIZE_MEDIUM, ASTEROID_SIZE_SMALL,
  ASTEROID_SPEED_BASE, ASTEROID_SPEED_VARIANCE, ASTEROID_COLOR,
  ASTEROID_ROTATION_SPEED,
  INITIAL_ASTEROID_COUNT, ASTEROIDS_PER_WAVE, MAX_ASTEROID_WAVE,
  SCORE_LARGE, SCORE_MEDIUM, SCORE_SMALL,
  INITIAL_LIVES,
  BG_COLOR, HUD_COLOR,
  PARTICLE_COUNT, PARTICLE_LIFETIME, PARTICLE_SPEED,
} from './constants';

// ============================================================
// 类型定义
// ============================================================

interface Vector2 {
  x: number;
  y: number;
}

interface Ship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;    // 弧度，0 = 朝上
  thrusting: boolean;
  invincibleTimer: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
}

type AsteroidSize = 'large' | 'medium' | 'small';

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: AsteroidSize;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  vertices: number[];  // 不规则形状的顶点偏移
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
}

// ============================================================
// 工具函数
// ============================================================

/** 两点之间距离 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 屏幕包裹 */
function wrap(value: number, max: number): number {
  if (value < 0) return value + max;
  if (value >= max) return value - max;
  return value;
}

/** 生成不规则小行星顶点偏移 */
function generateVertices(count: number = 8): number[] {
  const vertices: number[] = [];
  for (let i = 0; i < count; i++) {
    vertices.push(0.7 + Math.random() * 0.6); // 0.7 ~ 1.3
  }
  return vertices;
}

/** 获取小行星半径 */
function getAsteroidRadius(size: AsteroidSize): number {
  switch (size) {
    case 'large': return ASTEROID_SIZE_LARGE;
    case 'medium': return ASTEROID_SIZE_MEDIUM;
    case 'small': return ASTEROID_SIZE_SMALL;
  }
}

/** 获取小行星得分 */
function getAsteroidScore(size: AsteroidSize): number {
  switch (size) {
    case 'large': return SCORE_LARGE;
    case 'medium': return SCORE_MEDIUM;
    case 'small': return SCORE_SMALL;
  }
}

/** 随机范围 */
function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ============================================================
// AsteroidsEngine
// ============================================================

export class AsteroidsEngine extends GameEngine {
  // 飞船
  private _ship: Ship | null = null;

  // 子弹列表
  private _bullets: Bullet[] = [];

  // 小行星列表
  private _asteroids: Asteroid[] = [];

  // 粒子列表
  private _particles: Particle[] = [];

  // 生命
  private _lives: number = INITIAL_LIVES;

  // 输入状态
  private _leftPressed: boolean = false;
  private _rightPressed: boolean = false;
  private _upPressed: boolean = false;
  private _spacePressed: boolean = false;

  // 射击冷却
  private _shootCooldown: number = 0;

  // 波次
  private _wave: number = 0;

  // 是否正在等待新一波
  private _waveDelay: number = 0;

  // ========== Public Getters ==========

  get lives(): number { return this._lives; }
  get wave(): number { return this._wave; }
  get shipX(): number { return this._ship?.x ?? CANVAS_WIDTH / 2; }
  get shipY(): number { return this._ship?.y ?? CANVAS_HEIGHT / 2; }
  get shipAngle(): number { return this._ship?.angle ?? 0; }
  get bulletCount(): number { return this._bullets.length; }
  get asteroidCount(): number { return this._asteroids.length; }
  get particleCount(): number { return this._particles.length; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._ship = null;
    this._bullets = [];
    this._asteroids = [];
    this._particles = [];
    this._lives = INITIAL_LIVES;
    this._wave = 0;
    this._shootCooldown = 0;
    this._waveDelay = 0;
    this._leftPressed = false;
    this._rightPressed = false;
    this._upPressed = false;
    this._spacePressed = false;
  }

  protected onStart(): void {
    this._lives = INITIAL_LIVES;
    this._wave = 0;
    this._bullets = [];
    this._asteroids = [];
    this._particles = [];
    this._shootCooldown = 0;
    this._waveDelay = 0;
    this._leftPressed = false;
    this._rightPressed = false;
    this._upPressed = false;
    this._spacePressed = false;
    this.resetShip();
    this.spawnWave();
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000; // 转秒

    // 波次延迟
    if (this._waveDelay > 0) {
      this._waveDelay -= deltaTime;
      if (this._waveDelay <= 0) {
        this._waveDelay = 0;
        this.spawnWave();
      }
      // 延迟期间仍更新粒子
      this.updateParticles(dt);
      return;
    }

    // 更新飞船
    this.updateShip(dt);

    // 更新子弹
    this.updateBullets(dt);

    // 更新小行星
    this.updateAsteroids(dt);

    // 更新粒子
    this.updateParticles(dt);

    // 射击冷却
    if (this._shootCooldown > 0) {
      this._shootCooldown -= deltaTime;
    }

    // 射击
    if (this._spacePressed && this._shootCooldown <= 0) {
      this.shoot();
    }

    // 碰撞检测
    this.checkBulletAsteroidCollisions();
    this.checkShipAsteroidCollisions();

    // 检查波次是否清完
    this.checkWaveComplete();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 绘制粒子
    this._particles.forEach(p => {
      const alpha = Math.max(0, p.lifetime / p.maxLifetime);
      ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 绘制小行星
    this._asteroids.forEach(a => {
      ctx.strokeStyle = ASTEROID_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const vertCount = a.vertices.length;
      for (let i = 0; i <= vertCount; i++) {
        const idx = i % vertCount;
        const angle = a.rotation + (idx / vertCount) * Math.PI * 2;
        const r = a.radius * a.vertices[idx];
        const px = a.x + r * Math.cos(angle);
        const py = a.y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    });

    // 绘制子弹
    ctx.fillStyle = BULLET_COLOR;
    this._bullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    // 绘制飞船
    if (this._ship) {
      const ship = this._ship;
      // 无敌闪烁
      if (ship.invincibleTimer > 0 && Math.floor(ship.invincibleTimer / 100) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }
      ctx.strokeStyle = SHIP_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // 飞船三角形（朝上时 angle=0）
      const nose = {
        x: ship.x + SHIP_SIZE * Math.cos(ship.angle - Math.PI / 2),
        y: ship.y + SHIP_SIZE * Math.sin(ship.angle - Math.PI / 2),
      };
      const leftWing = {
        x: ship.x + SHIP_SIZE * Math.cos(ship.angle + Math.PI * 0.75),
        y: ship.y + SHIP_SIZE * Math.sin(ship.angle + Math.PI * 0.75),
      };
      const rightWing = {
        x: ship.x + SHIP_SIZE * Math.cos(ship.angle - Math.PI * 0.75),
        y: ship.y + SHIP_SIZE * Math.sin(ship.angle - Math.PI * 0.75),
      };
      ctx.moveTo(nose.x, nose.y);
      ctx.lineTo(leftWing.x, leftWing.y);
      ctx.lineTo(rightWing.x, rightWing.y);
      ctx.closePath();
      ctx.stroke();

      // 推进火焰
      if (ship.thrusting) {
        const flameLength = SHIP_SIZE * 0.6;
        const tail = {
          x: ship.x + (SHIP_SIZE * 0.5) * Math.cos(ship.angle + Math.PI / 2),
          y: ship.y + (SHIP_SIZE * 0.5) * Math.sin(ship.angle + Math.PI / 2),
        };
        const flameTip = {
          x: tail.x + flameLength * Math.cos(ship.angle + Math.PI / 2),
          y: tail.y + flameLength * Math.sin(ship.angle + Math.PI / 2),
        };
        ctx.strokeStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(leftWing.x * 0.6 + tail.x * 0.4, leftWing.y * 0.6 + tail.y * 0.4);
        ctx.lineTo(flameTip.x, flameTip.y);
        ctx.lineTo(rightWing.x * 0.6 + tail.x * 0.4, rightWing.y * 0.6 + tail.y * 0.4);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    }

    // HUD - 分数
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this._score}`, w / 2, 30);

    // HUD - 生命
    ctx.textAlign = 'left';
    ctx.font = '16px monospace';
    for (let i = 0; i < this._lives; i++) {
      const lx = 20 + i * 25;
      const ly = 20;
      ctx.strokeStyle = SHIP_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx, ly - 8);
      ctx.lineTo(lx - 7, ly + 6);
      ctx.lineTo(lx + 7, ly + 6);
      ctx.closePath();
      ctx.stroke();
    }

    // HUD - 波次
    ctx.fillStyle = HUD_COLOR;
    ctx.textAlign = 'right';
    ctx.font = '16px monospace';
    ctx.fillText(`WAVE ${this._wave}`, w - 20, 25);
    ctx.textAlign = 'left';

    // 游戏结束
    if (this._status === 'gameover') {
      ctx.fillStyle = '#ef5350';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', w / 2, h / 2);
      ctx.font = '16px monospace';
      ctx.fillStyle = HUD_COLOR;
      ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 40);
      ctx.fillText('Press Space to Restart', w / 2, h / 2 + 70);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this._ship = null;
    this._bullets = [];
    this._asteroids = [];
    this._particles = [];
    this._lives = INITIAL_LIVES;
    this._wave = 0;
    this._shootCooldown = 0;
    this._waveDelay = 0;
    this._leftPressed = false;
    this._rightPressed = false;
    this._upPressed = false;
    this._spacePressed = false;
  }

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    if (key === 'ArrowLeft') this._leftPressed = true;
    if (key === 'ArrowRight') this._rightPressed = true;
    if (key === 'ArrowUp') this._upPressed = true;
    if (key === ' ') this._spacePressed = true;

    // Space 启动/重启
    if (key === ' ') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      }
    }
  }

  handleKeyUp(key: string): void {
    if (key === 'ArrowLeft') this._leftPressed = false;
    if (key === 'ArrowRight') this._rightPressed = false;
    if (key === 'ArrowUp') this._upPressed = false;
    if (key === ' ') this._spacePressed = false;
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      lives: this._lives,
      wave: this._wave,
      shipX: this.shipX,
      shipY: this.shipY,
      shipAngle: this.shipAngle,
      bulletCount: this._bullets.length,
      asteroidCount: this._asteroids.length,
      particleCount: this._particles.length,
    };
  }

  // ========== Private Methods ==========

  /** 重置飞船到屏幕中央 */
  private resetShip(): void {
    this._ship = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: 0,
      vy: 0,
      angle: 0,
      thrusting: false,
      invincibleTimer: SHIP_INVINCIBLE_TIME,
    };
  }

  /** 生成一波小行星 */
  private spawnWave(): void {
    this._wave++;
    const count = Math.min(
      INITIAL_ASTEROID_COUNT + (this._wave - 1) * ASTEROIDS_PER_WAVE,
      MAX_ASTEROID_WAVE
    );
    for (let i = 0; i < count; i++) {
      this.spawnAsteroid('large');
    }
  }

  /** 生成单个小行星 */
  private spawnAsteroid(size: AsteroidSize, x?: number, y?: number): void {
    const radius = getAsteroidRadius(size);
    let ax: number;
    let ay: number;

    if (x !== undefined && y !== undefined) {
      ax = x;
      ay = y;
    } else {
      // 在屏幕边缘随机生成，远离飞船
      do {
        ax = Math.random() * CANVAS_WIDTH;
        ay = Math.random() * CANVAS_HEIGHT;
      } while (
        this._ship &&
        distance(ax, ay, this._ship.x, this._ship.y) < ASTEROID_SIZE_LARGE * 3
      );
    }

    const speed = ASTEROID_SPEED_BASE + Math.random() * ASTEROID_SPEED_VARIANCE;
    const angle = Math.random() * Math.PI * 2;
    const rotSpeed = (Math.random() - 0.5) * 2 * ASTEROID_ROTATION_SPEED;

    this._asteroids.push({
      x: ax,
      y: ay,
      vx: speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      size,
      radius,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: rotSpeed,
      vertices: generateVertices(),
    });
  }

  /** 更新飞船 */
  private updateShip(dt: number): void {
    if (!this._ship) return;
    const ship = this._ship;

    // 旋转
    if (this._leftPressed) {
      ship.angle -= SHIP_ROTATION_SPEED * dt;
    }
    if (this._rightPressed) {
      ship.angle += SHIP_ROTATION_SPEED * dt;
    }

    // 推进
    ship.thrusting = this._upPressed;
    if (this._upPressed) {
      // angle=0 朝上，推进方向为 angle - PI/2 的反方向（即 angle + PI/2）
      // 实际上飞船朝 angle 方向前进，nose 在 angle - PI/2
      // 推力方向应该是飞船朝向（nose 方向）
      const thrustAngle = ship.angle - Math.PI / 2;
      ship.vx += Math.cos(thrustAngle) * SHIP_THRUST * dt;
      ship.vy += Math.sin(thrustAngle) * SHIP_THRUST * dt;
    }

    // 摩擦
    ship.vx *= SHIP_FRICTION;
    ship.vy *= SHIP_FRICTION;

    // 限速
    const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    if (speed > SHIP_MAX_SPEED) {
      ship.vx = (ship.vx / speed) * SHIP_MAX_SPEED;
      ship.vy = (ship.vy / speed) * SHIP_MAX_SPEED;
    }

    // 移动
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    // 屏幕包裹
    ship.x = wrap(ship.x, CANVAS_WIDTH);
    ship.y = wrap(ship.y, CANVAS_HEIGHT);

    // 无敌计时
    if (ship.invincibleTimer > 0) {
      ship.invincibleTimer -= dt * 1000;
      if (ship.invincibleTimer < 0) ship.invincibleTimer = 0;
    }
  }

  /** 更新子弹 */
  private updateBullets(dt: number): void {
    this._bullets.forEach(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.lifetime -= dt * 1000;

      // 屏幕包裹
      b.x = wrap(b.x, CANVAS_WIDTH);
      b.y = wrap(b.y, CANVAS_HEIGHT);
    });

    // 移除过期子弹
    this._bullets = this._bullets.filter(b => b.lifetime > 0);
  }

  /** 更新小行星 */
  private updateAsteroids(dt: number): void {
    this._asteroids.forEach(a => {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rotation += a.rotationSpeed * dt;

      // 屏幕包裹
      a.x = wrap(a.x, CANVAS_WIDTH);
      a.y = wrap(a.y, CANVAS_HEIGHT);
    });
  }

  /** 更新粒子 */
  private updateParticles(dt: number): void {
    this._particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifetime -= dt * 1000;
    });

    this._particles = this._particles.filter(p => p.lifetime > 0);
  }

  /** 发射子弹 */
  private shoot(): void {
    if (!this._ship) return;
    const ship = this._ship;
    const shootAngle = ship.angle - Math.PI / 2;

    this._bullets.push({
      x: ship.x + SHIP_SIZE * Math.cos(shootAngle),
      y: ship.y + SHIP_SIZE * Math.sin(shootAngle),
      vx: Math.cos(shootAngle) * BULLET_SPEED + ship.vx * 0.3,
      vy: Math.sin(shootAngle) * BULLET_SPEED + ship.vy * 0.3,
      lifetime: BULLET_LIFETIME,
    });

    this._shootCooldown = BULLET_COOLDOWN;
  }

  /** 检测子弹与小行星碰撞 */
  private checkBulletAsteroidCollisions(): void {
    const bulletsToRemove: Set<number> = new Set();
    const asteroidsToRemove: Set<number> = new Set();
    const newAsteroids: Asteroid[] = [];

    for (let bi = 0; bi < this._bullets.length; bi++) {
      const bullet = this._bullets[bi];
      for (let ai = 0; ai < this._asteroids.length; ai++) {
        if (asteroidsToRemove.has(ai)) continue;
        const asteroid = this._asteroids[ai];

        if (distance(bullet.x, bullet.y, asteroid.x, asteroid.y) < asteroid.radius) {
          bulletsToRemove.add(bi);
          asteroidsToRemove.add(ai);

          // 得分
          this.addScore(getAsteroidScore(asteroid.size));

          // 分裂
          if (asteroid.size === 'large') {
            for (let i = 0; i < 2; i++) {
              newAsteroids.push(this.createSplitAsteroid(asteroid, 'medium'));
            }
          } else if (asteroid.size === 'medium') {
            for (let i = 0; i < 2; i++) {
              newAsteroids.push(this.createSplitAsteroid(asteroid, 'small'));
            }
          }
          // small 不分裂

          // 爆炸粒子
          this.spawnExplosion(asteroid.x, asteroid.y);

          break; // 一颗子弹只击中一个小行星
        }
      }
    }

    // 移除被击中的子弹和小行星
    this._bullets = this._bullets.filter((_, i) => !bulletsToRemove.has(i));
    this._asteroids = this._asteroids.filter((_, i) => !asteroidsToRemove.has(i));

    // 添加分裂的小行星
    this._asteroids.push(...newAsteroids);
  }

  /** 创建分裂的小行星 */
  private createSplitAsteroid(parent: Asteroid, newSize: AsteroidSize): Asteroid {
    const radius = getAsteroidRadius(newSize);
    const angle = Math.random() * Math.PI * 2;
    const speed = ASTEROID_SPEED_BASE + Math.random() * ASTEROID_SPEED_VARIANCE;

    return {
      x: parent.x,
      y: parent.y,
      vx: speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      size: newSize,
      radius,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 2 * ASTEROID_ROTATION_SPEED,
      vertices: generateVertices(),
    };
  }

  /** 检测飞船与小行星碰撞 */
  private checkShipAsteroidCollisions(): void {
    if (!this._ship) return;
    const ship = this._ship;

    // 无敌期间不检测
    if (ship.invincibleTimer > 0) return;

    for (const asteroid of this._asteroids) {
      if (distance(ship.x, ship.y, asteroid.x, asteroid.y) < asteroid.radius + SHIP_SIZE * 0.7) {
        // 被撞
        this._lives--;

        // 爆炸效果
        this.spawnExplosion(ship.x, ship.y);

        if (this._lives <= 0) {
          this._ship = null;
          this.gameOver();
        } else {
          this.resetShip();
        }
        return;
      }
    }
  }

  /** 检查波次是否清完 */
  private checkWaveComplete(): void {
    if (this._asteroids.length === 0 && this._waveDelay <= 0) {
      this.setLevel(this._wave + 1);
      this._waveDelay = 1500; // 1.5 秒后生成下一波
    }
  }

  /** 生成爆炸粒子 */
  private spawnExplosion(x: number, y: number): void {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(PARTICLE_SPEED * 0.5, PARTICLE_SPEED);
      this._particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifetime: PARTICLE_LIFETIME,
        maxLifetime: PARTICLE_LIFETIME,
      });
    }
  }
}
