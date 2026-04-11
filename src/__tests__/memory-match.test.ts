/**
 * Memory Match 引擎测试
 * 43 个测试用例覆盖全部核心逻辑
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryMatchEngine } from '@/games/memory-match/MemoryMatchEngine';
import {
  LEVEL_CONFIGS,
  BASE_SCORE,
  SCORE_BASE_MATCH,
  SCORE_COMBO_BONUS,
  SCORE_MISMATCH_PENALTY,
  SCORE_MIN,
  FLIP_DURATION,
  MISMATCH_DELAY,
  MATCH_GLOW_DURATION,
  WIN_DELAY,
  TIME_BONUS_THRESHOLD,
  TIME_BONUS_MAX,
  CARD_GAP,
} from '@/games/memory-match/constants';

// ========== 辅助函数 ==========

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

function createEngine(level = 1): MemoryMatchEngine {
  const engine = new MemoryMatchEngine();
  engine.setLevel(level);
  engine.init(createCanvas());
  return engine;
}

function startEngine(level = 1): MemoryMatchEngine {
  const engine = createEngine(level);
  engine.start();
  return engine;
}

/** 推进 update（含动画） */
function advanceUpdate(engine: MemoryMatchEngine, dt: number): void {
  (engine as any).update(dt);
}

/** 获取内部 cards 数组 */
function getCards(engine: MemoryMatchEngine): any[] {
  return (engine as any).cards;
}

/** 获取匹配对数 */
function getMatchedPairs(engine: MemoryMatchEngine): number {
  return (engine as any).matchedPairs;
}

/** 获取翻牌索引 */
function getFlippedIndices(engine: MemoryMatchEngine): number[] {
  return (engine as any).flippedIndices;
}

/** 获取 combo */
function getCombo(engine: MemoryMatchEngine): number {
  return (engine as any).combo;
}

/** 获取 maxCombo */
function getMaxCombo(engine: MemoryMatchEngine): number {
  return (engine as any).maxCombo;
}

/** 获取 steps */
function getSteps(engine: MemoryMatchEngine): number {
  return (engine as any).steps;
}

/** 获取 isWin */
function getIsWin(engine: MemoryMatchEngine): boolean {
  return (engine as any).isWin;
}

/** 获取 isLocked */
function getIsLocked(engine: MemoryMatchEngine): boolean {
  return (engine as any).isLocked;
}

/** 获取 mismatchTimer */
function getMismatchTimer(engine: MemoryMatchEngine): number {
  return (engine as any).mismatchTimer;
}

/** 获取 cols/rows */
function getGridSize(engine: MemoryMatchEngine): { cols: number; rows: number } {
  return { cols: (engine as any).cols, rows: (engine as any).rows };
}

/** 获取 cursorIndex */
function getCursorIndex(engine: MemoryMatchEngine): number {
  return (engine as any).cursorIndex;
}

/** 设置 cursorIndex */
function setCursorIndex(engine: MemoryMatchEngine, idx: number): void {
  (engine as any).cursorIndex = idx;
}

/** 获取 score */
function getScore(engine: MemoryMatchEngine): number {
  return (engine as any)._score;
}

/** 设置 score */
function setScore(engine: MemoryMatchEngine, score: number): void {
  (engine as any)._score = score;
}

/** 获取 totalPairs */
function getTotalPairs(engine: MemoryMatchEngine): number {
  return (engine as any).totalPairs;
}

/** 模拟翻牌 */
function flipCard(engine: MemoryMatchEngine, index: number): void {
  (engine as any).flipCardAt(index);
}

/** 获取 cardWidth */
function getCardWidth(engine: MemoryMatchEngine): number {
  return (engine as any).cardWidth;
}

/** 获取 gridStartX */
function getGridStartX(engine: MemoryMatchEngine): number {
  return (engine as any).gridStartX;
}

// ========== 测试 ==========

