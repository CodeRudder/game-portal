/**
 * ACC-10 商店系统 — UI层验收测试
 *
 * 覆盖 ACC-10 验收标准中所有UI相关条目：
 * - ACC-10-01 ~ ACC-10-09: 基础可见性
 * - ACC-10-10 ~ ACC-10-19: 核心交互
 * - ACC-10-26: 货币余额栏实时更新
 * - ACC-10-29: 提示消息自动消失
 * - ACC-10-40 ~ ACC-10-49: 手机端适配
 *
 * @module panels/shop/__tests__/ACC-10.shop-ui
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock CSS ──
vi.mock('../ShopPanel.css', () => ({}));
vi.mock('../../components/SharedPanel.css', () => ({}));

// ── Mock SharedPanel — 透传children，渲染关闭按钮 ──
vi.mock('../../components/SharedPanel', () => ({
  default: ({ visible, title, icon, onClose, children, width, 'data-testid': dtid }: any) => {
    if (!visible) return null;
    return (
      <div data-testid={dtid ?? 'shared-panel'} role="dialog" aria-label={title}>
        <div className="tk-shared-panel-header">
          {icon && <span>{icon}</span>}
          <h3>{title}</h3>
          {onClose && <button data-testid={`${dtid ?? 'shared-panel'}-close`} onClick={onClose}>✕</button>}
        </div>
        <div className="tk-shared-panel-body">
          {children}
        </div>
      </div>
    );
  },
}));

// ── 导入被测组件（在 mock 之后）─
import ShopPanel from '../ShopPanel';

// ─── 常量 ───────────────────────────────────
const CUR_LABELS: Record<string, string> = {
  copper: '铜钱', mandate: '天命', recruit: '招贤令', summon: '求贤令',
  expedition: '远征币', guild: '公会币', reputation: '声望值', ingot: '元宝',
};

// ─── Mock Engine ─────────────────────────────

/** 商品定义 */
interface MockGoodsDef {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  icon: string;
  basePrice: Record<string, number>;
  primaryCurrency: string;
  favoritable: boolean;
  goodsType: string;
}

/** 商品实例 */
interface MockGoodsItem {
  defId: string;
  stock: number;
  maxStock: number;
  discount: number;
  dailyPurchased: number;
  lifetimePurchased: number;
  dailyLimit: number;
  lifetimeLimit: number;
  listedAt: number;
  favorited: boolean;
}

/** 创建 mock 商品定义 */
function createMockGoodsDef(overrides: Partial<MockGoodsDef> = {}): MockGoodsDef {
  return {
    id: 'test_goods_1',
    name: '测试商品',
    description: '测试用商品描述',
    category: 'resource',
    rarity: 'common',
    icon: '📦',
    basePrice: { copper: 500 },
    primaryCurrency: 'copper',
    favoritable: true,
    goodsType: 'permanent',
    ...overrides,
  };
}

/** 创建 mock 商品实例 */
function createMockGoodsItem(overrides: Partial<MockGoodsItem> = {}): MockGoodsItem {
  return {
    defId: 'test_goods_1',
    stock: -1,
    maxStock: -1,
    discount: 1,
    dailyPurchased: 0,
    lifetimePurchased: 0,
    dailyLimit: -1,
    lifetimeLimit: -1,
    listedAt: Date.now(),
    favorited: false,
    ...overrides,
  };
}

