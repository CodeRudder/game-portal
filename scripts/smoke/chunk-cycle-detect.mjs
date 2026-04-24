#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Chunk 循环依赖检测器 (Chunk Cycle Detection)
// ═══════════════════════════════════════════════════════════════════
//
// 解析 dist/assets/*.js 的 import 语句，构建有向图，
// 用 DFS 检测所有强连通分量（SCC），输出循环链路。
//
// 用法: node scripts/smoke/chunk-cycle-detect.mjs [--dist <path>]
//
// 退出码:
//   0 - 无循环依赖
//   1 - 检测到循环依赖
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

// ── 参数解析 ──
const args = process.argv.slice(2);
let distDir = join(PROJECT_ROOT, 'dist');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dist' && args[i + 1]) {
    distDir = resolve(args[i + 1]);
    i++;
  }
}

// ── 颜色输出 ──
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const CYAN = '\x1b[0;36m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

function logPass(msg) { console.log(`  ${GREEN}✅ PASS${NC} — ${msg}`); }
function logFail(msg) { console.log(`  ${RED}❌ FAIL${NC} — ${msg}`); }
function logWarn(msg) { console.log(`  ${YELLOW}⚠️  WARN${NC} — ${msg}`); }
function logInfo(msg) { console.log(`  ${CYAN}ℹ️  INFO${NC} — ${msg}`); }

console.log('');
console.log(`${BOLD}═══════════════════════════════════════════════════════════${NC}`);
console.log(`${BOLD}  🔗 Chunk 循环依赖检测器 (Tarjan SCC)${NC}`);
console.log(`${BOLD}═══════════════════════════════════════════════════════════${NC}`);
console.log(`  构建产物目录: ${CYAN}${distDir}${NC}`);
console.log('');

// ── 1. 读取所有 JS chunk 文件 ──
const assetsDir = join(distDir, 'assets');
if (!existsSync(assetsDir)) {
  logFail(`assets 目录不存在: ${assetsDir}`);
  process.exit(1);
}

const jsFiles = readdirSync(assetsDir)
  .filter(f => f.endsWith('.js'))
  .map(f => ({
    name: f,
    path: join(assetsDir, f),
  }));

if (jsFiles.length === 0) {
  logFail('未找到任何 JS chunk 文件');
  process.exit(1);
}

logInfo(`找到 ${jsFiles.length} 个 JS chunk 文件`);

// ── 2. 解析 import 语句，构建有向图 ──
const graph = new Map(); // chunkName -> Set<targetChunkName>
const chunkContents = new Map(); // chunkName -> file content

/**
 * 从 JS chunk 文件内容中提取所有 import 依赖
 * 匹配模式:
 *   - import{...}from"./xxx.js"
 *   - import"./xxx.js"
 *   - import("./xxx.js")  (动态 import)
 *   - __vite__mapDeps 中的 "assets/xxx.js"
 */
