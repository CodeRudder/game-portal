import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  DIFFICULTY_LEVELS, DifficultyKey,
  CELL_WALL, CELL_PATH, CELL_COIN, CELL_EXIT, CELL_START,
  PLAYER_COLOR, PLAYER_SIZE_RATIO,
  WALL_COLOR, PATH_COLOR, COIN_COLOR, EXIT_COLOR,
  FOG_COLOR, HUD_BG_COLOR, HUD_TEXT_COLOR, HUD_SCORE_COLOR, BG_COLOR,
  VISITED_COLOR,
  COIN_SCORE, LEVEL_COMPLETE_BONUS,
  MOVE_INTERVAL,
  COLS_INCREMENT, ROWS_INCREMENT, MAX_COLS, MAX_ROWS,
  FOG_ENABLED_DEFAULT,
} from './constants';

// ========== 类型 ==========

interface Position {
  row: number;
  col: number;
}

// ========== 迷宫引擎 ==========

export class MazeEngine extends GameEngine {
  // 迷宫数据
  private _maze: number[][] = [];
  private _cols: number = 8;
  private _rows: number = 10;
  private _cellSize: number = 0;
  private _offsetX: number = 0;
  private _offsetY: number = 0;

  // 玩家
  private _playerPos: Position = { row: 0, col: 0 };
  private _playerPixelX: number = 0;
  private _playerPixelY: number = 0;
  private _targetPixelX: number = 0;
  private _targetPixelY: number = 0;

  // 出口
  private _exitPos: Position = { row: 0, col: 0 };

  // 游戏状态
  private _steps: number = 0;
  private _coinsCollected: number = 0;
  private _totalCoins: number = 0;
  private _visited: boolean[][] = [];
  private _isWin: boolean = false;
  private _difficulty: DifficultyKey = 'easy';
  private _fogEnabled: boolean = FOG_ENABLED_DEFAULT;
  private _fogRadius: number = 0;

  // 移动控制
  private _keys: Set<string> = new Set();
  private _moveTimer: number = 0;
  private _lastMoveKey: string = '';

  // 关卡
  private _levelCols: number = 8;
  private _levelRows: number = 10;

  // 提示路径
  private _hintPath: Position[] = [];
  private _showHint: boolean = false;
  private _hintTimer: number = 0;

  // ========== Getters ==========

  get maze(): number[][] { return this._maze; }
  get cols(): number { return this._cols; }
  get rows(): number { return this._rows; }
  get playerPos(): Position { return this._playerPos; }
  get exitPos(): Position { return this._exitPos; }
  get steps(): number { return this._steps; }
  get coinsCollected(): number { return this._coinsCollected; }
  get totalCoins(): number { return this._totalCoins; }
  get isWin(): boolean { return this._isWin; }
  get difficulty(): DifficultyKey { return this._difficulty; }
  get fogEnabled(): boolean { return this._fogEnabled; }
  get fogRadius(): number { return this._fogRadius; }
  get cellSize(): number { return this._cellSize; }
  get hintPath(): Position[] { return this._hintPath; }
  get showHint(): boolean { return this._showHint; }

  // ========== GameEngine 实现 ==========

  protected onInit(): void {
    this._maze = [];
    this._playerPos = { row: 0, col: 0 };
    this._exitPos = { row: 0, col: 0 };
    this._steps = 0;
    this._coinsCollected = 0;
    this._totalCoins = 0;
    this._visited = [];
    this._isWin = false;
    this._keys.clear();
    this._moveTimer = 0;
    this._lastMoveKey = '';
    this._playerPixelX = 0;
    this._playerPixelY = 0;
    this._targetPixelX = 0;
    this._targetPixelY = 0;
    this._hintPath = [];
    this._showHint = false;
    this._hintTimer = 0;
  }

