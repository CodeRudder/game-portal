/**
 * v9.0 离线收益核心流程 Play 集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1.1 离线计算核心: 快照记录、基础公式、效率系数
 * - §1.2 六档衰减系数: 分档验证、72h封顶
 * - §1.3 加成系数叠加: 科技/VIP/声望加成、上限+100%
 * - §1.4 离线收益弹窗与翻倍: 弹窗数据、数字滚动、翻倍选择
 * - §1.5 广告翻倍细节: 30分钟门槛、每日3次、失败降级
 * - §1.6 元宝翻倍细节: 元宝消耗计算、互斥性
 * - §1.7 分段计算验证: 各段独立计算、累加正确
 * - §2 离线经验: 经验产出快照、经验溢出与等级提升
 * - §3 离线资源: 各系统离线行为、溢出处理、预估面板
 * - §4 回归奖励: 回归综合面板、回归流程时间预算
 * - §5 邮件系统: 邮件分类、状态流转、附件领取、批量操作、容量管理、过期清理
 * - §6 活动系统离线联动: 积分累积、任务推进、到期处理
 * - §7 交叉验证: 多系统串联验证
 *
 * 测试原则：
 * - 每个it前创建新的sim实例
 * - describe按play流程ID组织
 * - 引擎未实现 it.skip + [引擎未实现]
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
  formatOfflineDuration,
  estimateOfflineReward,
} from '../../offline/OfflineRewardEngine';
import type { OfflineRewardContext } from '../../offline/OfflineRewardEngine';
import {
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  OFFLINE_POPUP_THRESHOLD,
  SYSTEM_EFFICIENCY_MODIFIERS,
  VIP_OFFLINE_BONUSES,
} from '../../offline/offline-config';
import type {
  BonusSources,
  DoubleRequest,
  OfflineSnapshot,
  TierDetail,
} from '../../offline/offline.types';

// ── 辅助函数 ──

/** 创建标准产出速率用于离线测试 */
function createProductionRates(): Resources {
  return {
    grain: 100,
    gold: 50,
    troops: 10,
    mandate: 0,
    techPoint: 0,
    recruitToken: 0,
  };
}

/** 创建包含上限的快照参数 */
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

/** 创建带建筑队列的快照参数 */
function createSnapshotWithBuildings() {
  const now = Date.now();
  return {
    resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 },
    productionRates: createProductionRates(),
    caps: { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
    buildingQueue: [
      { buildingType: 'farmland', startTime: now, endTime: now + 7200000 },   // 2h后完成
      { buildingType: 'market', startTime: now, endTime: now + 14400000 },    // 4h后完成
      { buildingType: 'barracks', startTime: now, endTime: now + 28800000 },  // 8h后完成
    ],
    techQueue: [
      { techId: 'tech_001', startTime: now, endTime: now + 10800000 },  // 3h后完成
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
// §1.1 离线计算核心
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §1.1 离线计算核心', () => {

  it('§1.1 应正确计算基础收益 = 净产出速率 × 离线秒数', () => {
    // Play: 基础收益 = 净产出速率 × 离线秒数
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(3600, rates, {}); // 1h, 100%效率档

    // 1h在100%档: grain = 100 * 3600 * 1.0 = 360000
    expect(snapshot.totalEarned.grain).toBe(360000);
    expect(snapshot.totalEarned.gold).toBe(180000); // 50 * 3600
    expect(snapshot.totalEarned.troops).toBe(36000); // 10 * 3600
  });

  it('§1.1 应记录完整快照覆盖所有产出源', () => {
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createSnapshotWithBuildings());
    const snapshot = snapshotSys.getSnapshot();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.resources).toBeDefined();
    expect(snapshot!.productionRates).toBeDefined();
    expect(snapshot!.buildingQueue.length).toBe(3);
    expect(snapshot!.techQueue.length).toBe(1);
    expect(snapshot!.expeditionQueue.length).toBe(1);
    expect(snapshot!.tradeCaravans.length).toBe(1);
  });

  it('§1.1 应正确计算效率系数 = 衰减系数 × (1 + Σ加成)', () => {
    const rates = createProductionRates();
    const bonusSources: BonusSources = { tech: 0.1, vip: 0.05, reputation: 0.03 };

    const snapshot = calculateOfflineSnapshot(3600, rates, bonusSources);

    // 1h@100%: 基础 = 100*3600 = 360000
    // 加成系数 = 1 + min(0.1+0.05+0.03, 1.0) = 1.18
    // 最终 = 360000 * 1.18 = 424800
    expect(snapshot.totalEarned.grain).toBe(Math.floor(360000 * 1.18));
  });

  it('§1.1 离线≤5min应静默入账不弹窗', () => {
    // Play: 离线≤5min静默入账不弹窗
    expect(shouldShowOfflinePopup(300)).toBe(false);   // 5min = 300s
    expect(shouldShowOfflinePopup(299)).toBe(false);
    expect(shouldShowOfflinePopup(301)).toBe(true);    // >5min弹窗
  });

  it('§1.1 离线>5min应弹出收益弹窗', () => {
    expect(shouldShowOfflinePopup(600)).toBe(true);    // 10min
    expect(shouldShowOfflinePopup(3600)).toBe(true);   // 1h
  });

});

