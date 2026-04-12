import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  GRID_SIZE,
  CELL_SIZE,
  PIPE_WIDTH,
  GRID_PADDING_X,
  GRID_PADDING_Y,
  WATER_FLOW_SPEED,
  PREVIEW_COUNT,
  MIN_PIPE_LENGTH,
  COLORS,
  PipeType,
  Direction,
  OPPOSITE,
  PIPE_CONNECTIONS,
  PIPE_WEIGHTS,
} from './constants';

interface GridCell {
  pipe: PipeType | null;
  waterFilled: boolean;
  waterFrom: Direction | null; // 水流进入方向
}

interface WaterStep {
  row: number;
  col: number;
  fromDirection: Direction;
}

type GamePhase = 'placing' | 'flowing' | 'finished';

export class PipeManiaEngine extends GameEngine {
  private grid: GridCell[][] = [];
  private previewQueue: PipeType[] = [];
  private gamePhase: GamePhase = 'placing';
  private placeTimer: number = 30000; // 30秒放置时间
  private waterTimer: number = 0;
  private waterPath: { row: number; col: number }[] = [];
  private waterSteps: WaterStep[] = [];
  private currentWaterStep: number = 0;
  private pipesUsed: number = 0;
  private startRow: number = 0;
  private startCol: number = 0;
  private endRow: number = GRID_SIZE - 1;
  private endCol: number = GRID_SIZE - 1;
  private levelTarget: number = MIN_PIPE_LENGTH;

  constructor() {
    super();
  }

  // ========== 公开属性 ==========

  get phase(): GamePhase {
    return this.gamePhase;
  }

  get timeRemaining(): number {
    return Math.max(0, this.placeTimer);
  }

  get pipeCount(): number {
    return this.pipesUsed;
  }

  get currentPipe(): PipeType | null {
    return this.previewQueue.length > 0 ? this.previewQueue[0] : null;
  }

  getPreviewQueue(): PipeType[] {
    return [...this.previewQueue];
  }

  getGrid(): GridCell[][] {
    return this.grid;
  }

