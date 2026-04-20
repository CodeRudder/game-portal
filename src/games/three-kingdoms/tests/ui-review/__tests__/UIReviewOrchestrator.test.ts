/**
 * UIReviewOrchestrator 测试套件
 *
 * 覆盖：
 * - 构造函数
 * - getSourceFiles 映射正确性（20个版本）
 * - getPlanPath / getPrdPaths 路径正确性
 * - reviewVersion 完整流程（mock 数据）
 * - reviewVersions 批量评测
 * - 缺失 PLAN 文档 / 源码文件处理
 * - 空版本列表处理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UIReviewOrchestrator } from '../UIReviewOrchestrator';
import { UIReviewScorer } from '../UIReviewScorer';

// ---------------------------------------------------------------------------
// 期望的版本到目录映射（20个版本）
// ---------------------------------------------------------------------------

const EXPECTED_MAPPINGS = [
  ['v1.0',  'building',    'building'],
  ['v2.0',  'hero',        'hero'],
  ['v3.0',  'campaign',    'campaign'],
  ['v4.0',  'campaign',    'campaign'],
  ['v5.0',  'tech',        'tech'],
  ['v6.0',  'map',         'map'],
  ['v7.0',  'battle',      'battle'],
  ['v8.0',  'trade',       'trade'],
  ['v9.0',  'offline',     'offline'],
  ['v10.0', 'army',        'army'],
  ['v11.0', 'arena',       'pvp'],
  ['v12.0', 'expedition',  'expedition'],
  ['v13.0', 'alliance',    'alliance'],
  ['v14.0', 'prestige',    'prestige'],
  ['v15.0', 'event',       'event'],
  ['v16.0', 'legacy',      'heritage'],
  ['v17.0', 'responsive',  'responsive'],
  ['v18.0', 'guide',       'guide'],
  ['v19.0', 'settings',    'settings'],
  ['v20.0', 'unification', 'unification'],
] as const;

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('UIReviewOrchestrator', () => {
  let orchestrator: UIReviewOrchestrator;

  beforeEach(() => {
    orchestrator = new UIReviewOrchestrator();
  });

  // -------------------------------------------------------------------------
  // 构造函数
  // -------------------------------------------------------------------------

  describe('构造函数', () => {
    it('应成功创建实例（默认参数）', () => {
      expect(new UIReviewOrchestrator()).toBeDefined();
    });

    it('应支持自定义 projectRoot 和 scorerOptions', () => {
      const orc = new UIReviewOrchestrator({
        projectRoot: '/tmp/test-project',
        scorerOptions: { passThreshold: 8.0 },
      });
      expect(orc).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // supportedVersions
  // -------------------------------------------------------------------------

  describe('supportedVersions', () => {
    it('应返回20个版本 v1.0~v20.0，按顺序排列', () => {
      const versions = orchestrator.supportedVersions();
      expect(versions).toHaveLength(20);
      for (let i = 1; i <= 20; i++) {
        expect(versions).toContain(`v${i}.0`);
      }
      for (let i = 0; i < versions.length - 1; i++) {
        expect(parseFloat(versions[i].slice(1)))
          .toBeLessThan(parseFloat(versions[i + 1].slice(1)));
      }
    });
  });

  // -------------------------------------------------------------------------
  // getSourceFiles 映射正确性
  // -------------------------------------------------------------------------

  describe('getSourceFiles', () => {
    it('不支持的版本应返回空数组', () => {
      expect(orchestrator.getSourceFiles('v99.0')).toEqual([]);
    });

    it('不存在的目录应返回空数组', () => {
      const orc = new UIReviewOrchestrator({ projectRoot: '/nonexistent/path' });
      expect(orc.getSourceFiles('v1.0')).toEqual([]);
    });

    it('所有20个版本都应有映射且不抛异常', () => {
      for (const [version] of EXPECTED_MAPPINGS) {
        expect(() => orchestrator.getSourceFiles(version)).not.toThrow();
      }
    });
  });

  describe('getSourceFiles 映射正确性（20个版本）', () => {
    for (const [version, engineDir, coreDir] of EXPECTED_MAPPINGS) {
      it(`${version} → engine/${engineDir}, core/${coreDir}`, () => {
        const files = orchestrator.getSourceFiles(version);
        for (const file of files) {
          expect(
            file.includes(`engine/${engineDir}`) || file.includes(`core/${coreDir}`),
          ).toBe(true);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // getPlanPath
  // -------------------------------------------------------------------------

  describe('getPlanPath', () => {
    it('plans 目录不存在时应返回空字符串', () => {
      const orc = new UIReviewOrchestrator({ projectRoot: '/nonexistent/path' });
      expect(orc.getPlanPath('v1.0')).toBe('');
    });

    it('任何版本号都不应抛异常', () => {
      expect(typeof orchestrator.getPlanPath('v99.0')).toBe('string');
    });

    it('返回的路径应包含 plans 目录和 .md 后缀', () => {
      const path = orchestrator.getPlanPath('v1.0');
      if (path) {
        expect(path).toContain('plans');
        expect(path).toContain('v1.0');
        expect(path).toMatch(/\.md$/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // getPrdPaths
  // -------------------------------------------------------------------------

  describe('getPrdPaths', () => {
    it('不支持的版本应返回空数组', () => {
      expect(orchestrator.getPrdPaths('v99.0')).toEqual([]);
    });

    it('prd 目录不存在时应返回空数组', () => {
      const orc = new UIReviewOrchestrator({ projectRoot: '/nonexistent/path' });
      expect(orc.getPrdPaths('v1.0')).toEqual([]);
    });

    it('返回的路径应包含 prd 目录和 .md 后缀', () => {
      const paths = orchestrator.getPrdPaths('v1.0');
      for (const p of paths) {
        expect(p).toContain('prd');
        expect(p).toMatch(/\.md$/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // reviewVersion 完整流程（使用 mock）
  // -------------------------------------------------------------------------

  describe('reviewVersion', () => {
    it('不支持的版本号应抛出错误', async () => {
      await expect(orchestrator.reviewVersion('v99.0')).rejects.toThrow(
        '未找到版本 v99.0 的源码映射',
      );
    });

    it('缺失 PLAN 文档时应返回默认报告（不抛错）', async () => {
      const orc = new UIReviewOrchestrator({ projectRoot: '/nonexistent' });
      const report = await orc.reviewVersion('v1.0');
      expect(report.version).toBe('v1.0');
      expect(report.totalScore).toBeGreaterThanOrEqual(0);
    });

    describe('使用 mock scorer 验证参数传递', () => {
      let spy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        spy = vi.spyOn(UIReviewScorer.prototype, 'reviewVersion').mockReturnValue({
          version: 'v1.0',
          totalScore: 8.5,
          maxScore: 10.0,
          passed: false,
          dimensions: [],
          planCoverage: 80,
          prdCoverage: 90,
          summary: 'v1.0 UI评测未通过',
          timestamp: Date.now(),
        });
      });

      afterEach(() => { vi.restoreAllMocks(); });

      it('应调用 scorer.reviewVersion 并返回报告', async () => {
        const report = await orchestrator.reviewVersion('v1.0');
        expect(report.version).toBe('v1.0');
        expect(report.totalScore).toBe(8.5);
        expect(spy).toHaveBeenCalledOnce();
      });

      it('应传递正确的 version、planMarkdown、sourceFiles、prdMarkdowns', async () => {
        await orchestrator.reviewVersion('v2.0');
        const args = spy.mock.calls[0][0];
        expect(args.version).toBe('v2.0');
        expect(typeof args.planMarkdown).toBe('string');
        expect(Array.isArray(args.sourceFiles)).toBe(true);
        expect(Array.isArray(args.testFiles)).toBe(true);
        expect(Array.isArray(args.prdMarkdowns)).toBe(true);
      });
    });
  });

  // -------------------------------------------------------------------------
  // reviewVersions 批量评测
  // -------------------------------------------------------------------------

  describe('reviewVersions', () => {
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      spy = vi.spyOn(UIReviewScorer.prototype, 'reviewVersion')
        .mockImplementation((params: { version: string }) => ({
          version: params.version,
          totalScore: 7.5,
          maxScore: 10.0,
          passed: true,
          dimensions: [],
          planCoverage: 75,
          prdCoverage: 80,
          summary: `${params.version} 通过`,
          timestamp: Date.now(),
        }));
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it('空版本列表应返回空数组且不调用 scorer', async () => {
      expect(await orchestrator.reviewVersions([])).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it('应对每个版本调用 reviewVersion 并返回对应报告', async () => {
      const reports = await orchestrator.reviewVersions(['v1.0', 'v2.0', 'v5.0']);
      expect(reports).toHaveLength(3);
      expect(reports.map((r) => r.version)).toEqual(['v1.0', 'v2.0', 'v5.0']);
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('包含不支持版本时应抛错', async () => {
      await expect(
        orchestrator.reviewVersions(['v1.0', 'v99.0']),
      ).rejects.toThrow('未找到版本 v99.0 的源码映射');
    });
  });

  // -------------------------------------------------------------------------
  // 缺失 PLAN 文档处理
  // -------------------------------------------------------------------------

  describe('缺失 PLAN 文档处理', () => {
    it('应生成默认空 PLAN 文档，planCoverage=0，prdCoverage=100', async () => {
      const orc = new UIReviewOrchestrator({ projectRoot: '/nonexistent' });
      const report = await orc.reviewVersion('v1.0');
      expect(report.planCoverage).toBe(0);
      expect(report.prdCoverage).toBe(100); // 无 PRD 文档时默认满分
    });
  });

  // -------------------------------------------------------------------------
  // 缺失源码文件处理
  // -------------------------------------------------------------------------

  describe('缺失源码文件处理', () => {
    it('源码目录不存在时应正常返回报告', async () => {
      const orc = new UIReviewOrchestrator({ projectRoot: '/nonexistent' });
      const report = await orc.reviewVersion('v1.0');
      expect(report.totalScore).toBeGreaterThanOrEqual(0);
    });

    it('无源码时代码质量=0、架构设计=0，功能完整性按覆盖率计算', async () => {
      const orc = new UIReviewOrchestrator({ projectRoot: '/nonexistent' });
      const report = await orc.reviewVersion('v1.0');

      const codeDim = report.dimensions.find((d) => d.dimension === '代码质量');
      const archDim = report.dimensions.find((d) => d.dimension === '架构设计');
      const funcDim = report.dimensions.find((d) => d.dimension === '功能完整性');

      expect(codeDim!.score).toBe(0);
      expect(archDim!.score).toBe(0);
      // planCoverage=0, prdCoverage=100(无PRD) → score = (0*0.6+100*0.4)/100*10 = 4
      expect(funcDim!.score).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // 边界情况
  // -------------------------------------------------------------------------

  describe('边界情况', () => {
    it('v3.0 和 v4.0 应映射到相同目录', () => {
      const extractDirs = (files: string[]) =>
        [...new Set(files.map((f) => {
          const m = f.match(/(engine|core)\/([^/]+)/);
          return m ? `${m[1]}/${m[2]}` : '';
        }).filter(Boolean))].sort();

      expect(extractDirs(orchestrator.getSourceFiles('v3.0')))
        .toEqual(extractDirs(orchestrator.getSourceFiles('v4.0')));
    });

    it('v11.0 → engine=arena, core=pvp', () => {
      const files = orchestrator.getSourceFiles('v11.0');
      for (const file of files) {
        expect(file.includes('engine/arena') || file.includes('core/pvp')).toBe(true);
      }
    });

    it('v16.0 → engine=legacy, core=heritage', () => {
      const files = orchestrator.getSourceFiles('v16.0');
      for (const file of files) {
        expect(file.includes('engine/legacy') || file.includes('core/heritage')).toBe(true);
      }
    });
  });
});
