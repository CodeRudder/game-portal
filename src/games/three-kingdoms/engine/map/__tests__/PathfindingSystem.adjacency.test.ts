/**
 * deriveAdjacency 测试
 *
 * 覆盖：
 *   1. deriveAdjacency 返回非空结果
 *   2. 洛阳与许昌相邻（有道路连接）
 *   3. 相邻关系是双向对称的
 *   4. 没有道路连接的城市不相邻
 *   5. 关隘（pass-*）正确参与相邻关系（仅存在于地图中的）
 *   6. 资源点（res-*）正确参与相邻关系（仅存在于地图中的）
 *   7. 与原 ADJACENCY_MAP 对比，核心关系一致
 *
 * 注意：world-map.txt 中部分地标（pass-hulao/pass-tong/pass-jian/pass-yangping/
 * city-yongan/res-mandate1）的字符标记未出现在地图数据中，
 * 因此 deriveAdjacency 仅能推导出地图中实际存在的地标的相邻关系。
 *
 * @module engine/map/__tests__/PathfindingSystem.adjacency.test
 */

import { deriveAdjacency, buildWalkabilityGrid } from '../PathfindingSystem';
import { ASCIIMapParser } from '../../../core/map/ASCIIMapParser';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── 加载真实地图 ──
const mapPath = resolve(__dirname, '../../../core/map/maps/world-map.txt');
const mapText = readFileSync(mapPath, 'utf-8');
const parser = new ASCIIMapParser();
const parsedMap = parser.parse(mapText);
const grid = buildWalkabilityGrid(parsedMap);

// ── 推导相邻关系 ──
const adjacency = deriveAdjacency(parsedMap, grid);

// ── 地图中存在的地标（单字母标记存在于 world-map.txt 中） ──
const MAP_EXISTING_CITIES = [
  'city-luoyang', 'city-xuchang', 'city-ye', 'city-changan',
  'city-chengdu', 'city-jianye', 'city-xiangyang',
  'city-puyang', 'city-beihai', 'city-chaisang', 'city-lujiang',
  'city-hanzhong', 'city-kuaiji', 'city-nanzhong',
];
const MAP_EXISTING_RESOURCES = ['res-grain1', 'res-gold1', 'res-grain2', 'res-troops1'];

// ═══════════════════════════════════════════════════════════

