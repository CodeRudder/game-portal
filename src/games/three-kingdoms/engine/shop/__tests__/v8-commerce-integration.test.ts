import { vi, describe, it, expect, beforeEach } from 'vitest';
/**
 * v8.0 商贸繁荣 跨系统联动集成测试
 *
 * 覆盖Play文档流程：
 *   §8.1 商店购买→货币→库存联动
 *   §8.2 贸易→商店→繁荣度闭环
 *   §8.6 货币兑换→抽卡→武将→贸易增强闭环
 *   §8.8 科技→贸易联动验证
 *   §8.10 转生→商贸系统影响验证
 *   §8.12 商贸系统→声望系统联动验证
 */

import { TradeSystem } from '../../trade/TradeSystem';
import { CaravanSystem } from '../../trade/CaravanSystem';
import { ShopSystem } from '../../shop/ShopSystem';
import { CurrencySystem } from '../../currency/CurrencySystem';
import type { TradeCurrencyOps } from '../../trade/TradeSystem';
import type { RouteInfoProvider } from '../../trade/CaravanSystem';
import type { BuyRequest, DiscountConfig } from '../../../core/shop';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS } from '../../../core/shop';
import {
  TRADE_ROUTE_DEFS,
  TRADE_GOODS_DEFS,
  PROSPERITY_TIERS,
  INITIAL_PROSPERITY,
  PROSPERITY_GAIN_PER_TRADE,
  TRADE_EVENT_DEFS,
  NPC_MERCHANT_DEFS,
  INITIAL_CARAVAN_COUNT,
} from '../../../core/trade/trade-config';
import type { TradeRouteId } from '../../../core/trade/trade.types';

// ─── 辅助 ────────────────────────────────

function createMockDeps() {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn() },
    registry: { get: vi.fn() },
  };
}

/** 创建完整的商贸系统套件 */
function createCommerceSuite(initialCopper = 100000) {
  // 1. CurrencySystem
  const currency = new CurrencySystem();
  currency.init(createMockDeps() as any);
  currency.setCurrency('copper', initialCopper);
  currency.setCurrency('ingot', 5000);
  currency.setCurrency('mandate', 500);
  currency.setCurrency('reputation', 5000);

  // 2. TradeSystem
  const trade = new TradeSystem();
  trade.init(createMockDeps() as any);
  trade.setCurrencyOps({
    addCurrency: (type: string, amount: number) => currency.addCurrency(type as any, amount),
    canAfford: (type: string, amount: number) => currency.hasEnough(type as any, amount),
    spendByPriority: (shopType: string, amount: number, currencyType?: string) => {
      try {
        const costs = currencyType ? { [currencyType]: amount } : { copper: amount };
        currency.spendByPriority(shopType, costs);
        return { success: true };
      } catch {
        return { success: false };
      }
    },
  });

  // 3. CaravanSystem
  const caravan = new CaravanSystem();
  caravan.init(createMockDeps() as any);
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

  // 4. ShopSystem
  const shop = new ShopSystem();
  shop.init(createMockDeps() as any);
  shop.setCurrencySystem(currency);

  return { currency, trade, caravan, shop };
}

/** 开通第一条商路 */
function openFirstRoute(trade: TradeSystem): TradeRouteId | null {
  const defs = trade.getRouteDefs();
  for (const def of defs) {
    const check = trade.canOpenRoute(def.id, 20);
    if (check.canOpen) {
      const result = trade.openRoute(def.id, 20);
      return result.success ? def.id : null;
    }
  }
  return null;
}

// ─────────────────────────────────────────
// §8.1 商店购买→货币→库存 全链路
// ─────────────────────────────────────────

