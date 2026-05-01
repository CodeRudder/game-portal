/**
 * 贸易域 — 聚合根
 *
 * 职责：商路开通、价格波动、利润计算、繁荣度、贸易事件、NPC商人
 * 规则：可引用 trade-config 和 trade.types，通过回调访问 CurrencySystem
 */

import type {
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
  TRADE_ROUTE_DEFS,
  TRADE_GOODS_DEFS,
  PROSPERITY_GAIN_PER_TRADE,
  PROSPERITY_DECAY_RATE,
  TRADE_EVENT_DEFS,
  TRADE_SAVE_VERSION,
} from '../../core/trade/trade-config';
import type { ISubsystem, ISystemDeps } from '../../core/types';
import {
  createDefaultRouteState,
  createDefaultPrice,
  findProsperityTier,
  refreshSinglePrice,
  generateTradeEvents as doGenerateEvents,
  trySpawnNpcMerchants,
} from './trade-helpers';
import type { NpcSpawnContext } from './trade-helpers';

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
  readonly name = 'Trade' as const;
  private deps: ISystemDeps | null = null;

  private routeStates: Map<TradeRouteId, TradeRouteState>;
  private goodsPrices: Map<TradeGoodsId, TradeGoodsPrice>;
  private goodsDefs: Map<TradeGoodsId, TradeGoodsDef>;
  private routeDefs: Map<TradeRouteId, TradeRouteDef>;
  private activeEvents: TradeEventInstance[];
  private npcMerchants: NpcMerchantInstance[];
  private currencyOps: TradeCurrencyOps | null = null;

  constructor() {
    this.routeStates = new Map();
    this.goodsPrices = new Map();
    this.goodsDefs = new Map();
    this.routeDefs = new Map();
    this.activeEvents = [];
    this.npcMerchants = [];
    this.initData(Date.now());
  }

  private initData(now: number): void {
    this.routeStates.clear();
    this.goodsPrices.clear();
    for (const def of TRADE_ROUTE_DEFS) {
      this.routeDefs.set(def.id, def);
      this.routeStates.set(def.id, createDefaultRouteState(def.id));
    }
    for (const def of TRADE_GOODS_DEFS) {
      this.goodsDefs.set(def.id, def);
      this.goodsPrices.set(def.id, createDefaultPrice(def, now));
    }
  }

  // ── ISubsystem ──

  init(deps: ISystemDeps): void { this.deps = deps; }

  update(dt: number): void {
    for (const state of this.routeStates.values()) {
      if (state.opened && state.prosperity > 0) {
        state.prosperity = Math.max(0, state.prosperity - PROSPERITY_DECAY_RATE * dt);
      }
    }
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
    this.activeEvents = [];
    this.npcMerchants = [];
    this.initData(Date.now());
  }

  setCurrencyOps(ops: TradeCurrencyOps): void { this.currencyOps = ops; }

  // ─────────────────────────────────────────────
  // 商路开通
  // ─────────────────────────────────────────────

  getRouteDefs(): TradeRouteDef[] { return Array.from(this.routeDefs.values()); }

  getRouteState(routeId: TradeRouteId): TradeRouteState | undefined {
    return this.routeStates.get(routeId);
  }

  getAllRouteStates(): Map<TradeRouteId, TradeRouteState> { return new Map(this.routeStates); }

  canOpenRoute(routeId: TradeRouteId, castleLevel: number): { canOpen: boolean; reason?: string } {
    const def = this.routeDefs.get(routeId);
    if (!def) return { canOpen: false, reason: '商路不存在' };
    const state = this.routeStates.get(routeId);
    if (state?.opened) return { canOpen: false, reason: '商路已开通' };
    if (castleLevel < def.requiredCastleLevel) return { canOpen: false, reason: `需要主城${def.requiredCastleLevel}级` };
    if (def.requiredRoute) {
      const preState = this.routeStates.get(def.requiredRoute);
      if (!preState?.opened) return { canOpen: false, reason: '需要先开通前置商路' };
    }
    return { canOpen: true };
  }

  openRoute(routeId: TradeRouteId, castleLevel: number): { success: boolean; reason?: string } {
    const check = this.canOpenRoute(routeId, castleLevel);
    if (!check.canOpen) return { success: false, reason: check.reason };
    const def = this.routeDefs.get(routeId)!;
    if (this.currencyOps) {
      const totalCopper = Object.values(def.openCost).reduce((s, v) => s + v, 0);
      const result = this.currencyOps.spendByPriority('trade', totalCopper, 'copper');
      if (!result.success) return { success: false, reason: '货币不足' };
    }
    this.routeStates.get(routeId)!.opened = true;
    return { success: true };
  }

  // ─────────────────────────────────────────────
  // 价格波动
  // ─────────────────────────────────────────────

  refreshPrices(): void {
    const now = Date.now();
    for (const [goodsId, price] of this.goodsPrices) {
      const def = this.goodsDefs.get(goodsId);
      if (def) refreshSinglePrice(price, def, now);
    }
  }

  getPrice(goodsId: TradeGoodsId): number { return this.goodsPrices.get(goodsId)?.currentPrice ?? 0; }

  getAllPrices(): Map<TradeGoodsId, TradeGoodsPrice> { return new Map(this.goodsPrices); }

  getGoodsDef(goodsId: TradeGoodsId): TradeGoodsDef | undefined { return this.goodsDefs.get(goodsId); }

  getAllGoodsDefs(): TradeGoodsDef[] { return Array.from(this.goodsDefs.values()); }

  // ─────────────────────────────────────────────
  // 利润计算
  // ─────────────────────────────────────────────

  calculateProfit(
    routeId: TradeRouteId,
    cargo: Record<string, number>,
    bargainingPower: number,
    guardCost: number,
  ): TradeProfit {
    // FIX-804: NaN防护
    const safeBargainingPower = Number.isFinite(bargainingPower) && bargainingPower >= 0 ? bargainingPower : 1;
    const safeGuardCost = Number.isFinite(guardCost) && guardCost >= 0 ? guardCost : 0;

    const routeState = this.routeStates.get(routeId);
    const routeDef = this.routeDefs.get(routeId);
    if (!routeState || !routeDef) {
      return { revenue: 0, cost: 0, profit: 0, profitRate: 0, prosperityBonus: 0, bargainingBonus: 0, guardCost: 0 };
    }

    let totalCost = 0;
    let totalRevenue = 0;
    for (const [goodsId, quantity] of Object.entries(cargo)) {
      const price = this.goodsPrices.get(goodsId);
      const def = this.goodsDefs.get(goodsId);
      if (price && def && Number.isFinite(quantity) && quantity > 0) {
        totalCost += def.basePrice * quantity;
        totalRevenue += price.currentPrice * quantity;
      }
    }

    const tier = findProsperityTier(routeState.prosperity);
    const prosperityBonus = tier.outputMultiplier - 1;
    const bargainingBonus = safeBargainingPower - 1;
    const adjustedRevenue = totalRevenue * (1 + prosperityBonus) * (1 + bargainingBonus);
    const profit = adjustedRevenue - totalCost - safeGuardCost;
    const profitRate = totalCost > 0 ? profit / totalCost : 0;

    return {
      revenue: Math.floor(adjustedRevenue),
      cost: totalCost,
      profit: Math.floor(profit),
      profitRate,
      prosperityBonus,
      bargainingBonus,
      guardCost: safeGuardCost,
    };
  }

  completeTrade(routeId: TradeRouteId): void {
    const state = this.routeStates.get(routeId);
    if (state && state.opened) {
      state.completedTrades++;
      state.prosperity = Math.min(100, state.prosperity + PROSPERITY_GAIN_PER_TRADE);
    }
  }

  // ─────────────────────────────────────────────
  // 繁荣度
  // ─────────────────────────────────────────────

  getProsperityLevel(routeId: TradeRouteId): ProsperityLevel {
    return findProsperityTier(this.routeStates.get(routeId)?.prosperity ?? 0).level;
  }

  getProsperityMultiplier(routeId: TradeRouteId): number {
    return findProsperityTier(this.routeStates.get(routeId)?.prosperity ?? 0).outputMultiplier;
  }

  getProsperityTier(routeId: TradeRouteId): ProsperityTier {
    return findProsperityTier(this.routeStates.get(routeId)?.prosperity ?? 0);
  }

  // ─────────────────────────────────────────────
  // 贸易事件
  // ─────────────────────────────────────────────

  generateTradeEvents(caravanId: string, routeId: TradeRouteId): TradeEventInstance[] {
    const events = doGenerateEvents(caravanId, routeId);
    this.activeEvents.push(...events);
    return events;
  }

  resolveTradeEvent(eventId: string, optionId: string): { success: boolean; option?: TradeEventOption } {
    const event = this.activeEvents.find(e => e.id === eventId);
    if (!event) return { success: false };
    const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
    if (!def) return { success: false };
    const option = def.options.find(o => o.id === optionId);
    if (!option) return { success: false };

    event.resolved = true;
    event.chosenOptionId = optionId;

    if (option.prosperityChange !== 0) {
      const state = this.routeStates.get(event.routeId);
      if (state) {
        state.prosperity = Math.max(0, Math.min(100, state.prosperity + option.prosperityChange));
      }
    }
    return { success: true, option };
  }

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

  getActiveEvents(caravanId?: string): TradeEventInstance[] {
    const base = this.activeEvents.filter(e => !e.resolved);
    return caravanId ? base.filter(e => e.caravanId === caravanId) : base;
  }

  // ─────────────────────────────────────────────
  // NPC商人
  // ─────────────────────────────────────────────

  trySpawnNpcMerchants(): NpcMerchantInstance[] {
    const ctx: NpcSpawnContext = {
      routeStates: this.routeStates,
      routeDefs: new Map(Array.from(this.routeDefs.entries()).map(([id, d]) => [id, { from: d.from, to: d.to }])),
    };
    const spawned = trySpawnNpcMerchants(ctx);
    this.npcMerchants.push(...spawned);
    return spawned;
  }

  getActiveNpcMerchants(): NpcMerchantInstance[] {
    const now = Date.now();
    return this.npcMerchants.filter(m => now - m.appearedAt < m.duration);
  }

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
    for (const [id, state] of this.routeStates) routes[id] = { ...state };
    const prices: Record<string, TradeGoodsPrice> = {};
    for (const [id, price] of this.goodsPrices) prices[id] = { ...price };
    return {
      routes, prices,
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
    for (const [id, state] of Object.entries(data.routes)) this.routeStates.set(id, { ...state });
    this.goodsPrices.clear();
    for (const [id, price] of Object.entries(data.prices)) this.goodsPrices.set(id, { ...price });
    this.activeEvents = data.activeEvents.map(e => ({ ...e }));
    this.npcMerchants = data.npcMerchants.map(m => ({ ...m }));
  }
}
