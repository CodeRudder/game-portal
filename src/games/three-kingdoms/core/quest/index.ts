/**
 * 核心层 — 任务模块统一导出
 *
 * @module core/quest
 */

export type {
  QuestId,
  QuestCategory,
  QuestStatus,
  ObjectiveType,
  QuestObjective,
  QuestReward,
  QuestDef,
  QuestInstance,
  ActivityMilestone,
  ActivityState,
  DailyQuestPoolConfig,
  QuestSystemSaveData,
} from './quest.types';

export {
  OBJECTIVE_EVENT_MAP,
  DEFAULT_ACTIVITY_MILESTONES,
  DEFAULT_DAILY_POOL_CONFIG,
  QUEST_SAVE_VERSION,
} from './quest.types';

export {
  QUEST_MAIN_CHAPTER_1,
  QUEST_MAIN_CHAPTER_2,
  QUEST_MAIN_CHAPTER_3,
  QUEST_SIDE_TECH,
  QUEST_SIDE_NPC,
  DAILY_QUEST_TEMPLATES,
  PREDEFINED_QUESTS,
} from './quest-config';
