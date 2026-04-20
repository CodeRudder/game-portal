/**
 * 核心层 — v20.0 交互审查 & 视觉一致性类型定义
 *
 * 涵盖：
 *   - InteractionAuditor (#13 全局交互一致性)
 *   - VisualConsistencyChecker (#14 动画规范终审, #15 全局配色规范)
 *
 * @module core/unification/interaction.types
 */

// ─────────────────────────────────────────────
// 1. 交互一致性 (#13)
// ─────────────────────────────────────────────

/** UI 组件类型 */
export type UIComponentType =
  | 'button'
  | 'panel'
  | 'dialog'
  | 'tooltip'
  | 'tab'
  | 'input'
  | 'dropdown'
  | 'toggle'
  | 'slider'
  | 'list_item';

/** 交互状态 */
export type InteractionState =
  | 'normal'
  | 'hover'
  | 'pressed'
  | 'disabled'
  | 'focused'
  | 'loading';

/** 交互事件类型 */
export type InteractionEventType =
  | 'click'
  | 'double_click'
  | 'long_press'
  | 'hover_enter'
  | 'hover_leave'
  | 'focus'
  | 'blur'
  | 'swipe'
  | 'pinch'
  | 'drag';

/** 交互规则定义 */
export interface InteractionRule {
  /** 规则 ID */
  id: string;
  /** 组件类型 */
  componentType: UIComponentType;
  /** 交互状态 */
  state: InteractionState;
  /** 期望行为描述 */
  expectedBehavior: string;
  /** 期望反馈类型 */
  expectedFeedback: FeedbackType[];
  /** 是否必须 */
  required: boolean;
}

/** 反馈类型 */
export type FeedbackType =
  | 'visual_highlight'    // 视觉高亮
  | 'scale_animation'     // 缩放动画
  | 'color_change'        // 颜色变化
  | 'sound_effect'        // 音效
  | 'haptic_feedback'     // 触觉反馈
  | 'ripple_effect'       // 涟漪效果
  | 'tooltip_display'     // 提示显示
  | 'state_transition';   // 状态过渡

/** 组件交互检查结果 */
export interface InteractionCheckResult {
  /** 组件 ID */
  componentId: string;
  /** 组件类型 */
  componentType: UIComponentType;
  /** 检查的状态列表 */
  checkedStates: InteractionState[];
  /** 通过的规则数 */
  passedRules: number;
  /** 失败的规则数 */
  failedRules: number;
  /** 违规详情 */
  violations: InteractionViolation[];
}

/** 交互违规 */
export interface InteractionViolation {
  /** 规则 ID */
  ruleId: string;
  /** 期望行为 */
  expected: string;
  /** 实际行为 */
  actual: string;
  /** 严重程度 */
  severity: 'error' | 'warning';
  /** 建议修复 */
  suggestion: string;
}

/** 交互审查报告 */
export interface InteractionAuditReport {
  /** 报告 ID */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** 检查的组件总数 */
  totalComponents: number;
  /** 各组件检查结果 */
  results: InteractionCheckResult[];
  /** 汇总 */
  summary: InteractionAuditSummary;
}

/** 交互审查汇总 */
export interface InteractionAuditSummary {
  /** 总规则数 */
  totalRules: number;
  /** 通过数 */
  passedRules: number;
  /** 失败数 */
  failedRules: number;
  /** 错误数 */
  errorCount: number;
  /** 警告数 */
  warningCount: number;
  /** 一致性评分 (0~100) */
  consistencyScore: number;
}

// ─────────────────────────────────────────────
// 2. 动画规范 (#14)
// ─────────────────────────────────────────────

/** 动画类型 */
export type AnimationCategory =
  | 'transition'    // 过渡动画
  | 'state_change'  // 状态变化动画
  | 'feedback'      // 反馈动画
  | 'loading'       // 加载动画
  | 'entrance'      // 入场动画
  | 'exit';         // 退场动画

/** 动画规范定义 */
export interface AnimationSpec {
  /** 规范 ID */
  id: string;
  /** 动画类型 */
  category: AnimationCategory;
  /** 标准时长 (ms) */
  standardDurationMs: number;
  /** 时长容忍范围 (ms) */
  durationToleranceMs: number;
  /** 标准缓动函数 */
  standardEasing: string;
  /** 标准延迟 (ms) */
  standardDelayMs: number;
}

