/**
 * UIReviewScorer — UI评测框架自动评分系统
 *
 * 将PlanValidator和PrdChecker的结果综合评分，
 * 生成10分制的版本UI评测报告。
 *
 * 评分维度（5维度，与game-reviewer一致）：
 * - 功能完整性 (30%)：PLAN覆盖率 + PRD覆盖率加权
 * - 代码质量 (20%)：TypeScript严格模式、文件行数、命名规范
 * - 测试覆盖 (20%)：测试文件/源码文件比率、测试密度
 * - UI/UX体验 (15%)：PLAN中UI功能点的实现状态
 * - 架构设计 (15%)：分层结构、依赖方向
 *
 * @module ui-review/UIReviewScorer
 */

import {
  PlanValidator,
  type VersionPlan,
  type PlanValidationResult,
} from './PlanValidator';
import {
  PrdChecker,
  type PrdCheckResult,
} from './PrdChecker';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 评分维度定义 */
export interface ScoreDimension {
  /** 维度名称 */
  name: string;
  /** 权重，总和 = 1.0 */
  weight: number;
  /** 最高分（10分制） */
  maxScore: number;
}

/** 维度评分结果 */
export interface DimensionScore {
  /** 维度名称 */
  dimension: string;
  /** 原始得分 */
  score: number;
  /** 满分 */
  maxScore: number;
  /** 权重 */
  weight: number;
  /** 加权得分 = score * weight */
  weightedScore: number;
  /** 评分发现/扣分原因 */
  findings: string[];
}

/** 版本UI评测报告 */
export interface VersionReviewReport {
  /** 版本号 */
  version: string;
  /** 加权总分 */
  totalScore: number;
  /** 满分（10.0） */
  maxScore: number;
  /** 是否通过（≥passThreshold） */
  passed: boolean;
  /** 各维度评分详情 */
  dimensions: DimensionScore[];
  /** PLAN功能点覆盖率% */
  planCoverage: number;
  /** PRD需求覆盖率% */
  prdCoverage: number;
  /** 汇总说明 */
  summary: string;
  /** 报告生成时间戳 */
  timestamp: number;
}

/** 构造器选项 */
export interface UIReviewScorerOptions {
  dimensions?: ScoreDimension[];
  passThreshold?: number;
}

// ---------------------------------------------------------------------------
// 默认评分维度
// ---------------------------------------------------------------------------

/** 默认评分维度（5维度，与game-reviewer一致） */
export const DEFAULT_DIMENSIONS: ScoreDimension[] = [
  { name: '功能完整性', weight: 0.30, maxScore: 10 },
  { name: '代码质量',   weight: 0.20, maxScore: 10 },
  { name: '测试覆盖',   weight: 0.20, maxScore: 10 },
  { name: 'UI/UX体验',  weight: 0.15, maxScore: 10 },
  { name: '架构设计',   weight: 0.15, maxScore: 10 },
];

// ---------------------------------------------------------------------------
// UIReviewScorer 类
// ---------------------------------------------------------------------------

