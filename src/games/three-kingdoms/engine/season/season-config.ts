/**
 * 引擎层 — 赛季配置
 *
 * 定义赛季常量、奖励阶梯和默认参数。
 * 赛季每30天一周期，结束后按排名发放奖励并重置积分。
 *
 * @module engine/season/season-config
 */

// ─────────────────────────────────────────────
// 赛季常量
// ─────────────────────────────────────────────

/** 默认赛季持续天数 */
export const DEFAULT_SEASON_DURATION_DAYS = 30;

/** 赛季存档版本 */
export const SEASON_SAVE_VERSION = 1;

/** 排行榜默认返回条数 */
export const DEFAULT_LEADERBOARD_LIMIT = 50;

// ─────────────────────────────────────────────
// 奖励类型
// ─────────────────────────────────────────────

/** 单项奖励 */
export interface SeasonRewardItem {
  resource: string;
  amount: number;
}

/** 奖励阶梯定义 */
export interface RewardTier {
  /** 最低排名（含） */
  minRank: number;
  /** 最高排名（含），-1 表示无上限 */
  maxRank: number;
  /** 该阶梯的奖励内容 */
  rewards: SeasonRewardItem[];
}

// ─────────────────────────────────────────────
// 奖励阶梯配置
// ─────────────────────────────────────────────

/**
 * 赛季奖励阶梯
 *
 * 排名从1开始，按从高到低匹配：
 * - 第1名：5000铜钱 + 50招贤令 + 10突破石
 * - 第2-3名：3000铜钱 + 30招贤令 + 5突破石
 * - 第4-10名：2000铜钱 + 20招贤令 + 3突破石
 * - 第11-50名：1000铜钱 + 10招贤令 + 1突破石
 * - 参与奖（51+）：500铜钱 + 5招贤令
 */
export const SEASON_REWARD_TIERS: RewardTier[] = [
  {
    minRank: 1,
    maxRank: 1,
    rewards: [
      { resource: 'copper', amount: 5000 },
      { resource: 'recruitToken', amount: 50 },
      { resource: 'breakthroughStone', amount: 10 },
    ],
  },
  {
    minRank: 2,
    maxRank: 3,
    rewards: [
      { resource: 'copper', amount: 3000 },
      { resource: 'recruitToken', amount: 30 },
      { resource: 'breakthroughStone', amount: 5 },
    ],
  },
  {
    minRank: 4,
    maxRank: 10,
    rewards: [
      { resource: 'copper', amount: 2000 },
      { resource: 'recruitToken', amount: 20 },
      { resource: 'breakthroughStone', amount: 3 },
    ],
  },
  {
    minRank: 11,
    maxRank: 50,
    rewards: [
      { resource: 'copper', amount: 1000 },
      { resource: 'recruitToken', amount: 10 },
      { resource: 'breakthroughStone', amount: 1 },
    ],
  },
  {
    minRank: 51,
    maxRank: -1, // 无上限 = 参与奖
    rewards: [
      { resource: 'copper', amount: 500 },
      { resource: 'recruitToken', amount: 5 },
    ],
  },
];

/**
 * 根据排名获取奖励
 *
 * @param rank - 排名（从1开始）
 * @returns 奖励列表
 */
export function getRewardsForRank(rank: number): SeasonRewardItem[] {
  for (const tier of SEASON_REWARD_TIERS) {
    if (tier.maxRank === -1) {
      if (rank >= tier.minRank) return [...tier.rewards];
    } else if (rank >= tier.minRank && rank <= tier.maxRank) {
      return [...tier.rewards];
    }
  }
  // fallback: 返回参与奖
  return [...SEASON_REWARD_TIERS[SEASON_REWARD_TIERS.length - 1].rewards];
}
