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

/** 默认赛季主题列表 */
export const DEFAULT_SEASON_THEMES: SeasonTheme[] = [
  { id: 'theme_s1', name: '黄巾之乱', description: '苍天已死，黄天当立', avatarFrameId: 'frame_s1', kingTitle: '平乱功臣' },
  { id: 'theme_s2', name: '群雄逐鹿', description: '天下英雄谁敌手', avatarFrameId: 'frame_s2', kingTitle: '天下霸主' },
  { id: 'theme_s3', name: '赤壁烽火', description: '东风不与周郎便', avatarFrameId: 'frame_s3', kingTitle: '赤壁英雄' },
  { id: 'theme_s4', name: '三国鼎立', description: '三分天下有其一', avatarFrameId: 'frame_s4', kingTitle: '一统天下' },
];

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 创建默认活动状态 */
export function createDefaultActivityState(): ActivityState {
  return {
    activities: {},
    signIn: {
      consecutiveDays: 0,
      todaySigned: false,
      lastSignInTime: 0,
      weeklyRetroactiveCount: 0,
      lastRetroactiveResetWeek: 0,
    },
    seasonRecord: {
      seasonId: '',
      wins: 0,
      losses: 0,
      total: 0,
      winRate: 0,
      highestRank: '',
      highestRanking: 0,
    },
  };
}

/** 从活动定义创建活动实例 */
export function createActivityInstance(def: ActivityDef, now: number): ActivityInstance {
  return {
    defId: def.id,
    status: ActivityStatus.ACTIVE,
    points: 0,
    tokens: 0,
    tasks: [],
    milestones: [],
    createdAt: now,
  };
}

/** 从任务定义创建任务实例 */
export function createActivityTask(def: ActivityTaskDef): ActivityTask {
  return {
    defId: def.id,
    taskType: def.taskType,
    currentProgress: 0,
    targetCount: def.targetCount,
    status: ActivityTaskStatus.INCOMPLETE,
    tokenReward: def.tokenReward,
    pointReward: def.pointReward,
    resourceReward: { ...def.resourceReward },
  };
}

/** 创建里程碑 */
export function createMilestone(
  id: string,
  requiredPoints: number,
  rewards: Record<string, number>,
  isFinal = false,
): ActivityMilestone {
  return {
    id,
    requiredPoints,
    status: MilestoneStatus.LOCKED,
    rewards: { ...rewards },
    isFinal,
  };
}

// ─────────────────────────────────────────────
// ActivitySystem 类
// ─────────────────────────────────────────────

/**
 * 活动系统
 *
 * 管理活动列表、任务、里程碑、离线进度、赛季主题
 */
export class ActivitySystem {
  private concurrencyConfig: ActivityConcurrencyConfig;
  private offlineEfficiency: OfflineEfficiencyConfig;

  constructor(
    concurrencyConfig?: Partial<ActivityConcurrencyConfig>,
    offlineEfficiency?: Partial<OfflineEfficiencyConfig>,
  ) {
    this.concurrencyConfig = { ...DEFAULT_CONCURRENCY_CONFIG, ...concurrencyConfig };
    this.offlineEfficiency = { ...DEFAULT_OFFLINE_EFFICIENCY, ...offlineEfficiency };
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

  /**
   * 获取当前赛季主题
   */
  getCurrentSeasonTheme(seasonIndex: number): SeasonTheme {
    const idx = seasonIndex % DEFAULT_SEASON_THEMES.length;
    return DEFAULT_SEASON_THEMES[idx];
  }

  /**
   * 生成赛季结算动画数据
   */
  createSettlementAnimation(
    seasonId: string,
    oldRankId: string,
    newRankId: string,
    oldRanking: number,
    newRanking: number,
    rewards: SeasonSettlementAnimation['rewards'],
    isServerAnnouncement: boolean,
  ): SeasonSettlementAnimation {
    return {
      seasonId,
      oldRankId,
      newRankId,
      oldRanking,
      newRanking,
      rewards,
      isServerAnnouncement,
    };
  }

  /**
   * 更新赛季战绩
   */
  updateSeasonRecord(
    record: SeasonRecord,
    won: boolean,
    currentRank: string,
    currentRanking: number,
  ): SeasonRecord {
    const wins = record.wins + (won ? 1 : 0);
    const losses = record.losses + (won ? 0 : 1);
    const total = wins + losses;

    return {
      ...record,
      wins,
      losses,
      total,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      highestRank: currentRank,
      highestRanking: Math.min(currentRanking, record.highestRanking || currentRanking),
    };
  }

  /**
   * 生成赛季战绩排行
   */
  generateSeasonRecordRanking(
    records: Array<{ playerId: string; playerName: string; record: SeasonRecord }>,
  ): SeasonRecordEntry[] {
    const entries = records
      .map(r => ({
        playerId: r.playerId,
        playerName: r.playerName,
        wins: r.record.wins,
        winRate: r.record.winRate,
        rank: 0,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.winRate - a.winRate;
      });

    entries.forEach((e, i) => { e.rank = i + 1; });
    return entries;
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
    return [...DEFAULT_SEASON_THEMES];
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
