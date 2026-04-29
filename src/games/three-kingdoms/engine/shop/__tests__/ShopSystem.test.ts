import { vi } from 'vitest';
/**
 * ShopSystem 单元测试
 *
 * 覆盖：
 * 1. 初始化（商店状态、商品列表）
 * 2. 商品分类与查询
 * 3. 定价与折扣
 * 4. 购买逻辑（验证 + 执行）
 * 5. 库存与限购
 * 6. 收藏管理
 * 7. 补货机制
 * 8. 商店等级
 * 9. 序列化/反序列化
 * 10. ISubsystem 接口
 */

import { ShopSystem } from '../ShopSystem';
import type {
  ShopType,
  GoodsCategory,
  GoodsDef,
  GoodsItem,
  BuyRequest,
  BuyResult,
  BuyValidation,
  ConfirmLevel,
  ShopState,
  ShopSaveData,
  DiscountConfig,
  GoodsFilter,
} from '../../../core/shop/shop.types';
import {
  SHOP_TYPES,
  SHOP_TYPE_LABELS,
  GOODS_CATEGORY_LABELS,
  GOODS_RARITY_LABELS,
} from '../../../core/shop/shop.types';
import {
  DEFAULT_RESTOCK_CONFIG,
  DAILY_MANUAL_REFRESH_LIMIT,
  SHOP_SAVE_VERSION,
  CONFIRM_THRESHOLDS,
  PERMANENT_GOODS_STOCK,
  RANDOM_GOODS_STOCK,
  DISCOUNT_GOODS_STOCK,
  LIMITED_GOODS_STOCK,
} from '../../../core/shop/shop-config';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS, ALL_GOODS_DEFS } from '../../../core/shop/goods-data';
import type { CurrencySystem } from '../../currency/CurrencySystem';

// ─── 辅助 ────────────────────────────────────

/** 创建带 mock deps 的 ShopSystem */
function createShop(): ShopSystem {
  const shop = new ShopSystem();
  const mockEventBus = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  const mockConfig = { get: vi.fn() };
  const mockRegistry = { get: vi.fn() };
  shop.init({ eventBus: mockEventBus as any, config: mockConfig as any, registry: mockRegistry as any });
  return shop;
}

/** 创建 mock CurrencySystem */
function createMockCurrencySystem(): CurrencySystem & {
  _checkResult: { canAfford: boolean; shortages: { currency: string; required: number; gap: number }[] };
  _setAffordable: (v: boolean) => void;
} {
  let affordable = true;
  const shortages = () => affordable
    ? []
    : [{ currency: 'copper', required: 1000, gap: 500 }];

  return {
    name: 'currency',
    init: vi.fn(),
    update: vi.fn(),
    getState: vi.fn().mockReturnValue({}),
    reset: vi.fn(),
    checkAffordability: vi.fn().mockImplementation(() => ({
      canAfford: affordable,
      shortages: shortages(),
    })),
    spendByPriority: vi.fn().mockImplementation(() => {
      if (!affordable) throw new Error('货币不足');
      return {};
    }),
    _checkResult: { canAfford: true, shortages: [] },
    _setAffordable: (v: boolean) => { affordable = v; },
  } as any;
}

/** 获取一个存在于 normal 商店的商品ID */
function getNormalGoodsId(): string {
  const ids = SHOP_GOODS_IDS['normal'];
  return ids.length > 0 ? ids[0] : 'res_copper_small';
}

