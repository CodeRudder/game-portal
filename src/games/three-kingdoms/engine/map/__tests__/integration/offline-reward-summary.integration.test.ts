/**
 * 集成测试 — 离线推图/挂机收益/领土变化（§12.1-12.3）
 *
 * 覆盖 Play 文档流程：
 *   §12.1  离线推图：离线期间自动推进关卡
 *   §12.2  离线挂机收益：离线期间获取资源
 *   §12.3  离线领土变化：离线期间领土产出
 *
 * 引擎层验证，不依赖 UI。
 *
 * @module engine/map/__tests__/integration/offline-reward-summary
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineRewardSystem } from '../../../offline/OfflineRewardSystem';
import { OfflineEstimateSystem } from '../../../offline/OfflineEstimateSystem';
import { OfflineSnapshotSystem } from '../../../offline/OfflineSnapshotSystem';
import { DECAY_TIERS, MAX_OFFLINE_SECONDS, MAX_OFFLINE_HOURS } from '../../../offline/offline-config';
import type { Resources, ProductionRate, ResourceCap } from '../../../../shared/types';
import type { ISystemDeps } from '../../../../core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: () => () => {},
      once: () => () => {},
      emit: vi.fn(),
      off: () => {},
      removeAllListeners: () => {},
    },
    config: { get: () => undefined, set: () => {} },
    registry: {
      register: () => {},
      get: () => null,
      getAll: () => new Map(),
      has: () => false,
      unregister: () => {},
    } as unknown as Record<string, unknown>,
  };
}

/** 标准产出速率（每秒） */
const STANDARD_RATES: ProductionRate = {
  grain: 10,
  gold: 5,
  troops: 2,
  mandate: 0.5,
  techPoint: 0.1,
};

/** 低产出速率 */
const LOW_RATES: ProductionRate = {
  grain: 1,
  gold: 0.5,
  troops: 0.1,
  mandate: 0.05,
  techPoint: 0.01,
};

/** 零产出速率 */
const ZERO_RATES: ProductionRate = {
  grain: 0,
  gold: 0,
  troops: 0,
  mandate: 0,
  techPoint: 0,
};

/** 标准资源上限 */
const STANDARD_CAPS: ResourceCap = {
  grain: 100000,
  gold: null,
  troops: 50000,
  mandate: null,
  techPoint: null,
};

/** 标准当前资源 */
const STANDARD_RESOURCES: Resources = {
  grain: 5000,
  gold: 2000,
  troops: 1000,
  mandate: 100,
  techPoint: 50,
};

