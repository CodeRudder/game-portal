/**
 * 商店模块对抗式测试
 *
 * 覆盖子系统：
 *   S1: ShopSystem   — 商品列表/购买/刷新/折扣/收藏/补货/序列化
 *   S2: shop.types   — 类型定义（ShopType/GoodsCategory/BuyRequest/BuyResult）
 *   S3: shop-config  — 配置常量（补货/确认阈值/库存/刷新上限）
 *   S4: goods-data   — 商品静态数据（GOODS_DEF_MAP/SHOP_GOODS_IDS）
 *
 * 5维度挑战：
 *   F-Normal:    正向流程（初始化→浏览→购买→刷新→折扣→收藏→序列化）
 *   F-Error:     异常路径（无效商品/货币不足/库存不足/重复购买/限购超限）
 *   F-Boundary:  边界条件（空商品/NaN价格/负数库存/零数量/超大数量/刷新上限）
 *   F-Cross:     跨系统交互（购买→货币扣除→事件触发→折扣叠加→NPC好感度）
 *   F-Lifecycle: 数据生命周期（序列化/反序列化/每日重置/reset/版本兼容）
 *
 * @module tests/adversarial/shop-adversarial
 */

import { describe, it, expect, vi } from 'vitest';
import { ShopSystem } from '../../engine/shop/ShopSystem';
import type { ShopCurrencyOps } from '../../engine/shop/ShopSystem';
import {
  SHOP_TYPES, SHOP_TYPE_LABELS, GOODS_CATEGORY_LABELS,
  DEFAULT_RESTOCK_CONFIG, DAILY_MANUAL_REFRESH_LIMIT, SHOP_SAVE_VERSION,
  CONFIRM_THRESHOLDS, PERMANENT_GOODS_STOCK, RANDOM_GOODS_STOCK,
  DISCOUNT_GOODS_STOCK, LIMITED_GOODS_STOCK,
  GOODS_DEF_MAP, SHOP_GOODS_IDS,
} from '../../core/shop';
import type {
  ShopType, GoodsCategory, BuyRequest, DiscountConfig, ShopSaveData, ShopState,
} from '../../core/shop';
import type { ISystemDeps } from '../../core/types';

// ── 测试辅助 ──────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: { on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function richCurrencyOps(): ShopCurrencyOps {
  return { checkAffordability: () => ({ canAfford: true, shortages: [] }), spendByPriority: () => ({}) };
}

function poorCurrencyOps(): ShopCurrencyOps {
  return {
    checkAffordability: (costs) => ({
      canAfford: false,
      shortages: Object.entries(costs).map(([c, r]) => ({ currency: c, required: r, current: 0, gap: r })),
    }),
    spendByPriority: () => { throw new Error('货币不足'); },
  };
}

function currencyWithBalance(balances: Record<string, number>): ShopCurrencyOps {
  return {
    checkAffordability: (costs) => {
      const shortages: Array<{ currency: string; required: number; current: number; gap: number }> = [];
      for (const [c, r] of Object.entries(costs)) { const cur = balances[c] ?? 0; if (cur < r) shortages.push({ currency: c, required: r, current: cur, gap: r - cur }); }
      return { canAfford: shortages.length === 0, shortages };
    },
    spendByPriority: (_s, costs) => {
      for (const [c, r] of Object.entries(costs)) { if ((balances[c] ?? 0) < r) throw new Error(`${c}不足`); balances[c] -= r; }
      return { ...costs };
    },
  };
}

function createShop(currency?: ShopCurrencyOps): ShopSystem {
  const sys = new ShopSystem(); sys.init(mockDeps()); if (currency) sys.setCurrencyOps(currency); return sys;
}

function buyReq(goodsId: string, quantity: number, shopType: ShopType = 'normal'): BuyRequest {
  return { goodsId, quantity, shopType };
}

/** 找一个铜钱商品ID（价格≤500） */
function cheapCopperGoods(): string | undefined {
  return SHOP_GOODS_IDS.normal.find(g => { const d = GOODS_DEF_MAP[g]; return d?.basePrice.copper && d.basePrice.copper <= 500; });
}

// ═══════════════════════════════════════════════
// F-Normal: 正向流程
// ═══════════════════════════════════════════════

