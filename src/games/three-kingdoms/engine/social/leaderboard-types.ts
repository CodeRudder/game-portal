/**
 * Leaderboard - types and constants
 *
 * Extracted from LeaderboardSystem.ts.
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

export enum LeaderboardType {
  /** 战力榜 */
  POWER = 'POWER',
  /** 远征榜（通关路线数） */
  EXPEDITION = 'EXPEDITION',
  /** 竞技榜（竞技场积分） */
  ARENA = 'ARENA',
  /** 财富榜（铜钱总量） */
  WEALTH = 'WEALTH',
  /** 赛季战绩榜（本赛季胜场数） */
  SEASON_RECORD = 'SEASON_RECORD',
  /** 公会榜（公会总战力） */
  GUILD = 'GUILD',
}

/** 排行榜条目 */
export interface LeaderboardEntry {
  /** 玩家ID */
  playerId: string;
  /** 玩家名称 */
  playerName: string;
  /** 分数 */
  score: number;
  /** 达成时间（时间戳，用于同分排序） */
  achievedAt: number;
  /** 排名（计算后填充） */
  rank: number;
  /** 额外数据（如头像、等级等） */
  metadata: Record<string, string | number>;
}

/** 排行榜赛季 */
export interface LeaderboardSeason {
  /** 赛季ID */
  id: string;
  /** 赛季名称 */
  name: string;
  /** 开始时间（时间戳） */
  startTime: number;
  /** 结束时间（时间戳） */
  endTime: number;
  /** 是否当前赛季 */
  isCurrent: boolean;
}

/** 排行榜奖励配置 */
export interface LeaderboardRewardConfig {
  /** 最低排名（含） */
  minRank: number;
  /** 最高排名（含） */
  maxRank: number;
  /** 奖励描述 */
  reward: {
    gold: number;
    gems: number;
    title?: string;
  };
}

/** 分页查询参数 */
export interface LeaderboardQuery {
  /** 排行榜类型 */
  type: LeaderboardType;
  /** 页码（从1开始） */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/** 分页查询结果 */
export interface LeaderboardPageResult {
  /** 排行榜类型 */
  type: LeaderboardType;
  /** 当前页码 */
  page: number;
  /** 总页数 */
  totalPages: number;
  /** 总条目数 */
  totalEntries: number;
  /** 当前页数据 */
  entries: LeaderboardEntry[];
  /** 查询玩家自己的排名（如有） */
  selfEntry?: LeaderboardEntry;
}

/** 排行榜状态 */
export interface LeaderboardState {
  /** 各类型排行榜数据 */
  boards: Record<LeaderboardType, LeaderboardEntry[]>;
  /** 当前赛季 */
  currentSeason: LeaderboardSeason;
  /** 上次刷新时间 */
  lastRefreshTime: number;
  /** 赛季历史 */
  seasonHistory: LeaderboardSeason[];
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 赛季天数 */
export const SEASON_DAYS = 30;

/** 每日刷新间隔（毫秒） */
export const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000;

/** 每页最大条目数 */
export const MAX_PAGE_SIZE = 20;

/** 排行榜最大容量 */
export const MAX_ENTRIES = 1000;

/** 排行榜奖励配置 */
export const REWARD_CONFIGS: LeaderboardRewardConfig[] = [
  { minRank: 1, maxRank: 1, reward: { gold: 100000, gems: 500, title: '天下第一' } },
  { minRank: 2, maxRank: 3, reward: { gold: 50000, gems: 300, title: '万人敌' } },
  { minRank: 4, maxRank: 10, reward: { gold: 20000, gems: 150, title: '名将' } },
  { minRank: 11, maxRank: 50, reward: { gold: 10000, gems: 80 } },
  { minRank: 51, maxRank: 100, reward: { gold: 5000, gems: 30 } },
];

/** 排行榜类型中文名 */
export const LEADERBOARD_TYPE_LABELS: Record<LeaderboardType, string> = {
  [LeaderboardType.POWER]: '战力榜',
  [LeaderboardType.EXPEDITION]: '远征榜',
  [LeaderboardType.ARENA]: '竞技榜',
  [LeaderboardType.WEALTH]: '财富榜',
  [LeaderboardType.SEASON_RECORD]: '赛季战绩榜',
  [LeaderboardType.GUILD]: '公会榜',
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成赛季ID */
let _seasonCounter = 0;
export function generateSeasonId(): string {
  return `season_${Date.now()}_${++_seasonCounter}`;
}

/** 创建默认赛季 */
function createDefaultSeason(): LeaderboardSeason {
  const now = Date.now();
  return {
    id: generateSeasonId(),
    name: '第1赛季',
    startTime: now,
    endTime: now + SEASON_DAYS * DAILY_REFRESH_MS,
    isCurrent: true,
  };
}

/** 创建默认排行榜状态 */
export function createDefaultLeaderboardState(): LeaderboardState {
  return {
    boards: {
      [LeaderboardType.POWER]: [],
      [LeaderboardType.EXPEDITION]: [],
      [LeaderboardType.ARENA]: [],
      [LeaderboardType.WEALTH]: [],
      [LeaderboardType.SEASON_RECORD]: [],
      [LeaderboardType.GUILD]: [],
    },
    currentSeason: createDefaultSeason(),
    lastRefreshTime: Date.now(),
    seasonHistory: [],
  };
}

import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// LeaderboardSystem 类
// ─────────────────────────────────────────────

