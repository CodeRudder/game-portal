/**
 * 三国霸业 — 全局 UI 常量
 *
 * 统一品质颜色映射，供所有面板（HeroCard、ArmyTab、EquipmentPanel 等）引用。
 * 品质等级：COMMON(普通) → FINE(精良) → RARE(稀有) → EPIC(史诗) → LEGENDARY(传说)
 *
 * @module common/constants
 */

// ─────────────────────────────────────────────
// 品质主色（用于边框、文字、徽章等）
// ─────────────────────────────────────────────
export const QUALITY_COLORS = {
  common: '#9e9e9e',
  uncommon: '#4caf50',
  rare: '#2196f3',
  epic: '#9c27b0',
  legendary: '#ff9800',
  mythic: '#f44336',
} as const;

// ─────────────────────────────────────────────
// 品质背景色（用于卡片背景、区域底色等）
// ─────────────────────────────────────────────
export const QUALITY_BG_COLORS = {
  common: 'rgba(158,158,158,0.15)',
  uncommon: 'rgba(76,175,80,0.15)',
  rare: 'rgba(33,150,243,0.15)',
  epic: 'rgba(156,39,176,0.15)',
  legendary: 'rgba(255,152,0,0.15)',
  mythic: 'rgba(244,67,54,0.15)',
} as const;

/**
 * 武将品质 → 统一品质色映射
 * 对齐引擎 Quality 枚举: COMMON / FINE / RARE / EPIC / LEGENDARY
 */
export const HERO_QUALITY_COLORS: Record<string, string> = {
  COMMON: QUALITY_COLORS.common,
  FINE: QUALITY_COLORS.rare,
  RARE: QUALITY_COLORS.epic,
  EPIC: QUALITY_COLORS.mythic,
  LEGENDARY: QUALITY_COLORS.legendary,
};

/**
 * 武将品质 → 统一背景色映射
 */
export const HERO_QUALITY_BG_COLORS: Record<string, string> = {
  COMMON: QUALITY_BG_COLORS.common,
  FINE: QUALITY_BG_COLORS.rare,
  RARE: QUALITY_BG_COLORS.epic,
  EPIC: QUALITY_BG_COLORS.mythic,
  LEGENDARY: QUALITY_BG_COLORS.legendary,
};

/**
 * 装备品质 → 统一品质色映射
 * 对齐引擎 EquipmentRarity: white / green / blue / purple / gold
 */
export const EQUIP_QUALITY_COLORS: Record<string, string> = {
  white: QUALITY_COLORS.common,
  green: QUALITY_COLORS.uncommon,
  blue: QUALITY_COLORS.rare,
  purple: QUALITY_COLORS.epic,
  gold: QUALITY_COLORS.legendary,
};

/**
 * 装备品质 → 统一背景色映射
 */
export const EQUIP_QUALITY_BG_COLORS: Record<string, string> = {
  white: QUALITY_BG_COLORS.common,
  green: QUALITY_BG_COLORS.uncommon,
  blue: QUALITY_BG_COLORS.rare,
  purple: QUALITY_BG_COLORS.epic,
  gold: QUALITY_BG_COLORS.legendary,
};