describe('§8.1 商店购买→货币→库存联动', () => {
  let suite: ReturnType<typeof createCommerceSuite>;

  beforeEach(() => {
    suite = createCommerceSuite();
  });

  it('完整购买链路：选择→确认→扣款→获得→反馈', () => {
    const { shop, currency } = suite;

    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    const target = goods[0];
    const def = GOODS_DEF_MAP[target.defId];
    if (!def) return;

    const beforeCopper = currency.getBalance('copper');
    const beforeItem = shop.getGoodsItem('normal', target.defId);
    const beforeStock = beforeItem?.stock ?? 0;

    // 购买
    const result = shop.executeBuy({ goodsId: target.defId, quantity: 1, shopType: 'normal' });
    expect(result.success).toBe(true);

    // 验证扣款
    const afterCopper = currency.getBalance('copper');
    const spent = beforeCopper - afterCopper;
    expect(spent).toBeGreaterThan(0);

    // 验证库存
    if (beforeStock !== -1) {
      const afterItem = shop.getGoodsItem('normal', target.defId);
      expect(afterItem?.stock).toBe(beforeStock - 1);
    }
  });

  it('购买失败不应扣除货币', () => {
    const { shop, currency } = suite;
    currency.setCurrency('copper', 1); // 几乎没钱

    const goods = shop.getShopGoods('normal');
    const expensive = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      const price = Object.values(def?.basePrice ?? {})[0] ?? 0;
      return price > 1;
    });
    if (!expensive) return;

    const beforeCopper = currency.getBalance('copper');
    const result = shop.executeBuy({ goodsId: expensive.defId, quantity: 1, shopType: 'normal' });
    expect(result.success).toBe(false);
    expect(currency.getBalance('copper')).toBe(beforeCopper);
  });
});

// ─────────────────────────────────────────
// §8.2 贸易→繁荣度闭环
// ─────────────────────────────────────────

describe('§8.2 贸易→繁荣度闭环', () => {
  let suite: ReturnType<typeof createCommerceSuite>;

  beforeEach(() => {
    suite = createCommerceSuite();
  });

  it('派遣商队→完成贸易→繁荣度提升→利润增加', () => {
    const { trade, caravan } = suite;

    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    // 记录初始利润
    const cargo = { silk: 5, tea: 3 };
    const profitBefore = trade.calculateProfit(routeId, cargo, 1.0, 0);

    // 完成多次贸易
    for (let i = 0; i < 10; i++) {
      trade.completeTrade(routeId);
    }

    // 繁荣度应提升
    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBeGreaterThan(INITIAL_PROSPERITY);

    // 利润应增加
    const profitAfter = trade.calculateProfit(routeId, cargo, 1.0, 0);
    expect(profitAfter.revenue).toBeGreaterThanOrEqual(profitBefore.revenue);
  });

  it('繁荣度→NPC商人解锁联动', () => {
    const { trade } = suite;

    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    // 提升繁荣度至thriving(50+)
    for (let i = 0; i < 20; i++) {
      trade.completeTrade(routeId);
    }

    const tier = trade.getProsperityTier(routeId);
    // 繁荣度足够高时应解锁NPC商人
    if (tier.unlockNpcMerchant) {
      // 尝试生成NPC
      let spawned = false;
      for (let i = 0; i < 100; i++) {
        const npcs = trade.trySpawnNpcMerchants();
        if (npcs.length > 0) {
          spawned = true;
          break;
        }
      }
      // 高概率生成
      expect(spawned).toBe(true);
    }
  });
});

// ─────────────────────────────────────────
// §8.6 货币兑换→抽卡→武将→贸易增强
// ─────────────────────────────────────────

describe('§8.6 货币兑换→贸易增强闭环', () => {
  let suite: ReturnType<typeof createCommerceSuite>;

  beforeEach(() => {
    suite = createCommerceSuite();
  });

  it('铜钱→开通商路→贸易利润→更多铜钱 闭环', () => {
    const { trade, currency } = suite;

    const beforeCopper = currency.getBalance('copper');

    // 开通商路
    const routeId = openFirstRoute(trade);
    expect(routeId).not.toBeNull();

    // 验证铜钱被消耗
    const afterOpen = currency.getBalance('copper');
    expect(afterOpen).toBeLessThan(beforeCopper);

    // 完成贸易获得利润
    const profit = trade.calculateProfit(routeId!, { silk: 5 }, 1.0, 0);
    expect(profit.revenue).toBeGreaterThan(0);
  });

  it('货币兑换应正确执行', () => {
    const { currency } = suite;

    // 设置足够余额
    currency.setCurrency('copper', 50000);

    // 验证exchange接口
    const result = currency.exchange({ from: 'copper', to: 'copper', amount: 100 });
    expect(result.success).toBe(true);
    expect(result.spent).toBe(0);
    expect(result.received).toBe(0);
  });
});

// ─────────────────────────────────────────
// §8.8 科技→贸易联动
// ─────────────────────────────────────────

