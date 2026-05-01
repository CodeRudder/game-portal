/**
 * 竞技场赛季系统 — 引擎层
 *
 * 职责：赛季周期管理、段位奖励发放、赛季结算
 * 规则：
 *   - 赛季周期：28天
 *   - 结算时按最高段位发放奖励
 *   - 积分重置到当前段位最低值
 *
 * @module engine/pvp/ArenaSeasonSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  SeasonData,
  SeasonConfig,
  SeasonReward,
  ArenaPlayerState,
} from '../../core/pvp/pvp.types';
import { RANK_LEVELS, RANK_LEVEL_MAP } from './PvPBattleSystem';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认赛季配置 */
export const DEFAULT_SEASON_CONFIG: SeasonConfig = {
  seasonDays: 28,
  scoreResetRatio: 0.5,
};

/** 赛季结算奖励表（5大段位21级，与PRD PVP-3对齐） */
export const SEASON_REWARDS: SeasonReward[] = [
  // 青铜 (5级)
  { rankId: 'BRONZE_V', copper: 2000, arenaCoin: 50, gold: 20, title: null },
  { rankId: 'BRONZE_IV', copper: 3000, arenaCoin: 60, gold: 25, title: null },
  { rankId: 'BRONZE_III', copper: 4000, arenaCoin: 70, gold: 30, title: null },
  { rankId: 'BRONZE_II', copper: 5000, arenaCoin: 80, gold: 35, title: null },
  { rankId: 'BRONZE_I', copper: 6000, arenaCoin: 100, gold: 40, title: null },
  // 白银 (5级)
  { rankId: 'SILVER_V', copper: 7000, arenaCoin: 120, gold: 50, title: null },
  { rankId: 'SILVER_IV', copper: 8000, arenaCoin: 140, gold: 55, title: '银光闪耀' },
  { rankId: 'SILVER_III', copper: 9000, arenaCoin: 160, gold: 60, title: '银光闪耀' },
  { rankId: 'SILVER_II', copper: 10000, arenaCoin: 180, gold: 65, title: '银光闪耀' },
  { rankId: 'SILVER_I', copper: 11000, arenaCoin: 200, gold: 70, title: '银翼战士' },
  // 黄金 (5级)
  { rankId: 'GOLD_V', copper: 13000, arenaCoin: 220, gold: 75, title: '金甲将军' },
  { rankId: 'GOLD_IV', copper: 15000, arenaCoin: 250, gold: 80, title: '金甲将军' },
  { rankId: 'GOLD_III', copper: 17000, arenaCoin: 300, gold: 90, title: '金甲将军' },
  { rankId: 'GOLD_II', copper: 20000, arenaCoin: 350, gold: 100, title: '金甲将军' },
  { rankId: 'GOLD_I', copper: 23000, arenaCoin: 400, gold: 120, title: '黄金霸主' },
  // 钻石 (5级)
  { rankId: 'DIAMOND_V', copper: 28000, arenaCoin: 500, gold: 150, title: '钻石之心' },
  { rankId: 'DIAMOND_IV', copper: 32000, arenaCoin: 600, gold: 180, title: '钻石之心' },
  { rankId: 'DIAMOND_III', copper: 38000, arenaCoin: 700, gold: 200, title: '钻石之心' },
  { rankId: 'DIAMOND_II', copper: 45000, arenaCoin: 800, gold: 250, title: '钻石之心' },
  { rankId: 'DIAMOND_I', copper: 55000, arenaCoin: 1000, gold: 300, title: '钻石之心' },
  // 王者 (1级)
  { rankId: 'KING_I', copper: 100000, arenaCoin: 2000, gold: 500, title: '天下霸主' },
];

/** 赛季奖励映射 */
const SEASON_REWARD_MAP = new Map<string, SeasonReward>(
  SEASON_REWARDS.map((r) => [r.rankId, r]),
);

// ─────────────────────────────────────────────
// ArenaSeasonSystem 类
// ─────────────────────────────────────────────

/**
 * 赛季系统
 *
 * 管理赛季周期、结算、奖励
 */
export class ArenaSeasonSystem implements ISubsystem {
  readonly name = 'ArenaSeasonSystem';
  private deps!: ISystemDeps;
  private config: SeasonConfig;

  constructor(config?: Partial<SeasonConfig>) {
    this.config = { ...DEFAULT_SEASON_CONFIG, ...config };
  }

