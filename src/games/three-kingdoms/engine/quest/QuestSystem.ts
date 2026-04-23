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
import { QUEST_SAVE_VERSION, PREDEFINED_QUESTS } from '../../core/quest';
import type { QuestReward as QR } from '../../core/quest';
import { serializeQuestState, deserializeQuestState } from './QuestSerialization';
import { QuestActivityManager, MAX_ACTIVITY_POINTS } from './QuestActivityManager';
import { QuestDailyManager } from './QuestDailyManager';

/** 最大追踪任务数 */
export const MAX_TRACKED_QUESTS = 3;

// Re-export for backward compatibility
export { MAX_ACTIVITY_POINTS } from './QuestActivityManager';

/** 管理所有类型任务的注册、接受、进度追踪和奖励发放 */
export class QuestSystem implements ISubsystem {
  readonly name = 'quest';

  private deps!: ISystemDeps;
  private questDefs: Map<QuestId, QuestDef> = new Map();
  private activeQuests: Map<string, QuestInstance> = new Map();
  private completedQuestIds: Set<QuestId> = new Set();
  private instanceCounter = 0;
  private trackedQuestIds: string[] = [];
  private rewardCallback?: (reward: QuestReward) => void;
  private activityAddCallback?: (points: number) => void;

  /** 活跃度管理器（委托） */
  private activityMgr: QuestActivityManager;

  /** 日常任务管理器（委托） */
  private dailyMgr: QuestDailyManager;

  constructor() {
    this.activityMgr = new QuestActivityManager();
    this.dailyMgr = new QuestDailyManager();
    this.dailyMgr.setDeps({
      registerAndAccept: (def) => {
        this.registerQuest(def);
        return this.acceptQuest(def.id);
      },
      expireQuest: (instanceId) => {
        const instance = this.activeQuests.get(instanceId);
        if (instance && instance.status === 'active') {
          instance.status = 'expired';
          this.activeQuests.delete(instanceId);
        }
      },
      emitEvent: (event, data) => this.deps?.eventBus.emit(event, data),
    });
  }

  // ─── ISubsystem ─────────────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; this.loadPredefinedQuests(); }
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
    this.instanceCounter = 0;
    this.trackedQuestIds = [];
    this.activityMgr.fullReset();
    this.dailyMgr.fullReset();
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

  // ─── 活跃度系统（委托 QuestActivityManager）───

  /** 获取活跃度状态（返回副本） */
  getActivityState() {
    return this.activityMgr.getState();
  }

  /** 增加活跃度（不超过最大值） */
  addActivityPoints(points: number): void {
    this.activityMgr.addPoints(points);
  }

  /** 领取活跃度里程碑宝箱 */
  claimActivityMilestone(index: number): QR | null {
    return this.activityMgr.claimMilestone(index);
  }