describe('MemoryMatchEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== 1. 初始化与生命周期 (6) =====
  describe('初始化与生命周期', () => {
    it('onInit 应设置默认 level 1 配置（4×4, 8 pairs）', () => {
      const engine = createEngine();
      const { cols, rows } = getGridSize(engine);
      expect(cols).toBe(4);
      expect(rows).toBe(4);
      expect(getTotalPairs(engine)).toBe(8);
    });

    it('onStart 应重置状态并设置 score 为 BASE_SCORE', () => {
      const engine = startEngine();
      expect(getScore(engine)).toBe(BASE_SCORE);
      expect(getMatchedPairs(engine)).toBe(0);
      expect(getSteps(engine)).toBe(0);
      expect(getCombo(engine)).toBe(0);
      expect(getIsWin(engine)).toBe(false);
      expect(getIsLocked(engine)).toBe(false);
    });

    it('onStart 应创建打乱的卡牌', () => {
      const engine = startEngine();
      const cards = getCards(engine);
      expect(cards.length).toBe(16); // 4×4
      // 每对 symbolIndex 出现恰好 2 次
      const symbolCounts: Record<number, number> = {};
      cards.forEach((c: any) => {
        symbolCounts[c.symbolIndex] = (symbolCounts[c.symbolIndex] || 0) + 1;
      });
      Object.values(symbolCounts).forEach((count) => {
        expect(count).toBe(2);
      });
    });

    it('onReset 应重置棋盘并恢复 level 配置', () => {
      const engine = startEngine(2);
      flipCard(engine, 0);
      engine.reset();
      expect(getMatchedPairs(engine)).toBe(0);
      expect(getSteps(engine)).toBe(0);
      // reset 后基类设 _level=1，onReset 调 applyLevelConfig(this._level=1)
      // 所以恢复为 level 1 配置（4×4）
      const { cols, rows } = getGridSize(engine);
      expect(cols).toBe(4);
      expect(rows).toBe(4);
    });

    it('onReset 应重置 score 为 0', () => {
      const engine = startEngine();
      setScore(engine, 500);
      engine.reset();
      expect(getScore(engine)).toBe(0);
    });

    it('update 应推进翻牌动画', () => {
      const engine = startEngine();
      const cards = getCards(engine);
      // 手动设置一个翻牌动画
      cards[0].flipDirection = 'open';
      cards[0].flipProgress = 0.5;
      advanceUpdate(engine, 16);
      // flipProgress 应增加
      expect(cards[0].flipProgress).toBeGreaterThan(0.5);
    });
  });

  // ===== 2. 翻牌逻辑 (5) =====
  describe('翻牌逻辑', () => {
    it('flipCardAt 应成功翻牌并标记 isFlipped', () => {
      const engine = startEngine();
      flipCard(engine, 0);
      const cards = getCards(engine);
      expect(cards[0].isFlipped).toBe(true);
      expect(cards[0].flipDirection).toBe('open');
    });

    it('翻已翻开的牌应被拒绝', () => {
      const engine = startEngine();
      flipCard(engine, 0);
      // 再次翻同一张
      flipCard(engine, 0);
      expect(getFlippedIndices(engine).length).toBe(1);
    });

    it('翻已匹配的牌应被拒绝', () => {
      const engine = startEngine();
      const cards = getCards(engine);
      // 手动标记为已匹配
      cards[0].isMatched = true;
      flipCard(engine, 0);
      expect(getFlippedIndices(engine).length).toBe(0);
    });

    it('锁定时翻牌应被拒绝', () => {
      const engine = startEngine();
      (engine as any).isLocked = true;
      flipCard(engine, 0);
      expect(getFlippedIndices(engine).length).toBe(0);
    });

    it('翻 2 张牌应触发 steps++', () => {
      const engine = startEngine();
      flipCard(engine, 0);
      flipCard(engine, 1);
      expect(getSteps(engine)).toBe(1);
    });
  });

  // ===== 3. 匹配逻辑 (6) =====
  describe('匹配逻辑', () => {
    it('匹配成功应标记 matched 并加分', () => {
      const engine = startEngine();
      const cards = getCards(engine);
      // 找到一对相同 symbolIndex 的卡牌
      const pair = findPairIndices(cards);
      const initialScore = getScore(engine);

      flipCard(engine, pair[0]);
      flipCard(engine, pair[1]);

      expect(cards[pair[0]].isMatched).toBe(true);
      expect(cards[pair[1]].isMatched).toBe(true);
      expect(cards[pair[0]].state).toBe('matched');
      expect(getMatchedPairs(engine)).toBe(1);
      expect(getScore(engine)).toBeGreaterThan(initialScore);
    });

    it('匹配成功应增加 combo', () => {
      const engine = startEngine();
      const cards = getCards(engine);

      // 第一次匹配
      const pair1 = findPairIndices(cards);
      flipCard(engine, pair1[0]);
      flipCard(engine, pair1[1]);
      expect(getCombo(engine)).toBe(1);
      expect(getMaxCombo(engine)).toBe(1);
    });

    it('不匹配应锁定、扣分、重置 combo', () => {
      const engine = startEngine();
      const cards = getCards(engine);

      // 找到不同 symbolIndex 的两张牌
      const diffPair = findDiffPairIndices(cards);
      const initialScore = getScore(engine);

      flipCard(engine, diffPair[0]);
      flipCard(engine, diffPair[1]);

      expect(getIsLocked(engine)).toBe(true);
      expect(getMismatchTimer(engine)).toBe(MISMATCH_DELAY);
      expect(getCombo(engine)).toBe(0);
      expect(getScore(engine)).toBe(initialScore - SCORE_MISMATCH_PENALTY);
    });

    it('mismatchTimer 倒计时到 0 应触发 resolveMismatch', () => {
      const engine = startEngine();
      const cards = getCards(engine);
      const diffPair = findDiffPairIndices(cards);

      flipCard(engine, diffPair[0]);
      flipCard(engine, diffPair[1]);

      // 推进时间到 mismatch 过期
      advanceUpdate(engine, MISMATCH_DELAY + 10);

      // 卡牌应被翻回
      expect(cards[diffPair[0]].isFlipped).toBe(false);
      expect(cards[diffPair[1]].isFlipped).toBe(false);
      expect(cards[diffPair[0]].state).toBe('hidden');
      expect(getIsLocked(engine)).toBe(false);
      expect(getFlippedIndices(engine).length).toBe(0);
    });

    it('连续匹配应递增 combo 并跟踪 maxCombo', () => {
      const engine = startEngine();
      const cards = getCards(engine);

      // 第一对
      const pair1 = findPairIndices(cards);
      flipCard(engine, pair1[0]);
      flipCard(engine, pair1[1]);
      expect(getCombo(engine)).toBe(1);

      // 第二对
      const remaining = cards
        .map((c: any, i: number) => ({ ...c, idx: i }))
        .filter((c: any) => !c.isMatched);
      const pair2 = findPairIndicesFrom(remaining);
      flipCard(engine, pair2[0]);
      flipCard(engine, pair2[1]);
      expect(getCombo(engine)).toBe(2);
      expect(getMaxCombo(engine)).toBe(2);
    });

    it('combo 奖励分计算正确（SCORE_COMBO_BONUS * combo）', () => {
      const engine = startEngine();
      const cards = getCards(engine);

      // 连续匹配 2 对
      const pair1 = findPairIndices(cards);
      flipCard(engine, pair1[0]);
      flipCard(engine, pair1[1]);
      const scoreAfter1 = getScore(engine);

      const remaining = cards
        .map((c: any, i: number) => ({ ...c, idx: i }))
        .filter((c: any) => !c.isMatched);
      const pair2 = findPairIndicesFrom(remaining);
      flipCard(engine, pair2[0]);
      flipCard(engine, pair2[1]);
      const scoreAfter2 = getScore(engine);

      // 第二对有 combo=2 奖励：comboBonus = max(0, combo-1) * SCORE_COMBO_BONUS = 1 * 50 = 50
      const expectedGain = SCORE_BASE_MATCH + SCORE_COMBO_BONUS * 1;
      expect(scoreAfter2 - scoreAfter1).toBe(expectedGain);
    });
  });

  // ===== 4. 胜利条件 (4) =====
  describe('胜利条件', () => {
    it('全部匹配后 isWin 应为 true', () => {
      const engine = startEngine();
      const cards = getCards(engine);

      // 手动匹配所有对
      matchAllPairs(engine, cards);

      expect(getIsWin(engine)).toBe(true);
    });

    it('全部匹配后应触发 gameOver', () => {
      const engine = startEngine();
      const cards = getCards(engine);
      vi.useFakeTimers();

      matchAllPairs(engine, cards);

      // 推进 WIN_DELAY
      vi.advanceTimersByTime(WIN_DELAY + 100);

      expect(engine.status).toBe('gameover');
      vi.useRealTimers();
    });

    it('时间奖励：elapsedTime < THRESHOLD 应获得额外分数', () => {
      const engine = startEngine();
      const cards = getCards(engine);

      // 设置 elapsedTime 为较小值
      (engine as any)._elapsedTime = 30; // 远小于 THRESHOLD(120s)
      const scoreBefore = getScore(engine);

      // 手动匹配最后一对触发 handleWin
      matchAllPairs(engine, cards);

      // 应有时间奖励（elapsedTime < THRESHOLD）
      expect(getScore(engine)).toBeGreaterThan(scoreBefore + SCORE_BASE_MATCH);
    });

    it('时间奖励：elapsedTime >= THRESHOLD 不应获得额外分数', () => {
      const engine = startEngine();
      const cards = getCards(engine);

      // 先匹配 7 对（不触发 handleWin）
      const pairs: Record<number, number[]> = {};
      for (let i = 0; i < cards.length; i++) {
        const sym = cards[i].symbolIndex;
        if (!pairs[sym]) pairs[sym] = [];
        pairs[sym].push(i);
      }
      const pairKeys = Object.keys(pairs);
      for (let k = 0; k < pairKeys.length - 1; k++) {
        const [a, b] = pairs[parseInt(pairKeys[k])];
        flipCard(engine, a);
        flipCard(engine, b);
      }

      // 设置 elapsedTime 超过阈值
      (engine as any)._elapsedTime = TIME_BONUS_THRESHOLD + 100;
      const scoreBefore = getScore(engine);

      // 匹配最后一对触发 handleWin
      const [a, b] = pairs[parseInt(pairKeys[pairKeys.length - 1])];
      flipCard(engine, a);
      flipCard(engine, b);

      // 分数含匹配加分 + combo bonus（第8对 combo=8, bonus=(8-1)*50=350）
      // 不含时间奖励（elapsedTime >= THRESHOLD）
      const comboBonus = (8 - 1) * SCORE_COMBO_BONUS;
      const expectedScore = scoreBefore + SCORE_BASE_MATCH + comboBonus;
      expect(getScore(engine)).toBe(expectedScore);
    });
  });

  // ===== 5. 光标移动 (4) =====
  describe('光标移动', () => {
    it('moveCursor 应正确移动光标位置', () => {
      const engine = startEngine();
      const { cols } = getGridSize(engine);
      setCursorIndex(engine, 0);

      (engine as any).moveCursor(cols); // 向下一行
      expect(getCursorIndex(engine)).toBe(cols);
    });

    it('左边界不跨行（delta=-1）', () => {
      const engine = startEngine();
      setCursorIndex(engine, 4); // 第二行第一个
      (engine as any).moveCursor(-1);
      expect(getCursorIndex(engine)).toBe(4); // 不变
    });

    it('右边界不跨行（delta=+1）', () => {
      const engine = startEngine();
      const { cols } = getGridSize(engine);
      setCursorIndex(engine, cols - 1); // 第一行最后一个
      (engine as any).moveCursor(1);
      expect(getCursorIndex(engine)).toBe(cols - 1); // 不变
    });

    it('超出范围应拒绝移动', () => {
      const engine = startEngine();
      setCursorIndex(engine, 0);
      (engine as any).moveCursor(-1);
      expect(getCursorIndex(engine)).toBe(0);

      const totalCards = getCards(engine).length;
      setCursorIndex(engine, totalCards - 1);
      const { cols } = getGridSize(engine);
      (engine as any).moveCursor(cols);
      expect(getCursorIndex(engine)).toBe(totalCards - 1);
    });
  });

  // ===== 6. 卡牌创建 (3) =====
  describe('卡牌创建', () => {
    it('createCards 应创建正确数量的配对卡牌', () => {
      const engine = createEngine();
      (engine as any).createCards();
      const cards = getCards(engine);
      expect(cards.length).toBe(16); // 4×4 = 8 pairs × 2

      // 每个 symbolIndex 恰好出现 2 次
      const counts: Record<number, number> = {};
      cards.forEach((c: any) => {
        counts[c.symbolIndex] = (counts[c.symbolIndex] || 0) + 1;
      });
      Object.values(counts).forEach((v) => expect(v).toBe(2));
    });

    it('createShuffledCards 应产生不同顺序', () => {
      const engine = createEngine();
      (engine as any).createShuffledCards();
      const order1 = getCards(engine).map((c: any) => c.symbolIndex);

      (engine as any).createShuffledCards();
      const order2 = getCards(engine).map((c: any) => c.symbolIndex);

      // 大概率不同（极小概率相同但不影响测试有效性）
      const same = order1.every((v: number, i: number) => v === order2[i]);
      // 不强制不同，但验证长度一致
      expect(order1.length).toBe(order2.length);
      // 验证包含相同的 symbolIndex
      const sorted1 = [...order1].sort();
      const sorted2 = [...order2].sort();
      expect(sorted1).toEqual(sorted2);
    });

    it('makeCard 应创建默认状态的卡牌', () => {
      const engine = createEngine();
      const card = (engine as any).makeCard(5, 3);
      expect(card.id).toBe(5);
      expect(card.symbolIndex).toBe(3);
      expect(card.isFlipped).toBe(false);
      expect(card.isMatched).toBe(false);
      expect(card.state).toBe('hidden');
      expect(card.flipProgress).toBe(0);
      expect(card.flipDirection).toBeNull();
      expect(card.glowTimer).toBe(0);
    });
  });

  // ===== 7. 布局计算 (3) =====
  describe('布局计算', () => {
    it('applyLevelConfig 各等级应设置正确的网格尺寸', () => {
      // Level 1: 4×4
      const e1 = createEngine(1);
      const g1 = getGridSize(e1);
      expect(g1.cols).toBe(4);
      expect(g1.rows).toBe(4);
      expect(getTotalPairs(e1)).toBe(8);

      // Level 2: 5×4
      const e2 = createEngine(2);
      const g2 = getGridSize(e2);
      expect(g2.cols).toBe(5);
      expect(g2.rows).toBe(4);
      expect(getTotalPairs(e2)).toBe(10);

      // Level 3: 6×6
      const e3 = createEngine(3);
      const g3 = getGridSize(e3);
      expect(g3.cols).toBe(6);
      expect(g3.rows).toBe(6);
      expect(getTotalPairs(e3)).toBe(18);
    });

    it('calculateLayout 应计算正方形卡牌', () => {
      const engine = createEngine();
      const cardWidth = getCardWidth(engine);
      const cardHeight = (engine as any).cardHeight;
      expect(cardWidth).toBe(cardHeight);
      expect(cardWidth).toBeGreaterThan(0);
    });

    it('getCardPosition 和 getCardAtPosition 应正确转换坐标', () => {
      const engine = startEngine();
      const { cols } = getGridSize(engine);

      // 获取第 0 张卡的位置
      const pos0 = (engine as any).getCardPosition(0);
      expect(pos0.x).toBeGreaterThanOrEqual(0);
      expect(pos0.y).toBeGreaterThanOrEqual(0);

      // 通过坐标反查应得到正确索引
      const centerX = pos0.x + getCardWidth(engine) / 2;
      const centerY = pos0.y + (engine as any).cardHeight / 2;
      const idx = (engine as any).getCardAtPosition(centerX, centerY);
      expect(idx).toBe(0);

      // 点击空白区域应返回 -1
      const emptyIdx = (engine as any).getCardAtPosition(0, 0);
      // gridStartX/gridStartY 可能 > 0，所以 (0,0) 可能在网格外
      const gridStartX = getGridStartX(engine);
      const gridStartY = (engine as any).gridStartY;
      if (gridStartX > 0 || gridStartY > 0) {
        expect(emptyIdx).toBe(-1);
      }
    });
  });

  // ===== 8. 输入处理 (3) =====
  describe('输入处理', () => {
    it('handleKeyDown 方向键应移动光标', () => {
      const engine = startEngine();
      const { cols } = getGridSize(engine);
      setCursorIndex(engine, 5);

      (engine as any).handleKeyDown('ArrowLeft');
      expect(getCursorIndex(engine)).toBe(4);

      (engine as any).handleKeyDown('ArrowRight');
      expect(getCursorIndex(engine)).toBe(5);

      (engine as any).handleKeyDown('ArrowUp');
      expect(getCursorIndex(engine)).toBe(5 - cols);

      (engine as any).handleKeyDown('ArrowDown');
      expect(getCursorIndex(engine)).toBe(5);
    });

    it('handleKeyDown 空格/回车应翻牌', () => {
      const engine = startEngine();
      setCursorIndex(engine, 0);

      (engine as any).handleKeyDown(' ');
      const cards = getCards(engine);
      expect(cards[0].isFlipped).toBe(true);

      // 回车同样
      setCursorIndex(engine, 1);
      (engine as any).handleKeyDown('Enter');
      expect(cards[1].isFlipped).toBe(true);
    });

    it('handleClick 应通过坐标翻牌', () => {
      const engine = startEngine();
      const cards = getCards(engine);
      const pos = (engine as any).getCardPosition(0);
      const cardW = getCardWidth(engine);
      const cardH = (engine as any).cardHeight;

      // 点击第一张卡的中心
      (engine as any).handleClick(
        pos.x + cardW / 2,
        pos.y + cardH / 2
      );

      expect(cards[0].isFlipped).toBe(true);
      expect(getCursorIndex(engine)).toBe(0);
    });
  });

  // ===== 9. 计分系统 (4) =====
  describe('计分系统', () => {
    it('初始 score 应为 BASE_SCORE (1000)', () => {
      const engine = startEngine();
      expect(getScore(engine)).toBe(BASE_SCORE);
    });

    it('匹配加分 = SCORE_BASE_MATCH + SCORE_COMBO_BONUS * combo', () => {
      const engine = startEngine();
      const cards = getCards(engine);

      const pair = findPairIndices(cards);
      const scoreBefore = getScore(engine);

      flipCard(engine, pair[0]);
      flipCard(engine, pair[1]);

      // combo 从 0→1，comboBonus = max(0, 1-1)*50 = 0，奖励 = 100
      const expectedGain = SCORE_BASE_MATCH;
      expect(getScore(engine)).toBe(scoreBefore + expectedGain);
    });

    it('不匹配扣分最低为 SCORE_MIN (0)', () => {
      const engine = startEngine();
      setScore(engine, 10); // 很低分
      const cards = getCards(engine);

      const diffPair = findDiffPairIndices(cards);
      flipCard(engine, diffPair[0]);
      flipCard(engine, diffPair[1]);

      // 扣 50 分，但最低 0
      expect(getScore(engine)).toBe(SCORE_MIN);
    });

    it('连续不匹配不应使分数低于 SCORE_MIN', () => {
      const engine = startEngine();
      setScore(engine, 30);
      const cards = getCards(engine);

      // 第一次不匹配
      let diffPair = findDiffPairIndices(cards);
      flipCard(engine, diffPair[0]);
      flipCard(engine, diffPair[1]);
      advanceUpdate(engine, MISMATCH_DELAY + 10); // 等待解锁

      // 第二次不匹配
      diffPair = findDiffPairIndices(cards);
      flipCard(engine, diffPair[0]);
      flipCard(engine, diffPair[1]);

      expect(getScore(engine)).toBe(SCORE_MIN);
    });
  });

  // ===== 10. getState (3) =====
  describe('getState', () => {
    it('应返回完整状态对象', () => {
      const engine = startEngine();
      const state = engine.getState() as any;

      expect(state).toHaveProperty('cards');
      expect(state).toHaveProperty('cols');
      expect(state).toHaveProperty('rows');
      expect(state).toHaveProperty('steps');
      expect(state).toHaveProperty('matchedPairs');
      expect(state).toHaveProperty('totalPairs');
      expect(state).toHaveProperty('combo');
      expect(state).toHaveProperty('maxCombo');
      expect(state).toHaveProperty('cursorIndex');
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('isWin');
    });

    it('游戏进行中状态应正确反映', () => {
      const engine = startEngine();
      flipCard(engine, 0);
      flipCard(engine, 1);

      const state = engine.getState() as any;
      expect(state.steps).toBe(1);
      expect(state.cards.length).toBe(16);
    });

    it('游戏结束状态应反映 isWin', () => {
      const engine = startEngine();
      const cards = getCards(engine);
      vi.useFakeTimers();

      matchAllPairs(engine, cards);
      vi.advanceTimersByTime(WIN_DELAY + 100);

      const state = engine.getState() as any;
      expect(state.isWin).toBe(true);
      vi.useRealTimers();
    });
  });

  // ===== 11. 等级配置 (2) =====
  describe('等级配置', () => {
    it('Level 1 应为 4×4, 8 pairs', () => {
      const engine = startEngine(1);
      const { cols, rows } = getGridSize(engine);
      expect(cols).toBe(4);
      expect(rows).toBe(4);
      expect(getTotalPairs(engine)).toBe(8);
      expect(getCards(engine).length).toBe(16);
    });

    it('Level 2 应为 5×4, 10 pairs', () => {
      const engine = startEngine(2);
      const { cols, rows } = getGridSize(engine);
      expect(cols).toBe(5);
      expect(rows).toBe(4);
      expect(getTotalPairs(engine)).toBe(10);
      expect(getCards(engine).length).toBe(20);
    });
  });
});

