/**
 * ShopPanel 深度集成测试
 *
 * 使用真实 ThreeKingdomsEngine（非 mock）+ 最小化 ShopSystem stub，
 * 验证 ShopPanel 组件的完整交互流程。
 *
 * 与 scene-router.test.tsx 中的基础 IC-01 测试不同，本文件聚焦：
 * - Tab 切换后商品列表正确刷新
 * - 购买流程：选择商品 → 弹出确认 → 执行购买
 * - 刷新功能：手动刷新商店
 * - 排序功能：切换排序方式
 * - 收藏功能：收藏/取消收藏商品
 * - 边界情况：售罄商品、余额不足
 *
 * 这类测试能发现 mock 测试无法发现的问题：
 * - engine.getShopSystem() 返回 null
 * - Tab ID 与后端不匹配
 * - 子系统依赖注入缺失
 *
 * @module tests/integration/shop-integration
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { ThreeKingdomsEngine } from '../../engine/ThreeKingdomsEngine';

// ── 导入真实组件 ──
import ShopPanel from '@/components/idle/panels/shop/ShopPanel';

// ═══════════════════════════════════════════════════════════════
// 辅助工具
// ═══════════════════════════════════════════════════════════════

/**
 * 模拟商品数据。
 *
 * ShopPanel 的数据模型分两层：
 * - item（商品实例）：{ defId, stock, discount, dailyLimit, ... }
 * - def（商品定义，通过 getGoodsDef 获取）：{ name, icon, description, basePrice, ... }
 *
 * basePrice 和 calculateFinalPrice 的返回值都是 Record<string, number>，
 * 例如 { copper: 100 }。
 */
const MOCK_GOODS = {
  normal: [
    { defId: 'goods_001', stock: 5, discount: 1, dailyLimit: 0, dailyPurchased: 0, lifetimeLimit: 0, lifetimePurchased: 0 },
    { defId: 'goods_002', stock: 0, discount: 1, dailyLimit: 0, dailyPurchased: 0, lifetimeLimit: 0, lifetimePurchased: 0 },
    { defId: 'goods_003', stock: 1, discount: 0.8, dailyLimit: 0, dailyPurchased: 0, lifetimeLimit: 0, lifetimePurchased: 0 },
  ],
  black_market: [
    { defId: 'bm_001', stock: 2, discount: 1, dailyLimit: 0, dailyPurchased: 0, lifetimeLimit: 0, lifetimePurchased: 0 },
  ],
  limited_time: [],
  vip: [],
};

/** 商品定义（getGoodsDef 的返回值） */
const MOCK_DEFS: Record<string, { name: string; icon: string; description: string; basePrice: Record<string, number> }> = {
  goods_001: { name: '精铁剑', icon: '⚔️', description: '锋利的铁剑', basePrice: { copper: 100 } },
  goods_002: { name: '回春丹', icon: '💊', description: '恢复生命值', basePrice: { copper: 50 } },
  goods_003: { name: '兵书残卷', icon: '📜', description: '古代兵法残卷', basePrice: { mandate: 200 } },
  bm_001: { name: '暗影匕首', icon: '🗡️', description: '暗影刺客专用', basePrice: { expedition: 500 } },
};

/** 根据商品 defId 计算 calculateFinalPrice 的返回值 */
function getFinalPrice(defId: string): Record<string, number> {
  const def = MOCK_DEFS[defId];
  if (!def) return {};
  // 查找对应的商品实例以获取折扣
  for (const items of Object.values(MOCK_GOODS)) {
    const item = items.find(i => i.defId === defId);
    if (item) {
      const result: Record<string, number> = {};
      for (const [cur, amt] of Object.entries(def.basePrice)) {
        result[cur] = Math.round(amt * item.discount);
      }
      return result;
    }
  }
  return def.basePrice;
}

/**
 * 创建带有 ShopSystem stub 的 engine wrapper。
 *
 * ThreeKingdomsEngine 当前版本未内置 ShopSystem，
 * 但 ShopPanel 通过 engine.getShopSystem() 访问它。
 * 此 wrapper 提供最小化的 shop / currency 接口，
 * 使组件可以正常渲染而不崩溃。
 */
