// ========== FreeCell 空当接龙常量 ==========

// 画布尺寸
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// 牌面尺寸
export const CARD_WIDTH = 55;
export const CARD_HEIGHT = 76;

// 间距
export const CARD_GAP = 8;

// 区域 Y 坐标
export const TOP_ROW_Y = 10;
export const TABLEAU_Y = 105;

// 自由单元格位置 (4 个，左侧)
export const FREECELL_X_START = 10;
export const FREECELL_GAP = CARD_WIDTH + CARD_GAP;

// 基础堆位置 (4 个，右侧)
export const FOUNDATION_X_START = 266;
export const FOUNDATION_GAP = CARD_WIDTH + CARD_GAP;

// 列位置 (8 列)
export const TABLEAU_X_START = 10;
export const TABLEAU_GAP = (CANVAS_WIDTH - 2 * TABLEAU_X_START - 8 * CARD_WIDTH) / 7 + CARD_WIDTH;

// 列中牌的叠放偏移
export const TABLEAU_OVERLAP = 22;

// 颜色
export const BG_COLOR = '#0d6b3c';
export const CARD_BACK_COLOR = '#1565c0';
export const CARD_FACE_COLOR = '#ffffff';
export const CARD_BORDER_COLOR = '#333333';
export const CARD_SELECTED_COLOR = '#ffeb3b';
export const CARD_HOVER_COLOR = '#81d4fa';
export const RED_SUIT_COLOR = '#d32f2f';
export const BLACK_SUIT_COLOR = '#212121';
export const EMPTY_SLOT_COLOR = 'rgba(0,0,0,0.2)';
export const EMPTY_SLOT_BORDER = 'rgba(255,255,255,0.3)';
export const HUD_COLOR = '#ffffff';
export const WIN_COLOR = '#ffd700';
export const CURSOR_COLOR = '#ffeb3b';

// 花色
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

// 花色颜色分组
export const RED_SUITS: Suit[] = ['hearts', 'diamonds'];
export const BLACK_SUITS: Suit[] = ['clubs', 'spades'];

// 牌面值
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

// 牌面值对应的数值 (A=1, 2-10, J=11, Q=12, K=13)
export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 1;
}

// 判断花色是否为红色
export function isRedSuit(suit: Suit): boolean {
  return RED_SUITS.includes(suit);
}

// 判断两张牌颜色是否相反
export function isOppositeColor(suit1: Suit, suit2: Suit): boolean {
  return isRedSuit(suit1) !== isRedSuit(suit2);
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

// 花色对应的基础堆索引
export function foundationIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

// 计分
export const SCORE_FOUNDATION = 10;
export const SCORE_MOVE_TO_FREECELL = -2;
export const SCORE_MOVE_FROM_FREECELL = 2;
export const SCORE_AUTO_COMPLETE = 5;

// 游戏区域枚举
export enum Area {
  FREECELL = 'freecell',
  FOUNDATION = 'foundation',
  TABLEAU = 'tableau',
}

// 导航区域
export const NAV_AREAS = [Area.FREECELL, Area.FOUNDATION, Area.TABLEAU] as const;

// 牌数据接口
export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

// 创建一副标准52张牌
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, faceUp: true });
    }
  }
  return deck;
}

// Fisher-Yates 洗牌算法
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 计算可移动的最大牌数
// 公式: (空闲单元格数 + 1) × 2^(空列数)
export function maxMovableCards(
  emptyFreeCells: number,
  emptyColumns: number,
  isMovingToEmpty: boolean
): number {
  // 如果目标是空列，则该空列不算在空列数中
  const effectiveEmptyColumns = isMovingToEmpty ? emptyColumns - 1 : emptyColumns;
  return (emptyFreeCells + 1) * Math.pow(2, effectiveEmptyColumns);
}

// 检查一组牌是否形成有效序列（交替颜色，递减值）
export function isValidSequence(cards: Card[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    const prev = cards[i - 1];
    const curr = cards[i];
    if (!isOppositeColor(prev.suit, curr.suit)) return false;
    if (rankValue(prev.rank) !== rankValue(curr.rank) + 1) return false;
  }
  return true;
}
