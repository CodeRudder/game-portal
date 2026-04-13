import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  COLS, ROWS, CELL_SIZE,
  FROG_SIZE, FROG_START_COL, FROG_START_ROW, FROG_JUMP_DURATION,
  GOAL_ROW, GOAL_COUNT, GOAL_POSITIONS,
  RIVER_ROWS, MID_REST_ROW, ROAD_A_ROWS, SAFE_ROW_A, ROAD_B_ROWS, SAFE_ROW_B, START_ROWS,
  LANE_CONFIGS, RIVER_CONFIGS,
  LaneConfig, RiverLaneConfig,
  INITIAL_LIVES, ROUND_TIME_LIMIT,
  SCORE_FORWARD, SCORE_GOAL, SCORE_TIME_BONUS_MAX, SCORE_LEVEL_COMPLETE,
  SPEED_INCREMENT_PER_LEVEL,
  BG_COLOR, GRASS_COLOR, ROAD_COLOR, WATER_COLOR, GOAL_COLOR, FROG_COLOR, HUD_COLOR,
} from './constants';

// ========== 内部类型 ==========

interface Frog {
  col: number;
  row: number;
  x: number;     // 实际像素 x（用于平滑动画）
  y: number;     // 实际像素 y
  targetX: number;
  targetY: number;
  jumping: boolean;
  jumpProgress: number; // 0..1
  landedThisFrame: boolean; // 跳跃刚落地，本帧跳过溺水检测
}

interface Vehicle {
  x: number;
  row: number;
  width: number;
  height: number;
  speed: number;
  direction: 1 | -1;
  type: string;
  color: string;
}

interface RiverObject {
  x: number;
  row: number;
  width: number;
  height: number;
  speed: number;
  direction: 1 | -1;
  type: 'log' | 'turtle';
  color: string;
  canDive: boolean;
  diveCycleDuration: number;
  diveDuration: number;
  diveTimer: number;
  isDiving: boolean;
}

type DeathCause = 'car' | 'water' | 'offscreen' | 'timeout' | null;

export class FroggerEngine extends GameEngine {
  // 青蛙
  private frog: Frog = this.createDefaultFrog();
  private frogAlive: boolean = true;
  private deathCause: DeathCause = null;

  // 车辆
  private vehicles: Vehicle[] = [];

  // 河流物体
  private riverObjects: RiverObject[] = [];

  // 终点状态
  private goalsReached: boolean[] = new Array(GOAL_COUNT).fill(false);

  // 生命与计时
  private _lives: number = INITIAL_LIVES;
  private roundTimer: number = ROUND_TIME_LIMIT;
  private _isWin: boolean = false;
  private maxRowReached: number = FROG_START_ROW;

  // 速度倍率（关卡递进）
  private speedMultiplier: number = 1;

  // 死亡动画
  private deathAnimationTimer: number = 0;
  private readonly DEATH_ANIMATION_DURATION = 500; // ms

  // ======== 公开属性 ========

  get lives(): number { return this._lives; }
  get isWin(): boolean { return this._isWin; }
  get timeRemaining(): number { return Math.max(0, this.roundTimer); }
  get goalsReachedCount(): number { return this.goalsReached.filter(Boolean).length; }

  // 测试用：暴露内部状态
  get frogCol(): number { return this.frog.col; }
  get frogRow(): number { return this.frog.row; }
  get frogAlivePublic(): boolean { return this.frogAlive; }
  get deathCausePublic(): DeathCause { return this.deathCause; }
  get vehicleCount(): number { return this.vehicles.length; }
  get riverObjectCount(): number { return this.riverObjects.length; }

  // ======== 生命周期实现 ========

  protected onInit(): void {
    // 状态已在属性声明中初始化
  }

  protected onStart(): void {
    this._lives = INITIAL_LIVES;
    this._isWin = false;
    this.speedMultiplier = 1;
    this.goalsReached = new Array(GOAL_COUNT).fill(false);
    this.resetFrog();
    this.initVehicles();
    this.initRiverObjects();
  }

