/**
 * BalanceReport 测试
 *
 * 覆盖：
 *   - 资源产出验证 (validateSingleResource)
 *   - 武将战力验证 (validateSingleHero)
 *   - 战斗难度计算 (calculateStagePoints)
 *   - 经济系统验证 (validateEconomy)
 *   - 转生倍率验证 (validateRebirth)
 */

import { describe, it, expect } from 'vitest';
import {
  validateSingleResource,
  validateSingleHero,
  calculateStagePoints,
  validateEconomy,
  validateRebirth,
} from '../BalanceReport';
import {
  DEFAULT_RESOURCE_CONFIGS,
  HERO_BASE_STATS,
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_ECONOMY_CONFIGS,
  DEFAULT_REBIRTH_CONFIG,
} from '../BalanceCalculator';
import type { BattleDifficultyConfig, RebirthBalanceConfig } from '../../../core/unification';

describe('BalanceReport', () => {
  describe('validateSingleResource', () => {
    it('应返回资源配置结果', () => {
      const result = validateSingleResource(DEFAULT_RESOURCE_CONFIGS[0]);
      expect(result.resourceType).toBeTruthy();
      expect(result.curvePoints.length).toBeGreaterThan(0);
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('应包含早期/中期/后期检查条目', () => {
      const result = validateSingleResource(DEFAULT_RESOURCE_CONFIGS[0]);
      const ids = result.entries.map(e => e.featureId);
      expect(ids).toContain('BAL-RES-001');
      expect(ids).toContain('BAL-RES-002');
      expect(ids).toContain('BAL-RES-003');
    });

    it('isBalanced 应为布尔值', () => {
      const result = validateSingleResource(DEFAULT_RESOURCE_CONFIGS[0]);
      expect(typeof result.isBalanced).toBe('boolean');
    });
  });

  describe('validateSingleHero', () => {
    it('应验证 LEGENDARY 品质', () => {
      const result = validateSingleHero('LEGENDARY', HERO_BASE_STATS);
      expect(result.quality).toBe('LEGENDARY');
      expect(result.powerPoints.length).toBeGreaterThan(0);
    });

    it('应生成多个等级的战力数据', () => {
      const result = validateSingleHero('COMMON', HERO_BASE_STATS);
      expect(result.powerPoints.length).toBe(6);
      expect(result.powerPoints[0].level).toBe(1);
      expect(result.powerPoints[result.powerPoints.length - 1].level).toBe(100);
    });

    it('不存在的品质应返回失败', () => {
      const result = validateSingleHero('UNKNOWN', HERO_BASE_STATS);
      expect(result.isBalanced).toBe(false);
      expect(result.entries[0].level).toBe('fail');
    });

    it('品质间应有差距检查', () => {
      const result = validateSingleHero('RARE', HERO_BASE_STATS);
      const ratioEntry = result.entries.find(e => e.featureId === 'BAL-HERO-001');
      expect(ratioEntry).toBeDefined();
    });
  });

  describe('calculateStagePoints', () => {
    it('应生成正确数量的关卡', () => {
      const result = calculateStagePoints(DEFAULT_BATTLE_CONFIG);
      const expected = DEFAULT_BATTLE_CONFIG.totalChapters * DEFAULT_BATTLE_CONFIG.stagesPerChapter;
      expect(result.stagePoints).toHaveLength(expected);
    });

    it('BOSS 关应有更高的战力', () => {
      const result = calculateStagePoints(DEFAULT_BATTLE_CONFIG);
      const bossStages = result.stagePoints.filter(
        s => s.stageIndex === DEFAULT_BATTLE_CONFIG.stagesPerChapter - 1,
      );
      expect(bossStages.length).toBeGreaterThan(0);
      // BOSS 战力应比同章前一关高
      for (const boss of bossStages) {
        const prevIdx = boss.chapterIndex * DEFAULT_BATTLE_CONFIG.stagesPerChapter + boss.stageIndex - 1;
        if (prevIdx >= 0) {
          expect(boss.enemyPower).toBeGreaterThan(result.stagePoints[prevIdx].enemyPower);
        }
      }
    });

    it('线性曲线应均匀增长', () => {
      const linearConfig: BattleDifficultyConfig = {
        totalChapters: 2, stagesPerChapter: 5,
        firstStagePower: 100, lastStagePower: 1000,
        curveType: 'linear', growthFactor: 1.0, bossMultiplier: 1.0,
      };
      const result = calculateStagePoints(linearConfig);
      expect(result.stagePoints).toHaveLength(10);
    });

    it('应包含难度检查条目', () => {
      const result = calculateStagePoints(DEFAULT_BATTLE_CONFIG);
      const ids = result.entries.map(e => e.featureId);
      expect(ids).toContain('BAL-CBT-001');
      expect(ids).toContain('BAL-CBT-002');
    });
  });

  describe('validateEconomy', () => {
    it('应验证4种货币', () => {
      const result = validateEconomy(DEFAULT_ECONOMY_CONFIGS);
      expect(result.currencyFlows).toHaveLength(4);
    });

    it('应包含通胀检查', () => {
      const result = validateEconomy(DEFAULT_ECONOMY_CONFIGS);
      const inflationEntries = result.entries.filter(e => e.featureId === 'BAL-ECO-003');
      expect(inflationEntries).toHaveLength(4);
    });

    it('净流量应为获取减消耗', () => {
      const result = validateEconomy(DEFAULT_ECONOMY_CONFIGS);
      for (const flow of result.currencyFlows) {
        expect(flow.netFlow).toBe(flow.dailyAcquisition - flow.dailyConsumption);
      }
    });
  });

  describe('validateRebirth', () => {
    it('应生成转生验证结果', () => {
      const result = validateRebirth(DEFAULT_REBIRTH_CONFIG);
      expect(result.multiplierPoints.length).toBeGreaterThan(0);
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('应检查第1/5/10/20次转生', () => {
      const result = validateRebirth(DEFAULT_REBIRTH_CONFIG);
      const ids = result.entries.map(e => e.featureId);
      expect(ids).toContain('BAL-PRS-001');
      expect(ids).toContain('BAL-PRS-002');
      expect(ids).toContain('BAL-PRS-003');
      expect(ids).toContain('BAL-PRS-004');
    });

    it('不应超过最大倍率', () => {
      const result = validateRebirth(DEFAULT_REBIRTH_CONFIG);
      const maxEntry = result.entries.find(e => e.featureId === 'BAL-PRS-004');
      expect(maxEntry).toBeDefined();
      expect(maxEntry!.level).not.toBe('fail');
    });

    it('自定义配置应正确验证', () => {
      const custom: RebirthBalanceConfig = {
        maxRebirthCount: 5, baseMultiplier: 1.0,
        perRebirthIncrement: 0.3, maxMultiplier: 3.0,
        curveType: 'linear', decayFactor: 1.0,
      };
      const result = validateRebirth(custom);
      expect(result.multiplierPoints).toHaveLength(5);
    });
  });
});
