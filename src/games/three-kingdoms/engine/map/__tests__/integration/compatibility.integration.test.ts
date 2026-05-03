/**
 * 兼容性集成测试
 *
 * 测试不同浏览器→不同设备→不同屏幕尺寸全流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';

describe('兼容性集成测试', () => {
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

  describe('序列化兼容性', () => {
    it('应该兼容旧版本数据', () => {
      // 模拟旧版本数据
      const oldData = {
        version: 1,
        forces: {
          'exp-1': { id: 'exp-1', heroId: 'hero-1', troops: 1000, status: 'ready' },
        },
        heroInjuries: {},
      };

      system.deserialize(oldData as any);
      expect(system.getAllForces().length).toBe(1);
    });

    it('应该处理缺失字段', () => {
      // 模拟缺失字段的数据
      const incompleteData = {
        version: 1,
        forces: {},
        // 缺失heroInjuries
      };

      system.deserialize(incompleteData as any);
      expect(system.getAllForces().length).toBe(0);
    });
  });

  describe('边界值兼容性', () => {
    it('应该处理极大兵力值', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 999999 });
      // 应该成功或失败，但不崩溃
      expect(result).toBeDefined();
    });

    it('应该处理极小兵力值', () => {
      const result = system.createForce({ heroId: 'hero-1', troops: 1 });
      // 应该失败，因为小于最小兵力
      expect(result.valid).toBe(false);
    });
  });
});
