/**
 * v9.0 离线收益 Play 流程集成测试 — §1~§4 离线收益核心流程
 *
 * 覆盖 play 文档章节：
 * - OFFLINE-FLOW-1: 离线收益计算（时长、产出倍率、上限）
 * - OFFLINE-FLOW-2: 离线收益领取（全额领取、双倍领取）
 * - OFFLINE-FLOW-3: 离线收益加速（广告/道具加速）
 * - OFFLINE-FLOW-4: 离线事件（随机事件触发、处理）
 * - OFFLINE-FLOW-5: 离线保护（防作弊、时间上限）
 * - OFFLINE-FLOW-6: 离线收益预览（预估显示）
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 引擎未实现的功能用 it.todo + [引擎未实现] 标注
 * - 不使用 as unknown as Record<string, unknown>
 *
 * @see docs/games/three-kingdoms/play/v9-play.md §1~§4
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { Resources } from '../../../../shared/types';
import {
  calculateOfflineSnapshot,
  calculateTierDetails,
  calculateOverallEfficiency,
  calculateBonusCoefficient,
  applyDouble,
  applyOverflowRules,
  getSystemModifier,
  applySystemModifier,
  shouldShowOfflinePopup,
  calculateFullOfflineReward,
  estimateOfflineReward,
  formatOfflineDuration,
} from '../../offline/OfflineRewardEngine';
import type { OfflineRewardContext } from '../../offline/OfflineRewardEngine';
import {
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  MAX_OFFLINE_HOURS,
  OFFLINE_POPUP_THRESHOLD,
  SYSTEM_EFFICIENCY_MODIFIERS,
  VIP_OFFLINE_BONUSES,
} from '../../offline/offline-config';
import type {
  BonusSources,
  DoubleRequest,
  OfflineSnapshot,
  TierDetail,
  OfflineRewardResultV9,
} from '../../offline/offline.types';

// ── 辅助函数 ──

const HOUR_S = 3600;

/** 创建标准产出速率用于离线测试 */
function createProductionRates(): Resources {
  return { grain: 100, gold: 50, troops: 10, mandate: 0, techPoint: 0, recruitToken: 0 };
}

/** 创建完整产出速率（含天命等） */
function createFullRates(): Resources {
  return { grain: 100, gold: 50, troops: 10, mandate: 5, techPoint: 2, recruitToken: 1 };
}

/** 创建包含上限的快照参数 */
function createSnapshotParams() {
  return {
    resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 },
    productionRates: createProductionRates(),
    caps: { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
    buildingQueue: [],
    techQueue: [],
    expeditionQueue: [],
    tradeCaravans: [],
  };
}

