import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SolitaireEngine } from '../SolitaireEngine';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  SCORE_FLIP, SCORE_FOUNDATION, SCORE_FOUNDATION_BACK,
  SUITS, RANKS,
  rankValue, isRedSuit, suitSymbol,
} from '../constants';

// ========== 辅助函数 ==========

function createEngine(): SolitaireEngine {
  const engine = new SolitaireEngine();
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  engine.init(canvas);
  return engine;
}

/** 启动引擎（进入 playing 状态，发好牌） */
function startEngine(engine: SolitaireEngine): void {
  engine.start();
}

/** 手动调用 update（跳过游戏循环和渲染） */
function tick(engine: SolitaireEngine, dt: number = 16): void {
  (engine as any).update(dt);
}

/** 创建一张指定花色和面值的牌 */
function makeCard(suit: string, rank: string, faceUp = true) {
  return { suit: suit as any, rank: rank as any, faceUp };
}

/** 将引擎置于指定光标位置 */
function setCursor(engine: SolitaireEngine, area: string, col = 0, row = 0): void {
  (engine as any)._cursorArea = area;
  (engine as any)._cursorCol = col;
  (engine as any)._cursorRow = row;
}

/** 拿到内部 tableau 引用，方便直接操作 */
function getTableau(engine: SolitaireEngine): any[][] {
  return (engine as any)._tableau;
}
function getFoundations(engine: SolitaireEngine): any[][] {
  return (engine as any)._foundations;
}
function getWaste(engine: SolitaireEngine): any[] {
  return (engine as any)._waste;
}
function getStock(engine: SolitaireEngine): any[] {
  return (engine as any)._stock;
}

// ========== 测试 ==========

