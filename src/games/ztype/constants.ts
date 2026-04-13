// ========== ZType 打字练习 — 游戏常量 ==========

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

/** 游戏区域边距 */
export const PADDING_TOP = 60;
export const PADDING_BOTTOM = 40;
export const PADDING_SIDE = 20;

/** 单词设置 */
export const WORD_FONT_SIZE = 20;
export const WORD_FONT_FAMILY = 'monospace';
export const WORD_HIGHLIGHT_COLOR = '#00ff88';
export const WORD_NORMAL_COLOR = '#ffffff';
export const WORD_TYPED_COLOR = '#ffcc00';
export const WORD_DESTROY_COLOR = '#ff6348';

/** 玩家设置 */
export const INITIAL_LIVES = 5;
export const MAX_LIVES = 5;

/** 分数设置 */
export const BASE_SCORE_PER_LETTER = 10;
export const COMBO_MULTIPLIER_BONUS = 0.5; // 每级连击额外倍率
export const MAX_COMBO_MULTIPLIER = 5.0;

/** 难度设置 */
export const INITIAL_FALL_SPEED = 30; // 像素/秒
export const SPEED_INCREMENT_PER_LEVEL = 5; // 每级速度增量
export const INITIAL_SPAWN_INTERVAL = 2500; // 毫秒
export const MIN_SPAWN_INTERVAL = 800;
export const SPAWN_INTERVAL_DECREASE = 100; // 每级减少
export const WORDS_PER_LEVEL = 10; // 每消灭多少个单词升一级
export const MAX_LEVEL = 20;

/** 连击设置 */
export const COMBO_TIMEOUT = 3000; // 毫秒，连击超时时间

/** WPM 计算设置 */
export const WPM_CALCULATION_INTERVAL = 1000; // 毫秒

/** HUD 设置 */
export const HUD_HEIGHT = 50;
export const HUD_BG_COLOR = 'rgba(0, 0, 0, 0.6)';
export const HUD_TEXT_COLOR = '#ffffff';
export const HUD_SCORE_COLOR = '#00ff88';
export const HUD_LIVES_COLOR = '#ff4757';
export const HUD_COMBO_COLOR = '#ffcc00';
export const HUD_WPM_COLOR = '#00bfff';
export const HUD_LEVEL_COLOR = '#a855f7';

/** 输入显示 */
export const INPUT_DISPLAY_Y = CANVAS_HEIGHT - PADDING_BOTTOM;
export const INPUT_DISPLAY_COLOR = '#00ff88';
export const INPUT_CURSOR_COLOR = '#ffffff';

/** 爆炸效果 */
export const EXPLOSION_DURATION = 500; // 毫秒
export const EXPLOSION_PARTICLES = 8;

/** 背景星星 */
export const STAR_COUNT = 50;
export const STAR_MIN_SPEED = 10;
export const STAR_MAX_SPEED = 40;

// ========== 词库（至少 100 个常见英文单词） ==========
export const WORD_LIST: string[] = [
  // 3 字母简单词 (30个)
  'ace', 'bad', 'cat', 'dog', 'ear', 'fan', 'gap', 'hat', 'ice', 'jam',
  'key', 'log', 'map', 'net', 'oak', 'pen', 'run', 'sun', 'top', 'van',
  'web', 'box', 'cup', 'dip', 'egg', 'fig', 'gum', 'hop', 'ink', 'jar',
  // 4 字母简单词 (15个)
  'book', 'cold', 'dark', 'fast', 'gold', 'help', 'jump', 'king',
  'lamp', 'moon', 'nest', 'rain', 'ship', 'tree', 'wind',
  // 5 字母中等词 (25个)
  'apple', 'beach', 'cloud', 'dance', 'eagle', 'flame', 'grape', 'heart',
  'image', 'juice', 'knife', 'lemon', 'magic', 'night', 'ocean', 'piano',
  'queen', 'river', 'stone', 'tiger', 'uncle', 'voice', 'water', 'youth',
  'zebra',
  // 6 字母较难词 (20个)
  'anchor', 'bridge', 'castle', 'desert', 'empire', 'forest', 'garden',
  'hammer', 'island', 'jungle', 'kitten', 'launch', 'mirror', 'nature',
  'orange', 'planet', 'rabbit', 'silver', 'temple', 'window',
  // 7+ 字母困难词 (15个)
  'amazing', 'balance', 'captain', 'diamond', 'eclipse', 'fantasy',
  'gateway', 'harmony', 'imagine', 'journey', 'kitchen', 'library',
  'machine', 'network', 'package',
];

/** 按难度分级的词库索引 */
export const WORD_TIERS: { minLevel: number; maxLength: number }[] = [
  { minLevel: 1, maxLength: 4 },   // 等级 1-2: 3-4 字母
  { minLevel: 3, maxLength: 5 },   // 等级 3-4: 最多 5 字母
  { minLevel: 5, maxLength: 6 },   // 等级 5-6: 最多 6 字母
  { minLevel: 7, maxLength: 99 },  // 等级 7+: 所有单词
];

// ========== 类型定义 ==========

/** 飘落单词 */
export interface FallingWord {
  id: number;
  text: string;
  x: number;         // 单词中心 x 坐标
  y: number;         // 当前 y 坐标（顶部）
  speed: number;     // 下落速度（像素/秒）
  typed: number;     // 已匹配的字母数
  active: boolean;   // 是否是当前输入目标
  destroying: boolean;
  destroyTime: number;
}

/** 爆炸粒子 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/** 背景星星 */
export interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  brightness: number;
}

/** ZType 游戏状态 */
export interface ZTypeState {
  words: FallingWord[];
  input: string;
  score: number;
  lives: number;
  level: number;
  combo: number;
  maxCombo: number;
  comboMultiplier: number;
  wpm: number;
  totalTypedLetters: number;
  wordsDestroyed: number;
  gameStatus: 'idle' | 'playing' | 'paused' | 'gameover';
  lastSpawnTime: number;
  lastComboTime: number;
  startTime: number;
  particles: Particle[];
  stars: Star[];
}
