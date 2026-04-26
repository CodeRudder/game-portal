/**
 * BondPanel — 武将羁绊面板测试
 *
 * 覆盖场景：
 * - 渲染空编队
 * - 渲染有羁绊的编队
 * - 显示阵营分布
 * - 激活羁绊显示金色边框
 * - 未激活羁绊灰色显示
 * - 搭档羁绊激活/未激活
 * - 羁绊效果文本正确
 * - 羁绊计数显示
 * - 自定义阵营映射
 * - 自定义羁绊配置
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BondPanel from '../BondPanel';
import { BondType } from '@/games/three-kingdoms/engine/hero/bond-config';
import type { BondConfig } from '@/games/three-kingdoms/engine/hero/faction-bond-config';

// ── Mock CSS ──
vi.mock('../BondPanel.css', () => ({}));

// ── 测试数据工厂 ──

const makePartnerBond = (overrides: Partial<BondConfig> = {}): BondConfig => ({
  id: 'partner_taoyuan',
  name: '桃园结义',
  type: 'partner',
  requiredHeroes: ['liubei', 'guanyu', 'zhangfei'],
  minCount: 3,
  effect: {
    attackBonus: 0.10,
    defenseBonus: 0.10,
    hpBonus: 0.10,
    critBonus: 0.10,
    strategyBonus: 0.10,
  },
  description: '刘备、关羽、张飞桃园结义，全属性+10%',
  ...overrides,
});

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  heroIds: [] as string[],
  ...overrides,
});

// ── 测试 ──

describe('BondPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应正常渲染面板', () => {
    render(<BondPanel {...makeProps()} />);
    expect(screen.getByTestId('bond-panel')).toBeInTheDocument();
  });

  it('应渲染空编队提示', () => {
    render(<BondPanel {...makeProps({ heroIds: [] })} />);
    expect(screen.getByTestId('bond-panel-empty')).toBeInTheDocument();
    expect(screen.getByTestId('bond-panel-empty')).toHaveTextContent(
      '当前编队为空，请先添加武将',
    );
  });

  it('空编队时不应显示空编队提示之外的内容区域', () => {
    render(<BondPanel {...makeProps({ heroIds: [] })} />);
    // 阵营分布仍然渲染（全为0）
    expect(screen.getByTestId('bond-faction-distribution')).toBeInTheDocument();
    // 空编队提示存在
    expect(screen.getByTestId('bond-panel-empty')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 阵营分布测试
  // ═══════════════════════════════════════════

  it('应正确显示阵营分布', () => {
    // 刘备(蜀)、关羽(蜀)、曹操(魏)、孙权(吴)、吕布(群雄)
    render(
      <BondPanel
        {...makeProps({ heroIds: ['liubei', 'guanyu', 'caocao', 'sunquan', 'lvbu'] })}
      />,
    );

    // 蜀: 2人
    expect(screen.getByTestId('bond-faction-segment-shu')).toBeInTheDocument();
    // 魏: 1人
    expect(screen.getByTestId('bond-faction-segment-wei')).toBeInTheDocument();
    // 吴: 1人
    expect(screen.getByTestId('bond-faction-segment-wu')).toBeInTheDocument();
    // 群雄: 1人
    expect(screen.getByTestId('bond-faction-segment-neutral')).toBeInTheDocument();
  });

  it('应显示各阵营人数', () => {
    render(
      <BondPanel
        {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei'] })}
      />,
    );
    // 蜀3人，其余0人
    const distribution = screen.getByTestId('bond-faction-distribution');
    expect(distribution.textContent).toContain('蜀');
    expect(distribution.textContent).toContain('3人');
  });

  // ═══════════════════════════════════════════
  // 3. 羁绊激活测试
  // ═══════════════════════════════════════════

  it('蜀国2人应激活阵营羁绊', () => {
    render(
      <BondPanel
        {...makeProps({ heroIds: ['liubei', 'guanyu'] })}
      />,
    );

    // 蜀阵营羁绊应激活
    const bondCard = screen.getByTestId('bond-card-faction_shu');
    expect(bondCard).toBeInTheDocument();
    expect(bondCard.className).toContain('bond-card--active');

    // 状态显示"已激活"
    expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('已激活');
  });

  it('激活羁绊应有金色边框样式类', () => {
    render(
      <BondPanel
        {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei'] })}
      />,
    );

    // 蜀国3人 → 中级羁绊激活
    const bondCard = screen.getByTestId('bond-card-faction_shu');
    expect(bondCard.className).toContain('bond-card--active');
  });

  it('未激活羁绊应灰色显示', () => {
    // 只有1个蜀国武将，不够2人激活
    render(
      <BondPanel
        {...makeProps({ heroIds: ['liubei'] })}
      />,
    );

    const bondCard = screen.getByTestId('bond-card-faction_shu');
    expect(bondCard).toBeInTheDocument();
    expect(bondCard.className).toContain('bond-card--inactive');
    expect(screen.getByTestId('bond-status-faction_shu')).toHaveTextContent('未激活');
  });

  // ═══════════════════════════════════════════
  // 4. 搭档羁绊测试
  // ═══════════════════════════════════════════

  it('桃园结义（刘关张）应激活搭档羁绊', () => {
    render(
      <BondPanel
        {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei'] })}
      />,
    );

    const bondCard = screen.getByTestId('bond-card-partner_taoyuan');
    expect(bondCard).toBeInTheDocument();
    expect(bondCard.className).toContain('bond-card--active');
  });

  it('缺少武将时搭档羁绊不激活', () => {
    // 只有刘备和关羽，缺少张飞
    render(
      <BondPanel
        {...makeProps({ heroIds: ['liubei', 'guanyu'] })}
      />,
    );

    const bondCard = screen.getByTestId('bond-card-partner_taoyuan');
    expect(bondCard).toBeInTheDocument();
    expect(bondCard.className).toContain('bond-card--inactive');
  });

  // ═══════════════════════════════════════════
  // 5. 羁绊效果文本测试
  // ═══════════════════════════════════════════

  it('应正确显示羁绊效果文本', () => {
    render(
      <BondPanel
        {...makeProps({ heroIds: ['liubei', 'guanyu'] })}
      />,
    );

    // 蜀2人初级羁绊：攻击+5%
    const effectEl = screen.getByTestId('bond-effect-faction_shu');
    expect(effectEl).toHaveTextContent('攻击+5%');
  });

  it('应正确显示羁绊激活计数', () => {
    render(
      <BondPanel
        {...makeProps({ heroIds: ['liubei', 'guanyu', 'zhangfei'] })}
      />,
    );

    const countEl = screen.getByTestId('bond-active-count');
    // 蜀阵营激活 + 桃园结义激活 = 至少2个激活
    expect(countEl).toHaveTextContent('已激活');
  });

  // ═══════════════════════════════════════════
  // 6. 自定义 Props 测试
  // ═══════════════════════════════════════════

  it('应支持自定义阵营映射', () => {
    const customMap: Record<string, string> = {
      hero_a: 'shu',
      hero_b: 'shu',
    };

    render(
      <BondPanel
        heroIds={['hero_a', 'hero_b']}
        heroFactionMap={customMap}
      />,
    );

    // 蜀阵营羁绊应激活（2人）
    const bondCard = screen.getByTestId('bond-card-faction_shu');
    expect(bondCard.className).toContain('bond-card--active');
  });

  it('应支持自定义羁绊配置', () => {
    const customBonds: BondConfig[] = [
      makePartnerBond({
        id: 'partner_custom',
        name: '自定义搭档',
        requiredHeroes: ['hero_x', 'hero_y'],
        minCount: 2,
        effect: {
          attackBonus: 0.20,
          defenseBonus: 0,
          hpBonus: 0,
          critBonus: 0,
          strategyBonus: 0,
        },
        description: '自定义搭档羁绊',
      }),
    ];

    render(
      <BondPanel
        heroIds={['hero_x', 'hero_y']}
        heroFactionMap={{ hero_x: 'shu', hero_y: 'shu' }}
        bondCatalog={customBonds}
      />,
    );

    // 自定义搭档羁绊应存在
    const bondCard = screen.getByTestId('bond-card-partner_custom');
    expect(bondCard).toBeInTheDocument();
    expect(bondCard.className).toContain('bond-card--active');
  });

  // ═══════════════════════════════════════════
  // 7. 进度显示测试
  // ═══════════════════════════════════════════

  it('应正确显示羁绊进度', () => {
    // 只有1个蜀国武将，不够激活（需要2人）
    render(
      <BondPanel
        {...makeProps({ heroIds: ['liubei'] })}
      />,
    );

    const progress = screen.getByTestId('bond-progress-faction_shu');
    expect(progress).toHaveTextContent('1/2');
  });
});
