import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_SPEED, JUMP_VELOCITY, GRAVITY,
  INITIAL_LIVES,
  PLATFORM_WIDTH, PLATFORM_HEIGHT,
  PLATFORM_COLOR_NORMAL, PLATFORM_COLOR_MOVING, PLATFORM_COLOR_FRAGILE,
  PLATFORM_COLOR_SPRING, PLATFORM_SPACING, PLATFORMS_ON_SCREEN,
  MOVING_PLATFORM_SPEED, MOVING_PLATFORM_RANGE, SPRING_JUMP_MULTIPLIER,
  POWERUP_SIZE,
  POWERUP_DART_COLOR, POWERUP_SHIELD_COLOR, POWERUP_MAGNET_COLOR,
  POWERUP_DART_DURATION, POWERUP_SHIELD_DURATION, POWERUP_MAGNET_DURATION,
  POWERUP_MAGNET_RANGE, POWERUP_MAGNET_FORCE,
  POWERUP_SPAWN_CHANCE,
  DART_WIDTH, DART_HEIGHT, DART_SPEED, DART_COLOR, MAX_DARTS,
  ENEMY_FLYING_SIZE, ENEMY_FLYING_SPEED, ENEMY_FLYING_COLOR,
  ENEMY_ROCK_SIZE, ENEMY_ROCK_SPEED, ENEMY_ROCK_COLOR,
  ENEMY_SPAWN_INTERVAL_BASE, ENEMY_SPAWN_INTERVAL_MIN, ENEMY_SCORE,
  DIFFICULTY_INTERVAL, MAX_DIFFICULTY_LEVEL,
  HEIGHT_SCORE_MULTIPLIER,
  BG_COLOR, HUD_COLOR, SCORE_COLOR, SHIELD_COLOR,
  DIR_LEFT, DIR_RIGHT,
} from './constants';

// ========== 内部类型 ==========

/** 平台类型 */
export type PlatformType = 'normal' | 'moving' | 'fragile' | 'spring';

/** 平台 */
export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: PlatformType;
  alive: boolean;
  // 移动平台属性
  originX?: number;
  moveDir?: number;
  // 易碎平台属性
  breaking?: boolean;
  breakTimer?: number;
}

/** 道具类型 */
export type PowerUpType = 'dart' | 'shield' | 'magnet';

/** 道具 */
export interface PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  alive: boolean;
  collected: boolean;
}

/** 飞镖 */
export interface Dart {
  x: number;
  y: number;
  alive: boolean;
}

/** 敌人类型 */
export type EnemyType = 'flying' | 'rock';

/** 敌人 */
export interface Enemy {
  x: number;
  y: number;
  type: EnemyType;
  alive: boolean;
  dx: number; // 水平速度（仅飞行忍者使用）
}

/** 活跃道具效果 */
export interface ActivePowerUp {
  type: PowerUpType;
  remainingTime: number;
  duration: number;
}

// ========== 辅助函数 ==========

/** 生成 [min, max) 范围随机数 */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 生成 [min, max] 范围随机整数 */
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

