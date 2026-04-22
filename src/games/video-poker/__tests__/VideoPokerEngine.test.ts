import { vi } from 'vitest';
import {
  SUITS,
  RANKS,
  RANK_NAMES,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  PAYOUT_TABLE,
  HAND_RANK_NAMES,
  DEFAULT_CREDITS,
  MIN_BET,
  MAX_BET,
  HAND_SIZE,
  GamePhase,
  HandRank,
} from '../constants';
import type { Card, Suit, Rank } from '../constants';
import { VideoPokerEngine } from '../VideoPokerEngine';

// ========== Mock Canvas 工厂 ==========
function createMockCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

// ========== 辅助函数 ==========
function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

function makeRoyalFlush(): Card[] {
  return [
    makeCard('hearts', 10),
    makeCard('hearts', 11),
    makeCard('hearts', 12),
    makeCard('hearts', 13),
    makeCard('hearts', 14),
  ];
}

function makeStraightFlush(): Card[] {
  return [
    makeCard('spades', 5),
    makeCard('spades', 6),
    makeCard('spades', 7),
    makeCard('spades', 8),
    makeCard('spades', 9),
  ];
}

function makeFourOfAKind(): Card[] {
  return [
    makeCard('hearts', 7),
    makeCard('diamonds', 7),
    makeCard('clubs', 7),
    makeCard('spades', 7),
    makeCard('hearts', 3),
  ];
}

function makeFullHouse(): Card[] {
  return [
    makeCard('hearts', 9),
    makeCard('diamonds', 9),
    makeCard('clubs', 9),
    makeCard('spades', 5),
    makeCard('hearts', 5),
  ];
}

function makeFlush(): Card[] {
  return [
    makeCard('diamonds', 2),
    makeCard('diamonds', 5),
    makeCard('diamonds', 7),
    makeCard('diamonds', 9),
    makeCard('diamonds', 13),
  ];
}

function makeStraight(): Card[] {
  return [
    makeCard('hearts', 4),
    makeCard('diamonds', 5),
    makeCard('clubs', 6),
    makeCard('spades', 7),
    makeCard('hearts', 8),
  ];
}

function makeThreeOfAKind(): Card[] {
  return [
    makeCard('hearts', 6),
    makeCard('diamonds', 6),
    makeCard('clubs', 6),
    makeCard('spades', 2),
    makeCard('hearts', 9),
  ];
}

function makeTwoPair(): Card[] {
  return [
    makeCard('hearts', 8),
    makeCard('diamonds', 8),
    makeCard('clubs', 4),
    makeCard('spades', 4),
    makeCard('hearts', 11),
  ];
}

function makeJacksOrBetter(): Card[] {
  return [
    makeCard('hearts', 11),
    makeCard('diamonds', 11),
    makeCard('clubs', 3),
    makeCard('spades', 5),
    makeCard('hearts', 8),
  ];
}

function makeLowPair(): Card[] {
  return [
    makeCard('hearts', 5),
    makeCard('diamonds', 5),
    makeCard('clubs', 3),
    makeCard('spades', 7),
    makeCard('hearts', 9),
  ];
}

function makeHighCard(): Card[] {
  return [
    makeCard('hearts', 2),
    makeCard('diamonds', 5),
    makeCard('clubs', 8),
    makeCard('spades', 11),
    makeCard('hearts', 14),
  ];
}

function makeWheelStraight(): Card[] {
  return [
    makeCard('hearts', 14),
    makeCard('diamonds', 2),
    makeCard('clubs', 3),
    makeCard('spades', 4),
    makeCard('hearts', 5),
  ];
}

function makeWheelStraightFlush(): Card[] {
  return [
    makeCard('clubs', 14),
    makeCard('clubs', 2),
    makeCard('clubs', 3),
    makeCard('clubs', 4),
    makeCard('clubs', 5),
  ];
}

// ========== 测试套件 ==========

