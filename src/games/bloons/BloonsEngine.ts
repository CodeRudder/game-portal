import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BloonType,
  BLOON_HP, BLOON_COLORS, BLOON_SCORE, BLOON_RADIUS,
  PATH_WAYPOINTS,
  MONKEY_RANGE, MONKEY_ATTACK_INTERVAL, MONKEY_SIZE, MONKEY_SLOTS,
  DART_SPEED, DART_SIZE, DART_COOLDOWN,
  CROSSHAIR_SPEED, CROSSHAIR_SIZE,
  LEVELS, LevelConfig,
  BLOON_BASE_SPEED,
  INITIAL_LIVES,
  BLOON_SPAWN_INTERVAL,
  BG_COLOR, PATH_COLOR, PATH_BORDER_COLOR, PATH_WIDTH,
  HUD_COLOR, HUD_BG_COLOR, HUD_HEIGHT,
  CROSSHAIR_COLOR, CROSSHAIR_DOT_COLOR,
  DART_COLOR, MONKEY_BODY_COLOR, MONKEY_FACE_COLOR,
  DIRECTION_KEYS,
} from './constants';

// ========== 气球数据结构 ==========
export interface BloonData {
  /** 唯一ID */
  id: number;
  /** 气球类型 */
  type: BloonType;
  /** 当前血量 */
  hp: number;
  /** 最大血量 */
  maxHp: number;
  /** 中心 X 坐标 */
  x: number;
  /** 中心 Y 坐标 */
  y: number;
  /** 移动速度（像素/毫秒） */
  speed: number;
  /** 路径进度（0~1） */
  pathProgress: number;
  /** 是否存活 */
  alive: boolean;
  /** 颜色 */
  color: string;
}

// ========== 飞镖数据结构 ==========
export interface DartData {
  /** 唯一ID */
  id: number;
  /** 起始 X */
  fromX: number;
  /** 起始 Y */
  fromY: number;
  /** 目标 X */
  toX: number;
  /** 目标 Y */
  toY: number;
  /** 当前 X */
  x: number;
  /** 当前 Y */
  y: number;
  /** 已飞行时间 */
  elapsed: number;
  /** 总飞行时间 */
  duration: number;
  /** 是否存活 */
  alive: boolean;
  /** 来源：'monkey' 或 'player' */
  source: 'monkey' | 'player';
  /** 是否已检测过碰撞 */
  checked: boolean;
}

// ========== 飞镖猴数据结构 ==========
export interface MonkeyData {
  /** 唯一ID */
  id: number;
  /** 位置索引 */
  slotIndex: number;
  /** X 坐标 */
  x: number;
  /** Y 坐标 */
  y: number;
  /** 上次攻击时间 */
  lastAttackTime: number;
  /** 是否已放置 */
  placed: boolean;
}

// ========== 路径辅助 ==========
/** 计算路径总长度 */
function computePathLength(): number {
  let len = 0;
  for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
    const dx = PATH_WAYPOINTS[i].x - PATH_WAYPOINTS[i - 1].x;
    const dy = PATH_WAYPOINTS[i].y - PATH_WAYPOINTS[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

const TOTAL_PATH_LENGTH = computePathLength();

/** 根据进度（0~1）获取路径上的坐标 */
export function getPositionOnPath(progress: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, progress));
  const targetDist = clamped * TOTAL_PATH_LENGTH;

  let accumulated = 0;
  for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
    const dx = PATH_WAYPOINTS[i].x - PATH_WAYPOINTS[i - 1].x;
    const dy = PATH_WAYPOINTS[i].y - PATH_WAYPOINTS[i - 1].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);

    if (accumulated + segLen >= targetDist) {
      const t = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      return {
        x: PATH_WAYPOINTS[i - 1].x + dx * t,
        y: PATH_WAYPOINTS[i - 1].y + dy * t,
      };
    }
    accumulated += segLen;
  }

  // 到达终点
  return { x: PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1].x, y: PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1].y };
}

