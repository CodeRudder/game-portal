/**
 * 排行榜系统 — 类型定义
 *
 * v12.0 排行榜模块的全部类型
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 *
 * @module core/leaderboard/leaderboard.types
 */

// ─────────────────────────────────────────────
// 1. 排行榜维度
// ─────────────────────────────────────────────

/** 排行榜类型（5个维度） */
export enum LeaderboardType {
  /** 战力榜 — 总战力降序 */
  POWER = 'POWER',
  /** 财富榜 — 铜钱持有量降序 */
  WEALTH = 'WEALTH',
  /** 远征榜 — 远征通关数降序 */
  EXPEDITION = 'EXPEDITION',
  /** 竞技榜 — PVP积分降序 */
  ARENA = 'ARENA',
  /** 赛季战绩榜 — 本赛季胜场数降序 */
  SEASON = 'SEASON',
}

/** 排行榜类型标签 */
export const LEADERBOARD_LABELS: Record<LeaderboardType, string> = {
  [LeaderboardType.POWER]: '战力榜',
  [LeaderboardType.WEALTH]: '财富榜',
  [LeaderboardType.EXPEDITION]: '远征榜',
  [LeaderboardType.ARENA]: '竞技榜',
  [LeaderboardType.SEASON]: '赛季战绩榜',
};

/** 排行榜刷新频率 */
export enum RefreshFrequency {
  /** 实时刷新 */
  REALTIME = 'REALTIME',
  /** 每日0:00刷新 */
  DAILY = 'DAILY',
}

/** 各排行榜刷新频率配置 */
export const LEADERBOARD_REFRESH: Record<LeaderboardType, RefreshFrequency> = {
  [LeaderboardType.POWER]: RefreshFrequency.REALTIME,
  [LeaderboardType.WEALTH]: RefreshFrequency.DAILY,
  [LeaderboardType.EXPEDITION]: RefreshFrequency.REALTIME,
  [LeaderboardType.ARENA]: RefreshFrequency.REALTIME,
  [LeaderboardType.SEASON]: RefreshFrequency.REALTIME,
};

/** 排行榜展示条目上限 */
export const MAX_DISPLAY_ENTRIES = 100;

// ─────────────────────────────────────────────
// 2. 排行条目
// ─────────────────────────────────────────────

/** 排行条目数据 */
export interface LeaderboardEntry {
  /** 排名（1~100） */
  rank: number;
  /** 玩家ID */
  playerId: string;
  /** 玩家昵称 */
  playerName: string;
  /** 主城等级 */
  castleLevel: number;
  /** 阵营 */
  faction: 'shu' | 'wei' | 'wu' | null;
  /** 核心数值（战力/铜钱/通关数/积分/胜场） */
  score: number;
  /** 胜率（仅竞技榜） */
  winRate?: number;
}

// ─────────────────────────────────────────────
// 3. 排行榜数据
// ─────────────────────────────────────────────

/** 单个排行榜快照 */
export interface LeaderboardSnapshot {
  /** 排行榜类型 */
  type: LeaderboardType;
  /** 排行条目列表 */
  entries: LeaderboardEntry[];
  /** 自己的排名（底部固定高亮） */
  selfEntry: LeaderboardEntry | null;
  /** 最后刷新时间戳（ms） */
  lastRefreshTime: number;
  /** 刷新频率 */
  refreshFrequency: RefreshFrequency;
}

// ─────────────────────────────────────────────
// 4. 排行榜奖励
// ─────────────────────────────────────────────

/** 排名奖励梯度 */
export interface RankRewardTier {
  /** 起始排名（含） */
  rankStart: number;
  /** 结束排名（含） */
  rankEnd: number;
  /** 元宝奖励 */
  gems: number;
  /** 铜钱奖励 */
  gold: number;
  /** 竞技币奖励（仅竞技榜） */
  arenaCoins: number;
}

/** 战力榜/财富榜/远征榜/赛季榜奖励梯度 */
export const STANDARD_REWARD_TIERS: RankRewardTier[] = [
  { rankStart: 1, rankEnd: 1, gems: 50, gold: 5000, arenaCoins: 0 },
  { rankStart: 2, rankEnd: 3, gems: 30, gold: 3000, arenaCoins: 0 },
  { rankStart: 4, rankEnd: 10, gems: 15, gold: 2000, arenaCoins: 0 },
  { rankStart: 11, rankEnd: 50, gems: 5, gold: 1000, arenaCoins: 0 },
  { rankStart: 51, rankEnd: 100, gems: 0, gold: 500, arenaCoins: 0 },
];

/** 竞技榜奖励梯度 */
export const ARENA_REWARD_TIERS: RankRewardTier[] = [
  { rankStart: 1, rankEnd: 1, gems: 30, gold: 0, arenaCoins: 200 },
  { rankStart: 2, rankEnd: 3, gems: 20, gold: 0, arenaCoins: 150 },
  { rankStart: 4, rankEnd: 10, gems: 10, gold: 0, arenaCoins: 100 },
  { rankStart: 11, rankEnd: 50, gems: 5, gold: 0, arenaCoins: 50 },
  { rankStart: 51, rankEnd: 100, gems: 0, gold: 0, arenaCoins: 20 },
];

/** 每日奖励发放记录 */
export interface DailyRewardRecord {
  /** 发放日期 YYYY-MM-DD */
  date: string;
  /** 各榜单获得的奖励 */
  rewards: Record<LeaderboardType, RankRewardTier | null>;
}

// ─────────────────────────────────────────────
// 5. 排行榜状态
// ─────────────────────────────────────────────

/** 排行榜系统运行时状态 */
export interface LeaderboardState {
  /** 各排行榜快照 */
  snapshots: Record<LeaderboardType, LeaderboardSnapshot>;
  /** 每日奖励记录 */
  dailyRewards: DailyRewardRecord[];
  /** 上次每日奖励发放日期 */
  lastRewardDate: string;
}

/** 排行榜存档数据（可序列化） */
export interface LeaderboardSaveData {
  version: number;
  lastRewardDate: string;
  dailyRewards: DailyRewardRecord[];
}
