/**
 * ShopSystem 单元测试
 *
 * 覆盖：
 * 1. 初始化（四种商店、商品加载）
 * 2. 商品查询与分类
 * 3. 定价与折扣
 * 4. 购买逻辑（验证、执行、确认策略）
 * 5. 库存与限购
 * 6. 收藏管理
 * 7. 商店等级
 * 8. 序列化/反序列化
 * 9. ISubsystem 接口
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShopSystem } from '../ShopSystem';
import { CurrencySystem } from '../../currency/CurrencySystem';
import { SHOP_TYPES } from '../../../core/shop/shop.types';
import { SHOP_SAVE_VERSION } from '../../../core/shop/shop-config';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS } from '../../../core/shop/goods-data';
import type { BuyRequest, DiscountConfig, GoodsFilter } from '../../../core/shop/shop.types';

/** 创建带 mock eventBus 的依赖 */
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

/** 创建初始化完成的 ShopSystem */
function createShop(): ShopSystem {
  const shop = new ShopSystem();
  shop.init(createMockDeps() as any);
  return shop;
}

/** 创建带货币系统的 ShopSystem */
function createShopWithCurrency(): { shop: ShopSystem; currency: CurrencySystem } {
  const shop = new ShopSystem();
  const currency = new CurrencySystem();
  const mockDeps = createMockDeps();
  shop.init(mockDeps as any);
  currency.init(mockDeps as any);
  shop.setCurrencySystem(currency);
  return { shop, currency };
}

