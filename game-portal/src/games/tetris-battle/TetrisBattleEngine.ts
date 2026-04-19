/**
 * TetrisBattleEngine — 俄罗斯方块对战引擎
 *
 * 实现双棋盘对战（玩家 vs AI），包含：
 * - 标准 7-bag 随机系统（保证每 7 个方块包含所有类型）
 * - SRS 超级旋转系统（简化版墙踢，含向上踢）
 * - 幽灵方块 & 下一个方块预览
 * - 攻击/垃圾行系统（消行攻击 + 垃圾行抵消）
 * - AI 对手（启发式评估，多维度打分）
 * - 计分 & 等级系统（按等级倍率计分）
 * - 双棋盘完全独立运行
 *
 * @module tetris-battle/TetrisBattleEngine
 */

import { GameEngine } from '@/core/GameEngine';
import {
  COLS,
  ROWS,
  CELL_SIZE,
  TETROMINO_SHAPES,
  TETROMINO_COLORS,
  GHOST_COLORS,
  GARBAGE_COLOR,
  EMPTY_CELL,
  GARBAGE_CELL,
  TETROMINO_COUNT,
  INITIAL_DROP_INTERVAL,
  MIN_DROP_INTERVAL,
  DROP_INTERVAL_DECREASE,
  SOFT_DROP_FACTOR,
  ATTACK_TABLE,
  SCORE_TABLE,
  LINES_PER_LEVEL,
  AI_WEIGHTS,
  AI_EASY_RANDOM_CHANCE,
  BOARD1_OFFSET_X,
  BOARD2_OFFSET_X,
  BOARD_OFFSET_Y,
  BOARD_GAP,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './constants';

// ==================== 类型定义 ====================

/** 当前方块状态 */
interface Piece {
  /** 方块类型索引 (0-6，对应 I/O/T/S/Z/J/L) */
  type: number;
  /** 方块形状矩阵（二维数组，1=有方块，0=空） */
  shape: number[][];
  /** 方块左上角在棋盘上的列位置 */
  x: number;
  /** 方块左上角在棋盘上的行位置（可为负数，表示在可见区域上方） */
  y: number;
}

/** 单个棋盘的完整状态 */
interface BoardState {
  /** 棋盘网格 (ROWS × COLS)，0=空, 1-7=方块类型+1, 8=垃圾行 */
  grid: number[][];
  /** 当前方块（null 表示无活动方块） */
  currentPiece: Piece | null;
  /** 下一个方块类型索引 (0-6) */
  nextType: number;
  /** 当前分数 */
  score: number;
  /** 当前等级 */
  level: number;
  /** 已消行总数 */
  linesCleared: number;
  /** 下落计时器 (ms)，累积到 dropInterval 时方块下移一格 */
  dropTimer: number;
  /** 当前下落间隔 (ms)，等级越高间隔越短 */
  dropInterval: number;
  /** 待接收的垃圾行数（由对手攻击产生） */
  pendingGarbage: number;
  /** 7-bag 剩余方块类型（用于保证公平随机） */
  bag: number[];
  /** 是否已死亡（方块溢出顶部） */
  dead: boolean;
}

/** AI 决策结果 */
interface AIDecision {
  /** 目标列位置 */
  targetX: number;
  /** 目标旋转次数 (0-3) */
  targetRotation: number;
}

// ==================== 引擎实现 ====================

/**
 * 俄罗斯方块对战引擎
 *
 * 左侧为玩家棋盘，右侧为 AI 棋盘。
 * 双方各自独立运行标准俄罗斯方块规则，
 * 消行产生的攻击以垃圾行形式发送到对方底部。
 *
 * 攻击规则：
 * - 消 1 行：不攻击
 * - 消 2 行：送 1 行垃圾
 * - 消 3 行：送 2 行垃圾
 * - 消 4 行（Tetris）：送 4 行垃圾
 *
 * 垃圾行：灰色方块填充整行，留一个随机空洞。
 * 攻击可抵消自己待接收的垃圾行（净攻击 = 攻击 - 待接收）。
 */
export class TetrisBattleEngine extends GameEngine {
  // ===== 双棋盘状态 =====
  private player!: BoardState;
  private ai!: BoardState;

  // ===== AI 控制 =====
  /** AI 决策计时器 (ms)，累积到 aiInterval 时 AI 做出决策 */
  private aiTimer: number = 0;
  /** AI 当前决策间隔 (ms) */
  private aiInterval: number = 800;
  /** AI 是否正在执行放置动画 */
  private aiPlacing: boolean = false;
  /** AI 目标决策（包含目标位置和旋转） */
  private aiDecision: AIDecision | null = null;
  /** AI 放置动画计时器 (ms) */
  private aiPlaceTimer: number = 0;

  // ===== 游戏结果 =====
  /** 玩家是否获胜 */
  private _isWin: boolean = false;
  /** 游戏结束原因 */
  private _gameOverReason: string = '';

  // ===== 攻击缓冲 =====
  /** 玩家待发送的攻击行数（缓冲区，由 transferAttacks 转移到 AI） */
  private playerAttackPending: number = 0;

  // ===== 软降状态 =====
  /** 玩家是否正在软降（按住下键） */
  private softDropping: boolean = false;

  // ==================== 公开属性 ====================

  /** 玩家棋盘网格（引用） */
  get playerBoard(): number[][] {
    return this.player.grid;
  }

  /** AI 棋盘网格（引用） */
  get aiBoard(): number[][] {
    return this.ai.grid;
  }

  /** 玩家分数 */
  get playerScore(): number {
    return this.player.score;
  }

  /** AI 分数 */
  get aiScore(): number {
    return this.ai.score;
  }

  /** 玩家等级 */
  get playerLevel(): number {
    return this.player.level;
  }

  /** AI 等级 */
  get aiLevel(): number {
    return this.ai.level;
  }

  /** 玩家消行数 */
  get playerLines(): number {
    return this.player.linesCleared;
  }

  /** AI 消行数 */
  get aiLines(): number {
    return this.ai.linesCleared;
  }

  /** 获胜玩家（1=玩家, 2=AI, null=未结束） */
  get winner(): number | null {
    if (this._status !== 'gameover') return null;
    return this._isWin ? 1 : 2;
  }

  /** 是否 AI 对战模式（当前固定为 true） */
  get isAI(): boolean {
    return true;
  }

  /** 玩家是否胜利 */
  get isWin(): boolean {
    return this._isWin;
  }

  /** 玩家待接收垃圾行数 */
  get pendingGarbage(): number {
    return this.player.pendingGarbage;
  }

  /** 游戏结束原因 */
  get gameOverReason(): string {
    return this._gameOverReason;
  }

  // ==================== 生命周期方法 ====================

  /**
   * 初始化引擎：创建空棋盘，重置所有状态
   */
  protected onInit(): void {
    this.player = this.createBoardState();
    this.ai = this.createBoardState();
    this.aiInterval = 800;
    this.aiTimer = 0;
    this.aiPlacing = false;
    this.aiDecision = null;
    this.aiPlaceTimer = 0;
    this.playerAttackPending = 0;
    this._isWin = false;
    this._gameOverReason = '';
    this.softDropping = false;
  }

  /**
   * 开始游戏：重置棋盘，生成双方方块
   */
  protected onStart(): void {
    this.player = this.createBoardState();
    this.ai = this.createBoardState();
    this.aiInterval = 800;
    this.aiTimer = 0;
    this.aiPlacing = false;
    this.aiDecision = null;
    this.aiPlaceTimer = 0;
    this.playerAttackPending = 0;
    this._isWin = false;
    this._gameOverReason = '';
    this.softDropping = false;

    // 为双方生成第一个方块
    this.player.nextType = this.pullFromBag(this.player);
    this.ai.nextType = this.pullFromBag(this.ai);
    this.spawnPiece(this.player);
    this.spawnPiece(this.ai);
  }

  /**
   * 重置游戏：清空棋盘和所有状态
   */
  protected onReset(): void {
    this.player = this.createBoardState();
    this.ai = this.createBoardState();
    this.aiTimer = 0;
    this.aiPlacing = false;
    this.aiDecision = null;
    this.playerAttackPending = 0;
    this.softDropping = false;
    this._isWin = false;
    this._gameOverReason = '';
  }

  // ==================== 游戏更新循环 ====================

  /**
   * 每帧更新：更新双方棋盘下落、AI 决策、攻击传递
   *
   * @param deltaTime - 距上一帧的时间间隔（ms）
   */
  protected update(deltaTime: number): void {
    if (this._status !== 'playing') return;

    // 更新玩家棋盘（自动下落）
    this.updateBoard(this.player, deltaTime, false);

    // 更新 AI 棋盘（自动下落）
    this.updateBoard(this.ai, deltaTime, true);

    // AI 思考和执行
    this.updateAI(deltaTime);
  }

  // ==================== 渲染 ====================

  /**
   * 渲染游戏画面：双棋盘、HUD、攻击指示器、VS 标志
   */
  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // HUD 信息栏
    this.drawHUD(ctx, w);

    // 绘制玩家棋盘
    this.drawBoard(ctx, this.player, BOARD1_OFFSET_X, BOARD_OFFSET_Y, 'YOU');

    // 绘制 AI 棋盘
    this.drawBoard(ctx, this.ai, BOARD2_OFFSET_X, BOARD_OFFSET_Y, 'AI');

    // 攻击指示器
    this.drawAttackIndicators(ctx);

    // VS 标志
    this.drawVS(ctx);

    // 游戏结束覆盖层
    if (this._status === 'gameover') {
      this.drawGameOverOverlay(ctx, w, h);
    }
  }

  // ==================== 键盘控制 ====================

  /**
   * 处理按键按下事件
   *
   * 玩家1控制：
   * - W / ↑ = 旋转
   * - A / ← = 左移
   * - S / ↓ = 软降
   * - D / → = 右移
   * - 空格 = 硬降
   */
  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;
    if (this.player.dead) return;

    switch (key) {
      // WASD 控制
      case 'a':
      case 'A':
        this.movePieceHorizontal(this.player, -1);
        break;
      case 'd':
      case 'D':
        this.movePieceHorizontal(this.player, 1);
        break;
      case 's':
      case 'S':
        this.softDrop(this.player);
        this.softDropping = true;
        break;
      case 'w':
      case 'W':
        this.rotatePiece(this.player);
        break;
      case ' ':
        this.hardDrop(this.player);
        break;
      // 方向键控制（备选）
      case 'ArrowLeft':
        this.movePieceHorizontal(this.player, -1);
        break;
      case 'ArrowRight':
        this.movePieceHorizontal(this.player, 1);
        break;
      case 'ArrowDown':
        this.softDrop(this.player);
        this.softDropping = true;
        break;
      case 'ArrowUp':
        this.rotatePiece(this.player);
        break;
    }
  }

  /**
   * 处理按键释放事件
   * 松开下键时重置软降状态
   */
  handleKeyUp(key: string): void {
    if (key === 's' || key === 'S' || key === 'ArrowDown') {
      this.softDropping = false;
    }
  }

  // ==================== 状态导出 ====================

  /**
   * 获取游戏完整状态（用于 UI 显示或序列化）
   *
   * @returns 包含双方棋盘、分数、等级等信息的对象
   */
  getState(): Record<string, unknown> {
    return {
      playerBoard: this.player.grid.map((row) => [...row]),
      aiBoard: this.ai.grid.map((row) => [...row]),
      playerScore: this.player.score,
      aiScore: this.ai.score,
      playerLevel: this.player.level,
      aiLevel: this.ai.level,
      playerLinesCleared: this.player.linesCleared,
      aiLinesCleared: this.ai.linesCleared,
      playerPendingGarbage: this.player.pendingGarbage,
      aiPendingGarbage: this.ai.pendingGarbage,
      playerNextType: this.player.nextType,
      aiNextType: this.ai.nextType,
      isWin: this._isWin,
      winner: this.winner,
      gameOverReason: this._gameOverReason,
      status: this._status,
    };
  }

  // ==================== 棋盘创建 ====================

  /**
   * 创建一个新的棋盘状态（空棋盘 + 默认值）
   */
  private createBoardState(): BoardState {
    return {
      grid: this.createEmptyGrid(),
      currentPiece: null,
      nextType: -1,
      score: 0,
      level: 1,
      linesCleared: 0,
      dropTimer: 0,
      dropInterval: INITIAL_DROP_INTERVAL,
      pendingGarbage: 0,
      bag: [],
      dead: false,
    };
  }

  /**
   * 创建 ROWS × COLS 的全零网格
   */
  private createEmptyGrid(): number[][] {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY_CELL));
  }

  // ==================== 7-Bag 随机系统 ====================

  /**
   * 从 7-bag 中取出一个方块类型。
   *
   * 7-bag 机制：将 [0,1,2,3,4,5,6] 打乱后依次取出，
   * 取完后重新生成。保证每 7 个方块中包含所有 7 种类型。
   */
  private pullFromBag(board: BoardState): number {
    if (board.bag.length === 0) {
      board.bag = Array.from({ length: TETROMINO_COUNT }, (_, i) => i);
      this.shuffleArray(board.bag);
    }
    return board.bag.pop()!;
  }

  /**
   * Fisher-Yates 洗牌算法（原地打乱数组）
   */
  private shuffleArray(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // ==================== 方块生成 ====================

  /**
   * 在指定棋盘上生成新方块。
   *
   * 使用 nextType 作为当前方块类型，并从 bag 中抽取新的 nextType。
   * 方块初始位置在棋盘顶部居中。
   * 如果新方块无法放置，则标记棋盘为 dead（游戏结束）。
   */
  private spawnPiece(board: BoardState): void {
    const type = board.nextType >= 0 ? board.nextType : this.pullFromBag(board);
    const shape = TETROMINO_SHAPES[type].map((row) => [...row]);

    const piece: Piece = {
      type,
      shape,
      x: Math.floor((COLS - shape[0].length) / 2),
      y: 0,
    };

    // 尝试 y=0，如果不行尝试 y=-1（允许方块部分在可见区域上方）
    if (!this.isValid(board.grid, piece.shape, piece.x, piece.y)) {
      piece.y = -1;
      if (!this.isValid(board.grid, piece.shape, piece.x, piece.y)) {
        // 无法放置 → 游戏结束
        board.dead = true;
        board.currentPiece = null;
        return;
      }
    }

    board.currentPiece = piece;
    board.nextType = this.pullFromBag(board);
    board.dropTimer = 0;
  }

  // ==================== 碰撞检测 ====================

  /**
   * 检测方块在指定位置是否合法（不越界、不重叠）
   *
   * @param grid - 棋盘网格
   * @param shape - 方块形状矩阵
   * @param px - 方块左上角列位置
   * @param py - 方块左上角行位置
   * @returns true 表示位置合法
   */
  private isValid(grid: number[][], shape: number[][], px: number, py: number): boolean {
    for (let dy = 0; dy < shape.length; dy++) {
      for (let dx = 0; dx < shape[dy].length; dx++) {
        if (!shape[dy][dx]) continue;
        const nx = px + dx;
        const ny = py + dy;
        // 超出左右或底部边界
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        // 在可见区域内与已有方块重叠
        if (ny >= 0 && grid[ny][nx] !== EMPTY_CELL) return false;
      }
    }
    return true;
  }

  // ==================== 方块移动 ====================

  /**
   * 水平移动方块（左/右）
   *
   * @param board - 目标棋盘
   * @param dir - 移动方向（-1=左, 1=右）
   */
  private movePieceHorizontal(board: BoardState, dir: number): void {
    if (!board.currentPiece || board.dead) return;
    const newX = board.currentPiece.x + dir;
    if (this.isValid(board.grid, board.currentPiece.shape, newX, board.currentPiece.y)) {
      board.currentPiece.x = newX;
    }
  }

  /**
   * 软降（加速下落一格）
   * 成功下移时加 1 分。
   */
  private softDrop(board: BoardState): void {
    if (!board.currentPiece || board.dead) return;
    if (this.moveDown(board)) {
      board.score += 1;
    }
  }

  /**
   * 硬降（瞬间落到底部并锁定）
   * 每下落一格加 2 分。
   */
  private hardDrop(board: BoardState): void {
    if (!board.currentPiece || board.dead) return;
    let distance = 0;
    while (this.isValid(board.grid, board.currentPiece.shape, board.currentPiece.x, board.currentPiece.y + 1)) {
      board.currentPiece.y++;
      distance++;
    }
    board.score += distance * 2;
    this.lockAndProcess(board);
  }

  /**
   * 将方块下移一格。如果无法下移则锁定到棋盘。
   *
   * @param board - 目标棋盘
   * @returns true 表示成功下移，false 表示已锁定
   */
  private moveDown(board: BoardState): boolean {
    if (!board.currentPiece || board.dead) return false;
    if (this.isValid(board.grid, board.currentPiece.shape, board.currentPiece.x, board.currentPiece.y + 1)) {
      board.currentPiece.y++;
      return true;
    } else {
      this.lockAndProcess(board);
      return false;
    }
  }

  // ==================== 方块旋转 ====================

  /**
   * 旋转当前方块（顺时针 90°），带墙踢机制。
   *
   * 墙踢偏移尝试顺序：[0, -1, 1, -2, 2]（水平）
   * 同时也尝试向上踢一格（y-1）。
   * O 方块（2×2）旋转后形状不变，直接跳过。
   */
  private rotatePiece(board: BoardState): void {
    if (!board.currentPiece || board.dead) return;
    const { shape } = board.currentPiece;

    // O 方块不需要旋转
    if (shape.length === 2) return;

    const rotated = this.rotateMatrixCW(shape);

    // 墙踢偏移尝试
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      // 尝试同高度
      if (this.isValid(board.grid, rotated, board.currentPiece.x + kick, board.currentPiece.y)) {
        board.currentPiece.shape = rotated;
        board.currentPiece.x += kick;
        return;
      }
      // 尝试向上踢一格
      if (this.isValid(board.grid, rotated, board.currentPiece.x + kick, board.currentPiece.y - 1)) {
        board.currentPiece.shape = rotated;
        board.currentPiece.x += kick;
        board.currentPiece.y -= 1;
        return;
      }
    }
  }

  /**
   * 顺时针旋转矩阵 90°
   *
   * 算法：result[j][n-1-i] = matrix[i][j]
   */
  private rotateMatrixCW(matrix: number[][]): number[][] {
    const n = matrix.length;
    const result: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result[j][n - 1 - i] = matrix[i][j];
      }
    }
    return result;
  }

  // ==================== 锁定 & 行消除 ====================

  /**
   * 锁定当前方块到棋盘，然后处理消行、攻击和垃圾行。
   * 锁定后立即检查游戏是否结束。
   */
  private lockAndProcess(board: BoardState): void {
    this.lockPiece(board);
    const cleared = this.clearLines(board);
    if (cleared > 0) {
      this.processLineClear(board, cleared);
    }
    // 应用待接收的垃圾行
    this.applyGarbage(board);
    // 生成新方块
    this.spawnPiece(board);
    // 检查游戏是否结束
    this.checkGameOver();
  }

  /**
   * 将当前方块固定到棋盘网格上。
   * 方块类型存储为 type+1（1-7 表示方块，8 表示垃圾行）。
   */
  private lockPiece(board: BoardState): void {
    if (!board.currentPiece) return;
    const { shape, x, y, type } = board.currentPiece;
    for (let dy = 0; dy < shape.length; dy++) {
      for (let dx = 0; dx < shape[dy].length; dx++) {
        if (!shape[dy][dx]) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
          board.grid[ny][nx] = type + 1; // 1-7 表示方块类型
        }
      }
    }
    board.currentPiece = null;
  }

  /**
   * 消除满行。返回消除的行数。
   *
   * 从底部向上扫描，遇到满行则删除并在顶部添加空行。
   * 删除后需要重新检查当前行（因为上方行下移了）。
   */
  private clearLines(board: BoardState): number {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board.grid[r].every((cell) => cell !== EMPTY_CELL)) {
        board.grid.splice(r, 1);
        board.grid.unshift(Array(COLS).fill(EMPTY_CELL));
        cleared++;
        r++; // 重新检查当前行（上方行下移了）
      }
    }
    return cleared;
  }

  /**
   * 处理消行后的计分、升级和攻击产生
   *
   * - 计分：SCORE_TABLE[消行数] × 等级
   * - 升级：每消 10 行升 1 级，速度递增
   * - 攻击：先抵消自己的待接收垃圾行，剩余发送给对手
   */
  private processLineClear(board: BoardState, cleared: number): void {
    // 计分（按等级倍率）
    const points = SCORE_TABLE[cleared] * board.level;
    board.score += points;

    // 消行计数
    board.linesCleared += cleared;

    // 升级检查
    const newLevel = Math.floor(board.linesCleared / LINES_PER_LEVEL) + 1;
    if (newLevel > board.level) {
      board.level = newLevel;
      board.dropInterval = Math.max(
        MIN_DROP_INTERVAL,
        INITIAL_DROP_INTERVAL - (board.level - 1) * DROP_INTERVAL_DECREASE,
      );
    }

    // 产生攻击
    const attack = ATTACK_TABLE[cleared] ?? 0;
    if (attack > 0) {
      // 攻击先抵消自己的待接收垃圾行
      const offset = Math.min(board.pendingGarbage, attack);
      board.pendingGarbage -= offset;
      const sent = attack - offset;
      if (sent > 0) {
        // 将净攻击发送到对手的 pendingGarbage
        const opponent = board === this.player ? this.ai : this.player;
        opponent.pendingGarbage += sent;
      }
    }
  }

  // ==================== 垃圾行系统 ====================

  /**
   * 在棋盘底部添加指定数量的垃圾行。
   *
   * 每行用灰色方块（GARBAGE_CELL=8）填满，
   * 并在随机位置留一个空洞（EMPTY_CELL=0）。
   * 添加时顶部行被移除，保持棋盘高度不变。
   */
  private addGarbageLines(board: BoardState, count: number): void {
    for (let i = 0; i < count; i++) {
      // 移除顶部行
      board.grid.shift();
      // 在底部添加垃圾行
      const garbageRow = Array(COLS).fill(GARBAGE_CELL);
      // 随机位置留一个空洞
      const holePos = Math.floor(Math.random() * COLS);
      garbageRow[holePos] = EMPTY_CELL;
      board.grid.push(garbageRow);
    }
  }

  /**
   * 应用待接收的垃圾行到棋盘（在方块锁定后执行）
   */
  private applyGarbage(board: BoardState): void {
    if (board.pendingGarbage > 0) {
      this.addGarbageLines(board, board.pendingGarbage);
      board.pendingGarbage = 0;
    }
  }

  // ==================== 幽灵方块 ====================

  /**
   * 计算当前方块的幽灵（投影）Y 位置
   * 即方块在当前列能下落到的最底部位置
   */
  private getGhostY(board: BoardState): number {
    if (!board.currentPiece) return 0;
    let ghostY = board.currentPiece.y;
    while (this.isValid(board.grid, board.currentPiece.shape, board.currentPiece.x, ghostY + 1)) {
      ghostY++;
    }
    return ghostY;
  }

  // ==================== 棋盘更新 ====================

  /**
   * 更新单个棋盘的下落逻辑
   *
   * 累积 dropTimer，达到 dropInterval 时方块自动下移一格。
   * 软降状态下加速（除以 SOFT_DROP_FACTOR）。
   */
  private updateBoard(board: BoardState, deltaTime: number, isAI: boolean): void {
    if (board.dead || !board.currentPiece) {
      this.checkGameOver();
      return;
    }

    board.dropTimer += deltaTime;
    const interval = this.softDropping && !isAI
      ? Math.max(MIN_DROP_INTERVAL, board.dropInterval / SOFT_DROP_FACTOR)
      : board.dropInterval;

    if (board.dropTimer >= interval) {
      board.dropTimer = 0;
      this.moveDown(board);
    }

    this.checkGameOver();
  }

  /**
   * 检查游戏是否结束（任一方 dead）
   */
  private checkGameOver(): void {
    if (this.player.dead || this.ai.dead) {
      if (this.player.dead && this.ai.dead) {
        // 同时死亡 → 平局，算玩家输
        this._isWin = false;
        this._gameOverReason = 'draw';
      } else if (this.player.dead) {
        this._isWin = false;
        this._gameOverReason = 'player_top_out';
      } else {
        this._isWin = true;
        this._gameOverReason = 'ai_top_out';
      }
      this.gameOver();
    }
  }

  // ==================== AI 系统 ====================

  /**
   * 更新 AI 决策逻辑
   *
   * AI 有两种状态：
   * 1. 思考状态：累积时间到决策间隔后做出放置决策
   * 2. 执行状态：逐步移动方块到目标位置（模拟人类操作）
   */
  private updateAI(deltaTime: number): void {
    if (this.ai.dead || !this.ai.currentPiece) return;

    // 如果 AI 正在执行放置动画
    if (this.aiPlacing) {
      this.aiPlaceTimer += deltaTime;
      if (this.aiPlaceTimer >= 50) { // 每 50ms 执行一步
        this.aiPlaceTimer = 0;
        this.executeAIStep();
      }
      return;
    }

    // AI 思考计时
    this.aiTimer += deltaTime;
    if (this.aiTimer >= this.aiInterval) {
      this.aiTimer = 0;
      this.makeAIDecision();
    }
  }

  /**
   * AI 做出放置决策
   * 使用启发式评估函数选择最优放置位置
   */
  private makeAIDecision(): void {
    if (!this.ai.currentPiece) return;

    const decision = this.findBestPlacement(this.ai);
    this.aiDecision = decision;

    // 开始执行放置动画
    this.aiPlacing = true;
    this.aiPlaceTimer = 0;
  }

  /**
   * 逐步执行 AI 的放置决策
   *
   * 执行顺序：先旋转到目标角度，再水平移动到目标列，最后硬降
   */
  private executeAIStep(): void {
    if (!this.ai.currentPiece || !this.aiDecision) {
      this.aiPlacing = false;
      return;
    }

    const { targetX, targetRotation } = this.aiDecision;
    const piece = this.ai.currentPiece;

    // 先旋转
    if (targetRotation > 0) {
      this.rotatePiece(this.ai);
      this.aiDecision.targetRotation--;
      return;
    }

    // 再水平移动
    if (piece.x < targetX) {
      this.movePieceHorizontal(this.ai, 1);
      return;
    } else if (piece.x > targetX) {
      this.movePieceHorizontal(this.ai, -1);
      return;
    }

    // 到达目标位置 → 硬降
    this.hardDrop(this.ai);
    this.aiPlacing = false;
    this.aiDecision = null;
  }

  /**
   * 寻找最佳放置位置（启发式评估）
   *
   * 遍历所有可能的旋转和列位置，对每种放置评估棋盘质量，
   * 选择得分最高的放置方案。
   *
   * 评估维度：聚合高度、空洞数、完整行数、凹凸度
   */
  private findBestPlacement(board: BoardState): AIDecision {
    if (!board.currentPiece) {
      return { targetX: 5, targetRotation: 0 };
    }

    const originalShape = TETROMINO_SHAPES[board.currentPiece.type];
    let bestScore = -Infinity;
    let bestDecision: AIDecision = { targetX: board.currentPiece.x, targetRotation: 0 };

    // 尝试所有旋转 (0-3)
    for (let rotation = 0; rotation < 4; rotation++) {
      let shape = originalShape.map((row) => [...row]);
      for (let r = 0; r < rotation; r++) {
        shape = this.rotateMatrixCW(shape);
      }

      // 尝试所有列位置
      for (let x = -2; x < COLS + 2; x++) {
        // 找到该位置的初始 y
        let y = 0;
        if (!this.isValid(board.grid, shape, x, y)) {
          y = -1;
          if (!this.isValid(board.grid, shape, x, y)) continue;
        }

        // 下落到最底
        while (this.isValid(board.grid, shape, x, y + 1)) {
          y++;
        }

        // 模拟放置
        const testGrid = board.grid.map((row) => [...row]);
        let validPlace = false;
        for (let dy = 0; dy < shape.length; dy++) {
          for (let dx = 0; dx < shape[dy].length; dx++) {
            if (!shape[dy][dx]) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
              testGrid[ny][nx] = board.currentPiece.type + 1;
              validPlace = true;
            }
          }
        }

        if (!validPlace) continue;

        // 评估放置后的棋盘质量
        const score = this.evaluateBoard(testGrid);
        if (score > bestScore) {
          bestScore = score;
          bestDecision = { targetX: x, targetRotation: rotation };
        }
      }
    }

    // 简单难度：有一定概率随机选择（增加不确定性）
    if (Math.random() < AI_EASY_RANDOM_CHANCE) {
      const rotations = [0, 1, 2, 3];
      const randomRotation = rotations[Math.floor(Math.random() * rotations.length)];
      const randomX = Math.floor(Math.random() * COLS);
      return { targetX: randomX, targetRotation: randomRotation };
    }

    return bestDecision;
  }

  /**
   * 评估棋盘状态（启发式打分）
   *
   * 综合考虑：
   * - 聚合高度：所有列高度之和（越低越好）
   * - 空洞数：被方块覆盖的空格数（越少越好）
   * - 完整行数：可消除的满行数（越多越好）
   * - 凹凸度：相邻列高度差之和（越小越好）
   */
  private evaluateBoard(grid: number[][]): number {
    const heights = this.getColumnHeights(grid);
    const aggregateHeight = heights.reduce((sum, h) => sum + h, 0);
    const holes = this.countHoles(grid);
    const bumpiness = this.calculateBumpiness(heights);
    const completeLines = this.countCompleteLines(grid);

    // 基础奖励：空棋盘得分最高，方块越多扣分越多
    const totalCells = aggregateHeight;
    const baseBonus = totalCells === 0 ? 50 : 0;

    return (
      baseBonus +
      AI_WEIGHTS.aggregateHeight * aggregateHeight +
      AI_WEIGHTS.holes * holes +
      AI_WEIGHTS.linesCleared * completeLines +
      AI_WEIGHTS.bumpiness * bumpiness
    );
  }

  /**
   * 获取每列的高度（从底部算起的非空行数）
   */
  private getColumnHeights(grid: number[][]): number[] {
    const heights: number[] = [];
    for (let c = 0; c < COLS; c++) {
      let h = 0;
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c] !== EMPTY_CELL) {
          h = ROWS - r;
          break;
        }
      }
      heights.push(h);
    }
    return heights;
  }

  /**
   * 计算空洞数量（被方块覆盖的空格）
   * 空洞是指某列中，在已有方块下方仍有空格的位置
   */
  private countHoles(grid: number[][]): number {
    let holes = 0;
    for (let c = 0; c < COLS; c++) {
      let foundBlock = false;
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c] !== EMPTY_CELL) {
          foundBlock = true;
        } else if (foundBlock) {
          holes++;
        }
      }
    }
    return holes;
  }

  /**
   * 计算凹凸度（相邻列高度差的绝对值之和）
   */
  private calculateBumpiness(heights: number[]): number {
    let bumpiness = 0;
    for (let i = 0; i < heights.length - 1; i++) {
      bumpiness += Math.abs(heights[i] - heights[i + 1]);
    }
    return bumpiness;
  }

  /**
   * 计算完整行数（所有列都非空的行）
   */
  private countCompleteLines(grid: number[][]): number {
    let count = 0;
    for (let r = 0; r < ROWS; r++) {
      if (grid[r].every((cell) => cell !== EMPTY_CELL)) {
        count++;
      }
    }
    return count;
  }

  // ==================== 渲染辅助方法 ====================

  /**
   * 绘制 HUD（顶部信息栏）
   */
  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = '#12122a';
    ctx.fillRect(0, 0, w, 45);

    // 标题
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TETRIS BATTLE', w / 2, 20);

    // 玩家分数
    ctx.fillStyle = '#60a5fa';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`P1: ${this.player.score}`, BOARD1_OFFSET_X, 38);

    // AI 分数
    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'right';
    ctx.fillText(`AI: ${this.ai.score}`, BOARD2_OFFSET_X + COLS * CELL_SIZE, 38);

    // 等级信息
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv${this.player.level}`, BOARD1_OFFSET_X + COLS * CELL_SIZE - 30, 38);

    ctx.textAlign = 'right';
    ctx.fillText(`Lv${this.ai.level}`, BOARD2_OFFSET_X + 30, 38);
  }

  /**
   * 绘制单个棋盘（含方块、幽灵、预览、标签）
   */
  private drawBoard(
    ctx: CanvasRenderingContext2D,
    board: BoardState,
    offsetX: number,
    offsetY: number,
    label: string,
  ): void {
    const boardWidth = COLS * CELL_SIZE;
    const boardHeight = ROWS * CELL_SIZE;

    // 棋盘背景
    ctx.fillStyle = '#0d0d20';
    ctx.fillRect(offsetX, offsetY, boardWidth, boardHeight);

    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + r * CELL_SIZE);
      ctx.lineTo(offsetX + boardWidth, offsetY + r * CELL_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + c * CELL_SIZE, offsetY);
      ctx.lineTo(offsetX + c * CELL_SIZE, offsetY + boardHeight);
      ctx.stroke();
    }

    // 已放置的方块
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board.grid[r][c];
        if (cell !== EMPTY_CELL) {
          const color = cell === GARBAGE_CELL ? GARBAGE_COLOR : TETROMINO_COLORS[cell - 1];
          this.drawCell(ctx, offsetX + c * CELL_SIZE, offsetY + r * CELL_SIZE, color, true);
        }
      }
    }

    // 幽灵方块（投影）
    if (board.currentPiece) {
      const ghostY = this.getGhostY(board);
      if (ghostY !== board.currentPiece.y) {
        board.currentPiece.shape.forEach((row, dy) => {
          row.forEach((val, dx) => {
            if (val) {
              const gx = board.currentPiece!.x + dx;
              const gy = ghostY + dy;
              if (gy >= 0 && gy < ROWS) {
                this.drawCell(
                  ctx,
                  offsetX + gx * CELL_SIZE,
                  offsetY + gy * CELL_SIZE,
                  GHOST_COLORS[board.currentPiece!.type],
                  false,
                );
              }
            }
          });
        });
      }

      // 当前方块
      board.currentPiece.shape.forEach((row, dy) => {
        row.forEach((val, dx) => {
          if (val) {
            const px = board.currentPiece!.x + dx;
            const py = board.currentPiece!.y + dy;
            if (py >= 0 && py < ROWS) {
              this.drawCell(
                ctx,
                offsetX + px * CELL_SIZE,
                offsetY + py * CELL_SIZE,
                TETROMINO_COLORS[board.currentPiece!.type],
                true,
              );
            }
          }
        });
      });
    }

    // 棋盘边框（死亡时变红）
    ctx.strokeStyle = board.dead ? '#ef4444' : '#6c5ce7';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX - 1, offsetY - 1, boardWidth + 2, boardHeight + 2);

    // 标签
    ctx.fillStyle = board.dead ? '#ef4444' : '#94a3b8';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, offsetX + boardWidth / 2, offsetY - 5);

    // 下一个方块预览
    this.drawNextPreview(ctx, board, offsetX + boardWidth + 5, offsetY);
  }

  /**
   * 绘制下一个方块预览
   */
  private drawNextPreview(ctx: CanvasRenderingContext2D, board: BoardState, x: number, y: number): void {
    if (board.nextType < 0) return;

    const shape = TETROMINO_SHAPES[board.nextType];
    const previewCellSize = 8;
    const previewW = shape[0].length * previewCellSize;
    const previewH = shape.length * previewCellSize;

    // 背景
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, y, 36, 36);

    // 标签
    ctx.fillStyle = '#64748b';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', x + 18, y - 3);

    // 方块
    const ox = x + (36 - previewW) / 2;
    const oy = y + (36 - previewH) / 2;
    shape.forEach((row, dy) => {
      row.forEach((val, dx) => {
        if (val) {
          ctx.fillStyle = TETROMINO_COLORS[board.nextType];
          ctx.fillRect(
            ox + dx * previewCellSize + 1,
            oy + dy * previewCellSize + 1,
            previewCellSize - 2,
            previewCellSize - 2,
          );
        }
      });
    });
  }

  /**
   * 绘制攻击指示器（红色条形，显示待接收垃圾行数）
   */
  private drawAttackIndicators(ctx: CanvasRenderingContext2D): void {
    // 玩家待接收的垃圾行
    if (this.player.pendingGarbage > 0) {
      const barHeight = Math.min(this.player.pendingGarbage * CELL_SIZE, ROWS * CELL_SIZE);
      const x = BOARD1_OFFSET_X - 6;
      const y = BOARD_OFFSET_Y + ROWS * CELL_SIZE - barHeight;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x, y, 4, barHeight);
    }

    // AI 待接收的垃圾行
    if (this.ai.pendingGarbage > 0) {
      const barHeight = Math.min(this.ai.pendingGarbage * CELL_SIZE, ROWS * CELL_SIZE);
      const x = BOARD2_OFFSET_X + COLS * CELL_SIZE + 2;
      const y = BOARD_OFFSET_Y + ROWS * CELL_SIZE - barHeight;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x, y, 4, barHeight);
    }
  }

  /**
   * 绘制 VS 标志（两个棋盘中间）
   */
  private drawVS(ctx: CanvasRenderingContext2D): void {
    const centerX = BOARD1_OFFSET_X + COLS * CELL_SIZE + BOARD_GAP / 2;
    const centerY = BOARD_OFFSET_Y + (ROWS * CELL_SIZE) / 2;

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', centerX, centerY);
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * 绘制游戏结束覆盖层
   */
  private drawGameOverOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    // 结果文字
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this._isWin) {
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('YOU WIN!', w / 2, h / 2 - 20);
    } else {
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('YOU LOSE', w / 2, h / 2 - 20);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px monospace';
    ctx.fillText('Press R to restart', w / 2, h / 2 + 20);
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * 绘制单个单元格（带高光和阴影效果）
   */
  private drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, solid: boolean): void {
    const padding = 1;
    const size = CELL_SIZE - padding * 2;

    if (solid) {
      // 主体
      ctx.fillStyle = color;
      ctx.fillRect(x + padding, y + padding, size, size);
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x + padding, y + padding, size, 2);
      ctx.fillRect(x + padding, y + padding, 2, size);
      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + padding, y + padding + size - 2, size, 2);
      ctx.fillRect(x + padding + size - 2, y + padding, 2, size);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x + padding, y + padding, size, size);
    }
  }

  // ==================== 公开测试辅助方法 ====================

  /**
   * 获取玩家棋盘状态（内部对象引用，测试用）
   */
  getPlayerState(): BoardState {
    return this.player;
  }

  /**
   * 获取 AI 棋盘状态（内部对象引用，测试用）
   */
  getAIState(): BoardState {
    return this.ai;
  }

  /**
   * 获取幽灵方块 Y 坐标（测试用）
   */
  getGhostYForBoard(board: BoardState): number {
    return this.getGhostY(board);
  }

  /**
   * 获取 AI 决策间隔
   */
  getAIInterval(): number {
    return this.aiInterval;
  }

  /**
   * 设置 AI 决策间隔（测试用）
   */
  setAIInterval(interval: number): void {
    this.aiInterval = interval;
  }

  /**
   * 手动触发 AI 决策（测试用）
   */
  triggerAIDecision(): void {
    this.makeAIDecision();
  }

  /**
   * 手动执行 AI 一步（测试用）
   */
  triggerAIStep(): void {
    this.executeAIStep();
  }

  /**
   * AI 是否正在放置
   */
  isAIPlacing(): boolean {
    return this.aiPlacing;
  }

  /**
   * 设置 AI 放置状态（测试用）
   */
  setAIPlacing(val: boolean): void {
    this.aiPlacing = val;
  }

  /**
   * 将玩家缓冲的攻击转移到 AI 的 pendingGarbage
   */
  private transferAttacks(): void {
    if (this.playerAttackPending > 0) {
      this.ai.pendingGarbage += this.playerAttackPending;
      this.playerAttackPending = 0;
    }
  }

  /**
   * 获取玩家待发送攻击行数
   */
  getPlayerAttackPending(): number {
    return this.playerAttackPending;
  }

  /**
   * 获取 AI 待发送攻击行数
   */
  getAIAttackPending(): number {
    return 0;
  }
}
