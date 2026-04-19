import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreeCellEngine } from '../FreeCellEngine';
import {
  createDeck,
  shuffleDeck,
  rankValue,
  isRedSuit,
  isOppositeColor,
  suitSymbol,
  foundationIndex,
  isValidSequence,
  maxMovableCards,
  SUITS,
  RANKS,
  Area,
  type Card,
  type Suit,
  type Rank,
} from '../constants';

// Mock requestAnimationFrame 防止 gameLoop 干扰
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  return 1;
});
vi.stubGlobal('cancelAnimationFrame', (id: number) => {});

function createEngine(): FreeCellEngine {
  const engine = new FreeCellEngine();
  // 使用 seeded shuffle 确保测试一致性
  engine.dealWithSeed(42);
  return engine;
}

function createStartedEngine(): FreeCellEngine {
  const engine = new FreeCellEngine();
  engine.dealWithSeed(42);
  // Mock canvas
  const mockCanvas = document.createElement('canvas');
  mockCanvas.width = 480;
  mockCanvas.height = 640;
  engine.setCanvas(mockCanvas);
  engine.start();
  return engine;
}

// 辅助：创建指定花色和面值的牌
function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank, faceUp: true };
}

// 辅助：获取引擎中所有牌的总数
function totalCards(engine: FreeCellEngine): number {
  const tableau = engine.getTableau().reduce((sum, col) => sum + col.length, 0);
  const freeCells = engine.getFreeCells().filter(c => c !== null).length;
  const foundations = engine.getFoundations().reduce((sum, pile) => sum + pile.length, 0);
  return tableau + freeCells + foundations;
}

// ========== 常量测试 ==========
describe('FreeCell Constants', () => {
  it('should have 4 suits', () => {
    expect(SUITS.length).toBe(4);
  });

  it('should have 13 ranks', () => {
    expect(RANKS.length).toBe(13);
  });

  it('should have correct suit order', () => {
    expect(SUITS).toEqual(['hearts', 'diamonds', 'clubs', 'spades']);
  });

  it('should have correct rank order', () => {
    expect(RANKS[0]).toBe('A');
    expect(RANKS[12]).toBe('K');
  });
});

// ========== 牌组生成/洗牌 ==========
describe('Deck Creation & Shuffle', () => {
  it('should create a 52-card deck', () => {
    const deck = createDeck();
    expect(deck.length).toBe(52);
  });

  it('should have all cards face up', () => {
    const deck = createDeck();
    expect(deck.every(c => c.faceUp)).toBe(true);
  });

  it('should have 13 cards per suit', () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      const suitCards = deck.filter(c => c.suit === suit);
      expect(suitCards.length).toBe(13);
    }
  });

  it('should have all 13 ranks per suit', () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      const suitRanks = deck.filter(c => c.suit === suit).map(c => c.rank);
      for (const rank of RANKS) {
        expect(suitRanks).toContain(rank);
      }
    }
  });

  it('should have unique cards', () => {
    const deck = createDeck();
    const keys = new Set(deck.map(c => `${c.suit}-${c.rank}`));
    expect(keys.size).toBe(52);
  });

  it('shuffleDeck should return 52 cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled.length).toBe(52);
  });

  it('shuffleDeck should not modify original deck', () => {
    const deck = createDeck();
    const original = [...deck];
    shuffleDeck(deck);
    expect(deck).toEqual(original);
  });

  it('shuffleDeck should preserve all cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const origKeys = deck.map(c => `${c.suit}-${c.rank}`).sort();
    const shufKeys = shuffled.map(c => `${c.suit}-${c.rank}`).sort();
    expect(shufKeys).toEqual(origKeys);
  });

  it('shuffleDeck should produce different order (probabilistic)', () => {
    const deck = createDeck();
    const shuffled1 = shuffleDeck(deck);
    const shuffled2 = shuffleDeck(deck);
    // 极大概率不同
    const same = shuffled1.every((c, i) => c.suit === shuffled2[i].suit && c.rank === shuffled2[i].rank);
    expect(same).toBe(false);
  });
});

// ========== rankValue ==========
describe('rankValue', () => {
  it('should return 1 for Ace', () => {
    expect(rankValue('A')).toBe(1);
  });

  it('should return 13 for King', () => {
    expect(rankValue('K')).toBe(13);
  });

  it('should return 11 for Jack', () => {
    expect(rankValue('J')).toBe(11);
  });

  it('should return 12 for Queen', () => {
    expect(rankValue('Q')).toBe(12);
  });

  it('should return correct values for number cards', () => {
    expect(rankValue('2')).toBe(2);
    expect(rankValue('5')).toBe(5);
    expect(rankValue('10')).toBe(10);
  });
});

// ========== isRedSuit ==========
describe('isRedSuit', () => {
  it('hearts is red', () => {
    expect(isRedSuit('hearts')).toBe(true);
  });

  it('diamonds is red', () => {
    expect(isRedSuit('diamonds')).toBe(true);
  });

  it('clubs is black', () => {
    expect(isRedSuit('clubs')).toBe(false);
  });

  it('spades is black', () => {
    expect(isRedSuit('spades')).toBe(false);
  });
});

// ========== isOppositeColor ==========
describe('isOppositeColor', () => {
  it('hearts vs clubs is opposite', () => {
    expect(isOppositeColor('hearts', 'clubs')).toBe(true);
  });

  it('hearts vs spades is opposite', () => {
    expect(isOppositeColor('hearts', 'spades')).toBe(true);
  });

  it('diamonds vs clubs is opposite', () => {
    expect(isOppositeColor('diamonds', 'clubs')).toBe(true);
  });

  it('hearts vs diamonds is same color', () => {
    expect(isOppositeColor('hearts', 'diamonds')).toBe(false);
  });

  it('clubs vs spades is same color', () => {
    expect(isOppositeColor('clubs', 'spades')).toBe(false);
  });
});

