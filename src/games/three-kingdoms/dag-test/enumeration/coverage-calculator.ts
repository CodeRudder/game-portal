/**
 * 覆盖率计算器
 *
 * 提供：
 *   1. 静态覆盖率比对 — 将DAG路径与测试文件的describe/it名称做文本匹配
 *   2. 测试名称提取 — 从测试文件源码中提取describe/it名称
 *   3. 综合覆盖率报告生成
 */

import type { CoverageReport } from '../definitions';

// ═══════════════════════════════════════════════════════════════
// 测试名称提取
// ═══════════════════════════════════════════════════════════════

/**
 * 从测试文件内容中提取 describe 和 it 的名称
 *
 * 支持以下写法：
 *   - describe('xxx', ...)
 *   - describe("xxx", ...)
 *   - describe(`xxx`, ...)
 *   - it('xxx', ...)
 *   - it("xxx", ...)
 *   - it(`xxx`, ...)
 *   - test('xxx', ...) （别名）
 *
 * @param testFileContent - 测试文件源码
 * @returns 提取的describe和it名称列表
 */
export function extractTestNames(testFileContent: string): {
  describes: string[];
  its: string[];
} {
  const describes: string[] = [];
  const its: string[] = [];

  // 匹配 describe('xxx') / describe("xxx") / describe(`xxx`)
  const describePattern =
    /describe\s*\(\s*['"`]([^'"`]*?)['"`]/g;
  // 匹配 it('xxx') / test('xxx')
  const itPattern =
    /(?:it|test)\s*\(\s*['"`]([^'"`]*?)['"`]/g;

  let match: RegExpExecArray | null;

  match = describePattern.exec(testFileContent);
  while (match !== null) {
    describes.push(match[1]);
    match = describePattern.exec(testFileContent);
  }

  match = itPattern.exec(testFileContent);
  while (match !== null) {
    its.push(match[1]);
    match = itPattern.exec(testFileContent);
  }

  return { describes, its };
}

// ═══════════════════════════════════════════════════════════════
// 路径匹配
// ═══════════════════════════════════════════════════════════════

/**
 * 静态覆盖率比对
 *
 * 将DAG路径与测试文件的describe/it名称做文本匹配。
 * 匹配规则：测试名称中包含路径中任一节点的ID或label关键词。
 *
 * @param dagPaths  - DAG路径列表
 * @param testFiles - 测试文件信息列表
 * @returns 已覆盖和未覆盖的路径
 */
export function matchTestCoverage(
  dagPaths: string[][],
  testFiles: { file: string; describes: string[]; its: string[] }[],
): { covered: string[][]; uncovered: string[][] } {
  // 合并所有测试名称为小写集合
  const allTestNames = new Set<string>();
  for (const tf of testFiles) {
    for (const d of tf.describes) {
      allTestNames.add(d.toLowerCase());
    }
    for (const it of tf.its) {
      allTestNames.add(it.toLowerCase());
    }
  }

  const covered: string[][] = [];
  const uncovered: string[][] = [];

  for (const path of dagPaths) {
    // 路径中是否有任一节点ID出现在测试名称中
    let isCovered = false;
    for (const nodeId of path) {
      const lowerNodeId = nodeId.toLowerCase();
      // 节点ID必须作为完整单词或关键片段出现在测试名称中
      // 要求：测试名称包含节点ID（至少2个字符），或节点ID包含测试名称（至少2个字符）
      if (lowerNodeId.length >= 2) {
        for (const testName of allTestNames) {
          if (testName.includes(lowerNodeId)) {
            isCovered = true;
            break;
          }
        }
      }
      // 也检查测试名称是否是节点ID的子串（但测试名称至少2字符）
      if (!isCovered) {
        for (const testName of allTestNames) {
          if (testName.length >= 2 && lowerNodeId.includes(testName)) {
            isCovered = true;
            break;
          }
        }
      }
      if (isCovered) break;
    }

    if (isCovered) {
      covered.push(path);
    } else {
      uncovered.push(path);
    }
  }

  return { covered, uncovered };
}

// ═══════════════════════════════════════════════════════════════
// 综合覆盖率报告生成
// ═══════════════════════════════════════════════════════════════

/** DAG结构输入（最小约束） */
export interface DAGInput {
  nodes: { id: string }[];
  edges: { from: string; to: string }[];
}

/**
 * 生成综合覆盖率报告
 *
 * 加权公式：
 *   overall = 0.25×node + 0.25×edge + 0.20×path + 0.15×data + 0.15×state
 *
 * @param dag         - DAG结构
 * @param allPaths    - 所有枚举路径
 * @param testedPaths - 已测试路径
 * @param previousOverall - 上次综合覆盖率（可选）
 * @returns 覆盖率报告
 */
export function generateCoverageReport(
  dag: DAGInput,
  allPaths: string[][],
  testedPaths: string[][],
  previousOverall?: number,
): CoverageReport {
  // ── 节点覆盖率 ──
  const allNodes = new Set<string>();
  for (const node of dag.nodes) {
    allNodes.add(node.id);
  }

  const testedNodeSet = new Set<string>();
  for (const path of testedPaths) {
    for (const nodeId of path) {
      if (allNodes.has(nodeId)) {
        testedNodeSet.add(nodeId);
      }
    }
  }

  const nodeCoverage =
    allNodes.size > 0 ? testedNodeSet.size / allNodes.size : 0;

  // ── 边覆盖率 ──
  const allEdges = new Set<string>();
  for (const edge of dag.edges) {
    allEdges.add(`${edge.from}→${edge.to}`);
  }

  const testedEdgeSet = new Set<string>();
  for (const path of testedPaths) {
    for (let i = 0; i < path.length - 1; i++) {
      const edgeKey = `${path[i]}→${path[i + 1]}`;
      if (allEdges.has(edgeKey)) {
        testedEdgeSet.add(edgeKey);
      }
    }
  }

  const edgeCoverage =
    allEdges.size > 0 ? testedEdgeSet.size / allEdges.size : 0;

  // ── 路径覆盖率 ──
  const testedPathKeys = new Set(testedPaths.map((p) => p.join(',')));
  let coveredPathCount = 0;
  for (const path of allPaths) {
    if (testedPathKeys.has(path.join(','))) {
      coveredPathCount++;
    }
  }

  const pathCoverage =
    allPaths.length > 0 ? coveredPathCount / allPaths.length : 0;

  // ── 数据覆盖率 & 状态覆盖率 ──
  // Phase 1 暂不支持，默认为0
  const dataCoverage = 0;
  const stateCoverage = 0;

  // ── 综合覆盖率（加权） ──
  const overall = Math.round(
    (0.25 * nodeCoverage +
      0.25 * edgeCoverage +
      0.20 * pathCoverage +
      0.15 * dataCoverage +
      0.15 * stateCoverage) *
      10000,
  ) / 10000;

  // ── 未覆盖节点 ──
  const uncoveredNodes: string[] = [];
  for (const node of dag.nodes) {
    if (!testedNodeSet.has(node.id)) {
      uncoveredNodes.push(node.id);
    }
  }

  // ── 未覆盖边 ──
  const uncoveredEdges: [string, string][] = [];
  for (const edge of dag.edges) {
    const edgeKey = `${edge.from}→${edge.to}`;
    if (!testedEdgeSet.has(edgeKey)) {
      uncoveredEdges.push([edge.from, edge.to]);
    }
  }

  // ── 未覆盖路径 ──
  const uncoveredPaths: string[][] = [];
  for (const path of allPaths) {
    if (!testedPathKeys.has(path.join(','))) {
      uncoveredPaths.push(path);
    }
  }

  // ── 与上次对比 ──
  const delta =
    previousOverall !== undefined
      ? Math.round((overall - previousOverall) * 10000) / 10000
      : undefined;

  return {
    nodeCoverage: Math.round(nodeCoverage * 10000) / 10000,
    edgeCoverage: Math.round(edgeCoverage * 10000) / 10000,
    pathCoverage: Math.round(pathCoverage * 10000) / 10000,
    dataCoverage,
    stateCoverage,
    overall,
    previousOverall,
    delta,
    uncoveredNodes,
    uncoveredEdges,
    uncoveredPaths,
  };
}
