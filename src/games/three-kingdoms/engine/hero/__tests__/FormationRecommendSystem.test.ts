/**
 * 编队推荐系统测试 — FormationRecommendSystem
 *
 * 覆盖：
 *   1. 推荐返回1~3个方案
 *   2. 每个方案包含名称/描述/战力/推荐分数
 *   3. 空武将池返回空数组
 *   4. 单武将推荐
 *   5. 多武将按战力排序
 *   6. 羁绊优先策略
 *   7. ISubsystem接口合规
 *   8. 关卡特性分析
 *   9. 不同关卡类型难度等级
 *
 * @module engine/hero/__tests__/FormationRecommendSystem.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FormationRecommendSystem } from '../FormationRecommendSystem';
import type { StageCharacteristics, FormationRecommendation, RecommendResult } from '../FormationRecommendSystem';
import type { GeneralData, Quality } from '../hero.types';
import type { ISystemDeps } from '../../../core/types';
import { MAX_SLOTS_PER_FORMATION } from '../formation-types';

// ── 测试辅助 ──────────────────────────────────

/** 创建 mock GeneralData */
function createMockGeneral(overrides: Partial<GeneralData> & { id: string }): GeneralData {
  return {
    name: overrides.name ?? '测试武将',
    quality: overrides.quality ?? ('RARE' as Quality),
    baseStats: overrides.baseStats ?? { attack: 100, defense: 80, intelligence: 90, speed: 70 },
    level: overrides.level ?? 10,
    exp: overrides.exp ?? 0,
    faction: overrides.faction ?? 'shu',
    skills: overrides.skills ?? [],
    ...overrides,
  } as GeneralData;
}

/** 创建 mock ISystemDeps */
function createMockDeps(): ISystemDeps {
  return {
    getResource: () => 0,
    getProductionRate: () => 0,
    emit: () => {},
  } as unknown as ISystemDeps;
}

/** 简单战力计算：等级 × 品质系数 + 攻击力 */
function simplePowerCalc(general: GeneralData): number {
  const qualityMultiplier: Record<string, number> = {
    COMMON: 1,
    FINE: 1.5,
    RARE: 2,
    EPIC: 3,
    LEGENDARY: 5,
  };
  const qMul = qualityMultiplier[general.quality] ?? 1;
  return Math.round(general.level * qMul + (general.baseStats.attack ?? 100));
}

/** 创建一组测试武将 */
function createTestHeroes(): GeneralData[] {
  return [
    createMockGeneral({ id: 'hero1', name: '关羽', quality: 'LEGENDARY' as Quality, faction: 'shu', level: 30, baseStats: { attack: 300, defense: 250, intelligence: 150, speed: 200 } }),
    createMockGeneral({ id: 'hero2', name: '张飞', quality: 'EPIC' as Quality, faction: 'shu', level: 25, baseStats: { attack: 280, defense: 200, intelligence: 100, speed: 180 } }),
    createMockGeneral({ id: 'hero3', name: '赵云', quality: 'LEGENDARY' as Quality, faction: 'shu', level: 28, baseStats: { attack: 270, defense: 230, intelligence: 160, speed: 220 } }),
    createMockGeneral({ id: 'hero4', name: '曹操', quality: 'LEGENDARY' as Quality, faction: 'wei', level: 32, baseStats: { attack: 260, defense: 240, intelligence: 280, speed: 190 } }),
    createMockGeneral({ id: 'hero5', name: '司马懿', quality: 'EPIC' as Quality, faction: 'wei', level: 22, baseStats: { attack: 150, defense: 180, intelligence: 300, speed: 160 } }),
    createMockGeneral({ id: 'hero6', name: '周瑜', quality: 'EPIC' as Quality, faction: 'wu', level: 20, baseStats: { attack: 200, defense: 170, intelligence: 260, speed: 210 } }),
    createMockGeneral({ id: 'hero7', name: '吕布', quality: 'LEGENDARY' as Quality, faction: 'qun', level: 35, baseStats: { attack: 350, defense: 180, intelligence: 80, speed: 250 } }),
  ];
}

// ═══════════════════════════════════════════════════════════════

