import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HELICOPTER_X,
  HELICOPTER_WIDTH,
  HELICOPTER_HEIGHT,
  HELICOPTER_RADIUS,
  GRAVITY,
  THRUST_FORCE,
  MAX_RISE_SPEED,
  MAX_FALL_SPEED,
  TERRAIN_SEGMENT_WIDTH,
  INITIAL_CAVE_GAP,
  MIN_CAVE_GAP,
  GAP_DECREMENT,
  TERRAIN_ROUGHNESS,
  TERRAIN_SMOOTHNESS,
  MIN_CEILING_HEIGHT,
  MIN_FLOOR_HEIGHT,
  OBSTACLE_WIDTH,
  OBSTACLE_MIN_HEIGHT,
  OBSTACLE_MAX_HEIGHT,
  OBSTACLE_SPAWN_DISTANCE,
  OBSTACLE_GAP,
  STAR_RADIUS,
  STAR_POINTS,
  STAR_SPAWN_DISTANCE,
  STAR_COLLECT_DISTANCE,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  MAX_SPEED,
  DISTANCE_SCORE_INTERVAL,
  DISTANCE_SCORE_POINTS,
  LEVEL_UP_DISTANCE,
  CAVE_BG_TOP,
  CAVE_BG_BOTTOM,
  CEILING_COLOR,
  CEILING_BORDER_COLOR,
  FLOOR_COLOR,
  FLOOR_BORDER_COLOR,
  OBSTACLE_COLOR,
  OBSTACLE_BORDER_COLOR,
  HELICOPTER_BODY_COLOR,
  HELICOPTER_ROTOR_COLOR,
  HELICOPTER_SKID_COLOR,
  HELICOPTER_WINDOW_COLOR,
  STAR_COLOR,
  STAR_GLOW_COLOR,
  HUD_COLOR,
  HUD_SHADOW_COLOR,
  THRUST_INDICATOR_COLOR,
  EXHAUST_COLOR,
} from './constants';

// ========== 类型定义 ==========

/** 直升机状态 */
interface Helicopter {
  x: number;
  y: number;
  velocity: number;
  thrusting: boolean; // 是否正在施加推力
  rotorAngle: number; // 旋翼角度（动画用）
}

/** 地形高度点 */
interface TerrainPoint {
  x: number;
  ceilingHeight: number; // 天花板高度（从顶部算）
  floorHeight: number; // 地板高度（从底部算）
}

/** 障碍物（石笋） */
interface Obstacle {
  x: number;
  fromTop: boolean; // 从顶部还是底部生长
  height: number; // 障碍物长度
  width: number;
  passed: boolean; // 是否已通过
}

/** 星星 */
interface Star {
  x: number;
  y: number;
  collected: boolean;
  pulsePhase: number; // 脉冲动画相位
}

