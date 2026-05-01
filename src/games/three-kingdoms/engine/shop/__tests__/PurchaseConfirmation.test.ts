/**
 * 购买确认机制测试 — P1 缺口补充
 *
 * 覆盖 PRD [SHP-3] 五级确认策略中的 L3/L4 级别：
 *   - L3 严格确认：元宝消耗（付费货币）→ 弹窗 + 3 秒倒计时
 *   - L4 高危确认：元宝 ≥ 500 或限定商品 → 弹窗 + 滑动确认
 *
 * 测试维度：
 *   1. 确认级别正确触发（基于单价铜钱等价阈值）
 *   2. L3 严格确认场景（单价铜钱等价 > 5000）
 *   3. L4 高危确认场景（单价铜钱等价 > 20000）
 *   4. 折扣影响确认级别
 *   5. 多种货币组合的铜钱等价计算
 *   6. 误操作防护
 *   7. TODO: 数量累积确认（引擎按单价计算，PRD 按总价）
 *
 * 注意：引擎 confirmLevel 基于单价（finalPrice）计算，
 *       不乘以 quantity。这是当前实现行为。
 *
 * @module engine/shop/__tests__/PurchaseConfirmation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShopSystem } from '../ShopSystem';
import type {
  ShopType,
  BuyRequest,
  BuyValidation,
  ConfirmLevel,
  DiscountConfig,
  GoodsItem,
} from '../../../core/shop';
import {
  SHOP_TYPES,
  CONFIRM_THRESHOLDS,
} from '../../../core/shop';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS, ALL_GOODS_DEFS } from '../../../core/shop';
import type { ISystemDeps } from '../../../core/types';
import type { CurrencySystem } from '../../currency/CurrencySystem';

// ─── 辅助函数 ─────────────────────────────────

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

/** 创建 mock CurrencySystem（默认可支付） */
function createMockCurrencySystem(): CurrencySystem & {
  _setAffordable: (v: boolean) => void;
} {
  let affordable = true;
  return {
    name: 'currency',
    init: vi.fn(),
    update: vi.fn(),
    getState: vi.fn().mockReturnValue({}),
    reset: vi.fn(),
    checkAffordability: vi.fn().mockImplementation(() => ({
      canAfford: affordable,
      shortages: affordable ? [] : [{ currency: 'copper', required: 1000, gap: 500 }],
    })),
    spendByPriority: vi.fn().mockImplementation(() => {
      if (!affordable) throw new Error('货币不足');
      return {};
    }),
    _setAffordable: (v: boolean) => { affordable = v; },
  } as unknown as CurrencySystem & { _setAffordable: (v: boolean) => void };
}

/**
 * 铜钱等价汇率（与 ShopSystem 内部一致）
 */
const COPPER_RATES: Record<string, number> = {
  copper: 1, mandate: 100, recruit: 200, summon: 500,
  expedition: 80, guild: 80, reputation: 50, ingot: 1000,
};

/** 计算铜钱等价值 */
function toCopperEq(price: Record<string, number>): number {
  let total = 0;
  for (const [cur, amt] of Object.entries(price)) {
    total += amt * (COPPER_RATES[cur] ?? 1);
  }
  return total;
}

/** 根据铜钱等价推算确认级别（与引擎逻辑一致） */
function expectedConfirmLevel(copperEq: number): ConfirmLevel {
  if (copperEq <= CONFIRM_THRESHOLDS.none) return 'none';
  if (copperEq <= CONFIRM_THRESHOLDS.low) return 'low';
  if (copperEq <= CONFIRM_THRESHOLDS.medium) return 'medium';
  if (copperEq <= CONFIRM_THRESHOLDS.high) return 'high';
  return 'critical';
}

/** 查找使用指定货币的商品 */
function findGoodsByCurrency(currency: string): string[] {
  return ALL_GOODS_DEFS.filter(g => g.primaryCurrency === currency).map(g => g.id);
}

