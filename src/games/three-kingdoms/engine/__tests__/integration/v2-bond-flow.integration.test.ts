/**
 * V2 羁绊流程集成测试
 *
 * 基于 v2-play.md 测试羁绊和编队完整流程：
 * - FORM-FLOW-1: 编队管理
 * - FORM-FLOW-2: 多编队切换
 * - FORM-FLOW-3: 一键布阵
 * - FORM-FLOW-4: 羁绊效果验证
 * - FORM-FLOW-5: 智能编队推荐 [引擎未实现]
 * - CROSS-FLOW-4: 编队保存→刷新→数据恢复
 * - CROSS-FLOW-5: 武将→建筑派驻联动 [引擎未实现]
 * - CROSS-FLOW-7: 武将升级→资源消耗→建筑产出联动 [引擎未实现]
 * - CROSS-FLOW-8: 技能升级→战力→编队联动 [引擎未实现]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import { FACTIONS } from '../../hero/hero.types';
import { BOND_EFFECTS } from '../../bond/bond-config';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';

describe('V2 BOND-FLOW: 羁绊与编队流程集成测试', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = createSim();
  });

  // ─────────────────────────────────────────
  // FORM-FLOW-1: 编队管理
  // ─────────────────────────────────────────
  describe('FORM-FLOW-1: 编队管理', () => {
    it('should create formation', () => {
      const formation = sim.engine.createFormation('1');
      expect(formation).not.toBeNull();
      expect(formation!.id).toBe('1');
      expect(formation!.slots.length).toBe(6);
    });

    it('should add general to formation', () => {
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('1');
      const result = sim.engine.addToFormation('1', 'liubei');
      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '').length).toBe(1);
    });

    it('should not add duplicate general to same formation', () => {
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('1');
      sim.engine.addToFormation('1', 'liubei');
      const result = sim.engine.addToFormation('1', 'liubei');
      expect(result).toBeNull();
    });

    it('should remove general from formation', () => {
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('1');
      sim.engine.addToFormation('1', 'liubei');
      const result = sim.engine.removeFromFormation('1', 'liubei');
      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '').length).toBe(0);
    });

    it('should set formation with multiple generals', () => {
      const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }
      sim.engine.createFormation('1');
      const result = sim.engine.setFormation('1', heroIds);
      expect(result).not.toBeNull();
      expect(result!.slots.filter(s => s !== '').length).toBe(6);
    });

    it('should limit formation to 6 slots', () => {
      const heroIds = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'caocao', 'dianwei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }
      sim.engine.createFormation('1');
      const result = sim.engine.setFormation('1', heroIds);
      expect(result!.slots.filter(s => s !== '').length).toBe(6);
    });

    it('should calculate formation power', () => {
      const heroIds = ['liubei', 'guanyu', 'zhangfei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }
      sim.engine.createFormation('1');
      sim.engine.setFormation('1', heroIds);

      const formation = sim.engine.getFormationSystem().getFormation('1')!;
      const hero = sim.engine.hero;
      const power = sim.engine.getFormationSystem().calculateFormationPower(
        formation,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
      );
      expect(power).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────
  // FORM-FLOW-2: 多编队切换
  // ─────────────────────────────────────────
  describe('FORM-FLOW-2: 多编队切换', () => {
    it('should create multiple formations', () => {
      const f1 = sim.engine.createFormation('1');
      const f2 = sim.engine.createFormation('2');
      expect(f1).not.toBeNull();
      expect(f2).not.toBeNull();
    });

    it('should set active formation', () => {
      sim.engine.createFormation('1');
      sim.engine.createFormation('2');
      sim.engine.getFormationSystem().setActiveFormation('2');
      expect(sim.engine.getFormationSystem().getActiveFormationId()).toBe('2');
    });

    it('should preserve data when switching formations', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');

      sim.engine.createFormation('1');
      sim.engine.setFormation('1', ['liubei']);

      sim.engine.createFormation('2');
      sim.engine.setFormation('2', ['guanyu']);

      const f1 = sim.engine.getFormationSystem().getFormation('1')!;
      const f2 = sim.engine.getFormationSystem().getFormation('2')!;
      expect(f1.slots[0]).toBe('liubei');
      expect(f2.slots[0]).toBe('guanyu');
    });

    it('should prevent same general in multiple formations', () => {
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('1');
      sim.engine.createFormation('2');
      sim.engine.addToFormation('1', 'liubei');
      // 尝试把同个武将加入编队2
      const result = sim.engine.addToFormation('2', 'liubei');
      expect(result).toBeNull();
    });

    it('should allow general in formation 2 after removing from formation 1', () => {
      sim.addHeroDirectly('liubei');
      sim.engine.createFormation('1');
      sim.engine.createFormation('2');
      sim.engine.addToFormation('1', 'liubei');
      sim.engine.removeFromFormation('1', 'liubei');
      // 现在应该可以加入编队2
      const result = sim.engine.addToFormation('2', 'liubei');
      expect(result).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────
  // FORM-FLOW-3: 一键布阵
  // ─────────────────────────────────────────
  describe('FORM-FLOW-3: 一键布阵', () => {
    it('should auto-fill formation with top power generals', () => {
      const heroIds = ['guanyu', 'liubei', 'zhangfei', 'zhugeliang', 'zhaoyun', 'dianwei', 'caocao'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }

      const hero = sim.engine.hero;
      const formation = sim.engine.getFormationSystem().autoFormationByIds(
        heroIds,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
        '1',
        6,
      );
      expect(formation).not.toBeNull();
      expect(formation!.slots.filter(s => s !== '').length).toBe(6);
    });

    it('should prioritize higher power generals', () => {
      const heroIds = ['guanyu', 'liubei', 'minbingduizhang'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }

      const hero = sim.engine.hero;
      const formation = sim.engine.getFormationSystem().autoFormationByIds(
        heroIds,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
        '1',
        2,
      );
      expect(formation).not.toBeNull();
      // 关羽(LEGENDARY)和刘备(EPIC)应被选中，民兵队长(COMMON)不应被选中
      expect(formation!.slots).toContain('guanyu');
    });
  });

  // ─────────────────────────────────────────
  // FORM-FLOW-4: 羁绊效果验证
  // ─────────────────────────────────────────
  describe('FORM-FLOW-4: 羁绊效果验证', () => {
    it('should detect faction_2 bond (2 same faction)', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('zhangfei');
      const bondSystem = sim.engine.getBondSystem();
      const heroes = [sim.engine.hero.getGeneral('liubei')!, sim.engine.hero.getGeneral('zhangfei')!];
      const bonds = bondSystem.detectActiveBonds(heroes);
      const faction2 = bonds.find(b => b.type === 'faction_2');
      expect(faction2).toBeDefined();
    });

    it('should detect faction_3 bond (3 same faction)', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      const bondSystem = sim.engine.getBondSystem();
      const heroes = [
        sim.engine.hero.getGeneral('liubei')!,
        sim.engine.hero.getGeneral('guanyu')!,
        sim.engine.hero.getGeneral('zhangfei')!,
      ];
      const bonds = bondSystem.detectActiveBonds(heroes);
      const faction3 = bonds.find(b => b.type === 'faction_3');
      expect(faction3).toBeDefined();
    });

    it('should detect mixed_3_3 bond (3+3 different factions)', () => {
      // 蜀3: liubei, guanyu, zhangfei
      // 魏3: caocao, simayi, junshou
      const shuIds = ['liubei', 'guanyu', 'zhangfei'];
      const weiIds = ['caocao', 'simayi', 'junshou'];
      for (const id of [...shuIds, ...weiIds]) {
        sim.addHeroDirectly(id);
      }
      const bondSystem = sim.engine.getBondSystem();
      const heroes = [...shuIds, ...weiIds].map(id => sim.engine.hero.getGeneral(id)!);
      const bonds = bondSystem.detectActiveBonds(heroes);
      const mixed = bonds.find(b => b.type === 'mixed_3_3');
      expect(mixed).toBeDefined();
    });

    it('should calculate bond bonuses correctly', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('zhangfei');
      const bondSystem = sim.engine.getBondSystem();
      const heroes = [sim.engine.hero.getGeneral('liubei')!, sim.engine.hero.getGeneral('zhangfei')!];
      const bonds = bondSystem.detectActiveBonds(heroes);
      const bonuses = bondSystem.calculateTotalBondBonuses(bonds);
      // faction_2: attack +5%
      expect(bonuses.attack).toBeCloseTo(0.05, 2);
    });

    it('should verify bond effect configs', () => {
      // faction_2: 同乡之谊, attack +5%
      expect(BOND_EFFECTS.faction_2.bonuses.attack).toBeCloseTo(0.05, 2);
      // faction_3: 同仇敌忾, attack +15%
      expect(BOND_EFFECTS.faction_3.bonuses.attack).toBeCloseTo(0.15, 2);
      // faction_6: 众志成城, attack +25%, defense +15%
      expect(BOND_EFFECTS.faction_6.bonuses.attack).toBeCloseTo(0.25, 2);
      expect(BOND_EFFECTS.faction_6.bonuses.defense).toBeCloseTo(0.15, 2);
      // mixed_3_3: 混搭协作, attack +10%
      expect(BOND_EFFECTS.mixed_3_3.bonuses.attack).toBeCloseTo(0.10, 2);
    });

    it('should generate formation bond preview', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      const bondSystem = sim.engine.getBondSystem();
      const heroes = [
        sim.engine.hero.getGeneral('liubei')!,
        sim.engine.hero.getGeneral('guanyu')!,
        sim.engine.hero.getGeneral('zhangfei')!,
      ];
      const preview = bondSystem.getFormationPreview('1', heroes);
      expect(preview.activeBonds.length).toBeGreaterThanOrEqual(1);
      expect(preview.factionDistribution.shu).toBe(3);
    });

    it('should downgrade bond when removing general', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      const bondSystem = sim.engine.getBondSystem();

      // 3蜀 → faction_3
      const heroes3 = [
        sim.engine.hero.getGeneral('liubei')!,
        sim.engine.hero.getGeneral('guanyu')!,
        sim.engine.hero.getGeneral('zhangfei')!,
      ];
      const bonds3 = bondSystem.detectActiveBonds(heroes3);
      expect(bonds3.some(b => b.type === 'faction_3')).toBe(true);

      // 移除一个 → 2蜀 → faction_2
      const heroes2 = [
        sim.engine.hero.getGeneral('liubei')!,
        sim.engine.hero.getGeneral('guanyu')!,
      ];
      const bonds2 = bondSystem.detectActiveBonds(heroes2);
      expect(bonds2.some(b => b.type === 'faction_2')).toBe(true);
      expect(bonds2.some(b => b.type === 'faction_3')).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // FORM-FLOW-5: 智能编队推荐
  // ─────────────────────────────────────────
  describe('FORM-FLOW-5: 智能编队推荐', () => {
    it('should recommend formations based on stage characteristics', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.addHeroDirectly('zhugeliang');
      sim.addHeroDirectly('zhaoyun');

      const recommendSystem = sim.engine.getFormationRecommendSystem();
      const heroes = sim.engine.hero.getAllGenerals();

      const result = recommendSystem.recommend(
        'elite',
        heroes,
        (g) => sim.engine.hero.calculatePower(g),
        4000,
        4,
      );

      expect(result).toBeDefined();
      expect(result.characteristics.stageType).toBe('elite');
      expect(result.characteristics.difficultyLevel).toBeGreaterThanOrEqual(1);
      expect(result.plans.length).toBeGreaterThanOrEqual(1);
    });

    it('should show 1~3 recommendation plans', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addHeroDirectly('zhangfei');
      sim.addHeroDirectly('zhugeliang');
      sim.addHeroDirectly('zhaoyun');
      sim.addHeroDirectly('machao');
      sim.addHeroDirectly('huangzhong');

      const recommendSystem = sim.engine.getFormationRecommendSystem();
      const heroes = sim.engine.hero.getAllGenerals();

      const result = recommendSystem.recommend(
        'normal',
        heroes,
        (g) => sim.engine.hero.calculatePower(g),
        3000,
        3,
      );

      expect(result.plans.length).toBeGreaterThanOrEqual(1);
      expect(result.plans.length).toBeLessThanOrEqual(3);

      for (const plan of result.plans) {
        expect(plan.name).toBeTruthy();
        expect(plan.heroIds.length).toBeGreaterThanOrEqual(1);
        expect(plan.estimatedPower).toBeGreaterThan(0);
        expect(plan.score).toBeGreaterThanOrEqual(0);
        expect(plan.score).toBeLessThanOrEqual(100);
      }
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-2: 升级→属性变化→战力重算→编队更新
  // ─────────────────────────────────────────
  describe('CROSS-FLOW-2: 升级→属性变化→战力重算→编队更新', () => {
    it('should update formation power after level up', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.engine.createFormation('1');
      sim.engine.setFormation('1', ['liubei', 'guanyu']);

      const hero = sim.engine.hero;
      const formation = sim.engine.getFormationSystem().getFormation('1')!;
      const powerBefore = sim.engine.getFormationSystem().calculateFormationPower(
        formation,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
      );

      sim.addResources({ gold: 500000, grain: 500000 });
      sim.engine.enhanceHero('liubei', 10);

      const formationAfter = sim.engine.getFormationSystem().getFormation('1')!;
      const powerAfter = sim.engine.getFormationSystem().calculateFormationPower(
        formationAfter,
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g),
      );

      expect(powerAfter).toBeGreaterThan(powerBefore);
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-3: 重复武将→碎片→合成→新武将
  // ─────────────────────────────────────────
  describe('CROSS-FLOW-3: 重复武将→碎片→合成→新武将', () => {
    it('should get fragments from duplicate and synthesize new general', () => {
      // 添加刘备
      sim.addHeroDirectly('liubei');
      // 模拟获得重复碎片（直接添加碎片到合成阈值）
      const required = 150; // EPIC 品质合成需要 150 碎片
      sim.addHeroFragments('simayi', required);

      // 验证合成前
      expect(sim.engine.hero.hasGeneral('simayi')).toBe(false);

      // 执行合成
      const result = sim.engine.hero.fragmentSynthesize('simayi');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('simayi');
      expect(sim.engine.hero.hasGeneral('simayi')).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-4: 编队保存→刷新→数据恢复
  // ─────────────────────────────────────────
  describe('CROSS-FLOW-4: 编队保存→刷新→数据恢复', () => {
    it('should serialize and deserialize formation data', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.engine.createFormation('1');
      sim.engine.setFormation('1', ['liubei', 'guanyu']);

      const formationSystem = sim.engine.getFormationSystem();
      const saved = formationSystem.serialize();

      // 重置并恢复
      formationSystem.reset();
      formationSystem.deserialize(saved);

      const restored = formationSystem.getFormation('1');
      expect(restored).not.toBeNull();
      expect(restored!.slots.filter(s => s !== '').length).toBe(2);
    });

    it('should preserve pity counter through serialize/deserialize', () => {
      addRecruitResources(sim, 'advanced', 5);
      sim.recruitHero('advanced', 1);
      const stateBefore = sim.engine.heroRecruit.getGachaState();

      const saved = sim.engine.heroRecruit.serialize();
      sim.engine.heroRecruit.reset();
      sim.engine.heroRecruit.deserialize(saved);

      const stateAfter = sim.engine.heroRecruit.getGachaState();
      expect(stateAfter.advancedPity).toBe(stateBefore.advancedPity);
      expect(stateAfter.advancedHardPity).toBe(stateBefore.advancedHardPity);
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-5: 武将→建筑派驻联动
  // ─────────────────────────────────────────
  describe('CROSS-FLOW-5: 武将→建筑派驻联动', () => {
    it('should dispatch hero to building for production bonus', () => {
      sim.addHeroDirectly('liubei');

      const dispatchSystem = sim.engine.getHeroDispatchSystem();
      const result = dispatchSystem.dispatchHero('liubei', 'farmland');

      expect(result.success).toBe(true);
      expect(result.bonusPercent).toBeGreaterThan(0);
      expect(dispatchSystem.getBuildingDispatchHero('farmland')).toBe('liubei');
      expect(dispatchSystem.getHeroDispatchBuilding('liubei')).toBe('farmland');
    });

    it('should increase building output based on hero stats', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');

      const dispatchSystem = sim.engine.getHeroDispatchSystem();

      dispatchSystem.dispatchHero('liubei', 'farmland');
      dispatchSystem.dispatchHero('guanyu', 'market');

      const bonusFarmland = dispatchSystem.getDispatchBonus('farmland');
      const bonusMarket = dispatchSystem.getDispatchBonus('market');

      expect(bonusFarmland).toBeGreaterThan(0);
      expect(bonusMarket).toBeGreaterThan(0);

      const allBonuses = dispatchSystem.getAllDispatchBonuses();
      expect(Object.keys(allBonuses).length).toBe(2);
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-7: 武将升级→资源消耗→建筑产出联动
  // ─────────────────────────────────────────
  describe('CROSS-FLOW-7: 武将升级→资源消耗→建筑产出联动', () => {
    it('should update building output when dispatched hero levels up', () => {
      sim.addHeroDirectly('liubei');
      sim.addResources({ gold: 500000, grain: 500000 });

      const dispatchSystem = sim.engine.getHeroDispatchSystem();

      const dispatchResult = dispatchSystem.dispatchHero('liubei', 'farmland');
      expect(dispatchResult.success).toBe(true);
      const bonusBefore = dispatchSystem.getDispatchBonus('farmland');

      sim.engine.enhanceHero('liubei', 10);

      const bonusAfter = dispatchSystem.refreshDispatchBonus('liubei');
      expect(bonusAfter).toBeGreaterThan(bonusBefore);
    });
  });

  // ─────────────────────────────────────────
  // CROSS-FLOW-8: 技能升级→战力→编队联动
  // ─────────────────────────────────────────
  describe('CROSS-FLOW-8: 技能升级→战力→编队联动', () => {
    it('should update formation power after skill upgrade', () => {
      sim.addHeroDirectly('liubei');
      sim.addResources({ gold: 500000 });
      sim.engine.createFormation('1');
      sim.engine.addToFormation('1', 'liubei');

      const formation = sim.engine.getFormationSystem();
      const hero = sim.engine.hero;
      const star = sim.engine.getHeroStarSystem().getStar('liubei');
      const skillSys = sim.engine.getSkillUpgradeSystem();

      const powerBefore = formation.calculateFormationPower(
        sim.engine.getFormations()[0],
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g, star),
      );

      skillSys.upgradeSkill('liubei', 0, { skillBooks: 1, gold: 200 });

      const powerAfter = formation.calculateFormationPower(
        sim.engine.getFormations()[0],
        (id) => hero.getGeneral(id),
        (g) => hero.calculatePower(g, star),
      );

      expect(powerAfter).toBeGreaterThanOrEqual(powerBefore);
    });
  });
});

/**
 * 辅助：给模拟器添加招募所需资源
 */
function addRecruitResources(sim: GameEventSimulator, type: 'normal' | 'advanced', count: number): void {
  const RECRUIT_COSTS = {
    normal: { resourceType: 'recruitToken', amount: 1 },
    advanced: { resourceType: 'recruitToken', amount: 100 },
  };
  const cfg = RECRUIT_COSTS[type];
  sim.addResources({ [cfg.resourceType]: cfg.amount * count });
}
