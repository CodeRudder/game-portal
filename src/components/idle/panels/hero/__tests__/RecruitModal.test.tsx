/**
 * RecruitModal UI 交互测试
 *
 * 覆盖场景：
 * - 招募弹窗正确渲染（标题、类型选项、按钮、保底进度）
 * - 切换普通/高级招募类型
 * - 单抽/十连按钮调用 engine.recruit
 * - 招募结果显示正确（新武将/重复碎片）
 * - 资源不足时按钮灰显
 * - 关闭弹窗功能
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecruitModal from '../RecruitModal';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { RecruitOutput, RecruitResult, HeroRecruitSystem } from '@/games/three-kingdoms/engine';
import { Quality } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mock helpers
// ─────────────────────────────────────────────

/** 创建单次招募结果 */
function makeRecruitResult(overrides: Partial<RecruitResult> = {}): RecruitResult {
  return {
    general: {
      id: 'guanyu',
      name: '关羽',
      quality: Quality.LEGENDARY,
      baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
      level: 1,
      exp: 0,
      faction: 'shu',
      skills: [],
    },
    isDuplicate: false,
    fragmentCount: 0,
    quality: Quality.LEGENDARY,
    ...overrides,
  };
}

/** 创建招募输出 */
function makeRecruitOutput(count: number, overrides: Partial<RecruitOutput> = {}): RecruitOutput {
  const results = Array.from({ length: count }, () => makeRecruitResult());
  return {
    type: 'normal',
    results,
    cost: { resourceType: 'gold', amount: count === 10 ? 1000 : 100 },
    ...overrides,
  };
}

/** 创建 mock recruitSystem */
function makeMockRecruitSystem(canAfford = true) {
  return {
    getRecruitCost: vi.fn((type: string, count: number) => {
      if (type === 'normal') {
        return { resourceType: 'gold', amount: count === 10 ? 1000 : 100 };
      }
      return { resourceType: 'recruitToken', amount: count === 10 ? 10 : 1 };
    }),
    canRecruit: vi.fn(() => canAfford),
    getGachaState: vi.fn(() => ({
      normalPity: 3,
      advancedPity: 5,
      normalHardPity: 10,
      advancedHardPity: 20,
    })),
  } as unknown as HeroRecruitSystem;
}

