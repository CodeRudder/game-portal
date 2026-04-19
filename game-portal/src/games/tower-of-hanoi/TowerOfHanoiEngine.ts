import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  MIN_DISKS, MAX_DISKS, DEFAULT_DISKS,
  PEG_COUNT, PEG_WIDTH, PEG_HEIGHT, PEG_BASE_WIDTH, PEG_BASE_HEIGHT,
  PEG_POSITIONS, PEG_BOTTOM_Y,
  DISK_MIN_WIDTH, DISK_MAX_WIDTH, DISK_HEIGHT, DISK_GAP, DISK_CORNER_RADIUS,
  DISK_COLORS, DISK_SELECTED_COLOR, DISK_SELECTED_BORDER,
  HUD_HEIGHT, HUD_BG_COLOR,
  BG_COLOR, PEG_COLOR, PEG_BASE_COLOR, TEXT_COLOR, HIGHLIGHT_COLOR,
  CURSOR_COLOR, WIN_TEXT_COLOR, MIN_MOVES_COLOR,
  FONT_FAMILY, FONT_SIZE_LARGE, FONT_SIZE_MEDIUM, FONT_SIZE_SMALL,
  MOVE_ANIMATION_DURATION,
} from './constants';

/** 单个盘子 */
export interface Disk {
  size: number; // 1=最小, n=最大
}

/** 柱子（栈结构，索引 0=底部） */
export type Peg = Disk[];

/** 选择阶段 */
export type SelectionPhase = 'none' | 'source' | 'target';

/** 移动动画状态 */
export interface MoveAnimation {
  disk: Disk;
  fromPeg: number;
  toPeg: number;
  progress: number; // 0→1
}

export class TowerOfHanoiEngine extends GameEngine {
  // 游戏数据
  private _pegs: Peg[] = [[], [], []];
  private _diskCount: number = DEFAULT_DISKS;
  private _moveCount: number = 0;
  private _selectedPeg: number = 0; // 当前光标所在柱子
  private _selectionPhase: SelectionPhase = 'none';
  private _sourcePeg: number = -1; // 选中的源柱子

  // 动画
  private _animation: MoveAnimation | null = null;
  private _animElapsed: number = 0;

  // 胜利
  private _isWin: boolean = false;

  // ========== Public Getters ==========

  get pegs(): Peg[] { return this._pegs; }
  get diskCount(): number { return this._diskCount; }
  get moveCount(): number { return this._moveCount; }
  get selectedPeg(): number { return this._selectedPeg; }
  get selectionPhase(): SelectionPhase { return this._selectionPhase; }
  get sourcePeg(): number { return this._sourcePeg; }
  get isWin(): boolean { return this._isWin; }
  get minMoves(): number { return Math.pow(2, this._diskCount) - 1; }
  get animating(): boolean { return this._animation !== null; }

  // ========== GameEngine Abstract Methods ==========

  protected onInit(): void {
    this._diskCount = DEFAULT_DISKS;
    this._pegs = [[], [], []];
    this._moveCount = 0;
    this._selectedPeg = 0;
    this._selectionPhase = 'none';
    this._sourcePeg = -1;
    this._animation = null;
    this._animElapsed = 0;
    this._isWin = false;
  }

  protected onStart(): void {
    this.initPegs(this._diskCount);
    this._moveCount = 0;
    this._selectedPeg = 0;
    this._selectionPhase = 'none';
    this._sourcePeg = -1;
    this._animation = null;
    this._animElapsed = 0;
    this._isWin = false;
  }

