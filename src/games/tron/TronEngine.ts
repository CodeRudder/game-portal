import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  GRID_SIZE,
  GRID_COLS,
  GRID_ROWS,
  INITIAL_SPEED,
  SPEED_INCREASE,
  MIN_SPEED,
  SPEED_SCORE_INTERVAL,
  PLAYER_COLORS,
  TRAIL_COLORS,
  HEAD_COLORS,
  GRID_BG_COLOR,
  GRID_LINE_COLOR,
  Direction,
  OPPOSITE,
  DIR_DELTA,
} from './constants';

// ========== 内部数据结构 ==========

interface Player {
  row: number;
  col: number;
  direction: Direction;
  trail: { row: number; col: number }[];
  alive: boolean;
  score: number;
}

interface GridCell {
  occupied: boolean;
  playerIndex: number; // -1 if empty
}

// ========== Tron 贪吃虫引擎 ==========

export class TronEngine extends GameEngine {
  // ---- 玩家 ----
  private players: Player[] = [];

  // ---- 网格 ----
  private grid: GridCell[][] = [];

  // ---- 速度 ----
  private speed: number = INITIAL_SPEED;
  private moveTimer: number = 0;
  private moveCount: number = 0;

  // ---- AI ----
  private aiEnabled: boolean = false;

  // ---- 回合状态 ----
  private roundOver: boolean = false;
  private winner: number = -1; // -1=none, 0=P1, 1=P2, 2=draw

  // ---- 胜利标记（供 GameContainer 使用） ----
  public isWin: boolean = false;

  constructor() {
    super();
  }

  // ========== 公开属性 ==========

  get playerCount(): number {
    return this.players.length;
  }

  get isAIEnabled(): boolean {
    return this.aiEnabled;
  }

  get roundWinner(): number {
    return this.winner;
  }

  getPlayer(index: number): Player {
    return this.players[index];
  }

  isPlayerAlive(index: number): boolean {
    return this.players[index]?.alive ?? false;
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.aiEnabled = false;
    this.initGrid();
    this.initPlayers();
  }

  protected onStart(): void {
    this.speed = INITIAL_SPEED;
    this.moveTimer = 0;
    this.moveCount = 0;
    this.roundOver = false;
    this.winner = -1;
    this.isWin = false;
    this.initGrid();
    this.initPlayers();
  }

  protected update(deltaTime: number): void {
    if (this.roundOver) return;

    this.moveTimer += deltaTime;
    if (this.moveTimer >= this.speed) {
      this.moveTimer -= this.speed;

      // AI 移动
      if (this.aiEnabled && this.players[1].alive) {
        this.aiMove(1);
      }

      this.movePlayers();
      this.checkCollisions();

      if (this.roundOver) {
        this.finishRound();
      } else {
        this.moveCount++;

        // 速度递增：每 SPEED_SCORE_INTERVAL 步加速一次
        if (this.moveCount % SPEED_SCORE_INTERVAL === 0) {
          this.speed = Math.max(MIN_SPEED, this.speed - SPEED_INCREASE);
          this.emit('speedChange', this.speed);
        }
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 深色背景
    ctx.fillStyle = GRID_BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * GRID_SIZE, HUD_HEIGHT);
      ctx.lineTo(c * GRID_SIZE, HUD_HEIGHT + GRID_ROWS * GRID_SIZE);
      ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, HUD_HEIGHT + r * GRID_SIZE);
      ctx.lineTo(GRID_COLS * GRID_SIZE, HUD_HEIGHT + r * GRID_SIZE);
      ctx.stroke();
    }

