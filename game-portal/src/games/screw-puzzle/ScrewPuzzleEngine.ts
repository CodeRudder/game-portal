import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  HUD_HEIGHT,
  FRAME_PADDING,
  FRAME_BORDER_WIDTH,
  SCREW_RADIUS,
  SCREW_HEAD_RADIUS,
  SCREW_SLOT_WIDTH,
  SCREW_SLOT_LENGTH,
  UNSCREW_ANIM_DURATION,
  FALL_ANIM_DURATION,
  FALL_GRAVITY,
  COLORS,
  LEVEL_CONFIGS,
  MAX_LEVEL,
  BASE_SCORE_PER_SCREW,
  LEVEL_BONUS,
  PERFECT_BONUS,
  STUCK_PENALTY,
  BOARD_BORDER_RADIUS,
  type LevelConfig,
  type BoardDef,
  type ScrewDef,
  type ScrewState,
  type BoardState,
} from './constants';

// ========== 游戏对象接口 ==========

export interface Screw {
  id: string;
  x: number;
  y: number;
  connectedBoardIds: string[];
  state: ScrewState;
  unscrewStartTime: number;
  rotation: number;
}

export interface Board {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colorIndex: number;
  state: BoardState;
  fallStartTime: number;
  fallOffsetY: number;
  fallVelocity: number;
  originalY: number;
}

export interface HistoryEntry {
  screwId: string;
  boardIdsThatFell: string[];
  screwState: ScrewState;
  boardStates: Map<string, BoardState>;
}

// ========== 拧螺丝引擎 ==========

export class ScrewPuzzleEngine extends GameEngine {
  // 游戏对象
  private boards: Board[] = [];
  private screws: Screw[] = [];
  private selectedScrewIndex = 0;

  // 历史记录（撤销用）
  private history: HistoryEntry[] = [];

  // 关卡状态
  private _targetLevel = 1; // 用于在 start() 前设置目标关卡
  private isStuck = false;
  private isWin = false;
  private moveCount = 0;
  private unscrewCount = 0;
  private totalScrews = 0;

  // ========== 公开 API ==========

  /** 获取所有板 */
  getBoards(): Board[] {
    return this.boards.map((b) => ({ ...b }));
  }

  /** 获取所有螺丝 */
  getScrews(): Screw[] {
    return this.screws.map((s) => ({ ...s }));
  }

  /** 获取当前选中螺丝索引 */
  getSelectedScrewIndex(): number {
    return this.selectedScrewIndex;
  }

  /** 获取移动次数 */
  getMoveCount(): number {
    return this.moveCount;
  }

  /** 获取是否卡住 */
  getIsStuck(): boolean {
    return this.isStuck;
  }

  /** 获取是否胜利 */
  getIsWin(): boolean {
    return this.isWin;
  }

  /** 获取历史记录数量 */
  getHistoryCount(): number {
    return this.history.length;
  }

  /** 获取未移除的螺丝列表 */
  getRemainingScrews(): Screw[] {
    return this.screws.filter((s) => s.state !== 'removed');
  }

  /** 设置开始关卡（必须在 start() 之前调用） */
  setTargetLevel(level: number): void {
    this._targetLevel = level;
  }

  /** 获取板通过 ID */
  getBoardById(id: string): Board | undefined {
    return this.boards.find((b) => b.id === id);
  }

  /** 获取螺丝通过 ID */
  getScrewById(id: string): Screw | undefined {
    return this.screws.find((s) => s.id === id);
  }

  /** 获取板的固定螺丝列表 */
  getScrewsForBoard(boardId: string): Screw[] {
    return this.screws.filter(
      (s) => s.connectedBoardIds.includes(boardId) && s.state !== 'removed',
    );
  }

  /** 强制完成拧螺丝动画（测试用） */
  forceCompleteUnscrew(screwId: string): void {
    const screw = this.screws.find((s) => s.id === screwId);
    if (screw && screw.state === 'unscrewing') {
      screw.unscrewStartTime = Date.now() - UNSCREW_ANIM_DURATION - 100;
      this.update(16);
    }
  }

  /** 强制完成所有掉落动画（测试用） */
  forceCompleteFalls(): void {
    for (let i = 0; i < 100; i++) {
      this.update(50);
    }
  }

  // ========== 核心逻辑 ==========

