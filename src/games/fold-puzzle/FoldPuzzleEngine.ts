/**
 * 折纸拼图 (Fold Puzzle) — 游戏引擎
 *
 * 核心玩法：一个彩色网格纸片，通过折叠使其匹配目标图案。
 * - 网格：4×4 的彩色格子（用数字表示颜色：1-4）
 * - 折叠操作：选择一条水平或垂直折线，将一侧折叠到另一侧
 * - 折叠规则：折叠时移动侧的格子覆盖目标侧的格子
 * - 目标图案：预设的最终状态
 * - 键盘控制：方向键选择折线位置，空格确认折叠
 */

import { GameEngine } from '@/core/GameEngine';
import {
  GRID_SIZE,
  MIN_COLOR,
  MAX_COLOR,
  COLOR_MAP,
  LEVELS,
  MAX_LEVEL,
  BASE_SCORE,
  LEVEL_BONUS,
  OPTIMAL_BONUS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_PADDING,
  CELL_GAP,
  HUD_HEIGHT,
  COLORS,
  FoldLineType,
  MIN_FOLD_POS,
  MAX_FOLD_POS,
} from './constants';
import type { LevelConfig } from './constants';

/** 折叠历史记录（用于撤销） */
interface FoldHistory {
  grid: number[][];
  foldLineType: FoldLineType;
  foldLinePos: number;
  direction: 'forward' | 'backward';
}

/** 方向选择状态 */
type FoldSide = 'up' | 'down' | 'left' | 'right';

export class FoldPuzzleEngine extends GameEngine {
  // ========== 游戏状态 ==========

  /** 当前网格 */
  private grid: number[][] = [];

  /** 目标网格 */
  private targetGrid: number[][] = [];

  /** 当前关卡索引（0-based） */
  private _currentLevelIndex: number = 0;

  /** 步数计数 */
  private _moveCount: number = 0;

  /** 是否已通关 */
  private _isWin: boolean = false;

  /** 折叠历史（用于撤销） */
  private history: FoldHistory[] = [];

  /** 折线类型 */
  private _foldLineType: FoldLineType = FoldLineType.HORIZONTAL;

  /** 折线位置（0 ~ GRID_SIZE-1） */
  private _foldLinePos: number = 0;

  /** 折叠方向（哪一侧覆盖哪一侧） */
  private _foldSide: FoldSide = 'up';

  /** 是否已完成当前关卡 */
  private _levelCompleted: boolean = false;

  // ========== 公共属性 ==========

  get currentLevelIndex(): number {
    return this._currentLevelIndex;
  }

  get totalLevels(): number {
    return MAX_LEVEL;
  }

  get moveCount(): number {
    return this._moveCount;
  }

  get isWin(): boolean {
    return this._isWin;
  }

  get foldLineType(): FoldLineType {
    return this._foldLineType;
  }

  get foldLinePos(): number {
    return this._foldLinePos;
  }

  get foldSide(): FoldSide {
    return this._foldSide;
  }

