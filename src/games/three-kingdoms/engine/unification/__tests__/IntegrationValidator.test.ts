/**
 * IntegrationValidator 测试
 *
 * 覆盖：
 *   - ISubsystem 接口
 *   - 核心循环端到端验证 (#1)
 *   - 跨系统数据流验证 (#2)
 *   - 转生循环验证 (#3)
 *   - 离线全系统验证 (#4)
 *   - 全量验证
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IntegrationValidator } from '../IntegrationValidator';
import { DefaultSimulationDataProvider } from '../SimulationDataProvider';
import type { ISimulationDataProvider } from '../SimulationDataProvider';

function createMockDeps() {
  return {
    eventBus: { on: () => {}, emit: () => {}, off: () => {} },
    config: { get: () => null },
    registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
  };
}

/** 自定义模拟数据提供器 */
class MockProvider implements ISimulationDataProvider {
  getResourceProductionRate() { return 10; }
  getBuildingLevel() { return 5; }
  getBuildingUpgradeCost(_id: string, level: number) { return level * 100; }
  getHeroStats() { return { attack: 100, defense: 80, hp: 500 }; }
  getFormationPower() { return 2500; }
  getStageEnemyPower() { return 500; }
  getTechBonus() { return 0.1; }
  getReputation() { return 1500; }
  getRebirthMultiplier() { return 1.5; }
  getOfflineReward(seconds: number) { return seconds * 5; }
  getEquipmentBonus() { return 50; }
}

describe('IntegrationValidator', () => {
  let validator: IntegrationValidator;

  beforeEach(() => {
    validator = new IntegrationValidator();
    validator.init(createMockDeps() as any);
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(validator.name).toBe('integration-validator');
    });

    it('init 不应抛错', () => {
      expect(() => validator.init(createMockDeps() as any)).not.toThrow();
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
    });
  });

  describe('#1 核心循环端到端验证', () => {
    it('validateCoreLoop 应返回6个阶段', () => {
      const result = validator.validateCoreLoop();
      expect(Object.keys(result.phases)).toHaveLength(6);
    });

    it('所有阶段应有 stepId', () => {
      const result = validator.validateCoreLoop();
      for (const [key, step] of Object.entries(result.phases)) {
        expect(step.stepId).toBeTruthy();
        expect(step.description).toBeTruthy();
      }
    });

    it('使用默认数据提供器应全部通过', () => {
      const result = validator.validateCoreLoop();
      expect(result.allPassed).toBe(true);
    });

    it('totalDurationMs 应非负', () => {
      const result = validator.validateCoreLoop();
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('#2 跨系统数据流验证', () => {
    it('validateCrossSystemFlow 应返回7条检查', () => {
      const result = validator.validateCrossSystemFlow();
      expect(result.checks).toHaveLength(7);
    });

    it('每条检查应有 path 和 consistent', () => {
      const result = validator.validateCrossSystemFlow();
      for (const check of result.checks) {
        expect(check.path).toBeTruthy();
        expect(typeof check.consistent).toBe('boolean');
      }
    });

    it('默认数据应全部一致', () => {
      const result = validator.validateCrossSystemFlow();
      expect(result.allPassed).toBe(true);
    });
  });

  describe('#3 转生循环验证', () => {
    it('validateRebirthCycle 应返回5个阶段', () => {
      const result = validator.validateRebirthCycle();
      expect(Object.keys(result.phases)).toHaveLength(5);
    });

    it('应有前后快照', () => {
      const result = validator.validateRebirthCycle();
      expect(result.preRebirthSnapshot).toBeDefined();
      expect(result.postRebirthSnapshot).toBeDefined();
    });

    it('倍率应已验证', () => {
      const result = validator.validateRebirthCycle();
      expect(result.multiplierVerified).toBe(true);
    });
  });

  describe('#4 离线全系统验证', () => {
    it('validateOfflineFull 应返回5个子系统', () => {
      const result = validator.validateOfflineFull();
      expect(result.subsystems).toHaveLength(5);
    });

    it('每个子系统应有 correct 字段', () => {
      const result = validator.validateOfflineFull();
      for (const sub of result.subsystems) {
        expect(sub.subsystem).toBeTruthy();
        expect(typeof sub.correct).toBe('boolean');
      }
    });

    it('默认数据应全部通过', () => {
      const result = validator.validateOfflineFull();
      expect(result.allPassed).toBe(true);
    });
  });

  describe('全量验证', () => {
    it('validateAll 应生成完整报告', () => {
      const report = validator.validateAll();
      expect(report.id).toBeTruthy();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.coreLoop).toBeDefined();
      expect(report.crossSystemFlow).toBeDefined();
      expect(report.rebirthCycle).toBeDefined();
      expect(report.offlineFull).toBeDefined();
    });

    it('getLastReport 应返回最后一次报告', () => {
      const report = validator.validateAll();
      expect(validator.getLastReport()).toEqual(report);
    });

    it('使用自定义 Provider 应正常工作', () => {
      validator.setProvider(new MockProvider());
      const report = validator.validateAll();
      expect(report.overallPassed).toBe(true);
    });

    it('getProvider 应返回当前提供器', () => {
      const provider = validator.getProvider();
      expect(provider).toBeDefined();
    });
  });
});
