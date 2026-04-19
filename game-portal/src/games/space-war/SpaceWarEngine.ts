import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  SHIP_SIZE, SHIP_THRUST, SHIP_ROTATION_SPEED, SHIP_MAX_SPEED,
  SHIP_FRICTION, SHIP_COLOR_P1, SHIP_COLOR_P2,
  BULLET_SPEED, BULLET_LIFETIME, BULLET_COOLDOWN, BULLET_RADIUS,
  BULLET_COLOR_P1, BULLET_COLOR_P2,
  ASTEROID_COUNT, ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS,
  ASTEROID_MIN_SPEED, ASTEROID_MAX_SPEED, ASTEROID_COLOR,
  ASTEROID_ROTATION_SPEED,
  WINS_NEEDED,
  PARTICLE_COUNT, PARTICLE_LIFETIME, PARTICLE_SPEED,
  STAR_COUNT,
  ROUND_DELAY,
  AI_THINK_INTERVAL, AI_ACCURACY, AI_SHOOT_RANGE, AI_THRUST_CHANCE,
  HUD_COLOR, BG_COLOR,
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
  angle: number;       // 弧度，-PI/2 = 朝上
  thrusting: boolean;
  alive: boolean;
  bulletCooldown: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  owner: 1 | 2;        // 属于哪个玩家
}

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  vertices: number[];   // 不规则形状顶点偏移
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
}

interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
}

// ============================================================
// 工具函数
// ============================================================

/** 两点距离 */
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

/** 随机范围 */
function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 生成不规则小行星顶点 */
function generateVertices(count: number): number[] {
  const verts: number[] = [];
  for (let i = 0; i < count; i++) {
    verts.push(0.7 + Math.random() * 0.6); // 0.7 ~ 1.3
  }
  return verts;
}

/** 角度归一化到 [-PI, PI] */
function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// ============================================================
// SpaceWarEngine
// ============================================================

export class SpaceWarEngine extends GameEngine {
  // 游戏对象
  private _ship1: Ship | null = null;
  private _ship2: Ship | null = null;
  private _bullets: Bullet[] = [];
  private _asteroids: Asteroid[] = [];
  private _particles: Particle[] = [];
  private _stars: Star[] = [];

  // 按键状态 - P1
  private _p1Left = false;
  private _p1Right = false;
  private _p1Thrust = false;
  private _p1Shoot = false;

  // 按键状态 - P2
  private _p2Left = false;
  private _p2Right = false;
  private _p2Thrust = false;
  private _p2Shoot = false;

  // 得分
  private _score1 = 0;
  private _score2 = 0;

  // 回合状态
  private _roundActive = false;
  private _roundDelay = 0;
  private _roundOver = false;     // 当前回合是否结束
  private _winner: 1 | 2 | null = null;  // 整场比赛赢家
  private _matchOver = false;

  // AI 模式
  private _aiMode = false;
  private _aiThinkTimer = 0;

  // 公开属性访问器

  /** 玩家1分数 */
  get score1(): number { return this._score1; }

  /** 玩家2分数 */
  get score2(): number { return this._score2; }

  /** 是否AI模式 */
  get aiMode(): boolean { return this._aiMode; }

  /** 比赛赢家 */
  get winner(): 1 | 2 | null { return this._winner; }

  /** 比赛是否结束 */
  get matchOver(): boolean { return this._matchOver; }

  /** 子弹数量 */
  get bulletCount(): number { return this._bullets.length; }

  /** 小行星数量 */
  get asteroidCount(): number { return this._asteroids.length; }

  /** 粒子数量 */
  get particleCount(): number { return this._particles.length; }

