/**
 * 引擎层 — 视觉一致性检查器
 *
 * 自动化审查配色/动画规范的一致性：
 *   - 动画规范终审 (#14): 过渡/状态/反馈/装饰4类动画时长/缓动一致性审查
 *   - 全局配色规范 (#15): 5品质色+阵营色+功能色+状态色全系统统一审查
 *   - 综合评分: 交互+动画+配色三维综合评分
 *
 * 动画审计逻辑已拆分到 AnimationAuditor。
 * 动画/配色默认值和工具函数已拆分到 VisualSpecDefaults。
 *
 * @module engine/unification/VisualConsistencyChecker
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  AnimationCategory,
  ColorUsageCategory,
  QualityColorDef,
  FactionColorDef,
  FunctionalColorDef,
  StatusColorDef,
  ColorCheckResult,
  ColorAuditReport,
  ColorAuditSummary,
  VisualConsistencyReport,
} from '../../core/unification';

import {
  DEFAULT_QUALITY_COLORS,
  DEFAULT_FACTION_COLORS,
  DEFAULT_FUNCTIONAL_COLORS,
  DEFAULT_STATUS_COLORS,
  colorDifference,
} from './VisualSpecDefaults';
import { AnimationAuditor } from './AnimationAuditor';

// ─────────────────────────────────────────────
// 注册的颜色使用
// ─────────────────────────────────────────────

/** 注册的颜色使用 */
interface RegisteredColor {
  id: string;
  category: ColorUsageCategory;
  property: string;
  color: string;
  referenceName: string;
}

// ─────────────────────────────────────────────
// 视觉一致性检查器
// ─────────────────────────────────────────────

/**
 * 视觉一致性检查器
 *
 * 管理动画规范和配色规范，检查注册实例的一致性，生成报告。
 */
export class VisualConsistencyChecker implements ISubsystem {
  readonly name = 'visual-consistency-checker';

  private deps!: ISystemDeps;
  private animationAuditor = new AnimationAuditor();
  private qualityColors: QualityColorDef[] = [...DEFAULT_QUALITY_COLORS];
  private factionColors: FactionColorDef[] = [...DEFAULT_FACTION_COLORS];
  private functionalColors: FunctionalColorDef[] = [...DEFAULT_FUNCTIONAL_COLORS];
  private statusColors: StatusColorDef[] = [...DEFAULT_STATUS_COLORS];
  private registeredColors: RegisteredColor[] = [];
  private lastReport: VisualConsistencyReport | null = null;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void {
    // 检查器按需运行
  }

  getState(): { lastReport: VisualConsistencyReport | null; specCount: number; animationCount: number; colorCount: number } {
    return {
      lastReport: this.lastReport,
      specCount: this.animationAuditor.getAnimationSpecs().length,
      animationCount: this.animationAuditor.getAnimationCount(),
      colorCount: this.registeredColors.length,
    };
  }

  reset(): void {
    this.animationAuditor.resetSpecs();
    this.animationAuditor.clearAnimations();
    this.qualityColors = [...DEFAULT_QUALITY_COLORS];
    this.factionColors = [...DEFAULT_FACTION_COLORS];
    this.functionalColors = [...DEFAULT_FUNCTIONAL_COLORS];
    this.statusColors = [...DEFAULT_STATUS_COLORS];
    this.registeredColors = [];
    this.lastReport = null;
  }

  // ─── 动画规范管理 (#14) ───────────────────

  /** 添加动画规范 */
  addAnimationSpec(spec: Parameters<AnimationAuditor['addAnimationSpec']>[0]): void {
    this.animationAuditor.addAnimationSpec(spec);
  }

  /** 获取所有动画规范 */
  getAnimationSpecs(): ReturnType<AnimationAuditor['getAnimationSpecs']> {
    return this.animationAuditor.getAnimationSpecs();
  }

  /** 注册动画实例 */
  registerAnimation(
    id: string,
    category: AnimationCategory,
    durationMs: number,
    easing: string,
    specId?: string,
  ): void {
    this.animationAuditor.registerAnimation(id, category, durationMs, easing, specId);
  }

  /** 注销动画实例 */
  unregisterAnimation(id: string): void {
    this.animationAuditor.unregisterAnimation(id);
  }

  /** 获取注册的动画数量 */
  getAnimationCount(): number {
    return this.animationAuditor.getAnimationCount();
  }

  /** 审查动画规范 */
  auditAnimations(): ReturnType<AnimationAuditor['auditAnimations']> {
    return this.animationAuditor.auditAnimations();
  }

  // ─── 配色规范管理 (#15) ───────────────────

  /** 设置品质色 */
  setQualityColors(colors: QualityColorDef[]): void {
    this.qualityColors = colors;
  }

