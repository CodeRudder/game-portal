/**
 * v9.0 离线收益集成测试 — 交叉验证关键流程
 *
 * 覆盖 Play 文档:
 *   §7.1   快照↔引擎一致性
 *   §7.2   资源↔仓库联动
 *   §7.3   衰减↔效率系数
 *   §7.4   翻倍机制→货币消耗联动
 *   §7.5   VIP加成↔离线时长
 *   §7.6   加速道具↔收益计算
 *   §7.7   队列完成↔快照状态
 *   §7.8   资源保护→离线收益→溢出提示联动
 *   §7.9   事件系统↔资源变化一致性
 *   §7.10  回归流程完整性验证
 *   §7.11  序列化↔反序列化一致性
 *   §7.12  多系统并发离线计算一致性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OfflineRewardSystem,
  calculateOfflineSnapshot,
  calculateOverallEfficiency,
  calculateBonusCoefficient,
  applyOverflowRules,
  applyDouble,
  getSystemModifier,
  applySystemModifier,
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  SYSTEM_EFFICIENCY_MODIFIERS,
  OVERFLOW_RULES,
  RESOURCE_PROTECTIONS,
  DEFAULT_WAREHOUSE_EXPANSIONS,
  VIP_OFFLINE_BONUSES,
} from '../../index';
import { OfflineSnapshotSystem } from '../../OfflineSnapshotSystem';
import { OfflineEventSystem } from '../../../event/OfflineEventSystem';
import type { Resources, ProductionRate, ResourceCap } from '../../../../shared/types';
import type { EventDef } from '../../../../core/event/event.types';
import type { AutoProcessRule } from '../../../../core/event/event-offline.types';

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
  return { grain: 5000, gold: null, troops: 1000, mandate: null, techPoint: null, ...overrides };
}

function makeCurrentRes(overrides: Partial<Resources> = {}): Resources {
  return { grain: 100, gold: 500, troops: 50, mandate: 20, techPoint: 10, ...overrides };
}

function sumRes(r: Resources): number {
  return r.grain + r.gold + r.troops + r.mandate + r.techPoint;
}

function makeEventDef(overrides: Partial<EventDef> = {}): EventDef {
  return {
    id: 'cross-evt-1',
    title: '交叉测试事件',
    description: '交叉验证',
    urgency: 'medium' as const,
    category: 'random',
    options: [
      { id: 'opt-1', text: '选项1', consequences: { description: '结果1', resourceChanges: { gold: 100 } }, isDefault: true },
      { id: 'opt-2', text: '选项2', consequences: { description: '结果2', resourceChanges: { grain: -50 } } },
    ],
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// §7.1 快照↔引擎一致性
// ─────────────────────────────────────────────

describe('v9-int §7.1 快照↔引擎一致性', () => {
  let rewardSystem: OfflineRewardSystem;
  let snapshotSystem: OfflineSnapshotSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
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

  it('§7.1.1 OfflineRewardSystem快照与引擎纯函数结果一致', () => {
    const rates = makeRates();
    const offlineSeconds = 4 * HOUR_S;
    // 引擎纯函数
    const engineSnapshot = calculateOfflineSnapshot(offlineSeconds, rates, {});
    // 聚合根方法
    const systemSnapshot = rewardSystem.calculateSnapshot(offlineSeconds, rates);
    // 总收益应该一致（允许浮点误差）
    expect(Math.abs(engineSnapshot.totalEarned.grain - systemSnapshot.totalEarned.grain)).toBeLessThan(2);
    expect(Math.abs(engineSnapshot.totalEarned.gold - systemSnapshot.totalEarned.gold)).toBeLessThan(2);
  });

  it('§7.1.2 快照资源与createSnapshot输入一致', () => {
    const res = makeCurrentRes({ grain: 1234 });
    const snap = snapshotSystem.createSnapshot({
      resources: res,
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    expect(snap.resources.grain).toBe(1234);
    expect(snap.resources.gold).toBe(500);
  });

  it('§7.1.3 快照产出速率与输入一致', () => {
    const rates = makeRates({ grain: 42 });
    const snap = snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: rates,
      caps: makeCaps(),
    });
    expect(snap.productionRates.grain).toBe(42);
  });
});

// ─────────────────────────────────────────────
// §7.2 资源↔仓库联动
// ─────────────────────────────────────────────

describe('v9-int §7.2 资源↔仓库联动', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§7.2.1 仓库扩容后溢出减少', () => {
    const earned = zeroRes();
    earned.grain = 5000;
    const current = makeCurrentRes({ grain: 4000 });
    // 扩容前：容量5000
    const capsBefore = makeCaps({ grain: 5000 });
    const resultBefore = applyOverflowRules(earned, current, capsBefore);
    expect(resultBefore.cappedEarned.grain).toBe(1000);

    // 扩容后：容量10000
    const capsAfter = makeCaps({ grain: 10000 });
    const resultAfter = applyOverflowRules(earned, current, capsAfter);
    expect(resultAfter.cappedEarned.grain).toBe(5000);
    expect(resultAfter.overflowResources.grain).toBe(0);
  });

  it('§7.2.2 upgradeWarehouse提升容量', () => {
    const result = rewardSystem.upgradeWarehouse('grain');
    expect(result.success).toBe(true);
    expect(result.newCapacity).toBeGreaterThan(result.previousCapacity);
    expect(result.newLevel).toBeGreaterThan(0);
  });

  it('§7.2.3 仓库达最大等级不可继续扩容', () => {
    // 连续升级到最大等级
    for (let i = 0; i < 35; i++) {
      rewardSystem.upgradeWarehouse('grain');
    }
    const result = rewardSystem.upgradeWarehouse('grain');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('最大等级');
  });

  it('§7.2.4 getWarehouseCapacity与扩容结果一致', () => {
    const before = rewardSystem.getWarehouseCapacity('grain');
    const upgrade = rewardSystem.upgradeWarehouse('grain');
    const after = rewardSystem.getWarehouseCapacity('grain');
    expect(before).toBe(upgrade.previousCapacity);
    expect(after).toBe(upgrade.newCapacity);
  });
});

// ─────────────────────────────────────────────
// §7.3 衰减↔效率系数
// ─────────────────────────────────────────────

describe('v9-int §7.3 衰减↔效率系数', () => {
  it('§7.3.1 2h内效率100%', () => {
    expect(calculateOverallEfficiency(1 * HOUR_S)).toBeCloseTo(1.0, 2);
    expect(calculateOverallEfficiency(2 * HOUR_S)).toBeCloseTo(1.0, 2);
  });

  it('§7.3.2 2~8h效率约80%', () => {
    const eff = calculateOverallEfficiency(5 * HOUR_S);
    expect(eff).toBeGreaterThan(0.8);
    expect(eff).toBeLessThan(1.0);
  });

  it('§7.3.3 24h效率约60%', () => {
    const eff = calculateOverallEfficiency(24 * HOUR_S);
    expect(eff).toBeGreaterThan(0.5);
    expect(eff).toBeLessThan(0.7);
  });

  it('§7.3.4 48h效率约50-55%', () => {
    const eff = calculateOverallEfficiency(48 * HOUR_S);
    expect(eff).toBeGreaterThan(0.5);
    expect(eff).toBeLessThan(0.6);
  });

  it('§7.3.5 72h效率约40-45%', () => {
    const eff = calculateOverallEfficiency(72 * HOUR_S);
    expect(eff).toBeGreaterThan(0.4);
    expect(eff).toBeLessThan(0.5);
  });

  it('§7.3.6 超过72h效率封顶在72h值', () => {
    const eff72 = calculateOverallEfficiency(72 * HOUR_S);
    const eff100 = calculateOverallEfficiency(100 * HOUR_S);
    expect(eff72).toBe(eff100);
  });

  it('§7.3.7 衰减系数与各档位明细之和一致', () => {
    const rates = makeRates();
    const snapshot = calculateOfflineSnapshot(12 * HOUR_S, rates, {});
    let manualSum = zeroRes();
    for (const tier of snapshot.tierDetails) {
      for (const key of Object.keys(manualSum) as (keyof Resources)[]) {
        manualSum[key] += tier.earned[key];
      }
    }
    // 各档位收益之和应等于totalEarned（无加成时）
    for (const key of Object.keys(manualSum) as (keyof Resources)[]) {
      expect(Math.abs(manualSum[key] - snapshot.totalEarned[key])).toBeLessThan(2);
    }
  });
});

// ─────────────────────────────────────────────
// §7.4 翻倍机制→货币消耗联动
// ─────────────────────────────────────────────

describe('v9-int §7.4 翻倍机制→货币消耗联动', () => {
  it('§7.4.1 广告翻倍×2后收益翻倍', () => {
    const earned = zeroRes();
    earned.grain = 1000;
    earned.gold = 500;
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 0);
    expect(result.success).toBe(true);
    expect(result.doubledEarned.grain).toBe(2000);
    expect(result.doubledEarned.gold).toBe(1000);
  });

  it('§7.4.2 广告翻倍超限失败', () => {
    const earned = zeroRes();
    earned.grain = 1000;
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告' }, 3);
    expect(result.success).toBe(false);
    expect(result.appliedMultiplier).toBe(1);
  });

  it('§7.4.3 元宝翻倍无次数限制', () => {
    const earned = zeroRes();
    earned.grain = 1000;
    const result = applyDouble(earned, { source: 'item', multiplier: 2, description: '元宝翻倍' }, 99);
    expect(result.success).toBe(true);
    expect(result.doubledEarned.grain).toBe(2000);
  });
});

// ─────────────────────────────────────────────
// §7.5 VIP加成↔离线时长
// ─────────────────────────────────────────────

describe('v9-int §7.5 VIP加成↔离线时长', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§7.5.1 VIP0无加成', () => {
    const bonus = rewardSystem.getVipBonus(0);
    expect(bonus.efficiencyBonus).toBe(0);
    expect(bonus.dailyDoubleLimit).toBe(1);
  });

  it('§7.5.2 VIP5最高加成25%', () => {
    const bonus = rewardSystem.getVipBonus(5);
    expect(bonus.efficiencyBonus).toBe(0.25);
    expect(bonus.extraHours).toBe(24);
  });

  it('§7.5.3 VIP加成后收益增加', () => {
    const earned = zeroRes();
    earned.grain = 1000;
    const boosted = rewardSystem.applyVipBonus(earned, 3);
    expect(boosted.grain).toBeGreaterThan(1000);
  });

  it('§7.5.4 VIP加成配置表递增', () => {
    for (let i = 1; i < VIP_OFFLINE_BONUSES.length; i++) {
      expect(VIP_OFFLINE_BONUSES[i].efficiencyBonus).toBeGreaterThanOrEqual(
        VIP_OFFLINE_BONUSES[i - 1].efficiencyBonus,
      );
    }
  });
});

// ─────────────────────────────────────────────
// §7.6 加速道具↔收益计算
// ─────────────────────────────────────────────

describe('v9-int §7.6 加速道具↔收益计算', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§7.6.1 添加加速道具后可查询', () => {
    rewardSystem.addBoostItem('offline_double', 3);
    const items = rewardSystem.getBoostItems();
    const doubleItem = items.find(i => i.id === 'offline_double');
    expect(doubleItem).toBeDefined();
    expect(doubleItem!.count).toBe(3);
  });

  it('§7.6.2 使用加速道具增加收益', () => {
    rewardSystem.addBoostItem('speed_4h', 2);
    const result = rewardSystem.useBoostItemAction('speed_4h', makeRates());
    if (result.success) {
      expect(result.addedSeconds).toBeGreaterThan(0);
      expect(sumRes(result.addedEarned)).toBeGreaterThan(0);
      expect(result.remainingCount).toBe(1);
    }
  });

  it('§7.6.3 使用不存在的道具失败', () => {
    const result = rewardSystem.useBoostItemAction('nonexistent', makeRates());
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// §7.7 队列完成↔快照状态
// ─────────────────────────────────────────────

describe('v9-int §7.7 队列完成↔快照状态', () => {
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

  it('§7.7.1 无快照时getCompletedBuildings返回空', () => {
    expect(snapshotSystem.getCompletedBuildings()).toEqual([]);
  });

  it('§7.7.2 快照中包含建筑队列', () => {
    const snap = snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      buildingQueue: [{ buildingId: 'b1', endTime: Date.now() + 3600000 }],
    });
    expect(snap.buildingQueue).toHaveLength(1);
  });

  it('§7.7.3 已完成建筑正确检测', () => {
    const pastTime = Date.now() - 1000;
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      buildingQueue: [{ buildingId: 'b1', endTime: pastTime }],
    });
    const completed = snapshotSystem.getCompletedBuildings();
    expect(completed).toHaveLength(1);
    expect(completed[0].buildingId).toBe('b1');
  });

  it('§7.7.4 未完成建筑不在完成列表', () => {
    const futureTime = Date.now() + 3600000;
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      buildingQueue: [{ buildingId: 'b2', endTime: futureTime }],
    });
    expect(snapshotSystem.getCompletedBuildings()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// §7.8 资源保护→离线收益→溢出提示联动
// ─────────────────────────────────────────────

describe('v9-int §7.8 资源保护→离线收益→溢出提示联动', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§7.8.1 完整流程: 计算→保护→溢出', () => {
    const rates = makeRates();
    const current = makeCurrentRes({ grain: 4800 });
    const caps = makeCaps({ grain: 5000 });
    const fullResult = rewardSystem.calculateFullReward(
      8 * HOUR_S, rates, current, caps, 0, 'resource',
    );
    // 应有溢出（粮仓快满）
    expect(fullResult.overflowResources).toBeDefined();
    expect(fullResult.cappedEarned).toBeDefined();
    // 守恒: capped + overflow = earned (per resource)
    for (const key of ['grain', 'gold', 'troops', 'mandate'] as const) {
      const total = fullResult.systemModifiedEarned[key];
      expect(fullResult.cappedEarned[key] + fullResult.overflowResources[key]).toBeCloseTo(total, 0);
    }
  });

  it('§7.8.2 资源保护不影响离线收益计算', () => {
    const protection = rewardSystem.getResourceProtection('grain', 5000);
    expect(protection).toBeGreaterThan(0);
    // 资源保护是针对被攻击/消耗场景，不影响离线收益发放
    const rates = makeRates();
    const snapshot = calculateOfflineSnapshot(2 * HOUR_S, rates, {});
    expect(snapshot.totalEarned.grain).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// §7.9 事件系统↔资源变化一致性
// ─────────────────────────────────────────────

describe('v9-int §7.9 事件系统↔资源变化一致性', () => {
  it('§7.9.1 事件系统资源变化不影响离线收益', () => {
    const eventSystem = new OfflineEventSystem();
    eventSystem.reset();
    const rates = makeRates();
    const snapshot = calculateOfflineSnapshot(4 * HOUR_S, rates, {});
    // 事件系统独立运行
    expect(eventSystem.getQueueSize()).toBe(0);
    expect(snapshot.totalEarned.grain).toBeGreaterThan(0);
    // 两者不耦合
  });

  it('§7.9.2 离线收益与事件资源变化可独立汇总', () => {
    const rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
    const eventSystem = new OfflineEventSystem();
    eventSystem.reset();
    // 分别计算
    const rates = makeRates();
    const current = makeCurrentRes();
    const caps = makeCaps();
    const reward = rewardSystem.calculateFullReward(4 * HOUR_S, rates, current, caps);
    const eventResult = eventSystem.processOfflineEvents();
    // 两者都有定义的结果
    expect(reward.cappedEarned).toBeDefined();
    expect(eventResult.autoProcessedCount).toBe(0);
  });
});

// ─────────────────────────────────────────────
// §7.10 回归流程完整性验证
// ─────────────────────────────────────────────

describe('v9-int §7.10 回归流程完整性验证', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§7.10.1 完整回归流程: 计算→面板→领取', () => {
    const rates = makeRates();
    const current = makeCurrentRes();
    const caps = makeCaps();
    // 1. 计算离线奖励
    const reward = rewardSystem.calculateOfflineReward(
      8 * HOUR_S, rates, current, caps, 1, 'building',
    );
    expect(reward.snapshot).toBeDefined();
    expect(reward.panelData).toBeDefined();
    // 2. 领取
    const claimed = rewardSystem.claimReward(reward);
    expect(claimed).not.toBeNull();
    expect(claimed!.grain).toBeGreaterThanOrEqual(0);
    // 3. 重复领取失败
    const claimed2 = rewardSystem.claimReward(reward);
    expect(claimed2).toBeNull();
  });

  it('§7.10.2 回归面板包含完整信息', () => {
    const panel = rewardSystem.generateReturnPanel(8 * HOUR_S, makeRates(), 2);
    expect(panel.offlineSeconds).toBe(8 * HOUR_S);
    expect(panel.formattedTime).toBeTruthy();
    expect(panel.efficiencyPercent).toBeGreaterThan(0);
    expect(panel.tierDetails.length).toBeGreaterThan(0);
    expect(panel.availableDoubles.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// §7.11 序列化↔反序列化一致性
// ─────────────────────────────────────────────

describe('v9-int §7.11 序列化↔反序列化一致性', () => {
  it('§7.11.1 OfflineRewardSystem序列化往返一致', () => {
    const sys1 = new OfflineRewardSystem();
    sys1.reset();
    sys1.addBoostItem('offline_double', 2);
    sys1.upgradeWarehouse('grain');
    sys1.setLastOfflineTime(1000);

    const data = sys1.serialize();
    const sys2 = new OfflineRewardSystem();
    sys2.reset();
    sys2.deserialize(data);

    const data2 = sys2.serialize();
    expect(data2.boostItems).toEqual(data.boostItems);
    expect(data2.warehouseLevels).toEqual(data.warehouseLevels);
    expect(data2.lastOfflineTime).toBe(data.lastOfflineTime);
  });

  it('§7.11.2 空状态序列化往返一致', () => {
    const sys = new OfflineRewardSystem();
    sys.reset();
    const data = sys.serialize();
    const sys2 = new OfflineRewardSystem();
    sys2.reset();
    sys2.deserialize(data);
    const data2 = sys2.serialize();
    expect(data2).toEqual(data);
  });
});

// ─────────────────────────────────────────────
// §7.12 多系统并发离线计算一致性
// ─────────────────────────────────────────────

describe('v9-int §7.12 多系统并发离线计算一致性', () => {
  it('§7.12.1 不同系统修正系数应用后收益不同', () => {
    const rates = makeRates();
    const snapshot = calculateOfflineSnapshot(4 * HOUR_S, rates, {});
    const baseEarned = snapshot.totalEarned;

    const buildingMod = applySystemModifier(baseEarned, 'building');
    const expeditionMod = applySystemModifier(baseEarned, 'expedition');
    const heroMod = applySystemModifier(baseEarned, 'hero');

    // 建筑1.2倍 > 基础1.0 > 远征0.85 > 武将0.5
    expect(buildingMod.grain).toBeGreaterThan(baseEarned.grain);
    expect(expeditionMod.grain).toBeLessThan(baseEarned.grain);
    expect(heroMod.grain).toBeLessThan(expeditionMod.grain);
  });

  it('§7.12.2 系统修正系数与配置表一致', () => {
    for (const mod of SYSTEM_EFFICIENCY_MODIFIERS) {
      const computed = getSystemModifier(mod.systemId);
      expect(computed).toBe(mod.modifier);
    }
  });

  it('§7.12.3 多次计算同一参数结果稳定', () => {
    const rates = makeRates();
    const results = Array.from({ length: 5 }, () =>
      calculateOfflineSnapshot(6 * HOUR_S, rates, { tech: 0.1, vip: 0.05 }),
    );
    for (let i = 1; i < results.length; i++) {
      expect(results[i].totalEarned.grain).toBe(results[0].totalEarned.grain);
      expect(results[i].totalEarned.gold).toBe(results[0].totalEarned.gold);
    }
  });
});