  protected onStart(): void {
    const config = DIFFICULTY_LEVELS[this._difficulty];
    this._cols = this._levelCols;
    this._rows = this._levelRows;
    this._fogRadius = config.fogRadius;
    this._fogEnabled = this._fogRadius > 0;

    this.generateMaze();
    this.placeCoins(config.coinCount);
    this.calculateLayout();
    this.resetVisited();

    // 设置玩家位置到起点 (1,1)
    this._playerPos = { row: 1, col: 1 };
    this._maze[1][1] = CELL_START;

    // 设置出口位置
    this._exitPos = { row: this._rows - 2, col: this._cols - 2 };
    this._maze[this._exitPos.row][this._exitPos.col] = CELL_EXIT;

    // 标记起点已访问
    this._visited[1][1] = true;

    // 初始化像素位置
    this.updatePixelPositions();
    this._playerPixelX = this._targetPixelX;
    this._playerPixelY = this._targetPixelY;

    // 清除提示
    this._hintPath = [];
    this._showHint = false;
    this._hintTimer = 0;
  }

  protected update(deltaTime: number): void {
    if (this._isWin) return;

    // 处理持续按键移动
    this._moveTimer -= deltaTime;
    if (this._moveTimer <= 0 && this._lastMoveKey) {
      this.tryMove(this._lastMoveKey);
      this._moveTimer = MOVE_INTERVAL;
    }

    // 平滑移动插值
    const lerpSpeed = 0.2;
    this._playerPixelX += (this._targetPixelX - this._playerPixelX) * lerpSpeed;
    this._playerPixelY += (this._targetPixelY - this._playerPixelY) * lerpSpeed;

    // 提示倒计时
    if (this._showHint) {
      this._hintTimer -= deltaTime;
      if (this._hintTimer <= 0) {
        this._showHint = false;
        this._hintPath = [];
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 绘制迷宫
    this.renderMaze(ctx);

    // 绘制提示路径
    if (this._showHint && this._hintPath.length > 0) {
      this.renderHintPath(ctx);
    }

    // 绘制玩家
    this.renderPlayer(ctx);

    // 绘制迷雾
    if (this._fogEnabled) {
      this.renderFog(ctx, w, h);
    }

    // HUD
    this.renderHUD(ctx, w, h);
  }

  protected onReset(): void {
    this.onInit();
    this._levelCols = DIFFICULTY_LEVELS[this._difficulty].cols;
    this._levelRows = DIFFICULTY_LEVELS[this._difficulty].rows;
  }

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    this._keys.add(key);

    if (key === ' ') {
      if (this._status === 'idle') {
        this.start();
      } else if (this._status === 'gameover') {
        this.reset();
        this.start();
      }
      return;
    }

    // 难度切换（仅在 idle 状态）
    if (this._status === 'idle') {
      if (key === '1') { this._difficulty = 'easy'; return; }
      if (key === '2') { this._difficulty = 'medium'; return; }
      if (key === '3') { this._difficulty = 'hard'; return; }
    }

    // 提示功能（H 键）
    if (key === 'h' || key === 'H') {
      if (this._status === 'playing') {
        this.showHintPath();
      }
      return;
    }

    // 迷雾切换（F 键）
    if (key === 'f' || key === 'F') {
      if (this._status === 'playing' || this._status === 'idle') {
        this.toggleFog();
      }
      return;
    }

    // 移动
    const moveKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'];
    if (moveKeys.includes(key) && this._status === 'playing') {
      this.tryMove(key);
      this._lastMoveKey = key;
      this._moveTimer = MOVE_INTERVAL;
    }
  }

  handleKeyUp(key: string): void {
    this._keys.delete(key);
    if (key === this._lastMoveKey) {
      this._lastMoveKey = '';
    }
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      steps: this._steps,
      coinsCollected: this._coinsCollected,
      totalCoins: this._totalCoins,
      playerPos: { ...this._playerPos },
      exitPos: { ...this._exitPos },
      isWin: this._isWin,
      difficulty: this._difficulty,
      fogEnabled: this._fogEnabled,
      cols: this._cols,
      rows: this._rows,
    };
  }

  // ========== 公共方法 ==========

