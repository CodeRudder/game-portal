import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  DINO_WIDTH,
  DINO_HEIGHT,
  DINO_DUCK_WIDTH,
  DINO_DUCK_HEIGHT,
  DINO_X,
  GRAVITY,
  JUMP_FORCE,
  ObstacleType,
  SMALL_CACTUS_WIDTH,
  SMALL_CACTUS_HEIGHT,
  LARGE_CACTUS_WIDTH,
  LARGE_CACTUS_HEIGHT,
  PTERO_WIDTH,
  PTERO_HEIGHT,
  PTERO_LOW_Y,
  PTERO_HIGH_Y,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  SPEED_INCREMENT_SCORE,
  MAX_SPEED,
  MIN_OBSTACLE_INTERVAL,
  MAX_OBSTACLE_INTERVAL,
  HITBOX_SHRINK,
  NIGHT_MODE_INTERVAL,
  CLOUD_SPEED_RATIO,
  CLOUD_MIN_Y,
  CLOUD_MAX_Y,
  CLOUD_SPAWN_INTERVAL,
  BG_COLOR_DAY,
  GROUND_COLOR_DAY,
  DINO_COLOR_DAY,
  CACTUS_COLOR_DAY,
  CLOUD_COLOR_DAY,
  SCORE_COLOR_DAY,
  PTERO_COLOR_DAY,
  BG_COLOR_NIGHT,
  GROUND_COLOR_NIGHT,
  DINO_COLOR_NIGHT,
  CACTUS_COLOR_NIGHT,
  CLOUD_COLOR_NIGHT,
  SCORE_COLOR_NIGHT,
  PTERO_COLOR_NIGHT,
  GROUND_LINE_SPACING,
  RUN_ANIM_INTERVAL,
} from './constants';

// ========== 类型定义 ==========

/** 恐龙状态 */
type DinoState = 'running' | 'jumping' | 'ducking';

/** 恐龙对象 */
interface Dino {
  x: number;
  y: number;
  velocity: number;
  state: DinoState;
  animFrame: number; // 跑步动画帧（0 或 1）
}

/** 障碍物对象 */
interface Obstacle {
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  pteroAnimFrame: number; // 翼龙动画帧
}

/** 云朵对象 */
interface Cloud {
  x: number;
  y: number;
  width: number;
}

/** 地面纹理线段 */
interface GroundBump {
  x: number;
  width: number;
}

// ========== Dino Runner 引擎 ==========

export class DinoRunnerEngine extends GameEngine {
  // 恐龙
  private dino: Dino = this.createDino();

  // 障碍物列表
  private obstacles: Obstacle[] = [];

  // 云朵列表
  private clouds: Cloud[] = [];

  // 地面纹理
  private groundBumps: GroundBump[] = [];

  // 当前游戏速度
  private speed: number = INITIAL_SPEED;

  // 障碍物生成计时器
  private obstacleTimer: number = 0;
  private nextObstacleInterval: number = MIN_OBSTACLE_INTERVAL;

  // 云朵生成计时器
  private cloudTimer: number = 0;

  // 跑步动画计时器
  private runAnimTimer: number = 0;

  // 夜间模式
  private isNight: boolean = false;
  private lastNightToggleScore: number = 0;

  // 地面偏移（滚动效果）
  private groundOffset: number = 0;

  // 最高分（本地缓存）
  private highScore: number = 0;

  // 按键状态
  private keysDown: Set<string> = new Set();

  // ========== 生命周期 ==========

  protected onInit(): void {
    // 初始化地面纹理
    this.initGroundBumps();
  }

  protected onStart(): void {
    this.dino = this.createDino();
    this.obstacles = [];
    this.clouds = [];
    this.speed = INITIAL_SPEED;
    this.obstacleTimer = 0;
    this.nextObstacleInterval = this.randomInterval();
    this.cloudTimer = 0;
    this.runAnimTimer = 0;
    this.isNight = false;
    this.lastNightToggleScore = 0;
    this.groundOffset = 0;
    this.keysDown.clear();
    this.initGroundBumps();
  }

