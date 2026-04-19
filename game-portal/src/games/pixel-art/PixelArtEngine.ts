import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_SIZES,
  DEFAULT_GRID_SIZE,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  HUD_HEIGHT,
  PALETTE_COLS,
  PALETTE_CELL_SIZE,
  PALETTE_CELL_GAP,
  TOOLBAR_HEIGHT,
  TOOLBAR_OFFSET_Y,
  EMPTY_COLOR,
  PALETTE_COLORS,
  DEFAULT_COLOR_INDEX,
  COLORS,
  FONT_FAMILY,
  FONT_SIZE_SMALL,
  FONT_SIZE_NORMAL,
  FONT_SIZE_LARGE,
  TEMPLATES,
  Template,
  STORAGE_KEY_PREFIX,
  MAX_SAVES,
  Tool,
  ALL_TOOLS,
  TOOL_NAMES,
  TOOL_ICONS,
  DEFAULT_TOOL,
} from './constants';

// ========== 类型定义 ==========

/** 像素网格：每个格子存储颜色字符串，空字符串表示空白 */
type PixelGrid = string[][];

/** 保存数据结构 */
export interface PixelArtSave {
  /** 保存名称 */
  name: string;
  /** 网格尺寸 */
  gridSize: number;
  /** 像素数据 */
  pixels: PixelGrid;
  /** 保存时间 */
  timestamp: number;
}

/** 引擎状态 */
interface PixelArtState {
  gridSize: number;
  pixels: PixelGrid;
  cursorRow: number;
  cursorCol: number;
  currentTool: Tool;
  currentColorIndex: number;
  currentColor: string;
}

// ========== Pixel Art 引擎 ==========

export class PixelArtEngine extends GameEngine {
  // 网格
  private gridSize: number = DEFAULT_GRID_SIZE;
  private pixels: PixelGrid = [];
  private cellSize: number = 0;

  // 光标
  private cursorRow: number = 0;
  private cursorCol: number = 0;

  // 工具与颜色
  private currentTool: Tool = DEFAULT_TOOL;
  private currentColorIndex: number = DEFAULT_COLOR_INDEX;

  // 模板选择
  private selectedTemplateIndex: number = -1;

  // ========== 生命周期 ==========

  protected onInit(): void {
    this.gridSize = DEFAULT_GRID_SIZE;
    this.currentTool = DEFAULT_TOOL;
    this.currentColorIndex = DEFAULT_COLOR_INDEX;
    this.selectedTemplateIndex = -1;
    this.initGrid(this.gridSize);
    this.cursorRow = 0;
    this.cursorCol = 0;
  }

  protected onStart(): void {
    // Pixel Art 不需要特殊的启动逻辑
  }

  protected update(_deltaTime: number): void {
    // Pixel Art 是静态的，不需要持续更新
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.drawBackground(ctx, w, h);
    this.drawGrid(ctx);
    this.drawCursor(ctx);
    this.drawHUD(ctx, w);
    this.drawPalette(ctx, w, h);
    this.drawToolbar(ctx, w);
  }

  protected onReset(): void {
    this.initGrid(this.gridSize);
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.currentTool = DEFAULT_TOOL;
    this.currentColorIndex = DEFAULT_COLOR_INDEX;
    this.selectedTemplateIndex = -1;
  }

  protected onDestroy(): void {
    // 清理
  }

  protected onGameOver(): void {
    // Pixel Art 没有 game over
  }

  // ========== 网格操作 ==========

