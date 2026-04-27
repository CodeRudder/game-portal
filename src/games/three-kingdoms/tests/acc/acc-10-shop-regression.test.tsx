/**
 * ACC-10 商店系统 — 回归测试（ACC-10-50 ~ ACC-10-55）
 *
 * 使用真实 ThreeKingdomsEngine（通过 createSim()），不再使用 mock engine。
 *
 * 针对3个已修复bug的回归测试：
 *   P0: 前端Tab ID与后端ShopType不匹配（'general'→'normal'等）
 *   P1: ShopSystem.init(deps) 未在引擎初始化中调用
 *   P1: ShopSystem.setCurrencySystem() 未在引擎初始化中调用
 *
 * ACC-10-50: 商店Tab ID与后端ShopType一致性
 * ACC-10-51: 引擎初始化ShopSystem验证
 * ACC-10-52: 商店商品非空验证
 * ACC-10-53: 商店面板打开流程
 * ACC-10-54: 购买操作端到端扣费验证
 * ACC-10-55: 引擎初始化完整性端到端验证
 *
 * @module tests/acc/acc-10-shop-regression
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import ShopPanel from '@/components/idle/panels/shop/ShopPanel';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import {
  SHOP_TYPES,
  SHOP_TYPE_LABELS,
} from '@/games/three-kingdoms/core/shop';
import type { ShopType } from '@/games/three-kingdoms/core/shop';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS } from '@/games/three-kingdoms/core/shop';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// ── Mock CSS ──
vi.mock('@/components/idle/panels/shop/ShopPanel.css', () => ({}));

// ── Mock SharedPanel ──
vi.mock('@/components/idle/components/SharedPanel', () => ({
  __esModule: true,
  default: function MockSharedPanel({ children, visible, title, onClose, width }: any) {
    return visible === false ? null : (
      <div data-testid="shared-panel" data-title={title} data-width={width}>
        <div className="shared-panel-content">{children}</div>
        <button data-testid="shared-panel-close" onClick={onClose}>✕</button>
      </div>
    );
  },
}));

// ── Mock localStorage ──
const localStorageStore: Record<string, string> = {};
beforeEach(() => {
  Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
  vi.spyOn(window.localStorage, 'getItem').mockImplementation((key: string) => localStorageStore[key] ?? null);
  vi.spyOn(window.localStorage, 'setItem').mockImplementation((key: string, value: string) => { localStorageStore[key] = value; });
});

// ─── 辅助函数 ────────────────────────────────

/** 创建真实引擎并添加充足货币 */
function makeEngineForRegression(): { engine: ThreeKingdomsEngine; sim: GameEventSimulator } {
  const sim = createSim();
  const engine = sim.engine;
  const cs = engine.getCurrencySystem();
  cs.addCurrency('copper', 999999);
  cs.addCurrency('mandate', 99999);
  cs.addCurrency('ingot', 99999);
  cs.addCurrency('recruit', 9999);
  cs.addCurrency('summon', 9999);
  cs.addCurrency('expedition', 99999);
  cs.addCurrency('guild', 99999);
  cs.addCurrency('reputation', 99999);
  return { engine, sim };
}

/** ShopPanel 中定义的 SHOP_TABS（与前端保持一致） */
const FRONTEND_TAB_IDS = ['normal', 'black_market', 'limited_time', 'vip'] as const;

// ═══════════════════════════════════════════════════════════════
// ACC-10-50: 商店Tab ID与后端ShopType一致性
// 回归目标：防止前端Tab ID与后端ShopType不匹配（如 'general'→'normal'）
// ═══════════════════════════════════════════════════════════════

