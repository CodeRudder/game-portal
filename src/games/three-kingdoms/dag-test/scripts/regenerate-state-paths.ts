/**
 * 重新生成 State DAG 路径 — Phase 2
 * 
 * 包含新增状态：building:max-level, hero:injured, hero:recovering,
 * quest:abandoned, alliance:rejected, tech:paused, equipment:locked,
 * activity:task-expired, stage:sweeping
 * 
 * 用法: npx tsx src/games/three-kingdoms/dag-test/scripts/regenerate-state-paths.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StateDef {
  id: string;
  entity: string;
  state: string;
  isInitial: boolean;
  isFinal: boolean;
}

interface TransitionDef {
  from: string;
  to: string;
  trigger: string;
  condition: string;
  sideEffects: string[];
}

// Load state DAG definition
const stateDagPath = path.resolve(__dirname, '../../../../../dag-data/definitions/state.json');
const stateDag = JSON.parse(fs.readFileSync(stateDagPath, 'utf-8'));

const states: StateDef[] = stateDag.states;
const transitions: TransitionDef[] = stateDag.transitions;

// Build adjacency list
const adj = new Map<string, string[]>();
for (const t of transitions) {
  if (!adj.has(t.from)) adj.set(t.from, []);
  adj.get(t.from)!.push(t.to);
}

// Find initial states
const initialStates = states.filter(s => s.isInitial).map(s => s.id);

// BFS path enumeration with back-edge support (max depth 8, max paths 200)
function enumeratePaths(
  starts: string[],
  maxDepth: number = 8,
  maxPaths: number = 200,
  allowBackEdges: boolean = true,
): string[][] {
  const paths: string[][] = [];
  const queue: string[][] = starts.map(s => [s]);

  while (queue.length > 0 && paths.length < maxPaths) {
    const current = queue.shift()!;
    const lastNode = current[current.length - 1];

    // Record this path
    paths.push(current);

    if (current.length >= maxDepth) continue;

    const neighbors = adj.get(lastNode) || [];
    for (const next of neighbors) {
      // Prevent immediate backtracking (a→b→a)
      if (current.length >= 2 && current[current.length - 2] === next) continue;

      if (allowBackEdges) {
        // Allow revisiting but limit to 2 visits per node
        const visitCount = current.filter(n => n === next).length;
        if (visitCount >= 2) continue;
      } else {
        // No revisiting
        if (current.includes(next)) continue;
      }

      queue.push([...current, next]);
    }
  }

  return paths;
}

const allPaths = enumeratePaths(initialStates, 8, 200, true);

// Sort paths by length
allPaths.sort((a, b) => a.length - b.length);

const outputPath = {
  dagId: stateDag.id,
  dagType: 'state',
  nodeCount: states.length,
  edgeCount: transitions.length,
  totalPaths: allPaths.length,
  criticalPaths: allPaths.filter(p => p.length >= 7).slice(0, 5),
  paths: allPaths,
  avgPathLength: allPaths.reduce((sum, p) => sum + p.length, 0) / allPaths.length,
  maxPathLength: Math.max(...allPaths.map(p => p.length)),
  minPathLength: Math.min(...allPaths.map(p => p.length)),
};

// Write to both locations
const pathsDir1 = path.resolve(__dirname, '../../../../../dag-data/paths');
const pathsDir2 = path.resolve(__dirname, '../../data');

fs.mkdirSync(pathsDir1, { recursive: true });

fs.writeFileSync(
  path.join(pathsDir1, 'state-paths.json'),
  JSON.stringify(outputPath, null, 2),
);

console.log(`Generated ${allPaths.length} paths for State DAG`);
console.log(`  States: ${states.length}, Transitions: ${transitions.length}`);
console.log(`  Avg path length: ${outputPath.avgPathLength.toFixed(2)}`);
console.log(`  Max path length: ${outputPath.maxPathLength}`);
console.log(`  Min path length: ${outputPath.minPathLength}`);
console.log(`Written to: ${pathsDir1}/state-paths.json`);
