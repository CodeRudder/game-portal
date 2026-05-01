/**
 * 排行榜系统 — 引擎层
 *
 * 职责：全服排行榜管理、排名计算、赛季重置、奖励发放
 * 规则：
 *   - 排行榜类型：战力榜、远征榜、竞技榜、财富榜、赛季战绩榜、公会榜
 *   - 排名基于分数降序，同分按达成时间先后排序
 *   - 每日21:00刷新（与MAL PRD对齐），赛季每28天重置（与PVP PRD对齐）
 *   - 前100名可获得奖励，前3名额外奖励
 */
import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  LeaderboardEntry,
  LeaderboardSeason,
  LeaderboardRewardConfig,
  LeaderboardQuery,
  LeaderboardPageResult,
  LeaderboardState,
} from './leaderboard-types';
import {
  LeaderboardType,
  LEADERBOARD_TYPE_LABELS,
  createDefaultLeaderboardState,
  MAX_ENTRIES,
  MAX_PAGE_SIZE,
  DAILY_REFRESH_MS,
  SEASON_DAYS,
  REWARD_CONFIGS,
  generateSeasonId,
} from './leaderboard-types';

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
    return JSON.parse(JSON.stringify(this.state));
  }

  getCurrentSeason(): LeaderboardSeason {
    return { ...this.state.currentSeason };
  }

  getSeasonHistory(): LeaderboardSeason[] {
    return this.state.seasonHistory.map(s => ({ ...s }));
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
    // P0-02 fix: 校验 score 合法性
    if (!Number.isFinite(score) || score < 0) {
      throw new Error(`无效分数: ${score}，必须为非负有限数`);
    }

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
      metadata: { ...metadata },
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

    // 计算奖励（所有类型）— 仅前100名
    const REWARD_MAX_RANK = 100;
    const rewards: Array<{ playerId: string; rank: number; reward: LeaderboardRewardConfig['reward'] }> = [];
    for (const typeKey of Object.values(LeaderboardType)) {
      const board = this.state.boards[typeKey as LeaderboardType];
      for (const entry of board) {
        if (entry.rank > REWARD_MAX_RANK) continue; // P0-09 fix: 显式上限过滤
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

// 重导出供测试和外部使用
export type {
  LeaderboardEntry,
  LeaderboardSeason,
  LeaderboardRewardConfig,
  LeaderboardQuery,
  LeaderboardPageResult,
  LeaderboardState,
} from './leaderboard-types';
export {
  LeaderboardType,
  LEADERBOARD_TYPE_LABELS,
  createDefaultLeaderboardState,
} from './leaderboard-types';
