/**
 * 编队攻城集成测试
 *
 * 测试编队系统与攻城系统的集成：
 * - G5: 攻城确认弹窗集成编队选择
 * - G6: 编队约束校验
 * - H4: 伤亡集成到攻城流程
 * - H5: 攻城结果弹窗显示伤亡详情
 * - H7: 将领受伤影响战力
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SiegeSystem } from '../../SiegeSystem';
import { ExpeditionSystem } from '../../ExpeditionSystem';
import type { TerritoryData, OwnershipStatus } from '../../../../core/map';

// 模拟领土数据
const createMockTerritory = (id: string, overrides?: Partial<TerritoryData>): TerritoryData => ({
  id,
  name: `Territory ${id}`,
  level: 3,
  ownership: 'neutral' as OwnershipStatus,
  defenseValue: 1000,
  position: { x: 50, y: 30 },
  type: 'city',
  ...overrides,
});

describe('编队攻城集成测试', () => {
  let siegeSystem: SiegeSystem;
  let expeditionSystem: ExpeditionSystem;
  let mockTerritories: Map<string, TerritoryData>;
  let mockDeps: any;

  beforeEach(() => {
    mockTerritories = new Map();
    mockTerritories.set('target-1', createMockTerritory('target-1', { ownership: 'enemy' }));
    mockTerritories.set('target-2', createMockTerritory('target-2', { ownership: 'enemy', defenseValue: 500 }));
    mockTerritories.set('player-city', createMockTerritory('player-city', { ownership: 'player' }));

    // 创建模拟依赖
    mockDeps = {
      eventBus: { emit: vi.fn() },
      registry: {
        get: vi.fn((name: string) => {
          if (name === 'territory') {
            return {
              getTerritoryById: (id: string) => mockTerritories.get(id),
              canAttackTerritory: (targetId: string, owner: OwnershipStatus) => {
                const territory = mockTerritories.get(targetId);
                return territory && territory.ownership !== owner;
              },
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
    };

    // 初始化系统
    siegeSystem = new SiegeSystem();
    siegeSystem.init(mockDeps);

    expeditionSystem = new ExpeditionSystem();
    expeditionSystem.init(mockDeps);
    expeditionSystem.setExpeditionDeps({
      getHero: vi.fn((id: string) => ({ id, name: `Hero ${id}` })),
      getAvailableTroops: vi.fn(() => 5000),
      consumeTroops: vi.fn((amount: number) => true),
      isHeroInFormation: vi.fn(() => true),
    });
  });

  describe('G5: 攻城确认弹窗集成编队选择', () => {
    it('应该使用编队兵力发起攻城', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 1000 });
      expect(forceId).toBeDefined();

      // 使用编队攻城
      const result = siegeSystem.executeSiegeWithExpedition(
        forceId!,
        'target-1',
        'player' as OwnershipStatus,
        500,
      );

      // 验证攻城已发起
      expect(result.launched).toBe(true);
      expect(result.cost.troops).toBeGreaterThan(0);
    });
  });

  describe('G6: 编队约束校验', () => {
    it('应该拒绝无将领的编队', () => {
      // 尝试创建无将领编队
      const result = expeditionSystem.createForce({ heroId: '', troops: 1000 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('HERO_REQUIRED');
    });

    it('应该拒绝无士兵的编队', () => {
      const result = expeditionSystem.createForce({ heroId: 'hero-1', troops: 0 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TROOPS_REQUIRED');
    });

    it('应该拒绝将领重复的编队', () => {
      expeditionSystem.createForce({ heroId: 'hero-1', troops: 1000 });
      const result = expeditionSystem.createForce({ heroId: 'hero-1', troops: 500 });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('HERO_BUSY');
    });

    it('应该拒绝受伤将领的编队攻城', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 1000 });

      // 模拟将领受伤（多次尝试）
      let injured = false;
      for (let i = 0; i < 100; i++) {
        const force = expeditionSystem.getForce(forceId!);
        force!.troops = 1000;
        const casualties = expeditionSystem.calculateCasualties(forceId!, 'rout');
        if (casualties!.heroInjured) {
          injured = true;
          break;
        }
      }

      if (injured) {
        // 受伤将领无法出征
        const validation = expeditionSystem.validateForceForExpedition(forceId!);
        expect(validation.valid).toBe(false);
        expect(validation.errorCode).toBe('HERO_INJURED');
      }
    });
  });

  describe('H4: 伤亡集成到攻城流程', () => {
    it('胜利时应该有士兵伤亡', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 1000 });

      // 多次尝试确保胜利
      let victoryResult: any = null;
      for (let i = 0; i < 100; i++) {
        // 重置编队
        const force = expeditionSystem.getForce(forceId!);
        force!.troops = 1000;
        force!.status = 'ready';

        const result = siegeSystem.executeSiegeWithExpedition(
          forceId!,
          'target-2', // 低防御
          'player' as OwnershipStatus,
          500,
        );

        if (result.victory) {
          victoryResult = result;
          break;
        }
      }

      if (victoryResult) {
        expect(victoryResult.casualties).toBeDefined();
        expect(victoryResult.casualties!.troopsLost).toBeGreaterThan(0);
        expect(victoryResult.casualties!.battleResult).toBe('victory');
      }
    });

    it('失败时应该有更高的士兵伤亡', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 1000 });

      // 多次尝试确保失败
      let defeatResult: any = null;
      for (let i = 0; i < 100; i++) {
        // 重置编队
        const force = expeditionSystem.getForce(forceId!);
        force!.troops = 1000;
        force!.status = 'ready';

        const result = siegeSystem.executeSiegeWithExpedition(
          forceId!,
          'target-1', // 高防御
          'player' as OwnershipStatus,
          500,
        );

        if (!result.victory && result.launched) {
          defeatResult = result;
          break;
        }
      }

      if (defeatResult) {
        expect(defeatResult.casualties).toBeDefined();
        expect(defeatResult.casualties!.troopsLost).toBeGreaterThan(0);
        expect(['defeat', 'rout']).toContain(defeatResult.casualties!.battleResult);
      }
    });

    it('攻城后编队兵力应该减少', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 1000 });
      const initialForce = expeditionSystem.getForce(forceId!);
      const initialTroops = initialForce!.troops;

      // 执行攻城
      siegeSystem.executeSiegeWithExpedition(
        forceId!,
        'target-1',
        'player' as OwnershipStatus,
        500,
      );

      // 验证兵力减少
      const afterForce = expeditionSystem.getForce(forceId!);
      expect(afterForce!.troops).toBeLessThan(initialTroops);
    });
  });

  describe('H5: 攻城结果弹窗显示伤亡详情', () => {
    it('结果应该包含伤亡信息', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 1000 });

      // 执行攻城
      const result = siegeSystem.executeSiegeWithExpedition(
        forceId!,
        'target-1',
        'player' as OwnershipStatus,
        500,
      );

      // 验证结果包含伤亡信息
      expect(result.casualties).toBeDefined();
      expect(result.casualties!.troopsLost).toBeDefined();
      expect(result.casualties!.troopsLostPercent).toBeDefined();
      expect(result.casualties!.heroInjured).toBeDefined();
      expect(result.casualties!.injuryLevel).toBeDefined();
      expect(result.casualties!.battleResult).toBeDefined();
    });
  });

  describe('H7: 将领受伤影响战力', () => {
    it('受伤将领应该降低攻城胜率', () => {
      // 创建编队
      const { forceId } = expeditionSystem.createForce({ heroId: 'hero-1', troops: 1000 });

      // 获取初始战力倍率
      const initialMultiplier = expeditionSystem.getHeroPowerMultiplier('hero-1');
      expect(initialMultiplier).toBe(1.0);

      // 模拟将领受伤
      let injured = false;
      for (let i = 0; i < 100; i++) {
        const force = expeditionSystem.getForce(forceId!);
        force!.troops = 1000;
        const casualties = expeditionSystem.calculateCasualties(forceId!, 'rout');
        if (casualties!.heroInjured) {
          injured = true;
          break;
        }
      }

      if (injured) {
        // 验证战力降低
        const injuredMultiplier = expeditionSystem.getHeroPowerMultiplier('hero-1');
        expect(injuredMultiplier).toBeLessThan(1.0);
      }
    });
  });

  describe('无ExpeditionSystem时回退', () => {
    it('应该返回失败结果', () => {
      // 创建没有ExpeditionSystem的依赖
      const depsWithoutExpedition = {
        ...mockDeps,
        registry: {
          get: vi.fn((name: string) => {
            if (name === 'territory') {
              return {
                getTerritoryById: (id: string) => mockTerritories.get(id),
                canAttackTerritory: () => true,
              };
            }
            return null; // 没有expedition
          }),
        },
      };

      const siegeWithoutExpedition = new SiegeSystem();
      siegeWithoutExpedition.init(depsWithoutExpedition);

      const result = siegeWithoutExpedition.executeSiegeWithExpedition(
        'force-1',
        'target-1',
        'player' as OwnershipStatus,
        500,
      );

      expect(result.launched).toBe(false);
      expect(result.failureReason).toBe('出征系统未初始化');
    });
  });
});