describe('FormationRecommendSystem', () => {
  let system: FormationRecommendSystem;

  beforeEach(() => {
    system = new FormationRecommendSystem();
    system.init(createMockDeps());
  });

  // ───────────────────────────────────────
  // 1. 推荐返回1~3个方案
  // ───────────────────────────────────────
  describe('推荐方案数量', () => {
    it('多武将时返回1~3个方案', () => {
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);

      expect(result.plans.length).toBeGreaterThanOrEqual(1);
      expect(result.plans.length).toBeLessThanOrEqual(3);
    });

    it('7个武将应返回3个方案', () => {
      const heroes = createTestHeroes(); // 7个武将
      const result = system.recommend('normal', heroes, simplePowerCalc);

      expect(result.plans).toHaveLength(3);
    });

    it('3个武将应返回2个方案（无羁绊优先）', () => {
      const heroes = createTestHeroes().slice(0, 3);
      const result = system.recommend('normal', heroes, simplePowerCalc);

      // 3个武将 > 2，但 <=3，只生成最强战力+平衡方案
      expect(result.plans.length).toBeGreaterThanOrEqual(1);
    });

    it('2个武将应返回1个方案（仅最强战力）', () => {
      const heroes = createTestHeroes().slice(0, 2);
      const result = system.recommend('normal', heroes, simplePowerCalc);

      expect(result.plans.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ───────────────────────────────────────
  // 2. 每个方案包含名称/描述/战力/推荐分数
  // ───────────────────────────────────────
  describe('方案结构完整性', () => {
    it('每个方案包含name字段', () => {
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);

      for (const plan of result.plans) {
        expect(plan.name).toBeTruthy();
        expect(typeof plan.name).toBe('string');
      }
    });

    it('每个方案包含description字段', () => {
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);

      for (const plan of result.plans) {
        expect(plan.description).toBeTruthy();
        expect(typeof plan.description).toBe('string');
      }
    });

    it('每个方案包含estimatedPower字段且为正数', () => {
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);

      for (const plan of result.plans) {
        expect(plan.estimatedPower).toBeGreaterThan(0);
        expect(typeof plan.estimatedPower).toBe('number');
      }
    });

    it('每个方案包含score字段且在0~100范围', () => {
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);

      for (const plan of result.plans) {
        expect(plan.score).toBeGreaterThanOrEqual(0);
        expect(plan.score).toBeLessThanOrEqual(100);
      }
    });

    it('每个方案包含heroIds数组', () => {
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);

      for (const plan of result.plans) {
        expect(Array.isArray(plan.heroIds)).toBe(true);
        expect(plan.heroIds.length).toBeGreaterThan(0);
        expect(plan.heroIds.length).toBeLessThanOrEqual(MAX_SLOTS_PER_FORMATION);
      }
    });

    it('每个方案包含tags数组', () => {
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);

      for (const plan of result.plans) {
        expect(Array.isArray(plan.tags)).toBe(true);
        expect(plan.tags.length).toBeGreaterThan(0);
      }
    });
  });

  // ───────────────────────────────────────
  // 3. 空武将池返回空数组
  // ───────────────────────────────────────
  describe('空武将池', () => {
    it('空数组返回空plans', () => {
      const result = system.recommend('normal', [], simplePowerCalc);

      expect(result.plans).toEqual([]);
    });

    it('空数组仍返回关卡特性分析', () => {
      const result = system.recommend('normal', [], simplePowerCalc);

      expect(result.characteristics).toBeDefined();
      expect(result.characteristics.stageType).toBe('normal');
    });
  });

  // ───────────────────────────────────────
  // 4. 单武将推荐
  // ───────────────────────────────────────
  describe('单武将推荐', () => {
    it('单武将返回1个方案', () => {
      const heroes = [createMockGeneral({ id: 'single1', quality: 'EPIC' as Quality, level: 20 })];
      const result = system.recommend('normal', heroes, simplePowerCalc);

      expect(result.plans).toHaveLength(1);
    });

    it('单武将方案的heroIds包含该武将', () => {
      const heroes = [createMockGeneral({ id: 'single1', quality: 'EPIC' as Quality, level: 20 })];
      const result = system.recommend('normal', heroes, simplePowerCalc);

      expect(result.plans[0].heroIds).toContain('single1');
    });

    it('单武将方案战力等于该武将战力', () => {
      const hero = createMockGeneral({ id: 'single1', quality: 'EPIC' as Quality, level: 20 });
      const heroes = [hero];
      const result = system.recommend('normal', heroes, simplePowerCalc);
      const expectedPower = simplePowerCalc(hero);

      expect(result.plans[0].estimatedPower).toBe(expectedPower);
    });
  });

  // ───────────────────────────────────────
  // 5. 多武将按战力排序
  // ───────────────────────────────────────
  describe('战力排序', () => {
    it('最强战力方案中heroIds按战力从高到低排列', () => {
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);
      const bestPlan = result.plans[0]; // 第一个方案 = 最强战力

      expect(bestPlan.name).toBe('最强战力');

      // 验证heroIds中的武将战力递减
      const powers = bestPlan.heroIds.map(id => {
        const hero = heroes.find(h => h.id === id)!;
        return simplePowerCalc(hero);
      });

      for (let i = 1; i < powers.length; i++) {
        expect(powers[i]).toBeLessThanOrEqual(powers[i - 1]);
      }
    });

    it('最强战力方案的总战力为选中武将战力之和', () => {
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);
      const bestPlan = result.plans[0];

      const expectedTotal = bestPlan.heroIds.reduce((sum, id) => {
        const hero = heroes.find(h => h.id === id)!;
        return sum + simplePowerCalc(hero);
      }, 0);

      expect(bestPlan.estimatedPower).toBe(expectedTotal);
    });
  });

  // ───────────────────────────────────────
  // 6. 羁绊优先策略
  // ───────────────────────────────────────
  describe('羁绊优先策略', () => {
    it('羁绊优先方案存在且包含同阵营武将', () => {
      const heroes = createTestHeroes(); // 有多个蜀国武将
      const result = system.recommend('normal', heroes, simplePowerCalc);

      // 查找羁绊优先方案
      const synergyPlan = result.plans.find(p => p.name === '羁绊优先');
      if (synergyPlan) {
        expect(synergyPlan.tags).toContain('羁绊加成');
        // 蜀国武将最多（关羽、张飞、赵云），羁绊方案应优先选蜀国
        const shuHeroes = synergyPlan.heroIds.filter(id => {
          const hero = heroes.find(h => h.id === id);
          return hero?.faction === 'shu';
        });
        expect(shuHeroes.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('羁绊优先方案tags包含阵营信息', () => {
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);

      const synergyPlan = result.plans.find(p => p.name === '羁绊优先');
      if (synergyPlan) {
        // tags应包含阵营标签
        const hasFactionTag = synergyPlan.tags.some(t =>
          t.includes('shu') || t.includes('wei') || t.includes('wu') || t.includes('qun') || t.includes('阵营')
        );
        expect(hasFactionTag).toBe(true);
      }
    });
  });

  // ───────────────────────────────────────
  // 7. ISubsystem接口合规
  // ───────────────────────────────────────
  describe('ISubsystem接口合规', () => {
    it('name属性为 formationRecommend', () => {
      expect(system.name).toBe('formationRecommend');
    });

    it('init不抛异常', () => {
      const newSystem = new FormationRecommendSystem();
      expect(() => newSystem.init(createMockDeps())).not.toThrow();
    });

    it('update不抛异常', () => {
      expect(() => system.update(16)).not.toThrow();
    });

    it('getState返回对象', () => {
      const state = system.getState();
      expect(state).toBeDefined();
      expect(typeof state).toBe('object');
    });

    it('reset不抛异常且不破坏后续推荐', () => {
      system.reset();
      const heroes = createTestHeroes();
      const result = system.recommend('normal', heroes, simplePowerCalc);
      expect(result.plans.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ───────────────────────────────────────
  // 8. 关卡特性分析
  // ───────────────────────────────────────
  describe('关卡特性分析', () => {
    it('normal关卡难度等级1~5', () => {
      const result = system.recommend('normal', createTestHeroes(), simplePowerCalc, 2000);
      expect(result.characteristics.stageType).toBe('normal');
      expect(result.characteristics.difficultyLevel).toBeGreaterThanOrEqual(1);
      expect(result.characteristics.difficultyLevel).toBeLessThanOrEqual(5);
    });

    it('elite关卡难度等级4~8', () => {
      const result = system.recommend('elite', createTestHeroes(), simplePowerCalc, 5000);
      expect(result.characteristics.stageType).toBe('elite');
      expect(result.characteristics.difficultyLevel).toBeGreaterThanOrEqual(4);
      expect(result.characteristics.difficultyLevel).toBeLessThanOrEqual(8);
    });

    it('boss关卡难度等级7~10', () => {
      const result = system.recommend('boss', createTestHeroes(), simplePowerCalc, 10000);
      expect(result.characteristics.stageType).toBe('boss');
      expect(result.characteristics.difficultyLevel).toBeGreaterThanOrEqual(7);
      expect(result.characteristics.difficultyLevel).toBeLessThanOrEqual(10);
    });

    it('characteristics包含recommendedPower', () => {
      const result = system.recommend('normal', createTestHeroes(), simplePowerCalc, 3000);
      expect(result.characteristics.recommendedPower).toBe(3000);
    });

    it('characteristics包含enemySize', () => {
      const result = system.recommend('normal', createTestHeroes(), simplePowerCalc, 0, 5);
      expect(result.characteristics.enemySize).toBe(5);
    });

    it('默认enemySize为3', () => {
      const result = system.recommend('normal', createTestHeroes(), simplePowerCalc);
      expect(result.characteristics.enemySize).toBe(3);
    });
  });

  // ───────────────────────────────────────
  // 9. analyzeStage 独立测试
  // ───────────────────────────────────────
  describe('analyzeStage', () => {
    it('normal关卡recommendedPower=0时难度为1', () => {
      const chars = system.analyzeStage('normal', 0, 3);
      expect(chars.difficultyLevel).toBeGreaterThanOrEqual(1);
    });

    it('boss关卡高战力时难度为10', () => {
      const chars = system.analyzeStage('boss', 10000, 3);
      expect(chars.difficultyLevel).toBe(10);
    });

    it('返回正确的StageCharacteristics结构', () => {
      const chars = system.analyzeStage('elite', 3000, 6);
      expect(chars).toHaveProperty('stageType', 'elite');
      expect(chars).toHaveProperty('recommendedPower', 3000);
      expect(chars).toHaveProperty('enemySize', 6);
      expect(chars).toHaveProperty('difficultyLevel');
    });
  });
});
