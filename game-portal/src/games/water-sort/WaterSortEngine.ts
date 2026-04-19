/**
 * 水排序 (Water Sort) — 游戏引擎
 *
 * 核心玩法：将不同颜色的水层在试管之间倒来倒去，
 * 最终让每根试管只包含一种颜色（或为空）。
 */

import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TUBE_CAPACITY,
  COLOR_POOL,
  LEVEL_CONFIGS,
  MAX_LEVEL,
  BASE_SCORE,
  LEVEL_BONUS,
  MOVE_PENALTY,
  HUD_HEIGHT,
  TUBE_PADDING,
  TUBE_GAP,
  WATER_GAP,
  COLORS,
  type LevelConfig,
} from './constants';

/** 试管：一个颜色栈，底部 index=0 */
export type Tube = string[];

/** 历史快照 */
interface HistoryEntry {
  tubes: Tube[];
  moveFrom: number;
  moveTo: number;
}

/** 游戏状态 */
export interface WaterSortState {
  tubes: Tube[];
  selectedIndex: number | null;
  cursorIndex: number;
  level: number;
  moves: number;
  isWon: boolean;
}

export class WaterSortEngine extends GameEngine {
  // ========== 游戏数据 ==========
  private tubes: Tube[] = [];
  private selectedIndex: number | null = null;
  private cursorIndex = 0;
  private moves = 0;
  private isWon = false;
  private history: HistoryEntry[] = [];

  // ========== 公开 API ==========

  /** 获取所有试管（深拷贝） */
  getTubes(): Tube[] {
    return this.tubes.map((t) => [...t]);
  }

  /** 获取选中试管索引 */
  getSelectedIndex(): number | null {
    return this.selectedIndex;
  }

  /** 获取光标索引 */
  getCursorIndex(): number {
    return this.cursorIndex;
  }

  /** 获取当前关卡 */
  getLevel(): number {
    return this._level;
  }

  /** 获取步数 */
  getMoves(): number {
    return this.moves;
  }

  /** 是否已胜利 */
  getIsWon(): boolean {
    return this.isWon;
  }

  /** 获取试管数量 */
  getTubeCount(): number {
    return this.tubes.length;
  }

  /** 获取当前关卡配置 */
  getLevelConfig(): LevelConfig {
    const idx = Math.min(this._level - 1, LEVEL_CONFIGS.length - 1);
    return LEVEL_CONFIGS[idx];
  }

  /** 获取完整游戏状态 */
  getState(): Record<string, unknown> {
    return {
      tubes: this.getTubes(),
      selectedIndex: this.selectedIndex,
      cursorIndex: this.cursorIndex,
      level: this._level,
      moves: this.moves,
      isWon: this.isWon,
    };
  }

  // ========== 试管选择与倒水 ==========

  /** 选择试管（点击/空格/回车） */
  selectTube(index?: number): boolean {
    if (this.isWon) return false;
    const idx = index !== undefined ? index : this.cursorIndex;
    if (idx < 0 || idx >= this.tubes.length) return false;

    if (this.selectedIndex === null) {
      // 第一次选择：选中一根非空试管
      if (this.tubes[idx].length === 0) return false;
      this.selectedIndex = idx;
      this.emit('select', { index: idx });
      return true;
    } else if (this.selectedIndex === idx) {
      // 再次选中同一根：取消选择
      this.selectedIndex = null;
      this.emit('deselect', {});
      return true;
    } else {
      // 选中另一根：尝试倒水
      const success = this.pour(this.selectedIndex, idx);
      this.selectedIndex = null;
      return success;
    }
  }

  /** 倒水：从 from 倒入 to */
  pour(fromIndex: number, toIndex: number): boolean {
    if (fromIndex === toIndex) return false;
    if (fromIndex < 0 || fromIndex >= this.tubes.length) return false;
    if (toIndex < 0 || toIndex >= this.tubes.length) return false;

    const from = this.tubes[fromIndex];
    const to = this.tubes[toIndex];

    if (from.length === 0) return false;

    // 计算可以倒多少层（连续相同颜色的顶部）
    const topColor = from[from.length - 1];
    let pourCount = 0;
    for (let i = from.length - 1; i >= 0; i--) {
      if (from[i] === topColor) {
        pourCount++;
      } else {
        break;
      }
    }

    // 目标试管空间
    const space = TUBE_CAPACITY - to.length;
    if (space <= 0) return false;

    // 目标试管为空，或者顶部颜色相同
    if (to.length > 0 && to[to.length - 1] !== topColor) return false;

    // 实际倒入数量
    const actualPour = Math.min(pourCount, space);

    // 无效操作：如果倒完后没有变化（比如目标已满且颜色相同）
    if (actualPour === 0) return false;

    // 保存历史
    this.saveHistory(fromIndex, toIndex);

    // 执行倒水
    for (let i = 0; i < actualPour; i++) {
      const color = from.pop()!;
      to.push(color);
    }

    this.moves++;
    this.emit('pour', { from: fromIndex, to: toIndex, count: actualPour, moves: this.moves });

    // 检查胜利
    if (this.checkWin()) {
      this.isWon = true;
      this.handleWin();
    }

    return true;
  }

