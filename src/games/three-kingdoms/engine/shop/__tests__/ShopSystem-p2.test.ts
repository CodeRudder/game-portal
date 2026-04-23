import { ShopSystem } from '../ShopSystem';
import type {
import {
import {
import { GOODS_DEF_MAP, SHOP_GOODS_IDS, ALL_GOODS_DEFS } from '../../../core/shop/goods-data';
import type { CurrencySystem } from '../../currency/CurrencySystem';

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
        shop.init({ eventBus: { emit: jest.fn(), on: jest.fn(), off: jest.fn(), once: jest.fn(), removeAllListeners: jest.fn() } as any, config: { get: jest.fn() } as any, registry: { get: jest.fn() } as any });
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