describe('F-Normal: 商店初始化与商品列表', () => {
  it('初始化后四种商店均有商品', () => {
    const sys = createShop();
    for (const type of SHOP_TYPES) expect(sys.getShopGoods(type).length).toBeGreaterThan(0);
  });

  it('各商店类型标签正确', () => {
    expect(SHOP_TYPE_LABELS.normal).toBe('集市');
    expect(SHOP_TYPE_LABELS.black_market).toBe('黑市');
    expect(SHOP_TYPE_LABELS.limited_time).toBe('限时特惠');
    expect(SHOP_TYPE_LABELS.vip).toBe('VIP商店');
  });

  it('商品分类列表完整', () => {
    const cats = createShop().getCategories();
    expect(cats).toEqual(expect.arrayContaining(['resource', 'material', 'equipment', 'consumable', 'special']));
  });

  it('getGoodsDef / getGoodsItem 查询', () => {
    const sys = createShop();
    const def = sys.getGoodsDef('res_grain_small');
    expect(def).toBeDefined();
    expect(def!.name).toBe('粮草小包');
    expect(def!.basePrice.copper).toBe(200);
    const item = sys.getGoodsItem('normal', SHOP_GOODS_IDS.normal[0]);
    expect(item).toBeDefined();
    expect(item!.defId).toBe(SHOP_GOODS_IDS.normal[0]);
  });
});

describe('F-Normal: 购买流程', () => {
  it('正常购买铜钱商品成功', () => {
    const balances = { copper: 10000 };
    const sys = createShop(currencyWithBalance(balances));
    const gid = cheapCopperGoods()!;
    const r = sys.executeBuy(buyReq(gid, 1));
    expect(r.success).toBe(true);
    expect(r.goodsId).toBe(gid);
    expect(r.quantity).toBe(1);
    expect(r.cost!.copper).toBeGreaterThan(0);
  });

  it('validateBuy 返回正确校验信息', () => {
    const v = createShop(richCurrencyOps()).validateBuy(buyReq(SHOP_GOODS_IDS.normal[0], 1));
    expect(v.canBuy).toBe(true);
    expect(v.errors).toHaveLength(0);
    expect(v.finalPrice).toBeDefined();
    expect(v.confirmLevel).toBeDefined();
  });

  it('购买后库存和购买计数更新', () => {
    const sys = createShop(richCurrencyOps());
    const gid = SHOP_GOODS_IDS.normal.find(g => GOODS_DEF_MAP[g]?.goodsType === 'random');
    if (gid) {
      const before = sys.getGoodsItem('normal', gid)!.stock;
      sys.executeBuy(buyReq(gid, 1));
      const after = sys.getGoodsItem('normal', gid)!;
      expect(after.stock).toBe(before - 1);
      expect(after.dailyPurchased).toBe(1);
      expect(after.lifetimePurchased).toBe(1);
    }
  });

  it('购买触发 shop:goods_purchased 事件', () => {
    const deps = mockDeps();
    const sys = new ShopSystem(); sys.init(deps); sys.setCurrencyOps(richCurrencyOps());
    const gid = cheapCopperGoods()!;
    sys.executeBuy(buyReq(gid, 1));
    expect(deps.eventBus.emit).toHaveBeenCalledWith('shop:goods_purchased', expect.objectContaining({ goodsId: gid, quantity: 1 }));
  });
});

describe('F-Normal: 货币类型覆盖', () => {
  it.each([
    ['铜钱', 'res_grain_small', { copper: 1000 }, 'normal', { copper: 200 }],
    ['天命', 'mat_jade', { mandate: 100 }, 'normal', { mandate: 10 }],
    ['招贤令', 'con_token_recruit', { recruit: 10 }, 'normal', { recruit: 1 }],
    ['声望', 'spd_blueprint', { reputation: 100 }, 'normal', { reputation: 50 }],
    ['元宝', 'spd_vip_pack', { ingot: 500 }, 'vip', { ingot: 298 }],
  ] as const)('%s商品正常购买', (_label, gid, bal, shopType, expectedCost) => {
    const sys = createShop(currencyWithBalance({ ...bal }));
    const r = sys.executeBuy(buyReq(gid, 1, shopType as ShopType));
    expect(r.success).toBe(true);
    for (const [cur, amt] of Object.entries(expectedCost)) expect(r.cost![cur]).toBe(amt);
  });
});

