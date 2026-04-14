/**
 * 三国志 (Three Kingdoms) — 放置类游戏入口
 *
 * 导出引擎和常量，供游戏门户注册使用。
 */
export { ThreeKingdomsEngine } from './ThreeKingdomsEngine';
export type { ThreeKingdomsState, ThreeKingdomsStatistics, GeneralState } from './ThreeKingdomsEngine';
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRAIN_PER_CLICK,
  MANDATE_BONUS_MULTIPLIER,
  MIN_PRESTIGE_GRAIN,
  RESOURCE_IDS,
  BUILDING_IDS,
  GENERALS,
  BUILDINGS,
  COLORS,
  SCENE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
} from './constants';
export type { GeneralDef, BuildingDef } from './constants';
