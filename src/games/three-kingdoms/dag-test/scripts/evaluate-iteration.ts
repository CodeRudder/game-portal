/**
 * DAG测试评估脚本 — 读取覆盖率报告，分析未覆盖路径，生成分级Issue
 * 用法: npx tsx src/games/three-kingdoms/dag-test/scripts/evaluate-iteration.ts [round]
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportsDir = path.resolve(__dirname, '../../../../../dag-data/reports');
const pathsDir = path.resolve(__dirname, '../../../../../dag-data/paths');

// 获取当前轮次
const round = parseInt(process.argv[2] || '1');

// 读取覆盖率报告
const coverageFile = path.join(reportsDir, 'coverage-report.json');
if (!fs.existsSync(coverageFile)) {
  console.error('覆盖率报告不存在，请先运行 calculate-coverage.ts');
  process.exit(1);
}
const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf-8'));

// 读取路径文件
const dagTypes = ['navigation', 'flow', 'resource', 'events', 'state'];
const issues: any[] = [];
let issueId = 1;

for (const dagType of dagTypes) {
  const pathsFile = path.join(pathsDir, `${dagType}-paths.json`);
  if (!fs.existsSync(pathsFile)) continue;
  
  const pathsData = JSON.parse(fs.readFileSync(pathsFile, 'utf-8'));
  const result = coverage.dagResults?.[dagType];
  
  if (!result) continue;
  
  // 分析未覆盖路径
  const uncovered = result.uncoveredPaths || [];
  for (const p of uncovered.slice(0, 10)) {
    let severity = 'P3';
    const pathStr = p.join(' → ');
    
    // P0: 核心流程
    if (pathStr.match(/upgrade|recruit|battle|save|load/i)) severity = 'P0';
    // P1: 重要分支
    else if (pathStr.match(/insufficient|fail|defeat|locked|max/i)) severity = 'P1';
    // P2: 边界场景
    else if (pathStr.match(/empty|limit|boundary|edge/i)) severity = 'P2';
    
    issues.push({
      id: `${severity}-${String(issueId++).padStart(3, '0')}`,
      severity,
      dagType,
      path: p,
      description: `路径未覆盖: ${pathStr}`,
      suggestion: `为 ${dagType} DAG 路径添加测试: ${pathStr}`
    });
  }
}

// 按严重程度排序
issues.sort((a, b) => a.severity.localeCompare(b.severity));

// 生成评估报告
const evalReport = {
  iteration: round,
  timestamp: new Date().toISOString(),
  coverage: {
    ...coverage.dagResults,
    overall: coverage.overallCoverage
  },
  issues,
  fixes: [],
  nextActions: issues.slice(0, 5).map(i => `修复${i.id}: ${i.suggestion}`)
};

// 读取上一轮报告计算delta
const prevReportFile = path.join(reportsDir, `evaluation-R${round - 1}.json`);
if (fs.existsSync(prevReportFile)) {
  const prev = JSON.parse(fs.readFileSync(prevReportFile, 'utf-8'));
  evalReport.coverage.previousOverall = prev.coverage.overall;
  evalReport.coverage.delta = Math.round((evalReport.coverage.overall - prev.coverage.overall) * 1000) / 1000;
}

fs.writeFileSync(
  path.join(reportsDir, `evaluation-R${round}.json`),
  JSON.stringify(evalReport, null, 2)
);

// 输出摘要
console.log(`\n=== 评估报告 R${round} ===`);
console.log(`覆盖率: ${(evalReport.coverage.overall * 100).toFixed(1)}%`);
if (evalReport.coverage.delta !== undefined) {
  console.log(`变化: ${evalReport.coverage.delta > 0 ? '+' : ''}${(evalReport.coverage.delta * 100).toFixed(1)}%`);
}
console.log(`Issues: ${issues.length}`);
const p0 = issues.filter(i => i.severity === 'P0').length;
const p1 = issues.filter(i => i.severity === 'P1').length;
const p2 = issues.filter(i => i.severity === 'P2').length;
const p3 = issues.filter(i => i.severity === 'P3').length;
console.log(`  P0: ${p0}, P1: ${p1}, P2: ${p2}, P3: ${p3}`);
console.log(`报告已写入 dag-data/reports/evaluation-R${round}.json`);
