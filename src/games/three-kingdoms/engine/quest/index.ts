/**
 * 引擎层 — 任务模块统一导出
 *
 * @module engine/quest
 */

export { QuestSystem } from './QuestSystem';
export { QuestActivityManager, MAX_ACTIVITY_POINTS } from './QuestActivityManager';
export { QuestDailyManager } from './QuestDailyManager';
export { QuestTrackerSystem } from './QuestTrackerSystem';
export type {
  QuestJumpTarget,
  QuestProgressEvent,
} from './QuestTrackerSystem';
export { DEFAULT_JUMP_TARGETS } from './QuestTrackerSystem';
export {
  serializeQuestState,
  deserializeQuestState,
} from './QuestSerialization';
export type { ActivityStateData } from './QuestSerialization';

// 核心类型（从core层重新导出）
export type {
  QuestId, QuestCategory, QuestStatus, ObjectiveType,
  QuestObjective, QuestReward, QuestDef, QuestInstance,
  DailyQuestPoolConfig,
  QuestSystemSaveData,
} from '../../core/quest';
export {
  QUEST_SAVE_VERSION, DAILY_QUEST_TEMPLATES, PREDEFINED_QUESTS,
  DEFAULT_ACTIVITY_MILESTONES, DEFAULT_DAILY_POOL_CONFIG,
} from '../../core/quest';
