import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  CITY_COUNT, CITY_WIDTH, CITY_HEIGHT, CITY_Y, CITY_COLOR, CITY_DESTROYED_COLOR,
  BATTERY_COUNT, BATTERY_WIDTH, BATTERY_HEIGHT, BATTERY_Y, BATTERY_COLOR,
  BATTERY_MAX_AMMO, BATTERY_RELOAD_PER_WAVE,
  MISSILE_SPEED, MISSILE_TRAIL_COLOR,
  EXPLOSION_MAX_RADIUS, EXPLOSION_GROW_SPEED, EXPLOSION_SHRINK_SPEED,
  EXPLOSION_COLOR, EXPLOSION_HIT_COLOR,
  ENEMY_MISSILE_BASE_SPEED, ENEMY_MISSILE_SPEED_PER_WAVE,
  ENEMY_MISSILE_BASE_COUNT, ENEMY_MISSILE_COUNT_PER_WAVE,
  ENEMY_MISSILE_MAX_COUNT, ENEMY_MISSILE_COLOR, ENEMY_MISSILE_TRAIL_COLOR,
  WAVE_START_DELAY, WAVE_SPAWN_INTERVAL_MIN, WAVE_SPAWN_INTERVAL_MAX,
  WAVE_BONUS_CITY, WAVE_BONUS_AMMO,
  SCORE_PER_ENEMY, SCORE_PER_WAVE,
  BG_COLOR, GROUND_COLOR, HUD_COLOR, CROSSHAIR_COLOR,
  GROUND_Y, BATTERY_POSITIONS, CITY_POSITIONS,
} from './constants';

// ========== 内部类型 ==========

interface Position {
  x: number;
  y: number;
}

interface PlayerMissile {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  dx: number;
  dy: number;
  speed: number;
  trail: Position[];
  active: boolean;
  batteryIndex: number;
}

interface EnemyMissile {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  dx: number;
  dy: number;
  speed: number;
  trail: Position[];
  active: boolean;
  targetCityIndex: number;
}

interface Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  growing: boolean;
  active: boolean;
  hitCount: number;
}

interface City {
  x: number;
  y: number;
  alive: boolean;
}

interface Battery {
  x: number;
  y: number;
  ammo: number;
  alive: boolean;
}

type InternalGameState = 'waveStarting' | 'waveActive' | 'waveCleared' | 'gameOver';

export class MissileCommandEngine extends GameEngine {
  // ========== 游戏实体 ==========
  private _cities: City[] = [];
  private _batteries: Battery[] = [];
  private _playerMissiles: PlayerMissile[] = [];
  private _enemyMissiles: EnemyMissile[] = [];
  private _explosions: Explosion[] = [];

  // ========== 波次管理 ==========
  private _wave: number = 1;
  private _waveState: InternalGameState = 'waveStarting';
  private _waveTimer: number = 0;
  private _enemiesToSpawn: number = 0;
  private _spawnTimer: number = 0;
  private _spawnInterval: number = 0;

  // ========== 输入 ==========
  private _cursorX: number = CANVAS_WIDTH / 2;
  private _cursorY: number = CANVAS_HEIGHT / 2;
  private _clickQueue: Position[] = [];

  // ========== 统计 ==========
  private _totalEnemyDestroyed: number = 0;

  // ========== Public Getters ==========

  get cities(): readonly City[] { return this._cities; }
  get batteries(): readonly Battery[] { return this._batteries; }
  get playerMissiles(): readonly PlayerMissile[] { return this._playerMissiles; }
  get enemyMissiles(): readonly EnemyMissile[] { return this._enemyMissiles; }
  get explosions(): readonly Explosion[] { return this._explosions; }
  get wave(): number { return this._wave; }
  get waveState(): InternalGameState { return this._waveState; }
  get cursorX(): number { return this._cursorX; }
  get cursorY(): number { return this._cursorY; }
  get totalEnemyDestroyed(): number { return this._totalEnemyDestroyed; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this.initEntities();
  }

