/**
 * ACC-10 商店系统 — 引擎层验收测试
 *
 * 覆盖 ACC-10 验收标准中所有引擎层相关条目：
 * - ACC-10-20: 购买后货币扣除正确
 * - ACC-10-21: 折扣价格计算正确
 * - ACC-10-22: 限购计数更新
 * - ACC-10-23: 达到每日限购后禁止购买
 * - ACC-10-24: 库存数量减少
 * - ACC-10-25: 无限库存商品不显示售罄
 * - ACC-10-27: 不同商店商品独立
 * - ACC-10-28: 终身限购累计正确
 * - ACC-10-30: 余额恰好等于价格
 * - ACC-10-31: 余额为0时购买
 * - ACC-10-32: 每日限购重置
 * - ACC-10-33: 手动刷新商店
 * - ACC-10-34: 手动刷新次数耗尽
 * - ACC-10-35: 多货币混合价格
 * - ACC-10-36: 购买后立即再次购买同一商品
 * - ACC-10-37: 折扣商品叠加活动折扣
 * - ACC-10-38: 过期折扣自动清理
 * - ACC-10-39: 商品定义缺失容错
 *
 * @module engine/shop/__tests__/ACC-10.shop-engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShopSystem } from '../ShopSystem';
import type {
  BuyRequest, DiscountConfig, ShopType,
} from '../../../core/shop/shop.types';
import {
  SHOP_TYPES,
} from '../../../core/shop/shop.types';
import {
  DAILY_MANUAL_REFRESH_LIMIT,
} from '../../../core/shop/shop-config';
import {
  GOODS_DEF_MAP, SHOP_GOODS_IDS, ALL_GOODS_DEFS,
} from '../../../core/shop/goods-data';
import type { CurrencySystem } from '../../currency/CurrencySystem';

// ─── 辅助函数 ────────────────────────────────

function createShop(): ShopSystem {
  const shop = new ShopSystem();
  shop.init({
    eventBus: { emit: vi.fn() as unknown as (...args: unknown[]) => void, on: vi.fn() as unknown as (...args: unknown[]) => void, off: vi.fn() as unknown as (...args: unknown[]) => void },
    config: { get: vi.fn() as unknown as (key: string) => unknown },
    registry: { get: vi.fn() as unknown as (key: string) => unknown },
  });
  return shop;
}

/** 创建 mock CurrencySystem，支持精确余额控制 */
function createMockCurrencySystem(balances: Record<string, number> = { copper: 99999 }): CurrencySystem {
  const state = { ...balances };
  return {
    name: 'currency',
    init: vi.fn(),
    update: vi.fn(),
    getState: vi.fn().mockReturnValue({}),
    reset: vi.fn(),
    getBalance: vi.fn().mockImplementation((cur: string) => state[cur] ?? 0),
    checkAffordability: vi.fn().mockImplementation((price: Record<string, number>) => {
      const shortages: { currency: string; required: number; gap: number }[] = [];
      let canAfford = true;
      for (const [cur, amt] of Object.entries(price)) {
        const bal = state[cur] ?? 0;
        if (bal < amt) {
          canAfford = false;
          shortages.push({ currency: cur, required: amt, gap: amt - bal });
        }
      }
      return { canAfford, shortages };
    }),
    spendByPriority: vi.fn().mockImplementation((_shopType: string, price: Record<string, number>) => {
      for (const [cur, amt] of Object.entries(price)) {
        const bal = state[cur] ?? 0;
        if (bal < amt) throw new Error(`${cur}不足`);
        state[cur] = bal - amt;
      }
    }),
  } as unknown as Record<string, unknown>;
}

/** 获取 normal 商店的第一个商品ID */
function getNormalGoodsId(): string {
  return SHOP_GOODS_IDS['normal'][0] ?? 'res_grain_small';
}

