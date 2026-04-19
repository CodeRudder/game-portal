import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BALL_RADIUS, BALL_DIAMETER,
  SHOOTER_X, SHOOTER_Y,
  SHOOTER_LENGTH, SHOOTER_ROTATE_SPEED,
  SHOT_SPEED,
  CHAIN_SPEED_BASE, CHAIN_SPEED_PER_LEVEL,
  INITIAL_COLOR_COUNT, MAX_COLOR_COUNT, COLORS_PER_LEVELS,
  MIN_MATCH, BASE_SCORE_PER_BALL, COMBO_MULTIPLIER,
  INITIAL_CHAIN_LENGTH, CHAIN_LENGTH_PER_LEVEL, MAX_CHAIN_LENGTH,
  PATH_POINTS_COUNT,
  BALL_COLORS, BALL_COLOR_NAMES,
  BG_COLOR, TRACK_COLOR, SHOOTER_COLOR, SHOOTER_RING_COLOR,
  TEXT_COLOR, SCORE_COLOR, END_ZONE_DISTANCE,
} from './constants';

// ========== 内部类型 ==========

/** 路径上的一个点 */
interface PathPoint {
  x: number;
  y: number;
}

/** 链中的一个球 */
interface ChainBall {
  /** 颜色索引 */
  colorIndex: number;
  /** 在路径上的位置索引（浮点数，表示精确位置） */
  pathIndex: number;
}

/** 射出的球 */
interface ShotBall {
  x: number;
  y: number;
  dx: number;
  dy: number;
  colorIndex: number;
  alive: boolean;
}

/** 消除结果 */
interface MatchResult {
  matched: ChainBall[];
  matchStart: number;
  matchEnd: number;
}

// ========== 螺旋路径生成 ==========

/**
 * 生成螺旋路径点数组
 * 使用阿基米德螺旋线，从外圈向内圈收缩
 */
export function generateSpiralPath(
  centerX: number,
  centerY: number,
  startRadius: number,
  endRadius: number,
  turns: number,
  pointCount: number
): PathPoint[] {
  const points: PathPoint[] = [];
  const radiusRange = startRadius - endRadius;
  const totalAngle = turns * 2 * Math.PI;

  for (let i = 0; i < pointCount; i++) {
    const t = i / (pointCount - 1);
    const angle = totalAngle * t;
    const radius = startRadius - radiusRange * t;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    points.push({ x, y });
  }

  return points;
}

/**
 * 获取默认祖玛螺旋路径
 * 路径从画布左侧外部开始，螺旋进入中心
 */
export function generateDefaultPath(): PathPoint[] {
  return generateSpiralPath(
    SHOOTER_X,     // 中心X
    SHOOTER_Y,     // 中心Y
    260,           // 起始半径（较大，从外圈开始）
    40,            // 结束半径（较小，靠近中心）
    2.5,           // 螺旋圈数
    PATH_POINTS_COUNT
  );
}

/**
 * 根据路径索引获取坐标
 */
export function getPathPosition(path: PathPoint[], index: number): PathPoint {
  const clampedIndex = Math.max(0, Math.min(path.length - 1, index));
  const floorIdx = Math.floor(clampedIndex);
  const ceilIdx = Math.min(floorIdx + 1, path.length - 1);
  const frac = clampedIndex - floorIdx;

  return {
    x: path[floorIdx].x + (path[ceilIdx].x - path[floorIdx].x) * frac,
    y: path[floorIdx].y + (path[ceilIdx].y - path[floorIdx].y) * frac,
  };
}

/**
 * 计算两点之间的距离
 */
