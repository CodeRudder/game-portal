/**
 * UIReviewOrchestrator — UI评测框架流水线编排器
 *
 * 将 PlanValidator + PrdChecker + UIReviewScorer 串联为完整的版本评测流水线。
 * 根据版本号自动定位 PLAN文档、PRD文档、源码文件，执行全流程评测。
 *
 * 流程：
 * 1. 根据版本号找到 PLAN 文档 → PlanValidator.parsePlanDocument → 提取功能点
 * 2. 根据版本号找到对应 PRD 文档 → PrdChecker.parsePrdDocument → 提取需求
 * 3. 根据版本号找到对应源码文件 → validate/check 验证覆盖
 * 4. 聚合结果 → UIReviewScorer 生成评分
 *
 * @module ui-review/UIReviewOrchestrator
 */

import { PlanValidator, type PlanValidationResult, type VersionPlan } from './PlanValidator';
import { PrdChecker, type PrdCheckResult, type PrdDocument } from './PrdChecker';
import {
  UIReviewScorer,
  type VersionReviewReport,
  type UIReviewScorerOptions,
} from './UIReviewScorer';
import { VERSION_SOURCE_MAP, type VersionSourceMapping } from './VersionSourceMap';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** Orchestrator 配置选项 */
export interface UIReviewOrchestratorOptions {
  /** 项目根目录（默认自动推断） */
  projectRoot?: string;
  /** 评分器选项 */
  scorerOptions?: UIReviewScorerOptions;
}

// ---------------------------------------------------------------------------
// UIReviewOrchestrator 类
// ---------------------------------------------------------------------------

/**
 * UI评测流水线编排器
 *
 * 串联 PlanValidator、PrdChecker、UIReviewScorer，
 * 根据版本号自动定位文档和源码，执行完整评测流程。
 */
export class UIReviewOrchestrator {
  private planValidator: PlanValidator;
  private prdChecker: PrdChecker;
  private scorer: UIReviewScorer;
  private projectRoot: string;

  constructor(options?: UIReviewOrchestratorOptions) {
    this.planValidator = new PlanValidator();
    this.prdChecker = new PrdChecker();
    this.scorer = new UIReviewScorer(options?.scorerOptions);
    this.projectRoot = options?.projectRoot ?? this.inferProjectRoot();
  }

  // -----------------------------------------------------------------------
  // 公共方法
  // -----------------------------------------------------------------------

  /**
   * 对指定版本执行完整 UI 评测
   *
   * @param version - 版本号，如 "v1.0"
   * @returns 版本评测报告
   * @throws 当版本号不在映射表中时抛出错误
   */
  async reviewVersion(version: string): Promise<VersionReviewReport> {
    const mapping = this.getMapping(version);
    if (!mapping) {
      throw new Error(`未找到版本 ${version} 的源码映射，支持的版本: ${this.supportedVersions().join(', ')}`);
    }

    // 1. 加载 PLAN 文档
    const planMarkdown = await this.loadPlanDocument(version);

    // 2. 加载 PRD 文档
    const prdMarkdowns = await this.loadPrdDocuments(mapping.prdModuleCodes);

    // 3. 收集源码文件
    const sourceFiles = this.getSourceFiles(version);
    const testFiles = this.getTestFiles(version);

    // 4. 委托 UIReviewScorer 完成评测
    const report = this.scorer.reviewVersion({
      version,
      planMarkdown,
      prdMarkdowns,
      sourceFiles,
      testFiles,
    });

    return report;
  }

  /**
   * 批量评测多个版本
   *
   * 按顺序对每个版本执行完整评测，收集所有报告。
   *
   * @param versions - 版本号列表
   * @returns 版本评测报告列表
   */
  async reviewVersions(versions: string[]): Promise<VersionReviewReport[]> {
    if (versions.length === 0) {
      return [];
    }

    const reports: VersionReviewReport[] = [];
    for (const version of versions) {
      const report = await this.reviewVersion(version);
      reports.push(report);
    }
    return reports;
  }

  /**
   * 获取所有支持的版本号列表
   */
  supportedVersions(): string[] {
    return VERSION_SOURCE_MAP.map((m) => m.version);
  }

  // -----------------------------------------------------------------------
  // 私有方法 — 文件定位
  // -----------------------------------------------------------------------

  /**
   * 获取版本对应的源码文件列表
   *
   * 在 engine/{engineDir}/ 和 core/{coreDir}/ 下递归查找所有 .ts/.tsx 文件。
   *
   * @param version - 版本号
   * @returns 源码文件的绝对路径列表
   */
  getSourceFiles(version: string): string[] {
    const mapping = this.getMapping(version);
    if (!mapping) return [];

    const files: string[] = [];
    const gameDir = this.getGameDir();

    const dirs = [
      `${gameDir}/engine/${mapping.engineDir}`,
      `${gameDir}/core/${mapping.coreDir}`,
    ];

    for (const dir of dirs) {
      files.push(...this.collectTsFiles(dir));
    }

    return files;
  }

