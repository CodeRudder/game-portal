/**
 * 排行榜系统 — 引擎层
 *
 * 职责：全服排行榜管理、排名计算、赛季重置、奖励发放
 * 规则：
 *   - 排行榜类型：战力榜、远征榜、竞技榜、财富榜
 *   - 排名基于分数降序，同分按达成时间先后排序
 *   - 每日0点刷新，赛季每30天重置
 *   - 前100名可获得奖励，前3名额外奖励
 *   - 查询支持分页，每页最多20条
 *
 * @module engine/social/LeaderboardSystem
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 排行榜类型 */
export enum LeaderboardType {
  /** 战力榜 */
  POWER = 'POWER',
  /** 远征榜（通关路线数） */
  EXPEDITION = 'EXPEDITION',
  /** 竞技榜（竞技场积分） */
  ARENA = 'ARENA',
  /** 财富榜（铜钱总量） */
  WEALTH = 'WEALTH',
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
const SEASON_DAYS = 30;

/** 每日刷新间隔（毫秒） */
const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000;

/** 每页最大条目数 */
const MAX_PAGE_SIZE = 20;

/** 排行榜最大容量 */
const MAX_ENTRIES = 1000;

/** 排行榜奖励配置 */
const REWARD_CONFIGS: LeaderboardRewardConfig[] = [
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
};

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成赛季ID */
let _seasonCounter = 0;
function generateSeasonId(): string {
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

export class LeaderboardSystem implements ISubsystem {
  readonly name = 'SocialLeaderboardSystem' as const;
  private deps!: ISystemDeps;
  private state: LeaderboardState;

  constructor(initialState?: LeaderboardState) {
    this.state = initialState ?? createDefaultLeaderboardState();
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 预留 */ }
  reset(): void { this.state = createDefaultLeaderboardState(); }

  // ─── 状态访问 ─────────────────────────────

  getState(): LeaderboardState {
    return this.state;
  }

  getCurrentSeason(): LeaderboardSeason {
    return this.state.currentSeason;
  }

  getSeasonHistory(): LeaderboardSeason[] {
    return this.state.seasonHistory;
  }

  // ─── 分数更新 ─────────────────────────────

  /**
   * 更新玩家分数
   *
   * 如果玩家已在榜上，取最高分；同分不更新
   * 如果不在榜上，新增条目
   */
  updateScore(
    type: LeaderboardType,
    playerId: string,
    playerName: string,
    score: number,
    metadata: Record<string, string | number> = {},
  ): LeaderboardEntry | null {
    const board = this.state.boards[type];
    const now = Date.now();

    // 查找已有条目
    const existingIdx = board.findIndex(e => e.playerId === playerId);

    if (existingIdx >= 0) {
      const existing = board[existingIdx];
      // 只在新分数更高时更新
      if (score > existing.score) {
        existing.score = score;
        existing.achievedAt = now;
        existing.playerName = playerName;
        existing.metadata = { ...existing.metadata, ...metadata };
      } else if (score === existing.score) {
        // 同分不更新
        return existing;
      } else {
        // 分数更低不更新
        return existing;
      }
      this.sortBoard(type);
      this.assignRanks(type);
      return existing;
    }

    // 新增条目
    if (board.length >= MAX_ENTRIES) {
      // 检查是否超过最低分
      const lastEntry = board[board.length - 1];
      if (score <= lastEntry.score) {
        return null; // 未入榜
      }
      // 移除最后一名
      board.pop();
    }

    const entry: LeaderboardEntry = {
      playerId,
      playerName,
      score,
      achievedAt: now,
      rank: 0,
      metadata,
    };
    board.push(entry);
    this.sortBoard(type);
    this.assignRanks(type);

    return entry;
  }

  /**
   * 批量更新分数（用于每日刷新）
   */
  batchUpdateScores(
    type: LeaderboardType,
    updates: Array<{ playerId: string; playerName: string; score: number; metadata?: Record<string, string | number> }>,
  ): void {
    for (const u of updates) {
      this.updateScore(type, u.playerId, u.playerName, u.score, u.metadata ?? {});
    }
  }

  // ─── 查询 ─────────────────────────────

  /**
   * 分页查询排行榜
   */
  queryLeaderboard(query: LeaderboardQuery): LeaderboardPageResult {
    const { type, page, pageSize } = query;
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const board = this.state.boards[type];
    const totalEntries = board.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / safePageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);

    const startIdx = (safePage - 1) * safePageSize;
    const endIdx = Math.min(startIdx + safePageSize, totalEntries);
    const entries = board.slice(startIdx, endIdx);

    return {
      type,
      page: safePage,
      totalPages,
      totalEntries,
      entries,
    };
  }

  /**
   * 查询玩家排名
   */
  getPlayerRank(type: LeaderboardType, playerId: string): LeaderboardEntry | null {
    const board = this.state.boards[type];
    return board.find(e => e.playerId === playerId) ?? null;
  }

  /**
   * 查询玩家附近的排名（前后各N名）
   */
  getAroundPlayer(type: LeaderboardType, playerId: string, range: number = 5): LeaderboardEntry[] {
    const board = this.state.boards[type];
    const idx = board.findIndex(e => e.playerId === playerId);
    if (idx < 0) return [];

    const start = Math.max(0, idx - range);
    const end = Math.min(board.length, idx + range + 1);
    return board.slice(start, end);
  }

  /**
   * 获取前N名
   */
  getTopN(type: LeaderboardType, n: number = 10): LeaderboardEntry[] {
    return this.state.boards[type].slice(0, n);
  }

  // ─── 赛季管理 ─────────────────────────────

  /**
   * 检查并执行每日刷新
   */
  checkDailyRefresh(now: number): boolean {
    if (now - this.state.lastRefreshTime >= DAILY_REFRESH_MS) {
      this.state.lastRefreshTime = now;
      return true;
    }
    return false;
  }

  /**
   * 检查赛季是否结束
   */
  isSeasonEnded(now: number): boolean {
    return now >= this.state.currentSeason.endTime;
  }

  /**
   * 结算当前赛季并开启新赛季
   *
   * @returns 赛季结算奖励列表
   */
  endSeasonAndStartNew(now: number): Array<{ playerId: string; rank: number; reward: LeaderboardRewardConfig['reward'] }> {
    // 保存当前赛季到历史
    const oldSeason = this.state.currentSeason;
    oldSeason.isCurrent = false;
    this.state.seasonHistory.push({ ...oldSeason });

    // 计算奖励（所有类型）
    const rewards: Array<{ playerId: string; rank: number; reward: LeaderboardRewardConfig['reward'] }> = [];
    for (const typeKey of Object.values(LeaderboardType)) {
      const board = this.state.boards[typeKey as LeaderboardType];
      for (const entry of board) {
        const reward = this.getRewardForRank(entry.rank);
        if (reward) {
          rewards.push({
            playerId: entry.playerId,
            rank: entry.rank,
            reward,
          });
        }
      }
    }

    // 重置排行榜
    for (const typeKey of Object.values(LeaderboardType)) {
      this.state.boards[typeKey as LeaderboardType] = [];
    }

    // 新赛季
    const seasonNum = this.state.seasonHistory.length + 1;
    this.state.currentSeason = {
      id: generateSeasonId(),
      name: `第${seasonNum}赛季`,
      startTime: now,
      endTime: now + SEASON_DAYS * DAILY_REFRESH_MS,
      isCurrent: true,
    };

    return rewards;
  }

  // ─── 奖励 ─────────────────────────────

  /**
   * 获取指定排名的奖励
   */
  getRewardForRank(rank: number): LeaderboardRewardConfig['reward'] | null {
    for (const config of REWARD_CONFIGS) {
      if (rank >= config.minRank && rank <= config.maxRank) {
        return { ...config.reward };
      }
    }
    return null;
  }

  /**
   * 获取所有奖励配置
   */
  getRewardConfigs(): LeaderboardRewardConfig[] {
    return [...REWARD_CONFIGS];
  }

  // ─── 内部方法 ─────────────────────────────

  /** 排序：分数降序 → 时间升序 */
  private sortBoard(type: LeaderboardType): void {
    this.state.boards[type].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.achievedAt - b.achievedAt;
    });
  }

  /** 分配排名 */
  private assignRanks(type: LeaderboardType): void {
    const board = this.state.boards[type];
    for (let i = 0; i < board.length; i++) {
      board[i].rank = i + 1;
    }
  }
}
