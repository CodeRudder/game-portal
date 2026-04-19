/**
 * BuildingPanel 核心交互测试
 *
 * 覆盖场景：
 * 1. 渲染测试（8座建筑卡片、名称等级、锁定状态）
 * 2. 升级交互测试（弹窗、等级预览、费用、灰显、确认、Toast）
 * 3. 错误处理测试（升级失败、弹窗保持打开）
 * 4. 升级中状态测试（进度条、不可再次升级）
 */
import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BuildingType, BuildingState, Resources, ProductionRate, ResourceCap, UpgradeCost, UpgradeCheckResult } from '@/games/three-kingdoms/engine';
import { BUILDING_TYPES, BUILDING_LABELS } from '@/games/three-kingdoms/engine';
import BuildingPanel from '@/components/idle/panels/building/BuildingPanel';

// Mock Toast
vi.mock('@/components/idle/common/Toast', () => ({
  Toast: {
    success: vi.fn(),
    danger: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  default: {
    success: vi.fn(),
    danger: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock CSS imports
vi.mock('@/components/idle/panels/building/BuildingPanel.css', () => ({}));
vi.mock('@/components/idle/panels/building/BuildingUpgradeModal.css', () => ({}));
// 测试数据工厂
function createBuildingState(
  type: BuildingType,
  overrides: Partial<BuildingState> = {},
): BuildingState {
  return {
    type,
    level: 1,
    status: 'idle',
    upgradeStartTime: null,
    upgradeEndTime: null,
    ...overrides,
  };
}

function createAllBuildings(
  overrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {},
): Record<BuildingType, BuildingState> {
  const buildings = {} as Record<BuildingType, BuildingState>;
  for (const type of BUILDING_TYPES) {
    buildings[type] = createBuildingState(type, overrides[type]);
  }
  return buildings;
}
const defaultResources: Resources = {
  grain: 1000,
  gold: 500,
  troops: 100,
  mandate: 0,
};

const defaultRates: ProductionRate = {
  grain: 10,
  gold: 5,
  troops: 2,
  mandate: 0,
};

const defaultCaps: ResourceCap = {
  grain: 10000,
  gold: null,
  troops: 5000,
  mandate: null,
};

const defaultCost: UpgradeCost = {
  grain: 100,
  gold: 50,
  troops: 10,
  timeSeconds: 30,
};
// Mock Engine 工厂
function createMockEngine(options: {
  canUpgrade?: boolean;
  cost?: UpgradeCost | null;
  progress?: number;
  remaining?: number;
  upgradeShouldThrow?: boolean;
  buildings?: Record<BuildingType, BuildingState>;
  resources?: Resources;
} = {}) {
  const {
    canUpgrade = true,
    cost = defaultCost,
    progress = 0,
    remaining = 0,
    upgradeShouldThrow = false,
    buildings,
    resources,
  } = options;

  const snapshotBuildings = buildings || createAllBuildings();
  const snapshotResources = resources || defaultResources;

  return {
    checkUpgrade: vi.fn(() => ({
      canUpgrade,
      reasons: canUpgrade ? [] : ['资源不足'],
    }) as UpgradeCheckResult),
    getUpgradeCost: vi.fn(() => cost),
    getUpgradeProgress: vi.fn(() => progress),
    getUpgradeRemainingTime: vi.fn(() => remaining),
    upgradeBuilding: vi.fn(() => {
      if (upgradeShouldThrow) {
        throw new Error('升级失败：资源不足');
      }
    }),
    getSnapshot: vi.fn(() => ({
      resources: snapshotResources,
      productionRates: defaultRates,
      caps: defaultCaps,
      buildings: snapshotBuildings,
    })),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
  } as any;
}

// 渲染辅助函数
interface RenderOptions {
  buildings?: Record<BuildingType, BuildingState>;
  resources?: Resources;
  rates?: ProductionRate;
  caps?: ResourceCap;
  engineOptions?: Parameters<typeof createMockEngine>[0];
  onUpgradeComplete?: (type: BuildingType) => void;
}

function renderBuildingPanel(options: RenderOptions = {}) {
  const {
    buildings = createAllBuildings(),
    resources = defaultResources,
    rates = defaultRates,
    caps = defaultCaps,
    engineOptions = {},
    onUpgradeComplete,
  } = options;

  const engine = createMockEngine({
    ...engineOptions,
    buildings,
    resources,
  });

  const result = render(
    <BuildingPanel
      buildings={buildings}
      resources={resources}
      rates={rates}
      caps={caps}
      engine={engine}
      onUpgradeComplete={onUpgradeComplete}
    />,
  );

  return { ...result, engine };
}

/**
 * 辅助：获取 PC 端地图中的建筑标记
 * 建筑标记有 role="button" 和 aria-label="建筑名 Lv.N"
 */
function getMapPin(buildingName: string) {
  return screen.getByRole('button', { name: new RegExp(buildingName) });
}

/**
 * 辅助：打开升级弹窗（点击地图建筑标记）
 */
async function openUpgradeModal(user: ReturnType<typeof userEvent.setup>, buildingName: string) {
  const pin = getMapPin(buildingName);
  await user.click(pin);
  // 等待弹窗出现
  return await screen.findByRole('dialog');
}

/**
 * 辅助：在弹窗中点击确认升级按钮
 * 弹窗中的确认按钮 class 含 tk-upgrade-btn--confirm
 */
function getModalConfirmButton() {
  return document.querySelector('.tk-upgrade-btn--confirm') as HTMLElement;
}

/**
 * 辅助：在弹窗中点击取消按钮
 */
function getModalCancelButton() {
  return document.querySelector('.tk-upgrade-btn--cancel') as HTMLElement;
}

/**
 * 辅助：获取弹窗关闭按钮(×)
 */
function getModalCloseButton() {
  return document.querySelector('.tk-upgrade-close') as HTMLElement;
}

describe('BuildingPanel 核心交互测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. 渲染测试
  describe('1. 渲染测试', () => {
    it('应正确渲染8座建筑标记', () => {
      renderBuildingPanel();
      // PC端地图中的标记 — 8个建筑类型都有 role="button"
      const pins = document.querySelectorAll('.tk-bld-pin');
      expect(pins.length).toBe(8);
    });

    it('每个卡片应显示建筑名称和等级', () => {
      const buildings = createAllBuildings({ castle: { level: 3 } });
      renderBuildingPanel({ buildings });

      // 检查所有建筑名称都渲染了
      for (const type of BUILDING_TYPES) {
        const name = BUILDING_LABELS[type];
        expect(screen.getByText(name)).toBeTruthy();
      }

      // 检查等级 — castle 是 level 3
      const castlePin = getMapPin('主城');
      expect(castlePin).toHaveAttribute('aria-label', '主城 Lv.3');
    });

    it('锁定建筑应显示锁定状态', () => {
      const buildings = createAllBuildings({
        smithy: { status: 'locked', level: 0 },
        academy: { status: 'locked', level: 0 },
      });
      renderBuildingPanel({ buildings });

      // 锁定建筑显示🔒图标
      const lockedIcons = screen.getAllByText('🔒');
      expect(lockedIcons.length).toBeGreaterThanOrEqual(2);

      // 锁定建筑显示"未解锁"文字
      const lockedTexts = screen.getAllByText('未解锁');
      expect(lockedTexts.length).toBeGreaterThanOrEqual(2);
    });
  });

  // 2. 升级交互测试
  describe('2. 升级交互测试', () => {
    it('点击建筑卡片应打开升级弹窗', async () => {
      const user = userEvent.setup();
      renderBuildingPanel();

      // 点击主城卡片
      const dialog = await openUpgradeModal(user, '主城');
      expect(dialog).toBeTruthy();
    });

    it('升级弹窗应显示当前等级→目标等级', async () => {
      const user = userEvent.setup();
      const buildings = createAllBuildings({ farmland: { level: 2 } });
      renderBuildingPanel({ buildings });

      await openUpgradeModal(user, '农田');

      // 弹窗中显示升级预览区域，等级变化行
      const levelChangeEl = document.querySelector('.tk-upgrade-level-change');
      expect(levelChangeEl).toBeTruthy();
      expect(levelChangeEl!.textContent).toContain('Lv.2');
      expect(levelChangeEl!.textContent).toContain('Lv.3');
    });

    it('升级弹窗应显示费用明细', async () => {
      const user = userEvent.setup();
      renderBuildingPanel();

      await openUpgradeModal(user, '主城');

      // 弹窗中应显示升级消耗区域
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('升级消耗')).toBeTruthy();
      // 弹窗中应包含粮草、铜钱费用图标（在 tk-upgrade-cost-icon 中）
      const grainCost = dialog.querySelector('.tk-upgrade-cost-icon');
      expect(grainCost).toBeTruthy();
    });

    it('资源不足时升级按钮应灰显（disabled）', async () => {
      const user = userEvent.setup();
      const poorResources: Resources = { grain: 5, gold: 2, troops: 1, mandate: 0 };
      renderBuildingPanel({
        resources: poorResources,
        engineOptions: { canUpgrade: false },
      });

      // 点击卡片打开弹窗
      await openUpgradeModal(user, '主城');

      // 弹窗中的确认按钮应被 disabled
      const confirmBtn = getModalConfirmButton();
      expect(confirmBtn).toBeDisabled();
      expect(confirmBtn.textContent).toContain('资源不足');
    });

    it('点击确认升级应调用 engine.upgradeBuilding()', async () => {
      const user = userEvent.setup();
      const { engine } = renderBuildingPanel();

      // 打开弹窗
      await openUpgradeModal(user, '主城');

      // 点击弹窗中的确认升级按钮
      const confirmBtn = getModalConfirmButton();
      await user.click(confirmBtn);

      expect(engine.upgradeBuilding).toHaveBeenCalledWith('castle');
    });

    it('升级成功后弹窗应关闭', async () => {
      const user = userEvent.setup();
      renderBuildingPanel();

      // 打开弹窗
      await openUpgradeModal(user, '主城');
      expect(screen.getByRole('dialog')).toBeTruthy();

      // 点击确认升级
      const confirmBtn = getModalConfirmButton();
      await user.click(confirmBtn);

      // 弹窗应消失
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });

    it('升级成功后应调用 onUpgradeComplete 回调', async () => {
      const user = userEvent.setup();
      const onUpgradeComplete = vi.fn();
      renderBuildingPanel({ onUpgradeComplete });

      // 打开弹窗
      await openUpgradeModal(user, '主城');

      // 点击确认升级
      const confirmBtn = getModalConfirmButton();
      await user.click(confirmBtn);

      // onUpgradeComplete 通过 setTimeout(100ms) 调用
      await waitFor(() => {
        expect(onUpgradeComplete).toHaveBeenCalledWith('castle');
      }, { timeout: 300 });
    });
  });

  // 3. 错误处理测试
  describe('3. 错误处理测试', () => {
    it('升级失败时 engine.upgradeBuilding 应被调用并抛出错误', async () => {
      const user = userEvent.setup();
      const { engine } = renderBuildingPanel({
        engineOptions: { upgradeShouldThrow: true },
      });

      await openUpgradeModal(user, '主城');
      const confirmBtn = getModalConfirmButton();
      await user.click(confirmBtn);

      expect(engine.upgradeBuilding).toHaveBeenCalledWith('castle');
      // upgradeBuilding 内部抛出错误，被 handleUpgradeConfirm catch
    });

    it('升级失败时弹窗不应关闭（保持打开）', async () => {
      const user = userEvent.setup();
      renderBuildingPanel({ engineOptions: { upgradeShouldThrow: true } });

      await openUpgradeModal(user, '主城');
      const confirmBtn = getModalConfirmButton();
      await user.click(confirmBtn);

      // 弹窗应仍然存在（因为升级失败）
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });

  // 4. 升级中状态测试
  describe('4. 升级中状态测试', () => {
    it('升级中的建筑应显示进度条', () => {
      const buildings = createAllBuildings({
        farmland: { status: 'upgrading', level: 1 },
      });
      renderBuildingPanel({
        buildings,
        engineOptions: { progress: 0.6, remaining: 45 },
      });

      // 进度条应存在
      const progressBar = document.querySelector('.tk-bld-pin-progress-bar');
      expect(progressBar).toBeTruthy();
      expect((progressBar as HTMLElement).style.width).toBe('60%');
    });

    it('升级中的建筑不可再次升级', () => {
      const buildings = createAllBuildings({
        farmland: { status: 'upgrading', level: 1 },
      });
      renderBuildingPanel({
        buildings,
        engineOptions: { progress: 0.3, remaining: 60 },
      });

      // 升级中的标记不应有升级按钮
      const farmlandPin = getMapPin('农田');
      const upgradeBtns = within(farmlandPin).queryAllByRole('button', { name: /升级/ });
      expect(upgradeBtns.length).toBe(0);

      // 应显示升级中的进度时间
      const upgradingTime = within(farmlandPin).queryByText(/01:00/);
      expect(upgradingTime).toBeTruthy();
    });

    it('升级队列应显示升级中建筑的数量', () => {
      const buildings = createAllBuildings({
        farmland: { status: 'upgrading', level: 1 },
        market: { status: 'upgrading', level: 1 },
      });
      renderBuildingPanel({
        buildings,
        engineOptions: { progress: 0.5, remaining: 30 },
      });

      // 升级队列标题应显示数量
      const queueTitle = screen.getByText(/升级中 \(2\)/);
      expect(queueTitle).toBeTruthy();
    });

    it('点击锁定建筑不应打开弹窗', async () => {
      const user = userEvent.setup();
      const buildings = createAllBuildings({
        smithy: { status: 'locked', level: 0 },
      });
      renderBuildingPanel({ buildings });

      // 锁定标记没有 role="button"（tabIndex=-1），用 DOM query
      const lockedPin = document.querySelector('.tk-bld-pin--locked');
      expect(lockedPin).toBeTruthy();

      // 点击锁定标记
      await user.click(lockedPin!);

      // 不应出现弹窗
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('点击弹窗取消按钮应关闭弹窗', async () => {
      const user = userEvent.setup();
      renderBuildingPanel();

      // 打开弹窗
      await openUpgradeModal(user, '主城');
      expect(screen.getByRole('dialog')).toBeTruthy();

      // 点击弹窗内的取消按钮
      const cancelBtn = getModalCancelButton();
      await user.click(cancelBtn);

      // 弹窗应关闭
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });

    it('点击弹窗关闭按钮(×)应关闭弹窗', async () => {
      const user = userEvent.setup();
      renderBuildingPanel();

      await openUpgradeModal(user, '主城');
      expect(screen.getByRole('dialog')).toBeTruthy();

      // 点击关闭按钮
      const closeBtn = getModalCloseButton();
      await user.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
    });
  });
});
