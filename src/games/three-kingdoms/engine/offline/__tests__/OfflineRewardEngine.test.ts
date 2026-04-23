/**
 * OfflineRewardEngine 单元测试
 *
 * 覆盖：
 *   - 6档衰减系数正确性
 *   - 基础公式：产出×离线秒数×衰减系数×加成系数
 *   - 加成系数叠加（科技/VIP/声望）及上限+100%
 *   - 72h封顶机制
 *   - 翻倍机制（广告/元宝）
 *   - 资源溢出截断
 *   - 各系统离线效率修正
 *   - 离线预估
 *   - 静默判定
 *   - 回归面板数据
 */

import {
  calculateTierDetails,
  calculateOverallEfficiency,
  calculateBonusCoefficient,
  calculateOfflineSnapshot,
  applyDouble,
  applyOverflowRules,
  getSystemModifier,
  applySystemModifier,
  estimateOfflineReward,
  formatOfflineDuration,
  generateReturnPanelData,
  calculateFullOfflineReward,
  shouldShowOfflinePopup,
  type BonusSources,
} from '../OfflineRewardEngine';
import type { Resources, ProductionRate, ResourceCap } from '../../../../shared/types';
import { MAX_OFFLINE_SECONDS, OFFLINE_POPUP_THRESHOLD } from '../offline-config';

// ── 辅助 ──

const RATES: ProductionRate = { grain: 10, gold: 5, troops: 2, mandate: 1 };
const ZERO_RATES: ProductionRate = { grain: 0, gold: 0, troops: 0, mandate: 0 };
const CAPS: ResourceCap = { grain: 50000, gold: null, troops: 10000, mandate: null };

function sumResources(r: Resources): number {
  return r.grain + r.gold + r.troops + r.mandate;
}

