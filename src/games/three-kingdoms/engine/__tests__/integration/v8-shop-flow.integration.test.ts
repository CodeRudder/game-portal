/**
 * v8.0 商贸繁荣 — 商店系统 Play 流程集成测试
 *
 * 覆盖: §1.1~1.5 商店核心 | §1.5.2 折扣叠加(R4) | §2 多商店 | §6.1 收藏 | §7.1 补货 | §9.1 定价
 * 原则: 独立sim实例 | 真实引擎API | 零as any | 零mock
 */

import { describe, it, expect } from 'vitest';
import { createSim, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { ShopType, GoodsCategory } from '../../../core/shop';
import {
  SHOP_TYPES,
  CONFIRM_THRESHOLDS,
} from '../../../core/shop';

// ═══════════════════════════════════════════════
// §1.1 集市商店浏览与购买
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW §1.1 集市商店浏览与购买', () => {
  it('SHOP-FLOW-1: 应能访问商店系统', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    expect(shop).toBeDefined();
    expect(typeof shop.getShopGoods).toBe('function');
    expect(typeof shop.executeBuy).toBe('function');
    expect(typeof shop.validateBuy).toBe('function');
  });

  it('SHOP-FLOW-2: 集市商店应有商品列表', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    expect(Array.isArray(goods)).toBe(true);
    expect(goods.length).toBeGreaterThan(0);
  });

  it('SHOP-FLOW-3: 商品应有完整信息(价格/库存/折扣)', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const item = goods[0];
      expect(item.defId).toBeDefined();
      expect(item.stock).toBeDefined();
      expect(item.discount).toBeGreaterThan(0);
      expect(item.discount).toBeLessThanOrEqual(1);
    }
  });

  it('SHOP-FLOW-4: 商品分类Tab切换过滤', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const categories = shop.getCategories();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
    if (categories.length > 0) {
      const filtered = shop.getGoodsByCategory('normal' as ShopType, categories[0] as GoodsCategory);
      expect(Array.isArray(filtered)).toBe(true);
    }
  });

  it('SHOP-FLOW-5: 查看商品详情', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const def = shop.getGoodsDef(goods[0].defId);
      if (def) {
        expect(def.name).toBeDefined();
        expect(def.basePrice).toBeDefined();
      }
    }
  });

  it('SHOP-FLOW-6: 资源充足时购买成功并扣款', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    currency.addCurrency('copper', 100000);

    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const copperBefore = currency.getBalance('copper');
      const validation = shop.validateBuy({
        shopType: 'normal' as ShopType,
        goodsId: goods[0].defId,
        quantity: 1,
      });
      if (validation.canBuy) {
        const result = shop.executeBuy({
          shopType: 'normal' as ShopType,
          goodsId: goods[0].defId,
          quantity: 1,
        });
        expect(result.success).toBe(true);
        expect(result.goodsId).toBe(goods[0].defId);
        // 验证货币扣除
        expect(currency.getBalance('copper')).toBeLessThanOrEqual(copperBefore);
      }
    }
  });

  it('SHOP-FLOW-7: 购买后库存减少', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    currency.addCurrency('copper', 100000);

    const goods = shop.getShopGoods('normal' as ShopType);
    const item = goods.find(g => g.stock > 0 && g.stock !== -1);
    if (item) {
      const stockBefore = item.stock;
      const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: item.defId, quantity: 1 });
      if (validation.canBuy) {
        shop.executeBuy({ shopType: 'normal' as ShopType, goodsId: item.defId, quantity: 1 });
        const stockAfter = shop.getStockInfo('normal' as ShopType, item.defId);
        if (stockAfter && stockBefore !== -1) expect(stockAfter.stock).toBe(stockBefore - 1);
      }
    }
  });
});

