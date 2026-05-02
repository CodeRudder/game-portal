/**
 * 离线收益域 — 数值配置
 *
 * v9.0 离线收益深化的全部常量配置
 * 规则：零逻辑，只有常量和数据结构
 *
 * @module engine/offline/offline-config
 */

import type {
  DecayTier,
  VipOfflineBonus,
  SystemEfficiencyModifier,
  OverflowRule,
  ResourceProtection,
  WarehouseExpansion,
} from './offline.types';

// ─────────────────────────────────────────────
// 1. 5档衰减配置
// ─────────────────────────────────────────────

/**
 * 5档衰减表（v9.0 PRD 规范）
 *
 * 0~2h:   100% 完整效率
 * 2~8h:    80% 高效
 * 8~24h:   60% 中效
 * 24~48h:  40% 低效
 * 48~72h:  20% 衰退
 * >72h:     0% 无收益
 */
export const DECAY_TIERS: readonly DecayTier[] = [
  { id: 'tier1', startHours: 0, endHours: 2, efficiency: 1.0, label: '完整' },
  { id: 'tier2', startHours: 2, endHours: 8, efficiency: 0.80, label: '高效' },
  { id: 'tier3', startHours: 8, endHours: 24, efficiency: 0.60, label: '中效' },
  { id: 'tier4', startHours: 24, endHours: 48, efficiency: 0.40, label: '低效' },
  { id: 'tier5', startHours: 48, endHours: 72, efficiency: 0.20, label: '衰退' },
] as const;

/** 最大离线收益时长（小时） */
export const MAX_OFFLINE_HOURS = 72;

/** 最大离线收益时长（秒） */
export const MAX_OFFLINE_SECONDS = MAX_OFFLINE_HOURS * 3600;

/** 离线弹窗触发阈值（秒） */
export const OFFLINE_POPUP_THRESHOLD = 300;

// ─────────────────────────────────────────────
// 2. 翻倍机制配置
// ─────────────────────────────────────────────

/** 广告翻倍倍率 */
export const AD_DOUBLE_MULTIPLIER = 2;

/** 道具翻倍倍率 */
export const ITEM_DOUBLE_MULTIPLIER = 2;

/** 回归奖励翻倍倍率（>24h离线） */
export const RETURN_BONUS_MULTIPLIER = 2;

/** 触发回归奖励的最小离线时长（小时） */
export const RETURN_BONUS_MIN_HOURS = 24;

// ─────────────────────────────────────────────
// 3. VIP离线加成配置表
// ─────────────────────────────────────────────

/**
 * VIP等级离线加成表
 * vipLevel: VIP等级
 * efficiencyBonus: 效率加成百分比
 * extraHours: 额外离线时长
 * dailyDoubleLimit: 每日翻倍次数上限
 */
export const VIP_OFFLINE_BONUSES: readonly VipOfflineBonus[] = [
  { vipLevel: 0, efficiencyBonus: 0, extraHours: 0, dailyDoubleLimit: 1 },
  { vipLevel: 1, efficiencyBonus: 0.05, extraHours: 2, dailyDoubleLimit: 2 },
  { vipLevel: 2, efficiencyBonus: 0.10, extraHours: 4, dailyDoubleLimit: 2 },
  { vipLevel: 3, efficiencyBonus: 0.15, extraHours: 8, dailyDoubleLimit: 3 },
  { vipLevel: 4, efficiencyBonus: 0.20, extraHours: 12, dailyDoubleLimit: 3 },
  { vipLevel: 5, efficiencyBonus: 0.25, extraHours: 24, dailyDoubleLimit: 5 },
] as const;

// ─────────────────────────────────────────────
// 4. 系统差异化修正系数
// ─────────────────────────────────────────────

/**
 * 各系统离线效率修正系数（v9.0 PLAN 规范）
 *
 * 资源×1.0 / 建筑×1.2 / 科技×1.0 / 远征×0.85
 * 不同系统在离线时的表现不同
 */
export const SYSTEM_EFFICIENCY_MODIFIERS: readonly SystemEfficiencyModifier[] = [
  { systemId: 'resource', systemName: '资源产出', modifier: 1.0, description: '资源离线产出效率100%' },
  { systemId: 'building', systemName: '建筑产出', modifier: 1.2, description: '建筑离线产出效率120%' },
  { systemId: 'tech', systemName: '科技研究', modifier: 1.0, description: '科技离线研究效率100%' },
  { systemId: 'expedition', systemName: '远征系统', modifier: 0.85, description: '远征离线效率85%' },
  { systemId: 'Trade', systemName: '贸易路线', modifier: 0.8, description: '离线贸易效率80%' },
  { systemId: 'hero', systemName: '武将训练', modifier: 0.5, description: '离线训练效率50%' },
  { systemId: 'campaign', systemName: '关卡扫荡', modifier: 0.4, description: '离线扫荡效率40%' },
] as const;

// ─────────────────────────────────────────────
// 5. 溢出规则
// ─────────────────────────────────────────────

/**
 * 资源溢出规则
 *
 * grain: 超出上限后截断（discard）
 * gold: 无上限（不触发溢出）
 * troops: 超出上限后截断（discard）
 * mandate: 无上限（不触发溢出）
 */
