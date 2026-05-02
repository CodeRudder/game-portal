/**
 * R22-1: 资源系统异常路径覆盖
 *
 * 覆盖场景：
 * - 资源溢出上限截断
 * - 负数保护（addResource/consumeResource 传入负数/0）
 * - 空值处理（NaN/undefined/null）
 * - 资源上限降低时的截断
 * - 粮草保护机制
 * - 批量消耗原子性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceSystem } from '../ResourceSystem';
import { INITIAL_CAPS, MIN_GRAIN_RESERVE, SAVE_VERSION } from '../resource-config';

function createMockDeps() {
  return {
    eventBus: { on: vi.fn(), once: vi.fn(), emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()), has: vi.fn(() => false), unregister: vi.fn() },
  };
}

describe('R22-1: 资源系统异常路径', () => {
  let rs: ResourceSystem;
  beforeEach(() => {
    vi.restoreAllMocks();
    rs = new ResourceSystem();
    rs.init(createMockDeps());
  });

  // ═══════════════════════════════════════════
  // 资源溢出上限截断
  // ═══════════════════════════════════════════
  describe('资源溢出上限截断', () => {
    it('addResource 超过 grain 上限时截断到上限', () => {
      const cap = INITIAL_CAPS.grain; // 2000
      rs.setResource('grain', cap - 100); // 1900
      const actual = rs.addResource('grain', 500);
      expect(rs.getAmount('grain')).toBe(cap);
      expect(actual).toBe(100); // 只增加了 100
    });

    it('addResource 超过 troops 上限时截断到上限', () => {
      const cap = INITIAL_CAPS.troops; // 500
      rs.setResource('troops', cap - 10);
      const actual = rs.addResource('troops', 100);
      expect(rs.getAmount('troops')).toBe(cap);
      expect(actual).toBe(10);
    });

    it('addResource 无上限资源(gold)不截断', () => {
      rs.addResource('gold', 999999);
      expect(rs.getAmount('gold')).toBe(300 + 999999); // 初始300 + 添加
    });

    it('addResource 溢出时发出 resource:overflow 事件', () => {
      const emitSpy = vi.fn();
      const deps = createMockDeps();
      deps.eventBus.emit = emitSpy;
      rs.init(deps);

      rs.setResource('grain', INITIAL_CAPS.grain - 10);
      rs.addResource('grain', 100);

      expect(emitSpy).toHaveBeenCalledWith('resource:overflow', expect.objectContaining({
        resourceType: 'grain',
        overflow: expect.any(Number),
      }));
    });

    it('tick 产出导致溢出时自动截断', () => {
      rs.setProductionRate('grain', 99999);
      rs.setResource('grain', INITIAL_CAPS.grain - 1);
      rs.tick(1000);
      expect(rs.getAmount('grain')).toBe(INITIAL_CAPS.grain);
    });
  });

  // ═══════════════════════════════════════════
  // 负数保护
  // ═══════════════════════════════════════════
  describe('负数保护', () => {
    it('addResource 传入 0 不增加资源', () => {
      const before = rs.getAmount('grain');
      const actual = rs.addResource('grain', 0);
      expect(rs.getAmount('grain')).toBe(before);
      expect(actual).toBe(0);
    });

    it('addResource 传入负数不增加资源', () => {
      const before = rs.getAmount('grain');
      const actual = rs.addResource('grain', -100);
      expect(rs.getAmount('grain')).toBe(before);
      expect(actual).toBe(0);
    });

    it('consumeResource 传入 0 不消耗资源', () => {
      const before = rs.getAmount('grain');
      const actual = rs.consumeResource('grain', 0);
      expect(rs.getAmount('grain')).toBe(before);
      expect(actual).toBe(0);
    });

    it('consumeResource 传入负数不消耗资源', () => {
      const before = rs.getAmount('grain');
      const actual = rs.consumeResource('grain', -50);
      expect(rs.getAmount('grain')).toBe(before);
      expect(actual).toBe(0);
    });

    it('consumeResource 资源不足时抛出错误', () => {
      expect(() => rs.consumeResource('gold', 999999)).toThrow(/资源不足/);
    });

    it('setResource 传入负数时设为 0', () => {
      rs.setResource('grain', -100);
      expect(rs.getAmount('grain')).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 空值处理 / NaN / undefined
  // ═══════════════════════════════════════════
  describe('空值和异常值处理', () => {
    it('deserialize NaN 资源值时修正为 0', () => {
      rs.deserialize({
        resources: { grain: NaN, gold: 300, troops: 50, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0 } as any,
        lastSaveTime: Date.now(),
        productionRates: rs.getProductionRates() as any,
        caps: rs.getCaps() as any,
        version: SAVE_VERSION,
      });
      expect(rs.getAmount('grain')).toBe(0);
    });

    it('deserialize undefined 资源值时修正为 0', () => {
      rs.deserialize({
        resources: { gold: 300, troops: 50, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0 } as any,
        lastSaveTime: Date.now(),
        productionRates: rs.getProductionRates() as any,
        caps: rs.getCaps() as any,
        version: SAVE_VERSION,
      });
      expect(rs.getAmount('grain')).toBe(0);
    });

    it('deserialize 负数资源值时修正为 0', () => {
      rs.deserialize({
        resources: { grain: -500, gold: 300, troops: 50, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0 } as any,
        lastSaveTime: Date.now(),
        productionRates: rs.getProductionRates() as any,
        caps: rs.getCaps() as any,
        version: SAVE_VERSION,
      });
      expect(rs.getAmount('grain')).toBe(0);
    });

    it('consumeResource 对 NaN 当前值抛出错误', () => {
      // 通过 deserialize 注入 NaN
      rs.deserialize({
        resources: { grain: NaN, gold: 300, troops: 50, mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0, ore: 0, wood: 0 } as any,
        lastSaveTime: Date.now(),
        productionRates: rs.getProductionRates() as any,
        caps: rs.getCaps() as any,
        version: SAVE_VERSION,
      });
      // NaN 已修正为 0，所以消耗应该抛出不足
      expect(() => rs.consumeResource('grain', 1)).toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 上限降低时截断
  // ═══════════════════════════════════════════
  describe('上限降低时截断', () => {
    it('setCap 降低上限时截断溢出资源', () => {
      rs.addResource('grain', 5000); // 超过初始上限
      rs.setCap('grain', 1000);
      expect(rs.getAmount('grain')).toBe(1000);
    });

    it('updateCaps 降低上限时截断溢出资源', () => {
      rs.addResource('grain', 5000);
      rs.updateCaps(1, 1); // 最低等级，上限最小
      expect(rs.getAmount('grain')).toBeLessThanOrEqual(INITIAL_CAPS.grain);
    });
  });

  // ═══════════════════════════════════════════
  // 粮草保护机制
  // ═══════════════════════════════════════════
  describe('粮草保护机制', () => {
    it('消耗粮草时保留最低储备量', () => {
      rs.setResource('grain', 50);
      rs.consumeResource('grain', 40);
      expect(rs.getAmount('grain')).toBe(MIN_GRAIN_RESERVE); // 保留 10
    });

    it('粮草不足（扣除保留量后）时抛出错误', () => {
      rs.setResource('grain', 15); // 15 - 10(保留) = 5 可用
      expect(() => rs.consumeResource('grain', 10)).toThrow(/粮草不足/);
    });

    it('canAfford 考虑粮草保留量', () => {
      rs.setResource('grain', 15);
      const result = rs.canAfford({ grain: 10 } as any);
      expect(result.canAfford).toBe(false); // 可用 = 15-10 = 5 < 10
    });
  });

  // ═══════════════════════════════════════════
  // 批量消耗原子性
  // ═══════════════════════════════════════════
  describe('批量消耗原子性', () => {
    it('批量消耗部分不足时全部失败', () => {
      // 提高上限避免截断
      rs.setCap('grain', 50000);
      rs.setResource('grain', 10000);
      rs.setResource('gold', 10); // gold 不足
      expect(() => rs.consumeBatch({ grain: 100, gold: 500 } as any)).toThrow(/资源不足/);
      // grain 不应被消耗
      expect(rs.getAmount('grain')).toBe(10000);
    });

    it('批量消耗全部充足时全部成功', () => {
      rs.setCap('grain', 50000);
      rs.setCap('troops', 50000);
      rs.addResource('gold', 1000);
      rs.setResource('grain', 10000);
      rs.setResource('troops', 1000);
      rs.consumeBatch({ grain: 100, gold: 50, troops: 10 } as any);
      expect(rs.getAmount('grain')).toBe(10000 - 100);
      expect(rs.getAmount('gold')).toBe(300 + 1000 - 50);
      expect(rs.getAmount('troops')).toBe(1000 - 10);
    });
  });
});
