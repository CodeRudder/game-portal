/**
 * HeroUpgradePanel 组件集成测试
 *
 * 覆盖场景：
 * - 渲染当前等级和经验
 * - +1/+5/+10按钮正确计算目标等级
 * - 升级消耗正确显示
 * - 资源不足时按钮禁用
 * - 升级成功回调触发
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import HeroUpgradePanel from '../HeroUpgradePanel';
import type { HeroUpgradePanelProps } from '../HeroUpgradePanel';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import { Quality } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { EnhancePreview } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

vi.mock('../HeroUpgradePanel.css', () => ({}));
vi.mock('../atoms/AttributeBar.css', () => ({}));
vi.mock('../atoms/ResourceCost.css', () => ({}));
vi.mock('../atoms/QualityBadge.css', () => ({}));
vi.mock('../atoms/StarDisplay.css', () => ({}));
vi.mock('@/components/idle/common/Toast', () => ({
  Toast: {
    success: vi.fn(),
    danger: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
  },
}));

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeGeneral(overrides: Partial<GeneralData> = {}): GeneralData {
  return {
    id: 'guanyu',
    name: '关羽',
    quality: Quality.LEGENDARY,
    baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
    level: 10,
    exp: 500,
    faction: 'shu',
    skills: [],
    ...overrides,
  };
}

function makeEnhancePreview(overrides: Partial<EnhancePreview> = {}): EnhancePreview {
  return {
    generalId: 'guanyu',
    generalName: '关羽',
    currentLevel: 10,
    targetLevel: 11,
    totalExp: 1000,
    totalGold: 500,
    statsDiff: {
      before: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
      after: { attack: 125, defense: 95, intelligence: 68, speed: 80 },
    },
    powerBefore: 1000,
    powerAfter: 1100,
    affordable: true,
    ...overrides,
  };
}

function makeMockEngine(options: {
  affordable?: boolean;
  enhanceResult?: any;
  goldAmount?: number;
  expAmount?: number;
} = {}) {
  const {
    affordable = true,
    enhanceResult = { levelsGained: 1, goldSpent: 500, expSpent: 1000 },
    goldAmount = 10000,
    expAmount = 10000,
  } = options;

  const preview = makeEnhancePreview({ affordable });

  return {
    getLevelSystem: vi.fn(() => ({
      getExpProgress: vi.fn(() => ({
        current: 500,
        required: 1000,
        percentage: 50,
      })),
    })),
    getHeroSystem: vi.fn(() => ({})),
    getResourceAmount: vi.fn((type: string) => {
      if (type === 'gold') return goldAmount;
      if (type === 'grain') return expAmount;
      return 0;
    }),
    getEnhancePreview: vi.fn(() => preview),
    enhanceHero: vi.fn(() => enhanceResult),
  } as unknown as ThreeKingdomsEngine;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('HeroUpgradePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染当前等级和经验
  // ═══════════════════════════════════════════

  it('应渲染当前等级', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine();
    render(<HeroUpgradePanel general={general} engine={engine} />);
    expect(screen.getByTestId('hero-upgrade-panel')).toBeInTheDocument();
    expect(screen.getByText(/Lv\.10/)).toBeInTheDocument();
  });

  it('应渲染经验进度', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine();
    render(<HeroUpgradePanel general={general} engine={engine} />);
    // 经验标签区域应存在（包含 "经验" 文本和数值）
    const expLabels = screen.getAllByText(/经验/);
    expect(expLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('应渲染标题"强化升级"', () => {
    const general = makeGeneral();
    const engine = makeMockEngine();
    render(<HeroUpgradePanel general={general} engine={engine} />);
    expect(screen.getByText('强化升级')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. +1/+5/+10按钮正确计算目标等级
  // ═══════════════════════════════════════════

  it('应渲染+1/+5/+10目标等级按钮', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine();
    render(<HeroUpgradePanel general={general} engine={engine} />);
    expect(screen.getByTestId('upgrade-target-+1')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-target-+5')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-target-+10')).toBeInTheDocument();
  });

  it('点击+1按钮应设置目标等级为当前等级+1', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine();
    render(<HeroUpgradePanel general={general} engine={engine} />);

    const btnPlus1 = screen.getByTestId('upgrade-target-+1');
    fireEvent.click(btnPlus1);

    // 目标等级应显示为11
    expect(screen.getByText(/目标等级/).textContent).toContain('11');
  });

  it('点击+5按钮应设置目标等级为当前等级+5', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine();
    render(<HeroUpgradePanel general={general} engine={engine} />);

    const btnPlus5 = screen.getByTestId('upgrade-target-+5');
    fireEvent.click(btnPlus5);

    expect(screen.getByText(/目标等级/).textContent).toContain('15');
  });

  it('点击+10按钮应设置目标等级为当前等级+10', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine();
    render(<HeroUpgradePanel general={general} engine={engine} />);

    const btnPlus10 = screen.getByTestId('upgrade-target-+10');
    fireEvent.click(btnPlus10);

    expect(screen.getByText(/目标等级/).textContent).toContain('20');
  });

  // ═══════════════════════════════════════════
  // 3. 升级消耗正确显示
  // ═══════════════════════════════════════════

  it('应显示消耗资源区域', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine();
    render(<HeroUpgradePanel general={general} engine={engine} />);
    expect(screen.getByText('消耗资源')).toBeInTheDocument();
  });

  it('应显示铜钱和经验消耗', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine();
    render(<HeroUpgradePanel general={general} engine={engine} />);
    // ResourceCost组件渲染资源列表
    expect(screen.getByTestId('resource-cost')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 资源不足时按钮禁用
  // ═══════════════════════════════════════════

  it('资源不足时升级按钮应禁用', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine({ affordable: false });
    render(<HeroUpgradePanel general={general} engine={engine} />);

    const enhanceBtn = screen.getByTestId('upgrade-panel-enhance-btn');
    expect(enhanceBtn).toBeDisabled();
  });

  it('资源不足时按钮应显示"资源不足"', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine({ affordable: false });
    render(<HeroUpgradePanel general={general} engine={engine} />);

    const enhanceBtn = screen.getByTestId('upgrade-panel-enhance-btn');
    expect(enhanceBtn.textContent).toContain('资源不足');
  });

  it('资源充足时按钮应可点击', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine({ affordable: true });
    render(<HeroUpgradePanel general={general} engine={engine} />);

    const enhanceBtn = screen.getByTestId('upgrade-panel-enhance-btn');
    expect(enhanceBtn).not.toBeDisabled();
  });

  // ═══════════════════════════════════════════
  // 5. 升级成功回调触发
  // ═══════════════════════════════════════════

  it('点击升级按钮应调用engine.enhanceHero', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine({ affordable: true });
    const onUpgradeComplete = vi.fn();

    render(
      <HeroUpgradePanel
        general={general}
        engine={engine}
        onUpgradeComplete={onUpgradeComplete}
      />,
    );

    const enhanceBtn = screen.getByTestId('upgrade-panel-enhance-btn');
    fireEvent.click(enhanceBtn);

    expect(engine.enhanceHero).toHaveBeenCalledWith('guanyu', expect.any(Number));
  });

  it('升级成功应触发onUpgradeComplete回调', () => {
    const general = makeGeneral({ level: 10 });
    const engine = makeMockEngine({ affordable: true });
    const onUpgradeComplete = vi.fn();

    render(
      <HeroUpgradePanel
        general={general}
        engine={engine}
        onUpgradeComplete={onUpgradeComplete}
      />,
    );

    const enhanceBtn = screen.getByTestId('upgrade-panel-enhance-btn');
    fireEvent.click(enhanceBtn);

    expect(onUpgradeComplete).toHaveBeenCalledWith(general);
  });

  // ═══════════════════════════════════════════
  // 6. 关闭按钮
  // ═══════════════════════════════════════════

  it('提供onClose时应渲染关闭按钮', () => {
    const general = makeGeneral();
    const engine = makeMockEngine();
    const onClose = vi.fn();

    render(
      <HeroUpgradePanel general={general} engine={engine} onClose={onClose} />,
    );

    const closeBtn = screen.getByLabelText('关闭升级面板');
    expect(closeBtn).toBeInTheDocument();
  });

  it('点击关闭按钮应触发onClose回调', () => {
    const general = makeGeneral();
    const engine = makeMockEngine();
    const onClose = vi.fn();

    render(
      <HeroUpgradePanel general={general} engine={engine} onClose={onClose} />,
    );

    const closeBtn = screen.getByLabelText('关闭升级面板');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('不提供onClose时不渲染关闭按钮', () => {
    const general = makeGeneral();
    const engine = makeMockEngine();

    render(<HeroUpgradePanel general={general} engine={engine} />);
    expect(screen.queryByLabelText('关闭升级面板')).not.toBeInTheDocument();
  });
});
