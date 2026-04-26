/**
 * BuildingUpgradeModal 单元测试
 *
 * 测试场景：
 * - 渲染弹窗（始终渲染，由父组件控制显隐）
 * - 显示建筑名称+描述+等级
 * - 显示升级费用明细
 * - 资源不足时确认按钮灰显+提示
 * - 点击确认触发onUpgrade回调
 * - 点击取消/遮罩关闭弹窗
 * - ESC键关闭弹窗
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock CSS ──
vi.mock('../BuildingUpgradeModal.css', () => ({}));

// ── Mock 引擎模块 — 使用 vi.hoisted 避免提升时变量引用问题 ──
const { mockBuildingLabels, mockBuildingIcons, mockBuildingZones, mockBuildingTypes } = vi.hoisted(() => {
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
  BUILDING_DEFS: {
    castle: { type: 'castle', maxLevel: 30, levelTable: [] },
    farmland: { type: 'farmland', maxLevel: 25, levelTable: [] },
    market: { type: 'market', maxLevel: 25, levelTable: [] },
    barracks: { type: 'barracks', maxLevel: 25, levelTable: [] },
    smithy: { type: 'smithy', maxLevel: 20, levelTable: [] },
    academy: { type: 'academy', maxLevel: 20, levelTable: [] },
    clinic: { type: 'clinic', maxLevel: 20, levelTable: [] },
    wall: { type: 'wall', maxLevel: 20, levelTable: [] },
  },
}));

vi.mock('@/games/three-kingdoms/engine/ThreeKingdomsEngine', () => ({}));

// ── 导入被测组件（在 mock 之后）──
import BuildingUpgradeModal from '../BuildingUpgradeModal';

// ── 类型 ──
type BuildingType = 'castle' | 'farmland' | 'market' | 'barracks' | 'smithy' | 'academy' | 'clinic' | 'wall';

// ── 创建 mock engine ──
function createMockEngine(overrides?: {
  canUpgrade?: boolean;
  reasons?: string[];
  cost?: { grain: number; gold: number; troops: number; timeSeconds: number };
  level?: number;
  status?: string;
}) {
  const buildings: Record<string, any> = {};
  const types: BuildingType[] = ['castle', 'farmland', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall'];
  for (const t of types) {
    buildings[t] = {
      type: t,
      level: overrides?.level ?? 3,
      status: overrides?.status ?? 'idle',
      upgradeStartTime: null,
      upgradeEndTime: null,
    };
  }

  return {
    checkUpgrade: vi.fn().mockReturnValue({
      canUpgrade: overrides?.canUpgrade ?? true,
      reasons: overrides?.reasons ?? [],
    }),
    getUpgradeCost: vi.fn().mockReturnValue(
      overrides?.cost ?? { grain: 200, gold: 100, troops: 10, timeSeconds: 60 },
    ),
    getSnapshot: vi.fn().mockReturnValue({
      buildings,
      resources: { grain: 1000, gold: 500, troops: 200, mandate: 10 },
      productionRates: { grain: 1, gold: 0.5, troops: 0.2, mandate: 0 },
      caps: { grain: 5000, gold: 3000, troops: 1000, mandate: null },
      onlineSeconds: 0,
    }),
  };
}

const defaultResources = { grain: 1000, gold: 500, troops: 200, mandate: 10 };
const poorResources = { grain: 50, gold: 10, troops: 0, mandate: 0 };

describe('BuildingUpgradeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应渲染弹窗并显示建筑名称和等级', () => {
    const engine = createMockEngine({ level: 3 });

    render(
      <BuildingUpgradeModal
        buildingType="farmland"
        engine={engine as any}
        resources={defaultResources}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // 弹窗应存在
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 显示建筑名称（SharedPanel 标题和组件内部都会出现"农田"）
    const farmTexts = screen.getAllByText(/农田/);
    expect(farmTexts.length).toBeGreaterThanOrEqual(1);

    // 显示当前等级
    expect(screen.getByText('Lv.3')).toBeInTheDocument();
  });

  it('应显示升级预览（等级变化）', () => {
    const engine = createMockEngine({ level: 3 });

    render(
      <BuildingUpgradeModal
        buildingType="farmland"
        engine={engine as any}
        resources={defaultResources}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // 显示等级变化
    expect(screen.getByText('Lv.3 → Lv.4')).toBeInTheDocument();
  });

  it('应显示升级费用明细', () => {
    const engine = createMockEngine({
      cost: { grain: 200, gold: 100, troops: 10, timeSeconds: 60 },
    });

    render(
      <BuildingUpgradeModal
        buildingType="farmland"
        engine={engine as any}
        resources={defaultResources}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // 显示升级消耗标题
    expect(screen.getByText('升级消耗')).toBeInTheDocument();

    // 费用明细区域应存在
    const costsSection = screen.getByText('升级消耗').closest('.tk-upgrade-section');
    expect(costsSection).toBeTruthy();

    // 费用图标应存在于明细中（通过 .tk-upgrade-cost-icon 查找）
    const costIcons = costsSection!.querySelectorAll('.tk-upgrade-cost-icon');
    expect(costIcons.length).toBe(4); // grain, gold, troops, time

    // 显示具体费用数值
    expect(screen.getByText('200')).toBeInTheDocument(); // grain cost
    expect(screen.getByText('100')).toBeInTheDocument(); // gold cost
    expect(screen.getByText('10')).toBeInTheDocument();  // troops cost
  });

  it('资源不足时确认按钮应灰显并显示提示', () => {
    const engine = createMockEngine({
      canUpgrade: false,
      reasons: ['粮草不足'],
      cost: { grain: 5000, gold: 3000, troops: 100, timeSeconds: 60 },
    });

    render(
      <BuildingUpgradeModal
        buildingType="farmland"
        engine={engine as any}
        resources={poorResources}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // 确认按钮应显示 "无法升级"（因为 canUpgrade=false 优先于 canAfford 检查）
    const confirmBtn = screen.getByText('无法升级');
    expect(confirmBtn).toBeInTheDocument();

    // 按钮应该是 disabled 的
    const button = confirmBtn.closest('button');
    expect(button?.disabled).toBe(true);

    // 应显示不足原因
    expect(screen.getByText(/❌ 粮草不足/)).toBeInTheDocument();
  });

  it('点击确认应触发onUpgrade回调', () => {
    const onConfirm = vi.fn();
    const engine = createMockEngine({ canUpgrade: true });

    render(
      <BuildingUpgradeModal
        buildingType="farmland"
        engine={engine as any}
        resources={defaultResources}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    // 点击确认按钮
    const confirmBtn = screen.getByText('▲ 升级');
    fireEvent.click(confirmBtn);

    // 应触发回调并传入建筑类型
    expect(onConfirm).toHaveBeenCalledWith('farmland');
  });

  it('点击取消应触发onCancel回调', () => {
    const onCancel = vi.fn();
    const engine = createMockEngine();

    render(
      <BuildingUpgradeModal
        buildingType="farmland"
        engine={engine as any}
        resources={defaultResources}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    // 点击取消按钮
    const cancelBtn = screen.getByText('取消');
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层应触发onCancel回调', () => {
    const onCancel = vi.fn();
    const engine = createMockEngine();

    const { container } = render(
      <BuildingUpgradeModal
        buildingType="farmland"
        engine={engine as any}
        resources={defaultResources}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    // 点击遮罩层（overlay = SharedPanel 的外层 div）
    const overlay = container.querySelector('.tk-shared-panel-overlay')!;
    fireEvent.click(overlay);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('按ESC键应触发onCancel回调', () => {
    const onCancel = vi.fn();
    const engine = createMockEngine();

    render(
      <BuildingUpgradeModal
        buildingType="farmland"
        engine={engine as any}
        resources={defaultResources}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    // 模拟 ESC 键
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
