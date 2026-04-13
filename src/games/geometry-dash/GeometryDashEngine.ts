import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  CEILING_Y,
  PLAYER_SIZE,
  PLAYER_X,
  GRAVITY,
  JUMP_FORCE,
  LONG_PRESS_EXTRA_FORCE,
  MAX_UPWARD_VELOCITY,
  MAX_FALL_VELOCITY,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  SPEED_INCREMENT_INTERVAL,
  MAX_SPEED,
  ObstacleType,
  SPIKE_WIDTH,
  SPIKE_HEIGHT,
  BLOCK_SIZE,
  PILLAR_WIDTH,
  HITBOX_SHRINK,
  LEVEL_LENGTH,
  PROGRESS_SCALE,
  BG_COLOR,
  BG_GRADIENT_TOP,
  BG_GRADIENT_BOTTOM,
  GROUND_COLOR,
  GROUND_LINE_COLOR,
  CEILING_COLOR,
  PLAYER_COLOR,
  PLAYER_OUTLINE_COLOR,
  SPIKE_COLOR,
  BLOCK_COLOR,
  PILLAR_COLOR,
  PROGRESS_BAR_BG,
  PROGRESS_BAR_FILL,
  PROGRESS_TEXT_COLOR,
  SCORE_COLOR,
  DEATH_OVERLAY_COLOR,
  PARTICLE_COLOR,
  DEATH_PARTICLE_COUNT,
  PARTICLE_MIN_SPEED,
  PARTICLE_MAX_SPEED,
  PARTICLE_LIFETIME,
  GROUND_PATTERN_SPACING,
  LEVELS,
  type LevelDefinition,
  type LevelObstacle,
} from './constants';

// ========== 类型定义 ==========

/** 玩家状态 */
type PlayerState = 'grounded' | 'jumping' | 'dead';

/** 玩家对象 */
interface Player {
  x: number;
  y: number;
  velocity: number;
  rotation: number; // 旋转角度（度）
  state: PlayerState;
}

/** 运行时障碍物实例 */
interface ObstacleInstance {
  type: ObstacleType;
  x: number; // 当前屏幕 X 坐标
  y: number; // 当前屏幕 Y 坐标
  width: number;
  height: number;
  passed: boolean; // 是否已经被玩家通过
}

/** 死亡粒子 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 剩余生命（毫秒）
  maxLife: number;
  size: number;
}

/** 地面装饰线段 */
interface GroundLine {
  x: number;
  width: number;
}

// ========== Geometry Dash Lite 引擎 ==========

export class GeometryDashEngine extends GameEngine {
  // 玩家
  private player: Player = this.createPlayer();

  // 当前关卡障碍物（运行时实例）
  private obstacles: ObstacleInstance[] = [];

  // 死亡粒子
  private particles: Particle[] = [];

  // 地面装饰
  private groundLines: GroundLine[] = [];

  // 滚动偏移量（已走过的距离）
  private scrollOffset: number = 0;

  // 当前速度
  private speed: number = INITIAL_SPEED;

  // 进度百分比（0-100）
  private progress: number = 0;

  // 当前关卡索引
  private currentLevelIndex: number = 0;

  // 当前关卡定义
  private currentLevel: LevelDefinition = LEVELS[0];

  // 是否通关
  public isWin: boolean = false;

  // 是否正在长按跳跃键
  private jumpKeyPressed: boolean = false;

  // 死亡时间戳（用于死亡动画）
  private deathTime: number = 0;

  // 是否显示死亡动画
  private showingDeathAnimation: boolean = false;