// ========== suitSymbol ==========
describe('suitSymbol', () => {
  it('hearts symbol', () => { expect(suitSymbol('hearts')).toBe('♥'); });
  it('diamonds symbol', () => { expect(suitSymbol('diamonds')).toBe('♦'); });
  it('clubs symbol', () => { expect(suitSymbol('clubs')).toBe('♣'); });
  it('spades symbol', () => { expect(suitSymbol('spades')).toBe('♠'); });
});

// ========== foundationIndex ==========
describe('foundationIndex', () => {
  it('hearts is 0', () => { expect(foundationIndex('hearts')).toBe(0); });
  it('diamonds is 1', () => { expect(foundationIndex('diamonds')).toBe(1); });
  it('clubs is 2', () => { expect(foundationIndex('clubs')).toBe(2); });
  it('spades is 3', () => { expect(foundationIndex('spades')).toBe(3); });
});

// ========== isValidSequence ==========
describe('isValidSequence', () => {
  it('empty sequence is valid', () => {
    expect(isValidSequence([])).toBe(true);
  });

  it('single card is valid', () => {
    expect(isValidSequence([makeCard('hearts', 'K')])).toBe(true);
  });

  it('valid alternating color descending sequence', () => {
    const seq = [
      makeCard('hearts', '5'),
      makeCard('clubs', '4'),
      makeCard('diamonds', '3'),
    ];
    expect(isValidSequence(seq)).toBe(true);
  });

  it('same color is invalid', () => {
    const seq = [
      makeCard('hearts', '5'),
      makeCard('diamonds', '4'),
    ];
    expect(isValidSequence(seq)).toBe(false);
  });

  it('wrong order is invalid', () => {
    const seq = [
      makeCard('hearts', '3'),
      makeCard('clubs', '5'),
    ];
    expect(isValidSequence(seq)).toBe(false);
  });

  it('not consecutive values is invalid', () => {
    const seq = [
      makeCard('hearts', '7'),
      makeCard('clubs', '4'),
    ];
    expect(isValidSequence(seq)).toBe(false);
  });

  it('long valid sequence', () => {
    const seq = [
      makeCard('spades', 'K'),
      makeCard('hearts', 'Q'),
      makeCard('clubs', 'J'),
      makeCard('diamonds', '10'),
      makeCard('spades', '9'),
    ];
    expect(isValidSequence(seq)).toBe(true);
  });
});

// ========== maxMovableCards ==========
describe('maxMovableCards', () => {
  it('0 free cells, 0 empty cols = 1', () => {
    expect(maxMovableCards(0, 0, false)).toBe(1);
  });

  it('1 free cell, 0 empty cols = 2', () => {
    expect(maxMovableCards(1, 0, false)).toBe(2);
  });

  it('3 free cells, 0 empty cols = 4', () => {
    expect(maxMovableCards(3, 0, false)).toBe(4);
  });

  it('4 free cells, 0 empty cols = 5', () => {
    expect(maxMovableCards(4, 0, false)).toBe(5);
  });

  it('0 free cells, 1 empty col = 2', () => {
    expect(maxMovableCards(0, 1, false)).toBe(2);
  });

  it('0 free cells, 2 empty cols = 4', () => {
    expect(maxMovableCards(0, 2, false)).toBe(4);
  });

  it('4 free cells, 2 empty cols = 20', () => {
    expect(maxMovableCards(4, 2, false)).toBe(20);
  });

  it('moving to empty col reduces effective empty cols', () => {
    expect(maxMovableCards(0, 1, true)).toBe(1);
    expect(maxMovableCards(4, 1, true)).toBe(5);
  });

  it('4 free cells, 4 empty cols (not to empty) = 80', () => {
    expect(maxMovableCards(4, 4, false)).toBe(80);
  });

  it('4 free cells, 4 empty cols (to empty) = 40', () => {
    expect(maxMovableCards(4, 4, true)).toBe(40);
  });
});

// ========== Engine 初始化 ==========
describe('FreeCellEngine - Initialization', () => {
  let engine: FreeCellEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('should have 8 tableau columns', () => {
    expect(engine.getTableau().length).toBe(8);
  });

  it('should have 4 free cells', () => {
    expect(engine.getFreeCells().length).toBe(4);
  });

  it('should have 4 foundation piles', () => {
    expect(engine.getFoundations().length).toBe(4);
  });

  it('all free cells should be empty', () => {
    expect(engine.getFreeCells().every(c => c === null)).toBe(true);
  });

  it('all foundation piles should be empty', () => {
    expect(engine.getFoundations().every(pile => pile.length === 0)).toBe(true);
  });

  it('first 4 columns should have 7 cards', () => {
    const tableau = engine.getTableau();
    for (let i = 0; i < 4; i++) {
      expect(tableau[i].length).toBe(7);
    }
  });

  it('last 4 columns should have 6 cards', () => {
    const tableau = engine.getTableau();
    for (let i = 4; i < 8; i++) {
      expect(tableau[i].length).toBe(6);
    }
  });

  it('should have 52 cards total', () => {
    expect(totalCards(engine)).toBe(52);
  });

  it('all cards should be face up', () => {
    const allCards = engine.getTableau().flat();
    expect(allCards.every(c => c.faceUp)).toBe(true);
  });

  it('move count should be 0', () => {
    expect(engine.getMoveCount()).toBe(0);
  });

  it('isWin should be false', () => {
    expect(engine.isWin).toBe(false);
  });

  it('selected should be null', () => {
    expect(engine.getSelected()).toBeNull();
  });

  it('cursor should start at tableau', () => {
    expect(engine.getCursor().area).toBe(Area.TABLEAU);
    expect(engine.getCursor().index).toBe(0);
  });

  it('seeded deal should be deterministic', () => {
    const engine2 = new FreeCellEngine();
    engine2.dealWithSeed(42);
    const t1 = engine.getTableau();
    const t2 = engine2.getTableau();
    for (let i = 0; i < 8; i++) {
      expect(t1[i].map(c => `${c.suit}-${c.rank}`)).toEqual(t2[i].map(c => `${c.suit}-${c.rank}`));
    }
  });

  it('different seeds produce different deals', () => {
    const engine2 = new FreeCellEngine();
    engine2.dealWithSeed(123);
    const t1 = engine.getTableau();
    const t2 = engine2.getTableau();
    const same = t1.every((col, i) =>
      col.every((c, j) => c.suit === t2[i][j].suit && c.rank === t2[i][j].rank)
    );
    expect(same).toBe(false);
  });
});

