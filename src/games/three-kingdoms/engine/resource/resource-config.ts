/**
 * 资源域 — 数值配置
 *
 * 规则：零逻辑，只有常量和数据结构
 * 数值来源：RES-resources-prd.md
 */

import type {
  ResourceCap,
  Resources,
  ProductionRate,
  OfflineTier,
} from './resource.types';

// ─────────────────────────────────────────────
// 1. 孝始资源
// ─────────────────────────────────────────────

/** 新游戏初始资源量 */
export const INITIAL_RESOURCES: Readonly<Resources> = {
  grain: 500,
  gold: 300,
  troops: 50,
  mandate: 0,
};

// ─────────────────────────────────────────────
// 2. 初始产出速率
// ─────────────────────────────────────────────

/**
 * 新游戏初始产出速率（每秒）
 * 注意：此处为基础值，实际产出由 syncBuildingToResource() 从建筑等级表同步。
 * 初始状态下农田 Lv1 产出 0.8 粮草/秒，因此基础值设为 0.8。
 * 其他资源在对应建筑解锁前无产出。
 */
export const INITIAL_PRODUCTION_RATES: Readonly<ProductionRate> = {
  grain: 0.8,
  gold: 0,
  troops: 0,
  mandate: 0,
};

// ─────────────────────────────────────────────
// 3. 初始资源上限
// ─────────────────────────────────────────────

/** 新游戏初始上限（对应建筑 Lv.1） */
export const INITIAL_CAPS: Readonly<ResourceCap> = {
  grain: 2000,
  gold: null,
  troops: 500,
  mandate: null,
};

// ─────────────────────────────────────────────
// 5. 仓库容量配置表
// ─────────────────────────────────────────────

/**
 * 粮仓升级容量表
 * 来源：PRD RES-4 仓库升级容量表
 */
export const GRANARY_CAPACITY_TABLE: Readonly<
  Record<number, number>
> = {
  1: 2000,
  2: 2750,
  3: 3500,
  4: 4250,
  5: 5000,
  10: 12000,
  15: 25000,
  20: 50000,
  25: 100000,
  30: 200000,
};

/**
 * 兵营容量表
 * 来源：PRD RES-4 仓库升级容量表
 */
export const BARRACKS_CAPACITY_TABLE: Readonly<
  Record<number, number>
> = {
  1: 500,
  5: 1200,
  10: 3000,
  15: 6000,
  20: 12000,
  25: 25000,
  30: 50000,
};

// ─────────────────────────────────────────────
// 6. 容量警告阈值
// ─────────────────────────────────────────────

/**
 * 容量警告阈值配置
 * 来源：PRD RES-4 容量警告规则
 */
export const CAP_WARNING_THRESHOLDS = {
  safe: 0.7, // 0%~70% 安全
  notice: 0.9, // 70%~90% 注意
  warning: 0.95, // 90%~95% 警告
  urgent: 1.0, // 95%~100% 紧急
} as const;

// ─────────────────────────────────────────────
// 7. 离线收益配置
// ─────────────────────────────────────────────

/**
 * 离线收益衰减时段（v8.0 5档衰减）
 * 来源：PRD OFR-1 基础衰减系数表
 * 0~2h: 100% | 2~8h: 80% | 8~24h: 60% | 24~48h: 40% | 48~72h: 25%
 */
export const OFFLINE_TIERS: readonly OfflineTier[] = [
  { startSeconds: 0, endSeconds: 7200, efficiency: 1.0 }, // 0~2h: 100%
  { startSeconds: 7200, endSeconds: 28800, efficiency: 0.8 }, // 2~8h: 80%
  { startSeconds: 28800, endSeconds: 86400, efficiency: 0.6 }, // 8~24h: 60%
  { startSeconds: 86400, endSeconds: 172800, efficiency: 0.4 }, // 24~48h: 40%
  { startSeconds: 172800, endSeconds: 259200, efficiency: 0.25 }, // 48~72h: 25%
] as const;

/** 离线收益最大计算时长（72小时，秒） */
export const OFFLINE_MAX_SECONDS = 259200;

/** 离线收益弹窗触发阈值（5分钟） */
export const OFFLINE_POPUP_THRESHOLD_SECONDS = 300;

/** 离线收益封底效率（>72h 不再继续衰减） */
export const OFFLINE_FLOOR_EFFICIENCY = 0.15;

// ─────────────────────────────────────────────
// 8. 资源保护机制
// ─────────────────────────────────────────────

/** 最低粮草保留量（防止死锁） */
export const MIN_GRAIN_RESERVE = 10;

/** 铜钱安全线（低于此值禁止非必要消费） */
export const GOLD_SAFETY_LINE = 500;

/** 天命大额消耗阈值（超过需二次确认） */
export const MANDATE_CONFIRM_THRESHOLD = 100;

// ─────────────────────────────────────────────
// 9. 存档版本
// ─────────────────────────────────────────────

/** 当前存档数据版本号 */
export const SAVE_VERSION = 1;
