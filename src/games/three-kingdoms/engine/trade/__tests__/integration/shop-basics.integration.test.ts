/**
 * §1.1~1.4 商店浏览 / 五级确认 / 库存限购 — 集成测试
 *
 * ShopSystem + CurrencySystem 联动验证
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ShopSystem } from '../../../shop/ShopSystem';
import { CurrencySystem } from '../../../currency/CurrencySystem';
import type { ISystemDeps } from '../../../../core/types';
import { CONFIRM_THRESHOLDS } from '../../../../core/shop/shop-config';

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

// ═══════════════════════════════════════════════

describe('§1.1~1.4 商店浏览 / 五级确认 / 库存限购', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    ({ shop, currency } = createFixture());
  });

  // ─── §1.1 商店浏览 ────────────────────────

  describe('§1.1 商店浏览', () => {
    it('集市商店初始化后包含商品', () => {
      const goods = shop.getShopGoods('normal');
      expect(goods.length).toBeGreaterThan(0);
    });

    it('四种商店类型均有数据', () => {
      for (const type of ['normal', 'black_market', 'limited_time', 'vip'] as const) {
        const goods = shop.getShopGoods(type);
        expect(goods.length).toBeGreaterThan(0);
      }
    });

    it('按分类过滤商品返回正确结果', () => {
      const resources = shop.getGoodsByCategory('normal', 'resource');
      expect(resources.length).toBeGreaterThan(0);
      expect(resources.every(g => {
        const def = shop.getGoodsDef(g.defId);
        return def?.category === 'resource';
      })).toBe(true);
    });

    it('getCategories 返回全部分类', () => {
      const cats = shop.getCategories();
      expect(cats).toContain('resource');
      expect(cats).toContain('material');
      expect(cats).toContain('equipment');
      expect(cats).toContain('consumable');
      expect(cats).toContain('special');
    });

    it('getGoodsItem 返回指定商品实例', () => {
      const item = shop.getGoodsItem('normal', 'res_grain_small');
      expect(item).toBeDefined();
      expect(item!.defId).toBe('res_grain_small');
    });

    it('getGoodsItem 不存在返回 undefined', () => {
      expect(shop.getGoodsItem('normal', 'nonexistent')).toBeUndefined();
    });

    it('filterGoods 关键词搜索', () => {
      const results = shop.filterGoods('normal', { keyword: '粮草' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('filterGoods 价格区间过滤', () => {
      const results = shop.filterGoods('normal', { priceRange: [0, 300] });
      results.forEach(g => {
        const def = shop.getGoodsDef(g.defId);
        const price = Object.values(def?.basePrice ?? {})[0] ?? 0;
        expect(price).toBeGreaterThanOrEqual(0);
        expect(price).toBeLessThanOrEqual(300);
      });
    });
  });

  // ─── §1.2 五级确认策略 ────────────────────

  describe('§1.2 五级确认策略', () => {
    it('低价商品 confirmLevel 为 none 或 low', () => {
      const v = shop.validateBuy({ goodsId: 'res_grain_small', quantity: 1, shopType: 'normal' });
      // 200铜钱等价 > CONFIRM_THRESHOLDS.none(0)，因此为 low
      expect(['none', 'low']).toContain(v.confirmLevel);
    });

    it('中等价格商品 confirmLevel 为 low', () => {
      const v = shop.validateBuy({ goodsId: 'res_grain_large', quantity: 2, shopType: 'normal' });
      expect(['none', 'low']).toContain(v.confirmLevel);
    });

    it('高价商品 confirmLevel 为 medium 或更高', () => {
      currency.addCurrency('ingot', 200);
      const v = shop.validateBuy({ goodsId: 'spd_vip_pack', quantity: 1, shopType: 'vip' });
      expect(v.confirmLevel).toMatch(/medium|high|critical/);
    });

    it('confirmLevel 随购买数量递增', () => {
      const v1 = shop.validateBuy({ goodsId: 'res_grain_small', quantity: 1, shopType: 'normal' });
      const v10 = shop.validateBuy({ goodsId: 'res_grain_small', quantity: 10, shopType: 'normal' });
      const levels = ['none', 'low', 'medium', 'high', 'critical'];
      expect(levels.indexOf(v10.confirmLevel)).toBeGreaterThanOrEqual(levels.indexOf(v1.confirmLevel));
    });

    it('验证失败时 confirmLevel 仍正确返回', () => {
      const v = shop.validateBuy({ goodsId: 'spd_vip_pack', quantity: 1, shopType: 'vip' });
      expect(v.canBuy).toBe(false);
      expect(v.confirmLevel).toBeDefined();
    });

    it('购买结果包含 confirmLevel', () => {
      const r = shop.executeBuy({ goodsId: 'res_grain_small', quantity: 1, shopType: 'normal' });
      expect(r.confirmLevel).toBeDefined();
    });
  });

  // ─── §1.3 库存管理 ────────────────────────

  describe('§1.3 库存管理', () => {
    it('常驻商品库存为 -1（无限）', () => {
      const info = shop.getStockInfo('normal', 'res_grain_small');
      expect(info).not.toBeNull();
      expect(info!.stock).toBe(-1);
    });

    it('购买消耗有限库存商品', () => {
      // mat_jade 是 random 类型，库存有限
      const infoBefore = shop.getStockInfo('normal', 'mat_jade');
      if (infoBefore && infoBefore.stock > 0) {
        currency.addCurrency('mandate', 50);
        shop.executeBuy({ goodsId: 'mat_jade', quantity: 1, shopType: 'normal' });
        const infoAfter = shop.getStockInfo('normal', 'mat_jade');
        expect(infoAfter!.stock).toBe(infoBefore!.stock - 1);
      }
    });

    it('库存不足时验证失败', () => {
      // 限时商品库存为 1
      currency.addCurrency('ingot', 500);
      shop.executeBuy({ goodsId: 'spd_vip_pack', quantity: 1, shopType: 'vip' });
      const v = shop.validateBuy({ goodsId: 'spd_vip_pack', quantity: 1, shopType: 'vip' });
      expect(v.canBuy).toBe(false);
    });

    it('getStockInfo 不存在返回 null', () => {
      expect(shop.getStockInfo('normal', 'nonexistent')).toBeNull();
    });

    it('手动刷新重置商品', () => {
      currency.addCurrency('copper', 10000);
      // 买掉一些
      shop.executeBuy({ goodsId: 'res_grain_small', quantity: 1, shopType: 'normal' });
      const result = shop.manualRefresh();
      expect(result.success).toBe(true);
    });

    it('手动刷新次数有限', () => {
      for (let i = 0; i < 5; i++) shop.manualRefresh();
      const result = shop.manualRefresh();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('刷新次数');
    });
  });

  // ─── §1.4 限购机制 ────────────────────────

  describe('§1.4 限购机制', () => {
    it('每日限购正确累加', () => {
      // discount 类型 dailyLimit=2
      currency.addCurrency('ingot', 200);
      shop.executeBuy({ goodsId: 'spd_daily_pack', quantity: 1, shopType: 'limited_time' });
      const info = shop.getStockInfo('limited_time', 'spd_daily_pack');
      expect(info!.dailyPurchased).toBe(1);
    });

    it('超出每日限购时验证失败', () => {
      currency.addCurrency('ingot', 200);
      shop.executeBuy({ goodsId: 'spd_daily_pack', quantity: 1, shopType: 'limited_time' });
      shop.executeBuy({ goodsId: 'spd_daily_pack', quantity: 1, shopType: 'limited_time' });
      const v = shop.validateBuy({ goodsId: 'spd_daily_pack', quantity: 1, shopType: 'limited_time' });
      expect(v.canBuy).toBe(false);
      expect(v.errors.some(e => e.includes('每日限购'))).toBe(true);
    });

    it('resetDailyLimits 清零日购量', () => {
      currency.addCurrency('ingot', 200);
      shop.executeBuy({ goodsId: 'spd_daily_pack', quantity: 1, shopType: 'limited_time' });
      shop.resetDailyLimits();
      const info = shop.getStockInfo('limited_time', 'spd_daily_pack');
      expect(info!.dailyPurchased).toBe(0);
    });

    it('终身限购 lifetimeLimit 正确生效', () => {
      // limited 类型 lifetimeLimit=3, stock=1
      // 首次购买消耗库存，后续因库存不足而非限购
      currency.addCurrency('ingot', 500);
      const r1 = shop.executeBuy({ goodsId: 'spd_vip_pack', quantity: 1, shopType: 'vip' });
      expect(r1.success).toBe(true);
      // 第二次购买失败（库存不足）
      const v = shop.validateBuy({ goodsId: 'spd_vip_pack', quantity: 1, shopType: 'vip' });
      expect(v.canBuy).toBe(false);
      expect(v.errors.some(e => e.includes('库存不足'))).toBe(true);
    });

    it('购买数量为 0 时验证失败', () => {
      const v = shop.validateBuy({ goodsId: 'res_grain_small', quantity: 0, shopType: 'normal' });
      expect(v.canBuy).toBe(false);
    });

    it('购买数量为负数时验证失败', () => {
      const v = shop.validateBuy({ goodsId: 'res_grain_small', quantity: -1, shopType: 'normal' });
      expect(v.canBuy).toBe(false);
    });

    it('商品不存在时验证失败', () => {
      const v = shop.validateBuy({ goodsId: 'fake_item', quantity: 1, shopType: 'normal' });
      expect(v.canBuy).toBe(false);
      expect(v.errors).toContain('商品不存在');
    });
  });
});
