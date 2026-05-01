/**
 * P0 测试: 粮仓/兵营降级容量截断
 * 缺口ID: GAP-RES-001 + GAP-RES-002 | 节点ID: RES-GRAIN-008 + RES-TROOPS-003
 *
 * 验证点：
 * 1. 粮仓降级: grain=4500, cap从5000降至3500, grain截断至3500
 * 2. 兵营降级: troops=2500, cap从3000降至1200, troops截断至1200
 * 3. 截断差值不退还
 * 4. getCapWarning返回正确级别
 * 5. 所有有上限资源类型的降级截断统一工作
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceSystem } from '../ResourceSystem';

function createMockDeps() {
  return {
    eventBus: {
      on: vi.fn(), once: vi.fn(), emit: vi.fn(),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

describe('P0: 降级容量截断 (GAP-RES-001 + GAP-RES-002)', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    rs = new ResourceSystem();
    rs.init(createMockDeps());
  });

  describe('GAP-RES-001: 粮仓降级容量截断', () => {
    it('grain=4500, 粮仓Lv5→Lv3, cap从5000→3500, grain截断至3500', () => {
      // 先设置粮仓等级5 → cap=5000
      rs.setCap('grain', 5000);
      // 设置grain=4500（在5000上限内）
      rs.setResource('grain', 4500);
      expect(rs.getAmount('grain')).toBe(4500);

      // 降级到等级3 → cap=3500
      rs.setCap('grain', 3500);

      // grain应被截断至3500
      expect(rs.getAmount('grain')).toBe(3500);
      expect(rs.getCaps().grain).toBe(3500);
    });

    it('截断差值不退还（grain从4500降到3500，差值1000不退还）', () => {
      rs.setCap('grain', 5000);
      rs.setResource('grain', 4500);

      const goldBefore = rs.getAmount('gold');
      rs.setCap('grain', 3500);

      // gold不变（无退还）
      expect(rs.getAmount('gold')).toBe(goldBefore);
      // grain精确截断
      expect(rs.getAmount('grain')).toBe(3500);
    });

    it('降级后grain恰好在新上限时不变', () => {
      rs.setCap('grain', 5000);
      rs.setResource('grain', 3500);

      // 降级到cap=3500
      rs.setCap('grain', 3500);

      // grain=3500恰好等于新上限，不变
      expect(rs.getAmount('grain')).toBe(3500);
    });

    it('降级后grain低于新上限时不变', () => {
      rs.setCap('grain', 5000);
      rs.setResource('grain', 2000);

      rs.setCap('grain', 3500);

      // grain=2000 < 3500，不变
      expect(rs.getAmount('grain')).toBe(2000);
    });
  });

  describe('GAP-RES-002: 兵营降级容量截断', () => {
    it('troops=2500, 兵营Lv10→Lv5, cap从3000→1200, troops截断至1200', () => {
      // 设置兵营等级10 → cap=3000
      rs.setCap('troops', 3000);
      rs.setResource('troops', 2500);
      expect(rs.getAmount('troops')).toBe(2500);

      // 降级到等级5 → cap=1200
      rs.setCap('troops', 1200);

      // troops应被截断至1200
      expect(rs.getAmount('troops')).toBe(1200);
      expect(rs.getCaps().troops).toBe(1200);
    });

    it('截断差值不退还（troops从2500降到1200，差值1300不退还）', () => {
      rs.setCap('troops', 3000);
      rs.setResource('troops', 2500);

      const goldBefore = rs.getAmount('gold');
      rs.setCap('troops', 1200);

      expect(rs.getAmount('gold')).toBe(goldBefore);
      expect(rs.getAmount('troops')).toBe(1200);
    });

    it('降级后troops低于新上限时不变', () => {
      rs.setCap('troops', 3000);
      rs.setResource('troops', 800);

      rs.setCap('troops', 1200);

      expect(rs.getAmount('troops')).toBe(800);
    });
  });

  describe('enforceCaps统一验证', () => {
    it('同时降低grain和troops上限，两者都被截断', () => {
      rs.setCap('grain', 5000);
      rs.setCap('troops', 3000);
      rs.setResource('grain', 4500);
      rs.setResource('troops', 2500);

      // 降级grain上限
      rs.setCap('grain', 3500);
      expect(rs.getAmount('grain')).toBe(3500);
      expect(rs.getAmount('troops')).toBe(2500); // troops不受影响

      // 降级troops上限
      rs.setCap('troops', 1200);
      expect(rs.getAmount('troops')).toBe(1200);
      expect(rs.getAmount('grain')).toBe(3500); // grain不受影响
    });

    it('连续多次降级，每次都正确截断', () => {
      rs.setCap('grain', 5000);
      rs.setResource('grain', 4500);

      // 第一次降级 cap→3500
      rs.setCap('grain', 3500);
      expect(rs.getAmount('grain')).toBe(3500);

      // 第二次降级 cap→2000
      rs.setCap('grain', 2000);
      expect(rs.getAmount('grain')).toBe(2000);
    });
  });

  describe('截断后getCapWarning返回正确级别', () => {
    it('截断后资源等于上限，返回critical警告', () => {
      rs.setCap('grain', 5000);
      rs.setResource('grain', 4500);

      rs.setCap('grain', 3500);

      // grain=3500=cap，应返回critical级别警告
      const warning = rs.getCapWarning('grain');
      expect(warning).not.toBeNull();
      expect(warning!.level).toBe('full');
    });

    it('截断后getCapWarnings包含对应资源', () => {
      rs.setCap('grain', 5000);
      rs.setResource('grain', 4500);

      rs.setCap('grain', 3500);

      const warnings = rs.getCapWarnings();
      const grainWarning = warnings.find(w => w.resourceType === 'grain');
      expect(grainWarning).toBeDefined();
      expect(grainWarning!.level).toBe('full');
    });
  });

  describe('updateCaps降级截断', () => {
    it('updateCaps降低上限后enforceCaps自动执行', () => {
      // 先设置grain到高值
      rs.setCap('grain', 5000);
      rs.setResource('grain', 4500);
      rs.setCap('troops', 3000);
      rs.setResource('troops', 2500);

      // updateCaps会调用enforceCaps
      // granaryLevel=3 → cap=3500, barracksLevel=5 → cap=1200
      rs.updateCaps(3, 5);

      expect(rs.getAmount('grain')).toBe(3500);
      expect(rs.getAmount('troops')).toBe(1200);
    });
  });
});
