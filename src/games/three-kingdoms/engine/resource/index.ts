/**
 * 资源域 — 统一导出入口
 *
 * @module engine/resource
 */

export { ResourceSystem } from './ResourceSystem';
export type {
  BonusType, Bonus, ResourceType, Resources, ProductionRate,
  ResourceCap, ResourceCost, CostCheckResult, CapWarning, CapWarningLevel,
  Bonuses, OfflineEarnings, OfflineTierBreakdown, ResourceSaveData,
} from './resource.types';
export {
  RESOURCE_TYPES, RESOURCE_LABELS, RESOURCE_COLORS,
} from './resource.types';