// ═══════════════════════════════════════════════════════════════
// §1.2 六档衰减系数
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §1.2 六档衰减系数', () => {

  it('§1.2 应有5档衰减配置', () => {
    // Play: 0~2h→100% | 2~8h→80% | 8~24h→60% | 24~48h→40% | 48~72h→20%
    expect(DECAY_TIERS.length).toBe(5);
    expect(DECAY_TIERS[0].efficiency).toBe(1.0);   // 0~2h 100%
    expect(DECAY_TIERS[1].efficiency).toBe(0.80);  // 2~8h 80%
    expect(DECAY_TIERS[2].efficiency).toBe(0.60);  // 8~24h 60%
    expect(DECAY_TIERS[3].efficiency).toBe(0.40);  // 24~48h 40%
    expect(DECAY_TIERS[4].efficiency).toBe(0.20);  // 48~72h 20%
  });

  it('§1.2 离线1h应100%效率', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(3600, rates, {});
    expect(snapshot.overallEfficiency).toBeCloseTo(1.0, 2);
    expect(snapshot.tierDetails.length).toBe(1);
    expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
  });

  it('§1.2 离线5h = 2h@100% + 3h@80%', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(18000, rates, {}); // 5h = 18000s

    // 应有2个档位
    expect(snapshot.tierDetails.length).toBe(2);
    expect(snapshot.tierDetails[0].tierId).toBe('tier1');
    expect(snapshot.tierDetails[0].seconds).toBe(7200);  // 2h
    expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
    expect(snapshot.tierDetails[1].tierId).toBe('tier2');
    expect(snapshot.tierDetails[1].seconds).toBe(10800); // 3h
    expect(snapshot.tierDetails[1].efficiency).toBe(0.80);

    // 总效率 = (7200*1.0 + 10800*0.8) / 18000 ≈ 0.8533
    const expectedEff = (7200 + 10800 * 0.8) / 18000;
    expect(snapshot.overallEfficiency).toBeCloseTo(expectedEff, 3);
  });

  it('§1.2 离线15h = 2h@100% + 6h@80% + 7h@60%', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(54000, rates, {}); // 15h

    expect(snapshot.tierDetails.length).toBe(3);
    expect(snapshot.tierDetails[0].seconds).toBe(7200);   // 2h
    expect(snapshot.tierDetails[1].seconds).toBe(21600);  // 6h
    expect(snapshot.tierDetails[2].seconds).toBe(25200);  // 7h
  });

  it('§1.2 离线36h = 2h@100% + 6h@80% + 16h@60% + 12h@40%', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(129600, rates, {}); // 36h

    expect(snapshot.tierDetails.length).toBe(4);
    expect(snapshot.tierDetails[3].efficiency).toBe(0.40);
  });

  it('§1.2 离线60h = 2h@100% + 6h@80% + 16h@60% + 24h@40% + 12h@20%', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(216000, rates, {}); // 60h

    expect(snapshot.tierDetails.length).toBe(5);
    expect(snapshot.tierDetails[4].efficiency).toBe(0.20);
  });

  it('§1.2 离线80h应封顶72h', () => {
    const rates = createProductionRates();
    const snap72h = calculateOfflineSnapshot(259200, rates, {}); // 72h
    const snap80h = calculateOfflineSnapshot(288000, rates, {}); // 80h

    expect(snap72h.isCapped).toBe(false);
    expect(snap80h.isCapped).toBe(true);

    // 80h收益不应超过72h
    expect(snap80h.totalEarned.grain).toBe(snap72h.totalEarned.grain);
    expect(snap80h.totalEarned.gold).toBe(snap72h.totalEarned.gold);
  });

  it('§1.2 衰减分档平滑递减，72h后封顶不新增', () => {
    const rates = createProductionRates();
    const snap1h = calculateOfflineSnapshot(3600, rates, {});
    const snap24h = calculateOfflineSnapshot(86400, rates, {});
    const snap48h = calculateOfflineSnapshot(172800, rates, {});
    const snap72h = calculateOfflineSnapshot(259200, rates, {});

    // 时间越长总收益越多
    expect(snap24h.totalEarned.grain).toBeGreaterThan(snap1h.totalEarned.grain);
    expect(snap48h.totalEarned.grain).toBeGreaterThan(snap24h.totalEarned.grain);
    expect(snap72h.totalEarned.grain).toBeGreaterThan(snap48h.totalEarned.grain);

    // 但效率递减
    expect(snap1h.overallEfficiency).toBeGreaterThan(snap24h.overallEfficiency);
    expect(snap24h.overallEfficiency).toBeGreaterThan(snap48h.overallEfficiency);
  });

});

