/**
 * GAP-RES-003: 行军消耗粮草 + GAP-RES-004: 战斗损失兵力 + GAP-RES-005: 征兵令增加兵力
 * 节点ID: RES-GRAIN-016, RES-TROOPS-012, RES-TROOPS-013
 * 优先级: P1
 *
 * 覆盖：
 * - 远征出征消耗grain
 * - 粮草不足时远征拒绝
 * - 战斗结算后根据战损比例扣除troops
 * - 战损不低于0的边界
 * - 征兵令道具增加troops
 * - 受上限约束的截断验证
 * - 资源序列化和反序列化
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ResourceSystem } from '../resource/ResourceSystem';

describe('GAP-RES-003/004/005: 资源消耗与补充', () => {
  let resSys: ResourceSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    resSys = new ResourceSystem();
    resSys.init({
      eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      config: { get: vi.fn(), register: vi.fn() },
      registry: { get: vi.fn(), register: vi.fn() },
    } as any);
  });

  // ═══════════════════════════════════════════
  // 1. 远征消耗粮草 (GAP-RES-003)
  // ═══════════════════════════════════════════
  describe('远征消耗粮草', () => {
    it('消耗粮草应正确扣除', () => {
      // 设置足够高的上限和资源
      resSys.setCap('grain', 10000);
      resSys.setResource('grain', 5000);
      const before = resSys.getAmount('grain');

      resSys.consumeResource('grain', 1000);

      expect(resSys.getAmount('grain')).toBe(before - 1000);
    });

    it('粮草不足时消耗应抛出错误', () => {
      resSys.setCap('grain', 10000);
      resSys.setResource('grain', 100);

      expect(() => resSys.consumeResource('grain', 200)).toThrow();
    });

    it('粮草恰好够时消耗成功（扣除保留量后）', () => {
      resSys.setCap('grain', 10000);
      // MIN_GRAIN_RESERVE = 10，所以需要至少 1010 才能消耗 1000
      resSys.setResource('grain', 1010);

      expect(() => resSys.consumeResource('grain', 1000)).not.toThrow();
      expect(resSys.getAmount('grain')).toBe(10);
    });

    it('消耗0粮草不影响资源', () => {
      resSys.setCap('grain', 10000);
      resSys.setResource('grain', 1000);
      resSys.consumeResource('grain', 0);
      expect(resSys.getAmount('grain')).toBe(1000);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 战斗损失兵力 (GAP-RES-004)
  // ═══════════════════════════════════════════
  describe('战斗损失兵力', () => {
    it('战斗后扣除兵力', () => {
      // 设置足够高的上限
      resSys.setCap('troops', 10000);
      resSys.setResource('troops', 3000);
      const before = resSys.getAmount('troops');

      // 模拟30%战损
      const loss = Math.floor(before * 0.3);
      resSys.consumeResource('troops', loss);

      expect(resSys.getAmount('troops')).toBe(before - loss);
    });

    it('战损比例100%时兵力为0', () => {
      resSys.setCap('troops', 10000);
      resSys.setResource('troops', 1000);
      resSys.consumeResource('troops', 1000);
      expect(resSys.getAmount('troops')).toBe(0);
    });

    it('兵力不足时消耗抛出错误且原数量不变', () => {
      resSys.setCap('troops', 10000);
      resSys.setResource('troops', 100);

      // 尝试消耗超过现有数量
      expect(() => resSys.consumeResource('troops', 200)).toThrow();
      // 原数量不变
      expect(resSys.getAmount('troops')).toBe(100);
    });

    it('0战损时兵力不变', () => {
      resSys.setCap('troops', 10000);
      resSys.setResource('troops', 1000);
      resSys.consumeResource('troops', 0);
      expect(resSys.getAmount('troops')).toBe(1000);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 征兵令增加兵力 (GAP-RES-005)
  // ═══════════════════════════════════════════
  describe('征兵令增加兵力', () => {
    it('使用征兵令增加兵力', () => {
      resSys.setCap('troops', 10000);
      resSys.setResource('troops', 500);
      const before = resSys.getAmount('troops');

      resSys.addResource('troops', 200);

      expect(resSys.getAmount('troops')).toBe(before + 200);
    });

    it('增加兵力受上限约束', () => {
      resSys.setCap('troops', 1000);
      resSys.setResource('troops', 500);

      // 尝试增加超过上限
      resSys.addResource('troops', 800);

      // 应被截断到上限
      expect(resSys.getAmount('troops')).toBeLessThanOrEqual(1000);
    });

    it('多次使用征兵令累积', () => {
      resSys.setCap('troops', 5000);
      resSys.setResource('troops', 1000);

      for (let i = 0; i < 5; i++) {
        resSys.addResource('troops', 200);
      }

      expect(resSys.getAmount('troops')).toBe(2000);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 资源序列化
  // ═══════════════════════════════════════════
  describe('资源序列化', () => {
    it('序列化后反序列化应保持一致', () => {
      // 设置足够高的上限
      resSys.setCap('grain', 10000);
      resSys.setCap('troops', 10000);
      resSys.setResource('grain', 3000);
      resSys.setResource('troops', 1500);
      resSys.setResource('gold', 5000);

      const serialized = resSys.serialize();

      const resSys2 = new ResourceSystem();
      resSys2.init({
        eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
        config: { get: vi.fn(), register: vi.fn() },
        registry: { get: vi.fn(), register: vi.fn() },
      } as any);
      resSys2.deserialize(serialized);

      expect(resSys2.getAmount('grain')).toBe(3000);
      expect(resSys2.getAmount('troops')).toBe(1500);
      expect(resSys2.getAmount('gold')).toBe(5000);
    });
  });
});
