import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  LANDER_WIDTH, LANDER_HEIGHT, LANDER_START_X, LANDER_START_Y,
  GRAVITY, MAIN_THRUST, ROTATION_SPEED,
  MAX_SAFE_VY, MAX_SAFE_VX, MAX_SAFE_ANGLE,
  INITIAL_FUEL, FUEL_CONSUMPTION_THRUST, FUEL_CONSUMPTION_ROTATE, FUEL_BONUS_PER_LEVEL,
  TERRAIN_SEGMENTS, TERRAIN_MIN_Y, TERRAIN_MAX_Y,
  BASE_LANDING_ZONE_WIDTH, LANDING_ZONE_WIDTH_DECREASE, MIN_LANDING_ZONE_WIDTH,
  LANDING_ZONE_MARKER_HEIGHT, MAX_LEVELS,
  BG_COLOR, STAR_COLOR, LANDER_COLOR, LANDER_WINDOW_COLOR,
  THRUST_FLAME_COLOR, THRUST_FLAME_INNER_COLOR,
  TERRAIN_COLOR, TERRAIN_FILL_COLOR, LANDING_ZONE_COLOR,
  HUD_COLOR, FUEL_BAR_BG_COLOR, FUEL_BAR_COLOR, FUEL_BAR_LOW_COLOR,
  SUCCESS_COLOR, CRASH_COLOR,
  STAR_COUNT, HUD_MARGIN, HUD_FONT_SIZE,
  FUEL_BAR_WIDTH, FUEL_BAR_HEIGHT, FUEL_LOW_THRESHOLD,
} from './constants';

// ============================================================
// 类型定义
// ============================================================

/** 地形点 */
export interface TerrainPoint {
  x: number;
  y: number;
}

/** 着陆区 */
export interface LandingZone {
  leftX: number;
  rightX: number;
  y: number;
}

/** 星星 */
export interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
}

/** 着陆结果 */
export type LandingResult = 'success' | 'crash' | null;

// ============================================================
// LunarLanderEngine
// ============================================================

export class LunarLanderEngine extends GameEngine {
  // ---------- 登陆舱状态 ----------
  private _landerX: number = LANDER_START_X;
  private _landerY: number = LANDER_START_Y;
  private _landerVX: number = 0;
  private _landerVY: number = 0;
  private _landerAngle: number = 0;        // 度数，0 = 正直
  private _fuel: number = INITIAL_FUEL;
  private _isThrusting: boolean = false;
  private _isRotatingLeft: boolean = false;
  private _isRotatingRight: boolean = false;

  // ---------- 地形 ----------
  private _terrain: TerrainPoint[] = [];
  private _landingZone: LandingZone | null = null;

  // ---------- 星星 ----------
  private _stars: Star[] = [];

  // ---------- 游戏结果 ----------
  private _landingResult: LandingResult = null;
  private _landed: boolean = false;

  // ---------- 关卡完成计数 ----------
  private _completedLevels: number = 0;

  // ---------- 爆炸粒子 ----------
  private _explosionParticles: Array<{
    x: number; y: number;
    vx: number; vy: number;
    life: number;
  }> = [];

  // ========== Public Getters ==========

  get landerX(): number { return this._landerX; }
  get landerY(): number { return this._landerY; }
  get landerVX(): number { return this._landerVX; }
  get landerVY(): number { return this._landerVY; }
  get landerAngle(): number { return this._landerAngle; }
  get fuel(): number { return this._fuel; }
  get isThrusting(): boolean { return this._isThrusting; }
  get isRotatingLeft(): boolean { return this._isRotatingLeft; }
  get isRotatingRight(): boolean { return this._isRotatingRight; }
  get terrain(): TerrainPoint[] { return this._terrain; }
  get landingZone(): LandingZone | null { return this._landingZone; }
  get stars(): Star[] { return this._stars; }
  get landingResult(): LandingResult { return this._landingResult; }
  get landed(): boolean { return this._landed; }
  get completedLevels(): number { return this._completedLevels; }
  get explosionParticles(): Array<{
    x: number; y: number; vx: number; vy: number; life: number;
  }> { return this._explosionParticles; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this.generateStars();
    this.generateTerrain();
  }

  protected onStart(): void {
    this._landerX = LANDER_START_X;
    this._landerY = LANDER_START_Y;
    this._landerVX = 0;
    this._landerVY = 0;
    this._landerAngle = 0;
    this._fuel = INITIAL_FUEL + this._completedLevels * FUEL_BONUS_PER_LEVEL;
    this._isThrusting = false;
    this._isRotatingLeft = false;
    this._isRotatingRight = false;
    this._landingResult = null;
    this._landed = false;
    this._explosionParticles = [];
    this.generateTerrain();
  }

