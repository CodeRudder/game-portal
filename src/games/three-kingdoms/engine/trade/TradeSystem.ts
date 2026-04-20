/**
 * 贸易域 — 聚合根
 *
 * 职责：商路开通、价格波动、利润计算、贸易事件、繁荣度、NPC商人
 * 规则：可引用 trade-config 和 trade.types，通过回调访问 CurrencySystem
 */

import type {
  CityId,
  TradeRouteId,
  TradeRouteDef,
  TradeRouteState,
  TradeGoodsId,
  TradeGoodsDef,
  TradeGoodsPrice,
  TradeProfit,
  TradeEventInstance,
  TradeEventOption,
  ProsperityLevel,
  ProsperityTier,
  NpcMerchantInstance,
  TradeSaveData,
} from '../../core/trade/trade.types';
import {
  CITY_IDS,
  CITY_LABELS,
  PROSPERITY_LABELS,
} from '../../core/trade/trade.types';
import {
  CITY_DEFS,
  TRADE_ROUTE_DEFS,
  TRADE_GOODS_DEFS,
  PRICE_REFRESH_INTERVAL,
  MAX_CONSECUTIVE_DIRECTION,
  PROSPERITY_TIERS,
  INITIAL_PROSPERITY,
  PROSPERITY_GAIN_PER_TRADE,
  PROSPERITY_DECAY_RATE,
  TRADE_EVENT_DEFS,
  TRADE_EVENT_TRIGGER_CHANCE,
  MAX_EVENTS_PER_TRIP,
  NPC_MERCHANT_DEFS,
  NPC_MERCHANT_DURATION,
  TRADE_SAVE_VERSION,
} from '../../core/trade/trade-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建默认商路状态 */
function createDefaultRouteState(routeId: TradeRouteId): TradeRouteState {
  return {
    routeId,
    opened: false,
    prosperity: INITIAL_PROSPERITY,
    completedTrades: 0,
  };
}

/** 创建默认商品价格 */
function createDefaultPrice(def: TradeGoodsDef, now: number): TradeGoodsPrice {
  return {
    goodsId: def.id,
    currentPrice: def.basePrice,
    lastPrice: def.basePrice,
    consecutiveDirection: 0,
    lastRefreshTime: now,
  };
}

/** 查找繁荣度等级 */
function findProsperityTier(prosperity: number): ProsperityTier {
  for (const tier of PROSPERITY_TIERS) {
    if (prosperity >= tier.minProsperity && prosperity < tier.maxProsperity) {
      return tier;
    }
  }
  return PROSPERITY_TIERS[PROSPERITY_TIERS.length - 1];
}

/** 生成唯一ID */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────
// TradeSystem
// ─────────────────────────────────────────────

/** 货币操作回调 */
export interface TradeCurrencyOps {
  addCurrency: (type: string, amount: number) => void;
  canAfford: (type: string, amount: number) => boolean;
  spendByPriority: (shopType: string, amount: number, currencyType?: string) => { success: boolean };
}

export class TradeSystem implements ISubsystem {
  readonly name = 'trade' as const;
  private deps: ISystemDeps | null = null;

  /** 商路状态 */
  private routeStates: Map<TradeRouteId, TradeRouteState>;
  /** 商品价格 */
  private goodsPrices: Map<TradeGoodsId, TradeGoodsPrice>;
  /** 商品定义 */
  private goodsDefs: Map<TradeGoodsId, TradeGoodsDef>;
  /** 商路定义 */
  private routeDefs: Map<TradeRouteId, TradeRouteDef>;
  /** 活跃贸易事件 */
  private activeEvents: TradeEventInstance[];
  /** NPC商人实例 */
  private npcMerchants: NpcMerchantInstance[];
  /** 货币操作回调 */
  private currencyOps: TradeCurrencyOps | null = null;

  constructor() {
    this.routeStates = new Map();
    this.goodsPrices = new Map();
    this.goodsDefs = new Map();
    this.routeDefs = new Map();
    this.activeEvents = [];
    this.npcMerchants = [];

    // 初始化商路状态
    for (const def of TRADE_ROUTE_DEFS) {
      this.routeDefs.set(def.id, def);
      this.routeStates.set(def.id, createDefaultRouteState(def.id));
    }

    // 初始化商品价格
    const now = Date.now();
    for (const def of TRADE_GOODS_DEFS) {
      this.goodsDefs.set(def.id, def);
      this.goodsPrices.set(def.id, createDefaultPrice(def, now));
    }
  }

