/**
 * 科技域 — 科技效果应用器
 *
 * 职责：
 * - 将军事科技加成接入 BattleEngine（攻击/防御/暴击/伤害加成）
 * - 将经济科技加成接入 ResourceSystem（产出/存储加成）
 * - 将文化科技加成接入 HeroLevelSystem（经验加成）
 * - 将文化科技加成接入 TechResearchSystem（研究速度加成）
 * - 统一的 Bonuses 组装，供 engine-tick 消费
 *
 * 设计原则：
 * - 纯计算层，不持有资源/武将的可变状态
 * - 通过回调/接口与各系统解耦
 * - 所有乘数接口返回 1 + bonus/100 的系数
 *
 * @module engine/tech/TechEffectApplier
 */

import type { TechEffectSystem, EffectCategory } from './TechEffectSystem';
import type { Bonuses } from '../resource/resource.types';

// ─────────────────────────────────────────────
// 1. 类型定义
// ─────────────────────────────────────────────

/** 资源类型（与 shared/types 对齐） */
type ResourceType = 'grain' | 'gold' | 'troops' | 'mandate';

/** 资源类型到科技效果 target 的映射 */
const RESOURCE_TARGET_MAP: Record<ResourceType, string> = {
  grain: 'grain',
  gold: 'gold',
  troops: 'troops',
  mandate: 'mandate',
};

/** 资源类型到产出速率字段名的映射 */
type ProductionField = 'grainPerSec' | 'goldPerSec' | 'troopsPerSec' | 'mandatePerSec';

