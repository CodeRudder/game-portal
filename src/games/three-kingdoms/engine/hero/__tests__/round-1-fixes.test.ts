/**
 * Round 1 修复验证测试
 *
 * 验证 Arbiter 裁决中的 P0 缺陷修复：
 * - FIX-001: NaN 绕过 <= 0 检查（系统性修复）
 * - FIX-002: useFragments 负值漏洞
 * - FIX-003: deserialize(null) 系统性缺失
 * - FIX-004: FormationRecommendSystem null guard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroSystem } from '../HeroSystem';
import { HeroLevelSystem } from '../HeroLevelSystem';
import { HeroStarSystem } from '../HeroStarSystem';
import { HeroRecruitSystem } from '../HeroRecruitSystem';
import { HeroFormation } from '../HeroFormation';
import { HeroDispatchSystem } from '../HeroDispatchSystem';
import { AwakeningSystem } from '../AwakeningSystem';
import { FormationRecommendSystem } from '../FormationRecommendSystem';
import { RecruitTokenEconomySystem } from '../recruit-token-economy-system';
import { deserializeHeroState } from '../HeroSerializer';
import type { GeneralData } from '../hero.types';
import type { ISystemDeps } from '../../../../core/types';

// ═══════════════════════════════════════════════════════
// FIX-001: NaN 绕过 <= 0 检查
// ═══════════════════════════════════════════════════════

describe('FIX-001: NaN 绕过 <= 0 检查', () => {
  describe('HeroSystem.addFragment', () => {
    let hs: HeroSystem;
    beforeEach(() => { hs = new HeroSystem(); hs.addGeneral('guanyu'); });

    it('NaN 参数被正确拒绝（不增加碎片）', () => {
      const result = hs.addFragment('guanyu', NaN);
      expect(result).toBe(0);
      expect(hs.getFragments('guanyu')).toBe(0);
    });

    it('Infinity 参数被正确拒绝', () => {
      const result = hs.addFragment('guanyu', Infinity);
      expect(result).toBe(0);
      expect(hs.getFragments('guanyu')).toBe(0);
    });

    it('-Infinity 参数被正确拒绝', () => {
      const result = hs.addFragment('guanyu', -Infinity);
      expect(result).toBe(0);
      expect(hs.getFragments('guanyu')).toBe(0);
    });
  });

  describe('HeroLevelSystem.addExp', () => {
    let hs: HeroSystem;
    let ls: HeroLevelSystem;
    beforeEach(() => {
      hs = new HeroSystem();
      hs.addGeneral('guanyu');
      ls = new HeroLevelSystem();
      ls.init({
        heroSystem: hs,
        getStar: () => 1,
        getBreakthroughStage: () => 0,
      } as any);
    });

    it('NaN 经验被拒绝（返回 null）', () => {
      const result = ls.addExp('guanyu', NaN);
      expect(result).toBeNull();
    });

    it('Infinity 经验被拒绝（返回 null）', () => {
      const result = ls.addExp('guanyu', Infinity);
      expect(result).toBeNull();
    });
  });

  describe('HeroStarSystem.exchangeFragmentsFromShop', () => {
    let hs: HeroSystem;
    let ss: HeroStarSystem;
    beforeEach(() => {
      hs = new HeroSystem();
      hs.addGeneral('guanyu');
      ss = new HeroStarSystem();
      ss.init({
        heroSystem: hs,
        canAffordResource: () => true,
        spendResource: () => true,
        getStar: () => 1,
        getBreakthroughStage: () => 0,
        setLevelCap: () => {},
      } as any);
    });

    it('NaN 数量被拒绝', () => {
      const result = ss.exchangeFragmentsFromShop('guanyu', NaN);
      expect(result.success).toBe(false);
      expect(result.count).toBe(0);
    });
  });

  describe('HeroStarSystem.addFragmentFromActivity', () => {
    let hs: HeroSystem;
    let ss: HeroStarSystem;
    beforeEach(() => {
      hs = new HeroSystem();
      hs.addGeneral('guanyu');
      ss = new HeroStarSystem();
      ss.init({
        heroSystem: hs,
        canAffordResource: () => true,
        spendResource: () => true,
        getStar: () => 1,
        getBreakthroughStage: () => 0,
        setLevelCap: () => {},
      } as any);
    });

    it('NaN 数量被拒绝', () => {
      const result = ss.addFragmentFromActivity('guanyu', 'test', NaN);
      expect(result.count).toBe(0);
    });

    it('Infinity 数量被拒绝', () => {
      const result = ss.addFragmentFromActivity('guanyu', 'test', Infinity);
      expect(result.count).toBe(0);
    });
  });

  describe('HeroStarSystem.addFragmentFromExpedition', () => {
    let hs: HeroSystem;
    let ss: HeroStarSystem;
    beforeEach(() => {
      hs = new HeroSystem();
      hs.addGeneral('guanyu');
      ss = new HeroStarSystem();
      ss.init({
        heroSystem: hs,
        canAffordResource: () => true,
        spendResource: () => true,
        getStar: () => 1,
        getBreakthroughStage: () => 0,
        setLevelCap: () => {},
      } as any);
    });

    it('NaN 数量被拒绝', () => {
      const result = ss.addFragmentFromExpedition('guanyu', NaN);
      expect(result.count).toBe(0);
    });
  });

  describe('RecruitTokenEconomySystem', () => {
    let economy: RecruitTokenEconomySystem;
    let addedTokens: number[];

    beforeEach(() => {
      addedTokens = [];
      economy = new RecruitTokenEconomySystem();
      economy.init({
        addRecruitToken: (n: number) => { addedTokens.push(n); return n; },
        getRecruitTokenBalance: () => 10000,
        spendRecruitToken: () => true,
      } as any);
    });

    it('tick(NaN) 不产出招贤令', () => {
      economy.tick(NaN);
      expect(addedTokens.length).toBe(0);
    });

    it('tick(Infinity) 不产出招贤令', () => {
      economy.tick(Infinity);
      expect(addedTokens.length).toBe(0);
    });

    it('buyFromShop(NaN) 被拒绝', () => {
      const result = economy.buyFromShop(NaN);
      expect(result).toBe(false);
    });

    it('calculateOfflineReward(NaN) 返回 0', () => {
      const result = economy.calculateOfflineReward(NaN);
      expect(result).toBe(0);
    });

    it('calculateOfflineReward(Infinity) 返回 0', () => {
      const result = economy.calculateOfflineReward(Infinity);
      expect(result).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════
// FIX-002: useFragments 负值漏洞
// ═══════════════════════════════════════════════════════

describe('FIX-002: useFragments 负值漏洞', () => {
  let hs: HeroSystem;
  beforeEach(() => {
    hs = new HeroSystem();
    hs.addGeneral('guanyu');
    hs.addFragment('guanyu', 10);
  });

  it('负值被拒绝（不增加碎片）', () => {
    expect(hs.getFragments('guanyu')).toBe(10);
    const result = hs.useFragments('guanyu', -100);
    expect(result).toBe(false);
    expect(hs.getFragments('guanyu')).toBe(10);
  });

  it('NaN 被拒绝', () => {
    const result = hs.useFragments('guanyu', NaN);
    expect(result).toBe(false);
    expect(hs.getFragments('guanyu')).toBe(10);
  });

  it('Infinity 被拒绝', () => {
    const result = hs.useFragments('guanyu', Infinity);
    expect(result).toBe(false);
    expect(hs.getFragments('guanyu')).toBe(10);
  });

  it('0 被拒绝', () => {
    const result = hs.useFragments('guanyu', 0);
    expect(result).toBe(false);
    expect(hs.getFragments('guanyu')).toBe(10);
  });

  it('正常消耗仍然有效', () => {
    const result = hs.useFragments('guanyu', 5);
    expect(result).toBe(true);
    expect(hs.getFragments('guanyu')).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════
// FIX-003: deserialize(null) 系统性缺失
// ═══════════════════════════════════════════════════════

describe('FIX-003: deserialize(null) 系统性防护', () => {
  it('HeroSystem.deserialize(null) 不崩溃', () => {
    const hs = new HeroSystem();
    hs.addGeneral('guanyu');
    expect(() => hs.deserialize(null as any)).not.toThrow();
    expect(hs.getAllGenerals()).toHaveLength(0);
  });

  it('HeroSystem.deserialize(undefined) 不崩溃', () => {
    const hs = new HeroSystem();
    expect(() => hs.deserialize(undefined as any)).not.toThrow();
  });

  it('deserializeHeroState(null) 返回空状态', () => {
    const state = deserializeHeroState(null as any);
    expect(state).toBeDefined();
    expect(state.generals).toBeDefined();
    expect(state.fragments).toBeDefined();
  });

  it('deserializeHeroState(undefined) 返回空状态', () => {
    const state = deserializeHeroState(undefined as any);
    expect(state).toBeDefined();
  });

  it('HeroRecruitSystem.deserialize(null) 不崩溃', () => {
    const recruit = new HeroRecruitSystem();
    expect(() => recruit.deserialize(null as any)).not.toThrow();
  });

  it('HeroStarSystem.deserialize(null) 不崩溃', () => {
    const ss = new HeroStarSystem();
    ss.init({
      heroSystem: new HeroSystem(),
      canAffordResource: () => true,
      spendResource: () => true,
      getStar: () => 1,
      getBreakthroughStage: () => 0,
      setLevelCap: () => {},
    } as any);
    expect(() => ss.deserialize(null as any)).not.toThrow();
  });

  it('HeroStarSystem.deserialize(undefined) 不崩溃', () => {
    const ss = new HeroStarSystem();
    ss.init({
      heroSystem: new HeroSystem(),
      canAffordResource: () => true,
      spendResource: () => true,
      getStar: () => 1,
      getBreakthroughStage: () => 0,
      setLevelCap: () => {},
    } as any);
    expect(() => ss.deserialize(undefined as any)).not.toThrow();
  });

  it('AwakeningSystem.deserialize(null) 不崩溃', () => {
    const asys = new AwakeningSystem();
    asys.init({
      heroSystem: new HeroSystem(),
      getStar: () => 1,
      getBreakthroughStage: () => 0,
      getLevel: () => 1,
      canAffordResource: () => true,
      spendResource: () => true,
      spendFragments: () => true,
    } as any);
    expect(() => asys.deserialize(null as any)).not.toThrow();
  });

  it('RecruitTokenEconomySystem.deserialize(null) 不崩溃', () => {
    const economy = new RecruitTokenEconomySystem();
    expect(() => economy.deserialize(null as any)).not.toThrow();
  });

  it('HeroFormation.deserialize(null) 不崩溃', () => {
    const formation = new HeroFormation();
    expect(() => formation.deserialize(null as any)).not.toThrow();
  });

  it('HeroDispatchSystem.deserialize(null) 不崩溃', () => {
    const dispatch = new HeroDispatchSystem();
    expect(() => dispatch.deserialize(null as any)).not.toThrow();
  });

  it('HeroDispatchSystem.deserialize("") 不崩溃', () => {
    const dispatch = new HeroDispatchSystem();
    expect(() => dispatch.deserialize('')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════
// FIX-004: FormationRecommendSystem null guard
// ═══════════════════════════════════════════════════════

describe('FIX-004: FormationRecommendSystem null guard', () => {
  let system: FormationRecommendSystem;

  beforeEach(() => {
    system = new FormationRecommendSystem();
    system.init({} as ISystemDeps);
  });

  it('availableHeroes 为 null 不崩溃', () => {
    expect(() => system.recommend('normal', null as any, () => 100)).not.toThrow();
    const result = system.recommend('normal', null as any, () => 100);
    expect(result.plans).toHaveLength(0);
  });

  it('availableHeroes 为 undefined 不崩溃', () => {
    expect(() => system.recommend('normal', undefined as any, () => 100)).not.toThrow();
  });

  it('availableHeroes 包含 null 元素时被过滤', () => {
    const heroes = [
      null,
      { id: 'guanyu', name: '关羽', quality: 'LEGENDARY', baseStats: { attack: 100, defense: 80, intelligence: 70, speed: 90 }, level: 1, exp: 0, faction: 'shu', skills: [] },
      undefined,
      { id: 'zhangfei', name: '张飞', quality: 'EPIC', baseStats: { attack: 95, defense: 70, intelligence: 50, speed: 80 }, level: 1, exp: 0, faction: 'shu', skills: [] },
    ] as any[];

    expect(() => system.recommend('normal', heroes, () => 100)).not.toThrow();
    const result = system.recommend('normal', heroes, () => 100);
    expect(result.plans.length).toBeGreaterThan(0);
    // 确保方案中的武将 ID 不含 null
    for (const plan of result.plans) {
      for (const id of plan.heroIds) {
        expect(id).toBeTruthy();
      }
    }
  });

  it('calculatePower 返回 NaN 时被替换为 0', () => {
    const heroes: GeneralData[] = [
      { id: 'guanyu', name: '关羽', quality: 'LEGENDARY', baseStats: { attack: 100, defense: 80, intelligence: 70, speed: 90 }, level: 1, exp: 0, faction: 'shu', skills: [] },
    ];

    expect(() => system.recommend('normal', heroes, () => NaN)).not.toThrow();
    const result = system.recommend('normal', heroes, () => NaN);
    expect(result.plans.length).toBeGreaterThan(0);
    // NaN power 应被替换为 0
    expect(result.plans[0].estimatedPower).toBe(0);
  });

  it('calculatePower 返回 Infinity 时被替换为 0', () => {
    const heroes: GeneralData[] = [
      { id: 'guanyu', name: '关羽', quality: 'LEGENDARY', baseStats: { attack: 100, defense: 80, intelligence: 70, speed: 90 }, level: 1, exp: 0, faction: 'shu', skills: [] },
    ];

    const result = system.recommend('normal', heroes, () => Infinity);
    expect(result.plans[0].estimatedPower).toBe(0);
  });

  it('空数组返回空方案', () => {
    const result = system.recommend('normal', [], () => 100);
    expect(result.plans).toHaveLength(0);
  });
});
