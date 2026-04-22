/**
 * 引擎层 — 限时活动系统 v15.0
 *
 * 功能覆盖：
 *   #15 活动排行榜
 *   #16 限时活动完整流程（预览→活跃→结算→关闭）
 *   #17 节日活动框架
 *   #18 活动离线进度
 *
 * 设计：
 *   - 限时活动4阶段生命周期
 *   - 排行榜 + 奖励梯度
 *   - 节日活动模板（春节/元宵/端午/中秋/重阳/自定义）
 *   - 离线进度按活动类型效率累积
 *
 * @module engine/activity/TimedActivitySystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ActivityRankEntry,
  ActivityLeaderboardConfig,
  LeaderboardRewardTier,
  TimedActivityPhase,
  TimedActivityFlow,
  FestivalType,
  FestivalActivityDef,
  ActivityOfflineSummary,
} from '../../core/event/event-v15.types';

import type {
  OfflineActivityResult,
  OfflineEfficiencyConfig,
} from '../../core/activity/activity.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认排行榜配置 */
export const DEFAULT_LEADERBOARD_CONFIG: ActivityLeaderboardConfig = {
  activityId: '',
  maxEntries: 100,
  rewardTiers: [
    { minRank: 1, maxRank: 1, rewards: { gold: 500 } },
    { minRank: 2, maxRank: 3, rewards: { gold: 300 } },
    { minRank: 4, maxRank: 10, rewards: { gold: 150 } },
    { minRank: 11, maxRank: 50, rewards: { gold: 50 } },
  ],
};

/** 默认离线效率 */
export const DEFAULT_TIMED_OFFLINE_EFFICIENCY: OfflineEfficiencyConfig = {
  season: 0.5,
  limitedTime: 0.3,
  daily: 1.0,
  festival: 0.5,
  alliance: 0.5,
};

/** 每秒基础积分 */
const BASE_POINTS_PER_SECOND = 0.1;

/** 预览阶段时长(毫秒) */
const PREVIEW_DURATION = 24 * 60 * 60 * 1000; // 1天

/** 结算阶段时长(毫秒) */
const SETTLEMENT_DURATION = 2 * 60 * 60 * 1000; // 2小时

/** 节日模板列表 */
export const FESTIVAL_TEMPLATES: FestivalActivityDef[] = [
  {
    id: 'festival-spring',
    festivalType: 'spring',
    name: '春节庆典',
    description: '新年伊始，万象更新',
    themeColor: '#FF0000',
    exclusiveItems: [],
    exclusiveTasks: [
      { id: 'ft-spring-1', name: '贴春联', description: '完成3次春联任务', targetCount: 3, rewards: { gold: 50 } },
    ],
  },
  {
    id: 'festival-lantern',
    festivalType: 'lantern',
    name: '元宵灯会',
    description: '花灯璀璨，团圆美满',
    themeColor: '#FFD700',
    exclusiveItems: [],
    exclusiveTasks: [
      { id: 'ft-lantern-1', name: '猜灯谜', description: '完成5个灯谜', targetCount: 5, rewards: { gold: 30 } },
    ],
  },
  {
    id: 'festival-dragon-boat',
    festivalType: 'dragon_boat',
    name: '端午龙舟',
    description: '龙舟竞渡，粽叶飘香',
    themeColor: '#228B22',
    exclusiveItems: [],
    exclusiveTasks: [
      { id: 'ft-dragon-1', name: '赛龙舟', description: '完成3次龙舟赛', targetCount: 3, rewards: { gold: 40 } },
    ],
  },
  {
    id: 'festival-mid-autumn',
    festivalType: 'mid_autumn',
    name: '中秋赏月',
    description: '月圆人团圆',
    themeColor: '#87CEEB',
    exclusiveItems: [],
    exclusiveTasks: [
      { id: 'ft-mid-1', name: '赏月任务', description: '完成赏月活动', targetCount: 1, rewards: { gold: 60 } },
    ],
  },
  {
    id: 'festival-double-ninth',
    festivalType: 'double_ninth',
    name: '重阳登高',
    description: '登高望远，遍插茱萸',
    themeColor: '#FF8C00',
    exclusiveItems: [],
    exclusiveTasks: [
      { id: 'ft-ninth-1', name: '登高望远', description: '完成登高任务', targetCount: 2, rewards: { gold: 45 } },
    ],
  },
];

// ─────────────────────────────────────────────
// 限时活动系统
// ─────────────────────────────────────────────

/**
 * 限时活动系统
 *
 * 管理限时活动流程、排行榜、节日框架、离线进度。
 */
