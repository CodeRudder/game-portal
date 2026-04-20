/**
 * AnimationAuditor 测试
 *
 * 覆盖：
 *   - 动画规范管理
 *   - 动画实例注册
 *   - 审查执行
 *   - 合规性检查
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnimationAuditor } from '../AnimationAuditor';
import type { AnimationSpec } from '../../../core/unification';

describe('AnimationAuditor', () => {
  let auditor: AnimationAuditor;

  beforeEach(() => {
    auditor = new AnimationAuditor();
  });

  describe('动画规范管理', () => {
    it('应有默认动画规范', () => {
      const specs = auditor.getAnimationSpecs();
      expect(specs.length).toBeGreaterThan(0);
    });

    it('addAnimationSpec 应添加自定义规范', () => {
      const spec: AnimationSpec = {
        id: 'custom-001',
        category: 'transition',
        name: 'Custom Transition',
        standardDurationMs: 400,
        durationToleranceMs: 50,
        standardEasing: 'ease-out',
      };
      auditor.addAnimationSpec(spec);
      const specs = auditor.getAnimationSpecs();
      expect(specs.some(s => s.id === 'custom-001')).toBe(true);
    });

    it('resetSpecs 应恢复默认规范', () => {
      const initialCount = auditor.getAnimationSpecs().length;
      auditor.addAnimationSpec({
        id: 'extra', category: 'transition', name: 'Extra',
        standardDurationMs: 300, durationToleranceMs: 50, standardEasing: 'ease',
      });
      expect(auditor.getAnimationSpecs().length).toBe(initialCount + 1);
      auditor.resetSpecs();
      expect(auditor.getAnimationSpecs().length).toBe(initialCount);
    });
  });

  describe('动画实例注册', () => {
    it('registerAnimation 应注册实例', () => {
      auditor.registerAnimation('anim1', 'transition', 300, 'ease-out');
      expect(auditor.getAnimationCount()).toBe(1);
    });

    it('不应重复注册相同 ID', () => {
      auditor.registerAnimation('anim1', 'transition', 300, 'ease-out');
      auditor.registerAnimation('anim1', 'transition', 300, 'ease-out');
      expect(auditor.getAnimationCount()).toBe(1);
    });

    it('unregisterAnimation 应注销实例', () => {
      auditor.registerAnimation('anim1', 'transition', 300, 'ease-out');
      auditor.unregisterAnimation('anim1');
      expect(auditor.getAnimationCount()).toBe(0);
    });

    it('clearAnimations 应清空所有实例', () => {
      auditor.registerAnimation('anim1', 'transition', 300, 'ease-out');
      auditor.registerAnimation('anim2', 'state', 150, 'ease-in');
      auditor.clearAnimations();
      expect(auditor.getAnimationCount()).toBe(0);
    });
  });

  describe('审查执行', () => {
    it('无注册实例时应返回空报告', () => {
      const report = auditor.auditAnimations();
      expect(report.totalAnimations).toBe(0);
      expect(report.results).toHaveLength(0);
    });

    it('合规动画应通过审查', () => {
      // 找一个默认规范来注册合规实例
      const specs = auditor.getAnimationSpecs();
      const spec = specs[0];
      auditor.registerAnimation('anim1', spec.category, spec.standardDurationMs, spec.standardEasing, spec.id);
      const report = auditor.auditAnimations();
      expect(report.results[0].isCompliant).toBe(true);
    });

    it('不合规时长应标记为不合规', () => {
      const specs = auditor.getAnimationSpecs();
      const spec = specs[0];
      auditor.registerAnimation('anim_bad', spec.category, 9999, spec.standardEasing, spec.id);
      const report = auditor.auditAnimations();
      expect(report.results[0].isCompliant).toBe(false);
    });

    it('不合规缓动应标记为不合规', () => {
      const specs = auditor.getAnimationSpecs();
      const spec = specs[0];
      auditor.registerAnimation('anim_bad', spec.category, spec.standardDurationMs, 'invalid-easing', spec.id);
      const report = auditor.auditAnimations();
      expect(report.results[0].isCompliant).toBe(false);
    });

    it('无匹配规范应标记为不合规', () => {
      auditor.registerAnimation('anim_unknown', 'nonexistent_category', 300, 'ease');
      const report = auditor.auditAnimations();
      expect(report.results[0].isCompliant).toBe(false);
    });

    it('报告应有 ID 和时间戳', () => {
      auditor.registerAnimation('anim1', 'transition', 300, 'ease-out');
      const report = auditor.auditAnimations();
      expect(report.id).toBeTruthy();
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('报告应有汇总统计', () => {
      auditor.registerAnimation('anim1', 'transition', 300, 'ease-out');
      const report = auditor.auditAnimations();
      expect(report.summary).toHaveProperty('compliantCount');
      expect(report.summary).toHaveProperty('nonCompliantCount');
      expect(report.summary).toHaveProperty('complianceRate');
      expect(report.summary.complianceRate).toBeGreaterThanOrEqual(0);
      expect(report.summary.complianceRate).toBeLessThanOrEqual(1);
    });

    it('不合规结果应有偏差描述', () => {
      const specs = auditor.getAnimationSpecs();
      const spec = specs[0];
      auditor.registerAnimation('anim_bad', spec.category, 9999, 'wrong-easing', spec.id);
      const report = auditor.auditAnimations();
      expect(report.results[0].deviationDescription).toBeTruthy();
    });
  });
});
