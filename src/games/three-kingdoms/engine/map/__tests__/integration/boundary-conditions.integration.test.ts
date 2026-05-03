/**
 * 边界条件集成测试
 *
 * 测试空数据→单数据→最大值→负值→异常值全流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';

describe('边界条件集成测试', () => {
  let system: ExpeditionSystem;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.init({} as any);
    system.setExpeditionDeps({
      getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
      getAvailableTroops: vi.fn(() => 5000),
      consumeTroops: vi.fn((amount: number) => true),
      isHeroInFormation: vi.fn(() => true),
    });
  });

  describe('空数据', () => {
    it('应该处理空将领ID', () => {
      const result = system.createForce({ heroId: '', troops: 1000 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('HERO_REQUIRED');
    });

    it('应该处理零兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 0 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TROOPS_REQUIRED');
    });
  });

  describe('最小值', () => {
    it('应该接受最小兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 100 });
      expect(result.valid).toBe(true);
    });

    it('应该拒绝小于最小兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 99 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
    });
  });

  describe('最大值', () => {
    it('应该接受最大兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 5000 });
      expect(result.valid).toBe(true);
    });

    it('应该拒绝超过可用兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 5001 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
    });
  });

  describe('异常值', () => {
    it('应该处理负数兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: -100 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TROOPS_REQUIRED');
    });

    it('应该处理NaN兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: NaN });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TROOPS_REQUIRED');
    });

    it('应该处理Infinity兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: Infinity });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
    });
  });
});