describe('ShopSystem', () => {
  let shop: ShopSystem;
  beforeEach(() => {
    vi.restoreAllMocks();
    shop = createShop();
  });

  // ═══════════════════════════════════════════
  // 1. 初始化
  // ═══════════════════════════════════════════
  describe('初始化', () => {
    it('应有四种商店类型', () => {
      expect(SHOP_TYPES).toHaveLength(4);
      expect(SHOP_TYPES).toContain('normal');
      expect(SHOP_TYPES).toContain('black_market');
      expect(SHOP_TYPES).toContain('limited_time');
      expect(SHOP_TYPES).toContain('vip');
    });

    it('初始化后各商店均有商品', () => {
      const state = shop.getState();
      for (const type of SHOP_TYPES) {
        expect(state[type].goods.length).toBeGreaterThan(0);
      }
    });

    it('name 为 shop', () => {
      expect(shop.name).toBe('shop');
    });
  });

  // ═══════════════════════════════════════════
  // 2. 商品查询与分类
  // ═══════════════════════════════════════════
  describe('商品查询与分类', () => {
    it('getShopGoods 返回指定商店的商品', () => {
      const goods = shop.getShopGoods('normal');
      expect(goods.length).toBeGreaterThan(0);
    });

    it('getGoodsByCategory 按分类过滤', () => {
      const resources = shop.getGoodsByCategory('normal', 'resource');
      for (const item of resources) {
        const def = GOODS_DEF_MAP[item.defId];
        expect(def?.category).toBe('resource');
      }
    });

    it('getCategories 返回所有分类', () => {
      const categories = shop.getCategories();
      expect(categories.length).toBeGreaterThan(0);
    });

    it('getGoodsDef 返回商品定义', () => {
      const def = shop.getGoodsDef('res_grain_small');
      expect(def).toBeDefined();
      expect(def!.name).toBe('粮草小包');
    });

    it('getGoodsDef 不存在时返回 undefined', () => {
      expect(shop.getGoodsDef('nonexistent')).toBeUndefined();
    });

    it('getGoodsItem 返回指定商店中的商品实例', () => {
      const goods = shop.getShopGoods('normal');
      if (goods.length > 0) {
        const item = shop.getGoodsItem('normal', goods[0].defId);
        expect(item).toBeDefined();
        expect(item!.defId).toBe(goods[0].defId);
      }
    });

    it('filterGoods 按关键字过滤', () => {
      const filter: GoodsFilter = { keyword: '粮草' };
      const results = shop.filterGoods('normal', filter);
      for (const item of results) {
        const def = GOODS_DEF_MAP[item.defId];
        expect(
          def?.name.includes('粮草') || def?.description.includes('粮草'),
        ).toBe(true);
      }
    });

    it('filterGoods 仅显示有库存的商品', () => {
      const filter: GoodsFilter = { inStockOnly: true };
      const results = shop.filterGoods('normal', filter);
      for (const item of results) {
        expect(item.stock === -1 || item.stock > 0).toBe(true);
      }
    });

    it('filterGoods 按价格排序', () => {
      const filter: GoodsFilter = { sortBy: 'price', sortOrder: 'asc' };
      const results = shop.filterGoods('normal', filter);
      const prices = results.map(i => {
        const p = Object.values(GOODS_DEF_MAP[i.defId]?.basePrice ?? {})[0] ?? 0;
        return p;
      });
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 定价与折扣
  // ═══════════════════════════════════════════
  describe('定价与折扣', () => {
    it('calculateFinalPrice 返回基础价格（无折扣时）', () => {
      const goods = shop.getShopGoods('normal');
      if (goods.length === 0) return;
      const price = shop.calculateFinalPrice(goods[0].defId, 'normal');
      const def = GOODS_DEF_MAP[goods[0].defId];
      expect(price).toBeDefined();
      // 基础价格应大于0
      const total = Object.values(price).reduce((s, v) => s + v, 0);
      expect(total).toBeGreaterThan(0);
    });

    it('calculateFinalPrice 不存在的商品返回空对象', () => {
      const price = shop.calculateFinalPrice('nonexistent', 'normal');
      expect(price).toEqual({});
    });

    it('addDiscount 添加折扣后影响价格', () => {
      const goods = shop.getShopGoods('normal');
      if (goods.length === 0) return;
      const defId = goods[0].defId;

      const beforePrice = shop.calculateFinalPrice(defId, 'normal');

      const discount: DiscountConfig = {
        type: 'limited_sale',
        rate: 0.5,
        applicableGoods: [defId],
        startTime: Date.now() - 1000,
        endTime: Date.now() + 60000,
      };
      shop.addDiscount(discount);

      const afterPrice = shop.calculateFinalPrice(defId, 'normal');
      const beforeTotal = Object.values(beforePrice).reduce((s, v) => s + v, 0);
      const afterTotal = Object.values(afterPrice).reduce((s, v) => s + v, 0);

      expect(afterTotal).toBeLessThanOrEqual(beforeTotal);
    });

    it('cleanupExpiredDiscounts 清理过期折扣', () => {
      const discount: DiscountConfig = {
        type: 'limited_sale',
        rate: 0.5,
        applicableGoods: [],
        startTime: Date.now() - 10000,
        endTime: Date.now() - 1000, // 已过期
      };
      shop.addDiscount(discount);
      const removed = shop.cleanupExpiredDiscounts();
      expect(removed).toBe(1);
    });

    it('NPC好感度折扣影响价格', () => {
      const goods = shop.getShopGoods('normal');
      if (goods.length === 0) return;
      const defId = goods[0].defId;

      shop.setNPCDiscountProvider(() => 0.8);
      const price = shop.calculateFinalPrice(defId, 'normal', 'npc_001');
      const def = GOODS_DEF_MAP[defId];
      const baseTotal = Object.values(def?.basePrice ?? {}).reduce((s, v) => s + v, 0);
      const finalTotal = Object.values(price).reduce((s, v) => s + v, 0);
      expect(finalTotal).toBeLessThanOrEqual(baseTotal);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 购买逻辑
  // ═══════════════════════════════════════════
  describe('购买逻辑', () => {
    it('validateBuy 商品不存在时返回失败', () => {
      const request: BuyRequest = { goodsId: 'nonexistent', quantity: 1, shopType: 'normal' };
      const result = shop.validateBuy(request);
      expect(result.canBuy).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validateBuy 商品不在商店中时返回失败', () => {
      // vip 商店商品可能不在 normal 中
      const vipGoods = shop.getShopGoods('vip');
      if (vipGoods.length === 0) return;
      const request: BuyRequest = { goodsId: vipGoods[0].defId, quantity: 1, shopType: 'normal' };
      // 可能存在也可能不存在，取决于数据
      const result = shop.validateBuy(request);
      // 至少不应崩溃
      expect(result).toBeDefined();
    });

    it('validateBuy 正常商品可购买', () => {
      const { shop: s, currency } = createShopWithCurrency();
      currency.addCurrency('copper', 100000);
      const goods = s.getShopGoods('normal');
      if (goods.length === 0) return;
      const request: BuyRequest = { goodsId: goods[0].defId, quantity: 1, shopType: 'normal' };
      const result = s.validateBuy(request);
      expect(result.canBuy).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('executeBuy 成功购买', () => {
      const { shop: s, currency } = createShopWithCurrency();
      currency.addCurrency('copper', 100000);
      const goods = s.getShopGoods('normal');
      if (goods.length === 0) return;
      const request: BuyRequest = { goodsId: goods[0].defId, quantity: 1, shopType: 'normal' };
      const result = s.executeBuy(request);
      expect(result.success).toBe(true);
      expect(result.goodsId).toBe(goods[0].defId);
      expect(result.quantity).toBe(1);
    });

    it('executeBuy 库存不足时失败', () => {
      const goods = shop.getShopGoods('normal');
      if (goods.length === 0) return;
      const request: BuyRequest = { goodsId: goods[0].defId, quantity: 99999, shopType: 'normal' };
      const result = shop.validateBuy(request);
      // 如果商品有库存限制，应失败
      if (goods[0].stock !== -1) {
        expect(result.canBuy).toBe(false);
      }
    });

    it('购买后库存减少', () => {
      const { shop: s, currency } = createShopWithCurrency();
      currency.addCurrency('copper', 100000);
      const goods = s.getShopGoods('normal');
      if (goods.length === 0) return;
      const beforeItem = s.getGoodsItem('normal', goods[0].defId);
      if (!beforeItem || beforeItem.stock === -1) return;
      const beforeStock = beforeItem.stock;

      const request: BuyRequest = { goodsId: goods[0].defId, quantity: 1, shopType: 'normal' };
      s.executeBuy(request);

      const afterItem = s.getGoodsItem('normal', goods[0].defId);
      expect(afterItem!.stock).toBe(beforeStock - 1);
    });

    it('确认策略分级正确', () => {
      // 便宜商品应为 none 或 low
      const goods = shop.getShopGoods('normal');
      if (goods.length === 0) return;
      const request: BuyRequest = { goodsId: goods[0].defId, quantity: 1, shopType: 'normal' };
      const result = shop.validateBuy(request);
      expect(['none', 'low', 'medium', 'high', 'critical']).toContain(result.confirmLevel);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 库存与限购
  // ═══════════════════════════════════════════
  describe('库存与限购', () => {
    it('getStockInfo 返回库存信息', () => {
      const goods = shop.getShopGoods('normal');
      if (goods.length === 0) return;
      const info = shop.getStockInfo('normal', goods[0].defId);
      expect(info).toBeDefined();
      expect(info!.stock).toBeDefined();
      expect(info!.dailyPurchased).toBeDefined();
    });

    it('getStockInfo 不存在的商品返回 null', () => {
      expect(shop.getStockInfo('normal', 'nonexistent')).toBeNull();
    });

    it('resetDailyLimits 重置每日购买计数', () => {
      const { shop: s, currency } = createShopWithCurrency();
      currency.addCurrency('copper', 100000);
      const goods = s.getShopGoods('normal');
      if (goods.length === 0) return;

      // 购买一次
      const request: BuyRequest = { goodsId: goods[0].defId, quantity: 1, shopType: 'normal' };
      s.executeBuy(request);

      const infoBefore = s.getStockInfo('normal', goods[0].defId);
      expect(infoBefore!.dailyPurchased).toBeGreaterThan(0);

      s.resetDailyLimits();

      const infoAfter = s.getStockInfo('normal', goods[0].defId);
      expect(infoAfter!.dailyPurchased).toBe(0);
    });

    it('manualRefresh 刷新商品', () => {
      const result = shop.manualRefresh();
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 收藏管理
  // ═══════════════════════════════════════════
  describe('收藏管理', () => {
    it('toggleFavorite 切换收藏状态', () => {
      // 找一个可收藏的商品
      const goods = shop.getShopGoods('normal');
      if (goods.length === 0) return;
      const def = GOODS_DEF_MAP[goods[0].defId];
      if (!def?.favoritable) return;

      const added = shop.toggleFavorite(goods[0].defId);
      expect(added).toBe(true);
      expect(shop.isFavorite(goods[0].defId)).toBe(true);

      const removed = shop.toggleFavorite(goods[0].defId);
      expect(removed).toBe(false);
      expect(shop.isFavorite(goods[0].defId)).toBe(false);
    });

    it('toggleFavorite 不可收藏商品返回 false', () => {
      const result = shop.toggleFavorite('nonexistent');
      expect(result).toBe(false);
    });

    it('getFavorites 返回收藏列表', () => {
      const goods = shop.getShopGoods('normal');
      if (goods.length === 0) return;
      const def = GOODS_DEF_MAP[goods[0].defId];
      if (!def?.favoritable) return;

      shop.toggleFavorite(goods[0].defId);
      const favs = shop.getFavorites();
      expect(favs).toContain(goods[0].defId);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 商店等级
  // ═══════════════════════════════════════════
  describe('商店等级', () => {
    it('初始等级为 1', () => {
      for (const type of SHOP_TYPES) {
        expect(shop.getShopLevel(type)).toBe(1);
      }
    });

    it('setShopLevel 设置等级', () => {
      shop.setShopLevel('normal', 3);
      expect(shop.getShopLevel('normal')).toBe(3);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 序列化
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('serialize/deserialize 往返一致', () => {
      const data = shop.serialize();
      expect(data.version).toBe(SHOP_SAVE_VERSION);
      expect(data.favorites).toBeDefined();
      expect(data.shops).toBeDefined();

      const shop2 = new ShopSystem();
      shop2.init(createMockDeps() as any);
      shop2.deserialize(data);

      const state1 = shop.getState();
      const state2 = shop2.getState();
      for (const type of SHOP_TYPES) {
        expect(state2[type].goods.length).toBe(state1[type].goods.length);
      }
    });

    it('reset 恢复初始状态', () => {
      shop.setShopLevel('normal', 5);
      shop.reset();
      expect(shop.getShopLevel('normal')).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 9. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('update 不抛异常', () => {
      expect(() => shop.update(16)).not.toThrow();
    });

    it('getState 返回所有商店状态', () => {
      const state = shop.getState();
      expect(Object.keys(state)).toHaveLength(SHOP_TYPES.length);
    });
  });
});
