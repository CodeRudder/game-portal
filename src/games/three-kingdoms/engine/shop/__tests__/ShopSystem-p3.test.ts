/**
 * ShopSystem 单元测试 (p3)
 *
 * 覆盖：
 * - 收藏管理
 * - 补货机制
 * - 商店等级
 * - 序列化/反序列化
 * - ISubsystem 接口
 * - 确认等级阈值
 */

import { ShopSystem } from '../ShopSystem';
import type {
  ShopSaveData,
} from '../../../core/shop/shop.types';
import type { ISystemDeps } from '../../../core/types/subsystem';
import { SHOP_TYPES } from '../../../core/shop/shop.types';
import {
  SHOP_SAVE_VERSION,
  CONFIRM_THRESHOLDS,
} from '../../../core/shop/shop-config';
import { SHOP_GOODS_IDS, ALL_GOODS_DEFS } from '../../../core/shop/goods-data';
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
    vi.restoreAllMocks();
    shop = createShop();
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
        shops: {} as ShopSaveData['shops'],
        favorites: [],
        version: 999,
      };
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
        shop.init({
          eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as unknown as ISystemDeps['eventBus'],
          config: { get: vi.fn() } as unknown as ISystemDeps['config'],
          registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
        });
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
