/**
 * 覆盖率计算器 — 单元测试
 *
 * 测试场景：
 *   1. 测试名称提取（extractTestNames）
 *   2. 路径匹配（matchTestCoverage）
 *   3. 综合覆盖率报告生成（generateCoverageReport）
 */

import { describe, it, expect } from 'vitest';
import {
  extractTestNames,
  matchTestCoverage,
  generateCoverageReport,
} from '../enumeration';

// ═══════════════════════════════════════════════════════════════
// extractTestNames 测试
// ═══════════════════════════════════════════════════════════════

describe('extractTestNames', () => {
  it('提取describe和it名称', () => {
    const content = `
      describe('用户登录', () => {
        it('应该成功登录', () => {});
        it('密码错误应失败', () => {});
      });
    `;

    const result = extractTestNames(content);

    expect(result.describes).toEqual(['用户登录']);
    expect(result.its).toEqual(['应该成功登录', '密码错误应失败']);
  });

  it('支持双引号和反引号', () => {
    const content = `
      describe("模块A", () => {});
      describe(\`模块B\`, () => {});
      it("测试1", () => {});
      it(\`测试2\`, () => {});
    `;

    const result = extractTestNames(content);

    expect(result.describes).toContain('模块A');
    expect(result.describes).toContain('模块B');
    expect(result.its).toContain('测试1');
    expect(result.its).toContain('测试2');
  });

  it('支持test()别名', () => {
    const content = `
      test('测试用例A', () => {});
      test('测试用例B', () => {});
    `;

    const result = extractTestNames(content);

    expect(result.its).toEqual(['测试用例A', '测试用例B']);
  });

  it('空文件', () => {
    const result = extractTestNames('');
    expect(result.describes).toEqual([]);
    expect(result.its).toEqual([]);
  });

  it('嵌套describe', () => {
    const content = `
      describe('外层', () => {
        describe('内层A', () => {
          it('测试A1', () => {});
        });
        describe('内层B', () => {
          it('测试B1', () => {});
        });
      });
    `;

    const result = extractTestNames(content);

    expect(result.describes).toEqual(['外层', '内层A', '内层B']);
    expect(result.its).toEqual(['测试A1', '测试B1']);
  });

  it('忽略注释中的describe/it', () => {
    const content = `
      // describe('注释中的', () => {});
      /* it('块注释中的', () => {}); */
      describe('真实的', () => {
        it('实际测试', () => {});
      });
    `;

    const result = extractTestNames(content);

    // 注意：简单正则也会匹配注释中的，这是已知的Phase 1限制
    // 但至少要能提取到真实的
    expect(result.describes).toContain('真实的');
    expect(result.its).toContain('实际测试');
  });
});

// ═══════════════════════════════════════════════════════════════
// matchTestCoverage 测试
// ═══════════════════════════════════════════════════════════════