/** 创建包含队列的完整快照参数 */
function createFullSnapshotParams() {
  const now = Date.now();
  return {
    resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 10, recruitToken: 5 },
    productionRates: createFullRates(),
    caps: { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
    buildingQueue: [
      { buildingType: 'farmland', startTime: now, endTime: now + 7200000 },
      { buildingType: 'market', startTime: now, endTime: now + 14400000 },
    ],
    techQueue: [
      { techId: 'tech_tuntian', startTime: now, endTime: now + 10800000 },
    ],
    expeditionQueue: [
      { expeditionId: 'exp_001', startTime: now, endTime: now + 21600000, estimatedReward: { grain: 500, gold: 200, troops: 50, mandate: 0, techPoint: 0, recruitToken: 0 } },
    ],
    tradeCaravans: [
      { caravanId: 'caravan_001', routeId: 'route_001', startTime: now, endTime: now + 14400000, estimatedProfit: { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 } },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// OFFLINE-FLOW-1: 离线收益计算（时长、产出倍率、上限）
// ═══════════════════════════════════════════════════════════════
describe('OFFLINE-FLOW-1: 离线收益计算（时长、产出倍率、上限）', () => {

  // ── §1.1 离线计算核心公式 ──

  it('OFFLINE-FLOW-1.1: 基础收益 = 净产出速率 × 离线秒数（1h全效率）', () => {
    // Play §1.1: 基础收益 = 净产出速率 × 离线秒数
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(1 * HOUR_S, rates);

    // 1h 在 tier1 (0~2h, 100%效率), grain = 100 * 3600 * 1.0 = 360000
    expect(snapshot.totalEarned.grain).toBe(100 * 3600 * 1.0);
    expect(snapshot.totalEarned.gold).toBe(50 * 3600 * 1.0);
    expect(snapshot.overallEfficiency).toBeCloseTo(1.0, 4);
    expect(snapshot.isCapped).toBe(false);
  });

  it('OFFLINE-FLOW-1.1: 快照记录完整覆盖所有产出源', () => {
    // Play §1.1: 快照记录完整覆盖所有产出源
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createFullSnapshotParams());
    const snapshot = snapshotSys.getSnapshot();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.resources).toBeDefined();
    expect(snapshot!.productionRates).toBeDefined();
    expect(snapshot!.caps).toBeDefined();
    expect(snapshot!.buildingQueue.length).toBe(2);
    expect(snapshot!.techQueue.length).toBe(1);
    expect(snapshot!.expeditionQueue.length).toBe(1);
    expect(snapshot!.tradeCaravans.length).toBe(1);
  });

  // ── §1.2 五档衰减系数 ──

  it('OFFLINE-FLOW-1.2a: tier1 0~2h → 100% 效率', () => {
    // Play §1.2: 0~2h→100%
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(1 * HOUR_S, rates, {});

    expect(snapshot.overallEfficiency).toBeCloseTo(1.0, 4);
    expect(snapshot.tierDetails).toHaveLength(1);
    expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
  });

  it('OFFLINE-FLOW-1.2b: tier2 2~8h → 80% 效率', () => {
    // Play §1.2: 2~8h→80%
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(5 * HOUR_S, rates, {});

    // 5h = 2h@100% + 3h@80%
    // 加权效率 = (7200*1.0 + 10800*0.8) / 18000
    const expectedEff = (7200 * 1.0 + 10800 * 0.8) / 18000;
    expect(snapshot.overallEfficiency).toBeCloseTo(expectedEff, 3);
    expect(snapshot.tierDetails).toHaveLength(2);
  });

  it('OFFLINE-FLOW-1.2c: tier3 8~24h → 60% 效率', () => {
    // Play §1.2: 8~24h→60%
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(15 * HOUR_S, rates, {});

    expect(snapshot.tierDetails).toHaveLength(3);
    const tier3 = snapshot.tierDetails.find(t => t.tierId === 'tier3');
    expect(tier3).toBeDefined();
    expect(tier3!.efficiency).toBe(0.6);
  });

  it('OFFLINE-FLOW-1.2d: tier4 24~48h → 40% 效率', () => {
    // Play §1.2: 24~48h→40%
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(36 * HOUR_S, rates, {});

    expect(snapshot.tierDetails).toHaveLength(4);
    const tier4 = snapshot.tierDetails.find(t => t.tierId === 'tier4');
    expect(tier4).toBeDefined();
    expect(tier4!.efficiency).toBe(0.4);
  });

  it('OFFLINE-FLOW-1.2e: tier5 48~72h → 20% 效率', () => {
    // Play §1.2: 48~72h→20%
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(60 * HOUR_S, rates, {});

    expect(snapshot.tierDetails).toHaveLength(5);
    const tier5 = snapshot.tierDetails.find(t => t.tierId === 'tier5');
    expect(tier5).toBeDefined();
    expect(tier5!.efficiency).toBe(0.2);
  });

  it('OFFLINE-FLOW-1.2f: >72h 收益封顶不新增', () => {
    // Play §1.2: >72h→封顶，超出72h部分不产出额外收益
    const rates = createProductionRates();
    const snap72h = calculateOfflineSnapshot(72 * HOUR_S, rates, {});
    const snap200h = calculateOfflineSnapshot(200 * HOUR_S, rates, {});

    expect(snap72h.isCapped).toBe(false);
    expect(snap200h.isCapped).toBe(true);
    // 200h收益 == 72h收益（封顶）
    expect(snap200h.totalEarned.grain).toBe(snap72h.totalEarned.grain);
    expect(snap200h.totalEarned.gold).toBe(snap72h.totalEarned.gold);
  });

  // ── §1.7 分段计算验证 ──

  it('OFFLINE-FLOW-1.7: 离线10h分段计算正确', () => {
    // Play §1.7: 时段1(0~2h)=速率×7200×100% + 时段2(2~8h)=速率×21600×80% + 时段3(8~10h)=速率×7200×60%
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(10 * HOUR_S, rates, {});

    expect(snapshot.tierDetails).toHaveLength(3);

    // 时段1: 0~2h, 7200秒, 100%
    const t1 = snapshot.tierDetails[0];
    expect(t1.tierId).toBe('tier1');
    expect(t1.seconds).toBe(7200);
    expect(t1.efficiency).toBe(1.0);
    expect(t1.earned.grain).toBe(100 * 7200 * 1.0);

    // 时段2: 2~8h, 21600秒, 80%
    const t2 = snapshot.tierDetails[1];
    expect(t2.tierId).toBe('tier2');
    expect(t2.seconds).toBe(21600);
    expect(t2.efficiency).toBe(0.8);
    expect(t2.earned.grain).toBe(100 * 21600 * 0.8);

    // 时段3: 8~10h, 7200秒, 60%
    const t3 = snapshot.tierDetails[2];
    expect(t3.tierId).toBe('tier3');
    expect(t3.seconds).toBe(7200);
    expect(t3.efficiency).toBe(0.6);
    expect(t3.earned.grain).toBe(100 * 7200 * 0.6);

    // 总收益 = 三段累加
    const expectedTotalGrain = 100 * 7200 * 1.0 + 100 * 21600 * 0.8 + 100 * 7200 * 0.6;
    expect(snapshot.totalEarned.grain).toBe(expectedTotalGrain);
  });

  // ── §1.3 加成系数叠加 ──

  it('OFFLINE-FLOW-1.3a: 科技+VIP+声望加成加法累加', () => {
    // Play §1.3: 科技+VIP+声望加成加法累加
    const bonus: BonusSources = { tech: 0.3, vip: 0.2, reputation: 0.25 };
    const coefficient = calculateBonusCoefficient(bonus);

    // 1 + min(0.3 + 0.2 + 0.25, 1.0) = 1 + 0.75 = 1.75
    expect(coefficient).toBeCloseTo(1.75, 4);
  });

  it('OFFLINE-FLOW-1.3b: 加成上限封顶+100%', () => {
    // Play §1.3: 继续叠加时上限封顶+100%
    const bonus: BonusSources = { tech: 0.5, vip: 0.4, reputation: 0.3 };
    const coefficient = calculateBonusCoefficient(bonus);

    // 1 + min(0.5 + 0.4 + 0.3, 1.0) = 1 + 1.0 = 2.0
    expect(coefficient).toBeCloseTo(2.0, 4);
  });

  it('OFFLINE-FLOW-1.3c: VIP离线加成表正确', () => {
    // Play §1.3: VIP1 +5% / VIP3 +15% / VIP5 +25%
    expect(VIP_OFFLINE_BONUSES[0].vipLevel).toBe(0);
    expect(VIP_OFFLINE_BONUSES[0].efficiencyBonus).toBe(0);

    const vip1 = VIP_OFFLINE_BONUSES.find(b => b.vipLevel === 1);
    expect(vip1).toBeDefined();
    expect(vip1!.efficiencyBonus).toBe(0.05);

    const vip3 = VIP_OFFLINE_BONUSES.find(b => b.vipLevel === 3);
    expect(vip3).toBeDefined();
    expect(vip3!.efficiencyBonus).toBe(0.15);

    const vip5 = VIP_OFFLINE_BONUSES.find(b => b.vipLevel === 5);
    expect(vip5).toBeDefined();
    expect(vip5!.efficiencyBonus).toBe(0.25);
  });

  it('OFFLINE-FLOW-1.3d: VIP加成应用到收益', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(3600, rates);
    const boosted0 = offlineReward.applyVipBonus(snapshot.totalEarned, 0);
    const boosted3 = offlineReward.applyVipBonus(snapshot.totalEarned, 3);
    const boosted5 = offlineReward.applyVipBonus(snapshot.totalEarned, 5);

    // VIP3 加成15% > VIP0 加成0%
    expect(boosted3.grain).toBeGreaterThan(boosted0.grain);
    // VIP5 加成25% > VIP3 加成15%
    expect(boosted5.grain).toBeGreaterThan(boosted3.grain);
  });

  // ── §1.1 系统差异化修正系数 ──

  it('OFFLINE-FLOW-1.1: 系统修正系数 资源×1.0 / 建筑×1.2 / 科技×1.0 / 远征×0.85', () => {
    // Play §3.1: 各系统按独立效率修正结算
    expect(getSystemModifier('resource')).toBe(1.0);
    expect(getSystemModifier('building')).toBe(1.2);
    expect(getSystemModifier('tech')).toBe(1.0);
    expect(getSystemModifier('expedition')).toBe(0.85);
  });

  it('OFFLINE-FLOW-1.1: 系统修正正确应用到收益', () => {
    const rates = createProductionRates();
    const earned: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 0, techPoint: 0, recruitToken: 0 };

    const buildingModified = applySystemModifier(earned, 'building');
    expect(buildingModified.grain).toBe(1200); // 1000 * 1.2

    const expeditionModified = applySystemModifier(earned, 'expedition');
    expect(expeditionModified.grain).toBe(850); // 1000 * 0.85

    const resourceModified = applySystemModifier(earned, 'resource');
    expect(resourceModified.grain).toBe(1000); // 1000 * 1.0
  });

  // ── 衰减分档平滑递减 ──

  it('OFFLINE-FLOW-1.2: 时间越长总收益越多但效率递减', () => {
    const rates = createProductionRates();

    const snap1h = calculateOfflineSnapshot(1 * HOUR_S, rates, {});
    const snap8h = calculateOfflineSnapshot(8 * HOUR_S, rates, {});
    const snap24h = calculateOfflineSnapshot(24 * HOUR_S, rates, {});
    const snap72h = calculateOfflineSnapshot(72 * HOUR_S, rates, {});

    // 总收益递增
    expect(snap8h.totalEarned.grain).toBeGreaterThan(snap1h.totalEarned.grain);
    expect(snap24h.totalEarned.grain).toBeGreaterThan(snap8h.totalEarned.grain);
    expect(snap72h.totalEarned.grain).toBeGreaterThan(snap24h.totalEarned.grain);

    // 效率递减
    expect(snap8h.overallEfficiency).toBeLessThan(snap1h.overallEfficiency);
    expect(snap24h.overallEfficiency).toBeLessThan(snap8h.overallEfficiency);
    expect(snap72h.overallEfficiency).toBeLessThan(snap24h.overallEfficiency);
  });

});