  protected update(deltaTime: number): void {
    // 已着陆则只更新爆炸粒子
    if (this._landed) {
      this.updateExplosionParticles();
      return;
    }

    // 1. 旋转
    this.applyRotation();

    // 2. 重力
    this._landerVY += GRAVITY;

    // 3. 主推力
    this.applyThrust();

    // 4. 更新位置
    this._landerX += this._landerVX;
    this._landerY += this._landerVY;

    // 5. 边界检测（水平环绕/限制）
    this.enforceBounds();

    // 6. 着陆/碰撞检测
    this.checkLanding();

    // 7. 更新爆炸粒子
    this.updateExplosionParticles();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 星星
    this.renderStars(ctx);

    // 地形
    this.renderTerrain(ctx, w, h);

    // 着陆区标记
    this.renderLandingZone(ctx);

    // 登陆舱
    this.renderLander(ctx);

    // 爆炸粒子
    this.renderExplosionParticles(ctx);

    // HUD
    this.renderHUD(ctx, w);

    // 结果提示
    this.renderResultMessage(ctx, w, h);
  }

  protected onReset(): void {
    this._landerX = LANDER_START_X;
    this._landerY = LANDER_START_Y;
    this._landerVX = 0;
    this._landerVY = 0;
    this._landerAngle = 0;
    this._fuel = INITIAL_FUEL;
    this._isThrusting = false;
    this._isRotatingLeft = false;
    this._isRotatingRight = false;
    this._landingResult = null;
    this._landed = false;
    this._completedLevels = 0;
    this._explosionParticles = [];
    this.generateTerrain();
  }

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      this._isThrusting = true;
    }
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      this._isRotatingLeft = true;
    }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      this._isRotatingRight = true;
    }
    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      }
    }
  }

  handleKeyUp(key: string): void {
    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
      this._isThrusting = false;
    }
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      this._isRotatingLeft = false;
    }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      this._isRotatingRight = false;
    }
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      landerX: this._landerX,
      landerY: this._landerY,
      landerVX: this._landerVX,
      landerVY: this._landerVY,
      landerAngle: this._landerAngle,
      fuel: this._fuel,
      isThrusting: this._isThrusting,
      isRotatingLeft: this._isRotatingLeft,
      isRotatingRight: this._isRotatingRight,
      landingResult: this._landingResult,
      landed: this._landed,
      completedLevels: this._completedLevels,
      terrain: this._terrain,
      landingZone: this._landingZone,
    };
  }

  // ========== 公共方法 ==========

  /** 获取当前关卡着陆区宽度 */
  getLandingZoneWidth(): number {
    return Math.max(
      MIN_LANDING_ZONE_WIDTH,
      BASE_LANDING_ZONE_WIDTH - (this._level - 1) * LANDING_ZONE_WIDTH_DECREASE
    );
  }

  /** 获取当前关卡初始燃料 */
  getInitialFuelForLevel(): number {
    return INITIAL_FUEL + this._completedLevels * FUEL_BONUS_PER_LEVEL;
  }

  /** 检查当前速度是否在安全范围内 */
  isSpeedSafe(): boolean {
    return (
      Math.abs(this._landerVY) <= MAX_SAFE_VY &&
      Math.abs(this._landerVX) <= MAX_SAFE_VX
    );
  }

  /** 检查当前角度是否在安全范围内 */
  isAngleSafe(): boolean {
    return Math.abs(this._landerAngle) <= MAX_SAFE_ANGLE;
  }

  /** 获取地形在指定 x 处的高度（线性插值） */
  getTerrainHeightAt(x: number): number {
    if (this._terrain.length < 2) return CANVAS_HEIGHT;

    // x 超出范围取边界值
    if (x <= this._terrain[0].x) return this._terrain[0].y;
    if (x >= this._terrain[this._terrain.length - 1].x) {
      return this._terrain[this._terrain.length - 1].y;
    }

    for (let i = 0; i < this._terrain.length - 1; i++) {
      const p1 = this._terrain[i];
      const p2 = this._terrain[i + 1];
      if (x >= p1.x && x <= p2.x) {
        const t = (x - p1.x) / (p2.x - p1.x);
        return p1.y + t * (p2.y - p1.y);
      }
    }
    return CANVAS_HEIGHT;
  }

  /** 进入下一关 */
  nextLevel(): void {
    if (this._landingResult !== 'success') return;
    if (this._level >= MAX_LEVELS) {
      // 通关
      this.gameOver();
      return;
    }
    this._completedLevels++;
    this.setLevel(this._level + 1);
    // 重新开始本关
    this._landerX = LANDER_START_X;
    this._landerY = LANDER_START_Y;
    this._landerVX = 0;
    this._landerVY = 0;
    this._landerAngle = 0;
    this._fuel = this.getInitialFuelForLevel();
    this._isThrusting = false;
    this._isRotatingLeft = false;
    this._isRotatingRight = false;
    this._landingResult = null;
    this._landed = false;
    this._explosionParticles = [];
    this.generateTerrain();
    this._status = 'playing';
    this.emit('statusChange', 'playing');
  }

  // ========== 私有方法 ==========

  /** 生成星星 */
  private generateStars(): void {
    this._stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      this._stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (TERRAIN_MIN_Y - 20),
        size: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.5 + 0.5,
      });
    }
  }

  /** 生成地形（含着陆区） */
  private generateTerrain(): void {
    this._terrain = [];
    const segWidth = CANVAS_WIDTH / TERRAIN_SEGMENTS;

    // 计算着陆区宽度
    const lzWidth = this.getLandingZoneWidth();

    // 随机选择着陆区起始段（留出首尾各2段）
    const minSeg = 3;
    const maxSeg = TERRAIN_SEGMENTS - 3 - Math.ceil(lzWidth / segWidth);
    const lzStartSeg = Math.floor(Math.random() * (maxSeg - minSeg + 1)) + minSeg;
    const lzEndSeg = lzStartSeg + Math.ceil(lzWidth / segWidth);
    const lzY = Math.random() * (TERRAIN_MAX_Y - TERRAIN_MIN_Y) + TERRAIN_MIN_Y;

    for (let i = 0; i <= TERRAIN_SEGMENTS; i++) {
      const x = i * segWidth;
      let y: number;

      if (i >= lzStartSeg && i <= lzEndSeg) {
        // 着陆区：平坦
        y = lzY;
      } else {
        y = Math.random() * (TERRAIN_MAX_Y - TERRAIN_MIN_Y) + TERRAIN_MIN_Y;
      }

      this._terrain.push({ x, y });
    }

    // 记录着陆区
    const leftX = lzStartSeg * segWidth;
    const rightX = lzEndSeg * segWidth;
    this._landingZone = { leftX, rightX, y: lzY };
  }

  /** 应用旋转 */
  private applyRotation(): void {
    if (this._isRotatingLeft && this._fuel > 0) {
      this._landerAngle -= ROTATION_SPEED;
      this._fuel -= FUEL_CONSUMPTION_ROTATE;
    }
    if (this._isRotatingRight && this._fuel > 0) {
      this._landerAngle += ROTATION_SPEED;
      this._fuel -= FUEL_CONSUMPTION_ROTATE;
    }
    // 限制燃料不低于 0
    if (this._fuel < 0) this._fuel = 0;
  }

  /** 应用主推力 */
  private applyThrust(): void {
    if (this._isThrusting && this._fuel > 0) {
      const angleRad = (this._landerAngle * Math.PI) / 180;
      this._landerVX -= MAIN_THRUST * Math.sin(angleRad);
      this._landerVY -= MAIN_THRUST * Math.cos(angleRad);
      this._fuel -= FUEL_CONSUMPTION_THRUST;
      if (this._fuel < 0) this._fuel = 0;
    }
  }

  /** 边界限制 */
  private enforceBounds(): void {
    // 水平方向：限制在画布内
    if (this._landerX < 0) {
      this._landerX = 0;
      this._landerVX = 0;
    }
    if (this._landerX > CANVAS_WIDTH) {
      this._landerX = CANVAS_WIDTH;
      this._landerVX = 0;
    }
    // 顶部限制
    if (this._landerY < 0) {
      this._landerY = 0;
      this._landerVY = 0;
    }
  }

  /** 着陆/碰撞检测 */
  private checkLanding(): void {
    const landerBottom = this._landerY + LANDER_HEIGHT / 2;
    const terrainY = this.getTerrainHeightAt(this._landerX);

    if (landerBottom >= terrainY) {
      this._landerY = terrainY - LANDER_HEIGHT / 2;
      this._landed = true;

      // 判断是否在着陆区内
      const inZone = this.isInLandingZone(this._landerX);

      if (inZone && this.isSpeedSafe() && this.isAngleSafe()) {
        // 成功着陆
        this._landingResult = 'success';
        const levelBonus = this._level * 100;
        const fuelBonus = Math.floor(this._fuel) * 10;
        this.addScore(levelBonus + fuelBonus);
        this.emit('landingSuccess', {
          level: this._level,
          fuel: this._fuel,
          score: this._score,
        });
      } else {
        // 坠毁
        this._landingResult = 'crash';
        this.spawnExplosion();
        this.emit('landingCrash', {
          vx: this._landerVX,
          vy: this._landerVY,
          angle: this._landerAngle,
          inZone,
        });
      }

      this._landerVX = 0;
      this._landerVY = 0;
      this.gameOver();
    }
  }

  /** 判断 x 是否在着陆区内 */
  private isInLandingZone(x: number): boolean {
    if (!this._landingZone) return false;
    return x >= this._landingZone.leftX && x <= this._landingZone.rightX;
  }

  /** 生成爆炸粒子 */
  private spawnExplosion(): void {
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      this._explosionParticles.push({
        x: this._landerX,
        y: this._landerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1.0,
      });
    }
  }

  /** 更新爆炸粒子 */
  private updateExplosionParticles(): void {
    for (const p of this._explosionParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // 粒子也受微重力
      p.life -= 0.02;
    }
    this._explosionParticles = this._explosionParticles.filter(p => p.life > 0);
  }

  // ========== 渲染方法 ==========

  private renderStars(ctx: CanvasRenderingContext2D): void {
    for (const star of this._stars) {
      ctx.globalAlpha = star.brightness;
      ctx.fillStyle = STAR_COLOR;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  private renderTerrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this._terrain.length < 2) return;

    // 地形填充
    ctx.fillStyle = TERRAIN_FILL_COLOR;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of this._terrain) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // 地形轮廓
    ctx.strokeStyle = TERRAIN_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this._terrain[0].x, this._terrain[0].y);
    for (let i = 1; i < this._terrain.length; i++) {
      ctx.lineTo(this._terrain[i].x, this._terrain[i].y);
    }
    ctx.stroke();
  }

  private renderLandingZone(ctx: CanvasRenderingContext2D): void {
    if (!this._landingZone) return;
    const lz = this._landingZone;

    ctx.fillStyle = LANDING_ZONE_COLOR;
    ctx.fillRect(lz.leftX, lz.y - LANDING_ZONE_MARKER_HEIGHT, lz.rightX - lz.leftX, LANDING_ZONE_MARKER_HEIGHT);

    // 着陆区指示灯
    ctx.fillStyle = LANDING_ZONE_COLOR;
    const markerSpacing = 10;
    for (let x = lz.leftX; x <= lz.rightX; x += markerSpacing) {
      ctx.fillRect(x - 1, lz.y - LANDING_ZONE_MARKER_HEIGHT - 4, 2, 4);
    }
  }

  private renderLander(ctx: CanvasRenderingContext2D): void {
    if (this._landingResult === 'crash') return; // 坠毁后不绘制

    ctx.save();
    ctx.translate(this._landerX, this._landerY);
    ctx.rotate((this._landerAngle * Math.PI) / 180);

    // 登陆舱主体（三角形 + 矩形组合）
    ctx.fillStyle = LANDER_COLOR;
    ctx.beginPath();
    ctx.moveTo(0, -LANDER_HEIGHT / 2);           // 顶部
    ctx.lineTo(-LANDER_WIDTH / 2, LANDER_HEIGHT / 2);  // 左下
    ctx.lineTo(LANDER_WIDTH / 2, LANDER_HEIGHT / 2);   // 右下
    ctx.closePath();
    ctx.fill();

    // 舱窗
    ctx.fillStyle = LANDER_WINDOW_COLOR;
    ctx.beginPath();
    ctx.arc(0, -2, 3, 0, Math.PI * 2);
    ctx.fill();

    // 着陆腿
    ctx.strokeStyle = LANDER_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-LANDER_WIDTH / 2, LANDER_HEIGHT / 2);
    ctx.lineTo(-LANDER_WIDTH / 2 - 4, LANDER_HEIGHT / 2 + 6);
    ctx.moveTo(LANDER_WIDTH / 2, LANDER_HEIGHT / 2);
    ctx.lineTo(LANDER_WIDTH / 2 + 4, LANDER_HEIGHT / 2 + 6);
    ctx.stroke();

    // 推进火焰
    if (this._isThrusting && this._fuel > 0 && !this._landed) {
      const flameLength = 10 + Math.random() * 8;
      ctx.fillStyle = THRUST_FLAME_COLOR;
      ctx.beginPath();
      ctx.moveTo(-5, LANDER_HEIGHT / 2);
      ctx.lineTo(0, LANDER_HEIGHT / 2 + flameLength);
      ctx.lineTo(5, LANDER_HEIGHT / 2);
      ctx.closePath();
      ctx.fill();

      // 内焰
      ctx.fillStyle = THRUST_FLAME_INNER_COLOR;
      ctx.beginPath();
      ctx.moveTo(-3, LANDER_HEIGHT / 2);
      ctx.lineTo(0, LANDER_HEIGHT / 2 + flameLength * 0.6);
      ctx.lineTo(3, LANDER_HEIGHT / 2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private renderExplosionParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._explosionParticles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.life > 0.5 ? THRUST_FLAME_INNER_COLOR : THRUST_FLAME_COLOR;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = HUD_COLOR;
    ctx.font = `${HUD_FONT_SIZE}px monospace`;
    ctx.textAlign = 'left';

    // 燃料
    const fuelLabel = `FUEL`;
    ctx.fillText(fuelLabel, HUD_MARGIN, HUD_MARGIN + HUD_FONT_SIZE);

    // 燃料条
    const barX = HUD_MARGIN + 50;
    const barY = HUD_MARGIN + 2;
    const fuelRatio = this._fuel / this.getInitialFuelForLevel();
    const fuelBarColor = this._fuel <= FUEL_LOW_THRESHOLD ? FUEL_BAR_LOW_COLOR : FUEL_BAR_COLOR;

    ctx.fillStyle = FUEL_BAR_BG_COLOR;
    ctx.fillRect(barX, barY, FUEL_BAR_WIDTH, FUEL_BAR_HEIGHT);
    ctx.fillStyle = fuelBarColor;
    ctx.fillRect(barX, barY, FUEL_BAR_WIDTH * fuelRatio, FUEL_BAR_HEIGHT);

    // 速度
    const speed = Math.sqrt(this._landerVX * this._landerVX + this._landerVY * this._landerVY);
    ctx.fillStyle = HUD_COLOR;
    ctx.fillText(`SPD: ${speed.toFixed(1)}`, barX + FUEL_BAR_WIDTH + 20, HUD_MARGIN + HUD_FONT_SIZE);

    // 高度
    const altitude = Math.max(0, this.getTerrainHeightAt(this._landerX) - this._landerY - LANDER_HEIGHT / 2);
    ctx.fillText(`ALT: ${altitude.toFixed(0)}`, w - 120, HUD_MARGIN + HUD_FONT_SIZE);

    // 关卡
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${this._level}`, w / 2, HUD_MARGIN + HUD_FONT_SIZE);
    ctx.textAlign = 'left';

    // 分数
    ctx.fillText(`SCORE: ${this._score}`, HUD_MARGIN, HUD_MARGIN + HUD_FONT_SIZE * 2 + 4);
  }

  private renderResultMessage(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this._status !== 'gameover') return;

    ctx.textAlign = 'center';

    if (this._landingResult === 'success') {
      ctx.fillStyle = SUCCESS_COLOR;
      ctx.font = 'bold 28px monospace';
      ctx.fillText('LANDED!', w / 2, h / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillStyle = HUD_COLOR;
      ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 15);
      if (this._level < MAX_LEVELS) {
        ctx.fillText('Press SPACE for next level', w / 2, h / 2 + 45);
      } else {
        ctx.fillText('ALL LEVELS COMPLETE!', w / 2, h / 2 + 45);
      }
    } else if (this._landingResult === 'crash') {
      ctx.fillStyle = CRASH_COLOR;
      ctx.font = 'bold 28px monospace';
      ctx.fillText('CRASHED!', w / 2, h / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillStyle = HUD_COLOR;
      const reasons: string[] = [];
      if (!this.isSpeedSafe()) reasons.push('Too fast');
      if (!this.isAngleSafe()) reasons.push('Bad angle');
      if (!this.isInLandingZone(this._landerX)) reasons.push('Missed pad');
      ctx.fillText(reasons.join(' | '), w / 2, h / 2 + 15);
      ctx.fillText('Press SPACE to retry', w / 2, h / 2 + 45);
    }

    ctx.textAlign = 'left';
  }
}
