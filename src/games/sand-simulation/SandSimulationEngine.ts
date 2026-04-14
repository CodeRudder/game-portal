/**
 * 沙盒粒子模拟 — 游戏引擎
 *
 * 核心玩法：在网格上绘制不同材质的粒子，观察它们按物理规则相互作用。
 * 使用元胞自动机规则模拟沙子、水、石头、火、木头等材质的行为。
 */

import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  MaterialType,
  MATERIAL_COLORS,
  MATERIAL_NAMES,
  FIRE_LIFETIME,
  FIRE_SPREAD_CHANCE,
  FLOW_RANDOM_CHANCE,
  DEFAULT_BRUSH_SIZE,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  CURSOR_SPEED,
  MATERIAL_KEYS,
  SAND_COLOR_VARIANTS,
  WATER_COLOR_VARIANTS,
  FIRE_COLOR_VARIANTS,
  WOOD_COLOR_VARIANTS,
} from './constants';

/** 网格单元格 */
interface Cell {
  type: MaterialType;
  updated: boolean;
  lifetime: number; // 用于火焰倒计时
  colorVariant: number; // 颜色变体索引
}

/** 游戏状态 */
export interface SandSimulationState {
  [key: string]: unknown;
  grid: MaterialType[][];
  cursorX: number;
  cursorY: number;
  currentMaterial: MaterialType;
  brushSize: number;
  isPlacing: boolean;
  particleCount: number;
}

export class SandSimulationEngine extends GameEngine {
  /** 网格数据 */
  private grid: Cell[][] = [];

  /** 光标位置（网格坐标） */
  private cursorX: number = Math.floor(GRID_COLS / 2);
  private cursorY: number = Math.floor(GRID_ROWS / 2);

  /** 当前选择的材质 */
  private currentMaterial: MaterialType = MaterialType.SAND;

  /** 画笔大小 */
  private brushSize: number = DEFAULT_BRUSH_SIZE;

  /** 是否正在放置（空格按住） */
  private isPlacing: boolean = false;

  /** 按键状态 */
  private keysPressed: Set<string> = new Set();

  /** 粒子计数 */
  private particleCount: number = 0;

  /** 更新计数器（用于光标移动节流） */
  private updateCount: number = 0;