/** 资源类型 → 产出字段 */
const RESOURCE_PRODUCTION_MAP: Record<ResourceType, ProductionField> = {
  grain: 'grainPerSec',
  gold: 'goldPerSec',
  troops: 'troopsPerSec',
  mandate: 'mandatePerSec',
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
function defaultBattleBonuses(): BattleTechBonuses {
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
function defaultResourceBonuses(): ResourceTechBonuses {
  return {
    productionMultipliers: { grain: 1, gold: 1, troops: 1, mandate: 1 },
    storageMultipliers: { grain: 1, gold: 1, troops: 1, mandate: 1 },
    tradeBonus: 0,
  };
}

/** 创建默认文化加成 */
function defaultCultureBonuses(): CultureTechBonuses {
  return {
    expMultiplier: 1,
    researchSpeedMultiplier: 1,
    recruitDiscount: 0,
  };
}

// ─────────────────────────────────────────────
// 3. TechEffectApplier
// ─────────────────────────────────────────────

/**
 * 科技效果应用器
 *
 * 从 TechEffectSystem 读取科技加成数据，
 * 转换为各子系统可直接消费的格式。
 *
 * 使用方式：
 * ```ts
 * const applier = new TechEffectApplier();
 * applier.setTechEffectSystem(techEffectSystem);
 *
 * // 在 engine-tick 中
 * const bonuses = applier.composeResourceBonuses();
 * resourceSystem.tick(dtMs, bonuses);
 *
 * // 在战斗初始化时
 * const battleBonuses = applier.getBattleBonuses('cavalry');
 * ```
 */
export class TechEffectApplier {
  /** 科技效果系统引用 */
  private techEffect: TechEffectSystem | null = null;

  // ─────────────────────────────────────────
  // 依赖注入
  // ─────────────────────────────────────────

  /** 注入科技效果系统 */
  setTechEffectSystem(techEffect: TechEffectSystem): void {
    this.techEffect = techEffect;
  }

  // ─────────────────────────────────────────
  // #22 军事路线效果 → 战斗系统
  // ─────────────────────────────────────────

  /**
   * 获取军事科技战斗加成
   *
   * 合并「全军加成」和「兵种专属加成」
   *
   * @param troopTarget - 兵种类型 target（如 'cavalry', 'infantry'），空字符串表示仅全军
   * @returns 战斗科技加成快照
   */
  getBattleBonuses(troopTarget: string = 'all'): BattleTechBonuses {
    if (!this.techEffect) return defaultBattleBonuses();

    // 全军攻击加成
    const allAtk = this.techEffect.getAttackBonus('all');
    // 兵种专属攻击加成
    const troopAtk = troopTarget !== 'all'
      ? this.techEffect.getAttackBonus(troopTarget)
      : 0;

    // 全军防御加成
    const allDef = this.techEffect.getDefenseBonus('all');
    // 兵种专属防御加成
    const troopDef = troopTarget !== 'all'
      ? this.techEffect.getDefenseBonus(troopTarget)
      : 0;

    // 全军 HP 加成
    const allHp = this.techEffect.getHpBonus('all');
    const troopHp = troopTarget !== 'all'
      ? this.techEffect.getHpBonus(troopTarget)
      : 0;

    // 暴击率加成（从军事科技统计项查询）
    const critRateBonus = this.techEffect.getEffectBonus('military', 'critRate');

    // 暴击伤害加成
    const critDamageBonus = this.techEffect.getEffectBonus('military', 'critDamage');

    // 伤害加成
    const damageBonus = this.techEffect.getEffectBonus('military', 'damageBonus');

    return {
      attackMultiplier: 1 + (allAtk + troopAtk) / 100,
      defenseMultiplier: 1 + (allDef + troopDef) / 100,
      critRateBonus,
      critDamageBonus,
      damageMultiplier: 1 + damageBonus / 100,
      hpMultiplier: 1 + (allHp + troopHp) / 100,
    };
  }

  /**
   * 将军事科技加成应用到攻击力
   *
   * @param baseAttack - 基础攻击力
   * @param troopTarget - 兵种类型
   * @returns 增强后的攻击力
   */
  applyAttackBonus(baseAttack: number, troopTarget: string = 'all'): number {
    const bonuses = this.getBattleBonuses(troopTarget);
    return Math.floor(baseAttack * bonuses.attackMultiplier);
  }

  /**
   * 将军事科技加成应用到防御力
   *
   * @param baseDefense - 基础防御力
   * @param troopTarget - 兵种类型
   * @returns 增强后的防御力
   */
  applyDefenseBonus(baseDefense: number, troopTarget: string = 'all'): number {
    const bonuses = this.getBattleBonuses(troopTarget);
    return Math.floor(baseDefense * bonuses.defenseMultiplier);
  }

  /**
   * 将科技伤害加成应用到伤害结果
   *
   * @param baseDamage - 基础伤害值
   * @param troopTarget - 攻击方兵种类型
   * @returns 增强后的伤害值
   */
  applyDamageBonus(baseDamage: number, troopTarget: string = 'all'): number {
    const bonuses = this.getBattleBonuses(troopTarget);
    return Math.floor(baseDamage * bonuses.damageMultiplier);
  }

  // ─────────────────────────────────────────
  // #23 经济路线效果 → 资源系统
  // ─────────────────────────────────────────

  /**
   * 获取经济科技资源加成
   *
   * @returns 资源科技加成快照
   */
  getResourceBonuses(): ResourceTechBonuses {
    if (!this.techEffect) return defaultResourceBonuses();

    const types: ResourceType[] = ['grain', 'gold', 'troops', 'mandate'];
    const productionMultipliers: Record<ResourceType, number> = {} as Record<ResourceType, number>;
    const storageMultipliers: Record<ResourceType, number> = {} as Record<ResourceType, number>;

    for (const rt of types) {
      const target = RESOURCE_TARGET_MAP[rt];
      // 产出加成 = 全军产出 + 特定资源产出
      const allProd = this.techEffect.getProductionBonus('all');
      const specificProd = this.techEffect.getProductionBonus(target);
      productionMultipliers[rt] = 1 + (allProd + specificProd) / 100;

      // 存储加成
      const allStorage = this.techEffect.getStorageBonus('all');
      const specificStorage = this.techEffect.getStorageBonus(target);
      storageMultipliers[rt] = 1 + (allStorage + specificStorage) / 100;
    }

    // 交易加成
    const tradeBonus = this.techEffect.getEffectBonus('economy', 'trade');

    return { productionMultipliers, storageMultipliers, tradeBonus };
  }

  /**
   * 组装资源系统的 Bonuses 对象
   *
   * 将科技加成转换为 ResourceSystem.tick() 可消费的格式。
   * 科技产出加成会被转换为 tech 字段的值。
   *
   * @param existingBonuses - 已有的其他加成（如主城加成），可选
   * @returns 完整的 Bonuses 对象
   */
  composeResourceBonuses(existingBonuses?: Partial<Bonuses>): Bonuses {
    const resourceBonuses = this.getResourceBonuses();

    // 取所有资源类型产出乘数的平均值作为 tech 加成
    // 如果有特定资源需要精确加成，应使用 getResourceBonuses() 直接获取
    const types: ResourceType[] = ['grain', 'gold', 'troops', 'mandate'];
    let totalProdBonus = 0;
    for (const rt of types) {
      totalProdBonus += (resourceBonuses.productionMultipliers[rt] - 1) * 100;
    }
    const avgProdBonus = totalProdBonus / types.length;

    return {
      castle: existingBonuses?.castle ?? 0,
      tech: avgProdBonus,
      hero: existingBonuses?.hero ?? 0,
      rebirth: existingBonuses?.rebirth ?? 0,
      vip: existingBonuses?.vip ?? 0,
    };
  }

  /**
   * 获取指定资源类型的产出乘数
   *
   * @param resourceType - 资源类型
   * @returns 产出乘数（1 + bonus%）
   */
  getProductionMultiplier(resourceType: ResourceType): number {
    const bonuses = this.getResourceBonuses();
    return bonuses.productionMultipliers[resourceType];
  }

  /**
   * 获取指定资源类型的存储上限乘数
   *
   * @param resourceType - 资源类型
   * @returns 存储乘数（1 + bonus%）
   */
  getStorageMultiplier(resourceType: ResourceType): number {
    const bonuses = this.getResourceBonuses();
    return bonuses.storageMultipliers[resourceType];
  }

  // ─────────────────────────────────────────
  // #24 文化路线效果 → 经验/研究/招募
  // ─────────────────────────────────────────

  /**
   * 获取文化科技加成
   *
   * @returns 文化科技加成快照
   */
  getCultureBonuses(): CultureTechBonuses {
    if (!this.techEffect) return defaultCultureBonuses();

    return {
      expMultiplier: this.techEffect.getExpMultiplier(),
      researchSpeedMultiplier: this.techEffect.getResearchSpeedMultiplier(),
      recruitDiscount: this.techEffect.getRecruitDiscount(),
    };
  }

  /**
   * 将经验加成应用到经验值
   *
   * @param baseExp - 基础经验值
   * @returns 加成后的经验值
   */
  applyExpBonus(baseExp: number): number {
    const bonuses = this.getCultureBonuses();
    return Math.floor(baseExp * bonuses.expMultiplier);
  }

  /**
   * 将研究速度加成应用到研究时间
   *
   * @param baseTimeSec - 基础研究时间（秒）
   * @returns 加成后的研究时间（秒）
   */
  applyResearchSpeedBonus(baseTimeSec: number): number {
    const bonuses = this.getCultureBonuses();
    return baseTimeSec / bonuses.researchSpeedMultiplier;
  }

  /**
   * 将招募折扣应用到招募费用
   *
   * @param baseCost - 基础招募费用
   * @returns 折扣后的费用（不低于 0）
   */
  applyRecruitDiscount(baseCost: number): number {
    const bonuses = this.getCultureBonuses();
    const discount = bonuses.recruitDiscount / 100;
    return Math.max(0, Math.floor(baseCost * (1 - discount)));
  }

  // ─────────────────────────────────────────
  // 综合查询
  // ─────────────────────────────────────────

  /**
   * 获取所有科技加成的完整快照
   *
   * @param troopTarget - 兵种类型（用于战斗加成）
   * @returns 完整科技加成
   */
  getAllBonuses(troopTarget: string = 'all'): AllTechBonuses {
    return {
      battle: this.getBattleBonuses(troopTarget),
      resource: this.getResourceBonuses(),
      culture: this.getCultureBonuses(),
    };
  }

  /**
   * 获取科技加成摘要（用于 UI 展示）
   *
   * @returns 可读的加成摘要
   */
  getBonusSummary(): Record<string, Record<string, number>> {
    if (!this.techEffect) {
      return {
        military: {},
        economy: {},
        culture: {},
      };
    }

    return this.techEffect.getAllBonuses();
  }
}
