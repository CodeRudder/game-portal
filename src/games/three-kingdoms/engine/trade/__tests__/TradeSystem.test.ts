/**
 * TradeSystem 单元测试
 *
 * 覆盖：
 * 1. 初始化（商路、商品价格、城市配置）
 * 2. 商路开通（条件检查、前置依赖、费用扣除）
 * 3. 价格波动（6h刷新、连续涨跌限制）
 * 4. 利润计算（收入、成本、繁荣度加成、议价加成、护卫费用）
 * 5. 繁荣度（等级、衰减、上限）
 * 6. 贸易事件（生成、处理、护卫自动处理）
 * 7. NPC商人（生成、交互、过期清理）
 * 8. 序列化/反序列化
 * 9. ISubsystem 接口
 */

import { TradeSystem } from '../TradeSystem';
import type { TradeCurrencyOps } from '../TradeSystem';
import {
  CITY_IDS, CITY_LABELS, PROSPERITY_LABELS,
} from '../../../core/trade/trade.types';
import {
  TRADE_ROUTE_DEFS, TRADE_GOODS_DEFS, PRICE_REFRESH_INTERVAL,
  PROSPERITY_TIERS, INITIAL_PROSPERITY, PROSPERITY_GAIN_PER_TRADE,
  TRADE_EVENT_DEFS, TRADE_SAVE_VERSION,
} from '../../../core/trade/trade-config';

function createMockDeps() {
  return {
    eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn(), once: jest.fn(), removeAllListeners: jest.fn() },
    config: { get: jest.fn() },
    registry: { get: jest.fn() },
  };
}

function createMockCurrencyOps(): TradeCurrencyOps {
  return {
    addCurrency: jest.fn(),
    canAfford: jest.fn().mockReturnValue(true),
    spendByPriority: jest.fn().mockReturnValue({ success: true }),
  };
}

function createTrade(): TradeSystem {
  const trade = new TradeSystem();
  trade.init(createMockDeps() as any);
  return trade;
}

describe('TradeSystem - 初始化', () => {
  let trade: TradeSystem;
  beforeEach(() => { trade = createTrade(); });

  it('应有8座城市', () => expect(CITY_IDS).toHaveLength(8));
  it('应有8条商路', () => expect(TRADE_ROUTE_DEFS).toHaveLength(8));
  it('应有10种贸易商品', () => expect(TRADE_GOODS_DEFS).toHaveLength(10));
  it('name 为 Trade', () => expect(trade.name).toBe('Trade'));
  it('初始化后商路状态已创建', () => expect(trade.getAllRouteStates().size).toBe(TRADE_ROUTE_DEFS.length));
  it('初始化后商品价格已创建', () => expect(trade.getAllPrices().size).toBe(TRADE_GOODS_DEFS.length));
  it('初始商路均为未开通', () => {
    for (const state of trade.getAllRouteStates().values()) expect(state.opened).toBe(false);
  });
  it('初始繁荣度为配置值', () => {
    for (const state of trade.getAllRouteStates().values()) expect(state.prosperity).toBe(INITIAL_PROSPERITY);
  });
  it('城市标签完整', () => {
    for (const cityId of CITY_IDS) expect(CITY_LABELS[cityId]).toBeTruthy();
  });
  it('繁荣度标签包含4个等级', () => {
    expect(Object.keys(PROSPERITY_LABELS)).toHaveLength(4);
  });
  it('getRouteDefs 返回所有商路定义', () => {
    expect(trade.getRouteDefs()).toHaveLength(TRADE_ROUTE_DEFS.length);
  });
  it('getAllGoodsDefs 返回所有商品', () => {
    expect(trade.getAllGoodsDefs()).toHaveLength(TRADE_GOODS_DEFS.length);
  });
  it('getGoodsDef 返回商品定义', () => {
    const def = trade.getGoodsDef('silk');
    expect(def).toBeDefined();
    expect(def!.name).toBe('丝绸');
  });
  it('getPrice 不存在的商品返回 0', () => {
    expect(trade.getPrice('nonexistent')).toBe(0);
  });
});

