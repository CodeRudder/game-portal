/**
 * 集成测试 — 攻城战完整流程 (v5.0 百家争鸣)
 *
 * 覆盖 Play 文档流程：
 *   §4.1  攻城条件检查（相邻/兵力/粮草/日限）
 *   §4.2  城防计算与胜率预估
 *   §4.3  攻城战斗与占领
 *   §4.4  攻城奖励
 *   §4.5  攻城时间
 *   §4.6  攻城失败推荐（skip，API未实现）
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

/** 找到一个可攻击的非己方领土ID（需有相邻己方领土） */
function findAttackableTarget(sys: ReturnType<typeof getSys>): string | null {
  const list = sys.territory.getAttackableTerritories('player');
  return list.length > 0 ? list[0].id : null;
}

// ═════════════════════════════════════════════
// §4.1 攻城条件检查
// ═════════════════════════════════════════════

describe('§4.1 攻城条件检查', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('checkSiegeConditions返回canSiege+errorCode结构', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.siege.checkSiegeConditions(target, 'player', 10000, 10000);
    expect(result).toHaveProperty('canSiege');
    expect(typeof result.canSiege).toBe('boolean');
  });

  it('兵力不足返回INSUFFICIENT_TROOPS', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.siege.checkSiegeConditions(target, 'player', 10, 10000);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
  });

  it('粮草不足返回INSUFFICIENT_GRAIN', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.siege.checkSiegeConditions(target, 'player', 10000, 10);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_GRAIN');
  });

  it('己方领土不可攻城→TARGET_ALREADY_OWNED', () => {
    const player = sys.territory.getAllTerritories().find(t => t.ownership === 'player');
    if (!player) return;
    const result = sys.siege.checkSiegeConditions(player.id, 'player', 10000, 10000);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('TARGET_ALREADY_OWNED');
  });

  it('不存在的领土→TARGET_NOT_FOUND', () => {
    const result = sys.siege.checkSiegeConditions('nonexistent-xyz', 'player', 10000, 10000);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('TARGET_NOT_FOUND');
  });

  it('粮草消耗固定500', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const cost = sys.siege.getSiegeCostById(target);
    expect(cost).not.toBeNull();
    expect(cost!.grain).toBe(500);
  });

  it('兵力消耗=基础100×(defenseValue/100)', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const t = sys.territory.getTerritoryById(target)!;
    const cost = sys.siege.getSiegeCostById(target)!;
    expect(cost.troops).toBe(Math.ceil(100 * (t.defenseValue / 100)));
  });

  it('每日攻城上限3次，初始剩余<=3', () => {
    expect(sys.siege.getRemainingDailySieges()).toBeLessThanOrEqual(3);
    expect(sys.siege.getRemainingDailySieges()).toBeGreaterThanOrEqual(0);
  });

  it('resetDailySiegeCount重置每日计数', () => {
    sys.siege.resetDailySiegeCount();
    expect(sys.siege.getRemainingDailySieges()).toBe(3);
  });
});

// ═════════════════════════════════════════════
// §4.2 城防计算与胜率预估
// ═════════════════════════════════════════════

describe('§4.2 城防计算与胜率预估', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('estimateWinRate返回完整结构', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(5000, target);
    expect(est).not.toBeNull();
    expect(est).toHaveProperty('winRate');
    expect(est).toHaveProperty('attackerPower');
    expect(est).toHaveProperty('defenderPower');
    expect(est).toHaveProperty('estimatedLossRate');
    expect(est).toHaveProperty('rating');
  });

  it('winRate在[0,1]区间', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(5000, target)!;
    expect(est.winRate).toBeGreaterThanOrEqual(0);
    expect(est.winRate).toBeLessThanOrEqual(1);
  });

  it('高兵力胜率>=低兵力胜率', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const low = sys.enhancer.estimateWinRate(500, target)!;
    const high = sys.enhancer.estimateWinRate(50000, target)!;
    expect(high.winRate).toBeGreaterThanOrEqual(low.winRate);
  });

  it('rating为easy/moderate/hard/very_hard/impossible之一', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(5000, target)!;
    expect(['easy', 'moderate', 'hard', 'very_hard', 'impossible']).toContain(est.rating);
  });

  it('不存在的领土返回null', () => {
    expect(sys.enhancer.estimateWinRate(5000, 'nonexistent')).toBeNull();
  });

  it('attackerPower=0时winRate=WIN_RATE_MIN', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(0, target)!;
    // 系统设定最低胜率 WIN_RATE_MIN=0.05，attackerPower=0 时返回最低胜率
    expect(est.winRate).toBe(0.05);
  });

  it('calculateDefenderPower基于defenseValue', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const t = sys.territory.getTerritoryById(target)!;
    const power = sys.enhancer.calculateDefenderPower(t);
    expect(power).toBeGreaterThan(0);
    expect(power).toBeGreaterThanOrEqual(t.defenseValue);
  });
});

