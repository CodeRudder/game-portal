/**
 * Tech effect - types
 *
 * Extracted from TechEffectSystem.ts.
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import { TECH_NODE_DEFS, TECH_NODE_MAP } from './tech-config';
import type { TechTreeSystem } from './TechTreeSystem';
import type { TechEffect } from './tech.types';
// ─────────────────────────────────────────────
// 1. 效果分类定义
// ─────────────────────────────────────────────

export type EffectCategory = 'military' | 'economy' | 'culture';

/** 军事效果统计项 */
export type MilitaryStat =
  | 'attack'        // 攻击力加成 %
  | 'defense'       // 防御力加成 %
  | 'critRate'      // 暴击率加成 %
  | 'critDamage'    // 暴击伤害加成 %
  | 'damageBonus'   // 伤害加成 %
  | 'hp'            // 生命值加成 %
  | 'marchSpeed';   // 行军速度加成 %

/** 经济效果统计项 */
export type EconomyStat =
  | 'production'    // 资源产出加成 %
  | 'storage'       // 资源存储/上限加成 %
  | 'trade';        // 交易加成 %

/** 文化效果统计项 */
export type CultureStat =
  | 'expBonus'        // 经验加成 %
  | 'researchSpeed'   // 研究速度加成 %
  | 'recruitDiscount'; // 招募折扣 %

/** 效果统计项联合类型 */
export type EffectStat = MilitaryStat | EconomyStat | CultureStat;

/** 军事效果类型到统计项的映射 */
export const MILITARY_EFFECT_MAP: Record<string, MilitaryStat> = {
  troop_attack: 'attack',
  troop_defense: 'defense',
  troop_hp: 'hp',
  march_speed: 'marchSpeed',
};

/** 经济效果类型到统计项的映射 */
export const ECONOMY_EFFECT_MAP: Record<string, EconomyStat> = {
  resource_production: 'production',
  resource_cap: 'storage',
};

/** 文化效果类型到统计项的映射 */
export const CULTURE_EFFECT_MAP: Record<string, CultureStat> = {
  hero_exp: 'expBonus',
  research_speed: 'researchSpeed',
  recruit_discount: 'recruitDiscount',
};

// ─────────────────────────────────────────────
// 2. 效果聚合缓存
// ─────────────────────────────────────────────

/** 单条路线的效果缓存 */
export interface PathEffectCache {
  /** 按统计项聚合的值 */
  stats: Map<EffectStat, number>;
  /** 按 target 细分的原始效果 */
  byTarget: Map<string, TechEffect[]>;
  /** 原始效果列表 */
  raw: TechEffect[];
}

/** 完整效果缓存 */
export interface EffectCache {
  military: PathEffectCache;
  economy: PathEffectCache;
  culture: PathEffectCache;
  /** 全局汇总（所有路线合并） */
  global: Map<EffectStat, number>;
  /** 缓存是否有效 */
  valid: boolean;
}

// ─────────────────────────────────────────────
// 3. TechEffectSystem
// ─────────────────────────────────────────────

/**
 * 科技效果统一管理系统
 *
 * 聚合所有已完成科技的效果，提供按路线、按统计项的查询接口。
 * 内部维护效果缓存，仅在科技完成状态变化时刷新。
 */
