/**
 * 活动系统 — 引擎层
 *
 * 职责：活动列表管理、5类活动矩阵、活动任务系统、里程碑奖励、离线进度
 * 规则：
 *   - 5类活动：赛季(28天)、限时(7~14天)、日常(常驻)、节日(3~7天)、联盟(7天)
 *   - 并行上限：赛季×1 + 限时×2 + 日常×1 + 节日×1 + 联盟×1 = 最多5个
 *   - 活动任务：每日×5 + 挑战×3 + 累积(持续)
 *   - 里程碑：积分解锁节点，手动领取
 *   - 离线进度：按活动类型不同效率累积
 *
 * @module engine/activity/ActivitySystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ActivityDef,
  ActivityInstance,
  ActivityTaskDef,
  ActivityMilestone,
  ActivityConcurrencyConfig,
  OfflineEfficiencyConfig,
  OfflineActivityResult,
  ActivityState,
  ActivitySaveData,
  SeasonTheme,
  SeasonSettlementAnimation,
  SeasonRecord,
  SeasonRecordEntry,
} from '../../core/activity/activity.types';

import {
  ActivityType,
  ActivityStatus,
  ActivityTaskStatus,
  MilestoneStatus,
} from '../../core/activity/activity.types';

// 配置与常量（从 ActivitySystemConfig 拆分）
import {
  DEFAULT_CONCURRENCY_CONFIG,
  DEFAULT_OFFLINE_EFFICIENCY,
  ACTIVITY_SAVE_VERSION,
  seasonHelper,
} from './ActivitySystemConfig';
export {
  DEFAULT_CONCURRENCY_CONFIG,
  DEFAULT_OFFLINE_EFFICIENCY,
  ACTIVITY_SAVE_VERSION,
  DEFAULT_SEASON_THEMES,
} from './ActivitySystemConfig';

// 从 ActivityFactory 导入工厂函数（类内部使用）
import {
  createDefaultActivityState,
  createActivityInstance,
  createActivityTask,
  createMilestone,
} from './ActivityFactory';

// 重新导出供外部使用
export {
  createDefaultActivityState,
  createActivityInstance,
  createActivityTask,
  createMilestone,
};

// 离线进度计算（从 ActivityOfflineCalculator 拆分）
import {
  calculateOfflineProgress as _calcOffline,
  applyOfflineProgress as _applyOffline,
} from './ActivityOfflineCalculator';

// ─────────────────────────────────────────────
// ActivitySystem 类
// ─────────────────────────────────────────────

/**
 * 活动系统
 *
 * 管理活动列表、任务、里程碑、离线进度、赛季主题
 */
export class ActivitySystem implements ISubsystem {
  // ─── ISubsystem 接口 ───────────────────────

  /** 活动管理系统（区别于 quest/ActivitySystem 的活跃度系统 'activity'） */
  readonly name = 'activityMgmt' as const;
  private deps: ISystemDeps | null = null;

  private concurrencyConfig: ActivityConcurrencyConfig;
  private offlineEfficiency: OfflineEfficiencyConfig;

  constructor(
    concurrencyConfig?: Partial<ActivityConcurrencyConfig>,
    offlineEfficiency?: Partial<OfflineEfficiencyConfig>,
  ) {
    this.concurrencyConfig = { ...DEFAULT_CONCURRENCY_CONFIG, ...concurrencyConfig };
    this.offlineEfficiency = { ...DEFAULT_OFFLINE_EFFICIENCY, ...offlineEfficiency };
  }

  // ─── ISubsystem 适配层 ─────────────────────

  /** 注入依赖 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 活动系统由事件驱动，无需帧更新 */
  update(_dt: number): void {
    // 活动系统由事件驱动，无需帧更新
  }

  /** 获取系统状态快照 */
  getState(): Record<string, unknown> {
    return {
      name: this.name,
      concurrencyConfig: this.concurrencyConfig,
      offlineEfficiency: this.offlineEfficiency,
    };
  }

  /** 重置系统状态 */
  reset(): void {
    this.concurrencyConfig = { ...DEFAULT_CONCURRENCY_CONFIG };
    this.offlineEfficiency = { ...DEFAULT_OFFLINE_EFFICIENCY };
  }

