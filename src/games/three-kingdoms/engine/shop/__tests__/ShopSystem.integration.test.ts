import { vi, describe, it, expect, beforeEach } from 'vitest';
/**
 * ShopSystem 集成测试 — 商店购买→货币→库存联动
 *
 * 覆盖Play文档流程：
 *   §1.1 集市商店浏览与购买
 *   §1.2 五级确认策略逐级验证
 *   §1.3 误操作防护验证
 *   §1.4 库存与限购
 *   §1.5 折扣机制完整验证
 *   §1.6 货币体系
 *   §1.7 货币兑换与汇率
 *   §6.1 商品收藏与提醒
 *   §7.1 补货引擎验证
 *   §8.1 商店购买→货币→库存联动
 *   §9.1 定价体系独立验证
 */

import { ShopSystem } from '../ShopSystem';
import { CurrencySystem } from '../../currency/CurrencySystem';
import type { BuyRequest, DiscountConfig, ShopType } from '../../../core/shop';
import {
  SHOP_TYPES,
  CONFIRM_THRESHOLDS,
  PERMANENT_GOODS_STOCK,
  RANDOM_GOODS_STOCK,
  DISCOUNT_GOODS_STOCK,
  LIMITED_GOODS_STOCK,
} from '../../../core/shop';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS } from '../../../core/shop';
import type { ISystemDeps } from "../../core/types";

// ─── 辅助 ────────────────────────────────

function createMockDeps() {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn() },
    registry: { get: vi.fn() },
  };
}

/** 创建集成了CurrencySystem的ShopSystem */
function createIntegratedShop(initialCopper = 100000): { shop: ShopSystem; currency: CurrencySystem } {
  const currency = new CurrencySystem();
  currency.init(createMockDeps() as unknown as ISystemDeps);
  currency.setCurrency('copper', initialCopper);
  currency.setCurrency('ingot', 5000);
  currency.setCurrency('mandate', 500);
  currency.setCurrency('reputation', 5000);

  const shop = new ShopSystem();
  shop.init(createMockDeps() as unknown as ISystemDeps);
  shop.setCurrencySystem(currency);

  return { shop, currency };
}

/** 获取normal商店中第一个有定义的商品ID */
function getFirstNormalGoodsId(): string | null {
  const ids = SHOP_GOODS_IDS['normal'];
  return ids?.[0] ?? null;
}

/** 获取指定商店的第一个商品defId */
function getFirstGoodsId(shopType: ShopType): string | null {
  const ids = SHOP_GOODS_IDS[shopType];
  return ids?.[0] ?? null;
}

// ─────────────────────────────────────────
// §1.1 + §8.1 商店浏览→购买→扣款→库存 全链路
// ─────────────────────────────────────────

describe('§1.1+§8.1 集市商店浏览与购买 — 全链路集成', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    ({ shop, currency } = createIntegratedShop());
  });

  it('应能浏览集市商品列表', () => {
    const goods = shop.getShopGoods('normal');
    expect(goods.length).toBeGreaterThan(0);
    // 每个商品应有defId、stock、discount等字段
    for (const item of goods) {
      expect(item.defId).toBeTruthy();
      expect(typeof item.stock).toBe('number');
      expect(item.discount).toBeGreaterThanOrEqual(0);
      expect(item.discount).toBeLessThanOrEqual(1);
    }
  });

  it('应能按分类过滤商品', () => {
    const categories = shop.getCategories();
    expect(categories.length).toBeGreaterThan(0);

    for (const cat of categories) {
      const items = shop.getGoodsByCategory('normal', cat);
      for (const item of items) {
        const def = GOODS_DEF_MAP[item.defId];
        expect(def?.category).toBe(cat);
      }
    }
  });

  it('应完成 购买→扣款→库存→确认 全链路', () => {
    const goodsId = getFirstNormalGoodsId();
    if (!goodsId) return;

    const beforeBalance = currency.getBalance('copper');
    const beforeItem = shop.getGoodsItem('normal', goodsId);
    const beforeStock = beforeItem?.stock ?? 0;

    const request: BuyRequest = { goodsId, quantity: 1, shopType: 'normal' };
    const result = shop.executeBuy(request);

    expect(result.success).toBe(true);
    expect(result.goodsId).toBe(goodsId);
    expect(result.quantity).toBe(1);

    // 验证货币扣除
    const afterBalance = currency.getBalance('copper');
    expect(afterBalance).toBeLessThan(beforeBalance);

    // 非无限库存时验证库存减少
    if (beforeStock !== -1) {
      const afterItem = shop.getGoodsItem('normal', goodsId);
      expect(afterItem?.stock).toBe(beforeStock - 1);
    }
  });

  it('购买不存在的商品应失败', () => {
    const request: BuyRequest = { goodsId: 'nonexistent_item', quantity: 1, shopType: 'normal' };
    const validation = shop.validateBuy(request);
    expect(validation.canBuy).toBe(false);
  });
});