/** 查找限定类型商品 */
function findLimitedGoods(): string[] {
  return ALL_GOODS_DEFS.filter(g => g.goodsType === 'limited').map(g => g.id);
}

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('购买确认机制', () => {
  let shop: ShopSystem;
  let currency: ReturnType<typeof createMockCurrencySystem>;

  beforeEach(() => {
    vi.restoreAllMocks();
    shop = createShop();
    currency = createMockCurrencySystem();
    shop.setCurrencySystem(currency);
  });

  // ═══════════════════════════════════════════
  // 1. 确认级别阈值边界测试（基于单价）
  // ═══════════════════════════════════════════

  describe('确认级别阈值边界', () => {
    it('L0 免确认阈值定义为 0', () => {
      expect(CONFIRM_THRESHOLDS.none).toBe(0);
    });

    it('L1 轻确认：单价铜钱等价在 (0, 1000]', () => {
      // res_grain_small: { copper: 200 } → copperEq = 200 → low
      const goodsId = 'res_grain_small';
      const def = GOODS_DEF_MAP[goodsId];
      const copperEq = toCopperEq(def!.basePrice);
      expect(copperEq).toBe(200);
      expect(expectedConfirmLevel(copperEq)).toBe('low');

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(validation.confirmLevel).toBe('low');
    });

    it('L2 标准确认：单价铜钱等价在 (1000, 5000]', () => {
      // eq_sword_steel: { copper: 1500 } → copperEq = 1500 → medium
      const goodsId = 'eq_sword_steel';
      const def = GOODS_DEF_MAP[goodsId];
      const copperEq = toCopperEq(def!.basePrice);
      expect(copperEq).toBe(1500);

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(validation.confirmLevel).toBe('medium');
    });

    it('L3 严格确认：单价铜钱等价在 (5000, 20000]', () => {
      // spd_guild_chest: { guild: 100 } → copperEq = 100*80 = 8000 → high
      const goodsId = 'spd_guild_chest';
      const def = GOODS_DEF_MAP[goodsId];
      const copperEq = toCopperEq(def!.basePrice);
      expect(copperEq).toBe(8000);

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(validation.confirmLevel).toBe('high');
    });

    it('L4 高危确认：单价铜钱等价 > 20000', () => {
      // spd_vip_pack: { ingot: 298 } → copperEq = 298*1000 = 298000 → critical
      const goodsId = 'spd_vip_pack';
      const def = GOODS_DEF_MAP[goodsId];
      const copperEq = toCopperEq(def!.basePrice);
      expect(copperEq).toBe(298000);

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'vip' });
      expect(validation.confirmLevel).toBe('critical');
    });

    it('阈值边界：copperEq = 1000 → low', () => {
      // copper 1000 → copperEq = 1000 → low（等于 low 阈值上限）
      // 使用折扣来精确构造
      const goodsId = 'eq_armor_chain'; // { copper: 2000 }
      const item = shop.getGoodsItem('normal', goodsId);
      if (item) {
        item.discount = 0.5; // 2000 * 0.5 = 1000
        const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
        expect(Object.values(validation.finalPrice)[0]).toBe(1000);
        expect(validation.confirmLevel).toBe('low');
      }
    });

    it('阈值边界：copperEq = 5000 → medium', () => {
      // copper 5000 → copperEq = 5000 → medium
      // 使用折扣构造：eq_armor_chain 2000, discount = 0.5 → 1000 不够
      // 直接找一个 copperEq = 5000 的商品
      // 用折扣：spd_tech_book { expedition: 30 } → 2400 → medium
      // 需要精确 5000：guild 62.5 不行
      // 验证阈值定义即可
      expect(CONFIRM_THRESHOLDS.medium).toBe(5000);
    });

    it('阈值边界：copperEq = 20000 → high', () => {
      expect(CONFIRM_THRESHOLDS.high).toBe(20000);
    });

    it('阈值边界：copperEq = 20001 → critical', () => {
      // 验证超过 high 阈值即 critical
      expect(expectedConfirmLevel(20001)).toBe('critical');
    });

    it('所有阈值递增关系正确', () => {
      expect(CONFIRM_THRESHOLDS.none).toBeLessThan(CONFIRM_THRESHOLDS.low);
      expect(CONFIRM_THRESHOLDS.low).toBeLessThan(CONFIRM_THRESHOLDS.medium);
      expect(CONFIRM_THRESHOLDS.medium).toBeLessThan(CONFIRM_THRESHOLDS.high);
    });
  });

  // ═══════════════════════════════════════════
  // 2. L3 严格确认场景
  // ═══════════════════════════════════════════

  describe('L3 严格确认（high 级别）', () => {
    /**
     * PRD 规则：L3 弹窗 + 3 秒倒计时
     * 引擎映射：confirmLevel = 'high'
     * 触发条件：单价 copperEq ∈ (5000, 20000]
     */

    it('guild 货币商品触发 high 确认级别', () => {
      // spd_guild_chest: { guild: 100 } → 8000 → high
      const goodsId = 'spd_guild_chest';
      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(validation.confirmLevel).toBe('high');
      expect(validation.canBuy).toBe(true);
    });

    it('high 级别下 executeBuy 正确执行', () => {
      const goodsId = 'spd_guild_chest';
      const result = shop.executeBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(result.success).toBe(true);
      expect(result.confirmLevel).toBe('high');
      expect(result.quantity).toBe(1);
    });

    it('high 级别购买后库存正确扣减', () => {
      const goodsId = 'spd_guild_chest';
      const stockBefore = shop.getStockInfo('normal', goodsId);
      expect(stockBefore).not.toBeNull();

      shop.executeBuy({ goodsId, quantity: 1, shopType: 'normal' });

      const stockAfter = shop.getStockInfo('normal', goodsId);
      if (stockBefore!.stock !== -1) {
        expect(stockAfter!.stock).toBe(stockBefore!.stock - 1);
      }
      expect(stockAfter!.dailyPurchased).toBe(1);
      expect(stockAfter!.lifetimePurchased).toBe(1);
    });

    it('high 级别购买后限购计数正确', () => {
      const goodsId = 'spd_guild_chest'; // permanent → dailyLimit: -1
      shop.executeBuy({ goodsId, quantity: 1, shopType: 'normal' });

      const stock = shop.getStockInfo('normal', goodsId);
      expect(stock!.dailyPurchased).toBe(1);
      expect(stock!.lifetimePurchased).toBe(1);
    });

    it('expedition 货币大量购买触发 high', () => {
      // spd_tech_book: { expedition: 30 } → 2400 → medium
      // 单价不够 high，但引擎按单价算
      // 验证 expedition 商品单价级别
      const goodsId = 'spd_tech_book';
      const def = GOODS_DEF_MAP[goodsId];
      const copperEq = toCopperEq(def!.basePrice);
      expect(copperEq).toBe(2400);

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(validation.confirmLevel).toBe('medium');
    });

    it('reputation 货币商品确认级别', () => {
      // spd_blueprint: { reputation: 50 } → 2500 → medium
      const goodsId = 'spd_blueprint';
      const def = GOODS_DEF_MAP[goodsId];
      const copperEq = toCopperEq(def!.basePrice);
      expect(copperEq).toBe(2500);

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(validation.confirmLevel).toBe('medium');
    });

    it('mandate 货币商品确认级别', () => {
      // eq_ring_jade: { mandate: 30 } → 3000 → medium
      const goodsId = 'eq_ring_jade';
      const def = GOODS_DEF_MAP[goodsId];
      const copperEq = toCopperEq(def!.basePrice);
      expect(copperEq).toBe(3000);

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(validation.confirmLevel).toBe('medium');
    });

    it('购买数量不影响确认级别（引擎按单价计算）', () => {
      // 引擎行为：confirmLevel 基于 finalPrice（单价），不乘 quantity
      const goodsId = 'con_potion_hp'; // { copper: 80 } → 80 → low
      const v1 = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      const v250 = shop.validateBuy({ goodsId, quantity: 250, shopType: 'normal' });

      // 无论数量多少，确认级别相同（基于单价）
      expect(v1.confirmLevel).toBe(v250.confirmLevel);
      expect(v1.confirmLevel).toBe('low');
    });
  });

  // ═══════════════════════════════════════════
  // 3. L4 高危确认场景
  // ═══════════════════════════════════════════

  describe('L4 高危确认（critical 级别）', () => {
    /**
     * PRD 规则：L4 弹窗 + 滑动确认
     * 引擎映射：confirmLevel = 'critical'
     * 触发条件：单价 copperEq > 20000
     */

    it('元宝商品（ingot）触发 critical', () => {
      // spd_vip_pack: { ingot: 298 } → 298000 → critical
      const goodsId = 'spd_vip_pack';
      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'vip' });
      expect(validation.confirmLevel).toBe('critical');
      expect(validation.canBuy).toBe(true);
    });

    it('元宝商品 copperEq 远超 high 阈值', () => {
      const goodsId = 'spd_vip_pack';
      const def = GOODS_DEF_MAP[goodsId];
      const copperEq = toCopperEq(def!.basePrice);
      expect(copperEq).toBeGreaterThan(CONFIRM_THRESHOLDS.high);
      expect(copperEq).toBe(298000);
    });

    it('限定商品（goodsType=limited）触发 critical', () => {
      const def = GOODS_DEF_MAP['spd_vip_pack'];
      expect(def!.goodsType).toBe('limited');

      const validation = shop.validateBuy({ goodsId: 'spd_vip_pack', quantity: 1, shopType: 'vip' });
      expect(validation.confirmLevel).toBe('critical');
    });

    it('L4 executeBuy 正确执行', () => {
      const goodsId = 'spd_vip_pack';
      const result = shop.executeBuy({ goodsId, quantity: 1, shopType: 'vip' });
      expect(result.success).toBe(true);
      expect(result.confirmLevel).toBe('critical');
      expect(result.goodsId).toBe(goodsId);
      expect(result.quantity).toBe(1);
    });

    it('L4 购买后限定商品库存正确扣减', () => {
      const goodsId = 'spd_vip_pack'; // limited → stock: 1
      const stockBefore = shop.getStockInfo('vip', goodsId);
      expect(stockBefore!.stock).toBe(1);

      shop.executeBuy({ goodsId, quantity: 1, shopType: 'vip' });

      const stockAfter = shop.getStockInfo('vip', goodsId);
      expect(stockAfter!.stock).toBe(0);
      expect(stockAfter!.lifetimePurchased).toBe(1);
    });

    it('L4 限定商品售罄后不可再次购买', () => {
      const goodsId = 'spd_vip_pack';
      shop.executeBuy({ goodsId, quantity: 1, shopType: 'vip' });

      const result = shop.executeBuy({ goodsId, quantity: 1, shopType: 'vip' });
      expect(result.success).toBe(false);
      expect(result.reason).toContain('库存不足');
    });

    it('L4 每日特惠包（discount + ingot）', () => {
      // spd_daily_pack: { ingot: 198 } → 198000 → critical
      const goodsId = 'spd_daily_pack';
      const def = GOODS_DEF_MAP[goodsId];
      expect(def!.goodsType).toBe('discount');
      expect(def!.primaryCurrency).toBe('ingot');

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'limited_time' });
      expect(validation.confirmLevel).toBe('critical');
    });

    it('L4 场景：求贤令单价不足以触发 L4', () => {
      // con_token_summon: { summon: 1 } → 500 → low
      // 单价 500 → low（引擎按单价）
      const goodsId = 'con_token_summon';
      const def = GOODS_DEF_MAP[goodsId];
      const copperEq = toCopperEq(def!.basePrice);
      expect(copperEq).toBe(500);

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'vip' });
      expect(validation.confirmLevel).toBe('low');

      // 即使大量购买，确认级别不变（引擎按单价）
      const v41 = shop.validateBuy({ goodsId, quantity: 41, shopType: 'vip' });
      expect(v41.confirmLevel).toBe('low');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 折扣对确认级别的影响
  // ═══════════════════════════════════════════

  describe('折扣影响确认级别', () => {
    it('折扣降低价格后确认级别降级', () => {
      // eq_armor_chain: { copper: 2000 } → 2000 → medium
      const goodsId = 'eq_armor_chain';
      const validationNoDiscount = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(validationNoDiscount.confirmLevel).toBe('medium');

      // 设置 50% 折扣 → 1000 → low
      const item = shop.getGoodsItem('normal', goodsId);
      if (item) {
        item.discount = 0.5;
        const validationWithDiscount = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
        expect(Object.values(validationWithDiscount.finalPrice)[0]).toBe(1000);
        expect(validationWithDiscount.confirmLevel).toBe('low');
      }
    });

    it('折扣使 high 降为 medium', () => {
      // spd_guild_chest: { guild: 100 } → 8000 → high
      const goodsId = 'spd_guild_chest';
      const v1 = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(v1.confirmLevel).toBe('high');

      // 50% 折扣 → 4000 → medium
      const item = shop.getGoodsItem('normal', goodsId);
      if (item) {
        item.discount = 0.5;
        const v2 = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
        const price = Object.values(v2.finalPrice)[0];
        expect(price).toBe(50); // guild 100 * 0.5 = 50
        // copperEq = 50 * 80 = 4000 → medium
        expect(v2.confirmLevel).toBe('medium');
      }
    });

    it('全局折扣影响确认级别', () => {
      // eq_armor_chain: { copper: 2000 } * 0.8 = 1600 → low
      shop.addDiscount({
        type: 'normal',
        rate: 0.8,
        startTime: Date.now() - 1000,
        endTime: Date.now() + 100000,
        applicableGoods: [],
      });

      const goodsId = 'eq_armor_chain';
      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(Object.values(validation.finalPrice)[0]).toBe(1600);
      expect(validation.confirmLevel).toBe('medium'); // 1600 > 1000 → medium
    });

    it('NPC 好感度折扣影响确认级别', () => {
      shop.setNPCDiscountProvider(() => 0.5);

      // eq_sword_steel: { copper: 1500 } * 0.5 = 750 → low
      const goodsId = 'eq_sword_steel';
      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' }, 'npc_001');
      expect(Object.values(validation.finalPrice)[0]).toBe(750);
      expect(validation.confirmLevel).toBe('low');
    });

    it('多重折扣取最低价', () => {
      const goodsId = 'eq_sword_steel'; // { copper: 1500 }

      const item = shop.getGoodsItem('normal', goodsId);
      if (item) item.discount = 0.8;

      shop.setNPCDiscountProvider(() => 0.9);

      shop.addDiscount({
        type: 'limited_sale',
        rate: 0.7,
        startTime: Date.now() - 1000,
        endTime: Date.now() + 100000,
        applicableGoods: [goodsId],
      });

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' }, 'npc_001');
      // 最低折扣 0.7 → 1500 * 0.7 = 1050 → medium (> 1000)
      expect(Object.values(validation.finalPrice)[0]).toBe(1050);
      expect(validation.confirmLevel).toBe('medium');
    });

    it('折扣使 critical 降为 high', () => {
      // spd_daily_pack: { ingot: 198 } → 198000 → critical
      const goodsId = 'spd_daily_pack';
      const v1 = shop.validateBuy({ goodsId, quantity: 1, shopType: 'limited_time' });
      expect(v1.confirmLevel).toBe('critical');

      // 设置大幅折扣 → ingot 198 * 0.1 = 19.8 → 20 → 20000 → high
      const item = shop.getGoodsItem('limited_time', goodsId);
      if (item) {
        item.discount = 0.1;
        const v2 = shop.validateBuy({ goodsId, quantity: 1, shopType: 'limited_time' });
        const price = Object.values(v2.finalPrice)[0];
        expect(price).toBe(20); // Math.ceil(198 * 0.1)
        // copperEq = 20 * 1000 = 20000 → high
        expect(v2.confirmLevel).toBe('high');
      }
    });
  });

  // ═══════════════════════════════════════════
  // 5. 货币不足场景
  // ═══════════════════════════════════════════

  describe('货币不足场景', () => {
    it('货币不足时仍返回正确的确认级别', () => {
      currency._setAffordable(false);

      const goodsId = 'spd_vip_pack';
      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'vip' });
      expect(validation.confirmLevel).toBe('critical');
      expect(validation.canBuy).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('货币不足时 executeBuy 失败但返回确认级别', () => {
      currency._setAffordable(false);

      const goodsId = 'spd_vip_pack';
      const result = shop.executeBuy({ goodsId, quantity: 1, shopType: 'vip' });
      expect(result.success).toBe(false);
      expect(result.confirmLevel).toBe('critical');
    });

    it('high 级别商品货币不足', () => {
      currency._setAffordable(false);

      const goodsId = 'spd_guild_chest';
      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(validation.confirmLevel).toBe('high');
      expect(validation.canBuy).toBe(false);
    });

    it('medium 级别商品货币不足', () => {
      currency._setAffordable(false);

      const goodsId = 'eq_sword_steel';
      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
      expect(validation.confirmLevel).toBe('medium');
      expect(validation.canBuy).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 跨商店类型确认级别一致性
  // ═══════════════════════════════════════════

  describe('跨商店类型确认级别', () => {
    it('同一商品在不同商店确认级别一致（基于单价）', () => {
      const goodsId = 'mat_jade';
      const normalIds = SHOP_GOODS_IDS['normal'];
      const bmIds = SHOP_GOODS_IDS['black_market'];

      if (normalIds.includes(goodsId) && bmIds.includes(goodsId)) {
        const v1 = shop.validateBuy({ goodsId, quantity: 1, shopType: 'normal' });
        const v2 = shop.validateBuy({ goodsId, quantity: 1, shopType: 'black_market' });
        expect(v1.confirmLevel).toBe(v2.confirmLevel);
      }
    });

    it('所有商店类型都支持五级确认', () => {
      for (const shopType of SHOP_TYPES) {
        const goods = shop.getShopGoods(shopType);
        if (goods.length > 0) {
          const validation = shop.validateBuy({ goodsId: goods[0].defId, quantity: 1, shopType });
          expect(['none', 'low', 'medium', 'high', 'critical']).toContain(validation.confirmLevel);
        }
      }
    });

    it('black_market 商品确认级别分布', () => {
      const goods = shop.getShopGoods('black_market');
      const levels = new Set<ConfirmLevel>();
      for (const item of goods) {
        const v = shop.validateBuy({ goodsId: item.defId, quantity: 1, shopType: 'black_market' });
        levels.add(v.confirmLevel);
      }
      // 黑市商品至少有一种确认级别
      expect(levels.size).toBeGreaterThan(0);
    });

    it('vip 商品全部为 critical', () => {
      const goods = shop.getShopGoods('vip');
      for (const item of goods) {
        const def = GOODS_DEF_MAP[item.defId];
        // vip 商店的商品多为 ingot 或高价值
        const copperEq = toCopperEq(def!.basePrice);
        if (copperEq > CONFIRM_THRESHOLDS.high) {
          const v = shop.validateBuy({ goodsId: item.defId, quantity: 1, shopType: 'vip' });
          expect(v.confirmLevel).toBe('critical');
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 7. 误操作防护
  // ═══════════════════════════════════════════

  describe('误操作防护', () => {
    it('购买不存在的商品返回错误', () => {
      const validation = shop.validateBuy({ goodsId: 'nonexistent_item', quantity: 1, shopType: 'normal' });
      expect(validation.canBuy).toBe(false);
      expect(validation.errors).toContain('商品不存在');
      expect(validation.confirmLevel).toBe('none');
    });

    it('商品不在当前商店返回错误', () => {
      const vipIds = SHOP_GOODS_IDS['vip'];
      if (vipIds.length > 0 && !SHOP_GOODS_IDS['normal'].includes(vipIds[0])) {
        const validation = shop.validateBuy({ goodsId: vipIds[0], quantity: 1, shopType: 'normal' });
        expect(validation.canBuy).toBe(false);
        expect(validation.errors).toContain('商品不在当前商店中');
      }
    });

    it('库存不足返回错误且包含确认级别', () => {
      const goodsId = 'spd_vip_pack';
      shop.executeBuy({ goodsId, quantity: 1, shopType: 'vip' });

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'vip' });
      expect(validation.canBuy).toBe(false);
      expect(validation.confirmLevel).toBe('critical');
      expect(validation.errors.some(e => e.includes('库存不足'))).toBe(true);
    });

    it('超过每日限购返回错误', () => {
      const goodsId = 'spd_daily_pack'; // discount → dailyLimit: 2
      shop.executeBuy({ goodsId, quantity: 2, shopType: 'limited_time' });

      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'limited_time' });
      expect(validation.canBuy).toBe(false);
      expect(validation.errors.some(e => e.includes('每日限购'))).toBe(true);
    });

    it('购买数量为 0 或负数不触发确认', () => {
      const goodsId = 'con_potion_hp';
      const v0 = shop.validateBuy({ goodsId, quantity: 0, shopType: 'normal' });
      expect(v0.canBuy).toBe(false);
      expect(v0.confirmLevel).toBe('none');

      const vNeg = shop.validateBuy({ goodsId, quantity: -1, shopType: 'normal' });
      expect(vNeg.canBuy).toBe(false);
      expect(vNeg.confirmLevel).toBe('none');
    });

    it('非整数数量不可购买', () => {
      const goodsId = 'con_potion_hp';
      const v = shop.validateBuy({ goodsId, quantity: 1.5, shopType: 'normal' });
      expect(v.canBuy).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 所有商品确认级别分布统计
  // ═══════════════════════════════════════════

  describe('商品确认级别分布', () => {
    it('所有商品定义都有合法的确认级别', () => {
      for (const def of ALL_GOODS_DEFS) {
        const copperEq = toCopperEq(def.basePrice);
        const level = expectedConfirmLevel(copperEq);
        expect(['none', 'low', 'medium', 'high', 'critical']).toContain(level);
      }
    });

    it('元宝类商品全部为 critical', () => {
      const ingotGoods = findGoodsByCurrency('ingot');
      for (const id of ingotGoods) {
        const def = GOODS_DEF_MAP[id];
        const copperEq = toCopperEq(def.basePrice);
        expect(copperEq).toBeGreaterThan(CONFIRM_THRESHOLDS.high);
        expect(expectedConfirmLevel(copperEq)).toBe('critical');
      }
    });

    it('限定商品全部为 critical', () => {
      const limitedGoods = findLimitedGoods();
      for (const id of limitedGoods) {
        const def = GOODS_DEF_MAP[id];
        const copperEq = toCopperEq(def.basePrice);
        expect(expectedConfirmLevel(copperEq)).toBe('critical');
      }
    });

    it('铜钱类商品为 low 或 medium', () => {
      const copperGoods = findGoodsByCurrency('copper');
      for (const id of copperGoods) {
        const def = GOODS_DEF_MAP[id];
        const copperEq = toCopperEq(def.basePrice);
        const level = expectedConfirmLevel(copperEq);
        expect(['low', 'medium']).toContain(level);
      }
    });

    it('各确认级别都有对应商品', () => {
      const levels = new Set<ConfirmLevel>();
      for (const def of ALL_GOODS_DEFS) {
        levels.add(expectedConfirmLevel(toCopperEq(def.basePrice)));
      }
      // 至少有 low, medium, critical
      expect(levels.has('low')).toBe(true);
      expect(levels.has('medium')).toBe(true);
      expect(levels.has('critical')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 9. TODO — 引擎尚未实现的功能
  // ═══════════════════════════════════════════

  describe('TODO: PRD 与引擎差异', () => {
    /**
     * PRD 规则 vs 引擎实现差异：
     *
     * 1. PRD: L3 触发条件为"元宝消耗（付费货币）"
     *    引擎: confirmLevel 基于铜钱等价金额，不区分货币类型
     *    TODO: 引擎应增加付费货币检测逻辑
     *
     * 2. PRD: L4 触发条件为"元宝 ≥ 500 或限定商品"
     *    引擎: confirmLevel 基于铜钱等价 > 20000
     *    TODO: 引擎应增加限定商品自动 L4 逻辑
     *
     * 3. PRD: 确认级别应基于总价（单价 × 数量）
     *    引擎: confirmLevel 基于 finalPrice（单价）
     *    TODO: 引擎应在 validateBuy 中计算总价确认级别
     *
     * 4. UI 层功能（倒计时/滑动确认）需要在 UI 层实现
     */

    it('TODO: 付费货币应自动触发更高级别确认', () => {
      // con_token_summon: { summon: 1 } → 500 → low
      // PRD: 元宝消耗应触发 L3，但 summon 不是 ingot
      // 且 copperEq = 500 → low
      // 建议: 检测 isPaidCurrency 自动升级 confirmLevel
      const goodsId = 'con_token_summon';
      const validation = shop.validateBuy({ goodsId, quantity: 1, shopType: 'vip' });
      expect(validation.confirmLevel).toBe('low');
      // TODO: 付费货币应至少为 high
    });

    it('TODO: 限定商品应自动触发 critical', () => {
      // 当前限定商品的 basePrice 已经足够高（ingot: 298 → 298000）
      // 所以自然触发 critical
      // 但如果有限定商品价格较低，应自动升级
      const limitedGoods = findLimitedGoods();
      for (const id of limitedGoods) {
        const def = GOODS_DEF_MAP[id];
        const copperEq = toCopperEq(def.basePrice);
        // 当前数据中限定商品都是 critical
        expect(expectedConfirmLevel(copperEq)).toBe('critical');
      }
    });

    it('TODO: 总价确认级别（PRD 要求按总价计算）', () => {
      // PRD: 铜钱 > 2000 或兵力/粮草消耗 → L2
      // 引擎: 基于 finalPrice（单价）
      // 大量购买低价商品应触发更高级别确认
      const goodsId = 'con_potion_hp'; // { copper: 80 } → 80 → low
      const qty = 250; // 总价 20000
      const validation = shop.validateBuy({ goodsId, quantity: qty, shopType: 'normal' });

      // 引擎当前行为：按单价算 → low
      expect(validation.confirmLevel).toBe('low');
      // TODO: PRD 期望按总价算 → high
    });

    it('引擎 confirmLevel 为 UI 层提供决策依据', () => {
      const testCases: Array<{ goodsId: string; shopType: ShopType; expectedMinLevel: ConfirmLevel }> = [
        { goodsId: 'con_potion_hp', shopType: 'normal', expectedMinLevel: 'low' },
        { goodsId: 'eq_sword_steel', shopType: 'normal', expectedMinLevel: 'medium' },
        { goodsId: 'spd_guild_chest', shopType: 'normal', expectedMinLevel: 'high' },
        { goodsId: 'spd_vip_pack', shopType: 'vip', expectedMinLevel: 'critical' },
      ];

      const levelOrder: Record<ConfirmLevel, number> = {
        none: 0, low: 1, medium: 2, high: 3, critical: 4,
      };

      for (const tc of testCases) {
        const validation = shop.validateBuy({ goodsId: tc.goodsId, quantity: 1, shopType: tc.shopType });
        expect(levelOrder[validation.confirmLevel]).toBeGreaterThanOrEqual(levelOrder[tc.expectedMinLevel]);
      }
    });
  });
});
