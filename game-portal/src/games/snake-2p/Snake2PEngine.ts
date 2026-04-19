import { GameEngine } from '@/core/GameEngine';
import {
  COLS, ROWS, CELL_SIZE,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  INITIAL_LENGTH, SNAKE_SPEED, SPEED_INCREMENT, MIN_SPEED,
  FOOD_SCORE, SPECIAL_FOOD_SCORE, SPECIAL_FOOD_CHANCE, SPECIAL_FOOD_TTL,
  MAX_FOOD_ON_BOARD,
  BG_COLOR, GRID_COLOR,
  SNAKE1_COLOR, SNAKE1_HEAD_COLOR,
  SNAKE2_COLOR, SNAKE2_HEAD_COLOR,
  FOOD_COLOR, SPECIAL_FOOD_COLOR,
  HUD_COLOR,
  DIRECTIONS,
  P1_START_X, P1_START_Y, P1_START_DIR,
  P2_START_X, P2_START_Y, P2_START_DIR,
} from './constants';
import type { Direction } from './constants';

// ========== 类型定义 ==========

/** 坐标点 */
interface Point {
  x: number;
  y: number;
}

/** 食物类型 */
type FoodType = 'normal' | 'special';

/** 食物 */
interface Food {
  position: Point;
  type: FoodType;
  createdAt: number; // 游戏内时间戳（毫秒）
}

/** 蛇 */
interface Snake {
  body: Point[];
  direction: Direction;
  nextDirection: Direction;
  alive: boolean;
  score: number;
  speed: number;       // 当前移动间隔（毫秒）
  moveAccum: number;    // 移动累积时间
}

/** 游戏结果 */
export type GameResult = 'p1_win' | 'p2_win' | 'draw' | null;

// ========== 引擎实现 ==========

export class Snake2PEngine extends GameEngine {
  // 两条蛇
  private _snake1!: Snake;
  private _snake2!: Snake;

  // 食物列表
  private _foods: Food[] = [];

  // 游戏结果
  private _result: GameResult = null;

  // 游戏内时钟（毫秒）
  private _gameTime: number = 0;

  // 随机数生成（可注入，方便测试）
  private _rng: () => number = Math.random;

  // ========== Public Getters ==========

  get snake1(): Snake { return this._snake1; }
  get snake2(): Snake { return this._snake2; }
  get foods(): Food[] { return this._foods; }
  get result(): GameResult { return this._result; }
  get gameTime(): number { return this._gameTime; }
  get p1Score(): number { return this._snake1?.score ?? 0; }
  get p2Score(): number { return this._snake2?.score ?? 0; }
  get p1Alive(): boolean { return this._snake1?.alive ?? false; }
  get p2Alive(): boolean { return this._snake2?.alive ?? false; }

  // ========== 测试辅助 ==========

  /** 注入随机数生成器，用于确定性测试 */
  setRng(rng: () => number): void {
    this._rng = rng;
  }

  /** 设置食物列表（测试辅助） */
  setFoods(foods: Food[]): void {
    this._foods = foods;
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this.initSnakes();
    this._foods = [];
    this._result = null;
    this._gameTime = 0;
  }

  protected onStart(): void {
    this.initSnakes();
    this._foods = [];
    this._result = null;
    this._gameTime = 0;
    // 初始放置食物
    for (let i = 0; i < MAX_FOOD_ON_BOARD; i++) {
      this.spawnFood();
    }
  }

