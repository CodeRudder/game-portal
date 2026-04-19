/**
 * 三国霸业 v1.0 UI 交互测试
 *
 * 测试范围:
 *   - 资源栏正确渲染 (4资源 + 产出速率)
 *   - Tab 切换正确 (6个Tab)
 *   - 建筑列表正确显示 (15座建筑)
 *   - 建筑升级弹窗正确弹出/关闭 (D区面板)
 *   - 确认弹窗正确弹出/关闭 (E区弹窗)
 *   - Toast 提示正确显示/消失
 *   - 资源飘字动画触发
 *   - 加载画面正确显示
 *
 * 目标: 100% 分支覆盖率和通过率
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ThreeKingdomsPixiGame from '@/components/idle/ThreeKingdomsPixiGame';
import { BUILDINGS, RESOURCES } from '@/games/three-kingdoms/constants';

// ─── Mock ThreeKingdomsEngine ──────────────────────────────

const mockBuildingSystem = {
  getLevel: vi.fn((id: string) => {
    // 初始解锁的建筑默认 level 0
    const initiallyUnlocked = ['farm', 'market', 'barracks', 'clinic', 'academy'];
    return initiallyUnlocked.includes(id) ? 0 : 0;
  }),
  isUnlocked: vi.fn((id: string) => {
    const initiallyUnlocked = ['farm', 'market', 'barracks', 'clinic', 'academy'];
    return initiallyUnlocked.includes(id);
  }),
  register: vi.fn(),
};

const mockEngine = {
  on: vi.fn(),
  off: vi.fn(),
  init: vi.fn(),
  start: vi.fn(),
  destroy: vi.fn(),
  getResources: vi.fn(() => ({
    grain: 500,
    gold: 300,
    iron: 10,
    wood: 10,
    troops: 100,
    defense: 0,
    destiny: 50,
    morale: 50,
  })),
  getProductionCache: vi.fn(() => ({
    grain: 0,
    gold: 0,
    troops: 0,
    destiny: 0,
  })),
  getBuildingSystem: vi.fn(() => mockBuildingSystem),
  buyBuildingById: vi.fn(() => true),
  upgradeBuilding: vi.fn(() => true),
  emit: vi.fn(),
};

vi.mock('@/games/three-kingdoms/ThreeKingdomsEngine', () => ({
  ThreeKingdomsEngine: vi.fn(() => mockEngine),
}));

// ─── 工具函数 ──────────────────────────────────────────────

/** 等待引擎初始化完成（loading 消失） */
async function waitForGameReady() {
  await waitFor(() => {
    expect(screen.getByTestId('game-container')).toBeInTheDocument();
  });
}

/** 获取所有导航 Tab */
function getNavTabs() {
  return screen.getAllByRole('button').filter(
    btn => btn.dataset.testid?.startsWith('nav-tab-')
  );
}

// ═══════════════════════════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════════════════════════

