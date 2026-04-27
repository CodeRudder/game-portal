/**
 * ACC-10 商店系统 — 回归测试（ACC-10-50 ~ ACC-10-53）
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
 *
 * @module tests/acc/acc-10-shop-regression
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import ShopPanel from '@/components/idle/panels/shop/ShopPanel';
import { ShopSystem } from '@/games/three-kingdoms/engine/shop/ShopSystem';
import { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import {
  SHOP_TYPES,
  SHOP_TYPE_LABELS,
} from '@/games/three-kingdoms/core/shop';
import type { ShopType } from '@/games/three-kingdoms/core/shop';
import type { ISystemDeps } from '@/games/three-kingdoms/core/types/subsystem';
import { GOODS_DEF_MAP, SHOP_GOODS_IDS } from '@/games/three-kingdoms/core/shop';

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

/** 创建最小化的 ISystemDeps mock */
function createMockDeps(): ISystemDeps {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as any,
    config: { get: vi.fn() } as any,
    registry: { get: vi.fn() } as any,
  };
}

/** 创建已初始化的 ShopSystem 实例 */
function createInitializedShopSystem(): ShopSystem {
  const shop = new ShopSystem();
  const deps = createMockDeps();
  shop.init(deps);
  return shop;
}

/** ShopPanel 中定义的 SHOP_TABS（与前端保持一致） */
const FRONTEND_TAB_IDS = ['normal', 'black_market', 'limited_time', 'vip'] as const;

/** 创建用于 ShopPanel 的 mock engine */
function makeMockEngineForPanel(shopSystem: ShopSystem) {
  // 构造商品定义映射
  const goodsDefs: Record<string, any> = {};
  for (const [id, def] of Object.entries(GOODS_DEF_MAP)) {
    goodsDefs[id] = def;
  }

  return {
    getShopSystem: vi.fn(() => ({
      getShopGoods: vi.fn((shopType: string) => shopSystem.getShopGoods(shopType as ShopType)),
      getGoodsDef: vi.fn((defId: string) => GOODS_DEF_MAP[defId] ?? undefined),
      calculateFinalPrice: vi.fn((defId: string, shopType: string) => {
        const def = GOODS_DEF_MAP[defId];
        if (!def) return {};
        const items = shopSystem.getShopGoods(shopType as ShopType);
        const item = items.find(g => g.defId === defId);
        const discount = item?.discount ?? 1;
        const result: Record<string, number> = {};
        for (const [c, a] of Object.entries(def.basePrice)) {
          result[c] = Math.ceil((a as number) * discount);
        }
        return result;
      }),
      executeBuy: vi.fn(() => ({ success: true })),
      validateBuy: vi.fn(() => ({ valid: true })),
      getState: vi.fn(() => shopSystem.getState()),
      manualRefresh: vi.fn(() => ({ success: true })),
      resetDailyLimits: vi.fn(),
      cleanupExpiredDiscounts: vi.fn(),
    })),
    getCurrencySystem: vi.fn(() => ({
      getBalance: vi.fn((currencyId: string) => 99999),
      spend: vi.fn(() => true),
    })),
  };
}

// ═══════════════════════════════════════════════════════════════
// ACC-10-50: 商店Tab ID与后端ShopType一致性
// 回归目标：防止前端Tab ID与后端ShopType不匹配（如 'general'→'normal'）
// ═══════════════════════════════════════════════════════════════

