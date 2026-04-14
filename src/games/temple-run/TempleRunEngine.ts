import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  LANE_COUNT,
  LANE_SPACING,
  CENTER_LANE_X,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_Y,
  PLAYER_SWITCH_SPEED,
  GRAVITY,
  JUMP_FORCE,
  SLIDE_DURATION,
  INITIAL_SPEED,
  SPEED_INCREMENT,
  SPEED_INCREMENT_SCORE,
  MAX_SPEED,
  OBSTACLE_WIDTH,
  OBSTACLE_HEIGHT_HIGH,
  OBSTACLE_HEIGHT_LOW,
  OBSTACLE_HEIGHT_FULL,
  MIN_OBSTACLE_INTERVAL,
  MAX_OBSTACLE_INTERVAL,
  OBSTACLE_SPAWN_Y,
  COIN_SIZE,
  COIN_SCORE,
  COIN_SPAWN_INTERVAL,
  MIN_COIN_INTERVAL,
  HITBOX_SHRINK,
  HORIZON_Y,
  GROUND_Y,
  PERSPECTIVE_RATIO,
  BG_COLOR,
  GROUND_COLOR,
  LANE_COLOR,
  LANE_LINE_COLOR,
  PLAYER_COLOR,
  OBSTACLE_HIGH_COLOR,
  OBSTACLE_LOW_COLOR,
  OBSTACLE_FULL_COLOR,
  COIN_COLOR,
  COIN_GLOW_COLOR,
  SCORE_COLOR,
  SKY_COLOR_TOP,
  SKY_COLOR_BOTTOM,
  ObstacleType,
} from './constants';

// ========== 类型定义 ==========

/** 角色状态 */
type PlayerState = 'running' | 'jumping' | 'sliding';

/** 角色对象 */
interface Player {
  lane: number; // 当前跑道 (0=左, 1=中, 2=右)
  targetLane: number;
  x: number;
  y: number;
  velocity: number;
  state: PlayerState;
  slideTimer: number;
  animFrame: number;
  animTimer: number;
}

/** 障碍物对象 */
interface Obstacle {
  type: ObstacleType;
  lane: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 金币对象 */
interface Coin {
  lane: number;
  x: number;
  y: number;
  collected: boolean;
  animPhase: number;
}

/** 粒子效果 */
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

// ========== Temple Run Lite 引擎 ==========

export class TempleRunEngine extends GameEngine {
  // 角色
  private player: Player = this.createPlayer();

  // 障碍物列表
  private obstacles: Obstacle[] = [];

  // 金币列表
  private coins: Coin[] = [];

  // 粒子效果
  private particles: Particle[] = [];

  // 当前游戏速度
  private speed: number = INITIAL_SPEED;

  // 障碍物生成计时器
  private obstacleTimer: number = 0;
  private nextObstacleInterval: number = MIN_OBSTACLE_INTERVAL;

  // 金币生成计时器
  private coinTimer: number = 0;

  // 距离分数
  private distance: number = 0;

  // 按键状态
  private keysDown: Set<string> = new Set();

  // 跑道偏移（用于滚动效果）
  private groundOffset: number = 0;

  // ========== 生命周期 ==========

  protected onInit(): void {
    // 初始化
  }

  protected onStart(): void {
    this.player = this.createPlayer();
    this.obstacles = [];
    this.coins = [];
    this.particles = [];
    this.speed = INITIAL_SPEED;
    this.obstacleTimer = 0;
    this.nextObstacleInterval = this.randomInterval();
    this.coinTimer = 0;
    this.distance = 0;
    this.groundOffset = 0;
    this.keysDown.clear();
  }

  protected onReset(): void {
    this.player = this.createPlayer();
    this.obstacles = [];
    this.coins = [];
    this.particles = [];
    this.speed = INITIAL_SPEED;
    this.obstacleTimer = 0;
    this.nextObstacleInterval = this.randomInterval();
    this.coinTimer = 0;
    this.distance = 0;
    this.groundOffset = 0;
    this.keysDown.clear();
  }

  // ========== 更新逻辑 ==========

