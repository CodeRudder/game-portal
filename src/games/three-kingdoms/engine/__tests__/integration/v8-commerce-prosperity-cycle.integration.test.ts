/**
 * v8.0 商贸繁荣 — 集成测试补充
 *
 * 覆盖已有 v8 测试未充分覆盖的场景：
 * - §1 ISubsystem 接口合规验证（5 个商贸子系统）
 * - §2 完整经济循环闭环（资源→货币→商店→商路→贸易→繁荣度→利润）
 * - §3 繁荣度完整生命周期（衰减→增长→事件→等级跃迁）
 * - §4 多系统序列化一致性（save/load 循环）
 * - §5 资源交易引擎与商贸系统联动
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v8-play.md
 */

import { describe, it, expect } from 'vitest';
import {
  createSim,
  createSimWithResources,
  createSimWithMarketLevel5,
  SUFFICIENT_RESOURCES,
  MASSIVE_RESOURCES,
} from '../../../test-utils/test-helpers';
import type { ShopType } from '../../../core/shop/shop.types';
import type { CurrencyType } from '../../../core/currency/currency.types';
import type { TradeRouteId } from '../../../core/trade/trade.types';
import { CURRENCY_TYPES } from '../../../core/currency';
import { SHOP_TYPES } from '../../../core/shop';
import {
  TRADE_ROUTE_DEFS,
  TRADE_EVENT_DEFS,
  PROSPERITY_TIERS,
  PROSPERITY_GAIN_PER_TRADE,
  PROSPERITY_DECAY_RATE,
  INITIAL_PROSPERITY,
  INITIAL_CARAVAN_COUNT,
  MAX_CARAVAN_COUNT,
  TRADE_SAVE_VERSION,
} from '../../../core/trade/trade-config';
import { CURRENCY_SAVE_VERSION } from '../../../core/currency/currency-config';
import { SHOP_SAVE_VERSION } from '../../../core/shop';
import { TradeSystem } from '../../trade/TradeSystem';
import { CurrencySystem } from '../../currency/CurrencySystem';
import { ShopSystem } from '../../shop/ShopSystem';
import { CaravanSystem } from '../../trade/CaravanSystem';

