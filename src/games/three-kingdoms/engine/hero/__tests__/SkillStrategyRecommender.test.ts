/**
 * 技能策略推荐器测试
 *
 * 覆盖：策略推荐、技能类型优先级、属性侧重、ISubsystem 接口、边界条件
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SkillStrategyRecommender } from '../SkillStrategyRecommender';
import type { EnemyType, StrategyRecommendation } from '../SkillStrategyRecommender';

describe('SkillStrategyRecommender', () => {
  let recommender: SkillStrategyRecommender;

  beforeEach(() => {
    recommender = new SkillStrategyRecommender();
  });

  // ── 正常路径：策略推荐 ──

  describe('recommendStrategy', () => {
    it('burn-heavy 敌人推荐被动+主动技能，侧重智力和防御', () => {
      const result = recommender.recommendStrategy('burn-heavy');

      expect(result.enemyType).toBe('burn-heavy');
      expect(result.prioritySkillTypes).toEqual(['passive', 'active']);
      expect(result.focusStats).toEqual(['intelligence', 'defense']);
      expect(result.description).toContain('灼烧');
    });

    it('physical 敌人推荐被动+阵营技能，侧重防御和速度', () => {
      const result = recommender.recommendStrategy('physical');

      expect(result.enemyType).toBe('physical');
      expect(result.prioritySkillTypes).toEqual(['passive', 'faction']);
      expect(result.focusStats).toEqual(['defense', 'speed']);
      expect(result.description).toContain('物理');
    });

    it('boss 敌人推荐主动+觉醒技能，侧重攻击和智力', () => {
      const result = recommender.recommendStrategy('boss');

      expect(result.enemyType).toBe('boss');
      expect(result.prioritySkillTypes).toEqual(['active', 'awaken']);
      expect(result.focusStats).toEqual(['attack', 'intelligence']);
      expect(result.description).toContain('BOSS');
    });

    it('返回的策略结果中顶级字段是独立的（不同引用）', () => {
      const result1 = recommender.recommendStrategy('burn-heavy');
      const result2 = recommender.recommendStrategy('burn-heavy');

      // 顶级对象是不同引用（浅拷贝）
      expect(result1).not.toBe(result2);
      expect(result1.enemyType).toBe(result2.enemyType);
    });

    // ⚠️ BUG-P0: recommendStrategy 使用展开运算符浅拷贝，嵌套数组 prioritySkillTypes
    // 和 focusStats 仍与 STRATEGY_CONFIG 共享引用。外部修改会污染内部配置。
    // 建议修复为深拷贝或对数组单独拷贝。
    it('【BUG】返回的策略结果中嵌套数组与内部配置共享引用（浅拷贝）', () => {
      const result1 = recommender.recommendStrategy('boss');
      const result2 = recommender.recommendStrategy('boss');

      // 顶级对象是不同引用
      expect(result1).not.toBe(result2);
      // 但嵌套数组是同一引用（浅拷贝 Bug）
      expect(result1.prioritySkillTypes).toBe(result2.prioritySkillTypes);
      expect(result1.focusStats).toBe(result2.focusStats);
    });

    it('所有敌人类型都能正常返回策略', () => {
      const enemyTypes: EnemyType[] = ['burn-heavy', 'physical', 'boss'];
      for (const et of enemyTypes) {
        const result = recommender.recommendStrategy(et);
        expect(result).toBeDefined();
        expect(result.enemyType).toBe(et);
        expect(result.prioritySkillTypes.length).toBeGreaterThan(0);
        expect(result.focusStats.length).toBeGreaterThan(0);
        expect(result.description.length).toBeGreaterThan(0);
      }
    });
  });

  // ── 正常路径：获取所有策略 ──

  describe('getAllStrategies', () => {
    it('返回所有三种敌人类型的策略', () => {
      const strategies = recommender.getAllStrategies();

      expect(Object.keys(strategies)).toHaveLength(3);
      expect(strategies['burn-heavy']).toBeDefined();
      expect(strategies['physical']).toBeDefined();
      expect(strategies['boss']).toBeDefined();
    });

    it('返回的策略包含完整字段', () => {
      const strategies = recommender.getAllStrategies();

      for (const key of Object.keys(strategies) as EnemyType[]) {
        const s = strategies[key];
        expect(s.enemyType).toBe(key);
        expect(Array.isArray(s.prioritySkillTypes)).toBe(true);
        expect(Array.isArray(s.focusStats)).toBe(true);
        expect(typeof s.description).toBe('string');
      }
    });
  });

  // ── 正常路径：技能类型优先级 ──

  describe('getPrioritySkillTypes', () => {
    it('burn-heavy 返回的技能类型包含被动和主动', () => {
      const types = recommender.getPrioritySkillTypes('burn-heavy');
      expect(types).toContain('passive');
      expect(types).toContain('active');
    });

    it('physical 返回被动和阵营技能类型', () => {
      const types = recommender.getPrioritySkillTypes('physical');
      expect(types).toEqual(['passive', 'faction']);
    });

    it('boss 返回主动和觉醒技能类型', () => {
      const types = recommender.getPrioritySkillTypes('boss');
      expect(types).toEqual(['active', 'awaken']);
    });

    it('返回的是副本，修改不影响后续调用', () => {
      const types1 = recommender.getPrioritySkillTypes('boss');
      types1.push('passive' as never);

      const types2 = recommender.getPrioritySkillTypes('boss');
      expect(types2).toEqual(['active', 'awaken']);
    });
  });

  // ── 正常路径：属性侧重 ──

  describe('getFocusStats', () => {
    it('burn-heavy 返回的属性侧重包含智力和防御', () => {
      const stats = recommender.getFocusStats('burn-heavy');
      expect(stats).toContain('intelligence');
      expect(stats).toContain('defense');
    });

    it('physical 返回防御和速度', () => {
      const stats = recommender.getFocusStats('physical');
      expect(stats).toEqual(['defense', 'speed']);
    });

    it('boss 返回攻击和智力', () => {
      const stats = recommender.getFocusStats('boss');
      expect(stats).toEqual(['attack', 'intelligence']);
    });

    it('返回的是副本，修改不影响后续调用', () => {
      const stats1 = recommender.getFocusStats('physical');
      stats1.push('luck');

      const stats2 = recommender.getFocusStats('physical');
      expect(stats2).toEqual(['defense', 'speed']);
    });
  });

  // ── ISubsystem 接口 ──

  describe('ISubsystem 接口', () => {
    it('name 属性为 skillStrategyRecommender', () => {
      expect(recommender.name).toBe('skillStrategyRecommender');
    });

    it('init 不抛异常', () => {
      expect(() => {
        recommender.init({
          eventBus: { on: () => {}, off: () => {}, emit: () => {} },
          config: { get: () => null, getNumber: () => 0 },
          registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
        });
      }).not.toThrow();
    });

    it('update 不抛异常', () => {
      expect(() => recommender.update(16)).not.toThrow();
    });

    it('getState 返回策略列表', () => {
      const state = recommender.getState();
      expect(state).toEqual({ strategies: expect.arrayContaining(['burn-heavy', 'physical', 'boss']) });
    });

    it('reset 不抛异常且不影响策略推荐', () => {
      recommender.reset();
      const result = recommender.recommendStrategy('boss');
      expect(result.enemyType).toBe('boss');
    });
  });
});