/** 判断两个 Resources 是否近似相等（浮点容差） */
function resourcesApproxEqual(
  actual: Resources,
  expected: Resources,
  tolerance: number = 0.01,
): boolean {
  for (const key of ['grain', 'gold', 'troops', 'mandate', 'techPoint'] as const) {
    if (Math.abs(actual[key] - expected[key]) > tolerance) return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// §12.1 离线推图
// ─────────────────────────────────────────────

describe('§12.1 离线推图', () => {
  let snapshot: OfflineSnapshotSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    snapshot = new OfflineSnapshotSystem();
    snapshot.init(deps);
  });

  describe('快照创建', () => {
    it('应正确创建包含所有系统状态的快照', () => {
      const sysSnapshot = snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
        buildingQueue: [],
        techQueue: [],
        expeditionQueue: [],
        tradeCaravans: [],
      });

      expect(sysSnapshot.resources.grain).toBe(STANDARD_RESOURCES.grain);
      expect(sysSnapshot.resources.gold).toBe(STANDARD_RESOURCES.gold);
      expect(sysSnapshot.productionRates.grain).toBe(STANDARD_RATES.grain);
    });

    it('快照应记录科技队列状态', () => {
      const techQueue = [
        { techId: 'mil_t1_attack', startTime: Date.now() - 60000, endTime: Date.now() + 60000 },
      ];
      const sysSnapshot = snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
        techQueue,
      });

      expect(sysSnapshot.techQueue.length).toBe(1);
      expect(sysSnapshot.techQueue[0].techId).toBe('mil_t1_attack');
    });

    it('快照应记录建筑队列状态', () => {
      const buildingQueue = [
        { buildingType: 'academy', startTime: Date.now() - 300000, endTime: Date.now() + 300000 },
      ];
      const sysSnapshot = snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
        buildingQueue,
      });

      expect(sysSnapshot.buildingQueue.length).toBe(1);
      expect(sysSnapshot.buildingQueue[0].buildingType).toBe('academy');
    });

    it('快照应记录远征队列状态', () => {
      const expeditionQueue = [
        {
          expeditionId: 'exp_001',
          startTime: Date.now() - 120000,
          endTime: Date.now() + 120000,
          estimatedReward: { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0 },
        },
      ];
      const sysSnapshot = snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
        expeditionQueue,
      });

      expect(sysSnapshot.expeditionQueue.length).toBe(1);
      expect(sysSnapshot.expeditionQueue[0].expeditionId).toBe('exp_001');
    });
  });

  describe('离线时长计算', () => {
    it('无快照时离线时长应为 0', () => {
      expect(snapshot.getOfflineSeconds()).toBe(0);
    });

    it('创建快照后应能计算离线时长', () => {
      const before = Date.now();
      snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
      });
      const offlineSeconds = snapshot.getOfflineSeconds();
      // 刚创建的快照，离线时长应接近 0
      expect(offlineSeconds).toBeGreaterThanOrEqual(0);
      expect(offlineSeconds).toBeLessThan(5);
    });
  });

  describe('快照有效期', () => {
    it('新创建的快照应有效', () => {
      snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
      });
      expect(snapshot.isSnapshotValid()).toBe(true);
    });

    it('无快照时应无效', () => {
      expect(snapshot.isSnapshotValid()).toBe(false);
    });
  });

  describe('离线期间完成的队列检测', () => {
    it('应检测到离线期间完成的建筑', () => {
      const pastTime = Date.now() - 1000;
      snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
        buildingQueue: [
          { buildingType: 'academy', startTime: pastTime - 5000, endTime: pastTime },
        ],
      });

      const completed = snapshot.getCompletedBuildings();
      expect(completed.length).toBe(1);
      expect(completed[0].buildingType).toBe('academy');
    });

    it('应检测到离线期间完成的科技研究', () => {
      const pastTime = Date.now() - 1000;
      snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
        techQueue: [
          { techId: 'mil_t1_attack', startTime: pastTime - 5000, endTime: pastTime },
        ],
      });

      const completed = snapshot.getCompletedTech();
      expect(completed.length).toBe(1);
      expect(completed[0].techId).toBe('mil_t1_attack');
    });

    it('应检测到离线期间完成的远征', () => {
      const pastTime = Date.now() - 1000;
      snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
        expeditionQueue: [
          {
            expeditionId: 'exp_001',
            startTime: pastTime - 5000,
            endTime: pastTime,
            estimatedReward: { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0 },
          },
        ],
      });

      const completed = snapshot.getCompletedExpeditions();
      expect(completed.length).toBe(1);
    });

    it('未完成的队列不应被检测到', () => {
      const futureTime = Date.now() + 100000;
      snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
        buildingQueue: [
          { buildingType: 'academy', startTime: Date.now(), endTime: futureTime },
        ],
      });

      const completed = snapshot.getCompletedBuildings();
      expect(completed.length).toBe(0);
    });
  });

  describe('快照清除', () => {
    it('clearSnapshot 应清除快照数据', () => {
      snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
      });
      snapshot.clearSnapshot();
      expect(snapshot.getSnapshot()).toBeNull();
      expect(snapshot.getOfflineSeconds()).toBe(0);
    });
  });

  describe('快照序列化', () => {
    it('getSaveData 应返回存档数据', () => {
      snapshot.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
      });
      const saveData = snapshot.getSaveData();
      expect(saveData.lastOfflineTime).toBeGreaterThan(0);
      expect(saveData.version).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────
// §12.2 离线挂机收益
// ─────────────────────────────────────────────

describe('§12.2 离线挂机收益', () => {
  let rewardSystem: OfflineRewardSystem;
  let estimateSystem: OfflineEstimateSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.init(deps);
    estimateSystem = new OfflineEstimateSystem();
    estimateSystem.init(deps);
  });

  describe('6档衰减快照', () => {
    it('0秒离线应返回空快照', () => {
      const snapshot = rewardSystem.calculateSnapshot(0, STANDARD_RATES);
      expect(snapshot.offlineSeconds).toBe(0);
      expect(snapshot.tierDetails.length).toBe(0);
      expect(snapshot.totalEarned.grain).toBe(0);
      expect(snapshot.overallEfficiency).toBe(0);
    });

    it('1小时离线应只使用第1档（100%效率）', () => {
      const snapshot = rewardSystem.calculateSnapshot(3600, STANDARD_RATES);
      expect(snapshot.tierDetails.length).toBe(1);
      expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
      // grain: 10/s * 3600s * 1.0 = 36000
      expect(snapshot.totalEarned.grain).toBeCloseTo(36000, -1);
    });

    it('4小时离线应使用前两档', () => {
      const snapshot = rewardSystem.calculateSnapshot(4 * 3600, STANDARD_RATES);
      expect(snapshot.tierDetails.length).toBe(2);
      // 第1档 0~2h: 100%, 第2档 2~4h: 80%
      expect(snapshot.tierDetails[0].efficiency).toBe(1.0);
      expect(snapshot.tierDetails[1].efficiency).toBe(0.8);
    });

    it('24小时离线应使用前三档', () => {
      const snapshot = rewardSystem.calculateSnapshot(24 * 3600, STANDARD_RATES);
      expect(snapshot.tierDetails.length).toBe(3);
    });

    it('72小时离线应使用全部5档', () => {
      const snapshot = rewardSystem.calculateSnapshot(72 * 3600, STANDARD_RATES);
      expect(snapshot.tierDetails.length).toBe(5);
    });

    it('超过72小时应封顶', () => {
      const snapshot = rewardSystem.calculateSnapshot(100 * 3600, STANDARD_RATES);
      expect(snapshot.isCapped).toBe(true);
      // 收益应与72小时相同
      const snapshot72 = rewardSystem.calculateSnapshot(72 * 3600, STANDARD_RATES);
      expect(snapshot.totalEarned.grain).toBeCloseTo(snapshot72.totalEarned.grain, 0);
    });

    it('综合效率应随离线时长递减', () => {
      const snap2h = rewardSystem.calculateSnapshot(2 * 3600, STANDARD_RATES);
      const snap8h = rewardSystem.calculateSnapshot(8 * 3600, STANDARD_RATES);
      const snap24h = rewardSystem.calculateSnapshot(24 * 3600, STANDARD_RATES);
      expect(snap2h.overallEfficiency).toBeGreaterThan(snap8h.overallEfficiency);
      expect(snap8h.overallEfficiency).toBeGreaterThan(snap24h.overallEfficiency);
    });
  });

  describe('翻倍机制', () => {
    it('广告翻倍应正确翻倍收益', () => {
      const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 10 };
      const result = rewardSystem.applyDouble(earned, {
        source: 'ad',
        multiplier: 2,
        description: '观看广告翻倍',
      });
      expect(result.success).toBe(true);
      expect(result.appliedMultiplier).toBe(2);
      expect(result.doubledEarned.grain).toBe(2000);
    });

    it('VIP翻倍有每日次数限制', () => {
      const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 10 };
      // VIP默认限制可能为0次，测试多次翻倍
      let successCount = 0;
      for (let i = 0; i < 10; i++) {
        const result = rewardSystem.applyDouble(earned, {
          source: 'vip',
          multiplier: 2,
          description: 'VIP翻倍',
        });
        if (result.success) successCount++;
      }
      // 不应超过VIP每日限制
      const vipBonus = rewardSystem.getVipBonus();
      expect(successCount).toBeLessThanOrEqual(vipBonus.dailyDoubleLimit);
    });

    it('getAvailableDoubles 应包含广告翻倍', () => {
      const doubles = rewardSystem.getAvailableDoubles(3600, 0);
      expect(doubles.some((d) => d.source === 'ad')).toBe(true);
    });
  });

  describe('VIP离线加成', () => {
    it('VIP等级越高加成越高', () => {
      const bonus0 = rewardSystem.getVipBonus(0);
      const bonus5 = rewardSystem.getVipBonus(5);
      expect(bonus5.efficiencyBonus).toBeGreaterThanOrEqual(bonus0.efficiencyBonus);
    });

    it('applyVipBonus 应正确应用VIP加成', () => {
      const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 10 };
      const boosted = rewardSystem.applyVipBonus(earned, 5);
      // VIP加成后收益应 >= 原收益
      expect(boosted.grain).toBeGreaterThanOrEqual(earned.grain);
    });

    it('VIP等级0时加成为0', () => {
      const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 10 };
      const boosted = rewardSystem.applyVipBonus(earned, 0);
      expect(boosted.grain).toBe(earned.grain);
    });
  });

  describe('系统差异化修正系数', () => {
    it('getSystemModifier 应返回修正系数', () => {
      const modifiers = rewardSystem.getAllSystemModifiers();
      expect(modifiers.length).toBeGreaterThan(0);
      for (const mod of modifiers) {
        expect(mod.modifier).toBeGreaterThan(0);
        expect(mod.modifier).toBeLessThanOrEqual(2); // 修正系数范围 0~2
      }
    });

    it('applySystemModifier 应正确修正收益', () => {
      const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 10 };
      // 使用远征系统（0.85修正）
      const modified = rewardSystem.applySystemModifier(earned, 'expedition');
      expect(modified.grain).toBeLessThan(earned.grain);
    });

    it('建筑系统修正系数应大于 1（120%）', () => {
      const modifier = rewardSystem.getSystemModifier('building');
      expect(modifier).toBeGreaterThan(1);
    });

    it('远征系统修正系数应小于 1（85%）', () => {
      const modifier = rewardSystem.getSystemModifier('expedition');
      expect(modifier).toBeLessThan(1);
    });
  });

  describe('收益上限与资源保护', () => {
    it('applyCapAndOverflow 应限制收益不超过仓库容量', () => {
      const earned: Resources = { grain: 100000, gold: 500, troops: 200, mandate: 50, techPoint: 10 };
      const current: Resources = { grain: 90000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
      const caps: Record<string, number | null> = { grain: 100000, gold: null, troops: 50000, mandate: null, techPoint: null };

      const result = rewardSystem.applyCapAndOverflow(earned, current, caps);
      // 仓库剩余空间 = 100000 - 90000 = 10000
      expect(result.cappedEarned.grain).toBe(10000);
      expect(result.overflowResources.grain).toBe(90000);
    });

    it('null 上限的资源不受限制', () => {
      const earned: Resources = { grain: 0, gold: 100000, troops: 0, mandate: 0, techPoint: 0 };
      const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
      const caps: Record<string, number | null> = { grain: null, gold: null, troops: null, mandate: null, techPoint: null };

      const result = rewardSystem.applyCapAndOverflow(earned, current, caps);
      expect(result.cappedEarned.gold).toBe(100000);
    });

    it('getResourceProtection 应返回保护量', () => {
      const protection = rewardSystem.getResourceProtection('grain', 10000);
      expect(protection).toBeGreaterThanOrEqual(0);
    });
  });

  describe('完整离线收益计算', () => {
    it('calculateFullReward 应返回完整结果', () => {
      const result = rewardSystem.calculateFullReward(
        8 * 3600,
        STANDARD_RATES,
        STANDARD_RESOURCES,
        STANDARD_CAPS,
        0,
        'building',
      );

      expect(result.snapshot).toBeDefined();
      expect(result.vipBoostedEarned).toBeDefined();
      expect(result.systemModifiedEarned).toBeDefined();
      expect(result.cappedEarned).toBeDefined();
      expect(result.overflowResources).toBeDefined();
      expect(result.tradeSummary).toBeDefined();
      expect(result.panelData).toBeDefined();
    });

    it('calculateOfflineReward + claimReward 应正确领取', () => {
      const result = rewardSystem.calculateOfflineReward(
        4 * 3600,
        STANDARD_RATES,
        STANDARD_RESOURCES,
        STANDARD_CAPS,
      );
      const claimed = rewardSystem.claimReward(result);
      expect(claimed).not.toBeNull();
      expect(claimed!.grain).toBeGreaterThanOrEqual(0);
    });

    it('重复领取应返回 null', () => {
      const result = rewardSystem.calculateOfflineReward(
        4 * 3600,
        STANDARD_RATES,
        STANDARD_RESOURCES,
        STANDARD_CAPS,
      );
      rewardSystem.claimReward(result);
      const secondClaim = rewardSystem.claimReward(result);
      expect(secondClaim).toBeNull();
    });

    it('重新计算后应可再次领取', () => {
      const result1 = rewardSystem.calculateOfflineReward(
        4 * 3600,
        STANDARD_RATES,
        STANDARD_RESOURCES,
        STANDARD_CAPS,
      );
      rewardSystem.claimReward(result1);

      const result2 = rewardSystem.calculateOfflineReward(
        4 * 3600,
        STANDARD_RATES,
        STANDARD_RESOURCES,
        STANDARD_CAPS,
      );
      const secondClaim = rewardSystem.claimReward(result2);
      expect(secondClaim).not.toBeNull();
    });
  });

  describe('回归面板', () => {
    it('generateReturnPanel 应返回面板数据', () => {
      const panel = rewardSystem.generateReturnPanel(8 * 3600, STANDARD_RATES, 0);
      expect(panel.offlineSeconds).toBe(8 * 3600);
      expect(panel.formattedTime).toBeTruthy();
      expect(panel.efficiencyPercent).toBeGreaterThan(0);
      expect(panel.efficiencyPercent).toBeLessThanOrEqual(100);
      expect(panel.totalEarned).toBeDefined();
      expect(panel.availableDoubles.length).toBeGreaterThan(0);
    });

    it('短时间离线不应有回归奖励', () => {
      const panel = rewardSystem.generateReturnPanel(60, STANDARD_RATES, 0);
      const returnBonus = panel.availableDoubles.find((d) => d.source === 'return_bonus');
      expect(returnBonus).toBeUndefined();
    });
  });

  describe('离线预估', () => {
    it('estimate 应返回时间线', () => {
      const result = estimateSystem.estimate(STANDARD_RATES);
      expect(result.timeline.length).toBeGreaterThan(0);
      expect(result.recommendedHours).toBeGreaterThan(0);
    });

    it('预估时间线应包含标准时间点', () => {
      const result = estimateSystem.estimate(STANDARD_RATES);
      const hours = result.timeline.map((p) => p.hours);
      expect(hours).toContain(1);
      expect(hours).toContain(8);
      expect(hours).toContain(24);
      expect(hours).toContain(72);
    });

    it('预估收益应随时间递增', () => {
      const result = estimateSystem.estimate(STANDARD_RATES);
      for (let i = 1; i < result.timeline.length; i++) {
        expect(result.timeline[i].earned.grain).toBeGreaterThan(
          result.timeline[i - 1].earned.grain,
        );
      }
    });

    it('效率应随时间递减', () => {
      const result = estimateSystem.estimate(STANDARD_RATES);
      for (let i = 1; i < result.timeline.length; i++) {
        expect(result.timeline[i].efficiency).toBeLessThanOrEqual(
          result.timeline[i - 1].efficiency,
        );
      }
    });

    it('estimateForHours 应返回指定时间的预估', () => {
      const point = estimateSystem.estimateForHours(4, STANDARD_RATES);
      expect(point.hours).toBe(4);
      expect(point.earned.grain).toBeGreaterThan(0);
      expect(point.efficiency).toBeGreaterThan(0);
    });

    it('estimateForHours 超过72h应封顶', () => {
      const point = estimateSystem.estimateForHours(100, STANDARD_RATES);
      expect(point.hours).toBe(MAX_OFFLINE_HOURS);
    });

    it('estimateForHours 支持系统修正系数', () => {
      const normal = estimateSystem.estimateForHours(8, STANDARD_RATES);
      const modified = estimateSystem.estimateForHours(8, STANDARD_RATES, 'expedition');
      // 远征修正 0.85，修正后收益应 < 未修正
      expect(modified.earned.grain).toBeLessThan(normal.earned.grain);
    });

    it('getEfficiencyCurve 应返回效率曲线', () => {
      const curve = estimateSystem.getEfficiencyCurve();
      expect(curve.length).toBe(MAX_OFFLINE_HOURS);
      expect(curve[0].efficiency).toBeGreaterThan(0);
    });
  });

  describe('加速道具', () => {
    it('添加道具后应可查询', () => {
      rewardSystem.addBoostItem('offline_double', 1);
      const items = rewardSystem.getBoostItems();
      const doubleItem = items.find((i) => i.id === 'offline_double');
      expect(doubleItem).toBeDefined();
      expect(doubleItem!.count).toBeGreaterThan(0);
    });

    it('使用道具后数量应减少', () => {
      rewardSystem.addBoostItem('offline_boost_1h', 3);
      const before = rewardSystem.getBoostItems().find((i) => i.id === 'offline_boost_1h')!.count;
      const result = rewardSystem.useBoostItemAction('offline_boost_1h', STANDARD_RATES);
      expect(result.success).toBe(true);
      const after = rewardSystem.getBoostItems().find((i) => i.id === 'offline_boost_1h')!.count;
      expect(after).toBe(before - 1);
      expect(after).toBe(2);
    });
  });

  describe('仓库扩容', () => {
    it('upgradeWarehouse 应增加容量', () => {
      const result = rewardSystem.upgradeWarehouse('grain');
      expect(result.success).toBe(true);
      expect(result.newCapacity).toBeGreaterThan(result.previousCapacity);
      expect(result.newLevel).toBeGreaterThan(0);
    });

    it('getWarehouseCapacity 应返回当前容量', () => {
      const capacity = rewardSystem.getWarehouseCapacity('grain');
      expect(capacity).toBeGreaterThan(0);
    });
  });

  describe('离线贸易', () => {
    it('simulateOfflineTrade 应返回贸易摘要', () => {
      const tradeProfit: Resources = { grain: 0, gold: 10, troops: 0, mandate: 0, techPoint: 0 };
      const summary = rewardSystem.simulateOfflineTrade(8 * 3600, tradeProfit);
      expect(summary).toBeDefined();
    });
  });

  describe('序列化', () => {
    it('序列化/反序列化应保持一致', () => {
      rewardSystem.addBoostItem('offline_double', 5);
      rewardSystem.setLastOfflineTime(Date.now() - 3600000);

      const data = rewardSystem.serialize();
      const newSystem = new OfflineRewardSystem();
      newSystem.init(deps);
      newSystem.deserialize(data);

      expect(newSystem.getLastOfflineTime()).toBe(data.lastOfflineTime);
    });
  });
});

