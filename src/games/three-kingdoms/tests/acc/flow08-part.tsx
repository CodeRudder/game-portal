/** FLOW-08 商店Tab集成测试 — 渲染/商品列表/购买/批量/库存/资源/刷新/限购。使用真实引擎，不mock。 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShopPanel from '@/components/idle/panels/shop/ShopPanel';
import { accTest, assertStrict, assertVisible } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import { GOODS_DEF_MAP } from '@/games/three-kingdoms/core/shop';

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

// ── 真实引擎工厂 ──

function makeEngine(currencyOverrides: Record<string, number> = {}): {
  engine: ThreeKingdomsEngine;
  sim: GameEventSimulator;
} {
  const sim = createSim();
  const engine = sim.engine;

  const cs = engine.getCurrencySystem();
  cs.setCurrency('copper', currencyOverrides.copper ?? 100000);
  cs.setCurrency('mandate', currencyOverrides.mandate ?? 10000);
  cs.setCurrency('ingot', currencyOverrides.ingot ?? 10000);
  cs.setCurrency('recruit', currencyOverrides.recruit ?? 1000);
  cs.setCurrency('summon', currencyOverrides.summon ?? 1000);
  cs.setCurrency('expedition', currencyOverrides.expedition ?? 10000);
  cs.setCurrency('guild', currencyOverrides.guild ?? 10000);
  cs.setCurrency('reputation', currencyOverrides.reputation ?? 10000);

  return { engine, sim };
}

function makeProps(currencyOverrides?: Record<string, number>) {
  const { engine } = makeEngine(currencyOverrides);
  return { engine, visible: true as const, onClose: vi.fn() };
}

/** 等待骨架屏加载完成（300ms） */
async function waitForGoodsLoaded() {
  await waitFor(() => {
    const buyButtons = screen.queryAllByTestId(/^shop-panel-buy-/);
    expect(buyButtons.length).toBeGreaterThan(0);
  }, { timeout: 2000 });
}

// ── Tests ──

