/**
 * PinballEngine — 弹珠台游戏引擎
 *
 * 核心功能：
 * - 物理系统：重力、速度、加速度、弹性碰撞
 * - 弹珠：圆形刚体，受重力影响，与墙壁/挡板/bumper 碰撞反弹
 * - 挡板（Flipper）：左右两个，Z/左键控制左挡板，//右键控制右挡板
 * - Bumper：圆形得分区，弹珠碰撞得分并弹开，带闪烁动画
 * - 发射器：空格键蓄力、松开发射弹珠
 * - 多球模式：达到一定分数后奖励额外弹珠
 * - 生命系统：3 个弹珠，弹珠从底部掉落失去一个
 * - 粒子特效：碰撞 bumper 时产生粒子效果
 * - 计分：不同 bumper 不同分值，连击加分
 * - 等级：随分数提升等级，增加 bumper 分值
 */

import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  GRAVITY, FRICTION, RESTITUTION, WALL_RESTITUTION,
  MAX_BALL_SPEED,
  BALL_RADIUS, BALL_COLOR, BALL_HIGHLIGHT,
  FLIPPER_LENGTH, FLIPPER_WIDTH,
  FLIPPER_REST_ANGLE, FLIPPER_ACTIVE_ANGLE,
  FLIPPER_ANGULAR_VELOCITY, FLIPPER_Y,
  LEFT_FLIPPER_X, RIGHT_FLIPPER_X,
  FLIPPER_COLOR, FLIPPER_PIVOT_COLOR,
  BUMPER_DEFS, BUMPER_HIT_DURATION, BUMPER_RESTITUTION,
  WALL_DEFS,
  LAUNCHER_X, LAUNCHER_Y, LAUNCHER_WIDTH,
  LAUNCHER_MAX_POWER, LAUNCHER_CHARGE_RATE, LAUNCHER_COLOR,
  INITIAL_LIVES,
  MULTI_BALL_SCORE, MULTI_BALL_COUNT, MULTI_BALL_SPEED,
  COMBO_TIMEOUT, COMBO_MULTIPLIER_BASE, COMBO_MULTIPLIER_STEP, MAX_COMBO_MULTIPLIER,
  PARTICLE_COUNT, PARTICLE_LIFE, PARTICLE_MAX_SPEED,
  PARTICLE_MIN_SIZE, PARTICLE_MAX_SIZE,
  TABLE_LEFT, TABLE_RIGHT, TABLE_TOP,
  BG_COLOR, TABLE_COLOR, WALL_COLOR, RAIL_COLOR, HUD_COLOR, DRAIN_COLOR,
  SCORE_LANES,
  LEVEL_SCORE_THRESHOLD, LEVEL_SPEED_INCREASE,
} from './constants';
import type { BumperDef, WallDef, ScoreLaneDef } from './constants';

// ========== 数据结构 ==========

/** 弹珠对象 */
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
}

/** 挡板对象 */
export interface Flipper {
  x: number;
  y: number;
  length: number;
  angle: number;
  targetAngle: number;
  angularVelocity: number;
  side: 'left' | 'right';
  width: number;
}

/** Bumper 得分对象 */
export interface Bumper {
  x: number;
  y: number;
  radius: number;
  score: number;
  color: string;
  hitTimer: number;
}

/** 粒子对象 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/** 得分通道对象 */
export interface ScoreLane {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  color: string;
  hitTimer: number;
}

// ========== 引擎实现 ==========

export class PinballEngine extends GameEngine {
  // ---------- 游戏对象 ----------
  private _balls: Ball[] = [];
  private _flippers: Flipper[] = [];
  private _bumpers: Bumper[] = [];
  private _particles: Particle[] = [];
  private _scoreLanes: ScoreLane[] = [];
  private _walls: WallDef[] = [];

  // ---------- 游戏状态 ----------
  private _lives: number = INITIAL_LIVES;
  private _launcherPower: number = 0;
  private _launcherCharging: boolean = false;
  private _comboCount: number = 0;
  private _comboTimer: number = 0;
  private _comboMultiplier: number = COMBO_MULTIPLIER_BASE;
  private _multiBallTriggered: boolean = false;
  private _gravityMultiplier: number = 1;

