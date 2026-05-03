/**
 * 市舶司↔贸易桥接层
 *
 * 职责：将市舶司等级转化为贸易折扣、繁荣度加成、商队数量。
 * 供 TradeSystem 通过回调注入，不修改 TradeSystem 核心逻辑。
 *
 * 规则：
 * - 不修改 TradeSystem 核心逻辑
 * - 通过回调/注入方式连接
 * - 纯函数，无副作用
 *
 * @module engine/building/port-bridge
 */

import {
  PORT_DISCOUNT_TABLE,
  PORT_PROSPERITY_BONUS,
  PORT_MAX_CARAVANS,
  PROSPERITY_GOLD_BONUS,
  MAX_PROSPERITY_LEVEL,
  PROSPERITY_LEVEL_THRESHOLDS,
} from './port-config';

// ─────────────────────────────────────────────
// 1. 核心计算函数
// ─────────────────────────────────────────────

/**
 * 获取市舶司等级对应的贸易折扣
 *
 * @param portLevel 市舶司等级（1~20）
 * @returns 折扣百分比（如 Lv5→5%, Lv20→20%）
 *
 * @example
 * ```ts
 * getTradeDiscount(5);  // 5
 * getTradeDiscount(10); // 10
 * ```
 */
export function getTradeDiscount(portLevel: number): number {
  if (portLevel <= 0) return 0;
  const idx = Math.min(portLevel, PORT_DISCOUNT_TABLE.length) - 1;
  return PORT_DISCOUNT_TABLE[idx];
}

/**
 * 获取市舶司等级对应的繁荣度产出加成（/小时）
 *
 * @param portLevel 市舶司等级（1~20）
 * @returns 繁荣度产出加成（/小时）
 *
 * @example
 * ```ts
 * getProsperityBonus(10); // 250
 * getProsperityBonus(15); // 350
 * ```
 */
export function getProsperityBonus(portLevel: number): number {
  if (portLevel <= 0) return 0;
  const idx = Math.min(portLevel, PORT_PROSPERITY_BONUS.length) - 1;
  return PORT_PROSPERITY_BONUS[idx];
}

/**
 * 获取市舶司等级对应的最大商队数
 *
 * @param portLevel 市舶司等级（1~20）
 * @returns 最大商队数
 *
 * @example
 * ```ts
 * getMaxCaravans(1);  // 1
 * getMaxCaravans(10); // 3
 * getMaxCaravans(20); // 5
 * ```
 */
export function getMaxCaravans(portLevel: number): number {
  if (portLevel <= 0) return 0;
  const idx = Math.min(portLevel, PORT_MAX_CARAVANS.length) - 1;
  return PORT_MAX_CARAVANS[idx];
}

/**
 * 根据繁荣度经验值计算繁荣度等级（1~5）
 *
 * @param prosperityExp 繁荣度经验值
 * @returns 繁荣度等级
 *
 * @example
 * ```ts
 * calculateProsperityLevel(0);    // 1
 * calculateProsperityLevel(2500); // 2
 * calculateProsperityLevel(5000); // 3
 * ```
 */
export function calculateProsperityLevel(prosperityExp: number): number {
  if (prosperityExp <= 0) return 1;
  for (let i = PROSPERITY_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (prosperityExp >= PROSPERITY_LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * 繁荣度等级→市集铜钱加成百分比
 *
 * @param prosperityLevel 繁荣度等级（1~5）
 * @returns 铜钱加成百分比（如 等级3→15%）
 *
 * @example
 * ```ts
 * calculateMarketGoldBonus(3); // 15
 * calculateMarketGoldBonus(5); // 25
 * ```
 */
export function calculateMarketGoldBonus(prosperityLevel: number): number {
  if (prosperityLevel <= 0) return 0;
  const idx = Math.min(prosperityLevel, MAX_PROSPERITY_LEVEL) - 1;
  return PROSPERITY_GOLD_BONUS[idx];
}

/**
 * 计算应用贸易折扣后的实际价格
 *
 * @param basePrice 原始价格
 * @param portLevel 市舶司等级
 * @returns 折扣后价格（向下取整）
 *
 * @example
 * ```ts
 * applyTradeDiscount(1000, 10); // 900 (10% off)
 * ```
 */
export function applyTradeDiscount(basePrice: number, portLevel: number): number {
  const discount = getTradeDiscount(portLevel);
  return Math.floor(basePrice * (1 - discount / 100));
}

// ─────────────────────────────────────────────
// 2. 序列化支持
// ─────────────────────────────────────────────

/** 市舶司桥接层存档数据 */
export interface PortBridgeSaveData {
  /** 版本号 */
  version: number;
  /** 繁荣度经验值 */
  prosperityExp: number;
}

/** 当前版本号 */
export const PORT_BRIDGE_SAVE_VERSION = 1;

/**
 * 序列化市舶司桥接层状态
 */
export function serializePortBridge(prosperityExp: number): PortBridgeSaveData {
  return {
    version: PORT_BRIDGE_SAVE_VERSION,
    prosperityExp,
  };
}

/**
 * 反序列化市舶司桥接层状态
 */
export function deserializePortBridge(data: unknown): PortBridgeSaveData {
  if (typeof data === 'object' && data !== null && 'version' in data) {
    const d = data as PortBridgeSaveData;
    return {
      version: d.version ?? PORT_BRIDGE_SAVE_VERSION,
      prosperityExp: d.prosperityExp ?? 0,
    };
  }
  return { version: PORT_BRIDGE_SAVE_VERSION, prosperityExp: 0 };
}
