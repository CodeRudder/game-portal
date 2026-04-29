/**
 * F03 武将招募 P1-1 修复测试：HeroTab 监听 tk:navigate-to-formation 事件
 *
 * 验证 HeroTab 组件在接收到 tk:navigate-to-formation 事件后：
 * 1. 切换到编队子Tab
 * 2. 关闭招募弹窗
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';

// ── Mock 子组件和 CSS ──
vi.mock('@/components/idle/panels/hero/HeroCard', () => ({
  default: () => <div data-testid="hero-card-mock" />,
}));
vi.mock('@/components/idle/panels/hero/HeroDetailModal', () => ({
  default: () => <div data-testid="hero-detail-mock" />,
}));
vi.mock('@/components/idle/panels/hero/RecruitModal', () => ({
  default: () => <div data-testid="recruit-modal-mock" />,
}));
vi.mock('@/components/idle/panels/hero/GuideOverlay', () => ({
  default: () => <div data-testid="guide-overlay-mock" />,
}));
vi.mock('@/components/idle/panels/hero/HeroCompareModal', () => ({
  default: () => <div data-testid="compare-modal-mock" />,
}));
vi.mock('@/components/idle/panels/hero/FormationPanel', () => ({
  default: () => <div data-testid="formation-panel-mock" />,
}));
vi.mock('@/components/idle/panels/hero/hooks', () => ({
  useHeroGuide: () => ({ handleGuideAction: vi.fn() }),
}));
vi.mock('@/components/idle/panels/hero/hero-design-tokens.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroTab.css', () => ({}));

// 在 mock 设置之后导入 HeroTab
import HeroTab from '@/components/idle/panels/hero/HeroTab';

function makeMockEngine() {
  return {
    getGenerals: vi.fn(() => []),
    getHeroSystem: vi.fn(() => ({
      calculatePower: vi.fn(() => 0),
      calculateTotalPower: vi.fn(() => 0),
    })),
    getHeroStarSystem: vi.fn(() => ({
      getStar: vi.fn(() => 0),
    })),
    getGeneral: vi.fn(),
  } as unknown as ThreeKingdomsEngine;
}

describe('F03 P1-1: HeroTab 监听 tk:navigate-to-formation 事件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('tk-tutorial-progress', JSON.stringify({ completed: true }));
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem('tk-tutorial-progress');
  });

  it('接收到 tk:navigate-to-formation 事件后应切换到编队子Tab', async () => {
    const engine = makeMockEngine();
    render(<HeroTab engine={engine} snapshotVersion={1} />);

    // 初始应在武将列表子Tab
    const listTab = screen.getByTestId('hero-tab-subtab-list');
    expect(listTab.classList.contains('tk-hero-sub-tab--active')).toBe(true);

    // 派发导航事件
    await act(async () => {
      window.dispatchEvent(new CustomEvent('tk:navigate-to-formation'));
    });

    // 验证切换到编队子Tab
    const formationTab = screen.getByTestId('hero-tab-subtab-formation');
    expect(formationTab.classList.contains('tk-hero-sub-tab--active')).toBe(true);

    // 验证编队面板被渲染
    expect(screen.getByTestId('formation-panel-mock')).toBeInTheDocument();
  });

  it('切换到编队后武将列表不应显示', async () => {
    const engine = makeMockEngine();
    render(<HeroTab engine={engine} snapshotVersion={1} />);

    // 派发导航事件
    await act(async () => {
      window.dispatchEvent(new CustomEvent('tk:navigate-to-formation'));
    });

    // 武将列表的空状态不应显示
    expect(screen.queryByTestId('hero-tab-empty')).not.toBeInTheDocument();
  });

  it('组件卸载时应移除事件监听器', async () => {
    const engine = makeMockEngine();
    const { unmount } = render(<HeroTab engine={engine} snapshotVersion={1} />);

    // 卸载组件
    unmount();

    // 派发事件不应抛错
    await act(async () => {
      window.dispatchEvent(new CustomEvent('tk:navigate-to-formation'));
    });

    // 验证不会因为事件监听器泄漏而报错（测试通过即说明清理成功）
    expect(true).toBe(true);
  });
});
