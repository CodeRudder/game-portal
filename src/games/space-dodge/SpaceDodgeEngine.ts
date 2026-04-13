import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SHIP_WIDTH,
  SHIP_HEIGHT,
  SHIP_SPEED,
  SHIP_Y_OFFSET,
  SHIP_HITBOX_SHRINK,
  METEOR_MIN_RADIUS,
  METEOR_MAX_RADIUS,
  METEOR_MIN_SPEED,
  METEOR_MAX_SPEED,
  METEOR_SPAWN_INTERVAL_MS,
  METEOR_SPAWN_INTERVAL_MIN_MS,
  METEOR_SPAWN_INTERVAL_DECREMENT,
  METEOR_SPEED_INCREMENT,
  METEOR_MAX_ON_SCREEN,
  ORB_RADIUS,
  ORB_SPEED,
  ORB_POINTS,
  ORB_SPAWN_INTERVAL_MS,
  ORB_SPAWN_CHANCE,
  ORB_MAX_ON_SCREEN,
  SPEED_INCREASE_INTERVAL_SEC,
  MAX_LEVEL,
  SCORE_PER_SECOND,
  STAR_COUNT,
  STAR_MIN_SPEED,
  STAR_MAX_SPEED,
  STAR_MIN_SIZE,
  STAR_MAX_SIZE,
} from './constants';

// ========== 数据结构 ==========

interface Ship {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Meteor {
  x: number;
  y: number;
  radius: number;
  speed: number;
  colorIndex: number;
  rotation: number;
  rotationSpeed: number;
}

interface EnergyOrb {
  x: number;
  y: number;
  radius: number;
  speed: number;
  pulsePhase: number;
}

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  brightness: number;
}

interface ScorePopup {
  x: number;
  y: number;
  points: number;
  remainingMs: number;
  totalMs: number;
}

// ========== 游戏引擎 ==========

export class SpaceDodgeEngine extends GameEngine {
  private ship: Ship = { x: 0, y: 0, width: SHIP_WIDTH, height: SHIP_HEIGHT };
  private meteors: Meteor[] = [];
  private orbs: EnergyOrb[] = [];
  private stars: Star[] = [];
  private scorePopups: ScorePopup[] = [];

  // 按键状态
  private keysPressed: Set<string> = new Set();

  // 计时器
  private scoreAccumulatorMs: number = 0;
  private meteorSpawnAccumulatorMs: number = 0;
  private orbSpawnAccumulatorMs: number = 0;
  private levelAccumulatorMs: number = 0;
  private speedMultiplier: number = 1;

  // 用于确定性随机（测试用）
  private _seed: number | null = null;
  private _orbSpawnCounter: number = 0;
  private _orbSpawnThreshold: number = Math.ceil(1 / ORB_SPAWN_CHANCE);

  /** 设置随机种子（测试用），设为 null 恢复 Math.random */
  setSeed(seed: number | null): void {
    this._seed = seed;
  }

  /** 伪随机 [0, 1)，可种子化 */
  private random(): number {
    if (this._seed !== null) {
      this._seed = (this._seed * 16807 + 0) % 2147483647;
      return this._seed / 2147483647;
    }
    return Math.random();
  }

