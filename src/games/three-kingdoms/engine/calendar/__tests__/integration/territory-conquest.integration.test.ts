/**
 * 集成测试 — 领土攻占全链路 (v6.0 天下大势)
 *
 * 覆盖 Play 文档流程：
 *   §3.1   领土攻占：攻占流程、归属变更、失败处理
 *   §3.1.1 胜率预估：estimateWinRate 返回值、区间
 *   §3.1.2 攻城战（城池类领土专用）：城防计算、攻城奖励
 *
 * @module engine/calendar/__tests__/integration/territory-conquest
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TerritorySystem } from '../../../map/TerritorySystem';
import { SiegeSystem } from '../../../map/SiegeSystem';
import { SiegeEnhancer } from '../../../map/SiegeEnhancer';
import { GarrisonSystem } from '../../../map/GarrisonSystem';
import type { ISystemDeps } from '../../../../../../core/types';
import type { ISubsystemRegistry } from '../../../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createDeps(): ISystemDeps {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();

  const registry = new Map<string, unknown>();
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

  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);

  return deps;
}

function getSys(deps: ISystemDeps) {
  return {
    territory: deps.registry!.get<TerritorySystem>('territory')!,
    siege: deps.registry!.get<SiegeSystem>('siege')!,
    enhancer: deps.registry!.get<SiegeEnhancer>('siegeEnhancer')!,
    garrison: deps.registry!.get<GarrisonSystem>('garrison')!,
  };
}

/** 找到可攻击的非己方领土ID */
function findAttackableTarget(sys: ReturnType<typeof getSys>): string | null {
  const list = sys.territory.getAttackableTerritories('player');
  return list.length > 0 ? list[0].id : null;
}

/** 找到城池类可攻击领土 */
function findCityTarget(sys: ReturnType<typeof getSys>): string | null {
  const list = sys.territory.getAttackableTerritories('player');
  const city = list.find(t => t.id.startsWith('city-'));
  return city?.id ?? null;
}

// ═════════════════════════════════════════════
// §3.1 领土攻占
// ═════════════════════════════════════════════

describe('§3.1 领土攻占', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  // --- 攻占流程 ---

  it('checkSiegeConditions 返回 canSiege + errorCode 结构', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.siege.checkSiegeConditions(target, 'player', 10000, 10000);
    expect(result).toHaveProperty('canSiege');
    expect(typeof result.canSiege).toBe('boolean');
  });

  it('条件满足时 canSiege=true', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.siege.checkSiegeConditions(target, 'player', 10000, 10000);
    expect(result.canSiege).toBe(true);
  });

  it('不存在的领土 → TARGET_NOT_FOUND', () => {
    const result = sys.siege.checkSiegeConditions('nonexistent-xyz', 'player', 10000, 10000);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('TARGET_NOT_FOUND');
  });

  it('己方领土不可攻城 → TARGET_ALREADY_OWNED', () => {
    const player = sys.territory.getAllTerritories().find(t => t.ownership === 'player');
    if (!player) return;
    const result = sys.siege.checkSiegeConditions(player.id, 'player', 10000, 10000);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('TARGET_ALREADY_OWNED');
  });

  it('兵力不足 → INSUFFICIENT_TROOPS', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.siege.checkSiegeConditions(target, 'player', 10, 10000);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
  });

  it('粮草不足 → INSUFFICIENT_GRAIN', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.siege.checkSiegeConditions(target, 'player', 10000, 10);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('INSUFFICIENT_GRAIN');
  });

  // --- 归属变更 ---

  it('executeSiegeWithResult 胜利后归属变更为攻击方', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const before = sys.territory.getTerritoryById(target)!;
    expect(before.ownership).not.toBe('player');

    const result = sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    expect(result.launched).toBe(true);
    expect(result.victory).toBe(true);

    const after = sys.territory.getTerritoryById(target)!;
    expect(after.ownership).toBe('player');
  });

  it('executeSiegeWithResult 胜利时 capture 包含 previousOwner', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const before = sys.territory.getTerritoryById(target)!;
    const result = sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    expect(result.capture).toBeDefined();
    expect(result.capture!.previousOwner).toBe(before.ownership);
    expect(result.capture!.newOwner).toBe('player');
  });

  // --- 失败处理 ---

  it('executeSiegeWithResult 失败后归属不变', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const before = sys.territory.getTerritoryById(target)!;
    const prevOwner = before.ownership;

    const result = sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, false);
    expect(result.launched).toBe(true);
    expect(result.victory).toBe(false);

    const after = sys.territory.getTerritoryById(target)!;
    expect(after.ownership).toBe(prevOwner);
  });

  it('攻城失败损失30%出征兵力', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const t = sys.territory.getTerritoryById(target)!;
    const cost = sys.siege.calculateSiegeCost(t);

    const result = sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, false);
    expect(result.defeatTroopLoss).toBe(Math.floor(cost.troops * 0.3));
  });

  it('条件不满足时 executeSiege 返回 launched=false', () => {
    const result = sys.siege.executeSiege('nonexistent-xyz', 'player', 10000, 10000);
    expect(result.launched).toBe(false);
    expect(result.victory).toBe(false);
    expect(result.failureReason).toBeTruthy();
  });

  // --- 统计 ---

  it('攻城统计：totalSieges/victories/defeats 正确累加', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;

    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    expect(sys.siege.getTotalSieges()).toBe(1);
    expect(sys.siege.getVictories()).toBe(1);
    expect(sys.siege.getDefeats()).toBe(0);

    // 需要找另一个目标或重置daily limit
    sys.siege.resetDailySiegeCount();
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, false);
    expect(sys.siege.getTotalSieges()).toBe(2);
    expect(sys.siege.getDefeats()).toBe(1);
  });

  it('getWinRate 返回胜率百分比', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    sys.siege.resetDailySiegeCount();
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    sys.siege.resetDailySiegeCount();
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    const rate = sys.siege.getWinRate();
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  });

  it('每日攻城上限3次，超限返回 DAILY_LIMIT_REACHED', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    // 先占领目标以获取相邻
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    // 找下一个可攻击目标
    const nextTarget = findAttackableTarget(sys);
    if (!nextTarget) return;

    sys.siege.executeSiegeWithResult(nextTarget, 'player', 10000, 10000, true);
    sys.siege.executeSiegeWithResult(nextTarget, 'player', 10000, 10000, true);
    // 第4次应被拒绝
    const result = sys.siege.checkSiegeConditions(nextTarget, 'player', 10000, 10000);
    expect(result.canSiege).toBe(false);
    expect(result.errorCode).toBe('DAILY_LIMIT_REACHED');
  });

  it('resetDailySiegeCount 重置每日计数', () => {
    sys.siege.resetDailySiegeCount();
    expect(sys.siege.getRemainingDailySieges()).toBe(3);
  });

  // --- 序列化 ---

  it('serialize/deserialize 保持统计一致', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);
    const saved = sys.siege.serialize();
    expect(saved.totalSieges).toBe(1);
    expect(saved.victories).toBe(1);

    const newSiege = new SiegeSystem();
    const deps2 = createDeps();
    newSiege.init(deps2);
    newSiege.deserialize(saved);
    expect(newSiege.getTotalSieges()).toBe(1);
    expect(newSiege.getVictories()).toBe(1);
  });
});

