/**
 * UIReviewScorer — UI评测框架自动评分系统
 *
 * 综合PlanValidator和PrdChecker结果，按5维度进行10分制评分。
 *
 * 维度：功能完整性(30%) | 代码质量(20%) | 测试覆盖(20%) | UI/UX体验(15%) | 架构设计(15%)
 *
 * @module ui-review/UIReviewScorer
 */

import { PlanValidator, type PlanValidationResult } from './PlanValidator';
import { PrdChecker, type PrdCheckResult } from './PrdChecker';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface ScoreDimension {
  name: string;
  weight: number;
  maxScore: number;
}

export interface DimensionScore {
  dimension: string;
  score: number;
  maxScore: number;
  weight: number;
  weightedScore: number;
  findings: string[];
}

export interface VersionReviewReport {
  version: string;
  totalScore: number;
  maxScore: number;
  passed: boolean;
  dimensions: DimensionScore[];
  planCoverage: number;
  prdCoverage: number;
  summary: string;
  timestamp: number;
}

export interface UIReviewScorerOptions {
  dimensions?: ScoreDimension[];
  passThreshold?: number;
}

/** 默认评分维度（5维度，与game-reviewer一致） */
export const DEFAULT_DIMENSIONS: ScoreDimension[] = [
  { name: '功能完整性', weight: 0.30, maxScore: 10 },
  { name: '代码质量',   weight: 0.20, maxScore: 10 },
  { name: '测试覆盖',   weight: 0.20, maxScore: 10 },
  { name: 'UI/UX体验',  weight: 0.15, maxScore: 10 },
  { name: '架构设计',   weight: 0.15, maxScore: 10 },
];

// ---------------------------------------------------------------------------
// UIReviewScorer
// ---------------------------------------------------------------------------

export class UIReviewScorer {
  private planValidator: PlanValidator;
  private prdChecker: PrdChecker;
  private dimensions: ScoreDimension[];
  private passThreshold: number;

  constructor(options?: UIReviewScorerOptions) {
    this.planValidator = new PlanValidator();
    this.prdChecker = new PrdChecker();
    this.dimensions = options?.dimensions ?? DEFAULT_DIMENSIONS;
    this.passThreshold = options?.passThreshold ?? 9.9;
  }

  /** 对单个版本进行完整评测 */
  reviewVersion(params: {
    version: string;
    planMarkdown: string;
    prdMarkdowns: string[];
    sourceFiles: string[];
    testFiles: string[];
  }): VersionReviewReport {
    const { version, planMarkdown, prdMarkdowns, sourceFiles, testFiles } = params;
    const sourceContents = this.readFilesSync(sourceFiles);

    const plan = this.planValidator.parsePlanDocument(planMarkdown);
    const planResult = this.planValidator.validate(plan, sourceFiles, sourceContents);

    const prdResults = prdMarkdowns.map((md) => {
      const prd = this.prdChecker.parsePrdDocument(md);
      return this.prdChecker.check(prd, sourceFiles, sourceContents);
    });

    const prdCoverage = this.aggregatePrdCoverage(prdResults);

    const dimensions = [
      this.scoreFunctionality(planResult, prdResults),
      this.scoreCodeQuality(sourceFiles),
      this.scoreTestCoverage(testFiles, sourceFiles),
      this.scoreUIUX(planResult),
      this.scoreArchitecture(sourceFiles),
    ];

    const totalScore = parseFloat(
      dimensions.reduce((s, d) => s + d.weightedScore, 0).toFixed(2),
    );

    return {
      version, totalScore, maxScore: 10.0,
      passed: totalScore >= this.passThreshold,
      dimensions, planCoverage: planResult.coveragePercent, prdCoverage,
      summary: this.buildSummary(version, planResult.coveragePercent, prdCoverage, totalScore),
      timestamp: Date.now(),
    };
  }