  /** 选择下一个螺丝 */
  selectNextScrew(): void {
    const remaining = this.getRemainingScrews();
    if (remaining.length === 0) return;

    const currentScrew = this.screws[this.selectedScrewIndex];
    const currentId = currentScrew?.id;
    const currentRemainingIdx = remaining.findIndex((s) => s.id === currentId);

    if (currentRemainingIdx === -1 || currentRemainingIdx >= remaining.length - 1) {
      // 当前螺丝已移除或是最后一个，跳到第一个
      this.selectedScrewIndex = this.screws.indexOf(remaining[0]);
    } else {
      this.selectedScrewIndex = this.screws.indexOf(remaining[currentRemainingIdx + 1]);
    }
  }

  /** 选择上一个螺丝 */
  selectPrevScrew(): void {
    const remaining = this.getRemainingScrews();
    if (remaining.length === 0) return;

    const currentScrew = this.screws[this.selectedScrewIndex];
    const currentId = currentScrew?.id;
    const currentRemainingIdx = remaining.findIndex((s) => s.id === currentId);

    if (currentRemainingIdx <= 0) {
      // 当前螺丝已移除或是第一个，跳到最后一个
      this.selectedScrewIndex = this.screws.indexOf(remaining[remaining.length - 1]);
    } else {
      this.selectedScrewIndex = this.screws.indexOf(remaining[currentRemainingIdx - 1]);
    }
  }

  /** 拧下选中的螺丝 */
  unscrewSelected(): void {
    const screw = this.screws[this.selectedScrewIndex];
    if (!screw || screw.state !== 'fixed') return;

    // 开始拧螺丝动画
    screw.state = 'unscrewing';
    screw.unscrewStartTime = Date.now();
    this.moveCount++;
    this.unscrewCount++;
  }

  /** 完成拧螺丝（动画结束后调用） */
  private completeUnscrew(screw: Screw): void {
    screw.state = 'removed';

    // 保存历史（用于撤销）
    const historyEntry: HistoryEntry = {
      screwId: screw.id,
      boardIdsThatFell: [],
      screwState: 'fixed',
      boardStates: new Map(),
    };

    // 保存当前所有板的状态
    for (const board of this.boards) {
      historyEntry.boardStates.set(board.id, board.state);
    }

    // 检查哪些板失去所有固定螺丝
    const fallenBoardIds: string[] = [];
    for (const board of this.boards) {
      if (board.state !== 'fixed') continue;

      const remainingScrews = this.getScrewsForBoard(board.id);
      if (remainingScrews.length === 0) {
        // 检查板是否被其他板挡住（上方有板覆盖）
        const blocked = this.isBoardBlocked(board);
        if (blocked) {
          board.state = 'stuck';
        } else {
          board.state = 'falling';
          board.fallStartTime = Date.now();
          board.fallVelocity = 0;
          board.originalY = board.y;
          fallenBoardIds.push(board.id);
        }
        historyEntry.boardIdsThatFell = fallenBoardIds;
      }
    }

    this.history.push(historyEntry);

    // 加分
    this.addScore(BASE_SCORE_PER_SCREW);

    // 检查胜利
    this.checkWin();

    // 检查是否卡住
    if (!this.isWin) {
      this.checkStuck();
    }
  }

  /** 检查板是否被其他板挡住 */
  private isBoardBlocked(board: Board): boolean {
    // 检查是否有其他固定/下落中的板在当前板的上方并重叠
    for (const other of this.boards) {
      if (other.id === board.id) continue;
      if (other.state === 'fallen' || other.state === 'stuck') continue;

      // 检查水平方向是否有重叠
      const hOverlap = this.boardsOverlapHorizontal(board, other);
      if (!hOverlap) continue;

      // 检查 other 是否在 board 上方
      const otherBottom = other.y + other.height;
      if (otherBottom <= board.y && otherBottom > board.y - 5) {
        // other 在 board 正上方，且底部紧贴 board 顶部
        // 检查 other 是否也失去了所有螺丝
        const otherScrews = this.getScrewsForBoard(other.id);
        if (otherScrews.length > 0) {
          // other 仍然被固定，board 被挡住
          return true;
        }
      }
    }
    return false;
  }

