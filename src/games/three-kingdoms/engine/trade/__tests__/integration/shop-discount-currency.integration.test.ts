/**
 * §1.5~1.8 折扣机制 / 货币体系 — 集成测试
 *
 * ShopSystem 折扣 + CurrencySystem 货币联动
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ShopSystem } from '../../../shop/ShopSystem';
import { CurrencySystem } from '../../../currency/CurrencySystem';
import type { ISystemDeps } from '../../../../core/types';
import type { DiscountConfig } from '../../../../core/shop/shop.types';

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

function makeDiscount(rate: number, goods: string[] = [], duration = 3600000): DiscountConfig {
  const now = Date.now();
  return { type: 'normal', rate, startTime: now, endTime: now + duration, applicableGoods: goods };
}

// ═══════════════════════════════════════════════

describe('§1.5~1.8 折扣机制 / 货币体系', () => {
  let shop: ShopSystem;
  let currency: CurrencySystem;

  beforeEach(() => {
    ({ shop, currency } = createFixture());
  });

  // ─── §1.5 折扣机制 ────────────────────────

  describe('§1.5 折扣机制', () => {
    it('discount 类型商品自带折扣', () => {
      const item = shop.getGoodsItem('limited_time', 'spd_daily_pack');
      expect(item).toBeDefined();
      expect(item!.discount).toBeLessThan(1);
    });

    it('addDiscount 对全量商品生效', () => {
      const before = shop.calculateFinalPrice('res_grain_small', 'normal');
      shop.addDiscount(makeDiscount(0.5));
      const after = shop.calculateFinalPrice('res_grain_small', 'normal');
      const beforePrice = Object.values(before)[0] ?? 0;
      const afterPrice = Object.values(after)[0] ?? 0;
      expect(afterPrice).toBeLessThanOrEqual(beforePrice);
    });

    it('addDiscount 仅对指定商品生效', () => {
      shop.addDiscount(makeDiscount(0.5, ['res_grain_small']));
      const discounted = shop.calculateFinalPrice('res_grain_small', 'normal');
      const undiscounted = shop.calculateFinalPrice('res_grain_large', 'normal');
      expect(Object.values(discounted)[0] ?? 0).toBeLessThan(200);
      expect(Object.values(undiscounted)[0] ?? 0).toBe(800);
    });

    it('过期折扣不影响价格', () => {
      const expired: DiscountConfig = {
        type: 'normal', rate: 0.1,
        startTime: Date.now() - 7200000, endTime: Date.now() - 3600000,
        applicableGoods: [],
      };
      shop.addDiscount(expired);
      const price = shop.calculateFinalPrice('res_grain_small', 'normal');
      expect(Object.values(price)[0] ?? 0).toBe(200);
    });

    it('cleanupExpiredDiscounts 清除过期折扣', () => {
      shop.addDiscount({ type: 'normal', rate: 0.5, startTime: 0, endTime: 1, applicableGoods: [] });
      shop.addDiscount(makeDiscount(0.8));
      const removed = shop.cleanupExpiredDiscounts();
      expect(removed).toBe(1);
    });

    it('NPC 好感度折扣叠加', () => {
      shop.setNPCDiscountProvider(() => 0.9);
      const price = shop.calculateFinalPrice('res_grain_small', 'normal', 'npc-01');
      expect(Object.values(price)[0] ?? 0).toBeLessThanOrEqual(180);
    });

    it('多重折扣取最低价', () => {
      shop.addDiscount(makeDiscount(0.7));
      shop.setNPCDiscountProvider(() => 0.6);
      const price = shop.calculateFinalPrice('res_grain_small', 'normal', 'npc-01');
      expect(Object.values(price)[0] ?? 0).toBeLessThanOrEqual(120);
    });
  });

  // ─── §1.6 货币体系基础 ────────────────────

  describe('§1.6 货币体系基础', () => {
    it('初始钱包铜钱为 1000', () => {
      expect(currency.getBalance('copper')).toBe(1000);
    });

    it('addCurrency 增加余额', () => {
      currency.addCurrency('mandate', 50);
      expect(currency.getBalance('mandate')).toBe(50);
    });

    it('spendCurrency 消耗余额', () => {
      currency.spendCurrency('copper', 300);
      expect(currency.getBalance('copper')).toBe(700);
    });

    it('余额不足时 spendCurrency 抛出异常', () => {
      expect(() => currency.spendCurrency('copper', 9999)).toThrow();
    });

    it('hasEnough 正确判断', () => {
      expect(currency.hasEnough('copper', 500)).toBe(true);
      expect(currency.hasEnough('copper', 9999)).toBe(false);
    });

    it('付费货币识别', () => {
      expect(currency.isPaidCurrency('ingot')).toBe(true);
      expect(currency.isPaidCurrency('copper')).toBe(false);
    });

    it('货币上限约束', () => {
      currency.addCurrency('summon', 200);
      expect(currency.getBalance('summon')).toBeLessThanOrEqual(99);
    });

    it('setCurrency 恢复存档余额', () => {
      currency.setCurrency('copper', 5000);
      expect(currency.getBalance('copper')).toBe(5000);
    });
  });

  // ─── §1.7 货币不足提示 ────────────────────

  describe('§1.7 货币不足提示', () => {
    it('getShortage 返回正确缺口', () => {
      const s = currency.getShortage('copper', 5000);
      expect(s.gap).toBe(4000);
      expect(s.required).toBe(5000);
      expect(s.acquireHints.length).toBeGreaterThan(0);
    });

    it('checkAffordability 批量检测', () => {
      const result = currency.checkAffordability({ copper: 500 });
      expect(result.canAfford).toBe(true);
      expect(result.shortages).toHaveLength(0);
    });

    it('checkAffordability 检测到不足', () => {
      const result = currency.checkAffordability({ copper: 9999, mandate: 10 });
      expect(result.canAfford).toBe(false);
      expect(result.shortages.length).toBeGreaterThan(0);
    });

    it('购买时货币不足产生错误提示', () => {
      const v = shop.validateBuy({ goodsId: 'spd_vip_pack', quantity: 1, shopType: 'vip' });
      expect(v.canBuy).toBe(false);
      expect(v.errors.some(e => e.includes('不足'))).toBe(true);
    });

    it('购买成功后余额正确扣除', () => {
      const before = currency.getBalance('copper');
      shop.executeBuy({ goodsId: 'res_grain_small', quantity: 1, shopType: 'normal' });
      expect(currency.getBalance('copper')).toBeLessThan(before);
    });
  });

  // ─── §1.8 消耗优先级与汇率 ────────────────

  describe('§1.8 消耗优先级与汇率', () => {
    it('集市优先消耗铜钱', () => {
      const priority = currency.getSpendPriority('normal');
      expect(priority[0]).toBe('copper');
    });

    it('黑市优先消耗声望', () => {
      const priority = currency.getSpendPriority('black_market');
      expect(priority[0]).toBe('reputation');
    });

    it('VIP 商店优先消耗元宝', () => {
      const priority = currency.getSpendPriority('vip');
      expect(priority[0]).toBe('ingot');
    });

    it('汇率查询铜钱->铜钱为 1', () => {
      expect(currency.getExchangeRate('copper', 'copper')).toBe(1);
    });

    it('汇率查询天命->铜钱为 100', () => {
      expect(currency.getExchangeRate('mandate', 'copper')).toBe(100);
    });

    it('exchange 执行汇率转换', () => {
      currency.addCurrency('mandate', 10);
      const result = currency.exchange({ from: 'mandate', to: 'copper', amount: 5 });
      expect(result.success).toBe(true);
      expect(result.spent).toBe(5);
      expect(result.received).toBe(500);
      expect(currency.getBalance('mandate')).toBe(5);
    });

    it('exchange 余额不足返回失败', () => {
      const result = currency.exchange({ from: 'mandate', to: 'copper', amount: 10 });
      expect(result.success).toBe(false);
    });

    it('spendByPriority 按优先级扣除', () => {
      currency.addCurrency('mandate', 100);
      const result = currency.spendByPriority('normal', { copper: 500 });
      expect(result.copper).toBe(500);
      expect(currency.getBalance('copper')).toBe(500);
    });

    it('序列化/反序列化保持一致', () => {
      currency.addCurrency('mandate', 50);
      const data = currency.serialize();
      const cs2 = new CurrencySystem();
      cs2.init(mockDeps());
      cs2.deserialize(data);
      expect(cs2.getBalance('mandate')).toBe(50);
      expect(cs2.getBalance('copper')).toBe(1000);
    });
  });
});
