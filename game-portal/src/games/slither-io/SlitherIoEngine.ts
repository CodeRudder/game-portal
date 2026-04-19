import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  SEGMENT_RADIUS, SEGMENT_SPACING, INITIAL_LENGTH,
  SNAKE_SPEED, BOOST_SPEED, TURN_SPEED,
  BOOST_SHRINK_INTERVAL, MIN_LENGTH_FOR_BOOST,
  FOOD_RADIUS, INITIAL_FOOD_COUNT, MAX_FOOD_COUNT, FOOD_SCORE,
  AI_COUNT, AI_TURN_SPEED, AI_VISION_RANGE, AI_FOOD_VISION,
  AI_DIRECTION_CHANGE_INTERVAL, AI_INITIAL_LENGTH_MIN, AI_INITIAL_LENGTH_MAX,
  HEAD_COLLISION_RADIUS, BODY_COLLISION_RADIUS,
  PLAYER_COLORS, AI_COLORS, FOOD_COLORS,
  BORDER_MARGIN, DEATH_FOOD_RATIO,
} from './constants';

// ========== 类型定义 ==========

/** 身体段 */
export interface Segment {
  x: number;
  y: number;
}

/** 食物 */
export interface Food {
  x: number;
  y: number;
  color: string;
  radius: number;
}

/** 虫子 */
export interface Worm {
  segments: Segment[];
  angle: number;           // 当前朝向（弧度）
  speed: number;           // 当前速度
  color: string;           // 主色
  colorAlt: string;        // 辅色
  alive: boolean;
  isPlayer: boolean;
  isBoosting: boolean;
  boostTimer: number;      // 加速消耗计时器
  score: number;
  // AI 专用
  aiTimer?: number;        // AI 转向计时器
  aiTargetAngle?: number;  // AI 目标角度
}

// ========== 辅助函数 ==========

/** 生成指定范围内的随机数 */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 生成指定范围内的随机整数 */
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