  /** 设置难度 */
  setDifficulty(diff: DifficultyKey): void {
    this._difficulty = diff;
    this._levelCols = DIFFICULTY_LEVELS[diff].cols;
    this._levelRows = DIFFICULTY_LEVELS[diff].rows;
  }

  /** 切换迷雾 */
  toggleFog(): void {
    this._fogEnabled = !this._fogEnabled;
  }

  /** 显示提示路径（BFS 最短路径） */
  showHintPath(): void {
    const path = this.findShortestPath();
    if (path.length > 0) {
      this._hintPath = path;
      this._showHint = true;
      this._hintTimer = 3000; // 显示 3 秒
    }
  }

  // ========== 迷宫生成（DFS 递归回溯） ==========

  private generateMaze(): void {
    // 初始化全为墙壁
    this._maze = [];
    for (let r = 0; r < this._rows; r++) {
      this._maze[r] = [];
      for (let c = 0; c < this._cols; c++) {
        this._maze[r][c] = CELL_WALL;
      }
    }

    // DFS 从 (1,1) 开始
    this.carve(1, 1);

    // 确保出口位置可达（处理偶数尺寸时 exit 在偶数坐标的情况）
    this.ensureExitReachable();
  }

  /** 确保出口位置被打通并连接到迷宫 */
  private ensureExitReachable(): void {
    const exitR = this._rows - 2;
    const exitC = this._cols - 2;

    // 如果出口已经是路径，无需处理
    if (this._maze[exitR][exitC] !== CELL_WALL) return;

    // 打通出口格
    this._maze[exitR][exitC] = CELL_PATH;

    // 找到最近的已打通邻居并连接
    // 尝试向上或向左打通（因为 DFS 从左上开始，这些方向更可能有路径）
    const dirs = [
      { dr: -1, dc: 0 },  // 上
      { dr: 0, dc: -1 },  // 左
      { dr: 1, dc: 0 },   // 下
      { dr: 0, dc: 1 },   // 右
    ];

    for (const { dr, dc } of dirs) {
      const nr = exitR + dr;
      const nc = exitC + dc;
      if (nr > 0 && nr < this._rows - 1 && nc > 0 && nc < this._cols - 1 && this._maze[nr][nc] !== CELL_WALL) {
        return; // 已经有相邻的路径格
      }
    }

    // 没有相邻路径格，向上打通到最近的路径
    if (exitR > 1) {
      this._maze[exitR - 1][exitC] = CELL_PATH;
    } else if (exitC > 1) {
      this._maze[exitR][exitC - 1] = CELL_PATH;
    }
  }

  private carve(row: number, col: number): void {
    this._maze[row][col] = CELL_PATH;

    // 随机方向
    const directions = this.shuffleArray([
      { dr: -2, dc: 0 },
      { dr: 2, dc: 0 },
      { dr: 0, dc: -2 },
      { dr: 0, dc: 2 },
    ]);

    for (const { dr, dc } of directions) {
      const nr = row + dr;
      const nc = col + dc;

      if (nr > 0 && nr < this._rows - 1 && nc > 0 && nc < this._cols - 1 && this._maze[nr][nc] === CELL_WALL) {
        // 打通中间的墙
        this._maze[row + dr / 2][col + dc / 2] = CELL_PATH;
        this.carve(nr, nc);
      }
    }
  }

  // ========== BFS 最短路径（提示功能） ==========

  private findShortestPath(): Position[] {
    const start = this._playerPos;
    const end = this._exitPos;

    if (start.row === end.row && start.col === end.col) return [];

    const visited: boolean[][] = [];
    for (let r = 0; r < this._rows; r++) {
      visited[r] = [];
      for (let c = 0; c < this._cols; c++) {
        visited[r][c] = false;
      }
    }

    const parent: Map<string, Position | null> = new Map();
    const queue: Position[] = [start];
    visited[start.row][start.col] = true;
    parent.set(`${start.row},${start.col}`, null);

    const dirs = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];

