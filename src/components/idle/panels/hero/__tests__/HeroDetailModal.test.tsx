/**
 * HeroDetailModal UI 交互测试
 *
 * 覆盖场景（≥15个用例）：
 * - 详情弹窗正确渲染（武将名/品质/等级/属性/技能）
 * - 属性条显示正确
 * - 升级按钮功能
 * - 关闭弹窗功能
 * - [增强] 羁绊标签显示
 * - [增强] 突破状态显示
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
vi.mock('../HeroDetailModal-chart.css', () => ({}));
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
    before: { attack: 146, defense: 114, intelligence: 82, speed: 99 },
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
  breakthroughStage?: number;
  levelCap?: number;
} = {}) {
  const general = options.general ?? baseGeneral;
  const affordable = options.affordable ?? true;
  const preview = { ...enhancePreview, affordable };
  const breakthroughStage = options.breakthroughStage ?? 0;
  const levelCap = options.levelCap ?? 50;

  const heroSystem = {
    calculatePower: vi.fn(() => 1082),
    getFragments: vi.fn(() => 30),
    getSynthesizeProgress: vi.fn(() => ({ current: 30, required: 80 })),
    canSynthesize: vi.fn(() => options.canSynthesize ?? false),
    fragmentSynthesize: vi.fn(() => null),
  };

  const starSystem = {
    getStar: vi.fn(() => 1),
    getLevelCap: vi.fn(() => levelCap),
    getBreakthroughStage: vi.fn(() => breakthroughStage),
    getFragmentProgress: vi.fn(() => ({ canStarUp: false })),
    getStarUpPreview: vi.fn(() => null),
    getBreakthroughPreview: vi.fn(() => null),
    starUp: vi.fn(() => ({ success: false, previousStar: 1, currentStar: 1 })),
    breakthrough: vi.fn(() => ({ success: false, newLevelCap: levelCap })),
  };

  return {
    getHeroSystem: vi.fn(() => heroSystem),
    getLevelSystem: vi.fn(() => ({
      getExpProgress: vi.fn(() => ({ current: 500, required: 1000, percentage: 50 })),
    })),
    getHeroStarSystem: vi.fn(() => starSystem),
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
    getResourceAmount: vi.fn(() => 1000),
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
    // level=10, m=1+(10-1)*0.03=1.27
    // attack=Math.floor(115*1.27)=146, defense=Math.floor(90*1.27)=114,
    // intelligence=Math.floor(65*1.27)=82, speed=Math.floor(78*1.27)=99
    expect(screen.getAllByText('146').length).toBeGreaterThanOrEqual(1); // attack
    expect(screen.getAllByText('114').length).toBeGreaterThanOrEqual(1);  // defense
    expect(screen.getAllByText('82').length).toBeGreaterThanOrEqual(1);  // intelligence
    expect(screen.getAllByText('99').length).toBeGreaterThanOrEqual(1);  // speed
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

  // ═══════════════════════════════════════════
  // 10. [增强] 羁绊标签显示
  // ═══════════════════════════════════════════

  it('应渲染羁绊标签区域', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByTestId('hero-detail-bonds')).toBeInTheDocument();
  });

  it('应显示"参与羁绊"标题', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText('参与羁绊')).toBeInTheDocument();
  });

  it('关羽应显示桃园结义羁绊标签', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByTestId('hero-bond-tag-partner_taoyuan')).toBeInTheDocument();
    expect(screen.getByTestId('hero-bond-tag-partner_taoyuan').textContent).toContain('桃园结义');
  });

  it('关羽应显示五虎上将羁绊标签', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByTestId('hero-bond-tag-partner_wuhu')).toBeInTheDocument();
    expect(screen.getByTestId('hero-bond-tag-partner_wuhu').textContent).toContain('五虎上将');
  });

  it('关羽应显示三英战吕布羁绊标签', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByTestId('hero-bond-tag-partner_sanying_lvbu')).toBeInTheDocument();
  });

  it('应显示阵营羁绊标签', () => {
    render(<HeroDetailModal {...defaultProps} />);
    // 关羽属于蜀国，应显示蜀国阵营羁绊
    expect(screen.getByTestId('hero-bond-tag-faction_shu')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 11. [增强] 突破状态显示
  // ═══════════════════════════════════════════

  it('应渲染突破状态区域', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByTestId('hero-detail-breakthrough')).toBeInTheDocument();
  });

  it('应显示"突破状态"标题', () => {
    render(<HeroDetailModal {...defaultProps} />);
    expect(screen.getByText('突破状态')).toBeInTheDocument();
  });

  it('未突破时应显示"未突破"', () => {
    const engine = makeMockEngine({ breakthroughStage: 0 });
    render(<HeroDetailModal {...defaultProps} engine={engine} />);
    expect(screen.getByTestId('breakthrough-stage').textContent).toBe('未突破');
  });

  it('已突破时应显示突破阶段', () => {
    const engine = makeMockEngine({ breakthroughStage: 2 });
    render(<HeroDetailModal {...defaultProps} engine={engine} />);
    expect(screen.getByTestId('breakthrough-stage').textContent).toBe('第2阶');
  });

  it('应显示等级上限', () => {
    const engine = makeMockEngine({ levelCap: 50 });
    render(<HeroDetailModal {...defaultProps} engine={engine} />);
    expect(screen.getByTestId('breakthrough-level-cap').textContent).toBe('Lv.50');
  });

  it('达到等级上限时应显示提示', () => {
    // 武将等级10，上限10
    const engine = makeMockEngine({ levelCap: 10 });
    render(<HeroDetailModal {...defaultProps} engine={engine} />);
    expect(screen.getByTestId('breakthrough-hint')).toBeInTheDocument();
    expect(screen.getByTestId('breakthrough-hint').textContent).toContain('已达等级上限');
  });

  it('未达到等级上限时不应显示提示', () => {
    // 武将等级10，上限50
    const engine = makeMockEngine({ levelCap: 50 });
    render(<HeroDetailModal {...defaultProps} engine={engine} />);
    expect(screen.queryByTestId('breakthrough-hint')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 12. 升级后属性展示
  // ═══════════════════════════════════════════

  describe('升级后属性展示', () => {
    it('level=1 时属性值等于 baseStats', () => {
      const lv1General: GeneralData = {
        ...baseGeneral,
        level: 1,
      };
      const engine = makeMockEngine({ general: lv1General });
      render(
        <HeroDetailModal
          general={lv1General}
          engine={engine}
          onClose={vi.fn()}
          onEnhanceComplete={vi.fn()}
        />,
      );

      // m = 1 + (1-1) * 0.03 = 1.0，属性等于 baseStats
      expect(screen.getAllByText('115').length).toBeGreaterThanOrEqual(1); // attack
      expect(screen.getAllByText('90').length).toBeGreaterThanOrEqual(1);  // defense
      expect(screen.getAllByText('65').length).toBeGreaterThanOrEqual(1);  // intelligence
      expect(screen.getAllByText('78').length).toBeGreaterThanOrEqual(1);  // speed
    });

    it('level=10 时属性值大于 baseStats（验证 statsAtLevel 被调用）', () => {
      // baseGeneral 默认 level=10，m=1.27
      render(<HeroDetailModal {...defaultProps} />);

      // 所有属性值应大于 baseStats 原始值
      expect(screen.getAllByText('146').length).toBeGreaterThanOrEqual(1); // attack > 115
      expect(screen.getAllByText('114').length).toBeGreaterThanOrEqual(1); // defense > 90
      expect(screen.getAllByText('82').length).toBeGreaterThanOrEqual(1);  // intelligence > 65
      expect(screen.getAllByText('99').length).toBeGreaterThanOrEqual(1);  // speed > 78
    });

    it('level=10 时具体属性值验证（attack 应为 Math.floor(115 × 1.27) = 146）', () => {
      render(<HeroDetailModal {...defaultProps} />);

      // 精确验证每个属性值 = Math.floor(base × 1.27)
      const expectedAttack = Math.floor(115 * 1.27);   // 146
      const expectedDefense = Math.floor(90 * 1.27);    // 114
      const expectedIntelligence = Math.floor(65 * 1.27); // 82
      const expectedSpeed = Math.floor(78 * 1.27);      // 99

      expect(screen.getAllByText(String(expectedAttack)).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(String(expectedDefense)).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(String(expectedIntelligence)).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(String(expectedSpeed)).length).toBeGreaterThanOrEqual(1);
    });

    it('升星后属性值应乘以星级倍率（LL-007 回归）', () => {
      // level=1, star=2 → starMultiplier=1.15
      // attack: floor(115 * 1.0 * 1.15) = floor(132.25) = 132
      // defense: floor(90 * 1.0 * 1.15) = floor(103.5) = 103
      // intelligence: floor(65 * 1.0 * 1.15) = floor(74.75) = 74
      // speed: floor(78 * 1.0 * 1.15) = floor(89.7) = 89
      const lv1General: GeneralData = { ...baseGeneral, level: 1 };
      const engine = makeMockEngine({ general: lv1General });
      // 覆盖 starSystem.getStar 返回 2 星
      const starSys = (engine as any).getHeroStarSystem();
      starSys.getStar = vi.fn(() => 2);

      render(
        <HeroDetailModal
          general={lv1General}
          engine={engine}
          onClose={vi.fn()}
          onEnhanceComplete={vi.fn()}
        />,
      );

      expect(screen.getAllByText('132').length).toBeGreaterThanOrEqual(1); // attack
      expect(screen.getAllByText('103').length).toBeGreaterThanOrEqual(1); // defense
      expect(screen.getAllByText('74').length).toBeGreaterThanOrEqual(1);  // intelligence
      expect(screen.getAllByText('89').length).toBeGreaterThanOrEqual(1);  // speed
    });

    it('高星级属性值验证（star=3, level=10）', () => {
      // level=10 → levelMultiplier=1.27, star=3 → starMultiplier=1.35
      // 注意：先 floor(levelStats)，再乘以 starMul 再 floor
      // levelStats: attack=146, defense=114, intelligence=82, speed=99
      // attack: floor(146 * 1.35) = floor(197.1) = 197
      // defense: floor(114 * 1.35) = floor(153.9) = 153
      // intelligence: floor(82 * 1.35) = floor(110.7) = 110
      // speed: floor(99 * 1.35) = floor(133.65) = 133
      const engine = makeMockEngine({ general: baseGeneral });
      const starSys = (engine as any).getHeroStarSystem();
      starSys.getStar = vi.fn(() => 3);

      render(
        <HeroDetailModal
          general={baseGeneral}
          engine={engine}
          onClose={vi.fn()}
          onEnhanceComplete={vi.fn()}
        />,
      );

      expect(screen.getAllByText('197').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('153').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('110').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('133').length).toBeGreaterThanOrEqual(1);
    });
  });
});
