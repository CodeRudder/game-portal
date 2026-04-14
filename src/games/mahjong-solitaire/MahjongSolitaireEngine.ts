// ========== Mahjong Solitaire (麻将消除) 游戏引擎 ==========

import { GameEngine } from '@/core/GameEngine';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TILE_WIDTH,
  TILE_HEIGHT,
  LAYER_OFFSET_X,
  LAYER_OFFSET_Y,
  HUD_HEIGHT,
  SCORE_PER_MATCH,
  SHUFFLE_PENALTY,
  HINT_PENALTY,
  REMOVE_ANIM_DURATION,
  HINT_DURATION,
  HINT_BLINK_INTERVAL,
  MAX_SHUFFLES,
  TOTAL_TILE_TYPES,
  TILE_SHORT_SYMBOLS,
  TILE_COLORS,
  TILE_BG_COLORS,
  COLORS,
  TURTLE_LAYOUT,
  countLayoutTiles,
  type LayoutLayer,
  type CursorPosition,
} from './constants';

// ========== 类型定义 ==========

/** 单张牌的数据 */
export interface MahjongTile {
  /** 唯一 ID */
  id: number;
  /** 牌面类型索引 (0-33) */
  faceIndex: number;
  /** 所在层 */
  layer: number;
  /** 行号 */
  row: number;
  /** 列号 */
  col: number;
  /** 是否已被消除 */
  removed: boolean;
}

/** 消除动画 */
interface RemoveAnimation {
  tile1Id: number;
  tile2Id: number;
  elapsed: number;
}

/** 提示状态 */
interface HintState {
  tile1Id: number;
  tile2Id: number;
  elapsed: number;
  active: boolean;
}

/** 游戏内部状态快照 */
export interface MahjongSolitaireState {
  [key: string]: unknown;
  tiles: MahjongTile[];
  selectedTileId: number | null;
  cursor: CursorPosition | null;
  score: number;
  moves: number;
  shufflesRemaining: number;
  hintPair: [number, number] | null;
  isWin: boolean;
  totalTiles: number;
  removedCount: number;
}

// ========== 引擎实现 ==========

export class MahjongSolitaireEngine extends GameEngine {
  // 游戏数据
  private tiles: MahjongTile[] = [];
  private selectedTileId: number | null = null;
  private cursor: CursorPosition | null = null;
  private layout: LayoutLayer[] = [];
  private moves = 0;
  private shufflesRemaining = MAX_SHUFFLES;
  private _isWin = false;

  // 动画
  private removeAnimation: RemoveAnimation | null = null;
  private hintState: HintState | null = null;

  // 鼠标交互
  private hoveredTileId: number | null = null;

  /** 无效点击闪烁反馈 */
  private invalidClickFlash: { tileId: number; elapsed: number } | null = null;

  // 计时
  private gameTimer = 0;

  // ID 计数器
  private nextId = 0;

  // ========== 生命周期 ==========

  protected onInit(): void {
    // 初始化时不做太多，等待 start
  }

  protected onStart(): void {
    this.generateBoard();
    this.moves = 0;
    this.shufflesRemaining = MAX_SHUFFLES;
    this._isWin = false;
    this.selectedTileId = null;
    this.removeAnimation = null;
    this.hintState = null;
    this.gameTimer = 0;
    this.nextId = 0;

    // 设置光标到第一个自由牌
    this.cursor = this.findFirstFreeTile();
  }