  /** 重置每日活跃度 */
  resetDailyActivity(): void {
    this.activityMgr.resetDaily();
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

    objective.currentCount = Math.min(objective.currentCount + progress, objective.targetCount);

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
   *
   * 遍历所有活跃任务，匹配目标类型并更新进度。
   */
  updateProgressByType(objectiveType: string, count: number, params?: Record<string, unknown>): void {
    for (const instance of this.activeQuests.values()) {
      if (instance.status !== 'active') continue;

      for (const objective of instance.objectives) {
        if (objective.type !== objectiveType) continue;
        if (objective.currentCount >= objective.targetCount) continue;

        // 参数匹配
        if (params && objective.params) {
          const match = Object.entries(params).every(
            ([key, val]) => objective.params![key] === val,
          );
          if (!match) continue;
        }

        objective.currentCount = Math.min(objective.currentCount + count, objective.targetCount);

        this.deps?.eventBus.emit('quest:progress', {
          instanceId: instance.instanceId,
          objectiveId: objective.id,
          currentCount: objective.currentCount,
          targetCount: objective.targetCount,
        });
      }

      // 检查完成
      if (this.checkQuestCompletion(instance)) {
        this.completeQuest(instance.instanceId);
      }
    }
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
   *
   * @param instanceId - 任务实例 ID
   * @returns 奖励数据，失败返回 null
   */
  claimReward(instanceId: string): QuestReward | null {
    const instance = this.activeQuests.get(instanceId);
    if (!instance) return null;
    if (instance.status !== 'completed') return null;
    if (instance.rewardClaimed) return null;

    const def = this.questDefs.get(instance.questDefId);
    if (!def) return null;

    instance.rewardClaimed = true;

    // 活跃度奖励（日常任务）
    if (def.category === 'daily' && def.rewards.activityPoints) {
      this.addActivityPoints(def.rewards.activityPoints);
      this.activityAddCallback?.(def.rewards.activityPoints);
    }

    // 发放奖励
    this.rewardCallback?.(def.rewards);

    this.deps?.eventBus.emit('quest:rewardClaimed', {
      instanceId,
      questId: instance.questDefId,
      rewards: def.rewards,
    });

    // 移除已领取的完成任务
    this.activeQuests.delete(instanceId);

    return def.rewards;
  }

  /** 一键领取所有已完成任务的奖励 */
  claimAllRewards(): QuestReward[] {
    const rewards: QuestReward[] = [];
    const completedInstances = Array.from(this.activeQuests.values())
      .filter((q) => q.status === 'completed' && !q.rewardClaimed);

    for (const instance of completedInstances) {
      const reward = this.claimReward(instance.instanceId);
      if (reward) rewards.push(reward);
    }

    return rewards;
  }

  // ─── 日常任务（委托 QuestDailyManager）───────

  /**
   * 刷新日常任务
   *
   * 每日0点从20个任务池中随机抽取6个。
   * 如果当天已刷新则返回当前日常任务实例。
   */
  refreshDailyQuests(): QuestInstance[] {
    const newInstances = this.dailyMgr.refresh();
    if (newInstances.length === 0 && this.dailyMgr.isRefreshedToday()) {
      // 已刷新过，返回当前日常任务
      return this.dailyMgr.getInstanceIds()
        .map((id) => this.activeQuests.get(id))
        .filter(Boolean) as QuestInstance[];
    }
    return newInstances;
  }

  /** 获取当前日常任务 */
  getDailyQuests(): QuestInstance[] {
    return this.dailyMgr.getInstanceIds()
      .map((id) => this.activeQuests.get(id))
      .filter((q) => q !== undefined) as QuestInstance[];
  }

  // ─── 任务追踪（#19）──────────────────────────

  /** 获取追踪中的任务 */
  getTrackedQuests(): QuestInstance[] {
    return this.trackedQuestIds
      .map((id) => this.activeQuests.get(id))
      .filter((q) => q !== undefined && q.status === 'active') as QuestInstance[];
  }

  /** 添加任务到追踪 */
  trackQuest(instanceId: string): boolean {
    if (this.trackedQuestIds.includes(instanceId)) return true;
    if (this.trackedQuestIds.length >= MAX_TRACKED_QUESTS) return false;

    const instance = this.activeQuests.get(instanceId);
    if (!instance || instance.status !== 'active') return false;

    this.trackedQuestIds.push(instanceId);
    return true;
  }

  /** 取消追踪 */
  untrackQuest(instanceId: string): boolean {
    const idx = this.trackedQuestIds.indexOf(instanceId);
    if (idx === -1) return false;
    this.trackedQuestIds.splice(idx, 1);
    return true;
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
    return this.getActiveQuests().filter((q) => {
      const def = this.questDefs.get(q.questDefId);
      return def?.category === category;
    });
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
      dailyRefreshDate: this.dailyMgr.getRefreshDate(),
      dailyQuestInstanceIds: this.dailyMgr.getInstanceIds(),
    });
  }

  deserialize(data: QuestSystemSaveData): void {
    const result = deserializeQuestState(data, this.activeQuests, this.completedQuestIds);
    this.dailyMgr.restoreState(result.dailyRefreshDate, result.dailyQuestInstanceIds);
    this.activityMgr.restoreState(result.activityState as ReturnType<typeof this.activityMgr.getState>);
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
