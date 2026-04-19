/**
 * 引擎层 — 统一导出入口
 */

export { ThreeKingdomsEngine } from './ThreeKingdomsEngine';

// 资源域
export { ResourceSystem } from './resource/ResourceSystem';
export type {
  ResourceType,
  Resources,
  ProductionRate,
  ResourceCap,
  ResourceCost,
  CostCheckResult,
  CapWarning,
  CapWarningLevel,
  Bonuses,
  OfflineEarnings,
  OfflineTierBreakdown,
  ResourceSaveData,
} from './resource/resource.types';

// 建筑域
export { BuildingSystem } from './building/BuildingSystem';
export type {
  BuildingType,
  BuildingState,
  BuildingDef,
  UpgradeCost,
  UpgradeCheckResult,
  QueueSlot,
  BuildingSaveData,
} from './building/building.types';
