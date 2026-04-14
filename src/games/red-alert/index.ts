/**
 * 红色警戒 (Red Alert) — 放置类游戏入口
 *
 * 建设军事基地，积累矿石、电力、科技点，
 * 解锁兵种，研究科技树，重置获得指挥官勋章。
 */
export { RedAlertEngine } from './RedAlertEngine';
export type {
  UnitState,
  TechState,
  RedAlertStatistics,
  RedAlertState,
} from './RedAlertEngine';
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  BUILDING_IDS,
  UNITS,
  BUILDINGS,
  TECHS,
  COLORS,
  ORE_PER_CLICK,
  MEDAL_BONUS_MULTIPLIER,
  MIN_PRESTIGE_ORE,
  type UnitDef,
  type BuildingDef,
  type TechDef,
} from './constants';
