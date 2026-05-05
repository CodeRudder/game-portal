/**
 * 攻城策略系统单元测试 (MAP-F06-02)
 *
 * 测试4种攻城策略(强攻/围困/夜袭/内应)的四维差异化:
 * - 时间倍率
 * - 兵力损耗倍率
 * - 奖励倍率
 * - 胜率修正
 */

import { SiegeSystem } from '../SiegeSystem';
import { TerritorySystem } from '../TerritorySystem';
import { WorldMapSystem } from '../WorldMapSystem';
import { GarrisonSystem } from '../GarrisonSystem';
import { SIEGE_STRATEGY_CONFIGS } from '../../../core/map/siege-enhancer.types';
import type { ISystemDeps, ISubsystemRegistry, IEventBus } from '../../../core/types';
import type { SiegeStrategyType } from '../../../core/map/siege-enhancer.types';

// ─── 测试工具 ──────────────────────────────────

function createMockDeps(): ISystemDeps {
  const subsystems = new Map<string, any>();
  const eventBus: IEventBus = { emit: jest.fn(), on: jest.fn(), off: jest.fn() };
  const registry: ISubsystemRegistry = {
    get<T>(name: string): T | undefined { return subsystems.get(name) as T; },
    getAll: jest.fn(),
  };
  return { eventBus, registry, config: {} as any };
}

function createTestSystems() {
  const deps = createMockDeps();
  const worldMap = new WorldMapSystem();
  const territory = new TerritorySystem();
  const garrison = new GarrisonSystem();
  const siege = new SiegeSystem();

  worldMap.init(deps);
  territory.init(deps);
  garrison.init(deps);
  siege.init(deps);

  // 注册子系统
  (deps.registry as any).get = (name: string) => {
    if (name === 'territory') return territory;
    if (name === 'siege') return siege;
    if (name === 'garrison') return garrison;
    if (name === 'worldMap') return worldMap;
    return undefined;
  };

  return { deps, worldMap, territory, garrison, siege };
}

// ─── 测试 ──────────────────────────────────────

