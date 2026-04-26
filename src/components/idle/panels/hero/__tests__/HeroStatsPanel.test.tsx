/**
 * HeroStatsPanel 测试
 *
 * 覆盖场景：
 * 1. 基础渲染：头像、名字、品质、阵营
 * 2. 等级与经验条
 * 3. 星级显示
 * 4. 突破节点
 * 5. 四维属性条
 * 6. 羁绊标签列表
 * 7. 边缘情况
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import HeroStatsPanel from '../HeroStatsPanel';
import type { HeroStatsPanelProps } from '../HeroStatsPanel';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../HeroStatsPanel.css', () => ({}));
vi.mock('../atoms/QualityBadge.css', () => ({}));
vi.mock('../atoms/StarDisplay.css', () => ({}));

// ─────────────────────────────────────────────
// 测试数据工厂
// ─────────────────────────────────────────────
const makeHero = (
  overrides: Partial<HeroStatsPanelProps['hero']> = {},
): HeroStatsPanelProps['hero'] => ({
  id: 'test-hero-001',
  name: '赵云',
  quality: 'LEGENDARY',
  faction: 'shu',
  level: 35,
  maxLevel: 50,
  star: 5,
  breakthrough: 2,
  stats: { attack: 180, defense: 120, strategy: 90, speed: 150 },
  bonds: [
    { id: 'bond-1', name: '五虎上将', isActive: true },
    { id: 'bond-2', name: '蜀汉忠臣', isActive: false },
  ],
  ...overrides,
});

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────
describe('HeroStatsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染武将名字', () => {
    render(<HeroStatsPanel hero={makeHero({ name: '关羽' })} />);
    expect(screen.getByText('关羽')).toBeInTheDocument();
  });

  it('应渲染武将头像首字', () => {
    render(<HeroStatsPanel hero={makeHero({ name: '赵云' })} />);
    expect(screen.getByText('赵')).toBeInTheDocument();
  });

  it('应渲染阵营标签', () => {
    render(<HeroStatsPanel hero={makeHero({ faction: 'shu' })} />);
    // 阵营标签在 .tk-hero-stats-faction-tag 中
    const panel = screen.getByTestId('hero-stats-panel-test-hero-001');
    const factionTag = panel.querySelector('.tk-hero-stats-faction-tag');
    expect(factionTag).toHaveTextContent('蜀');
  });

  it('应渲染魏阵营标签', () => {
    render(<HeroStatsPanel hero={makeHero({ faction: 'wei' })} />);
    expect(screen.getByText(/魏/)).toBeInTheDocument();
  });

  it('应渲染 data-testid 属性', () => {
    render(<HeroStatsPanel hero={makeHero({ id: 'hero-123' })} />);
    expect(screen.getByTestId('hero-stats-panel-hero-123')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 等级与经验条
  // ═══════════════════════════════════════════

  it('应渲染等级信息', () => {
    render(<HeroStatsPanel hero={makeHero({ level: 25, maxLevel: 50 })} />);
    expect(screen.getByText(/Lv\.25 \/ 50/)).toBeInTheDocument();
  });

  it('应渲染经验进度条', () => {
    render(<HeroStatsPanel hero={makeHero({ level: 25, maxLevel: 50 })} />);
    const progressBar = screen.getByRole('progressbar', { name: '经验进度' });
    expect(progressBar).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 星级显示
  // ═══════════════════════════════════════════

  it('应渲染星级区域', () => {
    render(<HeroStatsPanel hero={makeHero({ star: 5 })} />);
    // StarDisplay 组件渲染 aria-label="5星"
    const starEl = screen.getByRole('img', { name: '5星' });
    expect(starEl).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 突破节点
  // ═══════════════════════════════════════════

  it('应渲染4个突破节点', () => {
    render(<HeroStatsPanel hero={makeHero({ breakthrough: 2 })} />);
    expect(screen.getByTestId('breakthrough-nodes').children).toHaveLength(4);
  });

  it('已突破节点应有 active 类名', () => {
    render(<HeroStatsPanel hero={makeHero({ breakthrough: 3 })} />);
    const node0 = screen.getByTestId('bt-node-0');
    const node2 = screen.getByTestId('bt-node-2');
    const node3 = screen.getByTestId('bt-node-3');
    expect(node0.className).toContain('active');
    expect(node2.className).toContain('active');
    expect(node3.className).not.toContain('active');
  });

  // ═══════════════════════════════════════════
  // 5. 四维属性
  // ═══════════════════════════════════════════

  it('应渲染攻击属性', () => {
    render(<HeroStatsPanel hero={makeHero({ stats: { attack: 180, defense: 100, strategy: 80, speed: 120 } })} />);
    expect(screen.getByTestId('stat-attack')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
  });

  it('应渲染全部四维属性', () => {
    render(<HeroStatsPanel hero={makeHero()} />);
    expect(screen.getByTestId('stat-attack')).toBeInTheDocument();
    expect(screen.getByTestId('stat-defense')).toBeInTheDocument();
    expect(screen.getByTestId('stat-strategy')).toBeInTheDocument();
    expect(screen.getByTestId('stat-speed')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. 羁绊列表
  // ═══════════════════════════════════════════

  it('应渲染羁绊标签', () => {
    render(<HeroStatsPanel hero={makeHero()} />);
    expect(screen.getByText(/五虎上将/)).toBeInTheDocument();
    expect(screen.getByText(/蜀汉忠臣/)).toBeInTheDocument();
  });

  it('已激活羁绊应有 active 样式', () => {
    render(<HeroStatsPanel hero={makeHero()} />);
    const activeBond = screen.getByTestId('bond-tag-bond-1');
    expect(activeBond.className).toContain('active');
  });

  it('无羁绊时不渲染羁绊区域', () => {
    render(<HeroStatsPanel hero={makeHero({ bonds: [] })} />);
    // 羁绊区域不应存在
    const bondsSection = screen.queryByText('羁绊');
    expect(bondsSection).not.toBeInTheDocument();
  });
});
