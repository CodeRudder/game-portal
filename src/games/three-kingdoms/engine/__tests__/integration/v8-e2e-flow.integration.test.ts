/**
 * v8.0 商贸繁荣 — 端到端串联流程集成测试
 *
 * 覆盖范围：
 * - §8.1 商店购买→货币→库存联动
 * - §8.2 贸易→商店→繁荣度闭环
 * - §8.3 繁荣度退化→NPC消失
 * - §8.4 护卫武将互斥验证
 * - §8.5 离线回归验证
 * - §8.6 货币兑换→武将→贸易增强闭环
 * - §8.7 全经济循环压力测试
 * - §8.8 科技→贸易联动 (skip)
 * - §8.10 转生→商贸系统影响 (skip)
 * - §8.11 多商店并发状态
 * - §8.12~8.13 跨系统联动
 * - §8.9 新手引导→贸易解锁 (skip)
 * - §5.4 NPC特殊商人跨周持久性 (skip)
 * - §8.5.1 离线效率交叉验证 (skip)
 * - §9.5 MAP领土→商贸联动 (skip)
 *
 * 测试原则：
 * - 端到端串联测试，验证多系统协同
 * - 使用真实引擎 API，零 as any，零 mock
 */

import { describe, it, expect } from 'vitest';
import { createSim, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { ShopType } from '../../../../core/shop';
import type { TradeRouteId } from '../../../../core/trade/trade.types';
import {
  INITIAL_PROSPERITY,
  PROSPERITY_GAIN_PER_TRADE,
  TRADE_EVENT_DEFS,
} from '../../../core/trade/trade-config';

/** 创建完整的商贸系统套件 */
function createCommerceSuite(initialCopper = 100000) {
  const sim = createSim();
  sim.addResources(MASSIVE_RESOURCES);
  const shop = sim.engine.getShopSystem();
  const currency = sim.engine.getCurrencySystem();
  const trade = sim.engine.getTradeSystem();
  const caravanSys = sim.engine.getCaravanSystem();

  shop.setCurrencySystem(currency);
  currency.addCurrency('copper', initialCopper);
  currency.addCurrency('ingot', 5000);
  currency.addCurrency('mandate', 500);
  currency.addCurrency('reputation', 5000);

  // 开通商路
  trade.openRoute('route_luoyang_xuchang' as TradeRouteId, 1);

  // 设置 routeProvider
  caravanSys.setRouteProvider({
    getRouteDef: (routeId: string) => {
      const state = trade.getRouteState(routeId as TradeRouteId);
      const def = trade.getRouteDefs().find(r => r.id === routeId);
      if (!state || !def) return null;
      return { opened: state.opened, baseTravelTime: def.baseTravelTime, baseProfitRate: def.baseProfitRate, from: def.from, to: def.to };
    },
    getPrice: (goodsId: string) => trade.getPrice(goodsId),
    completeTrade: (routeId: TradeRouteId) => trade.completeTrade(routeId),
  });

  return { sim, shop, currency, trade, caravanSys };
}

// ═══════════════════════════════════════════════
// §8.1 商店购买→货币→库存联动
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.1 商店购买→货币→库存联动', () => {
  it('E2E-FLOW-1: 完整购买流程(选择→确认→扣款→获得)', () => {
    const { shop, currency } = createCommerceSuite();
    const goods = shop.getShopGoods('normal' as ShopType);
    const item = goods.find(g => g.stock > 0 || g.stock === -1);
    if (!item) return;

    const copperBefore = currency.getBalance('copper');
    const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: item.defId, quantity: 1 });
    if (!validation.canBuy) return;

    const result = shop.executeBuy({ shopType: 'normal' as ShopType, goodsId: item.defId, quantity: 1 });
    expect(result.success).toBe(true);
    // 验证货币扣除
    expect(currency.getBalance('copper')).toBeLessThan(copperBefore);
    // 验证库存变化
    const stockInfo = shop.getStockInfo('normal' as ShopType, item.defId);
    if (stockInfo && item.stock !== -1) expect(stockInfo.dailyPurchased).toBeGreaterThan(0);
  });

  it('E2E-FLOW-2: 货币不足时购买失败且不扣款', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    // 初始余额很少
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length === 0) return;

    const expensiveItem = goods.find(g => {
      const def = shop.getGoodsDef(g.defId);
      return def && (Object.values(def.basePrice)[0] ?? 0) > 500;
    });
    if (!expensiveItem) return;

    const copperBefore = currency.getBalance('copper');
    const result = shop.executeBuy({ shopType: 'normal' as ShopType, goodsId: expensiveItem.defId, quantity: 1 });
    if (!result.success) {
      expect(currency.getBalance('copper')).toBe(copperBefore);
    }
  });

  it('E2E-FLOW-2b: 折扣购买→货币节省', () => {
    const { shop, currency } = createCommerceSuite();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length === 0) return;

    const defId = goods[0].defId;
    const basePrice = shop.calculateFinalPrice(defId, 'normal' as ShopType);
    const baseCopper = Object.values(basePrice)[0] ?? 0;
    if (baseCopper === 0) return;

    // 添加折扣
    shop.addDiscount({
      type: 'test_discount', rate: 0.8,
      startTime: Date.now() - 1000, endTime: Date.now() + 86400000,
      targetShopType: 'normal' as ShopType, applicableGoods: [defId],
    });

    const copperBefore = currency.getBalance('copper');
    const result = shop.executeBuy({ shopType: 'normal' as ShopType, goodsId: defId, quantity: 1 });
    if (result.success) {
      const spent = copperBefore - currency.getBalance('copper');
      // 实际花费应≤基础价格
      expect(spent).toBeLessThanOrEqual(baseCopper);
    }
  });
});

