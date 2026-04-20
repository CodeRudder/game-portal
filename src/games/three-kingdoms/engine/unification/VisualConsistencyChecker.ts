/**
 * 引擎层 — 视觉一致性检查器
 *
 * 自动化审查配色/动画规范的一致性：
 *   - 动画规范终审 (#14): 过渡/状态/反馈/装饰4类动画时长/缓动一致性审查
 *   - 全局配色规范 (#15): 5品质色+阵营色+功能色+状态色全系统统一审查
 *   - 综合评分: 交互+动画+配色三维综合评分
 *
 * @module engine/unification/VisualConsistencyChecker
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  AnimationCategory,
  AnimationSpec,
  AnimationCheckResult,
  AnimationAuditReport,
  AnimationAuditSummary,
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

// ─────────────────────────────────────────────
// 默认动画规范
// ─────────────────────────────────────────────

/** 过渡动画规范 */
const TRANSITION_SPECS: AnimationSpec[] = [
  {
    id: 'ANI-T-001', category: 'transition',
    standardDurationMs: 300, durationToleranceMs: 50,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-T-002', category: 'transition',
    standardDurationMs: 200, durationToleranceMs: 30,
    standardEasing: 'ease-in', standardDelayMs: 0,
  },
  {
    id: 'ANI-T-003', category: 'transition',
    standardDurationMs: 200, durationToleranceMs: 30,
    standardEasing: 'ease-in-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-T-004', category: 'transition',
    standardDurationMs: 500, durationToleranceMs: 80,
    standardEasing: 'ease', standardDelayMs: 0,
  },
  {
    id: 'ANI-T-005', category: 'transition',
    standardDurationMs: 250, durationToleranceMs: 40,
    standardEasing: 'spring(1,0.8)', standardDelayMs: 0,
  },
];

/** 状态变化动画规范 */
const STATE_CHANGE_SPECS: AnimationSpec[] = [
  {
    id: 'ANI-S-001', category: 'state_change',
    standardDurationMs: 150, durationToleranceMs: 30,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-S-002', category: 'state_change',
    standardDurationMs: 80, durationToleranceMs: 20,
    standardEasing: 'ease-in', standardDelayMs: 0,
  },
  {
    id: 'ANI-S-003', category: 'state_change',
    standardDurationMs: 120, durationToleranceMs: 20,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-S-004', category: 'state_change',
    standardDurationMs: 200, durationToleranceMs: 30,
    standardEasing: 'ease-in-out', standardDelayMs: 0,
  },
];

