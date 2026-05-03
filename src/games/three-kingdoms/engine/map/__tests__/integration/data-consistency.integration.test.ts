/**
 * 数据一致性集成测试
 *
 * 测试地图数据→解析→渲染→交互全流程数据一致性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import { SiegeSystem } from '../../SiegeSystem';

describe('数据一致性集成测试', () => {
  let expeditionSystem: ExpeditionSystem;
  let siegeSystem: SiegeSystem;

  beforeEach(() => {
    expeditionSystem = new ExpeditionSystem();
    expeditionSystem.init({} as any);
    expeditionSystem.setExpeditionDeps({
      getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
      getAvailableTroops: vi.fn(() => 5000),
      consumeTroops: vi.fn((amount: number) => true),
      isHeroInFormation: vi.fn(() => true),
    });

    siegeSystem = new SiegeSystem();
    siegeSystem.init({
      eventBus: { emit: vi.fn() },
      registry: {
        get: vi.fn((name: string) => {
          if (name === 'territory') {
            return {
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
              captureTerritory: vi.fn(),
            };
          }
          if (name === 'expedition') {
            return expeditionSystem;
          }
          return null;
        }),
      },
      resource: {
        getAmount: vi.fn(() => 10000),
        consumeResource: vi.fn(),
      },
    } as any);
  });

  describe('编队数据一致性', () => {
    it('应该保持编队数据一致', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 2000 });

      // 验证数据
      const force = expeditionSystem.getForce(forceId!);
      expect(force!.heroId).toBe('hero-1');
      expect(force!.troops).toBe(2000);
      expect(force!.status).toBe('ready');

      // 序列化
      const saved = expeditionSystem.serialize();

      // 反序列化
      expeditionSystem.reset();
      expeditionSystem.deserialize(saved);

      // 验证数据一致
      const restoredForce = expeditionSystem.getForce(forceId!);
      expect(restoredForce!.heroId).toBe('hero-1');
      expect(restoredForce!.troops).toBe(2000);
      expect(restoredForce!.status).toBe('ready');
    });
  });

  describe('攻城数据一致性', () => {
    it('应该保持攻城数据一致', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 2000 });

      // 执行攻城
      const result = siegeSystem.executeSiegeWithExpedition(
        forceId!,
        'target-1',
        'player' as any,
        500,
      );

      // 验证数据
      expect(result.launched).toBe(true);
      expect(result.cost.troops).toBeGreaterThan(0);
      expect(result.casualties).toBeDefined();

      // 序列化
      const saved = siegeSystem.serialize();

      // 反序列化
      siegeSystem.reset();
      siegeSystem.deserialize(saved);

      // 验证数据一致
      expect(siegeSystem.getTotalSieges()).toBe(1);
    });
  });

  describe('伤亡数据一致性', () => {
    it('应该保持伤亡数据一致', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 2000 });

      // 计算伤亡
      const casualties = expeditionSystem.calculateCasualties(forceId!, 'victory');

      // 验证数据
      expect(casualties!.troopsLost).toBeGreaterThan(0);
      expect(casualties!.troopsLostPercent).toBeGreaterThanOrEqual(0.05);
      expect(casualties!.troopsLostPercent).toBeLessThanOrEqual(0.15);

      // 验证兵力减少
      const force = expeditionSystem.getForce(forceId!);
      expect(force!.troops).toBeLessThan(2000);
    });
  });
});
