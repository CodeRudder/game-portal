import { GameStatus, IGameEngine } from '@/types';

type EventCallback = (...args: any[]) => void;

export abstract class GameEngine implements IGameEngine {
  protected canvas: HTMLCanvasElement | null = null;
  protected ctx: CanvasRenderingContext2D | null = null;
  protected animationId: number | null = null;
  protected lastTime: number = 0;
  protected _score: number = 0;
  protected _level: number = 1;
  protected _status: GameStatus = 'idle';
  protected _startTime: number = 0;
  protected _elapsedTime: number = 0;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  // ========== 事件系统 ==========

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  protected emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  // ========== 属性 ==========

  get score(): number { return this._score; }
  get level(): number { return this._level; }
  get status(): GameStatus { return this._status; }
  get elapsedTime(): number { return this._elapsedTime; }

  // ========== 生命周期 ==========

  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  init(canvas?: HTMLCanvasElement): void {
    if (canvas) this.setCanvas(canvas);
    this.onInit();
  }

  // 游戏循环核心
  private gameLoop = (timestamp: number): void => {
    if (this._status !== 'playing') return;

    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    this._elapsedTime = (timestamp - this._startTime) / 1000;

    this.update(deltaTime);
    this.render();

    this.animationId = requestAnimationFrame(this.gameLoop);
  };

  start(): void {
    if (!this.canvas || !this.ctx) throw new Error('Canvas not initialized');
    this._status = 'playing';
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._startTime = now;
    this.lastTime = now;
    this._score = 0;
    this._level = 1;
    this.onStart();
    this.emit('statusChange', 'playing');
    this.emit('scoreChange', 0);
    this.emit('levelChange', 1);
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  pause(): void {
    if (this._status !== 'playing') return;
    this._status = 'paused';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.onPause();
    this.emit('statusChange', 'paused');
  }

  resume(): void {
    if (this._status !== 'paused') return;
    if (!this.canvas || !this.ctx) throw new Error('Canvas not initialized');
    this._status = 'playing';
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.onResume();
    this.emit('statusChange', 'playing');
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  reset(): void {
    this._status = 'idle';
    this._score = 0;
    this._level = 1;
    this._elapsedTime = 0;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.onReset();
    this.emit('statusChange', 'idle');
    this.emit('scoreChange', 0);
    this.emit('levelChange', 1);
  }

  destroy(): void {
    this.reset();
    this.onDestroy();
    this.listeners.clear();
  }

  protected gameOver(): void {
    this._status = 'gameover';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.onGameOver();
    this.emit('statusChange', 'gameover');
  }

  protected render(): void {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.onRender(this.ctx, this.canvas.width, this.canvas.height);
  }

  // 分数更新辅助
  protected addScore(points: number): void {
    this._score += points;
    this.emit('scoreChange', this._score);
  }

  protected setLevel(level: number): void {
    this._level = level;
    this.emit('levelChange', this._level);
  }

  // ========== 子类实现 ==========

  protected abstract onInit(): void;
  protected abstract onStart(): void;
  protected abstract update(deltaTime: number): void;
  protected abstract onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  protected onPause(): void {}
  protected onResume(): void {}
  protected onReset(): void {}
  protected onDestroy(): void {}
  protected onGameOver(): void {}

  // ========== 鼠标事件（子类可选覆盖） ==========

  handleClick(canvasX: number, canvasY: number): void {}
  handleMouseDown(canvasX: number, canvasY: number): void {}
  handleMouseUp(canvasX: number, canvasY: number): void {}
  handleMouseMove(canvasX: number, canvasY: number): void {}
  handleRightClick(canvasX: number, canvasY: number): void {}
  handleDoubleClick(canvasX: number, canvasY: number): void {}

  abstract handleKeyDown(key: string): void;
  abstract handleKeyUp(key: string): void;
  abstract getState(): Record<string, unknown>;
}