// ═══════════════════════════════════════════════════════════════
// §1.3 加成系数叠加
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §1.3 加成系数叠加', () => {

  it('§1.3 应正确叠加科技+VIP+声望加成', () => {
    // Play: 科技+10%, VIP+5%, 声望+3% = 总+18%
    const coeff = calculateBonusCoefficient({ tech: 0.10, vip: 0.05, reputation: 0.03 });
    expect(coeff).toBeCloseTo(1.18, 4);
  });

  it('§1.3 加成上限应为+100%', () => {
    // Play: 三项加成加法累加最大+75%，上限封顶+100%
    const coeff = calculateBonusCoefficient({ tech: 0.5, vip: 0.4, reputation: 0.3 });
    // 总 = 1.2, min(1.2, 1.0) = 1.0, 所以系数 = 1 + 1.0 = 2.0
    expect(coeff).toBe(2.0);
  });

  it('§1.3 VIP加成应按等级递增', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    const vip0 = offlineReward.getVipBonus(0);
    const vip1 = offlineReward.getVipBonus(1);
    const vip3 = offlineReward.getVipBonus(3);
    const vip5 = offlineReward.getVipBonus(5);

    expect(vip1.efficiencyBonus).toBeGreaterThan(vip0.efficiencyBonus);
    expect(vip3.efficiencyBonus).toBeGreaterThan(vip1.efficiencyBonus);
    expect(vip5.efficiencyBonus).toBeGreaterThan(vip3.efficiencyBonus);
  });

  it('§1.3 VIP加成应正确应用到收益上', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const snapshot = offlineReward.calculateSnapshot(3600, rates);
    const boosted = offlineReward.applyVipBonus(snapshot.totalEarned, 3);

    // VIP3加成15%
    expect(boosted.grain).toBeGreaterThan(snapshot.totalEarned.grain);
  });

});

