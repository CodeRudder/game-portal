/**
 * OfflineRewardModal 组件测试
 *
 * 覆盖：渲染、离线时长、效率系数、资源收益、来源占比、翻倍、领取
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OfflineRewardModal } from '../OfflineRewardModal';
import type { OfflineSnapshot } from '../../../../engine/offline/offline.types';

// ── Fixtures ──

const mockSnapshot: OfflineSnapshot = {
  timestamp: Date.now(),
  offlineSeconds: 7200, // 2 hours
  tierDetails: [
    { tierId: 'tier_1', seconds: 7200, efficiency: 1.0, earned: { grain: 1000, gold: 500, troops: 200, mandate: 50 } },
  ],
  totalEarned: { grain: 1000, gold: 500, troops: 200, mandate: 50 },
  overallEfficiency: 0.85,
  isCapped: false,
};

const cappedSnapshot: OfflineSnapshot = {
  ...mockSnapshot,
  offlineSeconds: 300000,
  isCapped: true,
  tierDetails: [
    { tierId: 'tier_1', seconds: 7200, efficiency: 1.0, earned: { grain: 5000, gold: 3000, troops: 1000, mandate: 200 } },
    { tierId: 'tier_2', seconds: 14400, efficiency: 0.8, earned: { grain: 8000, gold: 5000, troops: 2000, mandate: 400 } },
  ],
  totalEarned: { grain: 13000, gold: 8000, troops: 3000, mandate: 600 },
};

describe('OfflineRewardModal', () => {
  const defaultProps = {
    isOpen: true,
    snapshot: mockSnapshot,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 渲染 ──

  it('isOpen=true 时渲染弹窗', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByText('离线收益')).toBeInTheDocument();
  });

  it('isOpen=false 时不渲染', () => {
    render(<OfflineRewardModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('离线收益')).not.toBeInTheDocument();
  });

  it('snapshot=null 时不渲染', () => {
    render(<OfflineRewardModal {...defaultProps} snapshot={null} />);
    expect(screen.queryByText('离线收益')).not.toBeInTheDocument();
  });

  // ── 离线时长 ──

  it('显示离线时长', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByText(/离线时长/)).toBeInTheDocument();
    expect(screen.getByText(/2小时/)).toBeInTheDocument();
  });

  // ── 效率系数 ──

  it('显示效率系数', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByText(/效率系数：85%/)).toBeInTheDocument();
  });

  // ── 资源收益 ──

  it('显示各资源收益', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByText('+1K')).toBeInTheDocument(); // grain 1000
  });

  // ── 来源占比 ──

  it('显示来源占比区域', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByText('来源占比')).toBeInTheDocument();
  });

  // ── 封顶 ──

  it('封顶时显示提示', () => {
    render(<OfflineRewardModal {...defaultProps} snapshot={cappedSnapshot} />);
    expect(screen.getByText(/已达到离线收益上限/)).toBeInTheDocument();
  });

  // ── 领取 ──

  it('点击领取按钮触发 onClaim(false) 和 onClose', () => {
    const onClaim = vi.fn();
    const onClose = vi.fn();
    render(<OfflineRewardModal {...defaultProps} onClaim={onClaim} onClose={onClose} />);
    const claimBtn = screen.getByText('领取收益');
    fireEvent.click(claimBtn);
    expect(onClaim).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalled();
  });

  // ── 翻倍 ──

  it('有翻倍选项时渲染翻倍按钮', () => {
    render(
      <OfflineRewardModal
        {...defaultProps}
        availableDoubles={[{ source: 'ad', multiplier: 2, description: '广告翻倍' }]}
      />,
    );
    expect(screen.getByText('广告翻倍')).toBeInTheDocument();
  });

  it('点击翻倍按钮触发 onClaim(true)', () => {
    const onClaim = vi.fn();
    const onClose = vi.fn();
    render(
      <OfflineRewardModal
        {...defaultProps}
        onClaim={onClaim}
        onClose={onClose}
        availableDoubles={[{ source: 'ad', multiplier: 2, description: '广告翻倍' }]}
      />,
    );
    fireEvent.click(screen.getByText('广告翻倍'));
    expect(onClaim).toHaveBeenCalledWith(true);
    expect(onClose).toHaveBeenCalled();
  });

  // ── 无障碍 ──

  it('具有 aria-label', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByRole('region', { name: '离线收益详情' })).toBeInTheDocument();
  });
});
