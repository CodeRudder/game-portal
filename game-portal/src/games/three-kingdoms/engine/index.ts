/**
 * 引擎层 — 统一导出入口
 */

export { ThreeKingdomsEngine } from './ThreeKingdomsEngine';

// 资源域
export { ResourceSystem } from './resource/ResourceSystem';
export type {
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
} from './resource/resource.types';
export {
  RESOURCE_TYPES,
  RESOURCE_LABELS,
  RESOURCE_COLORS,
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
export {
  BUILDING_TYPES,
  BUILDING_LABELS,
  BUILDING_ICONS,
  BUILDING_ZONES,
} from './building/building.types';

// 日历域
export { CalendarSystem } from './calendar/CalendarSystem';
export type {
  Season,
  WeatherType,
  EraEntry,
  GameDate,
  SeasonBonus,
  CalendarState,
  CalendarSaveData,
} from './calendar/calendar.types';
export {
  SEASONS,
  SEASON_LABELS,
  WEATHERS,
  WEATHER_LABELS,
} from './calendar/calendar.types';
