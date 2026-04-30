/**
 * recruit-types.ts 单元测试
 *
 * 覆盖导出函数：
 * - createEmptyPity
 * - createEmptyFreeRecruit
 * - createDefaultUpHero
 * - todayDateString
 * - rollQuality
 * - applyPity
 * - pickGeneralByQuality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createEmptyPity,
  createEmptyFreeRecruit,
  createDefaultUpHero,
  todayDateString,
  rollQuality,
  applyPity,
  pickGeneralByQuality,
  MAX_HISTORY_SIZE,
} from '../recruit-types';
import { Quality, QUALITY_ORDER } from '../hero.types';
import type { QualityRate, PityConfig } from '../hero-recruit-config';
import { NORMAL_PITY, ADVANCED_PITY, ADVANCED_RATES, NORMAL_RATES } from '../hero-recruit-config';
import type { HeroSystem } from '../HeroSystem';

// ── 辅助 ──

function makeRates(overrides: Partial<QualityRate>[] = []): QualityRate[] {
  const base: QualityRate[] = [
    { quality: Quality.COMMON, rate: 0.5 },
    { quality: Quality.FINE, rate: 0.3 },
    { quality: Quality.RARE, rate: 0.15 },
    { quality: Quality.EPIC, rate: 0.04 },
    { quality: Quality.LEGENDARY, rate: 0.01 },
  ];
  for (const o of overrides) {
    const idx = base.findIndex((b) => b.quality === o.quality);
    if (idx >= 0 && o.rate !== undefined) base[idx].rate = o.rate;
  }
  return base;
}

// ═══════════════════════════════════════════
// createEmptyPity
// ═══════════════════════════════════════════
describe('createEmptyPity', () => {
  it('返回所有计数为0的初始状态', () => {
    const pity = createEmptyPity();
    expect(pity.normalPity).toBe(0);
    expect(pity.advancedPity).toBe(0);
    expect(pity.normalHardPity).toBe(0);
    expect(pity.advancedHardPity).toBe(0);
  });

  it('每次调用返回新对象', () => {
    const a = createEmptyPity();
    const b = createEmptyPity();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ═══════════════════════════════════════════
// createEmptyFreeRecruit
// ═══════════════════════════════════════════
describe('createEmptyFreeRecruit', () => {
  it('返回默认免费招募状态', () => {
    const state = createEmptyFreeRecruit();
    expect(state.usedFreeCount.normal).toBe(0);
    expect(state.usedFreeCount.advanced).toBe(0);
  });

  it('lastResetDate 为今日日期格式', () => {
    const state = createEmptyFreeRecruit();
    expect(state.lastResetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.lastResetDate).toBe(todayDateString());
  });

  it('每次调用返回新对象', () => {
    const a = createEmptyFreeRecruit();
    const b = createEmptyFreeRecruit();
    expect(a).not.toBe(b);
    expect(a.usedFreeCount).not.toBe(b.usedFreeCount);
  });
});

// ═══════════════════════════════════════════
// createDefaultUpHero
// ═══════════════════════════════════════════
describe('createDefaultUpHero', () => {
  it('返回有效 UP 英雄状态', () => {
    const up = createDefaultUpHero();
    expect(up.upRate).toBeGreaterThan(0);
    expect(up.upRate).toBeLessThanOrEqual(1);
    expect(typeof up.description).toBe('string');
  });

  it('每次调用返回新对象', () => {
    const a = createDefaultUpHero();
    const b = createDefaultUpHero();
    expect(a).not.toBe(b);
  });
});

// ═══════════════════════════════════════════
// todayDateString
// ═══════════════════════════════════════════
describe('todayDateString', () => {
  it('返回 YYYY-MM-DD 格式', () => {
    const dateStr = todayDateString();
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('返回的月份和日期是有效的', () => {
    const dateStr = todayDateString();
    const [y, m, d] = dateStr.split('-').map(Number);
    expect(m).toBeGreaterThanOrEqual(1);
    expect(m).toBeLessThanOrEqual(12);
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(31);
  });
});

// ═══════════════════════════════════════════
// rollQuality
// ═══════════════════════════════════════════
describe('rollQuality', () => {
  const rates = makeRates();

  it('rng=0 返回第一个品质（COMMON）', () => {
    expect(rollQuality(rates, () => 0)).toBe(Quality.COMMON);
  });

  it('rng 接近1 返回最后一个品质（LEGENDARY）', () => {
    expect(rollQuality(rates, () => 0.999)).toBe(Quality.LEGENDARY);
  });

  it('rng 在 COMMON 范围内返回 COMMON', () => {
    expect(rollQuality(rates, () => 0.25)).toBe(Quality.COMMON);
  });

  it('rng 在 FINE 范围内返回 FINE', () => {
    // cumulative: COMMON=0.5, FINE=0.8
    expect(rollQuality(rates, () => 0.55)).toBe(Quality.FINE);
  });

  it('rng 在 RARE 范围内返回 RARE', () => {
    // cumulative: RARE=0.95
    expect(rollQuality(rates, () => 0.85)).toBe(Quality.RARE);
  });

  it('rng 在 EPIC 范围内返回 EPIC', () => {
    // cumulative: EPIC=0.99
    expect(rollQuality(rates, () => 0.96)).toBe(Quality.EPIC);
  });

  it('使用真实概率表 NORMAL_RATES', () => {
    // rng=0 → COMMON
    expect(rollQuality(NORMAL_RATES, () => 0)).toBe(Quality.COMMON);
  });

  it('使用真实概率表 ADVANCED_RATES', () => {
    // rng=0 → COMMON
    expect(rollQuality(ADVANCED_RATES, () => 0)).toBe(Quality.COMMON);
  });

  it('单品质表始终返回该品质', () => {
    const singleRate: QualityRate[] = [
      { quality: Quality.LEGENDARY, rate: 1.0 },
    ];
    expect(rollQuality(singleRate, () => 0)).toBe(Quality.LEGENDARY);
    expect(rollQuality(singleRate, () => 0.5)).toBe(Quality.LEGENDARY);
    expect(rollQuality(singleRate, () => 0.99)).toBe(Quality.LEGENDARY);
  });

  it('概率分布统计测试（蒙特卡洛）', () => {
    const counts: Record<string, number> = {};
    const N = 10000;
    const rng = (() => { let s = 42; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    for (let i = 0; i < N; i++) {
      const q = rollQuality(rates, rng);
      counts[q] = (counts[q] || 0) + 1;
    }
    // COMMON 应约 50%
    expect(counts[Quality.COMMON]! / N).toBeGreaterThan(0.40);
    expect(counts[Quality.COMMON]! / N).toBeLessThan(0.60);
  });
});

// ═══════════════════════════════════════════
// applyPity
// ═══════════════════════════════════════════
describe('applyPity', () => {
  const config: PityConfig = {
    tenPullThreshold: 10,
    tenPullMinQuality: Quality.RARE,
    hardPityThreshold: 50,
    hardPityMinQuality: Quality.EPIC,
  };

  it('无保底触发时返回原品质', () => {
    expect(applyPity(Quality.COMMON, 0, 0, config)).toBe(Quality.COMMON);
    expect(applyPity(Quality.FINE, 5, 10, config)).toBe(Quality.FINE);
  });

  it('十连保底触发：pityCount >= threshold-1 时提升品质', () => {
    // pityCount=9, threshold=10 → 触发
    const result = applyPity(Quality.COMMON, 9, 0, config);
    expect(QUALITY_ORDER[result]).toBeGreaterThanOrEqual(QUALITY_ORDER[Quality.RARE]);
  });

  it('十连保底不降低已有高品质', () => {
    const result = applyPity(Quality.EPIC, 9, 0, config);
    expect(result).toBe(Quality.EPIC);
  });

  it('硬保底触发：hardPityCount >= threshold-1 时提升品质', () => {
    const result = applyPity(Quality.COMMON, 0, 49, config);
    expect(QUALITY_ORDER[result]).toBeGreaterThanOrEqual(QUALITY_ORDER[Quality.EPIC]);
  });

  it('硬保底优先于十连保底', () => {
    // 两个保底同时触发，硬保底应该生效（因为先检查）
    const result = applyPity(Quality.COMMON, 9, 49, config);
    expect(QUALITY_ORDER[result]).toBeGreaterThanOrEqual(QUALITY_ORDER[Quality.EPIC]);
  });

  it('硬保底不降低已有高品质', () => {
    const result = applyPity(Quality.LEGENDARY, 0, 49, config);
    expect(result).toBe(Quality.LEGENDARY);
  });

  it('十连保底刚好差1次不触发', () => {
    const result = applyPity(Quality.COMMON, 8, 0, config);
    expect(result).toBe(Quality.COMMON);
  });

  it('硬保底刚好差1次不触发', () => {
    const result = applyPity(Quality.COMMON, 0, 48, config);
    expect(result).toBe(Quality.COMMON);
  });

  it('使用 NORMAL_PITY 配置（无硬保底）', () => {
    // NORMAL_PITY hardPityThreshold = Infinity
    const result = applyPity(Quality.COMMON, 0, 100, NORMAL_PITY);
    expect(result).toBe(Quality.COMMON); // 硬保底不触发
  });

  it('使用 ADVANCED_PITY 配置', () => {
    const result = applyPity(Quality.COMMON, 9, 0, ADVANCED_PITY);
    expect(QUALITY_ORDER[result]).toBeGreaterThanOrEqual(QUALITY_ORDER[Quality.RARE]);
  });

  it('边界：pityCount 为负数时不触发', () => {
    const result = applyPity(Quality.COMMON, -1, -1, config);
    expect(result).toBe(Quality.COMMON);
  });
});

// ═══════════════════════════════════════════
// pickGeneralByQuality
// ═══════════════════════════════════════════
describe('pickGeneralByQuality', () => {
  function createMockHeroSystem(generals: { id: string; quality: Quality }[]): HeroSystem {
    return {
      getAllGeneralDefs: () => generals,
    } as unknown as HeroSystem;
  }

  it('从匹配品质的武将中随机选择', () => {
    const generals = [
      { id: 'a', quality: Quality.RARE },
      { id: 'b', quality: Quality.RARE },
      { id: 'c', quality: Quality.EPIC },
    ];
    const heroSystem = createMockHeroSystem(generals);
    const result = pickGeneralByQuality(heroSystem, Quality.RARE, () => 0.5);
    expect(['a', 'b']).toContain(result);
  });

  it('无匹配品质返回 null', () => {
    const generals = [
      { id: 'a', quality: Quality.COMMON },
    ];
    const heroSystem = createMockHeroSystem(generals);
    expect(pickGeneralByQuality(heroSystem, Quality.LEGENDARY, () => 0.5)).toBeNull();
  });

  it('空武将列表返回 null', () => {
    const heroSystem = createMockHeroSystem([]);
    expect(pickGeneralByQuality(heroSystem, Quality.COMMON, () => 0.5)).toBeNull();
  });

  it('单武将时始终返回该武将', () => {
    const generals = [{ id: 'only', quality: Quality.EPIC }];
    const heroSystem = createMockHeroSystem(generals);
    expect(pickGeneralByQuality(heroSystem, Quality.EPIC, () => 0.1)).toBe('only');
    expect(pickGeneralByQuality(heroSystem, Quality.EPIC, () => 0.9)).toBe('only');
  });

  it('rng 影响选择结果', () => {
    const generals = [
      { id: 'first', quality: Quality.RARE },
      { id: 'second', quality: Quality.RARE },
    ];
    const heroSystem = createMockHeroSystem(generals);
    const r1 = pickGeneralByQuality(heroSystem, Quality.RARE, () => 0.1);
    const r2 = pickGeneralByQuality(heroSystem, Quality.RARE, () => 0.9);
    // 两个不同 rng 值可能选中不同武将
    expect(['first', 'second']).toContain(r1);
    expect(['first', 'second']).toContain(r2);
  });
});

// ═══════════════════════════════════════════
// MAX_HISTORY_SIZE
// ═══════════════════════════════════════════
describe('MAX_HISTORY_SIZE', () => {
  it('为正整数', () => {
    expect(MAX_HISTORY_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_HISTORY_SIZE)).toBe(true);
  });
});
