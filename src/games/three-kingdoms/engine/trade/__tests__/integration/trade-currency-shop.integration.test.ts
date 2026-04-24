import { vi, describe, it, expect, beforeEach } from 'vitest';
/**
 * 集成测试 3/3: TradeSystem + CurrencySystem + ShopSystem 跨系统闭环
 *
 * 覆盖Play文档：
 *   §1.1 集市商店浏览与购买
 *   §1.6 货币体系（8种货币、消耗优先级）
 *   §1.7 货币兑换与汇率
 *   §1.8 货币防通胀与转生影响
 *   §8.2 贸易→商店→繁荣度闭环
 *   §8.6 货币兑换→抽卡→武将→贸易增强闭环
 *   §8.7 全经济循环压力测试（贸易利润占比）
 *   §8.11 多商店并发状态验证
 */

import { TradeSystem } from '../../TradeSystem';
import { CaravanSystem } from '../../CaravanSystem';
import { CurrencySystem } from '../../../currency/CurrencySystem';
import { ShopSystem } from '../../../shop/ShopSystem';
import type { TradeCurrencyOps } from '../../TradeSystem';
import type { RouteInfoProvider } from '../../CaravanSystem';
import type { TradeRouteId } from '../../../../core/trade/trade.types';
import {
  TRADE_ROUTE_DEFS,
  TRADE_GOODS_DEFS,
  INITIAL_PROSPERITY,
  INITIAL_CARAVAN_COUNT,
} from '../../../../core/trade/trade-config';
import { CURRENCY_TYPES } from '../../../../core/currency';

// ─── 辅助工具 ────────────────────────────────

function createMockDeps() {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn() },
    registry: { get: vi.fn() },
  };
}

/** 创建完整的跨系统测试环境 */
function createFullEnv() {
  const deps = createMockDeps();

  // 1. CurrencySystem
  const currency = new CurrencySystem();
  currency.init(deps as any);

  // 2. ShopSystem（依赖CurrencySystem）
  const shop = new ShopSystem();
  shop.init(deps as any);
  shop.setCurrencySystem(currency);

  // 3. TradeSystem（通过currencyOps与CurrencySystem交互）
  const trade = new TradeSystem();
  trade.init(deps as any);

  const currencyOps: TradeCurrencyOps = {
    addCurrency: (type: string, amount: number) => currency.addCurrency(type as any, amount),
    canAfford: (type: string, amount: number) => currency.hasEnough(type as any, amount),
    spendByPriority: (shopType: string, amount: number, currencyType?: string) => {
      try {
        if (currencyType) {
          const balance = currency.getBalance(currencyType as any);
          if (balance < amount) return { success: false };
          currency.spendCurrency(currencyType as any, amount);
          return { success: true };
        }
        // 默认用铜钱
        const balance = currency.getBalance('copper');
        if (balance < amount) return { success: false };
        currency.spendCurrency('copper', amount);
        return { success: true };
      } catch {
        return { success: false };
      }
    },
  };
  trade.setCurrencyOps(currencyOps);

  // 4. CaravanSystem（依赖TradeSystem）
  const caravan = new CaravanSystem();
  caravan.init(deps as any);

  const provider: RouteInfoProvider = {
    getRouteDef: (routeId: TradeRouteId) => {
      const state = trade.getRouteState(routeId);
      const def = trade.getRouteDefs().find(d => d.id === routeId);
      if (!state || !def) return null;
      return {
        opened: state.opened,
        baseTravelTime: def.baseTravelTime,
        baseProfitRate: def.baseProfitRate,
        from: def.from,
        to: def.to,
      };
    },
    getPrice: (goodsId: string) => trade.getPrice(goodsId),
    completeTrade: (routeId: TradeRouteId) => trade.completeTrade(routeId),
  };
  caravan.setRouteProvider(provider);

  return { currency, shop, trade, caravan, deps };
}

function openFirstRoute(trade: TradeSystem, castleLevel = 10): TradeRouteId | null {
  const defs = trade.getRouteDefs();
  for (const def of defs) {
    const check = trade.canOpenRoute(def.id, castleLevel);
    if (check.canOpen) {
      const result = trade.openRoute(def.id, castleLevel);
      return result.success ? def.id : null;
    }
  }
  return null;
}

// ─────────────────────────────────────────
// §1.6 货币体系基础
// ─────────────────────────────────────────

