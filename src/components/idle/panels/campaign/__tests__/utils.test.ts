/**
 * campaign/utils — 纯函数单元测试
 *
 * 覆盖：
 * - createDefaultBattleResult
 * - filterDamageFloats（各速度档位）
 * - buildFragmentDrops（空/非空/首通）
 * - formatDuration / formatNum / getResourceLabel
 * - productionRateToResources
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultBattleResult,
  filterDamageFloats,
  buildFragmentDrops,
  formatDuration,
  formatNum,
  getResourceLabel,
  productionRateToResources,
} from '../utils';
import type { DamageFloat } from '../utils';
import { BattleOutcome } from '@/games/three-kingdoms/engine';

// ─────────────────────────────────────────────
// createDefaultBattleResult
// ─────────────────────────────────────────────

describe('createDefaultBattleResult', () => {
  it('返回 DEFEAT + NONE 星级', () => {
    const result = createDefaultBattleResult();
    expect(result.outcome).toBe(BattleOutcome.DEFEAT);
    expect(result.stars).toBe(0);
    expect(result.totalTurns).toBe(0);
    expect(result.summary).toBe('战斗未完成');
  });

  it('fragmentRewards 为空对象', () => {
    expect(createDefaultBattleResult().fragmentRewards).toEqual({});
  });
});

// ─────────────────────────────────────────────
// filterDamageFloats
// ─────────────────────────────────────────────

describe('filterDamageFloats', () => {
  const floats: DamageFloat[] = [
    { id: 1, unitId: 'u1', value: 100, isCritical: false, isHeal: false },
    { id: 2, unitId: 'u1', value: 200, isCritical: true, isHeal: false },
    { id: 3, unitId: 'u1', value: 50, isCritical: false, isHeal: true },
    { id: 4, unitId: 'u2', value: 300, isCritical: false, isHeal: false },
  ];

  it('1x 速度显示该单位全部飘字', () => {
    const result = filterDamageFloats(floats, 'u1', 1);
    expect(result).toHaveLength(3);
  });

  it('2x 速度只显示暴击 + 治疗', () => {
    const result = filterDamageFloats(floats, 'u1', 2);
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.isCritical || f.isHeal)).toBe(true);
  });

  it('3x 速度只显示暴击', () => {
    const result = filterDamageFloats(floats, 'u1', 3);
    expect(result).toHaveLength(1);
    expect(result[0].isCritical).toBe(true);
  });

  it('8x 速度只显示暴击（同 3x）', () => {
    const result = filterDamageFloats(floats, 'u1', 8);
    expect(result).toHaveLength(1);
    expect(result[0].isCritical).toBe(true);
  });

  it('无匹配单位返回空数组', () => {
    expect(filterDamageFloats(floats, 'u3', 1)).toEqual([]);
  });

  it('空飘字数组返回空数组', () => {
    expect(filterDamageFloats([], 'u1', 1)).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// buildFragmentDrops
// ─────────────────────────────────────────────

describe('buildFragmentDrops', () => {
  it('空 fragmentRewards 返回空数组', () => {
    expect(buildFragmentDrops({})).toEqual([]);
  });

  it('undefined/null fragmentRewards 返回空数组', () => {
    expect(buildFragmentDrops(null as any)).toEqual([]);
  });

  it('正常构建碎片掉落', () => {
    const result = buildFragmentDrops(
      { guanyu: 3, zhangfei: 1 },
      false,
      { guanyu: '关羽', zhangfei: '张飞' },
    );
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.generalId === 'guanyu')!.generalName).toBe('关羽');
    expect(result.find((r) => r.generalId === 'guanyu')!.count).toBe(3);
    expect(result.find((r) => r.generalId === 'guanyu')!.dropRateLabel).toBe('10%概率');
  });

  it('首通标记为 100%必掉', () => {
    const result = buildFragmentDrops({ guanyu: 2 }, true);
    expect(result[0].isFirstClearGuaranteed).toBe(true);
    expect(result[0].dropRateLabel).toBe('100%必掉');
  });

  it('缺少名称映射时回退到 generalId', () => {
    const result = buildFragmentDrops({ unknown_hero: 5 }, false);
    expect(result[0].generalName).toBe('unknown_hero');
  });
});

// ─────────────────────────────────────────────
// formatDuration
// ─────────────────────────────────────────────

describe('formatDuration', () => {
  it('0 或负数返回 "0分钟"', () => {
    expect(formatDuration(0)).toBe('0分钟');
    expect(formatDuration(-1)).toBe('0分钟');
  });

  it('纯分钟', () => {
    expect(formatDuration(1800)).toBe('30分钟');
  });

  it('纯小时', () => {
    expect(formatDuration(7200)).toBe('2小时');
  });

  it('小时+分钟', () => {
    expect(formatDuration(9000)).toBe('2小时30分钟');
  });

  it('1小时整', () => {
    expect(formatDuration(3600)).toBe('1小时');
  });
});

// ─────────────────────────────────────────────
// formatNum
// ─────────────────────────────────────────────

describe('formatNum', () => {
  it('小于 10000 直接格式化', () => {
    expect(formatNum(9999)).toBe('9,999');
  });

  it('10000 显示"万"', () => {
    expect(formatNum(10000)).toBe('1.0万');
  });

  it('大数字保留一位小数', () => {
    expect(formatNum(12345)).toBe('1.2万');
  });

  it('0 显示为 "0"', () => {
    expect(formatNum(0)).toBe('0');
  });
});

// ─────────────────────────────────────────────
// getResourceLabel
// ─────────────────────────────────────────────

describe('getResourceLabel', () => {
  it('已知资源返回中文名', () => {
    expect(getResourceLabel('grain')).toBe('粮草');
    expect(getResourceLabel('gold')).toBe('铜钱');
    expect(getResourceLabel('troops')).toBe('兵力');
  });

  it('fragment_ 前缀返回碎片', () => {
    expect(getResourceLabel('fragment_guanyu')).toBe('guanyu碎片');
  });

  it('未知类型原样返回', () => {
    expect(getResourceLabel('unknown')).toBe('unknown');
  });
});

// ─────────────────────────────────────────────
// productionRateToResources
// ─────────────────────────────────────────────

describe('productionRateToResources', () => {
  it('完整映射所有 9 个字段', () => {
    const rate = {
      grain: 1, gold: 2, ore: 3, wood: 4,
      troops: 5, mandate: 6,
      techPoint: 7, recruitToken: 8, skillBook: 9,
    };
    const resources = productionRateToResources(rate);
    expect(resources).toEqual({
      grain: 1, gold: 2, ore: 3, wood: 4,
      troops: 5, mandate: 6,
      techPoint: 7, recruitToken: 8, skillBook: 9,
    });
  });

  it('零值也正确映射', () => {
    const rate = {
      grain: 0, gold: 0, ore: 0, wood: 0,
      troops: 0, mandate: 0,
      techPoint: 0, recruitToken: 0, skillBook: 0,
    };
    expect(productionRateToResources(rate)).toEqual(rate);
  });

  it('返回的是 Resources 类型（非引用）', () => {
    const rate = {
      grain: 10, gold: 20, ore: 0, wood: 0,
      troops: 0, mandate: 0,
      techPoint: 0, recruitToken: 0, skillBook: 0,
    };
    const res = productionRateToResources(rate);
    res.grain = 999;
    expect(rate.grain).toBe(10);
  });
});
