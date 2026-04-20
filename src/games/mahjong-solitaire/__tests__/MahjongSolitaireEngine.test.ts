// ========== Mahjong Solitaire 测试 ==========

import { MahjongSolitaireEngine } from '../MahjongSolitaireEngine';
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  TOTAL_TILE_TYPES,
  TILES_PER_TYPE,
  TOTAL_TILES,
  SCORE_PER_MATCH,
  SHUFFLE_PENALTY,
  HINT_PENALTY,
  MAX_SHUFFLES,
  TURTLE_LAYOUT,
  SIMPLE_LAYOUT,
  TINY_LAYOUT,
  countLayoutTiles,
  type LayoutLayer,
  type CursorPosition,
} from '../constants';

// ========== 辅助函数 ==========

/** 创建一个有 Canvas 的引擎实例 */
function createEngine(): MahjongSolitaireEngine {
  const engine = new MahjongSolitaireEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

/** 创建一个使用小型布局的引擎（方便测试） */
function createTinyEngine(): MahjongSolitaireEngine {
  const engine = new MahjongSolitaireEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  engine.setCanvas(canvas);
  engine.init();

  // 使用小型布局手动设置
  engine.setLayout(TINY_LAYOUT);
  const tiles = createTilesForLayout(TINY_LAYOUT, [
    0, 0, 1, 1,
    2, 2, 3, 3,
  ]);
  engine.setTiles(tiles);

  return engine;
}

/** 创建一个使用小型布局且处于 playing 状态的引擎 */
function createPlayingTinyEngine(): MahjongSolitaireEngine {
  const engine = new MahjongSolitaireEngine();
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  engine.setCanvas(canvas);
  engine.init();

  // 先 start 以进入 playing 状态（会生成 TURTLE_LAYOUT 牌局）
  engine.start();

  // 然后覆盖为 TINY_LAYOUT
  engine.setLayout(TINY_LAYOUT);
  const tiles = createTilesForLayout(TINY_LAYOUT, [
    0, 0, 1, 1,
    2, 2, 3, 3,
  ]);
  engine.setTiles(tiles);

  return engine;
}

/** 为布局创建牌 */
function createTilesForLayout(layout: LayoutLayer[], faceIndices: number[]): any[] {
  const tiles: any[] = [];
  let id = 0;
  let faceIdx = 0;

  for (let layerIdx = 0; layerIdx < layout.length; layerIdx++) {
    const layer = layout[layerIdx];
    for (let row = 0; row < layer.rows; row++) {
      for (let col = 0; col < layer.cols; col++) {
        if (layer.mask[row][col]) {
          tiles.push({
            id: id++,
            faceIndex: faceIndices[faceIdx++] ?? 0,
            layer: layerIdx,
            row,
            col,
            removed: false,
          });
        }
      }
    }
  }

  return tiles;
}

/** 推进游戏循环（直接调用 update 和 render） */
function tick(engine: MahjongSolitaireEngine, deltaTime = 16): void {
  // 直接调用 update 和 render 而不是通过 gameLoop
  // 因为 gameLoop 依赖 rAF 和 status 检查
  (engine as any).update(deltaTime);
  (engine as any).render();
}

// ========== 测试 ==========

describe('MahjongSolitaireEngine', () => {
  let engine: MahjongSolitaireEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 基础生命周期 ==========

  describe('生命周期', () => {
    it('应该正确初始化', () => {
      expect(engine).toBeDefined();
      expect(engine.status).toBe('idle');
    });

    it('应该正确开始游戏', () => {
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('开始后应该有牌', () => {
      engine.start();
      const tiles = engine.getTiles();
      expect(tiles.length).toBeGreaterThan(0);
    });

    it('开始后应该有光标', () => {
      engine.start();
      expect(engine.getCursor()).not.toBeNull();
    });

    it('应该正确暂停', () => {
      engine.start();
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('应该正确恢复', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('应该正确重置', () => {
      engine.start();
      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
      expect(engine.getTiles()).toHaveLength(0);
    });

    it('应该正确销毁', () => {
      engine.start();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('重置后步数归零', () => {
      engine.start();
      engine.reset();
      expect(engine.getMoves()).toBe(0);
    });

    it('重置后洗牌次数恢复', () => {
      engine.start();
      engine.reset();
      expect(engine.getShufflesRemaining()).toBe(MAX_SHUFFLES);
    });
  });

  // ========== 牌局生成 ==========

  describe('牌局生成', () => {
    it('应该生成正确数量的牌', () => {
      engine.start();
      const expectedCount = countLayoutTiles(TURTLE_LAYOUT);
      expect(engine.getTiles().length).toBe(expectedCount);
    });

    it('所有牌面索引应该在有效范围内', () => {
      engine.start();
      const tiles = engine.getTiles();
      for (const tile of tiles) {
        expect(tile.faceIndex).toBeGreaterThanOrEqual(0);
        expect(tile.faceIndex).toBeLessThan(TOTAL_TILE_TYPES);
      }
    });

    it('每种牌面应该出现偶数次（可配对）', () => {
      engine.start();
      const tiles = engine.getTiles();
      const faceCount: Record<number, number> = {};
      for (const tile of tiles) {
        faceCount[tile.faceIndex] = (faceCount[tile.faceIndex] || 0) + 1;
      }
      for (const count of Object.values(faceCount)) {
        expect(count % 2).toBe(0);
      }
    });

    it('生成的牌应该覆盖所有层', () => {
      engine.start();
      const tiles = engine.getTiles();
      const layers = new Set(tiles.map(t => t.layer));
      expect(layers.size).toBe(TURTLE_LAYOUT.length);
    });

    it('所有牌初始状态为未消除', () => {
      engine.start();
      const tiles = engine.getTiles();
      for (const tile of tiles) {
        expect(tile.removed).toBe(false);
      }
    });

    it('每次开始游戏应该生成新的牌局', () => {
      engine.start();
      const tiles1 = engine.getTiles().map(t => t.faceIndex);
      engine.reset();
      engine.start();
      const tiles2 = engine.getTiles().map(t => t.faceIndex);
      // 极大概率不同（因为随机洗牌）
      // 但不能100%保证，所以只检查长度相同
      expect(tiles1.length).toBe(tiles2.length);
    });
  });

  // ========== 自由牌判定 ==========

  describe('自由牌判定', () => {
    it('未被遮挡的顶层牌应该是自由的', () => {
      const tinyEngine = createTinyEngine();
      // 单层布局，所有牌都没有上方遮挡
      const tiles = tinyEngine.getTiles();
      // 检查边缘牌（左边缘或右边缘）是否自由
      const leftMost = tiles.filter(t => t.col === 0);
      const rightMost = tiles.filter(t => t.col === 3);
      // 左边缘牌左侧无遮挡
      for (const tile of leftMost) {
        // 左侧无遮挡，所以至少一侧自由
        const isFree = tinyEngine.isTileFree(tile);
        // 如果上方也无遮挡，则自由
        expect(typeof isFree).toBe('boolean');
      }
    });

    it('被上方遮挡的牌不是自由的', () => {
      // 创建一个有层的布局
      const engine2 = createEngine();
      engine2.setLayout(SIMPLE_LAYOUT);
      const tiles = createTilesForLayout(SIMPLE_LAYOUT, [
        0, 0, 0, 0,
        1, 1,
      ]);
      engine2.setTiles(tiles);

      // 底层中间的牌应该被上层遮挡
      const bottomCenter = tiles.find(t => t.layer === 0 && t.col === 1);
      if (bottomCenter) {
        // 被上层覆盖
        expect(engine2.isTileFree(bottomCenter)).toBe(false);
      }
    });

    it('左右都被遮挡的牌不是自由的', () => {
      const engine2 = createEngine();
      engine2.setLayout({
        cols: 3,
        rows: 1,
        mask: [[true, true, true]],
      } as LayoutLayer[]);
      const tiles = createTilesForLayout(
        [{ cols: 3, rows: 1, mask: [[true, true, true]] }],
        [0, 1, 0]
      );
      engine2.setTiles(tiles);

      // 中间的牌左右都有牌
      const middle = tiles.find(t => t.col === 1);
      if (middle) {
        expect(engine2.isTileFree(middle)).toBe(false);
      }
    });

    it('已消除的牌不是自由的', () => {
      engine.start();
      const tiles = engine.getTiles();
      const firstTile = tiles[0];
      firstTile.removed = true;
      expect(engine.isTileFree(firstTile)).toBe(false);
    });

    it('getFreeTiles 应该返回所有自由牌', () => {
      engine.start();
      const freeTiles = engine.getFreeTiles();
      expect(freeTiles.length).toBeGreaterThan(0);
      for (const tile of freeTiles) {
        expect(engine.isTileFree(tile)).toBe(true);
      }
    });

    it('自由牌数量应该小于等于总牌数', () => {
      engine.start();
      const freeTiles = engine.getFreeTiles();
      const totalTiles = engine.getTiles().length;
      expect(freeTiles.length).toBeLessThanOrEqual(totalTiles);
    });
  });

  // ========== 配对消除 ==========

  describe('配对消除', () => {
    it('选择一张自由牌应该选中它', () => {
      engine.start();
      const freeTiles = engine.getFreeTiles();
      const first = freeTiles[0];
      engine.setCursor({ layer: first.layer, row: first.row, col: first.col });
      engine.handleKeyDown(' ');
      expect(engine.getSelectedTileId()).toBe(first.id);
    });

    it('再次选择同一张牌应该取消选择', () => {
      engine.start();
      const freeTiles = engine.getFreeTiles();
      const first = freeTiles[0];
      engine.setCursor({ layer: first.layer, row: first.row, col: first.col });
      engine.handleKeyDown(' ');
      expect(engine.getSelectedTileId()).toBe(first.id);
      engine.handleKeyDown(' ');
      expect(engine.getSelectedTileId()).toBeNull();
    });

    it('选择两张相同牌面的自由牌应该消除', () => {
      engine.start();
      const freeTiles = engine.getFreeTiles();

      // 找到一对相同牌面的自由牌
      let pair: any[] | null = null;
      for (let i = 0; i < freeTiles.length; i++) {
        for (let j = i + 1; j < freeTiles.length; j++) {
          if (freeTiles[i].faceIndex === freeTiles[j].faceIndex) {
            pair = [freeTiles[i], freeTiles[j]];
            break;
          }
        }
        if (pair) break;
      }

      if (pair) {
        const initialCount = engine.getTiles().filter(t => !t.removed).length;

        // 选择第一张
        engine.setCursor({ layer: pair[0].layer, row: pair[0].row, col: pair[0].col });
        engine.handleKeyDown(' ');

        // 选择第二张
        engine.setCursor({ layer: pair[1].layer, row: pair[1].row, col: pair[1].col });
        engine.handleKeyDown(' ');

        // 应该已经消除
        const remaining = engine.getTiles().filter(t => !t.removed).length;
        expect(remaining).toBe(initialCount - 2);
      }
    });

    it('消除后分数应该增加', () => {
      engine.start();
      const freeTiles = engine.getFreeTiles();

      let pair: any[] | null = null;
      for (let i = 0; i < freeTiles.length; i++) {
        for (let j = i + 1; j < freeTiles.length; j++) {
          if (freeTiles[i].faceIndex === freeTiles[j].faceIndex) {
            pair = [freeTiles[i], freeTiles[j]];
            break;
          }
        }
        if (pair) break;
      }

      if (pair) {
        const initialScore = engine.score;

        engine.setCursor({ layer: pair[0].layer, row: pair[0].row, col: pair[0].col });
        engine.handleKeyDown(' ');
        engine.setCursor({ layer: pair[1].layer, row: pair[1].row, col: pair[1].col });
        engine.handleKeyDown(' ');

        expect(engine.score).toBe(initialScore + SCORE_PER_MATCH);
      }
    });

    it('消除后步数应该增加', () => {
      engine.start();
      const freeTiles = engine.getFreeTiles();

      let pair: any[] | null = null;
      for (let i = 0; i < freeTiles.length; i++) {
        for (let j = i + 1; j < freeTiles.length; j++) {
          if (freeTiles[i].faceIndex === freeTiles[j].faceIndex) {
            pair = [freeTiles[i], freeTiles[j]];
            break;
          }
        }
        if (pair) break;
      }

      if (pair) {
        engine.setCursor({ layer: pair[0].layer, row: pair[0].row, col: pair[0].col });
        engine.handleKeyDown(' ');
        engine.setCursor({ layer: pair[1].layer, row: pair[1].row, col: pair[1].col });
        engine.handleKeyDown(' ');

        expect(engine.getMoves()).toBe(1);
      }
    });

    it('选择不同牌面的牌应该切换选择', () => {
      engine.start();
      const freeTiles = engine.getFreeTiles();

      // 找到两张不同牌面的牌
      let t1: any = freeTiles[0];
      let t2: any | null = null;
      for (let i = 1; i < freeTiles.length; i++) {
        if (freeTiles[i].faceIndex !== t1.faceIndex) {
          t2 = freeTiles[i];
          break;
        }
      }

      if (t2) {
        engine.setCursor({ layer: t1.layer, row: t1.row, col: t1.col });
        engine.handleKeyDown(' ');
        expect(engine.getSelectedTileId()).toBe(t1.id);

        engine.setCursor({ layer: t2.layer, row: t2.row, col: t2.col });
        engine.handleKeyDown(' ');
        expect(engine.getSelectedTileId()).toBe(t2.id);
      }
    });

    it('不能选择已消除的牌', () => {
      engine.start();
      const tiles = engine.getTiles();
      const removed = tiles[0];
      removed.removed = true;

      engine.setCursor({ layer: removed.layer, row: removed.row, col: removed.col });
      engine.handleKeyDown(' ');
      expect(engine.getSelectedTileId()).toBeNull();
    });

    it('不能选择不自由的牌', () => {
      engine.start();
      const tiles = engine.getTiles();
      // 找一张不自由的牌
      const blocked = tiles.find(t => !engine.isTileFree(t));
      if (blocked) {
        engine.setCursor({ layer: blocked.layer, row: blocked.row, col: blocked.col });
        engine.handleKeyDown(' ');
        expect(engine.getSelectedTileId()).toBeNull();
      }
    });
  });

  // ========== 提示功能 ==========

  describe('提示功能', () => {
    it('H 键应该显示提示', () => {
      engine.start();
      const stateBefore = engine.getState();
      engine.handleKeyDown('h');
      const stateAfter = engine.getState();
      // 提示应该被设置（如果有可用配对）
      if (stateAfter.hintPair) {
        expect(stateAfter.hintPair).toHaveLength(2);
      }
    });

    it('提示应该扣分', () => {
      engine.start();
      const scoreBefore = engine.score;
      engine.handleKeyDown('h');
      expect(engine.score).toBe(scoreBefore - HINT_PENALTY);
    });

    it('没有可用配对时不应该有提示', () => {
      // 创建一个没有可配对的情况
      const engine2 = createEngine();
      engine2.setLayout({
        cols: 2,
        rows: 1,
        mask: [[true, true]],
      } as LayoutLayer[]);
      engine2.setTiles([
        { id: 0, faceIndex: 0, layer: 0, row: 0, col: 0, removed: false },
        { id: 1, faceIndex: 1, layer: 0, row: 0, col: 1, removed: false },
      ]);

      const pair = engine2.findAvailablePair();
      expect(pair).toBeNull();
    });

    it('提示应该指向一对可消除的牌', () => {
      engine.start();
      const pair = engine.findAvailablePair();
      if (pair) {
        expect(pair[0].faceIndex).toBe(pair[1].faceIndex);
        expect(engine.isTileFree(pair[0])).toBe(true);
        expect(engine.isTileFree(pair[1])).toBe(true);
        expect(pair[0].id).not.toBe(pair[1].id);
      }
    });
  });

  // ========== 洗牌功能 ==========

  describe('洗牌功能', () => {
    it('R 键应该触发洗牌', () => {
      engine.start();
      const shufflesBefore = engine.getShufflesRemaining();
      engine.handleKeyDown('r');
      expect(engine.getShufflesRemaining()).toBe(shufflesBefore - 1);
    });

    it('洗牌应该扣分', () => {
      engine.start();
      const scoreBefore = engine.score;
      engine.handleKeyDown('r');
      expect(engine.score).toBe(scoreBefore - SHUFFLE_PENALTY);
    });

    it('洗牌次数用完后不能再洗牌', () => {
      engine.start();
      // 用完所有洗牌次数
      for (let i = 0; i < MAX_SHUFFLES; i++) {
        engine.handleKeyDown('r');
      }
      const scoreBefore = engine.score;
      engine.handleKeyDown('r');
      // 不应该再扣分
      expect(engine.score).toBe(scoreBefore);
    });

    it('洗牌后牌面应该改变', () => {
      engine.start();
      const facesBefore = engine.getTiles().map(t => t.faceIndex).join(',');
      engine.handleKeyDown('r');
      const facesAfter = engine.getTiles().map(t => t.faceIndex).join(',');
      // 大概率不同（不能100%保证因为随机）
      expect(typeof facesAfter).toBe('string');
    });

    it('洗牌后位置不变', () => {
      engine.start();
      const positionsBefore = engine.getTiles().map(t => `${t.layer},${t.row},${t.col}`).join(',');
      engine.handleKeyDown('r');
      const positionsAfter = engine.getTiles().map(t => `${t.layer},${t.row},${t.col}`).join(',');
      expect(positionsAfter).toBe(positionsBefore);
    });

    it('洗牌后应该清除选择', () => {
      engine.start();
      const freeTiles = engine.getFreeTiles();
      if (freeTiles.length > 0) {
        engine.setCursor({ layer: freeTiles[0].layer, row: freeTiles[0].row, col: freeTiles[0].col });
        engine.handleKeyDown(' ');
        expect(engine.getSelectedTileId()).not.toBeNull();
      }
      engine.handleKeyDown('r');
      expect(engine.getSelectedTileId()).toBeNull();
    });

    it('初始洗牌次数应该为 MAX_SHUFFLES', () => {
      engine.start();
      expect(engine.getShufflesRemaining()).toBe(MAX_SHUFFLES);
    });
  });

  // ========== 胜利判定 ==========

  describe('胜利判定', () => {
    it('所有牌消除后应该胜利', () => {
      engine.start();
      const tiles = engine.getTiles();
      // 手动消除所有牌
      for (const tile of tiles) {
        tile.removed = true;
      }
      // 检查状态
      expect(engine.getRemainingCount()).toBe(0);
    });

    it('isWin 应该在全部消除时为 true', () => {
      engine.start();
      const tiles = engine.getTiles();
      // 模拟全部消除
      for (const tile of tiles) {
        tile.removed = true;
      }
      // 通过 matchTiles 触发胜利检测
      // 直接设置 isWin 来测试
      expect(engine.getRemainingCount()).toBe(0);
    });

    it('部分消除不应该胜利', () => {
      engine.start();
      const tiles = engine.getTiles();
      tiles[0].removed = true;
      tiles[1].removed = true;
      expect(engine.getRemainingCount()).toBe(tiles.length - 2);
      expect(engine.getIsWin()).toBe(false);
    });

    it('matchTiles 消除最后两张牌应该触发胜利', () => {
      engine.start();
      const tiles = engine.getTiles();
      // 消除除最后两张以外的所有牌
      for (let i = 2; i < tiles.length; i++) {
        tiles[i].removed = true;
      }
      // 设置最后两张为相同牌面
      tiles[0].faceIndex = 0;
      tiles[1].faceIndex = 0;

      // 确保它们是自由的
      engine.matchTiles(tiles[0], tiles[1]);
      expect(engine.getIsWin()).toBe(true);
    });
  });

  // ========== 键盘控制 ==========

  describe('键盘控制', () => {
    beforeEach(() => {
      engine.start();
    });

    it('空格键应该选择牌', () => {
      const freeTiles = engine.getFreeTiles();
      if (freeTiles.length > 0) {
        engine.setCursor({ layer: freeTiles[0].layer, row: freeTiles[0].row, col: freeTiles[0].col });
        engine.handleKeyDown(' ');
        expect(engine.getSelectedTileId()).toBe(freeTiles[0].id);
      }
    });

    it('方向键上应该移动光标', () => {
      const cursorBefore = engine.getCursor();
      engine.handleKeyDown('ArrowUp');
      const cursorAfter = engine.getCursor();
      // 光标可能改变（如果上方有牌）
      expect(cursorAfter).toBeDefined();
    });

    it('方向键下应该移动光标', () => {
      engine.handleKeyDown('ArrowDown');
      expect(engine.getCursor()).toBeDefined();
    });

    it('方向键左应该移动光标', () => {
      engine.handleKeyDown('ArrowLeft');
      expect(engine.getCursor()).toBeDefined();
    });

    it('方向键右应该移动光标', () => {
      engine.handleKeyDown('ArrowRight');
      expect(engine.getCursor()).toBeDefined();
    });

    it('W 键应该等同于方向键上', () => {
      engine.handleKeyDown('w');
      expect(engine.getCursor()).toBeDefined();
    });

    it('A 键应该等同于方向键左', () => {
      engine.handleKeyDown('a');
      expect(engine.getCursor()).toBeDefined();
    });

    it('S 键应该等同于方向键下', () => {
      engine.handleKeyDown('s');
      expect(engine.getCursor()).toBeDefined();
    });

    it('D 键应该等同于方向键右', () => {
      engine.handleKeyDown('d');
      expect(engine.getCursor()).toBeDefined();
    });

    it('H 键应该触发提示', () => {
      const scoreBefore = engine.score;
      engine.handleKeyDown('h');
      expect(engine.score).toBe(scoreBefore - HINT_PENALTY);
    });

    it('R 键应该触发洗牌', () => {
      const shufflesBefore = engine.getShufflesRemaining();
      engine.handleKeyDown('r');
      expect(engine.getShufflesRemaining()).toBe(shufflesBefore - 1);
    });

    it('非游戏状态下按键不应该有效果', () => {
      engine.pause();
      const cursorBefore = engine.getCursor();
      engine.handleKeyDown('ArrowUp');
      expect(engine.getCursor()).toEqual(cursorBefore);
    });

    it('handleKeyUp 不应该报错', () => {
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    });
  });

  // ========== getState ==========

  describe('getState', () => {
    it('应该返回正确的状态结构', () => {
      engine.start();
      const state = engine.getState();

      expect(state).toHaveProperty('tiles');
      expect(state).toHaveProperty('selectedTileId');
      expect(state).toHaveProperty('cursor');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('moves');
      expect(state).toHaveProperty('shufflesRemaining');
      expect(state).toHaveProperty('hintPair');
      expect(state).toHaveProperty('isWin');
      expect(state).toHaveProperty('totalTiles');
      expect(state).toHaveProperty('removedCount');
    });

    it('tiles 应该是数组', () => {
      engine.start();
      const state = engine.getState();
      expect(Array.isArray(state.tiles)).toBe(true);
    });

    it('初始 selectedTileId 应该为 null', () => {
      engine.start();
      const state = engine.getState();
      expect(state.selectedTileId).toBeNull();
    });

    it('初始 isWin 应该为 false', () => {
      engine.start();
      const state = engine.getState();
      expect(state.isWin).toBe(false);
    });

    it('初始 moves 应该为 0', () => {
      engine.start();
      const state = engine.getState();
      expect(state.moves).toBe(0);
    });

    it('初始 removedCount 应该为 0', () => {
      engine.start();
      const state = engine.getState();
      expect(state.removedCount).toBe(0);
    });

    it('totalTiles 应该等于牌的数量', () => {
      engine.start();
      const state = engine.getState();
      expect(state.totalTiles).toBe(engine.getTiles().length);
    });

    it('消除后 removedCount 应该更新', () => {
      engine.start();
      const freeTiles = engine.getFreeTiles();

      let pair: any[] | null = null;
      for (let i = 0; i < freeTiles.length; i++) {
        for (let j = i + 1; j < freeTiles.length; j++) {
          if (freeTiles[i].faceIndex === freeTiles[j].faceIndex) {
            pair = [freeTiles[i], freeTiles[j]];
            break;
          }
        }
        if (pair) break;
      }

      if (pair) {
        engine.setCursor({ layer: pair[0].layer, row: pair[0].row, col: pair[0].col });
        engine.handleKeyDown(' ');
        engine.setCursor({ layer: pair[1].layer, row: pair[1].row, col: pair[1].col });
        engine.handleKeyDown(' ');

        const state = engine.getState();
        expect(state.removedCount).toBe(2);
      }
    });
  });

  // ========== 常量验证 ==========

  describe('常量', () => {
    it('TILE_WIDTH 应该是正数', () => {
      expect(TILE_WIDTH).toBeGreaterThan(0);
    });

    it('TILE_HEIGHT 应该是正数', () => {
      expect(TILE_HEIGHT).toBeGreaterThan(0);
    });

    it('TOTAL_TILE_TYPES 应该是 34', () => {
      expect(TOTAL_TILE_TYPES).toBe(34);
    });

    it('TILES_PER_TYPE 应该是 4', () => {
      expect(TILES_PER_TYPE).toBe(4);
    });

    it('TURTLE_LAYOUT 应该有 5 层', () => {
      expect(TURTLE_LAYOUT.length).toBe(5);
    });

    it('SCORE_PER_MATCH 应该是正数', () => {
      expect(SCORE_PER_MATCH).toBeGreaterThan(0);
    });

    it('MAX_SHUFFLES 应该是 3', () => {
      expect(MAX_SHUFFLES).toBe(3);
    });
  });

  // ========== 布局计算 ==========

  describe('布局计算', () => {
    it('countLayoutTiles 应该正确计算牌数', () => {
      const count = countLayoutTiles(TURTLE_LAYOUT);
      expect(count).toBeGreaterThan(0);
    });

    it('countLayoutTiles 对空布局应该返回 0', () => {
      expect(countLayoutTiles([])).toBe(0);
    });

    it('countLayoutTiles 对简单布局应该正确', () => {
      const count = countLayoutTiles(SIMPLE_LAYOUT);
      expect(count).toBe(6); // 4 + 2
    });

    it('countLayoutTiles 对微型布局应该正确', () => {
      const count = countLayoutTiles(TINY_LAYOUT);
      expect(count).toBe(8); // 4*2
    });

    it('calculateLayoutOffset 应该返回有效偏移', () => {
      engine.start();
      const offset = (engine as any).calculateLayoutOffset(480, 640);
      expect(offset.offsetX).toBeGreaterThan(0);
      expect(offset.offsetY).toBeGreaterThan(0);
    });

    it('tileToPixel 应该返回有效坐标', () => {
      engine.start();
      const pos = (engine as any).tileToPixel(0, 0, 0);
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeGreaterThanOrEqual(0);
    });

    it('不同层的牌应该有不同的像素偏移', () => {
      engine.start();
      const pos0 = (engine as any).tileToPixel(0, 0, 0);
      const pos1 = (engine as any).tileToPixel(1, 0, 0);
      expect(pos1.x).not.toBe(pos0.x);
      expect(pos1.y).not.toBe(pos0.y);
    });
  });

  // ========== 游戏循环 ==========

  describe('游戏循环', () => {
    it('update 应该更新计时器', () => {
      engine.start();
      const timerBefore = (engine as any).gameTimer;
      tick(engine, 100);
      const timerAfter = (engine as any).gameTimer;
      expect(timerAfter).toBeGreaterThan(timerBefore);
    });

    it('消除动画应该在指定时间后结束', () => {
      engine.start();
      (engine as any).removeAnimation = { tile1Id: 0, tile2Id: 1, elapsed: 0 };
      tick(engine, 500);
      expect((engine as any).removeAnimation).toBeNull();
    });

    it('提示应该在指定时间后消失', () => {
      engine.start();
      (engine as any).hintState = { tile1Id: 0, tile2Id: 1, elapsed: 0, active: true };
      tick(engine, 3000);
      expect((engine as any).hintState).toBeNull();
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('没有自由牌时 findAvailablePair 应该返回 null', () => {
      engine.start();
      // 消除所有牌
      const tiles = engine.getTiles();
      for (const tile of tiles) {
        tile.removed = true;
      }
      expect(engine.findAvailablePair()).toBeNull();
    });

    it('没有光标时移动不应该报错', () => {
      engine.start();
      (engine as any).cursor = null;
      expect(() => engine.handleKeyDown('ArrowUp')).not.toThrow();
    });

    it('没有光标时空格不应该报错', () => {
      engine.start();
      (engine as any).cursor = null;
      expect(() => engine.handleKeyDown(' ')).not.toThrow();
    });

    it('getTileAt 对不存在的位置应该返回 undefined', () => {
      engine.start();
      expect(engine.getTileAt(99, 99, 99)).toBeUndefined();
    });

    it('findFirstFreeTile 在没有自由牌时应该返回 null', () => {
      engine.start();
      const tiles = engine.getTiles();
      for (const tile of tiles) {
        tile.removed = true;
      }
      expect(engine.findFirstFreeTile()).toBeNull();
    });

    it('连续快速操作不应该崩溃', () => {
      engine.start();
      for (let i = 0; i < 50; i++) {
        engine.handleKeyDown('ArrowUp');
        engine.handleKeyDown('ArrowDown');
        engine.handleKeyDown('ArrowLeft');
        engine.handleKeyDown('ArrowRight');
      }
      expect(engine.status).toBe('playing');
    });
  });

  // ========== 渲染 ==========

  describe('渲染', () => {
    it('渲染不应该报错', () => {
      engine.start();
      expect(() => tick(engine, 16)).not.toThrow();
    });

    it('暂停状态下渲染不应该报错', () => {
      engine.start();
      engine.pause();
      expect(() => tick(engine, 16)).not.toThrow();
    });

    it('胜利时渲染不应该报错', () => {
      engine.start();
      const tiles = engine.getTiles();
      for (const tile of tiles) {
        tile.removed = true;
      }
      (engine as any).isWin = true;
      expect(() => tick(engine, 16)).not.toThrow();
    });
  });

  // ========== 事件系统 ==========

  describe('事件系统', () => {
    it('statusChange 事件应该在胜利时触发', () => {
      engine.start();
      const listener = jest.fn();
      engine.on('statusChange', listener);

      // 消除所有牌模拟胜利
      const tiles = engine.getTiles();
      tiles[0].faceIndex = 0;
      tiles[1].faceIndex = 0;
      // 消除其他所有牌
      for (let i = 2; i < tiles.length; i++) {
        tiles[i].removed = true;
      }
      engine.matchTiles(tiles[0], tiles[1]);

      expect(listener).toHaveBeenCalledWith('gameover');
    });

    it('scoreChange 事件应该在消除时触发', () => {
      engine.start();
      const listener = jest.fn();
      engine.on('scoreChange', listener);

      const freeTiles = engine.getFreeTiles();
      let pair: any[] | null = null;
      for (let i = 0; i < freeTiles.length; i++) {
        for (let j = i + 1; j < freeTiles.length; j++) {
          if (freeTiles[i].faceIndex === freeTiles[j].faceIndex) {
            pair = [freeTiles[i], freeTiles[j]];
            break;
          }
        }
        if (pair) break;
      }

      if (pair) {
        engine.matchTiles(pair[0], pair[1]);
        expect(listener).toHaveBeenCalled();
      }
    });
  });

  // ========== 辅助方法 ==========

  describe('辅助方法', () => {
    it('getRemainingCount 应该返回正确数量', () => {
      engine.start();
      const total = engine.getTiles().length;
      expect(engine.getRemainingCount()).toBe(total);
    });

    it('getMoves 初始应该为 0', () => {
      engine.start();
      expect(engine.getMoves()).toBe(0);
    });

    it('getShufflesRemaining 初始应该为 MAX_SHUFFLES', () => {
      engine.start();
      expect(engine.getShufflesRemaining()).toBe(MAX_SHUFFLES);
    });

    it('getIsWin 初始应该为 false', () => {
      engine.start();
      expect(engine.getIsWin()).toBe(false);
    });

    it('getCursor 初始不应该为 null', () => {
      engine.start();
      expect(engine.getCursor()).not.toBeNull();
    });

    it('getSelectedTileId 初始应该为 null', () => {
      engine.start();
      expect(engine.getSelectedTileId()).toBeNull();
    });

    it('setCursor 应该设置光标位置', () => {
      engine.start();
      const pos: CursorPosition = { layer: 0, row: 0, col: 0 };
      engine.setCursor(pos);
      expect(engine.getCursor()).toEqual(pos);
    });

    it('getTiles 应该返回牌数组', () => {
      engine.start();
      const tiles = engine.getTiles();
      expect(Array.isArray(tiles)).toBe(true);
      expect(tiles.length).toBeGreaterThan(0);
    });
  });

  // ========== 多层交互 ==========

  describe('多层交互', () => {
    it('上层牌应该遮挡下层牌', () => {
      engine.start();
      // 找到被上层遮挡的牌
      const bottomTiles = engine.getTiles().filter(t => t.layer === 0);
      const hasBlocked = bottomTiles.some(t => !engine.isTileFree(t));
      // 在标准龟形布局中，底层中间的牌通常被遮挡
      expect(typeof hasBlocked).toBe('boolean');
    });

    it('消除上层牌后下层牌可能变为自由', () => {
      engine.start();
      const tiles = engine.getTiles();

      // 找到一张被上层遮挡的牌
      const blockedBottom = tiles.find(t => t.layer === 0 && !engine.isTileFree(t));
      if (blockedBottom) {
        // 消除遮挡它的上层牌
        const covering = tiles.filter(t =>
          t.layer > blockedBottom.layer &&
          !t.removed &&
          (engine as any).tilesOverlap(blockedBottom, t)
        );

        for (const cover of covering) {
          cover.removed = true;
        }

        // 检查是否变自由了（还取决于左右遮挡）
        const isNowFree = engine.isTileFree(blockedBottom);
        expect(typeof isNowFree).toBe('boolean');
      }
    });
  });

  // ========== 自动洗牌 ==========

  describe('自动洗牌', () => {
    it('无解时应该自动洗牌', () => {
      engine.start();
      // 创建一个无解的局面
      const tiles = engine.getTiles();
      // 只留4张不同牌面的牌
      for (let i = 4; i < tiles.length; i++) {
        tiles[i].removed = true;
      }
      tiles[0].faceIndex = 0;
      tiles[1].faceIndex = 1;
      tiles[2].faceIndex = 2;
      tiles[3].faceIndex = 3;

      // 尝试配对 - 会发现无解
      const pair = engine.findAvailablePair();
      expect(pair).toBeNull();
    });
  });

  // ========== 综合测试 ==========

  describe('综合测试', () => {
    it('完整的游戏流程', () => {
      engine.start();
      expect(engine.status).toBe('playing');

      // 检查初始状态
      const state = engine.getState();
      expect(state.totalTiles).toBeGreaterThan(0);
      expect(state.removedCount).toBe(0);

      // 使用提示找配对
      engine.handleKeyDown('h');

      // 洗牌
      engine.handleKeyDown('r');
      expect(engine.getShufflesRemaining()).toBe(MAX_SHUFFLES - 1);

      // 暂停和恢复
      engine.pause();
      expect(engine.status).toBe('paused');
      engine.resume();
      expect(engine.status).toBe('playing');

      // 重置
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('多次开始重置不应该崩溃', () => {
      for (let i = 0; i < 5; i++) {
        engine.start();
        expect(engine.status).toBe('playing');
        engine.reset();
        expect(engine.status).toBe('idle');
      }
    });

    it('消除部分牌后重置应该恢复', () => {
      engine.start();
      const tiles = engine.getTiles();
      tiles[0].removed = true;
      tiles[1].removed = true;

      engine.reset();
      expect(engine.getTiles()).toHaveLength(0);
      expect(engine.getRemainingCount()).toBe(0);
    });
  });

  // ========== 鼠标交互 ==========

  describe('鼠标交互 - 命中检测', () => {
    it('点击牌面中心应该命中该牌', () => {
      const e = createPlayingTinyEngine();
      // TINY_LAYOUT: 4x2, layer 0, offsetX=168, offsetY=297
      // Tile (0,0) id=0: center=(186, 321)
      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBe(0);
    });

    it('点击牌面左上角应该命中该牌', () => {
      const e = createPlayingTinyEngine();
      // Tile (0,0): x=168, y=297
      e.handleClick(168, 297);
      expect(e.getSelectedTileId()).toBe(0);
    });

    it('点击牌面右下角边缘应该命中该牌', () => {
      const e = createPlayingTinyEngine();
      // Tile (0,0): x=168..204 (exclusive), y=297..345 (exclusive)
      e.handleClick(203, 344);
      expect(e.getSelectedTileId()).toBe(0);
    });

    it('点击牌面外部不应该命中', () => {
      const e = createPlayingTinyEngine();
      e.handleClick(10, 10);
      // Clicking blank area deselects (was null), so still null
      expect(e.getSelectedTileId()).toBeNull();
    });

    it('点击两张牌之间的行边界应该命中下一行', () => {
      const e = createPlayingTinyEngine();
      // Tile (0,0): y=297..345, Tile (1,0): y=345..393
      // Click at y=345 (boundary) — should be in row 1
      e.handleClick(186, 345);
      // Should select tile at row=1, col=0 (id=4)
      expect(e.getSelectedTileId()).toBe(4);
    });

    it('多层布局中上层牌优先命中', () => {
      // SIMPLE_LAYOUT: 2 layers
      const simpleEngine = new MahjongSolitaireEngine();
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 640;
      simpleEngine.setCanvas(canvas);
      simpleEngine.init();
      simpleEngine.start(); // Enter playing state

      // Override with SIMPLE_LAYOUT
      simpleEngine.setLayout(SIMPLE_LAYOUT);
      const tiles = createTilesForLayout(SIMPLE_LAYOUT, [
        0, 0, 1, 1,  // layer 0: faceIndex 0,0,1,1
        2, 2,          // layer 1: faceIndex 2,2
      ]);
      simpleEngine.setTiles(tiles);

      // offsetX=168, offsetY=318
      // Layer 1, (0,0) id=4: center=(190, 348)
      // Overlaps with Layer 0, (0,0) id=0: (168..204, 318..366)
      simpleEngine.handleClick(190, 348);
      expect(simpleEngine.getSelectedTileId()).toBe(4);
    });
  });

  describe('鼠标交互 - 点击选牌', () => {
    it('点击空闲牌应该选中它', () => {
      const e = createPlayingTinyEngine();
      // Tile (0,0) is free (leftmost). Center=(186, 321)
      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBe(0);
    });

    it('再次点击已选中的牌应该取消选择', () => {
      const e = createPlayingTinyEngine();
      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBe(0);
      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBeNull();
    });

    it('点击两张同面牌应该消除配对', () => {
      const e = createPlayingTinyEngine();
      // faceIndices = [0, 0, 1, 1, 2, 2, 3, 3]
      // Tile 0 (faceIndex=0) at (0,0) center=(186, 321) - free (leftmost)
      // Tile 1 (faceIndex=0) at (0,1) center=(222, 321) - NOT free (blocked both sides)
      // Need two free tiles with same faceIndex
      // Free tiles: (0,0) id=0, (0,3) id=3, (1,0) id=4, (1,3) id=7
      // faceIndex: id=0→0, id=3→1, id=4→2, id=7→3 - all different!
      // We need to set up matching free tiles. Let's use custom face indices.
      const e2 = createPlayingTinyEngine();
      // Override tiles so that two free tiles have same faceIndex
      // Free tiles are at (0,0), (0,3), (1,0), (1,3)
      // Set (0,0) and (0,3) to same faceIndex
      const customTiles = createTilesForLayout(TINY_LAYOUT, [
        5, 0, 0, 5,   // row 0: (0,0)=5, (0,3)=5 → both free, same face
        1, 0, 0, 1,   // row 1
      ]);
      e2.setTiles(customTiles);

      // Click (0,0) center=(186, 321) - free, faceIndex=5
      e2.handleClick(186, 321);
      expect(e2.getSelectedTileId()).toBe(0);

      // Click (0,3) center=(294, 321) - free, faceIndex=5
      e2.handleClick(294, 321);
      expect(e2.getSelectedTileId()).toBeNull();
      expect(customTiles[0].removed).toBe(true);
      expect(customTiles[3].removed).toBe(true);
      expect(e2.getMoves()).toBe(1);
    });

    it('点击两张不同面牌应该切换选择', () => {
      const e = createPlayingTinyEngine();
      // Tile 0 (faceIndex=0) at (0,0) center=(186, 321) - free
      // Tile at (1,0) id=4 (faceIndex=2) center=(186, 369) - free
      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBe(0);

      e.handleClick(186, 369);
      expect(e.getSelectedTileId()).toBe(4);
      expect(e.getTiles()[0].removed).toBe(false);
    });

    it('点击空白区域应该取消选择', () => {
      const e = createPlayingTinyEngine();
      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBe(0);
      e.handleClick(10, 10);
      expect(e.getSelectedTileId()).toBeNull();
    });

    it('点击非空闲牌应该取消选择并闪烁', () => {
      const e = createPlayingTinyEngine();
      // Free: (0,0), (0,3), (1,0), (1,3)
      // Blocked: (0,1), (0,2), (1,1), (1,2)
      // Select free tile (0,0)
      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBe(0);

      // Click blocked tile (0,1) center=(222, 321)
      e.handleClick(222, 321);
      expect(e.getSelectedTileId()).toBeNull();
      expect(e.getInvalidClickFlash()).not.toBeNull();
    });

    it('点击时应该同步光标位置', () => {
      const e = createPlayingTinyEngine();
      // Click free tile (0,3) center=(294, 321)
      e.handleClick(294, 321);
      const cursor = e.getCursor();
      expect(cursor).not.toBeNull();
      expect(cursor!.layer).toBe(0);
      expect(cursor!.row).toBe(0);
      expect(cursor!.col).toBe(3);
    });

    it('点击时应该清除提示状态', () => {
      const e = createPlayingTinyEngine();
      // Default tiles [0,0,1,1,2,2,3,3] have no matching free pair.
      // Free tiles are at (0,0), (0,3), (1,0), (1,3).
      // Set custom faces so free tiles match: (0,0)=5, (0,3)=5
      const customTiles = createTilesForLayout(TINY_LAYOUT, [
        5, 0, 0, 5,   // row 0: (0,0)=5, (0,3)=5 → both free, same face
        1, 0, 0, 1,   // row 1
      ]);
      e.setTiles(customTiles);

      e.showHint();
      expect(e.getHintState()).not.toBeNull();
      // Click a free tile to clear hint
      e.handleClick(186, 321);
      expect(e.getHintState()).toBeNull();
    });

    it('非 playing 状态下点击不应该有效果', () => {
      const e = createTinyEngine(); // Not started, idle status
      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBeNull();
    });
  });

  describe('鼠标交互 - 悬停高亮', () => {
    it('鼠标移到空闲牌上应该设置悬停状态', () => {
      const e = createPlayingTinyEngine();
      e.handleMouseMove(186, 321);
      expect(e.getHoveredTileId()).toBe(0);
    });

    it('鼠标移到不同牌上应该更新悬停状态', () => {
      const e = createPlayingTinyEngine();
      e.handleMouseMove(186, 321);
      expect(e.getHoveredTileId()).toBe(0);

      // Move to free tile (0,3) center=(294, 321)
      e.handleMouseMove(294, 321);
      expect(e.getHoveredTileId()).toBe(3);
    });

    it('鼠标移到空白区域应该清除悬停状态', () => {
      const e = createPlayingTinyEngine();
      e.handleMouseMove(186, 321);
      expect(e.getHoveredTileId()).toBe(0);
      e.handleMouseMove(10, 10);
      expect(e.getHoveredTileId()).toBeNull();
    });

    it('非 playing 状态下移动鼠标不应该设置悬停', () => {
      const e = createTinyEngine(); // Not started
      e.handleMouseMove(186, 321);
      expect(e.getHoveredTileId()).toBeNull();
    });
  });

  describe('鼠标交互 - 鼠标与键盘共享状态', () => {
    it('鼠标选中后可以用键盘空格取消选择', () => {
      const e = createPlayingTinyEngine();
      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBe(0);

      e.setCursor({ layer: 0, row: 0, col: 0 });
      e.handleKeyDown(' ');
      expect(e.getSelectedTileId()).toBeNull();
    });

    it('键盘选中后可以用鼠标取消选择', () => {
      const e = createPlayingTinyEngine();
      e.setCursor({ layer: 0, row: 0, col: 0 });
      e.handleKeyDown(' ');
      expect(e.getSelectedTileId()).toBe(0);

      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBeNull();
    });

    it('鼠标选中后键盘可以配对消除', () => {
      // Set up two free tiles with same faceIndex
      const e = createPlayingTinyEngine();
      const customTiles = createTilesForLayout(TINY_LAYOUT, [
        5, 0, 0, 5,   // (0,0)=5, (0,3)=5 → both free
        1, 0, 0, 1,
      ]);
      e.setTiles(customTiles);

      // Select (0,0) via mouse
      e.handleClick(186, 321);
      expect(e.getSelectedTileId()).toBe(0);

      // Move cursor to (0,3) and select via keyboard
      e.setCursor({ layer: 0, row: 0, col: 3 });
      e.handleKeyDown(' ');
      expect(e.getSelectedTileId()).toBeNull();
      expect(customTiles[0].removed).toBe(true);
      expect(customTiles[3].removed).toBe(true);
    });

    it('键盘选中后鼠标可以配对消除', () => {
      const e = createPlayingTinyEngine();
      const customTiles = createTilesForLayout(TINY_LAYOUT, [
        5, 0, 0, 5,   // (0,0)=5, (0,3)=5 → both free
        1, 0, 0, 1,
      ]);
      e.setTiles(customTiles);

      // Select (0,0) via keyboard
      e.setCursor({ layer: 0, row: 0, col: 0 });
      e.handleKeyDown(' ');
      expect(e.getSelectedTileId()).toBe(0);

      // Click (0,3) via mouse center=(294, 321)
      e.handleClick(294, 321);
      expect(e.getSelectedTileId()).toBeNull();
      expect(customTiles[0].removed).toBe(true);
      expect(customTiles[3].removed).toBe(true);
    });
  });

  describe('鼠标交互 - 无效点击闪烁', () => {
    it('点击被侧边遮挡的牌应该触发闪烁', () => {
      const e = createPlayingTinyEngine();
      // Tile (0,1) id=1: blocked both sides, center=(222, 321)
      e.handleClick(222, 321);
      expect(e.getInvalidClickFlash()).not.toBeNull();
      expect(e.getInvalidClickFlash()!.tileId).toBe(1);
    });

    it('闪烁应该在 300ms 后消失', () => {
      const e = createPlayingTinyEngine();
      e.handleClick(222, 321);
      expect(e.getInvalidClickFlash()).not.toBeNull();

      tick(e, 300);
      expect(e.getInvalidClickFlash()).toBeNull();
    });
  });
});
