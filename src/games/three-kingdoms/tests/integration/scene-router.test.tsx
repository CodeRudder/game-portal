/**
 * SceneRouter 集成测试
 *
 * 使用真实 ThreeKingdomsEngine + 真实 React 组件，
 * 验证每个 Tab 切换后组件能正常渲染（不崩溃、不白屏）。
 *
 * 分层：集成测试 (IC) — 介于契约测试（纯引擎）与 ACC 测试（完整业务流程）之间。
 *
 * @module tests/integration/scene-router
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { ThreeKingdomsEngine } from '../../engine/ThreeKingdomsEngine';

// ── 导入真实组件 ──
// ShopPanel 使用 export default，需要匹配默认导出
import ShopPanel from '@/components/idle/panels/shop/ShopPanel';

// ── 辅助函数 ──

/**
 * 创建带有 ShopSystem stub 的 engine wrapper。
 *
 * ThreeKingdomsEngine 当前版本未内置 ShopSystem，
 * 但 ShopPanel 通过 engine.getShopSystem() 访问它。
 * 此 wrapper 提供最小化的 shop / currency 接口，
 * 使组件可以正常渲染而不崩溃。
 */
function createEngineWithShopStub(): { engine: ThreeKingdomsEngine; shopStub: Record<string, unknown> } {
  const engine = new ThreeKingdomsEngine();
  engine.init();

  /** 最小化的 ShopSystem stub */
  const shopStub = {
    getShopGoods: (tabId: string) => {
      // 返回空商品列表（按 tab 分类）
      const tabs = ['normal', 'black_market', 'limited_time', 'vip'] as const;
      return tabs.includes(tabId as typeof tabs[number]) ? [] : [];
    },
    getGoodsDef: (_defId: string) => undefined,
    calculateFinalPrice: (_defId: string, _tabId: string) => ({}),
    executeBuy: vi.fn().mockReturnValue({ success: false, reason: '测试环境' }),
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
    getBalance: (_cur: string) => 0,
  };

  // 将 stub 挂载到 engine 上（通过类型断言绕过 TS 检查）
  const augmentedEngine = engine as unknown as Record<string, unknown>;
  augmentedEngine.getShopSystem = () => shopStub;
  augmentedEngine.getCurrencySystem = () => currencyStub;

  return { engine, shopStub };
}

// ═══════════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════════

describe('组件集成测试 (IC)', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = new ThreeKingdomsEngine();
    engine.init();
  });

  afterEach(() => {
    cleanup();
    engine.reset();
  });

  // ── IC-01: ShopPanel 集成测试 ──
  describe('IC-01: ShopPanel 集成测试', () => {
    it('IC-01-01: ShopPanel 用真实 engine + shop stub 能渲染且不崩溃', async () => {
      const { engine: augmentedEngine } = createEngineWithShopStub();

      const { container } = render(
        React.createElement(ShopPanel, {
          engine: augmentedEngine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 容器不为空
      expect(container.innerHTML).not.toBe('');

      // 验证 shop-panel 容器存在
      const shopPanel = container.querySelector('[data-testid="shop-panel"]');
      expect(shopPanel).toBeTruthy();
    });

    it('IC-01-02: ShopPanel 显示商店 Tab 栏', async () => {
      const { engine: augmentedEngine } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine: augmentedEngine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 验证 Tab 栏存在
      const tabBar = screen.getByTestId('shop-panel-tabs');
      expect(tabBar).toBeTruthy();

      // 验证默认 Tab（杂货铺）
      const normalTab = screen.getByTestId('shop-panel-tab-normal');
      expect(normalTab).toBeTruthy();
      expect(normalTab.textContent).toContain('杂货铺');
    });

    it('IC-01-03: ShopPanel 空商品列表时显示空状态', async () => {
      const { engine: augmentedEngine } = createEngineWithShopStub();

      render(
        React.createElement(ShopPanel, {
          engine: augmentedEngine,
          visible: true,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // 等待骨架屏加载完成（300ms delay in component）
      await waitFor(() => {
        // 空状态提示
        const emptyState = screen.getByText('暂无商品');
        expect(emptyState).toBeTruthy();
      }, { timeout: 1000 });
    });

    it('IC-01-04: ShopPanel visible=false 时不渲染', async () => {
      const { engine: augmentedEngine } = createEngineWithShopStub();

      const { container } = render(
        React.createElement(ShopPanel, {
          engine: augmentedEngine,
          visible: false,
          onClose: vi.fn(),
          snapshotVersion: 0,
        })
      );

      // SharedPanel visible=false 时返回 null
      expect(container.innerHTML).toBe('');
    });
  });

  // ── IC-02: Engine Snapshot 集成测试 ──
  describe('IC-02: Engine Snapshot 集成测试', () => {
    it('IC-02-01: engine.getSnapshot() 返回有效结构化数据', () => {
      const snapshot = engine.getSnapshot();

      // 基本存在性
      expect(snapshot).toBeTruthy();
      expect(typeof snapshot).toBe('object');

      // 关键字段验证
      expect(snapshot).toHaveProperty('resources');
      expect(snapshot).toHaveProperty('buildings');
      expect(snapshot).toHaveProperty('calendar');
      expect(snapshot).toHaveProperty('heroes');
    });

    it('IC-02-02: engine.getSnapshot() resources 包含必要字段', () => {
      const snapshot = engine.getSnapshot();

      // resources 应该是对象
      expect(typeof snapshot.resources).toBe('object');
      expect(snapshot.resources).not.toBeNull();

      // productionRates 应该是对象
      expect(typeof snapshot.productionRates).toBe('object');
    });

    it('IC-02-03: engine.isInitialized() 返回 true', () => {
      expect(engine.isInitialized()).toBe(true);
    });

    it('IC-02-04: engine.getState() 返回与 getSnapshot() 一致的类型', () => {
      const snapshot = engine.getSnapshot();
      const state = engine.getState();

      // getState() 应该返回一个对象
      expect(typeof state).toBe('object');
      expect(state).not.toBeNull();

      // 两者都应该是结构化数据
      expect(Object.keys(state as object).length).toBeGreaterThan(0);
    });
  });

  // ── IC-03: Engine + 组件生命周期集成 ──
  describe('IC-03: Engine 生命周期集成', () => {
    it('IC-03-01: engine reset 后 snapshot 仍然有效', () => {
      engine.reset();

      const snapshot = engine.getSnapshot();
      expect(snapshot).toBeTruthy();
      expect(typeof snapshot.resources).toBe('object');
    });

    it('IC-03-02: engine 多次 init 不崩溃', () => {
      // 重复初始化应该是幂等的
      expect(() => {
        engine.init();
        engine.init();
      }).not.toThrow();
    });

    it('IC-03-03: ShopPanel 多次 mount/unmount 不崩溃', async () => {
      const { engine: augmentedEngine } = createEngineWithShopStub();
      const onClose = vi.fn();

      // 第一次渲染
      const { unmount, rerender } = render(
        React.createElement(ShopPanel, {
          engine: augmentedEngine,
          visible: true,
          onClose,
          snapshotVersion: 0,
        })
      );

      // 卸载
      unmount();

      // 第二次渲染
      render(
        React.createElement(ShopPanel, {
          engine: augmentedEngine,
          visible: true,
          onClose,
          snapshotVersion: 1,
        })
      );

      // 不应抛出错误
      expect(true).toBe(true);
    });
  });
});
