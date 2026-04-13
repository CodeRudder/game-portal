import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_SPEED,
  PLAYER_JUMP_VELOCITY, PLAYER_GRAVITY, PLAYER_CLIMB_SPEED,
  PLAYER_COLOR, INITIAL_LIVES,
  DK_WIDTH, DK_HEIGHT, DK_COLOR,
  DK_THROW_INTERVAL_BASE, DK_THROW_INTERVAL_PER_LEVEL,
  DK_THROW_INTERVAL_MIN,
  BARREL_RADIUS, BARREL_SPEED_BASE, BARREL_SPEED_PER_LEVEL,
  BARREL_COLOR, BARREL_FALL_SPEED, BARREL_LADDER_CHANCE, BARREL_SCORE,
  PLATFORM_HEIGHT, PLATFORM_COLOR,
  LADDER_WIDTH, LADDER_COLOR,
  HOSTAGE_WIDTH, HOSTAGE_HEIGHT, HOSTAGE_COLOR,
  LEVEL_COMPLETE_SCORE,
  BG_COLOR, HUD_COLOR, SCORE_COLOR,
  DIR_LEFT, DIR_RIGHT,
  generateLevel,
  type Platform, type Ladder, type LevelLayout,
} from './constants';

// ========== 内部类型 ==========

/** 玩家状态 */
interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number; // DIR_LEFT 或 DIR_RIGHT
  isClimbing: boolean;
  isOnGround: boolean;
  isJumping: boolean;
}

/** 滚桶 */
interface Barrel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isFalling: boolean;
  active: boolean;
  onPlatformIndex: number;
}

/** 大金刚 */
interface DK {
  x: number;
  y: number;
  throwTimer: number;
  isThrowing: boolean;
  throwAnimTimer: number;
}

/** 人质 */
interface Hostage {
  x: number;
  y: number;
  rescued: boolean;
}

export class DonkeyKongEngine extends GameEngine {
  // ========== 游戏状态 ==========

  private _player: Player = this.createDefaultPlayer();
  private _lives: number = INITIAL_LIVES;

  // 关卡布局
  private _platforms: Platform[] = [];
  private _ladders: Ladder[] = [];
  private _levelLayout: LevelLayout | null = null;

  // 大金刚
  private _dk: DK = { x: 0, y: 0, throwTimer: 0, isThrowing: false, throwAnimTimer: 0 };

  // 人质
  private _hostage: Hostage = { x: 0, y: 0, rescued: false };

  // 滚桶
  private _barrels: Barrel[] = [];

  // 输入
  private _keys: Set<string> = new Set();
  private _jumpPressed: boolean = false;
  private _jumpWasReleased: boolean = true;

  // 关卡速度
  private _barrelSpeed: number = BARREL_SPEED_BASE;
  private _dkThrowInterval: number = DK_THROW_INTERVAL_BASE;

  private _levelJustCompleted: boolean = false;

  // ========== Public Getters ==========

  get playerX(): number { return this._player.x; }
  get playerY(): number { return this._player.y; }
  get playerVY(): number { return this._player.vy; }
  get playerIsClimbing(): boolean { return this._player.isClimbing; }
  get playerIsOnGround(): boolean { return this._player.isOnGround; }
  get playerIsJumping(): boolean { return this._player.isJumping; }
  get playerFacing(): number { return this._player.facing; }
  get lives(): number { return this._lives; }
  get platforms(): Platform[] { return this._platforms; }
  get ladders(): Ladder[] { return this._ladders; }
  get barrels(): Barrel[] { return this._barrels; }
  get dkX(): number { return this._dk.x; }
  get dkY(): number { return this._dk.y; }
  get dkIsThrowing(): boolean { return this._dk.isThrowing; }
  get hostageX(): number { return this._hostage.x; }
  get hostageY(): number { return this._hostage.y; }
  get hostageRescued(): boolean { return this._hostage.rescued || this._levelJustCompleted; }

  // ========== 辅助方法 ==========

  private createDefaultPlayer(): Player {
    return {
      x: (CANVAS_WIDTH - PLAYER_WIDTH) / 2,
      y: 590 - PLAYER_HEIGHT,
      vx: 0,
      vy: 0,
      facing: DIR_RIGHT,
      isClimbing: false,
      isOnGround: true,
      isJumping: false,
    };
  }

