import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  TILE_SIZE, MAP_COLS, MAP_ROWS,
  TERRAIN_EMPTY, TERRAIN_BRICK, TERRAIN_STEEL, TERRAIN_WATER, TERRAIN_TREE, TERRAIN_ICE,
  TANK_SIZE,
  PLAYER_SPEED, PLAYER_COLOR, INITIAL_LIVES, PLAYER_SPAWN_X, PLAYER_SPAWN_Y,
  BULLET_SIZE, BULLET_SPEED, BULLET_COLOR, MAX_PLAYER_BULLETS, MAX_ENEMY_BULLETS,
  DIR_UP, DIR_RIGHT, DIR_DOWN, DIR_LEFT, DIR_VECTORS,
  ENEMY_SPEED, ENEMY_SPEED_FAST, ENEMY_COLOR, ENEMY_COLOR_FAST, ENEMY_COLOR_ARMOR,
  ENEMY_SPAWN_INTERVAL, ENEMY_SPAWN_INTERVAL_PER_LEVEL, ENEMY_SPAWN_INTERVAL_MIN,
  ENEMIES_PER_WAVE, ENEMIES_PER_WAVE_PER_LEVEL, ENEMIES_MAX_ON_SCREEN,
  ENEMY_DIRECTION_CHANGE_INTERVAL, ENEMY_SHOOT_INTERVAL,
  ENEMY_SCORE_BASIC, ENEMY_SCORE_FAST, ENEMY_SCORE_ARMOR,
  ENEMY_SPAWN_POSITIONS,
  BASE_SIZE, BASE_X, BASE_Y, BASE_COLOR, BASE_DESTROYED_COLOR,
  POWERUP_SIZE, POWERUP_DURATION, POWERUP_SPAWN_CHANCE,
  POWERUP_STAR, POWERUP_SHIELD, POWERUP_BOMB, POWERUP_CLOCK,
  POWERUP_TYPES,
  SHIELD_DURATION,
  TANK_LEVEL_BASIC, TANK_LEVEL_FAST, TANK_LEVEL_POWER, TANK_LEVEL_ARMOR,
  TANK_SPEED_PER_LEVEL, TANK_BULLET_SPEED_PER_LEVEL,
  BG_COLOR, BRICK_COLOR, STEEL_COLOR, WATER_COLOR, TREE_COLOR, ICE_COLOR,
  HUD_COLOR, SCORE_COLOR,
  SCORE_BRICK_DESTROY,
  LEVEL_1_MAP,
} from './constants';
import type { PowerUpType } from './constants';

// ========== 内部类型 ==========

/** 子弹 */
interface Bullet {
  x: number;
  y: number;
  dir: number; // DIR_UP / DIR_RIGHT / DIR_DOWN / DIR_LEFT
  speed: number;
  alive: boolean;
  owner: 'player' | 'enemy';
  ownerId: number; // 坦克 ID，用于判断子弹归属
  power: number; // 穿透力：1=普通 2=可穿透钢墙
}

/** 坦克（玩家和敌方共用） */
interface Tank {
  id: number;
  x: number;
  y: number;
  dir: number;
  speed: number;
  alive: boolean;
  type: 'player' | 'basic' | 'fast' | 'armor';
  hp: number; // 装甲坦克有多血
  level: number; // 坦克升级等级
  shootCooldown: number; // 射击冷却（毫秒）
  dirChangeTimer: number; // 方向变化计时（敌方用）
  shootTimer: number; // 射击计时（敌方用）
}

/** 道具 */
interface PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  alive: boolean;
  timer: number; // 存在时间
}

/** 冻结效果 */
interface FreezeEffect {
  active: boolean;
  timer: number;
}

// ========== 工具方法 ==========

let nextId = 1;
function genId(): number {
  return nextId++;
}

/** 重置 ID 计数器（测试用） */
export function resetIdCounter(): void {
  nextId = 1;
}

