/**
 * 资源域 — 统一导出入口
 *
 * @module engine/resource
 */

export { ResourceSystem } from './ResourceSystem';
export { CopperEconomySystem } from './copper-economy-system';
export type {
  CopperEconomySaveData, CopperEconomyDeps, ShopItem, SpendCategory,
} from './copper-economy-system';
export { MaterialEconomySystem } from './material-economy-system';
export type {
  MaterialEconomySaveData, MaterialEconomyDeps,
} from './material-economy-system';
export type {
  BonusType, Bonus, ResourceType, Resources, ProductionRate,
  ResourceCap, ResourceCost, CostCheckResult, CapWarning, CapWarningLevel,
  Bonuses, OfflineEarnings, OfflineTier, OfflineTierBreakdown, ResourceSaveData,
} from './resource.types';
export {
  RESOURCE_TYPES, RESOURCE_LABELS, RESOURCE_COLORS,
} from './resource.types';
