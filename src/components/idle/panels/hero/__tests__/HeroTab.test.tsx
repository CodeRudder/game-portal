/**
 * HeroTab UI 交互测试
 *
 * 覆盖场景（≥15个用例）：
 * - 武将列表正确渲染（空列表/有武将）
 * - 筛选功能（按品质/按阵营）
 * - 排序功能（按战力/按等级/按品质）
 * - 点击武将卡片打开详情
 * - 空列表时显示招募引导
 * - 招募按钮点击打开招募弹窗
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroTab from '../HeroTab';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import { Quality } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../HeroTab.css', () => ({}));
vi.mock('../HeroCard.css', () => ({}));
vi.mock('../HeroDetailModal.css', () => ({}));
vi.mock('../RecruitModal.css', () => ({}));
vi.mock('@/components/idle/common/Toast', () => ({
  Toast: {
    show: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    danger: vi.fn(),
    info: vi.fn(),
  },
}));

// ─────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────

const makeGeneral = (overrides: Partial<GeneralData> = {}): GeneralData => ({
  id: 'guanyu',
  name: '关羽',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
  level: 10,
  exp: 500,
  faction: 'shu',
  skills: [
    { id: 's1', name: '青龙偃月', type: 'active', level: 1, description: '200%物伤' },
  ],
  ...overrides,
});

const generals: GeneralData[] = [
  makeGeneral({ id: 'guanyu', name: '关羽', quality: Quality.LEGENDARY, faction: 'shu', level: 10, baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 } }),
  makeGeneral({ id: 'caocao', name: '曹操', quality: Quality.LEGENDARY, faction: 'wei', level: 8, baseStats: { attack: 92, defense: 88, intelligence: 110, speed: 82 } }),
  makeGeneral({ id: 'dianwei', name: '典韦', quality: Quality.RARE, faction: 'wei', level: 5, baseStats: { attack: 95, defense: 82, intelligence: 35, speed: 55 } }),
  makeGeneral({ id: 'zhouyu', name: '周瑜', quality: Quality.EPIC, faction: 'wu', level: 7, baseStats: { attack: 75, defense: 70, intelligence: 100, speed: 90 } }),
  makeGeneral({ id: 'lvbu', name: '吕布', quality: Quality.LEGENDARY, faction: 'qun', level: 12, baseStats: { attack: 120, defense: 75, intelligence: 40, speed: 85 } }),
];

// ─────────────────────────────────────────────
// Mock Engine Factory
// ─────────────────────────────────────────────

function makeMockEngine(generalList: GeneralData[] = generals) {
  const powerMap: Record<string, number> = {};
  generalList.forEach((g) => {
    const statsPower = g.baseStats.attack * 2 + g.baseStats.defense * 1.5 + g.baseStats.intelligence * 2 + g.baseStats.speed;
    const levelFactor = 1 + g.level * 0.05;
    const qualityFactors: Record<string, number> = { COMMON: 1, FINE: 1.15, RARE: 1.3, EPIC: 1.5, LEGENDARY: 1.8 };
    powerMap[g.id] = Math.floor(statsPower * levelFactor * (qualityFactors[g.quality] ?? 1));
  });

  const totalPower = generalList.reduce((sum, g) => sum + (powerMap[g.id] ?? 0), 0);

  return {
    getGenerals: vi.fn(() => [...generalList]),
    getGeneral: vi.fn((id: string) => generalList.find((g) => g.id === id)),
    getHeroSystem: vi.fn(() => ({
      calculatePower: vi.fn((g: GeneralData) => powerMap[g.id] ?? 0),
      calculateTotalPower: vi.fn(() => totalPower),
      getFragments: vi.fn(() => 0),
    })),
    getLevelSystem: vi.fn(() => ({
      getExpProgress: vi.fn(() => ({ current: 500, required: 1000, percentage: 50 })),
    })),
    getEnhancePreview: vi.fn(() => ({
      generalId: 'guanyu',
      generalName: '关羽',
      currentLevel: 10,
      targetLevel: 11,
      totalExp: 100,
      totalGold: 50,
      statsDiff: { before: { attack: 115, defense: 90, intelligence: 65, speed: 78 }, after: { attack: 118, defense: 93, intelligence: 67, speed: 80 } },
      powerBefore: 1000,
      powerAfter: 1100,
      affordable: true,
    })),
    enhanceHero: vi.fn(() => ({ general: generalList[0], levelsGained: 1, goldSpent: 50, expSpent: 100, statsDiff: { before: {}, after: {} } })),
    recruit: vi.fn(() => null),
    getRecruitSystem: vi.fn(() => ({
      getRecruitCost: vi.fn(() => ({ resourceType: 'gold', amount: 100 })),
      canRecruit: vi.fn(() => true),
      getGachaState: vi.fn(() => ({ normalPity: 0, advancedPity: 0, normalHardPity: 0, advancedHardPity: 0 })),
    })),
  } as unknown as ThreeKingdomsEngine;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('HeroTab', () => {
  const defaultProps = {
    engine: makeMockEngine(),
    snapshotVersion: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 武将列表正确渲染
  // ═══════════════════════════════════════════

  it('应正确渲染武将列表，显示所有武将卡片', () => {
    render(<HeroTab {...defaultProps} />);
    // 应显示所有5个武将的名字
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('曹操')).toBeInTheDocument();
    expect(screen.getByText('典韦')).toBeInTheDocument();
    expect(screen.getByText('周瑜')).toBeInTheDocument();
    expect(screen.getByText('吕布')).toBeInTheDocument();
  });

  it('空武将列表应显示招募引导', () => {
    const emptyEngine = makeMockEngine([]);
    render(<HeroTab engine={emptyEngine} snapshotVersion={1} />);

    expect(screen.getByText('暂无武将')).toBeInTheDocument();
    expect(screen.getByText('招募天下英才，共图霸业')).toBeInTheDocument();
    expect(screen.getByText('前往招募')).toBeInTheDocument();
  });

  it('有武将时不应显示空列表引导', () => {
    render(<HeroTab {...defaultProps} />);
    expect(screen.queryByText('暂无武将')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 筛选功能 — 按阵营
  // ═══════════════════════════════════════════

  it('点击"蜀"阵营筛选应只显示蜀国武将', async () => {
    render(<HeroTab {...defaultProps} />);

    // 默认显示全部5个武将
    expect(screen.getByText('关羽')).toBeInTheDocument();

    // 点击"蜀"筛选按钮
    const shuBtn = screen.getByText('蜀');
    await userEvent.click(shuBtn);

    // 应仍显示蜀国武将
    expect(screen.getByText('关羽')).toBeInTheDocument();
    // 非蜀国武将不应显示
    expect(screen.queryByText('曹操')).not.toBeInTheDocument();
    expect(screen.queryByText('典韦')).not.toBeInTheDocument();
    expect(screen.queryByText('周瑜')).not.toBeInTheDocument();
    expect(screen.queryByText('吕布')).not.toBeInTheDocument();
  });

  it('点击"全部"应恢复显示所有武将', async () => {
    render(<HeroTab {...defaultProps} />);

    // 先筛选蜀
    await userEvent.click(screen.getByText('蜀'));
    expect(screen.queryByText('曹操')).not.toBeInTheDocument();

    // 再点全部
    await userEvent.click(screen.getByText('全部'));
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('曹操')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 筛选功能 — 按品质
  // ═══════════════════════════════════════════

  it('选择"稀有"品质筛选应只显示稀有武将', async () => {
    render(<HeroTab {...defaultProps} />);

    // 品质下拉选择"稀有"
    const qualitySelects = screen.getAllByRole('combobox');
    // 第一个select是品质筛选
    await userEvent.selectOptions(qualitySelects[0], 'RARE');

    // 只有典韦是稀有
    expect(screen.getByText('典韦')).toBeInTheDocument();
    expect(screen.queryByText('关羽')).not.toBeInTheDocument();
    expect(screen.queryByText('曹操')).not.toBeInTheDocument();
  });

  it('选择"全部品质"应恢复显示所有武将', async () => {
    render(<HeroTab {...defaultProps} />);

    const qualitySelects = screen.getAllByRole('combobox');
    // 先选稀有
    await userEvent.selectOptions(qualitySelects[0], 'RARE');
    expect(screen.queryByText('关羽')).not.toBeInTheDocument();

    // 再选全部
    await userEvent.selectOptions(qualitySelects[0], 'all');
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('典韦')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 排序功能
  // ═══════════════════════════════════════════

  it('切换排序方式为"等级排序"应按等级降序排列', async () => {
    render(<HeroTab {...defaultProps} />);

    const qualitySelects = screen.getAllByRole('combobox');
    // 第二个select是排序
    await userEvent.selectOptions(qualitySelects[1], 'level');

    // 获取所有武将卡片
    const cards = screen.getAllByRole('button').filter(
      (el) => el.getAttribute('aria-label')?.includes('Lv.'),
    );
    // 吕布(12) > 关羽(10) > 曹操(8) > 周瑜(7) > 典韦(5)
    expect(cards[0].getAttribute('aria-label')).toContain('吕布');
    expect(cards[cards.length - 1].getAttribute('aria-label')).toContain('典韦');
  });

  it('切换排序方式为"品质排序"应按品质降序排列', async () => {
    render(<HeroTab {...defaultProps} />);

    const qualitySelects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(qualitySelects[1], 'quality');

    const cards = screen.getAllByRole('button').filter(
      (el) => el.getAttribute('aria-label')?.includes('Lv.'),
    );
    // 传说(关羽/曹操/吕布/诸葛亮/赵云) > 史诗(周瑜) > 稀有(典韦)
    // 第一个应该是传说品质武将
    const firstCard = cards[0];
    expect(firstCard.getAttribute('aria-label')).toMatch(/关羽|曹操|吕布/);
    // 最后一个应该是稀有典韦
    expect(cards[cards.length - 1].getAttribute('aria-label')).toContain('典韦');
  });

  // ═══════════════════════════════════════════
  // 5. 点击武将卡片打开详情
  // ═══════════════════════════════════════════

  it('点击武将卡片应打开详情弹窗', async () => {
    render(<HeroTab {...defaultProps} />);

    // 点击关羽卡片
    const guanyuCard = screen.getAllByRole('button').find(
      (el) => el.getAttribute('aria-label')?.includes('关羽'),
    )!;
    await userEvent.click(guanyuCard);

    // 应显示详情弹窗
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // 弹窗 aria-label 应包含关羽
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toContain('关羽');
  });

  // ═══════════════════════════════════════════
  // 6. 招募按钮
  // ═══════════════════════════════════════════

  it('点击"招募"按钮应打开招募弹窗', async () => {
    render(<HeroTab {...defaultProps} />);

    const recruitBtn = screen.getByText('🏛️ 招募');
    await userEvent.click(recruitBtn);

    // 应显示招募弹窗
    expect(screen.getByText('⚔️ 招贤纳士')).toBeInTheDocument();
  });

  it('空列表点击"前往招募"应打开招募弹窗', async () => {
    const emptyEngine = makeMockEngine([]);
    render(<HeroTab engine={emptyEngine} snapshotVersion={1} />);

    const emptyRecruitBtn = screen.getByText('前往招募');
    await userEvent.click(emptyRecruitBtn);

    expect(screen.getByText('⚔️ 招贤纳士')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 7. 总战力显示
  // ═══════════════════════════════════════════

  it('应显示总战力信息', () => {
    render(<HeroTab {...defaultProps} />);
    expect(screen.getByText(/总战力/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 8. 底部信息栏
  // ═══════════════════════════════════════════

  it('有武将时底部应显示武将总数', () => {
    render(<HeroTab {...defaultProps} />);
    expect(screen.getByText('武将总数: 5')).toBeInTheDocument();
  });

  it('空列表时底部不显示武将总数', () => {
    const emptyEngine = makeMockEngine([]);
    render(<HeroTab engine={emptyEngine} snapshotVersion={1} />);
    expect(screen.queryByText(/武将总数/)).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 9. 阵营筛选按钮高亮
  // ═══════════════════════════════════════════

  it('当前选中的阵营筛选按钮应有高亮样式', async () => {
    render(<HeroTab {...defaultProps} />);

    // 默认"全部"高亮
    const allBtn = screen.getByText('全部');
    expect(allBtn.className).toContain('active');

    // 点击"蜀"
    const shuBtn = screen.getByText('蜀');
    await userEvent.click(shuBtn);
    expect(shuBtn.className).toContain('active');
    expect(allBtn.className).not.toContain('active');
  });
});