  protected onReset(): void {
    this.frog = this.createDefaultFrog();
    this.frogAlive = true;
    this.deathCause = null;
    this._lives = INITIAL_LIVES;
    this._isWin = false;
    this.roundTimer = ROUND_TIME_LIMIT;
    this.maxRowReached = FROG_START_ROW;
    this.speedMultiplier = 1;
    this.goalsReached = new Array(GOAL_COUNT).fill(false);
    this.vehicles = [];
    this.riverObjects = [];
    this.deathAnimationTimer = 0;
  }

  protected onDestroy(): void {
    this.vehicles = [];
    this.riverObjects = [];
  }

  protected onGameOver(): void {
    // game over hook
  }

  // ======== 主循环 ========

  protected update(deltaTime: number): void {
    if (this._status !== 'playing') return;

    const dt = deltaTime / 1000; // 转为秒

    // 死亡动画中
    if (!this.frogAlive) {
      this.deathAnimationTimer -= deltaTime;
      if (this.deathAnimationTimer <= 0) {
        this.respawnOrGameOver();
      }
      return;
    }

    // 计时器
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.killFrog('timeout');
      return;
    }

    // 青蛙跳跃动画
    if (this.frog.jumping) {
      this.frog.jumpProgress += deltaTime / FROG_JUMP_DURATION;
      if (this.frog.jumpProgress >= 1) {
        this.frog.jumpProgress = 1;
        this.frog.jumping = false;
        this.frog.x = this.frog.targetX;
        this.frog.y = this.frog.targetY;
        this.frog.landedThisFrame = true;
      } else {
        this.frog.x = this.frog.x + (this.frog.targetX - this.frog.x) * (deltaTime / FROG_JUMP_DURATION);
        this.frog.y = this.frog.y + (this.frog.targetY - this.frog.y) * (deltaTime / FROG_JUMP_DURATION);
      }
    }

    // 更新车辆
    this.updateVehicles(dt);

    // 更新河流物体
    this.updateRiverObjects(dt);

    // 河流物体带动青蛙（跳跃刚落地时跳过溺水检测，给一帧缓冲）
    if (this.isRiverRow(this.frog.row) && this.frogAlive) {
      if (this.frog.landedThisFrame) {
        // 落地帧：只做漂移不做溺水检测，然后清除标志
        this.applyRiverDrift(dt, true);
      } else if (!this.frog.jumping) {
        this.applyRiverDrift(dt, false);
      }
    }
    this.frog.landedThisFrame = false;

    // 碰撞检测
    this.checkCollisions();

