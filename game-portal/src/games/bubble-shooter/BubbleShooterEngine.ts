/**
 * BubbleShooterEngine — 泡泡龙游戏引擎
 *
 * 六角网格（偶数行偏移），顶部预填彩色泡泡
 * 底部发射器，左右键瞄准角度，空格发射
 * 同色3连消除，消除后悬挂泡泡掉落
 * 泡泡堆到底部线则游戏结束
 * 等级越高颜色越多
 */
import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BUBBLE_RADIUS, BUBBLE_DIAMETER,
  COLS, ROW_HEIGHT, INITIAL_ROWS,
  SHOOTER_X, SHOOTER_Y, SHOOTER_SPEED, AIM_SPEED,
  MIN_ANGLE, MAX_ANGLE,
  DEAD_LINE_Y,
  BUBBLE_COLORS,
  getColorsForLevel,
  POP_SCORE, DROP_SCORE, MIN_MATCH,
  BG_COLOR, SHOOTER_COLOR, DEAD_LINE_COLOR,
} from './constants';

// ======================== 类型定义 ========================

/** 网格中的泡泡 */
export interface Bubble {
  row: number;
  col: number;
  colorIdx: number;
}

/** 飞行中的泡泡 */
export interface Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  colorIdx: number;
}

/** 掉落动画泡泡 */
export interface FallingBubble {
  x: number;
  y: number;
  vy: number;
  colorIdx: number;
}

/** 消除动画泡泡 */
export interface PopBubble {
  x: number;
  y: number;
  colorIdx: number;
  timer: number;
}

// ======================== 工具函数 ========================

/** 获取网格坐标的像素中心 */
export function getPixelPos(row: number, col: number): { x: number; y: number } {
  const offset = row % 2 === 0 ? 0 : BUBBLE_RADIUS;
  return {
    x: col * BUBBLE_DIAMETER + BUBBLE_RADIUS + offset,
    y: row * ROW_HEIGHT + BUBBLE_RADIUS,
  };
}

/** 获取某行最大列数 */
export function getMaxCols(row: number): number {
  return row % 2 === 0 ? COLS : COLS - 1;
}

/** 判断坐标是否在网格内 */
export function isValidCell(row: number, col: number): boolean {
  if (row < 0) return false;
  return col >= 0 && col < getMaxCols(row);
}

/** 获取六角邻居（偶数行偏移） */
export function getNeighbors(row: number, col: number): [number, number][] {
  const even = row % 2 === 0;
  const offsets = even
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  return (offsets as [number, number][]).map(([dr, dc]) => [row + dr, col + dc]);
}

/** 两点像素距离 */
export function pixelDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// ======================== 引擎主体 ========================

export class BubbleShooterEngine extends GameEngine {
  // ---------- 网格 ----------
  private _grid: (Bubble | null)[][] = [];

  // ---------- 发射器 ----------
  private _aimAngle: number = -Math.PI / 2;
  private _leftPressed: boolean = false;
  private _rightPressed: boolean = false;
  private _canShoot: boolean = true;

  // ---------- 当前/下一个泡泡 ----------
  private _currentColorIdx: number = 0;
  private _nextColorIdx: number = 1;

  // ---------- 飞行泡泡 ----------
  private _projectile: Projectile | null = null;

  // ---------- 动画 ----------
  private _fallingBubbles: FallingBubble[] = [];
  private _popBubbles: PopBubble[] = [];
  private _animating: boolean = false;

  // ---------- 统计 ----------
  private _shotsFired: number = 0;
  private _bubblesPopped: number = 0;

  // ======================== 公开 Getters ========================

  get grid(): (Bubble | null)[][] {
    return this._grid;
  }

  get aimAngle(): number {
    return this._aimAngle;
  }

  get projectile(): Projectile | null {
    return this._projectile;
  }

  get currentColorIdx(): number {
    return this._currentColorIdx;
  }

  get nextColorIdx(): number {
    return this._nextColorIdx;
  }

  get canShoot(): boolean {
    return this._canShoot;
  }

  get shotsFired(): number {
    return this._shotsFired;
  }

  get bubblesPopped(): number {
    return this._bubblesPopped;
  }

  get fallingBubbles(): FallingBubble[] {
    return this._fallingBubbles;
  }

