/**
 * 竞技场系统 — 引擎层
 *
 * 职责：竞技场匹配、对手选择、刷新机制、挑战次数管理
 * 规则：
 *   - 战力范围：自身 × 0.7 ~ × 1.3
 *   - 排名范围：自身 ±5 ~ ±20
 *   - 免费刷新：30分钟间隔
 *   - 手动刷新：500铜钱/次，每日10次上限
 *   - 挑战次数：每日5次免费 + 5次购买（50元宝/次）
 *
 * @module engine/pvp/ArenaSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  ArenaOpponent,
  ArenaPlayerState,
  DefenseSnapshot,
  MatchConfig,
  RefreshConfig,
  ChallengeConfig,
} from '../../core/pvp/pvp.types';
import { FormationType, AIDefenseStrategy } from '../../core/pvp/pvp.types';
import {
  DEFAULT_MATCH_CONFIG,
  DEFAULT_REFRESH_CONFIG,
  DEFAULT_CHALLENGE_CONFIG,
  ARENA_SAVE_VERSION,
  createDefaultDefenseFormation,
  createDefaultArenaPlayerState,
} from './ArenaConfig';

// ─────────────────────────────────────────────
// ArenaSystem 类
// ─────────────────────────────────────────────

/**
 * 竞技场系统
 *
 * 管理匹配、对手选择、刷新、挑战次数
 */
export class ArenaSystem implements ISubsystem {
  readonly name = 'ArenaSystem';
  private deps!: ISystemDeps;
  private matchConfig: MatchConfig;
  private refreshConfig: RefreshConfig;
  private challengeConfig: ChallengeConfig;

  /** 模拟的玩家池（playerId → ArenaOpponent） */
  private playerPool: Map<string, ArenaOpponent> = new Map();

  /** 当前玩家竞技场状态（v7.0 存档集成） */
  private playerState: ArenaPlayerState = createDefaultArenaPlayerState();

  constructor(
    matchConfig?: Partial<MatchConfig>,
    refreshConfig?: Partial<RefreshConfig>,
    challengeConfig?: Partial<ChallengeConfig>,
  ) {
    this.matchConfig = { ...DEFAULT_MATCH_CONFIG, ...matchConfig };
    this.refreshConfig = { ...DEFAULT_REFRESH_CONFIG, ...refreshConfig };
    this.challengeConfig = { ...DEFAULT_CHALLENGE_CONFIG, ...challengeConfig };
  }