describe('VideoPokerEngine', () => {
  let engine: VideoPokerEngine;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = createMockCanvas();
    engine = new VideoPokerEngine();
    // 阻止 gameLoop
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockReturnValue();
  });

  // ========== 1. 常量测试 ==========

  describe('Constants', () => {
    it('应有4种花色', () => {
      expect(SUITS.length).toBe(4);
    });

    it('应有13种牌面值', () => {
      expect(RANKS.length).toBe(13);
    });

    it('牌面值范围应为2-14', () => {
      expect(RANKS[0]).toBe(2);
      expect(RANKS[12]).toBe(14);
    });

    it('RANK_NAMES 应包含所有牌面值名称', () => {
      expect(RANK_NAMES[11]).toBe('J');
      expect(RANK_NAMES[12]).toBe('Q');
      expect(RANK_NAMES[13]).toBe('K');
      expect(RANK_NAMES[14]).toBe('A');
      expect(RANK_NAMES[2]).toBe('2');
      expect(RANK_NAMES[10]).toBe('10');
    });

    it('SUIT_SYMBOLS 应包含4种花色符号', () => {
      expect(SUIT_SYMBOLS.hearts).toBe('♥');
      expect(SUIT_SYMBOLS.diamonds).toBe('♦');
      expect(SUIT_SYMBOLS.clubs).toBe('♣');
      expect(SUIT_SYMBOLS.spades).toBe('♠');
    });

    it('SUIT_COLORS 应正确区分红黑花色', () => {
      expect(SUIT_COLORS.hearts).toBe('#e74c3c');
      expect(SUIT_COLORS.diamonds).toBe('#e74c3c');
      expect(SUIT_COLORS.clubs).toBe('#2c3e50');
      expect(SUIT_COLORS.spades).toBe('#2c3e50');
    });

    it('DEFAULT_CREDITS 应为1000', () => {
      expect(DEFAULT_CREDITS).toBe(1000);
    });

    it('MIN_BET 应为1', () => {
      expect(MIN_BET).toBe(1);
    });

    it('MAX_BET 应为5', () => {
      expect(MAX_BET).toBe(5);
    });

    it('HAND_SIZE 应为5', () => {
      expect(HAND_SIZE).toBe(5);
    });
  });

  // ========== 2. 牌组操作测试 ==========

  describe('Deck Operations', () => {
    it('createDeck 应创建52张牌', () => {
      const deck = VideoPokerEngine.createDeck();
      expect(deck.length).toBe(52);
    });

    it('createDeck 应包含每种花色各13张', () => {
      const deck = VideoPokerEngine.createDeck();
      for (const suit of SUITS) {
        const suitCards = deck.filter((c) => c.suit === suit);
        expect(suitCards.length).toBe(13);
      }
    });

    it('createDeck 应包含每个牌面值各4张', () => {
      const deck = VideoPokerEngine.createDeck();
      for (const rank of RANKS) {
        const rankCards = deck.filter((c) => c.rank === rank);
        expect(rankCards.length).toBe(4);
      }
    });

    it('createDeck 每张牌应唯一', () => {
      const deck = VideoPokerEngine.createDeck();
      const keys = new Set(deck.map((c) => `${c.suit}-${c.rank}`));
      expect(keys.size).toBe(52);
    });

    it('shuffleDeck 应返回52张牌', () => {
      const deck = VideoPokerEngine.createDeck();
      const shuffled = VideoPokerEngine.shuffleDeck(deck);
      expect(shuffled.length).toBe(52);
    });

    it('shuffleDeck 不应修改原数组', () => {
      const deck = VideoPokerEngine.createDeck();
      const original = [...deck];
      VideoPokerEngine.shuffleDeck(deck);
      expect(deck).toEqual(original);
    });

    it('shuffleDeck 应打乱顺序（概率性测试）', () => {
      const deck = VideoPokerEngine.createDeck();
      const shuffled = VideoPokerEngine.shuffleDeck(deck);
      // 至少有一张牌位置不同（极低概率全部相同）
      let sameCount = 0;
      for (let i = 0; i < deck.length; i++) {
        if (deck[i].suit === shuffled[i].suit && deck[i].rank === shuffled[i].rank) {
          sameCount++;
        }
      }
      expect(sameCount).toBeLessThan(52);
    });

    it('shuffleDeck 应保持所有牌不变', () => {
      const deck = VideoPokerEngine.createDeck();
      const shuffled = VideoPokerEngine.shuffleDeck(deck);
      const originalKeys = new Set(deck.map((c) => `${c.suit}-${c.rank}`));
      const shuffledKeys = new Set(shuffled.map((c) => `${c.suit}-${c.rank}`));
      expect(shuffledKeys).toEqual(originalKeys);
    });

    it('drawCard 应从牌组顶部取一张', () => {
      engine.init(canvas);
      engine.start();
      const deckBefore = engine.getDeckSize();
      const card = engine.drawCard();
      expect(card).toBeDefined();
      expect(engine.getDeckSize()).toBe(deckBefore - 1);
    });

    it('drawCard 在空牌组时应返回 undefined', () => {
      engine.init(canvas);
      engine.setDeck([]);
      expect(engine.drawCard()).toBeUndefined();
    });
  });

  // ========== 3. 牌型判定测试 ==========

  describe('Hand Evaluation', () => {
    it('皇家同花顺 (Royal Flush)', () => {
      expect(VideoPokerEngine.evaluateHand(makeRoyalFlush())).toBe(HandRank.ROYAL_FLUSH);
    });

    it('同花顺 (Straight Flush)', () => {
      expect(VideoPokerEngine.evaluateHand(makeStraightFlush())).toBe(HandRank.STRAIGHT_FLUSH);
    });

    it('四条 (Four of a Kind)', () => {
      expect(VideoPokerEngine.evaluateHand(makeFourOfAKind())).toBe(HandRank.FOUR_OF_A_KIND);
    });

    it('葫芦 (Full House)', () => {
      expect(VideoPokerEngine.evaluateHand(makeFullHouse())).toBe(HandRank.FULL_HOUSE);
    });

    it('同花 (Flush)', () => {
      expect(VideoPokerEngine.evaluateHand(makeFlush())).toBe(HandRank.FLUSH);
    });

    it('顺子 (Straight)', () => {
      // makeStraight 返回不同花色的连续牌，判定为顺子
      expect(VideoPokerEngine.evaluateHand(makeStraight())).toBe(HandRank.STRAIGHT);
    });

    it('非同花顺子 (Straight)', () => {
      const cards: Card[] = [
        makeCard('hearts', 4),
        makeCard('diamonds', 5),
        makeCard('clubs', 6),
        makeCard('spades', 7),
        makeCard('diamonds', 8),
      ];
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.STRAIGHT);
    });

    it('三条 (Three of a Kind)', () => {
      expect(VideoPokerEngine.evaluateHand(makeThreeOfAKind())).toBe(HandRank.THREE_OF_A_KIND);
    });

    it('两对 (Two Pair)', () => {
      expect(VideoPokerEngine.evaluateHand(makeTwoPair())).toBe(HandRank.TWO_PAIR);
    });

    it('一对J (Jacks or Better)', () => {
      expect(VideoPokerEngine.evaluateHand(makeJacksOrBetter())).toBe(HandRank.JACKS_OR_BETTER);
    });

    it('一对Q 应判定为 Jacks or Better', () => {
      const cards: Card[] = [
        makeCard('hearts', 12),
        makeCard('diamonds', 12),
        makeCard('clubs', 3),
        makeCard('spades', 5),
        makeCard('hearts', 8),
      ];
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.JACKS_OR_BETTER);
    });

    it('一对K 应判定为 Jacks or Better', () => {
      const cards: Card[] = [
        makeCard('hearts', 13),
        makeCard('diamonds', 13),
        makeCard('clubs', 3),
        makeCard('spades', 5),
        makeCard('hearts', 8),
      ];
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.JACKS_OR_BETTER);
    });

    it('一对A 应判定为 Jacks or Better', () => {
      const cards: Card[] = [
        makeCard('hearts', 14),
        makeCard('diamonds', 14),
        makeCard('clubs', 3),
        makeCard('spades', 5),
        makeCard('hearts', 8),
      ];
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.JACKS_OR_BETTER);
    });

    it('一对5 应判定为高牌（不是 Jacks or Better）', () => {
      expect(VideoPokerEngine.evaluateHand(makeLowPair())).toBe(HandRank.HIGH_CARD);
    });

    it('一对10 应判定为高牌', () => {
      const cards: Card[] = [
        makeCard('hearts', 10),
        makeCard('diamonds', 10),
        makeCard('clubs', 3),
        makeCard('spades', 5),
        makeCard('hearts', 8),
      ];
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.HIGH_CARD);
    });

    it('高牌 (High Card)', () => {
      expect(VideoPokerEngine.evaluateHand(makeHighCard())).toBe(HandRank.HIGH_CARD);
    });

    it('A-2-3-4-5 顺子 (Wheel)', () => {
      const cards = makeWheelStraight();
      // 检查是否同花
      const allSameSuit = cards.every(c => c.suit === cards[0].suit);
      if (!allSameSuit) {
        expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.STRAIGHT);
      }
    });

    it('A-2-3-4-5 同花顺 (Wheel Straight Flush)', () => {
      expect(VideoPokerEngine.evaluateHand(makeWheelStraightFlush())).toBe(HandRank.STRAIGHT_FLUSH);
    });

    it('10-J-Q-K-A 非同花应为顺子', () => {
      const cards: Card[] = [
        makeCard('hearts', 10),
        makeCard('diamonds', 11),
        makeCard('clubs', 12),
        makeCard('spades', 13),
        makeCard('hearts', 14),
      ];
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.STRAIGHT);
    });

    it('不足5张牌应返回高牌', () => {
      expect(VideoPokerEngine.evaluateHand([makeCard('hearts', 14)])).toBe(HandRank.HIGH_CARD);
    });

    it('空数组应返回高牌', () => {
      expect(VideoPokerEngine.evaluateHand([])).toBe(HandRank.HIGH_CARD);
    });

    it('不同花色的同花顺', () => {
      const cards: Card[] = [
        makeCard('hearts', 6),
        makeCard('hearts', 7),
        makeCard('hearts', 8),
        makeCard('hearts', 9),
        makeCard('hearts', 10),
      ];
      // 6-7-8-9-10 同花，是同花顺，不是皇家同花顺
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.STRAIGHT_FLUSH);
    });

    it('非连续的同花应判定为同花', () => {
      expect(VideoPokerEngine.evaluateHand(makeFlush())).toBe(HandRank.FLUSH);
    });
  });

  // ========== 4. 赔率计算测试 ==========

  describe('Payout Calculation', () => {
    it('皇家同花顺 800x', () => {
      const result = VideoPokerEngine.calculateWinnings(makeRoyalFlush(), 5);
      expect(result.handRank).toBe(HandRank.ROYAL_FLUSH);
      expect(result.win).toBe(5 * 800);
    });

    it('同花顺 50x', () => {
      const result = VideoPokerEngine.calculateWinnings(makeStraightFlush(), 3);
      expect(result.handRank).toBe(HandRank.STRAIGHT_FLUSH);
      expect(result.win).toBe(3 * 50);
    });

    it('四条 25x', () => {
      const result = VideoPokerEngine.calculateWinnings(makeFourOfAKind(), 2);
      expect(result.handRank).toBe(HandRank.FOUR_OF_A_KIND);
      expect(result.win).toBe(2 * 25);
    });

    it('葫芦 9x', () => {
      const result = VideoPokerEngine.calculateWinnings(makeFullHouse(), 4);
      expect(result.handRank).toBe(HandRank.FULL_HOUSE);
      expect(result.win).toBe(4 * 9);
    });

    it('同花 6x', () => {
      const result = VideoPokerEngine.calculateWinnings(makeFlush(), 1);
      expect(result.handRank).toBe(HandRank.FLUSH);
      expect(result.win).toBe(1 * 6);
    });

    it('顺子 4x', () => {
      const cards: Card[] = [
        makeCard('hearts', 4),
        makeCard('diamonds', 5),
        makeCard('clubs', 6),
        makeCard('spades', 7),
        makeCard('diamonds', 8),
      ];
      const result = VideoPokerEngine.calculateWinnings(cards, 5);
      expect(result.handRank).toBe(HandRank.STRAIGHT);
      expect(result.win).toBe(5 * 4);
    });

    it('三条 3x', () => {
      const result = VideoPokerEngine.calculateWinnings(makeThreeOfAKind(), 3);
      expect(result.handRank).toBe(HandRank.THREE_OF_A_KIND);
      expect(result.win).toBe(3 * 3);
    });

    it('两对 2x', () => {
      const result = VideoPokerEngine.calculateWinnings(makeTwoPair(), 4);
      expect(result.handRank).toBe(HandRank.TWO_PAIR);
      expect(result.win).toBe(4 * 2);
    });

    it('一对J+ 1x', () => {
      const result = VideoPokerEngine.calculateWinnings(makeJacksOrBetter(), 5);
      expect(result.handRank).toBe(HandRank.JACKS_OR_BETTER);
      expect(result.win).toBe(5 * 1);
    });

    it('高牌 0x', () => {
      const result = VideoPokerEngine.calculateWinnings(makeHighCard(), 5);
      expect(result.handRank).toBe(HandRank.HIGH_CARD);
      expect(result.win).toBe(0);
    });

    it('下注为1时的赔率', () => {
      expect(VideoPokerEngine.calculateWinnings(makeFourOfAKind(), 1).win).toBe(25);
    });

    it('下注为5时皇家同花顺', () => {
      expect(VideoPokerEngine.calculateWinnings(makeRoyalFlush(), 5).win).toBe(4000);
    });

    it('PAYOUT_TABLE 应包含所有牌型', () => {
      expect(PAYOUT_TABLE[HandRank.ROYAL_FLUSH]).toBe(800);
      expect(PAYOUT_TABLE[HandRank.STRAIGHT_FLUSH]).toBe(50);
      expect(PAYOUT_TABLE[HandRank.FOUR_OF_A_KIND]).toBe(25);
      expect(PAYOUT_TABLE[HandRank.FULL_HOUSE]).toBe(9);
      expect(PAYOUT_TABLE[HandRank.FLUSH]).toBe(6);
      expect(PAYOUT_TABLE[HandRank.STRAIGHT]).toBe(4);
      expect(PAYOUT_TABLE[HandRank.THREE_OF_A_KIND]).toBe(3);
      expect(PAYOUT_TABLE[HandRank.TWO_PAIR]).toBe(2);
      expect(PAYOUT_TABLE[HandRank.JACKS_OR_BETTER]).toBe(1);
      expect(PAYOUT_TABLE[HandRank.HIGH_CARD]).toBe(0);
    });
  });

  // ========== 5. 游戏流程测试 ==========

  describe('Game Flow', () => {
    it('初始化后状态应为 idle', () => {
      engine.init(canvas);
      expect(engine.getPhase()).toBe(GamePhase.IDLE);
    });

    it('初始化后筹码应为默认值', () => {
      engine.init(canvas);
      expect(engine.getCredits()).toBe(DEFAULT_CREDITS);
    });

    it('初始化后下注应为最小值', () => {
      engine.init(canvas);
      expect(engine.getBet()).toBe(MIN_BET);
    });

    it('start 后应自动发牌', () => {
      engine.init(canvas);
      engine.start();
      expect(engine.getPhase()).toBe(GamePhase.HOLDING);
    });

    it('start 后应有5张手牌', () => {
      engine.init(canvas);
      engine.start();
      const hand = engine.getHand();
      expect(hand.length).toBe(HAND_SIZE);
      expect(hand.every(c => c !== null)).toBe(true);
    });

    it('start 后所有牌不应被保留', () => {
      engine.init(canvas);
      engine.start();
      expect(engine.getHeld().every(h => h === false)).toBe(true);
    });

    it('start 后应扣除下注筹码', () => {
      engine.init(canvas);
      engine.start();
      expect(engine.getCredits()).toBe(DEFAULT_CREDITS - MIN_BET);
    });

    it('deal 应扣除下注筹码', () => {
      engine.init(canvas);
      const creditsBefore = engine.getCredits();
      engine.deal();
      expect(engine.getCredits()).toBe(creditsBefore - engine.getBet());
    });

    it('筹码不足时 deal 不应执行', () => {
      engine.init(canvas);
      engine.setCredits(0);
      engine.deal();
      expect(engine.getPhase()).toBe(GamePhase.IDLE);
    });

    it('draw 应替换未保留的牌', () => {
      engine.init(canvas);
      engine.start();
      // 保留第1张和第3张
      engine.toggleHold(0);
      engine.toggleHold(2);
      const heldCard0 = engine.getHand()[0];
      const heldCard2 = engine.getHand()[2];
      engine.draw();
      const hand = engine.getHand();
      expect(hand[0]).toEqual(heldCard0);
      expect(hand[2]).toEqual(heldCard2);
    });

    it('draw 后应判定牌型', () => {
      engine.init(canvas);
      engine.start();
      engine.draw();
      expect(engine.getHandRank()).not.toBeNull();
    });

    it('draw 后应进入 RESULT 阶段', () => {
      engine.init(canvas);
      engine.start();
      engine.draw();
      expect(engine.getPhase()).toBe(GamePhase.RESULT);
    });

    it('newRound 后应进入 IDLE 阶段', () => {
      engine.init(canvas);
      engine.start();
      engine.draw();
      engine.newRound();
      expect(engine.getPhase()).toBe(GamePhase.IDLE);
    });

    it('newRound 后手牌应为空', () => {
      engine.init(canvas);
      engine.start();
      engine.draw();
      engine.newRound();
      expect(engine.getHand().every(c => c === null)).toBe(true);
    });

    it('newRound 后 lastWin 应为0', () => {
      engine.init(canvas);
      engine.start();
      engine.draw();
      engine.newRound();
      expect(engine.getLastWin()).toBe(0);
    });
  });

  // ========== 6. 保留/换牌测试 ==========

  describe('Hold / Draw', () => {
    beforeEach(() => {
      engine.init(canvas);
      engine.start();
    });

    it('toggleHold 应切换保留状态', () => {
      expect(engine.getHeld()[0]).toBe(false);
      engine.toggleHold(0);
      expect(engine.getHeld()[0]).toBe(true);
      engine.toggleHold(0);
      expect(engine.getHeld()[0]).toBe(false);
    });

    it('toggleHold 应支持多个位置', () => {
      engine.toggleHold(0);
      engine.toggleHold(2);
      engine.toggleHold(4);
      const held = engine.getHeld();
      expect(held[0]).toBe(true);
      expect(held[1]).toBe(false);
      expect(held[2]).toBe(true);
      expect(held[3]).toBe(false);
      expect(held[4]).toBe(true);
    });

    it('toggleHold 在非 HOLDING 阶段不应生效', () => {
      engine.draw(); // 进入 RESULT
      const heldBefore = engine.getHeld();
      engine.toggleHold(0);
      expect(engine.getHeld()).toEqual(heldBefore);
    });

    it('toggleHold 越界索引不应报错', () => {
      expect(() => engine.toggleHold(-1)).not.toThrow();
      expect(() => engine.toggleHold(5)).not.toThrow();
      expect(() => engine.toggleHold(100)).not.toThrow();
    });

    it('全部保留后 draw 不应换牌', () => {
      const originalHand = engine.getHand();
      for (let i = 0; i < HAND_SIZE; i++) {
        engine.toggleHold(i);
      }
      engine.draw();
      expect(engine.getHand()).toEqual(originalHand);
    });

    it('全部不保留后 draw 应换掉所有牌', () => {
      const originalHand = engine.getHand();
      engine.draw();
      const newHand = engine.getHand();
      // 牌组是随机的，但至少检查结构正确
      expect(newHand.length).toBe(HAND_SIZE);
      expect(newHand.every(c => c !== null)).toBe(true);
    });

    it('draw 在非 HOLDING 阶段不应执行', () => {
      engine.draw(); // 进入 RESULT
      const phaseBefore = engine.getPhase();
      engine.draw(); // 应无效
      expect(engine.getPhase()).toBe(phaseBefore);
    });
  });

  // ========== 7. 筹码系统测试 ==========

  describe('Credits System', () => {
    beforeEach(() => {
      engine.init(canvas);
    });

    it('初始筹码应为1000', () => {
      expect(engine.getCredits()).toBe(DEFAULT_CREDITS);
    });

    it('adjustBet 增加下注', () => {
      engine.adjustBet(1);
      expect(engine.getBet()).toBe(2);
    });

    it('adjustBet 减少下注', () => {
      engine.setCredits(100);
      engine.adjustBet(4); // bet = 5
      engine.adjustBet(-1); // bet = 4
      expect(engine.getBet()).toBe(4);
    });

    it('下注不应超过 MAX_BET', () => {
      engine.adjustBet(10);
      expect(engine.getBet()).toBe(MAX_BET);
    });

    it('下注不应低于 MIN_BET', () => {
      engine.adjustBet(-10);
      expect(engine.getBet()).toBe(MIN_BET);
    });

    it('下注不应超过当前筹码', () => {
      engine.setCredits(2);
      engine.adjustBet(5);
      expect(engine.getBet()).toBe(2);
    });

    it('赢取筹码应增加余额', () => {
      // 构造一个赢牌场景：手动设置同花牌
      engine.init(canvas);
      const creditsBefore = engine.getCredits();

      // 手动设置：用 setHand 和 setDeck 控制结果
      engine.setPhase(GamePhase.HOLDING);
      engine.setCredits(creditsBefore);
      // 设置一手同花
      const flush = makeFlush();
      engine.setHand(flush);
      engine.setHeld([true, true, true, true, true]);
      engine.setDeck([]);

      engine.draw();
      // 同花应赢得 bet * 6，draw 不扣筹码，deal 才扣
      // credits = creditsBefore + bet * 6
      expect(engine.getCredits()).toBe(creditsBefore + engine.getBet() * 6);
      expect(engine.getLastWin()).toBe(engine.getBet() * 6);
      expect(engine.getCredits()).toBeGreaterThan(creditsBefore);
    });

    it('连续游戏应正确累计筹码', () => {
      const initialCredits = engine.getCredits();
      engine.deal();
      expect(engine.getCredits()).toBe(initialCredits - engine.getBet());
      engine.draw();
      // 无论输赢，credits 应该已更新
      const afterFirstRound = engine.getCredits();
      engine.newRound();
      engine.deal();
      expect(engine.getCredits()).toBe(afterFirstRound - engine.getBet());
    });

    it('筹码为0时重置为默认值', () => {
      // 模拟筹码为0的情况
      engine.setCredits(0);
      engine.setPhase(GamePhase.RESULT);
      engine.newRound();
      expect(engine.getCredits()).toBe(DEFAULT_CREDITS);
    });

    it('adjustBet 在 HOLDING 阶段不应生效', () => {
      engine.deal();
      const betBefore = engine.getBet();
      engine.adjustBet(1);
      expect(engine.getBet()).toBe(betBefore);
    });
  });

  // ========== 8. 键盘控制测试 ==========

  describe('Keyboard Controls', () => {
    beforeEach(() => {
      engine.init(canvas);
    });

    it('空格键在 IDLE 阶段应发牌', () => {
      engine.handleKeyDown(' ');
      expect(engine.getPhase()).toBe(GamePhase.HOLDING);
    });

    it('Enter 键在 IDLE 阶段应发牌', () => {
      engine.handleKeyDown('Enter');
      expect(engine.getPhase()).toBe(GamePhase.HOLDING);
    });

    it('数字键1-5 应切换保留状态', () => {
      engine.handleKeyDown(' ');
      engine.handleKeyDown('1');
      expect(engine.getHeld()[0]).toBe(true);
      engine.handleKeyDown('1');
      expect(engine.getHeld()[0]).toBe(false);
    });

    it('数字键2 应切换第2张牌保留', () => {
      engine.handleKeyDown(' ');
      engine.handleKeyDown('2');
      expect(engine.getHeld()[1]).toBe(true);
    });

    it('数字键3 应切换第3张牌保留', () => {
      engine.handleKeyDown(' ');
      engine.handleKeyDown('3');
      expect(engine.getHeld()[2]).toBe(true);
    });

    it('数字键4 应切换第4张牌保留', () => {
      engine.handleKeyDown(' ');
      engine.handleKeyDown('4');
      expect(engine.getHeld()[3]).toBe(true);
    });

    it('数字键5 应切换第5张牌保留', () => {
      engine.handleKeyDown(' ');
      engine.handleKeyDown('5');
      expect(engine.getHeld()[4]).toBe(true);
    });

    it('空格键在 HOLDING 阶段应换牌', () => {
      engine.handleKeyDown(' ');
      engine.handleKeyDown(' ');
      expect(engine.getPhase()).toBe(GamePhase.RESULT);
    });

    it('Enter 键在 HOLDING 阶段应换牌', () => {
      engine.handleKeyDown(' ');
      engine.handleKeyDown('Enter');
      expect(engine.getPhase()).toBe(GamePhase.RESULT);
    });

    it('空格键在 RESULT 阶段应开始新一局', () => {
      engine.handleKeyDown(' ');
      engine.handleKeyDown(' ');
      expect(engine.getPhase()).toBe(GamePhase.RESULT);
      engine.handleKeyDown(' ');
      expect(engine.getPhase()).toBe(GamePhase.HOLDING);
    });

    it('ArrowUp 应增加下注', () => {
      engine.handleKeyDown('ArrowUp');
      expect(engine.getBet()).toBe(2);
    });

    it('ArrowDown 应减少下注', () => {
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowDown');
      expect(engine.getBet()).toBe(1);
    });

    it('ArrowDown 不应使下注低于1', () => {
      engine.handleKeyDown('ArrowDown');
      expect(engine.getBet()).toBe(1);
    });

    it('ArrowUp 不应使下注超过5', () => {
      for (let i = 0; i < 10; i++) engine.handleKeyDown('ArrowUp');
      expect(engine.getBet()).toBe(5);
    });

    it('handleKeyUp 不应报错', () => {
      expect(() => engine.handleKeyUp(' ')).not.toThrow();
      expect(() => engine.handleKeyUp('ArrowUp')).not.toThrow();
    });
  });

  // ========== 9. getState 测试 ==========

  describe('getState', () => {
    it('应返回完整的游戏状态', () => {
      engine.init(canvas);
      const state = engine.getState();
      expect(state).toHaveProperty('phase');
      expect(state).toHaveProperty('hand');
      expect(state).toHaveProperty('held');
      expect(state).toHaveProperty('credits');
      expect(state).toHaveProperty('bet');
      expect(state).toHaveProperty('lastWin');
      expect(state).toHaveProperty('handRank');
      expect(state).toHaveProperty('deckSize');
    });

    it('初始状态应正确', () => {
      engine.init(canvas);
      const state = engine.getState();
      expect(state.phase).toBe(GamePhase.IDLE);
      expect(state.credits).toBe(DEFAULT_CREDITS);
      expect(state.bet).toBe(MIN_BET);
      expect(state.lastWin).toBe(0);
      expect(state.handRank).toBeNull();
    });

    it('发牌后状态应更新', () => {
      engine.init(canvas);
      engine.deal();
      const state = engine.getState();
      expect(state.phase).toBe(GamePhase.HOLDING);
      expect((state.hand as (Card | null)[]).every(c => c !== null)).toBe(true);
    });
  });

  // ========== 10. 事件系统测试 ==========

  describe('Event System', () => {
    it('deal 应触发 stateChange 事件', () => {
      engine.init(canvas);
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.deal();
      expect(listener).toHaveBeenCalled();
    });

    it('toggleHold 应触发 stateChange 事件', () => {
      engine.init(canvas);
      engine.deal();
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.toggleHold(0);
      expect(listener).toHaveBeenCalled();
    });

    it('draw 应触发 stateChange 事件', () => {
      engine.init(canvas);
      engine.deal();
      const listener = vi.fn();
      engine.on('stateChange', listener);
      engine.draw();
      expect(listener).toHaveBeenCalled();
    });
  });

  // ========== 11. 边界情况测试 ==========

  describe('Edge Cases', () => {
    it('连续多次 deal 不应崩溃', () => {
      engine.init(canvas);
      engine.deal();
      // 第二次 deal 在 HOLDING 阶段不应执行
      engine.deal();
      expect(engine.getPhase()).toBe(GamePhase.HOLDING);
    });

    it('筹码刚好等于下注时可以发牌', () => {
      engine.init(canvas);
      engine.setCredits(MIN_BET);
      engine.deal();
      expect(engine.getPhase()).toBe(GamePhase.HOLDING);
      expect(engine.getCredits()).toBe(0);
    });

    it('筹码为0时不能发牌', () => {
      engine.init(canvas);
      engine.setCredits(0);
      engine.deal();
      expect(engine.getPhase()).toBe(GamePhase.IDLE);
    });

    it('reset 后应恢复初始状态', () => {
      engine.init(canvas);
      engine.start();
      engine.toggleHold(0);
      engine.draw();
      engine.reset();
      expect(engine.getPhase()).toBe(GamePhase.IDLE);
      expect(engine.getCredits()).toBe(DEFAULT_CREDITS);
    });

    it('destroy 后不应崩溃', () => {
      engine.init(canvas);
      engine.start();
      expect(() => engine.destroy()).not.toThrow();
    });

    it('多次 init 不应崩溃', () => {
      engine.init(canvas);
      engine.init(canvas);
      engine.init(canvas);
      expect(engine.getPhase()).toBe(GamePhase.IDLE);
    });

    it('setHand 应正确设置手牌', () => {
      engine.init(canvas);
      const cards = makeRoyalFlush();
      engine.setHand(cards);
      expect(engine.getHand()).toEqual(cards);
    });

    it('setHeld 应正确设置保留状态', () => {
      engine.init(canvas);
      engine.setHeld([true, false, true, false, true]);
      expect(engine.getHeld()).toEqual([true, false, true, false, true]);
    });

    it('setCredits 应正确设置筹码', () => {
      engine.init(canvas);
      engine.setCredits(500);
      expect(engine.getCredits()).toBe(500);
    });

    it('setPhase 应正确设置阶段', () => {
      engine.init(canvas);
      engine.setPhase(GamePhase.HOLDING);
      expect(engine.getPhase()).toBe(GamePhase.HOLDING);
    });

    it('setDeck 应正确设置牌组', () => {
      engine.init(canvas);
      const deck = VideoPokerEngine.createDeck();
      engine.setDeck(deck);
      expect(engine.getDeckSize()).toBe(52);
    });
  });

  // ========== 12. 完整游戏流程测试 ==========

  describe('Full Game Scenarios', () => {
    it('完整一局：发牌 → 保留 → 换牌 → 结果', () => {
      engine.init(canvas);
      expect(engine.getPhase()).toBe(GamePhase.IDLE);

      engine.deal();
      expect(engine.getPhase()).toBe(GamePhase.HOLDING);
      const creditsAfterDeal = engine.getCredits();

      engine.toggleHold(0);
      engine.toggleHold(2);

      engine.draw();
      expect(engine.getPhase()).toBe(GamePhase.RESULT);
      expect(engine.getHandRank()).not.toBeNull();

      // 如果赢了，credits 应该增加
      if (engine.getLastWin() > 0) {
        expect(engine.getCredits()).toBeGreaterThan(creditsAfterDeal);
      }
    });

    it('多局游戏应正常工作', () => {
      engine.init(canvas);

      for (let round = 0; round < 3; round++) {
        engine.deal();
        expect(engine.getPhase()).toBe(GamePhase.HOLDING);

        engine.toggleHold(0);
        engine.draw();
        expect(engine.getPhase()).toBe(GamePhase.RESULT);

        engine.newRound();
        expect(engine.getPhase()).toBe(GamePhase.IDLE);
      }
    });

    it('通过键盘完成完整一局', () => {
      engine.init(canvas);

      // 空格发牌
      engine.handleKeyDown(' ');
      expect(engine.getPhase()).toBe(GamePhase.HOLDING);

      // 保留第1、3张
      engine.handleKeyDown('1');
      engine.handleKeyDown('3');

      // 空格换牌
      engine.handleKeyDown(' ');
      expect(engine.getPhase()).toBe(GamePhase.RESULT);

      // 空格新一局
      engine.handleKeyDown(' ');
      expect(engine.getPhase()).toBe(GamePhase.HOLDING);
    });

    it('调整下注后发牌', () => {
      engine.init(canvas);

      // 增加下注到3
      engine.handleKeyDown('ArrowUp');
      engine.handleKeyDown('ArrowUp');
      expect(engine.getBet()).toBe(3);

      // 发牌
      engine.handleKeyDown(' ');
      expect(engine.getCredits()).toBe(DEFAULT_CREDITS - 3);
    });
  });

  // ========== 13. 牌型名称测试 ==========

  describe('Hand Rank Names', () => {
    it('所有牌型都应有中文名', () => {
      for (const rank of Object.values(HandRank)) {
        expect(HAND_RANK_NAMES[rank]).toBeDefined();
        expect(HAND_RANK_NAMES[rank].length).toBeGreaterThan(0);
      }
    });

    it('皇家同花顺名称正确', () => {
      expect(HAND_RANK_NAMES[HandRank.ROYAL_FLUSH]).toBe('皇家同花顺');
    });

    it('同花顺名称正确', () => {
      expect(HAND_RANK_NAMES[HandRank.STRAIGHT_FLUSH]).toBe('同花顺');
    });

    it('四条名称正确', () => {
      expect(HAND_RANK_NAMES[HandRank.FOUR_OF_A_KIND]).toBe('四条');
    });

    it('葫芦名称正确', () => {
      expect(HAND_RANK_NAMES[HandRank.FULL_HOUSE]).toBe('葫芦');
    });

    it('同花名称正确', () => {
      expect(HAND_RANK_NAMES[HandRank.FLUSH]).toBe('同花');
    });

    it('顺子名称正确', () => {
      expect(HAND_RANK_NAMES[HandRank.STRAIGHT]).toBe('顺子');
    });

    it('三条名称正确', () => {
      expect(HAND_RANK_NAMES[HandRank.THREE_OF_A_KIND]).toBe('三条');
    });

    it('两对名称正确', () => {
      expect(HAND_RANK_NAMES[HandRank.TWO_PAIR]).toBe('两对');
    });

    it('一对J+名称正确', () => {
      expect(HAND_RANK_NAMES[HandRank.JACKS_OR_BETTER]).toBe('一对(J+)');
    });

    it('高牌名称正确', () => {
      expect(HAND_RANK_NAMES[HandRank.HIGH_CARD]).toBe('高牌');
    });
  });

  // ========== 14. 访问器测试 ==========

  describe('Accessors', () => {
    it('getHand 应返回副本', () => {
      engine.init(canvas);
      engine.start();
      const hand1 = engine.getHand();
      const hand2 = engine.getHand();
      expect(hand1).toEqual(hand2);
      expect(hand1).not.toBe(hand2);
    });

    it('getHeld 应返回副本', () => {
      engine.init(canvas);
      engine.start();
      const held1 = engine.getHeld();
      const held2 = engine.getHeld();
      expect(held1).toEqual(held2);
      expect(held1).not.toBe(held2);
    });

    it('getDeck 应返回副本', () => {
      engine.init(canvas);
      engine.start();
      const deck1 = engine.getDeck();
      const deck2 = engine.getDeck();
      expect(deck1).toEqual(deck2);
      expect(deck1).not.toBe(deck2);
    });
  });

  // ========== 15. GamePhase 枚举测试 ==========

  describe('GamePhase Enum', () => {
    it('应有所有阶段', () => {
      expect(GamePhase.IDLE).toBe('idle');
      expect(GamePhase.DEALING).toBe('dealing');
      expect(GamePhase.HOLDING).toBe('holding');
      expect(GamePhase.DRAWING).toBe('drawing');
      expect(GamePhase.RESULT).toBe('result');
    });
  });

  // ========== 16. HandRank 枚举测试 ==========

  describe('HandRank Enum', () => {
    it('应有所有牌型', () => {
      expect(HandRank.ROYAL_FLUSH).toBe('royal-flush');
      expect(HandRank.STRAIGHT_FLUSH).toBe('straight-flush');
      expect(HandRank.FOUR_OF_A_KIND).toBe('four-of-a-kind');
      expect(HandRank.FULL_HOUSE).toBe('full-house');
      expect(HandRank.FLUSH).toBe('flush');
      expect(HandRank.STRAIGHT).toBe('straight');
      expect(HandRank.THREE_OF_A_KIND).toBe('three-of-a-kind');
      expect(HandRank.TWO_PAIR).toBe('two-pair');
      expect(HandRank.JACKS_OR_BETTER).toBe('jacks-or-better');
      expect(HandRank.HIGH_CARD).toBe('high-card');
    });
  });

  // ========== 17. 特殊牌型边界测试 ==========

  describe('Special Hand Edge Cases', () => {
    it('K-A-2-3-4 不是顺子', () => {
      const cards: Card[] = [
        makeCard('hearts', 13),
        makeCard('diamonds', 14),
        makeCard('clubs', 2),
        makeCard('spades', 3),
        makeCard('hearts', 4),
      ];
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.HIGH_CARD);
    });

    it('J-Q-K-A-2 不是顺子', () => {
      const cards: Card[] = [
        makeCard('hearts', 11),
        makeCard('diamonds', 12),
        makeCard('clubs', 13),
        makeCard('spades', 14),
        makeCard('hearts', 2),
      ];
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.HIGH_CARD);
    });

    it('2-3-4-5-6 顺子', () => {
      const cards: Card[] = [
        makeCard('hearts', 2),
        makeCard('diamonds', 3),
        makeCard('clubs', 4),
        makeCard('spades', 5),
        makeCard('diamonds', 6),
      ];
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.STRAIGHT);
    });

    it('10-J-Q-K-A 皇家同花顺', () => {
      expect(VideoPokerEngine.evaluateHand(makeRoyalFlush())).toBe(HandRank.ROYAL_FLUSH);
    });

    it('9-10-J-Q-K 同花顺', () => {
      const cards: Card[] = [
        makeCard('spades', 9),
        makeCard('spades', 10),
        makeCard('spades', 11),
        makeCard('spades', 12),
        makeCard('spades', 13),
      ];
      expect(VideoPokerEngine.evaluateHand(cards)).toBe(HandRank.STRAIGHT_FLUSH);
    });

    it('两对不应被误判为三条', () => {
      expect(VideoPokerEngine.evaluateHand(makeTwoPair())).toBe(HandRank.TWO_PAIR);
    });

    it('三条不应被误判为葫芦', () => {
      expect(VideoPokerEngine.evaluateHand(makeThreeOfAKind())).toBe(HandRank.THREE_OF_A_KIND);
    });
  });

  // ========== 18. 渲染测试 ==========

  describe('Rendering', () => {
    it('onRender 在 IDLE 阶段不应崩溃', () => {
      engine.init(canvas);
      expect(() => engine.start()).not.toThrow();
    });

    it('onRender 在 RESULT 阶段不应崩溃', () => {
      engine.init(canvas);
      engine.start();
      engine.draw();
      // 渲染在 gameLoop 中自动调用
      expect(engine.getPhase()).toBe(GamePhase.RESULT);
    });
  });

  // ========== 19. Score 和 Level 集成测试 ==========

  describe('Score Integration', () => {
    it('赢牌时 score 应增加', () => {
      engine.init(canvas);
      engine.start();
      const scoreBefore = engine.score;
      engine.draw();
      if (engine.getLastWin() > 0) {
        expect(engine.score).toBe(scoreBefore + engine.getLastWin());
      }
    });

    it('初始 score 应为0', () => {
      const eng = new VideoPokerEngine();
      eng.init(canvas);
      expect(eng.score).toBe(0);
    });
  });
});