  protected onReset(): void {
    this.dino = this.createDino();
    this.obstacles = [];
    this.clouds = [];
    this.speed = INITIAL_SPEED;
    this.obstacleTimer = 0;
    this.nextObstacleInterval = this.randomInterval();
    this.cloudTimer = 0;
    this.runAnimTimer = 0;
    this.isNight = false;
    this.lastNightToggleScore = 0;
    this.groundOffset = 0;
    this.keysDown.clear();
    this.initGroundBumps();
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
    const dt = deltaTime / 16.667; // 标准化到 60fps

    // 持续检测下蹲键状态（用于按住下蹲）
    this.updateDinoState();

    // 更新恐龙物理
    this.updateDino(dt);

    // 更新跑步动画
    this.updateRunAnimation(deltaTime);

    // 更新障碍物
    this.updateObstacles(dt);

    // 更新云朵
    this.updateClouds(dt);

    // 更新地面纹理滚动
    this.updateGround(dt);

    // 计分
    this.addScore(this.speed * dt * 0.1);

    // 难度递增
    this.updateDifficulty();

    // 夜间模式切换
    this.updateNightMode();

    // 碰撞检测
    if (this.checkCollision()) {
      this.gameOver();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = this.isNight ? BG_COLOR_NIGHT : BG_COLOR_DAY;
    ctx.fillRect(0, 0, w, h);

    // 云朵
    this.renderClouds(ctx);

    // 地面
    this.renderGround(ctx, w);

    // 障碍物
    this.renderObstacles(ctx);

    // 恐龙
    this.renderDino(ctx);

    // 分数
    this.renderScore(ctx, w);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    this.keysDown.add(key);

    if (this._status !== 'playing') return;

    if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.jump();
    }
  }

  handleKeyUp(key: string): void {
    this.keysDown.delete(key);
  }

  getState(): Record<string, unknown> {
    return {
      dinoY: this.dino.y,
      dinoState: this.dino.state,
      dinoVelocity: this.dino.velocity,
      speed: this.speed,
      obstacleCount: this.obstacles.length,
      isNight: this.isNight,
      score: this._score,
    };
  }

  // ========== 公共方法 ==========

  /** 跳跃（供外部调用，如鼠标/触摸） */
  flap(): void {
    this.jump();
  }

  /** 鼠标点击事件（委托给 flap/jump） */
  handleClick(_canvasX: number, _canvasY: number): void {
    this.flap();
  }

  /** 获取恐龙状态（供测试使用） */
  getDinoState(): { y: number; velocity: number; state: DinoState } {
    return {
      y: this.dino.y,
      velocity: this.dino.velocity,
      state: this.dino.state,
    };
  }

  /** 获取当前速度 */
  getCurrentSpeed(): number {
    return this.speed;
  }

  /** 获取障碍物列表（供测试使用） */
  getObstacles(): Obstacle[] {
    return [...this.obstacles];
  }

  /** 获取夜间模式状态 */
  getIsNight(): boolean {
    return this.isNight;
  }

  // ========== 私有方法：初始化 ==========

  private createDino(): Dino {
    return {
      x: DINO_X,
      y: GROUND_Y - DINO_HEIGHT,
      velocity: 0,
      state: 'running',
      animFrame: 0,
    };
  }

  private initGroundBumps(): void {
    this.groundBumps = [];
    for (let x = 0; x < CANVAS_WIDTH + GROUND_LINE_SPACING; x += GROUND_LINE_SPACING) {
      this.groundBumps.push({
        x,
        width: 4 + Math.random() * 12,
      });
    }
  }

  // ========== 私有方法：更新 ==========

  private updateDinoState(): void {
    // 如果按住下键，进入下蹲状态（仅在地面时）
    if (this.keysDown.has('ArrowDown') || this.keysDown.has('s') || this.keysDown.has('S')) {
      if (this.dino.state === 'running') {
        this.dino.state = 'ducking';
      }
    } else {
      if (this.dino.state === 'ducking') {
        this.dino.state = 'running';
      }
    }
  }

  private updateDino(dt: number): void {
    if (this.dino.state === 'jumping') {
      // 应用重力
      this.dino.velocity += GRAVITY * dt;
      this.dino.y += this.dino.velocity * dt;

      // 落地检测
      const groundLevel = GROUND_Y - DINO_HEIGHT;
      if (this.dino.y >= groundLevel) {
        this.dino.y = groundLevel;
        this.dino.velocity = 0;
        this.dino.state = this.isDuckKeyDown() ? 'ducking' : 'running';
      }
    } else if (this.dino.state === 'ducking') {
      // 下蹲时 y 位置调整（恐龙变矮）
      this.dino.y = GROUND_Y - DINO_DUCK_HEIGHT;
    } else {
      // 跑步状态
      this.dino.y = GROUND_Y - DINO_HEIGHT;
    }
  }

