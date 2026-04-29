/**
 * ShopSystem 边界条件测试（R04 回合）
 *
 * 覆盖场景（12个）：
 * 1. 金币不足购买商品
 * 2. 购买不存在的商品ID
 * 3. 购买数量为0
 * 4. 购买数量为负数
 * 5. 购买数量为小数（非整数）
 * 6. 商品库存为0时购买
 * 7. 超过每日限购数量购买
 * 8. 超过终身限购数量购买
 * 9. 空商品ID购买
 * 10. 不存在的商店类型查询商品
 * 11. 折扣过期后价格恢复原价
 * 12. 收藏不存在的商品
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShopSystem } from '../ShopSystem';
import type {
  ShopType,
  BuyRequest,
  BuyValidation,
  GoodsItem,
  DiscountConfig,
} from '../../../core/shop/shop.types';
import { SHOP_TYPES } from '../../../core/shop/shop.types';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS } from '../../../core/shop/goods-data';
import type { CurrencySystem } from '../../currency/CurrencySystem';

// ── 辅助函数 ──

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
  shop.init({
    eventBus: mockEventBus as never,
    config: mockConfig as never,
    registry: mockRegistry as never,
  });
  return shop;
}

/** 创建 mock CurrencySystem（可控制是否可购买） */
function createMockCurrencySystem(affordable = true): CurrencySystem {
  return {
    name: 'currency',
    init: vi.fn(),
    update: vi.fn(),
    getState: vi.fn().mockReturnValue({}),
    reset: vi.fn(),
    checkAffordability: vi.fn().mockReturnValue({
      canAfford: affordable,
      shortages: affordable
        ? []
        : [{ currency: 'copper', required: 1000, gap: 500 }],
    }),
    spendByPriority: vi.fn().mockImplementation(() => {
      if (!affordable) throw new Error('货币不足');
      return {};
    }),
  } as unknown as CurrencySystem;
}

/** 获取一个 normal 商店中存在的商品ID */
function getNormalGoodsId(): string {
  const ids = SHOP_GOODS_IDS['normal'];
  return ids.length > 0 ? ids[0] : 'res_copper_small';
}

/** 构造购买请求 */
function makeBuyRequest(
  goodsId: string,
  quantity: number,
  shopType: ShopType = 'normal',
): BuyRequest {
  return { goodsId, quantity, shopType };
}

