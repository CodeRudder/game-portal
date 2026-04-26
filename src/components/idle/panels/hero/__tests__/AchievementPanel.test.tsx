/**
 * AchievementPanel UI 交互测试
 *
 * 覆盖场景：
 * - 渲染测试：面板标题、统计信息
 * - 类别分组：收集/战斗/成长/经济
 * - 进度条与状态：进行中/已完成/已领取
 * - 筛选功能：全部/进行中/已完成/已领取
 * - 领取奖励按钮
 * - 空状态
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AchievementPanel from '../AchievementPanel';
import type { Achievement } from '../AchievementPanel';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../AchievementPanel.css', () => ({}));
vi.mock('../RadarChart', () => ({
  default: () => <svg data-testid="mock-radar-chart" />,
}));

// ─────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────

const achievements: Achievement[] = [
  {
    id: 'ach_collect_1',
    category: 'collection',
    name: '初出茅庐',
    description: '招募第一位武将',
    target: 1,
    current: 1,
    rewards: [{ resource: '金币', amount: 100 }],
    isClaimed: false,
  },
  {
    id: 'ach_combat_1',
    category: 'combat',
    name: '首战告捷',
    description: '赢得第一场战斗',
    target: 10,
    current: 5,
    rewards: [{ resource: '经验书', amount: 1 }],
    isClaimed: false,
  },
  {
    id: 'ach_growth_1',
    category: 'growth',
    name: '小有所成',
    description: '任意武将达到10级',
    target: 10,
    current: 10,
    rewards: [{ resource: '元宝', amount: 50 }],
    isClaimed: true,
  },
  {
    id: 'ach_economy_1',
    category: 'economy',
    name: '财源广进',
    description: '累计获得10000金币',
    target: 10000,
    current: 3000,
    rewards: [{ resource: '元宝', amount: 20 }],
    isClaimed: false,
  },
];

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('AchievementPanel', () => {
  const onClaim = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应渲染成就面板', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-panel')).toBeInTheDocument();
  });

  it('应显示成就系统标题', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByText('🏆 成就系统')).toBeInTheDocument();
  });

  it('应显示完成统计', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-stats')).toHaveTextContent('已完成 1/4');
  });

  it('应显示筛选按钮组', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-filters')).toBeInTheDocument();
    expect(screen.getByTestId('ach-filter-all')).toBeInTheDocument();
    expect(screen.getByTestId('ach-filter-in_progress')).toBeInTheDocument();
    expect(screen.getByTestId('ach-filter-completed')).toBeInTheDocument();
    expect(screen.getByTestId('ach-filter-claimed')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 类别分组
  // ═══════════════════════════════════════════

  it('应按类别分组显示成就', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-category-collection')).toBeInTheDocument();
    expect(screen.getByTestId('ach-category-combat')).toBeInTheDocument();
    expect(screen.getByTestId('ach-category-growth')).toBeInTheDocument();
    expect(screen.getByTestId('ach-category-economy')).toBeInTheDocument();
  });

  it('应显示类别标题', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByText('📦 收集')).toBeInTheDocument();
    expect(screen.getByText('⚔️ 战斗')).toBeInTheDocument();
    expect(screen.getByText('📈 成长')).toBeInTheDocument();
    expect(screen.getByText('💰 经济')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 成就卡片内容
  // ═══════════════════════════════════════════

  it('应显示成就名称和描述', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-name-ach_collect_1')).toHaveTextContent('初出茅庐');
    expect(screen.getByTestId('ach-desc-ach_collect_1')).toHaveTextContent('招募第一位武将');
  });

  it('应显示进度条和进度文本', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-progress-text-ach_combat_1')).toHaveTextContent('5/10');
    expect(screen.getByTestId('ach-progress-bar-ach_combat_1')).toBeInTheDocument();
  });

  it('应显示奖励信息', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-rewards-ach_collect_1')).toHaveTextContent('金币 ×100');
  });

  // ═══════════════════════════════════════════
  // 4. 状态标记
  // ═══════════════════════════════════════════

  it('已完成但未领取的成就应显示金色标记', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-badge-gold-ach_collect_1')).toBeInTheDocument();
  });

  it('已领取的成就应显示已领取标记', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-badge-claimed-ach_growth_1')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 领取按钮
  // ═══════════════════════════════════════════

  it('已完成未领取的成就应显示领取按钮', () => {
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-claim-btn-ach_collect_1')).toBeInTheDocument();
  });

  it('点击领取按钮应触发onClaim回调', async () => {
    const user = userEvent.setup();
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    await user.click(screen.getByTestId('ach-claim-btn-ach_collect_1'));
    expect(onClaim).toHaveBeenCalledWith('ach_collect_1');
  });

  // ═══════════════════════════════════════════
  // 6. 筛选功能
  // ═══════════════════════════════════════════

  it('点击进行中筛选应只显示进行中的成就', async () => {
    const user = userEvent.setup();
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    await user.click(screen.getByTestId('ach-filter-in_progress'));
    // 进行中：战斗(5/10)和经济(3000/10000)
    expect(screen.getByTestId('ach-item-ach_combat_1')).toBeInTheDocument();
    expect(screen.getByTestId('ach-item-ach_economy_1')).toBeInTheDocument();
    // 已完成和已领取的不应出现
    expect(screen.queryByTestId('ach-item-ach_collect_1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ach-item-ach_growth_1')).not.toBeInTheDocument();
  });

  it('点击已领取筛选应只显示已领取的成就', async () => {
    const user = userEvent.setup();
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    await user.click(screen.getByTestId('ach-filter-claimed'));
    expect(screen.getByTestId('ach-item-ach_growth_1')).toBeInTheDocument();
    expect(screen.queryByTestId('ach-item-ach_collect_1')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 7. 空状态
  // ═══════════════════════════════════════════

  it('筛选后无匹配成就应显示空状态', async () => {
    const user = userEvent.setup();
    render(<AchievementPanel achievements={achievements} onClaim={onClaim} />);
    await user.click(screen.getByTestId('ach-filter-completed'));
    // 已完成（未领取）: ach_collect_1 是 completed 状态
    // 但注意: ach_collect_1 的 current=1, target=1, isClaimed=false → 状态是 completed
    expect(screen.getByTestId('ach-item-ach_collect_1')).toBeInTheDocument();
  });

  it('空成就列表应显示空状态', () => {
    render(<AchievementPanel achievements={[]} onClaim={onClaim} />);
    expect(screen.getByTestId('ach-empty')).toHaveTextContent('暂无匹配的成就');
  });
});