describe('F-Normal: 折扣机制', () => {
  it('添加限时折扣后价格降低', () => {
    const sys = createShop(richCurrencyOps());
    const normal = sys.calculateFinalPrice('res_grain_small', 'normal');
    sys.addDiscount({ type: 'limited_sale', rate: 0.5, startTime: Date.now() - 1000, endTime: Date.now() + 100000, applicableGoods: ['res_grain_small'] });
    expect(sys.calculateFinalPrice('res_grain_small', 'normal').copper).toBe(Math.ceil(200 * 0.5));
    expect(sys.calculateFinalPrice('res_grain_small', 'normal').copper).toBeLessThan(normal.copper);
  });

  it('全局折扣影响所有商品', () => {
    const sys = createShop(richCurrencyOps());
    sys.addDiscount({ type: 'normal', rate: 0.8, startTime: Date.now() - 1000, endTime: Date.now() + 100000, applicableGoods: [] });
    expect(sys.calculateFinalPrice('res_grain_small', 'normal').copper).toBe(Math.ceil(200 * 0.8));
  });

  it('NPC好感度折扣', () => {
    const sys = createShop(richCurrencyOps());
    sys.setNPCDiscountProvider(() => 0.9);
    expect(sys.calculateFinalPrice('res_grain_small', 'normal', 'npc1').copper).toBe(Math.ceil(200 * 0.9));
  });

  it('多种折扣取最低值', () => {
    const sys = createShop(richCurrencyOps());
    sys.setNPCDiscountProvider(() => 0.9);
    sys.addDiscount({ type: 'limited_sale', rate: 0.5, startTime: Date.now() - 1000, endTime: Date.now() + 100000, applicableGoods: ['res_grain_small'] });
    expect(sys.calculateFinalPrice('res_grain_small', 'normal', 'npc1').copper).toBe(Math.ceil(200 * 0.5));
  });

  it('过期折扣不影响价格', () => {
    const sys = createShop(richCurrencyOps());
    sys.addDiscount({ type: 'limited_sale', rate: 0.5, startTime: Date.now() - 200000, endTime: Date.now() - 1000, applicableGoods: [] });
    expect(sys.calculateFinalPrice('res_grain_small', 'normal').copper).toBe(200);
  });

  it('cleanupExpiredDiscounts 清除过期折扣', () => {
    const sys = createShop();
    sys.addDiscount({ type: 'limited_sale', rate: 0.5, startTime: Date.now() - 200000, endTime: Date.now() - 1000, applicableGoods: [] });
    sys.addDiscount({ type: 'normal', rate: 0.8, startTime: Date.now() - 1000, endTime: Date.now() + 100000, applicableGoods: [] });
    expect(sys.cleanupExpiredDiscounts()).toBe(1);
  });
});

describe('F-Normal: 刷新与补货', () => {
  it('manualRefresh 成功刷新', () => {
    expect(createShop().manualRefresh().success).toBe(true);
  });

  it('resetDailyLimits 重置每日计数', () => {
    const sys = createShop(richCurrencyOps());
    const gid = cheapCopperGoods()!;
    sys.executeBuy(buyReq(gid, 1));
    expect(sys.getGoodsItem('normal', gid)!.dailyPurchased).toBeGreaterThan(0);
    sys.resetDailyLimits();
    expect(sys.getGoodsItem('normal', gid)!.dailyPurchased).toBe(0);
  });
});

describe('F-Normal: 收藏管理', () => {
  it('添加/取消收藏', () => {
    const sys = createShop();
    expect(sys.toggleFavorite('res_grain_small')).toBe(true);
    expect(sys.isFavorite('res_grain_small')).toBe(true);
    expect(sys.getFavorites()).toContain('res_grain_small');
    expect(sys.toggleFavorite('res_grain_small')).toBe(false);
    expect(sys.isFavorite('res_grain_small')).toBe(false);
  });

  it('不可收藏商品返回 false', () => {
    expect(createShop().toggleFavorite('con_token_recruit')).toBe(false);
  });
});