// ─────────────────────────────────────────────
// §12.3 离线领土变化
// ─────────────────────────────────────────────

describe('§12.3 离线领土变化', () => {
  let rewardSystem: OfflineRewardSystem;
  let snapshotSystem: OfflineSnapshotSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    deps = createMockDeps();
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.init(deps);
    snapshotSystem = new OfflineSnapshotSystem();
    snapshotSystem.init(deps);
  });

  describe('领土产出计算', () => {
    it('离线期间领土应持续产出资源', () => {
      const territoryRates: ProductionRate = {
        grain: 20,
        gold: 10,
        troops: 5,
        mandate: 1,
        techPoint: 0.2,
      };

      const snapshot = rewardSystem.calculateSnapshot(4 * 3600, territoryRates);
      expect(snapshot.totalEarned.grain).toBeGreaterThan(0);
      expect(snapshot.totalEarned.gold).toBeGreaterThan(0);
      expect(snapshot.totalEarned.troops).toBeGreaterThan(0);
    });

    it('产出速率越高收益越多', () => {
      const lowSnapshot = rewardSystem.calculateSnapshot(4 * 3600, LOW_RATES);
      const highSnapshot = rewardSystem.calculateSnapshot(4 * 3600, STANDARD_RATES);

      expect(highSnapshot.totalEarned.grain).toBeGreaterThan(lowSnapshot.totalEarned.grain);
      expect(highSnapshot.totalEarned.gold).toBeGreaterThan(lowSnapshot.totalEarned.gold);
    });

    it('零产出速率应返回零收益', () => {
      const snapshot = rewardSystem.calculateSnapshot(4 * 3600, ZERO_RATES);
      expect(snapshot.totalEarned.grain).toBe(0);
      expect(snapshot.totalEarned.gold).toBe(0);
      expect(snapshot.totalEarned.troops).toBe(0);
      expect(snapshot.totalEarned.mandate).toBe(0);
    });
  });

  describe('领土快照与恢复', () => {
    it('下线时应记录领土产出速率', () => {
      const territoryRates: ProductionRate = {
        grain: 15,
        gold: 8,
        troops: 3,
        mandate: 0.5,
        techPoint: 0.1,
      };

      const snap = snapshotSystem.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: territoryRates,
        caps: { ...STANDARD_CAPS },
      });

      expect(snap.productionRates.grain).toBe(15);
      expect(snap.productionRates.gold).toBe(8);
    });

    it('远征队列应记录预估收益', () => {
      const estimatedReward: Resources = {
        grain: 500,
        gold: 200,
        troops: 100,
        mandate: 10,
        techPoint: 5,
      };

      snapshotSystem.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
        expeditionQueue: [
          {
            expeditionId: 'exp_001',
            startTime: Date.now() - 5000,
            endTime: Date.now() - 1000,
            estimatedReward,
          },
        ],
      });

      const completed = snapshotSystem.getCompletedExpeditions();
      expect(completed.length).toBe(1);
      expect(completed[0].estimatedReward.grain).toBe(500);
    });

    it('商队快照应记录贸易收益', () => {
      snapshotSystem.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
        tradeCaravans: [
          {
            caravanId: 'caravan_001',
            routeId: 'route_silk',
            startTime: Date.now() - 5000,
            endTime: Date.now() - 1000,
            estimatedProfit: { grain: 0, gold: 300, troops: 0, mandate: 0, techPoint: 0 },
          },
        ],
      });

      const completed = snapshotSystem.getCompletedTrades();
      expect(completed.length).toBe(1);
      expect(completed[0].estimatedProfit.gold).toBe(300);
    });
  });

  describe('领土收益综合计算', () => {
    it('calculateFullReward 应整合领土产出和VIP加成', () => {
      const territoryRates: ProductionRate = {
        grain: 20,
        gold: 10,
        troops: 5,
        mandate: 1,
        techPoint: 0.2,
      };

      const result = rewardSystem.calculateFullReward(
        8 * 3600,
        territoryRates,
        STANDARD_RESOURCES,
        STANDARD_CAPS,
        5, // VIP 5
        'territory',
      );

      // 基础收益
      expect(result.snapshot.totalEarned.grain).toBeGreaterThan(0);
      // VIP加成后收益应 >= 基础收益
      expect(result.vipBoostedEarned.grain).toBeGreaterThanOrEqual(
        result.snapshot.totalEarned.grain,
      );
      // 系统修正后
      expect(result.systemModifiedEarned).toBeDefined();
      // 封顶后
      expect(result.cappedEarned).toBeDefined();
    });

    it('领土产出应受衰减影响', () => {
      const rates: ProductionRate = {
        grain: 10,
        gold: 5,
        troops: 2,
        mandate: 0.5,
        techPoint: 0.1,
      };

      // 2小时：100%效率
      const snap2h = rewardSystem.calculateSnapshot(2 * 3600, rates);
      // 24小时：混合效率
      const snap24h = rewardSystem.calculateSnapshot(24 * 3600, rates);

      // 24小时收益应大于2小时收益（但不是12倍）
      const ratio = snap24h.totalEarned.grain / snap2h.totalEarned.grain;
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(12); // 衰减导致非线性
    });
  });

  describe('领土收益预估', () => {
    it('estimateForHours 应预估领土产出', () => {
      const territoryRates: ProductionRate = {
        grain: 20,
        gold: 10,
        troops: 5,
        mandate: 1,
        techPoint: 0.2,
      };

      const estimate = new OfflineEstimateSystem();
      estimate.init(deps);
      const point = estimate.estimateForHours(8, territoryRates);

      expect(point.earned.grain).toBeGreaterThan(0);
      expect(point.earned.gold).toBeGreaterThan(0);
      expect(point.efficiency).toBeGreaterThan(0);
      expect(point.efficiency).toBeLessThanOrEqual(1);
    });
  });

  describe('资源保护与领土收益', () => {
    it('仓库满时领土收益应溢出', () => {
      const rates: ProductionRate = {
        grain: 100,
        gold: 50,
        troops: 0,
        mandate: 0,
        techPoint: 0,
      };
      const current: Resources = {
        grain: 99990,
        gold: 0,
        troops: 0,
        mandate: 0,
        techPoint: 0,
      };
      const caps: Record<string, number | null> = {
        grain: 100000,
        gold: null,
        troops: null,
        mandate: null,
        techPoint: null,
      };

      const result = rewardSystem.calculateFullReward(
        3600,
        rates,
        current,
        caps,
        0,
        'territory',
      );

      // 粮草应被仓库上限截断
      expect(result.cappedEarned.grain).toBeLessThanOrEqual(10);
      expect(result.overflowResources.grain).toBeGreaterThan(0);
    });
  });

  describe('重置与清理', () => {
    it('reset 应清除所有离线状态', () => {
      rewardSystem.addBoostItem('offline_double', 5);
      rewardSystem.setLastOfflineTime(Date.now());
      rewardSystem.reset();

      expect(rewardSystem.getLastOfflineTime()).toBe(0);
      // reset 后道具列表仍存在（定义），但数量为 0
      const doubleItem = rewardSystem.getBoostItems().find((i) => i.id === 'offline_double');
      expect(doubleItem!.count).toBe(0);
    });

    it('snapshot reset 应清除快照', () => {
      snapshotSystem.createSnapshot({
        resources: { ...STANDARD_RESOURCES },
        productionRates: { ...STANDARD_RATES },
        caps: { ...STANDARD_CAPS },
      });
      snapshotSystem.reset();
      expect(snapshotSystem.getSnapshot()).toBeNull();
      expect(snapshotSystem.getOfflineSeconds()).toBe(0);
    });
  });
});