  protected update(deltaTime: number): void {
    // 处理移动动画
    if (this._animation) {
      this._animElapsed += deltaTime;
      this._animation.progress = Math.min(1, this._animElapsed / MOVE_ANIMATION_DURATION);
      if (this._animation.progress >= 1) {
        this.finishAnimation();
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this.renderHUD(ctx, w);

    // 柱子
    this.renderPegs(ctx, w, h);

    // 盘子
    this.renderDisks(ctx);

    // 光标高亮
    this.renderCursor(ctx);

    // 胜利画面
    if (this._status === 'gameover') {
      this.renderWinScreen(ctx, w, h);
    }

    // 空闲提示
    if (this._status === 'idle') {
      this.renderIdleHint(ctx, w, h);
    }
  }

  protected onReset(): void {
    this._pegs = [[], [], []];
    this._moveCount = 0;
    this._selectedPeg = 0;
    this._selectionPhase = 'none';
    this._sourcePeg = -1;
    this._animation = null;
    this._animElapsed = 0;
    this._isWin = false;
  }

  protected onGameOver(): void {}

  handleKeyDown(key: string): void {
    if (this._status === 'idle') {
      if (key === ' ' || key === 'Space') {
        this.start();
      }
      return;
    }

    if (this._status === 'gameover') {
      if (key === ' ' || key === 'Space') {
        this.reset();
        this.start();
      }
      return;
    }

    if (this._status !== 'playing') return;
    if (this._animation) return; // 动画中不接受输入

    switch (key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.moveCursorLeft();
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.moveCursorRight();
        break;
      case ' ':
      case 'Space':
        this.handleConfirm();
        break;
      case 'Escape':
        this.handleCancel();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 河内塔不需要持续按键
  }

  getState(): Record<string, unknown> {
    return {
      score: this._score,
      level: this._level,
      diskCount: this._diskCount,
      moveCount: this._moveCount,
      minMoves: this.minMoves,
      selectedPeg: this._selectedPeg,
      selectionPhase: this._selectionPhase,
      sourcePeg: this._sourcePeg,
      isWin: this._isWin,
      animating: this.animating,
      pegs: this._pegs.map(peg => peg.map(d => d.size)),
    };
  }

  // ========== Public Methods ==========

  /** 设置盘子数量（仅在 idle 状态有效） */
  setDiskCount(count: number): void {
    if (this._status !== 'idle') return;
    const clamped = Math.max(MIN_DISKS, Math.min(MAX_DISKS, count));
    if (clamped !== this._diskCount) {
      this._diskCount = clamped;
      this.initPegs(this._diskCount);
      this.emit('diskCountChange', this._diskCount);
    }
  }

  /** 尝试移动盘子（直接 API，返回是否成功） */
  tryMove(fromPeg: number, toPeg: number): boolean {
    if (this._status !== 'playing') return false;
    if (this._animation) return false;
    if (fromPeg < 0 || fromPeg >= PEG_COUNT) return false;
    if (toPeg < 0 || toPeg >= PEG_COUNT) return false;
    if (fromPeg === toPeg) return false;
    if (this._pegs[fromPeg].length === 0) return false;

    const disk = this._pegs[fromPeg][this._pegs[fromPeg].length - 1];
    const targetTop = this._pegs[toPeg].length > 0
      ? this._pegs[toPeg][this._pegs[toPeg].length - 1]
      : null;

    if (targetTop !== null && disk.size > targetTop.size) return false;

    // 执行移动
    this.executeMove(fromPeg, toPeg);
    return true;
  }

  /** 检查是否胜利 */
  checkWin(): boolean {
    return this._pegs[2].length === this._diskCount;
  }

  // ========== Private Methods ==========

  /** 初始化柱子：所有盘在第一根柱子 */
  private initPegs(count: number): void {
    this._pegs = [[], [], []];
    for (let i = count; i >= 1; i--) {
      this._pegs[0].push({ size: i });
    }
  }

  /** 移动光标到左边柱子 */
  private moveCursorLeft(): void {
    this._selectedPeg = Math.max(0, this._selectedPeg - 1);
  }

  /** 移动光标到右边柱子 */
  private moveCursorRight(): void {
    this._selectedPeg = Math.min(PEG_COUNT - 1, this._selectedPeg + 1);
  }

  /** 确认操作（选择/放置） */
  private handleConfirm(): void {
    if (this._selectionPhase === 'none') {
      // 选择源柱子
      if (this._pegs[this._selectedPeg].length === 0) return;
      this._selectionPhase = 'source';
      this._sourcePeg = this._selectedPeg;
    } else if (this._selectionPhase === 'source') {
      // 选择目标柱子
      if (this._selectedPeg === this._sourcePeg) {
        // 再次按同一柱子 → 取消选择
        this.cancelSelection();
        return;
      }
      const sourcePeg = this._sourcePeg;
      const targetPeg = this._selectedPeg;
      const disk = this._pegs[sourcePeg][this._pegs[sourcePeg].length - 1];
      const targetTop = this._pegs[targetPeg].length > 0
        ? this._pegs[targetPeg][this._pegs[targetPeg].length - 1]
        : null;

      if (targetTop !== null && disk.size > targetTop.size) {
        // 非法移动 → 取消选择
        this.cancelSelection();
        return;
      }

      // 合法移动
      this._selectionPhase = 'none';
      this._sourcePeg = -1;
      this.executeMove(sourcePeg, targetPeg);
    }
  }

  /** 取消选择 */
  private handleCancel(): void {
    this.cancelSelection();
  }

  /** 取消选择 */
  private cancelSelection(): void {
    this._selectionPhase = 'none';
    this._sourcePeg = -1;
  }

  /** 执行移动（含动画） */
  private executeMove(fromPeg: number, toPeg: number): void {
    const disk = this._pegs[fromPeg].pop()!;
    this._animation = {
      disk,
      fromPeg,
      toPeg,
      progress: 0,
    };
    this._animElapsed = 0;
    // 盘子暂时不在任何柱子上（动画中）
    // 动画结束后放入目标柱子
  }

  /** 完成动画 */
  private finishAnimation(): void {
    if (!this._animation) return;
    this._pegs[this._animation.toPeg].push(this._animation.disk);
    this._animation = null;
    this._animElapsed = 0;
    this._moveCount++;
    this.addScore(1);

    // 检查胜利
    if (this.checkWin()) {
      this._isWin = true;
      this.gameOver();
    }
  }

  // ========== Rendering ==========

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    // HUD 背景
    ctx.fillStyle = HUD_BG_COLOR;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    // 标题
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `bold ${FONT_SIZE_MEDIUM}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText('Tower of Hanoi', w / 2, 22);

    // 移动次数 / 最少步数
    ctx.font = `${FONT_SIZE_SMALL}px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`Moves: ${this._moveCount}`, w / 2 - 80, 46);
    ctx.fillStyle = MIN_MOVES_COLOR;
    ctx.fillText(`Min: ${this.minMoves}`, w / 2 + 80, 46);

    // 盘数
    ctx.fillStyle = HIGHLIGHT_COLOR;
    ctx.fillText(`Disks: ${this._diskCount}`, w / 2, 46);

    ctx.textAlign = 'left';
  }

  private renderPegs(ctx: CanvasRenderingContext2D, _w: number, _h: number): void {
    for (let i = 0; i < PEG_COUNT; i++) {
      const x = PEG_POSITIONS[i];

      // 柱子底座
      ctx.fillStyle = PEG_BASE_COLOR;
      const baseX = x - PEG_BASE_WIDTH / 2;
      const baseY = PEG_BOTTOM_Y;
      ctx.beginPath();
      ctx.roundRect(baseX, baseY, PEG_BASE_WIDTH, PEG_BASE_HEIGHT, DISK_CORNER_RADIUS);
      ctx.fill();

      // 柱子杆
      ctx.fillStyle = PEG_COLOR;
      const pegX = x - PEG_WIDTH / 2;
      const pegY = PEG_BOTTOM_Y - PEG_HEIGHT;
      ctx.fillRect(pegX, pegY, PEG_WIDTH, PEG_HEIGHT);

      // 柱子标签
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = `${FONT_SIZE_SMALL}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x, PEG_BOTTOM_Y + 30);
      ctx.textAlign = 'left';
    }
  }

  private renderDisks(ctx: CanvasRenderingContext2D): void {
    for (let pegIdx = 0; pegIdx < PEG_COUNT; pegIdx++) {
      const peg = this._pegs[pegIdx];
      const pegX = PEG_POSITIONS[pegIdx];

      for (let diskIdx = 0; diskIdx < peg.length; diskIdx++) {
        const disk = peg[diskIdx];
        const isTop = diskIdx === peg.length - 1;
        const isSelected = isTop && this._selectionPhase === 'source' && this._sourcePeg === pegIdx;

        const diskWidth = this.getDiskWidth(disk.size);
        const diskX = pegX - diskWidth / 2;
        const diskY = PEG_BOTTOM_Y - (diskIdx + 1) * (DISK_HEIGHT + DISK_GAP);

        this.renderDisk(ctx, diskX, diskY, diskWidth, disk.size, isSelected);
      }
    }

    // 渲染动画中的盘子
    if (this._animation) {
      const { disk, fromPeg, toPeg, progress } = this._animation;
      const fromX = PEG_POSITIONS[fromPeg];
      const toX = PEG_POSITIONS[toPeg];
      const currentX = fromX + (toX - fromX) * progress;

      const fromStackHeight = this._pegs[fromPeg].length;
      const toStackHeight = this._pegs[toPeg].length;
      const fromY = PEG_BOTTOM_Y - (fromStackHeight + 1) * (DISK_HEIGHT + DISK_GAP);
      const toY = PEG_BOTTOM_Y - (toStackHeight + 1) * (DISK_HEIGHT + DISK_GAP);

      // 动画路径：上升 → 水平 → 下降
      const topY = PEG_BOTTOM_Y - PEG_HEIGHT - DISK_HEIGHT - 20;
      let currentY: number;
      if (progress < 0.3) {
        // 上升阶段
        currentY = fromY + (topY - fromY) * (progress / 0.3);
      } else if (progress < 0.7) {
        // 水平移动
        currentY = topY;
      } else {
        // 下降阶段
        currentY = topY + (toY - topY) * ((progress - 0.7) / 0.3);
      }

      const diskWidth = this.getDiskWidth(disk.size);
      const diskX = currentX - diskWidth / 2;

      this.renderDisk(ctx, diskX, currentY, diskWidth, disk.size, false);
    }
  }

  private renderDisk(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    size: number,
    isSelected: boolean
  ): void {
    const colorIndex = size - 1;
    const color = DISK_COLORS[colorIndex % DISK_COLORS.length];

    if (isSelected) {
      // 选中高亮
      ctx.fillStyle = DISK_SELECTED_COLOR;
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, width + 4, DISK_HEIGHT + 4, DISK_CORNER_RADIUS + 1);
      ctx.fill();
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, DISK_HEIGHT, DISK_CORNER_RADIUS);
    ctx.fill();

    // 盘子上的数字
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${FONT_SIZE_SMALL - 2}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${size}`, x + width / 2, y + DISK_HEIGHT / 2 + 5);
    ctx.textAlign = 'left';

    if (isSelected) {
      ctx.strokeStyle = DISK_SELECTED_BORDER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, width, DISK_HEIGHT, DISK_CORNER_RADIUS);
      ctx.stroke();
    }
  }