/** 矩形碰撞检测 */
function rectOverlap(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number,
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

export class NinjaJumpEngine extends GameEngine {
  // ========== 游戏状态 ==========

  // 忍者
  private _playerX: number = 0;
  private _playerY: number = 0;
  private _playerVX: number = 0;
  private _playerVY: number = 0;
  private _lives: number = INITIAL_LIVES;
  private _facingLeft: boolean = false;

  // 相机
  private _cameraY: number = 0;
  private _maxHeight: number = 0; // 已达到的最高高度（用于计分）

  // 输入
  private _keys: Set<string> = new Set();
  private _shootPressed: boolean = false;

  // 平台
  private _platforms: Platform[] = [];
  private _highestPlatformY: number = 0; // 最高平台的 y 坐标（向上为负）

  // 道具
  private _powerUps: PowerUp[] = [];

  // 飞镖
  private _darts: Dart[] = [];

  // 敌人
  private _enemies: Enemy[] = [];
  private _enemySpawnTimer: number = 0;

  // 活跃道具效果
  private _activePowerUps: ActivePowerUp[] = [];

  // 难度
  private _difficultyLevel: number = 1;

  // 无敌时间（被击中后短暂无敌）
  private _invincibleTimer: number = 0;

  // ========== Public Getters ==========

  get playerX(): number { return this._playerX; }
  get playerY(): number { return this._playerY; }
  get playerVY(): number { return this._playerVY; }
  get lives(): number { return this._lives; }
  get cameraY(): number { return this._cameraY; }
  get maxHeight(): number { return this._maxHeight; }
  get platforms(): Platform[] { return this._platforms; }
  get powerUps(): PowerUp[] { return this._powerUps; }
  get darts(): Dart[] { return this._darts; }
  get enemies(): Enemy[] { return this._enemies; }
  get activePowerUps(): ActivePowerUp[] { return this._activePowerUps; }
  get difficultyLevel(): number { return this._difficultyLevel; }
  get invincibleTimer(): number { return this._invincibleTimer; }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._playerX = (CANVAS_WIDTH - PLAYER_WIDTH) / 2;
    this._playerY = CANVAS_HEIGHT - PLAYER_HEIGHT - 60;
    this._playerVX = 0;
    this._playerVY = 0;
    this._lives = INITIAL_LIVES;
    this._facingLeft = false;
    this._cameraY = 0;
    this._maxHeight = 0;
    this._keys.clear();
    this._shootPressed = false;
    this._platforms = [];
    this._highestPlatformY = CANVAS_HEIGHT;
    this._powerUps = [];
    this._darts = [];
    this._enemies = [];
    this._enemySpawnTimer = 0;
    this._activePowerUps = [];
    this._difficultyLevel = 1;
    this._invincibleTimer = 0;
  }

  protected onStart(): void {
    this.onInit();
    this.generateInitialPlatforms();
    // 在玩家脚下放一个起始平台
    this._platforms.push({
      x: this._playerX - 10,
      y: this._playerY + PLAYER_HEIGHT,
      width: PLATFORM_WIDTH + 20,
      height: PLATFORM_HEIGHT,
      type: 'normal',
      alive: true,
    });
    // 给玩家一个初始跳跃
    this._playerVY = JUMP_VELOCITY;
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000;

    // 1. 更新输入
    this.updatePlayerInput(dt);

    // 2. 更新玩家物理
    this.updatePlayerPhysics(dt);

    // 3. 更新相机
    this.updateCamera();

    // 4. 更新平台
    this.updatePlatforms(dt);

    // 5. 碰撞检测：玩家 vs 平台
    this.checkPlayerPlatformCollision();

    // 6. 碰撞检测：玩家 vs 道具
    this.checkPlayerPowerUpCollision();

    // 7. 磁铁效果
    this.updateMagnetEffect(dt);

    // 8. 更新飞镖
    this.updateDarts(dt);

    // 9. 更新敌人
    this.updateEnemies(dt, deltaTime);

    // 10. 碰撞检测：飞镖 vs 敌人
    this.checkDartEnemyCollision();

    // 11. 碰撞检测：玩家 vs 敌人
    this.checkPlayerEnemyCollision();

    // 12. 更新活跃道具效果
    this.updateActivePowerUps(deltaTime);

    // 13. 更新无敌时间
    this.updateInvincibility(dt);

    // 14. 生成新平台和敌人
    this.generatePlatforms();
    this.trySpawnEnemy(deltaTime);

    // 15. 清理出界实体
    this.cleanup();

    // 16. 更新难度
    this.updateDifficulty();

    // 17. 检查游戏结束
    this.checkGameOver();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 绘制背景星星（简单装饰）
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    const starSeed = Math.floor(this._cameraY / 200);
    for (let i = 0; i < 20; i++) {
      const sx = ((starSeed * 37 + i * 73) % w);
      const sy = ((starSeed * 53 + i * 97) % h);
      ctx.fillRect(sx, sy, 2, 2);
    }

    const offsetY = -this._cameraY;

    // 平台
    for (const platform of this._platforms) {
      if (!platform.alive) continue;
      const drawY = platform.y + offsetY;
      if (drawY < -20 || drawY > h + 20) continue;

      let color = PLATFORM_COLOR_NORMAL;
      if (platform.type === 'moving') color = PLATFORM_COLOR_MOVING;
      else if (platform.type === 'fragile') color = PLATFORM_COLOR_FRAGILE;
      else if (platform.type === 'spring') color = PLATFORM_COLOR_SPRING;

      ctx.fillStyle = color;
      ctx.fillRect(platform.x, drawY, platform.width, platform.height);

      // 弹簧平台额外标记
      if (platform.type === 'spring') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(platform.x + platform.width / 2 - 4, drawY - 6, 8, 6);
      }

      // 易碎平台裂痕
      if (platform.type === 'fragile' && platform.breaking) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(platform.x + platform.width * 0.3, drawY);
        ctx.lineTo(platform.x + platform.width * 0.5, drawY + platform.height);
        ctx.stroke();
      }
    }

    // 道具
    for (const pu of this._powerUps) {
      if (!pu.alive) continue;
      const drawY = pu.y + offsetY;
      if (drawY < -20 || drawY > h + 20) continue;

      let color = POWERUP_DART_COLOR;
      if (pu.type === 'shield') color = POWERUP_SHIELD_COLOR;
      else if (pu.type === 'magnet') color = POWERUP_MAGNET_COLOR;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pu.x + POWERUP_SIZE / 2, drawY + POWERUP_SIZE / 2, POWERUP_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 敌人
    for (const enemy of this._enemies) {
      if (!enemy.alive) continue;
      const drawY = enemy.y + offsetY;
      if (drawY < -40 || drawY > h + 40) continue;

      if (enemy.type === 'flying') {
        ctx.fillStyle = ENEMY_FLYING_COLOR;
        ctx.fillRect(enemy.x, drawY, ENEMY_FLYING_SIZE, ENEMY_FLYING_SIZE);
        // 翅膀
        ctx.fillRect(enemy.x - 6, drawY + 4, 6, 4);
        ctx.fillRect(enemy.x + ENEMY_FLYING_SIZE, drawY + 4, 6, 4);
      } else {
        ctx.fillStyle = ENEMY_ROCK_COLOR;
        ctx.beginPath();
        ctx.arc(
          enemy.x + ENEMY_ROCK_SIZE / 2,
          drawY + ENEMY_ROCK_SIZE / 2,
          ENEMY_ROCK_SIZE / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    // 飞镖
    ctx.fillStyle = DART_COLOR;
    for (const dart of this._darts) {
      if (!dart.alive) continue;
      const drawY = dart.y + offsetY;
      ctx.fillRect(dart.x, drawY, DART_WIDTH, DART_HEIGHT);
    }

    // 忍者（玩家）
    const playerDrawY = this._playerY + offsetY;
    // 无敌闪烁
    if (this._invincibleTimer > 0 && Math.floor(this._invincibleTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // 护盾光环
    if (this.hasShield()) {
      ctx.fillStyle = SHIELD_COLOR;
      ctx.beginPath();
      ctx.arc(
        this._playerX + PLAYER_WIDTH / 2,
        playerDrawY + PLAYER_HEIGHT / 2,
        PLAYER_WIDTH * 0.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // 忍者身体
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(this._playerX, playerDrawY, PLAYER_WIDTH, PLAYER_HEIGHT);
    // 忍者头巾
    ctx.fillStyle = '#e53935';
    ctx.fillRect(this._playerX + 4, playerDrawY + 2, PLAYER_WIDTH - 8, 6);
    // 忍者眼睛
    ctx.fillStyle = '#ffffff';
    const eyeOffsetX = this._facingLeft ? 6 : 14;
    ctx.fillRect(this._playerX + eyeOffsetX, playerDrawY + 4, 5, 3);
    ctx.fillRect(this._playerX + eyeOffsetX + 8, playerDrawY + 4, 5, 3);

    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 8, 20);
    ctx.fillStyle = HUD_COLOR;
    ctx.fillText(`Lives: ${this._lives}`, 200, 20);
    ctx.fillText(`Lv: ${this._difficultyLevel}`, 360, 20);

    // 活跃道具指示
    let hudY = 40;
    for (const apu of this._activePowerUps) {
      let label = '';
      let color = '#fff';
      if (apu.type === 'dart') { label = 'DART'; color = POWERUP_DART_COLOR; }
      else if (apu.type === 'shield') { label = 'SHIELD'; color = POWERUP_SHIELD_COLOR; }
      else if (apu.type === 'magnet') { label = 'MAGNET'; color = POWERUP_MAGNET_COLOR; }

      ctx.fillStyle = color;
      ctx.font = '12px monospace';
      ctx.fillText(`${label} ${(apu.remainingTime / 1000).toFixed(1)}s`, 8, hudY);
      hudY += 16;
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
      ctx.fillText(`Score: ${this._score}  Height: ${Math.floor(this._maxHeight)}`, w / 2, h / 2 + 20);
      ctx.font = '14px monospace';
      ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 50);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {
    this._enemies = [];
    this._darts = [];
    this._activePowerUps = [];
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
      playerX: this._playerX,
      playerY: this._playerY,
      playerVY: this._playerVY,
      cameraY: this._cameraY,
      maxHeight: this._maxHeight,
      difficultyLevel: this._difficultyLevel,
      platformCount: this._platforms.filter(p => p.alive).length,
      enemyCount: this._enemies.filter(e => e.alive).length,
      dartCount: this._darts.filter(d => d.alive).length,
      activePowerUpTypes: this._activePowerUps.map(p => p.type),
    };
  }

  // ========== 玩家逻辑 ==========

  private updatePlayerInput(dt: number): void {
    const speed = PLAYER_SPEED * dt;
    if (this._keys.has('ArrowLeft') || this._keys.has('a')) {
      this._playerX -= speed;
      this._facingLeft = true;
    }
    if (this._keys.has('ArrowRight') || this._keys.has('d')) {
      this._playerX += speed;
      this._facingLeft = false;
    }

    // 屏幕环绕
    if (this._playerX + PLAYER_WIDTH < 0) {
      this._playerX = CANVAS_WIDTH;
    } else if (this._playerX > CANVAS_WIDTH) {
      this._playerX = -PLAYER_WIDTH;
    }

    // 射击飞镖
    if (this._shootPressed && this.hasDartPowerUp()) {
      this.shootDart();
      this._shootPressed = false;
    }
  }

  private updatePlayerPhysics(dt: number): void {
    // 重力
    this._playerVY += GRAVITY * dt;
    this._playerY += this._playerVY * dt;
  }

  // ========== 相机逻辑 ==========

  private updateCamera(): void {
    // 相机跟随玩家向上（不向下）
    const targetY = this._playerY - CANVAS_HEIGHT * 0.4;
    if (targetY < this._cameraY) {
      this._cameraY = targetY;
    }

    // 更新最高高度和分数
    const currentHeight = -this._playerY;
    if (currentHeight > this._maxHeight) {
      const heightGain = currentHeight - this._maxHeight;
      this.addScore(Math.floor(heightGain * HEIGHT_SCORE_MULTIPLIER));
      this._maxHeight = currentHeight;
    }
  }

  // ========== 平台逻辑 ==========

  private generateInitialPlatforms(): void {
    // 从底部到顶部生成初始平台
    let y = CANVAS_HEIGHT - 40;
    for (let i = 0; i < PLATFORMS_ON_SCREEN + 5; i++) {
      const x = rand(0, CANVAS_WIDTH - PLATFORM_WIDTH);
      const type = this.randomPlatformType(1);
      this._platforms.push(this.createPlatform(x, y, type));
      y -= PLATFORM_SPACING + rand(-10, 20);
    }
    this._highestPlatformY = y + PLATFORM_SPACING;
  }

  private generatePlatforms(): void {
    // 当最高平台接近屏幕可见区域顶部时，生成更多平台
    const visibleTop = this._cameraY - 100;
    while (this._highestPlatformY > visibleTop) {
      const y = this._highestPlatformY - PLATFORM_SPACING - rand(-10, 20);
      const x = rand(0, CANVAS_WIDTH - PLATFORM_WIDTH);
      const type = this.randomPlatformType(this._difficultyLevel);
      const platform = this.createPlatform(x, y, type);
      this._platforms.push(platform);

      // 概率生成道具
      if (Math.random() < POWERUP_SPAWN_CHANCE) {
        const puType = this.randomPowerUpType();
        this._powerUps.push({
          x: x + PLATFORM_WIDTH / 2 - POWERUP_SIZE / 2,
          y: y - POWERUP_SIZE - 5,
          type: puType,
          alive: true,
          collected: false,
        });
      }

      this._highestPlatformY = y;
    }
  }

  private createPlatform(x: number, y: number, type: PlatformType): Platform {
    const platform: Platform = {
      x,
      y,
      width: PLATFORM_WIDTH,
      height: PLATFORM_HEIGHT,
      type,
      alive: true,
    };

    if (type === 'moving') {
      platform.originX = x;
      platform.moveDir = Math.random() < 0.5 ? DIR_LEFT : DIR_RIGHT;
    }

    if (type === 'fragile') {
      platform.breaking = false;
      platform.breakTimer = 0;
    }

    return platform;
  }

  private randomPlatformType(difficulty: number): PlatformType {
    const r = Math.random();
    // 随难度增加，特殊平台概率增加
    const fragileChance = 0.05 + difficulty * 0.03;
    const movingChance = 0.1 + difficulty * 0.02;
    const springChance = 0.08;

    if (r < fragileChance) return 'fragile';
    if (r < fragileChance + movingChance) return 'moving';
    if (r < fragileChance + movingChance + springChance) return 'spring';
    return 'normal';
  }

  private randomPowerUpType(): PowerUpType {
    const r = Math.random();
    if (r < 0.4) return 'dart';
    if (r < 0.7) return 'shield';
    return 'magnet';
  }

  private updatePlatforms(dt: number): void {
    for (const platform of this._platforms) {
      if (!platform.alive) continue;

      // 移动平台
      if (platform.type === 'moving' && platform.originX !== undefined && platform.moveDir !== undefined) {
        platform.x += platform.moveDir * MOVING_PLATFORM_SPEED * dt;
        if (platform.x < platform.originX - MOVING_PLATFORM_RANGE / 2) {
          platform.x = platform.originX - MOVING_PLATFORM_RANGE / 2;
          platform.moveDir = DIR_RIGHT;
        } else if (platform.x > platform.originX + MOVING_PLATFORM_RANGE / 2) {
          platform.x = platform.originX + MOVING_PLATFORM_RANGE / 2;
          platform.moveDir = DIR_LEFT;
        }
      }

      // 易碎平台破碎动画
      if (platform.type === 'fragile' && platform.breaking) {
        platform.breakTimer! += dt;
        if (platform.breakTimer! > 0.3) {
          platform.alive = false;
        }
      }
    }
  }

  // ========== 碰撞检测 ==========

  private checkPlayerPlatformCollision(): void {
    // 只在下落时检测碰撞
    if (this._playerVY <= 0) return;

    const playerBottom = this._playerY + PLAYER_HEIGHT;
    const playerLeft = this._playerX;
    const playerRight = this._playerX + PLAYER_WIDTH;

    for (const platform of this._platforms) {
      if (!platform.alive) continue;
      if (platform.type === 'fragile' && platform.breaking) continue;

      const platTop = platform.y;
      const platLeft = platform.x;
      const platRight = platform.x + platform.width;

      // 水平重叠
      if (playerRight <= platLeft || playerLeft >= platRight) continue;

      // 玩家底部接近平台顶部，且正在下落
      // 使用容差检测，只要玩家底部在平台顶部附近就算碰撞
      const tolerance = Math.max(this._playerVY * (1 / 60), 2);
      if (playerBottom >= platTop && playerBottom <= platTop + tolerance + PLATFORM_HEIGHT) {
        // 着陆！
        this._playerY = platTop - PLAYER_HEIGHT;

        if (platform.type === 'spring') {
          this._playerVY = JUMP_VELOCITY * SPRING_JUMP_MULTIPLIER;
        } else {
          this._playerVY = JUMP_VELOCITY;
        }

        // 易碎平台开始破碎
        if (platform.type === 'fragile') {
          platform.breaking = true;
          platform.breakTimer = 0;
        }

        return;
      }
    }
  }

  private checkPlayerPowerUpCollision(): void {
    const px = this._playerX;
    const py = this._playerY;

    for (const pu of this._powerUps) {
      if (!pu.alive || pu.collected) continue;

      if (rectOverlap(
        px, py, PLAYER_WIDTH, PLAYER_HEIGHT,
        pu.x, pu.y, POWERUP_SIZE, POWERUP_SIZE,
      )) {
        pu.collected = true;
        pu.alive = false;
        this.activatePowerUp(pu.type);
      }
    }
  }

  private checkDartEnemyCollision(): void {
    for (const dart of this._darts) {
      if (!dart.alive) continue;

      for (const enemy of this._enemies) {
        if (!enemy.alive) continue;

        const ex = enemy.x;
        const ey = enemy.y;
        const eSize = enemy.type === 'flying' ? ENEMY_FLYING_SIZE : ENEMY_ROCK_SIZE;

        if (rectOverlap(
          dart.x, dart.y, DART_WIDTH, DART_HEIGHT,
          ex, ey, eSize, eSize,
        )) {
          dart.alive = false;
          enemy.alive = false;
          this.addScore(ENEMY_SCORE);
          break;
        }
      }
    }
  }

  private checkPlayerEnemyCollision(): void {
    if (this._invincibleTimer > 0) return;
    if (this.hasShield()) return;

    for (const enemy of this._enemies) {
      if (!enemy.alive) continue;

      const eSize = enemy.type === 'flying' ? ENEMY_FLYING_SIZE : ENEMY_ROCK_SIZE;

      if (rectOverlap(
        this._playerX, this._playerY, PLAYER_WIDTH, PLAYER_HEIGHT,
        enemy.x, enemy.y, eSize, eSize,
      )) {
        this.playerHit();
        return;
      }
    }
  }

  // ========== 道具系统 ==========

  private activatePowerUp(type: PowerUpType): void {
    // 如果已有同类型道具，刷新时间
    const existing = this._activePowerUps.find(p => p.type === type);
    if (existing) {
      existing.remainingTime = existing.duration;
      return;
    }

    let duration = 0;
    if (type === 'dart') duration = POWERUP_DART_DURATION;
    else if (type === 'shield') duration = POWERUP_SHIELD_DURATION;
    else if (type === 'magnet') duration = POWERUP_MAGNET_DURATION;

    this._activePowerUps.push({
      type,
      remainingTime: duration,
      duration,
    });

    this.emit('powerUpActivated', type);
  }

  private updateActivePowerUps(deltaTime: number): void {
    for (const pu of this._activePowerUps) {
      pu.remainingTime -= deltaTime;
    }
    this._activePowerUps = this._activePowerUps.filter(pu => pu.remainingTime > 0);
  }

  hasDartPowerUp(): boolean {
    return this._activePowerUps.some(pu => pu.type === 'dart');
  }

  hasShield(): boolean {
    return this._activePowerUps.some(pu => pu.type === 'shield');
  }

  hasMagnet(): boolean {
    return this._activePowerUps.some(pu => pu.type === 'magnet');
  }

  // ========== 飞镖系统 ==========

  private shootDart(): void {
    const activeDarts = this._darts.filter(d => d.alive);
    if (activeDarts.length >= MAX_DARTS) return;

    this._darts.push({
      x: this._playerX + PLAYER_WIDTH / 2 - DART_WIDTH / 2,
      y: this._playerY - DART_HEIGHT,
      alive: true,
    });
  }

  private updateDarts(dt: number): void {
    for (const dart of this._darts) {
      if (!dart.alive) continue;
      dart.y -= DART_SPEED * dt;

      // 出界（相对于相机）
      if (dart.y + DART_HEIGHT < this._cameraY - 50) {
        dart.alive = false;
      }
    }
  }

  // ========== 敌人系统 ==========

  private updateEnemies(dt: number, _deltaTime: number): void {
    for (const enemy of this._enemies) {
      if (!enemy.alive) continue;

      if (enemy.type === 'flying') {
        // 飞行忍者：水平移动
        enemy.x += enemy.dx * ENEMY_FLYING_SPEED * dt;
        // 边界反弹
        if (enemy.x < 0 || enemy.x > CANVAS_WIDTH - ENEMY_FLYING_SIZE) {
          enemy.dx = -enemy.dx;
          enemy.x = Math.max(0, Math.min(CANVAS_WIDTH - ENEMY_FLYING_SIZE, enemy.x));
        }
      } else {
        // 落石：向下掉落
        enemy.y += ENEMY_ROCK_SPEED * dt;
      }
    }
  }

  private trySpawnEnemy(deltaTime: number): void {
    this._enemySpawnTimer += deltaTime;

    const interval = Math.max(
      ENEMY_SPAWN_INTERVAL_MIN,
      ENEMY_SPAWN_INTERVAL_BASE - this._difficultyLevel * 250,
    );

    if (this._enemySpawnTimer >= interval) {
      this._enemySpawnTimer = 0;
      this.spawnEnemy();
    }
  }

  private spawnEnemy(): void {
    const type: EnemyType = Math.random() < 0.5 ? 'flying' : 'rock';

    if (type === 'flying') {
      // 飞行忍者出现在屏幕可见区域顶部附近
      const y = this._cameraY + rand(20, 100);
      const fromLeft = Math.random() < 0.5;
      this._enemies.push({
        x: fromLeft ? 0 : CANVAS_WIDTH - ENEMY_FLYING_SIZE,
        y,
        type: 'flying',
        alive: true,
        dx: fromLeft ? DIR_RIGHT : DIR_LEFT,
      });
    } else {
      // 落石从顶部掉落
      const x = rand(0, CANVAS_WIDTH - ENEMY_ROCK_SIZE);
      const y = this._cameraY - ENEMY_ROCK_SIZE;
      this._enemies.push({
        x,
        y,
        type: 'rock',
        alive: true,
        dx: 0,
      });
    }
  }

  // ========== 磁铁效果 ==========

  private updateMagnetEffect(dt: number): void {
    if (!this.hasMagnet()) return;

    const pcx = this._playerX + PLAYER_WIDTH / 2;
    const pcy = this._playerY + PLAYER_HEIGHT / 2;

    for (const pu of this._powerUps) {
      if (!pu.alive || pu.collected) continue;

      const pucx = pu.x + POWERUP_SIZE / 2;
      const pucy = pu.y + POWERUP_SIZE / 2;
      const dx = pcx - pucx;
      const dy = pcy - pucy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < POWERUP_MAGNET_RANGE && dist > 0) {
        const force = POWERUP_MAGNET_FORCE * dt;
        const nx = dx / dist;
        const ny = dy / dist;
        pu.x += nx * force;
        pu.y += ny * force;
      }
    }
  }

  // ========== 玩家被击中 ==========

  private playerHit(): void {
    this._lives--;
    this._invincibleTimer = 2; // 2 秒无敌
    this.emit('loseLife', this._lives);

    if (this._lives <= 0) {
      this.gameOver();
    }
  }

  private updateInvincibility(dt: number): void {
    if (this._invincibleTimer > 0) {
      this._invincibleTimer -= dt;
      if (this._invincibleTimer < 0) this._invincibleTimer = 0;
    }
  }

  // ========== 难度 ==========

  private updateDifficulty(): void {
    const newDiff = Math.min(
      MAX_DIFFICULTY_LEVEL,
      1 + Math.floor(this._score / DIFFICULTY_INTERVAL),
    );
    if (newDiff !== this._difficultyLevel) {
      this._difficultyLevel = newDiff;
      this._level = newDiff;
      this.setLevel(newDiff);
    }
  }

  // ========== 游戏结束检查 ==========

  private checkGameOver(): void {
    // 玩家掉出屏幕底部
    if (this._playerY > this._cameraY + CANVAS_HEIGHT + 50) {
      this.gameOver();
    }
  }

  // ========== 清理 ==========

  private cleanup(): void {
    const bottomBound = this._cameraY + CANVAS_HEIGHT + 100;

    // 清理出界平台
    this._platforms = this._platforms.filter(p => p.alive && p.y < bottomBound);

    // 清理出界道具
    this._powerUps = this._powerUps.filter(pu => pu.alive && pu.y < bottomBound);

    // 清理出界飞镖
    this._darts = this._darts.filter(d => d.alive);

    // 清理出界敌人
    this._enemies = this._enemies.filter(e => {
      if (!e.alive) return false;
      if (e.type === 'rock' && e.y > bottomBound) return false;
      if (e.y > bottomBound || e.y < this._cameraY - 200) return false;
      return true;
    });
  }
}
