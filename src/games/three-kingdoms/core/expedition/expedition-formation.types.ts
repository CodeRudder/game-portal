/**
 * 远征系统 — 阵型类型定义
 *
 * 从 expedition.types.ts 中提取的阵型相关类型、枚举和常量。
 *
 * @module core/expedition/expedition-formation.types
 */

// ─────────────────────────────────────────────
// 阵型系统
// ─────────────────────────────────────────────

/** 阵型类型 */
export enum FormationType {
  STANDARD = 'STANDARD',
  OFFENSIVE = 'OFFENSIVE',
  DEFENSIVE = 'DEFENSIVE',
  FLANKING = 'FLANKING',
  SIEGE = 'SIEGE',
}

/** 阵型标签映射 */
export const FORMATION_LABELS: Record<FormationType, string> = {
  [FormationType.STANDARD]: '普通阵型',
  [FormationType.OFFENSIVE]: '锋矢阵',
  [FormationType.DEFENSIVE]: '方圆阵',
  [FormationType.FLANKING]: '雁行阵',
  [FormationType.SIEGE]: '攻城阵',
};

/** 阵型效果 */
export interface FormationEffect {
  /** 攻击加成 */
  attackBonus: number;
  /** 防御加成 */
  defenseBonus: number;
  /** 速度加成 */
  speedBonus: number;
  /** 攻击倍率 */
  attackMod: number;
  /** 防御倍率 */
  defenseMod: number;
  /** 速度倍率 */
  speedMod: number;
  /** 智力倍率 */
  intelligenceMod: number;
}

/** 阵型效果映射 */
export const FORMATION_EFFECTS: Record<FormationType, FormationEffect> = {
  [FormationType.STANDARD]: { attackBonus: 0, defenseBonus: 0, speedBonus: 0, attackMod: 0, defenseMod: 0, speedMod: 0, intelligenceMod: 0 },
  [FormationType.OFFENSIVE]: { attackBonus: 0.15, defenseBonus: -0.10, speedBonus: 0.05, attackMod: 0.15, defenseMod: -0.10, speedMod: 0.05, intelligenceMod: 0 },
  [FormationType.DEFENSIVE]: { attackBonus: -0.10, defenseBonus: 0.15, speedBonus: -0.05, attackMod: -0.10, defenseMod: 0.15, speedMod: -0.05, intelligenceMod: 0 },
  [FormationType.FLANKING]: { attackBonus: 0.10, defenseBonus: -0.05, speedBonus: 0.15, attackMod: 0.10, defenseMod: -0.05, speedMod: 0.15, intelligenceMod: 0 },
  [FormationType.SIEGE]: { attackBonus: 0.20, defenseBonus: -0.15, speedBonus: -0.10, attackMod: 0.20, defenseMod: -0.15, speedMod: -0.10, intelligenceMod: 0 },
};

/** 阵型克制映射 */
export const FORMATION_COUNTERS: Record<FormationType, FormationType> = {
  [FormationType.STANDARD]: FormationType.STANDARD,
  [FormationType.OFFENSIVE]: FormationType.DEFENSIVE,
  [FormationType.DEFENSIVE]: FormationType.FLANKING,
  [FormationType.FLANKING]: FormationType.OFFENSIVE,
  [FormationType.SIEGE]: FormationType.STANDARD,
};
