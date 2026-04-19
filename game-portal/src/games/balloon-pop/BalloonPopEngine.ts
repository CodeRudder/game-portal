import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BalloonType,
  SCORE_NORMAL, SCORE_SMALL, SCORE_GOLDEN, SCORE_BOMB,
  BALLOON_RADIUS_NORMAL, BALLOON_RADIUS_SMALL, BALLOON_RADIUS_GOLDEN, BALLOON_RADIUS_BOMB,
  BALLOON_SPEED_MIN, BALLOON_SPEED_MAX, BALLOON_SPEED_SMALL_MIN, BALLOON_SPEED_SMALL_MAX,
  SPAWN_INTERVAL_BASE, SPAWN_INTERVAL_DECREASE_PER_LEVEL, SPAWN_INTERVAL_MIN,
  SPAWN_CHANCE_NORMAL, SPAWN_CHANCE_SMALL, SPAWN_CHANCE_GOLDEN, SPAWN_CHANCE_BOMB,
  GAME_DURATION,
  COMBO_MULTIPLIER_THRESHOLDS, COMBO_MULTIPLIERS,
  LEVEL_UP_SCORE, MAX_LEVEL,
  CROSSHAIR_SPEED, CROSSHAIR_SIZE,
  HUD_HEIGHT,
  BG_COLOR, BG_GRADIENT_TOP, BG_GRADIENT_BOTTOM,
  HUD_COLOR, HUD_BG_COLOR,
  CROSSHAIR_COLOR, CROSSHAIR_DOT_COLOR,
  BALLOON_COLORS, GOLDEN_COLOR, BOMB_COLOR, BOMB_FUSE_COLOR,
  SCORE_POPUP_COLOR, MISS_POPUP_COLOR,
  POP_DURATION, POP_PARTICLES,
  DIRECTION_KEYS,
} from './constants';

// ========== 气球数据结构 ==========
export interface BalloonData {
  /** 唯一ID */
  id: number;
  /** 气球类型 */
  type: BalloonType;
  /** 中心 X 坐标 */
  x: number;
  /** 中心 Y 坐标 */
  y: number;
  /** 半径 */
  radius: number;
  /** 上升速度（像素/毫秒） */
  speed: number;
  /** 颜色（普通气球随机颜色） */
  color: string;
  /** 是否存活 */
  alive: boolean;
  /** 水平摆动相位 */
  wobblePhase: number;
  /** 水平摆动幅度 */
  wobbleAmplitude: number;
}

// ========== 爆炸粒子 ==========
interface PopParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  radius: number;
}

// ========== 爆炸效果 ==========
interface PopEffect {
  x: number;
  y: number;
  particles: PopParticle[];
  timer: number;
  duration: number;
}

// ========== 得分弹出 ==========
interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  duration: number;
}

// ========== 射击闪光 ==========
interface ShootFlash {
  x: number;
  y: number;
  timer: number;
  duration: number;
}

export class BalloonPopEngine extends GameEngine {
  // ========== 气球 ==========
  private _balloons: BalloonData[] = [];
  private _nextBalloonId: number = 0;

  // ========== 准星 ==========
  private _crosshairX: number = CANVAS_WIDTH / 2;
  private _crosshairY: number = CANVAS_HEIGHT / 2;

  // ========== 生成控制 ==========
  private _spawnTimer: number = 0;
  private _gameTimer: number = 0; // 剩余时间（毫秒）

  // ========== 连击 ==========
  private _combo: number = 0;
  private _maxCombo: number = 0;
  private _totalShots: number = 0;
  private _totalHits: number = 0;
  private _balloonsPopped: number = 0;
  private _balloonsEscaped: number = 0;

  // ========== 视觉效果 ==========
  private _popEffects: PopEffect[] = [];
  private _scorePopups: ScorePopup[] = [];
  private _shootFlashes: ShootFlash[] = [];

  // ========== 输入状态 ==========
  private _directionPressed: Set<string> = new Set();

  // ========== Public Getters ==========

