/**
 * Trade 模块对抗式测试
 *
 * 覆盖子系统：
 *   S1: TradeSystem（商路开通/价格波动/利润计算/繁荣度/贸易事件/NPC商人/序列化）
 *   S2: CaravanSystem（商队管理/派遣/护卫/状态流转/序列化）
 *   S3: ResourceTradeEngine（资源交易/汇率/手续费/资源保护线/市场等级）
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/trade-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeSystem } from '../../engine/trade/TradeSystem';
import type { TradeCurrencyOps } from '../../engine/trade/TradeSystem';
import { CaravanSystem } from '../../engine/trade/CaravanSystem';
import type { RouteInfoProvider } from '../../engine/trade/CaravanSystem';
import { ResourceTradeEngine } from '../../engine/trade/ResourceTradeEngine';
import type { ResourceTradeDeps } from '../../engine/trade/ResourceTradeEngine';
import type { TradeRouteId, TradeGoodsId, TradeRouteState, Caravan, CaravanDispatchRequest } from '../../core/trade/trade.types';
import { TRADE_SAVE_VERSION } from '../../core/trade/trade-config';
import type { ISystemDeps } from '../../core/types';
import type { ResourceType } from '../../shared/types';

// ── 测试辅助 ──────────────────────────────────

const mockDeps = (): ISystemDeps => {
  const ls = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      once: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      emit: vi.fn((e: string, p?: unknown) => { ls.get(e)?.forEach(h => h(p)); }),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
};

const createTradeEnv = () => {
  const deps = mockDeps();
  const trade = new TradeSystem();
  trade.init(deps);
  const caravan = new CaravanSystem();
  caravan.init(deps);
  const resource = new ResourceTradeEngine();
  resource.init(deps);
  return { deps, trade, caravan, resource };
};

/** 模拟货币操作 */
const mockCurrencyOps = (overrides?: Partial<TradeCurrencyOps>): TradeCurrencyOps => ({
  addCurrency: vi.fn(),
  canAfford: vi.fn(() => true),
  spendByPriority: vi.fn(() => ({ success: true })),
  ...overrides,
});

/** 模拟资源依赖 */
const mockResourceDeps = (resources: Record<string, number> = { grain: 1000, gold: 1000, troops: 100, techPoint: 50 }, marketLevel = 5): ResourceTradeDeps => {
  const state = { ...resources };
  return {
    getResourceAmount: vi.fn((type: ResourceType) => state[type] ?? 0),
    consumeResource: vi.fn((type: ResourceType, amount: number) => {
      state[type] = (state[type] ?? 0) - amount;
      return state[type];
    }),
    addResource: vi.fn((type: ResourceType, amount: number) => {
      state[type] = (state[type] ?? 0) + amount;
      return state[type];
    }),
    getMarketLevel: vi.fn(() => marketLevel),
  };
};

/** 模拟商路信息提供者 */
const mockRouteProvider = (): RouteInfoProvider => ({
  getRouteDef: vi.fn((routeId: TradeRouteId) => ({
    opened: true, baseTravelTime: 60, baseProfitRate: 0.2, from: 'luoyang', to: 'changan',
  })),
  getPrice: vi.fn(() => 100),
  completeTrade: vi.fn(),
});

// ═══════════════════════════════════════════════
// F-Normal: 正常流程
// ═══════════════════════════════════════════════