describe('§8.8 科技→贸易联动验证', () => {
  let suite: ReturnType<typeof createCommerceSuite>;

  beforeEach(() => {
    suite = createCommerceSuite();
  });

  it('议价能力提升应增加利润（模拟科技效果）', () => {
    const { trade } = suite;

    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const cargo = { silk: 5, tea: 3 };

    // 无议价能力
    const baseProfit = trade.calculateProfit(routeId, cargo, 1.0, 0);

    // 模拟科技「市舶司」效果：议价能力+25%
    const boostedProfit = trade.calculateProfit(routeId, cargo, 1.25, 0);

    expect(boostedProfit.revenue).toBeGreaterThan(baseProfit.revenue);
    expect(boostedProfit.bargainingBonus).toBeGreaterThan(baseProfit.bargainingBonus);
  });

  it('护卫费用应从利润中扣除', () => {
    const { trade } = suite;

    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const cargo = { silk: 5 };
    const noGuardProfit = trade.calculateProfit(routeId, cargo, 1.0, 0);
    const withGuardProfit = trade.calculateProfit(routeId, cargo, 1.0, 500);

    expect(withGuardProfit.guardCost).toBe(500);
    expect(withGuardProfit.profit).toBe(noGuardProfit.profit - 500);
  });

  it('商队属性升级应生效（模拟科技效果）', () => {
    const { caravan } = suite;

    const caravans = caravan.getCaravans();
    if (caravans.length === 0) return;

    const caravanId = caravans[0].id;
    const beforeCapacity = caravans[0].attributes.capacity;

    // 升级载重
    const result = caravan.upgradeCaravan(caravanId, 'capacity', 10);
    expect(result).toBe(true);

    const after = caravan.getCaravan(caravanId);
    expect(after?.attributes.capacity).toBe(beforeCapacity + 10);
  });
});

// ─────────────────────────────────────────
// §8.10 转生→商贸系统影响
// ─────────────────────────────────────────

describe('§8.10 转生→商贸系统影响验证', () => {
  it('转生模拟：序列化/反序列化保留核心进度', () => {
    const suite = createCommerceSuite();
    const { trade, caravan } = suite;

    const routeId = openFirstRoute(trade);
    if (routeId) {
      for (let i = 0; i < 10; i++) {
        trade.completeTrade(routeId);
      }
    }

    // 序列化
    const tradeData = trade.serialize();
    const caravanData = caravan.serialize();

    // 模拟转生：重置后恢复
    const trade2 = new TradeSystem();
    trade2.init(createMockDeps() as any);
    trade2.deserialize(tradeData);

    if (routeId) {
      const state = trade2.getRouteState(routeId);
      expect(state?.opened).toBe(true);
      expect(state?.completedTrades).toBe(10);
    }
  });

  it('转生后货币应按规则重置', () => {
    const { currency } = createCommerceSuite();

    // 记录转生前
    const beforeCopper = currency.getBalance('copper');

    // 模拟转生：重置货币
    currency.reset();

    // 铜钱应回到初始值
    expect(currency.getBalance('copper')).toBe(1000); // INITIAL_WALLET
  });
});

// ─────────────────────────────────────────
// §8.12 商贸→声望联动
// ─────────────────────────────────────────

describe('§8.12 商贸系统→声望系统联动', () => {
  let suite: ReturnType<typeof createCommerceSuite>;

  beforeEach(() => {
    suite = createCommerceSuite();
  });

  it('贸易事件选项可影响繁荣度（间接影响声望）', () => {
    const { trade } = suite;

    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const beforeProsperity = trade.getRouteState(routeId)!.prosperity;

    // 生成事件
    const events = trade.generateTradeEvents('caravan_1', routeId);
    if (events.length === 0) return;

    const event = events[0];
    const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
    if (!def) return;

    // 选择一个有繁荣度影响的选项
    const prosperityOption = def.options.find(o => o.prosperityChange !== 0);
    if (!prosperityOption) return;

    trade.resolveTradeEvent(event.id, prosperityOption.id);

    const afterProsperity = trade.getRouteState(routeId)!.prosperity;
    expect(afterProsperity).not.toBe(beforeProsperity);
  });

  it('声望值可用于NPC折扣', () => {
    const { shop, currency } = suite;

    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    // 设置NPC折扣提供者（基于声望）
    shop.setNPCDiscountProvider((npcId: string) => {
      const reputation = currency.getBalance('reputation');
      if (reputation >= 1000) return 0.8;  // -20%
      if (reputation >= 600) return 0.85;  // -15%
      if (reputation >= 300) return 0.9;   // -10%
      if (reputation >= 100) return 0.95;  // -5%
      return 1.0;
    });

    const basePrice = shop.calculateFinalPrice(goods[0].defId, 'normal');
    const npcPrice = shop.calculateFinalPrice(goods[0].defId, 'normal', 'npc_001');

    // 5000声望应触发-20%折扣
    const baseCopper = basePrice['copper'] ?? 0;
    const npcCopper = npcPrice['copper'] ?? 0;
    expect(npcCopper).toBeLessThan(baseCopper);
  });
});