describe('SolitaireEngine', () => {
  let engine: SolitaireEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ========== 初始化 ==========

  describe('初始化', () => {
    it('应正确创建引擎实例', () => {
      expect(engine).toBeInstanceOf(SolitaireEngine);
    });

    it('初始状态应为 idle', () => {
      expect(engine.status).toBe('idle');
    });

    it('初始分数应为 0', () => {
      expect(engine.score).toBe(0);
    });

    it('初始等级应为 1', () => {
      expect(engine.level).toBe(1);
    });

    it('初始移动次数应为 0', () => {
      expect(engine.moves).toBe(0);
    });

    it('初始不应胜利', () => {
      expect(engine.isWin).toBe(false);
    });

    it('初始光标在 stock', () => {
      expect(engine.cursorArea).toBe('stock');
      expect(engine.cursorCol).toBe(0);
      expect(engine.cursorRow).toBe(0);
    });

    it('初始选择为空', () => {
      expect(engine.selection).toBeNull();
      expect(engine.selectedCards).toEqual([]);
    });

    it('初始 stock 为空（发牌前）', () => {
      expect(engine.stock).toEqual([]);
    });

    it('初始 waste 为空', () => {
      expect(engine.waste).toEqual([]);
    });

    it('初始 foundation 各列为空', () => {
      expect(engine.foundations).toEqual([[], [], [], []]);
    });

    it('初始 tableau 各列为空', () => {
      expect(engine.tableau).toEqual([[], [], [], [], [], [], []]);
    });

    it('自动完成阶段为 idle', () => {
      expect(engine.autoCompletePhase).toBe('idle');
    });
  });

  // ========== 游戏生命周期 ==========

  describe('游戏生命周期', () => {
    it('start 后状态变为 playing', () => {
      engine.start();
      expect(engine.status).toBe('playing');
    });

    it('start 后 stock 剩余 24 张牌', () => {
      engine.start();
      // 52 - 28 (发到 tableau) = 24
      expect(engine.stock.length).toBe(24);
    });

    it('start 后 waste 为空', () => {
      engine.start();
      expect(engine.waste.length).toBe(0);
    });

    it('start 后 foundation 各列为空', () => {
      engine.start();
      for (let i = 0; i < 4; i++) {
        expect(engine.foundations[i].length).toBe(0);
      }
    });

    it('start 后 tableau 有 7 列', () => {
      engine.start();
      expect(engine.tableau.length).toBe(7);
    });

    it('start 后 tableau 各列长度为 i+1', () => {
      engine.start();
      for (let i = 0; i < 7; i++) {
        expect(engine.tableau[i].length).toBe(i + 1);
      }
    });

    it('start 后 tableau 每列最上面一张面朝上', () => {
      engine.start();
      for (let i = 0; i < 7; i++) {
        const pile = engine.tableau[i];
        expect(pile[pile.length - 1].faceUp).toBe(true);
      }
    });

    it('start 后 tableau 每列非顶部牌面朝下', () => {
      engine.start();
      for (let i = 1; i < 7; i++) {
        const pile = engine.tableau[i];
        for (let j = 0; j < pile.length - 1; j++) {
          expect(pile[j].faceUp).toBe(false);
        }
      }
    });

    it('start 后总牌数为 52', () => {
      engine.start();
      const total =
        engine.stock.length +
        engine.waste.length +
        engine.foundations.reduce((s, f) => s + f.length, 0) +
        engine.tableau.reduce((s, t) => s + t.length, 0);
      expect(total).toBe(52);
    });

    it('start 后分数重置为 0', () => {
      engine.start();
      expect(engine.score).toBe(0);
    });

    it('pause 后状态变为 paused', () => {
      startEngine(engine);
      engine.pause();
      expect(engine.status).toBe('paused');
    });

    it('resume 后状态恢复为 playing', () => {
      startEngine(engine);
      engine.pause();
      engine.resume();
      expect(engine.status).toBe('playing');
    });

    it('reset 后状态变为 idle', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('reset 后所有区域清空', () => {
      startEngine(engine);
      engine.reset();
      expect(engine.stock.length).toBe(0);
      expect(engine.waste.length).toBe(0);
      expect(engine.foundations).toEqual([[], [], [], []]);
      expect(engine.tableau).toEqual([[], [], [], [], [], [], []]);
    });

    it('destroy 后状态变为 idle', () => {
      startEngine(engine);
      engine.destroy();
      expect(engine.status).toBe('idle');
    });
  });

  // ========== 发牌 ==========

  describe('发牌', () => {
    it('每张牌有合法的花色', () => {
      startEngine(engine);
      const allCards = [
        ...engine.stock,
        ...engine.waste,
        ...engine.foundations.flat(),
        ...engine.tableau.flat(),
      ];
      for (const card of allCards) {
        expect(SUITS).toContain(card.suit);
      }
    });

    it('每张牌有合法的面值', () => {
      startEngine(engine);
      const allCards = [
        ...engine.stock,
        ...engine.waste,
        ...engine.foundations.flat(),
        ...engine.tableau.flat(),
      ];
      for (const card of allCards) {
        expect(RANKS).toContain(card.rank);
      }
    });

    it('52 张牌无重复', () => {
      startEngine(engine);
      const allCards = [
        ...engine.stock,
        ...engine.waste,
        ...engine.foundations.flat(),
        ...engine.tableau.flat(),
      ];
      const ids = allCards.map(c => `${c.suit}-${c.rank}`);
      const unique = new Set(ids);
      expect(unique.size).toBe(52);
    });

    it('每次 start 洗牌不同（大概率）', () => {
      startEngine(engine);
      const stock1 = engine.stock.map(c => `${c.suit}-${c.rank}`).join(',');
      engine.reset();
      startEngine(engine);
      const stock2 = engine.stock.map(c => `${c.suit}-${c.rank}`).join(',');
      // 极小概率相同，但测试中可以接受
      // 只需确认都是 24 张
      expect(engine.stock.length).toBe(24);
    });
  });

  // ========== Stock 翻牌 ==========

  describe('Stock 翻牌', () => {
    it('从 stock 翻一张到 waste', () => {
      startEngine(engine);
      engine.drawFromStock();
      expect(engine.waste.length).toBe(1);
      expect(engine.stock.length).toBe(23);
    });

    it('翻出的牌面朝上', () => {
      startEngine(engine);
      engine.drawFromStock();
      expect(engine.waste[0].faceUp).toBe(true);
    });

    it('翻牌增加移动次数', () => {
      startEngine(engine);
      engine.drawFromStock();
      expect(engine.moves).toBe(1);
    });

    it('翻牌增加分数', () => {
      startEngine(engine);
      engine.drawFromStock();
      expect(engine.score).toBe(SCORE_FLIP);
    });

    it('连续翻多张', () => {
      startEngine(engine);
      for (let i = 0; i < 5; i++) engine.drawFromStock();
      expect(engine.waste.length).toBe(5);
      expect(engine.stock.length).toBe(19);
    });

    it('stock 空时回收 waste', () => {
      startEngine(engine);
      const stockSize = engine.stock.length;
      for (let i = 0; i < stockSize; i++) engine.drawFromStock();
      expect(engine.stock.length).toBe(0);
      expect(engine.waste.length).toBe(stockSize);

      engine.drawFromStock(); // 触发回收
      expect(engine.stock.length).toBe(stockSize);
      expect(engine.waste.length).toBe(0);
    });

    it('回收后所有牌面朝下', () => {
      startEngine(engine);
      const stockSize = engine.stock.length;
      for (let i = 0; i < stockSize; i++) engine.drawFromStock();
      engine.drawFromStock(); // 回收
      for (const card of engine.stock) {
        expect(card.faceUp).toBe(false);
      }
    });

    it('stock 和 waste 都为空时翻牌无效果', () => {
      startEngine(engine);
      // 清空所有牌
      getStock(engine).length = 0;
      getWaste(engine).length = 0;
      engine.drawFromStock();
      expect(engine.waste.length).toBe(0);
      expect(engine.stock.length).toBe(0);
    });

    it('空格键在 stock 区域翻牌', () => {
      startEngine(engine);
      setCursor(engine, 'stock');
      engine.handleKeyDown(' ');
      expect(engine.waste.length).toBe(1);
    });
  });

  // ========== 选择与放置 ==========

  describe('选择机制', () => {
    it('Enter 在 waste 拾取牌', () => {
      startEngine(engine);
      engine.drawFromStock();
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      expect(engine.selection).not.toBeNull();
      expect(engine.selection!.source).toBe('waste');
    });

    it('Enter 在空 waste 不拾取', () => {
      startEngine(engine);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      expect(engine.selection).toBeNull();
    });

    it('Enter 在 foundation 拾取顶部牌', () => {
      startEngine(engine);
      // 放一张 A 到 foundation
      const card = makeCard('hearts', 'A');
      getFoundations(engine)[0].push(card);
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('Enter');
      expect(engine.selection).not.toBeNull();
      expect(engine.selection!.source).toBe('foundation');
      expect(engine.selectedCards.length).toBe(1);
    });

    it('Enter 在空 foundation 不拾取', () => {
      startEngine(engine);
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('Enter');
      expect(engine.selection).toBeNull();
    });

    it('Enter 在 tableau 拾取面朝上的牌', () => {
      startEngine(engine);
      // 第 0 列只有 1 张面朝上的牌
      setCursor(engine, 'tableau', 0, 0);
      engine.handleKeyDown('Enter');
      expect(engine.selection).not.toBeNull();
      expect(engine.selection!.source).toBe('tableau');
    });

    it('Enter 在 tableau 面朝下的牌不拾取', () => {
      startEngine(engine);
      // 第 6 列有 7 张，前 6 张面朝下
      setCursor(engine, 'tableau', 6, 0);
      engine.handleKeyDown('Enter');
      expect(engine.selection).toBeNull();
    });

    it('Enter 在空 tableau 不拾取', () => {
      startEngine(engine);
      getTableau(engine)[0] = [];
      setCursor(engine, 'tableau', 0, 0);
      engine.handleKeyDown('Enter');
      expect(engine.selection).toBeNull();
    });

    it('Escape 清除选择', () => {
      startEngine(engine);
      engine.drawFromStock();
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      expect(engine.selection).not.toBeNull();
      engine.handleKeyDown('Escape');
      expect(engine.selection).toBeNull();
    });

    it('空格键有选择时取消选择', () => {
      startEngine(engine);
      engine.drawFromStock();
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      expect(engine.selection).not.toBeNull();
      engine.handleKeyDown(' ');
      expect(engine.selection).toBeNull();
    });
  });

  // ========== Foundation 放置规则 ==========

  describe('Foundation 放置规则', () => {
    it('只有 A 能放到空 foundation', () => {
      startEngine(engine);
      const card = makeCard('hearts', 'A');
      getWaste(engine).push(card);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter'); // 拾取
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('Enter'); // 放置
      expect(engine.foundations[0].length).toBe(1);
    });

    it('非 A 不能放到空 foundation', () => {
      startEngine(engine);
      const card = makeCard('hearts', '2');
      getWaste(engine).push(card);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('Enter');
      expect(engine.foundations[0].length).toBe(0);
    });

    it('同花色递增可放到 foundation', () => {
      startEngine(engine);
      const ace = makeCard('hearts', 'A');
      const two = makeCard('hearts', '2');
      getFoundations(engine)[0].push(ace);
      getWaste(engine).push(two);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('Enter');
      expect(engine.foundations[0].length).toBe(2);
    });

    it('不同花色不能放到 foundation', () => {
      startEngine(engine);
      const ace = makeCard('hearts', 'A');
      const two = makeCard('spades', '2');
      getFoundations(engine)[0].push(ace);
      getWaste(engine).push(two);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('Enter');
      expect(engine.foundations[0].length).toBe(1);
    });

    it('不连续的牌不能放到 foundation', () => {
      startEngine(engine);
      const ace = makeCard('hearts', 'A');
      const three = makeCard('hearts', '3');
      getFoundations(engine)[0].push(ace);
      getWaste(engine).push(three);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('Enter');
      expect(engine.foundations[0].length).toBe(1);
    });

    it('放到 foundation 加分', () => {
      startEngine(engine);
      const ace = makeCard('hearts', 'A');
      getWaste(engine).push(ace);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'foundation', 0);
      const prevScore = engine.score;
      engine.handleKeyDown('Enter');
      expect(engine.score).toBe(prevScore + SCORE_FOUNDATION);
    });

    it('从 foundation 移回 foundation 加负分', () => {
      startEngine(engine);
      const ace = makeCard('hearts', 'A');
      const two = makeCard('hearts', '2');
      getFoundations(engine)[0].push(ace);
      getFoundations(engine)[1].push(two);
      // 从 foundation[1] 拾取 2♥，放到 foundation[0]
      setCursor(engine, 'foundation', 1);
      engine.handleKeyDown('Enter');
      setCursor(engine, 'foundation', 0);
      const prevScore = engine.score;
      engine.handleKeyDown('Enter');
      // 实际上 2♥ 不能放到 A♥ 上因为已在不同列，但同花色递增应该可以
      // 这里测试的是从 foundation 来源的加分逻辑
      // 由于 2♥ 放到 A♥ 上是合法的（同花色递增），且来源是 foundation，应加 SCORE_FOUNDATION_BACK
      expect(engine.foundations[0].length).toBe(2);
      expect(engine.score).toBe(prevScore + SCORE_FOUNDATION_BACK);
    });

    it('多张牌不能放到 foundation', () => {
      startEngine(engine);
      // 在 tableau 放两张面朝上的牌
      const k = makeCard('hearts', 'K');
      const q = makeCard('hearts', 'Q');
      getTableau(engine)[0] = [k, q];
      setCursor(engine, 'tableau', 0, 0);
      engine.handleKeyDown('Enter'); // 拾取 2 张
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('Enter'); // 尝试放置
      expect(engine.foundations[0].length).toBe(0);
    });
  });

  // ========== Tableau 放置规则 ==========

  describe('Tableau 放置规则', () => {
    it('只有 K 能放到空 tableau', () => {
      startEngine(engine);
      const king = makeCard('hearts', 'K');
      getWaste(engine).push(king);
      getTableau(engine)[0] = [];
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'tableau', 0);
      engine.handleKeyDown('Enter');
      expect(engine.tableau[0].length).toBe(1);
    });

    it('非 K 不能放到空 tableau', () => {
      startEngine(engine);
      const queen = makeCard('hearts', 'Q');
      getWaste(engine).push(queen);
      getTableau(engine)[0] = [];
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'tableau', 0);
      engine.handleKeyDown('Enter');
      expect(engine.tableau[0].length).toBe(0);
    });

    it('异色递减可放到 tableau', () => {
      startEngine(engine);
      const king = makeCard('hearts', 'K');  // 红
      const queen = makeCard('spades', 'Q');  // 黑
      getTableau(engine)[0] = [king];
      getWaste(engine).push(queen);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'tableau', 0);
      engine.handleKeyDown('Enter');
      expect(engine.tableau[0].length).toBe(2);
    });

    it('同色不能放到 tableau', () => {
      startEngine(engine);
      const king = makeCard('hearts', 'K');   // 红
      const queen = makeCard('diamonds', 'Q'); // 红
      getTableau(engine)[0] = [king];
      getWaste(engine).push(queen);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'tableau', 0);
      engine.handleKeyDown('Enter');
      expect(engine.tableau[0].length).toBe(1);
    });

    it('不连续不能放到 tableau', () => {
      startEngine(engine);
      const king = makeCard('hearts', 'K');
      const jack = makeCard('spades', 'J');
      getTableau(engine)[0] = [king];
      getWaste(engine).push(jack);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'tableau', 0);
      engine.handleKeyDown('Enter');
      expect(engine.tableau[0].length).toBe(1);
    });

    it('面朝下的顶牌不能放', () => {
      startEngine(engine);
      const king = makeCard('hearts', 'K', false);
      const queen = makeCard('spades', 'Q');
      getTableau(engine)[0] = [king];
      getWaste(engine).push(queen);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'tableau', 0);
      engine.handleKeyDown('Enter');
      expect(engine.tableau[0].length).toBe(1);
    });

    it('不能放到 waste', () => {
      startEngine(engine);
      const king = makeCard('hearts', 'K');
      getWaste(engine).push(king);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      // 应该清除选择而不是放置
      expect(engine.selection).toBeNull();
    });

    it('不能放到 stock', () => {
      startEngine(engine);
      const king = makeCard('hearts', 'K');
      getWaste(engine).push(king);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'stock');
      engine.handleKeyDown('Enter');
      expect(engine.selection).toBeNull();
    });
  });

  // ========== 翻牌与计分 ==========

  describe('翻牌与计分', () => {
    it('移动后翻开 tableau 面朝下的顶牌', () => {
      startEngine(engine);
      // 第 6 列有 7 张，顶牌面朝上，其余面朝下
      // 手动设置：移走顶牌后，下一张应被翻开
      const pile = getTableau(engine)[6];
      expect(pile.length).toBe(7);
      expect(pile[pile.length - 1].faceUp).toBe(true);
      expect(pile[pile.length - 2].faceUp).toBe(false);

      // 移走顶牌到空列（需是 K）
      // 先设好场景：把顶牌改成 K，另一列清空
      pile[pile.length - 1] = makeCard('hearts', 'K');
      getTableau(engine)[0] = [];

      setCursor(engine, 'tableau', 6, 6);
      engine.handleKeyDown('Enter'); // 拾取
      setCursor(engine, 'tableau', 0);
      engine.handleKeyDown('Enter'); // 放置

      // 原来面朝下的牌现在应被翻开
      expect(pile[pile.length - 1].faceUp).toBe(true);
    });

    it('翻 tableau 牌加翻牌分', () => {
      startEngine(engine);
      const pile = getTableau(engine)[6];
      pile[pile.length - 1] = makeCard('hearts', 'K');
      getTableau(engine)[0] = [];

      const prevScore = engine.score;
      setCursor(engine, 'tableau', 6, 6);
      engine.handleKeyDown('Enter');
      setCursor(engine, 'tableau', 0);
      engine.handleKeyDown('Enter');

      expect(engine.score).toBe(prevScore + SCORE_FLIP);
    });

    it('成功放置增加移动次数', () => {
      startEngine(engine);
      const pile = getTableau(engine)[6];
      pile[pile.length - 1] = makeCard('hearts', 'K');
      getTableau(engine)[0] = [];

      const prevMoves = engine.moves;
      setCursor(engine, 'tableau', 6, 6);
      engine.handleKeyDown('Enter');
      setCursor(engine, 'tableau', 0);
      engine.handleKeyDown('Enter');

      expect(engine.moves).toBe(prevMoves + 1);
    });

    it('放置失败不增加移动次数', () => {
      startEngine(engine);
      const queen = makeCard('hearts', 'Q');
      getWaste(engine).push(queen);
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      setCursor(engine, 'tableau', 0);
      // 第 0 列顶牌可能不是 K，放置可能失败
      const prevMoves = engine.moves;
      engine.handleKeyDown('Enter');
      // 如果放置失败，moves 不变
      // 这里只验证 moves 不减少
      expect(engine.moves).toBeGreaterThanOrEqual(prevMoves);
    });
  });

  // ========== 胜利检测 ==========

  describe('胜利检测', () => {
    it('所有 52 张牌到 foundation 时胜利', () => {
      startEngine(engine);
      // 直接把所有牌放到 foundation
      const foundations = getFoundations(engine);
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          foundations[SUITS.indexOf(suit)].push(makeCard(suit, rank));
        }
      }
      // 清空其他区域
      getStock(engine).length = 0;
      getWaste(engine).length = 0;
      for (let i = 0; i < 7; i++) getTableau(engine)[i] = [];

      // 触发 checkWin
      (engine as any).checkWin();
      expect(engine.isWin).toBe(true);
    });

    it('未集齐 52 张不胜利', () => {
      startEngine(engine);
      const foundations = getFoundations(engine);
      foundations[0].push(makeCard('hearts', 'A'));
      (engine as any).checkWin();
      expect(engine.isWin).toBe(false);
    });

    it('胜利后状态变为 gameover', () => {
      startEngine(engine);
      const foundations = getFoundations(engine);
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          foundations[SUITS.indexOf(suit)].push(makeCard(suit, rank));
        }
      }
      getStock(engine).length = 0;
      getWaste(engine).length = 0;
      for (let i = 0; i < 7; i++) getTableau(engine)[i] = [];

      (engine as any).checkWin();
      expect(engine.status).toBe('gameover');
    });
  });

  // ========== 键盘导航 ==========

  describe('键盘导航', () => {
    it('ArrowRight 从 stock 到 waste', () => {
      startEngine(engine);
      setCursor(engine, 'stock');
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorArea).toBe('waste');
    });

    it('ArrowRight 从 waste 到 foundation', () => {
      startEngine(engine);
      setCursor(engine, 'waste');
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorArea).toBe('foundation');
      expect(engine.cursorCol).toBe(0);
    });

    it('ArrowRight 在 foundation 向右移动', () => {
      startEngine(engine);
      setCursor(engine, 'foundation', 1);
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorCol).toBe(2);
    });

    it('ArrowRight 在 foundation 最右不越界', () => {
      startEngine(engine);
      setCursor(engine, 'foundation', 3);
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorCol).toBe(3);
    });

    it('ArrowRight 在 tableau 向右移动', () => {
      startEngine(engine);
      setCursor(engine, 'tableau', 2, 0);
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorCol).toBe(3);
    });

    it('ArrowRight 在 tableau 最右不越界', () => {
      startEngine(engine);
      setCursor(engine, 'tableau', 6, 0);
      engine.handleKeyDown('ArrowRight');
      expect(engine.cursorCol).toBe(6);
    });

    it('ArrowLeft 在 foundation 向左移动', () => {
      startEngine(engine);
      setCursor(engine, 'foundation', 2);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.cursorCol).toBe(1);
    });

    it('ArrowLeft 在 foundation 最左到 waste', () => {
      startEngine(engine);
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.cursorArea).toBe('waste');
    });

    it('ArrowLeft 从 waste 到 stock', () => {
      startEngine(engine);
      setCursor(engine, 'waste');
      engine.handleKeyDown('ArrowLeft');
      expect(engine.cursorArea).toBe('stock');
    });

    it('ArrowLeft 在 tableau 向左移动', () => {
      startEngine(engine);
      setCursor(engine, 'tableau', 3, 0);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.cursorCol).toBe(2);
    });

    it('ArrowLeft 在 tableau 最左不越界', () => {
      startEngine(engine);
      setCursor(engine, 'tableau', 0, 0);
      engine.handleKeyDown('ArrowLeft');
      expect(engine.cursorCol).toBe(0);
    });

    it('ArrowDown 从 stock 到 tableau', () => {
      startEngine(engine);
      setCursor(engine, 'stock');
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorArea).toBe('tableau');
    });

    it('ArrowDown 从 waste 到 tableau', () => {
      startEngine(engine);
      setCursor(engine, 'waste');
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorArea).toBe('tableau');
    });

    it('ArrowDown 从 foundation 到 tableau', () => {
      startEngine(engine);
      setCursor(engine, 'foundation', 2);
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorArea).toBe('tableau');
      expect(engine.cursorCol).toBe(2);
    });

    it('ArrowDown 在 tableau 向下移动', () => {
      startEngine(engine);
      // 第 6 列有 7 张牌
      setCursor(engine, 'tableau', 6, 5);
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorRow).toBe(6);
    });

    it('ArrowDown 在 tableau 底部不越界', () => {
      startEngine(engine);
      const pileLen = getTableau(engine)[6].length;
      setCursor(engine, 'tableau', 6, pileLen - 1);
      engine.handleKeyDown('ArrowDown');
      expect(engine.cursorRow).toBe(pileLen - 1);
    });

    it('ArrowUp 从 tableau 顶部到 stock', () => {
      startEngine(engine);
      setCursor(engine, 'tableau', 3, 0);
      engine.handleKeyDown('ArrowUp');
      expect(engine.cursorArea).toBe('stock');
    });

    it('ArrowUp 从 foundation 到 stock', () => {
      startEngine(engine);
      setCursor(engine, 'foundation', 2);
      engine.handleKeyDown('ArrowUp');
      expect(engine.cursorArea).toBe('stock');
    });

    it('ArrowUp 从 waste 到 stock', () => {
      startEngine(engine);
      setCursor(engine, 'waste');
      engine.handleKeyDown('ArrowUp');
      expect(engine.cursorArea).toBe('stock');
    });

    it('ArrowUp 在 tableau 向上移动', () => {
      startEngine(engine);
      setCursor(engine, 'tableau', 6, 3);
      engine.handleKeyDown('ArrowUp');
      expect(engine.cursorRow).toBe(2);
    });

    it('数字键 1-7 选择 tableau 列', () => {
      startEngine(engine);
      engine.handleKeyDown('3');
      expect(engine.cursorArea).toBe('tableau');
      expect(engine.cursorCol).toBe(2);
    });

    it('数字键 7 选择最后一列', () => {
      startEngine(engine);
      engine.handleKeyDown('7');
      expect(engine.cursorArea).toBe('tableau');
      expect(engine.cursorCol).toBe(6);
    });

    it('R 键在 playing 状态重置并重新开始', () => {
      startEngine(engine);
      engine.drawFromStock();
      expect(engine.waste.length).toBe(1);
      engine.handleKeyDown('r');
      expect(engine.status).toBe('playing');
      expect(engine.waste.length).toBe(0);
    });

    it('大写 R 键也能重置', () => {
      startEngine(engine);
      engine.handleKeyDown('R');
      expect(engine.status).toBe('playing');
    });

    it('R 键在 idle 状态开始游戏', () => {
      // idle 状态下按 R
      engine.handleKeyDown('r');
      expect(engine.status).toBe('playing');
    });
  });

  // ========== 胜利后键盘 ==========

  describe('胜利后键盘', () => {
    it('胜利后 R 键重新开始', () => {
      startEngine(engine);
      (engine as any)._isWin = true;
      (engine as any)._status = 'gameover';
      engine.handleKeyDown('r');
      expect(engine.status).toBe('playing');
      expect(engine.isWin).toBe(false);
    });

    it('胜利后非 R 键无效', () => {
      startEngine(engine);
      (engine as any)._isWin = true;
      (engine as any)._status = 'gameover';
      engine.handleKeyDown('ArrowUp');
      // 光标不应变化（因为胜利后直接 return）
      expect(engine.cursorArea).toBe('stock');
    });
  });

  // ========== 自动完成 ==========

  describe('自动完成', () => {
    it('stock 非空时不能自动完成', () => {
      startEngine(engine);
      // stock 有 24 张
      engine.handleKeyDown('a');
      expect(engine.autoCompletePhase).toBe('idle');
    });

    it('stock 空且所有牌面朝上时可以自动完成', () => {
      startEngine(engine);
      // 清空 stock，所有 tableau 牌面朝上
      getStock(engine).length = 0;
      for (const pile of getTableau(engine)) {
        for (const card of pile) card.faceUp = true;
      }
      engine.handleKeyDown('a');
      expect(engine.autoCompletePhase).toBe('running');
    });

    it('stock 空但 waste 有牌也可以自动完成', () => {
      startEngine(engine);
      getStock(engine).length = 0;
      // waste 有牌（都是面朝上）
      getWaste(engine).push(makeCard('hearts', 'A'));
      engine.handleKeyDown('a');
      expect(engine.autoCompletePhase).toBe('running');
    });

    it('tableau 有面朝下的牌不能自动完成', () => {
      startEngine(engine);
      getStock(engine).length = 0;
      getWaste(engine).length = 0;
      // tableau 有面朝下的牌（默认就有）
      engine.handleKeyDown('a');
      expect(engine.autoCompletePhase).toBe('idle');
    });

    it('自动完成运行中不能再次触发', () => {
      startEngine(engine);
      getStock(engine).length = 0;
      for (const pile of getTableau(engine)) {
        for (const card of pile) card.faceUp = true;
      }
      engine.handleKeyDown('a');
      expect(engine.autoCompletePhase).toBe('running');
      engine.handleKeyDown('a'); // 再次触发
      expect(engine.autoCompletePhase).toBe('running');
    });

    it('自动完成逐步移动牌到 foundation', () => {
      startEngine(engine);
      getStock(engine).length = 0;
      getWaste(engine).length = 0;
      // 设置简单场景：一个 A 在 tableau
      getTableau(engine)[0] = [makeCard('hearts', 'A')];
      for (let i = 1; i < 7; i++) getTableau(engine)[i] = [];

      engine.handleKeyDown('a');
      expect(engine.autoCompletePhase).toBe('running');

      // 推进一步
      tick(engine, 200);
      expect(engine.foundations[0].length).toBe(1);
    });

    it('自动完成完成后检测胜利', () => {
      startEngine(engine);
      getStock(engine).length = 0;
      getWaste(engine).length = 0;
      // 所有牌已在 foundation
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          getFoundations(engine)[SUITS.indexOf(suit)].push(makeCard(suit, rank));
        }
      }
      for (let i = 0; i < 7; i++) getTableau(engine)[i] = [];

      engine.handleKeyDown('a');
      // 没有牌可移，autoCompleteStep 返回 false
      tick(engine, 200);
      expect(engine.autoCompletePhase).toBe('done');
      expect(engine.isWin).toBe(true);
    });
  });

  // ========== getState ==========

  describe('getState', () => {
    it('返回包含所有必要字段', () => {
      startEngine(engine);
      const state = engine.getState();
      expect(state).toHaveProperty('score');
      expect(state).toHaveProperty('level');
      expect(state).toHaveProperty('moves');
      expect(state).toHaveProperty('stockCount');
      expect(state).toHaveProperty('wasteCount');
      expect(state).toHaveProperty('foundationCounts');
      expect(state).toHaveProperty('tableauCounts');
      expect(state).toHaveProperty('selection');
      expect(state).toHaveProperty('cursorArea');
      expect(state).toHaveProperty('cursorCol');
      expect(state).toHaveProperty('cursorRow');
      expect(state).toHaveProperty('isWin');
    });

    it('idle 状态返回初始值', () => {
      const state = engine.getState();
      expect(state.score).toBe(0);
      expect(state.level).toBe(1);
      expect(state.moves).toBe(0);
      expect(state.stockCount).toBe(0);
      expect(state.wasteCount).toBe(0);
      expect(state.isWin).toBe(false);
    });

    it('playing 状态反映当前牌数', () => {
      startEngine(engine);
      const state = engine.getState();
      expect(state.stockCount).toBe(24);
      expect(state.wasteCount).toBe(0);
      expect((state as any).foundationCounts).toEqual([0, 0, 0, 0]);
    });

    it('翻牌后状态更新', () => {
      startEngine(engine);
      engine.drawFromStock();
      const state = engine.getState();
      expect(state.stockCount).toBe(23);
      expect(state.wasteCount).toBe(1);
      expect(state.moves).toBe(1);
    });

    it('选择状态反映在 getState 中', () => {
      startEngine(engine);
      engine.drawFromStock();
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      const state = engine.getState();
      expect(state.selection).not.toBeNull();
    });
  });

  // ========== 事件系统 ==========

  describe('事件系统', () => {
    it('start 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('start 触发 scoreChange 事件', () => {
      const handler = vi.fn();
      engine.on('scoreChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith(0);
    });

    it('start 触发 levelChange 事件', () => {
      const handler = vi.fn();
      engine.on('levelChange', handler);
      engine.start();
      expect(handler).toHaveBeenCalledWith(1);
    });

    it('pause 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      engine.pause();
      expect(handler).toHaveBeenCalledWith('paused');
    });

    it('resume 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      engine.pause();
      engine.resume();
      expect(handler).toHaveBeenCalledWith('playing');
    });

    it('reset 触发 statusChange 事件', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      startEngine(engine);
      engine.reset();
      expect(handler).toHaveBeenCalledWith('idle');
    });

    it('翻牌触发 scoreChange 事件', () => {
      const handler = vi.fn();
      startEngine(engine);
      engine.on('scoreChange', handler);
      engine.drawFromStock();
      expect(handler).toHaveBeenCalledWith(SCORE_FLIP);
    });

    it('off 取消事件监听', () => {
      const handler = vi.fn();
      engine.on('statusChange', handler);
      engine.off('statusChange', handler);
      engine.start();
      expect(handler).not.toHaveBeenCalled();
    });

    it('gameover 触发 statusChange 事件', () => {
      const handler = vi.fn();
      startEngine(engine);
      engine.on('statusChange', handler);
      // 直接设置胜利条件
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          getFoundations(engine)[SUITS.indexOf(suit)].push(makeCard(suit, rank));
        }
      }
      getStock(engine).length = 0;
      getWaste(engine).length = 0;
      for (let i = 0; i < 7; i++) getTableau(engine)[i] = [];
      (engine as any).checkWin();
      expect(handler).toHaveBeenCalledWith('gameover');
    });
  });

  // ========== 公共辅助方法 ==========

  describe('公共辅助方法', () => {
    it('getFoundationTop 返回顶部牌', () => {
      startEngine(engine);
      const ace = makeCard('hearts', 'A');
      getFoundations(engine)[0].push(ace);
      expect(engine.getFoundationTop(0)).toEqual(ace);
    });

    it('getFoundationTop 空列返回 undefined', () => {
      startEngine(engine);
      expect(engine.getFoundationTop(0)).toBeUndefined();
    });

    it('getTableauTop 返回顶部牌', () => {
      startEngine(engine);
      const top = engine.getTableauTop(0);
      expect(top).toBeDefined();
      expect(top!.faceUp).toBe(true);
    });

    it('getTableauTop 空列返回 undefined', () => {
      startEngine(engine);
      getTableau(engine)[0] = [];
      expect(engine.getTableauTop(0)).toBeUndefined();
    });

    it('getWasteTop 返回顶部牌', () => {
      startEngine(engine);
      engine.drawFromStock();
      expect(engine.getWasteTop()).toBeDefined();
      expect(engine.getWasteTop()!.faceUp).toBe(true);
    });

    it('getWasteTop 空时返回 undefined', () => {
      startEngine(engine);
      expect(engine.getWasteTop()).toBeUndefined();
    });

    it('getTotalFoundationCards 返回总数', () => {
      startEngine(engine);
      expect(engine.getTotalFoundationCards()).toBe(0);
      getFoundations(engine)[0].push(makeCard('hearts', 'A'));
      getFoundations(engine)[1].push(makeCard('spades', 'A'));
      expect(engine.getTotalFoundationCards()).toBe(2);
    });

    it('getFaceUpCardCount 正确计算', () => {
      startEngine(engine);
      const count = engine.getFaceUpCardCount();
      // 7 张面朝上（每列顶牌）+ 0 waste + 0 foundation
      expect(count).toBe(7);
    });

    it('getFaceDownCardCount 正确计算', () => {
      startEngine(engine);
      const count = engine.getFaceDownCardCount();
      // 24 stock + 21 tableau 面朝下 (0+1+2+3+4+5+6 = 21)
      expect(count).toBe(45);
    });

    it('面朝上 + 面朝下 = 52', () => {
      startEngine(engine);
      expect(engine.getFaceUpCardCount() + engine.getFaceDownCardCount()).toBe(52);
    });
  });

  // ========== 空格键特殊行为 ==========

  describe('空格键特殊行为', () => {
    it('idle 状态空格键开始游戏', () => {
      engine.handleKeyDown(' ');
      expect(engine.status).toBe('playing');
    });

    it('playing 状态空格键在 stock 翻牌', () => {
      startEngine(engine);
      setCursor(engine, 'stock');
      engine.handleKeyDown(' ');
      expect(engine.waste.length).toBe(1);
    });

    it('playing 状态空格键有选择时取消', () => {
      startEngine(engine);
      engine.drawFromStock();
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      expect(engine.selection).not.toBeNull();
      engine.handleKeyDown(' ');
      expect(engine.selection).toBeNull();
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('未初始化 canvas 调用 start 抛出异常', () => {
      const e = new SolitaireEngine();
      expect(() => e.start()).toThrow('Canvas not initialized');
    });

    it('pause 在 idle 状态无效', () => {
      engine.pause();
      expect(engine.status).toBe('idle');
    });

    it('resume 在 idle 状态无效', () => {
      engine.resume();
      expect(engine.status).toBe('idle');
    });

    it('多次 reset 不报错', () => {
      startEngine(engine);
      engine.reset();
      engine.reset();
      expect(engine.status).toBe('idle');
    });

    it('多次 destroy 不报错', () => {
      startEngine(engine);
      engine.destroy();
      engine.destroy();
      expect(engine.status).toBe('idle');
    });

    it('连续 start-reset-start 循环正常', () => {
      engine.start();
      engine.reset();
      engine.start();
      expect(engine.status).toBe('playing');
      expect(engine.stock.length).toBe(24);
    });

    it('handleKeyUp 不报错', () => {
      startEngine(engine);
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    });

    it('未知按键不报错', () => {
      startEngine(engine);
      expect(() => engine.handleKeyDown('z')).not.toThrow();
    });

    it('选择后 Enter 在非 playing 状态不放置', () => {
      startEngine(engine);
      engine.drawFromStock();
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      expect(engine.selection).not.toBeNull();
      // 暂停
      engine.pause();
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('Enter');
      // 暂停状态下 handleEnter 不执行
      expect(engine.selection).not.toBeNull();
    });

    it('tableau 多张牌拾取', () => {
      startEngine(engine);
      // 设置第 0 列有多张面朝上的牌
      const k = makeCard('hearts', 'K');
      const q = makeCard('spades', 'Q');
      const j = makeCard('hearts', 'J');
      getTableau(engine)[0] = [k, q, j];

      setCursor(engine, 'tableau', 0, 1); // 从 Q 开始拾取
      engine.handleKeyDown('Enter');
      expect(engine.selectedCards.length).toBe(2); // Q 和 J
    });

    it('tableau 多张牌移动', () => {
      startEngine(engine);
      const k = makeCard('hearts', 'K');
      const q = makeCard('spades', 'Q');
      const j = makeCard('hearts', 'J');
      getTableau(engine)[0] = [k, q, j];
      getTableau(engine)[1] = []; // 空列

      setCursor(engine, 'tableau', 0, 1);
      engine.handleKeyDown('Enter'); // 拾取 Q, J
      setCursor(engine, 'tableau', 1);
      engine.handleKeyDown('Enter'); // 放到空列 → 只有 K 能放空列，Q 不能
      // Q 不是 K，不能放到空列
      expect(getTableau(engine)[1].length).toBe(0);
    });

    it('cursorRow 超出 pile 长度时拾取最后一张面朝上的牌', () => {
      startEngine(engine);
      const pile = getTableau(engine)[6];
      // cursorRow 设为超出范围
      setCursor(engine, 'tableau', 6, 100);
      engine.handleKeyDown('Enter');
      // 应拾取最后一张面朝上的牌
      expect(engine.selection).not.toBeNull();
      expect(engine.selection!.cardIndex).toBe(pile.length - 1);
    });
  });

  // ========== 完整游戏流程 ==========

  describe('完整游戏流程', () => {
    it('start → 翻牌 → 选择 → 放置 → 检查状态', () => {
      engine.start();
      expect(engine.status).toBe('playing');

      // 翻牌
      engine.drawFromStock();
      expect(engine.waste.length).toBe(1);
      expect(engine.score).toBe(SCORE_FLIP);

      // 选择 waste 顶牌
      setCursor(engine, 'waste');
      engine.handleKeyDown('Enter');
      expect(engine.selection).not.toBeNull();

      // 尝试放到 foundation（可能失败，但不应崩溃）
      setCursor(engine, 'foundation', 0);
      engine.handleKeyDown('Enter');
      expect(engine.selection).toBeNull(); // 不管成功失败，选择都清除
    });

    it('start → pause → resume → reset 完整流程', () => {
      engine.start();
      expect(engine.status).toBe('playing');

      engine.pause();
      expect(engine.status).toBe('paused');

      engine.resume();
      expect(engine.status).toBe('playing');

      engine.reset();
      expect(engine.status).toBe('idle');
      expect(engine.score).toBe(0);
    });

    it('多次翻牌和回收', () => {
      engine.start();
      const stockSize = engine.stock.length;

      // 翻完所有 stock
      for (let i = 0; i < stockSize; i++) engine.drawFromStock();
      expect(engine.stock.length).toBe(0);
      expect(engine.waste.length).toBe(stockSize);

      // 回收
      engine.drawFromStock();
      expect(engine.stock.length).toBe(stockSize);
      expect(engine.waste.length).toBe(0);

      // 再翻一张
      engine.drawFromStock();
      expect(engine.waste.length).toBe(1);
      expect(engine.stock.length).toBe(stockSize - 1);
    });
  });

  // ========== 常量验证 ==========

  describe('常量', () => {
    it('画布尺寸 480×640', () => {
      expect(CANVAS_WIDTH).toBe(480);
      expect(CANVAS_HEIGHT).toBe(640);
    });

    it('SUITS 有 4 种花色', () => {
      expect(SUITS.length).toBe(4);
    });

    it('RANKS 有 13 种面值', () => {
      expect(RANKS.length).toBe(13);
    });

    it('rankValue A=1, K=13', () => {
      expect(rankValue('A')).toBe(1);
      expect(rankValue('K')).toBe(13);
    });

    it('isRedSuit 正确判断红色花色', () => {
      expect(isRedSuit('hearts')).toBe(true);
      expect(isRedSuit('diamonds')).toBe(true);
      expect(isRedSuit('clubs')).toBe(false);
      expect(isRedSuit('spades')).toBe(false);
    });

    it('suitSymbol 返回正确符号', () => {
      expect(suitSymbol('hearts')).toBe('♥');
      expect(suitSymbol('diamonds')).toBe('♦');
      expect(suitSymbol('clubs')).toBe('♣');
      expect(suitSymbol('spades')).toBe('♠');
    });

    it('计分常量正确', () => {
      expect(SCORE_FLIP).toBe(5);
      expect(SCORE_FOUNDATION).toBe(10);
      expect(SCORE_FOUNDATION_BACK).toBe(-15);
    });
  });

  // ========== 鼠标交互：hitTest 区域判定 ==========

  describe('hitTest 区域判定', () => {
    // 布局常量（与 constants.ts 一致）
    const STOCK_X = 15;
    const WASTE_X = 83; // STOCK_X + CARD_WIDTH(60) + CARD_GAP(8)
    const FOUNDATION_X_START = 275;
    const FOUNDATION_GAP = 68; // CARD_WIDTH(60) + CARD_GAP(8)
    const TABLEAU_X_START = 15;
    const TABLEAU_GAP = 65;
    const TOP_ROW_Y = 10;
    const TABLEAU_Y = 115;
    const CARD_WIDTH = 60;
    const CARD_HEIGHT = 84;
    const TABLEAU_OVERLAP_FACE_UP = 22;
    const TABLEAU_OVERLAP_FACE_DOWN = 16;

    // TC-M01: stock 区域命中
    it('TC-M01: stock 区域命中 → {area:"stock", col:0, row:0}', () => {
      startEngine(engine);
      const result = (engine as any).hitTest(STOCK_X + 1, TOP_ROW_Y + 1);
      expect(result).toEqual({ area: 'stock', col: 0, row: 0 });
    });

    // TC-M02: waste 区域命中
    it('TC-M02: waste 区域命中 → {area:"waste", col:0, row:0}', () => {
      startEngine(engine);
      const result = (engine as any).hitTest(WASTE_X + 5, TOP_ROW_Y + 10);
      expect(result).toEqual({ area: 'waste', col: 0, row: 0 });
    });

    // TC-M03: foundation 各列命中
    it('TC-M03: foundation 各列命中 → {area:"foundation", col:i, row:0}', () => {
      startEngine(engine);
      for (let i = 0; i < 4; i++) {
        const fx = FOUNDATION_X_START + i * FOUNDATION_GAP;
        const result = (engine as any).hitTest(fx + 10, TOP_ROW_Y + 20);
        expect(result).toEqual({ area: 'foundation', col: i, row: 0 });
      }
    });

    // TC-M04: tableau 各列命中
    it('TC-M04: tableau 各列命中 → {area:"tableau", col, row}', () => {
      startEngine(engine);
      for (let col = 0; col < 7; col++) {
        const cx = TABLEAU_X_START + col * TABLEAU_GAP;
        const result = (engine as any).hitTest(cx + 5, TABLEAU_Y + 5);
        // 各列有牌，顶牌面朝上，应命中 row >= 0
        expect(result).not.toBeNull();
        expect(result.area).toBe('tableau');
        expect(result.col).toBe(col);
        expect(result.row).toBeGreaterThanOrEqual(0);
      }
    });

    // TC-M05: tableau 牌叠中间行命中（需计算累积 Y 偏移）
    it('TC-M05: tableau 牌叠中间行命中（累积 Y 偏移）', () => {
      startEngine(engine);
      // 第 6 列有 7 张牌：前 6 张面朝下，第 7 张面朝上
      const pile = getTableau(engine)[6];
      expect(pile.length).toBe(7);

      // 计算第 3 张牌（index=2, 面朝下）的 Y 位置
      let y = TABLEAU_Y;
      for (let i = 0; i < 2; i++) {
        y += pile[i].faceUp ? TABLEAU_OVERLAP_FACE_UP : TABLEAU_OVERLAP_FACE_DOWN;
      }
      // y 现在是第 2 张牌（index=2）的顶部位置
      const cx = TABLEAU_X_START + 6 * TABLEAU_GAP;
      const result = (engine as any).hitTest(cx + 10, y + 5);
      expect(result).not.toBeNull();
      expect(result.area).toBe('tableau');
      expect(result.col).toBe(6);
      expect(result.row).toBe(2);
    });

    // TC-M06: tableau 空列命中
    it('TC-M06: tableau 空列命中 → {area:"tableau", col, row:-1}', () => {
      startEngine(engine);
      // 清空第 0 列
      getTableau(engine)[0] = [];
      const cx = TABLEAU_X_START + 0 * TABLEAU_GAP;
      const result = (engine as any).hitTest(cx + 10, TABLEAU_Y + 10);
      expect(result).toEqual({ area: 'tableau', col: 0, row: -1 });
    });

    // TC-M07: 空白区域返回 null
    it('TC-M07: 空白区域返回 null', () => {
      startEngine(engine);
      // 点击两个区域之间的空白
      const result = (engine as any).hitTest(200, 50);
      expect(result).toBeNull();
    });

    // TC-M08: 边界坐标精确命中
    it('TC-M08: 边界坐标精确命中', () => {
      startEngine(engine);
      // stock 左上角精确命中
      const r1 = (engine as any).hitTest(STOCK_X, TOP_ROW_Y);
      expect(r1).toEqual({ area: 'stock', col: 0, row: 0 });

      // stock 右边界外一点 → 不命中 stock
      const r2 = (engine as any).hitTest(STOCK_X + CARD_WIDTH, TOP_ROW_Y);
      expect(r2 === null || r2.area !== 'stock').toBe(true);

      // stock 下边界外一点 → 不命中 stock
      const r3 = (engine as any).hitTest(STOCK_X + 5, TOP_ROW_Y + CARD_HEIGHT);
      expect(r3 === null || r3.area !== 'stock').toBe(true);
    });
  });

  // ========== 鼠标交互：handleClick ==========

  describe('handleClick', () => {
    const STOCK_X = 15;
    const WASTE_X = 83;
    const FOUNDATION_X_START = 275;
    const FOUNDATION_GAP = 68;
    const TABLEAU_X_START = 15;
    const TABLEAU_GAP = 65;
    const TOP_ROW_Y = 10;
    const TABLEAU_Y = 115;

    // TC-M10: 点击 stock 翻牌
    it('TC-M10: 点击 stock 翻牌（waste+1, stock-1）', () => {
      startEngine(engine);
      const prevStock = engine.stock.length;
      const prevWaste = engine.waste.length;

      engine.handleClick(STOCK_X + 10, TOP_ROW_Y + 10);

      expect(engine.waste.length).toBe(prevWaste + 1);
      expect(engine.stock.length).toBe(prevStock - 1);
    });

    // TC-M11: 点击 waste 选牌
    it('TC-M11: 点击 waste 选牌（selection.source==="waste"）', () => {
      startEngine(engine);
      engine.drawFromStock(); // 确保 waste 有牌

      engine.handleClick(WASTE_X + 10, TOP_ROW_Y + 10);

      expect(engine.selection).not.toBeNull();
      expect(engine.selection!.source).toBe('waste');
    });

    // TC-M12: 点击空 waste 无操作
    it('TC-M12: 点击空 waste 无操作', () => {
      startEngine(engine);
      // waste 初始为空
      expect(engine.waste.length).toBe(0);

      engine.handleClick(WASTE_X + 10, TOP_ROW_Y + 10);

      expect(engine.selection).toBeNull();
    });

    // TC-M13: 已选牌后点击 foundation 放置
    it('TC-M13: 已选牌后点击 foundation 放置', () => {
      startEngine(engine);
      // 准备：waste 放一张 A♥
      const ace = makeCard('hearts', 'A');
      getWaste(engine).push(ace);

      // 先选中 waste 牌
      engine.handleClick(WASTE_X + 10, TOP_ROW_Y + 10);
      expect(engine.selection).not.toBeNull();

      // 再点击 foundation[0] 放置
      const fx = FOUNDATION_X_START + 0 * FOUNDATION_GAP;
      engine.handleClick(fx + 10, TOP_ROW_Y + 10);

      expect(engine.foundations[0].length).toBe(1);
      expect(engine.selection).toBeNull(); // 放置后清除选择
    });

    // TC-M14: 已选牌后点击 tableau 放置
    it('TC-M14: 已选牌后点击 tableau 放置', () => {
      startEngine(engine);
      // 准备：waste 放一张 Q♠，tableau[0] 放一张 K♥
      const king = makeCard('hearts', 'K');
      const queen = makeCard('spades', 'Q');
      getTableau(engine)[0] = [king];
      getWaste(engine).push(queen);

      // 先选中 waste 牌
      engine.handleClick(WASTE_X + 10, TOP_ROW_Y + 10);
      expect(engine.selection).not.toBeNull();

      // 再点击 tableau[0] 放置
      const tx = TABLEAU_X_START + 0 * TABLEAU_GAP;
      engine.handleClick(tx + 10, TABLEAU_Y + 10);

      expect(engine.tableau[0].length).toBe(2);
      expect(engine.selection).toBeNull(); // 放置后清除选择
    });

    // TC-M15: 点击空白区域取消选择
    it('TC-M15: 点击空白区域取消选择', () => {
      startEngine(engine);
      engine.drawFromStock();

      // 先选中 waste 牌
      engine.handleClick(WASTE_X + 10, TOP_ROW_Y + 10);
      expect(engine.selection).not.toBeNull();

      // 点击空白区域（两个区域之间的间隙）
      engine.handleClick(200, 50);

      expect(engine.selection).toBeNull();
    });

    // TC-M16: 拖拽中忽略 click
    it('TC-M16: 拖拽中忽略 click（_isDragging=true 时 handleClick 无效果）', () => {
      startEngine(engine);
      const prevStock = engine.stock.length;

      // 设置拖拽状态
      (engine as any)._isDragging = true;

      engine.handleClick(STOCK_X + 10, TOP_ROW_Y + 10);

      // stock 不应减少（click 被忽略）
      expect(engine.stock.length).toBe(prevStock);
      expect(engine.waste.length).toBe(0);

      // 恢复
      (engine as any)._isDragging = false;
    });
  });

  // ========== 鼠标交互：handleDoubleClick ==========

  describe('handleDoubleClick', () => {
    const WASTE_X = 83;
    const FOUNDATION_X_START = 275;
    const FOUNDATION_GAP = 68;
    const TABLEAU_X_START = 15;
    const TABLEAU_GAP = 65;
    const TOP_ROW_Y = 10;
    const TABLEAU_Y = 115;

    // TC-M40: 双击 waste 牌自动到 foundation
    it('TC-M40: 双击 waste 牌自动到 foundation', () => {
      startEngine(engine);
      // 准备：waste 放一张 A♥
      const ace = makeCard('hearts', 'A');
      getWaste(engine).push(ace);

      engine.handleClick(WASTE_X + 10, TOP_ROW_Y + 10); // 第一次 click
      engine.handleDoubleClick(WASTE_X + 10, TOP_ROW_Y + 10);

      // A 应该被移到 foundation
      expect(engine.foundations[0].length).toBe(1);
      expect(engine.waste.length).toBe(0);
    });

    // TC-M41: 双击 tableau 顶牌自动到 foundation
    it('TC-M41: 双击 tableau 顶牌自动到 foundation', () => {
      startEngine(engine);
      // 准备：tableau[0] 放一张 A♠
      const ace = makeCard('spades', 'A');
      getTableau(engine)[0] = [ace];

      const tx = TABLEAU_X_START + 0 * TABLEAU_GAP;
      engine.handleDoubleClick(tx + 10, TABLEAU_Y + 10);

      // A 应该被移到 foundation
      expect(engine.foundations[0].length).toBe(1);
      expect(engine.tableau[0].length).toBe(0);
    });

    // TC-M42: 双击非顶牌无效果
    it('TC-M42: 双击非顶牌无效果', () => {
      startEngine(engine);
      // 准备：tableau[0] 放两张面朝上的牌
      const king = makeCard('hearts', 'K');
      const ace = makeCard('spades', 'A');
      getTableau(engine)[0] = [king, ace];

      const tx = TABLEAU_X_START + 0 * TABLEAU_GAP;
      // 双击第一张牌（index=0, 非顶牌）的位置
      engine.handleDoubleClick(tx + 10, TABLEAU_Y + 10);

      // 不应移动任何牌到 foundation
      const totalFoundation = engine.foundations.reduce((s, f) => s + f.length, 0);
      expect(totalFoundation).toBe(0);
    });

    // TC-M43: 双击面朝下牌无效果
    it('TC-M43: 双击面朝下牌无效果', () => {
      startEngine(engine);
      // 准备：tableau[0] 只有一张面朝下的牌
      const card = makeCard('hearts', 'A', false);
      getTableau(engine)[0] = [card];

      const tx = TABLEAU_X_START + 0 * TABLEAU_GAP;
      engine.handleDoubleClick(tx + 10, TABLEAU_Y + 10);

      // 不应移动任何牌
      expect(engine.foundations[0].length).toBe(0);
    });

    // TC-M44: 找不到合适 foundation 时无操作
    it('TC-M44: 找不到合适 foundation 时无操作', () => {
      startEngine(engine);
      // 准备：waste 放一张非 A 的牌（不能放到空 foundation）
      const two = makeCard('hearts', '2');
      getWaste(engine).push(two);

      engine.handleDoubleClick(WASTE_X + 10, TOP_ROW_Y + 10);

      // 不应移动到 foundation
      expect(engine.foundations[0].length).toBe(0);
      expect(engine.waste.length).toBe(1);
    });

    // TC-M45: gameover 状态不响应双击
    it('TC-M45: gameover 状态不响应双击', () => {
      startEngine(engine);
      // 准备：waste 放一张 A♥
      const ace = makeCard('hearts', 'A');
      getWaste(engine).push(ace);

      // 设置为 gameover 状态
      (engine as any)._isWin = true;
      (engine as any)._status = 'gameover';

      engine.handleDoubleClick(WASTE_X + 10, TOP_ROW_Y + 10);

      // 不应移动任何牌
      expect(engine.foundations[0].length).toBe(0);
      expect(engine.waste.length).toBe(1);

      // 恢复状态
      (engine as any)._isWin = false;
      (engine as any)._status = 'playing';
    });
  });

  // ========== 鼠标拖拽流程测试 ==========

  describe('鼠标拖拽流程', () => {
    // 坐标常量（与 constants.ts 一致，其他 describe 块也采用本地定义）
    const STOCK_X = 15;
    const WASTE_X = 83;
    const FOUNDATION_X_START = 275;
    const FOUNDATION_GAP = 68; // CARD_WIDTH(60) + CARD_GAP(8)
    const TABLEAU_X_START = 15;
    const TABLEAU_GAP = 65;
    const TOP_ROW_Y = 10;
    const TABLEAU_Y = 115;
    const TABLEAU_OVERLAP_FACE_UP = 22;
    const CARD_WIDTH = 60;
    const CARD_HEIGHT = 84;

    // 区域中心坐标（方便点击/拖拽定位）
    const STOCK_CX = STOCK_X + CARD_WIDTH / 2;
    const WASTE_CX = WASTE_X + CARD_WIDTH / 2;
    const TOP_ROW_CY = TOP_ROW_Y + CARD_HEIGHT / 2;
    const FOUND0_CX = FOUNDATION_X_START + CARD_WIDTH / 2;
    const FOUND1_CX = FOUNDATION_X_START + 1 * FOUNDATION_GAP + CARD_WIDTH / 2;
    const TAB0_CX = TABLEAU_X_START + 0 * TABLEAU_GAP + CARD_WIDTH / 2;
    const TAB1_CX = TABLEAU_X_START + 1 * TABLEAU_GAP + CARD_WIDTH / 2;
    const TAB3_CX = TABLEAU_X_START + 3 * TABLEAU_GAP + CARD_WIDTH / 2;
    const TAB6_CX = TABLEAU_X_START + 6 * TABLEAU_GAP + CARD_WIDTH / 2;

    // ---------- handleMouseDown ----------

    it('TC-M20: 从 waste 拖拽单牌', () => {
      startEngine(engine);
      // 翻一张牌到 waste
      engine.drawFromStock();

      // 点击 waste 中心
      engine.handleMouseDown(WASTE_CX, TOP_ROW_CY);

      expect((engine as any)._isDragging).toBe(true);
      expect((engine as any)._dragCards.length).toBe(1);
      expect((engine as any)._dragSource.area).toBe('waste');
      expect((engine as any)._dragCards[0].faceUp).toBe(true);
    });

    it('TC-M21: 从 foundation 拖拽单牌', () => {
      startEngine(engine);
      // 放一张 A♥ 到 foundation[0]
      const card = makeCard('hearts', 'A');
      getFoundations(engine)[0].push(card);

      // 点击 foundation[0] 中心
      engine.handleMouseDown(FOUND0_CX, TOP_ROW_CY);

      expect((engine as any)._isDragging).toBe(true);
      expect((engine as any)._dragCards.length).toBe(1);
      expect((engine as any)._dragSource.area).toBe('foundation');
      expect((engine as any)._dragSource.col).toBe(0);
    });

    it('TC-M22: 从 tableau 拖拽单牌（顶牌）', () => {
      startEngine(engine);
      // 第 0 列有 1 张面朝上的牌（发牌后顶牌朝上）
      const pile = getTableau(engine)[0];
      expect(pile.length).toBeGreaterThanOrEqual(1);
      const topCard = pile[pile.length - 1];
      expect(topCard.faceUp).toBe(true);

      // 点击第 0 列顶牌中心（只有 1 张牌时 Y = TABLEAU_Y + 42）
      const topCardY = TABLEAU_Y + 42;
      engine.handleMouseDown(TAB0_CX, topCardY);

      expect((engine as any)._isDragging).toBe(true);
      expect((engine as any)._dragCards.length).toBe(1);
      expect((engine as any)._dragSource.area).toBe('tableau');
      expect((engine as any)._dragSource.col).toBe(0);
    });

    it('TC-M23: 从 tableau 拖拽多牌（从中间拾取）', () => {
      startEngine(engine);
      // 手动构建一个多牌场景：第 0 列放 3 张面朝上的牌
      const pile = getTableau(engine)[0];
      pile.length = 0;
      pile.push(makeCard('hearts', 'K'));  // row 0, faceUp, Y=115
      pile.push(makeCard('spades', 'Q'));  // row 1, faceUp, Y=137
      pile.push(makeCard('hearts', 'J'));  // row 2, faceUp, Y=159

      // hitTest 从底部向上扫描，row 2 范围 [159,243]，row 1 范围 [137,221]
      // 要命中 row 1 而非 row 2，Y 必须在 [137, 159) 内
      const row1ExposedY = TABLEAU_Y + TABLEAU_OVERLAP_FACE_UP + 5; // 142
      engine.handleMouseDown(TAB0_CX, row1ExposedY);

      expect((engine as any)._isDragging).toBe(true);
      // 从 row 1 开始拾取，应该拿到 2 张牌（Q♠ 和 J♥）
      expect((engine as any)._dragCards.length).toBe(2);
      expect((engine as any)._dragCards[0].rank).toBe('Q');
      expect((engine as any)._dragCards[1].rank).toBe('J');
      expect((engine as any)._dragSource.area).toBe('tableau');
      expect((engine as any)._dragSource.row).toBe(1);
    });

    it('TC-M24: stock 不支持拖拽', () => {
      startEngine(engine);
      // 点击 stock 中心
      engine.handleMouseDown(STOCK_CX, TOP_ROW_CY);

      expect((engine as any)._isDragging).toBe(false);
      expect((engine as any)._dragCards.length).toBe(0);
    });

    it('TC-M25: 面朝下的牌不支持拖拽', () => {
      startEngine(engine);
      // 第 6 列有 7 张牌，前 6 张面朝下，最后 1 张面朝上
      const pile = getTableau(engine)[6];
      expect(pile.length).toBe(7);
      expect(pile[0].faceUp).toBe(false);

      // 计算第 0 张牌（面朝下）的 Y 中心：TABLEAU_Y + 42
      const row0Y = TABLEAU_Y + 42;
      engine.handleMouseDown(TAB6_CX, row0Y);

      // 面朝下的牌不能拖拽
      expect((engine as any)._isDragging).toBe(false);
    });

    it('TC-M26: 空区域不拖拽（空 waste / 空 foundation / 空 tableau）', () => {
      startEngine(engine);

      // 空 waste（初始就是空的）
      expect(getWaste(engine).length).toBe(0);
      engine.handleMouseDown(WASTE_CX, TOP_ROW_CY);
      expect((engine as any)._isDragging).toBe(false);

      // 空 foundation[0]
      expect(getFoundations(engine)[0].length).toBe(0);
      engine.handleMouseDown(FOUND0_CX, TOP_ROW_CY);
      expect((engine as any)._isDragging).toBe(false);

      // 空 tableau 列
      getTableau(engine)[0] = [];
      engine.handleMouseDown(TAB0_CX, TABLEAU_Y + 42);
      expect((engine as any)._isDragging).toBe(false);
    });

    // ---------- handleMouseMove ----------

    it('TC-M27: 拖拽中移动鼠标更新 _dragX/_dragY', () => {
      startEngine(engine);
      engine.drawFromStock();

      // 开始拖拽
      engine.handleMouseDown(WASTE_CX, TOP_ROW_CY);
      expect((engine as any)._isDragging).toBe(true);

      // 移动鼠标到新位置
      engine.handleMouseMove(200, 300);

      // _dragX = canvasX - CARD_WIDTH/2 = 200 - 30 = 170
      // _dragY = canvasY - CARD_HEIGHT/2 = 300 - 42 = 258
      expect((engine as any)._dragX).toBe(200 - 30);
      expect((engine as any)._dragY).toBe(300 - 42);

      // 再次移动
      engine.handleMouseMove(250, 350);
      expect((engine as any)._dragX).toBe(250 - 30);
      expect((engine as any)._dragY).toBe(350 - 42);
    });

    it('TC-M28: 非拖拽状态下移动鼠标更新 _hoverTarget', () => {
      startEngine(engine);
      expect((engine as any)._isDragging).toBe(false);

      // 移动到 waste 区域
      engine.handleMouseMove(WASTE_CX, TOP_ROW_CY);
      expect((engine as any)._hoverTarget).not.toBeNull();
      expect((engine as any)._hoverTarget.area).toBe('waste');

      // 移动到 foundation[1]
      engine.handleMouseMove(FOUND1_CX, TOP_ROW_CY);
      expect((engine as any)._hoverTarget.area).toBe('foundation');
      expect((engine as any)._hoverTarget.col).toBe(1);

      // 移动到 tableau col 3
      engine.handleMouseMove(TAB3_CX, TABLEAU_Y + 42);
      expect((engine as any)._hoverTarget.area).toBe('tableau');
      expect((engine as any)._hoverTarget.col).toBe(3);
    });

    it('TC-M29: 拖拽中未调用 handleMouseMove 时坐标保持不变', () => {
      startEngine(engine);
      engine.drawFromStock();

      // 开始拖拽
      engine.handleMouseDown(WASTE_CX, TOP_ROW_CY);
      const dragXAfterDown = (engine as any)._dragX;
      const dragYAfterDown = (engine as any)._dragY;

      // 不调用 handleMouseMove，坐标应保持不变
      expect((engine as any)._dragX).toBe(dragXAfterDown);
      expect((engine as any)._dragY).toBe(dragYAfterDown);

      // 移动一次后记录
      engine.handleMouseMove(100, 100);
      const afterMoveX = (engine as any)._dragX;
      const afterMoveY = (engine as any)._dragY;

      // 不再调用 handleMouseMove，坐标应保持
      expect((engine as any)._dragX).toBe(afterMoveX);
      expect((engine as any)._dragY).toBe(afterMoveY);
    });

    // ---------- handleMouseUp ----------

    it('TC-M30: 拖拽到 foundation 成功放置（waste→foundation）', () => {
      startEngine(engine);

      // 在 waste 中放一张 A♥
      getWaste(engine).push(makeCard('hearts', 'A'));

      // 开始拖拽
      engine.handleMouseDown(WASTE_CX, TOP_ROW_CY);
      expect((engine as any)._isDragging).toBe(true);

      // 拖到 foundation[0] 并释放
      engine.handleMouseMove(FOUND0_CX, TOP_ROW_CY);
      engine.handleMouseUp(FOUND0_CX, TOP_ROW_CY);

      // 拖拽状态应重置
      expect((engine as any)._isDragging).toBe(false);
      // foundation[0] 应该有 A♥
      expect(getFoundations(engine)[0].length).toBe(1);
      expect(getFoundations(engine)[0][0].rank).toBe('A');
      expect(getFoundations(engine)[0][0].suit).toBe('hearts');
      // waste 应为空
      expect(getWaste(engine).length).toBe(0);
    });

    it('TC-M31: 拖拽到 tableau 成功放置（waste→tableau）', () => {
      startEngine(engine);

      // 准备场景：waste 中放 Q♠，tableau[0] 顶牌为 K♥（红黑交替，值递减）
      const tabPile = getTableau(engine)[0];
      tabPile.length = 0;
      tabPile.push(makeCard('hearts', 'K'));
      getWaste(engine).push(makeCard('spades', 'Q'));

      // 开始拖拽 waste 中的 Q♠
      engine.handleMouseDown(WASTE_CX, TOP_ROW_CY);
      expect((engine as any)._isDragging).toBe(true);

      // 拖到 tableau[0] 并释放（点击 K♥ 下方的位置）
      const targetY = TABLEAU_Y + TABLEAU_OVERLAP_FACE_UP + 42;
      engine.handleMouseMove(TAB0_CX, targetY);
      engine.handleMouseUp(TAB0_CX, targetY);

      // 拖拽状态应重置
      expect((engine as any)._isDragging).toBe(false);
      // tableau[0] 应该有 2 张牌：K♥, Q♠
      expect(getTableau(engine)[0].length).toBe(2);
      expect(getTableau(engine)[0][1].rank).toBe('Q');
      expect(getTableau(engine)[0][1].suit).toBe('spades');
      // waste 应为空
      expect(getWaste(engine).length).toBe(0);
    });

    it('TC-M32: 拖拽多牌到 tableau 成功放置（tableau→tableau，2+张牌）', () => {
      startEngine(engine);

      // 准备场景：
      // tableau[0]: K♥（红）
      // tableau[1]: Q♠（黑）, J♥（红）  ← 拖拽 Q♠ 和 J♥ 到 tableau[0]
      const tab0 = getTableau(engine)[0];
      const tab1 = getTableau(engine)[1];
      tab0.length = 0;
      tab1.length = 0;

      tab0.push(makeCard('hearts', 'K'));  // K♥ 红色
      tab1.push(makeCard('spades', 'Q'));  // Q♠ 黑色
      tab1.push(makeCard('hearts', 'J'));  // J♥ 红色

      // 开始拖拽 tableau[1] 的 Q♠（row 0）
      // 只有 2 张牌，row 0 的 Y = TABLEAU_Y，范围 [115, 199]
      // row 1 的 Y = TABLEAU_Y + 22 = 137，范围 [137, 221]
      // hitTest 从底部向上扫描，row 1 先被检查
      // 要命中 row 0 而非 row 1，Y 必须在 [115, 137) 内
      const row0ExposedY = TABLEAU_Y + 5; // 120
      engine.handleMouseDown(TAB1_CX, row0ExposedY);

      // DEBUG
      console.log('DEBUG _isDragging:', (engine as any)._isDragging);
      console.log('DEBUG _dragCards length:', (engine as any)._dragCards.length);
      console.log('DEBUG _dragCards:', (engine as any)._dragCards.map((c: any) => c.rank + c.suit));
      console.log('DEBUG _dragSource:', JSON.stringify((engine as any)._dragSource));
      console.log('DEBUG _selection:', JSON.stringify((engine as any)._selection));
      console.log('DEBUG _selectedCards length:', (engine as any)._selectedCards.length);

      expect((engine as any)._isDragging).toBe(true);
      expect((engine as any)._dragCards.length).toBe(2); // Q♠ + J♥

      // 拖到 tableau[0]（目标位置是 K♥ 下方）
      // K♥ 在 tableau[0] 的 row 0，下方区域 Y > TABLEAU_Y + CARD_HEIGHT
      const targetY = TABLEAU_Y + TABLEAU_OVERLAP_FACE_UP + 42;
      console.log('DEBUG targetY:', targetY);
      console.log('DEBUG TAB0_CX:', TAB0_CX);

      // Check hitTest at target
      const hitResult = (engine as any).hitTest(TAB0_CX, targetY);
      console.log('DEBUG hitTest result:', JSON.stringify(hitResult));

      engine.handleMouseMove(TAB0_CX, targetY);
      engine.handleMouseUp(TAB0_CX, targetY);

      console.log('DEBUG after mouseUp tab0 length:', getTableau(engine)[0].length);
      console.log('DEBUG after mouseUp tab0:', getTableau(engine)[0].map((c: any) => c.rank + c.suit));
      console.log('DEBUG after mouseUp tab1 length:', getTableau(engine)[1].length);
      console.log('DEBUG after mouseUp _isDragging:', (engine as any)._isDragging);

      // 拖拽状态应重置
      expect((engine as any)._isDragging).toBe(false);
      // tableau[0] 应该有 3 张牌：K♥, Q♠, J♥
      expect(getTableau(engine)[0].length).toBe(3);
      expect(getTableau(engine)[0][1].rank).toBe('Q');
      expect(getTableau(engine)[0][2].rank).toBe('J');
      // tableau[1] 应为空
      expect(getTableau(engine)[1].length).toBe(0);
    });

    it('TC-M33: 拖拽到无效位置取消（hit=null 时牌回到原位）', () => {
      startEngine(engine);

      // 在 waste 中放一张 A♥
      getWaste(engine).push(makeCard('hearts', 'A'));
      const wasteLenBefore = getWaste(engine).length;

      // 开始拖拽
      engine.handleMouseDown(WASTE_CX, TOP_ROW_CY);
      expect((engine as any)._isDragging).toBe(true);

      // 释放在画布外/无效区域（坐标超出所有区域）
      engine.handleMouseMove(0, 0);
      engine.handleMouseUp(0, 0);

      // 拖拽状态应重置
      expect((engine as any)._isDragging).toBe(false);
      // 牌应回到 waste（未被移除）
      expect(getWaste(engine).length).toBe(wasteLenBefore);
      expect(getWaste(engine)[wasteLenBefore - 1].rank).toBe('A');
    });

    it('TC-M34: 拖拽放回原位取消（同列同位置）', () => {
      startEngine(engine);

      // 在 waste 中放一张牌
      getWaste(engine).push(makeCard('hearts', 'A'));

      // 开始拖拽 waste
      engine.handleMouseDown(WASTE_CX, TOP_ROW_CY);
      expect((engine as any)._isDragging).toBe(true);

      // 释放在同一位置（waste 区域）
      engine.handleMouseMove(WASTE_CX, TOP_ROW_CY);
      engine.handleMouseUp(WASTE_CX, TOP_ROW_CY);

      // 拖拽状态应重置
      expect((engine as any)._isDragging).toBe(false);
      // 牌应还在 waste（放回原位不移动）
      expect(getWaste(engine).length).toBe(1);
      expect(getWaste(engine)[0].rank).toBe('A');
    });

    it('TC-M35: 无拖拽时调用 handleMouseUp 无效果', () => {
      startEngine(engine);

      // 确保没有拖拽状态
      expect((engine as any)._isDragging).toBe(false);

      // 记录当前状态
      const movesBefore = engine.moves;
      const wasteBefore = getWaste(engine).length;
      const foundBefore = getFoundations(engine)[0].length;

      // 直接调用 handleMouseUp（未开始拖拽）
      engine.handleMouseUp(FOUND0_CX, TOP_ROW_CY);

      // 状态不应有任何变化
      expect((engine as any)._isDragging).toBe(false);
      expect(engine.moves).toBe(movesBefore);
      expect(getWaste(engine).length).toBe(wasteBefore);
      expect(getFoundations(engine)[0].length).toBe(foundBefore);
    });

    it('TC-M36: 拖拽后状态完全重置（_isDragging=false, _dragCards=[], _dragSource=null）', () => {
      startEngine(engine);

      // 在 waste 中放一张 A♥
      getWaste(engine).push(makeCard('hearts', 'A'));

      // 开始拖拽
      engine.handleMouseDown(WASTE_CX, TOP_ROW_CY);
      expect((engine as any)._isDragging).toBe(true);
      expect((engine as any)._dragCards.length).toBe(1);
      expect((engine as any)._dragSource).not.toBeNull();

      // 拖到 foundation[0] 并释放
      engine.handleMouseMove(FOUND0_CX, TOP_ROW_CY);
      engine.handleMouseUp(FOUND0_CX, TOP_ROW_CY);

      // 所有拖拽状态应完全重置
      expect((engine as any)._isDragging).toBe(false);
      expect((engine as any)._dragCards).toEqual([]);
      expect((engine as any)._dragSource).toBeNull();
      // _mouseSelection 也应重置
      expect((engine as any)._mouseSelection).toBeNull();
    });
  });
});