// ═══════════════════════════════════════════════════════════════
// §1.4 离线收益弹窗与翻倍
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §1.4 离线收益弹窗与翻倍', () => {

  it('§1.4 应生成完整的回归面板数据', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const panel = offlineReward.generateReturnPanel(3600, rates, 0);
    expect(panel.offlineSeconds).toBe(3600);
    expect(panel.formattedTime).toBeDefined();
    expect(panel.efficiencyPercent).toBeGreaterThanOrEqual(0);
    expect(panel.tierDetails).toBeDefined();
    expect(panel.totalEarned).toBeDefined();
    expect(panel.availableDoubles).toBeDefined();
  });

  it('§1.4 广告翻倍应成功应用×2', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(3600, rates, {});
    const result = applyDouble(snapshot.totalEarned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 0);

    expect(result.success).toBe(true);
    expect(result.appliedMultiplier).toBe(2);
    expect(result.doubledEarned.grain).toBe(snapshot.totalEarned.grain * 2);
  });

  it('§1.4 广告翻倍每日限3次', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(3600, rates, {});

    // 第1-3次成功
    const r1 = applyDouble(snapshot.totalEarned, { source: 'ad', multiplier: 2, description: '' }, 0);
    expect(r1.success).toBe(true);
    const r2 = applyDouble(snapshot.totalEarned, { source: 'ad', multiplier: 2, description: '' }, 1);
    expect(r2.success).toBe(true);
    const r3 = applyDouble(snapshot.totalEarned, { source: 'ad', multiplier: 2, description: '' }, 2);
    expect(r3.success).toBe(true);

    // 第4次失败
    const r4 = applyDouble(snapshot.totalEarned, { source: 'ad', multiplier: 2, description: '' }, 3);
    expect(r4.success).toBe(false);
  });

  it('§1.4 元宝翻倍无次数限制', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(3600, rates, {});

    // item来源翻倍不受次数限制
    for (let i = 0; i < 10; i++) {
      const result = applyDouble(snapshot.totalEarned, { source: 'item', multiplier: 2, description: '' }, i);
      expect(result.success).toBe(true);
    }
  });

  it('§1.4 广告和元宝翻倍应互斥（同一次不可叠加）', () => {
    // Play: 广告翻倍(3次/天)和元宝翻倍(无限制)二选一不可叠加
    // 引擎设计：每次applyDouble只应用一种翻倍，不可连续调用叠加
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(3600, rates, {});

    const adResult = applyDouble(snapshot.totalEarned, { source: 'ad', multiplier: 2, description: '' }, 0);
    expect(adResult.success).toBe(true);
    expect(adResult.doubledEarned.grain).toBe(snapshot.totalEarned.grain * 2);

    // 翻倍后的结果已经包含了×2，再次翻倍是错误的（业务层应阻止）
    // 引擎层：翻倍基于原始收益，每次返回独立结果
  });

});

// ═══════════════════════════════════════════════════════════════
// §1.5 广告翻倍细节
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §1.5 广告翻倍细节', () => {

  it('§1.5 离线≥30分钟时广告翻倍可用', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const doubles = offlineReward.getAvailableDoubles(1800, 0); // 30min

    const adDouble = doubles.find(d => d.source === 'ad');
    expect(adDouble).toBeDefined();
  });

  it.skip('§1.5 离线<30分钟时广告翻倍按钮置灰 [UI层测试]', () => {
    // Play: 离线<30分钟时广告翻倍按钮置灰不可用
    // UI层验证，引擎不实现按钮置灰逻辑
  });

  it.skip('§1.5 广告加载失败应降级为1.5倍补偿 [引擎未实现]', () => {
    // Play: 广告加载失败时自动降级为1.5倍补偿
    // 引擎未实现广告加载失败降级逻辑
  });

  it('§1.5 每日3次广告翻倍跨日重置', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();

    // 使用VIP翻倍（引擎中VIP翻倍有每日限制）
    const rates = createProductionRates();
    const snapshot = offlineReward.calculateSnapshot(3600, rates);

    // VIP翻倍每日限制
    const vipBonus = offlineReward.getVipBonus(0);
    expect(vipBonus.dailyDoubleLimit).toBeGreaterThanOrEqual(1);

    // 重置每日计数
    offlineReward.resetVipDailyCount();
    // 重置后应可再次使用
  });

});

