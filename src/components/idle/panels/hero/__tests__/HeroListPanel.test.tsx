/**
 * HeroListPanel — 武将列表面板测试
 *
 * 覆盖场景：
 * - 基础渲染：武将卡片、名字、等级、星级、战力
 * - 品质色边框和标签
 * - 阵营筛选：全部/魏/蜀/吴/群雄
 * - 排序：等级/战力/品质/星级
 * - 搜索框：按名字搜索
 * - 点击武将卡片回调
 * - 底部统计：总数和品质统计
 * - 空状态
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeroListPanel from '../HeroListPanel';

// ── Mock CSS ──
vi.mock('../HeroListPanel.css', () => ({}));
vi.mock('../../../common/constants', () => ({
  HERO_QUALITY_COLORS: {
    COMMON: '#9e9e9e',
    FINE: '#2196f3',
    RARE: '#9c27b0',
    EPIC: '#f44336',
    LEGENDARY: '#ff9800',
  },
  HERO_QUALITY_BG_COLORS: {
    COMMON: 'rgba(158,158,158,0.15)',
    FINE: 'rgba(33,150,243,0.15)',
    RARE: 'rgba(156,39,176,0.15)',
    EPIC: 'rgba(244,67,54,0.15)',
    LEGENDARY: 'rgba(255,152,0,0.15)',
  },
}));

// ── 测试数据 ──
const makeHeroes = () => [
  { id: 'guanyu', name: '关羽', quality: 'LEGENDARY', faction: 'shu', level: 50, star: 5, power: 15000 },
  { id: 'caocao', name: '曹操', quality: 'LEGENDARY', faction: 'wei', level: 48, star: 5, power: 14500 },
  { id: 'zhaoyun', name: '赵云', quality: 'EPIC', faction: 'shu', level: 40, star: 4, power: 10000 },
  { id: 'zhouyu', name: '周瑜', quality: 'EPIC', faction: 'wu', level: 38, star: 4, power: 9500 },
  { id: 'lvbu', name: '吕布', quality: 'LEGENDARY', faction: 'qun', level: 45, star: 5, power: 16000 },
  { id: 'zhangliao', name: '张辽', quality: 'RARE', faction: 'wei', level: 30, star: 3, power: 6000 },
];

// ── 测试 ──

describe('HeroListPanel', () => {
  const onSelectHero = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染面板容器', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    expect(screen.getByTestId('hero-list-panel')).toBeInTheDocument();
  });

  it('应渲染所有武将卡片', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    expect(screen.getByTestId('hero-list-card-guanyu')).toBeInTheDocument();
    expect(screen.getByTestId('hero-list-card-caocao')).toBeInTheDocument();
    expect(screen.getByTestId('hero-list-card-lvbu')).toBeInTheDocument();
    expect(screen.getByTestId('hero-list-card-zhaoyun')).toBeInTheDocument();
  });

  it('应渲染武将名字', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    expect(screen.getByTestId('hero-name-guanyu')).toHaveTextContent('关羽');
    expect(screen.getByTestId('hero-name-lvbu')).toHaveTextContent('吕布');
  });

  it('应渲染武将等级', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    const card = screen.getByTestId('hero-list-card-guanyu');
    expect(card.textContent).toContain('Lv.50');
  });

  it('应渲染武将战力', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    const card = screen.getByTestId('hero-list-card-guanyu');
    expect(card.textContent).toContain('15,000');
  });

  it('应渲染品质标签', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    expect(screen.getByTestId('hero-quality-guanyu')).toHaveTextContent('传说');
    expect(screen.getByTestId('hero-quality-zhaoyun')).toHaveTextContent('史诗');
    expect(screen.getByTestId('hero-quality-zhangliao')).toHaveTextContent('稀有');
  });

  // ═══════════════════════════════════════════
  // 2. 阵营筛选
  // ═══════════════════════════════════════════

  it('点击蜀筛选应只显示蜀国武将', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    fireEvent.click(screen.getByTestId('faction-btn-shu'));
    expect(screen.getByTestId('hero-list-card-guanyu')).toBeInTheDocument();
    expect(screen.getByTestId('hero-list-card-zhaoyun')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-list-card-caocao')).not.toBeInTheDocument();
  });

  it('点击全部筛选应显示所有武将', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    fireEvent.click(screen.getByTestId('faction-btn-wei'));
    expect(screen.queryByTestId('hero-list-card-guanyu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('faction-btn-all'));
    expect(screen.getByTestId('hero-list-card-guanyu')).toBeInTheDocument();
    expect(screen.getByTestId('hero-list-card-caocao')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 搜索
  // ═══════════════════════════════════════════

  it('搜索框输入应筛选武将', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    const input = screen.getByTestId('hero-search-input');
    fireEvent.change(input, { target: { value: '关羽' } });
    expect(screen.getByTestId('hero-list-card-guanyu')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-list-card-caocao')).not.toBeInTheDocument();
  });

  it('搜索无结果应显示空状态', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    const input = screen.getByTestId('hero-search-input');
    fireEvent.change(input, { target: { value: '不存在的武将' } });
    expect(screen.getByTestId('hero-list-empty')).toHaveTextContent('暂无武将');
  });

  // ═══════════════════════════════════════════
  // 4. 排序
  // ═══════════════════════════════════════════

  it('排序下拉应可切换排序方式', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    const select = screen.getByTestId('hero-sort-select');
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'level' } });
    expect(select).toHaveValue('level');
  });

  // ═══════════════════════════════════════════
  // 5. 点击回调
  // ═══════════════════════════════════════════

  it('点击武将卡片应调用onSelectHero', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    fireEvent.click(screen.getByTestId('hero-list-card-guanyu'));
    expect(onSelectHero).toHaveBeenCalledWith('guanyu');
  });

  // ═══════════════════════════════════════════
  // 6. 底部统计
  // ═══════════════════════════════════════════

  it('应显示武将总数', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    expect(screen.getByTestId('hero-total-count')).toHaveTextContent('6');
  });

  it('应显示品质统计', () => {
    render(<HeroListPanel heroes={makeHeroes()} onSelectHero={onSelectHero} />);
    expect(screen.getByTestId('hero-stat-LEGENDARY')).toHaveTextContent('传说×3');
    expect(screen.getByTestId('hero-stat-EPIC')).toHaveTextContent('史诗×2');
    expect(screen.getByTestId('hero-stat-RARE')).toHaveTextContent('稀有×1');
  });

  // ═══════════════════════════════════════════
  // 7. 空列表
  // ═══════════════════════════════════════════

  it('空武将列表应显示空状态', () => {
    render(<HeroListPanel heroes={[]} onSelectHero={onSelectHero} />);
    expect(screen.getByTestId('hero-list-empty')).toHaveTextContent('暂无武将');
    expect(screen.getByTestId('hero-total-count')).toHaveTextContent('0');
  });
});
