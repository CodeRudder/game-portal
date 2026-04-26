/**
 * FormationRecommendPanel — 编队推荐面板测试
 *
 * 覆盖场景：
 * - 渲染测试（面板正常渲染、标题、关闭按钮）
 * - 推荐方案展示（3套方案、名称、战力、羁绊、槽位）
 * - 战力对比（与当前编队的 +/- 差值）
 * - 交互测试（应用编队）
 * - 推荐依据说明
 * - 边界测试（无武将、武将不足6人、当前编队为空）
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormationRecommendPanel from '../FormationRecommendPanel';
import type { HeroInfo } from '../FormationRecommendPanel';

// ── Mock CSS ──
vi.mock('../FormationRecommendPanel.css', () => ({}));

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

const makeHero = (overrides: Partial<HeroInfo> = {}): HeroInfo => ({
  id: 'hero-1',
  name: '关羽',
  level: 30,
  quality: 'EPIC',
  stars: 4,
  faction: 'shu',
  ...overrides,
});

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  ownedHeroes: [
    makeHero({ id: 'h-guanyu', name: '关羽', level: 30, quality: 'EPIC', stars: 4, faction: 'shu' }),
    makeHero({ id: 'h-zhangfei', name: '张飞', level: 28, quality: 'RARE', stars: 3, faction: 'shu' }),
    makeHero({ id: 'h-liubei', name: '刘备', level: 35, quality: 'LEGENDARY', stars: 5, faction: 'shu' }),
    makeHero({ id: 'h-caocao', name: '曹操', level: 32, quality: 'LEGENDARY', stars: 5, faction: 'wei' }),
    makeHero({ id: 'h-zhaoyun', name: '赵云', level: 27, quality: 'EPIC', stars: 4, faction: 'shu' }),
    makeHero({ id: 'h-sunquan', name: '孙权', level: 26, quality: 'RARE', stars: 3, faction: 'wu' }),
    makeHero({ id: 'h-lvbu', name: '吕布', level: 33, quality: 'LEGENDARY', stars: 5, faction: 'qun' }),
  ],
  currentFormation: ['h-liubei', 'h-guanyu', 'h-zhangfei', null, null, null],
  onApplyRecommend: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

// ── 测试 ──

describe('FormationRecommendPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正常渲染面板', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    expect(screen.getByTestId('formation-recommend-panel')).toBeInTheDocument();
  });

  it('应显示标题"编队推荐"', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    expect(screen.getByText('编队推荐')).toBeInTheDocument();
  });

  it('应显示关闭按钮', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    expect(screen.getByTestId('recommend-close-btn')).toBeInTheDocument();
  });

  it('点击关闭按钮应调用onClose', () => {
    const onClose = vi.fn();
    render(<FormationRecommendPanel {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('recommend-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 2. 推荐方案展示
  // ═══════════════════════════════════════════

  it('应生成3套推荐方案', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    expect(screen.getByTestId('recommend-card-best-power')).toBeInTheDocument();
    expect(screen.getByTestId('recommend-card-best-synergy')).toBeInTheDocument();
    expect(screen.getByTestId('recommend-card-balanced')).toBeInTheDocument();
  });

  it('应显示方案名称', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    expect(screen.getByText('战力最优')).toBeInTheDocument();
    expect(screen.getByText('羁绊最优')).toBeInTheDocument();
    expect(screen.getByText('平衡编队')).toBeInTheDocument();
  });

  it('应显示方案评分', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    const scores = screen.getAllByText(/评分 \d+/);
    expect(scores.length).toBe(3);
  });

  it('每套方案应显示"应用此编队"按钮', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    expect(screen.getByTestId('apply-btn-best-power')).toBeInTheDocument();
    expect(screen.getByTestId('apply-btn-best-synergy')).toBeInTheDocument();
    expect(screen.getByTestId('apply-btn-balanced')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 战力展示
  // ═══════════════════════════════════════════

  it('应显示战力数值', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    const powerTexts = screen.getAllByText(/战力 [\d,]+/);
    expect(powerTexts.length).toBe(3);
  });

  it('应显示与当前编队的战力差值', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    // 至少有一个方案会显示差值（↑+ 或 ↓ 或 →持平）
    const diffs = screen.getAllByText(/[↑↓→]/);
    expect(diffs.length).toBeGreaterThanOrEqual(3);
  });

  // ═══════════════════════════════════════════
  // 4. 羁绊展示
  // ═══════════════════════════════════════════

  it('同阵营≥2人时应显示羁绊标签', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    // 蜀国武将≥2人，应显示蜀国羁绊
    const bondTags = screen.getAllByText(/蜀国羁绊/);
    expect(bondTags.length).toBeGreaterThanOrEqual(1);
  });

  // ═══════════════════════════════════════════
  // 5. 推荐依据
  // ═══════════════════════════════════════════

  it('应显示推荐依据说明', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    expect(screen.getByText('基于武将战力排序，选取最高战力组合')).toBeInTheDocument();
    expect(screen.getByText('基于阵营羁绊最大化，优先选择同阵营武将')).toBeInTheDocument();
    expect(screen.getByText('基于品质分层选取，兼顾战力与羁绊平衡')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. 应用编队交互
  // ═══════════════════════════════════════════

  it('点击"应用此编队"应调用onApplyRecommend', () => {
    const onApplyRecommend = vi.fn();
    render(<FormationRecommendPanel {...makeProps({ onApplyRecommend })} />);
    fireEvent.click(screen.getByTestId('apply-btn-best-power'));
    expect(onApplyRecommend).toHaveBeenCalledTimes(1);
    // 结果应为6位数组
    const calledArg = onApplyRecommend.mock.calls[0][0] as (string | null)[];
    expect(calledArg.length).toBe(6);
  });

  it('应用编队时不足6人应补null', () => {
    const onApplyRecommend = vi.fn();
    render(
      <FormationRecommendPanel
        {...makeProps({
          ownedHeroes: [
            makeHero({ id: 'h-1', name: '关羽', level: 30, quality: 'EPIC', stars: 4, faction: 'shu' }),
            makeHero({ id: 'h-2', name: '张飞', level: 25, quality: 'RARE', stars: 3, faction: 'shu' }),
          ],
          onApplyRecommend,
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('apply-btn-best-power'));
    const calledArg = onApplyRecommend.mock.calls[0][0] as (string | null)[];
    expect(calledArg.length).toBe(6);
    // 前2个是武将ID，后4个是null
    expect(calledArg.filter((x) => x !== null).length).toBe(2);
    expect(calledArg.filter((x) => x === null).length).toBe(4);
  });

  // ═══════════════════════════════════════════
  // 7. 边界测试
  // ═══════════════════════════════════════════

  it('无武将时应显示空状态', () => {
    render(
      <FormationRecommendPanel
        {...makeProps({ ownedHeroes: [], currentFormation: [null, null, null, null, null, null] })}
      />,
    );
    expect(screen.getByTestId('recommend-empty')).toBeInTheDocument();
    expect(screen.getByText('暂无武将')).toBeInTheDocument();
  });

  it('currentFormation不足6位时应自动补齐', () => {
    const onApplyRecommend = vi.fn();
    render(
      <FormationRecommendPanel
        {...makeProps({
          currentFormation: ['h-guanyu', 'h-zhangfei'],
          onApplyRecommend,
        })}
      />,
    );
    // 应用编队应正常工作，内部 currentFormation 已补齐到6位
    fireEvent.click(screen.getByTestId('apply-btn-best-power'));
    expect(onApplyRecommend).toHaveBeenCalledTimes(1);
    const calledArg = onApplyRecommend.mock.calls[0][0] as (string | null)[];
    expect(calledArg.length).toBe(6);
  });

  it('武将不足3人时应只生成战力最优方案', () => {
    render(
      <FormationRecommendPanel
        {...makeProps({
          ownedHeroes: [
            makeHero({ id: 'h-1', name: '关羽', level: 30, quality: 'EPIC', stars: 4, faction: 'shu' }),
            makeHero({ id: 'h-2', name: '张飞', level: 25, quality: 'RARE', stars: 3, faction: 'shu' }),
          ],
          currentFormation: [null, null, null, null, null, null],
        })}
      />,
    );
    expect(screen.getByTestId('recommend-card-best-power')).toBeInTheDocument();
    // 武将≤2不生成羁绊最优和平衡编队
    expect(screen.queryByTestId('recommend-card-best-synergy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recommend-card-balanced')).not.toBeInTheDocument();
  });

  it('当前编队为空时战力差值应为正值', () => {
    render(
      <FormationRecommendPanel
        {...makeProps({ currentFormation: [null, null, null, null, null, null] })}
      />,
    );
    // 所有方案战力都应高于空编队（0）
    const positiveDiffs = screen.getAllByText(/↑\+/);
    expect(positiveDiffs.length).toBeGreaterThanOrEqual(1);
  });

  it('武将恰好3人时应生成2套方案（战力+羁绊）', () => {
    render(
      <FormationRecommendPanel
        {...makeProps({
          ownedHeroes: [
            makeHero({ id: 'h-1', name: '关羽', level: 30, quality: 'EPIC', stars: 4, faction: 'shu' }),
            makeHero({ id: 'h-2', name: '张飞', level: 25, quality: 'RARE', stars: 3, faction: 'shu' }),
            makeHero({ id: 'h-3', name: '刘备', level: 35, quality: 'LEGENDARY', stars: 5, faction: 'shu' }),
          ],
          currentFormation: [null, null, null, null, null, null],
        })}
      />,
    );
    expect(screen.getByTestId('recommend-card-best-power')).toBeInTheDocument();
    expect(screen.getByTestId('recommend-card-best-synergy')).toBeInTheDocument();
    expect(screen.queryByTestId('recommend-card-balanced')).not.toBeInTheDocument();
  });

  it('武将槽位应显示武将名字', () => {
    render(<FormationRecommendPanel {...makeProps()} />);
    // 战力最优方案应包含武将名字
    expect(screen.getAllByText('刘备').length).toBeGreaterThanOrEqual(1);
  });

  it('空槽位应显示"-"', () => {
    render(
      <FormationRecommendPanel
        {...makeProps({
          ownedHeroes: [
            makeHero({ id: 'h-1', name: '关羽', level: 30, quality: 'EPIC', stars: 4, faction: 'shu' }),
          ],
          currentFormation: [null, null, null, null, null, null],
        })}
      />,
    );
    // 只有一个武将，5个空槽位
    const emptySlots = screen.getAllByText('-');
    expect(emptySlots.length).toBe(5);
  });
});
