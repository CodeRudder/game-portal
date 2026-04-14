// ========== Mahjong Connect (连连看) 游戏引擎 ==========

import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  GRID_PADDING,
  TILE_GAP,
  TILE_RADIUS,
  LEVEL_CONFIGS,
  DEFAULT_LEVEL,
  CONNECT_ANIM_DURATION,
  REMOVE_ANIM_DURATION,
  HINT_BLINK_INTERVAL,
  HINT_DURATION,
  SCORE_BASE_MATCH,
  SCORE_COMBO_BONUS,
  SCORE_TIME_BONUS,
  SHUFFLE_PENALTY,
  HINT_PENALTY,
  COMBO_TIMEOUT,
  TILE_SYMBOLS,
  COLORS,
  MAX_SHUFFLES,
  type LevelConfig,
} from './constants';

// ========== 类型定义 ==========

/** 网格坐标点（含外围虚拟边界） */
export interface Point {
  row: number;
  col: number;
}

/** 连接路径（关键拐点列表） */
export type Path = Point[];

/** 连线动画状态 */
interface ConnectAnimation {
  /** 连接路径拐点 */
  path: Path;
  /** 已持续时间 (ms) */
  elapsed: number;
  /** 涉及的两个牌 */
  tile1: Point;
  tile2: Point;
}

/** 消除动画状态 */
interface RemoveAnimation {
  tile1: Point;
  tile2: Point;
  elapsed: number;
}

/** 提示状态 */
interface HintState {
  tile1: Point;
  tile2: Point;
  path: Path;
  elapsed: number;
  active: boolean;
}

/** 游戏内部状态快照（getState 返回值） */
export interface MahjongConnectState {
  [key: string]: unknown;
  grid: (number | null)[][];
  rows: number;
  cols: number;
  patternCount: number;
  score: number;
  level: number;
  combo: number;
  maxCombo: number;
  selectedTile: Point | null;
  aliveCount: number;
  totalTiles: number;
  removedPairs: number;
  totalPairs: number;
  shuffleCount: number;
  isWin: boolean;
  hintActive: boolean;
  noMatch: boolean;
  elapsedTime: number;
}

// ========== 工具函数 ==========

/** Fisher-Yates 洗牌算法 */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 判断两个 Point 是否相同 */
export function pointEq(a: Point, b: Point): boolean {
  return a.row === b.row && a.col === b.col;
}

// ========== Mahjong Connect 游戏引擎 ==========

export class MahjongConnectEngine extends GameEngine {
  // ========== 网格参数 ==========

  /** 网格行数 */
  private rows: number = 8;
  /** 网格列数 */
  private cols: number = 10;
  /** 图案类型数量 */
  private patternCount: number = 10;

  /**
   * 网格数据：grid[row][col] = patternType (number) 或 null（已消除/空）
   * 索引范围 [0, rows-1][0, cols-1]
   */
  private grid: (number | null)[][] = [];

  // ========== 交互状态 ==========

  /** 当前选中的牌位置 */
  private selectedTile: Point | null = null;

  /** 鼠标悬停的牌位置 */
  private hoveredTile: Point | null = null;

  /** 无效点击闪烁反馈 */
  private invalidClickFlash: { row: number; col: number; elapsed: number } | null = null;

  // ========== 动画状态 ==========

  /** 连线动画 */
  private connectAnim: ConnectAnimation | null = null;
  /** 消除动画 */
  private removeAnim: RemoveAnimation | null = null;
  /** 提示状态 */
  private hintState: HintState | null = null;

  // ========== 游戏统计 ==========

  /** 连击数 */
  private combo: number = 0;
  /** 最大连击数 */
  private maxCombo: number = 0;
  /** 上次消除时间 (performance.now ms) */
  private lastMatchTime: number = 0;
  /** 存活牌数 */
  private aliveCount: number = 0;
  /** 总牌数 */
  private totalTiles: number = 0;
  /** 已消除对数 */
  private removedPairs: number = 0;
  /** 总对数 */
  private totalPairs: number = 0;
  /** 洗牌次数 */
  private shuffleCount: number = 0;
  /** 是否胜利 */
  public isWin: boolean = false;
  /** 是否无解 */
  private noMatch: boolean = false;
  /** 是否已设置自定义网格（测试用） */
  private _customGridSet: boolean = false;

  // ========== 布局缓存 ==========

