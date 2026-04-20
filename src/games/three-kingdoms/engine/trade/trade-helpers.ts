/**
 * 贸易域 — 辅助函数与类型
 *
 * 从 TradeSystem 中提取的纯函数和辅助逻辑
 */

import type {
  CityId,
  TradeRouteId,
  TradeRouteState,
  TradeGoodsId,
  TradeGoodsDef,
  TradeGoodsPrice,
  ProsperityTier,
  TradeEventInstance,
  NpcMerchantInstance,
  TradeSaveData,
} from '../../core/trade/trade.types';
import {
  PROSPERITY_TIERS,
  INITIAL_PROSPERITY,
  PROSPERITY_GAIN_PER_TRADE,
  PROSPERITY_DECAY_RATE,
  PRICE_REFRESH_INTERVAL,
  MAX_CONSECUTIVE_DIRECTION,
  TRADE_EVENT_DEFS,
  TRADE_EVENT_TRIGGER_CHANCE,
  MAX_EVENTS_PER_TRIP,
  NPC_MERCHANT_DEFS,
  NPC_MERCHANT_DURATION,
} from '../../core/trade/trade-config';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建默认商路状态 */
export function createDefaultRouteState(routeId: TradeRouteId): TradeRouteState {
  return {
    routeId,
    opened: false,
    prosperity: INITIAL_PROSPERITY,
    completedTrades: 0,
  };
}

/** 创建默认商品价格 */
export function createDefaultPrice(def: TradeGoodsDef, now: number): TradeGoodsPrice {
  return {
    goodsId: def.id,
    currentPrice: def.basePrice,
    lastPrice: def.basePrice,
    consecutiveDirection: 0,
    lastRefreshTime: now,
  };
}

/** 查找繁荣度等级 */
export function findProsperityTier(prosperity: number): ProsperityTier {
  for (const tier of PROSPERITY_TIERS) {
    if (prosperity >= tier.minProsperity && prosperity < tier.maxProsperity) {
      return tier;
    }
  }
  return PROSPERITY_TIERS[PROSPERITY_TIERS.length - 1];
}

/** 生成唯一ID */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────
// 价格波动逻辑
// ─────────────────────────────────────────────

/** 刷新单个商品价格（纯函数） */
export function refreshSinglePrice(price: TradeGoodsPrice, def: TradeGoodsDef, now: number): void {
  if (now - price.lastRefreshTime < PRICE_REFRESH_INTERVAL * 1000) return;

  price.lastPrice = price.currentPrice;
  const direction = Math.random() > 0.5 ? 1 : -1;
  const newDirection = direction === Math.sign(price.consecutiveDirection)
    ? price.consecutiveDirection + direction
    : direction;

  if (Math.abs(newDirection) > MAX_CONSECUTIVE_DIRECTION) {
    const forcedDir = -Math.sign(price.consecutiveDirection);
    const magnitude = Math.random() * def.volatility;
    price.currentPrice = Math.max(
      def.basePrice * 0.5,
      Math.floor(price.currentPrice * (1 + forcedDir * magnitude)),
    );
    price.consecutiveDirection = forcedDir;
  } else {
    const magnitude = Math.random() * def.volatility;
    price.currentPrice = Math.max(
      def.basePrice * 0.5,
      Math.floor(price.currentPrice * (1 + direction * magnitude)),
    );
    price.consecutiveDirection = newDirection;
  }

  price.currentPrice = Math.min(price.currentPrice, Math.floor(def.basePrice * 2));
  price.lastRefreshTime = now;
}

// ─────────────────────────────────────────────
// 贸易事件生成逻辑
// ─────────────────────────────────────────────

/** 为一趟运输生成随机事件 */
export function generateTradeEvents(caravanId: string, routeId: TradeRouteId): TradeEventInstance[] {
  const events: TradeEventInstance[] = [];
  const eventCount = Math.random() < TRADE_EVENT_TRIGGER_CHANCE
    ? 1 + Math.floor(Math.random() * MAX_EVENTS_PER_TRIP)
    : 0;

  for (let i = 0; i < eventCount; i++) {
    const def = TRADE_EVENT_DEFS[Math.floor(Math.random() * TRADE_EVENT_DEFS.length)];
    events.push({
      id: generateId(),
      eventType: def.type,
      caravanId,
      routeId,
      resolved: false,
      triggeredAt: Date.now(),
    });
  }
  return events;
}

// ─────────────────────────────────────────────
// NPC商人生成逻辑
// ─────────────────────────────────────────────

/** NPC商人生成参数 */
export interface NpcSpawnContext {
  routeStates: Map<TradeRouteId, TradeRouteState>;
  routeDefs: Map<TradeRouteId, { from: CityId; to: CityId }>;
}

/** 尝试生成NPC商人 */
export function trySpawnNpcMerchants(ctx: NpcSpawnContext): NpcMerchantInstance[] {
  const spawned: NpcMerchantInstance[] = [];
  const now = Date.now();

  for (const routeState of ctx.routeStates.values()) {
    if (!routeState.opened) continue;
    const tier = findProsperityTier(routeState.prosperity);
    if (!tier.unlockNpcMerchant) continue;

    const routeDef = ctx.routeDefs.get(routeState.routeId);
    if (!routeDef) continue;

    for (const npcDef of NPC_MERCHANT_DEFS) {
      if (npcDef.requiredProsperity !== tier.level) continue;
      if (Math.random() > npcDef.appearanceChance) continue;

      const cityId: CityId = Math.random() > 0.5 ? routeDef.from : routeDef.to;
      spawned.push({
        id: generateId(),
        defType: npcDef.type,
        cityId,
        appearedAt: now,
        duration: NPC_MERCHANT_DURATION,
        interacted: false,
      });
    }
  }
  return spawned;
}