  protected onStart(): void {
    this.initEntities();
    this._wave = 1;
    this._waveState = 'waveStarting';
    this._waveTimer = WAVE_START_DELAY;
    this._totalEnemyDestroyed = 0;
    this._playerMissiles = [];
    this._enemyMissiles = [];
    this._explosions = [];
    this._clickQueue = [];
    this.setLevel(1);
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000; // 转秒

    switch (this._waveState) {
      case 'waveStarting':
        this.updateWaveStarting(deltaTime);
        break;
      case 'waveActive':
        this.updateWaveActive(dt);
        break;
      case 'waveCleared':
        this.updateWaveCleared(deltaTime);
        break;
      case 'gameOver':
        break;
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 地面
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);

    // 城市
    this.renderCities(ctx);

    // 发射台
    this.renderBatteries(ctx);

    // 敌方导弹轨迹
    this.renderEnemyMissiles(ctx);

    // 玩家导弹轨迹
    this.renderPlayerMissiles(ctx);

    // 爆炸
    this.renderExplosions(ctx);

    // HUD
    this.renderHUD(ctx);

    // 十字准星
    this.renderCrosshair(ctx);

    // 波次提示
    if (this._waveState === 'waveStarting') {
      ctx.fillStyle = HUD_COLOR;
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`WAVE ${this._wave}`, w / 2, h / 2 - 20);
      ctx.font = '14px monospace';
      ctx.fillText('Get Ready!', w / 2, h / 2 + 10);
      ctx.textAlign = 'left';
    }

