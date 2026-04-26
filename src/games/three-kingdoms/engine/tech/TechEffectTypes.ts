/**
 * 科技效果 — 类型定义与默认值工厂
 *
 * 从 TechEffectApplier 中提取的类型接口、常量映射和默认值工厂函数。
 *
 * @module engine/tech/TechEffectTypes
 */

// ─────────────────────────────────────────────
// 1. 类型定义
// ─────────────────────────────────────────────

/** 资源类型（与 shared/types 对齐） */
export type ResourceType = 'grain' | 'gold' | 'troops' | 'mandate' | 'techPoint' | 'recruitToken' | 'skillBook';

/** 资源类型到科技效果 target 的映射 */
export const RESOURCE_TARGET_MAP: Record<ResourceType, string> = {
  grain: 'grain',
  gold: 'gold',
  troops: 'troops',
  mandate: 'mandate',
  techPoint: 'techPoint',
  recruitToken: 'recruitToken',
  skillBook: 'skillBook',
};

/** 资源类型到产出速率字段名的映射 */
export type ProductionField = 'grainPerSec' | 'goldPerSec' | 'troopsPerSec' | 'mandatePerSec' | 'techPointPerSec' | 'recruitTokenPerSec' | 'skillBookPerSec';

/** 资源类型 → 产出字段 */
export const RESOURCE_PRODUCTION_MAP: Record<ResourceType, ProductionField> = {
  grain: 'grainPerSec',
  gold: 'goldPerSec',
  troops: 'troopsPerSec',
  mandate: 'mandatePerSec',
  techPoint: 'techPointPerSec',
  recruitToken: 'recruitTokenPerSec',
  skillBook: 'skillBookPerSec',
};

/** 战斗科技加成快照 */
export interface BattleTechBonuses {
  /** 攻击力乘数（1 + bonus%） */
  attackMultiplier: number;
  /** 防御力乘数（1 + bonus%） */
  defenseMultiplier: number;
  /** 暴击率额外加成（百分比） */
  critRateBonus: number;
  /** 暴击伤害额外加成（百分比） */
  critDamageBonus: number;
  /** 伤害额外乘数（1 + bonus%） */
  damageMultiplier: number;
  /** HP 乘数（1 + bonus%） */
  hpMultiplier: number;
}

/** 资源科技加成快照 */
export interface ResourceTechBonuses {
  /** 各资源类型的产出乘数 */
  productionMultipliers: Record<ResourceType, number>;
  /** 各资源类型的存储上限乘数 */
  storageMultipliers: Record<ResourceType, number>;
  /** 交易加成（百分比） */
  tradeBonus: number;
}

/** 文化科技加成快照 */
export interface CultureTechBonuses {
  /** 经验乘数（1 + bonus%） */
  expMultiplier: number;
  /** 研究速度乘数（1 + bonus%） */
  researchSpeedMultiplier: number;
  /** 招募折扣（百分比） */
  recruitDiscount: number;
}

/** 完整科技加成快照 */
export interface AllTechBonuses {
  battle: BattleTechBonuses;
  resource: ResourceTechBonuses;
  culture: CultureTechBonuses;
}

// ─────────────────────────────────────────────
// 2. 默认值工厂
// ─────────────────────────────────────────────

/** 创建默认战斗加成 */
export function defaultBattleBonuses(): BattleTechBonuses {
  return {
    attackMultiplier: 1,
    defenseMultiplier: 1,
    critRateBonus: 0,
    critDamageBonus: 0,
    damageMultiplier: 1,
    hpMultiplier: 1,
  };
}

/** 创建默认资源加成 */
export function defaultResourceBonuses(): ResourceTechBonuses {
  return {
    productionMultipliers: { grain: 1, gold: 1, troops: 1, mandate: 1, techPoint: 1, recruitToken: 1, skillBook: 1 },
    storageMultipliers: { grain: 1, gold: 1, troops: 1, mandate: 1, techPoint: 1, recruitToken: 1, skillBook: 1 },
    tradeBonus: 0,
  };
}

/** 创建默认文化加成 */
export function defaultCultureBonuses(): CultureTechBonuses {
  return {
    expMultiplier: 1,
    researchSpeedMultiplier: 1,
    recruitDiscount: 0,
  };
}