/** 创建 mock engine */
function makeMockEngine(options: {
  canAfford?: boolean;
  recruitOutput?: RecruitOutput | null;
} = {}) {
  const { canAfford = true, recruitOutput = makeRecruitOutput(1) } = options;

  return {
    getRecruitSystem: vi.fn(() => makeMockRecruitSystem(canAfford)),
    recruit: vi.fn(() => recruitOutput),
    getHeroSystem: vi.fn(),
    getLevelSystem: vi.fn(),
  } as unknown as ThreeKingdomsEngine;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('RecruitModal', () => {
  const defaultProps = {
    engine: makeMockEngine(),
    onClose: vi.fn(),
    onRecruitComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正确渲染招募弹窗标题', () => {
    render(<RecruitModal {...defaultProps} />);
    expect(screen.getByText('⚔️ 招贤纳士')).toBeInTheDocument();
  });

  it('应渲染普通招贤和高级招贤两个选项', () => {
    render(<RecruitModal {...defaultProps} />);
    expect(screen.getByText('普通招贤')).toBeInTheDocument();
    expect(screen.getByText('高级招贤')).toBeInTheDocument();
  });

  it('应渲染单次招募和十连招募按钮', () => {
    render(<RecruitModal {...defaultProps} />);
    expect(screen.getByText('单次招募')).toBeInTheDocument();
    expect(screen.getByText('十连招募')).toBeInTheDocument();
  });

  it('应渲染保底进度信息', () => {
    render(<RecruitModal {...defaultProps} />);
    // 保底进度标签
    expect(screen.getByText('十连保底（稀有+）')).toBeInTheDocument();
    expect(screen.getByText('硬保底（史诗+）')).toBeInTheDocument();
  });

  it('应渲染关闭按钮', () => {
    render(<RecruitModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 招募类型切换
  // ═══════════════════════════════════════════

  it('点击高级招贤应切换招募类型', async () => {
    const engine = makeMockEngine();
    render(<RecruitModal {...defaultProps} engine={engine} />);

    // 点击高级招贤按钮
    const advancedBtn = screen.getByText('高级招贤').closest('button')!;
    await userEvent.click(advancedBtn);

    // 验证消耗区域包含求贤令（精确匹配消耗显示，排除描述文本）
    const costElements = screen.getAllByText(/求贤令 ×\d+/);
    expect(costElements).toHaveLength(2);
  });

  it('默认选中普通招贤，显示铜钱消耗', () => {
    render(<RecruitModal {...defaultProps} />);
    // 消耗区域应包含铜钱（单抽和十连各一个，共2处）
    const costElements = screen.getAllByText(/铜钱 ×\d+/);
    expect(costElements).toHaveLength(2);
  });

  // ═══════════════════════════════════════════
  // 3. 单抽/十连调用 engine.recruit
  // ═══════════════════════════════════════════

  it('点击单次招募应调用 engine.recruit(type, 1)', async () => {
    const engine = makeMockEngine();
    render(<RecruitModal {...defaultProps} engine={engine} />);

    const singleBtn = screen.getByText('单次招募').closest('button')!;
    await userEvent.click(singleBtn);

    expect(engine.recruit).toHaveBeenCalledWith('normal', 1);
  });

  it('点击十连招募应调用 engine.recruit(type, 10)', async () => {
    const engine = makeMockEngine({
      recruitOutput: makeRecruitOutput(10),
    });
    render(<RecruitModal {...defaultProps} engine={engine} />);

    const tenBtn = screen.getByText('十连招募').closest('button')!;
    await userEvent.click(tenBtn);

    expect(engine.recruit).toHaveBeenCalledWith('normal', 10);
  });

  // ═══════════════════════════════════════════
  // 4. 招募结果显示
  // ═══════════════════════════════════════════

  it('招募成功后应显示招募结果', async () => {
    const output = makeRecruitOutput(1);
    const engine = makeMockEngine({ recruitOutput: output });
    render(<RecruitModal {...defaultProps} engine={engine} />);

    const singleBtn = screen.getByText('单次招募').closest('button')!;
    await userEvent.click(singleBtn);

    expect(screen.getByText('招募结果')).toBeInTheDocument();
    expect(screen.getByText('关羽')).toBeInTheDocument();
  });

  it('招募结果应显示品质标签', async () => {
    const output = makeRecruitOutput(1);
    const engine = makeMockEngine({ recruitOutput: output });
    render(<RecruitModal {...defaultProps} engine={engine} />);

    const singleBtn = screen.getByText('单次招募').closest('button')!;
    await userEvent.click(singleBtn);

    expect(screen.getByText('传说')).toBeInTheDocument();
  });

  it('新武将应显示"新获得"标签', async () => {
    const output = makeRecruitOutput(1, {
      results: [makeRecruitResult({ isDuplicate: false })],
    });
    const engine = makeMockEngine({ recruitOutput: output });
    render(<RecruitModal {...defaultProps} engine={engine} />);

    const singleBtn = screen.getByText('单次招募').closest('button')!;
    await userEvent.click(singleBtn);

    expect(screen.getByText('✨ 新获得')).toBeInTheDocument();
  });

  it('重复武将应显示碎片数量', async () => {
    const output = makeRecruitOutput(1, {
      results: [makeRecruitResult({
        isDuplicate: true,
        fragmentCount: 80,
        general: {
          id: 'guanyu',
          name: '关羽',
          quality: Quality.LEGENDARY,
          baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
          level: 1, exp: 0, faction: 'shu', skills: [],
        },
      })],
    });
    const engine = makeMockEngine({ recruitOutput: output });
    render(<RecruitModal {...defaultProps} engine={engine} />);

    const singleBtn = screen.getByText('单次招募').closest('button')!;
    await userEvent.click(singleBtn);

    expect(screen.getByText(/已拥有 → 碎片×80/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 资源不足时按钮灰显
  // ═══════════════════════════════════════════

  it('资源不足时单抽按钮应被禁用', () => {
    const engine = makeMockEngine({ canAfford: false });
    render(<RecruitModal {...defaultProps} engine={engine} />);

    const singleBtn = screen.getByText('单次招募').closest('button')!;
    expect(singleBtn).toBeDisabled();
  });

  it('资源不足时十连按钮应被禁用', () => {
    const engine = makeMockEngine({ canAfford: false });
    render(<RecruitModal {...defaultProps} engine={engine} />);

    const tenBtn = screen.getByText('十连招募').closest('button')!;
    expect(tenBtn).toBeDisabled();
  });

  // ═══════════════════════════════════════════
  // 6. 关闭弹窗
  // ═══════════════════════════════════════════

  it('点击关闭按钮应调用 onClose', async () => {
    const onClose = vi.fn();
    render(<RecruitModal {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: '关闭' });
    await userEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层应调用 onClose', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <RecruitModal {...defaultProps} onClose={onClose} />
    );

    const overlay = container.querySelector('.tk-recruit-overlay')!;
    await userEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 7. 招募完成回调
  // ═══════════════════════════════════════════

  it('招募成功后应调用 onRecruitComplete', async () => {
    const onRecruitComplete = vi.fn();
    const engine = makeMockEngine();
    render(
      <RecruitModal
        {...defaultProps}
        engine={engine}
        onRecruitComplete={onRecruitComplete}
      />
    );

    const singleBtn = screen.getByText('单次招募').closest('button')!;
    await userEvent.click(singleBtn);

    expect(onRecruitComplete).toHaveBeenCalledTimes(1);
  });
});
