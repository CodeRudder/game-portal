/**
 * 路径枚举引擎
 *
 * 提供 BFS 路径枚举、关键路径提取、覆盖率计算三大核心能力。
 * 不依赖外部图计算库，所有算法基于简单的队列/栈实现。
 */

import type { BaseNode, BaseEdge, CoverageReport } from '../definitions';

// ═══════════════════════════════════════════════════════════════
// 核心算法：BFS路径枚举
// ═══════════════════════════════════════════════════════════════

/**
 * BFS路径枚举
 *
 * 给定DAG的nodes和edges，枚举所有从entryPoints可达的路径。
 * 路径以节点ID序列表示，如 ['A', 'B', 'C']。
 *
 * @param nodes    - DAG节点列表
 * @param edges    - DAG边列表
 * @param entryPoints - 入口节点ID列表
 * @param maxDepth - 最大搜索深度（防止无限循环），默认20
 * @param maxPaths - 最大路径数量（防止组合爆炸），默认1000
 * @returns 所有可达路径的数组
 */
export function enumeratePaths<
  TNode extends BaseNode,
  TEdge extends BaseEdge,
>(
  nodes: TNode[],
  edges: TEdge[],
  entryPoints: string[],
  maxDepth: number = 20,
  maxPaths: number = 1000,
): string[][] {
  // 空图直接返回
  if (nodes.length === 0 || entryPoints.length === 0) {
    return [];
  }

  // 构建邻接表：nodeId → 出边目标列表
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const targets = adjacency.get(edge.from);
    if (targets) {
      targets.push(edge.to);
    }
  }

  // 过滤有效的入口节点
  const validEntries = entryPoints.filter((ep) => adjacency.has(ep));
  if (validEntries.length === 0) {
    return [];
  }

  const allPaths: string[][] = [];
  // BFS队列：每项为当前路径（节点ID序列）
  const queue: string[][] = validEntries.map((ep) => [ep]);

  while (queue.length > 0 && allPaths.length < maxPaths) {
    const currentPath = queue.shift()!;

    // 路径长度超过maxDepth，截断并记录
    if (currentPath.length > maxDepth) {
      allPaths.push(currentPath.slice(0, maxDepth));
      continue;
    }

    const lastNode = currentPath[currentPath.length - 1];
    const neighbors = adjacency.get(lastNode) ?? [];

    if (neighbors.length === 0) {
      // 叶子节点 → 完整路径
      allPaths.push(currentPath);
    } else {
      let hasUnvisited = false;
      for (const neighbor of neighbors) {
        // 防止简单环：同一路径中不允许重复访问同一节点
        if (!currentPath.includes(neighbor)) {
          queue.push([...currentPath, neighbor]);
          hasUnvisited = true;
        }
      }
      // 如果所有邻居都已访问过（环），当前路径也是一条有效路径
      if (!hasUnvisited) {
        allPaths.push(currentPath);
      }
    }
  }

  return allPaths;
}

// ═══════════════════════════════════════════════════════════════
// 关键路径提取
// ═══════════════════════════════════════════════════════════════

/**
 * 提取关键路径
 *
 * 策略：
 *   1. 最长路径 — 覆盖最多节点的路径
 *   2. 必经节点路径 — 包含指定必须经过节点的路径
 *
 * @param allPaths      - 所有枚举出的路径
 * @param mustPassNodes - 必经节点ID列表（默认为空）
 * @returns 关键路径集合
 */
export function extractCriticalPaths(
  allPaths: string[][],
  mustPassNodes: string[] = [],
): string[][] {
  if (allPaths.length === 0) {
    return [];
  }

  const criticalPaths: string[][] = [];

  // 1. 最长路径
  let longestPath = allPaths[0];
  for (const path of allPaths) {
    if (path.length > longestPath.length) {
      longestPath = path;
    }
  }
  criticalPaths.push(longestPath);

  // 2. 必经节点路径 — 如果有指定必经节点
  if (mustPassNodes.length > 0) {
    const mustPassSet = new Set(mustPassNodes);

    for (const path of allPaths) {
      const pathSet = new Set(path);
      // 检查路径是否包含所有必经节点
      let allPassed = true;
      for (const node of mustPassSet) {
        if (!pathSet.has(node)) {
          allPassed = false;
          break;
        }
      }

      if (allPassed) {
        // 避免与最长路径重复
        const isDuplicate = criticalPaths.some(
          (cp) => cp.join(',') === path.join(','),
        );
        if (!isDuplicate) {
          criticalPaths.push(path);
        }
      }
    }
  }

  return criticalPaths;
}

// ═══════════════════════════════════════════════════════════════
// 覆盖率计算
// ═══════════════════════════════════════════════════════════════

/**
 * 计算节点和边的覆盖率
 *
 * @param nodes       - DAG节点列表
 * @param edges       - DAG边列表
 * @param allPaths    - 所有路径
 * @param testedPaths - 已测试路径
 * @returns 覆盖率统计
 */
export function calculateCoverage(
  nodes: BaseNode[],
  edges: BaseEdge[],
  allPaths: string[][],
  testedPaths: string[][],
): {
  nodeCoverage: number;
  edgeCoverage: number;
  uncoveredNodes: string[];
  uncoveredEdges: [string, string][];
} {
  // 收集所有路径覆盖的节点和边
  const allCoveredNodes = new Set<string>();
  const allCoveredEdges = new Set<string>();

  for (const path of allPaths) {
    for (const nodeId of path) {
      allCoveredNodes.add(nodeId);
    }
    for (let i = 0; i < path.length - 1; i++) {
      allCoveredEdges.add(`${path[i]}→${path[i + 1]}`);
    }
  }

  // 收集已测试路径覆盖的节点和边
  const testedNodes = new Set<string>();
  const testedEdges = new Set<string>();

  for (const path of testedPaths) {
    for (const nodeId of path) {
      testedNodes.add(nodeId);
    }
    for (let i = 0; i < path.length - 1; i++) {
      testedEdges.add(`${path[i]}→${path[i + 1]}`);
    }
  }

  // 计算未覆盖的节点
  const uncoveredNodes: string[] = [];
  for (const node of nodes) {
    if (allCoveredNodes.has(node.id) && !testedNodes.has(node.id)) {
      uncoveredNodes.push(node.id);
    }
  }

  // 计算未覆盖的边
  const uncoveredEdges: [string, string][] = [];
  for (const edge of edges) {
    const edgeKey = `${edge.from}→${edge.to}`;
    if (allCoveredEdges.has(edgeKey) && !testedEdges.has(edgeKey)) {
      uncoveredEdges.push([edge.from, edge.to]);
    }
  }

  // 计算覆盖率
  const totalNodes = allCoveredNodes.size;
  const totalEdges = allCoveredEdges.size;

  const coveredNodeCount = totalNodes - uncoveredNodes.length;
  const coveredEdgeCount = totalEdges - uncoveredEdges.length;

  return {
    nodeCoverage: totalNodes > 0 ? coveredNodeCount / totalNodes : 0,
    edgeCoverage: totalEdges > 0 ? coveredEdgeCount / totalEdges : 0,
    uncoveredNodes,
    uncoveredEdges,
  };
}
