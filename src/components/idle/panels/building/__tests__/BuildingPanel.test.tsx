/**
 * BuildingPanel 单元测试
 *
 * 测试场景：
 * - 渲染8个建筑标记（地图布局）
 * - 每个标记显示名称+等级
 * - 点击建筑打开升级弹窗
 * - 资源不足时升级指示器状态
 * - 升级中显示进度条
 * - 建筑状态显示（空闲/升级中/锁定）
 * - 升级队列显示
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock CSS ──
vi.mock('../BuildingPanel.css', () => ({}));
vi.mock('../BuildingUpgradeModal.css', () => ({}));

// ── Mock 引擎模块 — 使用 vi.hoisted 避免提升时变量引用问题 ──
const { mockBuildingTypes, mockBuildingLabels, mockBuildingIcons, mockBuildingZones } = vi.hoisted(() => {
  const BUILDING_TYPES = ['castle', 'farmland', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall'] as const;
  const BUILDING_LABELS = {
    castle: '主城', farmland: '农田', market: '市集', barracks: '兵营',
    smithy: '铁匠铺', academy: '书院', clinic: '医馆', wall: '城墙',
  };
  const BUILDING_ICONS = {
    castle: '🏛️', farmland: '🌾', market: '💰', barracks: '⚔️',
    smithy: '🔨', academy: '📚', clinic: '🏥', wall: '🏯',
  };
  const BUILDING_ZONES = {
    castle: 'core', farmland: 'civilian', market: 'civilian', barracks: 'military',
    smithy: 'military', academy: 'cultural', clinic: 'cultural', wall: 'defense',
  };
  return {
    mockBuildingTypes: BUILDING_TYPES,
    mockBuildingLabels: BUILDING_LABELS,
    mockBuildingIcons: BUILDING_ICONS,
    mockBuildingZones: BUILDING_ZONES,
  };
});

vi.mock('@/games/three-kingdoms/engine', () => ({
  BUILDING_TYPES: mockBuildingTypes,
  BUILDING_LABELS: mockBuildingLabels,
  BUILDING_ICONS: mockBuildingIcons,
  BUILDING_ZONES: mockBuildingZones,
  RESOURCE_LABELS: { grain: '粮草', gold: '铜钱', troops: '兵力', mandate: '天命' },
}));

vi.mock('@/games/three-kingdoms/engine/ThreeKingdomsEngine', () => ({}));

// ── Mock BuildingUpgradeModal ──
vi.mock('../BuildingUpgradeModal', () => ({
  default: ({ buildingType, onConfirm, onCancel }: any) => (
    <div data-testid="upgrade-modal">
      <div>升级预览</div>
      <button onClick={() => onConfirm(buildingType)}>确认升级</button>
      <button onClick={onCancel}>取消</button>
    </div>
  ),
}));

// ── 导入被测组件（在 mock 之后）──
import BuildingPanel from '../BuildingPanel';

// ── 类型 ──
type BuildingType = 'castle' | 'farmland' | 'market' | 'barracks' | 'smithy' | 'academy' | 'clinic' | 'wall';

interface BuildingState {
  type: BuildingType;
  level: number;
  status: 'locked' | 'idle' | 'upgrading';
  upgradeStartTime: number | null;
  upgradeEndTime: number | null;
}

interface MockEngine {
  checkUpgrade: ReturnType<typeof vi.fn>;
  getUpgradeCost: ReturnType<typeof vi.fn>;
  getUpgradeProgress: ReturnType<typeof vi.fn>;
  getUpgradeRemainingTime: ReturnType<typeof vi.fn>;
  upgradeBuilding: ReturnType<typeof vi.fn>;
  getSnapshot: ReturnType<typeof vi.fn>;
}

// ── 创建 mock buildings ──
function createMockBuildings(
  overrides?: Partial<Record<BuildingType, Partial<BuildingState>>>,
): Record<BuildingType, BuildingState> {
  const buildings = {} as Record<BuildingType, BuildingState>;
  for (const type of mockBuildingTypes) {
    buildings[type as BuildingType] = {
      type: type as BuildingType,
      level: 1,
      status: 'idle',
      upgradeStartTime: null,
      upgradeEndTime: null,
      ...overrides?.[type as BuildingType],
    };
  }
  return buildings;
}

// ── 创建 mock engine ──
function createMockEngine(overrides?: {
  canUpgrade?: boolean;
  cost?: { grain: number; gold: number; troops: number; timeSeconds: number };
  progress?: number;
  remaining?: number;
}): MockEngine {
  return {
    checkUpgrade: vi.fn().mockReturnValue({
      canUpgrade: overrides?.canUpgrade ?? true,
      reasons: [],
    }),
    getUpgradeCost: vi.fn().mockReturnValue(
      overrides?.cost ?? { grain: 100, gold: 50, troops: 0, timeSeconds: 30 },
    ),
    getUpgradeProgress: vi.fn().mockReturnValue(overrides?.progress ?? 0),
    getUpgradeRemainingTime: vi.fn().mockReturnValue(overrides?.remaining ?? 0),
    upgradeBuilding: vi.fn(),
    cancelUpgrade: vi.fn().mockReturnValue(null),
    building: {
      getProduction: vi.fn().mockReturnValue(1.0),
    },
    getSnapshot: vi.fn().mockReturnValue({
      buildings: createMockBuildings(),
      resources: { grain: 1000, gold: 500, troops: 200, mandate: 10 },
      productionRates: { grain: 1, gold: 0.5, troops: 0.2, mandate: 0 },
      caps: { grain: 5000, gold: 3000, troops: 1000, mandate: null },
      onlineSeconds: 0,
    }),
  } as unknown as MockEngine;
}

// ── 默认 props ──
const defaultResources = { grain: 1000, gold: 500, troops: 200, mandate: 10 };
const defaultRates = { grain: 1, gold: 0.5, troops: 0.2, mandate: 0, techPoint: 0, recruitToken: 0 };
const defaultCaps = { grain: 5000, gold: 3000, troops: 1000, mandate: null };

// ── 测试 ──
describe('BuildingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应渲染8个建筑标记（地图布局）', () => {
    const engine = createMockEngine();
    const buildings = createMockBuildings();

    render(
      <BuildingPanel
        buildings={buildings}
        resources={defaultResources}
        rates={defaultRates}
        caps={defaultCaps}
        engine={engine as any}
      />,
    );

    // 验证所有建筑名称都出现在文档中
    for (const type of mockBuildingTypes) {
      const label = mockBuildingLabels[type as keyof typeof mockBuildingLabels];
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('应渲染地图容器（tk-bld-map）', () => {
    const engine = createMockEngine();
    const buildings = createMockBuildings();

    render(
      <BuildingPanel
        buildings={buildings}
        resources={defaultResources}
        rates={defaultRates}
        caps={defaultCaps}
        engine={engine as any}
      />,
    );

    // 地图容器应存在
    const map = document.querySelector('.tk-bld-map');
    expect(map).toBeTruthy();

    // 地图内应有8个建筑标记
    const pins = document.querySelectorAll('.tk-bld-pin');
    expect(pins.length).toBe(8);
  });

  it('每个建筑标记应显示名称和等级', () => {
    const engine = createMockEngine();
    const buildings = createMockBuildings();

    render(
      <BuildingPanel
        buildings={buildings}
        resources={defaultResources}
        rates={defaultRates}
        caps={defaultCaps}
        engine={engine as any}
      />,
    );

    // 检查等级徽章（每个非锁定建筑都有等级badge显示 "Lv.1"）
    const badges = screen.getAllByText('Lv.1');
    expect(badges.length).toBe(8); // 8个建筑都是 Lv.1

    // 检查 aria-label 包含名称和等级
    const pins = screen.getAllByRole('button', { hidden: true });
    const pinsWithLabels = pins.filter(pin =>
      pin.getAttribute('aria-label')?.includes('Lv.1'),
    );
    expect(pinsWithLabels.length).toBe(8);
  });

  it('点击建筑标记应打开升级弹窗', () => {
    const engine = createMockEngine({ canUpgrade: true });
    const buildings = createMockBuildings();

    render(
      <BuildingPanel
        buildings={buildings}
        resources={defaultResources}
        rates={defaultRates}
        caps={defaultCaps}
        engine={engine as any}
      />,
    );

    // 点击第一个可点击的建筑标记
    const clickablePins = screen.getAllByRole('button', { hidden: true }).filter(
      el => el.getAttribute('aria-label')?.includes('Lv.'),
    );
    expect(clickablePins.length).toBeGreaterThan(0);

    fireEvent.click(clickablePins[0]);

    // 应该出现升级弹窗
    expect(screen.getByTestId('upgrade-modal')).toBeInTheDocument();
  });

  it('资源不足时建筑标记无升级指示器', () => {
    const engine = createMockEngine({ canUpgrade: false });
    const buildings = createMockBuildings();

    render(
      <BuildingPanel
        buildings={buildings}
        resources={defaultResources}
        rates={defaultRates}
        caps={defaultCaps}
        engine={engine as any}
      />,
    );

    // 可升级指示器不应存在
    const indicators = document.querySelectorAll('.tk-bld-pin-upgrade-indicator');
    expect(indicators.length).toBe(0);
  });

  it('升级中应显示进度条', () => {
    const engine = createMockEngine({
      canUpgrade: false,
      progress: 0.45,
      remaining: 60,
    });
    const buildings = createMockBuildings({
      farmland: { status: 'upgrading', level: 1 },
    });

    render(
      <BuildingPanel
        buildings={buildings}
        resources={defaultResources}
        rates={defaultRates}
        caps={defaultCaps}
        engine={engine as any}
      />,
    );

    // 进度条应存在
    const progressBar = document.querySelector('.tk-bld-pin-progress-bar');
    expect(progressBar).toBeTruthy();
    expect((progressBar as HTMLElement).style.width).toBe('45%');
  });

  it('应正确显示建筑状态（空闲/升级中/锁定）', () => {
    const engine = createMockEngine({ canUpgrade: true });
    const buildings = createMockBuildings({
      castle: { status: 'idle', level: 3 },
      farmland: { status: 'upgrading', level: 2 },
      market: { status: 'locked', level: 0 },
    });

    render(
      <BuildingPanel
        buildings={buildings}
        resources={defaultResources}
        rates={defaultRates}
        caps={defaultCaps}
        engine={engine as any}
      />,
    );

    // 锁定的建筑显示 "未解锁"
    expect(screen.getAllByText('未解锁').length).toBeGreaterThan(0);

    // 锁定建筑显示🔒图标
    const lockedIcons = screen.getAllByText('🔒');
    expect(lockedIcons.length).toBeGreaterThanOrEqual(1);

    // 可升级建筑应有升级指示器
    const indicators = document.querySelectorAll('.tk-bld-pin-upgrade-indicator');
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('升级队列应显示升级中的建筑数量', () => {
    const engine = createMockEngine({
      canUpgrade: false,
      progress: 0.5,
      remaining: 30,
    });
    const buildings = createMockBuildings({
      farmland: { status: 'upgrading', level: 1 },
      barracks: { status: 'upgrading', level: 2 },
    });

    render(
      <BuildingPanel
        buildings={buildings}
        resources={defaultResources}
        rates={defaultRates}
        caps={defaultCaps}
        engine={engine as any}
      />,
    );

    // 升级队列应显示 2 个升级中的建筑
    expect(screen.getByText(/升级中 \(2\)/)).toBeInTheDocument();
  });

  it('建筑标记应使用绝对定位', () => {
    const engine = createMockEngine();
    const buildings = createMockBuildings();

    render(
      <BuildingPanel
        buildings={buildings}
        resources={defaultResources}
        rates={defaultRates}
        caps={defaultCaps}
        engine={engine as any}
      />,
    );

    // 检查地图容器使用相对定位
    const map = document.querySelector('.tk-bld-map');
    expect(map).toBeTruthy();

    // 检查建筑标记使用绝对定位
    const pins = document.querySelectorAll('.tk-bld-pin');
    expect(pins.length).toBe(8);

    // 每个标记应有 top 和 left 内联样式
    pins.forEach(pin => {
      const style = (pin as HTMLElement).style;
      expect(style.top).toBeTruthy();
      expect(style.left).toBeTruthy();
    });
  });
});
