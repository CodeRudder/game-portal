/**
 * F03 武将招募 P1-1 修复测试：招募成功后显示"前往编队"引导
 *
 * 验证点：
 * 1. RecruitModal 招募成功后应显示"前往编队"按钮
 * 2. 点击"前往编队"按钮应派发自定义事件 tk:navigate-to-formation
 * 3. HeroTab 监听 tk:navigate-to-formation 事件后应切换到编队子Tab
 * 4. 事件触发后应关闭招募弹窗
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import RecruitModal from '@/components/idle/panels/hero/RecruitModal';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { RecruitOutput, RecruitResult, HeroRecruitSystem } from '@/games/three-kingdoms/engine';
import { Quality } from '@/games/three-kingdoms/engine';

// ── Mock CSS ──
vi.mock('@/components/idle/panels/hero/RecruitModal.css', () => ({}));

// ── 测试数据工厂 ──

function makeRecruitResult(overrides: Partial<RecruitResult> = {}): RecruitResult {
  return {
    general: {
      id: 'guanyu',
      name: '关羽',
      quality: Quality.LEGENDARY,
      baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
      level: 1, exp: 0, faction: 'shu', skills: [],
    },
    isDuplicate: false,
    fragmentCount: 0,
    quality: Quality.LEGENDARY,
    ...overrides,
  };
}

function makeRecruitOutput(count: number, overrides: Partial<RecruitOutput> = {}): RecruitOutput {
  const results = Array.from({ length: count }, () => makeRecruitResult());
  return {
    type: 'normal',
    results,
    cost: { resourceType: 'recruitToken', amount: count === 10 ? 10 : 1 },
    ...overrides,
  };
}

function makeMockRecruitSystem(canAfford = true) {
  return {
    getRecruitCost: vi.fn((type: string, count: number) => ({
      resourceType: 'recruitToken', amount: count === 10 ? 10 : 1,
    })),
    canRecruit: vi.fn(() => canAfford),
    getGachaState: vi.fn(() => ({
      normalPity: 3, advancedPity: 5, normalHardPity: 10, advancedHardPity: 20,
    })),
    getRecruitHistory: vi.fn(() => []),
    getRemainingFreeCount: vi.fn(() => 0),
    canFreeRecruit: vi.fn(() => false),
    freeRecruitSingle: vi.fn(() => makeRecruitOutput(1)),
  } as unknown as HeroRecruitSystem;
}

function makeMockEngine(options: { canAfford?: boolean; recruitOutput?: RecruitOutput | null } = {}) {
  const { canAfford = true, recruitOutput = makeRecruitOutput(1) } = options;
  return {
    getRecruitSystem: vi.fn(() => makeMockRecruitSystem(canAfford)),
    recruit: vi.fn(() => recruitOutput),
    getHeroSystem: vi.fn(),
    getLevelSystem: vi.fn(),
    getResourceAmount: vi.fn(() => 1000),
  } as unknown as ThreeKingdomsEngine;
}

// ── 测试 ──

describe('F03 P1-1: 招募成功后显示"前往编队"引导', () => {
  const onClose = vi.fn();
  const onRecruitComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('招募成功后应渲染"前往编队"按钮', async () => {
    const engine = makeMockEngine();
    render(<RecruitModal engine={engine} onClose={onClose} onRecruitComplete={onRecruitComplete} />);

    // 执行单次招募
    const singleBtn = screen.getByText('单次招募').closest('button')!;
    await fireEvent.click(singleBtn);

    // 验证"前往编队"按钮出现
    const formationBtn = screen.getByTestId('recruit-goto-formation-btn');
    expect(formationBtn).toBeInTheDocument();
    expect(formationBtn.textContent).toContain('前往编队');
  });

  it('点击"前往编队"应派发 tk:navigate-to-formation 事件', async () => {
    const engine = makeMockEngine();
    const eventSpy = vi.fn();
    window.addEventListener('tk:navigate-to-formation', eventSpy);

    render(<RecruitModal engine={engine} onClose={onClose} onRecruitComplete={onRecruitComplete} />);

    // 执行招募
    const singleBtn = screen.getByText('单次招募').closest('button')!;
    await fireEvent.click(singleBtn);

    // 点击"前往编队"
    const formationBtn = screen.getByTestId('recruit-goto-formation-btn');
    await fireEvent.click(formationBtn);

    // 验证事件被派发
    expect(eventSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener('tk:navigate-to-formation', eventSpy);
  });

  it('点击"前往编队"应调用 onClose 关闭招募弹窗', async () => {
    const engine = makeMockEngine();
    render(<RecruitModal engine={engine} onClose={onClose} onRecruitComplete={onRecruitComplete} />);

    // 执行招募
    const singleBtn = screen.getByText('单次招募').closest('button')!;
    await fireEvent.click(singleBtn);

    // 点击"前往编队"
    const formationBtn = screen.getByTestId('recruit-goto-formation-btn');
    await fireEvent.click(formationBtn);

    // 验证 onClose 被调用
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('未招募时不应该显示"前往编队"按钮', () => {
    const engine = makeMockEngine();
    render(<RecruitModal engine={engine} onClose={onClose} onRecruitComplete={onRecruitComplete} />);

    // 初始状态不应该有"前往编队"按钮
    expect(screen.queryByTestId('recruit-goto-formation-btn')).not.toBeInTheDocument();
  });
});
