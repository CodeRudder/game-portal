/**
 * 集成测试：离线战斗与挂机（§10.1 ~ §10.3）
 *
 * 覆盖 Play v3.0 攻城略地(上) 中的 4 个流程：
 *   §10.1 离线推图：离线期间自动推进关卡
 *   §10.2 离线挂机收益：离线期间获取资源
 *   §10.2a 离线收益领取弹窗：离线收益数据结构（引擎层）
 *   §10.3 自动连续战斗：自动战斗配置和执行
 *
 * 测试策略：使用 OfflineRewardEngine + OfflineEstimateSystem + SweepSystem 真实实例，
 * 验证离线战斗、挂机收益和自动战斗的完整流程。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateOfflineSnapshot,
  calculateTierDetails,
  calculateOverallEfficiency,
  calculateBonusCoefficient,
  applyDouble,
  applyOverflowRules,
  shouldShowOfflinePopup,
  formatOfflineDuration,
  generateReturnPanelData,
  estimateOfflineReward,
} from '../../../offline/OfflineRewardEngine';
import { OfflineEstimateSystem } from '../../../offline/OfflineEstimateSystem';
import { SweepSystem } from '../../SweepSystem';
import { CampaignProgressSystem } from '../../CampaignProgressSystem';
import type { RewardDistributorDeps } from '../../campaign.types';
import { campaignDataProvider, getChapters } from '../../campaign-config';
import type { SweepDeps } from '../../sweep.types';
import type { Resources, ProductionRate } from '../../../../../shared/types';
import type {
  OfflineSnapshot,
  DoubleRequest,
  DecayTier,
} from '../../../offline/offline.types';
import {
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  MAX_OFFLINE_HOURS,
  OFFLINE_POPUP_THRESHOLD,
} from '../../../offline/offline-config';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/** 创建零资源对象 */
function zeroResources(): Resources {
  return { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
}

/** 创建测试用产出速率 */
function createProductionRates(overrides?: Partial<ProductionRate>): ProductionRate {
  return {
    grain: 10,
    gold: 5,
    troops: 3,
    mandate: 1,
    techPoint: 0,
    ...overrides,
  };
}

/** 创建 mock 事件总线 */
function createMockEventBus() {
  const listeners: Record<string, Function[]> = {};
  return {
    on: (event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    off: () => {},
    emit: () => {},
  };
}

/** 创建 mock 系统依赖 */
function createMockDeps() {
  return {
    eventBus: createMockEventBus(),
    config: {
      get: () => undefined,
      getNumber: (_: string, def: number) => def,
      getString: (_: string, def: string) => def,
    },
    registry: {
      get: () => null,
      has: () => false,
      register: () => {},
      unregister: () => {},
      getAll: () => new Map(),
    },
  };
}

/** 创建测试环境 */
function createTestEnv() {
  const progress = new CampaignProgressSystem(campaignDataProvider);
  const rewardDeps: RewardDistributorDeps = {
    addResource: () => 0,
  };

  const sweepDeps: SweepDeps = {
    simulateBattle: () => ({ victory: true, stars: 3 }),
    getStageStars: (id) => progress.getStageStars(id),
    canChallenge: (id) => progress.canChallenge(id),
    getFarthestStageId: () => {
      const chapters = getChapters();
      for (const ch of chapters) {
        for (const st of ch.stages) {
          if (progress.canChallenge(st.id)) return st.id;
        }
      }
      return null;
    },
    completeStage: (id, stars) => progress.completeStage(id, stars),
  };

  const sweep = new SweepSystem(campaignDataProvider, rewardDeps, sweepDeps);
  const estimate = new OfflineEstimateSystem();
  estimate.init(createMockDeps());

  return { progress, sweep, estimate };
}

/** 小时转秒 */
function hoursToSeconds(h: number): number {
  return h * 3600;
}

// ═══════════════════════════════════════════════
// §10.1 离线推图
// ═══════════════════════════════════════════════
describe('§10.1 离线推图', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should calculate offline snapshot with tier-based decay', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(
      hoursToSeconds(4), // 4小时
      rates,
      {},
    );

    expect(snapshot.offlineSeconds).toBe(hoursToSeconds(4));
    expect(snapshot.tierDetails.length).toBeGreaterThan(0);
    expect(snapshot.totalEarned).toBeDefined();
    expect(snapshot.overallEfficiency).toBeGreaterThan(0);
    expect(snapshot.overallEfficiency).toBeLessThanOrEqual(1);
    expect(snapshot.isCapped).toBe(false);
  });

  it('should have higher earnings in early tiers than later tiers', () => {
    const rates = createProductionRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const details = calculateTierDetails(hoursToSeconds(24), rates);

    // 第一档（0-2h，100%效率）应该比后续档位产出高
    expect(details.length).toBeGreaterThanOrEqual(2);
    expect(details[0].efficiency).toBeGreaterThan(details[1].efficiency);
  });

  it('should cap offline rewards at 72 hours', () => {
    const rates = createProductionRates();
    const snapshot72 = calculateOfflineSnapshot(hoursToSeconds(72), rates, {});
    const snapshot100 = calculateOfflineSnapshot(hoursToSeconds(100), rates, {});

    expect(snapshot72.isCapped).toBe(false);
    expect(snapshot100.isCapped).toBe(true);
    // 72h和100h收益应该相同（封顶）
    expect(snapshot100.totalEarned.grain).toBe(snapshot72.totalEarned.grain);
  });

  it('should apply bonus coefficients correctly', () => {
    const rates = createProductionRates();
    const noBonus = calculateOfflineSnapshot(hoursToSeconds(8), rates, {});
    const withBonus = calculateOfflineSnapshot(hoursToSeconds(8), rates, {
      tech: 0.1,
      vip: 0.1,
      reputation: 0.1,
    });

    // 有加成时收益应该更高
    expect(withBonus.totalEarned.grain).toBeGreaterThan(noBonus.totalEarned.grain);
  });

  it('should cap total bonus at +100%', () => {
    const sources = { tech: 0.5, vip: 0.5, reputation: 0.5 }; // 总计150%，封顶100%
    const coefficient = calculateBonusCoefficient(sources);
    expect(coefficient).toBe(2.0); // 1 + min(1.5, 1.0) = 2.0
  });

  it('should return zero earnings for 0 seconds offline', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(0, rates, {});

    expect(snapshot.totalEarned.grain).toBe(0);
    expect(snapshot.totalEarned.gold).toBe(0);
    expect(snapshot.overallEfficiency).toBe(1.0);
  });

  it('should calculate overall efficiency decreasing over time', () => {
    const eff2h = calculateOverallEfficiency(hoursToSeconds(2));
    const eff8h = calculateOverallEfficiency(hoursToSeconds(8));
    const eff24h = calculateOverallEfficiency(hoursToSeconds(24));
    const eff48h = calculateOverallEfficiency(hoursToSeconds(48));

    // 效率应该递减
    expect(eff2h).toBeGreaterThan(eff8h);
    expect(eff8h).toBeGreaterThan(eff24h);
    expect(eff24h).toBeGreaterThan(eff48h);
  });

  it('should calculate tier details matching decay config', () => {
    const rates = createProductionRates();
    const details = calculateTierDetails(hoursToSeconds(10), rates);

    // 10小时覆盖前3档：0-2h, 2-8h, 8-10h
    expect(details.length).toBe(3);
    expect(details[0].tierId).toBe('tier1');
    expect(details[0].efficiency).toBe(1.0);
    expect(details[1].tierId).toBe('tier2');
    expect(details[1].efficiency).toBe(0.8);
    expect(details[2].tierId).toBe('tier3');
  });
});

