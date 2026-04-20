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
  AllianceData,
  OfflineActionType,
  OfflineAction,
  OfflineSummary,
  DialogueHistoryEntry,
  NPCInteractionSaveData,
} from './NPCTrainingSystem';
