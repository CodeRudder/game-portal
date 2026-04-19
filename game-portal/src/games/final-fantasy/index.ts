/**
 * 最终幻想 (Final Fantasy) — 放置类游戏入口
 *
 * 导出引擎和常量，供外部使用。
 */
export { FinalFantasyEngine } from './FinalFantasyEngine';
export type {
  JobState,
  SummonState,
  FinalFantasyStatistics,
  FinalFantasyState,
} from './FinalFantasyEngine';
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  CRYSTAL_BONUS_MULTIPLIER,
  PRESTIGE_BASE_CRYSTALS,
  MIN_PRESTIGE_GOLD,
  RESOURCE_IDS,
  BUILDING_IDS,
  JOBS,
  SUMMONS,
  BUILDINGS,
  COLORS,
  CHARACTER_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  PROMOTION_COSTS,
  MAX_PROMOTION_LEVEL,
  type JobDef,
  type SummonDef,
  type BuildingDef,
} from './constants';