  private loadLevel(level: number): void {
    this._levelLayout = generateLevel(level);
    this._platforms = this._levelLayout.platforms;
    this._ladders = this._levelLayout.ladders;

    // 大金刚
    this._dk = {
      x: this._levelLayout.dkX,
      y: this._levelLayout.dkY,
      throwTimer: 0,
      isThrowing: false,
      throwAnimTimer: 0,
    };

    // 人质
    this._hostage = {
      x: this._levelLayout.hostageX,
      y: this._levelLayout.hostageY,
      rescued: false,
    };

    // 玩家位置
    this._player.x = this._levelLayout.playerStartX;
    this._player.y = this._levelLayout.playerStartY;
    this._player.vx = 0;
    this._player.vy = 0;
    this._player.isClimbing = false;
    this._player.isOnGround = true;
    this._player.isJumping = false;
    this._player.facing = DIR_RIGHT;

    // 清空滚桶
    this._barrels = [];

    // 速度随关卡递增
    this._barrelSpeed = BARREL_SPEED_BASE + (level - 1) * BARREL_SPEED_PER_LEVEL;
    this._dkThrowInterval = Math.max(
      DK_THROW_INTERVAL_MIN,
      DK_THROW_INTERVAL_BASE + (level - 1) * DK_THROW_INTERVAL_PER_LEVEL
    );
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this._player = this.createDefaultPlayer();
    this._lives = INITIAL_LIVES;
    this._keys.clear();
    this._jumpPressed = false;
    this._jumpWasReleased = true;
    this._barrels = [];
    this._platforms = [];
    this._ladders = [];
    this._levelLayout = null;
    this._dk = { x: 0, y: 0, throwTimer: 0, isThrowing: false, throwAnimTimer: 0 };
    this._hostage = { x: 0, y: 0, rescued: false };
    this._barrelSpeed = BARREL_SPEED_BASE;
    this._dkThrowInterval = DK_THROW_INTERVAL_BASE;
    this._levelJustCompleted = false;
  }

  protected onStart(): void {
    this.onInit();
    this.loadLevel(this._level);
  }

  protected update(deltaTime: number): void {
    const dt = deltaTime / 1000;

    // 重置关卡完成标志
    this._levelJustCompleted = false;

    // 1. 玩家输入与移动
    this.updatePlayer(dt);

    // 2. 大金刚投掷
    this.updateDK(deltaTime);

    // 3. 滚桶移动
    this.updateBarrels(dt);

    // 4. 碰撞检测
    this.checkBarrelPlayerCollision();
    this.checkHostageRescue();

    // 5. 清理
    this.cleanup();

    // 6. 检查过关
    this.checkLevelComplete();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 平台
    ctx.fillStyle = PLATFORM_COLOR;
    for (const plat of this._platforms) {
      ctx.fillRect(plat.x, plat.y, plat.width, PLATFORM_HEIGHT);
    }

    // 梯子
    ctx.strokeStyle = LADDER_COLOR;
    ctx.lineWidth = 3;
    for (const lad of this._ladders) {
      // 左边竖线
      ctx.beginPath();
      ctx.moveTo(lad.x, lad.topY);
      ctx.lineTo(lad.x, lad.bottomY);
      ctx.stroke();
      // 右边竖线
      ctx.beginPath();
      ctx.moveTo(lad.x + LADDER_WIDTH, lad.topY);
      ctx.lineTo(lad.x + LADDER_WIDTH, lad.bottomY);
      ctx.stroke();
      // 横档
      const rungSpacing = 20;
      const numRungs = Math.floor((lad.bottomY - lad.topY) / rungSpacing);
      for (let i = 0; i <= numRungs; i++) {
        const ry = lad.topY + i * rungSpacing;
        if (ry <= lad.bottomY) {
          ctx.beginPath();
          ctx.moveTo(lad.x, ry);
          ctx.lineTo(lad.x + LADDER_WIDTH, ry);
          ctx.stroke();
        }
      }
    }

    // 大金刚
    ctx.fillStyle = DK_COLOR;
    ctx.fillRect(this._dk.x, this._dk.y, DK_WIDTH, DK_HEIGHT);
    // 简单面部
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this._dk.x + 15, this._dk.y + 10, 8, 8);
    ctx.fillRect(this._dk.x + 40, this._dk.y + 10, 8, 8);

    // 人质
    if (!this._hostage.rescued) {
      ctx.fillStyle = HOSTAGE_COLOR;
      ctx.fillRect(this._hostage.x, this._hostage.y, HOSTAGE_WIDTH, HOSTAGE_HEIGHT);
      // HELP text
      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HELP', this._hostage.x + HOSTAGE_WIDTH / 2, this._hostage.y - 4);
      ctx.textAlign = 'left';
    }

