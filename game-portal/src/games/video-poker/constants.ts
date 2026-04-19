// ========== Video Poker 游戏常量 ==========

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 花色 */
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = typeof SUITS[number];

/** 牌面值（2-14，14=A） */
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
export type Rank = typeof RANKS[number];

/** 牌面值显示名 */
export const RANK_NAMES: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

/** 花色显示符号 */
export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

/** 花色颜色（红/黑） */
export const SUIT_COLORS: Record<Suit, string> = {
  hearts: '#e74c3c',
  diamonds: '#e74c3c',
  clubs: '#2c3e50',
  spades: '#2c3e50',
};

/** 牌型枚举（从高到低） */
export enum HandRank {
  ROYAL_FLUSH = 'royal-flush',
  STRAIGHT_FLUSH = 'straight-flush',
  FOUR_OF_A_KIND = 'four-of-a-kind',
  FULL_HOUSE = 'full-house',
  FLUSH = 'flush',
  STRAIGHT = 'straight',
  THREE_OF_A_KIND = 'three-of-a-kind',
  TWO_PAIR = 'two-pair',
  JACKS_OR_BETTER = 'jacks-or-better',
  HIGH_CARD = 'high-card',
}

/** 牌型中文名 */
export const HAND_RANK_NAMES: Record<HandRank, string> = {
  [HandRank.ROYAL_FLUSH]: '皇家同花顺',
  [HandRank.STRAIGHT_FLUSH]: '同花顺',
  [HandRank.FOUR_OF_A_KIND]: '四条',
  [HandRank.FULL_HOUSE]: '葫芦',
  [HandRank.FLUSH]: '同花',
  [HandRank.STRAIGHT]: '顺子',
  [HandRank.THREE_OF_A_KIND]: '三条',
  [HandRank.TWO_PAIR]: '两对',
  [HandRank.JACKS_OR_BETTER]: '一对(J+)',
  [HandRank.HIGH_CARD]: '高牌',
};

/** 赔率表 */
export const PAYOUT_TABLE: Record<HandRank, number> = {
  [HandRank.ROYAL_FLUSH]: 800,
  [HandRank.STRAIGHT_FLUSH]: 50,
  [HandRank.FOUR_OF_A_KIND]: 25,
  [HandRank.FULL_HOUSE]: 9,
  [HandRank.FLUSH]: 6,
  [HandRank.STRAIGHT]: 4,
  [HandRank.THREE_OF_A_KIND]: 3,
  [HandRank.TWO_PAIR]: 2,
  [HandRank.JACKS_OR_BETTER]: 1,
  [HandRank.HIGH_CARD]: 0,
};

/** 游戏阶段 */
export enum GamePhase {
  IDLE = 'idle',
  DEALING = 'dealing',
  HOLDING = 'holding',
  DRAWING = 'drawing',
  RESULT = 'result',
}

/** 筹码默认值 */
export const DEFAULT_CREDITS = 1000;
export const MIN_BET = 1;
export const MAX_BET = 5;
export const BET_STEP = 1;

/** 发牌数 */
export const HAND_SIZE = 5;

/** 牌数据接口 */
export interface Card {
  suit: Suit;
  rank: Rank;
}

/** 游戏状态接口 */
export interface VideoPokerState {
  [key: string]: unknown;
  phase: GamePhase;
  hand: (Card | null)[];
  held: boolean[];
  credits: number;
  bet: number;
  lastWin: number;
  handRank: HandRank | null;
  deck: Card[];
}

// ========== 鼠标操作按钮布局 ==========

/** 按钮区域 */
export const VP_BUTTON_WIDTH = 120;
export const VP_BUTTON_HEIGHT = 40;
export const VP_BUTTON_RADIUS = 8;
export const VP_BUTTON_Y = 580; // Deal/Draw 按钮的 Y 位置

/** 牌区域布局（与 renderHand 保持一致） */
export const VP_CARD_WIDTH = 70;
export const VP_CARD_HEIGHT = 100;
export const VP_CARD_GAP = 12;

/** 按钮颜色 */
export const VP_BUTTON_COLORS = {
  DEAL_DRAW_BG: '#27ae60',
  DEAL_DRAW_HOVER: '#3dd676',
  DEAL_DRAW_DISABLED: '#165a30',
  BET_UP_BG: '#2ecc71',
  BET_UP_HOVER: '#55d98d',
  BET_DOWN_BG: '#e67e22',
  BET_DOWN_HOVER: '#f0a04b',
  CARD_HOVER_BORDER: '#ffd700',
  TEXT: '#ffffff',
  TEXT_DISABLED: '#888888',
} as const;

/** 下注调整按钮尺寸 */
export const VP_BET_BUTTON_WIDTH = 60;
export const VP_BET_BUTTON_HEIGHT = 32;

/** 按钮定义 */
export interface VPButtonRect {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  action: string;
  enabled: boolean;
  bgColor: string;
  hoverColor: string;
  disabledColor: string;
}