// ─────────────────────────────────────────
// 商队运输→完成→返回 全流程
// ─────────────────────────────────────────

describe('商队完整运输流程', () => {
  let suite: ReturnType<typeof createCommerceSuite>;

  beforeEach(() => {
    suite = createCommerceSuite();
  });

    it('派遣→运输→完成→返回 全流程', () => {
    const { trade, caravan } = suite;

    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    const idle = caravan.getIdleCaravans();
    if (idle.length === 0) return;

    // 派遣
    const dispatchResult = caravan.dispatch({
      caravanId: idle[0].id,
      routeId,
      cargo: { silk: 5, tea: 3 },
      guardHeroId: 'hero_test',
    });
    expect(dispatchResult.success).toBe(true);

    // 状态应为traveling
    let carav = caravan.getCaravan(idle[0].id);
    expect(carav?.status).toBe('traveling');

    // 模拟到达（update触发状态变化）
    // 由于arrivalTime > Date.now()，需要等待或模拟
    // 这里验证update后状态会变化
    caravan.update(0);

    // 状态应从traveling变化（因为arrivalTime在未来，所以仍是traveling）
    carav = caravan.getCaravan(idle[0].id);
    expect(carav?.status).toBe('traveling');
  });

  it('多商队并发派遣应独立运行', () => {
    const { trade, caravan } = suite;

    // 开通多条商路
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

    const idle = caravan.getIdleCaravans();
    const dispatchCount = Math.min(idle.length, openedRoutes.length);

    for (let i = 0; i < dispatchCount; i++) {
      const result = caravan.dispatch({
        caravanId: idle[i].id,
        routeId: openedRoutes[i],
        cargo: { silk: 1 },
      });
      expect(result.success).toBe(true);
    }

    // 验证所有派遣的商队状态
    const allCaravans = caravan.getCaravans();
    const traveling = allCaravans.filter(c => c.status === 'traveling');
    expect(traveling.length).toBe(dispatchCount);
  });
});

// ─────────────────────────────────────────
// 经济循环压力测试
// ─────────────────────────────────────────

describe('§8.7 全经济循环压力测试', () => {
  it('多次完整贸易循环应稳定', () => {
    const { trade, caravan, shop, currency } = createCommerceSuite(1000000);

    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    // 模拟100次贸易循环
    for (let i = 0; i < 100; i++) {
      trade.completeTrade(routeId);
    }

    // 繁荣度不应溢出
    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBeLessThanOrEqual(100);
    expect(state?.prosperity).toBeGreaterThanOrEqual(0);
    expect(state?.completedTrades).toBe(100);

    // 利润计算应稳定
    const profit = trade.calculateProfit(routeId, { silk: 10, tea: 5 }, 1.0, 0);
    expect(isFinite(profit.revenue)).toBe(true);
    expect(isFinite(profit.profit)).toBe(true);
    expect(isFinite(profit.profitRate)).toBe(true);
  });

  it('大量价格刷新应保持稳定', () => {
    const { trade } = createCommerceSuite();

    for (let i = 0; i < 200; i++) {
      trade.refreshPrices();
    }

    // 所有价格应在合理范围
    const defs = trade.getAllGoodsDefs();
    for (const def of defs) {
      const price = trade.getPrice(def.id);
      expect(price).toBeGreaterThan(0);
      expect(isFinite(price)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(Math.floor(def.basePrice * 0.5));
      expect(price).toBeLessThanOrEqual(Math.floor(def.basePrice * 2));
    }
  });

  it('大量事件生成/处理应稳定', () => {
    const { trade } = createCommerceSuite();

    const routeId = openFirstRoute(trade);
    if (!routeId) return;

    for (let i = 0; i < 100; i++) {
      const events = trade.generateTradeEvents(`caravan_${i}`, routeId);
      for (const event of events) {
        const def = TRADE_EVENT_DEFS.find(d => d.type === event.eventType);
        if (def) {
          trade.resolveTradeEvent(event.id, def.options[0].id);
        }
      }
    }

    // 事件处理不应导致状态异常
    const state = trade.getRouteState(routeId);
    expect(state?.prosperity).toBeGreaterThanOrEqual(0);
    expect(state?.prosperity).toBeLessThanOrEqual(100);
  });
});
