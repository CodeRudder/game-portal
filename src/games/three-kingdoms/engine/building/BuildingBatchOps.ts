/**
 * 建筑域 — 批量升级操作
 *
 * 职责：批量升级逻辑，按列表顺序依次尝试升级
 * 从 BuildingSystem.ts 拆分以控制文件行数
 *
 * @module engine/building/BuildingBatchOps
 */

import type {
  BuildingType,
  BuildingState,
  UpgradeCost,
  UpgradeCheckResult,
} from './building.types';
import { BUILDING_TYPES } from './building.types';
import type { Resources } from '../resource/resource.types';

/**
 * 批量升级参数接口
 *
 * 封装 BuildingSystem 执行批量升级所需的回调依赖，
 * 避免直接依赖 BuildingSystem 类实例
 */
export interface BatchUpgradeContext {
  /** 获取建筑状态 */
  getBuilding: (type: BuildingType) => Readonly<BuildingState>;
  /** 检查升级条件 */
  checkUpgrade: (type: BuildingType, resources?: Readonly<Resources>) => UpgradeCheckResult;
  /** 执行单个升级 */
  startUpgrade: (type: BuildingType, resources: Resources) => UpgradeCost;
}

/**
 * 批量升级结果
 */
export interface BatchUpgradeResult {
  succeeded: Array<{ type: BuildingType; cost: UpgradeCost }>;
  failed: Array<{ type: BuildingType; reason: string }>;
  totalCost: UpgradeCost;
}

/**
 * 批量升级：按列表顺序依次尝试升级，跳过不可升级的建筑
 *
 * @param types - 要升级的建筑类型列表
 * @param resources - 当前可用资源
 * @param ctx - 批量升级上下文（回调依赖）
 * @returns 批量升级结果
 */
export function batchUpgrade(
  types: BuildingType[],
  resources: Resources,
  ctx: BatchUpgradeContext,
): BatchUpgradeResult {
  const succeeded: Array<{ type: BuildingType; cost: UpgradeCost }> = [];
  const failed: Array<{ type: BuildingType; reason: string }> = [];
  const totalCost: UpgradeCost = { grain: 0, gold: 0, troops: 0, timeSeconds: 0 };
  let remainingGrain = resources.grain;
  let remainingGold = resources.gold;
  let remainingTroops = resources.troops;

  for (const t of types) {
    const currentResources: Resources = {
      grain: remainingGrain,
      gold: remainingGold,
      troops: remainingTroops,
      mandate: resources.mandate,
      techPoint: resources.techPoint,
      recruitToken: resources.recruitToken,
      skillBook: resources.skillBook,
    };
    const check = ctx.checkUpgrade(t, currentResources);
    if (!check.canUpgrade) {
      failed.push({ type: t, reason: check.reasons.join('；') });
      continue;
    }

    try {
      const cost = ctx.startUpgrade(t, currentResources);
      succeeded.push({ type: t, cost });
      totalCost.grain += cost.grain;
      totalCost.gold += cost.gold;
      totalCost.troops += cost.troops;
      totalCost.timeSeconds += cost.timeSeconds;
      remainingGrain -= cost.grain;
      remainingGold -= cost.gold;
      remainingTroops -= cost.troops;
    } catch (e) {
      failed.push({ type: t, reason: e instanceof Error ? e.message : '未知错误' });
    }
  }

  return { succeeded, failed, totalCost };
}
