/**
 * expedition-config 测试
 *
 * 覆盖：
 *   - 战斗配置常量
 *   - 掉落概率配置
 *   - 基础奖励表
 *   - 里程碑配置
 *   - createDefaultRegions / createDefaultRoutes
 */

import { describe, it, expect } from 'vitest';
import {
  EXPEDITION_MAX_TURNS,
  FORMATION_COUNTER_BONUS,
  DROP_RATES,
  BASE_REWARDS,
  FIRST_CLEAR_REWARD,
  POWER_MULTIPLIERS,
  MARCH_DURATION,
  MILESTONE_CONFIGS,
  CONSECUTIVE_FAILURE_LIMIT,
  REST_HEAL_PERCENT,
  createDefaultRegions,
  createDefaultRoutes,
} from '../expedition-config';
import { RouteDifficulty, MilestoneType } from '../../../core/expedition/expedition.types';

describe('expedition-config', () => {
  describe('战斗配置常量', () => {
    it('EXPEDITION_MAX_TURNS 应为正整数', () => {
      expect(EXPEDITION_MAX_TURNS).toBeGreaterThan(0);
    });

    it('FORMATION_COUNTER_BONUS 应在 0~1 范围', () => {
      expect(FORMATION_COUNTER_BONUS).toBeGreaterThan(0);
      expect(FORMATION_COUNTER_BONUS).toBeLessThanOrEqual(1);
    });

    it('CONSECUTIVE_FAILURE_LIMIT 应为正整数', () => {
      expect(CONSECUTIVE_FAILURE_LIMIT).toBeGreaterThan(0);
    });

    it('REST_HEAL_PERCENT 应在 0~1 范围', () => {
      expect(REST_HEAL_PERCENT).toBeGreaterThan(0);
      expect(REST_HEAL_PERCENT).toBeLessThanOrEqual(1);
    });
  });

  describe('DROP_RATES', () => {
    it('normal 节点掉率应低于 boss 节点', () => {
      expect(DROP_RATES.normal.equip_fragment).toBeLessThan(DROP_RATES.boss.equip_fragment);
      expect(DROP_RATES.normal.hero_fragment).toBeLessThan(DROP_RATES.boss.hero_fragment);
    });

    it('ambushBoss 掉率应最高', () => {
      expect(DROP_RATES.ambushBoss.equip_fragment).toBeGreaterThan(DROP_RATES.boss.equip_fragment);
    });

    it('normal 不应掉落稀有/传说物品', () => {
      expect(DROP_RATES.normal.rare_material).toBe(0);
      expect(DROP_RATES.normal.legendary_equip).toBe(0);
    });

    it('所有掉率应在 0~1 范围', () => {
      for (const category of ['normal', 'boss', 'ambushBoss'] as const) {
        for (const val of Object.values(DROP_RATES[category])) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('BASE_REWARDS', () => {
    it('应包含所有难度等级', () => {
      for (const diff of Object.values(RouteDifficulty)) {
        expect(BASE_REWARDS[diff]).toBeDefined();
        expect(BASE_REWARDS[diff].grain).toBeGreaterThan(0);
        expect(BASE_REWARDS[diff].gold).toBeGreaterThan(0);
      }
    });

    it('难度越高奖励越多', () => {
      expect(BASE_REWARDS[RouteDifficulty.HARD].grain).toBeGreaterThan(BASE_REWARDS[RouteDifficulty.NORMAL].grain);
      expect(BASE_REWARDS[RouteDifficulty.EPIC].grain).toBeGreaterThan(BASE_REWARDS[RouteDifficulty.HARD].grain);
    });
  });

  describe('POWER_MULTIPLIERS', () => {
    it('应包含所有难度等级', () => {
      for (const diff of Object.values(RouteDifficulty)) {
        expect(POWER_MULTIPLIERS[diff]).toBeGreaterThan(0);
      }
    });

    it('EASY 倍率应为 1.0', () => {
      expect(POWER_MULTIPLIERS[RouteDifficulty.EASY]).toBe(1.0);
    });

    it('难度越高倍率越大', () => {
      expect(POWER_MULTIPLIERS[RouteDifficulty.HARD]).toBeGreaterThan(POWER_MULTIPLIERS[RouteDifficulty.NORMAL]);
    });
  });

  describe('MILESTONE_CONFIGS', () => {
    it('应包含4个里程碑', () => {
      expect(MILESTONE_CONFIGS).toHaveLength(4);
    });

    it('应包含 FIRST_CLEAR 里程碑', () => {
      const first = MILESTONE_CONFIGS.find(m => m.type === MilestoneType.FIRST_CLEAR);
      expect(first).toBeDefined();
      expect(first!.requiredClears).toBe(1);
    });

    it('ALL_CLEARS 应使用特殊值 -1', () => {
      const all = MILESTONE_CONFIGS.find(m => m.type === MilestoneType.ALL_CLEARS);
      expect(all).toBeDefined();
      expect(all!.requiredClears).toBe(-1);
    });
  });

  describe('createDefaultRegions', () => {
    it('应创建3个区域', () => {
      const regions = createDefaultRegions();
      expect(Object.keys(regions)).toHaveLength(3);
    });

    it('区域应按 order 排序', () => {
      const regions = createDefaultRegions();
      const sorted = Object.values(regions).sort((a, b) => a.order - b.order);
      expect(sorted[0].id).toBe('region_hulao');
      expect(sorted[1].id).toBe('region_yishui');
      expect(sorted[2].id).toBe('region_luoyang');
    });
  });

  describe('createDefaultRoutes', () => {
    it('应创建10条路线', () => {
      const routes = createDefaultRoutes(1000);
      expect(Object.keys(routes)).toHaveLength(10);
    });

    it('每条路线应有完整的节点序列', () => {
      const routes = createDefaultRoutes(1000);
      for (const route of Object.values(routes)) {
        expect(route.startNodeId).toBeTruthy();
        expect(route.endNodeId).toBeTruthy();
        expect(Object.keys(route.nodes).length).toBeGreaterThan(0);
      }
    });

    it('奇袭路线应需要通关困难难度', () => {
      const routes = createDefaultRoutes(1000);
      const ambush = routes['route_luoyang_ambush'];
      expect(ambush).toBeDefined();
      expect(ambush.requireHardClear).toBe(true);
      expect(ambush.difficulty).toBe(RouteDifficulty.AMBUSH);
    });
  });
});
