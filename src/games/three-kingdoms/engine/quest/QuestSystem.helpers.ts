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
  const config = DEFAULT_DAILY_POOL_CONFIG;
  const now = new Date();
  // 使用 refreshHour 配置判断刷新日期：如果当前时间在 refreshHour 之前，刷新日期为昨天
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < config.refreshHour) {
    todayDate.setDate(todayDate.getDate() - 1);
  }
  const today = todayDate.toISOString().slice(0, 10);
  if (deps.dailyRefreshDate === today) {
    return {
      newInstances: deps.dailyQuestInstanceIds
        .map((id) => deps.activeQuests.get(id))
        .filter(Boolean) as QuestInstance[],
      dailyQuestInstanceIds: deps.dailyQuestInstanceIds,
      dailyRefreshDate: deps.dailyRefreshDate,
    };
  }

  // 清除旧的日常任务（P2-9修复：已完成未领取的奖励自动领取）
  for (const id of deps.dailyQuestInstanceIds) {
    const instance = deps.activeQuests.get(id);
    if (instance) {
      if (instance.status === 'completed' && !instance.rewardClaimed) {
        // P2-9: 自动领取已完成但未领取的奖励，避免奖励丢失
        instance.rewardClaimed = true;
        instance.status = 'expired';
        deps.emit('quest:autoClaimed', {
          instanceId: id,
          questId: instance.questDefId,
          reason: 'daily_refresh',
        });
      } else {
        instance.status = 'expired';
      }
      deps.activeQuests.delete(id);
    }
  }

  // 使用多样性保证算法抽取日常任务（PRD §QST-3）
  const picked = pickDailyWithDiversity([...DAILY_QUEST_TEMPLATES], config.dailyPickCount);

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

