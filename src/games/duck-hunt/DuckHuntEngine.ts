import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  CROSSHAIR_SIZE, CROSSHAIR_SPEED, CROSSHAIR_COLOR,
  DUCK_WIDTH, DUCK_HEIGHT,
  DUCK_SPEED_BASE, DUCK_SPEED_PER_LEVEL, DUCK_SPEED_MAX,
  DUCK_SCORE_NORMAL, DUCK_SCORE_FAST, DUCK_SCORE_ZIGZAG,
  DUCK_HIT_RADIUS,
  FLIGHT_STRAIGHT, FLIGHT_WAVE, FLIGHT_RANDOM,
  DUCKS_PER_ROUND, BULLETS_PER_ROUND, INITIAL_ROUNDS,
  DUCK_SPAWN_DELAY, DUCK_ESCAPE_Y, DUCK_FALL_SPEED,
  DOG_WIDTH, DOG_HEIGHT, DOG_JUMP_DURATION, DOG_LAUGH_DURATION,
  DOG_HIDE_Y, DOG_PEAK_Y,
  GRASS_HEIGHT, GRASS_Y, GRASS_COLOR, GRASS_DARK_COLOR,
  BG_COLOR, DUCK_COLOR_NORMAL, DUCK_COLOR_FAST, DUCK_COLOR_ZIGZAG,
  DUCK_WING_COLOR, DOG_COLOR, DOG_SPOT_COLOR,
  HUD_COLOR, SCORE_COLOR, BULLET_HUD_COLOR,
  DIR_LEFT, DIR_RIGHT,
  ROUND_TRANSITION_DURATION, ROUND_RESULT_DURATION,
} from './constants';

// ========== 内部类型 ==========

/** 飞行模式 */
type FlightPattern = typeof FLIGHT_STRAIGHT | typeof FLIGHT_WAVE | typeof FLIGHT_RANDOM;

/** 鸭子状态 */
type DuckStatus = 'flying' | 'hit' | 'falling' | 'escaped' | 'dead';

/** 鸭子实体 */
interface Duck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dirX: number; // 水平朝向: DIR_LEFT 或 DIR_RIGHT
  pattern: FlightPattern;
  status: DuckStatus;
  wingTimer: number; // 翅膀扇动计时器
  waveTimer: number; // 波浪飞行计时器
  randomTimer: number; // 随机变向计时器
  fallSpeed: number;
  spawnTime: number; // 生成时间戳（用于延迟）
}

/** 猎犬状态 */
type DogPhase = 'hidden' | 'jumping' | 'peeking' | 'laughing' | 'hiding' | 'gone';

/** 猎犬实体 */
interface Dog {
  x: number;
  y: number;
  phase: DogPhase;
  timer: number; // 当前阶段计时器
}

/** 回合阶段 */
type RoundPhase = 'dogIntro' | 'playing' | 'result' | 'transition';

/** 回合统计 */
interface RoundStats {
  hits: number;
  misses: number;
  escaped: number;
}

export class DuckHuntEngine extends GameEngine {
  // ========== 游戏状态 ==========

  // 准心
  private _crosshairX: number = 0;
  private _crosshairY: number = 0;

  // 输入
  private _keys: Set<string> = new Set();
  private _shootPressed: boolean = false;

  // 鸭子
  private _ducks: Duck[] = [];
  private _ducksSpawned: number = 0; // 当前回合已生成的鸭子数
  private _ducksAlive: number = 0; // 当前回合存活的鸭子数（flying + hit + falling）

  // 子弹
  private _bullets: number = 0; // 当前回合剩余子弹数

  // 回合
  private _round: number = 1;
  private _roundPhase: RoundPhase = 'dogIntro';
  private _roundStats: RoundStats = { hits: 0, misses: 0, escaped: 0 };
  private _phaseTimer: number = 0; // 当前阶段计时器（ms）
  private _spawnTimer: number = 0; // 鸭子生成计时器（ms）
  private _roundsLeft: number = INITIAL_ROUNDS; // 剩余可玩回合数

