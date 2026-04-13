// ========== Solitaire 纸牌接龙常量 ==========

// 画布尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 牌面尺寸
export const CARD_WIDTH = 60;
export const CARD_HEIGHT = 84;

// 间距
export const CARD_GAP = 8;
export const TABLEAU_OVERLAP_FACE_DOWN = 16;
export const TABLEAU_OVERLAP_FACE_UP = 22;

// 区域 Y 坐标
export const TOP_ROW_Y = 10;
export const TABLEAU_Y = 115;

// Stock / Waste 位置
export const STOCK_X = 15;
export const WASTE_X = STOCK_X + CARD_WIDTH + CARD_GAP;

// Foundation 位置 (4 个，从右侧开始)
export const FOUNDATION_X_START = 275;
export const FOUNDATION_GAP = CARD_WIDTH + CARD_GAP;

// Tableau 位置 (7 列)
export const TABLEAU_X_START = 15;
export const TABLEAU_GAP = (CANVAS_WIDTH - 2 * TABLEAU_X_START - 7 * CARD_WIDTH) / 6 + CARD_WIDTH;

// 颜色
export const BG_COLOR = '#1a6b3c';
export const CARD_BACK_COLOR = '#1565c0';
export const CARD_BACK_PATTERN = '#1976d2';
export const CARD_FACE_COLOR = '#ffffff';
export const CARD_BORDER_COLOR = '#333333';
export const CARD_SELECTED_COLOR = '#ffeb3b';
export const RED_SUIT_COLOR = '#d32f2f';
export const BLACK_SUIT_COLOR = '#212121';
export const EMPTY_SLOT_COLOR = 'rgba(0,0,0,0.2)';
export const HUD_COLOR = '#ffffff';
export const WIN_COLOR = '#ffd700';

// 花色
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

// 花色颜色
export const RED_SUITS: Suit[] = ['hearts', 'diamonds'];
export const BLACK_SUITS: Suit[] = ['clubs', 'spades'];

// 牌面值
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

// 计分
export const SCORE_FLIP = 5;
export const SCORE_FOUNDATION = 10;
export const SCORE_FOUNDATION_BACK = -15;

// 牌面值对应的数值 (A=1, 2-10, J=11, Q=12, K=13)
export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 1;
}

// 判断花色是否为红色
export function isRedSuit(suit: Suit): boolean {
  return RED_SUITS.includes(suit);
}

// 花色符号
export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
  }
}