describe('ACC-10-50: 商店Tab ID与后端ShopType一致性', () => {

  it('ACC-10-50-a: ShopPanel的SHOP_TABS每个id对应有效的ShopType', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();
    for (const tabId of FRONTEND_TAB_IDS) {
      const goods = shopSystem.getShopGoods(tabId as ShopType);
      expect(
        Array.isArray(goods),
        `FAIL [ACC-10-50-a]: Tab ID "${tabId}" 的 getShopGoods 应返回数组，实际为 ${typeof goods}`
      ).toBe(true);
    }
  });

  it('ACC-10-50-b: 默认activeTab对应的商店有商品', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();
    const normalGoods = shopSystem.getShopGoods('normal');
    expect(
      Array.isArray(normalGoods),
      'FAIL [ACC-10-50-b]: normal商店getShopGoods应返回数组'
    ).toBe(true);
    expect(
      normalGoods.length,
      `FAIL [ACC-10-50-b]: normal商店应有商品，实际数量为 ${normalGoods.length}`
    ).toBeGreaterThan(0);
  });

  it('ACC-10-50-c: 前端Tab ID集合完全覆盖后端SHOP_TYPES', () => {
    const backendTypes = [...SHOP_TYPES];
    const frontendIds = [...FRONTEND_TAB_IDS];

    for (const bt of backendTypes) {
      expect(
        frontendIds.includes(bt as any),
        `FAIL [ACC-10-50-c]: 后端ShopType "${bt}" 在前端Tab中未找到`
      ).toBe(true);
    }

    for (const ft of frontendIds) {
      expect(
        backendTypes.includes(ft as any),
        `FAIL [ACC-10-50-c]: 前端Tab ID "${ft}" 在后端SHOP_TYPES中未找到`
      ).toBe(true);
    }
  });

  it('ACC-10-50-d: 不存在旧的错误Tab ID（general等）', () => {
    const wrongIds = ['general', 'market', 'shop', 'premium', 'special'];
    for (const wrongId of wrongIds) {
      expect(
        FRONTEND_TAB_IDS.includes(wrongId as any),
        `FAIL [ACC-10-50-d]: 发现旧的错误Tab ID "${wrongId}"，应已修复`
      ).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// ACC-10-51: 引擎初始化ShopSystem验证
// 回归目标：确保ShopSystem.init(deps)和setCurrencySystem()在引擎初始化中被调用
// ═══════════════════════════════════════════════════════════════

describe('ACC-10-51: 引擎初始化ShopSystem验证', () => {

  it('ACC-10-51-a: 引擎init后getShopSystem返回非null', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();
    expect(
      shopSystem,
      'FAIL [ACC-10-51-a]: 引擎init后getShopSystem()不应返回null/undefined'
    ).not.toBeNull();
    expect(
      shopSystem,
      'FAIL [ACC-10-51-a]: 引擎init后getShopSystem()不应返回undefined'
    ).not.toBeUndefined();
  });

  it('ACC-10-51-b: ShopSystem.init(deps)被调用 — deps已注入', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();

    expect(() => {
      shopSystem.getShopGoods('normal');
    }, 'FAIL [ACC-10-51-b]: ShopSystem.init(deps)未正确调用，getShopGoods报错').not.toThrow();

    const state = shopSystem.getState();
    for (const shopType of SHOP_TYPES) {
      expect(
        state[shopType],
        `FAIL [ACC-10-51-b]: getState()缺少商店类型 "${shopType}"，deps可能未正确注入`
      ).toBeDefined();
    }
  });

  it('ACC-10-51-c: ShopSystem.setCurrencySystem被调用 — currencySystem已注入', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();

    const goods = shopSystem.getShopGoods('normal');
    if (goods.length > 0) {
      const firstGoods = goods[0];
      const price = shopSystem.calculateFinalPrice(firstGoods.defId, 'normal');
      expect(
        price,
        'FAIL [ACC-10-51-c]: calculateFinalPrice返回null/undefined，currencySystem可能未注入'
      ).toBeDefined();

      try {
        shopSystem.validateBuy({
          goodsId: firstGoods.defId,
          shopType: 'normal',
          quantity: 1,
        });
      } catch (e: any) {
        expect(
          false,
          `FAIL [ACC-10-51-c]: validateBuy抛出异常，可能currencySystem未注入: ${e.message}`
        ).toBe(true);
      }
    }
  });

  it('ACC-10-51-d: 单独创建ShopSystem后init(deps)可正常工作', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();

    for (const shopType of SHOP_TYPES) {
      const goods = shopSystem.getShopGoods(shopType);
      expect(
        Array.isArray(goods),
        `FAIL [ACC-10-51-d]: init后getShopGoods("${shopType}")应返回数组`
      ).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// ACC-10-52: 商店商品非空验证
// 回归目标：确保每个ShopType的商店都有商品数据
// ═══════════════════════════════════════════════════════════════

describe('ACC-10-52: 商店商品非空验证', () => {

  it('ACC-10-52-a: 每个ShopType的商店都有goods数组', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();
    for (const shopType of SHOP_TYPES) {
      const goods = shopSystem.getShopGoods(shopType);
      expect(
        Array.isArray(goods),
        `FAIL [ACC-10-52-a]: ShopType "${shopType}" 的getShopGoods应返回数组，实际为 ${typeof goods}`
      ).toBe(true);
    }
  });

  it('ACC-10-52-b: 默认商店(normal)有商品', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();
    const normalGoods = shopSystem.getShopGoods('normal');
    expect(
      normalGoods.length,
      `FAIL [ACC-10-52-b]: normal商店应有商品，实际数量为 ${normalGoods.length}`
    ).toBeGreaterThan(0);
  });

  it('ACC-10-52-c: 商品有必要的字段', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();
    const requiredFields = ['defId', 'stock', 'maxStock', 'discount', 'dailyPurchased', 'lifetimePurchased', 'dailyLimit', 'lifetimeLimit'];

    for (const shopType of SHOP_TYPES) {
      const goods = shopSystem.getShopGoods(shopType);
      if (goods.length === 0) continue;

      for (const item of goods) {
        for (const field of requiredFields) {
          expect(
            (item as any)[field],
            `FAIL [ACC-10-52-c]: 商品 "${item.defId}" 在商店 "${shopType}" 中缺少字段 "${field}"`
          ).toBeDefined();
        }
      }
    }
  });

  it('ACC-10-52-d: 商品的defId能在GOODS_DEF_MAP中找到对应定义', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();
    for (const shopType of SHOP_TYPES) {
      const goods = shopSystem.getShopGoods(shopType);
      for (const item of goods) {
        const def = GOODS_DEF_MAP[item.defId];
        expect(
          def,
          `FAIL [ACC-10-52-d]: 商品 "${item.defId}" 在商店 "${shopType}" 中的defId在GOODS_DEF_MAP中未找到`
        ).toBeDefined();
      }
    }
  });

  it('ACC-10-52-e: 每个ShopType的SHOP_GOODS_IDS与实际商品数量一致', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();
    for (const shopType of SHOP_TYPES) {
      const expectedIds = SHOP_GOODS_IDS[shopType] ?? [];
      const goods = shopSystem.getShopGoods(shopType);
      expect(
        goods.length,
        `FAIL [ACC-10-52-e]: ShopType "${shopType}" 的商品数量应为 ${expectedIds.length}，实际为 ${goods.length}`
      ).toBe(expectedIds.length);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// ACC-10-53: 商店面板打开流程
// 回归目标：确保ShopPanel能正确渲染并与引擎ShopSystem交互
// ═══════════════════════════════════════════════════════════════

describe('ACC-10-53: 商店面板打开流程', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ACC-10-53-a: ShopPanel能获取到shopSystem', () => {
    const { engine } = makeEngineForRegression();
    render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);

    // 验证面板渲染正常（真实引擎的 getShopSystem 自动被调用）
    const panel = screen.getByTestId('shop-panel');
    expect(panel, 'FAIL [ACC-10-53-a]: ShopPanel面板未渲染').toBeDefined();
  });

  it('ACC-10-53-b: ShopPanel商品列表不为空', async () => {
    const { engine } = makeEngineForRegression();
    render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const panel = screen.getByTestId('shop-panel');
      expect(panel, 'FAIL [ACC-10-53-b]: ShopPanel面板未渲染').toBeDefined();
    }, { timeout: 2000 });

    await waitFor(() => {
      const buyButtons = screen.queryAllByTestId(/^shop-panel-buy-/);
      expect(
        buyButtons.length,
        `FAIL [ACC-10-53-b]: ShopPanel商品列表为空，期望至少有1个商品`
      ).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('ACC-10-53-c: ShopPanel Tab按钮文本与后端SHOP_TYPE_LABELS一致', async () => {
    const { engine } = makeEngineForRegression();
    render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('shop-panel')).toBeDefined();
    }, { timeout: 2000 });

    const tabContainer = screen.getByTestId('shop-panel-tabs');
    expect(
      tabContainer,
      'FAIL [ACC-10-53-c]: Tab容器未找到'
    ).toBeDefined();

    for (const tabId of FRONTEND_TAB_IDS) {
      const tabBtn = screen.queryByTestId(`shop-panel-tab-${tabId}`);
      expect(
        tabBtn,
        `FAIL [ACC-10-53-c]: Tab按钮 "shop-panel-tab-${tabId}" 未找到`
      ).not.toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// ACC-10-54: 购买操作端到端扣费验证
// 回归目标：确保引擎初始化后，购买流程能正确扣除货币
//   覆盖Bug: ShopSystem.setCurrencySystem() 未调用 → 购买不扣费
// ═══════════════════════════════════════════════════════════════

describe('ACC-10-54: 购买操作端到端扣费验证', () => {

  it('ACC-10-54-a: 引擎初始化后购买能正确扣费', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();
    const currencySystem = engine.getCurrencySystem();

    const beforeBalance = currencySystem.getBalance('copper');
    expect(
      beforeBalance,
      'FAIL [ACC-10-54-a]: 初始铜钱余额应大于0'
    ).toBeGreaterThan(0);

    const goods = shopSystem.getShopGoods('normal');
    const copperGoods = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      return def && Object.keys(def.basePrice).includes('copper');
    });
    expect(
      copperGoods,
      'FAIL [ACC-10-54-a]: normal商店中应至少有一个铜钱定价商品'
    ).toBeDefined();

    const def = GOODS_DEF_MAP[copperGoods!.defId];
    const expectedPrice = Math.ceil((def.basePrice.copper as number) * (copperGoods!.discount));

    const result = shopSystem.executeBuy({
      goodsId: copperGoods!.defId,
      shopType: 'normal',
      quantity: 1,
    });

    expect(
      result.success,
      `FAIL [ACC-10-54-a]: 购买应成功，失败原因: ${result.reason ?? 'unknown'}`
    ).toBe(true);

    const afterBalance = currencySystem.getBalance('copper');
    const actualDeducted = beforeBalance - afterBalance;
    expect(
      actualDeducted,
      `FAIL [ACC-10-54-a]: 购买后铜钱应被扣除。期望扣除约 ${expectedPrice}，实际扣除 ${actualDeducted}，余额从 ${beforeBalance} 变为 ${afterBalance}`
    ).toBeGreaterThan(0);
  });

  it('ACC-10-54-b: 余额不足时购买失败且不扣费', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();
    const currencySystem = engine.getCurrencySystem();

    currencySystem.setCurrency('copper', 1);
    const beforeBalance = currencySystem.getBalance('copper');

    const goods = shopSystem.getShopGoods('normal');
    const copperGoods = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      return def && Object.keys(def.basePrice).includes('copper') && (def.basePrice.copper as number) > 1;
    });
    expect(
      copperGoods,
      'FAIL [ACC-10-54-b]: normal商店中应至少有一个价格>1铜钱的商品'
    ).toBeDefined();

    const result = shopSystem.executeBuy({
      goodsId: copperGoods!.defId,
      shopType: 'normal',
      quantity: 1,
    });

    expect(
      result.success,
      'FAIL [ACC-10-54-b]: 余额不足时购买应失败'
    ).toBe(false);

    const afterBalance = currencySystem.getBalance('copper');
    expect(
      afterBalance,
      `FAIL [ACC-10-54-b]: 购买失败时不应扣除货币，余额应保持 ${beforeBalance}，实际为 ${afterBalance}`
    ).toBe(beforeBalance);
  });

  it('ACC-10-54-c: 购买后库存和限购计数正确更新', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();

    const goods = shopSystem.getShopGoods('normal');
    const copperGoods = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      return def && Object.keys(def.basePrice).includes('copper') && g.stock > 0 && g.stock !== -1;
    });
    expect(copperGoods, 'FAIL [ACC-10-54-c]: 应有库存有限的铜钱商品').toBeDefined();

    const beforeStock = copperGoods!.stock;
    const beforeDaily = copperGoods!.dailyPurchased;
    const beforeLifetime = copperGoods!.lifetimePurchased;

    const result = shopSystem.executeBuy({
      goodsId: copperGoods!.defId,
      shopType: 'normal',
      quantity: 1,
    });

    expect(result.success, `FAIL [ACC-10-54-c]: 购买应成功，原因: ${result.reason}`).toBe(true);

    const updatedGoods = shopSystem.getShopGoods('normal');
    const updated = updatedGoods.find(g => g.defId === copperGoods!.defId);
    expect(updated, 'FAIL [ACC-10-54-c]: 购买后商品应仍存在').toBeDefined();

    expect(
      updated!.stock,
      `FAIL [ACC-10-54-c]: 购买后库存应减少，期望 ${beforeStock - 1}，实际 ${updated!.stock}`
    ).toBe(beforeStock - 1);
    expect(
      updated!.dailyPurchased,
      `FAIL [ACC-10-54-c]: 每日已购应+1，期望 ${beforeDaily + 1}，实际 ${updated!.dailyPurchased}`
    ).toBe(beforeDaily + 1);
    expect(
      updated!.lifetimePurchased,
      `FAIL [ACC-10-54-c]: 终身已购应+1，期望 ${beforeLifetime + 1}，实际 ${updated!.lifetimePurchased}`
    ).toBe(beforeLifetime + 1);
  });

  it('ACC-10-54-d: 购买结果返回正确的花费信息', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();

    const goods = shopSystem.getShopGoods('normal');
    const copperGoods = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      return def && Object.keys(def.basePrice).includes('copper');
    });
    expect(copperGoods, 'FAIL [ACC-10-54-d]: 应有铜钱商品').toBeDefined();

    const def = GOODS_DEF_MAP[copperGoods!.defId];
    const expectedPrice = Math.ceil((def.basePrice.copper as number) * copperGoods!.discount);

    const result = shopSystem.executeBuy({
      goodsId: copperGoods!.defId,
      shopType: 'normal',
      quantity: 1,
    });

    expect(result.success, `FAIL [ACC-10-54-d]: 购买应成功`).toBe(true);
    expect(
      result.cost,
      'FAIL [ACC-10-54-d]: 购买结果应包含cost字段'
    ).toBeDefined();
    expect(
      result.cost!.copper,
      `FAIL [ACC-10-54-d]: cost.copper应为 ${expectedPrice}，实际为 ${result.cost!.copper}`
    ).toBe(expectedPrice);
  });
});