  /**
   * 获取版本对应的测试文件列表
   *
   * 在 tests/ 目录下查找与版本对应的测试文件。
   *
   * @param version - 版本号
   * @returns 测试文件的绝对路径列表
   */
  getTestFiles(version: string): string[] {
    const mapping = this.getMapping(version);
    if (!mapping) return [];

    const files: string[] = [];
    const gameDir = this.getGameDir();

    // 查找 tests 目录下与模块相关的测试文件
    const testDirs = [
      `${gameDir}/tests`,
    ];

    for (const dir of testDirs) {
      files.push(...this.collectTsFiles(dir, mapping.engineDir));
    }

    return files;
  }

  /**
   * 获取版本对应的 PLAN 文档路径
   *
   * 在 plans/ 目录下查找以版本号开头的 .md 文件。
   *
   * @param version - 版本号
   * @returns PLAN 文档的绝对路径，未找到时返回空字符串
   */
  getPlanPath(version: string): string {
    const plansDir = `${this.getGameDir()}/plans`;
    return this.findFileInDir(plansDir, version, '.md');
  }

  /**
   * 获取版本对应的 PRD 文档路径列表
   *
   * 在 prd/ 目录下查找以模块代码开头的 .md 文件。
   *
   * @param version - 版本号
   * @returns PRD 文档的绝对路径列表
   */
  getPrdPaths(version: string): string[] {
    const mapping = this.getMapping(version);
    if (!mapping) return [];

    const prdDir = `${this.getGameDir()}/prd`;
    const paths: string[] = [];

    for (const code of mapping.prdModuleCodes) {
      const filePath = this.findFileInDir(prdDir, code, '.md');
      if (filePath) {
        paths.push(filePath);
      }
    }

    return paths;
  }

  // -----------------------------------------------------------------------
  // 私有方法 — 文档加载
  // -----------------------------------------------------------------------

  /**
   * 加载 PLAN 文档内容
   *
   * @param version - 版本号
   * @returns PLAN 文档的 Markdown 内容
   */
  private async loadPlanDocument(version: string): Promise<string> {
    const fs = await import('fs');
    const planPath = this.getPlanPath(version);

    if (!planPath) {
      // PLAN 文档不存在时返回空文档，不抛错
      return `# ${version} 未知版本\n\n`;
    }

    try {
      return fs.readFileSync(planPath, 'utf-8');
    } catch {
      return `# ${version} 未知版本\n\n`;
    }
  }

  /**
   * 加载 PRD 文档内容列表
   *
   * @param moduleCodes - PRD 模块代码列表
   * @returns PRD 文档的 Markdown 内容列表
   */
  private async loadPrdDocuments(moduleCodes: string[]): Promise<string[]> {
    const fs = await import('fs');
    const prdDir = `${this.getGameDir()}/prd`;
    const markdowns: string[] = [];

    for (const code of moduleCodes) {
      const filePath = this.findFileInDir(prdDir, code, '.md');
      if (filePath) {
        try {
          markdowns.push(fs.readFileSync(filePath, 'utf-8'));
        } catch {
          // 读取失败时跳过该 PRD
        }
      }
    }

    return markdowns;
  }

  // -----------------------------------------------------------------------
  // 私有方法 — 辅助
  // -----------------------------------------------------------------------

  /**
   * 根据版本号获取源码映射
   */
  private getMapping(version: string): VersionSourceMapping | undefined {
    return VERSION_SOURCE_MAP.find((m) => m.version === version);
  }

  /**
   * 获取三国项目游戏目录的绝对路径
   */
  private getGameDir(): string {
    return `${this.projectRoot}/src/games/three-kingdoms`;
  }

  /**
   * 自动推断项目根目录
   *
   * 从当前工作目录向上查找包含 package.json 的目录。
   */
  private inferProjectRoot(): string {
    // 在测试环境中，使用 __dirname 向上推导
    // __dirname = .../tests/ui-review → 向上 4 级到项目根
    const path = require('path');
    // 从当前文件位置向上推导
    const fileDir = __dirname;
    // tests/ui-review → tests → three-kingdoms → games → src → project-root
    return path.resolve(fileDir, '..', '..', '..', '..', '..');
  }

  /**
   * 递归收集目录下的 .ts/.tsx 文件
   *
   * @param dir - 目录路径
   * @param filterKeyword - 可选的关键词过滤，只包含路径中含此关键词的文件
   * @returns 文件绝对路径列表
   */
  private collectTsFiles(dir: string, filterKeyword?: string): string[] {
    const fs = require('fs');
    const path = require('path');
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...this.collectTsFiles(fullPath, filterKeyword));
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        // 如果指定了过滤关键词，只包含路径中包含该关键词的文件
        if (!filterKeyword || fullPath.includes(filterKeyword)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * 在目录中查找以指定前缀开头、指定后缀结尾的文件
   *
   * @param dir - 目录路径
   * @param prefix - 文件名前缀
   * @param suffix - 文件名后缀
   * @returns 匹配文件的绝对路径，未找到时返回空字符串
   */
  private findFileInDir(dir: string, prefix: string, suffix: string): string {
    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(dir)) {
      return '';
    }

    try {
      const entries = fs.readdirSync(dir);
      const target = entries.find(
        (f: string) => f.startsWith(prefix) && f.endsWith(suffix),
      );
      return target ? path.join(dir, target) : '';
    } catch {
      return '';
    }
  }
}
