/**
 * 21点 Blackjack 引擎完整测试
 * 覆盖：牌组生成/洗牌、发牌、点数计算、要牌/停牌/加倍、庄家AI、
 *       筹码系统、Blackjack判定、爆牌、胜负判定
 */

import {
  SUITS,
  RANKS,
  type Suit,
  type Rank,
  getCardColor,
  INITIAL_CHIPS,
  MIN_BET,
  MAX_BET,
  BET_STEP,
  DEALER_STAND_THRESHOLD,
  BLACKJACK_PAYOUT,
  BUST_THRESHOLD,
  BLACKJACK_VALUE,
  GamePhase,
  GameResult,
} from '../constants';
import {
  createDeck,
  createShoe,
  shuffleDeck,
  calculateHandValue,
  isBlackjack,
  isBust,
  canDoubleDown,
  BlackjackEngine,
  type Card,
} from '../BlackjackEngine';

// ========== Mock canvas 和 requestAnimationFrame ==========

function createMockCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  return canvas;
}

beforeAll(() => {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => 0) as any;
  globalThis.cancelAnimationFrame = (() => {}) as any;
});

// ========== 辅助函数 ==========

/** 创建一张牌 */
function makeCard(suit: Suit, rank: Rank, faceUp = true): Card {
  return { suit, rank, faceUp };
}

/** 创建指定点数的手牌（用于测试） */
function makeHand(...cards: Card[]): Card[] {
  return cards;
}

/** 创建引擎并初始化 */
function createEngine(): BlackjackEngine {
  const engine = new BlackjackEngine();
  const canvas = createMockCanvas();
  engine.setCanvas(canvas);
  engine.init();
  return engine;
}

/** 创建引擎，开始游戏，下注并进入玩家回合 */
function createEngineAndDeal(): BlackjackEngine {
  const engine = createEngine();
  engine.start();
  // start() 会调用 startNewRound() 进入 BETTING 阶段
  engine.placeBet();
  return engine;
}

// ====================================================================
// 1. 牌组生成与洗牌测试
// ====================================================================

