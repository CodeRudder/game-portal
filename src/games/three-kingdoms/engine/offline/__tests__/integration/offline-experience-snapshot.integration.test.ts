/**
 * v9.0 离线收益集成测试 — 经验产出 + 各系统离线行为 + 资源溢出 + 预估
 *
 * 覆盖:
 *   §2.1  经验快照产出
 *   §2.2  溢出处理（有上限/无上限资源）
 *   §3.1  各系统离线效率系数
 *   §3.2  离线预估时间线
 *   §3.3  系统修正预估
 *   §3.4  自动推图离线行为
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OfflineRewardSystem,
  OfflineEstimateSystem,
  calculateOfflineSnapshot,
  applyOverflowRules,
  getSystemModifier,
  applySystemModifier,
  estimateOfflineReward,
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  SYSTEM_EFFICIENCY_MODIFIERS,
  OVERFLOW_RULES,
  RESOURCE_PROTECTIONS,
  DEFAULT_WAREHOUSE_EXPANSIONS,
  OFFLINE_TRADE_EFFICIENCY,
  MAX_OFFLINE_TRADES,
  OFFLINE_TRADE_DURATION,
} from '../../index';
import { OfflineSnapshotSystem } from '../../OfflineSnapshotSystem';
import type { Resources, ProductionRate, ResourceCap } from '../../../../../shared/types';

// ─────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────

const HOUR_S = 3600;

function zeroRes(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
}

function makeRates(overrides: Partial<ProductionRate> = {}): ProductionRate {
  return { grain: 10, gold: 5, troops: 2, mandate: 1, techPoint: 0.5, ...overrides };
}

function makeCaps(overrides: Partial<ResourceCap> = {}): ResourceCap {
  return { grain: 5000, gold: 2000, troops: 1000, mandate: null, techPoint: null, ...overrides };
}

function makeCurrentRes(overrides: Partial<Resources> = {}): Resources {
  return { grain: 100, gold: 500, troops: 50, mandate: 20, techPoint: 10, ...overrides };
}

// ─────────────────────────────────────────────
// §2.1 经验快照产出
// ─────────────────────────────────────────────

describe('§2.1 经验快照产出', () => {
  let snapshotSystem: OfflineSnapshotSystem;

  beforeEach(() => {
    const storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
    snapshotSystem = new OfflineSnapshotSystem(storage as unknown as Storage);
  });

  it('§2.1.1 快照包含资源字段', () => {
    const snap = snapshotSystem.createSnapshot({
      resources: makeCurrentRes({ grain: 500 }),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    expect(snap.resources.grain).toBe(500);
    expect(snap.resources.gold).toBe(500);
    expect(snap.resources.troops).toBe(50);
    expect(snap.resources.mandate).toBe(20);
    expect(snap.resources.techPoint).toBe(10);
  });

  it('§2.1.2 快照包含产出速率', () => {
    const rates = makeRates({ grain: 100 });
    const snap = snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: rates,
      caps: makeCaps(),
    });
    expect(snap.productionRates.grain).toBe(100);
    expect(snap.productionRates.gold).toBe(5);
  });

  it('§2.1.3 快照包含资源上限', () => {
    const caps = makeCaps({ grain: 10000 });
    const snap = snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps,
    });
    expect(snap.caps.grain).toBe(10000);
    expect(snap.caps.gold).toBeNull();
  });

  it('§2.1.4 快照深拷贝资源（修改原始不影响快照）', () => {
    const res = makeCurrentRes({ grain: 999 });
    const snap = snapshotSystem.createSnapshot({
      resources: res,
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    res.grain = 0;
    expect(snap.resources.grain).toBe(999);
  });

  it('§2.1.5 快照深拷贝产出速率', () => {
    const rates = makeRates({ gold: 42 });
    const snap = snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: rates,
      caps: makeCaps(),
    });
    rates.gold = 0;
    expect(snap.productionRates.gold).toBe(42);
  });

  it('§2.1.6 离线秒数计算', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    const seconds = snapshotSystem.getOfflineSeconds();
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThan(5);
  });

  it('§2.1.7 快照有效期72h内有效', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    expect(snapshotSystem.isSnapshotValid()).toBe(true);
  });

  it('§2.1.8 清除快照后失效', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    snapshotSystem.clearSnapshot();
    expect(snapshotSystem.isSnapshotValid()).toBe(false);
    expect(snapshotSystem.getOfflineSeconds()).toBe(0);
  });
});

// ─────────────────────────────────────────────
// §2.2 溢出处理
// ─────────────────────────────────────────────

describe('§2.2 溢出处理', () => {
  it('§2.2.1 有上限资源：收益未超上限时全额发放', () => {
    const earned: Resources = { grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const caps: ResourceCap = { grain: 1000, gold: 2000, troops: 500, mandate: null, techPoint: null };
    const { cappedEarned, overflowResources } = applyOverflowRules(earned, current, caps);
    expect(cappedEarned.grain).toBe(100);
    expect(overflowResources.grain).toBe(0);
  });

  it('§2.2.2 有上限资源：收益超出上限时截断', () => {
    const earned: Resources = { grain: 5000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const current: Resources = { grain: 4800, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const caps: ResourceCap = { grain: 5000, gold: 2000, troops: 500, mandate: null, techPoint: null };
    const { cappedEarned, overflowResources } = applyOverflowRules(earned, current, caps);
    expect(cappedEarned.grain).toBe(200); // 5000 - 4800
    expect(overflowResources.grain).toBe(4800); // 5000 - 200
  });

  it('§2.2.3 无上限资源（gold:null）永不截断', () => {
    const earned: Resources = { grain: 0, gold: 999999, troops: 0, mandate: 0, techPoint: 0 };
    const current: Resources = { grain: 0, gold: 999999, troops: 0, mandate: 0, techPoint: 0 };
    const caps: ResourceCap = { grain: 5000, gold: 2000, troops: 500, mandate: null, techPoint: null };
    const { cappedEarned, overflowResources } = applyOverflowRules(earned, current, caps);
    expect(cappedEarned.gold).toBe(999999);
    expect(overflowResources.gold).toBe(0);
  });

  it('§2.2.4 无上限资源（mandate:null）永不截断', () => {
    const earned: Resources = { grain: 0, gold: 0, troops: 0, mandate: 50000, techPoint: 0 };
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 50000, techPoint: 0 };
    const caps: ResourceCap = { grain: 5000, gold: 2000, troops: 500, mandate: null, techPoint: null };
    const { cappedEarned, overflowResources } = applyOverflowRules(earned, current, caps);
    expect(cappedEarned.mandate).toBe(50000);
    expect(overflowResources.mandate).toBe(0);
  });

  it('§2.2.5 仓库已满时收益全部溢出', () => {
    const earned: Resources = { grain: 1000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const current: Resources = { grain: 5000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const caps: ResourceCap = { grain: 5000, gold: 2000, troops: 500, mandate: null, techPoint: null };
    const { cappedEarned, overflowResources } = applyOverflowRules(earned, current, caps);
    expect(cappedEarned.grain).toBe(0);
    expect(overflowResources.grain).toBe(1000);
  });

  it('§2.2.6 溢出规则配置正确', () => {
    expect(OVERFLOW_RULES.length).toBeGreaterThanOrEqual(4);
    const grainRule = OVERFLOW_RULES.find(r => r.resourceType === 'grain');
    expect(grainRule).toBeDefined();
    const goldRule = OVERFLOW_RULES.find(r => r.resourceType === 'gold');
    expect(goldRule).toBeDefined();
  });

  it('§2.2.7 资源保护配置正确', () => {
    expect(RESOURCE_PROTECTIONS.length).toBeGreaterThanOrEqual(3);
    const grainProt = RESOURCE_PROTECTIONS.find(p => p.resourceType === 'grain');
    expect(grainProt!.protectionRatio).toBe(0.3);
    expect(grainProt!.protectionFloor).toBe(100);
  });

  it('§2.2.8 OfflineRewardSystem溢出处理与引擎一致', () => {
    const sys = new OfflineRewardSystem();
    sys.reset();
    const earned: Resources = { grain: 5000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const current: Resources = { grain: 4800, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const caps: Record<string, number | null> = { grain: 5000, gold: 2000, troops: 500, mandate: null, techPoint: null };
    const sysResult = sys.applyCapAndOverflow(earned, current, caps);
    const engineResult = applyOverflowRules(earned, current, caps as ResourceCap);
    expect(sysResult.cappedEarned.grain).toBe(engineResult.cappedEarned.grain);
    expect(sysResult.overflowResources.grain).toBe(engineResult.overflowResources.grain);
  });
});

// ─────────────────────────────────────────────
// §3.1 各系统离线效率系数
// ─────────────────────────────────────────────

describe('§3.1 各系统离线效率系数', () => {
  it('§3.1.1 系统效率修正配置包含7个系统', () => {
    expect(SYSTEM_EFFICIENCY_MODIFIERS.length).toBe(7);
  });

  it('§3.1.2 资源产出效率100%', () => {
    expect(getSystemModifier('resource')).toBe(1.0);
  });

  it('§3.1.3 建筑产出效率120%', () => {
    expect(getSystemModifier('building')).toBe(1.2);
  });

  it('§3.1.4 科技研究效率100%', () => {
    expect(getSystemModifier('tech')).toBe(1.0);
  });

  it('§3.1.5 远征系统效率85%', () => {
    expect(getSystemModifier('expedition')).toBe(0.85);
  });

  it('§3.1.6 贸易路线效率80%', () => {
    expect(getSystemModifier('Trade')).toBe(0.8);
  });

  it('§3.1.7 武将训练效率50%', () => {
    expect(getSystemModifier('hero')).toBe(0.5);
  });

  it('§3.1.8 关卡扫荡效率40%', () => {
    expect(getSystemModifier('campaign')).toBe(0.4);
  });

  it('§3.1.9 未知系统默认效率100%', () => {
    expect(getSystemModifier('unknown_system')).toBe(1.0);
  });

  it('§3.1.10 applySystemModifier正确应用系数', () => {
    const earned: Resources = { grain: 1000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const modified = applySystemModifier(earned, 'building');
    expect(modified.grain).toBe(1200);
  });

  it('§3.1.11 OfflineRewardSystem系统修正与引擎一致', () => {
    const sys = new OfflineRewardSystem();
    sys.reset();
    const earned: Resources = { grain: 1000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const sysModified = sys.applySystemModifier(earned, 'expedition');
    const engineModified = applySystemModifier(earned, 'expedition');
    expect(sysModified.grain).toBe(engineModified.grain);
  });

  it('§3.1.12 系统修正系数在合理范围(0.1~2.0)', () => {
    for (const mod of SYSTEM_EFFICIENCY_MODIFIERS) {
      expect(mod.modifier).toBeGreaterThanOrEqual(0.1);
      expect(mod.modifier).toBeLessThanOrEqual(2.0);
    }
  });
});

// ─────────────────────────────────────────────
// §3.2 离线预估时间线
// ─────────────────────────────────────────────

describe('§3.2 离线预估时间线', () => {
  let estimateSystem: OfflineEstimateSystem;

  beforeEach(() => {
    estimateSystem = new OfflineEstimateSystem();
  });

  it('§3.2.1 预估时间线包含7个时间点', () => {
    const result = estimateSystem.estimate(makeRates());
    expect(result.timeline).toHaveLength(7);
  });

  it('§3.2.2 预估时间点为1/2/4/8/24/48/72h', () => {
    const result = estimateSystem.estimate(makeRates());
    const hours = result.timeline.map(p => p.hours);
    expect(hours).toEqual([1, 2, 4, 8, 24, 48, 72]);
  });

  it('§3.2.3 预估收益随时间增长', () => {
    const result = estimateSystem.estimate(makeRates({ grain: 100 }));
    for (let i = 1; i < result.timeline.length; i++) {
      expect(result.timeline[i].earned.grain).toBeGreaterThan(result.timeline[i - 1].earned.grain);
    }
  });

  it('§3.2.4 预估效率随时间递减', () => {
    const result = estimateSystem.estimate(makeRates());
    for (let i = 1; i < result.timeline.length; i++) {
      expect(result.timeline[i].efficiency).toBeLessThanOrEqual(result.timeline[i - 1].efficiency);
    }
  });

  it('§3.2.5 推荐下线时长效率≥50%', () => {
    const result = estimateSystem.estimate(makeRates());
    const recommendedPoint = result.timeline.find(p => p.hours === result.recommendedHours);
    expect(recommendedPoint).toBeDefined();
    expect(recommendedPoint!.efficiency).toBeGreaterThanOrEqual(0.5);
  });

  it('§3.2.6 estimateForHours指定小时数', () => {
    const point = estimateSystem.estimateForHours(5, makeRates({ grain: 100 }));
    expect(point.hours).toBe(5);
    expect(point.earned.grain).toBeGreaterThan(0);
  });

  it('§3.2.7 estimateForHours超过72h封顶', () => {
    const point = estimateSystem.estimateForHours(100, makeRates());
    expect(point.hours).toBe(72);
  });

  it('§3.2.8 estimateForHours带系统修正', () => {
    const rates = makeRates({ grain: 100 });
    const base = estimateSystem.estimateForHours(8, rates);
    const building = estimateSystem.estimateForHours(8, rates, 'building');
    expect(building.earned.grain).toBeCloseTo(base.earned.grain * 1.2, 0);
  });
});

// ─────────────────────────────────────────────
// §3.3 系统修正预估
// ─────────────────────────────────────────────

describe('§3.3 系统修正预估', () => {
  let estimateSystem: OfflineEstimateSystem;

  beforeEach(() => {
    estimateSystem = new OfflineEstimateSystem();
  });

  it('§3.3.1 系统修正预估包含所有系统', () => {
    const result = estimateSystem.estimate(makeRates());
    for (const mod of SYSTEM_EFFICIENCY_MODIFIERS) {
      expect(result.systemEstimates[mod.systemId]).toBeDefined();
      expect(result.systemEstimates[mod.systemId]).toHaveLength(7);
    }
  });

  it('§3.3.2 建筑系统预估收益高于基础', () => {
    const result = estimateSystem.estimate(makeRates({ grain: 100 }));
    const baseGrain = result.timeline[3].earned.grain; // 8h
    const buildingGrain = result.systemEstimates['building'][3].earned.grain;
    expect(buildingGrain).toBeCloseTo(baseGrain * 1.2, 0);
  });

  it('§3.3.3 远征系统预估收益低于基础', () => {
    const result = estimateSystem.estimate(makeRates({ grain: 100 }));
    const baseGrain = result.timeline[3].earned.grain;
    const expeditionGrain = result.systemEstimates['expedition'][3].earned.grain;
    expect(expeditionGrain).toBeCloseTo(baseGrain * 0.85, 0);
  });

  it('§3.3.4 关卡扫荡预估收益最低', () => {
    const result = estimateSystem.estimate(makeRates({ grain: 100 }));
    const campaignGrain = result.systemEstimates['campaign'][3].earned.grain;
    const resourceGrain = result.systemEstimates['resource'][3].earned.grain;
    expect(campaignGrain).toBeLessThan(resourceGrain);
  });

  it('§3.3.5 效率曲线数据点完整', () => {
    const curve = estimateSystem.getEfficiencyCurve(72);
    expect(curve).toHaveLength(72);
    expect(curve[0].hours).toBe(1);
    expect(curve[71].hours).toBe(72);
  });

  it('§3.3.6 效率曲线单调递减', () => {
    const curve = estimateSystem.getEfficiencyCurve(72);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].efficiency).toBeLessThanOrEqual(curve[i - 1].efficiency);
    }
  });
});

// ─────────────────────────────────────────────
// §3.4 自动推图离线行为
// ─────────────────────────────────────────────

describe('§3.4 自动推图离线行为', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§3.4.1 关卡扫荡离线效率40%', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const snap = calculateOfflineSnapshot(HOUR_S * 2, rates, {});
    const modified = applySystemModifier(snap.totalEarned, 'campaign');
    expect(modified.grain).toBe(Math.floor(snap.totalEarned.grain * 0.4));
  });

  it('§3.4.2 推图收益受衰减影响', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const snap2h = calculateOfflineSnapshot(HOUR_S * 2, rates, {});
    const snap10h = calculateOfflineSnapshot(HOUR_S * 10, rates, {});
    const mod2h = applySystemModifier(snap2h.totalEarned, 'campaign');
    const mod10h = applySystemModifier(snap10h.totalEarned, 'campaign');
    // 10h收益 > 2h收益（即使效率更低，总时长更多）
    expect(mod10h.grain).toBeGreaterThan(mod2h.grain);
  });

  it('§3.4.3 推图+加成组合', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const snap = calculateOfflineSnapshot(HOUR_S * 2, rates, { tech: 0.3 });
    const modified = applySystemModifier(snap.totalEarned, 'campaign');
    const expected = Math.floor(snap.totalEarned.grain * 0.4);
    expect(modified.grain).toBe(expected);
  });

  it('§3.4.4 完整推图离线收益计算', () => {
    const result = rewardSystem.calculateFullReward(
      HOUR_S * 10,
      makeRates({ grain: 100 }),
      makeCurrentRes(),
      makeCaps({ grain: 999999 }),
      0,
      'campaign',
    );
    // campaign × 0.4
    const expected = Math.floor(result.snapshot.totalEarned.grain * 0.4);
    expect(result.systemModifiedEarned.grain).toBe(expected);
  });

  it('§3.4.5 离线贸易配置正确', () => {
    expect(OFFLINE_TRADE_EFFICIENCY).toBe(0.6);
    expect(MAX_OFFLINE_TRADES).toBe(3);
    expect(OFFLINE_TRADE_DURATION).toBe(3600);
  });

  it('§3.4.6 离线贸易收益计算', () => {
    const profitPerRun: Resources = { grain: 0, gold: 100, troops: 0, mandate: 0, techPoint: 0 };
    const summary = rewardSystem.simulateOfflineTrade(HOUR_S * 5, profitPerRun);
    // 5h = 18000s, 18000/3600 = 5 trades, capped at 3
    expect(summary.completedTrades).toBe(3);
    expect(summary.totalProfit.gold).toBe(3 * Math.floor(100 * 0.6));
  });

  it('§3.4.7 离线时间不足1h无贸易', () => {
    const profitPerRun: Resources = { grain: 0, gold: 100, troops: 0, mandate: 0, techPoint: 0 };
    const summary = rewardSystem.simulateOfflineTrade(1800, profitPerRun);
    expect(summary.completedTrades).toBe(0);
    expect(summary.totalProfit.gold).toBe(0);
  });

  it('§3.4.8 estimateOfflineReward预估正确', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const estimate = estimateOfflineReward(3, rates, {});
    // 3h: tier1(2h×100%) + tier2(1h×80%)
    const expectedGrain = Math.floor(100 * 7200 * 1.0 + 100 * 3600 * 0.8);
    expect(estimate.totalEarned.grain).toBe(expectedGrain);
  });

  it('§3.4.9 estimateOfflineReward超过72h封顶', () => {
    const rates = makeRates();
    const estimate = estimateOfflineReward(100, rates, {});
    expect(estimate.isCapped).toBe(true);
    expect(estimate.offlineSeconds).toBe(MAX_OFFLINE_SECONDS);
  });
});