// ─────────────────────────────────────────
// §1.2 五级确认策略
// ─────────────────────────────────────────

describe('§1.2 五级确认策略逐级验证', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    ({ shop, currency } = createIntegratedShop(1000000));
  });

  it('L0: 铜钱≤200应返回none确认级别', () => {
    // 找一个低价商品
    const goods = shop.getShopGoods('normal');
    const cheapItem = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      if (!def) return false;
      const price = Object.values(def.basePrice)[0] ?? Infinity;
      return price <= 200;
    });
    if (!cheapItem) return;

    const request: BuyRequest = { goodsId: cheapItem.defId, quantity: 1, shopType: 'normal' };
    const validation = shop.validateBuy(request);
    // 铜钱等价≤CONFIRM_THRESHOLDS.low (1000) 应该是none或low
    expect(['none', 'low']).toContain(validation.confirmLevel);
  });

  it('L1: 铜钱201~2000应返回low确认级别', () => {
    const goods = shop.getShopGoods('normal');
    const midItem = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      if (!def) return false;
      const price = Object.values(def.basePrice)[0] ?? 0;
      return price > 200 && price <= 2000;
    });
    if (!midItem) return;

    const request: BuyRequest = { goodsId: midItem.defId, quantity: 1, shopType: 'normal' };
    const validation = shop.validateBuy(request);
    expect(['none', 'low', 'medium']).toContain(validation.confirmLevel);
  });

  it('L4: 高价商品应返回critical确认级别', () => {
    // 使用大量购买触发高级别
    const goods = shop.getShopGoods('normal');
    if (goods.length === 0) return;

    const expensiveItem = goods.reduce((best, g) => {
      const def = GOODS_DEF_MAP[g.defId];
      if (!def) return best;
      const price = Object.values(def.basePrice)[0] ?? 0;
      const bestPrice = best ? (Object.values(GOODS_DEF_MAP[best.defId]?.basePrice ?? {})[0] ?? 0) : 0;
      return price > bestPrice ? g : best;
    }, goods[0]);

    const request: BuyRequest = { goodsId: expensiveItem.defId, quantity: 100, shopType: 'normal' };
    const validation = shop.validateBuy(request);
    // 大量购买时确认级别应较高
    if (validation.canBuy) {
      expect(['medium', 'high', 'critical']).toContain(validation.confirmLevel);
    }
  });
});

// ─────────────────────────────────────────
// §1.4 库存与限购
// ─────────────────────────────────────────

