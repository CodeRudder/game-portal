/**
 * 活动系统 — 核心类型定义
 *
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 * 覆盖：活动列表、5类活动矩阵、活动任务、里程碑奖励、每日签到、离线进度
 *
 * @module core/activity/activity.types
 */

// ─────────────────────────────────────────────
// 1. 活动类型矩阵
// ─────────────────────────────────────────────

/** 活动类型（5类） */
export enum ActivityType {
  /** 赛季活动 — 长期(28天)，最多1个并行 */
  SEASON = 'SEASON',
  /** 限时活动 — 中期(7~14天)，最多2个并行 */
  LIMITED_TIME = 'LIMITED_TIME',
  /** 日常活动 — 常驻，1个 */
  DAILY = 'DAILY',
  /** 节日活动 — 短期(3~7天)，最多1个并行 */
  FESTIVAL = 'FESTIVAL',
  /** 联盟活动 — 中期(7天)，最多1个并行 */
  ALLIANCE = 'ALLIANCE',
}

/** 活动状态 */
export enum ActivityStatus {
  /** 未开始 */
  UPCOMING = 'UPCOMING',
  /** 进行中 */
  ACTIVE = 'ACTIVE',
  /** 已结束 */
  ENDED = 'ENDED',
}

/** 活动并行上限配置 */
export interface ActivityConcurrencyConfig {
  /** 赛季活动最大并行数 */
  maxSeason: number; // 1
  /** 限时活动最大并行数 */
  maxLimitedTime: number; // 2
  /** 日常活动最大并行数 */
  maxDaily: number; // 1
  /** 节日活动最大并行数 */
  maxFestival: number; // 1
  /** 联盟活动最大并行数 */
  maxAlliance: number; // 1
  /** 总最大并行数 */
  maxTotal: number; // 5
}

/** 活动定义 */
export interface ActivityDef {
  /** 活动ID */
  id: string;
  /** 活动名称 */
  name: string;
  /** 活动描述 */
  description: string;
  /** 活动类型 */
  type: ActivityType;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
  /** 活动图标 */
  icon: string;
}

/** 活动实例（运行时） */
export interface ActivityInstance {
  /** 活动定义ID */
  defId: string;
  /** 活动状态 */
  status: ActivityStatus;
  /** 活动积分 */
  points: number;
  /** 活动代币 */
  tokens: number;
  /** 任务列表 */
  tasks: ActivityTask[];
  /** 里程碑列表 */
  milestones: ActivityMilestone[];
  /** 创建时间 */
  createdAt: number;
}

// ─────────────────────────────────────────────
// 2. 活动任务系统
// ─────────────────────────────────────────────

/** 活动任务类型 */
export enum ActivityTaskType {
  /** 每日任务 — 5个/天, 0点重置 */
  DAILY = 'DAILY',
  /** 挑战任务 — 3个/期, 需手动完成 */
  CHALLENGE = 'CHALLENGE',
  /** 累积任务 — 持续累积, 达成即完成 */
  CUMULATIVE = 'CUMULATIVE',
}

/** 活动任务状态 */
export enum ActivityTaskStatus {
  /** 未完成 */
  INCOMPLETE = 'INCOMPLETE',
  /** 已完成待领取 */
  COMPLETED = 'COMPLETED',
  /** 已领取 */
  CLAIMED = 'CLAIMED',
}

/** 活动任务定义 */
export interface ActivityTaskDef {
  /** 任务ID */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务描述 */
  description: string;
  /** 任务类型 */
  taskType: ActivityTaskType;
  /** 目标数量 */
  targetCount: number;
  /** 奖励代币 */
  tokenReward: number;
  /** 奖励积分 */
  pointReward: number;
  /** 奖励资源 */
  resourceReward: Record<string, number>;
}

/** 活动任务实例 */
export interface ActivityTask {
  /** 任务定义ID */
  defId: string;
  /** 任务类型 */
  taskType: ActivityTaskType;
  /** 当前进度 */
  currentProgress: number;
  /** 目标数量 */
  targetCount: number;
  /** 状态 */
  status: ActivityTaskStatus;
  /** 代币奖励 */
  tokenReward: number;
  /** 积分奖励 */
  pointReward: number;
  /** 资源奖励 */
  resourceReward: Record<string, number>;
}

// ─────────────────────────────────────────────
// 3. 里程碑奖励
// ─────────────────────────────────────────────

/** 里程碑状态 */
export enum MilestoneStatus {
  /** 未解锁 */
  LOCKED = 'LOCKED',
  /** 已解锁待领取 */
  UNLOCKED = 'UNLOCKED',
  /** 已领取 */
  CLAIMED = 'CLAIMED',
}