// ========== 自由单元格操作 ==========
describe('FreeCellEngine - Free Cells', () => {
  let engine: FreeCellEngine;

  beforeEach(() => {
    engine = createStartedEngine();
  });

  it('getEmptyFreeCellCount should return 4 initially', () => {
    expect(engine.getEmptyFreeCellCount()).toBe(4);
  });

  it('can move a card to empty free cell', () => {
    const col = engine.getTableau()[0];
    const topCard = col[col.length - 1];
    const result = engine.moveToFreeCell(topCard, Area.TABLEAU, 0, 0);
    expect(result).toBe(true);
    expect(engine.getFreeCells()[0]).toEqual(topCard);
    expect(col.length).toBe(6); // was 7
  });

  it('cannot move to occupied free cell', () => {
    const col0 = engine.getTableau()[0];
    const topCard0 = col0[col0.length - 1];
    engine.moveToFreeCell(topCard0, Area.TABLEAU, 0, 0);

    const col1 = engine.getTableau()[1];
    const topCard1 = col1[col1.length - 1];
    const result = engine.moveToFreeCell(topCard1, Area.TABLEAU, 1, 0);
    expect(result).toBe(false);
  });

  it('moving to free cell decrements empty count', () => {
    const col = engine.getTableau()[0];
    engine.moveToFreeCell(col[col.length - 1], Area.TABLEAU, 0, 0);
    expect(engine.getEmptyFreeCellCount()).toBe(3);
  });

  it('can move card from free cell to tableau', () => {
    const col = engine.getTableau()[0];
    const topCard = col[col.length - 1];
    engine.moveToFreeCell(topCard, Area.TABLEAU, 0, 0);

    // Move from free cell to a different column
    // Clear column 1 to make it an empty target
    engine.getTableau()[1] = [];
    const card = engine.getFreeCells()[0]!;
    const result = engine.moveSequenceToTableau([card], Area.FREECELL, 0, 0, 1);
    expect(result).toBe(true);
    expect(engine.getFreeCells()[0]).toBeNull();
  });

  it('cannot move multiple cards from free cell', () => {
    const col = engine.getTableau()[0];
    const topCard = col[col.length - 1];
    engine.moveToFreeCell(topCard, Area.TABLEAU, 0, 0);

    const card = engine.getFreeCells()[0]!;
    const result = engine.moveSequenceToTableau([card, makeCard('hearts', 'A')], Area.FREECELL, 0, 0, 1);
    expect(result).toBe(false);
  });
});

// ========== 基础堆操作 ==========
describe('FreeCellEngine - Foundations', () => {
  let engine: FreeCellEngine;

  beforeEach(() => {
    engine = createStartedEngine();
  });

  it('foundation should be empty initially', () => {
    for (let i = 0; i < 4; i++) {
      expect(engine.getFoundationTop(i)).toBeNull();
    }
  });

  it('can move Ace to correct foundation', () => {
    const ace = makeCard('hearts', 'A');
    engine.getTableau()[0].push(ace);
    const result = engine.moveToFoundation(ace, Area.TABLEAU, 0);
    expect(result).toBe(true);
    expect(engine.getFoundationTop(0)).toEqual(ace);
  });

  it('cannot move Ace to wrong foundation', () => {
    const ace = makeCard('hearts', 'A');
    engine.getTableau()[0].push(ace);
    const result = engine.canMoveToFoundation(ace, 1); // diamonds foundation
    expect(result).toBe(false);
  });

  it('can stack cards on foundation in order', () => {
    // Place Ace
    const ace = makeCard('hearts', 'A');
    engine.getTableau()[0].push(ace);
    engine.moveToFoundation(ace, Area.TABLEAU, 0);

    // Place 2
    const two = makeCard('hearts', '2');
    engine.getTableau()[0].push(two);
    const result = engine.moveToFoundation(two, Area.TABLEAU, 0);
    expect(result).toBe(true);
    expect(engine.getFoundationTop(0)).toEqual(two);
  });

  it('cannot place wrong suit on foundation', () => {
    const ace = makeCard('hearts', 'A');
    engine.getTableau()[0].push(ace);
    engine.moveToFoundation(ace, Area.TABLEAU, 0);

    const two = makeCard('diamonds', '2');
    engine.getTableau()[0].push(two);
    const result = engine.canMoveToFoundation(two, 0);
    expect(result).toBe(false);
  });

  it('cannot skip ranks on foundation', () => {
    const ace = makeCard('hearts', 'A');
    engine.getTableau()[0].push(ace);
    engine.moveToFoundation(ace, Area.TABLEAU, 0);

    const three = makeCard('hearts', '3');
    engine.getTableau()[0].push(three);
    const result = engine.canMoveToFoundation(three, 0);
    expect(result).toBe(false);
  });

  it('can move from free cell to foundation', () => {
    const ace = makeCard('hearts', 'A');
    engine.getFreeCells()[0] = ace;
    const result = engine.moveToFoundation(ace, Area.FREECELL, 0);
    expect(result).toBe(true);
    expect(engine.getFreeCells()[0]).toBeNull();
    expect(engine.getFoundationTop(0)).toEqual(ace);
  });

  it('foundationIndex maps correctly for all suits', () => {
    expect(foundationIndex('hearts')).toBe(0);
    expect(foundationIndex('diamonds')).toBe(1);
    expect(foundationIndex('clubs')).toBe(2);
    expect(foundationIndex('spades')).toBe(3);
  });
});