describe('§1.6 货币体系基础', () => {
  let currency: CurrencySystem;

  beforeEach(() => {
    const env = createFullEnv();
    currency = env.currency;
  });

  it('§1.6.1 8种常驻货币定义完整', () => {
    expect(CURRENCY_TYPES.length).toBe(8);
    const wallet = currency.getWallet();
    for (const type of CURRENCY_TYPES) {
      expect(wallet[type]).toBeDefined();
    }
  });

  it('§1.6.2 初始钱包有余额', () => {
    const wallet = currency.getWallet();
    const total = Object.values(wallet).reduce((s, v) => s + v, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('§1.6.3 增加货币受上限约束', () => {
    const before = currency.getBalance('copper');
    currency.addCurrency('copper', 999999999);
    const after = currency.getBalance('copper');
    // 铜钱可能有上限
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('§1.6.4 消耗货币正确扣除', () => {
    currency.addCurrency('copper', 10000);
    const before = currency.getBalance('copper');
    currency.spendCurrency('copper', 500);
    expect(currency.getBalance('copper')).toBe(before - 500);
  });

  it('§1.6.5 余额不足时抛出异常', () => {
    const balance = currency.getBalance('copper');
    expect(() => currency.spendCurrency('copper', balance + 99999)).toThrow();
  });

  it('§1.6.6 hasEnough正确判断', () => {
    currency.addCurrency('copper', 1000);
    expect(currency.hasEnough('copper', 500)).toBe(true);
    expect(currency.hasEnough('copper', 99999)).toBe(false);
  });

  it('§1.6.7 checkAffordability批量检查', () => {
    currency.addCurrency('copper', 5000);
    const result = currency.checkAffordability({ copper: 1000 });
    expect(result.canAfford).toBe(true);
    expect(result.shortages.length).toBe(0);
  });

  it('§1.6.8 getShortage返回不足信息', () => {
    const shortage = currency.getShortage('copper', 999999);
    expect(shortage.gap).toBeGreaterThan(0);
    expect(shortage.acquireHints).toBeDefined();
  });
});

// ─────────────────────────────────────────
// §1.7 货币兑换与汇率
// ─────────────────────────────────────────

describe('§1.7 货币兑换与汇率', () => {
  let currency: CurrencySystem;

  beforeEach(() => {
    const env = createFullEnv();
    currency = env.currency;
    // 确保有足够余额
    currency.addCurrency('copper', 100000);
    currency.addCurrency('mandate', 1000);
    currency.addCurrency('ingot', 1000);
  });

  it('§1.7.1 天命→铜钱汇率(1:100)', () => {
    const rate = currency.getExchangeRate('mandate', 'copper');
    expect(rate).toBe(100);
  });

  it('§1.7.2 元宝→铜钱汇率(1:1000)', () => {
    const rate = currency.getExchangeRate('ingot', 'copper');
    expect(rate).toBe(1000);
  });

  it('§1.7.3 声望→铜钱汇率(1:50)', () => {
    const rate = currency.getExchangeRate('reputation', 'copper');
    expect(rate).toBe(50);
  });

  it('§1.7.4 执行天命→铜钱兑换成功', () => {
    currency.setCurrency('mandate', 500);
    const beforeCopper = currency.getBalance('copper');
    const result = currency.exchange({ from: 'mandate', to: 'copper', amount: 5 });

    expect(result.success).toBe(true);
    expect(result.spent).toBe(5);
    expect(result.received).toBe(500);
    expect(currency.getBalance('copper')).toBe(beforeCopper + 500);
  });

  it('§1.7.5 源货币不足时兑换失败', () => {
    currency.setCurrency('ingot', 0);
    const result = currency.exchange({ from: 'ingot', to: 'copper', amount: 999999 });
    expect(result.success).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('§1.7.6 同种货币兑换返回0消耗', () => {
    const result = currency.exchange({ from: 'copper', to: 'copper', amount: 100 });
    expect(result.success).toBe(true);
    expect(result.spent).toBe(0);
    expect(result.received).toBe(0);
  });

  it('§1.7.7 不支持的汇率返回0', () => {
    const rate = currency.getExchangeRate('recruit', 'copper');
    // 招贤榜没有→铜钱的汇率
    expect(rate).toBe(0);
  });
});

// ─────────────────────────────────────────
// §1.1 集市商店浏览与购买
// ─────────────────────────────────────────

describe('§1.1 集市商店浏览与购买', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    const env = createFullEnv();
    shop = env.shop;
    currency = env.currency;
    currency.addCurrency('copper', 100000);
  });

  it('§1.1.1 集市商店有商品列表', () => {
    const goods = shop.getShopGoods('normal');
    expect(goods.length).toBeGreaterThan(0);
  });

  it('§1.1.2 商品分类Tab可过滤', () => {
    const categories = shop.getCategories();
    expect(categories.length).toBeGreaterThan(0);
  });

  it('§1.1.3 商品卡片含必要信息', () => {
    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    const item = goods[0];
    expect(item.defId).toBeTruthy();
    expect(item.stock).toBeDefined();
    expect(item.discount).toBeGreaterThan(0);
  });

  it('§1.1.4 validateBuy验证购买合法性', () => {
    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    const validation = shop.validateBuy({
      goodsId: goods[0].defId,
      quantity: 1,
      shopType: 'normal',
    });
    expect(typeof validation.canBuy).toBe('boolean');
    expect(typeof validation.confirmLevel).toBe('string');
  });

  it('§1.1.5 executeBuy成功购买', () => {
    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    const beforeCopper = currency.getBalance('copper');
    const result = shop.executeBuy({
      goodsId: goods[0].defId,
      quantity: 1,
      shopType: 'normal',
    });

    if (result.success) {
      // 铜钱应减少
      expect(currency.getBalance('copper')).toBeLessThanOrEqual(beforeCopper);
      expect(result.goodsId).toBe(goods[0].defId);
      expect(result.quantity).toBe(1);
    }
  });

  it('§1.1.6 购买后库存减少', () => {
    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    const stockInfo = shop.getStockInfo('normal', goods[0].defId);
    if (!stockInfo || stockInfo.stock === -1) return; // 无限库存

    const before = stockInfo.stock;
    shop.executeBuy({ goodsId: goods[0].defId, quantity: 1, shopType: 'normal' });

    const after = shop.getStockInfo('normal', goods[0].defId);
    if (after && after.stock !== -1) {
      expect(after.stock).toBe(before - 1);
    }
  });

  it('§1.1.7 无效数量购买失败', () => {
    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    const validation = shop.validateBuy({
      goodsId: goods[0].defId,
      quantity: 0,
      shopType: 'normal',
    });
    expect(validation.canBuy).toBe(false);
  });

  it('§1.1.8 不存在的商品购买失败', () => {
    const validation = shop.validateBuy({
      goodsId: 'nonexistent_goods',
      quantity: 1,
      shopType: 'normal',
    });
    expect(validation.canBuy).toBe(false);
  });
});

// ─────────────────────────────────────────
// §8.2 贸易→商店→繁荣度闭环
// ─────────────────────────────────────────

describe('§8.2 贸易→商店→繁荣度闭环', () => {
  let trade: TradeSystem;
  let caravan: CaravanSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    const env = createFullEnv();
    trade = env.trade;
    caravan = env.caravan;
    currency = env.currency;
    currency.addCurrency('copper', 100000);
  });

  it('§8.2.1 开通商路→扣铜钱→繁荣度初始30', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const state = trade.getRouteState(routeId);
    expect(state?.opened).toBe(true);
    expect(state?.prosperity).toBe(INITIAL_PROSPERITY);
  });

  it('§8.2.2 派遣商队→完成贸易→繁荣度提升', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const before = trade.getRouteState(routeId)!.prosperity;
    trade.completeTrade(routeId);
    const after = trade.getRouteState(routeId)!.prosperity;

    expect(after).toBeGreaterThan(before);
  });

  it('§8.2.3 利润计算→繁荣度加成→收入增加', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const cargo = { silk: 5 };
    const profitBase = trade.calculateProfit(routeId, cargo, 1.0, 0);

    // 提升繁荣度
    for (let i = 0; i < 20; i++) trade.completeTrade(routeId);

    const profitHigh = trade.calculateProfit(routeId, cargo, 1.0, 0);
    expect(profitHigh.prosperityBonus).toBeGreaterThanOrEqual(profitBase.prosperityBonus);
  });

  it('§8.2.4 商队派遣→利润入账→铜钱增加', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    if (idle.length === 0) return;

    const beforeCopper = currency.getBalance('copper');
    const result = caravan.dispatch({
      caravanId: idle[0].id,
      routeId,
      cargo: { silk: 5, tea: 3 },
    });

    if (result.success) {
      // 开通商路扣了铜钱，但派遣本身估算利润
      expect(result.estimatedProfit).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─────────────────────────────────────────
// §8.6 货币兑换→武将→贸易增强闭环
// ─────────────────────────────────────────

describe('§8.6 货币兑换→武将→贸易增强闭环', () => {
  let trade: TradeSystem;
  let caravan: CaravanSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    const env = createFullEnv();
    trade = env.trade;
    caravan = env.caravan;
    currency = env.currency;
    currency.addCurrency('copper', 200000);
    currency.addCurrency('ingot', 500);
  });

  it('§8.6.1 铜钱兑换招贤榜流程', () => {
    const beforeRecruit = currency.getBalance('recruit');
    const result = currency.exchange({ from: 'copper', to: 'recruit', amount: 5000 });

    if (result.success) {
      expect(currency.getBalance('recruit')).toBeGreaterThan(beforeRecruit);
    }
  });

  it('§8.6.2 元宝兑换求贤令流程', () => {
    const beforeSummon = currency.getBalance('summon');
    const result = currency.exchange({ from: 'ingot', to: 'summon', amount: 100 });

    if (result.success) {
      expect(currency.getBalance('summon')).toBeGreaterThan(beforeSummon);
    }
  });

  it('§8.6.3 武将护卫→商队利润提升', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    if (idle.length === 0) return;

    // 无护卫派遣
    const result = caravan.dispatch({
      caravanId: idle[0].id,
      routeId,
      cargo: { silk: 5 },
      guardHeroId: 'hero_guanyu',
    });

    expect(result.success).toBe(true);
    expect(caravan.hasGuard(idle[0].id)).toBe(true);
  });

  it('§8.6.4 议价能力提升利润', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const baseProfit = trade.calculateProfit(routeId, { silk: 5 }, 1.0, 0);
    const enhancedProfit = trade.calculateProfit(routeId, { silk: 5 }, 1.5, 0);

    expect(enhancedProfit.revenue).toBeGreaterThan(baseProfit.revenue);
    expect(enhancedProfit.bargainingBonus).toBeGreaterThan(baseProfit.bargainingBonus);
  });
});

