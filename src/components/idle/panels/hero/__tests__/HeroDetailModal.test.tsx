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
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroDetailModal from '../HeroDetailModal';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { GeneralData, EnhancePreview } from '@/games/three-kingdoms/engine';
import { Quality } from '@/games/three-kingdoms/engine';
import * as EngineModule from '@/games/three-kingdoms/engine';

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
// Mock GENERAL_DEF_MAP for biography tests
// ─────────────────────────────────────────────
const ORIGINAL_GENERAL_DEF_MAP = EngineModule.GENERAL_DEF_MAP;

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
  canSynthesize?: boolean;
} = {}) {
  const general = options.general ?? baseGeneral;
  const affordable = options.affordable ?? true;
  const preview = { ...enhancePreview, affordable };

  const heroSystem = {
    calculatePower: vi.fn(() => 1082),
    getFragments: vi.fn(() => 30),
    getSynthesizeProgress: vi.fn(() => ({ current: 30, required: 80 })),
    canSynthesize: vi.fn(() => options.canSynthesize ?? false),
    fragmentSynthesize: vi.fn(() => null),
  };

  return {
    getHeroSystem: vi.fn(() => heroSystem),
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

  afterEach(() => {
    cleanup();
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
    // 碎片区域包含进度和合成按钮，使用 getAllByText
    expect(screen.getAllByText(/碎片/).length).toBeGreaterThanOrEqual(1);
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

  // ═══════════════════════════════════════════
  // 8. 碎片合成
  // ═══════════════════════════════════════════

  it('应渲染碎片合成按钮', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText(/碎片合成/)).toBeInTheDocument();
  });

  it('碎片不足时合成按钮应被禁用', () => {
    render(<HeroDetailModal {...defaultProps} />);
    const synthBtn = screen.getByText(/碎片合成/);
    expect(synthBtn).toBeDisabled();
  });

  it('碎片充足时合成按钮应可点击', () => {
    const engine = makeMockEngine({ canSynthesize: true });
    render(<HeroDetailModal {...defaultProps} engine={engine} />);
    const synthBtn = screen.getByText('✨ 碎片合成');
    expect(synthBtn).not.toBeDisabled();
  });

  it('点击合成按钮应调用 fragmentSynthesize', async () => {
    const engine = makeMockEngine({ canSynthesize: true });
    render(<HeroDetailModal {...defaultProps} engine={engine} />);

    const synthBtn = screen.getByText('✨ 碎片合成');
    await userEvent.click(synthBtn);

    const heroSystem = engine.getHeroSystem();
    expect(heroSystem.fragmentSynthesize).toHaveBeenCalledWith('guanyu');
  });

  // ═══════════════════════════════════════════
  // 9. 武将传记
  // ═══════════════════════════════════════════

  it('有传记时应渲染传记文本', () => {
    // guanyu 在 GENERAL_DEF_MAP 中存在传记
    render(<HeroDetailModal {...defaultProps} />);
    const bioEl = document.querySelector('.tk-hero-detail-biography');
    expect(bioEl).toBeInTheDocument();
    expect(bioEl?.tagName).toBe('P');
  });

  it('无传记时不渲染传记区域', () => {
    // 使用一个不存在于 GENERAL_DEF_MAP 中的武将 ID
    const unknownGeneral: GeneralData = {
      ...baseGeneral,
      id: 'unknown_hero_no_bio',
    };
    const engine = makeMockEngine({ general: unknownGeneral });
    render(
      <HeroDetailModal
        general={unknownGeneral}
        engine={engine}
        onClose={vi.fn()}
        onEnhanceComplete={vi.fn()}
      />,
    );
    const bioEl = document.querySelector('.tk-hero-detail-biography');
    expect(bioEl).not.toBeInTheDocument();
  });

  it('传记文本内容应与 GENERAL_DEF_MAP 中的数据一致', () => {
    render(<HeroDetailModal {...defaultProps} />);
    const expectedBio = EngineModule.GENERAL_DEF_MAP.get('guanyu')?.biography;
    expect(expectedBio).toBeTruthy();
    const bioEl = document.querySelector('.tk-hero-detail-biography');
    expect(bioEl?.textContent).toBe(expectedBio);
  });

  it('传记元素应有正确的样式类名 tk-hero-detail-biography', () => {
    render(<HeroDetailModal {...defaultProps} />);
    const bioEl = document.querySelector('p.tk-hero-detail-biography');
    expect(bioEl).toBeInTheDocument();
  });

  it('传记文本为空字符串时不显示传记区域', () => {
    // 模拟 GENERAL_DEF_MAP 返回空字符串传记
    const mockMap = new Map(ORIGINAL_GENERAL_DEF_MAP);
    mockMap.set('guanyu', { ...mockMap.get('guanyu')!, biography: '' });

    // mockMap 是可变 Map，GENERAL_DEF_MAP 类型为 Readonly<Map>，需通过 unknown 桥接
    vi.spyOn(EngineModule, 'GENERAL_DEF_MAP', 'get').mockReturnValue(
      mockMap as unknown as typeof EngineModule.GENERAL_DEF_MAP,
    );

    render(<HeroDetailModal {...defaultProps} />);
    // biography='' 是 falsy，所以不应渲染
    const bioEl = document.querySelector('.tk-hero-detail-biography');
    expect(bioEl).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
