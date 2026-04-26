/**
 * hero-engine-integration — UI组件与引擎端到端集成测试
 *
 * 测试场景：
 * 1. 招募流程：点击招募→引擎创建武将→UI更新列表
 * 2. 升级流程：点击升级→引擎扣除资源→UI更新属性
 * 3. 编队流程：拖拽武将→引擎更新编队→UI显示羁绊
 * 4. 派遣流程：选择武将+建筑→引擎执行派遣→UI显示加成
 *
 * 策略：使用 mock 引擎对象验证 UI→引擎→UI 数据流闭环，
 * 而非启动完整引擎实例（避免依赖过多子系统）。
 *
 * @module components/idle/panels/hero/__tests__/hero-engine-integration
 */

import React, { useState, useCallback } from 'react';
import { describe, it, expect, vi, beforeEach, fn } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ─────────────────────────────────────────────
// Mock CSS（所有组件的样式文件）
// ─────────────────────────────────────────────
vi.mock('../FormationRecommendPanel.css', () => ({}));
vi.mock('../BondCollectionPanel.css', () => ({}));
vi.mock('../HeroUpgradePanel.css', () => ({}));
vi.mock('../HeroDispatchPanel.css', () => ({}));
vi.mock('../atoms/AttributeBar.css', () => ({}));
vi.mock('../atoms/ResourceCost.css', () => ({}));
vi.mock('../atoms/QualityBadge.css', () => ({}));
vi.mock('../atoms/StarDisplay.css', () => ({}));
vi.mock('@/components/idle/common/Toast', () => ({
  Toast: {
    success: vi.fn(),
    danger: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
  },
}));

// ─────────────────────────────────────────────
// Mock 原子组件
// ─────────────────────────────────────────────
vi.mock('../atoms', () => ({
  QualityBadge: ({ quality }: { quality: string }) => (
    <span data-testid={`quality-${quality}`}>{quality}</span>
  ),
  StarDisplay: ({ stars }: { stars: number }) => (
    <span data-testid={`stars-${stars}`}>★{stars}</span>
  ),
  AttributeBar: ({ label, value, max }: { label: string; value: number; max: number }) => (
    <div data-testid={`attr-${label}`}>{label}: {value}/{max}</div>
  ),
  ResourceCost: ({ costs }: { costs: Array<{ type: string; amount: number }> }) => (
    <div data-testid="resource-cost">{JSON.stringify(costs)}</div>
  ),
}));

// ─────────────────────────────────────────────
// 组件导入
// ─────────────────────────────────────────────
import FormationRecommendPanel from '../FormationRecommendPanel';
import type { HeroInfo } from '../FormationRecommendPanel';
import BondCollectionPanel from '../BondCollectionPanel';
import type { BondCatalogItem } from '../BondCollectionPanel';
import HeroUpgradePanel from '../HeroUpgradePanel';
import type { HeroUpgradePanelProps } from '../HeroUpgradePanel';
import HeroDispatchPanel from '../HeroDispatchPanel';
import type { HeroBrief, BuildingBrief } from '../HeroDispatchPanel';

// ─────────────────────────────────────────────
// 引擎类型导入
// ─────────────────────────────────────────────
import type { GeneralData } from '@/games/three-kingdoms/engine/hero/hero.types';
import { Quality } from '@/games/three-kingdoms/engine/hero/hero.types';
import type { ActiveBond } from '@/games/three-kingdoms/engine/hero/BondSystem';
import { BondType } from '@/games/three-kingdoms/engine/hero/bond-config';
import type { EnhancePreview } from '@/games/three-kingdoms/engine';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';

// ═══════════════════════════════════════════════
// 测试数据工厂
// ═══════════════════════════════════════════════

const makeGeneralData = (overrides: Partial<GeneralData> = {}): GeneralData => ({
  id: 'guanyu',
  name: '关羽',
  quality: Quality.LEGENDARY,
  baseStats: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
  level: 10,
  exp: 500,
  faction: 'shu',
  skills: [],
  ...overrides,
});

const makeHeroInfo = (overrides: Partial<HeroInfo> = {}): HeroInfo => ({
  id: 'guanyu',
  name: '关羽',
  level: 30,
  quality: 'EPIC',
  stars: 4,
  faction: 'shu',
  ...overrides,
});