  protected update(deltaTime: number): void {
    this._gameTime += deltaTime;

    // 清理过期特殊食物
    this.cleanExpiredFoods();

    // 补充食物
    while (this._foods.length < MAX_FOOD_ON_BOARD) {
      this.spawnFood();
    }

    // 移动蛇
    this.moveSnake(this._snake1, deltaTime);
    this.moveSnake(this._snake2, deltaTime);

    // 碰撞检测（移动后统一检测）
    this.checkCollisions();

    // 检查游戏结束
    this.checkGameOver();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, h);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(w, y * CELL_SIZE);
      ctx.stroke();
    }

    // 食物
    for (const food of this._foods) {
      const fx = food.position.x * CELL_SIZE;
      const fy = food.position.y * CELL_SIZE;
      if (food.type === 'special') {
        ctx.fillStyle = SPECIAL_FOOD_COLOR;
        // 特殊食物画一个菱形
        ctx.beginPath();
        ctx.moveTo(fx + CELL_SIZE / 2, fy + 2);
        ctx.lineTo(fx + CELL_SIZE - 2, fy + CELL_SIZE / 2);
        ctx.lineTo(fx + CELL_SIZE / 2, fy + CELL_SIZE - 2);
        ctx.lineTo(fx + 2, fy + CELL_SIZE / 2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = FOOD_COLOR;
        ctx.beginPath();
        ctx.arc(fx + CELL_SIZE / 2, fy + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 蛇1
    this.renderSnake(ctx, this._snake1, SNAKE1_COLOR, SNAKE1_HEAD_COLOR);
    // 蛇2
    this.renderSnake(ctx, this._snake2, SNAKE2_COLOR, SNAKE2_HEAD_COLOR);

    // HUD 分数
    ctx.fillStyle = SNAKE1_COLOR;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`P1: ${this._snake1.score}`, 10, 20);

    ctx.fillStyle = SNAKE2_COLOR;
    ctx.textAlign = 'right';
    ctx.fillText(`P2: ${this._snake2.score}`, w - 10, 20);

    ctx.textAlign = 'left';

    // 游戏结束提示
    if (this._status === 'gameover') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, w, h);

      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';

      if (this._result === 'p1_win') {
        ctx.fillStyle = SNAKE1_COLOR;
        ctx.fillText('P1 WINS!', w / 2, h / 2 - 20);
      } else if (this._result === 'p2_win') {
        ctx.fillStyle = SNAKE2_COLOR;
        ctx.fillText('P2 WINS!', w / 2, h / 2 - 20);
      } else {
        ctx.fillStyle = HUD_COLOR;
        ctx.fillText('DRAW!', w / 2, h / 2 - 20);
      }

      ctx.fillStyle = HUD_COLOR;
      ctx.font = '16px monospace';
      ctx.fillText(`${this._snake1.score} : ${this._snake2.score}`, w / 2, h / 2 + 20);
      ctx.fillText('Press Space to restart', w / 2, h / 2 + 50);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this.initSnakes();
    this._foods = [];
    this._result = null;
    this._gameTime = 0;
  }

  protected onGameOver(): void {
    // 计算总分
    const totalScore = this._snake1.score + this._snake2.score;
    this.addScore(totalScore);
  }

  handleKeyDown(key: string): void {
    // 空格键：开始 / 重新开始
    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      }
      return;
    }

    // 游戏中才接受方向键
    if (this._status !== 'playing') return;

    // 玩家1 WASD
    switch (key) {
      case 'w': case 'W':
        this.setDirection(this._snake1, DIRECTIONS.UP);
        break;
      case 's': case 'S':
        this.setDirection(this._snake1, DIRECTIONS.DOWN);
        break;
      case 'a': case 'A':
        this.setDirection(this._snake1, DIRECTIONS.LEFT);
        break;
      case 'd': case 'D':
        this.setDirection(this._snake1, DIRECTIONS.RIGHT);
        break;
    }

    // 玩家2 方向键
    switch (key) {
      case 'ArrowUp':
        this.setDirection(this._snake2, DIRECTIONS.UP);
        break;
      case 'ArrowDown':
        this.setDirection(this._snake2, DIRECTIONS.DOWN);
        break;
      case 'ArrowLeft':
        this.setDirection(this._snake2, DIRECTIONS.LEFT);
        break;
      case 'ArrowRight':
        this.setDirection(this._snake2, DIRECTIONS.RIGHT);
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 贪吃蛇不需要 keyUp 逻辑，方向键是触发式
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      status: this._status,
      elapsedTime: this._elapsedTime,
      gameTime: this._gameTime,
      result: this._result,
      p1Score: this._snake1?.score ?? 0,
      p2Score: this._snake2?.score ?? 0,
      p1Alive: this._snake1?.alive ?? false,
      p2Alive: this._snake2?.alive ?? false,
      p1Length: this._snake1?.body.length ?? 0,
      p2Length: this._snake2?.body.length ?? 0,
      snake1: this._snake1?.body.map(p => ({ ...p })) ?? [],
      snake2: this._snake2?.body.map(p => ({ ...p })) ?? [],
      foods: this._foods.map(f => ({
        position: { ...f.position },
        type: f.type,
        createdAt: f.createdAt,
      })),
    };
  }

  // ========== 私有方法 ==========

  /** 初始化两条蛇 */
  private initSnakes(): void {
    this._snake1 = this.createSnake(P1_START_X, P1_START_Y, P1_START_DIR);
    this._snake2 = this.createSnake(P2_START_X, P2_START_Y, P2_START_DIR);
  }

  /** 创建一条蛇 */
  private createSnake(startX: number, startY: number, dir: Direction): Snake {
    const body: Point[] = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      body.push({
        x: startX - dir.x * i,
        y: startY - dir.y * i,
      });
    }
    return {
      body,
      direction: { ...dir },
      nextDirection: { ...dir },
      alive: true,
      score: 0,
      speed: SNAKE_SPEED,
      moveAccum: 0,
    };
  }

  /** 设置蛇的下一个方向（防止180度掉头） */
  private setDirection(snake: Snake, dir: Direction): void {
    if (!snake.alive) return;
    // 不能反向
    if (snake.direction.x + dir.x === 0 && snake.direction.y + dir.y === 0) return;
    snake.nextDirection = { ...dir };
  }

  /** 移动一条蛇（基于累积时间） */
  private moveSnake(snake: Snake, deltaTime: number): void {
    if (!snake.alive) return;

    snake.moveAccum += deltaTime;
    if (snake.moveAccum < snake.speed) return;

    snake.moveAccum -= snake.speed;
    // 防止累积过多步数（例如长时间卡顿后一次走多步）
    if (snake.moveAccum > snake.speed) {
      snake.moveAccum = 0;
    }

    // 应用方向
    snake.direction = { ...snake.nextDirection };

    // 计算新头部位置
    const head = snake.body[0];
    const newHead: Point = {
      x: head.x + snake.direction.x,
      y: head.y + snake.direction.y,
    };

    // 插入新头部
    snake.body.unshift(newHead);

    // 检查是否吃到食物
    const foodIndex = this._foods.findIndex(
      f => f.position.x === newHead.x && f.position.y === newHead.y
    );
    if (foodIndex !== -1) {
      const food = this._foods[foodIndex];
      const points = food.type === 'special' ? SPECIAL_FOOD_SCORE : FOOD_SCORE;
      snake.score += points;
      // 加速
      snake.speed = Math.max(MIN_SPEED, snake.speed - SPEED_INCREMENT);
      this._foods.splice(foodIndex, 1);
      // 不移除尾部 → 蛇变长
    } else {
      // 没吃到食物 → 移除尾部
      snake.body.pop();
    }
  }

  /** 碰撞检测 */
  private checkCollisions(): void {
    const s1 = this._snake1;
    const s2 = this._snake2;
    const head1 = s1.body[0];
    const head2 = s2.body[0];

    let p1Dead = false;
    let p2Dead = false;

    // P1 碰撞检测
    if (s1.alive) {
      // 撞墙
      if (this.isOutOfBounds(head1)) {
        p1Dead = true;
      }
      // 撞自己（从第1节开始，跳过头部）
      if (this.hitBody(head1, s1.body, 1)) {
        p1Dead = true;
      }
      // 撞对方身体（从第0节开始，包含头部碰撞）
      if (s2.alive && this.hitBody(head1, s2.body, 0)) {
        p1Dead = true;
      }
    }

    // P2 碰撞检测
    if (s2.alive) {
      // 撞墙
      if (this.isOutOfBounds(head2)) {
        p2Dead = true;
      }
      // 撞自己
      if (this.hitBody(head2, s2.body, 1)) {
        p2Dead = true;
      }
      // 撞对方身体
      if (s1.alive && this.hitBody(head2, s1.body, 0)) {
        p2Dead = true;
      }
    }

    // 头对头碰撞（同时移动到同一格）
    if (s1.alive && s2.alive && head1.x === head2.x && head1.y === head2.y) {
      p1Dead = true;
      p2Dead = true;
    }

    if (p1Dead) s1.alive = false;
    if (p2Dead) s2.alive = false;
  }

  /** 判断点是否越界 */
  private isOutOfBounds(p: Point): boolean {
    return p.x < 0 || p.x >= COLS || p.y < 0 || p.y >= ROWS;
  }

  /** 判断点是否撞到蛇身（从 fromIndex 开始检查） */
  private hitBody(p: Point, body: Point[], fromIndex: number): boolean {
    for (let i = fromIndex; i < body.length; i++) {
      if (p.x === body[i].x && p.y === body[i].y) return true;
    }
    return false;
  }

  /** 检查游戏结束 */
  private checkGameOver(): void {
    const s1Alive = this._snake1.alive;
    const s2Alive = this._snake2.alive;

    if (s1Alive && s2Alive) return; // 都活着，继续

    if (!s1Alive && !s2Alive) {
      this._result = 'draw';
    } else if (s1Alive) {
      this._result = 'p1_win';
    } else {
      this._result = 'p2_win';
    }

    this.gameOver();
  }

  /** 生成食物 */
  private spawnFood(): void {
    const occupied = this.getOccupiedSet();
    const available: Point[] = [];

    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        const key = `${x},${y}`;
        if (!occupied.has(key)) {
          available.push({ x, y });
        }
      }
    }

    if (available.length === 0) return; // 满了

    const idx = Math.floor(this._rng() * available.length);
    const position = available[idx];
    const type: FoodType = this._rng() < SPECIAL_FOOD_CHANCE ? 'special' : 'normal';

    this._foods.push({
      position,
      type,
      createdAt: this._gameTime,
    });
  }

  /** 获取所有被占据的位置集合 */
  private getOccupiedSet(): Set<string> {
    const set = new Set<string>();
    for (const seg of this._snake1.body) {
      set.add(`${seg.x},${seg.y}`);
    }
    for (const seg of this._snake2.body) {
      set.add(`${seg.x},${seg.y}`);
    }
    for (const food of this._foods) {
      set.add(`${food.position.x},${food.position.y}`);
    }
    return set;
  }

  /** 清理过期特殊食物 */
  private cleanExpiredFoods(): void {
    this._foods = this._foods.filter(
      f => !(f.type === 'special' && this._gameTime - f.createdAt > SPECIAL_FOOD_TTL)
    );
  }

  /** 渲染一条蛇 */
  private renderSnake(
    ctx: CanvasRenderingContext2D,
    snake: Snake,
    bodyColor: string,
    headColor: string
  ): void {
    if (!snake.alive && this._status === 'gameover') {
      // 死亡蛇半透明
      ctx.globalAlpha = 0.3;
    }

    for (let i = snake.body.length - 1; i >= 0; i--) {
      const seg = snake.body[i];
      const sx = seg.x * CELL_SIZE;
      const sy = seg.y * CELL_SIZE;

      ctx.fillStyle = i === 0 ? headColor : bodyColor;
      ctx.fillRect(sx + 1, sy + 1, CELL_SIZE - 2, CELL_SIZE - 2);

      // 头部加个小圆角效果
      if (i === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(sx + 3, sy + 3, CELL_SIZE - 8, CELL_SIZE - 8);
      }
    }

    ctx.globalAlpha = 1;
  }
}