/** 反馈动画规范 */
const FEEDBACK_SPECS: AnimationSpec[] = [
  {
    id: 'ANI-F-001', category: 'feedback',
    standardDurationMs: 800, durationToleranceMs: 100,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-F-002', category: 'feedback',
    standardDurationMs: 1000, durationToleranceMs: 150,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
  {
    id: 'ANI-F-003', category: 'feedback',
    standardDurationMs: 2000, durationToleranceMs: 200,
    standardEasing: 'ease-in-out', standardDelayMs: 0,
  },
];

/** 入场动画规范 */
const ENTRANCE_SPECS: AnimationSpec[] = [
  {
    id: 'ANI-E-001', category: 'entrance',
    standardDurationMs: 300, durationToleranceMs: 50,
    standardEasing: 'ease-out', standardDelayMs: 0,
  },
];

/** 退场动画规范 */
const EXIT_SPECS: AnimationSpec[] = [
  {
    id: 'ANI-X-001', category: 'exit',
    standardDurationMs: 200, durationToleranceMs: 30,
    standardEasing: 'ease-in', standardDelayMs: 0,
  },
];

/** 所有默认动画规范 */
const ALL_ANIMATION_SPECS: AnimationSpec[] = [
  ...TRANSITION_SPECS,
  ...STATE_CHANGE_SPECS,
  ...FEEDBACK_SPECS,
  ...ENTRANCE_SPECS,
  ...EXIT_SPECS,
];

// ─────────────────────────────────────────────
// 默认配色规范
// ─────────────────────────────────────────────

/** 品质色 */
const DEFAULT_QUALITY_COLORS: QualityColorDef[] = [
  { quality: 'COMMON', primaryColor: '#9E9E9E', borderColor: '#757575', backgroundColor: '#F5F5F5', textColor: '#424242' },
  { quality: 'FINE', primaryColor: '#4CAF50', borderColor: '#388E3C', backgroundColor: '#E8F5E9', textColor: '#1B5E20' },
  { quality: 'RARE', primaryColor: '#2196F3', borderColor: '#1565C0', backgroundColor: '#E3F2FD', textColor: '#0D47A1' },
  { quality: 'EPIC', primaryColor: '#9C27B0', borderColor: '#7B1FA2', backgroundColor: '#F3E5F5', textColor: '#4A148C' },
  { quality: 'LEGENDARY', primaryColor: '#FF9800', borderColor: '#E65100', backgroundColor: '#FFF3E0', textColor: '#BF360C' },
];

/** 阵营色 */
const DEFAULT_FACTION_COLORS: FactionColorDef[] = [
  { faction: 'wei', primaryColor: '#1565C0', secondaryColor: '#42A5F5', backgroundColor: '#E3F2FD' },
  { faction: 'shu', primaryColor: '#2E7D32', secondaryColor: '#66BB6A', backgroundColor: '#E8F5E9' },
  { faction: 'wu', primaryColor: '#C62828', secondaryColor: '#EF5350', backgroundColor: '#FFEBEE' },
  { faction: 'neutral', primaryColor: '#616161', secondaryColor: '#9E9E9E', backgroundColor: '#F5F5F5' },
];

/** 功能色 */
const DEFAULT_FUNCTIONAL_COLORS: FunctionalColorDef[] = [
  { name: 'confirm', description: '确认操作', standardColor: '#4CAF50', hueTolerance: 15 },
  { name: 'cancel', description: '取消操作', standardColor: '#F44336', hueTolerance: 15 },
  { name: 'warning', description: '警告提示', standardColor: '#FF9800', hueTolerance: 15 },
  { name: 'info', description: '信息提示', standardColor: '#2196F3', hueTolerance: 15 },
  { name: 'gold', description: '高级货币', standardColor: '#FFD700', hueTolerance: 10 },
];

/** 状态色 */
const DEFAULT_STATUS_COLORS: StatusColorDef[] = [
  { status: 'online', standardColor: '#4CAF50', usage: '在线/正常/完成' },
  { status: 'offline', standardColor: '#9E9E9E', usage: '离线/未开始' },
  { status: 'busy', standardColor: '#FF9800', usage: '忙碌/进行中' },
  { status: 'error', standardColor: '#F44336', usage: '错误/失败' },
  { status: 'locked', standardColor: '#616161', usage: '锁定/不可用' },
];

// ─────────────────────────────────────────────
// 注册的动画实例
// ─────────────────────────────────────────────

/** 注册的动画实例 */
interface RegisteredAnimation {
  /** 动画标识 */
  id: string;
  /** 动画类型 */
  category: AnimationCategory;
  /** 实际时长 (ms) */
  durationMs: number;
  /** 实际缓动函数 */
  easing: string;
  /** 关联的规范 ID */
  specId?: string;
}

/** 注册的颜色使用 */
interface RegisteredColor {
  /** 检查项 ID */
  id: string;
  /** 用途分类 */
  category: ColorUsageCategory;
  /** CSS 属性 */
  property: string;
  /** 实际色值 */
  color: string;
  /** 关联品质/阵营/功能/状态名 */
  referenceName: string;
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 解析十六进制颜色为 RGB */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/** 计算两个颜色的色差（CIE76 简化版） */
function colorDifference(c1: string, c2: string): number {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  if (!rgb1 || !rgb2) return 100;

  const dr = rgb1.r - rgb2.r;
  const dg = rgb1.g - rgb2.g;
  const db = rgb1.b - rgb2.b;

  // 简化欧几里得距离，归一化到 0~100
  const distance = Math.sqrt(dr * dr + dg * dg + db * db);
  return Math.round((distance / 441.67) * 100); // 441.67 = sqrt(255^2 * 3)
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
  private animationSpecs: AnimationSpec[] = [...ALL_ANIMATION_SPECS];
  private registeredAnimations: RegisteredAnimation[] = [];
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
      specCount: this.animationSpecs.length,
      animationCount: this.registeredAnimations.length,
      colorCount: this.registeredColors.length,
    };
  }

  reset(): void {
    this.animationSpecs = [...ALL_ANIMATION_SPECS];
    this.registeredAnimations = [];
    this.qualityColors = [...DEFAULT_QUALITY_COLORS];
    this.factionColors = [...DEFAULT_FACTION_COLORS];
    this.functionalColors = [...DEFAULT_FUNCTIONAL_COLORS];
    this.statusColors = [...DEFAULT_STATUS_COLORS];
    this.registeredColors = [];
    this.lastReport = null;
  }

  // ─── 动画规范管理 (#14) ───────────────────

  /** 添加动画规范 */
  addAnimationSpec(spec: AnimationSpec): void {
    this.animationSpecs.push(spec);
  }

  /** 获取所有动画规范 */
  getAnimationSpecs(): AnimationSpec[] {
    return [...this.animationSpecs];
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

  /** 审查动画规范 */
  auditAnimations(): AnimationAuditReport {
    const results: AnimationCheckResult[] = [];

    for (const anim of this.registeredAnimations) {
      // 找到匹配的规范
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

    // 综合评分：动画合规率 * 50 + 配色一致性 * 50
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
