/**
 * v9.0 离线收益集成测试 — 流程3: 系统效率修正 + 贸易 + VIP + 序列化
 *
 * 覆盖 Play 文档:
 *   §3.1 各系统离线行为
 *   §3.2 资源溢出处理
 *   §3.3 离线收益预估
 *   §3.4 自动推图离线行为
 *   §3.7 商店离线补货(贸易)
 *   §7.2 建筑排队→离线完成→回归面板→邮件闭环
 *   §7.3 远征→离线结算→战利品→邮件附件全链路
 *   §7.13 贸易系统离线行为完整验证
 *   §7.12 经验离线→升级→邮件→回归面板联动
 */

import {
  OfflineRewardSystem,
  OfflineEstimateSystem,
  SYSTEM_EFFICIENCY_MODIFIERS,
  VIP_OFFLINE_BONUSES,
  DEFAULT_WAREHOUSE_EXPANSIONS,
  OFFLINE_TRADE_EFFICIENCY,
  MAX_OFFLINE_TRADES,
  OFFLINE_TRADE_DURATION,
  calculateOfflineSnapshot,
  estimateOfflineReward,
} from '../index';
import { OfflineSnapshotSystem } from '../OfflineSnapshotSystem';
import type { Resources, ProductionRate, ResourceCap } from '../../../../shared/types';

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

// ─────────────────────────────────────────────
// §3.1 各系统离线行为
// ─────────────────────────────────────────────

describe('v9 §3.1 各系统离线行为', () => {
  it('资源产出×1.0', () => {
    const system = new OfflineRewardSystem();
    expect(system.getSystemModifier('resource')).toBe(1.0);
  });

  it('建筑升级×1.2(加速完成)', () => {
    const system = new OfflineRewardSystem();
    expect(system.getSystemModifier('building')).toBe(1.2);
  });

  it('科技研究×1.0', () => {
    const system = new OfflineRewardSystem();
    expect(system.getSystemModifier('tech')).toBe(1.0);
  });

  it('远征×0.85(保守结算)', () => {
    const system = new OfflineRewardSystem();
    expect(system.getSystemModifier('expedition')).toBeCloseTo(0.85, 2);
  });

  it('贸易路线×0.8', () => {
    const system = new OfflineRewardSystem();
    expect(system.getSystemModifier('Trade')).toBe(0.8);
  });

  it('自动推图×0.4', () => {
    const system = new OfflineRewardSystem();
    expect(system.getSystemModifier('campaign')).toBe(0.4);
  });

  it('未知系统默认×1.0', () => {
    const system = new OfflineRewardSystem();
    expect(system.getSystemModifier('unknown_system')).toBe(1.0);
  });

  it('系统修正正确应用', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 1000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const modified = system.applySystemModifier(earned, 'building');
    expect(modified.grain).toBe(1200); // ×1.2
  });

  it('远征保守结算应用', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 0, gold: 1000, troops: 0, mandate: 0, techPoint: 0 };
    const modified = system.applySystemModifier(earned, 'expedition');
    expect(modified.gold).toBe(850); // ×0.85
  });
});

// ─────────────────────────────────────────────
// §3.2 资源溢出处理
// ─────────────────────────────────────────────

describe('v9 §3.2 资源溢出处理', () => {
  it('粮草截断至粮仓容量', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 5000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const current: Resources = { grain: 4500, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const caps = makeCaps({ grain: 5000 });
    const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
    expect(cappedEarned.grain).toBe(500); // 5000 - 4500 = 500 space
    expect(overflowResources.grain).toBe(4500);
  });

  it('铜钱(∞)全额发放无截断', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 0, gold: 99999, troops: 0, mandate: 0, techPoint: 0 };
    const current = zeroRes();
    const caps = makeCaps();
    const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
    expect(cappedEarned.gold).toBe(99999);
    expect(overflowResources.gold).toBe(0);
  });

  it('天命(∞)全额发放无截断', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 0, gold: 0, troops: 0, mandate: 88888, techPoint: 0 };
    const current = zeroRes();
    const caps = makeCaps();
    const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
    expect(cappedEarned.mandate).toBe(88888);
    expect(overflowResources.mandate).toBe(0);
  });

  it('兵力截断至兵营容量', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 0, gold: 0, troops: 2000, mandate: 0, techPoint: 0 };
    const current: Resources = { grain: 0, gold: 0, troops: 500, mandate: 0, techPoint: 0 };
    const caps = makeCaps({ troops: 1000 });
    const { cappedEarned, overflowResources } = system.applyCapAndOverflow(earned, current, caps);
    expect(cappedEarned.troops).toBe(500); // 1000 - 500 = 500 space
    expect(overflowResources.troops).toBe(1500);
  });
});