  private updateRunAnimation(deltaTime: number): void {
    if (this.dino.state === 'running' || this.dino.state === 'ducking') {
      this.runAnimTimer += deltaTime;
      if (this.runAnimTimer >= RUN_ANIM_INTERVAL) {
        this.runAnimTimer = 0;
        this.dino.animFrame = this.dino.animFrame === 0 ? 1 : 0;
      }
    }
  }

  private updateObstacles(dt: number): void {
    // 生成新障碍物
    this.obstacleTimer += 16.667 * dt;
    if (this.obstacleTimer >= this.nextObstacleInterval) {
      this.obstacleTimer = 0;
      this.nextObstacleInterval = this.randomInterval();
      this.spawnObstacle();
    }

    // 移动障碍物
    for (const obs of this.obstacles) {
      obs.x -= this.speed * dt;

      // 翼龙动画
      if (obs.type === ObstacleType.PTERODACTYL) {
        obs.pteroAnimFrame += dt * 0.15;
      }
    }

    // 移除屏幕外障碍物
    this.obstacles = this.obstacles.filter((obs) => obs.x + obs.width > -20);
  }

  private updateClouds(dt: number): void {
    // 生成云朵
    this.cloudTimer += 16.667 * dt;
    if (this.cloudTimer >= CLOUD_SPAWN_INTERVAL) {
      this.cloudTimer = 0;
      this.spawnCloud();
    }

    // 移动云朵（视差滚动，速度较慢）
    const cloudSpeed = this.speed * CLOUD_SPEED_RATIO;
    for (const cloud of this.clouds) {
      cloud.x -= cloudSpeed * dt;
    }

    // 移除屏幕外云朵
    this.clouds = this.clouds.filter((c) => c.x + c.width > -10);
  }

  private updateGround(dt: number): void {
    this.groundOffset = (this.groundOffset + this.speed * dt) % GROUND_LINE_SPACING;

    // 滚动地面纹理
    for (const bump of this.groundBumps) {
      bump.x -= this.speed * dt;
      if (bump.x + bump.width < 0) {
        bump.x = CANVAS_WIDTH + Math.random() * GROUND_LINE_SPACING;
        bump.width = 4 + Math.random() * 12;
      }
    }
  }

  private updateDifficulty(): void {
    const level = Math.floor(this._score / SPEED_INCREMENT_SCORE);
    this.speed = Math.min(MAX_SPEED, INITIAL_SPEED + level * SPEED_INCREMENT);
  }

  private updateNightMode(): void {
    const nightThreshold = Math.floor(this._score / NIGHT_MODE_INTERVAL);
    if (nightThreshold > this.lastNightToggleScore) {
      this.lastNightToggleScore = nightThreshold;
      this.isNight = !this.isNight;
    }
  }

  // ========== 私有方法：生成 ==========

  private spawnObstacle(): void {
    const rand = Math.random();
    let obstacle: Obstacle;

    if (rand < 0.4) {
      // 小仙人掌
      obstacle = {
        type: ObstacleType.SMALL_CACTUS,
        x: CANVAS_WIDTH + 10,
        y: GROUND_Y - SMALL_CACTUS_HEIGHT,
        width: SMALL_CACTUS_WIDTH,
        height: SMALL_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      };
    } else if (rand < 0.7) {
      // 大仙人掌
      obstacle = {
        type: ObstacleType.LARGE_CACTUS,
        x: CANVAS_WIDTH + 10,
        y: GROUND_Y - LARGE_CACTUS_HEIGHT,
        width: LARGE_CACTUS_WIDTH,
        height: LARGE_CACTUS_HEIGHT,
        pteroAnimFrame: 0,
      };
    } else {
      // 翼龙 - 低飞或高飞
      const isLow = Math.random() < 0.5;
      obstacle = {
        type: ObstacleType.PTERODACTYL,
        x: CANVAS_WIDTH + 10,
        y: isLow ? PTERO_LOW_Y : PTERO_HIGH_Y,
        width: PTERO_WIDTH,
        height: PTERO_HEIGHT,
        pteroAnimFrame: 0,
      };
    }

    this.obstacles.push(obstacle);
  }