  // ── ISubsystem 接口 ──

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    // 繁荣度自然衰减
    for (const state of this.routeStates.values()) {
      if (state.opened && state.prosperity > 0) {
        state.prosperity = Math.max(0, state.prosperity - PROSPERITY_DECAY_RATE * dt);
      }
    }
    // 清理过期NPC商人
    const now = Date.now();
    this.npcMerchants = this.npcMerchants.filter(m => now - m.appearedAt < m.duration);
  }

  getState(): Record<string, unknown> {
    return {
      routes: Object.fromEntries(this.routeStates),
      prices: Object.fromEntries(this.goodsPrices),
      activeEvents: [...this.activeEvents],
      npcMerchants: [...this.npcMerchants],
    };
  }

  reset(): void {
    const now = Date.now();
    this.routeStates.clear();
    this.goodsPrices.clear();
    this.activeEvents = [];
    this.npcMerchants = [];

    for (const def of TRADE_ROUTE_DEFS) {
      this.routeStates.set(def.id, createDefaultRouteState(def.id));
    }
    for (const def of TRADE_GOODS_DEFS) {
      this.goodsPrices.set(def.id, createDefaultPrice(def, now));
    }
  }

  /** 注入货币操作 */
  setCurrencyOps(ops: TradeCurrencyOps): void {
    this.currencyOps = ops;
  }

  // ─────────────────────────────────────────────
  // 商路开通 (TRD-1)
  // ─────────────────────────────────────────────

  /** 获取所有商路定义 */
  getRouteDefs(): TradeRouteDef[] {
    return Array.from(this.routeDefs.values());
  }

  /** 获取商路状态 */
  getRouteState(routeId: TradeRouteId): TradeRouteState | undefined {
    return this.routeStates.get(routeId);
  }

  /** 获取所有商路状态 */
  getAllRouteStates(): Map<TradeRouteId, TradeRouteState> {
    return new Map(this.routeStates);
  }

  /** 检查商路开通条件 */
  canOpenRoute(routeId: TradeRouteId, castleLevel: number): { canOpen: boolean; reason?: string } {
    const def = this.routeDefs.get(routeId);
    if (!def) return { canOpen: false, reason: '商路不存在' };

    const state = this.routeStates.get(routeId);
    if (state?.opened) return { canOpen: false, reason: '商路已开通' };

    if (castleLevel < def.requiredCastleLevel) {
      return { canOpen: false, reason: `需要主城${def.requiredCastleLevel}级` };
    }

    if (def.requiredRoute) {
      const preState = this.routeStates.get(def.requiredRoute);
      if (!preState?.opened) {
        return { canOpen: false, reason: '需要先开通前置商路' };
      }
    }

    return { canOpen: true };
  }

  /** 开通商路 */
  openRoute(routeId: TradeRouteId, castleLevel: number): { success: boolean; reason?: string } {
    const check = this.canOpenRoute(routeId, castleLevel);
    if (!check.canOpen) return { success: false, reason: check.reason };

    const def = this.routeDefs.get(routeId)!;

    // 扣费
    if (this.currencyOps) {
      const totalCopper = Object.values(def.openCost).reduce((s, v) => s + v, 0);
      const result = this.currencyOps.spendByPriority('trade', totalCopper, 'copper');
      if (!result.success) {
        return { success: false, reason: '货币不足' };
      }
    }

    const state = this.routeStates.get(routeId)!;
    state.opened = true;
    return { success: true };
  }

  // ─────────────────────────────────────────────
  // 价格波动 (TRD-1)
  // ─────────────────────────────────────────────

  /** 刷新所有商品价格 */
  refreshPrices(): void {
    const now = Date.now();
    for (const [goodsId, price] of this.goodsPrices) {
      const def = this.goodsDefs.get(goodsId);
      if (!def) continue;

      // 检查刷新间隔
      if (now - price.lastRefreshTime < PRICE_REFRESH_INTERVAL * 1000) continue;

      price.lastPrice = price.currentPrice;

      // 计算波动方向
      const direction = Math.random() > 0.5 ? 1 : -1;
      const newDirection = direction === Math.sign(price.consecutiveDirection)
        ? price.consecutiveDirection + direction
        : direction;

      // 限制连续涨跌
      if (Math.abs(newDirection) > MAX_CONSECUTIVE_DIRECTION) {
        // 强制反向
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

      // 价格上限
      price.currentPrice = Math.min(price.currentPrice, Math.floor(def.basePrice * 2));
      price.lastRefreshTime = now;
    }
  }

  /** 获取商品当前价格 */
  getPrice(goodsId: TradeGoodsId): number {
    return this.goodsPrices.get(goodsId)?.currentPrice ?? 0;
  }

  /** 获取所有商品价格 */
  getAllPrices(): Map<TradeGoodsId, TradeGoodsPrice> {
    return new Map(this.goodsPrices);
  }

  /** 获取商品定义 */
  getGoodsDef(goodsId: TradeGoodsId): TradeGoodsDef | undefined {
    return this.goodsDefs.get(goodsId);
  }

  /** 获取所有商品定义 */
  getAllGoodsDefs(): TradeGoodsDef[] {
    return Array.from(this.goodsDefs.values());
  }

  // ─────────────────────────────────────────────
  // 利润计算 (TRD-1)
  // ─────────────────────────────────────────────

  /** 计算贸易利润 */
  calculateProfit(
    routeId: TradeRouteId,
    cargo: Record<string, number>,
    bargainingPower: number,
    guardCost: number,
  ): TradeProfit {
    const routeState = this.routeStates.get(routeId);
    const routeDef = this.routeDefs.get(routeId);
    if (!routeState || !routeDef) {
      return { revenue: 0, cost: 0, profit: 0, profitRate: 0, prosperityBonus: 0, bargainingBonus: 0, guardCost: 0 };
    }

    // 计算成本和收入
    let totalCost = 0;
    let totalRevenue = 0;
    for (const [goodsId, quantity] of Object.entries(cargo)) {
      const price = this.goodsPrices.get(goodsId);
      const def = this.goodsDefs.get(goodsId);
      if (price && def) {
        totalCost += def.basePrice * quantity;
        totalRevenue += price.currentPrice * quantity;
      }
    }

    // 繁荣度加成
    const tier = findProsperityTier(routeState.prosperity);
    const prosperityBonus = tier.outputMultiplier - 1;

    // 议价加成
    const bargainingBonus = bargainingPower - 1;

    // 净利润
    const adjustedRevenue = totalRevenue * (1 + prosperityBonus) * (1 + bargainingBonus);
    const profit = adjustedRevenue - totalCost - guardCost;
    const profitRate = totalCost > 0 ? profit / totalCost : 0;

    return {
      revenue: Math.floor(adjustedRevenue),
      cost: totalCost,
      profit: Math.floor(profit),
      profitRate,
      prosperityBonus,
      bargainingBonus,
      guardCost,
    };
  }

  /** 完成一次贸易（更新繁荣度） */
  completeTrade(routeId: TradeRouteId): void {
    const state = this.routeStates.get(routeId);
    if (state && state.opened) {
      state.completedTrades++;
      state.prosperity = Math.min(100, state.prosperity + PROSPERITY_GAIN_PER_TRADE);
    }
  }

  // ─────────────────────────────────────────────
  // 繁荣度 (TRD-3)
  // ─────────────────────────────────────────────

  /** 获取繁荣度等级 */
  getProsperityLevel(routeId: TradeRouteId): ProsperityLevel {
    const state = this.routeStates.get(routeId);
    if (!state) return 'declining';
    return findProsperityTier(state.prosperity).level;
  }

  /** 获取繁荣度产出倍率 */
  getProsperityMultiplier(routeId: TradeRouteId): number {
    const state = this.routeStates.get(routeId);
    if (!state) return 1;
    return findProsperityTier(state.prosperity).outputMultiplier;
  }

  /** 获取繁荣度详情 */
  getProsperityTier(routeId: TradeRouteId): ProsperityTier {
    const state = this.routeStates.get(routeId);
    if (!state) return PROSPERITY_TIERS[0];
    return findProsperityTier(state.prosperity);
  }

  // ─────────────────────────────────────────────
  // 贸易事件 (TRD-3)
  // ─────────────────────────────────────────────

  /** 为一趟运输生成随机事件 */
  generateTradeEvents(caravanId: string, routeId: TradeRouteId): TradeEventInstance[] {
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

    this.activeEvents.push(...events);
    return events;
  }

  /** 处理贸易事件 */
  resolveTradeEvent(eventId: string, optionId: string): { success: boolean; option?: TradeEventOption } {
    const event = this.activeEvents.find(e => e.id === eventId);
    if (!event) return { success: false };

    const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
    if (!def) return { success: false };

    const option = def.options.find(o => o.id === optionId);
    if (!option) return { success: false };

    event.resolved = true;
    event.chosenOptionId = optionId;

    // 繁荣度影响
    if (option.prosperityChange !== 0) {
      const state = this.routeStates.get(event.routeId);
      if (state) {
        state.prosperity = Math.max(0, Math.min(100, state.prosperity + option.prosperityChange));
      }
    }

    return { success: true, option };
  }

  /** 护卫自动处理事件 */
  autoResolveWithGuard(caravanId: string): TradeEventInstance[] {
    const resolved: TradeEventInstance[] = [];
    for (const event of this.activeEvents) {
      if (event.caravanId === caravanId && !event.resolved) {
        const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
        if (def?.guardCanAutoResolve) {
          event.resolved = true;
          event.chosenOptionId = 'auto_guard';
          resolved.push(event);
        }
      }
    }
    return resolved;
  }

  /** 获取活跃事件 */
  getActiveEvents(caravanId?: string): TradeEventInstance[] {
    if (caravanId) {
      return this.activeEvents.filter(e => e.caravanId === caravanId && !e.resolved);
    }
    return this.activeEvents.filter(e => !e.resolved);
  }

  // ─────────────────────────────────────────────
  // NPC商人 (TRD-3)
  // ─────────────────────────────────────────────

  /** 尝试生成NPC商人 */
  trySpawnNpcMerchants(): NpcMerchantInstance[] {
    const spawned: NpcMerchantInstance[] = [];
    const now = Date.now();

    for (const routeState of this.routeStates.values()) {
      if (!routeState.opened) continue;
      const tier = findProsperityTier(routeState.prosperity);
      if (!tier.unlockNpcMerchant) continue;

      // 找到该商路涉及的城市
      const routeDef = this.routeDefs.get(routeState.routeId);
      if (!routeDef) continue;

      for (const npcDef of NPC_MERCHANT_DEFS) {
        if (npcDef.requiredProsperity !== tier.level) continue;
        if (Math.random() > npcDef.appearanceChance) continue;

        const cityId = Math.random() > 0.5 ? routeDef.from : routeDef.to;
        const merchant: NpcMerchantInstance = {
          id: generateId(),
          defType: npcDef.type,
          cityId,
          appearedAt: now,
          duration: NPC_MERCHANT_DURATION,
          interacted: false,
        };
        this.npcMerchants.push(merchant);
        spawned.push(merchant);
      }
    }

    return spawned;
  }

  /** 获取当前NPC商人 */
  getActiveNpcMerchants(): NpcMerchantInstance[] {
    const now = Date.now();
    return this.npcMerchants.filter(m => now - m.appearedAt < m.duration);
  }

  /** 与NPC商人交互 */
  interactWithNpcMerchant(merchantId: string): boolean {
    const merchant = this.npcMerchants.find(m => m.id === merchantId);
    if (!merchant || merchant.interacted) return false;
    merchant.interacted = true;
    return true;
  }

  // ─────────────────────────────────────────────
  // 序列化
  // ─────────────────────────────────────────────

  serialize(): TradeSaveData {
    const routes: Record<string, TradeRouteState> = {};
    for (const [id, state] of this.routeStates) {
      routes[id] = { ...state };
    }
    const prices: Record<string, TradeGoodsPrice> = {};
    for (const [id, price] of this.goodsPrices) {
      prices[id] = { ...price };
    }
    return {
      routes,
      prices,
      caravans: [],
      activeEvents: this.activeEvents.map(e => ({ ...e })),
      npcMerchants: this.npcMerchants.map(m => ({ ...m })),
      version: TRADE_SAVE_VERSION,
    };
  }

  deserialize(data: TradeSaveData): void {
    if (data.version !== TRADE_SAVE_VERSION) {
      throw new Error(`[TradeSystem] 存档版本不匹配: ${data.version}`);
    }
    this.routeStates.clear();
    for (const [id, state] of Object.entries(data.routes)) {
      this.routeStates.set(id, { ...state });
    }
    this.goodsPrices.clear();
    for (const [id, price] of Object.entries(data.prices)) {
      this.goodsPrices.set(id, { ...price });
    }
    this.activeEvents = data.activeEvents.map(e => ({ ...e }));
    this.npcMerchants = data.npcMerchants.map(m => ({ ...m }));
  }
}
