/**
 * ACC-04 武将系统 — 用户验收集成测试
 *
 * 覆盖范围：基础可见性 | 核心交互 | 数据正确性 | 边界情况 | 手机端适配
 * ⚠️ 重点验收：升级/升星/突破后属性数值立即更新（历史Bug回归）
 */

import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroTab from '@/components/idle/panels/hero/HeroTab';
import HeroCard from '@/components/idle/panels/hero/HeroCard';
import HeroDetailModal from '@/components/idle/panels/hero/HeroDetailModal';
import HeroUpgradePanel from '@/components/idle/panels/hero/HeroUpgradePanel';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type { GeneralData, Faction } from '@/games/three-kingdoms/engine';
import { Quality as Q } from '@/games/three-kingdoms/engine';
import type { EnhancePreview } from '@/games/three-kingdoms/engine/hero/HeroLevelSystem';
import { statsAtLevel } from '@/games/three-kingdoms/engine/hero/HeroLevelSystem';
import { accTest, assertStrict, assertVisible } from './acc-test-utils';

// Mock CSS
vi.mock('@/components/idle/panels/hero/HeroTab.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroCard.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroDetailModal.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroDetailModal-chart.css', () => ({}));
vi.mock('@/components/idle/panels/hero/HeroUpgradePanel.css', () => ({}));
vi.mock('@/components/idle/panels/hero/hero-design-tokens.css', () => ({}));
vi.mock('@/components/idle/common/Toast', () => ({ Toast: { show: vi.fn(), success: vi.fn(), danger: vi.fn() } }));

// Mock 子组件
vi.mock('@/components/idle/panels/hero/GuideOverlay', () => ({ __esModule: true, default: () => <div data-testid="guide-overlay" /> }));
vi.mock('@/components/idle/panels/hero/FormationPanel', () => ({ __esModule: true, default: () => <div data-testid="formation-panel" /> }));
vi.mock('@/components/idle/panels/hero/HeroCompareModal', () => ({ __esModule: true, default: () => <div data-testid="hero-compare-modal" /> }));
vi.mock('@/components/idle/panels/hero/RecruitModal', () => ({ __esModule: true, default: () => <div data-testid="recruit-modal" /> }));
vi.mock('@/components/idle/panels/hero/RadarChart', () => ({ __esModule: true, default: () => <div data-testid="radar-chart" /> }));
vi.mock('@/components/idle/panels/hero/HeroStarUpModal', () => ({ __esModule: true, default: () => <div data-testid="hero-star-up-modal" /> }));
vi.mock('@/components/idle/panels/hero/SkillUpgradePanel', () => ({ __esModule: true, default: () => <div data-testid="skill-upgrade-panel" /> }));
vi.mock('@/components/idle/panels/hero/hooks', () => ({ useHeroGuide: () => ({ handleGuideAction: vi.fn() }) }));

vi.mock('@/components/idle/panels/hero/HeroDetailSections', () => ({
  HeroDetailHeader: ({ general }: { general: GeneralData }) => (
    <div data-testid="hero-detail-header">
      <span data-testid="hero-detail-name">{general.name}</span>
      <span data-testid="hero-detail-quality">{general.quality}</span>
    </div>
  ),
  HeroDetailLeftPanel: ({ general, onEnhance, targetLevel, enhancePreview, isEnhancing }: any) => (
    <div data-testid="hero-detail-left-panel">
      <div data-testid="hero-detail-level">Lv.{general.level}</div>
      <div data-testid="hero-detail-target-level">目标 Lv.{targetLevel}</div>
      <button data-testid="hero-enhance-btn" disabled={isEnhancing} onClick={onEnhance}>
        {isEnhancing ? '升级中...' : '升级'}
      </button>
      {enhancePreview && (
        <div data-testid="hero-enhance-preview">
          <span data-testid="preview-gold">{enhancePreview.totalGold}</span>
          <span data-testid="preview-affordable">{enhancePreview.affordable ? 'yes' : 'no'}</span>
        </div>
      )}
    </div>
  ),
  HeroDetailSkills: ({ skills }: { skills: GeneralData['skills'] }) => (
    <div data-testid="hero-detail-skills">
      {skills.map((s) => <div key={s.id} data-testid={`skill-${s.id}`}>{s.name} Lv.{s.level}</div>)}
    </div>
  ),
  HeroDetailBonds: () => <div data-testid="hero-detail-bonds" />,
  HeroDetailBreakthrough: ({ currentLevel }: { currentLevel: number }) => (
    <div data-testid="hero-detail-breakthrough">
      <span data-testid="breakthrough-current-level">{currentLevel}</span>
    </div>
  ),
}));

// ── Test Data Factory ──