/** 里程碑节点 */
export interface ActivityMilestone {
  /** 里程碑ID */
  id: string;
  /** 所需积分 */
  requiredPoints: number;
  /** 状态 */
  status: MilestoneStatus;
  /** 奖励 */
  rewards: Record<string, number>;
  /** 是否为最终节点（需手动确认） */
  isFinal: boolean;
}

// ─────────────────────────────────────────────
// 4. 每日签到
// ─────────────────────────────────────────────

/** 签到奖励定义（7天循环） */
export interface SignInReward {
  /** 天数(1~7) */
  day: number;
  /** 奖励描述 */
  description: string;
  /** 奖励资源 */
  rewards: Record<string, number>;
  /** 奖励代币 */
  tokenReward: number;
}

/** 签到数据 */
export interface SignInData {
  /** 当前连续天数(1~7) */
  consecutiveDays: number;
  /** 今日是否已签到 */
  todaySigned: boolean;
  /** 上次签到时间 */
  lastSignInTime: number;
  /** 本周已补签次数 */
  weeklyRetroactiveCount: number;
  /** 上次补签重置时间(周) */
  lastRetroactiveResetWeek: number;
}

/** 签到配置 */
export interface SignInConfig {
  /** 补签消耗元宝 */
  retroactiveCostGold: number; // 50
  /** 每周最多补签次数 */
  weeklyRetroactiveLimit: number; // 2
  /** 连续3天加成(%) */
  consecutive3Bonus: number; // 20
  /** 连续7天加成(%) */
  consecutive7Bonus: number; // 50
}

// ─────────────────────────────────────────────
// 5. 活动离线进度
// ─────────────────────────────────────────────

/** 各活动类型的离线效率 */
export interface OfflineEfficiencyConfig {
  /** 赛季活动离线效率 */
  season: number; // 0.5 (50%)
  /** 限时活动离线效率 */
  limitedTime: number; // 0.3 (30%)
  /** 日常活动离线效率 */
  daily: number; // 1.0 (100%)
  /** 节日活动离线效率 */
  festival: number; // 0.5 (50%)
  /** 联盟活动离线效率 */
  alliance: number; // 0.5 (50%)
}

/** 离线进度结果 */
export interface OfflineActivityResult {
  /** 活动ID */
  activityId: string;
  /** 获得积分 */
  pointsEarned: number;
  /** 获得代币 */
  tokensEarned: number;
  /** 离线时长(毫秒) */
  offlineDuration: number;
}

// ─────────────────────────────────────────────
// 6. 赛季深化
// ─────────────────────────────────────────────

/** 赛季主题 */
export interface SeasonTheme {
  /** 主题ID */
  id: string;
  /** 主题名称 */
  name: string;
  /** 主题描述 */
  description: string;
  /** 专属头像框ID */
  avatarFrameId: string;
  /** 王者专属称号 */
  kingTitle: string;
}

/** 赛季结算动画数据 */
export interface SeasonSettlementAnimation {
  /** 赛季ID */
  seasonId: string;
  /** 旧段位ID */
  oldRankId: string;
  /** 新段位ID */
  newRankId: string;
  /** 旧排名 */
  oldRanking: number;
  /** 新排名 */
  newRanking: number;
  /** 结算奖励 */
  rewards: {
    copper: number;
    arenaCoin: number;
    gold: number;
    title: string | null;
  };
  /** 是否全服公告 */
  isServerAnnouncement: boolean;
}

/** 赛季战绩 */
export interface SeasonRecord {
  /** 赛季ID */
  seasonId: string;
  /** 胜场数 */
  wins: number;
  /** 败场数 */
  losses: number;
  /** 总场数 */
  total: number;
  /** 胜率(%) */
  winRate: number;
  /** 最高段位 */
  highestRank: string;
  /** 最高排名 */
  highestRanking: number;
}

/** 赛季战绩排行条目 */
export interface SeasonRecordEntry {
  /** 玩家ID */
  playerId: string;
  /** 玩家名称 */
  playerName: string;
  /** 胜场数 */
  wins: number;
  /** 胜率(%) */
  winRate: number;
  /** 排名 */
  rank: number;
}

// ─────────────────────────────────────────────
// 7. 活动系统状态
// ─────────────────────────────────────────────

/** 活动系统状态 */
export interface ActivityState {
  /** 当前活动实例列表 */
  activities: Record<string, ActivityInstance>;
  /** 签到数据 */
  signIn: SignInData;
  /** 赛季战绩 */
  seasonRecord: SeasonRecord;
}

/** 活动系统存档 */
export interface ActivitySaveData {
  /** 存档版本 */
  version: number;
  /** 活动状态 */
  state: ActivityState;
}