// ═══════════════════════════════════════════════
// 1. 6档衰减系数
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 5档衰减系数', () => {
  it('0~2h: 100%效率', () => {
    // 1小时 = 3600秒，全在第一档
    const details = calculateTierDetails(3600, RATES);
    expect(details).toHaveLength(1);
    expect(details[0].efficiency).toBe(1.0);
    expect(details[0].seconds).toBe(3600);
    // grain = 10 * 3600 * 1.0 = 36000
    expect(details[0].earned.grain).toBeCloseTo(36000, 1);
  });

  it('2~8h: 80%效率', () => {
    // 3小时 = 10800秒，跨越 tier1(0~2h) + tier2(2~8h)
    const details = calculateTierDetails(10800, RATES);
    expect(details).toHaveLength(2);
    expect(details[0].efficiency).toBe(1.0);
    expect(details[0].seconds).toBe(7200); // 0~2h
    expect(details[1].efficiency).toBe(0.8);
    expect(details[1].seconds).toBe(3600); // 2~3h
  });

  it('8~24h: 60%效率', () => {
    // 12小时 = 43200秒，跨越 tier1(0~2h) + tier2(2~8h) + tier3(8~24h)
    const details = calculateTierDetails(43200, RATES);
    expect(details).toHaveLength(3);
    expect(details[2].efficiency).toBe(0.6);
    expect(details[2].seconds).toBe(14400); // 8~12h
  });

  it('24~48h: 40%效率', () => {
    // 36小时 = 129600秒，跨越 tier1~tier3 + tier4(24~48h)
    const details = calculateTierDetails(129600, RATES);
    expect(details).toHaveLength(4);
    expect(details[3].efficiency).toBe(0.4);
    expect(details[3].seconds).toBe(43200); // 24~36h
  });

  it('48~72h: 25%效率', () => {
    // 60小时 = 216000秒，跨越 tier1~tier4 + tier5(48~72h)
    const details = calculateTierDetails(216000, RATES);
    expect(details).toHaveLength(5);
    expect(details[4].efficiency).toBe(0.20);
    expect(details[4].seconds).toBe(43200); // 48~60h
  });

  it('超过72h封顶到72h', () => {
    // 100小时
    const details = calculateTierDetails(MAX_OFFLINE_SECONDS, RATES);
    expect(details).toHaveLength(5);
    // 最后一档 48~72h = 86400秒
    expect(details[4].seconds).toBe(86400);
  });

  it('0秒离线无收益', () => {
    const details = calculateTierDetails(0, RATES);
    expect(details).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════
// 2. 综合效率
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 综合效率', () => {
  it('1小时效率100%', () => {
    expect(calculateOverallEfficiency(3600)).toBeCloseTo(1.0, 2);
  });

  it('2小时效率100%', () => {
    expect(calculateOverallEfficiency(7200)).toBeCloseTo(1.0, 2);
  });

  it('4小时效率低于100%（含80%段）', () => {
    const eff = calculateOverallEfficiency(14400);
    // (7200*1.0 + 7200*0.8) / 14400 = 0.9
    expect(eff).toBeCloseTo(0.9, 2);
  });

  it('0秒效率100%', () => {
    expect(calculateOverallEfficiency(0)).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════
// 3. 加成系数
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 加成系数', () => {
  it('无加成时系数为1', () => {
    expect(calculateBonusCoefficient({})).toBe(1.0);
  });

  it('科技+30% → 系数1.3', () => {
    expect(calculateBonusCoefficient({ tech: 0.3 })).toBe(1.3);
  });

  it('科技30%+VIP20%+声望25% → 系数1.75', () => {
    expect(calculateBonusCoefficient({ tech: 0.3, vip: 0.2, reputation: 0.25 })).toBe(1.75);
  });

  it('加成上限+100%（系数2.0）', () => {
    expect(calculateBonusCoefficient({ tech: 0.5, vip: 0.4, reputation: 0.3 })).toBe(2.0);
  });

  it('加成超过100%被截断为2.0', () => {
    expect(calculateBonusCoefficient({ tech: 1.0, vip: 1.0, reputation: 1.0 })).toBe(2.0);
  });
});

// ═══════════════════════════════════════════════
// 4. 离线快照计算
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 离线快照', () => {
  it('基础公式正确：产出×秒数×衰减×加成', () => {
    // 1小时，无加成
    const snap = calculateOfflineSnapshot(3600, RATES, {});
    // grain = 10 * 3600 * 1.0 * 1.0 = 36000
    expect(snap.totalEarned.grain).toBe(36000);
    expect(snap.totalEarned.gold).toBe(18000);
    expect(snap.isCapped).toBe(false);
    expect(snap.offlineSeconds).toBe(3600);
  });

  it('加成系数正确应用', () => {
    const noBonus = calculateOfflineSnapshot(3600, RATES, {});
    const withBonus = calculateOfflineSnapshot(3600, RATES, { tech: 0.3 });
    // 加成30% → 1.3倍
    expect(withBonus.totalEarned.grain).toBe(Math.floor(noBonus.totalEarned.grain * 1.3));
  });

  it('72h封顶标记正确', () => {
    const snap = calculateOfflineSnapshot(MAX_OFFLINE_SECONDS + 10000, RATES, {});
    expect(snap.isCapped).toBe(true);
  });

  it('超过72h收益等于72h收益', () => {
    const at72h = calculateOfflineSnapshot(MAX_OFFLINE_SECONDS, RATES, {});
    const over72h = calculateOfflineSnapshot(MAX_OFFLINE_SECONDS + 86400, RATES, {});
    expect(over72h.totalEarned.grain).toBe(at72h.totalEarned.grain);
  });

  it('0产出速率无收益', () => {
    const snap = calculateOfflineSnapshot(3600, ZERO_RATES, {});
    expect(sumResources(snap.totalEarned)).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// 5. 翻倍机制
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 翻倍机制', () => {
  const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 100 };

  it('广告翻倍成功', () => {
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告' }, 0);
    expect(result.success).toBe(true);
    expect(result.appliedMultiplier).toBe(2);
    expect(result.doubledEarned.grain).toBe(2000);
  });

  it('广告翻倍3次后失败', () => {
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告' }, 3);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('已用完');
  });

  it('元宝翻倍无限制', () => {
    const result = applyDouble(earned, { source: 'item', multiplier: 2, description: '元宝' }, 100);
    expect(result.success).toBe(true);
    expect(result.doubledEarned.grain).toBe(2000);
  });

  it('原始收益不受翻倍影响', () => {
    const result = applyDouble(earned, { source: 'ad', multiplier: 2, description: '广告' }, 0);
    expect(result.originalEarned.grain).toBe(1000);
  });
});

// ═══════════════════════════════════════════════
// 6. 资源溢出
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 资源溢出', () => {
  it('有上限资源截断', () => {
    const current: Resources = { grain: 48000, gold: 0, troops: 9000, mandate: 0 };
    const earned: Resources = { grain: 5000, gold: 1000, troops: 2000, mandate: 500 };
    const caps: ResourceCap = { grain: 50000, gold: null, troops: 10000, mandate: null };

    const { cappedEarned, overflowResources } = applyOverflowRules(earned, current, caps);

    // grain: 50000 - 48000 = 2000 可用，溢出 3000
    expect(cappedEarned.grain).toBe(2000);
    expect(overflowResources.grain).toBe(3000);

    // gold: 无上限，全额
    expect(cappedEarned.gold).toBe(1000);
    expect(overflowResources.gold).toBe(0);

    // troops: 10000 - 9000 = 1000 可用，溢出 1000
    expect(cappedEarned.troops).toBe(1000);
    expect(overflowResources.troops).toBe(1000);
  });

  it('无溢出时全部发放', () => {
    const current: Resources = { grain: 0, gold: 0, troops: 0, mandate: 0 };
    const earned: Resources = { grain: 100, gold: 100, troops: 100, mandate: 100 };

    const { cappedEarned, overflowResources } = applyOverflowRules(earned, current, CAPS);

    expect(cappedEarned.grain).toBe(100);
    expect(sumResources(overflowResources)).toBe(0);
  });
});