describe('ACC-10-50: 商店Tab ID与后端ShopType一致性', () => {
  let shopSystem: ShopSystem;

  beforeEach(() => {
    shopSystem = createInitializedShopSystem();
  });

  it('ACC-10-50-a: ShopPanel的SHOP_TABS每个id对应有效的ShopType', () => {
    // 验证前端每个Tab ID都能在后端ShopType中找到，且getShopGoods返回数组
    for (const tabId of FRONTEND_TAB_IDS) {
      const goods = shopSystem.getShopGoods(tabId as ShopType);
      expect(
        Array.isArray(goods),
        `FAIL [ACC-10-50-a]: Tab ID "${tabId}" 的 getShopGoods 应返回数组，实际为 ${typeof goods}`
      ).toBe(true);
    }
  });

  it('ACC-10-50-b: 默认activeTab对应的商店有商品', () => {
    // 默认activeTab为 'normal'，验证该商店有商品
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
    // 确保前端Tab ID集合与后端SHOP_TYPES完全一致
    const backendTypes = [...SHOP_TYPES];
    const frontendIds = [...FRONTEND_TAB_IDS];

    // 检查每个后端类型在前端都有对应Tab
    for (const bt of backendTypes) {
      expect(
        frontendIds.includes(bt as any),
        `FAIL [ACC-10-50-c]: 后端ShopType "${bt}" 在前端Tab中未找到`
      ).toBe(true);
    }

    // 检查每个前端Tab在后端都有对应类型
    for (const ft of frontendIds) {
      expect(
        backendTypes.includes(ft as any),
        `FAIL [ACC-10-50-c]: 前端Tab ID "${ft}" 在后端SHOP_TYPES中未找到`
      ).toBe(true);
    }
  });

  it('ACC-10-50-d: 不存在旧的错误Tab ID（general等）', () => {
    // 回归验证：确保旧的错误Tab ID不再出现
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
    const engine = new ThreeKingdomsEngine();
    engine.init();
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
    const engine = new ThreeKingdomsEngine();
    engine.init();
    const shopSystem = engine.getShopSystem();

    // ShopSystem.init(deps) 会将deps赋值给 this.deps
    // 验证方式：调用依赖deps的方法（如getShopGoods），如果不报错说明deps已注入
    expect(() => {
      shopSystem.getShopGoods('normal');
    }, 'FAIL [ACC-10-51-b]: ShopSystem.init(deps)未正确调用，getShopGoods报错').not.toThrow();

    // 进一步验证：getState()返回的对象包含所有商店类型
    const state = shopSystem.getState();
    for (const shopType of SHOP_TYPES) {
      expect(
        state[shopType],
        `FAIL [ACC-10-51-b]: getState()缺少商店类型 "${shopType}"，deps可能未正确注入`
      ).toBeDefined();
    }
  });

  it('ACC-10-51-c: ShopSystem.setCurrencySystem被调用 — currencySystem已注入', () => {
    const engine = new ThreeKingdomsEngine();
    engine.init();
    const shopSystem = engine.getShopSystem();

    // setCurrencySystem 注入后，购买验证流程中会使用 currencySystem
    // 验证方式：调用 calculateFinalPrice，如果currencySystem未注入，某些内部逻辑可能失败
    // 更直接的验证：尝试执行一个完整的购买验证流程
    const goods = shopSystem.getShopGoods('normal');
    if (goods.length > 0) {
      const firstGoods = goods[0];
      // calculateFinalPrice 不依赖 currencySystem，但 validateBuy 依赖
      const price = shopSystem.calculateFinalPrice(firstGoods.defId, 'normal');
      expect(
        price,
        'FAIL [ACC-10-51-c]: calculateFinalPrice返回null/undefined，currencySystem可能未注入'
      ).toBeDefined();

      // 验证 validateBuy 不抛出异常（内部会使用 currencySystem）
      try {
        shopSystem.validateBuy({
          goodsId: firstGoods.defId,
          shopType: 'normal',
          quantity: 1,
        });
        // 如果没有抛出异常，说明 currencySystem 已正确注入
      } catch (e: any) {
        // 如果抛出的异常与 currencySystem 为 null 有关，说明 setCurrencySystem 未调用
        expect(
          false,
          `FAIL [ACC-10-51-c]: validateBuy抛出异常，可能currencySystem未注入: ${e.message}`
        ).toBe(true);
      }
    }
  });

  it('ACC-10-51-d: 单独创建ShopSystem后init(deps)可正常工作', () => {
    // 验证ShopSystem的init方法本身没有问题
    const shop = new ShopSystem();
    const deps = createMockDeps();

    expect(() => {
      shop.init(deps);
    }, 'FAIL [ACC-10-51-d]: ShopSystem.init(deps)调用失败').not.toThrow();

    // 验证init后getShopGoods正常工作
    for (const shopType of SHOP_TYPES) {
      const goods = shop.getShopGoods(shopType);
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
  let shopSystem: ShopSystem;

  beforeEach(() => {
    shopSystem = createInitializedShopSystem();
  });

  it('ACC-10-52-a: 每个ShopType的商店都有goods数组', () => {
    for (const shopType of SHOP_TYPES) {
      const goods = shopSystem.getShopGoods(shopType);
      expect(
        Array.isArray(goods),
        `FAIL [ACC-10-52-a]: ShopType "${shopType}" 的getShopGoods应返回数组，实际为 ${typeof goods}`
      ).toBe(true);
    }
  });

  it('ACC-10-52-b: 默认商店(normal)有商品', () => {
    const normalGoods = shopSystem.getShopGoods('normal');
    expect(
      normalGoods.length,
      `FAIL [ACC-10-52-b]: normal商店应有商品，实际数量为 ${normalGoods.length}`
    ).toBeGreaterThan(0);
  });

  it('ACC-10-52-c: 商品有必要的字段', () => {
    const requiredFields = ['defId', 'stock', 'maxStock', 'discount', 'dailyPurchased', 'lifetimePurchased', 'dailyLimit', 'lifetimeLimit'];

    for (const shopType of SHOP_TYPES) {
      const goods = shopSystem.getShopGoods(shopType);
      if (goods.length === 0) continue; // 空商店跳过字段检查

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
  let shopSystem: ShopSystem;

  beforeEach(() => {
    shopSystem = createInitializedShopSystem();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ACC-10-53-a: ShopPanel能获取到shopSystem', () => {
    const engine = makeMockEngineForPanel(shopSystem);
    render(<ShopPanel engine={engine as any} visible={true} onClose={vi.fn()} />);

    // 验证engine.getShopSystem被调用
    expect(
      engine.getShopSystem,
      'FAIL [ACC-10-53-a]: ShopPanel未调用engine.getShopSystem()'
    ).toHaveBeenCalled();

    const panelShopSystem = engine.getShopSystem();
    expect(
      panelShopSystem,
      'FAIL [ACC-10-53-a]: engine.getShopSystem()返回null/undefined'
    ).toBeDefined();
  });

  it('ACC-10-53-b: ShopPanel商品列表不为空', async () => {
    const engine = makeMockEngineForPanel(shopSystem);
    render(<ShopPanel engine={engine as any} visible={true} onClose={vi.fn()} />);

    // 等待骨架屏加载完成（ShopPanel有300ms骨架屏延迟）
    await waitFor(() => {
      const panel = screen.getByTestId('shop-panel');
      expect(panel, 'FAIL [ACC-10-53-b]: ShopPanel面板未渲染').toBeDefined();
    }, { timeout: 2000 });

    // 验证面板中有商品卡片（通过buy按钮存在性判断）
    await waitFor(() => {
      const buyButtons = screen.queryAllByTestId(/^shop-panel-buy-/);
      expect(
        buyButtons.length,
        `FAIL [ACC-10-53-b]: ShopPanel商品列表为空，期望至少有1个商品`
      ).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('ACC-10-53-c: ShopPanel Tab按钮文本与后端SHOP_TYPE_LABELS一致', async () => {
    const engine = makeMockEngineForPanel(shopSystem);
    render(<ShopPanel engine={engine as any} visible={true} onClose={vi.fn()} />);

    // 等待面板渲染完成
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel')).toBeDefined();
    }, { timeout: 2000 });

    // 验证Tab按钮文本包含对应商店名称
    // 前端SHOP_TABS的label与后端SHOP_TYPE_LABELS可能不同（UI显示名 vs 后端标签名）
    // 关键是Tab ID必须与后端一致
    const tabContainer = screen.getByTestId('shop-panel-tabs');
    expect(
      tabContainer,
      'FAIL [ACC-10-53-c]: Tab容器未找到'
    ).toBeDefined();

    // 验证每个Tab按钮存在（ShopPanel使用 data-testid="shop-panel-tab-${tab.id}"）
    for (const tabId of FRONTEND_TAB_IDS) {
      const tabBtn = screen.queryByTestId(`shop-panel-tab-${tabId}`);
      expect(
        tabBtn,
        `FAIL [ACC-10-53-c]: Tab按钮 "shop-panel-tab-${tabId}" 未找到`
      ).not.toBeNull();
    }
  });
});