  private renderCursor(ctx: CanvasRenderingContext2D): void {
    if (this._status !== 'playing') return;

    const x = PEG_POSITIONS[this._selectedPeg];
    const cursorY = PEG_BOTTOM_Y + 10;

    ctx.fillStyle = CURSOR_COLOR;
    ctx.beginPath();
    ctx.moveTo(x - 8, cursorY);
    ctx.lineTo(x + 8, cursorY);
    ctx.lineTo(x, cursorY - 10);
    ctx.closePath();
    ctx.fill();
  }

  private renderWinScreen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    // 胜利文字
    ctx.fillStyle = WIN_TEXT_COLOR;
    ctx.font = `bold ${FONT_SIZE_LARGE}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText('🎉 YOU WIN!', w / 2, h / 2 - 30);

    // 统计
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${FONT_SIZE_MEDIUM}px ${FONT_FAMILY}`;
    ctx.fillText(`Moves: ${this._moveCount}`, w / 2, h / 2 + 10);
    ctx.fillStyle = MIN_MOVES_COLOR;
    ctx.font = `${FONT_SIZE_SMALL}px ${FONT_FAMILY}`;
    ctx.fillText(`Minimum: ${this.minMoves}`, w / 2, h / 2 + 40);

    if (this._moveCount === this.minMoves) {
      ctx.fillStyle = HIGHLIGHT_COLOR;
      ctx.font = `bold ${FONT_SIZE_MEDIUM}px ${FONT_FAMILY}`;
      ctx.fillText('★ PERFECT! ★', w / 2, h / 2 + 70);
    }

    // 重新开始提示
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${FONT_SIZE_SMALL}px ${FONT_FAMILY}`;
    ctx.fillText('Press SPACE to restart', w / 2, h / 2 + 110);

    ctx.textAlign = 'left';
  }

  private renderIdleHint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${FONT_SIZE_MEDIUM}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE to start', w / 2, h / 2);
    ctx.font = `${FONT_SIZE_SMALL}px ${FONT_FAMILY}`;
    ctx.fillStyle = MIN_MOVES_COLOR;
    ctx.fillText('← → Select Peg | SPACE Confirm | ESC Cancel', w / 2, h / 2 + 30);
    ctx.textAlign = 'left';
  }

  /** 根据盘子大小计算宽度 */
  private getDiskWidth(size: number): number {
    if (this._diskCount <= 1) return DISK_MAX_WIDTH;
    return DISK_MIN_WIDTH + (size - 1) * ((DISK_MAX_WIDTH - DISK_MIN_WIDTH) / (this._diskCount - 1));
  }
}
