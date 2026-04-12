/**
 * 消消乐（Match-3）游戏引擎
 *
 * 核心特性：
 * - 8×8 宝石网格，6 种宝石类型（颜色+形状区分）
 * - 点击或方向键+空格选择两个相邻宝石交换
 * - 三连及以上消除检测（水平+垂直），支持 L/T 形
 * - 连锁反应：消除 → 下落填充 → 再次检测 → 循环
 * - 连击计分：连锁次数越多倍率越高
 * - 关卡系统：每关有目标分数，达到进入下一关
 * - 时间限制：每关限时 120 秒，时间到游戏结束
 * - 死局检测：无可行交换则重新洗牌
 * - 光标系统：方向键移动光标位置
 *
 * 状态机：idle → swapping → removing → falling → checking → (idle | removing → ...)
 */
import { GameEngine } from '@/core/GameEngine';
import {
  GRID_ROWS,
  GRID_COLS,
  GEM_TYPE_COUNT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  BOARD_LEFT,
  BOARD_TOP,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  GEM_GAP,
  GEM_SIZE,
  GEM_RADIUS,
  GEM_COLORS,
  GEM_SHAPES,
  SWAP_ANIMATION_MS,
  REMOVE_ANIMATION_MS,
  FALL_SPEED,
  SCORE_MATCH3,
  SCORE_MATCH4,
  SCORE_MATCH5,
  SCORE_SPECIAL_SHAPE,
  COMBO_MULTIPLIER_BASE,
  COMBO_MULTIPLIER_INCREMENT,
  LEVEL_TARGETS,
  TIME_PER_LEVEL,
  BOARD_BG_COLOR,
  HUD_BG_COLOR,
  EMPTY_CELL_COLOR,
  SELECTION_COLOR,
  SELECTION_BORDER_WIDTH,
  CURSOR_COLOR,
  CURSOR_BORDER_WIDTH,
  TEXT_COLOR,
  TEXT_SECONDARY_COLOR,
  FONT_FAMILY,
} from './constants';

// ========== 类型定义 ==========

/** 宝石类型（0 ~ GEM_TYPE_COUNT-1），-1 表示空 */
export type GemType = number;

/** 宝石对象 */
export interface Gem {
  /** 宝石类型，-1 表示已消除/空 */
  type: GemType;
  /** 当前行 */
  row: number;
  /** 当前列 */
  col: number;
  /** 当前渲染 x 坐标 */
  x: number;
  /** 当前渲染 y 坐标 */
  y: number;
  /** 目标 x 坐标（动画用） */
  targetX: number;
  /** 目标 y 坐标（动画用） */
  targetY: number;
  /** 透明度（消除动画用，0~1） */
  alpha: number;
  /** 缩放（消除动画用，0~1） */
  scale: number;
  /** 是否被标记为待消除 */
  matched: boolean;
}

/** 棋盘状态机 */
export type BoardState = 'idle' | 'swapping' | 'removing' | 'falling' | 'checking';

/** 网格位置 */
export interface GridPosition {
  row: number;
  col: number;
}

// ========== 消消乐引擎 ==========

export class Match3Engine extends GameEngine {
  // ===== 棋盘数据 =====
  /** 宝石网格 */
  private grid: (Gem | null)[][] = [];
  /** 棋盘状态机当前状态 */
  private boardState: BoardState = 'idle';

  // ===== 选择状态 =====
  /** 当前选中位置行（-1 表示未选中） */
  private selectedRow: number = -1;
  /** 当前选中位置列（-1 表示未选中） */
  private selectedCol: number = -1;

  // ===== 光标系统 =====
  /** 光标行位置 */
  private cursorRow: number = 0;
  /** 光标列位置 */
  private cursorCol: number = 0;

  // ===== 交换动画 =====
  /** 交换中的宝石1位置（交换后） */
  private swappingGem1: GridPosition | null = null;
  /** 交换中的宝石2位置（交换后） */
  private swappingGem2: GridPosition | null = null;
  /** 交换动画进度（0~1） */
  private swapProgress: number = 0;
  /** 是否在回退交换（无匹配时） */
  private swapReverting: boolean = false;

  // ===== 消除动画 =====
  /** 消除动画进度（0~1） */
  private removeProgress: number = 0;

  // ===== 连锁 =====
  /** 当前连击数 */
  private comboCount: number = 0;

  // ===== 关卡 =====
  /** 当前关卡目标分数 */
  private targetScore: number = LEVEL_TARGETS[0];
  /** 关卡开始时间戳（毫秒） */
  private levelStartTime: number = 0;
  /** 剩余时间（秒） */
  private timeRemaining: number = TIME_PER_LEVEL;

  // ===== 动画计时器 =====
  /** 状态计时器（毫秒） */
  private stateTimer: number = 0;

  // ===== 随机数生成器（可注入，方便测试） =====
  private rng: () => number = Math.random;

