// ========== Make 24 Constants ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== Game Core ==========
export const CARD_COUNT = 4;
export const MIN_CARD_VALUE = 1;
export const MAX_CARD_VALUE = 13;
export const TARGET_RESULT = 24;

// ========== Operators ==========
export const OPERATORS = ['+', '-', '*', '/'] as const;
export type Operator = typeof OPERATORS[number];

// ========== Difficulty ==========
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  maxValue: number;
  guaranteedSolvable: boolean;
  timeLimit: number;
  label: string;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy:   { maxValue: 9,  guaranteedSolvable: true,  timeLimit: 0,   label: 'Easy (1-9)' },
  normal: { maxValue: 13, guaranteedSolvable: true,  timeLimit: 120, label: 'Normal (1-13)' },
  hard:   { maxValue: 13, guaranteedSolvable: false, timeLimit: 60,  label: 'Hard (1-13)' },
};

// ========== Scoring ==========
export const BASE_SCORE = 100;
export const TIME_BONUS_FACTOR = 10;
export const HINT_PENALTY = 50;
export const SKIP_PENALTY = 30;
export const STREAK_BONUS = 20;
export const PERFECT_BONUS = 100;

// ========== Layout ==========
export const CARD_WIDTH = 90;
export const CARD_HEIGHT = 130;
export const CARD_SPACING = 16;
export const CARD_ROW_Y = 100;
export const CARD_BORDER_RADIUS = 10;

export const EXPRESSION_Y = 300;
export const EXPRESSION_HEIGHT = 48;
export const EXPRESSION_PADDING = 24;

export const HUD_HEIGHT = 60;
export const MESSAGE_Y = 520;
export const BUTTON_ROW_Y = 580;

// ========== Colors ==========
export const BG_COLOR = '#0f172a';
export const BOARD_COLOR = '#1e293b';
export const TEXT_COLOR = '#f1f5f9';
export const HIGHLIGHT_COLOR = '#334155';
export const CARD_BG_COLOR = '#fefce8';
export const CARD_BORDER_COLOR = '#ca8a04';
export const CARD_SELECTED_COLOR = '#22d3ee';
export const CARD_USED_COLOR = '#6b7280';
export const CARD_TEXT_COLOR = '#1e293b';
export const CARD_SUIT_RED = '#dc2626';
export const CARD_SUIT_BLACK = '#1e293b';
export const OPERATOR_BG = '#3b82f6';
export const OPERATOR_TEXT = '#ffffff';
export const PAREN_BG = '#8b5cf6';
export const PAREN_TEXT = '#ffffff';
export const SUBMIT_BG = '#22c55e';
export const SUBMIT_TEXT = '#ffffff';
export const HINT_BG = '#f59e0b';
export const HINT_TEXT = '#1e293b';
export const CLEAR_BG = '#ef4444';
export const CLEAR_TEXT = '#ffffff';
export const SUCCESS_COLOR = '#22c55e';
export const ERROR_COLOR = '#ef4444';
export const TIMER_COLOR = '#38bdf8';
export const TIMER_WARNING_COLOR = '#f59e0b';
export const TIMER_CRITICAL_COLOR = '#ef4444';
export const CURSOR_COLOR = '#22d3ee';
export const EXPRESSION_BG = '#1e293b';
export const EXPRESSION_BORDER = '#475569';

// ========== Card Display ==========
export const SUITS = ['spade', 'heart', 'diamond', 'club'] as const;
export const RED_SUITS = ['heart', 'diamond'];
export const VALUE_DISPLAY: Record<number, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K',
};
export const SUIT_SYMBOLS: Record<string, string> = {
  spade: '\u2660', heart: '\u2665', diamond: '\u2666', club: '\u2663',
};
