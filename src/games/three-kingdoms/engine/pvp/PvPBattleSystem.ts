/**
 * PvP战斗系统 — 引擎层
 *
 * 职责：PvP战斗执行、积分计算、段位判定、战斗回放
 * 规则：
 *   - 战斗模式：全自动/半自动
 *   - 最大10回合，超时防守方胜
 *   - 防守方全属性+5%加成
 *   - 积分：进攻胜+30~60，败-15~-30
 *   - 21级段位：青铜V~王者I
 *
 * @module engine/pvp/PvPBattleSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  PvPBattleResult,
  PvPBattleConfig,
  ScoreConfig,
  ArenaPlayerState,
  BattleReplay,
  RankLevel,
  RankTier,
  SeasonData,
} from '../../core/pvp/pvp.types';
import { RankDivision, PvPBattleMode } from '../../core/pvp/pvp.types';
import { addArenaCoins } from './ArenaSystem.helpers';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认PvP战斗配置 */
export const DEFAULT_PVP_BATTLE_CONFIG: PvPBattleConfig = {
  maxTurns: 10,
  defenseBonusRatio: 0.05,
  timeoutWinner: 'defender',
};

/** 默认积分配置 */
export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  winMinScore: 30,
  winMaxScore: 60,
  loseMinScore: 15,
  loseMaxScore: 30,
};

/** 回放配置 */
export const REPLAY_CONFIG = {
  maxReplays: 50,
  retentionDays: 7,
  retentionMs: 7 * 24 * 60 * 60 * 1000,
};

// ─────────────────────────────────────────────
// 21级段位定义（5大段位：青铜/白银/黄金/钻石/王者，与PRD PVP-3对齐）
// ─────────────────────────────────────────────