  // ========== 构造函数 ==========

  constructor() {
    super();
  }

  // ========== 公开访问器 ==========

  /** 当前光标位置 */
  get cursorPosition(): GridPosition {
    return { row: this.cursorRow, col: this.cursorCol };
  }

  /** 当前选中位置（null 表示未选中） */
  get selectedPosition(): GridPosition | null {
    if (this.selectedRow === -1) return null;
    return { row: this.selectedRow, col: this.selectedCol };
  }

  /** 当前连击数 */
  get comboCount(): number {
    return this.comboCount;
  }

  /** 剩余时间（秒） */
  get timeRemaining(): number {
    return this.timeRemaining;
  }

  /** 当前关卡目标分数 */
  get targetScore(): number {
    return this.targetScore;
  }

  // ========== 生命周期方法 ==========

  protected onInit(): void {
    this.grid = [];
    this.boardState = 'idle';
    this.selectedRow = -1;
    this.selectedCol = -1;
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.comboCount = 0;
    this.timeRemaining = TIME_PER_LEVEL;
    this.targetScore = this.getTargetForLevel(1);
    this.stateTimer = 0;
    this.swapProgress = 0;
    this.swapReverting = false;
    this.removeProgress = 0;
    this.swappingGem1 = null;
    this.swappingGem2 = null;
  }

  protected onStart(): void {
    this.grid = this.generateGrid();
    this.boardState = 'idle';
    this.selectedRow = -1;
    this.selectedCol = -1;
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.comboCount = 0;
    // 不使用步数限制
    this.targetScore = this.getTargetForLevel(1);
    this.timeRemaining = TIME_PER_LEVEL;
    this.levelStartTime = Date.now();
    this.swappingGem1 = null;
    this.swappingGem2 = null;
    this.swapProgress = 0;
    this.swapReverting = false;
    this.removeProgress = 0;
    this.stateTimer = 0;
  }

  protected update(deltaTime: number): void {
    // 限制 deltaTime 防止跳帧
    const dt = Math.min(deltaTime, 100);

    // 更新计时器（仅在 idle 状态下倒计时）
    if (this.boardState === 'idle' || this.boardState === 'checking') {
      this.updateTimer(dt);
    }

    // 根据棋盘状态更新
    switch (this.boardState) {
      case 'swapping':
        this.updateSwapping(dt);
        break;
      case 'removing':
        this.updateRemoving(dt);
        break;
      case 'falling':
        this.updateFalling(dt);
        break;
      case 'checking':
        this.updateChecking();
        break;
      default:
        break;
    }
  }

  // ========== 状态机更新 ==========

  /**
   * 更新交换动画
   */
  private updateSwapping(dt: number): void {
    this.stateTimer += dt;
    this.swapProgress = Math.min(1, this.stateTimer / SWAP_ANIMATION_MS);

    // 更新交换中宝石的渲染位置
    if (this.swappingGem1 && this.swappingGem2) {
      const gem1 = this.grid[this.swappingGem1.row]?.[this.swappingGem1.col];
      const gem2 = this.grid[this.swappingGem2.row]?.[this.swappingGem2.col];
      if (gem1 && gem2) {
        const pos1 = this.getCellPosition(this.swappingGem1.row, this.swappingGem1.col);
        const pos2 = this.getCellPosition(this.swappingGem2.row, this.swappingGem2.col);

        if (this.swapReverting) {
          // 回退：从交换后位置回到原位
          gem1.x = pos1.x + (pos2.x - pos1.x) * (1 - this.swapProgress);
          gem1.y = pos1.y + (pos2.y - pos1.y) * (1 - this.swapProgress);
          gem2.x = pos2.x + (pos1.x - pos2.x) * (1 - this.swapProgress);
          gem2.y = pos2.y + (pos1.y - pos2.y) * (1 - this.swapProgress);
        } else {
          // 正向：从原位到交换后位置
          gem1.x = pos1.x + (pos2.x - pos1.x) * this.swapProgress;
          gem1.y = pos1.y + (pos2.y - pos1.y) * this.swapProgress;
          gem2.x = pos2.x + (pos1.x - pos2.x) * this.swapProgress;
          gem2.y = pos2.y + (pos1.y - pos2.y) * this.swapProgress;
        }
      }
    }

    if (this.swapProgress >= 1) {
      if (this.swapReverting) {
        // 回退完成，恢复到 idle
        this.snapAllGemsToGrid();
        this.boardState = 'idle';
        this.swappingGem1 = null;
        this.swappingGem2 = null;
        this.swapReverting = false;
      } else {
        // 交换完成，检查是否有匹配
        const matches = this.findMatches();
        if (matches.size > 0) {
          // 有匹配，进入消除阶段
          this.comboCount = 1;
          this.boardState = 'removing';
          this.stateTimer = 0;
          this.removeProgress = 0;
          this.markMatches(matches);
          this.emit('match', { count: matches.size, combo: this.comboCount });
        } else {
          // 无匹配，回退交换
          this.swapReverting = true;
          this.stateTimer = 0;
          this.swapProgress = 0;
          // 先恢复网格数据
          this.swapGemsInGrid(this.swappingGem1!, this.swappingGem2!);
        }
      }
    }
  }