export const OVERFLOW_RULES: readonly OverflowRule[] = [
  { resourceType: 'grain', strategy: 'discard' },
  { resourceType: 'gold', strategy: 'cap' },
  { resourceType: 'troops', strategy: 'discard' },
  { resourceType: 'mandate', strategy: 'cap' },
] as const;

// ─────────────────────────────────────────────
// 6. 资源保护机制
// ─────────────────────────────────────────────

/**
 * 资源保护配置
 *
 * 被攻击/消耗时，每种资源有最低保护线：
 * - grain: 保护30%，最低保留100
 * - gold: 保护20%，最低保留500
 * - troops: 保护40%，最低保留50
 * - mandate: 不保护
 */
export const RESOURCE_PROTECTIONS: readonly ResourceProtection[] = [
  { resourceType: 'grain', protectionRatio: 0.3, protectionFloor: 100 },
  { resourceType: 'gold', protectionRatio: 0.2, protectionFloor: 500 },
  { resourceType: 'troops', protectionRatio: 0.4, protectionFloor: 50 },
] as const;

// ─────────────────────────────────────────────
// 7. 仓库扩容配置
// ─────────────────────────────────────────────

/**
 * 默认仓库扩容配置
 */
export const DEFAULT_WAREHOUSE_EXPANSIONS: readonly WarehouseExpansion[] = [
  { resourceType: 'grain', baseCapacity: 2000, perLevelIncrease: 1000, maxLevel: 30, currentLevel: 1 },
  { resourceType: 'troops', baseCapacity: 500, perLevelIncrease: 500, maxLevel: 30, currentLevel: 1 },
] as const;

// ─────────────────────────────────────────────
// 8. 离线贸易配置
// ─────────────────────────────────────────────

/** 离线贸易基础效率 */
export const OFFLINE_TRADE_EFFICIENCY = 0.6;

/** 离线贸易最大同时进行数 */
export const MAX_OFFLINE_TRADES = 3;

/** 离线贸易完成时间（秒） */
export const OFFLINE_TRADE_DURATION = 3600;

// ─────────────────────────────────────────────
// 9. 暂存邮件队列配置
// ─────────────────────────────────────────────

/** 暂存队列上限 */
export const STAGING_QUEUE_CAPACITY = 20;

// ─────────────────────────────────────────────
// 10. 离线经验配置
// ─────────────────────────────────────────────

/** 基础经验速率（每小时） */
export const BASE_EXP_PER_HOUR = 100;

/** 经验加成上限 */
export const EXP_BONUS_CAP = 1.0;

/** 经验等级表 */
export const EXP_LEVEL_TABLE: readonly { level: number; expRequired: number; rewards: { grain: number; gold: number; ore: number; wood: number; troops: number; mandate: number; techPoint: number; recruitToken: number; skillBook: number } }[] = [
  { level: 1, expRequired: 100, rewards: { grain: 500, gold: 200, ore: 0, wood: 0, troops: 50, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 } },
  { level: 2, expRequired: 300, rewards: { grain: 1000, gold: 500, ore: 0, wood: 0, troops: 100, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 } },
  { level: 3, expRequired: 600, rewards: { grain: 2000, gold: 1000, ore: 0, wood: 0, troops: 200, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 } },
  { level: 4, expRequired: 1000, rewards: { grain: 4000, gold: 2000, ore: 0, wood: 0, troops: 400, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 } },
  { level: 5, expRequired: 1500, rewards: { grain: 8000, gold: 4000, ore: 0, wood: 0, troops: 800, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 } },
  { level: 6, expRequired: 2100, rewards: { grain: 15000, gold: 8000, ore: 0, wood: 0, troops: 1500, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 } },
  { level: 7, expRequired: 2800, rewards: { grain: 30000, gold: 15000, ore: 0, wood: 0, troops: 3000, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 } },
  { level: 8, expRequired: 3600, rewards: { grain: 50000, gold: 30000, ore: 0, wood: 0, troops: 5000, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 } },
  { level: 9, expRequired: 4500, rewards: { grain: 80000, gold: 50000, ore: 0, wood: 0, troops: 8000, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 } },
  { level: 10, expRequired: 5500, rewards: { grain: 120000, gold: 80000, ore: 0, wood: 0, troops: 12000, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0 } },
];

// ─────────────────────────────────────────────
// 11. 活动离线效率配置
// ─────────────────────────────────────────────

/** 赛季活动离线效率 */
export const SEASON_ACTIVITY_OFFLINE_EFFICIENCY = 0.5;

/** 限时活动离线效率 */
export const TIMED_ACTIVITY_OFFLINE_EFFICIENCY = 0.3;

// ─────────────────────────────────────────────
// 12. 攻城失败损失配置
// ─────────────────────────────────────────────

/** 攻城失败兵力损失比例 */
export const SIEGE_FAILURE_TROOP_LOSS_RATIO = 0.3;

// ─────────────────────────────────────────────
// 13. 邮件过期补偿配置
// ─────────────────────────────────────────────

/** 过期补偿比例（铜钱50%） */
export const EXPIRED_MAIL_COMPENSATION_RATIO = 0.5;

// ─────────────────────────────────────────────
// 14. 存档版本
// ─────────────────────────────────────────────

/** 离线系统存档版本 */
export const OFFLINE_SAVE_VERSION = 1;
