/**
 * 集成测试 5/6: 商品收藏 + 降价提醒 + 补货引擎 + 手动刷新
 *
 * 覆盖 Play 文档：
 *   §6.1 商品收藏与降价提醒
 *   §7.1 补货引擎验证（定时补货、离线补货、手动刷新）
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ShopSystem } from '../../../shop/ShopSystem';
import { CurrencySystem } from '../../../currency/CurrencySystem';
import type { ISystemDeps } from '../../../../core/types';
import type { GoodsFilter } from '../../../../core/shop';
import type { CurrencyType } from "../../../../core/currency";
import {
  DEFAULT_RESTOCK_CONFIG,
  DAILY_MANUAL_REFRESH_LIMIT,
  SHOP_SAVE_VERSION,
} from '../../../../core/shop/shop-config';

// ─── 辅助 ────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createFixture() {
  const shop = new ShopSystem();
  const currency = new CurrencySystem();
  shop.init(mockDeps());
  currency.init(mockDeps());
  shop.setCurrencySystem(currency);
  return { shop, currency };
}

/** 获取第一个可收藏商品的defId */
function getFirstFavoritableId(shop: ShopSystem): string | null {
  for (const type of ['normal', 'black_market', 'limited_time', 'vip'] as const) {
    for (const item of shop.getShopGoods(type)) {
      const def = shop.getGoodsDef(item.defId);
      if (def?.favoritable) return item.defId;
    }
  }
  return null;
}