  /** 设置阵营色 */
  setFactionColors(colors: FactionColorDef[]): void {
    this.factionColors = colors;
  }

  /** 设置功能色 */
  setFunctionalColors(colors: FunctionalColorDef[]): void {
    this.functionalColors = colors;
  }

  /** 设置状态色 */
  setStatusColors(colors: StatusColorDef[]): void {
    this.statusColors = colors;
  }

  /** 获取品质色 */
  getQualityColors(): QualityColorDef[] {
    return [...this.qualityColors];
  }

  /** 获取阵营色 */
  getFactionColors(): FactionColorDef[] {
    return [...this.factionColors];
  }

  /** 获取功能色 */
  getFunctionalColors(): FunctionalColorDef[] {
    return [...this.functionalColors];
  }

  /** 获取状态色 */
  getStatusColors(): StatusColorDef[] {
    return [...this.statusColors];
  }

  /** 注册颜色使用 */
  registerColor(
    id: string,
    category: ColorUsageCategory,
    property: string,
    color: string,
    referenceName: string,
  ): void {
    if (this.registeredColors.some(c => c.id === id)) return;
    this.registeredColors.push({ id, category, property, color, referenceName });
  }

  /** 注销颜色使用 */
  unregisterColor(id: string): void {
    this.registeredColors = this.registeredColors.filter(c => c.id !== id);
  }

  /** 获取注册颜色数量 */
  getColorCount(): number {
    return this.registeredColors.length;
  }

  /** 审查配色规范 */
  auditColors(): ColorAuditReport {
    const results: ColorCheckResult[] = [];

    for (const regColor of this.registeredColors) {
      const expectedColor = this.findExpectedColor(regColor.category, regColor.referenceName, regColor.property);

      if (!expectedColor) {
        results.push({
          checkId: regColor.id,
          category: regColor.category,
          property: regColor.property,
          expectedColor: 'unknown',
          actualColor: regColor.color,
          colorDifference: 100,
          passed: false,
        });
        continue;
      }

      const diff = colorDifference(regColor.color, expectedColor);
      const passed = diff <= 5;

      results.push({
        checkId: regColor.id,
        category: regColor.category,
        property: regColor.property,
        expectedColor,
        actualColor: regColor.color,
        colorDifference: diff,
        passed,
      });
    }

    const passedChecks = results.filter(r => r.passed).length;
    const failedChecks = results.length - passedChecks;
    const consistencyScore = results.length > 0
      ? Math.round((passedChecks / results.length) * 100)
      : 100;

    const summary: ColorAuditSummary = {
      totalChecks: results.length,
      passedChecks,
      failedChecks,
      consistencyScore,
    };

    return {
      id: `audit_clr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      results,
      summary,
    };
  }

  /** 查找期望色值 */
  private findExpectedColor(
    category: ColorUsageCategory,
    referenceName: string,
    property: string,
  ): string | null {
    switch (category) {
      case 'quality': {
        const def = this.qualityColors.find(c => c.quality === referenceName);
        if (!def) return null;
        if (property.includes('border')) return def.borderColor;
        if (property.includes('background')) return def.backgroundColor;
        if (property.includes('text') || property.includes('color')) return def.textColor;
        return def.primaryColor;
      }
      case 'faction': {
        const def = this.factionColors.find(c => c.faction === referenceName);
        if (!def) return null;
        if (property.includes('secondary')) return def.secondaryColor;
        if (property.includes('background')) return def.backgroundColor;
        return def.primaryColor;
      }
      case 'functional': {
        const def = this.functionalColors.find(c => c.name === referenceName);
        return def?.standardColor ?? null;
      }
      case 'status': {
        const def = this.statusColors.find(c => c.status === referenceName);
        return def?.standardColor ?? null;
      }
    }
  }

  // ─── 综合报告 ──────────────────────────────

  /** 生成视觉一致性综合报告 */
  generateReport(): VisualConsistencyReport {
    const animationReport = this.auditAnimations();
    const colorReport = this.auditColors();

    const overallScore = Math.round(
      animationReport.summary.complianceRate * 50 +
      (colorReport.summary.consistencyScore / 100) * 50,
    );

    const report: VisualConsistencyReport = {
      id: `audit_vis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      interactionReport: {
        id: '',
        timestamp: Date.now(),
        totalComponents: 0,
        results: [],
        summary: {
          totalRules: 0, passedRules: 0, failedRules: 0,
          errorCount: 0, warningCount: 0, consistencyScore: 100,
        },
      },
      animationReport,
      colorReport,
      overallScore,
    };

    this.lastReport = report;
    return report;
  }

  /** 获取最后一次报告 */
  getLastReport(): VisualConsistencyReport | null {
    return this.lastReport;
  }
}
