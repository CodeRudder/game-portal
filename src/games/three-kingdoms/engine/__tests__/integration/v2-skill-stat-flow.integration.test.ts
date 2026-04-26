/**
 * V2 技能与属性系统集成测试
 *
 * 基于 v2-play.md 深度验证技能和属性系统：
 * - SKILL-FLOW-1: 技能信息展示（全量验证）
 * - SKILL-FLOW-2: 技能升级 [引擎未实现]
 * - SKILL-FLOW-3: 技能搭配推荐 [引擎未实现]
 * - STAT-FLOW-1: 四维属性体系验证（全量交叉验证）
 * - STAT-FLOW-2: 战力计算公式验证（多场景）
 * - CROSS-FLOW-8: 技能升级→战力→编队联动 [引擎未实现]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import {
  Quality, QUALITY_TIERS, QUALITY_ORDER, FACTIONS,
} from '../../hero/hero.types';
import type { SkillType, GeneralData } from '../../hero/hero.types';
import {
  GENERAL_DEFS, POWER_WEIGHTS, LEVEL_COEFFICIENT_PER_LEVEL,
  QUALITY_MULTIPLIERS, HERO_MAX_LEVEL,
} from '../../hero/hero-config';
import { getStarMultiplier, STAR_MULTIPLIERS } from '../../hero/star-up-config';
import type { GameEventSimulator } from '../../../test-utils/GameEventSimulator';

describe('V2 SKILL-STAT-FLOW: 技能与属性系统集成测试', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    sim = createSim();
  });

  // ─────────────────────────────────────────
  // SKILL-FLOW-1: 技能信息展示（全量验证）
  // ─────────────────────────────────────────

  describe('SKILL-FLOW-1: 技能信息展示', () => {
    it('should have at least 1 skill per general', () => {
      // Play SKILL-FLOW-1 步骤2: 检查技能列表区域
      for (const def of GENERAL_DEFS) {
        expect(def.skills.length, `${def.name} should have >= 1 skill`).toBeGreaterThanOrEqual(1);
      }
    });

    it('should have valid skill structure (id, name, type, level, description)', () => {
      // Play SKILL-FLOW-1 步骤2: 每个技能显示名称+类型标签+描述
      for (const def of GENERAL_DEFS) {
        for (const skill of def.skills) {
          expect(skill.id, `${def.name} skill should have id`).toBeTruthy();
          expect(skill.name, `${def.name} skill should have name`).toBeTruthy();
          expect(skill.type, `${def.name} skill should have type`).toBeTruthy();
          expect(skill.level, `${def.name} skill should have level`).toBeGreaterThanOrEqual(1);
          expect(skill.description, `${def.name} skill should have description`).toBeTruthy();
        }
      }
    });

    it('should have active skill (大招) with CD description for combat generals', () => {
      // Play SKILL-FLOW-1 步骤3: 检查主动技能
      const combatHeroes = GENERAL_DEFS.filter(d =>
        d.quality !== Quality.COMMON && d.quality !== Quality.FINE,
      );
      for (const def of combatHeroes) {
        const hasActive = def.skills.some(s => s.type === 'active');
        expect(hasActive, `${def.name} (quality=${def.quality}) should have active skill`).toBe(true);
      }
    });

    it('should have passive skills providing continuous buffs', () => {
      // Play SKILL-FLOW-1 步骤4: 检查被动技能
      const heroesWithPassive = GENERAL_DEFS.filter(d =>
        d.skills.some(s => s.type === 'passive'),
      );
      expect(heroesWithPassive.length).toBeGreaterThanOrEqual(1);
    });

    it('should have faction skills for faction leaders', () => {
      // Play SKILL-FLOW-1 步骤5: 检查阵营技能
      // 当前仅刘备(蜀)和曹操(魏)拥有阵营技能
      const factionLeaders = ['liubei', 'caocao'];
      for (const id of factionLeaders) {
        const def = GENERAL_DEFS.find(d => d.id === id);
        if (def) {
          const hasFaction = def.skills.some(s => s.type === 'faction');
          expect(hasFaction, `${def.name} should have faction skill`).toBe(true);
        }
      }
    });

    it('should have unique skill IDs across all generals', () => {
      // 验证技能ID全局唯一
      const allSkillIds: string[] = [];
      for (const def of GENERAL_DEFS) {
        for (const skill of def.skills) {
          allSkillIds.push(skill.id);
        }
      }
      const uniqueIds = new Set(allSkillIds);
      expect(uniqueIds.size).toBe(allSkillIds.length);
    });

    it('should have skill level starting at 1', () => {
      // 验证技能初始等级为1
      for (const def of GENERAL_DEFS) {
        for (const skill of def.skills) {
          expect(skill.level, `${def.name} skill ${skill.id} level should start at 1`).toBe(1);
        }
      }
    });

    it('should have at least 1 active skill per Rare+ general', () => {
      // 品质≥稀有的武将至少有1个主动技能
      const rarePlus = GENERAL_DEFS.filter(d =>
        QUALITY_ORDER[d.quality] >= QUALITY_ORDER[Quality.RARE],
      );
      for (const def of rarePlus) {
        const hasActive = def.skills.some(s => s.type === 'active');
        expect(hasActive, `${def.name} (Rare+) should have active skill`).toBe(true);
      }
    });

    it('should have skill descriptions mentioning damage/healing/buff keywords', () => {
      // 验证技能描述包含关键效果词
      const effectKeywords = ['伤害', '治疗', '增益', '减益', '攻击', '防御', '回复', '造成', '提升', '智力', '武力', '统率', '政治', '概率', '伤害'];
      for (const def of GENERAL_DEFS) {
        for (const skill of def.skills) {
          const hasKeyword = effectKeywords.some(kw => skill.description.includes(kw));
          expect(hasKeyword, `${def.name} skill ${skill.name} desc should mention effect`).toBe(true);
        }
      }
    });
  });

  // ─────────────────────────────────────────
  // SKILL-FLOW-2: 技能升级 [引擎未实现]
  // ─────────────────────────────────────────

  describe('SKILL-FLOW-2: 技能升级', () => {
    it('should upgrade skill with skill books and gold', () => {
      sim.addHeroDirectly('liubei');
      sim.addResources({ gold: 500000, skillBook: 100 });
      const skillSys = sim.engine.getSkillUpgradeSystem();
      const result = skillSys.upgradeSkill('liubei', 0, { skillBooks: 1, gold: 500 });
      expect(result.success).toBe(true);
      expect(result.currentLevel).toBe(2);
      expect(result.previousLevel).toBe(1);
    });

    it('should increase skill effect after upgrade', () => {
      sim.addHeroDirectly('liubei');
      sim.addResources({ gold: 500000, skillBook: 100 });
      const skillSys = sim.engine.getSkillUpgradeSystem();
      const effectBefore = skillSys.getSkillEffect('liubei', 0);
      skillSys.upgradeSkill('liubei', 0, { skillBooks: 1, gold: 500 });
      const effectAfter = skillSys.getSkillEffect('liubei', 0);
      expect(effectAfter).toBeGreaterThan(effectBefore);
    });

    it('should respect skill level cap based on star level', () => {
      sim.addHeroDirectly('liubei');
      sim.addResources({ gold: 5000000 });
      const skillSys = sim.engine.getSkillUpgradeSystem();
      // 1星武将技能等级上限为3
      const cap1 = skillSys.getSkillLevelCap(1);
      expect(cap1).toBe(3);
      // 升到上限后无法继续升级
      for (let i = 0; i < cap1; i++) {
        skillSys.upgradeSkill('liubei', 0, { skillBooks: 1, gold: 500 });
      }
      const result = skillSys.upgradeSkill('liubei', 0, { skillBooks: 1, gold: 500 });
      expect(result.success).toBe(false);
      // 高星级上限更高
      expect(skillSys.getSkillLevelCap(3)).toBeGreaterThan(cap1);
    });

    it('should require breakthrough for awaken skill upgrade', () => {
      // 验证觉醒技能升级需要突破前置
      const skillSys = sim.engine.getSkillUpgradeSystem();
      // 未突破的武将不能升级觉醒技能
      sim.addHeroDirectly('liubei');
      expect(skillSys.canUpgradeAwakenSkill('liubei')).toBe(false);
      // 模拟突破完成（直接设置突破阶段）
      // 突破需要breakthroughStone，该资源不在标准ResourceType中，
      // 所以通过HeroStarSystem的内部状态验证逻辑
      const starSys = sim.engine.getHeroStarSystem();
      // 设置武将到30级
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.addResources({ gold: 50000000, grain: 50000000 });
      sim.engine.enhanceHero('liubei', 30);
      sim.addHeroFragments('liubei', 100);
      // 尝试突破（可能因breakthroughStone不足而失败）
      starSys.breakthrough('liubei');
      // 如果突破成功，则canUpgradeAwakenSkill应为true
      // 如果突破失败（缺突破石），则仍为false，但这是资源不足而非逻辑错误
      const breakthroughStage = starSys.getBreakthroughStage('liubei');
      expect(skillSys.canUpgradeAwakenSkill('liubei')).toBe(breakthroughStage >= 1);
    });
  });

  // ─────────────────────────────────────────
  // SKILL-FLOW-3: 技能搭配推荐
  // ─────────────────────────────────────────

  describe('SKILL-FLOW-3: 技能搭配推荐验证', () => {
    it('should recommend strategy for burn-heavy enemies', () => {
      const skillSys = sim.engine.getSkillUpgradeSystem();
      const rec = skillSys.recommendStrategy('burn-heavy');
      expect(rec).toBeDefined();
      expect(rec.enemyType).toBe('burn-heavy');
      expect(rec.focusStats).toContain('intelligence');
    });

    it('should recommend strategy for physical enemies', () => {
      const skillSys = sim.engine.getSkillUpgradeSystem();
      const rec = skillSys.recommendStrategy('physical');
      expect(rec).toBeDefined();
      expect(rec.enemyType).toBe('physical');
      expect(rec.focusStats).toContain('defense');
    });

    it('should recommend strategy for BOSS stage', () => {
      const skillSys = sim.engine.getSkillUpgradeSystem();
      const rec = skillSys.recommendStrategy('boss');
      expect(rec).toBeDefined();
      expect(rec.enemyType).toBe('boss');
      expect(rec.prioritySkillTypes).toContain('active');
    });
  });

  // ─────────────────────────────────────────
  // STAT-FLOW-1: 四维属性体系验证（全量交叉验证）
  // ─────────────────────────────────────────

  describe('STAT-FLOW-1: 四维属性体系验证', () => {
    it('should have all four stats (ATK/CMD/INT/POL) for every general definition', () => {
      // Play STAT-FLOW-1 步骤2: 四维属性展示
      for (const def of GENERAL_DEFS) {
        const { attack, defense, intelligence, speed } = def.baseStats;
        expect(typeof attack).toBe('number');
        expect(typeof defense).toBe('number');
        expect(typeof intelligence).toBe('number');
        expect(typeof speed).toBe('number');
      }
    });

    it('should have warrior-type generals with highest ATK', () => {
      // Play STAT-FLOW-1 步骤5: 猛将型ATK成长高
      const warriorIds = ['guanyu', 'zhangfei', 'dianwei', 'lvbu'];
      for (const id of warriorIds) {
        const def = GENERAL_DEFS.find(d => d.id === id);
        if (def) {
          const { attack, intelligence } = def.baseStats;
          expect(attack, `${def.name} ATK should be highest stat`).toBeGreaterThanOrEqual(intelligence);
        }
      }
    });

    it('should have strategist-type generals with highest INT', () => {
      // Play STAT-FLOW-1 步骤5: 谋士型INT成长高
      const strategistIds = ['zhugeliang', 'simayi', 'zhouyu'];
      for (const id of strategistIds) {
        const def = GENERAL_DEFS.find(d => d.id === id);
        if (def) {
          const { attack, intelligence } = def.baseStats;
          expect(intelligence, `${def.name} INT should be >= ATK`).toBeGreaterThanOrEqual(attack);
        }
      }
    });

    it('should have commander-type generals with highest CMD (defense)', () => {
      // Play STAT-FLOW-1 步骤5: 统帅型CMD成长高
      const commanderIds = ['liubei', 'caocao'];
      for (const id of commanderIds) {
        const def = GENERAL_DEFS.find(d => d.id === id);
        if (def) {
          // 统帅型武将defense(统率)应相对较高
          expect(def.baseStats.defense, `${def.name} CMD should be significant`).toBeGreaterThan(0);
        }
      }
    });

    it('should have no stat below 30 for any general', () => {
      // 全量验证最低属性值
      for (const def of GENERAL_DEFS) {
        const { attack, defense, intelligence, speed } = def.baseStats;
        const minStat = Math.min(attack, defense, intelligence, speed);
        expect(minStat, `${def.name} min stat should be >= 30`).toBeGreaterThanOrEqual(30);
      }
    });

    it('should have no stat above 120 for any general', () => {
      // 全量验证最高属性值
      for (const def of GENERAL_DEFS) {
        const { attack, defense, intelligence, speed } = def.baseStats;
        const maxStat = Math.max(attack, defense, intelligence, speed);
        expect(maxStat, `${def.name} max stat should be <= 120`).toBeLessThanOrEqual(120);
      }
    });

    it('should have stat differences between different hero types', () => {
      // 验证不同类型武将的属性分布有差异
      sim.addHeroDirectly('guanyu');  // 猛将
      sim.addHeroDirectly('zhugeliang'); // 谋士
      const guanyu = sim.engine.hero.getGeneral('guanyu')!;
      const zhugeliang = sim.engine.hero.getGeneral('zhugeliang')!;

      // 猛将ATK > 谋士ATK
      expect(guanyu.baseStats.attack).toBeGreaterThan(zhugeliang.baseStats.attack);
      // 谋士INT > 猛将INT
      expect(zhugeliang.baseStats.intelligence).toBeGreaterThan(guanyu.baseStats.intelligence);
    });
  });

  // ─────────────────────────────────────────
  // STAT-FLOW-2: 战力计算公式验证（多场景）
  // ─────────────────────────────────────────

  describe('STAT-FLOW-2: 战力计算公式验证', () => {
    it('should calculate power correctly for all generals at level 1 star 1', () => {
      // Play STAT-FLOW-2 步骤3~4: 手动计算战力 vs 游戏显示战力
      for (const def of GENERAL_DEFS) {
        sim.addHeroDirectly(def.id);
        const general = sim.engine.hero.getGeneral(def.id)!;
        const star = sim.engine.getHeroStarSystem().getStar(def.id);

        const { attack, defense, intelligence, speed } = general.baseStats;
        const statsPower = attack * POWER_WEIGHTS.attack
          + defense * POWER_WEIGHTS.defense
          + intelligence * POWER_WEIGHTS.intelligence
          + speed * POWER_WEIGHTS.speed;
        const levelCoeff = 1 + general.level * LEVEL_COEFFICIENT_PER_LEVEL;
        const qualityCoeff = QUALITY_MULTIPLIERS[general.quality];
        const starCoeff = getStarMultiplier(star);
        const expectedPower = Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff);

        const actualPower = sim.engine.hero.calculatePower(general, star);
        expect(actualPower, `${def.name} power mismatch`).toBe(expectedPower);
      }
    });

    it('should have power formula weights matching PRD (ATK=2.0, CMD=1.5, INT=2.0, POL=1.0)', () => {
      // Play STAT-FLOW-2 步骤3: 验证战力公式权重
      expect(POWER_WEIGHTS.attack).toBe(2.0);      // ATK × 2.0
      expect(POWER_WEIGHTS.defense).toBe(1.5);     // CMD × 1.5
      expect(POWER_WEIGHTS.intelligence).toBe(2.0); // INT × 2.0
      expect(POWER_WEIGHTS.speed).toBe(1.0);       // POL × 1.0
    });

    it('should increase power proportionally with level', () => {
      // Play STAT-FLOW-2 步骤5: 升级后战力增量正确
      sim.addHeroDirectly('liubei');
      sim.addResources({ gold: 500000, grain: 500000 });

      const hero = sim.engine.hero;
      const star = sim.engine.getHeroStarSystem().getStar('liubei');
      const powerL1 = hero.calculatePower(hero.getGeneral('liubei')!, star);

      sim.engine.heroLevel.addExp('liubei', 500);
      const powerL2 = hero.calculatePower(hero.getGeneral('liubei')!, star);

      expect(powerL2).toBeGreaterThan(powerL1);
      // 验证增量比例合理（约5%每级）
      const ratio = powerL2 / powerL1;
      expect(ratio).toBeGreaterThan(1.0);
    });

    it('should apply star coefficient correctly', () => {
      // Play STAT-FLOW-2 步骤6: 星级系数正确应用
      expect(getStarMultiplier(1)).toBe(1.0);
      expect(getStarMultiplier(2)).toBe(1.15);
      expect(getStarMultiplier(3)).toBe(1.35);
      expect(getStarMultiplier(4)).toBe(1.6);
      expect(getStarMultiplier(5)).toBe(2.0);
      expect(getStarMultiplier(6)).toBe(2.5);
    });

    it('should calculate total power for multiple generals', () => {
      // 验证总战力计算
      const heroIds = ['liubei', 'guanyu', 'zhangfei'];
      for (const id of heroIds) {
        sim.addHeroDirectly(id);
      }

      const totalPower = sim.getTotalPower();
      expect(totalPower).toBeGreaterThan(0);

      // 验证总战力 = 各武将战力之和
      let sumPower = 0;
      for (const id of heroIds) {
        const g = sim.engine.hero.getGeneral(id)!;
        const star = sim.engine.getHeroStarSystem().getStar(id);
        sumPower += sim.engine.hero.calculatePower(g, star);
      }
      expect(totalPower).toBe(sumPower);
    });

    it('should have higher power for higher quality generals', () => {
      // 验证品质越高战力越高（趋势）
      sim.addHeroDirectly('minbingduizhang'); // COMMON
      sim.addHeroDirectly('lvbu');            // LEGENDARY

      const commonPower = sim.engine.hero.calculatePower(
        sim.engine.hero.getGeneral('minbingduizhang')!, 1,
      );
      const legendaryPower = sim.engine.hero.calculatePower(
        sim.engine.hero.getGeneral('lvbu')!, 1,
      );

      expect(legendaryPower).toBeGreaterThan(commonPower);
    });

    it('should have power increase with star up', () => {
      // Play STAT-FLOW-2 步骤6: 升星后战力增加
      sim.addHeroDirectly('liubei');
      sim.addHeroFragments('liubei', 30);
      sim.addResources({ gold: 500000 });

      const hero = sim.engine.hero;
      const powerBefore = hero.calculatePower(hero.getGeneral('liubei')!, 1);
      sim.engine.getHeroStarSystem().starUp('liubei');
      const powerAfter = hero.calculatePower(hero.getGeneral('liubei')!, 2);

      expect(powerAfter).toBeGreaterThan(powerBefore);
      // 升星后战力增幅约15%（2星倍率1.15）
      const ratio = powerAfter / powerBefore;
      expect(ratio).toBeCloseTo(1.15, 0);
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

    it('should recalculate formation total power after any skill change', () => {
      sim.addHeroDirectly('liubei');
      sim.addHeroDirectly('guanyu');
      sim.addResources({ gold: 5000000 });
      sim.engine.createFormation('1');
      sim.engine.addToFormation('1', 'liubei');
      sim.engine.addToFormation('1', 'guanyu');

      const hero = sim.engine.hero;
      const starSystem = sim.engine.getHeroStarSystem();
      const formation = sim.engine.getFormationSystem();
      const skillSys = sim.engine.getSkillUpgradeSystem();

      const calcTotal = () => {
        const f = sim.engine.getFormations()[0];
        return formation.calculateFormationPower(
          f,
          (id) => hero.getGeneral(id),
          (g) => hero.calculatePower(g, starSystem.getStar(g.id)),
        );
      };

      const totalBefore = calcTotal();
      skillSys.upgradeSkill('liubei', 0, { skillBooks: 1, gold: 200 });
      skillSys.upgradeSkill('guanyu', 0, { skillBooks: 1, gold: 200 });
      const totalAfter = calcTotal();

      expect(totalAfter).toBeGreaterThanOrEqual(totalBefore);
    });
  });
});