// ═══════════════════════════════════════════════
// 7. 系统效率修正
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 系统效率修正', () => {
  it('建筑系统修正1.2', () => {
    expect(getSystemModifier('building')).toBe(1.2);
  });

  it('资源系统修正1.0', () => {
    expect(getSystemModifier('resource')).toBe(1.0);
  });

  it('科技系统修正1.0', () => {
    expect(getSystemModifier('tech')).toBe(1.0);
  });

  it('远征系统修正0.85', () => {
    expect(getSystemModifier('expedition')).toBe(0.85);
  });

  it('未知系统默认1.0', () => {
    expect(getSystemModifier('unknown')).toBe(1.0);
  });

  it('应用修正正确', () => {
    const earned: Resources = { grain: 1000, gold: 500, troops: 200, mandate: 100 };
    const modified = applySystemModifier(earned, 'building');
    expect(modified.grain).toBe(1200);
    expect(modified.gold).toBe(600);
  });
});

// ═══════════════════════════════════════════════
// 8. 离线预估
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 离线预估', () => {
  it('预估1小时收益', () => {
    const snap = estimateOfflineReward(1, RATES);
    expect(snap.totalEarned.grain).toBe(36000);
  });

  it('预估超过72h封顶', () => {
    const snap = estimateOfflineReward(100, RATES);
    expect(snap.isCapped).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// 9. 格式化时长
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 格式化时长', () => {
  it('0秒 → "刚刚"', () => {
    expect(formatOfflineDuration(0)).toBe('刚刚');
  });

  it('30秒 → "30秒"', () => {
    expect(formatOfflineDuration(30)).toBe('30秒');
  });

  it('90秒 → "1分钟"', () => {
    expect(formatOfflineDuration(90)).toBe('1分钟');
  });

  it('3661秒 → "1小时1分钟"', () => {
    expect(formatOfflineDuration(3661)).toBe('1小时1分钟');
  });

  it('90000秒 → "1天1小时"', () => {
    expect(formatOfflineDuration(90000)).toBe('1天1小时');
  });

  it('172800秒 → "2天"', () => {
    expect(formatOfflineDuration(172800)).toBe('2天');
  });
});

// ═══════════════════════════════════════════════
// 10. 静默判定
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 静默判定', () => {
  it('≤5分钟不弹窗', () => {
    expect(shouldShowOfflinePopup(300)).toBe(false);
    expect(shouldShowOfflinePopup(299)).toBe(false);
    expect(shouldShowOfflinePopup(0)).toBe(false);
  });

  it('>5分钟弹窗', () => {
    expect(shouldShowOfflinePopup(301)).toBe(true);
    expect(shouldShowOfflinePopup(3600)).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// 11. 回归面板数据
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 回归面板', () => {
  it('生成面板数据包含翻倍选项', () => {
    const snap = calculateOfflineSnapshot(3600, RATES, {});
    const panel = generateReturnPanelData(snap, 0);

    expect(panel.formattedTime).toBe('1小时');
    expect(panel.offlineSeconds).toBe(3600);
    expect(panel.availableDoubles.length).toBeGreaterThanOrEqual(1);
  });

  it('广告翻倍次数用完后不显示', () => {
    const snap = calculateOfflineSnapshot(3600, RATES, {});
    const panel = generateReturnPanelData(snap, 3);
    const adDouble = panel.availableDoubles.find(d => d.source === 'ad');
    expect(adDouble).toBeUndefined();
  });

  it('离线>24h显示回归奖励', () => {
    const snap = calculateOfflineSnapshot(25 * 3600, RATES, {});
    const panel = generateReturnPanelData(snap, 0);
    const returnBonus = panel.availableDoubles.find(d => d.source === 'return_bonus');
    expect(returnBonus).toBeDefined();
  });
});

// ═══════════════════════════════════════════════
// 12. 完整离线收益计算
// ═══════════════════════════════════════════════

describe('OfflineRewardEngine — 完整离线收益', () => {
  it('完整流程：快照→修正→溢出→面板', () => {
    const result = calculateFullOfflineReward({
      offlineSeconds: 7200,
      productionRates: RATES,
      currentResources: { grain: 0, gold: 0, troops: 0, mandate: 0 },
      caps: CAPS,
      bonusSources: { tech: 0.3 },
      vipLevel: 0,
      adUsedToday: 0,
      systemId: 'building',
    });

    expect(result.snapshot.tierDetails.length).toBeGreaterThan(0);
    expect(result.systemModifiedEarned.grain).toBeGreaterThan(0);
    expect(result.cappedEarned.grain).toBeGreaterThan(0);
    expect(result.panelData).toBeDefined();
  });

  it('溢出时正确截断', () => {
    const result = calculateFullOfflineReward({
      offlineSeconds: MAX_OFFLINE_SECONDS,
      productionRates: RATES,
      currentResources: { grain: 49999, gold: 0, troops: 9999, mandate: 0 },
      caps: { grain: 50000, gold: null, troops: 10000, mandate: null },
      bonusSources: {},
      vipLevel: 0,
      adUsedToday: 0,
    });

    expect(result.cappedEarned.grain).toBeLessThanOrEqual(1);
    expect(result.overflowResources.grain).toBeGreaterThan(0);
  });
});