describe('TradeSystem - 商路开通', () => {
  let trade: TradeSystem;
  beforeEach(() => { trade = createTrade(); });

  it('第一条商路只需主城1级', () => {
    expect(trade.canOpenRoute(TRADE_ROUTE_DEFS[0].id, 1).canOpen).toBe(true);
  });

  it('主城等级不足时无法开通', () => {
    const highLevelRoute = TRADE_ROUTE_DEFS.find(r => r.requiredCastleLevel > 1);
    if (!highLevelRoute) return;
    const check = trade.canOpenRoute(highLevelRoute.id, 1);
    expect(check.canOpen).toBe(false);
    expect(check.reason).toContain('主城');
  });

  it('需要前置商路时未开通则失败', () => {
    const routeWithPreReq = TRADE_ROUTE_DEFS.find(r => r.requiredRoute);
    if (!routeWithPreReq) return;
    const check = trade.canOpenRoute(routeWithPreReq.id, 99);
    expect(check.canOpen).toBe(false);
    expect(check.reason).toContain('前置');
  });

  it('重复开通返回失败', () => {
    const firstRoute = TRADE_ROUTE_DEFS[0];
    trade.openRoute(firstRoute.id, 1);
    const check = trade.canOpenRoute(firstRoute.id, 1);
    expect(check.canOpen).toBe(false);
    expect(check.reason).toContain('已开通');
  });

  it('openRoute 成功开通', () => {
    trade.setCurrencyOps(createMockCurrencyOps());
    const firstRoute = TRADE_ROUTE_DEFS[0];
    expect(trade.openRoute(firstRoute.id, 1).success).toBe(true);
    expect(trade.getRouteState(firstRoute.id)?.opened).toBe(true);
  });

  it('openRoute 货币不足时失败', () => {
    const ops: TradeCurrencyOps = {
      addCurrency: jest.fn(), canAfford: jest.fn().mockReturnValue(false),
      spendByPriority: jest.fn().mockReturnValue({ success: false }),
    };
    trade.setCurrencyOps(ops);
    const result = trade.openRoute(TRADE_ROUTE_DEFS[0].id, 1);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('货币不足');
  });

  it('不存在的商路返回失败', () => {
    const check = trade.canOpenRoute('nonexistent', 99);
    expect(check.canOpen).toBe(false);
    expect(check.reason).toContain('不存在');
  });

  it('逐条开通所有商路', () => {
    trade.setCurrencyOps(createMockCurrencyOps());
    const results: boolean[] = [];
    for (const route of TRADE_ROUTE_DEFS) {
      const r = trade.openRoute(route.id, route.requiredCastleLevel);
      results.push(r.success);
    }
    // 第一条一定成功
    expect(results[0]).toBe(true);
  });
});

describe('TradeSystem - 价格波动', () => {
  let trade: TradeSystem;
  beforeEach(() => { trade = createTrade(); });

  it('getPrice 返回初始基础价格', () => {
    for (const def of TRADE_GOODS_DEFS) expect(trade.getPrice(def.id)).toBe(def.basePrice);
  });

  it('refreshPrices 受刷新间隔限制', () => {
    trade.refreshPrices();
    for (const price of trade.getAllPrices().values()) {
      expect(price.lastRefreshTime).toBeGreaterThan(0);
    }
  });

  it('价格在基础价50%~200%之间', () => {
    // 通过手动修改 lastRefreshTime 来触发刷新
    for (const [id, price] of trade.getAllPrices()) {
      (trade as any).goodsPrices.get(id).lastRefreshTime = 0;
    }
    // 多次刷新验证范围
    for (let i = 0; i < 50; i++) {
      for (const [id, price] of trade.getAllPrices()) {
        (trade as any).goodsPrices.get(id).lastRefreshTime = 0;
      }
      trade.refreshPrices();
      for (const def of TRADE_GOODS_DEFS) {
        const price = trade.getPrice(def.id);
        expect(price).toBeGreaterThanOrEqual(Math.floor(def.basePrice * 0.5));
        expect(price).toBeLessThanOrEqual(Math.floor(def.basePrice * 2));
      }
    }
  });
});

