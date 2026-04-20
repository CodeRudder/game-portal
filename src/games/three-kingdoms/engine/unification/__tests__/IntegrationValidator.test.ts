/**
 * IntegrationValidator 测试
 *
 * 覆盖全系统联调验证器的4大维度：
 *   - 核心循环端到端验证 (#1)
 *   - 跨系统数据流验证 (#2)
 *   - 转生循环验证 (#3)
 *   - 离线全系统验证 (#4)
 *   - ISubsystem 接口
 *   - 自定义数据提供器
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IntegrationValidator } from '../IntegrationValidator';
import type { ISimulationDataProvider } from '../SimulationDataProvider';

// ─────────────────────────────────────────────
// 自定义模拟数据提供器
// ─────────────────────────────────────────────

/** 全部通过的模拟提供器 */
class PassingMockProvider implements ISimulationDataProvider {
  getResourceProductionRate(resourceType: string): number {
    return resourceType === 'grain' ? 10 : 5;
  }
  getBuildingLevel(buildingId: string): number {
    return buildingId === 'farm' ? 5 : 3;
  }
  getBuildingUpgradeCost(buildingId: string, level: number): number {
    return level * 100;
  }
  getHeroStats(heroId: string): { attack: number; defense: number; hp: number } | null {
    if (heroId === 'hero_1') return { attack: 100, defense: 80, hp: 500 };
    return null;
  }
  getFormationPower(formationId: string): number {
    void formationId;
    return 2500;
  }
  getStageEnemyPower(chapter: number, stage: number): number {
    return chapter * 1000 + stage * 100;
  }
  getTechBonus(techId: string): number {
    return techId === 'tech_1' ? 0.15 : 0;
  }
  getReputation(): number {
    return 1500;
  }
  getRebirthMultiplier(): number {
    return 2.5;
  }
  getOfflineReward(seconds: number): number {
    return seconds * 5;
  }
  getEquipmentBonus(equipmentId: string): number {
    return equipmentId === 'equip_1' ? 50 : 0;
  }
}