  // ── 活动列表管理 ──────────────────────────

  /**
   * 检查是否可以启动新活动
   */
  canStartActivity(
    state: ActivityState,
    type: ActivityType,
  ): { canStart: boolean; reason: string } {
    // FIX-ACT-001: NaN防护 — 验证maxTotal为有限数
    if (!Number.isFinite(this.concurrencyConfig.maxTotal) || this.concurrencyConfig.maxTotal <= 0) {
      return { canStart: false, reason: '并行配置异常' };
    }

    const activeActivities = Object.values(state.activities)
      .filter(a => a.status === ActivityStatus.ACTIVE);

    // FIX-ACT-001: 检查分类型上限（修复filter始终return true的逻辑缺陷）
    const typePrefixMap: Record<ActivityType, string> = {
      [ActivityType.SEASON]: 'season_',
      [ActivityType.LIMITED_TIME]: 'limited_',
      [ActivityType.DAILY]: 'daily_',
      [ActivityType.FESTIVAL]: 'festival_',
      [ActivityType.ALLIANCE]: 'alliance_',
    };
    const typeLimitMap: Record<ActivityType, { limit: number; label: string }> = {
      [ActivityType.SEASON]: { limit: this.concurrencyConfig.maxSeason, label: '赛季' },
      [ActivityType.LIMITED_TIME]: { limit: this.concurrencyConfig.maxLimitedTime, label: '限时' },
      [ActivityType.DAILY]: { limit: this.concurrencyConfig.maxDaily, label: '日常' },
      [ActivityType.FESTIVAL]: { limit: this.concurrencyConfig.maxFestival, label: '节日' },
      [ActivityType.ALLIANCE]: { limit: this.concurrencyConfig.maxAlliance, label: '联盟' },
    };

    const prefix = typePrefixMap[type];
    const typeConfig = typeLimitMap[type];
    const activeOfType = activeActivities.filter(a => a.defId.startsWith(prefix)).length;
    if (typeConfig && activeOfType >= typeConfig.limit) {
      return { canStart: false, reason: `${typeConfig.label}活动已达上限(${typeConfig.limit}个)` };
    }

    // 检查总上限
    if (activeActivities.length >= this.concurrencyConfig.maxTotal) {
      return { canStart: false, reason: '活动总数已达上限' };
    }

    return { canStart: true, reason: '' };
  }

  /**
   * 启动活动
   */
  startActivity(
    state: ActivityState,
    def: ActivityDef,
    taskDefs: ActivityTaskDef[],
    milestones: ActivityMilestone[],
    now: number,
  ): ActivityState {
    // FIX-ACT-005: null guard
    if (!def) throw new Error('活动定义不能为空');
    if (!Number.isFinite(now)) throw new Error('时间参数异常');

    const instance = createActivityInstance(def, now);
    instance.tasks = (taskDefs ?? []).map(d => createActivityTask(d));
    instance.milestones = (milestones ?? []).map(m => ({ ...m, status: MilestoneStatus.LOCKED }));

    return {
      ...state,
      activities: { ...state.activities, [def.id]: instance },
    };
  }

  /**
   * 更新活动状态（时间检查）
   */
  updateActivityStatus(
    state: ActivityState,
    activityId: string,
    now: number,
    endTime: number,
  ): ActivityState {
    const instance = state.activities[activityId];
    if (!instance) return state;

    // FIX-ACT-026: NaN防护 — now或endTime为NaN时不执行状态变更
    if (!Number.isFinite(now) || !Number.isFinite(endTime)) return state;

    if (instance.status === ActivityStatus.ACTIVE && now >= endTime) {
      return {
        ...state,
        activities: {
          ...state.activities,
          [activityId]: { ...instance, status: ActivityStatus.ENDED },
        },
      };
    }

    return state;
  }

  /**
   * 获取活跃活动列表
   */
  getActiveActivities(state: ActivityState): ActivityInstance[] {
    return Object.values(state.activities)
      .filter(a => a.status === ActivityStatus.ACTIVE);
  }

  // ── 活动任务系统 ──────────────────────────

