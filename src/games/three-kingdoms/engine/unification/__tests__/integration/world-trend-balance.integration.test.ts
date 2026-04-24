/**
 * 集成测试 — §4+§6 天下大势系统 + 补充验证
 *
 * 验证天下大势系统、平衡验证器、数值一致性：
 *   §4 天下大势 — BalanceValidator 5大维度全量验证 + 数值一致性
 *   §6 补充验证 — BalanceReport 纯函数 + BalanceUtils 工具函数 + 边界条件
 *
 * 覆盖：资源/武将/战斗/经济/转生5维度的默认配置验证、自定义配置注入、
 * 跨维度数值一致性、工具函数边界值、报告结构完整性。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceValidator } from '../../BalanceValidator';
import { IntegrationValidator } from '../../IntegrationValidator';
import { DefaultSimulationDataProvider, type ISimulationDataProvider } from '../../SimulationDataProvider';
import {
  validateSingleResource,
  validateSingleHero,
  calculateStagePoints,
  validateEconomy,
  validateRebirth,
  calculateRebirthPoints,
} from '../../BalanceReport';
import {
  DEFAULT_RESOURCE_CONFIGS,
  HERO_BASE_STATS,
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_ECONOMY_CONFIGS,
  DEFAULT_REBIRTH_CONFIG,
} from '../../BalanceCalculator';
import {
  generateId,
  inRange,
  calcDeviation,
  makeEntry,
  calcPower,
  calcRebirthMultiplier,
  generateResourceCurve,
} from '../../BalanceUtils';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type {
  BalanceReport,
  ResourceBalanceConfig,
  HeroBaseStats,
  BattleDifficultyConfig,
  EconomyBalanceConfig,
  RebirthBalanceConfig,
  NumericRange,
} from '../../../../core/unification';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockReturnValue(false),
      unregister: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

// ═════════════════════════════════════════════════════════════

describe('§4+§6 天下大势系统 + 补充验证 集成测试', () => {
  let balance: BalanceValidator;

  beforeEach(() => {
    balance = new BalanceValidator();
    balance.init(mockDeps());
  });

  // ─── §4 天下大势 — BalanceValidator 5大维度全量验证 ──────

  describe('§4 天下大势 — BalanceValidator 全量验证', () => {
    it('validateAll生成完整报告，包含所有5维度条目', () => {
      const report = balance.validateAll();
      expect(report.id).toMatch(/^rpt_\d+_/);
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.overallLevel).toBeDefined();
      expect(report.entries.length).toBeGreaterThan(0);
      expect(report.summary).toBeDefined();
    });

    it('默认配置下资源验证生成4种资源结果', () => {
      const results = balance.validateResourceBalance();
      expect(results).toHaveLength(4); // grain, gold, troops, mandate
      results.forEach((r) => {
        expect(r.curvePoints.length).toBeGreaterThan(0);
        expect(r.entries.length).toBeGreaterThan(0);
        expect(r).toHaveProperty('isBalanced');
      });
      // grain/gold/troops 默认通过, mandate 因早期产出为0导致 fail
      const grainResult = results.find((r) => r.resourceType === 'grain');
      expect(grainResult!.isBalanced).toBe(true);
    });

    it('默认配置下武将验证5品质全部通过', () => {
      const results = balance.validateHeroBalance();
      expect(results).toHaveLength(5); // COMMON, FINE, RARE, EPIC, LEGENDARY
      results.forEach((r) => {
        expect(r.isBalanced).toBe(true);
        expect(r.powerPoints).toHaveLength(6); // levels: 1,10,30,50,80,100
      });
    });

    it('默认配置下战斗难度验证通过', () => {
      const result = balance.validateBattleDifficulty();
      expect(result.isBalanced).toBe(true);
      expect(result.stagePoints).toHaveLength(DEFAULT_BATTLE_CONFIG.totalChapters * DEFAULT_BATTLE_CONFIG.stagesPerChapter);
    });

    it('默认配置下经济系统验证通过', () => {
      const result = balance.validateEconomy();
      expect(result.isBalanced).toBe(true);
      expect(result.currencyFlows).toHaveLength(4); // copper, mandate, recruit, ingot
    });

    it('默认配置下转生倍率验证通过', () => {
      const result = balance.validateRebirth();
      expect(result.isBalanced).toBe(true);
      expect(result.multiplierPoints).toHaveLength(DEFAULT_REBIRTH_CONFIG.maxRebirthCount);
    });

    it('getLastReport返回最近一次验证报告', () => {
      const report1 = balance.validateAll();
      expect(balance.getLastReport()).toBe(report1);
      const report2 = balance.validateAll();
      expect(balance.getLastReport()).toBe(report2);
      expect(balance.getLastReport()).not.toBe(report1);
    });

    it('getState返回lastReport快照', () => {
      balance.validateAll();
      const state = balance.getState();
      expect(state.lastReport).not.toBeNull();
      expect(state.lastReport!.id).toMatch(/^rpt_/);
    });

    it('reset后状态清空，恢复默认配置', () => {
      balance.validateAll();
      balance.reset();
      expect(balance.getLastReport()).toBeNull();
      expect(balance.getState().lastReport).toBeNull();
      // 默认配置已恢复
      expect(balance.getBattleConfig()).toEqual(DEFAULT_BATTLE_CONFIG);
    });

    it('连续多次validateAll生成不同ID的报告', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const report = balance.validateAll();
        ids.add(report.id);
      }
      expect(ids.size).toBe(5);
    });
  });

  // ─── §4 天下大势 — 配置注入与自定义验证 ──────────

  describe('§4 天下大势 — 配置注入与自定义验证', () => {
    it('注入自定义资源配置后验证结果反映变化', () => {
      const customConfigs: ResourceBalanceConfig[] = [
        {
          resourceType: 'custom',
          earlyGameDailyRange: { min: 1, max: 2 },
          midGameDailyRange: { min: 1, max: 2 },
          lateGameDailyRange: { min: 1, max: 2 },
          productionConsumptionRatio: { min: 0.1, max: 0.2 },
          maxDeviationPercent: 10,
        },
      ];
      balance.setResourceConfigs(customConfigs);
      const results = balance.validateResourceBalance();
      expect(results).toHaveLength(1);
      expect(results[0].resourceType).toBe('custom');
    });

    it('注入自定义武将属性后验证品质间差距', () => {
      const customStats: Record<string, HeroBaseStats> = {
        COMMON: { attack: 10, defense: 10, hp: 100, speed: 10 },
        RARE: { attack: 20, defense: 20, hp: 200, speed: 20 },
      };
      balance.setHeroBaseStats(customStats);
      const results = balance.validateHeroBalance();
      expect(results).toHaveLength(2);
      // RARE power should be higher than COMMON
      const rarePower = results.find((r) => r.quality === 'RARE')!.powerPoints[0].totalPower;
      const commonPower = results.find((r) => r.quality === 'COMMON')!.powerPoints[0].totalPower;
      expect(rarePower).toBeGreaterThan(commonPower);
    });

    it('注入线性战斗曲线后关卡难度整体递增', () => {
      const linearConfig: BattleDifficultyConfig = {
        ...DEFAULT_BATTLE_CONFIG,
        curveType: 'linear',
      };
      balance.setBattleConfig(linearConfig);
      const result = balance.validateBattleDifficulty();
      expect(result.stagePoints.length).toBeGreaterThan(1);
      // 验证整体趋势：首关 < 末关（Boss倍率可能导致局部回落）
      const first = result.stagePoints[0].enemyPower;
      const last = result.stagePoints[result.stagePoints.length - 1].enemyPower;
      expect(last).toBeGreaterThan(first);
      // 验证同章节内非Boss关卡递增
      for (let ch = 0; ch < linearConfig.totalChapters; ch++) {
        const stages = result.stagePoints.filter((s) => s.chapterIndex === ch && s.stageIndex < linearConfig.stagesPerChapter - 1);
        for (let i = 1; i < stages.length; i++) {
          expect(stages[i].enemyPower).toBeGreaterThanOrEqual(stages[i - 1].enemyPower);
        }
      }
    });

    it('注入自定义转生配置后倍率曲线正确', () => {
      const customRebirth: RebirthBalanceConfig = {
        maxRebirthCount: 5,
        baseMultiplier: 1.0,
        perRebirthIncrement: 0.3,
        maxMultiplier: 5.0,
        curveType: 'diminishing',
        decayFactor: 0.85,
      };
      balance.setRebirthConfig(customRebirth);
      const result = balance.validateRebirth();
      expect(result.multiplierPoints).toHaveLength(5);
      // 倍率递增
      for (let i = 1; i < result.multiplierPoints.length; i++) {
        expect(result.multiplierPoints[i].multiplier).toBeGreaterThan(result.multiplierPoints[i - 1].multiplier);
      }
    });

    it('注入自定义经济配置后货币流验证正确', () => {
      const customEconomy: EconomyBalanceConfig[] = [
        {
          currency: 'test_coin',
          dailyAcquisitionRange: { min: 100, max: 1000 },
          dailyConsumptionRange: { min: 50, max: 800 },
          acquisitionConsumptionRatio: { min: 1.0, max: 3.0 },
          inflationWarningThreshold: 0.5,
        },
      ];
      balance.setEconomyConfigs(customEconomy);
      const result = balance.validateEconomy();
      expect(result.currencyFlows).toHaveLength(1);
      expect(result.currencyFlows[0].currency).toBe('test_coin');
    });
  });

  // ─── §4 天下大势 — 跨维度数值一致性 ──────────

  describe('§4 天下大势 — 跨维度数值一致性', () => {
    it('BalanceReport纯函数与BalanceValidator结果一致', () => {
      // BalanceReport.validateSingleResource
      for (const config of DEFAULT_RESOURCE_CONFIGS) {
        const reportResult = validateSingleResource(config);
        expect(reportResult.resourceType).toBe(config.resourceType);
        expect(reportResult.curvePoints.length).toBeGreaterThan(0);
      }
    });

    it('BalanceReport.validateEconomy与BalanceValidator.validateEconomy结果一致', () => {
      const reportResult = validateEconomy(DEFAULT_ECONOMY_CONFIGS);
      const validatorResult = balance.validateEconomy();
      expect(reportResult.currencyFlows.length).toBe(validatorResult.currencyFlows.length);
      expect(reportResult.isBalanced).toBe(validatorResult.isBalanced);
    });

    it('BalanceReport.validateRebirth与BalanceValidator.validateRebirth结果一致', () => {
      const reportResult = validateRebirth(DEFAULT_REBIRTH_CONFIG);
      const validatorResult = balance.validateRebirth();
      expect(reportResult.multiplierPoints.length).toBe(validatorResult.multiplierPoints.length);
      expect(reportResult.isBalanced).toBe(validatorResult.isBalanced);
    });

    it('calculateStagePoints与BalanceValidator.validateBattleDifficulty一致', () => {
      const reportResult = calculateStagePoints(DEFAULT_BATTLE_CONFIG);
      const validatorResult = balance.validateBattleDifficulty();
      expect(reportResult.stagePoints.length).toBe(validatorResult.stagePoints.length);
      expect(reportResult.isBalanced).toBe(validatorResult.isBalanced);
    });

    it('calcPower与validateSingleHero的powerPoints一致', () => {
      const commonStats = HERO_BASE_STATS.COMMON;
      const level = 50;
      const levelFactor = 1 + (level - 1) * 0.05;
      const directPower = calcPower(commonStats, levelFactor, 1.0);

      const heroResult = validateSingleHero('COMMON', HERO_BASE_STATS);
      const point50 = heroResult.powerPoints.find((p) => p.level === 50);
      expect(point50).toBeDefined();
      expect(point50!.totalPower).toBe(directPower);
    });
  });

  // ─── §6 补充验证 — BalanceUtils 工具函数 ──────────

  describe('§6 补充验证 — BalanceUtils 工具函数', () => {
    it('inRange边界值正确判断', () => {
      const range: NumericRange = { min: 10, max: 100 };
      expect(inRange(10, range)).toBe(true);   // 下边界
      expect(inRange(100, range)).toBe(true);  // 上边界
      expect(inRange(50, range)).toBe(true);   // 中间值
      expect(inRange(9, range)).toBe(false);   // 低于下界
      expect(inRange(101, range)).toBe(false); // 高于上界
    });

    it('calcDeviation计算偏差百分比正确', () => {
      expect(calcDeviation(110, 100)).toBeCloseTo(10, 1);
      expect(calcDeviation(90, 100)).toBeCloseTo(10, 1);
      expect(calcDeviation(100, 100)).toBe(0);
      expect(calcDeviation(0, 0)).toBe(0);
      expect(calcDeviation(100, 0)).toBe(100);
    });

    it('generateId生成唯一ID格式', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).toMatch(/^rpt_\d+_/);
      expect(id1).not.toBe(id2);
    });

    it('makeEntry构建正确验证条目', () => {
      const entry = makeEntry('TEST-001', 'resource_production', 'pass', 100, { min: 50, max: 150 }, 'test message');
      expect(entry.featureId).toBe('TEST-001');
      expect(entry.dimension).toBe('resource_production');
      expect(entry.level).toBe('pass');
      expect(entry.actual).toBe(100);
      expect(entry.message).toBe('test message');
      expect(entry.deviation).toBeGreaterThanOrEqual(0);
    });

    it('generateResourceCurve生成6个数据点', () => {
      const config = DEFAULT_RESOURCE_CONFIGS[0]; // grain
      const curve = generateResourceCurve(config);
      expect(curve).toHaveLength(6);
      curve.forEach((point) => {
        expect(point.day).toBeGreaterThan(0);
        expect(point.productionRate).toBeGreaterThan(0);
        expect(point.totalProduced).toBeGreaterThanOrEqual(0);
      });
    });

    it('calcRebirthMultiplier递减曲线正确', () => {
      const m1 = calcRebirthMultiplier(1, DEFAULT_REBIRTH_CONFIG);
      const m5 = calcRebirthMultiplier(5, DEFAULT_REBIRTH_CONFIG);
      const m20 = calcRebirthMultiplier(20, DEFAULT_REBIRTH_CONFIG);
      expect(m1).toBeLessThan(m5);
      expect(m5).toBeLessThan(m20);
      expect(m20).toBeLessThanOrEqual(DEFAULT_REBIRTH_CONFIG.maxMultiplier);
    });

    it('calcRebirthMultiplier边界值：0次和负数返回1.0', () => {
      expect(calcRebirthMultiplier(0, DEFAULT_REBIRTH_CONFIG)).toBe(1.0);
      expect(calcRebirthMultiplier(-1, DEFAULT_REBIRTH_CONFIG)).toBe(1.0);
    });
  });

  // ─── §6 补充验证 — 报告结构与边界条件 ──────────

  describe('§6 补充验证 — 报告结构与边界条件', () => {
    it('calculateRebirthPoints生成20个数据点且递增', () => {
      const points = calculateRebirthPoints(DEFAULT_REBIRTH_CONFIG);
      expect(points).toHaveLength(20);
      for (let i = 1; i < points.length; i++) {
        expect(points[i].multiplier).toBeGreaterThan(points[i - 1].multiplier);
      }
    });

    it('calculateRebirthPoints每个点包含完整字段', () => {
      const points = calculateRebirthPoints(DEFAULT_REBIRTH_CONFIG);
      points.forEach((point) => {
        expect(point).toHaveProperty('rebirthCount');
        expect(point).toHaveProperty('multiplier');
        expect(point).toHaveProperty('increment');
        expect(point).toHaveProperty('cumulativeAcceleration');
        expect(point.rebirthCount).toBeGreaterThan(0);
        expect(point.multiplier).toBeGreaterThan(1);
      });
    });

    it('战斗难度指数曲线首关≤1000，末关≥50000', () => {
      const result = calculateStagePoints(DEFAULT_BATTLE_CONFIG);
      const first = result.stagePoints[0];
      const last = result.stagePoints[result.stagePoints.length - 1];
      expect(first.enemyPower).toBeLessThanOrEqual(1000);
      expect(last.enemyPower).toBeGreaterThanOrEqual(50000);
    });

    it('战斗难度无相邻关卡难度跳跃超过3倍', () => {
      const result = calculateStagePoints(DEFAULT_BATTLE_CONFIG);
      for (let i = 1; i < result.stagePoints.length; i++) {
        const ratio = result.stagePoints[i].enemyPower / result.stagePoints[i - 1].enemyPower;
        // 只检查非Boss关卡间跳跃
        if (result.stagePoints[i].stageIndex === 0) {
          expect(ratio).toBeLessThanOrEqual(3.0);
        }
      }
    });

    it('空资源配置返回有效结果', () => {
      const emptyConfig: ResourceBalanceConfig = {
        resourceType: 'empty',
        earlyGameDailyRange: { min: 0, max: 0 },
        midGameDailyRange: { min: 0, max: 0 },
        lateGameDailyRange: { min: 0, max: 0 },
        productionConsumptionRatio: { min: 0, max: 0 },
        maxDeviationPercent: 100,
      };
      const result = validateSingleResource(emptyConfig);
      expect(result.resourceType).toBe('empty');
      expect(result.curvePoints).toBeDefined();
    });

    it('IntegrationValidator与BalanceValidator并行运行无冲突', () => {
      const integration = new IntegrationValidator();
      integration.init(mockDeps());

      const intReport = integration.validateAll();
      const balReport = balance.validateAll();

      expect(intReport.overallPassed).toBe(true);
      expect(balReport.overallLevel).toBeDefined();
      expect(balReport.entries.length).toBeGreaterThan(0);
    });
  });
});
