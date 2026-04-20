/**
 * 商店域 — 配置常量
 *
 * 规则：只有常量定义，零逻辑
 */

import type { RestockConfig } from './shop.types';

// ─────────────────────────────────────────────
// 补货配置
// ─────────────────────────────────────────────

/** 默认补货配置 */
export const DEFAULT_RESTOCK_CONFIG: RestockConfig = {
  /** 定时补货间隔 8h = 28800s */
  scheduledInterval: 28800,
  /** 离线补货间隔 8h */
  offlineInterval: 28800,
  /** 离线最大累积 2 次 */
  offlineMaxAccumulation: 2,
  /** 手动刷新消耗 500 铜钱 */
  manualRefreshCost: { copper: 500 },
  /** 随机商品 1~3 件 */
  randomGoodsRange: [1, 3],
  /** 20% 折扣概率 */
  discountChance: 0.2,
  /** 10% 离线限定稀有 */
  offlineRareChance: 0.1,
};

/** 每日手动刷新上限 */
export const DAILY_MANUAL_REFRESH_LIMIT = 5;

/** 商店存档版本 */
export const SHOP_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 确认策略阈值
// ─────────────────────────────────────────────

/** 五级确认策略阈值（按总价划分，单位：铜钱等价） */
export const CONFIRM_THRESHOLDS = {
  /** 无需确认 */
  none: 0,
  /** 低级确认（仅确认按钮） */
  low: 1000,
  /** 中级确认（二次确认） */
  medium: 5000,
  /** 高级确认（输入确认） */
  high: 20000,
  /** 关键确认（输入+倒计时） */
  critical: 100000,
} as const;

// ─────────────────────────────────────────────
// 商店等级配置
// ─────────────────────────────────────────────

/** 商店等级解锁条件 */
export const SHOP_LEVEL_CONFIG = [
  { level: 1, requiredCastleLevel: 1, description: '初级集市' },
  { level: 2, requiredCastleLevel: 3, description: '中级集市' },
  { level: 3, requiredCastleLevel: 5, description: '高级集市' },
  { level: 4, requiredCastleLevel: 8, description: '豪华集市' },
  { level: 5, requiredCastleLevel: 12, description: '皇家集市' },
] as const;

/** VIP商店解锁等级 */
export const VIP_SHOP_REQUIRED_LEVEL = 4;

/** 黑市出现条件 — 主城等级 */
export const BLACK_MARKET_REQUIRED_CASTLE_LEVEL = 6;

/** 限时商店持续时间（秒） */
export const LIMITED_SHOP_DURATION = 7200; // 2小时

// ─────────────────────────────────────────────
// 默认商品库存
// ─────────────────────────────────────────────

/** 常驻商品默认库存 */
export const PERMANENT_GOODS_STOCK = -1; // 无限

/** 随机商品默认库存 */
export const RANDOM_GOODS_STOCK = 5;

/** 折扣商品默认库存 */
export const DISCOUNT_GOODS_STOCK = 3;

/** 限时商品默认库存 */
export const LIMITED_GOODS_STOCK = 1;

// ─────────────────────────────────────────────
// 商品搜索
// ─────────────────────────────────────────────

/** 搜索结果最大数量 */
export const SEARCH_MAX_RESULTS = 50;
