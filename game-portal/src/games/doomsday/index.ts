/**
 * 末日生存 (Doomsday) — 放置类游戏入口
 */
export { DoomsdayEngine } from './DoomsdayEngine';
export type {
  ZombieBattleState,
  DoomsdayStatistics,
  DoomsdayState,
} from './DoomsdayEngine';
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SUPPLY_PER_CLICK,
  CHIP_BONUS_MULTIPLIER,
  PRESTIGE_BASE_CHIPS,
  MIN_PRESTIGE_SUPPLY,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  COLORS,
  ZOMBIE_WAVES,
  SCENE_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type BuildingDef,
  type ZombieWaveDef,
} from './constants';