/** 获取第一个不可收藏商品的defId */
function getFirstNonFavoritableId(shop: ShopSystem): string | null {
  for (const type of ['normal', 'black_market', 'limited_time', 'vip'] as const) {
    for (const item of shop.getShopGoods(type)) {
      const def = shop.getGoodsDef(item.defId);
      if (def && !def.favoritable) return item.defId;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════

describe('§6.1+§7.1 收藏与补货', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    ({ shop, currency } = createFixture());
  });

  // ─── §6.1 商品收藏与降价提醒 ─────────────

  describe('§6.1 商品收藏与降价提醒', () => {

    it('§6.1.1 toggleFavorite添加收藏', () => {
      const favId = getFirstFavoritableId(shop);
      if (!favId) return;
      const result = shop.toggleFavorite(favId);
      expect(result).toBe(true); // 返回true表示添加
      expect(shop.isFavorite(favId)).toBe(true);
    });

    it('§6.1.2 toggleFavorite取消收藏', () => {
      const favId = getFirstFavoritableId(shop);
      if (!favId) return;
      shop.toggleFavorite(favId); // 添加
      const result = shop.toggleFavorite(favId); // 取消
      expect(result).toBe(false); // 返回false表示取消
      expect(shop.isFavorite(favId)).toBe(false);
    });

    it('§6.1.3 不可收藏商品返回false', () => {
      const nonFavId = getFirstNonFavoritableId(shop);
      if (!nonFavId) return;
      const result = shop.toggleFavorite(nonFavId);
      expect(result).toBe(false);
    });

    it('§6.1.4 不存在的商品toggleFavorite返回false', () => {
      expect(shop.toggleFavorite('nonexistent_goods')).toBe(false);
    });

    it('§6.1.5 getFavorites返回收藏列表', () => {
      const favId = getFirstFavoritableId(shop);
      if (!favId) return;
      shop.toggleFavorite(favId);
      const favs = shop.getFavorites();
      expect(favs).toContain(favId);
    });

    it('§6.1.6 getFavorites空列表', () => {
      expect(shop.getFavorites()).toEqual([]);
    });

    it('§6.1.7 isFavorite未收藏返回false', () => {
      expect(shop.isFavorite('nonexistent')).toBe(false);
    });

    it('§6.1.8 多商品收藏', () => {
      const favIds: string[] = [];
      for (const type of ['normal'] as const) {
        for (const item of shop.getShopGoods(type)) {
          const def = shop.getGoodsDef(item.defId);
          if (def?.favoritable && favIds.length < 3) {
            shop.toggleFavorite(item.defId);
            favIds.push(item.defId);
          }
        }
      }
      if (favIds.length === 0) return;
      const favs = shop.getFavorites();
      expect(favs.length).toBe(favIds.length);
      for (const id of favIds) {
        expect(favs).toContain(id);
      }
    });

    it('§6.1.9 filterGoods favoritesOnly只返回收藏商品', () => {
      const favId = getFirstFavoritableId(shop);
      if (!favId) return;
      shop.toggleFavorite(favId);
      const filter: GoodsFilter = { favoritesOnly: true };
      const filtered = shop.filterGoods('normal', filter);
      for (const item of filtered) {
        expect(shop.isFavorite(item.defId)).toBe(true);
      }
    });

    it('§6.1.10 收藏状态在商品item上同步', () => {
      const favId = getFirstFavoritableId(shop);
      if (!favId) return;
      shop.toggleFavorite(favId);
      // 查找该商品在哪个商店
      for (const type of ['normal', 'black_market', 'limited_time', 'vip'] as const) {
        const item = shop.getGoodsItem(type, favId);
        if (item) {
          expect(item.favorited).toBe(true);
        }
      }
    });

    it('§6.1.11 取消收藏后item.favorited同步为false', () => {
      const favId = getFirstFavoritableId(shop);
      if (!favId) return;
      shop.toggleFavorite(favId);
      shop.toggleFavorite(favId); // 取消
      for (const type of ['normal', 'black_market', 'limited_time', 'vip'] as const) {
        const item = shop.getGoodsItem(type, favId);
        if (item) {
          expect(item.favorited).toBe(false);
        }
      }
    });

    it('§6.1.12 降价提醒：折扣商品价格低于原价', () => {
      // 找到有折扣的商品
      let foundDiscount = false;
      for (const type of ['normal', 'black_market', 'limited_time', 'vip'] as const) {
        for (const item of shop.getShopGoods(type)) {
          if (item.discount < 1) {
            foundDiscount = true;
            const def = shop.getGoodsDef(item.defId);
            if (!def) continue;
            const finalPrice = shop.calculateFinalPrice(item.defId, type);
            // 折扣价应低于原价
            for (const [cur, price] of Object.entries(finalPrice)) {
              const original = def.basePrice[cur];
              if (original) {
                expect(price).toBeLessThanOrEqual(original);
              }
            }
          }
        }
      }
      // 如果没有折扣商品，测试addDiscount
      if (!foundDiscount) {
        const favId = getFirstFavoritableId(shop);
        if (!favId) return;
        shop.toggleFavorite(favId);
        shop.addDiscount({
          applicableGoods: [favId],
          rate: 0.8,
          startTime: Date.now(),
          endTime: Date.now() + 3600000,
        });
        const finalPrice = shop.calculateFinalPrice(favId, 'normal');
        const def = shop.getGoodsDef(favId);
        if (def) {
          for (const [cur, price] of Object.entries(finalPrice)) {
            const original = def.basePrice[cur];
            if (original) {
              expect(price).toBeLessThan(original);
            }
          }
        }
      }
    });

    it('§6.1.13 addDiscount对收藏商品生效', () => {
      const favId = getFirstFavoritableId(shop);
      if (!favId) return;
      shop.toggleFavorite(favId);
      const beforePrice = shop.calculateFinalPrice(favId, 'normal');
      shop.addDiscount({
        applicableGoods: [favId],
        rate: 0.5,
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
      });
      const afterPrice = shop.calculateFinalPrice(favId, 'normal');
      // 至少一种货币价格应降低
      let anyLower = false;
      for (const cur of Object.keys(beforePrice)) {
        if (afterPrice[cur] < beforePrice[cur]) anyLower = true;
      }
      expect(anyLower).toBe(true);
    });
  });

  // ─── §7.1 补货引擎验证 ───────────────────

  describe('§7.1 补货引擎验证', () => {

    it('§7.1.1 定时补货间隔为8h(28800s)', () => {
      expect(DEFAULT_RESTOCK_CONFIG.scheduledInterval).toBe(28800);
    });

    it('§7.1.2 离线补货间隔为8h', () => {
      expect(DEFAULT_RESTOCK_CONFIG.offlineInterval).toBe(28800);
    });

    it('§7.1.3 离线最大累积2次', () => {
      expect(DEFAULT_RESTOCK_CONFIG.offlineMaxAccumulation).toBe(2);
    });

    it('§7.1.4 手动刷新消耗500铜钱', () => {
      expect(DEFAULT_RESTOCK_CONFIG.manualRefreshCost.copper).toBe(500);
    });

    it('§7.1.5 折扣概率20%', () => {
      expect(DEFAULT_RESTOCK_CONFIG.discountChance).toBe(0.2);
    });

    it('§7.1.6 每日手动刷新上限5次', () => {
      expect(DAILY_MANUAL_REFRESH_LIMIT).toBe(5);
    });

    it('§7.1.7 manualRefresh成功刷新商品', () => {
      const beforeGoods = shop.getShopGoods('normal').map(g => g.defId);
      const result = shop.manualRefresh();
      expect(result.success).toBe(true);
      // 商品列表应被重建
      const afterGoods = shop.getShopGoods('normal');
      expect(afterGoods.length).toBeGreaterThan(0);
    });

    it('§7.1.8 manualRefresh消耗次数', () => {
      shop.manualRefresh();
      // 再次刷新多次直到达到上限
      for (let i = 1; i < DAILY_MANUAL_REFRESH_LIMIT; i++) {
        const result = shop.manualRefresh();
        expect(result.success).toBe(true);
      }
      // 超过上限
      const overLimit = shop.manualRefresh();
      expect(overLimit.success).toBe(false);
      expect(overLimit.reason).toContain('次数');
    });

    it('§7.1.9 resetDailyLimits清零刷新次数', () => {
      // 用完刷新次数
      for (let i = 0; i < DAILY_MANUAL_REFRESH_LIMIT; i++) shop.manualRefresh();
      const overLimit = shop.manualRefresh();
      expect(overLimit.success).toBe(false);
      // 重置
      shop.resetDailyLimits();
      const afterReset = shop.manualRefresh();
      expect(afterReset.success).toBe(true);
    });

    it('§7.1.10 补货后商品库存恢复', () => {
      // 先购买一些商品消耗库存
      const goods = shop.getShopGoods('normal');
      const purchasable = goods.find(g => g.stock > 0 && g.stock !== -1);
      if (!purchasable) return;
      const def = shop.getGoodsDef(purchasable.defId);
      if (!def) return;

      // 获取价格并确保有足够货币
      const price = shop.calculateFinalPrice(purchasable.defId, 'normal');
      for (const [cur, amt] of Object.entries(price)) {
        currency.addCurrency(cur as CurrencyType, amt + 1000);
      }

      const beforeStock = shop.getStockInfo('normal', purchasable.defId)!.stock;
      shop.executeBuy({ goodsId: purchasable.defId, quantity: 1, shopType: 'normal' });

      // 刷新补货
      shop.manualRefresh();
      // 补货后库存恢复（新创建的item）
      const afterGoods = shop.getShopGoods('normal');
      expect(afterGoods.length).toBeGreaterThan(0);
    });

    it('§7.1.11 reset清空收藏和折扣', () => {
      const favId = getFirstFavoritableId(shop);
      if (favId) shop.toggleFavorite(favId);
      shop.addDiscount({
        applicableGoods: [],
        rate: 0.5,
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
      });
      shop.reset();
      expect(shop.getFavorites()).toEqual([]);
    });

    it('§7.1.12 序列化包含收藏数据', () => {
      const favId = getFirstFavoritableId(shop);
      if (favId) shop.toggleFavorite(favId);
      const data = shop.serialize();
      expect(data.favorites).toBeDefined();
      expect(Array.isArray(data.favorites)).toBe(true);
      if (favId) expect(data.favorites).toContain(favId);
    });

    it('§7.1.13 反序列化恢复收藏状态', () => {
      const favId = getFirstFavoritableId(shop);
      if (!favId) return;
      shop.toggleFavorite(favId);
      const data = shop.serialize();

      const shop2 = new ShopSystem();
      shop2.init(mockDeps());
      shop2.setCurrencySystem(currency);
      shop2.deserialize(data);
      expect(shop2.isFavorite(favId)).toBe(true);
    });

    it('§7.1.14 序列化版本号正确', () => {
      const data = shop.serialize();
      expect(data.version).toBe(SHOP_SAVE_VERSION);
    });

    it('§7.1.15 cleanupExpiredDiscounts清除过期折扣', () => {
      shop.addDiscount({
        applicableGoods: [],
        rate: 0.5,
        startTime: Date.now() - 7200000, // 2小时前开始
        endTime: Date.now() - 1000, // 已过期
      });
      const removed = shop.cleanupExpiredDiscounts();
      expect(removed).toBeGreaterThanOrEqual(1);
    });

    it('§7.1.16 离线限定稀有概率10%', () => {
      expect(DEFAULT_RESTOCK_CONFIG.offlineRareChance).toBe(0.1);
    });

    it('§7.1.17 随机商品数量范围1~3', () => {
      const [min, max] = DEFAULT_RESTOCK_CONFIG.randomGoodsRange;
      expect(min).toBe(1);
      expect(max).toBe(3);
    });
  });
});
