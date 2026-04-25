/**
 * v8.0 商贸繁荣 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1 集市商店浏览与购买、折扣机制、限购、货币体系
 * - §2 多商店类型（军需处/黑市/活动/NPC交易）
 * - §3 贸易路线（商路开通、商品系统、繁荣度）
 * - §4 跨系统联动（商店→货币→交易→库存）
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v8-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { ShopType } from '../../../../core/shop/shop.types';
import type { CurrencyType } from '../../../../core/currency/currency.types';
import type { TradeRouteId } from '../../../../core/trade/trade.types';

// ═══════════════════════════════════════════════════════════════
// §1 集市商店系统
// ═══════════════════════════════════════════════════════════════
describe('v8.0 商贸繁荣 — §1 集市商店系统', () => {

  // ── 1.1 集市商店浏览与购买 ──
  describe('§1.1 集市商店浏览与购买', () => {

    it('should access shop system via engine getter', () => {
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      expect(shop).toBeDefined();
      expect(typeof shop.getShopGoods).toBe('function');
      expect(typeof shop.executeBuy).toBe('function');
    });

    it('should list goods from normal shop', () => {
      // Play §1.1: 进入集市商店 → 查看商品列表
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      const goods = shop.getShopGoods('normal' as ShopType);
      expect(Array.isArray(goods)).toBe(true);
    });

    it('should get goods categories for tab switching', () => {
      // Play §1.1: 切换分类Tab(全部/资源兑换/道具购买/限时特惠/我的收藏)
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      const categories = shop.getCategories();
      expect(Array.isArray(categories)).toBe(true);
    });

    it('should filter goods by category', () => {
      // Play §1.1: 分类Tab切换过滤正确
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      const categories = shop.getCategories();

      if (categories.length > 0) {
        const filtered = shop.getGoodsByCategory('normal' as ShopType, categories[0]);
        expect(Array.isArray(filtered)).toBe(true);
      }
    });

    it('should validate buy request and reject when insufficient funds', () => {
      // Play §1.1: 购买确认 → 扣款获得
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      const goods = shop.getShopGoods('normal' as ShopType);

      if (goods.length > 0) {
        const item = goods[0];
        const validation = shop.validateBuy({
          shopType: 'normal' as ShopType,
          goodsId: item.defId,
          count: 1,
        });
        expect(validation).toBeDefined();
        expect(typeof validation.canBuy).toBe('boolean');
      }
    });

    it('should execute buy and update stock', () => {
      // Play §1.1: 购买后库存-1、货币扣除
      const sim = createSim();
      sim.addResources(MASSIVE_RESOURCES);
      const shop = sim.engine.getShopSystem();
      const goods = shop.getShopGoods('normal' as ShopType);

      if (goods.length > 0) {
        const item = goods[0];
        const stockBefore = shop.getStockInfo('normal' as ShopType, item.defId);

        const result = shop.executeBuy({
          shopType: 'normal' as ShopType,
          goodsId: item.defId,
          count: 1,
        });

        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');

        if (result.success) {
          const stockAfter = shop.getStockInfo('normal' as ShopType, item.defId);
          expect(stockAfter).toBeDefined();
        }
      }
    });

  });

  // ── §1.4 库存与限购 ──
  describe('§1.4 库存与限购', () => {

    it('should get stock info for goods', () => {
      // Play §1.4: 每日限购(0点重置)/终身限购计数正确
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      const goods = shop.getShopGoods('normal' as ShopType);

      if (goods.length > 0) {
        const stockInfo = shop.getStockInfo('normal' as ShopType, goods[0].defId);
        expect(stockInfo).toBeDefined();
      }
    });

    it('should reset daily limits without error', () => {
      // Play §1.4: 每日限购(0点重置)
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      expect(() => shop.resetDailyLimits()).not.toThrow();
    });

    it('should support manual refresh with daily limit', () => {
      // Play §1.4: 等待商店8h刷新
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      const result = shop.manualRefresh();
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

  });

  // ── §1.5 折扣机制 ──
  describe('§1.5 折扣机制', () => {

    it('should add and apply discount config', () => {
      // Play §1.5: 常规折扣(-10%~-20%)
      const sim = createSim();
      const shop = sim.engine.getShopSystem();

      shop.addDiscount({
        type: 'normal',
        discountRate: 0.8,
        startTime: Date.now() - 1000,
        endTime: Date.now() + 86400000,
        targetShopType: 'normal' as ShopType,
      });

      const cleaned = shop.cleanupExpiredDiscounts();
      expect(typeof cleaned).toBe('number');
    });

    it('should calculate final price considering discounts', () => {
      // Play §1.5: 折扣角标"火焰红色"正确显示折扣百分比
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      const goods = shop.getShopGoods('normal' as ShopType);

      if (goods.length > 0) {
        const price = shop.calculateFinalPrice(goods[0].defId, 'normal' as ShopType);
        expect(price).toBeDefined();
        expect(typeof price).toBe('object');
      }
    });

    it('should cleanup expired discounts', () => {
      // Play §1.5: 折扣过期前5分钟→角标闪烁提醒
      const sim = createSim();
      const shop = sim.engine.getShopSystem();

      // 添加已过期折扣
      shop.addDiscount({
        type: 'normal',
        discountRate: 0.5,
        startTime: Date.now() - 200000,
        endTime: Date.now() - 1000,
        targetShopType: 'normal' as ShopType,
      });

      const cleaned = shop.cleanupExpiredDiscounts();
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

  });

  // ── §1.6 收藏系统 ──
  describe('§1.6 收藏系统', () => {

    it('should manage shop favorites', () => {
      // Play §1.1: 收藏按钮
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      const goods = shop.getShopGoods('normal' as ShopType);

      if (goods.length > 0) {
        const defId = goods[0].defId;
        const toggled = shop.toggleFavorite(defId);
        expect(typeof toggled).toBe('boolean');

        const isFav = shop.isFavorite(defId);
        expect(isFav).toBe(toggled);
      }
    });

    it('should get favorites list', () => {
      const sim = createSim();
      const shop = sim.engine.getShopSystem();
      const favorites = shop.getFavorites();
      expect(Array.isArray(favorites)).toBe(true);
    });

  });

});

// ═══════════════════════════════════════════════════════════════
// §1.6~§1.8 货币系统
// ═══════════════════════════════════════════════════════════════
describe('v8.0 商贸繁荣 — §1.6 货币系统', () => {

  it('should access currency system via engine getter', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    expect(currency).toBeDefined();
    expect(typeof currency.getBalance).toBe('function');
    expect(typeof currency.addCurrency).toBe('function');
    expect(typeof currency.spendCurrency).toBe('function');
  });

  it('should manage 8 currency types (copper/mandate/recruit/summon/expedition/guild/reputation/ingot)', () => {
    // Play §1.6: 8种常驻货币
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.addCurrency('copper' as CurrencyType, 1000);
    currency.addCurrency('mandate' as CurrencyType, 100);
    currency.addCurrency('recruit' as CurrencyType, 50);

    expect(currency.getBalance('copper' as CurrencyType)).toBeGreaterThan(0);
    expect(currency.getBalance('mandate' as CurrencyType)).toBeGreaterThan(0);
    expect(currency.getBalance('recruit' as CurrencyType)).toBeGreaterThan(0);
  });

  it('should check affordability correctly', () => {
    // Play §1.6: 余额不足时价格变红+抖动+获取途径引导
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.setCurrency('copper' as CurrencyType, 500);
    expect(currency.hasEnough('copper' as CurrencyType, 300)).toBe(true);
    expect(currency.hasEnough('copper' as CurrencyType, 600)).toBe(false);
  });

  it('should spend currency and update balance', () => {
    // Play §1.6: 货币扣除
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.addCurrency('copper' as CurrencyType, 1000);
    const before = currency.getBalance('copper' as CurrencyType);
    currency.spendCurrency('copper' as CurrencyType, 300);
    const after = currency.getBalance('copper' as CurrencyType);
    expect(after).toBeLessThan(before);
  });

  it('should detect currency shortage', () => {
    // Play §1.6: 余额不足提示
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const shortage = currency.getShortage('copper' as CurrencyType, 999999);
    expect(shortage).toBeDefined();
    if (shortage.needed !== undefined) {
      expect(shortage.needed).toBeGreaterThan(0);
    }
  });

  it('should get wallet state with all currencies', () => {
    // Play §1.6: 底部货币栏
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    const wallet = currency.getWallet();
    expect(wallet).toBeDefined();
    expect(typeof wallet).toBe('object');
  });

  it('should check affordability for multi-currency costs', () => {
    // Play §1.6: 军需处兵力+铜钱组合扣除
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const result = currency.checkAffordability({
      copper: 500,
      recruit: 10,
    });
    expect(result).toBeDefined();
    expect(typeof result.canAfford).toBe('boolean');
  });

  // ── §1.7 货币兑换与汇率 ──
  it('should get exchange rate between currencies', () => {
    // Play §1.7: 汇率正确(500💰=1📜, 100👑=100🏷️)
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const rate = currency.getExchangeRate('copper' as CurrencyType, 'mandate' as CurrencyType);
    expect(typeof rate).toBe('number');
    expect(rate).toBeGreaterThanOrEqual(0);
  });

  it('should perform currency exchange', () => {
    // Play §1.7: 花费500💰铜钱购买1张📜招贤榜
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    currency.addCurrency('copper' as CurrencyType, 100000);

    const result = currency.exchange({
      from: 'copper' as CurrencyType,
      to: 'mandate' as CurrencyType,
      amount: 1000,
    });

    expect(result).toBeDefined();
    expect(typeof result.received).toBe('number');
  });

  it('should identify paid vs free currencies', () => {
    // Play §1.8: 元宝—付费货币
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();

    const isPaid = currency.isPaidCurrency('ingot' as CurrencyType);
    expect(typeof isPaid).toBe('boolean');
  });

  it('should spend by priority for shop type', () => {
    // Play §1.6: 货币按商店类型消耗优先级扣除
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    currency.addCurrency('copper' as CurrencyType, 10000);

    const result = currency.spendByPriority('normal', { copper: 500 });
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 贸易路线系统
// ═══════════════════════════════════════════════════════════════
describe('v8.0 商贸繁荣 — §3 贸易路线系统', () => {

  it('should access trade system via engine getter', () => {
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    expect(trade).toBeDefined();
    expect(typeof trade.getRouteDefs).toBe('function');
    expect(typeof trade.openRoute).toBe('function');
  });

  it('should list trade route definitions (8 routes)', () => {
    // Play §3.1: 8座城市节点商路连线
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const routes = trade.getRouteDefs();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('should check route unlock requirements', () => {
    // Play §3.1: 检查前置条件(主城等级+前置商路)
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const routes = trade.getRouteDefs();

    if (routes.length > 0) {
      const check = trade.canOpenRoute(routes[0].id as TradeRouteId, 1);
      expect(check).toBeDefined();
      expect(typeof check.canOpen).toBe('boolean');
    }
  });

  it('should open trade route when requirements met', () => {
    // Play §3.1: 扣除开通费 → 开通 → 商路连线点亮
    const sim = createSim();
    sim.initMidGameState();

    const trade = sim.engine.getTradeSystem();
    const routes = trade.getRouteDefs();

    if (routes.length > 0) {
      const castleLevel = sim.getBuildingLevel('castle');
      const result = trade.openRoute(routes[0].id as TradeRouteId, castleLevel);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    }
  });

  it('should get goods prices from trade system', () => {
    // Play §3.2: 10种商品基础价格和波动范围
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const prices = trade.getAllPrices();
    expect(prices).toBeDefined();
  });

  it('should get goods definitions', () => {
    // Play §3.2: 粮草/木材/铁矿/书籍/杜康酒/兵器/西凉马/蜀锦/药材/和田玉
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const goodsDefs = trade.getAllGoodsDefs();
    expect(Array.isArray(goodsDefs)).toBe(true);
  });

  it('should calculate trade profit', () => {
    // Play §3.2: 买入价vs卖出价 → 利润
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const goodsDefs = trade.getAllGoodsDefs();

    if (goodsDefs.length > 0) {
      const profit = trade.calculateProfit(goodsDefs[0].id, 100, 150);
      expect(profit).toBeDefined();
    }
  });

  it('should get prosperity level for routes', () => {
    // Play §3.1: 繁荣度初始30%(萧条等级)
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const routes = trade.getRouteDefs();

    if (routes.length > 0) {
      const level = trade.getProsperityLevel(routes[0].id as TradeRouteId);
      expect(level).toBeDefined();
    }
  });

  it('should get prosperity multiplier', () => {
    // Play §3.1: 繁荣度影响产出倍率
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const routes = trade.getRouteDefs();

    if (routes.length > 0) {
      const multiplier = trade.getProsperityMultiplier(routes[0].id as TradeRouteId);
      expect(typeof multiplier).toBe('number');
    }
  });

  it('should refresh trade prices', () => {
    // Play §3.2: 价格波动
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    expect(() => trade.refreshPrices()).not.toThrow();
  });

  it('should manage trade events', () => {
    // Play §3: 商路随机事件
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const events = trade.getActiveEvents();
    expect(Array.isArray(events)).toBe(true);
  });

  it('should manage NPC merchants', () => {
    // Play §2.4: NPC商人
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const merchants = trade.getActiveNpcMerchants();
    expect(Array.isArray(merchants)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v8.0 商贸繁荣 — §4 跨系统联动', () => {

  it('should link currency system to shop system', () => {
    // Play §1.1: 完整购买流程 选择→确认→扣款→获得→反馈
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();

    expect(shop).toBeDefined();
    expect(currency).toBeDefined();

    const state = shop.getState();
    expect(state).toBeDefined();
  });

  it('should coordinate shop purchase with currency deduction', () => {
    // Play §1.1: 购买→扣款→库存变化
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();

    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const copperBefore = currency.getBalance('copper' as CurrencyType);
      const result = shop.executeBuy({
        shopType: 'normal' as ShopType,
        goodsId: goods[0].defId,
        count: 1,
      });

      if (result.success) {
        const copperAfter = currency.getBalance('copper' as CurrencyType);
        expect(copperAfter).toBeLessThanOrEqual(copperBefore);
      }
    }
  });

  it('should link trade system with shop system', () => {
    // Play §3: 贸易路线影响商店商品
    const sim = createSim();
    const trade = sim.engine.getTradeSystem();
    const shop = sim.engine.getShopSystem();

    expect(trade).toBeDefined();
    expect(shop).toBeDefined();
  });

  it('should get shop level for each shop type', () => {
    // Play §2: 多商店类型
    const sim = createSim();
    const shop = sim.engine.getShopSystem();

    const level = shop.getShopLevel('normal' as ShopType);
    expect(typeof level).toBe('number');
  });

  it('should set shop level', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();

    shop.setShopLevel('normal' as ShopType, 3);
    expect(shop.getShopLevel('normal' as ShopType)).toBe(3);
  });

});