  // ---------- 按键状态 ----------
  private _leftFlipperActive: boolean = false;
  private _rightFlipperActive: boolean = false;

  // ---------- 等级阈值 ----------
  private _nextLevelScore: number = LEVEL_SCORE_THRESHOLD;

  // ========== 公共 Getter ==========

  /** 所有弹珠 */
  get balls(): Ball[] { return this._balls; }

  /** 所有挡板 */
  get flippers(): Flipper[] { return this._flippers; }

  /** 所有 bumper */
  get bumpers(): Bumper[] { return this._bumpers; }

  /** 所有粒子 */
  get particles(): Particle[] { return this._particles; }

  /** 所有得分通道 */
  get scoreLanes(): ScoreLane[] { return this._scoreLanes; }

  /** 剩余生命数 */
  get lives(): number { return this._lives; }

  /** 发射器当前蓄力值 */
  get launcherPower(): number { return this._launcherPower; }

  /** 发射器是否正在蓄力 */
  get launcherCharging(): boolean { return this._launcherCharging; }

  /** 当前连击数 */
  get comboCount(): number { return this._comboCount; }

  /** 当前连击倍率 */
  get comboMultiplier(): number { return this._comboMultiplier; }

  /** 多球模式是否已触发 */
  get multiBallTriggered(): boolean { return this._multiBallTriggered; }

  /** 左挡板是否激活 */
  get leftFlipperActive(): boolean { return this._leftFlipperActive; }

  /** 右挡板是否激活 */
  get rightFlipperActive(): boolean { return this._rightFlipperActive; }

  /** 活跃弹珠数量 */
  get activeBallCount(): number { return this._balls.filter(b => b.active).length; }

  /** 重力倍率 */
  get gravityMultiplier(): number { return this._gravityMultiplier; }

  // ========== GameEngine 抽象方法实现 ==========

  /**
   * 初始化所有游戏元素
   * 设置挡板、bumper、得分通道、墙壁等
   */
  protected onInit(): void {
    this.initFlippers();
    this.initBumpers();
    this.initScoreLanes();
    this._walls = [...WALL_DEFS];
    this._balls = [];
    this._particles = [];
    this._lives = INITIAL_LIVES;
    this._launcherPower = 0;
    this._launcherCharging = false;
    this._comboCount = 0;
    this._comboTimer = 0;
    this._comboMultiplier = COMBO_MULTIPLIER_BASE;
    this._multiBallTriggered = false;
    this._leftFlipperActive = false;
    this._rightFlipperActive = false;
    this._gravityMultiplier = 1;
    this._nextLevelScore = LEVEL_SCORE_THRESHOLD;
  }

  /**
   * 游戏开始时重置弹珠到发射位置
   */
  protected onStart(): void {
    this.onInit();
    this.spawnBall();
  }

  /**
   * 每帧物理更新
   * @param deltaTime - 距上一帧的时间间隔（毫秒）
   */
  protected update(deltaTime: number): void {
    // 标准化 deltaTime（目标 16ms/帧）
    const dt = Math.min(deltaTime, 32) / 16;

    this.updateLauncher(dt);
    this.updateFlippers(dt);
    this.updateBalls(dt);
    this.updateParticles(dt);
    this.updateScoreLanes(dt);
    this.updateCombo(dt);
    this.checkMultiBall();
    this.checkLevelUp();
    this.checkGameOver();
  }

  /**
   * 渲染所有游戏元素
   */
  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 台面
    ctx.fillStyle = TABLE_COLOR;
    ctx.fillRect(TABLE_LEFT, TABLE_TOP, TABLE_RIGHT - TABLE_LEFT, h - TABLE_TOP);

    // 墙壁
    this.renderWalls(ctx);

    // 排水口
    this.renderDrain(ctx);

    // 得分通道
    this.renderScoreLanes(ctx);

    // Bumpers
    this.renderBumpers(ctx);

    // 挡板
    this.renderFlippers(ctx);

    // 弹珠
    this.renderBalls(ctx);

    // 粒子
    this.renderParticles(ctx);

    // 发射器
    this.renderLauncher(ctx);