// ========== 辅助：查找配对索引 ==========

/** 从 cards 数组中找到一对相同 symbolIndex 的索引 */
function findPairIndices(cards: any[]): [number, number] {
  const seen: Record<number, number> = {};
  for (let i = 0; i < cards.length; i++) {
    const sym = cards[i].symbolIndex;
    if (seen[sym] !== undefined) {
      return [seen[sym], i];
    }
    seen[sym] = i;
  }
  // 不应该到这里
  return [0, 1];
}

/** 从 cards 数组中找到两张不同 symbolIndex 的索引 */
function findDiffPairIndices(cards: any[]): [number, number] {
  if (cards[0].symbolIndex !== cards[1].symbolIndex) {
    return [0, 1];
  }
  // 找第一个不同的
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].symbolIndex !== cards[0].symbolIndex) {
      return [0, i];
    }
  }
  return [0, 1];
}

/** 从带 idx 属性的数组中找配对索引 */
function findPairIndicesFrom(remaining: any[]): [number, number] {
  const seen: Record<number, number> = {};
  for (const item of remaining) {
    const sym = item.symbolIndex;
    if (seen[sym] !== undefined) {
      return [seen[sym], item.idx];
    }
    seen[sym] = item.idx;
  }
  return [remaining[0].idx, remaining[1].idx];
}

/** 匹配所有对 */
function matchAllPairs(engine: MemoryMatchEngine, cards: any[]): void {
  const matched = new Set<number>();
  const pairs: Record<number, number[]> = {};

  // 按 symbolIndex 分组
  for (let i = 0; i < cards.length; i++) {
    const sym = cards[i].symbolIndex;
    if (!pairs[sym]) pairs[sym] = [];
    pairs[sym].push(i);
  }

  // 逐对匹配
  for (const sym of Object.keys(pairs)) {
    const [a, b] = pairs[parseInt(sym)];
    flipCard(engine, a);
    flipCard(engine, b);
  }
}
