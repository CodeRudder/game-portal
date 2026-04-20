/**
 * 离线收益域 — 贸易与道具子系统
 *
 * 职责：
 *   - 离线加速道具管理
 *   - 离线贸易行为模拟
 *
 * 从 OfflineRewardSystem 中提取，保持主系统≤500行
 *
 * @module engine/offline/OfflineTradeAndBoost
 */

import type { Resources } from '../../shared/types';
import type {
  OfflineBoostItem, BoostUseResult,
  OfflineTradeEvent, OfflineTradeSummary,
} from './offline.types';
import {
  OFFLINE_TRADE_EFFICIENCY, MAX_OFFLINE_TRADES, OFFLINE_TRADE_DURATION,
} from './offline-config';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function zeroRes(): Resources { return { grain: 0, gold: 0, troops: 0, mandate: 0 }; }
function mulRes(r: Readonly<Resources>, f: number): Resources {
  return { grain: r.grain * f, gold: r.gold * f, troops: r.troops * f, mandate: r.mandate * f };
}

// ─────────────────────────────────────────────
// 加速道具
// ─────────────────────────────────────────────

/** 道具定义 */
const BOOST_DEFS: ReadonlyArray<{ id: string; name: string; boostHours: number; desc: string }> = [
  { id: 'offline_boost_1h', name: '离线加速1小时', boostHours: 1, desc: '增加1小时离线收益' },
  { id: 'offline_boost_4h', name: '离线加速4小时', boostHours: 4, desc: '增加4小时离线收益' },
  { id: 'offline_boost_8h', name: '离线加速8小时', boostHours: 8, desc: '增加8小时离线收益' },
  { id: 'offline_double', name: '离线翻倍卡', boostHours: 0, desc: '离线收益翻倍' },
];

/** 加速道具ID到小时数映射 */
const BOOST_HOURS_MAP: Record<string, number> = {
  'offline_boost_1h': 1,
  'offline_boost_4h': 4,
  'offline_boost_8h': 8,
};

/**
 * 获取所有加速道具列表
 */
export function getBoostItemList(inventory: ReadonlyMap<string, number>): OfflineBoostItem[] {
  return BOOST_DEFS.map(def => ({
    id: def.id,
    name: def.name,
    boostHours: def.boostHours,
    count: inventory.get(def.id) ?? 0,
    description: def.desc,
  }));
}

/**
 * 使用加速道具
 */
export function useBoostItem(
  itemId: string,
  inventory: Map<string, number>,
  productionRates: Readonly<Resources>,
): BoostUseResult {
  const count = inventory.get(itemId) ?? 0;
  if (count <= 0) {
    return { success: false, addedSeconds: 0, addedEarned: zeroRes(), remainingCount: 0, reason: '道具数量不足' };
  }

  const boostHours = BOOST_HOURS_MAP[itemId];
  if (boostHours === undefined) {
    return { success: false, addedSeconds: 0, addedEarned: zeroRes(), remainingCount: count, reason: '无效的道具ID' };
  }

  // 消耗道具
  inventory.set(itemId, count - 1);

  // 计算加速收益（使用100%效率）
  const addedSeconds = boostHours * 3600;
  const addedEarned = zeroRes();
  for (const key of ['grain', 'gold', 'troops', 'mandate'] as const) {
    addedEarned[key] = productionRates[key] * addedSeconds;
  }

  return { success: true, addedSeconds, addedEarned, remainingCount: count - 1 };
}

// ─────────────────────────────────────────────
// 离线贸易
// ─────────────────────────────────────────────

/**
 * 模拟离线贸易
 *
 * 根据离线时长计算完成的贸易次数和收益
 */
export function simulateOfflineTrade(
  offlineSeconds: number,
  tradeProfitPerRun: Readonly<Resources>,
  lastOfflineTime: number,
): OfflineTradeSummary {
  if (offlineSeconds < OFFLINE_TRADE_DURATION) {
    return { completedTrades: 0, totalProfit: zeroRes(), events: [] };
  }

  const maxTradesByTime = Math.floor(offlineSeconds / OFFLINE_TRADE_DURATION);
  const completedTrades = Math.min(maxTradesByTime, MAX_OFFLINE_TRADES);

  const events: OfflineTradeEvent[] = [];
  const totalProfit = zeroRes();

  for (let i = 0; i < completedTrades; i++) {
    const startTime = lastOfflineTime + i * OFFLINE_TRADE_DURATION;
    const completeTime = startTime + OFFLINE_TRADE_DURATION;
    const estimatedProfit = mulRes(tradeProfitPerRun, OFFLINE_TRADE_EFFICIENCY);

    events.push({
      id: `offline_trade_${i}`,
      routeId: `auto_route_${i}`,
      startTime,
      completeTime,
      estimatedProfit,
    });

    totalProfit.grain += estimatedProfit.grain;
    totalProfit.gold += estimatedProfit.gold;
    totalProfit.troops += estimatedProfit.troops;
    totalProfit.mandate += estimatedProfit.mandate;
  }

  return { completedTrades, totalProfit, events };
}