  // 猎犬
  private _dog: Dog = {
    x: (CANVAS_WIDTH - DOG_WIDTH) / 2,
    y: DOG_HIDE_Y,
    phase: 'hidden',
    timer: 0,
  };

  // 翅膀动画帧
  private _wingFrame: number = 0;

  // ========== Public Getters ==========

  get crosshairX(): number { return this._crosshairX; }
  get crosshairY(): number { return this._crosshairY; }
  get ducks(): Duck[] { return this._ducks; }
  get bullets(): number { return this._bullets; }
  get round(): number { return this._round; }
  get roundPhase(): RoundPhase { return this._roundPhase; }
  get roundStats(): RoundStats { return { ...this._roundStats }; }
  get roundsLeft(): number { return this._roundsLeft; }
  get dog(): Dog { return this._dog; }
  get ducksSpawned(): number { return this._ducksSpawned; }
  get ducksAlive(): number { return this._ducksAlive; }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._crosshairX = CANVAS_WIDTH / 2;
    this._crosshairY = CANVAS_HEIGHT / 2;
    this._keys.clear();
    this._shootPressed = false;
    this._ducks = [];
    this._ducksSpawned = 0;
    this._ducksAlive = 0;
    this._bullets = BULLETS_PER_ROUND;
    this._round = 1;
    this._roundPhase = 'dogIntro';
    this._roundStats = { hits: 0, misses: 0, escaped: 0 };
    this._phaseTimer = 0;
    this._spawnTimer = 0;
    this._roundsLeft = INITIAL_ROUNDS;
    this._wingFrame = 0;
    this._dog = {
      x: (CANVAS_WIDTH - DOG_WIDTH) / 2,
      y: DOG_HIDE_Y,
      phase: 'hidden',
      timer: 0,
    };
  }

  protected onStart(): void {
    this.onInit();
    this.startDogIntro();
  }

  protected update(deltaTime: number): void {
    // 翅膀动画
    this._wingFrame += deltaTime * 0.005;

    switch (this._roundPhase) {
      case 'dogIntro':
        this.updateDogIntro(deltaTime);
        break;
      case 'playing':
        this.updatePlaying(deltaTime);
        break;
      case 'result':
        this.updateResult(deltaTime);
        break;
      case 'transition':
        this.updateTransition(deltaTime);
        break;
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 天空背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 云朵装饰
    this.renderClouds(ctx, w);

    // 鸭子
    for (const duck of this._ducks) {
      if (duck.status === 'dead') continue;
      this.renderDuck(ctx, duck);
    }

    // 猎犬
    if (this._dog.phase !== 'hidden' && this._dog.phase !== 'gone') {
      this.renderDog(ctx);
    }

    // 草丛（前景）
    this.renderGrass(ctx, w, h);

    // 准心（在草丛之上）
    if (this._roundPhase === 'playing') {
      this.renderCrosshair(ctx);
    }

    // HUD
    this.renderHUD(ctx, w);

    // 回合结果
    if (this._roundPhase === 'result') {
      this.renderRoundResult(ctx, w, h);
    }

    // 游戏结束
    if (this._status === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', w / 2, h / 2 - 20);
      ctx.fillStyle = HUD_COLOR;
      ctx.font = '18px monospace';
      ctx.fillText(`Score: ${this._score}  Round: ${this._round}`, w / 2, h / 2 + 20);
      ctx.font = '14px monospace';
      ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 50);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {
    this._ducks = [];
    this._ducksAlive = 0;
  }

  handleKeyDown(key: string): void {
    this._keys.add(key);
    if (key === ' ') {
      this._shootPressed = true;
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      } else if (this._roundPhase === 'playing') {
        this.shoot();
      }
    }
  }

  handleKeyUp(key: string): void {
    this._keys.delete(key);
    if (key === ' ') {
      this._shootPressed = false;
    }
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      round: this._round,
      roundPhase: this._roundPhase,
      bullets: this._bullets,
      roundsLeft: this._roundsLeft,
      ducksSpawned: this._ducksSpawned,
      ducksAlive: this._ducksAlive,
      crosshairX: this._crosshairX,
      crosshairY: this._crosshairY,
      hits: this._roundStats.hits,
      misses: this._roundStats.misses,
      escaped: this._roundStats.escaped,
      dogPhase: this._dog.phase,
    };
  }

  // ========== 回合阶段管理 ==========

  /** 开始猎犬出场动画 */
  private startDogIntro(): void {
    this._roundPhase = 'dogIntro';
    this._dog.phase = 'jumping';
    this._dog.timer = 0;
    this._dog.x = (CANVAS_WIDTH - DOG_WIDTH) / 2;
    this._dog.y = DOG_HIDE_Y;
    this.emit('dogPhaseChange', 'jumping');
  }

  /** 更新猎犬出场动画 */
  private updateDogIntro(deltaTime: number): void {
    this._dog.timer += deltaTime;

    if (this._dog.phase === 'jumping') {
      // 猎犬从草丛跳出
      const progress = Math.min(this._dog.timer / DOG_JUMP_DURATION, 1);
      // 抛物线运动
      const jumpProgress = 1 - Math.pow(1 - progress, 2); // ease-out
      this._dog.y = DOG_HIDE_Y + (DOG_PEAK_Y - DOG_HIDE_Y) * jumpProgress;

      if (progress >= 1) {
        this._dog.phase = 'peeking';
        this._dog.timer = 0;
        this._dog.y = DOG_PEAK_Y;
        this.emit('dogPhaseChange', 'peeking');
      }
    } else if (this._dog.phase === 'peeking') {
      // 猎犬短暂停留
      if (this._dog.timer >= 400) {
        this._dog.phase = 'hiding';
        this._dog.timer = 0;
        this.emit('dogPhaseChange', 'hiding');
      }
    } else if (this._dog.phase === 'hiding') {
      // 猎犬缩回草丛
      const progress = Math.min(this._dog.timer / (DOG_JUMP_DURATION * 0.6), 1);
      this._dog.y = DOG_PEAK_Y + (DOG_HIDE_Y - DOG_PEAK_Y) * progress;

      if (progress >= 1) {
        this._dog.phase = 'gone';
        this._dog.y = DOG_HIDE_Y;
        this.emit('dogPhaseChange', 'gone');
        // 猎犬动画结束，进入游戏阶段
        this.startPlaying();
      }
    }
  }

  /** 开始游戏阶段 */
  private startPlaying(): void {
    this._roundPhase = 'playing';
    this._ducks = [];
    this._ducksSpawned = 0;
    this._ducksAlive = 0;
    this._bullets = BULLETS_PER_ROUND;
    this._roundStats = { hits: 0, misses: 0, escaped: 0 };
    this._spawnTimer = 0;
    this._phaseTimer = 0;
    this.emit('roundPhaseChange', 'playing');
  }

  /** 更新游戏阶段 */
  private updatePlaying(deltaTime: number): void {
    // 1. 移动准心
    this.updateCrosshair(deltaTime / 1000);

    // 2. 生成鸭子
    this.updateSpawning(deltaTime);

    // 3. 更新鸭子
    this.updateDucks(deltaTime);

    // 4. 检查回合结束
    this.checkRoundEnd();
  }

  /** 更新回合结果显示 */
  private updateResult(deltaTime: number): void {
    this._phaseTimer += deltaTime;
    if (this._phaseTimer >= ROUND_RESULT_DURATION) {
      this.startTransition();
    }
  }

  /** 更新回合过渡 */
  private updateTransition(deltaTime: number): void {
    this._phaseTimer += deltaTime;
    if (this._phaseTimer >= ROUND_TRANSITION_DURATION) {
      this.nextRound();
    }
  }

  // ========== 准心逻辑 ==========

  private updateCrosshair(dt: number): void {
    const speed = CROSSHAIR_SPEED * dt;
    if (this._keys.has('ArrowLeft') || this._keys.has('a')) {
      this._crosshairX = Math.max(CROSSHAIR_SIZE / 2, this._crosshairX - speed);
    }
    if (this._keys.has('ArrowRight') || this._keys.has('d')) {
      this._crosshairX = Math.min(CANVAS_WIDTH - CROSSHAIR_SIZE / 2, this._crosshairX + speed);
    }
    if (this._keys.has('ArrowUp') || this._keys.has('w')) {
      this._crosshairY = Math.max(CROSSHAIR_SIZE / 2, this._crosshairY - speed);
    }
    if (this._keys.has('ArrowDown') || this._keys.has('s')) {
      this._crosshairY = Math.min(GRASS_Y - CROSSHAIR_SIZE / 2, this._crosshairY + speed);
    }
  }

  // ========== 射击逻辑 ==========

  /** 执行射击 */
  shoot(): void {
    if (this._roundPhase !== 'playing') return;
    if (this._bullets <= 0) return;

    this._bullets--;
    this.emit('bulletsChange', this._bullets);

    // 检测是否击中鸭子
    let hit = false;
    for (const duck of this._ducks) {
      if (duck.status !== 'flying') continue;
      if (this.isDuckHit(duck)) {
        this.hitDuck(duck);
        hit = true;
        break; // 一发子弹只能击中一只鸭子
      }
    }

    if (!hit) {
      this._roundStats.misses++;
      this.emit('miss');
    }
  }

  /** 判断准心是否击中鸭子 */
  private isDuckHit(duck: Duck): boolean {
    const duckCenterX = duck.x + DUCK_WIDTH / 2;
    const duckCenterY = duck.y + DUCK_HEIGHT / 2;
    const dx = this._crosshairX - duckCenterX;
    const dy = this._crosshairY - duckCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= DUCK_HIT_RADIUS;
  }

  /** 击中鸭子 */
  private hitDuck(duck: Duck): void {
    duck.status = 'hit';
    this._roundStats.hits++;

    // 根据飞行模式计分
    let points = DUCK_SCORE_NORMAL;
    if (duck.pattern === FLIGHT_RANDOM) {
      points = DUCK_SCORE_ZIGZAG;
    } else if (duck.pattern === FLIGHT_WAVE) {
      points = DUCK_SCORE_FAST;
    }
    this.addScore(points);

    this.emit('hit', { x: duck.x, y: duck.y, points });

    // 短暂延迟后开始下落
    setTimeout(() => {
      if (duck.status === 'hit') {
        duck.status = 'falling';
        duck.fallSpeed = DUCK_FALL_SPEED;
      }
    }, 200);
  }

  // ========== 鸭子生成逻辑 ==========

  private updateSpawning(deltaTime: number): void {
    if (this._ducksSpawned >= DUCKS_PER_ROUND) return;

    this._spawnTimer += deltaTime;
    if (this._spawnTimer >= DUCK_SPAWN_DELAY) {
      this._spawnTimer -= DUCK_SPAWN_DELAY;
      this.spawnDuck();
    }
  }

  /** 生成一只鸭子 */
  spawnDuck(): void {
    if (this._ducksSpawned >= DUCKS_PER_ROUND) return;

    // 随机飞行模式
    const patterns: FlightPattern[] = [FLIGHT_STRAIGHT, FLIGHT_WAVE, FLIGHT_RANDOM];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];

    // 随机方向
    const dirX = Math.random() < 0.5 ? DIR_LEFT : DIR_RIGHT;

    // 从底部草丛位置飞出
    const x = dirX === DIR_RIGHT
      ? Math.random() * (CANVAS_WIDTH * 0.3)
      : CANVAS_WIDTH * 0.7 + Math.random() * (CANVAS_WIDTH * 0.3);
    const y = GRASS_Y;

    // 速度
    const speed = Math.min(
      DUCK_SPEED_BASE + (this._round - 1) * DUCK_SPEED_PER_LEVEL,
      DUCK_SPEED_MAX
    );

    // 初始速度：向上飞，略有水平分量
    const vx = dirX * speed * (0.3 + Math.random() * 0.4);
    const vy = -speed * (0.6 + Math.random() * 0.4);

    const duck: Duck = {
      x,
      y,
      vx,
      vy,
      dirX,
      pattern,
      status: 'flying',
      wingTimer: Math.random() * 1000,
      waveTimer: 0,
      randomTimer: 0,
      fallSpeed: 0,
      spawnTime: performance.now(),
    };

    this._ducks.push(duck);
    this._ducksSpawned++;
    this._ducksAlive++;
    this.emit('duckSpawned', duck);
  }

  // ========== 鸭子更新逻辑 ==========

  private updateDucks(deltaTime: number): void {
    const dt = deltaTime / 1000;

    for (const duck of this._ducks) {
      switch (duck.status) {
        case 'flying':
          this.updateFlyingDuck(duck, dt, deltaTime);
          break;
        case 'falling':
          this.updateFallingDuck(duck, dt);
          break;
        case 'hit':
          // 等待下落，不做移动
          break;
      }
    }
  }

  /** 更新飞行中的鸭子 */
  private updateFlyingDuck(duck: Duck, dt: number, deltaTime: number): void {
    duck.wingTimer += deltaTime;

    switch (duck.pattern) {
      case FLIGHT_STRAIGHT:
        // 直线飞行，保持初始方向
        break;

      case FLIGHT_WAVE:
        // 波浪飞行：正弦波调制垂直速度
        duck.waveTimer += deltaTime;
        duck.vy += Math.sin(duck.waveTimer * 0.003) * 50 * dt;
        break;

      case FLIGHT_RANDOM:
        // 随机飞行：定期随机变向
        duck.randomTimer += deltaTime;
        if (duck.randomTimer >= 500) {
          duck.randomTimer = 0;
          const speed = Math.sqrt(duck.vx * duck.vx + duck.vy * duck.vy);
          const angle = Math.random() * Math.PI * 2;
          duck.vx = Math.cos(angle) * speed;
          duck.vy = Math.sin(angle) * speed;
          // 确保总体向上飞
          if (duck.vy > -speed * 0.3) {
            duck.vy = -speed * 0.5;
          }
        }
        break;
    }

    // 移动
    duck.x += duck.vx * dt;
    duck.y += duck.vy * dt;

    // 水平边界反弹
    if (duck.x <= 0) {
      duck.x = 0;
      duck.vx = Math.abs(duck.vx);
      duck.dirX = DIR_RIGHT;
    } else if (duck.x >= CANVAS_WIDTH - DUCK_WIDTH) {
      duck.x = CANVAS_WIDTH - DUCK_WIDTH;
      duck.vx = -Math.abs(duck.vx);
      duck.dirX = DIR_LEFT;
    }

    // 检查是否飞出顶部
    if (duck.y <= DUCK_ESCAPE_Y) {
      duck.status = 'escaped';
      this._roundStats.escaped++;
      this._ducksAlive--;
      this.emit('duckEscaped', duck);
    }
  }

  /** 更新下落中的鸭子 */
  private updateFallingDuck(duck: Duck, dt: number): void {
    duck.y += duck.fallSpeed * dt;

    // 落到草丛以下
    if (duck.y >= CANVAS_HEIGHT) {
      duck.status = 'dead';
      this._ducksAlive--;
    }
  }

  // ========== 回合管理 ==========

  /** 检查回合是否结束 */
  private checkRoundEnd(): void {
    // 回合结束条件：所有鸭子已生成，且没有存活的鸭子
    if (this._ducksSpawned >= DUCKS_PER_ROUND && this._ducksAlive <= 0) {
      this.endRound();
    }

    // 或者子弹用完且所有飞行中的鸭子都已离开/被击中
    if (this._bullets <= 0) {
      const flyingDucks = this._ducks.filter(d => d.status === 'flying');
      if (flyingDucks.length === 0 && this._ducksSpawned > 0) {
        // 所有飞行中的鸭子已处理，标记剩余为逃逸
        for (const duck of this._ducks) {
          if (duck.status === 'flying') {
            duck.status = 'escaped';
            this._roundStats.escaped++;
            this._ducksAlive--;
          }
        }
        if (this._ducksSpawned >= DUCKS_PER_ROUND || this._ducksAlive <= 0) {
          this.endRound();
        }
      }
    }
  }

  /** 结束当前回合 */
  private endRound(): void {
    // 标记所有仍在飞行的鸭子为逃逸
    for (const duck of this._ducks) {
      if (duck.status === 'flying') {
        duck.status = 'escaped';
        this._roundStats.escaped++;
        this._ducksAlive--;
      }
    }

    this._roundPhase = 'result';
    this._phaseTimer = 0;
    this.emit('roundPhaseChange', 'result');
    this.emit('roundEnd', this._roundStats);

    // 猎犬嘲笑（如果命中率低）
    if (this._roundStats.hits < DUCKS_PER_ROUND / 2) {
      this._dog.phase = 'laughing';
      this._dog.timer = 0;
      this._dog.y = DOG_PEAK_Y;
      this.emit('dogPhaseChange', 'laughing');
    }
  }

  /** 开始回合过渡 */
  private startTransition(): void {
    this._roundPhase = 'transition';
    this._phaseTimer = 0;
    this._dog.phase = 'hidden';
    this._dog.y = DOG_HIDE_Y;
    this.emit('roundPhaseChange', 'transition');
  }

  /** 进入下一回合 */
  private nextRound(): void {
    this._round++;
    this._level = this._round;
    this.setLevel(this._level);
    this._roundsLeft--;

    if (this._roundsLeft <= 0) {
      this.gameOver();
      return;
    }

    this.emit('roundChange', this._round);
    this.startDogIntro();
  }

  // ========== 渲染方法 ==========

  private renderClouds(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    // 简单的云朵装饰
    this.drawCloud(ctx, 60, 80, 40);
    this.drawCloud(ctx, 250, 50, 35);
    this.drawCloud(ctx, 400, 100, 30);
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.arc(x + size * 0.8, y - size * 0.2, size * 0.7, 0, Math.PI * 2);
    ctx.arc(x + size * 1.4, y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderDuck(ctx: CanvasRenderingContext2D, duck: Duck): void {
    ctx.save();

    const cx = duck.x + DUCK_WIDTH / 2;
    const cy = duck.y + DUCK_HEIGHT / 2;

    if (duck.status === 'falling' || duck.status === 'hit') {
      // 被击中/下落：旋转绘制
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI); // 翻转
      ctx.translate(-cx, -cy);
    }

    // 鸭子颜色
    let bodyColor = DUCK_COLOR_NORMAL;
    if (duck.pattern === FLIGHT_WAVE) bodyColor = DUCK_COLOR_FAST;
    if (duck.pattern === FLIGHT_RANDOM) bodyColor = DUCK_COLOR_ZIGZAG;

    // 身体
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(cx, cy, DUCK_WIDTH / 2, DUCK_HEIGHT / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 翅膀
    const wingOffset = Math.sin(this._wingFrame * 3) * 6;
    ctx.fillStyle = DUCK_WING_COLOR;
    ctx.beginPath();
    if (duck.dirX === DIR_RIGHT) {
      ctx.ellipse(cx - 8, cy + wingOffset, 10, 5, -0.3, 0, Math.PI * 2);
    } else {
      ctx.ellipse(cx + 8, cy + wingOffset, 10, 5, 0.3, 0, Math.PI * 2);
    }
    ctx.fill();

    // 头部
    const headX = duck.dirX === DIR_RIGHT ? duck.x + DUCK_WIDTH - 8 : duck.x + 8;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(headX, cy - 4, 7, 0, Math.PI * 2);
    ctx.fill();

    // 喙
    ctx.fillStyle = '#ff8f00';
    ctx.beginPath();
    if (duck.dirX === DIR_RIGHT) {
      ctx.moveTo(headX + 7, cy - 4);
      ctx.lineTo(headX + 14, cy - 2);
      ctx.lineTo(headX + 7, cy);
    } else {
      ctx.moveTo(headX - 7, cy - 4);
      ctx.lineTo(headX - 14, cy - 2);
      ctx.lineTo(headX - 7, cy);
    }
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(headX + (duck.dirX === DIR_RIGHT ? 2 : -2), cy - 6, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderDog(ctx: CanvasRenderingContext2D): void {
    const dog = this._dog;

    ctx.fillStyle = DOG_COLOR;
    // 身体
    ctx.fillRect(dog.x + 8, dog.y + 15, DOG_WIDTH - 16, DOG_HEIGHT - 20);

    // 头部
    ctx.beginPath();
    ctx.arc(dog.x + DOG_WIDTH / 2, dog.y + 12, 14, 0, Math.PI * 2);
    ctx.fill();

    // 斑点
    ctx.fillStyle = DOG_SPOT_COLOR;
    ctx.beginPath();
    ctx.arc(dog.x + DOG_WIDTH / 2 - 4, dog.y + 25, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dog.x + DOG_WIDTH / 2 + 6, dog.y + 30, 4, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(dog.x + DOG_WIDTH / 2 - 4, dog.y + 9, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dog.x + DOG_WIDTH / 2 + 4, dog.y + 9, 2, 0, Math.PI * 2);
    ctx.fill();

    // 嘲笑时的嘴巴
    if (dog.phase === 'laughing') {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dog.x + DOG_WIDTH / 2, dog.y + 14, 6, 0, Math.PI);
      ctx.stroke();
    }

    // 耳朵
    ctx.fillStyle = DOG_SPOT_COLOR;
    ctx.beginPath();
    ctx.ellipse(dog.x + DOG_WIDTH / 2 - 12, dog.y + 6, 5, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(dog.x + DOG_WIDTH / 2 + 12, dog.y + 6, 5, 8, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderGrass(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 草丛主体
    ctx.fillStyle = GRASS_COLOR;
    ctx.fillRect(0, GRASS_Y, w, GRASS_HEIGHT);

    // 草丛顶部锯齿
    ctx.fillStyle = GRASS_DARK_COLOR;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, GRASS_Y + 10);
      ctx.lineTo(x + 10, GRASS_Y);
      ctx.lineTo(x + 20, GRASS_Y + 10);
      ctx.fill();
    }
  }

  private renderCrosshair(ctx: CanvasRenderingContext2D): void {
    const x = this._crosshairX;
    const y = this._crosshairY;
    const size = CROSSHAIR_SIZE / 2;

    ctx.strokeStyle = CROSSHAIR_COLOR;
    ctx.lineWidth = 2;

    // 外圆
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();

    // 十字线
    ctx.beginPath();
    ctx.moveTo(x - size - 4, y);
    ctx.lineTo(x - size / 2, y);
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size + 4, y);
    ctx.moveTo(x, y - size - 4);
    ctx.lineTo(x, y - size / 2);
    ctx.moveTo(x, y + size / 2);
    ctx.lineTo(x, y + size + 4);
    ctx.stroke();

    // 中心点
    ctx.fillStyle = CROSSHAIR_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 8, 24);

    ctx.fillStyle = HUD_COLOR;
    ctx.fillText(`Round: ${this._round}`, 180, 24);

    // 子弹指示器
    ctx.fillStyle = BULLET_HUD_COLOR;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Bullets:', 340, 24);
    for (let i = 0; i < BULLETS_PER_ROUND; i++) {
      ctx.fillStyle = i < this._bullets ? BULLET_HUD_COLOR : 'rgba(255,255,255,0.2)';
      ctx.fillRect(420 + i * 18, 12, 12, 16);
    }

    // 鸭子进度
    ctx.fillStyle = HUD_COLOR;
    ctx.font = '12px monospace';
    ctx.fillText(`Ducks: ${this._ducksSpawned}/${DUCKS_PER_ROUND}`, 8, 44);
    ctx.fillText(`Rounds Left: ${this._roundsLeft}`, 180, 44);
  }

  private renderRoundResult(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(w / 2 - 120, h / 2 - 80, 240, 160);

    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Round ${this._round} Complete`, w / 2, h / 2 - 50);

    ctx.fillStyle = HUD_COLOR;
    ctx.font = '16px monospace';
    ctx.fillText(`Hits: ${this._roundStats.hits}`, w / 2, h / 2 - 15);
    ctx.fillText(`Misses: ${this._roundStats.misses}`, w / 2, h / 2 + 10);
    ctx.fillText(`Escaped: ${this._roundStats.escaped}`, w / 2, h / 2 + 35);

    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 65);

    ctx.textAlign = 'left';
  }
}
