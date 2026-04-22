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
  ActivityTask,
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
  ActivityTaskType,
  ActivityTaskStatus,
  MilestoneStatus,
} from '../../core/activity/activity.types';

import {
  DEFAULT_SEASON_THEMES,
  getCurrentSeasonTheme as _getTheme,
  createSettlementAnimation as _createAnim,
  updateSeasonRecord as _updateRecord,
  generateSeasonRecordRanking as _genRanking,
  getSeasonThemes as _getThemes,
} from './SeasonHelper';
export { DEFAULT_SEASON_THEMES };

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

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认并行上限配置 */
export const DEFAULT_CONCURRENCY_CONFIG: ActivityConcurrencyConfig = {
  maxSeason: 1,
  maxLimitedTime: 2,
  maxDaily: 1,
  maxFestival: 1,
  maxAlliance: 1,
  maxTotal: 5,
};

/** 默认离线效率配置 */
export const DEFAULT_OFFLINE_EFFICIENCY: OfflineEfficiencyConfig = {
  season: 0.5,
  limitedTime: 0.3,
  daily: 1.0,
  festival: 0.5,
  alliance: 0.5,
};

/** 活动存档版本 */
export const ACTIVITY_SAVE_VERSION = 1;

/** 每秒基础积分（离线计算用） */
const BASE_POINTS_PER_SECOND = 0.1;

/** 默认赛季主题列表 — 从 SeasonHelper.ts 导入（已在顶部导入） */

/** seasonHelper 委托对象 */
const seasonHelper = {
  getCurrentSeasonTheme: _getTheme,
  createSettlementAnimation: _createAnim,
  updateSeasonRecord: _updateRecord,
  generateSeasonRecordRanking: _genRanking,
  getSeasonThemes: _getThemes,
};

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
    const activeOfType = Object.values(state.activities)
      .filter(a => a.status === ActivityStatus.ACTIVE)
      .filter(a => {
        // 需要通过defId判断类型，这里简化处理
        // 实际需要ActivityDef映射
        return true;
      });

    // 检查总上限
    const totalActive = Object.values(state.activities)
      .filter(a => a.status === ActivityStatus.ACTIVE).length;
    if (totalActive >= this.concurrencyConfig.maxTotal) {
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
    const instance = createActivityInstance(def, now);
    instance.tasks = taskDefs.map(d => createActivityTask(d));
    instance.milestones = milestones.map(m => ({ ...m, status: MilestoneStatus.LOCKED }));

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

    const updatedInstance: ActivityInstance = {
      ...instance,
      tasks,
      points: instance.points + task.pointReward,
      tokens: instance.tokens + task.tokenReward,
    };

    return {
      state: {
        ...state,
        activities: { ...state.activities, [activityId]: updatedInstance },
      },
      points: task.pointReward,
      tokens: task.tokenReward,
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
      if (instance.points >= m.requiredPoints) {
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

  /**
   * 计算离线进度
   */
  calculateOfflineProgress(
    state: ActivityState,
    offlineDurationMs: number,
  ): OfflineActivityResult[] {
    const results: OfflineActivityResult[] = [];
    const durationSeconds = offlineDurationMs / 1000;

    for (const [activityId, instance] of Object.entries(state.activities)) {
      if (instance.status !== ActivityStatus.ACTIVE) continue;

      // 根据活动类型获取效率（简化：通过defId前缀判断）
      let efficiency = 0.5;
      if (activityId.startsWith('season_')) efficiency = this.offlineEfficiency.season;
      else if (activityId.startsWith('limited_')) efficiency = this.offlineEfficiency.limitedTime;
      else if (activityId.startsWith('daily_')) efficiency = this.offlineEfficiency.daily;
      else if (activityId.startsWith('festival_')) efficiency = this.offlineEfficiency.festival;
      else if (activityId.startsWith('alliance_')) efficiency = this.offlineEfficiency.alliance;

      const pointsEarned = Math.floor(durationSeconds * BASE_POINTS_PER_SECOND * efficiency);
      const tokensEarned = Math.floor(pointsEarned * 0.1);

      if (pointsEarned > 0) {
        results.push({
          activityId,
          pointsEarned,
          tokensEarned,
          offlineDuration: offlineDurationMs,
        });
      }
    }

    return results;
  }

  /**
   * 应用离线进度
   */
  applyOfflineProgress(
    state: ActivityState,
    results: OfflineActivityResult[],
  ): ActivityState {
    let newState = { ...state };

    for (const result of results) {
      const instance = newState.activities[result.activityId];
      if (!instance) continue;

      newState = {
        ...newState,
        activities: {
          ...newState.activities,
          [result.activityId]: {
            ...instance,
            points: instance.points + result.pointsEarned,
            tokens: instance.tokens + result.tokensEarned,
          },
        },
      };
    }

    return newState;
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
    return {
      version: ACTIVITY_SAVE_VERSION,
      state: {
        ...state,
        activities: { ...state.activities },
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
