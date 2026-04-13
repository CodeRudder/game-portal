import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_SPEED, PLAYER_Y, PLAYER_START_X, PLAYER_COLOR, PLAYER_LIVES,
  BULLET_WIDTH, BULLET_HEIGHT, BULLET_SPEED, BULLET_COLOR, MAX_BULLETS, SHOOT_COOLDOWN,
  ENEMY_WIDTH, ENEMY_HEIGHT, ENEMY_HIT_SCORE, ENEMY_BOSS_HIT_SCORE,
  FORMATION_COLS, FORMATION_ROWS, FORMATION_SPACING_X, FORMATION_SPACING_Y,
  FORMATION_OFFSET_X, FORMATION_OFFSET_Y,
  FORMATION_SWAY_AMPLITUDE, FORMATION_SWAY_SPEED,
  DIVE_SPEED, DIVE_SPEED_PER_LEVEL, DIVE_CHANCE, DIVE_CHANCE_PER_LEVEL,
  DIVE_CURVE_AMPLITUDE, DIVE_CURVE_FREQUENCY, DIVE_RETURN_SPEED,
  CAPTURE_ENEMY_ROW, CAPTURE_DIVE_SPEED, CAPTURE_TRACTOR_BEAM_WIDTH, CAPTURE_TRACTOR_BEAM_HEIGHT, CAPTURE_DURATION,
  RESCUE_HIT_SCORE, DUAL_SHIP_OFFSET_Y,
  INITIAL_ENEMY_COUNT, WAVE_BONUS, WAVE_TRANSITION_DELAY,
  EXPLOSION_DURATION, EXPLOSION_RADIUS,
  BG_COLOR, HUD_COLOR, ENEMY_COLOR, ENEMY_BOSS_COLOR, EXPLOSION_COLOR, TRACTOR_BEAM_COLOR,
  RESPAWN_DELAY, RESPAWN_INVINCIBLE_DURATION,
  ENEMY_TYPE_BASIC, ENEMY_TYPE_BOSS, ENEMY_TYPE_CAPTURE,
  ENEMY_STATE_FORMATION, ENEMY_STATE_DIVE, ENEMY_STATE_RETURN, ENEMY_STATE_CAPTURE, ENEMY_STATE_DEAD,
} from './constants';

// ============================================================
// 类型定义
// ============================================================

interface Bullet {
  x: number;
  y: number;
  active: boolean;
}

interface Enemy {
  id: number;
  type: string; // ENEMY_TYPE_BASIC | ENEMY_TYPE_BOSS | ENEMY_TYPE_CAPTURE
  state: string; // ENEMY_STATE_*
  // 编队中的基准位置（无 sway）
  baseX: number;
  baseY: number;
  // 当前实际位置
  x: number;
  y: number;
  // 俯冲参数
  diveStartX: number;
  diveStartY: number;
  diveProgress: number; // 0→1 俯冲进度
  diveCurveDir: number; // 俯冲曲线方向 1 或 -1
  // 捕获参数
  captureTimer: number;
  hasCapturedPlayer: boolean;
  // 是否携带被捕获的玩家（用于双机）
  carryingCaptured: boolean;
}

interface Explosion {
  x: number;
  y: number;
  timer: number;
}

// ============================================================
// GalagaEngine
// ============================================================

export class GalagaEngine extends GameEngine {
  // 玩家
  private _playerX: number = PLAYER_START_X;
  private _playerAlive: boolean = true;
  private _lives: number = PLAYER_LIVES;
  private _invincible: boolean = false;
  private _invincibleTimer: number = 0;
  private _respawnTimer: number = 0;
  private _hasDualShip: boolean = false;
  private _isCaptured: boolean = false; // 玩家被捕获中

  // 子弹
  private _bullets: Bullet[] = [];
  private _lastShootTime: number = -Infinity;

  // 敌机
  private _enemies: Enemy[] = [];
  private _nextEnemyId: number = 0;

  // 编队摆动
  private _swayPhase: number = 0;

  // 爆炸
  private _explosions: Explosion[] = [];