/** 矩形碰撞检测 */
function rectsOverlap(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number,
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

/** 深拷贝地图 */
function cloneMap(map: number[][]): number[][] {
  return map.map(row => [...row]);
}

export class BattleCityEngine extends GameEngine {
  // ========== 游戏状态 ==========

  // 地图（可变：砖墙可被摧毁）
  private _map: number[][] = [];

  // 玩家坦克
  private _player: Tank = this.createPlayerTank();

  // 敌方坦克列表
  private _enemies: Tank[] = [];

  // 子弹列表
  private _bullets: Bullet[] = [];

  // 道具列表
  private _powerUps: PowerUp[] = [];

  // 基地状态
  private _baseAlive: boolean = true;

  // 护盾计时
  private _shieldTimer: number = 0;

  // 冻结效果
  private _freeze: FreezeEffect = { active: false, timer: 0 };

  // 波次
  private _wave: number = 1;

  // 敌方生成计时
  private _enemySpawnTimer: number = 0;

  // 当前波次剩余未生成的敌人
  private _enemiesRemaining: number = 0;

  // 输入
  private _keys: Set<string> = new Set();
  private _shootPressed: boolean = false;

  // 生命数
  private _lives: number = INITIAL_LIVES;

  // ========== Public Getters ==========

  get playerX(): number { return this._player.x; }
  get playerY(): number { return this._player.y; }
  get playerDir(): number { return this._player.dir; }
  get playerAlive(): boolean { return this._player.alive; }
  get playerLevel(): number { return this._player.level; }
  get lives(): number { return this._lives; }
  get wave(): number { return this._wave; }
  get baseAlive(): boolean { return this._baseAlive; }
  get shieldActive(): boolean { return this._shieldTimer > 0; }
  get freezeActive(): boolean { return this._freeze.active; }
  get enemies(): Tank[] { return this._enemies; }
  get bullets(): Bullet[] { return this._bullets; }
  get powerUps(): PowerUp[] { return this._powerUps; }
  get map(): number[][] { return this._map; }
  get enemiesRemaining(): number { return this._enemiesRemaining; }

  // ========== 创建坦克 ==========

  private createPlayerTank(): Tank {
    return {
      id: genId(),
      x: PLAYER_SPAWN_X,
      y: PLAYER_SPAWN_Y,
      dir: DIR_UP,
      speed: PLAYER_SPEED,
      alive: true,
      type: 'player',
      hp: 1,
      level: TANK_LEVEL_BASIC,
      shootCooldown: 0,
      dirChangeTimer: 0,
      shootTimer: 0,
    };
  }

  private createEnemyTank(spawnIndex: number): Tank {
    const pos = ENEMY_SPAWN_POSITIONS[spawnIndex % ENEMY_SPAWN_POSITIONS.length];
    // 随机选择敌人类型（根据波次）
    const rand = Math.random();
    let type: Tank['type'] = 'basic';
    let speed = ENEMY_SPEED;
    let hp = 1;

    if (this._wave >= 3 && rand < 0.2) {
      type = 'armor';
      speed = ENEMY_SPEED;
      hp = 3;
    } else if (this._wave >= 2 && rand < 0.5) {
      type = 'fast';
      speed = ENEMY_SPEED_FAST;
      hp = 1;
    }

    return {
      id: genId(),
      x: pos.x,
      y: pos.y,
      dir: DIR_DOWN,
      speed,
      alive: true,
      type,
      hp,
      level: TANK_LEVEL_BASIC,
      shootCooldown: 0,
      dirChangeTimer: Math.random() * ENEMY_DIRECTION_CHANGE_INTERVAL,
      shootTimer: Math.random() * ENEMY_SHOOT_INTERVAL,
    };
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._map = cloneMap(LEVEL_1_MAP);
    this._player = this.createPlayerTank();
    this._enemies = [];
    this._bullets = [];
    this._powerUps = [];
    this._baseAlive = true;
    this._shieldTimer = 0;
    this._freeze = { active: false, timer: 0 };
    this._wave = 1;
    this._enemySpawnTimer = 0;
    this._enemiesRemaining = this.getEnemiesForWave(1);
    this._keys.clear();
    this._shootPressed = false;
    this._lives = INITIAL_LIVES;
  }

  protected onStart(): void {
    this.onInit();
  }

  protected update(deltaTime: number): void {
    // 1. 更新护盾计时
    this.updateShield(deltaTime);

    // 2. 更新冻结效果
    this.updateFreeze(deltaTime);

    // 3. 玩家移动
    this.updatePlayer(deltaTime);

    // 4. 敌方 AI
    if (!this._freeze.active) {
      this.updateEnemies(deltaTime);
    }

    // 5. 生成敌人
    this.updateEnemySpawning(deltaTime);

    // 6. 射击
    this.updateShooting(deltaTime);

    // 7. 更新子弹
    this.updateBullets(deltaTime);

    // 8. 碰撞检测
    this.checkBulletTerrainCollisions();
    this.checkBulletTankCollisions();
    this.checkBulletBaseCollision();

    // 9. 道具碰撞
    this.checkPowerUpCollisions();

    // 10. 更新道具计时
    this.updatePowerUps(deltaTime);

    // 11. 清理
    this.cleanup();

    // 12. 检查波次完成
    this.checkWaveComplete();

    // 13. 检查游戏结束
    this.checkGameOver();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 地形（先绘制底层：砖、钢、水、冰）
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const terrain = this._map[row]?.[col] ?? TERRAIN_EMPTY;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        switch (terrain) {
          case TERRAIN_BRICK:
            ctx.fillStyle = BRICK_COLOR;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
          case TERRAIN_STEEL:
            ctx.fillStyle = STEEL_COLOR;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
          case TERRAIN_WATER:
            ctx.fillStyle = WATER_COLOR;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
          case TERRAIN_ICE:
            ctx.fillStyle = ICE_COLOR;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
        }
      }
    }

    // 基地
    ctx.fillStyle = this._baseAlive ? BASE_COLOR : BASE_DESTROYED_COLOR;
    ctx.fillRect(BASE_X, BASE_Y, BASE_SIZE, BASE_SIZE);
    // 鹰标志
    if (this._baseAlive) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🦅', BASE_X + BASE_SIZE / 2, BASE_Y + BASE_SIZE / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // 坦克
    if (this._player.alive) {
      ctx.fillStyle = PLAYER_COLOR;
      ctx.fillRect(this._player.x, this._player.y, TANK_SIZE, TANK_SIZE);
      // 炮管
      this.drawGun(ctx, this._player.x, this._player.y, this._player.dir, '#fff');
    }

    for (const enemy of this._enemies) {
      if (!enemy.alive) continue;
      ctx.fillStyle = enemy.type === 'fast' ? ENEMY_COLOR_FAST :
        enemy.type === 'armor' ? ENEMY_COLOR_ARMOR : ENEMY_COLOR;
      ctx.fillRect(enemy.x, enemy.y, TANK_SIZE, TANK_SIZE);
      this.drawGun(ctx, enemy.x, enemy.y, enemy.dir, '#333');
    }

    // 树丛（覆盖在坦克上方）
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (this._map[row]?.[col] === TERRAIN_TREE) {
          ctx.fillStyle = TREE_COLOR;
          ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // 护盾效果
    if (this._shieldTimer > 0 && this._player.alive) {
      ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
      ctx.fillRect(this._player.x - 2, this._player.y - 2, TANK_SIZE + 4, TANK_SIZE + 4);
    }

    // 子弹
    ctx.fillStyle = BULLET_COLOR;
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      ctx.fillRect(bullet.x, bullet.y, BULLET_SIZE, BULLET_SIZE);
    }

    // 道具
    for (const pu of this._powerUps) {
      if (!pu.alive) continue;
      switch (pu.type) {
        case POWERUP_STAR:
          ctx.fillStyle = '#ffd600';
          break;
        case POWERUP_SHIELD:
          ctx.fillStyle = '#42a5f5';
          break;
        case POWERUP_BOMB:
          ctx.fillStyle = '#ff1744';
          break;
        case POWERUP_CLOCK:
          ctx.fillStyle = '#00e676';
          break;
      }
      ctx.fillRect(pu.x, pu.y, POWERUP_SIZE, POWERUP_SIZE);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = pu.type === POWERUP_STAR ? '★' :
        pu.type === POWERUP_SHIELD ? '🛡' :
        pu.type === POWERUP_BOMB ? '💣' : '⏰';
      ctx.fillText(label, pu.x + POWERUP_SIZE / 2, pu.y + POWERUP_SIZE / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // HUD
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 8, 16);
    ctx.fillStyle = HUD_COLOR;
    ctx.fillText(`Wave: ${this._wave}`, 160, 16);
    ctx.fillText(`Lives: ${this._lives}`, 280, 16);
    ctx.fillText(`Enemies: ${this._enemiesRemaining + this._enemies.filter(e => e.alive).length}`, 380, 16);

    // 冻结效果提示
    if (this._freeze.active) {
      ctx.fillStyle = 'rgba(0, 230, 118, 0.3)';
      ctx.fillRect(0, 0, w, h);
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
      ctx.fillText(`Score: ${this._score}  Wave: ${this._wave}`, w / 2, h / 2 + 20);
      ctx.font = '14px monospace';
      ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 50);
      ctx.textAlign = 'left';
    }
  }

  /** 绘制坦克炮管 */
  private drawGun(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, color: string): void {
    ctx.fillStyle = color;
    const cx = x + TANK_SIZE / 2;
    const cy = y + TANK_SIZE / 2;
    const gunW = 4;
    const gunH = TANK_SIZE / 2 + 2;
    switch (dir) {
      case DIR_UP:
        ctx.fillRect(cx - gunW / 2, y - 2, gunW, gunH);
        break;
      case DIR_DOWN:
        ctx.fillRect(cx - gunW / 2, cy, gunW, gunH);
        break;
      case DIR_LEFT:
        ctx.fillRect(x - 2, cy - gunW / 2, gunH, gunW);
        break;
      case DIR_RIGHT:
        ctx.fillRect(cx, cy - gunW / 2, gunH, gunW);
        break;
    }
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {
    this._enemies = [];
    this._bullets = [];
    this._powerUps = [];
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
      lives: this._lives,
      wave: this._wave,
      playerX: this._player.x,
      playerY: this._player.y,
      playerDir: this._player.dir,
      playerAlive: this._player.alive,
      baseAlive: this._baseAlive,
      enemyCount: this._enemies.filter(e => e.alive).length,
      enemiesRemaining: this._enemiesRemaining,
      bulletCount: this._bullets.filter(b => b.alive).length,
      powerUpCount: this._powerUps.filter(p => p.alive).length,
      shieldActive: this._shieldTimer > 0,
      freezeActive: this._freeze.active,
    };
  }

  // ========== 护盾与冻结 ==========

  private updateShield(deltaTime: number): void {
    if (this._shieldTimer > 0) {
      this._shieldTimer = Math.max(0, this._shieldTimer - deltaTime);
    }
  }

  private updateFreeze(deltaTime: number): void {
    if (this._freeze.active) {
      this._freeze.timer -= deltaTime;
      if (this._freeze.timer <= 0) {
        this._freeze.active = false;
        this._freeze.timer = 0;
      }
    }
  }

  // ========== 玩家逻辑 ==========

  private updatePlayer(deltaTime: number): void {
    if (!this._player.alive) return;

    const dt = deltaTime / 1000;
    let newDir = this._player.dir;
    let moving = false;

    if (this._keys.has('ArrowUp') || this._keys.has('w')) {
      newDir = DIR_UP;
      moving = true;
    } else if (this._keys.has('ArrowDown') || this._keys.has('s')) {
      newDir = DIR_DOWN;
      moving = true;
    } else if (this._keys.has('ArrowLeft') || this._keys.has('a')) {
      newDir = DIR_LEFT;
      moving = true;
    } else if (this._keys.has('ArrowRight') || this._keys.has('d')) {
      newDir = DIR_RIGHT;
      moving = true;
    }

    this._player.dir = newDir;

    if (moving) {
      const speed = this._player.speed + this._player.level * TANK_SPEED_PER_LEVEL;
      const vec = DIR_VECTORS[newDir];
      const newX = this._player.x + vec.dx * speed * dt;
      const newY = this._player.y + vec.dy * speed * dt;

      if (this.canTankMove(this._player, newX, newY)) {
        this._player.x = newX;
        this._player.y = newY;
      }
    }
  }

  // ========== 移动碰撞检测 ==========

  /** 检查坦克是否可以移动到指定位置 */
  private canTankMove(tank: Tank, newX: number, newY: number): boolean {
    // 边界检测
    if (newX < 0 || newY < 0 ||
        newX + TANK_SIZE > CANVAS_WIDTH || newY + TANK_SIZE > CANVAS_HEIGHT) {
      return false;
    }

    // 地形碰撞（砖墙、钢墙、水域阻挡）
    const startCol = Math.floor(newX / TILE_SIZE);
    const endCol = Math.floor((newX + TANK_SIZE - 1) / TILE_SIZE);
    const startRow = Math.floor(newY / TILE_SIZE);
    const endRow = Math.floor((newY + TANK_SIZE - 1) / TILE_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const terrain = this._map[row]?.[col] ?? TERRAIN_EMPTY;
        if (terrain === TERRAIN_BRICK || terrain === TERRAIN_STEEL || terrain === TERRAIN_WATER) {
          return false;
        }
      }
    }

    // 基地碰撞（基地不可穿过）
    if (this._baseAlive && rectsOverlap(newX, newY, TANK_SIZE, TANK_SIZE, BASE_X, BASE_Y, BASE_SIZE, BASE_SIZE)) {
      return false;
    }

    // 其他坦克碰撞
    const allTanks = [this._player, ...this._enemies].filter(t => t.alive && t.id !== tank.id);
    for (const other of allTanks) {
      if (rectsOverlap(newX, newY, TANK_SIZE, TANK_SIZE, other.x, other.y, TANK_SIZE, TANK_SIZE)) {
        return false;
      }
    }

    return true;
  }

  // ========== 敌方 AI ==========

  private updateEnemies(deltaTime: number): void {
    for (const enemy of this._enemies) {
      if (!enemy.alive) continue;

      const dt = deltaTime / 1000;

      // 方向变化计时
      enemy.dirChangeTimer += deltaTime;
      if (enemy.dirChangeTimer >= ENEMY_DIRECTION_CHANGE_INTERVAL) {
        enemy.dirChangeTimer = 0;
        // 随机改变方向，偏向朝向玩家或基地
        const rand = Math.random();
        if (rand < 0.4) {
          // 朝向基地
          enemy.dir = this.getDirectionToward(enemy, BASE_X, BASE_Y);
        } else if (rand < 0.6) {
          // 朝向玩家
          if (this._player.alive) {
            enemy.dir = this.getDirectionToward(enemy, this._player.x, this._player.y);
          } else {
            enemy.dir = this.getRandomDirection();
          }
        } else {
          enemy.dir = this.getRandomDirection();
        }
      }

      // 移动
      const vec = DIR_VECTORS[enemy.dir];
      const newX = enemy.x + vec.dx * enemy.speed * dt;
      const newY = enemy.y + vec.dy * enemy.speed * dt;

      if (this.canTankMove(enemy, newX, newY)) {
        enemy.x = newX;
        enemy.y = newY;
      } else {
        // 碰到障碍物立即改变方向
        enemy.dir = this.getRandomDirection();
        enemy.dirChangeTimer = 0;
      }

      // 射击计时
      enemy.shootTimer += deltaTime;
      if (enemy.shootTimer >= ENEMY_SHOOT_INTERVAL) {
        enemy.shootTimer = 0;
        this.enemyShoot(enemy);
      }
    }
  }

  /** 获取从 tank 指向目标的方向 */
  private getDirectionToward(tank: Tank, targetX: number, targetY: number): number {
    const dx = targetX - tank.x;
    const dy = targetY - tank.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? DIR_RIGHT : DIR_LEFT;
    } else {
      return dy > 0 ? DIR_DOWN : DIR_UP;
    }
  }

  private getRandomDirection(): number {
    return Math.floor(Math.random() * 4);
  }

  // ========== 敌方生成 ==========

  private updateEnemySpawning(deltaTime: number): void {
    if (this._enemiesRemaining <= 0) return;

    const aliveEnemies = this._enemies.filter(e => e.alive);
    if (aliveEnemies.length >= ENEMIES_MAX_ON_SCREEN) return;

    this._enemySpawnTimer += deltaTime;
    const interval = Math.max(
      ENEMY_SPAWN_INTERVAL_MIN,
      ENEMY_SPAWN_INTERVAL + (this._wave - 1) * ENEMY_SPAWN_INTERVAL_PER_LEVEL,
    );

    if (this._enemySpawnTimer >= interval) {
      this._enemySpawnTimer = 0;
      this.spawnEnemy();
    }
  }

  private spawnEnemy(): void {
    if (this._enemiesRemaining <= 0) return;

    // 选择出生点（避免与其他坦克重叠）
    for (let i = 0; i < ENEMY_SPAWN_POSITIONS.length; i++) {
      const pos = ENEMY_SPAWN_POSITIONS[i];
      const blocked = [this._player, ...this._enemies].some(t =>
        t.alive && rectsOverlap(pos.x, pos.y, TANK_SIZE, TANK_SIZE, t.x, t.y, TANK_SIZE, TANK_SIZE)
      );
      if (!blocked) {
        const enemy = this.createEnemyTank(i);
        this._enemies.push(enemy);
        this._enemiesRemaining--;
        return;
      }
    }
    // 所有出生点都被堵住，跳过
  }

  // ========== 射击逻辑 ==========

  private updateShooting(deltaTime: number): void {
    // 玩家射击冷却
    if (this._player.shootCooldown > 0) {
      this._player.shootCooldown -= deltaTime;
    }

    // 玩家射击
    if (this._shootPressed && this._player.alive && this._player.shootCooldown <= 0) {
      const playerBullets = this._bullets.filter(b => b.alive && b.owner === 'player');
      if (playerBullets.length < MAX_PLAYER_BULLETS) {
        this.playerShoot();
        this._player.shootCooldown = 250; // 射击冷却 250ms
      }
    }
  }

  private playerShoot(): void {
    const bulletSpeed = BULLET_SPEED + this._player.level * TANK_BULLET_SPEED_PER_LEVEL;
    const vec = DIR_VECTORS[this._player.dir];
    this._bullets.push({
      x: this._player.x + TANK_SIZE / 2 - BULLET_SIZE / 2 + vec.dx * TANK_SIZE / 2,
      y: this._player.y + TANK_SIZE / 2 - BULLET_SIZE / 2 + vec.dy * TANK_SIZE / 2,
      dir: this._player.dir,
      speed: bulletSpeed,
      alive: true,
      owner: 'player',
      ownerId: this._player.id,
      power: this._player.level >= TANK_LEVEL_POWER ? 2 : 1,
    });
  }

  private enemyShoot(enemy: Tank): void {
    const enemyBullets = this._bullets.filter(b => b.alive && b.ownerId === enemy.id);
    if (enemyBullets.length >= MAX_ENEMY_BULLETS) return;

    const vec = DIR_VECTORS[enemy.dir];
    this._bullets.push({
      x: enemy.x + TANK_SIZE / 2 - BULLET_SIZE / 2 + vec.dx * TANK_SIZE / 2,
      y: enemy.y + TANK_SIZE / 2 - BULLET_SIZE / 2 + vec.dy * TANK_SIZE / 2,
      dir: enemy.dir,
      speed: BULLET_SPEED,
      alive: true,
      owner: 'enemy',
      ownerId: enemy.id,
      power: 1,
    });
  }

  // ========== 子弹更新 ==========

  private updateBullets(deltaTime: number): void {
    const dt = deltaTime / 1000;
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      const vec = DIR_VECTORS[bullet.dir];
      bullet.x += vec.dx * bullet.speed * dt;
      bullet.y += vec.dy * bullet.speed * dt;

      // 出界检测
      if (bullet.x < -BULLET_SIZE || bullet.y < -BULLET_SIZE ||
          bullet.x > CANVAS_WIDTH + BULLET_SIZE || bullet.y > CANVAS_HEIGHT + BULLET_SIZE) {
        bullet.alive = false;
      }
    }
  }

  // ========== 碰撞检测 ==========

  /** 子弹 vs 地形 */
  private checkBulletTerrainCollisions(): void {
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;

      // 检查子弹覆盖的格子
      const startCol = Math.floor(bullet.x / TILE_SIZE);
      const endCol = Math.floor((bullet.x + BULLET_SIZE - 1) / TILE_SIZE);
      const startRow = Math.floor(bullet.y / TILE_SIZE);
      const endRow = Math.floor((bullet.y + BULLET_SIZE - 1) / TILE_SIZE);

      let hit = false;
      for (let row = startRow; row <= endRow && !hit; row++) {
        for (let col = startCol; col <= endCol && !hit; col++) {
          if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) continue;
          const terrain = this._map[row][col];
          if (terrain === TERRAIN_BRICK) {
            this._map[row][col] = TERRAIN_EMPTY;
            hit = true;
            this.addScore(SCORE_BRICK_DESTROY);
          } else if (terrain === TERRAIN_STEEL) {
            if (bullet.power >= 2) {
              this._map[row][col] = TERRAIN_EMPTY;
            }
            hit = true;
          }
        }
      }
      if (hit) {
        bullet.alive = false;
      }
    }
  }

  /** 子弹 vs 坦克 */
  private checkBulletTankCollisions(): void {
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;

      // 玩家子弹 vs 敌方坦克
      if (bullet.owner === 'player') {
        for (const enemy of this._enemies) {
          if (!enemy.alive) continue;
          if (rectsOverlap(bullet.x, bullet.y, BULLET_SIZE, BULLET_SIZE,
            enemy.x, enemy.y, TANK_SIZE, TANK_SIZE)) {
            bullet.alive = false;
            enemy.hp--;
            if (enemy.hp <= 0) {
              enemy.alive = false;
              this.addScore(this.getEnemyScore(enemy));
              // 掉落道具
              this.tryDropPowerUp(enemy.x, enemy.y);
            }
            break;
          }
        }
      }

      // 敌方子弹 vs 玩家
      if (bullet.owner === 'enemy' && this._player.alive) {
        if (rectsOverlap(bullet.x, bullet.y, BULLET_SIZE, BULLET_SIZE,
          this._player.x, this._player.y, TANK_SIZE, TANK_SIZE)) {
          bullet.alive = false;
          if (this._shieldTimer <= 0) {
            this.playerHit();
          }
        }
      }
    }

    // 子弹 vs 子弹（互相抵消）
    for (let i = 0; i < this._bullets.length; i++) {
      const a = this._bullets[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this._bullets.length; j++) {
        const b = this._bullets[j];
        if (!b.alive) continue;
        if (a.owner !== b.owner) {
          if (rectsOverlap(a.x, a.y, BULLET_SIZE, BULLET_SIZE, b.x, b.y, BULLET_SIZE, BULLET_SIZE)) {
            a.alive = false;
            b.alive = false;
          }
        }
      }
    }
  }

  /** 子弹 vs 基地 */
  private checkBulletBaseCollision(): void {
    if (!this._baseAlive) return;
    for (const bullet of this._bullets) {
      if (!bullet.alive) continue;
      if (rectsOverlap(bullet.x, bullet.y, BULLET_SIZE, BULLET_SIZE,
        BASE_X, BASE_Y, BASE_SIZE, BASE_SIZE)) {
        bullet.alive = false;
        this._baseAlive = false;
        this.emit('baseDestroyed');
      }
    }
  }

  /** 道具碰撞 */
  private checkPowerUpCollisions(): void {
    if (!this._player.alive) return;
    for (const pu of this._powerUps) {
      if (!pu.alive) continue;
      if (rectsOverlap(this._player.x, this._player.y, TANK_SIZE, TANK_SIZE,
        pu.x, pu.y, POWERUP_SIZE, POWERUP_SIZE)) {
        pu.alive = false;
        this.applyPowerUp(pu.type);
      }
    }
  }

  // ========== 道具 ==========

  private tryDropPowerUp(x: number, y: number): void {
    if (Math.random() < POWERUP_SPAWN_CHANCE) {
      const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      // 确保道具在画布内
      const puX = Math.max(0, Math.min(x, CANVAS_WIDTH - POWERUP_SIZE));
      const puY = Math.max(0, Math.min(y, CANVAS_HEIGHT - POWERUP_SIZE));
      this._powerUps.push({
        x: puX,
        y: puY,
        type,
        alive: true,
        timer: POWERUP_DURATION,
      });
    }
  }

  private applyPowerUp(type: PowerUpType): void {
    switch (type) {
      case POWERUP_STAR:
        // 升级坦克（最高 3 级）
        if (this._player.level < TANK_LEVEL_ARMOR) {
          this._player.level++;
        }
        this.emit('powerUp', POWERUP_STAR);
        break;
      case POWERUP_SHIELD:
        this._shieldTimer = SHIELD_DURATION;
        this.emit('powerUp', POWERUP_SHIELD);
        break;
      case POWERUP_BOMB:
        // 消灭所有在场敌人
        for (const enemy of this._enemies) {
          if (enemy.alive) {
            enemy.alive = false;
            this.addScore(this.getEnemyScore(enemy));
          }
        }
        this.emit('powerUp', POWERUP_BOMB);
        break;
      case POWERUP_CLOCK:
        this._freeze = { active: true, timer: 5000 };
        this.emit('powerUp', POWERUP_CLOCK);
        break;
    }
  }

  private updatePowerUps(deltaTime: number): void {
    for (const pu of this._powerUps) {
      if (!pu.alive) continue;
      pu.timer -= deltaTime;
      if (pu.timer <= 0) {
        pu.alive = false;
      }
    }
  }

  // ========== 玩家被击中 ==========

  private playerHit(): void {
    this._lives--;
    this.emit('loseLife', this._lives);
    if (this._lives <= 0) {
      this._player.alive = false;
    } else {
      // 重置玩家位置
      this._player.x = PLAYER_SPAWN_X;
      this._player.y = PLAYER_SPAWN_Y;
      this._player.dir = DIR_UP;
      this._player.level = TANK_LEVEL_BASIC;
      // 给短暂护盾
      this._shieldTimer = 2000;
      // 清除子弹
      this._bullets = this._bullets.filter(b => b.owner !== 'player');
    }
  }

  // ========== 清理 ==========

  private cleanup(): void {
    this._bullets = this._bullets.filter(b => b.alive);
    this._enemies = this._enemies.filter(e => e.alive);
    this._powerUps = this._powerUps.filter(p => p.alive);
  }

  // ========== 波次检查 ==========

  private checkWaveComplete(): void {
    if (this._enemiesRemaining <= 0 && this._enemies.filter(e => e.alive).length === 0) {
      this.nextWave();
    }
  }

  private nextWave(): void {
    this._wave++;
    this._level = this._wave;
    this.setLevel(this._level);
    this._enemiesRemaining = this.getEnemiesForWave(this._wave);
    this._enemySpawnTimer = 0;
    this._bullets = [];
    this._powerUps = [];
    this._freeze = { active: false, timer: 0 };
    this.emit('waveChange', this._wave);
  }

  private getEnemiesForWave(wave: number): number {
    return ENEMIES_PER_WAVE + (wave - 1) * ENEMIES_PER_WAVE_PER_LEVEL;
  }

  // ========== 游戏结束检查 ==========

  private checkGameOver(): void {
    if (this._status !== 'playing') return;
    if (!this._baseAlive || (this._lives <= 0 && !this._player.alive)) {
      this.gameOver();
    }
  }

  // ========== 辅助 ==========

  private getEnemyScore(enemy: Tank): number {
    switch (enemy.type) {
      case 'fast': return ENEMY_SCORE_FAST;
      case 'armor': return ENEMY_SCORE_ARMOR;
      default: return ENEMY_SCORE_BASIC;
    }
  }
}
