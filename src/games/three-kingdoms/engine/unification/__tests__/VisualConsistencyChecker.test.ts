/**
 * VisualConsistencyChecker 测试
 *
 * 覆盖视觉一致性检查器的所有功能：
 *   - ISubsystem 接口
 *   - 动画规范管理 (#14)
 *   - 配色规范管理 (#15)
 *   - 综合报告生成
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisualConsistencyChecker } from '../VisualConsistencyChecker';
import type { AnimationSpec, QualityColorDef, FactionColorDef, FunctionalColorDef, StatusColorDef } from '../../../../core/unification';

describe('VisualConsistencyChecker', () => {
  let checker: VisualConsistencyChecker;

  beforeEach(() => {
    checker = new VisualConsistencyChecker();
  });

  // ─────────────────────────────────────────────
  // ISubsystem 接口
  // ─────────────────────────────────────────────

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(checker.name).toBe('visual-consistency-checker');
    });

    it('init 不应抛错', () => {
      const mockDeps = {
        eventBus: { on: () => {}, emit: () => {}, off: () => {} },
        config: { get: () => null },
        registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
      };
      expect(() => checker.init(mockDeps as any)).not.toThrow();
    });

    it('update 不应抛错', () => {
      expect(() => checker.update(16)).not.toThrow();
    });

    it('reset 应清除所有数据', () => {
      checker.registerAnimation('anim_1', 'transition', 300, 'ease-out');
      checker.registerColor('clr_1', 'quality', 'borderColor', '#9E9E9E', 'COMMON');
      checker.generateReport();
      checker.reset();

      const state = checker.getState();
      expect(state.lastReport).toBeNull();
      expect(state.animationCount).toBe(0);
      expect(state.colorCount).toBe(0);
    });

    it('getState 应返回正确状态', () => {
      const state = checker.getState();
      expect(state).toHaveProperty('lastReport');
      expect(state).toHaveProperty('specCount');
      expect(state).toHaveProperty('animationCount');
      expect(state).toHaveProperty('colorCount');
    });
  });

  // ─────────────────────────────────────────────
  // 动画规范管理 (#14)
  // ─────────────────────────────────────────────

  describe('#14 动画规范管理', () => {
    it('默认应包含所有动画规范', () => {
      const specs = checker.getAnimationSpecs();
      expect(specs.length).toBeGreaterThan(0);
    });

    it('addAnimationSpec 应添加规范', () => {
      const initialCount = checker.getAnimationSpecs().length;
      const spec: AnimationSpec = {
        id: 'ANI-CUSTOM-001', category: 'transition',
        standardDurationMs: 400, durationToleranceMs: 50,
        standardEasing: 'ease', standardDelayMs: 0,
      };
      checker.addAnimationSpec(spec);
      expect(checker.getAnimationSpecs()).toHaveLength(initialCount + 1);
    });

    it('registerAnimation 应注册动画实例', () => {
      checker.registerAnimation('anim_1', 'transition', 300, 'ease-out');
      expect(checker.getAnimationCount()).toBe(1);
    });

    it('重复注册同一 ID 应忽略', () => {
      checker.registerAnimation('anim_1', 'transition', 300, 'ease-out');
      checker.registerAnimation('anim_1', 'transition', 300, 'ease-out');
      expect(checker.getAnimationCount()).toBe(1);
    });

    it('unregisterAnimation 应注销动画', () => {
      checker.registerAnimation('anim_1', 'transition', 300, 'ease-out');
      checker.unregisterAnimation('anim_1');
      expect(checker.getAnimationCount()).toBe(0);
    });

    describe('auditAnimations', () => {
      it('无动画时应返回空报告', () => {
        const report = checker.auditAnimations();
        expect(report.totalAnimations).toBe(0);
        expect(report.results).toHaveLength(0);
        expect(report.summary.complianceRate).toBe(1);
      });

      it('合规动画应通过检查', () => {
        // ANI-T-001: transition, 300ms ±50, ease-out
        checker.registerAnimation('anim_ok', 'transition', 300, 'ease-out', 'ANI-T-001');
        const report = checker.auditAnimations();
        expect(report.results).toHaveLength(1);
        expect(report.results[0].isCompliant).toBe(true);
        expect(report.results[0].deviationDescription).toBe('Compliant');
      });

      it('不合规动画应标记偏差', () => {
        // ANI-T-001: transition, 300ms ±50, ease-out → 用 500ms 应不合规
        checker.registerAnimation('anim_bad', 'transition', 500, 'ease-in', 'ANI-T-001');
        const report = checker.auditAnimations();
        expect(report.results[0].isCompliant).toBe(false);
        expect(report.results[0].deviationDescription).toContain('Duration');
        expect(report.results[0].deviationDescription).toContain('Easing');
      });

      it('无匹配规范时应标记不合规', () => {
        checker.registerAnimation('anim_no_spec', 'transition' as any, 300, 'ease-out', 'NONEXISTENT-SPEC');
        const report = checker.auditAnimations();
        expect(report.results[0].isCompliant).toBe(false);
        expect(report.results[0].deviationDescription).toContain('No matching spec');
      });

      it('按 category 自动匹配规范', () => {
        // 不指定 specId，按 category 匹配第一个 transition 规范
        checker.registerAnimation('anim_auto', 'transition', 300, 'ease-out');
        const report = checker.auditAnimations();
        expect(report.results[0].isCompliant).toBe(true);
      });

      it('应正确计算合规率', () => {
        checker.registerAnimation('a1', 'transition', 300, 'ease-out', 'ANI-T-001');
        checker.registerAnimation('a2', 'transition', 500, 'ease-in', 'ANI-T-001');
        const report = checker.auditAnimations();
        expect(report.summary.complianceRate).toBe(0.5);
        expect(report.summary.compliantCount).toBe(1);
        expect(report.summary.nonCompliantCount).toBe(1);
      });

      it('报告应有唯一 ID 和时间戳', () => {
        checker.registerAnimation('a1', 'transition', 300, 'ease-out');
        const report = checker.auditAnimations();
        expect(report.id).toBeTruthy();
        expect(report.timestamp).toBeGreaterThan(0);
      });
    });
  });

  // ─────────────────────────────────────────────
  // 配色规范管理 (#15)
  // ─────────────────────────────────────────────

  describe('#15 配色规范管理', () => {
    it('默认应包含品质色', () => {
      const colors = checker.getQualityColors();
      expect(colors.length).toBeGreaterThan(0);
    });

    it('默认应包含阵营色', () => {
      const colors = checker.getFactionColors();
      expect(colors.length).toBeGreaterThan(0);
    });

    it('默认应包含功能色', () => {
      const colors = checker.getFunctionalColors();
      expect(colors.length).toBeGreaterThan(0);
    });

    it('默认应包含状态色', () => {
      const colors = checker.getStatusColors();
      expect(colors.length).toBeGreaterThan(0);
    });

    it('setQualityColors 应替换品质色', () => {
      const custom: QualityColorDef[] = [
        { quality: 'CUSTOM', primaryColor: '#FF0000', borderColor: '#CC0000', backgroundColor: '#FFE0E0', textColor: '#800000' },
      ];
      checker.setQualityColors(custom);
      expect(checker.getQualityColors()).toHaveLength(1);
    });

    it('setFactionColors 应替换阵营色', () => {
      const custom: FactionColorDef[] = [
        { faction: 'test', primaryColor: '#000', secondaryColor: '#111', backgroundColor: '#222' },
      ];
      checker.setFactionColors(custom);
      expect(checker.getFactionColors()).toHaveLength(1);
    });

    it('setFunctionalColors 应替换功能色', () => {
      const custom: FunctionalColorDef[] = [
        { name: 'test', description: 'test', standardColor: '#000', hueTolerance: 10 },
      ];
      checker.setFunctionalColors(custom);
      expect(checker.getFunctionalColors()).toHaveLength(1);
    });

    it('setStatusColors 应替换状态色', () => {
      const custom: StatusColorDef[] = [
        { status: 'test', standardColor: '#000', usage: 'test' },
      ];
      checker.setStatusColors(custom);
      expect(checker.getStatusColors()).toHaveLength(1);
    });

    describe('auditColors', () => {
      it('无颜色注册时应返回空结果', () => {
        const report = checker.auditColors();
        expect(report.results).toHaveLength(0);
        expect(report.summary.consistencyScore).toBe(100);
      });

      it('匹配的品质色应通过检查', () => {
        checker.registerColor('clr_1', 'quality', 'borderColor', '#757575', 'COMMON');
        const report = checker.auditColors();
        expect(report.results).toHaveLength(1);
        expect(report.results[0].passed).toBe(true);
        expect(report.results[0].colorDifference).toBe(0);
      });

      it('不匹配的品质色应不通过', () => {
        checker.registerColor('clr_1', 'quality', 'borderColor', '#FF0000', 'COMMON');
        const report = checker.auditColors();
        expect(report.results[0].passed).toBe(false);
        expect(report.results[0].colorDifference).toBeGreaterThan(5);
      });

      it('未找到参考色时应标记失败', () => {
        checker.registerColor('clr_1', 'quality', 'borderColor', '#FF0000', 'NONEXISTENT');
        const report = checker.auditColors();
        expect(report.results[0].passed).toBe(false);
        expect(report.results[0].colorDifference).toBe(100);
      });

      it('阵营色应正确匹配', () => {
        checker.registerColor('clr_1', 'faction', 'primaryColor', '#1565C0', 'wei');
        const report = checker.auditColors();
        expect(report.results[0].passed).toBe(true);
      });

      it('功能色应正确匹配', () => {
        checker.registerColor('clr_1', 'functional', 'standardColor', '#4CAF50', 'confirm');
        const report = checker.auditColors();
        expect(report.results[0].passed).toBe(true);
      });

      it('状态色应正确匹配', () => {
        checker.registerColor('clr_1', 'status', 'standardColor', '#4CAF50', 'online');
        const report = checker.auditColors();
        expect(report.results[0].passed).toBe(true);
      });

      it('应正确计算一致性评分', () => {
        checker.registerColor('clr_1', 'quality', 'borderColor', '#757575', 'COMMON');
        checker.registerColor('clr_2', 'quality', 'borderColor', '#FF0000', 'COMMON');
        const report = checker.auditColors();
        expect(report.summary.passedChecks + report.summary.failedChecks).toBe(2);
        expect(report.summary.consistencyScore).toBe(50);
      });

      it('报告应有唯一 ID 和时间戳', () => {
        checker.registerColor('clr_1', 'quality', 'borderColor', '#757575', 'COMMON');
        const report = checker.auditColors();
        expect(report.id).toBeTruthy();
        expect(report.timestamp).toBeGreaterThan(0);
      });
    });
  });

  // ─────────────────────────────────────────────
  // 综合报告
  // ─────────────────────────────────────────────

  describe('综合报告', () => {
    it('generateReport 应生成综合报告', () => {
      checker.registerAnimation('a1', 'transition', 300, 'ease-out', 'ANI-T-001');
      checker.registerColor('clr_1', 'quality', 'borderColor', '#757575', 'COMMON');

      const report = checker.generateReport();
      expect(report.id).toBeTruthy();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.animationReport).toBeDefined();
      expect(report.colorReport).toBeDefined();
    });

    it('完全合规时评分应为100', () => {
      checker.registerAnimation('a1', 'transition', 300, 'ease-out', 'ANI-T-001');
      checker.registerColor('clr_1', 'quality', 'borderColor', '#757575', 'COMMON');

      const report = checker.generateReport();
      expect(report.overallScore).toBe(100);
    });

    it('完全不合格时评分应为0', () => {
      checker.registerAnimation('a1', 'transition', 500, 'ease-in', 'ANI-T-001');
      checker.registerColor('clr_1', 'quality', 'borderColor', '#FF0000', 'COMMON');

      const report = checker.generateReport();
      expect(report.overallScore).toBe(0);
    });

    it('getLastReport 应返回最后一次报告', () => {
      checker.registerAnimation('a1', 'transition', 300, 'ease-out');
      checker.generateReport();
      const report = checker.getLastReport();
      expect(report).not.toBeNull();
      expect(report!.id).toBeTruthy();
    });

    it('未生成报告时 getLastReport 应返回 null', () => {
      expect(checker.getLastReport()).toBeNull();
    });
  });
});
