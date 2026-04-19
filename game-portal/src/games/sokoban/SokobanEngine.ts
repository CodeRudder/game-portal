import { GameEngine } from '@/core/GameEngine';

const CELL_SIZE = 40;

// 地图元素
const EMPTY = 0;
const WALL = 1;
const BOX = 2;
const TARGET = 3;
const BOX_ON_TARGET = 4;
const PLAYER = 5;
const PLAYER_ON_TARGET = 6;

// 关卡数据：二维数组
// 0=空 1=墙 2=箱子 3=目标 4=箱子在目标 5=玩家 6=玩家在目标
const LEVELS: number[][][] = [
  // Level 1 - 简单入门
  [
    [1,1,1,1,1,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,2,0,1,1,1,1],
    [1,0,0,0,0,0,3,1],
    [1,1,1,0,1,5,3,1],
    [0,0,1,0,1,1,1,1],
    [0,0,1,2,1,0,0,0],
    [0,0,1,0,1,0,0,0],
    [0,0,1,1,1,0,0,0],
  ],
  // Level 2
  [
    [0,1,1,1,1,0],
    [1,1,0,0,1,0],
    [1,0,5,2,1,0],
    [1,1,0,2,1,1],
    [1,1,0,0,0,1],
    [1,3,2,0,0,1],
    [1,0,0,3,0,1],
    [1,1,1,1,1,1],
  ],
  // Level 3
  [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,2,0,2,0,1],
    [1,0,0,5,0,0,1],
    [1,0,2,0,2,0,1],
    [1,0,0,3,0,0,1],
    [1,0,0,3,0,0,1],
    [1,0,0,3,0,0,1],
    [1,1,1,1,1,1,1],
  ],
  // Level 4
  [
    [0,0,1,1,1,1,0],
    [1,1,1,0,0,1,0],
    [1,0,5,0,0,1,0],
    [1,0,0,2,3,1,1],
    [1,1,1,0,2,0,1],
    [0,1,1,1,3,0,1],
    [0,1,0,0,0,0,1],
    [0,1,0,0,1,1,1],
    [0,1,1,1,1,0,0],
  ],
  // Level 5
  [
    [0,1,1,1,1,1,0,0],
    [0,1,0,0,0,1,0,0],
    [1,1,0,2,0,1,1,1],
    [1,0,0,0,2,0,0,1],
    [1,0,2,5,0,0,0,1],
    [1,0,0,0,2,0,0,1],
    [1,1,0,0,0,1,1,1],
    [0,1,0,0,3,1,0,0],
    [0,1,3,3,3,1,0,0],
    [0,1,1,1,1,1,0,0],
  ],
];

export class SokobanEngine extends GameEngine {
  private board: number[][] = [];
  private playerX: number = 0;
  private playerY: number = 0;
  private currentLevel: number = 0;
  private moves: number = 0;
  private pushes: number = 0;
  private history: { board: number[][]; px: number; py: number; moves: number; pushes: number }[] = [];
  private _totalLevels: number = LEVELS.length;

  get totalLevels(): number {
    return this._totalLevels;
  }

  get currentLevelIndex(): number {
    return this.currentLevel;
  }

  get moveCount(): number {
    return this.moves;
  }

  get pushCount(): number {
    return this.pushes;
  }

  protected onInit(): void {
    this.loadLevel(0);
  }

  protected onStart(): void {
    this.loadLevel(this.currentLevel);
  }

  protected onReset(): void {
    this.loadLevel(this.currentLevel);
  }

  protected update(_deltaTime: number): void {
    // 推箱子是回合制，不需要持续更新
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.board.length === 0) return;

    const rows = this.board.length;
    const cols = this.board[0].length;
    const offsetX = (w - cols * CELL_SIZE) / 2;
    const offsetY = (h - rows * CELL_SIZE) / 2;

    // 背景
    ctx.fillStyle = '#0d0d20';
    ctx.fillRect(0, 0, w, h);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * CELL_SIZE;
        const y = offsetY + r * CELL_SIZE;
        const cell = this.board[r][c];

