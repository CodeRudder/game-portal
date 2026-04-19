import { GameEngine } from '@/core/GameEngine';
import {
  GRID_SIZE,
  INITIAL_TILES,
  TILE_2_CHANCE,
  WIN_TILE,
  BOARD_PADDING,
  GAP,
  BOARD_MARGIN_TOP,
  CELL_SIZE,
  BOARD_RADIUS,
  CELL_RADIUS,
  EMPTY_CELL_RADIUS,
  TILE_FONT_FAMILY,
  BOARD_BG_COLOR,
  EMPTY_CELL_COLOR,
  TILE_COLORS,
  SUPER_TILE_COLOR,
  HEADER_BG_COLOR,
  TITLE_COLOR,
  SCORE_LABEL_COLOR,
  SCORE_VALUE_COLOR,
} from './constants';

// ========== 类型定义 ==========

/** 滑动方向 */
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

/** 网格类型：4×4 的二维数组，0 表示空格 */
type Grid = number[][];

// ========== 2048 游戏引擎 ==========

export class G2048Engine extends GameEngine {
  /** 游戏网格 */
  private grid: Grid = [];

  /** 已达成过的最高方块 */
  private bestTile: number = 0;

  /** 是否已触发过胜利事件（可继续玩） */
  private hasWon: boolean = false;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.grid = this.createEmptyGrid();
  }

  protected onStart(): void {
    this.grid = this.createEmptyGrid();
    this.bestTile = 0;
    this.hasWon = false;

    // 放置初始方块
    for (let i = 0; i < INITIAL_TILES; i++) {
      this.addRandomTile();
    }
    this.updateBestTile();
  }

  protected onReset(): void {
    this.grid = this.createEmptyGrid();
    this.bestTile = 0;
    this.hasWon = false;
  }

  protected update(_deltaTime: number): void {
    // 2048 是回合制游戏，不需要持续更新
    // 动画由 render 帧驱动，此处留空
  }

  // ========== 渲染 ==========

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = HEADER_BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 顶部标题区域
    this.drawHeader(ctx, w);

    // 棋盘
    this.drawBoard(ctx, w, h);
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    let direction: Direction | null = null;

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        direction = 'UP';
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        direction = 'DOWN';
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        direction = 'LEFT';
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        direction = 'RIGHT';
        break;
    }

    if (direction) {
      this.move(direction);
    }
  }

  handleKeyUp(_key: string): void {
    // 2048 不需要处理按键释放
  }

  getState(): Record<string, unknown> {
    return {
      grid: this.grid.map((row) => [...row]),
      bestTile: this.bestTile,
    };
  }

  // ========== 核心游戏逻辑 ==========

  /**
   * 执行一次滑动操作
   * @returns 是否产生了有效移动（网格发生变化）
   */
  private move(direction: Direction): boolean {
    // 保存移动前的网格快照，用于判断是否变化
    const before = JSON.stringify(this.grid);
    let mergeScore = 0;

    // 根据方向提取行/列，统一处理为"向左合并"
    const lines = this.extractLines(direction);

    const mergedLines: number[][] = [];
    for (const line of lines) {
      const { result, score } = this.mergeLine(line);
      mergedLines.push(result);
      mergeScore += score;
    }

    // 将合并结果写回网格
    this.applyLines(direction, mergedLines);

    // 判断是否有变化
    const changed = JSON.stringify(this.grid) !== before;
    if (!changed) return false;

    // 更新分数
    if (mergeScore > 0) {
      this.addScore(mergeScore);
    }

    // 生成新方块
    this.addRandomTile();

    // 更新最高方块 & 胜利检测
    this.updateBestTile();
    this.checkWin();

    // 检测游戏结束
    if (!this.canMove()) {
      this.gameOver();
    }

    return true;
  }

  /**
   * 合并一行（向左方向）
   * 规则：
   * 1. 先压缩（去零），2. 从左到右相邻相同合并，3. 再压缩
   * [2, 2, 4, 4] → 压缩 [2, 2, 4, 4] → 合并 [4, 8, 0, 0] ✓
   */
  private mergeLine(line: number[]): { result: number[]; score: number } {
    const size = line.length;
    let score = 0;

    // 第一步：压缩（移除零，靠左排列）
    let compressed = line.filter((v) => v !== 0);

    // 第二步：从左到右合并（相邻相同只合并一次）
    const merged: number[] = [];
    let i = 0;
    while (i < compressed.length) {
      if (i + 1 < compressed.length && compressed[i] === compressed[i + 1]) {
        const newValue = compressed[i] * 2;
        merged.push(newValue);
        score += newValue;
        i += 2; // 跳过已合并的一对
      } else {
        merged.push(compressed[i]);
        i++;
      }
    }

    // 第三步：用零填充到原始长度
    while (merged.length < size) {
      merged.push(0);
    }

    return { result: merged, score };
  }

  /**
   * 根据方向从网格中提取行（统一为向左合并的方向）
   */
  private extractLines(direction: Direction): number[][] {
    const lines: number[][] = [];

    switch (direction) {
      case 'LEFT':
        for (let r = 0; r < GRID_SIZE; r++) {
          lines.push([...this.grid[r]]);
        }
        break;
      case 'RIGHT':
        for (let r = 0; r < GRID_SIZE; r++) {
          lines.push([...this.grid[r]].reverse());
        }
        break;
      case 'UP':
        for (let c = 0; c < GRID_SIZE; c++) {
          const col: number[] = [];
          for (let r = 0; r < GRID_SIZE; r++) {
            col.push(this.grid[r][c]);
          }
          lines.push(col);
        }
        break;
      case 'DOWN':
        for (let c = 0; c < GRID_SIZE; c++) {
          const col: number[] = [];
          for (let r = GRID_SIZE - 1; r >= 0; r--) {
            col.push(this.grid[r][c]);
          }
          lines.push(col);
        }
        break;
    }

    return lines;
  }

  /**
   * 将合并后的行写回网格
   */
  private applyLines(direction: Direction, lines: number[][]): void {
    switch (direction) {
      case 'LEFT':
        for (let r = 0; r < GRID_SIZE; r++) {
          this.grid[r] = lines[r];
        }
        break;
      case 'RIGHT':
        for (let r = 0; r < GRID_SIZE; r++) {
          this.grid[r] = lines[r].reverse();
        }
        break;
      case 'UP':
        for (let c = 0; c < GRID_SIZE; c++) {
          for (let r = 0; r < GRID_SIZE; r++) {
            this.grid[r][c] = lines[c][r];
          }
        }
        break;
      case 'DOWN':
        for (let c = 0; c < GRID_SIZE; c++) {
          for (let r = 0; r < GRID_SIZE; r++) {
            this.grid[r][c] = lines[c][GRID_SIZE - 1 - r];
          }
        }
        break;
    }
  }

  /**
   * 在随机空位生成新方块
   * 90% 概率为 2，10% 概率为 4
   */
  private addRandomTile(): void {
    const emptyCells: { r: number; c: number }[] = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }

    if (emptyCells.length === 0) return;

    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    this.grid[r][c] = Math.random() < TILE_2_CHANCE ? 2 : 4;
  }

  /**
   * 检测是否还有合法移动
   * 条件：存在空格 或 存在相邻相同方块
   */
  private canMove(): boolean {
    // 检查空格
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] === 0) return true;
      }
    }

    // 检查水平相邻
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE - 1; c++) {
        if (this.grid[r][c] === this.grid[r][c + 1]) return true;
      }
    }

    // 检查垂直相邻
    for (let r = 0; r < GRID_SIZE - 1; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] === this.grid[r + 1][c]) return true;
      }
    }

    return false;
  }

  /**
   * 检测是否达到 2048（胜利但不结束）
   */
  private checkWin(): void {
    if (this.hasWon) return;
    if (this.bestTile >= WIN_TILE) {
      this.hasWon = true;
      this.setLevel(this._level + 1);
      this.emit('win', { bestTile: this.bestTile });
    }
  }

  /**
   * 更新最高方块记录
   */
  private updateBestTile(): void {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c] > this.bestTile) {
          this.bestTile = this.grid[r][c];
        }
      }
    }
  }

  // ========== 渲染辅助方法 ==========

  /**
   * 绘制顶部标题区域（标题 + 分数显示）
   */
  private drawHeader(ctx: CanvasRenderingContext2D, w: number): void {
    // 标题 "2048"
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = `bold 48px ${TILE_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('2048', BOARD_PADDING, 40);

    // 分数框
    const scoreBoxW = 90;
    const scoreBoxH = 50;
    const scoreBoxGap = 8;

    // 当前分数
    this.drawScoreBox(
      ctx,
      w - BOARD_PADDING - scoreBoxW * 2 - scoreBoxGap,
      15,
      scoreBoxW,
      scoreBoxH,
      'SCORE',
      this._score.toString()
    );

    // 最高方块
    this.drawScoreBox(
      ctx,
      w - BOARD_PADDING - scoreBoxW,
      15,
      scoreBoxW,
      scoreBoxH,
      'BEST',
      this.bestTile.toString()
    );
  }

  /**
   * 绘制分数信息框
   */
  private drawScoreBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    value: string
  ): void {
    // 背景
    ctx.fillStyle = BOARD_BG_COLOR;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();

    // 标签
    ctx.fillStyle = SCORE_LABEL_COLOR;
    ctx.font = `bold 11px ${TILE_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + 16);

    // 数值
    ctx.fillStyle = SCORE_VALUE_COLOR;
    const fontSize = value.length > 4 ? 16 : 20;
    ctx.font = `bold ${fontSize}px ${TILE_FONT_FAMILY}`;
    ctx.fillText(value, x + w / 2, y + 35);
  }

  /**
   * 绘制游戏棋盘
   */
  private drawBoard(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const boardX = BOARD_PADDING;
    const boardY = BOARD_MARGIN_TOP;
    const boardW = w - 2 * BOARD_PADDING;
    const boardH = boardW; // 正方形棋盘

    // 棋盘背景
    ctx.fillStyle = BOARD_BG_COLOR;
    ctx.beginPath();
    ctx.roundRect(boardX, boardY, boardW, boardH, BOARD_RADIUS);
    ctx.fill();

    // 绘制每个格子
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cellX = boardX + GAP + c * (CELL_SIZE + GAP);
        const cellY = boardY + GAP + r * (CELL_SIZE + GAP);
        const value = this.grid[r][c];

        if (value === 0) {
          // 空位
          ctx.fillStyle = EMPTY_CELL_COLOR;
          ctx.beginPath();
          ctx.roundRect(cellX, cellY, CELL_SIZE, CELL_SIZE, EMPTY_CELL_RADIUS);
          ctx.fill();
        } else {
          // 方块
          this.drawTile(ctx, cellX, cellY, CELL_SIZE, value);
        }
      }
    }

    // 游戏结束遮罩
    if (this._status === 'gameover') {
      ctx.fillStyle = 'rgba(238, 228, 218, 0.73)';
      ctx.beginPath();
      ctx.roundRect(boardX, boardY, boardW, boardH, BOARD_RADIUS);
      ctx.fill();

      ctx.fillStyle = '#776e65';
      ctx.font = `bold 48px ${TILE_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Game Over!', boardX + boardW / 2, boardY + boardH / 2);
    }
  }

  /**
   * 绘制单个方块
   */
  private drawTile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    value: number
  ): void {
    // 获取颜色
    const colors = TILE_COLORS[value] || SUPER_TILE_COLOR;

    // 方块背景
    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, CELL_RADIUS);
    ctx.fill();

    // 数字文字
    ctx.fillStyle = colors.text;

    // 根据数字位数动态调整字体大小
    let fontSize: number;
    const str = value.toString();
    if (str.length <= 1) fontSize = 44;
    else if (str.length <= 2) fontSize = 40;
    else if (str.length <= 3) fontSize = 32;
    else if (str.length <= 4) fontSize = 26;
    else fontSize = 20;

    ctx.font = `bold ${fontSize}px ${TILE_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x + size / 2, y + size / 2);
  }

  // ========== 工具方法 ==========

  /**
   * 创建空网格
   */
  private createEmptyGrid(): Grid {
    return Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => 0)
    );
  }
}
