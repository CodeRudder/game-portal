/**
 * P0 测试: 产出上限验证
 * 缺口ID: GAP-BUILD-001 | 节点ID: BUILD-TECH-015
 *
 * 验证点：
 * 1. 资源达到上限后产出停止
 * 2. resource:overflow 事件正确触发
 * 3. 资源数字不超过上限值
 * 4. 不同资源类型的上限独立工作
 * 5. 上限为null的资源（gold/mandate）不受限制
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceSystem } from '../ResourceSystem';
import { INITIAL_CAPS, INITIAL_RESOURCES } from '../resource-config';

function createMockDeps() {
  return {
    eventBus: {
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

describe('P0: 产出上限验证 (GAP-BUILD-001)', () => {
  let rs: ResourceSystem;
  let mockDeps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.restoreAllMocks();
    rs = new ResourceSystem();
    mockDeps = createMockDeps();
    rs.init(mockDeps);
  });

  describe('资源达到上限后产出停止', () => {
    it('grain达到上限后tick不再增加', () => {
      // 设置产出速率
      rs.setProductionRate('grain', 100);

      // 将grain设置到接近上限
      const cap = rs.getCaps().grain!;
      rs.setResource('grain', cap);

      // tick后grain不超过上限
      rs.tick(1000);
      expect(rs.getAmount('grain')).toBe(cap);
    });

    it('troops达到上限后tick不再增加', () => {
      rs.setProductionRate('troops', 50);

      const cap = rs.getCaps().troops!;
      rs.setResource('troops', cap);

      rs.tick(1000);
      expect(rs.getAmount('troops')).toBe(cap);
    });

    it('资源接近上限时tick只增加到上限值', () => {
      rs.setProductionRate('grain', 100);
      const cap = rs.getCaps().grain!;

      // 设置为上限-10
      rs.setResource('grain', cap - 10);

      // tick 1秒产出100，但只能增加10到上限
      rs.tick(1000);
      expect(rs.getAmount('grain')).toBe(cap);
    });

    it('多次tick资源始终不超过上限', () => {
      rs.setProductionRate('grain', 100);
      const cap = rs.getCaps().grain!;
      rs.setResource('grain', cap - 5);

      // 连续tick多次
      for (let i = 0; i < 10; i++) {
        rs.tick(1000);
        expect(rs.getAmount('grain')).toBeLessThanOrEqual(cap);
      }
      expect(rs.getAmount('grain')).toBe(cap);
    });
  });

  describe('resource:overflow 事件触发', () => {
    it('资源溢出时触发overflow事件', () => {
      rs.setProductionRate('grain', 100);
      const cap = rs.getCaps().grain!;
      rs.setResource('grain', cap - 5);

      rs.tick(1000);

      // 检查overflow事件被触发
      expect(mockDeps.eventBus.emit).toHaveBeenCalledWith('resource:overflow', expect.objectContaining({
        resourceType: 'grain',
        overflow: expect.any(Number),
        cap,
      }));
    });

    it('addResource溢出时触发overflow事件', () => {
      const cap = rs.getCaps().grain!;
      rs.setResource('grain', cap - 10);

      // 添加超过上限的资源
      const actual = rs.addResource('grain', 100);

      expect(actual).toBe(10); // 只增加了10
      expect(mockDeps.eventBus.emit).toHaveBeenCalledWith('resource:overflow', expect.objectContaining({
        resourceType: 'grain',
        requested: 100,
        actual: 10,
        overflow: 90,
        cap,
      }));
    });

    it('资源未溢出时不触发overflow事件', () => {
      rs.setProductionRate('grain', 10);
      // 初始grain=500, cap=2000, 产出10不会溢出
      rs.tick(1000);

      // 检查没有overflow事件
      const overflowCalls = mockDeps.eventBus.emit.mock.calls.filter(
        (call: unknown[]) => call[0] === 'resource:overflow'
      );
      expect(overflowCalls.length).toBe(0);
    });
  });

  describe('上限为null的资源不受限制', () => {
    it('mandate(上限null)可以无限增加', () => {
      rs.setProductionRate('mandate', 1000);

      // 连续tick多次
      for (let i = 0; i < 100; i++) {
        rs.tick(1000);
      }

      // mandate应该持续增长
      expect(rs.getAmount('mandate')).toBeGreaterThan(INITIAL_RESOURCES.mandate);
      expect(rs.getCaps().mandate).toBeNull();
    });

    it('techPoint(上限null)可以无限增加', () => {
      rs.setProductionRate('techPoint', 100);
      rs.tick(1000);
      expect(rs.getAmount('techPoint')).toBeGreaterThan(0);
      expect(rs.getCaps().mandate).toBeNull();
    });
  });

  describe('不同资源类型上限独立工作', () => {
    it('grain达到上限不影响troops产出', () => {
      rs.setProductionRate('grain', 100);
      rs.setProductionRate('troops', 50);

      // grain达到上限
      const grainCap = rs.getCaps().grain!;
      rs.setResource('grain', grainCap);

      const troopsBefore = rs.getAmount('troops');
      rs.tick(1000);

      // grain不再增加
      expect(rs.getAmount('grain')).toBe(grainCap);
      // troops正常增加
      expect(rs.getAmount('troops')).toBe(troopsBefore + 50);
    });

    it('setCap后资源立即被截断', () => {
      // 设置grain到1000
      rs.setResource('grain', 1000);

      // 设置上限为500
      rs.setCap('grain', 500);

      expect(rs.getAmount('grain')).toBe(500);
    });
  });
});