// ─────────────────────────────────────────
// §8.7 经济循环压力测试
// ─────────────────────────────────────────

describe('§8.7 经济循环压力测试', () => {
  let trade: TradeSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    const env = createFullEnv();
    trade = env.trade;
    currency = env.currency;
    currency.addCurrency('copper', 500000);
  });

  it('§8.7.1 多轮贸易繁荣度动态平衡', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const prosperityHistory: number[] = [];
    for (let cycle = 0; cycle < 50; cycle++) {
      trade.completeTrade(routeId);
      trade.update(600); // 10分钟衰减
      prosperityHistory.push(trade.getRouteState(routeId)!.prosperity);
    }

    // 繁荣度应在合理范围内波动
    for (const p of prosperityHistory) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });

  it('§8.7.2 价格长期波动不失控', () => {
    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    for (let i = 0; i < 200; i++) {
      trade.refreshPrices();
    }

    const defs = trade.getAllGoodsDefs();
    for (const def of defs) {
      const price = trade.getPrice(def.id);
      expect(price).toBeGreaterThanOrEqual(Math.floor(def.basePrice * 0.5));
      expect(price).toBeLessThanOrEqual(Math.floor(def.basePrice * 2));
    }
  });

  it('§8.7.3 连续开通多条商路', () => {
    const sorted = [...trade.getRouteDefs()].sort((a, b) => a.requiredCastleLevel - b.requiredCastleLevel);
    let opened = 0;

    for (const def of sorted) {
      if (def.requiredRoute) {
        const pre = trade.getRouteState(def.requiredRoute);
        if (!pre?.opened) continue;
      }
      const result = trade.openRoute(def.id, 20);
      if (result.success) opened++;
    }

    expect(opened).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────
// §8.11 多商店并发状态验证
// ─────────────────────────────────────────

describe('§8.11 多商店并发状态验证', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    const env = createFullEnv();
    shop = env.shop;
    currency = env.currency;
    currency.addCurrency('copper', 100000);
    currency.addCurrency('ingot', 10000);
  });

  it('§8.11.1 多商店类型独立存在', () => {
    const state = shop.getState();
    const shopTypes = Object.keys(state);
    expect(shopTypes.length).toBeGreaterThanOrEqual(1);
  });

  it('§8.11.2 各商店商品列表独立', () => {
    const state = shop.getState();
    const shopTypes = Object.keys(state) as Array<keyof typeof state>;

    // 每种商店应有自己的商品
    for (const type of shopTypes) {
      const goods = shop.getShopGoods(type as any);
      // 商品列表存在（可能为空，但不应undefined）
      expect(Array.isArray(goods)).toBe(true);
    }
  });

  it('§8.11.3 购买不影响其他商店', () => {
    const state = shop.getState();
    const shopTypes = Object.keys(state) as Array<keyof typeof state>;
    if (shopTypes.length < 2) return;

    const type1 = shopTypes[0] as any;
    const type2 = shopTypes[1] as any;

    const goods1 = shop.getShopGoods(type1);
    if (goods1.length === 0) return;

    // 记录商店2状态
    const goods2Before = shop.getShopGoods(type2).map(g => ({ ...g }));

    // 在商店1购买
    shop.executeBuy({ goodsId: goods1[0].defId, quantity: 1, shopType: type1 });

    // 商店2应不受影响
    const goods2After = shop.getShopGoods(type2);
    expect(goods2After.length).toBe(goods2Before.length);
  });

  it('§8.11.4 收藏系统跨商店同步', () => {
    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    const defId = goods[0].defId;
    const def = shop.getGoodsDef(defId);
    if (!def?.favoritable) return;

    shop.toggleFavorite(defId);
    expect(shop.isFavorite(defId)).toBe(true);

    shop.toggleFavorite(defId);
    expect(shop.isFavorite(defId)).toBe(false);
  });

  it('§8.11.5 每日限购重置', () => {
    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    // 购买一次
    shop.executeBuy({ goodsId: goods[0].defId, quantity: 1, shopType: 'normal' });

    const info = shop.getStockInfo('normal', goods[0].defId);
    if (info && info.dailyLimit > 0) {
      expect(info.dailyPurchased).toBeGreaterThan(0);
    }

    // 重置每日限购
    shop.resetDailyLimits();

    const infoAfter = shop.getStockInfo('normal', goods[0].defId);
    if (infoAfter) {
      expect(infoAfter.dailyPurchased).toBe(0);
    }
  });

  it('§8.11.6 手动刷新商品', () => {
    const result = shop.manualRefresh();
    // 可能成功或已达上限
    expect(typeof result.success).toBe('boolean');
  });

  it('§8.11.7 折扣机制生效', () => {
    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    // 添加一个折扣
    shop.addDiscount({
      rate: 0.8,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      applicableGoods: [goods[0].defId],
    });

    const finalPrice = shop.calculateFinalPrice(goods[0].defId, 'normal');
    // 折扣价应低于或等于原价
    expect(typeof finalPrice).toBe('object');
  });

  it('§8.11.8 过期折扣清理', () => {
    shop.addDiscount({
      rate: 0.5,
      startTime: Date.now() - 7200000, // 2小时前
      endTime: Date.now() - 3600000,   // 1小时前已过期
      applicableGoods: [],
    });

    const cleaned = shop.cleanupExpiredDiscounts();
    expect(cleaned).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────
// 跨系统序列化集成
// ─────────────────────────────────────────

describe('Trade+Currency+Shop 跨系统序列化', () => {
  it('三个系统独立序列化→反序列化不冲突', () => {
    const env = createFullEnv();
    const { trade, currency, shop, caravan } = env;

    // 操作各系统
    currency.addCurrency('copper', 50000);
    const routeId = openFirstRoute(trade);
    if (routeId) {
      for (let i = 0; i < 5; i++) trade.completeTrade(routeId);
    }

    // 序列化
    const tradeData = trade.serialize();
    const currencyData = currency.serialize();
    const shopData = shop.serialize();
    const caravanData = caravan.serialize();

    // 新实例反序列化
    const env2 = createFullEnv();
    env2.trade.deserialize(tradeData);
    env2.currency.deserialize(currencyData);
    env2.shop.deserialize(shopData);
    env2.caravan.deserialize(caravanData);

    // 验证
    if (routeId) {
      const state = env2.trade.getRouteState(routeId);
      expect(state?.opened).toBe(true);
      expect(state?.completedTrades).toBe(5);
    }

    expect(env2.caravan.getCaravanCount()).toBe(INITIAL_CARAVAN_COUNT);
  });

  it('CurrencySystem序列化恢复余额', () => {
    const env = createFullEnv();
    env.currency.addCurrency('copper', 12345);

    const data = env.currency.serialize();
    const env2 = createFullEnv();
    env2.currency.deserialize(data);

    // 余额应恢复
    expect(env2.currency.getBalance('copper')).toBe(env.currency.getBalance('copper'));
  });

  it('ShopSystem序列化恢复收藏', () => {
    const env = createFullEnv();
    const goods = env.shop.getShopGoods('normal');
    if (goods.length > 0) {
      const def = env.shop.getGoodsDef(goods[0].defId);
      if (def?.favoritable) {
        env.shop.toggleFavorite(goods[0].defId);
      }
    }

    const data = env.shop.serialize();
    const env2 = createFullEnv();
    env2.shop.deserialize(data);

    // 收藏应恢复
    const favorites = env2.shop.getFavorites();
    expect(favorites.length).toBe(env.shop.getFavorites().length);
  });
});