describe('Trade对抗测试 — F-Normal', () => {

  describe('TradeSystem 商路管理', () => {
    it('获取商路定义列表', () => {
      const { trade } = createTradeEnv();
      const defs = trade.getRouteDefs();
      expect(defs.length).toBeGreaterThan(0);
    });

    it('检查商路开通条件', () => {
      const { trade } = createTradeEnv();
      const defs = trade.getRouteDefs();
      const firstDef = defs[0];
      // 城堡等级不足
      const lowCheck = trade.canOpenRoute(firstDef.id, 0);
      expect(lowCheck.canOpen).toBe(false);
      // 城堡等级足够
      const highCheck = trade.canOpenRoute(firstDef.id, 100);
      if (!firstDef.requiredRoute) {
        expect(highCheck.canOpen).toBe(true);
      }
    });

    it('开通商路', () => {
      const { trade } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const firstNoPrereq = defs.find(d => !d.requiredRoute);
      if (firstNoPrereq) {
        const result = trade.openRoute(firstNoPrereq.id, firstNoPrereq.requiredCastleLevel);
        expect(result.success).toBe(true);
        const state = trade.getRouteState(firstNoPrereq.id);
        expect(state?.opened).toBe(true);
      }
    });

    it('获取商品价格', () => {
      const { trade } = createTradeEnv();
      const goodsDefs = trade.getAllGoodsDefs();
      if (goodsDefs.length > 0) {
        const price = trade.getPrice(goodsDefs[0].id);
        expect(price).toBeGreaterThan(0);
      }
    });

    it('刷新价格', () => {
      const { trade } = createTradeEnv();
      // 强制刷新时间
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 100000);
      trade.refreshPrices();
      vi.restoreAllMocks();
    });
  });

  describe('TradeSystem 利润计算', () => {
    it('计算贸易利润', () => {
      const { trade } = createTradeEnv();
      const defs = trade.getRouteDefs();
      const goodsDefs = trade.getAllGoodsDefs();
      if (defs.length > 0 && goodsDefs.length > 0) {
        // 先开通商路
        trade.setCurrencyOps(mockCurrencyOps());
        const target = defs.find(d => !d.requiredRoute);
        if (target) {
          trade.openRoute(target.id, target.requiredCastleLevel);
          const cargo: Record<string, number> = {};
          cargo[goodsDefs[0].id] = 10;
          const profit = trade.calculateProfit(target.id, cargo, 1.0, 0);
          expect(profit).toBeDefined();
          expect(typeof profit.revenue).toBe('number');
          expect(typeof profit.profit).toBe('number');
          expect(typeof profit.profitRate).toBe('number');
        }
      }
    });

    it('完成贸易增加繁荣度', () => {
      const { trade } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        trade.openRoute(target.id, target.requiredCastleLevel);
        const before = trade.getRouteState(target.id)?.prosperity ?? 0;
        trade.completeTrade(target.id);
        const after = trade.getRouteState(target.id)?.prosperity ?? 0;
        expect(after).toBeGreaterThanOrEqual(before);
      }
    });
  });

  describe('CaravanSystem 商队管理', () => {
    it('初始化有默认商队', () => {
      const { caravan } = createTradeEnv();
      expect(caravan.getCaravanCount()).toBeGreaterThan(0);
    });

    it('获取空闲商队', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      expect(idle.length).toBeGreaterThan(0);
      idle.forEach(c => expect(c.status).toBe('idle'));
    });

    it('派遣商队', () => {
      const { caravan } = createTradeEnv();
      caravan.setRouteProvider(mockRouteProvider());
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        const request: CaravanDispatchRequest = {
          caravanId: idle[0].id,
          routeId: 'route_luoyang_changan',
          cargo: { goods_1: 5 },
        };
        const result = caravan.dispatch(request);
        expect(result.success).toBe(true);
        expect(result.estimatedArrival).toBeGreaterThan(0);
      }
    });

    it('护卫指派', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        const result = caravan.assignGuard(idle[0].id, 'hero_1');
        expect(result.success).toBe(true);
        expect(caravan.hasGuard(idle[0].id)).toBe(true);
        expect(caravan.getGuardHeroId(idle[0].id)).toBe('hero_1');
      }
    });

    it('移除护卫', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        caravan.assignGuard(idle[0].id, 'hero_1');
        expect(caravan.removeGuard(idle[0].id)).toBe(true);
        expect(caravan.hasGuard(idle[0].id)).toBe(false);
      }
    });
  });

  describe('ResourceTradeEngine 资源交易', () => {
    it('获取支持的交易对', () => {
      const { resource } = createTradeEnv();
      const pairs = resource.getSupportedTradePairs();
      expect(pairs.length).toBeGreaterThan(0);
      pairs.forEach(p => {
        expect(p.from).toBeTruthy();
        expect(p.to).toBeTruthy();
        expect(p.rate).toBeGreaterThan(0);
      });
    });

    it('获取交易汇率', () => {
      const { resource } = createTradeEnv();
      const rate = resource.getResourceTradeRate('grain', 'gold');
      expect(rate).toBe(0.1);
    });

    it('执行grain→gold交易', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps());
      const result = resource.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(true);
      expect(result.received).toBeGreaterThan(0);
      expect(result.fee).toBeGreaterThanOrEqual(0);
    });

    it('执行gold→grain交易', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps());
      const result = resource.tradeResource('gold', 'grain', 100);
      expect(result.success).toBe(true);
      expect(result.received).toBeGreaterThan(0);
    });

    it('检查交易可行性', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps());
      const check = resource.canTradeResource('grain', 'gold', 100);
      expect(check.canTrade).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Error: 错误路径