  /** 检查是否可以倒入 */
  canPour(fromIndex: number, toIndex: number): boolean {
    if (fromIndex === toIndex) return false;
    if (fromIndex < 0 || fromIndex >= this.tubes.length) return false;
    if (toIndex < 0 || toIndex >= this.tubes.length) return false;

    const from = this.tubes[fromIndex];
    const to = this.tubes[toIndex];

    if (from.length === 0) return false;
    if (to.length >= TUBE_CAPACITY) return false;

    const topColor = from[from.length - 1];
    if (to.length > 0 && to[to.length - 1] !== topColor) return false;

    return true;
  }

  /** 检查胜利 */
  checkWin(): boolean {
    return this.tubes.every((tube) => {
      if (tube.length === 0) return true;
      if (tube.length !== TUBE_CAPACITY) return false;
      return tube.every((color) => color === tube[0]);
    });
  }

  // ========== 撤销 ==========

  /** 撤销上一步 */
  undo(): boolean {
    if (this.history.length === 0) return false;
    if (this.isWon) return false;

    const entry = this.history.pop()!;
    this.tubes = entry.tubes.map((t) => [...t]);
    this.moves = Math.max(0, this.moves - 1);
    this.selectedIndex = null;
    this.emit('undo', { moves: this.moves });
    return true;
  }

  /** 获取历史长度 */
  getHistoryLength(): number {
    return this.history.length;
  }

  // ========== 关卡 ==========

  /** 生成关卡 */
  generateLevel(level?: number): void {
    const lvl = level ?? this._level;
    const config = LEVEL_CONFIGS[Math.min(lvl - 1, LEVEL_CONFIGS.length - 1)];
    const { colorCount, tubeCount, emptyTubes } = config;

    // 创建颜色层：每种颜色 TUBE_CAPACITY 层
    const layers: string[] = [];
    for (let c = 0; c < colorCount; c++) {
      const color = COLOR_POOL[c % COLOR_POOL.length];
      for (let i = 0; i < TUBE_CAPACITY; i++) {
        layers.push(color);
      }
    }

    // 洗牌
    this.shuffleArray(layers);

    // 分配到试管
    this.tubes = [];
    for (let t = 0; t < tubeCount; t++) {
      const tube: Tube = [];
      for (let i = 0; i < TUBE_CAPACITY; i++) {
        tube.push(layers[t * TUBE_CAPACITY + i]);
      }
      this.tubes.push(tube);
    }

    // 添加空试管
    for (let e = 0; e < emptyTubes; e++) {
      this.tubes.push([]);
    }

    // 重置状态
    this.selectedIndex = null;
    this.cursorIndex = 0;
    this.moves = 0;
    this.isWon = false;
    this.history = [];
  }

  /** 设置指定关卡 */
  setLevel(level: number): void {
    const clampedLevel = Math.max(1, Math.min(level, MAX_LEVEL));
    this._level = clampedLevel;
    this.generateLevel(clampedLevel);
    this.emit('levelChange', clampedLevel);
  }

  /** 下一关 */
  nextLevel(): boolean {
    if (this._level >= MAX_LEVEL) return false;
    this._level++;
    this.generateLevel(this._level);
    this.emit('levelChange', this._level);
    return true;
  }

  /** 重置当前关卡 */
  resetLevel(): void {
    this.generateLevel(this._level);
    this.emit('reset', {});
  }

  /** 设置试管（测试用） */
  setTubes(tubes: Tube[]): void {
    this.tubes = tubes.map((t) => [...t]);
    this.selectedIndex = null;
    this.moves = 0;
    this.isWon = false;
    this.history = [];
  }

  /** 设置光标位置 */
  setCursorIndex(index: number): void {
    if (index >= 0 && index < this.tubes.length) {
      this.cursorIndex = index;
    }
  }

  // ========== 键盘控制 ==========

  /** 移动光标 */
  moveCursor(direction: number): void {
    const newIndex = this.cursorIndex + direction;
    if (newIndex >= 0 && newIndex < this.tubes.length) {
      this.cursorIndex = newIndex;
      this.emit('cursorMove', { index: this.cursorIndex });
    }
  }

