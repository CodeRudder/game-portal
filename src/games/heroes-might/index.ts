/**
 * 英雄无敌 (Heroes Might) — 放置类游戏入口
 *
 * 玩法：
 * - 点击获得金币，建设城堡建筑
 * - 招募英雄，进化提升加成
 * - 施放魔法获得临时增益
 * - 积累荣耀勋章获得永久加成
 */
export { HeroesMightEngine } from './HeroesMightEngine';
export type {
  HeroesMightState,
  HeroesMightStatistics,
  HeroState,
  ActiveSpell,
  SpellCooldown,
} from './HeroesMightEngine';
export {
  RESOURCE_IDS,
  BUILDING_IDS,
  BUILDINGS,
  HEROES,
  SPELLS,
  COLORS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GOLD_PER_CLICK,
  MIN_PRESTIGE_GOLD,
  HONOR_BONUS_MULTIPLIER,
  EVOLUTION_COSTS,
  MAX_EVOLUTION_LEVEL,
  type BuildingDef,
  type HeroDef,
  type SpellDef,
} from './constants';