/** 计算两点间距离 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 角度归一化到 [-PI, PI] */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/** 计算从 (x1,y1) 到 (x2,y2) 的角度 */
function angleTo(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** 从颜色数组中随机选择 */
function randomColor(colors: string[]): string {
  return colors[Math.floor(Math.random() * colors.length)];
}

// ========== 游戏引擎 ==========

export class SlitherIoEngine extends GameEngine {
  // 游戏状态
  private player!: Worm;
  private aiWorms: Worm[] = [];
  private foods: Food[] = [];
  private _turningLeft = false;
  private _turningRight = false;
  private _shiftHeld = false;
  private _frameCount = 0;

  // ========== 公共访问器 ==========

  get playerWorm(): Worm { return this.player; }
  get aiWormList(): Worm[] { return this.aiWorms; }
  get foodList(): Food[] { return this.foods; }
  get frameCount(): number { return this._frameCount; }
  get turningLeft(): boolean { return this._turningLeft; }
  get turningRight(): boolean { return this._turningRight; }
  get shiftHeld(): boolean { return this._shiftHeld; }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.resetGameState();
  }

  protected onStart(): void {
    this.resetGameState();
    // 设置玩家初始位置在画布中央偏下
    this.initPlayer();
    this.initAI();
    this.initFood();
    // 同步初始分数
    this.syncScore();
  }

  protected update(deltaTime: number): void {
    this._frameCount++;

    // 更新玩家虫子
    this.updatePlayer();

    // 更新 AI 虫子
    this.updateAIWorms();

    // 检测食物碰撞
    this.checkFoodCollisions();

    // 检测虫子间碰撞
    this.checkWormCollisions();

    // 检测边界碰撞
    this.checkBoundaryCollisions();

    // 补充食物
    this.replenishFood();

    // 更新分数
    this.updateScore();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // 网格
    this.renderGrid(ctx, w, h);

    // 边界
    this.renderBorder(ctx, w, h);

    // 食物
    this.renderFoods(ctx);

    // 虫子（先 AI 后玩家，玩家在最上层）
    for (const ai of this.aiWorms) {
      if (ai.alive) this.renderWorm(ctx, ai);
    }
    if (this.player.alive) {
      this.renderWorm(ctx, this.player);
    }

    // HUD
    this.renderHUD(ctx, w, h);
  }

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') {
      if (key === ' ') {
        if (this._status === 'idle' || this._status === 'gameover') {
          this.start();
        }
      }
      return;
    }

    switch (key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this._turningLeft = true;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this._turningRight = true;
        break;
      case 'Shift':
        this._shiftHeld = true;
        break;
    }
  }

  handleKeyUp(key: string): void {
    switch (key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this._turningLeft = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this._turningRight = false;
        break;
      case 'Shift':
        this._shiftHeld = false;
        break;
    }
  }

  getState(): Record<string, unknown> {
    return {
      playerScore: this._score,
      playerLength: this.player?.segments.length ?? 0,
      playerAlive: this.player?.alive ?? false,
      aiCount: this.aiWorms.filter(a => a.alive).length,
      foodCount: this.foods.length,
      frameCount: this._frameCount,
    };
  }

  protected onReset(): void {
    this.resetGameState();
  }

  protected onGameOver(): void {
    // 游戏结束处理
  }

  // ========== 游戏状态管理 ==========

  private resetGameState(): void {
    this._turningLeft = false;
    this._turningRight = false;
    this._shiftHeld = false;
    this._frameCount = 0;
    this.aiWorms = [];
    this.foods = [];

    // 创建默认玩家（会在 onStart 中被覆盖）
    this.player = this.createWorm(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT * 0.7,
      0,
      INITIAL_LENGTH,
      true,
      PLAYER_COLORS[0],
      PLAYER_COLORS[1] || PLAYER_COLORS[0],
    );
  }

  private initPlayer(): void {
    this.player = this.createWorm(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT * 0.7,
      -Math.PI / 2, // 朝上
      INITIAL_LENGTH,
      true,
      PLAYER_COLORS[0],
      PLAYER_COLORS[1] || PLAYER_COLORS[0],
    );
  }

  private initAI(): void {
    this.aiWorms = [];
    for (let i = 0; i < AI_COUNT; i++) {
      const x = rand(60, CANVAS_WIDTH - 60);
      const y = rand(60, CANVAS_HEIGHT - 60);
      const angle = rand(0, 2 * Math.PI);
      const length = randInt(AI_INITIAL_LENGTH_MIN, AI_INITIAL_LENGTH_MAX);
      const colorSet = AI_COLORS[i % AI_COLORS.length];
      const worm = this.createWorm(x, y, angle, length, false, colorSet[0], colorSet[1]);
      worm.aiTimer = randInt(0, AI_DIRECTION_CHANGE_INTERVAL);
      worm.aiTargetAngle = angle;
      this.aiWorms.push(worm);
    }
  }

  private initFood(): void {
    this.foods = [];
    for (let i = 0; i < INITIAL_FOOD_COUNT; i++) {
      this.foods.push(this.createFood());
    }
  }

  // ========== 虫子创建与操作 ==========

  createWorm(
    x: number, y: number,
    angle: number,
    length: number,
    isPlayer: boolean,
    color: string,
    colorAlt: string,
  ): Worm {
    const segments: Segment[] = [];
    for (let i = 0; i < length; i++) {
      segments.push({
        x: x - Math.cos(angle) * i * SEGMENT_SPACING,
        y: y - Math.sin(angle) * i * SEGMENT_SPACING,
      });
    }

    return {
      segments,
      angle,
      speed: SNAKE_SPEED,
      color,
      colorAlt,
      alive: true,
      isPlayer,
      isBoosting: false,
      boostTimer: 0,
      score: length,
    };
  }

  /** 移动虫子（根据当前角度和速度） */
  moveWorm(worm: Worm): void {
    if (!worm.alive) return;

    // 计算新的头部位置
    const head = worm.segments[0];
    const newX = head.x + Math.cos(worm.angle) * worm.speed;
    const newY = head.y + Math.sin(worm.angle) * worm.speed;

    // 将新头部位置插入到最前面
    worm.segments.unshift({ x: newX, y: newY });

    // 保持身体段之间的间距
    this.adjustSegments(worm);

    // 移除多余的尾部段
    if (worm.segments.length > this.getTargetLength(worm)) {
      worm.segments.pop();
    }
  }

  /** 调整身体段位置，使其保持固定间距 */
  adjustSegments(worm: Worm): void {
    for (let i = 1; i < worm.segments.length; i++) {
      const prev = worm.segments[i - 1];
      const curr = worm.segments[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > SEGMENT_SPACING) {
        const ratio = SEGMENT_SPACING / dist;
        curr.x = prev.x + dx * ratio;
        curr.y = prev.y + dy * ratio;
      }
    }
  }

  /** 获取目标身体长度 */
  getTargetLength(worm: Worm): number {
    return worm.score;
  }

  /** 转向 */
  turnWorm(worm: Worm, direction: 'left' | 'right', turnSpeed: number = TURN_SPEED): void {
    if (!worm.alive) return;
    if (direction === 'left') {
      worm.angle -= turnSpeed;
    } else {
      worm.angle += turnSpeed;
    }
    worm.angle = normalizeAngle(worm.angle);
  }

  /** 增长身体 */
  growWorm(worm: Worm, amount: number = 1): void {
    worm.score += amount;
  }

  /** 加速（消耗身体长度） */
  boostWorm(worm: Worm): boolean {
    if (!worm.alive) return false;
    if (worm.segments.length < MIN_LENGTH_FOR_BOOST) {
      worm.isBoosting = false;
      worm.speed = SNAKE_SPEED;
      return false;
    }

    worm.isBoosting = true;
    worm.speed = BOOST_SPEED;
    worm.boostTimer++;

    // 每隔一定帧数消耗一段身体
    if (worm.boostTimer >= BOOST_SHRINK_INTERVAL) {
      worm.boostTimer = 0;
      worm.score = Math.max(1, worm.score - 1);
      // 在尾部生成食物
      const tail = worm.segments[worm.segments.length - 1];
      this.foods.push(this.createFoodAt(tail.x, tail.y));
    }

    return true;
  }

  /** 停止加速 */
  stopBoost(worm: Worm): void {
    worm.isBoosting = false;
    worm.speed = SNAKE_SPEED;
    worm.boostTimer = 0;
  }

  // ========== 食物管理 ==========

  createFood(): Food {
    const margin = 20;
    return {
      x: rand(margin, CANVAS_WIDTH - margin),
      y: rand(margin, CANVAS_HEIGHT - margin),
      color: randomColor(FOOD_COLORS),
      radius: FOOD_RADIUS,
    };
  }

  createFoodAt(x: number, y: number): Food {
    return {
      x: x + rand(-5, 5),
      y: y + rand(-5, 5),
      color: randomColor(FOOD_COLORS),
      radius: FOOD_RADIUS,
    };
  }

  /** 检测食物碰撞 */
  checkFoodCollisions(): void {
    const allWorms = [this.player, ...this.aiWorms].filter(w => w.alive);

    for (const worm of allWorms) {
      const head = worm.segments[0];
      const eatRadius = SEGMENT_RADIUS + FOOD_RADIUS;

      for (let i = this.foods.length - 1; i >= 0; i--) {
        const food = this.foods[i];
        if (distance(head.x, head.y, food.x, food.y) < eatRadius) {
          // 吃到食物
          this.foods.splice(i, 1);
          this.growWorm(worm, FOOD_SCORE);
        }
      }
    }
  }

  /** 补充食物 */
  replenishFood(): void {
    while (this.foods.length < MAX_FOOD_COUNT) {
      this.foods.push(this.createFood());
    }
  }

  // ========== 碰撞检测 ==========

  /** 检测虫子间碰撞 */
  checkWormCollisions(): void {
    const allWorms = [this.player, ...this.aiWorms];

    for (const worm of allWorms) {
      if (!worm.alive) continue;

      const head = worm.segments[0];

      for (const other of allWorms) {
        if (!other.alive) continue;
        if (other === worm) continue;

        // 检查头部是否碰到其他虫子的身体（跳过前几段避免误判）
        for (let i = 2; i < other.segments.length; i++) {
          const seg = other.segments[i];
          if (distance(head.x, head.y, seg.x, seg.y) < HEAD_COLLISION_RADIUS + BODY_COLLISION_RADIUS) {
            this.killWorm(worm);
            break;
          }
        }

        if (!worm.alive) break;
      }
    }
  }

  /** 检测边界碰撞 */
  checkBoundaryCollisions(): void {
    const allWorms = [this.player, ...this.aiWorms];

    for (const worm of allWorms) {
      if (!worm.alive) continue;

      const head = worm.segments[0];
      if (
        head.x < BORDER_MARGIN ||
        head.x > CANVAS_WIDTH - BORDER_MARGIN ||
        head.y < BORDER_MARGIN ||
        head.y > CANVAS_HEIGHT - BORDER_MARGIN
      ) {
        this.killWorm(worm);
      }
    }
  }

  /** 击杀虫子 */
  killWorm(worm: Worm): void {
    worm.alive = false;

    // 虫子死亡后身体变成食物
    for (let i = 0; i < worm.segments.length; i += DEATH_FOOD_RATIO) {
      const seg = worm.segments[i];
      this.foods.push(this.createFoodAt(seg.x, seg.y));
    }

    // 如果是玩家死亡，游戏结束
    if (worm.isPlayer) {
      this.gameOver();
    } else {
      // AI 死亡后延迟重生
      this.respawnAI(worm);
    }
  }

  /** AI 重生 */
  respawnAI(worm: Worm): void {
    const x = rand(60, CANVAS_WIDTH - 60);
    const y = rand(60, CANVAS_HEIGHT - 60);
    const angle = rand(0, 2 * Math.PI);
    const length = randInt(AI_INITIAL_LENGTH_MIN, AI_INITIAL_LENGTH_MAX);

    worm.segments = [];
    for (let i = 0; i < length; i++) {
      worm.segments.push({
        x: x - Math.cos(angle) * i * SEGMENT_SPACING,
        y: y - Math.sin(angle) * i * SEGMENT_SPACING,
      });
    }
    worm.angle = angle;
    worm.speed = SNAKE_SPEED;
    worm.alive = true;
    worm.isBoosting = false;
    worm.boostTimer = 0;
    worm.score = length;
    worm.aiTimer = randInt(0, AI_DIRECTION_CHANGE_INTERVAL);
    worm.aiTargetAngle = angle;
  }

  // ========== 玩家更新 ==========

  private updatePlayer(): void {
    if (!this.player.alive) return;

    // 处理转向
    if (this._turningLeft) {
      this.turnWorm(this.player, 'left', TURN_SPEED);
    }
    if (this._turningRight) {
      this.turnWorm(this.player, 'right', TURN_SPEED);
    }

    // 处理加速
    if (this._shiftHeld) {
      this.boostWorm(this.player);
    } else {
      this.stopBoost(this.player);
    }

    // 移动
    this.moveWorm(this.player);
  }

  // ========== AI 更新 ==========

  private updateAIWorms(): void {
    for (const ai of this.aiWorms) {
      if (!ai.alive) continue;

      this.updateAIBehavior(ai);
      this.moveWorm(ai);
    }
  }

  /** AI 行为决策 */
  updateAIBehavior(ai: Worm): void {
    if (!ai.alive) return;

    const head = ai.segments[0];

    // 1. 边界回避 — 优先级最高
    const borderDist = 40;
    if (head.x < borderDist || head.x > CANVAS_WIDTH - borderDist ||
        head.y < borderDist || head.y > CANVAS_HEIGHT - borderDist) {
      // 朝画布中心转向
      const centerAngle = angleTo(head.x, head.y, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      this.aiTurnToward(ai, centerAngle);
      return;
    }

    // 2. 回避其他虫子身体
    let dangerAngle: number | null = null;
    let dangerDist = Infinity;
    const allWorms = [this.player, ...this.aiWorms];

    for (const other of allWorms) {
      if (!other.alive || other === ai) continue;
      for (let i = 0; i < other.segments.length; i++) {
        const seg = other.segments[i];
        const d = distance(head.x, head.y, seg.x, seg.y);
        if (d < AI_VISION_RANGE && d < dangerDist) {
          dangerDist = d;
          dangerAngle = angleTo(head.x, head.y, seg.x, seg.y);
        }
      }
    }

    if (dangerAngle !== null && dangerDist < AI_VISION_RANGE * 0.6) {
      // 远离危险
      const fleeAngle = dangerAngle + Math.PI;
      this.aiTurnToward(ai, fleeAngle);
      return;
    }

    // 3. 寻找附近食物
    let nearestFood: Food | null = null;
    let nearestFoodDist = Infinity;

    for (const food of this.foods) {
      const d = distance(head.x, head.y, food.x, food.y);
      if (d < AI_FOOD_VISION && d < nearestFoodDist) {
        nearestFoodDist = d;
        nearestFood = food;
      }
    }

    if (nearestFood) {
      const foodAngle = angleTo(head.x, head.y, nearestFood.x, nearestFood.y);
      this.aiTurnToward(ai, foodAngle);
      return;
    }

    // 4. 随机漫游
    ai.aiTimer = (ai.aiTimer ?? 0) + 1;
    if (ai.aiTimer >= AI_DIRECTION_CHANGE_INTERVAL) {
      ai.aiTimer = 0;
      ai.aiTargetAngle = ai.angle + rand(-Math.PI / 2, Math.PI / 2);
    }

    if (ai.aiTargetAngle !== undefined) {
      this.aiTurnToward(ai, ai.aiTargetAngle);
    }
  }

  /** AI 平滑转向 */
  aiTurnToward(ai: Worm, targetAngle: number): void {
    const diff = normalizeAngle(targetAngle - ai.angle);
    if (Math.abs(diff) < AI_TURN_SPEED) {
      ai.angle = targetAngle;
    } else if (diff > 0) {
      ai.angle += AI_TURN_SPEED;
    } else {
      ai.angle -= AI_TURN_SPEED;
    }
    ai.angle = normalizeAngle(ai.angle);
  }

  // ========== 分数更新 ==========

  private updateScore(): void {
    if (this.player.alive) {
      const newScore = this.player.score;
      if (newScore !== this._score) {
        this._score = newScore;
        this.emit('scoreChange', this._score);
      }
    }
  }

  // ========== 渲染 ==========

  /** 同步玩家分数到引擎分数（用于初始化和测试） */
  syncScore(): void {
    if (this.player && this.player.alive) {
      this._score = this.player.score;
    }
  }

  // ========== 渲染 ==========

  private renderGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  private renderBorder(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.strokeRect(BORDER_MARGIN, BORDER_MARGIN, w - BORDER_MARGIN * 2, h - BORDER_MARGIN * 2);
  }

  private renderFoods(ctx: CanvasRenderingContext2D): void {
    for (const food of this.foods) {
      ctx.beginPath();
      ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
      ctx.fillStyle = food.color;
      ctx.fill();
      // 发光效果
      ctx.beginPath();
      ctx.arc(food.x, food.y, food.radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = food.color + '44';
      ctx.fill();
    }
  }

  private renderWorm(ctx: CanvasRenderingContext2D, worm: Worm): void {
    const segments = worm.segments;

    // 绘制身体（从尾到头）
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      const isHead = i === 0;
      const radius = isHead ? SEGMENT_RADIUS + 2 : SEGMENT_RADIUS;
      const color = i % 2 === 0 ? worm.color : worm.colorAlt;

      // 身体段
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // 加速时的发光效果
      if (worm.isBoosting) {
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = worm.color + '33';
        ctx.fill();
      }

      // 绘制眼睛（头部）
      if (isHead) {
        const eyeOffset = 3;
        const eyeRadius = 2;
        const perpAngle = worm.angle + Math.PI / 2;

        // 左眼
        const lx = seg.x + Math.cos(worm.angle) * 2 + Math.cos(perpAngle) * eyeOffset;
        const ly = seg.y + Math.sin(worm.angle) * 2 + Math.sin(perpAngle) * eyeOffset;
        ctx.beginPath();
        ctx.arc(lx, ly, eyeRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(lx + Math.cos(worm.angle), ly + Math.sin(worm.angle), 1, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();

        // 右眼
        const rx = seg.x + Math.cos(worm.angle) * 2 - Math.cos(perpAngle) * eyeOffset;
        const ry = seg.y + Math.sin(worm.angle) * 2 - Math.sin(perpAngle) * eyeOffset;
        ctx.beginPath();
        ctx.arc(rx, ry, eyeRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rx + Math.cos(worm.angle), ry + Math.sin(worm.angle), 1, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
      }
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 分数
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`长度: ${this.player.score}`, 15, 30);

    // 加速提示
    if (this.player.isBoosting) {
      ctx.fillStyle = '#ffd93d';
      ctx.fillText('⚡ 加速中', 15, 50);
    }

    // AI 数量
    const aliveAI = this.aiWorms.filter(a => a.alive).length;
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`对手: ${aliveAI}`, w - 15, 30);
  }
}