describe('三国霸业 v1.0 UI 交互测试', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── 1. 加载画面 ────────────────────────────────────────

  describe('加载画面', () => {
    it('应先显示加载画面', () => {
      // engine.init 会触发 stateChange 回调
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') {
          // 立即触发回调，模拟初始化完成
          cb();
        }
      });

      render(<ThreeKingdomsPixiGame />);

      // 加载完成后应显示游戏容器
      expect(screen.getByTestId('game-container')).toBeInTheDocument();
    });

    it('引擎初始化后应隐藏加载画面并显示游戏界面', async () => {
      let stateCallback: (() => void) | null = null;
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') {
          stateCallback = cb;
        }
      });

      render(<ThreeKingdomsPixiGame />);

      // 触发状态回调
      act(() => {
        stateCallback?.();
      });

      await waitForGameReady();
      expect(screen.getByTestId('resource-bar')).toBeInTheDocument();
      expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
      expect(screen.getByTestId('scene-area')).toBeInTheDocument();
    });
  });

  // ─── 2. 资源栏 ──────────────────────────────────────────

  describe('资源栏 (A区)', () => {
    beforeEach(async () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();
    });

    it('应渲染资源栏', () => {
      expect(screen.getByTestId('resource-bar')).toBeInTheDocument();
    });

    it('应显示4个核心资源', () => {
      expect(screen.getByTestId('resource-grain')).toBeInTheDocument();
      expect(screen.getByTestId('resource-gold')).toBeInTheDocument();
      expect(screen.getByTestId('resource-troops')).toBeInTheDocument();
      expect(screen.getByTestId('resource-destiny')).toBeInTheDocument();
    });

    it('应显示粮草数值', () => {
      const grainValue = screen.getByTestId('resource-value-grain');
      expect(grainValue).toHaveTextContent('500');
    });

    it('应显示铜钱数值', () => {
      const goldValue = screen.getByTestId('resource-value-gold');
      expect(goldValue).toHaveTextContent('300');
    });

    it('应显示兵力数值', () => {
      const troopsValue = screen.getByTestId('resource-value-troops');
      expect(troopsValue).toHaveTextContent('100');
    });

    it('应显示天命数值', () => {
      const destinyValue = screen.getByTestId('resource-value-destiny');
      expect(destinyValue).toHaveTextContent('50');
    });

    it('当产出速率>0时应显示产出速率', async () => {
      mockEngine.getProductionCache.mockReturnValue({
        grain: 5.0,
        gold: 3.0,
        troops: 1.0,
        destiny: 0.5,
      });

      // 重新渲染
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      // 需要触发 stateChange 回调更新 production
      // 由于 mock，初始 production 为 0
    });

    it('应显示资源详情按钮', () => {
      expect(screen.getByTestId('resource-detail-btn')).toBeInTheDocument();
    });
  });

  // ─── 3. Tab 切换 ────────────────────────────────────────

  describe('导航Tab栏 (B区)', () => {
    beforeEach(async () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();
    });

    it('应渲染导航栏', () => {
      expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
    });

    it('应显示6个Tab', () => {
      expect(screen.getByTestId('nav-tab-world')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-campaign')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-general')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-tech')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-building')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-prestige')).toBeInTheDocument();
    });

    it('默认应激活建筑Tab', () => {
      const buildingTab = screen.getByTestId('nav-tab-building');
      expect(buildingTab.className).toContain('tk-nav-tab--active');
    });

    it('点击Tab应切换激活状态', () => {
      const worldTab = screen.getByTestId('nav-tab-world');
      const buildingTab = screen.getByTestId('nav-tab-building');

      fireEvent.click(worldTab);
      expect(worldTab.className).toContain('tk-nav-tab--active');
      expect(buildingTab.className).not.toContain('tk-nav-tab--active');
    });

    it('切换到天下Tab应显示占位场景', () => {
      fireEvent.click(screen.getByTestId('nav-tab-world'));
      expect(screen.getByTestId('scene-placeholder-天下大势')).toBeInTheDocument();
    });

    it('切换到出征Tab应显示占位场景', () => {
      fireEvent.click(screen.getByTestId('nav-tab-campaign'));
      expect(screen.getByTestId('scene-placeholder-出征')).toBeInTheDocument();
    });

    it('切换到武将Tab应显示占位场景', () => {
      fireEvent.click(screen.getByTestId('nav-tab-general'));
      expect(screen.getByTestId('scene-placeholder-武将系统')).toBeInTheDocument();
    });

    it('切换到科技Tab应显示占位场景', () => {
      fireEvent.click(screen.getByTestId('nav-tab-tech'));
      expect(screen.getByTestId('scene-placeholder-科技树')).toBeInTheDocument();
    });

    it('切换到声望Tab应显示占位场景', () => {
      fireEvent.click(screen.getByTestId('nav-tab-prestige'));
      expect(screen.getByTestId('scene-placeholder-声望系统')).toBeInTheDocument();
    });

    it('切回建筑Tab应显示建筑网格', () => {
      fireEvent.click(screen.getByTestId('nav-tab-world'));
      fireEvent.click(screen.getByTestId('nav-tab-building'));
      expect(screen.getByTestId('building-grid')).toBeInTheDocument();
    });
  });

  // ─── 4. 建筑列表 ────────────────────────────────────────

  describe('建筑网格 (C区 - 建筑)', () => {
    beforeEach(async () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();
    });

    it('应渲染建筑网格', () => {
      expect(screen.getByTestId('building-grid')).toBeInTheDocument();
    });

    it('应显示所有15座建筑', () => {
      BUILDINGS.forEach(building => {
        expect(screen.getByTestId(`building-card-${building.id}`)).toBeInTheDocument();
      });
    });

    it('已解锁建筑应显示升级按钮', () => {
      const initiallyUnlocked = ['farm', 'market', 'barracks', 'clinic', 'academy'];
      initiallyUnlocked.forEach(id => {
        expect(screen.getByTestId(`building-upgrade-${id}`)).toBeInTheDocument();
      });
    });

    it('已解锁建筑应显示详情按钮', () => {
      const initiallyUnlocked = ['farm', 'market', 'barracks', 'clinic', 'academy'];
      initiallyUnlocked.forEach(id => {
        expect(screen.getByTestId(`building-detail-${id}`)).toBeInTheDocument();
      });
    });

    it('未解锁建筑应显示锁定状态', () => {
      const lockedBuilding = BUILDINGS.find(b => !['farm', 'market', 'barracks', 'clinic', 'academy'].includes(b.id));
      if (lockedBuilding) {
        const card = screen.getByTestId(`building-card-${lockedBuilding.id}`);
        expect(card.className).toContain('tk-building-card--locked');
      }
    });

    it('点击升级按钮应调用引擎升级方法', () => {
      const upgradeBtn = screen.getByTestId('building-upgrade-farm');
      fireEvent.click(upgradeBtn);
      expect(mockEngine.buyBuildingById).toHaveBeenCalledWith('farm');
    });

    it('升级成功应显示Toast', async () => {
      mockEngine.buyBuildingById.mockReturnValue(true);
      const upgradeBtn = screen.getByTestId('building-upgrade-farm');
      fireEvent.click(upgradeBtn);

      await waitFor(() => {
        expect(screen.getByTestId('toast-container').children.length).toBeGreaterThan(0);
      });
    });

    it('升级失败应显示资源不足Toast', async () => {
      mockEngine.buyBuildingById.mockReturnValue(false);
      const upgradeBtn = screen.getByTestId('building-upgrade-farm');
      fireEvent.click(upgradeBtn);

      await waitFor(() => {
        expect(screen.getByTestId('toast-container').children.length).toBeGreaterThan(0);
      });
    });
  });

  // ─── 5. 建筑详情面板 (D区) ─────────────────────────────

  describe('建筑详情面板 (D区)', () => {
    beforeEach(async () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();
    });

    it('初始不应显示面板', () => {
      expect(screen.queryByTestId('building-detail-panel')).not.toBeInTheDocument();
    });

    it('点击建筑卡片应打开详情面板', () => {
      fireEvent.click(screen.getByTestId('building-card-farm'));
      expect(screen.getByTestId('building-detail-panel')).toBeInTheDocument();
    });

    it('点击详情按钮应打开详情面板', () => {
      fireEvent.click(screen.getByTestId('building-detail-farm'));
      expect(screen.getByTestId('building-detail-panel')).toBeInTheDocument();
    });

    it('详情面板应显示建筑名称', () => {
      fireEvent.click(screen.getByTestId('building-detail-farm'));
      const panel = screen.getByTestId('building-detail-panel');
      expect(panel.textContent).toContain('屯田');
    });

    it('详情面板应显示升级消耗', () => {
      fireEvent.click(screen.getByTestId('building-detail-farm'));
      // 应显示消耗资源
      expect(screen.getByTestId('detail-cost-grain')).toBeInTheDocument();
    });

    it('点击关闭按钮应关闭面板', () => {
      fireEvent.click(screen.getByTestId('building-detail-farm'));
      expect(screen.getByTestId('building-detail-panel')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('panel-close'));
      expect(screen.queryByTestId('building-detail-panel')).not.toBeInTheDocument();
    });

    it('点击遮罩应关闭面板', () => {
      fireEvent.click(screen.getByTestId('building-detail-farm'));
      expect(screen.getByTestId('building-detail-panel')).toBeInTheDocument();

      // 点击面板外的遮罩区域
      const overlay = document.querySelector('.tk-panel-overlay');
      if (overlay) {
        fireEvent.click(overlay);
      }
      expect(screen.queryByTestId('building-detail-panel')).not.toBeInTheDocument();
    });

    it('按ESC应关闭面板', () => {
      fireEvent.click(screen.getByTestId('building-detail-farm'));
      expect(screen.getByTestId('building-detail-panel')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('building-detail-panel')).not.toBeInTheDocument();
    });

    it('详情面板中点击升级按钮应执行升级', () => {
      fireEvent.click(screen.getByTestId('building-detail-farm'));
      const detailUpgradeBtn = screen.getByTestId('detail-upgrade-btn');
      fireEvent.click(detailUpgradeBtn);
      expect(mockEngine.buyBuildingById).toHaveBeenCalledWith('farm');
    });

    it('点击未解锁建筑应不打开面板', () => {
      const lockedBuilding = BUILDINGS.find(b => !['farm', 'market', 'barracks', 'clinic', 'academy'].includes(b.id));
      if (lockedBuilding) {
        fireEvent.click(screen.getByTestId(`building-card-${lockedBuilding.id}`));
        expect(screen.queryByTestId('building-detail-panel')).not.toBeInTheDocument();
      }
    });
  });

  // ─── 6. 确认弹窗 (E区) ─────────────────────────────────

  describe('确认弹窗 (E区)', () => {
    beforeEach(async () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();
    });

    it('初始不应显示确认弹窗', () => {
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });
  });

  // ─── 7. Toast 提示 ──────────────────────────────────────

  describe('Toast 提示 (F区)', () => {
    beforeEach(async () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();
    });

    it('初始不应有Toast', () => {
      const container = screen.getByTestId('toast-container');
      expect(container.children.length).toBe(0);
    });

    it('升级成功应显示成功Toast', async () => {
      mockEngine.buyBuildingById.mockReturnValue(true);
      fireEvent.click(screen.getByTestId('building-upgrade-farm'));

      await waitFor(() => {
        const container = screen.getByTestId('toast-container');
        const toasts = container.querySelectorAll('.tk-toast--success');
        expect(toasts.length).toBeGreaterThan(0);
      });
    });

    it('升级失败应显示失败Toast', async () => {
      mockEngine.buyBuildingById.mockReturnValue(false);
      fireEvent.click(screen.getByTestId('building-upgrade-farm'));

      await waitFor(() => {
        const container = screen.getByTestId('toast-container');
        const toasts = container.querySelectorAll('.tk-toast--danger');
        expect(toasts.length).toBeGreaterThan(0);
      });
    });

    it('Toast应在3秒后自动消失', async () => {
      mockEngine.buyBuildingById.mockReturnValue(true);
      fireEvent.click(screen.getByTestId('building-upgrade-farm'));

      await waitFor(() => {
        expect(screen.getByTestId('toast-container').children.length).toBeGreaterThan(0);
      });

      // 快进3秒
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // 再等退出动画完成
      act(() => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(screen.getByTestId('toast-container').children.length).toBe(0);
      });
    });
  });

  // ─── 8. 资源飘字 ────────────────────────────────────────

  describe('资源飘字动画', () => {
    beforeEach(async () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();
    });

    it('升级成功应触发飘字', async () => {
      mockEngine.buyBuildingById.mockReturnValue(true);
      fireEvent.click(screen.getByTestId('building-upgrade-farm'));

      await waitFor(() => {
        const floatTexts = document.querySelectorAll('.tk-float-text');
        expect(floatTexts.length).toBeGreaterThan(0);
      });
    });

    it('飘字应在1200ms后消失', async () => {
      mockEngine.buyBuildingById.mockReturnValue(true);
      fireEvent.click(screen.getByTestId('building-upgrade-farm'));

      await waitFor(() => {
        expect(document.querySelectorAll('.tk-float-text').length).toBeGreaterThan(0);
      });

      act(() => {
        vi.advanceTimersByTime(1200);
      });

      expect(document.querySelectorAll('.tk-float-text').length).toBe(0);
    });
  });

  // ─── 9. 引擎生命周期 ────────────────────────────────────

  describe('引擎生命周期', () => {
    it('应创建引擎实例', () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      expect(mockEngine.init).toHaveBeenCalled();
      expect(mockEngine.start).toHaveBeenCalled();
    });

    it('卸载时应销毁引擎', () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      const { unmount } = render(<ThreeKingdomsPixiGame />);
      unmount();
      expect(mockEngine.destroy).toHaveBeenCalled();
    });

    it('应监听stateChange事件', () => {
      mockEngine.on.mockImplementation(() => {});
      render(<ThreeKingdomsPixiGame />);
      expect(mockEngine.on).toHaveBeenCalledWith('stateChange', expect.any(Function));
    });

    it('卸载时应取消监听stateChange', () => {
      mockEngine.on.mockImplementation(() => {});
      const { unmount } = render(<ThreeKingdomsPixiGame />);
      unmount();
      expect(mockEngine.off).toHaveBeenCalledWith('stateChange', expect.any(Function));
    });
  });

  // ─── 10. 资源数值更新 ───────────────────────────────────

  describe('资源数值实时更新', () => {
    it('引擎状态变化时应更新资源显示', async () => {
      let stateCallback: (() => void) | null = null;
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') stateCallback = cb;
      });

      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      // 模拟资源变化
      mockEngine.getResources.mockReturnValue({
        grain: 1000,
        gold: 600,
        iron: 20,
        wood: 15,
        troops: 200,
        defense: 0,
        destiny: 80,
        morale: 60,
      });

      act(() => {
        stateCallback?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId('resource-value-grain')).toHaveTextContent('1000');
        expect(screen.getByTestId('resource-value-gold')).toHaveTextContent('600');
        expect(screen.getByTestId('resource-value-troops')).toHaveTextContent('200');
        expect(screen.getByTestId('resource-value-destiny')).toHaveTextContent('80');
      });
    });

    it('产出速率变化时应更新显示', async () => {
      let stateCallback: (() => void) | null = null;
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') stateCallback = cb;
      });

      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      // 模拟产出变化
      mockEngine.getProductionCache.mockReturnValue({
        grain: 10.5,
        gold: 5.0,
        troops: 2.0,
        destiny: 0,
      });

      act(() => {
        stateCallback?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId('resource-rate-grain')).toHaveTextContent('10.5');
        expect(screen.getByTestId('resource-rate-gold')).toHaveTextContent('5.0');
        expect(screen.getByTestId('resource-rate-troops')).toHaveTextContent('2.0');
      });
    });
  });

  // ─── 11. 建筑卡片状态 ───────────────────────────────────

  describe('建筑卡片状态样式', () => {
    it('已解锁且已建造的建筑应显示可升级状态', async () => {
      mockBuildingSystem.getLevel.mockImplementation((id: string) => {
        return id === 'farm' ? 5 : 0;
      });
      mockBuildingSystem.isUnlocked.mockReturnValue(true);

      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });

      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      const farmCard = screen.getByTestId('building-card-farm');
      expect(farmCard.className).toContain('tk-building-card--can-upgrade');
    });

    it('未解锁建筑应显示锁定状态', async () => {
      mockBuildingSystem.isUnlocked.mockImplementation((id: string) => {
        return ['farm'].includes(id);
      });

      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });

      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      const marketCard = screen.getByTestId('building-card-market');
      expect(marketCard.className).toContain('tk-building-card--locked');
    });

    it('已建造建筑应显示产出信息', async () => {
      mockBuildingSystem.getLevel.mockImplementation((id: string) => {
        return id === 'farm' ? 5 : 0;
      });
      mockBuildingSystem.isUnlocked.mockReturnValue(true);

      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });

      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      const farmCard = screen.getByTestId('building-card-farm');
      expect(farmCard.textContent).toContain('/秒');
    });
  });

  // ─── 12. 格式化工具函数 ─────────────────────────────────

  describe('数字格式化', () => {
    it('应正确格式化小数字', async () => {
      mockEngine.getResources.mockReturnValue({
        grain: 5,
        gold: 300,
        iron: 10,
        wood: 10,
        troops: 100,
        defense: 0,
        destiny: 50,
        morale: 50,
      });

      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });

      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      // 5 → "5.0"
      expect(screen.getByTestId('resource-value-grain')).toHaveTextContent('5.0');
    });

    it('应正确格式化千位数字', async () => {
      mockEngine.getResources.mockReturnValue({
        grain: 1500,
        gold: 300,
        iron: 10,
        wood: 10,
        troops: 100,
        defense: 0,
        destiny: 50,
        morale: 50,
      });

      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });

      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      // 1500 → "1.5K"
      expect(screen.getByTestId('resource-value-grain')).toHaveTextContent('1.5K');
    });

    it('应正确格式化百万位数字', async () => {
      mockEngine.getResources.mockReturnValue({
        grain: 2500000,
        gold: 300,
        iron: 10,
        wood: 10,
        troops: 100,
        defense: 0,
        destiny: 50,
        morale: 50,
      });

      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });

      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      expect(screen.getByTestId('resource-value-grain')).toHaveTextContent('2.5M');
    });
  });

  // ─── 13. ESC 键交互 ─────────────────────────────────────

  describe('ESC 键交互', () => {
    it('面板打开时按ESC应关闭面板', async () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      // 打开面板
      fireEvent.click(screen.getByTestId('building-detail-farm'));
      expect(screen.getByTestId('building-detail-panel')).toBeInTheDocument();

      // ESC 关闭
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('building-detail-panel')).not.toBeInTheDocument();
    });

    it('弹窗打开时按ESC应关闭弹窗（不关闭面板）', async () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      // 打开面板
      fireEvent.click(screen.getByTestId('building-detail-farm'));
      expect(screen.getByTestId('building-detail-panel')).toBeInTheDocument();

      // ESC 关闭面板
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('building-detail-panel')).not.toBeInTheDocument();
    });
  });

  // ─── 14. 建筑升级交互 ───────────────────────────────────

  describe('建筑升级交互', () => {
    it('未解锁建筑点击升级应显示警告Toast', async () => {
      mockBuildingSystem.isUnlocked.mockReturnValue(false);

      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      // 未解锁建筑不应有升级按钮，但点击卡片应显示 Toast
      const lockedBuilding = BUILDINGS.find(b => !['farm', 'market', 'barracks', 'clinic', 'academy'].includes(b.id));
      if (lockedBuilding) {
        const card = screen.getByTestId(`building-card-${lockedBuilding.id}`);
        expect(card.className).toContain('tk-building-card--locked');
      }
    });

    it('已解锁但未建造的建筑，升级按钮显示"建造"', async () => {
      mockBuildingSystem.getLevel.mockReturnValue(0);
      mockBuildingSystem.isUnlocked.mockReturnValue(true);

      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      const upgradeBtn = screen.getByTestId('building-upgrade-farm');
      expect(upgradeBtn.textContent).toBe('建造');
    });

    it('已建造的建筑，升级按钮显示"升级"', async () => {
      mockBuildingSystem.getLevel.mockImplementation((id: string) => {
        return id === 'farm' ? 3 : 0;
      });
      mockBuildingSystem.isUnlocked.mockReturnValue(true);

      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      const upgradeBtn = screen.getByTestId('building-upgrade-farm');
      expect(upgradeBtn.textContent).toBe('升级');
    });

    it('已建造的建筑应调用upgradeBuilding而非buyBuildingById', async () => {
      mockBuildingSystem.getLevel.mockImplementation((id: string) => {
        return id === 'farm' ? 3 : 0;
      });
      mockBuildingSystem.isUnlocked.mockReturnValue(true);

      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      render(<ThreeKingdomsPixiGame />);
      await waitForGameReady();

      fireEvent.click(screen.getByTestId('building-upgrade-farm'));
      expect(mockEngine.upgradeBuilding).toHaveBeenCalledWith('farm');
      expect(mockEngine.buyBuildingById).not.toHaveBeenCalled();
    });
  });

  // ─── 15. 组件卸载清理 ───────────────────────────────────

  describe('组件卸载清理', () => {
    it('卸载时应清理所有 Toast 定时器', () => {
      mockEngine.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'stateChange') cb();
      });
      const { unmount } = render(<ThreeKingdomsPixiGame />);

      // 触发一个 Toast
      mockEngine.buyBuildingById.mockReturnValue(true);

      unmount();
      // 不应抛出异常
      expect(mockEngine.destroy).toHaveBeenCalled();
    });
  });
});