  // 尝试次数
  private attempts: number = 0;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.initGroundLines();
  }

  protected onStart(): void {
    this.player = this.createPlayer();
    this.obstacles = [];
    this.particles = [];
    this.scrollOffset = 0;
    this.speed = INITIAL_SPEED;
    this.progress = 0;
    this.isWin = false;
    this.jumpKeyPressed = false;
    this.deathTime = 0;
    this.showingDeathAnimation = false;
    this.attempts++;
    this.keysDown.clear();
    this.initGroundLines();
    this.loadLevelObstacles();
  }

  protected onReset(): void {
    this.player = this.createPlayer();
    this.obstacles = [];
    this.particles = [];
    this.scrollOffset = 0;
    this.speed = INITIAL_SPEED;
    this.progress = 0;
    this.isWin = false;
    this.jumpKeyPressed = false;
    this.deathTime = 0;
    this.showingDeathAnimation = false;
    // Note: attempts is intentionally NOT reset here.
    // It is cleared only in destroy(). The restart() flow is reset() -> start(),
    // and start() increments attempts.
    this.keysDown.clear();
    this.initGroundLines();
  }

  protected onGameOver(): void {
    this.player.state = 'dead';
    this.deathTime = Date.now();
    this.showingDeathAnimation = true;
    this.spawnDeathParticles();
  }

  protected onDestroy(): void {
    this.attempts = 0;
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
    // Only update when playing (or showing death animation for particles)
    if (this._status !== 'playing' && !this.showingDeathAnimation) return;

    const dt = deltaTime / 16.667; // 标准化到 60fps

    // 死亡动画更新
    if (this.showingDeathAnimation) {
      this.updateParticles(deltaTime);
      return;
    }

    // 更新玩家物理
    this.updatePlayer(dt);

    // 更新滚动
    this.updateScroll(dt);

    // 更新障碍物位置
    this.updateObstacles(dt);

    // 更新地面装饰
    this.updateGroundLines(dt);

    // 更新进度
    this.updateProgress();

    // 更新速度（随进度递增）
    this.updateSpeed();

    // 更新分数（基于距离）
    this.addScore(this.speed * dt * 0.2);

    // 碰撞检测
    if (this.checkCollision()) {
      this.gameOver();
      return;
    }

    // 检查通关
    if (this.progress >= 100) {
      this.isWin = true;
      this.gameOver();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景渐变
    this.renderBackground(ctx, w, h);

    // 天花板
    this.renderCeiling(ctx, w);

    // 地面
    this.renderGround(ctx, w);

    // 障碍物
    this.renderObstacles(ctx);

    // 玩家
    this.renderPlayer(ctx);

    // 死亡粒子
    this.renderParticles(ctx);

    // 死亡遮罩
    if (this.showingDeathAnimation) {
      this.renderDeathOverlay(ctx, w, h);
    }

    // 进度条
    this.renderProgressBar(ctx, w);

    // 分数和关卡信息
    this.renderHUD(ctx, w);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.jumpKeyPressed = true;

      // 如果在 gameover 状态，按空格重新开始
      if (this._status === 'gameover') {
        this.restart();
        return;
      }
    }

    if (key === 'r' || key === 'R') {
      if (this._status === 'playing' || this._status === 'gameover') {
        this.restart();
      }
    }

    if (this._status !== 'playing') return;

    if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.jump();
    }
  }

  handleKeyUp(key: string): void {
    if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
      this.jumpKeyPressed = false;
    }
  }

  getState(): Record<string, unknown> {
    return {
      playerY: this.player.y,
      playerVelocity: this.player.velocity,
      playerState: this.player.state,
      playerRotation: this.player.rotation,
      scrollOffset: this.scrollOffset,
      speed: this.speed,
      progress: this.progress,
      obstacleCount: this.obstacles.length,
      currentLevel: this.currentLevelIndex + 1,
      attempts: this.attempts,
      isWin: this.isWin,
      score: this._score,
    };
  }

  // ========== 公共方法（供测试和外部调用） ==========

  /** 获取玩家状态 */
  getPlayerState(): { y: number; velocity: number; state: PlayerState; rotation: number } {
    return {
      y: this.player.y,
      velocity: this.player.velocity,
      state: this.player.state,
      rotation: this.player.rotation,
    };
  }

  /** 获取当前速度 */
  getCurrentSpeed(): number {
    return this.speed;
  }

  /** 获取进度百分比 */
  getProgress(): number {
    return this.progress;
  }

  /** 获取障碍物列表 */
  getObstacles(): ObstacleInstance[] {
    return [...this.obstacles];
  }

  /** 获取当前关卡索引 */
  getCurrentLevelIndex(): number {
    return this.currentLevelIndex;
  }

  /** 获取当前关卡 */
  getCurrentLevel(): LevelDefinition {
    return this.currentLevel;
  }

  /** 获取尝试次数 */
  getAttempts(): number {
    return this.attempts;
  }

  /** 设置关卡（供测试使用） */
  setLevel(levelIndex: number): void {
    if (levelIndex >= 0 && levelIndex < LEVELS.length) {
      this.currentLevelIndex = levelIndex;
      this.currentLevel = LEVELS[levelIndex];
    }
  }

  /** 获取关卡总数 */
  getTotalLevels(): number {
    return LEVELS.length;
  }

  /** 获取滚动偏移量 */
  getScrollOffset(): number {
    return this.scrollOffset;
  }

  /** 是否正在显示死亡动画 */
  isShowingDeathAnimation(): boolean {
    return this.showingDeathAnimation;
  }

  /** 获取死亡粒子列表 */
  getParticles(): Particle[] {
    return [...this.particles];
  }

  /** 手动触发跳跃（供测试使用） */
  performJump(): void {
    this.jump();
  }

  /** 设置长按状态（供测试使用） */
  setJumpKeyPressed(pressed: boolean): void {
    this.jumpKeyPressed = pressed;
  }

  /** 获取玩家碰撞盒（供测试使用） */
  getPlayerHitbox(): { x: number; y: number; width: number; height: number } {
    return this.calcPlayerHitbox();
  }

  /** 获取障碍物碰撞盒（供测试使用） */
  getObstacleHitbox(obs: ObstacleInstance): { x: number; y: number; width: number; height: number } {
    return this.calcObstacleHitbox(obs);
  }

  /** 矩形碰撞检测（供测试使用） */
  static rectsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  // ========== 私有方法：初始化 ==========

  private createPlayer(): Player {
    return {
      x: PLAYER_X,
      y: GROUND_Y - PLAYER_SIZE,
      velocity: 0,
      rotation: 0,
      state: 'grounded',
    };
  }

  private initGroundLines(): void {
    this.groundLines = [];
    for (let x = 0; x < CANVAS_WIDTH + GROUND_PATTERN_SPACING; x += GROUND_PATTERN_SPACING / 2) {
      this.groundLines.push({
        x,
        width: 8 + Math.random() * 20,
      });
    }
  }

  /** 加载当前关卡的所有障碍物到运行时列表 */
  private loadLevelObstacles(): void {
    this.obstacles = [];
    const level = this.currentLevel;
    for (const def of level.obstacles) {
      this.obstacles.push({
        type: def.type,
        x: def.x, // 初始位置（相对于世界坐标）
        y: GROUND_Y - def.height - def.yOffset,
        width: def.width,
        height: def.height,
        passed: false,
      });
    }
  }

  // ========== 私有方法：更新 ==========

  private updatePlayer(dt: number): void {
    if (this.player.state === 'dead') return;

    // 应用重力
    this.player.velocity += GRAVITY * dt;

    // 长按额外力（在上升阶段按住跳更高）
    if (this.jumpKeyPressed && this.player.velocity < 0) {
      this.player.velocity += LONG_PRESS_EXTRA_FORCE * dt;
    }

    // 限制速度
    this.player.velocity = Math.max(MAX_UPWARD_VELOCITY, Math.min(MAX_FALL_VELOCITY, this.player.velocity));

    // 更新位置
    this.player.y += this.player.velocity * dt;

    // 地面碰撞
    const groundLevel = GROUND_Y - PLAYER_SIZE;
    if (this.player.y >= groundLevel) {
      this.player.y = groundLevel;
      this.player.velocity = 0;
      this.player.state = 'grounded';
      this.player.rotation = Math.round(this.player.rotation / 90) * 90; // 对齐到 90 度
    }

    // 天花板碰撞
    if (this.player.y <= CEILING_Y) {
      this.player.y = CEILING_Y;
      this.player.velocity = 0;
    }

    // 空中旋转
    if (this.player.state === 'jumping') {
      this.player.rotation += this.speed * dt * 3; // 旋转速度与游戏速度相关
    }
  }

  private updateScroll(dt: number): void {
    this.scrollOffset += this.speed * dt;
  }

  private updateObstacles(dt: number): void {
    // 障碍物位置是相对于世界坐标的，需要减去滚动偏移量来得到屏幕坐标
    // 不需要单独移动障碍物，在渲染和碰撞时计算屏幕位置
  }

  private updateGroundLines(dt: number): void {
    for (const line of this.groundLines) {
      line.x -= this.speed * dt;
      if (line.x + line.width < 0) {
        line.x = CANVAS_WIDTH + Math.random() * GROUND_PATTERN_SPACING;
        line.width = 8 + Math.random() * 20;
      }
    }
  }

  private updateProgress(): void {
    const levelLength = this.currentLevel.length;
    this.progress = Math.min(PROGRESS_SCALE, (this.scrollOffset / levelLength) * PROGRESS_SCALE);
  }

  private updateSpeed(): void {
    const progressInterval = Math.floor(this.progress / SPEED_INCREMENT_INTERVAL);
    this.speed = Math.min(MAX_SPEED, INITIAL_SPEED + progressInterval * SPEED_INCREMENT);
  }

  private updateParticles(deltaTime: number): void {
    for (const p of this.particles) {
      p.x += p.vx * (deltaTime / 16.667);
      p.y += p.vy * (deltaTime / 16.667);
      p.vy += 0.3 * (deltaTime / 16.667); // 粒子重力
      p.life -= deltaTime;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ========== 私有方法：跳跃 ==========

  private jump(): void {
    if (this._status !== 'playing') return;
    if (this.player.state === 'grounded') {
      this.player.state = 'jumping';
      this.player.velocity = JUMP_FORCE;
    }
  }

  /** 重新开始当前关卡 */
  private restart(): void {
    this.reset();
    this.start();
  }

  // ========== 私有方法：碰撞检测 ==========

  private checkCollision(): boolean {
    const playerBox = this.calcPlayerHitbox();

    for (const obs of this.obstacles) {
      // 计算障碍物的屏幕 X 坐标
      const screenX = obs.x - this.scrollOffset + PLAYER_X; // 障碍物相对于玩家的位置

      // 跳过不在屏幕附近的障碍物
      if (screenX + obs.width < -50 || screenX > CANVAS_WIDTH + 50) continue;

      const obsBox = this.calcObstacleHitboxAt(obs, screenX);

      if (GeometryDashEngine.rectsOverlap(playerBox, obsBox)) {
        return true;
      }
    }

    return false;
  }

  private calcPlayerHitbox(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.player.x + HITBOX_SHRINK,
      y: this.player.y + HITBOX_SHRINK,
      width: PLAYER_SIZE - HITBOX_SHRINK * 2,
      height: PLAYER_SIZE - HITBOX_SHRINK * 2,
    };
  }

  private calcObstacleHitbox(obs: ObstacleInstance): { x: number; y: number; width: number; height: number } {
    const screenX = obs.x - this.scrollOffset + PLAYER_X;
    return this.calcObstacleHitboxAt(obs, screenX);
  }

  private calcObstacleHitboxAt(
    obs: ObstacleInstance,
    screenX: number,
  ): { x: number; y: number; width: number; height: number } {
    if (obs.type === ObstacleType.SPIKE) {
      // 尖刺的碰撞盒比视觉略小（三角形底部）
      return {
        x: screenX + HITBOX_SHRINK + 4,
        y: obs.y + HITBOX_SHRINK + 4,
        width: obs.width - HITBOX_SHRINK * 2 - 8,
        height: obs.height - HITBOX_SHRINK * 2 - 4,
      };
    }
    return {
      x: screenX + HITBOX_SHRINK,
      y: obs.y + HITBOX_SHRINK,
      width: obs.width - HITBOX_SHRINK * 2,
      height: obs.height - HITBOX_SHRINK * 2,
    };
  }

  // ========== 私有方法：粒子 ==========

  private spawnDeathParticles(): void {
    this.particles = [];
    for (let i = 0; i < DEATH_PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / DEATH_PARTICLE_COUNT + Math.random() * 0.5;
      const speed = PARTICLE_MIN_SPEED + Math.random() * (PARTICLE_MAX_SPEED - PARTICLE_MIN_SPEED);
      this.particles.push({
        x: this.player.x + PLAYER_SIZE / 2,
        y: this.player.y + PLAYER_SIZE / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: PARTICLE_LIFETIME + Math.random() * 200,
        maxLife: PARTICLE_LIFETIME + Math.random() * 200,
        size: 3 + Math.random() * 5,
      });
    }
  }

  // ========== 私有方法：渲染 ==========

  private renderBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, BG_GRADIENT_TOP);
    gradient.addColorStop(1, BG_GRADIENT_BOTTOM);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 背景星星效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    const starSeed = Math.floor(this.scrollOffset * 0.01);
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137 + starSeed * 7) % w);
      const sy = ((i * 97 + 13) % (GROUND_Y - 100)) + 50;
      const size = (i % 3 === 0) ? 2 : 1;
      ctx.fillRect(sx, sy, size, size);
    }
  }

  private renderCeiling(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = CEILING_COLOR;
    ctx.fillRect(0, 0, w, CEILING_Y);

    // 天花板底线
    ctx.strokeStyle = GROUND_LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, CEILING_Y);
    ctx.lineTo(w, CEILING_Y);
    ctx.stroke();
  }

  private renderGround(ctx: CanvasRenderingContext2D, w: number): void {
    // 地面区域
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, GROUND_Y, w, CANVAS_HEIGHT - GROUND_Y);

    // 地面顶线（发光效果）
    ctx.strokeStyle = GROUND_LINE_COLOR;
    ctx.lineWidth = 3;
    ctx.shadowColor = GROUND_LINE_COLOR;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(w, GROUND_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 地面装饰线段
    ctx.strokeStyle = GROUND_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (const line of this.groundLines) {
      if (line.x >= 0 && line.x <= w) {
        ctx.beginPath();
        ctx.moveTo(line.x, GROUND_Y + 10 + (Math.random() * 4));
        ctx.lineTo(line.x + line.width, GROUND_Y + 10 + (Math.random() * 4));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private renderObstacles(ctx: CanvasRenderingContext2D): void {
    for (const obs of this.obstacles) {
      const screenX = obs.x - this.scrollOffset + PLAYER_X;

      // 只渲染屏幕内的障碍物
      if (screenX + obs.width < -10 || screenX > CANVAS_WIDTH + 10) continue;

      switch (obs.type) {
        case ObstacleType.SPIKE:
          this.renderSpike(ctx, screenX, obs.y, obs.width, obs.height);
          break;
        case ObstacleType.BLOCK:
          this.renderBlock(ctx, screenX, obs.y, obs.width, obs.height);
          break;
        case ObstacleType.PILLAR:
          this.renderPillar(ctx, screenX, obs.y, obs.width, obs.height);
          break;
      }
    }
  }

  private renderSpike(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = SPIKE_COLOR;
    ctx.strokeStyle = '#ff6b81';
    ctx.lineWidth = 2;

    // 三角形尖刺
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y); // 顶点
    ctx.lineTo(x + w, y + h); // 右下
    ctx.lineTo(x, y + h); // 左下
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 内部高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.3);
    ctx.lineTo(x + w * 0.65, y + h);
    ctx.lineTo(x + w * 0.35, y + h);
    ctx.closePath();
    ctx.fill();
  }

  private renderBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = BLOCK_COLOR;
    ctx.strokeStyle = '#ff8a9e';
    ctx.lineWidth = 2;

    // 方块
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // 内部 X 纹路
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + w - 4, y + h - 4);
    ctx.moveTo(x + w - 4, y + 4);
    ctx.lineTo(x + 4, y + h - 4);
    ctx.stroke();
  }

  private renderPillar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = PILLAR_COLOR;
    ctx.strokeStyle = '#ff6b81';
    ctx.lineWidth = 2;

    // 柱子
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // 水平条纹
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let ly = y + 12; ly < y + h; ly += 12) {
      ctx.beginPath();
      ctx.moveTo(x + 2, ly);
      ctx.lineTo(x + w - 2, ly);
      ctx.stroke();
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    if (this.player.state === 'dead' && this.particles.length > 0) return; // 死亡后不显示方块

    ctx.save();
    const cx = this.player.x + PLAYER_SIZE / 2;
    const cy = this.player.y + PLAYER_SIZE / 2;

    ctx.translate(cx, cy);
    ctx.rotate((this.player.rotation * Math.PI) / 180);

    // 方块主体
    ctx.fillStyle = PLAYER_COLOR;
    ctx.shadowColor = PLAYER_COLOR;
    ctx.shadowBlur = 10;
    ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = PLAYER_OUTLINE_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);

    // 内部图标（小方块）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(-PLAYER_SIZE / 4, -PLAYER_SIZE / 4, PLAYER_SIZE / 2, PLAYER_SIZE / 2);

    ctx.restore();
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

  private renderDeathOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = DEATH_OVERLAY_COLOR;
    ctx.fillRect(0, 0, w, h);
  }

  private renderProgressBar(ctx: CanvasRenderingContext2D, w: number): void {
    const barWidth = w - 40;
    const barHeight = 8;
    const barX = 20;
    const barY = 16;

    // 背景
    ctx.fillStyle = PROGRESS_BAR_BG;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // 进度填充
    const fillWidth = (barWidth * this.progress) / PROGRESS_SCALE;
    ctx.fillStyle = PROGRESS_BAR_FILL;
    ctx.shadowColor = PROGRESS_BAR_FILL;
    ctx.shadowBlur = 6;
    ctx.fillRect(barX, barY, fillWidth, barHeight);
    ctx.shadowBlur = 0;

    // 百分比文字
    ctx.fillStyle = PROGRESS_TEXT_COLOR;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(this.progress)}%`, w / 2, barY + barHeight + 14);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`分数: ${Math.floor(this._score)}`, w - 20, 55);

    // 关卡名称
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'left';
    ctx.fillText(`关卡 ${this.currentLevelIndex + 1}: ${this.currentLevel.name}`, 20, 55);

    // 尝试次数
    if (this.attempts > 1) {
      ctx.textAlign = 'right';
      ctx.fillText(`尝试 #${this.attempts}`, w - 20, 72);
    }
  }

  // ========== 按键状态追踪 ==========
  private keysDown: Set<string> = new Set();
}