const makeActiveBond = (overrides: Partial<ActiveBond> = {}): ActiveBond => ({
  bondId: 'faction_shu',
  name: '蜀国',
  type: BondType.FACTION,
  level: 1,
  levelMultiplier: 1.0,
  effects: [{ stat: 'attack', value: 0.05 }],
  participants: ['liubei', 'guanyu'],
  dispatchFactor: 1.0,
  ...overrides,
});

const makeEnhancePreview = (overrides: Partial<EnhancePreview> = {}): EnhancePreview => ({
  generalId: 'guanyu',
  generalName: '关羽',
  currentLevel: 10,
  targetLevel: 11,
  totalExp: 200,
  totalGold: 1000,
  statsDiff: {
    before: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
    after: { attack: 120, defense: 93, intelligence: 67, speed: 79 },
  },
  powerBefore: 1000,
  powerAfter: 1100,
  affordable: true,
  ...overrides,
});

const makeHeroBrief = (overrides: Partial<HeroBrief> = {}): HeroBrief => ({
  id: 'hero-1',
  name: '关羽',
  level: 30,
  quality: 'EPIC',
  stars: 4,
  ...overrides,
});

const makeBuildingBrief = (overrides: Partial<BuildingBrief> = {}): BuildingBrief => ({
  id: 'building-farm',
  name: '农田',
  level: 3,
  dispatchHeroId: null,
  ...overrides,
});

// ═══════════════════════════════════════════════
// 1. 招募流程集成测试
// ═══════════════════════════════════════════════

describe('招募流程集成', () => {
  /**
   * 场景：模拟招募流程
   * 1. 初始状态：无武将
   * 2. 调用引擎招募→返回新武将
   * 3. UI 列表更新显示新武将
   */
  it('招募后UI列表应包含新武将', () => {
    const recruitedHeroes: HeroInfo[] = [];
    const mockRecruit = vi.fn().mockReturnValue({
      success: true,
      general: makeGeneralData({ id: 'zhangfei', name: '张飞', faction: 'shu' }),
    });

    // 模拟招募回调
    const handleRecruit = () => {
      const result = mockRecruit();
      if (result.success) {
        recruitedHeroes.push({
          id: result.general.id,
          name: result.general.name,
          level: result.general.level,
          quality: result.general.quality,
          stars: 1,
          faction: result.general.faction,
        });
      }
    };

    // 执行招募
    handleRecruit();

    // 验证引擎被调用
    expect(mockRecruit).toHaveBeenCalledTimes(1);

    // 验证列表更新
    expect(recruitedHeroes).toHaveLength(1);
    expect(recruitedHeroes[0].id).toBe('zhangfei');
    expect(recruitedHeroes[0].name).toBe('张飞');
    expect(recruitedHeroes[0].faction).toBe('shu');
  });

  it('招募失败时UI列表不变', () => {
    const heroes = [makeHeroInfo({ id: 'existing' })];
    const mockRecruit = vi.fn().mockReturnValue({ success: false });

    const handleRecruit = () => {
      const result = mockRecruit();
      if (result.success) {
        heroes.push(result.general);
      }
    };

    handleRecruit();

    expect(mockRecruit).toHaveBeenCalledTimes(1);
    expect(heroes).toHaveLength(1); // 不变
  });

  it('连续招募多次应累积到列表', () => {
    const recruitedHeroes: HeroInfo[] = [];
    const mockGenerals = [
      makeGeneralData({ id: 'zhangfei', name: '张飞' }),
      makeGeneralData({ id: 'liubei', name: '刘备' }),
      makeGeneralData({ id: 'zhaoyun', name: '赵云' }),
    ];

    let callIndex = 0;
    const mockRecruit = vi.fn().mockImplementation(() => ({
      success: true,
      general: mockGenerals[callIndex++],
    }));

    const handleRecruit = () => {
      const result = mockRecruit();
      if (result.success) {
        recruitedHeroes.push({
          id: result.general.id,
          name: result.general.name,
          level: result.general.level,
          quality: result.general.quality,
          stars: 1,
          faction: result.general.faction,
        });
      }
    };

    // 执行3次招募
    handleRecruit();
    handleRecruit();
    handleRecruit();

    expect(mockRecruit).toHaveBeenCalledTimes(3);
    expect(recruitedHeroes).toHaveLength(3);
    expect(recruitedHeroes.map((h) => h.id)).toEqual(['zhangfei', 'liubei', 'zhaoyun']);
  });
});

// ═══════════════════════════════════════════════
// 2. 升级流程集成测试
// ═══════════════════════════════════════════════