export class TimedActivitySystem implements ISubsystem {
  // ─── ISubsystem 接口 ───────────────────────

  readonly name = 'timedActivity' as const;
  private deps: ISystemDeps | null = null;

  private leaderboardConfig: ActivityLeaderboardConfig;
  private offlineEfficiency: OfflineEfficiencyConfig;
  private flows: Map<string, TimedActivityFlow> = new Map();
  private leaderboards: Map<string, ActivityRankEntry[]> = new Map();

  constructor(
    leaderboardConfig?: Partial<ActivityLeaderboardConfig>,
    offlineEfficiency?: Partial<OfflineEfficiencyConfig>,
  ) {
    this.leaderboardConfig = { ...DEFAULT_LEADERBOARD_CONFIG, ...leaderboardConfig };
    this.offlineEfficiency = { ...DEFAULT_TIMED_OFFLINE_EFFICIENCY, ...offlineEfficiency };
  }

  // ─── ISubsystem 适配层 ─────────────────────

  /** 注入依赖 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /** 限时活动系统无需帧更新 */
  update(_dt: number): void {
    // 限时活动系统由事件驱动，无需帧更新
  }

  /** 获取系统状态快照 */
  getState(): Record<string, unknown> {
    return {
      name: this.name,
      flowsCount: this.flows.size,
      leaderboardsCount: this.leaderboards.size,
    };
  }

  /** 重置系统状态 */
  reset(): void {
    this.flows.clear();
    this.leaderboards.clear();
  }

  // ─── #16 限时活动完整流程 ──────────────

  /**
   * 创建限时活动流程
   *
   * 4阶段：preview → active → settlement → closed
   */
  createTimedActivityFlow(
    activityId: string,
    activeStart: number,
    activeEnd: number,
  ): TimedActivityFlow {
    const flow: TimedActivityFlow = {
      activityId,
      phase: 'preview',
      previewStart: activeStart - PREVIEW_DURATION,
      activeStart,
      activeEnd,
      settlementStart: activeEnd,
      closedTime: activeEnd + SETTLEMENT_DURATION,
    };

    this.flows.set(activityId, flow);
    return flow;
  }

  /**
   * 更新活动阶段
   */
  updatePhase(activityId: string, now: number): TimedActivityPhase {
    const flow = this.flows.get(activityId);
    if (!flow) return 'closed';

    if (now < flow.activeStart) {
      flow.phase = 'preview';
    } else if (now < flow.activeEnd) {
      flow.phase = 'active';
    } else if (now < flow.closedTime) {
      flow.phase = 'settlement';
    } else {
      flow.phase = 'closed';
    }

    return flow.phase;
  }

  /**
   * 获取活动流程
   */
  getFlow(activityId: string): TimedActivityFlow | undefined {
    return this.flows.get(activityId);
  }

  /**
   * 检查活动是否可参与
   */
  canParticipate(activityId: string, now: number): boolean {
    const flow = this.flows.get(activityId);
    if (!flow) return false;
    this.updatePhase(activityId, now);
    return flow.phase === 'active';
  }

  /**
   * 获取剩余时间(毫秒)
   */
  getRemainingTime(activityId: string, now: number): number {
    const flow = this.flows.get(activityId);
    if (!flow) return 0;
    return Math.max(0, flow.activeEnd - now);
  }

  // ─── #15 活动排行榜 ──────────────────────