  /** 生成汇总报告文本 */
  generateReportText(report: VersionReviewReport): string {
    const lines = [
      `# UI评测报告 — ${report.version}`, '',
      `**总分**: ${report.totalScore}/${report.maxScore}`,
      `**判定**: ${report.passed ? '✅ 通过' : '❌ 未通过'} (阈值: ${this.passThreshold})`,
      '', '## 覆盖率',
      `- PLAN功能点覆盖率: ${report.planCoverage}%`,
      `- PRD需求覆盖率: ${report.prdCoverage}%`,
      '', '## 维度评分',
      '| 维度 | 得分 | 满分 | 权重 | 加权分 |',
      '|------|------|------|------|--------|',
    ];
    for (const d of report.dimensions)
      lines.push(`| ${d.dimension} | ${d.score} | ${d.maxScore} | ${d.weight} | ${d.weightedScore.toFixed(2)} |`);
    lines.push('', '## 评分发现');
    for (const d of report.dimensions) {
      if (d.findings.length > 0) {
        lines.push(`### ${d.dimension}`);
        d.findings.forEach((f) => lines.push(`- ${f}`));
        lines.push('');
      }
    }
    lines.push('---', `生成时间: ${new Date(report.timestamp).toISOString()}`);
    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // 维度评分
  // -----------------------------------------------------------------------

  /** 功能完整性（30%）：planCoverage*0.6 + prdCoverage*0.4 → 10分制 */
  private scoreFunctionality(planResult: PlanValidationResult, prdResults: PrdCheckResult[]): DimensionScore {
    const dim = this.getDim('功能完整性');
    const findings: string[] = [];
    const planCov = planResult.coveragePercent;
    const prdCov = this.aggregatePrdCoverage(prdResults);
    const combined = planCov * 0.6 + prdCov * 0.4;
    const score = parseFloat(((combined / 100) * dim.maxScore).toFixed(2));
    if (planResult.missingFeatures.length > 0)
      findings.push(`PLAN缺失功能点: ${planResult.missingFeatures.join(', ')}`);
    findings.push(`PLAN覆盖率: ${planCov}%`, `PRD覆盖率: ${prdCov}%`);
    return this.makeDimScore(dim, score, findings);
  }

  /** 代码质量（20%）：TypeScript严格模式、文件行数≤500、命名规范 */
  private scoreCodeQuality(sourceFiles: string[]): DimensionScore {
    const dim = this.getDim('代码质量');
    if (sourceFiles.length === 0) return this.zeroDim(dim, ['无源码文件']);
    let penalty = 0;
    const findings: string[] = [];
    let oversized = 0, withTypes = 0;
    for (const fp of sourceFiles) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const content: string = require('fs').readFileSync(fp, 'utf-8');
        const lc = content.split('\n').length;
        if (lc > 500) { oversized++; findings.push(`文件过长: ${fp} (${lc}行)`); }
        if (/:\s*(string|number|boolean|void)/.test(content)) withTypes++;
      } catch { penalty += 0.5; findings.push(`无法读取: ${fp}`); }
    }
    penalty += oversized * 0.5;
    if (withTypes / sourceFiles.length < 0.5) { penalty += 1; findings.push('类型注解覆盖率低'); }
    if (oversized === 0) findings.push('所有文件行数 ≤ 500');
    return this.makeDimScore(dim, Math.max(0, parseFloat((dim.maxScore - penalty).toFixed(2))), findings);
  }

  /** 测试覆盖（20%）：测试文件数/源码文件数比率 */
  private scoreTestCoverage(testFiles: string[], sourceFiles: string[]): DimensionScore {
    const dim = this.getDim('测试覆盖');
    if (sourceFiles.length === 0)
      return this.makeDimScore(dim, dim.maxScore, ['无源码文件，测试覆盖默认满分']);
    const ratio = testFiles.length / sourceFiles.length;
    const score = parseFloat((Math.min(1, ratio) * dim.maxScore).toFixed(2));
    const findings = [
      `测试文件数: ${testFiles.length}`, `源码文件数: ${sourceFiles.length}`,
      `测试/源码比率: ${ratio.toFixed(2)}`,
    ];
    if (ratio < 1) findings.push(`测试覆盖不足，建议补充 ${sourceFiles.length - testFiles.length} 个测试文件`);
    return this.makeDimScore(dim, score, findings);
  }

  /** UI/UX体验（15%）：PLAN中UI相关功能点的实现状态 */
  private scoreUIUX(planResult: PlanValidationResult): DimensionScore {
    const dim = this.getDim('UI/UX体验');
    if (planResult.totalFeatures === 0) return this.zeroDim(dim, ['PLAN中无功能点']);
    const uiKw = ['UI','界面','面板','弹窗','Toast','导航','Tab','按钮','布局',
      '动画','样式','配色','字体','间距','交互','Modal','Panel','适配','响应','竖屏'];
    const uiFeatures = planResult.details.filter((d) =>
      uiKw.some((kw) => d.feature.description.toLowerCase().includes(kw.toLowerCase())));
    if (uiFeatures.length === 0) {
      const score = parseFloat(((planResult.coveragePercent / 100) * dim.maxScore).toFixed(2));
      return this.makeDimScore(dim, score, ['未发现明确UI功能点，使用整体覆盖率']);
    }
    const verified = uiFeatures.filter((d) => d.status === 'verified' || d.status === 'partial').length;
    const cov = verified / uiFeatures.length;
    return this.makeDimScore(dim, parseFloat((cov * dim.maxScore).toFixed(2)), [
      `UI功能点总数: ${uiFeatures.length}`, `已实现: ${verified}`,
      `UI覆盖率: ${(cov * 100).toFixed(0)}%`,
    ]);
  }

  /** 架构设计（15%）：分层结构（core/engine/ui分离）、依赖方向 */
  private scoreArchitecture(sourceFiles: string[]): DimensionScore {
    const dim = this.getDim('架构设计');
    if (sourceFiles.length === 0) return this.zeroDim(dim, ['无源码文件']);
    let penalty = 0;
    const findings: string[] = [];
    const layers = { core: 0, engine: 0, ui: 0, renderer: 0, other: 0 };
    for (const f of sourceFiles) {
      if (f.includes('/core/') || f.includes('\\core\\')) layers.core++;
      else if (f.includes('/engine/') || f.includes('\\engine\\')) layers.engine++;
      else if (f.includes('/ui/') || f.includes('\\ui\\')) layers.ui++;
      else if (f.includes('/renderer/') || f.includes('\\renderer\\')) layers.renderer++;
      else layers.other++;
    }
    if (layers.core > 0 || layers.engine > 0 || layers.ui > 0)
      findings.push(`分层: core(${layers.core}) engine(${layers.engine}) ui(${layers.ui}) renderer(${layers.renderer})`);
    else { penalty += 2; findings.push('未检测到分层结构（core/engine/ui）'); }
    const uncategorized = layers.other / sourceFiles.length;
    if (uncategorized > 0.5) { penalty += 1; findings.push(`未分类文件占比: ${(uncategorized * 100).toFixed(0)}%`); }
    else if (uncategorized <= 0.3) findings.push('文件组织良好');
    return this.makeDimScore(dim, Math.max(0, parseFloat((dim.maxScore - penalty).toFixed(2))), findings);
  }

  // -----------------------------------------------------------------------
  // 辅助方法
  // -----------------------------------------------------------------------

  private aggregatePrdCoverage(results: PrdCheckResult[]): number {
    if (results.length === 0) return 100;
    const total = results.reduce((s, r) => s + r.totalRequirements, 0);
    const sat = results.reduce((s, r) => s + r.satisfiedRequirements, 0);
    return total > 0 ? Math.round((sat / total) * 100) : 100;
  }

  private readFilesSync(paths: string[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const p of paths) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        map.set(p, require('fs').readFileSync(p, 'utf-8'));
      } catch { map.set(p, ''); }
    }
    return map;
  }

  private getDim(name: string): ScoreDimension {
    const d = this.dimensions.find((x) => x.name === name);
    if (!d) throw new Error(`评分维度 "${name}" 未定义`);
    return d;
  }

  private makeDimScore(dim: ScoreDimension, score: number, findings: string[]): DimensionScore {
    return {
      dimension: dim.name, score, maxScore: dim.maxScore, weight: dim.weight,
      weightedScore: parseFloat((score * dim.weight).toFixed(2)), findings,
    };
  }

  private zeroDim(dim: ScoreDimension, findings: string[]): DimensionScore {
    return { dimension: dim.name, score: 0, maxScore: dim.maxScore, weight: dim.weight, weightedScore: 0, findings };
  }

  private buildSummary(ver: string, planCov: number, prdCov: number, total: number): string {
    const s = total >= this.passThreshold ? '通过' : '未通过';
    return `${ver} UI评测${s}，总分 ${total}/10。PLAN覆盖率 ${planCov}%，PRD覆盖率 ${prdCov}%。`;
  }
}
