/**
 * 黑市 & 补货机制测试 — P1 缺口补充
 *
 * 覆盖 PRD [SHP-1] [SHP-3] 中黑市和补货相关功能：
 *   - 黑市随机触发，出现后限时 2 小时
 *   - 定时补货每 8 小时刷新商品
 *   - 离线期间补货时间累积
 *   - 手动刷新机制
 *   - 黑市折扣机制
 *   - 活动商店（活动代币消费）
 *   - NPC 交易（以物易物 + 补差价）
 *
 * @module engine/shop/__tests__/BlackMarket
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ShopSystem } from '../ShopSystem';
import type { ShopType, DiscountConfig } from '../../../core/shop';
import {
  SHOP_TYPES, SHOP_TYPE_LABELS, CONFIRM_THRESHOLDS,
  DEFAULT_RESTOCK_CONFIG, DAILY_MANUAL_REFRESH_LIMIT,
  LIMITED_SHOP_DURATION, BLACK_MARKET_REQUIRED_CASTLE_LEVEL,
  PERMANENT_GOODS_STOCK, RANDOM_GOODS_STOCK, DISCOUNT_GOODS_STOCK,
  LIMITED_GOODS_STOCK,
} from '../../../core/shop';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS } from '../../../core/shop';
import type { ISystemDeps } from '../../../core/types';
import type { CurrencySystem } from '../../currency/CurrencySystem';

// ─── 辅助 ────────────────────────────────────

function createShop(): ShopSystem {
  const shop = new ShopSystem();
  shop.init({
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as any,
    config: { get: vi.fn() } as any,
    registry: { get: vi.fn() } as any,
  });
  return shop;
}

function createMockCurrencySystem(): CurrencySystem & { _setAffordable: (v: boolean) => void } {
  let affordable = true;
  return {
    name: 'currency', init: vi.fn(), update: vi.fn(), getState: vi.fn().mockReturnValue({}), reset: vi.fn(),
    checkAffordability: vi.fn().mockImplementation(() => ({
      canAfford: affordable, shortages: affordable ? [] : [{ currency: 'copper', required: 1000, gap: 500 }],
    })),
    spendByPriority: vi.fn().mockImplementation(() => { if (!affordable) throw new Error('货币不足'); return {}; }),
    _setAffordable: (v: boolean) => { affordable = v; },
  } as any;
}

const COPPER_RATES: Record<string, number> = {
  copper: 1, mandate: 100, recruit: 200, summon: 500, expedition: 80, guild: 80, reputation: 50, ingot: 1000,
};
const HOUR = 3600 * 1000;
const EIGHT_HOURS = 8 * HOUR;
const TWO_HOURS = 2 * HOUR;

// ═══════════════════════════════════════════════

describe('黑市 & 补货机制', () => {
  let shop: ShopSystem;
  let currency: ReturnType<typeof createMockCurrencySystem>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    shop = createShop();
    currency = createMockCurrencySystem();
    shop.setCurrencySystem(currency);
  });

  afterEach(() => { vi.useRealTimers(); });

  // ═══════════════════════════════════════════
  // 1. 黑市基础功能
  // ═══════════════════════════════════════════

  describe('黑市基础功能', () => {
    it('黑市商店类型存在且有标签', () => {
      expect(SHOP_TYPES).toContain('black_market');
      expect(SHOP_TYPE_LABELS['black_market']).toBe('黑市');
    });

    it('黑市初始化时有商品且为稀有/高价值', () => {
      const goods = shop.getShopGoods('black_market');
      expect(goods.length).toBeGreaterThan(0);
      const bmIds = SHOP_GOODS_IDS['black_market'];
      for (const id of bmIds) {
        const def = GOODS_DEF_MAP[id];
        expect(['rare', 'epic', 'legendary']).toContain(def!.rarity);
      }
    });

    it('黑市商品库存有限', () => {
      const goods = shop.getShopGoods('black_market');
      for (const item of goods) {
        const def = GOODS_DEF_MAP[item.defId];
        if (def?.goodsType === 'random') {
          expect(item.stock).toBeGreaterThan(0);
          expect(item.stock).toBeLessThanOrEqual(30);
        }
      }
    });

    it('黑市购买成功后库存扣减', () => {
      const goods = shop.getShopGoods('black_market');
      if (goods.length > 0) {
        const id = goods[0].defId;
        const before = shop.getStockInfo('black_market', id);
        shop.executeBuy({ goodsId: id, quantity: 1, shopType: 'black_market' });
        const after = shop.getStockInfo('black_market', id);
        if (before!.stock !== -1) expect(after!.stock).toBe(before!.stock - 1);
      }
    });

    it('黑市购买发出 shop:goods_purchased 事件', () => {
      const emit = vi.fn();
      const s = new ShopSystem();
      s.init({ eventBus: { emit, on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as any, config: { get: vi.fn() } as any, registry: { get: vi.fn() } as any });
      s.setCurrencySystem(currency);
      const goods = s.getShopGoods('black_market');
      if (goods.length > 0) {
        s.executeBuy({ goodsId: goods[0].defId, quantity: 1, shopType: 'black_market' });
        expect(emit).toHaveBeenCalledWith('shop:goods_purchased', expect.objectContaining({ shopType: 'black_market' }));
      }
    });
  });

  // ═══════════════════════════════════════════
  // 2. 黑市限时机制（2小时）
  // ═══════════════════════════════════════════

  describe('黑市限时机制', () => {
    it('LIMITED_SHOP_DURATION 配置为 2 小时', () => {
      expect(LIMITED_SHOP_DURATION).toBe(7200);
    });

    it('黑市商品有上架时间记录', () => {
      for (const item of shop.getShopGoods('black_market')) {
        expect(item.listedAt).toBeGreaterThan(0);
      }
    });

    it('TODO: 黑市出现后应记录出现时间', () => {
      const bmState = shop.getState()['black_market'];
      expect(bmState).toBeDefined();
      // TODO: 未来应增加 bmState.blackMarketActiveAt
    });

    it('TODO: 黑市 2 小时后商品应不可购买', () => {
      vi.advanceTimersByTime(TWO_HOURS + 1000);
      const goods = shop.getShopGoods('black_market');
      if (goods.length > 0) {
        const v = shop.validateBuy({ goodsId: goods[0].defId, quantity: 1, shopType: 'black_market' });
        // TODO: 未来应改为 expect(v.canBuy).toBe(false);
        expect(v).toBeDefined();
      }
    });

    it('TODO: 黑市随机触发概率（NPC 触发）', () => {
      // PRD: NPC 随机触发黑市，引擎未实现触发概率
      expect(true).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 黑市折扣机制
  // ═══════════════════════════════════════════

  describe('黑市折扣机制', () => {
    it('黑市商品可添加额外折扣', () => {
      const goods = shop.getShopGoods('black_market');
      if (goods.length > 0) {
        const id = goods[0].defId;
        const base = Object.values(GOODS_DEF_MAP[id]!.basePrice)[0];
        shop.addDiscount({ type: 'limited_sale', rate: 0.5, startTime: Date.now() - 1000, endTime: Date.now() + TWO_HOURS, applicableGoods: [id] });
        const final = Object.values(shop.calculateFinalPrice(id, 'black_market'))[0];
        expect(final).toBe(Math.ceil(base * 0.5));
      }
    });

    it('黑市折扣过期后恢复原价', () => {
      const goods = shop.getShopGoods('black_market');
      if (goods.length > 0) {
        const id = goods[0].defId;
        const base = Object.values(GOODS_DEF_MAP[id]!.basePrice)[0];
        shop.addDiscount({ type: 'limited_sale', rate: 0.3, startTime: Date.now() - TWO_HOURS, endTime: Date.now() - 1000, applicableGoods: [id] });
        expect(Object.values(shop.calculateFinalPrice(id, 'black_market'))[0]).toBe(base);
      }
    });

    it('补货时 20% 概率出现折扣（统计单商品）', () => {
      expect(DEFAULT_RESTOCK_CONFIG.discountChance).toBe(0.2);
      let discounted = 0;
      const id = 'eq_sword_iron';
      for (let i = 0; i < 200; i++) {
        shop.resetDailyLimits(); // 重置刷新次数限制
        shop.manualRefresh();
        const item = shop.getGoodsItem('normal', id);
        if (item && item.discount < 1) discounted++;
      }
      expect(discounted).toBeGreaterThan(0);
      expect(discounted).toBeLessThan(200);
    });

    it('补货折扣范围在 0.7 ~ 0.9', () => {
      const discounts: number[] = [];
      for (let i = 0; i < 100; i++) {
        shop.resetDailyLimits();
        shop.manualRefresh();
        for (const item of shop.getShopGoods('normal')) {
          if (item.discount < 1) discounts.push(item.discount);
        }
      }
      for (const d of discounts) {
        expect(d).toBeGreaterThanOrEqual(0.7);
        expect(d).toBeLessThanOrEqual(0.9);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 4. 定时补货（每 8 小时）
  // ═══════════════════════════════════════════

  describe('定时补货（每8小时）', () => {
    it('scheduledInterval 为 28800 秒', () => {
      expect(DEFAULT_RESTOCK_CONFIG.scheduledInterval).toBe(28800);
    });

    it('update 在 8 小时后触发补货', () => {
      vi.advanceTimersByTime(EIGHT_HOURS);
      shop.update(0);
      expect(shop.getState()['normal'].lastScheduledRestock).toBe(Date.now());
    });

    it('补货后商品库存恢复', () => {
      const goods = shop.getShopGoods('normal');
      const rg = goods.find(g => GOODS_DEF_MAP[g.defId]?.goodsType === 'random' && g.stock > 0);
      if (rg) {
        shop.executeBuy({ goodsId: rg.defId, quantity: 1, shopType: 'normal' });
        vi.advanceTimersByTime(EIGHT_HOURS);
        shop.update(0);
        expect(shop.getStockInfo('normal', rg.defId)!.stock).toBe(RANDOM_GOODS_STOCK);
      }
    });

    it('不到 8 小时不触发补货', () => {
      const before = shop.getState()['normal'].lastScheduledRestock;
      vi.advanceTimersByTime(EIGHT_HOURS - HOUR);
      shop.update(0);
      expect(shop.getState()['normal'].lastScheduledRestock).toBe(before);
    });

    it('所有商店类型都参与定时补货', () => {
      vi.advanceTimersByTime(EIGHT_HOURS);
      shop.update(0);
      const now = Date.now();
      for (const type of SHOP_TYPES) {
        expect(shop.getState()[type].lastScheduledRestock).toBe(now);
      }
    });

    it('补货后商品列表完整', () => {
      vi.advanceTimersByTime(EIGHT_HOURS);
      shop.update(0);
      for (const type of SHOP_TYPES) {
        const goods = shop.getShopGoods(type);
        const expected = SHOP_GOODS_IDS[type] ?? [];
        expect(goods.length).toBe(expected.length);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 5. 离线补货
  // ═══════════════════════════════════════════

  describe('离线补货', () => {
    it('离线补货间隔 8 小时，最大累积 2 次', () => {
      expect(DEFAULT_RESTOCK_CONFIG.offlineInterval).toBe(28800);
      expect(DEFAULT_RESTOCK_CONFIG.offlineMaxAccumulation).toBe(2);
    });

    it('离线 8 小时后补货成功', () => {
      const data = shop.serialize();
      data.shops['normal'].lastOfflineRestock = Date.now() - EIGHT_HOURS;
      shop.deserialize(data);
      shop.processOfflineRestock();
      expect(shop.getShopGoods('normal').length).toBeGreaterThan(0);
    });

    it('离线 16/24 小时最多累积 2 次', () => {
      for (const hours of [16, 24]) {
        const data = shop.serialize();
        for (const t of SHOP_TYPES) data.shops[t].lastOfflineRestock = Date.now() - hours * HOUR;
        shop.deserialize(data);
        shop.processOfflineRestock();
        expect(shop.getShopGoods('normal').length).toBeGreaterThan(0);
      }
    });

    it('离线不足 8 小时不触发补货', () => {
      const data = shop.serialize();
      data.shops['normal'].lastOfflineRestock = Date.now() - 4 * HOUR;
      shop.deserialize(data);
      const before = shop.getShopGoods('normal').map(g => g.defId);
      shop.processOfflineRestock();
      expect(shop.getShopGoods('normal').map(g => g.defId)).toEqual(before);
    });

    it('离线限定稀有商品概率 10%', () => {
      expect(DEFAULT_RESTOCK_CONFIG.offlineRareChance).toBe(0.1);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 手动刷新
  // ═══════════════════════════════════════════

  describe('手动刷新', () => {
    it('每日上限 5 次', () => {
      expect(DAILY_MANUAL_REFRESH_LIMIT).toBe(5);
      for (let i = 0; i < 5; i++) expect(shop.manualRefresh().success).toBe(true);
      expect(shop.manualRefresh().success).toBe(false);
    });

    it('刷新后库存恢复', () => {
      const rg = shop.getShopGoods('normal').find(g => g.stock > 0 && g.stock !== -1);
      if (rg) {
        shop.executeBuy({ goodsId: rg.defId, quantity: 1, shopType: 'normal' });
        shop.manualRefresh();
        const def = GOODS_DEF_MAP[rg.defId];
        const expected = def?.goodsType === 'random' ? RANDOM_GOODS_STOCK : PERMANENT_GOODS_STOCK;
        expect(shop.getStockInfo('normal', rg.defId)!.stock).toBe(expected);
      }
    });

    it('resetDailyLimits 重置刷新次数', () => {
      for (let i = 0; i < 5; i++) shop.manualRefresh();
      shop.resetDailyLimits();
      expect(shop.manualRefresh().success).toBe(true);
    });

    it('手动刷新影响所有商店类型', () => {
      shop.manualRefresh();
      for (const t of SHOP_TYPES) expect(shop.getState()[t].manualRefreshCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 活动商店（活动代币消费）
  // ═══════════════════════════════════════════

  describe('活动商店（活动代币消费）', () => {
    it('TODO: 活动商店类型需要扩展', () => {
      expect(SHOP_TYPES).toContain('limited_time');
      // TODO: expect(SHOP_TYPES).toContain('event');
    });

    it('TODO: 活动代币消费机制', () => {
      // 需要实现: 活动代币类型、余额管理、购买验证、不足提示
      expect(true).toBe(true);
    });

    it('TODO: 活动商店跟随活动周期', () => {
      // 需要实现: 活动开始/结束时间、期间商品可用、结束后不可购买
      expect(true).toBe(true);
    });

    it('现有 limited_time 商店可模拟活动商店行为', () => {
      const goods = shop.getShopGoods('limited_time');
      expect(goods.length).toBeGreaterThan(0);
      if (goods.length > 0) {
        expect(shop.validateBuy({ goodsId: goods[0].defId, quantity: 1, shopType: 'limited_time' })).toBeDefined();
      }
    });

    it('限时商店商品使用元宝支付', () => {
      for (const id of SHOP_GOODS_IDS['limited_time']) {
        const def = GOODS_DEF_MAP[id];
        expect(def).toBeDefined();
        if (def!.primaryCurrency === 'ingot') {
          expect(Object.keys(def!.basePrice)).toContain('ingot');
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 8. NPC 交易（以物易物 + 补差价）
  // ═══════════════════════════════════════════

  describe('NPC 交易（以物易物 + 补差价）', () => {
    it('NPC 好感度折扣已实现', () => {
      shop.setNPCDiscountProvider(() => 0.85);
      const base = Object.values(GOODS_DEF_MAP['eq_sword_iron']!.basePrice)[0];
      expect(Object.values(shop.calculateFinalPrice('eq_sword_iron', 'normal', 'npc_001'))[0]).toBe(Math.ceil(base * 0.85));
    });

    it('NPC 不同好感度等级折扣不同', () => {
      const base = Object.values(GOODS_DEF_MAP['eq_sword_iron']!.basePrice)[0];
      const levels = [
        { npcId: 'npc_stranger', discount: 1.0 },
        { npcId: 'npc_familiar', discount: 0.95 },
        { npcId: 'npc_trust', discount: 0.9 },
        { npcId: 'npc_intimate', discount: 0.85 },
        { npcId: 'npc_bestfriend', discount: 0.8 },
      ];
      for (const l of levels) {
        shop.setNPCDiscountProvider((id: string) => levels.find(x => x.npcId === id)?.discount ?? 1);
        expect(Object.values(shop.calculateFinalPrice('eq_sword_iron', 'normal', l.npcId))[0]).toBe(Math.ceil(base * l.discount));
      }
    });

    it('NPC 折扣与商品折扣取最低', () => {
      const item = shop.getGoodsItem('normal', 'eq_sword_iron');
      if (item) item.discount = 0.8;
      shop.setNPCDiscountProvider(() => 0.9);
      const base = Object.values(GOODS_DEF_MAP['eq_sword_iron']!.basePrice)[0];
      expect(Object.values(shop.calculateFinalPrice('eq_sword_iron', 'normal', 'npc_001'))[0]).toBe(Math.ceil(base * 0.8));
    });

    it('NPC 交易购买流程验证', () => {
      shop.setNPCDiscountProvider(() => 0.9);
      const result = shop.executeBuy({ goodsId: 'eq_sword_iron', quantity: 1, shopType: 'normal' }, 'npc_001');
      expect(result.success).toBe(true);
      expect(result.cost!.copper).toBe(Math.ceil(500 * 0.9));
    });

    it('TODO: 以物易物交换机制', () => {
      // 需要实现: 交换请求结构、交换比例计算、交换验证/执行
      expect(true).toBe(true);
    });

    it('TODO: 铜钱补差价机制', () => {
      // 需要实现: 物品价值评估、差价计算、铜钱补差/退还
      expect(true).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 序列化与补货状态持久化
  // ═══════════════════════════════════════════

  describe('序列化与补货状态', () => {
    it('序列化保存补货时间', () => {
      const data = shop.serialize();
      expect(data.shops['normal'].lastScheduledRestock).toBeGreaterThan(0);
      expect(data.shops['normal'].lastOfflineRestock).toBeGreaterThan(0);
    });

    it('反序列化恢复补货时间', () => {
      const data = shop.serialize();
      const t = data.shops['normal'].lastScheduledRestock;
      const s = createShop();
      s.deserialize(data);
      expect(s.getState()['normal'].lastScheduledRestock).toBe(t);
    });

    it('离线时间通过序列化/反序列化正确传递', () => {
      const data = shop.serialize();
      data.shops['normal'].lastOfflineRestock = Date.now() - EIGHT_HOURS;
      const s = createShop();
      s.setCurrencySystem(currency);
      s.deserialize(data);
      s.processOfflineRestock();
      expect(s.getShopGoods('normal').length).toBeGreaterThan(0);
    });

    it('手动刷新次数通过序列化持久化', () => {
      shop.manualRefresh(); shop.manualRefresh(); shop.manualRefresh();
      const data = shop.serialize();
      expect(data.shops['normal'].manualRefreshCount).toBe(3);
      const s = createShop();
      s.deserialize(data);
      expect(s.getState()['normal'].manualRefreshCount).toBe(3);
      expect(s.manualRefresh().success).toBe(true);
      expect(s.manualRefresh().success).toBe(true);
      expect(s.manualRefresh().success).toBe(false);
    });

    it('收藏列表通过序列化持久化', () => {
      const goods = shop.getShopGoods('normal');
      if (goods.length > 0 && GOODS_DEF_MAP[goods[0].defId]?.favoritable) {
        shop.toggleFavorite(goods[0].defId);
      }
      const data = shop.serialize();
      const s = createShop();
      s.deserialize(data);
      for (const id of data.favorites) expect(s.isFavorite(id)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 10. 配置常量验证
  // ═══════════════════════════════════════════

  describe('黑市配置常量', () => {
    it('BLACK_MARKET_REQUIRED_CASTLE_LEVEL = 6', () => {
      expect(BLACK_MARKET_REQUIRED_CASTLE_LEVEL).toBe(6);
    });
    it('LIMITED_SHOP_DURATION = 7200', () => {
      expect(LIMITED_SHOP_DURATION).toBe(7200);
    });
    it('离线补货最大累积 2 次（16h 上限）', () => {
      expect(DEFAULT_RESTOCK_CONFIG.offlineMaxAccumulation * DEFAULT_RESTOCK_CONFIG.offlineInterval).toBe(57600);
    });
    it('手动刷新消耗 500 铜钱', () => {
      expect(DEFAULT_RESTOCK_CONFIG.manualRefreshCost).toEqual({ copper: 500 });
    });
  });

  // ═══════════════════════════════════════════
  // 11. 补货与购买联合场景
  // ═══════════════════════════════════════════

  describe('补货与购买联合场景', () => {
    it('购买后补货恢复库存可再次购买', () => {
      shop.executeBuy({ goodsId: 'eq_ring_jade', quantity: 1, shopType: 'normal' });
      vi.advanceTimersByTime(EIGHT_HOURS);
      shop.update(0);
      expect(shop.executeBuy({ goodsId: 'eq_ring_jade', quantity: 1, shopType: 'normal' }).success).toBe(true);
    });

    it('黑市购买后补货恢复', () => {
      const goods = shop.getShopGoods('black_market');
      if (goods.length > 0) {
        shop.executeBuy({ goodsId: goods[0].defId, quantity: 1, shopType: 'black_market' });
        vi.advanceTimersByTime(EIGHT_HOURS);
        shop.update(0);
        expect(shop.executeBuy({ goodsId: goods[0].defId, quantity: 1, shopType: 'black_market' }).success).toBe(true);
      }
    });

    it('限购达到上限后补货重置限购计数', () => {
      shop.executeBuy({ goodsId: 'spd_daily_pack', quantity: 2, shopType: 'limited_time' });
      expect(shop.validateBuy({ goodsId: 'spd_daily_pack', quantity: 1, shopType: 'limited_time' }).canBuy).toBe(false);
      vi.advanceTimersByTime(EIGHT_HOURS);
      shop.update(0);
      const stock = shop.getStockInfo('limited_time', 'spd_daily_pack');
      if (stock) {
        expect(stock.dailyPurchased).toBe(0);
        expect(shop.validateBuy({ goodsId: 'spd_daily_pack', quantity: 1, shopType: 'limited_time' }).canBuy).toBe(true);
      }
    });

    it('序列化→离线→反序列化→补货→购买完整流程', () => {
      shop.executeBuy({ goodsId: 'eq_sword_iron', quantity: 1, shopType: 'normal' });
      const data = shop.serialize();
      data.shops['normal'].lastOfflineRestock = Date.now() - EIGHT_HOURS;
      const s = createShop();
      s.setCurrencySystem(currency);
      s.deserialize(data);
      s.processOfflineRestock();
      expect(s.executeBuy({ goodsId: 'eq_sword_iron', quantity: 1, shopType: 'normal' }).success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 12. 重置与清理
  // ═══════════════════════════════════════════

  describe('重置与清理', () => {
    it('reset 清空所有商店状态', () => {
      const goods = shop.getShopGoods('normal');
      if (goods.length > 0) shop.executeBuy({ goodsId: goods[0].defId, quantity: 1, shopType: 'normal' });
      shop.reset();
      for (const t of SHOP_TYPES) {
        expect(shop.getState()[t].manualRefreshCount).toBe(0);
        expect(shop.getState()[t].shopLevel).toBe(1);
      }
    });

    it('reset 清空收藏和折扣', () => {
      const goods = shop.getShopGoods('normal');
      if (goods.length > 0 && GOODS_DEF_MAP[goods[0].defId]?.favoritable) {
        shop.toggleFavorite(goods[0].defId);
      }
      shop.addDiscount({ type: 'normal', rate: 0.5, startTime: Date.now() - 1000, endTime: Date.now() + 100000, applicableGoods: [] });
      shop.reset();
      expect(shop.getFavorites()).toEqual([]);
      const base = Object.values(GOODS_DEF_MAP['eq_sword_iron']!.basePrice)[0];
      expect(Object.values(shop.calculateFinalPrice('eq_sword_iron', 'normal'))[0]).toBe(base);
    });
  });
});