/** 增加活跃度（不超过最大值，不低于0） */
export function addActivityPoints(state: ActivityStateHolder, points: number): void {
  // P0-001 FIX: NaN 防护 — !Number.isFinite 包含 NaN/Infinity
  if (!Number.isFinite(points) || points <= 0) return;
  // 防御 currentPoints 已为 NaN 的情况（通过 deserialize 注入）
  if (!Number.isFinite(state.currentPoints)) state.currentPoints = 0;
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
  // P0-004 FIX: NaN 防护
  if (!Number.isFinite(count) || count <= 0) return;

  for (const instance of activeQuests.values()) {
    if (instance.status !== 'active') continue;

    for (const objective of instance.objectives) {
      if (objective.type !== objectiveType) continue;
      if (objective.currentCount >= objective.targetCount) continue;

      // P0-004b FIX: 防御 currentCount 为 NaN 的情况
      if (!Number.isFinite(objective.currentCount)) objective.currentCount = 0;

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

  // P1-6: 先标记已领取并从活跃列表移除，防止并发重复领取
  instance.rewardClaimed = true;
  ctx.activeQuests.delete(instanceId);

  // 日常任务活跃度加成
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

// ─── 日常任务多样性保证 ──────────────────────────

/** 日常任务分类标签 */
type DailyQuestTag = 'battle' | 'training' | 'auto' | 'build' | 'social' | 'collect' | 'event' | 'spend';

/** 日常任务ID到分类标签的映射 */
const DAILY_TAG_MAP: Record<string, DailyQuestTag> = {
  'daily-001': 'build',    // 勤劳建设
  'daily-002': 'battle',   // 沙场练兵
  'daily-003': 'training', // 招贤纳士
  'daily-004': 'collect',  // 广积粮草
  'daily-005': 'social',   // 礼尚往来
  'daily-006': 'training', // 科技创新
  'daily-007': 'social',   // 社交达人
  'daily-008': 'event',    // 事件达人
  'daily-009': 'build',    // 勤政爱民
  'daily-010': 'battle',   // 百战百胜
  'daily-011': 'collect',  // 日进斗金
  'daily-012': 'training', // 名将收集
  'daily-013': 'training', // 科技先驱
  'daily-014': 'social',   // 慷慨解囊
  'daily-015': 'battle',   // 征战四方
  'daily-016': 'build',    // 大兴土木
  'daily-017': 'training', // 满腹经纶
  'daily-018': 'social',   // 人脉广阔
  'daily-019': 'auto',     // 每日签到
  'daily-020': 'event',    // 事件猎手
};

/** D01(每日签到) 必定出现的ID */
const DAILY_MUST_INCLUDE = 'daily-019';

/**
 * 带多样性保证的日常任务抽取
 * PRD §QST-3 规则：
 * - 至少1个战斗类
 * - 至少1个养成类
 * - 至少1个自动完成类
 * - 最多2个同类任务
 * - D01（登录）必定出现
 */
export function pickDailyWithDiversity(templates: QuestDef[], pickCount: number): QuestDef[] {
  const D01 = templates.find(t => t.id === DAILY_MUST_INCLUDE);
  const rest = templates.filter(t => t.id !== DAILY_MUST_INCLUDE);

  // Fisher-Yates 洗牌
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  // D01 必定出现
  const picked: QuestDef[] = D01 ? [D01] : [];

  // 分类计数器
  const tagCounts: Record<string, number> = {};
  for (const q of picked) {
    const tag = DAILY_TAG_MAP[q.id] ?? 'other';
    tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  }

  // 保证类别
  const guaranteedTags: DailyQuestTag[] = ['battle', 'training', 'auto'];

  // 先从保证类别中各选1个
  for (const tag of guaranteedTags) {
    if ((tagCounts[tag] ?? 0) >= 1) continue;
    const idx = rest.findIndex(q => (DAILY_TAG_MAP[q.id] ?? 'other') === tag);
    if (idx >= 0) {
      picked.push(rest[idx]);
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      rest.splice(idx, 1);
    }
  }

  // 填充剩余名额，每类最多2个
  for (const q of rest) {
    if (picked.length >= pickCount) break;
    const tag = DAILY_TAG_MAP[q.id] ?? 'other';
    if ((tagCounts[tag] ?? 0) >= 2) continue;
    picked.push(q);
    tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  }

  return picked.slice(0, pickCount);
}

// ─── 周常任务辅助 ──────────────────────────────

import { WEEKLY_QUEST_TEMPLATES, DEFAULT_WEEKLY_POOL_CONFIG } from '../../core/quest';

/** 周常任务刷新的依赖接口 */
export interface WeeklyQuestDeps {
  activeQuests: Map<string, QuestInstance>;
  weeklyQuestInstanceIds: string[];
  weeklyRefreshDate: string;
  registerQuest: (def: QuestDef) => void;
  acceptQuest: (questId: QuestId) => QuestInstance | null;
  emit: (event: string, data: unknown) => void;
}

/** 刷新周常任务的纯逻辑（PRD §QST-3: 每周一05:00重置） */
export function refreshWeeklyQuestsLogic(deps: WeeklyQuestDeps): {
  newInstances: QuestInstance[];
  weeklyQuestInstanceIds: string[];
  weeklyRefreshDate: string;
} {
  const config = DEFAULT_WEEKLY_POOL_CONFIG;
  const now = new Date();

  // 计算本周一的日期字符串
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  // 如果今天是周一且还没到refreshHour，用上周一
  if (dayOfWeek === config.refreshDay && now.getHours() < config.refreshHour) {
    monday.setDate(monday.getDate() - 7);
  }
  const thisMonday = monday.toISOString().slice(0, 10);

  if (deps.weeklyRefreshDate === thisMonday) {
    return {
      newInstances: deps.weeklyQuestInstanceIds
        .map((id) => deps.activeQuests.get(id))
        .filter(Boolean) as QuestInstance[],
      weeklyQuestInstanceIds: deps.weeklyQuestInstanceIds,
      weeklyRefreshDate: deps.weeklyRefreshDate,
    };
  }

  // 清除旧的周常任务
  for (const id of deps.weeklyQuestInstanceIds) {
    const instance = deps.activeQuests.get(id);
    if (instance) {
      instance.status = 'expired';
      deps.activeQuests.delete(id);
    }
  }

  // Fisher-Yates 洗牌
  const pool = [...WEEKLY_QUEST_TEMPLATES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, config.weeklyPickCount);

  const newInstances: QuestInstance[] = [];
  const weeklyQuestInstanceIds: string[] = [];

  for (const def of picked) {
    deps.registerQuest(def);
    const instance = deps.acceptQuest(def.id);
    if (instance) {
      weeklyQuestInstanceIds.push(instance.instanceId);
      newInstances.push(instance);
    }
  }

  return { newInstances, weeklyQuestInstanceIds, weeklyRefreshDate: thisMonday };
}
