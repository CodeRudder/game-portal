/**
 * 引擎层 — 任务系统序列化
 *
 * 从 QuestSystem.ts 拆分，负责序列化/反序列化逻辑。
 *
 * @module engine/quest/QuestSerialization
 */

import type {
  QuestDef,
  QuestInstance,
  QuestSystemSaveData,
} from '../../core/quest';
import {
  DEFAULT_ACTIVITY_MILESTONES,
  QUEST_SAVE_VERSION,
} from '../../core/quest';
import type { QuestId } from '../../core/quest';

// ─────────────────────────────────────────────
// 序列化辅助
// ─────────────────────────────────────────────

/** 序列化任务系统状态 */
export function serializeQuestState(data: {
  activeQuests: Map<string, QuestInstance>;
  completedQuestIds: Set<QuestId>;
  activityState: ReturnType<typeof deserializeActivityState>;
  dailyRefreshDate: string;
  dailyQuestInstanceIds: string[];
}): QuestSystemSaveData {
  const getActiveQuests = () => Array.from(data.activeQuests.values());
  return {
    activeQuests: getActiveQuests(),
    completedQuestIds: Array.from(data.completedQuestIds),
    activityState: data.activityState,
    dailyRefreshDate: data.dailyRefreshDate,
    dailyQuestInstanceIds: [...data.dailyQuestInstanceIds],
    version: QUEST_SAVE_VERSION,
  };
}

/** 反序列化活跃度状态类型 */
export interface ActivityStateData {
  currentPoints: number;
  maxPoints: number;
  milestones: Array<{ points: number; rewards: unknown; claimed: boolean }>;
  lastResetDate: string;
}

/** 反序列化任务系统状态 */
export function deserializeQuestState(
  saveData: QuestSystemSaveData,
  activeQuests: Map<string, QuestInstance>,
  completedQuestIds: Set<QuestId>,
): { dailyRefreshDate: string; dailyQuestInstanceIds: string[]; activityState: ActivityStateData } {
  activeQuests.clear();
  for (const inst of saveData.activeQuests ?? []) {
    activeQuests.set(inst.instanceId, inst);
  }

  completedQuestIds.clear();
  for (const id of saveData.completedQuestIds ?? []) {
    completedQuestIds.add(id);
  }

  const activityState: ActivityStateData = saveData.activityState
    ? {
        currentPoints: saveData.activityState.currentPoints,
        maxPoints: saveData.activityState.maxPoints,
        milestones: saveData.activityState.milestones.map((m) => ({ ...m })),
        lastResetDate: saveData.activityState.lastResetDate ?? '',
      }
    : {
        currentPoints: 0,
        maxPoints: 100,
        milestones: DEFAULT_ACTIVITY_MILESTONES.map((m) => ({ ...m })),
        lastResetDate: '',
      };

  return {
    dailyRefreshDate: saveData.dailyRefreshDate ?? '',
    dailyQuestInstanceIds: saveData.dailyQuestInstanceIds ?? [],
    activityState,
  };
}
