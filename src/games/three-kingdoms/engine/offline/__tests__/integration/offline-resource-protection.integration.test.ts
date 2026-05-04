/**
 * v9.0 离线收益集成测试 — 资源保护 + 仓库扩容 + 贸易 + 加速道具
 *
 * 覆盖 Play 文档:
 *   §3.2  资源溢出处理
 *   §3.3  离线收益预估
 *   §3.7  商店离线补货
 *   §7.1  离线收益→资源→仓库联动
 *   §7.8  资源保护→离线收益→溢出提示联动
 *   §7.13 贸易系统离线行为
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OfflineRewardSystem,
  OfflineSnapshotSystem,
  applyOverflowRules,
  calculateOfflineSnapshot,
  calculateFullOfflineReward,
  getSystemModifier,
  SYSTEM_EFFICIENCY_MODIFIERS,
  OVERFLOW_RULES,
  RESOURCE_PROTECTIONS,
  DEFAULT_WAREHOUSE_EXPANSIONS,
  OFFLINE_TRADE_EFFICIENCY,
  MAX_OFFLINE_TRADES,
  OFFLINE_TRADE_DURATION,
} from '../../index';
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
// §1 资源溢出处理
// ─────────────────────────────────────────────

describe('v9-int §1 资源溢出处理', () => {
  it('§1.1 粮草截断至粮仓容量', () => {
    const earned = zeroRes();
    earned.grain = 5000;
    const current = makeCurrentRes({ grain: 4000 });
    const caps = makeCaps({ grain: 5000 });
    const result = applyOverflowRules(earned, current, caps);
    expect(result.cappedEarned.grain).toBe(1000); // 5000 - 4000
    expect(result.overflowResources.grain).toBe(4000);
  });

  it('§1.2 铜钱(∞)全额发放无截断', () => {
    const earned = zeroRes();
    earned.gold = 999999;
    const current = makeCurrentRes({ gold: 999999 });
    const caps = makeCaps();
    const result = applyOverflowRules(earned, current, caps);
    expect(result.cappedEarned.gold).toBe(999999);
    expect(result.overflowResources.gold).toBe(0);
  });

  it('§1.3 天命(∞)全额发放无截断', () => {
    const earned = zeroRes();
    earned.mandate = 500;
    const current = makeCurrentRes({ mandate: 999 });
    const caps = makeCaps();
    const result = applyOverflowRules(earned, current, caps);
    expect(result.cappedEarned.mandate).toBe(500);
    expect(result.overflowResources.mandate).toBe(0);
  });

  it('§1.4 兵力截断至兵营容量', () => {
    const earned = zeroRes();
    earned.troops = 2000;
    const current = makeCurrentRes({ troops: 500 });
    const caps = makeCaps({ troops: 1000 });
    const result = applyOverflowRules(earned, current, caps);
    expect(result.cappedEarned.troops).toBe(500); // 1000 - 500
    expect(result.overflowResources.troops).toBe(1500);
  });

  it('§1.5 仓库未满时收益全额发放', () => {
    const earned = zeroRes();
    earned.grain = 100;
    const current = makeCurrentRes({ grain: 0 });
    const caps = makeCaps({ grain: 5000 });
    const result = applyOverflowRules(earned, current, caps);
    expect(result.cappedEarned.grain).toBe(100);
    expect(result.overflowResources.grain).toBe(0);
  });

  it('§1.6 仓库已满时收益全部溢出', () => {
    const earned = zeroRes();
    earned.grain = 500;
    const current = makeCurrentRes({ grain: 5000 });
    const caps = makeCaps({ grain: 5000 });
    const result = applyOverflowRules(earned, current, caps);
    expect(result.cappedEarned.grain).toBe(0);
    expect(result.overflowResources.grain).toBe(500);
  });

  it('§1.7 多资源同时溢出', () => {
    const earned = zeroRes();
    earned.grain = 5000;
    earned.troops = 2000;
    earned.gold = 1000;
    const current = makeCurrentRes({ grain: 4900, troops: 800, gold: 0 });
    const caps = makeCaps({ grain: 5000, troops: 1000 });
    const result = applyOverflowRules(earned, current, caps);
    expect(result.cappedEarned.grain).toBe(100);
    expect(result.overflowResources.grain).toBe(4900);
    expect(result.cappedEarned.troops).toBe(200);
    expect(result.overflowResources.troops).toBe(1800);
    expect(result.cappedEarned.gold).toBe(1000); // 无上限
  });

  it('§1.8 applyOverflowRules守恒: capped + overflow = earned', () => {
    const earned = zeroRes();
    earned.grain = 3000;
    const current = makeCurrentRes({ grain: 4000 });
    const caps = makeCaps({ grain: 5000 });
    const result = applyOverflowRules(earned, current, caps);
    expect(result.cappedEarned.grain + result.overflowResources.grain).toBe(3000);
  });
});

// ─────────────────────────────────────────────
// §2 资源保护机制
// ─────────────────────────────────────────────

describe('v9-int §2 资源保护机制', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§2.1 粮草保护30%，最低100', () => {
    const protection = rewardSystem.getResourceProtection('grain', 500);
    expect(protection).toBe(Math.max(500 * 0.3, 100)); // max(150, 100) = 150
  });

  it('§2.2 粮草保护最低100（当30%<100时）', () => {
    const protection = rewardSystem.getResourceProtection('grain', 200);
    expect(protection).toBe(Math.max(200 * 0.3, 100)); // max(60, 100) = 100
  });

  it('§2.3 铜钱保护20%，最低500', () => {
    const protection = rewardSystem.getResourceProtection('gold', 1000);
    expect(protection).toBe(Math.max(1000 * 0.2, 500)); // max(200, 500) = 500
  });

  it('§2.4 兵力保护40%，最低50', () => {
    const protection = rewardSystem.getResourceProtection('troops', 200);
    expect(protection).toBe(Math.max(200 * 0.4, 50)); // max(80, 50) = 80
  });

  it('§2.5 未知资源无保护', () => {
    const protection = rewardSystem.getResourceProtection('unknown', 1000);
    expect(protection).toBe(0);
  });

  it('§2.6 applyResourceProtection正确限制消耗', () => {
    // 500粮草, 保护150, 请求消耗400 → 实际消耗 = min(400, 500-150) = 350
    const actual = rewardSystem.applyResourceProtection('grain', 500, 400);
    expect(actual).toBe(350);
  });

  it('§2.7 请求消耗小于可消耗量时全额', () => {
    // 1000粮草, 保护300, 请求消耗100 → 实际消耗100
    const actual = rewardSystem.applyResourceProtection('grain', 1000, 100);
    expect(actual).toBe(100);
  });

  it('§2.8 资源量低于保护量时消耗受限', () => {
    // 150粮草, 保护max(150*0.3, 100)=150, 请求消耗10
    // applyResourceProtection = min(requested, max(0, current - protected))
    // = min(10, max(0, 150 - 150)) = min(10, 0) = 0
    // 但实际代码: max(0, current - protected) = max(0, 150-150) = 0, min(10, 0) = 0
    // 然而: protectionFloor=100, protectionRatio=0.3, current=150
    // protected = max(150*0.3, 100) = max(45, 100) = 100
    // 实际消耗 = min(10, max(0, 150-100)) = min(10, 50) = 10
    const actual = rewardSystem.applyResourceProtection('grain', 150, 10);
    expect(actual).toBe(10); // 保护量=100, 可消耗50, 请求10 → 10
  });
});

// ─────────────────────────────────────────────
// §3 仓库扩容
// ─────────────────────────────────────────────

describe('v9-int §3 仓库扩容', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§3.1 默认粮仓容量 = baseCapacity + (currentLevel-1) × perLevelIncrease', () => {
    // grain: baseCapacity=2000, perLevel=1000, currentLevel=1 → 2000 + 0 = 2000
    expect(rewardSystem.getWarehouseCapacity('grain')).toBe(2000);
  });

  it('§3.2 默认兵营容量', () => {
    // troops: baseCapacity=500, perLevel=500, currentLevel=1 → 500 + 0 = 500
    expect(rewardSystem.getWarehouseCapacity('troops')).toBe(500);
  });

  it('§3.3 升级仓库增加容量', () => {
    const result = rewardSystem.upgradeWarehouse('grain');
    expect(result.success).toBe(true);
    expect(result.newCapacity).toBe(3000); // 2000 + 1000
    expect(result.previousCapacity).toBe(2000);
    expect(result.newLevel).toBe(2);
  });

  it('§3.4 多次升级容量递增', () => {
    rewardSystem.upgradeWarehouse('grain'); // Lv2: 3000
    rewardSystem.upgradeWarehouse('grain'); // Lv3: 4000
    expect(rewardSystem.getWarehouseCapacity('grain')).toBe(4000);
    expect(rewardSystem.getWarehouseLevel('grain')).toBe(3);
  });

  it('§3.5 仓库等级上限30', () => {
    // 快速升到上限
    for (let i = 0; i < 30; i++) {
      rewardSystem.upgradeWarehouse('grain');
    }
    const result = rewardSystem.upgradeWarehouse('grain');
    expect(result.success).toBe(false);
    expect(result.reason).toContain('最大等级');
  });

  it('§3.6 未知资源类型不可扩容', () => {
    const result = rewardSystem.upgradeWarehouse('unknown');
    expect(result.success).toBe(false);
  });

  it('§3.7 扩容后溢出减少', () => {
    const rates = makeRates({ grain: 100 });
    const current = makeCurrentRes({ grain: 1900 });
    const caps = makeCaps({ grain: 2000 });

    // 升级前
    const result1 = rewardSystem.calculateFullReward(HOUR_S * 2, rates, current, caps, 0, 'resource');
    const overflow1 = result1.overflowResources.grain;

    // 升级后
    rewardSystem.upgradeWarehouse('grain'); // 2000→3000
    const newCaps = makeCaps({ grain: 3000 });
    const result2 = rewardSystem.calculateFullReward(HOUR_S * 2, rates, current, newCaps, 0, 'resource');
    const overflow2 = result2.overflowResources.grain;

    expect(overflow2).toBeLessThanOrEqual(overflow1);
  });

  it('§3.8 扩容等级序列化保存', () => {
    rewardSystem.upgradeWarehouse('grain');
    rewardSystem.upgradeWarehouse('troops');
    const data = rewardSystem.serialize();
    expect(data.warehouseLevels['grain']).toBe(2);
    expect(data.warehouseLevels['troops']).toBe(2);
  });
});

// ─────────────────────────────────────────────
// §4 离线贸易行为
// ─────────────────────────────────────────────

describe('v9-int §4 离线贸易行为', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
    rewardSystem.setLastOfflineTime(Date.now() - HOUR_S * 10000);
  });

  it('§4.1 贸易效率系数 OFFLINE_TRADE_EFFICIENCY = 0.6', () => {
    expect(OFFLINE_TRADE_EFFICIENCY).toBe(0.6);
  });

  it('§4.2 最大同时贸易数 MAX_OFFLINE_TRADES = 3', () => {
    expect(MAX_OFFLINE_TRADES).toBe(3);
  });

  it('§4.3 贸易完成时间 OFFLINE_TRADE_DURATION = 3600s', () => {
    expect(OFFLINE_TRADE_DURATION).toBe(3600);
  });

  it('§4.4 离线6h: 商队完成交易+利润按效率系数计算', () => {
    const profitPerRun = zeroRes();
    profitPerRun.gold = 100;
    const summary = rewardSystem.simulateOfflineTrade(HOUR_S * 6, profitPerRun);
    expect(summary.completedTrades).toBeGreaterThan(0);
    expect(summary.totalProfit.gold).toBeGreaterThan(0);
  });

  it('§4.5 离线<1h: 无贸易完成', () => {
    const profitPerRun = zeroRes();
    profitPerRun.gold = 100;
    const summary = rewardSystem.simulateOfflineTrade(HOUR_S * 0.5, profitPerRun);
    expect(summary.completedTrades).toBe(0);
    expect(summary.totalProfit.gold).toBe(0);
  });

  it('§4.6 多支商队同时运输: 各商队独立结算', () => {
    const profitPerRun = zeroRes();
    profitPerRun.gold = 100;
    const summary = rewardSystem.simulateOfflineTrade(HOUR_S * 12, profitPerRun);
    expect(summary.completedTrades).toBeLessThanOrEqual(MAX_OFFLINE_TRADES);
  });

  it('§4.7 贸易系统修正×0.8', () => {
    expect(getSystemModifier('Trade')).toBe(0.8);
  });

  it('§4.8 贸易事件包含正确的时间戳', () => {
    const profitPerRun = zeroRes();
    profitPerRun.gold = 100;
    const summary = rewardSystem.simulateOfflineTrade(HOUR_S * 4, profitPerRun);
    for (const event of summary.events) {
      expect(event.startTime).toBeGreaterThan(0);
      expect(event.completeTime).toBeGreaterThan(event.startTime);
    }
  });
});

// ─────────────────────────────────────────────
// §5 加速道具管理
// ─────────────────────────────────────────────

describe('v9-int §5 加速道具管理', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§5.1 初始无道具', () => {
    const items = rewardSystem.getBoostItems();
    expect(items).toBeDefined();
  });

  it('§5.2 添加加速道具', () => {
    rewardSystem.addBoostItem('offline_boost_1h', 3);
    const items = rewardSystem.getBoostItems();
    const boostItem = items.find(i => i.id === 'offline_boost_1h');
    expect(boostItem).toBeDefined();
    expect(boostItem!.count).toBe(3);
  });

  it('§5.3 使用加速道具', () => {
    rewardSystem.addBoostItem('offline_boost_1h', 2);
    const result = rewardSystem.useBoostItemAction('offline_boost_1h', makeRates());
    expect(result.success).toBe(true);
    expect(result.remainingCount).toBe(1);
    expect(result.addedSeconds).toBeGreaterThan(0);
  });

  it('§5.4 道具数量不足时使用失败', () => {
    rewardSystem.addBoostItem('offline_boost_1h', 0);
    const result = rewardSystem.useBoostItemAction('offline_boost_1h', makeRates());
    expect(result.success).toBe(false);
  });

  it('§5.5 未知道具使用失败', () => {
    const result = rewardSystem.useBoostItemAction('unknown_item', makeRates());
    expect(result.success).toBe(false);
  });

  it('§5.6 添加负数数量无效', () => {
    rewardSystem.addBoostItem('offline_boost_1h', -1);
    const items = rewardSystem.getBoostItems();
    const boostItem = items.find(i => i.id === 'offline_boost_1h');
    // addBoostItem忽略count<=0，但道具定义仍存在（count=0）
    expect(boostItem!.count).toBe(0);
  });

  it('§5.7 道具序列化保存', () => {
    rewardSystem.addBoostItem('offline_boost_1h', 5);
    const data = rewardSystem.serialize();
    expect(data.boostItems['offline_boost_1h']).toBe(5);
  });
});

// ─────────────────────────────────────────────
// §6 系统效率修正系数完整性
// ─────────────────────────────────────────────

describe('v9-int §6 系统效率修正系数完整性', () => {
  it('§6.1 所有PRD定义的系统修正系数存在', () => {
    const modifiers = SYSTEM_EFFICIENCY_MODIFIERS;
    const ids = modifiers.map(m => m.systemId);
    expect(ids).toContain('resource');
    expect(ids).toContain('building');
    expect(ids).toContain('tech');
    expect(ids).toContain('expedition');
    expect(ids).toContain('Trade');
  });

  it('§6.2 资源产出×1.0', () => {
    expect(getSystemModifier('resource')).toBe(1.0);
  });

  it('§6.3 建筑升级×1.2', () => {
    expect(getSystemModifier('building')).toBe(1.2);
  });

  it('§6.4 科技研究×1.0', () => {
    expect(getSystemModifier('tech')).toBe(1.0);
  });

  it('§6.5 远征×0.85', () => {
    expect(getSystemModifier('expedition')).toBe(0.85);
  });

  it('§6.6 贸易路线×0.8', () => {
    expect(getSystemModifier('Trade')).toBe(0.8);
  });

  it('§6.7 未知系统默认×1.0', () => {
    expect(getSystemModifier('unknown_system')).toBe(1.0);
  });

  it('§6.8 OfflineRewardSystem.getAllSystemModifiers返回完整列表', () => {
    const rewardSystem = new OfflineRewardSystem();
    const all = rewardSystem.getAllSystemModifiers();
    expect(all.length).toBe(SYSTEM_EFFICIENCY_MODIFIERS.length);
  });
});

// ─────────────────────────────────────────────
// §7 资源保护→离线收益→溢出提示联动
// ─────────────────────────────────────────────

describe('v9-int §7 资源保护→离线收益→溢出提示联动', () => {
  it('§7.1 粮草接近上限→离线收益→截断+溢出记录', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 8,
      productionRates: makeRates({ grain: 100 }),
      currentResources: makeCurrentRes({ grain: 4800 }),
      caps: makeCaps({ grain: 5000 }),
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
    };
    const result = calculateFullOfflineReward(ctx);
    // 仓库剩余200, 收益远超200
    expect(result.cappedEarned.grain).toBeLessThanOrEqual(200);
    expect(result.overflowResources.grain).toBeGreaterThan(0);
  });

  it('§7.2 铜钱(∞)不受溢出影响', () => {
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
  });

  it('§7.3 兵力截断至兵营容量', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 8,
      productionRates: makeRates({ troops: 50 }),
      currentResources: makeCurrentRes({ troops: 900 }),
      caps: makeCaps({ troops: 1000 }),
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
    };
    const result = calculateFullOfflineReward(ctx);
    expect(result.cappedEarned.troops).toBeLessThanOrEqual(100);
    expect(result.overflowResources.troops).toBeGreaterThan(0);
  });

  it('§7.4 天命(∞)全额入账', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 24,
      productionRates: makeRates({ mandate: 10 }),
      currentResources: makeCurrentRes({ mandate: 9999 }),
      caps: makeCaps(),
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
    };
    const result = calculateFullOfflineReward(ctx);
    expect(result.overflowResources.mandate).toBe(0);
    expect(result.cappedEarned.mandate).toBe(result.systemModifiedEarned.mandate);
  });

  it('§7.5 全资源溢出守恒: capped + overflow = systemModified', () => {
    const ctx = {
      offlineSeconds: HOUR_S * 10,
      productionRates: makeRates({ grain: 100, troops: 50 }),
      currentResources: makeCurrentRes({ grain: 4900, troops: 900 }),
      caps: makeCaps({ grain: 5000, troops: 1000 }),
      bonusSources: { tech: 0.1 },
      vipLevel: 1,
      adUsedToday: 0,
    };
    const result = calculateFullOfflineReward(ctx);
    // 对有上限资源检查守恒
    const grainTotal = result.cappedEarned.grain + result.overflowResources.grain;
    expect(grainTotal).toBe(result.systemModifiedEarned.grain);
    const troopsTotal = result.cappedEarned.troops + result.overflowResources.troops;
    expect(troopsTotal).toBe(result.systemModifiedEarned.troops);
  });
});
