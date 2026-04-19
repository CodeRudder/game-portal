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
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock CSS ──
vi.mock('../BuildingUpgradeModal.css', () => ({}));

// ── Mock 引擎模块 ──
type BuildingType = 'castle' | 'farmland' | 'market' | 'barracks' | 'smithy' | 'academy' | 'clinic' | 'wall';

const BUILDING_LABELS: Record<BuildingType, string> = {
  castle: '主城', farmland: '农田', market: '市集', barracks: '兵营',
  smithy: '铁匠铺', academy: '书院', clinic: '医馆', wall: '城墙',
};

const BUILDING_ICONS: Record<BuildingType, string> = {
  castle: '🏛️', farmland: '🌾', market: '💰', barracks: '⚔️',
  smithy: '🔨', academy: '📚', clinic: '🏥', wall: '🏯',
};

const BUILDING_ZONES: Record<BuildingType, string> = {
  castle: 'core', farmland: 'civilian', market: 'civilian', barracks: 'military',
  smithy: 'military', academy: 'cultural', clinic: 'cultural', wall: 'defense',
};

vi.mock('@/games/three-kingdoms/engine', () => ({
  BUILDING_TYPES: ['castle', 'farmland', 'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall'],
  BUILDING_LABELS,
  BUILDING_ICONS,
  BUILDING_ZONES,
}));

vi.mock('@/games/three-kingdoms/engine/ThreeKingdomsEngine', () => ({}));

// ── 导入被测组件（在 mock 之后）──
import BuildingUpgradeModal from '../BuildingUpgradeModal';

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

    // 显示建筑名称
    expect(screen.getByText(/农田/)).toBeInTheDocument();

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

    // 费用明细包含粮草、铜钱、兵力图标
    expect(screen.getByText('🌾')).toBeInTheDocument();
    expect(screen.getByText('💰')).toBeInTheDocument();
    expect(screen.getByText('⚔️')).toBeInTheDocument();

    // 显示时间图标
    expect(screen.getByText('⏱️')).toBeInTheDocument();
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

    // 确认按钮应显示 "资源不足"
    const confirmBtn = screen.getByText('资源不足');
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

    render(
      <BuildingUpgradeModal
        buildingType="farmland"
        engine={engine as any}
        resources={defaultResources}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    // 点击遮罩层（overlay）
    const overlay = screen.getByRole('dialog').parentElement!;
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