    // 检测到达终点
    this.checkGoalReached();
  }

  // ======== 渲染 ========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    const offsetY = HUD_HEIGHT;

    // 绘制各行背景
    for (let row = 0; row < ROWS; row++) {
      const y = offsetY + row * CELL_SIZE;
      if (row === GOAL_ROW) {
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, y, w, CELL_SIZE);
      } else if (this.isRiverRow(row)) {
        ctx.fillStyle = WATER_COLOR;
        ctx.fillRect(0, y, w, CELL_SIZE);
      } else if (this.isRoadRow(row)) {
        ctx.fillStyle = ROAD_COLOR;
        ctx.fillRect(0, y, w, CELL_SIZE);
      } else {
        ctx.fillStyle = GRASS_COLOR;
        ctx.fillRect(0, y, w, CELL_SIZE);
      }
    }

    // 绘制终点标记
    for (let i = 0; i < GOAL_COUNT; i++) {
      const gx = GOAL_POSITIONS[i] * CELL_SIZE;
      const gy = offsetY + GOAL_ROW * CELL_SIZE;
      ctx.fillStyle = this.goalsReached[i] ? '#e74c3c' : GOAL_COLOR;
      ctx.fillRect(gx + 2, gy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      if (!this.goalsReached[i]) {
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', gx + CELL_SIZE / 2, gy + CELL_SIZE / 2);
      }
    }

    // 绘制河流物体
    for (const obj of this.riverObjects) {
      if (obj.canDive && obj.isDiving) continue;
      const ry = offsetY + obj.row * CELL_SIZE;
      ctx.fillStyle = obj.color;
      ctx.fillRect(obj.x, ry + 2, obj.width * CELL_SIZE, CELL_SIZE - 4);
    }

    // 绘制车辆
    for (const v of this.vehicles) {
      const vy = offsetY + v.row * CELL_SIZE;
      ctx.fillStyle = v.color;
      ctx.fillRect(v.x, vy + 4, v.width * CELL_SIZE, CELL_SIZE - 8);
    }

    // 绘制青蛙
    if (this.frogAlive) {
      const fx = this.frog.x;
      const fy = offsetY + this.frog.y;
      ctx.fillStyle = FROG_COLOR;
      ctx.beginPath();
      ctx.arc(fx + CELL_SIZE / 2, fy + CELL_SIZE / 2, FROG_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(fx + CELL_SIZE / 2 - 6, fy + CELL_SIZE / 2 - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx + CELL_SIZE / 2 + 6, fy + CELL_SIZE / 2 - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.deathAnimationTimer > 0) {
      // 死亡动画（红色闪烁）
      const fx = this.frog.x;
      const fy = offsetY + this.frog.y;
      ctx.fillStyle = '#e74c3c';
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.deathAnimationTimer / 50);
      ctx.beginPath();
      ctx.arc(fx + CELL_SIZE / 2, fy + CELL_SIZE / 2, FROG_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, HUD_HEIGHT);
    ctx.fillStyle = HUD_COLOR;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`生命: ${this._lives}`, 10, HUD_HEIGHT / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`分数: ${this._score}`, w / 2, HUD_HEIGHT / 2);
    ctx.textAlign = 'right';
    ctx.fillText(`时间: ${Math.ceil(this.roundTimer)}s`, w - 10, HUD_HEIGHT / 2);
  }

  // ======== 输入处理 ========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;
    if (!this.frogAlive) return;
    if (this.frog.jumping) return;

    let newCol = this.frog.col;
    let newRow = this.frog.row;

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        newRow = Math.max(0, this.frog.row - 1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        newRow = Math.min(ROWS - 1, this.frog.row + 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        newCol = Math.max(0, this.frog.col - 1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        newCol = Math.min(COLS - 1, this.frog.col + 1);
        break;
      default:
        return;
    }

    if (newCol === this.frog.col && newRow === this.frog.row) return;

    // 前进得分
    if (newRow < this.frog.row && newRow < this.maxRowReached) {
      this.addScore(SCORE_FORWARD);
      this.maxRowReached = newRow;
    }

    this.frog.col = newCol;
    this.frog.row = newRow;
    this.frog.targetX = newCol * CELL_SIZE;
    this.frog.targetY = newRow * CELL_SIZE;
    this.frog.jumping = true;
    this.frog.jumpProgress = 0;
  }

  handleKeyUp(_key: string): void {
    // 青蛙过河不需要 key up 逻辑
  }

  getState(): Record<string, unknown> {
    return {
      frogCol: this.frog.col,
      frogRow: this.frog.row,
      frogAlive: this.frogAlive,
      lives: this._lives,
      score: this._score,
      level: this._level,
      timeRemaining: this.roundTimer,
      goalsReached: [...this.goalsReached],
      goalsReachedCount: this.goalsReachedCount,
      isWin: this._isWin,
      deathCause: this.deathCause,
      speedMultiplier: this.speedMultiplier,
    };
  }

  // ======== 私有方法 ========

  private createDefaultFrog(): Frog {
    const x = FROG_START_COL * CELL_SIZE;
    const y = FROG_START_ROW * CELL_SIZE;
    return {
      col: FROG_START_COL,
      row: FROG_START_ROW,
      x, y,
      targetX: x,
      targetY: y,
      jumping: false,
      jumpProgress: 0,
      landedThisFrame: false,
    };
  }

  private resetFrog(): void {
    this.frog = this.createDefaultFrog();
    this.frogAlive = true;
    this.deathCause = null;
    this.roundTimer = ROUND_TIME_LIMIT;
    this.maxRowReached = FROG_START_ROW;
    this.deathAnimationTimer = 0;
  }

  private initVehicles(): void {
    this.vehicles = [];
    for (const cfg of LANE_CONFIGS) {
      const count = Math.ceil(COLS / (cfg.vehicleWidth + cfg.gap)) + 1;
      for (let i = 0; i < count; i++) {
        this.vehicles.push({
          x: i * (cfg.vehicleWidth + cfg.gap) * CELL_SIZE,
          row: cfg.row,
          width: cfg.vehicleWidth,
          height: CELL_SIZE - 8,
          speed: cfg.speed * cfg.direction * this.speedMultiplier,
          direction: cfg.direction,
          type: cfg.vehicleType,
          color: cfg.color,
        });
      }
    }
  }

  private initRiverObjects(): void {
    this.riverObjects = [];
    for (const cfg of RIVER_CONFIGS) {
      const count = Math.ceil(COLS / (cfg.objectWidth + cfg.gap)) + 1;
      for (let i = 0; i < count; i++) {
        this.riverObjects.push({
          x: i * (cfg.objectWidth + cfg.gap) * CELL_SIZE,
          row: cfg.row,
          width: cfg.objectWidth,
          height: CELL_SIZE - 4,
          speed: cfg.speed * cfg.direction * this.speedMultiplier,
          direction: cfg.direction,
          type: cfg.objectType,
          color: cfg.color,
          canDive: cfg.canDive,
          diveCycleDuration: cfg.diveCycleDuration,
          diveDuration: cfg.diveDuration,
          diveTimer: Math.random() * cfg.diveCycleDuration,
          isDiving: false,
        });
      }
    }
  }

  private updateVehicles(dt: number): void {
    for (const v of this.vehicles) {
      v.x += v.speed * dt;
      // 循环滚动
      const totalWidth = CANVAS_WIDTH + v.width * CELL_SIZE;
      if (v.direction === 1 && v.x > CANVAS_WIDTH) {
        v.x = -v.width * CELL_SIZE;
      } else if (v.direction === -1 && v.x + v.width * CELL_SIZE < 0) {
        v.x = CANVAS_WIDTH;
      }
    }
  }

  private updateRiverObjects(dt: number): void {
    for (const obj of this.riverObjects) {
      obj.x += obj.speed * dt;

      // 循环滚动
      if (obj.direction === 1 && obj.x > CANVAS_WIDTH) {
        obj.x = -obj.width * CELL_SIZE;
      } else if (obj.direction === -1 && obj.x + obj.width * CELL_SIZE < 0) {
        obj.x = CANVAS_WIDTH;
      }

      // 乌龟潜水
      if (obj.canDive) {
        obj.diveTimer += dt * 1000;
        const cycle = obj.diveCycleDuration;
        if (cycle > 0) {
          const phase = obj.diveTimer % cycle;
          obj.isDiving = phase >= (cycle - obj.diveDuration);
        }
      }
    }
  }

  private applyRiverDrift(dt: number, skipDrowning: boolean = false): void {
    const frogRect = this.getFrogRect();
    let onObject = false;

    for (const obj of this.riverObjects) {
      if (obj.row !== this.frog.row) continue;
      if (obj.canDive && obj.isDiving) continue;

      const objRect = {
        x: obj.x,
        y: 0,
        w: obj.width * CELL_SIZE,
        h: CELL_SIZE,
      };

      if (this.rectsOverlap(frogRect, objRect)) {
        onObject = true;
        // 随河流物体移动
        const drift = obj.speed * dt;
        this.frog.x += drift;
        this.frog.targetX += drift;

        // 检测被带出屏幕
        if (this.frog.x < -CELL_SIZE || this.frog.x > CANVAS_WIDTH) {
          this.killFrog('offscreen');
          return;
        }

        // 更新 col（四舍五入）
        this.frog.col = Math.round(this.frog.x / CELL_SIZE);
        break;
      }
    }

    // 在河流中但不在任何物体上 → 溺水（落地帧跳过）
    if (!onObject && !this.frog.jumping && !skipDrowning) {
      this.killFrog('water');
    }
  }

  private checkCollisions(): void {
    if (!this.frogAlive) return;
    if (this.frog.jumping) return; // 跳跃中不检测

    const frogRect = this.getFrogRect();

    // 车辆碰撞
    for (const v of this.vehicles) {
      if (v.row !== this.frog.row) continue;
      const vRect = {
        x: v.x,
        y: 0,
        w: v.width * CELL_SIZE,
        h: CELL_SIZE,
      };
      if (this.rectsOverlap(frogRect, vRect)) {
        this.killFrog('car');
        return;
      }
    }
  }

  private checkGoalReached(): void {
    if (!this.frogAlive) return;
    if (this.frog.jumping) return;
    if (this.frog.row !== GOAL_ROW) return;

    // 已经处理过通关，不再重复
    if (this._isWin) return;

    // 所有终点已到达（可能是本帧到达的，也可能是之前手动设置的）→ 触发通关
    if (this.goalsReached.every(Boolean)) {
      this.addScore(SCORE_LEVEL_COMPLETE);
      this._isWin = true;
      this.nextLevel();
      return;
    }

    // 检查是否到达某个终点位置
    for (let i = 0; i < GOAL_COUNT; i++) {
      if (this.goalsReached[i]) continue;
      const goalCol = GOAL_POSITIONS[i];
      if (this.frog.col === goalCol || Math.abs(this.frog.x - goalCol * CELL_SIZE) < CELL_SIZE * 0.6) {
        this.goalsReached[i] = true;

        // 计分
        this.addScore(SCORE_GOAL);
        const timeBonus = Math.floor((this.roundTimer / ROUND_TIME_LIMIT) * SCORE_TIME_BONUS_MAX);
        this.addScore(timeBonus);

        // 检查是否全部到达
        if (this.goalsReached.every(Boolean)) {
          this.addScore(SCORE_LEVEL_COMPLETE);
          this._isWin = true;
          this.nextLevel();
        } else {
          this.resetFrog();
        }
        return;
      }
    }

    // 到了终点行但没到具体目标位置 → 死亡
    this.killFrog('water');
  }

  private killFrog(cause: DeathCause): void {
    if (!this.frogAlive) return;
    this.frogAlive = false;
    this.deathCause = cause;
    this.deathAnimationTimer = this.DEATH_ANIMATION_DURATION;
  }

  private respawnOrGameOver(): void {
    this._lives--;
    if (this._lives <= 0) {
      this.gameOver();
    } else {
      this.resetFrog();
    }
  }

  private nextLevel(): void {
    this.setLevel(this._level + 1);
    this.speedMultiplier = 1 + (this._level - 1) * SPEED_INCREMENT_PER_LEVEL;
    this.goalsReached = new Array(GOAL_COUNT).fill(false);
    this.resetFrog();
    // 重新初始化车辆和河流物体以应用新速度
    this.initVehicles();
    this.initRiverObjects();
  }

  // ======== 工具方法 ========

  private getFrogRect(): { x: number; y: number; w: number; h: number } {
    const padding = 4;
    return {
      x: this.frog.x + padding,
      y: this.frog.row * CELL_SIZE + padding,
      w: CELL_SIZE - padding * 2,
      h: CELL_SIZE - padding * 2,
    };
  }

  private rectsOverlap(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x;
  }

  private isRiverRow(row: number): boolean {
    return RIVER_ROWS.includes(row);
  }

  private isRoadRow(row: number): boolean {
    return ROAD_A_ROWS.includes(row) || ROAD_B_ROWS.includes(row);
  }
}
