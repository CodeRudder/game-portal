/**
 * 三国霸业 — 导出入口
 */

// 引擎层统一导出
export { ThreeKingdomsEngine } from './engine';
export type {
  ResourceSystem,
  BonusType,
  Bonus,
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
  BuildingSystem,
  BuildingType,
  BuildingState,
  BuildingDef,
  UpgradeCost,
  UpgradeCheckResult,
  QueueSlot,
  BuildingSaveData,
} from './engine';

// 共享层
export type {
  EngineEventType,
  EngineEventMap,
  EventListener,
  GameSaveData,
  EngineSnapshot,
  OfflineTier,
} from './shared/types';
