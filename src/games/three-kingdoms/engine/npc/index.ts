/**
 * 引擎层 — NPC 模块统一导出
 *
 * @module engine/npc
 */

export { NPCSystem } from './NPCSystem';
export { NPCDialogSystem } from './NPCDialogSystem';
export type { DialogSelectResult } from './NPCDialogSystem';
export { NPCMapPlacer } from './NPCMapPlacer';
export { NPCFavorabilitySystem } from './NPCFavorabilitySystem';
export { NPCAffinitySystem } from './NPCAffinitySystem';
export { NPCPatrolSystem } from './NPCPatrolSystem';
export { PatrolPathCalculator, type RuntimePatrolState, type MoveCallback, type EventEmitCallback } from './PatrolPathCalculator';
export { NPCGiftSystem } from './NPCGiftSystem';
export { GiftPreferenceCalculator, DEFAULT_PREFERENCES as GIFT_DEFAULT_PREFERENCES, type GiftHistoryEntry } from './GiftPreferenceCalculator';
export { NPCTrainingSystem } from './NPCTrainingSystem';
export type {
  TrainingOutcome,
  TrainingReward,
  TrainingResult,
  TrainingRecord,
  AllianceBonusType,
  AllianceBonus,
  OfflineActionType,
  OfflineAction,
  OfflineSummary,
  DialogueHistoryEntry,
  NPCInteractionSaveData,
} from './NPCTrainingSystem';
export { NPCSpawnSystem } from './NPCSpawnSystem';

// 核心类型（从core层重新导出）
export type {
  NPCProfession, NPCProfessionDef, NPCInteractionType,
  NPCId, NPCData, AffinityLevel,
  NPCMapDisplay, NPCClusterConfig, NPCPlacementResult,
  NPCInfoPopup, NPCAction, DialogNodeId, DialogOption,
  DialogEffect, DialogNode, DialogTree, DialogSession,
  DialogHistoryEntry, NPCSystemState, NPCSaveData,
} from '../../core/npc';
export type {
  AffinityLevelEffect, AffinitySource, AffinityChangeRecord,
  AffinityGainConfig, BondSkillId, BondSkillDef, BondSkillEffect,
  AffinityVisualization, FavorabilityState, FavorabilitySaveData,
} from '../../core/npc';
export {
  AFFINITY_THRESHOLDS, NPC_PROFESSION_DEFS, NPC_PROFESSIONS,
  NPC_PROFESSION_LABELS, AFFINITY_LEVEL_LABELS, NPC_SAVE_VERSION,
  getAffinityLevel, getAffinityProgress, clampAffinity,
} from '../../core/npc';