// ═══════════════════════════════════════════════════════════════
// OFFLINE-FLOW-2: 离线收益领取（全额领取、双倍领取）
// ═══════════════════════════════════════════════════════════════
describe('OFFLINE-FLOW-2: 离线收益领取（全额领取、双倍领取）', () => {

  // ── §1.4 离线收益弹窗与翻倍 ──

  it('OFFLINE-FLOW-2a: 离线>5min后上线应弹出收益弹窗', () => {
    // Play §1.4: 离线>5min弹出收益弹窗
    expect(shouldShowOfflinePopup(301)).toBe(true); // > 300s
    expect(shouldShowOfflinePopup(300)).toBe(false); // = 300s
    expect(shouldShowOfflinePopup(299)).toBe(false); // < 300s
  });

  it('OFFLINE-FLOW-2a: 离线≤5min静默入账不弹窗', () => {
    // Play §1.1: 离线≤5min静默入账不弹窗
    expect(shouldShowOfflinePopup(0)).toBe(false);
    expect(shouldShowOfflinePopup(60)).toBe(false);
    expect(shouldShowOfflinePopup(300)).toBe(false);
  });

  it('OFFLINE-FLOW-2b: 广告翻倍收益×2', () => {
    // Play §1.4: 广告翻倍(3次/天)收益×2
    const earned: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 0, techPoint: 0, recruitToken: 0 };
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '观看广告翻倍' }, 0);

    expect(result.success).toBe(true);
    expect(result.appliedMultiplier).toBe(2);
    expect(result.doubledEarned.grain).toBe(2000);
    expect(result.doubledEarned.gold).toBe(1000);
  });

  it('OFFLINE-FLOW-2b: 广告翻倍每日3次限制', () => {
    // Play §1.4: 广告翻倍(3次/天)
    const earned: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 0, techPoint: 0, recruitToken: 0 };

    // 第4次应失败
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 3);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已用完');
    expect(result.appliedMultiplier).toBe(1);
  });

  it('OFFLINE-FLOW-2c: VIP翻倍有每日限制', () => {
    // Play §1.4: VIP翻倍
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(3600, rates);

    // VIP0 每日1次翻倍
    const result1 = offlineReward.applyDouble(snapshot.totalEarned, { source: 'vip', multiplier: 2, description: 'VIP翻倍' });
    expect(result1.success).toBe(true);

    // 第2次应失败（VIP0每日限制1次）
    const result2 = offlineReward.applyDouble(snapshot.totalEarned, { source: 'vip', multiplier: 2, description: 'VIP翻倍' });
    expect(result2.success).toBe(false);
  });

  it('OFFLINE-FLOW-2c: 道具翻倍收益×2', () => {
    // Play §1.4: 道具翻倍
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    offlineReward.addBoostItem('offline_double', 1);
    const snapshot = offlineReward.calculateSnapshot(3600, rates);

    const doubles = offlineReward.getAvailableDoubles(3600, 0);
    const itemDouble = doubles.find(d => d.source === 'item');
    expect(itemDouble).toBeDefined();

    const result = offlineReward.applyDouble(snapshot.totalEarned, { source: 'item', multiplier: 2, description: '道具翻倍' });
    expect(result.success).toBe(true);
    expect(result.appliedMultiplier).toBe(2);
  });

  it('OFFLINE-FLOW-2d: 回归面板数据生成正确', () => {
    // Play §1.4: 弹窗展示离线时长/效率系数/各资源收益
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const panel = offlineReward.generateReturnPanel(8 * HOUR_S, rates, 0);

    expect(panel.offlineSeconds).toBe(8 * HOUR_S);
    expect(panel.formattedTime).toBeDefined();
    expect(typeof panel.efficiencyPercent).toBe('number');
    expect(panel.tierDetails.length).toBeGreaterThan(0);
    expect(panel.totalEarned).toBeDefined();
    expect(panel.availableDoubles.length).toBeGreaterThan(0);
  });

  // ── §1.4 领取防重复 ──

  it('OFFLINE-FLOW-2e: 防重复领取 — 同一次收益只能领取一次', () => {
    // Play §1.4: 领取后资源入账，不可重复领取
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null };

    const reward = offlineReward.calculateOfflineReward(3600, rates, current, caps, 0, 'resource');

    // 第一次领取成功
    const claim1 = offlineReward.claimReward(reward);
    expect(claim1).not.toBeNull();
    expect(claim1!.grain).toBeGreaterThan(0);

    // 第二次领取失败（防重复）
    const claim2 = offlineReward.claimReward(reward);
    expect(claim2).toBeNull();
  });

  it('OFFLINE-FLOW-2e: 重新计算后可以再次领取', () => {
    // Play §1.4: 新一轮离线收益可领取
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null };

    const reward1 = offlineReward.calculateOfflineReward(3600, rates, current, caps, 0, 'resource');
    const claim1 = offlineReward.claimReward(reward1);
    expect(claim1).not.toBeNull();

    // 重新计算 → 新一轮
    const reward2 = offlineReward.calculateOfflineReward(7200, rates, current, caps, 0, 'resource');
    const claim2 = offlineReward.claimReward(reward2);
    expect(claim2).not.toBeNull();
    // 第二次离线更久，收益应更多
    expect(claim2!.grain).toBeGreaterThan(claim1!.grain);
  });

  // ── §1.5 广告翻倍细节 ──

  it('OFFLINE-FLOW-2f: 完整离线流程: 快照→计算→翻倍→领取→清理', () => {
    // Play §1.4: 完整离线收益领取流程
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null };

    // 1. 创建快照
    snapshotSys.createSnapshot(createSnapshotParams());

    // 2. 计算离线收益
    const reward = offlineReward.calculateOfflineReward(2 * HOUR_S, rates, current, caps, 0, 'resource');
    expect(reward.cappedEarned.grain).toBeGreaterThan(0);

    // 3. 翻倍
    const doubleResult = offlineReward.applyDouble(reward.cappedEarned, { source: 'ad', multiplier: 2, description: '广告翻倍' });
    expect(doubleResult.success).toBe(true);
    expect(doubleResult.doubledEarned.grain).toBe(reward.cappedEarned.grain * 2);

    // 4. 领取
    const claimed = offlineReward.claimReward(reward);
    expect(claimed).not.toBeNull();

    // 5. 清理快照
    snapshotSys.clearSnapshot();
    expect(snapshotSys.getSnapshot()).toBeNull();
  });

});