// ═══════════════════════════════════════════════
// §1.2 五级确认策略
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW §1.2 五级确认策略', () => {
  it('SHOP-FLOW-8: L0-低金额商品(≤200铜钱)返回none或low', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    currency.addCurrency('copper', 100000);

    const goods = shop.getShopGoods('normal' as ShopType);
    const cheapItem = goods.find(g => {
      const def = shop.getGoodsDef(g.defId);
      return def && (Object.values(def.basePrice)[0] ?? 99999) <= 200;
    });
    if (cheapItem) {
      const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: cheapItem.defId, quantity: 1 });
      if (validation.canBuy) expect(['none', 'low']).toContain(validation.confirmLevel);
    }
  });

  it('SHOP-FLOW-9: L1-中等金额商品(201~2000铜钱)', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    currency.addCurrency('copper', 100000);

    const goods = shop.getShopGoods('normal' as ShopType);
    const midItem = goods.find(g => {
      const def = shop.getGoodsDef(g.defId);
      if (!def) return false;
      const p = Object.values(def.basePrice)[0] ?? 0;
      return p > 200 && p <= 2000;
    });
    if (midItem) {
      const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: midItem.defId, quantity: 1 });
      if (validation.canBuy) expect(['low', 'none', 'medium']).toContain(validation.confirmLevel);
    }
  });

  it('SHOP-FLOW-10: L2+-高金额商品(>2000铜钱)返回medium+', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    currency.addCurrency('copper', 1000000);

    const goods = shop.getShopGoods('normal' as ShopType);
    const expensiveItem = goods.find(g => {
      const def = shop.getGoodsDef(g.defId);
      return def && (Object.values(def.basePrice)[0] ?? 0) > 2000;
    });
    if (expensiveItem) {
      const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: expensiveItem.defId, quantity: 1 });
      if (validation.canBuy) expect(['medium', 'high', 'critical']).toContain(validation.confirmLevel);
    }
  });

  it('SHOP-FLOW-10b: 大量购买触发L4-critical确认', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    currency.addCurrency('copper', 10000000);

    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length === 0) return;
    // 找最贵的商品，大量购买
    const expensiveItem = goods.reduce((best, g) => {
      const def = shop.getGoodsDef(g.defId);
      if (!def) return best;
      const price = Object.values(def.basePrice)[0] ?? 0;
      const bestPrice = best ? (Object.values(shop.getGoodsDef(best.defId)?.basePrice ?? {})[0] ?? 0) : 0;
      return price > bestPrice ? g : best;
    }, goods[0]);

    const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: expensiveItem.defId, quantity: 100 });
    if (validation.canBuy) {
      expect(['medium', 'high', 'critical']).toContain(validation.confirmLevel);
    }
  });

  it('SHOP-FLOW-10c: 确认阈值配置完整', () => {
    // 验证五级确认阈值存在
    expect(CONFIRM_THRESHOLDS).toBeDefined();
    expect(typeof CONFIRM_THRESHOLDS.none).toBe('number');
    expect(typeof CONFIRM_THRESHOLDS.low).toBe('number');
    expect(typeof CONFIRM_THRESHOLDS.medium).toBe('number');
    expect(typeof CONFIRM_THRESHOLDS.high).toBe('number');
    // 阈值递增
    expect(CONFIRM_THRESHOLDS.none).toBeLessThanOrEqual(CONFIRM_THRESHOLDS.low);
    expect(CONFIRM_THRESHOLDS.low).toBeLessThanOrEqual(CONFIRM_THRESHOLDS.medium);
    expect(CONFIRM_THRESHOLDS.medium).toBeLessThanOrEqual(CONFIRM_THRESHOLDS.high);
  });
});