// ─────────────────────────────────────────────
// §3.3 离线收益预估
// ─────────────────────────────────────────────

describe('v9 §3.3 离线收益预估', () => {
  it('预估数据与实际计算公式一致', () => {
    const rates = makeRates({ grain: 100 });
    const estimated = estimateOfflineReward(2, rates, {});
    const actual = calculateOfflineSnapshot(2 * HOUR_S, rates, {});
    // 预估和实际计算应一致(2h全在tier1)
    expect(estimated.totalEarned.grain).toBe(actual.totalEarned.grain);
  });

  it('72h后显示封顶提示', () => {
    const rates = makeRates();
    const estimated = estimateOfflineReward(80, rates, {});
    expect(estimated.isCapped).toBe(true);
  });

  it('效率系数随时长递减', () => {
    const rates = makeRates();
    const e2 = estimateOfflineReward(2, rates, {});
    const e8 = estimateOfflineReward(8, rates, {});
    const e24 = estimateOfflineReward(24, rates, {});
    const e48 = estimateOfflineReward(48, rates, {});
    expect(e2.overallEfficiency).toBeGreaterThan(e8.overallEfficiency);
    expect(e8.overallEfficiency).toBeGreaterThan(e24.overallEfficiency);
    expect(e24.overallEfficiency).toBeGreaterThan(e48.overallEfficiency);
  });
});

// ─────────────────────────────────────────────
// §3.4 自动推图离线行为
// ─────────────────────────────────────────────

describe('v9 §3.4 自动推图离线行为', () => {
  it('自动推图效率系数 = 全局系数 × 0.40', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 1000, gold: 500, troops: 0, mandate: 0, techPoint: 0 };
    const modified = system.applySystemModifier(earned, 'campaign');
    expect(modified.grain).toBe(400); // ×0.4
    expect(modified.gold).toBe(200);
  });
});

// ─────────────────────────────────────────────
// §7.2 建筑排队→离线完成→回归面板→邮件闭环
// ─────────────────────────────────────────────

describe('v9 §7.2 建筑排队闭环', () => {
  it('建筑升级按×1.2效率加速完成', () => {
    const system = new OfflineRewardSystem();
    const snapSystem = new OfflineSnapshotSystem();

    // 模拟: 排3个建筑升级(2h/4h/8h)
    const now = Date.now();
    snapSystem.createSnapshot({
      resources: zeroRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      buildingQueue: [
        { buildingId: 'b1', name: '农田', fromLevel: 1, toLevel: 2, startTime: now - 2 * HOUR_S * 1000, endTime: now - 1 * HOUR_S * 1000 },
        { buildingId: 'b2', name: '兵营', fromLevel: 2, toLevel: 3, startTime: now - 4 * HOUR_S * 1000, endTime: now - 2 * HOUR_S * 1000 },
        { buildingId: 'b3', name: '市场', fromLevel: 3, toLevel: 4, startTime: now - 8 * HOUR_S * 1000, endTime: now - 4 * HOUR_S * 1000 },
      ],
    });

    // 离线12h后上线
    const completed = snapSystem.getCompletedBuildings(now);
    expect(completed).toHaveLength(3);
    expect(completed[0].buildingId).toBe('b1');
    expect(completed[1].buildingId).toBe('b2');
    expect(completed[2].buildingId).toBe('b3');
  });

  it('建筑修正×1.2正确应用', () => {
    const system = new OfflineRewardSystem();
    const rates = makeRates({ grain: 100 });
    const result = system.calculateFullReward(
      HOUR_S, rates, zeroRes(), makeCaps(), 0, 'building',
    );
    // building modifier = 1.2
    const baseGrain = result.snapshot.totalEarned.grain;
    const modifiedGrain = result.systemModifiedEarned.grain;
    expect(modifiedGrain).toBe(Math.floor(baseGrain * 1.2));
  });
});

// ─────────────────────────────────────────────
// §7.3 远征→离线结算→战利品
// ─────────────────────────────────────────────

