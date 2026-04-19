import { GameEngine } from '@/core/GameEngine';

const GRID_SIZE = 20;
const CELL_SIZE = 24;
const INITIAL_SPEED = 150; // ms per move
const SPEED_INCREMENT = 3; // faster per food

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Point = { x: number; y: number };

export class SnakeEngine extends GameEngine {
  private snake: Point[] = [];
  private food: Point | null = null;
  private direction: Direction = 'RIGHT';
  private nextDirection: Direction = 'RIGHT';
  private moveTimer: number = 0;
  private moveInterval: number = INITIAL_SPEED;
  private gridCols: number = GRID_SIZE;
  private gridRows: number = GRID_SIZE;

  protected onInit(): void {
    // noop
  }

  protected onStart(): void {
    this.moveInterval = INITIAL_SPEED;
    this.direction = 'RIGHT';
    this.nextDirection = 'RIGHT';
    this.moveTimer = 0;
    const midX = Math.floor(this.gridCols / 2);
    const midY = Math.floor(this.gridRows / 2);
    this.snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ];
    this.spawnFood();
  }

  protected onReset(): void {
    this.snake = [];
    this.food = null;
  }

  protected update(deltaTime: number): void {
    this.moveTimer += deltaTime;
    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer = 0;
      this.move();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const offsetX = (w - this.gridCols * CELL_SIZE) / 2;
    const offsetY = (h - this.gridRows * CELL_SIZE) / 2;

    // 背景
    ctx.fillStyle = '#0d0d20';
    ctx.fillRect(0, 0, w, h);

    // 棋盘格背景
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#0f0f25' : '#121230';
        ctx.fillRect(offsetX + c * CELL_SIZE, offsetY + r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // 食物
    if (this.food) {
      const fx = offsetX + this.food.x * CELL_SIZE + CELL_SIZE / 2;
      const fy = offsetY + this.food.y * CELL_SIZE + CELL_SIZE / 2;

      // 发光效果
      const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, CELL_SIZE);
      glow.addColorStop(0, 'rgba(255, 0, 100, 0.4)');
      glow.addColorStop(1, 'rgba(255, 0, 100, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(offsetX + this.food.x * CELL_SIZE - CELL_SIZE / 2, offsetY + this.food.y * CELL_SIZE - CELL_SIZE / 2, CELL_SIZE * 2, CELL_SIZE * 2);

      ctx.fillStyle = '#ff4757';
      ctx.beginPath();
      ctx.arc(fx, fy, CELL_SIZE / 2 - 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(fx - 2, fy - 2, CELL_SIZE / 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 蛇身
    this.snake.forEach((seg, i) => {
      const sx = offsetX + seg.x * CELL_SIZE;
      const sy = offsetY + seg.y * CELL_SIZE;
      const padding = 1;

      if (i === 0) {
        // 蛇头
        ctx.fillStyle = '#00f3ff';
        ctx.shadowColor = '#00f3ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(sx + padding, sy + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2, 6);
        ctx.fill();
        ctx.shadowBlur = 0;

        // 眼睛
        ctx.fillStyle = '#0d0d20';
        const eyeSize = 3;
        if (this.direction === 'RIGHT' || this.direction === 'LEFT') {
          const ex = this.direction === 'RIGHT' ? sx + CELL_SIZE - 8 : sx + 5;
          ctx.beginPath();
          ctx.arc(ex, sy + 8, eyeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ex, sy + CELL_SIZE - 8, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const ey = this.direction === 'DOWN' ? sy + CELL_SIZE - 8 : sy + 5;
          ctx.beginPath();
          ctx.arc(sx + 8, ey, eyeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx + CELL_SIZE - 8, ey, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // 蛇身 - 渐变色
        const ratio = 1 - (i / this.snake.length) * 0.6;
        const g = Math.round(243 * ratio);
        const b = Math.round(255 * ratio);
        ctx.fillStyle = `rgb(0, ${g}, ${b})`;
        ctx.beginPath();
        ctx.roundRect(sx + padding + 1, sy + padding + 1, CELL_SIZE - padding * 2 - 2, CELL_SIZE - padding * 2 - 2, 4);
        ctx.fill();
      }
    });

    // 边框
    ctx.strokeStyle = '#00b894';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX - 1, offsetY - 1, this.gridCols * CELL_SIZE + 2, this.gridRows * CELL_SIZE + 2);
  }

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;
    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        if (this.direction !== 'DOWN') this.nextDirection = 'UP';
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        if (this.direction !== 'UP') this.nextDirection = 'DOWN';
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        if (this.direction !== 'RIGHT') this.nextDirection = 'LEFT';
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (this.direction !== 'LEFT') this.nextDirection = 'RIGHT';
        break;
    }
  }

  handleKeyUp(_key: string): void {}

  getState(): Record<string, unknown> {
    return {
      snakeLength: this.snake.length,
    };
  }

  // ========== 私有方法 ==========

  private move(): void {
    this.direction = this.nextDirection;
    const head = { ...this.snake[0] };

    switch (this.direction) {
      case 'UP': head.y--; break;
      case 'DOWN': head.y++; break;
      case 'LEFT': head.x--; break;
      case 'RIGHT': head.x++; break;
    }

    // 碰墙
    if (head.x < 0 || head.x >= this.gridCols || head.y < 0 || head.y >= this.gridRows) {
      this.gameOver();
      return;
    }

    // 碰自己
    if (this.snake.some((s) => s.x === head.x && s.y === head.y)) {
      this.gameOver();
      return;
    }

    this.snake.unshift(head);

    // 吃食物
    if (this.food && head.x === this.food.x && head.y === this.food.y) {
      this._score += 10;
      this._level = Math.floor(this._score / 50) + 1;
      this.moveInterval = Math.max(50, INITIAL_SPEED - Math.floor(this._score / 10) * SPEED_INCREMENT);
      this.spawnFood();
    } else {
      this.snake.pop();
    }
  }

  private spawnFood(): void {
    const empty: Point[] = [];
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        if (!this.snake.some((s) => s.x === c && s.y === r)) {
          empty.push({ x: c, y: r });
        }
      }
    }
    if (empty.length === 0) {
      // 赢了！（几乎不可能）
      this.gameOver();
      return;
    }
    this.food = empty[Math.floor(Math.random() * empty.length)];
  }
}