  /**
   * 更新消除动画
   */
  private updateRemoving(dt: number): void {
    this.stateTimer += dt;
    this.removeProgress = Math.min(1, this.stateTimer / REMOVE_ANIMATION_MS);

    // 更新被消除宝石的 alpha 和 scale
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const gem = this.grid[r]?.[c];
        if (gem && gem.matched) {
          gem.alpha = 1 - this.removeProgress;
          gem.scale = 1 - this.removeProgress * 0.5;
        }
      }
    }

    if (this.removeProgress >= 1) {
      // 计算分数
      this.calculateScore();

      // 移除匹配的宝石
      this.removeMatchedGems();

      // 应用重力，进入下落阶段
      this.applyGravity();
      this.fillEmpty();

      this.boardState = 'falling';
      this.stateTimer = 0;
    }
  }

  /**
   * 更新下落动画
   */
  private updateFalling(dt: number): void {
    const dtSec = dt / 1000;
    let allSettled = true;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const gem = this.grid[r]?.[c];
        if (gem && (Math.abs(gem.y - gem.targetY) > 0.5 || Math.abs(gem.x - gem.targetX) > 0.5)) {
          allSettled = false;

          // 向目标位置移动
          const dy = gem.targetY - gem.y;
          const dx = gem.targetX - gem.x;
          const moveAmount = FALL_SPEED * dtSec;

          if (Math.abs(dy) <= moveAmount) {
            gem.y = gem.targetY;
          } else {
            gem.y += Math.sign(dy) * moveAmount;
          }

          if (Math.abs(dx) <= moveAmount) {
            gem.x = gem.targetX;
          } else {
            gem.x += Math.sign(dx) * moveAmount;
          }
        }
      }
    }

    if (allSettled) {
      this.snapAllGemsToGrid();
      this.boardState = 'checking';
    }
  }

  /**
   * 检查连锁反应
   */
  private updateChecking(): void {
    const matches = this.findMatches();
    if (matches.size > 0) {
      // 有新的匹配，连锁继续
      this.comboCount++;
      this.boardState = 'removing';
      this.stateTimer = 0;
      this.removeProgress = 0;
      this.markMatches(matches);
      this.emit('cascade', { combo: this.comboCount });
    } else {
      // 无新匹配，连锁结束
      this.comboCount = 0;
      this.boardState = 'idle';

      // 检查关卡目标
      this.checkLevelProgress();

      // 检查死局
      if (!this.hasValidMoves()) {
        this.shuffleBoard();
      }
    }
  }

  /**
   * 更新计时器
   */
  private updateTimer(dt: number): void {
    this.timeRemaining -= dt / 1000;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.gameOver();
    }
  }

  // ========== 核心算法 ==========

  /**
   * 生成无初始三连的网格
   * 逐格填入，确保放置时不会产生横向或纵向的三连
   */
  private generateGrid(): (Gem | null)[][] {
    const grid: (Gem | null)[][] = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        let type: GemType;
        do {
          type = this.randomGemType();
        } while (this.wouldCreateMatch(grid, r, c, type));

        const pos = this.getCellPosition(r, c);
        grid[r][c] = {
          type,
          row: r,
          col: c,
          x: pos.x,
          y: pos.y,
          targetX: pos.x,
          targetY: pos.y,
          alpha: 1,
          scale: 1,
          matched: false,
        };
      }
    }

    return grid;
  }

  /**
   * 检查放置指定类型的宝石是否会造成三连
   * @param grid 当前网格
   * @param row 目标行
   * @param col 目标列
   * @param type 宝石类型
   * @returns true 表示会造成三连
   */
  private wouldCreateMatch(
    grid: (Gem | null)[][],
    row: number,
    col: number,
    type: GemType
  ): boolean {
    // 检查横向：左边是否有连续 2 个相同
    if (col >= 2) {
      const left1 = grid[row]?.[col - 1];
      const left2 = grid[row]?.[col - 2];
      if (left1?.type === type && left2?.type === type) {
        return true;
      }
    }

    // 检查纵向：上边是否有连续 2 个相同
    if (row >= 2) {
      const up1 = grid[row - 1]?.[col];
      const up2 = grid[row - 2]?.[col];
      if (up1?.type === type && up2?.type === type) {
        return true;
      }
    }

    return false;
  }

  /**
   * 扫描所有行和列，找到三连及以上的匹配
   * 支持：三连、四连、五连、L形、T形（通过 Set 去重实现）
   * @returns 匹配的宝石位置集合（"row,col" 格式）
   */
  findMatches(): Set<string> {
    const matches = new Set<string>();

    // 横向扫描
    for (let r = 0; r < GRID_ROWS; r++) {
      let c = 0;
      while (c < GRID_COLS) {
        const gem = this.grid[r]?.[c];
        if (!gem || gem.type === -1) {
          c++;
          continue;
        }
        let end = c + 1;
        while (end < GRID_COLS) {
          const next = this.grid[r]?.[end];
          if (next && next.type === gem.type) {
            end++;
          } else {
            break;
          }
        }
        // 连续 3 个及以上
        if (end - c >= 3) {
          for (let i = c; i < end; i++) {
            matches.add(`${r},${i}`);
          }
        }
        c = end;
      }
    }

    // 纵向扫描
    for (let c = 0; c < GRID_COLS; c++) {
      let r = 0;
      while (r < GRID_ROWS) {
        const gem = this.grid[r]?.[c];
        if (!gem || gem.type === -1) {
          r++;
          continue;
        }
        let end = r + 1;
        while (end < GRID_ROWS) {
          const next = this.grid[end]?.[c];
          if (next && next.type === gem.type) {
            end++;
          } else {
            break;
          }
        }
        if (end - r >= 3) {
          for (let i = r; i < end; i++) {
            matches.add(`${i},${c}`);
          }
        }
        r = end;
      }
    }

    return matches;
  }

  /**
   * 标记匹配的宝石
   */
  private markMatches(matches: Set<string>): void {
    for (const key of matches) {
      const [r, c] = key.split(',').map(Number);
      const gem = this.grid[r]?.[c];
      if (gem) {
        gem.matched = true;
      }
    }
  }

  /**
   * 移除被标记的宝石
   */
  private removeMatchedGems(): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const gem = this.grid[r]?.[c];
        if (gem && gem.matched) {
          this.grid[r][c] = null;
        }
      }
    }
  }

  /**
   * 计算消除分数
   * 根据匹配模式（三连/四连/五连/L形/T形）计算基础分，再乘以连击倍率
   */
  private calculateScore(): void {
    // 统计匹配的宝石数量和模式
    let matchedCount = 0;
    const matchedPositions: GridPosition[] = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const gem = this.grid[r]?.[c];
        if (gem && gem.matched) {
          matchedCount++;
          matchedPositions.push({ row: r, col: c });
        }
      }
    }

    // 检测匹配模式（三连/四连/五连/L形/T形）
    let baseScore = 0;

    // 分析水平匹配
    const horizontalRuns = this.analyzeHorizontalRuns(matchedPositions);
    // 分析垂直匹配
    const verticalRuns = this.analyzeVerticalRuns(matchedPositions);

    // 检测 L/T 形（同时有水平3+和垂直3+且有交集）
    const hasSpecialShape = horizontalRuns.some(hr =>
      verticalRuns.some(vr =>
        hr.positions.some(p => vr.positions.some(q => p.row === q.row && p.col === q.col))
      )
    );

    if (hasSpecialShape) {
      baseScore = SCORE_SPECIAL_SHAPE + matchedCount * SCORE_MATCH3;
    } else {
      // 根据最长连计算
      const maxRun = Math.max(
        ...horizontalRuns.map(r => r.length),
        ...verticalRuns.map(r => r.length),
        0
      );

      if (maxRun >= 5) {
        baseScore = matchedCount * SCORE_MATCH5;
      } else if (maxRun >= 4) {
        baseScore = matchedCount * SCORE_MATCH4;
      } else {
        baseScore = matchedCount * SCORE_MATCH3;
      }
    }

    // 连击倍率
    const comboMultiplier = COMBO_MULTIPLIER_BASE + (this.comboCount - 1) * COMBO_MULTIPLIER_INCREMENT;
    const points = Math.floor(baseScore * comboMultiplier);
    this.addScore(points);
    this.emit('scoreCalc', { baseScore, combo: this.comboCount, multiplier: comboMultiplier, points });
  }

  /**
   * 分析水平方向的匹配段
   */
  private analyzeHorizontalRuns(positions: GridPosition[]): Array<{ length: number; positions: GridPosition[] }> {
    const runs: Array<{ length: number; positions: GridPosition[] }> = [];
    const posSet = new Set(positions.map(p => `${p.row},${p.col}`));

    for (let r = 0; r < GRID_ROWS; r++) {
      let c = 0;
      while (c < GRID_COLS) {
        if (posSet.has(`${r},${c}`)) {
          const runPositions: GridPosition[] = [];
          let end = c;
          while (end < GRID_COLS && posSet.has(`${r},${end}`)) {
            runPositions.push({ row: r, col: end });
            end++;
          }
          if (runPositions.length >= 3) {
            runs.push({ length: runPositions.length, positions: runPositions });
          }
          c = end;
        } else {
          c++;
        }
      }
    }

    return runs;
  }

  /**
   * 分析垂直方向的匹配段
   */
  private analyzeVerticalRuns(positions: GridPosition[]): Array<{ length: number; positions: GridPosition[] }> {
    const runs: Array<{ length: number; positions: GridPosition[] }> = [];
    const posSet = new Set(positions.map(p => `${p.row},${p.col}`));

    for (let c = 0; c < GRID_COLS; c++) {
      let r = 0;
      while (r < GRID_ROWS) {
        if (posSet.has(`${r},${c}`)) {
          const runPositions: GridPosition[] = [];
          let end = r;
          while (end < GRID_ROWS && posSet.has(`${end},${c}`)) {
            runPositions.push({ row: end, col: c });
            end++;
          }
          if (runPositions.length >= 3) {
            runs.push({ length: runPositions.length, positions: runPositions });
          }
          r = end;
        } else {
          r++;
        }
      }
    }

    return runs;
  }

  /**
   * 应用重力：上方宝石下落填补空位
   * 从底部向上扫描每一列，将非空宝石压到底部
   */
  applyGravity(): void {
    for (let c = 0; c < GRID_COLS; c++) {
      let writeRow = GRID_ROWS - 1;

      for (let r = GRID_ROWS - 1; r >= 0; r--) {
        const gem = this.grid[r]?.[c];
        if (gem !== null) {
          if (r !== writeRow) {
            // 移动宝石到下方空位
            gem.row = writeRow;
            const targetPos = this.getCellPosition(writeRow, c);
            gem.targetX = targetPos.x;
            gem.targetY = targetPos.y;
            // 保持当前渲染 y（动画从当前位置下落）
            this.grid[writeRow][c] = gem;
            this.grid[r][c] = null;
          }
          writeRow--;
        }
      }
    }
  }

  /**
   * 在顶部空位填充新宝石
   * 新宝石从画布上方开始下落
   */
  fillEmpty(): void {
    for (let c = 0; c < GRID_COLS; c++) {
      let emptyCount = 0;
      for (let r = 0; r < GRID_ROWS; r++) {
        if (this.grid[r]?.[c] === null) {
          emptyCount++;
        }
      }

      // 从顶部填充
      for (let i = 0; i < emptyCount; i++) {
        const r = emptyCount - 1 - i;
        const type = this.randomGemType();
        const pos = this.getCellPosition(r, c);
        // 新宝石从画布上方开始下落
        const startY = HUD_HEIGHT - GEM_SIZE * (i + 1);

        this.grid[r][c] = {
          type,
          row: r,
          col: c,
          x: pos.x,
          y: startY,
          targetX: pos.x,
          targetY: pos.y,
          alpha: 1,
          scale: 1,
          matched: false,
        };
      }
    }
  }

  /**
   * 将所有宝石的渲染位置对齐到网格
   */
  private snapAllGemsToGrid(): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const gem = this.grid[r]?.[c];
        if (gem) {
          const pos = this.getCellPosition(r, c);
          gem.x = pos.x;
          gem.y = pos.y;
          gem.targetX = pos.x;
          gem.targetY = pos.y;
          gem.row = r;
          gem.col = c;
          gem.alpha = 1;
          gem.scale = 1;
          gem.matched = false;
        }
      }
    }
  }

  /**
   * 交换网格中两个位置的宝石
   */
  private swapGemsInGrid(pos1: GridPosition, pos2: GridPosition): void {
    const temp = this.grid[pos1.row][pos1.col];
    this.grid[pos1.row][pos1.col] = this.grid[pos2.row][pos2.col];
    this.grid[pos2.row][pos2.col] = temp;

    // 更新宝石的行列信息
    if (this.grid[pos1.row]?.[pos1.col]) {
      this.grid[pos1.row][pos1.col]!.row = pos1.row;
      this.grid[pos1.row][pos1.col]!.col = pos1.col;
    }
    if (this.grid[pos2.row]?.[pos2.col]) {
      this.grid[pos2.row][pos2.col]!.row = pos2.row;
      this.grid[pos2.row][pos2.col]!.col = pos2.col;
    }
  }

  // ========== 点击处理 ==========

  /**
   * 处理画布点击事件
   * @param canvasX 画布 x 坐标
   * @param canvasY 画布 y 坐标
   */
  handleClick(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') return;
    if (this.boardState !== 'idle') return;

    const cell = this.getCellFromPosition(canvasX, canvasY);
    if (!cell) return;

    const { row, col } = cell;

    if (this.selectedRow === -1) {
      // 第一次选择
      this.selectedRow = row;
      this.selectedCol = col;
      this.emit('select', { row, col });
    } else if (this.selectedRow === row && this.selectedCol === col) {
      // 取消选择
      this.selectedRow = -1;
      this.selectedCol = -1;
      this.emit('deselect');
    } else if (this.isAdjacent(this.selectedRow, this.selectedCol, row, col)) {
      // 选择相邻宝石，执行交换
      this.startSwap(this.selectedRow, this.selectedCol, row, col);
      this.selectedRow = -1;
      this.selectedCol = -1;
    } else {
      // 选择非相邻宝石，重新选择
      this.selectedRow = row;
      this.selectedCol = col;
      this.emit('select', { row, col });
    }
  }

  /**
   * 开始交换动画
   */
  private startSwap(row1: number, col1: number, row2: number, col2: number): void {
    // 先在网格中交换数据
    this.swapGemsInGrid({ row: row1, col: col1 }, { row: row2, col: col2 });

    // 设置交换动画状态（交换后 gem1 在 row2,col2，gem2 在 row1,col1）
    this.swappingGem1 = { row: row2, col: col2 };
    this.swappingGem2 = { row: row1, col: col1 };
    this.swapProgress = 0;
    this.swapReverting = false;
    this.stateTimer = 0;
    this.boardState = 'swapping';
  }

  // ========== 关卡系统 ==========

  /**
   * 获取指定关卡的目标分数
   */
  private getTargetForLevel(level: number): number {
    const idx = Math.min(level - 1, LEVEL_TARGETS.length - 1);
    return LEVEL_TARGETS[idx];
  }

  /**
   * 检查关卡进度
   */
  private checkLevelProgress(): void {
    if (this._score >= this.targetScore) {
      // 过关
      const nextLevel = this._level + 1;
      this.setLevel(nextLevel);
      this.targetScore = this.getTargetForLevel(nextLevel);
      // 重置时间
      this.timeRemaining = TIME_PER_LEVEL;
      this.emit('levelUp', { level: nextLevel, targetScore: this.targetScore });
    }
  }

  // ========== 死局检测与洗牌 ==========

  /**
   * 检查是否还有可用的移动（任何交换能产生匹配）
   */
  hasValidMoves(): boolean {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        // 检查向右交换
        if (c + 1 < GRID_COLS) {
          this.swapGemsInGrid({ row: r, col: c }, { row: r, col: c + 1 });
          const hasMatch = this.findMatches().size > 0;
          this.swapGemsInGrid({ row: r, col: c }, { row: r, col: c + 1 });
          if (hasMatch) return true;
        }
        // 检查向下交换
        if (r + 1 < GRID_ROWS) {
          this.swapGemsInGrid({ row: r, col: c }, { row: r + 1, col: c });
          const hasMatch = this.findMatches().size > 0;
          this.swapGemsInGrid({ row: r, col: c }, { row: r + 1, col: c });
          if (hasMatch) return true;
        }
      }
    }
    return false;
  }

  /**
   * 重新洗牌棋盘
   * 收集所有宝石类型，随机重新分配位置，确保无初始匹配
   */
  shuffleBoard(): void {
    // 收集所有宝石类型
    const types: GemType[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const gem = this.grid[r]?.[c];
        if (gem && gem.type !== -1) {
          types.push(gem.type);
        }
      }
    }

    // Fisher-Yates 洗牌
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }

    // 重新分配（确保无三连）
    let idx = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const gem = this.grid[r]?.[c];
        if (gem && gem.type !== -1) {
          let type = types[idx++];
          let attempts = 0;
          // 如果会造成三连，尝试交换到其他位置
          while (this.wouldCreateMatch(this.grid, r, c, type) && attempts < types.length) {
            const swapIdx = Math.floor(this.rng() * types.length);
            [types[idx - 1], types[swapIdx]] = [types[swapIdx], types[idx - 1]];
            type = types[idx - 1];
            attempts++;
          }
          gem.type = type;
        }
      }
    }

    this.snapAllGemsToGrid();
    this.emit('shuffle');

    // 如果洗牌后仍然死局，重新生成
    if (!this.hasValidMoves()) {
      this.grid = this.generateGrid();
      this.snapAllGemsToGrid();
    }
  }

  // ========== 工具方法 ==========

  /**
   * 获取单元格的渲染位置（左上角坐标）
   */
  getCellPosition(row: number, col: number): { x: number; y: number } {
    const x = BOARD_LEFT + GEM_GAP + col * (GEM_SIZE + GEM_GAP);
    const y = BOARD_TOP + GEM_GAP + row * (GEM_SIZE + GEM_GAP);
    return { x, y };
  }

  /**
   * 从画布坐标获取单元格位置
   * @returns 单元格位置，如果不在棋盘范围内返回 null
   */
  getCellFromPosition(canvasX: number, canvasY: number): GridPosition | null {
    // 检查是否在棋盘区域内
    if (canvasY < BOARD_TOP) return null;
    if (canvasX < BOARD_LEFT || canvasX > BOARD_LEFT + GRID_COLS * (GEM_SIZE + GEM_GAP)) return null;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const pos = this.getCellPosition(r, c);
        if (
          canvasX >= pos.x && canvasX <= pos.x + GEM_SIZE &&
          canvasY >= pos.y && canvasY <= pos.y + GEM_SIZE
        ) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  /**
   * 检查两个位置是否相邻（上下左右）
   */
  private isAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }

  /**
   * 生成随机宝石类型
   */
  private randomGemType(): GemType {
    return Math.floor(this.rng() * GEM_TYPE_COUNT);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case 'ArrowUp':
        if (this.cursorRow > 0) this.cursorRow--;
        break;
      case 'ArrowDown':
        if (this.cursorRow < GRID_ROWS - 1) this.cursorRow++;
        break;
      case 'ArrowLeft':
        if (this.cursorCol > 0) this.cursorCol--;
        break;
      case 'ArrowRight':
        if (this.cursorCol < GRID_COLS - 1) this.cursorCol++;
        break;
      case ' ':
      case 'Space':
        this.handleCursorSelect();
        break;
      default:
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // Match-3 不需要处理按键释放
  }

  /**
   * 处理光标位置的选择操作（空格键触发）
   */
  private handleCursorSelect(): void {
    if (this.boardState !== 'idle') return;

    const row = this.cursorRow;
    const col = this.cursorCol;

    if (this.selectedRow === -1) {
      // 第一次选择
      this.selectedRow = row;
      this.selectedCol = col;
      this.emit('select', { row, col });
    } else if (this.selectedRow === row && this.selectedCol === col) {
      // 取消选择
      this.selectedRow = -1;
      this.selectedCol = -1;
      this.emit('deselect');
    } else if (this.isAdjacent(this.selectedRow, this.selectedCol, row, col)) {
      // 交换
      this.startSwap(this.selectedRow, this.selectedCol, row, col);
      this.selectedRow = -1;
      this.selectedCol = -1;
    } else {
      // 重新选择
      this.selectedRow = row;
      this.selectedCol = col;
      this.emit('select', { row, col });
    }
  }

  getState(): Record<string, unknown> {
    return {
      grid: this.getGridSnapshot(),
      boardState: this.boardState,
      selectedRow: this.selectedRow,
      selectedCol: this.selectedCol,
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
      comboCount: this.comboCount,
      timeRemaining: this.timeRemaining,
      targetScore: this.targetScore,
      score: this._score,
      level: this._level,
      status: this._status,
    };
  }

  // ========== 公开方法（供测试和外部使用） ==========

  /**
   * 获取棋盘状态
   */
  getBoardState(): BoardState {
    return this.boardState;
  }

  /**
   * 获取网格引用（只读用途）
   */
  getGrid(): (Gem | null)[][] {
    return this.grid;
  }

  /**
   * 获取网格快照（深拷贝）
   */
  getGridSnapshot(): (Gem | null)[][] {
    return this.grid.map(row =>
      row.map(gem => (gem ? { ...gem } : null))
    );
  }

  /**
   * 获取选中位置
   */
  getSelectedCell(): GridPosition | null {
    if (this.selectedRow === -1) return null;
    return { row: this.selectedRow, col: this.selectedCol };
  }

  /**
   * 设置随机数生成器（用于测试注入确定性随机）
   */
  setRng(rng: () => number): void {
    this.rng = rng;
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = HUD_BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this.drawHUD(ctx, w);

    // 棋盘背景
    ctx.fillStyle = BOARD_BG_COLOR;
    ctx.beginPath();
    ctx.roundRect(BOARD_LEFT - 4, BOARD_TOP - 4, BOARD_WIDTH + 8, BOARD_HEIGHT + 8, 8);
    ctx.fill();

    // 绘制空格背景
    this.drawEmptyCells(ctx);

    // 绘制宝石
    this.drawGems(ctx);

    // 绘制光标
    this.drawCursor(ctx);

    // 绘制选中框
    this.drawSelection(ctx);

    // 游戏结束遮罩
    if (this._status === 'gameover') {
      this.drawGameOverOverlay(ctx, w, h);
    }
  }

  /** 绘制 HUD 信息栏 */
  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // 分数
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`分数: ${this._score}`, 10, 22);

    // 关卡
    ctx.fillStyle = TEXT_SECONDARY_COLOR;
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillText(`关卡 ${this._level}`, 160, 22);

    // 目标分数
    ctx.textAlign = 'center';
    ctx.fillText(`目标: ${this.targetScore}`, w / 2, 22);

    // 剩余时间
    ctx.fillStyle = this.timeRemaining <= 10 ? '#FF4444' : TEXT_COLOR;
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(this.timeRemaining)}s`, w - 10, 22);

    // 连击
    if (this.comboCount > 1) {
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold 16px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${this.comboCount}x 连击!`, w / 2, 56);
    }
  }

  /** 绘制空格背景 */
  private drawEmptyCells(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = EMPTY_CELL_COLOR;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const pos = this.getCellPosition(r, c);
        ctx.beginPath();
        ctx.roundRect(pos.x, pos.y, GEM_SIZE, GEM_SIZE, GEM_RADIUS);
        ctx.fill();
      }
    }
  }

  /** 绘制所有宝石 */
  private drawGems(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const gem = this.grid[r]?.[c];
        if (!gem || gem.type === -1) continue;

        ctx.save();
        ctx.globalAlpha = gem.alpha;

        // 以宝石中心为缩放原点
        const cx = gem.x + GEM_SIZE / 2;
        const cy = gem.y + GEM_SIZE / 2;
        ctx.translate(cx, cy);
        ctx.scale(gem.scale, gem.scale);
        ctx.translate(-cx, -cy);

        this.drawSingleGem(ctx, gem);
        ctx.restore();
      }
    }
  }

  /** 绘制单个宝石 */
  private drawSingleGem(ctx: CanvasRenderingContext2D, gem: Gem): void {
    const color = GEM_COLORS[gem.type] || '#888888';
    const shape = GEM_SHAPES[gem.type] || 'circle';
    const x = gem.x;
    const y = gem.y;
    const s = GEM_SIZE;

    ctx.fillStyle = color;

    switch (shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(x + s / 2, y + s / 2, s / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(x + s / 2, y + 2);
        ctx.lineTo(x + s - 2, y + s / 2);
        ctx.lineTo(x + s / 2, y + s - 2);
        ctx.lineTo(x + 2, y + s / 2);
        ctx.closePath();
        ctx.fill();
        break;

      case 'square':
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, s - 6, s - 6, 4);
        ctx.fill();
        break;

      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(x + s / 2, y + 3);
        ctx.lineTo(x + s - 3, y + s - 3);
        ctx.lineTo(x + 3, y + s - 3);
        ctx.closePath();
        ctx.fill();
        break;

      case 'star': {
        const cx = x + s / 2;
        const cy = y + s / 2;
        const outerR = s / 2 - 2;
        const innerR = outerR * 0.4;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const px = cx + outerR * Math.cos(angle);
          const py = cy + outerR * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);

          const innerAngle = angle + (2 * Math.PI) / 10;
          ctx.lineTo(cx + innerR * Math.cos(innerAngle), cy + innerR * Math.sin(innerAngle));
        }
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'hexagon': {
        const cx = x + s / 2;
        const cy = y + s / 2;
        const r = s / 2 - 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 6;
          const px = cx + r * Math.cos(angle);
          const py = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }

      default:
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, s - 4, s - 4, GEM_RADIUS);
        ctx.fill();
        break;
    }
  }

  /** 绘制光标 */
  private drawCursor(ctx: CanvasRenderingContext2D): void {
    const pos = this.getCellPosition(this.cursorRow, this.cursorCol);
    ctx.strokeStyle = CURSOR_COLOR;
    ctx.lineWidth = CURSOR_BORDER_WIDTH;
    ctx.beginPath();
    ctx.roundRect(pos.x - 1, pos.y - 1, GEM_SIZE + 2, GEM_SIZE + 2, GEM_RADIUS + 1);
    ctx.stroke();
  }

  /** 绘制选中框 */
  private drawSelection(ctx: CanvasRenderingContext2D): void {
    if (this.selectedRow === -1 || this.selectedCol === -1) return;

    const pos = this.getCellPosition(this.selectedRow, this.selectedCol);
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = SELECTION_BORDER_WIDTH;
    ctx.beginPath();
    ctx.roundRect(pos.x - 2, pos.y - 2, GEM_SIZE + 4, GEM_SIZE + 4, GEM_RADIUS + 2);
    ctx.stroke();
  }

  /** 绘制游戏结束遮罩 */
  private drawGameOverOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `bold 40px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('游戏结束', w / 2, h / 2 - 30);

    ctx.font = `24px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_SECONDARY_COLOR;
    ctx.fillText(`最终分数: ${this._score}`, w / 2, h / 2 + 20);
    ctx.fillText(`到达关卡: ${this._level}`, w / 2, h / 2 + 55);
  }

  // ========== 重写生命周期 ==========

  protected onPause(): void {
    // 暂停时保存剩余时间
  }

  protected onResume(): void {
    // 恢复时不需要额外操作
  }

  protected onReset(): void {
    this.grid = [];
    this.boardState = 'idle';
    this.selectedRow = -1;
    this.selectedCol = -1;
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.comboCount = 0;
    this.timeRemaining = TIME_PER_LEVEL;
    this.targetScore = this.getTargetForLevel(1);
    this.swappingGem1 = null;
    this.swappingGem2 = null;
    this.swapProgress = 0;
    this.swapReverting = false;
    this.removeProgress = 0;
    this.stateTimer = 0;
  }

  protected onDestroy(): void {
    this.grid = [];
  }

  protected onGameOver(): void {
    this.boardState = 'idle';
  }
}
