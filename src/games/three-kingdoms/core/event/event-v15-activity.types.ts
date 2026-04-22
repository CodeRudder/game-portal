/**
 * 核心层 — v15.0 事件引擎 活动/离线类型
 *
 * 包含：
 *   - 离线事件堆积（OfflineEventPile, AutoResolveResult）
 *   - 代币兑换商店（ShopItemRarity, TokenShopItem, TokenShopConfig）
 *   - 活动排行榜（ActivityRankEntry, ActivityLeaderboardConfig, LeaderboardRewardTier）
 *   - 限时活动流程（TimedActivityPhase, TimedActivityFlow）
 *   - 节日活动（FestivalType, FestivalActivityDef）
 *   - 活动离线摘要（ActivityOfflineSummary）
 *
 * 注意：OfflineEventEntry 在 event-v15.types.ts 中定义（扩展版），此处不重复。
 *
 * @module core/event/event-v15-activity.types
 */

import type { EventConsequence } from './event.types';
import type { OfflineEventEntry } from './event-v15.types';

// ─────────────────────────────────────────────
// 1. 离线事件堆积
// ─────────────────────────────────────────────

/** 自动处理结果 */
export interface AutoResolveResult {
  /** 选中的选项ID */
  chosenOptionId: string;
  /** 自动选择原因 */
  reason: 'default' | 'highest_weight' | 'first_available' | 'time_expired';
  /** 选项后果 */
  consequences: EventConsequence;
}

/** 离线事件堆积 */
export interface OfflineEventPile {
  /** 堆积ID */
  id: string;
  /** 离线开始时间 */
  offlineStart: number;
  /** 离线结束时间 */
  offlineEnd: number;
  /** 离线回合数 */
  offlineTurns: number;
  /** 堆积的事件列表 */
  events: OfflineEventEntry[];
  /** 是否已处理 */
  processed: boolean;
}

// ─────────────────────────────────────────────
// 2. 代币兑换商店
// ─────────────────────────────────────────────

/** 商品稀有度（七阶） */
export type ShopItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'supreme';

/** 代币商店商品 */
export interface TokenShopItem {
  /** 商品ID */
  id: string;
  /** 商品名称 */
  name: string;
  /** 商品描述 */
  description: string;
  /** 稀有度 */
  rarity: ShopItemRarity;
  /** 代币价格 */
  tokenPrice: number;
  /** 限购数量（-1=不限） */
  purchaseLimit: number;
  /** 已购数量 */
  purchased: number;
  /** 奖励内容 */
  rewards: Record<string, number>;
  /** 关联活动ID（空字符串=常驻） */
  activityId: string;
  /** 是否可用 */
  available: boolean;
}

/** 代币商店配置 */
export interface TokenShopConfig {
  /** 代币名称 */
  tokenName: string;
  /** 是否每日自动刷新 */
  dailyRefresh: boolean;
  /** 最大商品数 */
  maxItems: number;
}

// ─────────────────────────────────────────────
// 3. 活动排行榜
// ─────────────────────────────────────────────

/** 活动排行榜条目 */
export interface ActivityRankEntry {
  /** 玩家ID */
  playerId: string;
  /** 玩家名称 */
  playerName: string;
  /** 积分 */
  points: number;
  /** 代币 */
  tokens: number;
  /** 排名 */
  rank: number;
}

/** 排行榜奖励档位 */
export interface LeaderboardRewardTier {
  /** 起始排名 */
  minRank: number;
  /** 结束排名 */
  maxRank: number;
  /** 奖励 */
  rewards: Record<string, number>;
}

/** 活动排行榜配置 */
export interface ActivityLeaderboardConfig {
  /** 关联活动ID */
  activityId: string;
  /** 最大显示人数 */
  maxEntries: number;
  /** 奖励档位 */
  rewardTiers: LeaderboardRewardTier[];
}

// ─────────────────────────────────────────────
// 4. 限时活动流程
// ─────────────────────────────────────────────

/** 限时活动阶段 */
export type TimedActivityPhase = 'preview' | 'active' | 'settlement' | 'closed';

/** 限时活动流程 */
export interface TimedActivityFlow {
  /** 关联活动ID */
  activityId: string;
  /** 当前阶段 */
  phase: TimedActivityPhase;
  /** 预览开始时间 */
  previewStart: number;
  /** 活跃开始时间 */
  activeStart: number;
  /** 活跃结束时间 */
  activeEnd: number;
  /** 结算开始时间 */
  settlementStart: number;
  /** 关闭时间 */
  closedTime: number;
}

// ─────────────────────────────────────────────
// 5. 节日活动
// ─────────────────────────────────────────────

/** 节日类型 */
export type FestivalType =
  | 'spring'
  | 'lantern'
  | 'dragon_boat'
  | 'mid_autumn'
  | 'double_ninth'
  | 'custom';

/** 节日任务定义 */
export interface FestivalTaskDef {
  id: string;
  name: string;
  description: string;
  targetCount: number;
  rewards: Record<string, number>;
}

/** 节日活动定义 */
export interface FestivalActivityDef {
  /** 活动ID */
  id: string;
  /** 节日类型 */
  festivalType: FestivalType;
  /** 活动名称 */
  name: string;
  /** 活动描述 */
  description: string;
  /** 主题颜色 */
  themeColor: string;
  /** 专属商品列表 */
  exclusiveItems: string[];
  /** 专属任务列表 */
  exclusiveTasks: FestivalTaskDef[];
}

// ─────────────────────────────────────────────
// 6. 活动离线摘要
// ─────────────────────────────────────────────

/** 活动离线摘要 */
export interface ActivityOfflineSummary {
  /** 离线时长（毫秒） */
  offlineDurationMs: number;
  /** 各活动离线结果 */
  activityResults: Array<{
    activityId: string;
    pointsEarned: number;
    tokensEarned: number;
    offlineDuration: number;
  }>;
  /** 总积分 */
  totalPoints: number;
  /** 总代币 */
  totalTokens: number;
  /** 离线事件堆积（null=无） */
  eventPile: OfflineEventPile | null;
}
