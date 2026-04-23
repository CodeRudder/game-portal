/**
 * 引擎层 — 交互审查器
 *
 * 自动化检查所有 UI 组件交互一致性：
 *   - 全局交互一致性 (#13): 按钮/面板/弹窗/列表交互行为统一规范审查
 *   - 注册交互规则 → 收集组件 → 逐一检查 → 生成报告
 *
 * @module engine/unification/InteractionAuditor
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  UIComponentType,
  InteractionState,
  InteractionRule,
  FeedbackType,
  InteractionCheckResult,
  InteractionViolation,
  InteractionAuditReport,
  InteractionAuditSummary,
} from '../../core/unification';
import { ALL_DEFAULT_RULES } from './InteractionRules.defaults';

// ─────────────────────────────────────────────
// 组件注册信息
// ─────────────────────────────────────────────

/** 注册的 UI 组件信息 */
interface RegisteredComponent {
  /** 组件 ID */
  id: string;
  /** 组件类型 */
  type: UIComponentType;
  /** 支持的交互状态 */
  supportedStates: InteractionState[];
  /** 支持的反馈类型 */
  supportedFeedback: FeedbackType[];
}

// ─────────────────────────────────────────────
// 交互审查器
// ─────────────────────────────────────────────

/**
 * 交互审查器
 *
 * 注册交互规则和 UI 组件，逐一检查一致性，生成审查报告。
 */
export class InteractionAuditor implements ISubsystem {
  readonly name = 'interaction-auditor';

  private deps!: ISystemDeps;
  private rules: InteractionRule[] = [...ALL_DEFAULT_RULES];
  private components: RegisteredComponent[] = [];
  private lastReport: InteractionAuditReport | null = null;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 审查器按需运行
  }

  getState(): { lastReport: InteractionAuditReport | null; ruleCount: number; componentCount: number } {
    return {
      lastReport: this.lastReport,
      ruleCount: this.rules.length,
      componentCount: this.components.length,
    };
  }

  reset(): void {
    this.rules = [...ALL_DEFAULT_RULES];
    this.components = [];
    this.lastReport = null;
  }

  // ─── 规则管理 ──────────────────────────────

  /** 添加自定义规则 */
  addRule(rule: InteractionRule): void {
    this.rules.push(rule);
  }

  /** 移除规则 */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /** 获取所有规则 */
  getRules(): InteractionRule[] {
    return [...this.rules];
  }

  /** 获取指定组件类型的规则 */
  getRulesForType(type: UIComponentType): InteractionRule[] {
    return this.rules.filter(r => r.componentType === type);
  }

  // ─── 组件注册 ──────────────────────────────

  /** 注册 UI 组件 */
  registerComponent(
    id: string,
    type: UIComponentType,
    supportedStates: InteractionState[],
    supportedFeedback: FeedbackType[],
  ): void {
    // 避免重复注册
    if (this.components.some(c => c.id === id)) {
      return;
    }
    this.components.push({ id, type, supportedStates, supportedFeedback });
  }

  /** 注销 UI 组件 */
  unregisterComponent(id: string): void {
    this.components = this.components.filter(c => c.id !== id);
  }

  /** 获取所有注册组件 */
  getComponents(): RegisteredComponent[] {
    return [...this.components];
  }

  /** 获取注册组件数量 */
  getComponentCount(): number {
    return this.components.length;
  }

  // ─── 审查执行 ──────────────────────────────

  /** 运行完整审查 */
  audit(): InteractionAuditReport {
    const results: InteractionCheckResult[] = [];

    for (const component of this.components) {
      const result = this.checkComponent(component);
      results.push(result);
    }

    const summary = this.buildSummary(results);

    const report: InteractionAuditReport = {
      id: `audit_int_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      totalComponents: this.components.length,
      results,
      summary,
    };

    this.lastReport = report;
    return report;
  }

  /** 检查单个组件 */
  private checkComponent(component: RegisteredComponent): InteractionCheckResult {
    const applicableRules = this.rules.filter(r => r.componentType === component.type);
    const violations: InteractionViolation[] = [];
    let passedRules = 0;
    let failedRules = 0;

    for (const rule of applicableRules) {
      // 检查组件是否支持该状态
      const stateSupported = component.supportedStates.includes(rule.state);

      if (rule.required && !stateSupported) {
        violations.push({
          ruleId: rule.id,
          expected: rule.expectedBehavior,
          actual: `State '${rule.state}' not supported`,
          severity: 'error',
          suggestion: `Add support for '${rule.state}' state to component '${component.id}'`,
        });
        failedRules++;
        continue;
      }

      // 检查反馈类型
      const missingFeedback = rule.expectedFeedback.filter(
        f => !component.supportedFeedback.includes(f),
      );

      if (rule.required && missingFeedback.length > 0 && stateSupported) {
        violations.push({
          ruleId: rule.id,
          expected: `Feedback: ${rule.expectedFeedback.join(', ')}`,
          actual: `Missing: ${missingFeedback.join(', ')}`,
          severity: 'warning',
          suggestion: `Add missing feedback types: ${missingFeedback.join(', ')}`,
        });
        failedRules++;
      } else {
        passedRules++;
      }
    }

    return {
      componentId: component.id,
      componentType: component.type,
      checkedStates: applicableRules.map(r => r.state),
      passedRules,
      failedRules,
      violations,
    };
  }

  /** 构建审查汇总 */
  private buildSummary(results: InteractionCheckResult[]): InteractionAuditSummary {
    let totalRules = 0;
    let passedRules = 0;
    let failedRules = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (const result of results) {
      totalRules += result.passedRules + result.failedRules;
      passedRules += result.passedRules;
      failedRules += result.failedRules;
      errorCount += result.violations.filter(v => v.severity === 'error').length;
      warningCount += result.violations.filter(v => v.severity === 'warning').length;
    }

    const consistencyScore = totalRules > 0
      ? Math.round((passedRules / totalRules) * 100)
      : 100;

    return {
      totalRules,
      passedRules,
      failedRules,
      errorCount,
      warningCount,
      consistencyScore,
    };
  }

  // ─── 查询 ──────────────────────────────────

  /** 获取最后一次报告 */
  getLastReport(): InteractionAuditReport | null {
    return this.lastReport;
  }

  /** 按组件类型获取违规 */
  getViolationsByType(type: UIComponentType): InteractionViolation[] {
    if (!this.lastReport) return [];
    return this.lastReport.results
      .filter(r => r.componentType === type)
      .flatMap(r => r.violations);
  }

  /** 获取所有错误级别违规 */
  getErrors(): InteractionViolation[] {
    if (!this.lastReport) return [];
    return this.lastReport.results
      .flatMap(r => r.violations)
      .filter(v => v.severity === 'error');
  }
}