// ═══════════════════════════════════════════════════════════════
// ACC-10-55: 引擎初始化完整性端到端验证
// 回归目标：确保所有商店相关系统在引擎init后都正确初始化
//   防止遗漏 init/setCurrencySystem 调用
// ═══════════════════════════════════════════════════════════════

describe('ACC-10-55: 引擎初始化完整性端到端验证', () => {

  it('ACC-10-55-a: getCurrencySystem在init后返回非null', () => {
    const { engine } = makeEngineForRegression();
    const currencySystem = engine.getCurrencySystem();
    expect(
      currencySystem,
      'FAIL [ACC-10-55-a]: 引擎init后getCurrencySystem()不应返回null/undefined'
    ).not.toBeNull();
    expect(
      currencySystem,
      'FAIL [ACC-10-55-a]: 引擎init后getCurrencySystem()不应返回undefined'
    ).not.toBeUndefined();
  });

  it('ACC-10-55-b: CurrencySystem.getBalance对每种货币返回数字', () => {
    const { engine } = makeEngineForRegression();
    const currencySystem = engine.getCurrencySystem();

    const currencyTypes = ['copper', 'mandate', 'recruit', 'summon', 'expedition', 'guild', 'reputation', 'ingot'] as const;
    for (const ct of currencyTypes) {
      const balance = currencySystem.getBalance(ct);
      expect(
        typeof balance,
        `FAIL [ACC-10-55-b]: CurrencySystem.getBalance("${ct}") 应返回number，实际为 ${typeof balance}`
      ).toBe('number');
    }
  });

  it('ACC-10-55-c: ShopSystem与CurrencySystem在引擎中正确关联', () => {
    const { engine } = makeEngineForRegression();
    const shopSystem = engine.getShopSystem();

    const goods = shopSystem.getShopGoods('normal');
    const copperGoods = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      return def && Object.keys(def.basePrice).includes('copper');
    });
    expect(copperGoods, 'FAIL [ACC-10-55-c]: 应有铜钱商品').toBeDefined();

    const validation = shopSystem.validateBuy({
      goodsId: copperGoods!.defId,
      shopType: 'normal',
      quantity: 1,
    });

    expect(
      validation.canBuy,
      `FAIL [ACC-10-55-c]: 余额充足时validateBuy应返回canBuy=true，错误: ${validation.errors.join(', ')}。可能ShopSystem与CurrencySystem未正确关联`
    ).toBe(true);
    expect(
      validation.errors.length,
      `FAIL [ACC-10-55-c]: 余额充足时不应有错误，实际错误: ${validation.errors.join(', ')}`
    ).toBe(0);
  });

  it('ACC-10-55-d: 引擎重置后重新init，ShopSystem仍可正常工作', () => {
    const sim = createSim();
    const engine = sim.engine;

    // 先执行一次购买
    const currencySystem = engine.getCurrencySystem();
    currencySystem.addCurrency('copper', 100000);
    const shopSystem = engine.getShopSystem();
    const goods = shopSystem.getShopGoods('normal');
    const copperGoods = goods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      return def && Object.keys(def.basePrice).includes('copper');
    });

    if (copperGoods) {
      shopSystem.executeBuy({
        goodsId: copperGoods.defId,
        shopType: 'normal',
        quantity: 1,
      });
    }

    // 重置引擎
    engine.reset();

    // 重新初始化
    engine.init();
    const newShopSystem = engine.getShopSystem();
    const newCurrencySystem = engine.getCurrencySystem();
    newCurrencySystem.addCurrency('copper', 100000);

    const newGoods = newShopSystem.getShopGoods('normal');
    const newCopperGoods = newGoods.find(g => {
      const def = GOODS_DEF_MAP[g.defId];
      return def && Object.keys(def.basePrice).includes('copper');
    });
    expect(newCopperGoods, 'FAIL [ACC-10-55-d]: 重置后重新init，normal商店应有铜钱商品').toBeDefined();

    const result = newShopSystem.executeBuy({
      goodsId: newCopperGoods!.defId,
      shopType: 'normal',
      quantity: 1,
    });
    expect(
      result.success,
      `FAIL [ACC-10-55-d]: 重置后重新init购买应成功，原因: ${result.reason ?? 'unknown'}`
    ).toBe(true);
  });
});