// ═══════════════════════════════════════════════════════════════
// OFFLINE-FLOW-3: 离线收益加速（广告/道具加速）
// ═══════════════════════════════════════════════════════════════
describe('OFFLINE-FLOW-3: 离线收益加速（广告/道具加速）', () => {

  it('OFFLINE-FLOW-3a: 加速道具管理 — 添加和查询', () => {
    // Play §1.5: 加速道具
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const itemsBefore = offlineReward.getBoostItems();
    const countBefore = itemsBefore.reduce((sum, i) => sum + i.count, 0);

    offlineReward.addBoostItem('offline_boost_1h', 3);
    offlineReward.addBoostItem('offline_boost_4h', 1);

    const itemsAfter = offlineReward.getBoostItems();
    const boost1h = itemsAfter.find(i => i.id === 'offline_boost_1h');
    const boost4h = itemsAfter.find(i => i.id === 'offline_boost_4h');

    expect(boost1h).toBeDefined();
    expect(boost1h!.count).toBe(3);
    expect(boost1h!.boostHours).toBe(1);
    expect(boost4h).toBeDefined();
    expect(boost4h!.count).toBe(1);
    expect(boost4h!.boostHours).toBe(4);
  });

  it('OFFLINE-FLOW-3b: 使用加速道具增加收益', () => {
    // Play §1.5: 使用道具加速离线收益
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    offlineReward.addBoostItem('offline_boost_1h', 2);

    const result = offlineReward.useBoostItemAction('offline_boost_1h', rates);

    expect(result.success).toBe(true);
    expect(result.addedSeconds).toBe(3600); // 1h = 3600s
    expect(result.addedEarned.grain).toBe(100 * 3600); // grain rate * 3600
    expect(result.remainingCount).toBe(1);
  });

  it('OFFLINE-FLOW-3c: 道具不足时使用失败', () => {
    // Play §1.5: 道具不足
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    // 不添加道具，直接使用
    const result = offlineReward.useBoostItemAction('offline_boost_1h', rates);

    expect(result.success).toBe(false);
    expect(result.addedSeconds).toBe(0);
    expect(result.reason).toContain('不足');
  });

  it('OFFLINE-FLOW-3d: 离线贸易模拟 — 商队继续运输', () => {
    // Play §3: 离线贸易行为
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    offlineReward.setLastOfflineTime(Date.now() - 4 * HOUR_S * 1000);

    const tradeProfit: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const summary = offlineReward.simulateOfflineTrade(4 * HOUR_S, tradeProfit);

    expect(summary).toBeDefined();
    expect(summary.completedTrades).toBeGreaterThanOrEqual(0);
    expect(summary.totalProfit).toBeDefined();
    expect(summary.events).toBeDefined();
  });

  it('OFFLINE-FLOW-3e: 回归奖励翻倍（离线>24h）', () => {
    // Play §1.4: 回归奖励翻倍
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    // 离线25h
    const doubles = offlineReward.getAvailableDoubles(25 * HOUR_S, 0);
    const returnBonus = doubles.find(d => d.source === 'return_bonus');

    expect(returnBonus).toBeDefined();
    expect(returnBonus!.multiplier).toBe(2);

    // 离线1h 不应有回归奖励
    const doubles1h = offlineReward.getAvailableDoubles(1 * HOUR_S, 0);
    const returnBonus1h = doubles1h.find(d => d.source === 'return_bonus');
    expect(returnBonus1h).toBeUndefined();
  });

});