// ═══════════════════════════════════════════════

describe('Trade对抗测试 — F-Error', () => {

  describe('TradeSystem 错误处理', () => {
    it('开通不存在的商路', () => {
      const { trade } = createTradeEnv();
      const check = trade.canOpenRoute('nonexistent_route' as TradeRouteId, 100);
      expect(check.canOpen).toBe(false);
      expect(check.reason).toContain('不存在');
    });

    it('重复开通商路', () => {
      const { trade } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        trade.openRoute(target.id, target.requiredCastleLevel);
        const result = trade.openRoute(target.id, target.requiredCastleLevel);
        expect(result.success).toBe(false);
        expect(result.reason).toContain('已开通');
      }
    });

    it('货币不足时开通失败', () => {
      const { trade } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps({ spendByPriority: vi.fn(() => ({ success: false })) }));
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        const result = trade.openRoute(target.id, target.requiredCastleLevel);
        expect(result.success).toBe(false);
        expect(result.reason).toContain('货币不足');
      }
    });

    it('前置商路未开通', () => {
      const { trade } = createTradeEnv();
      const defs = trade.getRouteDefs();
      const withPrereq = defs.find(d => d.requiredRoute);
      if (withPrereq) {
        const check = trade.canOpenRoute(withPrereq.id, 100);
        expect(check.canOpen).toBe(false);
        expect(check.reason).toContain('前置');
      }
    });

    it('解决不存在的事件', () => {
      const { trade } = createTradeEnv();
      const result = trade.resolveTradeEvent('nonexistent_event', 'opt_1');
      expect(result.success).toBe(false);
    });
  });

  describe('CaravanSystem 错误处理', () => {
    it('派遣不存在的商队', () => {
      const { caravan } = createTradeEnv();
      caravan.setRouteProvider(mockRouteProvider());
      const result = caravan.dispatch({ caravanId: 'nonexistent', routeId: 'r1', cargo: {} });
      expect(result.success).toBe(false);
      expect(result.reason).toContain('不存在');
    });

    it('派遣非空闲商队', () => {
      const { caravan } = createTradeEnv();
      caravan.setRouteProvider(mockRouteProvider());
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        caravan.dispatch({ caravanId: idle[0].id, routeId: 'r1', cargo: { g: 1 } });
        const result = caravan.dispatch({ caravanId: idle[0].id, routeId: 'r2', cargo: {} });
        expect(result.success).toBe(false);
        expect(result.reason).toContain('待命');
      }
    });

    it('未设置RouteProvider时派遣失败', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        const result = caravan.dispatch({ caravanId: idle[0].id, routeId: 'r1', cargo: {} });
        expect(result.success).toBe(false);
        expect(result.reason).toContain('未初始化');
      }
    });

    it('护卫互斥检测', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      if (idle.length >= 2) {
        caravan.assignGuard(idle[0].id, 'hero_1');
        const mutex = caravan.checkGuardMutex('hero_1', idle[1].id);
        expect(mutex.available).toBe(false);
        expect(mutex.conflictCaravanId).toBe(idle[0].id);
      }
    });

    it('护卫互斥时派遣失败', () => {
      const { caravan } = createTradeEnv();
      caravan.setRouteProvider(mockRouteProvider());
      const idle = caravan.getIdleCaravans();
      if (idle.length >= 2) {
        caravan.assignGuard(idle[0].id, 'hero_1');
        const result = caravan.dispatch({
          caravanId: idle[1].id,
          routeId: 'r1',
          cargo: { g: 1 },
          guardHeroId: 'hero_1',
        });
        expect(result.success).toBe(false);
        expect(result.reason).toContain('护卫');
      }
    });

    it('移除不存在商队的护卫', () => {
      const { caravan } = createTradeEnv();
      expect(caravan.removeGuard('nonexistent')).toBe(false);
    });

    it('升级不存在的商队', () => {
      const { caravan } = createTradeEnv();
      expect(caravan.upgradeCaravan('nonexistent', 'capacity', 10)).toBe(false);
    });
  });

  describe('ResourceTradeEngine 错误处理', () => {
    it('不支持的交易对', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps());
      const result = resource.tradeResource('troops', 'gold' as ResourceType, 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持');
    });

    it('交易数量为0', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps());
      const result = resource.tradeResource('grain', 'gold', 0);
      expect(result.success).toBe(false);
    });

    it('交易数量为负数', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps());
      const result = resource.tradeResource('grain', 'gold', -10);
      expect(result.success).toBe(false);
    });

    it('交易数量为NaN', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps());
      const result = resource.tradeResource('grain', 'gold', NaN);
      expect(result.success).toBe(false);
    });

    it('交易数量为小数', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps());
      const result = resource.tradeResource('grain', 'gold', 10.5);
      expect(result.success).toBe(false);
      expect(result.error).toContain('整数');
    });

    it('市场等级不足', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps({ grain: 1000 }, 3));
      const result = resource.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('市集等级');
    });

    it('未初始化依赖', () => {
      const { resource } = createTradeEnv();
      const result = resource.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('未初始化');
    });

    it('资源不足（触发保护线）', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps({ grain: 50 }));
      const result = resource.tradeResource('grain', 'gold', 100);
      expect(result.success).toBe(false);
      // 50-100=-50 < 10 保护线，优先触发粮草保护
      expect(result.error).toContain('粮草保护');
    });
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('Trade对抗测试 — F-Boundary', () => {

  describe('资源保护线边界', () => {
    it('粮草交易后不低于保留量', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps({ grain: 20 }));
      // 20 - 11 = 9 < 10(保留量), 应被拒绝
      const result = resource.tradeResource('grain', 'gold', 11);
      expect(result.success).toBe(false);
      expect(result.error).toContain('粮草保护');
    });

    it('恰好等于保留量时可以交易', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps({ grain: 20 }));
      // 20 - 10 = 10 >= 10(保留量), 可以交易
      const result = resource.tradeResource('grain', 'gold', 10);
      expect(result.success).toBe(true);
    });

    it('铜钱低于安全线不能交易', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps({ gold: 400 }));
      const result = resource.tradeResource('gold', 'grain', 100);
      expect(result.success).toBe(false);
      expect(result.error).toContain('安全线');
    });

    it('铜钱恰好等于安全线可以交易', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps({ gold: 500 }));
      const result = resource.tradeResource('gold', 'grain', 100);
      expect(result.success).toBe(true);
    });

    it('铜钱安全线+1可以交易', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps({ gold: 501 }));
      const result = resource.tradeResource('gold', 'grain', 100);
      expect(result.success).toBe(true);
    });
  });

  describe('商队载重边界', () => {
    it('恰好等于载重上限可以派遣', () => {
      const { caravan } = createTradeEnv();
      caravan.setRouteProvider(mockRouteProvider());
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        const capacity = idle[0].attributes.capacity;
        const result = caravan.dispatch({
          caravanId: idle[0].id,
          routeId: 'r1',
          cargo: { g: capacity },
        });
        expect(result.success).toBe(true);
      }
    });

    it('超出载重上限拒绝派遣', () => {
      const { caravan } = createTradeEnv();
      caravan.setRouteProvider(mockRouteProvider());
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        const capacity = idle[0].attributes.capacity;
        const result = caravan.dispatch({
          caravanId: idle[0].id,
          routeId: 'r1',
          cargo: { g: capacity + 1 },
        });
        expect(result.success).toBe(false);
        expect(result.reason).toContain('载重');
      }
    });

    it('NaN货物数量被拒绝', () => {
      const { caravan } = createTradeEnv();
      caravan.setRouteProvider(mockRouteProvider());
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        const result = caravan.dispatch({
          caravanId: idle[0].id,
          routeId: 'r1',
          cargo: { g: NaN },
        });
        expect(result.success).toBe(false);
        expect(result.reason).toContain('无效');
      }
    });

    it('负数货物数量被拒绝', () => {
      const { caravan } = createTradeEnv();
      caravan.setRouteProvider(mockRouteProvider());
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        const result = caravan.dispatch({
          caravanId: idle[0].id,
          routeId: 'r1',
          cargo: { g: -5 },
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('利润计算边界', () => {
    it('空货物利润为0', () => {
      const { trade } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        trade.openRoute(target.id, target.requiredCastleLevel);
        const profit = trade.calculateProfit(target.id, {}, 1.0, 0);
        expect(profit.revenue).toBe(0);
        expect(profit.cost).toBe(0);
        expect(profit.profit).toBe(0);
      }
    });

    it('NaN bargainingPower被防护', () => {
      const { trade } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        trade.openRoute(target.id, target.requiredCastleLevel);
        const profit = trade.calculateProfit(target.id, {}, NaN, NaN);
        expect(profit.bargainingBonus).toBe(0);
        expect(profit.guardCost).toBe(0);
      }
    });

    it('负数bargainingPower被防护', () => {
      const { trade } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        trade.openRoute(target.id, target.requiredCastleLevel);
        const profit = trade.calculateProfit(target.id, {}, -1, 0);
        expect(profit.bargainingBonus).toBe(0);
      }
    });

    it('不存在的商路利润为0', () => {
      const { trade } = createTradeEnv();
      const profit = trade.calculateProfit('nonexistent' as TradeRouteId, { g: 10 }, 1.0, 0);
      expect(profit.profit).toBe(0);
      expect(profit.revenue).toBe(0);
    });
  });

  describe('商队数量边界', () => {
    it('商队数量达到上限后不能新增', () => {
      const { caravan } = createTradeEnv();
      // 持续新增直到上限
      let added = 0;
      while (caravan.canAddCaravan()) {
        const result = caravan.addCaravan();
        if (result.success) added++;
        else break;
      }
      expect(caravan.canAddCaravan()).toBe(false);
      const finalResult = caravan.addCaravan();
      expect(finalResult.success).toBe(false);
      expect(finalResult.reason).toContain('上限');
    });
  });

  describe('升级商队边界', () => {
    it('currentLoad不可直接升级', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        expect(caravan.upgradeCaravan(idle[0].id, 'currentLoad', 10)).toBe(false);
      }
    });

    it('NaN升级值被拒绝', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        expect(caravan.upgradeCaravan(idle[0].id, 'capacity', NaN)).toBe(false);
      }
    });

    it('负数升级值被拒绝', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        expect(caravan.upgradeCaravan(idle[0].id, 'capacity', -5)).toBe(false);
      }
    });

    it('0升级值被拒绝', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        expect(caravan.upgradeCaravan(idle[0].id, 'capacity', 0)).toBe(false);
      }
    });
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互
// ═══════════════════════════════════════════════