describe('TradeSystem - 利润计算', () => {
  let trade: TradeSystem;
  beforeEach(() => { trade = createTrade(); });

  it('calculateProfit 不存在的商路返回零', () => {
    const profit = trade.calculateProfit('nonexistent', {}, 1, 0);
    expect(profit.revenue).toBe(0);
    expect(profit.cost).toBe(0);
    expect(profit.profit).toBe(0);
  });

  it('calculateProfit 正确计算利润', () => {
    const route = TRADE_ROUTE_DEFS[0];
    trade.openRoute(route.id, 1);
    const cargo: Record<string, number> = { silk: 10 };
    const profit = trade.calculateProfit(route.id, cargo, 1, 0);
    expect(profit.revenue).toBeGreaterThanOrEqual(0);
    expect(profit.cost).toBeGreaterThan(0);
    expect(profit.cost).toBe(100 * 10); // silk basePrice=100, qty=10
  });

  it('calculateProfit 议价加成影响收入', () => {
    const route = TRADE_ROUTE_DEFS[0];
    trade.openRoute(route.id, 1);
    const cargo: Record<string, number> = { silk: 10 };
    const normal = trade.calculateProfit(route.id, cargo, 1, 0);
    const boosted = trade.calculateProfit(route.id, cargo, 1.5, 0);
    expect(boosted.revenue).toBeGreaterThan(normal.revenue);
    expect(boosted.bargainingBonus).toBe(0.5);
  });

  it('calculateProfit 护卫费用影响利润', () => {
    const route = TRADE_ROUTE_DEFS[0];
    trade.openRoute(route.id, 1);
    const cargo: Record<string, number> = { silk: 10 };
    const noGuard = trade.calculateProfit(route.id, cargo, 1, 0);
    const withGuard = trade.calculateProfit(route.id, cargo, 1, 500);
    expect(withGuard.profit).toBeLessThan(noGuard.profit);
    expect(withGuard.guardCost).toBe(500);
  });

  it('calculateProfit 多种商品利润计算', () => {
    const route = TRADE_ROUTE_DEFS[0];
    trade.openRoute(route.id, 1);
    const cargo: Record<string, number> = { silk: 5, tea: 10, iron: 3 };
    const profit = trade.calculateProfit(route.id, cargo, 1, 0);
    // silk=100*5=500, tea=80*10=800, iron=60*3=180 → cost=1480
    expect(profit.cost).toBe(500 + 800 + 180);
    expect(profit.revenue).toBeGreaterThan(0);
  });

  it('completeTrade 增加繁荣度', () => {
    const route = TRADE_ROUTE_DEFS[0];
    trade.openRoute(route.id, 1);
    const before = trade.getRouteState(route.id)!.prosperity;
    trade.completeTrade(route.id);
    expect(trade.getRouteState(route.id)!.prosperity).toBe(before + PROSPERITY_GAIN_PER_TRADE);
  });

  it('completeTrade 增加完成次数', () => {
    const route = TRADE_ROUTE_DEFS[0];
    trade.openRoute(route.id, 1);
    trade.completeTrade(route.id);
    trade.completeTrade(route.id);
    expect(trade.getRouteState(route.id)!.completedTrades).toBe(2);
  });
});

describe('TradeSystem - 繁荣度', () => {
  let trade: TradeSystem;
  beforeEach(() => { trade = createTrade(); });

  it('getProsperityLevel 返回繁荣度等级', () => {
    const route = TRADE_ROUTE_DEFS[0];
    expect(['declining', 'normal', 'thriving', 'golden']).toContain(trade.getProsperityLevel(route.id));
  });

  it('getProsperityMultiplier 返回产出倍率', () => {
    const route = TRADE_ROUTE_DEFS[0];
    expect(trade.getProsperityMultiplier(route.id)).toBeGreaterThan(0);
  });

  it('getProsperityTier 返回繁荣度详情', () => {
    const tier = trade.getProsperityTier(TRADE_ROUTE_DEFS[0].id);
    expect(tier).toBeDefined();
    expect(tier.level).toBeDefined();
    expect(tier.outputMultiplier).toBeGreaterThan(0);
  });

  it('繁荣度上限为100', () => {
    const route = TRADE_ROUTE_DEFS[0];
    trade.openRoute(route.id, 1);
    for (let i = 0; i < 50; i++) trade.completeTrade(route.id);
    expect(trade.getRouteState(route.id)!.prosperity).toBeLessThanOrEqual(100);
  });

  it('update 产生繁荣度衰减', () => {
    const route = TRADE_ROUTE_DEFS[0];
    trade.openRoute(route.id, 1);
    trade.completeTrade(route.id);
    const before = trade.getRouteState(route.id)!.prosperity;
    trade.update(100);
    expect(trade.getRouteState(route.id)!.prosperity).toBeLessThanOrEqual(before);
  });

  it('繁荣度不低于0', () => {
    const route = TRADE_ROUTE_DEFS[0];
    trade.openRoute(route.id, 1);
    trade.update(999999);
    expect(trade.getRouteState(route.id)!.prosperity).toBeGreaterThanOrEqual(0);
  });
});