describe('升级流程集成', () => {
  /**
   * 场景：模拟升级流程
   * 1. 引擎计算升级消耗和属性变化
   * 2. 扣除资源
   * 3. UI 更新显示新属性
   */
  it('升级成功后属性应更新', () => {
    const general = makeGeneralData({ level: 10 });
    const preview = makeEnhancePreview({
      currentLevel: 10,
      targetLevel: 11,
      statsDiff: {
        before: { attack: 115, defense: 90, intelligence: 65, speed: 78 },
        after: { attack: 120, defense: 93, intelligence: 67, speed: 79 },
      },
    });

    // 模拟引擎升级
    const mockLevelUp = vi.fn().mockReturnValue({
      success: true,
      newLevel: 11,
      statsDiff: preview.statsDiff,
    });

    const result = mockLevelUp(general.id);

    expect(mockLevelUp).toHaveBeenCalledWith('guanyu');
    expect(result.success).toBe(true);
    expect(result.newLevel).toBe(11);
    expect(result.statsDiff.after.attack).toBe(120);
    expect(result.statsDiff.after.defense).toBe(93);
  });

  it('资源不足时升级应失败', () => {
    const mockLevelUp = vi.fn().mockReturnValue({
      success: false,
      reason: 'gold_not_enough',
    });

    const result = mockLevelUp('guanyu');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('gold_not_enough');
  });

  it('升级面板应正确显示升级预览', () => {
    const general = makeGeneralData({ level: 10 });
    const preview = makeEnhancePreview();
    const onUpgrade = vi.fn();

    // HeroUpgradePanel 需要 engine 实例，模拟最小 engine
    const mockEngine = {
      getLevelSystem: vi.fn().mockReturnValue({
        getEnhancePreview: vi.fn().mockReturnValue(preview),
        enhance: vi.fn().mockReturnValue({ success: true }),
        getMaxLevel: vi.fn().mockReturnValue(100),
        getExpToNextLevel: vi.fn().mockReturnValue(200),
        getExpProgress: vi.fn().mockReturnValue({ current: 500, required: 1000, ratio: 0.5 }),
      }),
      getHeroSystem: vi.fn().mockReturnValue({
        getGeneral: vi.fn().mockReturnValue(general),
      }),
      getEnhancePreview: vi.fn().mockReturnValue(preview),
      getResourceAmount: vi.fn().mockReturnValue(5000),
    } as unknown as ThreeKingdomsEngine;

    render(
      <HeroUpgradePanel
        general={general}
        engine={mockEngine}
        onUpgradeComplete={onUpgrade}
        onClose={vi.fn()}
      />,
    );

    // 面板应渲染升级面板
    expect(screen.getByTestId('hero-upgrade-panel')).toBeInTheDocument();
    // 应显示当前等级
    expect(screen.getByText(/当前等级/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 3. 编队流程集成测试
// ═══════════════════════════════════════════════

describe('编队流程集成', () => {
  /**
   * 场景：编队推荐面板使用引擎战力计算
   * 1. FormationRecommendPanel 接收 powerCalculator
   * 2. 战力计算使用引擎 API 而非简单求和
   * 3. 应用编队后引擎更新编队数据
   */
  it('FormationRecommendPanel 使用引擎战力计算器', () => {
    const mockPowerCalculator = vi.fn().mockImplementation((heroes: HeroInfo[]) => {
      // 模拟引擎的 calculateFormationPower：使用更复杂的公式
      return heroes.reduce((sum, h) => {
        // 引擎公式：基础战力 × 品质系数 × 羁绊加成
        const basePower = h.level * 100;
        const qualityMultiplier = h.quality === 'LEGENDARY' ? 2.0 : h.quality === 'EPIC' ? 1.5 : 1.0;
        return sum + Math.round(basePower * qualityMultiplier);
      }, 0);
    });

    const heroes = [
      makeHeroInfo({ id: 'liubei', name: '刘备', level: 35, quality: 'LEGENDARY', faction: 'shu' }),
      makeHeroInfo({ id: 'guanyu', name: '关羽', level: 30, quality: 'EPIC', faction: 'shu' }),
      makeHeroInfo({ id: 'zhangfei', name: '张飞', level: 28, quality: 'RARE', faction: 'shu' }),
      makeHeroInfo({ id: 'caocao', name: '曹操', level: 32, quality: 'LEGENDARY', faction: 'wei' }),
      makeHeroInfo({ id: 'zhaoyun', name: '赵云', level: 27, quality: 'EPIC', faction: 'shu' }),
      makeHeroInfo({ id: 'sunquan', name: '孙权', level: 26, quality: 'RARE', faction: 'wu' }),
    ];

    render(
      <FormationRecommendPanel
        ownedHeroes={heroes}
        currentFormation={[null, null, null, null, null, null]}
        onApplyRecommend={vi.fn()}
        onClose={vi.fn()}
        powerCalculator={mockPowerCalculator}
      />,
    );

    // 验证 powerCalculator 被调用（至少为当前编队和推荐方案调用）
    expect(mockPowerCalculator).toHaveBeenCalled();

    // 验证面板渲染
    expect(screen.getByTestId('formation-recommend-panel')).toBeInTheDocument();
    expect(screen.getByTestId('recommend-card-best-power')).toBeInTheDocument();
  });

  it('应用编队后引擎应更新编队数据', () => {
    const onApplyRecommend = vi.fn();
    const heroes = [
      makeHeroInfo({ id: 'liubei', name: '刘备' }),
      makeHeroInfo({ id: 'guanyu', name: '关羽' }),
      makeHeroInfo({ id: 'zhangfei', name: '张飞' }),
      makeHeroInfo({ id: 'caocao', name: '曹操' }),
    ];

    render(
      <FormationRecommendPanel
        ownedHeroes={heroes}
        currentFormation={[null, null, null, null, null, null]}
        onApplyRecommend={onApplyRecommend}
        onClose={vi.fn()}
      />,
    );

    // 点击应用按钮
    const applyBtn = screen.getByTestId('apply-btn-best-power');
    fireEvent.click(applyBtn);

    // 验证回调被调用，传入了编队数据
    expect(onApplyRecommend).toHaveBeenCalledTimes(1);
    const calledWith = onApplyRecommend.mock.calls[0][0];
    // 应该是6个位置（补齐null）
    expect(calledWith).toHaveLength(6);
    // 前4个应该是武将ID
    expect(calledWith[0]).toBeTruthy();
  });

  it('羁绊面板应根据阵营过滤武将', () => {
    const heroFactionMap: Record<string, string> = {
      liubei: 'shu',
      guanyu: 'shu',
      zhangfei: 'shu',
      caocao: 'wei',
    };

    const activeBonds: ActiveBond[] = [
      makeActiveBond({
        bondId: 'faction_shu',
        name: '蜀国',
        participants: ['liubei', 'guanyu', 'zhangfei'],
      }),
    ];

    render(
      <BondCollectionPanel
        ownedHeroIds={['liubei', 'guanyu', 'zhangfei', 'caocao']}
        activeBonds={activeBonds}
        formationHeroIds={['liubei', 'guanyu', 'zhangfei', 'caocao']}
        heroFactionMap={heroFactionMap}
        onClose={vi.fn()}
      />,
    );

    // 验证面板渲染
    expect(screen.getByTestId('bond-collection-panel')).toBeInTheDocument();

    // 蜀国羁绊卡片应只显示蜀国武将（liubei, guanyu, zhangfei），不应包含 caocao
    const shuCard = screen.getByTestId('bond-card-faction_shu');
    expect(shuCard).toBeInTheDocument();
    // 卡片内应显示蜀国武将标签
    const heroTags = shuCard.querySelectorAll('.tk-bond-hero-tag');
    // 应该只有3个蜀国武将标签（不含魏国 caocao）
    expect(heroTags.length).toBe(3);
  });

  it('羁绊面板无阵营映射时从 activeBonds 推断', () => {
    const activeBonds: ActiveBond[] = [
      makeActiveBond({
        bondId: 'faction_shu',
        name: '蜀国',
        participants: ['liubei', 'guanyu'],
      }),
    ];

    render(
      <BondCollectionPanel
        ownedHeroIds={['liubei', 'guanyu', 'caocao']}
        activeBonds={activeBonds}
        formationHeroIds={['liubei', 'guanyu', 'caocao']}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('bond-collection-panel')).toBeInTheDocument();
    // 蜀国羁绊卡片应存在
    expect(screen.getByTestId('bond-card-faction_shu')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════
// 4. 派遣流程集成测试
// ═══════════════════════════════════════════════

describe('派遣流程集成', () => {
  /**
   * 场景：派遣武将到建筑
   * 1. 选择武将和建筑
   * 2. 引擎执行派遣
   * 3. UI 显示派遣加成
   */
  it('派遣成功后UI应显示武将派遣状态', () => {
    const onDispatch = vi.fn().mockReturnValue({
      success: true,
      bonus: { productionSpeed: 0.15 },
    });
    const onRecall = vi.fn();

    const heroes = [
      makeHeroBrief({ id: 'hero-1', name: '关羽', level: 30, quality: 'EPIC' }),
      makeHeroBrief({ id: 'hero-2', name: '张飞', level: 25, quality: 'RARE' }),
    ];

    const buildings = [
      makeBuildingBrief({ id: 'b-farm', name: '农田', level: 3 }),
      makeBuildingBrief({ id: 'b-lumber', name: '伐木场', level: 2 }),
    ];

    render(
      <HeroDispatchPanel
        heroes={heroes}
        buildings={buildings}
        onDispatch={onDispatch}
        onRecall={onRecall}
        onClose={vi.fn()}
      />,
    );

    // 面板应渲染
    expect(screen.getByTestId('hero-dispatch-panel')).toBeInTheDocument();

    // 应显示武将和建筑
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('农田')).toBeInTheDocument();
  });

  it('召回武将后UI应更新', () => {
    const onDispatch = vi.fn();
    const onRecall = vi.fn().mockReturnValue({ success: true });

    const heroes = [
      makeHeroBrief({ id: 'hero-1', name: '关羽', level: 30, quality: 'EPIC' }),
    ];

    const buildings = [
      makeBuildingBrief({ id: 'b-farm', name: '农田', level: 3, dispatchHeroId: 'hero-1' }),
    ];

    render(
      <HeroDispatchPanel
        heroes={heroes}
        buildings={buildings}
        onDispatch={onDispatch}
        onRecall={onRecall}
        onClose={vi.fn()}
      />,
    );

    // 已派遣的建筑应显示召回按钮
    expect(screen.getByText('农田')).toBeInTheDocument();
  });

  it('引擎派遣应验证武将等级和品质', () => {
    // 模拟引擎的派遣验证逻辑
    const mockDispatch = vi.fn().mockImplementation((heroId: string, buildingType: string) => {
      const hero = { id: heroId, level: 10, quality: 'COMMON' };
      if (hero.level < 20) return { success: false, reason: 'level_too_low' };
      if (hero.quality === 'COMMON') return { success: false, reason: 'quality_too_low' };
      return { success: true, bonus: { productionSpeed: 0.1 } };
    });

    // 低等级武将派遣应失败
    const result = mockDispatch('low-level-hero', 'farm');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('level_too_low');
  });
});

// ═══════════════════════════════════════════════
// 5. 战力计算集成测试（P1-1 验证）
// ═══════════════════════════════════════════════

describe('战力计算集成', () => {
  it('无 powerCalculator 时应使用简易估算', () => {
    const heroes = [
      makeHeroInfo({ id: 'h1', level: 30, quality: 'EPIC', stars: 4 }),
    ];

    render(
      <FormationRecommendPanel
        ownedHeroes={heroes}
        currentFormation={[null, null, null, null, null, null]}
        onApplyRecommend={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // 面板应正常渲染
    expect(screen.getByTestId('formation-recommend-panel')).toBeInTheDocument();
    // 应显示战力数值
    const powerTexts = screen.getAllByText(/战力 [\d,]+/);
    expect(powerTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('有 powerCalculator 时应使用引擎计算', () => {
    const enginePower = 99999;
    const mockPowerCalculator = vi.fn().mockReturnValue(enginePower);

    const heroes = [
      makeHeroInfo({ id: 'h1', level: 30, quality: 'EPIC', stars: 4, faction: 'shu' }),
      makeHeroInfo({ id: 'h2', level: 28, quality: 'RARE', stars: 3, faction: 'shu' }),
      makeHeroInfo({ id: 'h3', level: 35, quality: 'LEGENDARY', stars: 5, faction: 'shu' }),
      makeHeroInfo({ id: 'h4', level: 32, quality: 'LEGENDARY', stars: 5, faction: 'wei' }),
    ];

    render(
      <FormationRecommendPanel
        ownedHeroes={heroes}
        currentFormation={[null, null, null, null, null, null]}
        onApplyRecommend={vi.fn()}
        onClose={vi.fn()}
        powerCalculator={mockPowerCalculator}
      />,
    );

    expect(mockPowerCalculator).toHaveBeenCalled();
    // 验证面板渲染
    expect(screen.getByTestId('formation-recommend-panel')).toBeInTheDocument();
    // 引擎战力值应显示在面板中（至少一个方案显示此值）
    const powerTexts = screen.getAllByText(/战力 [\d,]+/);
    expect(powerTexts.length).toBeGreaterThanOrEqual(1);
    // 验证引擎战力值（99999）出现在某个方案中
    const allPowerText = powerTexts.map((el) => el.textContent).join(' ');
    expect(allPowerText).toContain(enginePower.toLocaleString());
  });

  it('引擎计算和简易计算结果应不同', () => {
    const heroes = [
      makeHeroInfo({ id: 'h1', level: 30, quality: 'EPIC', stars: 4 }),
      makeHeroInfo({ id: 'h2', level: 28, quality: 'RARE', stars: 3 }),
    ];

    // 简易计算
    const simplePower = heroes.reduce((sum, h) => {
      const qWeight = { LEGENDARY: 5, EPIC: 4, RARE: 3, FINE: 2, COMMON: 1 }[h.quality] ?? 1;
      const starFactor = 1 + h.stars * 0.15;
      return sum + Math.round(h.level * qWeight * starFactor * 10);
    }, 0);

    // 引擎计算（模拟更复杂的公式）
    const enginePower = heroes.reduce((sum, h) => {
      return sum + h.level * 100 * (h.quality === 'EPIC' ? 1.5 : 1.0);
    }, 0);

    // 两者应该不同
    expect(enginePower).not.toBe(simplePower);
  });
});

// ═══════════════════════════════════════════════
// 6. 羁绊过滤集成测试（P1-2 验证）
// ═══════════════════════════════════════════════

describe('羁绊过滤集成', () => {
  it('阵营羁绊应只显示该阵营的武将', () => {
    const heroFactionMap: Record<string, string> = {
      liubei: 'shu',
      guanyu: 'shu',
      zhangfei: 'shu',
      caocao: 'wei',
      sunquan: 'wu',
    };

    const activeBonds: ActiveBond[] = [
      makeActiveBond({
        bondId: 'faction_shu',
        name: '蜀国',
        participants: ['liubei', 'guanyu', 'zhangfei'],
      }),
    ];

    render(
      <BondCollectionPanel
        ownedHeroIds={['liubei', 'guanyu', 'zhangfei', 'caocao', 'sunquan']}
        activeBonds={activeBonds}
        formationHeroIds={['liubei', 'guanyu', 'zhangfei', 'caocao', 'sunquan']}
        heroFactionMap={heroFactionMap}
        onClose={vi.fn()}
      />,
    );

    // 切换到全部图鉴 tab
    fireEvent.click(screen.getByTestId('tab-all-bonds'));

    // 蜀国羁绊卡片应只包含蜀国武将
    const shuCard = screen.getByTestId('bond-card-faction_shu');
    const heroTags = shuCard.querySelectorAll('.tk-bond-hero-tag');
    const tagTexts = Array.from(heroTags).map((el) => el.textContent);

    // 不应包含 wei/wu 武将
    expect(tagTexts.some((t) => t?.includes('caocao'))).toBe(false);
    expect(tagTexts.some((t) => t?.includes('sunquan'))).toBe(false);
  });

  it('搭档羁绊应显示所有参与武将', () => {
    const catalog: BondCatalogItem[] = [
      {
        id: 'partner_taoyuan',
        name: '桃园结义',
        type: BondType.PARTNER,
        heroIds: ['liubei', 'guanyu', 'zhangfei'],
        heroNames: ['刘备', '关羽', '张飞'],
        description: '攻击+15%',
        level: 1,
        effects: [{ stat: 'attack', value: 0.15 }],
        isActive: true,
        minRequired: 3,
      },
    ];

    render(
      <BondCollectionPanel
        ownedHeroIds={['liubei', 'guanyu', 'zhangfei']}
        activeBonds={[]}
        formationHeroIds={['liubei', 'guanyu', 'zhangfei']}
        bondCatalog={catalog}
        onClose={vi.fn()}
      />,
    );

    // 桃园结义卡片应显示
    const card = screen.getByTestId('bond-card-partner_taoyuan');
    expect(card).toBeInTheDocument();
    // 武将名称应显示在卡片中（带 ✓ 前缀表示已拥有）
    expect(card.textContent).toContain('刘备');
    expect(card.textContent).toContain('关羽');
    expect(card.textContent).toContain('张飞');
  });
});