  /** 处理键盘输入 */
  handleKeyDown(key: string): void {
    switch (key) {
      case 'ArrowLeft':
        this.moveCursor(-1);
        break;
      case 'ArrowRight':
        this.moveCursor(1);
        break;
      case ' ':
      case 'Enter':
        this.selectTube();
        break;
      case 'u':
      case 'U':
        this.undo();
        break;
      case 'r':
      case 'R':
        this.resetLevel();
        break;
      case 'n':
      case 'N':
        this.nextLevel();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 水排序不需要 keyUp 事件
  }

  // ========== 内部方法 ==========

  /** 保存历史 */
  private saveHistory(fromIndex: number, toIndex: number): void {
    this.history.push({
      tubes: this.tubes.map((t) => [...t]),
      moveFrom: fromIndex,
      moveTo: toIndex,
    });
  }

  /** 洗牌算法 (Fisher-Yates) */
  private shuffleArray(arr: string[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /** 胜利处理 */
  private handleWin(): void {
    const score = Math.max(0, BASE_SCORE + LEVEL_BONUS * this._level - this.moves * MOVE_PENALTY);
    this.addScore(score);
    this.emit('win', { level: this._level, moves: this.moves, score });
  }

  // ========== GameEngine 抽象方法实现 ==========

  protected onInit(): void {
    this.generateLevel(1);
  }

  protected onStart(): void {
    this._level = 1;
    this.generateLevel(1);
  }

  protected update(_deltaTime: number): void {
    // 水排序是回合制游戏，不需要持续更新
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = COLORS.BG;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this.renderHUD(ctx, w);

    // 试管
    this.renderTubes(ctx, w, h);

    // 胜利画面
    if (this.isWon) {
      this.renderWinScreen(ctx, w, h);
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number): void {
    ctx.fillStyle = COLORS.HUD_BG;
    ctx.fillRect(0, 0, w, HUD_HEIGHT);

    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`关卡 ${this._level}`, 15, 25);
    ctx.fillText(`步数 ${this.moves}`, 15, 45);

    ctx.fillStyle = COLORS.HUD_ACCENT;
    ctx.textAlign = 'right';
    ctx.fillText(`分数 ${this._score}`, w - 15, 25);
    ctx.fillText(`历史 ${this.history.length}`, w - 15, 45);
  }

  private renderTubes(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const tubeCount = this.tubes.length;
    const maxPerRow = Math.min(tubeCount, 7);
    const rows = Math.ceil(tubeCount / maxPerRow);

    const tubeWidth = Math.min(
      50,
      (w - 2 * TUBE_PADDING - (maxPerRow - 1) * TUBE_GAP) / maxPerRow
    );
    const tubeHeight = tubeWidth * TUBE_CAPACITY + (TUBE_CAPACITY - 1) * WATER_GAP;
    const waterHeight = tubeWidth;

    for (let row = 0; row < rows; row++) {
      const startIdx = row * maxPerRow;
      const endIdx = Math.min(startIdx + maxPerRow, tubeCount);
      const rowCount = endIdx - startIdx;

      const rowWidth = rowCount * tubeWidth + (rowCount - 1) * TUBE_GAP;
      const startX = (w - rowWidth) / 2;
      const startY = HUD_HEIGHT + 30 + row * (tubeHeight + 40);

      for (let i = startIdx; i < endIdx; i++) {
        const col = i - startIdx;
        const x = startX + col * (tubeWidth + TUBE_GAP);
        const y = startY;

        // 试管边框
        const isSelected = this.selectedIndex === i;
        const isCursor = this.cursorIndex === i && this.selectedIndex === null;

        ctx.strokeStyle = isSelected
          ? COLORS.TUBE_SELECTED
          : isCursor
            ? COLORS.CURSOR_COLOR
            : COLORS.TUBE_BORDER;
        ctx.lineWidth = isSelected || isCursor ? 3 : 1.5;

        // 圆角试管
        const radius = 6;
        ctx.beginPath();
        ctx.roundRect(x, y, tubeWidth, tubeHeight, [radius, radius, radius + 2, radius + 2]);
        ctx.stroke();

        // 试管背景
        ctx.fillStyle = COLORS.TUBE_FILL;
        ctx.beginPath();
        ctx.roundRect(x, y, tubeWidth, tubeHeight, [radius, radius, radius + 2, radius + 2]);
        ctx.fill();

        // 水层
        const tube = this.tubes[i];
        for (let j = 0; j < tube.length; j++) {
          const waterY = y + tubeHeight - (j + 1) * (waterHeight + WATER_GAP) + WATER_GAP;
          ctx.fillStyle = tube[j];
          ctx.beginPath();
          ctx.roundRect(x + 2, waterY, tubeWidth - 4, waterHeight, 3);
          ctx.fill();

          // 水面高光
          ctx.fillStyle = COLORS.WATER_SHINE;
          ctx.fillRect(x + 4, waterY + 1, tubeWidth - 8, 3);
        }

        // 试管编号
        ctx.fillStyle = COLORS.HUD_TEXT;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${i + 1}`, x + tubeWidth / 2, y + tubeHeight + 14);
      }
    }
  }

  private renderWinScreen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = COLORS.WIN_TEXT;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 恭喜过关！', w / 2, h / 2 - 30);

    ctx.font = '18px monospace';
    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.fillText(`步数: ${this.moves}`, w / 2, h / 2 + 10);
    ctx.fillText('按 N 进入下一关', w / 2, h / 2 + 40);
  }

  protected onReset(): void {
    this.tubes = [];
    this.selectedIndex = null;
    this.cursorIndex = 0;
    this.moves = 0;
    this.isWon = false;
    this.history = [];
  }

  protected onGameOver(): void {
    // 水排序没有 Game Over，只有胜利
  }
}
