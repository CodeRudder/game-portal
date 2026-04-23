/**
 * ShopSystem 单元测试 (p2)
 *
 * 覆盖：
 * - NPC折扣覆盖
 * - 购买逻辑（验证 + 执行）
 * - 库存与限购
 */

import { ShopSystem } from '../ShopSystem';
import type { BuyRequest } from '../../../core/shop/shop.types';
import type { ISystemDeps } from '../../../core/types/subsystem';
import { SHOP_TYPES } from '../../../core/shop/shop.types';
import {
  DAILY_MANUAL_REFRESH_LIMIT,
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
  // 3b. NPC折扣覆盖
  // ═══════════════════════════════════════════
  describe('定价与折扣（续）', () => {
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
      for (let i = 0; i < DAILY_MANUAL_REFRESH_LIMIT; i++) {
        shop.manualRefresh();
      }
      const result = shop.manualRefresh();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('刷新次数');
    });

    it('库存不足时 validateBuy 失败', () => {
      const bmIds = SHOP_GOODS_IDS['black_market'];
      if (bmIds.length > 0) {
        const id = bmIds[0];
        const item = shop.getGoodsItem('black_market', id);
        if (item && item.stock > 0 && item.stock !== -1) {
          const req: BuyRequest = { goodsId: id, quantity: item.stock + 100, shopType: 'black_market' };
          const result = shop.validateBuy(req);
          expect(result.canBuy).toBe(false);
          expect(result.errors.some(e => e.includes('库存不足'))).toBe(true);
        }
      }
    });
  });

});