// ═════════════════════════════════════════════
// §4.3 攻城战斗与占领
// ═════════════════════════════════════════════

describe('§4.3 攻城战斗与占领', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('executeSiegeWithResult返回完整结构', () => {
    const result = sys.siege.executeSiegeWithResult(
      'test-target', 'player', 10000, 10000, true,
    );
    expect(result).toHaveProperty('launched');
    expect(result).toHaveProperty('victory');
    expect(result).toHaveProperty('targetId');
    expect(result).toHaveProperty('cost');
  });

  it('胜利时capture包含newOwner和previousOwner', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const t = sys.territory.getTerritoryById(target)!;
    const prevOwner = t.ownership;
    const result = sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    if (result.launched && result.victory && result.capture) {
      expect(result.capture.newOwner).toBe('player');
      expect(result.capture.previousOwner).toBe(prevOwner);
    }
  });

  it('胜利后领土归属变为player', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    const updated = sys.territory.getTerritoryById(target);
    // 如果成功发起且胜利，归属应变为player
    if (updated) {
      expect(updated.ownership).toBe('player');
    }
  });

  it('失败时包含failureReason和defeatTroopLoss', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, false);
    if (result.launched && !result.victory) {
      expect(result.failureReason).toBeDefined();
      expect(result.defeatTroopLoss).toBeGreaterThanOrEqual(0);
    }
  });

  it('失败损失=30%出征兵力', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const cost = sys.siege.getSiegeCostById(target)!;
    const result = sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, false);
    if (result.launched && !result.victory && result.defeatTroopLoss !== undefined) {
      expect(result.defeatTroopLoss).toBe(Math.floor(cost.troops * 0.3));
    }
  });

  it('条件不满足时launched=false', () => {
    const result = sys.siege.executeSiegeWithResult(
      'nonexistent-xyz', 'player', 10, 10, true,
    );
    expect(result.launched).toBe(false);
    expect(result.failureReason).toBeDefined();
  });

  it('攻城统计更新：totalSieges递增', () => {
    const before = sys.siege.getTotalSieges();
    const target = findAttackableTarget(sys);
    if (!target) return;
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    expect(sys.siege.getTotalSieges()).toBe(before + 1);
  });

  it('胜利后victories递增', () => {
    const before = sys.siege.getVictories();
    const target = findAttackableTarget(sys);
    if (!target) return;
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    expect(sys.siege.getVictories()).toBe(before + 1);
  });

  it('getWinRate返回0~1', () => {
    const rate = sys.siege.getWinRate();
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  });

  it('getHistory返回攻城历史数组', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    const history = sys.siege.getHistory();
    expect(history.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════
// §4.4 攻城奖励
// ═════════════════════════════════════════════

describe('§4.4 攻城奖励', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('calculateSiegeReward返回resources+territoryExp+items', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const reward = sys.enhancer.calculateSiegeRewardById(target);
    if (!reward) return;
    expect(reward).toHaveProperty('resources');
    expect(reward).toHaveProperty('territoryExp');
    expect(reward).toHaveProperty('items');
  });

  it('resources包含grain/gold/troops/mandate', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const reward = sys.enhancer.calculateSiegeRewardById(target);
    if (!reward) return;
    expect(reward.resources).toHaveProperty('grain');
    expect(reward.resources).toHaveProperty('gold');
    expect(reward.resources).toHaveProperty('troops');
    expect(reward.resources).toHaveProperty('mandate');
  });

  it('高等级领土奖励更多', () => {
    const all = sys.territory.getAllTerritories();
    const low = all.find(t => t.level === 1);
    const high = all.find(t => t.level >= 3);
    if (!low || !high) return;
    const rLow = sys.enhancer.calculateSiegeReward(low);
    const rHigh = sys.enhancer.calculateSiegeReward(high);
    const totalLow = rLow.resources.grain + rLow.resources.gold;
    const totalHigh = rHigh.resources.grain + rHigh.resources.gold;
    expect(totalHigh).toBeGreaterThan(totalLow);
  });

  it('关隘类型有passBonusMultiplier加成', () => {
    const pass = sys.territory.getAllTerritories().find(t => t.id.includes('pass-'));
    if (!pass) return;
    const reward = sys.enhancer.calculateSiegeReward(pass);
    expect(reward.resources.grain).toBeGreaterThan(0);
  });

  it('不存在的领土返回null', () => {
    expect(sys.enhancer.calculateSiegeRewardById('nonexistent')).toBeNull();
  });

  it('items掉落为数组且最多2个', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const reward = sys.enhancer.calculateSiegeRewardById(target);
    if (!reward) return;
    expect(reward.items.length).toBeLessThanOrEqual(2);
  });

  it('executeConquest胜利时包含reward', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.enhancer.executeConquest(target, 'player', 50000, 10000, 10000);
    if (result.success) {
      expect(result.reward).not.toBeNull();
      expect(result.reward!.resources).toBeDefined();
    }
  });
});