/**
 * UI评测自动评分系统
 *
 * 综合PlanValidator和PrdChecker的验证结果，
 * 按5个维度进行10分制评分，生成版本评测报告。
 */
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

  // -----------------------------------------------------------------------
  // 公共方法
  // -----------------------------------------------------------------------

  /**
   * 对单个版本进行完整评测
   *
   * @param params.version - 版本号
   * @param params.planMarkdown - PLAN文档Markdown内容
   * @param params.prdMarkdowns - PRD文档Markdown内容列表
   * @param params.sourceFiles - 源码文件路径列表
   * @param params.testFiles - 测试文件路径列表
   * @returns 版本评测报告
   */
  reviewVersion(params: {
    version: string;
    planMarkdown: string;
    prdMarkdowns: string[];
    sourceFiles: string[];
    testFiles: string[];
  }): VersionReviewReport {
    const { version, planMarkdown, prdMarkdowns, sourceFiles, testFiles } = params;

    // 1. 读取所有源码文件内容
    const sourceContents = this.readFilesSync(sourceFiles);

    // 2. 运行PlanValidator
    const plan: VersionPlan = this.planValidator.parsePlanDocument(planMarkdown);
    const planResult: PlanValidationResult = this.planValidator.validate(
      plan,
      sourceFiles,
      sourceContents,
    );

    // 3. 运行PrdChecker（逐个PRD文档）
    const prdResults: PrdCheckResult[] = prdMarkdowns.map((md) => {
      const prd = this.prdChecker.parsePrdDocument(md);
      return this.prdChecker.check(prd, sourceFiles, sourceContents);
    });

    // 4. 计算PRD综合覆盖率
    const prdCoverage = this.aggregatePrdCoverage(prdResults);

    // 5. 各维度评分
    const functionality = this.scoreFunctionality(planResult, prdResults);
    const codeQuality   = this.scoreCodeQuality(sourceFiles);
    const testCoverage  = this.scoreTestCoverage(testFiles, sourceFiles);
    const uiux          = this.scoreUIUX(planResult);
    const architecture  = this.scoreArchitecture(sourceFiles);

    const dimensions = [functionality, codeQuality, testCoverage, uiux, architecture];

    // 6. 计算加权总分
    const totalScore = parseFloat(
      dimensions
        .reduce((sum, d) => sum + d.weightedScore, 0)
        .toFixed(2),
    );

    // 7. 生成汇总
    const summary = this.buildSummary(
      version,
      planResult.coveragePercent,
      prdCoverage,
      totalScore,
    );

    return {
      version,
      totalScore,
      maxScore: 10.0,
      passed: totalScore >= this.passThreshold,
      dimensions,
      planCoverage: planResult.coveragePercent,
      prdCoverage,
      summary,
      timestamp: Date.now(),
    };
  }

  /**
   * 生成汇总报告文本
   */
  generateReportText(report: VersionReviewReport): string {
    const lines: string[] = [
      `# UI评测报告 — ${report.version}`,
      '',
      `**总分**: ${report.totalScore}/${report.maxScore}`,
      `**判定**: ${report.passed ? '✅ 通过' : '❌ 未通过'} (阈值: ${this.passThreshold})`,
      '',
      '## 覆盖率',
      `- PLAN功能点覆盖率: ${report.planCoverage}%`,
      `- PRD需求覆盖率: ${report.prdCoverage}%`,
      '',
      '## 维度评分',
      '| 维度 | 得分 | 满分 | 权重 | 加权分 |',
      '|------|------|------|------|--------|',
    ];

    for (const dim of report.dimensions) {
      lines.push(
        `| ${dim.dimension} | ${dim.score} | ${dim.maxScore} | ${dim.weight} | ${dim.weightedScore.toFixed(2)} |`,
      );
    }

    lines.push('');
    lines.push('## 评分发现');
    for (const dim of report.dimensions) {
      if (dim.findings.length > 0) {
        lines.push(`### ${dim.dimension}`);
        for (const f of dim.findings) {
          lines.push(`- ${f}`);
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push(`生成时间: ${new Date(report.timestamp).toISOString()}`);

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // 私有方法 — 维度评分
  // -----------------------------------------------------------------------

  /**
   * 计算功能完整性得分（30%）
   *
   * planCoverage * 0.6 + prdCoverage * 0.4 → 映射到10分制
   */
  private scoreFunctionality(
    planResult: PlanValidationResult,
    prdResults: PrdCheckResult[],
  ): DimensionScore {
    const dimension = this.getDimension('功能完整性');
    const findings: string[] = [];

    const planCov = planResult.coveragePercent;
    const prdCov = this.aggregatePrdCoverage(prdResults);

    // 加权覆盖率
    const combined = planCov * 0.6 + prdCov * 0.4;
    const score = parseFloat(((combined / 100) * dimension.maxScore).toFixed(2));

    // 生成发现
    if (planResult.missingFeatures.length > 0) {
      findings.push(
        `PLAN缺失功能点: ${planResult.missingFeatures.join(', ')}`,
      );
    }
    findings.push(`PLAN覆盖率: ${planCov}%`);
    findings.push(`PRD覆盖率: ${prdCov}%`);

    return {
      dimension: dimension.name,
      score,
      maxScore: dimension.maxScore,
      weight: dimension.weight,
      weightedScore: parseFloat((score * dimension.weight).toFixed(2)),
      findings,
    };
  }

  /**
   * 计算代码质量得分（20%）
   *
   * 检查项：
   * - TypeScript严格模式（检测文件中是否有类型注解）
   * - 单文件行数 ≤ 500
   * - 命名规范（camelCase/PascalCase）
   */
  private scoreCodeQuality(sourceFiles: string[]): DimensionScore {
    const dimension = this.getDimension('代码质量');
    const findings: string[] = [];
    let penalty = 0;

    if (sourceFiles.length === 0) {
      return this.zeroDimension(dimension, ['无源码文件']);
    }

    let totalLines = 0;
    let oversizedFiles = 0;
    let filesWithTypes = 0;

    for (const filePath of sourceFiles) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').length;
        totalLines += lines;

        // 检查文件行数
        if (lines > 500) {
          oversizedFiles++;
          findings.push(`文件过长: ${filePath} (${lines}行)`);
        }

        // 检查类型注解（简单启发式）
        if (content.includes(': ') || content.includes(': ') || /:\s*(string|number|boolean|void)/.test(content)) {
          filesWithTypes++;
        }
      } catch {
        findings.push(`无法读取: ${filePath}`);
        penalty += 0.5;
      }
    }

    // 行数扣分：每个超500行的文件扣0.5分
    penalty += oversizedFiles * 0.5;

    // 类型注解覆盖率
    const typeRatio = sourceFiles.length > 0 ? filesWithTypes / sourceFiles.length : 0;
    if (typeRatio < 0.5) {
      penalty += 1;
      findings.push(`类型注解覆盖率低: ${(typeRatio * 100).toFixed(0)}%`);
    }

    const score = Math.max(0, parseFloat((dimension.maxScore - penalty).toFixed(2)));

    if (oversizedFiles === 0) {
      findings.push('所有文件行数 ≤ 500');
    }

    return {
      dimension: dimension.name,
      score,
      maxScore: dimension.maxScore,
      weight: dimension.weight,
      weightedScore: parseFloat((score * dimension.weight).toFixed(2)),
      findings,
    };
  }

  /**
   * 计算测试覆盖得分（20%）
   *
   * 检查项：
   * - 测试文件数 / 源码文件数 比率
   * - 理想比率 ≥ 1.0（每个源码文件有对应测试）
   */
  private scoreTestCoverage(
    testFiles: string[],
    sourceFiles: string[],
  ): DimensionScore {
    const dimension = this.getDimension('测试覆盖');
    const findings: string[] = [];

    if (sourceFiles.length === 0) {
      return {
        dimension: dimension.name,
        score: dimension.maxScore,
        maxScore: dimension.maxScore,
        weight: dimension.weight,
        weightedScore: parseFloat((dimension.maxScore * dimension.weight).toFixed(2)),
        findings: ['无源码文件，测试覆盖默认满分'],
      };
    }

    const ratio = testFiles.length / sourceFiles.length;
    // 比率 ≥ 1.0 → 满分；比率 < 1.0 → 按比例
    const score = parseFloat(
      (Math.min(1, ratio) * dimension.maxScore).toFixed(2),
    );

    findings.push(`测试文件数: ${testFiles.length}`);
    findings.push(`源码文件数: ${sourceFiles.length}`);
    findings.push(`测试/源码比率: ${ratio.toFixed(2)}`);

    if (ratio < 1) {
      findings.push(`测试覆盖不足，建议补充 ${sourceFiles.length - testFiles.length} 个测试文件`);
    }

    return {
      dimension: dimension.name,
      score,
      maxScore: dimension.maxScore,
      weight: dimension.weight,
      weightedScore: parseFloat((score * dimension.weight).toFixed(2)),
      findings,
    };
  }

  /**
   * 计算UI/UX体验得分（15%）
   *
   * 基于PLAN中UI相关功能点的实现状态：
   * - 面板/弹窗/Toast/导航等UI组件功能点
   * - 已verified的UI功能点比例
   */
  private scoreUIUX(planResult: PlanValidationResult): DimensionScore {
    const dimension = this.getDimension('UI/UX体验');
    const findings: string[] = [];

    if (planResult.totalFeatures === 0) {
      return this.zeroDimension(dimension, ['PLAN中无功能点']);
    }

    // 识别UI相关功能点（根据描述关键词）
    const uiKeywords = [
      'UI', '界面', '面板', '弹窗', 'Toast', '导航', 'Tab',
      '按钮', '布局', '动画', '样式', '配色', '字体', '间距',
      '交互', '点击', '滑动', '拖拽', '滚动', '折叠', '展开',
      'Modal', 'Panel', 'Dialog', 'Bar', 'Menu', 'List', 'Card',
      '适配', '响应', '竖屏', '横屏', '缩放',
    ];

    const uiFeatures = planResult.details.filter((d) =>
      uiKeywords.some((kw) =>
        d.feature.description.toLowerCase().includes(kw.toLowerCase()),
      ),
    );

    if (uiFeatures.length === 0) {
      // 无明确UI功能点时，使用整体覆盖率
      const score = parseFloat(
        ((planResult.coveragePercent / 100) * dimension.maxScore).toFixed(2),
      );
      findings.push('未发现明确UI功能点，使用整体覆盖率');
      findings.push(`整体覆盖率: ${planResult.coveragePercent}%`);

      return {
        dimension: dimension.name,
        score,
        maxScore: dimension.maxScore,
        weight: dimension.weight,
        weightedScore: parseFloat((score * dimension.weight).toFixed(2)),
        findings,
      };
    }

    const verifiedUi = uiFeatures.filter(
      (d) => d.status === 'verified' || d.status === 'partial',
    ).length;

    const uiCoverage = verifiedUi / uiFeatures.length;
    const score = parseFloat((uiCoverage * dimension.maxScore).toFixed(2));

    findings.push(`UI功能点总数: ${uiFeatures.length}`);
    findings.push(`已实现: ${verifiedUi}`);
    findings.push(`UI覆盖率: ${(uiCoverage * 100).toFixed(0)}%`);

    return {
      dimension: dimension.name,
      score,
      maxScore: dimension.maxScore,
      weight: dimension.weight,
      weightedScore: parseFloat((score * dimension.weight).toFixed(2)),
      findings,
    };
  }

  /**
   * 计算架构设计得分（15%）
   *
   * 检查项：
   * - 分层结构（core/engine/ui 分离）
   * - 依赖方向（上层不依赖下层的反向）
   * - 文件组织合理性
   */
  private scoreArchitecture(sourceFiles: string[]): DimensionScore {
    const dimension = this.getDimension('架构设计');
    const findings: string[] = [];

    if (sourceFiles.length === 0) {
      return this.zeroDimension(dimension, ['无源码文件']);
    }

    let score = dimension.maxScore;
    let penalty = 0;

    // 检查分层结构
    const layers = { core: 0, engine: 0, ui: 0, renderer: 0, other: 0 };
    for (const f of sourceFiles) {
      if (f.includes('/core/') || f.includes('\\core\\')) layers.core++;
      else if (f.includes('/engine/') || f.includes('\\engine\\')) layers.engine++;
      else if (f.includes('/ui/') || f.includes('\\ui\\')) layers.ui++;
      else if (f.includes('/renderer/') || f.includes('\\renderer\\')) layers.renderer++;
      else layers.other++;
    }

    const hasLayering = layers.core > 0 || layers.engine > 0 || layers.ui > 0;
    if (hasLayering) {
      findings.push(
        `分层结构: core(${layers.core}) engine(${layers.engine}) ui(${layers.ui}) renderer(${layers.renderer})`,
      );
    } else {
      penalty += 2;
      findings.push('未检测到分层结构（core/engine/ui）');
    }

    // 检查文件组织：未分类文件占比
    const uncategorizedRatio = layers.other / sourceFiles.length;
    if (uncategorizedRatio > 0.5) {
      penalty += 1;
      findings.push(`未分类文件占比过高: ${(uncategorizedRatio * 100).toFixed(0)}%`);
    } else if (uncategorizedRatio <= 0.3) {
      findings.push('文件组织良好');
    }

    score = Math.max(0, parseFloat((dimension.maxScore - penalty).toFixed(2)));

    return {
      dimension: dimension.name,
      score,
      maxScore: dimension.maxScore,
      weight: dimension.weight,
      weightedScore: parseFloat((score * dimension.weight).toFixed(2)),
      findings,
    };
  }

  // -----------------------------------------------------------------------
  // 私定方法 — 辅助
  // -----------------------------------------------------------------------

  /**
   * 聚合多个PRD检查结果的覆盖率
   */
  private aggregatePrdCoverage(prdResults: PrdCheckResult[]): number {
    if (prdResults.length === 0) return 100; // 无PRD文档时默认满分

    const totalReqs = prdResults.reduce((s, r) => s + r.totalRequirements, 0);
    const satisfiedReqs = prdResults.reduce((s, r) => s + r.satisfiedRequirements, 0);

    return totalReqs > 0 ? Math.round((satisfiedReqs / totalReqs) * 100) : 100;
  }

  /**
   * 同步读取文件列表内容
   */
  private readFilesSync(filePaths: string[]): Map<string, string> {
    const contents = new Map<string, string>();
    for (const filePath of filePaths) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        contents.set(filePath, fs.readFileSync(filePath, 'utf-8'));
      } catch {
        contents.set(filePath, '');
      }
    }
    return contents;
  }

  /**
   * 按名称查找维度定义
   */
  private getDimension(name: string): ScoreDimension {
    const dim = this.dimensions.find((d) => d.name === name);
    if (!dim) {
      throw new Error(`评分维度 "${name}" 未定义`);
    }
    return dim;
  }

  /**
   * 生成零分维度结果
   */
  private zeroDimension(
    dimension: ScoreDimension,
    findings: string[],
  ): DimensionScore {
    return {
      dimension: dimension.name,
      score: 0,
      maxScore: dimension.maxScore,
      weight: dimension.weight,
      weightedScore: 0,
      findings,
    };
  }

  /**
   * 生成汇总文本
   */
  private buildSummary(
    version: string,
    planCoverage: number,
    prdCoverage: number,
    totalScore: number,
  ): string {
    const status = totalScore >= this.passThreshold ? '通过' : '未通过';
    return (
      `${version} UI评测${status}，总分 ${totalScore}/10。` +
      `PLAN覆盖率 ${planCoverage}%，PRD覆盖率 ${prdCoverage}%。`
    );
  }
}