  /** 光标移动间隔（每 N 帧移动一次） */
  private readonly CURSOR_MOVE_INTERVAL = 3;

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.initGrid();
  }

  protected onStart(): void {
    // 游戏开始时无需特殊处理
  }

  protected update(deltaTime: number): void {
    this.updateCount++;
    this.handleContinuousInput();
    if (this.isPlacing) {
      this.placeParticles();
    }
    this.updateGrid();
    this.countParticles();
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 渲染背景
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // 渲染网格粒子
    this.renderGrid(ctx);

    // 渲染光标
    this.renderCursor(ctx);
  }

  handleKeyDown(key: string): void {
    this.keysPressed.add(key);

    // 材质切换
    if (MATERIAL_KEYS[key] !== undefined) {
      this.currentMaterial = MATERIAL_KEYS[key];
      this.emit('stateChange');
      return;
    }

    // 空格放置
    if (key === ' ') {
      this.isPlacing = true;
      this.placeParticles();
      return;
    }

    // 清空画布
    if (key === 'c' || key === 'C') {
      this.clearGrid();
      this.emit('stateChange');
      return;
    }

    // 画笔大小调整
    if (key === '+' || key === '=') {
      this.brushSize = Math.min(this.brushSize + 1, MAX_BRUSH_SIZE);
      this.emit('stateChange');
      return;
    }
    if (key === '-' || key === '_') {
      this.brushSize = Math.max(this.brushSize - 1, MIN_BRUSH_SIZE);
      this.emit('stateChange');
      return;
    }
  }

  handleKeyUp(key: string): void {
    this.keysPressed.delete(key);
    if (key === ' ') {
      this.isPlacing = false;
    }
  }

  getState(): SandSimulationState {
    return {
      grid: this.getGridTypes(),
      cursorX: this.cursorX,
      cursorY: this.cursorY,
      currentMaterial: this.currentMaterial,
      brushSize: this.brushSize,
      isPlacing: this.isPlacing,
      particleCount: this.particleCount,
    };
  }

  protected onReset(): void {
    this.initGrid();
    this.cursorX = Math.floor(GRID_COLS / 2);
    this.cursorY = Math.floor(GRID_ROWS / 2);
    this.currentMaterial = MaterialType.SAND;
    this.brushSize = DEFAULT_BRUSH_SIZE;
    this.isPlacing = false;
    this.keysPressed.clear();
    this.updateCount = 0;
  }

  // ========== 网格管理 ==========

  /** 初始化空网格 */
  private initGrid(): void {
    this.grid = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < GRID_COLS; x++) {
        row.push(this.createEmptyCell());
      }
      this.grid.push(row);
    }
    this.particleCount = 0;
  }

  /** 创建空单元格 */
  private createEmptyCell(): Cell {
    return {
      type: MaterialType.EMPTY,
      updated: false,
      lifetime: 0,
      colorVariant: 0,
    };
  }

  /** 创建材质单元格 */
  private createMaterialCell(type: MaterialType): Cell {
    let variantCount = 1;
    switch (type) {
      case MaterialType.SAND: variantCount = SAND_COLOR_VARIANTS.length; break;
      case MaterialType.WATER: variantCount = WATER_COLOR_VARIANTS.length; break;
      case MaterialType.FIRE: variantCount = FIRE_COLOR_VARIANTS.length; break;
      case MaterialType.WOOD: variantCount = WOOD_COLOR_VARIANTS.length; break;
      default: variantCount = 1;
    }
    return {
      type,
      updated: false,
      lifetime: type === MaterialType.FIRE ? FIRE_LIFETIME : 0,
      colorVariant: Math.floor(Math.random() * variantCount),
    };
  }

  /** 获取网格材质类型（纯数据，用于状态导出） */
  getGridTypes(): MaterialType[][] {
    const types: MaterialType[][] = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      const row: MaterialType[] = [];
      for (let x = 0; x < GRID_COLS; x++) {
        row.push(this.grid[y]?.[x]?.type ?? MaterialType.EMPTY);
      }
      types.push(row);
    }
    return types;
  }

  /** 清空网格 */
  clearGrid(): void {
    this.initGrid();
  }

  /** 检查坐标是否在网格范围内 */
  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
  }

  /** 获取指定位置的材质类型 */
  getCellType(x: number, y: number): MaterialType {
    if (!this.isInBounds(x, y)) return MaterialType.STONE; // 边界视为石头
    return this.grid[y][x].type;
  }

  /** 设置指定位置的材质 */
  setCell(x: number, y: number, type: MaterialType): void {
    if (!this.isInBounds(x, y)) return;
    this.grid[y][x] = this.createMaterialCell(type);
  }

  /** 交换两个格子 */
  private swapCells(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.isInBounds(x1, y1) || !this.isInBounds(x2, y2)) return;
    const temp = this.grid[y1][x1];
    this.grid[y1][x1] = this.grid[y2][x2];
    this.grid[y2][x2] = temp;
    // 只标记移动的目标位置已更新（源位置是空或被交换来的，可以继续被处理）
    this.grid[y2][x2].updated = true;
  }

  // ========== 粒子放置 ==========

  /** 在光标位置放置粒子（画笔大小范围） */
  placeParticles(): void {
    const halfBrush = Math.floor(this.brushSize / 2);
    for (let dy = -halfBrush; dy <= halfBrush; dy++) {
      for (let dx = -halfBrush; dx <= halfBrush; dx++) {
        const px = this.cursorX + dx;
        const py = this.cursorY + dy;
        if (this.isInBounds(px, py) && this.grid[py][px].type === MaterialType.EMPTY) {
          this.grid[py][px] = this.createMaterialCell(this.currentMaterial);
        }
      }
    }
  }

  /** 在指定位置放置单个粒子（测试用） */
  placeParticle(x: number, y: number, type: MaterialType): boolean {
    if (!this.isInBounds(x, y)) return false;
    if (this.grid[y][x].type !== MaterialType.EMPTY) return false;
    this.grid[y][x] = this.createMaterialCell(type);
    return true;
  }

  /** 强制设置格子（无视空检查，测试用） */
  forceSetCell(x: number, y: number, type: MaterialType): void {
    if (!this.isInBounds(x, y)) return;
    this.grid[y][x] = this.createMaterialCell(type);
  }

  // ========== 物理更新 ==========

  /** 更新整个网格 */
  updateGrid(): void {
    // 重置更新标记
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        this.grid[y][x].updated = false;
      }
    }

    // 从底部向上扫描（沙子和水向下移动）
    for (let y = GRID_ROWS - 1; y >= 0; y--) {
      // 随机从左或右开始扫描，避免偏向
      const leftToRight = Math.random() > 0.5;
      for (let i = 0; i < GRID_COLS; i++) {
        const x = leftToRight ? i : GRID_COLS - 1 - i;
        const cell = this.grid[y][x];
        if (cell.updated || cell.type === MaterialType.EMPTY) continue;

        switch (cell.type) {
          case MaterialType.SAND:
            this.updateSand(x, y);
            break;
          case MaterialType.WATER:
            this.updateWater(x, y);
            break;
          case MaterialType.FIRE:
            this.updateFire(x, y);
            break;
          case MaterialType.STONE:
          case MaterialType.WOOD:
            // 静止材质不需要更新移动
            break;
        }
      }
    }
  }

  /** 沙子物理更新 */
  private updateSand(x: number, y: number): void {
    // 下方
    if (this.canSandMoveTo(x, y + 1)) {
      this.swapCells(x, y, x, y + 1);
      return;
    }

    // 左下或右下（随机选择方向）
    const dir = Math.random() > 0.5 ? 1 : -1;
    if (this.canSandMoveTo(x + dir, y + 1)) {
      this.swapCells(x, y, x + dir, y + 1);
      return;
    }
    if (this.canSandMoveTo(x - dir, y + 1)) {
      this.swapCells(x, y, x - dir, y + 1);
      return;
    }
  }

  /** 检查沙子是否可以移动到目标位置 */
  private canSandMoveTo(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) return false;
    const targetType = this.grid[y][x].type;
    // 沙子可以落入空格或水中（沙子沉入水底）
    return targetType === MaterialType.EMPTY || targetType === MaterialType.WATER;
  }

  /** 水物理更新 */
  private updateWater(x: number, y: number): void {
    // 下方
    if (this.canWaterMoveTo(x, y + 1)) {
      this.swapCells(x, y, x, y + 1);
      return;
    }

    // 左下或右下
    const dir = Math.random() > 0.5 ? 1 : -1;
    if (this.canWaterMoveTo(x + dir, y + 1)) {
      this.swapCells(x, y, x + dir, y + 1);
      return;
    }
    if (this.canWaterMoveTo(x - dir, y + 1)) {
      this.swapCells(x, y, x - dir, y + 1);
      return;
    }

    // 水平流动
    if (Math.random() < FLOW_RANDOM_CHANCE) {
      const hDir = Math.random() > 0.5 ? 1 : -1;
      if (this.canWaterMoveTo(x + hDir, y)) {
        this.swapCells(x, y, x + hDir, y);
        return;
      }
      if (this.canWaterMoveTo(x - hDir, y)) {
        this.swapCells(x, y, x - hDir, y);
        return;
      }
    }
  }

  /** 检查水是否可以移动到目标位置 */
  private canWaterMoveTo(x: number, y: number): boolean {
    if (!this.isInBounds(x, y)) return false;
    return this.grid[y][x].type === MaterialType.EMPTY;
  }

  /** 火物理更新 */
  private updateFire(x: number, y: number): void {
    const cell = this.grid[y][x];

    // 减少生命值
    cell.lifetime--;

    // 火熄灭
    if (cell.lifetime <= 0) {
      this.grid[y][x] = this.createEmptyCell();
      return;
    }

    // 尝试点燃相邻的木头
    this.trySpreadFire(x, y);

    // 火向上移动
    if (y > 0 && !this.grid[y - 1][x].updated) {
      const above = this.grid[y - 1][x];
      if (above.type === MaterialType.EMPTY) {
        // 有概率向上移动
        if (Math.random() < 0.3) {
          this.swapCells(x, y, x, y - 1);
          return;
        }
      }
    }

    // 火向左上或右上飘动
    const dir = Math.random() > 0.5 ? 1 : -1;
    if (y > 0 && this.isInBounds(x + dir, y - 1)) {
      const diag = this.grid[y - 1][x + dir];
      if (diag.type === MaterialType.EMPTY && !diag.updated && Math.random() < 0.2) {
        this.swapCells(x, y, x + dir, y - 1);
        return;
      }
    }
  }

  /** 尝试向相邻格子蔓延火焰 */
  private trySpreadFire(x: number, y: number): void {
    const neighbors = [
      [x - 1, y], [x + 1, y],
      [x, y - 1], [x, y + 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (this.isInBounds(nx, ny)) {
        const neighbor = this.grid[ny][nx];
        if (neighbor.type === MaterialType.WOOD && Math.random() < FIRE_SPREAD_CHANCE) {
          this.grid[ny][nx] = this.createMaterialCell(MaterialType.FIRE);
          this.grid[ny][nx].updated = true;
        }
      }
    }
  }

  // ========== 输入处理 ==========

  /** 处理持续按键输入（光标移动） */
  private handleContinuousInput(): void {
    if (this.keysPressed.has('ArrowUp') || this.keysPressed.has('w') || this.keysPressed.has('W')) {
      this.cursorY = Math.max(0, this.cursorY - CURSOR_SPEED);
    }
    if (this.keysPressed.has('ArrowDown') || this.keysPressed.has('s') || this.keysPressed.has('S')) {
      this.cursorY = Math.min(GRID_ROWS - 1, this.cursorY + CURSOR_SPEED);
    }
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('a') || this.keysPressed.has('A')) {
      this.cursorX = Math.max(0, this.cursorX - CURSOR_SPEED);
    }
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('d') || this.keysPressed.has('D')) {
      this.cursorX = Math.min(GRID_COLS - 1, this.cursorX + CURSOR_SPEED);
    }
  }

  // ========== 渲染 ==========

  /** 渲染网格粒子 */
  private renderGrid(ctx: CanvasRenderingContext2D): void {
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const cell = this.grid[y][x];
        if (cell.type === MaterialType.EMPTY) continue;

        ctx.fillStyle = this.getCellColor(cell);
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  /** 获取单元格颜色 */
  private getCellColor(cell: Cell): string {
    switch (cell.type) {
      case MaterialType.SAND:
        return SAND_COLOR_VARIANTS[cell.colorVariant % SAND_COLOR_VARIANTS.length];
      case MaterialType.WATER:
        return WATER_COLOR_VARIANTS[cell.colorVariant % WATER_COLOR_VARIANTS.length];
      case MaterialType.STONE:
        return MATERIAL_COLORS[MaterialType.STONE];
      case MaterialType.FIRE:
        return FIRE_COLOR_VARIANTS[cell.colorVariant % FIRE_COLOR_VARIANTS.length];
      case MaterialType.WOOD:
        return WOOD_COLOR_VARIANTS[cell.colorVariant % WOOD_COLOR_VARIANTS.length];
      default:
        return MATERIAL_COLORS[MaterialType.EMPTY];
    }
  }

  /** 渲染光标 */
  private renderCursor(ctx: CanvasRenderingContext2D): void {
    const halfBrush = Math.floor(this.brushSize / 2);
    const px = (this.cursorX - halfBrush) * CELL_SIZE;
    const py = (this.cursorY - halfBrush) * CELL_SIZE;
    const size = this.brushSize * CELL_SIZE;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, size, size);

    // 中心十字
    const cx = this.cursorX * CELL_SIZE + CELL_SIZE / 2;
    const cy = this.cursorY * CELL_SIZE + CELL_SIZE / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
  }

  // ========== 辅助方法 ==========

  /** 统计粒子数量 */
  private countParticles(): void {
    let count = 0;
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (this.grid[y][x].type !== MaterialType.EMPTY) {
          count++;
        }
      }
    }
    this.particleCount = count;
    this._score = count; // 用分数显示粒子数
  }

  // ========== 公共接口（测试用） ==========

  getCursorX(): number { return this.cursorX; }
  getCursorY(): number { return this.cursorY; }
  getCurrentMaterial(): MaterialType { return this.currentMaterial; }
  getBrushSize(): number { return this.brushSize; }
  getIsPlacing(): boolean { return this.isPlacing; }
  getParticleCount(): number { return this.particleCount; }

  /** 设置光标位置（测试用） */
  setCursorPosition(x: number, y: number): void {
    this.cursorX = Math.max(0, Math.min(GRID_COLS - 1, x));
    this.cursorY = Math.max(0, Math.min(GRID_ROWS - 1, y));
  }

  /** 设置当前材质（测试用） */
  setCurrentMaterial(material: MaterialType): void {
    this.currentMaterial = material;
  }

  /** 设置画笔大小（测试用） */
  setBrushSize(size: number): void {
    this.brushSize = Math.max(MIN_BRUSH_SIZE, Math.min(MAX_BRUSH_SIZE, size));
  }

  /** 获取网格引用（测试用，直接读取） */
  getGrid(): Cell[][] {
    return this.grid;
  }

  /** 获取指定位置的 Cell */
  getCell(x: number, y: number): Cell | null {
    if (!this.isInBounds(x, y)) return null;
    return this.grid[y][x];
  }

  /** 获取网格行数 */
  getGridRows(): number { return GRID_ROWS; }

  /** 获取网格列数 */
  getGridCols(): number { return GRID_COLS; }
}