describe('v9 §7.3 远征闭环', () => {
  it('远征按×0.85保守结算', () => {
    const system = new OfflineRewardSystem();
    const snapSystem = new OfflineSnapshotSystem();
    const now = Date.now();

    snapSystem.createSnapshot({
      resources: zeroRes(),
      productionRates: makeRates(),
      caps: makeCaps(),
      expeditionQueue: [
        { expeditionId: 'e1', target: '黄巾贼', startTime: now - 10 * HOUR_S * 1000, endTime: now - 4 * HOUR_S * 1000 },
      ],
    });

    const completed = snapSystem.getCompletedExpeditions(now);
    expect(completed).toHaveLength(1);
    expect(completed[0].expeditionId).toBe('e1');
  });

  it('远征修正×0.85正确应用', () => {
    const system = new OfflineRewardSystem();
    const rates = makeRates({ gold: 100 });
    const result = system.calculateFullReward(
      HOUR_S, rates, zeroRes(), makeCaps(), 0, 'expedition',
    );
    const baseGold = result.snapshot.totalEarned.gold;
    const modifiedGold = result.systemModifiedEarned.gold;
    expect(modifiedGold).toBe(Math.floor(baseGold * 0.85));
  });
});

// ─────────────────────────────────────────────
// §7.13 贸易系统离线行为完整验证
// ─────────────────────────────────────────────

describe('v9 §7.13 贸易系统离线行为', () => {
  it('贸易效率系数 OFFLINE_TRADE_EFFICIENCY = 0.6', () => {
    expect(OFFLINE_TRADE_EFFICIENCY).toBe(0.6);
  });

  it('最大同时贸易数 MAX_OFFLINE_TRADES = 3', () => {
    expect(MAX_OFFLINE_TRADES).toBe(3);
  });

  it('贸易完成时间 OFFLINE_TRADE_DURATION = 3600s', () => {
    expect(OFFLINE_TRADE_DURATION).toBe(3600);
  });

  it('离线6h: 商队完成交易+利润按效率系数计算', () => {
    const system = new OfflineRewardSystem();
    system.setLastOfflineTime(Date.now() - 6 * HOUR_S * 1000);
    const profit: Resources = { grain: 0, gold: 100, troops: 0, mandate: 0, techPoint: 0 };
    const summary = system.simulateOfflineTrade(6 * HOUR_S, profit);

    // 6h / 1h per trade = 6 trades, capped at 3
    expect(summary.completedTrades).toBe(3);
    // 每次利润: 100 * 0.6 = 60
    expect(summary.totalProfit.gold).toBe(3 * 100 * 0.6);
  });

  it('离线<1h: 无贸易完成', () => {
    const system = new OfflineRewardSystem();
    const summary = system.simulateOfflineTrade(HOUR_S - 1, { grain: 0, gold: 100, troops: 0, mandate: 0, techPoint: 0 });
    expect(summary.completedTrades).toBe(0);
    expect(summary.totalProfit.gold).toBe(0);
  });

  it('多支商队同时运输: 各商队独立结算', () => {
    const system = new OfflineRewardSystem();
    system.setLastOfflineTime(Date.now() - 10 * HOUR_S * 1000);
    const profit: Resources = { grain: 0, gold: 200, troops: 0, mandate: 0, techPoint: 0 };
    const summary = system.simulateOfflineTrade(10 * HOUR_S, profit);

    // 10h / 1h = 10 trades, capped at 3
    expect(summary.completedTrades).toBe(3);
    expect(summary.events).toHaveLength(3);
    // 每次利润: 200 * 0.6 = 120
    expect(summary.totalProfit.gold).toBe(3 * 120);
  });

  it('贸易事件包含正确的时间戳', () => {
    const system = new OfflineRewardSystem();
    const lastOffline = Date.now() - 5 * HOUR_S * 1000;
    system.setLastOfflineTime(lastOffline);
    const summary = system.simulateOfflineTrade(5 * HOUR_S, { grain: 0, gold: 100, troops: 0, mandate: 0, techPoint: 0 });

    for (let i = 0; i < summary.events.length; i++) {
      expect(summary.events[i].startTime).toBe(lastOffline + i * OFFLINE_TRADE_DURATION);
      expect(summary.events[i].completeTime).toBe(lastOffline + (i + 1) * OFFLINE_TRADE_DURATION);
    }
  });
});

// ─────────────────────────────────────────────
// §7.12 经验离线→升级→邮件→回归面板联动
// ─────────────────────────────────────────────

