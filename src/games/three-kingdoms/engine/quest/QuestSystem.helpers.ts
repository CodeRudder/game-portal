/**
 * 引擎层 — 任务系统：日常任务与追踪辅助函数
 *
 * 从 QuestSystem.ts 中提取的日常任务刷新、任务追踪和查询逻辑。
 * 这些函数接收 QuestSystem 的内部状态作为参数，便于独立测试。
 *
 * @module engine/quest/QuestSystem.helpers
 */

import type {
  QuestId, QuestCategory, QuestDef, QuestInstance,
} from '../../core/quest';
import {
  DEFAULT_DAILY_POOL_CONFIG, DAILY_QUEST_TEMPLATES,
} from '../../core/quest';

/** 最大追踪任务数 */
export const MAX_TRACKED_QUESTS = 3;

/** 最大活跃度点数 */
export const MAX_ACTIVITY_POINTS = 100;

// ─── 日常任务辅助 ─────────────────────────────

/** 日常任务刷新的依赖接口 */
export interface DailyQuestDeps {
  activeQuests: Map<string, QuestInstance>;
  dailyQuestInstanceIds: string[];
  dailyRefreshDate: string;
  registerQuest: (def: QuestDef) => void;
  acceptQuest: (questId: QuestId) => QuestInstance | null;
  emit: (event: string, data: unknown) => void;
}

/** 刷新日常任务的纯逻辑 */
export function refreshDailyQuestsLogic(deps: DailyQuestDeps): {
  newInstances: QuestInstance[];
  dailyQuestInstanceIds: string[];
  dailyRefreshDate: string;
} {
  const today = new Date().toISOString().slice(0, 10);
  if (deps.dailyRefreshDate === today) {
    return {
      newInstances: deps.dailyQuestInstanceIds
        .map((id) => deps.activeQuests.get(id))
        .filter(Boolean) as QuestInstance[],
      dailyQuestInstanceIds: deps.dailyQuestInstanceIds,
      dailyRefreshDate: deps.dailyRefreshDate,
    };
  }

  // 清除旧的日常任务
  for (const id of deps.dailyQuestInstanceIds) {
    const instance = deps.activeQuests.get(id);
    if (instance && instance.status === 'active') {
      instance.status = 'expired';
      deps.activeQuests.delete(id);
    }
  }

  // 随机抽取
  const config = DEFAULT_DAILY_POOL_CONFIG;
  const shuffled = [...DAILY_QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, config.dailyPickCount);

  // 注册并接受
  const newInstances: QuestInstance[] = [];
  const dailyQuestInstanceIds: string[] = [];

  for (const def of picked) {
    deps.registerQuest(def);
    const instance = deps.acceptQuest(def.id);
    if (instance) {
      dailyQuestInstanceIds.push(instance.instanceId);
      newInstances.push(instance);
    }
  }

  return { newInstances, dailyQuestInstanceIds, dailyRefreshDate: today };
}

// ─── 任务追踪辅助 ─────────────────────────────

/** 获取追踪中的任务 */
export function getTrackedQuests(
  trackedQuestIds: string[],
  activeQuests: Map<string, QuestInstance>,
): QuestInstance[] {
  return trackedQuestIds
    .map((id) => activeQuests.get(id))
    .filter((q): q is QuestInstance => q !== undefined && q.status === 'active');
}

/** 添加任务到追踪，返回新的追踪列表 */
export function trackQuest(
  instanceId: string,
  trackedQuestIds: string[],
  activeQuests: Map<string, QuestInstance>,
): string[] | null {
  if (trackedQuestIds.includes(instanceId)) return null;
  if (trackedQuestIds.length >= MAX_TRACKED_QUESTS) return null;

  const instance = activeQuests.get(instanceId);
  if (!instance || instance.status !== 'active') return null;

  return [...trackedQuestIds, instanceId];
}

/** 取消追踪，返回新的追踪列表 */
export function untrackQuest(instanceId: string, trackedQuestIds: string[]): string[] | null {
  const idx = trackedQuestIds.indexOf(instanceId);
  if (idx === -1) return null;
  return trackedQuestIds.filter((_, i) => i !== idx);
}

// ─── 查询辅助 ─────────────────────────────────

/** 获取当前日常任务 */
export function getDailyQuests(
  dailyQuestInstanceIds: string[],
  activeQuests: Map<string, QuestInstance>,
): QuestInstance[] {
  return dailyQuestInstanceIds
    .map((id) => activeQuests.get(id))
    .filter((q): q is QuestInstance => q !== undefined);
}

/** 按类型获取活跃任务 */
export function getActiveQuestsByCategory(
  category: QuestCategory,
  activeQuests: Map<string, QuestInstance>,
  questDefs: Map<QuestId, QuestDef>,
): QuestInstance[] {
  return Array.from(activeQuests.values()).filter((q) => {
    const def = questDefs.get(q.questDefId);
    return def?.category === category;
  });
}

// ─── 活跃度系统辅助 ────────────────────────────