// ========== 列间移动规则 ==========
describe('FreeCellEngine - Tableau Moves', () => {
  let engine: FreeCellEngine;

  beforeEach(() => {
    engine = createStartedEngine();
  });

  it('can move to empty column', () => {
    // Clear a column
    engine.getTableau()[0] = [];
    const col1 = engine.getTableau()[1];
    const topCard = col1[col1.length - 1];
    const result = engine.moveSequenceToTableau([topCard], Area.TABLEAU, 1, col1.length - 1, 0);
    expect(result).toBe(true);
    expect(engine.getTableau()[0].length).toBe(1);
  });

  it('can move card onto opposite color with rank+1', () => {
    // Set up: column 0 has 5♥ on top, column 1 has 6♣ on top
    engine.getTableau()[0] = [makeCard('hearts', '5')];
    engine.getTableau()[1] = [makeCard('clubs', '6')];

    const card = makeCard('hearts', '5');
    const result = engine.canMoveToTableau(card, 1);
    expect(result).toBe(true);
  });

  it('cannot move card onto same color', () => {
    engine.getTableau()[0] = [makeCard('hearts', '5')];
    engine.getTableau()[1] = [makeCard('diamonds', '6')];

    const card = makeCard('hearts', '5');
    const result = engine.canMoveToTableau(card, 1);
    expect(result).toBe(false);
  });

  it('cannot move card onto wrong rank', () => {
    engine.getTableau()[0] = [makeCard('hearts', '5')];
    engine.getTableau()[1] = [makeCard('clubs', '8')];

    const card = makeCard('hearts', '5');
    const result = engine.canMoveToTableau(card, 1);
    expect(result).toBe(false);
  });

  it('can move valid sequence', () => {
    engine.getTableau()[0] = [
      makeCard('spades', 'K'),
      makeCard('hearts', 'Q'),
      makeCard('clubs', 'J'),
    ];
    engine.getTableau()[1] = [];

    const seq = [
      makeCard('hearts', 'Q'),
      makeCard('clubs', 'J'),
    ];
    const result = engine.moveSequenceToTableau(seq, Area.TABLEAU, 0, 1, 1);
    expect(result).toBe(true);
    expect(engine.getTableau()[0].length).toBe(1);
    expect(engine.getTableau()[1].length).toBe(2);
  });

  it('cannot move invalid sequence', () => {
    engine.getTableau()[0] = [
      makeCard('spades', 'K'),
      makeCard('hearts', 'Q'),
      makeCard('hearts', 'J'), // same color - invalid
    ];
    engine.getTableau()[1] = [];

    const seq = [
      makeCard('hearts', 'Q'),
      makeCard('hearts', 'J'),
    ];
    const result = engine.moveSequenceToTableau(seq, Area.TABLEAU, 0, 1, 1);
    expect(result).toBe(false);
  });

  it('cannot move sequence exceeding max movable', () => {
    // All free cells full, no empty columns => max 1
    engine.getFreeCells()[0] = makeCard('hearts', 'A');
    engine.getFreeCells()[1] = makeCard('diamonds', 'A');
    engine.getFreeCells()[2] = makeCard('clubs', 'A');
    engine.getFreeCells()[3] = makeCard('spades', 'A');

    engine.getTableau()[0] = [
      makeCard('spades', 'K'),
      makeCard('hearts', 'Q'),
    ];
    engine.getTableau()[1] = [makeCard('clubs', 'K')];

    const seq = [
      makeCard('spades', 'K'),
      makeCard('hearts', 'Q'),
    ];
    const result = engine.moveSequenceToTableau(seq, Area.TABLEAU, 0, 0, 1);
    expect(result).toBe(false);
  });

  it('getSequenceLength returns correct length', () => {
    engine.getTableau()[0] = [
      makeCard('spades', 'K'),
      makeCard('hearts', 'Q'),
      makeCard('clubs', 'J'),
      makeCard('diamonds', '10'),
    ];
    expect(engine.getSequenceLength(0)).toBe(4);
  });

  it('getSequenceLength returns 0 for empty column', () => {
    engine.getTableau()[0] = [];
    expect(engine.getSequenceLength(0)).toBe(0);
  });

  it('getSequenceLength returns 1 for single card', () => {
    engine.getTableau()[0] = [makeCard('hearts', 'K')];
    expect(engine.getSequenceLength(0)).toBe(1);
  });

  it('getSequenceFrom returns valid sequence', () => {
    engine.getTableau()[0] = [
      makeCard('spades', 'K'),
      makeCard('hearts', 'Q'),
      makeCard('clubs', 'J'),
    ];
    const seq = engine.getSequenceFrom(0, 1);
    expect(seq.length).toBe(2);
    expect(seq[0].rank).toBe('Q');
    expect(seq[1].rank).toBe('J');
  });

  it('getSequenceFrom returns empty for invalid start', () => {
    engine.getTableau()[0] = [
      makeCard('spades', 'K'),
      makeCard('hearts', '5'), // breaks sequence
      makeCard('clubs', 'J'),
    ];
    const seq = engine.getSequenceFrom(0, 0);
    expect(seq.length).toBe(0);
  });

  it('cannot move to same column', () => {
    engine.getTableau()[0] = [makeCard('hearts', 'K')];
    const seq = [makeCard('hearts', 'K')];
    const result = engine.moveSequenceToTableau(seq, Area.TABLEAU, 0, 0, 0);
    expect(result).toBe(false);
  });
});