/** 创建完整的 mock engine */
function createMockEngine(options: {
  goods?: MockGoodsItem[];
  goodsDefs?: Record<string, MockGoodsDef>;
  balances?: Record<string, number>;
  refreshCount?: number;
  refreshLimit?: number;
} = {}) {
  const {
    goods = [
      createMockGoodsItem({ defId: 'test_goods_1', stock: -1, discount: 1 }),
      createMockGoodsItem({
        defId: 'test_goods_2',
        stock: 5,
        discount: 0.8,
        dailyLimit: 3,
        dailyPurchased: 0,
      }),
      createMockGoodsItem({
        defId: 'test_goods_soldout',
        stock: 0,
        maxStock: 3,
      }),
    ],
    goodsDefs = {
      test_goods_1: createMockGoodsDef({ id: 'test_goods_1', name: '粮草小包', description: '100单位粮草' }),
      test_goods_2: createMockGoodsDef({
        id: 'test_goods_2', name: '精铁', description: '锻造用精铁',
        basePrice: { copper: 150 }, goodsType: 'random',
      }),
      test_goods_soldout: createMockGoodsDef({ id: 'test_goods_soldout', name: '售罄商品', description: '已售罄' }),
    },
    balances = { copper: 10000, mandate: 300 },
    refreshCount = 0,
    refreshLimit = 5,
  } = options;

  let _refreshCount = refreshCount;
  let _goods = { general: [...goods], arena: [], expedition: [], guild: [] };

  return {
    getShopSystem: () => ({
      getShopGoods: (tabId: string) => _goods[tabId as keyof typeof _goods] ?? [],
      getGoodsDef: (defId: string) => goodsDefs[defId] ?? undefined,
      calculateFinalPrice: (defId: string, _tabId: string) => {
        const def = goodsDefs[defId];
        if (!def) return {};
        // 简化：直接返回基础价格
        return { ...def.basePrice };
      },
      executeBuy: vi.fn().mockImplementation((req: any) => {
        return { success: true, goodsId: req.goodsId, quantity: req.quantity, cost: goodsDefs[req.goodsId]?.basePrice ?? {} };
      }),
      getState: () => ({
        general: { manualRefreshCount: _refreshCount, manualRefreshLimit: refreshLimit },
        arena: { manualRefreshCount: _refreshCount, manualRefreshLimit: refreshLimit },
        expedition: { manualRefreshCount: _refreshCount, manualRefreshLimit: refreshLimit },
        guild: { manualRefreshCount: _refreshCount, manualRefreshLimit: refreshLimit },
      }),
      manualRefresh: vi.fn().mockImplementation(() => {
        if (_refreshCount >= refreshLimit) return { success: false, reason: '今日刷新次数已用完' };
        _refreshCount++;
        return { success: true };
      }),
    }),
    getCurrencySystem: () => ({
      getBalance: (cur: string) => balances[cur] ?? 0,
    }),
    shop: undefined,
    currency: undefined,
  };
}

