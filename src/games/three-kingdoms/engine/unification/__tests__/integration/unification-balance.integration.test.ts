/**
 * 集成测试 — §3 统一系统 (v19.0)
 *
 * 覆盖：
 *   - 平衡校验 (资源/武将/战斗/经济/转生 5维度)
 *   - 交互审计 (步骤验证、错误收集)
 *   - 视觉规范 (水墨过渡、动画配置)
 *   - 集成验证 (全系统联调)
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/unification/__tests__/integration/unification-balance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceValidator } from '../../BalanceValidator';
import { makeStep } from '../../IntegrationValidatorHelper';
import { AnimationController } from '../../../settings/AnimationController';
import { GraphicsManager } from '../../../settings/GraphicsManager';
import { AudioManager } from '../../../settings/AudioManager';
import type { ISystemDeps } from '../../../../core/types';
import type {
  ResourceBalanceConfig,
  HeroBaseStats,
  BattleDifficultyConfig,
  EconomyBalanceConfig,
  RebirthBalanceConfig,
  ValidationEntry,
} from '../../../../core/unification';
import { GraphicsPreset, AudioChannel, INK_WASH_TRANSITION_DURATION } from '../../../../core/settings';

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
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createValidator(): BalanceValidator {
  const v = new BalanceValidator();
  v.init(mockDeps());
  return v;
}

// ═══════════════════════════════════════════════════════════════════════

describe('v19.0 §3 统一系统 集成测试', () => {

  // ═══════════════════════════════════════════════════════════════════
  // §3.1  平衡校验 — 5维度验证
  // ═══════════════════════════════════════════════════════════════════

  describe('§3.1 平衡校验 (5维度)', () => {

    it('validateAll 生成完整报告含 overallLevel', () => {
      const v = createValidator();
      const report = v.validateAll();
      expect(report).toBeDefined();
      expect(report.id).toBeTruthy();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(['pass', 'warning', 'fail']).toContain(report.overallLevel);
      expect(report.entries.length).toBeGreaterThan(0);
    });

    it('validateResourceBalance 返回资源产出验证结果', () => {
      const v = createValidator();
      const results = v.validateResourceBalance();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.resourceType).toBeTruthy();
        expect(r.curvePoints.length).toBeGreaterThan(0);
        expect(typeof r.isBalanced).toBe('boolean');
      }
    });

    it('validateHeroBalance 返回武将战力验证结果', () => {
      const v = createValidator();
      const results = v.validateHeroBalance();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.quality).toBeTruthy();
        expect(r.powerPoints.length).toBeGreaterThan(0);
      }
    });

    it('validateBattleDifficulty 返回战斗难度曲线', () => {
      const v = createValidator();
      const result = v.validateBattleDifficulty();
      expect(result).toBeDefined();
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('validateEconomy 返回经济系统验证', () => {
      const v = createValidator();
      const result = v.validateEconomy();
      expect(result).toBeDefined();
      expect(result.currencyFlows.length).toBeGreaterThan(0);
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('getLastReport 在 validateAll 后返回缓存报告', () => {
      const v = createValidator();
      expect(v.getLastReport()).toBeNull();
      v.validateAll();
      expect(v.getLastReport()).not.toBeNull();
      expect(v.getLastReport()!.id).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §3.2  交互审计 — IntegrationValidatorHelper
  // ═══════════════════════════════════════════════════════════════════

  describe('§3.2 交互审计', () => {

    it('makeStep: checkFn 返回 true → passed=true', () => {
      const step = makeStep('step-001', '测试步骤', () => true, 'ERR');
      expect(step.stepId).toBe('step-001');
      expect(step.description).toBe('测试步骤');
      expect(step.passed).toBe(true);
      expect(step.error).toBeUndefined();
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('makeStep: checkFn 返回 false → passed=false, 含错误前缀', () => {
      const step = makeStep('step-002', '失败步骤', () => false, 'PREFIX');
      expect(step.passed).toBe(false);
      expect(step.error).toContain('PREFIX');
    });

    it('makeStep: checkFn 抛异常 → passed=false, error 含异常信息', () => {
      const step = makeStep('step-003', '异常步骤', () => {
        throw new Error('boom');
      }, 'ERR');
      expect(step.passed).toBe(false);
      expect(step.error).toContain('boom');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §3.3  视觉规范 — 水墨过渡 + 动画配置
  // ═══════════════════════════════════════════════════════════════════

  describe('§3.3 视觉规范', () => {

    it('水墨过渡时长 INK_WASH_TRANSITION_DURATION = 600ms', () => {
      expect(INK_WASH_TRANSITION_DURATION).toBe(600);
    });

    it('AnimationController: 动画开关关闭时 playInkWashTransition 不执行', () => {
      const ctrl = new AnimationController();
      ctrl.init(mockDeps());
      const calls: string[] = [];
      ctrl.setPlayer({
        playTransition: () => { calls.push('playTransition'); },
        playStateAnimation: () => {},
        playFeedback: () => {},
        playInkWashTransition: () => { calls.push('inkWash'); },
        cancelAll: () => {},
      });
      // 关闭动画总开关
      ctrl.applySettings({
        enabled: false,
        transitions: {} as Record<string, unknown>,
        stateAnimations: {} as Record<string, unknown>,
        feedbackAnimations: {} as Record<string, unknown>,
      });
      ctrl.playInkWashTransition();
      // 播放器不应被调用（开关关闭）
      expect(calls).not.toContain('inkWash');
    });

    it('GraphicsManager: getPresetConfig 返回各预设完整配置', () => {
      const mgr = new GraphicsManager();
      mgr.init(mockDeps());
      for (const preset of [GraphicsPreset.Low, GraphicsPreset.Medium, GraphicsPreset.High, GraphicsPreset.Auto]) {
        const config = mgr.getPresetConfig(preset);
        expect(config).toBeDefined();
        expect(typeof config.particleEffects).toBe('boolean');
        expect(typeof config.realtimeShadows).toBe('boolean');
        expect(typeof config.inkWash).toBe('boolean');
        expect(typeof config.frameRateLimit).toBe('number');
        expect(typeof config.antiAliasing).toBe('boolean');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // §3.4  集成验证 — 跨系统联调
  // ═══════════════════════════════════════════════════════════════════

  describe('§3.4 集成验证 (跨系统联调)', () => {

    it('BalanceValidator + GraphicsManager + AudioManager 可同时初始化', () => {
      const deps = mockDeps();
      const bv = new BalanceValidator();
      const gm = new GraphicsManager();
      const am = new AudioManager();
      bv.init(deps);
      gm.init(deps);
      am.init(deps);
      expect(bv.getState()).toBeDefined();
      expect(gm.getState()).toBeDefined();
      expect(am.getState()).toBeDefined();
    });

    it('BalanceValidator reset 清除报告', () => {
      const v = createValidator();
      v.validateAll();
      expect(v.getLastReport()).not.toBeNull();
      v.reset();
      expect(v.getLastReport()).toBeNull();
    });

    it('GraphicsManager reset 恢复默认 Auto 预设', () => {
      const mgr = new GraphicsManager();
      mgr.init(mockDeps());
      mgr.applyPreset(GraphicsPreset.High);
      mgr.reset();
      expect(mgr.getSettings().preset).toBe(GraphicsPreset.Auto);
    });

    it('配置注入: setResourceConfigs 可自定义资源配置', () => {
      const v = createValidator();
      const customConfig: ResourceBalanceConfig[] = [{
        resourceType: 'gold',
        earlyGameDailyRange: { min: 100, max: 500 },
        midGameDailyRange: { min: 500, max: 2000 },
        lateGameDailyRange: { min: 2000, max: 10000 },
        productionConsumptionRatio: { min: 1.1, max: 2.0 },
      }];
      v.setResourceConfigs(customConfig);
      const results = v.validateResourceBalance();
      expect(results.length).toBe(1);
      expect(results[0].resourceType).toBe('gold');
    });

    it('配置注入: setHeroBaseStats 可自定义武将属性', () => {
      const v = createValidator();
      const customStats: Record<string, HeroBaseStats> = {
        LEGENDARY: { attack: 200, defense: 150, hp: 3000, speed: 120 },
      };
      v.setHeroBaseStats(customStats);
      const results = v.validateHeroBalance();
      expect(results.length).toBe(1);
      expect(results[0].quality).toBe('LEGENDARY');
    });

    it('全量验证 summary 包含 pass/warning/fail 计数', () => {
      const v = createValidator();
      const report = v.validateAll();
      expect(report.summary).toBeDefined();
      expect(typeof report.summary.totalChecks).toBe('number');
      expect(report.summary.totalChecks).toBeGreaterThan(0);
      expect(typeof report.summary.passCount).toBe('number');
      expect(typeof report.summary.warningCount).toBe('number');
      expect(typeof report.summary.failCount).toBe('number');
    });
  });
});