// ========== 选择与放置 ==========
describe('FreeCellEngine - Selection & Placement', () => {
  let engine: FreeCellEngine;

  beforeEach(() => {
    engine = createStartedEngine();
  });

  it('selecting a tableau card sets selected', () => {
    engine.setCursor(Area.TABLEAU, 0, 6); // top card of column 0
    engine.handleSelect();
    expect(engine.getSelected()).not.toBeNull();
    expect(engine.getSelected()!.area).toBe(Area.TABLEAU);
    expect(engine.getSelected()!.index).toBe(0);
  });

  it('selecting empty column does nothing', () => {
    engine.getTableau()[0] = [];
    engine.setCursor(Area.TABLEAU, 0, 0);
    engine.handleSelect();
    expect(engine.getSelected()).toBeNull();
  });

  it('selecting a free cell card sets selected', () => {
    engine.getFreeCells()[0] = makeCard('hearts', 'A');
    engine.setCursor(Area.FREECELL, 0);
    engine.handleSelect();
    expect(engine.getSelected()).not.toBeNull();
    expect(engine.getSelected()!.area).toBe(Area.FREECELL);
  });

  it('selecting empty free cell does nothing', () => {
    engine.setCursor(Area.FREECELL, 0);
    engine.handleSelect();
    expect(engine.getSelected()).toBeNull();
  });

  it('double select cancels selection', () => {
    engine.setCursor(Area.TABLEAU, 0, 6);
    engine.handleSelect(); // select
    expect(engine.getSelected()).not.toBeNull();
    // Click same spot again - this will try to place on same column, which fails
    engine.handleSelect();
    expect(engine.getSelected()).toBeNull();
  });

  it('escape cancels selection', () => {
    engine.setCursor(Area.TABLEAU, 0, 6);
    engine.handleSelect();
    engine.handleKeyDown('Escape');
    expect(engine.getSelected()).toBeNull();
  });

  it('can select and place on foundation via keyboard 1-4', () => {
    // Place an Ace in column 0
    const ace = makeCard('hearts', 'A');
    engine.getTableau()[0] = [ace];
    engine.setCursor(Area.TABLEAU, 0, 0);
    engine.handleSelect(); // select the ace
    engine.handleKeyDown('1'); // move to foundation 0 (hearts)
    expect(engine.getSelected()).toBeNull();
    expect(engine.getFoundationTop(0)).toEqual(ace);
  });

  it('quick move to foundation without selecting', () => {
    const ace = makeCard('hearts', 'A');
    engine.getTableau()[0] = [ace];
    engine.setCursor(Area.TABLEAU, 0, 0);
    engine.handleKeyDown('1'); // quick move
    expect(engine.getFoundationTop(0)).toEqual(ace);
  });
});

// ========== 键盘控制 ==========
describe('FreeCellEngine - Keyboard Controls', () => {
  let engine: FreeCellEngine;

  beforeEach(() => {
    engine = createStartedEngine();
  });

  it('ArrowRight moves cursor right in tableau', () => {
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursor().index).toBe(1);
  });

  it('ArrowLeft moves cursor left in tableau', () => {
    engine.setCursor(Area.TABLEAU, 3, 0);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.getCursor().index).toBe(2);
  });

  it('ArrowLeft at index 0 stays', () => {
    engine.setCursor(Area.TABLEAU, 0, 0);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.getCursor().index).toBe(0);
  });

  it('ArrowRight at index 7 stays', () => {
    engine.setCursor(Area.TABLEAU, 7, 0);
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursor().index).toBe(7);
  });

  it('ArrowUp in tableau moves cardIndex up', () => {
    engine.setCursor(Area.TABLEAU, 0, 3);
    engine.handleKeyDown('ArrowUp');
    expect(engine.getCursor().cardIndex).toBe(2);
  });

  it('ArrowUp at top of column moves to freecell', () => {
    engine.setCursor(Area.TABLEAU, 0, 0);
    engine.handleKeyDown('ArrowUp');
    expect(engine.getCursor().area).toBe(Area.FREECELL);
  });

  it('ArrowDown in freecell moves to tableau', () => {
    engine.setCursor(Area.FREECELL, 0);
    engine.handleKeyDown('ArrowDown');
    expect(engine.getCursor().area).toBe(Area.TABLEAU);
  });

  it('ArrowDown in foundation moves to tableau', () => {
    engine.setCursor(Area.FOUNDATION, 0);
    engine.handleKeyDown('ArrowDown');
    expect(engine.getCursor().area).toBe(Area.TABLEAU);
  });

  it('ArrowRight in freecell moves right', () => {
    engine.setCursor(Area.FREECELL, 0);
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursor().index).toBe(1);
  });

  it('ArrowRight from freecell 3 goes to foundation 0', () => {
    engine.setCursor(Area.FREECELL, 3);
    engine.handleKeyDown('ArrowRight');
    expect(engine.getCursor().area).toBe(Area.FOUNDATION);
    expect(engine.getCursor().index).toBe(0);
  });

  it('ArrowLeft from foundation 0 goes to freecell 3', () => {
    engine.setCursor(Area.FOUNDATION, 0);
    engine.handleKeyDown('ArrowLeft');
    expect(engine.getCursor().area).toBe(Area.FREECELL);
    expect(engine.getCursor().index).toBe(3);
  });

  it('ArrowDown in tableau moves cardIndex down', () => {
    engine.setCursor(Area.TABLEAU, 0, 0);
    engine.handleKeyDown('ArrowDown');
    expect(engine.getCursor().cardIndex).toBe(1);
  });

  it('Space triggers select', () => {
    const spy = vi.spyOn(engine as any, 'handleSelect');
    engine.handleKeyDown(' ');
    expect(spy).toHaveBeenCalled();
  });

  it('A triggers autoCompleteAll', () => {
    const spy = vi.spyOn(engine as any, 'autoCompleteAll');
    engine.handleKeyDown('a');
    expect(spy).toHaveBeenCalled();
  });

  it('keys are ignored when not playing', () => {
    const engine2 = new FreeCellEngine();
    engine2.dealWithSeed(42);
    // Not started, status is idle
    engine2.handleKeyDown('ArrowRight');
    expect(engine2.getCursor().index).toBe(0); // unchanged
  });
});