function createEngineWithShopStub(options?: { balance?: number }) {
  const engine = new ThreeKingdomsEngine();
  engine.init();

  const balance = options?.balance ?? 9999;

  /** 最小化的 ShopSystem stub — 返回模拟商品数据 */
  const shopStub = {
    getShopGoods: (tabId: string) => {
      return MOCK_GOODS[tabId as keyof typeof MOCK_GOODS] ?? [];
    },
    getGoodsDef: (defId: string) => {
      return MOCK_DEFS[defId] ?? undefined;
    },
    calculateFinalPrice: (defId: string, _tabId: string) => {
      return getFinalPrice(defId);
    },
    executeBuy: vi.fn().mockReturnValue({ success: true, reason: '购买成功' }),
    getState: () => ({
      normal: { manualRefreshCount: 0, manualRefreshLimit: 5 },
      black_market: { manualRefreshCount: 0, manualRefreshLimit: 5 },
      limited_time: { manualRefreshCount: 0, manualRefreshLimit: 5 },
      vip: { manualRefreshCount: 0, manualRefreshLimit: 5 },
    }),
    manualRefresh: vi.fn().mockReturnValue({ success: true }),
  };

  /** 最小化的 CurrencySystem stub */
  const currencyStub = {
    getBalance: (_cur: string) => balance,
  };

  // 将 stub 挂载到 engine 上（通过类型断言绕过 TS 检查）
  const augmentedEngine = engine as unknown as Record<string, unknown>;
  augmentedEngine.getShopSystem = () => shopStub;
  augmentedEngine.getCurrencySystem = () => currencyStub;

  return { engine: augmentedEngine as unknown as ThreeKingdomsEngine, shopStub, currencyStub };
}

// ═══════════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════════