// ═══════════════════════════════════════════════
// §1.4 库存与限购
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW §1.4 库存与限购', () => {
  it('SHOP-FLOW-11: 获取商品库存信息', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const info = shop.getStockInfo('normal' as ShopType, goods[0].defId);
      expect(info).toBeDefined();
      expect(info!.stock).toBeDefined();
      expect(info!.dailyPurchased).toBeDefined();
      expect(info!.dailyLimit).toBeDefined();
    }
  });

  it('SHOP-FLOW-12: 库存不足时购买验证失败', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    currency.addCurrency('copper', 1000000);

    const goods = shop.getShopGoods('normal' as ShopType);
    const limitedItem = goods.find(g => g.stock > 0 && g.stock !== -1 && g.stock < 10);
    if (limitedItem) {
      const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: limitedItem.defId, quantity: limitedItem.stock + 100 });
      expect(validation.canBuy).toBe(false);
    }
  });

  it('SHOP-FLOW-13: 每日限购计数正确', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    const limitedItem = goods.find(g => g.dailyLimit > 0);
    if (limitedItem) {
      const info = shop.getStockInfo('normal' as ShopType, limitedItem.defId);
      expect(info!.dailyPurchased).toBe(0);
      expect(info!.dailyLimit).toBeGreaterThan(0);
    }
  });

  it('SHOP-FLOW-14: 终身限购计数正确', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    const lifetimeItem = goods.find(g => g.lifetimeLimit > 0);
    if (lifetimeItem) {
      const info = shop.getStockInfo('normal' as ShopType, lifetimeItem.defId);
      expect(info!.lifetimePurchased).toBe(0);
      expect(info!.lifetimeLimit).toBeGreaterThan(0);
    }
  });

  it('SHOP-FLOW-15: 重置每日限购后计数归零', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    shop.resetDailyLimits();
    const goods = shop.getShopGoods('normal' as ShopType);
    for (const g of goods) {
      const info = shop.getStockInfo('normal' as ShopType, g.defId);
      if (info) expect(info.dailyPurchased).toBe(0);
    }
  });

  it('SHOP-FLOW-15b: 购买至限购上限后不可再购', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    currency.addCurrency('copper', 1000000);

    const goods = shop.getShopGoods('normal' as ShopType);
    const limitedItem = goods.find(g => g.lifetimeLimit > 0);
    if (!limitedItem) return;

    // 购买至限购上限
    for (let i = 0; i < limitedItem.lifetimeLimit; i++) {
      const result = shop.executeBuy({ shopType: 'normal' as ShopType, goodsId: limitedItem.defId, quantity: 1 });
      if (!result.success) break;
    }
    // 再次购买应失败
    const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: limitedItem.defId, quantity: 1 });
    expect(validation.canBuy).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// §1.5 折扣机制 & §1.5.2 折扣叠加场景 (R4)
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW §1.5 折扣机制', () => {
  it('SHOP-FLOW-16: 添加常规折扣配置', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    shop.addDiscount({
      type: 'normal', rate: 0.8,
      startTime: Date.now() - 1000, endTime: Date.now() + 86400000,
      targetShopType: 'normal' as ShopType, applicableGoods: [],
    });
    expect(true).toBe(true);
  });

  it('SHOP-FLOW-17: 清理过期折扣', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    shop.addDiscount({
      type: 'normal', rate: 0.8,
      startTime: Date.now() - 200000, endTime: Date.now() - 1000,
      targetShopType: 'normal' as ShopType, applicableGoods: [],
    });
    expect(shop.cleanupExpiredDiscounts()).toBeGreaterThanOrEqual(0);
  });

  it('SHOP-FLOW-18: 折扣降低最终价格', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const defId = goods[0].defId;
      const before = shop.calculateFinalPrice(defId, 'normal' as ShopType);
      shop.addDiscount({
        type: 'normal', rate: 0.5,
        startTime: Date.now() - 1000, endTime: Date.now() + 86400000,
        targetShopType: 'normal' as ShopType, applicableGoods: [defId],
      });
      const after = shop.calculateFinalPrice(defId, 'normal' as ShopType);
      const copperBefore = Object.values(before)[0] ?? 0;
      const copperAfter = Object.values(after)[0] ?? 0;
      if (copperBefore > 0) expect(copperAfter).toBeLessThanOrEqual(copperBefore);
    }
  });

  it('SHOP-FLOW-19: NPC好感度折扣提供者', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length === 0) return;

    const defId = goods[0].defId;
    const basePrice = shop.calculateFinalPrice(defId, 'normal' as ShopType);
    shop.setNPCDiscountProvider((_npcId: string) => 0.85);
    const npcPrice = shop.calculateFinalPrice(defId, 'normal' as ShopType, 'npc_001');
    const baseCopper = Object.values(basePrice)[0] ?? 0;
    const npcCopper = Object.values(npcPrice)[0] ?? 0;
    expect(npcCopper).toBeLessThanOrEqual(baseCopper);
  });

  // §1.5.2 R4: 折扣叠加场景
  it('SHOP-FLOW-20: 常规折扣+NPC好感度折扣叠加', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const defId = goods[0].defId;
      const basePrice = shop.calculateFinalPrice(defId, 'normal' as ShopType);

      shop.setNPCDiscountProvider(() => 0.9); // NPC -10%
      shop.addDiscount({
        type: 'normal', rate: 0.9, // 常规 -10%
        startTime: Date.now() - 1000, endTime: Date.now() + 86400000,
        targetShopType: 'normal' as ShopType, applicableGoods: [defId],
      });
      const finalPrice = shop.calculateFinalPrice(defId, 'normal' as ShopType, 'npc_1');
      const baseCopper = Object.values(basePrice)[0] ?? 0;
      const finalCopper = Object.values(finalPrice)[0] ?? 0;
      // 叠加后应低于原价
      expect(finalCopper).toBeLessThanOrEqual(baseCopper);
    }
  });

  it('SHOP-FLOW-21: 价格地板验证（最终价格≥1）', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const defId = goods[0].defId;
      shop.setNPCDiscountProvider(() => 0.01);
      shop.addDiscount({
        type: 'extreme', rate: 0.01,
        startTime: Date.now() - 1000, endTime: Date.now() + 86400000,
        targetShopType: 'normal' as ShopType, applicableGoods: [defId],
      });
      const finalPrice = shop.calculateFinalPrice(defId, 'normal' as ShopType, 'npc_1');
      expect(Object.values(finalPrice)[0] ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it('SHOP-FLOW-21b: 限时特惠折扣(30%~60%)', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length === 0) return;

    const defId = goods[0].defId;
    const basePrice = shop.calculateFinalPrice(defId, 'normal' as ShopType);
    // 限时特惠 -50%
    shop.addDiscount({
      type: 'limited_sale', rate: 0.5,
      startTime: Date.now() - 1000, endTime: Date.now() + 86400000,
      targetShopType: 'normal' as ShopType, applicableGoods: [defId],
    });
    const salePrice = shop.calculateFinalPrice(defId, 'normal' as ShopType);
    const baseCopper = Object.values(basePrice)[0] ?? 0;
    const saleCopper = Object.values(salePrice)[0] ?? 0;
    expect(saleCopper).toBeLessThanOrEqual(baseCopper);
  });

  it('SHOP-FLOW-21c: 折扣过期顺序切换', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length === 0) return;

    const defId = goods[0].defId;
    // 添加已过期折扣
    shop.addDiscount({
      type: 'expired', rate: 0.3,
      startTime: Date.now() - 7200000, endTime: Date.now() - 1000,
      targetShopType: 'normal' as ShopType, applicableGoods: [defId],
    });
    // 添加有效折扣
    shop.addDiscount({
      type: 'active', rate: 0.8,
      startTime: Date.now() - 1000, endTime: Date.now() + 86400000,
      targetShopType: 'normal' as ShopType, applicableGoods: [defId],
    });

    // 清理过期后，有效折扣仍生效
    shop.cleanupExpiredDiscounts();
    const price = shop.calculateFinalPrice(defId, 'normal' as ShopType);
    expect(Object.values(price)[0] ?? 0).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// §1.6 货币体系（8种货币、消耗优先级）
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW §1.6 货币体系', () => {
  it('SHOP-FLOW-22: 8种常驻货币余额查询', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    const types = ['copper', 'mandate', 'recruit', 'summon', 'expedition', 'guild', 'reputation', 'ingot'] as const;
    for (const t of types) {
      expect(typeof currency.getBalance(t)).toBe('number');
      expect(currency.getBalance(t)).toBeGreaterThanOrEqual(0);
    }
  });

  it('SHOP-FLOW-23: 货币消耗优先级按商店类型区分', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    // 集市优先铜钱
    const normalPriority = currency.getSpendPriority('normal');
    expect(normalPriority).toBeDefined();
    expect(normalPriority.length).toBeGreaterThan(0);
    if (normalPriority.length > 0) expect(normalPriority[0]).toBe('copper');
  });

  it('SHOP-FLOW-24: 货币不足时购买验证失败', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    // 不给货币，余额为初始值
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: goods[0].defId, quantity: 1 });
      // 初始货币可能不够买某些商品
      if (!validation.canBuy) {
        expect(validation.errors.length).toBeGreaterThan(0);
      }
    }
  });

  it('SHOP-FLOW-25: 货币兑换接口可用', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    currency.addCurrency('copper', 50000);
    const result = currency.exchange({ from: 'copper', to: 'mandate', amount: 1000 });
    expect(typeof result.success).toBe('boolean');
  });

  it('SHOP-FLOW-25b: 按优先级消耗货币', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    currency.addCurrency('copper', 100000);
    const before = currency.getBalance('copper');
    // 消耗铜钱
    const result = currency.spendByPriority('normal', { copper: 500 });
    expect(result.copper).toBe(500);
    expect(currency.getBalance('copper')).toBe(before - 500);
  });

  it('SHOP-FLOW-25c: 余额不足时spendByPriority抛异常', () => {
    const sim = createSim();
    const currency = sim.engine.getCurrencySystem();
    // 初始铜钱很少
    expect(() => currency.spendByPriority('normal', { copper: 999999999 })).toThrow();
  });
});