  // ── ISubsystem 接口 ─────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.playerPool.clear();
  }

  update(_dt: number): void {
    /* 预留：可在此处理匹配池自动刷新等定时逻辑 */
  }

  getState(): Record<string, unknown> {
    return {
      playerPoolSize: this.playerPool.size,
      matchConfig: this.matchConfig,
      refreshConfig: this.refreshConfig,
      challengeConfig: this.challengeConfig,
      playerState: this.playerState,
    };
  }

  reset(): void {
    this.playerPool.clear();
    this.playerState = createDefaultArenaPlayerState();
  }

  // ── 匹配与对手选择 ──────────────────────────

  /**
   * 生成候选对手列表
   *
   * 规则：
   * 1. 战力范围：自身 × 0.7 ~ × 1.3
   * 2. 排名范围：自身 ±5 ~ ±20
   * 3. 尽量覆盖不同阵营
   * 4. 返回指定数量的候选对手
   */
  generateOpponents(
    playerState: ArenaPlayerState,
    allPlayers: ArenaOpponent[],
  ): ArenaOpponent[] {
    const { powerMinRatio, powerMaxRatio, rankMinOffset, rankMaxOffset, candidateCount } =
      this.matchConfig;

    const myPower = this.calculatePower(playerState);
    const myRanking = playerState.ranking || 9999;

    // 战力范围筛选
    const minPower = Math.floor(myPower * powerMinRatio);
    const maxPower = Math.ceil(myPower * powerMaxRatio);

    // 排名范围筛选
    const minRank = Math.max(1, myRanking - rankMaxOffset);
    const maxRank = myRanking + rankMaxOffset;

    // 筛选合格对手
    const eligible = allPlayers.filter((p) => {
      const inPowerRange = p.power >= minPower && p.power <= maxPower;
      const inRankRange = p.ranking >= minRank && p.ranking <= maxRank;
      return inPowerRange && inRankRange;
    });

    // 按阵营分布尽量均匀选取
    const selected = this.selectByFactionBalance(eligible, candidateCount);

    // 如果不够，从合格对手中补充（仅使用同时满足战力和排名范围的对手）
    if (selected.length < candidateCount) {
      const remaining = eligible.filter((p) => !selected.includes(p));
      while (selected.length < candidateCount && remaining.length > 0) {
        const idx = Math.floor(Math.random() * remaining.length);
        selected.push(remaining.splice(idx, 1)[0]);
      }
    }

    return selected.slice(0, candidateCount);
  }

  /**
   * 按阵营平衡选择对手
   *
   * 尽量从不同阵营中各选一个对手
   */
  private selectByFactionBalance(
    candidates: ArenaOpponent[],
    count: number,
  ): ArenaOpponent[] {
    if (candidates.length <= count) return [...candidates];

    const result: ArenaOpponent[] = [];
    const factions = new Map<string, ArenaOpponent[]>();

    // 按阵营分组
    for (const c of candidates) {
      const list = factions.get(c.faction) || [];
      list.push(c);
      factions.set(c.faction, list);
    }

    // 轮流从各阵营选取
    const factionKeys = Array.from(factions.keys());
    let round = 0;
    while (result.length < count) {
      let added = false;
      for (const key of factionKeys) {
        if (result.length >= count) break;
        const list = factions.get(key)!;
        if (list.length > round) {
          result.push(list[round]);
          added = true;
        }
      }
      if (!added) break; // 所有阵营都选完了
      round++;
    }

    return result;
  }

  // ── 刷新机制 ──────────────────────────────

  /**
   * 检查是否可以免费刷新
   */
  canFreeRefresh(playerState: ArenaPlayerState, now: number): boolean {
    const elapsed = now - playerState.lastFreeRefreshTime;
    return elapsed >= this.refreshConfig.freeIntervalMs;
  }

  /**
   * 免费刷新对手列表
   */
  freeRefresh(
    playerState: ArenaPlayerState,
    allPlayers: ArenaOpponent[],
    now: number,
  ): ArenaPlayerState {
    if (!this.canFreeRefresh(playerState, now)) {
      throw new Error('免费刷新冷却中');
    }

    const opponents = this.generateOpponents(playerState, allPlayers);
    return {
      ...playerState,
      opponents,
      lastFreeRefreshTime: now,
    };
  }

  /**
   * 手动刷新对手列表（消耗铜钱）
   */
  manualRefresh(
    playerState: ArenaPlayerState,
    allPlayers: ArenaOpponent[],
    now: number,
  ): { state: ArenaPlayerState; cost: number } {
    if (playerState.dailyManualRefreshes >= this.refreshConfig.dailyManualLimit) {
      throw new Error('今日手动刷新次数已达上限');
    }

    const cost = this.refreshConfig.manualCostCopper;
    const opponents = this.generateOpponents(playerState, allPlayers);
    const state: ArenaPlayerState = {
      ...playerState,
      opponents,
      dailyManualRefreshes: playerState.dailyManualRefreshes + 1,
    };

    return { state, cost };
  }

  // ── 挑战次数 ──────────────────────────────

  /**
   * 检查是否可以挑战
   */
  canChallenge(playerState: ArenaPlayerState): boolean {
    const totalChallenges =
      playerState.dailyChallengesLeft +
      (this.challengeConfig.dailyBuyLimit - playerState.dailyBoughtChallenges);
    // 实际上 dailyChallengesLeft 已经包含了免费+购买的
    return playerState.dailyChallengesLeft > 0;
  }

  /**
   * 消耗一次挑战次数
   */
  consumeChallenge(playerState: ArenaPlayerState): ArenaPlayerState {
    if (playerState.dailyChallengesLeft <= 0) {
      throw new Error('今日挑战次数已用完');
    }
    return {
      ...playerState,
      dailyChallengesLeft: playerState.dailyChallengesLeft - 1,
    };
  }

  /**
   * 购买额外挑战次数
   */
  buyChallenge(playerState: ArenaPlayerState): { state: ArenaPlayerState; cost: number } {
    if (playerState.dailyBoughtChallenges >= this.challengeConfig.dailyBuyLimit) {
      throw new Error('今日购买次数已达上限');
    }

    return {
      state: {
        ...playerState,
        dailyChallengesLeft: playerState.dailyChallengesLeft + 1,
        dailyBoughtChallenges: playerState.dailyBoughtChallenges + 1,
      },
      cost: this.challengeConfig.buyCostGold,
    };
  }

  // ── 每日重置 ──────────────────────────────

  /**
   * 重置每日数据（0:00重置）
   */
  dailyReset(playerState: ArenaPlayerState): ArenaPlayerState {
    return {
      ...playerState,
      dailyChallengesLeft: this.challengeConfig.dailyFreeChallenges,
      dailyBoughtChallenges: 0,
      dailyManualRefreshes: 0,
      opponents: [],
    };
  }

  // ── 防守阵容管理 ──────────────────────────

  /**
   * 更新防守阵容
   */
  updateDefenseFormation(
    playerState: ArenaPlayerState,
    slots: [string, string, string, string, string],
    formation: FormationType,
    strategy: AIDefenseStrategy,
  ): ArenaPlayerState {
    // 验证：至少1个武将
    const heroCount = slots.filter((s) => s !== '').length;
    if (heroCount === 0) {
      throw new Error('防守阵容至少需要1名武将');
    }

    return {
      ...playerState,
      defenseFormation: { slots, formation, strategy },
    };
  }

  // ── 防守日志 ──────────────────────────────

  /**
   * 添加防守日志
   */
  addDefenseLog(
    playerState: ArenaPlayerState,
    log: { attackerId: string; attackerName: string; defenderWon: boolean; turns: number; attackerRank: string },
    now: number,
  ): ArenaPlayerState {
    const entry = {
      id: `def_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...log,
      timestamp: now,
    };
    const logs = [entry, ...playerState.defenseLogs].slice(0, 50);
    return { ...playerState, defenseLogs: logs };
  }

  /**
   * 获取防守统计
   */
  getDefenseStats(playerState: ArenaPlayerState): {
    totalDefenses: number;
    wins: number;
    losses: number;
    winRate: number;
    suggestedStrategy: AIDefenseStrategy | null;
  } {
    const logs = playerState.defenseLogs;
    const wins = logs.filter((l) => l.defenderWon).length;
    const losses = logs.filter((l) => !l.defenderWon).length;
    const totalDefenses = wins + losses;
    const winRate = totalDefenses > 0 ? wins / totalDefenses : 0;

    // 智能建议：胜率低时建议策略
    let suggestedStrategy: AIDefenseStrategy | null = null;
    if (totalDefenses >= 5 && winRate < 0.3) {
      suggestedStrategy = AIDefenseStrategy.DEFENSIVE;
    } else if (totalDefenses >= 5 && winRate < 0.5) {
      suggestedStrategy = AIDefenseStrategy.BALANCED;
    }

    return { totalDefenses, wins, losses, winRate, suggestedStrategy };
  }

  // ── 玩家池管理（用于匹配） ───────────────

  /**
   * 注册玩家到匹配池
   */
  registerPlayer(opponent: ArenaOpponent): void {
    this.playerPool.set(opponent.playerId, opponent);
  }

  /**
   * 获取所有注册玩家
   */
  getAllPlayers(): ArenaOpponent[] {
    return Array.from(this.playerPool.values());
  }

  // ── 工具方法 ──────────────────────────────

  /**
   * 计算玩家战力（简化版，基于积分和阵容）
   */
  private calculatePower(playerState: ArenaPlayerState): number {
    // 基础战力 = 积分 × 10 + 阵容武将数 × 1000
    const heroCount = playerState.defenseFormation.slots.filter((s) => s !== '').length;
    return playerState.score * 10 + heroCount * 1000 + 5000; // 基础5000战力
  }

  /**
   * 获取匹配配置（用于测试）
   */
  getMatchConfig(): MatchConfig {
    return { ...this.matchConfig };
  }

  /**
   * 获取刷新配置（用于测试）
   */
  getRefreshConfig(): RefreshConfig {
    return { ...this.refreshConfig };
  }

  /**
   * 获取挑战配置（用于测试）
   */
  getChallengeConfig(): ChallengeConfig {
    return { ...this.challengeConfig };
  }

  // ── 存档序列化 ──────────────────────────

  /**
   * 序列化玩家竞技场状态
   */
  serialize(playerState?: ArenaPlayerState): import('../../core/pvp/pvp.types').ArenaSaveData {
    const state = playerState ?? this.playerState;
    return {
      version: ARENA_SAVE_VERSION,
      state: { ...state },
      season: {
        seasonId: '',
        startTime: 0,
        endTime: 0,
        currentDay: 1,
        isSettled: false,
      },
      highestRankId: state.rankId,
    };
  }

  /**
   * 反序列化恢复玩家竞技场状态
   */
  deserialize(data: import('../../core/pvp/pvp.types').ArenaSaveData): ArenaPlayerState {
    if (!data || data.version !== ARENA_SAVE_VERSION) {
      this.playerState = createDefaultArenaPlayerState();
      return this.playerState;
    }
    this.playerState = { ...data.state };
    return this.playerState;
  }
}
