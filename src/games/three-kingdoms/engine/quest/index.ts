/**
 * 引擎层 — 任务模块统一导出
 *
 * @module engine/quest
 */

export { QuestSystem } from './QuestSystem';
export { QuestTrackerSystem } from './QuestTrackerSystem';
export type {
  QuestJumpTarget,
  QuestProgressEvent,
} from './QuestTrackerSystem';
export { DEFAULT_JUMP_TARGETS } from './QuestTrackerSystem';