    while (queue.length > 0) {
      const curr = queue.shift()!;

      if (curr.row === end.row && curr.col === end.col) {
        // 回溯路径
        const path: Position[] = [];
        let node: Position | null = curr;
        while (node && !(node.row === start.row && node.col === start.col)) {
          path.unshift(node);
          node = parent.get(`${node.row},${node.col}`) ?? null;
        }
        return path;
      }

      for (const { dr, dc } of dirs) {
        const nr = curr.row + dr;
        const nc = curr.col + dc;
        if (nr >= 0 && nr < this._rows && nc >= 0 && nc < this._cols && !visited[nr][nc] && this._maze[nr][nc] !== CELL_WALL) {
          visited[nr][nc] = true;
          parent.set(`${nr},${nc}`, curr);
          queue.push({ row: nr, col: nc });
        }
      }
    }

    return []; // 无路径
  }

  // ========== 金币放置 ==========

  private placeCoins(count: number): void {
    const pathCells: Position[] = [];
    for (let r = 1; r < this._rows - 1; r++) {
      for (let c = 1; c < this._cols - 1; c++) {
        if (this._maze[r][c] === CELL_PATH && !(r === 1 && c === 1)) {
          pathCells.push({ row: r, col: c });
        }
      }
    }

    this.shuffleArray(pathCells);
    const coinsToPlace = Math.min(count, pathCells.length);
    for (let i = 0; i < coinsToPlace; i++) {
      this._maze[pathCells[i].row][pathCells[i].col] = CELL_COIN;
    }
    this._totalCoins = coinsToPlace;
  }

  // ========== 布局计算 ==========

  private calculateLayout(): void {
    const availW = CANVAS_WIDTH - 20;
    const availH = CANVAS_HEIGHT - 80;
    this._cellSize = Math.floor(Math.min(availW / this._cols, availH / this._rows));
    this._offsetX = Math.floor((CANVAS_WIDTH - this._cols * this._cellSize) / 2);
    this._offsetY = Math.floor((CANVAS_HEIGHT - this._rows * this._cellSize) / 2) + 30;
  }

  private resetVisited(): void {
    this._visited = [];
    for (let r = 0; r < this._rows; r++) {
      this._visited[r] = [];
      for (let c = 0; c < this._cols; c++) {
        this._visited[r][c] = false;
      }
    }
  }

  // ========== 移动逻辑 ==========

  private tryMove(key: string): void {
    let dr = 0;
    let dc = 0;

    switch (key) {
      case 'ArrowUp': case 'w': dr = -1; break;
      case 'ArrowDown': case 's': dr = 1; break;
      case 'ArrowLeft': case 'a': dc = -1; break;
      case 'ArrowRight': case 'd': dc = 1; break;
      default: return;
    }

    const nr = this._playerPos.row + dr;
    const nc = this._playerPos.col + dc;

    if (nr < 0 || nr >= this._rows || nc < 0 || nc >= this._cols) return;
    if (this._maze[nr][nc] === CELL_WALL) return;

    // 移动玩家
    this._playerPos = { row: nr, col: nc };
    this._steps++;
    this._visited[nr][nc] = true;

    // 检查金币
    if (this._maze[nr][nc] === CELL_COIN) {
      this._coinsCollected++;
      this.addScore(COIN_SCORE);
      this._maze[nr][nc] = CELL_PATH;
    }

    // 更新像素位置
    this.updatePixelPositions();

    // 检查到达出口
    if (nr === this._exitPos.row && nc === this._exitPos.col) {
      this.winLevel();
    }
  }

  private updatePixelPositions(): void {
    this._targetPixelX = this._offsetX + this._playerPos.col * this._cellSize + this._cellSize / 2;
    this._targetPixelY = this._offsetY + this._playerPos.row * this._cellSize + this._cellSize / 2;
  }

  private winLevel(): void {
    this._isWin = true;
    this.addScore(LEVEL_COMPLETE_BONUS);
    this.emit('stateChange');

    // 升级关卡
    if (this._level < 10) {
      this.setLevel(this._level + 1);
      this._levelCols = Math.min(MAX_COLS, this._levelCols + COLS_INCREMENT);
      this._levelRows = Math.min(MAX_ROWS, this._levelRows + ROWS_INCREMENT);
    }

    this.gameOver();
  }

  // ========== 渲染 ==========

  private renderMaze(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < this._rows; r++) {
      for (let c = 0; c < this._cols; c++) {
        const x = this._offsetX + c * this._cellSize;
        const y = this._offsetY + r * this._cellSize;
        const cell = this._maze[r][c];

        switch (cell) {
          case CELL_WALL:
            ctx.fillStyle = WALL_COLOR;
            break;
          case CELL_PATH:
          case CELL_START:
            ctx.fillStyle = this._visited[r]?.[c] ? VISITED_COLOR : PATH_COLOR;
            break;
          case CELL_COIN:
            ctx.fillStyle = PATH_COLOR;
            break;
          case CELL_EXIT:
            ctx.fillStyle = EXIT_COLOR;
            break;
          default:
            ctx.fillStyle = PATH_COLOR;
        }

        ctx.fillRect(x, y, this._cellSize, this._cellSize);

        // 金币
        if (cell === CELL_COIN) {
          ctx.fillStyle = COIN_COLOR;
          ctx.beginPath();
          ctx.arc(
            x + this._cellSize / 2,
            y + this._cellSize / 2,
            this._cellSize * 0.25,
            0, Math.PI * 2
          );
          ctx.fill();
        }

        // 出口标记
        if (cell === CELL_EXIT) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `${Math.floor(this._cellSize * 0.6)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🚪', x + this._cellSize / 2, y + this._cellSize / 2);
        }
      }
    }
  }

  private renderHintPath(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();

    for (let i = 0; i < this._hintPath.length; i++) {
      const p = this._hintPath[i];
      const x = this._offsetX + p.col * this._cellSize + this._cellSize / 2;
      const y = this._offsetY + p.row * this._cellSize + this._cellSize / 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const size = this._cellSize * PLAYER_SIZE_RATIO;
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(this._playerPixelX, this._playerPixelY, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this._playerPixelX, this._playerPixelY, size / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  private renderFog(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.fillStyle = FOG_COLOR;

    const px = this._playerPixelX;
    const py = this._playerPixelY;
    const fogR = this._fogRadius * this._cellSize;

    for (let r = 0; r < this._rows; r++) {
      for (let c = 0; c < this._cols; c++) {
        const cx = this._offsetX + c * this._cellSize + this._cellSize / 2;
        const cy = this._offsetY + r * this._cellSize + this._cellSize / 2;
        const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);

        if (dist > fogR) {
          ctx.globalAlpha = Math.min(1, (dist - fogR) / (this._cellSize * 2));
          ctx.fillRect(
            this._offsetX + c * this._cellSize,
            this._offsetY + r * this._cellSize,
            this._cellSize,
            this._cellSize
          );
        }
      }
    }

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = HUD_BG_COLOR;
    ctx.fillRect(0, 0, w, 32);

    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`步数: ${this._steps}`, 8, 16);
    ctx.fillText(`金币: ${this._coinsCollected}/${this._totalCoins}`, 120, 16);

    ctx.fillStyle = HUD_SCORE_COLOR;
    ctx.fillText(`分数: ${this._score}`, 260, 16);

    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.textAlign = 'right';
    ctx.fillText(`Lv.${this._level} ${DIFFICULTY_LEVELS[this._difficulty].label}`, w - 8, 16);

    // 游戏结束覆盖
    if (this._status === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = this._isWin ? '#00e676' : '#ff1744';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this._isWin ? '通关！' : '失败', w / 2, h / 2 - 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px monospace';
      ctx.fillText(`分数: ${this._score}`, w / 2, h / 2);
      ctx.fillText(`步数: ${this._steps}  金币: ${this._coinsCollected}/${this._totalCoins}`, w / 2, h / 2 + 30);
      ctx.font = '14px monospace';
      ctx.fillText('按 SPACE 重新开始', w / 2, h / 2 + 70);
    }
  }

  // ========== 工具方法 ==========

  private shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
