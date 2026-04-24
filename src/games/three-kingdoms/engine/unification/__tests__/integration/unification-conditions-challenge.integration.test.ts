/**
 * 集成测试 — §1~§3 统一系统 + 统一条件 + 终极挑战
 *
 * 验证 IntegrationValidator 全系统联调流程：
 *   §1 核心循环端到端验证 — 挂机→建筑→武将→战斗→科技→加速
 *   §2 跨系统数据流验证 — 资源↔建筑↔武将↔战斗↔装备↔科技↔声望
 *   §3 转生循环验证 — 条件检查→数据重置→倍率生效→加速重建→再推图
 *
 * 同时验证 BalanceValidator 数值系统与 IntegrationValidator 的联动。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntegrationValidator } from '../../IntegrationValidator';
import { BalanceValidator } from '../../BalanceValidator';
import {
  DefaultSimulationDataProvider,
  type ISimulationDataProvider,
} from '../../SimulationDataProvider';
import { BalanceReport, calculateStagePoints, validateRebirth } from '../../BalanceReport';
import {
  DEFAULT_RESOURCE_CONFIGS,
  HERO_BASE_STATS,
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_REBIRTH_CONFIG,
} from '../../BalanceCalculator';
import { calcPower, calcRebirthMultiplier, generateResourceCurve, inRange } from '../../BalanceUtils';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type {
  IntegrationReport,
  CoreLoopPhase,
  RebirthCyclePhase,
  OfflineSubsystem,
} from '../../../../core/unification';
import type { BattleDifficultyConfig, RebirthBalanceConfig } from '../../../../core/unification';

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

/** 自定义模拟数据提供器 — 全部通过 */
function createPassingProvider(): ISimulationDataProvider {
  return {
    getResourceProductionRate: (type: string) => type === 'grain' ? 10 : 5,
    getBuildingLevel: () => 5,
    getBuildingUpgradeCost: (_id: string, level: number) => level * 100,
    getHeroStats: () => ({ attack: 100, defense: 80, hp: 500 }),
    getFormationPower: () => 2500,
    getStageEnemyPower: () => 500,
    getTechBonus: () => 0.1,
    getReputation: () => 1500,
    getRebirthMultiplier: () => 1.88,
    getOfflineReward: (seconds: number) => seconds * 5,
    getEquipmentBonus: () => 50,
  };
}

/** 自定义模拟数据提供器 — 全部失败 */
function createFailingProvider(): ISimulationDataProvider {
  return {
    getResourceProductionRate: () => 0,
    getBuildingLevel: () => 0,
    getBuildingUpgradeCost: () => 0,
    getHeroStats: () => null,
    getFormationPower: () => 0,
    getStageEnemyPower: () => 0,
    getTechBonus: () => 0,
    getReputation: () => 0,
    getRebirthMultiplier: () => 1.0,
    getOfflineReward: () => 0,
    getEquipmentBonus: () => 0,
  };
}

// ═════════════════════════════════════════════════════════════