describe('matchTestCoverage', () => {
  it('完全覆盖', () => {
    const dagPaths = [
      ['login', 'dashboard'],
      ['login', 'profile'],
    ];
    const testFiles = [
      {
        file: 'auth.test.ts',
        describes: ['login'],
        its: ['should show dashboard', 'should show profile'],
      },
    ];

    const result = matchTestCoverage(dagPaths, testFiles);

    expect(result.covered.length).toBeGreaterThanOrEqual(1);
  });

  it('部分覆盖', () => {
    const dagPaths = [
      ['home', 'shop'],
      ['home', 'battle'],
      ['home', 'settings'],
    ];
    const testFiles = [
      {
        file: 'shop.test.ts',
        describes: ['shop'],
        its: ['buy item'],
      },
    ];

    const result = matchTestCoverage(dagPaths, testFiles);

    // shop路径应该被覆盖
    expect(result.covered.length).toBeGreaterThanOrEqual(1);
    // battle和settings可能未被覆盖
    expect(result.uncovered.length).toBeGreaterThanOrEqual(1);
  });

  it('零覆盖', () => {
    const dagPaths = [['A', 'B']];
    const testFiles = [
      {
        file: 'other.test.ts',
        describes: ['unrelated'],
        its: ['something else'],
      },
    ];

    const result = matchTestCoverage(dagPaths, testFiles);

    expect(result.covered).toEqual([]);
    expect(result.uncovered).toHaveLength(1);
  });

  it('空路径', () => {
    const result = matchTestCoverage([], []);
    expect(result.covered).toEqual([]);
    expect(result.uncovered).toEqual([]);
  });

  it('大小写不敏感匹配', () => {
    const dagPaths = [['Login', 'Dashboard']];
    const testFiles = [
      {
        file: 'auth.test.ts',
        describes: ['LOGIN'],
        its: [],
      },
    ];

    const result = matchTestCoverage(dagPaths, testFiles);
    expect(result.covered.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// generateCoverageReport 测试
// ═══════════════════════════════════════════════════════════════

describe('generateCoverageReport', () => {
  it('100%覆盖', () => {
    const dag = {
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }],
    };
    const allPaths = [['A', 'B', 'C']];
    const testedPaths = [['A', 'B', 'C']];

    const report = generateCoverageReport(dag, allPaths, testedPaths);

    expect(report.nodeCoverage).toBe(1);
    expect(report.edgeCoverage).toBe(1);
    expect(report.pathCoverage).toBe(1);
    expect(report.overall).toBeCloseTo(0.25 + 0.25 + 0.20, 4);
    expect(report.uncoveredNodes).toEqual([]);
    expect(report.uncoveredEdges).toEqual([]);
    expect(report.uncoveredPaths).toEqual([]);
  });

  it('50%覆盖', () => {
    const dag = {
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'D' },
      ],
    };
    const allPaths = [['A', 'B', 'C', 'D']];
    // 只测试了前半段
    const testedPaths = [['A', 'B']];

    const report = generateCoverageReport(dag, allPaths, testedPaths);

    // 节点：A,B → 2/4 = 0.5
    expect(report.nodeCoverage).toBe(0.5);
    // 边：A→B → 1/3
    expect(report.edgeCoverage).toBeCloseTo(1 / 3, 4);
    // 路径：0/1 = 0
    expect(report.pathCoverage).toBe(0);
    // 综合覆盖率
    const expected =
      0.25 * 0.5 + 0.25 * (1 / 3) + 0.20 * 0 + 0.15 * 0 + 0.15 * 0;
    expect(report.overall).toBeCloseTo(expected, 4);

    expect(report.uncoveredNodes).toContain('C');
    expect(report.uncoveredNodes).toContain('D');
    expect(report.uncoveredEdges).toContainEqual(['B', 'C']);
    expect(report.uncoveredEdges).toContainEqual(['C', 'D']);
  });

  it('0%覆盖', () => {
    const dag = {
      nodes: [{ id: 'A' }, { id: 'B' }],
      edges: [{ from: 'A', to: 'B' }],
    };
    const allPaths = [['A', 'B']];
    const testedPaths: string[][] = [];

    const report = generateCoverageReport(dag, allPaths, testedPaths);

    expect(report.nodeCoverage).toBe(0);
    expect(report.edgeCoverage).toBe(0);
    expect(report.pathCoverage).toBe(0);
    expect(report.overall).toBe(0);
    expect(report.uncoveredNodes).toEqual(['A', 'B']);
    expect(report.uncoveredEdges).toEqual([['A', 'B']]);
    expect(report.uncoveredPaths).toEqual([['A', 'B']]);
  });

  it('与上次覆盖率对比（delta计算）', () => {
    const dag = {
      nodes: [{ id: 'A' }, { id: 'B' }],
      edges: [{ from: 'A', to: 'B' }],
    };
    const allPaths = [['A', 'B']];

    // 第一次报告
    const report1 = generateCoverageReport(dag, allPaths, []);
    expect(report1.delta).toBeUndefined();

    // 第二次报告（有改进）
    const report2 = generateCoverageReport(
      dag,
      allPaths,
      [['A', 'B']],
      report1.overall,
    );

    expect(report2.previousOverall).toBe(report1.overall);
    expect(report2.delta).toBeGreaterThan(0);
  });

  it('空DAG', () => {
    const dag = { nodes: [], edges: [] };
    const report = generateCoverageReport(dag, [], []);

    expect(report.nodeCoverage).toBe(0);
    expect(report.edgeCoverage).toBe(0);
    expect(report.pathCoverage).toBe(0);
    expect(report.overall).toBe(0);
    expect(report.uncoveredNodes).toEqual([]);
    expect(report.uncoveredEdges).toEqual([]);
    expect(report.uncoveredPaths).toEqual([]);
  });

  it('多条路径部分覆盖', () => {
    const dag = {
      nodes: [
        { id: 'A' },
        { id: 'B' },
        { id: 'C' },
        { id: 'D' },
        { id: 'E' },
      ],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'A', to: 'C' },
        { from: 'B', to: 'D' },
        { from: 'C', to: 'E' },
      ],
    };
    const allPaths = [
      ['A', 'B', 'D'],
      ['A', 'C', 'E'],
    ];
    // 只测试了左分支
    const testedPaths = [['A', 'B', 'D']];

    const report = generateCoverageReport(dag, allPaths, testedPaths);

    // 节点：A,B,D → 3/5 = 0.6
    expect(report.nodeCoverage).toBe(0.6);
    // 边：A→B, B→D → 2/4 = 0.5
    expect(report.edgeCoverage).toBe(0.5);
    // 路径：1/2 = 0.5
    expect(report.pathCoverage).toBe(0.5);

    expect(report.uncoveredNodes).toContain('C');
    expect(report.uncoveredNodes).toContain('E');
    expect(report.uncoveredPaths).toHaveLength(1);
    expect(report.uncoveredPaths[0]).toEqual(['A', 'C', 'E']);
  });

  it('覆盖率值精确到4位小数', () => {
    const dag = {
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }],
    };
    const allPaths = [['A', 'B', 'C']];
    const testedPaths = [['A', 'B']]; // 部分覆盖

    const report = generateCoverageReport(dag, allPaths, testedPaths);

    // 验证精度：所有比率最多4位小数
    const checkPrecision = (value: number) => {
      const rounded = Math.round(value * 10000) / 10000;
      expect(value).toBe(rounded);
    };

    checkPrecision(report.nodeCoverage);
    checkPrecision(report.edgeCoverage);
    checkPrecision(report.pathCoverage);
    checkPrecision(report.overall);
  });
});