function extractImports(content, fileName) {
  const deps = new Set();

  // 静态 import: from"./xxx.js" 或 from'./xxx.js'
  const staticImportRegex = /from["']\.\/([^"']+\.js)["']/g;
  let match;
  while ((match = staticImportRegex.exec(content)) !== null) {
    deps.add(match[1]);
  }

  // 动态 import: import("./xxx.js") 或 import("./xxx.js")
  const dynamicImportRegex = /import\(["']\.\/([^"']+\.js)["']\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    deps.add(match[1]);
  }

  // __vite__mapDeps: "assets/xxx.js"
  const mapDepsRegex = /"assets\/([^"]+\.js)"/g;
  while ((match = mapDepsRegex.exec(content)) !== null) {
    deps.add(match[1]);
  }

  // 也检查 import() 中的模板字符串路径
  const templateImportRegex = /import\(`\.\/([^`]+\.js)`\)/g;
  while ((match = templateImportRegex.exec(content)) !== null) {
    deps.add(match[1]);
  }

  return deps;
}

for (const file of jsFiles) {
  const content = readFileSync(file.path, 'utf-8');
  chunkContents.set(file.name, content);
  const deps = extractImports(content, file.name);
  graph.set(file.name, deps);
}

// 输出依赖图摘要
console.log('');
console.log(`${BOLD}  📋 依赖图摘要:${NC}`);
const knownChunks = new Set(jsFiles.map(f => f.name));
for (const [chunk, deps] of graph) {
  // 只显示已知 chunk 间的依赖
  const knownDeps = [...deps].filter(d => knownChunks.has(d));
  const externalDeps = [...deps].filter(d => !knownChunks.has(d));
  if (knownDeps.length > 0) {
    logInfo(`${chunk} → [${knownDeps.join(', ')}]`);
  }
  if (externalDeps.length > 0) {
    // 外部引用（不在 dist/assets 中的）
  }
}

// ── 3. Tarjan 算法检测强连通分量 (SCC) ──
// Tarjan 算法可以找到所有循环依赖环
let index = 0;
const stack = [];
const onStack = new Set();
const indices = new Map();
const lowlinks = new Map();
const sccs = []; // Array of SCC arrays

function strongConnect(v) {
  indices.set(v, index);
  lowlinks.set(v, index);
  index++;
  stack.push(v);
  onStack.add(v);

  const deps = graph.get(v) || new Set();
  for (const w of deps) {
    // 只分析已知 chunk 间的依赖
    if (!knownChunks.has(w)) continue;

    if (!indices.has(w)) {
      strongConnect(w);
      lowlinks.set(v, Math.min(lowlinks.get(v), lowlinks.get(w)));
    } else if (onStack.has(w)) {
      lowlinks.set(v, Math.min(lowlinks.get(v), indices.get(w)));
    }
  }

  // 如果 v 是 SCC 的根节点
  if (lowlinks.get(v) === indices.get(v)) {
    const scc = [];
    let w;
    do {
      w = stack.pop();
      onStack.delete(w);
      scc.push(w);
    } while (w !== v);

    if (scc.length > 1) {
      sccs.push(scc);
    }
  }
}

for (const chunk of knownChunks) {
  if (!indices.has(chunk)) {
    strongConnect(chunk);
  }
}

// ── 4. 回溯并输出所有循环链路 ──
console.log('');
console.log(`${BOLD}  🔍 循环依赖检测结果:${NC}`);

if (sccs.length === 0) {
  logPass('未检测到 chunk 间循环依赖');
} else {
  logFail(`检测到 ${sccs.length} 个强连通分量（循环依赖）`);

  for (let i = 0; i < sccs.length; i++) {
    const scc = sccs[i];
    console.log('');
    console.log(`  ${RED}${BOLD}循环 #${i + 1}:${NC} 包含 ${scc.length} 个 chunk`);
    
    // 对 SCC 内节点按依赖关系排序，展示循环链路
    // 找到一条具体的循环路径
    const cyclePath = findCyclePath(scc, graph);
    if (cyclePath) {
      console.log(`  ${RED}  链路: ${cyclePath.join(' → ')} → ${cyclePath[0]}${NC}`);
    }

    // 列出 SCC 内所有 chunk 及其相互依赖
    for (const chunk of scc) {
      const deps = graph.get(chunk) || new Set();
      const sccDeps = [...deps].filter(d => scc.includes(d));
      if (sccDeps.length > 0) {
        console.log(`    ${YELLOW}${chunk}${NC} → [${sccDeps.map(d => RED + d + NC).join(', ')}]`);
      }
    }

    // 分析 TDZ 风险
    analyzeTDZRisk(scc, chunkContents, graph);
  }
}

/**
 * 在 SCC 中找到一条具体的循环路径
 */
function findCyclePath(scc, graph) {
  const sccSet = new Set(scc);
  const start = scc[0];
  const visited = new Set();
  const path = [];

  function dfs(node) {
    if (visited.has(node)) {
      if (node === start && path.length > 1) {
        return [...path];
      }
      return null;
    }
    visited.add(node);
    path.push(node);

    const deps = graph.get(node) || new Set();
    for (const dep of deps) {
      if (!sccSet.has(dep)) continue;
      const result = dfs(dep);
      if (result) return result;
    }

    path.pop();
    visited.delete(node);
    return null;
  }

  return dfs(start);
}

/**
 * 分析 SCC 内的 TDZ (Temporal Dead Zone) 风险
 * 检测 class extends 跨 chunk 引用
 */
