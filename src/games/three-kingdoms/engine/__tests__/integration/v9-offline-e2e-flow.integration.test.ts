/**
 * v9.0 离线收益端到端串联流程 Play 集成测试
 *
 * 覆盖范围（按 play 文档§7交叉验证章节组织）：
 * - §7.5 离线收益→邮件系统→活动奖励三系统串联
 * - §7.6 邮件过期→清理→补偿全链路
 * - §7.7 邮箱满载→暂存→清理→补发全链路
 * - §7.8 资源保护→离线收益→溢出提示联动
 * - §7.10 回归流程完整性验证
 * - §7.11 活动离线→回归面板→邮件→活动面板四系统串联
 * - §7.12 经验离线→升级→邮件→回归面板联动
 * - §7.15 邮件暂存队列补发顺序与完整性验证
 * - §7.18 快照降级→邮件通知联动验证
 * - §7.22 五系统全链路端到端验证
 *
 * 测试原则：
 * - 每个it前创建新的sim实例
 * - describe按play流程ID组织
 * - 引擎未实现 it.todo + [引擎未实现]
 * - 不使用 as any
 *
 * @see docs/games/three-kingdoms/play/v9-play.md
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

function createProductionRates(): Resources {
  return { grain: 100, gold: 50, troops: 10, mandate: 0, techPoint: 0, recruitToken: 0 };
}

function createFullRates(): Resources {
  return { grain: 100, gold: 50, troops: 10, mandate: 5, techPoint: 2, recruitToken: 1 };
}

function createSnapshotParams() {
  return {
    resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 },
    productionRates: createProductionRates(),
    caps: { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
    buildingQueue: [],
    techQueue: [],
    expeditionQueue: [],
    tradeCaravans: [],
  };
}

function createFullSnapshotParams() {
  const now = Date.now();
  return {
    resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 10, recruitToken: 5 },
    productionRates: createFullRates(),
    caps: { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
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
// §7.5 离线收益→邮件系统→活动奖励三系统串联
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.5 离线收益→邮件系统→活动奖励三系统串联', () => {

  it('§7.5 离线收益弹窗资源数值与公式一致 [引擎未实现]', () => {
    // Play: Step1离线收益弹窗(资源收益) → Step2回归面板(含活动进度摘要) → 邮件系统
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    // 计算离线收益
    const result = offlineReward.calculateOfflineReward(36000, rates, current, caps, 0, 'resource');

    // 弹窗面板数据应与公式计算结果一致
    expect(result.panelData.totalEarned.grain).toBe(result.cappedEarned.grain + result.overflowResources.grain);
    expect(result.panelData.totalEarned.gold).toBe(result.cappedEarned.gold + result.overflowResources.gold);

    // 手动验证公式一致
    const snapshot = calculateOfflineSnapshot(36000, rates, {});
    expect(result.snapshot.totalEarned.grain).toBe(snapshot.totalEarned.grain);
  });

  it('§7.5 三大系统无重复发放、无遗漏 [引擎未实现]', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    // 计算跨系统收益
    const crossResult = offlineReward.calculateCrossSystemReward(36000, rates, current, caps, 0);

    // 三大系统无重复发放
    expect(crossResult.noDuplicates).toBe(true);

    // 各系统收益独立计算
    expect(crossResult.resourceReward.grain).toBeGreaterThan(0);
    expect(crossResult.buildingReward.grain).toBeGreaterThan(0);
    expect(crossResult.expeditionReward.grain).toBeGreaterThan(0);

    // 总收益 = 三系统之和
    const expectedTotal = crossResult.resourceReward.grain + crossResult.buildingReward.grain + crossResult.expeditionReward.grain;
    expect(crossResult.totalReward.grain).toBe(expectedTotal);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.6 邮件过期→清理→补偿全链路
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.6 邮件过期→清理→补偿全链路', () => {

  it.todo('§7.6 过期前3天黄色⚠️标签 [UI层测试]', () => {
    // UI层验证
  });

  it('§7.6 过期后自动清理+铜钱50%补偿邮件 [引擎未实现]', () => {
    // Play: 奖励邮件过期后铜钱/经验补发50%到新邮件
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    // 模拟过期邮件
    const expiredMails = [
      { id: 'mail_1', title: '离线奖励', attachments: [{ resourceType: 'gold', amount: 1000 }] },
      { id: 'mail_2', title: '远征战利品', attachments: [{ resourceType: 'gold', amount: 500 }, { resourceType: 'grain', amount: 2000 }] },
      { id: 'mail_3', title: '无铜钱奖励', attachments: [{ resourceType: 'grain', amount: 3000 }] },
    ];

    const compensations = offlineReward.processExpiredMailCompensation(expiredMails);

    // mail_1: gold=1000, 补偿50%=500
    expect(compensations.length).toBe(2); // 只有含gold的邮件才有补偿
    expect(compensations[0].originalMailId).toBe('mail_1');
    expect(compensations[0].compensationGold).toBe(500); // 1000 * 50%

    // mail_2: gold=500, 补偿50%=250
    expect(compensations[1].originalMailId).toBe('mail_2');
    expect(compensations[1].compensationGold).toBe(250); // 500 * 50%
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.7 邮箱满载→暂存→清理→补发全链路
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.7 邮箱满载→暂存→清理→补发全链路', () => {

  it.todo('§7.7 满载后新邮件进入暂存队列(上限20封) [引擎未实现]', () => {
    // 引擎未实现邮件暂存队列
  });

  it.todo('§7.7 清理后暂存邮件按FIFO顺序补发 [引擎未实现]', () => {
    // 引擎未实现邮件补发
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.8 资源保护→离线收益→溢出提示联动
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.8 资源保护→离线收益→溢出提示联动', () => {

  it('§7.8 粮草接近上限时离线收益应截断', () => {
    // Play: 粮草接近粮仓上限(95%+) → 离线8h → 截断至粮仓上限
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    // 粮草95%满
    const current: Resources = { grain: 47500, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(28800, rates, current, caps, 0, 'resource');

    // 粮草应被截断
    expect(result.cappedEarned.grain).toBeLessThanOrEqual(2500); // cap - current = 50000 - 47500 = 2500
    expect(result.overflowResources.grain).toBeGreaterThan(0);
  });

  it('§7.8 铜钱(无上限)应全额发放无截断', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const current: Resources = { grain: 47500, gold: 999999, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(28800, rates, current, caps, 0, 'resource');

    // gold cap=null，全额发放
    expect(result.cappedEarned.gold).toBeGreaterThan(0);
    expect(result.overflowResources.gold).toBe(0);
  });

  it('§7.8 兵力截断至兵营容量', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const current: Resources = { grain: 1000, gold: 500, troops: 9500, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(28800, rates, current, caps, 0, 'resource');

    // troops应被截断
    expect(result.cappedEarned.troops).toBeLessThanOrEqual(500); // cap - current = 10000 - 9500 = 500
    expect(result.overflowResources.troops).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.10 回归流程完整性验证
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.10 回归流程完整性验证', () => {

  it('§7.10 完整回归流程: 快照→计算→翻倍→领取→清理', () => {
    // Play: Step1弹窗展示完整收益数据+翻倍选项 → Step2回归面板 → 邮件 → 活动面板
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    const rates = createProductionRates();

    // 1. 创建快照（模拟下线）
    snapshotSys.createSnapshot(createFullSnapshotParams());
    expect(snapshotSys.getSnapshot()).not.toBeNull();

    // 2. 计算离线收益（模拟12h后上线）
    const offlineSeconds = 43200; // 12h
    const current: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 10, recruitToken: 5 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateOfflineReward(offlineSeconds, rates, current, caps, 3, 'building');

    // 3. 验证收益数据完整
    expect(result.snapshot).toBeDefined();
    expect(result.cappedEarned).toBeDefined();
    expect(result.panelData).toBeDefined();
    expect(result.panelData.availableDoubles.length).toBeGreaterThan(0);

    // 4. 翻倍
    const doubleResult = offlineReward.applyDouble(result.cappedEarned, {
      source: 'ad',
      multiplier: 2,
      description: '广告翻倍',
    });
    expect(doubleResult.success).toBe(true);

    // 5. 领取
    const claimed = offlineReward.claimReward(result);
    expect(claimed).not.toBeNull();
    expect(claimed!.grain).toBeGreaterThan(0);

    // 6. 防止重复领取
    const claimedAgain = offlineReward.claimReward(result);
    expect(claimedAgain).toBeNull();

    // 7. 清理快照
    snapshotSys.clearSnapshot();
    expect(snapshotSys.getSnapshot()).toBeNull();
  });

  it('§7.10 回归面板应包含完整数据', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    const rates = createFullRates();

    snapshotSys.createSnapshot(createFullSnapshotParams());

    const panel = offlineReward.generateReturnPanel(43200, rates, 3);

    expect(panel.offlineSeconds).toBe(43200);
    expect(panel.formattedTime).toContain('12');
    expect(panel.efficiencyPercent).toBeGreaterThan(0);
    expect(panel.tierDetails.length).toBeGreaterThan(0);
    expect(panel.totalEarned.grain).toBeGreaterThan(0);
    expect(panel.availableDoubles.length).toBeGreaterThan(0);
  });

  it('§7.10 回归面板应展示建筑/科技/远征完成列表', () => {
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    snapshotSys.createSnapshot(createFullSnapshotParams());

    const futureTime = Date.now() + 43200000; // 12h后

    const completedBuildings = snapshotSys.getCompletedBuildings(futureTime);
    const completedTech = snapshotSys.getCompletedTech(futureTime);
    const completedExpeditions = snapshotSys.getCompletedExpeditions(futureTime);
    const completedTrades = snapshotSys.getCompletedTrades(futureTime);

    expect(completedBuildings.length).toBe(2);
    expect(completedTech.length).toBe(1);
    expect(completedExpeditions.length).toBe(1);
    expect(completedTrades.length).toBe(1);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.11 活动离线→回归面板→邮件→活动面板四系统串联
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.11 活动离线→回归面板→邮件→活动面板四系统串联', () => {

  it.todo('§7.11 赛季活动积分按50%效率累积 [引擎未实现]', () => {
    // Play: 赛季活动50%效率累积积分+代币
    // 引擎未实现活动离线积分
  });

  it.todo('§7.11 限时活动按30%效率累积 [引擎未实现]', () => {
    // 引擎未实现活动离线积分
  });

  it.todo('§7.11 各活动积分独立不混淆 [引擎未实现]', () => {
    // 引擎未实现活动积分系统
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.12 经验离线→升级→邮件→回归面板联动
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.12 经验离线→升级→邮件→回归面板联动', () => {

  it.todo('§7.12 离线经验正确计算 [引擎未实现]', () => {
    // Play: 离线经验 = 基础经验速率 × 离线秒数 × 衰减系数 × (1+经验加成)
    // 引擎未实现经验离线计算
  });

  it.todo('§7.12 经验溢出推动升级 [引擎未实现]', () => {
    // Play: 经验溢出推动升级时等级正确提升
    // 引擎未实现经验溢出升级
  });

  it.todo('§7.12 升级奖励邮件自动发放 [引擎未实现]', () => {
    // 引擎未实现升级奖励邮件
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.15 邮件暂存队列补发顺序与完整性验证
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.15 邮件暂存队列补发顺序与完整性', () => {

  it.todo('§7.15 暂存队列FIFO(先进先出) [引擎未实现]', () => {
    // 引擎未实现邮件暂存队列
  });

  it.todo('§7.15 暂存上限20封硬限制 [引擎未实现]', () => {
    // 引擎未实现邮件暂存队列
  });

  it.todo('§7.15 超过20封丢弃+通知 [引擎未实现]', () => {
    // 引擎未实现邮件暂存溢出处理
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.18 快照降级→邮件通知联动验证
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.18 快照降级→邮件通知联动', () => {

  it('§7.18 快照丢失时收益仍可正常计算', () => {
    // Play: 快照丢失时使用默认产出速率计算收益，收益不归零
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(3600, rates, {});

    expect(snapshot.totalEarned.grain).toBeGreaterThan(0);
  });

  it('§7.18 快照丢失后可正常重新创建', () => {
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    // 无快照
    expect(snapshotSys.getSnapshot()).toBeNull();

    // 重新创建
    snapshotSys.createSnapshot(createSnapshotParams());
    expect(snapshotSys.getSnapshot()).not.toBeNull();
  });

  it.todo('§7.18 降级处理同时触发弹窗+邮件双通道通知 [引擎未实现]', () => {
    // 引擎未实现快照降级通知
  });

  it.todo('§7.18 连续多次快照丢失不重复发送邮件 [引擎未实现]', () => {
    // 引擎未实现快照降级通知
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.22 五系统全链路端到端验证
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.22 五系统全链路端到端验证', () => {

  it('§7.22 完整离线收益计算包含所有系统数据', () => {
    // Play: 多系统同时活跃(建筑升级中+科技研究中+远征中+商队运输中)
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createFullRates();

    // 1. 创建完整快照
    snapshotSys.createSnapshot(createFullSnapshotParams());

    // 2. 预估收益
    const estimateResult = estimate.estimate(rates);
    expect(estimateResult.timeline.length).toBeGreaterThan(0);

    // 3. 计算完整离线收益
    const current: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 10, recruitToken: 5 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(43200, rates, current, caps, 3, 'building');

    // 4. 验证各系统数据
    // 4.1 快照数据
    expect(result.snapshot.offlineSeconds).toBe(43200);
    expect(result.snapshot.tierDetails.length).toBeGreaterThan(0);

    // 4.2 VIP加成
    expect(result.vipBoostedEarned.grain).toBeGreaterThan(result.snapshot.totalEarned.grain);

    // 4.3 系统修正
    expect(result.systemModifiedEarned.grain).toBeGreaterThan(result.vipBoostedEarned.grain);

    // 4.4 溢出处理
    expect(result.cappedEarned).toBeDefined();
    expect(result.overflowResources).toBeDefined();

    // 4.5 贸易汇总
    expect(result.tradeSummary).toBeDefined();

    // 4.6 面板数据
    expect(result.panelData).toBeDefined();
    expect(result.panelData.totalEarned.grain).toBeGreaterThan(0);

    // 5. 检测完成队列
    const futureTime = Date.now() + 43200000;
    const completedBuildings = snapshotSys.getCompletedBuildings(futureTime);
    const completedTech = snapshotSys.getCompletedTech(futureTime);
    const completedExpeditions = snapshotSys.getCompletedExpeditions(futureTime);
    const completedTrades = snapshotSys.getCompletedTrades(futureTime);

    expect(completedBuildings.length).toBe(2);
    expect(completedTech.length).toBe(1);
    expect(completedExpeditions.length).toBe(1);
    expect(completedTrades.length).toBe(1);
  });

  it('§7.22 完整领取流程不遗漏不重复', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createFullRates();
    const current: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 10, recruitToken: 5 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    // 计算收益
    const result = offlineReward.calculateOfflineReward(43200, rates, current, caps, 0, 'resource');

    // 第一次领取成功
    const claimed1 = offlineReward.claimReward(result);
    expect(claimed1).not.toBeNull();

    // 第二次领取失败（防重复）
    const claimed2 = offlineReward.claimReward(result);
    expect(claimed2).toBeNull();
  });

  it('§7.22 翻倍+领取完整流程', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createFullRates();
    const current: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 10, recruitToken: 5 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    // 计算收益
    const result = offlineReward.calculateOfflineReward(43200, rates, current, caps, 0, 'resource');

    // 翻倍
    const doubleResult = offlineReward.applyDouble(result.cappedEarned, {
      source: 'ad',
      multiplier: 2,
      description: '广告翻倍',
    });
    expect(doubleResult.success).toBe(true);

    // 翻倍后收益应为原始×2
    expect(doubleResult.doubledEarned.grain).toBe(result.cappedEarned.grain * 2);

    // 领取（基于原始收益，翻倍在业务层处理）
    const claimed = offlineReward.claimReward(result);
    expect(claimed).not.toBeNull();
    expect(claimed!.grain).toBe(result.cappedEarned.grain);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.23 离线领土变化视觉标记UI验证 (E2E补充)
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.23 离线领土变化视觉标记', () => {

  it.todo('§7.23 金色脉冲"新"标签(24h) [UI层测试]', () => {
    // UI层验证
  });

  it.todo('§7.23 红色脉冲"失"标签(12h) [UI层测试]', () => {
    // UI层验证
  });

  it.todo('§7.23 产出气泡闪烁 [UI层测试]', () => {
    // UI层验证
  });

  it.todo('§7.23 视觉标记性能(≥30fps) [UI层测试]', () => {
    // UI层验证
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.26 离线→声望→活动积分三角闭环 (E2E补充)
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — §7.26 离线→声望→活动积分三角闭环', () => {

  it('§7.26 声望加成正确影响离线收益', () => {
    // Play: 声望等级越高离线收益越高
    const rates = createProductionRates();
    const noRep = calculateOfflineSnapshot(36000, rates, { reputation: 0 });
    const rep10 = calculateOfflineSnapshot(36000, rates, { reputation: 0.10 });
    const rep25 = calculateOfflineSnapshot(36000, rates, { reputation: 0.25 });

    expect(rep10.totalEarned.grain).toBeGreaterThan(noRep.totalEarned.grain);
    expect(rep25.totalEarned.grain).toBeGreaterThan(rep10.totalEarned.grain);
  });

  it.todo('§7.26 声望升级后加成立即影响后续计算 [引擎未实现]', () => {
    // 引擎未实现声望升级联动
  });

});

// ═══════════════════════════════════════════════════════════════
// 格式化离线时长验证
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — 格式化离线时长', () => {

  it('应正确格式化各种离线时长', () => {
    // formatOfflineDuration 已在文件顶部导入
    expect(formatOfflineDuration(0)).toBe('刚刚');
    expect(formatOfflineDuration(30)).toBe('30秒');
    expect(formatOfflineDuration(60)).toBe('1分钟');
    expect(formatOfflineDuration(90)).toBe('1分钟');
    expect(formatOfflineDuration(300)).toBe('5分钟');
    expect(formatOfflineDuration(3600)).toBe('1小时');
    expect(formatOfflineDuration(5400)).toBe('1小时30分钟');
    expect(formatOfflineDuration(86400)).toBe('1天');
    expect(formatOfflineDuration(90000)).toBe('1天1小时');
    expect(formatOfflineDuration(172800)).toBe('2天');
  });

});

// ═══════════════════════════════════════════════════════════════
// 防重复领取验证
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — 防重复领取', () => {

  it('同一收益不可重复领取', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateOfflineReward(3600, rates, current, caps, 0, 'resource');

    // 第一次领取成功
    const claimed1 = offlineReward.claimReward(result);
    expect(claimed1).not.toBeNull();

    // 第二次领取失败
    const claimed2 = offlineReward.claimReward(result);
    expect(claimed2).toBeNull();
  });

  it('重新计算后可再次领取', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    // 第一次计算+领取
    const result1 = offlineReward.calculateOfflineReward(3600, rates, current, caps, 0, 'resource');
    const claimed1 = offlineReward.claimReward(result1);
    expect(claimed1).not.toBeNull();

    // 重新计算（新的离线周期）
    const result2 = offlineReward.calculateOfflineReward(7200, rates, current, caps, 0, 'resource');
    const claimed2 = offlineReward.claimReward(result2);
    expect(claimed2).not.toBeNull();
  });

});

// ═══════════════════════════════════════════════════════════════
// 序列化/反序列化验证
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — 序列化/反序列化', () => {

  it('OfflineRewardSystem应正确序列化和反序列化', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    // 添加一些状态
    offlineReward.addBoostItem('offline_boost_1h', 3);
    offlineReward.setLastOfflineTime(Date.now() - 3600000);

    // 序列化
    const saved = offlineReward.serialize();
    expect(saved.lastOfflineTime).toBeGreaterThan(0);
    expect(saved.boostItems['offline_boost_1h']).toBe(3);

    // 反序列化到新实例
    const sim2 = createSim();
    const offlineReward2 = sim2.engine.getOfflineRewardSystem();
    offlineReward2.deserialize(saved);

    expect(offlineReward2.getLastOfflineTime()).toBe(saved.lastOfflineTime);
  });

  it('OfflineSnapshotSystem应正确管理存档数据', () => {
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createSnapshotParams());

    const saveData = snapshotSys.getSaveData();
    expect(saveData.lastOfflineTime).toBeGreaterThan(0);
    expect(saveData.version).toBe(1);
  });

});

// ═══════════════════════════════════════════════════════════════
// 仓库扩容验证
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — 仓库扩容', () => {

  it('应正确扩容仓库', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const initialCap = offlineReward.getWarehouseCapacity('grain');
    expect(initialCap).toBeGreaterThan(0);

    const result = offlineReward.upgradeWarehouse('grain');
    expect(result.success).toBe(true);
    expect(result.newCapacity).toBeGreaterThan(result.previousCapacity);
    expect(result.newLevel).toBeGreaterThan(0);
  });

  it('仓库等级应正确记录', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const initialLevel = offlineReward.getWarehouseLevel('grain');
    offlineReward.upgradeWarehouse('grain');
    expect(offlineReward.getWarehouseLevel('grain')).toBe(initialLevel + 1);
  });

});

// ═══════════════════════════════════════════════════════════════
// 效率曲线验证
// ═══════════════════════════════════════════════════════════════
describe('v9.0 E2E — 效率曲线', () => {

  it('效率曲线应单调递减', () => {
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();

    const curve = estimate.getEfficiencyCurve(72);
    expect(curve.length).toBe(72);

    // 效率应单调递减
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].efficiency).toBeLessThanOrEqual(curve[i - 1].efficiency + 0.001);
    }
  });

  it('效率曲线第1小时应接近100%', () => {
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();

    const curve = estimate.getEfficiencyCurve(72);
    expect(curve[0].efficiency).toBeCloseTo(1.0, 1);
  });

  it('效率曲线第72小时应较低', () => {
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();

    const curve = estimate.getEfficiencyCurve(72);
    expect(curve[71].efficiency).toBeLessThan(0.5);
  });

});