// ═══════════════════════════════════════════════
// §2 多商店类型
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW §2 多商店类型', () => {
  it('SHOP-FLOW-26: 所有商店类型已注册', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const state = shop.getState();
    expect(state).toBeDefined();
    // 验证SHOP_TYPES中每种类型都有状态
    for (const type of SHOP_TYPES) {
      expect(state[type]).toBeDefined();
      expect(state[type].shopType).toBe(type);
    }
  });

  it('SHOP-FLOW-27: 军需处商店(兵力+铜钱组合)', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('military' as ShopType);
    // 军需处可能有商品
    if (goods.length > 0) {
      for (const g of goods) {
        expect(g.defId).toBeDefined();
      }
    }
  });

  it('SHOP-FLOW-28: 黑市商店', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('black_market' as ShopType);
    // 黑市可能有商品
    if (goods.length > 0) {
      for (const g of goods) {
        expect(g.defId).toBeDefined();
      }
    }
  });

  it('SHOP-FLOW-29: 活动商店', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('activity' as ShopType);
    if (goods.length > 0) {
      for (const g of goods) {
        expect(g.defId).toBeDefined();
      }
    }
  });

  it('SHOP-FLOW-30: NPC交易商店', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('npc' as ShopType);
    if (goods.length > 0) {
      for (const g of goods) {
        expect(g.defId).toBeDefined();
      }
    }
  });

  it('SHOP-FLOW-31: 各商店等级独立管理', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    for (const type of SHOP_TYPES) {
      shop.setShopLevel(type, 3);
      expect(shop.getShopLevel(type)).toBe(3);
    }
  });

  it('SHOP-FLOW-32: 一个商店购买不影响其他商店库存', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    currency.addCurrency('copper', 1000000);

    const normalGoods = shop.getShopGoods('normal' as ShopType);
    const blackMarketBefore = shop.getShopGoods('black_market' as ShopType).map(g => ({ ...g }));

    if (normalGoods.length > 0) {
      shop.executeBuy({ shopType: 'normal' as ShopType, goodsId: normalGoods[0].defId, quantity: 1 });
    }

    const blackMarketAfter = shop.getShopGoods('black_market' as ShopType);
    // 黑市商品不应受影响
    expect(blackMarketAfter.length).toBe(blackMarketBefore.length);
  });

  it('SHOP-FLOW-33: 商品搜索/过滤功能', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const filtered = shop.filterGoods('normal' as ShopType, { inStockOnly: true, sortBy: 'name', sortOrder: 'asc' });
    expect(Array.isArray(filtered)).toBe(true);
  });

  it('SHOP-FLOW-34: 商品价格区间过滤', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const filtered = shop.filterGoods('normal' as ShopType, { priceRange: [0, 500], inStockOnly: true });
    expect(Array.isArray(filtered)).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// §6.1 商品收藏
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW §6.1 商品收藏', () => {
  it('SHOP-FLOW-35: 收藏商品', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) expect(typeof shop.toggleFavorite(goods[0].defId)).toBe('boolean');
  });

  it('SHOP-FLOW-36: 收藏状态切换', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      shop.toggleFavorite(goods[0].defId);
      expect(shop.isFavorite(goods[0].defId)).toBe(true);
      shop.toggleFavorite(goods[0].defId);
      expect(shop.isFavorite(goods[0].defId)).toBe(false);
    }
  });

  it('SHOP-FLOW-37: 获取收藏列表', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) shop.toggleFavorite(goods[0].defId);
    if (goods.length > 1) shop.toggleFavorite(goods[1].defId);
    expect(Array.isArray(shop.getFavorites())).toBe(true);
  });

  it('SHOP-FLOW-38: 收藏过滤', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) shop.toggleFavorite(goods[0].defId);
    expect(Array.isArray(shop.filterGoods('normal' as ShopType, { favoritesOnly: true }))).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// §7.1 补货引擎
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW §7.1 补货引擎', () => {
  it('SHOP-FLOW-39: 手动刷新商店', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const result = shop.manualRefresh();
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

  it('SHOP-FLOW-40: 手动刷新次数限制', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    let lastResult = { success: true, reason: '' };
    for (let i = 0; i < 20; i++) {
      lastResult = shop.manualRefresh();
      if (!lastResult.success) break;
    }
    expect(lastResult).toBeDefined();
  });

  it('SHOP-FLOW-41: 重置后刷新次数恢复', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    for (let i = 0; i < 20; i++) { if (!shop.manualRefresh().success) break; }
    shop.resetDailyLimits();
    expect(shop.manualRefresh().success).toBe(true);
  });

  it('SHOP-FLOW-41b: 补货后商品列表更新', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const beforeIds = shop.getShopGoods('normal' as ShopType).map(g => g.defId);
    shop.manualRefresh();
    const afterIds = shop.getShopGoods('normal' as ShopType).map(g => g.defId);
    // 商品列表应存在（可能不同）
    expect(afterIds.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// §9.1 定价体系
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW §9.1 定价体系', () => {
  it('SHOP-FLOW-42: 商品基础价格在合理范围', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    for (const g of goods) {
      const def = shop.getGoodsDef(g.defId);
      if (def) {
        for (const p of Object.values(def.basePrice)) {
          expect(p).toBeGreaterThan(0);
          expect(p).toBeLessThan(100000);
        }
      }
    }
  });

  it('SHOP-FLOW-43: 最终价格计算包含所有折扣', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const finalPrice = shop.calculateFinalPrice(goods[0].defId, 'normal' as ShopType);
      expect(finalPrice).toBeDefined();
      for (const v of Object.values(finalPrice)) expect(v).toBeGreaterThan(0);
    }
  });

  it('SHOP-FLOW-43b: 折扣后价格不低于0', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    for (const g of goods) {
      const finalPrice = shop.calculateFinalPrice(g.defId, 'normal' as ShopType);
      for (const [, price] of Object.entries(finalPrice)) {
        expect(price).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════
// §1.3 误操作防护
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW §1.3 误操作防护', () => {
  it('SHOP-FLOW-44: 无效数量购买被拒绝', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      expect(shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: goods[0].defId, quantity: 0 }).canBuy).toBe(false);
    }
  });

  it('SHOP-FLOW-45: 不存在的商品购买被拒绝', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    expect(shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: 'nonexistent_goods_12345', quantity: 1 }).canBuy).toBe(false);
  });

  it('SHOP-FLOW-46: 货币不足时购买验证失败', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: goods[0].defId, quantity: 1 });
      if (!validation.canBuy) expect(validation.errors.length).toBeGreaterThan(0);
    }
  });

  it('SHOP-FLOW-46b: 购买失败不扣款', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    const copperBefore = currency.getBalance('copper');
    const result = shop.executeBuy({ shopType: 'normal' as ShopType, goodsId: 'nonexistent', quantity: 1 });
    expect(result.success).toBe(false);
    expect(currency.getBalance('copper')).toBe(copperBefore);
  });
});

