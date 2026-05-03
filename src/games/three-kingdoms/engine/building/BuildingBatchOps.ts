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
 * 批量升级：按顺序检查并执行，资源递减（FIX-404: 事务性保证）
 *
 * 设计：
 * - 逐个检查条件（含资源充足性），通过后立即执行升级。
 * - 资源在执行后递减，后续建筑使用扣减后的资源进行检查。
 * - 若某个建筑执行失败（startUpgrade 抛错），记录失败但继续处理后续建筑。
 * - NaN 资源防护由 checkUpgrade 的 FIX-401 统一处理。
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
  const totalCost: UpgradeCost = { grain: 0, gold: 0, ore: 0, wood: 0, troops: 0, timeSeconds: 0 };
  let remainingGrain = resources.grain;
  let remainingGold = resources.gold;
  let remainingOre = resources.ore;
  let remainingWood = resources.wood;
  let remainingTroops = resources.troops;

  for (const t of types) {
    const currentResources: Resources = {
      grain: remainingGrain,
      gold: remainingGold,
      ore: remainingOre,
      wood: remainingWood,
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
      totalCost.ore += cost.ore;
      totalCost.wood += cost.wood;
      totalCost.troops += cost.troops;
      totalCost.timeSeconds += cost.timeSeconds;
      remainingGrain -= cost.grain;
      remainingGold -= cost.gold;
      remainingOre -= cost.ore;
      remainingWood -= cost.wood;
      remainingTroops -= cost.troops;
    } catch (e) {
      failed.push({ type: t, reason: e instanceof Error ? e.message : '未知错误' });
    }
  }

  return { succeeded, failed, totalCost };
}
