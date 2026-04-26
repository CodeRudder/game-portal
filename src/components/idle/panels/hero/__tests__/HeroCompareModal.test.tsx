/**
 * HeroCompareModal UI 交互测试
 *
 * 覆盖场景：
 * - 渲染测试：两武将并排展示
 * - 属性对比：高亮差异属性
 * - 关闭回调
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroCompareModal from '../HeroCompareModal';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { GeneralData } from '@/games/three-kingdoms/engine';
import { Quality } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../HeroCompareModal.css', () => ({}));

// ─────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────

const baseGeneral: GeneralData = {
  id: 'guanyu',
  name: '关羽',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
  level: 30,
  exp: 2000,
  faction: 'shu',
  skills: [],
};

const compareGeneral: GeneralData = {
  id: 'zhangfei',
  name: '张飞',
  quality: Quality.EPIC,
  baseStats: { attack: 120, defense: 70, intelligence: 40, speed: 60 },
  level: 25,
  exp: 1500,
  faction: 'shu',
  skills: [],
};

const thirdGeneral: GeneralData = {
  id: 'zhaoyun',
  name: '赵云',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 100, defense: 95, intelligence: 75, speed: 90 },
  level: 35,
  exp: 3000,
  faction: 'shu',
  skills: [],
};

// ─────────────────────────────────────────────
// Mock Engine Factory
// ─────────────────────────────────────────────

function makeMockEngine(generals: GeneralData[] = [baseGeneral, compareGeneral, thirdGeneral]) {
  const generalMap = new Map(generals.map((g) => [g.id, g]));

  const heroStarSystem = {
    getStar: vi.fn((_id: string) => 1),
  };

  const heroSystem = {
    calculatePower: vi.fn((g: GeneralData, _star = 1) => {
      const s = g.baseStats;
      return s.attack * 10 + s.defense * 8 + s.intelligence * 5 + s.speed * 3 + g.level * 100;
    }),
    getGeneral: vi.fn((id: string) => generalMap.get(id) ?? null),
  };

  return {
    getHeroSystem: vi.fn(() => heroSystem),
    getHeroStarSystem: vi.fn(() => heroStarSystem),
    getGenerals: vi.fn(() => generals),
  } as unknown as ThreeKingdomsEngine;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('HeroCompareModal', () => {
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

  it('应渲染对比弹窗', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    expect(screen.getByTestId('tk-hero-compare-modal')).toBeInTheDocument();
  });

  it('应显示对比标题', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    expect(screen.getByText('⚔️ 武将对比')).toBeInTheDocument();
  });

  it('应显示基准武将名字', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    const modal = screen.getByTestId('tk-hero-compare-modal');
    const baseHero = modal.querySelector('.tk-compare-hero--base');
    expect(baseHero).toBeInTheDocument();
    expect(within(baseHero!).getByText('关羽')).toBeInTheDocument();
  });

  it('应显示基准武将等级', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    const modal = screen.getByTestId('tk-hero-compare-modal');
    const baseHero = modal.querySelector('.tk-compare-hero--base');
    expect(within(baseHero!).getByText(/Lv\.30/)).toBeInTheDocument();
  });

  it('应显示基准武将品质标签', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    const modal = screen.getByTestId('tk-hero-compare-modal');
    const baseHero = modal.querySelector('.tk-compare-hero--base');
    expect(within(baseHero!).getByText('传说')).toBeInTheDocument();
  });

  it('应显示对比武将信息', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    // 默认选中第一个非基准武将（张飞）
    expect(screen.getByText('张飞')).toBeInTheDocument();
  });

  it('应显示VS分隔符', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    // VS 在内容区和战力对比行都可能出现，使用 getAllByText
    const vsElements = screen.getAllByText('VS');
    expect(vsElements.length).toBeGreaterThanOrEqual(1);
  });

  it('应显示武将选择下拉框', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    const select = screen.getByDisplayValue('张飞 (Lv.25)');
    expect(select).toBeInTheDocument();
  });

  it('应显示所有可选武将', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    const options = screen.getAllByRole('option');
    // "-- 选择武将 --" + 张飞 + 赵云 = 3
    expect(options.length).toBe(3);
  });

  // ═══════════════════════════════════════════
  // 2. 属性对比
  // ═══════════════════════════════════════════

  it('应显示属性对比区域', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    expect(screen.getByText('属性对比')).toBeInTheDocument();
  });

  it('应显示四维属性标签', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    expect(screen.getByText('武力')).toBeInTheDocument();
    expect(screen.getByText('统率')).toBeInTheDocument();
    expect(screen.getByText('智力')).toBeInTheDocument();
    expect(screen.getByText('政治')).toBeInTheDocument();
  });

  it('应显示属性数值', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    // 关羽level=30: m=1.87, attack=Math.floor(115*1.87)=215
    // 张飞level=25: m=1.72, attack=Math.floor(120*1.72)=206
    const modal = screen.getByTestId('tk-hero-compare-modal');
    const statValues = modal.querySelectorAll('.tk-compare-stat-value');
    const values = Array.from(statValues).map((el) => el.textContent);
    expect(values).toContain('215');
    expect(values).toContain('206');
  });

  it('应高亮优势属性（胜方标绿）', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    const modal = screen.getByTestId('tk-hero-compare-modal');
    // 关羽防御90 > 张飞防御70 → 关羽防御值应带 win class
    const winValues = modal.querySelectorAll('.tk-compare-stat-value--win');
    expect(winValues.length).toBeGreaterThan(0);
  });

  it('应显示属性差值', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    const modal = screen.getByTestId('tk-hero-compare-modal');
    const diffs = modal.querySelectorAll('.tk-compare-stat-diff');
    // 关羽attack=215 - 张飞attack=206 = +9
    const diffTexts = Array.from(diffs).map((el) => el.textContent);
    expect(diffTexts).toContain('+9');
  });

  it('优势方差值应显示正数', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    const modal = screen.getByTestId('tk-hero-compare-modal');
    const diffs = modal.querySelectorAll('.tk-compare-stat-diff');
    const diffTexts = Array.from(diffs).map((el) => el.textContent);
    // 关羽defense=168 - 张飞defense=120 = +48
    expect(diffTexts).toContain('+48');
  });

  it('应显示战力对比', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);
    const modal = screen.getByTestId('tk-hero-compare-modal');
    const powerRow = modal.querySelector('.tk-compare-power-row');
    expect(powerRow).toBeInTheDocument();
    expect(within(powerRow!).getByText('总战力')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 武将选择切换
  // ═══════════════════════════════════════════

  it('切换对比武将应更新显示', async () => {
    const user = userEvent.setup();
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);

    // 默认显示张飞
    expect(screen.getByText('张飞')).toBeInTheDocument();

    // 切换到赵云
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'zhaoyun');

    expect(screen.getByText('赵云')).toBeInTheDocument();
  });

  it('选择空选项应显示请选择武将', async () => {
    const user = userEvent.setup();
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, '');

    expect(screen.getByText('请选择武将')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 关闭回调
  // ═══════════════════════════════════════════

  it('点击关闭按钮应触发onClose', async () => {
    const user = userEvent.setup();
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);

    const closeBtn = screen.getByLabelText('关闭');
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层应触发onClose', async () => {
    const user = userEvent.setup();
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);

    const overlay = screen.getByTestId('tk-hero-compare-modal');
    await user.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('按ESC键应触发onClose', () => {
    render(<HeroCompareModal baseGeneral={baseGeneral} engine={makeMockEngine()} onClose={onClose} />);

    // 模拟 ESC 键
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(escEvent);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 5. 边缘情况
  // ═══════════════════════════════════════════

  it('无其他武将时选择框只有默认选项', () => {
    render(
      <HeroCompareModal
        baseGeneral={baseGeneral}
        engine={makeMockEngine([baseGeneral])}
        onClose={onClose}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toBe('-- 选择武将 --');
  });

  it('无其他武将时应显示请选择武将', () => {
    render(
      <HeroCompareModal
        baseGeneral={baseGeneral}
        engine={makeMockEngine([baseGeneral])}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('请选择武将')).toBeInTheDocument();
  });

  it('相同属性值应显示等号', () => {
    const sameStatGeneral: GeneralData = {
      id: 'clone',
      name: '克隆关羽',
      quality: Quality.LEGENDARY,
      baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
      level: 30,
      exp: 2000,
      faction: 'shu',
      skills: [],
    };
    render(
      <HeroCompareModal
        baseGeneral={baseGeneral}
        engine={makeMockEngine([baseGeneral, sameStatGeneral])}
        onClose={onClose}
      />,
    );
    const modal = screen.getByTestId('tk-hero-compare-modal');
    const diffs = modal.querySelectorAll('.tk-compare-stat-diff');
    const diffTexts = Array.from(diffs).map((el) => el.textContent);
    expect(diffTexts).toContain('=');
  });
});
