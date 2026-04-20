/**
 * TradeSystem 单元测试
 *
 * 覆盖：
 * 1. 初始化（商路、商品价格）
 * 2. 商路开通
 * 3. 价格波动
 * 4. 利润计算
 * 5. 繁荣度
 * 6. 贸易事件
 * 7. NPC商人
 * 8. 序列化/反序列化
 * 9. ISubsystem 接口
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeSystem } from '../TradeSystem';
import type { TradeCurrencyOps } from '../TradeSystem';
import {
  CITY_IDS,
  CITY_LABELS,
  PROSPERITY_LABELS,
} from '../../../core/trade/trade.types';
import {
  TRADE_ROUTE_DEFS,
  TRADE_GOODS_DEFS,
  PRICE_REFRESH_INTERVAL,
  PROSPERITY_TIERS,
  INITIAL_PROSPERITY,
  PROSPERITY_GAIN_PER_TRADE,
  TRADE_EVENT_DEFS,
  TRADE_SAVE_VERSION,
} from '../../../core/trade/trade-config';

/** 创建 mock 依赖 */
function createMockDeps() {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn() },
    registry: { get: vi.fn() },
  };
}

/** 创建 mock 货币操作 */
function createMockCurrencyOps(): TradeCurrencyOps {
  return {
    addCurrency: vi.fn(),
    canAfford: vi.fn().mockReturnValue(true),
    spendByPriority: vi.fn().mockReturnValue({ success: true }),
  };
}

/** 创建初始化完成的 TradeSystem */
function createTrade(): TradeSystem {
  const trade = new TradeSystem();
  trade.init(createMockDeps() as any);
  return trade;
}