    // 波次通关提示
    if (this._waveState === 'waveCleared') {
      ctx.fillStyle = '#66bb6a';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`WAVE ${this._wave} CLEARED!`, w / 2, h / 2 - 20);
      ctx.textAlign = 'left';
    }

    // 游戏结束
    if (this._status === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ef5350';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', w / 2, h / 2 - 20);
      ctx.fillStyle = HUD_COLOR;
      ctx.font = '16px monospace';
      ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 20);
      ctx.fillText(`Wave: ${this._wave}`, w / 2, h / 2 + 45);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this.initEntities();
    this._wave = 1;
    this._waveState = 'waveStarting';
    this._waveTimer = 0;
    this._enemiesToSpawn = 0;
    this._spawnTimer = 0;
    this._playerMissiles = [];
    this._enemyMissiles = [];
    this._explosions = [];
    this._clickQueue = [];
    this._totalEnemyDestroyed = 0;
  }

  protected onGameOver(): void {
    this._waveState = 'gameOver';
  }

  handleKeyDown(key: string): void {
    if (key === ' ' || key === 'Space' || key === 'Enter') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      }
    }
  }

  handleKeyUp(_key: string): void {
    // 导弹指挥官主要用鼠标点击，键盘无持续按键
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      wave: this._wave,
      waveState: this._waveState,
      citiesAlive: this._cities.filter((c) => c.alive).length,
      batteriesAlive: this._batteries.filter((b) => b.alive).length,
      totalAmmo: this._batteries.reduce((sum, b) => sum + (b.alive ? b.ammo : 0), 0),
      enemyMissilesActive: this._enemyMissiles.filter((m) => m.active).length,
      explosionsActive: this._explosions.filter((e) => e.active).length,
      totalEnemyDestroyed: this._totalEnemyDestroyed,
    };
  }

  // ========== 公共方法：鼠标输入 ==========

  /** 设置光标位置 */
  setCursor(x: number, y: number): void {
    this._cursorX = Math.max(0, Math.min(CANVAS_WIDTH, x));
    this._cursorY = Math.max(0, Math.min(CANVAS_HEIGHT, y));
  }

  /** 点击发射拦截弹 */
  handleClick(x: number, y: number): void {
    if (this._status !== 'playing') return;
    if (this._waveState !== 'waveActive') return;

    // 不允许射击地面以下
    const targetY = Math.min(y, GROUND_Y - 5);
    this._clickQueue.push({ x, y: targetY });
  }

  // ========== 初始化 ==========

  private initEntities(): void {
    // 初始化城市
    this._cities = CITY_POSITIONS.map((cx) => ({
      x: cx,
      y: CITY_Y - CITY_HEIGHT / 2,
      alive: true,
    }));

    // 初始化发射台
    this._batteries = BATTERY_POSITIONS.map((bx) => ({
      x: bx,
      y: BATTERY_Y - BATTERY_HEIGHT / 2,
      ammo: BATTERY_MAX_AMMO,
      alive: true,
    }));
  }

  // ========== 波次管理 ==========

  private updateWaveStarting(deltaTime: number): void {
    this._waveTimer -= deltaTime;
    if (this._waveTimer <= 0) {
      this.startWave();
    }
  }

  private startWave(): void {
    this._waveState = 'waveActive';
    this._enemiesToSpawn = this.getEnemyCountForWave(this._wave);
    this._spawnTimer = 0;
    this._spawnInterval = this.getSpawnIntervalForWave(this._wave);
    this.reloadBatteries();
  }

  private updateWaveActive(dt: number): void {
    // 处理点击队列
    this.processClickQueue();

    // 生成敌方导弹
    this.spawnEnemies(dt);

    // 移动玩家导弹
    this.updatePlayerMissiles();

    // 移动敌方导弹
    this.updateEnemyMissiles();

    // 更新爆炸
    this.updateExplosions();

    // 碰撞检测：爆炸 vs 敌方导弹
    this.checkExplosionHits();

    // 检查波次完成
    this.checkWaveComplete();

    // 检查游戏结束
    this.checkGameOver();
  }

  private updateWaveCleared(deltaTime: number): void {
    // 更新残留爆炸
    this.updateExplosions();

    this._waveTimer -= deltaTime;
    if (this._waveTimer <= 0) {
      this.nextWave();
    }
  }

  private nextWave(): void {
    this._wave++;
    this.setLevel(this._wave);
    this._waveState = 'waveStarting';
    this._waveTimer = WAVE_START_DELAY;
    this._playerMissiles = [];
    this._enemyMissiles = [];
    this._explosions = [];
  }

  private getEnemyCountForWave(wave: number): number {
    return Math.min(
      ENEMY_MISSILE_MAX_COUNT,
      ENEMY_MISSILE_BASE_COUNT + (wave - 1) * ENEMY_MISSILE_COUNT_PER_WAVE
    );
  }

  private getSpawnIntervalForWave(wave: number): number {
    const interval =
      WAVE_SPAWN_INTERVAL_MAX - (wave - 1) * 50;
    return Math.max(WAVE_SPAWN_INTERVAL_MIN, interval);
  }

  private reloadBatteries(): void {
    for (const battery of this._batteries) {
      if (battery.alive) {
        battery.ammo = Math.min(
          BATTERY_MAX_AMMO,
          battery.ammo + BATTERY_RELOAD_PER_WAVE
        );
      }
    }
  }

  // ========== 点击处理 ==========

  private processClickQueue(): void {
    while (this._clickQueue.length > 0) {
      const target = this._clickQueue.shift()!;
      this.firePlayerMissile(target.x, target.y);
    }
  }

  private firePlayerMissile(targetX: number, targetY: number): void {
    // 找最近的、有弹药且存活的发射台
    const bestBattery = this.findBestBattery(targetX);
    if (bestBattery === null) return;

    const battery = this._batteries[bestBattery];
    if (battery.ammo <= 0) return;

    battery.ammo--;

    const startX = battery.x;
    const startY = battery.y - BATTERY_HEIGHT / 2;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    this._playerMissiles.push({
      x: startX,
      y: startY,
      targetX,
      targetY,
      dx: (dx / dist) * MISSILE_SPEED,
      dy: (dy / dist) * MISSILE_SPEED,
      speed: MISSILE_SPEED,
      trail: [{ x: startX, y: startY }],
      active: true,
      batteryIndex: bestBattery,
    });
  }

  private findBestBattery(targetX: number): number | null {
    let bestIdx: number | null = null;
    let bestDist = Infinity;

    for (let i = 0; i < this._batteries.length; i++) {
      const b = this._batteries[i];
      if (!b.alive || b.ammo <= 0) continue;
      const dist = Math.abs(b.x - targetX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  // ========== 敌方导弹生成 ==========

  private spawnEnemies(dt: number): void {
    if (this._enemiesToSpawn <= 0) return;

    this._spawnTimer += dt * 1000; // 转毫秒
    if (this._spawnTimer >= this._spawnInterval) {
      this._spawnTimer = 0;
      this.spawnOneEnemy();
    }
  }

  private spawnOneEnemy(): void {
    if (this._enemiesToSpawn <= 0) return;
    this._enemiesToSpawn--;

    // 随机起始位置（顶部）
    const startX = Math.random() * (CANVAS_WIDTH - 40) + 20;
    const startY = 0;

    // 瞄准一个存活的城市
    const aliveCities = this._cities
      .map((c, i) => ({ city: c, index: i }))
      .filter((entry) => entry.city.alive);

    if (aliveCities.length === 0) return;

    const target = aliveCities[Math.floor(Math.random() * aliveCities.length)];
    const targetX = target.city.x + (Math.random() - 0.5) * CITY_WIDTH * 0.5;
    const targetY = target.city.y;

    const speed =
      ENEMY_MISSILE_BASE_SPEED + (this._wave - 1) * ENEMY_MISSILE_SPEED_PER_WAVE;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    this._enemyMissiles.push({
      x: startX,
      y: startY,
      targetX,
      targetY,
      dx: (dx / dist) * speed,
      dy: (dy / dist) * speed,
      speed,
      trail: [{ x: startX, y: startY }],
      active: true,
      targetCityIndex: target.index,
    });
  }

  // ========== 更新逻辑 ==========

  private updatePlayerMissiles(): void {
    for (const missile of this._playerMissiles) {
      if (!missile.active) continue;

      missile.x += missile.dx;
      missile.y += missile.dy;
      missile.trail.push({ x: missile.x, y: missile.y });

      // 到达目标 → 爆炸
      const dx = missile.targetX - missile.x;
      const dy = missile.targetY - missile.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= missile.speed) {
        missile.active = false;
        this.createExplosion(missile.targetX, missile.targetY);
      }
    }
  }

  private updateEnemyMissiles(): void {
    for (const missile of this._enemyMissiles) {
      if (!missile.active) continue;

      missile.x += missile.dx;
      missile.y += missile.dy;
      missile.trail.push({ x: missile.x, y: missile.y });

      // 到达目标 → 摧毁城市
      if (missile.y >= GROUND_Y) {
        missile.active = false;
        this.destroyCityAt(missile.targetX, missile.targetY);
      }

      // 超出画布边界
      if (
        missile.x < -50 ||
        missile.x > CANVAS_WIDTH + 50 ||
        missile.y > CANVAS_HEIGHT + 50
      ) {
        missile.active = false;
      }
    }
  }

  private updateExplosions(): void {
    for (const exp of this._explosions) {
      if (!exp.active) continue;

      if (exp.growing) {
        exp.radius += EXPLOSION_GROW_SPEED;
        if (exp.radius >= exp.maxRadius) {
          exp.growing = false;
        }
      } else {
        exp.radius -= EXPLOSION_SHRINK_SPEED;
        if (exp.radius <= 0) {
          exp.radius = 0;
          exp.active = false;
        }
      }
    }
  }

  // ========== 爆炸 ==========

  private createExplosion(x: number, y: number): void {
    this._explosions.push({
      x,
      y,
      radius: 1,
      maxRadius: EXPLOSION_MAX_RADIUS,
      growing: true,
      active: true,
      hitCount: 0,
    });
  }

  private checkExplosionHits(): void {
    for (const exp of this._explosions) {
      if (!exp.active) continue;

      for (const missile of this._enemyMissiles) {
        if (!missile.active) continue;

        const dx = missile.x - exp.x;
        const dy = missile.y - exp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= exp.radius) {
          missile.active = false;
          exp.hitCount++;
          this.addScore(SCORE_PER_ENEMY);
          this._totalEnemyDestroyed++;
        }
      }
    }
  }

  // ========== 城市/发射台摧毁 ==========

  private destroyCityAt(x: number, y: number): void {
    for (const city of this._cities) {
      if (!city.alive) continue;
      const dx = city.x - x;
      const dy = city.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= CITY_WIDTH) {
        city.alive = false;
      }
    }
  }

  // ========== 波次/游戏检查 ==========

  private checkWaveComplete(): void {
    // 所有敌方导弹已生成且全部非活跃
    const allEnemiesDone =
      this._enemiesToSpawn <= 0 &&
      this._enemyMissiles.every((m) => !m.active);

    // 所有玩家导弹已到达（无飞行中的）
    const allPlayerDone =
      this._playerMissiles.every((m) => !m.active);

    // 所有爆炸已完成
    const allExplosionsDone =
      this._explosions.every((e) => !e.active);

    if (allEnemiesDone && allPlayerDone && allExplosionsDone) {
      this.onWaveCleared();
    }
  }

  private onWaveCleared(): void {
    // 计算奖励
    const aliveCities = this._cities.filter((c) => c.alive).length;
    const totalAmmo = this._batteries.reduce(
      (sum, b) => sum + (b.alive ? b.ammo : 0), 0
    );

    const bonus =
      aliveCities * WAVE_BONUS_CITY + totalAmmo * WAVE_BONUS_AMMO + SCORE_PER_WAVE;
    this.addScore(bonus);

    this._waveState = 'waveCleared';
    this._waveTimer = 2000; // 2 秒后下一波
  }

  private checkGameOver(): void {
    const aliveCities = this._cities.filter((c) => c.alive).length;
    if (aliveCities === 0) {
      this.gameOver();
    }
  }

  // ========== 渲染辅助 ==========

  private renderCities(ctx: CanvasRenderingContext2D): void {
    for (const city of this._cities) {
      ctx.fillStyle = city.alive ? CITY_COLOR : CITY_DESTROYED_COLOR;
      // 简单城市方块
      ctx.fillRect(
        city.x - CITY_WIDTH / 2,
        city.y - CITY_HEIGHT / 2,
        CITY_WIDTH,
        CITY_HEIGHT
      );
      if (city.alive) {
        // 城市建筑轮廓
        ctx.fillStyle = '#81d4fa';
        ctx.fillRect(
          city.x - CITY_WIDTH / 2 + 4,
          city.y - CITY_HEIGHT / 2 + 3,
          CITY_WIDTH / 3 - 2,
          CITY_HEIGHT - 6
        );
        ctx.fillRect(
          city.x + 2,
          city.y - CITY_HEIGHT / 2 + 5,
          CITY_WIDTH / 3 - 2,
          CITY_HEIGHT - 8
        );
      }
    }
  }

  private renderBatteries(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this._batteries.length; i++) {
      const battery = this._batteries[i];
      if (!battery.alive) continue;

      ctx.fillStyle = BATTERY_COLOR;
      // 三角形发射台
      ctx.beginPath();
      ctx.moveTo(battery.x, battery.y - BATTERY_HEIGHT);
      ctx.lineTo(battery.x - BATTERY_WIDTH / 2, battery.y);
      ctx.lineTo(battery.x + BATTERY_WIDTH / 2, battery.y);
      ctx.closePath();
      ctx.fill();

      // 弹药数
      ctx.fillStyle = HUD_COLOR;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${battery.ammo}`, battery.x, battery.y + 12);
      ctx.textAlign = 'left';
    }
  }

  private renderEnemyMissiles(ctx: CanvasRenderingContext2D): void {
    for (const missile of this._enemyMissiles) {
      if (!missile.active) continue;

      // 轨迹线
      if (missile.trail.length >= 2) {
        ctx.strokeStyle = ENEMY_MISSILE_TRAIL_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(missile.trail[0].x, missile.trail[0].y);
        for (let i = 1; i < missile.trail.length; i++) {
          ctx.lineTo(missile.trail[i].x, missile.trail[i].y);
        }
        ctx.stroke();
      }

      // 弹头
      ctx.fillStyle = ENEMY_MISSILE_COLOR;
      ctx.beginPath();
      ctx.arc(missile.x, missile.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderPlayerMissiles(ctx: CanvasRenderingContext2D): void {
    for (const missile of this._playerMissiles) {
      if (!missile.active) continue;

      // 轨迹线
      if (missile.trail.length >= 2) {
        ctx.strokeStyle = MISSILE_TRAIL_COLOR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(missile.trail[0].x, missile.trail[0].y);
        for (let i = 1; i < missile.trail.length; i++) {
          ctx.lineTo(missile.trail[i].x, missile.trail[i].y);
        }
        ctx.stroke();
      }

      // 弹头
      ctx.fillStyle = MISSILE_TRAIL_COLOR;
      ctx.beginPath();
      ctx.arc(missile.x, missile.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderExplosions(ctx: CanvasRenderingContext2D): void {
    for (const exp of this._explosions) {
      if (!exp.active || exp.radius <= 0) continue;

      const gradient = ctx.createRadialGradient(
        exp.x, exp.y, 0,
        exp.x, exp.y, exp.radius
      );
      gradient.addColorStop(0, exp.hitCount > 0 ? EXPLOSION_HIT_COLOR : EXPLOSION_COLOR);
      gradient.addColorStop(0.7, EXPLOSION_COLOR);
      gradient.addColorStop(1, 'rgba(255,152,0,0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 10, 20);
    ctx.fillText(`Wave: ${this._wave}`, 10, 38);

    const aliveCities = this._cities.filter((c) => c.alive).length;
    ctx.textAlign = 'right';
    ctx.fillText(`Cities: ${aliveCities}/${CITY_COUNT}`, CANVAS_WIDTH - 10, 20);

    const totalAmmo = this._batteries.reduce(
      (sum, b) => sum + (b.alive ? b.ammo : 0), 0
    );
    ctx.fillText(`Ammo: ${totalAmmo}`, CANVAS_WIDTH - 10, 38);
    ctx.textAlign = 'left';
  }

  private renderCrosshair(ctx: CanvasRenderingContext2D): void {
    if (this._status !== 'playing') return;

    ctx.strokeStyle = CROSSHAIR_COLOR;
    ctx.lineWidth = 1;
    const size = 10;

    ctx.beginPath();
    ctx.moveTo(this._cursorX - size, this._cursorY);
    ctx.lineTo(this._cursorX + size, this._cursorY);
    ctx.moveTo(this._cursorX, this._cursorY - size);
    ctx.lineTo(this._cursorX, this._cursorY + size);
    ctx.stroke();
  }
}