  private spawnCloud(): void {
    const y = CLOUD_MIN_Y + Math.random() * (CLOUD_MAX_Y - CLOUD_MIN_Y);
    const width = 40 + Math.random() * 30;
    this.clouds.push({ x: CANVAS_WIDTH + 10, y, width });
  }

  // ========== 私有方法：碰撞检测 ==========

  private checkCollision(): boolean {
    const dinoBox = this.getDinoHitbox();

    for (const obs of this.obstacles) {
      const obsBox = {
        x: obs.x + HITBOX_SHRINK,
        y: obs.y + HITBOX_SHRINK,
        width: obs.width - HITBOX_SHRINK * 2,
        height: obs.height - HITBOX_SHRINK * 2,
      };

      if (this.rectsOverlap(dinoBox, obsBox)) {
        return true;
      }
    }

    return false;
  }

  private getDinoHitbox(): { x: number; y: number; width: number; height: number } {
    if (this.dino.state === 'ducking') {
      return {
        x: this.dino.x + HITBOX_SHRINK,
        y: GROUND_Y - DINO_DUCK_HEIGHT + HITBOX_SHRINK,
        width: DINO_DUCK_WIDTH - HITBOX_SHRINK * 2,
        height: DINO_DUCK_HEIGHT - HITBOX_SHRINK * 2,
      };
    }
    return {
      x: this.dino.x + HITBOX_SHRINK,
      y: this.dino.y + HITBOX_SHRINK,
      width: DINO_WIDTH - HITBOX_SHRINK * 2,
      height: (this.dino.state === 'jumping' ? DINO_HEIGHT : DINO_HEIGHT) - HITBOX_SHRINK * 2,
    };
  }

  private rectsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  // ========== 私有方法：跳跃 ==========

  private jump(): void {
    if (this._status !== 'playing') return;
    if (this.dino.state === 'running' || this.dino.state === 'ducking') {
      this.dino.state = 'jumping';
      this.dino.velocity = JUMP_FORCE;
      this.dino.y = GROUND_Y - DINO_HEIGHT; // 重置到跳跃起点
    }
  }

  private isDuckKeyDown(): boolean {
    return this.keysDown.has('ArrowDown') || this.keysDown.has('s') || this.keysDown.has('S');
  }

  // ========== 私有方法：工具 ==========

  private randomInterval(): number {
    return MIN_OBSTACLE_INTERVAL + Math.random() * (MAX_OBSTACLE_INTERVAL - MIN_OBSTACLE_INTERVAL);
  }

  // ========== 私有方法：渲染 ==========

  private renderDino(ctx: CanvasRenderingContext2D): void {
    const color = this.isNight ? DINO_COLOR_NIGHT : DINO_COLOR_DAY;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (this.dino.state === 'ducking') {
      this.renderDinoDucking(ctx, color);
    } else {
      this.renderDinoStanding(ctx, color);
    }
  }

  /** 渲染站立/跳跃状态的恐龙 */
  private renderDinoStanding(ctx: CanvasRenderingContext2D, color: string): void {
    const x = this.dino.x;
    const y = this.dino.y;
    const w = DINO_WIDTH;
    const h = DINO_HEIGHT;

    // 身体（矩形）
    ctx.fillRect(x + 4, y + 4, w - 8, h - 16);

    // 头部（矩形，稍微向右上方突出）
    ctx.fillRect(x + 12, y, w - 12, 20);

    // 眼睛（白色圆 + 黑色瞳孔）
    ctx.fillStyle = this.isNight ? BG_COLOR_NIGHT : '#fff';
    ctx.beginPath();
    ctx.arc(x + w - 10, y + 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + w - 9, y + 8, 2, 0, Math.PI * 2);
    ctx.fill();

    // 嘴巴（线条）
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w - 2, y + 14);
    ctx.lineTo(x + w + 6, y + 14);
    ctx.stroke();

