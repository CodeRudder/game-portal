/**
 * 建筑域 — 统一导出入口
 *
 * @module engine/building
 */

export { BuildingSystem } from './BuildingSystem';
export type {
  BuildingType, BuildingState, BuildingDef, UpgradeCost,
  UpgradeCheckResult, QueueSlot, BuildingSaveData,
} from './building.types';
export {
  BUILDING_TYPES, BUILDING_LABELS, BUILDING_ICONS, BUILDING_ZONES,
} from './building.types';
export { BUILDING_DEFS } from './building-config';

// 拆分模块
export {
  getAppearanceStage,
  createInitialState,
  createAllStates,
} from './BuildingStateHelpers';
export {
  batchUpgrade,
} from './BuildingBatchOps';
export type {
  BatchUpgradeContext,
  BatchUpgradeResult,
} from './BuildingBatchOps';