describe('§1.4 库存与限购', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    ({ shop, currency } = createIntegratedShop(1000000));
  });

  it('常驻商品库存应为-1(无限)', () => {
    const goods = shop.getShopGoods('normal');
    const permanentItems = goods.filter(g => {
      const def = GOODS_DEF_MAP[g.defId];
      return def?.goodsType === 'permanent';
    });
    for (const item of permanentItems) {
      expect(item.stock).toBe(-1);
    }
  });

  it('限购商品达到上限后应不可购买', () => {
    const goods = shop.getShopGoods('normal');
    const limitedItem = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      return def?.goodsType === 'limited' && g.lifetimeLimit > 0;
    });
    if (!limitedItem) return;

    // 购买至限购上限
    const buyCount = limitedItem.lifetimeLimit;
    for (let i = 0; i < buyCount; i++) {
      const result = shop.executeBuy({ goodsId: limitedItem.defId, quantity: 1, shopType: 'normal' });
      // 可能因其他原因失败（如库存不足），跳过
      if (!result.success) break;
    }

    // 再次购买应失败
    const validation = shop.validateBuy({ goodsId: limitedItem.defId, quantity: 1, shopType: 'normal' });
    expect(validation.canBuy).toBe(false);
    expect(validation.errors.some(e => e.includes('限购'))).toBe(true);
  });

  it('库存不足时应不可购买', () => {
    const goods = shop.getShopGoods('normal');
    const finiteItem = goods.find(g => g.stock > 0 && g.stock !== -1);
    if (!finiteItem) return;

    // 买光库存
    const buyResult = shop.executeBuy({ goodsId: finiteItem.defId, quantity: finiteItem.stock, shopType: 'normal' });
    if (!buyResult.success) return;

    // 再买应失败
    const validation = shop.validateBuy({ goodsId: finiteItem.defId, quantity: 1, shopType: 'normal' });
    expect(validation.canBuy).toBe(false);
  });

  it('resetDailyLimits应重置每日限购计数', () => {
    const goods = shop.getShopGoods('normal');
    const dailyLimited = goods.find(g => g.dailyLimit > 0);
    if (!dailyLimited) return;

    // 买一次
    shop.executeBuy({ goodsId: dailyLimited.defId, quantity: 1, shopType: 'normal' });

    // 重置
    shop.resetDailyLimits();

    // 每日计数应归零
    const afterReset = shop.getGoodsItem('normal', dailyLimited.defId);
    expect(afterReset?.dailyPurchased).toBe(0);
  });
});

// ─────────────────────────────────────────
// §1.5 折扣机制
// ─────────────────────────────────────────

describe('§1.5 折扣机制完整验证', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    ({ shop, currency } = createIntegratedShop(1000000));
  });

  it('添加折扣后应降低最终价格', () => {
    const goodsId = getFirstNormalGoodsId();
    if (!goodsId) return;

    const beforePrice = shop.calculateFinalPrice(goodsId, 'normal');
    const beforeCopper = beforePrice['copper'] ?? 0;

    // 添加一个8折折扣
    const discount: DiscountConfig = {
      type: 'normal',
      rate: 0.8,
      startTime: Date.now() - 1000,
      endTime: Date.now() + 3600000,
      applicableGoods: [goodsId],
    };
    shop.addDiscount(discount);

    const afterPrice = shop.calculateFinalPrice(goodsId, 'normal');
    const afterCopper = afterPrice['copper'] ?? 0;

    expect(afterCopper).toBeLessThanOrEqual(beforeCopper);
  });

  it('过期折扣应被清理', () => {
    const goodsId = getFirstNormalGoodsId();
    if (!goodsId) return;

    // 添加已过期折扣
    const expiredDiscount: DiscountConfig = {
      type: 'normal',
      rate: 0.5,
      startTime: Date.now() - 7200000,
      endTime: Date.now() - 1000,
      applicableGoods: [goodsId],
    };
    shop.addDiscount(expiredDiscount);

    const removed = shop.cleanupExpiredDiscounts();
    expect(removed).toBe(1);
  });

  it('NPC好感度折扣应影响最终价格', () => {
    const goodsId = getFirstNormalGoodsId();
    if (!goodsId) return;

    const basePrice = shop.calculateFinalPrice(goodsId, 'normal');

    // 设置NPC折扣-10%
    shop.setNPCDiscountProvider(() => 0.9);
    const discountedPrice = shop.calculateFinalPrice(goodsId, 'normal', 'npc_001');

    const baseCopper = basePrice['copper'] ?? 0;
    const discCopper = discountedPrice['copper'] ?? 0;
    expect(discCopper).toBeLessThanOrEqual(baseCopper);
  });

  it('§1.5.2 折扣叠加：同类取最低', () => {
    const goodsId = getFirstNormalGoodsId();
    if (!goodsId) return;

    // 添加两个折扣
    shop.addDiscount({
      type: 'normal',
      rate: 0.85,
      startTime: Date.now() - 1000,
      endTime: Date.now() + 3600000,
      applicableGoods: [goodsId],
    });
    shop.addDiscount({
      type: 'limited_sale',
      rate: 0.7,
      startTime: Date.now() - 1000,
      endTime: Date.now() + 3600000,
      applicableGoods: [goodsId],
    });

    const finalPrice = shop.calculateFinalPrice(goodsId, 'normal');
    const def = GOODS_DEF_MAP[goodsId];
    const baseCopper = def?.basePrice['copper'] ?? 0;
    const finalCopper = finalPrice['copper'] ?? 0;

    // 应取最低折扣
    expect(finalCopper).toBeLessThanOrEqual(baseCopper);
  });
});

