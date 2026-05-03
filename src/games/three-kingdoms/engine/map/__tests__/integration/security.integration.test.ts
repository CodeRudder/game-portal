/**
 * 安全性集成测试
 *
 * 测试输入验证→权限检查→数据保护→异常处理全流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';

describe('安全性集成测试', () => {
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

  describe('输入验证', () => {
    it('应该拒绝空将领ID', () => {
      const result = system.createForce({ heroId: '', troops: 1000 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('HERO_REQUIRED');
    });

    it('应该拒绝零兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 0 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TROOPS_REQUIRED');
    });

    it('应该拒绝负数兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: -100 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TROOPS_REQUIRED');
    });

    it('应该拒绝NaN兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: NaN });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TROOPS_REQUIRED');
    });

    it('应该拒绝Infinity兵力', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: Infinity });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
    });
  });

  describe('权限检查', () => {
    it('应该拒绝重复将领', () => {
      system.createForce({ heroId: 'hero-1', troops: 1000 });
      const result = system.createForce({ heroId: 'hero-1', troops: 500 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('HERO_BUSY');
    });

    it('应该拒绝超过最大编队数', () => {
      system.createForce({ heroId: 'hero-1', troops: 1000 });
      system.createForce({ heroId: 'hero-2', troops: 1000 });
      system.createForce({ heroId: 'hero-3', troops: 1000 });
      const result = system.createForce({ heroId: 'hero-4', troops: 1000 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MAX_FORCES_REACHED');
    });
  });

  describe('数据保护', () => {
    it('应该返回编队数据', () => {
      system.createForce({ heroId: 'hero-1', troops: 1000 });
      system.createForce({ heroId: 'hero-2', troops: 1500 });

      const forces = system.getAllForces();
      expect(forces.length).toBe(2);

      // 验证数据正确
      expect(forces[0].troops).toBe(1000);
      expect(forces[1].troops).toBe(1500);
    });
  });

  describe('异常处理', () => {
    it('应该处理不存在的编队', () => {
      const result = system.getForce('non-existent');
      expect(result).toBeUndefined();
    });

    it('应该处理不存在的将领受伤状态', () => {
      const injury = system.getHeroInjury('non-existent');
      expect(injury).toBe('none');
    });

    it('应该处理不存在的将领战力倍率', () => {
      const multiplier = system.getHeroPowerMultiplier('non-existent');
      expect(multiplier).toBe(1.0);
    });
  });
});