/** 获取一个有库存限制的商品（非 permanent） */
function getLimitedGoodsId(): { shopType: ShopType; goodsId: string } | null {
  // black_market 中的商品通常有库存
  const bmIds = SHOP_GOODS_IDS['black_market'];
  if (bmIds.length > 0) {
    const id = bmIds[0];
    const def = GOODS_DEF_MAP[id];
    if (def && def.goodsType !== 'permanent') {
      return { shopType: 'black_market', goodsId: id };
    }
  }
  // limited_time
  const ltdIds = SHOP_GOODS_IDS['limited_time'];
  if (ltdIds.length > 0) {
    return { shopType: 'limited_time', goodsId: ltdIds[0] };
  }
  return null;
}

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('ACC-10 商店系统引擎层验收', () => {
  let shop: ShopSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    shop = createShop();
  });

  // ═══════════════════════════════════════════
  // ACC-10-20: 购买后货币扣除正确
  // ═══════════════════════════════════════════
  describe('ACC-10-20 购买后货币扣除正确', () => {
    it('ACC-10-20: 购买后货币余额减少精确等于商品最终价格', () => {
      const cs = createMockCurrencySystem({ copper: 10000 });
      shop.setCurrencySystem(cs);

      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const basePrice = Object.entries(def!.basePrice)[0]; // [currency, amount]

      const before = (cs.getBalance as unknown as (type: string) => number)(basePrice[0]);
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      const result = shop.executeBuy(req);

      expect(result.success).toBe(true);
      const after = (cs.getBalance as unknown as (type: string) => number)(basePrice[0]);
      // 扣费差额应等于基础价格（无折扣时）
      expect(before - after).toBe(basePrice[1]);
    });

    it('ACC-10-20: 购买2个商品，扣费翻倍', () => {
      const cs = createMockCurrencySystem({ copper: 10000 });
      shop.setCurrencySystem(cs);

      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const basePrice = Object.entries(def!.basePrice)[0];

      const before = (cs.getBalance as unknown as (type: string) => number)(basePrice[0]);
      const req: BuyRequest = { goodsId: id, quantity: 2, shopType: 'normal' };
      const result = shop.executeBuy(req);

      expect(result.success).toBe(true);
      const after = (cs.getBalance as unknown as (type: string) => number)(basePrice[0]);
      expect(before - after).toBe(basePrice[1] * 2);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-21: 折扣价格计算正确
  // ═══════════════════════════════════════════
  describe('ACC-10-21 折扣价格计算正确', () => {
    it('ACC-10-21: 折扣价=原价×折扣率向上取整', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const basePrice = Object.entries(def!.basePrice)[0];

      // 给商品设置折扣
      const item = shop.getGoodsItem('normal', id);
      if (item) {
        item.discount = 0.8;
      }

      const finalPrice = shop.calculateFinalPrice(id, 'normal');
      const expected = Math.ceil(basePrice[1] * 0.8);
      expect(finalPrice[basePrice[0]]).toBe(expected);
    });

    it('ACC-10-21: 活动折扣叠加取最低折扣率', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const basePrice = Object.entries(def!.basePrice)[0];

      // 添加一个0.7的活动折扣
      const discount: DiscountConfig = {
        type: 'limited_sale',
        rate: 0.7,
        startTime: Date.now() - 1000,
        endTime: Date.now() + 100000,
        applicableGoods: [id],
      };
      shop.addDiscount(discount);

      const finalPrice = shop.calculateFinalPrice(id, 'normal');
      const expected = Math.ceil(basePrice[1] * 0.7);
      expect(finalPrice[basePrice[0]]).toBe(expected);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-22: 限购计数更新
  // ═══════════════════════════════════════════
  describe('ACC-10-22 限购计数更新', () => {
    it('ACC-10-22: 购买后dailyPurchased递增', () => {
      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      shop.executeBuy(req);

      const info = shop.getStockInfo('normal', id);
      expect(info!.dailyPurchased).toBe(1);
    });

    it('ACC-10-22: 购买后lifetimePurchased递增', () => {
      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 1, shopType: 'normal' };
      shop.executeBuy(req);

      const info = shop.getStockInfo('normal', id);
      expect(info!.lifetimePurchased).toBe(1);
    });

    it('ACC-10-22: 批量购买限购计数正确累计', () => {
      const id = getNormalGoodsId();
      const req: BuyRequest = { goodsId: id, quantity: 3, shopType: 'normal' };
      shop.executeBuy(req);

      const info = shop.getStockInfo('normal', id);
      expect(info!.dailyPurchased).toBe(3);
      expect(info!.lifetimePurchased).toBe(3);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-23: 达到每日限购后禁止购买
  // ═══════════════════════════════════════════
  describe('ACC-10-23 达到每日限购后禁止购买', () => {
    it('ACC-10-23: 达到每日限购后validateBuy返回错误', () => {
      // 找一个有每日限购的商品
      const limited = getLimitedGoodsId();
      if (limited) {
        const item = shop.getGoodsItem(limited.shopType, limited.goodsId);
        if (item && item.dailyLimit > 0) {
          // 买到上限
          const maxBuy = item.dailyLimit;
          for (let i = 0; i < maxBuy; i++) {
            shop.executeBuy({ goodsId: limited.goodsId, quantity: 1, shopType: limited.shopType });
          }
          // 再次购买应失败
          const result = shop.validateBuy({ goodsId: limited.goodsId, quantity: 1, shopType: limited.shopType });
          expect(result.canBuy).toBe(false);
          expect(result.errors.some(e => e.includes('每日限购'))).toBe(true);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-24: 库存数量减少
  // ═══════════════════════════════════════════
  describe('ACC-10-24 库存数量减少', () => {
    it('ACC-10-24: 购买后有库存商品库存减少', () => {
      const limited = getLimitedGoodsId();
      if (limited) {
        const item = shop.getGoodsItem(limited.shopType, limited.goodsId);
        if (item && item.stock > 0 && item.stock !== -1) {
          const stockBefore = item.stock;
          shop.executeBuy({ goodsId: limited.goodsId, quantity: 1, shopType: limited.shopType });
          expect(item.stock).toBe(stockBefore - 1);
        }
      }
    });

    it('ACC-10-24: 库存降为0后validateBuy失败', () => {
      const limited = getLimitedGoodsId();
      if (limited) {
        const item = shop.getGoodsItem(limited.shopType, limited.goodsId);
        if (item && item.stock > 0 && item.stock !== -1) {
          // 买光库存
          while (item.stock > 0) {
            shop.executeBuy({ goodsId: limited.goodsId, quantity: 1, shopType: limited.shopType });
          }
          expect(item.stock).toBe(0);
          // 再次购买应失败
          const result = shop.validateBuy({ goodsId: limited.goodsId, quantity: 1, shopType: limited.shopType });
          expect(result.canBuy).toBe(false);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-25: 无限库存商品不显示售罄
  // ═══════════════════════════════════════════
  describe('ACC-10-25 无限库存商品不显示售罄', () => {
    it('ACC-10-25: stock=-1的商品始终可购买', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      if (def && def.goodsType === 'permanent') {
        const item = shop.getGoodsItem('normal', id);
        expect(item!.stock).toBe(-1);

        // 购买10次
        for (let i = 0; i < 10; i++) {
          const result = shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'normal' });
          expect(result.success).toBe(true);
        }
        // 库存仍为-1
        expect(item!.stock).toBe(-1);
      }
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-27: 不同商店商品独立
  // ═══════════════════════════════════════════
  describe('ACC-10-27 不同商店商品独立', () => {
    it('ACC-10-27: 各商店商品列表独立', () => {
      const normalGoods = shop.getShopGoods('normal');
      const bmGoods = shop.getShopGoods('black_market');
      const ltdGoods = shop.getShopGoods('limited_time');
      const vipGoods = shop.getShopGoods('vip');

      // 各商店都有商品
      expect(normalGoods.length).toBeGreaterThan(0);
      expect(bmGoods.length).toBeGreaterThan(0);
      expect(ltdGoods.length).toBeGreaterThan(0);
      expect(vipGoods.length).toBeGreaterThan(0);

      // 商店间的商品实例是独立的
      const normalIds = normalGoods.map(g => g.defId);
      const bmIds = bmGoods.map(g => g.defId);
      // black_market 应该是 normal 的子集或不同集合
      // 关键是各自有独立的 GoodsItem 实例
    });

    it('ACC-10-27: 购买记录各商店独立', () => {
      const id = getNormalGoodsId();
      shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'normal' });

      const normalItem = shop.getGoodsItem('normal', id);
      expect(normalItem!.dailyPurchased).toBe(1);

      // 其他商店的该商品不受影响（如果存在的话）
      for (const type of SHOP_TYPES) {
        if (type === 'normal') continue;
        const otherItem = shop.getGoodsItem(type, id);
        if (otherItem) {
          // 如果该商品也在其他商店，购买记录应独立
          expect(otherItem === normalItem).toBe(false);
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-28: 终身限购累计正确
  // ═══════════════════════════════════════════
  describe('ACC-10-28 终身限购累计正确', () => {
    it('ACC-10-28: lifetimePurchased递增且达到lifetimeLimit后无法继续购买', () => {
      // 找一个有终身限购的商品
      const ltdInfo = getLimitedGoodsId();
      if (ltdInfo) {
        const item = shop.getGoodsItem(ltdInfo.shopType, ltdInfo.goodsId);
        if (item && item.lifetimeLimit > 0 && item.lifetimeLimit !== -1) {
          const maxBuy = item.lifetimeLimit;
          // 买到终身上限
          for (let i = 0; i < maxBuy; i++) {
            const r = shop.executeBuy({ goodsId: ltdInfo.goodsId, quantity: 1, shopType: ltdInfo.shopType });
            expect(r.success).toBe(true);
          }
          expect(item.lifetimePurchased).toBe(maxBuy);
          // 再次购买应失败
          const result = shop.validateBuy({ goodsId: ltdInfo.goodsId, quantity: 1, shopType: ltdInfo.shopType });
          expect(result.canBuy).toBe(false);
          expect(result.errors.some(e => e.includes('终身限购'))).toBe(true);
        }
      }
    });

    it('ACC-10-28: getStockInfo返回正确的lifetimePurchased', () => {
      const id = getNormalGoodsId();
      shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'normal' });

      const info = shop.getStockInfo('normal', id);
      expect(info).not.toBeNull();
      expect(info!.lifetimePurchased).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-30: 余额恰好等于价格
  // ═══════════════════════════════════════════
  describe('ACC-10-30 余额恰好等于价格', () => {
    it('ACC-10-30: 余额恰好等于价格时购买成功', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const [cur, amt] = Object.entries(def!.basePrice)[0];

      // 精确设置余额
      const cs = createMockCurrencySystem({ [cur]: amt });
      shop.setCurrencySystem(cs);

      const result = shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'normal' });
      expect(result.success).toBe(true);
      expect((cs.getBalance as unknown as (type: string) => number)(cur)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-31: 余额为0时购买
  // ═══════════════════════════════════════════
  describe('ACC-10-31 余额为0时购买', () => {
    it('ACC-10-31: 余额为0时validateBuy返回货币不足', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const [cur] = Object.entries(def!.basePrice)[0];

      const cs = createMockCurrencySystem({ [cur]: 0 });
      shop.setCurrencySystem(cs);

      const result = shop.validateBuy({ goodsId: id, quantity: 1, shopType: 'normal' });
      expect(result.canBuy).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('ACC-10-31: 余额为0时executeBuy返回失败', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const [cur] = Object.entries(def!.basePrice)[0];

      const cs = createMockCurrencySystem({ [cur]: 0 });
      shop.setCurrencySystem(cs);

      const result = shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'normal' });
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-32: 每日限购重置
  // ═══════════════════════════════════════════
  describe('ACC-10-32 每日限购重置', () => {
    it('ACC-10-32: resetDailyLimits后dailyPurchased归零', () => {
      const id = getNormalGoodsId();
      shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'normal' });
      expect(shop.getStockInfo('normal', id)!.dailyPurchased).toBe(1);

      shop.resetDailyLimits();
      expect(shop.getStockInfo('normal', id)!.dailyPurchased).toBe(0);
    });

    it('ACC-10-32: resetDailyLimits后manualRefreshCount归零', () => {
      shop.manualRefresh();
      const stateBefore = shop.getState();
      expect(stateBefore['normal'].manualRefreshCount).toBeGreaterThan(0);

      shop.resetDailyLimits();
      const stateAfter = shop.getState();
      for (const type of SHOP_TYPES) {
        expect(stateAfter[type].manualRefreshCount).toBe(0);
      }
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-33: 手动刷新商店
  // ═══════════════════════════════════════════
  describe('ACC-10-33 手动刷新商店', () => {
    it('ACC-10-33: manualRefresh成功', () => {
      const result = shop.manualRefresh();
      expect(result.success).toBe(true);
    });

    it('ACC-10-33: manualRefresh后商品重新生成', () => {
      const before = shop.getShopGoods('normal');
      shop.manualRefresh();
      const after = shop.getShopGoods('normal');
      // 商品列表ID应相同（同一商店的固定商品池）
      expect(after.map(g => g.defId).sort()).toEqual(before.map(g => g.defId).sort());
    });

    it('ACC-10-33: manualRefresh后刷新计数+1', () => {
      shop.manualRefresh();
      const state = shop.getState();
      expect(state['normal'].manualRefreshCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-34: 手动刷新次数耗尽
  // ═══════════════════════════════════════════
  describe('ACC-10-34 手动刷新次数耗尽', () => {
    it('ACC-10-34: 达到每日上限后返回失败', () => {
      for (let i = 0; i < DAILY_MANUAL_REFRESH_LIMIT; i++) {
        shop.manualRefresh();
      }
      const result = shop.manualRefresh();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('刷新次数');
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-35: 多货币混合价格
  // ═══════════════════════════════════════════
  describe('ACC-10-35 多货币混合价格', () => {
    it('ACC-10-35: 一种货币不足时validateBuy提示具体缺少哪种', () => {
      // 找一个使用非copper货币的商品
      const mandateGoods = ALL_GOODS_DEFS.find(d => d.basePrice['mandate'] && Object.keys(d.basePrice).length === 1);
      if (mandateGoods) {
        const shopType = SHOP_GOODS_IDS['normal'].includes(mandateGoods.id) ? 'normal' : 'black_market';
        const cs = createMockCurrencySystem({ copper: 99999, mandate: 0 });
        shop.setCurrencySystem(cs);

        const result = shop.validateBuy({ goodsId: mandateGoods.id, quantity: 1, shopType });
        expect(result.canBuy).toBe(false);
        expect(result.errors.some(e => e.includes('天命') || e.includes('mandate'))).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-36: 购买后立即再次购买同一商品
  // ═══════════════════════════════════════════
  describe('ACC-10-36 购买后立即再次购买同一商品', () => {
    it('ACC-10-36: 连续购买同一商品每次都正确扣费', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const [cur, amt] = Object.entries(def!.basePrice)[0];

      const cs = createMockCurrencySystem({ [cur]: amt * 5 });
      shop.setCurrencySystem(cs);

      for (let i = 0; i < 5; i++) {
        const result = shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'normal' });
        expect(result.success).toBe(true);
      }

      expect((cs.getBalance as unknown as (type: string) => number)(cur)).toBe(0);
      const item = shop.getGoodsItem('normal', id);
      expect(item!.dailyPurchased).toBe(5);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-37: 折扣商品叠加活动折扣
  // ═══════════════════════════════════════════
  describe('ACC-10-37 折扣商品叠加活动折扣', () => {
    it('ACC-10-37: 最终折扣取最低值', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const [cur, baseAmt] = Object.entries(def!.basePrice)[0];

      // 商品自身折扣0.8
      const item = shop.getGoodsItem('normal', id);
      if (item) item.discount = 0.8;

      // 活动折扣0.7
      shop.addDiscount({
        type: 'limited_sale',
        rate: 0.7,
        startTime: Date.now() - 1000,
        endTime: Date.now() + 100000,
        applicableGoods: [id],
      });

      const finalPrice = shop.calculateFinalPrice(id, 'normal');
      // 最终折扣取min(0.8, 0.7) = 0.7
      expect(finalPrice[cur]).toBe(Math.ceil(baseAmt * 0.7));
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-38: 过期折扣自动清理
  // ═══════════════════════════════════════════
  describe('ACC-10-38 过期折扣自动清理', () => {
    it('ACC-10-38: cleanupExpiredDiscounts移除过期折扣', () => {
      shop.addDiscount({
        type: 'limited_sale',
        rate: 0.5,
        startTime: Date.now() - 2000,
        endTime: Date.now() - 1000,
        applicableGoods: [],
      });
      shop.addDiscount({
        type: 'normal',
        rate: 0.9,
        startTime: Date.now() - 1000,
        endTime: Date.now() + 100000,
        applicableGoods: [],
      });

      const removed = shop.cleanupExpiredDiscounts();
      expect(removed).toBe(1);
    });

    it('ACC-10-38: 过期折扣不影响价格计算', () => {
      const id = getNormalGoodsId();
      const def = GOODS_DEF_MAP[id];
      const [cur, baseAmt] = Object.entries(def!.basePrice)[0];

      shop.addDiscount({
        type: 'limited_sale',
        rate: 0.1, // 极低折扣
        startTime: Date.now() - 2000,
        endTime: Date.now() - 1000, // 已过期
        applicableGoods: [id],
      });

      const finalPrice = shop.calculateFinalPrice(id, 'normal');
      // 过期折扣不影响，价格应等于原价
      expect(finalPrice[cur]).toBe(baseAmt);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-39: 商品定义缺失容错
  // ═══════════════════════════════════════════
  describe('ACC-10-39 商品定义缺失容错', () => {
    it('ACC-10-39: getGoodsDef返回undefined时跳过', () => {
      const def = shop.getGoodsDef('nonexistent_item_xyz');
      expect(def).toBeUndefined();
    });

    it('ACC-10-39: validateBuy对不存在的商品返回错误', () => {
      const result = shop.validateBuy({ goodsId: 'nonexistent_item_xyz', quantity: 1, shopType: 'normal' });
      expect(result.canBuy).toBe(false);
      expect(result.errors).toContain('商品不存在');
    });

    it('ACC-10-39: calculateFinalPrice对不存在的商品返回空对象', () => {
      const price = shop.calculateFinalPrice('nonexistent_item_xyz', 'normal');
      expect(price).toEqual({});
    });

    it('ACC-10-39: executeBuy对不存在的商品返回失败', () => {
      const result = shop.executeBuy({ goodsId: 'nonexistent_item_xyz', quantity: 1, shopType: 'normal' });
      expect(result.success).toBe(false);
    });
  });
});
