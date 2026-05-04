/**
 * v9.0 离线收益集成测试 — 回归面板 + 交叉验证
 *
 * 覆盖:
 *   §4.1  回归面板数据完整性
 *   §7.1  离线→资源联动（快照→计算→截断→面板）
 *   §7.2  建筑系统闭环（快照→完成检测→收益）
 *   §7.3  远征系统闭环（快照→完成检测→修正）
 *   §7.4  翻倍联动（面板→翻倍→领取）
 *   §7.8  资源保护（保护线计算→截断）
 *   §7.9  回归完整性（端到端流程）
 *   §7.10 交叉验证（多系统一致性）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OfflineRewardSystem,
  OfflineEstimateSystem,
  calculateOfflineSnapshot,
  applyDouble,
  applyOverflowRules,
  calculateFullOfflineReward,
  shouldShowOfflinePopup,
  generateReturnPanelData,
  formatOfflineDuration,
  getSystemModifier,
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  VIP_OFFLINE_BONUSES,
  RESOURCE_PROTECTIONS,
  DEFAULT_WAREHOUSE_EXPANSIONS,
  AD_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MULTIPLIER,
  RETURN_BONUS_MIN_HOURS,
} from '../../index';
import { OFFLINE_POPUP_THRESHOLD } from '../../offline-config';
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
  return { grain: 5000, gold: null, ore: 5000, wood: 5000, troops: 1000, mandate: null, techPoint: null, recruitToken: null, skillBook: null, ...overrides };
}

function makeCurrentRes(overrides: Partial<Resources> = {}): Resources {
  return { grain: 100, gold: 500, troops: 50, mandate: 20, techPoint: 10, ...overrides };
}

// ─────────────────────────────────────────────
// §4.1 回归面板数据完整性
// ─────────────────────────────────────────────

describe('§4.1 回归面板数据完整性', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§4.1.1 面板包含离线时长（秒）', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 5, makeRates(), 0);
    expect(panel.offlineSeconds).toBe(HOUR_S * 5);
  });

  it('§4.1.2 面板包含格式化时长', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 5, makeRates(), 0);
    expect(panel.formattedTime).toContain('5');
    expect(panel.formattedTime).toContain('小时');
  });

  it('§4.1.3 面板包含效率百分比', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 10, makeRates(), 0);
    expect(panel.efficiencyPercent).toBeGreaterThan(0);
    expect(panel.efficiencyPercent).toBeLessThanOrEqual(100);
  });

  it('§4.1.4 面板包含各档位明细', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 10, makeRates(), 0);
    expect(panel.tierDetails.length).toBeGreaterThanOrEqual(3);
  });

  it('§4.1.5 面板包含总收益', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 2, makeRates(), 0);
    expect(panel.totalEarned.grain).toBeGreaterThan(0);
    expect(panel.totalEarned.gold).toBeGreaterThan(0);
    expect(panel.totalEarned.troops).toBeGreaterThan(0);
  });

  it('§4.1.6 离线>72h时isCapped=true', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 80, makeRates(), 0);
    expect(panel.isCapped).toBe(true);
  });

  it('§4.1.7 离线<72h时isCapped=false', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 10, makeRates(), 0);
    expect(panel.isCapped).toBe(false);
  });

  it('§4.1.8 面板包含可用翻倍选项', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 2, makeRates(), 0);
    expect(panel.availableDoubles.length).toBeGreaterThanOrEqual(1);
  });

  it('§4.1.9 离线>24h出现回归奖励翻倍', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 30, makeRates(), 0);
    const returnBonus = panel.availableDoubles.find(d => d.source === 'return_bonus');
    expect(returnBonus).toBeDefined();
    expect(returnBonus!.multiplier).toBe(RETURN_BONUS_MULTIPLIER);
  });

  it('§4.1.10 离线<24h无回归奖励翻倍', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 10, makeRates(), 0);
    const returnBonus = panel.availableDoubles.find(d => d.source === 'return_bonus');
    expect(returnBonus).toBeUndefined();
  });

  it('§4.1.11 面板包含加速道具列表', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 2, makeRates(), 0);
    expect(Array.isArray(panel.boostItems)).toBe(true);
  });

  it('§4.1.12 generateReturnPanelData（引擎版）与系统版一致', () => {
    const rates = makeRates();
    const snap = calculateOfflineSnapshot(HOUR_S * 5, rates, {});
    const enginePanel = generateReturnPanelData(snap, 0);
    const sysPanel = rewardSystem.generateReturnPanel(HOUR_S * 5, rates, 0);
    expect(enginePanel.offlineSeconds).toBe(sysPanel.offlineSeconds);
    expect(enginePanel.isCapped).toBe(sysPanel.isCapped);
  });
});

// ─────────────────────────────────────────────
// §7.1 离线→资源联动
// ─────────────────────────────────────────────

describe('§7.1 离线→资源联动', () => {
  it('§7.1.1 快照→计算→截断→面板全链路', () => {
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
    // 快照存在
    expect(result.snapshot.totalEarned.grain).toBeGreaterThan(0);
    // 系统修正 building × 1.2
    expect(result.systemModifiedEarned.grain).toBeGreaterThan(result.snapshot.totalEarned.grain);
    // 溢出截断
    expect(result.cappedEarned.grain).toBeLessThanOrEqual(500);
    expect(result.overflowResources.grain).toBeGreaterThan(0);
    // 面板完整
    expect(result.panelData.offlineSeconds).toBe(HOUR_S * 10);
  });

  it('§7.1.2 无系统修正时systemModified = snapshot.totalEarned', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 2,
      productionRates: makeRates(),
      currentResources: makeCurrentRes(),
      caps: makeCaps(),
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
    };
    const result = calculateFullOfflineReward(ctx);
    expect(result.systemModifiedEarned.grain).toBe(result.snapshot.totalEarned.grain);
  });

  it('§7.1.3 铜钱(无上限)永不截断', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 24,
      productionRates: makeRates({ gold: 1000 }),
      currentResources: makeCurrentRes({ gold: 999999 }),
      caps: makeCaps(),
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
    };
    const result = calculateFullOfflineReward(ctx);
    expect(result.overflowResources.gold).toBe(0);
    expect(result.cappedEarned.gold).toBe(result.systemModifiedEarned.gold);
  });

  it('§7.1.4 溢出资源+cappedEarned = systemModifiedEarned', () => {
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
    const total = result.cappedEarned.grain + result.overflowResources.grain;
    expect(total).toBe(result.systemModifiedEarned.grain);
  });

  it('§7.1.5 OfflineRewardSystem完整收益与引擎一致', () => {
    const sys = new OfflineRewardSystem();
    sys.reset();
    const rates = makeRates({ grain: 100 });
    const ctx = {
      offlineSeconds: HOUR_S * 10,
      productionRates: rates,
      currentResources: makeCurrentRes(),
      caps: makeCaps({ grain: 999999 }),
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
      systemId: 'resource',
    };
    const engineResult = calculateFullOfflineReward(ctx);
    const sysResult = sys.calculateFullReward(
      HOUR_S * 10, rates, makeCurrentRes(), makeCaps({ grain: 999999 }), 0, 'resource',
    );
    // 基础快照收益一致
    expect(sysResult.snapshot.totalEarned.grain).toBe(engineResult.snapshot.totalEarned.grain);
  });
});

// ─────────────────────────────────────────────
// §7.2 建筑系统闭环
// ─────────────────────────────────────────────

describe('§7.2 建筑系统闭环', () => {
  let snapshotSystem: OfflineSnapshotSystem;
  const now = Date.now();

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

  it('§7.2.1 建筑快照→完成检测→收益闭环', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates({ grain: 100 }),
      caps: makeCaps(),
      buildingQueue: [
        { buildingType: 'farm', startTime: now - HOUR_S * 6000, endTime: now - HOUR_S * 1000 },
      ],
    });
    const completed = snapshotSystem.getCompletedBuildings(now);
    expect(completed).toHaveLength(1);
    expect(completed[0].buildingType).toBe('farm');
    // 用快照中的产出速率计算离线收益
    const rates = snapshotSystem.getSnapshot()!.productionRates;
    const snap = calculateOfflineSnapshot(HOUR_S * 10, rates, {});
    expect(snap.totalEarned.grain).toBeGreaterThan(0);
  });

  it('§7.2.2 多建筑排队全部完成', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      buildingQueue: [
        { buildingType: 'farm', startTime: now - HOUR_S * 6000, endTime: now - HOUR_S * 4000 },
        { buildingType: 'barracks', startTime: now - HOUR_S * 5000, endTime: now - HOUR_S * 1000 },
        { buildingType: 'castle', startTime: now - HOUR_S * 3000, endTime: now - HOUR_S * 500 },
      ],
    });
    const completed = snapshotSystem.getCompletedBuildings(now);
    expect(completed).toHaveLength(3);
  });

  it('§7.2.3 未完成建筑不在完成列表', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      buildingQueue: [
        { buildingType: 'farm', startTime: now - HOUR_S * 1000, endTime: now + HOUR_S * 5000 },
      ],
    });
    const completed = snapshotSystem.getCompletedBuildings(now);
    expect(completed).toHaveLength(0);
  });

  it('§7.2.4 建筑产出修正×1.2', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const snap = calculateOfflineSnapshot(HOUR_S * 2, rates, {});
    const modified = { grain: Math.floor(snap.totalEarned.grain * getSystemModifier('building')) };
    expect(modified.grain).toBe(Math.floor(snap.totalEarned.grain * 1.2));
  });
});

// ─────────────────────────────────────────────
// §7.3 远征系统闭环
// ─────────────────────────────────────────────

describe('§7.3 远征系统闭环', () => {
  let snapshotSystem: OfflineSnapshotSystem;
  const now = Date.now();

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

  it('§7.3.1 远征快照→完成检测→修正闭环', () => {
    const reward: Resources = { grain: 500, gold: 200, troops: 100, mandate: 0, techPoint: 0 };
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      expeditionQueue: [
        { expeditionId: 'exp_01', startTime: now - HOUR_S * 8000, endTime: now - HOUR_S * 2000, estimatedReward: reward },
      ],
    });
    const completed = snapshotSystem.getCompletedExpeditions(now);
    expect(completed).toHaveLength(1);
    expect(completed[0].estimatedReward.grain).toBe(500);
  });

  it('§7.3.2 远征系统修正×0.85', () => {
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

  it('§7.3.3 远征未完成不在完成列表', () => {
    snapshotSystem.createSnapshot({
      resources: makeCurrentRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      expeditionQueue: [
        { expeditionId: 'exp_01', startTime: now, endTime: now + HOUR_S * 5000, estimatedReward: zeroRes() },
      ],
    });
    const completed = snapshotSystem.getCompletedExpeditions(now);
    expect(completed).toHaveLength(0);
  });

  it('§7.3.4 远征收益+离线收益组合', () => {
    const sys = new OfflineRewardSystem();
    sys.reset();
    const result = sys.calculateFullReward(
      HOUR_S * 10, makeRates({ grain: 100 }), makeCurrentRes(),
      makeCaps({ grain: 999999 }), 0, 'expedition',
    );
    // 远征修正
    expect(result.systemModifiedEarned.grain).toBe(Math.floor(result.snapshot.totalEarned.grain * 0.85));
  });
});

// ─────────────────────────────────────────────
// §7.4 翻倍联动
// ─────────────────────────────────────────────

describe('§7.4 翻倍联动', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§7.4.1 计算收益→翻倍→领取全链路', () => {
    const result = rewardSystem.calculateOfflineReward(
      HOUR_S * 10, makeRates({ grain: 100 }), makeCurrentRes(),
      makeCaps({ grain: 999999 }), 0, 'resource',
    );
    // 面板展示
    expect(result.panelData.totalEarned.grain).toBeGreaterThan(0);
    // 广告翻倍
    const doubleResult = applyDouble(result.cappedEarned, { source: 'ad', multiplier: 2, description: '' }, 0);
    expect(doubleResult.success).toBe(true);
    expect(doubleResult.doubledEarned.grain).toBe(result.cappedEarned.grain * 2);
    // 领取
    const claimed = rewardSystem.claimReward(result);
    expect(claimed).not.toBeNull();
    expect(claimed!.grain).toBeGreaterThan(0);
  });

  it('§7.4.2 翻倍后收益翻倍', () => {
    const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 10 };
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '' }, 0);
    expect(result.doubledEarned.grain).toBe(2000);
    expect(result.doubledEarned.gold).toBe(1000);
    expect(result.doubledEarned.troops).toBe(400);
  });

  it('§7.4.3 VIP翻倍次数联动', () => {
    // VIP0: dailyDoubleLimit = 1
    const bonus = rewardSystem.getVipBonus(0);
    expect(bonus.dailyDoubleLimit).toBe(1);
    // 用完一次
    rewardSystem.applyDouble(zeroRes(), { source: 'vip', multiplier: 2, description: '' });
    // 不再出现VIP翻倍选项
    const doubles = rewardSystem.getAvailableDoubles(HOUR_S * 2, 0);
    const vipDouble = doubles.find(d => d.source === 'vip');
    expect(vipDouble).toBeUndefined();
  });

  it('§7.4.4 防重复领取', () => {
    const result = rewardSystem.calculateOfflineReward(
      HOUR_S * 2, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    const first = rewardSystem.claimReward(result);
    expect(first).not.toBeNull();
    const second = rewardSystem.claimReward(result);
    expect(second).toBeNull();
  });

  it('§7.4.5 新一轮计算重置claimed', () => {
    const result1 = rewardSystem.calculateOfflineReward(
      HOUR_S * 2, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    rewardSystem.claimReward(result1);
    const result2 = rewardSystem.calculateOfflineReward(
      HOUR_S * 4, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    const claimed = rewardSystem.claimReward(result2);
    expect(claimed).not.toBeNull();
  });
});

// ─────────────────────────────────────────────
// §7.8 资源保护
// ─────────────────────────────────────────────

describe('§7.8 资源保护', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§7.8.1 粮食保护30%最低100', () => {
    const prot = rewardSystem.getResourceProtection('grain', 500);
    expect(prot).toBe(Math.max(500 * 0.3, 100));
  });

  it('§7.8.2 铜钱保护20%最低500', () => {
    const prot = rewardSystem.getResourceProtection('gold', 1000);
    expect(prot).toBe(Math.max(1000 * 0.2, 500));
  });

  it('§7.8.3 兵力保护40%最低50', () => {
    const prot = rewardSystem.getResourceProtection('troops', 200);
    expect(prot).toBe(Math.max(200 * 0.4, 50));
  });

  it('§7.8.4 低资源时使用保底值', () => {
    // grain: 200 * 0.3 = 60 < 100, 使用保底100
    const prot = rewardSystem.getResourceProtection('grain', 200);
    expect(prot).toBe(100);
  });

  it('§7.8.5 高资源时使用比例值', () => {
    // grain: 10000 * 0.3 = 3000 > 100, 使用比例值
    const prot = rewardSystem.getResourceProtection('grain', 10000);
    expect(prot).toBe(3000);
  });

  it('§7.8.6 未知资源类型保护为0', () => {
    const prot = rewardSystem.getResourceProtection('unknown', 1000);
    expect(prot).toBe(0);
  });

  it('§7.8.7 applyResourceProtection正确截断', () => {
    // grain: current=1000, protection=max(300,100)=300
    // requested=800, available = max(0, 1000-300) = 700
    const allowed = rewardSystem.applyResourceProtection('grain', 1000, 800);
    expect(allowed).toBe(700);
  });

  it('§7.8.8 保护线以下不允许扣除', () => {
    // grain: current=100, protection=max(30,100)=100
    // available = max(0, 100-100) = 0
    const allowed = rewardSystem.applyResourceProtection('grain', 100, 50);
    expect(allowed).toBe(0);
  });
});

// ─────────────────────────────────────────────
// §7.9 回归完整性（端到端）
// ─────────────────────────────────────────────

describe('§7.9 回归完整性', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§7.9.1 完整回归流程: 计算→面板→领取→防重复', () => {
    const result = rewardSystem.calculateOfflineReward(
      HOUR_S * 10, makeRates({ grain: 100 }), makeCurrentRes({ grain: 100 }),
      makeCaps({ grain: 999999 }), 1, 'building',
    );
    // 面板完整
    expect(result.panelData.offlineSeconds).toBe(HOUR_S * 10);
    expect(result.panelData.totalEarned.grain).toBeGreaterThan(0);
    expect(result.panelData.availableDoubles.length).toBeGreaterThan(0);
    // 领取
    const claimed = rewardSystem.claimReward(result);
    expect(claimed).not.toBeNull();
    expect(claimed!.grain).toBeGreaterThan(0);
    // 防重复
    expect(rewardSystem.claimReward(result)).toBeNull();
  });

  it('§7.9.2 短时间离线(≤5min)不弹窗但可领取', () => {
    const result = rewardSystem.calculateOfflineReward(
      60, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    expect(shouldShowOfflinePopup(60)).toBe(false);
    const claimed = rewardSystem.claimReward(result);
    expect(claimed).not.toBeNull();
  });

  it('§7.9.3 长时间离线(>72h)封顶但可领取', () => {
    const result = rewardSystem.calculateOfflineReward(
      HOUR_S * 100, makeRates({ grain: 100 }), makeCurrentRes(),
      makeCaps({ grain: 999999 }), 0, 'resource',
    );
    expect(result.snapshot.isCapped).toBe(true);
    const claimed = rewardSystem.claimReward(result);
    expect(claimed).not.toBeNull();
    expect(claimed!.grain).toBeGreaterThan(0);
  });

  it('§7.9.4 多次离线回归不累积错误', () => {
    for (let i = 1; i <= 5; i++) {
      const result = rewardSystem.calculateOfflineReward(
        HOUR_S * i, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
      );
      const claimed = rewardSystem.claimReward(result);
      expect(claimed).not.toBeNull();
    }
  });

  it('§7.9.5 VIP加成+系统修正+溢出全链路', () => {
    const result = rewardSystem.calculateFullReward(
      HOUR_S * 10, makeRates({ grain: 100 }), makeCurrentRes({ grain: 4500 }),
      makeCaps({ grain: 5000 }), 3, 'building',
    );
    // VIP3: +15%
    expect(result.vipBoostedEarned.grain).toBeGreaterThan(result.snapshot.totalEarned.grain);
    // Building × 1.2
    expect(result.systemModifiedEarned.grain).toBeGreaterThan(result.vipBoostedEarned.grain);
    // 溢出截断
    expect(result.cappedEarned.grain).toBeLessThanOrEqual(500);
    expect(result.overflowResources.grain).toBeGreaterThan(0);
  });

  it('§7.9.6 序列化→反序列化→数据一致', () => {
    rewardSystem.addBoostItem('offline_double', 3);
    rewardSystem.upgradeWarehouse('grain');
    rewardSystem.setLastOfflineTime(Date.now() - HOUR_S * 5000);
    const serialized = rewardSystem.serialize();
    const newSys = new OfflineRewardSystem();
    newSys.deserialize(serialized);
    const reSerialized = newSys.serialize();
    expect(reSerialized.boostItems['offline_double']).toBe(3);
    expect(reSerialized.warehouseLevels['grain']).toBe(2);
    expect(reSerialized.lastOfflineTime).toBe(serialized.lastOfflineTime);
  });
});

// ─────────────────────────────────────────────
// §7.10 交叉验证
// ─────────────────────────────────────────────

describe('§7.10 交叉验证', () => {
  it('§7.10.1 格式化时长覆盖各种场景', () => {
    expect(formatOfflineDuration(0)).toBe('刚刚');
    expect(formatOfflineDuration(30)).toBe('30秒');
    expect(formatOfflineDuration(90)).toBe('1分钟');
    expect(formatOfflineDuration(HOUR_S)).toBe('1小时');
    expect(formatOfflineDuration(HOUR_S * 2 + 1800)).toBe('2小时30分钟');
    expect(formatOfflineDuration(HOUR_S * 24)).toBe('1天');
    expect(formatOfflineDuration(HOUR_S * 25)).toBe('1天1小时');
  });

  it('§7.10.2 弹窗阈值=300秒', () => {
    expect(OFFLINE_POPUP_THRESHOLD).toBe(300);
    expect(shouldShowOfflinePopup(300)).toBe(false);
    expect(shouldShowOfflinePopup(301)).toBe(true);
  });

  it('§7.10.3 OfflineRewardSystem与OfflineRewardEngine快照一致', () => {
    const sys = new OfflineRewardSystem();
    sys.reset();
    const rates = makeRates({ grain: 100 });
    const sysSnap = sys.calculateSnapshot(HOUR_S * 5, rates);
    const engineSnap = calculateOfflineSnapshot(HOUR_S * 5, rates, {});
    // 允许微小差异
    expect(Math.abs(sysSnap.totalEarned.grain - engineSnap.totalEarned.grain)).toBeLessThanOrEqual(1);
  });

  it('§7.10.4 OfflineEstimateSystem与OfflineRewardEngine预估一致', () => {
    const estimateSys = new OfflineEstimateSystem();
    const rates = makeRates({ grain: 100 });
    const estimatePoint = estimateSys.estimateForHours(5, rates);
    const engineSnap = calculateOfflineSnapshot(HOUR_S * 5, rates, {});
    // 允许微小差异
    expect(Math.abs(estimatePoint.earned.grain - engineSnap.totalEarned.grain)).toBeLessThanOrEqual(1);
  });

  it('§7.10.5 VIP加成表完整', () => {
    expect(VIP_OFFLINE_BONUSES.length).toBeGreaterThanOrEqual(6);
    // VIP0
    expect(VIP_OFFLINE_BONUSES[0].vipLevel).toBe(0);
    // VIP5
    const vip5 = VIP_OFFLINE_BONUSES.find(b => b.vipLevel === 5);
    expect(vip5).toBeDefined();
    expect(vip5!.efficiencyBonus).toBe(0.25);
  });

  it('§7.10.6 仓库扩容配置正确', () => {
    expect(DEFAULT_WAREHOUSE_EXPANSIONS.length).toBeGreaterThanOrEqual(2);
    const grainExp = DEFAULT_WAREHOUSE_EXPANSIONS.find(e => e.resourceType === 'grain');
    expect(grainExp!.baseCapacity).toBe(2000);
    expect(grainExp!.perLevelIncrease).toBe(1000);
  });

  it('§7.10.7 OfflineRewardSystem仓库扩容闭环', () => {
    const sys = new OfflineRewardSystem();
    sys.reset();
    const initialCap = sys.getWarehouseCapacity('grain');
    expect(initialCap).toBe(2000); // baseCapacity
    const result = sys.upgradeWarehouse('grain');
    expect(result.success).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(sys.getWarehouseCapacity('grain')).toBe(3000);
  });

  it('§7.10.8 OfflineSnapshotSystem仓库扩容闭环', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
    const snapSys = new OfflineSnapshotSystem(storage as unknown as Storage);
    const result = snapSys.expandWarehouse('grain');
    expect(result.success).toBe(true);
    expect(result.newLevel).toBe(2);
    // OfflineSnapshotSystem uses baseCapacity + perLevelIncrease * level
    // previousCapacity = 2000 + 1000 * 1 = 3000, newCapacity = 2000 + 1000 * 2 = 4000
    expect(result.newCapacity).toBe(4000);
    expect(result.previousCapacity).toBe(3000);
  });
});