/** 动画检查结果 */
export interface AnimationCheckResult {
  /** 动画标识 */
  animationId: string;
  /** 动画类型 */
  category: AnimationCategory;
  /** 实际时长 (ms) */
  actualDurationMs: number;
  /** 期望时长范围 */
  expectedDurationRange: { min: number; max: number };
  /** 实际缓动函数 */
  actualEasing: string;
  /** 期望缓动函数 */
  expectedEasing: string;
  /** 是否合规 */
  isCompliant: boolean;
  /** 偏差描述 */
  deviationDescription: string;
}

/** 动画规范报告 */
export interface AnimationAuditReport {
  /** 报告 ID */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** 检查的动画总数 */
  totalAnimations: number;
  /** 各动画检查结果 */
  results: AnimationCheckResult[];
  /** 汇总 */
  summary: AnimationAuditSummary;
}

/** 动画规范汇总 */
export interface AnimationAuditSummary {
  /** 合规数 */
  compliantCount: number;
  /** 不合规数 */
  nonCompliantCount: number;
  /** 合规率 */
  complianceRate: number;
}

// ─────────────────────────────────────────────
// 3. 配色规范 (#15)
// ─────────────────────────────────────────────

/** 配色用途分类 */
export type ColorUsageCategory =
  | 'quality'      // 品质色
  | 'faction'      // 阵营色
  | 'functional'   // 功能色
  | 'status';      // 状态色

/** 品质色映射 */
export interface QualityColorDef {
  /** 品质等级 */
  quality: string;
  /** 主色 */
  primaryColor: string;
  /** 边框色 */
  borderColor: string;
  /** 背景色 */
  backgroundColor: string;
  /** 文字色 */
  textColor: string;
}

/** 阵营色映射 */
export interface FactionColorDef {
  /** 阵营 */
  faction: string;
  /** 主色 */
  primaryColor: string;
  /** 辅色 */
  secondaryColor: string;
  /** 背景色 */
  backgroundColor: string;
}

/** 功能色映射 */
export interface FunctionalColorDef {
  /** 功能名 */
  name: string;
  /** 用途描述 */
  description: string;
  /** 标准色值 */
  standardColor: string;
  /** 允许的色值范围 (HSL 色相偏移) */
  hueTolerance: number;
}

/** 状态色映射 */
export interface StatusColorDef {
  /** 状态 */
  status: string;
  /** 标准色值 */
  standardColor: string;
  /** 用途 */
  usage: string;
}

/** 配色检查结果 */
export interface ColorCheckResult {
  /** 检查项 ID */
  checkId: string;
  /** 用途分类 */
  category: ColorUsageCategory;
  /** 检查的属性 */
  property: string;
  /** 期望色值 */
  expectedColor: string;
  /** 实际色值 */
  actualColor: string;
  /** 色差 (0~100, ≤5 为可接受) */
  colorDifference: number;
  /** 是否通过 */
  passed: boolean;
}

/** 配色规范报告 */
export interface ColorAuditReport {
  /** 报告 ID */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** 各分类检查结果 */
  results: ColorCheckResult[];
  /** 汇总 */
  summary: ColorAuditSummary;
}

/** 配色规范汇总 */
export interface ColorAuditSummary {
  /** 总检查项 */
  totalChecks: number;
  /** 通过数 */
  passedChecks: number;
  /** 失败数 */
  failedChecks: number;
  /** 一致性评分 (0~100) */
  consistencyScore: number;
}

// ─────────────────────────────────────────────
// 4. 视觉一致性综合报告
// ─────────────────────────────────────────────

/** 视觉一致性综合报告 */
export interface VisualConsistencyReport {
  /** 报告 ID */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** 交互审查报告 */
  interactionReport: InteractionAuditReport;
  /** 动画审查报告 */
  animationReport: AnimationAuditReport;
  /** 配色审查报告 */
  colorReport: ColorAuditReport;
  /** 综合评分 (0~100) */
  overallScore: number;
}