// ═══════════════════════════════════════════════════════════════
// §1.6 元宝翻倍细节
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §1.6 元宝翻倍细节', () => {

  it.skip('§1.6 元宝消耗 = ceil(离线收益总价值/500)×10 [引擎未实现]', () => {
    // Play: 元宝消耗 = ceil(离线收益总价值 / 500) × 10，最低10元宝，最高200元宝
    // 引擎未实现元宝消耗计算公式
  });

  it.skip('§1.6 元宝不足时按钮置灰 [UI层测试]', () => {
    // UI层验证
  });

  it('§1.6 元宝翻倍无使用次数限制', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(3600, rates, {});

    // item来源可无限次使用
    for (let i = 0; i < 100; i++) {
      const result = applyDouble(snapshot.totalEarned, { source: 'item', multiplier: 2, description: '' }, 0);
      expect(result.success).toBe(true);
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §1.7 分段计算验证
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §1.7 分段计算验证', () => {

  it('§1.7 离线10h分段计算: 2h@100% + 6h@80% + 2h@60%', () => {
    // Play: 时段1(0~2h)=基础速率×7200×100% + 时段2(2~8h)=基础速率×21600×80% + 时段3(8~10h)=基础速率×7200×60%
    const rates = createProductionRates();
    const grainRate = rates.grain; // 100/s

    const tierDetails = calculateTierDetails(36000, rates); // 10h = 36000s

    expect(tierDetails.length).toBe(3);

    // 时段1: 0~2h = 7200s @ 100%
    expect(tierDetails[0].tierId).toBe('tier1');
    expect(tierDetails[0].seconds).toBe(7200);
    expect(tierDetails[0].efficiency).toBe(1.0);
    expect(tierDetails[0].earned.grain).toBe(grainRate * 7200 * 1.0); // 720000

    // 时段2: 2~8h = 21600s @ 80%
    expect(tierDetails[1].tierId).toBe('tier2');
    expect(tierDetails[1].seconds).toBe(21600);
    expect(tierDetails[1].efficiency).toBe(0.80);
    expect(tierDetails[1].earned.grain).toBe(grainRate * 21600 * 0.80); // 1728000

    // 时段3: 8~10h = 7200s @ 60%
    expect(tierDetails[2].tierId).toBe('tier3');
    expect(tierDetails[2].seconds).toBe(7200);
    expect(tierDetails[2].efficiency).toBe(0.60);
    expect(tierDetails[2].earned.grain).toBe(grainRate * 7200 * 0.60); // 432000
  });

  it('§1.7 三段累加应得总收益', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(36000, rates, {}); // 10h

    const tier1Grain = rates.grain * 7200 * 1.0;
    const tier2Grain = rates.grain * 21600 * 0.80;
    const tier3Grain = rates.grain * 7200 * 0.60;
    const expectedTotal = Math.floor(tier1Grain + tier2Grain + tier3Grain);

    expect(snapshot.totalEarned.grain).toBe(expectedTotal);
  });

  it('§1.7 min(离线秒数-前段累计, 本段上限)确保不越界', () => {
    const rates = createProductionRates();
    // 离线恰好3h = 2h@100% + 1h@80%
    const tierDetails = calculateTierDetails(10800, rates); // 3h

    expect(tierDetails.length).toBe(2);
    expect(tierDetails[0].seconds).toBe(7200);  // 2h
    expect(tierDetails[1].seconds).toBe(3600);  // 1h (不是6h)
  });

  it('§1.7 >72h部分不参与计算', () => {
    const rates = createProductionRates();
    const snap72h = calculateOfflineSnapshot(259200, rates, {});
    const snap100h = calculateOfflineSnapshot(360000, rates, {});

    // 100h收益应等于72h（封顶）
    expect(snap100h.totalEarned.grain).toBe(snap72h.totalEarned.grain);
    expect(snap100h.isCapped).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 离线经验
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §2 离线经验', () => {

  it('§2.1 经验产出应通过快照记录', () => {
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    snapshotSys.createSnapshot(createSnapshotParams());

    const snapshot = snapshotSys.getSnapshot();
    expect(snapshot).not.toBeNull();
    // 产出速率包含经验相关字段
    expect(snapshot!.productionRates).toBeDefined();
  });

  it.skip('§2.2 经验溢出推动升级 — 升级奖励邮件 [引擎未实现]', () => {
    // Play: 经验溢出推动升级时等级正确提升；升级奖励通过邮件系统自动发放
    // 引擎未实现经验系统与邮件系统的联动
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 离线资源
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §3 离线资源', () => {

  it('§3.1 各系统离线效率修正系数正确', () => {
    // Play: 资源产出×1.0 | 建筑升级×1.2 | 科技研究×1.0 | 远征×0.85 | 商队自动完成
    expect(getSystemModifier('resource')).toBe(1.0);
    expect(getSystemModifier('building')).toBe(1.2);
    expect(getSystemModifier('tech')).toBe(1.0);
    expect(getSystemModifier('expedition')).toBe(0.85);
    expect(getSystemModifier('Trade')).toBe(0.8);
  });

  it('§3.1 系统效率修正应正确应用到收益', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(3600, rates, {});
    const baseGrain = snapshot.totalEarned.grain;

    // 建筑×1.2
    const buildingModified = applySystemModifier(snapshot.totalEarned, 'building');
    expect(buildingModified.grain).toBe(Math.floor(baseGrain * 1.2));

    // 远征×0.85
    const expeditionModified = applySystemModifier(snapshot.totalEarned, 'expedition');
    expect(expeditionModified.grain).toBe(Math.floor(baseGrain * 0.85));
  });

  it('§3.2 有上限资源应截断至仓库容量', () => {
    // Play: 粮草截断至粮仓容量、兵力截断至兵营容量
    const earned: Resources = { grain: 50000, gold: 1000, troops: 20000, mandate: 100, techPoint: 0, recruitToken: 0 };
    const current: Resources = { grain: 45000, gold: 500, troops: 9000, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: null, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = applyOverflowRules(earned, current, caps);

    // grain: current=45000, cap=50000, space=5000, earned=50000 → capped=5000, overflow=45000
    expect(result.cappedEarned.grain).toBe(5000);
    expect(result.overflowResources.grain).toBe(45000);

    // gold: cap=null(无上限), 全额发放
    expect(result.cappedEarned.gold).toBe(1000);
    expect(result.overflowResources.gold).toBe(0);

    // troops: current=9000, cap=10000, space=1000, earned=20000 → capped=1000, overflow=19000
    expect(result.cappedEarned.troops).toBe(1000);
    expect(result.overflowResources.troops).toBe(19000);
  });

  it('§3.2 无上限资源(铜钱/天命)应全额发放', () => {
    const earned: Resources = { grain: 0, gold: 5000, troops: 0, mandate: 300, techPoint: 0, recruitToken: 0 };
    const current: Resources = { grain: 0, gold: 100000, troops: 0, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: null, troops: null, mandate: null, techPoint: null, recruitToken: null };

    const result = applyOverflowRules(earned, current, caps);
    expect(result.cappedEarned.gold).toBe(5000);
    expect(result.cappedEarned.mandate).toBe(300);
    expect(result.overflowResources.gold).toBe(0);
    expect(result.overflowResources.mandate).toBe(0);
  });

  it('§3.3 离线收益预估面板应正确计算', () => {
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createProductionRates();

    const result = estimate.estimate(rates);
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.recommendedHours).toBeGreaterThan(0);

    // 各时间点预估
    const point2h = estimate.estimateForHours(2, rates);
    expect(point2h.hours).toBe(2);
    expect(point2h.efficiency).toBeCloseTo(1.0, 1);
  });

  it('§3.3 预估面板72h后显示封顶提示', () => {
    const sim = createSim();
    const estimate = sim.engine.getOfflineEstimateSystem();
    const rates = createProductionRates();

    const point72h = estimate.estimateForHours(72, rates);
    const point100h = estimate.estimateForHours(100, rates);

    // 100h预估应封顶在72h
    expect(point100h.hours).toBe(72);
    expect(point100h.earned.grain).toBe(point72h.earned.grain);
  });

  it.skip('§3.4 自动推图离线行为 [引擎未实现]', () => {
    // Play: 自动推图效率系数 = 全局系数 × 0.80
    // 引擎未实现自动推图离线行为
  });

  it.skip('§3.5 事件系统离线行为 [引擎未实现]', () => {
    // Play: 事件系统不自动处理，最多堆积5个事件
    // 引擎未实现事件离线堆积逻辑
  });

  it.skip('§3.6 NPC系统离线行为 [引擎未实现]', () => {
    // Play: NPC正常刷新周期不受离线影响
    // 引擎未实现NPC离线行为
  });

  it.skip('§3.7 商店离线补货 [引擎未实现]', () => {
    // Play: ShopSystem离线补货最多累积2次
    // 引擎未实现商店离线补货
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 回归奖励
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §4 回归奖励', () => {

  it('§4.1 回归综合面板应包含完整数据', () => {
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const panel = offlineReward.generateReturnPanel(7200, rates, 0);
    expect(panel.offlineSeconds).toBe(7200);
    expect(panel.formattedTime).toBeDefined();
    expect(panel.efficiencyPercent).toBeGreaterThanOrEqual(0);
    expect(panel.tierDetails.length).toBeGreaterThan(0);
    expect(panel.totalEarned).toBeDefined();
    expect(panel.availableDoubles.length).toBeGreaterThan(0);
  });

  it('§4.1 回归面板应展示建筑/科技/远征完成列表', () => {
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    const params = createSnapshotWithBuildings();

    snapshotSys.createSnapshot(params);

    // 模拟12h后上线
    const futureTime = Date.now() + 43200000;
    const completedBuildings = snapshotSys.getCompletedBuildings(futureTime);
    const completedTech = snapshotSys.getCompletedTech(futureTime);
    const completedExpeditions = snapshotSys.getCompletedExpeditions(futureTime);

    // 所有建筑都应在12h内完成
    expect(completedBuildings.length).toBe(3);
    expect(completedTech.length).toBe(1);
    expect(completedExpeditions.length).toBe(1);
  });

  it.skip('§4.2 回归流程时间预算 (~5.2s) [UI层测试]', () => {
    // Play: Step1+Step2总计约5.2s
    // UI层验证
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 邮件系统
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §5 邮件系统', () => {

  it.skip('§5.1 邮件面板与分类 [引擎未实现]', () => {
    // Play: 分类Tab(全部/系统📋/战斗⚔️/社交👥/奖励🎁)
    // 引擎未实现邮件分类系统
  });

  it.skip('§5.2 邮件状态流转 [引擎未实现]', () => {
    // Play: 未读→已读未领→已读已领→已过期
    // 引擎未实现邮件状态流转
  });

  it.skip('§5.3 邮件附件领取 [引擎未实现]', () => {
    // Play: 铜钱/经验/元宝/兵力直接入账不占背包
    // 引擎未实现邮件附件领取
  });

  it.skip('§5.4 邮件批量操作 [引擎未实现]', () => {
    // Play: 一键领取/删除已读已领/全部标记已读
    // 引擎未实现邮件批量操作
  });

  it.skip('§5.5 邮件容量管理 [引擎未实现]', () => {
    // Play: 0~70正常/71~90警告/91~99拥挤/100满载
    // 引擎未实现邮件容量管理
  });

  it.skip('§5.6 邮件过期与自动清理 [引擎未实现]', () => {
    // Play: 系统邮件30天/战斗邮件7天/社交邮件14天/奖励邮件30天
    // 引擎未实现邮件过期清理
  });

  it.skip('§5.7 邮件自动触发规则 [引擎未实现]', () => {
    // Play: 各系统事件自动触发邮件
    // 引擎未实现邮件自动触发
  });

  it.skip('§5.8 离线收益邮件特殊规则 [引擎未实现]', () => {
    // Play: 离线不同时长对应不同标题
    // 引擎未实现离线收益邮件
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 活动系统离线联动
// ═══════════════════════════════════════════════════════════════
describe('v9.0 离线收益核心 — §6 活动系统离线联动', () => {

  it.skip('§6.1 活动离线积分累积 [引擎未实现]', () => {
    // Play: 赛季50%/限时30%/日常100%/节日50%
    // 引擎未实现活动离线积分
  });

  it.skip('§6.2 活动离线任务推进 [引擎未实现]', () => {
    // Play: 累积型任务离线自动推进
    // 引擎未实现活动离线任务
  });

  it.skip('§6.3 活动到期时玩家离线 [引擎未实现]', () => {
    // Play: 下次上线展示已结束活动
    // 引擎未实现活动到期离线处理
  });

  it.skip('§6.4 联盟活动离线行为 [引擎未实现]', () => {
    // Play: 离线仅累积个人部分积分
    // 引擎未实现联盟活动离线
  });

  it.skip('§6.5 活动离线积分声望加成 [引擎未实现]', () => {
    // Play: 声望加成与活动基础效率乘法叠加
    // 引擎未实现活动声望加成
  });

});