describe('Trade对抗测试 — F-Cross', () => {

  describe('TradeSystem + CaravanSystem 交互', () => {
    it('开通商路后派遣商队', () => {
      const { trade, caravan } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        // 开通商路
        const openResult = trade.openRoute(target.id, target.requiredCastleLevel);
        expect(openResult.success).toBe(true);
        // 派遣商队
        caravan.setRouteProvider({
          getRouteDef: () => ({ opened: true, baseTravelTime: 60, baseProfitRate: 0.2, from: 'luoyang', to: 'changan' }),
          getPrice: (goodsId) => trade.getPrice(goodsId),
          completeTrade: (routeId) => trade.completeTrade(routeId),
        });
        const idle = caravan.getIdleCaravans();
        if (idle.length > 0) {
          const result = caravan.dispatch({
            caravanId: idle[0].id,
            routeId: target.id,
            cargo: {},
          });
          expect(result.success).toBe(true);
        }
      }
    });

    it('贸易事件与繁荣度联动', () => {
      const { trade } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        trade.openRoute(target.id, target.requiredCastleLevel);
        // 生成事件
        const events = trade.generateTradeEvents('caravan_1', target.id);
        // 解决事件（如果有）
        for (const event of events) {
          const active = trade.getActiveEvents('caravan_1');
          const found = active.find(e => e.id === event.id);
          if (found) {
            // 尝试解决（使用任意选项）
            trade.resolveTradeEvent(event.id, 'pay_guard');
          }
        }
      }
    });
  });

  describe('ResourceTradeEngine + 资源保护线交互', () => {
    it('grain→gold→grain往返有手续费损耗', () => {
      const { resource } = createTradeEnv();
      const resources = { grain: 10000, gold: 10000 };
      resource.setDeps(mockResourceDeps(resources));
      // grain → gold: 1000 grain → ~95 gold (rate=0.1, fee=5%)
      const r1 = resource.tradeResource('grain', 'gold', 1000);
      expect(r1.success).toBe(true);
      expect(r1.fee).toBeGreaterThan(0); // 有手续费
      // gold → grain: 用收到的gold买回grain
      const goldReceived = r1.received;
      const r2 = resource.tradeResource('gold', 'grain', goldReceived);
      expect(r2.success).toBe(true);
      expect(r2.fee).toBeGreaterThan(0); // 也有手续费
    });
  });

  describe('多商队并发操作', () => {
    it('同一护卫不能同时分配给两个商队', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      if (idle.length >= 2) {
        const r1 = caravan.assignGuard(idle[0].id, 'hero_shared');
        expect(r1.success).toBe(true);
        // 第二次分配同一武将到不同商队应失败（互斥）
        const r2 = caravan.assignGuard(idle[1].id, 'hero_shared');
        expect(r2.success).toBe(false);
        expect(r2.reason).toContain('护卫');
        // 原商队仍持有护卫
        expect(caravan.getGuardHeroId(idle[0].id)).toBe('hero_shared');
        expect(caravan.getGuardHeroId(idle[1].id)).toBeNull();
      }
    });
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 生命周期
// ═══════════════════════════════════════════════

describe('Trade对抗测试 — F-Lifecycle', () => {

  describe('TradeSystem 生命周期', () => {
    it('reset后恢复初始状态', () => {
      const { trade } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        trade.openRoute(target.id, target.requiredCastleLevel);
        trade.completeTrade(target.id);
      }
      trade.reset();
      const state = trade.getRouteState(target!.id);
      expect(state?.opened).toBe(false);
      expect(state?.completedTrades).toBe(0);
    });

    it('序列化与反序列化一致性', () => {
      const { trade } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        trade.openRoute(target.id, target.requiredCastleLevel);
        trade.completeTrade(target.id);
      }
      const saved = trade.serialize();
      expect(saved.version).toBe(TRADE_SAVE_VERSION);
      trade.reset();
      trade.deserialize(saved);
      if (target) {
        const state = trade.getRouteState(target.id);
        expect(state?.opened).toBe(true);
        expect(state?.completedTrades).toBe(1);
      }
    });

    it('反序列化版本不匹配抛异常', () => {
      const { trade } = createTradeEnv();
      expect(() => trade.deserialize({ version: 999, routes: {}, prices: {}, caravans: [], activeEvents: [], npcMerchants: [] }))
        .toThrow('版本不匹配');
    });
  });

  describe('CaravanSystem 生命周期', () => {
    it('reset后恢复初始商队', () => {
      const { caravan } = createTradeEnv();
      const initialCount = caravan.getCaravanCount();
      // 新增商队
      while (caravan.canAddCaravan()) caravan.addCaravan();
      expect(caravan.getCaravanCount()).toBeGreaterThan(initialCount);
      caravan.reset();
      expect(caravan.getCaravanCount()).toBe(initialCount);
    });

    it('序列化与反序列化一致性', () => {
      const { caravan } = createTradeEnv();
      const idle = caravan.getIdleCaravans();
      if (idle.length > 0) {
        caravan.assignGuard(idle[0].id, 'hero_1');
      }
      const saved = caravan.serialize();
      expect(saved.version).toBe(TRADE_SAVE_VERSION);
      caravan.reset();
      caravan.deserialize(saved);
      // 护卫关系应恢复
      if (idle.length > 0) {
        expect(caravan.getGuardHeroId(idle[0].id)).toBe('hero_1');
      }
    });

    it('反序列化版本不匹配抛异常', () => {
      const { caravan } = createTradeEnv();
      expect(() => caravan.deserialize({ caravans: [], version: 999 }))
        .toThrow('版本不匹配');
    });
  });

  describe('ResourceTradeEngine 生命周期', () => {
    it('reset后无状态变化', () => {
      const { resource } = createTradeEnv();
      resource.setDeps(mockResourceDeps());
      resource.tradeResource('grain', 'gold', 100);
      resource.reset();
      // reset后无内部状态需清除
      expect(resource.getState()).toBeDefined();
    });

    it('update调用不报错', () => {
      const { resource } = createTradeEnv();
      expect(() => resource.update(16)).not.toThrow();
    });
  });

  describe('完整贸易生命周期', () => {
    it('开通→派遣→完成→繁荣度增长完整流程', () => {
      const { trade, caravan } = createTradeEnv();
      trade.setCurrencyOps(mockCurrencyOps());
      const defs = trade.getRouteDefs();
      const target = defs.find(d => !d.requiredRoute);
      if (target) {
        // 1. 开通商路
        expect(trade.openRoute(target.id, target.requiredCastleLevel).success).toBe(true);
        // 2. 检查繁荣度初始值
        const initialProsperity = trade.getRouteState(target.id)?.prosperity ?? 0;
        // 3. 完成贸易
        trade.completeTrade(target.id);
        // 4. 验证繁荣度增长
        const afterProsperity = trade.getRouteState(target.id)?.prosperity ?? 0;
        expect(afterProsperity).toBeGreaterThan(initialProsperity);
        // 5. 获取繁荣度等级
        const level = trade.getProsperityLevel(target.id);
        expect(['declining', 'normal', 'thriving', 'golden']).toContain(level);
        // 6. 获取繁荣度倍率
        const multiplier = trade.getProsperityMultiplier(target.id);
        expect(multiplier).toBeGreaterThan(0);
      }
    });
  });
});