/** 两点距离 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// ========== 引擎 ==========
export class BloonsEngine extends GameEngine {
  // ========== 气球 ==========
  private _bloons: BloonData[] = [];
  private _nextBloonId = 0;

  // ========== 飞镖 ==========
  private _darts: DartData[] = [];
  private _nextDartId = 0;

  // ========== 飞镖猴 ==========
  private _monkeys: MonkeyData[] = [];
  private _nextMonkeyId = 0;

  // ========== 准星 ==========
  private _crosshairX = CANVAS_WIDTH / 2;
  private _crosshairY = CANVAS_HEIGHT / 2;

  // ========== 关卡系统 ==========
  private _currentLevel = 0; // 0-indexed
  private _lives = INITIAL_LIVES;
  private _dartsRemaining = 0;
  private _bloonsSpawned = 0;
  private _bloonsTotal = 0;
  private _spawnQueue: BloonType[] = [];
  private _spawnTimer = 0;
  private _gameTime = 0;
  private _lastDartTime = 0;
  private _isWin = false;

  // ========== 放置模式 ==========
  private _placingMonkey = false;

  // ========== 输入 ==========
  private _directionPressed: Set<string> = new Set();

  // ========== Public Getters ==========

  get crosshairX(): number { return this._crosshairX; }
  get crosshairY(): number { return this._crosshairY; }
  get lives(): number { return this._lives; }
  get dartsRemaining(): number { return this._dartsRemaining; }
  get currentLevel(): number { return this._currentLevel + 1; } // 1-indexed for display
  get bloons(): ReadonlyArray<BloonData> { return this._bloons; }
  get darts(): ReadonlyArray<DartData> { return this._darts; }
  get monkeys(): ReadonlyArray<MonkeyData> { return this._monkeys; }
  get isWin(): boolean { return this._isWin; }
  get placingMonkey(): boolean { return this._placingMonkey; }
  get spawnQueue(): ReadonlyArray<BloonType> { return this._spawnQueue; }
  get totalLevels(): number { return LEVELS.length; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._crosshairX = CANVAS_WIDTH / 2;
    this._crosshairY = CANVAS_HEIGHT / 2;
  }

  protected onStart(): void {
    this._resetLevelState();
    this._currentLevel = 0;
    this._lives = INITIAL_LIVES;
    this._isWin = false;
    this._monkeys = [];
    this._nextMonkeyId = 0;
    this._setupLevel();
  }

  protected update(deltaTime: number): void {
    this._gameTime += deltaTime;

    // 生成气球
    this._updateSpawning(deltaTime);

    // 更新气球位置
    this._updateBloons(deltaTime);

    // 更新飞镖
    this._updateDarts(deltaTime);

    // 飞镖猴自动攻击
    this._updateMonkeys();

    // 碰撞检测
    this._checkCollisions();

    // 更新准星
    this._updateCrosshair(deltaTime);

    // 检查关卡状态
    this._checkLevelStatus();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 路径
    this._renderPath(ctx);

    // 飞镖猴
    this._renderMonkeys(ctx);

    // 气球
    this._renderBloons(ctx);

    // 飞镖
    this._renderDarts(ctx);

    // 准星
    if (this._status === 'playing') {
      this._renderCrosshair(ctx);
    }

    // HUD
    this._renderHUD(ctx, w);

    // 游戏结束画面
    if (this._status === 'gameover') {
      this._renderGameOver(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._resetLevelState();
    this._currentLevel = 0;
    this._lives = INITIAL_LIVES;
    this._isWin = false;
    this._monkeys = [];
    this._nextMonkeyId = 0;
    this._crosshairX = CANVAS_WIDTH / 2;
    this._crosshairY = CANVAS_HEIGHT / 2;
    this._directionPressed.clear();
    this._placingMonkey = false;
  }

  protected onGameOver(): void {
    // 游戏结束处理
  }

  handleKeyDown(key: string): void {
    // 空格启动/重启
    if (key === ' ' || key === 'Enter') {
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

    // 空格投掷飞镖
    if (key === ' ') {
      this._throwDart();
    }

    // T 放置飞镖猴
    if (key === 't' || key === 'T') {
      this._togglePlaceMonkey();
    }

    // N 下一关（胜利后）
    if (key === 'n' || key === 'N') {
      this._nextLevel();
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
      lives: this._lives,
      dartsRemaining: this._dartsRemaining,
      currentLevel: this._currentLevel + 1,
      crosshairX: this._crosshairX,
      crosshairY: this._crosshairY,
      isWin: this._isWin,
      bloons: this._bloons.map(b => ({ ...b })),
      darts: this._darts.map(d => ({ ...d })),
      monkeys: this._monkeys.map(m => ({ ...m })),
      spawnQueue: [...this._spawnQueue],
      placingMonkey: this._placingMonkey,
    };
  }

  // ========== Public Methods ==========

  /** 切换放置飞镖猴模式 */
  private _togglePlaceMonkey(): void {
    this._placingMonkey = !this._placingMonkey;
    this.emit('placingMonkeyChange', this._placingMonkey);
  }

  /** 进入下一关 */
  private _nextLevel(): void {
    if (this._currentLevel < LEVELS.length - 1 && this._spawnQueue.length === 0 && this._bloons.filter(b => b.alive).length === 0) {
      this._currentLevel++;
      this._resetLevelState();
      this._setupLevel();
      this.setLevel(this._currentLevel + 1);
      this.emit('levelChange', this._currentLevel + 1);
    }
  }

  // ========== Private Methods ==========

  /** 重置关卡状态（不重置总分和生命） */
  private _resetLevelState(): void {
    this._bloons = [];
    this._nextBloonId = 0;
    this._darts = [];
    this._nextDartId = 0;
    this._bloonsSpawned = 0;
    this._bloonsTotal = 0;
    this._spawnQueue = [];
    this._spawnTimer = 0;
    this._gameTime = 0;
    this._lastDartTime = 0;
    this._crosshairX = CANVAS_WIDTH / 2;
    this._crosshairY = CANVAS_HEIGHT / 2;
    this._directionPressed.clear();
    this._placingMonkey = false;
  }

  /** 设置当前关卡的气球队列 */
  private _setupLevel(): void {
    const config = LEVELS[this._currentLevel];
    this._dartsRemaining = config.darts;
    this._spawnQueue = [];

    // 按类型生成队列
    for (let i = 0; i < config.red; i++) this._spawnQueue.push(BloonType.RED);
    for (let i = 0; i < config.blue; i++) this._spawnQueue.push(BloonType.BLUE);
    for (let i = 0; i < config.green; i++) this._spawnQueue.push(BloonType.GREEN);
    for (let i = 0; i < config.yellow; i++) this._spawnQueue.push(BloonType.YELLOW);

    // 打乱顺序
    this._shuffleArray(this._spawnQueue);
    this._bloonsTotal = this._spawnQueue.length;
    this._bloonsSpawned = 0;
  }

  /** 打乱数组 */
  private _shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /** 更新气球生成 */
  private _updateSpawning(deltaTime: number): void {
    if (this._spawnQueue.length === 0) return;

    this._spawnTimer -= deltaTime;
    if (this._spawnTimer <= 0) {
      const type = this._spawnQueue.shift()!;
      this._spawnBloon(type);
      this._spawnTimer = BLOON_SPAWN_INTERVAL;
      this._bloonsSpawned++;
    }
  }

  /** 生成一个气球 */
  private _spawnBloon(type: BloonType): void {
    const config = LEVELS[this._currentLevel];
    const hp = BLOON_HP[type];
    const pos = getPositionOnPath(0);

    const bloon: BloonData = {
      id: this._nextBloonId++,
      type,
      hp,
      maxHp: hp,
      x: pos.x,
      y: pos.y,
      speed: BLOON_BASE_SPEED * config.speedMultiplier,
      pathProgress: 0,
      alive: true,
      color: BLOON_COLORS[type],
    };

    this._bloons.push(bloon);
    this.emit('bloonSpawned', { bloon: { ...bloon } });
  }

  /** 更新气球位置 */
  private _updateBloons(deltaTime: number): void {
    for (let i = this._bloons.length - 1; i >= 0; i--) {
      const bloon = this._bloons[i];
      if (!bloon.alive) {
        this._bloons.splice(i, 1);
        continue;
      }

      // 沿路径移动
      const progressDelta = (bloon.speed * deltaTime) / TOTAL_PATH_LENGTH;
      bloon.pathProgress += progressDelta;

      // 更新位置
      const pos = getPositionOnPath(bloon.pathProgress);
      bloon.x = pos.x;
      bloon.y = pos.y;

      // 到达终点
      if (bloon.pathProgress >= 1) {
        bloon.alive = false;
        this._lives--;
        this._bloons.splice(i, 1);
        this.emit('bloonEscaped', { bloon: { ...bloon } });

        if (this._lives <= 0) {
          this._lives = 0;
          this._isWin = false;
          this.gameOver();
          return;
        }
      }
    }
  }

  /** 更新飞镖 */
  private _updateDarts(deltaTime: number): void {
    for (let i = this._darts.length - 1; i >= 0; i--) {
      const dart = this._darts[i];
      if (!dart.alive) {
        this._darts.splice(i, 1);
        continue;
      }

      dart.elapsed += deltaTime;

      // 线性插值移动
      const t = Math.min(1, dart.elapsed / dart.duration);
      dart.x = dart.fromX + (dart.toX - dart.fromX) * t;
      dart.y = dart.fromY + (dart.toY - dart.fromY) * t;

      // 飞行完毕
      if (t >= 1) {
        dart.alive = false;
        this._darts.splice(i, 1);
      }
    }
  }

  /** 飞镖猴自动攻击 */
  private _updateMonkeys(): void {
    for (const monkey of this._monkeys) {
      if (!monkey.placed) continue;
      if (this._gameTime - monkey.lastAttackTime < MONKEY_ATTACK_INTERVAL) continue;

      // 找射程内最近的活着的气球
      let closestBloon: BloonData | null = null;
      let closestDist = Infinity;

      for (const bloon of this._bloons) {
        if (!bloon.alive) continue;
        const dist = distance(monkey.x, monkey.y, bloon.x, bloon.y);
        if (dist <= MONKEY_RANGE && dist < closestDist) {
          closestDist = dist;
          closestBloon = bloon;
        }
      }

      if (closestBloon) {
        monkey.lastAttackTime = this._gameTime;
        this._fireDart(monkey.x, monkey.y, closestBloon.x, closestBloon.y, 'monkey');
      }
    }
  }

  /** 碰撞检测：飞镖 vs 气球 */
  private _checkCollisions(): void {
    for (const dart of this._darts) {
      if (!dart.alive || dart.checked) continue;

      for (const bloon of this._bloons) {
        if (!bloon.alive) continue;

        const dist = distance(dart.x, dart.y, bloon.x, bloon.y);
        if (dist <= BLOON_RADIUS + DART_SIZE / 2) {
          // 命中！
          bloon.hp--;
          dart.alive = false;
          dart.checked = true;

          if (bloon.hp <= 0) {
            bloon.alive = false;
            const score = BLOON_SCORE[bloon.type];
            this.addScore(score);
            this.emit('bloonPopped', { bloon: { ...bloon }, score, source: dart.source });
          } else {
            this.emit('bloonHit', { bloon: { ...bloon }, source: dart.source });
          }
          break; // 每个飞镖只命中一个气球
        }
      }
    }
  }

  /** 玩家手动投掷飞镖 */
  private _throwDart(): void {
    if (this._dartsRemaining <= 0) return;
    if (this._gameTime - this._lastDartTime < DART_COOLDOWN) return;

    // 放置飞镖猴模式：在准星位置放置
    if (this._placingMonkey) {
      this._placeMonkeyAt(this._crosshairX, this._crosshairY);
      return;
    }

    this._dartsRemaining--;
    this._lastDartTime = this._gameTime;

    // 飞镖从准星位置向最近的气球方向飞行
    let targetX = this._crosshairX;
    let targetY = this._crosshairY - 200; // 默认向上飞

    // 找最近的气球作为目标
    let closestDist = Infinity;
    for (const bloon of this._bloons) {
      if (!bloon.alive) continue;
      const dist = distance(this._crosshairX, this._crosshairY, bloon.x, bloon.y);
      if (dist < closestDist && dist < 300) {
        closestDist = dist;
        targetX = bloon.x;
        targetY = bloon.y;
      }
    }

    this._fireDart(this._crosshairX, this._crosshairY, targetX, targetY, 'player');
    this.emit('dartThrown', { dartsRemaining: this._dartsRemaining });
  }

  /** 发射一枚飞镖 */
  private _fireDart(fromX: number, fromY: number, toX: number, toY: number, source: 'monkey' | 'player'): void {
    const dist = distance(fromX, fromY, toX, toY);
    const duration = dist > 0 ? dist / DART_SPEED : 100;

    const dart: DartData = {
      id: this._nextDartId++,
      fromX,
      fromY,
      toX,
      toY,
      x: fromX,
      y: fromY,
      elapsed: 0,
      duration,
      alive: true,
      source,
      checked: false,
    };

    this._darts.push(dart);
  }

  /** 在指定位置放置飞镖猴 */
  private _placeMonkeyAt(x: number, y: number): void {
    // 检查是否靠近某个 slot
    let bestSlot = -1;
    let bestDist = Infinity;

    for (let i = 0; i < MONKEY_SLOTS.length; i++) {
      // 检查该 slot 是否已被占用
      const occupied = this._monkeys.some(m => m.slotIndex === i && m.placed);
      if (occupied) continue;

      const dist = distance(x, y, MONKEY_SLOTS[i].x, MONKEY_SLOTS[i].y);
      if (dist < 40 && dist < bestDist) {
        bestDist = dist;
        bestSlot = i;
      }
    }

    if (bestSlot >= 0) {
      const slot = MONKEY_SLOTS[bestSlot];
      const monkey: MonkeyData = {
        id: this._nextMonkeyId++,
        slotIndex: bestSlot,
        x: slot.x,
        y: slot.y,
        lastAttackTime: this._gameTime,
        placed: true,
      };
      this._monkeys.push(monkey);
      this._placingMonkey = false;
      this.emit('monkeyPlaced', { monkey: { ...monkey } });
    }
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

  /** 检查关卡状态 */
  private _checkLevelStatus(): void {
    // 所有气球都处理完了
    if (this._spawnQueue.length === 0 && this._bloons.filter(b => b.alive).length === 0 && this._bloonsSpawned > 0) {
      if (this._currentLevel >= LEVELS.length - 1) {
        // 通关！
        this._isWin = true;
        this.gameOver();
      }
      // 否则等待玩家按 N 进入下一关
    }
  }

  // ========== 渲染方法 ==========

  private _renderPath(ctx: CanvasRenderingContext2D): void {
    // 路径边框
    ctx.strokeStyle = PATH_BORDER_COLOR;
    ctx.lineWidth = PATH_WIDTH + 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(PATH_WAYPOINTS[0].x, PATH_WAYPOINTS[0].y);
    for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
      ctx.lineTo(PATH_WAYPOINTS[i].x, PATH_WAYPOINTS[i].y);
    }
    ctx.stroke();

    // 路径主体
    ctx.strokeStyle = PATH_COLOR;
    ctx.lineWidth = PATH_WIDTH;
    ctx.beginPath();
    ctx.moveTo(PATH_WAYPOINTS[0].x, PATH_WAYPOINTS[0].y);
    for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
      ctx.lineTo(PATH_WAYPOINTS[i].x, PATH_WAYPOINTS[i].y);
    }
    ctx.stroke();
  }

  private _renderBloons(ctx: CanvasRenderingContext2D): void {
    for (const bloon of this._bloons) {
      if (!bloon.alive) continue;
      this._renderBloon(ctx, bloon);
    }
  }

  private _renderBloon(ctx: CanvasRenderingContext2D, bloon: BloonData): void {
    const { x, y, color, hp, maxHp } = bloon;

    ctx.save();

    // 气球主体
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, BLOON_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 边框
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(x - BLOON_RADIUS * 0.3, y - BLOON_RADIUS * 0.3, BLOON_RADIUS * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 血量指示（多血量气球显示 HP）
    if (maxHp > 1) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${hp}`, x, y);
    }

    // 气球底部小三角
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + BLOON_RADIUS - 2);
    ctx.lineTo(x + 4, y + BLOON_RADIUS - 2);
    ctx.lineTo(x, y + BLOON_RADIUS + 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private _renderDarts(ctx: CanvasRenderingContext2D): void {
    for (const dart of this._darts) {
      if (!dart.alive) continue;

      ctx.save();
      // 计算飞镖朝向角度
      const angle = Math.atan2(dart.toY - dart.fromY, dart.toX - dart.fromX);
      ctx.translate(dart.x, dart.y);
      ctx.rotate(angle);

      // 飞镖身体
      ctx.fillStyle = DART_COLOR;
      ctx.beginPath();
      ctx.moveTo(DART_SIZE, 0);
      ctx.lineTo(-DART_SIZE / 2, -DART_SIZE / 3);
      ctx.lineTo(-DART_SIZE / 2, DART_SIZE / 3);
      ctx.closePath();
      ctx.fill();

      // 飞镖尖端
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(DART_SIZE + 2, 0);
      ctx.lineTo(DART_SIZE - 2, -2);
      ctx.lineTo(DART_SIZE - 2, 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  private _renderMonkeys(ctx: CanvasRenderingContext2D): void {
    // 渲染可用 slots（半透明）
    for (let i = 0; i < MONKEY_SLOTS.length; i++) {
      const slot = MONKEY_SLOTS[i];
      const occupied = this._monkeys.some(m => m.slotIndex === i);
      if (!occupied) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, MONKEY_SIZE / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // 渲染已放置的飞镖猴
    for (const monkey of this._monkeys) {
      if (!monkey.placed) continue;
      this._renderMonkey(ctx, monkey);
    }
  }

  private _renderMonkey(ctx: CanvasRenderingContext2D, monkey: MonkeyData): void {
    const { x, y } = monkey;
    const size = MONKEY_SIZE;

    ctx.save();

    // 射程范围（半透明圈）
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(x, y, MONKEY_RANGE, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 身体
    ctx.fillStyle = MONKEY_BODY_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // 脸
    ctx.fillStyle = MONKEY_FACE_COLOR;
    ctx.beginPath();
    ctx.arc(x, y - 2, size / 3, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x - 3, y - 4, 2, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 4, 2, 0, Math.PI * 2);
    ctx.fill();

    // 嘴巴
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  private _renderCrosshair(ctx: CanvasRenderingContext2D): void {
    const x = this._crosshairX;
    const y = this._crosshairY;
    const size = CROSSHAIR_SIZE;

    ctx.strokeStyle = this._placingMonkey ? '#00ff00' : CROSSHAIR_COLOR;
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

  private _renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = HUD_BG_COLOR;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';

    // 分数
    ctx.fillText(`Score: ${this._score}`, 10, 20);

    // 关卡
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${this._currentLevel + 1}/${LEVELS.length}`, w / 2, 20);

    // 生命
    ctx.textAlign = 'right';
    ctx.fillText(`❤ ${this._lives}`, w - 10, 20);

    // 飞镖剩余
    ctx.fillStyle = DART_COLOR;
    ctx.textAlign = 'left';
    ctx.fillText(`Darts: ${this._dartsRemaining}`, 10, 40);

    // 飞镖猴数量
    ctx.fillStyle = MONKEY_BODY_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText(`Monkey: ${this._monkeys.length}`, w / 2, 40);

    // 剩余气球
    const remaining = this._spawnQueue.length + this._bloons.filter(b => b.alive).length;
    ctx.fillStyle = '#ff6b6b';
    ctx.textAlign = 'right';
    ctx.fillText(`Bloons: ${remaining}`, w - 10, 40);

    ctx.textAlign = 'left';
  }

  private _renderGameOver(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';

    if (this._isWin) {
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('🎉 YOU WIN!', w / 2, h / 2 - 60);
    } else {
      ctx.fillStyle = '#ff4757';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('GAME OVER', w / 2, h / 2 - 60);
    }

    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 - 10);
    ctx.font = '18px monospace';
    ctx.fillText(`Level: ${this._currentLevel + 1}/${LEVELS.length}`, w / 2, h / 2 + 25);
    ctx.fillText(`Lives: ${this._lives}`, w / 2, h / 2 + 55);

    ctx.font = '16px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 100);

    ctx.textAlign = 'left';
  }
}
