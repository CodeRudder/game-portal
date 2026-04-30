/**
 * 引擎层 — 任务系统
 * 主线/支线/日常任务生命周期管理 + 任务追踪
 * #15 主线任务 #17 日常任务(20选6) #19 任务追踪面板
 * @module engine/quest/QuestSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  QuestId, QuestCategory, QuestDef, QuestInstance,
  QuestObjective, QuestReward, QuestSystemSaveData,
} from '../../core/quest';
import {
  DEFAULT_DAILY_POOL_CONFIG, DEFAULT_ACTIVITY_MILESTONES,
  QUEST_SAVE_VERSION, DAILY_QUEST_TEMPLATES, PREDEFINED_QUESTS,
} from '../../core/quest';
import type { ActivityState, ActivityMilestone, QuestReward as QR } from '../../core/quest';
import { serializeQuestState, deserializeQuestState } from './QuestSerialization';
import {
  MAX_TRACKED_QUESTS,
  MAX_ACTIVITY_POINTS,
  refreshDailyQuestsLogic,
  refreshWeeklyQuestsLogic,
  getTrackedQuests as getTrackedQuestsHelper,
  trackQuest as trackQuestHelper,
  untrackQuest as untrackQuestHelper,
  getDailyQuests as getDailyQuestsHelper,
  getActiveQuestsByCategory as getActiveQuestsByCategoryHelper,
  getActivityState as getActivityStateHelper,
  addActivityPoints as addActivityPointsHelper,
  claimActivityMilestone as claimActivityMilestoneHelper,
  resetDailyActivity as resetDailyActivityHelper,
  updateProgressByTypeLogic as updateProgressByTypeHelper,
  claimRewardLogic,
  claimAllRewardsLogic,
} from './QuestSystem.helpers';

export { MAX_TRACKED_QUESTS, MAX_ACTIVITY_POINTS } from './QuestSystem.helpers';

/** 管理所有类型任务的注册、接受、进度追踪和奖励发放 */
export class QuestSystem implements ISubsystem {
  readonly name = 'quest';

  private deps!: ISystemDeps;
  private questDefs: Map<QuestId, QuestDef> = new Map();
  private activeQuests: Map<string, QuestInstance> = new Map();
  private completedQuestIds: Set<QuestId> = new Set();
  private dailyQuestInstanceIds: string[] = [];
  private dailyRefreshDate: string = '';
  private weeklyQuestInstanceIds: string[] = [];
  private weeklyRefreshDate: string = '';
  private instanceCounter = 0;
  private trackedQuestIds: string[] = [];
  private activityState: ActivityState = {
    currentPoints: 0, maxPoints: MAX_ACTIVITY_POINTS,
    milestones: DEFAULT_ACTIVITY_MILESTONES.map((m) => ({ ...m })),
    lastResetDate: '',
  };
  private rewardCallback?: (reward: QuestReward) => void;
  private activityAddCallback?: (points: number) => void;

