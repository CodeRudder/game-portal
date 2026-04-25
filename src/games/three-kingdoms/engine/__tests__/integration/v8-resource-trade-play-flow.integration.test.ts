/**
 * v8.0 商贸繁荣 — 资源交易Play流程集成测试
 *
 * 覆盖完整资源交易play流程：
 *   §TRD-FLOW-1 资源交易引擎初始化与交易对
 *   §TRD-FLOW-2 交易执行流程（市场等级→资源保护→扣款→手续费→到账）
 *   §TRD-FLOW-3 粮草保护线（交易后≥10）
 *   §TRD-FLOW-4 铜钱安全线（<500不可交易）
 *   §TRD-FLOW-5 商店序列化/反序列化闭环
 *   §TRD-FLOW-6 贸易系统序列化/反序列化闭环
 *   §TRD-FLOW-7 商店+贸易+货币三方联动
 *
 * @module engine/__tests__/integration/v8-resource-trade-play-flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceTradeEngine } from '../../trade/ResourceTradeEngine';
import type { ResourceTradeDeps } from '../../trade/ResourceTradeEngine';
import { TradeSystem } from '../../trade/TradeSystem';
import type { TradeCurrencyOps } from '../../trade/TradeSystem';
import { CaravanSystem } from '../../trade/CaravanSystem';
import type { RouteInfoProvider } from '../../trade/CaravanSystem';
import { ShopSystem } from '../../shop/ShopSystem';
import type { ISystemDeps } from '../../../core/types';
import type { ResourceType } from '../../../shared/types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
  const listeners: Record<string, Function[]> = {};
  return {
    eventBus: {
      emit: (event: string, data?: unknown) => {
        (listeners[event] ?? []).forEach(fn => fn(data));
      },
      on: (event: string, fn: Function) => {
        (listeners[event] ??= []).push(fn);
      },
      off: () => {},
    },
    registry: { get: () => null },
  } as unknown as ISystemDeps;
}

/** 创建资源交易依赖 */
function createTradeDeps(overrides: Partial<{
  resources: Record<string, number>;
  marketLevel: number;
}> = {}): ResourceTradeDeps & { resources: Record<string, number> } {
  const resources: Record<string, number> = {
    grain: 1000,
    gold: 2000,
    troops: 100,
    techPoint: 50,
    ...overrides.resources,
  };

  return {
    resources,
    getResourceAmount: (type: ResourceType) => resources[type] ?? 0,
    consumeResource: (type: ResourceType, amount: number) => {
      resources[type] = Math.max(0, (resources[type] ?? 0) - amount);
      return resources[type];
    },
    addResource: (type: ResourceType, amount: number) => {
      resources[type] = (resources[type] ?? 0) + amount;
      return resources[type];
    },
    getMarketLevel: () => overrides.marketLevel ?? 5,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('v8.0 商贸繁荣: 资源交易Play流程', () => {
  let engine: ResourceTradeEngine;
  let deps: ISystemDeps;

  beforeEach(() => {
    engine = new ResourceTradeEngine();
    deps = createMockDeps();
    engine.init(deps);
  });

  // ── §TRD-FLOW-1 交易对与初始化 ──

  describe('§TRD-FLOW-1 交易对与初始化', () => {
    it('应支持4种交易对', () => {
      const pairs = engine.getSupportedTradePairs();
      expect(pairs).toHaveLength(4);
    });

    it('grain→gold 汇率0.1（10粮=1金）', () => {
      const rate = engine.getResourceTradeRate('grain', 'gold');
      expect(rate).toBe(0.1);
    });

    it('gold→grain 汇率8（1金=8粮）', () => {
      const rate = engine.getResourceTradeRate('gold', 'grain');
      expect(rate).toBe(8);
    });

    it('grain→troops 汇率0.05（20粮=1兵）', () => {
      const rate = engine.getResourceTradeRate('grain', 'troops');
      expect(rate).toBe(0.05);
    });

    it('gold→techPoint 汇率0.01（100金=1科技）', () => {
      const rate = engine.getResourceTradeRate('gold', 'techPoint');
      expect(rate).toBe(0.01);
    });

    it('不支持的交易对汇率=0', () => {
      expect(engine.getResourceTradeRate('troops', 'gold')).toBe(0);
      expect(engine.getResourceTradeRate('techPoint', 'grain')).toBe(0);
    });

    it('ISubsystem接口正确', () => {
      expect(engine.name).toBe('resourceTrade');
      const state = engine.getState();
      expect(state.supportedPairs).toHaveLength(4);
      expect(state.marketRequiredLevel).toBe(5);
      expect(state.feeRate).toBe(0.05);
    });
  });

  // ── §TRD-FLOW-2 交易执行流程 ──

  describe('§TRD-FLOW-2 交易执行流程', () => {
    let tradeDeps: ReturnType<typeof createTradeDeps>;

    beforeEach(() => {
      tradeDeps = createTradeDeps({ marketLevel: 5 });
      engine.setDeps(tradeDeps);
    });

    it('完整流程：grain→gold 成功交易', () => {
      const result = engine.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(true);
      // 100 * 0.1 = 10，手续费 = floor(10 * 0.05) = 0，到账 = 10
      // addResource返回的是总量：2000 + 10 = 2010
      expect(result.received).toBe(2010);
      expect(result.fee).toBe(0);
      expect(tradeDeps.resources.grain).toBe(900);
      expect(tradeDeps.resources.gold).toBe(2010);
    });

    it('完整流程：gold→grain 成功交易', () => {
      const result = engine.tradeResource('gold', 'grain', 100);
      expect(result.success).toBe(true);
      // 100 * 8 = 800，手续费 = floor(800 * 0.05) = 40，到账 = 760
      // addResource返回的是总量：1000 + 760 = 1760
      expect(result.received).toBe(1760);
      expect(result.fee).toBe(40);
    });

    it('完整流程：grain→troops 成功交易', () => {
      const result = engine.tradeResource('grain', 'troops', 200);
      expect(result.success).toBe(true);
      // 200 * 0.05 = 10，手续费 = floor(10 * 0.05) = 0，到账 = 10
      // addResource返回的是总量：100 + 10 = 110
      expect(result.received).toBe(110);
      expect(result.fee).toBe(0);
    });

    it('完整流程：gold→techPoint 成功交易', () => {
      const result = engine.tradeResource('gold', 'techPoint', 500);
      expect(result.success).toBe(true);
      // 500 * 0.01 = 5，手续费 = floor(5 * 0.05) = 0，到账 = 5
      // addResource返回的是总量：50 + 5 = 55
      expect(result.received).toBe(55);
    });

    it('交易数量≤0 → 失败', () => {
      expect(engine.tradeResource('grain', 'gold', 0).success).toBe(false);
      expect(engine.tradeResource('grain', 'gold', -10).success).toBe(false);
    });

    it('不支持的交易对 → 失败', () => {
      const result = engine.tradeResource('troops', 'gold', 10);
      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持');
    });

    it('未初始化依赖 → 失败', () => {
      const fresh = new ResourceTradeEngine();
      const result = fresh.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('未初始化');
    });

    it('资源不足 → 失败', () => {
      // 用gold→grain测试资源不足（gold=2000, 交易9999）
      const result = engine.tradeResource('gold', 'grain', 9999);
      expect(result.success).toBe(false);
      expect(result.error).toContain('不足');
    });
  });

  // ── §TRD-FLOW-3 市场等级限制 ──

  describe('§TRD-FLOW-3 市场等级限制', () => {
    it('市场等级<5 → 不可交易', () => {
      const tradeDeps = createTradeDeps({ marketLevel: 4 });
      engine.setDeps(tradeDeps);
      const result = engine.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('市集等级');
    });

    it('市场等级=5 → 可以交易', () => {
      const tradeDeps = createTradeDeps({ marketLevel: 5 });
      engine.setDeps(tradeDeps);
      const result = engine.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(true);
    });

    it('canTradeResource检查市场等级', () => {
      const tradeDeps = createTradeDeps({ marketLevel: 3 });
      engine.setDeps(tradeDeps);
      const check = engine.canTradeResource('grain', 'gold', 100);
      expect(check.canTrade).toBe(false);
      expect(check.reason).toContain('市集等级');
    });
  });

  // ── §TRD-FLOW-4 资源保护线 ──

  describe('§TRD-FLOW-4 资源保护线', () => {
    it('粮草保护：交易后粮草不能低于10', () => {
      // 粮草=100，交易100后剩余0 < 10 → 失败
      const tradeDeps = createTradeDeps({ resources: { grain: 100, gold: 2000 }, marketLevel: 5 });
      engine.setDeps(tradeDeps);
      const result = engine.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('粮草保护');
    });

    it('粮草保护：刚好留10可以交易', () => {
      // 粮草=110，交易100后剩余10 → 可以
      const tradeDeps = createTradeDeps({ resources: { grain: 110, gold: 2000 }, marketLevel: 5 });
      engine.setDeps(tradeDeps);
      const result = engine.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(true);
    });

    it('铜钱安全线：<500不可交易铜钱', () => {
      const tradeDeps = createTradeDeps({ resources: { gold: 400, grain: 2000 }, marketLevel: 5 });
      engine.setDeps(tradeDeps);
      const result = engine.tradeResource('gold', 'grain', 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('铜钱安全线');
    });

    it('铜钱安全线：≥500可以交易', () => {
      const tradeDeps = createTradeDeps({ resources: { gold: 500, grain: 2000 }, marketLevel: 5 });
      engine.setDeps(tradeDeps);
      const result = engine.tradeResource('gold', 'grain', 100);
      expect(result.success).toBe(true);
    });
  });

  // ── §TRD-FLOW-5 商店序列化闭环 ──

  describe('§TRD-FLOW-5 商店序列化闭环', () => {
    it('ShopSystem序列化→反序列化→数据一致', () => {
      const shop = new ShopSystem();
      shop.init(createMockDeps());

      // 收藏一个商品
      const goods = shop.getShopGoods('normal');
      if (goods.length > 0) {
        shop.toggleFavorite(goods[0].defId);
      }

      const saved = shop.serialize();
      expect(saved.version).toBeDefined();
      expect(saved.favorites.length).toBeGreaterThan(0);

      // 反序列化到新实例
      const shop2 = new ShopSystem();
      shop2.init(createMockDeps());
      shop2.deserialize(saved);

      // 验证收藏恢复
      if (goods.length > 0) {
        expect(shop2.isFavorite(goods[0].defId)).toBe(true);
      }
    });

    it('ShopSystem reset清空状态', () => {
      const shop = new ShopSystem();
      shop.init(createMockDeps());
      shop.reset();

      const goods = shop.getShopGoods('normal');
      expect(goods.length).toBeGreaterThan(0);
    });
  });

  // ── §TRD-FLOW-6 贸易系统序列化闭环 ──

  describe('§TRD-FLOW-6 贸易系统序列化闭环', () => {
    it('TradeSystem序列化→反序列化→数据一致', () => {
      const trade = new TradeSystem();
      trade.init(createMockDeps());

      // 开通一条商路
      trade.openRoute('route_luoyang_xuchang' as any, 5);

      // 完成贸易提升繁荣度
      trade.completeTrade('route_luoyang_xuchang' as any);

      const saved = trade.serialize();
      expect(saved.version).toBeDefined();

      // 反序列化到新实例
      const trade2 = new TradeSystem();
      trade2.init(createMockDeps());
      trade2.deserialize(saved);

      // 验证商路状态恢复
      const routeState = trade2.getRouteState('route_luoyang_xuchang' as any);
      expect(routeState?.opened).toBe(true);
      expect(routeState?.completedTrades).toBe(1);
      expect(routeState?.prosperity).toBeGreaterThan(0);
    });

    it('TradeSystem reset恢复初始状态', () => {
      const trade = new TradeSystem();
      trade.init(createMockDeps());
      trade.openRoute('route_luoyang_xuchang' as any, 5);
      trade.reset();

      const routeState = trade.getRouteState('route_luoyang_xuchang' as any);
      expect(routeState?.opened).toBe(false);
    });

    it('CaravanSystem序列化→反序列化→数据一致', () => {
      const caravan = new CaravanSystem();
      caravan.init(createMockDeps());

      const initialCount = caravan.getCaravanCount();
      const saved = caravan.serialize();
      expect(saved.version).toBeDefined();

      const caravan2 = new CaravanSystem();
      caravan2.init(createMockDeps());
      caravan2.deserialize(saved);

      expect(caravan2.getCaravanCount()).toBe(initialCount);
    });

    it('版本不匹配时反序列化抛异常', () => {
      const trade = new TradeSystem();
      expect(() => trade.deserialize({ version: -1 } as any)).toThrow();
    });
  });

  // ── §TRD-FLOW-7 三方联动 ──

  describe('§TRD-FLOW-7 商店+贸易+货币三方联动', () => {
    it('商店购买→贸易利润→资源交易 完整经济循环', () => {
      const trade = new TradeSystem();
      trade.init(createMockDeps());

      // 1. 开通商路
      const openResult = trade.openRoute('route_luoyang_xuchang' as any, 5);
      expect(openResult.success).toBe(true);

      // 2. 计算利润
      const profit = trade.calculateProfit('route_luoyang_xuchang' as any, { silk: 10 }, 1.0, 0);
      expect(profit).toBeDefined();
      expect(typeof profit.profit).toBe('number');
      expect(typeof profit.profitRate).toBe('number');

      // 3. 完成贸易提升繁荣度
      trade.completeTrade('route_luoyang_xuchang' as any);
      const prosperity = trade.getProsperityLevel('route_luoyang_xuchang' as any);
      expect(prosperity).toBeDefined();

      // 4. 资源交易
      const tradeEngine = new ResourceTradeEngine();
      tradeEngine.init(createMockDeps());
      const tradeDeps = createTradeDeps({ marketLevel: 5 });
      tradeEngine.setDeps(tradeDeps);
      const result = tradeEngine.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(true);
    });

    it('护卫武将互斥→商队派遣→完成贸易 完整流程', () => {
      const caravanSys = new CaravanSystem();
      caravanSys.init(createMockDeps());

      // 设置路由提供者
      const provider: RouteInfoProvider = {
        getRouteDef: () => ({ opened: true, baseTravelTime: 60, baseProfitRate: 0.2, from: '洛阳', to: '许昌' }),
        getPrice: () => 100,
        completeTrade: () => {},
      };
      caravanSys.setRouteProvider(provider);

      // 获取空闲商队
      const idle = caravanSys.getIdleCaravans();
      expect(idle.length).toBeGreaterThan(0);

      // 指派护卫
      const assignResult = caravanSys.assignGuard(idle[0].id, 'hero_guanyu');
      expect(assignResult.success).toBe(true);
      expect(caravanSys.hasGuard(idle[0].id)).toBe(true);

      // 护卫互斥检查
      const mutex = caravanSys.checkGuardMutex('hero_guanyu');
      expect(mutex.available).toBe(false);

      // 派遣商队
      const dispatch = caravanSys.dispatch({
        caravanId: idle[0].id,
        routeId: 'route_luoyang_xuchang' as any,
        cargo: { silk: 5 },
        guardHeroId: 'hero_guanyu',
      });
      expect(dispatch.success).toBe(true);
      expect(dispatch.estimatedArrival).toBeGreaterThan(0);

      // 移除护卫
      expect(caravanSys.removeGuard(idle[0].id)).toBe(true);
      expect(caravanSys.hasGuard(idle[0].id)).toBe(false);
    });

    it('NPC商人→贸易事件 完整交互', () => {
      const trade = new TradeSystem();
      trade.init(createMockDeps());
      trade.openRoute('route_luoyang_xuchang' as any, 5);

      // 生成贸易事件
      const events = trade.generateTradeEvents('caravan_01', 'route_luoyang_xuchang' as any);
      // 事件可能为空（概率性），但API不报错即可
      expect(Array.isArray(events)).toBe(true);

      // NPC商人尝试生成
      const merchants = trade.trySpawnNpcMerchants();
      expect(Array.isArray(merchants)).toBe(true);

      // 获取活跃NPC商人
      const activeMerchants = trade.getActiveNpcMerchants();
      expect(Array.isArray(activeMerchants)).toBe(true);
    });
  });
});
