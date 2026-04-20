/**
 * 离线收益域 — 核心类型定义
 *
 * v9.0 离线收益深化模块的全部类型
 * 规则：只有 interface/type/const，零逻辑
 *
 * @module core/offline/offline-reward.types
 */

import type { Resources, ProductionRate, ResourceCap } from '../../shared/types';

// ─────────────────────────────────────────────
// 1. 6档衰减
// ─────────────────────────────────────────────

/** 衰减档位定义 */
export interface DecayTier {
  /** 档位唯一标识 */
  id: string;
  /** 档位起始小时 */
  startHours: number;
  /** 档位结束小时 */
  endHours: number;
  /** 效率系数 0~1 */
  efficiency: number;
  /** 档位标签（UI展示） */
  label: string;
}

/** 单档位明细 */
export interface TierDetail {
  /** 档位ID */
  tierId: string;
  /** 该档位秒数 */
  seconds: number;
  /** 该档位效率 */
  efficiency: number;
  /** 该档位收益 */
  earned: Resources;
}

// ─────────────────────────────────────────────
// 2. 离线快照
// ─────────────────────────────────────────────

/** 离线快照数据 */
export interface OfflineSnapshot {
  /** 快照时间戳（ms） */
  timestamp: number;
  /** 离线时长（秒） */
  offlineSeconds: number;
  /** 各档位明细 */
  tierDetails: TierDetail[];
  /** 总收益 */
  totalEarned: Resources;
  /** 综合效率 */
  overallEfficiency: number;
  /** 是否封顶 */
  isCapped: boolean;
}

// ─────────────────────────────────────────────
// 3. 翻倍机制
// ─────────────────────────────────────────────

/** 翻倍来源 */
export type DoubleSource = 'ad' | 'item' | 'vip' | 'return_bonus';

/** 翻倍请求 */
export interface DoubleRequest {
  /** 翻倍来源 */
  source: DoubleSource;
  /** 翻倍倍率（默认2） */
  multiplier: number;
  /** 翻倍描述 */
  description: string;
}

/** 翻倍结果 */
export interface DoubleResult {
  /** 是否成功 */
  success: boolean;
  /** 原始收益 */
  originalEarned: Resources;
  /** 翻倍后收益 */
  doubledEarned: Resources;
  /** 实际倍率 */
  appliedMultiplier: number;
  /** 失败原因 */
  reason?: string;
}

// ─────────────────────────────────────────────
// 4. 加成系数
// ─────────────────────────────────────────────

/** 加成来源 */
export interface BonusSources {
  /** 科技加成（0~1） */
  tech?: number;
  /** VIP加成（0~1） */
  vip?: number;
  /** 声望加成（0~1） */
  reputation?: number;
}

// ─────────────────────────────────────────────
// 5. 系统效率修正
// ─────────────────────────────────────────────

/** 系统级效率修正 */
export interface SystemEfficiencyModifier {
  /** 系统标识 */
  systemId: string;
  /** 系统名称 */
  systemName: string;
  /** 修正系数（0~1，1表示不修正） */
  modifier: number;
  /** 描述 */
  description: string;
}

// ─────────────────────────────────────────────
// 6. 资源溢出
// ─────────────────────────────────────────────

/** 溢出策略 */
export type OverflowStrategy = 'discard' | 'convert' | 'cap';

/** 资源溢出规则 */
export interface OverflowRule {
  /** 资源类型 */
  resourceType: string;
  /** 溢出策略 */
  strategy: OverflowStrategy;
  /** 溢出转换目标（convert策略时） */
  convertTarget?: string;
  /** 转换比率 */
  convertRatio?: number;
}

/** 资源保护配置 */
export interface ResourceProtection {
  /** 资源类型 */
  resourceType: string;
  /** 保护比例（0~1） */
  protectionRatio: number;
  /** 保护下限（绝对值） */
  protectionFloor: number;
}

// ─────────────────────────────────────────────
// 7. 回归面板
// ─────────────────────────────────────────────

/** 离线加速道具 */
export interface OfflineBoostItem {
  id: string;
  name: string;
  boostHours: number;
  count: number;
  description: string;
}

/** 加速道具使用结果 */
export interface BoostUseResult {
  success: boolean;
  addedSeconds: number;
  addedEarned: Resources;
  remainingCount: number;
  reason?: string;
}

/** 回归面板数据 */
export interface ReturnPanelData {
  offlineSeconds: number;
  formattedTime: string;
  efficiencyPercent: number;
  tierDetails: TierDetail[];
  totalEarned: Resources;
  isCapped: boolean;
  availableDoubles: DoubleRequest[];
  boostItems: OfflineBoostItem[];
}

// ─────────────────────────────────────────────
// 8. VIP加成
// ─────────────────────────────────────────────

/** VIP离线加成配置 */
export interface VipOfflineBonus {
  vipLevel: number;
  efficiencyBonus: number;
  extraHours: number;
  dailyDoubleLimit: number;
}

// ─────────────────────────────────────────────
// 9. 离线贸易
// ─────────────────────────────────────────────

/** 离线贸易事件 */
export interface OfflineTradeEvent {
  id: string;
  routeId: string;
  startTime: number;
  completeTime: number;
  estimatedProfit: Resources;
}

/** 离线贸易汇总 */
export interface OfflineTradeSummary {
  completedTrades: number;
  totalProfit: Resources;
  events: OfflineTradeEvent[];
}

// ─────────────────────────────────────────────
// 10. 完整结果
// ─────────────────────────────────────────────

/** 离线收益完整计算结果（v9.0） */
export interface OfflineRewardResultV9 {
  snapshot: OfflineSnapshot;
  vipBoostedEarned: Resources;
  systemModifiedEarned: Resources;
  cappedEarned: Resources;
  overflowResources: Resources;
  tradeSummary: OfflineTradeSummary | null;
  panelData: ReturnPanelData;
}

// ─────────────────────────────────────────────
// 11. 存档
// ─────────────────────────────────────────────

/** 仓库扩容配置 */
export interface WarehouseExpansion {
  resourceType: string;
  baseCapacity: number;
  perLevelIncrease: number;
  maxLevel: number;
  currentLevel: number;
}

/** 仓库扩容结果 */
export interface ExpansionResult {
  success: boolean;
  newCapacity: number;
  previousCapacity: number;
  newLevel: number;
  reason?: string;
}

/** 离线系统存档数据 */
export interface OfflineSaveData {
  lastOfflineTime: number;
  vipDoubleUsedToday: number;
  vipDoubleResetDate: string;
  boostItems: Record<string, number>;
  activeTradeEvents: OfflineTradeEvent[];
  warehouseLevels: Record<string, number>;
  version: number;
}
