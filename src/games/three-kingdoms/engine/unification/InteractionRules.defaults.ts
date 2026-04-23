/**
 * 交互审查器 — 默认交互规则配置
 *
 * 所有 UI 组件类型的默认交互规则定义。
 * 从 InteractionAuditor 中提取，便于独立维护和扩展。
 *
 * @module engine/unification/InteractionRules.defaults
 */

import type { InteractionRule } from '../../core/unification';

// ─────────────────────────────────────────────
// 默认交互规则
// ─────────────────────────────────────────────

/** 按钮交互规则 */
export const BUTTON_RULES: InteractionRule[] = [
  {
    id: 'BTN-001', componentType: 'button', state: 'hover',
    expectedBehavior: 'Visual highlight with brightness +10%',
    expectedFeedback: ['visual_highlight', 'scale_animation'],
    required: true,
  },
  {
    id: 'BTN-002', componentType: 'button', state: 'pressed',
    expectedBehavior: 'Scale down to 0.96 with darkening',
    expectedFeedback: ['scale_animation', 'color_change'],
    required: true,
  },
  {
    id: 'BTN-003', componentType: 'button', state: 'disabled',
    expectedBehavior: 'Grayed out, no interaction',
    expectedFeedback: ['color_change'],
    required: true,
  },
  {
    id: 'BTN-004', componentType: 'button', state: 'normal',
    expectedBehavior: 'Default appearance, clickable',
    expectedFeedback: [],
    required: false,
  },
];

/** 面板交互规则 */
export const PANEL_RULES: InteractionRule[] = [
  {
    id: 'PNL-001', componentType: 'panel', state: 'normal',
    expectedBehavior: 'Expand animation 300ms ease-out',
    expectedFeedback: ['state_transition'],
    required: true,
  },
  {
    id: 'PNL-002', componentType: 'panel', state: 'disabled',
    expectedBehavior: 'Close animation 200ms ease-in',
    expectedFeedback: ['state_transition'],
    required: true,
  },
];

/** 弹窗交互规则 */
export const DIALOG_RULES: InteractionRule[] = [
  {
    id: 'DLG-001', componentType: 'dialog', state: 'normal',
    expectedBehavior: 'Spring popup 250ms',
    expectedFeedback: ['scale_animation', 'state_transition'],
    required: true,
  },
  {
    id: 'DLG-002', componentType: 'dialog', state: 'normal',
    expectedBehavior: 'Backdrop click to close',
    expectedFeedback: ['state_transition'],
    required: false,
  },
];

/** 列表项交互规则 */
export const LIST_ITEM_RULES: InteractionRule[] = [
  {
    id: 'LST-001', componentType: 'list_item', state: 'hover',
    expectedBehavior: 'Background color change',
    expectedFeedback: ['color_change'],
    required: true,
  },
  {
    id: 'LST-002', componentType: 'list_item', state: 'pressed',
    expectedBehavior: 'Scale down slightly',
    expectedFeedback: ['scale_animation'],
    required: false,
  },
];

/** 开关交互规则 */
export const TOGGLE_RULES: InteractionRule[] = [
  {
    id: 'TGL-001', componentType: 'toggle', state: 'normal',
    expectedBehavior: 'Toggle animation 200ms',
    expectedFeedback: ['state_transition'],
    required: true,
  },
];

/** 滑块交互规则 */
export const SLIDER_RULES: InteractionRule[] = [
  {
    id: 'SLD-001', componentType: 'slider', state: 'pressed',
    expectedBehavior: 'Drag handle follows pointer',
    expectedFeedback: ['visual_highlight'],
    required: true,
  },
];

/** Tab 交互规则 */
export const TAB_RULES: InteractionRule[] = [
  {
    id: 'TAB-001', componentType: 'tab', state: 'normal',
    expectedBehavior: 'Switch animation 200ms ease-in-out',
    expectedFeedback: ['state_transition', 'color_change'],
    required: true,
  },
  {
    id: 'TAB-002', componentType: 'tab', state: 'hover',
    expectedBehavior: 'Tab highlight',
    expectedFeedback: ['visual_highlight'],
    required: false,
  },
];

/** 输入框交互规则 */
export const INPUT_RULES: InteractionRule[] = [
  {
    id: 'INP-001', componentType: 'input', state: 'focused',
    expectedBehavior: 'Border highlight',
    expectedFeedback: ['color_change', 'visual_highlight'],
    required: true,
  },
];

/** 下拉框交互规则 */
export const DROPDOWN_RULES: InteractionRule[] = [
  {
    id: 'DRP-001', componentType: 'dropdown', state: 'normal',
    expectedBehavior: 'Expand with animation',
    expectedFeedback: ['state_transition'],
    required: true,
  },
];

/** 工具提示交互规则 */
export const TOOLTIP_RULES: InteractionRule[] = [
  {
    id: 'TIP-001', componentType: 'tooltip', state: 'hover',
    expectedBehavior: 'Show tooltip after delay',
    expectedFeedback: ['tooltip_display'],
    required: true,
  },
];

/** 所有默认规则 */
export const ALL_DEFAULT_RULES: InteractionRule[] = [
  ...BUTTON_RULES,
  ...PANEL_RULES,
  ...DIALOG_RULES,
  ...LIST_ITEM_RULES,
  ...TOGGLE_RULES,
  ...SLIDER_RULES,
  ...TAB_RULES,
  ...INPUT_RULES,
  ...DROPDOWN_RULES,
  ...TOOLTIP_RULES,
];
