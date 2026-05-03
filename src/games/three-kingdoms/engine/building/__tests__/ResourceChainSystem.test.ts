/**
 * BLD-F28 ResourceChainSystem 单元测试
 *
 * 覆盖：
 * - 6 条链路定义完整性
 * - F28-01 链路验证（farmland→barracks 畅通 / 不通）
 * - 瓶颈检测（barracks Lv1 但 farmland Lv10 → 粮草过剩）
 * - 吞吐量计算
 * - 全链路验证
 * - 序列化 / 反序列化
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ResourceChainSystem,
  type ResourceChain,
} from '../ResourceChainSystem';
import type { BuildingSystem } from '../BuildingSystem';

// ── Mock BuildingSystem ──

function createMockBuildingSystem(
  levels: Partial<Record<string, number>> = {},
  productions: Partial<Record<string, number>> = {},
): BuildingSystem {
  return {
    getLevel: vi.fn((type: string) => levels[type] ?? 0),
    getProduction: vi.fn((type: string, _level?: number) => productions[type] ?? 0),
  } as unknown as BuildingSystem;
}

// ─────────────────────────────────────────────

describe('ResourceChainSystem', () => {
  let system: ResourceChainSystem;

  beforeEach(() => {
    system = new ResourceChainSystem();
  });

  // ─────────────────────────────────────────
  // 1. 6 条链路定义完整性
  // ─────────────────────────────────────────

  describe('getChainDefinitions', () => {
    it('应包含 6 条链路', () => {
      const chains = system.getChainDefinitions();
      expect(chains).toHaveLength(6);
    });

    it('每条链路应有正确的 ID（F28-01 ~ F28-06）', () => {
      const chains = system.getChainDefinitions();
      const ids = chains.map(c => c.id).sort();
      expect(ids).toEqual(['F28-01', 'F28-02', 'F28-03', 'F28-04', 'F28-05', 'F28-06']);
    });

    it('每条链路应包含至少 1 个节点', () => {
      const chains = system.getChainDefinitions();
      for (const chain of chains) {
        expect(chain.nodes.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('F28-01 应为 粮草→兵力→战斗链', () => {
      const chain = system.getChain('F28-01');
      expect(chain).toBeDefined();
      expect(chain!.name).toContain('粮草');
      expect(chain!.nodes.map(n => n.buildingType)).toEqual(['farmland', 'barracks']);
    });

    it('F28-02 应为 矿石+木材→装备→英雄链', () => {
      const chain = system.getChain('F28-02');
      expect(chain).toBeDefined();
      expect(chain!.nodes.map(n => n.buildingType)).toEqual(['mine', 'lumberMill', 'workshop']);
    });

    it('F28-03 应为 铜钱→贸易→折扣链', () => {
      const chain = system.getChain('F28-03');
      expect(chain).toBeDefined();
      expect(chain!.nodes.map(n => n.buildingType)).toEqual(['market', 'port']);
    });

    it('F28-04 应为 科技点→科技→加成链', () => {
      const chain = system.getChain('F28-04');
      expect(chain).toBeDefined();
      expect(chain!.nodes[0].buildingType).toBe('academy');
      expect(chain!.nodes[0].resourceOut).toContain('techPoint');
    });

    it('F28-05 应为 铜钱+粮草→招募→英雄链', () => {
      const chain = system.getChain('F28-05');
      expect(chain).toBeDefined();
      expect(chain!.nodes.map(n => n.buildingType)).toEqual(['farmland', 'market', 'tavern']);
    });

    it('F28-06 应为 矿石+木材→城防链', () => {
      const chain = system.getChain('F28-06');
      expect(chain).toBeDefined();
      expect(chain!.nodes.map(n => n.buildingType)).toEqual(['mine', 'lumberMill', 'wall']);
    });
  });

  // ─────────────────────────────────────────
  // 2. F28-01 链路验证
  // ─────────────────────────────────────────

  describe('validateChain — F28-01', () => {
    it('无建筑系统时链路不通', () => {
      const result = system.validateChain('F28-01');
      expect(result.valid).toBe(false);
      expect(result.bottlenecks.length).toBeGreaterThan(0);
    });

    it('farmland Lv5, barracks Lv3 → 链路畅通', () => {
      const bs = createMockBuildingSystem(
        { farmland: 5, barracks: 3 },
        { farmland: 8, barracks: 4 },
      );
      system.setBuildingSystem(bs);

      const result = system.validateChain('F28-01');
      expect(result.valid).toBe(true);
      expect(result.bottlenecks).toHaveLength(0);
      expect(result.throughput).toBeGreaterThan(0);
    });

    it('farmland Lv0（未建造）→ 链路不通', () => {
      const bs = createMockBuildingSystem(
        { farmland: 0, barracks: 3 },
        { farmland: 0, barracks: 4 },
      );
      system.setBuildingSystem(bs);

      const result = system.validateChain('F28-01');
      expect(result.valid).toBe(false);
      expect(result.bottlenecks).toContain('farmland 未建造');
    });

    it('barracks Lv0（未建造）→ 链路不通', () => {
      const bs = createMockBuildingSystem(
        { farmland: 5, barracks: 0 },
        { farmland: 8, barracks: 0 },
      );
      system.setBuildingSystem(bs);

      const result = system.validateChain('F28-01');
      expect(result.valid).toBe(false);
      expect(result.bottlenecks).toContain('barracks 未建造');
    });

    it('不存在的链路 ID → 返回无效', () => {
      const result = system.validateChain('F28-99');
      expect(result.valid).toBe(false);
      expect(result.bottlenecks[0]).toContain('不存在');
    });
  });

  // ─────────────────────────────────────────
  // 3. 瓶颈检测
  // ─────────────────────────────────────────

  describe('detectBottlenecks', () => {
    it('barracks Lv1 但 farmland Lv10 → 粮草过剩', () => {
      const bs = createMockBuildingSystem(
        { farmland: 10, barracks: 1 },
        { farmland: 20, barracks: 2 },
      );
      system.setBuildingSystem(bs);

      const bottlenecks = system.detectBottlenecks();
      const f01 = bottlenecks.filter(b => b.chainId === 'F28-01');
      expect(f01.length).toBeGreaterThan(0);
      expect(f01.some(b => b.bottleneck.includes('farmland') && b.bottleneck.includes('barracks'))).toBe(true);
    });

    it('所有建筑 Lv0 → 链路完全未启动', () => {
      const bs = createMockBuildingSystem({}, {});
      system.setBuildingSystem(bs);

      const bottlenecks = system.detectBottlenecks();
      expect(bottlenecks.some(b => b.bottleneck.includes('完全未启动'))).toBe(true);
    });

    it('均衡发展 → 无严重瓶颈', () => {
      const bs = createMockBuildingSystem(
        { farmland: 5, market: 5, mine: 5, lumberMill: 5, barracks: 5, workshop: 5, academy: 5, wall: 5, tavern: 5, port: 5 },
        { farmland: 10, market: 10, mine: 10, lumberMill: 10, barracks: 8, workshop: 8, academy: 6, wall: 8, tavern: 6, port: 8 },
      );
      system.setBuildingSystem(bs);

      const bottlenecks = system.detectBottlenecks();
      expect(bottlenecks.every(b => !b.bottleneck.includes('完全未启动'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // 4. 吞吐量计算
  // ─────────────────────────────────────────

  describe('calculateThroughput', () => {
    it('无建筑系统 → 吞吐量为 0', () => {
      expect(system.calculateThroughput('F28-01')).toBe(0);
    });

    it('F28-01 吞吐量取瓶颈节点值', () => {
      const bs = createMockBuildingSystem(
        { farmland: 10, barracks: 3 },
        { farmland: 20, barracks: 5 },
      );
      system.setBuildingSystem(bs);

      const throughput = system.calculateThroughput('F28-01');
      expect(throughput).toBeGreaterThan(0);
      expect(throughput).toBeLessThanOrEqual(20);
    });

    it('F28-04 单节点链路吞吐量 = academy 产出', () => {
      const bs = createMockBuildingSystem(
        { academy: 5 },
        { academy: 3 },
      );
      system.setBuildingSystem(bs);

      expect(system.calculateThroughput('F28-04')).toBe(3);
    });
  });

  // ─────────────────────────────────────────
  // 5. 全链路验证
  // ─────────────────────────────────────────

  describe('validateAllChains', () => {
    it('应返回 6 条链路的验证结果', () => {
      const results = system.validateAllChains();
      const keys = Object.keys(results).sort();
      expect(keys).toEqual(['F28-01', 'F28-02', 'F28-03', 'F28-04', 'F28-05', 'F28-06']);
    });

    it('全部建筑已建造且均衡 → 全部链路有效', () => {
      const bs = createMockBuildingSystem(
        { farmland: 5, market: 5, mine: 5, lumberMill: 5, barracks: 5, workshop: 5, academy: 5, wall: 5, tavern: 5, port: 5 },
        { farmland: 10, market: 10, mine: 10, lumberMill: 10, barracks: 8, workshop: 8, academy: 6, wall: 8, tavern: 6, port: 8 },
      );
      system.setBuildingSystem(bs);

      const results = system.validateAllChains();
      for (const [id, result] of Object.entries(results)) {
        expect(result.valid, `链路 ${id} 应有效`).toBe(true);
      }
    });
  });

  // ─────────────────────────────────────────
  // 6. 序列化 / 反序列化
  // ─────────────────────────────────────────

  describe('serialize / deserialize', () => {
    it('序列化后可反序列化', () => {
      const json = system.serialize();
      expect(() => JSON.parse(json)).not.toThrow();

      const system2 = new ResourceChainSystem();
      system2.deserialize(json);
      expect(system2.getChainDefinitions()).toHaveLength(6);
    });

    it('反序列化无效 JSON 不崩溃', () => {
      expect(() => system.deserialize('not-json')).not.toThrow();
    });

    it('序列化包含所有链路 ID', () => {
      const json = system.serialize();
      const parsed = JSON.parse(json);
      expect(Object.keys(parsed).sort()).toEqual(
        ['F28-01', 'F28-02', 'F28-03', 'F28-04', 'F28-05', 'F28-06'],
      );
    });
  });

  // ─────────────────────────────────────────
  // 7. reset
  // ─────────────────────────────────────────

  describe('reset', () => {
    it('重置后链路定义仍完整', () => {
      system.reset();
      expect(system.getChainDefinitions()).toHaveLength(6);
    });
  });

  // ─────────────────────────────────────────
  // 8. setResourceSystem（预留）
  // ─────────────────────────────────────────

  describe('setResourceSystem', () => {
    it('注入资源系统不崩溃', () => {
      expect(() => system.setResourceSystem({ foo: 'bar' })).not.toThrow();
    });
  });
});
