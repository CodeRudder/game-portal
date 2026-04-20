/**
 * 排行榜系统 — 引擎层
 *
 * 职责：多维度排名管理、实时/每日刷新、每日奖励发放
 * 规则：
 *   - 5个维度：战力/财富/远征/竞技/赛季
 *   - 展示前100名+自己排名（底部固定高亮）
 *   - 刷新：战力/远征/竞技实时，财富/公会每日0:00
 *   - 奖励：按排名梯度发放（元宝+铜钱+竞技币）
 *
 * @module engine/leaderboard/LeaderboardSystem
 */

import type {
  LeaderboardEntry,
  LeaderboardSnapshot,
  LeaderboardState,
  LeaderboardSaveData,
  LeaderboardType,
  RankRewardTier,
  DailyRewardRecord,
} from '../../core/leaderboard/leaderboard.types';
import {
  LeaderboardType as LT,
  RefreshFrequency,
  LEADERBOARD_LABELS,
  LEADERBOARD_REFRESH,
  MAX_DISPLAY_ENTRIES,
  STANDARD_REWARD_TIERS,
  ARENA_REWARD_TIERS,
} from '../../core/leaderboard/leaderboard.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 辅助类型
// ─────────────────────────────────────────────

/** 排行榜更新数据 */
export interface LeaderboardUpdateData {
  playerId: string;
  playerName: string;
  castleLevel: number;
  faction: 'shu' | 'wei' | 'wu' | null;
  score: number;
  winRate?: number;
}

/** 排行榜奖励发放结果 */
export interface RewardDistributionResult {
  date: string;
  distributed: boolean;
  rewards: Record<LeaderboardType, RankRewardTier | null>;
}

// ─────────────────────────────────────────────
// LeaderboardSystem 类
// ─────────────────────────────────────────────

export class LeaderboardSystem {
  private state: LeaderboardState;
  private selfPlayerId: string;

  constructor(selfPlayerId: string = 'player_001') {
    this.selfPlayerId = selfPlayerId;
    this.state = this.createDefaultState();
  }

  // ─── 状态访问 ─────────────────────────────

  getState(): LeaderboardState {
    return this.state;
  }

  getSnapshot(type: LeaderboardType): LeaderboardSnapshot {
    return this.state.snapshots[type];
  }

  getSelfEntry(type: LeaderboardType): LeaderboardEntry | null {
    return this.state.snapshots[type]?.selfEntry ?? null;
  }

  getSelfRank(type: LeaderboardType): number {
    const snapshot = this.state.snapshots[type];
    if (!snapshot) return 0;

    // 先在排行榜中找
    const entry = snapshot.entries.find(e => e.playerId === this.selfPlayerId);
    if (entry) return entry.rank;

    // 再看selfEntry
    return snapshot.selfEntry?.rank ?? 0;
  }

  // ─── 更新排行榜 ─────────────────────────────

  /**
   * 更新玩家数据（实时排行榜立即更新）
   */
  updateEntry(type: LeaderboardType, data: LeaderboardUpdateData): void {
    const snapshot = this.state.snapshots[type];

    // 如果是每日刷新的排行榜，仅在刷新时更新
    if (LEADERBOARD_REFRESH[type] === RefreshFrequency.DAILY) {
      // 暂存到selfEntry
      if (data.playerId === this.selfPlayerId) {
        snapshot.selfEntry = {
          rank: 0,
          playerId: data.playerId,
          playerName: data.playerName,
          castleLevel: data.castleLevel,
          faction: data.faction,
          score: data.score,
          winRate: data.winRate,
        };
      }
      return;
    }

    // 实时排行榜：更新条目
    this.updateRealtimeSnapshot(snapshot, data);
  }

  /**
   * 批量更新（用于排行榜重排）
   */
  batchUpdate(type: LeaderboardType, entries: LeaderboardUpdateData[]): void {
    const snapshot = this.state.snapshots[type];

    // 清空并重建
    snapshot.entries = [];
    for (const data of entries) {
      this.updateRealtimeSnapshot(snapshot, data);
    }

    // 重新排序并分配排名
    snapshot.entries.sort((a, b) => b.score - a.score);
    for (let i = 0; i < snapshot.entries.length; i++) {
      snapshot.entries[i].rank = i + 1;
    }

    // 截断到最大展示数
    snapshot.entries = snapshot.entries.slice(0, MAX_DISPLAY_ENTRIES);

    // 更新selfEntry
    const selfInList = snapshot.entries.find(e => e.playerId === this.selfPlayerId);
    if (selfInList) {
      snapshot.selfEntry = { ...selfInList };
    } else {
      // 自己不在前100，估算排名
      const selfData = entries.find(e => e.playerId === this.selfPlayerId);
      if (selfData) {
        const higherCount = snapshot.entries.filter(e => e.score > selfData.score).length;
        snapshot.selfEntry = {
          rank: higherCount + 1,
          playerId: selfData.playerId,
          playerName: selfData.playerName,
          castleLevel: selfData.castleLevel,
          faction: selfData.faction,
          score: selfData.score,
          winRate: selfData.winRate,
        };
      }
    }

    snapshot.lastRefreshTime = Date.now();
  }

