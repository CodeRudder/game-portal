/**
 * ResourceBar 单元测试
 *
 * 测试场景：
 * - 渲染4种资源（粮草/铜钱/兵力/天命）
 * - 显示数值+产出速率
 * - 容量进度条
 * - 接近上限时警告样式
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResourceBar from '../ResourceBar';
import type { Resources, ProductionRate, ResourceCap } from '@/games/three-kingdoms/engine';

// ── Mock CSS ──
vi.mock('../ResourceBar.css', () => ({}));

describe('ResourceBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应渲染4种资源', () => {
    const resources: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 10 };
    const rates: ProductionRate = { grain: 5, gold: 2, troops: 1, mandate: 0.5 };
    const caps: ResourceCap = { grain: 5000, gold: 3000, troops: 1000, mandate: null };

    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 验证资源图标存在
    expect(screen.getByText('🌾')).toBeInTheDocument();
    expect(screen.getByText('💰')).toBeInTheDocument();
    expect(screen.getByText('⚔️')).toBeInTheDocument();
    expect(screen.getByText('👑')).toBeInTheDocument();
  });

  it('应显示资源数值', () => {
    const resources: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 10 };
    const rates: ProductionRate = { grain: 0, gold: 0, troops: 0, mandate: 0 };
    const caps: ResourceCap = { grain: null, gold: null, troops: null, mandate: null };

    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 验证数值显示（使用 title 属性或文本）
    expect(screen.getByTitle('粮草 1,000')).toBeInTheDocument();
    expect(screen.getByTitle('铜钱 500')).toBeInTheDocument();
    expect(screen.getByTitle('兵力 200')).toBeInTheDocument();
    expect(screen.getByTitle('天命 10')).toBeInTheDocument();
  });

  it('应显示产出速率', () => {
    const resources: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 10 };
    const rates: ProductionRate = { grain: 5.5, gold: 2.3, troops: 1.0, mandate: 0 };
    const caps: ResourceCap = { grain: null, gold: null, troops: null, mandate: null };

    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 验证速率显示
    expect(screen.getByText('+5.5/秒')).toBeInTheDocument();
    expect(screen.getByText('+2.3/秒')).toBeInTheDocument();
    expect(screen.getByText('+1.0/秒')).toBeInTheDocument();
  });

  it('有容量上限的资源应显示容量进度条', () => {
    const resources: Resources = { grain: 2500, gold: 1500, troops: 500, mandate: 10 };
    const rates: ProductionRate = { grain: 5, gold: 2, troops: 1, mandate: 0 };
    const caps: ResourceCap = { grain: 5000, gold: 3000, troops: 1000, mandate: null };

    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 容量进度条元素应存在（粮草、铜钱、兵力有上限，天命无上限）
    const progressBars = container.querySelectorAll('.tk-res-cap-bar');
    expect(progressBars.length).toBe(3); // grain, gold, troops 有 cap

    // 天命没有上限，不应有进度条
    // 验证容量数值显示
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it('接近上限时进度条应变为红色警告', () => {
    // 粮草 95% → 红色警告
    const resources: Resources = { grain: 4750, gold: 500, troops: 200, mandate: 10 };
    const rates: ProductionRate = { grain: 5, gold: 2, troops: 1, mandate: 0 };
    const caps: ResourceCap = { grain: 5000, gold: 3000, troops: 1000, mandate: null };

    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 找到粮草的进度条填充元素
    const fills = container.querySelectorAll('.tk-res-cap-bar-fill');
    // 粮草是第一个资源，接近上限 95% 应该是红色
    const grainFill = fills[0] as HTMLElement;
    expect(grainFill.style.backgroundColor).toBe('rgb(231, 76, 60)'); // #e74c3c
  });

  it('容量80%-95%时应变为橙色警告', () => {
    // 粮草 85% → 橙色警告
    const resources: Resources = { grain: 4250, gold: 500, troops: 200, mandate: 10 };
    const rates: ProductionRate = { grain: 5, gold: 2, troops: 1, mandate: 0 };
    const caps: ResourceCap = { grain: 5000, gold: 3000, troops: 1000, mandate: null };

    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    const fills = container.querySelectorAll('.tk-res-cap-bar-fill');
    const grainFill = fills[0] as HTMLElement;
    expect(grainFill.style.backgroundColor).toBe('rgb(230, 126, 34)'); // #e67e22
  });

  it('应显示游戏标题', () => {
    const resources: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 10 };
    const rates: ProductionRate = { grain: 0, gold: 0, troops: 0, mandate: 0 };
    const caps: ResourceCap = { grain: null, gold: null, troops: null, mandate: null };

    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    expect(screen.getByText('三国霸业')).toBeInTheDocument();
  });

  it('速率为0时不显示速率文本', () => {
    const resources: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 10 };
    const rates: ProductionRate = { grain: 0, gold: 0, troops: 0, mandate: 0 };
    const caps: ResourceCap = { grain: null, gold: null, troops: null, mandate: null };

    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 速率为0时不应显示速率文本
    expect(screen.queryByText('/秒')).not.toBeInTheDocument();
  });
});