  // ── ISubsystem 接口 ─────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    /* 预留：可在此处理赛季自动结算检测 */
  }

  getState(): Record<string, unknown> {
    return {
      config: this.config,
      seasonDays: this.config.seasonDays,
    };
  }

  reset(): void {
    /* 赛季数据由外部管理，此处无内部状态需重置 */
  }

  // ── 赛季管理 ──────────────────────────────

  /**
   * 创建新赛季
   */
  createSeason(seasonId: string, startTime: number): SeasonData {
    const dayMs = 24 * 60 * 60 * 1000;
    return {
      seasonId,
      startTime,
      endTime: startTime + this.config.seasonDays * dayMs,
      currentDay: 1,
      isSettled: false,
    };
  }

  /**
   * 获取赛季当前天数
   */
  getCurrentDay(season: SeasonData, now: number): number {
    const dayMs = 24 * 60 * 60 * 1000;
    const elapsed = Math.floor((now - season.startTime) / dayMs);
    return Math.min(Math.max(1, elapsed + 1), this.config.seasonDays);
  }

  /**
   * 检查赛季是否已结束
   */
  isSeasonEnded(season: SeasonData, now: number): boolean {
    return now >= season.endTime;
  }

  /**
   * 检查赛季是否进行中
   */
  isSeasonActive(season: SeasonData, now: number): boolean {
    return now >= season.startTime && now < season.endTime;
  }

  /**
   * 获取赛季剩余天数
   */
  getRemainingDays(season: SeasonData, now: number): number {
    if (now >= season.endTime) return 0;
    const dayMs = 24 * 60 * 60 * 1000;
    return Math.ceil((season.endTime - now) / dayMs);
  }

  // ── 赛季结算 ──────────────────────────────

  /**
   * 执行赛季结算
   *
   * 1. 按最高段位发放奖励
   * 2. 积分重置到当前段位最低值
   */
  settleSeason(
    playerState: ArenaPlayerState,
    highestRankId: string,
  ): {
    state: ArenaPlayerState;
    reward: SeasonReward;
    resetScore: number;
  } {
    // 获取最高段位的赛季奖励
    const reward = this.getSeasonReward(highestRankId);

    // 积分重置到当前段位最低值
    // NOTE: scoreResetRatio 为预留参数，当前重置策略为直接重置到段位最低值
    // 未来可通过 scoreResetRatio 实现部分重置：minScore + range * ratio
    const currentRank = RANK_LEVEL_MAP.get(playerState.rankId);
    const resetScore = currentRank?.minScore ?? 0;

    const newState: ArenaPlayerState = {
      ...playerState,
      score: resetScore,
      arenaCoins: playerState.arenaCoins + reward.arenaCoin,
      // 重置每日数据
      dailyChallengesLeft: 5,
      dailyBoughtChallenges: 0,
      dailyManualRefreshes: 0,
      opponents: [],
      // 清理过期回放和日志
      replays: [],
      defenseLogs: [],
    };

    return { state: newState, reward, resetScore };
  }

  /**
   * 获取赛季奖励
   */
  getSeasonReward(rankId: string): SeasonReward {
    return SEASON_REWARD_MAP.get(rankId) ?? SEASON_REWARDS[0];
  }

  /**
   * 更新最高段位
   */
  updateHighestRank(
    currentHighest: string,
    newRankId: string,
  ): string {
    const highIdx = RANK_LEVELS.findIndex((r) => r.id === currentHighest);
    const newIdx = RANK_LEVELS.findIndex((r) => r.id === newRankId);
    return newIdx > highIdx ? newRankId : currentHighest;
  }

  // ── 每日奖励 ──────────────────────────────

  /**
   * 发放每日段位奖励
   */
  grantDailyReward(
    playerState: ArenaPlayerState,
  ): { state: ArenaPlayerState; reward: { copper: number; arenaCoin: number; gold: number } } {
    const rank = RANK_LEVEL_MAP.get(playerState.rankId);
    const reward = rank?.dailyReward ?? { copper: 500, arenaCoin: 10, gold: 5 };

    return {
      state: {
        ...playerState,
        arenaCoins: playerState.arenaCoins + reward.arenaCoin,
      },
      reward,
    };
  }

  // ── 竞技商店 ──────────────────────────────

  /**
   * 购买竞技商店物品
   */
  buyArenaShopItem(
    playerState: ArenaPlayerState,
    cost: number,
  ): ArenaPlayerState {
    if (playerState.arenaCoins < cost) {
      throw new Error('竞技币不足');
    }
    return {
      ...playerState,
      arenaCoins: playerState.arenaCoins - cost,
    };
  }

  // ── 工具方法 ──────────────────────────────

  /**
   * 获取赛季配置
   */
  getConfig(): SeasonConfig {
    return { ...this.config };
  }

  /**
   * 获取赛季天数
   */
  getSeasonDays(): number {
    return this.config.seasonDays;
  }

  /**
   * 获取所有赛季奖励
   */
  getAllSeasonRewards(): SeasonReward[] {
    return [...SEASON_REWARDS];
  }

  // ── 存档序列化 ──────────────────────────

  /**
   * 序列化赛季数据
   */
  serializeSeason(season: SeasonData, highestRankId: string): {
    season: SeasonData;
    highestRankId: string;
  } {
    return {
      season: { ...season },
      highestRankId,
    };
  }

  /**
   * 反序列化赛季数据
   */
  deserializeSeason(data: {
    season: SeasonData;
    highestRankId: string;
  }): { season: SeasonData; highestRankId: string } {
    return {
      season: data.season ?? {
        seasonId: '',
        startTime: 0,
        endTime: 0,
        currentDay: 1,
        isSettled: false,
      },
      highestRankId: data.highestRankId ?? 'BRONZE_V',
    };
  }
}