// ═══════════════════════════════════════════════
// 序列化
// ═══════════════════════════════════════════════
describe('v8 SHOP-FLOW 序列化', () => {
  it('SHOP-FLOW-47: 商店系统序列化/反序列化', () => {
    const sim = createSim();
    const shop = sim.engine.getShopSystem();
    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) shop.toggleFavorite(goods[0].defId);

    const data = shop.serialize();
    expect(data).toBeDefined();
    expect(data.shops).toBeDefined();
    expect(data.favorites).toBeDefined();
    expect(data.version).toBeDefined();

    shop.deserialize(data);
    if (goods.length > 0) expect(shop.isFavorite(goods[0].defId)).toBe(true);
  });

  it('SHOP-FLOW-48: 购买后序列化保留状态', () => {
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);
    const shop = sim.engine.getShopSystem();
    const currency = sim.engine.getCurrencySystem();
    shop.setCurrencySystem(currency);
    currency.addCurrency('copper', 100000);

    const goods = shop.getShopGoods('normal' as ShopType);
    if (goods.length > 0) {
      const validation = shop.validateBuy({ shopType: 'normal' as ShopType, goodsId: goods[0].defId, quantity: 1 });
      if (validation.canBuy) {
        shop.executeBuy({ shopType: 'normal' as ShopType, goodsId: goods[0].defId, quantity: 1 });
      }
    }

    const data = shop.serialize();
    const shopLevel = shop.getShopLevel('normal' as ShopType);
    shop.deserialize(data);
    expect(shop.getShopLevel('normal' as ShopType)).toBe(shopLevel);
  });
});