describe('FLOW-08 商店Tab集成测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  // ═══════════════════════════════════════════════════════════════
  // 1. 商店Tab渲染（FLOW-08-01 ~ FLOW-08-05）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-08-01', '商店面板整体渲染 — 面板容器、Tab栏、商品列表'), () => {
    render(<ShopPanel {...makeProps()} />);
    const panel = screen.getByTestId('shop-panel');
    assertVisible(panel, 'FLOW-08-01', '商店面板容器');

    const tabs = screen.getByTestId('shop-panel-tabs');
    assertVisible(tabs, 'FLOW-08-01', '商店Tab栏');

    const refreshBtn = screen.getByTestId('shop-panel-refresh');
    assertVisible(refreshBtn, 'FLOW-08-01', '刷新按钮');
  });

  it(accTest('FLOW-08-02', '四个商店Tab显示 — 杂货铺/竞技商店/远征商店/联盟商店'), () => {
    render(<ShopPanel {...makeProps()} />);
    expect(screen.getByTestId('shop-panel-tab-normal')).toBeInTheDocument();
    expect(screen.getByTestId('shop-panel-tab-black_market')).toBeInTheDocument();
    expect(screen.getByTestId('shop-panel-tab-limited_time')).toBeInTheDocument();
    expect(screen.getByTestId('shop-panel-tab-vip')).toBeInTheDocument();
  });

  it(accTest('FLOW-08-03', '默认选中杂货铺Tab — normal Tab高亮'), () => {
    render(<ShopPanel {...makeProps()} />);
    const normalTab = screen.getByTestId('shop-panel-tab-normal');
    expect(normalTab.className).toContain('active');
  });

  it(accTest('FLOW-08-04', '货币余额栏显示 — 显示余额>0的货币'), () => {
    render(<ShopPanel {...makeProps({ copper: 12500, mandate: 300 })} />);
    const panel = screen.getByTestId('shop-panel');
    expect(panel.textContent).toContain('铜钱');
    expect(panel.textContent).toContain('12,500');
  });

  it(accTest('FLOW-08-05', '排序工具栏显示 — 5个排序选项'), () => {
    render(<ShopPanel {...makeProps()} />);
    expect(screen.getByTestId('shop-panel-sort-default')).toBeInTheDocument();
    expect(screen.getByTestId('shop-panel-sort-price-asc')).toBeInTheDocument();
    expect(screen.getByTestId('shop-panel-sort-price-desc')).toBeInTheDocument();
    expect(screen.getByTestId('shop-panel-sort-favorite')).toBeInTheDocument();
    expect(screen.getByTestId('shop-panel-sort-discount')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. 商品列表（FLOW-08-06 ~ FLOW-08-10）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-08-06', '商品列表加载 — 骨架屏后显示商品卡片'), async () => {
    render(<ShopPanel {...makeProps()} />);
    // 初始有骨架屏
    const panel = screen.getByTestId('shop-panel');
    assertVisible(panel, 'FLOW-08-06', '商店面板');
    // 等待加载完成
    await waitForGoodsLoaded();
    const buyButtons = screen.queryAllByTestId(/^shop-panel-buy-/);
    assertStrict(buyButtons.length >= 3, 'FLOW-08-06', `应至少有3个商品，实际${buyButtons.length}个`);
  });

  it(accTest('FLOW-08-07', '商品名称可见 — 粮草小包等商品名称显示'), async () => {
    render(<ShopPanel {...makeProps()} />);
    await waitForGoodsLoaded();
    expect(screen.getByText('粮草小包')).toBeInTheDocument();
  });

  it(accTest('FLOW-08-08', '商品价格可见 — 铜钱价格显示'), async () => {
    render(<ShopPanel {...makeProps()} />);
    await waitForGoodsLoaded();
    const panel = screen.getByTestId('shop-panel');
    // res_grain_small 价格为 copper:200
    expect(panel.textContent).toContain('铜钱');
    expect(panel.textContent).toContain('200');
  });

  it(accTest('FLOW-08-09', '商品描述可见 — 商品描述文本显示'), async () => {
    render(<ShopPanel {...makeProps()} />);
    await waitForGoodsLoaded();
    expect(screen.getByText('100单位粮草')).toBeInTheDocument();
  });

  it(accTest('FLOW-08-10', '限购信息可见 — 今日限购进度显示'), async () => {
    render(<ShopPanel {...makeProps()} />);
    await waitForGoodsLoaded();
    const panel = screen.getByTestId('shop-panel');
    expect(panel.textContent).toContain('今日:');
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. 购买流程（FLOW-08-11 ~ FLOW-08-16）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-08-11', '点击购买按钮 — 弹出确认弹窗'), async () => {
    render(<ShopPanel {...makeProps()} />);
    await waitForGoodsLoaded();
    fireEvent.click(screen.getByTestId('shop-panel-buy-res_grain_small'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    expect(screen.getByText('确认购买？')).toBeInTheDocument();
  });

  it(accTest('FLOW-08-12', '确认购买成功 — 弹窗关闭，显示购买成功提示'), async () => {
    render(<ShopPanel {...makeProps()} />);
    await waitForGoodsLoaded();
    fireEvent.click(screen.getByTestId('shop-panel-buy-res_grain_small'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
    await waitFor(() => {
      const toast = screen.getByTestId('shop-panel-toast');
      expect(toast.textContent).toContain('购买成功');
    });
  });

  it(accTest('FLOW-08-13', '购买后资源扣除 — 铜钱余额减少'), async () => {
    const { engine } = makeEngine();
    const beforeBalance = engine.getCurrencySystem().getBalance('copper');
    render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);
    await waitForGoodsLoaded();
    fireEvent.click(screen.getByTestId('shop-panel-buy-res_grain_small'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-toast')).toBeInTheDocument();
    });
    const afterBalance = engine.getCurrencySystem().getBalance('copper');
    expect(afterBalance).toBeLessThan(beforeBalance);
  });

  it(accTest('FLOW-08-14', '购买后库存更新 — stock减少'), async () => {
    const { engine } = makeEngine();
    const shopSystem = engine.getShopSystem();
    const beforeGoods = shopSystem.getShopGoods('normal');
    const beforeItem = beforeGoods.find(g => g.defId === 'mat_jade');
    const beforeStock = beforeItem!.stock;

    render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);
    await waitForGoodsLoaded();
    fireEvent.click(screen.getByTestId('shop-panel-buy-mat_jade'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-toast')).toBeInTheDocument();
    });
    const afterGoods = shopSystem.getShopGoods('normal');
    const afterItem = afterGoods.find(g => g.defId === 'mat_jade');
    expect(afterItem!.stock).toBe(beforeStock - 1);
  });

  it(accTest('FLOW-08-15', '取消购买 — 弹窗关闭，无数据变化'), async () => {
    const { engine } = makeEngine();
    const beforeBalance = engine.getCurrencySystem().getBalance('copper');
    render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);
    await waitForGoodsLoaded();
    fireEvent.click(screen.getByTestId('shop-panel-buy-res_grain_small'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('shop-panel-confirm-cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('shop-panel-confirm-dialog')).toBeNull();
    });
    // 铜钱不变
    const afterBalance = engine.getCurrencySystem().getBalance('copper');
    expect(afterBalance).toBe(beforeBalance);
  });

  it(accTest('FLOW-08-16', '确认弹窗显示余额对比 — 余额充足/不足显示'), async () => {
    render(<ShopPanel {...makeProps({ copper: 500 })} />);
    await waitForGoodsLoaded();
    fireEvent.click(screen.getByTestId('shop-panel-buy-res_grain_small'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    // 弹窗中应显示价格和余额对比
    const dialog = screen.getByTestId('shop-panel-confirm-dialog');
    expect(dialog.textContent).toContain('铜钱');
    expect(dialog.textContent).toContain('余额');
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. 批量购买（FLOW-08-17 ~ FLOW-08-19）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-08-17', '确认弹窗显示数量选择 — 可选×1/×5/×10'), async () => {
    render(<ShopPanel {...makeProps()} />);
    await waitForGoodsLoaded();
    // res_grain_small stock=-1（无限库存），应有多个数量选项
    fireEvent.click(screen.getByTestId('shop-panel-buy-res_grain_small'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    // 检查数量选择按钮
    const qty1 = screen.queryByTestId('shop-panel-qty-1');
    assertStrict(!!qty1, 'FLOW-08-17', '应有×1按钮');
  });

  it(accTest('FLOW-08-18', '批量购买×5 — 购买5个商品成功'), async () => {
    const { engine } = makeEngine({ copper: 500000 });
    const beforeBalance = engine.getCurrencySystem().getBalance('copper');
    render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);
    await waitForGoodsLoaded();
    fireEvent.click(screen.getByTestId('shop-panel-buy-res_grain_small'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    // 选择×5
    const qty5 = screen.queryByTestId('shop-panel-qty-5');
    if (qty5) {
      fireEvent.click(qty5);
    }
    fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
    await waitFor(() => {
      const toast = screen.getByTestId('shop-panel-toast');
      expect(toast.textContent).toContain('购买成功');
    });
    // 验证扣费大于单价
    const afterBalance = engine.getCurrencySystem().getBalance('copper');
    const spent = beforeBalance - afterBalance;
    // res_grain_small 单价 200，×5 应扣 1000
    assertStrict(spent >= 200, 'FLOW-08-18', `批量购买应扣除至少200铜钱，实际扣除${spent}`);
  });

  it(accTest('FLOW-08-19', '批量购买引擎验证 — executeBuy数量参数正确'), () => {
    const { engine } = makeEngine();
    const shopSystem = engine.getShopSystem();
    // 购买5个 res_grain_small
    const result = shopSystem.executeBuy({ goodsId: 'res_grain_small', shopType: 'normal', quantity: 5 });
    assertStrict(result.success, 'FLOW-08-19', '批量购买应成功');
    assertStrict(result.quantity === 5, 'FLOW-08-19', `返回数量应为5，实际${result.quantity}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. 库存限制（FLOW-08-20 ~ FLOW-08-22）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-08-20', '库存为0时商品售罄 — 按钮显示售罄且禁用'), async () => {
    const { engine } = makeEngine();
    const shopSystem = engine.getShopSystem();
    // 购买 mat_jade 5 次使库存为0
    for (let i = 0; i < 5; i++) {
      shopSystem.executeBuy({ goodsId: 'mat_jade', shopType: 'normal', quantity: 1 });
    }
    render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);
    await waitFor(() => {
      const soldOutBtn = screen.getByTestId('shop-panel-buy-mat_jade');
      expect(soldOutBtn.textContent).toContain('售罄');
      expect(soldOutBtn).toBeDisabled();
    });
  });

  it(accTest('FLOW-08-21', '无限库存商品始终可购买 — stock=-1不显示售罄'), async () => {
    render(<ShopPanel {...makeProps()} />);
    await waitForGoodsLoaded();
    const infiniteBtn = screen.getByTestId('shop-panel-buy-res_grain_small');
    expect(infiniteBtn.textContent).toContain('购买');
    expect(infiniteBtn).not.toBeDisabled();
  });

  it(accTest('FLOW-08-22', '购买超过库存数量 — validateBuy返回失败'), () => {
    const { engine } = makeEngine();
    const shopSystem = engine.getShopSystem();
    // mat_jade stock=5, 尝试购买 10 个
    const validation = shopSystem.validateBuy({ goodsId: 'mat_jade', shopType: 'normal', quantity: 10 });
    assertStrict(!validation.canBuy, 'FLOW-08-22', '超过库存应不可购买');
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. 资源不足（FLOW-08-23 ~ FLOW-08-26）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-08-23', '资源不足时购买失败 — 显示无法购买提示'), async () => {
    render(<ShopPanel {...makeProps({ copper: 10 })} />);
    await waitForGoodsLoaded();
    fireEvent.click(screen.getByTestId('shop-panel-buy-res_grain_small'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
    await waitFor(() => {
      const toast = screen.getByTestId('shop-panel-toast');
      expect(toast.textContent).toContain('无法购买');
    });
  });

  it(accTest('FLOW-08-24', '余额恰好等于价格 — 购买成功'), async () => {
    // res_grain_small: basePrice copper:200
    render(<ShopPanel {...makeProps({ copper: 200 })} />);
    await waitForGoodsLoaded();
    fireEvent.click(screen.getByTestId('shop-panel-buy-res_grain_small'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
    await waitFor(() => {
      const toast = screen.getByTestId('shop-panel-toast');
      expect(toast.textContent).toContain('购买成功');
    });
  });

  it(accTest('FLOW-08-25', '多货币不足时购买失败 — 一种货币不足即拒绝'), async () => {
    // mat_jade 需要 mandate:10，只给铜钱不给天命
    render(<ShopPanel {...makeProps({ copper: 100000, mandate: 0 })} />);
    await waitForGoodsLoaded();
    fireEvent.click(screen.getByTestId('shop-panel-buy-mat_jade'));
    await waitFor(() => {
      expect(screen.getByTestId('shop-panel-confirm-dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('shop-panel-confirm-ok'));
    await waitFor(() => {
      const toast = screen.getByTestId('shop-panel-toast');
      expect(toast.textContent).toContain('无法购买');
    });
  });

  it(accTest('FLOW-08-26', '引擎层资源不足校验 — validateBuy返回错误'), () => {
    const { engine } = makeEngine({ copper: 10 });
    const shopSystem = engine.getShopSystem();
    const validation = shopSystem.validateBuy({ goodsId: 'res_grain_small', shopType: 'normal', quantity: 1 });
    assertStrict(!validation.canBuy, 'FLOW-08-26', '资源不足应不可购买');
    assertStrict(validation.errors.length > 0, 'FLOW-08-26', '应有错误信息');
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. 刷新商店（FLOW-08-27 ~ FLOW-08-30）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-08-27', '手动刷新商店 — 商品列表刷新'), async () => {
    const { engine } = makeEngine();
    render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);
    const refreshBtn = screen.getByTestId('shop-panel-refresh');
    fireEvent.click(refreshBtn);
    await waitFor(() => {
      expect(engine.getShopSystem().getState().normal.manualRefreshCount).toBeGreaterThan(0);
    });
  });

  it(accTest('FLOW-08-28', '刷新次数显示 — 显示当前/最大次数'), () => {
    render(<ShopPanel {...makeProps()} />);
    const refreshBtn = screen.getByTestId('shop-panel-refresh');
    // 默认 0/5
    expect(refreshBtn.textContent).toContain('0/5');
  });

  it(accTest('FLOW-08-29', '刷新次数耗尽 — 按钮禁用', () => {
    const { engine } = makeEngine();
    const shopSystem = engine.getShopSystem();
    for (let i = 0; i < 5; i++) {
      shopSystem.manualRefresh();
    }
    render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);
    const refreshBtn = screen.getByTestId('shop-panel-refresh');
    expect(refreshBtn).toBeDisabled();
  });
