/**
 * 推箱子冒险 Chips Challenge — 游戏引擎
 *
 * 核心玩法：在网格地图中收集所有芯片后到达出口。
 * 障碍物：墙壁、水（需要靴子）、火（需要靴子）、锁门（需要对应颜色钥匙）
 * 可推动的方块。
 */
import { GameEngine } from '@/core/GameEngine';
import {
  Cell,
  DIR,
  Direction,
  LevelData,
  LEVELS,
  cloneGrid,
  countChips,
  findPlayer,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  CELL_SIZE,
  COLORS,
} from './constants';

// ========== 玩家状态 ==========
interface PlayerState {
  x: number;
  y: number;
  chips: number;
  keys: { red: number; blue: number; green: number };
  hasWaterBoots: boolean;
  hasFireBoots: boolean;
}

// ========== 快照（用于撤销） ==========
interface Snapshot {
  grid: number[][];
  player: PlayerState;
  steps: number;
  exitOpen: boolean;
}

export class ChipsChallengeEngine extends GameEngine {
  // 地图
  private grid: number[][] = [];
  private gridWidth: number = 0;
  private gridHeight: number = 0;

  // 玩家
  private player: PlayerState = {
    x: 0, y: 0,
    chips: 0,
    keys: { red: 0, blue: 0, green: 0 },
    hasWaterBoots: false,
    hasFireBoots: false,
  };

  // 关卡
  private currentLevel: number = 0;
  private chipsRequired: number = 0;
  private exitOpen: boolean = false;
  private _isWin: boolean = false;

  // 统计
  private steps: number = 0;

  // 撤销栈
  private undoStack: Snapshot[] = [];

  // 动画计时
  private animTime: number = 0;

  // ========== 公共属性 ==========

