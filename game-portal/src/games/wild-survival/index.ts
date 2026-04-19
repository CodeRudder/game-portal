/**
 * 野外求生 (Wild Survival) — 放置类游戏入口
 *
 * 导出引擎和常量，供游戏门户注册使用。
 */
export { WildSurvivalEngine } from './WildSurvivalEngine';
export type { WildSurvivalState, WildSurvivalStatistics, SkillState } from './WildSurvivalEngine';
export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  RESOURCE_IDS,
  BUILDING_IDS,
  STONE_PER_CLICK,
  MIN_PRESTIGE_STONE,
  WISDOM_BONUS_MULTIPLIER,
  PRESTIGE_BASE_WISDOM,
  BUILDINGS,
  SKILLS,
  COLORS,
  CAMP_DRAW,
  BUILDING_PANEL,
  RESOURCE_PANEL,
  SEASON_PANEL,
  SEASON_ORDER,
  SEASON_NAMES,
  SEASON_ICONS,
  SEASON_MULTIPLIERS,
  SEASON_DURATION,
  type Season,
  type BuildingDef,
  type SkillDef,
} from './constants';
