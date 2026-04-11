/**
 * Memory Match 游戏引擎测试
 * 覆盖：初始化、游戏开始、翻牌匹配、鼠标点击、键盘控制、游戏完成、重置、渲染、getState、边界条件
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryMatchEngine } from '@/games/memory-match/MemoryMatchEngine';

// ========== 引擎内部常量（与引擎文件保持一致） ==========
const GRID_COLS = 4;
const GRID_ROWS = 4;
const TOTAL_PAIRS = 8;
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const CARD_PADDING = 12;
const CARD_GAP = 10;
const GRID_OFFSET_Y = 100;
const FLIP_DURATION = 300;
const MISMATCH_DELAY = 800;
const BASE_SCORE = 1000;
const MISMATCH_PENALTY = 50;

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

function createAndInitEngine(): MemoryMatchEngine {
  const engine = new MemoryMatchEngine();
  const canvas = createCanvas();
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

/** 模拟游戏循环推进 deltaTime 毫秒 */
function advanceTime(engine: MemoryMatchEngine, ms: number) {
  // @ts-expect-error - 访问 protected update
  engine.update(ms);
}

/** 获取引擎内部卡牌数组 */
function getCards(engine: MemoryMatchEngine) {
  // @ts-expect-error - 访问 private
  return engine['cards'] as Array<{
    id: number;
    symbolIndex: number;
    isFlipped: boolean;
    isMatched: boolean;
    flipProgress: number;
    flipDirection: 'open' | 'close' | null;
  }>;
}

/** 获取已翻开索引列表 */
function getFlippedIndices(engine: MemoryMatchEngine) {
  // @ts-expect-error
  return engine['flippedIndices'] as number[];
}

/** 获取已匹配对数 */
function getMatchedPairs(engine: MemoryMatchEngine) {
  // @ts-expect-error
  return engine['matchedPairs'] as number;
}

/** 获取锁定状态 */
function isLocked(engine: MemoryMatchEngine) {
  // @ts-expect-error
  return engine['isLocked'] as boolean;
}

/** 获取光标位置 */
function getCursorIndex(engine: MemoryMatchEngine) {
  // @ts-expect-error
  return engine['cursorIndex'] as number;
}

/** 获取卡牌布局参数 */
function getLayout(engine: MemoryMatchEngine) {
  const totalGapX = CARD_GAP * (GRID_COLS - 1);
  const cardWidth = (CANVAS_WIDTH - 2 * CARD_PADDING - totalGapX) / GRID_COLS;
  const cardHeight = cardWidth;
  const gridStartX = CARD_PADDING;
  return { cardWidth, cardHeight, gridStartX };
}

/** 获取指定索引卡牌的中心坐标（画布坐标） */
function getCardCenter(engine: MemoryMatchEngine, index: number): [number, number] {
  const layout = getLayout(engine);
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  const x = layout.gridStartX + col * (layout.cardWidth + CARD_GAP) + layout.cardWidth / 2;
  const y = GRID_OFFSET_Y + row * (layout.cardHeight + CARD_GAP) + layout.cardHeight / 2;
  return [x, y];
}

/** 找到两张不同符号的卡牌索引 */
function findMismatchPair(engine: MemoryMatchEngine): [number, number] {
  const cards = getCards(engine);
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i].symbolIndex !== cards[j].symbolIndex) {
        return [i, j];
      }
    }
  }
  throw new Error('无法找到不匹配对');
}

/** 找到所有匹配对的索引 */
function findAllPairs(engine: MemoryMatchEngine): [number, number][] {
  const cards = getCards(engine);
  const symbolMap: Record<number, number[]> = {};
  cards.forEach((card, i) => {
    if (!symbolMap[card.symbolIndex]) symbolMap[card.symbolIndex] = [];
    symbolMap[card.symbolIndex].push(i);
  });
  return Object.values(symbolMap) as [number, number][];
}

// ========== 测试套件 ==========