  /** 范围随机 [min, max] */
  private randomRange(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  /** 整数范围随机 [min, max] */
  private randomInt(min: number, max: number): number {
    return Math.floor(this.randomRange(min, max + 1));
  }

  // ========== 公共访问器（测试用） ==========

  getShip(): Ship {
    return { ...this.ship };
  }

  getMeteors(): Meteor[] {
    return [...this.meteors];
  }

  getOrbs(): EnergyOrb[] {
    return [...this.orbs];
  }

  getStars(): Star[] {
    return [...this.stars];
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  getKeysPressed(): Set<string> {
    return new Set(this.keysPressed);
  }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.initStars();
  }

  protected onStart(): void {
    // 初始化飞船位置（底部居中）
    this.ship.x = (CANVAS_WIDTH - SHIP_WIDTH) / 2;
    this.ship.y = CANVAS_HEIGHT - SHIP_Y_OFFSET;
    this.ship.width = SHIP_WIDTH;
    this.ship.height = SHIP_HEIGHT;

    // 清空游戏对象
    this.meteors = [];
    this.orbs = [];
    this.scorePopups = [];

    // 重置计时器和状态
    this.keysPressed.clear();
    this.scoreAccumulatorMs = 0;
    this.meteorSpawnAccumulatorMs = 0;
    this.orbSpawnAccumulatorMs = 0;
    this.levelAccumulatorMs = 0;
    this.speedMultiplier = 1;
    this._orbSpawnCounter = 0;
  }

  protected update(deltaTime: number): void {
    // 游戏结束后不再更新
    if (this._status === 'gameover') return;

    // deltaTime 可能为负值（异常情况），限制为非负
    const dt = Math.max(deltaTime, 0);

    // 更新星空背景
    this.updateStars(dt);

    // 更新飞船位置
    this.updateShip(dt);

    // 更新陨石
    this.updateMeteors(dt);

    // 更新能量球
    this.updateOrbs(dt);

    // 更新得分弹出
    this.updateScorePopups(dt);

    // 累加时间并触发定时事件
    this.scoreAccumulatorMs += dt;
    this.meteorSpawnAccumulatorMs += dt;
    this.orbSpawnAccumulatorMs += dt;
    this.levelAccumulatorMs += dt;

    // 计分：每秒 +10
    this.processTimeScore();

    // 生成陨石
    this.processMeteorSpawn();

    // 生成能量球
    this.processOrbSpawn();

    // 升级（速度递增）
    this.processLevelUp();

    // 碰撞检测
    this.checkCollisions();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // 星空
    this.renderStars(ctx);

    // 能量球
    this.renderOrbs(ctx);

    // 陨石
    this.renderMeteors(ctx);

    // 飞船
    this.renderShip(ctx);

    // 得分弹出
    this.renderScorePopups(ctx);

    // HUD
    this.renderHUD(ctx, w, h);
  }

  handleKeyDown(key: string): void {
    this.keysPressed.add(key);

    if (key === ' ') {
      if (this._status === 'idle' || this._status === 'gameover') {
        this.start();
      }
    }
  }

  handleKeyUp(key: string): void {
    this.keysPressed.delete(key);
  }

  getState(): Record<string, unknown> {
    return {
      ship: this.getShip(),
      meteors: this.getMeteors(),
      orbs: this.getOrbs(),
      score: this._score,
      level: this._level,
      speedMultiplier: this.speedMultiplier,
      elapsedTime: this._elapsedTime,
    };
  }

  // ========== 重置 ==========

  protected onReset(): void {
    this.ship = { x: 0, y: 0, width: SHIP_WIDTH, height: SHIP_HEIGHT };
    this.meteors = [];
    this.orbs = [];
    this.scorePopups = [];
    this.keysPressed.clear();
    this.scoreAccumulatorMs = 0;
    this.meteorSpawnAccumulatorMs = 0;
    this.orbSpawnAccumulatorMs = 0;
    this.levelAccumulatorMs = 0;
    this.speedMultiplier = 1;
  }

  protected onGameOver(): void {
    // 游戏结束处理
  }

  // ========== 飞船 ==========

  private updateShip(_dt: number): void {
    const moveLeft = this.keysPressed.has('ArrowLeft') || this.keysPressed.has('a') || this.keysPressed.has('A');
    const moveRight = this.keysPressed.has('ArrowRight') || this.keysPressed.has('d') || this.keysPressed.has('D');

    if (moveLeft) {
      this.ship.x -= SHIP_SPEED;
    }
    if (moveRight) {
      this.ship.x += SHIP_SPEED;
    }

    // 边界限制
    this.ship.x = Math.max(0, Math.min(CANVAS_WIDTH - this.ship.width, this.ship.x));
  }

  // ========== 陨石 ==========

  private updateMeteors(dt: number): void {
    const speedFactor = dt / 16.67; // 标准化到 60fps
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.y += m.speed * speedFactor;
      m.rotation += m.rotationSpeed * speedFactor;

      // 移出屏幕则移除
      if (m.y - m.radius > CANVAS_HEIGHT) {
        this.meteors.splice(i, 1);
      }
    }
  }

