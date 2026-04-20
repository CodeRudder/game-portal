/**
 * HeroStarUpModal — 武将升星弹窗 测试
 *
 * 覆盖场景：
 * - 基础渲染：标题/星级/等级/碎片进度
 * - 碎片进度条：百分比/充足/不足/满星
 * - 升星预览：属性变化对比
 * - 升星消耗：碎片/铜钱充足/不足
 * - 突破状态：4阶段/等级要求/消耗
 * - 升星按钮：可点击/禁用
 * - 突破按钮：可点击/禁用
 * - 满星满突破状态
 * - 碎片来源标签
 * - 关闭按钮
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeroStarUpModal from '../HeroStarUpModal';
import type {
  StarUpPreview,
  FragmentProgress,
  BreakthroughPreview,
  StarUpResult,
  BreakthroughResult,
} from '@/games/three-kingdoms/engine/hero/star-up.types';

// ── Mock CSS ──
vi.mock('../HeroStarUpModal.css', () => ({}));

// ── 测试数据工厂 ──

function makeFragmentProgress(overrides: Partial<FragmentProgress> = {}): FragmentProgress {
  return {
    generalId: 'guanyu',
    currentFragments: 15,
    requiredFragments: 20,
    percentage: 75,
    canStarUp: false,
    ...overrides,
  };
}

function makeStarUpPreview(overrides: Partial<StarUpPreview> = {}): StarUpPreview {
  return {
    generalId: 'guanyu',
    currentStar: 3,
    targetStar: 4,
    fragmentCost: 20,
    goldCost: 5000,
    fragmentSufficient: true,
    statsDiff: {
      before: { attack: 100, defense: 80, intelligence: 60, speed: 50 },
      after: { attack: 130, defense: 100, intelligence: 75, speed: 60 },
    },
    ...overrides,
  };
}

function makeBreakthroughPreview(overrides: Partial<BreakthroughPreview> = {}): BreakthroughPreview {
  return {
    generalId: 'guanyu',
    currentStage: 1,
    currentLevel: 30,
    currentLevelCap: 40,
    nextLevelCap: 50,
    levelReady: true,
    resourceSufficient: true,
    canBreakthrough: true,
    fragmentCost: 10,
    goldCost: 3000,
    breakthroughStoneCost: 5,
    ...overrides,
  };
}

const successStarUpResult: StarUpResult = {
  success: true,
  generalId: 'guanyu',
  previousStar: 3,
  newStar: 4,
  fragmentsConsumed: 20,
  goldConsumed: 5000,
};

const successBtResult: BreakthroughResult = {
  success: true,
  generalId: 'guanyu',
  previousStage: 1,
  newStage: 2,
  previousLevelCap: 40,
  newLevelCap: 50,
};

// ── 默认 Props ──

function makeDefaultProps(overrides: Record<string, unknown> = {}) {
  return {
    generalId: 'guanyu',
    generalName: '关羽',
    level: 35,
    currentStar: 3,
    fragmentProgress: makeFragmentProgress(),
    starUpPreview: makeStarUpPreview(),
    breakthroughPreview: makeBreakthroughPreview(),
    breakthroughStage: 1,
    levelCap: 40,
    goldAmount: 10000,
    breakthroughStoneAmount: 10,
    onClose: vi.fn(),
    onStarUp: vi.fn(() => successStarUpResult),
    onBreakthrough: vi.fn(() => successBtResult),
    onSourceClick: vi.fn(),
    ...overrides,
  };
}

// ── 测试 ──

describe('HeroStarUpModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染弹窗overlay', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByTestId('starup-modal-overlay')).toBeInTheDocument();
  });

  it('应渲染武将名称标题', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText(/关羽.*升星/)).toBeInTheDocument();
  });

  it('应渲染等级信息', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    const levelEls = screen.getAllByText(/Lv\.35\/40/);
    expect(levelEls.length).toBeGreaterThanOrEqual(1);
  });

  it('应渲染星级显示', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    const stars = screen.getAllByText('★');
    // 6颗星（MAX_STAR_LEVEL=6），3颗亮+3颗暗
    expect(stars.length).toBe(6);
  });

  // ═══════════════════════════════════════════
  // 2. 碎片进度
  // ═══════════════════════════════════════════

  it('应显示碎片进度', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText(/关羽 碎片/)).toBeInTheDocument();
  });

  it('应显示碎片数量', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText('15/20')).toBeInTheDocument();
  });

  it('应显示百分比进度', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('碎片不足时应显示红色', () => {
    const { container } = render(
      <HeroStarUpModal {...makeDefaultProps({
        fragmentProgress: makeFragmentProgress({ canStarUp: false }),
      })} />,
    );
    expect(container.querySelector('.tk-starup-fragment-count--insufficient')).toBeInTheDocument();
  });

  it('碎片充足时应显示绿色', () => {
    const { container } = render(
      <HeroStarUpModal {...makeDefaultProps({
        fragmentProgress: makeFragmentProgress({ canStarUp: true, currentFragments: 20 }),
      })} />,
    );
    expect(container.querySelector('.tk-starup-fragment-count--sufficient')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 升星预览
  // ═══════════════════════════════════════════

  it('应显示升星预览标题', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText(/3星/)).toBeInTheDocument();
    expect(screen.getByText(/4星 属性预览/)).toBeInTheDocument();
  });

  it('应显示属性变化', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText('攻击')).toBeInTheDocument();
    expect(screen.getByText('防御')).toBeInTheDocument();
    expect(screen.getByText('智力')).toBeInTheDocument();
    expect(screen.getByText('速度')).toBeInTheDocument();
  });

  it('应显示属性差值', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    // attack: 100→130, diff=30
    expect(screen.getByText('(+30)')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 升星消耗
  // ═══════════════════════════════════════════

  it('应显示碎片消耗', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText('碎片')).toBeInTheDocument();
  });

  it('应显示铜钱消耗', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText('铜钱')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 突破状态
  // ═══════════════════════════════════════════

  it('应显示突破标题', () => {
    const { container } = render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(container.querySelector('.tk-starup-bt-title')).toHaveTextContent(/突破/);
  });

  it('应显示突破阶段', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText('第2阶 / 4阶')).toBeInTheDocument();
  });

  it('应显示突破后等级上限', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText('Lv.50')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. 操作按钮
  // ═══════════════════════════════════════════

  it('应显示升星按钮', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText(/升星.*3→4/)).toBeInTheDocument();
  });

  it('应显示突破按钮', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByRole('button', { name: '🔮 突破' })).toBeInTheDocument();
  });

  it('点击升星按钮应调用onStarUp', () => {
    const onStarUp = vi.fn(() => successStarUpResult);
    render(<HeroStarUpModal {...makeDefaultProps({ onStarUp })} />);
    fireEvent.click(screen.getByText(/升星.*3→4/));
    expect(onStarUp).toHaveBeenCalledWith('guanyu');
  });

  it('点击突破按钮应调用onBreakthrough', () => {
    const onBreakthrough = vi.fn(() => successBtResult);
    render(<HeroStarUpModal {...makeDefaultProps({ onBreakthrough })} />);
    const btBtn = screen.getByRole('button', { name: '🔮 突破' });
    fireEvent.click(btBtn);
    expect(onBreakthrough).toHaveBeenCalledWith('guanyu');
  });

  it('消耗不足时升星按钮应禁用', () => {
    render(
      <HeroStarUpModal {...makeDefaultProps({
        starUpPreview: makeStarUpPreview({ fragmentSufficient: false }),
      })} />,
    );
    expect(screen.getByText(/升星.*3→4/)).toBeDisabled();
  });

  // ═══════════════════════════════════════════
  // 7. 满星状态
  // ═══════════════════════════════════════════

  it('满星时不显示升星按钮', () => {
    render(
      <HeroStarUpModal {...makeDefaultProps({
        currentStar: 6,
        starUpPreview: null,
        fragmentProgress: makeFragmentProgress({ percentage: 100, canStarUp: true }),
      })} />,
    );
    expect(screen.queryByRole('button', { name: /升星/ })).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 8. 碎片来源
  // ═══════════════════════════════════════════

  it('应显示碎片来源标签', () => {
    render(<HeroStarUpModal {...makeDefaultProps()} />);
    expect(screen.getByText('⚔️ 扫荡')).toBeInTheDocument();
    expect(screen.getByText('🏪 商店')).toBeInTheDocument();
    expect(screen.getByText('🎉 活动')).toBeInTheDocument();
  });

  it('点击来源标签应调用onSourceClick', () => {
    const onSourceClick = vi.fn();
    render(<HeroStarUpModal {...makeDefaultProps({ onSourceClick })} />);
    fireEvent.click(screen.getByText('⚔️ 扫荡'));
    expect(onSourceClick).toHaveBeenCalledWith('sweep');
  });

  // ═══════════════════════════════════════════
  // 9. 关闭
  // ═══════════════════════════════════════════

  it('点击关闭按钮应调用onClose', () => {
    const onClose = vi.fn();
    render(<HeroStarUpModal {...makeDefaultProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