        // 地板
        if (cell !== WALL && cell !== EMPTY) {
          ctx.fillStyle = '#1a1a3a';
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        }

        switch (cell) {
          case WALL:
            ctx.fillStyle = '#2d2d5a';
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            ctx.fillStyle = '#3d3d6a';
            ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            // 砖纹
            ctx.strokeStyle = '#2d2d5a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + CELL_SIZE / 2);
            ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE / 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + CELL_SIZE / 2, y);
            ctx.lineTo(x + CELL_SIZE / 2, y + CELL_SIZE / 2);
            ctx.stroke();
            break;

          case TARGET:
            // 目标点 - 钻石形
            ctx.fillStyle = 'rgba(253, 121, 168, 0.3)';
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            ctx.fillStyle = '#fd79a8';
            ctx.beginPath();
            const cx = x + CELL_SIZE / 2;
            const cy = y + CELL_SIZE / 2;
            const ds = CELL_SIZE / 4;
            ctx.moveTo(cx, cy - ds);
            ctx.lineTo(cx + ds, cy);
            ctx.lineTo(cx, cy + ds);
            ctx.lineTo(cx - ds, cy);
            ctx.closePath();
            ctx.fill();
            break;

          case BOX:
            // 箱子
            ctx.fillStyle = '#e17055';
            ctx.beginPath();
            ctx.roundRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6, 4);
            ctx.fill();
            ctx.fillStyle = '#d35400';
            ctx.fillRect(x + CELL_SIZE / 2 - 1, y + 5, 2, CELL_SIZE - 10);
            ctx.fillRect(x + 5, y + CELL_SIZE / 2 - 1, CELL_SIZE - 10, 2);
            break;

          case BOX_ON_TARGET:
            // 箱子在目标上 - 绿色
            ctx.fillStyle = 'rgba(0, 184, 148, 0.2)';
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            ctx.fillStyle = '#00b894';
            ctx.beginPath();
            ctx.roundRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6, 4);
            ctx.fill();
            ctx.fillStyle = '#00a884';
            ctx.fillRect(x + CELL_SIZE / 2 - 1, y + 5, 2, CELL_SIZE - 10);
            ctx.fillRect(x + 5, y + CELL_SIZE / 2 - 1, CELL_SIZE - 10, 2);
            // 发光
            ctx.shadowColor = '#00b894';
            ctx.shadowBlur = 8;
            ctx.strokeStyle = '#00b894';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6, 4);
            ctx.stroke();
            ctx.shadowBlur = 0;
            break;

          case PLAYER:
          case PLAYER_ON_TARGET:
            if (cell === PLAYER_ON_TARGET) {
              ctx.fillStyle = 'rgba(253, 121, 168, 0.3)';
              ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            }
            // 玩家 - 圆形角色
            ctx.fillStyle = '#6c5ce7';
            ctx.shadowColor = '#6c5ce7';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 2 - 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            // 眼睛
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2 - 5, y + CELL_SIZE / 2 - 3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2 + 5, y + CELL_SIZE / 2 - 3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0d0d20';
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2 - 5, y + CELL_SIZE / 2 - 3, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2 + 5, y + CELL_SIZE / 2 - 3, 1.5, 0, Math.PI * 2);
            ctx.fill();
            // 嘴巴
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 2, 4, 0, Math.PI);
            ctx.stroke();
            break;
        }
      }
    }
  }

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.tryMove(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.tryMove(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.tryMove(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.tryMove(1, 0);
        break;
      case 'z':
      case 'Z':
        this.undo();
        break;
      case 'r':
      case 'R':
        this.reset();
        this._status = 'playing';
        this._startTime = performance.now();
        break;
    }
  }

  handleKeyUp(_key: string): void {}

  getState(): Record<string, unknown> {
    return {
      level: this.currentLevel,
      moves: this.moves,
      pushes: this.pushes,
    };
  }

  loadLevel(index: number): void {
    if (index < 0 || index >= LEVELS.length) return;
    this.currentLevel = index;
    this.moves = 0;
    this.pushes = 0;
    this.history = [];
    this.board = LEVELS[index].map((row) => [...row]);

    // 找到玩家位置
    for (let r = 0; r < this.board.length; r++) {
      for (let c = 0; c < this.board[r].length; c++) {
        if (this.board[r][c] === PLAYER || this.board[r][c] === PLAYER_ON_TARGET) {
          this.playerX = c;
          this.playerY = r;
        }
      }
    }

    this.render();
  }

  nextLevel(): boolean {
    if (this.currentLevel + 1 < this._totalLevels) {
      this.currentLevel++;
      this.loadLevel(this.currentLevel);
      this._status = 'playing';
      this._startTime = performance.now();
      return true;
    }
    return false;
  }

  // ========== 私有方法 ==========

  private tryMove(dx: number, dy: number): void {
    const nx = this.playerX + dx;
    const ny = this.playerY + dy;

    if (!this.inBounds(nx, ny)) return;

    const target = this.board[ny][nx];

    // 目标是墙壁
    if (target === WALL) return;

    // 目标是箱子或箱子在目标上
    if (target === BOX || target === BOX_ON_TARGET) {
      const bx = nx + dx;
      const by = ny + dy;
      if (!this.inBounds(bx, by)) return;
      const behind = this.board[by][bx];
      if (behind === WALL || behind === BOX || behind === BOX_ON_TARGET) return;

      // 保存历史
      this.saveHistory();

      // 移动箱子
      this.board[by][bx] = behind === TARGET ? BOX_ON_TARGET : BOX;
      this.board[ny][nx] = target === BOX_ON_TARGET ? TARGET : EMPTY;
      this.pushes++;
    } else {
      // 保存历史
      this.saveHistory();
    }

    // 移动玩家
    const currentCell = this.board[this.playerY][this.playerX];
    this.board[this.playerY][this.playerX] = currentCell === PLAYER_ON_TARGET ? TARGET : EMPTY;

    const newCell = this.board[ny][nx];
    this.board[ny][nx] = newCell === TARGET ? PLAYER_ON_TARGET : PLAYER;
    this.playerX = nx;
    this.playerY = ny;
    this.moves++;
    this.emit('stateChange');

    // 检查胜利
    if (this.checkWin()) {
      this._score = this.calculateScore();
      this._isWin = true;
      this.gameOver();
    }
  }

  private _isWin: boolean = false;
  get isWin(): boolean {
    return this._isWin;
  }

  private inBounds(x: number, y: number): boolean {
    return y >= 0 && y < this.board.length && x >= 0 && x < this.board[0].length;
  }

  private checkWin(): boolean {
    // 检查是否还有未完成的箱子（不在目标上的箱子）或空目标
    for (const row of this.board) {
      for (const cell of row) {
        // 如果有空目标或不在目标上的箱子，游戏未完成
        if (cell === TARGET || cell === BOX) return false;
      }
    }
    // 所有箱子都在目标上了（只有 BOX_ON_TARGET 或 PLAYER_ON_TARGET）
    return true;
  }

  private calculateScore(): number {
    // 基础分 + 关卡奖励 - 步数惩罚
    return Math.max(100, 1000 - this.moves * 5 + this.currentLevel * 200);
  }

  private saveHistory(): void {
    this.history.push({
      board: this.board.map((r) => [...r]),
      px: this.playerX,
      py: this.playerY,
      moves: this.moves,
      pushes: this.pushes,
    });
    // 限制历史长度
    if (this.history.length > 200) this.history.shift();
  }

  private undo(): void {
    if (this.history.length === 0) return;
    const prev = this.history.pop()!;
    this.board = prev.board;
    this.playerX = prev.px;
    this.playerY = prev.py;
    this.moves = prev.moves;
    this.pushes = prev.pushes;
  }
}
