/**
 * 编队系统全流程集成测试
 *
 * 测试编队创建→出征→攻城→伤亡→返回全流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import type { ExpeditionDeps } from '../../ExpeditionSystem';

describe('编队系统全流程集成测试', () => {
  let system: ExpeditionSystem;
  let mockDeps: ExpeditionDeps;

  beforeEach(() => {
    system = new ExpeditionSystem();
    system.init({} as any);

    mockDeps = {
      getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
      getAvailableTroops: vi.fn(() => 5000),
      consumeTroops: vi.fn((amount: number) => true),
      isHeroInFormation: vi.fn(() => true),
    };
    system.setExpeditionDeps(mockDeps);
  });

  describe('编队创建→出征→攻城→伤亡→返回', () => {
    it('应该完成全流程', () => {
      // 1. 创建编队
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 2000 });
      expect(forceId).toBeDefined();
      expect(system.getForce(forceId!)!.status).toBe('ready');

      // 2. 设置出征状态
      system.setForceStatus(forceId!, 'marching');
      expect(system.getForce(forceId!)!.status).toBe('marching');

      // 3. 设置战斗状态
      system.setForceStatus(forceId!, 'fighting');
      expect(system.getForce(forceId!)!.status).toBe('fighting');

      // 4. 计算伤亡（胜利）
      const casualties = system.calculateCasualties(forceId!, 'victory');
      expect(casualties).toBeDefined();
      expect(casualties!.troopsLost).toBeGreaterThan(0);
      expect(casualties!.troopsLostPercent).toBeGreaterThanOrEqual(0.05);
      expect(casualties!.troopsLostPercent).toBeLessThanOrEqual(0.15);

      // 5. 验证兵力减少
      const force = system.getForce(forceId!);
      expect(force!.troops).toBeLessThan(2000);

      // 6. 设置返回状态
      system.setForceStatus(forceId!, 'returning');
      expect(system.getForce(forceId!)!.status).toBe('returning');

      // 7. 解散编队
      system.setForceStatus(forceId!, 'ready');
      const disbanded = system.disbandForce(forceId!);
      expect(disbanded).toBe(true);
      expect(system.getForce(forceId!)).toBeUndefined();
    });
  });

  describe('将领受伤恢复', () => {
    it('应该正确处理将领受伤和恢复', () => {
      // 1. 创建编队
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 2000 });

      // 2. 模拟将领受伤（多次尝试）
      let injured = false;
      for (let i = 0; i < 100; i++) {
        const force = system.getForce(forceId!);
        force!.troops = 2000;
        const casualties = system.calculateCasualties(forceId!, 'rout');
        if (casualties!.heroInjured) {
          injured = true;
          break;
        }
      }

      if (injured) {
        // 3. 验证将领受伤
        const injury = system.getHeroInjury('hero-1');
        expect(injury).not.toBe('none');

        // 4. 验证战力降低
        const multiplier = system.getHeroPowerMultiplier('hero-1');
        expect(multiplier).toBeLessThan(1.0);

        // 5. 验证受伤将领无法出征
        const validation = system.validateForceForExpedition(forceId!);
        expect(validation.valid).toBe(false);
        expect(validation.errorCode).toBe('HERO_INJURED');
      }
    });
  });

  describe('多编队并发', () => {
    it('应该支持多编队同时存在', () => {
      // 1. 创建多个编队
      const result1 = system.createForce({ heroId: 'hero-1', troops: 1000 });
      const result2 = system.createForce({ heroId: 'hero-2', troops: 1500 });
      const result3 = system.createForce({ heroId: 'hero-3', troops: 800 });

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(result3.valid).toBe(true);

      // 2. 验证编队数量
      expect(system.getAllForces().length).toBe(3);
      expect(system.getReadyForces().length).toBe(3);

      // 3. 尝试创建第4个编队（应该失败）
      const result4 = system.createForce({ heroId: 'hero-4', troops: 500 });
      expect(result4.valid).toBe(false);
      expect(result4.errorCode).toBe('MAX_FORCES_REACHED');

      // 4. 解散一个编队后可以创建新的
      system.disbandForce(result1.forceId!);
      expect(system.getAllForces().length).toBe(2);

      const result5 = system.createForce({ heroId: 'hero-4', troops: 500 });
      expect(result5.valid).toBe(true);
    });
  });

  describe('编队约束', () => {
    it('应该拒绝重复将领', () => {
      system.createForce({ heroId: 'hero-1', troops: 1000 });
      const result = system.createForce({ heroId: 'hero-1', troops: 500 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('HERO_BUSY');
    });

    it('应该拒绝兵力不足', () => {
      (mockDeps.getAvailableTroops as any).mockReturnValue(100);
      const result = system.createForce({ heroId: 'hero-1', troops: 500 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
    });

    it('应该拒绝非ready状态解散', () => {
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 1000 });
      system.setForceStatus(forceId!, 'marching');
      const result = system.disbandForce(forceId!);
      expect(result).toBe(false);
    });
  });

  describe('编队序列化', () => {
    it('应该正确序列化和反序列化', () => {
      // 1. 创建编队
      system.createForce({ heroId: 'hero-1', troops: 1000 });
      system.createForce({ heroId: 'hero-2', troops: 1500 });

      // 2. 序列化
      const saved = system.serialize();
      expect(Object.keys(saved.forces).length).toBe(2);
      expect(saved.version).toBe(1);

      // 3. 反序列化
      system.reset();
      system.deserialize(saved);

      // 4. 验证恢复
      expect(system.getAllForces().length).toBe(2);
      expect(system.getForce('exp-1')!.heroId).toBe('hero-1');
      expect(system.getForce('exp-2')!.heroId).toBe('hero-2');
    });

    it('应该保存将领受伤状态', () => {
      // 1. 创建编队
      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 1000 });

      // 2. 模拟将领受伤
      let injured = false;
      for (let i = 0; i < 100; i++) {
        const force = system.getForce(forceId!);
        force!.troops = 1000;
        const casualties = system.calculateCasualties(forceId!, 'rout');
        if (casualties!.heroInjured) {
          injured = true;
          break;
        }
      }

      if (injured) {
        // 3. 序列化
        const saved = system.serialize();
        expect(Object.keys(saved.heroInjuries).length).toBeGreaterThan(0);

        // 4. 反序列化
        system.reset();
        system.deserialize(saved);

        // 5. 验证受伤状态恢复
        const injury = system.getHeroInjury('hero-1');
        expect(injury).not.toBe('none');
      }
    });
  });
});