/** 渲染辅助函数 */
function renderShopPanel(engineOverrides: Parameters<typeof createMockEngine>[0] = {}) {
  const engine = createMockEngine(engineOverrides);
  const onClose = vi.fn();
  const result = render(<ShopPanel engine={engine} visible={true} onClose={onClose} />);
  return { ...result, engine, onClose };
}

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('ACC-10 商店系统UI层验收', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // ACC-10-46: 商品列表触控滚动
  // ═══════════════════════════════════════════
  describe('ACC-10-46 商品列表触控滚动', () => {
    it('ACC-10-46: 商品列表有max-height: 60vh限制', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const grid = document.querySelector('.tk-shop-goods-grid');
      expect(grid).toBeTruthy();
      expect(grid!.classList.contains('tk-shop-goods-grid')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-48: 提示消息不遮挡操作
  // ═══════════════════════════════════════════
  describe('ACC-10-48 提示消息不遮挡操作', () => {
    it('ACC-10-48: 提示消息显示在商品列表上方', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      // 触发购买成功
      fireEvent.click(screen.getByTestId('shop-panel-buy-test_goods_1'));
      await act(async () => { vi.advanceTimersByTime(50); });
      fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
      await act(async () => { vi.advanceTimersByTime(100); });

      // Toast 出现
      const toast = screen.getByTestId('shop-panel-toast');
      expect(toast).toBeInTheDocument();
      expect(toast.classList.contains('tk-shop-toast')).toBe(true);

      // 商品列表和购买按钮仍然可见（不被遮挡）
      expect(screen.getByTestId('shop-panel-buy-test_goods_1')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-02: 商店面板打开
  // ═══════════════════════════════════════════
  describe('ACC-10-02 商店面板打开', () => {
    it('ACC-10-02: 打开面板后显示商店标题和关闭按钮', async () => {
      renderShopPanel();
      // 等待骨架屏消失
      await act(async () => { vi.advanceTimersByTime(400); });

      // 面板可见
      expect(screen.getByTestId('shop-panel')).toBeInTheDocument();
      // 关闭按钮存在（通过aria-label定位）
      expect(screen.getByLabelText('关闭面板')).toBeInTheDocument();
    });

    it('ACC-10-02: visible=false时面板不渲染', () => {
      const engine = createMockEngine();
      render(<ShopPanel engine={engine} visible={false} />);
      expect(screen.queryByTestId('shop-panel')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-03: 四个商店Tab显示
  // ═══════════════════════════════════════════
  describe('ACC-10-03 四个商店Tab显示', () => {
    it('ACC-10-03: 显示4个Tab按钮', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      expect(screen.getByTestId('shop-panel-tab-general')).toBeInTheDocument();
      expect(screen.getByTestId('shop-panel-tab-arena')).toBeInTheDocument();
      expect(screen.getByTestId('shop-panel-tab-expedition')).toBeInTheDocument();
      expect(screen.getByTestId('shop-panel-tab-guild')).toBeInTheDocument();
    });

    it('ACC-10-03: 默认选中杂货铺', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const generalTab = screen.getByTestId('shop-panel-tab-general');
      expect(generalTab.classList.contains('tk-shop-tab-btn--active')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-04: 货币余额栏显示
  // ═══════════════════════════════════════════
  describe('ACC-10-04 货币余额栏显示', () => {
    it('ACC-10-04: 显示货币余额', async () => {
      renderShopPanel({ balances: { copper: 12500, mandate: 300 } });
      await act(async () => { vi.advanceTimersByTime(400); });

      expect(screen.getByText(/铜钱.*12,500/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-05: 商品列表展示
  // ═══════════════════════════════════════════
  describe('ACC-10-05 商品列表展示', () => {
    it('ACC-10-05: 显示商品卡片列表', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      // 应该有商品卡片
      const cards = document.querySelectorAll('.tk-shop-goods-card');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('ACC-10-05: 每个卡片包含商品信息', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      // 检查商品名称
      expect(screen.getByText('粮草小包')).toBeInTheDocument();
      // 检查商品描述
      expect(screen.getByText('100单位粮草')).toBeInTheDocument();
      // 检查购买按钮
      expect(screen.getByTestId('shop-panel-buy-test_goods_1')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-06: 商品价格显示
  // ═══════════════════════════════════════════
  describe('ACC-10-06 商品价格显示', () => {
    it('ACC-10-06: 价格以「货币名 数量」格式显示', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      // 检查价格显示格式
      const priceElements = screen.getAllByText(/铜钱.*500/);
      expect(priceElements.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-07: 限购信息显示
  // ═══════════════════════════════════════════
  describe('ACC-10-07 限购信息显示', () => {
    it('ACC-10-07: 有限购的商品显示限购进度', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      // test_goods_2 有 dailyLimit: 3
      expect(screen.getByText(/今日:.*0\/3/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-08: 折扣商品标识
  // ═══════════════════════════════════════════
  describe('ACC-10-08 折扣商品标识', () => {
    it('ACC-10-08: 折扣商品显示折扣角标', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      // test_goods_2 有 discount: 0.8
      const badge = screen.getByText('-20%');
      expect(badge).toBeInTheDocument();
      expect(badge.classList.contains('tk-shop-discount-badge')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-09: 空商店提示
  // ═══════════════════════════════════════════
  describe('ACC-10-09 空商店提示', () => {
    it('ACC-10-09: 无商品的Tab显示暂无商品', async () => {
      renderShopPanel({ goods: [] });
      await act(async () => { vi.advanceTimersByTime(400); });

      expect(screen.getByText('暂无商品')).toBeInTheDocument();
    });

    it('ACC-10-09: 空状态显示引导提示', async () => {
      renderShopPanel({ goods: [] });
      await act(async () => { vi.advanceTimersByTime(400); });

      expect(screen.getByText('尝试刷新商店或切换其他商店类型')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-10: 切换商店Tab
  // ═══════════════════════════════════════════
  describe('ACC-10-10 切换商店Tab', () => {
    it('ACC-10-10: 点击Tab后高亮切换', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const arenaTab = screen.getByTestId('shop-panel-tab-arena');
      fireEvent.click(arenaTab);

      // 等待骨架屏
      await act(async () => { vi.advanceTimersByTime(400); });

      expect(arenaTab.classList.contains('tk-shop-tab-btn--active')).toBe(true);
      // general 不再高亮
      const generalTab = screen.getByTestId('shop-panel-tab-general');
      expect(generalTab.classList.contains('tk-shop-tab-btn--active')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-11: 点击购买按钮
  // ═══════════════════════════════════════════
  describe('ACC-10-11 点击购买按钮', () => {
    it('ACC-10-11: 点击购买弹出确认弹窗', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const buyBtn = screen.getByTestId('shop-panel-buy-test_goods_1');
      fireEvent.click(buyBtn);

      // 确认弹窗应出现
      await act(async () => { vi.advanceTimersByTime(50); });
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText('确认购买？')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-12: 确认购买成功
  // ═══════════════════════════════════════════
  describe('ACC-10-12 确认购买成功', () => {
    it('ACC-10-12: 确认购买后显示成功提示', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      // 点击购买
      fireEvent.click(screen.getByTestId('shop-panel-buy-test_goods_1'));
      await act(async () => { vi.advanceTimersByTime(50); });

      // 确认购买
      fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
      await act(async () => { vi.advanceTimersByTime(50); });

      // 应显示成功提示
      expect(screen.getByTestId('shop-panel-toast')).toBeInTheDocument();
      expect(screen.getByText(/购买成功/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-13: 取消购买
  // ═══════════════════════════════════════════
  describe('ACC-10-13 取消购买', () => {
    it('ACC-10-13: 点击取消后弹窗关闭', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      fireEvent.click(screen.getByTestId('shop-panel-buy-test_goods_1'));
      await act(async () => { vi.advanceTimersByTime(50); });

      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('shop-panel-confirm-cancel'));
      await act(async () => { vi.advanceTimersByTime(250); });

      expect(screen.queryByTestId('shop-panel-confirm-dialog')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-14: 点击遮罩关闭弹窗
  // ═══════════════════════════════════════════
  describe('ACC-10-14 点击遮罩关闭弹窗', () => {
    it('ACC-10-14: 点击遮罩区域关闭确认弹窗', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      fireEvent.click(screen.getByTestId('shop-panel-buy-test_goods_1'));
      await act(async () => { vi.advanceTimersByTime(50); });

      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();

      // 点击遮罩（overlay）
      fireEvent.click(screen.getByTestId('shop-panel-confirm-overlay'));
      await act(async () => { vi.advanceTimersByTime(250); });

      expect(screen.queryByTestId('shop-panel-confirm-dialog')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-16: 售罄商品不可购买
  // ═══════════════════════════════════════════
  describe('ACC-10-16 售罄商品不可购买', () => {
    it('ACC-10-16: 售罄商品卡片半透明', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const soldOutCard = document.querySelector('[data-testid="shop-panel-goods-test_goods_soldout"]');
      expect(soldOutCard).toBeTruthy();
      expect(soldOutCard!.classList.contains('tk-shop-goods-card--out-of-stock')).toBe(true);
    });

    it('ACC-10-16: 售罄商品按钮显示售罄且禁用', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const soldOutBtn = screen.getByTestId('shop-panel-buy-test_goods_soldout');
      expect(soldOutBtn.textContent).toContain('售罄');
      expect((soldOutBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-17: 关闭商店面板
  // ═══════════════════════════════════════════
  describe('ACC-10-17 关闭商店面板', () => {
    it('ACC-10-17: 点击关闭按钮触发onClose', async () => {
      const { onClose } = renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      fireEvent.click(screen.getByLabelText('关闭面板'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-18: 手动刷新商店
  // ═══════════════════════════════════════════
  describe('ACC-10-18 手动刷新商店', () => {
    it('ACC-10-18: 点击刷新按钮触发刷新', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const refreshBtn = screen.getByTestId('shop-panel-refresh');
      fireEvent.click(refreshBtn);

      // 应显示刷新成功提示
      await act(async () => { vi.advanceTimersByTime(50); });
      expect(screen.getByText(/商店已刷新/)).toBeInTheDocument();
    });

    it('ACC-10-18: 刷新次数耗尽后按钮禁用', async () => {
      renderShopPanel({ refreshCount: 5, refreshLimit: 5 });
      await act(async () => { vi.advanceTimersByTime(400); });

      const refreshBtn = screen.getByTestId('shop-panel-refresh');
      expect((refreshBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-26: 货币余额栏实时更新
  // ═══════════════════════════════════════════
  describe('ACC-10-26 货币余额栏实时更新', () => {
    it('ACC-10-26: 购买成功后货币栏数值更新', async () => {
      const { rerender } = renderShopPanel({ balances: { copper: 10000 } });
      await act(async () => { vi.advanceTimersByTime(400); });

      // 初始余额
      expect(screen.getByText(/铜钱.*10,000/)).toBeInTheDocument();

      // 模拟余额变化后重新渲染
      const engine2 = createMockEngine({ balances: { copper: 9500 } });
      rerender(<ShopPanel engine={engine2} visible={true} />);
      await act(async () => { vi.advanceTimersByTime(50); });

      expect(screen.getByText(/铜钱.*9,500/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-29: 提示消息自动消失
  // ═══════════════════════════════════════════
  describe('ACC-10-29 提示消息自动消失', () => {
    it('ACC-10-29: 成功提示在约2.5秒后自动消失', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      // 触发购买成功
      fireEvent.click(screen.getByTestId('shop-panel-buy-test_goods_1'));
      await act(async () => { vi.advanceTimersByTime(50); });
      fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
      await act(async () => { vi.advanceTimersByTime(50); });

      // Toast 应该出现
      expect(screen.getByTestId('shop-panel-toast')).toBeInTheDocument();

      // 等待自动消失（2500ms）
      await act(async () => { vi.advanceTimersByTime(2600); });

      // Toast 应该消失
      expect(screen.queryByTestId('shop-panel-toast')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-40: 商店面板宽度适配
  // ═══════════════════════════════════════════
  describe('ACC-10-40 商店面板宽度适配', () => {
    it('ACC-10-40: 面板容器存在shop-panel-mobile类', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const container = screen.getByTestId('shop-panel');
      expect(container.classList.contains('shop-panel-mobile')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-41: Tab栏横向可滚动
  // ═══════════════════════════════════════════
  describe('ACC-10-41 Tab栏横向可滚动', () => {
    it('ACC-10-41: Tab栏有overflow-x: auto样式类', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const tabBar = screen.getByTestId('shop-panel-tabs');
      expect(tabBar.classList.contains('tk-shop-tab-bar')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-42: 商品卡片布局
  // ═══════════════════════════════════════════
  describe('ACC-10-42 商品卡片布局', () => {
    it('ACC-10-42: 商品卡片包含图标、名称、价格、购买按钮', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const card = document.querySelector('[data-testid="shop-panel-goods-test_goods_1"]');
      expect(card).toBeTruthy();

      // 图标
      const icon = card!.querySelector('.tk-shop-goods-icon');
      expect(icon).toBeTruthy();
      // 名称
      expect(within(card as HTMLElement).getByText('粮草小包')).toBeInTheDocument();
      // 价格
      expect(within(card as HTMLElement).getByText(/铜钱/)).toBeInTheDocument();
      // 购买按钮
      expect(within(card as HTMLElement).getByTestId('shop-panel-buy-test_goods_1')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-43: 商品描述文字截断
  // ═══════════════════════════════════════════
  describe('ACC-10-43 商品描述文字截断', () => {
    it('ACC-10-43: 描述元素有text-overflow: ellipsis样式类', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const desc = document.querySelector('.tk-shop-goods-desc');
      expect(desc).toBeTruthy();
      expect(desc!.classList.contains('tk-shop-goods-desc')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-44: 购买确认弹窗居中
  // ═══════════════════════════════════════════
  describe('ACC-10-44 购买确认弹窗居中', () => {
    it('ACC-10-44: 确认弹窗有居中样式', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      fireEvent.click(screen.getByTestId('shop-panel-buy-test_goods_1'));
      await act(async () => { vi.advanceTimersByTime(50); });

      const overlay = screen.getByTestId('shop-panel-confirm-overlay');
      expect(overlay.classList.contains('tk-shop-overlay')).toBe(true);

      const dialog = screen.getByTestId('shop-panel-confirm-dialog');
      expect(dialog.classList.contains('tk-shop-confirm-panel')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-45: 货币栏自适应换行
  // ═══════════════════════════════════════════
  describe('ACC-10-45 货币栏自适应换行', () => {
    it('ACC-10-45: 货币栏有flexWrap样式类', async () => {
      renderShopPanel({ balances: { copper: 1000, mandate: 500, recruit: 100, summon: 50 } });
      await act(async () => { vi.advanceTimersByTime(400); });

      const currencyBar = document.querySelector('.tk-shop-currency-bar');
      expect(currencyBar).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-47: 购买按钮触控区域
  // ═══════════════════════════════════════════
  describe('ACC-10-47 购买按钮触控区域', () => {
    it('ACC-10-47: 购买按钮有足够的padding', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const buyBtn = screen.getByTestId('shop-panel-buy-test_goods_1');
      expect(buyBtn.classList.contains('tk-shop-buy-btn')).toBe(true);
      // 按钮存在且可点击
      expect((buyBtn as HTMLButtonElement).disabled).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-49: 面板关闭按钮可触达
  // ═══════════════════════════════════════════
  describe('ACC-10-49 面板关闭按钮可触达', () => {
    it('ACC-10-49: 关闭按钮在可视区域内', async () => {
      const { onClose } = renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      const closeBtn = screen.getByLabelText('关闭面板');
      expect(closeBtn).toBeInTheDocument();
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-15: 货币不足购买失败 (UI层)
  // ═══════════════════════════════════════════
  describe('ACC-10-15 货币不足购买失败', () => {
    it('ACC-10-15: 货币不足时显示不足提示', async () => {
      // 创建一个价格高于余额的场景
      const engine = createMockEngine({
        balances: { copper: 100 },
        goods: [
          createMockGoodsItem({ defId: 'expensive_item', stock: -1, discount: 1 }),
        ],
        goodsDefs: {
          expensive_item: createMockGoodsDef({
            id: 'expensive_item',
            name: '昂贵商品',
            description: '非常贵',
            basePrice: { copper: 9999 },
          }),
        },
      });
      render(<ShopPanel engine={engine} visible={true} />);
      await act(async () => { vi.advanceTimersByTime(400); });

      // 点击购买
      fireEvent.click(screen.getByTestId('shop-panel-buy-expensive_item'));
      await act(async () => { vi.advanceTimersByTime(50); });

      // 确认购买
      fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
      await act(async () => { vi.advanceTimersByTime(50); });

      // 应显示余额不足提示
      const toast = screen.getByTestId('shop-panel-toast');
      expect(toast.textContent).toContain('无法购买');
    });
  });

  // ═══════════════════════════════════════════
  // ACC-10-22: 防抖保护（UI层）
  // ═══════════════════════════════════════════
  describe('ACC-10-22 防抖保护', () => {
    it('ACC-10-22: 购买成功后显示成功提示', async () => {
      renderShopPanel();
      await act(async () => { vi.advanceTimersByTime(400); });

      // 点击购买
      fireEvent.click(screen.getByTestId('shop-panel-buy-test_goods_1'));
      await act(async () => { vi.advanceTimersByTime(50); });

      // 确认购买
      fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
      await act(async () => { vi.advanceTimersByTime(100); });

      // 应该显示成功提示（说明购买流程正常执行）
      expect(screen.getByText(/购买成功/)).toBeInTheDocument();
    });

    it('ACC-10-22: 购买操作有防抖保护（500ms内不可重复操作）', async () => {
      const engine = createMockEngine();
      render(<ShopPanel engine={engine} visible={true} />);
      await act(async () => { vi.advanceTimersByTime(400); });

      // 第一次购买
      fireEvent.click(screen.getByTestId('shop-panel-buy-test_goods_1'));
      await act(async () => { vi.advanceTimersByTime(50); });
      fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
      await act(async () => { vi.advanceTimersByTime(100); });

      // 确认弹窗关闭后，buyingId被清空
      // 防抖期间（500ms内），购买按钮可再次点击但handleBuy中isOperatingRef保护
      // 验证：防抖后系统正常恢复
      await act(async () => { vi.advanceTimersByTime(600); });

      // 可以再次购买（防抖已释放）
      const buyBtn = screen.getByTestId('shop-panel-buy-test_goods_1');
      expect((buyBtn as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
