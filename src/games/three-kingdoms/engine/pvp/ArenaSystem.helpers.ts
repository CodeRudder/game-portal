/**
 * 竞技场系统 — 常量、工厂函数与纯辅助函数
 *
 * 从 ArenaSystem 拆分出的无状态逻辑，便于独立测试和复用。
 *
 * @module engine/pvp/ArenaSystem.helpers
 */

import type {
  ArenaOpponent,
  ArenaPlayerState,
  MatchConfig,
  RefreshConfig,
  ChallengeConfig,
} from '../../core/pvp/pvp.types';
import { FormationType, AIDefenseStrategy } from '../../core/pvp/pvp.types';
import type { DefenseFormation } from '../../core/pvp/pvp.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认匹配配置 */
export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  powerMinRatio: 0.7,
  powerMaxRatio: 1.3,
  rankMinOffset: 5,
  rankMaxOffset: 20,
  candidateCount: 3,
};

/** 默认刷新配置 */
export const DEFAULT_REFRESH_CONFIG: RefreshConfig = {
  freeIntervalMs: 30 * 60 * 1000, // 30分钟
  manualCostCopper: 500,
  dailyManualLimit: 10,
};

/** 默认挑战配置 */
export const DEFAULT_CHALLENGE_CONFIG: ChallengeConfig = {
  dailyFreeChallenges: 5,
  buyCostGold: 50,
  dailyBuyLimit: 5,
};

/** 竞技场存档版本 */
export const ARENA_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 工厂函数
// ─────────────────────────────────────────────

/** 创建默认防守阵容 */
export function createDefaultDefenseFormation(): DefenseFormation {
  return {
    slots: ['', '', '', '', ''],
    formation: FormationType.FISH_SCALE,
    strategy: AIDefenseStrategy.BALANCED,
  };
}

/** 创建默认竞技场玩家状态 */
export function createDefaultArenaPlayerState(playerId: string = ''): ArenaPlayerState {
  return {
    playerId,
    score: 0,
    rankId: 'BRONZE_V',
    ranking: 0,
    dailyChallengesLeft: DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges,
    dailyBoughtChallenges: 0,
    dailyManualRefreshes: 0,
    lastFreeRefreshTime: 0,
    opponents: [],
    defenseFormation: createDefaultDefenseFormation(),
    defenseLogs: [],
    replays: [],
    arenaCoins: 0,
  };
}

// ─────────────────────────────────────────────
// 纯辅助函数
// ─────────────────────────────────────────────

/**
 * 按阵营平衡选择对手
 *
 * 尽量从不同阵营中各选一个对手，保证多样性。
 */
export function selectByFactionBalance(
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

/**
 * 计算玩家战力（简化版，基于积分和阵容）
 *
 * 公式：基础5000 + 积分 × 10 + 阵容武将数 × 1000
 * 注：返回值保证 ≥ 0，防止异常积分导致负战力影响匹配
 */
/** 竞技币上限 */
export const MAX_ARENA_COINS = 999999;

/**
 * 安全增加竞技币
 *
 * 防护 NaN/负数/Infinity，确保结果在 [0, MAX_ARENA_COINS] 范围内。
 */
export function addArenaCoins(current: number, amount: number): number {
  if (!Number.isFinite(current)) return 0;
  if (!Number.isFinite(amount) || amount <= 0) return current;
  return Math.min(MAX_ARENA_COINS, Math.max(0, current + amount));
}

/**
 * 计算玩家战力（简化版，基于积分和阵容）
 *
 * 公式：基础5000 + 积分 × 10 + 阵容武将数 × 1000
 * 注：返回值保证 ≥ 0 且为有限数，防止 NaN/Infinity 影响匹配
 */
export function calculatePower(playerState: ArenaPlayerState): number {
  const score = Number.isFinite(playerState.score) ? playerState.score : 0;
  const heroCount = playerState.defenseFormation.slots.filter((s) => s !== '').length;
  return Math.max(0, score * 10 + heroCount * 1000 + 5000);
}
