/**
 * 攻城策略系统集成测试
 *
 * 测试强攻/围困/内应策略的使用条件、效果、消耗
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SiegeSystem } from '../../SiegeSystem';
import type { SiegeStrategyType } from '../../../../core/map/siege-enhancer.types';

describe('攻城策略系统集成测试', () => {
  let system: SiegeSystem;

  beforeEach(() => {
    system = new SiegeSystem();
    system.init({
      eventBus: { emit: vi.fn() },
      registry: {
        get: vi.fn(() => ({
          getTerritoryById: (id: string) => ({
            id,
            name: `Territory ${id}`,
            level: 3,
            ownership: 'enemy',
            defenseValue: 1000,
            position: { x: 50, y: 30 },
            type: 'city',
          }),
          canAttackTerritory: () => true,
        })),
      },
      resource: {
        getAmount: vi.fn(() => 10000),
        consumeResource: vi.fn(),
      },
    } as any);
  });

  describe('策略配置', () => {
    it('应该获取策略配置', () => {
      const strategies = system.getAllStrategies();
      expect(strategies.length).toBeGreaterThan(0);
    });

    it('应该获取单个策略配置', () => {
      const config = system.getStrategyConfig('forceAttack');
      expect(config).toBeDefined();
      expect(config.name).toBeDefined();
    });
  });

  describe('策略消耗计算', () => {
    it('应该计算策略消耗', () => {
      const territory = {
        id: 'target-1',
        name: 'Target 1',
        level: 3,
        ownership: 'enemy',
        defenseValue: 1000,
        position: { x: 50, y: 30 },
        type: 'city',
      };

      const cost = system.calculateStrategySiegeCost(territory as any, 'forceAttack');
      expect(cost.troops).toBeGreaterThan(0);
      expect(cost.grain).toBeGreaterThan(0);
    });
  });

  describe('策略胜率计算', () => {
    it('应该计算策略胜率', () => {
      const winRate = system.computeStrategyWinRate(1000, 500, 'forceAttack');
      expect(winRate).toBeGreaterThanOrEqual(0.05);
      expect(winRate).toBeLessThanOrEqual(0.95);
    });
  });
});
