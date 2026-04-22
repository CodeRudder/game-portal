/**
 * 引擎层 — v6.0 NPC + Event 模块导出
 *
 * 从 engine/index.ts 拆分出来，避免主文件超500行。
 *
 * @module engine/exports-v6
 */

// ──────────────────────────────────────────────
// v6.0 天下大势 — NPC域
// ──────────────────────────────────────────────

// NPC域 — 系统
export { NPCSystem } from './npc/NPCSystem';
export { NPCDialogSystem } from './npc/NPCDialogSystem';
export type { DialogSelectResult } from './npc/NPCDialogSystem';
export { NPCMapPlacer } from './npc/NPCMapPlacer';
export { NPCFavorabilitySystem } from './npc/NPCFavorabilitySystem';
export { NPCAffinitySystem } from './npc/NPCAffinitySystem';
export { NPCPatrolSystem } from './npc/NPCPatrolSystem';
export { NPCGiftSystem } from './npc/NPCGiftSystem';
export { NPCTrainingSystem } from './npc/NPCTrainingSystem';

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
// v6.0 天下大势 — 事件域
// ──────────────────────────────────────────────

// 事件域 — 系统
export { EventTriggerSystem } from './event/EventTriggerSystem';
export { EventUINotification } from './event/EventUINotification';
export type { EncounterOptionDisplay, EncounterModalData } from './event/EventUINotification';
export { EventNotificationSystem } from './event/EventNotificationSystem';
export { EventChainSystem } from './event/EventChainSystem';
export { EventLogSystem } from './event/EventLogSystem';
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