  get isWin(): boolean { return this._isWin; }
  get currentLevelIndex(): number { return this.currentLevel; }
  get totalLevels(): number { return LEVELS.length; }
  get stepCount(): number { return this.steps; }
  get chipsCollected(): number { return this.player.chips; }
  get chipsNeeded(): number { return this.chipsRequired; }
  get isExitOpen(): boolean { return this.exitOpen; }
  get playerPos(): { x: number; y: number } { return { x: this.player.x, y: this.player.y }; }
  get playerKeys(): { red: number; blue: number; green: number } { return { ...this.player.keys }; }
  get hasWaterBoots(): boolean { return this.player.hasWaterBoots; }
  get hasFireBoots(): boolean { return this.player.hasFireBoots; }
  get currentGrid(): number[][] { return this.grid; }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.loadLevel(0);
  }

  protected onStart(): void {
    this.loadLevel(this.currentLevel);
  }

  protected update(deltaTime: number): void {
    this.animTime += deltaTime;
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, w, h);

    this.renderHUD(ctx, w);
    this.renderMap(ctx, w, h);
  }

  protected onReset(): void {
    this.loadLevel(this.currentLevel);
  }

  protected onPause(): void {
    // 暂停无需额外处理
  }

  protected onResume(): void {
    // 恢复无需额外处理
  }

  protected onGameOver(): void {
    // 游戏结束无需额外处理
  }

  protected onDestroy(): void {
    this.undoStack = [];
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    let dir: Direction | null = null;
    switch (key) {
      case 'ArrowUp': case 'w': case 'W': dir = 'UP'; break;
      case 'ArrowDown': case 's': case 'S': dir = 'DOWN'; break;
      case 'ArrowLeft': case 'a': case 'A': dir = 'LEFT'; break;
      case 'ArrowRight': case 'd': case 'D': dir = 'RIGHT'; break;
      case 'z': case 'Z': this.undo(); return;
      case 'r': case 'R': this.reset(); return;
      default: return;
    }

    if (dir) {
      this.movePlayer(dir);
    }
  }

  handleKeyUp(_key: string): void {
    // 无需处理
  }

  getState(): Record<string, unknown> {
    return {
      level: this.currentLevel,
      steps: this.steps,
      chips: this.player.chips,
      chipsRequired: this.chipsRequired,
      exitOpen: this.exitOpen,
      isWin: this._isWin,
      keys: { ...this.player.keys },
      hasWaterBoots: this.player.hasWaterBoots,
      hasFireBoots: this.player.hasFireBoots,
      playerX: this.player.x,
      playerY: this.player.y,
    };
  }

  // ========== 关卡管理 ==========

  /** 加载指定关卡 */
  loadLevel(index: number): void {
    if (index < 0 || index >= LEVELS.length) return;

    this.currentLevel = index;
    const level = LEVELS[index];
    this.grid = cloneGrid(level.grid);
    this.gridHeight = this.grid.length;
    this.gridWidth = this.grid[0].length;
    this.chipsRequired = level.chipsRequired;

    // 查找玩家位置
    const pos = findPlayer(this.grid);
    if (pos) {
      this.player.x = pos.x;
      this.player.y = pos.y;
      this.grid[pos.y][pos.x] = Cell.EMPTY; // 玩家从地图上移除，用状态追踪
    }

    // 重置状态
    this.player.chips = 0;
    this.player.keys = { red: 0, blue: 0, green: 0 };
    this.player.hasWaterBoots = false;
    this.player.hasFireBoots = false;
    this.exitOpen = false;
    this._isWin = false;
    this.steps = 0;
    this.undoStack = [];
    this.animTime = 0;

    this.setLevel(index + 1);
  }

  /** 进入下一关 */
  nextLevel(): void {
    if (this.currentLevel + 1 < LEVELS.length) {
      this.loadLevel(this.currentLevel + 1);
      this._status = 'idle';
      this.emit('statusChange', 'idle');
    }
  }

  // ========== 核心移动逻辑 ==========

  /** 移动玩家 */
  movePlayer(dir: Direction): boolean {
    const { dx, dy } = DIR[dir];
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;

    // 边界检查
    if (!this.inBounds(nx, ny)) return false;

    const targetCell = this.grid[ny][nx];

    // 处理不同目标格子
    if (targetCell === Cell.WALL) return false;

    if (targetCell === Cell.WATER) {
      if (!this.player.hasWaterBoots) return false; // 没有水靴不能通过
      // 有水靴可以通过，水被消耗
      this.saveSnapshot();
      this.grid[ny][nx] = Cell.EMPTY;
      this.executeMove(nx, ny);
      return true;
    }

    if (targetCell === Cell.FIRE) {
      if (!this.player.hasFireBoots) return false; // 没有火靴不能通过
      // 有火靴可以通过，火被消耗
      this.saveSnapshot();
      this.grid[ny][nx] = Cell.EMPTY;
      this.executeMove(nx, ny);
      return true;
    }

    if (targetCell === Cell.DOOR_RED) {
      if (this.player.keys.red <= 0) return false;
      this.saveSnapshot();
      this.player.keys.red--;
      this.grid[ny][nx] = Cell.EMPTY;
      this.executeMove(nx, ny);
      return true;
    }

    if (targetCell === Cell.DOOR_BLUE) {
      if (this.player.keys.blue <= 0) return false;
      this.saveSnapshot();
      this.player.keys.blue--;
      this.grid[ny][nx] = Cell.EMPTY;
      this.executeMove(nx, ny);
      return true;
    }

    if (targetCell === Cell.DOOR_GREEN) {
      if (this.player.keys.green <= 0) return false;
      this.saveSnapshot();
      this.player.keys.green--;
      this.grid[ny][nx] = Cell.EMPTY;
      this.executeMove(nx, ny);
      return true;
    }

    if (targetCell === Cell.BLOCK) {
      // 尝试推方块
      return this.pushBlock(nx, ny, dx, dy);
    }

    if (targetCell === Cell.EXIT) {
      if (!this.exitOpen) return false; // 出口未开
      this.saveSnapshot();
      this.executeMove(nx, ny);
      this.onLevelComplete();
      return true;
    }

    if (targetCell === Cell.EXIT_OPEN) {
      this.saveSnapshot();
      this.executeMove(nx, ny);
      this.onLevelComplete();
      return true;
    }

    // 可拾取物品或空地
    if (targetCell === Cell.EMPTY || targetCell === Cell.CHIP ||
        targetCell === Cell.KEY_RED || targetCell === Cell.KEY_BLUE || targetCell === Cell.KEY_GREEN ||
        targetCell === Cell.BOOTS_WATER || targetCell === Cell.BOOTS_FIRE) {
      this.saveSnapshot();
      this.collectItem(nx, ny, targetCell);
      this.executeMove(nx, ny);
      return true;
    }

    return false;
  }

  /** 执行移动（更新坐标和步数） */
  private executeMove(nx: number, ny: number): void {
    this.player.x = nx;
    this.player.y = ny;
    this.steps++;
    this.emit('stateChange');
  }

  /** 拾取物品 */
  private collectItem(x: number, y: number, cell: number): void {
    switch (cell) {
      case Cell.CHIP:
        this.player.chips++;
        this.grid[y][x] = Cell.EMPTY;
        this.addScore(10);
        this.checkExitOpen();
        break;
      case Cell.KEY_RED:
        this.player.keys.red++;
        this.grid[y][x] = Cell.EMPTY;
        break;
      case Cell.KEY_BLUE:
        this.player.keys.blue++;
        this.grid[y][x] = Cell.EMPTY;
        break;
      case Cell.KEY_GREEN:
        this.player.keys.green++;
        this.grid[y][x] = Cell.EMPTY;
        break;
      case Cell.BOOTS_WATER:
        this.player.hasWaterBoots = true;
        this.grid[y][x] = Cell.EMPTY;
        break;
      case Cell.BOOTS_FIRE:
        this.player.hasFireBoots = true;
        this.grid[y][x] = Cell.EMPTY;
        break;
    }
  }

  /** 检查是否所有芯片已收集 */
  private checkExitOpen(): void {
    if (this.player.chips >= this.chipsRequired && !this.exitOpen) {
      this.exitOpen = true;
      // 将所有 EXIT 变为 EXIT_OPEN
      for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
          if (this.grid[y][x] === Cell.EXIT) {
            this.grid[y][x] = Cell.EXIT_OPEN;
          }
        }
      }
    }
  }

  /** 推方块 */
  private pushBlock(bx: number, by: number, dx: number, dy: number): boolean {
    const behindX = bx + dx;
    const behindY = by + dy;

    // 方块后面必须是空地或水（方块可以推入水中填水）
    if (!this.inBounds(behindX, behindY)) return false;
    const behindCell = this.grid[behindY][behindX];

    if (behindCell !== Cell.EMPTY && behindCell !== Cell.WATER) return false;

    this.saveSnapshot();

    // 移动方块
    this.grid[by][bx] = Cell.EMPTY;
    // 方块推入水中 → 变成空地（填水）
    this.grid[behindY][behindX] = behindCell === Cell.WATER ? Cell.EMPTY : Cell.BLOCK;

    this.executeMove(bx, by);
    return true;
  }

  /** 关卡完成 */
  private onLevelComplete(): void {
    this._isWin = true;
    this.addScore(100 + this.currentLevel * 50);

    if (this.currentLevel + 1 >= LEVELS.length) {
      // 全部通关
      this.gameOver();
    } else {
      // 还有下一关
      this.gameOver();
    }
  }

  // ========== 撤销 ==========

  private saveSnapshot(): void {
    this.undoStack.push({
      grid: cloneGrid(this.grid),
      player: {
        x: this.player.x,
        y: this.player.y,
        chips: this.player.chips,
        keys: { ...this.player.keys },
        hasWaterBoots: this.player.hasWaterBoots,
        hasFireBoots: this.player.hasFireBoots,
      },
      steps: this.steps,
      exitOpen: this.exitOpen,
    });
    // 限制撤销栈大小
    if (this.undoStack.length > 200) {
      this.undoStack.shift();
    }
  }

  /** 撤销上一步 */
  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    const snap = this.undoStack.pop()!;
    this.grid = snap.grid;
    this.player = snap.player;
    this.steps = snap.steps;
    this.exitOpen = snap.exitOpen;
    this.emit('stateChange');
    return true;
  }

  // ========== 工具 ==========

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
  }

  // ========== 渲染 ==========

  private renderHUD(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
    ctx.fillStyle = COLORS.HUD_BG;
    ctx.fillRect(0, 0, canvasWidth, HUD_HEIGHT);

    ctx.font = 'bold 14px monospace';
    ctx.textBaseline = 'middle';

    // 关卡名
    const levelData = LEVELS[this.currentLevel];
    ctx.fillStyle = COLORS.HUD_ACCENT;
    ctx.textAlign = 'left';
    ctx.fillText(`关卡${this.currentLevel + 1}: ${levelData?.name ?? ''}`, 10, 16);

    // 芯片计数
    ctx.fillStyle = COLORS.CHIP;
    ctx.fillText(`💎 ${this.player.chips}/${this.chipsRequired}`, 10, 38);

    // 钥匙
    let keyX = 160;
    if (this.player.keys.red > 0) {
      ctx.fillStyle = COLORS.KEY_RED;
      ctx.fillText(`🔑红×${this.player.keys.red}`, keyX, 16);
      keyX += 80;
    }
    if (this.player.keys.blue > 0) {
      ctx.fillStyle = COLORS.KEY_BLUE;
      ctx.fillText(`🔑蓝×${this.player.keys.blue}`, keyX, 16);
      keyX += 80;
    }
    if (this.player.keys.green > 0) {
      ctx.fillStyle = COLORS.KEY_GREEN;
      ctx.fillText(`🔑绿×${this.player.keys.green}`, keyX, 16);
    }

    // 靴子
    let bootX = 160;
    if (this.player.hasWaterBoots) {
      ctx.fillStyle = COLORS.BOOTS_WATER;
      ctx.fillText('🥾水', bootX, 38);
      bootX += 50;
    }
    if (this.player.hasFireBoots) {
      ctx.fillStyle = COLORS.BOOTS_FIRE;
      ctx.fillText('🥾火', bootX, 38);
    }

    // 步数
    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.textAlign = 'right';
    ctx.fillText(`步数: ${this.steps}`, canvasWidth - 10, 16);

    // 出口状态
    ctx.fillStyle = this.exitOpen ? COLORS.EXIT_OPEN : COLORS.EXIT_CLOSED;
    ctx.fillText(this.exitOpen ? '出口: 开' : '出口: 关', canvasWidth - 10, 38);

    // 分割线
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(canvasWidth, HUD_HEIGHT);
    ctx.stroke();
  }

  private renderMap(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    const mapAreaHeight = canvasHeight - HUD_HEIGHT;
    const offsetX = Math.floor((canvasWidth - this.gridWidth * CELL_SIZE) / 2);
    const offsetY = HUD_HEIGHT + Math.floor((mapAreaHeight - this.gridHeight * CELL_SIZE) / 2);

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const px = offsetX + x * CELL_SIZE;
        const py = offsetY + y * CELL_SIZE;
        this.renderCell(ctx, x, y, px, py);
      }
    }

    // 渲染玩家
    const ppx = offsetX + this.player.x * CELL_SIZE;
    const ppy = offsetY + this.player.y * CELL_SIZE;
    this.renderPlayer(ctx, ppx, ppy);
  }

  private renderCell(ctx: CanvasRenderingContext2D, gx: number, gy: number, px: number, py: number): void {
    const cell = this.grid[gy][gx];
    const cs = CELL_SIZE;

    // 地板
    ctx.fillStyle = COLORS.FLOOR;
    ctx.fillRect(px, py, cs, cs);

    switch (cell) {
      case Cell.WALL:
        ctx.fillStyle = COLORS.WALL;
        ctx.fillRect(px, py, cs, cs);
        // 顶部高光
        ctx.fillStyle = COLORS.WALL_TOP;
        ctx.fillRect(px, py, cs, 4);
        break;

      case Cell.CHIP:
        this.drawChip(ctx, px, py);
        break;

      case Cell.EXIT:
        this.drawExitClosed(ctx, px, py);
        break;

      case Cell.EXIT_OPEN:
        this.drawExitOpen(ctx, px, py);
        break;

      case Cell.WATER:
        this.drawWater(ctx, px, py);
        break;

      case Cell.FIRE:
        this.drawFire(ctx, px, py);
        break;

      case Cell.KEY_RED:
        this.drawKey(ctx, px, py, COLORS.KEY_RED);
        break;

      case Cell.KEY_BLUE:
        this.drawKey(ctx, px, py, COLORS.KEY_BLUE);
        break;

      case Cell.KEY_GREEN:
        this.drawKey(ctx, px, py, COLORS.KEY_GREEN);
        break;

      case Cell.DOOR_RED:
        this.drawDoor(ctx, px, py, COLORS.DOOR_RED);
        break;

      case Cell.DOOR_BLUE:
        this.drawDoor(ctx, px, py, COLORS.DOOR_BLUE);
        break;

      case Cell.DOOR_GREEN:
        this.drawDoor(ctx, px, py, COLORS.DOOR_GREEN);
        break;

      case Cell.BOOTS_WATER:
        this.drawBoots(ctx, px, py, COLORS.BOOTS_WATER, '~');
        break;

      case Cell.BOOTS_FIRE:
        this.drawBoots(ctx, px, py, COLORS.BOOTS_FIRE, '^');
        break;

      case Cell.BLOCK:
        ctx.fillStyle = COLORS.BLOCK;
        ctx.fillRect(px + 2, py + 2, cs - 4, cs - 4);
        ctx.fillStyle = COLORS.BLOCK_TOP;
        ctx.fillRect(px + 2, py + 2, cs - 4, 6);
        ctx.strokeStyle = '#6b5b45';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2, py + 2, cs - 4, cs - 4);
        break;
    }

    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(px, py, cs, cs);
  }

  private drawChip(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    const cs = CELL_SIZE;
    const cx = px + cs / 2;
    const cy = py + cs / 2;
    const r = cs * 0.3;
    const pulse = Math.sin(this.animTime * 0.003) * 2;

    // 发光效果
    ctx.fillStyle = 'rgba(255,215,0,0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4 + pulse, 0, Math.PI * 2);
    ctx.fill();

    // 菱形芯片
    ctx.fillStyle = COLORS.CHIP;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();

    // 高光
    ctx.fillStyle = COLORS.CHIP_GLOW;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 3);
    ctx.lineTo(cx + r - 5, cy);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx - r + 5, cy);
    ctx.closePath();
    ctx.fill();
  }

  private drawExitClosed(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    const cs = CELL_SIZE;
    ctx.fillStyle = COLORS.EXIT_CLOSED;
    ctx.fillRect(px + 4, py + 4, cs - 8, cs - 8);
    // X 标记
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 10);
    ctx.lineTo(px + cs - 10, py + cs - 10);
    ctx.moveTo(px + cs - 10, py + 10);
    ctx.lineTo(px + 10, py + cs - 10);
    ctx.stroke();
  }

  private drawExitOpen(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    const cs = CELL_SIZE;
    const pulse = Math.sin(this.animTime * 0.005) * 0.15 + 0.85;

    ctx.globalAlpha = pulse;
    ctx.fillStyle = COLORS.EXIT_OPEN;
    ctx.fillRect(px + 4, py + 4, cs - 8, cs - 8);
    ctx.globalAlpha = 1;

    // 箭头标记
    const cx = px + cs / 2;
    const cy = py + cs / 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 8, cy);
    ctx.lineTo(cx + 3, cy);
    ctx.lineTo(cx + 3, cy + 8);
    ctx.lineTo(cx - 3, cy + 8);
    ctx.lineTo(cx - 3, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.closePath();
    ctx.fill();
  }

  private drawWater(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    const cs = CELL_SIZE;
    ctx.fillStyle = COLORS.WATER;
    ctx.fillRect(px, py, cs, cs);

    // 波纹
    const wave = Math.sin(this.animTime * 0.002 + px * 0.1) * 3;
    ctx.strokeStyle = COLORS.WATER_DARK;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(px, py + 12 + i * 12 + wave);
      ctx.quadraticCurveTo(px + cs / 2, py + 8 + i * 12 - wave, px + cs, py + 12 + i * 12 + wave);
      ctx.stroke();
    }
  }

  private drawFire(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    const cs = CELL_SIZE;
    const cx = px + cs / 2;

    // 火焰底色
    ctx.fillStyle = '#661100';
    ctx.fillRect(px, py, cs, cs);

    // 火焰形状
    const flicker = Math.sin(this.animTime * 0.008 + py) * 3;
    ctx.fillStyle = COLORS.FIRE;
    ctx.beginPath();
    ctx.moveTo(cx - 12, py + cs - 6);
    ctx.quadraticCurveTo(cx - 8, py + 10 + flicker, cx, py + 6);
    ctx.quadraticCurveTo(cx + 8, py + 10 - flicker, cx + 12, py + cs - 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.FIRE_YELLOW;
    ctx.beginPath();
    ctx.moveTo(cx - 6, py + cs - 8);
    ctx.quadraticCurveTo(cx - 3, py + 16 + flicker, cx, py + 12);
    ctx.quadraticCurveTo(cx + 3, py + 16 - flicker, cx + 6, py + cs - 8);
    ctx.closePath();
    ctx.fill();
  }

  private drawKey(ctx: CanvasRenderingContext2D, px: number, py: number, color: string): void {
    const cs = CELL_SIZE;
    const cx = px + cs / 2;
    const cy = py + cs / 2;

    ctx.fillStyle = color;
    // 钥匙头（圆环）
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.FLOOR;
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 4, 0, Math.PI * 2);
    ctx.fill();

    // 钥匙杆
    ctx.fillStyle = color;
    ctx.fillRect(cx - 2, cy - 2, 4, 16);
    // 齿
    ctx.fillRect(cx, cy + 8, 6, 3);
    ctx.fillRect(cx, cy + 4, 4, 3);
  }

  private drawDoor(ctx: CanvasRenderingContext2D, px: number, py: number, color: string): void {
    const cs = CELL_SIZE;
    ctx.fillStyle = color;
    ctx.fillRect(px + 2, py + 2, cs - 4, cs - 4);

    // 门框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 4, py + 4, cs - 8, cs - 8);

    // 锁孔
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(px + cs / 2, py + cs / 2 - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px + cs / 2 - 2, py + cs / 2 + 2, 4, 6);
  }

  private drawBoots(ctx: CanvasRenderingContext2D, px: number, py: number, color: string, symbol: string): void {
    const cs = CELL_SIZE;

    ctx.fillStyle = color;
    // 靴子形状
    ctx.fillRect(px + 8, py + 6, 12, 28);
    ctx.fillRect(px + 8, py + 28, 28, 10);

    // 符号
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, px + cs / 2, py + cs / 2);
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, px: number, py: number): void {
    const cs = CELL_SIZE;
    const cx = px + cs / 2;
    const cy = py + cs / 2;
    const r = cs * 0.35;

    // 光环
    const pulse = Math.sin(this.animTime * 0.004) * 3;
    ctx.fillStyle = 'rgba(0,255,204,0.1)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4 + pulse, 0, Math.PI * 2);
    ctx.fill();

    // 身体
    ctx.fillStyle = COLORS.PLAYER;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4, cy - 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛高光
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5, cy - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