describe('MemoryMatchEngine', () => {
  let engine: MemoryMatchEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = createAndInitEngine();
  });

  afterEach(() => {
    engine.destroy();
    vi.useRealTimers();
  });

  // ===== 1. 初始化测试 =====

  describe('初始化', () => {
    it('应该正确初始化引擎', () => {
      expect(engine).toBeDefined();
      const state = engine.getState();
      expect(state).toHaveProperty('cards');
      expect(state).toHaveProperty('matchedPairs');
      expect(state).toHaveProperty('totalPairs');
      expect(state).toHaveProperty('cursorIndex');
    });

    it('应该创建 16 张卡牌（8 对）', () => {
      const cards = getCards(engine);
      expect(cards).toHaveLength(16);
    });

    it('卡牌初始状态应该全部背面朝上', () => {
      const cards = getCards(engine);
      for (const card of cards) {
        expect(card.isFlipped).toBe(false);
        expect(card.isMatched).toBe(false);
      }
    });

    it('应该包含 8 对符号', () => {
      const cards = getCards(engine);
      const symbolCounts: Record<number, number> = {};
      for (const card of cards) {
        symbolCounts[card.symbolIndex] = (symbolCounts[card.symbolIndex] || 0) + 1;
      }
      const counts = Object.values(symbolCounts);
      expect(counts).toHaveLength(8);
      for (const count of counts) {
        expect(count).toBe(2);
      }
    });

    it('应该计算正确的卡牌布局尺寸', () => {
      const layout = getLayout(engine);
      expect(layout.cardWidth).toBeGreaterThan(0);
      expect(layout.cardHeight).toBeGreaterThan(0);
      expect(layout.cardWidth).toBe(layout.cardHeight); // 正方形卡牌
    });
  });

  // ===== 2. 游戏开始测试 =====

  describe('游戏开始', () => {
    it('start 后状态应为 playing', () => {
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('start 后分数应为 BASE_SCORE (1000)', () => {
      engine.start();
      expect(engine.score).toBe(BASE_SCORE);
    });

    it('start 后应该重新创建卡牌（洗牌后）', () => {
      engine.start();
      const cards = getCards(engine);
      expect(cards).toHaveLength(16);
    });

    it('start 后所有卡牌应为背面状态', () => {
      engine.start();
      const cards = getCards(engine);
      for (const card of cards) {
        expect(card.isFlipped).toBe(false);
        expect(card.isMatched).toBe(false);
      }
    });

    it('start 后匹配数和已翻开列表应为空', () => {
      engine.start();
      expect(getMatchedPairs(engine)).toBe(0);
      expect(getFlippedIndices(engine)).toHaveLength(0);
    });
  });

  // ===== 3. 翻牌与匹配测试 =====

  describe('翻牌与匹配', () => {
    beforeEach(() => {
      engine.start();
    });

    it('翻开一张卡牌后应该加入已翻开列表', () => {
      engine.handleKeyDown('Enter');
      expect(getFlippedIndices(engine)).toHaveLength(1);
      expect(getCards(engine)[0].isFlipped).toBe(true);
    });

    it('不能翻开同一张卡牌两次', () => {
      engine.handleKeyDown('Enter');
      engine.handleKeyDown('Enter');
      expect(getFlippedIndices(engine)).toHaveLength(1);
    });

    it('翻开两张匹配的卡牌后应该标记为已匹配', () => {
      const cards = getCards(engine);
      const pairs = findAllPairs(engine);
      const [i1, i2] = pairs[0];

      // 翻开第一张
      engine.handleClick(...getCardCenter(engine, i1));
      expect(getFlippedIndices(engine)).toHaveLength(1);

      // 翻开第二张
      engine.handleClick(...getCardCenter(engine, i2));
      // 匹配后 flippedIndices 清空
      expect(getFlippedIndices(engine)).toHaveLength(0);
      expect(cards[i1].isMatched).toBe(true);
      expect(cards[i2].isMatched).toBe(true);
      expect(getMatchedPairs(engine)).toBe(1);
    });

    it('翻开两张不匹配的卡牌应该锁定输入', () => {
      const [i1, i2] = findMismatchPair(engine);

      engine.handleClick(...getCardCenter(engine, i1));
      engine.handleClick(...getCardCenter(engine, i2));
      expect(isLocked(engine)).toBe(true);
    });

    it('不匹配的卡牌延迟后应该翻回', () => {
      const cards = getCards(engine);
      const [i1, i2] = findMismatchPair(engine);

      engine.handleClick(...getCardCenter(engine, i1));
      engine.handleClick(...getCardCenter(engine, i2));
      expect(isLocked(engine)).toBe(true);

      // 推进时间超过 MISMATCH_DELAY (800ms)
      advanceTime(engine, MISMATCH_DELAY + 50);
      expect(isLocked(engine)).toBe(false);
      expect(cards[i1].isFlipped).toBe(false);
      expect(cards[i2].isFlipped).toBe(false);
    });

    it('不匹配应该扣 MISMATCH_PENALTY (50) 分', () => {
      const [i1, i2] = findMismatchPair(engine);

      const scoreBefore = engine.score;
      engine.handleClick(...getCardCenter(engine, i1));
      engine.handleClick(...getCardCenter(engine, i2));
      expect(engine.score).toBe(scoreBefore - MISMATCH_PENALTY);
    });

    it('锁定状态下不能翻牌', () => {
      const cards = getCards(engine);
      const [i1, i2] = findMismatchPair(engine);
      let i3 = -1;
      for (let k = 0; k < cards.length; k++) {
        if (k !== i1 && k !== i2) { i3 = k; break; }
      }

      engine.handleClick(...getCardCenter(engine, i1));
      engine.handleClick(...getCardCenter(engine, i2));
      // 锁定状态
      expect(isLocked(engine)).toBe(true);

      // 尝试翻第三张
      engine.handleClick(...getCardCenter(engine, i3));
      expect(getCards(engine)[i3].isFlipped).toBe(false);
    });
  });

  // ===== 4. 鼠标点击测试 =====

  describe('鼠标点击', () => {
    beforeEach(() => {
      engine.start();
    });

    it('点击卡牌区域应该翻开对应卡牌', () => {
      const [cx, cy] = getCardCenter(engine, 0);
      engine.handleClick(cx, cy);
      expect(getCards(engine)[0].isFlipped).toBe(true);
    });

    it('点击网格外的区域不应该翻牌', () => {
      engine.handleClick(0, 0); // 左上角，在 header 区域
      const cards = getCards(engine);
      for (const card of cards) {
        expect(card.isFlipped).toBe(false);
      }
    });

    it('点击应该同步光标位置', () => {
      const [cx, cy] = getCardCenter(engine, 5);
      engine.handleClick(cx, cy);
      expect(getCursorIndex(engine)).toBe(5);
    });

    it('非 playing 状态下点击无效', () => {
      const engine2 = createAndInitEngine();
      // idle 状态，未 start
      const [cx, cy] = getCardCenter(engine2, 0);
      engine2.handleClick(cx, cy);
      expect(getCards(engine2)[0].isFlipped).toBe(false);
      engine2.destroy();
    });

    it('点击间隙区域不应该翻牌', () => {
      const layout = getLayout(engine);
      // 第一张卡牌右边缘 + 1px（间隙区域）
      const gapX = layout.gridStartX + layout.cardWidth + 1;
      const gapY = GRID_OFFSET_Y + layout.cardHeight / 2;
      engine.handleClick(gapX, gapY);
      const cards = getCards(engine);
      for (const card of cards) {
        expect(card.isFlipped).toBe(false);
      }
    });
  });

  // ===== 5. 键盘控制测试 =====

  describe('键盘控制', () => {
    beforeEach(() => {
      engine.start();
    });

    it('光标初始位置应为 0', () => {
      expect(getCursorIndex(engine)).toBe(0);
    });

    it('ArrowRight 应该向右移动光标', () => {
      engine.handleKeyDown('ArrowRight');
      expect(getCursorIndex(engine)).toBe(1);
    });

    it('ArrowDown 应该向下移动光标（移动 4 格）', () => {
      engine.handleKeyDown('ArrowDown');
      expect(getCursorIndex(engine)).toBe(GRID_COLS);
    });

    it('ArrowLeft 在第一列不应该移动', () => {
      engine.handleKeyDown('ArrowLeft');
      expect(getCursorIndex(engine)).toBe(0);
    });

    it('ArrowUp 在第一行不应该移动', () => {
      engine.handleKeyDown('ArrowUp');
      expect(getCursorIndex(engine)).toBe(0);
    });

    it('ArrowRight 在行末不应该跨行', () => {
      // 移到第一行末尾 (index 3)
      for (let i = 0; i < 3; i++) engine.handleKeyDown('ArrowRight');
      expect(getCursorIndex(engine)).toBe(3);
      // 再右移不应该到第二行
      engine.handleKeyDown('ArrowRight');
      expect(getCursorIndex(engine)).toBe(3);
    });

    it('空格应该翻开光标位置的卡牌', () => {
      engine.handleKeyDown(' ');
      expect(getCards(engine)[0].isFlipped).toBe(true);
    });

    it('Enter 应该翻开光标位置的卡牌', () => {
      engine.handleKeyDown('Enter');
      expect(getCards(engine)[0].isFlipped).toBe(true);
    });

    it('非 playing 状态下键盘无效', () => {
      const engine2 = createAndInitEngine();
      engine2.handleKeyDown('ArrowRight');
      expect(getCursorIndex(engine2)).toBe(0);
      engine2.destroy();
    });
  });

  // ===== 6. 游戏完成测试 =====

  describe('游戏完成', () => {
    it('全部匹配完成后应该触发 gameover', () => {
      engine.start();

      const pairs = findAllPairs(engine);
      const statusSpy = vi.fn();
      engine.on('statusChange', statusSpy);

      // 逐对翻开所有匹配对
      for (const [i1, i2] of pairs) {
        engine.handleClick(...getCardCenter(engine, i1));
        engine.handleClick(...getCardCenter(engine, i2));
      }

      // 推进时间让最后的 setTimeout 触发
      vi.advanceTimersByTime(FLIP_DURATION + 300);

      expect(statusSpy).toHaveBeenCalledWith('gameover');
    });

    it('完成后 getState 应该包含所有匹配信息', () => {
      engine.start();
      const pairs = findAllPairs(engine);

      for (const [i1, i2] of pairs) {
        engine.handleClick(...getCardCenter(engine, i1));
        engine.handleClick(...getCardCenter(engine, i2));
      }

      vi.advanceTimersByTime(FLIP_DURATION + 300);

      const state = engine.getState();
      expect(state.matchedPairs).toBe(TOTAL_PAIRS);
      expect(state.totalPairs).toBe(TOTAL_PAIRS);
    });
  });

  // ===== 7. 重置测试 =====

  describe('重置', () => {
    it('reset 后应该恢复初始状态', () => {
      engine.start();
      engine.handleKeyDown('Enter');
      engine.reset();

      const cards = getCards(engine);
      for (const card of cards) {
        expect(card.isFlipped).toBe(false);
        expect(card.isMatched).toBe(false);
      }
      expect(getMatchedPairs(engine)).toBe(0);
      expect(getFlippedIndices(engine)).toHaveLength(0);
    });

    it('reset 后可以重新开始游戏', () => {
      engine.start();
      engine.handleKeyDown('Enter');
      engine.reset();
      engine.start();

      expect(engine.status).toBe('playing');
      expect(engine.score).toBe(BASE_SCORE);
    });
  });

  // ===== 8. 渲染测试 =====

  describe('渲染', () => {
    it('playing 状态下渲染不应该报错', () => {
      engine.start();
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => {
        // @ts-expect-error - 访问 protected onRender
        engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });

    it('gameover 状态下渲染胜利遮罩不应该报错', () => {
      engine.start();
      // 强制设置 gameover
      // @ts-expect-error
      engine['_status'] = 'gameover';
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d')!;
      expect(() => {
        // @ts-expect-error
        engine.onRender(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      }).not.toThrow();
    });
  });

  // ===== 9. getState 测试 =====

  describe('getState', () => {
    it('应该返回完整的游戏状态', () => {
      engine.start();
      const state = engine.getState();
      expect(state).toHaveProperty('cards');
      expect(state).toHaveProperty('matchedPairs');
      expect(state).toHaveProperty('totalPairs', TOTAL_PAIRS);
      expect(state).toHaveProperty('cursorIndex');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('elapsedTime');
    });

    it('卡牌状态应该包含必要字段', () => {
      engine.start();
      const state = engine.getState();
      const cardState = (state.cards as Array<Record<string, unknown>>)[0];
      expect(cardState).toHaveProperty('id');
      expect(cardState).toHaveProperty('symbolIndex');
      expect(cardState).toHaveProperty('isFlipped');
      expect(cardState).toHaveProperty('isMatched');
    });
  });

  // ===== 10. 边界条件测试 =====

  describe('边界条件', () => {
    it('分数不能低于 0', () => {
      engine.start();
      // @ts-expect-error - 强制设置低分
      engine['_score'] = 30;
      // 模拟不匹配扣分
      const [i1, i2] = findMismatchPair(engine);
      engine.handleClick(...getCardCenter(engine, i1));
      engine.handleClick(...getCardCenter(engine, i2));
      expect(engine.score).toBe(0);
    });

    it('handleClick 在非 playing 状态返回', () => {
      // idle 状态
      engine.handleClick(100, 200);
      expect(getCards(engine).every((c) => !c.isFlipped)).toBe(true);
    });

    it('handleKeyDown 在非 playing 状态返回', () => {
      // idle 状态
      engine.handleKeyDown('ArrowRight');
      expect(getCursorIndex(engine)).toBe(0);
    });

    it('翻牌动画应该随时间推进', () => {
      engine.start();
      engine.handleKeyDown('Enter');
      const card = getCards(engine)[0];
      expect(card.flipDirection).toBe('open');
      expect(card.flipProgress).toBe(0);

      // 推进动画时间
      advanceTime(engine, FLIP_DURATION / 2);
      expect(card.flipProgress).toBeGreaterThan(0);
    });
  });
});
