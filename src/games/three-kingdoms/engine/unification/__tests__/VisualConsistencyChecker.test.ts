/**
 * VisualConsistencyChecker 测试
 *
 * 覆盖：
 *   - ISubsystem 接口
 *   - 动画规范管理 (#14)
 *   - 配色规范管理 (#15)
 *   - 综合报告
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisualConsistencyChecker } from '../VisualConsistencyChecker';
import type { AnimationSpec, QualityColorDef, FunctionalColorDef, StatusColorDef } from '../../../core/unification';
import type { ISystemDeps } from '../../../core/types/subsystem';

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { on: () => {}, emit: () => {}, off: () => {} } as unknown as ISystemDeps['eventBus'],
    config: { get: () => null } as unknown as ISystemDeps['config'],
    registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} } as unknown as ISystemDeps['registry'],
  };
}

describe('VisualConsistencyChecker', () => {
  let checker: VisualConsistencyChecker;

  beforeEach(() => {
    checker = new VisualConsistencyChecker();
    checker.init(createMockDeps());
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(checker.name).toBe('visual-consistency-checker');
    });

    it('init 不应抛错', () => {
      expect(() => checker.init(createMockDeps())).not.toThrow();
    });

    it('update 不应抛错', () => {
      expect(() => checker.update(16)).not.toThrow();
    });

    it('reset 应清除所有数据', () => {
      checker.registerAnimation('a1', 'transition', 300, 'ease-out');
      checker.registerColor('c1', 'quality', 'color', '#ff0000', 'COMMON');
      checker.reset();
      expect(checker.getAnimationCount()).toBe(0);
      expect(checker.getColorCount()).toBe(0);
      expect(checker.getLastReport()).toBeNull();
    });

    it('getState 应返回状态', () => {
      const state = checker.getState();
      expect(state).toHaveProperty('lastReport');
      expect(state).toHaveProperty('specCount');
      expect(state).toHaveProperty('animationCount');
      expect(state).toHaveProperty('colorCount');
    });
  });

  describe('#14 动画规范管理', () => {
    it('应有默认动画规范', () => {
      const specs = checker.getAnimationSpecs();
      expect(specs.length).toBeGreaterThan(0);
    });

    it('addAnimationSpec 应添加规范', () => {
      const spec: AnimationSpec = {
        id: 'test-spec', category: 'transition', name: 'Test',
        standardDurationMs: 300, durationToleranceMs: 50, standardEasing: 'ease-out',
      };
      checker.addAnimationSpec(spec);
      expect(checker.getAnimationSpecs().some(s => s.id === 'test-spec')).toBe(true);
    });

    it('registerAnimation 应注册动画', () => {
      checker.registerAnimation('a1', 'transition', 300, 'ease-out');
      expect(checker.getAnimationCount()).toBe(1);
    });

    it('unregisterAnimation 应注销动画', () => {
      checker.registerAnimation('a1', 'transition', 300, 'ease-out');
      checker.unregisterAnimation('a1');
      expect(checker.getAnimationCount()).toBe(0);
    });

    it('auditAnimations 应返回报告', () => {
      const report = checker.auditAnimations();
      expect(report).toHaveProperty('results');
      expect(report).toHaveProperty('summary');
    });
  });

  describe('#15 配色规范管理', () => {
    it('应有默认品质色', () => {
      const colors = checker.getQualityColors();
      expect(colors.length).toBeGreaterThan(0);
    });

    it('应有默认阵营色', () => {
      const colors = checker.getFactionColors();
      expect(colors.length).toBeGreaterThan(0);
    });

    it('应有默认功能色', () => {
      const colors = checker.getFunctionalColors();
      expect(colors.length).toBeGreaterThan(0);
    });

    it('应有默认状态色', () => {
      const colors = checker.getStatusColors();
      expect(colors.length).toBeGreaterThan(0);
    });

    it('setQualityColors 应更新品质色', () => {
      const custom: QualityColorDef[] = [
        { quality: 'CUSTOM', primaryColor: '#ff0000', borderColor: '#cc0000', backgroundColor: '#330000', textColor: '#ffffff' },
      ];
      checker.setQualityColors(custom);
      expect(checker.getQualityColors()).toHaveLength(1);
    });

    it('setFunctionalColors 应更新功能色', () => {
      const custom: FunctionalColorDef[] = [
        { name: 'custom', standardColor: '#00ff00', description: 'Custom color' },
      ];
      checker.setFunctionalColors(custom);
      expect(checker.getFunctionalColors()).toHaveLength(1);
    });

    it('setStatusColors 应更新状态色', () => {
      const custom: StatusColorDef[] = [
        { status: 'custom', standardColor: '#0000ff', description: 'Custom status' },
      ];
      checker.setStatusColors(custom);
      expect(checker.getStatusColors()).toHaveLength(1);
    });

    it('registerColor 应注册颜色', () => {
      checker.registerColor('c1', 'quality', 'color', '#ff0000', 'COMMON');
      expect(checker.getColorCount()).toBe(1);
    });

    it('不应重复注册相同 ID 的颜色', () => {
      checker.registerColor('c1', 'quality', 'color', '#ff0000', 'COMMON');
      checker.registerColor('c1', 'quality', 'color', '#ff0000', 'COMMON');
      expect(checker.getColorCount()).toBe(1);
    });

    it('unregisterColor 应注销颜色', () => {
      checker.registerColor('c1', 'quality', 'color', '#ff0000', 'COMMON');
      checker.unregisterColor('c1');
      expect(checker.getColorCount()).toBe(0);
    });
  });

  describe('配色审查', () => {
    it('auditColors 无注册颜色应返回满分', () => {
      const report = checker.auditColors();
      expect(report.summary.consistencyScore).toBe(100);
    });

    it('auditColors 匹配颜色应通过', () => {
      const colors = checker.getQualityColors();
      if (colors.length > 0) {
        checker.registerColor('c1', 'quality', 'primaryColor', colors[0].primaryColor, colors[0].quality);
        const report = checker.auditColors();
        expect(report.results[0].passed).toBe(true);
      }
    });

    it('auditColors 不匹配颜色应失败', () => {
      checker.registerColor('c1', 'quality', 'primaryColor', '#000000', 'NONEXISTENT');
      const report = checker.auditColors();
      expect(report.results[0].passed).toBe(false);
    });

    it('报告应有 ID 和时间戳', () => {
      checker.registerColor('c1', 'quality', 'color', '#ff0000', 'COMMON');
      const report = checker.auditColors();
      expect(report.id).toBeTruthy();
      expect(report.timestamp).toBeGreaterThan(0);
    });
  });

  describe('综合报告', () => {
    it('generateReport 应返回综合报告', () => {
      const report = checker.generateReport();
      expect(report.id).toBeTruthy();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.animationReport).toBeDefined();
      expect(report.colorReport).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
    });

    it('getLastReport 应返回最后报告', () => {
      const report = checker.generateReport();
      expect(checker.getLastReport()).toEqual(report);
    });
  });
});
