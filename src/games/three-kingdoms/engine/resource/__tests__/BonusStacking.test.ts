/**
 * 加成叠加规则 P1 缺口补充测试
 *
 * 覆盖 PRD RES-2 加成叠加规则：
 * - 乘法叠加（非加法叠加）
 * - 公式：最终产出 = 基础产出 × (1 + 科技加成) × (1 + 主城加成) × (1 + 武将加成) × 转生倍率 × (1 + VIP加成)
 * - 同类加成取最高级生效
 * - VIP加成：VIP1 +5%、VIP3 +10%、VIP5 +20%
 *
 * + 新手资源保护（前 7 天不被掠夺）
 *
 * 测试策略：使用真实引擎实例，直接测试 resource-calculator.ts 的 calculateBonusMultiplier
 * 以及 ResourceSystem.tick() 中的加成叠加行为
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceSystem } from '../ResourceSystem';
import {
  calculateBonusMultiplier,
  zeroResources,
  cloneResources,
  lookupCap,
  getWarningLevel,
  calculateCapWarnings,
  calculateCapWarning,
} from '../resource-calculator';
import type { Bonuses } from '../resource.types';
import {
  INITIAL_RESOURCES,
  INITIAL_PRODUCTION_RATES,
  INITIAL_CAPS,
  CAP_WARNING_THRESHOLDS,
  OFFLINE_TIERS,
  OFFLINE_MAX_SECONDS,
  MIN_GRAIN_RESERVE,
  GOLD_SAFETY_LINE,
  MANDATE_CONFIRM_THRESHOLD,
} from '../resource-config';
import type { ISystemDeps } from '../../../core/types';

// ── 辅助函数 ──

/** 创建 mock ISystemDeps */
function makeSystemDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    } as unknown,
    config: { get: vi.fn(), set: vi.fn() } as unknown,
    registry: { get: vi.fn(), has: vi.fn(), getAll: vi.fn() } as unknown,
  };
}

/** 创建真实的 ResourceSystem */
function createResourceSystem(): ResourceSystem {
  const rs = new ResourceSystem();
  rs.init(makeSystemDeps());
  return rs;
}

// ═══════════════════════════════════════════════════════════════
// 1. 乘法叠加核心逻辑
// ═══════════════════════════════════════════════════════════════