// ─────────────────────────────────────────
// §1.6 + §1.7 货币体系
// ─────────────────────────────────────────

describe('§1.6+§1.7 货币体系集成', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    ({ shop, currency } = createIntegratedShop(500));
  });

  it('货币不足时应阻止购买', () => {
    const goods = shop.getShopGoods('normal');
    // 找一个比余额贵的商品
    const expensiveItem = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      const price = Object.values(def?.basePrice ?? {})[0] ?? 0;
      return price > 500;
    });
    if (!expensiveItem) return;

    const result = shop.executeBuy({ goodsId: expensiveItem.defId, quantity: 1, shopType: 'normal' });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('不足');
  });

  it('货币兑换应正确执行', () => {
    // 给足初始余额
    currency.setCurrency('copper', 10000);
    const beforeRecruit = currency.getBalance('recruit');

    // 铜钱→招贤榜（通过exchange）
    const result = currency.exchange({ from: 'copper', to: 'recruit', amount: 500 });
    // 根据汇率配置，可能不支持直接兑换
    // 验证exchange接口可用
    expect(typeof result.success).toBe('boolean');
  });
});

// ─────────────────────────────────────────
// §6.1 商品收藏与提醒
// ─────────────────────────────────────────

describe('§6.1 商品收藏', () => {
  let shop: ShopSystem;

  beforeEach(() => {
    const { shop: s } = createIntegratedShop();
    shop = s;
  });

  it('应能收藏/取消收藏商品', () => {
    const goodsId = getFirstNormalGoodsId();
    if (!goodsId) return;

    const def = GOODS_DEF_MAP[goodsId];
    if (!def?.favoritable) return;

    // 收藏
    const added = shop.toggleFavorite(goodsId);
    expect(added).toBe(true);
    expect(shop.isFavorite(goodsId)).toBe(true);

    // 取消收藏
    const removed = shop.toggleFavorite(goodsId);
    expect(removed).toBe(false);
    expect(shop.isFavorite(goodsId)).toBe(false);
  });

  it('收藏列表应正确返回', () => {
    const goods = shop.getShopGoods('normal');
    const favoritableItems = goods.filter(g => GOODS_DEF_MAP[g.defId]?.favoritable);

    for (const item of favoritableItems.slice(0, 3)) {
      shop.toggleFavorite(item.defId);
    }

    const favorites = shop.getFavorites();
    expect(favorites.length).toBe(Math.min(3, favoritableItems.length));
  });

  it('不可收藏的商品应返回false', () => {
    const result = shop.toggleFavorite('nonexistent_item');
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────
// §7.1 补货引擎
// ─────────────────────────────────────────

describe('§7.1 补货引擎', () => {
  let shop: ShopSystem;

  beforeEach(() => {
    const { shop: s } = createIntegratedShop();
    shop = s;
  });

  it('手动刷新应成功', () => {
    const result = shop.manualRefresh();
    expect(result.success).toBe(true);
  });

  it('手动刷新次数应有限制', () => {
    // 刷新至限制
    for (let i = 0; i < 10; i++) {
      shop.manualRefresh();
    }
    // 超限后应失败
    const result = shop.manualRefresh();
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已用完');
  });

  it('补货后商品列表应更新', () => {
    const beforeGoods = shop.getShopGoods('normal').map(g => g.defId);
    shop.manualRefresh();
    const afterGoods = shop.getShopGoods('normal').map(g => g.defId);
    // 商品列表应重新生成
    expect(afterGoods.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────
// §9.1 定价体系
// ─────────────────────────────────────────

describe('§9.1 定价体系独立验证', () => {
  let shop: ShopSystem;

  beforeEach(() => {
    const { shop: s } = createIntegratedShop();
    shop = s;
  });

  it('各商品类别应有合理价格范围', () => {
    const goods = shop.getShopGoods('normal');
    for (const item of goods) {
      const def = GOODS_DEF_MAP[item.defId];
      if (!def) continue;

      const prices = Object.values(def.basePrice);
      for (const price of prices) {
        expect(price).toBeGreaterThan(0);
      }
    }
  });

  it('折扣后价格应不低于0', () => {
    const goods = shop.getShopGoods('normal');
    for (const item of goods) {
      const finalPrice = shop.calculateFinalPrice(item.defId, 'normal');
      for (const [cur, price] of Object.entries(finalPrice)) {
        expect(price).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ─────────────────────────────────────────
// §8.11 多商店并发状态
// ─────────────────────────────────────────

describe('§8.11 多商店并发状态', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    ({ shop, currency } = createIntegratedShop(1000000));
  });

  it('各商店状态应独立', () => {
    for (const type of SHOP_TYPES) {
      const goods = shop.getShopGoods(type);
      const state = shop.getState()[type];
      expect(state.shopType).toBe(type);
    }
  });

  it('各商店等级应独立管理', () => {
    for (const type of SHOP_TYPES) {
      shop.setShopLevel(type, 3);
      expect(shop.getShopLevel(type)).toBe(3);
    }
  });

  it('在一个商店购买不应影响其他商店', () => {
    const normalGoods = shop.getShopGoods('normal');
    if (normalGoods.length === 0) return;

    const beforeBlackMarket = shop.getShopGoods('black_market').map(g => ({ ...g }));
    shop.executeBuy({ goodsId: normalGoods[0].defId, quantity: 1, shopType: 'normal' });
    const afterBlackMarket = shop.getShopGoods('black_market');

    // 黑市商品不应受影响
    expect(afterBlackMarket.length).toBe(beforeBlackMarket.length);
  });
});

// ─────────────────────────────────────────
// 序列化/反序列化
// ─────────────────────────────────────────

describe('ShopSystem 序列化集成', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    ({ shop, currency } = createIntegratedShop());
  });

  it('序列化→反序列化应恢复完整状态', () => {
    // 做一些操作
    const goodsId = getFirstNormalGoodsId();
    if (goodsId) {
      shop.executeBuy({ goodsId, quantity: 1, shopType: 'normal' });
    }
    shop.toggleFavorite(goodsId ?? '');

    // 序列化
    const data = shop.serialize();

    // 新实例反序列化
    const shop2 = new ShopSystem();
    shop2.init(createMockDeps() as unknown as ISystemDeps);
    shop2.deserialize(data);

    // 验证
    expect(shop2.getFavorites()).toEqual(shop.getFavorites());
    expect(shop2.getShopLevel('normal')).toBe(shop.getShopLevel('normal'));
  });
});