  // 波次
  private _wave: number = 1;
  private _waveTransition: boolean = false;
  private _waveTransitionTimer: number = 0;

  // 输入
  private _leftPressed: boolean = false;
  private _rightPressed: boolean = false;
  private _firePressed: boolean = false;

  // 时间
  private _gameTime: number = 0;

  // ========== Public Getters ==========

  get playerX(): number { return this._playerX; }
  get playerY(): number { return PLAYER_Y; }
  get playerAlive(): boolean { return this._playerAlive; }
  get lives(): number { return this._lives; }
  get invincible(): boolean { return this._invincible; }
  get hasDualShip(): boolean { return this._hasDualShip; }
  get isCaptured(): boolean { return this._isCaptured; }
  get bullets(): Bullet[] { return this._bullets; }
  get enemies(): Enemy[] { return this._enemies; }
  get explosions(): Explosion[] { return this._explosions; }
  get wave(): number { return this._wave; }
  get waveTransition(): boolean { return this._waveTransition; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this.resetAllState();
  }

  protected onStart(): void {
    this.resetAllState();
    this.spawnFormation();
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000; // 转秒
    this._gameTime += deltaTime;

    // 波次过渡
    if (this._waveTransition) {
      this._waveTransitionTimer -= deltaTime;
      if (this._waveTransitionTimer <= 0) {
        this._waveTransition = false;
        this._wave++;
        this.setLevel(this._wave);
        this.spawnFormation();
      }
      return;
    }

    // 玩家复活倒计时
    if (!this._playerAlive) {
      this._respawnTimer -= deltaTime;
      if (this._respawnTimer <= 0) {
        this.respawnPlayer();
      }
      // 即使玩家死亡，敌机和子弹仍要更新
    }

    // 无敌倒计时
    if (this._invincible) {
      this._invincibleTimer -= deltaTime;
      if (this._invincibleTimer <= 0) {
        this._invincible = false;
      }
    }

    // 编队摆动
    this._swayPhase += FORMATION_SWAY_SPEED * dt;

    // 玩家移动
    this.movePlayer(dt);

    // 更新子弹
    this.updateBullets(dt);

    // 更新敌机
    this.updateEnemies(dt);

    // 碰撞检测
    this.checkBulletEnemyCollisions();
    this.checkEnemyPlayerCollisions();

    // 更新爆炸
    this.updateExplosions(deltaTime);

    // 检查波次完成
    this.checkWaveComplete();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this.renderHUD(ctx, w);

    // 敌机
    this.renderEnemies(ctx);

    // 子弹
    this.renderBullets(ctx);

    // 玩家
    if (this._playerAlive) {
      this.renderPlayer(ctx);
    }

    // 爆炸
    this.renderExplosions(ctx);

    // 波次过渡提示
    if (this._waveTransition) {
      ctx.fillStyle = HUD_COLOR;
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`WAVE ${this._wave + 1}`, w / 2, h / 2);
      ctx.textAlign = 'left';
    }

    // 游戏结束
    if (this._status === 'gameover') {
      ctx.fillStyle = '#ef5350';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', w / 2, h / 2);
      ctx.font = '16px monospace';
      ctx.fillStyle = HUD_COLOR;
      ctx.fillText(`SCORE: ${this._score}`, w / 2, h / 2 + 40);
      ctx.fillText(`WAVE: ${this._wave}`, w / 2, h / 2 + 64);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this.resetAllState();
  }

  protected onGameOver(): void {
    // 保存最终状态
  }