/** 段位等级列表（从低到高，共21级）— 与PRD PVP-3段位积分对齐 */
export const RANK_LEVELS: RankLevel[] = [
  // 青铜 (5级: V~I) — 0~1499，每级300分
  { id: 'BRONZE_V', tier: 'BRONZE' as RankTier, division: RankDivision.V, minScore: 0, maxScore: 299, dailyReward: { copper: 500, arenaCoin: 10, gold: 5 } },
  { id: 'BRONZE_IV', tier: 'BRONZE' as RankTier, division: RankDivision.IV, minScore: 300, maxScore: 599, dailyReward: { copper: 550, arenaCoin: 12, gold: 0 } },
  { id: 'BRONZE_III', tier: 'BRONZE' as RankTier, division: RankDivision.III, minScore: 600, maxScore: 899, dailyReward: { copper: 600, arenaCoin: 14, gold: 0 } },
  { id: 'BRONZE_II', tier: 'BRONZE' as RankTier, division: RankDivision.II, minScore: 900, maxScore: 1199, dailyReward: { copper: 650, arenaCoin: 16, gold: 0 } },
  { id: 'BRONZE_I', tier: 'BRONZE' as RankTier, division: RankDivision.I, minScore: 1200, maxScore: 1499, dailyReward: { copper: 700, arenaCoin: 18, gold: 0 } },
  // 白银 (5级: V~I) — 1500~2999，每级300分
  { id: 'SILVER_V', tier: 'SILVER' as RankTier, division: RankDivision.V, minScore: 1500, maxScore: 1799, dailyReward: { copper: 800, arenaCoin: 20, gold: 0 } },
  { id: 'SILVER_IV', tier: 'SILVER' as RankTier, division: RankDivision.IV, minScore: 1800, maxScore: 2099, dailyReward: { copper: 900, arenaCoin: 25, gold: 0 } },
  { id: 'SILVER_III', tier: 'SILVER' as RankTier, division: RankDivision.III, minScore: 2100, maxScore: 2399, dailyReward: { copper: 1000, arenaCoin: 30, gold: 0 } },
  { id: 'SILVER_II', tier: 'SILVER' as RankTier, division: RankDivision.II, minScore: 2400, maxScore: 2699, dailyReward: { copper: 1100, arenaCoin: 35, gold: 0 } },
  { id: 'SILVER_I', tier: 'SILVER' as RankTier, division: RankDivision.I, minScore: 2700, maxScore: 2999, dailyReward: { copper: 1200, arenaCoin: 40, gold: 0 } },
  // 黄金 (5级: V~I) — 3000~4999，每级400分
  { id: 'GOLD_V', tier: 'GOLD' as RankTier, division: RankDivision.V, minScore: 3000, maxScore: 3399, dailyReward: { copper: 1500, arenaCoin: 50, gold: 0 } },
  { id: 'GOLD_IV', tier: 'GOLD' as RankTier, division: RankDivision.IV, minScore: 3400, maxScore: 3799, dailyReward: { copper: 1700, arenaCoin: 55, gold: 0 } },
  { id: 'GOLD_III', tier: 'GOLD' as RankTier, division: RankDivision.III, minScore: 3800, maxScore: 4199, dailyReward: { copper: 1900, arenaCoin: 60, gold: 0 } },
  { id: 'GOLD_II', tier: 'GOLD' as RankTier, division: RankDivision.II, minScore: 4200, maxScore: 4599, dailyReward: { copper: 2100, arenaCoin: 65, gold: 0 } },
  { id: 'GOLD_I', tier: 'GOLD' as RankTier, division: RankDivision.I, minScore: 4600, maxScore: 4999, dailyReward: { copper: 2300, arenaCoin: 70, gold: 5 } },
  // 钻石 (5级: V~I) — 5000~9999，每级1000分
  { id: 'DIAMOND_V', tier: 'DIAMOND' as RankTier, division: RankDivision.V, minScore: 5000, maxScore: 5999, dailyReward: { copper: 3000, arenaCoin: 100, gold: 10 } },
  { id: 'DIAMOND_IV', tier: 'DIAMOND' as RankTier, division: RankDivision.IV, minScore: 6000, maxScore: 6999, dailyReward: { copper: 3500, arenaCoin: 130, gold: 12 } },
  { id: 'DIAMOND_III', tier: 'DIAMOND' as RankTier, division: RankDivision.III, minScore: 7000, maxScore: 7999, dailyReward: { copper: 4000, arenaCoin: 160, gold: 14 } },
  { id: 'DIAMOND_II', tier: 'DIAMOND' as RankTier, division: RankDivision.II, minScore: 8000, maxScore: 8999, dailyReward: { copper: 4500, arenaCoin: 190, gold: 16 } },
  { id: 'DIAMOND_I', tier: 'DIAMOND' as RankTier, division: RankDivision.I, minScore: 9000, maxScore: 9999, dailyReward: { copper: 5000, arenaCoin: 220, gold: 20 } },
  // 王者 — 积分≥10000
  { id: 'KING_I', tier: 'KING' as RankTier, division: RankDivision.I, minScore: 10000, maxScore: 99999, dailyReward: { copper: 8000, arenaCoin: 300, gold: 30 } },
];

/** 段位ID → 段位定义的映射 */
export const RANK_LEVEL_MAP = new Map<string, RankLevel>(
  RANK_LEVELS.map((r) => [r.id, r]),
);

// ─────────────────────────────────────────────
// PvPBattleSystem 类
// ─────────────────────────────────────────────

/**
 * PvP战斗系统
 *
 * 管理PvP战斗执行、积分变化、段位判定
 */
export class PvPBattleSystem implements ISubsystem {
  readonly name = 'PvPBattleSystem';
  private deps!: ISystemDeps;
  private battleConfig: PvPBattleConfig;
  private scoreConfig: ScoreConfig;

  constructor(
    battleConfig?: Partial<PvPBattleConfig>,
    scoreConfig?: Partial<ScoreConfig>,
  ) {
    this.battleConfig = { ...DEFAULT_PVP_BATTLE_CONFIG, ...battleConfig };
    this.scoreConfig = { ...DEFAULT_SCORE_CONFIG, ...scoreConfig };
  }

