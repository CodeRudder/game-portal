/**
 * 路径枚举引擎 — 单元测试
 *
 * 测试场景：
 *   1. 简单线性DAG路径枚举
 *   2. 分支DAG路径枚举
 *   3. 循环DAG（maxDepth限制）
 *   4. 多入口DAG
 *   5. 空DAG
 *   6. 关键路径提取
 *   7. 覆盖率计算
 */

import { describe, it, expect } from 'vitest';
import {
  enumeratePaths,
  extractCriticalPaths,
  calculateCoverage,
} from '../enumeration';

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

/** 快速构建节点列表 */
function nodes(...ids: string[]) {
  return ids.map((id) => ({ id }));
}

/** 快速构建边列表 */
function edges(...pairs: [string, string][]) {
  return pairs.map(([from, to]) => ({ from, to }));
}

// ═══════════════════════════════════════════════════════════════
// enumeratePaths 测试
// ═══════════════════════════════════════════════════════════════

describe('enumeratePaths', () => {
  it('简单线性DAG: A → B → C', () => {
    const result = enumeratePaths(
      nodes('A', 'B', 'C'),
      edges(['A', 'B'], ['B', 'C']),
      ['A'],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(['A', 'B', 'C']);
  });

  it('分支DAG: A → B, A → C', () => {
    const result = enumeratePaths(
      nodes('A', 'B', 'C'),
      edges(['A', 'B'], ['A', 'C']),
      ['A'],
    );

    expect(result).toHaveLength(2);
    // 顺序可能不确定，检查包含关系
    const pathStrings = result.map((p) => p.join(','));
    expect(pathStrings).toContain('A,B');
    expect(pathStrings).toContain('A,C');
  });

  it('菱形DAG: A → B → D, A → C → D', () => {
    const result = enumeratePaths(
      nodes('A', 'B', 'C', 'D'),
      edges(['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']),
      ['A'],
    );

    expect(result).toHaveLength(2);
    const pathStrings = result.map((p) => p.join(','));
    expect(pathStrings).toContain('A,B,D');
    expect(pathStrings).toContain('A,C,D');
  });

  it('循环DAG: A → B → C → A（应通过环检测截断）', () => {
    const result = enumeratePaths(
      nodes('A', 'B', 'C'),
      edges(['A', 'B'], ['B', 'C'], ['C', 'A']),
      ['A'],
    );

    // A→B→C，C→A是环，不会重复访问A
    expect(result.length).toBeGreaterThanOrEqual(1);
    // 每条路径不应包含重复节点
    for (const path of result) {
      const uniqueNodes = new Set(path);
      expect(uniqueNodes.size).toBe(path.length);
    }
  });

  it('多入口DAG: 入口 B 和 C', () => {
    const result = enumeratePaths(
      nodes('A', 'B', 'C', 'D'),
      edges(['A', 'D'], ['B', 'D'], ['C', 'D']),
      ['B', 'C'],
    );

    expect(result).toHaveLength(2);
    const pathStrings = result.map((p) => p.join(','));
    expect(pathStrings).toContain('B,D');
    expect(pathStrings).toContain('C,D');
  });

  it('空DAG: 无节点', () => {
    const result = enumeratePaths([], [], ['A']);
    expect(result).toEqual([]);
  });

  it('空DAG: 无入口', () => {
    const result = enumeratePaths(nodes('A', 'B'), edges(['A', 'B']), []);
    expect(result).toEqual([]);
  });

  it('入口节点不存在于图中', () => {
    const result = enumeratePaths(nodes('A', 'B'), edges(['A', 'B']), ['X']);
    expect(result).toEqual([]);
  });

  it('单节点DAG（无出边）', () => {
    const result = enumeratePaths(nodes('A'), [], ['A']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(['A']);
  });

  it('maxPaths限制：防止组合爆炸', () => {
    // 构建完全二叉树，深度5 → 32条路径
    const ns = nodes('root');
    const es: [string, string][] = [];

    for (let level = 0; level < 4; level++) {
      const prefix = `L${level}_`;
      const nextPrefix = `L${level + 1}_`;
      for (let i = 0; i < Math.pow(2, level); i++) {
        const parentId = level === 0 ? 'root' : `${prefix}${i}`;
        const leftId = `${nextPrefix}${i * 2}`;
        const rightId = `${nextPrefix}${i * 2 + 1}`;
        ns.push({ id: leftId }, { id: rightId });
        es.push([parentId, leftId], [parentId, rightId]);
      }
    }

    const result = enumeratePaths(ns, es, ['root'], 20, 5);
    // 受maxPaths=5限制
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('复杂DAG: 多层分支汇聚', () => {
    // A → B → D → F
    // A → C → D → F
    // A → C → E → F
    const result = enumeratePaths(
      nodes('A', 'B', 'C', 'D', 'E', 'F'),
      edges(
        ['A', 'B'],
        ['A', 'C'],
        ['B', 'D'],
        ['C', 'D'],
        ['C', 'E'],
        ['D', 'F'],
        ['E', 'F'],
      ),
      ['A'],
    );

    expect(result).toHaveLength(3);
    const pathStrings = result.map((p) => p.join(','));
    expect(pathStrings).toContain('A,B,D,F');
    expect(pathStrings).toContain('A,C,D,F');
    expect(pathStrings).toContain('A,C,E,F');
  });
});

// ═══════════════════════════════════════════════════════════════
// extractCriticalPaths 测试
// ═══════════════════════════════════════════════════════════════

describe('extractCriticalPaths', () => {
  it('空路径列表', () => {
    const result = extractCriticalPaths([]);
    expect(result).toEqual([]);
  });

  it('单条路径', () => {
    const result = extractCriticalPaths([['A', 'B', 'C']]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(['A', 'B', 'C']);
  });

  it('多条路径：返回最长路径', () => {
    const paths = [
      ['A', 'B'],
      ['A', 'B', 'C', 'D'],
      ['A', 'C'],
    ];

    const result = extractCriticalPaths(paths);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(['A', 'B', 'C', 'D']);
  });

  it('必经节点路径：指定必须经过B', () => {
    const paths = [
      ['A', 'C', 'D'],
      ['A', 'B', 'C', 'D'],
      ['A', 'D'],
    ];

    const result = extractCriticalPaths(paths, ['B']);
    // 最长路径是 A,B,C,D（也是包含B的路径）
    // 包含B的路径：A,B,C,D
    expect(result.length).toBeGreaterThanOrEqual(1);
    // 至少包含经过B的路径
    const hasBPath = result.some((p) => p.includes('B'));
    expect(hasBPath).toBe(true);
  });

  it('必经节点路径：多个必经节点', () => {
    const paths = [
      ['A', 'B', 'D'],
      ['A', 'C', 'E'],
      ['A', 'B', 'C', 'E'],
    ];

    const result = extractCriticalPaths(paths, ['B', 'C']);
    // 最长路径：A,B,C,E（3个节点）
    // 必经B和C：A,B,C,E
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(['A', 'B', 'C', 'E']);
  });

  it('无路径满足必经节点时只返回最长路径', () => {
    const paths = [
      ['A', 'B'],
      ['A', 'C'],
    ];

    const result = extractCriticalPaths(paths, ['X']);
    // 最长路径（两条都是2节点，取第一条）
    expect(result).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// calculateCoverage 测试
// ═══════════════════════════════════════════════════════════════

describe('calculateCoverage', () => {
  it('100%覆盖', () => {
    const ns = nodes('A', 'B', 'C');
    const es = edges(['A', 'B'], ['B', 'C']);
    const allPaths = [['A', 'B', 'C']];
    const testedPaths = [['A', 'B', 'C']];

    const result = calculateCoverage(ns, es, allPaths, testedPaths);

    expect(result.nodeCoverage).toBe(1);
    expect(result.edgeCoverage).toBe(1);
    expect(result.uncoveredNodes).toEqual([]);
    expect(result.uncoveredEdges).toEqual([]);
  });

  it('50%节点覆盖', () => {
    const ns = nodes('A', 'B', 'C', 'D');
    const es = edges(['A', 'B'], ['C', 'D']);
    const allPaths = [['A', 'B'], ['C', 'D']];
    const testedPaths = [['A', 'B']];

    const result = calculateCoverage(ns, es, allPaths, testedPaths);

    expect(result.nodeCoverage).toBe(0.5);
    expect(result.uncoveredNodes).toContain('C');
    expect(result.uncoveredNodes).toContain('D');
  });

  it('0%覆盖', () => {
    const ns = nodes('A', 'B');
    const es = edges(['A', 'B']);
    const allPaths = [['A', 'B']];
    const testedPaths: string[][] = [];

    const result = calculateCoverage(ns, es, allPaths, testedPaths);

    expect(result.nodeCoverage).toBe(0);
    expect(result.edgeCoverage).toBe(0);
    expect(result.uncoveredNodes).toEqual(['A', 'B']);
    expect(result.uncoveredEdges).toEqual([['A', 'B']]);
  });

  it('部分边覆盖', () => {
    const ns = nodes('A', 'B', 'C', 'D');
    const es = edges(['A', 'B'], ['B', 'C'], ['C', 'D']);
    const allPaths = [['A', 'B', 'C', 'D']];
    // 只测试了前半段
    const testedPaths = [['A', 'B']];

    const result = calculateCoverage(ns, es, allPaths, testedPaths);

    // 节点：A,B被覆盖 → 2/4 = 0.5
    expect(result.nodeCoverage).toBe(0.5);
    // 边：A→B被覆盖 → 1/3
    expect(result.edgeCoverage).toBeCloseTo(1 / 3, 4);
    expect(result.uncoveredEdges).toContainEqual(['B', 'C']);
    expect(result.uncoveredEdges).toContainEqual(['C', 'D']);
  });

  it('空图', () => {
    const result = calculateCoverage([], [], [], []);

    expect(result.nodeCoverage).toBe(0);
    expect(result.edgeCoverage).toBe(0);
    expect(result.uncoveredNodes).toEqual([]);
    expect(result.uncoveredEdges).toEqual([]);
  });
});