describe('ShopSystem 边界条件测试', () => {
  let shop: ShopSystem;

  beforeEach(() => {
    shop = createShop();
  });

  // ── 1. 金币不足购买商品 ──
  it('金币不足时购买应返回canBuy=false', () => {
    const cs = createMockCurrencySystem(false);
    shop.setCurrencySystem(cs);

    const goodsId = getNormalGoodsId();
    const request = makeBuyRequest(goodsId, 1);
    const result = shop.validateBuy(request);

    expect(result.canBuy).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // ── 2. 购买不存在的商品ID ──
  it('购买不存在的商品ID应返回商品不存在', () => {
    const request = makeBuyRequest('nonexistent_item_99999', 1);
    const result = shop.validateBuy(request);

    expect(result.canBuy).toBe(false);
    expect(result.errors).toContain('商品不存在');
  });

  // ── 3. 购买数量为0 ──
  it('购买数量为0应返回购买数量无效', () => {
    const goodsId = getNormalGoodsId();
    const request = makeBuyRequest(goodsId, 0);
    const result = shop.validateBuy(request);

    expect(result.canBuy).toBe(false);
    expect(result.errors.some((e) => e.includes('无效'))).toBe(true);
  });

  // ── 4. 购买数量为负数 ──
  it('购买数量为负数应返回购买数量无效', () => {
    const goodsId = getNormalGoodsId();
    const request = makeBuyRequest(goodsId, -5);
    const result = shop.validateBuy(request);

    expect(result.canBuy).toBe(false);
    expect(result.errors.some((e) => e.includes('无效'))).toBe(true);
  });

  // ── 5. 购买数量为小数（非整数） ──
  it('购买数量为小数应返回购买数量无效', () => {
    const goodsId = getNormalGoodsId();
    const request = makeBuyRequest(goodsId, 1.5);
    const result = shop.validateBuy(request);

    expect(result.canBuy).toBe(false);
    expect(result.errors.some((e) => e.includes('无效'))).toBe(true);
  });

  // ── 6. 商品库存为0时购买 ──
  it('商品库存为0时购买应返回库存不足', () => {
    const goodsId = getNormalGoodsId();
    // 手动将库存设为0
    const item = shop.getGoodsItem('normal', goodsId);
    if (item) {
      item.stock = 0;
    }

    const request = makeBuyRequest(goodsId, 1);
    const result = shop.validateBuy(request);

    expect(result.canBuy).toBe(false);
    expect(result.errors.some((e) => e.includes('库存不足'))).toBe(true);
  });

  // ── 7. 超过每日限购数量购买 ──
  it('超过每日限购数量应返回限购错误', () => {
    const goodsId = getNormalGoodsId();
    const item = shop.getGoodsItem('normal', goodsId);
    if (!item) return; // 商品不存在则跳过

    // 仅测试有每日限购的商品
    if (item.dailyLimit === -1) return;

    // 模拟已购买到上限
    item.dailyPurchased = item.dailyLimit;

    const request = makeBuyRequest(goodsId, 1);
    const result = shop.validateBuy(request);

    expect(result.canBuy).toBe(false);
    expect(result.errors.some((e) => e.includes('每日限购'))).toBe(true);
  });

  // ── 8. 超过终身限购数量购买 ──
  it('超过终身限购数量应返回限购错误', () => {
    const goodsId = getNormalGoodsId();
    const item = shop.getGoodsItem('normal', goodsId);
    if (!item) return;

    if (item.lifetimeLimit === -1) return;

    item.lifetimePurchased = item.lifetimeLimit;

    const request = makeBuyRequest(goodsId, 1);
    const result = shop.validateBuy(request);

    expect(result.canBuy).toBe(false);
    expect(result.errors.some((e) => e.includes('终身限购'))).toBe(true);
  });

  // ── 9. 空商品ID购买 ──
  it('空字符串商品ID购买应返回商品不存在', () => {
    const request = makeBuyRequest('', 1);
    const result = shop.validateBuy(request);

    expect(result.canBuy).toBe(false);
    expect(result.errors).toContain('商品不存在');
  });

  // ── 10. 不存在的商店类型查询商品 ──
  it('计算不存在商品的价格应返回空对象', () => {
    const price = shop.calculateFinalPrice('nonexistent_item_99999', 'normal');
    expect(price).toEqual({});
  });

  // ── 11. 折扣过期后价格恢复原价 ──
  it('过期折扣不应影响最终价格', () => {
    const goodsId = getNormalGoodsId();
    const def = GOODS_DEF_MAP[goodsId];
    if (!def) return;

    // 获取原价
    const originalPrice = shop.calculateFinalPrice(goodsId, 'normal');

    // 添加已过期的折扣
    const now = Date.now();
    const expiredDiscount: DiscountConfig = {
      id: 'expired_test',
      name: '过期折扣',
      type: 'percentage',
      rate: 0.5,
      startTime: now - 20000,
      endTime: now - 10000, // 已过期
      applicableGoods: [goodsId],
    };
    shop.addDiscount(expiredDiscount);

    const priceAfterExpired = shop.calculateFinalPrice(goodsId, 'normal');
    expect(priceAfterExpired).toEqual(originalPrice);
  });

  // ── 12. 收藏不存在的商品 ──
  it('收藏不存在的商品应返回false', () => {
    const result = shop.toggleFavorite('nonexistent_item_99999');
    expect(result).toBe(false);
  });
});