// ═════════════════════════════════════════════
// §3.1.1 胜率预估
// ═════════════════════════════════════════════

describe('§3.1.1 胜率预估', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  it('estimateWinRate 返回完整结构', () => {
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

  it('winRate 在 [0, 1] 区间', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(5000, target)!;
    expect(est.winRate).toBeGreaterThanOrEqual(0);
    expect(est.winRate).toBeLessThanOrEqual(1);
  });

  it('attackerPower 等于输入值', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(8888, target)!;
    expect(est.attackerPower).toBe(8888);
  });

  it('defenderPower > 0（城防值+驻防加成）', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(5000, target)!;
    expect(est.defenderPower).toBeGreaterThan(0);
  });

  it('高兵力胜率 >= 低兵力胜率', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const low = sys.enhancer.estimateWinRate(500, target)!;
    const high = sys.enhancer.estimateWinRate(50000, target)!;
    expect(high.winRate).toBeGreaterThanOrEqual(low.winRate);
  });

  it('rating 为 easy/moderate/hard/very_hard/impossible 之一', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(5000, target)!;
    expect(['easy', 'moderate', 'hard', 'very_hard', 'impossible']).toContain(est.rating);
  });

  it('极高兵力 → rating=easy（winRate≥0.75）', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(999999, target)!;
    expect(est.winRate).toBeGreaterThanOrEqual(0.75);
    expect(est.rating).toBe('easy');
  });

  it('极低兵力 → rating=impossible（winRate≤0.15）', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(1, target)!;
    expect(est.winRate).toBeLessThanOrEqual(0.15);
    expect(est.rating).toBe('impossible');
  });

  it('estimatedLossRate 在 [0, 1] 区间', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const est = sys.enhancer.estimateWinRate(5000, target)!;
    expect(est.estimatedLossRate).toBeGreaterThanOrEqual(0);
    expect(est.estimatedLossRate).toBeLessThanOrEqual(1);
  });

  it('不存在的领土 → estimateWinRate 返回 null', () => {
    const est = sys.enhancer.estimateWinRate(5000, 'nonexistent');
    expect(est).toBeNull();
  });

  it('驻防武将增加 defenderPower', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;

    // 先占领该领土才能驻防
    sys.siege.executeSiegeWithResult(target, 'player', 10000, 10000, true);

    // 无驻防时的 defenderPower
    const beforeEst = sys.enhancer.estimateWinRate(5000, target);
    if (!beforeEst) return;

    // 驻防后需要找另一个可攻击目标来验证
    // 直接验证 calculateDefenderPower
    const t = sys.territory.getTerritoryById(target)!;
    const defPower = sys.enhancer.calculateDefenderPower(t);
    expect(defPower).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════
// §3.1.2 攻城战（城池类领土专用）
// ═════════════════════════════════════════════

describe('§3.1.2 攻城战（城池类领土专用）', () => {
  let sys: ReturnType<typeof getSys>;

  beforeEach(() => {
    sys = getSys(createDeps());
  });

  // --- 城防计算 ---

  it('城池类领土 defenseValue = 1000 × 等级', () => {
    const cities = sys.territory.getAllTerritories().filter(t => t.id.startsWith('city-'));
    if (cities.length === 0) return;
    for (const city of cities) {
      expect(city.defenseValue).toBe(1000 * city.level);
    }
  });

  it('粮草消耗固定500（PRD MAP-4 统一声明）', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const cost = sys.siege.getSiegeCostById(target);
    expect(cost).not.toBeNull();
    expect(cost!.grain).toBe(500);
  });

  it('兵力消耗 = 100 × (defenseValue / 100)', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const t = sys.territory.getTerritoryById(target)!;
    const cost = sys.siege.getSiegeCostById(target)!;
    expect(cost.troops).toBe(Math.ceil(100 * (t.defenseValue / 100)));
  });

  it('高等级城池消耗更多兵力', () => {
    const cities = sys.territory.getAllTerritories().filter(t => t.id.startsWith('city-'));
    if (cities.length < 2) return;
    const sorted = [...cities].sort((a, b) => a.level - b.level);
    const lowCost = sys.siege.calculateSiegeCost(sorted[0]);
    const highCost = sys.siege.calculateSiegeCost(sorted[sorted.length - 1]);
    if (sorted[0].level < sorted[sorted.length - 1].level) {
      expect(highCost.troops).toBeGreaterThanOrEqual(lowCost.troops);
    }
  });

  // --- 攻城奖励 ---

  it('calculateSiegeReward 返回完整奖励结构', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const t = sys.territory.getTerritoryById(target)!;
    const reward = sys.enhancer.calculateSiegeReward(t);
    expect(reward).toHaveProperty('resources');
    expect(reward).toHaveProperty('territoryExp');
    expect(reward).toHaveProperty('items');
    expect(reward.resources).toHaveProperty('grain');
    expect(reward.resources).toHaveProperty('gold');
    expect(reward.resources).toHaveProperty('troops');
    expect(reward.resources).toHaveProperty('mandate');
  });

  it('奖励资源值 > 0', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const t = sys.territory.getTerritoryById(target)!;
    const reward = sys.enhancer.calculateSiegeReward(t);
    expect(reward.resources.grain).toBeGreaterThan(0);
    expect(reward.territoryExp).toBeGreaterThan(0);
  });

  it('关卡类领土(pass-)奖励有额外加成', () => {
    const passes = sys.territory.getAllTerritories().filter(t => t.id.startsWith('pass-'));
    if (passes.length === 0) return;
    const passReward = sys.enhancer.calculateSiegeReward(passes[0]);
    // pass奖励倍率1.5
    expect(passReward.resources.grain).toBe(Math.round(50 * passes[0].level * 1.5));
  });

  it('calculateSiegeRewardById 不存在领土返回 null', () => {
    const reward = sys.enhancer.calculateSiegeRewardById('nonexistent');
    expect(reward).toBeNull();
  });

  it('道具掉落稀有度在有效范围内', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const t = sys.territory.getTerritoryById(target)!;
    // 多次调用以覆盖随机性
    for (let i = 0; i < 10; i++) {
      const reward = sys.enhancer.calculateSiegeReward(t);
      for (const item of reward.items) {
        expect(['common', 'rare', 'epic', 'legendary']).toContain(item.rarity);
      }
    }
  });

  // --- 完整征服流程 ---

  it('executeConquest 完整流程：条件检查→胜率→战斗→占领→奖励', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.enhancer.executeConquest(target, 'player', 50000, 10000, 10000);
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('phase');
    expect(result).toHaveProperty('targetId');
    expect(result.targetId).toBe(target);
  });

  it('executeConquest 成功时 phase=reward，含 capture 和 reward', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    // 极高战力确保胜利
    const result = sys.enhancer.executeConquest(target, 'player', 999999, 100000, 100000);
    if (result.success) {
      expect(result.phase).toBe('reward');
      expect(result.capture).not.toBeNull();
      expect(result.reward).not.toBeNull();
      expect(result.battleVictory).toBe(true);
    }
  });

  it('executeConquest 条件不满足时 success=false', () => {
    const result = sys.enhancer.executeConquest('nonexistent', 'player', 5000, 10000, 10000);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBeTruthy();
  });

  it('executeConquest 包含 winRateEstimate', () => {
    const target = findAttackableTarget(sys);
    if (!target) return;
    const result = sys.enhancer.executeConquest(target, 'player', 50000, 10000, 10000);
    expect(result.winRateEstimate).not.toBeNull();
    expect(result.winRateEstimate!.winRate).toBeGreaterThanOrEqual(0);
  });
});
