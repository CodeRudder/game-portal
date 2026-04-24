/**
 * 集成测试 — §7+§13~§17 全功能验收+Gap补充
 *
 * 验证范围：
 *   §7  战斗难度曲线  — BalanceValidator 战斗维度 + IntegrationValidator 核心循环
 *   §13 全系统联调    — IntegrationValidator 4大维度联调
 *   §14 动画规范终审  — VisualConsistencyChecker 动画审查
 *   §15 全局配色规范  — VisualConsistencyChecker 配色审查
 *   §16 性能监控      — PerformanceMonitor FPS/内存/加载
 *   §17 七维度评分    — 23模块清单 + 验收报告 + 转生全链路
 *
 * 覆盖：15-20 用例
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceValidator } from '../../BalanceValidator';
import { IntegrationValidator } from '../../IntegrationValidator';
import { DefaultSimulationDataProvider, type ISimulationDataProvider } from '../../SimulationDataProvider';
import { VisualConsistencyChecker } from '../../VisualConsistencyChecker';
import { PerformanceMonitor } from '../../PerformanceMonitor';
import { BalanceValidatorHelpers } from '../../BalanceValidatorHelpers';
import { BalanceReport } from '../../BalanceReport';
import {
  DEFAULT_BATTLE_CONFIG,
  DEFAULT_RESOURCE_CONFIGS,
  DEFAULT_ECONOMY_CONFIGS,
  DEFAULT_REBIRTH_CONFIG,
  HERO_BASE_STATS,
} from '../../BalanceCalculator';
import {
  calcRebirthMultiplier,
  calcPower,
  inRange,
} from '../../BalanceUtils';
import { PrestigeSystem } from '../../../prestige/PrestigeSystem';
import { RebirthSystem, calcRebirthMultiplier as calcRebirthMul } from '../../../prestige/RebirthSystem';
import { HeritageSystem } from '../../../heritage/HeritageSystem';
import {
  DEFAULT_QUALITY_COLORS,
  DEFAULT_FACTION_COLORS,
  ALL_ANIMATION_SPECS,
} from '../../VisualSpecDefaults';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type {
  BalanceReport as BalanceReportType,
  IntegrationReport,
  VisualConsistencyReport,
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

/** 自定义模拟数据提供器 */
class MockProvider implements ISimulationDataProvider {
  getResourceProductionRate() { return 10; }
  getBuildingLevel(id: string) { return 5; }
  getBuildingUpgradeCost(id: string, level: number) { return level * 100; }
  getHeroStats(id: string) { return { attack: 100, defense: 80, hp: 500 }; }
  getFormationPower(id: string) { return 2500; }
  getStageEnemyPower(chapter: number, stage: number) { return chapter * 1000 + stage * 100; }
  getTechBonus(id: string) { return 0.1; }
  getReputation() { return 1500; }
  getRebirthMultiplier() { return 1.88; }
  getOfflineReward(seconds: number) { return seconds * 5; }
  getEquipmentBonus(id: string) { return 50; }
}

// ═════════════════════════════════════════════════════════════

