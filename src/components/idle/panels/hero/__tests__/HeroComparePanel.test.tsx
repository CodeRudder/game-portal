/**
 * HeroComparePanel UI 交互测试
 *
 * 覆盖场景：
 * - 渲染测试：面板标题、选择器
 * - 武将选择切换
 * - 属性对比显示
 * - 技能对比
 * - 羁绊对比
 * - 战力对比
 * - 关闭按钮
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroComparePanel from '../HeroComparePanel';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import { Quality } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../HeroComparePanel.css', () => ({}));
vi.mock('../RadarChart', () => ({
  default: (props: any) => (
    <svg data-testid="mock-radar-chart" aria-label={`雷达图-${props.quality}`} />
  ),
}));

// ─────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────

const heroA: GeneralData = {
  id: 'guanyu',
  name: '关羽',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
  level: 30,
  exp: 2000,
  faction: 'shu',
  skills: [
    { id: 'skill_gy_1', name: '青龙偃月', type: 'active', level: 3, description: '对敌方造成大量伤害' },
    { id: 'skill_gy_2', name: '武圣', type: 'passive', level: 2, description: '提升自身攻击力' },
  ],
};

const heroB: GeneralData = {
  id: 'zhangfei',
  name: '张飞',
  quality: Quality.EPIC,
  baseStats: { attack: 120, defense: 70, intelligence: 40, speed: 60 },
  level: 25,
  exp: 1500,
  faction: 'shu',
  skills: [
    { id: 'skill_zf_1', name: '燕人咆哮', type: 'active', level: 3, description: '降低敌方防御' },
  ],
};

const heroC: GeneralData = {
  id: 'zhaoyun',
  name: '赵云',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 100, defense: 95, intelligence: 75, speed: 90 },
  level: 35,
  exp: 3000,
  faction: 'shu',
  skills: [
    { id: 'skill_zy_1', name: '龙胆', type: 'active', level: 4, description: '提升全队防御' },
    { id: 'skill_zy_2', name: '一身是胆', type: 'passive', level: 3, description: '受击时反击' },
  ],
};

const allGenerals = [heroA, heroB, heroC];

const mockCalculatePower = vi.fn((g: GeneralData) => {
  const s = g.baseStats;
  return s.attack * 10 + s.defense * 8 + s.intelligence * 5 + s.speed * 3 + g.level * 100;
});

const mockGetBonds = vi.fn((id: string) => {
  const bondMap: Record<string, string[]> = {
    guanyu: ['桃园结义', '五虎上将'],
    zhangfei: ['桃园结义', '五虎上将'],
    zhaoyun: ['五虎上将', '单骑救主'],
  };
  return bondMap[id] ?? [];
});

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('HeroComparePanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应渲染对比面板', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        getBonds={mockGetBonds}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('hcp-panel')).toBeInTheDocument();
  });

  it('应显示武将对比标题', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('⚔️ 武将对比')).toBeInTheDocument();
  });

  it('应显示两个武将选择器', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('hcp-select-left')).toBeInTheDocument();
    expect(screen.getByTestId('hcp-select-right')).toBeInTheDocument();
  });

  it('应显示关闭按钮', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('hcp-close-btn')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 武将信息
  // ═══════════════════════════════════════════

  it('应显示默认选中武将的信息', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    // 默认选第一和第二个武将
    expect(screen.getByTestId('hcp-hero-left')).toHaveTextContent('关羽');
    expect(screen.getByTestId('hcp-hero-right')).toHaveTextContent('张飞');
  });

  it('应显示武将品质和阵营', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('传说')).toBeInTheDocument();
    expect(screen.getByText('史诗')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 属性对比
  // ═══════════════════════════════════════════

  it('应显示属性对比区域', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('hcp-stats-section')).toBeInTheDocument();
    expect(screen.getByText('属性对比')).toBeInTheDocument();
  });

  it('应显示四维属性标签', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('hcp-stat-攻击')).toBeInTheDocument();
    expect(screen.getByTestId('hcp-stat-防御')).toBeInTheDocument();
    expect(screen.getByTestId('hcp-stat-策略')).toBeInTheDocument();
    expect(screen.getByTestId('hcp-stat-速度')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 技能对比
  // ═══════════════════════════════════════════

  it('应显示技能对比区域', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('hcp-skills-section')).toBeInTheDocument();
    expect(screen.getByText('技能对比')).toBeInTheDocument();
  });

  it('应显示武将技能', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('青龙偃月')).toBeInTheDocument();
    expect(screen.getByText('燕人咆哮')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 羁绊对比
  // ═══════════════════════════════════════════

  it('应显示羁绊对比区域', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        getBonds={mockGetBonds}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('hcp-bonds-section')).toBeInTheDocument();
    expect(screen.getByText('羁绊对比')).toBeInTheDocument();
  });

  it('应显示武将羁绊', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        getBonds={mockGetBonds}
        onClose={onClose}
      />,
    );
    // 羁绊名称在左右两侧都会出现，使用 getAllByText
    expect(screen.getAllByText('桃园结义').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('五虎上将').length).toBeGreaterThanOrEqual(2);
  });

  // ═══════════════════════════════════════════
  // 6. 战力对比
  // ═══════════════════════════════════════════

  it('应显示战力对比区域', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('hcp-power-section')).toBeInTheDocument();
    expect(screen.getByText('战力对比')).toBeInTheDocument();
  });

  it('应显示双方战力数值', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    const leftPower = screen.getByTestId('hcp-power-left');
    const rightPower = screen.getByTestId('hcp-power-right');
    expect(leftPower).toBeInTheDocument();
    expect(rightPower).toBeInTheDocument();
    expect(leftPower.textContent).toContain('⚔️');
    expect(rightPower.textContent).toContain('⚔️');
  });

  // ═══════════════════════════════════════════
  // 7. 交互
  // ═══════════════════════════════════════════

  it('点击关闭按钮应触发onClose', async () => {
    const user = userEvent.setup();
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByTestId('hcp-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('切换左侧武将应更新显示', async () => {
    const user = userEvent.setup();
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    // 默认关羽 vs 张飞
    expect(screen.getByTestId('hcp-hero-left')).toHaveTextContent('关羽');
    // 切换左侧为赵云
    await user.selectOptions(screen.getByTestId('hcp-select-left'), 'zhaoyun');
    expect(screen.getByTestId('hcp-hero-left')).toHaveTextContent('赵云');
  });

  it('切换右侧武将应更新显示', async () => {
    const user = userEvent.setup();
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    // 默认张飞在右侧
    expect(screen.getByTestId('hcp-hero-right')).toHaveTextContent('张飞');
    // 切换右侧为赵云
    await user.selectOptions(screen.getByTestId('hcp-select-right'), 'zhaoyun');
    expect(screen.getByTestId('hcp-hero-right')).toHaveTextContent('赵云');
  });

  // ═══════════════════════════════════════════
  // 8. 雷达图
  // ═══════════════════════════════════════════

  it('应显示雷达图对比', () => {
    render(
      <HeroComparePanel
        generals={allGenerals}
        calculatePower={mockCalculatePower}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('hcp-radar-section')).toBeInTheDocument();
    const charts = screen.getAllByTestId('mock-radar-chart');
    expect(charts.length).toBe(2);
  });
});