    // HUD
    this.renderHUD(ctx, w);
  }

  /** 重置时重新初始化 */
  protected onReset(): void {
    this.onInit();
  }

  /** 销毁时清空所有对象 */
  protected onDestroy(): void {
    this._balls = [];
    this._particles = [];
    this._bumpers = [];
    this._flippers = [];
    this._scoreLanes = [];
  }

  /** 游戏结束回调 */
  protected onGameOver(): void {
    // 游戏结束回调（可被子类或事件监听器扩展）
  }

  /**
   * 处理按键按下事件
   * - Z / 左方向键：左挡板上抬
   * - / (Slash) / 右方向键：右挡板上抬
   * - 空格：发射器蓄力
   */
  handleKeyDown(key: string): void {
    // 空格在 idle 状态下启动游戏
    if (this._status === 'idle') {
      if (key === ' ' || key === 'Space') {
        this.start();
        return;
      }
    }

    if (this._status !== 'playing') return;

    // 左挡板：Z 键、左方向键、ShiftLeft
    if (key === 'KeyZ' || key === 'ArrowLeft' || key === 'ShiftLeft') {
      this._leftFlipperActive = true;
      this.activateFlipper('left');
    }

    // 右挡板：/ 键（Slash）、右方向键、ShiftRight
    if (key === 'Slash' || key === 'ArrowRight' || key === 'ShiftRight') {
      this._rightFlipperActive = true;
      this.activateFlipper('right');
    }

    // 发射器蓄力：空格
    if (key === ' ' || key === 'Space') {
      if (!this._launcherCharging) {
        this._launcherCharging = true;
        this._launcherPower = 0;
      }
    }
  }

  /**
   * 处理按键释放事件
   * - 松开挡板键：挡板回落
   * - 松开空格：发射弹珠
   */
  handleKeyUp(key: string): void {
    // 左挡板释放
    if (key === 'KeyZ' || key === 'ArrowLeft' || key === 'ShiftLeft') {
      this._leftFlipperActive = false;
      this.deactivateFlipper('left');
    }

    // 右挡板释放
    if (key === 'Slash' || key === 'ArrowRight' || key === 'ShiftRight') {
      this._rightFlipperActive = false;
      this.deactivateFlipper('right');
    }

    // 发射器释放
    if (key === ' ' || key === 'Space') {
      if (this._launcherCharging) {
        this.launchBall();
        this._launcherCharging = false;
      }
    }
  }

  /**
   * 获取当前游戏状态
   * @returns 包含所有关键状态信息的对象
   */
  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      lives: this._lives,
      balls: this._balls.map(b => ({ ...b })),
      bumpers: this._bumpers.map(b => ({ ...b })),
      comboCount: this._comboCount,
      comboMultiplier: this._comboMultiplier,
      launcherPower: this._launcherPower,
      launcherCharging: this._launcherCharging,
      multiBallTriggered: this._multiBallTriggered,
      activeBallCount: this.activeBallCount,
      leftFlipperActive: this._leftFlipperActive,
      rightFlipperActive: this._rightFlipperActive,
      gravityMultiplier: this._gravityMultiplier,
    };
  }

  // ========== 公共方法 ==========

  /**
   * 发射弹珠
   * 根据当前蓄力值创建一个弹珠并赋予向上速度
   */
  launchBall(): void {
    if (this._launcherPower <= 0) return;

    const power = this._launcherPower;
    this._launcherPower = 0;

    // 在发射器位置创建球
    const ball: Ball = {
      x: LAUNCHER_X,
      y: LAUNCHER_Y - BALL_RADIUS - 5,
      vx: (Math.random() - 0.5) * 2, // 轻微随机水平偏移
      vy: -power,
      radius: BALL_RADIUS,
      active: true,
    };
    this._balls.push(ball);
  }

  /**
   * 在发射器位置生成一个静止弹珠（等待发射）
   */
  spawnBall(): void {
    const ball: Ball = {
      x: LAUNCHER_X,
      y: LAUNCHER_Y - BALL_RADIUS - 5,
      vx: 0,
      vy: 0,
      radius: BALL_RADIUS,
      active: true,
    };
    this._balls.push(ball);
  }

  /**
   * 触发多球模式
   * 在台面中央生成额外弹珠
   */
  triggerMultiBall(): void {
    if (this._multiBallTriggered) return;
    this._multiBallTriggered = true;

    for (let i = 0; i < MULTI_BALL_COUNT - 1; i++) {
      const angle = (Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.8;
      const ball: Ball = {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        vx: Math.cos(angle) * MULTI_BALL_SPEED,
        vy: Math.sin(angle) * MULTI_BALL_SPEED,
        radius: BALL_RADIUS,
        active: true,
      };
      this._balls.push(ball);
    }
  }

  // ========== 初始化方法 ==========

  /** 初始化左右挡板 */
  private initFlippers(): void {
    this._flippers = [
      {
        x: LEFT_FLIPPER_X,
        y: FLIPPER_Y,
        length: FLIPPER_LENGTH,
        angle: FLIPPER_REST_ANGLE,
        targetAngle: FLIPPER_REST_ANGLE,
        angularVelocity: FLIPPER_ANGULAR_VELOCITY,
        side: 'left',
        width: FLIPPER_WIDTH,
      },
      {
        x: RIGHT_FLIPPER_X,
        y: FLIPPER_Y,
        length: FLIPPER_LENGTH,
        angle: Math.PI - FLIPPER_REST_ANGLE,
        targetAngle: Math.PI - FLIPPER_REST_ANGLE,
        angularVelocity: FLIPPER_ANGULAR_VELOCITY,
        side: 'right',
        width: FLIPPER_WIDTH,
      },
    ];
  }

  /** 从 BUMPER_DEFS 初始化 bumper */
  private initBumpers(): void {
    this._bumpers = BUMPER_DEFS.map((def: BumperDef) => ({
      x: def.x,
      y: def.y,
      radius: def.radius,
      score: def.score,
      color: def.color,
      hitTimer: 0,
    }));
  }

  /** 从 SCORE_LANES 初始化得分通道 */
  private initScoreLanes(): void {
    this._scoreLanes = SCORE_LANES.map((def: ScoreLaneDef) => ({
      x: def.x,
      y: def.y,
      width: def.width,
      height: def.height,
      score: def.score,
      color: def.color,
      hitTimer: 0,
    }));
  }

  // ========== 更新方法 ==========

  /**
   * 更新发射器蓄力
   * @param dt - 标准化时间步长
   */
  private updateLauncher(dt: number): void {
    if (this._launcherCharging) {
      this._launcherPower = Math.min(
        this._launcherPower + LAUNCHER_CHARGE_RATE * dt,
        LAUNCHER_MAX_POWER
      );
    }
  }

  /**
   * 更新挡板角度
   * 挡板朝目标角度旋转，到达后停止
   * @param dt - 标准化时间步长
   */
  private updateFlippers(dt: number): void {
    for (const flipper of this._flippers) {
      const diff = flipper.targetAngle - flipper.angle;
      if (Math.abs(diff) > 0.01) {
        const step = Math.sign(diff) * flipper.angularVelocity * dt;
        if (Math.abs(step) > Math.abs(diff)) {
          flipper.angle = flipper.targetAngle;
        } else {
          flipper.angle += step;
        }
      }
    }
  }

  /**
   * 更新所有弹珠物理状态
   * 包括重力、摩擦力、速度限制、位移和碰撞检测
   * @param dt - 标准化时间步长
   */
  private updateBalls(dt: number): void {
    for (const ball of this._balls) {
      if (!ball.active) continue;

      // 重力
      ball.vy += GRAVITY * this._gravityMultiplier * dt;

      // 摩擦力
      ball.vx *= Math.pow(FRICTION, dt);
      ball.vy *= Math.pow(FRICTION, dt);

      // 速度限制
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed > MAX_BALL_SPEED) {
        const scale = MAX_BALL_SPEED / speed;
        ball.vx *= scale;
        ball.vy *= scale;
      }

      // 位移
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // 碰撞检测
      this.collideWithWalls(ball);
      this.collideWithBumpers(ball);
      this.collideWithFlippers(ball);
      this.collideWithScoreLanes(ball);
      this.collideWithLineWalls(ball);

      // 检查是否掉出底部
      if (ball.y - ball.radius > CANVAS_HEIGHT) {
        ball.active = false;
      }
    }
  }

  /**
   * 更新粒子状态
   * @param dt - 标准化时间步长
   */
  private updateParticles(dt: number): void {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.05 * dt; // 粒子重力
      p.life -= dt;

      if (p.life <= 0) {
        this._particles.splice(i, 1);
      }
    }
  }

  /**
   * 更新得分通道闪烁计时器
   */
  private updateScoreLanes(_dt: number): void {
    for (const lane of this._scoreLanes) {
      if (lane.hitTimer > 0) {
        lane.hitTimer--;
      }
    }
  }

  /**
   * 更新连击计时器
   * 超时后重置连击计数和倍率
   * @param dt - 标准化时间步长
   */
  private updateCombo(dt: number): void {
    if (this._comboTimer > 0) {
      this._comboTimer -= dt;
      if (this._comboTimer <= 0) {
        this._comboCount = 0;
        this._comboMultiplier = COMBO_MULTIPLIER_BASE;
      }
    }
  }

  /**
   * 检查是否触发多球模式
   * 当分数达到阈值时自动触发
   */
  private checkMultiBall(): void {
    if (!this._multiBallTriggered && this._score >= MULTI_BALL_SCORE) {
      this.triggerMultiBall();
    }
  }

  /**
   * 检查等级提升
   * 每达到 LEVEL_SCORE_THRESHOLD 分升一级
   */
  private checkLevelUp(): void {
    if (this._score >= this._nextLevelScore) {
      const newLevel = this._level + 1;
      this.setLevel(newLevel);
      this._nextLevelScore += LEVEL_SCORE_THRESHOLD;
      this._gravityMultiplier = 1 + (newLevel - 1) * LEVEL_SPEED_INCREASE;
    }
  }

  /**
   * 检查游戏结束条件
   * 所有弹珠掉出底部时减命，生命耗尽则游戏结束
   */
  private checkGameOver(): void {
    const activeBalls = this._balls.filter(b => b.active);
    if (activeBalls.length === 0 && this._balls.length > 0) {
      this._lives--;
      this._balls = [];

      if (this._lives <= 0) {
        this.gameOver();
      } else {
        // 生成新球
        this.spawnBall();
      }
    }
  }

  // ========== 碰撞检测 ==========

  /**
   * 弹珠与矩形边界墙壁碰撞
   * @param ball - 弹珠对象
   */
  private collideWithWalls(ball: Ball): void {
    // 左墙
    if (ball.x - ball.radius < TABLE_LEFT) {
      ball.x = TABLE_LEFT + ball.radius;
      ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
    }
    // 右墙（排除发射器通道）
    if (ball.x + ball.radius > TABLE_RIGHT && ball.x < LAUNCHER_X - LAUNCHER_WIDTH / 2) {
      ball.x = TABLE_RIGHT - ball.radius;
      ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
    }
    // 发射器通道右墙
    if (ball.x + ball.radius > CANVAS_WIDTH) {
      ball.x = CANVAS_WIDTH - ball.radius;
      ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
    }
    // 顶墙
    if (ball.y - ball.radius < TABLE_TOP) {
      ball.y = TABLE_TOP + ball.radius;
      ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION;
    }
  }

  /**
   * 弹珠与 bumper 碰撞（圆-圆碰撞）
   * @param ball - 弹珠对象
   */
  private collideWithBumpers(ball: Ball): void {
    for (const bumper of this._bumpers) {
      const dx = ball.x - bumper.x;
      const dy = ball.y - bumper.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = ball.radius + bumper.radius;

      if (dist < minDist && dist > 0) {
        // 法线方向
        const nx = dx / dist;
        const ny = dy / dist;

        // 分离球
        ball.x = bumper.x + nx * minDist;
        ball.y = bumper.y + ny * minDist;

        // 反弹（使用 bumper 弹性系数）
        const dotProduct = ball.vx * nx + ball.vy * ny;
        ball.vx = (ball.vx - 2 * dotProduct * nx) * BUMPER_RESTITUTION;
        ball.vy = (ball.vy - 2 * dotProduct * ny) * BUMPER_RESTITUTION;

        // 速度限制
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > MAX_BALL_SPEED) {
          const scale = MAX_BALL_SPEED / speed;
          ball.vx *= scale;
          ball.vy *= scale;
        }

        // 计分
        this.registerHit(bumper.score);

        // 碰撞闪烁
        bumper.hitTimer = BUMPER_HIT_DURATION;

        // 产生粒子
        this.spawnParticles(bumper.x, bumper.y, bumper.color);
      }
    }
  }

  /**
   * 弹珠与挡板碰撞（圆-线段碰撞）
   * @param ball - 弹珠对象
   */
  private collideWithFlippers(ball: Ball): void {
    for (const flipper of this._flippers) {
      // 挡板端点
      const endX = flipper.x + Math.cos(flipper.angle) * flipper.length;
      const endY = flipper.y + Math.sin(flipper.angle) * flipper.length;

      // 球到线段最近点
      const closest = this.closestPointOnSegment(
        ball.x, ball.y,
        flipper.x, flipper.y,
        endX, endY
      );

      const dx = ball.x - closest.x;
      const dy = ball.y - closest.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = ball.radius + flipper.width / 2;

      if (dist < minDist && dist > 0) {
        // 法线
        const nx = dx / dist;
        const ny = dy / dist;

        // 分离
        ball.x = closest.x + nx * minDist;
        ball.y = closest.y + ny * minDist;

        // 反弹
        const dotProduct = ball.vx * nx + ball.vy * ny;
        ball.vx -= 2 * dotProduct * nx;
        ball.vy -= 2 * dotProduct * ny;

        // 如果挡板正在翻转，给球额外速度
        const angleDiff = flipper.targetAngle - flipper.angle;
        if (Math.abs(angleDiff) > 0.05) {
          const flipSpeed = 5;
          // 挡板翻转给球额外向上的力
          const flipForce = -flipSpeed;
          ball.vy += flipForce * Math.abs(angleDiff) * 10;
          ball.vx += (flipper.side === 'left' ? 1 : -1) * flipSpeed * Math.abs(angleDiff) * 3;
        }

        // 弹性
        ball.vx *= RESTITUTION;
        ball.vy *= RESTITUTION;
      }
    }
  }

  /**
   * 弹珠与得分通道碰撞
   * @param ball - 弹珠对象
   */
  private collideWithScoreLanes(ball: Ball): void {
    for (const lane of this._scoreLanes) {
      if (lane.hitTimer > 0) continue;

      if (
        ball.x + ball.radius > lane.x &&
        ball.x - ball.radius < lane.x + lane.width &&
        ball.y + ball.radius > lane.y &&
        ball.y - ball.radius < lane.y + lane.height
      ) {
        lane.hitTimer = 30;
        this.registerHit(lane.score);
        this.spawnParticles(
          lane.x + lane.width / 2,
          lane.y,
          lane.color
        );
      }
    }
  }

  /**
   * 弹珠与线段墙壁碰撞（圆-线段碰撞）
   * @param ball - 弹珠对象
   */
  private collideWithLineWalls(ball: Ball): void {
    for (const wall of this._walls) {
      const closest = this.closestPointOnSegment(
        ball.x, ball.y,
        wall.x1, wall.y1,
        wall.x2, wall.y2
      );

      const dx = ball.x - closest.x;
      const dy = ball.y - closest.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ball.radius && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;

        // 分离
        ball.x = closest.x + nx * ball.radius;
        ball.y = closest.y + ny * ball.radius;

        // 反弹
        const dotProduct = ball.vx * nx + ball.vy * ny;
        ball.vx -= 2 * dotProduct * nx;
        ball.vy -= 2 * dotProduct * ny;

        ball.vx *= WALL_RESTITUTION;
        ball.vy *= WALL_RESTITUTION;
      }
    }
  }

  // ========== 辅助方法 ==========

  /**
   * 激活挡板（上抬）
   * @param side - 'left' 或 'right'
   */
  private activateFlipper(side: 'left' | 'right'): void {
    const flipper = this._flippers.find(f => f.side === side);
    if (flipper) {
      if (side === 'left') {
        flipper.targetAngle = FLIPPER_ACTIVE_ANGLE;
      } else {
        flipper.targetAngle = Math.PI - FLIPPER_ACTIVE_ANGLE;
      }
    }
  }

  /**
   * 停用挡板（回落）
   * @param side - 'left' 或 'right'
   */
  private deactivateFlipper(side: 'left' | 'right'): void {
    const flipper = this._flippers.find(f => f.side === side);
    if (flipper) {
      if (side === 'left') {
        flipper.targetAngle = FLIPPER_REST_ANGLE;
      } else {
        flipper.targetAngle = Math.PI - FLIPPER_REST_ANGLE;
      }
    }
  }

  /**
   * 注册一次碰撞命中，更新连击和分数
   * @param baseScore - 基础分值
   */
  private registerHit(baseScore: number): void {
    // 更新连击
    this._comboCount++;
    this._comboTimer = COMBO_TIMEOUT;
    this._comboMultiplier = Math.min(
      COMBO_MULTIPLIER_BASE + this._comboCount * COMBO_MULTIPLIER_STEP,
      MAX_COMBO_MULTIPLIER
    );

    // 计算最终分数
    const finalScore = Math.round(baseScore * this._comboMultiplier);
    this.addScore(finalScore);
  }

  /**
   * 在指定位置产生粒子特效
   * @param x - 粒子中心 X
   * @param y - 粒子中心 Y
   * @param color - 粒子颜色
   */
  private spawnParticles(x: number, y: number, color: string): void {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * PARTICLE_MAX_SPEED;
      this._particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: PARTICLE_LIFE,
        maxLife: PARTICLE_LIFE,
        color,
        size: PARTICLE_MIN_SIZE + Math.random() * (PARTICLE_MAX_SIZE - PARTICLE_MIN_SIZE),
      });
    }
  }

  /**
   * 计算点到线段的最近点
   * @param px - 点 X
   * @param py - 点 Y
   * @param ax - 线段起点 X
   * @param ay - 线段起点 Y
   * @param bx - 线段终点 X
   * @param by - 线段终点 Y
   * @returns 最近点坐标
   */
  private closestPointOnSegment(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number
  ): { x: number; y: number } {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;

    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) return { x: ax, y: ay };

    let t = (apx * abx + apy * aby) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    return {
      x: ax + t * abx,
      y: ay + t * aby,
    };
  }

  // ========== 渲染方法 ==========

  /** 渲染墙壁 */
  private renderWalls(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 3;

    // 左墙
    ctx.beginPath();
    ctx.moveTo(TABLE_LEFT, TABLE_TOP);
    ctx.lineTo(TABLE_LEFT, CANVAS_HEIGHT);
    ctx.stroke();

    // 右墙（到发射器通道）
    ctx.beginPath();
    ctx.moveTo(TABLE_RIGHT, TABLE_TOP);
    ctx.lineTo(TABLE_RIGHT, CANVAS_HEIGHT);
    ctx.stroke();

    // 顶部
    ctx.beginPath();
    ctx.moveTo(TABLE_LEFT, TABLE_TOP);
    ctx.lineTo(TABLE_RIGHT, TABLE_TOP);
    ctx.stroke();

    // 线段墙壁
    ctx.strokeStyle = RAIL_COLOR;
    ctx.lineWidth = 4;
    for (const wall of this._walls) {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    }
  }

  /** 渲染底部排水口 */
  private renderDrain(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = DRAIN_COLOR;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(
      LEFT_FLIPPER_X - 10,
      FLIPPER_Y + 20,
      RIGHT_FLIPPER_X - LEFT_FLIPPER_X + 20,
      CANVAS_HEIGHT - FLIPPER_Y - 20
    );
    ctx.globalAlpha = 1;
  }

  /** 渲染得分通道 */
  private renderScoreLanes(ctx: CanvasRenderingContext2D): void {
    for (const lane of this._scoreLanes) {
      ctx.fillStyle = lane.hitTimer > 0 ? '#ffffff' : lane.color;
      ctx.fillRect(lane.x, lane.y, lane.width, lane.height);

      // 发光效果
      if (lane.hitTimer > 0) {
        ctx.globalAlpha = lane.hitTimer / 30;
        ctx.fillStyle = lane.color;
        ctx.fillRect(lane.x - 2, lane.y - 2, lane.width + 4, lane.height + 4);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** 渲染 bumpers */
  private renderBumpers(ctx: CanvasRenderingContext2D): void {
    for (const bumper of this._bumpers) {
      const isHit = bumper.hitTimer > 0;
      const scale = isHit ? 1.2 : 1;

      // 外圈发光
      if (isHit) {
        ctx.globalAlpha = bumper.hitTimer / BUMPER_HIT_DURATION;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bumper.x, bumper.y, bumper.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 主体
      ctx.fillStyle = isHit ? '#ffffff' : bumper.color;
      ctx.beginPath();
      ctx.arc(bumper.x, bumper.y, bumper.radius * scale, 0, Math.PI * 2);
      ctx.fill();

      // 边框
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bumper.x, bumper.y, bumper.radius * scale, 0, Math.PI * 2);
      ctx.stroke();

      // 分数文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(bumper.score), bumper.x, bumper.y);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /** 渲染挡板 */
  private renderFlippers(ctx: CanvasRenderingContext2D): void {
    for (const flipper of this._flippers) {
      const endX = flipper.x + Math.cos(flipper.angle) * flipper.length;
      const endY = flipper.y + Math.sin(flipper.angle) * flipper.length;

      // 挡板主体
      ctx.strokeStyle = FLIPPER_COLOR;
      ctx.lineWidth = flipper.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(flipper.x, flipper.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // 枢轴点
      ctx.fillStyle = FLIPPER_PIVOT_COLOR;
      ctx.beginPath();
      ctx.arc(flipper.x, flipper.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = 'butt';
  }

  /** 渲染弹珠 */
  private renderBalls(ctx: CanvasRenderingContext2D): void {
    for (const ball of this._balls) {
      if (!ball.active) continue;

      // 球体
      ctx.fillStyle = BALL_COLOR;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // 高光
      ctx.fillStyle = BALL_HIGHLIGHT;
      ctx.beginPath();
      ctx.arc(ball.x - 2, ball.y - 2, ball.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 渲染粒子 */
  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this._particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** 渲染发射器 */
  private renderLauncher(ctx: CanvasRenderingContext2D): void {
    // 发射器通道
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(
      TABLE_RIGHT,
      TABLE_TOP,
      CANVAS_WIDTH - TABLE_RIGHT,
      CANVAS_HEIGHT - TABLE_TOP
    );

    // 力度条
    if (this._launcherCharging || this._launcherPower > 0) {
      const barHeight = 100;
      const barY = LAUNCHER_Y - barHeight - 10;
      const filledHeight = (this._launcherPower / LAUNCHER_MAX_POWER) * barHeight;

      // 背景
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(LAUNCHER_X - 8, barY, 16, barHeight);

      // 填充
      const ratio = this._launcherPower / LAUNCHER_MAX_POWER;
      const r = Math.round(118 + ratio * 137);
      const g = Math.round(255 - ratio * 200);
      const b = Math.round(3 + ratio * 60);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(
        LAUNCHER_X - 8,
        barY + barHeight - filledHeight,
        16,
        filledHeight
      );

      // 边框
      ctx.strokeStyle = LAUNCHER_COLOR;
      ctx.lineWidth = 1;
      ctx.strokeRect(LAUNCHER_X - 8, barY, 16, barHeight);
    }

    // 弹簧
    ctx.fillStyle = FLIPPER_COLOR;
    const springY = LAUNCHER_Y - 5;
    ctx.fillRect(LAUNCHER_X - 6, springY - 10 - this._launcherPower * 2, 12, 10);
  }

  /** 渲染 HUD 信息 */
  private renderHUD(ctx: CanvasRenderingContext2D, _w: number): void {
    ctx.fillStyle = HUD_COLOR;
    ctx.font = '14px monospace';

    // 分数
    ctx.fillText(`Score: ${this._score}`, 10, 25);

    // 等级
    ctx.fillText(`Level: ${this._level}`, 160, 25);

    // 生命
    ctx.fillText(`Lives: ${this._lives}`, 280, 25);

    // 连击
    if (this._comboCount > 1) {
      ctx.fillStyle = '#ffeb3b';
      ctx.fillText(`Combo x${this._comboMultiplier.toFixed(1)}`, 380, 25);
    }

    // 活跃球数
    if (this.activeBallCount > 1) {
      ctx.fillStyle = '#76ff03';
      ctx.fillText(`Balls: ${this.activeBallCount}`, 380, 45);
    }
  }
}