  // ── ISubsystem 接口 ─────────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    /* 预留：可在此处理回放自动清理等定时逻辑 */
  }

  getState(): Record<string, unknown> {
    return {
      battleConfig: this.battleConfig,
      scoreConfig: this.scoreConfig,
    };
  }

  reset(): void {
    /* 配置类系统，无运行时状态需重置 */
  }

  // ── 积分计算 ──────────────────────────────

  /**
   * 计算进攻胜利积分
   *
   * 规则：+30 ~ +60，随机取值
   */
  calculateWinScore(): number {
    const { winMinScore, winMaxScore } = this.scoreConfig;
    return winMinScore + Math.floor(Math.random() * (winMaxScore - winMinScore + 1));
  }

  /**
   * 计算进攻失败扣分
   *
   * 规则：-15 ~ -30，随机取值
   */
  calculateLoseScore(): number {
    const { loseMinScore, loseMaxScore } = this.scoreConfig;
    return -(loseMinScore + Math.floor(Math.random() * (loseMaxScore - loseMinScore + 1)));
  }

  /**
   * 应用积分变化
   */
  applyScoreChange(
    playerState: ArenaPlayerState,
    scoreChange: number,
  ): ArenaPlayerState {
    const newScore = Math.max(0, playerState.score + scoreChange);
    const newRankId = this.getRankIdForScore(newScore);

    return {
      ...playerState,
      score: newScore,
      rankId: newRankId,
    };
  }

  // ── 段位判定 ──────────────────────────────

  /**
   * 根据积分获取段位ID
   */
  getRankIdForScore(score: number): string {
    for (let i = RANK_LEVELS.length - 1; i >= 0; i--) {
      if (score >= RANK_LEVELS[i].minScore) {
        return RANK_LEVELS[i].id;
      }
    }
    return RANK_LEVELS[0].id;
  }

  /**
   * 获取段位定义
   */
  getRankLevel(rankId: string): RankLevel | undefined {
    return RANK_LEVEL_MAP.get(rankId);
  }

  /**
   * 获取当前段位的每日奖励
   */
  getDailyReward(rankId: string): { copper: number; arenaCoin: number; gold: number } {
    const rank = RANK_LEVEL_MAP.get(rankId);
    return rank?.dailyReward ?? { copper: 500, arenaCoin: 10, gold: 5 };
  }

  /**
   * 检查是否升段
   */
  isRankUp(oldRankId: string, newRankId: string): boolean {
    const oldIdx = RANK_LEVELS.findIndex((r) => r.id === oldRankId);
    const newIdx = RANK_LEVELS.findIndex((r) => r.id === newRankId);
    return newIdx > oldIdx;
  }

  /**
   * 检查是否降段
   */
  isRankDown(oldRankId: string, newRankId: string): boolean {
    const oldIdx = RANK_LEVELS.findIndex((r) => r.id === oldRankId);
    const newIdx = RANK_LEVELS.findIndex((r) => r.id === newRankId);
    return newIdx < oldIdx;
  }

  // ── PvP战斗执行（简化模拟） ──────────────

  /**
   * 执行PvP战斗
   *
   * 简化版：基于战力对比计算胜负概率
   * 实际版本应调用 BattleEngine
   */
  executeBattle(
    attackerState: ArenaPlayerState,
    defenderState: ArenaPlayerState,
    mode: PvPBattleMode = PvPBattleMode.AUTO,
    now: number = Date.now(),
  ): PvPBattleResult {
    const attackerPower = this.estimatePower(attackerState);
    const defenderPower = this.estimatePower(defenderState) * (1 + this.battleConfig.defenseBonusRatio);

    // 基于战力差距计算胜率
    const powerDiff = attackerPower - defenderPower;
    const winChance = Math.max(0.1, Math.min(0.9, 0.5 + powerDiff / (attackerPower + defenderPower) * 2));
    const attackerWon = Math.random() < winChance;

    const scoreChange = attackerWon
      ? this.calculateWinScore()
      : this.calculateLoseScore();

    const newAttackerScore = Math.max(0, attackerState.score + scoreChange);
    // 防守方积分变化：与进攻方对称（进攻方赢则防守方扣同等绝对值，进攻方输则防守方加同等绝对值）
    const defenderScoreChange = -scoreChange;
    const newDefenderScore = Math.max(0, defenderState.score + defenderScoreChange);

    return {
      battleId: `pvp_${now}_${Math.random().toString(36).slice(2, 8)}`,
      attackerId: attackerState.playerId || 'player_attacker',
      defenderId: defenderState.playerId || 'player_defender',
      attackerWon,
      scoreChange,
      attackerNewScore: newAttackerScore,
      defenderNewScore: newDefenderScore,
      totalTurns: Math.floor(Math.random() * this.battleConfig.maxTurns) + 1,
      isTimeout: false,
      battleState: null,
    };
  }

  /**
   * 应用战斗结果到玩家状态
   */
  applyBattleResult(
    attackerState: ArenaPlayerState,
    result: PvPBattleResult,
  ): ArenaPlayerState {
    const newState = this.applyScoreChange(attackerState, result.scoreChange);

    // 添加竞技币奖励（使用 addArenaCoins 防护溢出）
    const coinReward = result.attackerWon ? 20 : 5;
    return {
      ...newState,
      arenaCoins: addArenaCoins(newState.arenaCoins, coinReward),
    };
  }

  // ── 战斗回放 ──────────────────────────────

  /**
   * 保存战斗回放
   */
  saveReplay(
    playerState: ArenaPlayerState,
    replay: BattleReplay,
  ): ArenaPlayerState {
    const replays = [replay, ...playerState.replays]
      .slice(0, REPLAY_CONFIG.maxReplays);
    return { ...playerState, replays };
  }

  /**
   * 清理过期回放
   */
  cleanExpiredReplays(playerState: ArenaPlayerState, now: number): ArenaPlayerState {
    const cutoff = now - REPLAY_CONFIG.retentionMs;
    const replays = playerState.replays.filter((r) => r.timestamp >= cutoff);
    return { ...playerState, replays };
  }

  // ── 工具方法 ──────────────────────────────

  /**
   * 估算玩家战力
   */
  private estimatePower(state: ArenaPlayerState): number {
    const heroCount = state.defenseFormation.slots.filter((s) => s !== '').length;
    return state.score * 10 + heroCount * 1000 + 5000;
  }

  /**
   * 获取战斗配置
   */
  getBattleConfig(): PvPBattleConfig {
    return { ...this.battleConfig };
  }

  /**
   * 获取积分配置
   */
  getScoreConfig(): ScoreConfig {
    return { ...this.scoreConfig };
  }

  /**
   * 获取所有段位等级（21级）
   */
  getAllRankLevels(): RankLevel[] {
    return [...RANK_LEVELS];
  }

  /**
   * 获取段位总数
   */
  getRankLevelCount(): number {
    return RANK_LEVELS.length;
  }

  // ── 存档序列化 ──────────────────────────

  /**
   * 序列化回放数据
   */
  serializeReplays(playerState: ArenaPlayerState): {
    replays: BattleReplay[];
    score: number;
    rankId: string;
    arenaCoins: number;
  } {
    return {
      replays: [...playerState.replays],
      score: playerState.score,
      rankId: playerState.rankId,
      arenaCoins: playerState.arenaCoins,
    };
  }

  /**
   * 反序列化回放数据
   */
  deserializeReplays(data: {
    replays: BattleReplay[];
    score: number;
    rankId: string;
    arenaCoins: number;
  }): Partial<ArenaPlayerState> {
    return {
      replays: data.replays ?? [],
      score: data.score ?? 0,
      rankId: data.rankId ?? 'BRONZE_V',
      arenaCoins: data.arenaCoins ?? 0,
    };
  }
}
