/**
 * R23-1: 资源产出公式边界条件覆盖
 *
 * 覆盖场景：
 * - 极端等级(0/1/99) 的产出计算
 * - 零加成
 * - 溢出场景
 * - lookupCap 边界
 * - calculateBonusMultiplier 边界
 */

import { describe, it, expect } from 'vitest';
import { ResourceSystem } from '../ResourceSystem';
import { lookupCap, calculateBonusMultiplier, zeroResources, cloneResources } from '../resource-calculator';
import { GRANARY_CAPACITY_TABLE, BARRACKS_CAPACITY_TABLE } from '../resource-config';
import type { Bonuses } from '../resource.types';
import { vi } from 'vitest';

function createMockDeps() {
  return {
    eventBus: { on: vi.fn(), once: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

describe('R23-1: 资源产出公式边界条件', () => {

  // ═══════════════════════════════════════════
  // lookupCap 极端等级
  // ═══════════════════════════════════════════
  describe('lookupCap 极端等级', () => {
    it('等级 0 返回最低等级容量', () => {
      const cap = lookupCap(0, 'granary');
      expect(cap).toBe(GRANARY_CAPACITY_TABLE[1]);
    });

    it('等级 1 返回 Lv1 容量', () => {
      const cap = lookupCap(1, 'granary');
      expect(cap).toBe(GRANARY_CAPACITY_TABLE[1]);
    });

    it('等级 99（超过最大定义等级）使用线性外推', () => {
      const cap = lookupCap(99, 'granary');
      expect(cap).toBeGreaterThan(GRANARY_CAPACITY_TABLE[30]);
      // 线性外推：30→200000，每级增量 = (200000-100000)/(30-25) = 20000
      // 99 级 = 200000 + (99-30)*20000 = 200000 + 1380000 = 1580000
      expect(cap).toBeGreaterThan(200000);
    });

    it('兵营等级 99 使用线性外推', () => {
      const cap = lookupCap(99, 'barracks');
      expect(cap).toBeGreaterThan(BARRACKS_CAPACITY_TABLE[30]);
    });

    it('负数等级返回最低等级容量', () => {
      const cap = lookupCap(-1, 'granary');
      expect(cap).toBe(GRANARY_CAPACITY_TABLE[1]);
    });

    it('等级 5（有精确配置）返回精确值', () => {
      const cap = lookupCap(5, 'granary');
      expect(cap).toBe(GRANARY_CAPACITY_TABLE[5]);
    });

    it('等级 7（无精确配置）使用向下取整', () => {
      const cap = lookupCap(7, 'granary');
      // 7 在 5 和 10 之间，应该返回 5 的值
      expect(cap).toBe(GRANARY_CAPACITY_TABLE[5]);
    });
  });

  // ═══════════════════════════════════════════
  // calculateBonusMultiplier 边界
  // ═══════════════════════════════════════════
  describe('calculateBonusMultiplier 边界', () => {
    it('无加成时返回 1.0', () => {
      expect(calculateBonusMultiplier()).toBe(1);
      expect(calculateBonusMultiplier(undefined)).toBe(1);
    });

    it('空对象加成返回 1.0', () => {
      expect(calculateBonusMultiplier({})).toBe(1);
    });

    it('零值加成返回 1.0', () => {
      const bonuses: Bonuses = { castle: 0, tech: 0 };
      expect(calculateBonusMultiplier(bonuses)).toBe(1);
    });

    it('单个加成正确计算', () => {
      const bonuses: Bonuses = { castle: 0.08 }; // 8%
      expect(calculateBonusMultiplier(bonuses)).toBeCloseTo(1.08, 5);
    });

    it('多个加成乘法叠加', () => {
      const bonuses: Bonuses = { castle: 0.1, tech: 0.2 }; // 10% * 20%
      expect(calculateBonusMultiplier(bonuses)).toBeCloseTo(1.1 * 1.2, 5);
    });

    it('负加成（惩罚）减少产出', () => {
      const bonuses: Bonuses = { castle: -0.5 }; // -50%
      expect(calculateBonusMultiplier(bonuses)).toBeCloseTo(0.5, 5);
    });

    it('极大加成不溢出', () => {
      const bonuses: Bonuses = { castle: 100 }; // 10000%
      expect(calculateBonusMultiplier(bonuses)).toBeCloseTo(101, 5);
      expect(isFinite(calculateBonusMultiplier(bonuses))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // tick 产出公式边界
  // ═══════════════════════════════════════════
  describe('tick 产出公式边界', () => {
    let rs: ResourceSystem;
    beforeEach(() => {
      rs = new ResourceSystem();
      rs.init(createMockDeps());
    });

    it('产出速率为 0 时 tick 不增加资源', () => {
      rs.recalculateProduction({}); // 全部重置为 0
      const before = rs.getAmount('grain');
      rs.tick(10000); // 10秒
      expect(rs.getAmount('grain')).toBe(before);
    });

    it('负 deltaMs 不减少资源', () => {
      const before = rs.getAmount('grain');
      rs.tick(-1000);
      // 负时间 → deltaSec = -1，rate * -1 < 0，但 addResource(amount<=0) 返回 0
      expect(rs.getAmount('grain')).toBe(before);
    });

    it('0 deltaMs 不增加资源', () => {
      const before = rs.getAmount('grain');
      rs.tick(0);
      expect(rs.getAmount('grain')).toBe(before);
    });

    it('极高产出速率 + 长时间 tick 受上限约束', () => {
      rs.setProductionRate('grain', 1000000); // 100万/秒
      rs.tick(3600000); // 1小时
      expect(rs.getAmount('grain')).toBeLessThanOrEqual(2000); // 初始上限
    });

    it('加成乘数正确应用到 tick 产出', () => {
      rs.setProductionRate('grain', 10);
      const before = rs.getAmount('grain');
      rs.tick(1000, { castle: 0.5 }); // +50% 加成
      const after = rs.getAmount('grain');
      expect(after - before).toBeCloseTo(10 * 1.5, 0);
    });
  });

  // ═══════════════════════════════════════════
  // 辅助函数边界
  // ═══════════════════════════════════════════
  describe('辅助函数边界', () => {
    it('zeroResources 返回全零对象', () => {
      const z = zeroResources();
      expect(z.grain).toBe(0);
      expect(z.gold).toBe(0);
      expect(z.troops).toBe(0);
      expect(z.mandate).toBe(0);
      expect(z.techPoint).toBe(0);
      expect(z.recruitToken).toBe(0);
      expect(z.skillBook).toBe(0);
    });

    it('cloneResources 深拷贝不共享引用', () => {
      const original = zeroResources();
      const cloned = cloneResources(original);
      cloned.grain = 999;
      expect(original.grain).toBe(0);
    });
  });
});
