/**
 * v9.0 离线收益集成测试 — 流程1: 核心计算 + 衰减分档 + 加成系数
 *
 * 覆盖 Play 文档:
 *   §1.1 离线计算核心
 *   §1.2 六档衰减系数
 *   §1.3 加成系数叠加
 *   §1.7 分段计算验证
 *   §2.1 经验产出快照
 *   §7.1 离线收益→资源→仓库联动
 */

import {
  OfflineRewardSystem,
  OfflineRewardEngine,
  calculateTierDetails,
  calculateOverallEfficiency,
  calculateBonusCoefficient,
  calculateOfflineSnapshot,
  applyDouble,
  applyOverflowRules,
  getSystemModifier,
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  MAX_OFFLINE_HOURS,
  OFFLINE_POPUP_THRESHOLD,
} from '../index';
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
  return { grain: 5000, gold: null, troops: 1000, mandate: null, techPoint: null, recruitToken: null, skillBook: null, ...overrides };
}

// ─────────────────────────────────────────────
// §1.1 离线计算核心公式
// ─────────────────────────────────────────────

describe('v9 §1.1 离线计算核心公式', () => {
  it('基础公式: 净产出 × 秒数 × 衰减 × (1+加成)', () => {
    const rates = makeRates({ grain: 100, gold: 50 });
    const bonus = { tech: 0.1, vip: 0.05, reputation: 0.05 };
    // 离线 1h (3600s), 全部在 tier1 (100%)
    const snap = calculateOfflineSnapshot(3600, rates, bonus);

    // 手动计算: grain = 100 * 3600 * 1.0 * (1 + min(0.2, 1.0)) = 100 * 3600 * 1.2 = 432000
    expect(snap.totalEarned.grain).toBe(Math.floor(100 * 3600 * 1.0 * 1.2));
    expect(snap.totalEarned.gold).toBe(Math.floor(50 * 3600 * 1.0 * 1.2));
    expect(snap.isCapped).toBe(false);
  });

  it('离线0秒应返回零收益', () => {
    const snap = calculateOfflineSnapshot(0, makeRates(), {});
    expect(snap.totalEarned.grain).toBe(0);
    expect(snap.totalEarned.gold).toBe(0);
    expect(snap.isCapped).toBe(false);
    expect(snap.overallEfficiency).toBe(1.0); // 0s → fallback
  });

  it('快照记录完整覆盖所有产出源', () => {
    const rates = makeRates();
    const snap = calculateOfflineSnapshot(3600, rates, {});
    // 验证所有5种资源都被计算
    expect(snap.totalEarned.grain).toBeGreaterThan(0);
    expect(snap.totalEarned.gold).toBeGreaterThan(0);
    expect(snap.totalEarned.troops).toBeGreaterThan(0);
    expect(snap.totalEarned.mandate).toBeGreaterThan(0);
    expect(snap.totalEarned.techPoint).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// §1.2 六档衰减系数
// ─────────────────────────────────────────────

describe('v9 §1.2 六档衰减系数', () => {
  it('衰减分档: 0~2h→100% | 2~8h→80% | 8~24h→60% | 24~48h→40% | 48~72h→20%', () => {
    expect(DECAY_TIERS[0].efficiency).toBe(1.0);
    expect(DECAY_TIERS[1].efficiency).toBe(0.8);
    expect(DECAY_TIERS[2].efficiency).toBe(0.6);
    expect(DECAY_TIERS[3].efficiency).toBe(0.4);
    expect(DECAY_TIERS[4].efficiency).toBe(0.2);
  });

  it('离线1h: 全部在tier1(100%)', () => {
    const rates = makeRates({ grain: 100 });
    const details = calculateTierDetails(3600, rates);
    expect(details).toHaveLength(1);
    expect(details[0].efficiency).toBe(1.0);
    expect(details[0].seconds).toBe(3600);
    expect(details[0].earned.grain).toBe(100 * 3600 * 1.0);
  });

  it('离线5h: tier1(2h×100%) + tier2(3h×80%)', () => {
    const rates = makeRates({ grain: 100 });
    const details = calculateTierDetails(5 * HOUR_S, rates);
    expect(details).toHaveLength(2);
    expect(details[0].seconds).toBe(2 * HOUR_S);
    expect(details[0].efficiency).toBe(1.0);
    expect(details[1].seconds).toBe(3 * HOUR_S);
    expect(details[1].efficiency).toBe(0.8);
  });

  it('离线15h: 三段(100%+80%+60%)', () => {
    const rates = makeRates({ grain: 100 });
    const details = calculateTierDetails(15 * HOUR_S, rates);
    expect(details).toHaveLength(3);
    expect(details[0].seconds).toBe(2 * HOUR_S);
    expect(details[1].seconds).toBe(6 * HOUR_S);
    expect(details[2].seconds).toBe(7 * HOUR_S); // 15-8=7h left in tier3
  });

  it('离线36h: 四段', () => {
    const details = calculateTierDetails(36 * HOUR_S, makeRates());
    expect(details).toHaveLength(4);
  });

  it('离线60h: 五段', () => {
    const details = calculateTierDetails(60 * HOUR_S, makeRates());
    expect(details).toHaveLength(5);
  });

  it('离线80h: 封顶72h，超过部分不产出', () => {
    const rates = makeRates({ grain: 100 });
    const snap = calculateOfflineSnapshot(80 * HOUR_S, rates, {});
    expect(snap.isCapped).toBe(true);
    // 与72h的收益相同
    const snap72 = calculateOfflineSnapshot(72 * HOUR_S, rates, {});
    expect(snap.totalEarned.grain).toBe(snap72.totalEarned.grain);
  });

  it('72h封顶: MAX_OFFLINE_SECONDS = 259200', () => {
    expect(MAX_OFFLINE_SECONDS).toBe(72 * 3600);
    expect(MAX_OFFLINE_HOURS).toBe(72);
  });
});

// ─────────────────────────────────────────────
// §1.3 加成系数叠加
// ─────────────────────────────────────────────

describe('v9 §1.3 加成系数叠加', () => {
  it('三项加成加法累加', () => {
    const coef = calculateBonusCoefficient({ tech: 0.3, vip: 0.2, reputation: 0.25 });
    expect(coef).toBeCloseTo(1 + 0.75, 4);
  });

  it('加成上限封顶 +100%', () => {
    const coef = calculateBonusCoefficient({ tech: 0.5, vip: 0.4, reputation: 0.3 });
    // total = 1.2, capped at 1.0
    expect(coef).toBe(2.0); // 1 + min(1.2, 1.0) = 2.0
  });

  it('无加成时系数为1.0', () => {
    expect(calculateBonusCoefficient({})).toBe(1.0);
  });

  it('单项加成正确', () => {
    expect(calculateBonusCoefficient({ tech: 0.3 })).toBeCloseTo(1.3, 4);
    expect(calculateBonusCoefficient({ vip: 0.2 })).toBeCloseTo(1.2, 4);
    expect(calculateBonusCoefficient({ reputation: 0.25 })).toBeCloseTo(1.25, 4);
  });
});

// ─────────────────────────────────────────────
// §1.7 分段计算验证
// ─────────────────────────────────────────────

describe('v9 §1.7 分段计算验证', () => {
  it('离线10h: 时段1(0~2h)×100% + 时段2(2~8h)×80% + 时段3(8~10h)×60%', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const details = calculateTierDetails(10 * HOUR_S, rates);

    expect(details).toHaveLength(3);
    // tier1: 7200s × 100%
    expect(details[0].seconds).toBe(7200);
    expect(details[0].efficiency).toBe(1.0);
    expect(details[0].earned.grain).toBe(100 * 7200 * 1.0);

    // tier2: 21600s × 80%
    expect(details[1].seconds).toBe(21600);
    expect(details[1].efficiency).toBe(0.8);
    expect(details[1].earned.grain).toBe(100 * 21600 * 0.8);

    // tier3: 7200s × 60%
    expect(details[2].seconds).toBe(7200);
    expect(details[2].efficiency).toBe(0.6);
    expect(details[2].earned.grain).toBe(100 * 7200 * 0.6);

    // 总收益 = 三段累加
    const totalGrain = details.reduce((sum, d) => sum + d.earned.grain, 0);
    expect(totalGrain).toBe(100 * (7200 * 1.0 + 21600 * 0.8 + 7200 * 0.6));
  });

  it('min(离线秒数-前段累计, 本段上限)确保不越界', () => {
    const rates = makeRates({ grain: 1 });
    // 离线正好3h: tier1(2h) + tier2(1h)
    const details = calculateTierDetails(3 * HOUR_S, rates);
    expect(details).toHaveLength(2);
    expect(details[0].seconds).toBe(2 * HOUR_S);
    expect(details[1].seconds).toBe(1 * HOUR_S);
  });
});

// ─────────────────────────────────────────────
// §2.1 经验产出快照
// ─────────────────────────────────────────────

describe('v9 §2.1 经验产出快照', () => {
  it('经验收益受72h封顶约束', () => {
    const rates = makeRates({ techPoint: 10 });
    const snap80 = calculateOfflineSnapshot(80 * HOUR_S, rates, {});
    const snap72 = calculateOfflineSnapshot(72 * HOUR_S, rates, {});
    expect(snap80.totalEarned.techPoint).toBe(snap72.totalEarned.techPoint);
    expect(snap80.isCapped).toBe(true);
  });

  it('经验收益受衰减系数影响', () => {
    const rates = makeRates({ techPoint: 100 });
    const snap1h = calculateOfflineSnapshot(HOUR_S, rates, {});
    const snap10h = calculateOfflineSnapshot(10 * HOUR_S, rates, {});
    // 1h效率100%, 10h平均效率<100%, 所以10h的每秒平均收益<1h的
    const avgPerSec1h = snap1h.totalEarned.techPoint / HOUR_S;
    const avgPerSec10h = snap10h.totalEarned.techPoint / (10 * HOUR_S);
    expect(avgPerSec10h).toBeLessThan(avgPerSec1h);
  });
});

// ─────────────────────────────────────────────
// §7.1 离线收益→资源→仓库联动
// ─────────────────────────────────────────────

describe('v9 §7.1 离线收益→资源→仓库联动', () => {
  it('无上限资源(铜钱)全额发放', () => {
    const earned: Resources = { grain: 0, gold: 5000, troops: 0, mandate: 0, techPoint: 0 };
    const current = zeroRes();
    const caps = makeCaps();
    const { cappedEarned, overflowResources } = applyOverflowRules(earned, current, caps);
    expect(cappedEarned.gold).toBe(5000);
    expect(overflowResources.gold).toBe(0);
  });

  it('有上限资源(粮草)截断至仓库容量', () => {
    const earned: Resources = { grain: 3000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const current: Resources = { grain: 4000, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const caps: ResourceCap = { grain: 5000, gold: null, troops: 1000, mandate: null, techPoint: null };
    const { cappedEarned, overflowResources } = applyOverflowRules(earned, current, caps);
    expect(cappedEarned.grain).toBe(1000); // 5000 - 4000 = 1000 space
    expect(overflowResources.grain).toBe(2000); // 3000 - 1000 = 2000 overflow
  });

  it('兵力截断至兵营容量', () => {
    const earned: Resources = { grain: 0, gold: 0, troops: 800, mandate: 0, techPoint: 0 };
    const current: Resources = { grain: 0, gold: 0, troops: 500, mandate: 0, techPoint: 0 };
    const caps: ResourceCap = { grain: 5000, gold: null, troops: 1000, mandate: null, techPoint: null };
    const { cappedEarned, overflowResources } = applyOverflowRules(earned, current, caps);
    expect(cappedEarned.troops).toBe(500); // 1000 - 500 = 500 space
    expect(overflowResources.troops).toBe(300);
  });

  it('全链路: 10h离线→资源入账→仓库截断', () => {
    const system = new OfflineRewardSystem();
    const rates = makeRates({ grain: 100, gold: 50 });
    const current: Resources = { grain: 4900, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const caps = makeCaps({ grain: 5000, gold: null, troops: 1000, mandate: null, techPoint: null });

    const result = system.calculateFullReward(10 * HOUR_S, rates, current, caps, 0, 'resource');

    // gold无上限，全额入账
    expect(result.cappedEarned.gold).toBeGreaterThan(0);
    // grain有上限且接近满，应截断
    expect(result.overflowResources.grain).toBeGreaterThan(0);
    // 截断后不超过上限
    expect(current.grain + result.cappedEarned.grain).toBeLessThanOrEqual(5000);
  });

  it('无重复发放或遗漏', () => {
    const system = new OfflineRewardSystem();
    const rates = makeRates({ grain: 10, gold: 5 });
    const current = zeroRes();
    const caps = makeCaps();

    const result = system.calculateFullReward(HOUR_S, rates, current, caps);
    // cappedEarned + overflowResources = systemModifiedEarned (for non-null cap resources)
    const sum = result.cappedEarned.grain + result.overflowResources.grain;
    expect(sum).toBe(result.systemModifiedEarned.grain);
  });
});

// ─────────────────────────────────────────────
// 综合效率计算
// ─────────────────────────────────────────────

describe('综合效率计算', () => {
  it('1h离线: 综合效率≈100%', () => {
    const eff = calculateOverallEfficiency(HOUR_S);
    expect(eff).toBeCloseTo(1.0, 2);
  });

  it('10h离线: 综合效率 = (7200×1.0 + 21600×0.8 + 7200×0.6) / 36000', () => {
    const eff = calculateOverallEfficiency(10 * HOUR_S);
    const expected = (7200 * 1.0 + 21600 * 0.8 + 7200 * 0.6) / 36000;
    expect(eff).toBeCloseTo(expected, 4);
  });

  it('72h离线: 综合效率 > 0', () => {
    const eff = calculateOverallEfficiency(72 * HOUR_S);
    expect(eff).toBeGreaterThan(0);
    expect(eff).toBeLessThan(1.0);
  });

  it('80h离线: 封顶72h计算', () => {
    const eff = calculateOverallEfficiency(80 * HOUR_S);
    const eff72 = calculateOverallEfficiency(72 * HOUR_S);
    expect(eff).toBeCloseTo(eff72, 4);
  });
});