  handleKeyDown(key: string): void {
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') this._leftPressed = true;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') this._rightPressed = true;
    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      } else if (this._status === 'playing') {
        this._firePressed = true;
        this.tryShoot();
      }
    }
  }

  handleKeyUp(key: string): void {
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') this._leftPressed = false;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') this._rightPressed = false;
    if (key === ' ' || key === 'Space') this._firePressed = false;
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      lives: this._lives,
      wave: this._wave,
      playerX: this._playerX,
      playerY: PLAYER_Y,
      playerAlive: this._playerAlive,
      hasDualShip: this._hasDualShip,
      isCaptured: this._isCaptured,
      invincible: this._invincible,
      bulletCount: this._bullets.filter(b => b.active).length,
      enemyCount: this._enemies.filter(e => e.state !== ENEMY_STATE_DEAD).length,
      waveTransition: this._waveTransition,
    };
  }

  // ========== 玩家相关 ==========

  private movePlayer(dt: number): void {
    if (!this._playerAlive) return;
    if (this._isCaptured) return;

    const speed = PLAYER_SPEED * dt;
    if (this._leftPressed) {
      this._playerX = Math.max(0, this._playerX - speed);
    }
    if (this._rightPressed) {
      this._playerX = Math.min(CANVAS_WIDTH - PLAYER_WIDTH, this._playerX + speed);
    }
  }

  private tryShoot(): void {
    if (!this._playerAlive) return;
    if (this._isCaptured) return;

    const now = this._gameTime;
    if (now - this._lastShootTime < SHOOT_COOLDOWN) return;

    const activeBullets = this._bullets.filter(b => b.active).length;
    const maxBullets = this._hasDualShip ? MAX_BULLETS * 2 : MAX_BULLETS;
    if (activeBullets >= maxBullets) return;

    // 主飞船子弹
    this._bullets.push({
      x: this._playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
      y: PLAYER_Y - BULLET_HEIGHT,
      active: true,
    });

    // 双机时额外发射
    if (this._hasDualShip) {
      this._bullets.push({
        x: this._playerX + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2,
        y: PLAYER_Y + DUAL_SHIP_OFFSET_Y - BULLET_HEIGHT,
        active: true,
      });
    }

    this._lastShootTime = now;
  }

  private respawnPlayer(): void {
    if (this._lives <= 0) return;
    this._playerAlive = true;
    this._playerX = PLAYER_START_X;
    this._invincible = true;
    this._invincibleTimer = RESPAWN_INVINCIBLE_DURATION;
    this._isCaptured = false;
  }

  private killPlayer(): void {
    if (this._invincible) return;
    if (!this._playerAlive) return;

    this._playerAlive = false;
    this._lives--;
    this._hasDualShip = false;
    this._isCaptured = false;

    // 爆炸效果
    this._explosions.push({
      x: this._playerX + PLAYER_WIDTH / 2,
      y: PLAYER_Y + PLAYER_HEIGHT / 2,
      timer: EXPLOSION_DURATION,
    });

    if (this._lives <= 0) {
      this.gameOver();
    } else {
      this._respawnTimer = RESPAWN_DELAY;
    }
  }

  // ========== 敌机相关 ==========

  private spawnFormation(): void {
    this._enemies = [];
    this._nextEnemyId = 0;

    for (let row = 0; row < FORMATION_ROWS; row++) {
      for (let col = 0; col < FORMATION_COLS; col++) {
        const baseX = FORMATION_OFFSET_X + col * FORMATION_SPACING_X;
        const baseY = FORMATION_OFFSET_Y + row * FORMATION_SPACING_Y;
        const type = row === CAPTURE_ENEMY_ROW ? ENEMY_TYPE_BOSS : ENEMY_TYPE_BASIC;

        this._enemies.push({
          id: this._nextEnemyId++,
          type,
          state: ENEMY_STATE_FORMATION,
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          diveStartX: 0,
          diveStartY: 0,
          diveProgress: 0,
          diveCurveDir: 1,
          captureTimer: 0,
          hasCapturedPlayer: false,
          carryingCaptured: false,
        });
      }
    }
  }

  private updateEnemies(dt: number): void {
    const sway = Math.sin(this._swayPhase) * FORMATION_SWAY_AMPLITUDE;
    const diveChance = DIVE_CHANCE + (this._wave - 1) * DIVE_CHANCE_PER_LEVEL;
    const diveSpeed = DIVE_SPEED + (this._wave - 1) * DIVE_SPEED_PER_LEVEL;

    for (const enemy of this._enemies) {
      if (enemy.state === ENEMY_STATE_DEAD) continue;

      if (enemy.state === ENEMY_STATE_FORMATION) {
        // 编队中：跟随摆动
        enemy.x = enemy.baseX + sway;
        enemy.y = enemy.baseY;

        // 随机决定是否俯冲
        if (Math.random() < diveChance && this._playerAlive) {
          this.startDive(enemy);
        }
      } else if (enemy.state === ENEMY_STATE_DIVE) {
        // 俯冲中
        this.updateDiveEnemy(enemy, dt, diveSpeed);
      } else if (enemy.state === ENEMY_STATE_RETURN) {
        // 返回编队
        this.updateReturnEnemy(enemy, dt);
      } else if (enemy.state === ENEMY_STATE_CAPTURE) {
        // 捕获中
        this.updateCaptureEnemy(enemy, dt);
      }
    }
  }

  private startDive(enemy: Enemy): void {
    enemy.state = ENEMY_STATE_DIVE;
    enemy.diveStartX = enemy.x;
    enemy.diveStartY = enemy.y;
    enemy.diveProgress = 0;
    enemy.diveCurveDir = Math.random() < 0.5 ? 1 : -1;

    // Boss 敌机有概率执行捕获
    if (enemy.type === ENEMY_TYPE_BOSS && !this._isCaptured && Math.random() < 0.3) {
      enemy.type = ENEMY_TYPE_CAPTURE;
      enemy.state = ENEMY_STATE_CAPTURE;
      enemy.captureTimer = 0;
      enemy.hasCapturedPlayer = false;
    }
  }

  private updateDiveEnemy(enemy: Enemy, dt: number, diveSpeed: number): void {
    enemy.diveProgress += dt * diveSpeed / CANVAS_HEIGHT;

    if (enemy.diveProgress >= 1) {
      // 俯冲完成，返回编队
      enemy.state = ENEMY_STATE_RETURN;
      return;
    }

    // 曲线俯冲路径
    const t = enemy.diveProgress;
    const startX = enemy.diveStartX;
    const startY = enemy.diveStartY;
    const targetY = CANVAS_HEIGHT + 40; // 飞出屏幕底部

    enemy.x = startX + Math.sin(t * DIVE_CURVE_FREQUENCY * Math.PI) * DIVE_CURVE_AMPLITUDE * enemy.diveCurveDir;
    enemy.y = startY + (targetY - startY) * t;
  }

  private updateReturnEnemy(enemy: Enemy, dt: number): void {
    const sway = Math.sin(this._swayPhase) * FORMATION_SWAY_AMPLITUDE;
    const targetX = enemy.baseX + sway;
    const targetY = enemy.baseY;

    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < DIVE_RETURN_SPEED) {
      enemy.x = targetX;
      enemy.y = targetY;
      enemy.state = ENEMY_STATE_FORMATION;
    } else {
      enemy.x += (dx / dist) * DIVE_RETURN_SPEED;
      enemy.y += (dy / dist) * DIVE_RETURN_SPEED;
    }
  }

  private updateCaptureEnemy(enemy: Enemy, dt: number): void {
    enemy.captureTimer += dt * 1000;

    if (!enemy.hasCapturedPlayer) {
      // 向玩家位置俯冲
      const targetX = this._playerX + PLAYER_WIDTH / 2;
      const targetY = PLAYER_Y - CAPTURE_TRACTOR_BEAM_HEIGHT;

      const dx = targetX - enemy.x;
      const dy = targetY - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > CAPTURE_DIVE_SPEED) {
        enemy.x += (dx / dist) * CAPTURE_DIVE_SPEED;
        enemy.y += (dy / dist) * CAPTURE_DIVE_SPEED;
      }

      // 检查是否到达拖曳光束范围
      if (Math.abs(enemy.x - (this._playerX + PLAYER_WIDTH / 2)) < CAPTURE_TRACTOR_BEAM_WIDTH / 2) {
        // 拖曳光束激活，尝试捕获
        if (this._playerAlive && !this._invincible && !this._isCaptured) {
          enemy.hasCapturedPlayer = true;
          this._isCaptured = true;
        }
      }
    } else {
      // 已捕获玩家，带着玩家返回编队
      const sway = Math.sin(this._swayPhase) * FORMATION_SWAY_AMPLITUDE;
      const targetX = enemy.baseX + sway;
      const targetY = enemy.baseY;

      const dx = targetX - enemy.x;
      const dy = targetY - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < DIVE_RETURN_SPEED) {
        enemy.x = targetX;
        enemy.y = targetY;
        enemy.state = ENEMY_STATE_FORMATION;
        enemy.carryingCaptured = true;
        // 玩家被带到编队中，算作死亡
        this._playerAlive = false;
        this._isCaptured = false;
        this._lives--;
        if (this._lives <= 0) {
          this.gameOver();
        } else {
          this._respawnTimer = RESPAWN_DELAY;
        }
      } else {
        enemy.x += (dx / dist) * DIVE_RETURN_SPEED;
        enemy.y += (dy / dist) * DIVE_RETURN_SPEED;
      }
    }

    // 捕获超时
    if (enemy.captureTimer > CAPTURE_DURATION && !enemy.hasCapturedPlayer) {
      enemy.state = ENEMY_STATE_RETURN;
    }
  }

  // ========== 子弹相关 ==========

  private updateBullets(dt: number): void {
    const speed = BULLET_SPEED * dt;
    for (const bullet of this._bullets) {
      if (!bullet.active) continue;
      bullet.y -= speed;
      if (bullet.y + BULLET_HEIGHT < 0) {
        bullet.active = false;
      }
    }
  }

  // ========== 碰撞检测 ==========

  private checkBulletEnemyCollisions(): void {
    for (const bullet of this._bullets) {
      if (!bullet.active) continue;

      for (const enemy of this._enemies) {
        if (enemy.state === ENEMY_STATE_DEAD) continue;

        if (this.rectOverlap(
          bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT,
          enemy.x, enemy.y, ENEMY_WIDTH, ENEMY_HEIGHT,
        )) {
          bullet.active = false;

          // 如果敌机正携带被捕获的玩家，救援成功
          if (enemy.carryingCaptured) {
            this._hasDualShip = true;
            enemy.carryingCaptured = false;
          }

          // 击杀敌机
          enemy.state = ENEMY_STATE_DEAD;

          // 计分
          const points = enemy.type === ENEMY_TYPE_BOSS || enemy.type === ENEMY_TYPE_CAPTURE
            ? ENEMY_BOSS_HIT_SCORE
            : ENEMY_HIT_SCORE;
          const bonus = enemy.carryingCaptured ? RESCUE_HIT_SCORE : 0;
          this.addScore(points + bonus);

          // 爆炸
          this._explosions.push({
            x: enemy.x + ENEMY_WIDTH / 2,
            y: enemy.y + ENEMY_HEIGHT / 2,
            timer: EXPLOSION_DURATION,
          });

          break; // 一颗子弹只能击中一个敌机
        }
      }
    }
  }

  private checkEnemyPlayerCollisions(): void {
    if (!this._playerAlive || this._invincible || this._isCaptured) return;

    for (const enemy of this._enemies) {
      if (enemy.state === ENEMY_STATE_DEAD) continue;
      if (enemy.state === ENEMY_STATE_FORMATION) continue; // 编队中的敌机不会碰撞玩家

      if (this.rectOverlap(
        this._playerX, PLAYER_Y, PLAYER_WIDTH, PLAYER_HEIGHT,
        enemy.x, enemy.y, ENEMY_WIDTH, ENEMY_HEIGHT,
      )) {
        this.killPlayer();
        break;
      }
    }
  }

  // ========== 波次系统 ==========

  private checkWaveComplete(): void {
    const aliveCount = this._enemies.filter(e => e.state !== ENEMY_STATE_DEAD).length;
    if (aliveCount === 0 && !this._waveTransition) {
      this._waveTransition = true;
      this._waveTransitionTimer = WAVE_TRANSITION_DELAY;
      this.addScore(WAVE_BONUS);
    }
  }

  // ========== 爆炸 ==========

  private updateExplosions(deltaTime: number): void {
    for (const exp of this._explosions) {
      exp.timer -= deltaTime;
    }
    this._explosions = this._explosions.filter(e => e.timer > 0);
  }

  // ========== 渲染辅助 ==========

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = HUD_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${this._score}`, 10, 26);
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${this._wave}`, w / 2, 26);
    ctx.textAlign = 'right';
    ctx.fillText(`LIVES: ${this._lives}`, w - 10, 26);
    ctx.textAlign = 'left';
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    // 无敌闪烁效果
    if (this._invincible && Math.floor(this._gameTime / 100) % 2 === 0) return;

    ctx.fillStyle = PLAYER_COLOR;
    // 简单三角形飞船
    const cx = this._playerX + PLAYER_WIDTH / 2;
    const top = PLAYER_Y;
    const bottom = PLAYER_Y + PLAYER_HEIGHT;
    const left = this._playerX;
    const right = this._playerX + PLAYER_WIDTH;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fill();

    // 双机渲染
    if (this._hasDualShip) {
      const dualY = PLAYER_Y + DUAL_SHIP_OFFSET_Y;
      ctx.fillStyle = '#81d4fa';
      ctx.beginPath();
      ctx.moveTo(cx, dualY);
      ctx.lineTo(right, dualY + PLAYER_HEIGHT);
      ctx.lineTo(left, dualY + PLAYER_HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = BULLET_COLOR;
    for (const bullet of this._bullets) {
      if (!bullet.active) continue;
      ctx.fillRect(bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT);
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    for (const enemy of this._enemies) {
      if (enemy.state === ENEMY_STATE_DEAD) continue;

      if (enemy.type === ENEMY_TYPE_BOSS || enemy.type === ENEMY_TYPE_CAPTURE) {
        ctx.fillStyle = ENEMY_BOSS_COLOR;
      } else {
        ctx.fillStyle = ENEMY_COLOR;
      }

      // 敌机用矩形表示
      ctx.fillRect(enemy.x, enemy.y, ENEMY_WIDTH, ENEMY_HEIGHT);

      // 捕获中的敌机绘制拖曳光束
      if (enemy.state === ENEMY_STATE_CAPTURE && !enemy.hasCapturedPlayer) {
        ctx.fillStyle = TRACTOR_BEAM_COLOR;
        const beamX = enemy.x + ENEMY_WIDTH / 2 - CAPTURE_TRACTOR_BEAM_WIDTH / 2;
        const beamY = enemy.y + ENEMY_HEIGHT;
        ctx.fillRect(beamX, beamY, CAPTURE_TRACTOR_BEAM_WIDTH, CAPTURE_TRACTOR_BEAM_HEIGHT);
      }

      // 携带被捕获玩家的敌机标记
      if (enemy.carryingCaptured) {
        ctx.fillStyle = PLAYER_COLOR;
        ctx.fillRect(enemy.x + 4, enemy.y + ENEMY_HEIGHT + 2, PLAYER_WIDTH * 0.6, PLAYER_HEIGHT * 0.6);
      }
    }
  }

  private renderExplosions(ctx: CanvasRenderingContext2D): void {
    for (const exp of this._explosions) {
      const progress = 1 - exp.timer / EXPLOSION_DURATION;
      const radius = EXPLOSION_RADIUS * progress;
      const alpha = 1 - progress;
      ctx.fillStyle = EXPLOSION_COLOR;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ========== 工具方法 ==========

  private rectOverlap(
    x1: number, y1: number, w1: number, h1: number,
    x2: number, y2: number, w2: number, h2: number,
  ): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  private resetAllState(): void {
    this._playerX = PLAYER_START_X;
    this._playerAlive = true;
    this._lives = PLAYER_LIVES;
    this._invincible = false;
    this._invincibleTimer = 0;
    this._respawnTimer = 0;
    this._hasDualShip = false;
    this._isCaptured = false;
    this._bullets = [];
    this._lastShootTime = -Infinity;
    this._enemies = [];
    this._nextEnemyId = 0;
    this._swayPhase = 0;
    this._explosions = [];
    this._wave = 1;
    this._waveTransition = false;
    this._waveTransitionTimer = 0;
    this._leftPressed = false;
    this._rightPressed = false;
    this._firePressed = false;
    this._gameTime = 0;
  }
}