  protected update(deltaTime: number): void {
    // 更新计时
    this.gameTimer += deltaTime;

    // 更新消除动画
    if (this.removeAnimation) {
      this.removeAnimation.elapsed += deltaTime;
      if (this.removeAnimation.elapsed >= REMOVE_ANIM_DURATION) {
        this.removeAnimation = null;
      }
    }

    // 更新无效点击闪烁
    if (this.invalidClickFlash) {
      this.invalidClickFlash.elapsed += deltaTime;
      if (this.invalidClickFlash.elapsed >= 300) {
        this.invalidClickFlash = null;
      }
    }

    // 更新提示
    if (this.hintState && this.hintState.active) {
      this.hintState.elapsed += deltaTime;
      if (this.hintState.elapsed >= HINT_DURATION) {
        this.hintState = null;
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // 背景
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    // HUD
    this.renderHUD(ctx, w);

    // 计算布局偏移，使牌居中
    const { offsetX, offsetY } = this.calculateLayoutOffset(w, h);

    // 从底层到顶层绘制牌
    for (let layer = 0; layer < this.layout.length; layer++) {
      this.renderLayer(ctx, layer, offsetX, offsetY);
    }

    // 绘制光标
    if (this.cursor && this._status === 'playing') {
      this.renderCursor(ctx, offsetX, offsetY);
    }

    // 绘制消除动画
    if (this.removeAnimation) {
      this.renderRemoveAnimation(ctx, offsetX, offsetY);
    }

    // 绘制提示高亮
    if (this.hintState && this.hintState.active) {
      this.renderHint(ctx, offsetX, offsetY);
    }

    // 胜利画面
    if (this._isWin) {
      this.renderWinOverlay(ctx, w, h);
    }
  }

  protected onReset(): void {
    this.tiles = [];
    this.selectedTileId = null;
    this.cursor = null;
    this.layout = [];
    this.moves = 0;
    this.shufflesRemaining = MAX_SHUFFLES;
    this._isWin = false;
    this.removeAnimation = null;
    this.hintState = null;
    this.hoveredTileId = null;
    this.invalidClickFlash = null;
    this.gameTimer = 0;
    this.nextId = 0;
  }

  protected onPause(): void {
    // 暂停时不做特殊处理
  }

  protected onResume(): void {
    // 恢复时不做特殊处理
  }

  protected onGameOver(): void {
    // 游戏结束
  }

  // ========== 键盘控制 ==========

  handleKeyDown(key: string): void {
    if (this._status !== 'playing') return;

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.moveCursor(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.moveCursor(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.moveCursor(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.moveCursor(1, 0);
        break;
      case ' ':
        this.selectTile();
        break;
      case 'h':
      case 'H':
        this.showHint();
        break;
      case 'r':
      case 'R':
        this.shuffle();
        break;
    }
  }

  handleKeyUp(_key: string): void {
    // 不需要处理
  }

  // ========== 鼠标交互 ==========

  /**
   * 处理鼠标点击：命中检测 → 选择/匹配牌
   * 按层级从高到低检测（上层优先），只有自由牌可以被点击
   */
  handleClick(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') return;

    const tile = this.hitTestTile(canvasX, canvasY);
    if (!tile) return;

    // 只有自由牌可以被点击
    if (!this.isTileFree(tile)) {
      // 无效点击反馈：短暂闪红
      this.invalidClickFlash = { tileId: tile.id, elapsed: 0 };
      return;
    }

    // 清除提示
    this.hintState = null;

    // 同步光标到点击位置
    this.cursor = { layer: tile.layer, row: tile.row, col: tile.col };

    if (this.selectedTileId === null) {
      // 第一次选择
      this.selectedTileId = tile.id;
    } else if (this.selectedTileId === tile.id) {
      // 取消选择
      this.selectedTileId = null;
    } else {
      // 第二次选择，尝试配对
      const selectedTile = this.tiles.find(t => t.id === this.selectedTileId);
      if (selectedTile && selectedTile.faceIndex === tile.faceIndex) {
        // 配对成功
        this.matchTiles(selectedTile, tile);
      } else {
        // 配对失败，切换选择
        this.selectedTileId = tile.id;
      }
    }
  }

  /**
   * 处理鼠标移动：悬停高亮
   * 追踪鼠标当前悬停的牌，用于渲染高亮效果
   */
  handleMouseMove(canvasX: number, canvasY: number): void {
    if (this._status !== 'playing') {
      this.hoveredTileId = null;
      return;
    }

    const tile = this.hitTestTile(canvasX, canvasY);
    this.hoveredTileId = tile ? tile.id : null;
  }

  /**
   * 命中检测：根据画布坐标找到被点击的牌
   * 从最高层向最低层遍历，上层优先
   */
  private hitTestTile(canvasX: number, canvasY: number): MahjongTile | null {
    const { offsetX, offsetY } = this.calculateLayoutOffset(CANVAS_WIDTH, CANVAS_HEIGHT);

    // 从最高层向最低层遍历（上层优先）
    for (let layer = this.layout.length - 1; layer >= 0; layer--) {
      const layerTiles = this.tiles.filter(t => t.layer === layer && !t.removed);

      for (const tile of layerTiles) {
        const px = offsetX + tile.col * TILE_WIDTH + layer * LAYER_OFFSET_X;
        const py = offsetY + tile.row * TILE_HEIGHT + layer * LAYER_OFFSET_Y;

        if (
          canvasX >= px && canvasX < px + TILE_WIDTH &&
          canvasY >= py && canvasY < py + TILE_HEIGHT
        ) {
          return tile;
        }
      }
    }

    return null;
  }

  // ========== 核心逻辑 ==========

  /**
   * 生成牌局
   */
  generateBoard(): void {
    this.layout = TURTLE_LAYOUT;
    this.tiles = [];
    this.nextId = 0;

    // 计算总牌数
    const totalTiles = countLayoutTiles(this.layout);

    // 生成牌面索引列表（确保每种牌出现偶数次，可配对）
    const faceIndices = this.generateFaceIndices(totalTiles);

    // 按层、行、列顺序放置牌
    let faceIdx = 0;
    for (let layerIdx = 0; layerIdx < this.layout.length; layerIdx++) {
      const layer = this.layout[layerIdx];
      for (let row = 0; row < layer.rows; row++) {
        for (let col = 0; col < layer.cols; col++) {
          if (layer.mask[row][col]) {
            this.tiles.push({
              id: this.nextId++,
              faceIndex: faceIndices[faceIdx++],
              layer: layerIdx,
              row,
              col,
              removed: false,
            });
          }
        }
      }
    }

    // 确保有解：检查是否有可配对的自由牌，否则重新洗牌
    let attempts = 0;
    while (this.findAvailablePair() === null && attempts < 50) {
      this.shuffleFaceIndices();
      attempts++;
    }
  }

  /**
   * 生成牌面索引列表（确保可配对）
   * 每种牌面成对出现
   */
  generateFaceIndices(count: number): number[] {
    const indices: number[] = [];

    // 成对生成：每两张为一对
    for (let i = 0; i < count; i += 2) {
      const faceIndex = Math.floor(i / 2) % TOTAL_TILE_TYPES;
      indices.push(faceIndex);
      if (i + 1 < count) {
        indices.push(faceIndex);
      }
    }

    // 打乱
    this.shuffleArray(indices);
    return indices;
  }

  /**
   * 只重新洗牌面索引（不改变位置）
   */
  shuffleFaceIndices(): void {
    const activeTiles = this.tiles.filter(t => !t.removed);
    const indices = activeTiles.map(t => t.faceIndex);
    this.shuffleArray(indices);
    activeTiles.forEach((tile, i) => {
      tile.faceIndex = indices[i];
    });
  }

  /**
   * Fisher-Yates 洗牌
   */
  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /**
   * 判断一张牌是否是自由牌
   * 自由牌条件：
   * 1. 上方无遮挡（上方层对应位置没有未消除的牌）
   * 2. 左侧或右侧至少一侧无遮挡
   */
  isTileFree(tile: MahjongTile): boolean {
    if (tile.removed) return false;

    // 条件1：上方无遮挡
    if (this.isCoveredAbove(tile)) return false;

    // 条件2：左侧或右侧至少一侧无遮挡
    const blockedLeft = this.isBlockedSide(tile, -1);
    const blockedRight = this.isBlockedSide(tile, 1);

    return !blockedLeft || !blockedRight;
  }

  /**
   * 判断牌上方是否被遮挡
   * 上方层中任何与当前牌有像素重叠的牌都算遮挡
   */
  private isCoveredAbove(tile: MahjongTile): boolean {
    const aboveLayer = tile.layer + 1;
    if (aboveLayer >= this.layout.length) return false;

    return this.tiles.some(t => {
      if (t.removed || t.layer !== aboveLayer) return false;
      return this.tilesOverlap(tile, t);
    });
  }

  /**
   * 判断两张牌是否有空间重叠（考虑层间偏移）
   * 通过像素坐标的矩形碰撞检测
   */
  tilesOverlap(lower: MahjongTile, upper: MahjongTile): boolean {
    const lowerX = lower.col * TILE_WIDTH;
    const lowerY = lower.row * TILE_HEIGHT;
    const layerDiff = upper.layer - lower.layer;
    const upperX = upper.col * TILE_WIDTH + layerDiff * LAYER_OFFSET_X;
    const upperY = upper.row * TILE_HEIGHT + layerDiff * LAYER_OFFSET_Y;

    // 矩形重叠检测
    return !(
      upperX + TILE_WIDTH <= lowerX ||
      upperX >= lowerX + TILE_WIDTH ||
      upperY + TILE_HEIGHT <= lowerY ||
      upperY >= lowerY + TILE_HEIGHT
    );
  }

  /**
   * 判断牌的某一侧是否被遮挡
   * @param side -1=左侧, 1=右侧
   */
  private isBlockedSide(tile: MahjongTile, side: number): boolean {
    const neighborCol = tile.col + side;

    return this.tiles.some(t => {
      if (t.removed || t.layer !== tile.layer || t.id === tile.id) return false;
      return t.row === tile.row && t.col === neighborCol;
    });
  }

  /**
   * 获取所有自由牌
   */
  getFreeTiles(): MahjongTile[] {
    return this.tiles.filter(t => this.isTileFree(t));
  }

  /**
   * 查找一对可消除的自由牌
   */
  findAvailablePair(): [MahjongTile, MahjongTile] | null {
    const freeTiles = this.getFreeTiles();

    for (let i = 0; i < freeTiles.length; i++) {
      for (let j = i + 1; j < freeTiles.length; j++) {
        if (freeTiles[i].faceIndex === freeTiles[j].faceIndex) {
          return [freeTiles[i], freeTiles[j]];
        }
      }
    }

    return null;
  }

  /**
   * 选择/配对牌
   */
  selectTile(): void {
    if (!this.cursor) return;

    const tile = this.getTileAt(this.cursor.layer, this.cursor.row, this.cursor.col);
    if (!tile || tile.removed || !this.isTileFree(tile)) return;

    if (this.selectedTileId === null) {
      // 第一次选择
      this.selectedTileId = tile.id;
    } else if (this.selectedTileId === tile.id) {
      // 取消选择
      this.selectedTileId = null;
    } else {
      // 第二次选择，尝试配对
      const selectedTile = this.tiles.find(t => t.id === this.selectedTileId);
      if (selectedTile && selectedTile.faceIndex === tile.faceIndex) {
        // 配对成功
        this.matchTiles(selectedTile, tile);
      } else {
        // 配对失败，切换选择
        this.selectedTileId = tile.id;
      }
    }
  }

  /**
   * 消除两张牌
   */
  matchTiles(tile1: MahjongTile, tile2: MahjongTile): void {
    tile1.removed = true;
    tile2.removed = true;
    this.selectedTileId = null;
    this.moves++;
    this.addScore(SCORE_PER_MATCH);

    // 播放消除动画
    this.removeAnimation = {
      tile1Id: tile1.id,
      tile2Id: tile2.id,
      elapsed: 0,
    };

    // 检查胜利
    const remaining = this.tiles.filter(t => !t.removed);
    if (remaining.length === 0) {
      this._isWin = true;
      this._status = 'gameover';
      this.emit('statusChange', 'gameover');
    } else {
      // 检查是否有解
      if (this.findAvailablePair() === null) {
        // 无解，自动洗牌（如果还有洗牌次数）
        if (this.shufflesRemaining > 0) {
          this.shuffle();
        }
        // 否则游戏可能卡住（无解且无法洗牌）
      }
    }
  }

  /**
   * 显示提示
   */
  showHint(): void {
    const pair = this.findAvailablePair();
    if (!pair) return;

    this.hintState = {
      tile1Id: pair[0].id,
      tile2Id: pair[1].id,
      elapsed: 0,
      active: true,
    };

    // 扣分
    this.addScore(-HINT_PENALTY);
  }

  /**
   * 洗牌（重新分配剩余牌的牌面）
   */
  shuffle(): void {
    if (this.shufflesRemaining <= 0) return;

    this.shufflesRemaining--;
    this.selectedTileId = null;
    this.hintState = null;

    // 重新分配牌面
    this.shuffleFaceIndices();

    // 扣分
    this.addScore(-SHUFFLE_PENALTY);

    // 确保洗牌后有解
    let attempts = 0;
    while (this.findAvailablePair() === null && attempts < 100) {
      this.shuffleFaceIndices();
      attempts++;
    }

    // 如果100次都无法找到有解的排列，游戏结束
    if (this.findAvailablePair() === null) {
      this._isWin = false;
      this._status = 'gameover';
      this.emit('statusChange', 'gameover');
    }
  }

  /**
   * 移动光标
   * 在自由牌之间跳转，选择方向上最近的自由牌
   */
  moveCursor(dx: number, dy: number): void {
    if (!this.cursor) {
      this.cursor = this.findFirstFreeTile();
      return;
    }

    // 收集所有自由牌的位置
    const freeTiles = this.getFreeTiles();
    if (freeTiles.length === 0) return;

    // 当前光标的像素位置
    const currentPixel = this.tileToPixel(this.cursor.layer, this.cursor.row, this.cursor.col);

    // 找到在移动方向上最近的自由牌
    let bestTile: MahjongTile | null = null;
    let bestDist = Infinity;

    for (const tile of freeTiles) {
      const pixel = this.tileToPixel(tile.layer, tile.row, tile.col);

      // 计算方向向量
      const diffX = pixel.x - currentPixel.x;
      const diffY = pixel.y - currentPixel.y;

      // 检查方向是否匹配
      const matchesDirection =
        (dx > 0 && diffX > 0) ||
        (dx < 0 && diffX < 0) ||
        (dy > 0 && diffY > 0) ||
        (dy < 0 && diffY < 0);

      if (!matchesDirection) continue;

      // 距离
      const dist = Math.sqrt(diffX * diffX + diffY * diffY);
      if (dist < bestDist && dist > 0) {
        bestDist = dist;
        bestTile = tile;
      }
    }

    if (bestTile) {
      this.cursor = { layer: bestTile.layer, row: bestTile.row, col: bestTile.col };
    }
  }

  // ========== 辅助方法 ==========

  /**
   * 获取指定位置的牌（未消除的）
   */
  getTileAt(layer: number, row: number, col: number): MahjongTile | undefined {
    return this.tiles.find(t => t.layer === layer && t.row === row && t.col === col && !t.removed);
  }

  /**
   * 将网格坐标转换为像素坐标（牌面左上角）
   */
  tileToPixel(layer: number, row: number, col: number): { x: number; y: number } {
    const { offsetX, offsetY } = this.calculateLayoutOffset(CANVAS_WIDTH, CANVAS_HEIGHT);
    return {
      x: offsetX + col * TILE_WIDTH + layer * LAYER_OFFSET_X,
      y: offsetY + row * TILE_HEIGHT + layer * LAYER_OFFSET_Y,
    };
  }

  /**
   * 计算布局偏移使牌居中
   */
  calculateLayoutOffset(canvasW: number, canvasH: number): { offsetX: number; offsetY: number } {
    let maxW = 0;
    let maxH = 0;

    for (let i = 0; i < this.layout.length; i++) {
      const layer = this.layout[i];
      const layerW = layer.cols * TILE_WIDTH + i * LAYER_OFFSET_X;
      const layerH = layer.rows * TILE_HEIGHT + i * LAYER_OFFSET_Y;
      if (layerW > maxW) maxW = layerW;
      if (layerH > maxH) maxH = layerH;
    }

    const offsetX = Math.floor((canvasW - maxW) / 2);
    const offsetY = Math.floor((canvasH - HUD_HEIGHT - maxH) / 2) + HUD_HEIGHT;

    return { offsetX, offsetY: Math.max(offsetY, HUD_HEIGHT + 10) };
  }

  /**
   * 找到第一个自由牌的位置
   */
  findFirstFreeTile(): CursorPosition | null {
    const freeTiles = this.getFreeTiles();
    if (freeTiles.length === 0) return null;
    return { layer: freeTiles[0].layer, row: freeTiles[0].row, col: freeTiles[0].col };
  }

  // ========== 渲染方法 ==========

  private renderHUD(ctx: CanvasRenderingContext2D, _w: number): void {
    // HUD 背景
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);

    // 分割线
    ctx.strokeStyle = COLORS.hudBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(CANVAS_WIDTH, HUD_HEIGHT);
    ctx.stroke();

    const y = HUD_HEIGHT / 2;

    // 分数
    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('分数', 12, y - 8);
    ctx.fillStyle = COLORS.hudScore;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(String(this._score), 12, y + 12);

    // 步数
    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '12px monospace';
    ctx.fillText('步数', 100, y - 8);
    ctx.fillStyle = COLORS.hudMoves;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(String(this.moves), 100, y + 12);

    // 时间
    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '12px monospace';
    ctx.fillText('时间', 180, y - 8);
    ctx.fillStyle = COLORS.hudTimer;
    ctx.font = 'bold 16px monospace';
    const elapsed = Math.floor(this._elapsedTime);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, 180, y + 12);

    // 剩余牌数
    const remaining = this.tiles.filter(t => !t.removed).length;
    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('剩余', CANVAS_WIDTH - 90, y - 8);
    ctx.fillStyle = COLORS.hudValue;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${remaining}`, CANVAS_WIDTH - 90, y + 12);

    // 洗牌次数
    ctx.fillStyle = COLORS.hudLabel;
    ctx.font = '12px monospace';
    ctx.fillText('洗牌', CANVAS_WIDTH - 12, y - 8);
    ctx.fillStyle = this.shufflesRemaining > 0 ? '#7bed9f' : '#ff4757';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${this.shufflesRemaining}`, CANVAS_WIDTH - 12, y + 12);

    ctx.textAlign = 'left';
  }

  private renderLayer(ctx: CanvasRenderingContext2D, layerIdx: number, _offsetX: number, _offsetY: number): void {
    const layerTiles = this.tiles.filter(t => t.layer === layerIdx && !t.removed);

    for (const tile of layerTiles) {
      const pos = this.tileToPixel(layerIdx, tile.row, tile.col);
      const x = pos.x;
      const y = pos.y;

      // 判断是否在消除动画中
      const isRemoving = this.removeAnimation &&
        (this.removeAnimation.tile1Id === tile.id || this.removeAnimation.tile2Id === tile.id);

      // 绘制牌面阴影
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(x + 2, y + 2, TILE_WIDTH, TILE_HEIGHT);

      // 绘制牌面背景
      const bgColor = TILE_BG_COLORS[tile.faceIndex] || '#1a1a2e';
      ctx.fillStyle = isRemoving ? '#ffffff' : bgColor;
      ctx.fillRect(x, y, TILE_WIDTH, TILE_HEIGHT);

      // 绘制牌面边框
      const isSelected = this.selectedTileId === tile.id;
      const isFree = this.isTileFree(tile);
      const isHovered = this.hoveredTileId === tile.id && isFree && !isSelected;

      // 无效点击闪烁效果
      const isInvalidFlash = this.invalidClickFlash &&
        this.invalidClickFlash.tileId === tile.id;

      if (isInvalidFlash) {
        ctx.strokeStyle = '#ff4757';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255, 71, 87, 0.6)';
        ctx.shadowBlur = 8;
      } else if (isSelected) {
        ctx.strokeStyle = COLORS.tileSelectedBorder;
        ctx.lineWidth = 2;
        ctx.shadowColor = COLORS.tileSelectedGlow;
        ctx.shadowBlur = 8;
      } else if (isHovered) {
        // 悬停高亮：使用明亮的青色边框
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0, 210, 255, 0.4)';
        ctx.shadowBlur = 6;
      } else if (isFree) {
        ctx.strokeStyle = COLORS.tileFreeBorder;
        ctx.lineWidth = 1;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = COLORS.tileBlockedBorder;
        ctx.lineWidth = 1;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      ctx.strokeRect(x, y, TILE_WIDTH, TILE_HEIGHT);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // 绘制牌面文字
      const symbol = TILE_SHORT_SYMBOLS[tile.faceIndex] || '?';
      const color = TILE_COLORS[tile.faceIndex] || '#ffffff';
      ctx.fillStyle = isRemoving ? COLORS.background : color;
      ctx.font = `bold ${TILE_WIDTH < 36 ? 10 : 11}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, x + TILE_WIDTH / 2, y + TILE_HEIGHT / 2);
    }
  }

  private renderCursor(ctx: CanvasRenderingContext2D, _offsetX: number, _offsetY: number): void {
    if (!this.cursor) return;

    const tile = this.getTileAt(this.cursor.layer, this.cursor.row, this.cursor.col);
    if (!tile) return;

    const pos = this.tileToPixel(tile.layer, tile.row, tile.col);

    ctx.strokeStyle = COLORS.cursorBorder;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.cursorGlow;
    ctx.shadowBlur = 10;
    ctx.strokeRect(pos.x - 2, pos.y - 2, TILE_WIDTH + 4, TILE_HEIGHT + 4);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  private renderRemoveAnimation(ctx: CanvasRenderingContext2D, _offsetX: number, _offsetY: number): void {
    if (!this.removeAnimation) return;

    const progress = this.removeAnimation.elapsed / REMOVE_ANIM_DURATION;
    const alpha = 1 - progress;

    const tile1 = this.tiles.find(t => t.id === this.removeAnimation!.tile1Id);
    const tile2 = this.tiles.find(t => t.id === this.removeAnimation!.tile2Id);

    for (const tile of [tile1, tile2]) {
      if (!tile) continue;
      const pos = this.tileToPixel(tile.layer, tile.row, tile.col);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
      ctx.fillRect(pos.x, pos.y, TILE_WIDTH, TILE_HEIGHT);
    }
  }

  private renderHint(ctx: CanvasRenderingContext2D, _offsetX: number, _offsetY: number): void {
    if (!this.hintState || !this.hintState.active) return;

    const blink = Math.floor(this.hintState.elapsed / HINT_BLINK_INTERVAL) % 2 === 0;
    if (!blink) return;

    const tile1 = this.tiles.find(t => t.id === this.hintState!.tile1Id);
    const tile2 = this.tiles.find(t => t.id === this.hintState!.tile2Id);

    for (const tile of [tile1, tile2]) {
      if (!tile) continue;
      const pos = this.tileToPixel(tile.layer, tile.row, tile.col);
      ctx.strokeStyle = COLORS.hintBorder;
      ctx.lineWidth = 3;
      ctx.shadowColor = COLORS.hintGlow;
      ctx.shadowBlur = 12;
      ctx.strokeRect(pos.x - 1, pos.y - 1, TILE_WIDTH + 2, TILE_HEIGHT + 2);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  }

  private renderWinOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.winOverlay;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = COLORS.winTitle;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎉 恭喜通关！', w / 2, h / 2 - 40);

    ctx.fillStyle = COLORS.winSubtitle;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`得分: ${this._score}`, w / 2, h / 2 + 10);
    ctx.fillText(`步数: ${this.moves}`, w / 2, h / 2 + 40);

    const elapsed = Math.floor(this._elapsedTime);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    ctx.fillText(`用时: ${min}:${sec.toString().padStart(2, '0')}`, w / 2, h / 2 + 70);

    ctx.textAlign = 'left';
  }

  // ========== 公共接口 ==========

  /**
   * 获取游戏状态快照
   */
  getState(): MahjongSolitaireState {
    return {
      tiles: this.tiles.map(t => ({ ...t })),
      selectedTileId: this.selectedTileId,
      cursor: this.cursor ? { ...this.cursor } : null,
      score: this._score,
      moves: this.moves,
      shufflesRemaining: this.shufflesRemaining,
      hintPair: this.hintState ? [this.hintState.tile1Id, this.hintState.tile2Id] : null,
      isWin: this._isWin,
      totalTiles: this.tiles.length,
      removedCount: this.tiles.filter(t => t.removed).length,
    };
  }

  /**
   * 获取剩余牌数
   */
  getRemainingCount(): number {
    return this.tiles.filter(t => !t.removed).length;
  }

  /**
   * 获取洗牌剩余次数
   */
  getShufflesRemaining(): number {
    return this.shufflesRemaining;
  }

  /**
   * 获取步数
   */
  getMoves(): number {
    return this.moves;
  }

  /**
   * 获取牌列表（用于测试）
   */
  getTiles(): MahjongTile[] {
    return this.tiles;
  }

  /**
   * 获取光标位置（用于测试）
   */
  getCursor(): CursorPosition | null {
    return this.cursor;
  }

  /**
   * 获取已选中的牌 ID（用于测试）
   */
  getSelectedTileId(): number | null {
    return this.selectedTileId;
  }

  /**
   * 设置光标位置（用于测试）
   */
  setCursor(pos: CursorPosition): void {
    this.cursor = pos;
  }

  /**
   * 直接设置牌数据（用于测试）
   */
  setTiles(tiles: MahjongTile[]): void {
    this.tiles = tiles;
  }

  /**
   * 设置布局（用于测试）
   */
  setLayout(layout: LayoutLayer[]): void {
    this.layout = layout;
  }

  /**
   * 检查游戏是否胜利
   */
  getIsWin(): boolean {
    return this._isWin;
  }

  /**
   * 获取布局引用
   */
  getLayout(): LayoutLayer[] {
    return this.layout;
  }

  /**
   * 获取提示状态
   */
  getHintState(): HintState | null {
    return this.hintState;
  }

  /**
   * 获取消除动画状态
   */
  getRemoveAnimation(): RemoveAnimation | null {
    return this.removeAnimation;
  }
}