  /**
   * 更新任务进度
   */
  updateTaskProgress(
    state: ActivityState,
    activityId: string,
    taskDefId: string,
    progress: number,
  ): ActivityState {
    const instance = state.activities[activityId];
    if (!instance) return state;

    // FIX-ACT-002/003: NaN和负值防护
    if (!Number.isFinite(progress) || progress <= 0) return state;

    const tasks = instance.tasks.map(t => {
      if (t.defId !== taskDefId) return t;
      if (t.status === ActivityTaskStatus.CLAIMED) return t;

      const newProgress = t.currentProgress + progress;
      const newStatus = newProgress >= t.targetCount
        ? ActivityTaskStatus.COMPLETED
        : ActivityTaskStatus.INCOMPLETE;

      return {
        ...t,
        currentProgress: Math.min(newProgress, t.targetCount),
        status: newStatus,
      };
    });

    return {
      ...state,
      activities: {
        ...state.activities,
        [activityId]: { ...instance, tasks },
      },
    };
  }

  /**
   * 领取任务奖励
   */
  claimTaskReward(
    state: ActivityState,
    activityId: string,
    taskDefId: string,
  ): { state: ActivityState; points: number; tokens: number } {
    const instance = state.activities[activityId];
    if (!instance) throw new Error('活动不存在');

    const task = instance.tasks.find(t => t.defId === taskDefId);
    if (!task) throw new Error('任务不存在');
    if (task.status === ActivityTaskStatus.CLAIMED) throw new Error('已领取');
    if (task.status !== ActivityTaskStatus.COMPLETED) throw new Error('任务未完成');

    const tasks = instance.tasks.map(t =>
      t.defId === taskDefId ? { ...t, status: ActivityTaskStatus.CLAIMED } : t,
    );

    // FIX-ACT-004: NaN防护 — 验证奖励值为有限数
    const safePointReward = Number.isFinite(task.pointReward) ? task.pointReward : 0;
    const safeTokenReward = Number.isFinite(task.tokenReward) ? task.tokenReward : 0;

    const updatedInstance: ActivityInstance = {
      ...instance,
      tasks,
      points: instance.points + safePointReward,
      tokens: instance.tokens + safeTokenReward,
    };

    return {
      state: {
        ...state,
        activities: { ...state.activities, [activityId]: updatedInstance },
      },
      points: safePointReward,
      tokens: safeTokenReward,
    };
  }

  /**
   * 重置每日任务
   */
  resetDailyTasks(
    state: ActivityState,
    activityId: string,
    dailyTaskDefs: ActivityTaskDef[],
  ): ActivityState {
    const instance = state.activities[activityId];
    if (!instance) return state;

    const dailyDefIds = new Set(dailyTaskDefs.map(d => d.id));
    const tasks = instance.tasks.map(t => {
      if (!dailyDefIds.has(t.defId)) return t;
      const def = dailyTaskDefs.find(d => d.id === t.defId);
      if (!def) return t;
      return createActivityTask(def);
    });

    return {
      ...state,
      activities: {
        ...state.activities,
        [activityId]: { ...instance, tasks },
      },
    };
  }

  // ── 里程碑奖励 ──────────────────────────

  /**
   * 检查并解锁里程碑
   */
  checkMilestones(
    state: ActivityState,
    activityId: string,
  ): ActivityState {
    const instance = state.activities[activityId];
    if (!instance) return state;

    const milestones = instance.milestones.map(m => {
      if (m.status !== MilestoneStatus.LOCKED) return m;
      // FIX-ACT-005: NaN防护 — points为NaN时不解锁
      if (Number.isFinite(instance.points) && instance.points >= m.requiredPoints) {
        return { ...m, status: MilestoneStatus.UNLOCKED };
      }
      return m;
    });

    return {
      ...state,
      activities: {
        ...state.activities,
        [activityId]: { ...instance, milestones },
      },
    };
  }

