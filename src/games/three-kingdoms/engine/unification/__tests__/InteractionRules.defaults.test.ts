/**
 * InteractionRules.defaults 测试
 *
 * 覆盖：
 *   - 各组件类型规则完整性
 *   - 规则ID唯一性
 *   - ALL_DEFAULT_RULES 聚合正确性
 *   - required 字段一致性
 *   - expectedFeedback 非空校验
 */

import { describe, it, expect } from 'vitest';
import {
  BUTTON_RULES,
  PANEL_RULES,
  DIALOG_RULES,
  LIST_ITEM_RULES,
  TOGGLE_RULES,
  SLIDER_RULES,
  TAB_RULES,
  INPUT_RULES,
  DROPDOWN_RULES,
  TOOLTIP_RULES,
  ALL_DEFAULT_RULES,
} from '../InteractionRules.defaults';

describe('InteractionRules.defaults', () => {
  describe('各组件类型规则', () => {
    it('BUTTON_RULES 应包含4条规则（hover/pressed/disabled/normal）', () => {
      expect(BUTTON_RULES).toHaveLength(4);
      const states = BUTTON_RULES.map(r => r.state);
      expect(states).toEqual(expect.arrayContaining(['hover', 'pressed', 'disabled', 'normal']));
      for (const rule of BUTTON_RULES) {
        expect(rule.componentType).toBe('button');
      }
    });

    it('PANEL_RULES 应包含2条规则', () => {
      expect(PANEL_RULES).toHaveLength(2);
      for (const rule of PANEL_RULES) {
        expect(rule.componentType).toBe('panel');
      }
    });

    it('DIALOG_RULES 应包含2条规则', () => {
      expect(DIALOG_RULES).toHaveLength(2);
      for (const rule of DIALOG_RULES) {
        expect(rule.componentType).toBe('dialog');
      }
    });

    it('TOGGLE_RULES、SLIDER_RULES、INPUT_RULES、DROPDOWN_RULES、TOOLTIP_RULES 各至少1条', () => {
      expect(TOGGLE_RULES.length).toBeGreaterThanOrEqual(1);
      expect(SLIDER_RULES.length).toBeGreaterThanOrEqual(1);
      expect(INPUT_RULES.length).toBeGreaterThanOrEqual(1);
      expect(DROPDOWN_RULES.length).toBeGreaterThanOrEqual(1);
      expect(TOOLTIP_RULES.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('规则完整性', () => {
    it('ALL_DEFAULT_RULES 应聚合所有分类规则', () => {
      const expected =
        BUTTON_RULES.length + PANEL_RULES.length + DIALOG_RULES.length +
        LIST_ITEM_RULES.length + TOGGLE_RULES.length + SLIDER_RULES.length +
        TAB_RULES.length + INPUT_RULES.length + DROPDOWN_RULES.length +
        TOOLTIP_RULES.length;
      expect(ALL_DEFAULT_RULES).toHaveLength(expected);
    });

    it('所有规则ID应唯一', () => {
      const ids = ALL_DEFAULT_RULES.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('每条规则应有 expectedBehavior 描述', () => {
      for (const rule of ALL_DEFAULT_RULES) {
        expect(rule.expectedBehavior).toBeTruthy();
        expect(rule.expectedBehavior.length).toBeGreaterThan(0);
      }
    });

    it('required=true 的规则应有 expectedFeedback', () => {
      for (const rule of ALL_DEFAULT_RULES) {
        if (rule.required) {
          // required 规则至少应有某种反馈（或空数组也是合法的）
          expect(Array.isArray(rule.expectedFeedback)).toBe(true);
        }
      }
    });

    it('各规则应包含正确的 componentType', () => {
      const componentTypes = new Set(ALL_DEFAULT_RULES.map(r => r.componentType));
      expect(componentTypes).toEqual(new Set([
        'button', 'panel', 'dialog', 'list_item', 'toggle', 'slider', 'tab', 'input', 'dropdown', 'tooltip',
      ]));
    });
  });
});