describe('§1~§3 统一系统 + 统一条件 + 终极挑战 集成测试', () => {
  let validator: IntegrationValidator;
  let balanceValidator: BalanceValidator;

  beforeEach(() => {
    validator = new IntegrationValidator();
    validator.init(mockDeps());
    balanceValidator = new BalanceValidator();
    balanceValidator.init(mockDeps());
  });

  // ─── §1 核心循环端到端验证 ──────────────────

  describe('§1 核心循环端到端验证', () => {
    it('默认数据提供器下核心循环全部通过', () => {
      const result = validator.validateCoreLoop();
      expect(result.allPassed).toBe(true);
      expect(result.phases.idle_production.passed).toBe(true);
      expect(result.phases.battle_push.passed).toBe(true);
    });

    it('核心循环6个阶段均有结果', () => {
      const result = validator.validateCoreLoop();
      const phases = Object.keys(result.phases) as CoreLoopPhase[];
      expect(phases).toHaveLength(6);
      phases.forEach((phase) => {
        expect(result.phases[phase]).toHaveProperty('stepId');
        expect(result.phases[phase]).toHaveProperty('passed');
        expect(result.phases[phase]).toHaveProperty('durationMs');
      });
    });

    it('挂机产出阶段验证资源速率大于0', () => {
      const result = validator.validateCoreLoop();
      const step = result.phases.idle_production;
      expect(step.passed).toBe(true);
      expect(step.stepId).toBe('CL-001');
    });

    it('建筑升级阶段验证消耗与等级关系', () => {
      const result = validator.validateCoreLoop();
      const step = result.phases.building_upgrade;
      expect(step.passed).toBe(true);
      expect(step.stepId).toBe('CL-002');
    });

    it('武将招募阶段验证武将属性存在', () => {
      const result = validator.validateCoreLoop();
      expect(result.phases.hero_recruit.passed).toBe(true);
      expect(result.phases.hero_recruit.stepId).toBe('CL-003');
    });

    it('资源加速阶段验证科技加成后产出提升', () => {
      const result = validator.validateCoreLoop();
      expect(result.phases.resource_boost.passed).toBe(true);
    });

    it('失败数据提供器下核心循环不通过', () => {
      validator.setProvider(createFailingProvider());
      const result = validator.validateCoreLoop();
      expect(result.allPassed).toBe(false);
    });
  });

  // ─── §2 跨系统数据流验证 ──────────────────

  describe('§2 跨系统数据流验证', () => {
    it('默认数据下跨系统数据流全部通过', () => {
      const result = validator.validateCrossSystemFlow();
      expect(result.allPassed).toBe(true);
    });

    it('跨系统数据流包含7条检查路径', () => {
      const result = validator.validateCrossSystemFlow();
      expect(result.checks).toHaveLength(7);
    });

    it('资源→建筑路径数据一致', () => {
      const result = validator.validateCrossSystemFlow();
      const check = result.checks.find((c) => c.path === 'resource_to_building');
      expect(check).toBeDefined();
      expect(check!.consistent).toBe(true);
    });

    it('武将→战斗路径战力关联正确', () => {
      const result = validator.validateCrossSystemFlow();
      const check = result.checks.find((c) => c.path === 'hero_to_battle');
      expect(check).toBeDefined();
      expect(check!.sourceValue).toBeGreaterThan(0);
      expect(check!.targetValue).toBeGreaterThan(0);
    });

    it('全系统→声望路径验证声望值有效', () => {
      const result = validator.validateCrossSystemFlow();
      const check = result.checks.find((c) => c.path === 'all_to_reputation');
      expect(check).toBeDefined();
      expect(check!.consistent).toBe(true);
      expect(check!.targetValue).toBeGreaterThan(0);
    });

    it('每条数据流路径都有偏差值', () => {
      const result = validator.validateCrossSystemFlow();
      result.checks.forEach((check) => {
        expect(check).toHaveProperty('deviation');
        expect(typeof check.deviation).toBe('number');
      });
    });
  });

  // ─── §3 转生循环验证 ──────────────────────

  describe('§3 转生循环验证', () => {
    it('默认数据下转生循环全部通过', () => {
      const result = validator.validateRebirthCycle();
      expect(result.allPassed).toBe(true);
    });

    it('转生循环包含5个阶段', () => {
      const result = validator.validateRebirthCycle();
      const phases = Object.keys(result.phases) as RebirthCyclePhase[];
      expect(phases).toHaveLength(5);
    });

    it('转生前后快照记录正确', () => {
      const result = validator.validateRebirthCycle();
      expect(result.preRebirthSnapshot.reputation).toBeGreaterThan(0);
      expect(result.postRebirthSnapshot.reputation).toBe(0);
      expect(result.preRebirthSnapshot.buildingLevel).toBeGreaterThanOrEqual(0);
    });

    it('转生倍率验证通过', () => {
      const result = validator.validateRebirthCycle();
      expect(result.multiplierVerified).toBe(true);
    });

    it('倍率生效阶段验证倍率大于1', () => {
      const result = validator.validateRebirthCycle();
      expect(result.phases.multiplier_apply.passed).toBe(true);
    });

    it('再次推图阶段验证加速效果', () => {
      const result = validator.validateRebirthCycle();
      expect(result.phases.re_push.passed).toBe(true);
    });
  });

  // ─── §1~§3 联动：全量验证 + BalanceValidator 交叉 ──────────

  describe('§1~§3 全量验证与数值交叉', () => {
    it('validateAll生成完整报告且全部通过', () => {
      const report = validator.validateAll();
      expect(report.overallPassed).toBe(true);
      expect(report.coreLoop.allPassed).toBe(true);
      expect(report.crossSystemFlow.allPassed).toBe(true);
      expect(report.rebirthCycle.allPassed).toBe(true);
      expect(report.offlineFull.allPassed).toBe(true);
    });

    it('报告包含唯一ID和时间戳', () => {
      const report = validator.validateAll();
      expect(report.id).toMatch(/^int_\d+_/);
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('getLastReport返回最近一次报告', () => {
      const report1 = validator.validateAll();
      expect(validator.getLastReport()).toBe(report1);
      const report2 = validator.validateAll();
      expect(validator.getLastReport()).toBe(report2);
      expect(validator.getLastReport()).not.toBe(report1);
    });

    it('reset清除报告并重置提供器', () => {
      validator.validateAll();
      validator.reset();
      expect(validator.getLastReport()).toBeNull();
    });

    it('BalanceValidator与IntegrationValidator转生倍率一致', () => {
      // IntegrationValidator 默认提供器返回 1.88
      const intResult = validator.validateRebirthCycle();
      // BalanceValidator 使用 DEFAULT_REBIRTH_CONFIG
      const balResult = balanceValidator.validateRebirth();
      // 两者均验证通过
      expect(intResult.allPassed).toBe(true);
      expect(balResult.isBalanced).toBe(true);
    });

    it('自定义提供器切换后验证结果变化', () => {
      const report1 = validator.validateAll();
      expect(report1.overallPassed).toBe(true);

      validator.setProvider(createFailingProvider());
      const report2 = validator.validateAll();
      expect(report2.overallPassed).toBe(false);
    });
  });
});
