/**
 * 博德之门 (Baldur's Gate) — 游戏入口
 */
export { BaldursGateEngine } from './BaldursGateEngine';
export type { BaldursGateStatistics, BaldursGateState, CompanionState, DungeonExploreState } from './BaldursGateEngine';
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  BUILDING_IDS,
  GOLD_PER_CLICK,
  PRESTIGE_BONUS_MULTIPLIER,
  PRESTIGE_BASE_FATE,
  MIN_PRESTIGE_GOLD,
  COMPANIONS,
  BUILDINGS,
  DUNGEONS,
  COMPANION_UPGRADE_COSTS,
  MAX_COMPANION_LEVEL,
  COLORS,
  HERO_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type CompanionDef,
  type BuildingDef,
  type DungeonDef,
} from './constants';