  get levelCompleted(): boolean {
    return this._levelCompleted;
  }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.loadLevel(0);
  }

  protected onStart(): void {
    this.loadLevel(this._currentLevelIndex);
  }

  protected update(_deltaTime: number): void {
    // 折纸拼图是回合制，不需要持续更新
  }

  protected onRender(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    // 背景
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this.renderHUD(ctx, w);

    // 计算网格区域
    const gridArea = this.calculateGridArea(w, h);

    // 渲染当前网格（上半区域）
    this.renderGrid(ctx, this.grid, gridArea.x, gridArea.y, gridArea.cellSize, '当前');

    // 渲染目标网格（下半区域）
    const targetY = gridArea.y + gridArea.cellSize * GRID_SIZE + 60;
    this.renderGrid(ctx, this.targetGrid, gridArea.x, targetY, gridArea.cellSize * 0.7, '目标');

    // 渲染折线指示器
    if (this._status === 'playing' && !this._levelCompleted) {
      this.renderFoldLine(ctx, gridArea.x, gridArea.y, gridArea.cellSize);
    }

    // 渲染方向提示
    if (this._status === 'playing' && !this._levelCompleted) {
      this.renderDirectionHint(ctx, gridArea.x, gridArea.y, gridArea.cellSize);
    }

    // 通关效果
    if (this._levelCompleted) {
      this.renderWinOverlay(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._moveCount = 0;
    this._isWin = false;
    this._levelCompleted = false;
    this.history = [];
    this._foldLineType = FoldLineType.HORIZONTAL;
    this._foldLinePos = 0;
    this._foldSide = 'up';
    this.loadLevel(this._currentLevelIndex);
  }

  protected onGameOver(): void {
    // 游戏结束（所有关卡完成）
  }

  // ========== 键盘处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing' || this._levelCompleted) return;

    switch (key) {
      case 'ArrowUp':
        this.moveFoldLineUp();
        break;
      case 'ArrowDown':
        this.moveFoldLineDown();
        break;
      case 'ArrowLeft':
        this.moveFoldLineLeft();
        break;
      case 'ArrowRight':
        this.moveFoldLineRight();
        break;
      case ' ':
        this.confirmFold();
        break;
      case 'u':
      case 'U':
        this.undo();
        break;
      case 'r':
      case 'R':
        this.resetLevel();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 折纸拼图不需要 keyUp 处理
  }

  getState(): Record<string, unknown> {
    return {
      grid: this.grid.map((row) => [...row]),
      targetGrid: this.targetGrid.map((row) => [...row]),
      currentLevelIndex: this._currentLevelIndex,
      moveCount: this._moveCount,
      isWin: this._isWin,
      foldLineType: this._foldLineType,
      foldLinePos: this._foldLinePos,
      foldSide: this._foldSide,
      levelCompleted: this._levelCompleted,
      score: this._score,
      level: this._level,
    };
  }

  // ========== 关卡管理 ==========

  /** 加载指定关卡 */
  loadLevel(index: number): void {
    if (index < 0 || index >= MAX_LEVEL) return;

    const level = LEVELS[index];
    this._currentLevelIndex = index;
    this.grid = level.initialGrid.map((row) => [...row]);
    this.targetGrid = level.targetGrid.map((row) => [...row]);
    this._moveCount = 0;
    this._levelCompleted = false;
    this.history = [];
    this._foldLineType = FoldLineType.HORIZONTAL;
    this._foldLinePos = 0;
    this._foldSide = 'up';
    this.setLevel(index + 1);
  }

  /** 重置当前关卡 */
  resetLevel(): void {
    this.loadLevel(this._currentLevelIndex);
    this.emit('stateChange');
  }

  /** 进入下一关 */
  nextLevel(): void {
    if (this._currentLevelIndex < MAX_LEVEL - 1) {
      this.loadLevel(this._currentLevelIndex + 1);
      this.emit('stateChange');
    } else {
      // 所有关卡完成
      this._isWin = true;
      this.gameOver();
    }
  }

  // ========== 折线移动 ==========

  /** 上方向键：水平模式下上移折线，垂直模式下切换为向上折叠 */
  moveFoldLineUp(): void {
    if (this._foldLineType === FoldLineType.HORIZONTAL) {
      // 上移折线位置
      if (this._foldLinePos > MIN_FOLD_POS) {
        this._foldLinePos--;
        this._foldSide = 'up';
      }
    } else {
      // 垂直模式：切换为向上折叠
      this._foldSide = 'up';
    }
    this.emit('stateChange');
  }

  /** 下方向键：水平模式下下移折线，垂直模式下切换为向下折叠 */
  moveFoldLineDown(): void {
    if (this._foldLineType === FoldLineType.HORIZONTAL) {
      // 下移折线位置
      if (this._foldLinePos < MAX_FOLD_POS) {
        this._foldLinePos++;
        this._foldSide = 'down';
      }
    } else {
      // 垂直模式：切换为向下折叠
      this._foldSide = 'down';
    }
    this.emit('stateChange');
  }

  /** 左方向键：垂直模式下左移折线，水平模式下切换为向左折叠 */
  moveFoldLineLeft(): void {
    if (this._foldLineType === FoldLineType.VERTICAL) {
      // 左移折线位置
      if (this._foldLinePos > MIN_FOLD_POS) {
        this._foldLinePos--;
        this._foldSide = 'left';
      }
    } else {
      // 水平模式：切换为向左折叠
      this._foldSide = 'left';
    }
    this.emit('stateChange');
  }

  /** 右方向键：垂直模式下右移折线，水平模式下切换为向右折叠 */
  moveFoldLineRight(): void {
    if (this._foldLineType === FoldLineType.VERTICAL) {
      // 右移折线位置
      if (this._foldLinePos < MAX_FOLD_POS) {
        this._foldLinePos++;
        this._foldSide = 'right';
      }
    } else {
      // 水平模式：切换为向右折叠
      this._foldSide = 'right';
    }
    this.emit('stateChange');
  }

  // ========== 折叠操作 ==========

  /** 确认折叠 */
  confirmFold(): void {
    if (this._levelCompleted) return;

    // 保存当前状态到历史
    this.history.push({
      grid: this.grid.map((row) => [...row]),
      foldLineType: this._foldLineType,
      foldLinePos: this._foldLinePos,
      direction: 'forward',
    });

    // 执行折叠
    this.applyFold();

    // 增加步数
    this._moveCount++;

    // 检查是否匹配目标
    if (this.checkMatch()) {
      this.onLevelComplete();
    }

    this.emit('stateChange');
  }

  /** 执行折叠操作 */
  private applyFold(): void {
    const pos = this._foldLinePos;

    if (this._foldLineType === FoldLineType.HORIZONTAL) {
      // 水平折线：在 row pos 和 row pos+1 之间
      // 折叠方向决定哪一侧覆盖哪一侧
      if (this._foldSide === 'up' || this._foldSide === 'down') {
        this.applyHorizontalFold(pos);
      }
      // 如果 foldSide 是 left/right 但类型是 horizontal，也按水平折叠处理
      if (this._foldSide === 'left' || this._foldSide === 'right') {
        // 先切换到垂直模式再折叠
        this._foldLineType = FoldLineType.VERTICAL;
        this.applyVerticalFold(pos);
        this._foldLineType = FoldLineType.HORIZONTAL; // 恢复
      }
    } else {
      // 垂直折线：在 col pos 和 col pos+1 之间
      if (this._foldSide === 'left' || this._foldSide === 'right') {
        this.applyVerticalFold(pos);
      }
      // 如果 foldSide 是 up/down 但类型是 vertical，也按垂直折叠处理
      if (this._foldSide === 'up' || this._foldSide === 'down') {
        this._foldLineType = FoldLineType.HORIZONTAL;
        this.applyHorizontalFold(pos);
        this._foldLineType = FoldLineType.VERTICAL; // 恢复
      }
    }
  }

  /**
   * 水平折叠
   * @param pos 折线位置（在 row pos 和 row pos+1 之间）
   * - up: 下侧(0..pos) 向上折叠到 上侧(pos+1..GRID_SIZE-1)
   *   但更合理的定义是：row 0..pos 是一侧，row pos+1..GRID_SIZE-1 是另一侧
   *   up 表示 row 0..pos 折叠覆盖 row pos+1..GRID_SIZE-1
   * - down: row pos+1..GRID_SIZE-1 折叠覆盖 row 0..pos
   */
  private applyHorizontalFold(pos: number): void {
    if (pos < 0 || pos >= GRID_SIZE) return;

    const newGrid = this.grid.map((row) => [...row]);

    if (this._foldSide === 'up') {
      // row 0..pos 折叠覆盖 row pos+1..GRID_SIZE-1
      // 上面的行覆盖下面的行
      for (let i = 0; i <= pos; i++) {
        const targetRow = pos + 1 + (pos - i); // 对称位置
        if (targetRow < GRID_SIZE) {
          newGrid[targetRow] = [...this.grid[i]];
        }
      }
    } else {
      // down: row pos+1..GRID_SIZE-1 折叠覆盖 row 0..pos
      for (let i = pos + 1; i < GRID_SIZE; i++) {
        const targetRow = pos - (i - (pos + 1)); // 对称位置
        if (targetRow >= 0) {
          newGrid[targetRow] = [...this.grid[i]];
        }
      }
    }

    this.grid = newGrid;
  }

  /**
   * 垂直折叠
   * @param pos 折线位置（在 col pos 和 col pos+1 之间）
   * - left: col 0..pos 折叠覆盖 col pos+1..GRID_SIZE-1
   * - right: col pos+1..GRID_SIZE-1 折叠覆盖 col 0..pos
   */
  private applyVerticalFold(pos: number): void {
    if (pos < 0 || pos >= GRID_SIZE) return;

    const newGrid = this.grid.map((row) => [...row]);

    if (this._foldSide === 'left') {
      // col 0..pos 折叠覆盖 col pos+1..GRID_SIZE-1
      for (let c = 0; c <= pos; c++) {
        const targetCol = pos + 1 + (pos - c); // 对称位置
        if (targetCol < GRID_SIZE) {
          for (let r = 0; r < GRID_SIZE; r++) {
            newGrid[r][targetCol] = this.grid[r][c];
          }
        }
      }
    } else {
      // right: col pos+1..GRID_SIZE-1 折叠覆盖 col 0..pos
      for (let c = pos + 1; c < GRID_SIZE; c++) {
        const targetCol = pos - (c - (pos + 1)); // 对称位置
        if (targetCol >= 0) {
          for (let r = 0; r < GRID_SIZE; r++) {
            newGrid[r][targetCol] = this.grid[r][c];
          }
        }
      }
    }

    this.grid = newGrid;
  }

  // ========== 匹配检测 ==========

  /** 检查当前网格是否匹配目标 */
  checkMatch(): boolean {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] !== this.targetGrid[r][c]) {
          return false;
        }
      }
    }
    return true;
  }

  /** 获取匹配度百分比 */
  getMatchPercentage(): number {
    let matches = 0;
    const total = GRID_SIZE * GRID_SIZE;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] === this.targetGrid[r][c]) {
          matches++;
        }
      }
    }
    return matches / total;
  }

  // ========== 关卡完成 ==========

  /** 关卡完成处理 */
  private onLevelComplete(): void {
    this._levelCompleted = true;

    // 计算得分
    const level = LEVELS[this._currentLevelIndex];
    let score = BASE_SCORE + (this._currentLevelIndex * LEVEL_BONUS);
    if (this._moveCount <= level.optimalMoves) {
      score += OPTIMAL_BONUS;
    }
    this.addScore(score);

    // 如果是最后一关，游戏胜利
    if (this._currentLevelIndex >= MAX_LEVEL - 1) {
      this._isWin = true;
      this.gameOver();
    }
  }

  // ========== 撤销 ==========

  /** 撤销上一步 */
  undo(): void {
    if (this.history.length === 0) return;
    if (this._levelCompleted) return;

    const lastState = this.history.pop()!;
    this.grid = lastState.grid;
    this._moveCount = Math.max(0, this._moveCount - 1);

    this.emit('stateChange');
  }

  // ========== 切换折线类型 ==========

  /** 切换折线类型（水平/垂直） */
  toggleFoldLineType(): void {
    if (this._foldLineType === FoldLineType.HORIZONTAL) {
      this._foldLineType = FoldLineType.VERTICAL;
    } else {
      this._foldLineType = FoldLineType.HORIZONTAL;
    }
    this._foldLinePos = 0;
    this._foldSide = this._foldLineType === FoldLineType.HORIZONTAL ? 'up' : 'left';
    this.emit('stateChange');
  }

  // ========== 设置方法（用于测试和外部控制） ==========

  /** 设置折线类型 */
  setFoldLineType(type: FoldLineType): void {
    this._foldLineType = type;
    if (type === FoldLineType.HORIZONTAL) {
      this._foldSide = 'up';
    } else {
      this._foldSide = 'left';
    }
  }

  /** 设置折线位置 */
  setFoldLinePos(pos: number): void {
    if (pos >= MIN_FOLD_POS && pos <= MAX_FOLD_POS) {
      this._foldLinePos = pos;
    }
  }

  /** 设置折叠方向 */
  setFoldSide(side: FoldSide): void {
    this._foldSide = side;
  }

  /** 获取当前网格（只读副本） */
  getGrid(): number[][] {
    return this.grid.map((row) => [...row]);
  }

  /** 获取目标网格（只读副本） */
  getTargetGrid(): number[][] {
    return this.targetGrid.map((row) => [...row]);
  }

  /** 直接设置网格（用于测试） */
  setGrid(grid: number[][]): void {
    this.grid = grid.map((row) => [...row]);
  }

  /** 获取历史长度 */
  getHistoryLength(): number {
    return this.history.length;
  }

  // ========== 渲染辅助方法 ==========

  private calculateGridArea(
    w: number,
    h: number,
  ): { x: number; y: number; cellSize: number } {
    const availableWidth = w - GRID_PADDING * 2;
    const cellSize = Math.floor(
      (availableWidth - CELL_GAP * (GRID_SIZE - 1)) / GRID_SIZE,
    );
    const gridWidth = cellSize * GRID_SIZE + CELL_GAP * (GRID_SIZE - 1);
    const x = Math.floor((w - gridWidth) / 2);
    const y = HUD_HEIGHT + 30;
    return { x, y, cellSize };
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = COLORS.HUD_BG;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 关卡信息
    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `关卡 ${this._currentLevelIndex + 1}/${MAX_LEVEL}`,
      15,
      25,
    );

    // 步数
    ctx.fillStyle = COLORS.HUD_ACCENT;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`步数: ${this._moveCount}`, 15, 48);

    // 分数
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`分数: ${this._score}`, w - 15, 25);

    // 折线信息
    ctx.fillStyle = COLORS.FOLD_LINE;
    ctx.font = '12px monospace';
    ctx.fillText(
      `${this._foldLineType === FoldLineType.HORIZONTAL ? '水平' : '垂直'} | 位置: ${this._foldLinePos} | 方向: ${this.getDirectionText()}`,
      w - 15,
      48,
    );
  }

  private getDirectionText(): string {
    switch (this._foldSide) {
      case 'up':
        return '↑ 上';
      case 'down':
        return '↓ 下';
      case 'left':
        return '← 左';
      case 'right':
        return '→ 右';
    }
  }

  private renderGrid(
    ctx: CanvasRenderingContext2D,
    grid: number[][],
    x: number,
    y: number,
    cellSize: number,
    label: string,
  ): void {
    // 标签
    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + (cellSize * GRID_SIZE + CELL_GAP * (GRID_SIZE - 1)) / 2, y - 8);

    // 网格背景
    const gridWidth = cellSize * GRID_SIZE + CELL_GAP * (GRID_SIZE - 1);
    const gridHeight = cellSize * GRID_SIZE + CELL_GAP * (GRID_SIZE - 1);
    ctx.fillStyle = COLORS.GRID_BG;
    ctx.fillRect(x - 4, y - 4, gridWidth + 8, gridHeight + 8);

    // 格子
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cx = x + c * (cellSize + CELL_GAP);
        const cy = y + r * (cellSize + CELL_GAP);
        const colorNum = grid[r][c];
        const color = COLOR_MAP[colorNum] || '#333333';

        // 格子填充
        ctx.fillStyle = color;
        ctx.fillRect(cx, cy, cellSize, cellSize);

        // 格子边框
        ctx.strokeStyle = COLORS.CELL_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, cellSize, cellSize);
      }
    }
  }

  private renderFoldLine(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cellSize: number,
  ): void {
    const gridWidth = cellSize * GRID_SIZE + CELL_GAP * (GRID_SIZE - 1);
    const gridHeight = cellSize * GRID_SIZE + CELL_GAP * (GRID_SIZE - 1);

    ctx.strokeStyle = COLORS.FOLD_LINE;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);

    if (this._foldLineType === FoldLineType.HORIZONTAL) {
      const lineY = y + (this._foldLinePos + 1) * (cellSize + CELL_GAP) - CELL_GAP / 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, lineY);
      ctx.lineTo(x + gridWidth + 10, lineY);
      ctx.stroke();
    } else {
      const lineX = x + (this._foldLinePos + 1) * (cellSize + CELL_GAP) - CELL_GAP / 2;
      ctx.beginPath();
      ctx.moveTo(lineX, y - 10);
      ctx.lineTo(lineX, y + gridHeight + 10);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  private renderDirectionHint(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cellSize: number,
  ): void {
    const gridWidth = cellSize * GRID_SIZE + CELL_GAP * (GRID_SIZE - 1);
    const gridHeight = cellSize * GRID_SIZE + CELL_GAP * (GRID_SIZE - 1);
    const centerX = x + gridWidth / 2;
    const centerY = y + gridHeight / 2;

    ctx.fillStyle = COLORS.DIRECTION_ARROW;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const arrow = this.getDirectionArrow();
    ctx.fillText(arrow, centerX, centerY);
  }

  private getDirectionArrow(): string {
    switch (this._foldSide) {
      case 'up':
        return '⬆';
      case 'down':
        return '⬇';
      case 'left':
        return '⬅';
      case 'right':
        return '➡';
    }
  }

  private renderWinOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    // 半透明背景
    ctx.fillStyle = COLORS.OVERLAY_BG;
    ctx.fillRect(0, 0, w, h);

    // 通关文字
    ctx.fillStyle = COLORS.WIN_TEXT;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎉 关卡完成！', w / 2, h / 2 - 40);

    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.font = '16px monospace';
    ctx.fillText(`用了 ${this._moveCount} 步`, w / 2, h / 2 + 10);

    if (this._currentLevelIndex < MAX_LEVEL - 1) {
      ctx.fillStyle = COLORS.HUD_ACCENT;
      ctx.font = '14px monospace';
      ctx.fillText('按空格进入下一关', w / 2, h / 2 + 50);
    } else {
      ctx.fillStyle = COLORS.WIN_TEXT;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('🏆 恭喜通关所有关卡！', w / 2, h / 2 + 50);
    }
  }
}
