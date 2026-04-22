/**
 * 引擎层 — v6.0+v7.0 NPC + Event + Quest 模块导出
 *
 * 从 engine/index.ts 拆分出来，避免主文件超500行。
 *
 * @module engine/exports-v6
 */

// ──────────────────────────────────────────────
// v6.0+v7.0 — NPC域
// ──────────────────────────────────────────────

// NPC域 — 系统
export { NPCSystem } from './npc/NPCSystem';
export { NPCDialogSystem } from './npc/NPCDialogSystem';
export type { DialogSelectResult } from './npc/NPCDialogSystem';
export { NPCMapPlacer } from './npc/NPCMapPlacer';
export { NPCFavorabilitySystem } from './npc/NPCFavorabilitySystem';
export { NPCAffinitySystem } from './npc/NPCAffinitySystem';
export { NPCPatrolSystem } from './npc/NPCPatrolSystem';
export { PatrolPathCalculator } from './npc/PatrolPathCalculator';
export type { RuntimePatrolState, MoveCallback, EventEmitCallback } from './npc/PatrolPathCalculator';
export { NPCGiftSystem } from './npc/NPCGiftSystem';
export { GiftPreferenceCalculator, DEFAULT_PREFERENCES as GIFT_DEFAULT_PREFERENCES } from './npc/GiftPreferenceCalculator';
export type { GiftHistoryEntry } from './npc/GiftPreferenceCalculator';
export { NPCTrainingSystem } from './npc/NPCTrainingSystem';
export { NPCSpawnSystem } from './npc/NPCSpawnSystem';

// NPC域 — 类型（从core层重新导出）
export type {
  NPCProfession, NPCProfessionDef, NPCInteractionType,
  NPCId, NPCData, AffinityLevel,
  NPCMapDisplay, NPCClusterConfig, NPCPlacementResult,
  NPCInfoPopup, NPCAction, DialogNodeId, DialogOption,
  DialogEffect, DialogNode, DialogTree, DialogSession,
  DialogHistoryEntry, NPCSystemState, NPCSaveData,
} from '../core/npc';
export type {
  AffinityLevelEffect, AffinitySource, AffinityChangeRecord,
  AffinityGainConfig, BondSkillId, BondSkillDef, BondSkillEffect,
  AffinityVisualization, FavorabilityState, FavorabilitySaveData,
} from '../core/npc';
export {
  AFFINITY_THRESHOLDS, NPC_PROFESSION_DEFS, NPC_PROFESSIONS,
  NPC_PROFESSION_LABELS, AFFINITY_LEVEL_LABELS, NPC_SAVE_VERSION,
  getAffinityLevel, getAffinityProgress, clampAffinity,
} from '../core/npc';

// ──────────────────────────────────────────────
// v6.0+v7.0 — 事件域
// ──────────────────────────────────────────────

// 事件域 — 系统
export { EventTriggerSystem } from './event/EventTriggerSystem';
export { EventUINotification } from './event/EventUINotification';
export type { EncounterOptionDisplay, EncounterModalData } from './event/EventUINotification';
export { EventNotificationSystem } from './event/EventNotificationSystem';
export type { EventNotificationSaveData } from './event/EventNotificationSystem';
export { EventChainSystem } from './event/EventChainSystem';
export type {
  EventChain, EventChainNode, StoryEventDef, StoryLine, StoryChoice,
  EventLogEntry, ReturnAlert, EventChainSaveData,
} from './event/EventChainSystem';
export { ChainEventSystem } from './event/ChainEventSystem';
export type {
  ChainId, ChainNodeId, ChainOptionId, EventChainDef,
  ChainNodeDef, ChainProgress, ChainAdvanceResult, ChainEventSaveData,
} from './event/ChainEventSystem';
export { ChainEventEngine } from './event/ChainEventEngine';
export type {
  ChainEngineId, ChainEngineNodeId, ChainEngineOptionId,
  ChainEventDefV15, ChainNodeDefV15, ChainNodeOption,
  ChainAdvanceResultV15, ChainEngineSaveData,
} from './event/ChainEventEngine';
export { StoryEventSystem } from './event/StoryEventSystem';
export { EventLogSystem } from './event/EventLogSystem';
export { EventTriggerEngine } from './event/EventTriggerEngine';
export { OfflineEventHandler } from './event/OfflineEventHandler';
export { OfflineEventSystem } from './event/OfflineEventSystem';

// 事件域 — 类型（从core层重新导出）
export type {
  EventId, EventTriggerType, EventUrgency, EventStatus, EventScope,
  EventCondition, EventConsequence, EventOption, EventDef, EventInstance,
  EventTriggerResult, EventChoiceResult, BannerId, BannerType,
  EventBanner, BannerState, EncounterId, EncounterPopup,
  EncounterOption, EncounterChoiceResult, EventTriggerConfig,
  EventSystemState, EventSystemSaveData,
} from '../core/event';
export {
  DEFAULT_EVENT_TRIGGER_CONFIG, PREDEFINED_EVENTS, EVENT_SAVE_VERSION,
} from '../core/event';

// ──────────────────────────────────────────────
// v7.0 — 任务域
// ──────────────────────────────────────────────

export { QuestSystem } from './quest/QuestSystem';
export { QuestTrackerSystem } from './quest/QuestTrackerSystem';
export type { QuestJumpTarget, QuestProgressEvent } from './quest/QuestTrackerSystem';
export { DEFAULT_JUMP_TARGETS } from './quest/QuestTrackerSystem';
export { ActivitySystem } from './activity/ActivitySystem';

// 任务域 — 类型（从core层重新导出）
export type {
  QuestId, QuestCategory, QuestStatus, ObjectiveType,
  QuestObjective, QuestReward, QuestDef, QuestInstance,
  ActivityMilestone, ActivityState, DailyQuestPoolConfig,
  QuestSystemSaveData,
} from '../core/quest';
export {
  QUEST_SAVE_VERSION, DAILY_QUEST_TEMPLATES, PREDEFINED_QUESTS,
  DEFAULT_ACTIVITY_MILESTONES, DEFAULT_DAILY_POOL_CONFIG,
} from '../core/quest';