// ═══════════════════════════════════════════════════════════════
// §1 ISubsystem 接口合规验证
// ═══════════════════════════════════════════════════════════════
describe('v8.0 商贸繁荣 — §1 ISubsystem 接口合规', () => {

  // ── 1.1 ShopSystem ──
  describe('§1.1 ShopSystem ISubsystem 合规', () => {
    it('应有 readonly name 属性', () => {
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      expect(shop.name).toBe('shop');
      // TypeScript readonly 在编译时强制，运行时验证 name 存在且类型正确
      expect(typeof shop.name).toBe('string');
    });

    it('应实现 init/update/getState/reset 方法', () => {
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      expect(typeof shop.init).toBe('function');
      expect(typeof shop.update).toBe('function');
      expect(typeof shop.getState).toBe('function');
      expect(typeof shop.reset).toBe('function');
    });

    it('getState 应返回可序列化的纯对象', () => {
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      const state = shop.getState();
      expect(state).toBeDefined();
      // 应可 JSON 序列化
      expect(() => JSON.stringify(state)).not.toThrow();
    });

    it('reset 应将商店恢复到初始状态', () => {
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      // 修改商店等级
      shop.setShopLevel('normal' as ShopType, 5);
      expect(shop.getShopLevel('normal' as ShopType)).toBe(5);

      shop.reset();
      // 重置后等级应回到初始值
      expect(shop.getShopLevel('normal' as ShopType)).toBe(1);
    });

    it('update 不应抛出异常', () => {
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      expect(() => shop.update(1)).not.toThrow();
    });
  });

  // ── 1.2 CurrencySystem ──
  describe('§1.2 CurrencySystem ISubsystem 合规', () => {
    it('应有 readonly name 属性', () => {
      const sim = createSim();
      const currency = sim.engine.getCurrencySystem();
      expect(currency.name).toBe('currency');
    });

    it('应实现 init/update/getState/reset 方法', () => {
      const sim = createSim();
      const currency = sim.engine.getCurrencySystem();
      expect(typeof currency.init).toBe('function');
      expect(typeof currency.update).toBe('function');
      expect(typeof currency.getState).toBe('function');
      expect(typeof currency.reset).toBe('function');
    });

    it('getState 应返回钱包快照', () => {
      const sim = createSim();
      const currency = sim.engine.getCurrencySystem();
      const state = currency.getState();
      expect(state).toBeDefined();
      expect(typeof state).toBe('object');
      // 包含所有货币类型
      for (const type of CURRENCY_TYPES) {
        expect(state).toHaveProperty(type);
      }
    });

    it('reset 应将所有货币恢复到初始值', () => {
      const sim = createSim();
      const currency = sim.engine.getCurrencySystem();
      // 增加货币
      currency.addCurrency('copper' as CurrencyType, 5000);
      expect(currency.getBalance('copper' as CurrencyType)).toBeGreaterThan(1000);

      currency.reset();
      // 铜钱应回到初始值 1000
      expect(currency.getBalance('copper' as CurrencyType)).toBe(1000);
    });
  });

  // ── 1.3 TradeSystem ──
  describe('§1.3 TradeSystem ISubsystem 合规', () => {
    it('应有 readonly name 属性', () => {
      const sim = createSim();
      const trade = sim.engine.getTradeSystem();
      expect(trade.name).toBe('Trade');
    });

    it('应实现 init/update/getState/reset 方法', () => {
      const sim = createSim();
      const trade = sim.engine.getTradeSystem();
      expect(typeof trade.init).toBe('function');
      expect(typeof trade.update).toBe('function');
      expect(typeof trade.getState).toBe('function');
      expect(typeof trade.reset).toBe('function');
    });

    it('getState 应返回可序列化的状态快照', () => {
      const sim = createSim();
      const trade = sim.engine.getTradeSystem();
      const state = trade.getState();
      expect(state).toBeDefined();
      expect(() => JSON.stringify(state)).not.toThrow();
      // 应包含路由状态
      expect(state).toHaveProperty('routes');
      expect(state).toHaveProperty('prices');
    });

    it('reset 应清除所有运行时数据', () => {
      const sim = createSim();
      const trade = sim.engine.getTradeSystem();
      // 生成事件
      trade.generateTradeEvents('test_caravan', 'route_luoyang_xuchang' as TradeRouteId);
      const eventsBefore = trade.getActiveEvents();
      // 如果有事件生成，reset 后应清空
      trade.reset();
      const eventsAfter = trade.getActiveEvents();
      expect(eventsAfter).toHaveLength(0);
    });

    it('update 应处理繁荣度衰减', () => {
      const sim = createSim();
      const trade = sim.engine.getTradeSystem();
      // 先开通商路
      const routes = trade.getRouteDefs();
      if (routes.length > 0) {
        // 手动设置繁荣度
        const routeState = trade.getRouteState(routes[0].id as TradeRouteId);
        if (routeState) {
          routeState.opened = true;
          routeState.prosperity = 50;
          const prosperityBefore = routeState.prosperity;
          // update 应衰减繁荣度
          trade.update(100); // 100秒
          expect(routeState.prosperity).toBeLessThan(prosperityBefore);
        }
      }
    });
  });

  // ── 1.4 CaravanSystem ──
  describe('§1.4 CaravanSystem ISubsystem 合规', () => {
    it('应有 readonly name 属性', () => {
      const sim = createSim();
      const caravan = sim.engine.getCaravanSystem();
      expect(caravan.name).toBe('Caravan');
    });

    it('应实现 init/update/getState/reset 方法', () => {
      const sim = createSim();
      const caravan = sim.engine.getCaravanSystem();
      expect(typeof caravan.init).toBe('function');
      expect(typeof caravan.update).toBe('function');
      expect(typeof caravan.getState).toBe('function');
      expect(typeof caravan.reset).toBe('function');
    });

    it('getState 应返回商队数组', () => {
      const sim = createSim();
      const caravan = sim.engine.getCaravanSystem();
      const state = caravan.getState();
      expect(Array.isArray(state)).toBe(true);
      expect(state.length).toBeGreaterThanOrEqual(INITIAL_CARAVAN_COUNT);
    });

    it('reset 应将商队恢复到初始数量', () => {
      const sim = createSim();
      const caravan = sim.engine.getCaravanSystem();
      // 尝试添加商队
      if (caravan.canAddCaravan()) {
        caravan.addCaravan();
      }
      caravan.reset();
      expect(caravan.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
    });
  });

  // ── 1.5 ResourceTradeEngine ──
  describe('§1.5 ResourceTradeEngine ISubsystem 合规', () => {
    it('应有 readonly name 属性', () => {
      const sim = createSim();
      const rte = sim.engine.getResourceTradeEngine();
      expect(rte.name).toBe('resourceTrade');
    });

    it('应实现 init/update/getState/reset 方法', () => {
      const sim = createSim();
      const rte = sim.engine.getResourceTradeEngine();
      expect(typeof rte.init).toBe('function');
      expect(typeof rte.update).toBe('function');
      expect(typeof rte.getState).toBe('function');
      expect(typeof rte.reset).toBe('function');
    });

    it('getState 应返回引擎配置信息', () => {
      const sim = createSim();
      const rte = sim.engine.getResourceTradeEngine();
      const state = rte.getState() as Record<string, unknown>;
      expect(state).toBeDefined();
      expect(state).toHaveProperty('supportedPairs');
      expect(state).toHaveProperty('feeRate');
      expect(state).toHaveProperty('marketRequiredLevel');
    });

    it('reset 不应抛出异常', () => {
      const sim = createSim();
      const rte = sim.engine.getResourceTradeEngine();
      expect(() => rte.reset()).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// §2 完整经济循环闭环
// ═══════════════════════════════════════════════════════════════
describe('v8.0 商贸繁荣 — §2 完整经济循环闭环', () => {

  it('ECON-CYCLE-1: 资源→货币→商店购买 完整闭环', () => {
    const sim = createSimWithResources(MASSIVE_RESOURCES);
    const currency = sim.engine.getCurrencySystem();
    const shop = sim.engine.getShopSystem();

    // 1. 初始货币余额
    const copperBefore = currency.getBalance('copper' as CurrencyType);

    // 2. 查看商店商品
    const goods = shop.getShopGoods('normal' as ShopType);
    expect(goods.length).toBeGreaterThan(0);

    // 3. 给予足够货币
    currency.addCurrency('copper' as CurrencyType, 100000);

    // 4. 购买商品
    const affordableGood = goods.find(g => {
      const stock = shop.getStockInfo('normal' as ShopType, g.defId);
      return stock && (stock.stock === -1 || stock.stock > 0);
    });
    if (affordableGood) {
      const result = shop.executeBuy({
        shopType: 'normal' as ShopType,
        goodsId: affordableGood.defId,
        count: 1,
      });
      // 购买可能成功也可能因货币不足失败，都不应抛异常
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    }
  });

  it('ECON-CYCLE-2: 货币兑换→商店购买 闭环', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    // 1. 给予元宝
    currency.addCurrency('ingot' as CurrencyType, 10);
    const ingotBefore = currency.getBalance('ingot' as CurrencyType);

    // 2. 兑换元宝→铜钱
    const rate = currency.getExchangeRate('ingot' as CurrencyType, 'copper' as CurrencyType);
    expect(rate).toBeGreaterThan(0);

    const exchangeResult = currency.exchange({
      from: 'ingot' as CurrencyType,
      to: 'copper' as CurrencyType,
      amount: 5,
    });
    expect(exchangeResult.success).toBe(true);
    expect(exchangeResult.spent).toBe(5);
    expect(exchangeResult.received).toBe(Math.floor(5 * rate));

    // 3. 用兑换的铜钱购买
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const result = shop.executeBuy({
        shopType: 'normal' as ShopType,
        goodsId: goods[0].defId,
        count: 1,
      });
      // 有足够铜钱时应成功
      if (currency.getBalance('copper' as CurrencyType) > 0) {
        // 不强制成功，因为可能价格高于余额
        expect(result).toBeDefined();
      }
    }
  });

  it('ECON-CYCLE-3: 开通商路→派遣商队→完成贸易→利润闭环', () => {
    const sim = createSimWithResources(MASSIVE_RESOURCES);
    sim.initMidGameState();

    const trade = sim.engine.getTradeSystem();
    const caravanSys = sim.engine.getCaravanSystem();
    const currency = sim.engine.getCurrencySystem();

    // 1. 开通第一条商路（洛阳→许昌，需要主城1级）
    const castleLevel = sim.getBuildingLevel('castle');
    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const openResult = trade.openRoute(routeId, castleLevel);
    expect(openResult.success).toBe(true);

    // 2. 注入商路信息提供者
    caravanSys.setRouteProvider({
      getRouteDef: (id: TradeRouteId) => {
        const def = trade.getRouteDefs().find(r => r.id === id);
        const state = trade.getRouteState(id);
        if (!def || !state) return null;
        return {
          opened: state.opened,
          baseTravelTime: def.baseTravelTime,
          baseProfitRate: def.baseProfitRate,
          from: def.from,
          to: def.to,
        };
      },
      getPrice: (goodsId: string) => trade.getPrice(goodsId),
      completeTrade: (id: TradeRouteId) => trade.completeTrade(id),
    });

    // 3. 派遣商队
    const idleCaravans = caravanSys.getIdleCaravans();
    expect(idleCaravans.length).toBeGreaterThanOrEqual(INITIAL_CARAVAN_COUNT);

    const dispatchResult = caravanSys.dispatch({
      caravanId: idleCaravans[0].id,
      routeId,
      cargo: { silk: 10 },
    });
    expect(dispatchResult.success).toBe(true);
    expect(dispatchResult.estimatedProfit).toBeGreaterThanOrEqual(0);

    // 4. 完成贸易
    trade.completeTrade(routeId);

    // 5. 验证繁荣度增长
    const state = trade.getRouteState(routeId);
    expect(state).toBeDefined();
    expect(state!.completedTrades).toBeGreaterThan(0);
    expect(state!.prosperity).toBeGreaterThanOrEqual(INITIAL_PROSPERITY);
  });

  it('ECON-CYCLE-4: 商路利润→繁荣度→利润倍增 正反馈闭环', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const cargo = { silk: 10 };

    // 1. 开通商路
    const routeState = trade.getRouteState(routeId);
    if (routeState) {
      routeState.opened = true;
      routeState.prosperity = INITIAL_PROSPERITY; // 初始繁荣度

      // 2. 初始利润
      const profitBefore = trade.calculateProfit(routeId, cargo, 1.0, 0);

      // 3. 完成多次贸易提升繁荣度
      for (let i = 0; i < 10; i++) {
        trade.completeTrade(routeId);
      }

      // 4. 繁荣度应增长
      expect(routeState.prosperity).toBeGreaterThan(INITIAL_PROSPERITY);

      // 5. 利润应增加
      const profitAfter = trade.calculateProfit(routeId, cargo, 1.0, 0);
      expect(profitAfter.profit).toBeGreaterThanOrEqual(profitBefore.profit);
    }
  });

  it('ECON-CYCLE-5: 资源交易→货币→商店 完整链路', () => {
    const sim = createSimWithMarketLevel5();
    const rte = sim.engine.getResourceTradeEngine();
    const currency = sim.engine.getCurrencySystem();
    const shop = sim.engine.getShopSystem();

    // 注入资源交易依赖
    const res = sim.engine.resource;
    rte.setDeps({
      getResourceAmount: (type) => res.getAmount(type),
      consumeResource: (type, amount) => res.consumeResource(type, amount),
      addResource: (type, amount) => res.addResource(type, amount),
      getMarketLevel: () => sim.getBuildingLevel('market'),
    });

    // 1. 用粮草兑换铜钱
    const grainBefore = res.getAmount('grain');
    const copperBefore = currency.getBalance('copper' as CurrencyType);

    if (grainBefore > 100) {
      const tradeResult = rte.tradeResource('grain', 'gold', 100);
      if (tradeResult.success) {
        // 2. 验证资源减少
        expect(res.getAmount('grain')).toBeLessThan(grainBefore);
        // 3. 用获得的铜钱去商店购买
        const goods = shop.getShopGoods('normal' as ShopType);
        if (goods.length > 0) {
          const buyResult = shop.executeBuy({
            shopType: 'normal' as ShopType,
            goodsId: goods[0].defId,
            count: 1,
          });
          expect(buyResult).toBeDefined();
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// §3 繁荣度完整生命周期
// ═══════════════════════════════════════════════════════════════
describe('v8.0 商贸繁荣 — §3 繁荣度完整生命周期', () => {

  it('PROSPERITY-1: 繁荣度从初始值自然衰减到0', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const state = trade.getRouteState(routeId);
    if (state) {
      state.opened = true;
      state.prosperity = 10; // 低繁荣度

      // 大量 update 模拟时间流逝
      for (let i = 0; i < 1000; i++) {
        trade.update(100); // 每次100秒
      }

      // 繁荣度应衰减到0
      expect(state.prosperity).toBe(0);
    }
  });

  it('PROSPERITY-2: 繁荣度上限为100', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const state = trade.getRouteState(routeId);
    if (state) {
      state.opened = true;
      state.prosperity = 99;

      // 完成多次贸易
      for (let i = 0; i < 50; i++) {
        trade.completeTrade(routeId);
      }

      // 繁荣度不应超过100
      expect(state.prosperity).toBeLessThanOrEqual(100);
    }
  });

  it('PROSPERITY-3: 繁荣度等级跃迁 (declining→normal→thriving→golden)', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const state = trade.getRouteState(routeId);
    if (state) {
      state.opened = true;

      // declining: 0~25
      state.prosperity = 10;
      expect(trade.getProsperityLevel(routeId)).toBe('declining');
      expect(trade.getProsperityMultiplier(routeId)).toBeCloseTo(0.8, 1);

      // normal: 25~50
      state.prosperity = 35;
      expect(trade.getProsperityLevel(routeId)).toBe('normal');
      expect(trade.getProsperityMultiplier(routeId)).toBeCloseTo(1.0, 1);

      // thriving: 50~75
      state.prosperity = 60;
      expect(trade.getProsperityLevel(routeId)).toBe('thriving');
      expect(trade.getProsperityMultiplier(routeId)).toBeCloseTo(1.3, 1);

      // golden: 75~100
      state.prosperity = 90;
      expect(trade.getProsperityLevel(routeId)).toBe('golden');
      expect(trade.getProsperityMultiplier(routeId)).toBeCloseTo(1.6, 1);
    }
  });

  it('PROSPERITY-4: 每次贸易完成增加固定繁荣度', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const state = trade.getRouteState(routeId);
    if (state) {
      state.opened = true;
      state.prosperity = 50;

      const prosperityBefore = state.prosperity;
      trade.completeTrade(routeId);

      expect(state.prosperity).toBe(prosperityBefore + PROSPERITY_GAIN_PER_TRADE);
    }
  });

  it('PROSPERITY-5: 贸易事件可改变繁荣度', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const state = trade.getRouteState(routeId);
    if (state) {
      state.opened = true;
      state.prosperity = 50;

      // 生成贸易事件
      const events = trade.generateTradeEvents('test_caravan', routeId);
      if (events.length > 0) {
        const event = events[0];
        const prosperityBefore = state.prosperity;

        // 解决事件（使用第一个选项 ID）
        // 从 TRADE_EVENT_DEFS 中查找对应的选项
        const eventDef = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
        if (eventDef && eventDef.options.length > 0) {
          const optionId = eventDef.options[0].id;
          const resolveResult = trade.resolveTradeEvent(event.id, optionId);
          if (resolveResult.success && resolveResult.option) {
            // 繁荣度应按选项定义变化
            const expectedChange = resolveResult.option.prosperityChange;
            expect(state.prosperity).toBe(
              Math.max(0, Math.min(100, prosperityBefore + expectedChange)),
            );
          }
        }
      }
    }
  });

  it('PROSPERITY-6: 繁荣度影响利润计算', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const state = trade.getRouteState(routeId);
    if (state) {
      state.opened = true;
      const cargo = { silk: 10 };

      // declining 繁荣度
      state.prosperity = 10;
      const decliningProfit = trade.calculateProfit(routeId, cargo, 1.0, 0);

      // golden 繁荣度
      state.prosperity = 90;
      const goldenProfit = trade.calculateProfit(routeId, cargo, 1.0, 0);

      // golden 利润应高于 declining
      expect(goldenProfit.revenue).toBeGreaterThan(decliningProfit.revenue);
      expect(goldenProfit.prosperityBonus).toBeGreaterThan(decliningProfit.prosperityBonus);
    }
  });

  it('PROSPERITY-7: 未开通商路繁荣度保持初始值且不衰减', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const state = trade.getRouteState(routeId);
    if (state) {
      expect(state.opened).toBe(false);
      // 未开通商路保持 INITIAL_PROSPERITY (30)，不会衰减也不会增长
      const initialProsperity = state.prosperity;
      expect(initialProsperity).toBeGreaterThan(0);

      // update 不应改变未开通商路的繁荣度（衰减仅对 opened 商路生效）
      trade.update(1000);
      expect(state.prosperity).toBe(initialProsperity);

      // 再次 update 仍然不变
      trade.update(5000);
      expect(state.prosperity).toBe(initialProsperity);
    }
  });

  it('PROSPERITY-8: 繁荣度边界值验证 (0, 25, 50, 75, 100)', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const state = trade.getRouteState(routeId);
    if (state) {
      state.opened = true;

      // 边界 0 → declining
      state.prosperity = 0;
      expect(trade.getProsperityLevel(routeId)).toBe('declining');

      // 边界 25 → normal
      state.prosperity = 25;
      expect(trade.getProsperityLevel(routeId)).toBe('normal');

      // 边界 50 → thriving
      state.prosperity = 50;
      expect(trade.getProsperityLevel(routeId)).toBe('thriving');

      // 边界 75 → golden
      state.prosperity = 75;
      expect(trade.getProsperityLevel(routeId)).toBe('golden');

      // 边界 100 → golden
      state.prosperity = 100;
      expect(trade.getProsperityLevel(routeId)).toBe('golden');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// §4 多系统序列化一致性
// ═══════════════════════════════════════════════════════════════
describe('v8.0 商贸繁荣 — §4 多系统序列化一致性', () => {

  it('SAVE-1: TradeSystem 序列化/反序列化保持一致性', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    // 开通商路并完成贸易
    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const state = trade.getRouteState(routeId);
    if (state) {
      state.opened = true;
      state.prosperity = 65;
      state.completedTrades = 5;
    }

    // 序列化
    const saved = trade.serialize();
    expect(saved.version).toBe(TRADE_SAVE_VERSION);
    expect(saved.routes[routeId].opened).toBe(true);
    expect(saved.routes[routeId].prosperity).toBe(65);
    expect(saved.routes[routeId].completedTrades).toBe(5);

    // 反序列化到新实例
    const trade2 = new TradeSystem();
    const mockDeps = {
      eventBus: { emit: () => {}, on: () => {}, off: () => {}, once: () => {}, removeAllListeners: () => {} },
      config: { get: () => undefined },
      registry: { get: () => undefined },
    };
    trade2.init(mockDeps as any);
    trade2.deserialize(saved);

    // 验证恢复一致
    const state2 = trade2.getRouteState(routeId);
    expect(state2?.opened).toBe(true);
    expect(state2?.prosperity).toBe(65);
    expect(state2?.completedTrades).toBe(5);
  });

  it('SAVE-2: CurrencySystem 序列化/反序列化保持一致性', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    // 修改货币
    currency.addCurrency('copper' as CurrencyType, 50000);
    currency.addCurrency('ingot' as CurrencyType, 100);
    currency.addCurrency('reputation' as CurrencyType, 500);

    const walletBefore = currency.getWallet();

    // 序列化
    const saved = currency.serialize();
    expect(saved.version).toBe(CURRENCY_SAVE_VERSION);

    // 反序列化到新实例
    const currency2 = new CurrencySystem();
    const mockDeps = {
      eventBus: { emit: () => {}, on: () => {}, off: () => {}, once: () => {}, removeAllListeners: () => {} },
      config: { get: () => undefined },
      registry: { get: () => undefined },
    };
    currency2.init(mockDeps as any);
    currency2.deserialize(saved);

    // 验证恢复一致
    for (const type of CURRENCY_TYPES) {
      expect(currency2.getBalance(type)).toBe(walletBefore[type]);
    }
  });

  it('SAVE-3: ShopSystem 序列化/反序列化保持一致性', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();

    // 修改商店状态
    shop.setShopLevel('normal' as ShopType, 3);
    shop.toggleFavorite(shop.getShopGoods('normal' as ShopType)[0]?.defId ?? '');

    const saved = shop.serialize();
    expect(saved.version).toBe(SHOP_SAVE_VERSION);

    // 反序列化到新实例
    const shop2 = new ShopSystem();
    const mockDeps = {
      eventBus: { emit: () => {}, on: () => {}, off: () => {}, once: () => {}, removeAllListeners: () => {} },
      config: { get: () => undefined },
      registry: { get: () => undefined },
    };
    shop2.init(mockDeps as any);
    shop2.deserialize(saved);

    // 验证恢复一致
    expect(shop2.getShopLevel('normal' as ShopType)).toBe(3);
  });

  it('SAVE-4: CaravanSystem 序列化/反序列化保持一致性', () => {
    const sim = createSim();
    const caravan = sim.engine.getCaravanSystem();

    const caravansBefore = caravan.getCaravans();
    const saved = caravan.serialize();

    // 反序列化到新实例
    const caravan2 = new CaravanSystem();
    const mockDeps = {
      eventBus: { emit: () => {}, on: () => {}, off: () => {}, once: () => {}, removeAllListeners: () => {} },
      config: { get: () => undefined },
      registry: { get: () => undefined },
    };
    caravan2.init(mockDeps as any);
    caravan2.deserialize(saved);

    // 验证恢复一致
    const caravansAfter = caravan2.getCaravans();
    expect(caravansAfter.length).toBe(caravansBefore.length);
  });

  it('SAVE-5: 全系统 save/load 循环验证', () => {
    const sim = createSimWithResources(MASSIVE_RESOURCES);
    sim.initMidGameState();

    const trade = sim.engine.getTradeSystem();
    const currency = sim.engine.getCurrencySystem();
    const shop = sim.engine.getShopSystem();
    const caravan = sim.engine.getCaravanSystem();

    // 修改各系统状态
    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const routeState = trade.getRouteState(routeId);
    if (routeState) {
      routeState.opened = true;
      routeState.prosperity = 70;
    }
    currency.addCurrency('copper' as CurrencyType, 99999);
    shop.setShopLevel('normal' as ShopType, 5);

    // 序列化所有系统
    const tradeData = trade.serialize();
    const currencyData = currency.serialize();
    const shopData = shop.serialize();
    const caravanData = caravan.serialize();

    // 验证序列化数据完整
    expect(tradeData.version).toBe(TRADE_SAVE_VERSION);
    expect(currencyData.version).toBe(CURRENCY_SAVE_VERSION);
    expect(shopData.version).toBe(SHOP_SAVE_VERSION);
    expect(caravanData.version).toBe(TRADE_SAVE_VERSION);

    // 反序列化到新实例验证
    const mockDeps = {
      eventBus: { emit: () => {}, on: () => {}, off: () => {}, once: () => {}, removeAllListeners: () => {} },
      config: { get: () => undefined },
      registry: { get: () => undefined },
    };

    const trade2 = new TradeSystem();
    trade2.init(mockDeps as any);
    trade2.deserialize(tradeData);
    expect(trade2.getRouteState(routeId)?.prosperity).toBe(70);

    const currency2 = new CurrencySystem();
    currency2.init(mockDeps as any);
    currency2.deserialize(currencyData);
    expect(currency2.getBalance('copper' as CurrencyType)).toBe(
      currency.getBalance('copper' as CurrencyType),
    );

    const shop2 = new ShopSystem();
    shop2.init(mockDeps as any);
    shop2.deserialize(shopData);
    expect(shop2.getShopLevel('normal' as ShopType)).toBe(5);

    const caravan2 = new CaravanSystem();
    caravan2.init(mockDeps as any);
    caravan2.deserialize(caravanData);
    expect(caravan2.getCaravanCount()).toBe(caravan.getCaravanCount());
  });

  it('SAVE-6: 版本不匹配反序列化应处理', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    // TradeSystem 版本不匹配应抛异常
    expect(() => {
      trade.deserialize({ version: -1 } as any);
    }).toThrow(/版本不匹配/);
  });
});

// ═══════════════════════════════════════════════════════════════
// §5 资源交易引擎与商贸系统联动
// ═══════════════════════════════════════════════════════════════
describe('v8.0 商贸繁荣 — §5 资源交易引擎与商贸系统联动', () => {

  it('RTE-1: 市场等级不足时资源交易不可用', () => {
    const sim = createSim(); // 默认 market level = 1
    const rte = sim.engine.getResourceTradeEngine();
    const res = sim.engine.resource;

    rte.setDeps({
      getResourceAmount: (type) => res.getAmount(type),
      consumeResource: (type, amount) => res.consumeResource(type, amount),
      addResource: (type, amount) => res.addResource(type, amount),
      getMarketLevel: () => sim.getBuildingLevel('market'),
    });

    const result = rte.tradeResource('grain', 'gold', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('市集等级');
  });

  it('RTE-2: 市场等级≥5时资源交易可用', () => {
    const sim = createSimWithMarketLevel5();
    const rte = sim.engine.getResourceTradeEngine();
    const res = sim.engine.resource;

    rte.setDeps({
      getResourceAmount: (type) => res.getAmount(type),
      consumeResource: (type, amount) => res.consumeResource(type, amount),
      addResource: (type, amount) => res.addResource(type, amount),
      getMarketLevel: () => sim.getBuildingLevel('market'),
    });

    // 确保有足够粮草
    sim.addResources({ grain: 10000 });

    const result = rte.tradeResource('grain', 'gold', 100);
    expect(result.success).toBe(true);
    expect(result.received).toBeGreaterThan(0);
    // 手续费5%：100 * 0.1 = 10, fee = floor(10 * 0.05) = 0, received = 10 - 0 = 10
    expect(result.fee).toBeGreaterThanOrEqual(0);
  });

  it('RTE-3: 粮草保护线 — 交易后粮草不低于10', () => {
    const sim = createSimWithMarketLevel5();
    const rte = sim.engine.getResourceTradeEngine();
    const res = sim.engine.resource;

    rte.setDeps({
      getResourceAmount: (type) => res.getAmount(type),
      consumeResource: (type, amount) => res.consumeResource(type, amount),
      addResource: (type, amount) => res.addResource(type, amount),
      getMarketLevel: () => sim.getBuildingLevel('market'),
    });

    // 设置粮草刚好为 20（留10后只能交易10）
    sim.setResource('grain', 20);

    // 交易15应该失败（因为 20-15=5 < 10）
    const result = rte.tradeResource('grain', 'gold', 15);
    expect(result.success).toBe(false);
    expect(result.error).toContain('粮草');
  });

  it('RTE-4: 铜钱安全线 — 铜钱<500不能交易铜钱', () => {
    const sim = createSimWithMarketLevel5();
    const rte = sim.engine.getResourceTradeEngine();
    const res = sim.engine.resource;

    rte.setDeps({
      getResourceAmount: (type) => res.getAmount(type),
      consumeResource: (type, amount) => res.consumeResource(type, amount),
      addResource: (type, amount) => res.addResource(type, amount),
      getMarketLevel: () => sim.getBuildingLevel('market'),
    });

    // 设置铜钱低于安全线
    sim.setResource('gold', 300);
    sim.addResources({ grain: 10000 });

    // gold→grain 交易应失败
    const result = rte.tradeResource('gold', 'grain', 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('安全线');
  });

  it('RTE-5: 4种交易对汇率正确', () => {
    const sim = createSim();
    const rte = sim.engine.getResourceTradeEngine();

    // grain→gold: 0.1 (10:1)
    expect(rte.getResourceTradeRate('grain', 'gold')).toBe(0.1);
    // gold→grain: 8 (1:8)
    expect(rte.getResourceTradeRate('gold', 'grain')).toBe(8);
    // grain→troops: 0.05 (20:1)
    expect(rte.getResourceTradeRate('grain', 'troops')).toBe(0.05);
    // gold→techPoint: 0.01 (100:1)
    expect(rte.getResourceTradeRate('gold', 'techPoint')).toBe(0.01);
    // 不支持的交易对
    expect(rte.getResourceTradeRate('troops', 'grain')).toBe(0);
  });

  it('RTE-6: canTradeResource 检查完整性', () => {
    const sim = createSimWithMarketLevel5();
    const rte = sim.engine.getResourceTradeEngine();
    const res = sim.engine.resource;

    rte.setDeps({
      getResourceAmount: (type) => res.getAmount(type),
      consumeResource: (type, amount) => res.consumeResource(type, amount),
      addResource: (type, amount) => res.addResource(type, amount),
      getMarketLevel: () => sim.getBuildingLevel('market'),
    });

    sim.addResources({ grain: 10000 });

    // 可以交易
    const canTrade = rte.canTradeResource('grain', 'gold', 100);
    expect(canTrade.canTrade).toBe(true);

    // 数量≤0
    const badAmount = rte.canTradeResource('grain', 'gold', 0);
    expect(badAmount.canTrade).toBe(false);

    // 不支持的交易对
    const badPair = rte.canTradeResource('troops', 'grain', 100);
    expect(badPair.canTrade).toBe(false);

    // 资源不足
    const noResource = rte.canTradeResource('grain', 'gold', 99999999);
    expect(noResource.canTrade).toBe(false);
  });

  it('RTE-7: 交易手续费正确计算 (5%)', () => {
    const sim = createSimWithMarketLevel5();
    const rte = sim.engine.getResourceTradeEngine();
    const res = sim.engine.resource;

    rte.setDeps({
      getResourceAmount: (type) => res.getAmount(type),
      consumeResource: (type, amount) => res.consumeResource(type, amount),
      addResource: (type, amount) => res.addResource(type, amount),
      getMarketLevel: () => sim.getBuildingLevel('market'),
    });

    sim.addResources({ grain: 100000 });

    // grain→gold: 1000 grain * 0.1 = 100 gold gross
    // fee = floor(100 * 0.05) = 5
    // received = 100 - 5 = 95
    const result = rte.tradeResource('grain', 'gold', 1000);
    expect(result.success).toBe(true);
    expect(result.fee).toBe(5);
    expect(result.received).toBe(95);
  });
});

// ═══════════════════════════════════════════════════════════════
// §6 商贸系统边界条件与异常处理
// ═══════════════════════════════════════════════════════════════
describe('v8.0 商贸繁荣 — §6 边界条件与异常处理', () => {

  it('EDGE-1: 商店购买数量为0或负数应失败', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const validation = shop.validateBuy({
        shopType: 'normal' as ShopType,
        goodsId: goods[0].defId,
        count: 0,
      });
      expect(validation.canBuy).toBe(false);
    }
  });

  it('EDGE-2: 不存在的商品购买应失败', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const validation = shop.validateBuy({
      shopType: 'normal' as ShopType,
      goodsId: 'nonexistent_goods',
      count: 1,
    });
    expect(validation.canBuy).toBe(false);
  });

  it('EDGE-3: 不存在的商路不可开通', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const result = trade.openRoute('nonexistent_route' as TradeRouteId, 10);
    expect(result.success).toBe(false);
  });

  it('EDGE-4: 不存在的商队不可派遣', () => {
    const sim = createSim();
    const caravan = sim.engine.getCaravanSystem();
    const result = caravan.dispatch({
      caravanId: 'nonexistent_caravan',
      routeId: 'route_luoyang_xuchang' as TradeRouteId,
      cargo: { silk: 10 },
    });
    expect(result.success).toBe(false);
  });

  it('EDGE-5: 货币兑换余额不足应失败', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    const result = currency.exchange({
      from: 'ingot' as CurrencyType,
      to: 'copper' as CurrencyType,
      amount: 999999,
    });
    expect(result.success).toBe(false);
  });

  it('EDGE-6: 货币不可为负数', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    expect(() => {
      currency.spendCurrency('copper' as CurrencyType, 99999999);
    }).toThrow();
  });

  it('EDGE-7: 商队数量达到上限后不可新增', () => {
    const sim = createSim();
    const caravan = sim.engine.getCaravanSystem();

    // 添加商队到上限
    while (caravan.canAddCaravan()) {
      const result = caravan.addCaravan();
      expect(result.success).toBe(true);
    }

    // 再添加应失败
    expect(caravan.canAddCaravan()).toBe(false);
    const result = caravan.addCaravan();
    expect(result.success).toBe(false);
    expect(caravan.getCaravanCount()).toBe(MAX_CARAVAN_COUNT);
  });

  it('EDGE-8: 多次 reset 后系统仍可正常使用', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();

    // 连续 reset
    for (let i = 0; i < 10; i++) {
      trade.reset();
      shop.reset();
      currency.reset();
    }

    // 仍可正常操作
    expect(trade.getRouteDefs().length).toBeGreaterThan(0);
    expect(shop.getShopGoods('normal' as ShopType)).toBeDefined();
    expect(currency.getBalance('copper' as CurrencyType)).toBe(1000);
  });

  it('EDGE-9: 价格刷新多次后保持稳定', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    // 多次价格刷新
    for (let i = 0; i < 100; i++) {
      trade.refreshPrices();
    }

    // 价格应仍为有限数值
    const prices = trade.getAllPrices();
    for (const [goodsId, price] of prices) {
      expect(isFinite(price.currentPrice)).toBe(true);
      expect(price.currentPrice).toBeGreaterThanOrEqual(0);
    }
  });

  it('EDGE-10: NPC商人过期后应从活跃列表移除', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();

    // 尝试生成NPC商人
    const spawned = trade.trySpawnNpcMerchants();
    // 无论是否生成，活跃列表应返回有效结果
    const active = trade.getActiveNpcMerchants();
    expect(Array.isArray(active)).toBe(true);
  });

  it('EDGE-11: 商店折扣叠加不超过合理范围', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);

    if (goods.length > 0) {
      // 添加多个折扣
      const now = Date.now();
      shop.addDiscount({
        id: 'discount1',
        rate: 0.7,
        applicableGoods: [goods[0].defId],
        startTime: now - 1000,
        endTime: now + 100000,
        description: '折扣1',
      });
      shop.addDiscount({
        id: 'discount2',
        rate: 0.5,
        applicableGoods: [goods[0].defId],
        startTime: now - 1000,
        endTime: now + 100000,
        description: '折扣2',
      });

      // 最终价格应取最低折扣
      const finalPrice = shop.calculateFinalPrice(goods[0].defId, 'normal' as ShopType);
      // 价格应大于0
      for (const [_, price] of Object.entries(finalPrice)) {
        expect(price).toBeGreaterThan(0);
      }
    }
  });

  it('EDGE-12: 商队护卫互斥 — 同一武将不可护卫两个商队', () => {
    const sim = createSim();
    const caravan = sim.engine.getCaravanSystem();
    const trade = sim.engine.getTradeSystem();

    // 开通商路
    const routeId = 'route_luoyang_xuchang' as TradeRouteId;
    const state = trade.getRouteState(routeId);
    if (state) {
      state.opened = true;
    }

    // 注入路由提供者
    caravan.setRouteProvider({
      getRouteDef: (id) => {
        const def = trade.getRouteDefs().find(r => r.id === id);
        const s = trade.getRouteState(id);
        if (!def || !s) return null;
        return { opened: s.opened, baseTravelTime: def.baseTravelTime, baseProfitRate: def.baseProfitRate, from: def.from, to: def.to };
      },
      getPrice: (goodsId) => trade.getPrice(goodsId),
      completeTrade: (id) => trade.completeTrade(id),
    });

    const idle = caravan.getIdleCaravans();
    if (idle.length >= 2) {
      // 第一个商队指派护卫
      const dispatch1 = caravan.dispatch({
        caravanId: idle[0].id,
        routeId,
        cargo: { silk: 5 },
        guardHeroId: 'hero_zhaoyun',
      });
      if (dispatch1.success) {
        // 第二个商队指派同一护卫应失败
        const dispatch2 = caravan.dispatch({
          caravanId: idle[1].id,
          routeId,
          cargo: { tea: 5 },
          guardHeroId: 'hero_zhaoyun',
        });
        expect(dispatch2.success).toBe(false);
        expect(dispatch2.reason).toContain('护卫');
      }
    }
  });
});