describe('F-Normal: 商品搜索过滤', () => {
  it('按分类/关键词/库存/价格排序/价格范围过滤', () => {
    const sys = createShop();
    const res = sys.filterGoods('normal', { category: 'resource' });
    expect(res.length).toBeGreaterThan(0);
    for (const i of res) expect(GOODS_DEF_MAP[i.defId]?.category).toBe('resource');

    const kw = sys.filterGoods('normal', { keyword: '粮草' });
    expect(kw.length).toBeGreaterThan(0);

    const stock = sys.filterGoods('normal', { inStockOnly: true });
    for (const i of stock) expect(i.stock === -1 || i.stock > 0).toBe(true);

    const sorted = sys.filterGoods('normal', { sortBy: 'price', sortOrder: 'asc' });
    for (let i = 1; i < sorted.length; i++) {
      const pA = Object.values(GOODS_DEF_MAP[sorted[i - 1].defId]?.basePrice ?? {})[0] ?? 0;
      const pB = Object.values(GOODS_DEF_MAP[sorted[i].defId]?.basePrice ?? {})[0] ?? 0;
      expect(pA).toBeLessThanOrEqual(pB);
    }

    const range = sys.filterGoods('normal', { priceRange: [100, 500] });
    for (const i of range) {
      const p = Object.values(GOODS_DEF_MAP[i.defId]?.basePrice ?? {})[0] ?? 0;
      expect(p).toBeGreaterThanOrEqual(100);
      expect(p).toBeLessThanOrEqual(500);
    }
  });
});

// ═══════════════════════════════════════════════
// F-Error: 异常路径
// ═══════════════════════════════════════════════

describe('F-Error: 购买异常', () => {
  it('商品不存在 → canBuy=false', () => {
    const v = createShop(richCurrencyOps()).validateBuy(buyReq('nonexistent', 1));
    expect(v.canBuy).toBe(false);
    expect(v.errors).toContain('商品不存在');
  });

  it('商品不在当前商店中', () => {
    const v = createShop(richCurrencyOps()).validateBuy(buyReq('spd_vip_pack', 1, 'normal'));
    expect(v.canBuy).toBe(false);
    expect(v.errors).toContain('商品不在当前商店中');
  });

  it('货币不足 → canBuy=false + executeBuy返回失败', () => {
    const sys = createShop(poorCurrencyOps());
    const gid = SHOP_GOODS_IDS.normal[0];
    const v = sys.validateBuy(buyReq(gid, 1));
    expect(v.canBuy).toBe(false);
    expect(v.errors.some(e => e.includes('不足'))).toBe(true);
    expect(sys.executeBuy(buyReq(gid, 1)).success).toBe(false);
  });

  it('库存不足', () => {
    const sys = createShop(richCurrencyOps());
    const gid = SHOP_GOODS_IDS.normal.find(g => GOODS_DEF_MAP[g]?.goodsType === 'limited');
    if (gid) {
      const stock = sys.getGoodsItem('normal', gid)!.stock;
      if (stock > 0 && stock !== -1) {
        const v = sys.validateBuy(buyReq(gid, stock + 10));
        expect(v.canBuy).toBe(false);
        expect(v.errors.some(e => e.includes('库存不足'))).toBe(true);
      }
    }
  });

  it('每日限购超限', () => {
    const sys = createShop(richCurrencyOps());
    const gid = SHOP_GOODS_IDS.normal.find(g => GOODS_DEF_MAP[g]?.goodsType === 'discount');
    if (gid) {
      const item = sys.getGoodsItem('normal', gid)!;
      if (item.dailyLimit > 0) {
        sys.executeBuy(buyReq(gid, item.dailyLimit));
        const v = sys.validateBuy(buyReq(gid, 1));
        expect(v.canBuy).toBe(false);
        expect(v.errors.some(e => e.includes('每日限购'))).toBe(true);
      }
    }
  });

  it('终身限购超限', () => {
    const sys = createShop(richCurrencyOps());
    const gid = SHOP_GOODS_IDS.normal.find(g => GOODS_DEF_MAP[g]?.goodsType === 'limited');
    if (gid) {
      const item = sys.getGoodsItem('normal', gid)!;
      if (item.lifetimeLimit > 0) {
        for (let i = 0; i < item.lifetimeLimit; i++) sys.executeBuy(buyReq(gid, 1));
        const v = sys.validateBuy(buyReq(gid, 1));
        expect(v.canBuy).toBe(false);
        expect(v.errors.some(e => e.includes('终身限购'))).toBe(true);
      }
    }
  });
});

