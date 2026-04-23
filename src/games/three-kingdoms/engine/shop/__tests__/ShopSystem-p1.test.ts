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
import type { ISystemDeps } from '../../../core/types/subsystem';
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
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
  };
  const mockConfig = { get: jest.fn() };
  const mockRegistry = { get: jest.fn() };
  shop.init({
    eventBus: mockEventBus as unknown as ISystemDeps['eventBus'],
    config: mockConfig as unknown as ISystemDeps['config'],
    registry: mockRegistry as unknown as ISystemDeps['registry'],
  });
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
    init: jest.fn(),
    update: jest.fn(),
    getState: jest.fn().mockReturnValue({}),
    reset: jest.fn(),
    checkAffordability: jest.fn().mockImplementation(() => ({
      canAfford: affordable,
      shortages: shortages(),
    })),
    spendByPriority: jest.fn().mockImplementation(() => {
      if (!affordable) throw new Error('货币不足');
      return {};
    }),
    _checkResult: { canAfford: true, shortages: [] },
    _setAffordable: (v: boolean) => { affordable = v; },
  } as unknown as CurrencySystem & {
    _checkResult: { canAfford: boolean; shortages: { currency: string; required: number; gap: number }[] };
    _setAffordable: (v: boolean) => void;
  };
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
    jest.restoreAllMocks();
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

    it('filterGoods 按名称排序（默认）', () => {
      const filter: GoodsFilter = {};
      const items = shop.filterGoods('normal', filter);
      for (let i = 1; i < items.length; i++) {
        const nA = GOODS_DEF_MAP[items[i - 1].defId]?.name ?? '';
        const nB = GOODS_DEF_MAP[items[i].defId]?.name ?? '';
        expect(nA.localeCompare(nB)).toBeLessThanOrEqual(0);
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
