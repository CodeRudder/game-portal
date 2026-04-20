/**
 * UIReviewScorer 测试套件
 *
 * 覆盖：构造函数、reviewVersion、各维度评分、passThreshold、generateReportText、自定义配置
 */

import { describe, it, expect } from 'vitest';
import {
  UIReviewScorer, DEFAULT_DIMENSIONS,
  type ScoreDimension,
} from '../UIReviewScorer';

// ---------------------------------------------------------------------------
// 测试数据工厂
// ---------------------------------------------------------------------------

function makePlanMd(version = 'v1.0', features: string[] = []): string {
  const lines = [`# ${version} 测试版本`, ''];
  if (features.length > 0) {
    lines.push('### 模块A: 主界面导航', '',
      '| # | 功能点 | PRD引用 | UI引用 | 优先级 |',
      '|---|--------|---------|--------|--------|');
    features.forEach((f, i) => lines.push(`| ${i + 1} | ${f} | — | — | P0 |`));
  }
  return lines.join('\n');
}

function makePrdMd(code = 'RES', name = '资源系统', reqs: string[] = []): string {
  const lines = [`# [${code}] ${name} — 玩法设计 (PRD)`, ''];
  reqs.forEach((r, i) => {
    const id = `${code}-${i + 1}`;
    lines.push(`## [${id}] ${r} {#${id.toLowerCase()}}`, '',
      '### 功能描述', '', r, '', '**验收标准**', '', `- [ ] ${r}功能正常`, '');
  });
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('UIReviewScorer', () => {
  // 构造函数和默认维度
  describe('构造函数', () => {
    it('默认维度应为5个，权重总和1.0', () => {
      expect(DEFAULT_DIMENSIONS).toHaveLength(5);
      expect(DEFAULT_DIMENSIONS.reduce((s, d) => s + d.weight, 0)).toBeCloseTo(1.0);
    });
    it('所有维度满分为10', () => {
      DEFAULT_DIMENSIONS.forEach((d) => expect(d.maxScore).toBe(10));
    });
    it('支持自定义维度和阈值', () => {
      const dims: ScoreDimension[] = [
        { name: '功能完整性', weight: 0.5, maxScore: 10 },
        { name: '代码质量', weight: 0.5, maxScore: 10 },
        { name: '测试覆盖', weight: 0, maxScore: 10 },
        { name: 'UI/UX体验', weight: 0, maxScore: 10 },
        { name: '架构设计', weight: 0, maxScore: 10 },
      ];
      expect(new UIReviewScorer({ dimensions: dims, passThreshold: 8.0 })).toBeDefined();
    });
  });

  // reviewVersion 完整评测流程
  describe('reviewVersion', () => {
    it('返回完整报告结构', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1.0', planMarkdown: makePlanMd(),
        prdMarkdowns: [], sourceFiles: [], testFiles: [],
      });
      expect(r.version).toBe('v1.0');
      expect(r.maxScore).toBe(10.0);
      expect(r.totalScore).toBeGreaterThanOrEqual(0);
      expect(r.totalScore).toBeLessThanOrEqual(10.0);
      expect(r.dimensions).toHaveLength(5);
      expect(r.timestamp).toBeGreaterThan(0);
      expect(typeof r.summary).toBe('string');
    });

    it('无源码时planCoverage=0, prdCoverage=100', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v0.1', planMarkdown: makePlanMd(),
        prdMarkdowns: [], sourceFiles: [], testFiles: [],
      });
      expect(r.planCoverage).toBe(0);
      expect(r.prdCoverage).toBe(100);
    });

    it('加权总分 = 各维度weightedScore之和', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1.0', planMarkdown: makePlanMd(),
        prdMarkdowns: [], sourceFiles: ['/src/core/a.ts'], testFiles: ['/tests/a.test.ts'],
      });
      const sum = r.dimensions.reduce((s, d) => s + d.weightedScore, 0);
      expect(r.totalScore).toBeCloseTo(parseFloat(sum.toFixed(2)), 1);
    });
  });

  // passThreshold 判定
  describe('通过/不通过判定', () => {
    it('阈值0时总是通过', () => {
      const r = new UIReviewScorer({ passThreshold: 0 }).reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      expect(r.passed).toBe(true);
    });
    it('阈值10.1时总是不通过', () => {
      const r = new UIReviewScorer({ passThreshold: 10.1 }).reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      expect(r.passed).toBe(false);
    });
  });

  // 功能完整性评分
  describe('功能完整性', () => {
    it('零覆盖=0分', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd('v1', ['完全不存在XYZ']),
        prdMarkdowns: [makePrdMd('RES', '资源', ['不存在需求XYZ'])],
        sourceFiles: [], testFiles: [],
      });
      const d = r.dimensions.find((x) => x.dimension === '功能完整性')!;
      expect(d.score).toBe(0);
    });
    it('无PRD时prdCoverage=100, 结合planCoverage计算', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd('v1', ['资源栏显示']),
        prdMarkdowns: [], sourceFiles: [], testFiles: [],
      });
      const d = r.dimensions.find((x) => x.dimension === '功能完整性')!;
      // planCoverage=0, prdCoverage=100 → combined=40 → score=4
      expect(d.score).toBe(4);
    });
  });

  // 代码质量评分
  describe('代码质量', () => {
    it('无源码=0分', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      const d = r.dimensions.find((x) => x.dimension === '代码质量')!;
      expect(d.score).toBe(0);
    });
  });

  // 测试覆盖评分
  describe('测试覆盖', () => {
    it('比率1.0=满分', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: ['/a.ts', '/b.ts'], testFiles: ['/a.test.ts', '/b.test.ts'],
      });
      expect(r.dimensions.find((x) => x.dimension === '测试覆盖')!.score).toBe(10);
    });
    it('比率0=0分', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: ['/a.ts', '/b.ts'], testFiles: [],
      });
      expect(r.dimensions.find((x) => x.dimension === '测试覆盖')!.score).toBe(0);
    });
    it('比率0.5=5分', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: ['/a.ts', '/b.ts'], testFiles: ['/a.test.ts'],
      });
      expect(r.dimensions.find((x) => x.dimension === '测试覆盖')!.score).toBe(5);
    });
    it('无源码=默认满分', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      expect(r.dimensions.find((x) => x.dimension === '测试覆盖')!.score).toBe(10);
    });
  });

  // UI/UX体验评分
  describe('UI/UX体验', () => {
    it('无功能点=0分', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd('v1', []), prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      expect(r.dimensions.find((x) => x.dimension === 'UI/UX体验')!.score).toBe(0);
    });
  });

  // 架构设计评分
  describe('架构设计', () => {
    it('有分层=满分', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: ['/src/core/a.ts', '/src/engine/b.ts', '/src/ui/c.tsx'], testFiles: [],
      });
      const d = r.dimensions.find((x) => x.dimension === '架构设计')!;
      expect(d.score).toBe(10);
      expect(d.findings).toContain('文件组织良好');
    });
    it('无分层=扣分', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: ['/src/utils.ts', '/src/helper.ts', '/src/index.ts'], testFiles: [],
      });
      expect(r.dimensions.find((x) => x.dimension === '架构设计')!.score).toBeLessThan(10);
    });
    it('无源码=0分', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      expect(r.dimensions.find((x) => x.dimension === '架构设计')!.score).toBe(0);
    });
  });

  // generateReportText
  describe('generateReportText', () => {
    it('包含关键段落', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1.0', planMarkdown: makePlanMd('v1.0', ['资源栏']),
        prdMarkdowns: [], sourceFiles: ['/src/core/a.ts'], testFiles: [],
      });
      const txt = new UIReviewScorer().generateReportText(r);
      expect(txt).toContain('# UI评测报告 — v1.0');
      expect(txt).toContain('**总分**');
      expect(txt).toContain('## 覆盖率');
      expect(txt).toContain('PLAN功能点覆盖率');
      expect(txt).toContain('## 维度评分');
      expect(txt).toContain('功能完整性');
      expect(txt).toContain('## 评分发现');
      expect(txt).toContain('生成时间:');
    });
    it('通过显示✅', () => {
      const scorer = new UIReviewScorer({ passThreshold: 0 });
      const r = scorer.reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      expect(scorer.generateReportText(r)).toContain('✅ 通过');
    });
    it('未通过显示❌', () => {
      const scorer = new UIReviewScorer({ passThreshold: 10.1 });
      const r = scorer.reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      expect(scorer.generateReportText(r)).toContain('❌ 未通过');
    });
  });

  // 自定义维度
  describe('自定义配置', () => {
    it('使用自定义维度名称', () => {
      const dims: ScoreDimension[] = [
        { name: '功能完整性', weight: 0.3, maxScore: 10 },
        { name: '代码质量', weight: 0.2, maxScore: 10 },
        { name: '测试覆盖', weight: 0.2, maxScore: 10 },
        { name: 'UI/UX体验', weight: 0.15, maxScore: 10 },
        { name: '架构设计', weight: 0.15, maxScore: 10 },
      ];
      const r = new UIReviewScorer({ dimensions: dims }).reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      expect(r.dimensions.map((d) => d.dimension)).toEqual(dims.map((d) => d.name));
    });
  });

  // 边界情况
  describe('边界情况', () => {
    it('空PLAN文档正常处理', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v0', planMarkdown: '', prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      expect(r.version).toBe('v0');
      expect(r.planCoverage).toBe(0);
    });
    it('多个PRD聚合覆盖率', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(),
        prdMarkdowns: [makePrdMd('RES', '资源', ['资源定义']), makePrdMd('BLD', '建筑', ['建筑类型'])],
        sourceFiles: [], testFiles: [],
      });
      expect(r.prdCoverage).toBe(0);
    });
    it('weightedScore = score * weight', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v1', planMarkdown: makePlanMd(), prdMarkdowns: [],
        sourceFiles: ['/src/core/a.ts'], testFiles: ['/tests/a.test.ts'],
      });
      r.dimensions.forEach((d) => expect(d.weightedScore).toBeCloseTo(d.score * d.weight, 1));
    });
    it('summary包含关键信息', () => {
      const r = new UIReviewScorer().reviewVersion({
        version: 'v3.0', planMarkdown: makePlanMd('v3.0'), prdMarkdowns: [],
        sourceFiles: [], testFiles: [],
      });
      expect(r.summary).toContain('v3.0');
      expect(r.summary).toContain('总分');
    });
  });
});