  /**
   * 领取里程碑奖励
   */
  claimMilestone(
    state: ActivityState,
    activityId: string,
    milestoneId: string,
  ): { state: ActivityState; rewards: Record<string, number> } {
    const instance = state.activities[activityId];
    if (!instance) throw new Error('活动不存在');

    const milestone = instance.milestones.find(m => m.id === milestoneId);
    if (!milestone) throw new Error('里程碑不存在');
    if (milestone.status === MilestoneStatus.LOCKED) throw new Error('里程碑未解锁');
    if (milestone.status === MilestoneStatus.CLAIMED) throw new Error('已领取');

    const milestones = instance.milestones.map(m =>
      m.id === milestoneId ? { ...m, status: MilestoneStatus.CLAIMED } : m,
    );

    return {
      state: {
        ...state,
        activities: {
          ...state.activities,
          [activityId]: { ...instance, milestones },
        },
      },
      rewards: { ...milestone.rewards },
    };
  }

  // ── 离线进度 ──────────────────────────────
  // 委托到 ActivityOfflineCalculator.ts

  /** 计算离线进度 */
  calculateOfflineProgress(
    state: ActivityState,
    offlineDurationMs: number,
  ): OfflineActivityResult[] {
    return _calcOffline(state, offlineDurationMs, this.offlineEfficiency);
  }

  /** 应用离线进度 */
  applyOfflineProgress(
    state: ActivityState,
    results: OfflineActivityResult[],
  ): ActivityState {
    return _applyOffline(state, results);
  }

  // ── 赛季深化 ──────────────────────────────
  // 赛季方法委托到 SeasonHelper.ts

  /** 获取当前赛季主题 */
  getCurrentSeasonTheme(seasonIndex: number): SeasonTheme {
    return seasonHelper.getCurrentSeasonTheme(seasonIndex);
  }

  /** 生成赛季结算动画数据 */
  createSettlementAnimation(
    seasonId: string, oldRankId: string, newRankId: string,
    oldRanking: number, newRanking: number,
    rewards: SeasonSettlementAnimation['rewards'],
    isServerAnnouncement: boolean,
  ): SeasonSettlementAnimation {
    return seasonHelper.createSettlementAnimation(seasonId, oldRankId, newRankId, oldRanking, newRanking, rewards, isServerAnnouncement);
  }

  /** 更新赛季战绩 */
  updateSeasonRecord(record: SeasonRecord, won: boolean, currentRank: string, currentRanking: number): SeasonRecord {
    return seasonHelper.updateSeasonRecord(record, won, currentRank, currentRanking);
  }

  /** 生成赛季战绩排行 */
  generateSeasonRecordRanking(records: Array<{ playerId: string; playerName: string; record: SeasonRecord }>): SeasonRecordEntry[] {
    return seasonHelper.generateSeasonRecordRanking(records);
  }

  // ── 工具方法 ──────────────────────────────

  /** 获取并行配置 */
  getConcurrencyConfig(): ActivityConcurrencyConfig {
    return { ...this.concurrencyConfig };
  }

  /** 获取离线效率配置 */
  getOfflineEfficiency(): OfflineEfficiencyConfig {
    return { ...this.offlineEfficiency };
  }

  /** 获取赛季主题列表 */
  getSeasonThemes(): SeasonTheme[] {
    return seasonHelper.getSeasonThemes();
  }

  // ── 存档序列化 ──────────────────────────

  serialize(state: ActivityState): ActivitySaveData {
    // FIX-ACT-024: NaN清洗 — 序列化前将NaN替换为0
    const cleanActivities: Record<string, ActivityInstance> = {};
    for (const [id, inst] of Object.entries(state.activities)) {
      cleanActivities[id] = {
        ...inst,
        points: Number.isFinite(inst.points) ? inst.points : 0,
        tokens: Number.isFinite(inst.tokens) ? inst.tokens : 0,
        tasks: inst.tasks.map(t => ({
          ...t,
          currentProgress: Number.isFinite(t.currentProgress) ? t.currentProgress : 0,
          targetCount: Number.isFinite(t.targetCount) ? t.targetCount : 0,
          tokenReward: Number.isFinite(t.tokenReward) ? t.tokenReward : 0,
          pointReward: Number.isFinite(t.pointReward) ? t.pointReward : 0,
        })),
      };
    }

    return {
      version: ACTIVITY_SAVE_VERSION,
      state: {
        ...state,
        activities: cleanActivities,
      },
    };
  }

  deserialize(data: ActivitySaveData): ActivityState {
    if (!data || data.version !== ACTIVITY_SAVE_VERSION) {
      return createDefaultActivityState();
    }
    return { ...data.state };
  }
}
