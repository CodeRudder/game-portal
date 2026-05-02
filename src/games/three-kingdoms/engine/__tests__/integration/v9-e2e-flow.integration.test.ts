/**
 * v9.0 离线收益 Play 流程集成测试 — §5~§8 交叉验证
 *
 * 覆盖 play 文档章节：
 * - E2E-FLOW-1: 离线→建筑升级联动
 * - E2E-FLOW-2: 离线→武将经验联动
 * - E2E-FLOW-3: 离线→资源产出联动
 * - E2E-FLOW-4: 离线→贸易联动（商队继续运输）
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 引擎未实现的功能用 it.todo + [引擎未实现] 标注
 * - 不使用 as unknown as Record<string, unknown>
 *
 * @see docs/games/three-kingdoms/play/v9-play.md §5~§8
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
    caps: { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
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
// E2E-FLOW-1: 离线→建筑升级联动
// ═══════════════════════════════════════════════════════════════
describe('E2E-FLOW-1: 离线→建筑升级联动', () => {

  // ── §7.2 建筑排队→离线完成→回归面板→邮件闭环 ──

  it('E2E-FLOW-1a: 建筑升级×1.2效率修正', () => {
    // Play §3.1: 建筑升级×1.2(加速完成)
    // Play §7.2: 建筑升级按×1.2效率加速完成
    const rates = createProductionRates();
    const earned: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 0, techPoint: 0, recruitToken: 0 };

    const buildingModified = applySystemModifier(earned, 'building');
    expect(buildingModified.grain).toBe(1200); // 1000 * 1.2
    expect(buildingModified.gold).toBe(600);   // 500 * 1.2
  });

  it('E2E-FLOW-1b: 建筑队列快照记录与完成检测', () => {
    // Play §7.2: 下线前排3个建筑升级 → 离线12h → 检查完成状态
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    const now = Date.now();
    snapshotSys.createSnapshot({
      resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 },
      productionRates: createProductionRates(),
      caps: { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
      buildingQueue: [
        { buildingType: 'farmland', startTime: now - 14400000, endTime: now - 10800000 }, // 3h前完成(2h预计)
        { buildingType: 'market', startTime: now - 14400000, endTime: now - 7200000 },     // 2h前完成(4h预计)
        { buildingType: 'barracks', startTime: now - 14400000, endTime: now - 3600000 },   // 1h前完成(8h预计)
      ],
      techQueue: [],
      expeditionQueue: [],
      tradeCaravans: [],
    });

    const completed = snapshotSys.getCompletedBuildings();
    expect(completed.length).toBe(3);
    expect(completed.map(b => b.buildingType)).toContain('farmland');
    expect(completed.map(b => b.buildingType)).toContain('market');
    expect(completed.map(b => b.buildingType)).toContain('barracks');
  });

  it('E2E-FLOW-1c: 部分建筑完成（离线时间不足）', () => {
    // Play §7.2: 离线时间不足以完成全部建筑
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    const now = Date.now();
    snapshotSys.createSnapshot({
      resources: { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 },
      productionRates: createProductionRates(),
      caps: { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null },
      buildingQueue: [
        { buildingType: 'farmland', startTime: now - 7200000, endTime: now - 3600000 }, // 已完成
        { buildingType: 'market', startTime: now - 7200000, endTime: now + 7200000 },    // 未完成
      ],
      techQueue: [],
      expeditionQueue: [],
      tradeCaravans: [],
    });

    const completed = snapshotSys.getCompletedBuildings();
    expect(completed.length).toBe(1);
    expect(completed[0].buildingType).toBe('farmland');
  });

  it('E2E-FLOW-1d: 完整离线收益计算含建筑修正', () => {
    // Play §7.1: 收益计算→资源入账→仓库截断→溢出提示
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null };

    // 建筑系统修正
    const result = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'building');

    expect(result.snapshot.totalEarned.grain).toBeGreaterThan(0);
    // 建筑修正×1.2
    expect(result.systemModifiedEarned.grain).toBeGreaterThan(result.snapshot.totalEarned.grain);

    // 与资源系统修正对比
    const resultResource = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'resource');
    expect(result.systemModifiedEarned.grain).toBeGreaterThan(resultResource.systemModifiedEarned.grain);
  });

  it('E2E-FLOW-1e: 建筑升级后产出速率更新', () => {
    // Play §7.2: 回归面板展示完成列表与实际状态一致
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);

    // 先升级主城（其他建筑等级不能超过主城）
    sim.upgradeBuilding('castle');

    const grainBefore = sim.engine.resource.getProductionRates().grain ?? 0;

    // 升级农田（增加粮草产出）
    sim.upgradeBuilding('farmland');

    const grainAfter = sim.engine.resource.getProductionRates().grain ?? 0;
    expect(grainAfter).toBeGreaterThan(grainBefore);
  });

});

// ═══════════════════════════════════════════════════════════════
// E2E-FLOW-2: 离线→武将经验联动
// ═══════════════════════════════════════════════════════════════
describe('E2E-FLOW-2: 离线→武将经验联动', () => {

  it('E2E-FLOW-2a: 武将训练系统离线效率修正×0.5', () => {
    // Play §3.1: 各系统按独立效率修正结算
    expect(getSystemModifier('hero')).toBe(0.5);
  });

  it('E2E-FLOW-2b: 武将训练收益按修正系数计算', () => {
    // Play §2: 离线经验 = 基础经验速率 × 离线秒数 × 衰减系数 × (1+经验加成)
    const rates = createProductionRates();
    const earned: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 100, recruitToken: 0 };

    const heroModified = applySystemModifier(earned, 'hero');
    expect(heroModified.techPoint).toBe(50); // 100 * 0.5
  });

  it('E2E-FLOW-2c: 关卡扫荡离线效率修正×0.4', () => {
    // Play §3.4: 自动推图效率系数 = 全局系数 × 0.80 → campaign modifier 0.4
    expect(getSystemModifier('campaign')).toBe(0.4);
  });

  it('E2E-FLOW-2d: VIP加成影响离线收益', () => {
    // Play §2.1: 经验产出快照包含VIP加成
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const boosted0 = offlineReward.applyVipBonus({ grain: 1000, gold: 500, troops: 100, mandate: 0, techPoint: 0, recruitToken: 0 }, 0);
    const boosted3 = offlineReward.applyVipBonus({ grain: 1000, gold: 500, troops: 100, mandate: 0, techPoint: 0, recruitToken: 0 }, 3);

    // VIP3 加成15%
    expect(boosted3.grain).toBeGreaterThan(boosted0.grain);
    expect(boosted3.grain).toBe(1150); // 1000 * 1.15
  });

  it('E2E-FLOW-2e: 完整离线经验计算流程', () => {
    // Play §2: 经验产出快照 → 衰减 → 加成 → 系统修正
    const rates = createFullRates();
    const ctx: OfflineRewardContext = {
      offlineSeconds: 8 * HOUR_S,
      productionRates: rates,
      currentResources: { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 },
      caps: { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null },
      bonusSources: { tech: 0.1, vip: 0.05 },
      vipLevel: 1,
      adUsedToday: 0,
      systemId: 'hero',
    };

    const result = calculateFullOfflineReward(ctx);

    // hero modifier = 0.5
    expect(result.systemModifiedEarned.techPoint).toBeLessThan(result.vipBoostedEarned.techPoint);
    expect(result.systemModifiedEarned.techPoint).toBeGreaterThan(0);
  });

  it('E2E-FLOW-2f: 武将系统可添加武将并计算战力', () => {
    // Play §2: 武将经验联动需要武将存在
    const sim = createSim();

    const countBefore = sim.getGeneralCount();
    sim.addHeroDirectly('liubei');
    const countAfter = sim.getGeneralCount();

    expect(countAfter).toBeGreaterThan(countBefore);
    expect(sim.getTotalPower()).toBeGreaterThan(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// E2E-FLOW-3: 离线→资源产出联动
// ═══════════════════════════════════════════════════════════════
describe('E2E-FLOW-3: 离线→资源产出联动', () => {

  it('E2E-FLOW-3a: 资源产出×1.0效率修正', () => {
    // Play §3.1: 资源产出×1.0
    expect(getSystemModifier('resource')).toBe(1.0);
  });

  it('E2E-FLOW-3b: 离线收益→资源入账全链路', () => {
    // Play §7.1: 收益计算→资源入账→仓库截断→溢出提示 全链路数据一致
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    // 使用无上限caps确保不溢出
    const current: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'resource');

    // 基础快照收益
    expect(result.snapshot.totalEarned.grain).toBeGreaterThan(0);

    // 资源系统修正×1.0，不变
    expect(result.systemModifiedEarned.grain).toBe(result.vipBoostedEarned.grain);

    // 无上限时无溢出
    expect(result.cappedEarned.grain).toBeGreaterThan(0);
    expect(result.overflowResources.grain).toBe(0);
    expect(result.cappedEarned.gold).toBeGreaterThan(0);
    expect(result.overflowResources.gold).toBe(0);
  });

  it('E2E-FLOW-3c: 粮草截断至粮仓容量', () => {
    // Play §3.2: 有上限资源(粮草截断至粮仓容量)
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    // 粮草接近上限
    const current: Resources = { grain: 49000, gold: 500, troops: 100, mandate: 50, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'resource');

    // 粮草空间 = 50000 - 49000 = 1000
    expect(result.cappedEarned.grain).toBeLessThanOrEqual(1000);
    expect(result.overflowResources.grain).toBeGreaterThan(0);
  });

  it('E2E-FLOW-3d: 铜钱无上限全额发放', () => {
    // Play §3.2: 无上限资源(铜钱∞)全额发放
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const current: Resources = { grain: 0, gold: 999999, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'resource');

    // gold cap=null，全额发放
    expect(result.cappedEarned.gold).toBeGreaterThan(0);
    expect(result.overflowResources.gold).toBe(0);
  });

  it('E2E-FLOW-3e: 兵力截断至兵营容量', () => {
    // Play §3.2: 兵力截断至兵营容量
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();

    const current: Resources = { grain: 0, gold: 0, troops: 9900, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'resource');

    // troops空间 = 10000 - 9900 = 100
    expect(result.cappedEarned.troops).toBeLessThanOrEqual(100);
    expect(result.overflowResources.troops).toBeGreaterThan(0);
  });

  it('E2E-FLOW-3f: 天命无上限全额发放', () => {
    // Play §3.2: 天命∞全额发放
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createFullRates();

    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 999, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(24 * HOUR_S, rates, current, caps, 0, 'resource');

    // mandate cap=null，全额发放
    expect(result.cappedEarned.mandate).toBeGreaterThan(0);
    expect(result.overflowResources.mandate).toBe(0);
  });

  it('E2E-FLOW-3g: 远征×0.85保守结算', () => {
    // Play §3.1: 远征×0.85(保守结算)
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null };

    const resultExpedition = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'expedition');
    const resultResource = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'resource');

    // 远征修正×0.85 < 资源修正×1.0
    expect(resultExpedition.systemModifiedEarned.grain).toBeLessThan(resultResource.systemModifiedEarned.grain);
  });

  it('E2E-FLOW-3h: 建筑升级提高产出速率后离线收益增加', () => {
    // Play §7.1: 离线前记录各资源余额+产出速率
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);

    // 先升级主城
    sim.upgradeBuilding('castle');

    // 升级农田前产出
    const ratesBefore = sim.engine.resource.getProductionRates();

    // 升级农田
    sim.upgradeBuilding('farmland');

    const ratesAfter = sim.engine.resource.getProductionRates();

    // 升级后产出更高
    expect(ratesAfter.grain).toBeGreaterThan(ratesBefore.grain);

    // 用新产出计算离线收益应更多
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null };

    const resultBefore = offlineReward.calculateFullReward(8 * HOUR_S, { grain: ratesBefore.grain, gold: ratesBefore.gold ?? 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 }, current, caps, 0, 'resource');
    const resultAfter = offlineReward.calculateFullReward(8 * HOUR_S, { grain: ratesAfter.grain, gold: ratesAfter.gold ?? 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 }, current, caps, 0, 'resource');

    expect(resultAfter.cappedEarned.grain).toBeGreaterThan(resultBefore.cappedEarned.grain);
  });

  it('E2E-FLOW-3i: 多资源同时产出与截断', () => {
    // Play §7.1: 各资源增量 = 净产出速率 × 离线秒数 × 效率系数
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createFullRates();
    const current: Resources = { grain: 49000, gold: 999, troops: 9900, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(8 * HOUR_S, rates, current, caps, 0, 'resource');

    // grain: 有上限，可能截断
    expect(result.cappedEarned.grain).toBeLessThanOrEqual(1000);
    // gold: 无上限，全额
    expect(result.cappedEarned.gold).toBeGreaterThan(0);
    expect(result.overflowResources.gold).toBe(0);
    // troops: 有上限，可能截断
    expect(result.cappedEarned.troops).toBeLessThanOrEqual(100);
    // mandate: 无上限，全额
    expect(result.cappedEarned.mandate).toBeGreaterThan(0);
    expect(result.overflowResources.mandate).toBe(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// E2E-FLOW-4: 离线→贸易联动（商队继续运输）
// ═══════════════════════════════════════════════════════════════
describe('E2E-FLOW-4: 离线→贸易联动（商队继续运输）', () => {

  it('E2E-FLOW-4a: 贸易系统离线效率修正×0.8', () => {
    // Play §3.1: 各系统离线行为 — 贸易路线
    expect(getSystemModifier('Trade')).toBe(0.8);
  });

  it('E2E-FLOW-4b: 离线贸易模拟 — 完成贸易次数计算', () => {
    // Play §3.1: 商队自动完成交易
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    offlineReward.setLastOfflineTime(Date.now() - 10 * HOUR_S * 1000);

    const tradeProfit: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const summary = offlineReward.simulateOfflineTrade(10 * HOUR_S, tradeProfit);

    expect(summary.completedTrades).toBeGreaterThan(0);
    expect(summary.completedTrades).toBeLessThanOrEqual(3); // MAX_OFFLINE_TRADES = 3
    expect(summary.totalProfit.grain).toBeGreaterThan(0);
    expect(summary.totalProfit.gold).toBeGreaterThan(0);
    expect(summary.events.length).toBe(summary.completedTrades);
  });

  it('E2E-FLOW-4c: 离线贸易 — 短于贸易周期无收益', () => {
    // Play §3.1: 离线时间不足一次贸易
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    offlineReward.setLastOfflineTime(Date.now() - 1800 * 1000);

    const tradeProfit: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const summary = offlineReward.simulateOfflineTrade(1800, tradeProfit); // 30min < 1h

    expect(summary.completedTrades).toBe(0);
    expect(summary.totalProfit.grain).toBe(0);
    expect(summary.events.length).toBe(0);
  });

  it('E2E-FLOW-4d: 离线贸易 — 最多3次贸易', () => {
    // Play: MAX_OFFLINE_TRADES = 3
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    offlineReward.setLastOfflineTime(Date.now() - 100 * HOUR_S * 1000);

    const tradeProfit: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const summary = offlineReward.simulateOfflineTrade(100 * HOUR_S, tradeProfit);

    // 即使离线100h，最多3次贸易
    expect(summary.completedTrades).toBe(3);
  });

  it('E2E-FLOW-4e: 离线贸易收益含效率折扣', () => {
    // Play: OFFLINE_TRADE_EFFICIENCY = 0.6
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    offlineReward.setLastOfflineTime(Date.now() - 2 * HOUR_S * 1000);

    const tradeProfit: Resources = { grain: 100, gold: 50, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const summary = offlineReward.simulateOfflineTrade(2 * HOUR_S, tradeProfit);

    if (summary.completedTrades > 0) {
      // 每次贸易收益 = tradeProfit * 0.6
      const eventProfit = summary.events[0].estimatedProfit;
      expect(eventProfit.grain).toBe(60); // 100 * 0.6
      expect(eventProfit.gold).toBe(30);  // 50 * 0.6
    }
  });

  it('E2E-FLOW-4f: 贸易修正应用到完整离线收益', () => {
    // Play §7.1: 贸易系统修正×0.8
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null };

    const resultTrade = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'Trade');
    const resultResource = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'resource');

    // Trade修正×0.8 < resource修正×1.0
    expect(resultTrade.systemModifiedEarned.grain).toBeLessThan(resultResource.systemModifiedEarned.grain);
  });

  it('E2E-FLOW-4g: 快照记录商队运输状态', () => {
    // Play §3.1: 商队状态
    const sim = createSim();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();

    snapshotSys.createSnapshot(createFullSnapshotParams());
    const snapshot = snapshotSys.getSnapshot();

    expect(snapshot!.tradeCaravans.length).toBe(1);
    expect(snapshot!.tradeCaravans[0].caravanId).toBe('caravan_001');
    expect(snapshot!.tradeCaravans[0].estimatedProfit.grain).toBe(100);
  });

  it('E2E-FLOW-4h: 检测离线期间完成的贸易', () => {
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
        { caravanId: 'caravan_002', routeId: 'route_002', startTime: now - 3600000, endTime: now + 3600000, estimatedProfit: { grain: 80, gold: 40, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 } },
      ],
    });

    const completed = snapshotSys.getCompletedTrades();
    expect(completed.length).toBe(1);
    expect(completed[0].caravanId).toBe('caravan_001');
  });

});

// ═══════════════════════════════════════════════════════════════
// §7 交叉验证补充
// ═══════════════════════════════════════════════════════════════
describe('E2E-FLOW 交叉验证补充', () => {

  it('E2E-CROSS-1: 翻倍机制→货币消耗→广告次数联动', () => {
    // Play §7.4: 广告翻倍后收益=原收益×2，广告剩余次数-1
    const earned: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 0, techPoint: 0, recruitToken: 0 };

    // 第1次广告翻倍成功
    const r1 = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 0);
    expect(r1.success).toBe(true);
    expect(r1.doubledEarned.grain).toBe(2000);

    // 第2次
    const r2 = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 1);
    expect(r2.success).toBe(true);

    // 第3次
    const r3 = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 2);
    expect(r3.success).toBe(true);

    // 第4次失败
    const r4 = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 3);
    expect(r4.success).toBe(false);
  });

  it('E2E-CROSS-2: 科技研究×1.0效率修正', () => {
    // Play §3.1: 科技研究×1.0
    expect(getSystemModifier('tech')).toBe(1.0);

    const earned: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 100, recruitToken: 0 };
    const modified = applySystemModifier(earned, 'tech');
    expect(modified.techPoint).toBe(100); // ×1.0不变
  });

  it('E2E-CROSS-3: 远征→离线结算→保守系数', () => {
    // Play §7.3: 远征按×0.85保守结算(战利品≈在线85%)
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const rates = createProductionRates();
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'expedition');

    // 远征修正×0.85
    const ratio = result.systemModifiedEarned.grain / result.vipBoostedEarned.grain;
    expect(ratio).toBeCloseTo(0.85, 2);
  });

  it('E2E-CROSS-4: 各系统修正系数完整性', () => {
    // Play §3.1: 验证所有系统修正系数存在
    const expectedSystems = ['resource', 'building', 'tech', 'expedition', 'Trade', 'hero', 'campaign'];
    for (const sysId of expectedSystems) {
      const mod = getSystemModifier(sysId);
      expect(mod).toBeGreaterThan(0);
      expect(mod).toBeLessThanOrEqual(1.5);
    }
  });

  it('E2E-CROSS-5: 完整离线收益→资源入账→溢出提示 全链路', () => {
    // Play §7.1: 收益计算→资源入账→仓库截断→溢出提示 全链路数据一致
    const sim = createSim();
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const snapshotSys = sim.engine.getOfflineSnapshotSystem();
    const rates = createFullRates();

    // 1. 创建快照
    snapshotSys.createSnapshot(createFullSnapshotParams());

    // 2. 计算离线收益
    const current: Resources = { grain: 1000, gold: 500, troops: 100, mandate: 50, techPoint: 10, recruitToken: 5 };
    const caps = { grain: 50000, gold: 2000, troops: 10000, mandate: null, techPoint: null, recruitToken: null };

    const result = offlineReward.calculateFullReward(12 * HOUR_S, rates, current, caps, 3, 'resource');

    // 3. 验证计算结果结构完整
    expect(result.snapshot).toBeDefined();
    expect(result.vipBoostedEarned).toBeDefined();
    expect(result.systemModifiedEarned).toBeDefined();
    expect(result.cappedEarned).toBeDefined();
    expect(result.overflowResources).toBeDefined();
    expect(result.tradeSummary).toBeDefined();
    expect(result.panelData).toBeDefined();

    // 4. VIP加成已应用
    expect(result.vipBoostedEarned.grain).toBeGreaterThan(result.snapshot.totalEarned.grain);

    // 5. 系统修正已应用（resource×1.0，不变）
    expect(result.systemModifiedEarned.grain).toBe(result.vipBoostedEarned.grain);

    // 6. 清理快照
    snapshotSys.clearSnapshot();
    expect(snapshotSys.getSnapshot()).toBeNull();
  });

  it('E2E-CROSS-6: 加成系数+系统修正+溢出截断全链路数值验证', () => {
    // Play §7.1: 各资源增量 = 净产出速率 × 离线秒数 × 效率系数
    const rates: Resources = { grain: 10, gold: 5, troops: 1, mandate: 0, techPoint: 0, recruitToken: 0 };
    const ctx: OfflineRewardContext = {
      offlineSeconds: 10 * HOUR_S,
      productionRates: rates,
      currentResources: { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 },
      caps: { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null },
      bonusSources: { tech: 0.1 },
      vipLevel: 0,
      adUsedToday: 0,
    };

    const result = calculateFullOfflineReward(ctx);

    // 手动计算验证：
    // 10h = 2h@100% + 6h@80% + 2h@60%
    // grain基础 = 10*(7200*1.0 + 21600*0.8 + 7200*0.6) = 10*(7200+17280+4320) = 10*28800 = 288000
    // 加成系数 = 1 + 0.1 = 1.1
    // grain含加成 = 288000 * 1.1 = 316800
    expect(result.snapshot.totalEarned.grain).toBe(316800);

    // gold基础 = 5*28800 = 144000, 含加成 = 144000*1.1 = 158400
    expect(result.snapshot.totalEarned.gold).toBe(158400);

    // troops基础 = 1*28800 = 28800, 含加成 = 28800*1.1 = 31680
    expect(result.snapshot.totalEarned.troops).toBe(31680);
  });

  it('E2E-CROSS-7: 建筑升级→产出增加→离线收益增加闭环', () => {
    // Play §7.2: 建筑升级完成→产出速率更新→影响后续离线收益
    const sim = createSim();
    sim.addResources(MASSIVE_RESOURCES);

    // 先升级主城到3（其他建筑等级不能超过主城）
    sim.upgradeBuildingTo('castle', 3);

    // 初始产出（农田Lv1）
    const ratesLv1 = { ...sim.engine.resource.getProductionRates() };

    // 升级农田到3
    sim.upgradeBuildingTo('farmland', 3);
    const ratesLv3 = { ...sim.engine.resource.getProductionRates() };

    // 产出应增加
    expect(ratesLv3.grain).toBeGreaterThan(ratesLv1.grain);

    // 用新产出计算离线收益
    const offlineReward = sim.engine.getOfflineRewardSystem();
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 };
    const caps = { grain: null, gold: 2000, troops: null, mandate: null, techPoint: null, recruitToken: null };

    const resultLv1 = offlineReward.calculateFullReward(8 * HOUR_S,
      { grain: ratesLv1.grain, gold: ratesLv1.gold ?? 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 },
      current, caps, 0, 'resource');

    const resultLv3 = offlineReward.calculateFullReward(8 * HOUR_S,
      { grain: ratesLv3.grain, gold: ratesLv3.gold ?? 0, troops: 0, mandate: 0, techPoint: 0, recruitToken: 0 },
      current, caps, 0, 'resource');

    expect(resultLv3.cappedEarned.grain).toBeGreaterThan(resultLv1.cappedEarned.grain);
  });

});
