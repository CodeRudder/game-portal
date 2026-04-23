/**
 * ResourceBar 单元测试
 *
 * 测试场景：
 * - 渲染5种资源（粮草/铜钱/兵力/天命/科技点）
 * - 显示数值+产出速率
 * - 容量进度条
 * - 接近上限时警告样式
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock CSS ──
vi.mock('../ResourceBar.css', () => ({}));

// ── Mock 引擎模块 ──
vi.mock('@/games/three-kingdoms/engine', () => ({
  RESOURCE_LABELS: {
    grain: '粮草',
    gold: '铜钱',
    troops: '兵力',
    mandate: '天命',
    techPoint: '科技点',
  },
}));

vi.mock('@/games/three-kingdoms/engine/building/building.types', () => ({
  BUILDING_LABELS: {
    castle: '主城', farmland: '农田', market: '市集', barracks: '兵营',
    smithy: '铁匠铺', academy: '书院', clinic: '医馆', wall: '城墙',
  },
  BUILDING_ICONS: {
    castle: '🏛️', farmland: '🌾', market: '💰', barracks: '⚔️',
    smithy: '🔨', academy: '📜', clinic: '🏥', wall: '🧱',
  },
}));

vi.mock('@/games/three-kingdoms/engine/building/building-config', () => ({
  BUILDING_DEFS: {},
}));

// ── 导入被测组件（在 mock 之后）──
import ResourceBar from '../ResourceBar';

describe('ResourceBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应渲染4种资源', () => {
    const resources = { grain: 1000, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 5, gold: 2, troops: 1, mandate: 0.5, techPoint: 0 };
    const caps = { grain: 5000, gold: 3000, troops: 1000, mandate: null, techPoint: null };

    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 验证资源图标存在
    expect(screen.getByText('🌾')).toBeInTheDocument();
    expect(screen.getByText('💰')).toBeInTheDocument();
    expect(screen.getByText('⚔️')).toBeInTheDocument();
    expect(screen.getByText('👑')).toBeInTheDocument();
  });

  it('应显示资源数值', () => {
    const resources = { grain: 1000, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const caps = { grain: null, gold: null, troops: null, mandate: null, techPoint: null };

    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 验证数值显示（通过 title 属性，formatNumber 使用 K/M/B 格式）
    expect(screen.getByTitle('粮草 1K')).toBeInTheDocument();
    expect(screen.getByTitle('铜钱 500')).toBeInTheDocument();
    expect(screen.getByTitle('兵力 200')).toBeInTheDocument();
    expect(screen.getByTitle('天命 10')).toBeInTheDocument();
  });

  it('应显示产出速率', () => {
    const resources = { grain: 1000, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 5.5, gold: 2.3, troops: 1.0, mandate: 0, techPoint: 0 };
    const caps = { grain: null, gold: null, troops: null, mandate: null, techPoint: null };

    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 验证速率显示
    expect(screen.getByText('+5.5/秒')).toBeInTheDocument();
    expect(screen.getByText('+2.3/秒')).toBeInTheDocument();
    expect(screen.getByText('+1.0/秒')).toBeInTheDocument();
  });

  it('有容量上限的资源应显示容量进度条', () => {
    const resources = { grain: 2500, gold: 1500, troops: 500, mandate: 10, techPoint: 0 };
    const rates = { grain: 5, gold: 2, troops: 1, mandate: 0, techPoint: 0 };
    const caps = { grain: 5000, gold: 3000, troops: 1000, mandate: null, techPoint: null };

    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 容量进度条元素应存在（粮草、铜钱、兵力有上限，天命无上限）
    const progressBars = container.querySelectorAll('.tk-res-cap-bar');
    expect(progressBars.length).toBe(3); // grain, gold, troops 有 cap
  });

  it('接近上限时进度条应变为红色警告', () => {
    // 粮草 95% → 红色警告
    const resources = { grain: 4750, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 5, gold: 2, troops: 1, mandate: 0, techPoint: 0 };
    const caps = { grain: 5000, gold: 3000, troops: 1000, mandate: null, techPoint: null };

    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 找到粮草的进度条填充元素
    const fills = container.querySelectorAll('.tk-res-cap-bar-fill');
    const grainFill = fills[0] as HTMLElement;
    expect(grainFill.style.backgroundColor).toBe('rgb(231, 76, 60)'); // #e74c3c
  });

  it('容量80%-95%时应变为橙色警告', () => {
    // 粮草 85% → 橙色警告
    const resources = { grain: 4250, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 5, gold: 2, troops: 1, mandate: 0, techPoint: 0 };
    const caps = { grain: 5000, gold: 3000, troops: 1000, mandate: null, techPoint: null };

    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    const fills = container.querySelectorAll('.tk-res-cap-bar-fill');
    const grainFill = fills[0] as HTMLElement;
    expect(grainFill.style.backgroundColor).toBe('rgb(230, 126, 34)'); // #e67e22
  });

  it('应显示游戏标题', () => {
    const resources = { grain: 1000, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const caps = { grain: null, gold: null, troops: null, mandate: null, techPoint: null };

    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    expect(screen.getByText('三国霸业')).toBeInTheDocument();
  });

  it('速率为0时不显示速率文本', () => {
    const resources = { grain: 1000, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const caps = { grain: null, gold: null, troops: null, mandate: null, techPoint: null };

    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 速率为0时不应显示速率文本
    expect(screen.queryByText('/秒')).not.toBeInTheDocument();
  });

  it('接近上限(>80%)时资源数值应显示警告样式', () => {
    // 粮草 85% → warning 级别
    const resources = { grain: 4250, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 5, gold: 2, troops: 1, mandate: 0, techPoint: 0 };
    const caps = { grain: 5000, gold: 3000, troops: 1000, mandate: null, techPoint: null };

    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 粮草数值应有 warning 样式类
    const valueEls = container.querySelectorAll('.tk-res-value');
    const grainValue = valueEls[0] as HTMLElement;
    expect(grainValue.classList.contains('tk-res-value--warning')).toBe(true);
  });

  it('接近上限(>80%)时应显示⚠️警告图标', () => {
    // 粮草 90% → warning 级别，显示 ⚠️
    const resources = { grain: 4500, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 5, gold: 2, troops: 1, mandate: 0, techPoint: 0 };
    const caps = { grain: 5000, gold: 3000, troops: 1000, mandate: null, techPoint: null };

    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 应存在接近上限的警告图标（非溢出场景）
    const badges = container.querySelectorAll('.tk-res-nearcap-badge');
    expect(badges.length).toBe(1);
  });

  it('资源远未达上限时不应显示警告样式', () => {
    // 粮草 20% → 无警告
    const resources = { grain: 1000, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 5, gold: 2, troops: 1, mandate: 0, techPoint: 0 };
    const caps = { grain: 5000, gold: 3000, troops: 1000, mandate: null, techPoint: null };

    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    // 不应有 warning 样式类
    const warningValues = container.querySelectorAll('.tk-res-value--warning');
    expect(warningValues.length).toBe(0);

    // 不应有接近上限警告图标
    const badges = container.querySelectorAll('.tk-res-nearcap-badge');
    expect(badges.length).toBe(0);
  });

  it('资源已满时应显示full级别警告样式', () => {
    // 粮草 100% → full 级别
    const resources = { grain: 5000, gold: 500, troops: 200, mandate: 10, techPoint: 0 };
    const rates = { grain: 5, gold: 2, troops: 1, mandate: 0, techPoint: 0 };
    const caps = { grain: 5000, gold: 3000, troops: 1000, mandate: null, techPoint: null };

    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);

    const valueEls = container.querySelectorAll('.tk-res-value');
    const grainValue = valueEls[0] as HTMLElement;
    expect(grainValue.classList.contains('tk-res-value--full')).toBe(true);
  });
});