    // 轨迹（霓虹发光效果）
    for (let pi = 0; pi < this.players.length; pi++) {
      const player = this.players[pi];

      // 轨迹主体
      ctx.fillStyle = TRAIL_COLORS[pi];
      for (const cell of player.trail) {
        ctx.fillRect(
          cell.col * GRID_SIZE,
          HUD_HEIGHT + cell.row * GRID_SIZE,
          GRID_SIZE,
          GRID_SIZE
        );
      }

      // 头部（带发光效果）
      if (player.alive) {
        // 外发光
        ctx.save();
        ctx.shadowColor = HEAD_COLORS[pi];
        ctx.shadowBlur = 12;
        ctx.fillStyle = HEAD_COLORS[pi];
        ctx.fillRect(
          player.col * GRID_SIZE,
          HUD_HEIGHT + player.row * GRID_SIZE,
          GRID_SIZE,
          GRID_SIZE
        );
        ctx.restore();

        // 内核高亮
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
          player.col * GRID_SIZE + 2,
          HUD_HEIGHT + player.row * GRID_SIZE + 2,
          GRID_SIZE - 4,
          GRID_SIZE - 4
        );
      }
    }

    // HUD 区域
    this.renderHUD(ctx, w);

    // 游戏状态叠加层
    this.renderOverlay(ctx, w, h);
  }

  /** 渲染 HUD 信息栏 */
  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = 'rgba(10, 10, 26, 0.9)';
    ctx.fillRect(0, 0, w, HUD_HEIGHT);
    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(w, HUD_HEIGHT);
    ctx.stroke();

    // P1 分数
    ctx.save();
    ctx.shadowColor = PLAYER_COLORS[0];
    ctx.shadowBlur = 6;
    ctx.fillStyle = PLAYER_COLORS[0];
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P1: ${this.players[0]?.score ?? 0}`, 12, HUD_HEIGHT / 2);
    ctx.restore();

    // 速度指示
    ctx.fillStyle = '#888888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const speedPercent = Math.round(((INITIAL_SPEED - this.speed) / (INITIAL_SPEED - MIN_SPEED)) * 100);
    ctx.fillText(`⚡ ${this.speed}ms (${speedPercent}%)`, w / 2, HUD_HEIGHT / 2);

    // P2 分数
    ctx.save();
    ctx.shadowColor = PLAYER_COLORS[1];
    ctx.shadowBlur = 6;
    ctx.fillStyle = PLAYER_COLORS[1];
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P2: ${this.players[1]?.score ?? 0}${this.aiEnabled ? ' 🤖' : ''}`, w - 12, HUD_HEIGHT / 2);
    ctx.restore();
  }

  /** 渲染状态叠加层 */
  private renderOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 空闲状态
    if (this._status === 'idle') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡ TRON', w / 2, h / 2 - 40);
      ctx.restore();

      ctx.fillStyle = '#cccccc';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('按空格开始', w / 2, h / 2);
      ctx.font = '13px monospace';
      ctx.fillStyle = '#888888';
      ctx.fillText('P1: WASD | P2: 方向键', w / 2, h / 2 + 25);
      ctx.fillText('T 切换 AI 模式', w / 2, h / 2 + 45);
    }

    // 回合结束
    if (this.roundOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (this.winner === 2) {
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 24px monospace';
        ctx.fillText('⚡ 平局！', w / 2, h / 2 - 15);
      } else {
        const winColor = PLAYER_COLORS[this.winner];
        ctx.shadowColor = winColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = winColor;
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`⚡ P${this.winner + 1} 获胜！`, w / 2, h / 2 - 15);
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '14px monospace';
      ctx.fillText('按 R 重来', w / 2, h / 2 + 20);
      ctx.restore();
    }
  }

  protected onReset(): void {
    this.initGrid();
    this.initPlayers();
    this.speed = INITIAL_SPEED;
    this.moveTimer = 0;
    this.moveCount = 0;
    this.roundOver = false;
    this.winner = -1;
    this.isWin = false;
  }

  protected onGameOver(): void {
    // 游戏结束回调
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    // 空格键：空闲状态下开始游戏
    if (key === ' ' && this._status === 'idle') {
      return;
    }

    // T 键：切换 AI 模式
    if (key === 't' || key === 'T') {
      this.aiEnabled = !this.aiEnabled;
      this.emit('stateChange', this.getState());
      return;
    }

    // R 键：回合结束后重置
    if (key === 'r' || key === 'R') {
      if (this.roundOver) {
        this.reset();
        return;
      }
    }

    if (this._status !== 'playing' || this.roundOver) return;

    // 玩家1：WASD 控制
    const p1 = this.players[0];
    if (p1.alive) {
      switch (key.toLowerCase()) {
        case 'w':
          if (p1.direction !== OPPOSITE[Direction.UP]) p1.direction = Direction.UP;
          break;
        case 's':
          if (p1.direction !== OPPOSITE[Direction.DOWN]) p1.direction = Direction.DOWN;
          break;
        case 'a':
          if (p1.direction !== OPPOSITE[Direction.LEFT]) p1.direction = Direction.LEFT;
          break;
        case 'd':
          if (p1.direction !== OPPOSITE[Direction.RIGHT]) p1.direction = Direction.RIGHT;
          break;
      }
    }

    // 玩家2：方向键控制（仅非 AI 模式）
    if (!this.aiEnabled) {
      const p2 = this.players[1];
      if (p2.alive) {
        switch (key) {
          case 'ArrowUp':
            if (p2.direction !== OPPOSITE[Direction.UP]) p2.direction = Direction.UP;
            break;
          case 'ArrowDown':
            if (p2.direction !== OPPOSITE[Direction.DOWN]) p2.direction = Direction.DOWN;
            break;
          case 'ArrowLeft':
            if (p2.direction !== OPPOSITE[Direction.LEFT]) p2.direction = Direction.LEFT;
            break;
          case 'ArrowRight':
            if (p2.direction !== OPPOSITE[Direction.RIGHT]) p2.direction = Direction.RIGHT;
            break;
        }
      }
    }
  }

  handleKeyUp(_key: string): void {
    // 无需处理
  }

  getState(): Record<string, unknown> {
    return {
      players: this.players.map(p => ({
        row: p.row,
        col: p.col,
        direction: p.direction,
        trail: [...p.trail],
        alive: p.alive,
        score: p.score,
      })),
      speed: this.speed,
      moveCount: this.moveCount,
      roundOver: this.roundOver,
      winner: this.winner,
      aiEnabled: this.aiEnabled,
    };
  }

  // ========== AI 逻辑 ==========

  /** 设置 AI 开关 */
  setAI(enabled: boolean): void {
    this.aiEnabled = enabled;
  }

  /** AI 寻路决策 */
  private aiMove(playerIndex: number): void {
    const player = this.players[playerIndex];
    if (!player.alive) return;

    const currentDir = player.direction;
    const opposite = OPPOSITE[currentDir];

    // 评估所有可能方向（排除反向）
    const directions = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]
      .filter(d => d !== opposite);

    let bestDir = currentDir;
    let bestScore = -Infinity;

    for (const dir of directions) {
      const delta = DIR_DELTA[dir];
      const nextRow = player.row + delta.dr;
      const nextCol = player.col + delta.dc;

      // 不安全方向跳过（除非所有方向都不安全）
      if (!this.isInBounds(nextRow, nextCol) || this.grid[nextRow][nextCol].occupied) {
        continue;
      }

      let score = 0;

      // 偏好靠近网格中心
      const centerRow = GRID_ROWS / 2;
      const centerCol = GRID_COLS / 2;
      const distToCenter = Math.abs(nextRow - centerRow) + Math.abs(nextCol - centerCol);
      score -= distToCenter * 0.1;

      // 偏好前方更开阔的空间
      let openCells = 0;
      for (let look = 1; look <= 5; look++) {
        const lookRow = player.row + delta.dr * look;
        const lookCol = player.col + delta.dc * look;
        if (this.isInBounds(lookRow, lookCol) && !this.grid[lookRow][lookCol].occupied) {
          openCells++;
        }
      }
      score += openCells * 2;

      // 轻微偏好保持当前方向（稳定性）
      if (dir === currentDir) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }

    player.direction = bestDir;
  }

  // ========== 核心逻辑 ==========

  /** 初始化空白网格 */
  private initGrid(): void {
    this.grid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        this.grid[r][c] = { occupied: false, playerIndex: -1 };
      }
    }
  }

  /** 初始化两个玩家 */
  private initPlayers(): void {
    // P1: 左上区域，面向右
    // P2: 右下区域，面向左
    const p1StartRow = Math.floor(GRID_ROWS * 0.25);
    const p1StartCol = Math.floor(GRID_COLS * 0.25);
    const p2StartRow = Math.floor(GRID_ROWS * 0.75);
    const p2StartCol = Math.floor(GRID_COLS * 0.75);

    this.players = [
      {
        row: p1StartRow,
        col: p1StartCol,
        direction: Direction.RIGHT,
        trail: [{ row: p1StartRow, col: p1StartCol }],
        alive: true,
        score: 0,
      },
      {
        row: p2StartRow,
        col: p2StartCol,
        direction: Direction.LEFT,
        trail: [{ row: p2StartRow, col: p2StartCol }],
        alive: true,
        score: 0,
      },
    ];

    // 在网格上标记起始位置
    this.grid[p1StartRow][p1StartCol] = { occupied: true, playerIndex: 0 };
    this.grid[p2StartRow][p2StartCol] = { occupied: true, playerIndex: 1 };
  }

  /** 移动所有存活的玩家 */
  private movePlayers(): void {
    for (let pi = 0; pi < this.players.length; pi++) {
      const player = this.players[pi];
      if (!player.alive) continue;

      const delta = DIR_DELTA[player.direction];
      player.row += delta.dr;
      player.col += delta.dc;
    }
  }

  /** 检查碰撞（墙壁、自身轨迹、对方轨迹、头部对撞） */
  private checkCollisions(): void {
    let p1Dead = false;
    let p2Dead = false;

    for (let pi = 0; pi < this.players.length; pi++) {
      const player = this.players[pi];
      if (!player.alive) continue;

      // 撞墙检测
      if (!this.isInBounds(player.row, player.col)) {
        player.alive = false;
        if (pi === 0) p1Dead = true;
        else p2Dead = true;
        continue;
      }

      // 轨迹碰撞检测（自身或对方的轨迹）
      if (this.grid[player.row][player.col].occupied) {
        player.alive = false;
        if (pi === 0) p1Dead = true;
        else p2Dead = true;
        continue;
      }

      // 头部对撞检测（两玩家移动到同一格）
      const other = this.players[1 - pi];
      if (other.alive && player.row === other.row && player.col === other.col) {
        player.alive = false;
        if (pi === 0) p1Dead = true;
        else p2Dead = true;
      }
    }

    // 判定胜负
    if (p1Dead || p2Dead) {
      this.roundOver = true;

      if (p1Dead && p2Dead) {
        this.winner = 2; // 平局
      } else if (p1Dead) {
        this.winner = 1; // P2 获胜
      } else {
        this.winner = 0; // P1 获胜
      }
    } else {
      // 安全移动：标记新位置并添加到轨迹
      for (let pi = 0; pi < this.players.length; pi++) {
        const player = this.players[pi];
        if (!player.alive) continue;

        this.grid[player.row][player.col] = { occupied: true, playerIndex: pi };
        player.trail.push({ row: player.row, col: player.col });
      }
    }
  }

  /** 回合结束：计算分数并触发游戏结束 */
  private finishRound(): void {
    // 计算每个玩家的分数
    for (let pi = 0; pi < this.players.length; pi++) {
      const player = this.players[pi];
      // 分数 = 轨迹长度
      player.score = player.trail.length;

      // 胜利者额外奖励 10 分
      if (this.winner === pi) {
        player.score += 10;
      }
    }

    // 设置 isWin 标记（供 GameContainer 使用）
    // Tron 中 P1 获胜视为 "胜利"，其他情况视为 "未胜利"
    this.isWin = this.winner === 0;

    // 更新引擎总分（两个玩家分数之和）
    const totalScore = this.players.reduce((sum, p) => sum + p.score, 0);
    this._score = totalScore;
    this.emit('scoreChange', this._score);

    // 触发游戏结束
    this.gameOver();
  }

  /** 判断坐标是否在网格内 */
  private isInBounds(row: number, col: number): boolean {
    return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS;
  }

  // ========== 测试辅助方法 ==========

  /** 获取网格（测试用） */
  getGrid(): GridCell[][] {
    return this.grid;
  }

  /** 获取当前速度（测试用） */
  getSpeed(): number {
    return this.speed;
  }

  /** 获取移动步数（测试用） */
  getMoveCount(): number {
    return this.moveCount;
  }
}