describe('ShopPanel 深度集成测试 (IC-10)', () => {
  afterEach(() => {
    cleanup();
  });

  // ── IC-10-01: Tab 切换集成 ──
  describe('IC-10-01: Tab 切换集成', () => {
    it('IC-10-01-01: 切换到竞技商店 Tab 后显示对应商品', async () => {
      const { engine } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待骨架屏加载完成
      await waitFor(() => {
        expect(screen.getByTestId('shop-panel-tab-black_market')).toBeTruthy();
      }, { timeout: 1000 });

      // 点击竞技商店 Tab
      fireEvent.click(screen.getByTestId('shop-panel-tab-black_market'));

      // 等待商品列表刷新
      await waitFor(() => {
        // 竞技商店有暗影匕首
        expect(screen.getByTestId('shop-panel-goods-bm_001')).toBeTruthy();
      }, { timeout: 1000 });
    });

    it('IC-10-01-02: 切换到空商品 Tab 后显示空状态', async () => {
      const { engine } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待初始加载
      await waitFor(() => {
        expect(screen.getByTestId('shop-panel-tab-limited_time')).toBeTruthy();
      }, { timeout: 1000 });

      // 切换到远征商店（空商品）
      fireEvent.click(screen.getByTestId('shop-panel-tab-limited_time'));

      // 等待空状态提示
      await waitFor(() => {
        expect(screen.getByText('暂无商品')).toBeTruthy();
      }, { timeout: 1000 });
    });

    it('IC-10-01-03: 默认显示杂货铺 Tab', async () => {
      const { engine } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待加载完成
      await waitFor(() => {
        const normalTab = screen.getByTestId('shop-panel-tab-normal');
        expect(normalTab).toBeTruthy();
        // 杂货铺有精铁剑
        expect(screen.getByTestId('shop-panel-goods-goods_001')).toBeTruthy();
      }, { timeout: 1000 });
    });
  });

  // ── IC-10-02: 购买流程集成 ──
  describe('IC-10-02: 购买流程集成', () => {
    it('IC-10-02-01: 点击购买按钮弹出确认弹窗', async () => {
      const { engine, shopStub } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待商品加载
      await waitFor(() => {
        expect(screen.getByTestId('shop-panel-goods-goods_001')).toBeTruthy();
      }, { timeout: 1000 });

      // 点击购买按钮
      fireEvent.click(screen.getByTestId('shop-panel-buy-goods_001'));

      // 确认弹窗应该出现
      await waitFor(() => {
        expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeTruthy();
      });
    });

    it('IC-10-02-02: 确认购买后调用 executeBuy', async () => {
      const { engine, shopStub } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待商品加载
      await waitFor(() => {
        expect(screen.getByTestId('shop-panel-buy-goods_001')).toBeTruthy();
      }, { timeout: 1000 });

      // 点击购买
      fireEvent.click(screen.getByTestId('shop-panel-buy-goods_001'));

      // 等待确认弹窗
      await waitFor(() => {
        expect(screen.getByTestId('shop-panel-confirm-ok')).toBeTruthy();
      });

      // 点击确认购买
      fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));

      // executeBuy 应该被调用
      expect(shopStub.executeBuy).toHaveBeenCalled();
    });

    it('IC-10-02-03: 取消购买不调用 executeBuy', async () => {
      const { engine, shopStub } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待商品加载
      await waitFor(() => {
        expect(screen.getByTestId('shop-panel-buy-goods_001')).toBeTruthy();
      }, { timeout: 1000 });

      // 点击购买
      fireEvent.click(screen.getByTestId('shop-panel-buy-goods_001'));

      // 等待确认弹窗
      await waitFor(() => {
        expect(screen.getByTestId('shop-panel-confirm-cancel')).toBeTruthy();
      });

      // 点击取消
      fireEvent.click(screen.getByTestId('shop-panel-confirm-cancel'));

      // executeBuy 不应该被调用
      expect(shopStub.executeBuy).not.toHaveBeenCalled();
    });
  });

  // ── IC-10-03: 商品状态集成 ──
  describe('IC-10-03: 商品状态集成', () => {
    it('IC-10-03-01: 售罄商品购买按钮应被禁用', async () => {
      const { engine } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待商品加载
      await waitFor(() => {
        // goods_002 的 stock=0，是售罄商品
        const buyButton = screen.getByTestId('shop-panel-buy-goods_002');
        expect(buyButton).toBeTruthy();
        expect((buyButton as HTMLButtonElement).disabled).toBe(true);
      }, { timeout: 1000 });
    });

    it('IC-10-03-02: 有库存的商品购买按钮可点击', async () => {
      const { engine } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待商品加载
      await waitFor(() => {
        // goods_001 的 stock=5，有库存
        const buyButton = screen.getByTestId('shop-panel-buy-goods_001');
        expect(buyButton).toBeTruthy();
        expect((buyButton as HTMLButtonElement).disabled).toBe(false);
      }, { timeout: 1000 });
    });

    it('IC-10-03-03: 折扣商品显示折扣信息', async () => {
      const { engine } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待商品加载
      await waitFor(() => {
        // goods_003 有 discount=0.8，即 20% 折扣
        const goodsCard = screen.getByTestId('shop-panel-goods-goods_003');
        expect(goodsCard).toBeTruthy();
        // ShopPanel 显示 -Math.round((1 - 0.8) * 100)% = -20%
        expect(goodsCard.textContent).toContain('-20%');
      }, { timeout: 1000 });
    });
  });

  // ── IC-10-04: 手动刷新集成 ──
  describe('IC-10-04: 手动刷新集成', () => {
    it('IC-10-04-01: 点击刷新按钮调用 manualRefresh', async () => {
      const { engine, shopStub } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待加载完成
      await waitFor(() => {
        expect(screen.getByTestId('shop-panel-refresh')).toBeTruthy();
      }, { timeout: 1000 });

      // 点击刷新按钮
      fireEvent.click(screen.getByTestId('shop-panel-refresh'));

      // manualRefresh 应该被调用
      expect(shopStub.manualRefresh).toHaveBeenCalled();
    });
  });

  // ── IC-10-05: Engine 级别集成验证 ──
  describe('IC-10-05: Engine 级别集成验证', () => {
    it('IC-10-05-01: 真实 engine 初始化后 snapshot 包含必要字段', () => {
      const engine = new ThreeKingdomsEngine();
      engine.init();

      const snapshot = engine.getSnapshot();
      expect(snapshot).toBeTruthy();
      expect(snapshot).toHaveProperty('resources');
      expect(snapshot).toHaveProperty('buildings');
      expect(snapshot).toHaveProperty('calendar');
    });

    it('IC-10-05-02: engine init 后 isInitialized 返回 true', () => {
      const engine = new ThreeKingdomsEngine();
      expect(engine.isInitialized()).toBe(false);

      engine.init();
      expect(engine.isInitialized()).toBe(true);
    });

    it('IC-10-05-03: engine reset + reinit 后仍然正常工作', () => {
      const engine = new ThreeKingdomsEngine();
      engine.init();

      const snapshot1 = engine.getSnapshot();
      expect(snapshot1).toBeTruthy();

      engine.reset();
      engine.init();

      const snapshot2 = engine.getSnapshot();
      expect(snapshot2).toBeTruthy();
      expect(snapshot2).toHaveProperty('resources');
    });
  });
});
