/**
 * 竞技场配置 — 常量与默认工厂
 *
 * 从 ArenaSystem 中提取，保持主文件精简。
 *
 * @module engine/pvp/ArenaConfig
 */

import type {
  MatchConfig,
  RefreshConfig,
  ChallengeConfig,
  ArenaPlayerState,
} from '../../core/pvp/pvp.types';
import { DefenseFormation, FormationType, AIDefenseStrategy } from '../../core/pvp/pvp.types';

// ─────────────────────────────────────────────
// 默认配置
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
// 默认工厂
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