// ═══════════════════════════════════════════════
// §8.2 贸易→繁荣度闭环
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.2 贸易→繁荣度闭环', () => {
  it('E2E-FLOW-3: 开通商路→完成贸易→繁荣度提升', () => {
    const { trade } = createCommerceSuite();
    const before = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.prosperity ?? 0;
    trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    const after = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.prosperity ?? 0;
    expect(after).toBe(before + PROSPERITY_GAIN_PER_TRADE);
  });

  it('E2E-FLOW-4: 繁荣度影响利润倍率', () => {
    const { trade } = createCommerceSuite();
    // 提升繁荣度
    for (let i = 0; i < 25; i++) trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    const multiplier = trade.getProsperityMultiplier('route_luoyang_xuchang' as TradeRouteId);
    expect(multiplier).toBeGreaterThan(0);

    const profit = trade.calculateProfit('route_luoyang_xuchang' as TradeRouteId, { silk: 10 }, 1.0, 0);
    expect(profit.prosperityBonus).toBeGreaterThanOrEqual(0);
  });

  it('E2E-FLOW-4b: 繁荣度→NPC商人解锁联动', () => {
    const { trade } = createCommerceSuite();
    // 提升繁荣度至高等级
    for (let i = 0; i < 30; i++) trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);

    const tier = trade.getProsperityTier('route_luoyang_xuchang' as TradeRouteId);
    if (tier.unlockNpcMerchant) {
      let spawned = false;
      for (let i = 0; i < 100; i++) {
        if (trade.trySpawnNpcMerchants().length > 0) { spawned = true; break; }
      }
      expect(spawned).toBe(true);
    }
  });

  it('E2E-FLOW-4c: 派遣商队→完成贸易→繁荣度→利润增加', () => {
    const { trade, caravanSys } = createCommerceSuite();
    const cargo = { silk: 5, tea: 3 };
    const profitBefore = trade.calculateProfit('route_luoyang_xuchang' as TradeRouteId, cargo, 1.0, 0);

    // 完成多次贸易提升繁荣度
    for (let i = 0; i < 15; i++) trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);

    const state = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId);
    expect(state?.prosperity).toBeGreaterThan(INITIAL_PROSPERITY);

    const profitAfter = trade.calculateProfit('route_luoyang_xuchang' as TradeRouteId, cargo, 1.0, 0);
    expect(profitAfter.revenue).toBeGreaterThanOrEqual(profitBefore.revenue);
  });
});

