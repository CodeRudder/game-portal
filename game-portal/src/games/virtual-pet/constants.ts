/**
 * 电子宠物 Virtual Pet — 常量定义
 */

/** Canvas 尺寸 */
export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// ========== 属性系统 ==========

/** 属性范围 */
export const STAT_MIN = 0;
export const STAT_MAX = 100;

/** 属性自然衰减速率（每秒） */
export const DECAY_RATES = {
  hunger: 0.5,    // 饥饿度每秒衰减
  cleanliness: 0.3, // 清洁度每秒衰减
  happiness: 0.4,   // 快乐度每秒衰减
  energy: 0.35,     // 体力每秒衰减
} as const;

/** 操作效果值 */
export const ACTION_EFFECTS = {
  feed: { hunger: 25, happiness: 5, energy: 0, cleanliness: -3 },
  bath: { cleanliness: 30, happiness: -5, energy: -5, hunger: 0 },
  play: { happiness: 25, energy: -15, hunger: -10, cleanliness: -5 },
  sleep: { energy: 40, hunger: -5, happiness: 0, cleanliness: 0 },
} as const;

/** 操作冷却时间（毫秒） */
export const ACTION_COOLDOWNS = {
  feed: 1000,
  bath: 1000,
  play: 1000,
  sleep: 2000,
} as const;

// ========== 心情系统 ==========

/** 心情类型 */
export enum Mood {
  HAPPY = 'happy',
  NORMAL = 'normal',
  SAD = 'sad',
  SICK = 'sick',
}

/** 心情判定阈值 */
export const MOOD_THRESHOLDS = {
  happy: 70,    // 平均属性 >= 70 → 开心
  normal: 40,   // 平均属性 >= 40 → 普通
  sad: 20,      // 平均属性 >= 20 → 难过
  // 低于 20 → 生病
} as const;

/** 生病判定阈值 */
export const SICK_THRESHOLDS = {
  hunger: 10,     // 饥饿度 < 10 → 生病
  cleanliness: 10, // 清洁度 < 10 → 生病
} as const;

// ========== 成长阶段 ==========

/** 成长阶段 */
export enum GrowthStage {
  EGG = 'egg',
  BABY = 'baby',
  CHILD = 'child',
  ADULT = 'adult',
}

/** 成长阶段所需累计时间（毫秒） */
export const GROWTH_THRESHOLDS: [GrowthStage, number][] = [
  [GrowthStage.ADULT, 120_000],   // 2 分钟 → 成年
  [GrowthStage.CHILD, 60_000],    // 1 分钟 → 少年
  [GrowthStage.BABY, 20_000],     // 20 秒 → 幼年
  [GrowthStage.EGG, 0],           // 0 → 蛋
];

// ========== 属性面板 ==========

/** 属性面板定义 */
export const STAT_PANELS = [
  { key: 'hunger' as const, label: '饱食度', icon: '🍖', color: '#ff6b6b' },
  { key: 'cleanliness' as const, label: '清洁度', icon: '🛁', color: '#4ecdc4' },
  { key: 'happiness' as const, label: '快乐度', icon: '⭐', color: '#ffd93d' },
  { key: 'energy' as const, label: '体力值', icon: '⚡', color: '#6c5ce7' },
] as const;

/** 操作按钮定义 */
export const ACTION_BUTTONS = [
  { key: 'feed' as const, label: '喂食', icon: '🍖', hotkey: '1' },
  { key: 'bath' as const, label: '洗澡', icon: '🛁', hotkey: '2' },
  { key: 'play' as const, label: '玩耍', icon: '🎾', hotkey: '3' },
  { key: 'sleep' as const, label: '睡觉', icon: '💤', hotkey: '4' },
] as const;

// ========== 颜色主题 ==========

export const COLORS = {
  bg: '#1a0a2e',
  bgGradient1: '#1a0a2e',
  bgGradient2: '#16213e',
  panelBg: 'rgba(30, 20, 60, 0.85)',
  panelBorder: 'rgba(100, 200, 255, 0.3)',
  textPrimary: '#ffffff',
  textSecondary: '#b0b0c0',
  textDim: '#606080',
  accent: '#00e5ff',
  accentPink: '#ff6b9d',
  accentGreen: '#00e676',
  accentGold: '#ffd700',
  barBg: 'rgba(255, 255, 255, 0.1)',
  selectedBg: 'rgba(0, 229, 255, 0.15)',
  selectedBorder: 'rgba(0, 229, 255, 0.6)',
  moodHappy: '#00e676',
  moodNormal: '#ffd93d',
  moodSad: '#ff9800',
  moodSick: '#ff4757',
  petBody: '#7c4dff',
  petBodyLight: '#b388ff',
  petBodyDark: '#4a148c',
  petEye: '#ffffff',
  petPupil: '#1a0a2e',
  petCheek: '#ff8a80',
  petMouth: '#ff80ab',
} as const;

// ========== 宠物绘制参数 ==========

export const PET_DRAW = {
  centerX: 240,
  centerY: 260,
  bodyRadius: 60,
  eyeOffsetX: 20,
  eyeOffsetY: -10,
  eyeRadius: 10,
  pupilRadius: 5,
  cheekOffsetX: 35,
  cheekOffsetY: 10,
  cheekRadius: 8,
  mouthY: 15,
} as const;

// ========== 动画参数 ==========

export const ANIM = {
  breatheSpeed: 0.003,      // 呼吸动画速度
  breatheAmount: 3,          // 呼吸幅度
  bounceSpeed: 0.01,         // 弹跳速度
  bounceAmount: 5,           // 弹跳幅度
  sleepBobSpeed: 0.002,      // 睡觉摇摆速度
  sickShakeSpeed: 0.02,      // 生病颤抖速度
  sickShakeAmount: 3,        // 生病颤抖幅度
  actionAnimDuration: 500,   // 操作动画持续时间（毫秒）
} as const;

/** 属性键类型 */
export type StatKey = 'hunger' | 'cleanliness' | 'happiness' | 'energy';

/** 操作键类型 */
export type ActionKey = 'feed' | 'bath' | 'play' | 'sleep';
