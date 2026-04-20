/**
 * InteractionAuditor 测试
 *
 * 覆盖交互审查器的所有功能：
 *   - ISubsystem 接口
 *   - 规则管理（添加/移除/查询）
 *   - 组件注册（注册/注销/查询）
 *   - 审查执行与报告生成
 *   - 违规查询
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InteractionAuditor } from '../InteractionAuditor';
import type { InteractionRule } from '../../../../core/unification';

describe('InteractionAuditor', () => {
  let auditor: InteractionAuditor;

  beforeEach(() => {
    auditor = new InteractionAuditor();
  });

  // ─────────────────────────────────────────────
  // ISubsystem 接口
  // ─────────────────────────────────────────────

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(auditor.name).toBe('interaction-auditor');
    });

    it('init 不应抛错', () => {
      const mockDeps = {
        eventBus: { on: () => {}, emit: () => {}, off: () => {} },
        config: { get: () => null },
        registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
      };
      expect(() => auditor.init(mockDeps as any)).not.toThrow();
    });

    it('update 不应抛错', () => {
      expect(() => auditor.update(16)).not.toThrow();
    });

    it('reset 应清除所有数据', () => {
      auditor.addRule({
        id: 'CUSTOM-001', componentType: 'button', state: 'hover',
        expectedBehavior: 'test', expectedFeedback: [], required: true,
      });
      auditor.registerComponent('btn_1', 'button', ['hover'], ['visual_highlight']);
      auditor.audit();
      auditor.reset();

      const state = auditor.getState();
      expect(state.lastReport).toBeNull();
      expect(state.componentCount).toBe(0);
    });

    it('getState 应返回正确状态', () => {
      const state = auditor.getState();
      expect(state).toHaveProperty('lastReport');
      expect(state).toHaveProperty('ruleCount');
      expect(state).toHaveProperty('componentCount');
      expect(state.lastReport).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // 规则管理
  // ─────────────────────────────────────────────

  describe('规则管理', () => {
    it('默认应包含所有组件类型的规则', () => {
      const rules = auditor.getRules();
      const types = new Set(rules.map(r => r.componentType));
      expect(types).toContain('button');
      expect(types).toContain('panel');
      expect(types).toContain('dialog');
      expect(types).toContain('list_item');
      expect(types).toContain('toggle');
      expect(types).toContain('slider');
      expect(types).toContain('tab');
      expect(types).toContain('input');
      expect(types).toContain('dropdown');
      expect(types).toContain('tooltip');
    });

    it('addRule 应添加自定义规则', () => {
      const initialCount = auditor.getRules().length;
      auditor.addRule({
        id: 'CUSTOM-001', componentType: 'button', state: 'hover',
        expectedBehavior: 'custom', expectedFeedback: [], required: false,
      });
      expect(auditor.getRules()).toHaveLength(initialCount + 1);
    });

    it('removeRule 应移除指定规则', () => {
      const rules = auditor.getRules();
      const ruleId = rules[0].id;
      auditor.removeRule(ruleId);
      const remaining = auditor.getRules();
      expect(remaining.find(r => r.id === ruleId)).toBeUndefined();
    });

    it('getRulesForType 应返回指定类型的规则', () => {
      const buttonRules = auditor.getRulesForType('button');
      expect(buttonRules.length).toBeGreaterThan(0);
      for (const rule of buttonRules) {
        expect(rule.componentType).toBe('button');
      }
    });

    it('getRulesForType 不存在的类型应返回空', () => {
      const rules = auditor.getRulesForType('nonexistent' as any);
      expect(rules).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // 组件注册
  // ─────────────────────────────────────────────

  describe('组件注册', () => {
    it('registerComponent 应注册组件', () => {
      auditor.registerComponent('btn_1', 'button', ['hover', 'pressed'], ['visual_highlight']);
      expect(auditor.getComponentCount()).toBe(1);
    });

    it('重复注册同一 ID 应忽略', () => {
      auditor.registerComponent('btn_1', 'button', ['hover'], ['visual_highlight']);
      auditor.registerComponent('btn_1', 'button', ['hover'], ['visual_highlight']);
      expect(auditor.getComponentCount()).toBe(1);
    });

    it('unregisterComponent 应注销组件', () => {
      auditor.registerComponent('btn_1', 'button', ['hover'], ['visual_highlight']);
      auditor.unregisterComponent('btn_1');
      expect(auditor.getComponentCount()).toBe(0);
    });

    it('getComponents 应返回所有注册组件', () => {
      auditor.registerComponent('btn_1', 'button', ['hover'], ['visual_highlight']);
      auditor.registerComponent('pnl_1', 'panel', ['normal'], ['state_transition']);
      const components = auditor.getComponents();
      expect(components).toHaveLength(2);
    });

    it('getComponents 返回的应为副本（不可外部修改）', () => {
      auditor.registerComponent('btn_1', 'button', ['hover'], ['visual_highlight']);
      const components = auditor.getComponents();
      components.pop();
      expect(auditor.getComponentCount()).toBe(1);
    });
  });

  // ─────────────────────────────────────────────
  // 审查执行
  // ─────────────────────────────────────────────

  describe('审查执行', () => {
    it('无组件时审查应返回空结果', () => {
      const report = auditor.audit();
      expect(report.totalComponents).toBe(0);
      expect(report.results).toHaveLength(0);
      expect(report.summary.totalRules).toBe(0);
    });

    it('完全合规的组件应通过审查', () => {
      auditor.registerComponent(
        'btn_ok', 'button',
        ['hover', 'pressed', 'disabled', 'normal'],
        ['visual_highlight', 'scale_animation', 'color_change'],
      );
      const report = auditor.audit();
      expect(report.results).toHaveLength(1);
      expect(report.results[0].passedRules).toBeGreaterThan(0);
      expect(report.results[0].failedRules).toBe(0);
      expect(report.results[0].violations).toHaveLength(0);
    });

    it('缺少必要状态的组件应产生 error 级别违规', () => {
      // 按钮规则要求 hover 状态，但组件不支持
      auditor.registerComponent(
        'btn_bad', 'button',
        ['normal'], // 缺少 hover, pressed, disabled
        [],
      );
      const report = auditor.audit();
      const errors = report.results[0].violations.filter(v => v.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('缺少反馈类型的组件应产生 warning 级别违规', () => {
      // 支持 hover 状态但缺少 visual_highlight 反馈
      auditor.registerComponent(
        'btn_partial', 'button',
        ['hover', 'pressed', 'disabled'],
        [], // 缺少所有反馈
      );
      const report = auditor.audit();
      const warnings = report.results[0].violations.filter(v => v.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('报告应包含正确的汇总', () => {
      auditor.registerComponent(
        'btn_ok', 'button',
        ['hover', 'pressed', 'disabled', 'normal'],
        ['visual_highlight', 'scale_animation', 'color_change'],
      );
      const report = auditor.audit();
      expect(report.summary.totalRules).toBe(report.summary.passedRules + report.summary.failedRules);
      expect(report.summary.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.consistencyScore).toBeLessThanOrEqual(100);
    });

    it('报告应有唯一 ID 和时间戳', () => {
      auditor.registerComponent('btn_1', 'button', ['hover'], ['visual_highlight']);
      const report = auditor.audit();
      expect(report.id).toBeTruthy();
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('完全合规时 consistencyScore 应为100', () => {
      auditor.registerComponent(
        'btn_perfect', 'button',
        ['hover', 'pressed', 'disabled', 'normal'],
        ['visual_highlight', 'scale_animation', 'color_change'],
      );
      const report = auditor.audit();
      expect(report.summary.consistencyScore).toBe(100);
    });
  });

  // ─────────────────────────────────────────────
  // 违规查询
  // ─────────────────────────────────────────────

  describe('违规查询', () => {
    beforeEach(() => {
      auditor.registerComponent(
        'btn_bad', 'button',
        ['normal'],
        [],
      );
      auditor.registerComponent(
        'btn_good', 'button',
        ['hover', 'pressed', 'disabled', 'normal'],
        ['visual_highlight', 'scale_animation', 'color_change'],
      );
      auditor.audit();
    });

    it('getViolationsByType 应返回指定类型的违规', () => {
      const violations = auditor.getViolationsByType('button');
      expect(violations.length).toBeGreaterThan(0);
    });

    it('getViolationsByType 不存在的类型应返回空', () => {
      const violations = auditor.getViolationsByType('panel');
      expect(violations).toHaveLength(0);
    });

    it('getErrors 应返回所有 error 级别违规', () => {
      const errors = auditor.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      for (const err of errors) {
        expect(err.severity).toBe('error');
      }
    });

    it('getLastReport 应返回最后一次报告', () => {
      const report = auditor.getLastReport();
      expect(report).not.toBeNull();
      expect(report!.id).toBeTruthy();
    });

    it('未审查时 getLastReport 应返回 null', () => {
      auditor.reset();
      expect(auditor.getLastReport()).toBeNull();
    });

    it('未审查时 getErrors 应返回空', () => {
      auditor.reset();
      expect(auditor.getErrors()).toHaveLength(0);
    });

    it('未审查时 getViolationsByType 应返回空', () => {
      auditor.reset();
      expect(auditor.getViolationsByType('button')).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // 多组件类型审查
  // ─────────────────────────────────────────────

  describe('多组件类型审查', () => {
    it('应同时审查多种组件类型', () => {
      auditor.registerComponent('btn_1', 'button', ['hover', 'pressed', 'disabled', 'normal'], ['visual_highlight', 'scale_animation', 'color_change']);
      auditor.registerComponent('pnl_1', 'panel', ['normal', 'disabled'], ['state_transition']);
      auditor.registerComponent('dlg_1', 'dialog', ['normal'], ['scale_animation', 'state_transition']);

      const report = auditor.audit();
      expect(report.totalComponents).toBe(3);
      expect(report.results).toHaveLength(3);
    });

    it('自定义规则应参与审查', () => {
      const customRule: InteractionRule = {
        id: 'CUSTOM-RULE-001',
        componentType: 'custom_type' as any,
        state: 'normal',
        expectedBehavior: 'Custom behavior',
        expectedFeedback: ['custom_feedback' as any],
        required: true,
      };
      auditor.addRule(customRule);
      auditor.registerComponent('c1', 'custom_type' as any, ['normal'], []);

      const report = auditor.audit();
      const result = report.results[0];
      expect(result.failedRules).toBeGreaterThan(0);
    });
  });
});