  get crosshairX(): number { return this._crosshairX; }
  get crosshairY(): number { return this._crosshairY; }
  get combo(): number { return this._combo; }
  get maxCombo(): number { return this._maxCombo; }
  get totalShots(): number { return this._totalShots; }
  get totalHits(): number { return this._totalHits; }
  get balloonsPopped(): number { return this._balloonsPopped; }
  get balloonsEscaped(): number { return this._balloonsEscaped; }
  get remainingTime(): number { return Math.max(0, this._gameTimer / 1000); }
  get balloons(): ReadonlyArray<BalloonData> { return this._balloons; }
  get multiplier(): number { return this._getMultiplier(); }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    // 初始化准星位置
    this._crosshairX = CANVAS_WIDTH / 2;
    this._crosshairY = CANVAS_HEIGHT / 2;
  }

  protected onStart(): void {
    this._balloons = [];
    this._nextBalloonId = 0;
    this._crosshairX = CANVAS_WIDTH / 2;
    this._crosshairY = CANVAS_HEIGHT / 2;
    this._spawnTimer = 0;
    this._gameTimer = GAME_DURATION * 1000;
    this._combo = 0;
    this._maxCombo = 0;
    this._totalShots = 0;
    this._totalHits = 0;
    this._balloonsPopped = 0;
    this._balloonsEscaped = 0;
    this._popEffects = [];
    this._scorePopups = [];
    this._shootFlashes = [];
    this._directionPressed.clear();
  }

  protected update(deltaTime: number): void {
    // 更新游戏计时器
    this._gameTimer -= deltaTime;
    if (this._gameTimer <= 0) {
      this._gameTimer = 0;
      this.gameOver();
      return;
    }

    // 更新准星位置
    this._updateCrosshair(deltaTime);

    // 更新气球位置
    this._updateBalloons(deltaTime);

    // 生成新气球
    this._spawnTimer -= deltaTime;
    if (this._spawnTimer <= 0) {
      this._spawnBalloon();
      this._spawnTimer = this._getSpawnInterval();
    }

    // 更新视觉效果
    this._updatePopEffects(deltaTime);
    this._updateScorePopups(deltaTime);
    this._updateShootFlashes(deltaTime);

    // 检查等级
    this._checkLevelUp();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景渐变
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, BG_GRADIENT_TOP);
    gradient.addColorStop(1, BG_GRADIENT_BOTTOM);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this._renderHUD(ctx, w);

    // 气球
    this._renderBalloons(ctx);

    // 爆炸效果
    this._renderPopEffects(ctx);

    // 射击闪光
    this._renderShootFlashes(ctx);

    // 得分弹出
    this._renderScorePopups(ctx);

    // 准星
    this._renderCrosshair(ctx);

    // 游戏结束画面
    if (this._status === 'gameover') {
      this._renderGameOver(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._balloons = [];
    this._nextBalloonId = 0;
    this._crosshairX = CANVAS_WIDTH / 2;
    this._crosshairY = CANVAS_HEIGHT / 2;
    this._spawnTimer = 0;
    this._gameTimer = GAME_DURATION * 1000;
    this._combo = 0;
    this._maxCombo = 0;
    this._totalShots = 0;
    this._totalHits = 0;
    this._balloonsPopped = 0;
    this._balloonsEscaped = 0;
    this._popEffects = [];
    this._scorePopups = [];
    this._shootFlashes = [];
    this._directionPressed.clear();
  }

  protected onGameOver(): void {
    // 游戏结束处理
  }

  handleKeyDown(key: string): void {
    // 空格在 idle/gameover 状态下启动/重启游戏
    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
        return;
      }
      if (this._status === 'gameover') {
        this.reset();
        this.start();
        return;
      }
    }

    // 游戏中的操作
    if (this._status !== 'playing') return;

    // 方向键
    if (DIRECTION_KEYS.UP.includes(key)) {
      this._directionPressed.add('up');
    } else if (DIRECTION_KEYS.DOWN.includes(key)) {
      this._directionPressed.add('down');
    } else if (DIRECTION_KEYS.LEFT.includes(key)) {
      this._directionPressed.add('left');
    } else if (DIRECTION_KEYS.RIGHT.includes(key)) {
      this._directionPressed.add('right');
    }

    // 空格射击
    if (key === ' ' || key === 'Space') {
      this._shoot();
    }
  }

  handleKeyUp(key: string): void {
    if (DIRECTION_KEYS.UP.includes(key)) this._directionPressed.delete('up');
    else if (DIRECTION_KEYS.DOWN.includes(key)) this._directionPressed.delete('down');
    else if (DIRECTION_KEYS.LEFT.includes(key)) this._directionPressed.delete('left');
    else if (DIRECTION_KEYS.RIGHT.includes(key)) this._directionPressed.delete('right');
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      status: this._status,
      crosshairX: this._crosshairX,
      crosshairY: this._crosshairY,
      combo: this._combo,
      maxCombo: this._maxCombo,
      multiplier: this._getMultiplier(),
      totalShots: this._totalShots,
      totalHits: this._totalHits,
      balloonsPopped: this._balloonsPopped,
      balloonsEscaped: this._balloonsEscaped,
      remainingTime: this.remainingTime,
      balloons: this._balloons.map(b => ({ ...b })),
    };
  }

  // ========== Private Methods ==========

  /** 获取当前连击倍率 */
  private _getMultiplier(): number {
    for (let i = COMBO_MULTIPLIER_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this._combo >= COMBO_MULTIPLIER_THRESHOLDS[i]) {
        return COMBO_MULTIPLIERS[i];
      }
    }
    return 1;
  }

  /** 获取气球基础分数 */
  private _getBalloonScore(type: BalloonType): number {
    switch (type) {
      case BalloonType.NORMAL: return SCORE_NORMAL;
      case BalloonType.SMALL: return SCORE_SMALL;
      case BalloonType.GOLDEN: return SCORE_GOLDEN;
      case BalloonType.BOMB: return SCORE_BOMB;
    }
  }

  /** 获取气球半径 */
  private _getBalloonRadius(type: BalloonType): number {
    switch (type) {
      case BalloonType.NORMAL: return BALLOON_RADIUS_NORMAL;
      case BalloonType.SMALL: return BALLOON_RADIUS_SMALL;
      case BalloonType.GOLDEN: return BALLOON_RADIUS_GOLDEN;
      case BalloonType.BOMB: return BALLOON_RADIUS_BOMB;
    }
  }

  /** 获取当前等级的生成间隔 */
  private _getSpawnInterval(): number {
    return Math.max(
      SPAWN_INTERVAL_MIN,
      SPAWN_INTERVAL_BASE - (this._level - 1) * SPAWN_INTERVAL_DECREASE_PER_LEVEL
    );
  }

  /** 随机选择气球类型 */
  private _randomBalloonType(): BalloonType {
    const roll = Math.random();
    let cumulative = 0;
    cumulative += SPAWN_CHANCE_NORMAL;
    if (roll < cumulative) return BalloonType.NORMAL;
    cumulative += SPAWN_CHANCE_SMALL;
    if (roll < cumulative) return BalloonType.SMALL;
    cumulative += SPAWN_CHANCE_GOLDEN;
    if (roll < cumulative) return BalloonType.GOLDEN;
    return BalloonType.BOMB;
  }

  /** 获取气球速度 */
  private _getBalloonSpeed(type: BalloonType): number {
    if (type === BalloonType.SMALL) {
      return BALLOON_SPEED_SMALL_MIN + Math.random() * (BALLOON_SPEED_SMALL_MAX - BALLOON_SPEED_SMALL_MIN);
    }
    return BALLOON_SPEED_MIN + Math.random() * (BALLOON_SPEED_MAX - BALLOON_SPEED_MIN);
  }

  /** 获取气球颜色 */
  private _getBalloonColor(type: BalloonType): string {
    if (type === BalloonType.GOLDEN) return GOLDEN_COLOR;
    if (type === BalloonType.BOMB) return BOMB_COLOR;
    return BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
  }

  /** 更新准星位置 */
  private _updateCrosshair(deltaTime: number): void {
    const speed = CROSSHAIR_SPEED * deltaTime;

    if (this._directionPressed.has('up')) {
      this._crosshairY = Math.max(HUD_HEIGHT, this._crosshairY - speed);
    }
    if (this._directionPressed.has('down')) {
      this._crosshairY = Math.min(CANVAS_HEIGHT, this._crosshairY + speed);
    }
    if (this._directionPressed.has('left')) {
      this._crosshairX = Math.max(0, this._crosshairX - speed);
    }
    if (this._directionPressed.has('right')) {
      this._crosshairX = Math.min(CANVAS_WIDTH, this._crosshairX + speed);
    }
  }

  /** 更新所有气球位置 */
  private _updateBalloons(deltaTime: number): void {
    for (let i = this._balloons.length - 1; i >= 0; i--) {
      const balloon = this._balloons[i];
      if (!balloon.alive) {
        this._balloons.splice(i, 1);
        continue;
      }

      // 上升
      balloon.y -= balloon.speed * deltaTime;

      // 水平摆动
      balloon.wobblePhase += deltaTime * 0.003;
      const wobbleOffset = Math.sin(balloon.wobblePhase) * balloon.wobbleAmplitude;
      balloon.x += wobbleOffset * deltaTime * 0.001;

      // 边界约束
      balloon.x = Math.max(balloon.radius, Math.min(CANVAS_WIDTH - balloon.radius, balloon.x));

      // 飘出顶部
      if (balloon.y + balloon.radius < 0) {
        balloon.alive = false;
        this._balloonsEscaped++;
        // 气球飘出顶部断连击
        this._combo = 0;
        this._balloons.splice(i, 1);
        this.emit('balloonEscaped', { balloon });
      }
    }
  }

  /** 生成新气球 */
  private _spawnBalloon(): void {
    const type = this._randomBalloonType();
    const radius = this._getBalloonRadius(type);
    const speed = this._getBalloonSpeed(type);
    const color = this._getBalloonColor(type);

    const balloon: BalloonData = {
      id: this._nextBalloonId++,
      type,
      x: radius + Math.random() * (CANVAS_WIDTH - radius * 2),
      y: CANVAS_HEIGHT + radius,
      radius,
      speed,
      color,
      alive: true,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmplitude: 10 + Math.random() * 20,
    };

    this._balloons.push(balloon);
    this.emit('balloonSpawned', { balloon: { ...balloon } });
  }

  /** 射击 */
  private _shoot(): void {
    this._totalShots++;

    // 添加射击闪光
    this._shootFlashes.push({
      x: this._crosshairX,
      y: this._crosshairY,
      timer: 0,
      duration: 150,
    });

    // 检测命中：从前到后遍历，命中最上层（最后添加的）
    let hitBalloon: BalloonData | null = null;
    for (let i = this._balloons.length - 1; i >= 0; i--) {
      const balloon = this._balloons[i];
      if (!balloon.alive) continue;

      const dx = this._crosshairX - balloon.x;
      const dy = this._crosshairY - balloon.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= balloon.radius) {
        hitBalloon = balloon;
        break;
      }
    }

    if (hitBalloon) {
      this._handleHit(hitBalloon);
    } else {
      this._handleMiss();
    }
  }

  /** 处理命中 */
  private _handleHit(balloon: BalloonData): void {
    balloon.alive = false;
    this._totalHits++;
    this._balloonsPopped++;

    const baseScore = this._getBalloonScore(balloon.type);

    if (balloon.type === BalloonType.BOMB) {
      // 炸弹：扣分，断连击
      this._combo = 0;
      this.addScore(baseScore); // 负分

      // 红色爆炸效果
      this._createPopEffect(balloon.x, balloon.y, BOMB_FUSE_COLOR);

      this._scorePopups.push({
        x: balloon.x,
        y: balloon.y,
        text: `${baseScore}`,
        color: MISS_POPUP_COLOR,
        timer: 0,
        duration: 800,
      });

      this.emit('hitBomb', { balloon: { ...balloon }, score: baseScore });
    } else {
      // 正常气球：加分，增加连击
      this._combo++;
      if (this._combo > this._maxCombo) {
        this._maxCombo = this._combo;
      }

      const multiplier = this._getMultiplier();
      const finalScore = Math.round(baseScore * multiplier);
      this.addScore(finalScore);

      // 爆炸效果
      this._createPopEffect(balloon.x, balloon.y, balloon.color);

      // 得分弹出
      const popupText = multiplier > 1
        ? `+${finalScore} (x${multiplier})`
        : `+${finalScore}`;
      this._scorePopups.push({
        x: balloon.x,
        y: balloon.y,
        text: popupText,
        color: SCORE_POPUP_COLOR,
        timer: 0,
        duration: 800,
      });

      this.emit('hitBalloon', {
        balloon: { ...balloon },
        score: finalScore,
        combo: this._combo,
        multiplier,
      });
    }
  }

  /** 处理未命中 */
  private _handleMiss(): void {
    this._combo = 0;
    this.emit('miss', { x: this._crosshairX, y: this._crosshairY });
  }

  /** 创建爆炸效果 */
  private _createPopEffect(x: number, y: number, color: string): void {
    const particles: PopParticle[] = [];
    for (let i = 0; i < POP_PARTICLES; i++) {
      const angle = (Math.PI * 2 * i) / POP_PARTICLES;
      const speed = 0.1 + Math.random() * 0.15;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 0,
        maxLife: POP_DURATION,
        radius: 3 + Math.random() * 3,
      });
    }
    this._popEffects.push({ x, y, particles, timer: 0, duration: POP_DURATION });
  }

  /** 更新爆炸效果 */
  private _updatePopEffects(deltaTime: number): void {
    for (let i = this._popEffects.length - 1; i >= 0; i--) {
      const effect = this._popEffects[i];
      effect.timer += deltaTime;
      for (const particle of effect.particles) {
        particle.life += deltaTime;
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        particle.vy += 0.0002 * deltaTime; // 重力
      }
      if (effect.timer >= effect.duration) {
        this._popEffects.splice(i, 1);
      }
    }
  }

  /** 更新得分弹出 */
  private _updateScorePopups(deltaTime: number): void {
    for (let i = this._scorePopups.length - 1; i >= 0; i--) {
      const popup = this._scorePopups[i];
      popup.timer += deltaTime;
      popup.y -= deltaTime * 0.04;
      if (popup.timer >= popup.duration) {
        this._scorePopups.splice(i, 1);
      }
    }
  }

  /** 更新射击闪光 */
  private _updateShootFlashes(deltaTime: number): void {
    for (let i = this._shootFlashes.length - 1; i >= 0; i--) {
      const flash = this._shootFlashes[i];
      flash.timer += deltaTime;
      if (flash.timer >= flash.duration) {
        this._shootFlashes.splice(i, 1);
      }
    }
  }

  /** 检查是否升级 */
  private _checkLevelUp(): void {
    const newLevel = Math.min(MAX_LEVEL, Math.floor(Math.max(0, this._score) / LEVEL_UP_SCORE) + 1);
    if (newLevel > this._level) {
      this.setLevel(newLevel);
      this.emit('levelUp', newLevel);
    }
  }

  // ========== 渲染方法 ==========

  private _renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = HUD_BG_COLOR;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 分数
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 10, 25);

    // 等级
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${this._level}`, w / 2, 25);

    // 时间
    ctx.textAlign = 'right';
    const timeStr = Math.ceil(this.remainingTime).toString();
    ctx.fillText(`${timeStr}s`, w - 10, 25);

    // 连击 & 倍率
    if (this._combo > 0) {
      ctx.fillStyle = SCORE_POPUP_COLOR;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      const mul = this._getMultiplier();
      ctx.fillText(`Combo: ${this._combo} | x${mul}`, w / 2, 48);
    }

    ctx.textAlign = 'left';
  }

  private _renderBalloons(ctx: CanvasRenderingContext2D): void {
    for (const balloon of this._balloons) {
      if (!balloon.alive) continue;
      this._renderBalloon(ctx, balloon);
    }
  }

  private _renderBalloon(ctx: CanvasRenderingContext2D, balloon: BalloonData): void {
    const { x, y, radius, type, color } = balloon;

    ctx.save();

    // 气球主体
    if (type === BalloonType.GOLDEN) {
      // 金色气球发光效果
      ctx.shadowColor = GOLDEN_COLOR;
      ctx.shadowBlur = 15;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 气球底部小三角
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + radius - 2);
    ctx.lineTo(x + 5, y + radius - 2);
    ctx.lineTo(x, y + radius + 8);
    ctx.closePath();
    ctx.fill();

    // 炸弹特殊标记
    if (type === BalloonType.BOMB) {
      // 引线
      ctx.strokeStyle = BOMB_FUSE_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - radius);
      ctx.quadraticCurveTo(x + 10, y - radius - 10, x + 5, y - radius - 15);
      ctx.stroke();

      // 火花
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(x + 5, y - radius - 15, 3, 0, Math.PI * 2);
      ctx.fill();

      // 骷髅图标
      ctx.fillStyle = '#ffffff';
      ctx.font = `${radius}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💣', x, y);
    }

    // 金色气球闪光标记
    if (type === BalloonType.GOLDEN) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${radius * 0.8}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', x, y);
    }

    ctx.restore();
  }

  private _renderCrosshair(ctx: CanvasRenderingContext2D): void {
    if (this._status !== 'playing') return;

    const x = this._crosshairX;
    const y = this._crosshairY;
    const size = CROSSHAIR_SIZE;

    ctx.strokeStyle = CROSSHAIR_COLOR;
    ctx.lineWidth = 2;

    // 外圈
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.stroke();

    // 十字线
    ctx.beginPath();
    ctx.moveTo(x - size - 5, y);
    ctx.lineTo(x - size / 2, y);
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size + 5, y);
    ctx.moveTo(x, y - size - 5);
    ctx.lineTo(x, y - size / 2);
    ctx.moveTo(x, y + size / 2);
    ctx.lineTo(x, y + size + 5);
    ctx.stroke();

    // 中心点
    ctx.fillStyle = CROSSHAIR_DOT_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private _renderPopEffects(ctx: CanvasRenderingContext2D): void {
    for (const effect of this._popEffects) {
      const alpha = 1 - effect.timer / effect.duration;
      for (const particle of effect.particles) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private _renderShootFlashes(ctx: CanvasRenderingContext2D): void {
    for (const flash of this._shootFlashes) {
      const alpha = 1 - flash.timer / flash.duration;
      const radius = 10 + flash.timer * 0.1;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = CROSSHAIR_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private _renderScorePopups(ctx: CanvasRenderingContext2D): void {
    for (const popup of this._scorePopups) {
      const alpha = 1 - popup.timer / popup.duration;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = popup.color;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  private _renderGameOver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';

    // Game Over 文字
    ctx.fillStyle = '#FF6347';
    ctx.font = 'bold 36px monospace';
    ctx.fillText("TIME'S UP!", w / 2, h / 2 - 80);

    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 - 30);
    ctx.fillText(`Level: ${this._level}`, w / 2, h / 2 + 5);

    ctx.font = '18px monospace';
    ctx.fillText(`Balloons Popped: ${this._balloonsPopped}`, w / 2, h / 2 + 40);
    ctx.fillText(`Max Combo: ${this._maxCombo}`, w / 2, h / 2 + 70);
    ctx.fillText(`Accuracy: ${this._totalShots > 0 ? Math.round((this._totalHits / this._totalShots) * 100) : 0}%`, w / 2, h / 2 + 100);

    ctx.font = '16px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 145);

    ctx.textAlign = 'left';
  }
}
