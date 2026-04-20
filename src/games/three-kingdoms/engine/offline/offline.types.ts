/**
 * 离线收益域 — 类型定义
 *
 * v9.0 离线收益深化模块的全部类型
 * 规则：只有 interface/type/const，零逻辑
 *
 * @module engine/offline/offline.types
 */

import type { Resources, ProductionRate } from '../../shared/types';

// ─────────────────────────────────────────────
// 1. 6档衰减快照
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
// 2. 翻倍机制
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
// 3. 回归面板
// ─────────────────────────────────────────────

/** 回归面板数据 */
export interface ReturnPanelData {
  /** 离线时长（秒） */
  offlineSeconds: number;
  /** 格式化的离线时长 */
  formattedTime: string;
  /** 综合效率百分比 */
  efficiencyPercent: number;
  /** 各档位明细 */
  tierDetails: TierDetail[];
  /** 总收益 */
  totalEarned: Resources;
  /** 是否封顶 */
  isCapped: boolean;
  /** 可用翻倍选项 */
  availableDoubles: DoubleRequest[];
  /** 离线加速道具列表 */
  boostItems: OfflineBoostItem[];
}

// ─────────────────────────────────────────────
// 4. 离线加速道具
// ─────────────────────────────────────────────

/** 离线加速道具定义 */
export interface OfflineBoostItem {
  /** 道具ID */
  id: string;
  /** 道具名称 */
  name: string;
  /** 加速小时数 */
  boostHours: number;
  /** 道具数量 */
  count: number;
  /** 道具描述 */
  description: string;
}

/** 加速道具使用结果 */
export interface BoostUseResult {
  /** 是否成功 */
  success: boolean;
  /** 增加的秒数 */
  addedSeconds: number;
  /** 增加的收益 */
  addedEarned: Resources;
  /** 剩余道具数量 */
  remainingCount: number;
  /** 失败原因 */
  reason?: string;
}

// ─────────────────────────────────────────────
// 5. 离线贸易行为
// ─────────────────────────────────────────────

/** 离线贸易事件 */
export interface OfflineTradeEvent {
  /** 事件ID */
  id: string;
  /** 贸易路线 */
  routeId: string;
  /** 发起时间戳 */
  startTime: number;
  /** 完成时间戳 */
  completeTime: number;
  /** 预估收益 */
  estimatedProfit: Resources;
}

/** 离线贸易汇总 */
export interface OfflineTradeSummary {
  /** 完成的贸易次数 */
  completedTrades: number;
  /** 总贸易收益 */
  totalProfit: Resources;
  /** 贸易事件列表 */
  events: OfflineTradeEvent[];
}

// ─────────────────────────────────────────────
// 6. VIP离线加成
// ─────────────────────────────────────────────

/** VIP离线加成配置 */
export interface VipOfflineBonus {
  /** VIP等级 */
  vipLevel: number;
  /** 离线效率加成（0~1） */
  efficiencyBonus: number;
  /** 离线时长加成（小时） */
  extraHours: number;
  /** 翻倍次数上限（每日） */
  dailyDoubleLimit: number;
}

// ─────────────────────────────────────────────
// 7. 离线效率修正系数
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
// 8. 收益上限与资源保护
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
  /** 保护比例（0~1，被掠夺/消耗时保留的比例） */
  protectionRatio: number;
  /** 保护下限（绝对值） */
  protectionFloor: number;
}

/** 仓库扩容配置 */
export interface WarehouseExpansion {
  /** 资源类型 */
  resourceType: string;
  /** 基础容量 */
  baseCapacity: number;
  /** 每级增量 */
  perLevelIncrease: number;
  /** 最大等级 */
  maxLevel: number;
  /** 当前等级 */
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

// ─────────────────────────────────────────────
// 9. 离线收益完整结果
// ─────────────────────────────────────────────

/** 离线收益完整计算结果（v9.0） */
export interface OfflineRewardResultV9 {
  /** 基础快照 */
  snapshot: OfflineSnapshot;
  /** VIP加成后收益 */
  vipBoostedEarned: Resources;
  /** 系统修正后收益 */
  systemModifiedEarned: Resources;
  /** 应用上限后收益 */
  cappedEarned: Resources;
  /** 溢出资源（被丢弃/转换的） */
  overflowResources: Resources;
  /** 离线贸易汇总 */
  tradeSummary: OfflineTradeSummary | null;
  /** 回归面板数据 */
  panelData: ReturnPanelData;
}

// ─────────────────────────────────────────────
// 10. 存档数据
// ─────────────────────────────────────────────

/** 离线系统存档数据 */
export interface OfflineSaveData {
  /** 上次离线时间戳 */
  lastOfflineTime: number;
  /** VIP加成使用记录 */
  vipDoubleUsedToday: number;
  /** vipDouble重置日期 */
  vipDoubleResetDate: string;
  /** 加速道具库存 */
  boostItems: Record<string, number>;
  /** 离线贸易进行中事件 */
  activeTradeEvents: OfflineTradeEvent[];
  /** 仓库扩容等级 */
  warehouseLevels: Record<string, number>;
  /** 版本号 */
  version: number;
}