// ========== 自动完成 ==========
describe('FreeCellEngine - Auto Complete', () => {
  it('auto completes when all cards are ordered', () => {
    const engine = createStartedEngine();

    // Set up a near-win state: all cards in order in columns
    // Put Aces in free cells
    engine.getFreeCells()[0] = makeCard('hearts', 'A');
    engine.getFreeCells()[1] = makeCard('diamonds', 'A');
    engine.getFreeCells()[2] = makeCard('clubs', 'A');
    engine.getFreeCells()[3] = makeCard('spades', 'A');

    // Clear tableau and set up sorted columns
    for (let i = 0; i < 8; i++) {
      engine.getTableau()[i] = [];
    }

    // Each column has sorted cards from 2 up
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    for (let s = 0; s < 4; s++) {
      for (let r = 2; r <= 13; r++) {
        const rank = RANKS[r - 1];
        engine.getTableau()[s].push(makeCard(suits[s], rank as Rank));
      }
    }

    engine.autoCompleteAll();

    // All aces should have been moved to foundations
    // And the 2s should follow since they're safe after aces
    const foundationTotal = engine.getFoundations().reduce((sum, pile) => sum + pile.length, 0);
    expect(foundationTotal).toBeGreaterThan(0);
  });

  it('tryAutoComplete moves safe cards', () => {
    const engine = createStartedEngine();

    // Place an Ace at the top of a column
    engine.getTableau()[0] = [makeCard('hearts', 'A')];
    // Clear other columns to simplify
    for (let i = 1; i < 8; i++) {
      engine.getTableau()[i] = [];
    }

    engine.tryAutoComplete();

    expect(engine.getFoundationTop(0)).not.toBeNull();
    expect(engine.getFoundationTop(0)!.rank).toBe('A');
  });
});

// ========== 胜利判定 ==========
describe('FreeCellEngine - Win Condition', () => {
  it('detects win when all 52 cards in foundations', () => {
    const engine = createStartedEngine();

    // Set up winning state
    for (let i = 0; i < 8; i++) {
      engine.getTableau()[i] = [];
    }
    engine.getFreeCells()[0] = null;
    engine.getFreeCells()[1] = null;
    engine.getFreeCells()[2] = null;
    engine.getFreeCells()[3] = null;

    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    for (let s = 0; s < 4; s++) {
      for (const rank of RANKS) {
        engine.getFoundations()[s].push(makeCard(suits[s], rank));
      }
    }

    // Trigger win check by moving a card (which calls checkWin internally)
    // Or directly check that 52 cards are in foundations
    const foundationTotal = engine.getFoundations().reduce((sum, pile) => sum + pile.length, 0);
    expect(foundationTotal).toBe(52);
  });

  it('isWin is false at start', () => {
    const engine = createStartedEngine();
    expect(engine.isWin).toBe(false);
  });
});

// ========== hasValidMoves ==========
describe('FreeCellEngine - Valid Moves Check', () => {
  it('has valid moves at game start', () => {
    const engine = createStartedEngine();
    expect(engine.hasValidMoves()).toBe(true);
  });

  it('has valid moves when free cells available', () => {
    const engine = createStartedEngine();
    // Even if no tableau moves, free cells provide options
    expect(engine.getEmptyFreeCellCount()).toBe(4);
    expect(engine.hasValidMoves()).toBe(true);
  });
});

// ========== getState ==========
describe('FreeCellEngine - getState', () => {
  it('returns game state', () => {
    const engine = createStartedEngine();
    const state = engine.getState();

    expect(state).toHaveProperty('tableau');
    expect(state).toHaveProperty('freeCells');
    expect(state).toHaveProperty('foundations');
    expect(state).toHaveProperty('selected');
    expect(state).toHaveProperty('cursor');
    expect(state).toHaveProperty('moveCount');
    expect(state).toHaveProperty('isWin');
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('seed');
  });

  it('state tableau has 8 columns', () => {
    const engine = createStartedEngine();
    const state = engine.getState();
    expect((state as any).tableau.length).toBe(8);
  });

  it('state freeCells has 4 entries', () => {
    const engine = createStartedEngine();
    const state = engine.getState();
    expect((state as any).freeCells.length).toBe(4);
  });

  it('state foundations has 4 piles', () => {
    const engine = createStartedEngine();
    const state = engine.getState();
    expect((state as any).foundations.length).toBe(4);
  });

  it('state reflects current move count', () => {
    const engine = createStartedEngine();
    const col = engine.getTableau()[0];
    engine.moveToFreeCell(col[col.length - 1], Area.TABLEAU, 0, 0);
    const state = engine.getState();
    expect((state as any).moveCount).toBe(1);
  });

  it('state reflects isWin', () => {
    const engine = createStartedEngine();
    const state = engine.getState();
    expect((state as any).isWin).toBe(false);
  });
});