// ═══════════════════════════════════════════════════════════════
// OFFLINE-FLOW-4: 离线事件（随机事件触发、处理）
// ═══════════════════════════════════════════════════════════════
describe('OFFLINE-FLOW-4: 离线事件（随机事件触发、处理）', () => {

  it('OFFLINE-FLOW-4a: 快照记录建筑队列状态', () => {
    // Play §3.5: 事件系统不自动处理，最多堆积5个事件
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    snapshotSys.createSnapshot(createFullSnapshotParams());

    const snapshot = snapshotSys.getSnapshot();
    expect(snapshot!.buildingQueue.length).toBe(2);
  });

  it('OFFLINE-FLOW-4b: 检测离线期间完成的建筑', () => {
    // Play §3.1: 建筑升级×1.2(加速完成)
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    const now = Date.now();
    snapshotSys.createSnapshot({
      resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 },
      productionRates: createProductionRates(),
      caps: { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
      buildingQueue: [
        { buildingType: 'farmland', startTime: now - 7200000, endTime: now - 3600000 }, // 1h前完成
        { buildingType: 'market', startTime: now - 3600000, endTime: now + 3600000 },   // 1h后完成
      ],
      techQueue: [],
      expeditionQueue: [],
      tradeCaravans: [],
    });

    const completed = snapshotSys.getCompletedBuildings();
    expect(completed.length).toBe(1);
    expect(completed[0].buildingType).toBe('farmland');
  });

  it('OFFLINE-FLOW-4c: 检测离线期间完成的科技研究', () => {
    // Play §3.1: 科技研究×1.0
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    const now = Date.now();
    snapshotSys.createSnapshot({
      resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 },
      productionRates: createProductionRates(),
      caps: { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
      buildingQueue: [],
      techQueue: [
        { techId: 'tech_tuntian', startTime: now - 14400000, endTime: now - 3600000 }, // 1h前完成
      ],
      expeditionQueue: [],
      tradeCaravans: [],
    });

    const completed = snapshotSys.getCompletedTech();
    expect(completed.length).toBe(1);
    expect(completed[0].techId).toBe('tech_tuntian');
  });

  it('OFFLINE-FLOW-4d: 检测离线期间完成的远征', () => {
    // Play §3.1: 远征×0.85(保守结算)
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    const now = Date.now();
    snapshotSys.createSnapshot({
      resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 },
      productionRates: createProductionRates(),
      caps: { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
      buildingQueue: [],
      techQueue: [],
      expeditionQueue: [
        { expeditionId: 'exp_001', startTime: now - 28800000, endTime: now - 7200000, estimatedReward: { grain: 500, gold: 200, troops: 50, mandate: 0, techPoint: 0, recruitToken: 0 } },
      ],
      tradeCaravans: [],
    });

    const completed = snapshotSys.getCompletedExpeditions();
    expect(completed.length).toBe(1);
    expect(completed[0].expeditionId).toBe('exp_001');
  });

  it('OFFLINE-FLOW-4e: 检测离线期间完成的贸易', () => {
    // Play §3.1: 商队自动完成交易
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    const now = Date.now();
    snapshotSys.createSnapshot({
      resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 },
      productionRates: createProductionRates(),
      caps: { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
      buildingQueue: [],
      techQueue: [],
      expeditionQueue: [],
      tradeCaravans: [
        { caravanId: 'caravan_001', routeId: 'route_001', startTime: now - 14400000, endTime: now - 3600000, estimatedProfit: { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 } },
      ],
    });

    const completed = snapshotSys.getCompletedTrades();
    expect(completed.length).toBe(1);
    expect(completed[0].caravanId).toBe('caravan_001');
  });

  it('OFFLINE-FLOW-4f: 事件系统离线事件引擎接口存在', () => {
    // Play §3.5: 事件系统不自动处理
    const sim = createSim();
    const offlineEvent = sim.engine.getOfflineEventSystem();
    expect(offlineEvent).toBeDefined();
  });

});

