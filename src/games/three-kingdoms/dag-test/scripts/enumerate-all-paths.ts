/**
 * DAG路径枚举脚本 — 对5类DAG执行路径枚举，输出到 dag-data/paths/
 *
 * 使用Phase 1枚举引擎的BFS算法，对每类DAG从入口点出发枚举所有可达路径，
 * 并提取关键路径。结果写入 dag-data/paths/ 目录。
 *
 * 用法: npx tsx src/games/three-kingdoms/dag-test/scripts/enumerate-all-paths.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// 内联枚举算法（与Phase 1 path-enumerator.ts 保持一致）
// ═══════════════════════════════════════════════════════════════

interface HasId { id: string; }
interface HasFromTo { from: string; to: string; }

/**
 * BFS路径枚举 — 与Phase 1 path-enumerator.ts 算法一致
 *
 * 给定DAG的nodes和edges，从entryPoints出发BFS枚举所有可达路径。
 * 路径以节点ID序列表示，如 ['A', 'B', 'C']。
 *
 * @param nodes       - DAG节点列表（至少包含id字段）
 * @param edges       - DAG边列表（至少包含from/to字段）
 * @param entryPoints - 入口节点ID列表
 * @param maxDepth    - 最大搜索深度，默认20
 * @param maxPaths    - 最大路径数量，默认1000
 * @returns 所有可达路径
 */
function enumeratePaths(
  nodes: HasId[],
  edges: HasFromTo[],
  entryPoints: string[],
  maxDepth: number = 20,
  maxPaths: number = 1000,
): string[][] {
  if (nodes.length === 0 || entryPoints.length === 0) return [];

  // 构建邻接表
  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    const targets = adjacency.get(e.from);
    if (targets) targets.push(e.to);
  }

  // 过滤有效入口
  const validEntries = entryPoints.filter(ep => adjacency.has(ep));
  if (validEntries.length === 0) return [];

  const allPaths: string[][] = [];
  const queue: string[][] = validEntries.map(ep => [ep]);

  while (queue.length > 0 && allPaths.length < maxPaths) {
    const currentPath = queue.shift()!;

    if (currentPath.length > maxDepth) {
      allPaths.push(currentPath.slice(0, maxDepth));
      continue;
    }

    const lastNode = currentPath[currentPath.length - 1];
    const neighbors = adjacency.get(lastNode) ?? [];

    if (neighbors.length === 0) {
      allPaths.push(currentPath);
    } else {
      let hasUnvisited = false;
      for (const neighbor of neighbors) {
        if (!currentPath.includes(neighbor)) {
          queue.push([...currentPath, neighbor]);
          hasUnvisited = true;
        }
      }
      if (!hasUnvisited) {
        allPaths.push(currentPath);
      }
    }
  }

  return allPaths;
}

/**
 * 关键路径提取 — 与Phase 1 path-enumerator.ts 算法一致
 *
 * 策略：
 *   1. 最长路径（覆盖最多节点）
 *   2. 必经节点路径（包含所有指定节点的路径）
 */
function extractCriticalPaths(
  allPaths: string[][],
  mustPassNodes: string[] = [],
): string[][] {
  if (allPaths.length === 0) return [];

  const criticalPaths: string[][] = [];

  // 1. 最长路径
  let longestPath = allPaths[0];
  for (const p of allPaths) {
    if (p.length > longestPath.length) longestPath = p;
  }
  criticalPaths.push(longestPath);

  // 2. 必经节点路径
  if (mustPassNodes.length > 0) {
    const mustSet = new Set(mustPassNodes);
    for (const p of allPaths) {
      const pSet = new Set(p);
      let allPassed = true;
      for (const n of mustSet) {
        if (!pSet.has(n)) { allPassed = false; break; }
      }
      if (allPassed) {
        const isDup = criticalPaths.some(cp => cp.join(',') === p.join(','));
        if (!isDup) criticalPaths.push(p);
      }
    }
  }

  return criticalPaths;
}

// ═══════════════════════════════════════════════════════════════
// 路径统计辅助
// ═══════════════════════════════════════════════════════════════

interface PathStats {
  dagId: string;
  dagType: string;
  nodeCount: number;
  edgeCount: number;
  totalPaths: number;
  criticalPaths: string[][];
  paths: string[][];
  avgPathLength: number;
  maxPathLength: number;
  minPathLength: number;
}

