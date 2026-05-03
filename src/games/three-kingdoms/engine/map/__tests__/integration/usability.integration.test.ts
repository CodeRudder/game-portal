/**
 * 可用性集成测试
 *
 * 测试用户引导→操作反馈→错误提示→帮助文档全流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';

describe('可用性集成测试', () => {
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

  describe('操作反馈', () => {
    it('应该返回明确的错误码', () => {
      const result = system.createForce({ heroId: '', troops: 1000 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBeDefined();
      expect(result.errorMessage).toBeDefined();
    });

    it('应该返回明确的成功信息', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 1000 });
      expect(result.valid).toBe(true);
      expect(result.forceId).toBeDefined();
    });
  });

  describe('错误提示', () => {
    it('应该提供有意义的错误消息', () => {
      const result = system.createForce({ heroId: '', troops: 1000 });
      expect(result.errorMessage).toBe('必须选择一个将领');
    });

    it('应该提供兵力不足的错误消息', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 50 });
      expect(result.errorMessage).toContain('最少需要');
    });
  });

  describe('状态查询', () => {
    it('应该提供编队列表', () => {
      system.createForce({ heroId: 'hero-1', troops: 1000 });
      system.createForce({ heroId: 'hero-2', troops: 1500 });

      const forces = system.getAllForces();
      expect(forces.length).toBe(2);
    });

    it('应该提供可用编队列表', () => {
      system.createForce({ heroId: 'hero-1', troops: 1000 });
      system.createForce({ heroId: 'hero-2', troops: 1500 });

      const readyForces = system.getReadyForces();
      expect(readyForces.length).toBe(2);

      // 设置一个为非ready状态
      system.setForceStatus(readyForces[0].id, 'marching');

      const readyForcesAfter = system.getReadyForces();
      expect(readyForcesAfter.length).toBe(1);
    });
  });
});