describe('牌组生成与洗牌', () => {
  it('createDeck 应生成52张牌', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('createDeck 应包含4种花色', () => {
    const deck = createDeck();
    const suits = new Set(deck.map(c => c.suit));
    expect(suits.size).toBe(4);
    for (const suit of SUITS) {
      expect(suits.has(suit)).toBe(true);
    }
  });

  it('createDeck 应包含13种面值', () => {
    const deck = createDeck();
    const ranks = new Set(deck.map(c => c.rank));
    expect(ranks.size).toBe(13);
    for (const rank of RANKS) {
      expect(ranks.has(rank)).toBe(true);
    }
  });

  it('createDeck 每种花色应有13张牌', () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      const suitCards = deck.filter(c => c.suit === suit);
      expect(suitCards).toHaveLength(13);
    }
  });

  it('createDeck 所有牌默认正面朝上', () => {
    const deck = createDeck();
    for (const card of deck) {
      expect(card.faceUp).toBe(true);
    }
  });

  it('createDeck 不应有重复牌', () => {
    const deck = createDeck();
    const keys = deck.map(c => `${c.suit}${c.rank}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(52);
  });

  it('createShoe(1) 应生成52张牌', () => {
    const shoe = createShoe(1);
    expect(shoe).toHaveLength(52);
  });

  it('createShoe(2) 应生成104张牌', () => {
    const shoe = createShoe(2);
    expect(shoe).toHaveLength(104);
  });

  it('createShoe(6) 应生成312张牌', () => {
    const shoe = createShoe(6);
    expect(shoe).toHaveLength(312);
  });

  it('createShoe(0) 应生成0张牌', () => {
    const shoe = createShoe(0);
    expect(shoe).toHaveLength(0);
  });

  it('shuffleDeck 应返回相同长度的数组', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(52);
  });

  it('shuffleDeck 应包含所有原始牌', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const origKeys = new Set(deck.map(c => `${c.suit}${c.rank}`));
    const shuffKeys = new Set(shuffled.map(c => `${c.suit}${c.rank}`));
    expect(shuffKeys).toEqual(origKeys);
  });

  it('shuffleDeck 不应修改原数组', () => {
    const deck = createDeck();
    const origFirst = deck[0];
    shuffleDeck(deck);
    expect(deck[0]).toEqual(origFirst);
  });

  it('shuffleDeck 应产生不同的排列（概率测试）', () => {
    const deck = createDeck();
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      const shuffled = shuffleDeck([...deck]);
      results.push(shuffled.map(c => c.rank).join(','));
    }
    const uniqueResults = new Set(results);
    // 10次洗牌不太可能都一样
    expect(uniqueResults.size).toBeGreaterThan(1);
  });

  it('getCardColor 红心和方块应为红色', () => {
    expect(getCardColor('♥')).toBe('red');
    expect(getCardColor('♦')).toBe('red');
  });

  it('getCardColor 黑桃和梅花应为黑色', () => {
    expect(getCardColor('♠')).toBe('black');
    expect(getCardColor('♣')).toBe('black');
  });
});

// ====================================================================
// 2. 点数计算测试（含A的1/11选择）
// ====================================================================

describe('点数计算', () => {
  it('空手牌点数为0', () => {
    expect(calculateHandValue([])).toBe(0);
  });

  it('单张数字牌应返回面值', () => {
    expect(calculateHandValue([makeCard('♠', '2')])).toBe(2);
    expect(calculateHandValue([makeCard('♥', '5')])).toBe(5);
    expect(calculateHandValue([makeCard('♦', '9')])).toBe(9);
    expect(calculateHandValue([makeCard('♣', '10')])).toBe(10);
  });

  it('J/Q/K 应返回10', () => {
    expect(calculateHandValue([makeCard('♠', 'J')])).toBe(10);
    expect(calculateHandValue([makeCard('♥', 'Q')])).toBe(10);
    expect(calculateHandValue([makeCard('♦', 'K')])).toBe(10);
  });

  it('单张A 应返回11', () => {
    expect(calculateHandValue([makeCard('♠', 'A')])).toBe(11);
  });

  it('A+6 应为17（A=11）', () => {
    expect(calculateHandValue([makeCard('♠', 'A'), makeCard('♥', '6')])).toBe(17);
  });

  it('A+6+10 应为17（A降为1）', () => {
    expect(calculateHandValue([
      makeCard('♠', 'A'),
      makeCard('♥', '6'),
      makeCard('♦', '10'),
    ])).toBe(17);
  });

  it('A+A 应为12（一个A=11，一个A=1）', () => {
    expect(calculateHandValue([
      makeCard('♠', 'A'),
      makeCard('♥', 'A'),
    ])).toBe(12);
  });

  it('A+A+A 应为13（一个A=11，两个A=1）', () => {
    expect(calculateHandValue([
      makeCard('♠', 'A'),
      makeCard('♥', 'A'),
      makeCard('♦', 'A'),
    ])).toBe(13);
  });

  it('4个A 应为14', () => {
    expect(calculateHandValue([
      makeCard('♠', 'A'),
      makeCard('♥', 'A'),
      makeCard('♦', 'A'),
      makeCard('♣', 'A'),
    ])).toBe(14);
  });

  it('A+K 应为21（Blackjack）', () => {
    expect(calculateHandValue([makeCard('♠', 'A'), makeCard('♥', 'K')])).toBe(21);
  });

  it('A+10 应为21（Blackjack）', () => {
    expect(calculateHandValue([makeCard('♠', 'A'), makeCard('♥', '10')])).toBe(21);
  });

  it('10+5+6 应为21', () => {
    expect(calculateHandValue([
      makeCard('♠', '10'),
      makeCard('♥', '5'),
      makeCard('♦', '6'),
    ])).toBe(21);
  });

  it('K+Q 应为20', () => {
    expect(calculateHandValue([makeCard('♠', 'K'), makeCard('♥', 'Q')])).toBe(20);
  });

  it('10+5+7 应为22（爆牌）', () => {
    expect(calculateHandValue([
      makeCard('♠', '10'),
      makeCard('♥', '5'),
      makeCard('♦', '7'),
    ])).toBe(22);
  });

  it('A+5+7 应为13（A降为1）', () => {
    expect(calculateHandValue([
      makeCard('♠', 'A'),
      makeCard('♥', '5'),
      makeCard('♦', '7'),
    ])).toBe(13);
  });

  it('A+A+9 应为21', () => {
    expect(calculateHandValue([
      makeCard('♠', 'A'),
      makeCard('♥', 'A'),
      makeCard('♦', '9'),
    ])).toBe(21);
  });

  it('A+A+A+A+7 应为21（四个A=1+1+1+1，加7=11... 应该是 11+1+1+1+7=21）', () => {
    // 4个A + 7: 先都当11 = 44+7=51, 4个A降到1: 51-40=11... 不对
    // 重新算: A=11, A=11, A=11, A=11, 7=7 → 51, 超过21
    // 降一个A: 41, 还是超; 降两个: 31, 还是超; 降三个: 21
    expect(calculateHandValue([
      makeCard('♠', 'A'),
      makeCard('♥', 'A'),
      makeCard('♦', 'A'),
      makeCard('♣', 'A'),
      makeCard('♠', '7'),
    ])).toBe(21);
  });

  it('9+7+5 应为21', () => {
    expect(calculateHandValue([
      makeCard('♠', '9'),
      makeCard('♥', '7'),
      makeCard('♦', '5'),
    ])).toBe(21);
  });

  it('A+7+A+8 应为17（两个A都降为1）', () => {
    // A(11) + 7 + A(11) + 8 = 37, 降两个A: 37-20=17
    expect(calculateHandValue([
      makeCard('♠', 'A'),
      makeCard('♥', '7'),
      makeCard('♦', 'A'),
      makeCard('♣', '8'),
    ])).toBe(17);
  });
});

// ====================================================================
// 3. Blackjack 判定测试
// ====================================================================

describe('Blackjack 判定', () => {
  it('A+K 是 Blackjack', () => {
    expect(isBlackjack([makeCard('♠', 'A'), makeCard('♥', 'K')])).toBe(true);
  });

  it('A+Q 是 Blackjack', () => {
    expect(isBlackjack([makeCard('♠', 'A'), makeCard('♥', 'Q')])).toBe(true);
  });

  it('A+J 是 Blackjack', () => {
    expect(isBlackjack([makeCard('♠', 'A'), makeCard('♥', 'J')])).toBe(true);
  });

  it('A+10 是 Blackjack', () => {
    expect(isBlackjack([makeCard('♠', 'A'), makeCard('♥', '10')])).toBe(true);
  });

  it('10+A 是 Blackjack', () => {
    expect(isBlackjack([makeCard('♠', '10'), makeCard('♥', 'A')])).toBe(true);
  });

  it('K+10 不是 Blackjack（虽然21点但不是两张牌组合）', () => {
    // K+10 = 20, 不是21
    expect(isBlackjack([makeCard('♠', 'K'), makeCard('♥', '10')])).toBe(false);
  });

  it('三张21点不是 Blackjack', () => {
    expect(isBlackjack([
      makeCard('♠', '7'),
      makeCard('♥', '7'),
      makeCard('♦', '7'),
    ])).toBe(false);
  });

  it('空手牌不是 Blackjack', () => {
    expect(isBlackjack([])).toBe(false);
  });

  it('一张牌不是 Blackjack', () => {
    expect(isBlackjack([makeCard('♠', 'A')])).toBe(false);
  });
});

// ====================================================================
// 4. 爆牌判定测试
// ====================================================================

describe('爆牌判定', () => {
  it('22点应爆牌', () => {
    expect(isBust([makeCard('♠', 'K'), makeCard('♥', 'Q'), makeCard('♦', '2')])).toBe(true);
  });

  it('21点不应爆牌', () => {
    expect(isBust([makeCard('♠', 'A'), makeCard('♥', 'K')])).toBe(false);
  });

  it('20点不应爆牌', () => {
    expect(isBust([makeCard('♠', 'K'), makeCard('♥', 'Q')])).toBe(false);
  });

  it('空手牌不应爆牌', () => {
    expect(isBust([])).toBe(false);
  });

  it('26点应爆牌', () => {
    expect(isBust([
      makeCard('♠', 'K'),
      makeCard('♥', 'Q'),
      makeCard('♦', 'J'),
    ])).toBe(true);
  });
});

// ====================================================================
// 5. 加倍判定测试
// ====================================================================

describe('加倍判定', () => {
  it('两张牌且筹码足够时可以加倍', () => {
    expect(canDoubleDown(
      [makeCard('♠', '5'), makeCard('♥', '6')],
      1000,
      100
    )).toBe(true);
  });

  it('三张牌时不能加倍', () => {
    expect(canDoubleDown(
      [makeCard('♠', '5'), makeCard('♥', '6'), makeCard('♦', '2')],
      1000,
      100
    )).toBe(false);
  });

  it('一张牌时不能加倍', () => {
    expect(canDoubleDown([makeCard('♠', '5')], 1000, 100)).toBe(false);
  });

  it('空手牌不能加倍', () => {
    expect(canDoubleDown([], 1000, 100)).toBe(false);
  });

  it('筹码不足时不能加倍', () => {
    expect(canDoubleDown(
      [makeCard('♠', '5'), makeCard('♥', '6')],
      50,
      100
    )).toBe(false);
  });

  it('筹码刚好等于赌注时可以加倍', () => {
    expect(canDoubleDown(
      [makeCard('♠', '5'), makeCard('♥', '6')],
      100,
      100
    )).toBe(true);
  });

  it('筹码比赌注少1时不能加倍', () => {
    expect(canDoubleDown(
      [makeCard('♠', '5'), makeCard('♥', '6')],
      99,
      100
    )).toBe(false);
  });
});

// ====================================================================
// 6. 引擎初始化与生命周期测试
// ====================================================================

describe('引擎初始化与生命周期', () => {
  let engine: BlackjackEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it('初始化后应为 idle 状态', () => {
    expect(engine.status).toBe('idle');
  });

  it('初始化后筹码应为1000', () => {
    expect(engine.chips).toBe(INITIAL_CHIPS);
  });

  it('初始化后阶段应为 BETTING', () => {
    expect(engine.phase).toBe(GamePhase.BETTING);
  });

  it('初始化后无结果', () => {
    expect(engine.result).toBeNull();
  });

  it('初始化后分数为0', () => {
    expect(engine.score).toBe(0);
  });

  it('start 后状态应为 playing', () => {
    engine.start();
    expect(engine.status).toBe('playing');
  });

  it('start 后阶段应为 BETTING', () => {
    engine.start();
    expect(engine.phase).toBe(GamePhase.BETTING);
  });

  it('reset 后回到 idle', () => {
    engine.start();
    engine.reset();
    expect(engine.status).toBe('idle');
  });

  it('reset 后筹码恢复初始值', () => {
    engine.start();
    engine.reset();
    expect(engine.chips).toBe(INITIAL_CHIPS);
  });

  it('destroy 后状态为 idle', () => {
    engine.start();
    engine.destroy();
    expect(engine.status).toBe('idle');
  });

  it('getState 应返回游戏状态', () => {
    const state = engine.getState();
    expect(state).toHaveProperty('chips');
    expect(state).toHaveProperty('currentBet');
    expect(state).toHaveProperty('phase');
    expect(state).toHaveProperty('result');
    expect(state).toHaveProperty('playerHand');
    expect(state).toHaveProperty('dealerHand');
    expect(state).toHaveProperty('wins');
    expect(state).toHaveProperty('losses');
    expect(state).toHaveProperty('pushes');
    expect(state).toHaveProperty('blackjacks');
  });

  it('多次 start 不应报错', () => {
    engine.start();
    expect(() => engine.start()).not.toThrow();
  });
});

// ====================================================================
// 7. 下注系统测试
// ====================================================================

describe('下注系统', () => {
  let engine: BlackjackEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('初始赌注应为 MIN_BET', () => {
    expect(engine.currentBet).toBe(MIN_BET);
  });

  it('increaseBet 应增加赌注', () => {
    engine.increaseBet();
    expect(engine.currentBet).toBe(MIN_BET + BET_STEP);
  });

  it('decreaseBet 应减少赌注', () => {
    engine.increaseBet();
    engine.increaseBet();
    engine.decreaseBet();
    expect(engine.currentBet).toBe(MIN_BET + BET_STEP);
  });

  it('赌注不应超过 MAX_BET', () => {
    for (let i = 0; i < 100; i++) {
      engine.increaseBet();
    }
    expect(engine.currentBet).toBe(Math.min(MAX_BET, engine.chips));
  });

  it('赌注不应低于 MIN_BET', () => {
    for (let i = 0; i < 100; i++) {
      engine.decreaseBet();
    }
    expect(engine.currentBet).toBe(MIN_BET);
  });

  it('赌注不应超过当前筹码', () => {
    engine.setBet(9999);
    expect(engine.currentBet).toBeLessThanOrEqual(engine.chips);
  });

  it('setBet 应设置赌注', () => {
    engine.setBet(200);
    expect(engine.currentBet).toBe(200);
  });

  it('setBet 不应低于 MIN_BET', () => {
    engine.setBet(1);
    expect(engine.currentBet).toBe(MIN_BET);
  });

  it('setBet 不应超过 MAX_BET', () => {
    engine.setBet(9999);
    expect(engine.currentBet).toBe(Math.min(MAX_BET, engine.chips));
  });

  it('下注阶段不能 Hit', () => {
    expect(engine.canHit).toBe(false);
  });

  it('下注阶段不能 Stand', () => {
    expect(engine.canStand).toBe(false);
  });

  it('下注阶段不能 Double', () => {
    expect(engine.canDouble).toBe(false);
  });

  it('非下注阶段不能增加赌注', () => {
    engine.placeBet();
    const betBefore = engine.currentBet;
    engine.increaseBet();
    expect(engine.currentBet).toBe(betBefore);
  });

  it('非下注阶段不能减少赌注', () => {
    engine.placeBet();
    const betBefore = engine.currentBet;
    engine.decreaseBet();
    expect(engine.currentBet).toBe(betBefore);
  });
});

// ====================================================================
// 8. 发牌测试
// ====================================================================

describe('发牌', () => {
  it('placeBet 后玩家应有2张牌', () => {
    const engine = createEngineAndDeal();
    const state = engine.getState();
    expect((state.playerHand as Card[]).length).toBe(2);
  });

  it('placeBet 后庄家应有2张牌', () => {
    const engine = createEngineAndDeal();
    const state = engine.getState();
    expect((state.dealerHand as Card[]).length).toBe(2);
  });

  it('placeBet 后进入 PLAYER_TURN 阶段（无Blackjack时）', () => {
    const engine = createEngineAndDeal();
    // 可能是 PLAYER_TURN 或 SETTLEMENT（如果有Blackjack）
    const phase = engine.phase;
    expect([GamePhase.PLAYER_TURN, GamePhase.SETTLEMENT]).toContain(phase);
  });

  it('玩家两张牌都应正面朝上', () => {
    const engine = createEngineAndDeal();
    const state = engine.getState();
    const playerCards = state.playerHand as Card[];
    for (const card of playerCards) {
      expect(card.faceUp).toBe(true);
    }
  });

  it('庄家第一张牌正面朝上', () => {
    const engine = createEngineAndDeal();
    const state = engine.getState();
    const dealerCards = state.dealerHand as Card[];
    expect(dealerCards[0].faceUp).toBe(true);
  });

  it('庄家第二张牌应朝下（未翻开时）', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      const state = engine.getState();
      const dealerCards = state.dealerHand as Card[];
      expect(dealerCards[1].faceUp).toBe(false);
    }
  });

  it('下注后筹码应减少', () => {
    const engine = createEngine();
    engine.start();
    const chipsBefore = engine.chips;
    engine.placeBet();
    expect(engine.chips).toBe(chipsBefore - engine.currentBet);
  });

  it('placeBet 不应在非BETTING阶段执行', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      const stateBefore = engine.getState();
      engine.placeBet();
      const stateAfter = engine.getState();
      // 状态不应变化
      expect(stateAfter.phase).toBe(stateBefore.phase);
    }
  });
});

// ====================================================================
// 9. 要牌 (Hit) 测试
// ====================================================================

describe('要牌 (Hit)', () => {
  it('Hit 后玩家多一张牌', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    const before = (engine.getState().playerHand as Card[]).length;
    engine.hit();
    const after = (engine.getState().playerHand as Card[]).length;
    expect(after).toBe(before + 1);
  });

  it('非 PLAYER_TURN 阶段 Hit 无效', () => {
    const engine = createEngine();
    engine.start();
    // BETTING 阶段
    engine.hit();
    expect((engine.getState().playerHand as Card[]).length).toBe(0);
  });

  it('连续 Hit 可以获得多张牌', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    const initial = (engine.getState().playerHand as Card[]).length;
    let hitCount = 0;
    while (engine.canHit && hitCount < 10) {
      engine.hit();
      hitCount++;
    }
    const after = (engine.getState().playerHand as Card[]).length;
    expect(after).toBe(initial + hitCount);
  });

  it('爆牌后不能再 Hit', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    // 持续要牌直到爆牌或超过10次
    for (let i = 0; i < 10 && engine.canHit; i++) {
      engine.hit();
    }
    if (engine.result === GameResult.PLAYER_BUST) {
      expect(engine.canHit).toBe(false);
    }
  });

  it('canHit 在 PLAYER_TURN 且未爆牌时为 true', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      expect(engine.canHit).toBe(true);
    }
  });
});

// ====================================================================
// 10. 停牌 (Stand) 测试
// ====================================================================

describe('停牌 (Stand)', () => {
  it('Stand 后进入结算阶段', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    engine.stand();
    expect(engine.phase).toBe(GamePhase.SETTLEMENT);
  });

  it('Stand 后应有结果', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    engine.stand();
    expect(engine.result).not.toBeNull();
  });

  it('Stand 后庄家暗牌应翻开', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    engine.stand();
    expect(engine.dealerRevealed).toBe(true);
  });

  it('Stand 后庄家所有牌应正面朝上', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    engine.stand();
    const state = engine.getState();
    const dealerCards = state.dealerHand as Card[];
    for (const card of dealerCards) {
      expect(card.faceUp).toBe(true);
    }
  });

  it('非 PLAYER_TURN 阶段 Stand 无效', () => {
    const engine = createEngine();
    engine.start();
    engine.stand();
    expect(engine.phase).toBe(GamePhase.BETTING);
  });

  it('canStand 在 PLAYER_TURN 时为 true', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      expect(engine.canStand).toBe(true);
    }
  });
});

// ====================================================================
// 11. 加倍 (Double Down) 测试
// ====================================================================

describe('加倍 (Double Down)', () => {
  it('DoubleDown 后赌注翻倍', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    if (!engine.canDouble) return;
    const betBefore = engine.currentBet;
    engine.doubleDown();
    expect(engine.currentBet).toBe(betBefore * 2);
  });

  it('DoubleDown 后玩家多一张牌', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    if (!engine.canDouble) return;
    const before = (engine.getState().playerHand as Card[]).length;
    engine.doubleDown();
    const after = (engine.getState().playerHand as Card[]).length;
    expect(after).toBe(before + 1);
  });

  it('DoubleDown 后进入结算阶段', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    if (!engine.canDouble) return;
    engine.doubleDown();
    expect(engine.phase).toBe(GamePhase.SETTLEMENT);
  });

  it('DoubleDown 后不能再 Hit', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    if (!engine.canDouble) return;
    engine.doubleDown();
    expect(engine.canHit).toBe(false);
  });

  it('DoubleDown 扣除额外筹码', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    if (!engine.canDouble) return;
    const chipsBefore = engine.chips;
    const bet = engine.currentBet;
    engine.doubleDown();
    // After double down, chips = chipsBefore - bet (extra bet deducted)
    // But if player won, chips would also include winnings
    // So we check that at least the extra bet was deducted
    if (engine.result === GameResult.PLAYER_BUST) {
      // Lost - chips should be chipsBefore - bet
      expect(engine.chips).toBe(chipsBefore - bet);
    } else {
      // Won or push - chips include winnings
      // Just verify extra bet was deducted (currentBet doubled)
      expect(engine.currentBet).toBe(bet * 2);
    }
  });

  it('筹码不足时 canDouble 为 false', () => {
    const engine = createEngine();
    engine.start();
    // 设置赌注为所有筹码
    engine.setBet(engine.chips);
    const betAmount = engine.currentBet;
    engine.placeBet();
    // 下注后筹码为0，不能加倍
    if (engine.phase === GamePhase.PLAYER_TURN && engine.chips < betAmount) {
      expect(engine.canDouble).toBe(false);
    }
  });
});

// ====================================================================
// 12. 庄家 AI 测试
// ====================================================================

describe('庄家 AI', () => {
  it('庄家在17以下必须要牌', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    engine.stand();
    const state = engine.getState();
    const dealerCards = state.dealerHand as Card[];
    const dealerVal = calculateHandValue(dealerCards);
    // 庄家最终点数应 >= 17 或已爆牌
    expect(dealerVal >= DEALER_STAND_THRESHOLD || dealerVal > BUST_THRESHOLD).toBe(true);
  });

  it('庄家在17及以上停牌', () => {
    // 多次测试，统计庄家最终点数
    for (let trial = 0; trial < 20; trial++) {
      const engine = createEngineAndDeal();
      if (engine.phase !== GamePhase.PLAYER_TURN) continue;
      engine.stand();
      const state = engine.getState();
      const dealerCards = state.dealerHand as Card[];
      const dealerVal = calculateHandValue(dealerCards);
      expect(dealerVal >= DEALER_STAND_THRESHOLD || dealerVal > BUST_THRESHOLD).toBe(true);
    }
  });

  it('庄家翻开暗牌后应全部正面朝上', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    engine.stand();
    const state = engine.getState();
    const dealerCards = state.dealerHand as Card[];
    for (const card of dealerCards) {
      expect(card.faceUp).toBe(true);
    }
  });
});

// ====================================================================
// 13. 筹码系统测试
// ====================================================================

describe('筹码系统', () => {
  it('初始筹码为1000', () => {
    const engine = createEngine();
    expect(engine.chips).toBe(1000);
  });

  it('赢牌后筹码增加', () => {
    // 模拟赢牌场景：使用固定牌组
    const engine = createEngine();
    engine.start();
    engine.placeBet();

    if (engine.phase === GamePhase.PLAYER_TURN) {
      const chipsBefore = engine.chips;
      engine.stand();
      if (engine.result === GameResult.WIN || engine.result === GameResult.DEALER_BUST) {
        expect(engine.chips).toBeGreaterThan(chipsBefore);
      }
    }
  });

  it('输牌后筹码不退还', () => {
    const engine = createEngine();
    engine.start();
    const bet = engine.currentBet;
    engine.placeBet();

    if (engine.phase === GamePhase.PLAYER_TURN) {
      const chipsAfterBet = engine.chips;
      engine.stand();
      if (engine.result === GameResult.LOSE || engine.result === GameResult.PLAYER_BUST) {
        expect(engine.chips).toBe(chipsAfterBet);
      }
    }
  });

  it('平局退还赌注', () => {
    const engine = createEngine();
    engine.start();
    engine.placeBet();

    if (engine.phase === GamePhase.PLAYER_TURN) {
      const chipsAfterBet = engine.chips;
      engine.stand();
      if (engine.result === GameResult.PUSH) {
        expect(engine.chips).toBe(chipsAfterBet + engine.currentBet);
      }
    }
  });

  it('Blackjack 赔率1.5倍', () => {
    // 测试多次，希望能碰到 Blackjack
    for (let trial = 0; trial < 50; trial++) {
      const engine = createEngine();
      engine.start();
      engine.placeBet();

      if (engine.result === GameResult.BLACKJACK) {
        const bet = engine.currentBet;
        // 下注时扣了bet，赢回 bet * (1 + 1.5) = bet * 2.5
        // 所以 chips = INITIAL_CHIPS - bet + Math.floor(bet * (1 + 1.5))
        const expectedChips = INITIAL_CHIPS - bet + Math.floor(bet * (1 + BLACKJACK_PAYOUT));
        expect(engine.chips).toBe(expectedChips);
        break;
      }
    }
  });

  it('破产时游戏结束', () => {
    const engine = createEngine();
    engine.start();
    // 模拟破产
    (engine as any)._chips = 0;
    engine.startNewRound();
    expect(engine.phase).toBe(GamePhase.SETTLEMENT);
  });

  it('筹码不足最小赌注时不能开始新局', () => {
    const engine = createEngine();
    engine.start();
    (engine as any)._chips = 5; // 小于 MIN_BET
    engine.startNewRound();
    expect(engine.resultMessage).toContain('筹码不足');
  });

  it('牌组剩余少于15张时重新洗牌', () => {
    const engine = createEngine();
    engine.start();
    // 消耗牌组到少于15张
    (engine as any).deck = (engine as any).deck.slice(0, 14);
    engine.startNewRound();
    expect((engine as any).deck.length).toBeGreaterThanOrEqual(52);
  });
});

// ====================================================================
// 14. 胜负判定测试
// ====================================================================

describe('胜负判定', () => {
  it('结果应包含正确的枚举值', () => {
    const validResults = Object.values(GameResult);
    expect(validResults).toContain(GameResult.WIN);
    expect(validResults).toContain(GameResult.LOSE);
    expect(validResults).toContain(GameResult.PUSH);
    expect(validResults).toContain(GameResult.BLACKJACK);
    expect(validResults).toContain(GameResult.PLAYER_BUST);
    expect(validResults).toContain(GameResult.DEALER_BUST);
  });

  it('结算后应有结果消息', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      engine.stand();
      expect(engine.resultMessage).toBeTruthy();
    }
  });

  it('赢牌时 isWin 为 true', () => {
    for (let trial = 0; trial < 30; trial++) {
      const engine = createEngineAndDeal();
      if (engine.phase === GamePhase.PLAYER_TURN) {
        engine.stand();
        if (engine.result === GameResult.WIN || engine.result === GameResult.DEALER_BUST) {
          expect(engine.isWin).toBe(true);
          return;
        }
      }
    }
  });

  it('输牌时 isWin 为 false', () => {
    for (let trial = 0; trial < 30; trial++) {
      const engine = createEngineAndDeal();
      if (engine.phase === GamePhase.PLAYER_TURN) {
        engine.stand();
        if (engine.result === GameResult.LOSE || engine.result === GameResult.PLAYER_BUST) {
          expect(engine.isWin).toBe(false);
          return;
        }
      }
    }
  });

  it('平局时 isWin 为 false', () => {
    for (let trial = 0; trial < 50; trial++) {
      const engine = createEngineAndDeal();
      if (engine.phase === GamePhase.PLAYER_TURN) {
        engine.stand();
        if (engine.result === GameResult.PUSH) {
          expect(engine.isWin).toBe(false);
          return;
        }
      }
    }
  });

  it('统计信息应正确更新', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      engine.stand();
      const state = engine.getState();
      const total = (state.wins as number) + (state.losses as number) + (state.pushes as number);
      expect(total).toBeGreaterThanOrEqual(1);
    }
  });
});

// ====================================================================
// 15. 键盘控制测试
// ====================================================================

describe('键盘控制', () => {
  let engine: BlackjackEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.start();
  });

  it('H 键在 PLAYER_TURN 时触发 Hit', () => {
    engine.placeBet();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      const before = (engine.getState().playerHand as Card[]).length;
      engine.handleKeyDown('h');
      const after = (engine.getState().playerHand as Card[]).length;
      expect(after).toBe(before + 1);
    }
  });

  it('S 键在 PLAYER_TURN 时触发 Stand', () => {
    engine.placeBet();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      engine.handleKeyDown('s');
      expect(engine.phase).toBe(GamePhase.SETTLEMENT);
    }
  });

  it('D 键在 PLAYER_TURN 时触发 DoubleDown', () => {
    engine.placeBet();
    if (engine.phase === GamePhase.PLAYER_TURN && engine.canDouble) {
      const betBefore = engine.currentBet;
      engine.handleKeyDown('d');
      expect(engine.currentBet).toBe(betBefore * 2);
    }
  });

  it('ArrowUp 在 BETTING 时增加赌注', () => {
    const betBefore = engine.currentBet;
    engine.handleKeyDown('ArrowUp');
    expect(engine.currentBet).toBeGreaterThan(betBefore);
  });

  it('ArrowDown 在 BETTING 时减少赌注', () => {
    engine.handleKeyDown('ArrowUp');
    const betBefore = engine.currentBet;
    engine.handleKeyDown('ArrowDown');
    expect(engine.currentBet).toBeLessThan(betBefore);
  });

  it('空格在 SETTLEMENT 时开始新局', () => {
    engine.placeBet();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      engine.stand();
      if (engine.phase === GamePhase.SETTLEMENT) {
        engine.handleKeyDown(' ');
        expect(engine.phase).toBe(GamePhase.BETTING);
      }
    }
  });

  it('Enter 在 SETTLEMENT 时开始新局', () => {
    engine.placeBet();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      engine.stand();
      if (engine.phase === GamePhase.SETTLEMENT) {
        engine.handleKeyDown('Enter');
        expect(engine.phase).toBe(GamePhase.BETTING);
      }
    }
  });

  it('非 playing 状态下按键无效', () => {
    engine.reset();
    const stateBefore = engine.getState();
    engine.handleKeyDown('h');
    const stateAfter = engine.getState();
    expect(stateAfter).toEqual(stateBefore);
  });

  it('handleKeyUp 不应报错', () => {
    expect(() => engine.handleKeyUp('h')).not.toThrow();
  });
});

// ====================================================================
// 16. 多局游戏测试
// ====================================================================

describe('多局游戏', () => {
  it('可以连续玩多局', () => {
    const engine = createEngine();
    engine.start();

    for (let round = 0; round < 5; round++) {
      engine.placeBet();
      if (engine.phase === GamePhase.PLAYER_TURN) {
        engine.stand();
      }
      if (engine.phase === GamePhase.SETTLEMENT) {
        if (engine.chips >= MIN_BET) {
          engine.startNewRound();
        }
      }
    }

    const state = engine.getState();
    expect((state.wins as number) + (state.losses as number) + (state.pushes as number)).toBeGreaterThanOrEqual(1);
  });

  it('上一局的赌注应被记住', () => {
    const engine = createEngine();
    engine.start();
    engine.setBet(100);
    engine.placeBet();

    if (engine.phase === GamePhase.PLAYER_TURN) {
      engine.stand();
      if (engine.phase === GamePhase.SETTLEMENT && engine.chips >= 100) {
        engine.startNewRound();
        expect(engine.currentBet).toBe(100);
      }
    }
  });

  it('筹码不足时赌注自动调整', () => {
    const engine = createEngine();
    engine.start();
    (engine as any)._chips = 50;
    (engine as any)._lastBet = 100;
    engine.startNewRound();
    expect(engine.currentBet).toBeLessThanOrEqual(50);
  });

  it('统计应累计', () => {
    const engine = createEngine();
    engine.start();
    let totalRounds = 0;

    for (let round = 0; round < 10 && engine.chips >= MIN_BET; round++) {
      const phaseBefore = engine.phase;
      engine.placeBet();
      if (engine.phase === GamePhase.PLAYER_TURN) {
        engine.stand();
        totalRounds++;
      } else if (phaseBefore === GamePhase.BETTING && engine.phase === GamePhase.SETTLEMENT) {
        // Blackjack or instant result also counts as a round
        totalRounds++;
      }
      if (engine.phase === GamePhase.SETTLEMENT && engine.chips >= MIN_BET) {
        engine.startNewRound();
      } else {
        break;
      }
    }

    const state = engine.getState();
    const total = (state.wins as number) + (state.losses as number) + (state.pushes as number);
    expect(total).toBe(totalRounds);
  });
});

// ====================================================================
// 17. 多副牌测试
// ====================================================================

describe('多副牌', () => {
  it('setDeckCount 可以设置牌组数量', () => {
    const engine = createEngine();
    engine.setDeckCount(6);
    engine.start();
    expect((engine as any).deck.length).toBe(312);
  });

  it('setDeckCount 限制在1-8之间', () => {
    const engine = createEngine();
    engine.setDeckCount(0);
    expect((engine as any).deckCount).toBe(1);
    engine.setDeckCount(10);
    expect((engine as any).deckCount).toBe(8);
  });

  it('getDeckRemaining 返回剩余张数', () => {
    const engine = createEngine();
    engine.start();
    const remaining = engine.getDeckRemaining();
    expect(remaining).toBe(52);
  });

  it('发牌后剩余张数减少', () => {
    const engine = createEngineAndDeal();
    const remaining = engine.getDeckRemaining();
    expect(remaining).toBeLessThan(52);
  });
});

// ====================================================================
// 18. 边界情况测试
// ====================================================================

describe('边界情况', () => {
  it('连续要牌直到爆牌', () => {
    const engine = createEngineAndDeal();
    if (engine.phase !== GamePhase.PLAYER_TURN) return;
    while (engine.canHit) {
      engine.hit();
    }
    // 应该已经爆牌或达到21点
    const val = engine.playerValue;
    expect(val > BUST_THRESHOLD || val === BLACKJACK_VALUE).toBe(true);
  });

  it('玩家21点时自动停牌', () => {
    // 很难精确控制，但可以验证逻辑存在
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      while (engine.canHit && engine.playerValue < 21) {
        engine.hit();
      }
      if (engine.playerValue === 21) {
        // 应该自动停牌了
        expect(engine.phase).toBe(GamePhase.SETTLEMENT);
      }
    }
  });

  it('没有初始化 canvas 时 start 应抛出错误', () => {
    const engine = new BlackjackEngine();
    expect(() => engine.start()).toThrow('Canvas not initialized');
  });

  it('setBet 为负数时应被修正为 MIN_BET', () => {
    const engine = createEngine();
    engine.start();
    engine.setBet(-100);
    expect(engine.currentBet).toBe(MIN_BET);
  });

  it('placeBet 在非 BETTING 阶段无效', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      const stateBefore = engine.getState();
      engine.placeBet();
      // 状态不变
      expect(engine.phase).toBe(GamePhase.PLAYER_TURN);
    }
  });

  it('结果消息应包含适当文本', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      engine.stand();
      expect(typeof engine.resultMessage).toBe('string');
      expect(engine.resultMessage.length).toBeGreaterThan(0);
    }
  });
});

// ====================================================================
// 19. 渲染相关测试（验证不报错）
// ====================================================================

describe('渲染', () => {
  it('onRender 在 BETTING 阶段不报错', () => {
    const engine = createEngine();
    engine.start();
    expect(() => engine.render()).not.toThrow();
  });

  it('onRender 在 PLAYER_TURN 阶段不报错', () => {
    const engine = createEngineAndDeal();
    expect(() => engine.render()).not.toThrow();
  });

  it('onRender 在 SETTLEMENT 阶段不报错', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      engine.stand();
      expect(() => engine.render()).not.toThrow();
    }
  });
});

// ====================================================================
// 20. 属性访问器测试
// ====================================================================

describe('属性访问器', () => {
  let engine: BlackjackEngine;

  beforeEach(() => {
    engine = createEngineAndDeal();
  });

  it('playerValue 返回玩家手牌点数', () => {
    if (engine.phase === GamePhase.PLAYER_TURN) {
      expect(typeof engine.playerValue).toBe('number');
      expect(engine.playerValue).toBeGreaterThan(0);
    }
  });

  it('dealerValue 返回庄家明牌点数', () => {
    if (engine.phase === GamePhase.PLAYER_TURN) {
      expect(typeof engine.dealerValue).toBe('number');
    }
  });

  it('dealerFullValue 在未翻开时可能不同', () => {
    if (engine.phase === GamePhase.PLAYER_TURN) {
      // dealerValue 只算明牌，dealerFullValue 算全部
      // 两者可能不同
      expect(typeof engine.dealerFullValue).toBe('number');
    }
  });

  it('wins, losses, pushes, blackjacks 初始为0', () => {
    const freshEngine = createEngine();
    expect(freshEngine.wins).toBe(0);
    expect(freshEngine.losses).toBe(0);
    expect(freshEngine.pushes).toBe(0);
    expect(freshEngine.blackjacks).toBe(0);
  });

  it('phase 返回当前阶段', () => {
    expect([GamePhase.BETTING, GamePhase.PLAYER_TURN, GamePhase.SETTLEMENT]).toContain(engine.phase);
  });

  it('dealerRevealed 初始为 false', () => {
    if (engine.phase === GamePhase.PLAYER_TURN) {
      expect(engine.dealerRevealed).toBe(false);
    }
  });

  it('dealerAnimating 初始为 false', () => {
    expect(engine.dealerAnimating).toBe(false);
  });
});

// ====================================================================
// 21. 事件系统测试
// ====================================================================

describe('事件系统', () => {
  it('stateChange 事件在下注时触发', () => {
    const engine = createEngine();
    engine.start();
    const listener = jest.fn();
    engine.on('stateChange', listener);
    engine.placeBet();
    expect(listener).toHaveBeenCalled();
  });

  it('stateChange 事件在 Hit 时触发', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      const listener = jest.fn();
      engine.on('stateChange', listener);
      engine.hit();
      expect(listener).toHaveBeenCalled();
    }
  });

  it('stateChange 事件在 Stand 时触发', () => {
    const engine = createEngineAndDeal();
    if (engine.phase === GamePhase.PLAYER_TURN) {
      const listener = jest.fn();
      engine.on('stateChange', listener);
      engine.stand();
      expect(listener).toHaveBeenCalled();
    }
  });

  it('off 取消监听', () => {
    const engine = createEngine();
    engine.start();
    const listener = jest.fn();
    engine.on('stateChange', listener);
    engine.off('stateChange', listener);
    engine.increaseBet();
    expect(listener).not.toHaveBeenCalled();
  });
});

// ====================================================================
// 22. 分数系统测试
// ====================================================================

describe('分数系统', () => {
  it('赢牌时分数增加', () => {
    for (let trial = 0; trial < 30; trial++) {
      const engine = createEngineAndDeal();
      if (engine.phase === GamePhase.PLAYER_TURN) {
        engine.stand();
        if (engine.result === GameResult.WIN || engine.result === GameResult.DEALER_BUST) {
          expect(engine.score).toBeGreaterThan(0);
          return;
        }
      }
    }
  });

  it('Blackjack 时分数按1.5倍增加', () => {
    for (let trial = 0; trial < 50; trial++) {
      const engine = createEngine();
      engine.start();
      engine.placeBet();

      if (engine.result === GameResult.BLACKJACK) {
        const bet = engine.currentBet;
        expect(engine.score).toBe(Math.floor(bet * BLACKJACK_PAYOUT));
        return;
      }
    }
  });

  it('输牌时分数不变', () => {
    for (let trial = 0; trial < 30; trial++) {
      const engine = createEngineAndDeal();
      if (engine.phase === GamePhase.PLAYER_TURN) {
        engine.stand();
        if (engine.result === GameResult.LOSE || engine.result === GameResult.PLAYER_BUST) {
          // 输牌不加分
          expect(engine.score).toBe(0);
          return;
        }
      }
    }
  });
});