function analyzeTDZRisk(scc, contents, graph) {
  const sccSet = new Set(scc);
  const seen = new Set();
  let risks = 0;

  for (const chunk of scc) {
    const content = contents.get(chunk);
    if (!content) continue;

    // 检测 extends 关键字
    const extendsRegex = /class\s+\w+\s+extends\s+(\w+)/g;
    let match;
    while ((match = extendsRegex.exec(content)) !== null) {
      const parentClass = match[1];

      // 检查父类是否来自 import
      const importRegex = new RegExp(`import[^;]*\\b${parentClass}\\b[^;]*from["']\\.\\/([^"']+\\.js)["']`, 'g');
      let importMatch;
      while ((importMatch = importRegex.exec(content)) !== null) {
        const sourceChunk = importMatch[1];
        const key = `${chunk}:extends:${parentClass}:from:${sourceChunk}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (sccSet.has(sourceChunk)) {
          console.log(`    ${RED}  🚨 TDZ 风险: ${chunk} extends ${parentClass} ← ${sourceChunk} (在同一个循环依赖中)${NC}`);
          console.log(`    ${RED}     可能触发 "Cannot access '${parentClass}' before initialization"${NC}`);
          risks++;
        }
      }
    }
  }

  if (risks === 0) {
    console.log(`    ${GREEN}  未检测到 class extends TDZ 风险${NC}`);
  }
}

// ── 5. 检测潜在的隐式循环（通过动态 import） ──
console.log('');
console.log(`${BOLD}  📊 动态 import 分析:${NC}`);

let dynamicImportCount = 0;
const dynamicImportMap = new Map(); // chunk -> [dynamic targets]

for (const [chunk, deps] of graph) {
  const content = chunkContents.get(chunk);
  if (!content) continue;

  // 检测 React.lazy 或 import() 动态加载
  const lazyImports = [];
  const lazyRegex = /(?:React\.lazy|lazy)\(\s*\(\)\s*=>\s*import\(["']\.\/([^"']+\.js)["']\)/g;
  let match;
  while ((match = lazyRegex.exec(content)) !== null) {
    lazyImports.push(match[1]);
    dynamicImportCount++;
  }

  // 通用 import() 调用
  const genericDynamicRegex = /import\(["']\.\/([^"']+\.js)["']\)/g;
  while ((match = genericDynamicRegex.exec(content)) !== null) {
    if (!lazyImports.includes(match[1])) {
      lazyImports.push(match[1]);
      dynamicImportCount++;
    }
  }

  if (lazyImports.length > 0) {
    dynamicImportMap.set(chunk, lazyImports);
    logInfo(`${chunk} 动态加载: [${lazyImports.join(', ')}]`);
  }
}

if (dynamicImportCount === 0) {
  logInfo('未检测到动态 import（所有模块静态加载）');
}

// ── 6. 依赖深度分析 ──
console.log('');
console.log(`${BOLD}  📏 依赖深度分析:${NC}`);

function getDepth(chunk, visited = new Set()) {
  if (visited.has(chunk)) return 0; // 循环
  visited.add(chunk);
  const deps = graph.get(chunk) || new Set();
  let maxDepth = 0;
  for (const dep of deps) {
    if (!knownChunks.has(dep)) continue;
    maxDepth = Math.max(maxDepth, getDepth(dep, new Set(visited)) + 1);
  }
  return maxDepth;
}

const depthAnalysis = [];
for (const chunk of knownChunks) {
  const depth = getDepth(chunk);
  depthAnalysis.push({ chunk, depth });
}
depthAnalysis.sort((a, b) => b.depth - a.depth);

for (const { chunk, depth } of depthAnalysis) {
  const bar = '█'.repeat(Math.min(depth, 20));
  const color = depth > 5 ? RED : depth > 3 ? YELLOW : GREEN;
  console.log(`    ${color}${bar}${NC} ${chunk} (深度: ${depth})`);
}

// ── 7. 汇总 ──
console.log('');
console.log(`${BOLD}═══════════════════════════════════════════════════════════${NC}`);
console.log(`${BOLD}  📊 检测汇总${NC}`);
console.log(`${BOLD}═══════════════════════════════════════════════════════════${NC}`);
console.log(`  JS chunks: ${jsFiles.length}`);
console.log(`  循环依赖 (SCC): ${sccs.length}`);
console.log(`  动态 import: ${dynamicImportCount}`);
console.log('');

if (sccs.length > 0) {
  console.log(`  ${RED}${BOLD}🚨 结果: FAIL — 检测到 ${sccs.length} 个循环依赖！${NC}`);
  console.log(`${BOLD}═══════════════════════════════════════════════════════════${NC}`);
  process.exit(1);
} else {
  console.log(`  ${GREEN}${BOLD}✨ 结果: PASS — 无循环依赖${NC}`);
  console.log(`${BOLD}═══════════════════════════════════════════════════════════${NC}`);
  process.exit(0);
}
