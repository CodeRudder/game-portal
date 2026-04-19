/**
 * HeroDetailModal UI 交互测试
 *
 * 覆盖场景（≥10个用例）：
 * - 详情弹窗正确渲染（武将名/品质/等级/属性/技能）
 * - 属性条显示正确
 * - 升级按钮功能
 * - 关闭弹窗功能
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroDetailModal from '../HeroDetailModal';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { GeneralData, EnhancePreview } from '@/games/three-kingdoms/engine';
import { Quality } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../HeroDetailModal.css', () => ({}));
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

const baseGeneral: GeneralData = {
  id: 'guanyu',
  name: '关羽',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
  level: 10,
  exp: 500,
  faction: 'shu',
  skills: [
    { id: 's1', name: '青龙偃月', type: 'active', level: 1, description: '200%物伤无视30%防' },
    { id: 's2', name: '武圣', type: 'passive', level: 2, description: '暴击+15%暴伤+30%' },
  ],
};

const enhancePreview: EnhancePreview = {
  generalId: 'guanyu',
  generalName: '关羽',
  currentLevel: 10,
  targetLevel: 11,
  totalExp: 100,
  totalGold: 50,
  statsDiff: {
    before: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
    after: { attack: 118, defense: 93, intelligence: 67, speed: 80 },
  },
  powerBefore: 1000,
  powerAfter: 1100,
  affordable: true,
};

// ─────────────────────────────────────────────
// Mock Engine Factory
// ─────────────────────────────────────────────

function makeMockEngine(options: {
  general?: GeneralData;
  affordable?: boolean;
  enhanceResult?: any;
} = {}) {
  const general = options.general ?? baseGeneral;
  const affordable = options.affordable ?? true;
  const preview = { ...enhancePreview, affordable };

  return {
    getHeroSystem: vi.fn(() => ({
      calculatePower: vi.fn(() => 1082),
      getFragments: vi.fn(() => 30),
    })),
    getLevelSystem: vi.fn(() => ({
      getExpProgress: vi.fn(() => ({ current: 500, required: 1000, percentage: 50 })),
    })),
    getEnhancePreview: vi.fn(() => preview),
    enhanceHero: vi.fn(() =>
      options.enhanceResult ?? {
        general: { ...general, level: 11 },
        levelsGained: 1,
        goldSpent: 50,
        expSpent: 100,
        statsDiff: { before: general.baseStats, after: { attack: 118, defense: 93, intelligence: 67, speed: 80 } },
      }
    ),
    getGeneral: vi.fn(() => ({ ...general, level: 11 })),
  } as unknown as ThreeKingdomsEngine;
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('HeroDetailModal', () => {
  const defaultProps = {
    general: baseGeneral,
    engine: makeMockEngine(),
    onClose: vi.fn(),
    onEnhanceComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 弹窗正确渲染
  // ═══════════════════════════════════════════

  it('应渲染武将名称', () => {
    render(<HeroDetailModal {...defaultProps} />);
    // 标题栏中的武将名
    const nameEl = screen.getByText('关羽', { selector: '.tk-hero-detail-title-name' });
    expect(nameEl).toBeInTheDocument();
  });

  it('应渲染武将品质标签', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText('传说')).toBeInTheDocument();
  });

  it('应渲染武将阵营', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText('蜀')).toBeInTheDocument();
  });

  it('应渲染武将等级', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText(/Lv\.10/)).toBeInTheDocument();
  });

  it('应渲染四维属性标签', () => {
    render(<HeroDetailModal {...defaultProps} />);
    // 雷达图和属性条都渲染标签，使用 getAllByText
    expect(screen.getAllByText('武力').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('统率').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('智力').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('政治').length).toBeGreaterThanOrEqual(1);
  });

  it('应渲染属性数值', () => {
    render(<HeroDetailModal {...defaultProps} />);
    // 雷达图和属性条都渲染数值，使用 getAllByText
    expect(screen.getAllByText('115').length).toBeGreaterThanOrEqual(1); // attack
    expect(screen.getAllByText('90').length).toBeGreaterThanOrEqual(1);  // defense
    expect(screen.getAllByText('65').length).toBeGreaterThanOrEqual(1);  // intelligence
    expect(screen.getAllByText('78').length).toBeGreaterThanOrEqual(1);  // speed
  });

  // ═══════════════════════════════════════════
  // 2. 技能列表
  // ═══════════════════════════════════════════

  it('应渲染技能列表', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText('青龙偃月')).toBeInTheDocument();
    expect(screen.getByText('武圣')).toBeInTheDocument();
    expect(screen.getByText('200%物伤无视30%防')).toBeInTheDocument();
    expect(screen.getByText('暴击+15%暴伤+30%')).toBeInTheDocument();
  });

  it('应显示技能类型标签', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText('主动')).toBeInTheDocument();
    expect(screen.getByText('被动')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 升级功能
  // ═══════════════════════════════════════════

  it('应渲染升级按钮', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText('升级至 Lv.11')).toBeInTheDocument();
  });

  it('点击升级按钮应调用 engine.enhanceHero', async () => {
    const engine = makeMockEngine();
    render(<HeroDetailModal {...defaultProps} engine={engine} />);

    const enhanceBtn = screen.getByText('升级至 Lv.11');
    await userEvent.click(enhanceBtn);

    expect(engine.enhanceHero).toHaveBeenCalledWith('guanyu', 11);
  });

  it('升级成功后应调用 onEnhanceComplete', async () => {
    const onEnhanceComplete = vi.fn();
    const engine = makeMockEngine();
    render(<HeroDetailModal {...defaultProps} engine={engine} onEnhanceComplete={onEnhanceComplete} />);

    const enhanceBtn = screen.getByText('升级至 Lv.11');
    await userEvent.click(enhanceBtn);

    expect(onEnhanceComplete).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 4. 关闭弹窗
  // ═══════════════════════════════════════════

  it('点击关闭按钮应调用 onClose', async () => {
    const onClose = vi.fn();
    render(<HeroDetailModal {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: '关闭' });
    await userEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层应调用 onClose', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <HeroDetailModal {...defaultProps} onClose={onClose} />,
    );

    const overlay = container.querySelector('.tk-hero-detail-overlay')!;
    await userEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 5. 资源不足时升级按钮禁用
  // ═══════════════════════════════════════════

  it('资源不足时升级按钮应被禁用', () => {
    const engine = makeMockEngine({ affordable: false });
    render(<HeroDetailModal {...defaultProps} engine={engine} />);

    const enhanceBtn = screen.getByText('升级至 Lv.11');
    expect(enhanceBtn).toBeDisabled();
  });

  // ═══════════════════════════════════════════
  // 6. 战力和碎片显示
  // ═══════════════════════════════════════════

  it('应显示战力值', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText(/⚔️ 战力/)).toBeInTheDocument();
  });

  it('应显示碎片数量', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText(/碎片/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 7. +5级按钮
  // ═══════════════════════════════════════════

  it('点击+5级按钮应更新目标等级', async () => {
    const engine = makeMockEngine();
    render(<HeroDetailModal {...defaultProps} engine={engine} />);
    const maxBtn = screen.getByText('+5级');
    await userEvent.click(maxBtn);

    // 目标等级应变为 Lv.15 (10+5)
    expect(screen.getByText(/目标等级: Lv\.15/)).toBeInTheDocument();
  });
});
