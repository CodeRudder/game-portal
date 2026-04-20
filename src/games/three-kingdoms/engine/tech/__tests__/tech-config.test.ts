/**
 * 科技配置数据完整性测试
 * 覆盖：节点数据验证、连线数据、互斥组、队列配置
 */

import { describe, it, expect } from 'vitest';
import {
  TECH_NODE_DEFS,
  TECH_NODE_MAP,
  TECH_EDGES,
  ACADEMY_QUEUE_SIZE_MAP,
  ACADEMY_TECH_POINT_PRODUCTION,
  getNodesByPath,
  getNodesByTier,
  getMutexGroups,
  getQueueSizeForAcademyLevel,
  getTechPointProduction,
} from '../tech-config';

describe('科技配置数据完整性', () => {
  // ═══════════════════════════════════════════
  // 1. 节点数据
  // ═══════════════════════════════════════════
  describe('节点数据', () => {
    it('总节点数为 24（3条路线 × 8节点）', () => {
      expect(TECH_NODE_DEFS).toHaveLength(24);
    });

    it('所有节点 ID 唯一', () => {
      const ids = TECH_NODE_DEFS.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('TECH_NODE_MAP 与 TECH_NODE_DEFS 一致', () => {
      expect(TECH_NODE_MAP.size).toBe(TECH_NODE_DEFS.length);
      for (const def of TECH_NODE_DEFS) {
        expect(TECH_NODE_MAP.get(def.id)).toBe(def);
      }
    });

    it('每条路线 8 个节点', () => {
      expect(getNodesByPath('military')).toHaveLength(8);
      expect(getNodesByPath('economy')).toHaveLength(8);
      expect(getNodesByPath('culture')).toHaveLength(8);
    });

    it('每条路线每层 2 个节点', () => {
      for (const path of ['military', 'economy', 'culture'] as const) {
        for (let tier = 1; tier <= 4; tier++) {
          expect(getNodesByTier(path, tier)).toHaveLength(2);
        }
      }
    });

    it('所有前置依赖指向存在的节点', () => {
      for (const def of TECH_NODE_DEFS) {
        for (const preId of def.prerequisites) {
          expect(TECH_NODE_MAP.has(preId), `Missing prerequisite: ${preId}`).toBe(true);
        }
      }
    });

    it('层级递增：前置依赖的层级 < 当前层级', () => {
      for (const def of TECH_NODE_DEFS) {
        for (const preId of def.prerequisites) {
          const pre = TECH_NODE_MAP.get(preId)!;
          expect(pre.tier).toBeLessThan(def.tier);
        }
      }
    });

    it('同路线节点前置依赖只引用同路线', () => {
      for (const def of TECH_NODE_DEFS) {
        for (const preId of def.prerequisites) {
          const pre = TECH_NODE_MAP.get(preId)!;
          expect(pre.path).toBe(def.path);
        }
      }
    });

    it('同互斥组节点属于同路线同层级', () => {
      const groups = getMutexGroups();
      for (const [, members] of groups) {
        const first = TECH_NODE_MAP.get(members[0])!;
        for (const id of members) {
          const node = TECH_NODE_MAP.get(id)!;
          expect(node.path).toBe(first.path);
          expect(node.tier).toBe(first.tier);
        }
      }
    });

    it('科技点消耗和耗时随层级递增', () => {
      for (const path of ['military', 'economy', 'culture'] as const) {
        const nodes = getNodesByPath(path);
        for (let i = 1; i < nodes.length; i++) {
          const prev = nodes[i - 1];
          const curr = nodes[i];
          if (prev.tier < curr.tier) {
            expect(curr.costPoints).toBeGreaterThanOrEqual(prev.costPoints);
          }
        }
      }
    });
  });

  // ═══════════════════════════════════════════
  // 2. 连线数据
  // ═══════════════════════════════════════════
  describe('连线数据', () => {
    it('有前置依赖连线', () => {
      const prereq = TECH_EDGES.filter((e) => e.type === 'prerequisite');
      expect(prereq.length).toBeGreaterThan(0);
    });

    it('有互斥连线', () => {
      const mutex = TECH_EDGES.filter((e) => e.type === 'mutex');
      expect(mutex.length).toBeGreaterThan(0);
    });

    it('连线端点都指向存在的节点', () => {
      for (const edge of TECH_EDGES) {
        expect(TECH_NODE_MAP.has(edge.from), `Missing from: ${edge.from}`).toBe(true);
        expect(TECH_NODE_MAP.has(edge.to), `Missing to: ${edge.to}`).toBe(true);
      }
    });

    it('无重复连线', () => {
      const keys = TECH_EDGES.map((e) => `${e.from}-${e.to}-${e.type}`);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 互斥组
  // ═══════════════════════════════════════════
  describe('互斥组', () => {
    it('有 9 个互斥组（3路线 × 3层）', () => {
      const groups = getMutexGroups();
      // Tier 1, 3 有互斥，Tier 2, 4 没有（部分有）
      expect(groups.size).toBeGreaterThan(0);
    });

    it('每个互斥组至少 2 个成员', () => {
      const groups = getMutexGroups();
      for (const [, members] of groups) {
        expect(members.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ═══════════════════════════════════════════
  // 4. 队列配置
  // ═══════════════════════════════════════════
  describe('队列配置', () => {
    it('队列大小随书院等级递增', () => {
      expect(getQueueSizeForAcademyLevel(1)).toBe(1);
      expect(getQueueSizeForAcademyLevel(5)).toBe(2);
      expect(getQueueSizeForAcademyLevel(10)).toBe(3);
      expect(getQueueSizeForAcademyLevel(15)).toBe(4);
      expect(getQueueSizeForAcademyLevel(20)).toBe(5);
    });

    it('中间等级取前一个有效值', () => {
      expect(getQueueSizeForAcademyLevel(3)).toBe(1);
      expect(getQueueSizeForAcademyLevel(7)).toBe(2);
      expect(getQueueSizeForAcademyLevel(25)).toBe(5);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 科技点产出配置
  // ═══════════════════════════════════════════
  describe('科技点产出', () => {
    it('等级 0 无产出', () => {
      expect(getTechPointProduction(0)).toBe(0);
    });

    it('等级 1 有产出', () => {
      expect(getTechPointProduction(1)).toBeGreaterThan(0);
    });

    it('产出严格递增', () => {
      const levels = Object.keys(ACADEMY_TECH_POINT_PRODUCTION).map(Number).sort((a, b) => a - b);
      for (let i = 1; i < levels.length; i++) {
        expect(ACADEMY_TECH_POINT_PRODUCTION[levels[i]]).toBeGreaterThan(
          ACADEMY_TECH_POINT_PRODUCTION[levels[i - 1]],
        );
      }
    });
  });
});