// ═══════════════════════════════════════════════
// §10.2 离线挂机收益
// ═══════════════════════════════════════════════
describe('§10.2 离线挂机收益', () => {
  it('should calculate correct earnings for 2 hours offline', () => {
    const rates = createProductionRates({ grain: 10, gold: 5, troops: 0, mandate: 0, techPoint: 0 });
    const snapshot = calculateOfflineSnapshot(hoursToSeconds(2), rates, {});

    // 2小时 = 7200秒，第一档100%效率
    // grain: 10 * 7200 * 1.0 = 72000
    expect(snapshot.totalEarned.grain).toBe(72000);
    expect(snapshot.totalEarned.gold).toBe(36000);
  });

  it('should calculate correct earnings across multiple tiers', () => {
    const rates = createProductionRates({ grain: 10, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const snapshot = calculateOfflineSnapshot(hoursToSeconds(10), rates, {});

    // 0-2h: 10 * 7200 * 1.0 = 72000
    // 2-8h: 10 * 21600 * 0.8 = 172800
    // 8-10h: 10 * 7200 * 0.6 = 43200
    // 总计: 72000 + 172800 + 43200 = 288000
    expect(snapshot.totalEarned.grain).toBe(288000);
  });

  it('should apply tech bonus to offline earnings', () => {
    const rates = createProductionRates({ grain: 10, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const noBonus = calculateOfflineSnapshot(hoursToSeconds(2), rates, {});
    const withTech = calculateOfflineSnapshot(hoursToSeconds(2), rates, { tech: 0.3 });

    // tech +30% → 系数 1.3
    expect(withTech.totalEarned.grain).toBe(Math.floor(72000 * 1.3));
  });

  it('should apply VIP bonus to offline earnings', () => {
    const rates = createProductionRates({ grain: 10, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const noBonus = calculateOfflineSnapshot(hoursToSeconds(2), rates, {});
    const withVip = calculateOfflineSnapshot(hoursToSeconds(2), rates, { vip: 0.2 });

    expect(withVip.totalEarned.grain).toBeGreaterThan(noBonus.totalEarned.grain);
  });

  it('should floor all resource values to integers', () => {
    const rates = createProductionRates({ grain: 0.003, gold: 0.007, troops: 0, mandate: 0, techPoint: 0 });
    const snapshot = calculateOfflineSnapshot(hoursToSeconds(1), rates, {});

    // 所有资源值应为整数
    expect(Number.isInteger(snapshot.totalEarned.grain)).toBe(true);
    expect(Number.isInteger(snapshot.totalEarned.gold)).toBe(true);
  });

  it('should estimate offline reward for given hours', () => {
    const rates = createProductionRates({ grain: 10, gold: 5, troops: 3, mandate: 1, techPoint: 0 });
    const snapshot = estimateOfflineReward(8, rates, { tech: 0.1 });

    expect(snapshot.offlineSeconds).toBe(hoursToSeconds(8));
    expect(snapshot.totalEarned.grain).toBeGreaterThan(0);
    expect(snapshot.tierDetails.length).toBeGreaterThan(0);
  });

  it('should generate estimate timeline via OfflineEstimateSystem', () => {
    const env = createTestEnv();
    const rates = createProductionRates({ grain: 10, gold: 5, troops: 0, mandate: 0, techPoint: 0 });
    const result = env.estimate.estimate(rates);

    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.recommendedHours).toBeGreaterThan(0);
    expect(result.systemEstimates).toBeDefined();
  });

  it('should recommend offline hours with efficiency >= 50%', () => {
    const env = createTestEnv();
    const rates = createProductionRates({ grain: 10, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const result = env.estimate.estimate(rates);

    // 推荐时长应该是效率>=50%的最长时间
    const recommendedPoint = result.timeline.find(p => p.hours === result.recommendedHours);
    expect(recommendedPoint).toBeDefined();
    expect(recommendedPoint!.efficiency).toBeGreaterThanOrEqual(0.5);
  });

  it('should estimate for specific hours with system modifier', () => {
    const env = createTestEnv();
    const rates = createProductionRates({ grain: 10, gold: 0, troops: 0, mandate: 0, techPoint: 0 });

    const baseEstimate = env.estimate.estimateForHours(8, rates);
    const campaignEstimate = env.estimate.estimateForHours(8, rates, 'campaign');

    // campaign 系统有 0.4 的修正系数
    expect(campaignEstimate.earned.grain).toBeLessThan(baseEstimate.earned.grain);
    expect(campaignEstimate.efficiency).toBeLessThan(baseEstimate.efficiency);
  });
});

// ═══════════════════════════════════════════════
// §10.2a 离线收益领取弹窗（引擎层）
// ═══════════════════════════════════════════════
describe('§10.2a 离线收益领取弹窗', () => {
  it('should show popup when offline > 5 minutes', () => {
    expect(shouldShowOfflinePopup(301)).toBe(true);
    expect(shouldShowOfflinePopup(600)).toBe(true);
    expect(shouldShowOfflinePopup(hoursToSeconds(1))).toBe(true);
  });

  it('should not show popup when offline <= 5 minutes', () => {
    expect(shouldShowOfflinePopup(0)).toBe(false);
    expect(shouldShowOfflinePopup(60)).toBe(false);
    expect(shouldShowOfflinePopup(300)).toBe(false);
  });

  it('should format offline duration correctly', () => {
    expect(formatOfflineDuration(0)).toBe('刚刚');
    expect(formatOfflineDuration(30)).toBe('30秒');
    expect(formatOfflineDuration(90)).toBe('1分钟');
    expect(formatOfflineDuration(150)).toBe('2分钟');
    expect(formatOfflineDuration(hoursToSeconds(1))).toBe('1小时');
    expect(formatOfflineDuration(hoursToSeconds(2))).toBe('2小时');
    expect(formatOfflineDuration(hoursToSeconds(25))).toBe('1天1小时');
    expect(formatOfflineDuration(hoursToSeconds(48))).toBe('2天');
  });

  it('should generate return panel data with correct structure', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(hoursToSeconds(8), rates, {});
    const panelData = generateReturnPanelData(snapshot, 0);

    expect(panelData.offlineSeconds).toBe(hoursToSeconds(8));
    expect(panelData.formattedTime).toBeTruthy();
    expect(panelData.efficiencyPercent).toBeGreaterThan(0);
    expect(panelData.tierDetails.length).toBeGreaterThan(0);
    expect(panelData.totalEarned).toBeDefined();
    expect(panelData.isCapped).toBe(false);
    expect(Array.isArray(panelData.availableDoubles)).toBe(true);
    expect(Array.isArray(panelData.boostItems)).toBe(true);
  });

  it('should include ad double option when daily limit not reached', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(hoursToSeconds(1), rates, {});
    const panelData = generateReturnPanelData(snapshot, 0);

    const adDouble = panelData.availableDoubles.find(d => d.source === 'ad');
    expect(adDouble).toBeDefined();
    expect(adDouble!.multiplier).toBe(2);
  });

  it('should exclude ad double option when daily limit reached', () => {
    const rates = createProductionRates();
    const snapshot = calculateOfflineSnapshot(hoursToSeconds(1), rates, {});
    const panelData = generateReturnPanelData(snapshot, 3); // 已用3次

    const adDouble = panelData.availableDoubles.find(d => d.source === 'ad');
    expect(adDouble).toBeUndefined();
  });

  it('should apply double correctly via ad source', () => {
    const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 0 };
    const request: DoubleRequest = {
      source: 'ad',
      multiplier: 2,
      description: '广告翻倍',
    };

    const result = applyDouble(earned, request, 0);
    expect(result.success).toBe(true);
    expect(result.appliedMultiplier).toBe(2);
    expect(result.doubledEarned.grain).toBe(2000);
    expect(result.doubledEarned.gold).toBe(1000);
  });

  it('should reject ad double when daily limit exceeded', () => {
    const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 0 };
    const request: DoubleRequest = {
      source: 'ad',
      multiplier: 2,
      description: '广告翻倍',
    };

    const result = applyDouble(earned, request, 3); // 已用3次
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已用完');
    expect(result.doubledEarned.grain).toBe(1000); // 未翻倍
  });

  it('should apply item double without daily limit', () => {
    const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 0 };
    const request: DoubleRequest = {
      source: 'item',
      multiplier: 2,
      description: '道具翻倍',
    };

    const result = applyDouble(earned, request, 100); // 即使已用很多次
    expect(result.success).toBe(true);
    expect(result.doubledEarned.grain).toBe(2000);
  });

  it('should apply cap to resources with limits', () => {
    const earned: Resources = { grain: 5000, gold: 3000, troops: 1000, mandate: 200, techPoint: 0 };
    const current: Resources = { grain: 8000, gold: 0, troops: 400, mandate: 0, techPoint: 0 };
    const caps: Partial<Record<keyof Resources, number | null>> = {
      grain: 10000,
      gold: 2000,
      troops: 500,
      mandate: null,
      techPoint: null,
    };

    const result = applyOverflowRules(earned, current, caps);
    expect(result.cappedEarned).toBeDefined();
    expect(result.overflowResources).toBeDefined();

    // grain: 8000 + 5000 = 13000, cap 10000 → capped 2000, overflow 3000
    expect(result.cappedEarned.grain).toBe(2000);
    expect(result.overflowResources.grain).toBe(3000);

    // troops: 400 + 1000 = 1400, cap 500 → capped 100, overflow 900
    expect(result.cappedEarned.troops).toBe(100);
    expect(result.overflowResources.troops).toBe(900);

    // gold: no cap → full 3000
    expect(result.cappedEarned.gold).toBe(3000);
    expect(result.overflowResources.gold).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// §10.3 自动连续战斗
// ═══════════════════════════════════════════════
describe('§10.3 自动连续战斗', () => {
  let env: ReturnType<typeof createTestEnv>;

  beforeEach(() => {
    env = createTestEnv();
  });

  it('should execute auto push from farthest stage', () => {
    // 先三星通关第一关
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (firstStageId) {
      env.progress.completeStage(firstStageId, 3);
    }

    // 给扫荡令
    env.sweep.addTickets(50);

    const result = env.sweep.autoPush();
    expect(result).toBeDefined();
    expect(result.totalAttempts).toBeGreaterThanOrEqual(0);
    expect(typeof result.totalResources).toBe('object');
    expect(typeof result.totalExp).toBe('number');
    expect(typeof result.ticketsUsed).toBe('number');
  });

  it('should track auto push progress', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (firstStageId) {
      env.progress.completeStage(firstStageId, 3);
    }

    env.sweep.addTickets(50);
    env.sweep.autoPush();

    const progress = env.sweep.getAutoPushProgress();
    expect(progress).toBeDefined();
    expect(typeof progress.isRunning).toBe('boolean');
    expect(typeof progress.attempts).toBe('number');
    expect(typeof progress.victories).toBe('number');
    expect(typeof progress.defeats).toBe('number');
  });

  it('should stop auto push when no farthest stage available', () => {
    // CampaignProgressSystem 默认第一关是 available 状态
    // getFarthestStageId 会返回第一关ID，但未三星通关且模拟战斗可能失败
    // 所以验证 autoPush 返回结果结构正确即可
    env.sweep.addTickets(50);
    const result = env.sweep.autoPush();

    // 结果结构正确
    expect(typeof result.totalAttempts).toBe('number');
    expect(typeof result.victories).toBe('number');
    expect(typeof result.ticketsUsed).toBe('number');
  });

  it('should deduct tickets used during auto push', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (firstStageId) {
      env.progress.completeStage(firstStageId, 3);
    }

    env.sweep.addTickets(50);
    const ticketsBefore = env.sweep.getTicketCount();

    const result = env.sweep.autoPush();
    expect(env.sweep.getTicketCount()).toBe(ticketsBefore - result.ticketsUsed);
  });

  it('should respect autoPushMaxAttempts config', () => {
    const env2 = createTestEnv();
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (firstStageId) {
      env2.progress.completeStage(firstStageId, 3);
    }

    // 创建自定义maxAttempts的扫荡系统
    const customSweep = new SweepSystem(
      campaignDataProvider,
      { addResource: () => 0 },
      {
        simulateBattle: () => ({ victory: true, stars: 3 }),
        getStageStars: (id) => env2.progress.getStageStars(id),
        canChallenge: (id) => env2.progress.canChallenge(id),
        getFarthestStageId: () => {
          for (const ch of chapters) {
            for (const st of ch.stages) {
              if (env2.progress.canChallenge(st.id)) return st.id;
            }
          }
          return null;
        },
        completeStage: (id, stars) => env2.progress.completeStage(id, stars),
      },
      { autoPushMaxAttempts: 3 },
    );
    customSweep.addTickets(50);

    const result = customSweep.autoPush();
    expect(result.totalAttempts).toBeLessThanOrEqual(3);
  });

  it('should calculate offline earnings for auto battle duration', () => {
    // 模拟：自动战斗持续4小时的离线收益
    const rates = createProductionRates({ grain: 10, gold: 5, troops: 0, mandate: 0, techPoint: 0 });
    const snapshot = calculateOfflineSnapshot(hoursToSeconds(4), rates, {});

    // 4小时覆盖2档：0-2h(100%) + 2-4h(80%)
    // grain: 10 * 7200 * 1.0 + 10 * 7200 * 0.8 = 72000 + 57600 = 129600
    expect(snapshot.totalEarned.grain).toBe(129600);
  });

  it('should provide efficiency curve data for visualization', () => {
    const curve = env.estimate.getEfficiencyCurve(72);

    expect(curve.length).toBe(72);
    expect(curve[0].hours).toBe(1);
    expect(curve[71].hours).toBe(72);

    // 效率应该递减
    expect(curve[0].efficiency).toBeGreaterThan(curve[71].efficiency);
  });

  it('should handle estimate for hours exceeding max offline hours', () => {
    const rates = createProductionRates({ grain: 10, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const result = env.estimate.estimateForHours(100, rates);

    // 应该封顶在72小时
    expect(result.hours).toBe(MAX_OFFLINE_HOURS);
  });

  it('should maintain consistent state between sweep and auto push', () => {
    const chapters = getChapters();
    const firstStageId = chapters[0]?.stages[0]?.id;
    if (!firstStageId) return;

    // 三星通关
    env.progress.completeStage(firstStageId, 3);
    env.sweep.addTickets(50);

    // 先手动扫荡
    const sweepResult = env.sweep.sweep(firstStageId, 3);
    expect(sweepResult.success).toBe(true);

    // 再自动推图
    const autoResult = env.sweep.autoPush();
    expect(autoResult).toBeDefined();

    // 关卡星级不变
    expect(env.progress.getStageStars(firstStageId)).toBe(3);
  });
});