  // ─── ISubsystem ─────────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.loadPredefinedQuests();
  }

  /** P2-8: 初始化默认任务（由上层游戏循环在引擎就绪后调用） */
  initializeDefaults(): void {
    // 自动接受第一个主线任务
    this.acceptQuest('quest-main-001');
    // 刷新日常任务
    this.refreshDailyQuests();
  }
  update(_dt: number): void { /* 由 QuestTrackerSystem 事件驱动 */ }

  getState() {
    return {
      activeQuests: this.getActiveQuests(),
      completedQuestIds: new Set(this.completedQuestIds),
      activityState: this.getActivityState(),
      trackedQuestIds: [...this.trackedQuestIds],
    };
  }

  reset(): void {
    this.activeQuests.clear();
    this.completedQuestIds.clear();
    this.dailyQuestInstanceIds = [];
    this.dailyRefreshDate = '';
    this.weeklyQuestInstanceIds = [];
    this.weeklyRefreshDate = '';
    this.instanceCounter = 0;
    this.trackedQuestIds = [];
    this.activityState = {
      currentPoints: 0, maxPoints: MAX_ACTIVITY_POINTS,
      milestones: DEFAULT_ACTIVITY_MILESTONES.map((m) => ({ ...m })),
      lastResetDate: '',
    };
  }

  // ─── 回调注入 ──────────────────────────────

  /** 设置奖励发放回调 */
  setRewardCallback(cb: (reward: QuestReward) => void): void {
    this.rewardCallback = cb;
  }

  /** 设置活跃度增加回调（由 ActivitySystem 注入） */
  setActivityAddCallback(cb: (points: number) => void): void {
    this.activityAddCallback = cb;
  }

  // ─── 活跃度系统 ────────────────────────────

  /** 获取活跃度状态（返回副本） */
  getActivityState(): ActivityState {
    return getActivityStateHelper(this.activityState);
  }

  /** 增加活跃度（不超过最大值） */
  addActivityPoints(points: number): void {
    addActivityPointsHelper(this.activityState, points);
  }

  /** 领取活跃度里程碑宝箱 */
  claimActivityMilestone(index: number): QR | null {
    return claimActivityMilestoneHelper(this.activityState, index);
  }

  /** 重置每日活跃度 */
  resetDailyActivity(): void {
    resetDailyActivityHelper(this.activityState);
  }

  // ─── 任务注册 ──────────────────────────────

  /** 注册任务定义 */
  registerQuest(def: QuestDef): void {
    this.questDefs.set(def.id, def);
  }

  /** 批量注册 */
  registerQuests(defs: QuestDef[]): void {
    defs.forEach((d) => this.registerQuest(d));
  }

  /** 获取任务定义 */
  getQuestDef(id: QuestId): QuestDef | undefined {
    return this.questDefs.get(id);
  }

  /** 获取所有任务定义 */
  getAllQuestDefs(): QuestDef[] {
    return Array.from(this.questDefs.values());
  }

  /** 按类型获取任务定义 */
  getQuestDefsByCategory(category: QuestCategory): QuestDef[] {
    return this.getAllQuestDefs().filter((d) => d.category === category);
  }

  // ─── 任务接受 ──────────────────────────────

  /** 接受任务。检查前置/已完成/已激活状态后创建实例 */
  acceptQuest(questId: QuestId): QuestInstance | null {
    const def = this.questDefs.get(questId);
    if (!def) return null;
    if (this.completedQuestIds.has(questId)) return null;
    if (this.isQuestActive(questId)) return null;
    if (def.prerequisiteQuestIds?.some((preId) => !this.completedQuestIds.has(preId))) return null;

    const instance = this.createInstance(def);
    this.activeQuests.set(instance.instanceId, instance);

    if (this.trackedQuestIds.length < MAX_TRACKED_QUESTS) {
      this.trackedQuestIds.push(instance.instanceId);
    }

    this.deps?.eventBus.emit('quest:accepted', { instanceId: instance.instanceId, questId });
    return instance;
  }

  // ─── 任务进度 ──────────────────────────────

  /**
   * 更新任务目标进度
   *
   * @param instanceId - 任务实例 ID
   * @param objectiveId - 目标 ID
   * @param progress - 进度增量
   * @returns 更新后的目标，失败返回 null
   */
  updateObjectiveProgress(instanceId: string, objectiveId: string, progress: number): QuestObjective | null {
    const instance = this.activeQuests.get(instanceId);
    if (!instance || instance.status !== 'active') return null;

    const objective = instance.objectives.find((o) => o.id === objectiveId);
    if (!objective) return null;

    const safeProgress = Math.max(0, progress);
    objective.currentCount = Math.min(objective.currentCount + safeProgress, objective.targetCount);

    this.deps?.eventBus.emit('quest:progress', {
      instanceId,
      objectiveId,
      currentCount: objective.currentCount,
      targetCount: objective.targetCount,
    });

    // 检查任务完成
    if (this.checkQuestCompletion(instance)) {
      this.completeQuest(instanceId);
    }

    return objective;
  }

  /**
   * 按目标类型更新进度（批量）
   */
  updateProgressByType(objectiveType: string, count: number, params?: Record<string, unknown>): void {
    updateProgressByTypeHelper(objectiveType, count, this.activeQuests, {
      emit: (event: string, data: unknown) => this.deps?.eventBus.emit(event, data),
      completeQuest: (id: string) => this.completeQuest(id),
      checkQuestCompletion: (inst: QuestInstance) => this.checkQuestCompletion(inst),
    }, params);
  }

  // ─── 任务完成与奖励 ────────────────────────

  /** 检查任务是否所有目标都已完成 */
  private checkQuestCompletion(instance: QuestInstance): boolean {
    return instance.objectives.every((o) => o.currentCount >= o.targetCount);
  }

  /** 完成任务 */
  completeQuest(instanceId: string): boolean {
    const instance = this.activeQuests.get(instanceId);
    if (!instance || instance.status !== 'active') return false;

    instance.status = 'completed';
    instance.completedAt = Date.now();

    const def = this.questDefs.get(instance.questDefId);
    this.completedQuestIds.add(instance.questDefId);

    // 从追踪列表移除
    this.trackedQuestIds = this.trackedQuestIds.filter((id) => id !== instanceId);

    this.deps?.eventBus.emit('quest:completed', {
      instanceId,
      questId: instance.questDefId,
      category: def?.category,
    });

    return true;
  }

  /**
   * 领取任务奖励
   */
  claimReward(instanceId: string): QuestReward | null {
    return claimRewardLogic(instanceId, {
      questDefs: this.questDefs,
      activeQuests: this.activeQuests,
      addActivityPoints: (pts) => this.addActivityPoints(pts),
      activityAddCallback: this.activityAddCallback,
      rewardCallback: this.rewardCallback,
      emit: (event, data) => this.deps?.eventBus.emit(event, data),
    });
  }

  /** 一键领取所有已完成任务的奖励 */
  claimAllRewards(): QuestReward[] {
    return claimAllRewardsLogic(this.activeQuests, (id) => this.claimReward(id));
  }

  // ─── 日常任务（#17）──────────────────────────

  /**
   * 刷新日常任务
   *
   * 每日0点从20个任务池中随机抽取6个。
   * 如果当天已刷新则跳过。
   */
  refreshDailyQuests(): QuestInstance[] {
    const result = refreshDailyQuestsLogic({
      activeQuests: this.activeQuests,
      dailyQuestInstanceIds: this.dailyQuestInstanceIds,
      dailyRefreshDate: this.dailyRefreshDate,
      registerQuest: (def) => this.registerQuest(def),
      acceptQuest: (id) => this.acceptQuest(id),
      emit: (event, data) => this.deps?.eventBus.emit(event, data),
    });
    this.dailyQuestInstanceIds = result.dailyQuestInstanceIds;
    this.dailyRefreshDate = result.dailyRefreshDate;

    this.deps?.eventBus.emit('quest:dailyRefreshed', {
      date: result.dailyRefreshDate,
      questIds: result.newInstances.map((i) => i.questDefId),
    });

    return result.newInstances;
  }

  /** 获取当前日常任务 */
  getDailyQuests(): QuestInstance[] {
    return getDailyQuestsHelper(this.dailyQuestInstanceIds, this.activeQuests);
  }

  // ─── 周常任务 ──────────────────────────────

  /**
   * 刷新周常任务（PRD §QST-3: 每周一05:00重置，12选4）
   */
  refreshWeeklyQuests(): QuestInstance[] {
    const result = refreshWeeklyQuestsLogic({
      activeQuests: this.activeQuests,
      weeklyQuestInstanceIds: this.weeklyQuestInstanceIds,
      weeklyRefreshDate: this.weeklyRefreshDate,
      registerQuest: (def) => this.registerQuest(def),
      acceptQuest: (id) => this.acceptQuest(id),
      emit: (event, data) => this.deps?.eventBus.emit(event, data),
    });
    this.weeklyQuestInstanceIds = result.weeklyQuestInstanceIds;
    this.weeklyRefreshDate = result.weeklyRefreshDate;

    this.deps?.eventBus.emit('quest:weeklyRefreshed', {
      date: result.weeklyRefreshDate,
      questIds: result.newInstances.map((i) => i.questDefId),
    });

    return result.newInstances;
  }

  /** 获取当前周常任务 */
  getWeeklyQuests(): QuestInstance[] {
    return this.weeklyQuestInstanceIds
      .map((id) => this.activeQuests.get(id))
      .filter((q): q is QuestInstance => q !== undefined);
  }

  // ─── 任务追踪（#19）──────────────────────────

  /** 获取追踪中的任务 */
  getTrackedQuests(): QuestInstance[] {
    return getTrackedQuestsHelper(this.trackedQuestIds, this.activeQuests);
  }

  /** 添加任务到追踪 */
  trackQuest(instanceId: string): boolean {
    const result = trackQuestHelper(instanceId, this.trackedQuestIds, this.activeQuests);
    if (result) {
      this.trackedQuestIds = result;
      return true;
    }
    return false;
  }

  /** 取消追踪 */
  untrackQuest(instanceId: string): boolean {
    const result = untrackQuestHelper(instanceId, this.trackedQuestIds);
    if (result) {
      this.trackedQuestIds = result;
      return true;
    }
    return false;
  }

  /** 获取追踪上限 */
  getMaxTrackedQuests(): number {
    return MAX_TRACKED_QUESTS;
  }

  // ─── 查询 ──────────────────────────────────

  /** 获取所有活跃任务 */
  getActiveQuests(): QuestInstance[] {
    return Array.from(this.activeQuests.values());
  }

  /** 按类型获取活跃任务 */
  getActiveQuestsByCategory(category: QuestCategory): QuestInstance[] {
    return getActiveQuestsByCategoryHelper(category, this.activeQuests, this.questDefs);
  }

  /** 检查任务是否激活 */
  isQuestActive(questId: QuestId): boolean {
    return Array.from(this.activeQuests.values()).some(
      (q) => q.questDefId === questId && q.status === 'active',
    );
  }

  /** 检查任务是否完成 */
  isQuestCompleted(questId: QuestId): boolean {
    return this.completedQuestIds.has(questId);
  }

  /** 获取任务实例 */
  getQuestInstance(instanceId: string): QuestInstance | undefined {
    return this.activeQuests.get(instanceId);
  }

  /** 获取已完成任务 ID 列表 */
  getCompletedQuestIds(): QuestId[] {
    return Array.from(this.completedQuestIds);
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): QuestSystemSaveData {
    return serializeQuestState({
      activeQuests: this.activeQuests,
      completedQuestIds: this.completedQuestIds,
      activityState: this.getActivityState(),
      dailyRefreshDate: this.dailyRefreshDate,
      dailyQuestInstanceIds: this.dailyQuestInstanceIds,
    });
  }

  deserialize(data: QuestSystemSaveData): void {
    const result = deserializeQuestState(data, this.activeQuests, this.completedQuestIds);
    this.dailyRefreshDate = result.dailyRefreshDate;
    this.dailyQuestInstanceIds = result.dailyQuestInstanceIds;
    this.activityState = result.activityState as typeof this.activityState;
    this.weeklyQuestInstanceIds = data.weeklyQuestInstanceIds ?? [];
    this.weeklyRefreshDate = data.weeklyRefreshDate ?? '';
  }

  // ─── 内部方法 ──────────────────────────────

  /** 加载预定义任务 */
  private loadPredefinedQuests(): void {
    for (const def of Object.values(PREDEFINED_QUESTS)) {
      this.questDefs.set(def.id, def);
    }
  }

  /** 创建任务实例 */
  private createInstance(def: QuestDef): QuestInstance {
    this.instanceCounter++;
    return {
      instanceId: `quest-inst-${this.instanceCounter}`,
      questDefId: def.id,
      status: 'active',
      objectives: def.objectives.map((o) => ({ ...o, currentCount: 0 })),
      acceptedAt: Date.now(),
      completedAt: null,
      rewardClaimed: false,
    };
  }
}
