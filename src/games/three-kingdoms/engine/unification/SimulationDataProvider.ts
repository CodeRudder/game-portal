/**
 * 引擎层 — 模拟数据提供器
 *
 * 为全系统联调验证器提供模拟数据接口和默认实现。
 * 从 IntegrationValidator 拆分而来。
 *
 * @module engine/unification/SimulationDataProvider
 */

// ─────────────────────────────────────────────
// 模拟数据提供器接口
// ─────────────────────────────────────────────

/** 模拟数据提供器 — 用于注入各系统的模拟数据 */
export interface ISimulationDataProvider {
  /** 获取资源产出速率 */
  getResourceProductionRate(resourceType: string): number;
  /** 获取建筑等级 */
  getBuildingLevel(buildingId: string): number;
  /** 获取建筑升级费用 */
  getBuildingUpgradeCost(buildingId: string, level: number): number;
  /** 获取武将属性 */
  getHeroStats(heroId: string): { attack: number; defense: number; hp: number } | null;
  /** 获取编队战力 */
  getFormationPower(formationId: string): number;
  /** 获取关卡敌方战力 */
  getStageEnemyPower(chapter: number, stage: number): number;
  /** 获取科技加成 */
  getTechBonus(techId: string): number;
  /** 获取声望值 */
  getReputation(): number;
  /** 获取转生倍率 */
  getRebirthMultiplier(): number;
  /** 获取离线收益 */
  getOfflineReward(seconds: number): number;
  /** 获取装备属性加成 */
  getEquipmentBonus(equipmentId: string): number;
}

// ─────────────────────────────────────────────
// 默认模拟数据
// ─────────────────────────────────────────────

/** 默认模拟数据提供器 */
export class DefaultSimulationDataProvider implements ISimulationDataProvider {
  private data = {
    resourceRates: { grain: 10, gold: 5, troops: 2, mandate: 0.5 },
    buildingLevels: { farm: 5, barracks: 3, academy: 2 },
    upgradeCosts: { farm_5: 500, barracks_3: 300, academy_2: 200 },
    heroStats: { hero_1: { attack: 100, defense: 80, hp: 500 } },
    formationPower: 2500,
    stagePowers: { '1-1': 500, '1-2': 800, '1-3': 1200 },
    techBonuses: { tech_1: 0.1, tech_2: 0.15 },
    reputation: 1500,
    rebirthMultiplier: 1.88,
    equipmentBonuses: { equip_1: 50 },
  };

  getResourceProductionRate(resourceType: string): number {
    return this.data.resourceRates[resourceType as keyof typeof this.data.resourceRates] ?? 0;
  }
  getBuildingLevel(buildingId: string): number {
    return this.data.buildingLevels[buildingId as keyof typeof this.data.buildingLevels] ?? 0;
  }
  getBuildingUpgradeCost(buildingId: string, level: number): number {
    const key = `${buildingId}_${level}`;
    return this.data.upgradeCosts[key as keyof typeof this.data.upgradeCosts] ?? level * 100;
  }
  getHeroStats(heroId: string): { attack: number; defense: number; hp: number } | null {
    return this.data.heroStats[heroId as keyof typeof this.data.heroStats] ?? null;
  }
  getFormationPower(formationId: string): number {
    void formationId;
    return this.data.formationPower;
  }
  getStageEnemyPower(chapter: number, stage: number): number {
    const key = `${chapter}-${stage}`;
    return this.data.stagePowers[key as keyof typeof this.data.stagePowers] ?? 1000;
  }
  getTechBonus(techId: string): number {
    return this.data.techBonuses[techId as keyof typeof this.data.techBonuses] ?? 0;
  }
  getReputation(): number {
    return this.data.reputation;
  }
  getRebirthMultiplier(): number {
    return this.data.rebirthMultiplier;
  }
  getOfflineReward(seconds: number): number {
    return seconds * 5;
  }
  getEquipmentBonus(equipmentId: string): number {
    return this.data.equipmentBonuses[equipmentId as keyof typeof this.data.equipmentBonuses] ?? 0;
  }
}
