import { GameEngine } from '@/core/GameEngine';

// ========== 俄罗斯方块常量 ==========
const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 30;

// 7 种标准方块定义
const SHAPES: number[][][] = [
  // I
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  // O
  [[1,1],[1,1]],
  // T
  [[0,1,0],[1,1,1],[0,0,0]],
  // S
  [[0,1,1],[1,1,0],[0,0,0]],
  // Z
  [[1,1,0],[0,1,1],[0,0,0]],
  // J
  [[1,0,0],[1,1,1],[0,0,0]],
  // L
  [[0,0,1],[1,1,1],[0,0,0]],
];

const COLORS = [
  '#00f3ff', // I - cyan
  '#ffd700', // O - gold
  '#a855f7', // T - purple
  '#00b894', // S - green
  '#e17055', // Z - red
  '#3b82f6', // J - blue
  '#fd79a8', // L - pink
];

const GHOST_COLORS = [
  'rgba(0,243,255,0.15)',
  'rgba(255,215,0,0.15)',
  'rgba(168,85,247,0.15)',
  'rgba(0,184,148,0.15)',
  'rgba(225,112,85,0.15)',
  'rgba(59,130,246,0.15)',
  'rgba(253,121,168,0.15)',
];

// 计分规则
const SCORE_TABLE = [0, 100, 300, 500, 800];

export class TetrisEngine extends GameEngine {
  private board: number[][] = [];
  private currentPiece: { shape: number[][]; type: number; x: number; y: number } | null = null;
  private nextPiece: { shape: number[][]; type: number } | null = null;
  private dropTimer: number = 0;
  private dropInterval: number = 1000;
  private linesCleared: number = 0;
  private _nextType: number = 0;

  get nextType(): number {
    return this._nextType;
  }

  protected onInit(): void {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  protected onStart(): void {
    this.dropTimer = 0;
    this.linesCleared = 0;
    this.dropInterval = 1000;
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this._nextType = this.randomType();
    this.nextPiece = { shape: SHAPES[this._nextType], type: this._nextType };
    this.spawnPiece();
  }

  protected onReset(): void {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.currentPiece = null;
    this.nextPiece = null;
  }

  protected update(deltaTime: number): void {
    if (!this.currentPiece) return;
    this.dropTimer += deltaTime;
    if (this.dropTimer >= this.dropInterval) {
      this.dropTimer = 0;
      this.moveDown();
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const offsetX = (w - COLS * CELL_SIZE) / 2;
    const offsetY = (h - ROWS * CELL_SIZE) / 2;

    // 背景
    ctx.fillStyle = '#0d0d20';
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + r * CELL_SIZE);
      ctx.lineTo(offsetX + COLS * CELL_SIZE, offsetY + r * CELL_SIZE);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + c * CELL_SIZE, offsetY);
      ctx.lineTo(offsetX + c * CELL_SIZE, offsetY + ROWS * CELL_SIZE);
      ctx.stroke();
    }

