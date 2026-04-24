/**
 * v9.0 离线收益集成测试 — 翻倍机制 + 回归面板 + VIP联动
 *
 * 覆盖 Play 文档:
 *   §1.4  离线收益弹窗与翻倍
 *   §1.5  广告翻倍细节
 *   §1.6  元宝翻倍细节
 *   §1.9  回归流程时间预算
 *   §4.1  回归综合面板
 *   §4.2  回归流程时间预算
 *   §7.4  翻倍机制→货币消耗→广告次数联动
 *   §7.10 回归流程完整性验证
 *   §7.14 离线收益邮件效率系数消歧
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OfflineRewardSystem,
  applyDouble,
  calculateOfflineSnapshot,
  shouldShowOfflinePopup,
  generateReturnPanelData,
  AD_DOUBLE_MULTIPLIER,
  ITEM_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MULTIPLIER,
  RETURN_BONUS_MIN_HOURS,
  VIP_OFFLINE_BONUSES,
} from '../../index';
import { OFFLINE_POPUP_THRESHOLD } from '../../offline-config';
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
  return { grain: 5000, gold: null, troops: 1000, mandate: null, techPoint: null, ...overrides };
}

function makeCurrentRes(overrides: Partial<Resources> = {}): Resources {
  return { grain: 100, gold: 500, troops: 50, mandate: 20, techPoint: 10, ...overrides };
}

// ─────────────────────────────────────────────
// §1 翻倍机制核心
// ─────────────────────────────────────────────

describe('v9-int §1 翻倍机制核心', () => {
  it('§1.1 广告翻倍倍率为×2', () => {
    expect(AD_DOUBLE_MULTIPLIER).toBe(2);
  });

  it('§1.2 道具翻倍倍率为×2', () => {
    expect(ITEM_DOUBLE_MULTIPLIER).toBe(2);
  });

  it('§1.3 回归奖励翻倍倍率为×2', () => {
    expect(RETURN_BONUS_MULTIPLIER).toBe(2);
  });

  it('§1.4 回归奖励触发最小离线24h', () => {
    expect(RETURN_BONUS_MIN_HOURS).toBe(24);
  });

  it('§1.5 applyDouble: 广告翻倍成功', () => {
    const earned = { grain: 1000, gold: 500, troops: 200, mandate: 50, techPoint: 10 };
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告翻倍' }, 0);
    expect(result.success).toBe(true);
    expect(result.doubledEarned.grain).toBe(2000);
    expect(result.appliedMultiplier).toBe(2);
  });

  it('§1.6 applyDouble: 广告翻倍每日3次限制', () => {
    const earned = zeroRes();
    earned.grain = 100;
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '' }, 3);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已用完');
    expect(result.appliedMultiplier).toBe(1);
  });

  it('§1.7 applyDouble: 道具翻倍无次数限制', () => {
    const earned = zeroRes();
    earned.grain = 100;
    // 道具翻倍不检查adUsedToday
    const result = applyDouble(earned, { source: 'item', multiplier: 2, description: '' }, 999);
    expect(result.success).toBe(true);
    expect(result.doubledEarned.grain).toBe(200);
  });

  it('§1.8 applyDouble: originalEarned保持不变', () => {
    const earned = zeroRes();
    earned.grain = 100;
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '' }, 0);
    expect(result.originalEarned.grain).toBe(100);
    expect(result.doubledEarned.grain).toBe(200);
  });
});

// ─────────────────────────────────────────────
// §2 VIP离线加成联动
// ─────────────────────────────────────────────

describe('v9-int §2 VIP离线加成联动', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§2.1 VIP0: 无效率加成', () => {
    const bonus = rewardSystem.getVipBonus(0);
    expect(bonus.efficiencyBonus).toBe(0);
    expect(bonus.dailyDoubleLimit).toBe(1);
  });

  it('§2.2 VIP3: +15%效率+8h额外时长+3次翻倍', () => {
    const bonus = rewardSystem.getVipBonus(3);
    expect(bonus.efficiencyBonus).toBe(0.15);
    expect(bonus.extraHours).toBe(8);
    expect(bonus.dailyDoubleLimit).toBe(3);
  });

  it('§2.3 VIP5: +25%效率+24h额外时长+5次翻倍', () => {
    const bonus = rewardSystem.getVipBonus(5);
    expect(bonus.efficiencyBonus).toBe(0.25);
    expect(bonus.extraHours).toBe(24);
    expect(bonus.dailyDoubleLimit).toBe(5);
  });

  it('§2.4 VIP加成正确应用到收益', () => {
    const earned = zeroRes();
    earned.grain = 1000;
    const boosted = rewardSystem.applyVipBonus(earned, 3);
    // VIP3: +15% → 1150
    expect(boosted.grain).toBe(1150);
  });

  it('§2.5 VIP0加成为0时收益不变', () => {
    const earned = zeroRes();
    earned.grain = 1000;
    const boosted = rewardSystem.applyVipBonus(earned, 0);
    expect(boosted.grain).toBe(1000);
  });

  it('§2.6 VIP加成与科技加成叠加', () => {
    const rates = makeRates({ grain: 100 });
    const bonus = { tech: 0.3, vip: 0.15, reputation: 0.1 };
    const snap = calculateOfflineSnapshot(HOUR_S * 2, rates, bonus);
    // 加成系数 = 1 + min(0.3 + 0.15 + 0.1, 1.0) = 1 + 0.55 = 1.55
    // 注意：floorRes在mulRes之后应用，可能有浮点取整差异
    const expectedGrain = Math.floor(100 * 7200 * 1.0 * 1.55);
    expect(snap.totalEarned.grain).toBeCloseTo(expectedGrain, -1); // 允许±10取整差异
  });

  it('§2.7 VIP翻倍每日次数限制', () => {
    // VIP1: dailyDoubleLimit = 2
    const doubles = rewardSystem.getAvailableDoubles(HOUR_S * 2, 1);
    const vipDouble = doubles.find(d => d.source === 'vip');
    expect(vipDouble).toBeDefined();
  });

  it('§2.8 VIP翻倍次数用完后不再出现', () => {
    // 用完VIP0的1次
    rewardSystem.applyDouble(zeroRes(), { source: 'vip', multiplier: 2, description: '' });
    const doubles = rewardSystem.getAvailableDoubles(HOUR_S * 2, 0);
    const vipDouble = doubles.find(d => d.source === 'vip');
    expect(vipDouble).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// §3 回归面板数据完整性
// ─────────────────────────────────────────────

describe('v9-int §3 回归面板数据完整性', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§3.1 面板包含离线时长', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 5, makeRates(), 0);
    expect(panel.offlineSeconds).toBe(HOUR_S * 5);
    expect(panel.formattedTime).toContain('5');
  });

  it('§3.2 面板包含效率百分比', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 5, makeRates(), 0);
    expect(panel.efficiencyPercent).toBeGreaterThan(0);
    expect(panel.efficiencyPercent).toBeLessThanOrEqual(100);
  });

  it('§3.3 面板包含各档位明细', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 10, makeRates(), 0);
    expect(panel.tierDetails.length).toBeGreaterThanOrEqual(2); // 至少tier1 + tier2 + tier3
  });

  it('§3.4 面板包含总收益', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 2, makeRates(), 0);
    expect(panel.totalEarned.grain).toBeGreaterThan(0);
    expect(panel.totalEarned.gold).toBeGreaterThan(0);
  });

  it('§3.5 离线>72h时isCapped=true', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 80, makeRates(), 0);
    expect(panel.isCapped).toBe(true);
  });

  it('§3.6 离线<72h时isCapped=false', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 10, makeRates(), 0);
    expect(panel.isCapped).toBe(false);
  });

  it('§3.7 面板包含可用翻倍选项', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 2, makeRates(), 0);
    expect(panel.availableDoubles.length).toBeGreaterThanOrEqual(1); // 至少有广告翻倍
  });

  it('§3.8 离线>24h时出现回归奖励翻倍', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 30, makeRates(), 0);
    const returnBonus = panel.availableDoubles.find(d => d.source === 'return_bonus');
    expect(returnBonus).toBeDefined();
    expect(returnBonus!.multiplier).toBe(2);
  });

  it('§3.9 离线<24h时无回归奖励翻倍', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 10, makeRates(), 0);
    const returnBonus = panel.availableDoubles.find(d => d.source === 'return_bonus');
    expect(returnBonus).toBeUndefined();
  });

  it('§3.10 面板包含加速道具列表', () => {
    const panel = rewardSystem.generateReturnPanel(HOUR_S * 2, makeRates(), 0);
    expect(panel.boostItems).toBeDefined();
    expect(Array.isArray(panel.boostItems)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// §4 弹窗触发逻辑
// ─────────────────────────────────────────────

describe('v9-int §4 弹窗触发逻辑', () => {
  it('§4.1 离线≤5min不弹窗', () => {
    expect(shouldShowOfflinePopup(300)).toBe(false);
  });

  it('§4.2 离线>5min弹窗', () => {
    expect(shouldShowOfflinePopup(301)).toBe(true);
  });

  it('§4.3 离线0秒不弹窗', () => {
    expect(shouldShowOfflinePopup(0)).toBe(false);
  });

  it('§4.4 离线1小时弹窗', () => {
    expect(shouldShowOfflinePopup(HOUR_S)).toBe(true);
  });

  it('§4.5 OFFLINE_POPUP_THRESHOLD = 300秒', () => {
    expect(OFFLINE_POPUP_THRESHOLD).toBe(300);
  });
});

// ─────────────────────────────────────────────
// §5 完整回归流程端到端
// ─────────────────────────────────────────────

describe('v9-int §5 完整回归流程端到端', () => {
  let rewardSystem: OfflineRewardSystem;

  beforeEach(() => {
    rewardSystem = new OfflineRewardSystem();
    rewardSystem.reset();
  });

  it('§5.1 完整流程: 计算收益→面板展示→领取→防重复', () => {
    // Step1: 计算离线收益
    const result = rewardSystem.calculateOfflineReward(
      HOUR_S * 10, makeRates({ grain: 100 }), makeCurrentRes({ grain: 100 }),
      makeCaps({ grain: 999999 }), 1, 'building',
    );

    // Step2: 面板数据完整
    expect(result.panelData.offlineSeconds).toBe(HOUR_S * 10);
    expect(result.panelData.totalEarned.grain).toBeGreaterThan(0);
    expect(result.panelData.availableDoubles.length).toBeGreaterThan(0);

    // Step3: 领取
    const claimed = rewardSystem.claimReward(result);
    expect(claimed).not.toBeNull();
    expect(claimed!.grain).toBeGreaterThan(0);

    // Step4: 防重复
    const claimed2 = rewardSystem.claimReward(result);
    expect(claimed2).toBeNull();
  });

  it('§5.2 翻倍后领取', () => {
    const result = rewardSystem.calculateOfflineReward(
      HOUR_S * 2, makeRates({ grain: 100 }), makeCurrentRes(),
      makeCaps({ grain: 999999 }), 0, 'resource',
    );

    // 应用广告翻倍
    const doubleResult = applyDouble(result.cappedEarned, { source: 'ad', multiplier: 2, description: '' }, 0);
    expect(doubleResult.success).toBe(true);
    expect(doubleResult.doubledEarned.grain).toBe(result.cappedEarned.grain * 2);
  });

  it('§5.3 离线≤5min: 不弹窗但仍可领取', () => {
    const result = rewardSystem.calculateOfflineReward(
      60, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
    );
    expect(shouldShowOfflinePopup(60)).toBe(false);
    const claimed = rewardSystem.claimReward(result);
    expect(claimed).not.toBeNull();
  });

  it('§5.4 多次离线回归不累积错误', () => {
    for (let i = 1; i <= 3; i++) {
      const result = rewardSystem.calculateOfflineReward(
        HOUR_S * i, makeRates(), makeCurrentRes(), makeCaps(), 0, 'resource',
      );
      const claimed = rewardSystem.claimReward(result);
      expect(claimed).not.toBeNull();
    }
  });

  it('§5.5 VIP加成+系统修正+溢出截断全链路', () => {
    const result = rewardSystem.calculateFullReward(
      HOUR_S * 10, makeRates({ grain: 100 }), makeCurrentRes({ grain: 4500 }),
      makeCaps({ grain: 5000 }), 3, 'building',
    );
    // VIP3: +15%效率
    expect(result.vipBoostedEarned.grain).toBeGreaterThan(result.snapshot.totalEarned.grain);
    // Building ×1.2
    expect(result.systemModifiedEarned.grain).toBeGreaterThan(result.vipBoostedEarned.grain);
    // 溢出截断
    expect(result.cappedEarned.grain).toBeLessThanOrEqual(500);
    expect(result.overflowResources.grain).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// §6 邮件效率系数消歧验证
// ─────────────────────────────────────────────

describe('v9-int §6 邮件效率系数消歧验证', () => {
  it('§6.1 离线3h: 实际收益按SPEC分段计算(100%+80%)', () => {
    const rates = makeRates({ grain: 100 });
    const snap = calculateOfflineSnapshot(HOUR_S * 3, rates, {});
    // tier1: 2h×100% = 7200s → grain: 100*7200*1.0 = 720000
    // tier2: 1h×80% = 3600s → grain: 100*3600*0.8 = 288000
    // total = 1008000
    const expected = 100 * 7200 * 1.0 + 100 * 3600 * 0.8;
    expect(snap.totalEarned.grain).toBe(Math.floor(expected));
  });

  it('§6.2 离线10h: 实际收益按3段计算(100%+80%+60%)', () => {
    const rates = makeRates({ grain: 100 });
    const snap = calculateOfflineSnapshot(HOUR_S * 10, rates, {});
    const expected = 100 * 7200 * 1.0 + 100 * 21600 * 0.8 + 100 * 7200 * 0.6;
    expect(snap.totalEarned.grain).toBe(Math.floor(expected));
  });

  it('§6.3 实际效率≠简单档位百分比×总时长', () => {
    const rates = makeRates({ grain: 100 });
    // 用15h验证差异（10h恰好巧合等于80%×10h）
    const snap = calculateOfflineSnapshot(HOUR_S * 15, rates, {});
    const naiveCalc = 100 * 54000 * 0.6; // 简单60%×15h
    // 实际分段: 720000(2h×100%) + 1728000(6h×80%) + 648000(7h×60%) = 3096000
    expect(snap.totalEarned.grain).not.toBe(naiveCalc);
  });

  it('§6.4 综合效率随离线时长递减', () => {
    const rates = makeRates();
    const eff2h = calculateOfflineSnapshot(HOUR_S * 2, rates, {}).overallEfficiency;
    const eff10h = calculateOfflineSnapshot(HOUR_S * 10, rates, {}).overallEfficiency;
    const eff48h = calculateOfflineSnapshot(HOUR_S * 48, rates, {}).overallEfficiency;
    expect(eff2h).toBeGreaterThan(eff10h);
    expect(eff10h).toBeGreaterThan(eff48h);
  });
});