  /** 检查两块板在水平方向是否重叠 */
  private boardsOverlapHorizontal(a: Board, b: Board): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x;
  }

  /** 检查是否胜利 */
  private checkWin(): void {
    const allBoardsGone = this.boards.every(
      (b) => b.state === 'fallen' || b.state === 'falling',
    );
    const allScrewsRemoved = this.screws.every((s) => s.state === 'removed');

    if (allBoardsGone && allScrewsRemoved) {
      this.isWin = true;
      // 完美通关奖励
      if (!this.isStuck) {
        this.addScore(PERFECT_BONUS);
      }
      this.addScore(this._level * LEVEL_BONUS);
      this.gameOver();
    }
  }

  /** 检查是否卡住（没有可拧的螺丝能让板掉落） */
  private checkStuck(): void {
    const fixedBoards = this.boards.filter((b) => b.state === 'fixed');
    const stuckBoards = this.boards.filter((b) => b.state === 'stuck');
    const remainingScrews = this.screws.filter((s) => s.state === 'fixed');

    // 如果还有固定或卡住的板，但没有剩余螺丝了，则卡住
    if ((fixedBoards.length > 0 || stuckBoards.length > 0) && remainingScrews.length === 0) {
      this.isStuck = true;
      this.addScore(-STUCK_PENALTY);
      this.gameOver();
      return;
    }

    // 如果有卡住的板（stuck）且所有螺丝都用完了
    if (stuckBoards.length > 0 && remainingScrews.length === 0) {
      this.isStuck = true;
      this.addScore(-STUCK_PENALTY);
      this.gameOver();
      return;
    }
  }

  /** 撤销上一步 */
  undo(): void {
    if (this.history.length === 0) return;

    const entry = this.history.pop()!;
    this.moveCount = Math.max(0, this.moveCount - 1);
    this.unscrewCount = Math.max(0, this.unscrewCount - 1);
    this.isStuck = false;
    this.isWin = false;

    // 恢复螺丝状态
    const screw = this.screws.find((s) => s.id === entry.screwId);
    if (screw) {
      screw.state = entry.screwState;
      screw.rotation = 0;
    }

    // 恢复所有板的状态
    for (const board of this.boards) {
      const prevState = entry.boardStates.get(board.id);
      if (prevState !== undefined) {
        board.state = prevState;
        board.fallOffsetY = 0;
        board.fallVelocity = 0;
        board.y = board.originalY || board.y;
      }
    }

    // 恢复分数
    this.addScore(-BASE_SCORE_PER_SCREW);

    // 选中被撤销的螺丝
    const screwIdx = this.screws.findIndex((s) => s.id === entry.screwId);
    if (screwIdx !== -1) {
      this.selectedScrewIndex = screwIdx;
    }

    // 恢复游戏状态
    if (this._status === 'gameover') {
      this._status = 'playing';
      this.emit('statusChange', 'playing');
    }
  }

  /** 重置当前关卡 */
  resetLevel(): void {
    this.loadLevel(this._targetLevel);
  }

  /** 加载指定关卡 */
  private loadLevel(level: number): void {
    const config = this.getLevelConfig(level);
    if (!config) return;

    this.boards = config.boards.map((def: BoardDef) => ({
      id: def.id,
      x: def.x,
      y: def.y,
      width: def.width,
      height: def.height,
      colorIndex: def.colorIndex,
      state: 'fixed' as BoardState,
      fallStartTime: 0,
      fallOffsetY: 0,
      fallVelocity: 0,
      originalY: def.y,
    }));

    this.screws = config.screws.map((def: ScrewDef) => ({
      id: def.id,
      x: def.x,
      y: def.y,
      connectedBoardIds: [...def.connectedBoardIds],
      state: 'fixed' as ScrewState,
      unscrewStartTime: 0,
      rotation: 0,
    }));

    this.totalScrews = this.screws.length;
    this.selectedScrewIndex = 0;
    this.history = [];
    this.isStuck = false;
    this.isWin = false;
    this.moveCount = 0;
    this.unscrewCount = 0;
  }

  /** 获取关卡配置 */
  private getLevelConfig(level: number): LevelConfig | undefined {
    const idx = Math.min(level - 1, LEVEL_CONFIGS.length - 1);
    return LEVEL_CONFIGS[Math.max(0, idx)];
  }

  // ========== 生命周期实现 ==========

  protected onInit(): void {
    this.boards = [];
    this.screws = [];
    this.selectedScrewIndex = 0;
    this.history = [];
    this.isStuck = false;
    this.isWin = false;
    this.moveCount = 0;
    this.unscrewCount = 0;
    this.totalScrews = 0;
  }

  protected onStart(): void {
    this._level = this._targetLevel;
    this.loadLevel(this._level);
  }

  protected onReset(): void {
    this.boards = [];
    this.screws = [];
    this.selectedScrewIndex = 0;
    this.history = [];
    this.isStuck = false;
    this.isWin = false;
    this.moveCount = 0;
    this.unscrewCount = 0;
    this.totalScrews = 0;
  }

  protected update(deltaTime: number): void {
    const now = Date.now();

    // 更新拧螺丝动画
    for (const screw of this.screws) {
      if (screw.state === 'unscrewing') {
        const elapsed = now - screw.unscrewStartTime;
        const progress = Math.min(elapsed / UNSCREW_ANIM_DURATION, 1);
        screw.rotation = progress * Math.PI * 4; // 旋转 2 圈

        if (progress >= 1) {
          this.completeUnscrew(screw);
        }
      }
    }

    // 更新板掉落动画
    for (const board of this.boards) {
      if (board.state === 'falling') {
        const elapsed = now - board.fallStartTime;
        board.fallVelocity += FALL_GRAVITY * (deltaTime / 1000);
        board.fallOffsetY += board.fallVelocity * (deltaTime / 1000);
        board.y = board.originalY + board.fallOffsetY;

        // 掉出屏幕
        if (board.y > CANVAS_HEIGHT + 50) {
          board.state = 'fallen';
        }
      }
    }

    // 再次检查胜利（等所有动画完成）
    if (!this.isWin) {
      const allDone = this.boards.every(
        (b) => b.state === 'fallen' || b.state === 'fixed' || b.state === 'stuck',
      );
      const allScrewsDone = this.screws.every(
        (s) => s.state === 'removed' || s.state === 'fixed',
      );
      if (allDone && allScrewsDone) {
        const allBoardsGone = this.boards.every((b) => b.state === 'fallen');
        const allScrewsRemoved = this.screws.every((s) => s.state === 'removed');
        if (allBoardsGone && allScrewsRemoved && !this.isWin) {
          this.isWin = true;
          if (!this.isStuck) {
            this.addScore(PERFECT_BONUS);
          }
          this.addScore(this._level * LEVEL_BONUS);
          this.gameOver();
        }
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this.renderHUD(ctx, w);

    // 框架区域
    this.renderFrame(ctx, w, h);

    // 板（从下到上绘制，先绘制下方的板）
    const sortedBoards = [...this.boards].sort((a, b) => b.y - a.y);
    for (const board of sortedBoards) {
      if (board.state === 'fallen') continue;
      this.renderBoard(ctx, board);
    }

    // 螺丝
    for (let i = 0; i < this.screws.length; i++) {
      const screw = this.screws[i];
      if (screw.state === 'removed') continue;
      const isSelected = i === this.selectedScrewIndex;
      this.renderScrew(ctx, screw, isSelected);
    }

    // 状态提示
    this.renderStatusOverlay(ctx, w, h);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = COLORS.HUD_BG;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.font = 'bold 16px monospace';
    ctx.textBaseline = 'middle';

    const y = HUD_HEIGHT / 2;
    ctx.fillText(`等级: ${this._level}`, 15, y);
    ctx.fillText(`螺丝: ${this.unscrewCount}/${this.totalScrews}`, 130, y);

    const config = this.getLevelConfig(this._level);
    ctx.fillStyle = COLORS.HUD_ACCENT;
    ctx.font = '12px monospace';
    ctx.fillText(config?.label ?? '', 300, y);
  }

  private renderFrame(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const fx = FRAME_PADDING;
    const fy = HUD_HEIGHT + 10;
    const fw = w - FRAME_PADDING * 2;
    const fh = h - HUD_HEIGHT - 20;

    ctx.strokeStyle = COLORS.FRAME_BORDER;
    ctx.lineWidth = FRAME_BORDER_WIDTH;
    ctx.beginPath();
    ctx.roundRect(fx, fy, fw, fh, 8);
    ctx.stroke();

    // 框架背景
    ctx.fillStyle = COLORS.FRAME_BG;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.roundRect(fx + 2, fy + 2, fw - 4, fh - 4, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private renderBoard(ctx: CanvasRenderingContext2D, board: Board): void {
    const color = COLORS.BOARD_COLORS[board.colorIndex % COLORS.BOARD_COLORS.length];

    // 板阴影
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(board.x, board.y, board.width, board.height, BOARD_BORDER_RADIUS);
    ctx.fill();

    // 板边框
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 卡住标记
    if (board.state === 'stuck') {
      ctx.fillStyle = 'rgba(255,0,0,0.3)';
      ctx.beginPath();
      ctx.roundRect(board.x, board.y, board.width, board.height, BOARD_BORDER_RADIUS);
      ctx.fill();

      ctx.fillStyle = COLORS.STUCK_TEXT;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠️ 卡住', board.x + board.width / 2, board.y + board.height / 2);
      ctx.textAlign = 'start';
    }
  }

  private renderScrew(ctx: CanvasRenderingContext2D, screw: Screw, isSelected: boolean): void {
    ctx.save();
    ctx.translate(screw.x, screw.y);

    // 旋转动画
    if (screw.state === 'unscrewing') {
      ctx.rotate(screw.rotation);
    }

    // 选中光圈
    if (isSelected) {
      ctx.strokeStyle = COLORS.CURSOR_COLOR;
      ctx.lineWidth = COLORS.CURSOR_WIDTH;
      ctx.beginPath();
      ctx.arc(0, 0, SCREW_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 螺丝外圈
    ctx.fillStyle = COLORS.SCREW_BODY;
    ctx.beginPath();
    ctx.arc(0, 0, SCREW_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 螺丝头
    ctx.fillStyle = COLORS.SCREW_HEAD;
    ctx.beginPath();
    ctx.arc(0, 0, SCREW_HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // 十字槽
    ctx.strokeStyle = COLORS.SCREW_SLOT;
    ctx.lineWidth = SCREW_SLOT_WIDTH;
    ctx.beginPath();
    ctx.moveTo(-SCREW_SLOT_LENGTH / 2, 0);
    ctx.lineTo(SCREW_SLOT_LENGTH / 2, 0);
    ctx.moveTo(0, -SCREW_SLOT_LENGTH / 2);
    ctx.lineTo(0, SCREW_SLOT_LENGTH / 2);
    ctx.stroke();

    ctx.restore();
  }

  private renderStatusOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.isStuck && this._status === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = COLORS.STUCK_TEXT;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('螺丝卡住了！', w / 2, h / 2 - 20);

      ctx.fillStyle = COLORS.HUD_TEXT;
      ctx.font = '16px monospace';
      ctx.fillText('按 R 重置 或 U 撤销', w / 2, h / 2 + 20);
      ctx.textAlign = 'start';
    }
  }

  handleKeyDown(key: string): void {
    if (this._status === 'gameover') {
      if (key === 'r' || key === 'R') {
        this.reset();
        this.start();
      } else if (key === 'u' || key === 'U') {
        this.undo();
      }
      return;
    }

    if (this._status !== 'playing') return;

    switch (key) {
      case 'ArrowUp':
      case 'ArrowRight':
        this.selectNextScrew();
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        this.selectPrevScrew();
        break;
      case ' ':
      case 'Enter':
        this.unscrewSelected();
        break;
      case 'u':
      case 'U':
        this.undo();
        break;
      case 'r':
      case 'R':
        this.resetLevel();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 拧螺丝游戏不需要 keyUp 处理
  }

  getState(): Record<string, unknown> {
    return {
      boards: this.boards.map((b) => ({
        id: b.id,
        state: b.state,
        x: b.x,
        y: b.y,
      })),
      screws: this.screws.map((s) => ({
        id: s.id,
        state: s.state,
        x: s.x,
        y: s.y,
      })),
      selectedScrewIndex: this.selectedScrewIndex,
      moveCount: this.moveCount,
      isStuck: this.isStuck,
      isWin: this.isWin,
      level: this._level,
      score: this._score,
    };
  }

  // ========== 覆写 gameOver 以设置 isWin ==========

  protected onGameOver(): void {
    // isWin 已在 checkWin 中设置
  }
}
