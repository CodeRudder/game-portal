/**
 * 三国霸业 (Three Kingdoms Conquest) — 放置策略游戏入口
 *
 * 导出引擎和常量，供游戏门户注册使用。
 */
export { ThreeKingdomsEngine } from './ThreeKingdomsEngine';
export type { EngineSaveData as ThreeKingdomsSaveState, Resources, BuildingState, BuildingId, ResourceType } from './ThreeKingdomsEngine';
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

// ── 攻城略地关卡系统 ──
export { ThreeKingdomsCampaignManager } from './ThreeKingdomsCampaignManager';
export {
  CAMPAIGN_STAGE_DEFINITIONS,
  DIFFICULTY_DISPLAY,
  ERA_COLORS,
} from './ThreeKingdomsCampaign';
export type {
  CampaignStage as CampaignStageSimple,
  CampaignEra,
  CampaignRewards,
  StarRating,
  ChallengeResult,
} from './ThreeKingdomsCampaign';

// ── 渲染状态适配器 ──
export { ThreeKingdomsRenderStateAdapter } from './ThreeKingdomsRenderStateAdapter';

// ── 武将对话系统 ──
export { GeneralDialogueSystem, createGeneralDialogueSystem, GENERAL_DIALOGUES, ALL_DIALOGUE_GENERAL_IDS } from './GeneralDialogueSystem';
export type { DialogueScene, DialogueMode, DialogueLine, GeneralDialogueSet, DialogueResult } from './GeneralDialogueSystem';

// ── 武将羁绊系统 ──
export { GeneralBondSystem, createGeneralBondSystem, BOND_DEFINITIONS, GENERAL_REQUEST_TEMPLATES } from './GeneralBondSystem';
export type { BondTier, BondDef, BondDialogue, BondActivationResult, GeneralRequest } from './GeneralBondSystem';

// ── 武将剧情事件系统 ──
export { GeneralStoryEventSystem, createGeneralStoryEventSystem, STORY_EVENT_DEFINITIONS } from './GeneralStoryEventSystem';
export type { StoryTrigger, StoryLine, StoryEventDef, ActiveStoryEvent } from './GeneralStoryEventSystem';

// ── 通用引擎系统集成 ──
export { QuestSystem } from '@/engines/idle/modules/QuestSystem';
export type { QuestDef, QuestType, QuestCondition, QuestReward, QuestState } from '@/engines/idle/modules/QuestSystem';
export { EventSystem } from '@/engines/idle/modules/EventSystem';
export type { GameEvent, EventStatus, EventTier, EventReward, EventShopItem, EventMilestone } from '@/engines/idle/modules/EventSystem';
export { RewardSystem } from '@/engines/idle/modules/RewardSystem';
export type { RewardItem, RewardType, Mail, LoginBonusDef, LevelRewardDef } from '@/engines/idle/modules/RewardSystem';
