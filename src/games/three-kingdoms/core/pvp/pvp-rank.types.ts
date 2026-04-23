/**
 * PvP竞技场 — 段位与匹配类型定义
 *
 * 从 pvp.types.ts 中提取的段位等级和匹配相关类型。
 *
 * @module core/pvp/pvp-rank.types
 */

import type { Faction } from '../../shared/types';

// ─────────────────────────────────────────────
// 1. 段位等级（21级）
// ─────────────────────────────────────────────

/** 大段位（5大段位，与PRD PVP-3对齐：青铜/白银/黄金/钻石/王者） */
export enum RankTier {
  /** 青铜 */
  BRONZE = 'BRONZE',
  /** 白银 */
  SILVER = 'SILVER',
  /** 黄金 */
  GOLD = 'GOLD',
  /** 钻石 */
  DIAMOND = 'DIAMOND',
  /** 王者 */
  KING = 'KING',
}

/** 小段位（V ~ I） */
export enum RankDivision {
  V = 'V',
  IV = 'IV',
  III = 'III',
  II = 'II',
  I = 'I',
}

/** 段位等级定义 */
export interface RankLevel {
  /** 段位ID，如 'BRONZE_V' */
  id: string;
  /** 大段位 */
  tier: RankTier;
  /** 小段位 */
  division: RankDivision;
  /** 最低积分 */
  minScore: number;
  /** 最高积分（含） */
  maxScore: number;
  /** 每日奖励 */
  dailyReward: RankDailyReward;
}

/** 段位每日奖励 */
export interface RankDailyReward {
  /** 铜钱 */
  copper: number;
  /** 竞技币 */
  arenaCoin: number;
  /** 元宝 */
  gold: number;
}

// ─────────────────────────────────────────────
// 2. 竞技场匹配
// ─────────────────────────────────────────────

/** 候选对手信息 */
export interface ArenaOpponent {
  /** 玩家ID */
  playerId: string;
  /** 玩家名称 */
  playerName: string;
  /** 战力 */
  power: number;
  /** 当前段位ID */
  rankId: string;
  /** 当前积分 */
  score: number;
  /** 排名 */
  ranking: number;
  /** 阵营 */
  faction: Faction;
  /** 防守阵容快照 */
  defenseSnapshot: DefenseSnapshot | null;
}

/** 防守阵容快照（挑战发起时锁定） */
export interface DefenseSnapshot {
  /** 阵位武将ID列表（5个位置） */
  slots: string[];
  /** 阵型 */
  formation: import('./pvp.types').FormationType;
  /** AI策略 */
  aiStrategy: import('./pvp.types').AIDefenseStrategy;
}

/** 匹配配置 */
export interface MatchConfig {
  /** 战力最低倍率 */
  powerMinRatio: number; // 0.7
  /** 战力最高倍率 */
  powerMaxRatio: number; // 1.3
  /** 排名最小偏移 */
  rankMinOffset: number; // 5
  /** 排名最大偏移 */
  rankMaxOffset: number; // 20
  /** 候选对手数量 */
  candidateCount: number; // 3
}
