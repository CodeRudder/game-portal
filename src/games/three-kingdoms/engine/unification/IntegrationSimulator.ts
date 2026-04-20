/**
 * 引擎层 — 全系统联调模拟数据提供器
 *
 * 从 IntegrationValidator 中拆分出来，包含：
 *   - ISimulationDataProvider 接口
 *   - DefaultSimulationDataProvider 默认实现
 *   - makeStep 工具函数
 *
 * @module engine/unification/IntegrationSimulator
 */

import type { IntegrationStep } from '../../core/unification';

// ─────────────────────────────────────────────
// 模拟数据提供器接口
// ─────────────────────────────────────────────

/** 模拟数据提供器 — 用于注入各系统的模拟数据 */
export interface ISimulationDataProvider {
  getResourceProductionRate(resourceType: string): number;
  getBuildingLevel(buildingId: string): number;
  getBuildingUpgradeCost(buildingId: string, level: number): number;
  getHeroStats(heroId: string): { attack: number; defense: number; hp: number } | null;
  getFormationPower(formationId: string): number;
  getStageEnemyPower(chapter: number, stage: number): number;
  getTechBonus(techId: string): number;
  getReputation(): number;
  getRebirthMultiplier(): number;
  getOfflineReward(seconds: number): number;
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

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 创建检查步骤 */
export function makeStep(
  stepId: string,
  description: string,
  checkFn: () => boolean,
  errorPrefix: string,
): IntegrationStep {
  const start = performance.now();
  let passed = false;
  let error: string | undefined;
  try {
    passed = checkFn();
    if (!passed) {
      error = `${errorPrefix}: Check returned false`;
    }
  } catch (e) {
    error = `${errorPrefix}: ${e instanceof Error ? e.message : String(e)}`;
  }
  return {
    stepId,
    description,
    passed,
    error,
    durationMs: performance.now() - start,
  };
}