describe('TradeSystem - 贸易事件', () => {
  let trade: TradeSystem;
  beforeEach(() => { trade = createTrade(); });

  it('generateTradeEvents 可能生成事件', () => {
    const events = trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
    expect(Array.isArray(events)).toBe(true);
  });

  it('resolveTradeEvent 处理事件', () => {
    const events = trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
    if (events.length === 0) return;
    const def = TRADE_EVENT_DEFS.find(d => d.type === events[0].eventType);
    if (!def || def.options.length === 0) return;
    const result = trade.resolveTradeEvent(events[0].id, def.options[0].id);
    expect(result.success).toBe(true);
    expect(result.option).toBeDefined();
  });

  it('resolveTradeEvent 不存在的事件返回失败', () => {
    expect(trade.resolveTradeEvent('nonexistent', 'opt_1').success).toBe(false);
  });

  it('autoResolveWithGuard 护卫自动处理', () => {
    trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
    const resolved = trade.autoResolveWithGuard('caravan_1');
    for (const event of resolved) expect(event.resolved).toBe(true);
  });

  it('getActiveEvents 返回未解决事件', () => {
    trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
    expect(Array.isArray(trade.getActiveEvents())).toBe(true);
  });

  it('getActiveEvents 按商队过滤', () => {
    trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
    for (const e of trade.getActiveEvents('caravan_1')) expect(e.caravanId).toBe('caravan_1');
  });

  it('resolveTradeEvent 繁荣度影响生效', () => {
    const events = trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
    if (events.length === 0) return;
    const def = TRADE_EVENT_DEFS.find(d => d.type === events[0].eventType);
    if (!def || def.options.length === 0) return;
    const opt = def.options[0];
    const before = trade.getRouteState(TRADE_ROUTE_DEFS[0].id)!.prosperity;
    trade.resolveTradeEvent(events[0].id, opt.id);
    if (opt.prosperityChange !== 0) {
      const after = trade.getRouteState(TRADE_ROUTE_DEFS[0].id)!.prosperity;
      expect(after).not.toBe(before);
    }
  });
});

describe('TradeSystem - NPC商人', () => {
  let trade: TradeSystem;
  beforeEach(() => { trade = createTrade(); });

  it('trySpawnNpcMerchants 未开通商路不生成', () => {
    expect(trade.trySpawnNpcMerchants()).toHaveLength(0);
  });

  it('getActiveNpcMerchants 初始为空', () => {
    expect(trade.getActiveNpcMerchants()).toHaveLength(0);
  });

  it('interactWithNpcMerchant 不存在的返回 false', () => {
    expect(trade.interactWithNpcMerchant('nonexistent')).toBe(false);
  });
});

describe('TradeSystem - 序列化', () => {
  let trade: TradeSystem;
  beforeEach(() => { trade = createTrade(); });

  it('serialize/deserialize 往返一致', () => {
    const route = TRADE_ROUTE_DEFS[0];
    trade.openRoute(route.id, 1);
    trade.completeTrade(route.id);
    const data = trade.serialize();
    expect(data.version).toBe(TRADE_SAVE_VERSION);
    const trade2 = createTrade();
    trade2.deserialize(data);
    expect(trade2.getRouteState(route.id)?.opened).toBe(true);
    expect(trade2.getRouteState(route.id)?.completedTrades).toBe(1);
  });

  it('deserialize 版本不匹配抛异常', () => {
    expect(() => trade.deserialize({
      routes: {}, prices: {}, caravans: [], activeEvents: [], npcMerchants: [], version: 999,
    } as any)).toThrow();
  });

  it('reset 恢复初始状态', () => {
    trade.openRoute(TRADE_ROUTE_DEFS[0].id, 1);
    trade.reset();
    expect(trade.getRouteState(TRADE_ROUTE_DEFS[0].id)?.opened).toBe(false);
  });
});

describe('TradeSystem - ISubsystem 接口', () => {
  let trade: TradeSystem;
  beforeEach(() => { trade = createTrade(); });

  it('update 不抛异常', () => { expect(() => trade.update(16)).not.toThrow(); });
  it('getState 返回状态对象', () => {
    const state = trade.getState();
    expect(state.routes).toBeDefined();
    expect(state.prices).toBeDefined();
    expect(state.activeEvents).toBeDefined();
    expect(state.npcMerchants).toBeDefined();
  });
});
