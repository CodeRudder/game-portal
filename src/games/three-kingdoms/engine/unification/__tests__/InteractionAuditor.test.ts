/**
 * InteractionAuditor 测试
 *
 * 覆盖：
 *   - ISubsystem 接口
 *   - 规则管理
 *   - 组件注册
 *   - 审查执行
 *   - 查询
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InteractionAuditor } from '../InteractionAuditor';
import type { InteractionRule } from '../../../core/unification';

function createMockDeps() {
  return {
    eventBus: { on: () => {}, emit: () => {}, off: () => {} },
    config: { get: () => null },
    registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
  };
}

describe('InteractionAuditor', () => {
  let auditor: InteractionAuditor;

  beforeEach(() => {
    auditor = new InteractionAuditor();
    auditor.init(createMockDeps() as any);
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(auditor.name).toBe('interaction-auditor');
    });

    it('init 不应抛错', () => {
      expect(() => auditor.init(createMockDeps() as any)).not.toThrow();
    });

    it('update 不应抛错', () => {
      expect(() => auditor.update(16)).not.toThrow();
    });

    it('reset 应清除组件和报告', () => {
      auditor.registerComponent('btn1', 'button', ['hover', 'pressed'], ['visual_highlight']);
      auditor.audit();
      auditor.reset();
      expect(auditor.getComponentCount()).toBe(0);
      expect(auditor.getLastReport()).toBeNull();
    });

    it('getState 应返回状态', () => {
      const state = auditor.getState();
      expect(state).toHaveProperty('lastReport');
      expect(state).toHaveProperty('ruleCount');
      expect(state).toHaveProperty('componentCount');
    });
  });

  describe('规则管理', () => {
    it('应有默认规则', () => {
      const rules = auditor.getRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('addRule 应添加自定义规则', () => {
      const customRule: InteractionRule = {
        id: 'CUSTOM-001', componentType: 'button', state: 'hover',
        expectedBehavior: 'Custom hover', expectedFeedback: ['custom'],
        required: true,
      };
      auditor.addRule(customRule);
      const rules = auditor.getRules();
      expect(rules.some(r => r.id === 'CUSTOM-001')).toBe(true);
    });

    it('removeRule 应移除规则', () => {
      const initialCount = auditor.getRules().length;
      auditor.removeRule('BTN-001');
      expect(auditor.getRules().length).toBe(initialCount - 1);
    });

    it('getRulesForType 应过滤按钮规则', () => {
      const btnRules = auditor.getRulesForType('button');
      expect(btnRules.length).toBeGreaterThan(0);
      expect(btnRules.every(r => r.componentType === 'button')).toBe(true);
    });

    it('getRulesForType 面板应有规则', () => {
      const panelRules = auditor.getRulesForType('panel');
      expect(panelRules.length).toBeGreaterThan(0);
    });
  });

  describe('组件注册', () => {
    it('registerComponent 应注册组件', () => {
      auditor.registerComponent('btn1', 'button', ['hover', 'pressed'], ['visual_highlight']);
      expect(auditor.getComponentCount()).toBe(1);
    });

    it('不应重复注册相同 ID 的组件', () => {
      auditor.registerComponent('btn1', 'button', ['hover'], ['visual_highlight']);
      auditor.registerComponent('btn1', 'button', ['hover'], ['visual_highlight']);
      expect(auditor.getComponentCount()).toBe(1);
    });

    it('unregisterComponent 应注销组件', () => {
      auditor.registerComponent('btn1', 'button', ['hover'], ['visual_highlight']);
      auditor.unregisterComponent('btn1');
      expect(auditor.getComponentCount()).toBe(0);
    });

    it('getComponents 应返回注册列表', () => {
      auditor.registerComponent('btn1', 'button', ['hover'], ['visual_highlight']);
      const components = auditor.getComponents();
      expect(components).toHaveLength(1);
    });
  });

  describe('审查执行', () => {
    it('无组件时 audit 应返回空结果', () => {
      const report = auditor.audit();
      expect(report.totalComponents).toBe(0);
      expect(report.results).toHaveLength(0);
    });

    it('完全合规的组件应通过', () => {
      auditor.registerComponent(
        'btn_ok', 'button',
        ['hover', 'pressed', 'disabled', 'normal'],
        ['visual_highlight', 'scale_animation', 'color_change'],
      );
      const report = auditor.audit();
      const btnResult = report.results.find(r => r.componentId === 'btn_ok');
      expect(btnResult).toBeDefined();
      expect(btnResult!.passedRules).toBeGreaterThan(0);
      expect(btnResult!.failedRules).toBe(0);
    });

    it('缺少状态的组件应有违规', () => {
      auditor.registerComponent(
        'btn_bad', 'button',
        ['normal'],
        [],
      );
      const report = auditor.audit();
      const btnResult = report.results.find(r => r.componentId === 'btn_bad');
      expect(btnResult!.failedRules).toBeGreaterThan(0);
      expect(btnResult!.violations.length).toBeGreaterThan(0);
    });

    it('报告应有汇总', () => {
      auditor.registerComponent('btn1', 'button', ['hover'], ['visual_highlight']);
      const report = auditor.audit();
      expect(report.summary.totalRules).toBeGreaterThan(0);
      expect(report.summary.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.consistencyScore).toBeLessThanOrEqual(100);
    });

    it('报告应有 ID 和时间戳', () => {
      auditor.registerComponent('btn1', 'button', ['hover'], ['visual_highlight']);
      const report = auditor.audit();
      expect(report.id).toBeTruthy();
      expect(report.timestamp).toBeGreaterThan(0);
    });
  });

  describe('查询', () => {
    it('getLastReport 应返回最后报告', () => {
      auditor.registerComponent('btn1', 'button', ['hover'], ['visual_highlight']);
      const report = auditor.audit();
      expect(auditor.getLastReport()).toEqual(report);
    });

    it('getViolationsByType 应过滤违规', () => {
      auditor.registerComponent('btn_bad', 'button', ['normal'], []);
      auditor.audit();
      const violations = auditor.getViolationsByType('button');
      expect(violations.length).toBeGreaterThan(0);
    });

    it('getErrors 应返回错误级别违规', () => {
      auditor.registerComponent('btn_bad', 'button', ['normal'], []);
      auditor.audit();
      const errors = auditor.getErrors();
      expect(Array.isArray(errors)).toBe(true);
    });

    it('无报告时查询应返回空', () => {
      expect(auditor.getViolationsByType('button')).toHaveLength(0);
      expect(auditor.getErrors()).toHaveLength(0);
    });
  });
});