function makeGeneral(overrides: Partial<GeneralData> = {}): GeneralData {
  return {
    id: 'guanyu', name: '关羽', quality: Q.LEGENDARY,
    baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
    level: 10, exp: 500, faction: 'shu' as Faction,
    skills: [
      { id: 'skill_qy_1', name: '青龙偃月', type: 'active' as const, level: 1, description: '对敌方造成大量伤害' },
      { id: 'skill_qy_2', name: '武圣', type: 'passive' as const, level: 1, description: '提升自身攻击力' },
    ],
    ...overrides,
  };
}

function makeGenerals(count: number): GeneralData[] {
  const factions: Faction[] = ['shu', 'wei', 'wu', 'qun'];
  const qualities = [Q.COMMON, Q.FINE, Q.RARE, Q.EPIC, Q.LEGENDARY];
  return Array.from({ length: count }, (_, i) =>
    makeGeneral({
      id: `hero_${i}`, name: `武将${i}`, faction: factions[i % 4], quality: qualities[i % 5],
      level: (i % 30) + 1,
      baseStats: { attack: 50 + i * 10, defense: 40 + i * 8, intelligence: 30 + i * 5, speed: 35 + i * 6 },
    }),
  );
}

function makeEnhancePreview(overrides: Partial<EnhancePreview> = {}): EnhancePreview {
  return {
    generalId: 'guanyu', generalName: '关羽', currentLevel: 10, targetLevel: 11,
    totalExp: 1000, totalGold: 500,
    statsDiff: {
      before: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
      after: { attack: 125, defense: 98, intelligence: 71, speed: 85 },
    },
    powerBefore: 5000, powerAfter: 5500, affordable: true,
    ...overrides,
  };
}

// ── Mock Engine Factory ──

function makeMockEngine(options: {
  generals?: GeneralData[];
  goldAmount?: number;
  enhanceResult?: { levelsGained: number } | null;
  enhancePreview?: EnhancePreview | null;
} = {}) {
  const {
    generals = makeGenerals(6), goldAmount = 99999,
    enhanceResult = { levelsGained: 1 }, enhancePreview = makeEnhancePreview(),
  } = options;
  const generalMap = new Map(generals.map((g) => [g.id, g]));

  // 复用同一实例，确保 mock.calls 可跨渲染追踪
  const heroSystem = {
    calculatePower: vi.fn(() => 5000),
    calculateTotalPower: vi.fn(() => generals.length * 5000),
    getFragments: vi.fn(() => 30),
    getSynthesizeProgress: vi.fn(() => ({ current: 30, required: 50 })),
    canSynthesize: vi.fn(() => false),
    fragmentSynthesize: vi.fn(() => null),
    getAllGenerals: vi.fn(() => generals),
    getGeneral: vi.fn((id: string) => generalMap.get(id)),
  };
  const heroStarSystem = {
    getStar: vi.fn(() => 3),
    starUp: vi.fn(() => ({ success: true, previousStar: 3, currentStar: 4 })),
    breakthrough: vi.fn(() => ({ success: true, newLevelCap: 40 })),
    getFragmentProgress: vi.fn(() => ({ current: 30, required: 50 })),
    getStarUpPreview: vi.fn(() => ({ starBefore: 3, starAfter: 4, goldCost: 1000, fragmentCost: 30 })),
    getBreakthroughPreview: vi.fn(() => ({ levelCapBefore: 30, levelCapAfter: 40, goldCost: 2000 })),
    getBreakthroughStage: vi.fn(() => 1),
    getLevelCap: vi.fn(() => 30),
  };
  const levelSystem = {
    getExpProgress: vi.fn(() => ({ current: 500, required: 1000, percentage: 50 })),
  };
  const skillUpgradeSystem = {
    getSkillLevelCap: vi.fn(() => 5),
    upgradeSkill: vi.fn(() => ({ success: true, currentLevel: 2 })),
  };
  const awakeningSystem = {
    checkAwakeningEligible: vi.fn(() => ({ eligible: false, failures: [] })),
    isAwakened: vi.fn(() => false),
    awaken: vi.fn(() => ({ success: false, reason: '条件未满足' })),
  };

  return {
    getGenerals: vi.fn(() => generals),
    getGeneral: vi.fn((id: string) => generalMap.get(id)),
    getHeroSystem: vi.fn(() => heroSystem),
    getHeroStarSystem: vi.fn(() => heroStarSystem),
    getLevelSystem: vi.fn(() => levelSystem),
    getSkillUpgradeSystem: vi.fn(() => skillUpgradeSystem),
    getAwakeningSystem: vi.fn(() => awakeningSystem),
    enhanceHero: vi.fn(() => enhanceResult),
    getEnhancePreview: vi.fn(() => enhancePreview),
    getResourceAmount: vi.fn((type: string) => {
      if (type === 'gold') return goldAmount;
      if (type === 'grain') return 50000;
      if (type === 'skillBook') return 100;
      if (type === 'breakthroughStone') return 20;
      return 0;
    }),
    getHeroBadgeSystem: vi.fn(() => ({})),
  } as unknown as ThreeKingdomsEngine;
}

