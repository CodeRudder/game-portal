/**
 * 三国霸业 (Three Kingdoms Conquest) — 放置策略游戏入口
 *
 * 导出引擎和常量，供游戏门户注册使用。
 */
export { ThreeKingdomsEngine } from './ThreeKingdomsEngine';
export type { ThreeKingdomsSaveState } from './ThreeKingdomsEngine';
export type { GeneralDef } from './constants';
export {
  GAME_ID,
  GAME_TITLE,
  COLOR_THEME,
  BUILDINGS,
  GENERALS,
  TERRITORIES,
  TECHS,
  BATTLES,
  STAGES,
  PRESTIGE_CONFIG,
  RESOURCES,
  INITIAL_RESOURCES,
  CLICK_REWARD,
  RARITY_COLORS,
} from './constants';

// ── Tile 瓦片地图系统 ──
export { MapGenerator } from './MapGenerator';
export type {
  TerrainType,
  MapTile,
  MapNPC,
  MapLandmark,
  GameMap,
} from './MapGenerator';

// ── NPC 活动系统 ──
export { NPCSystem } from './NPCSystem';
export type {
  NPCMovementState,
  NPCDirection,
  NPCRuntimeState,
  NPCSystemConfig,
} from './NPCSystem';

// ── 战斗关卡挑战系统 ──
export { BattleChallengeSystem } from './BattleChallengeSystem';
export type {
  BattleObjective,
  BattleDifficulty,
  BattleEnemy,
  BattleWave,
  BattleRewards,
  BattleChallenge,
} from './BattleChallengeSystem';

// ── 新手引导与剧情系统 ──
export { TutorialStorySystem } from './TutorialStorySystem';
export type {
  TriggerType,
  TutorialStep,
  StoryEvent,
} from './TutorialStorySystem';

// ── 渲染状态适配器 ──
export { ThreeKingdomsRenderStateAdapter } from './ThreeKingdomsRenderStateAdapter';