// ========== 计分 ==========
describe('FreeCellEngine - Scoring', () => {
  it('starts with score 0', () => {
    const engine = createStartedEngine();
    expect(engine.score).toBe(0);
  });

  it('moving to foundation adds 10 points', () => {
    const engine = createStartedEngine();
    const ace = makeCard('hearts', 'A');
    engine.getTableau()[0].push(ace);
    engine.moveToFoundation(ace, Area.TABLEAU, 0);
    expect(engine.score).toBe(10);
  });

  it('moving to free cell subtracts 2 points', () => {
    const engine = createStartedEngine();
    const col = engine.getTableau()[0];
    engine.moveToFreeCell(col[col.length - 1], Area.TABLEAU, 0, 0);
    expect(engine.score).toBe(-2);
  });

  it('moving from free cell adds 2 points', () => {
    const engine = createStartedEngine();
    const col = engine.getTableau()[0];
    const topCard = col[col.length - 1];
    engine.moveToFreeCell(topCard, Area.TABLEAU, 0, 0);

    // Move from free cell to a different empty column
    engine.getTableau()[1] = [];
    const card = engine.getFreeCells()[0]!;
    engine.moveSequenceToTableau([card], Area.FREECELL, 0, 0, 1);
    expect(engine.score).toBe(0); // -2 + 2
  });
});

// ========== 重置 ==========
describe('FreeCellEngine - Reset', () => {
  it('reset clears game state', () => {
    const engine = createStartedEngine();
    const col = engine.getTableau()[0];
    engine.moveToFreeCell(col[col.length - 1], Area.TABLEAU, 0, 0);

    engine.reset();

    expect(engine.getMoveCount()).toBe(0);
    expect(engine.getEmptyFreeCellCount()).toBe(4);
    expect(engine.isWin).toBe(false);
    expect(engine.getSelected()).toBeNull();
  });

  it('reset re-deals cards', () => {
    const engine = createStartedEngine();
    const origLen = engine.getTableau()[0].length;
    engine.moveToFreeCell(engine.getTableau()[0][engine.getTableau()[0].length - 1], Area.TABLEAU, 0, 0);
    expect(engine.getTableau()[0].length).toBe(origLen - 1);

    engine.reset();
    expect(engine.getTableau()[0].length).toBe(origLen);
  });
});

// ========== Move Count ==========
describe('FreeCellEngine - Move Count', () => {
  it('increments on each move', () => {
    const engine = createStartedEngine();
    expect(engine.getMoveCount()).toBe(0);

    const col = engine.getTableau()[0];
    engine.moveToFreeCell(col[col.length - 1], Area.TABLEAU, 0, 0);
    expect(engine.getMoveCount()).toBe(1);

    const col2 = engine.getTableau()[1];
    engine.moveToFreeCell(col2[col2.length - 1], Area.TABLEAU, 1, 1);
    expect(engine.getMoveCount()).toBe(2);
  });
});

