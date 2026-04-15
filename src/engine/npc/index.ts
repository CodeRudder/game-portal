/**
 * NPC 系统统一导出
 *
 * @module engine/npc
 */

export * from './types';
export { NPCEventBus } from './NPCEventBus';
export { NPCAI } from './NPCAI';
export { NPCManager } from './NPCManager';
export { NPCRenderer } from './NPCRenderer';
export { DailyScheduleSystem, createProfessionSchedule } from './DailyScheduleSystem';
export type {
  ScheduleSegment,
  DailySchedule,
} from './DailyScheduleSystem';
export { RelationshipSystem, RelationshipLevel, NPCRelationType } from './RelationshipSystem';
export type {
  PlayerRelationship,
  NPCRelationship,
  RelationshipChangeReason,
  RelationshipChangeLog,
  RelationshipChangeConfig,
} from './RelationshipSystem';
export {
  QuestBoard,
  QuestType,
  QuestDifficulty,
  QuestStatus,
} from './QuestBoard';
export type {
  Quest,
  QuestObjective,
  QuestReward,
} from './QuestBoard';
export { EnhancedDialogueSystem } from './EnhancedDialogueSystem';
export type {
  EnhancedDialogueTree,
  EnhancedDialogueNode,
  EnhancedDialogueChoice,
  EnhancedDialogueSession,
  DialogueCondition,
  DialogueContext,
  GreetingTemplate,
} from './EnhancedDialogueSystem';
export { NPCRenderEnhancer } from './NPCRenderEnhancer';