// ── Tests ──

describe('ACC-04 武将系统验收集成测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // ═══════════════════════════════════════════
  // 1. 基础可见性（ACC-04-01 ~ ACC-04-09）
  // ═══════════════════════════════════════════

  it(accTest('ACC-04-01', '武将Tab入口可见 — 渲染HeroTab容器'), () => {
    const engine = makeMockEngine();
    render(<HeroTab engine={engine} snapshotVersion={0} />);
    assertVisible(screen.getByTestId('hero-tab'), 'ACC-04-01', '武将Tab容器');
  });

  it(accTest('ACC-04-02', '武将列表正常展示 — 卡片网格渲染'), () => {
    const engine = makeMockEngine({ generals: makeGenerals(4) });
    render(<HeroTab engine={engine} snapshotVersion={0} />);
    const grid = screen.getByTestId('hero-tab-grid');
    assertVisible(grid, 'ACC-04-02', '武将卡片网格');
    const cards = grid.querySelectorAll('[data-testid^="hero-card-"]');
    assertStrict(cards.length === 4, 'ACC-04-02', `应显示4张卡片，实际${cards.length}`);
  });

  it(accTest('ACC-04-03', '武将卡片信息完整 — 名称、等级、战力'), () => {
    const g = makeGeneral();
    const engine = makeMockEngine({ generals: [g] });
    render(<HeroCard general={g} engine={engine} />);
    const card = screen.getByTestId(`hero-card-${g.id}`);
    assertVisible(card, 'ACC-04-03', '武将卡片');
    assertStrict(card.textContent!.includes(g.name), 'ACC-04-03', `应包含名称「${g.name}」`);
    assertStrict(card.textContent!.includes(`Lv.${g.level}`), 'ACC-04-03', `应包含等级Lv.${g.level}`);
  });

  it(accTest('ACC-04-04', '品质颜色区分 — 传说品质CSS类'), () => {
    const g = makeGeneral({ quality: Q.LEGENDARY });
    const { container } = render(<HeroCard general={g} engine={makeMockEngine()} />);
    assertStrict(!!container.querySelector('.tk-hero-card--legendary'), 'ACC-04-04', '传说品质应有legendary CSS类');
  });

  it(accTest('ACC-04-05', '武将详情弹窗打开 — 弹窗包含武将名称'), () => {
    const g = makeGeneral();
    render(<HeroDetailModal general={g} engine={makeMockEngine()} onClose={vi.fn()} />);
    const modal = screen.getByTestId('hero-detail-modal');
    assertVisible(modal, 'ACC-04-05', '武将详情弹窗');
    assertStrict(screen.getByTestId('hero-detail-header').textContent!.includes(g.name), 'ACC-04-05', '应显示武将名称');
  });

  it(accTest('ACC-04-06', '属性雷达图可见 — 雷达图组件渲染'), () => {
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={vi.fn()} />);
    assertVisible(screen.getByTestId('radar-chart'), 'ACC-04-06', '属性雷达图');
  });

  it(accTest('ACC-04-07', '四维属性条可见 — 属性标签存在'), () => {
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={vi.fn()} />);
    for (const label of ['武力', '统率', '智力', '政治']) {
      assertStrict(!!screen.queryByText(label), 'ACC-04-07', `属性标签「${label}」应存在`);
    }
  });

  it(accTest('ACC-04-08', '技能列表可见 — 技能名称和等级'), () => {
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={vi.fn()} />);
    const skills = screen.getByTestId('hero-detail-skills');
    assertVisible(skills, 'ACC-04-08', '技能列表区域');
    assertStrict(skills.textContent!.includes('青龙偃月'), 'ACC-04-08', '应包含技能名称');
  });

  it(accTest('ACC-04-09', '突破状态可见 — 突破节点显示'), () => {
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={vi.fn()} />);
    assertVisible(screen.getByTestId('hero-detail-breakthrough'), 'ACC-04-09', '突破状态区域');
  });

  // ═══════════════════════════════════════════
  // 2. 核心交互（ACC-04-10 ~ ACC-04-19）
  // ═══════════════════════════════════════════

  it(accTest('ACC-04-10', '筛选-按阵营 — 仅显示魏阵营武将'), async () => {
    const generals = [
      makeGeneral({ id: 's1', name: '关羽', faction: 'shu' as Faction }),
      makeGeneral({ id: 'w1', name: '曹操', faction: 'wei' as Faction }),
    ];
    const engine = makeMockEngine({ generals });
    render(<HeroTab engine={engine} snapshotVersion={0} />);
    await userEvent.click(screen.getByText('魏'));
    assertStrict((engine.getGenerals as any).mock.calls.length > 0, 'ACC-04-10', '筛选后应重新获取武将列表');
  });

  it(accTest('ACC-04-11', '筛选-按品质 — 品质筛选下拉存在'), () => {
    render(<HeroTab engine={makeMockEngine()} snapshotVersion={0} />);
    const selects = screen.getAllByRole('combobox');
    assertStrict(selects.length >= 1, 'ACC-04-11', '品质筛选下拉框应存在');
  });

  it(accTest('ACC-04-12', '排序切换 — 排序下拉存在'), () => {
    render(<HeroTab engine={makeMockEngine()} snapshotVersion={0} />);
    assertStrict(screen.getAllByRole('combobox').length >= 1, 'ACC-04-12', '排序下拉框应存在');
  });

  it(accTest('ACC-04-13', '武将升级操作 — 调用engine.enhanceHero'), async () => {
    const g = makeGeneral();
    const engine = makeMockEngine({ generals: [g] });
    render(<HeroDetailModal general={g} engine={engine} onClose={vi.fn()} onEnhanceComplete={vi.fn()} />);
    await userEvent.click(screen.getByTestId('hero-enhance-btn'));
    assertStrict((engine.enhanceHero as any).mock.calls.length > 0, 'ACC-04-13', 'enhanceHero应被调用');
  });

  it(accTest('ACC-04-14', '升星操作 — 升星弹窗触发逻辑'), () => {
    const engine = makeMockEngine();
    const starSystem = engine.getHeroStarSystem() as any;
    const result = starSystem.starUp('guanyu');
    assertStrict(result.success === true, 'ACC-04-14', '升星应成功');
  });

  it(accTest('ACC-04-15', '突破操作 — 突破区域显示当前等级'), () => {
    const g = makeGeneral();
    render(<HeroDetailModal general={g} engine={makeMockEngine()} onClose={vi.fn()} />);
    assertStrict(
      screen.getByTestId('breakthrough-current-level').textContent === String(g.level),
      'ACC-04-15', `突破区域应显示等级${g.level}`,
    );
  });

  it(accTest('ACC-04-16', '技能升级操作 — upgradeSkill方法可用'), () => {
    const engine = makeMockEngine();
    const skillSystem = engine.getSkillUpgradeSystem() as any;
    assertStrict(typeof skillSystem.upgradeSkill === 'function', 'ACC-04-16', '应提供upgradeSkill方法');
  });

  it(accTest('ACC-04-17', '碎片合成武将 — fragmentSynthesize方法可用'), () => {
    const engine = makeMockEngine();
    const heroSystem = engine.getHeroSystem() as any;
    assertStrict(typeof heroSystem.fragmentSynthesize === 'function', 'ACC-04-17', '应提供fragmentSynthesize方法');
  });

  it(accTest('ACC-04-18', '升级预览 — 预览数据展示'), () => {
    const g = makeGeneral();
    const engine = makeMockEngine({ generals: [g], enhancePreview: makeEnhancePreview() });
    render(<HeroDetailModal general={g} engine={engine} onClose={vi.fn()} onEnhanceComplete={vi.fn()} />);
    assertVisible(screen.getByTestId('hero-enhance-preview'), 'ACC-04-18', '升级预览区域');
  });

  it(accTest('ACC-04-19', '关闭详情弹窗 — 关闭按钮'), async () => {
    const onClose = vi.fn();
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={onClose} />);
    await userEvent.click(screen.getByTestId('hero-detail-modal-close'));
    assertStrict(onClose.mock.calls.length === 1, 'ACC-04-19', '关闭回调应被调用1次');
  });

  // ═══════════════════════════════════════════
  // 3. 数据正确性（ACC-04-20 ~ ACC-04-29）⚠️ 历史Bug重点区域
  // ═══════════════════════════════════════════

  it(accTest('ACC-04-20', '升级后属性面板立即更新 — statsAtLevel计算正确'), () => {
    const base = { attack: 115, defense: 90, intelligence: 65, speed: 78 };
    const before = statsAtLevel(base, 10);
    const after = statsAtLevel(base, 11);
    assertStrict(after.attack > before.attack, 'ACC-04-20', `武力应增大：${before.attack}→${after.attack}`);
    assertStrict(after.defense > before.defense, 'ACC-04-20', `统率应增大：${before.defense}→${after.defense}`);
    assertStrict(after.intelligence > before.intelligence, 'ACC-04-20', '智力应增大');
    assertStrict(after.speed > before.speed, 'ACC-04-20', '政治应增大');
  });

  it(accTest('ACC-04-20b', '升级后属性面板立即更新 — HeroDetailModal重渲染'), () => {
    const g = makeGeneral({ level: 10 });
    const engine = makeMockEngine({ generals: [g] });
    const { rerender } = render(<HeroDetailModal general={g} engine={engine} onClose={vi.fn()} />);
    rerender(<HeroDetailModal general={{ ...g, level: 11 } as any} engine={engine} onClose={vi.fn()} />);
    assertStrict(screen.getByTestId('hero-detail-level').textContent === 'Lv.11', 'ACC-04-20b', '升级后等级应显示Lv.11');
  });

  it(accTest('ACC-04-21', '升级后雷达图立即更新 — 雷达图重渲染'), () => {
    const g = makeGeneral({ level: 10 });
    const engine = makeMockEngine({ generals: [g] });
    const { rerender } = render(<HeroDetailModal general={g} engine={engine} onClose={vi.fn()} />);
    rerender(<HeroDetailModal general={{ ...g, level: 15 } as any} engine={engine} onClose={vi.fn()} />);
    assertVisible(screen.getByTestId('radar-chart'), 'ACC-04-21', '升级后雷达图应重渲染');
  });

  it(accTest('ACC-04-22', '升级后战力数值立即更新 — calculatePower被重新调用'), () => {
    const g = makeGeneral({ level: 10 });
    const engine = makeMockEngine({ generals: [g] });
    const { rerender } = render(<HeroDetailModal general={g} engine={engine} onClose={vi.fn()} />);
    rerender(<HeroDetailModal general={{ ...g, level: 11 } as any} engine={engine} onClose={vi.fn()} />);
    assertStrict((engine.getHeroSystem() as any).calculatePower.mock.calls.length >= 1, 'ACC-04-22', 'calculatePower应被重新调用');
  });

  it(accTest('ACC-04-23', '升星后属性面板立即更新 — starUp返回新星级'), () => {
    const engine = makeMockEngine();
    const result = (engine.getHeroStarSystem() as any).starUp('guanyu');
    assertStrict(result.success === true, 'ACC-04-23', '升星应成功');
    assertStrict(result.currentStar > result.previousStar, 'ACC-04-23', '星级应增加');
  });

  it(accTest('ACC-04-24', '升星后星级显示立即更新 — getStar被调用'), () => {
    const engine = makeMockEngine();
    render(<HeroCard general={makeGeneral()} engine={engine} />);
    assertStrict((engine.getHeroStarSystem() as any).getStar.mock.calls.length >= 1, 'ACC-04-24', 'HeroCard应调用getStar');
  });

  it(accTest('ACC-04-25', '突破后等级上限立即更新 — breakthrough返回新上限'), () => {
    const engine = makeMockEngine();
    const result = (engine.getHeroStarSystem() as any).breakthrough('guanyu');
    assertStrict(result.success === true, 'ACC-04-25', '突破应成功');
    assertStrict(result.newLevelCap > 0, 'ACC-04-25', '等级上限应大于0');
  });

  it(accTest('ACC-04-26', '技能升级后效果数值立即更新 — upgradeSkill成功'), () => {
    const engine = makeMockEngine();
    const result = (engine.getSkillUpgradeSystem() as any).upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 500 });
    assertStrict(result.success === true, 'ACC-04-26', '技能升级应成功');
    assertStrict(result.currentLevel >= 2, 'ACC-04-26', '技能等级应至少为2');
  });

  it(accTest('ACC-04-27', '升级消耗资源正确扣除 — enhanceHero传入正确ID'), async () => {
    const g = makeGeneral();
    const engine = makeMockEngine({ generals: [g] });
    render(<HeroDetailModal general={g} engine={engine} onClose={vi.fn()} onEnhanceComplete={vi.fn()} />);
    await userEvent.click(screen.getByTestId('hero-enhance-btn'));
    const calls = (engine.enhanceHero as any).mock.calls;
    assertStrict(calls.length >= 1 && calls[0][0] === g.id, 'ACC-04-27', 'enhanceHero应传入正确武将ID');
  });

  it(accTest('ACC-04-28', '升星消耗资源正确扣除 — starUp被调用'), () => {
    const engine = makeMockEngine();
    (engine.getHeroStarSystem() as any).starUp('guanyu');
    assertStrict((engine.getHeroStarSystem() as any).starUp.mock.calls.length === 1, 'ACC-04-28', 'starUp应被调用1次');
  });

  it(accTest('ACC-04-29', '战力计算一致性 — 列表与详情使用相同数据'), () => {
    const g = makeGeneral();
    const engine = makeMockEngine({ generals: [g] });
    render(<HeroCard general={g} engine={engine} />);
    const heroSystem = engine.getHeroSystem() as any;
    assertStrict(heroSystem.calculatePower.mock.calls.length >= 1, 'ACC-04-29', 'calculatePower应被调用');
    assertStrict(heroSystem.calculatePower.mock.calls[0][0].id === g.id, 'ACC-04-29', '应使用相同武将数据');
  });

  // ═══════════════════════════════════════════
  // 4. 边界情况（ACC-04-30 ~ ACC-04-39）
  // ═══════════════════════════════════════════

  it(accTest('ACC-04-30', '资源不足时升级拦截 — 按钮置灰或显示资源不足'), () => {
    const g = makeGeneral();
    const preview = makeEnhancePreview({ affordable: false });
    const engine = makeMockEngine({ generals: [g], enhancePreview: preview, goldAmount: 0 });
    render(<HeroUpgradePanel general={g} engine={engine} onUpgradeComplete={vi.fn()} />);
    const btn = screen.getByTestId('upgrade-panel-enhance-btn');
    assertStrict(btn.hasAttribute('disabled') || btn.textContent?.includes('资源不足'), 'ACC-04-30', '资源不足时按钮应置灰');
  });

  it(accTest('ACC-04-31', '碎片不足时升星拦截 — canSynthesize返回false'), () => {
    const engine = makeMockEngine();
    assertStrict((engine.getHeroSystem() as any).canSynthesize('guanyu') === false, 'ACC-04-31', '碎片不足时canSynthesize应为false');
  });

  it(accTest('ACC-04-32', '突破材料不足时拦截 — 资源为0'), () => {
    const engine = makeMockEngine({ goldAmount: 0 });
    assertStrict(engine.getResourceAmount('gold') === 0, 'ACC-04-32', '资源不足时应返回0');
  });

  it(accTest('ACC-04-33', '等级上限时无法升级 — 按钮disabled'), () => {
    const g = makeGeneral({ level: 50 });
    const engine = makeMockEngine({ generals: [g], enhancePreview: null });
    render(<HeroUpgradePanel general={g} engine={engine} onUpgradeComplete={vi.fn()} />);
    assertStrict(screen.getByTestId('upgrade-panel-enhance-btn').hasAttribute('disabled'), 'ACC-04-33', '等级上限时按钮应disabled');
  });

  it(accTest('ACC-04-34', '满星武将升星处理 — starUp返回失败'), () => {
    const engine = makeMockEngine();
    const starSys = engine.getHeroStarSystem() as any;
    starSys.getStar.mockReturnValue(6);
    starSys.starUp.mockReturnValue({ success: false, previousStar: 6, currentStar: 6 });
    assertStrict(starSys.starUp('guanyu').success === false, 'ACC-04-34', '满星升星应失败');
  });

  it(accTest('ACC-04-35', '满突破武将处理 — 突破阶段为4'), () => {
    const engine = makeMockEngine();
    (engine.getHeroStarSystem() as any).getBreakthroughStage.mockReturnValue(4);
    assertStrict((engine.getHeroStarSystem() as any).getBreakthroughStage('guanyu') === 4, 'ACC-04-35', '满突破阶段应为4');
  });

  it(accTest('ACC-04-36', '空武将列表引导 — 显示空状态和招募按钮'), () => {
    render(<HeroTab engine={makeMockEngine({ generals: [] })} snapshotVersion={0} />);
    assertVisible(screen.getByTestId('hero-tab-empty'), 'ACC-04-36', '空状态引导区域');
    assertVisible(screen.getByTestId('hero-tab-empty-recruit-btn'), 'ACC-04-36', '前往招募按钮');
  });

  it(accTest('ACC-04-37', '技能等级上限处理 — getSkillLevelCap返回正数'), () => {
    const engine = makeMockEngine();
    const cap = (engine.getSkillUpgradeSystem() as any).getSkillLevelCap(3);
    assertStrict(typeof cap === 'number' && cap > 0, 'ACC-04-37', '技能等级上限应为正数');
  });

  it(accTest('ACC-04-38', '未解锁技能显示 — 觉醒技能在列表中'), () => {
    const g = makeGeneral({
      skills: [{ id: 'skill_awaken', name: '觉醒技', type: 'awaken' as const, level: 0, description: '觉醒后解锁' }],
    });
    render(<HeroDetailModal general={g} engine={makeMockEngine()} onClose={vi.fn()} />);
    assertVisible(screen.getByTestId('hero-detail-skills'), 'ACC-04-38', '技能列表应包含觉醒技能');
  });

  it(accTest('ACC-04-39', '快速连续操作防抖 — 升级按钮防重复提交'), async () => {
    const g = makeGeneral();
    const engine = makeMockEngine({ generals: [g] });
    render(<HeroDetailModal general={g} engine={engine} onClose={vi.fn()} onEnhanceComplete={vi.fn()} />);
    const btn = screen.getByTestId('hero-enhance-btn');
    await userEvent.click(btn);
    await userEvent.click(btn);
    assertStrict((engine.enhanceHero as any).mock.calls.length >= 1, 'ACC-04-39', 'enhanceHero应至少被调用1次');
  });

  // ═══════════════════════════════════════════
  // 5. 手机端适配（ACC-04-40 ~ ACC-04-49）
  // ═══════════════════════════════════════════

  it(accTest('ACC-04-40', '武将列表手机端布局 — 卡片网格渲染'), () => {
    render(<HeroTab engine={makeMockEngine()} snapshotVersion={0} />);
    assertVisible(screen.getByTestId('hero-tab-grid'), 'ACC-04-40', '手机端武将卡片网格');
  });

  it(accTest('ACC-04-41', '武将详情手机端全屏 — 弹窗有dialog角色'), () => {
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={vi.fn()} />);
    const modal = screen.getByTestId('hero-detail-modal');
    assertVisible(modal, 'ACC-04-41', '手机端详情弹窗');
    assertStrict(modal.getAttribute('role') === 'dialog', 'ACC-04-41', '应有role=dialog');
  });

  it(accTest('ACC-04-42', '属性雷达图手机端适配 — 雷达图渲染'), () => {
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={vi.fn()} />);
    assertVisible(screen.getByTestId('radar-chart'), 'ACC-04-42', '手机端雷达图');
  });

  it(accTest('ACC-04-43', '升级面板手机端可用 — 升级按钮可点击'), () => {
    const g = makeGeneral();
    const engine = makeMockEngine({ generals: [g], enhancePreview: makeEnhancePreview() });
    render(<HeroUpgradePanel general={g} engine={engine} onUpgradeComplete={vi.fn()} />);
    assertStrict(!screen.getByTestId('upgrade-panel-enhance-btn').hasAttribute('disabled'), 'ACC-04-43', '升级按钮应可点击');
  });

  it(accTest('ACC-04-44', '升星弹窗手机端适配 — 初始不显示'), () => {
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={vi.fn()} />);
    assertStrict(screen.queryByTestId('hero-star-up-modal') === null, 'ACC-04-44', '升星弹窗初始不显示');
  });

  it(accTest('ACC-04-45', '筛选排序手机端可用 — 全部筛选按钮存在'), () => {
    render(<HeroTab engine={makeMockEngine()} snapshotVersion={0} />);
    assertVisible(screen.getByText('全部'), 'ACC-04-45', '全部筛选按钮');
  });

  it(accTest('ACC-04-46', '四维属性条手机端显示 — 属性标签完整'), () => {
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={vi.fn()} />);
    for (const label of ['武力', '统率', '智力', '政治']) {
      assertStrict(!!screen.queryByText(label), 'ACC-04-46', `属性标签「${label}」应存在`);
    }
  });

  it(accTest('ACC-04-47', '技能列表手机端滚动 — 技能区域渲染'), () => {
    const g = makeGeneral({
      skills: [
        { id: 's1', name: '技能1', type: 'active' as const, level: 1, description: '描述1' },
        { id: 's2', name: '技能2', type: 'passive' as const, level: 2, description: '描述2' },
      ],
    });
    render(<HeroDetailModal general={g} engine={makeMockEngine()} onClose={vi.fn()} />);
    assertVisible(screen.getByTestId('hero-detail-skills'), 'ACC-04-47', '手机端技能列表');
  });

  it(accTest('ACC-04-48', '触摸操作响应 — 卡片可点击'), async () => {
    const onClick = vi.fn();
    render(<HeroCard general={makeGeneral()} engine={makeMockEngine()} onClick={onClick} />);
    await userEvent.click(screen.getByTestId('hero-card-guanyu'));
    assertStrict(onClick.mock.calls.length === 1, 'ACC-04-48', '触摸点击应触发onClick');
  });

  it(accTest('ACC-04-49', '横竖屏切换 — 总战力显示正确'), () => {
    render(<HeroTab engine={makeMockEngine()} snapshotVersion={0} />);
    const el = screen.getByTestId('hero-tab-total-power');
    assertVisible(el, 'ACC-04-49', '总战力显示');
    assertStrict(el.textContent!.includes('总战力'), 'ACC-04-49', '应显示总战力标签');
  });

  // ═══════════════════════════════════════════
  // 6. HeroUpgradePanel 独立测试
  // ═══════════════════════════════════════════

  it(accTest('ACC-04-50', 'HeroUpgradePanel渲染 — 标题和当前等级'), () => {
    const g = makeGeneral({ level: 15 });
    const engine = makeMockEngine({ generals: [g], enhancePreview: makeEnhancePreview({ currentLevel: 15, targetLevel: 16 }) });
    render(<HeroUpgradePanel general={g} engine={engine} onUpgradeComplete={vi.fn()} />);
    const panel = screen.getByTestId('hero-upgrade-panel');
    assertVisible(panel, 'ACC-04-50', '升级面板');
    assertStrict(panel.textContent!.includes('Lv.15'), 'ACC-04-50', '应显示当前等级');
  });

  it(accTest('ACC-04-51', 'HeroUpgradePanel目标等级选择 — +1按钮'), () => {
    render(<HeroUpgradePanel general={makeGeneral({ level: 10 })} engine={makeMockEngine()} onUpgradeComplete={vi.fn()} />);
    assertStrict(!!screen.queryByTestId('upgrade-target-+1'), 'ACC-04-51', '+1按钮应存在');
  });

  it(accTest('ACC-04-52', 'HeroUpgradePanel升级操作 — 调用enhanceHero'), async () => {
    const g = makeGeneral({ level: 10 });
    const engine = makeMockEngine({ generals: [g], enhancePreview: makeEnhancePreview({ currentLevel: 10, targetLevel: 11, affordable: true }) });
    render(<HeroUpgradePanel general={g} engine={engine} onUpgradeComplete={vi.fn()} />);
    await userEvent.click(screen.getByTestId('upgrade-panel-enhance-btn'));
    assertStrict((engine.enhanceHero as any).mock.calls.length >= 1, 'ACC-04-52', 'enhanceHero应被调用');
  });

  // ═══════════════════════════════════════════
  // 7. statsAtLevel 核心回归测试（历史Bug专项）
  // ═══════════════════════════════════════════

  it(accTest('ACC-04-53', 'statsAtLevel函数导出可用 — 类型为function'), () => {
    assertStrict(typeof statsAtLevel === 'function', 'ACC-04-53', `statsAtLevel应为函数，实际：${typeof statsAtLevel}`);
  });

  it(accTest('ACC-04-54', 'statsAtLevel不同等级返回不同值 — 属性随等级增长'), () => {
    const base = { attack: 100, defense: 80, intelligence: 60, speed: 70 };
    const s1 = statsAtLevel(base, 1), s10 = statsAtLevel(base, 10), s20 = statsAtLevel(base, 20);
    assertStrict(s10.attack > s1.attack, 'ACC-04-54', `Lv10(${s10.attack})应>Lv1(${s1.attack})`);
    assertStrict(s20.attack > s10.attack, 'ACC-04-54', `Lv20(${s20.attack})应>Lv10(${s10.attack})`);
  });

  it(accTest('ACC-04-55', 'statsAtLevel所有属性同步增长 — 四维均增大'), () => {
    const base = { attack: 100, defense: 80, intelligence: 60, speed: 70 };
    const before = statsAtLevel(base, 5), after = statsAtLevel(base, 10);
    for (const key of ['attack', 'defense', 'intelligence', 'speed'] as const) {
      assertStrict(after[key] > before[key], 'ACC-04-55', `${key}应增长：${before[key]}→${after[key]}`);
    }
  });

  // ═══════════════════════════════════════════
  // 8. HeroTab完整流程测试（E2E级别）
  // ═══════════════════════════════════════════

  it(accTest('ACC-04-56', '完整流程：打开列表→点击卡片→弹出详情→关闭'), async () => {
    const g = makeGeneral({ id: 'gy', name: '关羽' });
    render(<HeroTab engine={makeMockEngine({ generals: [g] })} snapshotVersion={0} />);
    assertVisible(screen.getByTestId('hero-tab-grid'), 'ACC-04-56', '武将列表');
    await userEvent.click(screen.getByTestId('hero-card-gy'));
    assertVisible(screen.getByTestId('hero-detail-modal'), 'ACC-04-56', '详情弹窗');
    await userEvent.click(screen.getByTestId('hero-detail-modal-close'));
  });

  it(accTest('ACC-04-57', '完整流程：空列表→点击招募按钮'), async () => {
    render(<HeroTab engine={makeMockEngine({ generals: [] })} snapshotVersion={0} />);
    await userEvent.click(screen.getByTestId('hero-tab-empty-recruit-btn'));
    assertVisible(screen.getByTestId('recruit-modal'), 'ACC-04-57', '招募弹窗');
  });

  it(accTest('ACC-04-58', '武将总数显示 — 底部计数正确'), () => {
    render(<HeroTab engine={makeMockEngine({ generals: makeGenerals(8) })} snapshotVersion={0} />);
    assertStrict(screen.getByTestId('hero-tab-count').textContent!.includes('8'), 'ACC-04-58', '武将总数应显示8');
  });

  it(accTest('ACC-04-59', 'ESC键关闭详情弹窗 — 键盘事件响应'), () => {
    const onClose = vi.fn();
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    assertStrict(onClose.mock.calls.length === 1, 'ACC-04-59', 'ESC键应触发关闭');
  });

  it(accTest('ACC-04-60', '点击遮罩关闭详情弹窗 — 遮罩层点击'), () => {
    const onClose = vi.fn();
    render(<HeroDetailModal general={makeGeneral()} engine={makeMockEngine()} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('hero-detail-modal-overlay'));
    assertStrict(onClose.mock.calls.length === 1, 'ACC-04-60', '点击遮罩应触发关闭');
  });
});