    // 已放置的方块
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.board[r][c]) {
          this.drawCell(ctx, offsetX + c * CELL_SIZE, offsetY + r * CELL_SIZE, COLORS[this.board[r][c] - 1], true);
        }
      }
    }

    // 幽灵方块（投影）
    if (this.currentPiece) {
      const ghostY = this.getGhostY();
      this.currentPiece.shape.forEach((row, dy) => {
        row.forEach((val, dx) => {
          if (val) {
            const gx = this.currentPiece!.x + dx;
            const gy = ghostY + dy;
            if (gy >= 0) {
              this.drawCell(ctx, offsetX + gx * CELL_SIZE, offsetY + gy * CELL_SIZE, GHOST_COLORS[this.currentPiece!.type], false);
            }
          }
        });
      });

      // 当前方块
      this.currentPiece.shape.forEach((row, dy) => {
        row.forEach((val, dx) => {
          if (val) {
            const px = this.currentPiece!.x + dx;
            const py = this.currentPiece!.y + dy;
            if (py >= 0) {
              this.drawCell(ctx, offsetX + px * CELL_SIZE, offsetY + py * CELL_SIZE, COLORS[this.currentPiece!.type], true);
            }
          }
        });
      });
    }

    // 边框
    ctx.strokeStyle = '#6c5ce7';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX - 1, offsetY - 1, COLS * CELL_SIZE + 2, ROWS * CELL_SIZE + 2);
  }

  handleKeyDown(key: string): void {
    if (this._status !== 'playing' || !this.currentPiece) return;
    switch (key) {
      case 'ArrowLeft':
        this.moveHorizontal(-1);
        break;
      case 'ArrowRight':
        this.moveHorizontal(1);
        break;
      case 'ArrowDown':
        this.moveDown();
        this._score += 1;
        break;
      case 'ArrowUp':
        this.rotate();
        break;
      case ' ':
        this.hardDrop();
        break;
    }
  }

  handleKeyUp(_key: string): void {}

  getState(): Record<string, unknown> {
    return {
      linesCleared: this.linesCleared,
      nextType: this._nextType,
    };
  }

  // ========== 私有方法 ==========

  private randomType(): number {
    return Math.floor(Math.random() * SHAPES.length);
  }

  private spawnPiece(): void {
    if (this.nextPiece) {
      const shape = this.nextPiece.shape;
      const type = this.nextPiece.type;
      this.currentPiece = {
        shape: shape.map((r) => [...r]),
        type,
        x: Math.floor((COLS - shape[0].length) / 2),
        y: -1,
      };
    }

    // 生成下一个
    this._nextType = this.randomType();
    this.nextPiece = { shape: SHAPES[this._nextType], type: this._nextType };

    // 检查是否能放置
    if (this.currentPiece && !this.isValid(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
      this.gameOver();
    }
  }

  private isValid(shape: number[][], px: number, py: number): boolean {
    for (let dy = 0; dy < shape.length; dy++) {
      for (let dx = 0; dx < shape[dy].length; dx++) {
        if (!shape[dy][dx]) continue;
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && this.board[ny][nx]) return false;
      }
    }
    return true;
  }

  private moveHorizontal(dir: number): void {
    if (!this.currentPiece) return;
    const newX = this.currentPiece.x + dir;
    if (this.isValid(this.currentPiece.shape, newX, this.currentPiece.y)) {
      this.currentPiece.x = newX;
    }
  }

  private moveDown(): void {
    if (!this.currentPiece) return;
    if (this.isValid(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y++;
    } else {
      this.lockPiece();
      this.clearLines();
      this.spawnPiece();
    }
  }

  private rotate(): void {
    if (!this.currentPiece) return;
    const rotated = this.rotateMatrix(this.currentPiece.shape);
    // 墙踢
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (this.isValid(rotated, this.currentPiece.x + kick, this.currentPiece.y)) {
        this.currentPiece.shape = rotated;
        this.currentPiece.x += kick;
        return;
      }
    }
  }

  private rotateMatrix(matrix: number[][]): number[][] {
    const n = matrix.length;
    const result: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result[j][n - 1 - i] = matrix[i][j];
      }
    }
    return result;
  }

  private hardDrop(): void {
    if (!this.currentPiece) return;
    let dropDistance = 0;
    while (this.isValid(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y++;
      dropDistance++;
    }
    this._score += dropDistance * 2;
    this.lockPiece();
    this.clearLines();
    this.spawnPiece();
  }

  private getGhostY(): number {
    if (!this.currentPiece) return 0;
    let ghostY = this.currentPiece.y;
    while (this.isValid(this.currentPiece.shape, this.currentPiece.x, ghostY + 1)) {
      ghostY++;
    }
    return ghostY;
  }

  private lockPiece(): void {
    if (!this.currentPiece) return;
    this.currentPiece.shape.forEach((row, dy) => {
      row.forEach((val, dx) => {
        if (val) {
          const nx = this.currentPiece!.x + dx;
          const ny = this.currentPiece!.y + dy;
          if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
            this.board[ny][nx] = this.currentPiece!.type + 1;
          }
        }
      });
    });
  }

  private clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((cell) => cell !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(Array(COLS).fill(0));
        cleared++;
        r++; // recheck this row
      }
    }
    if (cleared > 0) {
      this.linesCleared += cleared;
      this._score += SCORE_TABLE[cleared] * this._level;
      // 升级
      const newLevel = Math.floor(this.linesCleared / 10) + 1;
      if (newLevel > this._level) {
        this._level = newLevel;
        this.dropInterval = Math.max(100, 1000 - (this._level - 1) * 80);
      }
    }
  }

  private drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, solid: boolean): void {
    const padding = 1;
    const size = CELL_SIZE - padding * 2;

    if (solid) {
      // 主体
      ctx.fillStyle = color;
      ctx.fillRect(x + padding, y + padding, size, size);

      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(x + padding, y + padding, size, 3);
      ctx.fillRect(x + padding, y + padding, 3, size);

      // 阴影
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + padding, y + padding + size - 3, size, 3);
      ctx.fillRect(x + padding + size - 3, y + padding, 3, size);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x + padding, y + padding, size, size);
    }
  }
}
