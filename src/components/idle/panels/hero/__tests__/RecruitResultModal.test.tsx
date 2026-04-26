/**
 * RecruitResultModal 组件集成测试
 *
 * 覆盖场景：
 * - 渲染招募结果
 * - 品质揭示显示正确
 * - "再次招募"和"查看武将"按钮
 * - 关闭回调
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import RecruitResultModal from '../RecruitResultModal';
import type { RecruitResultModalProps } from '../RecruitResultModal';
import type { RecruitResult, Quality } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

vi.mock('../RecruitResultModal.css', () => ({}));
vi.mock('../atoms/QualityBadge.css', () => ({}));
vi.mock('../atoms/StarDisplay.css', () => ({}));
vi.mock('../atoms/AttributeBar.css', () => ({}));
vi.mock('../atoms/ResourceCost.css', () => ({}));

// Mock engine constants
vi.mock('@/games/three-kingdoms/engine', () => ({
  Quality: {
    COMMON: 'COMMON',
    FINE: 'FINE',
    RARE: 'RARE',
    EPIC: 'EPIC',
    LEGENDARY: 'LEGENDARY',
  },
  QUALITY_LABELS: {
    COMMON: '普通',
    FINE: '精良',
    RARE: '稀有',
    EPIC: '史诗',
    LEGENDARY: '传说',
  },
  QUALITY_BORDER_COLORS: {
    COMMON: '#9e9e9e',
    FINE: '#2196f3',
    RARE: '#9c27b0',
    EPIC: '#f44336',
    LEGENDARY: '#ff9800',
  },
}));

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeRecruitResult(overrides: Partial<RecruitResult> = {}): RecruitResult {
  return {
    general: {
      id: 'guanyu',
      name: '关羽',
      quality: 'LEGENDARY' as Quality,
      baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
      level: 1,
      exp: 0,
      faction: 'shu',
      skills: [],
    },
    isDuplicate: false,
    fragmentCount: 0,
    quality: 'LEGENDARY' as Quality,
    ...overrides,
  };
}

function makeMockEngine() {
  return {} as ThreeKingdomsEngine;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('RecruitResultModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染招募结果
  // ═══════════════════════════════════════════

  it('应渲染招募结果弹窗', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    expect(screen.getByTestId('recruit-result-modal')).toBeInTheDocument();
  });

  it('应渲染遮罩层', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    expect(screen.getByTestId('recruit-result-modal-overlay')).toBeInTheDocument();
  });

  it('应设置role=dialog和aria-modal', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    const modal = screen.getByTestId('recruit-result-modal');
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
  });

  it('应显示关闭按钮', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    const closeBtn = screen.getByLabelText('关闭');
    expect(closeBtn).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 品质揭示显示正确
  // ═══════════════════════════════════════════

  it('初始应显示卡牌背面（?号）', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('翻转后应显示武将名称', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    // 触发翻转动画
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText('关羽')).toBeInTheDocument();
  });

  it('新获得武将应显示"✨ 新获得"', () => {
    const result = makeRecruitResult({ isDuplicate: false });
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText('✨ 新获得')).toBeInTheDocument();
  });

  it('重复武将应显示碎片信息', () => {
    const result = makeRecruitResult({ isDuplicate: true, fragmentCount: 10 });
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText(/已拥有/)).toBeInTheDocument();
    expect(screen.getByText(/碎片×10/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. "再次招募"和"查看武将"按钮
  // ═══════════════════════════════════════════

  it('应渲染"再次招募"按钮', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    expect(screen.getByTestId('recruit-result-again-btn')).toBeInTheDocument();
    expect(screen.getByTestId('recruit-result-again-btn').textContent).toContain('再次招募');
  });

  it('新武将应渲染"查看武将"按钮', () => {
    const result = makeRecruitResult({ isDuplicate: false });
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    expect(screen.getByTestId('recruit-result-view-btn')).toBeInTheDocument();
  });

  it('重复武将不应渲染"查看武将"按钮', () => {
    const result = makeRecruitResult({ isDuplicate: true });
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    expect(screen.queryByTestId('recruit-result-view-btn')).not.toBeInTheDocument();
  });

  it('点击"再次招募"应触发onRecruitAgain回调', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    const onRecruitAgain = vi.fn();

    render(
      <RecruitResultModal
        result={result}
        engine={engine}
        onRecruitAgain={onRecruitAgain}
      />,
    );

    fireEvent.click(screen.getByTestId('recruit-result-again-btn'));
    expect(onRecruitAgain).toHaveBeenCalled();
  });

  it('点击"查看武将"应触发onViewHero回调', () => {
    const result = makeRecruitResult({ isDuplicate: false });
    const engine = makeMockEngine();
    const onViewHero = vi.fn();

    render(
      <RecruitResultModal
        result={result}
        engine={engine}
        onViewHero={onViewHero}
      />,
    );

    fireEvent.click(screen.getByTestId('recruit-result-view-btn'));
    expect(onViewHero).toHaveBeenCalledWith('guanyu');
  });

  // ═══════════════════════════════════════════
  // 4. 关闭回调
  // ═══════════════════════════════════════════

  it('点击关闭按钮应触发onClose回调', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    const onClose = vi.fn();

    render(
      <RecruitResultModal result={result} engine={engine} onClose={onClose} />,
    );

    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalled();
  });

  it('点击遮罩层应触发onClose回调', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    const onClose = vi.fn();

    render(
      <RecruitResultModal result={result} engine={engine} onClose={onClose} />,
    );

    const overlay = screen.getByTestId('recruit-result-modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('应渲染"确定"关闭按钮', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();

    render(<RecruitResultModal result={result} engine={engine} />);
    expect(screen.getByText('确定')).toBeInTheDocument();
  });

  it('点击"确定"按钮应触发onClose', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    const onClose = vi.fn();

    render(
      <RecruitResultModal result={result} engine={engine} onClose={onClose} />,
    );

    fireEvent.click(screen.getByText('确定'));
    expect(onClose).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════
  // 5. ESC键关闭
  // ═══════════════════════════════════════════

  it('按ESC键应触发onClose回调', () => {
    const result = makeRecruitResult();
    const engine = makeMockEngine();
    const onClose = vi.fn();

    render(
      <RecruitResultModal result={result} engine={engine} onClose={onClose} />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════
  // 6. 武将头像显示
  // ═══════════════════════════════════════════

  it('翻转后应显示武将名字首字', () => {
    const result = makeRecruitResult({ general: { ...makeRecruitResult().general!, name: '赵云' } });
    const engine = makeMockEngine();
    render(<RecruitResultModal result={result} engine={engine} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText('赵')).toBeInTheDocument();
  });
});
