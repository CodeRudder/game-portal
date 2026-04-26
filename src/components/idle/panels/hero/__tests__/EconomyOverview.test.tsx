/**
 * EconomyOverview — 经济总览测试
 *
 * 覆盖场景（15个测试）：
 * - 面板渲染与标题
 * - 资源卡片显示（招贤令/铜钱/突破石/技能书）
 * - 资源余额正确显示
 * - 日产出/日消耗面板
 * - 经济平衡指示器（盈余/赤字）
 * - 快捷入口按钮渲染与点击
 * - 推荐操作显示
 * - 推荐操作优先级样式
 * - 空数据状态
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EconomyOverview from '../EconomyOverview';

// ── Mock CSS ──
vi.mock('../EconomyOverview.css', () => ({}));

// ── 默认 Props ──
const defaultProps = {
  balances: {
    recruitTokens: 10,
    copper: 50000,
    breakthroughStones: 30,
    skillBooks: 15,
  },
  dailyFlows: [
    { resourceKey: '铜钱', production: 12000, consumption: 8000 },
    { resourceKey: '突破石', production: 5, consumption: 8 },
    { resourceKey: '技能书', production: 3, consumption: 2 },
  ],
  quickEntries: [
    { key: 'shop', label: '商店', icon: '🏪', onClick: vi.fn() },
    { key: 'daily', label: '日常任务', icon: '📋', onClick: vi.fn() },
    { key: 'expedition', label: '远征', icon: '⚔️', onClick: vi.fn() },
  ],
  recommendations: [
    { message: '突破石不足，建议扫荡关卡3-5', priority: 'urgent' as const },
    { message: '铜钱充裕，可考虑升级建筑', priority: 'info' as const },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('EconomyOverview', () => {
  // 1. 渲染面板容器
  it('renders panel container', () => {
    render(<EconomyOverview {...defaultProps} />);
    expect(screen.getByTestId('economy-overview')).toBeInTheDocument();
  });

  // 2. 显示标题
  it('renders title', () => {
    render(<EconomyOverview {...defaultProps} />);
    expect(screen.getByText('经济总览')).toBeInTheDocument();
  });

  // 3. 显示4个资源卡片
  it('renders 4 resource cards', () => {
    render(<EconomyOverview {...defaultProps} />);
    expect(screen.getByTestId('eo-card-招贤令')).toBeInTheDocument();
    expect(screen.getByTestId('eo-card-铜钱')).toBeInTheDocument();
    expect(screen.getByTestId('eo-card-突破石')).toBeInTheDocument();
    expect(screen.getByTestId('eo-card-技能书')).toBeInTheDocument();
  });

  // 4. 资源余额正确显示
  it('displays correct resource balances', () => {
    render(<EconomyOverview {...defaultProps} />);
    expect(screen.getByTestId('eo-card-招贤令')).toHaveTextContent('10');
    expect(screen.getByTestId('eo-card-铜钱')).toHaveTextContent('50,000');
    expect(screen.getByTestId('eo-card-突破石')).toHaveTextContent('30');
    expect(screen.getByTestId('eo-card-技能书')).toHaveTextContent('15');
  });

  // 5. 日产出/日消耗面板渲染
  it('renders daily flows section', () => {
    render(<EconomyOverview {...defaultProps} />);
    expect(screen.getByTestId('eo-flows')).toBeInTheDocument();
  });

  // 6. 日产出/日消耗数据正确
  it('displays daily flow data correctly', () => {
    render(<EconomyOverview {...defaultProps} />);
    const copperFlow = screen.getByTestId('eo-flow-铜钱');
    expect(copperFlow).toHaveTextContent('+12000');
    expect(copperFlow).toHaveTextContent('-8000');
  });

  // 7. 经济平衡指示器（赤字：12000+5+3 - 8000-8-2 = 4018，但按资源维度看突破石是赤字）
  // 整体：总产出 12008，总消耗 8010，净额 +3998 → 盈余
  it('shows positive balance indicator when production exceeds consumption', () => {
    render(<EconomyOverview {...defaultProps} />);
    const indicator = screen.getByTestId('eo-balance-indicator');
    expect(indicator).toHaveTextContent('经济盈余');
  });

  // 8. 经济平衡指示器（赤字）
  it('shows negative balance indicator when consumption exceeds production', () => {
    const deficitProps = {
      ...defaultProps,
      dailyFlows: [
        { resourceKey: '铜钱', production: 1000, consumption: 5000 },
      ],
    };
    render(<EconomyOverview {...deficitProps} />);
    const indicator = screen.getByTestId('eo-balance-indicator');
    expect(indicator).toHaveTextContent('经济赤字');
  });

  // 9. 快捷入口渲染
  it('renders quick entry buttons', () => {
    render(<EconomyOverview {...defaultProps} />);
    expect(screen.getByTestId('eo-entry-shop')).toHaveTextContent('商店');
    expect(screen.getByTestId('eo-entry-daily')).toHaveTextContent('日常任务');
    expect(screen.getByTestId('eo-entry-expedition')).toHaveTextContent('远征');
  });

  // 10. 快捷入口按钮点击
  it('calls onClick when quick entry button is clicked', () => {
    render(<EconomyOverview {...defaultProps} />);
    fireEvent.click(screen.getByTestId('eo-entry-shop'));
    expect(defaultProps.quickEntries[0].onClick).toHaveBeenCalledTimes(1);
  });

  // 11. 推荐操作渲染
  it('renders recommendations', () => {
    render(<EconomyOverview {...defaultProps} />);
    expect(screen.getByTestId('eo-recommendations')).toBeInTheDocument();
    expect(screen.getByTestId('eo-rec-0')).toHaveTextContent('突破石不足');
    expect(screen.getByTestId('eo-rec-1')).toHaveTextContent('铜钱充裕');
  });

  // 12. 推荐操作优先级样式
  it('applies urgency priority class to recommendations', () => {
    render(<EconomyOverview {...defaultProps} />);
    const urgentRec = screen.getByTestId('eo-rec-0');
    expect(urgentRec.className).toContain('eo-rec-item--urgent');
  });

  it('applies info priority class to recommendations', () => {
    render(<EconomyOverview {...defaultProps} />);
    const infoRec = screen.getByTestId('eo-rec-1');
    expect(infoRec.className).toContain('eo-rec-item--info');
  });

  // 13. 无快捷入口时不渲染入口区域
  it('hides quick entries section when no entries provided', () => {
    render(<EconomyOverview {...defaultProps} quickEntries={[]} />);
    expect(screen.queryByTestId('eo-quick-entries')).not.toBeInTheDocument();
  });

  // 14. 无推荐操作时不渲染推荐区域
  it('hides recommendations section when no recommendations provided', () => {
    render(<EconomyOverview {...defaultProps} recommendations={[]} />);
    expect(screen.queryByTestId('eo-recommendations')).not.toBeInTheDocument();
  });

  // 15. 空日产出数据时平衡为0
  it('shows balanced state when no daily flows', () => {
    render(<EconomyOverview {...defaultProps} dailyFlows={[]} />);
    const indicator = screen.getByTestId('eo-balance-indicator');
    expect(indicator).toHaveTextContent('经济盈余');
    expect(indicator).toHaveTextContent('+0');
  });
});
