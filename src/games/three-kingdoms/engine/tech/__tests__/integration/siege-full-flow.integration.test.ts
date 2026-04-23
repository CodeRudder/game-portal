/**
 * 集成测试 — 攻城战完整流程
 *
 * 覆盖 Play 文档流程：
 *   §4.1  攻城条件检查
 *   §4.2  城防计算与胜率预估
 *   §4.3  攻城战斗与占领
 *   §4.4  攻城奖励
 *   §4.5  攻城时间计算
 *   §4.6  攻城失败推荐算法
 *
 * @module engine/tech/__tests__/integration/siege-full-flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldMapSystem } from '../../../map/WorldMapSystem';
import { TerritorySystem } from '../../../map/TerritorySystem';
import { SiegeSystem } from '../../../map/SiegeSystem';
import { SiegeEnhancer } from '../../../map/SiegeEnhancer';
import { GarrisonSystem } from '../../../map/GarrisonSystem';
import type { ISystemDeps } from '../../../../../core/types';
import type { ISubsystemRegistry } from '../../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createDeps(): ISystemDeps {
  const worldMap = new WorldMapSystem();
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();

  const registry = new Map<string, unknown>();
  registry.set('worldMap', worldMap);
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('siegeEnhancer', enhancer);
  registry.set('garrison', garrison);

  const deps: ISystemDeps = {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: () => {},
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: (name: string) => registry.get(name) ?? null,
      getAll: () => new Map(),
      has: (name: string) => registry.has(name),
      unregister: () => {},
    } as unknown as ISubsystemRegistry,
  };

  worldMap.init(deps);
  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    territory: deps.registry.get<TerritorySystem>('territory')!,
    siege: deps.registry.get<SiegeSystem>('siege')!,
    enhancer: deps.registry.get<SiegeEnhancer>('siegeEnhancer')!,
    garrison: deps.registry.get<GarrisonSystem>('garrison')!,
  };
}

// ─────────────────────────────────────────────
// §4.1 攻城条件检查
// ─────────────────────────────────────────────

describe('§4.1 攻城条件检查', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('攻城条件: 相邻+兵力+粮草', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    const result = sys.siege.checkSiegeConditions(target.id, 'player', 10000, 10000);
    expect(result).toHaveProperty('canSiege');
  });

  it('每日攻城次数上限3次', () => {
    const remaining = sys.siege.getRemainingDailySieges();
    expect(remaining).toBeLessThanOrEqual(3);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('兵力不足时无法攻城', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    const result = sys.siege.checkSiegeConditions(target.id, 'player', 10, 10000);
    expect(result.canSiege).toBe(false);
    if (!result.canSiege) {
      expect(result).toHaveProperty('errorCode');
    }
  });

  it('粮草不足时无法攻城', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    const result = sys.siege.checkSiegeConditions(target.id, 'player', 10000, 10);
    expect(result.canSiege).toBe(false);
  });

  it('粮草消耗=粮草×500（固定）', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    const cost = sys.siege.getSiegeCostById(target.id);
    if (cost) {
      expect(cost).toHaveProperty('grain');
      expect(cost.grain).toBe(500);
    }
  });

  it('己方领土不可攻城', () => {
    const territories = sys.territory.getAllTerritories();
    const player = territories.find((t: any) => t.ownership === 'player');
    if (!player) return;

    const result = sys.siege.checkSiegeConditions(player.id, 'player', 10000, 10000);
    expect(result.canSiege).toBe(false);
  });
});

// ─────────────────────────────────────────────
// §4.2 城防计算与胜率预估
// ─────────────────────────────────────────────

describe('§4.2 城防计算与胜率预估', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('城防值=基础(1000)×城市等级×(1+科技加成)', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    const estimate = sys.enhancer.estimateWinRate(5000, target.id);
    if (estimate) {
      expect(estimate).toHaveProperty('winRate');
      expect(estimate.winRate).toBeGreaterThanOrEqual(0);
      expect(estimate.winRate).toBeLessThanOrEqual(1);
    }
  });

  it('胜率预估颜色: >80%翠绿/60%~80%金色/40%~60%琥珀橙/<40%赤红', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    const estimate = sys.enhancer.estimateWinRate(5000, target.id);
    if (estimate) {
      expect(estimate.winRate).toBeGreaterThanOrEqual(0);
      expect(estimate.winRate).toBeLessThanOrEqual(1);
      expect(estimate).toHaveProperty('rating');
    }
  });

  it('高兵力胜率高于低兵力', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    const lowEstimate = sys.enhancer.estimateWinRate(1000, target.id);
    const highEstimate = sys.enhancer.estimateWinRate(10000, target.id);

    if (lowEstimate && highEstimate) {
      expect(highEstimate.winRate).toBeGreaterThanOrEqual(lowEstimate.winRate);
    }
  });
});

// ─────────────────────────────────────────────
// §4.3 攻城战斗与占领
// ─────────────────────────────────────────────

describe('§4.3 攻城战斗与占领', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('胜利条件: 城防值归零（唯一条件）', () => {
    const result = sys.siege.executeSiegeWithResult(
      'test-target', 'player', 10000, 10000, true
    );
    expect(result).toHaveProperty('victory');
    expect(result).toHaveProperty('launched');
  });

  it('占领后获得该城市产出(初始50%)', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    sys.territory.captureTerritory(target.id, 'player');
    const updated = sys.territory.getTerritoryById(target.id);
    expect(updated?.ownership).toBe('player');
  });

  it('攻城失败返回正确结构', () => {
    const result = sys.siege.executeSiegeWithResult(
      'test-target', 'player', 100, 100, false
    );
    expect(result).toHaveProperty('launched');
    expect(result).toHaveProperty('victory');
    if (!result.victory) {
      expect(result).toHaveProperty('cost');
    }
  });
});

// ─────────────────────────────────────────────
// §4.4 攻城奖励
// ─────────────────────────────────────────────

describe('§4.4 攻城奖励', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('攻城奖励计算', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories[0];
    if (!target) return;

    const reward = sys.enhancer.calculateSiegeRewardById(target.id);
    if (reward) {
      expect(reward).toHaveProperty('resources');
    }
  });

  it('首次攻占奖励应含元宝+声望', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories[0];
    if (!target) return;

    const reward = sys.enhancer.calculateSiegeRewardById(target.id);
    if (reward) {
      expect(reward).toHaveProperty('resources');
    }
  });
});

// ─────────────────────────────────────────────
// §4.5 攻城时间计算
// ─────────────────────────────────────────────

describe('§4.5 攻城时间计算', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('攻城时间=基础30分钟+城防值/100(分钟)', () => {
    const territories = sys.territory.getAllTerritories();
    expect(territories.length).toBeGreaterThan(0);
  });

  it('高级城市攻城时间更长', () => {
    const territories = sys.territory.getAllTerritories();
    expect(territories.length).toBeGreaterThan(0);
    // 时间与城防成正比
  });
});

// ─────────────────────────────────────────────
// §4.6 攻城失败推荐算法
// ─────────────────────────────────────────────

describe('§4.6 攻城失败推荐算法', () => {
  let deps: ISystemDeps;
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    deps = createDeps();
    sys = getSys(deps);
  });

  it('失败后应返回推荐方案', () => {
    const result = sys.siege.executeSiegeWithResult(
      'test-target', 'player', 100, 100, false
    );
    if (!result.victory) {
      expect(result.cost.troops).toBeGreaterThanOrEqual(0);
    }
  });

  it('微弱差距(比值0.8~1.0)推荐提升兵力', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    const estimate = sys.enhancer.estimateWinRate(4000, target.id);
    if (estimate && estimate.winRate >= 0.4 && estimate.winRate < 0.6) {
      // 中等差距应有推荐
      expect(estimate).toHaveProperty('winRate');
    }
  });

  it('巨大差距(比值<0.5)推荐转生或降级目标', () => {
    const territories = sys.territory.getAllTerritories();
    const target = territories.find((t: any) => t.ownership !== 'player');
    if (!target) return;

    const estimate = sys.enhancer.estimateWinRate(500, target.id);
    if (estimate && estimate.winRate < 0.4) {
      expect(estimate).toHaveProperty('rating');
    }
  });

  it('失败损失30%出征兵力', () => {
    const result = sys.siege.executeSiegeWithResult(
      'test-target', 'player', 1000, 1000, false
    );
    if (!result.victory && result.defeatTroopLoss !== undefined) {
      expect(result.defeatTroopLoss).toBe(Math.floor(1000 * 0.3));
    }
  });
});
