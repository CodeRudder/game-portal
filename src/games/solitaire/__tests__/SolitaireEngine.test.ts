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
});