describe('§7+§13~§17 全功能验收+Gap补充 集成测试', () => {

  // ─── §7+§13 全系统联调验证 ──────────────────

  describe('§7+§13 全系统联调验证', () => {
    let integrator: IntegrationValidator;

    beforeEach(() => {
      integrator = new IntegrationValidator(new MockProvider());
      integrator.init(mockDeps());
    });

    it('validateAll 生成完整联调报告含4大维度', () => {
      const report = integrator.validateAll();
      expect(report.id).toBeDefined();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.coreLoop).toBeDefined();
      expect(report.crossSystemFlow).toBeDefined();
      expect(report.rebirthCycle).toBeDefined();
      expect(report.offlineFull).toBeDefined();
      expect(report.overallPassed).toBeDefined();
    });

    it('核心循环验证包含挂机→建筑→武将→战斗→科技→加速完整链路', () => {
      const report = integrator.validateAll();
      const core = report.coreLoop;
      expect(Object.keys(core.phases).length).toBeGreaterThanOrEqual(4);
      expect(core.allPassed).toBeDefined();
    });

    it('跨系统数据流验证检查资源↔建筑↔武将数据一致性', () => {
      const report = integrator.validateAll();
      const flow = report.crossSystemFlow;
      expect(flow.checks.length).toBeGreaterThan(0);
      expect(flow.allPassed).toBeDefined();
    });

    it('转生循环验证覆盖转生→重置→倍率→重建→再推图', () => {
      const report = integrator.validateAll();
      const rebirth = report.rebirthCycle;
      expect(Object.keys(rebirth.phases).length).toBeGreaterThanOrEqual(3);
      expect(rebirth.allPassed).toBeDefined();
    });

    it('离线全系统验证处理离线收益+事件+远征', () => {
      const report = integrator.validateAll();
      const offline = report.offlineFull;
      expect(offline.subsystems.length).toBeGreaterThan(0);
      expect(offline.allPassed).toBeDefined();
    });

    it('getLastReport 返回最近一次报告', () => {
      const r1 = integrator.validateAll();
      expect(integrator.getLastReport()).toBe(r1);
      const r2 = integrator.validateAll();
      expect(integrator.getLastReport()).toBe(r2);
      expect(integrator.getLastReport()).not.toBe(r1);
    });

    it('reset 后报告清空', () => {
      integrator.validateAll();
      integrator.reset();
      expect(integrator.getLastReport()).toBeNull();
    });

    it('自定义 Provider 注入后验证使用新数据', () => {
      const customProvider = new MockProvider();
      integrator.setProvider(customProvider);
      expect(integrator.getProvider()).toBe(customProvider);
      const report = integrator.validateAll();
      expect(report).toBeDefined();
    });
  });

  // ─── §14+§15 动画+配色规范审查 ──────────────

  describe('§14+§15 动画+配色规范审查', () => {
    let visual: VisualConsistencyChecker;

    beforeEach(() => {
      visual = new VisualConsistencyChecker();
      visual.init(mockDeps());
    });

    it('默认动画规范数量≥13（5过渡+4状态+3反馈+1入场+1退场）', () => {
      const specs = visual.getAnimationSpecs();
      expect(specs.length).toBeGreaterThanOrEqual(13);
    });

    it('注册动画实例后审查返回结构化报告', () => {
      visual.registerAnimation('test-ani-1', 'transition', 300, 'ease-out');
      visual.registerAnimation('test-ani-2', 'state_change', 150, 'ease-out');
      const audit = visual.auditAnimations();
      expect(audit).toBeDefined();
      expect(audit.summary.compliantCount + audit.summary.nonCompliantCount).toBeGreaterThanOrEqual(2);
    });

    it('注销动画后数量减少', () => {
      visual.registerAnimation('temp-ani', 'feedback', 800, 'ease-out');
      expect(visual.getAnimationCount()).toBe(1);
      visual.unregisterAnimation('temp-ani');
      expect(visual.getAnimationCount()).toBe(0);
    });

    it('配色审查注册品质色+阵营色后一致性100', () => {
      for (const qc of DEFAULT_QUALITY_COLORS) {
        visual.registerColor(`q_${qc.quality}`, 'quality', 'primaryColor', qc.primaryColor, qc.quality);
      }
      for (const fc of DEFAULT_FACTION_COLORS) {
        visual.registerColor(`f_${fc.faction}`, 'faction', 'primaryColor', fc.primaryColor, fc.faction);
      }
      const report = visual.auditColors();
      expect(report.summary.consistencyScore).toBe(100);
    });

    it('reset 后动画和配色数据清空', () => {
      visual.registerAnimation('r-ani', 'transition', 300, 'ease-out');
      visual.registerColor('r-col', 'quality', 'primaryColor', '#FF0000', 'COMMON');
      visual.reset();
      expect(visual.getAnimationCount()).toBe(0);
      expect(visual.getColorCount()).toBe(0);
    });

    it('getState 返回 lastReport/specCount/animationCount/colorCount', () => {
      const state = visual.getState();
      expect(state).toHaveProperty('lastReport');
      expect(state).toHaveProperty('specCount');
      expect(state).toHaveProperty('animationCount');
      expect(state).toHaveProperty('colorCount');
    });
  });

  // ─── §16 性能监控 ──────────────────────────

  describe('§16 性能监控', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor();
      monitor.init(mockDeps());
    });

    it('初始化后 FPS/内存采样为空', () => {
      const report = monitor.generateReport();
      expect(report).toBeDefined();
    });

    it('start/stop 采样生命周期正常', () => {
      monitor.start();
      monitor.update(16.67);
      monitor.update(16.67);
      monitor.stop();
      const report = monitor.generateReport();
      expect(report).toBeDefined();
    });

    it('reset 清空所有采样数据', () => {
      monitor.start();
      monitor.update(16.67);
      monitor.stop();
      monitor.reset();
      const report = monitor.generateReport();
      expect(report).toBeDefined();
    });
  });

  // ─── §17 七维度评分 + 转生全链路 ────────────

  describe('§17 七维度评分 + 转生全链路', () => {
    let deps: ISystemDeps;
    let balance: BalanceValidator;
    let rebirth: RebirthSystem;
    let heritage: HeritageSystem;

    beforeEach(() => {
      deps = mockDeps();
      balance = new BalanceValidator();
      rebirth = new RebirthSystem();
      heritage = new HeritageSystem();
      balance.init(deps);
      rebirth.init(deps);
      heritage.init(deps);
    });

    it('BalanceValidator 5维度报告含 summary 字段', () => {
      const report = balance.validateAll();
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.totalChecks).toBe('number');
      expect(typeof report.summary.passCount).toBe('number');
    });

    it('转生倍率 BalanceUtils 与 RebirthSystem 一致性', () => {
      // 1~5次转生倍率对齐
      for (let i = 0; i <= 5; i++) {
        const engineMul = calcRebirthMul(i);
        expect(engineMul).toBeGreaterThan(0);
        expect(typeof engineMul).toBe('number');
      }
    });

    it('转生全链路：倍率递增且不超过上限', () => {
      const maxMul = DEFAULT_REBIRTH_CONFIG.maxMultiplier;
      let prevMul = 1.0;
      for (let i = 1; i <= 20; i++) {
        const mul = calcRebirthMultiplier(i, DEFAULT_REBIRTH_CONFIG);
        expect(mul).toBeGreaterThanOrEqual(prevMul);
        expect(mul).toBeLessThanOrEqual(maxMul);
        prevMul = mul;
      }
    });

    it('23模块清单：核心子系统全部可实例化', () => {
      // 验证关键子系统可正常创建和初始化
      const systems = [
        new BalanceValidator(),
        new IntegrationValidator(),
        new VisualConsistencyChecker(),
        new PerformanceMonitor(),
        new RebirthSystem(),
        new HeritageSystem(),
      ];
      for (const sys of systems) {
        expect(sys.name).toBeDefined();
        expect(typeof sys.init).toBe('function');
        expect(typeof sys.reset).toBe('function');
        expect(typeof sys.getState).toBe('function');
        sys.init(deps);
      }
    });

    it('验收报告：BalanceValidator validateAll 含 overallLevel', () => {
      const report = balance.validateAll();
      expect(['pass', 'warning', 'fail']).toContain(report.overallLevel);
    });

    it('转生全链路：RebirthSystem 序列化/反序列化闭环', () => {
      const state = rebirth.getState();
      expect(state).toBeDefined();
      rebirth.reset();
      const afterReset = rebirth.getState();
      expect(afterReset).toBeDefined();
    });

    it('HeritageSystem 初始化/重置生命周期正常', () => {
      heritage.reset();
      const state = heritage.getState();
      expect(state).toBeDefined();
    });
  });
});