  getWaterPath(): { row: number; col: number }[] {
    return [...this.waterPath];
  }

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.initGrid();
    this.generatePreviewQueue();
  }

  protected onStart(): void {
    this.gamePhase = 'placing';
    this.placeTimer = Math.max(15000, 30000 - (this._level - 1) * 2000);
    this.waterTimer = 0;
    this.waterPath = [];
    this.waterSteps = [];
    this.currentWaterStep = 0;
    this.pipesUsed = 0;
    this.levelTarget = MIN_PIPE_LENGTH + (this._level - 1) * 2;
    this.initGrid();
    this.generatePreviewQueue();
  }

  protected update(deltaTime: number): void {
    if (this.gamePhase === 'placing') {
      this.placeTimer -= deltaTime;
      if (this.placeTimer <= 0) {
        this.startWaterFlow();
      }
    } else if (this.gamePhase === 'flowing') {
      this.waterTimer += deltaTime;
      if (this.waterTimer >= WATER_FLOW_SPEED) {
        this.waterTimer -= WATER_FLOW_SPEED;
        this.advanceWater();
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    // 网格
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = GRID_PADDING_X + c * CELL_SIZE;
        const y = GRID_PADDING_Y + r * CELL_SIZE;

        // 格子背景
        ctx.fillStyle = COLORS.grid;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

        // 起点标记
        if (r === this.startRow && c === this.startCol) {
          ctx.fillStyle = COLORS.start + '33';
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          ctx.fillStyle = COLORS.start;
          ctx.font = '12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('S', x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 4);
        }

        // 终点标记
        if (r === this.endRow && c === this.endCol) {
          ctx.fillStyle = COLORS.end + '33';
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          ctx.fillStyle = COLORS.end;
          ctx.font = '12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('E', x + CELL_SIZE / 2, y + CELL_SIZE / 2 + 4);
        }

        // 管道
        const cell = this.grid[r][c];
        if (cell.pipe) {
          this.drawPipe(ctx, x, y, cell.pipe, cell.waterFilled);
        }
      }
    }

    // HUD
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`分数: ${this._score}`, 10, 20);
    ctx.textAlign = 'center';
    const phaseText = this.gamePhase === 'placing' ? '放置管道' :
                      this.gamePhase === 'flowing' ? '水流中...' : '完成！';
    ctx.fillText(phaseText, w / 2, 20);
    ctx.textAlign = 'right';
    if (this.gamePhase === 'placing') {
      ctx.fillStyle = this.placeTimer < 5000 ? '#ff4444' : COLORS.timer;
      ctx.fillText(`${Math.ceil(this.placeTimer / 1000)}s`, w - 10, 20);
    }

    // 预览队列
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('下一个:', 10, 45);
    for (let i = 0; i < Math.min(this.previewQueue.length, PREVIEW_COUNT); i++) {
      const px = 70 + i * 30;
      const py = 35;
      ctx.fillStyle = i === 0 ? COLORS.pipeHighlight : COLORS.preview;
      ctx.fillRect(px, py, 25, 25);
      // 简化显示：用字母表示管道类型
      ctx.fillStyle = COLORS.text;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.pipeLabel(this.previewQueue[i]), px + 12, py + 15);
    }

    // 管道数量
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`管道: ${this.pipesUsed} | 目标: ${this.levelTarget}`, w - 10, 45);

    // 游戏结束覆盖
    if (this._status === 'idle') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.text;
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('按空格开始', w / 2, h / 2);
    }

    if (this.gamePhase === 'finished') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.text;
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      const passed = this.pipesUsed >= this.levelTarget;
      ctx.fillText(passed ? '过关！' : '未达标', w / 2, h / 2 - 10);
      ctx.font = '14px monospace';
      ctx.fillText(`得分: ${this._score}`, w / 2, h / 2 + 20);
    }
  }

  protected onReset(): void {
    this.gamePhase = 'placing';
    this.placeTimer = 30000;
    this.waterTimer = 0;
    this.waterPath = [];
    this.waterSteps = [];
    this.currentWaterStep = 0;
    this.pipesUsed = 0;
    this.initGrid();
    this.generatePreviewQueue();
  }

  protected onGameOver(): void {
    this.gamePhase = 'finished';
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    if (key === ' ' && this._status === 'idle') {
      return;
    }

    if (key === ' ' && this.gamePhase === 'placing') {
      // Skip current pipe
      this.skipPipe();
    }
  }

  handleKeyUp(_key: string): void {
    // No action
  }

  /** 处理点击事件（放置管道） */
  handleClick(x: number, y: number): void {
    if (this._status !== 'playing' || this.gamePhase !== 'placing') return;
    if (this.previewQueue.length === 0) return;

    const col = Math.floor((x - GRID_PADDING_X) / CELL_SIZE);
    const row = Math.floor((y - GRID_PADDING_Y) / CELL_SIZE);

    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;

    // 不能在起点和终点放置（它们是特殊标记）
    // Actually, allow placing on start and end cells
    const cell = this.grid[row][col];

    // 放置管道（可以覆盖已有管道）
    const pipe = this.previewQueue.shift()!;
    cell.pipe = pipe;
    cell.waterFilled = false;
    cell.waterFrom = null;
    this.pipesUsed++;

    // 补充预览队列
    this.previewQueue.push(this.randomPipe());

    this.addScore(5); // 每放一个管道得5分
    this.emit('stateChange');
  }

  getState(): Record<string, unknown> {
    return {
      grid: this.grid.map(row => row.map(cell => ({
        pipe: cell.pipe,
        waterFilled: cell.waterFilled,
        waterFrom: cell.waterFrom,
      }))),
      previewQueue: [...this.previewQueue],
      gamePhase: this.gamePhase,
      placeTimer: this.placeTimer,
      waterPath: [...this.waterPath],
      pipesUsed: this.pipesUsed,
      levelTarget: this.levelTarget,
      score: this._score,
    };
  }

  // ========== 核心逻辑 ==========

  private initGrid(): void {
    this.grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        this.grid[r][c] = {
          pipe: null,
          waterFilled: false,
          waterFrom: null,
        };
      }
    }
  }

  private generatePreviewQueue(): void {
    this.previewQueue = [];
    for (let i = 0; i < PREVIEW_COUNT + 2; i++) {
      this.previewQueue.push(this.randomPipe());
    }
  }

  private randomPipe(): PipeType {
    const totalWeight = PIPE_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
    let rand = Math.random() * totalWeight;
    for (const [type, weight] of PIPE_WEIGHTS) {
      rand -= weight;
      if (rand <= 0) return type;
    }
    return PIPE_WEIGHTS[0][0];
  }

  private skipPipe(): void {
    if (this.previewQueue.length === 0) return;
    this.previewQueue.shift();
    this.previewQueue.push(this.randomPipe());
  }

  private startWaterFlow(): void {
    this.gamePhase = 'flowing';
    this.waterTimer = 0;
    this.currentWaterStep = 0;

    // 初始化水流：从起点开始，水从左边进入
    this.waterSteps = [{
      row: this.startRow,
      col: this.startCol,
      fromDirection: Direction.LEFT,
    }];
  }

  private advanceWater(): void {
    if (this.currentWaterStep >= this.waterSteps.length) {
      // 没有更多水流步骤
      this.finishGame();
      return;
    }

    const step = this.waterSteps[this.currentWaterStep];
    this.currentWaterStep++;

    const cell = this.grid[step.row][step.col];

    // 检查是否有管道
    if (!cell.pipe) {
      // 没有管道，水流停止
      this.finishGame();
      return;
    }

    // 检查管道是否接受这个方向的水
    const exitDir = this.getExitDirection(cell.pipe, step.fromDirection);
    if (!exitDir) {
      // 管道不接受这个方向的水
      this.finishGame();
      return;
    }

    // 填充管道
    cell.waterFilled = true;
    cell.waterFrom = step.fromDirection;
    this.waterPath.push({ row: step.row, col: step.col });
    this.addScore(10);

    // 检查是否到达终点
    if (step.row === this.endRow && step.col === this.endCol) {
      this.addScore(50); // 到达终点奖励
      this.finishGame();
      return;
    }

    // 计算下一个格子的位置
    const delta = this.directionDelta(exitDir);
    const nextRow = step.row + delta.dr;
    const nextCol = step.col + delta.dc;

    // 检查边界
    if (nextRow < 0 || nextRow >= GRID_SIZE || nextCol < 0 || nextCol >= GRID_SIZE) {
      this.finishGame();
      return;
    }

    // 检查下一个格子是否已经有水
    if (this.grid[nextRow][nextCol].waterFilled) {
      this.finishGame();
      return;
    }

    // 添加下一步
    this.waterSteps.push({
      row: nextRow,
      col: nextCol,
      fromDirection: OPPOSITE[exitDir],
    });
  }

  private finishGame(): void {
    this.gamePhase = 'finished';

    // 检查是否达标
    if (this.pipesUsed >= this.levelTarget) {
      // 过关
      this.setLevel(this._level + 1);
    }

    this.gameOver();
  }

  /** 获取管道在某个入口方向下的出口方向 */
  getExitDirection(pipe: PipeType, fromDir: Direction): Direction | null {
    const connections = PIPE_CONNECTIONS[pipe];
    for (const pair of connections) {
      if (pair[0] === fromDir) return pair[1];
      if (pair[1] === fromDir) return pair[0];
    }
    return null;
  }

  private directionDelta(dir: Direction): { dr: number; dc: number } {
    switch (dir) {
      case Direction.TOP: return { dr: -1, dc: 0 };
      case Direction.BOTTOM: return { dr: 1, dc: 0 };
      case Direction.LEFT: return { dr: 0, dc: -1 };
      case Direction.RIGHT: return { dr: 0, dc: 1 };
    }
  }

  // ========== 渲染辅助 ==========

  private drawPipe(ctx: CanvasRenderingContext2D, x: number, y: number, pipe: PipeType, filled: boolean): void {
    const cx = x + CELL_SIZE / 2;
    const cy = y + CELL_SIZE / 2;
    const halfPipe = PIPE_WIDTH / 2;
    const halfCell = CELL_SIZE / 2;

    ctx.fillStyle = filled ? COLORS.water : COLORS.pipe;
    ctx.strokeStyle = filled ? COLORS.waterGlow : COLORS.pipeHighlight;
    ctx.lineWidth = 1;

    const connections = PIPE_CONNECTIONS[pipe];
    for (const [dir1, dir2] of connections) {
      const p1 = this.dirToPoint(dir1, cx, cy, halfCell);
      const p2 = this.dirToPoint(dir2, cx, cy, halfCell);

      // 画管道线段
      ctx.beginPath();
      ctx.lineWidth = PIPE_WIDTH;
      ctx.lineCap = 'round';
      ctx.strokeStyle = filled ? COLORS.water : COLORS.pipe;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // 管道边框
      ctx.lineWidth = PIPE_WIDTH + 2;
      ctx.strokeStyle = filled ? COLORS.waterGlow : COLORS.pipeHighlight;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private dirToPoint(dir: Direction, cx: number, cy: number, halfCell: number): { x: number; y: number } {
    switch (dir) {
      case Direction.TOP: return { x: cx, y: cy - halfCell };
      case Direction.BOTTOM: return { x: cx, y: cy + halfCell };
      case Direction.LEFT: return { x: cx - halfCell, y: cy };
      case Direction.RIGHT: return { x: cx + halfCell, y: cy };
    }
  }

  private pipeLabel(pipe: PipeType): string {
    switch (pipe) {
      case PipeType.STRAIGHT_H: return '─';
      case PipeType.STRAIGHT_V: return '│';
      case PipeType.BEND_TR: return '└';
      case PipeType.BEND_BR: return '┌';
      case PipeType.BEND_BL: return '┐';
      case PipeType.BEND_TL: return '┘';
      case PipeType.CROSS: return '┼';
    }
  }
}