    // 滚桶
    ctx.fillStyle = BARREL_COLOR;
    for (const barrel of this._barrels) {
      if (!barrel.active) continue;
      ctx.beginPath();
      ctx.arc(barrel.x, barrel.y, BARREL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      // 滚桶条纹
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(barrel.x - BARREL_RADIUS * 0.6, barrel.y - BARREL_RADIUS * 0.6);
      ctx.lineTo(barrel.x + BARREL_RADIUS * 0.6, barrel.y + BARREL_RADIUS * 0.6);
      ctx.stroke();
    }

    // 玩家
    ctx.fillStyle = PLAYER_COLOR;
    ctx.fillRect(this._player.x, this._player.y, PLAYER_WIDTH, PLAYER_HEIGHT);
    // 简单帽子
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(this._player.x + 4, this._player.y, PLAYER_WIDTH - 8, 6);

    // HUD
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 8, 20);
    ctx.fillStyle = HUD_COLOR;
    ctx.fillText(`Level: ${this._level}`, 180, 20);
    ctx.fillText(`Lives: ${this._lives}`, 360, 20);

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
      ctx.fillText(`Score: ${this._score}  Level: ${this._level}`, w / 2, h / 2 + 20);
      ctx.font = '14px monospace';
      ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 50);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {
    this._barrels = [];
  }

  handleKeyDown(key: string): void {
    this._keys.add(key);
    if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
      this._jumpPressed = true;
    }
    if (key === ' ') {
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
    if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') {
      this._jumpPressed = false;
      this._jumpWasReleased = true;
    }
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      lives: this._lives,
      playerX: this._player.x,
      playerY: this._player.y,
      playerIsClimbing: this._player.isClimbing,
      playerIsOnGround: this._player.isOnGround,
      barrelCount: this._barrels.filter(b => b.active).length,
      hostageRescued: this._hostage.rescued,
      dkX: this._dk.x,
      dkY: this._dk.y,
    };
  }

  // ========== 玩家逻辑 ==========

  private updatePlayer(dt: number): void {
    const p = this._player;

    // 攀爬状态
    if (p.isClimbing) {
      this.updatePlayerClimbing(dt);
      return;
    }

    // 水平移动
    p.vx = 0;
    if (this._keys.has('ArrowLeft') || this._keys.has('a') || this._keys.has('A')) {
      p.vx = -PLAYER_SPEED;
      p.facing = DIR_LEFT;
    }
    if (this._keys.has('ArrowRight') || this._keys.has('d') || this._keys.has('D')) {
      p.vx = PLAYER_SPEED;
      p.facing = DIR_RIGHT;
    }

    // 跳跃（需要先释放跳跃键才能再次跳跃）
    if (this._jumpPressed && this._jumpWasReleased && p.isOnGround && !p.isJumping) {
      p.vy = PLAYER_JUMP_VELOCITY;
      p.isOnGround = false;
      p.isJumping = true;
      this._jumpWasReleased = false;
    }

    // 重力
    if (!p.isOnGround) {
      p.vy += PLAYER_GRAVITY * dt;
    }

    // 保存移动前的位置（用于碰撞检测）
    const prevY = p.y;

    // 应用速度
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // 边界限制
    p.x = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_WIDTH, p.x));

    // 平台碰撞（着陆检测）
    this.checkPlatformCollision(prevY);

    // 梯子检测（进入攀爬）
    if (this._keys.has('ArrowUp') || this._keys.has('w') || this._keys.has('W')) {
      this.tryStartClimbing(DIR_LEFT); // direction doesn't matter for up
    } else if (this._keys.has('ArrowDown') || this._keys.has('s') || this._keys.has('S')) {
      this.tryStartClimbingFromBelow();
    }
  }

  private updatePlayerClimbing(dt: number): void {
    const p = this._player;
    p.vx = 0;
    p.vy = 0;

    if (this._keys.has('ArrowUp') || this._keys.has('w') || this._keys.has('W')) {
      p.y -= PLAYER_CLIMB_SPEED * dt;
    }
    if (this._keys.has('ArrowDown') || this._keys.has('s') || this._keys.has('S')) {
      p.y += PLAYER_CLIMB_SPEED * dt;
    }

    // 水平移动（攀爬时仍可微调）
    if (this._keys.has('ArrowLeft') || this._keys.has('a') || this._keys.has('A')) {
      p.x -= PLAYER_SPEED * 0.3 * dt;
      p.facing = DIR_LEFT;
    }
    if (this._keys.has('ArrowRight') || this._keys.has('d') || this._keys.has('D')) {
      p.x += PLAYER_SPEED * 0.3 * dt;
      p.facing = DIR_RIGHT;
    }

    // 边界限制
    p.x = Math.max(0, Math.min(CANVAS_WIDTH - PLAYER_WIDTH, p.x));

    // 检查是否还在梯子上
    if (!this.isOnLadder(p.x + PLAYER_WIDTH / 2, p.y + PLAYER_HEIGHT / 2)) {
      p.isClimbing = false;
      p.isOnGround = false;
      p.vy = 0;
    }

    // 检查是否到达平台
    this.checkPlatformCollisionWhileClimbing();

    // 跳跃脱离梯子
    if (this._jumpPressed && (this._keys.has('ArrowLeft') || this._keys.has('ArrowRight') || this._keys.has('a') || this._keys.has('d') || this._keys.has('A') || this._keys.has('D'))) {
      p.isClimbing = false;
      p.isOnGround = false;
      p.vy = PLAYER_JUMP_VELOCITY * 0.6;
      p.isJumping = true;
    }
  }

  private tryStartClimbing(_direction: number): void {
    if (this._player.isClimbing) return;
    const centerX = this._player.x + PLAYER_WIDTH / 2;
    const centerY = this._player.y + PLAYER_HEIGHT / 2;

    for (const lad of this._ladders) {
      if (centerX >= lad.x - 5 && centerX <= lad.x + LADDER_WIDTH + 5 &&
          centerY >= lad.topY - 10 && centerY <= lad.bottomY + 10) {
        this._player.isClimbing = true;
        this._player.isOnGround = false;
        this._player.isJumping = false;
        this._player.vy = 0;
        // 对齐到梯子中心
        this._player.x = lad.x + (LADDER_WIDTH - PLAYER_WIDTH) / 2;
        return;
      }
    }
  }

  private tryStartClimbingFromBelow(): void {
    if (this._player.isClimbing) return;
    const centerX = this._player.x + PLAYER_WIDTH / 2;
    const feetY = this._player.y + PLAYER_HEIGHT;

    for (const lad of this._ladders) {
      if (centerX >= lad.x - 5 && centerX <= lad.x + LADDER_WIDTH + 5 &&
          feetY >= lad.topY - 15 && feetY <= lad.bottomY + 5) {
        this._player.isClimbing = true;
        this._player.isOnGround = false;
        this._player.isJumping = false;
        this._player.vy = 0;
        this._player.x = lad.x + (LADDER_WIDTH - PLAYER_WIDTH) / 2;
        return;
      }
    }
  }

  private isOnLadder(cx: number, cy: number): boolean {
    for (const lad of this._ladders) {
      if (cx >= lad.x - 5 && cx <= lad.x + LADDER_WIDTH + 5 &&
          cy >= lad.topY - 5 && cy <= lad.bottomY + 5) {
        return true;
      }
    }
    return false;
  }

  private checkPlatformCollision(prevY: number): void {
    const p = this._player;
    const prevBottom = prevY + PLAYER_HEIGHT;
    const currBottom = p.y + PLAYER_HEIGHT;

    // 画布底部边界保护
    if (currBottom >= CANVAS_HEIGHT) {
      p.y = CANVAS_HEIGHT - PLAYER_HEIGHT;
      p.vy = 0;
      p.isOnGround = true;
      p.isJumping = false;
      return;
    }

    for (const plat of this._platforms) {
      // 只有下落时才检测着陆
      if (p.vy >= 0) {
        // 扫描检测：检查本帧移动是否穿过了平台
        const crossedPlatform = prevBottom <= plat.y + 4 && currBottom >= plat.y;
        // 或者已经穿过平台很远（高速情况）
        const deepInPlatform = currBottom >= plat.y && currBottom <= plat.y + PLATFORM_HEIGHT + 20;

        if ((crossedPlatform || deepInPlatform) &&
            p.x + PLAYER_WIDTH > plat.x &&
            p.x < plat.x + plat.width) {
          p.y = plat.y - PLAYER_HEIGHT;
          p.vy = 0;
          p.isOnGround = true;
          p.isJumping = false;
          return;
        }
      }
    }

    // 没有站在任何平台上
    p.isOnGround = false;
  }

  private checkPlatformCollisionWhileClimbing(): void {
    const p = this._player;
    const feetY = p.y + PLAYER_HEIGHT;

    for (const plat of this._platforms) {
      if (feetY >= plat.y && feetY <= plat.y + PLATFORM_HEIGHT + 5 &&
          p.x + PLAYER_WIDTH > plat.x &&
          p.x < plat.x + plat.width) {
        // 到达平台，着陆
        p.y = plat.y - PLAYER_HEIGHT;
        p.isClimbing = false;
        p.isOnGround = true;
        p.isJumping = false;
        p.vy = 0;
        return;
      }
    }
  }

  // ========== 大金刚逻辑 ==========

  private updateDK(deltaTime: number): void {
    this._dk.throwTimer += deltaTime;

    // 投掷动画计时
    if (this._dk.isThrowing) {
      this._dk.throwAnimTimer += deltaTime;
      if (this._dk.throwAnimTimer >= 300) {
        this._dk.isThrowing = false;
        this._dk.throwAnimTimer = 0;
      }
    }

    // 投掷滚桶
    if (this._dk.throwTimer >= this._dkThrowInterval) {
      this._dk.throwTimer = 0;
      this.throwBarrel();
    }
  }

  private throwBarrel(): void {
    this._dk.isThrowing = true;
    this._dk.throwAnimTimer = 0;

    // 找到 DK 站立的平台下方的第一个平台
    const dkPlatformY = this._dk.y + DK_HEIGHT;
    let targetPlatformIndex = -1;
    for (let i = 0; i < this._platforms.length; i++) {
      if (Math.abs(this._platforms[i].y - dkPlatformY) < 15) {
        // 找到 DK 所在的平台的下一个
        // 继续找下面的平台
        for (let j = i + 1; j < this._platforms.length; j++) {
          targetPlatformIndex = j;
          break;
        }
        break;
      }
    }

    // 如果找不到下方平台，放在 DK 下方
    if (targetPlatformIndex < 0) {
      // 直接放在 DK 下方的平台上
      for (let i = 0; i < this._platforms.length; i++) {
        if (this._platforms[i].y > dkPlatformY) {
          targetPlatformIndex = i;
          break;
        }
      }
    }

    const barrel: Barrel = {
      x: this._dk.x + DK_WIDTH / 2,
      y: this._dk.y + DK_HEIGHT + BARREL_RADIUS,
      vx: this._barrelSpeed * (this._level % 2 === 0 ? DIR_RIGHT : DIR_RIGHT),
      vy: 0,
      isFalling: true,
      active: true,
      onPlatformIndex: targetPlatformIndex >= 0 ? targetPlatformIndex : 0,
    };

    this._barrels.push(barrel);
  }

  // ========== 滚桶逻辑 ==========

  private updateBarrels(dt: number): void {
    for (const barrel of this._barrels) {
      if (!barrel.active) continue;

      if (barrel.isFalling) {
        // 下落
        barrel.vy += PLAYER_GRAVITY * dt;
        barrel.y += barrel.vy * dt;

        // 检查是否落到平台上
        for (let i = 0; i < this._platforms.length; i++) {
          const plat = this._platforms[i];
          if (barrel.y + BARREL_RADIUS >= plat.y &&
              barrel.y + BARREL_RADIUS <= plat.y + PLATFORM_HEIGHT + barrel.vy * dt + 5 &&
              barrel.x >= plat.x &&
              barrel.x <= plat.x + plat.width) {
            barrel.y = plat.y - BARREL_RADIUS;
            barrel.vy = 0;
            barrel.isFalling = false;
            barrel.onPlatformIndex = i;
            // 根据平台倾斜方向决定滚动方向
            barrel.vx = this.getBarrelDirectionOnPlatform(i) * this._barrelSpeed;
            break;
          }
        }
      } else {
        // 在平台上滚动
        barrel.x += barrel.vx * dt;

        // 检查是否到达平台边缘
        const plat = this._platforms[barrel.onPlatformIndex];
        if (plat) {
          if (barrel.x - BARREL_RADIUS < plat.x || barrel.x + BARREL_RADIUS > plat.x + plat.width) {
            // 掉落到下方
            barrel.isFalling = true;
            barrel.vy = 0;
            // 寻找下方的平台
            this.findPlatformBelow(barrel);
          }
        }

        // 检查是否遇到梯子（可能下落）
        if (!barrel.isFalling && Math.random() < BARREL_LADDER_CHANCE * dt * 2) {
          this.checkBarrelLadder(barrel);
        }
      }

      // 出界检测（所有滚桶）
      if (barrel.y > CANVAS_HEIGHT + BARREL_RADIUS * 2 ||
          barrel.x < -BARREL_RADIUS * 3 ||
          barrel.x > CANVAS_WIDTH + BARREL_RADIUS * 3) {
        barrel.active = false;
      }
    }
  }

  private getBarrelDirectionOnPlatform(platformIndex: number): number {
    // 交替方向：偶数索引向右，奇数索引向左
    return platformIndex % 2 === 0 ? DIR_RIGHT : DIR_LEFT;
  }

  private findPlatformBelow(barrel: Barrel): void {
    for (let i = barrel.onPlatformIndex + 1; i < this._platforms.length; i++) {
      const plat = this._platforms[i];
      if (plat.y > this._platforms[barrel.onPlatformIndex]?.y) {
        barrel.onPlatformIndex = i;
        return;
      }
    }
    // 没有下方平台，标记为出界
    barrel.active = false;
  }

  private checkBarrelLadder(barrel: Barrel): void {
    for (const lad of this._ladders) {
      if (barrel.x >= lad.x - BARREL_RADIUS &&
          barrel.x <= lad.x + LADDER_WIDTH + BARREL_RADIUS) {
        // 滚桶在梯子附近，随机决定是否下落
        if (Math.random() < BARREL_LADDER_CHANCE) {
          barrel.isFalling = true;
          barrel.vy = 0;
          return;
        }
      }
    }
  }

  // ========== 碰撞检测 ==========

  private checkBarrelPlayerCollision(): void {
    const p = this._player;
    const px = p.x + PLAYER_WIDTH / 2;
    const py = p.y + PLAYER_HEIGHT / 2;

    for (const barrel of this._barrels) {
      if (!barrel.active) continue;

      const dx = px - barrel.x;
      const dy = py - barrel.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const collisionDist = BARREL_RADIUS + Math.min(PLAYER_WIDTH, PLAYER_HEIGHT) / 2;

      if (dist < collisionDist) {
        // 碰撞！检查玩家是否在滚桶上方（跳过得分）
        const playerBottom = p.y + PLAYER_HEIGHT;
        const barrelTop = barrel.y - BARREL_RADIUS;
        if (playerBottom <= barrel.y && p.vy >= 0) {
          // 跳过滚桶，得分
          this.addScore(BARREL_SCORE);
          barrel.active = false;
        } else {
          // 被碰到
          this.playerHit();
          return;
        }
      }
    }
  }

  private checkHostageRescue(): void {
    if (this._hostage.rescued) return;
    const p = this._player;
    const hx = this._hostage.x;
    const hy = this._hostage.y;

    if (p.x + PLAYER_WIDTH > hx &&
        p.x < hx + HOSTAGE_WIDTH &&
        p.y + PLAYER_HEIGHT > hy &&
        p.y < hy + HOSTAGE_HEIGHT) {
      this._hostage.rescued = true;
      this.addScore(LEVEL_COMPLETE_SCORE);
    }
  }

  private playerHit(): void {
    this._lives--;
    this.emit('loseLife', this._lives);
    if (this._lives <= 0) {
      this.gameOver();
    } else {
      // 重置玩家位置到起始点
      this.resetPlayerPosition();
      // 清空滚桶
      this._barrels = [];
    }
  }

  private resetPlayerPosition(): void {
    if (this._levelLayout) {
      this._player.x = this._levelLayout.playerStartX;
      this._player.y = this._levelLayout.playerStartY;
    } else {
      this._player.x = (CANVAS_WIDTH - PLAYER_WIDTH) / 2;
      this._player.y = 590 - PLAYER_HEIGHT;
    }
    this._player.vx = 0;
    this._player.vy = 0;
    this._player.isClimbing = false;
    this._player.isOnGround = true;
    this._player.isJumping = false;
  }

  // ========== 清理 ==========

  private cleanup(): void {
    this._barrels = this._barrels.filter(b => b.active);
  }

  // ========== 关卡检查 ==========

  private checkLevelComplete(): void {
    if (this._hostage.rescued) {
      this._levelJustCompleted = true;
      this.nextLevel();
    }
  }

  private nextLevel(): void {
    const nextLevelNum = this._level + 1;
    this.setLevel(nextLevelNum);
    this.loadLevel(nextLevelNum);
    // _levelJustCompleted 保持 true 直到下一帧的 update 开始时重置
    this.emit('levelComplete', nextLevelNum);
  }
}