import type { ActivityState, QuestReward as QR } from '../../core/quest';
import { DEFAULT_ACTIVITY_MILESTONES } from '../../core/quest';

/** 活跃度操作接口 */
export interface ActivityStateHolder {
  currentPoints: number;
  maxPoints: number;
  milestones: { points: number; claimed: boolean; rewards: QR }[];
  lastResetDate: string;
}

/** 获取活跃度状态副本 */
export function getActivityState(state: ActivityStateHolder): ActivityState {
  return {
    currentPoints: state.currentPoints,
    maxPoints: state.maxPoints,
    milestones: state.milestones.map((m) => ({ ...m })),
    lastResetDate: state.lastResetDate,
  };
}

/** 增加活跃度（不超过最大值） */
export function addActivityPoints(state: ActivityStateHolder, points: number): void {
  state.currentPoints = Math.min(state.currentPoints + points, state.maxPoints);
}

/** 领取活跃度里程碑宝箱 */
export function claimActivityMilestone(
  state: ActivityStateHolder,
  index: number,
): QR | null {
  const milestone = state.milestones[index];
  if (!milestone) return null;
  if (state.currentPoints < milestone.points) return null;
  if (milestone.claimed) return null;

  milestone.claimed = true;
  return milestone.rewards;
}

/** 重置每日活跃度 */
export function resetDailyActivity(state: ActivityStateHolder): void {
  state.currentPoints = 0;
  state.lastResetDate = new Date().toISOString().slice(0, 10);
  state.milestones = DEFAULT_ACTIVITY_MILESTONES.map((m) => ({ ...m }));
}

// ─── 进度更新辅助 ──────────────────────────────

import type { QuestObjective } from '../../core/quest';

/** 按目标类型批量更新进度的回调接口 */
export interface ProgressUpdateContext {
  emit: (event: string, data: unknown) => void;
  completeQuest: (instanceId: string) => void;
  checkQuestCompletion: (instance: QuestInstance) => boolean;
}

/** 按目标类型更新进度（批量） */
export function updateProgressByTypeLogic(
  objectiveType: string,
  count: number,
  activeQuests: Map<string, QuestInstance>,
  ctx: ProgressUpdateContext,
  params?: Record<string, unknown>,
): void {
  for (const instance of activeQuests.values()) {
    if (instance.status !== 'active') continue;

    for (const objective of instance.objectives) {
      if (objective.type !== objectiveType) continue;
      if (objective.currentCount >= objective.targetCount) continue;

      if (params && objective.params) {
        const match = Object.entries(params).every(
          ([key, val]) => objective.params![key] === val,
        );
        if (!match) continue;
      }

      objective.currentCount = Math.min(objective.currentCount + count, objective.targetCount);

      ctx.emit('quest:progress', {
        instanceId: instance.instanceId,
        objectiveId: objective.id,
        currentCount: objective.currentCount,
        targetCount: objective.targetCount,
      });
    }

    if (ctx.checkQuestCompletion(instance)) {
      ctx.completeQuest(instance.instanceId);
    }
  }
}

// ─── 奖励领取辅助 ──────────────────────────────

import type { QuestReward } from '../../core/quest';

/** 奖励领取上下文 */
export interface ClaimRewardContext {
  questDefs: Map<QuestId, QuestDef>;
  activeQuests: Map<string, QuestInstance>;
  addActivityPoints: (points: number) => void;
  activityAddCallback?: (points: number) => void;
  rewardCallback?: (reward: QuestReward) => void;
  emit: (event: string, data: unknown) => void;
}

/** 领取任务奖励 */
export function claimRewardLogic(
  instanceId: string,
  ctx: ClaimRewardContext,
): QuestReward | null {
  const instance = ctx.activeQuests.get(instanceId);
  if (!instance) return null;
  if (instance.status !== 'completed') return null;
  if (instance.rewardClaimed) return null;

  const def = ctx.questDefs.get(instance.questDefId);
  if (!def) return null;

  instance.rewardClaimed = true;

  if (def.category === 'daily' && def.rewards.activityPoints) {
    ctx.addActivityPoints(def.rewards.activityPoints);
    ctx.activityAddCallback?.(def.rewards.activityPoints);
  }

  ctx.rewardCallback?.(def.rewards);

  ctx.emit('quest:rewardClaimed', {
    instanceId,
    questId: instance.questDefId,
    rewards: def.rewards,
  });

  ctx.activeQuests.delete(instanceId);

  return def.rewards;
}

/** 一键领取所有已完成任务的奖励 */
export function claimAllRewardsLogic(
  activeQuests: Map<string, QuestInstance>,
  claimReward: (instanceId: string) => QuestReward | null,
): QuestReward[] {
  const rewards: QuestReward[] = [];
  const completedInstances = Array.from(activeQuests.values())
    .filter((q) => q.status === 'completed' && !q.rewardClaimed);

  for (const instance of completedInstances) {
    const reward = claimReward(instance.instanceId);
    if (reward) rewards.push(reward);
  }

  return rewards;
}
