import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  FRUIT_RADIUS, FRUIT_TYPES, FRUIT_COLORS, FRUIT_SCORES,
  FruitType,
  BOMB_RADIUS, BOMB_COLOR, BOMB_PENALTY,
  GRAVITY, INITIAL_VY_MIN, INITIAL_VY_MAX, INITIAL_VX_RANGE,
  INITIAL_LIVES, MAX_MISSED_FRUITS,
  SLASH_RADIUS, COMBO_WINDOW,
  BASE_SPAWN_INTERVAL, SPAWN_INTERVAL_DECREASE_PER_LEVEL, MIN_SPAWN_INTERVAL,
  BOMB_CHANCE, BOMB_CHANCE_PER_LEVEL, MAX_BOMB_CHANCE,
  SCORE_PER_LEVEL, MAX_LEVEL,
  SLASH_DURATION, SLASH_COLOR,
  DIRECTION_SLASH_RANGE,
  BG_COLOR, HUD_COLOR, HUD_BG_COLOR,
  CURSOR_SPEED, CURSOR_SIZE,
} from './constants';

// ============================================================
// 类型定义
// ============================================================

export interface FruitItem {
  id: number;
  type: FruitType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;   // 仍在飞行中
  sliced: boolean;    // 已被切割
  missed: boolean;    // 已飞出屏幕底部（漏掉）
  rotation: number;   // 旋转角度
  rotationSpeed: number;
}

export interface BombItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  sliced: boolean;
  rotation: number;
  rotationSpeed: number;
}

export interface SlashEffect {
  x: number;
  y: number;
  timer: number; // 剩余显示时间（毫秒）
  maxTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 剩余生命（毫秒）
  maxLife: number;
  color: string;
  radius: number;
}

// ============================================================
// FruitNinjaEngine
// ============================================================

export class FruitNinjaEngine extends GameEngine {
  // 游戏对象
  private _fruits: FruitItem[] = [];
  private _bombs: BombItem[] = [];
  private _slashEffects: SlashEffect[] = [];
  private _particles: Particle[] = [];

  // 游戏状态
  private _lives: number = INITIAL_LIVES;
  private _missedCount: number = 0;
  private _combo: number = 0;
  private _lastSliceTime: number = 0;
  private _maxCombo: number = 0;
  private _totalSliced: number = 0;
  private _spawnTimer: number = 0;
  private _nextId: number = 0;

  // 输入状态
  private _cursorX: number = CANVAS_WIDTH / 2;
  private _cursorY: number = CANVAS_HEIGHT / 2;
  private _leftPressed: boolean = false;
  private _rightPressed: boolean = false;
  private _upPressed: boolean = false;
  private _downPressed: boolean = false;

  // ========== Public Getters ==========

  get lives(): number { return this._lives; }
  get missedCount(): number { return this._missedCount; }
  get combo(): number { return this._combo; }
  get maxCombo(): number { return this._maxCombo; }
  get totalSliced(): number { return this._totalSliced; }
  get fruits(): FruitItem[] { return [...this._fruits]; }
  get bombs(): BombItem[] { return [...this._bombs]; }
  get slashEffects(): SlashEffect[] { return [...this._slashEffects]; }
  get particles(): Particle[] { return [...this._particles]; }
  get cursorX(): number { return this._cursorX; }
  get cursorY(): number { return this._cursorY; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._fruits = [];
    this._bombs = [];
    this._slashEffects = [];
    this._particles = [];
    this._cursorX = CANVAS_WIDTH / 2;
    this._cursorY = CANVAS_HEIGHT / 2;
  }

  protected onStart(): void {
    this._fruits = [];
    this._bombs = [];
    this._slashEffects = [];
    this._particles = [];
    this._lives = INITIAL_LIVES;
    this._missedCount = 0;
    this._combo = 0;
    this._maxCombo = 0;
    this._totalSliced = 0;
    this._lastSliceTime = 0;
    this._spawnTimer = 0;
    this._nextId = 0;
    this._cursorX = CANVAS_WIDTH / 2;
    this._cursorY = CANVAS_HEIGHT / 2;
    this._leftPressed = false;
    this._rightPressed = false;
    this._upPressed = false;
    this._downPressed = false;
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime;

    // 移动光标
    this.moveCursor();

    // 生成水果
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this.spawnFruitOrBomb();
      this._spawnTimer = this.getSpawnInterval();
    }