  /**
   * 更新排行榜
   */
  updateLeaderboard(
    activityId: string,
    entries: ActivityRankEntry[],
  ): ActivityRankEntry[] {
    // 按积分降序排序
    const sorted = [...entries].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.tokens - a.tokens;
    });

    // 重新排名
    sorted.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // 裁剪到最大条目数
    const maxEntries = this.leaderboardConfig.maxEntries;
    const result = sorted.slice(0, maxEntries);

    this.leaderboards.set(activityId, result);
    return result;
  }

  /**
   * 获取排行榜
   */
  getLeaderboard(activityId: string): ActivityRankEntry[] {
    return this.leaderboards.get(activityId) ?? [];
  }

  /**
   * 获取玩家排名
   */
  getPlayerRank(activityId: string, playerId: string): number {
    const entries = this.leaderboards.get(activityId) ?? [];
    const entry = entries.find((e) => e.playerId === playerId);
    return entry?.rank ?? 0;
  }

  /**
   * 计算排行奖励
   */
  calculateRankRewards(rank: number): Record<string, number> {
    const rewards: Record<string, number> = {};

    for (const tier of this.leaderboardConfig.rewardTiers) {
      if (rank >= tier.minRank && rank <= tier.maxRank) {
        for (const [key, value] of Object.entries(tier.rewards)) {
          if (typeof value === 'number') {
            rewards[key] = (rewards[key] ?? 0) + value;
          }
        }
        break; // 只取第一个匹配的梯度
      }
    }

    return rewards;
  }

  /**
   * 获取排行榜配置
   */
  getLeaderboardConfig(): ActivityLeaderboardConfig {
    return { ...this.leaderboardConfig };
  }

  // ─── #17 节日活动框架 ──────────────────────

  /**
   * 获取节日模板
   */
  getFestivalTemplate(festivalType: FestivalType): FestivalActivityDef | undefined {
    return FESTIVAL_TEMPLATES.find((t) => t.festivalType === festivalType);
  }

  /**
   * 获取所有节日模板
   */
  getAllFestivalTemplates(): FestivalActivityDef[] {
    return [...FESTIVAL_TEMPLATES];
  }

  /**
   * 创建节日活动
   */
  createFestivalActivity(
    festivalType: FestivalType,
    startTime: number,
    durationDays: number = 7,
  ): {
    flow: TimedActivityFlow;
    template: FestivalActivityDef;
  } | null {
    const template = this.getFestivalTemplate(festivalType);
    if (!template) return null;

    const endTime = startTime + durationDays * 24 * 60 * 60 * 1000;
    const flow = this.createTimedActivityFlow(template.id, startTime, endTime);

    return { flow, template };
  }

  // ─── #18 活动离线进度 ──────────────────────

  /**
   * 计算活动离线进度
   */
  calculateOfflineProgress(
    activityId: string,
    activityType: string,
    offlineDurationMs: number,
  ): OfflineActivityResult {
    const durationSeconds = offlineDurationMs / 1000;

    // 根据活动类型获取效率
    let efficiency = 0.5;
    if (activityType === 'season') efficiency = this.offlineEfficiency.season;
    else if (activityType === 'limitedTime') efficiency = this.offlineEfficiency.limitedTime;
    else if (activityType === 'daily') efficiency = this.offlineEfficiency.daily;
    else if (activityType === 'festival') efficiency = this.offlineEfficiency.festival;
    else if (activityType === 'alliance') efficiency = this.offlineEfficiency.alliance;

    const pointsEarned = Math.floor(durationSeconds * BASE_POINTS_PER_SECOND * efficiency);
    const tokensEarned = Math.floor(pointsEarned * 0.1);

    return {
      activityId,
      pointsEarned,
      tokensEarned,
      offlineDuration: offlineDurationMs,
    };
  }

  /**
   * 批量计算离线进度
   */
  calculateAllOfflineProgress(
    activities: Array<{ id: string; type: string }>,
    offlineDurationMs: number,
  ): ActivityOfflineSummary {
    const activityResults: OfflineActivityResult[] = [];
    let totalPoints = 0;
    let totalTokens = 0;

    for (const activity of activities) {
      const result = this.calculateOfflineProgress(
        activity.id,
        activity.type,
        offlineDurationMs,
      );
      activityResults.push(result);
      totalPoints += result.pointsEarned;
      totalTokens += result.tokensEarned;
    }

    return {
      offlineDurationMs,
      activityResults,
      totalPoints,
      totalTokens,
      eventPile: null,
    };
  }

  // ─── 工具方法 ──────────────────────────────

  /** 获取离线效率配置 */
  getOfflineEfficiency(): OfflineEfficiencyConfig {
    return { ...this.offlineEfficiency };
  }

  /** 获取所有活动流程 */
  getAllFlows(): TimedActivityFlow[] {
    return Array.from(this.flows.values());
  }

  // ─── 序列化 ──────────────────────────────

  /** 导出存档 */
  serialize(): {
    flows: TimedActivityFlow[];
    leaderboards: Array<{ activityId: string; entries: ActivityRankEntry[] }>;
  } {
    return {
      flows: Array.from(this.flows.values()).map((f) => ({ ...f })),
      leaderboards: Array.from(this.leaderboards.entries()).map(
        ([activityId, entries]) => ({ activityId, entries: entries.map((e) => ({ ...e })) }),
      ),
    };
  }

  /** 导入存档 */
  deserialize(data: {
    flows: TimedActivityFlow[];
    leaderboards: Array<{ activityId: string; entries: ActivityRankEntry[] }>;
  }): void {
    this.flows.clear();
    for (const flow of data.flows ?? []) {
      this.flows.set(flow.activityId, { ...flow });
    }

    this.leaderboards.clear();
    for (const lb of data.leaderboards ?? []) {
      this.leaderboards.set(lb.activityId, lb.entries.map((e) => ({ ...e })));
    }
  }
}