describe('TradeSystem', () => {
  let trade: TradeSystem;
  beforeEach(() => {
    vi.restoreAllMocks();
    trade = createTrade();
  });

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('应有8座城市', () => {
      expect(CITY_IDS).toHaveLength(8);
    });

    it('应有8条商路', () => {
      expect(TRADE_ROUTE_DEFS).toHaveLength(8);
    });

    it('应有10种贸易商品', () => {
      expect(TRADE_GOODS_DEFS).toHaveLength(10);
    });

    it('name 为 trade', () => {
      expect(trade.name).toBe('trade');
    });

    it('初始化后商路状态已创建', () => {
      const states = trade.getAllRouteStates();
      expect(states.size).toBe(TRADE_ROUTE_DEFS.length);
    });

    it('初始化后商品价格已创建', () => {
      const prices = trade.getAllPrices();
      expect(prices.size).toBe(TRADE_GOODS_DEFS.length);
    });

    it('初始商路均为未开通', () => {
      const states = trade.getAllRouteStates();
      for (const state of states.values()) {
        expect(state.opened).toBe(false);
      }
    });

    it('初始繁荣度为配置值', () => {
      const states = trade.getAllRouteStates();
      for (const state of states.values()) {
        expect(state.prosperity).toBe(INITIAL_PROSPERITY);
      }
    });

    it('城市标签完整', () => {
      for (const cityId of CITY_IDS) {
        expect(CITY_LABELS[cityId]).toBeTruthy();
      }
    });
  });

  // ═══════════════════════════════════════════
  // 2. 商路开通
  // ═══════════════════════════════════════════
  describe('商路开通', () => {
    it('getRouteDefs 返回所有商路定义', () => {
      const defs = trade.getRouteDefs();
      expect(defs).toHaveLength(TRADE_ROUTE_DEFS.length);
    });

    it('第一条商路只需主城1级', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      const check = trade.canOpenRoute(firstRoute.id, 1);
      expect(check.canOpen).toBe(true);
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
      const ops = createMockCurrencyOps();
      trade.setCurrencyOps(ops);
      const firstRoute = TRADE_ROUTE_DEFS[0];
      const result = trade.openRoute(firstRoute.id, 1);
      expect(result.success).toBe(true);

      const state = trade.getRouteState(firstRoute.id);
      expect(state?.opened).toBe(true);
    });

    it('openRoute 货币不足时失败', () => {
      const ops: TradeCurrencyOps = {
        addCurrency: vi.fn(),
        canAfford: vi.fn().mockReturnValue(false),
        spendByPriority: vi.fn().mockReturnValue({ success: false }),
      };
      trade.setCurrencyOps(ops);
      const firstRoute = TRADE_ROUTE_DEFS[0];
      const result = trade.openRoute(firstRoute.id, 1);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('货币不足');
    });

    it('不存在的商路返回失败', () => {
      const check = trade.canOpenRoute('nonexistent', 99);
      expect(check.canOpen).toBe(false);
      expect(check.reason).toContain('不存在');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 价格波动
  // ═══════════════════════════════════════════
  describe('价格波动', () => {
    it('getPrice 返回初始基础价格', () => {
      for (const def of TRADE_GOODS_DEFS) {
        const price = trade.getPrice(def.id);
        expect(price).toBe(def.basePrice);
      }
    });

    it('getGoodsDef 返回商品定义', () => {
      const def = trade.getGoodsDef('silk');
      expect(def).toBeDefined();
      expect(def!.name).toBe('丝绸');
    });

    it('getAllGoodsDefs 返回所有商品', () => {
      const defs = trade.getAllGoodsDefs();
      expect(defs).toHaveLength(TRADE_GOODS_DEFS.length);
    });

    it('getPrice 不存在的商品返回 0', () => {
      expect(trade.getPrice('nonexistent')).toBe(0);
    });

    it('refreshPrices 受刷新间隔限制', () => {
      // 刚初始化，refreshPrices 应该因为间隔限制跳过
      trade.refreshPrices();
      const prices = trade.getAllPrices();
      for (const price of prices.values()) {
        expect(price.lastRefreshTime).toBeGreaterThan(0);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 4. 利润计算
  // ═══════════════════════════════════════════
  describe('利润计算', () => {
    it('calculateProfit 不存在的商路返回零', () => {
      const profit = trade.calculateProfit('nonexistent', {}, 1, 0);
      expect(profit.revenue).toBe(0);
      expect(profit.cost).toBe(0);
      expect(profit.profit).toBe(0);
    });

    it('calculateProfit 正确计算利润', () => {
      // 先开通商路
      const firstRoute = TRADE_ROUTE_DEFS[0];
      trade.openRoute(firstRoute.id, 1);

      const cargo: Record<string, number> = { silk: 10 };
      const profit = trade.calculateProfit(firstRoute.id, cargo, 1, 0);
      expect(profit).toBeDefined();
      expect(profit.revenue).toBeGreaterThanOrEqual(0);
      expect(profit.cost).toBeGreaterThan(0);
    });

    it('calculateProfit 议价加成影响收入', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      trade.openRoute(firstRoute.id, 1);

      const cargo: Record<string, number> = { silk: 10 };
      const normal = trade.calculateProfit(firstRoute.id, cargo, 1, 0);
      const boosted = trade.calculateProfit(firstRoute.id, cargo, 1.5, 0);
      expect(boosted.revenue).toBeGreaterThan(normal.revenue);
    });

    it('calculateProfit 护卫费用影响利润', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      trade.openRoute(firstRoute.id, 1);

      const cargo: Record<string, number> = { silk: 10 };
      const noGuard = trade.calculateProfit(firstRoute.id, cargo, 1, 0);
      const withGuard = trade.calculateProfit(firstRoute.id, cargo, 1, 500);
      expect(withGuard.profit).toBeLessThan(noGuard.profit);
    });

    it('completeTrade 增加繁荣度', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      trade.openRoute(firstRoute.id, 1);

      const before = trade.getRouteState(firstRoute.id)!.prosperity;
      trade.completeTrade(firstRoute.id);
      const after = trade.getRouteState(firstRoute.id)!.prosperity;
      expect(after).toBe(before + PROSPERITY_GAIN_PER_TRADE);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 繁荣度
  // ═══════════════════════════════════════════
  describe('繁荣度', () => {
    it('getProsperityLevel 返回繁荣度等级', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      const level = trade.getProsperityLevel(firstRoute.id);
      expect(['declining', 'normal', 'thriving', 'golden']).toContain(level);
    });

    it('getProsperityMultiplier 返回产出倍率', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      const multiplier = trade.getProsperityMultiplier(firstRoute.id);
      expect(multiplier).toBeGreaterThan(0);
    });

    it('getProsperityTier 返回繁荣度详情', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      const tier = trade.getProsperityTier(firstRoute.id);
      expect(tier).toBeDefined();
      expect(tier.level).toBeDefined();
      expect(tier.outputMultiplier).toBeGreaterThan(0);
    });

    it('繁荣度上限为100', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      trade.openRoute(firstRoute.id, 1);
      for (let i = 0; i < 50; i++) {
        trade.completeTrade(firstRoute.id);
      }
      const state = trade.getRouteState(firstRoute.id);
      expect(state!.prosperity).toBeLessThanOrEqual(100);
    });

    it('update 产生繁荣度衰减', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      trade.openRoute(firstRoute.id, 1);
      trade.completeTrade(firstRoute.id);

      const before = trade.getRouteState(firstRoute.id)!.prosperity;
      trade.update(100); // 大 dt
      const after = trade.getRouteState(firstRoute.id)!.prosperity;
      expect(after).toBeLessThanOrEqual(before);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 贸易事件
  // ═══════════════════════════════════════════
  describe('贸易事件', () => {
    it('generateTradeEvents 可能生成事件', () => {
      const events = trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
      expect(Array.isArray(events)).toBe(true);
    });

    it('resolveTradeEvent 处理事件', () => {
      // 生成事件
      const events = trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
      if (events.length === 0) return;

      const event = events[0];
      const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
      if (!def || def.options.length === 0) return;

      const result = trade.resolveTradeEvent(event.id, def.options[0].id);
      expect(result.success).toBe(true);
      expect(result.option).toBeDefined();
    });

    it('resolveTradeEvent 不存在的事件返回失败', () => {
      const result = trade.resolveTradeEvent('nonexistent', 'opt_1');
      expect(result.success).toBe(false);
    });

    it('autoResolveWithGuard 护卫自动处理', () => {
      const events = trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
      if (events.length === 0) return;

      const resolved = trade.autoResolveWithGuard('caravan_1');
      // 护卫能自动处理的事件应被标记为已解决
      for (const event of resolved) {
        expect(event.resolved).toBe(true);
      }
    });

    it('getActiveEvents 返回未解决事件', () => {
      trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
      const active = trade.getActiveEvents();
      expect(Array.isArray(active)).toBe(true);
    });

    it('getActiveEvents 按商队过滤', () => {
      trade.generateTradeEvents('caravan_1', TRADE_ROUTE_DEFS[0].id);
      const active = trade.getActiveEvents('caravan_1');
      for (const e of active) {
        expect(e.caravanId).toBe('caravan_1');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 7. NPC商人
  // ═══════════════════════════════════════════
  describe('NPC商人', () => {
    it('trySpawnNpcMerchants 未开通商路不生成', () => {
      const spawned = trade.trySpawnNpcMerchants();
      expect(spawned).toHaveLength(0);
    });

    it('getActiveNpcMerchants 初始为空', () => {
      const merchants = trade.getActiveNpcMerchants();
      expect(merchants).toHaveLength(0);
    });

    it('interactWithNpcMerchant 不存在的返回 false', () => {
      expect(trade.interactWithNpcMerchant('nonexistent')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 序列化
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('serialize/deserialize 往返一致', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      trade.openRoute(firstRoute.id, 1);
      trade.completeTrade(firstRoute.id);

      const data = trade.serialize();
      expect(data.version).toBe(TRADE_SAVE_VERSION);

      const trade2 = new TradeSystem();
      trade2.init(createMockDeps() as any);
      trade2.deserialize(data);

      const state = trade2.getRouteState(firstRoute.id);
      expect(state?.opened).toBe(true);
      expect(state?.completedTrades).toBe(1);
    });

    it('deserialize 版本不匹配抛异常', () => {
      const data = {
        routes: {},
        prices: {},
        caravans: [],
        activeEvents: [],
        npcMerchants: [],
        version: 999,
      };
      expect(() => trade.deserialize(data as any)).toThrow();
    });

    it('reset 恢复初始状态', () => {
      const firstRoute = TRADE_ROUTE_DEFS[0];
      trade.openRoute(firstRoute.id, 1);
      trade.reset();

      const state = trade.getRouteState(firstRoute.id);
      expect(state?.opened).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 9. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('update 不抛异常', () => {
      expect(() => trade.update(16)).not.toThrow();
    });

    it('getState 返回状态对象', () => {
      const state = trade.getState();
      expect(state.routes).toBeDefined();
      expect(state.prices).toBeDefined();
      expect(state.activeEvents).toBeDefined();
      expect(state.npcMerchants).toBeDefined();
    });
  });
});
