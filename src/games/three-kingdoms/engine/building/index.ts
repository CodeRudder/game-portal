/**
 * 建筑域 — 统一导出入口
 *
 * @module engine/building
 */

export { BuildingSystem } from './BuildingSystem';
export type {
  BuildingType, BuildingState, BuildingDef, UpgradeCost,
  UpgradeCheckResult, QueueSlot, BuildingSaveData,
  BuildingStorage, CollectResult,
} from './building.types';
export {
  BUILDING_TYPES, BUILDING_LABELS, BUILDING_ICONS, BUILDING_ZONES,
} from './building.types';
export { BUILDING_DEFS, BUILDING_UNLOCK_LEVELS } from './building-config';

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

// Sprint 5: 酒馆↔招募桥接
export {
  getRecruitBonus,
  calculateActualRate,
  getTavernUnlockLevel,
  isTavernFeatureUnlocked,
  serializeTavernBridge,
  deserializeTavernBridge,
  TAVERN_BRIDGE_SAVE_VERSION,
} from './tavern-bridge';
export type {
  TavernBridgeSaveData,
} from './tavern-bridge';

// Sprint 5: 市舶司↔贸易桥接
export {
  getTradeDiscount,
  getProsperityBonus,
  getMaxCaravans,
  calculateProsperityLevel,
  calculateMarketGoldBonus,
  applyTradeDiscount,
  serializePortBridge,
  deserializePortBridge,
  PORT_BRIDGE_SAVE_VERSION,
} from './port-bridge';
export type {
  PortBridgeSaveData,
} from './port-bridge';

// BLD-F12: 自动升级系统
export {
  AutoUpgradeSystem,
} from './AutoUpgradeSystem';
export type {
  AutoUpgradeStrategy,
  AutoUpgradeConfig,
  AutoUpgradeResult,
  AutoUpgradeSaveData,
} from './AutoUpgradeSystem';
