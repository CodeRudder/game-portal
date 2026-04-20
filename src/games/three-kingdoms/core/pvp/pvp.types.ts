/**
 * PvP竞技场 — 核心类型定义
 *
 * 规则：只有 interface/type/enum/const，零运行时逻辑
 * 覆盖：竞技场匹配、段位、赛季、防守阵容、战斗回放
 *
 * @module core/pvp/pvp.types
 */

import type { Faction } from '../../engine/hero/hero.types';
import type { BattleAction, BattleResult, BattleState } from '../../engine/battle/battle.types';

// ─────────────────────────────────────────────
// 1. 段位等级（21级）
// ─────────────────────────────────────────────

/** 大段位 */
export enum RankTier {
  /** 青铜 */
  BRONZE = 'BRONZE',
  /** 白银 */
  SILVER = 'SILVER',
  /** 黄金 */
  GOLD = 'GOLD',
  /** 铂金 */
  PLATINUM = 'PLATINUM',
  /** 钻石 */
  DIAMOND = 'DIAMOND',
  /** 大师 */
  MASTER = 'MASTER',
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
  formation: FormationType;
  /** AI策略 */
  aiStrategy: AIDefenseStrategy;
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

// ─────────────────────────────────────────────
// 3. 挑战与刷新
// ─────────────────────────────────────────────

/** 刷新配置 */
export interface RefreshConfig {
  /** 免费刷新间隔（毫秒） */
  freeIntervalMs: number; // 30 * 60 * 1000
  /** 手动刷新消耗铜钱 */
  manualCostCopper: number; // 500
  /** 每日手动刷新上限 */
  dailyManualLimit: number; // 10
}

/** 挑战配置 */
export interface ChallengeConfig {
  /** 每日免费挑战次数 */
  dailyFreeChallenges: number; // 5
  /** 购买挑战次数单价（元宝） */
  buyCostGold: number; // 50
  /** 每日购买上限 */
  dailyBuyLimit: number; // 5
}

// ─────────────────────────────────────────────
// 4. PvP战斗
// ─────────────────────────────────────────────

/** PvP战斗模式 */
export enum PvPBattleMode {
  /** 全自动 — AI控制所有行动 */
  AUTO = 'AUTO',
  /** 半自动 — 大招手动释放 */
  SEMI_AUTO = 'SEMI_AUTO',
}

/** PvP战斗配置 */
export interface PvPBattleConfig {
  /** 最大回合数 */
  maxTurns: number; // 10
  /** 防守方全属性加成比例 */
  defenseBonusRatio: number; // 0.05 (5%)
  /** 超时判定结果 */
  timeoutWinner: 'defender'; // 始终防守方胜
}

/** 积分变化规则 */
export interface ScoreConfig {
  /** 进攻胜利最小积分 */
  winMinScore: number; // 30
  /** 进攻胜利最大积分 */
  winMaxScore: number; // 60
  /** 进攻失败最小扣分 */
  loseMinScore: number; // 15
  /** 进攻失败最大扣分 */
  loseMaxScore: number; // 30
}

/** PvP战斗结果 */
export interface PvPBattleResult {
  /** 战斗ID */
  battleId: string;
  /** 进攻方玩家ID */
  attackerId: string;
  /** 防守方玩家ID */
  defenderId: string;
  /** 进攻方是否胜利 */
  attackerWon: boolean;
  /** 积分变化 */
  scoreChange: number;
  /** 进攻方新积分 */
  attackerNewScore: number;
  /** 防守方新积分 */
  defenderNewScore: number;
  /** 战斗回合数 */
  totalTurns: number;
  /** 是否超时 */
  isTimeout: boolean;
  /** 战斗状态快照 */
  battleState: BattleState | null;
}

// ─────────────────────────────────────────────
// 5. 防守阵容
// ─────────────────────────────────────────────

/** 阵型类型 */
export enum FormationType {
  /** 鱼鳞阵 — 均衡型 */
  FISH_SCALE = 'FISH_SCALE',
  /** 锋矢阵 — 突破型 */
  WEDGE = 'WEDGE',
  /** 雁行阵 — 防御型 */
  GOOSE = 'GOOSE',
  /** 长蛇阵 — 迂回型 */
  SNAKE = 'SNAKE',
  /** 方圆阵 — 包围型 */
  SQUARE = 'SQUARE',
}

/** AI防守策略 */
export enum AIDefenseStrategy {
  /** 均衡 — 攻防兼顾 */
  BALANCED = 'BALANCED',
  /** 猛攻 — 优先攻击 */
  AGGRESSIVE = 'AGGRESSIVE',
  /** 坚守 — 优先防御 */
  DEFENSIVE = 'DEFENSIVE',
  /** 智谋 — 优先控制 */
  CUNNING = 'CUNNING',
}

/** 防守阵容数据 */
export interface DefenseFormation {
  /** 5个阵位的武将ID（空字符串表示空位） */
  slots: [string, string, string, string, string];
  /** 选择的阵型 */
  formation: FormationType;
  /** AI策略 */
  strategy: AIDefenseStrategy;
}

/** 防守日志条目 */
export interface DefenseLogEntry {
  /** 日志ID */
  id: string;
  /** 进攻方玩家ID */
  attackerId: string;
  /** 进攻方名称 */
  attackerName: string;
  /** 防守方是否胜利 */
  defenderWon: boolean;
  /** 战斗时间（时间戳） */
  timestamp: number;
  /** 战斗回合数 */
  turns: number;
  /** 进攻方段位 */
  attackerRank: string;
}

/** 防守日志统计 */
export interface DefenseLogStats {
  /** 总防守次数 */
  totalDefenses: number;
  /** 防守胜利次数 */
  wins: number;
  /** 防守失败次数 */
  losses: number;
  /** 胜率 */
  winRate: number;
  /** 建议策略 */
  suggestedStrategy: AIDefenseStrategy | null;
}

// ─────────────────────────────────────────────
// 6. 赛季
// ─────────────────────────────────────────────

/** 赛季配置 */
export interface SeasonConfig {
  /** 赛季天数 */
  seasonDays: number; // 28
  /** 赛季结束积分重置比例 */
  scoreResetRatio: number; // e.g. 0.5 → 重置到当前段位最低值的50%
}

/** 赛季数据 */
export interface SeasonData {
  /** 赛季ID */
  seasonId: string;
  /** 赛季开始时间（时间戳） */
  startTime: number;
  /** 赛季结束时间（时间戳） */
  endTime: number;
  /** 当前天数（1~28） */
  currentDay: number;
  /** 是否已结算 */
  isSettled: boolean;
}

/** 赛季结算奖励 */
export interface SeasonReward {
  /** 段位ID */
  rankId: string;
  /** 铜钱奖励 */
  copper: number;
  /** 竞技币奖励 */
  arenaCoin: number;
  /** 元宝奖励 */
  gold: number;
  /** 称号（可选） */
  title: string | null;
}

// ─────────────────────────────────────────────
// 7. 战斗回放
// ─────────────────────────────────────────────

/** 战斗回放记录 */
export interface BattleReplay {
  /** 回放ID */
  id: string;
  /** 战斗ID */
  battleId: string;
  /** 进攻方名称 */
  attackerName: string;
  /** 防守方名称 */
  defenderName: string;
  /** 进攻方是否胜利 */
  attackerWon: boolean;
  /** 战斗时间（时间戳） */
  timestamp: number;
  /** 回合数 */
  totalTurns: number;
  /** 战斗行动记录 */
  actions: BattleAction[];
  /** 战斗结果 */
  result: BattleResult;
  /** 关键时刻列表（回合号） */
  keyMoments: number[];
}

/** 回放配置 */
export interface ReplayConfig {
  /** 最大保存条数 */
  maxReplays: number; // 50
  /** 保留天数 */
  retentionDays: number; // 7
}

// ─────────────────────────────────────────────
// 8. 竞技商店
// ─────────────────────────────────────────────

/** 竞技商店物品 */
export interface ArenaShopItem {
  /** 物品ID */
  itemId: string;
  /** 物品名称 */
  itemName: string;
  /** 物品类型 */
  itemType: 'hero_fragment' | 'enhance_stone' | 'equipment_box' | 'avatar_frame';
  /** 竞技币价格 */
  arenaCoinCost: number;
  /** 每周限购数量（0 = 不限） */
  weeklyLimit: number;
  /** 已购数量 */
  purchased: number;
}

// ─────────────────────────────────────────────
// 9. 竞技场玩家状态
// ─────────────────────────────────────────────

/** 竞技场玩家状态 */
export interface ArenaPlayerState {
  /** 当前积分 */
  score: number;
  /** 当前段位ID */
  rankId: string;
  /** 排名（0 = 未入榜） */
  ranking: number;
  /** 今日剩余免费挑战次数 */
  dailyChallengesLeft: number;
  /** 今日已购买挑战次数 */
  dailyBoughtChallenges: number;
  /** 今日已手动刷新次数 */
  dailyManualRefreshes: number;
  /** 上次免费刷新时间（时间戳） */
  lastFreeRefreshTime: number;
  /** 当前候选对手列表 */
  opponents: ArenaOpponent[];
  /** 防守阵容 */
  defenseFormation: DefenseFormation;
  /** 防守日志 */
  defenseLogs: DefenseLogEntry[];
  /** 战斗回放列表 */
  replays: BattleReplay[];
  /** 竞技币余额 */
  arenaCoins: number;
}

// ─────────────────────────────────────────────
// 10. 竞技场存档
// ─────────────────────────────────────────────

/** 竞技场存档数据 */
export interface ArenaSaveData {
  /** 存档版本 */
  version: number;
  /** 玩家状态 */
  state: ArenaPlayerState;
  /** 赛季数据 */
  season: SeasonData;
  /** 最高段位ID（赛季内） */
  highestRankId: string;
}