/** 排气粒子 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

// ========== Cave Flyer 引擎 ==========

export class CaveFlyerEngine extends GameEngine {
  // 直升机状态
  private helicopter: Helicopter = {
    x: HELICOPTER_X,
    y: CANVAS_HEIGHT / 2,
    velocity: 0,
    thrusting: false,
    rotorAngle: 0,
  };

  // 地形
  private terrain: TerrainPoint[] = [];
  private lastCeilingHeight: number = 80;
  private lastFloorHeight: number = 80;

  // 障碍物
  private obstacles: Obstacle[] = [];
  private distanceSinceLastObstacle: number = 0;

  // 星星
  private stars: Star[] = [];
  private distanceSinceLastStar: number = 0;

  // 粒子效果
  private particles: Particle[] = [];

  // 游戏参数
  private currentSpeed: number = INITIAL_SPEED;
  private currentGap: number = INITIAL_CAVE_GAP;
  private distanceTraveled: number = 0;
  private distanceScoreAccumulator: number = 0;
  private levelDistanceAccumulator: number = 0;

  // 输入状态
  private thrustKeyHeld: boolean = false;

  // ========== 生命周期 ==========

  protected onInit(): void {
    // 初始化不做额外操作
  }

  protected onStart(): void {
    this.helicopter = {
      x: HELICOPTER_X,
      y: CANVAS_HEIGHT / 2,
      velocity: 0,
      thrusting: false,
      rotorAngle: 0,
    };
    this.terrain = [];
    this.obstacles = [];
    this.stars = [];
    this.particles = [];
    this.lastCeilingHeight = 80;
    this.lastFloorHeight = 80;
    this.currentSpeed = INITIAL_SPEED;
    this.currentGap = INITIAL_CAVE_GAP;
    this.distanceTraveled = 0;
    this.distanceScoreAccumulator = 0;
    this.levelDistanceAccumulator = 0;
    this.distanceSinceLastObstacle = 0;
    this.distanceSinceLastStar = 0;
    this.thrustKeyHeld = false;

    // 生成初始地形（覆盖整个屏幕 + 缓冲区）
    this.generateInitialTerrain();
  }

  protected onReset(): void {
    this.helicopter = {
      x: HELICOPTER_X,
      y: CANVAS_HEIGHT / 2,
      velocity: 0,
      thrusting: false,
      rotorAngle: 0,
    };
    this.terrain = [];
    this.obstacles = [];
    this.stars = [];
    this.particles = [];
    this.lastCeilingHeight = 80;
    this.lastFloorHeight = 80;
    this.currentSpeed = INITIAL_SPEED;
    this.currentGap = INITIAL_CAVE_GAP;
    this.distanceTraveled = 0;
    this.distanceScoreAccumulator = 0;
    this.levelDistanceAccumulator = 0;
    this.distanceSinceLastObstacle = 0;
    this.distanceSinceLastStar = 0;
    this.thrustKeyHeld = false;
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 16.667; // 标准化到 60fps

    // 更新直升机物理
    this.updateHelicopter(dt);

    // 更新地形滚动
    this.updateTerrain(dt);

    // 更新障碍物
    this.updateObstacles(dt);

    // 更新星星
    this.updateStars(dt);

    // 更新粒子
    this.updateParticles(dt);

    // 更新距离和计分
    this.updateDistanceAndScore(dt);

    // 碰撞检测
    if (this.checkCollision()) {
      this.gameOver();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 洞穴背景
    this.drawBackground(ctx, w, h);

    // 地形
    this.drawTerrain(ctx, w, h);

    // 障碍物
    this.drawObstacles(ctx);

    // 星星
    this.drawStars(ctx);

    // 粒子
    this.drawParticles(ctx);

    // 直升机
    this.drawHelicopter(ctx);

    // HUD
    this.drawHUD(ctx, w);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (key === 'ArrowUp' || key === ' ' || key === 'w' || key === 'W') {
      this.thrustKeyHeld = true;
      this.helicopter.thrusting = true;
    }
    if (key === 'r' || key === 'R') {
      if (this._status === 'gameover') {
        this.reset();
        this.start();
      }
    }
  }

  handleKeyUp(key: string): void {
    if (key === 'ArrowUp' || key === ' ' || key === 'w' || key === 'W') {
      this.thrustKeyHeld = false;
      this.helicopter.thrusting = false;
    }
  }

  getState(): Record<string, unknown> {
    return {
      helicopterY: this.helicopter.y,
      helicopterVelocity: this.helicopter.velocity,
      thrusting: this.helicopter.thrusting,
      distanceTraveled: this.distanceTraveled,
      currentSpeed: this.currentSpeed,
      currentGap: this.currentGap,
      obstacleCount: this.obstacles.length,
      starCount: this.stars.filter(s => !s.collected).length,
      terrainSegments: this.terrain.length,
    };
  }

  // ========== 公共方法（供测试访问） ==========

  /** 获取当前距离 */
  getDistance(): number {
    return Math.floor(this.distanceTraveled);
  }

  /** 获取当前速度 */
  getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  /** 获取当前洞穴间距 */
  getCurrentGap(): number {
    return this.currentGap;
  }

  /** 获取直升机 Y 坐标 */
  getHelicopterY(): number {
    return this.helicopter.y;
  }

  /** 获取直升机速度 */
  getHelicopterVelocity(): number {
    return this.helicopter.velocity;
  }

  /** 是否正在推力 */
  isThrusting(): boolean {
    return this.helicopter.thrusting;
  }

  /** 获取障碍物列表 */
  getObstacles(): Obstacle[] {
    return [...this.obstacles];
  }

  /** 获取星星列表 */
  getStars(): Star[] {
    return [...this.stars];
  }

  /** 获取地形数据 */
  getTerrain(): TerrainPoint[] {
    return [...this.terrain];
  }

  /** 获取收集的星星数 */
  getCollectedStarCount(): number {
    return this.stars.filter(s => s.collected).length;
  }

  /** 获取飞行距离 */
  getDistanceTraveled(): number {
    return this.distanceTraveled;
  }

  // ========== 私有方法：物理和更新 ==========

  private updateHelicopter(dt: number): void {
    // 推力或重力
    if (this.helicopter.thrusting) {
      this.helicopter.velocity += THRUST_FORCE * dt;
      if (this.helicopter.velocity < MAX_RISE_SPEED) {
        this.helicopter.velocity = MAX_RISE_SPEED;
      }
      // 生成排气粒子
      this.spawnExhaustParticles();
    } else {
      this.helicopter.velocity += GRAVITY * dt;
      if (this.helicopter.velocity > MAX_FALL_SPEED) {
        this.helicopter.velocity = MAX_FALL_SPEED;
      }
    }

    this.helicopter.y += this.helicopter.velocity * dt;

    // 天花板限制
    if (this.helicopter.y < HELICOPTER_RADIUS) {
      this.helicopter.y = HELICOPTER_RADIUS;
      this.helicopter.velocity = 0;
    }

    // 旋翼动画
    this.helicopter.rotorAngle += 0.3 * dt;
  }

  private updateTerrain(dt: number): void {
    const moveAmount = this.currentSpeed * dt;

    // 移动地形
    for (const point of this.terrain) {
      point.x -= moveAmount;
    }

    // 移除屏幕外地形
    this.terrain = this.terrain.filter(p => p.x > -TERRAIN_SEGMENT_WIDTH * 2);

    // 在右侧生成新地形
    this.generateTerrainAhead(moveAmount);
  }

  private generateInitialTerrain(): void {
    const numSegments = Math.ceil(CANVAS_WIDTH / TERRAIN_SEGMENT_WIDTH) + 20;
    for (let i = 0; i < numSegments; i++) {
      const x = i * TERRAIN_SEGMENT_WIDTH;
      this.addTerrainPoint(x);
    }
  }

  private terrainGenerationAccumulator: number = 0;

  private generateTerrainAhead(moveAmount: number): void {
    this.terrainGenerationAccumulator += moveAmount;

    while (this.terrainGenerationAccumulator >= TERRAIN_SEGMENT_WIDTH) {
      this.terrainGenerationAccumulator -= TERRAIN_SEGMENT_WIDTH;

      // 找到最右侧的地形点
      const rightmost = this.terrain.length > 0
        ? this.terrain[this.terrain.length - 1]
        : { x: CANVAS_WIDTH, ceilingHeight: this.lastCeilingHeight, floorHeight: this.lastFloorHeight };

      const newX = rightmost.x + TERRAIN_SEGMENT_WIDTH;
      this.addTerrainPoint(newX);
    }
  }

  private addTerrainPoint(x: number): void {
    // 计算当前允许的间隙
    const gap = this.currentGap;
    const playArea = CANVAS_HEIGHT;
    const maxBorderHeight = (playArea - gap) / 2;

    // 平滑随机地形
    const ceilingTarget = MIN_CEILING_HEIGHT + Math.random() * (maxBorderHeight - MIN_CEILING_HEIGHT);
    const floorTarget = MIN_FLOOR_HEIGHT + Math.random() * (maxBorderHeight - MIN_FLOOR_HEIGHT);

    // 确保间隙足够
    const totalBorder = ceilingTarget + floorTarget;
    const adjustedGap = playArea - totalBorder;
    let adjustedCeiling = ceilingTarget;
    let adjustedFloor = floorTarget;

    if (adjustedGap < gap) {
      const excess = gap - adjustedGap;
      adjustedCeiling = Math.max(MIN_CEILING_HEIGHT, ceilingTarget - excess / 2);
      adjustedFloor = Math.max(MIN_FLOOR_HEIGHT, floorTarget - excess / 2);
    }

    // 平滑过渡
    this.lastCeilingHeight = this.lastCeilingHeight * TERRAIN_SMOOTHNESS + adjustedCeiling * (1 - TERRAIN_SMOOTHNESS);
    this.lastFloorHeight = this.lastFloorHeight * TERRAIN_SMOOTHNESS + adjustedFloor * (1 - TERRAIN_SMOOTHNESS);

    // 添加随机起伏
    const ceilingNoise = (Math.random() - 0.5) * TERRAIN_ROUGHNESS * 20;
    const floorNoise = (Math.random() - 0.5) * TERRAIN_ROUGHNESS * 20;

    const finalCeiling = Math.max(MIN_CEILING_HEIGHT, this.lastCeilingHeight + ceilingNoise);
    const finalFloor = Math.max(MIN_FLOOR_HEIGHT, this.lastFloorHeight + floorNoise);

    // 最终确保间隙
    const finalGap = playArea - finalCeiling - finalFloor;
    if (finalGap < MIN_CAVE_GAP) {
      const shortage = MIN_CAVE_GAP - finalGap;
      const adjustedFinalCeiling = Math.max(MIN_CEILING_HEIGHT, finalCeiling - shortage / 2);
      const adjustedFinalFloor = Math.max(MIN_FLOOR_HEIGHT, finalFloor - shortage / 2);
      this.lastCeilingHeight = adjustedFinalCeiling;
      this.lastFloorHeight = adjustedFinalFloor;
      this.terrain.push({ x, ceilingHeight: adjustedFinalCeiling, floorHeight: adjustedFinalFloor });
    } else {
      this.terrain.push({ x, ceilingHeight: finalCeiling, floorHeight: finalFloor });
    }
  }

  private updateObstacles(dt: number): void {
    const moveAmount = this.currentSpeed * dt;

    // 移动障碍物
    for (const obs of this.obstacles) {
      obs.x -= moveAmount;
    }

    // 移除屏幕外障碍物
    this.obstacles = this.obstacles.filter(o => o.x + o.width > -10);

    // 生成新障碍物
    this.distanceSinceLastObstacle += moveAmount;
    if (this.distanceSinceLastObstacle >= OBSTACLE_SPAWN_DISTANCE) {
      this.distanceSinceLastObstacle = 0;
      this.spawnObstacle();
    }
  }

  private spawnObstacle(): void {
    // 获取直升机位置处的地形信息
    const terrainAtSpawn = this.getTerrainAt(CANVAS_WIDTH + 50);
    if (!terrainAtSpawn) return;

    const gapCenter = terrainAtSpawn.ceilingHeight + (CANVAS_HEIGHT - terrainAtSpawn.ceilingHeight - terrainAtSpawn.floorHeight) / 2;

    // 随机从顶部或底部生长
    const fromTop = Math.random() > 0.5;
    const height = OBSTACLE_MIN_HEIGHT + Math.random() * (OBSTACLE_MAX_HEIGHT - OBSTACLE_MIN_HEIGHT);

    // 确保障碍物不会完全堵住通道
    const availableSpace = CANVAS_HEIGHT - terrainAtSpawn.ceilingHeight - terrainAtSpawn.floorHeight;
    const maxAllowedHeight = availableSpace - OBSTACLE_GAP;
    const clampedHeight = Math.min(height, Math.max(0, maxAllowedHeight));

    if (clampedHeight < OBSTACLE_MIN_HEIGHT) return; // 空间太小，不生成

    this.obstacles.push({
      x: CANVAS_WIDTH + 50,
      fromTop,
      height: clampedHeight,
      width: OBSTACLE_WIDTH,
      passed: false,
    });

    // 有时同时生成对向障碍物（更高难度）
    if (this._level >= 3 && Math.random() > 0.5) {
      const oppositeHeight = OBSTACLE_MIN_HEIGHT + Math.random() * (OBSTACLE_MAX_HEIGHT - OBSTACLE_MIN_HEIGHT) * 0.6;
      const clampedOpposite = Math.min(oppositeHeight, Math.max(0, availableSpace - clampedHeight - OBSTACLE_GAP));
      if (clampedOpposite >= OBSTACLE_MIN_HEIGHT) {
        this.obstacles.push({
          x: CANVAS_WIDTH + 50,
          fromTop: !fromTop,
          height: clampedOpposite,
          width: OBSTACLE_WIDTH,
          passed: false,
        });
      }
    }
  }

  private updateStars(dt: number): void {
    const moveAmount = this.currentSpeed * dt;

    // 移动星星
    for (const star of this.stars) {
      star.x -= moveAmount;
      star.pulsePhase += 0.05 * dt;
    }

    // 移除屏幕外星星
    this.stars = this.stars.filter(s => s.x > -STAR_RADIUS * 2 && !s.collected);

    // 生成新星星
    this.distanceSinceLastStar += moveAmount;
    if (this.distanceSinceLastStar >= STAR_SPAWN_DISTANCE) {
      this.distanceSinceLastStar = 0;
      this.spawnStar();
    }

    // 检查星星收集
    this.checkStarCollection();
  }

  private spawnStar(): void {
    const terrainAtSpawn = this.getTerrainAt(CANVAS_WIDTH + 30);
    if (!terrainAtSpawn) return;

    const minY = terrainAtSpawn.ceilingHeight + STAR_RADIUS + 10;
    const maxY = CANVAS_HEIGHT - terrainAtSpawn.floorHeight - STAR_RADIUS - 10;

    if (maxY <= minY) return;

    const y = minY + Math.random() * (maxY - minY);

    this.stars.push({
      x: CANVAS_WIDTH + 30,
      y,
      collected: false,
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  private checkStarCollection(): void {
    for (const star of this.stars) {
      if (star.collected) continue;

      const dx = this.helicopter.x - star.x;
      const dy = this.helicopter.y - star.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < STAR_COLLECT_DISTANCE) {
        star.collected = true;
        this.addScore(STAR_POINTS);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  private spawnExhaustParticles(): void {
    if (Math.random() > 0.4) return; // 不是每帧都生成

    this.particles.push({
      x: this.helicopter.x - HELICOPTER_WIDTH / 2 - 2,
      y: this.helicopter.y + (Math.random() - 0.5) * 6,
      vx: -1.5 - Math.random() * 2,
      vy: (Math.random() - 0.5) * 1.5,
      life: 15 + Math.random() * 10,
      maxLife: 25,
      size: 2 + Math.random() * 3,
    });
  }

  private updateDistanceAndScore(dt: number): void {
    const moveAmount = this.currentSpeed * dt;
    this.distanceTraveled += moveAmount;

    // 距离计分
    this.distanceScoreAccumulator += moveAmount;
    if (this.distanceScoreAccumulator >= DISTANCE_SCORE_INTERVAL) {
      this.distanceScoreAccumulator -= DISTANCE_SCORE_INTERVAL;
      this.addScore(DISTANCE_SCORE_POINTS);
    }

    // 升级检查
    this.levelDistanceAccumulator += moveAmount;
    if (this.levelDistanceAccumulator >= LEVEL_UP_DISTANCE) {
      this.levelDistanceAccumulator -= LEVEL_UP_DISTANCE;
      const newLevel = this._level + 1;
      this.setLevel(newLevel);
      this.increaseDifficulty();
    }
  }

  private increaseDifficulty(): void {
    this.currentSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + (this._level - 1) * SPEED_INCREMENT);
    this.currentGap = Math.max(MIN_CAVE_GAP, INITIAL_CAVE_GAP - (this._level - 1) * GAP_DECREMENT);
  }

  // ========== 碰撞检测 ==========

  private checkCollision(): boolean {
    const hx = this.helicopter.x;
    const hy = this.helicopter.y;
    const hr = HELICOPTER_RADIUS;

    // 边界碰撞（天花板和地板）
    if (hy - hr <= 0 || hy + hr >= CANVAS_HEIGHT) {
      return true;
    }

    // 地形碰撞
    const terrainAtHelicopter = this.getTerrainAt(hx);
    if (terrainAtHelicopter) {
      if (hy - hr < terrainAtHelicopter.ceilingHeight || hy + hr > CANVAS_HEIGHT - terrainAtHelicopter.floorHeight) {
        return true;
      }
    }

    // 障碍物碰撞
    for (const obs of this.obstacles) {
      const obsLeft = obs.x;
      const obsRight = obs.x + obs.width;

      // 检查水平重叠
      if (hx + hr > obsLeft && hx - hr < obsRight) {
        if (obs.fromTop) {
          // 从顶部生长的障碍物
          const terrainHere = this.getTerrainAt(obs.x + obs.width / 2);
          const obsBottom = (terrainHere?.ceilingHeight ?? 0) + obs.height;
          if (hy - hr < obsBottom) {
            return true;
          }
        } else {
          // 从底部生长的障碍物
          const terrainHere = this.getTerrainAt(obs.x + obs.width / 2);
          const obsTop = CANVAS_HEIGHT - (terrainHere?.floorHeight ?? 0) - obs.height;
          if (hy + hr > obsTop) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /** 获取指定 x 坐标处的地形信息（线性插值） */
  private getTerrainAt(x: number): TerrainPoint | null {
    if (this.terrain.length < 2) return null;

    // 找到 x 两侧的地形点
    let left: TerrainPoint | null = null;
    let right: TerrainPoint | null = null;

    for (let i = 0; i < this.terrain.length - 1; i++) {
      if (this.terrain[i].x <= x && this.terrain[i + 1].x >= x) {
        left = this.terrain[i];
        right = this.terrain[i + 1];
        break;
      }
    }

    if (!left || !right) {
      // 如果 x 在地形范围外，使用最近点
      if (x <= this.terrain[0].x) return this.terrain[0];
      if (x >= this.terrain[this.terrain.length - 1].x) return this.terrain[this.terrain.length - 1];
      return null;
    }

    // 线性插值
    const t = (x - left.x) / (right.x - left.x);
    return {
      x,
      ceilingHeight: left.ceilingHeight + (right.ceilingHeight - left.ceilingHeight) * t,
      floorHeight: left.floorHeight + (right.floorHeight - left.floorHeight) * t,
    };
  }

  // ========== 渲染方法 ==========

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, CAVE_BG_TOP);
    grad.addColorStop(1, CAVE_BG_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private drawTerrain(ctx: CanvasRenderingContext2D, _w: number, h: number): void {
    if (this.terrain.length < 2) return;

    // 绘制天花板
    ctx.fillStyle = CEILING_COLOR;
    ctx.beginPath();
    ctx.moveTo(this.terrain[0].x, 0);
    for (const point of this.terrain) {
      ctx.lineTo(point.x, point.ceilingHeight);
    }
    ctx.lineTo(this.terrain[this.terrain.length - 1].x, 0);
    ctx.closePath();
    ctx.fill();

    // 天花板边框
    ctx.strokeStyle = CEILING_BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.terrain.length; i++) {
      const p = this.terrain[i];
      if (i === 0) ctx.moveTo(p.x, p.ceilingHeight);
      else ctx.lineTo(p.x, p.ceilingHeight);
    }
    ctx.stroke();

    // 绘制地板
    ctx.fillStyle = FLOOR_COLOR;
    ctx.beginPath();
    ctx.moveTo(this.terrain[0].x, h);
    for (const point of this.terrain) {
      ctx.lineTo(point.x, h - point.floorHeight);
    }
    ctx.lineTo(this.terrain[this.terrain.length - 1].x, h);
    ctx.closePath();
    ctx.fill();

    // 地板边框
    ctx.strokeStyle = FLOOR_BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < this.terrain.length; i++) {
      const p = this.terrain[i];
      if (i === 0) ctx.moveTo(p.x, h - p.floorHeight);
      else ctx.lineTo(p.x, h - p.floorHeight);
    }
    ctx.stroke();
  }

  private drawObstacles(ctx: CanvasRenderingContext2D): void {
    for (const obs of this.obstacles) {
      const terrainHere = this.getTerrainAt(obs.x + obs.width / 2);
      if (!terrainHere) continue;

      ctx.fillStyle = OBSTACLE_COLOR;
      ctx.strokeStyle = OBSTACLE_BORDER_COLOR;
      ctx.lineWidth = 2;

      if (obs.fromTop) {
        const topY = terrainHere.ceilingHeight;
        ctx.fillRect(obs.x, topY, obs.width, obs.height);
        ctx.strokeRect(obs.x, topY, obs.width, obs.height);

        // 障碍物尖端装饰
        ctx.beginPath();
        ctx.moveTo(obs.x, topY + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, topY + obs.height + 8);
        ctx.lineTo(obs.x + obs.width, topY + obs.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        const bottomY = CANVAS_HEIGHT - terrainHere.floorHeight;
        ctx.fillRect(obs.x, bottomY - obs.height, obs.width, obs.height);
        ctx.strokeRect(obs.x, bottomY - obs.height, obs.width, obs.height);

        // 障碍物尖端装饰
        ctx.beginPath();
        ctx.moveTo(obs.x, bottomY - obs.height);
        ctx.lineTo(obs.x + obs.width / 2, bottomY - obs.height - 8);
        ctx.lineTo(obs.x + obs.width, bottomY - obs.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this.stars) {
      if (star.collected) continue;

      const pulse = 1 + Math.sin(star.pulsePhase) * 0.15;
      const r = STAR_RADIUS * pulse;

      // 光晕
      ctx.fillStyle = STAR_GLOW_COLOR;
      ctx.beginPath();
      ctx.arc(star.x, star.y, r * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 星星本体（五角星）
      ctx.fillStyle = STAR_COLOR;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const x = star.x + Math.cos(angle) * r;
        const y = star.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = EXHAUST_COLOR;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawHelicopter(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.helicopter.x, this.helicopter.y);

    // 推力指示器
    if (this.helicopter.thrusting) {
      ctx.fillStyle = THRUST_INDICATOR_COLOR;
      ctx.beginPath();
      ctx.moveTo(-HELICOPTER_WIDTH / 2 - 5, -3);
      ctx.lineTo(-HELICOPTER_WIDTH / 2 - 15, 0);
      ctx.lineTo(-HELICOPTER_WIDTH / 2 - 5, 3);
      ctx.closePath();
      ctx.fill();
    }

    // 机身
    ctx.fillStyle = HELICOPTER_BODY_COLOR;
    ctx.beginPath();
    ctx.ellipse(0, 2, HELICOPTER_WIDTH / 2, HELICOPTER_HEIGHT / 2 - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e55039';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 驾驶舱窗户
    ctx.fillStyle = HELICOPTER_WINDOW_COLOR;
    ctx.beginPath();
    ctx.ellipse(8, 0, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 旋翼杆
    ctx.strokeStyle = HELICOPTER_SKID_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -HELICOPTER_HEIGHT / 2 + 2);
    ctx.lineTo(5, -HELICOPTER_HEIGHT / 2 + 2);
    ctx.stroke();

    // 旋翼（旋转动画）
    ctx.save();
    ctx.translate(0, -HELICOPTER_HEIGHT / 2 + 2);
    ctx.rotate(this.helicopter.rotorAngle);
    ctx.strokeStyle = HELICOPTER_ROTOR_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();
    ctx.restore();

    // 尾部
    ctx.fillStyle = HELICOPTER_BODY_COLOR;
    ctx.beginPath();
    ctx.moveTo(-HELICOPTER_WIDTH / 2 + 2, 0);
    ctx.lineTo(-HELICOPTER_WIDTH / 2 - 10, -5);
    ctx.lineTo(-HELICOPTER_WIDTH / 2 - 10, 5);
    ctx.closePath();
    ctx.fill();

    // 尾部旋翼
    ctx.save();
    ctx.translate(-HELICOPTER_WIDTH / 2 - 10, 0);
    ctx.rotate(this.helicopter.rotorAngle * 2);
    ctx.strokeStyle = HELICOPTER_ROTOR_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.stroke();
    ctx.restore();

    // 滑橇
    ctx.strokeStyle = HELICOPTER_SKID_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, HELICOPTER_HEIGHT / 2);
    ctx.lineTo(10, HELICOPTER_HEIGHT / 2);
    ctx.stroke();

    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // 距离显示
    const dist = Math.floor(this.distanceTraveled);
    const distText = `${dist}m`;
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = HUD_SHADOW_COLOR;
    ctx.fillText(distText, w / 2 - 28 + 1, 26);
    ctx.fillStyle = HUD_COLOR;
    ctx.fillText(distText, w / 2 - 28, 25);

    // 分数显示（左上角）
    const scoreText = `★ ${this._score}`;
    ctx.fillStyle = HUD_SHADOW_COLOR;
    ctx.fillText(scoreText, 11, 26);
    ctx.fillStyle = STAR_COLOR;
    ctx.fillText(scoreText, 10, 25);

    // 速度指示器（右上角）
    const speedPercent = Math.round(((this.currentSpeed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED)) * 100);
    const speedText = `SPD ${Math.max(0, speedPercent)}%`;
    ctx.fillStyle = HUD_SHADOW_COLOR;
    ctx.fillText(speedText, w - 96 + 1, 26);
    ctx.fillStyle = '#ff6348';
    ctx.fillText(speedText, w - 96, 25);
  }
}