  /** 是否为胜利 */
  get isWin(): boolean { return this._matchOver && this._winner !== null; }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this._generateStars();
  }

  protected onStart(): void {
    this._score1 = 0;
    this._score2 = 0;
    this._winner = null;
    this._matchOver = false;
    this._roundOver = false;
    this._startRound();
  }

  protected onReset(): void {
    this._ship1 = null;
    this._ship2 = null;
    this._bullets = [];
    this._asteroids = [];
    this._particles = [];
    this._score1 = 0;
    this._score2 = 0;
    this._roundActive = false;
    this._roundDelay = 0;
    this._roundOver = false;
    this._winner = null;
    this._matchOver = false;
    this._clearKeys();
  }

  protected onDestroy(): void {
    this.onReset();
  }

  protected onGameOver(): void {
    // 比赛结束
  }

  protected onPause(): void {
    // 暂停
  }

  protected onResume(): void {
    // 恢复
  }

  // ========== 主循环 ==========

  protected update(deltaTime: number): void {
    if (this._matchOver) return;

    // 回合间延迟
    if (this._roundDelay > 0) {
      this._roundDelay -= deltaTime;
      this._updateParticles(deltaTime);
      if (this._roundDelay <= 0) {
        this._roundDelay = 0;
        this._startRound();
      }
      return;
    }

    if (!this._roundActive) return;

    // 更新飞船
    this._updateShip(this._ship1, this._p1Left, this._p1Right, this._p1Thrust, deltaTime);
    this._updateShip(this._ship2, this._p2Left, this._p2Right, this._p2Thrust, deltaTime);

    // AI 控制
    if (this._aiMode) {
      this._updateAI(deltaTime);
    }

    // 射击
    this._handleShooting(this._ship1, this._p1Shoot, 1, deltaTime);
    this._handleShooting(this._ship2, this._p2Shoot, 2, deltaTime);

    // 更新子弹
    this._updateBullets(deltaTime);

    // 更新小行星
    this._updateAsteroids(deltaTime);

    // 碰撞检测
    this._checkCollisions();

    // 更新粒子
    this._updateParticles(deltaTime);

    // 检查回合结束
    this._checkRoundEnd();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 星星
    this._renderStars(ctx);

    // 小行星
    this._asteroids.forEach(a => this._renderAsteroid(ctx, a));

    // 子弹
    this._bullets.forEach(b => this._renderBullet(ctx, b));

    // 飞船
    if (this._ship1?.alive) this._renderShip(ctx, this._ship1, SHIP_COLOR_P1);
    if (this._ship2?.alive) this._renderShip(ctx, this._ship2, SHIP_COLOR_P2);

    // 粒子
    this._particles.forEach(p => this._renderParticle(ctx, p));

    // HUD
    this._renderHUD(ctx, w, h);
  }

  // ========== 键盘输入 ==========

  handleKeyDown(key: string): void {
    if (this._status === 'idle' || this._status === 'gameover') {
      if (key === ' ' || key === 'Enter') {
        this.start();
        return;
      }
    }

    if (this._status !== 'playing') return;

    // P1: W推进, A/D旋转, 空格射击
    switch (key) {
      case 'w': case 'W': this._p1Thrust = true; break;
      case 'a': case 'A': this._p1Left = true; break;
      case 'd': case 'D': this._p1Right = true; break;
      case ' ': this._p1Shoot = true; break;
    }

    // P2: ↑推进, ←/→旋转, Enter射击
    switch (key) {
      case 'ArrowUp': this._p2Thrust = true; break;
      case 'ArrowLeft': this._p2Left = true; break;
      case 'ArrowRight': this._p2Right = true; break;
      case 'Enter': this._p2Shoot = true; break;
    }

    // T 切换AI模式（仅在 idle 状态）
    if (key === 't' || key === 'T') {
      if (this._status === 'playing' && !this._roundActive && this._roundDelay <= 0) {
        this._aiMode = !this._aiMode;
      }
    }
  }

  handleKeyUp(key: string): void {
    switch (key) {
      case 'w': case 'W': this._p1Thrust = false; break;
      case 'a': case 'A': this._p1Left = false; break;
      case 'd': case 'D': this._p1Right = false; break;
      case ' ': this._p1Shoot = false; break;
    }

    switch (key) {
      case 'ArrowUp': this._p2Thrust = false; break;
      case 'ArrowLeft': this._p2Left = false; break;
      case 'ArrowRight': this._p2Right = false; break;
      case 'Enter': this._p2Shoot = false; break;
    }
  }

  // ========== 状态获取 ==========

  getState(): Record<string, unknown> {
    return {
      score1: this._score1,
      score2: this._score2,
      score: this._score,       // 总分
      level: this._level,
      bulletCount: this._bullets.length,
      asteroidCount: this._asteroids.length,
      particleCount: this._particles.length,
      roundActive: this._roundActive,
      matchOver: this._matchOver,
      winner: this._winner,
      aiMode: this._aiMode,
      ship1Alive: this._ship1?.alive ?? false,
      ship2Alive: this._ship2?.alive ?? false,
    };
  }

  // ========== 公开方法 ==========

  /** 设置 AI 模式 */
  setAiMode(enabled: boolean): void {
    this._aiMode = enabled;
  }

  // ========== 私有方法 ==========

  /** 清除所有按键状态 */
  private _clearKeys(): void {
    this._p1Left = false;
    this._p1Right = false;
    this._p1Thrust = false;
    this._p1Shoot = false;
    this._p2Left = false;
    this._p2Right = false;
    this._p2Thrust = false;
    this._p2Shoot = false;
  }

  /** 生成背景星星 */
  private _generateStars(): void {
    this._stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      this._stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.5 + 0.3,
      });
    }
  }

  /** 开始新回合 */
  private _startRound(): void {
    // 创建飞船
    this._ship1 = {
      x: CANVAS_WIDTH * 0.25,
      y: CANVAS_HEIGHT / 2,
      vx: 0, vy: 0,
      angle: -Math.PI / 2,  // 朝上
      thrusting: false,
      alive: true,
      bulletCooldown: 0,
    };

    this._ship2 = {
      x: CANVAS_WIDTH * 0.75,
      y: CANVAS_HEIGHT / 2,
      vx: 0, vy: 0,
      angle: Math.PI / 2,   // 朝下
      thrusting: false,
      alive: true,
      bulletCooldown: 0,
    };

    this._bullets = [];
    this._particles = [];
    this._roundActive = true;
    this._roundOver = false;

    // 生成小行星
    this._generateAsteroids();

    this._clearKeys();
  }

  /** 生成小行星 */
  private _generateAsteroids(): void {
    this._asteroids = [];
    for (let i = 0; i < ASTEROID_COUNT; i++) {
      let x: number, y: number;
      // 避免在飞船附近生成
      do {
        x = Math.random() * CANVAS_WIDTH;
        y = Math.random() * CANVAS_HEIGHT;
      } while (
        this._ship1 && distance(x, y, this._ship1.x, this._ship1.y) < 80 ||
        this._ship2 && distance(x, y, this._ship2.x, this._ship2.y) < 80
      );

      const radius = randRange(ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS);
      const speed = randRange(ASTEROID_MIN_SPEED, ASTEROID_MAX_SPEED);
      const angle = Math.random() * Math.PI * 2;

      this._asteroids.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * ASTEROID_ROTATION_SPEED * 2,
        vertices: generateVertices(8),
      });
    }
  }

  /** 更新飞船 */
  private _updateShip(
    ship: Ship | null,
    left: boolean, right: boolean,
    thrust: boolean, dt: number
  ): void {
    if (!ship || !ship.alive) return;

    const dtSec = dt / 1000;

    // 旋转
    if (left) ship.angle -= SHIP_ROTATION_SPEED * dtSec;
    if (right) ship.angle += SHIP_ROTATION_SPEED * dtSec;

    // 推进
    ship.thrusting = thrust;
    if (thrust) {
      ship.vx += Math.cos(ship.angle) * SHIP_THRUST * dtSec;
      ship.vy += Math.sin(ship.angle) * SHIP_THRUST * dtSec;
    }

    // 速度限制
    const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    if (speed > SHIP_MAX_SPEED) {
      ship.vx = (ship.vx / speed) * SHIP_MAX_SPEED;
      ship.vy = (ship.vy / speed) * SHIP_MAX_SPEED;
    }

    // 摩擦力
    ship.vx *= SHIP_FRICTION;
    ship.vy *= SHIP_FRICTION;

    // 位置更新
    ship.x += ship.vx * dtSec;
    ship.y += ship.vy * dtSec;

    // 屏幕包裹
    ship.x = wrap(ship.x, CANVAS_WIDTH);
    ship.y = wrap(ship.y, CANVAS_HEIGHT);

    // 冷却递减
    if (ship.bulletCooldown > 0) {
      ship.bulletCooldown -= dt;
    }
  }

  /** 处理射击 */
  private _handleShooting(ship: Ship | null, shoot: boolean, owner: 1 | 2, dt: number): void {
    if (!ship || !ship.alive || !shoot) return;
    if (ship.bulletCooldown > 0) return;

    // 发射子弹
    const bulletColor = owner === 1 ? BULLET_COLOR_P1 : BULLET_COLOR_P2;
    void bulletColor; // 用于渲染

    this._bullets.push({
      x: ship.x + Math.cos(ship.angle) * SHIP_SIZE,
      y: ship.y + Math.sin(ship.angle) * SHIP_SIZE,
      vx: Math.cos(ship.angle) * BULLET_SPEED + ship.vx * 0.3,
      vy: Math.sin(ship.angle) * BULLET_SPEED + ship.vy * 0.3,
      lifetime: BULLET_LIFETIME,
      owner,
    });

    ship.bulletCooldown = BULLET_COOLDOWN;
  }

  /** 更新子弹 */
  private _updateBullets(dt: number): void {
    const dtSec = dt / 1000;
    this._bullets = this._bullets.filter(b => {
      b.x += b.vx * dtSec;
      b.y += b.vy * dtSec;
      b.lifetime -= dt;

      // 屏幕包裹
      b.x = wrap(b.x, CANVAS_WIDTH);
      b.y = wrap(b.y, CANVAS_HEIGHT);

      return b.lifetime > 0;
    });
  }

  /** 更新小行星 */
  private _updateAsteroids(dt: number): void {
    const dtSec = dt / 1000;
    this._asteroids.forEach(a => {
      a.x += a.vx * dtSec;
      a.y += a.vy * dtSec;
      a.rotation += a.rotationSpeed * dtSec;

      // 屏幕包裹
      a.x = wrap(a.x, CANVAS_WIDTH);
      a.y = wrap(a.y, CANVAS_HEIGHT);
    });
  }

  /** 更新粒子 */
  private _updateParticles(dt: number): void {
    const dtSec = dt / 1000;
    this._particles = this._particles.filter(p => {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.lifetime -= dt;
      return p.lifetime > 0;
    });
  }

  /** 碰撞检测 */
  private _checkCollisions(): void {
    // 子弹 vs 飞船
    const bulletsToRemove = new Set<number>();

    this._bullets.forEach((bullet, bi) => {
      // 子弹 vs P1 飞船（只能被 P2 的子弹击中）
      if (this._ship1?.alive && bullet.owner === 2) {
        if (distance(bullet.x, bullet.y, this._ship1.x, this._ship1.y) < SHIP_SIZE) {
          this._ship1.alive = false;
          bulletsToRemove.add(bi);
          this._spawnExplosion(this._ship1.x, this._ship1.y, SHIP_COLOR_P1);
        }
      }

      // 子弹 vs P2 飞船（只能被 P1 的子弹击中）
      if (this._ship2?.alive && bullet.owner === 1) {
        if (distance(bullet.x, bullet.y, this._ship2.x, this._ship2.y) < SHIP_SIZE) {
          this._ship2.alive = false;
          bulletsToRemove.add(bi);
          this._spawnExplosion(this._ship2.x, this._ship2.y, SHIP_COLOR_P2);
        }
      }

      // 子弹 vs 小行星
      this._asteroids.forEach((asteroid, ai) => {
        if (distance(bullet.x, bullet.y, asteroid.x, asteroid.y) < asteroid.radius + BULLET_RADIUS) {
          bulletsToRemove.add(bi);
          // 小行星被击中后重新生成在随机位置
          this._respawnAsteroid(ai);
          this._spawnExplosion(asteroid.x, asteroid.y, ASTEROID_COLOR);
        }
      });
    });

    // 移除命中的子弹
    this._bullets = this._bullets.filter((_, i) => !bulletsToRemove.has(i));

    // 飞船 vs 小行星
    if (this._ship1?.alive) {
      for (const asteroid of this._asteroids) {
        if (distance(this._ship1.x, this._ship1.y, asteroid.x, asteroid.y) < SHIP_SIZE + asteroid.radius) {
          this._ship1.alive = false;
          this._spawnExplosion(this._ship1.x, this._ship1.y, SHIP_COLOR_P1);
          break;
        }
      }
    }

    if (this._ship2?.alive) {
      for (const asteroid of this._asteroids) {
        if (distance(this._ship2.x, this._ship2.y, asteroid.x, asteroid.y) < SHIP_SIZE + asteroid.radius) {
          this._ship2.alive = false;
          this._spawnExplosion(this._ship2.x, this._ship2.y, SHIP_COLOR_P2);
          break;
        }
      }
    }
  }

  /** 重新生成小行星在随机位置 */
  private _respawnAsteroid(index: number): void {
    const a = this._asteroids[index];
    a.x = Math.random() * CANVAS_WIDTH;
    a.y = Math.random() * CANVAS_HEIGHT;
    const speed = randRange(ASTEROID_MIN_SPEED, ASTEROID_MAX_SPEED);
    const angle = Math.random() * Math.PI * 2;
    a.vx = Math.cos(angle) * speed;
    a.vy = Math.sin(angle) * speed;
    a.radius = randRange(ASTEROID_MIN_RADIUS, ASTEROID_MAX_RADIUS);
    a.vertices = generateVertices(8);
  }

  /** 生成爆炸粒子 */
  private _spawnExplosion(x: number, y: number, color: string): void {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 / PARTICLE_COUNT) * i + Math.random() * 0.5;
      const speed = PARTICLE_SPEED * (0.5 + Math.random());
      this._particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifetime: PARTICLE_LIFETIME * (0.5 + Math.random() * 0.5),
        maxLifetime: PARTICLE_LIFETIME,
        color,
      });
    }
  }

  /** 检查回合结束 */
  private _checkRoundEnd(): void {
    if (this._roundOver) return;

    const s1Alive = this._ship1?.alive ?? false;
    const s2Alive = this._ship2?.alive ?? false;

    if (!s1Alive || !s2Alive) {
      this._roundOver = true;
      this._roundActive = false;

      // 计分
      if (!s1Alive && s2Alive) {
        this._score2++;
      } else if (s1Alive && !s2Alive) {
        this._score1++;
      }
      // 两者同时死亡不计分

      // 更新总分（用于排行榜）
      this._score = this._score1 + this._score2;

      // 检查胜利
      if (this._score1 >= WINS_NEEDED) {
        this._winner = 1;
        this._matchOver = true;
        this.gameOver();
      } else if (this._score2 >= WINS_NEEDED) {
        this._winner = 2;
        this._matchOver = true;
        this.gameOver();
      } else {
        // 下一回合延迟
        this._roundDelay = ROUND_DELAY;
      }
    }
  }

  // ========== AI ==========

  /** AI 控制 P2 飞船 */
  private _updateAI(dt: number): void {
    if (!this._ship2?.alive || !this._ship1?.alive) {
      // AI 飞船死亡或对手死亡，停止操作
      this._p2Left = false;
      this._p2Right = false;
      this._p2Thrust = false;
      this._p2Shoot = false;
      return;
    }

    this._aiThinkTimer -= dt;
    if (this._aiThinkTimer > 0) return;
    this._aiThinkTimer = AI_THINK_INTERVAL;

    // 计算到对手的方向
    let dx = this._ship1.x - this._ship2.x;
    let dy = this._ship1.y - this._ship2.y;

    // 考虑屏幕包裹 - 取最短路径
    if (Math.abs(dx) > CANVAS_WIDTH / 2) {
      dx = dx > 0 ? dx - CANVAS_WIDTH : dx + CANVAS_WIDTH;
    }
    if (Math.abs(dy) > CANVAS_HEIGHT / 2) {
      dy = dy > 0 ? dy - CANVAS_HEIGHT : dy + CANVAS_HEIGHT;
    }

    const distToTarget = Math.sqrt(dx * dx + dy * dy);
    const targetAngle = Math.atan2(dy, dx);

    // 计算角度差
    let angleDiff = normalizeAngle(targetAngle - this._ship2.angle);

    // 旋转
    this._p2Left = angleDiff < -0.1;
    this._p2Right = angleDiff > 0.1;

    // 推进
    this._p2Thrust = Math.random() < AI_THRUST_CHANCE || Math.abs(angleDiff) < 0.5;

    // 射击
    this._p2Shoot = (
      Math.abs(angleDiff) < (1 - AI_ACCURACY) * Math.PI &&
      distToTarget < AI_SHOOT_RANGE
    );

    // 躲避小行星
    for (const asteroid of this._asteroids) {
      const d = distance(this._ship2.x, this._ship2.y, asteroid.x, asteroid.y);
      if (d < asteroid.radius + 40) {
        // 远离小行星方向推进
        const awayAngle = Math.atan2(
          this._ship2.y - asteroid.y,
          this._ship2.x - asteroid.x
        );
        const awayDiff = normalizeAngle(awayAngle - this._ship2.angle);
        if (Math.abs(awayDiff) < Math.PI / 2) {
          this._p2Thrust = true;
        }
        break;
      }
    }
  }

  // ========== 渲染方法 ==========

  private _renderStars(ctx: CanvasRenderingContext2D): void {
    this._stars.forEach(s => {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.brightness})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    });
  }

  private _renderShip(ctx: CanvasRenderingContext2D, ship: Ship, color: string): void {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);

    // 飞船三角形
    ctx.beginPath();
    ctx.moveTo(SHIP_SIZE, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
    ctx.lineTo(-SHIP_SIZE * 0.4, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 推进火焰
    if (ship.thrusting) {
      ctx.beginPath();
      ctx.moveTo(-SHIP_SIZE * 0.5, -SHIP_SIZE * 0.3);
      ctx.lineTo(-SHIP_SIZE * (0.9 + Math.random() * 0.4), 0);
      ctx.lineTo(-SHIP_SIZE * 0.5, SHIP_SIZE * 0.3);
      ctx.closePath();
      ctx.fillStyle = '#ffaa00';
      ctx.fill();
    }

    ctx.restore();
  }

  private _renderBullet(ctx: CanvasRenderingContext2D, bullet: Bullet): void {
    const color = bullet.owner === 1 ? BULLET_COLOR_P1 : BULLET_COLOR_P2;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  private _renderAsteroid(ctx: CanvasRenderingContext2D, asteroid: Asteroid): void {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.rotation);

    ctx.beginPath();
    const vertCount = asteroid.vertices.length;
    for (let i = 0; i <= vertCount; i++) {
      const angle = (Math.PI * 2 / vertCount) * i;
      const r = asteroid.radius * asteroid.vertices[i % vertCount];
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.fillStyle = ASTEROID_COLOR;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#a08060';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  private _renderParticle(ctx: CanvasRenderingContext2D, particle: Particle): void {
    const alpha = particle.lifetime / particle.maxLifetime;
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  private _renderHUD(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 分数显示
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';

    // P1 分数（左上）
    ctx.fillStyle = SHIP_COLOR_P1;
    ctx.fillText(`P1: ${this._score1}`, w * 0.25, 30);

    // P2 分数（右上）
    ctx.fillStyle = SHIP_COLOR_P2;
    ctx.fillText(`P2: ${this._score2}`, w * 0.75, 30);

    // 胜利标记
    ctx.font = '12px monospace';
    ctx.fillStyle = '#666';
    ctx.fillText(`先胜 ${WINS_NEEDED} 局`, w / 2, 30);

    // AI 模式标记
    if (this._aiMode) {
      ctx.fillStyle = '#ffaa00';
      ctx.font = '12px monospace';
      ctx.fillText('AI', w / 2, 50);
    }

    // 回合结束提示
    if (this._roundOver && !this._matchOver) {
      ctx.fillStyle = HUD_COLOR;
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('准备下一回合...', w / 2, h / 2);
    }

    // 比赛结束提示
    if (this._matchOver && this._winner) {
      ctx.fillStyle = this._winner === 1 ? SHIP_COLOR_P1 : SHIP_COLOR_P2;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`玩家 ${this._winner} 获胜！`, w / 2, h / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#999';
      ctx.fillText('按空格或回车重新开始', w / 2, h / 2 + 20);
    }
  }
}
