/**
 * v9.0 离线收益集成测试 — 离线计算核心 + 衰减 + 翻倍
 *
 * 覆盖:
 *   §1.1  5档衰减分段计算
 *   §1.2  衰减系数正确性（各档位效率）
 *   §1.3  72h封顶机制
 *   §1.4  加成系数叠加（科技+VIP+声望，上限+100%）
 *   §1.5  翻倍机制（广告/道具/元宝/回归）
 *   §1.6  综合效率计算
 *   §1.7  分段计算 vs 简单乘法差异
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OfflineRewardSystem,
  calculateTierDetails,
  calculateOverallEfficiency,
  calculateBonusCoefficient,
  calculateOfflineSnapshot,
  applyDouble,
  applyOverflowRules,
  getSystemModifier,
  applySystemModifier,
  calculateFullOfflineReward,
  DECAY_TIERS,
  MAX_OFFLINE_SECONDS,
  AD_DOUBLE_MULTIPLIER,
  ITEM_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MULTIPLIER,
  RETURN_BONUS_MIN_HOURS,
  VIP_OFFLINE_BONUSES,
  SYSTEM_EFFICIENCY_MODIFIERS,
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
  return { grain: 5000, gold: 2000, troops: 1000, mandate: null, techPoint: null, ...overrides };
}

function makeCurrentRes(overrides: Partial<Resources> = {}): Resources {
  return { grain: 100, gold: 500, troops: 50, mandate: 20, techPoint: 10, ...overrides };
}

// ─────────────────────────────────────────────
// §1.1 5档衰减分段计算
// ─────────────────────────────────────────────

describe('§1.1 5档衰减分段计算', () => {
  it('§1.1.1 配置表包含5个衰减档位', () => {
    expect(DECAY_TIERS).toHaveLength(5);
  });

  it('§1.1.2 第1档 0~2h 效率100%', () => {
    expect(DECAY_TIERS[0].efficiency).toBe(1.0);
    expect(DECAY_TIERS[0].startHours).toBe(0);
    expect(DECAY_TIERS[0].endHours).toBe(2);
  });

  it('§1.1.3 第2档 2~8h 效率80%', () => {
    expect(DECAY_TIERS[1].efficiency).toBe(0.80);
    expect(DECAY_TIERS[1].startHours).toBe(2);
    expect(DECAY_TIERS[1].endHours).toBe(8);
  });

  it('§1.1.4 第3档 8~24h 效率60%', () => {
    expect(DECAY_TIERS[2].efficiency).toBe(0.60);
    expect(DECAY_TIERS[2].startHours).toBe(8);
    expect(DECAY_TIERS[2].endHours).toBe(24);
  });

  it('§1.1.5 第4档 24~48h 效率40%', () => {
    expect(DECAY_TIERS[3].efficiency).toBe(0.40);
    expect(DECAY_TIERS[3].startHours).toBe(24);
    expect(DECAY_TIERS[3].endHours).toBe(48);
  });

  it('§1.1.6 第5档 48~72h 效率20%', () => {
    expect(DECAY_TIERS[4].efficiency).toBe(0.20);
    expect(DECAY_TIERS[4].startHours).toBe(48);
    expect(DECAY_TIERS[4].endHours).toBe(72);
  });

  it('§1.1.7 离线1h仅命中第1档', () => {
    const rates = makeRates({ grain: 100 });
    const details = calculateTierDetails(HOUR_S * 1, rates);
    expect(details).toHaveLength(1);
    expect(details[0].tierId).toBe('tier1');
    expect(details[0].seconds).toBe(HOUR_S * 1);
  });

  it('§1.1.8 离线5h命中第1+2档', () => {
    const rates = makeRates({ grain: 100 });
    const details = calculateTierDetails(HOUR_S * 5, rates);
    expect(details).toHaveLength(2);
    expect(details[0].tierId).toBe('tier1');
    expect(details[1].tierId).toBe('tier2');
    expect(details[0].seconds).toBe(HOUR_S * 2);
    expect(details[1].seconds).toBe(HOUR_S * 3);
  });

  it('§1.1.9 离线30h命中第1~4档', () => {
    const rates = makeRates({ grain: 100 });
    const details = calculateTierDetails(HOUR_S * 30, rates);
    expect(details).toHaveLength(4);
    expect(details[3].tierId).toBe('tier4');
  });

  it('§1.1.10 离线72h命中全部5档', () => {
    const rates = makeRates({ grain: 100 });
    const details = calculateTierDetails(HOUR_S * 72, rates);
    expect(details).toHaveLength(5);
  });

  it('§1.1.11 各档位秒数之和等于总离线秒数', () => {
    const rates = makeRates();
    const totalSeconds = HOUR_S * 30;
    const details = calculateTierDetails(totalSeconds, rates);
    const sumSeconds = details.reduce((s, d) => s + d.seconds, 0);
    expect(sumSeconds).toBe(totalSeconds);
  });

  it('§1.1.12 各档位收益计算正确', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const details = calculateTierDetails(HOUR_S * 5, rates);
    // tier1: 2h × 100% = 7200s → 100 * 7200 * 1.0 = 720000
    expect(details[0].earned.grain).toBe(720000);
    // tier2: 3h × 80% = 10800s → 100 * 10800 * 0.8 = 864000
    expect(details[1].earned.grain).toBe(864000);
  });
});

// ─────────────────────────────────────────────
// §1.2 衰减系数正确性（各档位效率）
// ─────────────────────────────────────────────

describe('§1.2 衰减系数正确性', () => {
  it('§1.2.1 离线2h效率为100%（仅tier1）', () => {
    const rates = makeRates({ grain: 100 });
    const snap = calculateOfflineSnapshot(HOUR_S * 2, rates, {});
    expect(snap.overallEfficiency).toBe(1.0);
  });

  it('§1.2.2 离线8h综合效率精确计算', () => {
    const rates = makeRates({ grain: 100 });
    const snap = calculateOfflineSnapshot(HOUR_S * 8, rates, {});
    // tier1: 2h × 1.0 = 7200
    // tier2: 6h × 0.8 = 17280
    // total = 24480 / 28800 ≈ 0.85
    const expected = (7200 + 17280) / 28800;
    expect(snap.overallEfficiency).toBeCloseTo(expected, 4);
  });

  it('§1.2.3 离线24h综合效率精确计算', () => {
    const rates = makeRates({ grain: 100 });
    const snap = calculateOfflineSnapshot(HOUR_S * 24, rates, {});
    // tier1: 7200×1.0=7200, tier2: 21600×0.8=17280, tier3: 57600×0.6=34560
    // total = 59040 / 86400 ≈ 0.6833
    const weighted = 7200 + 17280 + 34560;
    const expected = weighted / 86400;
    expect(snap.overallEfficiency).toBeCloseTo(expected, 4);
  });

  it('§1.2.4 离线48h综合效率精确计算', () => {
    const rates = makeRates();
    const eff = calculateOverallEfficiency(HOUR_S * 48);
    // tier1: 7200×1.0=7200, tier2: 21600×0.8=17280, tier3: 57600×0.6=34560, tier4: 86400×0.4=34560
    // total = 93600 / 172800 ≈ 0.5417
    const weighted = 7200 + 17280 + 34560 + 34560;
    expect(eff).toBeCloseTo(weighted / (48 * HOUR_S), 4);
  });

  it('§1.2.5 离线72h综合效率精确计算', () => {
    const eff = calculateOverallEfficiency(HOUR_S * 72);
    const weighted = 7200 + 17280 + 34560 + 34560 + 17280;
    expect(eff).toBeCloseTo(weighted / (72 * HOUR_S), 4);
  });

  it('§1.2.6 效率随离线时长单调递减', () => {
    const hours = [2, 8, 24, 48, 72];
    const efficiencies = hours.map(h => calculateOverallEfficiency(h * HOUR_S));
    for (let i = 1; i < efficiencies.length; i++) {
      expect(efficiencies[i]).toBeLessThan(efficiencies[i - 1]);
    }
  });

  it('§1.2.7 0秒效率为1.0', () => {
    expect(calculateOverallEfficiency(0)).toBe(1.0);
  });
});

// ─────────────────────────────────────────────
// §1.3 72h封顶机制
// ─────────────────────────────────────────────

describe('§1.3 72h封顶机制', () => {
  it('§1.3.1 MAX_OFFLINE_SECONDS = 72×3600', () => {
    expect(MAX_OFFLINE_SECONDS).toBe(72 * 3600);
  });

  it('§1.3.2 离线72h不封顶', () => {
    const rates = makeRates();
    const snap = calculateOfflineSnapshot(HOUR_S * 72, rates, {});
    expect(snap.isCapped).toBe(false);
  });

  it('§1.3.3 离线73h封顶', () => {
    const rates = makeRates();
    const snap = calculateOfflineSnapshot(HOUR_S * 73, rates, {});
    expect(snap.isCapped).toBe(true);
  });

  it('§1.3.4 离线100h收益与72h相同', () => {
    const rates = makeRates({ grain: 100 });
    const snap72 = calculateOfflineSnapshot(HOUR_S * 72, rates, {});
    const snap100 = calculateOfflineSnapshot(HOUR_S * 100, rates, {});
    expect(snap100.totalEarned.grain).toBe(snap72.totalEarned.grain);
  });

  it('§1.3.5 离线200h仍然封顶且收益不变', () => {
    const rates = makeRates();
    const snap72 = calculateOfflineSnapshot(HOUR_S * 72, rates, {});
    const snap200 = calculateOfflineSnapshot(HOUR_S * 200, rates, {});
    expect(snap200.isCapped).toBe(true);
    expect(snap200.totalEarned.grain).toBe(snap72.totalEarned.grain);
  });

  it('§1.3.6 封顶后offlineSeconds仍为原始值', () => {
    const rates = makeRates();
    const snap = calculateOfflineSnapshot(HOUR_S * 100, rates, {});
    expect(snap.offlineSeconds).toBe(HOUR_S * 100);
  });

  it('§1.3.7 封顶后档位明细最多5档', () => {
    const rates = makeRates();
    const snap = calculateOfflineSnapshot(HOUR_S * 200, rates, {});
    expect(snap.tierDetails).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────
// §1.4 加成系数叠加（科技+VIP+声望，上限+100%）
// ─────────────────────────────────────────────

describe('§1.4 加成系数叠加', () => {
  it('§1.4.1 无加成时系数为1', () => {
    expect(calculateBonusCoefficient({})).toBe(1);
  });

  it('§1.4.2 仅科技加成30%', () => {
    expect(calculateBonusCoefficient({ tech: 0.3 })).toBe(1.3);
  });

  it('§1.4.3 科技+VIP叠加', () => {
    expect(calculateBonusCoefficient({ tech: 0.3, vip: 0.2 })).toBe(1.5);
  });

  it('§1.4.4 三项叠加不超过上限', () => {
    // 0.5 + 0.4 + 0.3 = 1.2 → capped at 1.0
    expect(calculateBonusCoefficient({ tech: 0.5, vip: 0.4, reputation: 0.3 })).toBe(2.0);
  });

  it('§1.4.5 恰好达到上限', () => {
    expect(calculateBonusCoefficient({ tech: 0.5, vip: 0.5 })).toBe(2.0);
  });

  it('§1.4.6 加成正确应用到收益', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const noBonus = calculateOfflineSnapshot(HOUR_S * 2, rates, {});
    const withBonus = calculateOfflineSnapshot(HOUR_S * 2, rates, { tech: 0.5 });
    expect(withBonus.totalEarned.grain).toBe(Math.floor(noBonus.totalEarned.grain * 1.5));
  });

  it('§1.4.7 加成上限+100%时收益翻倍', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const noBonus = calculateOfflineSnapshot(HOUR_S * 2, rates, {});
    const maxBonus = calculateOfflineSnapshot(HOUR_S * 2, rates, { tech: 0.6, vip: 0.4, reputation: 0.1 });
    expect(maxBonus.totalEarned.grain).toBe(Math.floor(noBonus.totalEarned.grain * 2));
  });
});

// ─────────────────────────────────────────────
// §1.5 翻倍机制（广告/道具/元宝/回归）
// ─────────────────────────────────────────────

describe('§1.5 翻倍机制', () => {
  it('§1.5.1 广告翻倍倍率=2', () => {
    expect(AD_DOUBLE_MULTIPLIER).toBe(2);
  });

  it('§1.5.2 道具翻倍倍率=2', () => {
    expect(ITEM_DOUBLE_MULTIPLIER).toBe(2);
  });

  it('§1.5.3 回归奖励翻倍倍率=2', () => {
    expect(RETURN_BONUS_MULTIPLIER).toBe(2);
  });

  it('§1.5.4 回归奖励触发最小离线24h', () => {
    expect(RETURN_BONUS_MIN_HOURS).toBe(24);
  });

  it('§1.5.5 广告翻倍成功', () => {
    const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 10 };
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 0);
    expect(result.success).toBe(true);
    expect(result.doubledEarned.grain).toBe(2000);
    expect(result.appliedMultiplier).toBe(2);
  });

  it('§1.5.6 广告翻倍每日3次限制', () => {
    const earned = zeroRes();
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '' }, 3);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已用完');
  });

  it('§1.5.7 广告翻倍第3次仍可用（adUsedToday=2）', () => {
    const earned: Resources = { grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '' }, 2);
    expect(result.success).toBe(true);
  });

  it('§1.5.8 道具翻倍无次数限制', () => {
    const earned: Resources = { grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const result = applyDouble(earned, { source: 'item', multiplier: 2, description: '' }, 999);
    expect(result.success).toBe(true);
    expect(result.doubledEarned.grain).toBe(200);
  });

  it('§1.5.9 翻倍后originalEarned保持不变', () => {
    const earned: Resources = { grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '' }, 0);
    expect(result.originalEarned.grain).toBe(100);
    expect(result.doubledEarned.grain).toBe(200);
  });

  it('§1.5.10 自定义倍率翻倍', () => {
    const earned: Resources = { grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 };
    const result = applyDouble(earned, { source: 'item', multiplier: 3, description: '' }, 0);
    expect(result.success).toBe(true);
    expect(result.doubledEarned.grain).toBe(300);
    expect(result.appliedMultiplier).toBe(3);
  });
});

// ─────────────────────────────────────────────
// §1.6 综合效率计算
// ─────────────────────────────────────────────

describe('§1.6 综合效率计算', () => {
  it('§1.6.1 calculateOverallEfficiency返回0~1之间', () => {
    for (const h of [1, 5, 10, 24, 48, 72]) {
      const eff = calculateOverallEfficiency(h * HOUR_S);
      expect(eff).toBeGreaterThanOrEqual(0);
      expect(eff).toBeLessThanOrEqual(1);
    }
  });

  it('§1.6.2 离线0秒效率为1.0', () => {
    expect(calculateOverallEfficiency(0)).toBe(1.0);
  });

  it('§1.6.3 离线2h效率为1.0（仅tier1）', () => {
    expect(calculateOverallEfficiency(HOUR_S * 2)).toBe(1.0);
  });

  it('§1.6.4 超过72h效率按72h计算', () => {
    const eff72 = calculateOverallEfficiency(HOUR_S * 72);
    const eff100 = calculateOverallEfficiency(HOUR_S * 100);
    expect(eff100).toBe(eff72);
  });

  it('§1.6.5 OfflineRewardSystem快照效率与引擎一致', () => {
    const sys = new OfflineRewardSystem();
    sys.reset();
    const rates = makeRates({ grain: 100 });
    const snap = sys.calculateSnapshot(HOUR_S * 10, rates);
    const engineEff = calculateOverallEfficiency(HOUR_S * 10);
    // 允许四舍五入差异
    expect(Math.abs(snap.overallEfficiency - engineEff)).toBeLessThan(0.01);
  });
});

// ─────────────────────────────────────────────
// §1.7 分段计算 vs 简单乘法差异
// ─────────────────────────────────────────────

describe('§1.7 分段计算 vs 简单乘法差异', () => {
  it('§1.7.1 离线3h分段≠简单80%×总时长', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const snap = calculateOfflineSnapshot(HOUR_S * 3, rates, {});
    // 简单错误算法: 100 * 10800 * 0.8 = 864000
    const naive = 100 * 10800 * 0.8;
    // 正确: 100 * 7200 * 1.0 + 100 * 3600 * 0.8 = 720000 + 288000 = 1008000
    expect(snap.totalEarned.grain).not.toBe(naive);
    expect(snap.totalEarned.grain).toBe(1008000);
  });

  it('§1.7.2 离线10h分段精确计算', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const snap = calculateOfflineSnapshot(HOUR_S * 10, rates, {});
    // tier1: 100 * 7200 * 1.0 = 720000
    // tier2: 100 * 21600 * 0.8 = 1728000
    // tier3: 100 * 7200 * 0.6 = 432000
    // total = 2880000
    expect(snap.totalEarned.grain).toBe(2880000);
  });

  it('§1.7.3 离线50h分段精确计算', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const snap = calculateOfflineSnapshot(HOUR_S * 50, rates, {});
    // tier1: 100 * 7200 * 1.0 = 720000
    // tier2: 100 * 21600 * 0.8 = 1728000
    // tier3: 100 * 57600 * 0.6 = 3456000
    // tier4: 100 * 86400 * 0.4 = 3456000
    // tier5: 100 * 7200 * 0.2 = 144000
    // total = 9504000
    expect(snap.totalEarned.grain).toBe(9504000);
  });

  it('§1.7.4 多资源同时正确分段', () => {
    const rates = makeRates({ grain: 10, gold: 5, troops: 2 });
    const snap = calculateOfflineSnapshot(HOUR_S * 5, rates, {});
    // tier1: 2h × 100%
    // tier2: 3h × 80%
    const expectedGrain = Math.floor(10 * 7200 * 1.0 + 10 * 10800 * 0.8);
    const expectedGold = Math.floor(5 * 7200 * 1.0 + 5 * 10800 * 0.8);
    const expectedTroops = Math.floor(2 * 7200 * 1.0 + 2 * 10800 * 0.8);
    expect(snap.totalEarned.grain).toBe(expectedGrain);
    expect(snap.totalEarned.gold).toBe(expectedGold);
    expect(snap.totalEarned.troops).toBe(expectedTroops);
  });

  it('§1.7.5 加成+分段计算组合正确', () => {
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const bonus = { tech: 0.3 };
    const snap = calculateOfflineSnapshot(HOUR_S * 3, rates, bonus);
    // 基础: 720000 + 288000 = 1008000
    // 加成系数: 1 + 0.3 = 1.3
    // 结果: floor(1008000 * 1.3) = 1310400
    expect(snap.totalEarned.grain).toBe(1310400);
  });

  it('§1.7.6 OfflineRewardSystem分段计算与引擎一致', () => {
    const sys = new OfflineRewardSystem();
    sys.reset();
    const rates = makeRates({ grain: 100, gold: 0, troops: 0, mandate: 0, techPoint: 0 });
    const sysSnap = sys.calculateSnapshot(HOUR_S * 5, rates);
    const engineSnap = calculateOfflineSnapshot(HOUR_S * 5, rates, {});
    // 允许微小浮点差异
    expect(Math.abs(sysSnap.totalEarned.grain - engineSnap.totalEarned.grain)).toBeLessThanOrEqual(1);
  });
});