export function distance(p1: PathPoint, p2: PathPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 在路径上找到距离给定点最近的路径索引
 */
export function findNearestPathIndex(path: PathPoint[], point: PathPoint): number {
  let minDist = Infinity;
  let nearestIdx = 0;

  for (let i = 0; i < path.length; i++) {
    const d = distance(path[i], point);
    if (d < minDist) {
      minDist = d;
      nearestIdx = i;
    }
  }

  return nearestIdx;
}

/**
 * 在球链中找到距离给定点最近的球索引
 */
export function findNearestBallIndex(
  path: PathPoint[],
  chain: ChainBall[],
  point: PathPoint
): number {
  if (chain.length === 0) return -1;

  let minDist = Infinity;
  let nearestIdx = 0;

  for (let i = 0; i < chain.length; i++) {
    const ballPos = getPathPosition(path, chain[i].pathIndex);
    const d = distance(ballPos, point);
    if (d < minDist) {
      minDist = d;
      nearestIdx = i;
    }
  }

  return nearestIdx;
}

// ========== 消除检测 ==========

/**
 * 检测球链中从指定位置开始的同色连续球
 */
export function findMatchAt(
  chain: ChainBall[],
  index: number
): MatchResult | null {
  if (index < 0 || index >= chain.length) return null;

  const color = chain[index].colorIndex;

  // 向前查找
  let start = index;
  while (start > 0 && chain[start - 1].colorIndex === color) {
    start--;
  }

  // 向后查找
  let end = index;
  while (end < chain.length - 1 && chain[end + 1].colorIndex === color) {
    end++;
  }

  const matchCount = end - start + 1;
  if (matchCount >= MIN_MATCH) {
    return {
      matched: chain.slice(start, end + 1),
      matchStart: start,
      matchEnd: end,
    };
  }

  return null;
}

/**
 * 检查消除后是否产生新的连锁（前后同色连接）
 */
export function checkChainReaction(
  chain: ChainBall[],
  removalStart: number
): MatchResult | null {
  if (chain.length === 0) return null;

  // 消除后 removalStart 位置变成了新的相邻点
  // 检查 removalStart-1 和 removalStart 是否同色
  const checkIdx = Math.min(removalStart, chain.length - 1);
  if (checkIdx < 0) return null;

  return findMatchAt(chain, checkIdx);
}

// ========== 球链管理 ==========

/**
 * 生成随机颜色索引
 */
export function randomColorIndex(maxColors: number): number {
  return Math.floor(Math.random() * maxColors);
}

/**
 * 生成初始球链
 */
export function generateInitialChain(
  length: number,
  maxColors: number
): ChainBall[] {
  const chain: ChainBall[] = [];
  for (let i = 0; i < length; i++) {
    chain.push({
      colorIndex: randomColorIndex(maxColors),
      pathIndex: i * BALL_DIAMETER,
    });
  }
  return chain;
}

/**
 * 移动球链（所有球沿路径前进）
 */
export function advanceChain(
  chain: ChainBall[],
  speed: number,
  maxPathIndex: number
): boolean {
  for (const ball of chain) {
    ball.pathIndex += speed;
  }

  // 检查是否有球到达终点
  if (chain.length > 0) {
    const lastBall = chain[chain.length - 1];
    if (lastBall.pathIndex >= maxPathIndex - END_ZONE_DISTANCE) {
      return true; // 到达终点
    }
  }

  return false;
}

/**
 * 将射出的球插入球链中指定位置
 */
export function insertBallIntoChain(
  chain: ChainBall[],
  insertIndex: number,
  colorIndex: number,
  path: PathPoint[]
): ChainBall[] {
  // 确定插入位置的路径索引
  let insertPathIndex: number;

  if (chain.length === 0) {
    insertPathIndex = 0;
  } else if (insertIndex >= chain.length) {
    // 插入到链尾
    insertPathIndex = chain[chain.length - 1].pathIndex + BALL_DIAMETER;
  } else if (insertIndex <= 0) {
    // 插入到链头
    insertPathIndex = chain[0].pathIndex - BALL_DIAMETER;
  } else {
    // 插入到两个球之间
    const prevPathIndex = chain[insertIndex - 1].pathIndex;
    const nextPathIndex = chain[insertIndex].pathIndex;
    insertPathIndex = (prevPathIndex + nextPathIndex) / 2;
  }

  const newBall: ChainBall = {
    colorIndex,
    pathIndex: insertPathIndex,
  };

  // 插入球
  const newChain = [...chain];
  newChain.splice(insertIndex, 0, newBall);

  // 重新排列路径索引，确保间距一致
  reorderChainIndices(newChain, insertIndex, path);

  return newChain;
}

/**
 * 重新排列球链的路径索引，确保球之间间距为 BALL_DIAMETER
 */
export function reorderChainIndices(
  chain: ChainBall[],
  fromIndex: number,
  _path: PathPoint[]
): void {
  if (chain.length === 0) return;

  // 从插入位置向前调整
  for (let i = fromIndex - 1; i >= 0; i--) {
    const expectedIndex = chain[i + 1].pathIndex - BALL_DIAMETER;
    if (chain[i].pathIndex > expectedIndex) {
      chain[i].pathIndex = expectedIndex;
    }
  }

  // 从插入位置向后调整
  for (let i = fromIndex + 1; i < chain.length; i++) {
    const expectedIndex = chain[i - 1].pathIndex + BALL_DIAMETER;
    if (chain[i].pathIndex < expectedIndex) {
      chain[i].pathIndex = expectedIndex;
    }
  }
}

/**
 * 从球链中移除指定范围的球
 */
export function removeBallsFromChain(
  chain: ChainBall[],
  start: number,
  end: number
): ChainBall[] {
  return chain.filter((_, i) => i < start || i > end);
}

// ========== 计分 ==========

/**
 * 计算消除得分
 */
export function calculateScore(
  matchCount: number,
  comboLevel: number
): number {
  const baseScore = matchCount * BASE_SCORE_PER_BALL;
  const multiplier = Math.pow(COMBO_MULTIPLIER, comboLevel);
  return Math.round(baseScore * multiplier);
}

/**
 * 获取当前关卡颜色数量
 */
export function getColorCountForLevel(level: number): number {
  return Math.min(
    INITIAL_COLOR_COUNT + Math.floor((level - 1) / COLORS_PER_LEVELS),
    MAX_COLOR_COUNT
  );
}

/**
 * 获取当前关卡球链长度
 */
export function getChainLengthForLevel(level: number): number {
  return Math.min(
    INITIAL_CHAIN_LENGTH + (level - 1) * CHAIN_LENGTH_PER_LEVEL,
    MAX_CHAIN_LENGTH
  );
}

/**
 * 获取当前关卡球链速度
 */
export function getChainSpeedForLevel(level: number): number {
  return CHAIN_SPEED_BASE + (level - 1) * CHAIN_SPEED_PER_LEVEL;
}

// ========== ZumaEngine ==========

export class ZumaEngine extends GameEngine {
  // ========== 游戏状态 ==========

  /** 螺旋路径 */
  private _path: PathPoint[] = [];

  /** 球链 */
  private _chain: ChainBall[] = [];

  /** 射出的球 */
  private _shotBall: ShotBall | null = null;

  /** 发射器角度 */
  private _shooterAngle: number = -Math.PI / 2; // 初始朝上

  /** 当前球颜色 */
  private _currentBallColor: number = 0;

  /** 下一个球颜色 */
  private _nextBallColor: number = 1;

  /** 颜色数量 */
  private _colorCount: number = INITIAL_COLOR_COUNT;

  /** 按键状态 */
  private _keys: Set<string> = new Set();

  /** 连锁计数 */
  private _comboCount: number = 0;

  /** 是否正在处理消除 */
  private _isProcessing: boolean = false;

  /** 关卡球链长度 */
  private _levelChainLength: number = INITIAL_CHAIN_LENGTH;

  /** 是否胜利 */
  private _isWin: boolean = false;

  /** 消除动画计时 */
  private _eliminationTimer: number = 0;

  /** 待消除的球索引 */
  private _pendingRemoval: { start: number; end: number } | null = null;

  /** 关卡完成标记 */
  private _levelComplete: boolean = false;

  /** 已发射球数 */
  private _shotsFired: number = 0;

  /** 总消除球数 */
  private _totalEliminated: number = 0;

  // ========== 属性 ==========

  get chain(): ChainBall[] { return this._chain; }
  get path(): PathPoint[] { return this._path; }
  get shooterAngle(): number { return this._shooterAngle; }
  get currentBallColor(): number { return this._currentBallColor; }
  get nextBallColor(): number { return this._nextBallColor; }
  get colorCount(): number { return this._colorCount; }
  get comboCount(): number { return this._comboCount; }
  get isWin(): boolean { return this._isWin; }
  get shotBall(): ShotBall | null { return this._shotBall; }
  get shotsFired(): number { return this._shotsFired; }
  get totalEliminated(): number { return this._totalEliminated; }
  get isProcessing(): boolean { return this._isProcessing; }
  get levelComplete(): boolean { return this._levelComplete; }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this._path = generateDefaultPath();
    this._shooterAngle = -Math.PI / 2;
    this._currentBallColor = 0;
    this._nextBallColor = 1;
    this._colorCount = INITIAL_COLOR_COUNT;
    this._chain = [];
    this._shotBall = null;
    this._comboCount = 0;
    this._isProcessing = false;
    this._isWin = false;
    this._eliminationTimer = 0;
    this._pendingRemoval = null;
    this._levelComplete = false;
    this._shotsFired = 0;
    this._totalEliminated = 0;
    this._keys.clear();
  }

  protected onStart(): void {
    this._colorCount = getColorCountForLevel(this._level);
    this._levelChainLength = getChainLengthForLevel(this._level);
    this._chain = generateInitialChain(this._levelChainLength, this._colorCount);
    this._shotBall = null;
    this._comboCount = 0;
    this._isProcessing = false;
    this._isWin = false;
    this._eliminationTimer = 0;
    this._pendingRemoval = null;
    this._levelComplete = false;
    this._shotsFired = 0;
    this._totalEliminated = 0;
    this._currentBallColor = randomColorIndex(this._colorCount);
    this._nextBallColor = randomColorIndex(this._colorCount);
    this._shooterAngle = -Math.PI / 2;
  }

  protected update(deltaTime: number): void {
    // 处理按键输入
    this.handleInput();

    // 处理消除动画
    if (this._isProcessing) {
      this._eliminationTimer -= deltaTime;
      if (this._eliminationTimer <= 0) {
        this.processElimination();
      }
      return; // 消除动画期间暂停其他逻辑
    }

    // 移动球链
    const speed = getChainSpeedForLevel(this._level);
    const reachedEnd = advanceChain(this._chain, speed, this._path.length);
    if (reachedEnd) {
      this.gameOver();
      return;
    }

    // 移动射出的球
    this.updateShotBall();

    // 检查关卡完成
    if (this._chain.length === 0 && this._shotBall === null && !this._isProcessing) {
      this.onLevelComplete();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 绘制轨道
    this.renderTrack(ctx);

    // 绘制球链
    this.renderChain(ctx);

    // 绘制射出的球
    this.renderShotBall(ctx);

    // 绘制发射器
    this.renderShooter(ctx);

    // 绘制HUD
    this.renderHUD(ctx, w, h);
  }

  protected onReset(): void {
    this.onInit();
  }

  protected onGameOver(): void {
    this._isWin = false;
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    this._keys.add(key);

    if (key === ' ' && this._status === 'playing') {
      this.shoot();
    }

    if (key === 'ArrowUp' && this._status === 'playing') {
      this.swapBallColors();
    }

    if (key === 'ArrowDown' && this._status === 'playing') {
      this.swapBallColors();
    }
  }

  handleKeyUp(key: string): void {
    this._keys.delete(key);
  }

  getState(): Record<string, unknown> {
    return {
      chain: this._chain.map(b => ({ colorIndex: b.colorIndex, pathIndex: b.pathIndex })),
      shooterAngle: this._shooterAngle,
      currentBallColor: this._currentBallColor,
      nextBallColor: this._nextBallColor,
      colorCount: this._colorCount,
      comboCount: this._comboCount,
      isWin: this._isWin,
      level: this._level,
      score: this._score,
      shotsFired: this._shotsFired,
      totalEliminated: this._totalEliminated,
    };
  }

  // ========== 游戏逻辑 ==========

  private handleInput(): void {
    if (this._keys.has('ArrowLeft')) {
      this._shooterAngle -= SHOOTER_ROTATE_SPEED;
    }
    if (this._keys.has('ArrowRight')) {
      this._shooterAngle += SHOOTER_ROTATE_SPEED;
    }

    // 限制角度范围
    this._shooterAngle = Math.max(-Math.PI, Math.min(0, this._shooterAngle));
  }

  /**
   * 发射球
   */
  shoot(): void {
    if (this._shotBall !== null && this._shotBall.alive) return;
    if (this._isProcessing) return;

    this._shotBall = {
      x: SHOOTER_X,
      y: SHOOTER_Y,
      dx: Math.cos(this._shooterAngle) * SHOT_SPEED,
      dy: Math.sin(this._shooterAngle) * SHOT_SPEED,
      colorIndex: this._currentBallColor,
      alive: true,
    };

    this._shotsFired++;

    // 切换到下一个球
    this._currentBallColor = this._nextBallColor;
    this._nextBallColor = randomColorIndex(this._colorCount);
  }

  /**
   * 交换当前球和下一个球的颜色
   */
  swapBallColors(): void {
    const temp = this._currentBallColor;
    this._currentBallColor = this._nextBallColor;
    this._nextBallColor = temp;
  }

  /**
   * 更新射出的球
   */
  private updateShotBall(): void {
    if (!this._shotBall || !this._shotBall.alive) return;

    this._shotBall.x += this._shotBall.dx;
    this._shotBall.y += this._shotBall.dy;

    // 边界检测（左右反弹）
    if (this._shotBall.x <= BALL_RADIUS || this._shotBall.x >= CANVAS_WIDTH - BALL_RADIUS) {
      this._shotBall.dx = -this._shotBall.dx;
      this._shotBall.x = Math.max(BALL_RADIUS, Math.min(CANVAS_WIDTH - BALL_RADIUS, this._shotBall.x));
    }

    // 上边界检测
    if (this._shotBall.y <= BALL_RADIUS) {
      this._shotBall.dy = -this._shotBall.dy;
      this._shotBall.y = BALL_RADIUS;
    }

    // 下边界检测（超出画布则消失）
    if (this._shotBall.y >= CANVAS_HEIGHT + BALL_RADIUS) {
      this._shotBall.alive = false;
      this._shotBall = null;
      return;
    }

    // 碰撞检测：与球链中的球
    this.checkShotCollision();
  }

  /**
   * 检查射出球与球链的碰撞
   */
  private checkShotCollision(): void {
    if (!this._shotBall || !this._shotBall.alive) return;
    if (this._chain.length === 0) return;

    const shotPos: PathPoint = { x: this._shotBall.x, y: this._shotBall.y };

    // 找到最近的球
    const nearestIdx = findNearestBallIndex(this._path, this._chain, shotPos);
    if (nearestIdx < 0) return;

    const ballPos = getPathPosition(this._path, this._chain[nearestIdx].pathIndex);
    const d = distance(shotPos, ballPos);

    if (d <= BALL_DIAMETER) {
      // 碰撞！插入球到链中
      this.insertShot(nearestIdx, this._shotBall.colorIndex);
      this._shotBall = null;
    }
  }

  /**
   * 将射出的球插入球链并触发消除检测
   */
  private insertShot(nearestIdx: number, colorIndex: number): void {
    // 决定插入位置（在最近球的前面还是后面）
    const shotPos: PathPoint = { x: this._shotBall!.x, y: this._shotBall!.y };
    let insertIdx: number;

    if (nearestIdx === 0) {
      // 在第一个球前面还是后面
      const firstBallPos = getPathPosition(this._path, this._chain[0].pathIndex);
      const d = distance(shotPos, firstBallPos);
      if (d <= BALL_RADIUS) {
        insertIdx = 0; // 插入到前面
      } else {
        insertIdx = 1; // 插入到后面
      }
    } else {
      const ballPos = getPathPosition(this._path, this._chain[nearestIdx].pathIndex);
      const prevPos = getPathPosition(this._path, this._chain[nearestIdx - 1].pathIndex);
      const dToBall = distance(shotPos, ballPos);
      const dToPrev = distance(shotPos, prevPos);

      if (dToPrev < dToBall) {
        insertIdx = nearestIdx; // 插入到最近球的前面
      } else {
        insertIdx = nearestIdx + 1; // 插入到最近球的后面
      }
    }

    // 插入球
    this._chain = insertBallIntoChain(this._chain, insertIdx, colorIndex, this._path);

    // 检测消除
    this._comboCount = 0;
    this.checkAndStartElimination(insertIdx);
  }

  /**
   * 检测并开始消除
   */
  private checkAndStartElimination(checkIndex: number): void {
    const match = findMatchAt(this._chain, checkIndex);
    if (match) {
      // 开始消除动画
      this._isProcessing = true;
      this._eliminationTimer = 100; // 100ms 消除动画
      this._pendingRemoval = { start: match.matchStart, end: match.matchEnd };
    }
  }

  /**
   * 执行消除
   */
  private processElimination(): void {
    if (!this._pendingRemoval) {
      this._isProcessing = false;
      return;
    }

    const { start, end } = this._pendingRemoval;
    const matchCount = end - start + 1;

    // 加分
    const score = calculateScore(matchCount, this._comboCount);
    this.addScore(score);
    this._totalEliminated += matchCount;

    // 移除球
    this._chain = removeBallsFromChain(this._chain, start, end);
    this._pendingRemoval = null;
    this._comboCount++;

    // 检查连锁消除
    const chainMatch = checkChainReaction(this._chain, start);
    if (chainMatch) {
      this._pendingRemoval = { start: chainMatch.matchStart, end: chainMatch.matchEnd };
      this._eliminationTimer = 100;
    } else {
      this._isProcessing = false;
      this._comboCount = 0;
    }
  }

  /**
   * 关卡完成
   */
  private onLevelComplete(): void {
    if (this._levelComplete) return;
    this._levelComplete = true;

    // 进入下一关
    const nextLevel = this._level + 1;
    this.setLevel(nextLevel);

    // 重新开始新关卡
    this._colorCount = getColorCountForLevel(nextLevel);
    this._levelChainLength = getChainLengthForLevel(nextLevel);
    this._chain = generateInitialChain(this._levelChainLength, this._colorCount);
    this._shotBall = null;
    this._comboCount = 0;
    this._isProcessing = false;
    this._eliminationTimer = 0;
    this._pendingRemoval = null;
    this._levelComplete = false;
    this._currentBallColor = randomColorIndex(this._colorCount);
    this._nextBallColor = randomColorIndex(this._colorCount);
  }

  // ========== 渲染 ==========

  private renderTrack(ctx: CanvasRenderingContext2D): void {
    if (this._path.length < 2) return;

    ctx.strokeStyle = TRACK_COLOR;
    ctx.lineWidth = BALL_DIAMETER + 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this._path[0].x, this._path[0].y);
    for (let i = 1; i < this._path.length; i++) {
      ctx.lineTo(this._path[i].x, this._path[i].y);
    }
    ctx.stroke();
  }

  private renderChain(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this._chain.length; i++) {
      const ball = this._chain[i];
      const pos = getPathPosition(this._path, ball.pathIndex);

      // 检查是否在待消除列表中
      let alpha = 1;
      if (this._pendingRemoval && i >= this._pendingRemoval.start && i <= this._pendingRemoval.end) {
        alpha = 0.5; // 消除动画效果
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = BALL_COLORS[ball.colorIndex] || '#ffffff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // 球的高光效果
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(pos.x - 3, pos.y - 3, BALL_RADIUS * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    }
  }

  private renderShotBall(ctx: CanvasRenderingContext2D): void {
    if (!this._shotBall || !this._shotBall.alive) return;

    ctx.fillStyle = BALL_COLORS[this._shotBall.colorIndex] || '#ffffff';
    ctx.beginPath();
    ctx.arc(this._shotBall.x, this._shotBall.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(this._shotBall.x - 3, this._shotBall.y - 3, BALL_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderShooter(ctx: CanvasRenderingContext2D): void {
    // 外圈
    ctx.strokeStyle = SHOOTER_RING_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(SHOOTER_X, SHOOTER_Y, 25, 0, Math.PI * 2);
    ctx.stroke();

    // 发射方向
    const endX = SHOOTER_X + Math.cos(this._shooterAngle) * SHOOTER_LENGTH;
    const endY = SHOOTER_Y + Math.sin(this._shooterAngle) * SHOOTER_LENGTH;

    ctx.strokeStyle = SHOOTER_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(SHOOTER_X, SHOOTER_Y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // 当前球（发射器中心）
    ctx.fillStyle = BALL_COLORS[this._currentBallColor] || '#ffffff';
    ctx.beginPath();
    ctx.arc(SHOOTER_X, SHOOTER_Y, BALL_RADIUS - 2, 0, Math.PI * 2);
    ctx.fill();

    // 下一个球（小预览）
    ctx.fillStyle = BALL_COLORS[this._nextBallColor] || '#ffffff';
    ctx.beginPath();
    ctx.arc(SHOOTER_X + 30, SHOOTER_Y + 30, 8, 0, Math.PI * 2);
    ctx.fill();

    // "NEXT" 标签
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', SHOOTER_X + 30, SHOOTER_Y + 48);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    // 顶部信息
    ctx.fillStyle = SCORE_COLOR;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`分数: ${this._score}`, 10, 25);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '14px monospace';
    ctx.fillText(`关卡: ${this._level}`, 10, 45);

    ctx.fillText(`颜色: ${this._colorCount}`, w - 100, 25);
    ctx.fillText(`球数: ${this._chain.length}`, w - 100, 45);

    // 连锁提示
    if (this._comboCount > 1) {
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`连锁 x${this._comboCount}!`, w / 2, 25);
    }
  }

  // ========== 公共方法（用于测试和外部调用） ==========

  /**
   * 设置球链（用于测试）
   */
  setChain(chain: ChainBall[]): void {
    this._chain = chain;
  }

  /**
   * 设置发射器角度
   */
  setShooterAngle(angle: number): void {
    this._shooterAngle = angle;
  }

  /**
   * 设置当前球颜色
   */
  setCurrentBallColor(colorIndex: number): void {
    this._currentBallColor = colorIndex;
  }

  /**
   * 设置下一个球颜色
   */
  setNextBallColor(colorIndex: number): void {
    this._nextBallColor = colorIndex;
  }

  /**
   * 设置颜色数量
   */
  setColorCount(count: number): void {
    this._colorCount = count;
  }

  /**
   * 手动触发射击（用于测试）
   */
  forceShoot(angle: number, colorIndex: number): void {
    this._shooterAngle = angle;
    this._currentBallColor = colorIndex;
    this.shoot();
  }

  /**
   * 手动设置射出的球（用于测试）
   */
  setShotBall(ball: ShotBall | null): void {
    this._shotBall = ball;
  }

  /**
   * 手动设置处理状态
   */
  setProcessing(processing: boolean): void {
    this._isProcessing = processing;
  }

  /**
   * 获取当前关卡球链长度
   */
  get levelChainLength(): number {
    return this._levelChainLength;
  }
}