  private spawnMeteor(): void {
    if (this.meteors.length >= METEOR_MAX_ON_SCREEN) return;

    const radius = this.randomRange(METEOR_MIN_RADIUS, METEOR_MAX_RADIUS);
    const baseSpeed = this.randomRange(METEOR_MIN_SPEED, METEOR_MAX_SPEED);
    const speed = baseSpeed * this.speedMultiplier;

    this.meteors.push({
      x: this.randomRange(radius, CANVAS_WIDTH - radius),
      y: -radius,
      radius,
      speed,
      colorIndex: this.randomInt(0, 4),
      rotation: this.randomRange(0, Math.PI * 2),
      rotationSpeed: this.randomRange(-0.03, 0.03),
    });
  }

  // ========== 能量球 ==========

  private updateOrbs(dt: number): void {
    const speedFactor = dt / 16.67;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      orb.y += orb.speed * speedFactor;
      orb.pulsePhase += 0.05 * speedFactor;

      // 移出屏幕则移除
      if (orb.y - orb.radius > CANVAS_HEIGHT) {
        this.orbs.splice(i, 1);
      }
    }
  }

  private spawnOrb(): void {
    if (this.orbs.length >= ORB_MAX_ON_SCREEN) return;

    this.orbs.push({
      x: this.randomRange(ORB_RADIUS, CANVAS_WIDTH - ORB_RADIUS),
      y: -ORB_RADIUS,
      radius: ORB_RADIUS,
      speed: ORB_SPEED * this.speedMultiplier,
      pulsePhase: 0,
    });
  }

  // ========== 星空背景 ==========

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      this.stars.push({
        x: this.randomRange(0, CANVAS_WIDTH),
        y: this.randomRange(0, CANVAS_HEIGHT),
        speed: this.randomRange(STAR_MIN_SPEED, STAR_MAX_SPEED),
        size: this.randomRange(STAR_MIN_SIZE, STAR_MAX_SIZE),
        brightness: this.randomRange(0.3, 1),
      });
    }
  }

  private updateStars(dt: number): void {
    const speedFactor = dt / 16.67;
    for (const star of this.stars) {
      star.y += star.speed * speedFactor;
      if (star.y > CANVAS_HEIGHT) {
        star.y = -star.size;
        star.x = this.randomRange(0, CANVAS_WIDTH);
      }
    }
  }

  // ========== 得分弹出 ==========

  private updateScorePopups(dt: number): void {
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const popup = this.scorePopups[i];
      popup.remainingMs -= dt;
      popup.y -= 0.5 * (dt / 16.67);
      if (popup.remainingMs <= 0) {
        this.scorePopups.splice(i, 1);
      }
    }
  }

  private addScorePopup(x: number, y: number, points: number): void {
    this.scorePopups.push({
      x,
      y,
      points,
      remainingMs: 800,
      totalMs: 800,
    });
  }

  // ========== 定时处理 ==========

  private processTimeScore(): void {
    while (this.scoreAccumulatorMs >= 1000) {
      this.scoreAccumulatorMs -= 1000;
      this.addScore(SCORE_PER_SECOND);
    }
  }

  private processMeteorSpawn(): void {
    const interval = Math.max(
      METEOR_SPAWN_INTERVAL_MIN_MS,
      METEOR_SPAWN_INTERVAL_MS - (this._level - 1) * METEOR_SPAWN_INTERVAL_DECREMENT
    );
    while (this.meteorSpawnAccumulatorMs >= interval) {
      this.meteorSpawnAccumulatorMs -= interval;
      this.spawnMeteor();
    }
  }

  private processOrbSpawn(): void {
    while (this.orbSpawnAccumulatorMs >= ORB_SPAWN_INTERVAL_MS) {
      this.orbSpawnAccumulatorMs -= ORB_SPAWN_INTERVAL_MS;
      this._orbSpawnCounter++;
      if (this._orbSpawnCounter >= this._orbSpawnThreshold) {
        this.spawnOrb();
        this._orbSpawnCounter = 0;
      }
    }
  }

  private processLevelUp(): void {
    while (this.levelAccumulatorMs >= SPEED_INCREASE_INTERVAL_SEC * 1000 && this._level < MAX_LEVEL) {
      this.levelAccumulatorMs -= SPEED_INCREASE_INTERVAL_SEC * 1000;
      this._level++;
      this.speedMultiplier = 1 + (this._level - 1) * METEOR_SPEED_INCREMENT;
      this.setLevel(this._level);
    }
    // 如果超过 MAX_LEVEL，丢弃多余的时间
    if (this._level >= MAX_LEVEL) {
      this.levelAccumulatorMs = 0;
    }
  }

  // ========== 碰撞检测 ==========

  private checkCollisions(): void {
    // 飞船碰撞盒（内缩使碰撞更宽容）
    const sx = this.ship.x + SHIP_HITBOX_SHRINK;
    const sy = this.ship.y + SHIP_HITBOX_SHRINK;
    const sw = this.ship.width - SHIP_HITBOX_SHRINK * 2;
    const sh = this.ship.height - SHIP_HITBOX_SHRINK * 2;

    // 陨石碰撞
    for (const meteor of this.meteors) {
      if (this.circleRectCollision(meteor.x, meteor.y, meteor.radius, sx, sy, sw, sh)) {
        this.gameOver();
        return;
      }
    }

    // 能量球碰撞
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      if (this.circleRectCollision(orb.x, orb.y, orb.radius, sx, sy, sw, sh)) {
        this.addScore(ORB_POINTS);
        this.addScorePopup(orb.x, orb.y, ORB_POINTS);
        this.orbs.splice(i, 1);
      }
    }
  }

  /** 圆形与矩形碰撞检测 */
  private circleRectCollision(
    cx: number, cy: number, cr: number,
    rx: number, ry: number, rw: number, rh: number
  ): boolean {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  // ========== 渲染 ==========

  private renderStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this.stars) {
      ctx.globalAlpha = star.brightness;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  private renderShip(ctx: CanvasRenderingContext2D): void {
    const { x, y, width, height } = this.ship;
    const cx = x + width / 2;
    const cy = y + height / 2;

    // 火焰
    ctx.fillStyle = '#ff6348';
    ctx.beginPath();
    ctx.moveTo(cx - 6, y + height);
    ctx.lineTo(cx, y + height + 8 + Math.random() * 6);
    ctx.lineTo(cx + 6, y + height);
    ctx.closePath();
    ctx.fill();

    // 内焰
    ctx.fillStyle = '#ffd32a';
    ctx.beginPath();
    ctx.moveTo(cx - 3, y + height);
    ctx.lineTo(cx, y + height + 4 + Math.random() * 4);
    ctx.lineTo(cx + 3, y + height);
    ctx.closePath();
    ctx.fill();

    // 飞船主体
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.moveTo(cx, y); // 顶部尖端
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(cx, y + height - 6);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();

    // 座舱窗
    ctx.fillStyle = '#74b9ff';
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderMeteors(ctx: CanvasRenderingContext2D): void {
    const colors = ['#8b7355', '#a0522d', '#6b4226', '#8b6914', '#7b6b5a'];
    for (const m of this.meteors) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rotation);

      // 陨石主体
      ctx.fillStyle = colors[m.colorIndex % colors.length];
      ctx.beginPath();
      ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
      ctx.fill();

      // 陨石坑
      ctx.fillStyle = '#5a4a3a';
      ctx.beginPath();
      ctx.arc(m.radius * 0.3, -m.radius * 0.2, m.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-m.radius * 0.2, m.radius * 0.3, m.radius * 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderOrbs(ctx: CanvasRenderingContext2D): void {
    for (const orb of this.orbs) {
      const pulse = 1 + Math.sin(orb.pulsePhase) * 0.2;
      const r = orb.radius * pulse;

      // 发光效果
      ctx.fillStyle = 'rgba(0, 255, 136, 0.3)';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, r + 6, 0, Math.PI * 2);
      ctx.fill();

      // 能量球主体
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(orb.x - r * 0.25, orb.y - r * 0.25, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderScorePopups(ctx: CanvasRenderingContext2D): void {
    for (const popup of this.scorePopups) {
      const alpha = Math.max(0, popup.remainingMs / popup.totalMs);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`+${popup.points}`, popup.x, popup.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    // 分数
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`分数: ${this._score}`, 12, 30);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`分数: ${this._score}`, 10, 28);

    // 等级
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.textAlign = 'right';
    ctx.fillText(`等级: ${this._level}`, w - 8, 30);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`等级: ${this._level}`, w - 10, 28);

    ctx.textAlign = 'start';
  }
}
