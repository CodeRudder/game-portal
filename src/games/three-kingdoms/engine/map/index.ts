/**
 * 引擎层 — 世界地图模块统一导出
 *
 * @module engine/map
 */

export { WorldMapSystem } from './WorldMapSystem';
export { MapDataRenderer } from './MapDataRenderer';
export { MapFilterSystem } from './MapFilterSystem';
export { TerritorySystem } from './TerritorySystem';
export { SiegeSystem } from './SiegeSystem';
export { GarrisonSystem } from './GarrisonSystem';
export { SiegeEnhancer } from './SiegeEnhancer';

export type {
  SiegeErrorCode,
  SiegeConditionResult,
  SiegeCost,
  SiegeResult,
  SiegeState,
  SiegeSaveData,
} from './SiegeSystem';
