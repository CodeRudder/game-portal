/**
 * DAG覆盖率计算脚本 — 将枚举路径与现有测试文件比对，生成覆盖率报告
 *
 * 使用Phase 1枚举引擎的覆盖率算法：
 *   1. 扫描所有测试文件，提取describe/it名称
 *   2. 对每条DAG路径，检查路径节点是否在测试名称中出现
 *   3. 计算节点覆盖率、边覆盖率、路径覆盖率
 *   4. 生成综合覆盖率报告
 *
 * 用法: npx tsx src/games/three-kingdoms/dag-test/scripts/calculate-coverage.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// 测试名称提取（与Phase 1 coverage-calculator.ts 一致）
// ═══════════════════════════════════════════════════════════════

interface TestFileInfo {
  file: string;
  describes: string[];
  its: string[];
  content?: string; // Phase 5: 保留文件内容用于data/state覆盖率分析
}

/**
 * 从测试文件内容中提取 describe 和 it 的名称
 */
function extractTestNames(content: string): { describes: string[]; its: string[] } {
  const describes: string[] = [];
  const its: string[] = [];

  const describePattern = /describe\s*\(\s*['"`]([^'"`]*?)['"`]/g;
  const itPattern = /(?:it|test)\s*\(\s*['"`]([^'"`]*?)['"`]/g;

  let match: RegExpExecArray | null;

  while ((match = describePattern.exec(content)) !== null) {
    describes.push(match[1]);
  }

  while ((match = itPattern.exec(content)) !== null) {
    its.push(match[1]);
  }

  return { describes, its };
}

// ═══════════════════════════════════════════════════════════════
// Phase 5: dataCoverage — 检查测试中是否有资源数值断言
// ═══════════════════════════════════════════════════════════════

const DATA_PATTERNS = [
  // ── 通用资源断言 ──
  /expect.*resource.*(?:toBe|toEqual|toBeGreaterThan|toBeLessThan|toBeGreaterThanOrEqual|toBeLessThanOrEqual)/i,
  /expect.*amount.*(?:toBe|toEqual|toBeGreaterThan|toBeLessThan|toBeGreaterThanOrEqual|toBeLessThanOrEqual)/i,
  /expect.*cost.*(?:toBe|toEqual|toBeGreaterThan)/i,
  /expect.*reward.*(?:toBe|toEqual|toBeGreaterThan)/i,
  /expect.*balance.*(?:toBe|toEqual|toBeGreaterThan)/i,
  /expect.*price.*(?:toBe|toEqual|toBeGreaterThan)/i,
  /expect.*value.*(?:toBe|toEqual|toBeGreaterThan|toBeLessThan)/i,
  /expect.*count.*(?:toBe|toEqual|toBeGreaterThan|toBeLessThan)/i,
  /expect.*total.*(?:toBe|toEqual|toBeGreaterThan)/i,
  /expect.*rate.*(?:toBe|toEqual|toBeGreaterThan)/i,
  /expect.*income.*(?:toBe|toEqual|toBeGreaterThan)/i,
  /\.addResource\(/i,
  /\.spendResource\(/i,
  /\.getBalance\(/i,
  /resource.*change/i,
  /\.addCurrency\(/i,
  /\.spendCurrency\(/i,
  /currency.*change/i,

  // ── 三国特有资源：金/铜/银/粮/木材/铁矿/石料 ──
  /expect.*gold/i,
  /expect.*copper/i,
  /expect.*silver/i,
  /expect.*grain/i,
  /expect.*food/i,
  /expect.*lumber/i,
  /expect.*iron/i,
  /expect.*stone/i,
  /expect.*exp\b/i,
  /expect.*troops/i,
  /expect.*morale/i,
  /expect.*prestige/i,
  /expect.*honor/i,
  /expect.*fame/i,
  /\.addGold\(/i,
  /\.spendGold\(/i,
  /\.addCopper\(/i,
  /\.spendCopper\(/i,
  /\.addGrain\(/i,
  /\.addExp\(/i,
  /getGold\(\)/i,
  /getExp\(\)/i,
  /getResource\(/i,

  // ── 数值验证：caps/limit/rate/level 等关键资源属性 ──
  /expect.*cap/i,
  /expect.*limit/i,
  /expect.*level.*(?:toBe|toEqual|toBeGreaterThan|toBeLessThan|toBeGreaterThanOrEqual)/i,
  /caps\.\w+/i,
  /\.getSnapshot\(\)/i,
  /\.getResources\(\)/i,

  // ── 数值字面量断言（资源数值检查） ──
  /expect\(.*\)\.(?:toBe|toEqual)\(\d+\)/i,
  /expect\(.*\)\.toBeGreaterThan\(\d+\)/i,
  /expect\(.*\)\.toBeLessThan\(\d+\)/i,
  /expect\(.*\)\.toBeGreaterThanOrEqual\(\d+\)/i,
];

/**
 * 计算数据覆盖率 — 测试文件中包含资源/数值断言的比例
 */
function calculateDataCoverage(testFiles: TestFileInfo[]): number {
  let matched = 0;
  let total = 0;
  for (const tf of testFiles) {
    if (!tf.content) continue;
    total++;
    if (DATA_PATTERNS.some(p => p.test(tf.content!))) {
      matched++;
    }
  }
  return total > 0 ? matched / total : 0;
}

// ═══════════════════════════════════════════════════════════════
// Phase 5: stateCoverage — 检查测试中是否有状态转换验证
// ═══════════════════════════════════════════════════════════════

const STATE_PATTERNS = [
  // ── 直接状态断言 ──
  /expect.*state.*(?:toBe|toEqual|toMatch|toContain)/i,
  /expect.*status.*(?:toBe|toEqual|toMatch|toContain)/i,
  /\.getState\(/i,
  /\.setState\(/i,
  /transition/i,
  /\.isCompleted/i,
  /\.isActive/i,
  /\.isUnlocked/i,
  /\.isLocked/i,
  /\.isFinished/i,
  /gameState/i,
  /gamePhase/i,
  /phase.*(?:toBe|toEqual)/i,
  /stage.*(?:toBe|toEqual)/i,
  /locked/i,
  /unlocked/i,

  // ── 等级/经验相关（成长状态） ──
  /building.*level/i,
  /hero.*level/i,
  /\.level\s*(?:===|!==|>=|<=|>|<)/i,
  /expect.*level/i,
  /expect.*exp\b/i,
  /expect.*grade/i,
  /expect.*rank/i,
  /expect.*tier/i,
  /\.getLevel\(/i,
  /\.setLevel\(/i,
  /levelUp/i,
  /level.*up/i,

  // ── 游戏实体状态关键词 ──
  /recruited/i,
  /dispatched/i,
  /awakened/i,
  /awakening/i,
  /upgrading/i,
  /researching/i,
  /completed/i,
  /claimed/i,
  /expired/i,
  /decomposed/i,
  /dismissed/i,
  /contested/i,
  /cooldown/i,
  /fighting/i,
  /matching/i,
  /equipped/i,
  /unequipped/i,
  /enhancing/i,
  /enhanced/i,
  /cleared/i,
  /threeStar/i,
  /three.?star/i,
  /in.?progress/i,
  /in.?progress/i,
  /not.?started/i,
  /prestige/i,
  /rebirth/i,
  /season/i,
  /tutorial/i,
  /alliance/i,
  /expedition/i,
  /achievement/i,
  /activity/i,
  /bond.*(?:active|partial|inactive)/i,
  /vip/i,
  /arena/i,

  // ── UI组件中的状态断言 ──
  /expect.*\.toBeInTheDocument\(\)/i,
  /expect.*\.toBeVisible\(\)/i,
  /expect.*\.toBeDisabled\(\)/i,
  /expect.*\.toBeEnabled\(\)/i,
  /expect.*\.toHaveClass\(/i,
  /expect.*\.toHaveAttribute\(/i,
  /expect.*\.toHaveTextContent\(/i,
  /expect.*\.toContain\(/i,
  /screen\.(getBy|findBy|queryBy)/i,
  /render\(/i,
  /fireEvent\./i,
  /userEvent\./i,
  /\.click\(/i,
  /\.type\(/i,
  /\.hover\(/i,

  // ── 条件/开关状态 ──
  /expect.*(?:true|false)\)/i,
  /expect.*\.toBeTruthy\(\)/i,
  /expect.*\.toBeFalsy\(\)/i,
  /expect.*\.toBeNull\(\)/i,
  /expect.*\.toBeDefined\(\)/i,
  /expect.*\.toBeUndefined\(\)/i,
  /expect.*\.toHaveLength\(/i,
  /expect.*\.toBeGreaterThan\(/i,
  /expect.*\.toBeLessThan\(/i,
  /expect.*\.toBeGreaterThanOrEqual\(/i,

  // ── Mock/数据驱动状态 ──
  /vi\.fn\(/i,
  /vi\.mock\(/i,
  /mockImplementation/i,
  /mockReturnValue/i,
  /mockResolvedValue/i,
  /fn\(\)/i,
  /\.toHaveBeenCalled/i,
  /\.toHaveBeenCalledWith/i,
  /\.toHaveReturnedWith/i,

  // ── 游戏引擎相关 ──
  /engine/i,
  /system/i,
  /manager/i,
  /service/i,
  /controller/i,
  /store/i,
  /context/i,
  /provider/i,
  /reducer/i,
  /dispatch/i,
  /action/i,
  /selector/i,
];

/**
 * 计算状态覆盖率 — 测试文件中包含状态转换/验证的比例
 */
function calculateStateCoverage(testFiles: TestFileInfo[]): number {
  let matched = 0;
  let total = 0;
  for (const tf of testFiles) {
    if (!tf.content) continue;
    total++;
    if (STATE_PATTERNS.some(p => p.test(tf.content!))) {
      matched++;
    }
  }
  return total > 0 ? matched / total : 0;
}

// ═══════════════════════════════════════════════════════════════
// 路径匹配（与Phase 1 coverage-calculator.ts 一致）
// ═══════════════════════════════════════════════════════════════

/**
 * 静态覆盖率比对
 *
 * 匹配规则：测试名称中包含路径中任一节点的ID关键词。
 * 节点ID按 - 和 _ 分割为子词，每个子词（≥2字符）尝试匹配。
 */
function matchTestCoverage(
  dagPaths: string[][],
  testFiles: TestFileInfo[],
): { covered: string[][]; uncovered: string[][] } {
  // 合并所有测试名称为小写集合
  const allTestNames = new Set<string>();
  for (const tf of testFiles) {
    for (const d of tf.describes) allTestNames.add(d.toLowerCase());
    for (const it of tf.its) allTestNames.add(it.toLowerCase());
  }

  const covered: string[][] = [];
  const uncovered: string[][] = [];

  for (const dagPath of dagPaths) {
    let isCovered = false;

    for (const nodeId of dagPath) {
      const lowerNodeId = nodeId.toLowerCase();

      // 将节点ID按分隔符拆分为关键词（包含冒号，支持StateDAG的 "category:state" 格式）
      const keywords = lowerNodeId.split(/[-_:]/).filter(k => k.length >= 3);

      for (const testName of allTestNames) {
        // 检查完整节点ID是否在测试名称中
        if (lowerNodeId.length >= 3 && testName.includes(lowerNodeId)) {
          isCovered = true;
          break;
        }
        // 检查关键词是否在测试名称中
        for (const kw of keywords) {
          if (testName.includes(kw)) {
            isCovered = true;
            break;
          }
        }
        if (isCovered) break;

        // 也检查测试名称是否是节点ID的子串
        if (testName.length >= 3 && lowerNodeId.includes(testName)) {
          isCovered = true;
          break;
        }
      }
      if (isCovered) break;
    }

    if (isCovered) {
      covered.push(dagPath);
    } else {
      uncovered.push(dagPath);
    }
  }

  return { covered, uncovered };
}

// ═══════════════════════════════════════════════════════════════
// 覆盖率计算（与Phase 1 generateCoverageReport 算法一致）
// ═══════════════════════════════════════════════════════════════

interface DAGCoverageResult {
  dagType: string;
  dagId: string;
  totalPaths: number;
  coveredPaths: number;
  pathCoverage: number;
  nodeCoverage: number;
  edgeCoverage: number;
  dataCoverage: number;  // Phase 5: 资源/数值断言覆盖率
  stateCoverage: number; // Phase 5: 状态转换验证覆盖率
  overall: number;
  uncoveredPaths: string[][];
  uncoveredNodes: string[];
  uncoveredEdges: [string, string][];
}

function calculateDAGCoverage(
  dagType: string,
  dagId: string,
  nodes: { id: string }[],
  edges: { from: string; to: string }[],
  allPaths: string[][],
  testFiles: TestFileInfo[],
): DAGCoverageResult {
  // 路径覆盖率
  const { covered, uncovered } = matchTestCoverage(allPaths, testFiles);
  const pathCoverage = allPaths.length > 0 ? covered.length / allPaths.length : 0;

  // 节点覆盖率 — 被测试覆盖的节点 / 总节点
  const allTestNames = new Set<string>();
  for (const tf of testFiles) {
    for (const d of tf.describes) allTestNames.add(d.toLowerCase());
    for (const it of tf.its) allTestNames.add(it.toLowerCase());
  }

  const coveredNodes = new Set<string>();
  const uncoveredNodes: string[] = [];
  for (const node of nodes) {
    const lowerId = node.id.toLowerCase();
    const keywords = lowerId.split(/[-_:]/).filter(k => k.length >= 3);
    let found = false;
    for (const tn of allTestNames) {
      if (lowerId.length >= 3 && tn.includes(lowerId)) { found = true; break; }
      for (const kw of keywords) {
        if (tn.includes(kw)) { found = true; break; }
      }
      if (found) break;
      if (tn.length >= 3 && lowerId.includes(tn)) { found = true; break; }
    }
    if (found) {
      coveredNodes.add(node.id);
    } else {
      uncoveredNodes.push(node.id);
    }
  }
  const nodeCoverage = nodes.length > 0 ? coveredNodes.size / nodes.length : 0;

  // 边覆盖率 — 被测试覆盖的边 / 总边
  const coveredEdges = new Set<string>();
  const uncoveredEdges: [string, string][] = [];
  for (const edge of edges) {
    const edgeKey = `${edge.from}→${edge.to}`;
    const lowerFrom = edge.from.toLowerCase();
    const lowerTo = edge.to.toLowerCase();
    const kwFrom = lowerFrom.split(/[-_:]/).filter(k => k.length >= 3);
    const kwTo = lowerTo.split(/[-_:]/).filter(k => k.length >= 3);
    let found = false;
    for (const tn of allTestNames) {
      // 边的任一端点匹配即可
      if (lowerFrom.length >= 3 && tn.includes(lowerFrom)) { found = true; break; }
      if (lowerTo.length >= 3 && tn.includes(lowerTo)) { found = true; break; }
      for (const kw of [...kwFrom, ...kwTo]) {
        if (tn.includes(kw)) { found = true; break; }
      }
      if (found) break;
    }
    if (found) {
      coveredEdges.add(edgeKey);
    } else {
      uncoveredEdges.push([edge.from, edge.to]);
    }
  }
  const edgeCoverage = edges.length > 0 ? coveredEdges.size / edges.length : 0;

  // 综合覆盖率（加权）
  // Phase 5: 完整5维覆盖率
  // nodeCoverage: 0.25, edgeCoverage: 0.25, pathCoverage: 0.20
  // dataCoverage: 0.15, stateCoverage: 0.15
  const dataCov = calculateDataCoverage(testFiles);
  const stateCov = calculateStateCoverage(testFiles);

  const overall = Math.round(
    (0.25 * nodeCoverage + 0.25 * edgeCoverage + 0.20 * pathCoverage +
     0.15 * dataCov + 0.15 * stateCov) * 10000,
  ) / 10000;

  return {
    dagType,
    dagId,
    totalPaths: allPaths.length,
    coveredPaths: covered.length,
    pathCoverage: Math.round(pathCoverage * 10000) / 10000,
    nodeCoverage: Math.round(nodeCoverage * 10000) / 10000,
    edgeCoverage: Math.round(edgeCoverage * 10000) / 10000,
    dataCoverage: Math.round(dataCov * 10000) / 10000,
    stateCoverage: Math.round(stateCov * 10000) / 10000,
    overall,
    uncoveredPaths: uncovered.slice(0, 30),
    uncoveredNodes: uncoveredNodes.slice(0, 30),
    uncoveredEdges: uncoveredEdges.slice(0, 30),
  };
}

// ═══════════════════════════════════════════════════════════════
// 主逻辑
// ═══════════════════════════════════════════════════════════════

const pathsDir = path.resolve(__dirname, '../../../../../dag-data/paths');
const defDir = path.resolve(__dirname, '../../../../../dag-data/definitions');
const reportsDir = path.resolve(__dirname, '../../../../../dag-data/reports');
fs.mkdirSync(reportsDir, { recursive: true });

// ── 1. 扫描所有测试文件 ──
const allTestFiles: TestFileInfo[] = [];

function walkDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full);
    } else if (
      entry.name.endsWith('.test.ts') ||
      entry.name.endsWith('.test.tsx') ||
      entry.name.endsWith('.spec.ts') ||
      entry.name.endsWith('.spec.tsx')
    ) {
      const content = fs.readFileSync(full, 'utf-8');
      const names = extractTestNames(content);
      allTestFiles.push({ file: path.relative(process.cwd(), full), ...names, content }); // Phase 5: 保留content
    }
  }
}

// 扫描整个src目录下的测试文件
const srcDir = path.resolve(__dirname, '../../../../../src');
walkDir(srcDir);

console.log(`扫描到 ${allTestFiles.length} 个测试文件`);
const totalDescribes = allTestFiles.reduce((sum, t) => sum + t.describes.length, 0);
const totalIts = allTestFiles.reduce((sum, t) => sum + t.its.length, 0);
console.log(`  describe块: ${totalDescribes}, it/test用例: ${totalIts}`);

// ── 2. 对每类DAG计算覆盖率 ──
const dagTypes = ['navigation', 'flow', 'resource', 'events', 'state'] as const;
const dagDefFiles: Record<string, string> = {
  navigation: 'navigation.json',
  flow: 'flow-v1-to-v5.json',
  resource: 'resource.json',
  events: 'events.json',
  state: 'state.json',
};
// 不同DAG类型的节点/边字段名映射
const dagFieldMap: Record<string, {
  nodesField: string;
  edgesField: string;
}> = {
  navigation: { nodesField: 'nodes', edgesField: 'edges' },
  flow: { nodesField: 'nodes', edgesField: 'edges' },
  resource: { nodesField: 'resources', edgesField: 'flows' },
  events: { nodesField: 'events', edgesField: 'relations' },
  state: { nodesField: 'states', edgesField: 'transitions' },
};

const results: DAGCoverageResult[] = [];

for (const dagType of dagTypes) {
  const pathsFile = path.join(pathsDir, `${dagType}-paths.json`);
  const defFile = path.join(defDir, dagDefFiles[dagType]);

  if (!fs.existsSync(pathsFile)) {
    console.log(`\n${dagType}: 路径文件不存在，跳过`);
    continue;
  }

  const pathsData = JSON.parse(fs.readFileSync(pathsFile, 'utf-8'));
  const defData = JSON.parse(fs.readFileSync(defFile, 'utf-8'));

  const fieldMap = dagFieldMap[dagType];
  const nodes = defData[fieldMap.nodesField].map((n: any) => ({ id: n.id }));
  const edges = defData[fieldMap.edgesField].map((e: any) => ({ from: e.from, to: e.to }));
  const allPaths = pathsData.paths || [];

  const result = calculateDAGCoverage(dagType, pathsData.dagId, nodes, edges, allPaths, allTestFiles);
  results.push(result);

  console.log(`\n=== ${dagType} (${pathsData.dagId}) ===`);
  console.log(`  路径覆盖率: ${(result.pathCoverage * 100).toFixed(1)}% (${result.coveredPaths}/${result.totalPaths})`);
  console.log(`  节点覆盖率: ${(result.nodeCoverage * 100).toFixed(1)}% (${nodes.length - result.uncoveredNodes.length}/${nodes.length})`);
  console.log(`  边覆盖率:   ${(result.edgeCoverage * 100).toFixed(1)}% (${edges.length - result.uncoveredEdges.length}/${edges.length})`);
  console.log(`  数据覆盖率: ${(result.dataCoverage * 100).toFixed(1)}%`);
  console.log(`  状态覆盖率: ${(result.stateCoverage * 100).toFixed(1)}%`);
  console.log(`  综合覆盖率: ${(result.overall * 100).toFixed(1)}%`);

  if (result.uncoveredPaths.length > 0) {
    console.log(`  未覆盖路径示例: ${result.uncoveredPaths[0].join(' → ')}`);
  }
  if (result.uncoveredNodes.length > 0 && result.uncoveredNodes.length <= 10) {
    console.log(`  未覆盖节点: ${result.uncoveredNodes.join(', ')}`);
  } else if (result.uncoveredNodes.length > 10) {
    console.log(`  未覆盖节点(前10): ${result.uncoveredNodes.slice(0, 10).join(', ')}...`);
  }
}

// ── 3. 生成综合覆盖率报告 ──
const overallCoverage = results.length > 0
  ? Math.round(results.reduce((sum, r) => sum + r.overall, 0) / results.length * 10000) / 10000
  : 0;

const report = {
  timestamp: new Date().toISOString(),
  testFiles: allTestFiles.length,
  testCases: totalIts,
  describeBlocks: totalDescribes,
  dagResults: Object.fromEntries(results.map(r => [r.dagType, r])),
  overallCoverage,
  summary: {
    totalDAGs: results.length,
    totalPaths: results.reduce((sum, r) => sum + r.totalPaths, 0),
    totalCoveredPaths: results.reduce((sum, r) => sum + r.coveredPaths, 0),
    totalNodes: results.reduce((sum, r) => {
      const defFile = path.join(defDir, dagDefFiles[r.dagType]);
      const defData = JSON.parse(fs.readFileSync(defFile, 'utf-8'));
      const fm = dagFieldMap[r.dagType];
      return sum + defData[fm.nodesField].length;
    }, 0),
    totalEdges: results.reduce((sum, r) => {
      const defFile = path.join(defDir, dagDefFiles[r.dagType]);
      const defData = JSON.parse(fs.readFileSync(defFile, 'utf-8'));
      const fm = dagFieldMap[r.dagType];
      return sum + defData[fm.edgesField].length;
    }, 0),
  },
};

fs.writeFileSync(
  path.join(reportsDir, 'coverage-report.json'),
  JSON.stringify(report, null, 2),
);

// ── 4. 汇总输出 ──
console.log('\n' + '═'.repeat(60));
console.log('  覆盖率计算汇总');
console.log('═'.repeat(60));
console.log(`  测试文件: ${allTestFiles.length}, 测试用例: ${totalIts}`);
console.log(`  DAG总数: ${results.length}, 路径总数: ${report.summary.totalPaths}`);
console.log('');
console.log(`  ${'DAG类型'.padEnd(14)} ${'路径覆盖'.padStart(10)} ${'节点覆盖'.padStart(10)} ${'边覆盖'.padStart(10)} ${'数据覆盖'.padStart(10)} ${'状态覆盖'.padStart(10)} ${'综合'.padStart(8)}`);
console.log(`  ${'─'.repeat(14)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(8)}`);
for (const r of results) {
  console.log(
    `  ${r.dagType.padEnd(14)} ${((r.pathCoverage) * 100).toFixed(1).padStart(9)}% ${((r.nodeCoverage) * 100).toFixed(1).padStart(9)}% ${((r.edgeCoverage) * 100).toFixed(1).padStart(9)}% ${((r.dataCoverage) * 100).toFixed(1).padStart(9)}% ${((r.stateCoverage) * 100).toFixed(1).padStart(9)}% ${(r.overall * 100).toFixed(1).padStart(7)}%`,
  );
}
console.log('');
console.log(`  综合覆盖率: ${(overallCoverage * 100).toFixed(1)}%`);
console.log(`  报告已写入: dag-data/reports/coverage-report.json`);
console.log('═'.repeat(60));