    // 更新水果
    this.updateFruits(dt);

    // 更新炸弹
    this.updateBombs(dt);

    // 更新切割特效
    this.updateSlashEffects(dt);

    // 更新粒子
    this.updateParticles(dt);

    // 清理不活跃对象
    this.cleanupObjects();

    // 检查游戏结束
    this.checkGameOver();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 绘制水果
    for (const fruit of this._fruits) {
      if (!fruit.active && !fruit.sliced) continue;
      if (fruit.sliced) continue; // 已切割的不绘制
      ctx.save();
      ctx.translate(fruit.x, fruit.y);
      ctx.rotate(fruit.rotation);
      ctx.fillStyle = FRUIT_COLORS[fruit.type];
      ctx.beginPath();
      ctx.arc(0, 0, fruit.radius, 0, Math.PI * 2);
      ctx.fill();
      // 水果高光
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(-fruit.radius * 0.3, -fruit.radius * 0.3, fruit.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      // 水果类型首字母
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fruit.type[0].toUpperCase(), 0, 0);
      ctx.restore();
    }

    // 绘制炸弹
    for (const bomb of this._bombs) {
      if (!bomb.active || bomb.sliced) continue;
      ctx.save();
      ctx.translate(bomb.x, bomb.y);
      ctx.rotate(bomb.rotation);
      ctx.fillStyle = BOMB_COLOR;
      ctx.beginPath();
      ctx.arc(0, 0, bomb.radius, 0, Math.PI * 2);
      ctx.fill();
      // 引信
      ctx.strokeStyle = '#ff6f00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -bomb.radius);
      ctx.lineTo(5, -bomb.radius - 10);
      ctx.stroke();
      // 火花
      ctx.fillStyle = '#ffab00';
      ctx.beginPath();
      ctx.arc(5, -bomb.radius - 12, 3, 0, Math.PI * 2);
      ctx.fill();
      // X 标记
      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('X', 0, 0);
      ctx.restore();
    }

    // 绘制切割特效
    for (const slash of this._slashEffects) {
      const progress = 1 - slash.timer / slash.maxTimer;
      const alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = SLASH_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(slash.x, slash.y, SLASH_RADIUS * (0.5 + progress * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 绘制粒子
    for (const particle of this._particles) {
      const alpha = particle.life / particle.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 绘制光标（仅 playing 状态）
    if (this._status === 'playing') {
      ctx.save();
      ctx.strokeStyle = SLASH_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        this._cursorX - CURSOR_SIZE / 2,
        this._cursorY - CURSOR_SIZE / 2,
        CURSOR_SIZE,
        CURSOR_SIZE
      );
      ctx.setLineDash([]);
      ctx.restore();
    }

    // HUD - 顶部信息栏
    ctx.fillStyle = HUD_BG_COLOR;
    ctx.fillRect(0, 0, w, 36);

    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 10, 24);

    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${this._level}`, w / 2, 24);

    ctx.textAlign = 'right';
    // 生命值用心形表示
    let livesStr = '';
    for (let i = 0; i < this._lives; i++) livesStr += '❤';
    ctx.fillText(livesStr || '--', w - 10, 24);
    ctx.textAlign = 'left';

    // Combo 显示
    if (this._combo >= 2) {
      ctx.fillStyle = '#fdd835';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${this._combo}x COMBO!`, w / 2, 70);
      ctx.textAlign = 'left';
    }

    // 游戏结束画面
    if (this._status === 'gameover') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#ef5350';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', w / 2, h / 2 - 40);