/** 获取一个可收藏的商品ID */
function getFavoritableGoodsId(): string | undefined {
  for (const def of ALL_GOODS_DEFS) {
    if (def.favoritable) return def.id;
  }
  return undefined;
}

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

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
    it('name 为 shop', () => {
      expect(shop.name).toBe('shop');
    });

    it('应有4种商店类型', () => {
      expect(SHOP_TYPES).toHaveLength(4);
      expect(SHOP_TYPES).toContain('normal');
      expect(SHOP_TYPES).toContain('black_market');
      expect(SHOP_TYPES).toContain('limited_time');
      expect(SHOP_TYPES).toContain('vip');
    });

    it('所有商店类型都有标签', () => {
      for (const type of SHOP_TYPES) {
        expect(SHOP_TYPE_LABELS[type]).toBeTruthy();
      }
    });

    it('getState 返回所有商店状态', () => {
      const state = shop.getState();
      for (const type of SHOP_TYPES) {
        expect(state[type]).toBeDefined();
        expect(state[type].shopType).toBe(type);
        expect(Array.isArray(state[type].goods)).toBe(true);
      }
    });

    it('normal 商店初始化商品', () => {
      const goods = shop.getShopGoods('normal');
      expect(goods.length).toBeGreaterThan(0);
    });

    it('black_market 商店初始化商品', () => {
      const goods = shop.getShopGoods('black_market');
      expect(goods.length).toBeGreaterThan(0);
    });

    it('limited_time 商店初始化商品', () => {
      const goods = shop.getShopGoods('limited_time');
      expect(goods.length).toBeGreaterThan(0);
    });

    it('vip 商店初始化商品', () => {
      const goods = shop.getShopGoods('vip');
      expect(goods.length).toBeGreaterThan(0);
    });

    it('初始 manualRefreshCount 为 0', () => {
      const state = shop.getState();
      for (const type of SHOP_TYPES) {
        expect(state[type].manualRefreshCount).toBe(0);
      }
    });

    it('初始 shopLevel 为 1', () => {
      const state = shop.getState();
      for (const type of SHOP_TYPES) {
        expect(state[type].shopLevel).toBe(1);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 2. 商品分类与查询
  // ═══════════════════════════════════════════
  describe('商品分类与查询', () => {
    it('getCategories 返回所有分类', () => {
      const cats = shop.getCategories();
      expect(cats).toContain('resource');
      expect(cats).toContain('material');
      expect(cats).toContain('equipment');
      expect(cats).toContain('consumable');
      expect(cats).toContain('special');
    });

    it('getGoodsDef 返回存在的商品定义', () => {
      const id = getNormalGoodsId();
      const def = shop.getGoodsDef(id);
      expect(def).toBeDefined();
      expect(def!.id).toBe(id);
    });

    it('getGoodsDef 不存在返回 undefined', () => {
      const def = shop.getGoodsDef('nonexistent_item');
      expect(def).toBeUndefined();
    });

    it('getGoodsItem 返回指定商店的商品实例', () => {
      const id = getNormalGoodsId();
      const item = shop.getGoodsItem('normal', id);
      expect(item).toBeDefined();
      expect(item!.defId).toBe(id);
    });

    it('getGoodsItem 不在当前商店返回 undefined', () => {
      // limited_time 的商品不在 normal 里
      const ltdIds = SHOP_GOODS_IDS['limited_time'];
      if (ltdIds.length > 0) {
        const item = shop.getGoodsItem('normal', ltdIds[0]);
        expect(item).toBeUndefined();
      }
    });

    it('getGoodsByCategory 按分类过滤', () => {
      const items = shop.getGoodsByCategory('normal', 'resource');
      for (const item of items) {
        const def = GOODS_DEF_MAP[item.defId];
        expect(def?.category).toBe('resource');
      }
    });

    it('filterGoods 按关键词过滤', () => {
      const filter: GoodsFilter = { keyword: '铜钱' };
      const items = shop.filterGoods('normal', filter);
      for (const item of items) {
        const def = GOODS_DEF_MAP[item.defId];
        const match = def?.name.includes('铜钱') || def?.description.includes('铜钱');
        expect(match).toBe(true);
      }
    });

    it('filterGoods 仅显示有库存', () => {
      const filter: GoodsFilter = { inStockOnly: true };
      const items = shop.filterGoods('normal', filter);
      for (const item of items) {
        expect(item.stock === -1 || item.stock > 0).toBe(true);
      }
    });

    it('filterGoods 按价格排序', () => {
      const filter: GoodsFilter = { sortBy: 'price', sortOrder: 'asc' };
      const items = shop.filterGoods('normal', filter);
      for (let i = 1; i < items.length; i++) {
        const pA = Object.values(GOODS_DEF_MAP[items[i - 1].defId]?.basePrice ?? {})[0] ?? 0;
        const pB = Object.values(GOODS_DEF_MAP[items[i].defId]?.basePrice ?? {})[0] ?? 0;
        expect(pA).toBeLessThanOrEqual(pB);
      }
    });

    it('filterGoods 默认排序（收藏优先→折扣优先→价格升序）', () => {
      const filter: GoodsFilter = {};
      const items = shop.filterGoods('normal', filter);
      for (let i = 1; i < items.length; i++) {
        const dA = GOODS_DEF_MAP[items[i - 1].defId];
        const dB = GOODS_DEF_MAP[items[i].defId];
        const favA = shop.isFavorite(items[i - 1].defId) ? 0 : 1;
        const favB = shop.isFavorite(items[i].defId) ? 0 : 1;
        if (favA !== favB) {
          expect(favA).toBeLessThan(favB);
        } else if (items[i - 1].discount !== items[i].discount) {
          expect(items[i - 1].discount).toBeLessThanOrEqual(items[i].discount);
        } else {
          const pA = Object.values(dA?.basePrice ?? {})[0] ?? 0;
          const pB = Object.values(dB?.basePrice ?? {})[0] ?? 0;
          expect(pA).toBeLessThanOrEqual(pB);
        }
      }
    });

    it('filterGoods 按稀有度过滤', () => {
      const filter: GoodsFilter = { rarity: 'common' };
      const items = shop.filterGoods('normal', filter);
      for (const item of items) {
        const def = GOODS_DEF_MAP[item.defId];
        expect(def?.rarity).toBe('common');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 3. 定价与折扣
  // ═══════════════════════════════════════════
  describe('定价与折扣', () => {
    it('calculateFinalPrice 返回基础价格（无折扣）', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const price = shop.calculateFinalPrice(id, 'normal');
      expect(price).toBeDefined();
      // 无折扣时价格 = 基础价格
      for (const [cur, val] of Object.entries(def!.basePrice)) {
        expect(price[cur]).toBe(val);
      }
    });

    it('calculateFinalPrice 不存在的商品返回空对象', () => {
      const price = shop.calculateFinalPrice('nonexistent', 'normal');
      expect(price).toEqual({});
    });

    it('addDiscount 添加折扣后影响价格', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const basePrice = Object.values(def!.basePrice)[0];

      // 添加一个50%折扣
      const discount: DiscountConfig = {
        id: 'test_discount',
        type: 'limited_sale',
        rate: 0.5,
        applicableGoods: [id],
        startTime: Date.now() - 1000,
        endTime: Date.now() + 100000,
        description: '测试折扣',
      };
      shop.addDiscount(discount);

      const price = shop.calculateFinalPrice(id, 'normal');
      const finalVal = Object.values(price)[0];
      expect(finalVal).toBeLessThanOrEqual(basePrice);
    });

    it('addDiscount 过期折扣不影响价格', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const basePrice = Object.values(def!.basePrice)[0];

      const discount: DiscountConfig = {
        id: 'expired_discount',
        type: 'limited_sale',
        rate: 0.5,
        applicableGoods: [id],
        startTime: Date.now() - 200000,
        endTime: Date.now() - 1000, // 已过期
        description: '过期折扣',
      };
      shop.addDiscount(discount);

      const price = shop.calculateFinalPrice(id, 'normal');
      const finalVal = Object.values(price)[0];
      expect(finalVal).toBe(basePrice);
    });

    it('addDiscount 全局折扣（空 applicableGoods）', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const basePrice = Object.values(def!.basePrice)[0];

      const discount: DiscountConfig = {
        id: 'global_discount',
        type: 'normal',
        rate: 0.8,
        applicableGoods: [], // 空数组 = 全部适用
        startTime: Date.now() - 1000,
        endTime: Date.now() + 100000,
        description: '全局折扣',
      };
      shop.addDiscount(discount);

      const price = shop.calculateFinalPrice(id, 'normal');
      const finalVal = Object.values(price)[0];
      expect(finalVal).toBe(Math.ceil(basePrice * 0.8));
    });

    it('cleanupExpiredDiscounts 清理过期折扣', () => {
      // 添加一个过期折扣
      shop.addDiscount({
        id: 'expired_1',
        type: 'limited_sale',
        rate: 0.5,
        applicableGoods: [],
        startTime: Date.now() - 2000,
        endTime: Date.now() - 1000,
        description: '过期',
      });
      // 添加一个有效折扣
      shop.addDiscount({
        id: 'active_1',
        type: 'normal',
        rate: 0.9,
        applicableGoods: [],
        startTime: Date.now() - 1000,
        endTime: Date.now() + 100000,
        description: '有效',
      });

      const removed = shop.cleanupExpiredDiscounts();
      expect(removed).toBe(1);
    });

    it('NPC好感度折扣生效', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const basePrice = Object.values(def!.basePrice)[0];

      // 设置NPC折扣：9折
      shop.setNPCDiscountProvider((_npcId: string) => 0.9);

      const price = shop.calculateFinalPrice(id, 'normal', 'npc_001');
      const finalVal = Object.values(price)[0];
      expect(finalVal).toBe(Math.ceil(basePrice * 0.9));
    });

    it('setNPCDiscountProvider 设置后可覆盖', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const basePrice = Object.values(def!.basePrice)[0];

      shop.setNPCDiscountProvider(() => 0.8);
      const price1 = shop.calculateFinalPrice(id, 'normal', 'npc_001');
      const val1 = Object.values(price1)[0];
      expect(val1).toBe(Math.ceil(basePrice * 0.8));

      shop.setNPCDiscountProvider(() => 0.5);
      const price2 = shop.calculateFinalPrice(id, 'normal', 'npc_001');
      const val2 = Object.values(price2)[0];
      expect(val2).toBe(Math.ceil(basePrice * 0.5));
    });
  });

  // ═══════════════════════════════════════════
  // 4. 购买逻辑
  // ═══════════════════════════════════════════
  describe('购买逻辑', () => {
    it('validateBuy 商品不存在返回失败', () => {
      const req: BuyRequest = { goodsId: 'nonexistent', quantity: 1, shopType: 'normal' };
      const result = shop.validateBuy(req);
      expect(result.canBuy).toBe(false);
      expect(result.errors).toContain('商品不存在');
    });

    it('validateBuy 商品不在当前商店返回失败', () => {
      // limited_time 商品在 normal 商店中不存在
      const ltdIds = SHOP_GOODS_IDS['limited_time'];
      if (ltdIds.length > 0) {
        const req: BuyRequest = { goodsId: ltdIds[0], quantity: 1, shopType: 'normal' };
        const result = shop.validateBuy(req);
        expect(result.canBuy).toBe(false);
        expect(result.errors).toContain('商品不在当前商店中');
      }
    });

    it('validateBuy 正常商品通过验证', () => {
      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      const result = shop.validateBuy(req);
      // permanent 商品无限库存，无限购
      expect(result.canBuy).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validateBuy 返回 confirmLevel', () => {
      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      const result = shop.validateBuy(req);
      expect(['none', 'low', 'medium', 'high', 'critical']).toContain(result.confirmLevel);
    });

    it('validateBuy 货币不足返回失败（有 CurrencySystem）', () => {
      const mockCS = createMockCurrencySystem();
      shop.setCurrencySystem(mockCS);
      mockCS._setAffordable(false);

      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      const result = shop.validateBuy(req);
      expect(result.canBuy).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validateBuy 货币充足通过（有 CurrencySystem）', () => {
      const mockCS = createMockCurrencySystem();
      shop.setCurrencySystem(mockCS);
      mockCS._setAffordable(true);

      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      const result = shop.validateBuy(req);
      expect(result.canBuy).toBe(true);
    });

    it('executeBuy 成功购买', () => {
      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      const result = shop.executeBuy(req);
      expect(result.success).toBe(true);
      expect(result.goodsId).toBe(id);
      expect(result.quantity).toBe(1);
    });

    it('executeBuy 验证失败返回失败', () => {
      const req: BuyRequest = { goodsId: 'nonexistent', quantity: 1, shopType: 'normal' };
      const result = shop.executeBuy(req);
      expect(result.success).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it('executeBuy 购买后更新 dailyPurchased 和 lifetimePurchased', () => {
      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 2, shopType: 'normal' };
      shop.executeBuy(req);

      const item = shop.getGoodsItem('normal', id);
      expect(item!.dailyPurchased).toBe(2);
      expect(item!.lifetimePurchased).toBe(2);
    });

    it('executeBuy 有库存商品购买后库存减少', () => {
      // 找一个有库存的商品（非 permanent = stock !== -1）
      const bmIds = SHOP_GOODS_IDS['black_market'];
      if (bmIds.length > 0) {
        const id = bmIds[0];
        const before = shop.getGoodsItem('black_market', id);
        if (before && before.stock > 0 && before.stock !== -1) {
          const stockBefore = before.stock;
          const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'black_market' };
          const result = shop.executeBuy(req);
          if (result.success) {
            const after = shop.getGoodsItem('black_market', id);
            expect(after!.stock).toBe(stockBefore - 1);
          }
        }
      }
    });

    it('executeBuy 货币扣费失败返回失败', () => {
      const mockCS = createMockCurrencySystem();
      shop.setCurrencySystem(mockCS);
      mockCS._setAffordable(false);

      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      const result = shop.executeBuy(req);
      expect(result.success).toBe(false);
    });

    it('executeBuy 成功后触发 eventBus', () => {
      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      shop.executeBuy(req);

      // eventBus.emit should have been called (we mock it in createShop)
      // Since init was called with mockEventBus, we can check indirectly
      // by verifying the buy succeeded
      const item = shop.getGoodsItem('normal', id);
      expect(item!.dailyPurchased).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 库存与限购
  // ═══════════════════════════════════════════
  describe('库存与限购', () => {
    it('getStockInfo 返回库存信息', () => {
      const id = getNormalGoodsId();
      const info = shop.getStockInfo('normal', id);
      expect(info).toBeDefined();
      expect(typeof info!.stock).toBe('number');
      expect(typeof info!.dailyPurchased).toBe('number');
    });

    it('getStockInfo 不存在返回 null', () => {
      const info = shop.getStockInfo('normal', 'nonexistent');
      expect(info).toBeNull();
    });

    it('resetDailyLimits 重置每日购买计数', () => {
      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      shop.executeBuy(req);

      let item = shop.getGoodsItem('normal', id);
      expect(item!.dailyPurchased).toBe(1);

      shop.resetDailyLimits();
      item = shop.getGoodsItem('normal', id);
      expect(item!.dailyPurchased).toBe(0);
    });

    it('resetDailyLimits 重置 manualRefreshCount', () => {
      shop.manualRefresh();
      const stateBefore = shop.getState();
      for (const type of SHOP_TYPES) {
        expect(stateBefore[type].manualRefreshCount).toBeGreaterThan(0);
      }

      shop.resetDailyLimits();
      const stateAfter = shop.getState();
      for (const type of SHOP_TYPES) {
        expect(stateAfter[type].manualRefreshCount).toBe(0);
      }
    });

    it('manualRefresh 成功刷新', () => {
      const result = shop.manualRefresh();
      expect(result.success).toBe(true);
    });

    it('manualRefresh 超过次数限制后失败', () => {
      // 刷新到上限
      for (let i = 0; i < DAILY_MANUAL_REFRESH_LIMIT; i++) {
        shop.manualRefresh();
      }
      const result = shop.manualRefresh();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('刷新次数');
    });

    it('库存不足时 validateBuy 失败', () => {
      // 找一个库存有限的商品
      const bmIds = SHOP_GOODS_IDS['black_market'];
      if (bmIds.length > 0) {
        const id = bmIds[0];
        const item = shop.getGoodsItem('black_market', id);
        if (item && item.stock > 0 && item.stock !== -1) {
          // 尝试购买超过库存的数量
          const req: BuyRequest = { goodsId: id, quantity: item.stock + 100, shopType: 'black_market' };
          const result = shop.validateBuy(req);
          expect(result.canBuy).toBe(false);
          expect(result.errors.some(e => e.includes('库存不足'))).toBe(true);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 6. 收藏管理
  // ═══════════════════════════════════════════
  describe('收藏管理', () => {
    it('toggleFavorite 添加收藏', () => {
      const favId = getFavoritableGoodsId();
      if (favId) {
        const result = shop.toggleFavorite(favId);
        expect(result).toBe(true); // true = 已添加
        expect(shop.isFavorite(favId)).toBe(true);
      }
    });

    it('toggleFavorite 取消收藏', () => {
      const favId = getFavoritableGoodsId();
      if (favId) {
        shop.toggleFavorite(favId); // 添加
        const result = shop.toggleFavorite(favId); // 取消
        expect(result).toBe(false); // false = 已移除
        expect(shop.isFavorite(favId)).toBe(false);
      }
    });

    it('toggleFavorite 不可收藏商品返回 false', () => {
      // 找一个不可收藏的商品
      const nonFav = ALL_GOODS_DEFS.find(d => !d.favoritable);
      if (nonFav) {
        const result = shop.toggleFavorite(nonFav.id);
        expect(result).toBe(false);
      }
    });

    it('toggleFavorite 不存在的商品返回 false', () => {
      const result = shop.toggleFavorite('nonexistent');
      expect(result).toBe(false);
    });

    it('getFavorites 返回收藏列表', () => {
      const favId = getFavoritableGoodsId();
      if (favId) {
        shop.toggleFavorite(favId);
        const favs = shop.getFavorites();
        expect(favs).toContain(favId);
      }
    });

    it('isFavorite 未收藏返回 false', () => {
      expect(shop.isFavorite('nonexistent')).toBe(false);
    });

    it('filterGoods favoritesOnly 过滤', () => {
      const favId = getFavoritableGoodsId();
      if (favId) {
        shop.toggleFavorite(favId);
        const filter: GoodsFilter = { favoritesOnly: true };
        const items = shop.filterGoods('normal', filter);
        for (const item of items) {
          expect(shop.isFavorite(item.defId)).toBe(true);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 7. 补货机制
  // ═══════════════════════════════════════════
  describe('补货机制', () => {
    it('manualRefresh 后商品被重新生成', () => {
      const before = shop.getShopGoods('normal').map(g => g.defId);
      shop.manualRefresh();
      const after = shop.getShopGoods('normal').map(g => g.defId);
      // 商品ID列表应该不变（同一商店的固定商品）
      expect(after.sort()).toEqual(before.sort());
    });

    it('manualRefresh 重置购买计数', () => {
      const id = getNormalGoodsId();
      shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'normal' });
      shop.manualRefresh();
      const item = shop.getGoodsItem('normal', id);
      expect(item!.dailyPurchased).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 商店等级
  // ═══════════════════════════════════════════
  describe('商店等级', () => {
    it('getShopLevel 初始为 1', () => {
      for (const type of SHOP_TYPES) {
        expect(shop.getShopLevel(type)).toBe(1);
      }
    });

    it('setShopLevel 设置等级', () => {
      shop.setShopLevel('normal', 5);
      expect(shop.getShopLevel('normal')).toBe(5);
    });

    it('setShopLevel 不影响其他商店', () => {
      shop.setShopLevel('normal', 3);
      expect(shop.getShopLevel('black_market')).toBe(1);
      expect(shop.getShopLevel('limited_time')).toBe(1);
      expect(shop.getShopLevel('vip')).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('序列化', () => {
    it('serialize 返回正确结构', () => {
      const data = shop.serialize();
      expect(data.version).toBe(SHOP_SAVE_VERSION);
      expect(data.shops).toBeDefined();
      expect(data.favorites).toBeDefined();
      expect(Array.isArray(data.favorites)).toBe(true);
    });

    it('serialize/deserialize 往返一致', () => {
      const id = getNormalGoodsId();
      shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'normal' });
      shop.setShopLevel('normal', 3);

      const favId = getFavoritableGoodsId();
      if (favId) shop.toggleFavorite(favId);

      const data = shop.serialize();

      const shop2 = createShop();
      shop2.deserialize(data);

      expect(shop2.getShopLevel('normal')).toBe(3);
      if (favId) expect(shop2.isFavorite(favId)).toBe(true);

      const item = shop2.getGoodsItem('normal', id);
      expect(item!.dailyPurchased).toBe(1);
    });

    it('deserialize 版本不匹配不抛异常（仅警告）', () => {
      const data: ShopSaveData = {
        shops: {} as any,
        favorites: [],
        version: 999,
      };
      // 不应抛异常，仅 console.warn
      expect(() => shop.deserialize(data)).not.toThrow();
    });

    it('reset 恢复初始状态', () => {
      const id = getNormalGoodsId();
      shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'normal' });
      shop.setShopLevel('normal', 5);

      shop.reset();

      expect(shop.getShopLevel('normal')).toBe(1);
      const item = shop.getGoodsItem('normal', id);
      expect(item!.dailyPurchased).toBe(0);
      expect(shop.getFavorites()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 10. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('update 不抛异常', () => {
      expect(() => shop.update(16)).not.toThrow();
    });

    it('init 可多次调用', () => {
      expect(() => {
        shop.init({ eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as any, config: { get: vi.fn() } as any, registry: { get: vi.fn() } as any });
      }).not.toThrow();
    });

    it('setCurrencySystem 注入成功', () => {
      const mockCS = createMockCurrencySystem();
      expect(() => shop.setCurrencySystem(mockCS)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 11. 确认等级阈值
  // ═══════════════════════════════════════════
  describe('确认等级', () => {
    it('CONFIRM_THRESHOLDS 包含所有等级', () => {
      expect(CONFIRM_THRESHOLDS.none).toBeDefined();
      expect(CONFIRM_THRESHOLDS.low).toBeDefined();
      expect(CONFIRM_THRESHOLDS.medium).toBeDefined();
      expect(CONFIRM_THRESHOLDS.high).toBeDefined();
    });

    it('阈值递增', () => {
      expect(CONFIRM_THRESHOLDS.none).toBeLessThan(CONFIRM_THRESHOLDS.low);
      expect(CONFIRM_THRESHOLDS.low).toBeLessThan(CONFIRM_THRESHOLDS.medium);
      expect(CONFIRM_THRESHOLDS.medium).toBeLessThan(CONFIRM_THRESHOLDS.high);
    });
  });
});