  protected update(deltaTime: number): void {
    const dt = deltaTime / 16.667; // 标准化到 60fps

    // 更新角色跑道切换
    this.updatePlayerLane(dt);

    // 更新角色物理
    this.updatePlayer(dt, deltaTime);

    // 更新障碍物
    this.updateObstacles(dt);

    // 更新金币
    this.updateCoins(dt);

    // 更新粒子
    this.updateParticles(dt);

    // 更新地面滚动
    this.updateGround(dt);

    // 距离计分
    this.distance += this.speed * dt * 0.1;
    this.addScore(this.speed * dt * 0.05);

    // 难度递增
    this.updateDifficulty();

    // 金币收集
    this.checkCoinCollection();

    // 碰撞检测
    if (this.checkCollision()) {
      this.gameOver();
    }
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空渐变
    this.renderSky(ctx, w, h);

    // 跑道
    this.renderTrack(ctx, w, h);

    // 金币
    this.renderCoins(ctx);

    // 障碍物
    this.renderObstacles(ctx);

    // 角色
    this.renderPlayer(ctx);

    // 粒子效果
    this.renderParticles(ctx);

    // HUD
    this.renderHUD(ctx, w);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    this.keysDown.add(key);

    if (this._status !== 'playing') return;

    switch (key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.switchLane(-1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.switchLane(1);
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ':
        this.jump();
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.slide();
        break;
    }
  }

  handleKeyUp(key: string): void {
    this.keysDown.delete(key);
  }

  getState(): Record<string, unknown> {
    return {
      playerLane: this.player.lane,
      playerX: this.player.x,
      playerY: this.player.y,
      playerState: this.player.state,
      speed: this.speed,
      distance: this.distance,
      obstacleCount: this.obstacles.length,
      coinCount: this.coins.filter(c => !c.collected).length,
      score: this._score,
    };
  }

  // ========== 公共方法 ==========

  /** 获取角色状态 */
  getPlayerState(): { lane: number; x: number; y: number; state: PlayerState } {
    return {
      lane: this.player.lane,
      x: this.player.x,
      y: this.player.y,
      state: this.player.state,
    };
  }

  /** 获取当前速度 */
  getCurrentSpeed(): number {
    return this.speed;
  }

  /** 获取障碍物列表 */
  getObstacles(): Obstacle[] {
    return [...this.obstacles];
  }

  /** 获取金币列表 */
  getCoins(): Coin[] {
    return [...this.coins];
  }

  /** 获取距离 */
  getDistance(): number {
    return this.distance;
  }

  // ========== 私有方法：初始化 ==========

  private createPlayer(): Player {
    return {
      lane: 1,
      targetLane: 1,
      x: CENTER_LANE_X,
      y: PLAYER_Y - PLAYER_HEIGHT,
      velocity: 0,
      state: 'running',
      slideTimer: 0,
      animFrame: 0,
      animTimer: 0,
    };
  }

  /** 获取跑道中心 x 坐标 */
  private getLaneX(lane: number): number {
    return CENTER_LANE_X + (lane - 1) * LANE_SPACING;
  }

  // ========== 私有方法：更新 ==========

  private updatePlayerLane(dt: number): void {
    const targetX = this.getLaneX(this.player.targetLane);
    const diff = targetX - this.player.x;
    if (Math.abs(diff) > 1) {
      this.player.x += Math.sign(diff) * PLAYER_SWITCH_SPEED * dt;
      // 防止越过目标
      if (Math.abs(this.player.x - targetX) < PLAYER_SWITCH_SPEED * dt) {
        this.player.x = targetX;
      }
    } else {
      this.player.x = targetX;
      this.player.lane = this.player.targetLane;
    }
  }

  private updatePlayer(dt: number, deltaTime: number): void {
    if (this.player.state === 'jumping') {
      // 应用重力
      this.player.velocity += GRAVITY * dt;
      this.player.y += this.player.velocity * dt;

      // 落地检测
      const groundLevel = PLAYER_Y - PLAYER_HEIGHT;
      if (this.player.y >= groundLevel) {
        this.player.y = groundLevel;
        this.player.velocity = 0;
        this.player.state = 'running';
      }
    } else if (this.player.state === 'sliding') {
      // 滑铲计时
      this.player.slideTimer -= deltaTime;
      if (this.player.slideTimer <= 0) {
        this.player.state = 'running';
        this.player.y = PLAYER_Y - PLAYER_HEIGHT;
      }
    }

    // 跑步动画
    if (this.player.state === 'running') {
      this.player.animTimer += deltaTime;
      if (this.player.animTimer >= 100) {
        this.player.animTimer = 0;
        this.player.animFrame = (this.player.animFrame + 1) % 4;
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
      obs.y += this.speed * dt;
    }

    // 移除屏幕外障碍物
    this.obstacles = this.obstacles.filter(obs => obs.y < GROUND_Y + 100);
  }

  private updateCoins(dt: number): void {
    // 生成新金币
    this.coinTimer += 16.667 * dt;
    if (this.coinTimer >= COIN_SPAWN_INTERVAL) {
      this.coinTimer = 0;
      this.spawnCoin();
    }

    // 移动金币
    for (const coin of this.coins) {
      if (!coin.collected) {
        coin.y += this.speed * dt;
        coin.animPhase += dt * 0.1;
      }
    }

    // 移除屏幕外金币
    this.coins = this.coins.filter(c => c.y < GROUND_Y + 100 && !c.collected);
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  private updateGround(dt: number): void {
    this.groundOffset = (this.groundOffset + this.speed * dt) % 40;
  }

  private updateDifficulty(): void {
    const level = Math.floor(this._score / SPEED_INCREMENT_SCORE);
    this.speed = Math.min(MAX_SPEED, INITIAL_SPEED + level * SPEED_INCREMENT);
  }

  // ========== 私有方法：生成 ==========

  private spawnObstacle(): void {
    const rand = Math.random();
    const lane = Math.floor(Math.random() * LANE_COUNT);
    let obstacle: Obstacle;

    if (rand < 0.35) {
      // 高障碍 - 需要滑铲
      obstacle = {
        type: ObstacleType.HIGH,
        lane,
        x: this.getLaneX(lane),
        y: OBSTACLE_SPAWN_Y,
        width: OBSTACLE_WIDTH,
        height: OBSTACLE_HEIGHT_HIGH,
      };
    } else if (rand < 0.7) {
      // 低障碍 - 需要跳跃
      obstacle = {
        type: ObstacleType.LOW,
        lane,
        x: this.getLaneX(lane),
        y: OBSTACLE_SPAWN_Y,
        width: OBSTACLE_WIDTH,
        height: OBSTACLE_HEIGHT_LOW,
      };
    } else {
      // 全宽障碍 - 需要切换跑道
      obstacle = {
        type: ObstacleType.FULL,
        lane,
        x: this.getLaneX(lane),
        y: OBSTACLE_SPAWN_Y,
        width: OBSTACLE_WIDTH,
        height: OBSTACLE_HEIGHT_FULL,
      };
    }

    this.obstacles.push(obstacle);
  }

  private spawnCoin(): void {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    this.coins.push({
      lane,
      x: this.getLaneX(lane),
      y: OBSTACLE_SPAWN_Y,
      collected: false,
      animPhase: 0,
    });
  }

  // ========== 私有方法：碰撞检测 ==========

  private checkCollision(): boolean {
    const playerBox = this.getPlayerHitbox();

    for (const obs of this.obstacles) {
      // 只检测在角色附近的障碍物
      if (obs.y + obs.height < PLAYER_Y - PLAYER_HEIGHT - 20 || obs.y > PLAYER_Y + 10) continue;

      const obsBox = {
        x: obs.x - obs.width / 2 + HITBOX_SHRINK,
        y: obs.y + HITBOX_SHRINK,
        width: obs.width - HITBOX_SHRINK * 2,
        height: obs.height - HITBOX_SHRINK * 2,
      };

      if (this.rectsOverlap(playerBox, obsBox)) {
        // 根据障碍物类型和角色状态判断是否有效碰撞
        if (obs.type === ObstacleType.HIGH) {
          // 高障碍：滑铲可以躲避
          if (this.player.state === 'sliding') continue;
        } else if (obs.type === ObstacleType.LOW) {
          // 低障碍：跳跃可以躲避
          if (this.player.state === 'jumping' && this.player.y < PLAYER_Y - PLAYER_HEIGHT - obs.height) continue;
        }
        // 全宽障碍必须切换跑道
        if (obs.type === ObstacleType.FULL && obs.lane !== this.player.lane) continue;
        if (obs.type !== ObstacleType.FULL) {
          if (obs.lane !== this.player.lane) continue;
        }
        return true;
      }
    }

    return false;
  }

  private getPlayerHitbox(): { x: number; y: number; width: number; height: number } {
    if (this.player.state === 'sliding') {
      return {
        x: this.player.x - PLAYER_WIDTH / 2 + HITBOX_SHRINK,
        y: PLAYER_Y - 20 + HITBOX_SHRINK,
        width: PLAYER_WIDTH - HITBOX_SHRINK * 2,
        height: 20 - HITBOX_SHRINK * 2,
      };
    }
    return {
      x: this.player.x - PLAYER_WIDTH / 2 + HITBOX_SHRINK,
      y: this.player.y + HITBOX_SHRINK,
      width: PLAYER_WIDTH - HITBOX_SHRINK * 2,
      height: PLAYER_HEIGHT - HITBOX_SHRINK * 2,
    };
  }

  private rectsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  private checkCoinCollection(): void {
    const playerBox = this.getPlayerHitbox();

    for (const coin of this.coins) {
      if (coin.collected) continue;

      const coinBox = {
        x: coin.x - COIN_SIZE / 2,
        y: coin.y - COIN_SIZE / 2,
        width: COIN_SIZE,
        height: COIN_SIZE,
      };

      if (this.rectsOverlap(playerBox, coinBox)) {
        coin.collected = true;
        this.addScore(COIN_SCORE);
        // 生成收集粒子
        this.spawnCoinParticles(coin.x, coin.y);
      }
    }
  }

  // ========== 私有方法：动作 ==========

  private switchLane(direction: number): void {
    const newLane = this.player.targetLane + direction;
    if (newLane >= 0 && newLane < LANE_COUNT) {
      this.player.targetLane = newLane;
    }
  }

  private jump(): void {
    if (this._status !== 'playing') return;
    if (this.player.state === 'running') {
      this.player.state = 'jumping';
      this.player.velocity = JUMP_FORCE;
    }
  }

  private slide(): void {
    if (this._status !== 'playing') return;
    if (this.player.state === 'running') {
      this.player.state = 'sliding';
      this.player.slideTimer = SLIDE_DURATION;
      this.player.y = PLAYER_Y - 20; // 滑铲时身体变矮
    }
  }

  // ========== 私有方法：粒子 ==========

  private spawnCoinParticles(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        life: 20,
        maxLife: 20,
        color: COIN_COLOR,
        size: 3,
      });
    }
  }

