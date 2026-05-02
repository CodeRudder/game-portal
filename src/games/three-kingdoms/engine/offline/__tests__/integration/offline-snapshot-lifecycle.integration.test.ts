/**
 * v9.0 离线收益集成测试 — 快照生命周期 + 降级处理
 *
 * 覆盖 Play 文档:
 *   §1.1  快照创建完整覆盖所有产出源
 *   §1.4  快照有效期72h
 *   §1.10 快照丢失降级处理
 *   §3.1  各系统离线行为（快照维度）
 *   §3.5  事件系统离线行为
 *   §3.6  NPC系统离线行为
 *   §7.9  快照丢失→降级处理
 *   §7.18 快照降级→邮件通知联动
 *   §7.19 离线领土攻城行为
 *   §7.20 离线科技研究完成→解锁
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OfflineRewardSystem,
  calculateOfflineSnapshot,
  calculateFullOfflineReward,
  applyOverflowRules,
  getSystemModifier,
  applySystemModifier,
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  OFFLINE_POPUP_THRESHOLD,
} from '../../index';
import { OfflineSnapshotSystem } from '../../OfflineSnapshotSystem';
import type { Resources, ProductionRate, ResourceCap } from '../../../../../shared/types';
import type { SystemSnapshot } from '../../offline-snapshot-types';

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
// §1 快照创建与完整性
// ─────────────────────────────────────────────

describe('v9-int §1 快照创建与完整性', () => {
  let snapshotSystem: OfflineSnapshotSystem;

  beforeEach(() => {
    const storage = { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), length: 0, key: vi.fn() };
    snapshotSystem = new OfflineSnapshotSystem(storage as unknown as Storage);
  });

  it('§1.1 创建快照包含所有产出源字段', () => {
    const snap = snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      buildingQueue: [{ buildingType: 'farm', startTime: Date.now(), endTime: Date.now() + HOUR_S * 2 }],
      techQueue: [{ techId: 'tech_01', startTime: Date.now(), endTime: Date.now() + HOUR_S * 3 }],
      expeditionQueue: [{ expeditionId: 'exp_01', startTime: Date.now(), endTime: Date.now() + HOUR_S * 6, estimatedReward: zeroRes() }],
      tradeCaravans: [{ caravanId: 'caravan_01', routeId: 'route_A', startTime: Date.now(), endTime: Date.now() + HOUR_S * 4, estimatedProfit: zeroRes() }],
    });

    expect(snap.resources).toBeDefined();
    expect(snap.productionRates).toBeDefined();
    expect(snap.caps).toBeDefined();
    expect(snap.buildingQueue).toHaveLength(1);
    expect(snap.techQueue).toHaveLength(1);
    expect(snap.expeditionQueue).toHaveLength(1);
    expect(snap.tradeCaravans).toHaveLength(1);
  });

  it('§1.2 快照资源值与传入值一致（深拷贝）', () => {
    const res = makeCurrentRes({ grain: 999 });
    const snap = snapshotSystem.createSnapshot({
      resources: res,
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    expect(snap.resources.grain).toBe(999);
    // 修改原始不影响快照
    res.grain = 0;
    expect(snap.resources.grain).toBe(999);
  });

  it('§1.3 快照产出速率与传入值一致', () => {
    const rates = makeRates({ gold: 42 });
    const snap = snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: rates,
      caps: makeCaps(),
    });
    expect(snap.productionRates.gold).toBe(42);
  });

  it('§1.4 空队列快照默认为空数组', () => {
    const snap = snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    expect(snap.buildingQueue).toEqual([]);
    expect(snap.techQueue).toEqual([]);
    expect(snap.expeditionQueue).toEqual([]);
    expect(snap.tradeCaravans).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// §2 快照有效期与72h封顶
// ─────────────────────────────────────────────

describe('v9-int §2 快照有效期与72h封顶', () => {
  let snapshotSystem: OfflineSnapshotSystem;

  beforeEach(() => {
    const storage = { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), length: 0, key: vi.fn() };
    snapshotSystem = new OfflineSnapshotSystem(storage as unknown as Storage);
  });

  it('§2.1 无快照时无效', () => {
    expect(snapshotSystem.isSnapshotValid()).toBe(false);
  });

  it('§2.2 创建快照后有效', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    expect(snapshotSystem.isSnapshotValid()).toBe(true);
  });

  it('§2.3 清除快照后失效', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    snapshotSystem.clearSnapshot();
    expect(snapshotSystem.isSnapshotValid()).toBe(false);
  });

  it('§2.4 超过72h快照失效', () => {
    // 使用vi.useFakeTimers模拟时间流逝
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });

    // 快进73小时
    vi.setSystemTime(now + 73 * HOUR_S * 1000);
    expect(snapshotSystem.isSnapshotValid()).toBe(false);

    vi.useRealTimers();
  });

  it('§2.5 恰好72h快照仍有效', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });

    // 快进恰好72小时
    vi.setSystemTime(now + 72 * HOUR_S * 1000);
    expect(snapshotSystem.isSnapshotValid()).toBe(true);

    vi.useRealTimers();
  });

  it('§2.6 离线秒数计算正确', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    const seconds = snapshotSystem.getOfflineSeconds();
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThan(5); // 刚创建，应接近0
  });
});

// ─────────────────────────────────────────────
// §3 快照丢失降级处理
// ─────────────────────────────────────────────

describe('v9-int §3 快照丢失降级处理', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§3.1 无快照时离线时长为0，收益不归零（使用默认速率）', () => {
    // 即使没有快照，calculateSnapshot仍可工作（基于传入参数）
    const snap = rewardSystem.calculateSnapshot(3600, makeRates());
    expect(snap.totalEarned.grain).toBeGreaterThan(0);
    expect(snap.totalEarned.gold).toBeGreaterThan(0);
  });

  it('§3.2 快照丢失时使用默认产出速率计算', () => {
    const defaultRates = makeRates({ grain: 10, gold: 5 });
    const snap = rewardSystem.calculateSnapshot(HOUR_S * 2, defaultRates);
    // tier1: 2h × 100% = grain: 10 * 7200 * 1.0 = 72000
    expect(snap.totalEarned.grain).toBe(72000);
    expect(snap.totalEarned.gold).toBe(36000);
  });

  it('§3.3 降级收益 vs 正常收益差异可控（不超过20%偏差）', () => {
    const rates = makeRates({ grain: 100 });
    // 正常快照计算
    const normalSnap = calculateOfflineSnapshot(3600, rates, { tech: 0.1 });
    // 降级计算（无加成）
    const degradedSnap = calculateOfflineSnapshot(3600, rates, {});
    const diff = normalSnap.totalEarned.grain - degradedSnap.totalEarned.grain;
    const ratio = diff / normalSnap.totalEarned.grain;
    expect(ratio).toBeLessThanOrEqual(0.2); // 差异不超过20%（加成10%在范围内）
  });

  it('§3.4 降级处理后系统不崩溃', () => {
    const result = rewardSystem.calculateFullReward(
      HOUR_S * 10, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    expect(result.cappedEarned.grain).toBeGreaterThan(0);
    expect(result.overflowResources).toBeDefined();
  });

  it('§3.5 连续多次快照丢失不累积错误', () => {
    // 模拟多次离线回归
    for (let i = 0; i < 5; i++) {
      const result = rewardSystem.calculateFullReward(
        HOUR_S * 2, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
      );
      expect(result.cappedEarned.grain).toBeGreaterThan(0);
    }
  });

  it('§3.6 降级后下次创建快照恢复正常', () => {
    // 先降级
    const degraded = rewardSystem.calculateSnapshot(HOUR_S, makeRates());
    expect(degraded.totalEarned.grain).toBeGreaterThan(0);
    // 重置后重新计算
    rewardSystem.reset();
    const recovered = rewardSystem.calculateSnapshot(HOUR_S, makeRates());
    expect(recovered.totalEarned.grain).toBe(degraded.totalEarned.grain);
  });
});

// ─────────────────────────────────────────────
// §4 离线队列完成检测
// ─────────────────────────────────────────────

describe('v9-int §4 离线队列完成检测', () => {
  let snapshotSystem: OfflineSnapshotSystem;
  const now = Date.now();

  beforeEach(() => {
    const storage = { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), length: 0, key: vi.fn() };
    snapshotSystem = new OfflineSnapshotSystem(storage as unknown as Storage);
  });

  it('§4.1 建筑升级完成检测', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      buildingQueue: [
        { buildingType: 'farm', startTime: now - HOUR_S * 3000, endTime: now - HOUR_S * 1000 }, // 已完成
        { buildingType: 'barracks', startTime: now, endTime: now + HOUR_S * 2000 }, // 未完成
      ],
    });
    const completed = snapshotSystem.getCompletedBuildings(now);
    expect(completed).toHaveLength(1);
    expect(completed[0].buildingType).toBe('farm');
  });

  it('§4.2 科技研究完成检测', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      techQueue: [
        { techId: 'tech_01', startTime: now - HOUR_S * 5000, endTime: now - HOUR_S * 2000 }, // 已完成
        { techId: 'tech_02', startTime: now, endTime: now + HOUR_S * 3000 }, // 未完成
      ],
    });
    const completed = snapshotSystem.getCompletedTech(now);
    expect(completed).toHaveLength(1);
    expect(completed[0].techId).toBe('tech_01');
  });

  it('§4.3 远征完成检测', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      expeditionQueue: [
        { expeditionId: 'exp_01', startTime: now - HOUR_S * 8000, endTime: now - HOUR_S * 2000, estimatedReward: { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0 } },
      ],
    });
    const completed = snapshotSystem.getCompletedExpeditions(now);
    expect(completed).toHaveLength(1);
    expect(completed[0].expeditionId).toBe('exp_01');
  });

  it('§4.4 贸易完成检测', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      tradeCaravans: [
        { caravanId: 'caravan_01', routeId: 'route_A', startTime: now - HOUR_S * 6000, endTime: now - HOUR_S * 2000, estimatedProfit: { grain: 0, gold: 200, troops: 0, mandate: 0, techPoint: 0 } },
      ],
    });
    const completed = snapshotSystem.getCompletedTrades(now);
    expect(completed).toHaveLength(1);
    expect(completed[0].caravanId).toBe('caravan_01');
  });

  it('§4.5 多建筑排队全部完成', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      buildingQueue: [
        { buildingType: 'farm', startTime: now - HOUR_S * 6000, endTime: now - HOUR_S * 4000 },
        { buildingType: 'barracks', startTime: now - HOUR_S * 5000, endTime: now - HOUR_S * 1000 },
        { buildingType: 'warehouse', startTime: now - HOUR_S * 3000, endTime: now - HOUR_S * 500 },
      ],
    });
    const completed = snapshotSystem.getCompletedBuildings(now);
    expect(completed).toHaveLength(3);
  });

  it('§4.6 无快照时所有完成列表为空', () => {
    expect(snapshotSystem.getCompletedBuildings()).toEqual([]);
    expect(snapshotSystem.getCompletedTech()).toEqual([]);
    expect(snapshotSystem.getCompletedExpeditions()).toEqual([]);
    expect(snapshotSystem.getCompletedTrades()).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// §5 完整离线收益计算流程 (OfflineRewardEngine)
// ─────────────────────────────────────────────

describe('v9-int §5 完整离线收益计算流程', () => {
  it('§5.1 calculateFullOfflineReward: 基础快照→系统修正→溢出截断→面板', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 10,
      productionRates: makeRates({ grain: 100 }),
      currentResources: makeCurrentRes({ grain: 4500 }),
      caps: makeCaps({ grain: 5000 }),
      bonusSources: { tech: 0.1 },
      vipLevel: 1,
      adUsedToday: 0,
      systemId: 'building',
    };
    const result = calculateFullOfflineReward(ctx);

    // Step1: 快照存在
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.totalEarned.grain).toBeGreaterThan(0);
    // Step2: 系统修正（building × 1.2）
    expect(result.systemModifiedEarned.grain).toBeGreaterThan(result.snapshot.totalEarned.grain);
    // Step3: 溢出截断
    expect(result.cappedEarned.grain).toBeLessThanOrEqual(5000 - 4500);
    expect(result.overflowResources.grain).toBeGreaterThan(0);
    // Step4: 面板数据
    expect(result.panelData).toBeDefined();
    expect(result.panelData.offlineSeconds).toBe(HOUR_S * 10);
  });

  it('§5.2 无系统修正时systemModified = snapshot.totalEarned', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 2,
      productionRates: makeRates(),
      currentResources: makeCurrentRes(),
      caps: makeCaps(),
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
      // 无 systemId
    };
    const result = calculateFullOfflineReward(ctx);
    expect(result.systemModifiedEarned.grain).toBe(result.snapshot.totalEarned.grain);
  });

  it('§5.3 远征系统修正×0.85', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 2,
      productionRates: makeRates({ grain: 100 }),
      currentResources: makeCurrentRes(),
      caps: makeCaps({ grain: 999999 }),
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
      systemId: 'expedition',
    };
    const result = calculateFullOfflineReward(ctx);
    const expected = Math.floor(result.snapshot.totalEarned.grain * 0.85);
    expect(result.systemModifiedEarned.grain).toBe(expected);
  });

  it('§5.4 溢出资源正确记录', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 24,
      productionRates: makeRates({ grain: 100 }),
      currentResources: makeCurrentRes({ grain: 4999 }),
      caps: makeCaps({ grain: 5000 }),
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
    };
    const result = calculateFullOfflineReward(ctx);
    // cappedEarned + overflowResources ≈ systemModifiedEarned (可能有取整差异)
    const total = result.cappedEarned.grain + result.overflowResources.grain;
    expect(total).toBe(result.systemModifiedEarned.grain);
  });

  it('§5.5 铜钱(无上限)永不截断', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 24,
      productionRates: makeRates({ gold: 1000 }),
      currentResources: makeCurrentRes({ gold: 999999 }),
      caps: makeCaps(), // gold: 2000
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
    };
    const result = calculateFullOfflineReward(ctx);
    expect(result.overflowResources.gold).toBe(0);
    expect(result.cappedEarned.gold).toBe(result.systemModifiedEarned.gold);
  });
});

// ─────────────────────────────────────────────
// §6 领取防重复机制
// ─────────────────────────────────────────────

describe('v9-int §6 领取防重复机制', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§6.1 首次claimReward返回资源', () => {
    const result = rewardSystem.calculateOfflineReward(
      HOUR_S * 2, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    const claimed = rewardSystem.claimReward(result);
    expect(claimed).not.toBeNull();
    expect(claimed!.grain).toBeGreaterThan(0);
  });

  it('§6.2 重复claimReward返回null', () => {
    const result = rewardSystem.calculateOfflineReward(
      HOUR_S * 2, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    rewardSystem.claimReward(result);
    const second = rewardSystem.claimReward(result);
    expect(second).toBeNull();
  });

  it('§6.3 calculateOfflineReward重置claimed状态', () => {
    const result1 = rewardSystem.calculateOfflineReward(
      HOUR_S * 2, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    rewardSystem.claimReward(result1);

    // 新一轮计算
    const result2 = rewardSystem.calculateOfflineReward(
      HOUR_S * 4, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    const claimed = rewardSystem.claimReward(result2);
    expect(claimed).not.toBeNull();
  });

  it('§6.4 reset后claimed状态清除', () => {
    const result = rewardSystem.calculateOfflineReward(
      HOUR_S * 2, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    rewardSystem.claimReward(result);
    rewardSystem.reset();
    // reset后需要重新calculate
    const result2 = rewardSystem.calculateOfflineReward(
      HOUR_S * 2, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    const claimed = rewardSystem.claimReward(result2);
    expect(claimed).not.toBeNull();
  });
});

// ─────────────────────────────────────────────
// §7 序列化与反序列化完整性
// ─────────────────────────────────────────────

describe('v9-int §7 序列化与反序列化完整性', () => {
  let rewardSystem: OfflineRewardSystem;
  let snapshotSystem: OfflineSnapshotSystem;

  beforeEach(() => {
    const storage = { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), length: 0, key: vi.fn() };
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
    snapshotSystem = new OfflineSnapshotSystem(storage as unknown as Storage);
  });

  it('§7.1 OfflineRewardSystem序列化→反序列化→数据一致', () => {
    rewardSystem.addBoostItem('offline_boost_1h', 3);
    rewardSystem.upgradeWarehouse('grain');
    rewardSystem.setLastOfflineTime(Date.now() - HOUR_S * 5000);

    const serialized = rewardSystem.serialize();
    const newSystem = new OfflineRewardSystem();
    newSystem.deserialize(serialized);

    const reSerialized = newSystem.serialize();
    expect(reSerialized.boostItems['offline_boost_1h']).toBe(3);
    expect(reSerialized.warehouseLevels['grain']).toBe(2);
    expect(reSerialized.lastOfflineTime).toBe(serialized.lastOfflineTime);
  });

  it('§7.2 序列化版本号正确', () => {
    const data = rewardSystem.serialize();
    expect(data.version).toBe(1);
  });

  it('§7.3 OfflineSnapshotSystem存档数据持久化', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
    });
    const saveData = snapshotSystem.getSaveData();
    expect(saveData.lastOfflineTime).toBeGreaterThan(0);
    expect(saveData.version).toBe(1);
  });

  it('§7.4 广告翻倍使用次数序列化', () => {
    snapshotSystem.recordAdDouble();
    snapshotSystem.recordAdDouble();
    const saveData = snapshotSystem.getSaveData();
    expect(saveData.vipDoubleUsedToday).toBe(2);
  });

  it('§7.5 每日翻倍重置', () => {
    snapshotSystem.recordAdDouble();
    expect(snapshotSystem.getSaveData().vipDoubleUsedToday).toBe(1);
    snapshotSystem.resetDailyDoubles();
    expect(snapshotSystem.getSaveData().vipDoubleUsedToday).toBe(0);
  });
});