function computeStats(
  dagId: string,
  dagType: string,
  nodeCount: number,
  edgeCount: number,
  allPaths: string[][],
  criticalPaths: string[][],
): PathStats {
  const lengths = allPaths.map(p => p.length);
  return {
    dagId,
    dagType,
    nodeCount,
    edgeCount,
    totalPaths: allPaths.length,
    criticalPaths,
    paths: allPaths,
    avgPathLength: lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length * 100) / 100
      : 0,
    maxPathLength: lengths.length > 0 ? Math.max(...lengths) : 0,
    minPathLength: lengths.length > 0 ? Math.min(...lengths) : 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// 主逻辑：对5类DAG执行路径枚举
// ═══════════════════════════════════════════════════════════════

const defDir = path.resolve(__dirname, '../../../../../dag-data/definitions');
const outDir = path.resolve(__dirname, '../../../../../dag-data/paths');
fs.mkdirSync(outDir, { recursive: true });

const allStats: PathStats[] = [];

// ─── 1. NavigationDAG ───
// 结构：nodes[], edges[], entryPoints[]
console.log('=== 1. NavigationDAG ===');
const nav = JSON.parse(fs.readFileSync(path.join(defDir, 'navigation.json'), 'utf-8'));
const navPaths = enumeratePaths(nav.nodes, nav.edges, nav.entryPoints || [nav.nodes[0]?.id]);
const navCritical = extractCriticalPaths(navPaths);
const navStats = computeStats(nav.id, 'navigation', nav.nodes.length, nav.edges.length, navPaths, navCritical);
allStats.push(navStats);
console.log(`  节点: ${nav.nodes.length}, 边: ${nav.edges.length}`);
console.log(`  入口点: ${nav.entryPoints?.join(', ') || nav.nodes[0]?.id}`);
console.log(`  枚举路径: ${navPaths.length}, 关键路径: ${navCritical.length}`);
console.log(`  路径长度: min=${navStats.minPathLength}, max=${navStats.maxPathLength}, avg=${navStats.avgPathLength}`);
fs.writeFileSync(
  path.join(outDir, 'navigation-paths.json'),
  JSON.stringify(navStats, null, 2),
);

// ─── 2. FlowDAG ───
// 结构：nodes[], edges[], criticalPaths[][]
console.log('\n=== 2. FlowDAG ===');
const flow = JSON.parse(fs.readFileSync(path.join(defDir, 'flow-v1-to-v5.json'), 'utf-8'));
// FlowDAG没有显式entryPoints，取第一个节点作为入口
const flowEntryPoints = [flow.nodes[0]?.id].filter(Boolean);
const flowPaths = enumeratePaths(flow.nodes, flow.edges, flowEntryPoints);
// 使用定义中的criticalPaths作为mustPassNodes的来源
const flowMustPass = flow.criticalPaths?.flat() || [];
const flowCritical = extractCriticalPaths(flowPaths, flowMustPass);
const flowStats = computeStats(flow.id, 'flow', flow.nodes.length, flow.edges.length, flowPaths, flowCritical);
allStats.push(flowStats);
console.log(`  节点: ${flow.nodes.length}, 边: ${flow.edges.length}`);
console.log(`  入口点: ${flowEntryPoints.join(', ')}`);
console.log(`  枚举路径: ${flowPaths.length}, 关键路径: ${flowCritical.length}`);
console.log(`  路径长度: min=${flowStats.minPathLength}, max=${flowStats.maxPathLength}, avg=${flowStats.avgPathLength}`);
fs.writeFileSync(
  path.join(outDir, 'flow-paths.json'),
  JSON.stringify(flowStats, null, 2),
);

// ─── 3. ResourceDAG ───
// 结构：resources[], flows[] — 字段名不同于nodes/edges
console.log('\n=== 3. ResourceDAG ===');
const res = JSON.parse(fs.readFileSync(path.join(defDir, 'resource.json'), 'utf-8'));
// 将resources映射为 {id} 格式，flows映射为 {from, to} 格式
const resNodes = res.resources.map((r: any) => ({ id: r.id }));
const resEdges = res.flows.map((f: any) => ({ from: f.from, to: f.to }));
// 入口点：产出源（src-开头）和资源节点（res-开头）
const resEntryPoints = res.resources
  .filter((r: any) => r.id.startsWith('src-'))
  .map((r: any) => r.id);
const resPaths = enumeratePaths(resNodes, resEdges, resEntryPoints);
const resCritical = extractCriticalPaths(resPaths);
const resStats = computeStats(res.id, 'resource', res.resources.length, res.flows.length, resPaths, resCritical);
allStats.push(resStats);
console.log(`  资源节点: ${res.resources.length}, 流转边: ${res.flows.length}`);
console.log(`  入口点(产出源): ${resEntryPoints.length}个`);
console.log(`  枚举路径: ${resPaths.length}, 关键路径: ${resCritical.length}`);
console.log(`  路径长度: min=${resStats.minPathLength}, max=${resStats.maxPathLength}, avg=${resStats.avgPathLength}`);
fs.writeFileSync(
  path.join(outDir, 'resource-paths.json'),
  JSON.stringify(resStats, null, 2),
);

// ─── 4. EventDAG ───
// 结构：events[], relations[] — 字段名不同于nodes/edges
console.log('\n=== 4. EventDAG ===');
const evt = JSON.parse(fs.readFileSync(path.join(defDir, 'events.json'), 'utf-8'));
const evtNodes = evt.events.map((e: any) => ({ id: e.id }));
const evtEdges = evt.relations.map((r: any) => ({ from: r.from, to: r.to }));
// 入口点：找出没有入边的事件（根事件/源头事件）
const evtHasIncoming = new Set(evt.relations.map((r: any) => r.to));
const evtEntryPoints = evt.events
  .filter((e: any) => !evtHasIncoming.has(e.id))
  .map((e: any) => e.id);
const evtPaths = enumeratePaths(evtNodes, evtEdges, evtEntryPoints);
const evtCritical = extractCriticalPaths(evtPaths);
const evtStats = computeStats(evt.id, 'event', evt.events.length, evt.relations.length, evtPaths, evtCritical);
allStats.push(evtStats);
console.log(`  事件节点: ${evt.events.length}, 关系边: ${evt.relations.length}`);
console.log(`  入口点(根事件): ${evtEntryPoints.length}个`);
console.log(`  枚举路径: ${evtPaths.length}, 关键路径: ${evtCritical.length}`);
console.log(`  路径长度: min=${evtStats.minPathLength}, max=${evtStats.maxPathLength}, avg=${evtStats.avgPathLength}`);
fs.writeFileSync(
  path.join(outDir, 'events-paths.json'),
  JSON.stringify(evtStats, null, 2),
);

// ─── 5. StateDAG ───
// 结构：states[], transitions[] — 字段名不同于nodes/edges
console.log('\n=== 5. StateDAG ===');
const state = JSON.parse(fs.readFileSync(path.join(defDir, 'state.json'), 'utf-8'));
const stateNodes = state.states.map((s: any) => ({ id: s.id }));
const stateEdges = state.transitions.map((t: any) => ({ from: t.from, to: t.to }));
// 入口点：所有标记为isInitial的状态
const stateEntryPoints = state.states
  .filter((s: any) => s.isInitial)
  .map((s: any) => s.id);
const statePaths = enumeratePaths(stateNodes, stateEdges, stateEntryPoints);
const stateCritical = extractCriticalPaths(statePaths);
const stateStats = computeStats(state.id, 'state', state.states.length, state.transitions.length, statePaths, stateCritical);
allStats.push(stateStats);
console.log(`  状态节点: ${state.states.length}, 转换边: ${state.transitions.length}`);
console.log(`  入口点(初始状态): ${stateEntryPoints.length}个`);
console.log(`  枚举路径: ${statePaths.length}, 关键路径: ${stateCritical.length}`);
console.log(`  路径长度: min=${stateStats.minPathLength}, max=${stateStats.maxPathLength}, avg=${stateStats.avgPathLength}`);
fs.writeFileSync(
  path.join(outDir, 'state-paths.json'),
  JSON.stringify(stateStats, null, 2),
);

// ═══════════════════════════════════════════════════════════════
// 汇总输出
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log('  路径枚举汇总');
console.log('═'.repeat(60));

const totalPaths = allStats.reduce((sum, s) => sum + s.totalPaths, 0);
const totalNodes = allStats.reduce((sum, s) => sum + s.nodeCount, 0);
const totalEdges = allStats.reduce((sum, s) => sum + s.edgeCount, 0);

console.log(`  总节点: ${totalNodes}, 总边: ${totalEdges}`);
console.log(`  总路径数: ${totalPaths}`);
console.log('');
console.log(`  ${'DAG类型'.padEnd(14)} ${'节点'.padStart(4)} ${'边'.padStart(4)} ${'路径'.padStart(5)} ${'关键'.padStart(4)} ${'最短'.padStart(4)} ${'最长'.padStart(4)} ${'平均'.padStart(5)}`);
console.log(`  ${'─'.repeat(14)} ${'─'.repeat(4)} ${'─'.repeat(4)} ${'─'.repeat(5)} ${'─'.repeat(4)} ${'─'.repeat(4)} ${'─'.repeat(4)} ${'─'.repeat(5)}`);
for (const s of allStats) {
  console.log(
    `  ${s.dagType.padEnd(14)} ${String(s.nodeCount).padStart(4)} ${String(s.edgeCount).padStart(4)} ${String(s.totalPaths).padStart(5)} ${String(s.criticalPaths.length).padStart(4)} ${String(s.minPathLength).padStart(4)} ${String(s.maxPathLength).padStart(4)} ${String(s.avgPathLength).padStart(5)}`,
  );
}
console.log('');
console.log(`  输出目录: ${outDir}`);
console.log('═'.repeat(60));
