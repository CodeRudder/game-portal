/**
 * 引擎建筑升级辅助
 *
 * 从 ThreeKingdomsEngine 中拆分出的建筑升级流程。
 * 职责：升级检查、执行升级、取消升级
 *
 * @module engine/engine-building-ops
 */

import type { ResourceSystem } from './resource/ResourceSystem';
import type { BuildingSystem } from './building/BuildingSystem';
import type { EventBus } from '../core/events/EventBus';
import type { BuildingType, UpgradeCost, UpgradeCheckResult } from './building/building.types';

/** 建筑操作上下文 */
export interface BuildingOpsContext {
  readonly resource: ResourceSystem;
  readonly building: BuildingSystem;
  readonly bus: EventBus;
}

/** 检查建筑是否可升级 */
export function checkBuildingUpgrade(
  ctx: BuildingOpsContext,
  type: BuildingType,
): UpgradeCheckResult {
  return ctx.building.checkUpgrade(type, ctx.resource.getResources());
}

/** 获取升级费用 */
export function getBuildingUpgradeCost(
  ctx: BuildingOpsContext,
  type: BuildingType,
): UpgradeCost | null {
  return ctx.building.getUpgradeCost(type);
}

/** 执行建筑升级 */
export function executeBuildingUpgrade(
  ctx: BuildingOpsContext,
  type: BuildingType,
): void {
  const resources = ctx.resource.getResources();
  const check = ctx.building.checkUpgrade(type, resources);
  if (!check.canUpgrade) {
    throw new Error(`无法升级 ${type}：${check.reasons.join('；')}`);
  }
  const cost = ctx.building.getUpgradeCost(type);
  if (!cost) throw new Error(`无法获取 ${type} 的升级费用`);

  ctx.resource.consumeBatch({
    grain: cost.grain,
    gold: cost.gold,
    troops: cost.troops,
  });
  ctx.building.startUpgrade(type, resources);

  ctx.bus.emit('building:upgrade-start', { type, cost });
  ctx.bus.emit('resource:changed', { resources: ctx.resource.getResources() });
}

/** 取消建筑升级，返还80%费用 */
export function cancelBuildingUpgrade(
  ctx: BuildingOpsContext,
  type: BuildingType,
): UpgradeCost | null {
  const refund = ctx.building.cancelUpgrade(type);
  if (!refund) return null;

  if (refund.grain > 0) ctx.resource.addResource('grain', refund.grain);
  if (refund.gold > 0) ctx.resource.addResource('gold', refund.gold);
  if (refund.troops > 0) ctx.resource.addResource('troops', refund.troops);

  ctx.bus.emit('resource:changed', { resources: ctx.resource.getResources() });
  return refund;
}