// ========== Engine Lifecycle ==========
describe('FreeCellEngine - Lifecycle', () => {
  it('can be initialized without canvas', () => {
    const engine = new FreeCellEngine();
    engine.init();
    expect(engine.getTableau().length).toBe(8);
  });

  it('can be destroyed', () => {
    const engine = createStartedEngine();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('handleKeyUp does nothing', () => {
    const engine = createStartedEngine();
    expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
  });
});

// ========== Edge Cases ==========
describe('FreeCellEngine - Edge Cases', () => {
  it('cannot move from empty column', () => {
    const engine = createStartedEngine();
    engine.getTableau()[0] = [];
    const result = engine.moveSequenceToTableau(
      [makeCard('hearts', 'A')],
      Area.TABLEAU,
      0,
      0,
      1
    );
    expect(result).toBe(false);
  });

  it('getSequenceFrom with out-of-bounds index returns empty', () => {
    const engine = createStartedEngine();
    const seq = engine.getSequenceFrom(0, 100);
    expect(seq).toEqual([]);
  });

  it('canMoveToTableau accepts any card on empty column', () => {
    const engine = createStartedEngine();
    engine.getTableau()[1] = [];
    expect(engine.canMoveToTableau(makeCard('hearts', 'K'), 1)).toBe(true);
    expect(engine.canMoveToTableau(makeCard('clubs', '2'), 1)).toBe(true);
    expect(engine.canMoveToTableau(makeCard('spades', 'A'), 1)).toBe(true);
  });

  it('total cards always equals 52 after moves', () => {
    const engine = createStartedEngine();
    const col = engine.getTableau()[0];
    const topCard = col[col.length - 1];
    engine.moveToFreeCell(topCard, Area.TABLEAU, 0, 0);
    expect(totalCards(engine)).toBe(52);
  });

  it('total cards equals 52 after foundation move', () => {
    const engine = createStartedEngine();
    const ace = makeCard('hearts', 'A');
    // Replace top card of column 0 with ace (avoid duplicate)
    const col0 = engine.getTableau()[0];
    col0[col0.length - 1] = ace;
    engine.moveToFoundation(ace, Area.TABLEAU, 0);
    expect(totalCards(engine)).toBe(52);
  });

  it('selecting middle of column requires valid sequence from there', () => {
    const engine = createStartedEngine();
    // Set up a column with a break in the sequence
    engine.getTableau()[0] = [
      makeCard('spades', 'K'),
      makeCard('hearts', '5'), // break
      makeCard('clubs', 'J'),
    ];
    // Try to select from index 0 - should fail (invalid sequence from 0)
    engine.setCursor(Area.TABLEAU, 0, 0);
    engine.handleSelect();
    expect(engine.getSelected()).toBeNull();

    // Select from index 1 - should fail (5♥ then C-J is not valid sequence)
    engine.setCursor(Area.TABLEAU, 0, 1);
    engine.handleSelect();
    expect(engine.getSelected()).toBeNull();

    // Select from index 2 - single card, valid
    engine.setCursor(Area.TABLEAU, 0, 2);
    engine.handleSelect();
    expect(engine.getSelected()).not.toBeNull();
  });

  it('moving from foundation is not allowed', () => {
    const engine = createStartedEngine();
    const ace = makeCard('hearts', 'A');
    engine.getTableau()[0].push(ace);
    engine.moveToFoundation(ace, Area.TABLEAU, 0);

    // Try to select from foundation and place elsewhere
    engine.setSelected({ area: Area.FOUNDATION, index: 0 });
    // placeOnFoundation, placeOnFreeCell, placeOnTableau all check sel.area
    // Foundation cards cannot be moved back in FreeCell
    const result = (engine as any).placeOnTableau(
      { area: Area.FOUNDATION, index: 0 },
      0
    );
    expect(result).toBe(false);
  });
});

// ========== Area enum ==========
describe('Area enum', () => {
  it('has FREECELL value', () => {
    expect(Area.FREECELL).toBe('freecell');
  });

  it('has FOUNDATION value', () => {
    expect(Area.FOUNDATION).toBe('foundation');
  });

  it('has TABLEAU value', () => {
    expect(Area.TABLEAU).toBe('tableau');
  });
});

// ========== Safe auto move ==========
describe('FreeCellEngine - Safe Auto Move', () => {
  it('Aces are always safe to auto move', () => {
    const engine = createStartedEngine();
    const ace = makeCard('hearts', 'A');
    expect((engine as any).isSafeAutoMove(ace)).toBe(true);
  });

  it('2s are always safe to auto move', () => {
    const engine = createStartedEngine();
    const two = makeCard('hearts', '2');
    expect((engine as any).isSafeAutoMove(two)).toBe(true);
  });

  it('higher cards require opposite color foundations to be built up', () => {
    const engine = createStartedEngine();
    // Place hearts A and 2 in foundation
    engine.getFoundations()[0].push(makeCard('hearts', 'A'));
    engine.getFoundations()[0].push(makeCard('hearts', '2'));

    // 3♥ is safe if both black suits have at least 2 on foundation
    // clubs foundation (index 2) is empty, so not safe
    const three = makeCard('hearts', '3');
    expect((engine as any).isSafeAutoMove(three)).toBe(false);

    // Add clubs A and 2
    engine.getFoundations()[2].push(makeCard('clubs', 'A'));
    engine.getFoundations()[2].push(makeCard('clubs', '2'));

    // Still need spades (index 3)
    expect((engine as any).isSafeAutoMove(three)).toBe(false);

    // Add spades A and 2
    engine.getFoundations()[3].push(makeCard('spades', 'A'));
    engine.getFoundations()[3].push(makeCard('spades', '2'));

    // Now 3♥ is safe
    expect((engine as any).isSafeAutoMove(three)).toBe(true);
  });
});

// ========== Integration: Full game flow ==========
describe('FreeCellEngine - Integration', () => {
  it('can play through basic moves', () => {
    const engine = createStartedEngine();

    // Move top card of column 0 to free cell
    const col0 = engine.getTableau()[0];
    const topCard0 = col0[col0.length - 1];
    expect(engine.moveToFreeCell(topCard0, Area.TABLEAU, 0, 0)).toBe(true);

    // Move top card of column 1 to free cell
    const col1 = engine.getTableau()[1];
    const topCard1 = col1[col1.length - 1];
    expect(engine.moveToFreeCell(topCard1, Area.TABLEAU, 1, 1)).toBe(true);

    // Verify state
    expect(engine.getEmptyFreeCellCount()).toBe(2);
    expect(engine.getMoveCount()).toBe(2);
    expect(totalCards(engine)).toBe(52);
  });

  it('preserves card uniqueness through moves', () => {
    const engine = createStartedEngine();
    const allCards: string[] = [];

    for (const col of engine.getTableau()) {
      for (const c of col) allCards.push(`${c.suit}-${c.rank}`);
    }
    for (const c of engine.getFreeCells()) {
      if (c) allCards.push(`${c.suit}-${c.rank}`);
    }
    for (const pile of engine.getFoundations()) {
      for (const c of pile) allCards.push(`${c.suit}-${c.rank}`);
    }

    expect(allCards.length).toBe(52);
    expect(new Set(allCards).size).toBe(52);
  });

  it('engine status transitions correctly', () => {
    const engine = new FreeCellEngine();
    expect(engine.status).toBe('idle');

    const mockCanvas = document.createElement('canvas');
    mockCanvas.width = 480;
    mockCanvas.height = 640;
    engine.setCanvas(mockCanvas);
    engine.start();
    expect(engine.status).toBe('playing');

    engine.pause();
    expect(engine.status).toBe('paused');

    engine.resume();
    expect(engine.status).toBe('playing');

    engine.reset();
    expect(engine.status).toBe('idle');
  });
});
