/**
 * hero-constants — 武将 Hook 共享常量
 *
 * 从原 useHeroEngine.ts 中提取的常量定义，
 * 供各子 Hook 共用。
 *
 * @module components/idle/panels/hero/hooks/hero-constants
 */

// ─────────────────────────────────────────────
// 品质排序权重
// ─────────────────────────────────────────────

/** 品质 → 排序权重映射 */
export const QUALITY_ORDER: Record<string, number> = {
  LEGENDARY: 5,
  EPIC: 4,
  RARE: 3,
  FINE: 2,
  COMMON: 1,
};

// ─────────────────────────────────────────────
// 技能升级消耗表
// ─────────────────────────────────────────────

/** 技能等级 → 消耗表（与引擎对齐） */
export const UPGRADE_COST_TABLE: Record<number, { copper: number; skillBook: number }> = {
  1: { copper: 500, skillBook: 1 },
  2: { copper: 1500, skillBook: 1 },
  3: { copper: 4000, skillBook: 2 },
  4: { copper: 10000, skillBook: 2 },
};

/** 超出表范围时的默认消耗 */
export const DEFAULT_COST = { copper: 10000, skillBook: 2 };

// ─────────────────────────────────────────────
// 属性标签映射
// ─────────────────────────────────────────────

/** 属性 key → 中文标签 */
export const STAT_LABELS: Record<string, string> = {
  attack: '攻击',
  defense: '防御',
  intelligence: '智力',
  speed: '速度',
  hp: '生命',
  critRate: '暴击率',
  critDamage: '暴击伤害',
  skillDamage: '技能伤害',
};

// ─────────────────────────────────────────────
// 编队常量
// ─────────────────────────────────────────────

/** 编队最大槽位数 */
export const MAX_FORMATION_SLOTS = 6;
