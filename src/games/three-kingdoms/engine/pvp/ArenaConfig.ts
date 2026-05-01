/**
 * 竞技场配置 — 常量与默认工厂（统一入口）
 *
 * 所有配置和工厂函数统一从 ArenaSystem.helpers 重导出，
 * 消除重复定义风险。
 *
 * @module engine/pvp/ArenaConfig
 */

// ── 统一重导出，消除与 ArenaSystem.helpers 的重复定义 ──
export {
  DEFAULT_MATCH_CONFIG,
  DEFAULT_REFRESH_CONFIG,
  DEFAULT_CHALLENGE_CONFIG,
  ARENA_SAVE_VERSION,
  createDefaultDefenseFormation,
  createDefaultArenaPlayerState,
  MAX_ARENA_COINS,
  addArenaCoins,
} from './ArenaSystem.helpers';
