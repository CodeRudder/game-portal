/**
 * HeroDispatchPanel — 武将派遣面板测试
 *
 * 覆盖场景：
 * - 渲染测试（面板正常渲染、标题、关闭按钮）
 * - 武将列表（筛选等级≥20+品质≥RARE、排序、已派遣标记）
 * - 建筑列表（名称/等级、已派遣武将信息、空建筑引导）
 * - 交互测试（选择武将→选择建筑→确认派遣、召回）
 * - 冷却提示
 * - 边界测试（无满足条件武将、无建筑）
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeroDispatchPanel from '../HeroDispatchPanel';
import type { HeroBrief, BuildingBrief } from '../HeroDispatchPanel';

// ── Mock CSS ──
vi.mock('../HeroDispatchPanel.css', () => ({}));

// ── Mock 原子组件 ──
vi.mock('../atoms', () => ({
  QualityBadge: ({ quality }: { quality: string }) => (
    <span data-testid={`quality-${quality}`}>{quality}</span>
  ),
  StarDisplay: ({ stars }: { stars: number }) => (
    <span data-testid={`stars-${stars}`}>★{stars}</span>
  ),
}));

// ── 测试数据工厂 ──

const makeHero = (overrides: Partial<HeroBrief> = {}): HeroBrief => ({
  id: 'hero-1',
  name: '关羽',
  level: 30,
  quality: 'EPIC',
  stars: 4,
  ...overrides,
});

const makeBuilding = (overrides: Partial<BuildingBrief> = {}): BuildingBrief => ({
  id: 'building-farm',
  name: '农田',
  level: 3,
  dispatchHeroId: null,
  ...overrides,
});

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  heroes: [
    makeHero({ id: 'hero-1', name: '关羽', level: 30, quality: 'EPIC', stars: 4 }),
    makeHero({ id: 'hero-2', name: '张飞', level: 25, quality: 'RARE', stars: 3 }),
    makeHero({ id: 'hero-3', name: '小兵', level: 10, quality: 'COMMON', stars: 1 }),
    makeHero({ id: 'hero-4', name: '赵云', level: 35, quality: 'LEGENDARY', stars: 5 }),
  ],
  buildings: [
    makeBuilding({ id: 'b-farm', name: '农田', level: 3 }),
    makeBuilding({ id: 'b-lumber', name: '伐木场', level: 2 }),
    makeBuilding({ id: 'b-mine', name: '矿场', level: 4, dispatchHeroId: 'hero-1' }),
  ],
  onDispatch: vi.fn(),
  onRecall: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

// ── 测试 ──

describe('HeroDispatchPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正常渲染面板', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    expect(screen.getByTestId('hero-dispatch-panel')).toBeInTheDocument();
  });

  it('应显示标题"武将派遣"', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    expect(screen.getByText('武将派遣')).toBeInTheDocument();
  });

  it('应显示关闭按钮', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    expect(screen.getByTestId('dispatch-close-btn')).toBeInTheDocument();
  });

  it('点击关闭按钮应调用onClose', () => {
    const onClose = vi.fn();
    render(<HeroDispatchPanel {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('dispatch-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 2. 武将列表筛选
  // ═══════════════════════════════════════════

  it('应只显示等级≥20且品质≥RARE的武将', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    // 关羽(EPIC,30) + 张飞(RARE,25) + 赵云(LEGENDARY,35) = 3个
    // 小兵(COMMON,10) 不满足
    expect(screen.getByTestId('dispatch-hero-hero-1')).toBeInTheDocument();
    expect(screen.getByTestId('dispatch-hero-hero-2')).toBeInTheDocument();
    expect(screen.getByTestId('dispatch-hero-hero-4')).toBeInTheDocument();
    expect(screen.queryByTestId('dispatch-hero-hero-3')).not.toBeInTheDocument();
  });

  it('应按品质降序排列武将', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    const heroItems = screen.getAllByTestId(/^dispatch-hero-/);
    // LEGENDARY(赵云) → EPIC(关羽) → RARE(张飞)
    expect(heroItems[0]).toHaveAttribute('data-testid', 'dispatch-hero-hero-4');
    expect(heroItems[1]).toHaveAttribute('data-testid', 'dispatch-hero-hero-1');
    expect(heroItems[2]).toHaveAttribute('data-testid', 'dispatch-hero-hero-2');
  });

  it('无满足条件的武将时应显示空状态', () => {
    render(
      <HeroDispatchPanel
        {...makeProps({
          heroes: [makeHero({ id: 'h-low', level: 10, quality: 'COMMON' })],
        })}
      />,
    );
    expect(screen.getByTestId('dispatch-hero-empty')).toBeInTheDocument();
    expect(screen.getByText('暂无满足条件的武将')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 建筑列表
  // ═══════════════════════════════════════════

  it('应显示所有建筑', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    expect(screen.getByTestId('dispatch-building-b-farm')).toBeInTheDocument();
    expect(screen.getByTestId('dispatch-building-b-lumber')).toBeInTheDocument();
    expect(screen.getByTestId('dispatch-building-b-mine')).toBeInTheDocument();
  });

  it('空建筑应显示"点击派遣"引导', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    expect(screen.getByTestId('dispatch-empty-b-farm')).toBeInTheDocument();
    // 多个建筑都显示"点击派遣"，用 getAllByText
    expect(screen.getAllByText('点击派遣').length).toBeGreaterThanOrEqual(1);
  });

  it('已派遣建筑应显示武将信息和加成', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    // b-mine 已派遣 hero-1(关羽) — 关羽同时出现在武将列表和建筑信息中
    const guanyuNames = screen.getAllByText('关羽');
    expect(guanyuNames.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/%/)).toBeInTheDocument();
  });

  it('已派遣建筑应显示召回按钮', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    expect(screen.getByTestId('recall-btn-b-mine')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 派遣交互
  // ═══════════════════════════════════════════

  it('选择武将后应高亮显示', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    fireEvent.click(screen.getByTestId('dispatch-hero-hero-4'));
    const heroItem = screen.getByTestId('dispatch-hero-hero-4');
    expect(heroItem.className).toContain('selected');
  });

  it('再次点击武将应取消选择', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    fireEvent.click(screen.getByTestId('dispatch-hero-hero-4'));
    expect(screen.getByTestId('dispatch-hero-hero-4').className).toContain('selected');
    fireEvent.click(screen.getByTestId('dispatch-hero-hero-4'));
    expect(screen.getByTestId('dispatch-hero-hero-4').className).not.toContain('selected');
  });

  it('选择武将后点击空建筑应显示确认栏', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    fireEvent.click(screen.getByTestId('dispatch-hero-hero-4'));
    fireEvent.click(screen.getByTestId('dispatch-empty-b-farm'));
    expect(screen.getByTestId('dispatch-confirm-bar')).toBeInTheDocument();
  });

  it('确认派遣应调用onDispatch', () => {
    const onDispatch = vi.fn();
    render(<HeroDispatchPanel {...makeProps({ onDispatch })} />);
    fireEvent.click(screen.getByTestId('dispatch-hero-hero-4'));
    fireEvent.click(screen.getByTestId('dispatch-empty-b-farm'));
    fireEvent.click(screen.getByTestId('dispatch-confirm-btn'));
    expect(onDispatch).toHaveBeenCalledWith('hero-4', 'b-farm');
  });

  // ═══════════════════════════════════════════
  // 5. 召回交互
  // ═══════════════════════════════════════════

  it('点击召回按钮应调用onRecall', () => {
    const onRecall = vi.fn();
    render(<HeroDispatchPanel {...makeProps({ onRecall })} />);
    fireEvent.click(screen.getByTestId('recall-btn-b-mine'));
    expect(onRecall).toHaveBeenCalledWith('b-mine');
  });

  // ═══════════════════════════════════════════
  // 6. 冷却提示
  // ═══════════════════════════════════════════

  it('召回后建筑应显示冷却提示', () => {
    // 使用重新渲染模拟真实召回流程
    const { rerender } = render(
      <HeroDispatchPanel
        {...makeProps({
          buildings: [
            makeBuilding({ id: 'b-mine', name: '矿场', level: 4, dispatchHeroId: 'hero-1' }),
          ],
        })}
      />,
    );
    // 点击召回
    fireEvent.click(screen.getByTestId('recall-btn-b-mine'));

    // 模拟外部状态更新：建筑不再有派遣武将
    rerender(
      <HeroDispatchPanel
        {...makeProps({
          buildings: [
            makeBuilding({ id: 'b-mine', name: '矿场', level: 4, dispatchHeroId: null }),
          ],
        })}
      />,
    );
    // 冷却提示应出现（cooldownMap 在组件内部状态中保留）
    // 注意：rerender 会保留 React key 相同的组件状态
    // 由于 cooldownMap 在组件内部，召回后 rerender 不会清除它
    expect(screen.getByTestId('cooldown-tip-b-mine')).toBeInTheDocument();
    expect(screen.getByText(/24小时/)).toBeInTheDocument();
  });

  it('召回后建筑空位应显示"冷却中..."', () => {
    const { rerender } = render(
      <HeroDispatchPanel
        {...makeProps({
          buildings: [
            makeBuilding({ id: 'b-mine', name: '矿场', level: 4, dispatchHeroId: 'hero-1' }),
          ],
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('recall-btn-b-mine'));

    // 模拟外部状态更新
    rerender(
      <HeroDispatchPanel
        {...makeProps({
          buildings: [
            makeBuilding({ id: 'b-mine', name: '矿场', level: 4, dispatchHeroId: null }),
          ],
        })}
      />,
    );
    expect(screen.getByText('冷却中...')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 7. 已派遣武将不可再次选择
  // ═══════════════════════════════════════════

  it('已派遣武将应显示为不可选择状态', () => {
    render(
      <HeroDispatchPanel
        {...makeProps({
          buildings: [
            makeBuilding({ id: 'b-1', name: '农田', dispatchHeroId: 'hero-4' }),
          ],
        })}
      />,
    );
    const heroItem = screen.getByTestId('dispatch-hero-hero-4');
    expect(heroItem.className).toContain('dispatched');
  });

  // ═══════════════════════════════════════════
  // 8. 边界测试
  // ═══════════════════════════════════════════

  it('无建筑时应显示"暂无建筑"空状态', () => {
    render(<HeroDispatchPanel {...makeProps({ buildings: [] })} />);
    expect(screen.getByTestId('dispatch-building-empty')).toBeInTheDocument();
    expect(screen.getByText('暂无建筑')).toBeInTheDocument();
  });

  it('无武将时应显示"暂无武将"空状态', () => {
    render(<HeroDispatchPanel {...makeProps({ heroes: [] })} />);
    expect(screen.getByTestId('dispatch-hero-empty')).toBeInTheDocument();
    expect(screen.getByText('暂无武将')).toBeInTheDocument();
  });

  it('未选择武将时点击建筑不应触发任何操作', () => {
    render(<HeroDispatchPanel {...makeProps()} />);
    // 没有选择武将，直接点击建筑空位
    fireEvent.click(screen.getByTestId('dispatch-empty-b-farm'));
    expect(screen.queryByTestId('dispatch-confirm-bar')).not.toBeInTheDocument();
  });
});
