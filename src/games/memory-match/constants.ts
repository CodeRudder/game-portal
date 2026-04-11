// ========== Memory Match 游戏常量 ==========

import { GameType } from '@/types';

// ========== 游戏元信息 ==========

export const MEMORY_MATCH_META = {
  type: GameType.MEMORY_MATCH,
  name: 'Memory Match',
  description: '翻牌配对记忆游戏，找出所有相同的卡牌对',
  icon: '🃏',
  color: '#6c5ce7',
  gradient: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
  controls: '方向键移动 | 空格翻牌 | 鼠标点击',
  difficulty: '中等' as const,
};

// ========== Canvas 尺寸（与 GameContainer 统一） ==========

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 难度/等级配置 ==========

/** 每个等级对应的网格配置 */
export interface LevelConfig {
  cols: number;
  rows: number;
  totalPairs: number;
  label: string;
}

export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: { cols: 4, rows: 4, totalPairs: 8, label: '简单 4×4' },
  2: { cols: 5, rows: 4, totalPairs: 10, label: '中等 5×4' },
  3: { cols: 6, rows: 6, totalPairs: 18, label: '困难 6×6' },
};

/** 默认等级配置（4×4） */
export const DEFAULT_LEVEL = 1;

// ========== 卡牌布局 ==========

export const CARD_PADDING = 12; // 网格区域内边距
export const CARD_GAP = 10; // 卡牌间距
export const GRID_OFFSET_Y = 100; // 网格区域顶部偏移（给 HUD 区域）
export const GRID_OFFSET_BOTTOM = 20; // 网格区域底部留白
export const CARD_RADIUS = 10; // 卡牌圆角

// ========== 卡牌状态 ==========

export type CardState = 'hidden' | 'flipped' | 'revealed' | 'matched';

// ========== 动画参数 ==========

export const FLIP_DURATION = 300; // 翻牌动画时长（毫秒）
export const MISMATCH_DELAY = 800; // 不匹配时翻回延迟（毫秒）
export const MATCH_GLOW_DURATION = 600; // 匹配成功发光动画时长（毫秒）
export const WIN_DELAY = 400; // 胜利展示延迟（毫秒，让最后一张翻开动画完成）

// ========== 计分规则 ==========

export const BASE_SCORE = 1000; // 基础分数（初始分）
export const SCORE_BASE_MATCH = 100; // 基础匹配得分
export const SCORE_COMBO_BONUS = 50; // 连击额外加分（× combo 数）
export const SCORE_MISMATCH_PENALTY = 50; // 不匹配扣分
export const SCORE_MIN = 0; // 最低分数
export const TIME_BONUS_MAX = 2000; // 最大时间奖励
export const TIME_BONUS_THRESHOLD = 120; // 时间奖励阈值（秒），低于此时间获得奖励

// ========== 颜色方案 ==========

export const COLORS = {
  // 背景
  background: '#0f0e17',
  backgroundGradient1: '#0f0e17',
  backgroundGradient2: '#1a1a2e',

  // HUD
  hudBg: '#1a1a2e',
  hudBorder: '#2d2b55',
  hudTitle: '#eccc68',
  hudLabel: '#a4b0be',
  hudValue: '#ffffff',
  hudScore: '#ffd700',
  hudCombo: '#ff6b6b',
  hudTime: '#7bed9f',

  // 卡牌背面
  cardBack1: '#16213e',
  cardBack2: '#0f3460',
  cardBackBorder: '#1a5276',
  cardBackPattern: 'rgba(255, 255, 255, 0.08)',
  cardBackCenter: 'rgba(255, 255, 255, 0.15)',

  // 卡牌正面
  cardFront: '#f8f9fa',
  cardFrontBorder: '#dee2e6',
  cardFrontShadow: 'rgba(0, 0, 0, 0.15)',

  // 匹配成功
  matchedBg: '#d4edda',
  matchedBorder: '#28a745',
  matchedGlow: 'rgba(40, 167, 69, 0.6)',

  // 不匹配闪烁
  mismatchBorder: '#dc3545',

  // 光标选中
  cursorBorder: '#ff6348',
  cursorGlow: 'rgba(255, 99, 72, 0.4)',

  // 胜利遮罩
  winOverlay: 'rgba(15, 14, 23, 0.88)',
  winTitle: '#2ed573',
  winSubtitle: '#ffd700',
  winPrompt: '#a4b0be',
} as const;

// ========== 卡牌符号（emoji） ==========

/** 18 个 emoji 符号，覆盖最大难度 6×6 = 18 对 */
export const CARD_SYMBOLS: readonly string[] = [
  '🎮', '🎲', '🎯', '🎪', '🎨', '🎭',
  '🎵', '🎸', '🌟', '🔥', '💎', '🌈',
  '🦋', '🐱', '🐶', '🦊', '🐼', '🦁',
] as const;

// ========== 背面装饰图案类型 ==========

export const BACK_PATTERNS = ['diamond', 'cross', 'circle'] as const;
export type BackPattern = (typeof BACK_PATTERNS)[number];
