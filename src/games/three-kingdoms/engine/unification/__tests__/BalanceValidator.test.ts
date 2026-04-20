/**
 * BalanceValidator 测试
 *
 * 覆盖5大平衡维度验证：
 *   - 资源产出平衡 (#5)
 *   - 武将战力平衡 (#6)
 *   - 战斗难度曲线 (#7)
 *   - 经济系统平衡 (#8)
 *   - 转生倍率平衡 (#9)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BalanceValidator } from '../BalanceValidator';
import type {
  ResourceBalanceConfig,
  BattleDifficultyConfig,
  RebirthBalanceConfig,
  HeroBaseStats,
} from '../../../../core/unification';

describe('BalanceValidator', () => {
  let validator: BalanceValidator;

  beforeEach(() => {
    validator = new BalanceValidator();
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(validator.name).toBe('balance-validator');
    });

    it('init 不应抛错', () => {
      const mockDeps = {
        eventBus: { on: () => {}, emit: () => {}, off: () => {} },
        config: { get: () => null },
        registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
      };
      expect(() => validator.init(mockDeps as any)).not.toThrow();
    });

    it('update 不应抛错', () => {
      expect(() => validator.update(16)).not.toThrow();
    });

    it('reset 应清除报告', () => {
      validator.validateAll();
      validator.reset();
      expect(validator.getLastReport()).toBeNull();
    });

    it('getState 应返回状态', () => {
      const state = validator.getState();
      expect(state).toHaveProperty('lastReport');
      expect(state.lastReport).toBeNull();
    });
  });

  describe('#5 资源产出平衡', () => {
    it('应验证4种资源', () => {
      const results = validator.validateResourceBalance();
      expect(results).toHaveLength(4);
      expect(results.map(r => r.resourceType)).toEqual(
        expect.arrayContaining(['grain', 'gold', 'troops', 'mandate']),
      );
    });

    it('应生成资源曲线数据点', () => {
      const results = validator.validateResourceBalance();
      for (const result of results) {
        expect(result.curvePoints.length).toBeGreaterThan(0);
        expect(result.isBalanced).toBeDefined();
        expect(result.entries.length).toBeGreaterThan(0);
      }
    });

    it('应检查产出/消耗比', () => {
      const results = validator.validateResourceBalance();
      for (const result of results) {
        const hasRatioCheck = result.entries.some(e =>
          e.featureId === 'BAL-RES-004' || e.featureId.startsWith('BAL-RES-'),
        );
        expect(hasRatioCheck).toBe(true);
      }
    });

    it('应支持自定义资源配置', () => {
      const customConfig: ResourceBalanceConfig = {
        resourceType: 'grain',
        earlyGameDailyRange: { min: 1000, max: 3000 },
        midGameDailyRange: { min: 10000, max: 30000 },
        lateGameDailyRange: { min: 100000, max: 300000 },
        productionConsumptionRatio: { min: 1.5, max: 2.5 },
        maxDeviationPercent: 20,
      };
      validator.setResourceConfigs([customConfig]);
      const configs = validator.getResourceConfigs();
      expect(configs).toHaveLength(1);
      expect(configs[0].resourceType).toBe('grain');
    });
  });

  describe('#6 武将战力平衡', () => {
    it('应验证5种品质武将', () => {
      const results = validator.validateHeroBalance();
      expect(results.length).toBeGreaterThanOrEqual(5);
    });

    it('应生成各等级战力数据', () => {
      const results = validator.validateHeroBalance();
      for (const result of results) {
        expect(result.powerPoints.length).toBeGreaterThan(0);
        expect(result.powerPoints[0].level).toBe(1);
      }
    });

    it('应检查品质间差距', () => {
      const results = validator.validateHeroBalance();
      const legendaryResult = results.find(r => r.quality === 'LEGENDARY');
      if (legendaryResult) {
        const ratioCheck = legendaryResult.entries.find(e => e.featureId === 'BAL-HERO-001');
        expect(ratioCheck).toBeDefined();
      }
    });

    it('应支持自定义武将属性', () => {
      const customStats: Record<string, HeroBaseStats> = {
        CUSTOM: { attack: 200, defense: 150, hp: 1000, speed: 100 },
      };
      validator.setHeroBaseStats(customStats);
      const results = validator.validateHeroBalance();
      const customResult = results.find(r => r.quality === 'CUSTOM');
      expect(customResult).toBeDefined();
      expect(customResult!.powerPoints[0].baseStats.attack).toBe(200);
    });
  });

  describe('#7 战斗难度曲线', () => {
    it('应生成关卡数据点', () => {
      const result = validator.validateBattleDifficulty();
      expect(result.stagePoints.length).toBeGreaterThan(0);
    });

    it('首关难度应较低', () => {
      const result = validator.validateBattleDifficulty();
      const first = result.stagePoints[0];
      expect(first.enemyPower).toBeLessThan(1500);
    });

    it('末关难度应较高', () => {
      const result = validator.validateBattleDifficulty();
      const last = result.stagePoints[result.stagePoints.length - 1];
      expect(last.enemyPower).toBeGreaterThan(10000);
    });

    it('BOSS 关应有倍率加成', () => {
      const result = validator.validateBattleDifficulty();
      // 每章最后一关是 BOSS
      const config = validator.getBattleConfig();
      const bossStages = result.stagePoints.filter(
        s => s.stageIndex === config.stagesPerChapter - 1,
      );
      expect(bossStages.length).toBeGreaterThan(0);
    });

    it('应检查难度递增平滑性', () => {
      const result = validator.validateBattleDifficulty();
      const spikeEntries = result.entries.filter(e => e.featureId === 'BAL-CBT-003');
      // 默认指数曲线不应有太大跳跃
      expect(spikeEntries.length).toBeLessThanOrEqual(5);
    });

    it('应支持自定义战斗配置', () => {
      const customConfig: BattleDifficultyConfig = {
        totalChapters: 3,
        stagesPerChapter: 5,
        firstStagePower: 100,
        lastStagePower: 50000,
        curveType: 'linear',
        growthFactor: 1.0,
        bossMultiplier: 2.0,
      };
      validator.setBattleConfig(customConfig);
      const result = validator.validateBattleDifficulty();
      expect(result.stagePoints).toHaveLength(15); // 3*5
    });
  });

  describe('#8 经济系统平衡', () => {
    it('应验证4种货币', () => {
      const result = validator.validateEconomy();
      expect(result.currencyFlows).toHaveLength(4);
      const currencies = result.currencyFlows.map(f => f.currency);
      expect(currencies).toEqual(expect.arrayContaining(['copper', 'mandate', 'recruit', 'ingot']));
    });

    it('应检查通胀率', () => {
      const result = validator.validateEconomy();
      const inflationEntries = result.entries.filter(e => e.featureId === 'BAL-ECO-003');
      expect(inflationEntries.length).toBe(4);
    });

    it('应计算净流量', () => {
      const result = validator.validateEconomy();
      for (const flow of result.currencyFlows) {
        expect(flow.netFlow).toBe(flow.dailyAcquisition - flow.dailyConsumption);
      }
    });
  });

  describe('#9 转生倍率平衡', () => {
    it('应生成20次转生数据', () => {
      const result = validator.validateRebirth();
      expect(result.multiplierPoints).toHaveLength(20);
    });

    it('第1次转生倍率应合理', () => {
      const result = validator.validateRebirth();
      const first = result.multiplierPoints[0];
      expect(first.multiplier).toBeGreaterThan(1.0);
      expect(first.multiplier).toBeLessThan(3.0);
    });

    it('应体现边际递减', () => {
      const result = validator.validateRebirth();
      const increments = result.multiplierPoints.map(p => p.increment);
      // 后期增量应小于前期
      const firstHalfAvg = increments.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
      const secondHalfAvg = increments.slice(10).reduce((a, b) => a + b, 0) / 10;
      expect(secondHalfAvg).toBeLessThanOrEqual(firstHalfAvg);
    });

    it('不应超过最大倍率', () => {
      const result = validator.validateRebirth();
      const config = validator.getRebirthConfig();
      const maxMult = Math.max(...result.multiplierPoints.map(p => p.multiplier));
      expect(maxMult).toBeLessThanOrEqual(config.maxMultiplier);
    });

    it('应支持自定义转生配置', () => {
      const customConfig: RebirthBalanceConfig = {
        maxRebirthCount: 10,
        baseMultiplier: 1.0,
        perRebirthIncrement: 0.2,
        maxMultiplier: 5.0,
        curveType: 'linear',
        decayFactor: 1.0,
      };
      validator.setRebirthConfig(customConfig);
      const result = validator.validateRebirth();
      expect(result.multiplierPoints).toHaveLength(10);
    });
  });

  describe('全量验证', () => {
    it('validateAll 应生成完整报告', () => {
      const report = validator.validateAll();
      expect(report.id).toBeTruthy();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.overallLevel).toMatch(/^(pass|warning|fail)$/);
      expect(report.entries.length).toBeGreaterThan(0);
      expect(report.summary.totalChecks).toBeGreaterThan(0);
    });

    it('报告应包含汇总统计', () => {
      const report = validator.validateAll();
      expect(report.summary.passCount + report.summary.warningCount + report.summary.failCount)
        .toBe(report.summary.totalChecks);
      expect(report.summary.passRate).toBeGreaterThanOrEqual(0);
      expect(report.summary.passRate).toBeLessThanOrEqual(1);
    });

    it('getLastReport 应返回最后一次报告', () => {
      const report = validator.validateAll();
      expect(validator.getLastReport()).toEqual(report);
    });
  });
});