  /**
   * 每日刷新（0:00调用）
   */
  dailyRefresh(allEntries: Record<LeaderboardType, LeaderboardUpdateData[]>): void {
    for (const type of Object.values(LT)) {
      if (LEADERBOARD_REFRESH[type] === RefreshFrequency.DAILY) {
        this.batchUpdate(type, allEntries[type] ?? []);
      }
    }
  }

  // ─── 奖励发放 ─────────────────────────────

  /**
   * 发放每日排行榜奖励
   */
  distributeDailyRewards(date?: string): RewardDistributionResult {
    const today = date ?? this.getTodayString();

    // 检查是否已发放
    if (this.state.lastRewardDate === today) {
      return {
        date: today,
        distributed: false,
        rewards: this.getLastRewardRecord()?.rewards ?? this.createEmptyRewardMap(),
      };
    }

    const rewards: Record<LeaderboardType, RankRewardTier | null> = this.createEmptyRewardMap();

    for (const type of Object.values(LT)) {
      const rank = this.getSelfRank(type);
      const tiers = type === LT.ARENA ? ARENA_REWARD_TIERS : STANDARD_REWARD_TIERS;
      rewards[type] = this.findRewardTier(rank, tiers);
    }

    // 记录发放
    const record: DailyRewardRecord = { date: today, rewards };
    this.state.dailyRewards.push(record);
    this.state.lastRewardDate = today;

    return { date: today, distributed: true, rewards };
  }

  /**
   * 获取指定排名的奖励
   */
  getRewardForRank(type: LeaderboardType, rank: number): RankRewardTier | null {
    const tiers = type === LT.ARENA ? ARENA_REWARD_TIERS : STANDARD_REWARD_TIERS;
    return this.findRewardTier(rank, tiers);
  }

  // ─── 序列化 ─────────────────────────────

  serialize(): LeaderboardSaveData {
    return {
      version: SAVE_VERSION,
      lastRewardDate: this.state.lastRewardDate,
      dailyRewards: this.state.dailyRewards.map(r => ({
        date: r.date,
        rewards: { ...r.rewards },
      })),
    };
  }

  deserialize(data: LeaderboardSaveData): void {
    this.state.lastRewardDate = data.lastRewardDate;
    this.state.dailyRewards = data.dailyRewards;
  }

  // ─── 内部方法 ─────────────────────────────

  private createDefaultState(): LeaderboardState {
    const snapshots: Record<LeaderboardType, LeaderboardSnapshot> = {} as Record<LeaderboardType, LeaderboardSnapshot>;
    for (const type of Object.values(LT)) {
      snapshots[type] = {
        type,
        entries: [],
        selfEntry: null,
        lastRefreshTime: 0,
        refreshFrequency: LEADERBOARD_REFRESH[type],
      };
    }

    return {
      snapshots,
      dailyRewards: [],
      lastRewardDate: '',
    };
  }

  private updateRealtimeSnapshot(snapshot: LeaderboardSnapshot, data: LeaderboardUpdateData): void {
    // 查找已有条目
    const existingIdx = snapshot.entries.findIndex(e => e.playerId === data.playerId);

    const entry: LeaderboardEntry = {
      rank: 0,
      playerId: data.playerId,
      playerName: data.playerName,
      castleLevel: data.castleLevel,
      faction: data.faction,
      score: data.score,
      winRate: data.winRate,
    };

    if (existingIdx >= 0) {
      snapshot.entries[existingIdx] = entry;
    } else {
      snapshot.entries.push(entry);
    }

    // 排序
    snapshot.entries.sort((a, b) => b.score - a.score);
    for (let i = 0; i < snapshot.entries.length; i++) {
      snapshot.entries[i].rank = i + 1;
    }

    // 截断
    if (snapshot.entries.length > MAX_DISPLAY_ENTRIES) {
      snapshot.entries = snapshot.entries.slice(0, MAX_DISPLAY_ENTRIES);
    }

    snapshot.lastRefreshTime = Date.now();
  }

  private findRewardTier(rank: number, tiers: RankRewardTier[]): RankRewardTier | null {
    for (const tier of tiers) {
      if (rank >= tier.rankStart && rank <= tier.rankEnd) {
        return tier;
      }
    }
    return null;
  }

  private createEmptyRewardMap(): Record<LeaderboardType, RankRewardTier | null> {
    const map: Partial<Record<LeaderboardType, RankRewardTier | null>> = {};
    for (const type of Object.values(LT)) {
      map[type] = null;
    }
    return map as Record<LeaderboardType, RankRewardTier | null>;
  }

  private getLastRewardRecord(): DailyRewardRecord | undefined {
    return this.state.dailyRewards[this.state.dailyRewards.length - 1];
  }

  private getTodayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
