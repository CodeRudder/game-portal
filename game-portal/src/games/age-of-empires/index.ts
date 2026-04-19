/**
 * 帝国时代 (Age of Empires) — 放置类游戏入口
 *
 * 导出引擎和常量，供外部使用。
 */
export { AgeOfEmpiresEngine } from './AgeOfEmpiresEngine';
export type {
  AgeOfEmpiresState,
  AgeOfEmpiresStatistics,
  CivilizationUpgradeState,
} from './AgeOfEmpiresEngine';
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FOOD_PER_CLICK,
  GLORY_BONUS_MULTIPLIER,
  PRESTIGE_BASE_GLORY,
  MIN_PRESTIGE_FOOD,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  AGES,
  CIVILIZATION_UPGRADES,
  COLORS,
  CASTLE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
} from './constants';
export type {
  BuildingDef,
  AgeDef,
  CivilizationUpgradeDef,
} from './constants';