    // 手臂（小线条）
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 22);
    ctx.lineTo(x + 2, y + 30);
    ctx.stroke();

    // 尾巴
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 14);
    ctx.lineTo(x - 6, y + 8);
    ctx.lineTo(x + 4, y + 20);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // 腿部（跑步动画交替）
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    if (this.dino.state === 'jumping') {
      // 跳跃时双腿并拢
      ctx.beginPath();
      ctx.moveTo(x + 14, y + h - 12);
      ctx.lineTo(x + 14, y + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 24, y + h - 12);
      ctx.lineTo(x + 24, y + h);
      ctx.stroke();
    } else {
      // 跑步时腿部交替
      const frame = this.dino.animFrame;
      // 左腿
      ctx.beginPath();
      ctx.moveTo(x + 14, y + h - 12);
      ctx.lineTo(x + (frame === 0 ? 10 : 18), y + h);
      ctx.stroke();
      // 右腿
      ctx.beginPath();
      ctx.moveTo(x + 24, y + h - 12);
      ctx.lineTo(x + (frame === 0 ? 18 : 10), y + h);
      ctx.stroke();
    }
  }

  /** 渲染下蹲状态的恐龙 */
  private renderDinoDucking(ctx: CanvasRenderingContext2D, color: string): void {
    const x = this.dino.x;
    const y = GROUND_Y - DINO_DUCK_HEIGHT;
    const w = DINO_DUCK_WIDTH;
    const h = DINO_DUCK_HEIGHT;

    // 身体（扁平矩形）
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

    // 头部（右端突出）
    ctx.fillRect(x + w - 20, y, 20, 16);

    // 眼睛
    ctx.fillStyle = this.isNight ? BG_COLOR_NIGHT : '#fff';
    ctx.beginPath();
    ctx.arc(x + w - 6, y + 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + w - 5, y + 6, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 尾巴
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 6);
    ctx.lineTo(x - 8, y + 2);
    ctx.lineTo(x + 4, y + 14);
    ctx.closePath();
    ctx.fill();

    // 腿部（跑步动画交替）
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    const frame = this.dino.animFrame;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + h - 4);
    ctx.lineTo(x + (frame === 0 ? 16 : 24), y + h + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 34, y + h - 4);
    ctx.lineTo(x + (frame === 0 ? 24 : 16), y + h + 4);
    ctx.stroke();
  }

  /** 渲染障碍物 */
  private renderObstacles(ctx: CanvasRenderingContext2D): void {
    for (const obs of this.obstacles) {
      switch (obs.type) {
        case ObstacleType.SMALL_CACTUS:
          this.renderCactus(ctx, obs.x, obs.y, obs.width, obs.height, false);
          break;
        case ObstacleType.LARGE_CACTUS:
          this.renderCactus(ctx, obs.x, obs.y, obs.width, obs.height, true);
          break;
        case ObstacleType.PTERODACTYL:
          this.renderPterodactyl(ctx, obs);
          break;
      }
    }
  }

  /** 渲染仙人掌 */
  private renderCactus(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    isLarge: boolean,
  ): void {
    const color = this.isNight ? CACTUS_COLOR_NIGHT : CACTUS_COLOR_DAY;
    ctx.fillStyle = color;

    // 主干
    ctx.fillRect(x + w * 0.3, y, w * 0.4, h);

    if (isLarge) {
      // 大仙人掌左臂
      ctx.fillRect(x, y + h * 0.3, w * 0.4, w * 0.25);
      ctx.fillRect(x, y + h * 0.15, w * 0.25, h * 0.2);

      // 大仙人掌右臂
      ctx.fillRect(x + w * 0.6, y + h * 0.2, w * 0.4, w * 0.25);
      ctx.fillRect(x + w * 0.75, y + h * 0.05, w * 0.25, h * 0.2);
    } else {
      // 小仙人掌左臂
      ctx.fillRect(x, y + h * 0.35, w * 0.4, w * 0.3);
      ctx.fillRect(x, y + h * 0.2, w * 0.25, h * 0.2);

      // 小仙人掌右臂
      ctx.fillRect(x + w * 0.6, y + h * 0.25, w * 0.4, w * 0.3);
      ctx.fillRect(x + w * 0.75, y + h * 0.1, w * 0.25, h * 0.2);
    }
  }

  /** 渲染翼龙 */
  private renderPterodactyl(ctx: CanvasRenderingContext2D, obs: Obstacle): void {
    const color = this.isNight ? PTERO_COLOR_NIGHT : PTERO_COLOR_DAY;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    const x = obs.x;
    const y = obs.y;
    const w = obs.width;
    const h = obs.height;

    // 身体（椭圆矩形）
    ctx.fillRect(x + 8, y + h * 0.35, w - 16, h * 0.3);

    // 头部
    ctx.fillRect(x + w - 16, y + h * 0.25, 14, h * 0.3);

    // 喙
    ctx.beginPath();
    ctx.moveTo(x + w - 2, y + h * 0.35);
    ctx.lineTo(x + w + 8, y + h * 0.45);
    ctx.lineTo(x + w - 2, y + h * 0.5);
    ctx.closePath();
    ctx.fill();

    // 眼睛
    ctx.fillStyle = this.isNight ? BG_COLOR_NIGHT : '#fff';
    ctx.beginPath();
    ctx.arc(x + w - 8, y + h * 0.35, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + w - 7, y + h * 0.35, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 翅膀动画
    ctx.fillStyle = color;
    const wingPhase = Math.floor(obs.pteroAnimFrame) % 2;
    if (wingPhase === 0) {
      // 翅膀上扬
      ctx.beginPath();
      ctx.moveTo(x + 12, y + h * 0.35);
      ctx.lineTo(x + w * 0.4, y - 4);
      ctx.lineTo(x + w * 0.6, y + h * 0.35);
      ctx.closePath();
      ctx.fill();
    } else {
      // 翅膀下垂
      ctx.beginPath();
      ctx.moveTo(x + 12, y + h * 0.65);
      ctx.lineTo(x + w * 0.4, y + h + 4);
      ctx.lineTo(x + w * 0.6, y + h * 0.65);
      ctx.closePath();
      ctx.fill();
    }

    // 尾巴
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h * 0.4);
    ctx.lineTo(x, y + h * 0.3);
    ctx.lineTo(x, y + h * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  /** 渲染云朵 */
  private renderClouds(ctx: CanvasRenderingContext2D): void {
    const color = this.isNight ? CLOUD_COLOR_NIGHT : CLOUD_COLOR_DAY;
    ctx.fillStyle = color;

    for (const cloud of this.clouds) {
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.width * 0.25, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.width * 0.3, cloud.y - cloud.width * 0.1, cloud.width * 0.2, 0, Math.PI * 2);
      ctx.arc(cloud.x + cloud.width * 0.55, cloud.y, cloud.width * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 渲染地面 */
  private renderGround(ctx: CanvasRenderingContext2D, w: number): void {
    const color = this.isNight ? GROUND_COLOR_NIGHT : GROUND_COLOR_DAY;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    // 地面主线
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(w, GROUND_Y);
    ctx.stroke();

    // 地面纹理（小线段和点）
    ctx.lineWidth = 1;
    for (const bump of this.groundBumps) {
      if (bump.x >= 0 && bump.x <= w) {
        ctx.beginPath();
        ctx.moveTo(bump.x, GROUND_Y + 4 + Math.random() * 2);
        ctx.lineTo(bump.x + bump.width, GROUND_Y + 4 + Math.random() * 2);
        ctx.stroke();
      }
    }

    // 额外地面纹理点
    ctx.fillStyle = color;
    for (let i = 0; i < 20; i++) {
      const dotX = (i * 25 - this.groundOffset) % w;
      if (dotX > 0 && dotX < w) {
        ctx.fillRect(dotX, GROUND_Y + 8 + (i % 3) * 4, 2, 2);
      }
    }
  }

  /** 渲染分数 */
  private renderScore(ctx: CanvasRenderingContext2D, w: number): void {
    const color = this.isNight ? SCORE_COLOR_NIGHT : SCORE_COLOR_DAY;
    ctx.fillStyle = color;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';

    // 当前分数
    const displayScore = Math.floor(this._score).toString().padStart(5, '0');
    ctx.fillText(displayScore, w - 20, 30);

    // 最高分
    if (this.highScore > 0) {
      ctx.font = '14px monospace';
      ctx.fillStyle = this.isNight ? '#a0a0a0' : '#999';
      ctx.fillText(`HI ${this.highScore.toString().padStart(5, '0')}`, w - 100, 30);
    }

    // 夜间模式指示器
    if (this.isNight) {
      ctx.font = '12px monospace';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'left';
      ctx.fillText('🌙', 10, 25);
    }
  }
}
