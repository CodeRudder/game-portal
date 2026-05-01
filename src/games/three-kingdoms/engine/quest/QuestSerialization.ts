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
  activityState: import('../../core/quest').ActivityState;
  dailyRefreshDate: string;
  dailyQuestInstanceIds: string[];
  trackedQuestIds?: string[];
  instanceCounter?: number;
}): QuestSystemSaveData {
  const getActiveQuests = () => Array.from(data.activeQuests.values());
  return {
    activeQuests: getActiveQuests(),
    completedQuestIds: Array.from(data.completedQuestIds),
    activityState: data.activityState,
    dailyRefreshDate: data.dailyRefreshDate,
    dailyQuestInstanceIds: [...data.dailyQuestInstanceIds],
    trackedQuestIds: data.trackedQuestIds ? [...data.trackedQuestIds] : undefined,
    instanceCounter: data.instanceCounter,
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
    // P0-009 FIX: 验证实例完整性
    if (!inst || !inst.instanceId || !inst.questDefId) continue;
    // 防御 NaN currentCount
    if (inst.objectives && Array.isArray(inst.objectives)) {
      for (const obj of inst.objectives) {
        if (obj && typeof obj.currentCount === 'number' && !Number.isFinite(obj.currentCount)) {
          obj.currentCount = 0;
        }
      }
    }
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