  /** 初始化网格 */
  private initGrid(size: number): void {
    this.gridSize = size;
    this.pixels = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => EMPTY_COLOR)
    );
    this.calculateCellSize();
    this.cursorRow = Math.min(this.cursorRow, size - 1);
    this.cursorCol = Math.min(this.cursorCol, size - 1);
  }

  /** 计算每个格子的像素大小 */
  private calculateCellSize(): void {
    const availableWidth = CANVAS_WIDTH - GRID_OFFSET_X * 2;
    const availableHeight = CANVAS_HEIGHT - GRID_OFFSET_Y - 200; // 留空间给调色板和工具栏
    const maxCellW = Math.floor(availableWidth / this.gridSize);
    const maxCellH = Math.floor(availableHeight / this.gridSize);
    this.cellSize = Math.max(1, Math.min(maxCellW, maxCellH));
  }

  /** 获取网格像素宽度 */
  private get gridPixelWidth(): number {
    return this.gridSize * this.cellSize;
  }

  /** 获取网格像素高度 */
  private get gridPixelHeight(): number {
    return this.gridSize * this.cellSize;
  }

  // ========== 工具操作 ==========

  /** 使用当前工具在光标位置操作 */
  private useTool(): void {
    const { cursorRow, cursorCol } = this;
    if (cursorRow < 0 || cursorRow >= this.gridSize || cursorCol < 0 || cursorCol >= this.gridSize) {
      return;
    }

    switch (this.currentTool) {
      case Tool.BRUSH:
        this.paintPixel(cursorRow, cursorCol);
        break;
      case Tool.ERASER:
        this.erasePixel(cursorRow, cursorCol);
        break;
      case Tool.FILL:
        this.floodFill(cursorRow, cursorCol);
        break;
      case Tool.EYEDROPPER:
        this.pickColor(cursorRow, cursorCol);
        break;
    }
  }

  /** 画笔：在指定位置涂色 */
  private paintPixel(row: number, col: number): void {
    if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) return;
    this.pixels[row][col] = PALETTE_COLORS[this.currentColorIndex];
  }

  /** 橡皮擦：清除指定位置的颜色 */
  private erasePixel(row: number, col: number): void {
    if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) return;
    this.pixels[row][col] = EMPTY_COLOR;
  }

  /** 填充（油漆桶）：Flood Fill 算法 */
  private floodFill(row: number, col: number): void {
    if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) return;

    const targetColor = this.pixels[row][col];
    const fillColor = PALETTE_COLORS[this.currentColorIndex];

    // 如果目标颜色和填充颜色相同，不需要填充
    if (targetColor === fillColor) return;

    // 使用 BFS 实现 Flood Fill
    const visited = new Set<string>();
    const queue: [number, number][] = [[row, col]];

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      const key = `${r},${c}`;

      // 边界检查
      if (r < 0 || r >= this.gridSize || c < 0 || c >= this.gridSize) continue;
      // 已访问
      if (visited.has(key)) continue;
      // 颜色不匹配
      if (this.pixels[r][c] !== targetColor) continue;

      visited.add(key);
      this.pixels[r][c] = fillColor;

      // 四方向扩展
      queue.push([r - 1, c]);
      queue.push([r + 1, c]);
      queue.push([r, c - 1]);
      queue.push([r, c + 1]);
    }
  }

  /** 取色器：获取指定位置的颜色 */
  private pickColor(row: number, col: number): void {
    if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) return;
    const color = this.pixels[row][col];
    if (color === EMPTY_COLOR) return; // 空白格子不取色

    // 在调色板中查找该颜色
    const index = PALETTE_COLORS.indexOf(color);
    if (index !== -1) {
      this.currentColorIndex = index;
    }
  }

  // ========== 公开方法 ==========

  /** 获取当前网格尺寸 */
  getGridSize(): number {
    return this.gridSize;
  }

  /** 设置网格尺寸 */
  setGridSize(size: number): void {
    if (!GRID_SIZES.includes(size as any)) return;
    this.initGrid(size);
  }

  /** 获取像素数据 */
  getPixels(): PixelGrid {
    return this.pixels.map(row => [...row]);
  }

  /** 设置像素数据（用于加载） */
  setPixels(pixels: PixelGrid): void {
    if (pixels.length !== this.gridSize) return;
    for (let r = 0; r < this.gridSize; r++) {
      if (pixels[r].length !== this.gridSize) return;
    }
    this.pixels = pixels.map(row => [...row]);
  }

  /** 获取光标位置 */
  getCursor(): { row: number; col: number } {
    return { row: this.cursorRow, col: this.cursorCol };
  }

  /** 设置光标位置 */
  setCursor(row: number, col: number): void {
    this.cursorRow = Math.max(0, Math.min(this.gridSize - 1, row));
    this.cursorCol = Math.max(0, Math.min(this.gridSize - 1, col));
  }

  /** 获取当前工具 */
  getCurrentTool(): Tool {
    return this.currentTool;
  }

  /** 设置当前工具 */
  setTool(tool: Tool): void {
    this.currentTool = tool;
  }

  /** 获取当前颜色索引 */
  getColorIndex(): number {
    return this.currentColorIndex;
  }

  /** 设置当前颜色索引 */
  setColorIndex(index: number): void {
    if (index < 0 || index >= PALETTE_COLORS.length) return;
    this.currentColorIndex = index;
  }

  /** 获取当前颜色 */
  getCurrentColor(): string {
    return PALETTE_COLORS[this.currentColorIndex];
  }

  /** 在指定位置画笔涂色 */
  paintAt(row: number, col: number): void {
    this.paintPixel(row, col);
  }

  /** 在指定位置擦除 */
  eraseAt(row: number, col: number): void {
    this.erasePixel(row, col);
  }

  /** 在指定位置填充 */
  fillAt(row: number, col: number): void {
    this.floodFill(row, col);
  }

  /** 在指定位置取色 */
  pickColorAt(row: number, col: number): void {
    this.pickColor(row, col);
  }

  /** 清空画布 */
  clearCanvas(): void {
    this.initGrid(this.gridSize);
  }

  /** 加载模板 */
  loadTemplate(templateIndex: number): void {
    if (templateIndex < 0 || templateIndex >= TEMPLATES.length) return;
    const template = TEMPLATES[templateIndex];
    this.initGrid(template.size);
    for (let r = 0; r < template.size; r++) {
      for (let c = 0; c < template.size; c++) {
        this.pixels[r][c] = template.data[r][c];
      }
    }
    this.selectedTemplateIndex = templateIndex;
  }

  /** 获取模板列表 */
  getTemplates(): Template[] {
    return [...TEMPLATES];
  }

  /** 获取选中的模板索引 */
  getSelectedTemplateIndex(): number {
    return this.selectedTemplateIndex;
  }

  // ========== 保存/加载 ==========

  /** 保存到 localStorage */
  save(name?: string): boolean {
    try {
      const saveData: PixelArtSave = {
        name: name || `画作 ${new Date().toLocaleString()}`,
        gridSize: this.gridSize,
        pixels: this.pixels.map(row => [...row]),
        timestamp: Date.now(),
      };

      const saves = this.getSaves();
      saves.push(saveData);

      // 限制保存数量
      while (saves.length > MAX_SAVES) {
        saves.shift();
      }

      localStorage.setItem(STORAGE_KEY_PREFIX + 'saves', JSON.stringify(saves));
      return true;
    } catch {
      return false;
    }
  }

  /** 从 localStorage 加载 */
  load(index: number): boolean {
    try {
      const saves = this.getSaves();
      if (index < 0 || index >= saves.length) return false;

      const saveData = saves[index];
      this.gridSize = saveData.gridSize;
      this.initGrid(saveData.gridSize);

      for (let r = 0; r < saveData.gridSize; r++) {
        for (let c = 0; c < saveData.gridSize; c++) {
          if (r < saveData.pixels.length && c < saveData.pixels[r].length) {
            this.pixels[r][c] = saveData.pixels[r][c];
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /** 获取所有保存 */
  getSaves(): PixelArtSave[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PREFIX + 'saves');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /** 删除保存 */
  deleteSave(index: number): boolean {
    try {
      const saves = this.getSaves();
      if (index < 0 || index >= saves.length) return false;
      saves.splice(index, 1);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'saves', JSON.stringify(saves));
      return true;
    } catch {
      return false;
    }
  }

  // ========== 导出 ==========

  /** 导出为文本格式（颜色代码矩阵） */
  exportAsText(): string {
    const lines: string[] = [];
    for (let r = 0; r < this.gridSize; r++) {
      const row: string[] = [];
      for (let c = 0; c < this.gridSize; c++) {
        const color = this.pixels[r][c];
        row.push(color || '.');
      }
      lines.push(row.join(' '));
    }
    return lines.join('\n');
  }

  /** 导出为 JSON */
  exportAsJSON(): string {
    return JSON.stringify({
      gridSize: this.gridSize,
      pixels: this.pixels,
    }, null, 2);
  }

  // ========== 渲染方法 ==========

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const cs = this.cellSize;
    const startX = GRID_OFFSET_X;
    const startY = GRID_OFFSET_Y;

    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const x = startX + c * cs;
        const y = startY + r * cs;
        const color = this.pixels[r][c];

        if (color && color !== EMPTY_COLOR) {
          ctx.fillStyle = color;
        } else {
          ctx.fillStyle = COLORS.emptyCell;
        }
        ctx.fillRect(x, y, cs, cs);

        // 网格线
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cs, cs);
      }
    }
  }

  private drawCursor(ctx: CanvasRenderingContext2D): void {
    const cs = this.cellSize;
    const x = GRID_OFFSET_X + this.cursorCol * cs;
    const y = GRID_OFFSET_Y + this.cursorRow * cs;

    // 脉冲效果
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);

    ctx.fillStyle = COLORS.cursorFill;
    ctx.fillRect(x, y, cs, cs);

    ctx.strokeStyle = COLORS.cursorBorder;
    ctx.lineWidth = 1.5 + pulse;
    ctx.strokeRect(x - 0.5, y - 0.5, cs + 1, cs + 1);
  }

  private drawHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    ctx.textBaseline = 'middle';
    const cy = HUD_HEIGHT / 2;

    // 工具信息
    ctx.font = `bold ${FONT_SIZE_NORMAL}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`${TOOL_ICONS[this.currentTool]} ${TOOL_NAMES[this.currentTool]}`, 10, cy);

    // 网格尺寸
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`${this.gridSize}×${this.gridSize}`, w / 2, cy);

    // 当前颜色
    ctx.textAlign = 'right';
    const colorName = this.currentColorIndex < PALETTE_COLORS.length ? PALETTE_COLORS[this.currentColorIndex] : '';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.fillText('颜色:', w - 50, cy);
    ctx.fillStyle = this.getCurrentColor();
    ctx.fillRect(w - 42, cy - 8, 16, 16);
    ctx.strokeStyle = COLORS.colorHighlight;
    ctx.lineWidth = 1;
    ctx.strokeRect(w - 42, cy - 8, 16, 16);
  }

  private drawPalette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const paletteY = GRID_OFFSET_Y + this.gridPixelHeight + 20;
    const totalCols = PALETTE_COLS;
    const totalRows = Math.ceil(PALETTE_COLORS.length / totalCols);
    const paletteWidth = totalCols * (PALETTE_CELL_SIZE + PALETTE_CELL_GAP);
    const startX = (w - paletteWidth) / 2;

    // 调色板背景
    ctx.fillStyle = COLORS.paletteBg;
    ctx.fillRect(
      startX - 8,
      paletteY - 8,
      paletteWidth + 16,
      totalRows * (PALETTE_CELL_SIZE + PALETTE_CELL_GAP) + 16
    );

    for (let i = 0; i < PALETTE_COLORS.length; i++) {
      const row = Math.floor(i / totalCols);
      const col = i % totalCols;
      const x = startX + col * (PALETTE_CELL_SIZE + PALETTE_CELL_GAP);
      const y = paletteY + row * (PALETTE_CELL_SIZE + PALETTE_CELL_GAP);

      // 色块
      ctx.fillStyle = PALETTE_COLORS[i];
      ctx.fillRect(x, y, PALETTE_CELL_SIZE, PALETTE_CELL_SIZE);

      // 选中高亮
      if (i === this.currentColorIndex) {
        ctx.strokeStyle = COLORS.colorHighlight;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 2, y - 2, PALETTE_CELL_SIZE + 4, PALETTE_CELL_SIZE + 4);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, PALETTE_CELL_SIZE, PALETTE_CELL_SIZE);
      }
    }
  }

  private drawToolbar(ctx: CanvasRenderingContext2D, w: number): void {
    const toolbarY = CANVAS_HEIGHT - TOOLBAR_HEIGHT - TOOLBAR_OFFSET_Y;
    const toolWidth = 60;
    const totalWidth = ALL_TOOLS.length * toolWidth;
    const startX = (w - totalWidth) / 2;

    // 工具栏背景
    ctx.fillStyle = COLORS.paletteBg;
    ctx.fillRect(startX - 8, toolbarY - 4, totalWidth + 16, TOOLBAR_HEIGHT + 8);

    for (let i = 0; i < ALL_TOOLS.length; i++) {
      const tool = ALL_TOOLS[i];
      const x = startX + i * toolWidth;

      // 选中工具高亮
      if (tool === this.currentTool) {
        ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
        ctx.fillRect(x, toolbarY, toolWidth - 4, TOOLBAR_HEIGHT);
        ctx.strokeStyle = COLORS.toolHighlight;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, toolbarY, toolWidth - 4, TOOLBAR_HEIGHT);
      }

      // 工具名称
      ctx.font = `${FONT_SIZE_SMALL}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = tool === this.currentTool ? COLORS.accent : COLORS.textSecondary;
      ctx.fillText(`${TOOL_ICONS[tool]}${TOOL_NAMES[tool]}`, x + (toolWidth - 4) / 2, toolbarY + TOOLBAR_HEIGHT / 2);
    }
  }

  // ========== 输入处理 ==========

  handleKeyDown(key: string): void {
    // 方向键：移动光标
    if (key === 'ArrowUp') {
      this.cursorRow = Math.max(0, this.cursorRow - 1);
      return;
    }
    if (key === 'ArrowDown') {
      this.cursorRow = Math.min(this.gridSize - 1, this.cursorRow + 1);
      return;
    }
    if (key === 'ArrowLeft') {
      this.cursorCol = Math.max(0, this.cursorCol - 1);
      return;
    }
    if (key === 'ArrowRight') {
      this.cursorCol = Math.min(this.gridSize - 1, this.cursorCol + 1);
      return;
    }

    // 空格：使用当前工具
    if (key === ' ') {
      this.useTool();
      return;
    }

    // F：填充工具
    if (key === 'f' || key === 'F') {
      this.currentTool = Tool.FILL;
      return;
    }

    // E：橡皮擦
    if (key === 'e' || key === 'E') {
      this.currentTool = Tool.ERASER;
      return;
    }

    // B：画笔
    if (key === 'b' || key === 'B') {
      this.currentTool = Tool.BRUSH;
      return;
    }

    // I：取色器
    if (key === 'i' || key === 'I') {
      this.currentTool = Tool.EYEDROPPER;
      return;
    }

    // Tab：切换工具
    if (key === 'Tab') {
      const currentIndex = ALL_TOOLS.indexOf(this.currentTool);
      const nextIndex = (currentIndex + 1) % ALL_TOOLS.length;
      this.currentTool = ALL_TOOLS[nextIndex];
      return;
    }

    // C：切换颜色（循环下一个）
    if (key === 'c' || key === 'C') {
      this.currentColorIndex = (this.currentColorIndex + 1) % PALETTE_COLORS.length;
      return;
    }

    // 数字键 1-9：快速选色
    const numKey = parseInt(key);
    if (numKey >= 1 && numKey <= 9) {
      // 数字键 1-9 对应调色板索引 0-8
      const colorIndex = numKey - 1;
      if (colorIndex < PALETTE_COLORS.length) {
        this.currentColorIndex = colorIndex;
      }
      return;
    }

    // S：保存
    if (key === 's' || key === 'S') {
      this.save();
      return;
    }

    // L：加载
    if (key === 'l' || key === 'L') {
      const saves = this.getSaves();
      if (saves.length > 0) {
        this.load(saves.length - 1); // 加载最近一次保存
      }
      return;
    }

    // G：切换网格尺寸
    if (key === 'g' || key === 'G') {
      const currentSizeIndex = GRID_SIZES.indexOf(this.gridSize as any);
      const nextSizeIndex = (currentSizeIndex + 1) % GRID_SIZES.length;
      this.initGrid(GRID_SIZES[nextSizeIndex]);
      return;
    }

    // T：加载下一个模板
    if (key === 't' || key === 'T') {
      this.selectedTemplateIndex = (this.selectedTemplateIndex + 1) % (TEMPLATES.length + 1);
      if (this.selectedTemplateIndex < TEMPLATES.length) {
        this.loadTemplate(this.selectedTemplateIndex);
      } else {
        // 循环回到 -1（无模板）
        this.selectedTemplateIndex = -1;
        this.initGrid(DEFAULT_GRID_SIZE);
      }
      return;
    }

    // X：导出
    if (key === 'x' || key === 'X') {
      // 导出操作仅更新状态，实际导出通过 getState 获取
      return;
    }

    // Enter：开始（如果 idle）
    if (key === 'Enter') {
      if (this._status === 'idle') {
        this.start();
      }
      return;
    }

    // P / Escape：暂停/继续
    if (key === 'p' || key === 'P' || key === 'Escape') {
      if (this._status === 'playing') {
        this.pause();
      } else if (this._status === 'paused') {
        this.resume();
      }
      return;
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }

  getState(): Record<string, unknown> {
    const state: PixelArtState = {
      gridSize: this.gridSize,
      pixels: this.pixels.map(row => [...row]),
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
      currentTool: this.currentTool,
      currentColorIndex: this.currentColorIndex,
      currentColor: this.getCurrentColor(),
    };
    return state as unknown as Record<string, unknown>;
  }
}