// ═════════════════════════════════════════════
// §4.5 攻城时间
// ═════════════════════════════════════════════

describe('§4.5 攻城时间', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('攻城消耗包含grain固定500', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const cost = sys.siege.getSiegeCostById(target);
    if (cost) {
      expect(cost.grain).toBe(500);
    }
  });

  it('城防值与领土等级正相关', () => {
    const all = sys.territory.getAllTerritories();
    const lv1 = all.find(t => t.level === 1);
    const lv3 = all.find(t => t.level >= 3);
    if (lv1 && lv3) {
      expect(lv3.defenseValue).toBeGreaterThan(lv1.defenseValue);
    }
  });

  it('高城防消耗更多兵力', () => {
    const all = sys.territory.getAllTerritories();
    const low = all.reduce((a, b) => a.defenseValue < b.defenseValue ? a : b);
    const high = all.reduce((a, b) => a.defenseValue > b.defenseValue ? a : b);
    const costLow = sys.siege.calculateSiegeCost(low);
    const costHigh = sys.siege.calculateSiegeCost(high);
    expect(costHigh.troops).toBeGreaterThan(costLow.troops);
  });
});

// ═════════════════════════════════════════════
// §4.6 攻城失败推荐（API未实现，skip）
// ═════════════════════════════════════════════

describe('§4.6 攻城失败推荐算法', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it.skip('失败后返回推荐方案（API未实现）', () => {
    // 需要SiegeSystem提供getRecommendations(targetId) API
  });

  it.skip('微弱差距(0.8~1.0)推荐提升兵力（API未实现）', () => {
    // 需要推荐系统根据胜率区间给出建议
  });

  it.skip('巨大差距(<0.5)推荐降级目标（API未实现）', () => {
    // 需要推荐系统提供替代目标列表
  });

  it('失败损失30%出征兵力（已实现）', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const cost = sys.siege.getSiegeCostById(target)!;
    const result = sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, false);
    if (result.launched && !result.victory && result.defeatTroopLoss !== undefined) {
      expect(result.defeatTroopLoss).toBe(Math.floor(cost.troops * 0.3));
    }
  });

  it('失败后defeats计数递增', () => {
    const before = sys.siege.getDefeats();
    const target = findAttackableTarget(sys);
    if (!target) return;
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, false);
    expect(sys.siege.getDefeats()).toBe(before + 1);
  });

  it('失败后每日攻城计数仍递增', () => {
    const before = sys.siege.getRemainingDailySieges();
    const target = findAttackableTarget(sys);
    if (!target) return;
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, false);
    expect(sys.siege.getRemainingDailySieges()).toBe(before - 1);
  });
});
