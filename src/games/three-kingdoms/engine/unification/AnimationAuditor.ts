/**
 * 引擎层 — 动画规范审计器
 *
 * 管理动画规范注册，检查动画实例的一致性，生成审计报告。
 * 从 VisualConsistencyChecker 拆分而来。
 *
 * @module engine/unification/AnimationAuditor
 */

import type {
  AnimationCategory,
  AnimationSpec,
  AnimationCheckResult,
  AnimationAuditReport,
  AnimationAuditSummary,
} from '../../core/unification';
import { ALL_ANIMATION_SPECS } from './VisualSpecDefaults';

// ─────────────────────────────────────────────
// 注册的动画实例
// ─────────────────────────────────────────────

/** 注册的动画实例 */
export interface RegisteredAnimation {
  id: string;
  category: AnimationCategory;
  durationMs: number;
  easing: string;
  specId?: string;
}

// ─────────────────────────────────────────────
// 动画规范审计器
// ─────────────────────────────────────────────

/**
 * 动画规范审计器
 *
 * 管理动画规范和注册实例，审查一致性。
 */
export class AnimationAuditor {
  private animationSpecs: AnimationSpec[] = [...ALL_ANIMATION_SPECS];
  private registeredAnimations: RegisteredAnimation[] = [];

  /** 添加动画规范 */
  addAnimationSpec(spec: AnimationSpec): void {
    this.animationSpecs.push(spec);
  }

  /** 获取所有动画规范 */
  getAnimationSpecs(): AnimationSpec[] {
    return [...this.animationSpecs];
  }

  /** 重置为默认规范 */
  resetSpecs(): void {
    this.animationSpecs = [...ALL_ANIMATION_SPECS];
  }

  /** 注册动画实例 */
  registerAnimation(
    id: string,
    category: AnimationCategory,
    durationMs: number,
    easing: string,
    specId?: string,
  ): void {
    if (this.registeredAnimations.some(a => a.id === id)) return;
    this.registeredAnimations.push({ id, category, durationMs, easing, specId });
  }

  /** 注销动画实例 */
  unregisterAnimation(id: string): void {
    this.registeredAnimations = this.registeredAnimations.filter(a => a.id !== id);
  }

  /** 获取注册的动画数量 */
  getAnimationCount(): number {
    return this.registeredAnimations.length;
  }

  /** 清空注册的动画 */
  clearAnimations(): void {
    this.registeredAnimations = [];
  }

  /** 审查动画规范 */
  auditAnimations(): AnimationAuditReport {
    const results: AnimationCheckResult[] = [];

    for (const anim of this.registeredAnimations) {
      const spec = anim.specId
        ? this.animationSpecs.find(s => s.id === anim.specId)
        : this.animationSpecs.find(s => s.category === anim.category);

      if (!spec) {
        results.push({
          animationId: anim.id,
          category: anim.category,
          actualDurationMs: anim.durationMs,
          expectedDurationRange: { min: 0, max: 0 },
          actualEasing: anim.easing,
          expectedEasing: 'unknown',
          isCompliant: false,
          deviationDescription: `No matching spec for category '${anim.category}'`,
        });
        continue;
      }

      const minDuration = spec.standardDurationMs - spec.durationToleranceMs;
      const maxDuration = spec.standardDurationMs + spec.durationToleranceMs;
      const durationOk = anim.durationMs >= minDuration && anim.durationMs <= maxDuration;
      const easingOk = anim.easing === spec.standardEasing;
      const isCompliant = durationOk && easingOk;

      const deviations: string[] = [];
      if (!durationOk) {
        deviations.push(`Duration ${anim.durationMs}ms outside range [${minDuration}, ${maxDuration}]ms`);
      }
      if (!easingOk) {
        deviations.push(`Easing '${anim.easing}' != expected '${spec.standardEasing}'`);
      }

      results.push({
        animationId: anim.id,
        category: anim.category,
        actualDurationMs: anim.durationMs,
        expectedDurationRange: { min: minDuration, max: maxDuration },
        actualEasing: anim.easing,
        expectedEasing: spec.standardEasing,
        isCompliant,
        deviationDescription: deviations.join('; ') || 'Compliant',
      });
    }

    const compliantCount = results.filter(r => r.isCompliant).length;
    const nonCompliantCount = results.length - compliantCount;
    const complianceRate = results.length > 0 ? compliantCount / results.length : 1;

    const summary: AnimationAuditSummary = {
      compliantCount,
      nonCompliantCount,
      complianceRate,
    };

    return {
      id: `audit_ani_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      totalAnimations: results.length,
      results,
      summary,
    };
  }
}
