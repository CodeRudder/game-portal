/**
 * 日本妖怪 (Yokai Night) — 放置类游戏入口
 */
export { YokaiNightEngine } from './YokaiNightEngine';
export type { YokaiBreedState, YokaiNightStatistics, YokaiNightState } from './YokaiNightEngine';
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SPIRIT_PER_CLICK,
  OMAMORI_BONUS_MULTIPLIER,
  PRESTIGE_BASE_OMAMORI,
  MIN_PRESTIGE_SPIRIT,
  RESOURCE_IDS,
  BUILDING_IDS,
  YOKAI_BREEDS,
  BUILDINGS,
  COLORS,
  YOKAI_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
} from './constants';
export type { YokaiBreedDef, BuildingDef } from './constants';