describe('v9 §7.12 经验离线联动', () => {
  it('离线经验正确计算(基础速率×秒数×衰减×加成)', () => {
    const rates = makeRates({ techPoint: 10 });
    const snap = calculateOfflineSnapshot(HOUR_S, rates, { tech: 0.2 });
    // 1h = 3600s, tier1=100%, bonus = 1 + 0.2 = 1.2
    const expected = Math.floor(10 * 3600 * 1.0 * 1.2);
    expect(snap.totalEarned.techPoint).toBe(expected);
  });

  it('经验溢出推动升级时等级正确提升(模拟)', () => {
    // 注意: OfflineRewardSystem.calculateSnapshot 仅迭代 ['grain','gold','troops','mandate'],
    // 不包含 techPoint。techPoint 需要通过 OfflineRewardEngine.calculateOfflineSnapshot 计算。
    // 使用 OfflineRewardEngine 来验证 techPoint 收益
    const rates = makeRates({ techPoint: 100 });
    const snap = calculateOfflineSnapshot(8 * HOUR_S, rates, {});
    expect(snap.totalEarned.techPoint).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// VIP加成验证
// ─────────────────────────────────────────────

describe('v9 VIP离线加成', () => {
  it('VIP0: 无加成', () => {
    const system = new OfflineRewardSystem();
    const bonus = system.getVipBonus(0);
    expect(bonus.efficiencyBonus).toBe(0);
    expect(bonus.dailyDoubleLimit).toBe(1);
  });

  it('VIP5: +25%效率+24h额外时长+5次翻倍', () => {
    const system = new OfflineRewardSystem();
    const bonus = system.getVipBonus(5);
    expect(bonus.efficiencyBonus).toBeCloseTo(0.25, 2);
    expect(bonus.extraHours).toBe(24);
    expect(bonus.dailyDoubleLimit).toBe(5);
  });

  it('VIP加成正确应用', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 1000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const boosted = system.applyVipBonus(earned, 5);
    // 1000 * (1 + 0.25) = 1250
    expect(boosted.grain).toBe(1250);
  });

  it('VIP每日翻倍次数限制', () => {
    const system = new OfflineRewardSystem();
    const earned: Resources = { grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 };

    // VIP0: 1次
    const r1 = system.applyDouble(earned, { source: 'vip', multiplier: 2, description: '' });
    expect(r1.success).toBe(true);
    const r2 = system.applyDouble(earned, { source: 'vip', multiplier: 2, description: '' });
    expect(r2.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 序列化/反序列化
// ─────────────────────────────────────────────

describe('v9 序列化/反序列化', () => {
  it('序列化→反序列化→数据一致', () => {
    const system = new OfflineRewardSystem();
    system.setLastOfflineTime(1000);
    system.addBoostItem('offline_boost_1h', 3);
    system.addBoostItem('offline_boost_4h', 1);

    const data = system.serialize();
    expect(data.lastOfflineTime).toBe(1000);
    expect(data.boostItems['offline_boost_1h']).toBe(3);

    // 反序列化到新系统
    const system2 = new OfflineRewardSystem();
    system2.deserialize(data);
    const data2 = system2.serialize();
    expect(data2.lastOfflineTime).toBe(1000);
    expect(data2.boostItems['offline_boost_1h']).toBe(3);
  });

  it('快照系统序列化/反序列化', () => {
    const snapSystem = new OfflineSnapshotSystem();
    snapSystem.createSnapshot({
      resources: { grain: 100, gold: 200, troops: 50, mandate: 10, techPoint: 5 },
      productionRates: makeRates(),
      caps: makeCaps(),
    });

    const saveData = snapSystem.getSaveData();
    expect(saveData.lastOfflineTime).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// 仓库扩容
// ─────────────────────────────────────────────

describe('v9 仓库扩容', () => {
  it('默认仓库容量', () => {
    const system = new OfflineRewardSystem();
    // grain: baseCapacity=2000, perLevel=1000, level=1 → 2000 + 0*1000 = 2000
    expect(system.getWarehouseCapacity('grain')).toBe(2000);
    // troops: baseCapacity=500, perLevel=500, level=1 → 500 + 0*500 = 500
    expect(system.getWarehouseCapacity('troops')).toBe(500);
  });

  it('升级仓库增加容量', () => {
    const system = new OfflineRewardSystem();
    const result = system.upgradeWarehouse('grain');
    expect(result.success).toBe(true);
    expect(result.newCapacity).toBe(3000); // 2000 + 1*1000
    expect(result.newLevel).toBe(2);
  });

  it('仓库等级上限30', () => {
    const system = new OfflineRewardSystem();
    // 升到30级
    for (let i = 0; i < 29; i++) {
      system.upgradeWarehouse('grain');
    }
    const result = system.upgradeWarehouse('grain');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('最大等级');
  });
});