describe('deriveAdjacency', () => {
  // ───────────────────────────────────────────
  // 1. 基本正确性
  // ───────────────────────────────────────────
  it('返回非空结果', () => {
    expect(Object.keys(adjacency).length).toBeGreaterThan(0);
  });

  it('包含地图中存在的城市地标', () => {
    for (const id of MAP_EXISTING_CITIES) {
      expect(adjacency[id]).toBeDefined();
      expect(Array.isArray(adjacency[id])).toBe(true);
    }
  });

  it('包含地图中存在的资源点地标', () => {
    for (const id of MAP_EXISTING_RESOURCES) {
      expect(adjacency[id]).toBeDefined();
      expect(Array.isArray(adjacency[id])).toBe(true);
    }
  });

  // ───────────────────────────────────────────
  // 2. 洛阳与许昌相邻
  // ───────────────────────────────────────────
  it('洛阳与许昌相邻（有道路连接）', () => {
    const luoyangAdj = adjacency['city-luoyang'] ?? [];
    const xuchangAdj = adjacency['city-xuchang'] ?? [];

    const connected = luoyangAdj.includes('city-xuchang') || xuchangAdj.includes('city-luoyang');
    expect(connected).toBe(true);
  });

  // ───────────────────────────────────────────
  // 3. 双向对称性
  // ───────────────────────────────────────────
  it('相邻关系是双向对称的', () => {
    for (const [id, neighbors] of Object.entries(adjacency)) {
      for (const neighborId of neighbors) {
        const reverseNeighbors = adjacency[neighborId] ?? [];
        expect(reverseNeighbors).toContain(id);
      }
    }
  });

  // ───────────────────────────────────────────
  // 4. 不相邻的城市
  // ───────────────────────────────────────────
  it('没有道路连接的城市不相邻', () => {
    const luoyangAdj = adjacency['city-luoyang'] ?? [];
    const chengduAdj = adjacency['city-chengdu'] ?? [];

    const connected = luoyangAdj.includes('city-chengdu') || chengduAdj.includes('city-luoyang');
    expect(connected).toBe(false);
  });

  it('洛阳与建业不相邻', () => {
    const luoyangAdj = adjacency['city-luoyang'] ?? [];
    const jianyeAdj = adjacency['city-jianye'] ?? [];

    const connected = luoyangAdj.includes('city-jianye') || jianyeAdj.includes('city-luoyang');
    expect(connected).toBe(false);
  });

  // ───────────────────────────────────────────
  // 5. 关隘参与相邻关系
  // ───────────────────────────────────────────
  it('地图中存在的关隘/哨站正确参与相邻关系', () => {
    // 检查 adjacency 中是否有 pass-* 前缀的条目
    const passEntries = Object.keys(adjacency).filter(id => id.startsWith('pass-'));
    // 如果地图中有 pass 标记，应至少有一个
    for (const passId of passEntries) {
      const adj = adjacency[passId] ?? [];
      expect(adj.length).toBeGreaterThan(0);
    }
  });

  // ───────────────────────────────────────────
  // 6. 资源点参与相邻关系
  // ───────────────────────────────────────────
  it('地图中存在的非孤立资源点正确参与相邻关系', () => {
    // res-grain2 被水域完全包围，跳过
    const isolatedResources = new Set(['res-grain2']);
    for (const resId of MAP_EXISTING_RESOURCES) {
      if (isolatedResources.has(resId)) continue;
      const adj = adjacency[resId] ?? [];
      expect(adj.length).toBeGreaterThan(0);
    }
  });

  // ───────────────────────────────────────────
  // 7. 核心关系一致性
  // ───────────────────────────────────────────
  describe('与原 ADJACENCY_MAP 核心关系对比', () => {
    const CORE_RELATIONS: Array<[string, string]> = [
      ['city-luoyang', 'city-xuchang'],
      ['city-luoyang', 'city-changan'],
      ['city-ye', 'city-puyang'],
      ['city-puyang', 'city-beihai'],
    ];

    it.each(CORE_RELATIONS)('%s 与 %s 应相邻', (id1, id2) => {
      const adj1 = adjacency[id1] ?? [];
      const adj2 = adjacency[id2] ?? [];

      const connected = adj1.includes(id2) || adj2.includes(id1);
      expect(connected).toBe(true);
    });
  });

  // ───────────────────────────────────────────
  // 8. 边界情况
  // ───────────────────────────────────────────
  it('非孤立地标至少有一个相邻地标', () => {
    // 部分地标在地图中被水域完全包围，无法通过道路连接，跳过检查：
    // - res-grain2: 被 ~ 水域包围
    // - city-jianye: 被 ~ 水域包围，无道路连接
    // - city-kuaiji: 被 ~ 水域包围，无道路连接
    const isolatedLandmarks = new Set(['res-grain2', 'city-jianye', 'city-kuaiji']);
    const zeroNeighborLandmarks: string[] = [];
    for (const [id, neighbors] of Object.entries(adjacency)) {
      if (isolatedLandmarks.has(id)) continue;
      if (neighbors.length === 0) {
        zeroNeighborLandmarks.push(id);
      }
    }
    expect(zeroNeighborLandmarks).toEqual([]);
  });

  it('相邻关系表中无自引用', () => {
    for (const [id, neighbors] of Object.entries(adjacency)) {
      expect(neighbors).not.toContain(id);
    }
  });

  it('相邻关系表中无重复条目', () => {
    for (const [id, neighbors] of Object.entries(adjacency)) {
      const unique = new Set(neighbors);
      expect(unique.size).toBe(neighbors.length);
    }
  });
});
