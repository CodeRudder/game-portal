/**
 * 错误处理集成测试
 *
 * 测试依赖缺失→数据异常→操作失败→恢复机制全流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import { SiegeSystem } from '../../SiegeSystem';

describe('错误处理集成测试', () => {
  describe('依赖缺失', () => {
    it('应该处理无ExpeditionDeps', () => {
      const system = new ExpeditionSystem();
      system.init({} as any);
      // 不设置ExpeditionDeps

      const result = system.createForce({ heroId: 'hero-1', troops: 1000 });
      expect(result.valid).toBe(true); // 应该仍然可以创建，只是无法校验兵力
    });

    it('应该处理无ExpeditionSystem时的攻城', () => {
      const siegeSystem = new SiegeSystem();
      siegeSystem.init({
        eventBus: { emit: vi.fn() },
        registry: {
          get: vi.fn(() => null), // 返回null
        },
        resource: {
          getAmount: vi.fn(() => 10000),
          consumeResource: vi.fn(),
        },
      } as any);

      const result = siegeSystem.executeSiegeWithExpedition(
        'force-1',
        'target-1',
        'player' as any,
        500,
      );

      expect(result.launched).toBe(false);
      expect(result.failureReason).toBe('出征系统未初始化');
    });
  });

  describe('数据异常', () => {
    it('应该处理不存在的编队', () => {
      const system = new ExpeditionSystem();
      system.init({} as any);

      const validation = system.validateForceForExpedition('non-existent');
      expect(validation.valid).toBe(false);
      expect(validation.errorCode).toBe('FORCE_NOT_FOUND');
    });

    it('应该处理不存在的将领', () => {
      const system = new ExpeditionSystem();
      system.init({} as any);
      system.setExpeditionDeps({
        getHero: vi.fn(() => undefined), // 返回undefined
        getAvailableTroops: vi.fn(() => 5000),
        consumeTroops: vi.fn((amount: number) => true),
        isHeroInFormation: vi.fn(() => true),
      });

      const result = system.createForce({ heroId: 'non-existent', troops: 1000 });
      // 应该仍然可以创建，因为当前实现不校验将领是否存在
      expect(result.valid).toBe(true);
    });
  });

  describe('操作失败', () => {
    it('应该处理编队状态错误', () => {
      const system = new ExpeditionSystem();
      system.init({} as any);
      system.setExpeditionDeps({
        getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
        getAvailableTroops: vi.fn(() => 5000),
        consumeTroops: vi.fn((amount: number) => true),
        isHeroInFormation: vi.fn(() => true),
      });

      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 1000 });

      // 设置为非ready状态
      system.setForceStatus(forceId!, 'marching');

      // 尝试解散
      const result = system.disbandForce(forceId!);
      expect(result).toBe(false);
    });

    it('应该处理重复解散', () => {
      const system = new ExpeditionSystem();
      system.init({} as any);
      system.setExpeditionDeps({
        getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
        getAvailableTroops: vi.fn(() => 5000),
        consumeTroops: vi.fn((amount: number) => true),
        isHeroInFormation: vi.fn(() => true),
      });

      const { forceId } = system.createForce({ heroId: 'hero-1', troops: 1000 });

      // 第一次解散
      const result1 = system.disbandForce(forceId!);
      expect(result1).toBe(true);

      // 第二次解散
      const result2 = system.disbandForce(forceId!);
      expect(result2).toBe(false);
    });
  });

  describe('恢复机制', () => {
    it('应该支持序列化恢复', () => {
      const system = new ExpeditionSystem();
      system.init({} as any);
      system.setExpeditionDeps({
        getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
        getAvailableTroops: vi.fn(() => 5000),
        consumeTroops: vi.fn((amount: number) => true),
        isHeroInFormation: vi.fn(() => true),
      });

      // 创建编队
      system.createForce({ heroId: 'hero-1', troops: 1000 });
      system.createForce({ heroId: 'hero-2', troops: 1500 });

      // 序列化
      const saved = system.serialize();

      // 重置
      system.reset();
      expect(system.getAllForces().length).toBe(0);

      // 恢复
      system.deserialize(saved);
      expect(system.getAllForces().length).toBe(2);
    });
  });
});