  // ========== 私有方法：工具 ==========

  private randomInterval(): number {
    return MIN_OBSTACLE_INTERVAL + Math.random() * (MAX_OBSTACLE_INTERVAL - MIN_OBSTACLE_INTERVAL);
  }

  // ========== 私有方法：渲染 ==========

  private renderSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    gradient.addColorStop(0, SKY_COLOR_TOP);
    gradient.addColorStop(1, SKY_COLOR_BOTTOM);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, HORIZON_Y);
  }

  private renderTrack(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 地面
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, HORIZON_Y, w, h - HORIZON_Y);

    // 跑道（透视效果）
    const leftEdge = CENTER_LANE_X - LANE_SPACING * 1.8;
    const rightEdge = CENTER_LANE_X + LANE_SPACING * 1.8;

    // 跑道主体
    ctx.fillStyle = GROUND_COLOR;
    ctx.beginPath();
    ctx.moveTo(CENTER_LANE_X - 20, HORIZON_Y);
    ctx.lineTo(CENTER_LANE_X + 20, HORIZON_Y);
    ctx.lineTo(rightEdge + 40, GROUND_Y);
    ctx.lineTo(leftEdge - 40, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // 跑道分隔线
    ctx.strokeStyle = LANE_LINE_COLOR;
    ctx.lineWidth = 2;

    for (let i = 0; i <= LANE_COUNT; i++) {
      const bottomX = CENTER_LANE_X + (i - 1.5) * LANE_SPACING - LANE_SPACING / 2 + LANE_SPACING;
      const topX = CENTER_LANE_X + (i - 1.5) * 2;
      ctx.beginPath();
      ctx.moveTo(topX, HORIZON_Y);
      ctx.lineTo(bottomX, GROUND_Y);
      ctx.stroke();
    }

    // 横线（距离标记，滚动效果）
    ctx.strokeStyle = LANE_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (let y = HORIZON_Y; y < GROUND_Y; y += 40) {
      const adjustedY = y + this.groundOffset;
      if (adjustedY > GROUND_Y) continue;
      const t = (adjustedY - HORIZON_Y) / (GROUND_Y - HORIZON_Y);
      const halfWidth = 20 + t * (LANE_SPACING * 1.8);
      ctx.beginPath();
      ctx.moveTo(CENTER_LANE_X - halfWidth, adjustedY);
      ctx.lineTo(CENTER_LANE_X + halfWidth, adjustedY);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const x = this.player.x;
    const y = this.player.y;

    if (this.player.state === 'sliding') {
      // 滑铲姿态
      ctx.fillStyle = PLAYER_COLOR;
      ctx.fillRect(x - PLAYER_WIDTH / 2, PLAYER_Y - 20, PLAYER_WIDTH, 16);

      // 头部
      ctx.beginPath();
      ctx.arc(x + PLAYER_WIDTH / 2 - 5, PLAYER_Y - 24, 8, 0, Math.PI * 2);
      ctx.fill();

      // 滑铲火花
      ctx.fillStyle = '#ff6';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(
          x - PLAYER_WIDTH / 2 - 5 - Math.random() * 10,
          PLAYER_Y - 8 + Math.random() * 6,
          3,
          2
        );
      }
    } else {
      // 身体
      ctx.fillStyle = PLAYER_COLOR;
      ctx.fillRect(x - 12, y + 20, 24, 30);

      // 头部
      ctx.beginPath();
      ctx.arc(x, y + 12, 12, 0, Math.PI * 2);
      ctx.fill();

      // 眼睛
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 3, y + 9, 4, 4);

      // 腿部（跑步动画）
      const frame = this.player.animFrame;
      ctx.fillStyle = PLAYER_COLOR;
      if (this.player.state === 'jumping') {
        // 跳跃时腿部收起
        ctx.fillRect(x - 10, y + 50, 8, 8);
        ctx.fillRect(x + 2, y + 50, 8, 8);
      } else {
        // 跑步时腿部交替
        const legOffset = (frame % 2 === 0) ? 5 : -5;
        ctx.fillRect(x - 10, y + 50, 8, 10 + legOffset);
        ctx.fillRect(x + 2, y + 50, 8, 10 - legOffset);
      }

      // 手臂
      ctx.strokeStyle = PLAYER_COLOR;
      ctx.lineWidth = 4;
      const armSwing = this.player.state === 'running' ? Math.sin(frame * Math.PI / 2) * 8 : 0;
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 25);
      ctx.lineTo(x - 20, y + 35 + armSwing);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 25);
      ctx.lineTo(x + 20, y + 35 - armSwing);
      ctx.stroke();
    }
  }

  private renderObstacles(ctx: CanvasRenderingContext2D): void {
    for (const obs of this.obstacles) {
      // 根据深度计算透视缩放
      const t = Math.max(0, (obs.y - HORIZON_Y) / (GROUND_Y - HORIZON_Y));
      const scale = 0.3 + t * 0.7;

      let color: string;
      switch (obs.type) {
        case ObstacleType.HIGH: color = OBSTACLE_HIGH_COLOR; break;
        case ObstacleType.LOW: color = OBSTACLE_LOW_COLOR; break;
        case ObstacleType.FULL: color = OBSTACLE_FULL_COLOR; break;
      }

      ctx.fillStyle = color;
      const w = obs.width * scale;
      const h = obs.height * scale;
      const drawX = obs.x - w / 2;
      const drawY = obs.y;

      if (obs.type === ObstacleType.HIGH) {
        // 高障碍 - 石柱
        ctx.fillRect(drawX, drawY, w, h);
        ctx.fillStyle = '#000';
        ctx.globalAlpha = 0.2;
        ctx.fillRect(drawX + 2, drawY + 2, w - 4, h - 4);
        ctx.globalAlpha = 1;
        // 顶部装饰
        ctx.fillStyle = color;
        ctx.fillRect(drawX - 3, drawY, w + 6, 6);
      } else if (obs.type === ObstacleType.LOW) {
        // 低障碍 - 横木
        ctx.fillRect(drawX, drawY, w, h);
        // 条纹
        ctx.fillStyle = '#000';
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < w; i += 10) {
          ctx.fillRect(drawX + i, drawY, 5, h);
        }
        ctx.globalAlpha = 1;
      } else {
        // 全宽障碍 - 墙壁
        ctx.fillRect(drawX - 10, drawY, w + 20, h);
        // 砖块纹理
        ctx.strokeStyle = '#000';
        ctx.globalAlpha = 0.2;
        ctx.lineWidth = 1;
        for (let row = 0; row < h; row += 10) {
          ctx.beginPath();
          ctx.moveTo(drawX - 10, drawY + row);
          ctx.lineTo(drawX + w + 10, drawY + row);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  private renderCoins(ctx: CanvasRenderingContext2D): void {
    for (const coin of this.coins) {
      if (coin.collected) continue;

      const t = Math.max(0, (coin.y - HORIZON_Y) / (GROUND_Y - HORIZON_Y));
      const scale = 0.3 + t * 0.7;
      const size = COIN_SIZE * scale;

      // 金币发光
      ctx.fillStyle = COIN_GLOW_COLOR;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // 金币本体
      ctx.fillStyle = COIN_COLOR;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, size / 2, 0, Math.PI * 2);
      ctx.fill();

      // 金币内圈
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, size / 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // 分数
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(this._score)}`, w - 20, 30);

    // 金币计数
    ctx.fillStyle = COIN_COLOR;
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`🪙 ${Math.floor((this._score - this.distance) / COIN_SCORE) || 0}`, 20, 30);

    // 速度指示
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText(`SPD ${this.speed.toFixed(1)}`, 20, 50);

    // 距离
    ctx.fillText(`${Math.floor(this.distance)}m`, w - 20, 50);
  }
}