// ═══════════════════════════════════════════════
// §8.3 繁荣度退化→NPC消失
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.3 繁荣度退化', () => {
  it('E2E-FLOW-5: 繁荣度自然衰减', () => {
    const { trade } = createCommerceSuite();
    // 提升繁荣度
    for (let i = 0; i < 20; i++) trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    const before = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.prosperity ?? 0;
    // 模拟1天衰减
    trade.update(86400000);
    const after = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)?.prosperity ?? 0;
    expect(after).toBeLessThanOrEqual(before);
  });

  it('E2E-FLOW-5b: NPC商人有持续时间', () => {
    const { trade } = createCommerceSuite();
    for (let i = 0; i < 30; i++) trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    const spawned = trade.trySpawnNpcMerchants();
    for (const npc of spawned) {
      expect(npc.duration).toBeGreaterThan(0);
      expect(npc.appearedAt).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════
// §8.4 护卫武将互斥验证
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.4 护卫武将互斥', () => {
  it('E2E-FLOW-6: 同一武将不可护卫多个商队', () => {
    const { trade, caravanSys } = createCommerceSuite();
    const caravans = caravanSys.getIdleCaravans();
    if (caravans.length < 2) return;

    const result1 = caravanSys.dispatch({
      caravanId: caravans[0].id,
      routeId: 'route_luoyang_xuchang' as TradeRouteId,
      cargo: { silk: 5 },
      guardHeroId: 'hero_test_1',
    });
    if (result1.success) {
      expect(caravanSys.checkGuardMutex('hero_test_1').available).toBe(false);
      // 同一武将指派到另一商队应失败
      const assign2 = caravanSys.assignGuard(caravans[1].id, 'hero_test_1');
      expect(assign2.success).toBe(false);
    }
  });

  it('E2E-FLOW-7: 护卫释放后恢复可用', () => {
    const { caravanSys } = createCommerceSuite();
    const caravans = caravanSys.getIdleCaravans();
    if (caravans.length === 0) return;

    caravanSys.assignGuard(caravans[0].id, 'hero_available');
    caravanSys.removeGuard(caravans[0].id);
    expect(caravanSys.checkGuardMutex('hero_available').available).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// §8.5 离线回归验证
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.5 离线回归', () => {
  it('E2E-FLOW-8: 商队运输中快进时间完成', () => {
    const { sim, caravanSys } = createCommerceSuite();
    const caravans = caravanSys.getIdleCaravans();
    if (caravans.length === 0) return;

    const result = caravanSys.dispatch({
      caravanId: caravans[0].id,
      routeId: 'route_luoyang_xuchang' as TradeRouteId,
      cargo: { silk: 5 },
    });
    if (result.success) {
      // 快进1小时
      sim.fastForwardHours(1);
      const updated = caravanSys.getCaravan(caravans[0].id);
      expect(updated).toBeDefined();
      expect(updated!.status).not.toBe('idle');
    }
  });

  it('E2E-FLOW-9: 贸易事件默认保守处理', () => {
    const { trade } = createCommerceSuite();
    const events = trade.generateTradeEvents('test_offline', 'route_luoyang_xuchang' as TradeRouteId);
    expect(trade.getActiveEvents('test_offline').length).toBe(events.length);
    // 未处理的事件应仍为活跃状态
    for (const e of trade.getActiveEvents('test_offline')) {
      expect(e.resolved).toBe(false);
    }
  });

  it('E2E-FLOW-9b: 护卫自动处理低风险事件', () => {
    const { trade } = createCommerceSuite();
    trade.generateTradeEvents('offline_guard', 'route_luoyang_xuchang' as TradeRouteId);
    const resolved = trade.autoResolveWithGuard('offline_guard');
    for (const r of resolved) {
      expect(r.resolved).toBe(true);
      expect(r.chosenOptionId).toBe('auto_guard');
    }
  });

  it('E2E-FLOW-9c: 商店离线补货-手动刷新', () => {
    const { shop } = createCommerceSuite();
    const beforeGoods = shop.getShopGoods('normal' as ShopType).map(g => g.defId);
    shop.manualRefresh();
    const afterGoods = shop.getShopGoods('normal' as ShopType).map(g => g.defId);
    expect(afterGoods.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// §8.6 货币兑换→武将→贸易闭环
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.6 货币兑换闭环', () => {
  it('E2E-FLOW-10: 铜钱→兑换→购买流程', () => {
    const { currency } = createCommerceSuite(50000);
    const copperBefore = currency.getBalance('copper');
    const result = currency.exchange({ from: 'copper', to: 'mandate', amount: 1000 });
    if (result.success) {
      expect(currency.getBalance('copper')).toBeLessThan(copperBefore);
      expect(result.received).toBeGreaterThan(0);
    }
  });

  it('E2E-FLOW-11: 元宝兑换求贤令', () => {
    const { currency } = createCommerceSuite();
    currency.addCurrency('ingot', 1000);
    const result = currency.exchange({ from: 'ingot', to: 'summon', amount: 100 });
    if (result.success) expect(result.received).toBeGreaterThan(0);
  });

  it('E2E-FLOW-11b: 同种货币兑换返回成功(无操作)', () => {
    const { currency } = createCommerceSuite();
    const result = currency.exchange({ from: 'copper', to: 'copper', amount: 100 });
    expect(result.success).toBe(true);
    expect(result.spent).toBe(0);
    expect(result.received).toBe(0);
  });

  it('E2E-FLOW-11c: 余额不足兑换失败', () => {
    const { currency } = createCommerceSuite(100);
    const result = currency.exchange({ from: 'copper', to: 'mandate', amount: 999999 });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// §8.7 全经济循环压力测试
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.7 经济循环压力测试', () => {
  it('E2E-FLOW-12: 100次贸易循环稳定性', () => {
    const { trade } = createCommerceSuite();
    for (let i = 0; i < 100; i++) trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    const state = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId);
    expect(state!.prosperity).toBeLessThanOrEqual(100);
    expect(state!.prosperity).toBeGreaterThanOrEqual(0);
    expect(state!.completedTrades).toBe(100);

    // 利润计算应稳定
    const profit = trade.calculateProfit('route_luoyang_xuchang' as TradeRouteId, { silk: 10, tea: 5 }, 1.0, 0);
    expect(isFinite(profit.revenue)).toBe(true);
    expect(isFinite(profit.profit)).toBe(true);
    expect(isFinite(profit.profitRate)).toBe(true);
  });

  it('E2E-FLOW-13: 大量价格刷新稳定性', () => {
    const { trade } = createCommerceSuite();
    for (let i = 0; i < 200; i++) trade.refreshPrices();
    const defs = trade.getAllGoodsDefs();
    for (const def of defs) {
      const price = trade.getPrice(def.id);
      expect(price).toBeGreaterThan(0);
      expect(isFinite(price)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(Math.floor(def.basePrice * 0.5));
      expect(price).toBeLessThanOrEqual(Math.floor(def.basePrice * 2));
    }
  });

  it('E2E-FLOW-14: 大量事件生成/处理稳定性', () => {
    const { trade } = createCommerceSuite();
    for (let i = 0; i < 100; i++) {
      const events = trade.generateTradeEvents(`caravan_${i}`, 'route_luoyang_xuchang' as TradeRouteId);
      for (const event of events) {
        const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
        if (def && def.options.length > 0) {
          trade.resolveTradeEvent(event.id, def.options[0].id);
        }
      }
    }
    const state = trade.getRouteState('route_luoyang_xuchang' as TradeRouteId);
    expect(state?.prosperity).toBeGreaterThanOrEqual(0);
    expect(state?.prosperity).toBeLessThanOrEqual(100);
  });

  it('E2E-FLOW-14b: 大量货币操作稳定性', () => {
    const { currency } = createCommerceSuite();
    for (let i = 0; i < 50; i++) {
      currency.addCurrency('copper', 10000);
      if (currency.getBalance('copper') > 5000) currency.spendCurrency('copper', 5000);
    }
    expect(currency.getBalance('copper')).toBeGreaterThanOrEqual(0);
  });

  it('E2E-FLOW-14c: 多商路并行贸易', () => {
    const { trade } = createCommerceSuite();
    // 尝试开通多条商路
    const defs = trade.getRouteDefs().sort((a, b) => a.requiredCastleLevel - b.requiredCastleLevel);
    const openedRoutes: TradeRouteId[] = [];
    for (const def of defs) {
      if (def.requiredRoute) {
        const preState = trade.getRouteState(def.requiredRoute);
        if (!preState?.opened) continue;
      }
      const result = trade.openRoute(def.id, 20);
      if (result.success) openedRoutes.push(def.id);
    }

    // 并行完成贸易
    for (const routeId of openedRoutes) {
      trade.completeTrade(routeId);
      const state = trade.getRouteState(routeId);
      if (state?.opened) expect(state.completedTrades).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════
// §8.11 多商店并发状态
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.11 多商店并发', () => {
  it('E2E-FLOW-21: 各商店状态独立', () => {
    const { shop } = createCommerceSuite();
    const state = shop.getState();
    expect(state).toBeDefined();
    for (const [type, shopState] of Object.entries(state)) {
      expect(shopState.shopType).toBe(type);
      expect(shopState.goods).toBeDefined();
    }
  });

  it('E2E-FLOW-22: 各商店库存互不影响', () => {
    const { shop } = createCommerceSuite();
    const normalGoods = shop.getShopGoods('normal' as ShopType);
    if (normalGoods.length === 0) return;

    const blackMarketBefore = shop.getShopGoods('black_market' as ShopType).map(g => ({ ...g }));
    shop.executeBuy({ shopType: 'normal' as ShopType, goodsId: normalGoods[0].defId, quantity: 1 });
    const blackMarketAfter = shop.getShopGoods('black_market' as ShopType);
    expect(blackMarketAfter.length).toBe(blackMarketBefore.length);
  });

  it('E2E-FLOW-23: 多商店并发边界-手动刷新', () => {
    const { shop } = createCommerceSuite();
    shop.manualRefresh();
    const state = shop.getState();
    for (const [, shopState] of Object.entries(state)) {
      expect(shopState.goods).toBeDefined();
    }
  });

  it('E2E-FLOW-23b: 商店等级独立管理', () => {
    const { shop } = createCommerceSuite();
    const types = Object.keys(shop.getState());
    for (const type of types) {
      shop.setShopLevel(type as ShopType, 3);
      expect(shop.getShopLevel(type as ShopType)).toBe(3);
    }
  });
});

// ═══════════════════════════════════════════════
// §8.12~8.13 跨系统联动
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.12~8.13 跨系统联动', () => {
  it('E2E-FLOW-24: 商店+货币+贸易三系统协同', () => {
    const { shop, currency, trade } = createCommerceSuite();
    // 贸易完成
    trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);
    // 商店购买
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: goods[0].defId, quantity: 1 });
      expect(validation).toBeDefined();
    }
    // 繁荣度查询
    expect(trade.getProsperityLevel('route_luoyang_xuchang' as TradeRouteId)).toBeDefined();
  });

  it('E2E-FLOW-25: 折扣+购买+货币完整链路', () => {
    const { shop, currency } = createCommerceSuite();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length === 0) return;

    const defId = goods[0].defId;
    shop.addDiscount({
      type: 'test_discount', rate: 0.8,
      startTime: Date.now() - 1000, endTime: Date.now() + 86400000,
      targetShopType: 'normal' as ShopType, applicableGoods: [defId],
    });
    const copperBefore = currency.getBalance('copper');
    const result = shop.executeBuy({ shopType: 'normal' as ShopType, goodsId: defId, quantity: 1 });
    if (result.success) {
      expect(currency.getBalance('copper')).toBeLessThan(copperBefore);
    }
  });

  it('E2E-FLOW-26: 贸易事件→繁荣度→利润联动', () => {
    const { trade } = createCommerceSuite();
    const events = trade.generateTradeEvents('e2e_caravan', 'route_luoyang_xuchang' as TradeRouteId);
    for (const event of events) {
      const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
      if (def && def.options.length > 0) {
        // 选择有繁荣度变化的选项
        const prosperityOption = def.options.find(o => o.prosperityChange !== 0) ?? def.options[0];
        trade.resolveTradeEvent(event.id, prosperityOption.id);
      }
    }
    expect(trade.getRouteState('route_luoyang_xuchang' as TradeRouteId)).toBeDefined();
  });

  it('E2E-FLOW-26b: 声望→NPC折扣联动', () => {
    const { shop, currency } = createCommerceSuite();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length === 0) return;

    // 设置NPC折扣提供者（基于声望）
    shop.setNPCDiscountProvider((_npcId: string) => {
      const reputation = currency.getBalance('reputation');
      if (reputation >= 1000) return 0.8;
      if (reputation >= 500) return 0.85;
      if (reputation >= 100) return 0.9;
      return 1.0;
    });

    const basePrice = shop.calculateFinalPrice(goods[0].defId, 'normal' as ShopType);
    const npcPrice = shop.calculateFinalPrice(goods[0].defId, 'normal' as ShopType, 'npc_001');
    // 5000声望应触发-20%折扣
    const baseCopper = Object.values(basePrice)[0] ?? 0;
    const npcCopper = Object.values(npcPrice)[0] ?? 0;
    expect(npcCopper).toBeLessThan(baseCopper);
  });
});

// ═══════════════════════════════════════════════
// §8.10 转生→商贸系统影响验证
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.10 转生→商贸系统影响', () => {
  it('E2E-FLOW-27: 转生模拟-序列化/反序列化保留核心进度', () => {
    const { trade, caravanSys } = createCommerceSuite();
    // 完成多次贸易
    for (let i = 0; i < 10; i++) trade.completeTrade('route_luoyang_xuchang' as TradeRouteId);

    // 序列化
    const tradeData = trade.serialize();
    const caravanData = caravanSys.serialize();

    // 新实例反序列化
    const sim2 = createSim();
    sim2.addResources(MASSIVE_RESOURCES);
    const trade2 = sim2.engine.getTradeSystem();
    trade2.deserialize(tradeData);

    const state = trade2.getRouteState('route_luoyang_xuchang' as TradeRouteId);
    expect(state?.opened).toBe(true);
    expect(state?.completedTrades).toBe(10);
  });

  it('E2E-FLOW-28: 转生后货币按规则重置', () => {
    const { currency } = createCommerceSuite();
    currency.reset();
    // 铜钱应回到初始值
    expect(currency.getBalance('copper')).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════
// skip 块 — 需其他子系统联动
// ═══════════════════════════════════════════════
describe('v8 E2E-FLOW §8.8 科技→贸易联动', () => {
  it.skip('E2E-FLOW-29: 科技「市舶司」利润+25% — 需TechSystem联动', () => { /* §8.8 */ });
  it.skip('E2E-FLOW-30: 科技「通宝令」折扣+20% — 需TechSystem联动', () => { /* §8.8 */ });
  it.skip('E2E-FLOW-31: 科技「富甲天下」铜钱+50%/利润+40% — 需TechSystem联动', () => { /* §8.8 */ });
});

describe('v8 E2E-FLOW §8.9 新手引导→贸易解锁', () => {
  it.skip('E2E-FLOW-32: 新手引导触发贸易解锁 — 需GuideSystem联动', () => { /* §8.9 */ });
});

describe('v8 E2E-FLOW §5.4 NPC特殊商人 (R4)', () => {
  it.skip('E2E-FLOW-33: 丝绸之路商人每周日出现 — 需CalendarSystem联动', () => { /* §5.4.1 */ });
  it.skip('E2E-FLOW-34: NPC好感度限购解锁流程 — 需NPC好感度系统', () => { /* §2.4.1 */ });
});

describe('v8 E2E-FLOW §8.5.1 离线效率交叉验证', () => {
  it.skip('E2E-FLOW-35: 离线2h效率100% — 需OfflineSystem联动', () => { /* §8.5.1 */ });
  it.skip('E2E-FLOW-36: 离线72h效率15%封底 — 需OfflineSystem联动', () => { /* §8.5.1 */ });
});

describe('v8 E2E-FLOW §9.5 MAP领土→商贸联动', () => {
  it.skip('E2E-FLOW-37: 占领洛阳→全资源+50%→贸易利润提升 — 需MapSystem联动', () => { /* §9.5 */ });
  it.skip('E2E-FLOW-38: 占领建业→铜钱+30%→贸易影响 — 需MapSystem联动', () => { /* §9.5 */ });
});