/** 全部失败的模拟提供器 */
class FailingMockProvider implements ISimulationDataProvider {
  getResourceProductionRate(): number { return 0; }
  getBuildingLevel(): number { return -1; }
  getBuildingUpgradeCost(): number { return 0; }
  getHeroStats(): { attack: number; defense: number; hp: number } | null { return null; }
  getFormationPower(): number { return 0; }
  getStageEnemyPower(): number { return 0; }
  getTechBonus(): number { return 0; }
  getReputation(): number { return 0; }
  getRebirthMultiplier(): number { return 1.0; }
  getOfflineReward(): number { return 0; }
  getEquipmentBonus(): number { return 0; }
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('IntegrationValidator', () => {
  let validator: IntegrationValidator;

  beforeEach(() => {
    validator = new IntegrationValidator(new PassingMockProvider());
  });

  // ─────────────────────────────────────────────
  // ISubsystem 接口
  // ─────────────────────────────────────────────

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(validator.name).toBe('integration-validator');
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

    it('reset 应清除报告并重置提供器', () => {
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

  // ─────────────────────────────────────────────
  // 数据提供器
  // ─────────────────────────────────────────────

  describe('数据提供器', () => {
    it('setProvider 应替换数据提供器', () => {
      const newProvider = new FailingMockProvider();
      validator.setProvider(newProvider);
      expect(validator.getProvider()).toBe(newProvider);
    });

    it('getProvider 应返回当前提供器', () => {
      const provider = validator.getProvider();
      expect(provider).toBeDefined();
      expect(provider.getResourceProductionRate('grain')).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────
  // #1 核心循环端到端验证
  // ─────────────────────────────────────────────

  describe('#1 核心循环端到端验证', () => {
    it('应包含6个阶段', () => {
      const result = validator.validateCoreLoop();
      const phases = Object.keys(result.phases);
      expect(phases).toHaveLength(6);
    });

    it('应包含所有必要阶段 ID', () => {
      const result = validator.validateCoreLoop();
      const phaseIds = Object.values(result.phases).map(p => p.stepId);
      expect(phaseIds).toEqual(
        expect.arrayContaining(['CL-001', 'CL-002', 'CL-003', 'CL-004', 'CL-005', 'CL-006']),
      );
    });

    it('使用通过提供器时全部阶段应通过', () => {
      const result = validator.validateCoreLoop();
      expect(result.allPassed).toBe(true);
      for (const phase of Object.values(result.phases)) {
        expect(phase.passed).toBe(true);
      }
    });

    it('使用失败提供器时全部阶段应失败', () => {
      validator.setProvider(new FailingMockProvider());
      const result = validator.validateCoreLoop();
      expect(result.allPassed).toBe(false);
    });

    it('每个阶段应有描述和耗时', () => {
      const result = validator.validateCoreLoop();
      for (const phase of Object.values(result.phases)) {
        expect(phase.description).toBeTruthy();
        expect(phase.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('总耗时应为各阶段之和', () => {
      const result = validator.validateCoreLoop();
      const sumDurations = Object.values(result.phases).reduce((s, p) => s + p.durationMs, 0);
      expect(result.totalDurationMs).toBe(sumDurations);
    });
  });

  // ─────────────────────────────────────────────
  // #2 跨系统数据流验证
  // ─────────────────────────────────────────────

  describe('#2 跨系统数据流验证', () => {
    it('应包含7条数据流检查', () => {
      const result = validator.validateCrossSystemFlow();
      expect(result.checks).toHaveLength(7);
    });

    it('应包含所有数据流路径', () => {
      const result = validator.validateCrossSystemFlow();
      const paths = result.checks.map(c => c.path);
      expect(paths).toEqual(expect.arrayContaining([
        'resource_to_building',
        'building_to_hero',
        'hero_to_battle',
        'battle_to_equipment',
        'equipment_to_hero',
        'hero_to_tech',
        'all_to_reputation',
      ]));
    });

    it('使用通过提供器时全部检查应通过', () => {
      const result = validator.validateCrossSystemFlow();
      expect(result.allPassed).toBe(true);
      for (const check of result.checks) {
        expect(check.consistent).toBe(true);
      }
    });

    it('使用失败提供器时应有检查不通过', () => {
      validator.setProvider(new FailingMockProvider());
      const result = validator.validateCrossSystemFlow();
      expect(result.allPassed).toBe(false);
    });

    it('每条检查应有 sourceValue 和 targetValue', () => {
      const result = validator.validateCrossSystemFlow();
      for (const check of result.checks) {
        expect(check).toHaveProperty('sourceValue');
        expect(check).toHaveProperty('targetValue');
        expect(check).toHaveProperty('deviation');
      }
    });
  });

  // ─────────────────────────────────────────────
  // #3 转生循环验证
  // ─────────────────────────────────────────────

  describe('#3 转生循环验证', () => {
    it('应包含5个阶段', () => {
      const result = validator.validateRebirthCycle();
      const phases = Object.keys(result.phases);
      expect(phases).toHaveLength(5);
    });

    it('应包含所有必要阶段 ID', () => {
      const result = validator.validateRebirthCycle();
      const phaseIds = Object.values(result.phases).map(p => p.stepId);
      expect(phaseIds).toEqual(
        expect.arrayContaining(['RB-001', 'RB-002', 'RB-003', 'RB-004', 'RB-005']),
      );
    });

    it('使用通过提供器时全部阶段应通过', () => {
      const result = validator.validateRebirthCycle();
      expect(result.allPassed).toBe(true);
      expect(result.multiplierVerified).toBe(true);
    });

    it('使用失败提供器时转生验证应失败', () => {
      validator.setProvider(new FailingMockProvider());
      const result = validator.validateRebirthCycle();
      expect(result.allPassed).toBe(false);
      expect(result.multiplierVerified).toBe(false);
    });

    it('应有转生前后的快照', () => {
      const result = validator.validateRebirthCycle();
      expect(result.preRebirthSnapshot).toBeDefined();
      expect(result.postRebirthSnapshot).toBeDefined();
      expect(result.preRebirthSnapshot.reputation).toBeGreaterThan(0);
      expect(result.postRebirthSnapshot.reputation).toBe(0); // 重置
    });
  });

  // ─────────────────────────────────────────────
  // #4 离线全系统验证
  // ─────────────────────────────────────────────

  describe('#4 离线全系统验证', () => {
    it('应包含5个子系统', () => {
      const result = validator.validateOfflineFull();
      expect(result.subsystems).toHaveLength(5);
    });

    it('应包含所有离线子系统', () => {
      const result = validator.validateOfflineFull();
      const names = result.subsystems.map(s => s.subsystem);
      expect(names).toEqual(expect.arrayContaining([
        'offline_reward',
        'offline_event',
        'offline_activity',
        'offline_expedition',
        'offline_trade',
      ]));
    });

    it('使用通过提供器时全部子系统应通过', () => {
      const result = validator.validateOfflineFull();
      expect(result.allPassed).toBe(true);
    });

    it('使用失败提供器时离线验证应失败', () => {
      validator.setProvider(new FailingMockProvider());
      const result = validator.validateOfflineFull();
      expect(result.allPassed).toBe(false);
    });

    it('离线收益子系统应有偏差计算', () => {
      const result = validator.validateOfflineFull();
      const rewardSub = result.subsystems.find(s => s.subsystem === 'offline_reward');
      expect(rewardSub).toBeDefined();
      expect(rewardSub!.simulatedOfflineSeconds).toBeGreaterThan(0);
      expect(rewardSub!.deviationPercent).toBeGreaterThanOrEqual(0);
    });
  });

  // ─────────────────────────────────────────────
  // 全量验证
  // ─────────────────────────────────────────────

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

    it('使用通过提供器时整体应通过', () => {
      const report = validator.validateAll();
      expect(report.overallPassed).toBe(true);
    });

    it('使用失败提供器时整体应失败', () => {
      validator.setProvider(new FailingMockProvider());
      const report = validator.validateAll();
      expect(report.overallPassed).toBe(false);
    });

    it('getLastReport 应返回最后一次报告', () => {
      const report = validator.validateAll();
      expect(validator.getLastReport()).toEqual(report);
    });

    it('多次验证应覆盖之前的报告', () => {
      validator.validateAll();
      const firstReport = validator.getLastReport();
      validator.validateAll();
      const secondReport = validator.getLastReport();
      expect(secondReport!.id).not.toBe(firstReport!.id);
    });
  });
});