describe('F-Error: 无效商品ID查询', () => {
  const sys = createShop();
  it('getGoodsDef/getGoodsItem/getStockInfo/calculateFinalPrice 对无效ID', () => {
    expect(sys.getGoodsDef('')).toBeUndefined();
    expect(sys.getGoodsDef('nonexistent')).toBeUndefined();
    expect(sys.getGoodsItem('normal', '')).toBeUndefined();
    expect(sys.getStockInfo('normal', 'nonexistent')).toBeNull();
    expect(sys.calculateFinalPrice('nonexistent', 'normal')).toEqual({});
  });
});

describe('F-Error: 刷新次数耗尽', () => {
  it('超过每日上限后失败', () => {
    const sys = createShop();
    for (let i = 0; i < DAILY_MANUAL_REFRESH_LIMIT; i++) expect(sys.manualRefresh().success).toBe(true);
    const r = sys.manualRefresh();
    expect(r.success).toBe(false);
    expect(r.reason).toContain('刷新次数已用完');
  });
});

describe('F-Error: 无货币操作时', () => {
  it('未注入 currencyOps 时仍可校验和购买（跳过货币检查）', () => {
    const sys = createShop();
    const gid = cheapCopperGoods()!;
    expect(sys.validateBuy(buyReq(gid, 1)).canBuy).toBe(true);
    expect(sys.executeBuy(buyReq(gid, 1)).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('F-Boundary: 购买数量边界', () => {
  const sys = createShop(richCurrencyOps());
  const gid = SHOP_GOODS_IDS.normal[0];
  it.each([
    [0, '正整数'], [-1, '正整数'], [NaN, '正整数'], [1.5, '正整数'], [Infinity, '正整数'],
  ])('数量=%p → canBuy=false', (qty, _msg) => {
    expect(sys.validateBuy(buyReq(gid, qty)).canBuy).toBe(false);
  });
  it('数量=1 → 正常通过', () => {
    expect(sys.validateBuy(buyReq(gid, 1)).canBuy).toBe(true);
  });
});

describe('F-Boundary: 确认级别阈值', () => {
  it('低价商品 → confirmLevel=low', () => {
    // 200铜钱 > 0(none) 但 ≤ 1000(low)
    expect(createShop(richCurrencyOps()).validateBuy(buyReq('res_grain_small', 1)).confirmLevel).toBe('low');
  });
  it('高价商品 → confirmLevel=critical', () => {
    // 298元宝 → 298000铜钱 > 100000
    expect(createShop(richCurrencyOps()).validateBuy(buyReq('spd_vip_pack', 1, 'vip')).confirmLevel).toBe('critical');
  });
});

describe('F-Boundary: 库存特殊值', () => {
  it('常驻=-1 / 随机=5 / 折扣=3 / 限时=1', () => {
    expect(PERMANENT_GOODS_STOCK).toBe(-1);
    expect(RANDOM_GOODS_STOCK).toBe(5);
    expect(DISCOUNT_GOODS_STOCK).toBe(3);
    expect(LIMITED_GOODS_STOCK).toBe(1);
  });
});

describe('F-Boundary: 折扣边界与商店等级', () => {
  it('折扣率1.0无折扣 / discount类型有初始折扣', () => {
    const sys = createShop();
    expect(sys.calculateFinalPrice('res_grain_small', 'normal').copper).toBe(200);
    const dg = SHOP_GOODS_IDS.normal.find(g => GOODS_DEF_MAP[g]?.goodsType === 'discount');
    if (dg) expect(sys.getGoodsItem('normal', dg)!.discount).toBeLessThanOrEqual(1);
  });

  it('默认等级1 / setShopLevel更新', () => {
    const sys = createShop();
    for (const t of SHOP_TYPES) expect(sys.getShopLevel(t)).toBe(1);
    sys.setShopLevel('normal', 3);
    expect(sys.getShopLevel('normal')).toBe(3);
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互
// ═══════════════════════════════════════════════

describe('F-Cross: 购买→货币扣除→事件触发', () => {
  it('购买成功时货币被扣除', () => {
    const bal = { copper: 10000 };
    createShop(currencyWithBalance(bal)).executeBuy(buyReq('res_grain_small', 2));
    expect(bal.copper).toBe(10000 - 200 * 2);
  });

  it('购买失败时货币不被扣除', () => {
    const bal = { copper: 50 };
    createShop(currencyWithBalance(bal)).executeBuy(buyReq('res_grain_small', 1));
    expect(bal.copper).toBe(50);
  });

  it('购买成功触发完整事件', () => {
    const deps = mockDeps();
    const sys = new ShopSystem(); sys.init(deps); sys.setCurrencyOps(richCurrencyOps());
    sys.executeBuy(buyReq('res_grain_small', 3));
    expect(deps.eventBus.emit).toHaveBeenCalledTimes(1);
    const [evt, payload] = (deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(evt).toBe('shop:goods_purchased');
    expect(payload).toEqual(expect.objectContaining({ goodsId: 'res_grain_small', quantity: 3, shopType: 'normal' }));
  });

  it('购买失败不触发事件', () => {
    const deps = mockDeps();
    const sys = new ShopSystem(); sys.init(deps); sys.setCurrencyOps(poorCurrencyOps());
    sys.executeBuy(buyReq('res_grain_small', 1));
    expect(deps.eventBus.emit).not.toHaveBeenCalled();
  });
});

describe('F-Cross: 折扣叠加→购买价格联动', () => {
  it('NPC+限时+商品折扣取最低', () => {
    const sys = createShop(richCurrencyOps());
    sys.setNPCDiscountProvider(() => 0.85);
    sys.addDiscount({ type: 'limited_sale', rate: 0.6, startTime: Date.now() - 1000, endTime: Date.now() + 100000, applicableGoods: ['res_grain_small'] });
    expect(sys.calculateFinalPrice('res_grain_small', 'normal', 'npc1').copper).toBe(Math.ceil(200 * 0.6));
  });

  it('折扣在购买中生效', () => {
    const bal = { copper: 150 };
    const sys = createShop(currencyWithBalance(bal));
    sys.addDiscount({ type: 'limited_sale', rate: 0.5, startTime: Date.now() - 1000, endTime: Date.now() + 100000, applicableGoods: ['res_grain_small'] });
    expect(sys.executeBuy(buyReq('res_grain_small', 1)).cost!.copper).toBe(100);
  });
});

describe('F-Cross: 刷新→商品重置→收藏联动', () => {
  it('手动刷新后购买计数清零', () => {
    const sys = createShop(richCurrencyOps());
    sys.manualRefresh();
    for (const i of sys.getShopGoods('normal')) expect(i.dailyPurchased).toBe(0);
  });

  it('收藏商品在 favoritesOnly 过滤中显示 + 默认排序优先', () => {
    const sys = createShop();
    sys.toggleFavorite('res_grain_small');
    expect(sys.filterGoods('normal', { favoritesOnly: true }).some(r => r.defId === 'res_grain_small')).toBe(true);
    const sorted = sys.filterGoods('normal', { sortBy: 'default' });
    const favIdx = sorted.findIndex(r => r.defId === 'res_grain_small');
    const nonFavIdx = sorted.findIndex(r => !sys.isFavorite(r.defId));
    if (nonFavIdx !== -1 && favIdx !== -1) expect(favIdx).toBeLessThan(nonFavIdx);
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 数据生命周期
// ═══════════════════════════════════════════════

describe('F-Lifecycle: 序列化/反序列化', () => {
  it('正常数据往返一致', () => {
    const sys = createShop(richCurrencyOps());
    sys.toggleFavorite('res_grain_small');
    sys.setShopLevel('normal', 3);
    const gid = cheapCopperGoods()!;
    sys.executeBuy(buyReq(gid, 1));

    const saved = sys.serialize();
    expect(saved.version).toBe(SHOP_SAVE_VERSION);
    expect(saved.favorites).toContain('res_grain_small');

    const sys2 = createShop();
    sys2.deserialize(saved);
    expect(sys2.isFavorite('res_grain_small')).toBe(true);
    expect(sys2.getShopLevel('normal')).toBe(3);
    expect(sys2.getGoodsItem('normal', gid)!.dailyPurchased).toBe(1);
  });

  it('版本不匹配仍能加载', () => {
    const sys = createShop();
    expect(() => sys.deserialize({ shops: {} as Record<ShopType, ShopState>, favorites: [], version: 999 })).not.toThrow();
  });

  it('空存档反序列化不崩溃', () => {
    const sys = createShop();
    expect(() => sys.deserialize({ shops: {} as Record<ShopType, ShopState>, favorites: [], version: SHOP_SAVE_VERSION })).not.toThrow();
  });
});

describe('F-Lifecycle: reset / update / 离线补货', () => {
  it('reset 后所有商店恢复初始状态', () => {
    const sys = createShop(richCurrencyOps());
    sys.toggleFavorite('res_grain_small');
    sys.setShopLevel('normal', 5);
    const gid = cheapCopperGoods()!;
    sys.executeBuy(buyReq(gid, 1));
    sys.reset();
    expect(sys.isFavorite('res_grain_small')).toBe(false);
    expect(sys.getFavorites()).toHaveLength(0);
    for (const t of SHOP_TYPES) {
      expect(sys.getShopLevel(t)).toBe(1);
      for (const i of sys.getShopGoods(t)) expect(i.dailyPurchased).toBe(0);
    }
  });

  it('update / processOfflineRestock 不抛异常', () => {
    const sys = createShop();
    expect(() => sys.update(1)).not.toThrow();
    expect(() => sys.processOfflineRestock()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════
// 负数注入 / 非法值 / 重复操作对抗
// ═══════════════════════════════════════════════

describe('负数注入对抗', () => {
  it('负数数量不导致负库存', () => {
    const sys = createShop(richCurrencyOps());
    const gid = SHOP_GOODS_IDS.normal[0];
    sys.executeBuy(buyReq(gid, -5));
    const item = sys.getGoodsItem('normal', gid)!;
    expect(item.dailyPurchased).toBe(0);
    expect(item.lifetimePurchased).toBe(0);
  });

  it('零数量不改变状态', () => {
    const sys = createShop(richCurrencyOps());
    const gid = SHOP_GOODS_IDS.normal[0];
    const before = sys.getGoodsItem('normal', gid)!;
    sys.executeBuy(buyReq(gid, 0));
    const after = sys.getGoodsItem('normal', gid)!;
    expect(after.dailyPurchased).toBe(before.dailyPurchased);
    expect(after.lifetimePurchased).toBe(before.lifetimePurchased);
  });
});

describe('重复购买对抗', () => {
  it('有限库存商品买空后再次购买失败', () => {
    const sys = createShop(richCurrencyOps());
    const gid = SHOP_GOODS_IDS.normal.find(g => GOODS_DEF_MAP[g]?.goodsType === 'random');
    if (gid) {
      const stock = sys.getGoodsItem('normal', gid)!.stock;
      if (stock > 0 && stock !== -1) {
        expect(sys.executeBuy(buyReq(gid, stock)).success).toBe(true);
        expect(sys.executeBuy(buyReq(gid, 1)).success).toBe(false);
      }
    }
  });
});

describe('getGoodsByCategory / setCurrencySystem 兼容', () => {
  it('各分类均有返回', () => {
    const sys = createShop();
    for (const cat of Object.keys(GOODS_CATEGORY_LABELS) as GoodsCategory[]) {
      expect(Array.isArray(sys.getGoodsByCategory('normal', cat))).toBe(true);
    }
  });

  it('deprecated setCurrencySystem 仍可用', () => {
    const sys = createShop();
    sys.setCurrencySystem({ checkAffordability: () => ({ canAfford: true, shortages: [] }), spendByPriority: () => ({}) });
    expect(sys.executeBuy(buyReq(cheapCopperGoods()!, 1)).success).toBe(true);
  });
});

describe('批量购买价格计算', () => {
  it('总价 = 单价 × 数量', () => {
    const bal = { copper: 10000 };
    createShop(currencyWithBalance(bal)).executeBuy(buyReq('res_grain_small', 5));
    expect(bal.copper).toBe(10000 - 200 * 5);
  });

  it('折扣商品总价 = 折后单价 × 数量', () => {
    const sys = createShop(richCurrencyOps());
    sys.addDiscount({ type: 'limited_sale', rate: 0.8, startTime: Date.now() - 1000, endTime: Date.now() + 100000, applicableGoods: ['res_grain_small'] });
    expect(sys.executeBuy(buyReq('res_grain_small', 3)).cost!.copper).toBe(Math.ceil(200 * 0.8) * 3);
  });
});