      ctx.fillStyle = HUD_COLOR;
      ctx.font = '18px monospace';
      ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 10);
      ctx.fillText(`Sliced: ${this._totalSliced}`, w / 2, h / 2 + 40);
      ctx.fillText(`Max Combo: ${this._maxCombo}x`, w / 2, h / 2 + 70);

      ctx.fillStyle = '#aaa';
      ctx.font = '14px monospace';
      ctx.fillText('Press Space to restart', w / 2, h / 2 + 120);
      ctx.textAlign = 'left';
    }

    // 空闲画面
    if (this._status === 'idle') {
      ctx.fillStyle = HUD_COLOR;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FRUIT NINJA', w / 2, h / 2 - 20);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#aaa';
      ctx.fillText('Press Space to start', w / 2, h / 2 + 20);
      ctx.fillText('Arrow keys: move cursor', w / 2, h / 2 + 45);
      ctx.fillText('Space / 1-9: slash fruits', w / 2, h / 2 + 65);
      ctx.textAlign = 'left';
    }

    // 暂停画面
    if (this._status === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = HUD_COLOR;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', w / 2, h / 2);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this._fruits = [];
    this._bombs = [];
    this._slashEffects = [];
    this._particles = [];
    this._lives = INITIAL_LIVES;
    this._missedCount = 0;
    this._combo = 0;
    this._maxCombo = 0;
    this._totalSliced = 0;
    this._lastSliceTime = 0;
    this._spawnTimer = 0;
    this._nextId = 0;
    this._cursorX = CANVAS_WIDTH / 2;
    this._cursorY = CANVAS_HEIGHT / 2;
    this._leftPressed = false;
    this._rightPressed = false;
    this._upPressed = false;
    this._downPressed = false;
  }

  protected onGameOver(): void {
    // 游戏结束时的处理
  }

  handleKeyDown(key: string): void {
    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      } else if (this._status === 'playing') {
        this.performSlash();
      }
      return;
    }

    if (key === 'p' || key === 'P') {
      if (this._status === 'playing') {
        this.pause();
      } else if (this._status === 'paused') {
        this.resume();
      }
      return;
    }

    // 数字键 1-9 直接切割对应索引的水果
    if (key >= '1' && key <= '9' && this._status === 'playing') {
      this.sliceByIndex(parseInt(key) - 1);
      return;
    }

    // 方向键移动光标
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') this._leftPressed = true;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') this._rightPressed = true;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') this._upPressed = true;
    if (key === 'ArrowDown' || key === 's' || key === 'S') this._downPressed = true;
  }

  handleKeyUp(key: string): void {
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') this._leftPressed = false;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') this._rightPressed = false;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') this._upPressed = false;
    if (key === 'ArrowDown' || key === 's' || key === 'S') this._downPressed = false;
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      status: this._status,
      lives: this._lives,
      missedCount: this._missedCount,
      combo: this._combo,
      maxCombo: this._maxCombo,
      totalSliced: this._totalSliced,
      fruits: this._fruits.map(f => ({ ...f })),
      bombs: this._bombs.map(b => ({ ...b })),
      cursorX: this._cursorX,
      cursorY: this._cursorY,
    };
  }

  // ========== Private Methods ==========

  /** 移动光标 */
  private moveCursor(): void {
    if (this._leftPressed) this._cursorX = Math.max(CURSOR_SIZE / 2, this._cursorX - CURSOR_SPEED);
    if (this._rightPressed) this._cursorX = Math.min(CANVAS_WIDTH - CURSOR_SIZE / 2, this._cursorX + CURSOR_SPEED);
    if (this._upPressed) this._cursorY = Math.max(CURSOR_SIZE / 2, this._cursorY - CURSOR_SPEED);
    if (this._downPressed) this._cursorY = Math.min(CANVAS_HEIGHT - CURSOR_SIZE / 2, this._cursorY + CURSOR_SPEED);
  }

  /** 获取当前等级的生成间隔 */
  private getSpawnInterval(): number {
    const interval = BASE_SPAWN_INTERVAL - (this._level - 1) * SPAWN_INTERVAL_DECREASE_PER_LEVEL;
    return Math.max(MIN_SPAWN_INTERVAL, interval);
  }

  /** 获取当前等级的炸弹概率 */
  private getBombChance(): number {
    const chance = BOMB_CHANCE + (this._level - 1) * BOMB_CHANCE_PER_LEVEL;
    return Math.min(MAX_BOMB_CHANCE, chance);
  }

  /** 生成水果或炸弹 */
  private spawnFruitOrBomb(): void {
    const id = this._nextId++;

    // 随机水平位置（留边距）
    const margin = 60;
    const x = margin + Math.random() * (CANVAS_WIDTH - margin * 2);

    // 初始速度（从底部抛出）
    const vx = (Math.random() - 0.5) * INITIAL_VX_RANGE * 2;
    const vy = INITIAL_VY_MIN + Math.random() * (INITIAL_VY_MAX - INITIAL_VY_MIN);

    // 随机旋转
    const rotationSpeed = (Math.random() - 0.5) * 0.15;

    if (Math.random() < this.getBombChance()) {
      // 生成炸弹
      this._bombs.push({
        id,
        x,
        y: CANVAS_HEIGHT + BOMB_RADIUS,
        vx,
        vy,
        radius: BOMB_RADIUS,
        active: true,
        sliced: false,
        rotation: 0,
        rotationSpeed,
      });
    } else {
      // 生成水果
      const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
      this._fruits.push({
        id,
        type,
        x,
        y: CANVAS_HEIGHT + FRUIT_RADIUS,
        vx,
        vy,
        radius: FRUIT_RADIUS,
        active: true,
        sliced: false,
        missed: false,
        rotation: 0,
        rotationSpeed,
      });
    }
  }

  /** 更新所有水果位置 */
  private updateFruits(dt: number): void {
    const dtFactor = dt / 16; // 标准化到 ~60fps

    for (const fruit of this._fruits) {
      if (!fruit.active) continue;

      // 应用重力
      fruit.vy += GRAVITY * dtFactor;

      // 更新位置
      fruit.x += fruit.vx * dtFactor;
      fruit.y += fruit.vy * dtFactor;

      // 旋转
      fruit.rotation += fruit.rotationSpeed * dtFactor;

      // 检查是否飞出屏幕底部（落回去了）
      if (fruit.y > CANVAS_HEIGHT + fruit.radius * 2 && fruit.vy > 0) {
        fruit.active = false;
        fruit.missed = true;
        this._missedCount++;
        this.emit('fruitMissed', fruit);
      }

      // 水平边界反弹（碰到左右墙壁）
      if (fruit.x - fruit.radius < 0) {
        fruit.x = fruit.radius;
        fruit.vx = Math.abs(fruit.vx);
      }
      if (fruit.x + fruit.radius > CANVAS_WIDTH) {
        fruit.x = CANVAS_WIDTH - fruit.radius;
        fruit.vx = -Math.abs(fruit.vx);
      }
    }
  }

  /** 更新所有炸弹位置 */
  private updateBombs(dt: number): void {
    const dtFactor = dt / 16;

    for (const bomb of this._bombs) {
      if (!bomb.active) continue;

      bomb.vy += GRAVITY * dtFactor;
      bomb.x += bomb.vx * dtFactor;
      bomb.y += bomb.vy * dtFactor;
      bomb.rotation += bomb.rotationSpeed * dtFactor;

      // 炸弹飞出底部不扣分，只是消失
      if (bomb.y > CANVAS_HEIGHT + bomb.radius * 2 && bomb.vy > 0) {
        bomb.active = false;
      }

      // 水平边界反弹
      if (bomb.x - bomb.radius < 0) {
        bomb.x = bomb.radius;
        bomb.vx = Math.abs(bomb.vx);
      }
      if (bomb.x + bomb.radius > CANVAS_WIDTH) {
        bomb.x = CANVAS_WIDTH - bomb.radius;
        bomb.vx = -Math.abs(bomb.vx);
      }
    }
  }

  /** 更新切割特效 */
  private updateSlashEffects(dt: number): void {
    for (const slash of this._slashEffects) {
      slash.timer -= dt;
    }
  }

  /** 更新粒子 */
  private updateParticles(dt: number): void {
    for (const particle of this._particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.1; // 粒子重力
      particle.life -= dt;
    }
  }

  /** 清理不活跃的对象 */
  private cleanupObjects(): void {
    this._fruits = this._fruits.filter(f => f.active || f.sliced);
    this._bombs = this._bombs.filter(b => b.active);
    this._slashEffects = this._slashEffects.filter(s => s.timer > 0);
    this._particles = this._particles.filter(p => p.life > 0);
  }

  /** 检查游戏结束条件 */
  private checkGameOver(): void {
    if (this._missedCount >= MAX_MISSED_FRUITS || this._lives <= 0) {
      this.gameOver();
    }
  }

  /** 在光标位置执行切割 */
  private performSlash(): void {
    const now = performance.now();

    // 添加切割特效
    this._slashEffects.push({
      x: this._cursorX,
      y: this._cursorY,
      timer: SLASH_DURATION,
      maxTimer: SLASH_DURATION,
    });

    let hitSomething = false;

    // 检查水果碰撞
    for (const fruit of this._fruits) {
      if (!fruit.active || fruit.sliced) continue;
      const dist = Math.hypot(fruit.x - this._cursorX, fruit.y - this._cursorY);
      if (dist < SLASH_RADIUS + fruit.radius) {
        this.sliceFruit(fruit, now);
        hitSomething = true;
      }
    }

    // 检查炸弹碰撞
    for (const bomb of this._bombs) {
      if (!bomb.active || bomb.sliced) continue;
      const dist = Math.hypot(bomb.x - this._cursorX, bomb.y - this._cursorY);
      if (dist < SLASH_RADIUS + bomb.radius) {
        this.sliceBomb(bomb);
        hitSomething = true;
      }
    }

    if (!hitSomething) {
      // 没切到任何东西，重置 combo
      this._combo = 0;
    }
  }

  /** 通过数字键索引切割 */
  private sliceByIndex(index: number): void {
    const activeFruits = this._fruits.filter(f => f.active && !f.sliced);
    const activeBombs = this._bombs.filter(b => b.active && !b.sliced);

    // 合并所有活跃目标，按 id 排序
    type Target = { kind: 'fruit'; item: FruitItem } | { kind: 'bomb'; item: BombItem };
    const targets: Target[] = [
      ...activeFruits.map(f => ({ kind: 'fruit' as const, item: f })),
      ...activeBombs.map(b => ({ kind: 'bomb' as const, item: b })),
    ].sort((a, b) => a.item.id - b.item.id);

    if (index >= 0 && index < targets.length) {
      const target = targets[index];
      const now = performance.now();

      // 添加切割特效
      this._slashEffects.push({
        x: target.item.x,
        y: target.item.y,
        timer: SLASH_DURATION,
        maxTimer: SLASH_DURATION,
      });

      if (target.kind === 'fruit') {
        this.sliceFruit(target.item, now);
      } else {
        this.sliceBomb(target.item);
      }
    }
  }

  /** 切割水果 */
  private sliceFruit(fruit: FruitItem, now: number): void {
    fruit.sliced = true;
    fruit.active = false;
    this._totalSliced++;

    // Combo 判定
    if (now - this._lastSliceTime < COMBO_WINDOW) {
      this._combo++;
    } else {
      this._combo = 1;
    }
    this._lastSliceTime = now;
    this._maxCombo = Math.max(this._maxCombo, this._combo);

    // 计算得分
    let points = FRUIT_SCORES[fruit.type];
    if (this._combo >= 2) {
      points += (this._combo - 1) * 5; // combo 额外加分
    }
    this.addScore(points);

    // 生成粒子
    this.spawnJuiceParticles(fruit.x, fruit.y, FRUIT_COLORS[fruit.type]);

    this.emit('fruitSliced', fruit, points, this._combo);

    // 检查升级
    this.checkLevelUp();
  }

  /** 切割炸弹 */
  private sliceBomb(bomb: BombItem): void {
    bomb.sliced = true;
    bomb.active = false;
    this._lives -= BOMB_PENALTY;
    this._combo = 0; // 切到炸弹重置 combo

    // 生成爆炸粒子
    this.spawnExplosionParticles(bomb.x, bomb.y);

    this.emit('bombSliced', bomb);
  }

  /** 检查升级 */
  private checkLevelUp(): void {
    const newLevel = Math.min(MAX_LEVEL, Math.floor(this._score / SCORE_PER_LEVEL) + 1);
    if (newLevel > this._level) {
      this.setLevel(newLevel);
    }
  }

  /** 生成果汁粒子 */
  private spawnJuiceParticles(x: number, y: number, color: string): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      this._particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 500 + Math.random() * 300,
        maxLife: 800,
        color,
        radius: 3 + Math.random() * 3,
      });
    }
  }

  /** 生成爆炸粒子 */
  private spawnExplosionParticles(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
      const speed = 3 + Math.random() * 4;
      this._particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 400 + Math.random() * 200,
        maxLife: 600,
        color: i % 2 === 0 ? '#ff6f00' : '#ff1744',
        radius: 2 + Math.random() * 4,
      });
    }
  }
}