// ═══════════════════════════════════════════════════════════════
// OFFLINE-FLOW-5: 离线保护（防作弊、时间上限）
// ═══════════════════════════════════════════════════════════════
describe('OFFLINE-FLOW-5: 离线保护（防作弊、时间上限）', () => {

  it('OFFLINE-FLOW-5a: 72h时间上限 — 超出部分不产出收益', () => {
    // Play §1.1: 72h封顶
    const rates = createProductionRates();

    const snap72h = calculateOfflineSnapshot(72 * HOUR_S, rates, {});
    const snap100h = calculateOfflineSnapshot(100 * HOUR_S, rates, {});
    const snap200h = calculateOfflineSnapshot(200 * HOUR_S, rates, {});

    // 所有超过72h的收益应相同
    expect(snap100h.totalEarned.grain).toBe(snap72h.totalEarned.grain);
    expect(snap200h.totalEarned.grain).toBe(snap72h.totalEarned.grain);
    expect(snap100h.isCapped).toBe(true);
    expect(snap200h.isCapped).toBe(true);
  });

  it('OFFLINE-FLOW-5b: 资源保护 — grain 30%保护', () => {
    // Play §3: 资源保护机制
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const protection = offlineReward.getResourceProtection('grain', 1000);
    expect(protection).toBe(300); // 1000 * 0.3 = 300
  });

  it('OFFLINE-FLOW-5b: 资源保护 — grain 下限100', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const protection = offlineReward.getResourceProtection('grain', 50);
    expect(protection).toBe(100); // max(50*0.3, 100) = 100
  });

  it('OFFLINE-FLOW-5b: 资源保护 — gold 20%保护（下限500）', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const protectionHigh = offlineReward.getResourceProtection('gold', 10000);
    expect(protectionHigh).toBe(2000); // 10000 * 0.2 = 2000 > 500

    const protectionLow = offlineReward.getResourceProtection('gold', 100);
    expect(protectionLow).toBe(500); // max(100*0.2, 500) = 500
  });

  it('OFFLINE-FLOW-5b: 资源保护 — troops 40%保护', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const protection = offlineReward.getResourceProtection('troops', 500);
    expect(protection).toBe(200); // 500 * 0.4 = 200
  });

  it('OFFLINE-FLOW-5b: 资源保护 — mandate 无保护', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const protection = offlineReward.getResourceProtection('mandate', 1000);
    expect(protection).toBe(0);
  });

  it('OFFLINE-FLOW-5c: 溢出截断 — 有上限资源截断至仓库容量', () => {
    // Play §3.2: 有上限资源截断至仓库上限
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const earned: Resources = { grain: 50000, gold: 1000, troops: 20000, mandate: 100, techPoint: 0, recruitToken: 0 };
    const current: Resources = { grain: 49000, gold: 500, troops: 9500, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps: Record<string, number | null> = { grain: 50000, gold: 2000, troops: 10000, mandate: null };

    const result = offlineReward.applyCapAndOverflow(earned, current, caps);

    // grain: space = 50000 - 49000 = 1000, earned 50000, 截断到1000, 溢出49000
    expect(result.cappedEarned.grain).toBe(1000);
    expect(result.overflowResources.grain).toBe(49000);

    // gold: cap=null, 全额发放
    expect(result.cappedEarned.gold).toBe(1000);
    expect(result.overflowResources.gold).toBe(0);

    // troops: space = 10000 - 9500 = 500, earned 20000, 截断到500, 溢出19500
    expect(result.cappedEarned.troops).toBe(500);
    expect(result.overflowResources.troops).toBe(19500);

    // mandate: cap=null, 全额发放
    expect(result.cappedEarned.mandate).toBe(100);
    expect(result.overflowResources.mandate).toBe(0);
  });

  it('OFFLINE-FLOW-5c: 溢出截断 — 当前已达上限全部溢出', () => {
    // Play §3.2: 当前资源已达上限应全部溢出
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const earned: Resources = { grain: 1000, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const current: Resources = { grain: 50000, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps: Record<string, number | null> = { grain: 50000, gold: 2000, troops: 10000, mandate: null };

    const result = offlineReward.applyCapAndOverflow(earned, current, caps);
    expect(result.cappedEarned.grain).toBe(0);
    expect(result.overflowResources.grain).toBe(1000);
  });

  it('OFFLINE-FLOW-5d: 仓库扩容 — 升级后容量增加', () => {
    // Play §3.2: 提示升级仓库
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const capLv1 = offlineReward.getWarehouseCapacity('grain');
    expect(capLv1).toBe(2000); // baseCapacity=2000, level=1

    const result = offlineReward.upgradeWarehouse('grain');
    expect(result.success).toBe(true);
    expect(result.newCapacity).toBe(3000); // 2000 + 1*1000
    expect(result.newLevel).toBe(2);

    const capLv2 = offlineReward.getWarehouseCapacity('grain');
    expect(capLv2).toBe(3000);
  });

  it('OFFLINE-FLOW-5d: 仓库扩容 — 连续升级正确累加', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    offlineReward.upgradeWarehouse('grain'); // Lv2: 3000
    offlineReward.upgradeWarehouse('grain'); // Lv3: 4000

    expect(offlineReward.getWarehouseCapacity('grain')).toBe(4000);
    expect(offlineReward.getWarehouseLevel('grain')).toBe(3);
  });

  it('OFFLINE-FLOW-5e: 快照有效性检查', () => {
    // Play §1.1: 快照72h有效期
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    // 无快照时无效
    expect(snapshotSys.isSnapshotValid()).toBe(false);

    // 创建快照后有效
    snapshotSys.createSnapshot(createSnapshotParams());
    expect(snapshotSys.isSnapshotValid()).toBe(true);
  });

  it('OFFLINE-FLOW-5f: 序列化/反序列化保持状态一致', () => {
    // Play: 离线系统状态持久化
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    offlineReward.addBoostItem('offline_boost_1h', 5);
    offlineReward.setLastOfflineTime(12345);

    const data = offlineReward.serialize();
    expect(data.lastOfflineTime).toBe(12345);
    expect(data.boostItems['offline_boost_1h']).toBe(5);

    // 反序列化到新实例
    const sim2 = createSim();
    const offlineReward2 = sim2.engine.getOfflineRewardSystem();
    offlineReward2.deserialize(data);

    expect(offlineReward2.getLastOfflineTime()).toBe(12345);
    const items = offlineReward2.getBoostItems();
    const item = items.find(i => i.id === 'offline_boost_1h');
    expect(item!.count).toBe(5);
  });

  it('OFFLINE-FLOW-5g: 重置清空所有状态', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    offlineReward.addBoostItem('offline_boost_1h', 5);
    offlineReward.setLastOfflineTime(12345);
    offlineReward.reset();

    expect(offlineReward.getLastOfflineTime()).toBe(0);
    const items = offlineReward.getBoostItems();
    expect(items.every(i => i.count === 0)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// OFFLINE-FLOW-6: 离线收益预览（预估显示）
// ═══════════════════════════════════════════════════════════════
describe('OFFLINE-FLOW-6: 离线收益预览（预估显示）', () => {

  it('OFFLINE-FLOW-6a: 预估收益计算 — 各时间点收益', () => {
    // Play §3.3: 预估数据与实际计算公式一致
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createProductionRates();

    const result = estimate.estimate(rates);

    expect(result.timeline).toBeDefined();
    expect(result.timeline.length).toBeGreaterThan(0);

    // 检查时间线各点
    for (const point of result.timeline) {
      expect(point.hours).toBeGreaterThan(0);
      expect(point.hours).toBeLessThanOrEqual(72);
      expect(point.earned).toBeDefined();
      expect(typeof point.efficiency).toBe('number');
    }
  });

  it('OFFLINE-FLOW-6b: 推荐下线时长在合理范围', () => {
    // Play §3.3: 帮助玩家决策"现在下线能拿多少"
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createProductionRates();

    const result = estimate.estimate(rates);
    expect(result.recommendedHours).toBeGreaterThan(0);
    expect(result.recommendedHours).toBeLessThanOrEqual(72);
  });

  it('OFFLINE-FLOW-6c: 效率曲线随时间递减', () => {
    // Play §3.3: 效率系数随时长递减可视化
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();

    const curve = estimate.getEfficiencyCurve(72);
    expect(curve.length).toBe(72);

    // 效率应单调递减
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].efficiency).toBeLessThanOrEqual(curve[i - 1].efficiency);
    }
  });

  it('OFFLINE-FLOW-6d: 72h后显示封顶提示', () => {
    // Play §3.3: 72h后显示封顶提示
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createProductionRates();

    const result72h = estimate.estimateForHours(72, rates);
    const result100h = estimate.estimateForHours(100, rates);

    // 100h应被截断到72h
    expect(result100h.hours).toBe(72);
    // 收益应相同
    expect(result100h.earned.grain).toBe(result72h.earned.grain);
  });

  it('OFFLINE-FLOW-6e: 各系统修正预估', () => {
    // Play §3.3: 基于当前产出速率和加成系数实时计算
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createProductionRates();

    const result = estimate.estimate(rates);
    expect(result.systemEstimates).toBeDefined();

    // 应包含各系统修正
    const systemIds = Object.keys(result.systemEstimates);
    expect(systemIds.length).toBeGreaterThan(0);
  });

  it('OFFLINE-FLOW-6f: 指定小时数预估', () => {
    // Play §3.3: 拖动滑块选择预估时长
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createProductionRates();

    const point8h = estimate.estimateForHours(8, rates);
    expect(point8h.hours).toBe(8);
    expect(point8h.earned.grain).toBeGreaterThan(0);

    // 带系统修正
    const point8hBuilding = estimate.estimateForHours(8, rates, 'building');
    expect(point8hBuilding.earned.grain).toBeGreaterThan(point8h.earned.grain); // 建筑×1.2
  });

  it('OFFLINE-FLOW-6g: OfflineRewardEngine 预估函数', () => {
    // Play §3.3: 预估收益
    const rates = createProductionRates();
    const snapshot = estimateOfflineReward(8, rates, { tech: 0.1, vip: 0.05 });

    expect(snapshot).toBeDefined();
    expect(snapshot.offlineSeconds).toBe(8 * HOUR_S);
    expect(snapshot.totalEarned.grain).toBeGreaterThan(0);
    expect(snapshot.isCapped).toBe(false);
  });

  it('OFFLINE-FLOW-6h: 格式化离线时长', () => {
    // Play §3.3: 展示格式化时长
    expect(formatOfflineDuration(0)).toBe('刚刚');
    expect(formatOfflineDuration(30)).toBe('30秒');
    expect(formatOfflineDuration(90)).toBe('1分钟');
    expect(formatOfflineDuration(3600)).toBe('1小时');
    expect(formatOfflineDuration(9000)).toBe('2小时30分钟');
    expect(formatOfflineDuration(86400)).toBe('1天');
    expect(formatOfflineDuration(90000)).toBe('1天1小时');
  });

  it('OFFLINE-FLOW-6i: 完整离线收益计算 OfflineRewardResultV9', () => {
    // Play §1.1: 完整离线收益计算流程
    const rates = createProductionRates();
    const ctx: OfflineRewardContext = {
      offlineSeconds: 10 * HOUR_S,
      productionRates: rates,
      currentResources: { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 },
      caps: { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null },
      bonusSources: { tech: 0.1 },
      vipLevel: 0,
      adUsedToday: 0,
      systemId: 'building',
    };

    const result = calculateFullOfflineReward(ctx);

    expect(result.snapshot).toBeDefined();
    expect(result.vipBoostedEarned).toBeDefined();
    expect(result.systemModifiedEarned).toBeDefined();
    expect(result.cappedEarned).toBeDefined();
    expect(result.overflowResources).toBeDefined();
    expect(result.panelData).toBeDefined();

    // 建筑修正×1.2
    expect(result.systemModifiedEarned.grain).toBeGreaterThan(result.vipBoostedEarned.grain);
  });

});