  get popBubbles(): PopBubble[] {
    return this._popBubbles;
  }

  get animating(): boolean {
    return this._animating;
  }

  // ======================== 生命周期 ========================

  protected onInit(): void {
    this._grid = [];
    this._aimAngle = -Math.PI / 2;
    this._projectile = null;
    this._fallingBubbles = [];
    this._popBubbles = [];
    this._animating = false;
    this._canShoot = true;
    this._leftPressed = false;
    this._rightPressed = false;
    this._shotsFired = 0;
    this._bubblesPopped = 0;
  }

  protected onStart(): void {
    this._grid = [];
    this._aimAngle = -Math.PI / 2;
    this._projectile = null;
    this._fallingBubbles = [];
    this._popBubbles = [];
    this._animating = false;
    this._canShoot = true;
    this._leftPressed = false;
    this._rightPressed = false;
    this._shotsFired = 0;
    this._bubblesPopped = 0;

    this.populateGrid();
    this.prepareNextBubble();
  }

  protected update(deltaTime: number): void {
    // 更新瞄准角度
    if (this._canShoot && !this._projectile) {
      if (this._leftPressed) {
        this._aimAngle = Math.max(MIN_ANGLE, this._aimAngle - AIM_SPEED);
      }
      if (this._rightPressed) {
        this._aimAngle = Math.min(MAX_ANGLE, this._aimAngle + AIM_SPEED);
      }
    }

    // 更新飞行泡泡
    if (this._projectile) {
      this.updateProjectile();
    }

    // 更新动画
    this.updateAnimations(deltaTime);

    // 检查 gameover
    if (!this._animating && !this._projectile) {
      this.checkGameOver();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 死亡线
    ctx.strokeStyle = DEAD_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, DEAD_LINE_Y);
    ctx.lineTo(w, DEAD_LINE_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 网格泡泡
    for (const row of this._grid) {
      for (const bubble of row) {
        if (!bubble) continue;
        const { x, y } = getPixelPos(bubble.row, bubble.col);
        ctx.fillStyle = BUBBLE_COLORS[bubble.colorIdx] ?? '#888';
        ctx.beginPath();
        ctx.arc(x, y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
        ctx.fill();
        // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(x - 4, y - 4, BUBBLE_RADIUS * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 消除动画
    for (const pb of this._popBubbles) {
      const alpha = Math.max(0, pb.timer / 300);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = BUBBLE_COLORS[pb.colorIdx] ?? '#888';
      ctx.beginPath();
      ctx.arc(pb.x, pb.y, BUBBLE_RADIUS * (1 + (1 - alpha) * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 掉落动画
    for (const fb of this._fallingBubbles) {
      ctx.fillStyle = BUBBLE_COLORS[fb.colorIdx] ?? '#888';
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 飞行泡泡
    if (this._projectile) {
      ctx.fillStyle = BUBBLE_COLORS[this._projectile.colorIdx] ?? '#888';
      ctx.beginPath();
      ctx.arc(this._projectile.x, this._projectile.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 发射器底座
    ctx.fillStyle = SHOOTER_COLOR;
    ctx.beginPath();
    ctx.arc(SHOOTER_X, SHOOTER_Y, BUBBLE_RADIUS + 4, 0, Math.PI * 2);
    ctx.fill();

    // 发射器方向指示
    const lineLen = 40;
    ctx.strokeStyle = SHOOTER_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(SHOOTER_X, SHOOTER_Y);
    ctx.lineTo(
      SHOOTER_X + Math.cos(this._aimAngle) * lineLen,
      SHOOTER_Y + Math.sin(this._aimAngle) * lineLen,
    );
    ctx.stroke();

    // 当前泡泡
    if (this._canShoot && !this._projectile) {
      ctx.fillStyle = BUBBLE_COLORS[this._currentColorIdx] ?? '#888';
      ctx.beginPath();
      ctx.arc(SHOOTER_X, SHOOTER_Y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 下一个泡泡预览
    ctx.fillStyle = BUBBLE_COLORS[this._nextColorIdx] ?? '#888';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(SHOOTER_X + 50, SHOOTER_Y, BUBBLE_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this._score}`, 10, 24);
    ctx.textAlign = 'right';
    ctx.fillText(`Level: ${this._level}`, w - 10, 24);
    ctx.textAlign = 'left';

    // Gameover
    if (this._status === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ef5350';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', w / 2, h / 2 - 20);
      ctx.font = '20px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Score: ${this._score}`, w / 2, h / 2 + 20);
      ctx.textAlign = 'left';
    }
  }

  protected onReset(): void {
    this._grid = [];
    this._aimAngle = -Math.PI / 2;
    this._projectile = null;
    this._fallingBubbles = [];
    this._popBubbles = [];
    this._animating = false;
    this._canShoot = true;
    this._leftPressed = false;
    this._rightPressed = false;
    this._shotsFired = 0;
    this._bubblesPopped = 0;
  }

  protected onGameOver(): void {}

  // ======================== 输入处理 ========================

  handleKeyDown(key: string): void {
    if (key === 'ArrowLeft') this._leftPressed = true;
    if (key === 'ArrowRight') this._rightPressed = true;

    if (key === ' ' || key === 'Space') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      } else if (this._status === 'playing') {
        this.shoot();
      }
    }
  }

  handleKeyUp(key: string): void {
    if (key === 'ArrowLeft') this._leftPressed = false;
    if (key === 'ArrowRight') this._rightPressed = false;
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      aimAngle: this._aimAngle,
      currentColorIdx: this._currentColorIdx,
      nextColorIdx: this._nextColorIdx,
      canShoot: this._canShoot,
      projectile: this._projectile,
      shotsFired: this._shotsFired,
      bubblesPopped: this._bubblesPopped,
      gridRowCount: this._grid.length,
    };
  }

  // ======================== 核心逻辑 ========================

  /** 填充初始网格 */
  populateGrid(): void {
    const numColors = getColorsForLevel(this._level);
    this._grid = [];
    for (let r = 0; r < INITIAL_ROWS; r++) {
      const maxCols = getMaxCols(r);
      const row: (Bubble | null)[] = [];
      for (let c = 0; c < maxCols; c++) {
        row.push({
          row: r,
          col: c,
          colorIdx: Math.floor(Math.random() * numColors),
        });
      }
      this._grid.push(row);
    }
  }

  /** 准备下一个泡泡 */
  prepareNextBubble(): void {
    const numColors = getColorsForLevel(this._level);
    if (this._nextColorIdx < 0) {
      this._currentColorIdx = this.pickRandomColor(numColors);
    } else {
      this._currentColorIdx = this._nextColorIdx;
    }
    this._nextColorIdx = this.pickRandomColor(numColors);
  }

  /** 从当前网格中存在的颜色中随机选一个，如果没有则随机 */
  pickRandomColor(numColors: number): number {
    const existing = this.getExistingColorIndices();
    if (existing.length > 0) {
      return existing[Math.floor(Math.random() * existing.length)];
    }
    return Math.floor(Math.random() * numColors);
  }

  /** 获取网格中所有存在的颜色索引 */
  getExistingColorIndices(): number[] {
    const set = new Set<number>();
    for (const row of this._grid) {
      for (const bubble of row) {
        if (bubble) set.add(bubble.colorIdx);
      }
    }
    return [...set].sort();
  }

  /** 发射泡泡 */
  shoot(): void {
    if (!this._canShoot || this._projectile || this._animating) return;
    if (this._status !== 'playing') return;

    this._projectile = {
      x: SHOOTER_X,
      y: SHOOTER_Y,
      dx: Math.cos(this._aimAngle) * SHOOTER_SPEED,
      dy: Math.sin(this._aimAngle) * SHOOTER_SPEED,
      colorIdx: this._currentColorIdx,
    };
    this._canShoot = false;
    this._shotsFired++;
  }

  /** 更新飞行泡泡位置 */
  updateProjectile(): void {
    if (!this._projectile) return;
    const p = this._projectile;

    p.x += p.dx;
    p.y += p.dy;

    // 左右墙壁反弹
    if (p.x - BUBBLE_RADIUS <= 0) {
      p.x = BUBBLE_RADIUS;
      p.dx = Math.abs(p.dx);
    }
    if (p.x + BUBBLE_RADIUS >= CANVAS_WIDTH) {
      p.x = CANVAS_WIDTH - BUBBLE_RADIUS;
      p.dx = -Math.abs(p.dx);
    }

    // 碰到顶部
    if (p.y - BUBBLE_RADIUS <= 0) {
      p.y = BUBBLE_RADIUS;
      this.snapProjectile();
      return;
    }

    // 碰到网格泡泡
    if (this.checkGridCollision()) {
      return;
    }
  }

  /** 检查飞行泡泡与网格泡泡碰撞 */
  checkGridCollision(): boolean {
    if (!this._projectile) return false;
    const p = this._projectile;

    for (const row of this._grid) {
      for (const bubble of row) {
        if (!bubble) continue;
        const { x, y } = getPixelPos(bubble.row, bubble.col);
        if (pixelDist(p.x, p.y, x, y) < BUBBLE_DIAMETER - 2) {
          this.snapProjectile();
          return true;
        }
      }
    }
    return false;
  }

  /** 将飞行泡泡吸附到网格 */
  snapProjectile(): void {
    if (!this._projectile) return;
    const p = this._projectile;

    // 找到最近的空网格位置
    const { row, col } = this.findNearestEmptyCell(p.x, p.y);
    if (!isValidCell(row, col)) {
      // 如果无效，放弃这个泡泡
      this._projectile = null;
      this._canShoot = true;
      this.prepareNextBubble();
      return;
    }

    // 添加泡泡到网格
    this.addBubbleToGrid(row, col, p.colorIdx);

    // 清除飞行泡泡
    this._projectile = null;

    // 尝试消除
    const matched = this.findConnectedSameColor(row, col);
    if (matched.length >= MIN_MATCH) {
      // 消除匹配泡泡
      this.removeBubbles(matched);
      this._bubblesPopped += matched.length;
      this.addScore(matched.length * POP_SCORE);

      // 消除动画
      for (const [r, c] of matched) {
        const pos = getPixelPos(r, c);
        this._popBubbles.push({ x: pos.x, y: pos.y, colorIdx: p.colorIdx, timer: 300 });
      }

      // 寻找悬挂泡泡
      const floating = this.findFloatingBubbles();
      if (floating.length > 0) {
        this._bubblesPopped += floating.length;
        this.addScore(floating.length * DROP_SCORE);

        // 掉落动画
        for (const [r, c] of floating) {
          const b = this.getBubbleAt(r, c);
          if (b) {
            const pos = getPixelPos(r, c);
            this._fallingBubbles.push({ x: pos.x, y: pos.y, vy: 0, colorIdx: b.colorIdx });
          }
        }
        this.removeBubbles(floating);
      }

      this._animating = true;

      // 检查是否升级
      if (this.isGridEmpty()) {
        this.advanceLevel();
      }
    }

    this._canShoot = true;
    this.prepareNextBubble();
  }

  /** 找到最近的空网格位置 */
  findNearestEmptyCell(px: number, py: number): { row: number; col: number } {
    let bestRow = -1;
    let bestCol = -1;
    let bestDist = Infinity;

    // 搜索范围：当前网格行数 + 3
    const maxSearchRow = this._grid.length + 3;
    for (let r = 0; r < maxSearchRow; r++) {
      const maxCols = getMaxCols(r);
      for (let c = 0; c < maxCols; c++) {
        // 跳过已占用的格子
        if (this.getBubbleAt(r, c) !== null) continue;

        // 必须有邻居（非空）或者是第 0 行
        if (r > 0 && !this.hasOccupiedNeighbor(r, c)) continue;

        const { x, y } = getPixelPos(r, c);
        const d = pixelDist(px, py, x, y);
        if (d < bestDist) {
          bestDist = d;
          bestRow = r;
          bestCol = c;
        }
      }
    }

    return { row: bestRow, col: bestCol };
  }

  /** 检查是否有已占用的邻居 */
  hasOccupiedNeighbor(row: number, col: number): boolean {
    for (const [nr, nc] of getNeighbors(row, col)) {
      if (this.getBubbleAt(nr, nc) !== null) return true;
    }
    return false;
  }

  /** 获取网格中指定位置的泡泡 */
  getBubbleAt(row: number, col: number): Bubble | null {
    if (row < 0 || row >= this._grid.length) return null;
    if (col < 0 || col >= this._grid[row].length) return null;
    return this._grid[row][col];
  }

  /** 添加泡泡到网格 */
  addBubbleToGrid(row: number, col: number, colorIdx: number): void {
    // 扩展网格行数
    while (this._grid.length <= row) {
      const r = this._grid.length;
      const maxCols = getMaxCols(r);
      const newRow: (Bubble | null)[] = [];
      for (let c = 0; c < maxCols; c++) {
        newRow.push(null);
      }
      this._grid.push(newRow);
    }

    if (col >= 0 && col < this._grid[row].length) {
      this._grid[row][col] = { row, col, colorIdx };
    }
  }

  /** BFS 查找同色连通泡泡 */
  findConnectedSameColor(row: number, col: number): [number, number][] {
    const bubble = this.getBubbleAt(row, col);
    if (!bubble) return [];

    const targetColor = bubble.colorIdx;
    const visited = new Set<string>();
    const result: [number, number][] = [];
    const queue: [number, number][] = [[row, col]];
    visited.add(`${row},${col}`);

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      const b = this.getBubbleAt(r, c);
      if (!b || b.colorIdx !== targetColor) continue;

      result.push([r, c]);

      for (const [nr, nc] of getNeighbors(r, c)) {
        const key = `${nr},${nc}`;
        if (!visited.has(key)) {
          visited.add(key);
          const nb = this.getBubbleAt(nr, nc);
          if (nb && nb.colorIdx === targetColor) {
            queue.push([nr, nc]);
          }
        }
      }
    }

    return result;
  }

  /** 查找悬挂泡泡（不与顶行连通的泡泡） */
  findFloatingBubbles(): [number, number][] {
    // BFS 从第 0 行开始，标记所有连通到顶的泡泡
    const connected = new Set<string>();
    const queue: [number, number][] = [];

    // 从第 0 行所有非空泡泡开始
    if (this._grid.length > 0) {
      for (let c = 0; c < this._grid[0].length; c++) {
        if (this._grid[0][c] !== null) {
          const key = `0,${c}`;
          connected.add(key);
          queue.push([0, c]);
        }
      }
    }

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      for (const [nr, nc] of getNeighbors(r, c)) {
        const key = `${nr},${nc}`;
        if (!connected.has(key) && this.getBubbleAt(nr, nc) !== null) {
          connected.add(key);
          queue.push([nr, nc]);
        }
      }
    }

    // 收集所有不连通的泡泡
    const floating: [number, number][] = [];
    for (let r = 0; r < this._grid.length; r++) {
      for (let c = 0; c < this._grid[r].length; c++) {
        if (this._grid[r][c] !== null && !connected.has(`${r},${c}`)) {
          floating.push([r, c]);
        }
      }
    }

    return floating;
  }

  /** 从网格中移除泡泡列表 */
  removeBubbles(cells: [number, number][]): void {
    for (const [r, c] of cells) {
      if (r >= 0 && r < this._grid.length && c >= 0 && c < this._grid[r].length) {
        this._grid[r][c] = null;
      }
    }
  }

  /** 检查网格是否为空 */
  isGridEmpty(): boolean {
    for (const row of this._grid) {
      for (const bubble of row) {
        if (bubble !== null) return false;
      }
    }
    return true;
  }

  /** 检查游戏是否结束 */
  checkGameOver(): void {
    for (const row of this._grid) {
      for (const bubble of row) {
        if (!bubble) continue;
        const { y } = getPixelPos(bubble.row, bubble.col);
        if (y + BUBBLE_RADIUS >= DEAD_LINE_Y) {
          this.gameOver();
          return;
        }
      }
    }
  }

  /** 升级 */
  advanceLevel(): void {
    this.setLevel(this._level + 1);
    this.populateGrid();
    this.prepareNextBubble();
  }

  /** 更新动画效果 */
  updateAnimations(deltaTime: number): void {
    // 消除动画
    this._popBubbles = this._popBubbles.filter((pb) => {
      pb.timer -= deltaTime;
      return pb.timer > 0;
    });

    // 掉落动画
    this._fallingBubbles = this._fallingBubbles.filter((fb) => {
      fb.vy += 0.5; // 重力
      fb.y += fb.vy;
      return fb.y < CANVAS_HEIGHT + BUBBLE_RADIUS * 2;
    });

    // 动画结束
    if (this._animating && this._popBubbles.length === 0 && this._fallingBubbles.length === 0) {
      this._animating = false;
    }
  }
}
