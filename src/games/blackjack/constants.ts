/**
 * 21点 Blackjack 游戏常量
 */

// ========== 牌组相关 ==========

/** 花色 */
export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export type Suit = (typeof SUITS)[number];

/** 牌面值 */
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

/** 牌的颜色（红/黑） */
export function getCardColor(suit: Suit): 'red' | 'black' {
  return suit === '♥' || suit === '♦' ? 'red' : 'black';
}

/** 牌的点数值（不含A的灵活计算） */
export function getRankValue(rank: Rank): number {
  if (rank === 'A') return 11; // 默认11，计算时灵活处理
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

// ========== 游戏参数 ==========

/** 默认牌组数量 */
export const DEFAULT_DECK_COUNT = 1;

/** 牌组总张数 */
export const DECK_SIZE = 52;

/** 初始筹码 */
export const INITIAL_CHIPS = 1000;

/** 最小下注 */
export const MIN_BET = 10;

/** 最大下注 */
export const MAX_BET = 500;

/** 下注步进 */
export const BET_STEP = 10;

/** 庄家停牌点数 */
export const DEALER_STAND_THRESHOLD = 17;

/** Blackjack 赔率倍数 */
export const BLACKJACK_PAYOUT = 1.5;

/** 普通赢牌赔率倍数 */
export const NORMAL_PAYOUT = 1.0;

/** 爆牌点数 */
export const BUST_THRESHOLD = 21;

/** Blackjack 所需点数 */
export const BLACKJACK_VALUE = 21;

// ========== 游戏阶段 ==========

export enum GamePhase {
  /** 下注阶段 */
  BETTING = 'betting',
  /** 玩家回合 */
  PLAYER_TURN = 'player_turn',
  /** 庄家回合 */
  DEALER_TURN = 'dealer_turn',
  /** 结算阶段 */
  SETTLEMENT = 'settlement',
}

// ========== 游戏结果 ==========

export enum GameResult {
  /** 玩家赢 */
  WIN = 'win',
  /** 玩家输 */
  LOSE = 'lose',
  /** 平局 */
  PUSH = 'push',
  /** 玩家Blackjack */
  BLACKJACK = 'blackjack',
  /** 玩家爆牌 */
  PLAYER_BUST = 'player_bust',
  /** 庄家爆牌 */
  DEALER_BUST = 'dealer_bust',
}

// ========== Canvas 尺寸 ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 颜色 ==========

export const COLORS = {
  TABLE_GREEN: '#0a5c36',
  TABLE_BORDER: '#0d7a48',
  FELT_GREEN: '#0e6b3f',
  CARD_WHITE: '#ffffff',
  CARD_BACK: '#1a3a5c',
  CARD_BACK_PATTERN: '#234b6e',
  TEXT_WHITE: '#ffffff',
  TEXT_GOLD: '#ffd700',
  TEXT_RED: '#ff4444',
  TEXT_GREEN: '#00cc66',
  TEXT_GRAY: '#aaaaaa',
  BUTTON_HIT: '#e74c3c',
  BUTTON_STAND: '#3498db',
  BUTTON_DOUBLE: '#f39c12',
  CHIP_GOLD: '#ffd700',
  CHIP_BORDER: '#daa520',
  OVERLAY_BG: 'rgba(0, 0, 0, 0.6)',
  SHADOW: 'rgba(0, 0, 0, 0.3)',
} as const;

// ========== 牌面布局 ==========

export const CARD_WIDTH = 60;
export const CARD_HEIGHT = 84;
export const CARD_SPACING = 20;
export const CARD_RADIUS = 6;

// ========== 按键映射 ==========

export const KEY_HIT = 'h';
export const KEY_STAND = 's';
export const KEY_DOUBLE = 'd';
export const KEY_BET_UP = 'ArrowUp';
export const KEY_BET_DOWN = 'ArrowDown';
export const KEY_NEW_GAME = ' '; // 空格
export const KEY_NEW_GAME_ALT = 'Enter';