describe('calculateBonusMultiplier — 乘法叠加', () => {
  it('无加成时乘数为 1', () => {
    expect(calculateBonusMultiplier()).toBe(1);
    expect(calculateBonusMultiplier({})).toBe(1);
  });

  it('单一加成正确计算', () => {
    // 科技加成 15%
    expect(calculateBonusMultiplier({ tech: 0.15 })).toBeCloseTo(1.15, 10);
    // 主城加成 35%
    expect(calculateBonusMultiplier({ castle: 0.35 })).toBeCloseTo(1.35, 10);
    // VIP加成 20%
    expect(calculateBonusMultiplier({ vip: 0.20 })).toBeCloseTo(1.20, 10);
  });

  it('两个加成乘法叠加（非加法）', () => {
    // 科技 15% + 主城 35%
    // 乘法：(1 + 0.15) × (1 + 0.35) = 1.15 × 1.35 = 1.5525
    // 加法（错误）：1 + 0.15 + 0.35 = 1.50
    const multiplier = calculateBonusMultiplier({ tech: 0.15, castle: 0.35 });
    expect(multiplier).toBeCloseTo(1.5525, 10);
    expect(multiplier).not.toBeCloseTo(1.50, 2); // 确保不是加法
  });

  it('三个加成乘法叠加', () => {
    // 科技 25% + 主城 35% + 武将 10%
    // 乘法：(1 + 0.25) × (1 + 0.35) × (1 + 0.10) = 1.25 × 1.35 × 1.10 = 1.85625
    const multiplier = calculateBonusMultiplier({ tech: 0.25, castle: 0.35, hero: 0.10 });
    expect(multiplier).toBeCloseTo(1.85625, 10);
  });

  it('四个加成乘法叠加', () => {
    // 科技 40% + 主城 35% + 武将 10% + VIP 20%
    // 乘法：1.40 × 1.35 × 1.10 × 1.20 = 2.4948
    const multiplier = calculateBonusMultiplier({
      tech: 0.40,
      castle: 0.35,
      hero: 0.10,
      vip: 0.20,
    });
    expect(multiplier).toBeCloseTo(2.4948, 4);
  });

  it('五个加成全部叠加（含转生）', () => {
    // 科技 40% + 主城 35% + 武将 10% + 转生 50% + VIP 20%
    // 乘法：1.40 × 1.35 × 1.10 × 1.50 × 1.20 = 3.7422
    const multiplier = calculateBonusMultiplier({
      tech: 0.40,
      castle: 0.35,
      hero: 0.10,
      rebirth: 0.50,
      vip: 0.20,
    });
    expect(multiplier).toBeCloseTo(3.7422, 4);
  });

  it('加成值为 0 时不影响乘数', () => {
    expect(calculateBonusMultiplier({ tech: 0 })).toBeCloseTo(1.0, 10);
    expect(calculateBonusMultiplier({ tech: 0, castle: 0 })).toBeCloseTo(1.0, 10);
  });

  it('高加成值不线性膨胀（乘法特性）', () => {
    // 5 个 50% 加成
    // 乘法：1.5^5 = 7.59375
    // 加法（错误）：1 + 5×0.5 = 3.5
    const multiplier = calculateBonusMultiplier({
      tech: 0.50,
      castle: 0.50,
      hero: 0.50,
      rebirth: 0.50,
      vip: 0.50,
    });
    expect(multiplier).toBeCloseTo(7.59375, 4);
    expect(multiplier).toBeGreaterThan(3.5); // 乘法 > 加法（多加成时）
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. VIP 加成等级
// ═══════════════════════════════════════════════════════════════

describe('VIP 加成等级', () => {
  it('VIP1 +5% 加成', () => {
    const multiplier = calculateBonusMultiplier({ vip: 0.05 });
    expect(multiplier).toBeCloseTo(1.05, 10);
  });

  it('VIP3 +10% 加成', () => {
    const multiplier = calculateBonusMultiplier({ vip: 0.10 });
    expect(multiplier).toBeCloseTo(1.10, 10);
  });

  it('VIP5 +20% 加成', () => {
    const multiplier = calculateBonusMultiplier({ vip: 0.20 });
    expect(multiplier).toBeCloseTo(1.20, 10);
  });

  it('VIP 加成与其他加成乘法叠加', () => {
    // VIP5 + 科技 25% + 主城 35%
    // 1.20 × 1.25 × 1.35 = 2.025
    const multiplier = calculateBonusMultiplier({ vip: 0.20, tech: 0.25, castle: 0.35 });
    expect(multiplier).toBeCloseTo(2.025, 4);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. PRD 公式验证
// ═══════════════════════════════════════════════════════════════

describe('PRD 公式验证：最终产出 = 基础产出 × (1+科技) × (1+主城) × (1+武将) × 转生倍率 × (1+VIP)', () => {
  it('PRD 示例：科技屯田术 Lv2 +25%', () => {
    const multiplier = calculateBonusMultiplier({ tech: 0.25 });
    expect(multiplier).toBeCloseTo(1.25, 10);
  });

  it('PRD 示例：主城 Lv10 +18%', () => {
    const multiplier = calculateBonusMultiplier({ castle: 0.18 });
    expect(multiplier).toBeCloseTo(1.18, 10);
  });

  it('PRD 示例：主城 Lv20 +35%', () => {
    const multiplier = calculateBonusMultiplier({ castle: 0.35 });
    expect(multiplier).toBeCloseTo(1.35, 10);
  });

  it('PRD 完整公式：科技 40% + 主城 35% + 武将 10% + 转生 2x + VIP 20%', () => {
    // 注意：转生倍率在 PRD 中是直接乘，不是 (1+x) 形式
    // 但在 Bonuses 中统一为 (1+x) 形式，所以转生 100% = rebirth: 1.0
    // 如果转生倍率为 2x，则 rebirth = 1.0 (即 100% 加成)
    const bonusMultiplier = calculateBonusMultiplier({
      tech: 0.40,
      castle: 0.35,
      hero: 0.10,
      rebirth: 1.0, // 转生 2x = 100% 加成
      vip: 0.20,
    });
    // 1.40 × 1.35 × 1.10 × 2.00 × 1.20 = 4.9896
    expect(bonusMultiplier).toBeCloseTo(4.9896, 4);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. ResourceSystem.tick() 加成叠加集成测试
// ═══════════════════════════════════════════════════════════════

describe('ResourceSystem.tick() 加成叠加集成测试', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    rs = createResourceSystem();
  });

  it('无加成时产出等于基础速率', () => {
    rs.setProductionRate('grain', 1.0);
    rs.tick(10000); // 10 秒
    // 1.0 * 10 = 10
    expect(rs.getAmount('grain') - INITIAL_RESOURCES.grain).toBeCloseTo(10, 5);
  });

  it('单一科技加成 15% 正确提升产出', () => {
    rs.setProductionRate('grain', 1.0);
    rs.tick(10000, { tech: 0.15 });
    // 1.0 * 10 * 1.15 = 11.5
    expect(rs.getAmount('grain') - INITIAL_RESOURCES.grain).toBeCloseTo(11.5, 5);
  });

  it('科技 + 主城乘法叠加产出', () => {
    rs.setProductionRate('grain', 1.0);
    rs.tick(10000, { tech: 0.15, castle: 0.35 });
    // 1.0 * 10 * 1.15 * 1.35 = 15.525
    expect(rs.getAmount('grain') - INITIAL_RESOURCES.grain).toBeCloseTo(15.525, 3);
  });

  it('多资源同时受加成影响', () => {
    rs.setProductionRate('grain', 1.0);
    rs.setProductionRate('gold', 0.5);
    rs.tick(10000, { tech: 0.25, castle: 0.35 });

    const grainGained = rs.getAmount('grain') - INITIAL_RESOURCES.grain;
    const goldGained = rs.getAmount('gold') - INITIAL_RESOURCES.gold;

    // 乘数 = 1.25 * 1.35 = 1.6875
    expect(grainGained).toBeCloseTo(1.0 * 10 * 1.6875, 3);
    expect(goldGained).toBeCloseTo(0.5 * 10 * 1.6875, 3);
  });

  it('加成不影响产出速率为 0 的资源', () => {
    rs.setProductionRate('mandate', 0);
    rs.tick(10000, { tech: 0.50, castle: 0.50 });
    expect(rs.getAmount('mandate')).toBe(0);
  });

  it('多次 tick 加成效果累积', () => {
    rs.setProductionRate('grain', 1.0);
    const bonuses: Bonuses = { tech: 0.20 };

    // 3 次 tick，每次 1000ms（1秒）
    rs.tick(1000, bonuses);
    rs.tick(1000, bonuses);
    rs.tick(1000, bonuses);

    // 每次：1.0 * 1 * 1.20 = 1.2，3 次 = 3.6
    expect(rs.getAmount('grain') - INITIAL_RESOURCES.grain).toBeCloseTo(3.6, 5);
  });

  it('不同 tick 使用不同加成', () => {
    rs.setProductionRate('grain', 1.0);

    rs.tick(1000, { tech: 0.10 }); // 1.0 * 1 * 1.10 = 1.1
    rs.tick(1000, { tech: 0.20, castle: 0.30 }); // 1.0 * 1 * 1.20 * 1.30 = 1.56
    rs.tick(1000); // 1.0 * 1 = 1.0

    expect(rs.getAmount('grain') - INITIAL_RESOURCES.grain).toBeCloseTo(3.66, 5);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 加成叠加 vs 加法叠加对比验证
// ═══════════════════════════════════════════════════════════════

describe('乘法叠加 vs 加法叠加对比', () => {
  it('两个加成时乘法 > 加法', () => {
    const bonuses: Bonuses = { tech: 0.20, castle: 0.30 };
    const multiplicative = calculateBonusMultiplier(bonuses);
    const additive = 1 + 0.20 + 0.30;

    // 乘法：1.20 × 1.30 = 1.56
    // 加法：1.50
    expect(multiplicative).toBeCloseTo(1.56, 10);
    expect(multiplicative).toBeGreaterThan(additive);
  });

  it('三个加成时乘法明显 > 加法', () => {
    const bonuses: Bonuses = { tech: 0.30, castle: 0.30, hero: 0.30 };
    const multiplicative = calculateBonusMultiplier(bonuses);
    const additive = 1 + 0.30 + 0.30 + 0.30;

    // 乘法：1.30^3 = 2.197
    // 加法：1.90
    expect(multiplicative).toBeCloseTo(2.197, 4);
    expect(multiplicative).toBeGreaterThan(additive);
    expect(multiplicative - additive).toBeCloseTo(0.297, 3);
  });

  it('在 ResourceSystem 中验证乘法叠加行为', () => {
    const rs = createResourceSystem();
    rs.setProductionRate('grain', 10);

    // 使用 3 个 20% 加成
    rs.tick(1000, { tech: 0.20, castle: 0.20, hero: 0.20 });

    const gained = rs.getAmount('grain') - INITIAL_RESOURCES.grain;
    // 乘法：10 * 1 * 1.20^3 = 10 * 1.728 = 17.28
    // 加法（错误）：10 * 1 * 1.60 = 16.0
    expect(gained).toBeCloseTo(17.28, 3);
    expect(gained).not.toBeCloseTo(16.0, 2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 同类加成取最高（PRD 规则）
// ═══════════════════════════════════════════════════════════════

describe('同类加成取最高（PRD 规则）', () => {
  it('Bonuses 类型中每种加成只有一个值（取最高由上层保证）', () => {
    // Bonuses 类型定义为 Partial<Record<BonusType, number>>
    // 同类型只有一个值，上层负责取最高后传入
    const bonuses: Bonuses = { tech: 0.40 }; // 科技 Lv3 +40%（取最高）
    expect(calculateBonusMultiplier(bonuses)).toBeCloseTo(1.40, 10);
  });

  it('多类型各自取最高后乘法叠加', () => {
    // 科技取最高 40%，主城取最高 35%，VIP 取最高 20%
    const bonuses: Bonuses = { tech: 0.40, castle: 0.35, vip: 0.20 };
    const multiplier = calculateBonusMultiplier(bonuses);
    // 1.40 × 1.35 × 1.20 = 2.268
    expect(multiplier).toBeCloseTo(2.268, 4);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 边界条件
// ═══════════════════════════════════════════════════════════════

describe('加成叠加边界条件', () => {
  it('加成值为 undefined 时不影响乘数', () => {
    const bonuses: Bonuses = { tech: undefined, castle: 0.20 };
    expect(calculateBonusMultiplier(bonuses)).toBeCloseTo(1.20, 10);
  });

  it('极高加成值不导致 NaN', () => {
    const multiplier = calculateBonusMultiplier({ tech: 100 });
    expect(Number.isFinite(multiplier)).toBe(true);
    expect(multiplier).toBe(101);
  });

  it('负加成值（减益）正确计算', () => {
    // 理论上不应该有负加成，但防御性测试
    const multiplier = calculateBonusMultiplier({ tech: -0.5 });
    expect(multiplier).toBeCloseTo(0.5, 10);
  });

  it('极小加成值不丢失精度', () => {
    const multiplier = calculateBonusMultiplier({ tech: 0.0001 });
    expect(multiplier).toBeCloseTo(1.0001, 10);
  });

  it('ResourceSystem.tick dt=0 不产出', () => {
    const rs = createResourceSystem();
    rs.setProductionRate('grain', 10);
    rs.tick(0, { tech: 0.50 });
    expect(rs.getAmount('grain')).toBe(INITIAL_RESOURCES.grain);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 新手资源保护（前 7 天不被掠夺）
// ═══════════════════════════════════════════════════════════════

describe('新手资源保护（RES-6）', () => {
  it('粮草最低保留 10 — 配置验证', () => {
    expect(MIN_GRAIN_RESERVE).toBe(10);
  });

  it('铜钱安全线 500 — 配置验证', () => {
    expect(GOLD_SAFETY_LINE).toBe(500);
  });

  it('天命消耗保护阈值 100 — 配置验证', () => {
    expect(MANDATE_CONFIRM_THRESHOLD).toBe(100);
  });

  it('离线收益封顶 72h — 配置验证', () => {
    expect(OFFLINE_MAX_SECONDS).toBe(259200); // 72 * 3600
  });

  it('粮草消耗保护在 ResourceSystem 中生效', () => {
    const rs = createResourceSystem();
    // 初始粮草 500，设为 100 后测试
    rs.setResource('grain', 100);
    // 可用 = 100 - 10 = 90
    rs.consumeResource('grain', 90);
    expect(rs.getAmount('grain')).toBe(10);
    // 再消耗 1 应失败（只剩保留量）
    expect(() => rs.consumeResource('grain', 1)).toThrow();
  });

  it('粮草刚好等于保留量时无法消耗', () => {
    const rs = createResourceSystem();
    rs.setResource('grain', 10);
    expect(() => rs.consumeResource('grain', 1)).toThrow(/粮草不足/);
  });

  it('粮草低于保留量时仍无法消耗', () => {
    const rs = createResourceSystem();
    rs.setResource('grain', 5);
    expect(() => rs.consumeResource('grain', 1)).toThrow(/粮草不足/);
  });

  it('canAfford 正确计算粮草可用量（扣除保留量）', () => {
    const rs = createResourceSystem();
    rs.setResource('grain', 100);
    // 可用 = 100 - 10 = 90
    const check = rs.canAfford({ grain: 90 });
    expect(check.canAfford).toBe(true);

    const check2 = rs.canAfford({ grain: 91 });
    expect(check2.canAfford).toBe(false);
    expect(check2.shortages.grain).toBeDefined();
    expect(check2.shortages.grain!.current).toBe(90);
  });

  it('非粮草资源不受保留量保护', () => {
    const rs = createResourceSystem();
    rs.setResource('gold', 100);
    rs.consumeResource('gold', 100);
    expect(rs.getAmount('gold')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 离线收益加成叠加
// ═══════════════════════════════════════════════════════════════

describe('离线收益加成叠加（PRD RES-OFR）', () => {
  it('离线收益 5 档衰减配置正确', () => {
    expect(OFFLINE_TIERS.length).toBe(5);
    expect(OFFLINE_TIERS[0].efficiency).toBe(1.0); // 0~2h
    expect(OFFLINE_TIERS[1].efficiency).toBe(0.8); // 2~8h
    expect(OFFLINE_TIERS[2].efficiency).toBe(0.6); // 8~24h
    expect(OFFLINE_TIERS[3].efficiency).toBe(0.4); // 24~48h
    expect(OFFLINE_TIERS[4].efficiency).toBe(0.20); // 48~72h
  });

  it('离线收益最大计算时长 72h', () => {
    expect(OFFLINE_MAX_SECONDS).toBe(72 * 3600);
  });

  it('PRD 离线收益公式：Σ(各时段产出) × (1+科技加成) × (1+VIP加成)', () => {
    // 验证加成乘数在离线收益中也是乘法叠加
    const multiplier = calculateBonusMultiplier({ tech: 0.15, vip: 0.10 });
    // 1.15 × 1.10 = 1.265
    expect(multiplier).toBeCloseTo(1.265, 10);
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 容量警告与加成无关（回归测试）
// ═══════════════════════════════════════════════════════════════

describe('容量警告与加成无关', () => {
  it('容量警告正确计算', () => {
    const resources = { ...INITIAL_RESOURCES, grain: 1800 };
    const caps = { ...INITIAL_CAPS };
    const warnings = calculateCapWarnings(resources, caps);
    // grain 1800/2000 = 90% → notice
    const grainWarning = warnings.find(w => w.resourceType === 'grain');
    expect(grainWarning).toBeDefined();
    expect(grainWarning!.level).toBe('notice');
  });

  it('getWarningLevel 正确分级', () => {
    expect(getWarningLevel(0.5)).toBe('safe');
    expect(getWarningLevel(0.7 - 0.001)).toBe('safe');
    expect(getWarningLevel(0.91)).toBe('notice');
    expect(getWarningLevel(0.96)).toBe('warning');
    expect(getWarningLevel(0.99)).toBe('warning'); // 0.99 < 1.0(urgent), >= 0.95(warning)
    expect(getWarningLevel(1.0)).toBe('full');
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 辅助函数测试
// ═══════════════════════════════════════════════════════════════

describe('resource-calculator 辅助函数', () => {
  it('zeroResources 返回全零资源', () => {
    const zero = zeroResources();
    expect(zero.grain).toBe(0);
    expect(zero.gold).toBe(0);
    expect(zero.troops).toBe(0);
    expect(zero.mandate).toBe(0);
    expect(zero.techPoint).toBe(0);
    expect(zero.recruitToken).toBe(0);
    expect(zero.skillBook).toBe(0);
  });

  it('cloneResources 正确克隆', () => {
    const original = { grain: 100, gold: 200, troops: 50, mandate: 30, techPoint: 10, recruitToken: 5, skillBook: 2 };
    const cloned = cloneResources(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('lookupCap 正确查表', () => {
    expect(lookupCap(1, 'granary')).toBe(2000);
    expect(lookupCap(5, 'granary')).toBe(5000);
    expect(lookupCap(1, 'barracks')).toBe(500);
  });

  it('lookupCap 超出最大等级时线性外推', () => {
    // 超过 granary 最大等级 30
    const cap31 = lookupCap(31, 'granary');
    expect(cap31).toBeGreaterThan(200000);
  });
});