describe('攻城策略系统 (MAP-F06-02)', () => {
  let siege: SiegeSystem;
  let territory: TerritorySystem;

  beforeEach(() => {
    const systems = createTestSystems();
    siege = systems.siege;
    territory = systems.territory;
  });

  // ── 策略配置验证 ─────────────────────────────

  describe('策略配置完整性', () => {
    it('应有4种策略', () => {
      const strategies = siege.getAllStrategies();
      expect(strategies).toHaveLength(4);
    });

    it('强攻: 速攻手定位', () => {
      const config = siege.getStrategyConfig('forceAttack');
      expect(config.name).toBe('强攻');
      expect(config.timeMultiplier).toBe(0.5);
      expect(config.troopCostMultiplier).toBe(1.5);
      expect(config.rewardMultiplier).toBe(0.9);
      expect(config.winRateBonus).toBe(-0.10);
      expect(config.requiredItem).toBeNull();
      expect(config.positioning).toBe('速攻手');
    });

    it('围困: 稳扎稳打定位', () => {
      const config = siege.getStrategyConfig('siege');
      expect(config.name).toBe('围困');
      expect(config.timeMultiplier).toBe(2.0);
      expect(config.troopCostMultiplier).toBe(0.8);
      expect(config.rewardMultiplier).toBe(1.0);
      expect(config.winRateBonus).toBe(0.10);
      expect(config.requiredItem).toBeNull();
      expect(config.positioning).toBe('稳扎稳打');
    });

    it('夜袭: 奇袭者定位', () => {
      const config = siege.getStrategyConfig('nightRaid');
      expect(config.name).toBe('夜袭');
      expect(config.timeMultiplier).toBe(0.8);
      expect(config.troopCostMultiplier).toBe(1.2);
      expect(config.rewardMultiplier).toBe(1.2);
      expect(config.winRateBonus).toBe(0.05);
      expect(config.requiredItem).toBe('item-night-raid-token');
      expect(config.positioning).toBe('奇袭者');
    });

    it('内应: 智取型定位', () => {
      const config = siege.getStrategyConfig('insider');
      expect(config.name).toBe('内应');
      expect(config.timeMultiplier).toBe(1.0);
      expect(config.troopCostMultiplier).toBe(1.0);
      expect(config.rewardMultiplier).toBe(1.5);
      expect(config.winRateBonus).toBe(0.20);
      expect(config.requiredItem).toBe('item-insider-letter');
      expect(config.positioning).toBe('智取型');
    });
  });

  // ── 策略消耗计算 ─────────────────────────────

  describe('策略修正消耗', () => {
    it('强攻消耗=基础×1.5', () => {
      const territoryData = territory.getTerritoryById('city-xuchang')!;
      const baseCost = siege.calculateSiegeCost(territoryData);
      const strategyCost = siege.calculateStrategySiegeCost(territoryData, 'forceAttack');
      expect(strategyCost.troops).toBe(Math.ceil(baseCost.troops * 1.5));
      expect(strategyCost.grain).toBe(baseCost.grain);
    });

    it('围困消耗=基础×0.8', () => {
      const territoryData = territory.getTerritoryById('city-xuchang')!;
      const baseCost = siege.calculateSiegeCost(territoryData);
      const strategyCost = siege.calculateStrategySiegeCost(territoryData, 'siege');
      expect(strategyCost.troops).toBe(Math.ceil(baseCost.troops * 0.8));
    });

    it('夜袭消耗=基础×1.2', () => {
      const territoryData = territory.getTerritoryById('city-xuchang')!;
      const baseCost = siege.calculateSiegeCost(territoryData);
      const strategyCost = siege.calculateStrategySiegeCost(territoryData, 'nightRaid');
      expect(strategyCost.troops).toBe(Math.ceil(baseCost.troops * 1.2));
    });

    it('内应消耗=基础×1.0', () => {
      const territoryData = territory.getTerritoryById('city-xuchang')!;
      const baseCost = siege.calculateSiegeCost(territoryData);
      const strategyCost = siege.calculateStrategySiegeCost(territoryData, 'insider');
      expect(strategyCost.troops).toBe(baseCost.troops);
    });
  });

  // ── 策略胜率修正 ─────────────────────────────

  describe('策略修正胜率', () => {
    it('强攻胜率=基础-10%', () => {
      const baseRate = siege.computeWinRate(1000, 1000);
      const strategyRate = siege.computeStrategyWinRate(1000, 1000, 'forceAttack');
      expect(strategyRate).toBeCloseTo(baseRate - 0.10, 2);
    });

    it('围困胜率=基础+10%', () => {
      const baseRate = siege.computeWinRate(1000, 1000);
      const strategyRate = siege.computeStrategyWinRate(1000, 1000, 'siege');
      expect(strategyRate).toBeCloseTo(baseRate + 0.10, 2);
    });

    it('夜袭胜率=基础+5%', () => {
      const baseRate = siege.computeWinRate(1000, 1000);
      const strategyRate = siege.computeStrategyWinRate(1000, 1000, 'nightRaid');
      expect(strategyRate).toBeCloseTo(baseRate + 0.05, 2);
    });

    it('内应胜率=基础+20%', () => {
      const baseRate = siege.computeWinRate(1000, 1000);
      const strategyRate = siege.computeStrategyWinRate(1000, 1000, 'insider');
      expect(strategyRate).toBeCloseTo(baseRate + 0.20, 2);
    });

    it('胜率截断至[5%, 95%]', () => {
      // 极低战力: 基础5% + 内应+20% = 25%
      const lowRate = siege.computeStrategyWinRate(10, 100000, 'insider');
      expect(lowRate).toBeGreaterThanOrEqual(0.05);
      expect(lowRate).toBeLessThanOrEqual(0.95);

      // 极高战力: 基础95% + 围困+10% = 95%(截断)
      const highRate = siege.computeStrategyWinRate(100000, 10, 'siege');
      expect(highRate).toBeLessThanOrEqual(0.95);
    });
  });

  // ── 策略奖励倍率 ─────────────────────────────

  describe('策略奖励倍率', () => {
    it('强攻奖励×0.9', () => {
      expect(siege.getStrategyRewardMultiplier('forceAttack')).toBe(0.9);
    });

    it('围困奖励×1.0', () => {
      expect(siege.getStrategyRewardMultiplier('siege')).toBe(1.0);
    });

    it('夜袭奖励×1.2', () => {
      expect(siege.getStrategyRewardMultiplier('nightRaid')).toBe(1.2);
    });

    it('内应奖励×1.5', () => {
      expect(siege.getStrategyRewardMultiplier('insider')).toBe(1.5);
    });
  });

  // ── 策略执行 ─────────────────────────────────

  describe('策略执行', () => {
    it('强攻执行: 结果包含策略信息', () => {
      territory.captureTerritory('city-luoyang', 'player');
      const result = siege.executeSiege('city-xuchang', 'player', 100000, 10000, 'forceAttack');
      expect(result.launched).toBe(true);
      expect(result.strategy).toBe('forceAttack');
      expect(result.rewardMultiplier).toBe(0.9);
    });

    it('围困执行: 结果包含策略信息', () => {
      territory.captureTerritory('city-luoyang', 'player');
      const result = siege.executeSiege('city-xuchang', 'player', 100000, 10000, 'siege');
      expect(result.launched).toBe(true);
      expect(result.strategy).toBe('siege');
      expect(result.rewardMultiplier).toBe(1.0);
    });

    it('无策略执行: 默认奖励倍率1.0', () => {
      territory.captureTerritory('city-luoyang', 'player');
      const result = siege.executeSiege('city-xuchang', 'player', 100000, 10000);
      expect(result.launched).toBe(true);
      expect(result.strategy).toBeUndefined();
      expect(result.rewardMultiplier).toBe(1.0); // 无策略时默认1.0
    });
  });

  // ── 内应暴露冷却 ─────────────────────────────

  describe('内应暴露冷却', () => {
    it('初始无暴露', () => {
      expect(siege.isInsiderExposed('city-xuchang')).toBe(false);
    });

    it('内应失败后标记暴露', () => {
      territory.captureTerritory('city-luoyang', 'player');
      // 强制失败
      const result = siege.executeSiegeWithResult('city-xuchang', 'player', 100000, 10000, false, 'insider');
      expect(result.victory).toBe(false);
      expect(siege.isInsiderExposed('city-xuchang')).toBe(true);
    });

    it('暴露冷却剩余时间>0', () => {
      territory.captureTerritory('city-luoyang', 'player');
      siege.executeSiegeWithResult('city-xuchang', 'player', 100000, 10000, false, 'insider');
      expect(siege.getInsiderCooldownRemaining('city-xuchang')).toBeGreaterThan(0);
    });

    it('暴露后不可再次使用内应策略', () => {
      territory.captureTerritory('city-luoyang', 'player');
      // 第一次内应失败
      siege.executeSiegeWithResult('city-xuchang', 'player', 100000, 10000, false, 'insider');
      siege.resetDailySiegeCount();
      // 第二次尝试内应
      const result = siege.checkSiegeConditions('city-xuchang', 'player', 100000, 10000, 'insider');
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('INSIDER_EXPOSED');
    });

    it('内应成功后清除暴露', () => {
      territory.captureTerritory('city-luoyang', 'player');
      // 先标记暴露(失败)
      siege.executeSiegeWithResult('city-xuchang', 'player', 100000, 10000, false, 'insider');
      expect(siege.isInsiderExposed('city-xuchang')).toBe(true);

      // 模拟暴露冷却过期(手动清除时间戳)
      const data = siege.serialize();
      delete data.insiderExposures!['city-xuchang'];
      siege.deserialize(data);
      expect(siege.isInsiderExposed('city-xuchang')).toBe(false);

      // 重置每日次数
      siege.resetDailySiegeCount();

      // 内应成功
      const result = siege.executeSiegeWithResult('city-xuchang', 'player', 100000, 10000, true, 'insider');
      expect(result.victory).toBe(true);
      expect(result.specialEffectTriggered).toBe(true);
      expect(siege.isInsiderExposed('city-xuchang')).toBe(false);
    });
  });

  // ── 序列化 ───────────────────────────────────

  describe('内应暴露序列化', () => {
    it('serialize保存insiderExposures', () => {
      territory.captureTerritory('city-luoyang', 'player');
      siege.executeSiegeWithResult('city-xuchang', 'player', 100000, 10000, false, 'insider');
      const data = siege.serialize();
      expect(data.insiderExposures).toBeDefined();
      expect(data.insiderExposures!['city-xuchang']).toBeDefined();
    });

    it('deserialize恢复insiderExposures', () => {
      territory.captureTerritory('city-luoyang', 'player');
      siege.executeSiegeWithResult('city-xuchang', 'player', 100000, 10000, false, 'insider');
      const data = siege.serialize();

      const siege2 = new SiegeSystem();
      siege2.init(createMockDeps());
      siege2.deserialize(data);
      expect(siege2.isInsiderExposed('city-xuchang')).toBe(true);
    });
  });

  // ── insider策略完整E2E验证 ─────────────────────

  describe('insider策略完整E2E验证', () => {
    it('insider胜利: 城防完整保留 + clearInsiderExposure + specialEffectTriggered', () => {
      territory.captureTerritory('city-luoyang', 'player');
      const target = territory.getTerritoryById('city-xuchang')!;
      const originalDefense = target.defenseValue;

      const result = siege.executeSiege('city-xuchang', 'player', 100000, 10000, 'insider');

      expect(result.launched).toBe(true);
      expect(result.victory).toBe(true);
      expect(result.strategy).toBe('insider');
      expect(result.specialEffectTriggered).toBe(true);
      expect(result.rewardMultiplier).toBe(1.5);

      // insider胜利后城防完整保留(不像强攻减50%)
      const afterTerritory = territory.getTerritoryById('city-xuchang')!;
      expect(afterTerritory.defenseValue).toBe(originalDefense);

      // insider暴露标记已清除
      expect(siege.isInsiderExposed('city-xuchang')).toBe(false);
    });

    it('insider失败: 设置暴露标记 + 领土不变 + 城防不变', () => {
      territory.captureTerritory('city-luoyang', 'player');
      const target = territory.getTerritoryById('city-xuchang')!;
      const originalDefense = target.defenseValue;
      const originalOwner = target.ownership;

      const result = siege.executeSiegeWithResult('city-xuchang', 'player', 100000, 10000, false, 'insider');

      expect(result.launched).toBe(true);
      expect(result.victory).toBe(false);
      expect(result.specialEffectTriggered).toBe(true);
      expect(result.defeatTroopLoss).toBe(0); // R27修复

      // 领土归属不变
      const afterTerritory = territory.getTerritoryById('city-xuchang')!;
      expect(afterTerritory.ownership).toBe(originalOwner);
      expect(afterTerritory.defenseValue).toBe(originalDefense);

      // insider暴露标记已设置
      expect(siege.isInsiderExposed('city-xuchang')).toBe(true);
    });
  });
});
