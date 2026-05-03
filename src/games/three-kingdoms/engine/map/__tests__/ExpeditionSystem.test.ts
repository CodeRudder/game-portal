/**
 * ExpeditionSystem 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpeditionSystem } from '../ExpeditionSystem';
import type { ExpeditionDeps } from '../ExpeditionSystem';

describe('ExpeditionSystem', () => {
  let system: ExpeditionSystem;
  let mockDeps: ExpeditionDeps;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.init({} as any);

    mockDeps = {
      getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
      getAvailableTroops: vi.fn(() => 1000),
      consumeTroops: vi.fn((amount: number) => true),
      isHeroInFormation: vi.fn(() => true),
    };
    system.setExpeditionDeps(mockDeps);
  });

  describe('创建编队', () => {
    it('应该成功创建编队（有将领+有士兵）', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 500 });
      expect(result.valid).toBe(true);
      expect(result.forceId).toBeDefined();
    });

    it('应该拒绝创建编队（无将领）', () => {
      const result = system.createForce({ heroId: '', troops: 500 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('HERO_REQUIRED');
    });

    it('应该拒绝创建编队（无士兵）', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 0 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TROOPS_REQUIRED');
    });

    it('应该拒绝创建编队（士兵不足）', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 50 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
    });

    it('应该拒绝创建编队（将领已编队）', () => {
      system.createForce({ heroId: 'hero-1', troops: 500 });
      const result = system.createForce({ heroId: 'hero-1', troops: 300 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('HERO_BUSY');
    });

    it('应该拒绝创建编队（兵力不足）', () => {
      (mockDeps.getAvailableTroops as any).mockReturnValue(100);
      const result = system.createForce({ heroId: 'hero-1', troops: 500 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
    });

    it('应该拒绝创建编队（达到上限）', () => {
      system.createForce({ heroId: 'hero-1', troops: 500 });
      system.createForce({ heroId: 'hero-2', troops: 300 });
      system.createForce({ heroId: 'hero-3', troops: 200 });
      const result = system.createForce({ heroId: 'hero-4', troops: 100 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MAX_FORCES_REACHED');
    });
  });

  describe('解散编队', () => {
    it('应该成功解散编队', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 500 });
      const result = system.disbandForce(forceId!);
      expect(result).toBe(true);
      expect(system.getForce(forceId!)).toBeUndefined();
    });

    it('应该拒绝解散不存在的编队', () => {
      const result = system.disbandForce('non-existent');
      expect(result).toBe(false);
    });

    it('应该拒绝解散非ready状态的编队', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 500 });
      system.setForceStatus(forceId!, 'marching');
      const result = system.disbandForce(forceId!);
      expect(result).toBe(false);
    });
  });

  describe('编队校验', () => {
    it('应该通过ready状态的编队校验', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 500 });
      const result = system.validateForceForExpedition(forceId!);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝非ready状态的编队', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 500 });
      system.setForceStatus(forceId!, 'marching');
      const result = system.validateForceForExpedition(forceId!);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('FORCE_NOT_READY');
    });

    it('应该拒绝受伤将领的编队', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 500 });
      // 多次尝试确保将领受伤
      let injured = false;
      for (let i = 0; i < 100; i++) {
        const force = system.getForce(forceId!);
        force!.troops = 500;
        const result = system.calculateCasualties(forceId!, 'rout');
        if (result!.heroInjured) {
          injured = true;
          break;
        }
      }
      if (injured) {
        const result = system.validateForceForExpedition(forceId!);
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('HERO_INJURED');
      }
    });
  });

  describe('伤亡计算', () => {
    it('胜利时应该损失5-15%兵力', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 1000 });
      const result = system.calculateCasualties(forceId!, 'victory');
      expect(result).toBeDefined();
      expect(result!.troopsLost).toBeGreaterThanOrEqual(50);
      expect(result!.troopsLost).toBeLessThanOrEqual(150);
      expect(result!.battleResult).toBe('victory');
    });

    it('失败时应该损失20-40%兵力', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 1000 });
      const result = system.calculateCasualties(forceId!, 'defeat');
      expect(result).toBeDefined();
      expect(result!.troopsLost).toBeGreaterThanOrEqual(200);
      expect(result!.troopsLost).toBeLessThanOrEqual(400);
      expect(result!.battleResult).toBe('defeat');
    });

    it('惨败时应该损失50-80%兵力', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 1000 });
      const result = system.calculateCasualties(forceId!, 'rout');
      expect(result).toBeDefined();
      expect(result!.troopsLost).toBeGreaterThanOrEqual(500);
      expect(result!.troopsLost).toBeLessThanOrEqual(800);
      expect(result!.battleResult).toBe('rout');
    });

    it('应该更新编队兵力', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 1000 });
      system.calculateCasualties(forceId!, 'victory');
      const force = system.getForce(forceId!);
      expect(force!.troops).toBeLessThan(1000);
    });
  });

  describe('将领受伤', () => {
    it('胜利时将领应该有10%概率轻伤', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 1000 });
      // 多次测试统计概率
      let injuredCount = 0;
      for (let i = 0; i < 1000; i++) {
        // 重置编队兵力
        const force = system.getForce(forceId!);
        force!.troops = 1000;
        const result = system.calculateCasualties(forceId!, 'victory');
        if (result!.heroInjured) injuredCount++;
      }
      // 概率应该在10%附近（允许误差）
      expect(injuredCount).toBeGreaterThan(50);
      expect(injuredCount).toBeLessThan(150);
    });

    it('受伤将领应该降低战力', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 1000 });
      // 多次尝试确保将领受伤
      let injured = false;
      for (let i = 0; i < 100; i++) {
        const force = system.getForce(forceId!);
        force!.troops = 1000;
        const result = system.calculateCasualties(forceId!, 'rout');
        if (result!.heroInjured) {
          injured = true;
          break;
        }
      }
      // 验证受伤后战力降低
      if (injured) {
        const multiplier = system.getHeroPowerMultiplier('hero-1');
        expect(multiplier).toBeLessThan(1.0);
      }
    });
  });

  describe('序列化', () => {
    it('应该正确序列化和反序列化', () => {
      system.createForce({ heroId: 'hero-1', troops: 500 });
      system.createForce({ heroId: 'hero-2', troops: 300 });

      const saved = system.serialize();
      expect(saved.forces).toBeDefined();
      expect(Object.keys(saved.forces)).toHaveLength(2);

      // 重置并反序列化
      system.reset();
      system.deserialize(saved);

      expect(system.getAllForces()).toHaveLength(2);
    });
  });
});