  /** 牌面像素宽度 */
  private tileW: number = 0;
  /** 牌面像素高度 */
  private tileH: number = 0;
  /** 网格区域起始 X */
  private gridOffsetX: number = 0;
  /** 网格区域起始 Y */
  private gridOffsetY: number = 0;

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.applyLevelConfig(DEFAULT_LEVEL);
    this.generateGrid();
    this.calculateLayout();
  }

  protected onStart(): void {
    if (!this._customGridSet) {
      this.generateGrid();
    }
    this.calculateLayout();
    this.isWin = false;
    this.noMatch = false;
    this.shuffleCount = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.removedPairs = 0;
    this.lastMatchTime = 0;
    this.selectedTile = null;
    this.hoveredTile = null;
    this.invalidClickFlash = null;
    this.connectAnim = null;
    this.removeAnim = null;
    this.hintState = null;
    this._customGridSet = false; // Reset flag so next start() regenerates
    this.checkNoMatch();
  }

  protected update(deltaTime: number): void {
    // 更新连线动画
    if (this.connectAnim) {
      this.connectAnim.elapsed += deltaTime;
      if (this.connectAnim.elapsed >= CONNECT_ANIM_DURATION) {
        // 连线动画结束 → 启动消除动画
        this.removeAnim = {
          tile1: this.connectAnim.tile1,
          tile2: this.connectAnim.tile2,
          elapsed: 0,
        };
        this.connectAnim = null;
      }
    }

    // 更新消除动画
    if (this.removeAnim) {
      this.removeAnim.elapsed += deltaTime;
      if (this.removeAnim.elapsed >= REMOVE_ANIM_DURATION) {
        // 消除动画结束 → 真正移除牌
        this.removeTiles(this.removeAnim.tile1, this.removeAnim.tile2);
        this.removeAnim = null;

        // 检查胜利
        if (this.aliveCount === 0) {
          this.isWin = true;
          this.gameOver();
          return;
        }

        // 检查无解
        this.checkNoMatch();
      }
    }

    // 更新提示动画
    if (this.hintState && this.hintState.active) {
      this.hintState.elapsed += deltaTime;
      if (this.hintState.elapsed >= HINT_DURATION) {
        this.hintState = null;
      }
    }

    // 检查连击超时
    if (this.combo > 0 && this.lastMatchTime > 0) {
      const now = performance.now();
      if (now - this.lastMatchTime > COMBO_TIMEOUT) {
        this.combo = 0;
      }
    }

    // 更新无效点击闪烁
    if (this.invalidClickFlash) {
      this.invalidClickFlash.elapsed += deltaTime;
      if (this.invalidClickFlash.elapsed >= 300) {
        this.invalidClickFlash = null;
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawHUD(ctx, w);
    this.drawGrid(ctx);
    this.drawConnectAnimation(ctx);
    this.drawRemoveAnimation(ctx);
    this.drawHint(ctx);

    if (this.noMatch && this._status === 'playing') {
      this.drawNoMatchOverlay(ctx, w, h);
    }

    if (this.isWin && this._status === 'gameover') {
      this.drawWinOverlay(ctx, w, h);
    }
  }

  protected onReset(): void {
    this.applyLevelConfig(DEFAULT_LEVEL);
    this.generateGrid();
    this.calculateLayout();
    this.selectedTile = null;
    this.hoveredTile = null;
    this.invalidClickFlash = null;
    this.connectAnim = null;
    this.removeAnim = null;
    this.hintState = null;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastMatchTime = 0;
    this.shuffleCount = 0;
    this.isWin = false;
    this.noMatch = false;
    this.removedPairs = 0;
  }

  protected onGameOver(): void {
    // 胜利时添加时间奖励
    if (this.isWin) {
      const timeBonus = Math.max(0, Math.floor(this._elapsedTime) * SCORE_TIME_BONUS);
      this.addScore(timeBonus);
    }
  }

  // ========== 公开方法 ==========

  /**
   * 处理画布点击事件
   * @param canvasX 画布 X 坐标
   * @param canvasY 画布 Y 坐标
   */
  handleClick(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') return;
    // Only block during remove animation (connect animation is instant for rapid clicking)
    if (this.removeAnim) return;

    // If there's a connect animation in progress, complete it immediately
    // This allows rapid consecutive clicks
    if (this.connectAnim) {
      this.removeAnim = {
        tile1: this.connectAnim.tile1,
        tile2: this.connectAnim.tile2,
        elapsed: 0,
      };
      this.connectAnim = null;
    }

    // 精确命中检测：检查点击是否在牌面矩形范围内
    const hitResult = this.hitTestTile(canvasX, canvasY);
    if (!hitResult) return;

    const { row, col } = hitResult;

    // 检查点击位置是否有牌
    if (this.grid[row][col] === null) return;

    // 清除提示
    this.hintState = null;

    const clickedPoint: Point = { row, col };

    if (this.selectedTile === null) {
      // 第一次选择
      this.selectedTile = clickedPoint;
    } else if (pointEq(this.selectedTile, clickedPoint)) {
      // 点击同一张牌 → 取消选择
      this.selectedTile = null;
    } else {
      // 第二次选择
      const t1 = this.selectedTile;
      const t2 = clickedPoint;

      if (this.grid[t1.row][t1.col] === this.grid[t2.row][t2.col]) {
        // 相同图案 → 检查路径连接
        const path = this.canConnect(t1, t2);
        if (path) {
          // 匹配成功！
          this.matchSuccess(t1, t2, path);
        } else {
          // 相同图案但不可连接 → 切换选择到新牌
          this.selectedTile = clickedPoint;
        }
      } else {
        // 不同图案 → 切换选择到新牌
        this.selectedTile = clickedPoint;
      }
    }
  }

  /**
   * 键盘按下处理
   * - H: 使用提示
   * - R: 洗牌
   * - Space: 暂停
   */
  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key.toLowerCase()) {
      case 'h':
        this.useHint();
        break;
      case 'r':
        this.shuffle();
        break;
      case ' ':
        this.pause();
        break;
    }
  }

  /** 键盘释放处理（连连看不需要） */
  handleKeyUp(_key: string): void {
    // 连连看不需要 keyUp 处理
  }

  /**
   * 处理鼠标移动：悬停高亮
   * 追踪鼠标当前悬停的牌位置
   */
  handleMouseMove(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') {
      this.hoveredTile = null;
      return;
    }

    const hitResult = this.hitTestTile(canvasX, canvasY);
    this.hoveredTile = hitResult;
  }

  /**
   * 处理鼠标双击：自动匹配（如果有唯一匹配）
   * 双击一张牌时，自动查找并匹配同类型的可连接牌
   */
  handleDoubleClick(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') return;
    if (this.removeAnim || this.connectAnim) return;

    const hitResult = this.hitTestTile(canvasX, canvasY);
    if (!hitResult) return;

    const { row, col } = hitResult;
    if (this.grid[row][col] === null) return;

    const clickedPoint: Point = { row, col };
    const patternType = this.grid[row][col]!;

    // 查找所有同类型牌
    const sameTypeTiles: Point[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === patternType && !(r === row && c === col)) {
          sameTypeTiles.push({ row: r, col: c });
        }
      }
    }

    // 尝试找到可连接的配对
    for (const other of sameTypeTiles) {
      const path = this.canConnect(clickedPoint, other);
      if (path) {
        // 清除当前选择和提示
        this.selectedTile = null;
        this.hintState = null;
        // 执行匹配
        this.matchSuccess(clickedPoint, other, path);
        return;
      }
    }

    // 没有找到可连接的配对，给无效反馈
    this.invalidClickFlash = { row, col, elapsed: 0 };
  }

  /**
   * 精确命中检测：检查画布坐标是否在某个牌面矩形范围内
   * @returns 命中的网格坐标 { row, col } 或 null
   */
  private hitTestTile(canvasX: number, canvasY: number): { row: number; col: number } | null {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === null) continue;

        const x = this.gridOffsetX + c * (this.tileW + TILE_GAP);
        const y = this.gridOffsetY + r * (this.tileH + TILE_GAP);

        if (
          canvasX >= x && canvasX < x + this.tileW &&
          canvasY >= y && canvasY < y + this.tileH
        ) {
          return { row: r, col: c };
        }
      }
    }

    return null;
  }

  /**
   * 获取游戏状态快照
   * @returns 包含所有公开状态的 MahjongConnectState 对象
   */
  getState(): MahjongConnectState {
    return {
      grid: this.grid.map(row => [...row]),
      rows: this.rows,
      cols: this.cols,
      patternCount: this.patternCount,
      score: this._score,
      level: this._level,
      combo: this.combo,
      maxCombo: this.maxCombo,
      selectedTile: this.selectedTile ? { ...this.selectedTile } : null,
      aliveCount: this.aliveCount,
      totalTiles: this.totalTiles,
      removedPairs: this.removedPairs,
      totalPairs: this.totalPairs,
      shuffleCount: this.shuffleCount,
      isWin: this.isWin,
      hintActive: this.hintState?.active ?? false,
      noMatch: this.noMatch,
      elapsedTime: this._elapsedTime,
    };
  }

  /**
   * 推进游戏时间（公开接口，用于测试和外部动画驱动）
   * @param deltaTime 经过的毫秒数
   */
  advanceTime(deltaTime: number): void {
    this.update(deltaTime);
  }

  /**
   * 直接点击网格坐标（供测试使用，跳过像素坐标转换）
   * @param row 行索引
   * @param col 列索引
   */
  clickTile(row: number, col: number): void {
    this.handleClick(
      this.gridOffsetX + col * (this.tileW + TILE_GAP) + Math.floor(this.tileW / 2),
      this.gridOffsetY + row * (this.tileH + TILE_GAP) + Math.floor(this.tileH / 2),
    );
  }

  /**
   * 设置自定义网格（供测试使用）
   * 设置后，onStart 不会重新生成网格
   * @param layout 网格布局，每个元素为图案编号或 null
   */
  setGrid(layout: (number | null)[][]): void {
    const rows = layout.length;
    const cols = layout[0].length;
    const grid: (number | null)[][] = layout.map(row => [...row]);

    this.rows = rows;
    this.cols = cols;
    this.grid = grid;
    this._customGridSet = true;

    // Calculate totals
    let total = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell !== null) total++;
      }
    }
    this.totalTiles = total;
    this.aliveCount = total;
    this.totalPairs = Math.floor(total / 2);
  }

  // ========== 网格生成 ==========

  /** 应用关卡配置 */
  private applyLevelConfig(level: number): void {
    const config = LEVEL_CONFIGS[level] || LEVEL_CONFIGS[DEFAULT_LEVEL];
    this.rows = config.rows;
    this.cols = config.cols;
    this.patternCount = config.patternCount;
  }

  /**
   * 生成配对网格
   * - 每种图案出现偶数次（保证可配对）
   * - 随机打乱排列
   */
  generateGrid(): void {
    const total = this.rows * this.cols;
    // 确保总数为偶数
    const effectiveTotal = total % 2 === 0 ? total : total - 1;
    const pairCount = effectiveTotal / 2;

    // 生成配对的图案列表
    const tiles: number[] = [];
    for (let i = 0; i < pairCount; i++) {
      const patternType = i % this.patternCount;
      tiles.push(patternType, patternType);
    }

    // 洗牌
    const shuffled = shuffleArray(tiles);

    // 填充网格
    this.grid = [];
    let idx = 0;
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        if (idx < shuffled.length) {
          this.grid[r][c] = shuffled[idx++];
        } else {
          this.grid[r][c] = null;
        }
      }
    }

    this.totalTiles = effectiveTotal;
    this.aliveCount = effectiveTotal;
    this.totalPairs = pairCount;
  }

  /** 计算布局参数（牌面尺寸、偏移量） */
  private calculateLayout(): void {
    const availW = CANVAS_WIDTH - GRID_PADDING * 2;
    const availH = CANVAS_HEIGHT - HUD_HEIGHT - GRID_PADDING * 2;

    this.tileW = Math.floor((availW - TILE_GAP * (this.cols - 1)) / this.cols);
    this.tileH = Math.floor((availH - TILE_GAP * (this.rows - 1)) / this.rows);

    // 确保牌面尺寸合理
    this.tileW = Math.max(this.tileW, 20);
    this.tileH = Math.max(this.tileH, 20);

    const gridW = this.tileW * this.cols + TILE_GAP * (this.cols - 1);
    const gridH = this.tileH * this.rows + TILE_GAP * (this.rows - 1);

    this.gridOffsetX = Math.floor((CANVAS_WIDTH - gridW) / 2);
    this.gridOffsetY = HUD_HEIGHT + Math.floor((CANVAS_HEIGHT - HUD_HEIGHT - gridH) / 2);
  }

  // ========== 路径连接算法 ==========

  /**
   * 检查两个位置是否可通过最多 2 个拐弯的路径连接
   *
   * 路径规则：
   * - 只能走空格（已消除的位置）或网格外围（虚拟边界 row=-1/rows, col=-1/cols）
   * - 最多 2 个拐弯（即最多 3 段直线）
   *
   * @param p1 起点
   * @param p2 终点
   * @returns 连接路径（拐点列表）或 null（不可连接）
   */
  canConnect(p1: Point, p2: Point): Path | null {
    if (pointEq(p1, p2)) return null;

    // 确保两个位置都有牌
    if (this.grid[p1.row]?.[p1.col] === null || this.grid[p2.row]?.[p2.col] === null) {
      return null;
    }

    // 0 拐弯：直线连接
    const straight = this.tryStraightConnect(p1, p2);
    if (straight) return straight;

    // 1 拐弯：一个拐点
    const oneTurn = this.tryOneTurnConnect(p1, p2);
    if (oneTurn) return oneTurn;

    // 2 拐弯：两个拐点
    const twoTurn = this.tryTwoTurnConnect(p1, p2);
    if (twoTurn) return twoTurn;

    return null;
  }

  /**
   * 尝试直线连接（0 拐弯）
   * 要求：同行或同列，中间所有格子为空
   */
  private tryStraightConnect(p1: Point, p2: Point): Path | null {
    if (p1.row === p2.row) {
      // 同行：检查水平方向是否畅通
      if (this.isHorizontalClear(p1.row, p1.col, p2.col)) {
        return [p1, p2];
      }
    }
    if (p1.col === p2.col) {
      // 同列：检查垂直方向是否畅通
      if (this.isVerticalClear(p1.col, p1.row, p2.row)) {
        return [p1, p2];
      }
    }
    return null;
  }

  /**
   * 尝试一个拐弯连接
   * 拐点候选：(p1.row, p2.col) 或 (p2.row, p1.col)
   */
  private tryOneTurnConnect(p1: Point, p2: Point): Path | null {
    // 候选拐点1: (p1.row, p2.col)
    const corner1: Point = { row: p1.row, col: p2.col };
    if (this.isPassable(corner1) &&
        this.isHorizontalClear(p1.row, p1.col, p2.col) &&
        this.isVerticalClear(p2.col, p1.row, p2.row)) {
      return [p1, corner1, p2];
    }

    // 候选拐点2: (p2.row, p1.col)
    const corner2: Point = { row: p2.row, col: p1.col };
    if (this.isPassable(corner2) &&
        this.isVerticalClear(p1.col, p1.row, p2.row) &&
        this.isHorizontalClear(p2.row, p1.col, p2.col)) {
      return [p1, corner2, p2];
    }

    return null;
  }

  /**
   * 尝试两个拐弯连接
   * 从 p1 沿四个方向延伸（包括网格外围），对每个延伸点尝试一拐弯到 p2
   */
  private tryTwoTurnConnect(p1: Point, p2: Point): Path | null {
    // 向上延伸（包括网格外围 row = -1）
    for (let r = p1.row - 1; r >= -1; r--) {
      const ext: Point = { row: r, col: p1.col };
      if (!this.isPassable(ext)) break;
      const path = this.tryOneTurnFromExt(ext, p2);
      if (path) return [p1, ...path];
    }

    // 向下延伸（包括网格外围 row = rows）
    for (let r = p1.row + 1; r <= this.rows; r++) {
      const ext: Point = { row: r, col: p1.col };
      if (!this.isPassable(ext)) break;
      const path = this.tryOneTurnFromExt(ext, p2);
      if (path) return [p1, ...path];
    }

    // 向左延伸（包括网格外围 col = -1）
    for (let c = p1.col - 1; c >= -1; c--) {
      const ext: Point = { row: p1.row, col: c };
      if (!this.isPassable(ext)) break;
      const path = this.tryOneTurnFromExt(ext, p2);
      if (path) return [p1, ...path];
    }

    // 向右延伸（包括网格外围 col = cols）
    for (let c = p1.col + 1; c <= this.cols; c++) {
      const ext: Point = { row: p1.row, col: c };
      if (!this.isPassable(ext)) break;
      const path = this.tryOneTurnFromExt(ext, p2);
      if (path) return [p1, ...path];
    }

    return null;
  }

  /**
   * 从延伸点 ext 尝试一拐弯到 p2
   * ext 与 p1 在同一行或同一列（由调用方保证）
   */
  private tryOneTurnFromExt(ext: Point, p2: Point): Point[] | null {
    // 候选拐点1: (ext.row, p2.col)
    const c1: Point = { row: ext.row, col: p2.col };
    if (this.isPassable(c1) &&
        this.isHorizontalClear(ext.row, ext.col, p2.col) &&
        this.isVerticalClear(p2.col, ext.row, p2.row)) {
      return [ext, c1, p2];
    }

    // 候选拐点2: (p2.row, ext.col)
    const c2: Point = { row: p2.row, col: ext.col };
    if (this.isPassable(c2) &&
        this.isVerticalClear(ext.col, ext.row, p2.row) &&
        this.isHorizontalClear(p2.row, ext.col, p2.col)) {
      return [ext, c2, p2];
    }

    return null;
  }

  /**
   * 检查水平方向两点之间是否畅通（不含端点）
   * 支持网格外围坐标（外围视为空）
   */
  private isHorizontalClear(row: number, col1: number, col2: number): boolean {
    const minC = Math.min(col1, col2);
    const maxC = Math.max(col1, col2);

    for (let c = minC + 1; c < maxC; c++) {
      if (!this.isCellEmpty(row, c)) return false;
    }
    return true;
  }

  /**
   * 检查垂直方向两点之间是否畅通（不含端点）
   * 支持网格外围坐标（外围视为空）
   */
  private isVerticalClear(col: number, row1: number, row2: number): boolean {
    const minR = Math.min(row1, row2);
    const maxR = Math.max(row1, row2);

    for (let r = minR + 1; r < maxR; r++) {
      if (!this.isCellEmpty(r, col)) return false;
    }
    return true;
  }

  /**
   * 检查某个位置是否可通行（空位或网格外围）
   */
  private isPassable(p: Point): boolean {
    // 网格外围总是可通行
    if (p.row < 0 || p.row >= this.rows || p.col < 0 || p.col >= this.cols) {
      return true;
    }
    // 网格内部：必须为空（null）
    return this.grid[p.row][p.col] === null;
  }

  /**
   * 检查某个网格单元格是否为空
   * 外围坐标视为空
   */
  private isCellEmpty(row: number, col: number): boolean {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return true; // 外围视为空
    }
    return this.grid[row][col] === null;
  }

  // ========== 匹配和消除 ==========

  /** 匹配成功处理：计算得分、启动动画 */
  private matchSuccess(t1: Point, t2: Point, path: Path): void {
    // 更新连击
    const now = performance.now();
    if (this.lastMatchTime > 0 && now - this.lastMatchTime < COMBO_TIMEOUT) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastMatchTime = now;

    // 计算得分 = 基础分 + 连击奖励
    const points = SCORE_BASE_MATCH + SCORE_COMBO_BONUS * (this.combo - 1);
    this._score += points;
    this.emit('scoreChange', points);

    // 清除选择
    this.selectedTile = null;

    // 启动连线动画
    this.connectAnim = {
      path,
      elapsed: 0,
      tile1: t1,
      tile2: t2,
    };

    this.emit('stateChange');
  }

  /** 真正移除两张牌（动画结束后调用） */
  private removeTiles(t1: Point, t2: Point): void {
    this.grid[t1.row][t1.col] = null;
    this.grid[t2.row][t2.col] = null;
    this.aliveCount -= 2;
    this.removedPairs++;
    this.emit('stateChange');
  }

  // ========== 提示系统 ==========

  /** 使用提示（公开方法，供外部按钮调用） */
  getHint(): void {
    this.useHint();
  }

  /** 内部提示实现 */
  useHint(): void {
    if (this._status !== 'playing') return;
    if (this.connectAnim || this.removeAnim) return;

    const result = this.findMatchablePair();
    if (result) {
      this.hintState = {
        tile1: result.tile1,
        tile2: result.tile2,
        path: result.path,
        elapsed: 0,
        active: true,
      };
      // 扣分惩罚
      this._score -= HINT_PENALTY;
      this.emit('scoreChange', -HINT_PENALTY);
      this.emit('stateChange');
    }
  }

  /**
   * 找到一对可消除的牌
   * @returns { tile1, tile2, path } 或 null
   */
  findMatchablePair(): { tile1: Point; tile2: Point; path: Path } | null {
    const aliveTiles: Point[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== null) {
          aliveTiles.push({ row: r, col: c });
        }
      }
    }

    // 按图案分组
    const groups = new Map<number, Point[]>();
    for (const t of aliveTiles) {
      const type = this.grid[t.row][t.col]!;
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type)!.push(t);
    }

    // 对每组检查是否有可连接的对
    for (const [, tiles] of groups) {
      for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
          const path = this.canConnect(tiles[i], tiles[j]);
          if (path) {
            return { tile1: tiles[i], tile2: tiles[j], path };
          }
        }
      }
    }

    return null;
  }

  // ========== 洗牌 ==========

  /** 洗牌（重新排列存活的牌） */
  shuffle(): void {
    if (this._status !== 'playing') return;
    if (this.shuffleCount >= MAX_SHUFFLES) return;

    // 收集所有存活牌的图案
    const alivePatterns: number[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== null) {
          alivePatterns.push(this.grid[r][c]!);
        }
      }
    }

    // 洗牌
    const shuffled = shuffleArray(alivePatterns);

    // 重新填充到原位置
    let idx = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== null) {
          this.grid[r][c] = shuffled[idx++];
        }
      }
    }

    this.shuffleCount++;
    this.noMatch = false;
    this.selectedTile = null;
    this.hintState = null;

    // 扣分惩罚
    this._score -= SHUFFLE_PENALTY;
    this.emit('scoreChange', -SHUFFLE_PENALTY);

    // 检查洗牌后是否仍无解
    this.checkNoMatch();

    this.emit('stateChange');
  }

  /** 检查当前是否无解（无可消除配对） */
  private checkNoMatch(): void {
    const result = this.findMatchablePair();
    this.noMatch = result === null;
  }

  // ========== 关卡递进 ==========

  /** 进入下一关 */
  nextLevel(): void {
    const nextLevel = this._level + 1;
    if (LEVEL_CONFIGS[nextLevel]) {
      this.setLevel(nextLevel);
      this.applyLevelConfig(nextLevel);
    } else {
      // 循环回第一关
      this.setLevel(1);
      this.applyLevelConfig(DEFAULT_LEVEL);
    }
    this.generateGrid();
    this.calculateLayout();
    this.selectedTile = null;
    this.connectAnim = null;
    this.removeAnim = null;
    this.hintState = null;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastMatchTime = 0;
    this.shuffleCount = 0;
    this.isWin = false;
    this.noMatch = false;
    this.removedPairs = 0;
    this.checkNoMatch();
  }

  // ========== 渲染方法 ==========

  /** 绘制背景渐变 */
  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, COLORS.backgroundGradient1);
    gradient.addColorStop(1, COLORS.backgroundGradient2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  /** 绘制顶部 HUD 状态栏 */
  private drawHUD(ctx: CanvasRenderingContext2D, _w: number): void {
    // HUD 背景
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);

    // 分隔线
    ctx.strokeStyle = COLORS.hudBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(CANVAS_WIDTH, HUD_HEIGHT);
    ctx.stroke();

    // 分数
    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('分数', 12, 20);
    ctx.fillStyle = COLORS.hudScore;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(String(this._score), 12, 42);

    // 等级
    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('等级', CANVAS_WIDTH / 2, 20);
    ctx.fillStyle = COLORS.hudLevel;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${this._level}`, CANVAS_WIDTH / 2, 42);

    // 连击显示
    if (this.combo > 1) {
      ctx.fillStyle = COLORS.hudCombo;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`连击 ×${this.combo}`, CANVAS_WIDTH / 2 + 80, 42);
    }

    // 剩余牌数
    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('剩余', CANVAS_WIDTH - 12, 20);
    ctx.fillStyle = COLORS.hudValue;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${this.aliveCount}`, CANVAS_WIDTH - 12, 42);
  }

  /** 绘制整个网格 */
  private drawGrid(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const patternType = this.grid[r][c];
        if (patternType === null) continue;

        const x = this.gridOffsetX + c * (this.tileW + TILE_GAP);
        const y = this.gridOffsetY + r * (this.tileH + TILE_GAP);

        const isSelected = this.selectedTile !== null &&
          this.selectedTile.row === r && this.selectedTile.col === c;

        const isHovered = this.hoveredTile !== null &&
          this.hoveredTile.row === r && this.hoveredTile.col === c &&
          !isSelected;

        const isInvalidFlash = this.invalidClickFlash !== null &&
          this.invalidClickFlash.row === r && this.invalidClickFlash.col === c;

        this.drawTile(ctx, x, y, this.tileW, this.tileH, patternType, isSelected, isHovered, isInvalidFlash);
      }
    }
  }

  /** 绘制单个牌面 */
  private drawTile(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
    patternType: number,
    selected: boolean,
    hovered: boolean = false,
    invalidFlash: boolean = false
  ): void {
    // 背景填充
    const bg = selected ? COLORS.tileBgHover : (hovered ? '#1e2d50' : COLORS.tileBg);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, TILE_RADIUS);
    ctx.fill();

    // 边框
    if (invalidFlash) {
      ctx.strokeStyle = '#ff4757';
      ctx.lineWidth = 2;
    } else if (selected) {
      ctx.strokeStyle = COLORS.tileSelectedBorder;
      ctx.lineWidth = 2;
    } else if (hovered) {
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = COLORS.tileBorder;
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, TILE_RADIUS);
    ctx.stroke();

    // 选中发光效果
    if (selected) {
      ctx.shadowColor = COLORS.tileSelectedGlow;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = COLORS.tileSelectedBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, TILE_RADIUS);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 悬停发光效果
    if (hovered && !selected) {
      ctx.shadowColor = 'rgba(0, 210, 255, 0.3)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, TILE_RADIUS);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 无效点击闪烁发光
    if (invalidFlash) {
      ctx.shadowColor = 'rgba(255, 71, 87, 0.5)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ff4757';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, TILE_RADIUS);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 图案 emoji
    const symbol = TILE_SYMBOLS[patternType % TILE_SYMBOLS.length];
    const fontSize = Math.min(w, h) * 0.55;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(symbol, x + w / 2, y + h / 2);
  }

  /** 绘制连线动画 */
  private drawConnectAnimation(ctx: CanvasRenderingContext2D): void {
    if (!this.connectAnim) return;

    const progress = Math.min(this.connectAnim.elapsed / CONNECT_ANIM_DURATION, 1);
    const path = this.connectAnim.path;

    ctx.save();
    ctx.strokeStyle = COLORS.connectLine;
    ctx.lineWidth = 3;
    ctx.shadowColor = COLORS.connectLineGlow;
    ctx.shadowBlur = 10;
    ctx.globalAlpha = 1 - progress * 0.3;

    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const px = this.gridToPixelX(path[i].col);
      const py = this.gridToPixelY(path[i].row);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** 绘制消除动画（白色闪烁） */
  private drawRemoveAnimation(ctx: CanvasRenderingContext2D): void {
    if (!this.removeAnim) return;

    const progress = this.removeAnim.elapsed / REMOVE_ANIM_DURATION;

    for (const tile of [this.removeAnim.tile1, this.removeAnim.tile2]) {
      const x = this.gridOffsetX + tile.col * (this.tileW + TILE_GAP);
      const y = this.gridOffsetY + tile.row * (this.tileH + TILE_GAP);

      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = COLORS.removeFlash;
      ctx.beginPath();
      ctx.roundRect(x, y, this.tileW, this.tileH, TILE_RADIUS);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 绘制提示高亮（闪烁边框 + 虚线路径） */
  private drawHint(ctx: CanvasRenderingContext2D): void {
    if (!this.hintState || !this.hintState.active) return;

    const blink = Math.floor(this.hintState.elapsed / HINT_BLINK_INTERVAL) % 2 === 0;

    // 高亮边框
    for (const tile of [this.hintState.tile1, this.hintState.tile2]) {
      const x = this.gridOffsetX + tile.col * (this.tileW + TILE_GAP);
      const y = this.gridOffsetY + tile.row * (this.tileH + TILE_GAP);

      if (blink) {
        ctx.save();
        ctx.strokeStyle = COLORS.hintBorder;
        ctx.lineWidth = 3;
        ctx.shadowColor = COLORS.hintGlow;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(x - 2, y - 2, this.tileW + 4, this.tileH + 4, TILE_RADIUS + 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 虚线路径
    if (this.hintState.path && blink) {
      ctx.save();
      ctx.strokeStyle = COLORS.hintBorder;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (let i = 0; i < this.hintState.path.length; i++) {
        const px = this.gridToPixelX(this.hintState.path[i].col);
        const py = this.gridToPixelY(this.hintState.path[i].row);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /** 绘制无解提示文字 */
  private drawNoMatchOverlay(ctx: CanvasRenderingContext2D, _w: number, _h: number): void {
    ctx.save();
    ctx.fillStyle = COLORS.noMatchText;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('无解！按 R 洗牌', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);
    ctx.restore();
  }

  /** 绘制胜利遮罩 */
  private drawWinOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.fillStyle = COLORS.winOverlay;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = COLORS.winTitle;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎉 通关！', w / 2, h / 2 - 50);

    ctx.fillStyle = COLORS.winSubtitle;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`得分: ${this._score}`, w / 2, h / 2);

    if (this.maxCombo > 1) {
      ctx.fillStyle = COLORS.hudCombo;
      ctx.font = '18px sans-serif';
      ctx.fillText(`最大连击: ×${this.maxCombo}`, w / 2, h / 2 + 40);
    }

    ctx.fillStyle = COLORS.winPrompt;
    ctx.font = '16px sans-serif';
    ctx.fillText('点击"再来一局"继续', w / 2, h / 2 + 80);
    ctx.restore();
  }

  // ========== 坐标转换 ==========

  /** 网格列 → 像素 X（牌面中心） */
  private gridToPixelX(col: number): number {
    return this.gridOffsetX + col * (this.tileW + TILE_GAP) + this.tileW / 2;
  }

  /** 网格行 → 像素 Y（牌面中心） */
  private gridToPixelY(row: number): number {
    return this.gridOffsetY + row * (this.tileH + TILE_GAP) + this.tileH / 2;
  }
}
