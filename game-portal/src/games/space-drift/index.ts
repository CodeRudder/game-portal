/**
 * 太空漂流 (Space Drift) — 放置类游戏入口
 *
 * 玩家驾驶飞船在太空漂流，收集资源升级飞船，
 * 积累矿石、能量、数据三种资源，
 * 探索星系并升级飞船系统。
 */
export { SpaceDriftEngine } from './SpaceDriftEngine';
export type { SpaceDriftState, SpaceDriftStatistics, GalaxyState } from './SpaceDriftEngine';
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ORE_PER_CLICK,
  CREDIT_BONUS_MULTIPLIER,
  PRESTIGE_BASE_CREDITS,
  MIN_PRESTIGE_ORE,
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  GALAXIES,
  COLORS,
  SHIP_DRAW,
  SHIP_UPGRADE_COSTS,
  MAX_SHIP_LEVEL,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  type BuildingDef,
  type GalaxyDef,
} from './constants';
