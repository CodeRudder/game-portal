/**
 * hero/star-up-config.ts 单元测试
 *
 * 覆盖导出函数：
 * - getStarMultiplier
 *
 * 验证常量：
 * - STAR_UP_GOLD_COST
 * - STAR_MULTIPLIERS
 * - BREAKTHROUGH_TIERS
 * - MAX_BREAKTHROUGH_STAGE
 * - INITIAL_LEVEL_CAP / FINAL_LEVEL_CAP
 */

import { describe, it, expect } from 'vitest';
import {
  STAR_UP_GOLD_COST,
  STAR_MULTIPLIERS,
  getStarMultiplier,
  BREAKTHROUGH_TIERS,
  MAX_BREAKTHROUGH_STAGE,
  INITIAL_LEVEL_CAP,
  FINAL_LEVEL_CAP,
} from '../star-up-config';

// ═══════════════════════════════════════════
// getStarMultiplier
// ═══════════════════════════════════════════
describe('getStarMultiplier', () => {
  it('星级1 → 1.0（基础倍率）', () => {
    expect(getStarMultiplier(1)).toBe(1.0);
  });

  it('星级2 → 1.15', () => {
    expect(getStarMultiplier(2)).toBe(1.15);
  });

  it('星级3 → 1.35', () => {
    expect(getStarMultiplier(3)).toBe(1.35);
  });

  it('星级4 → 1.6', () => {
    expect(getStarMultiplier(4)).toBe(1.6);
  });

  it('星级5 → 2.0', () => {
    expect(getStarMultiplier(5)).toBe(2.0);
  });

  it('星级6 → 2.5（满星）', () => {
    expect(getStarMultiplier(6)).toBe(2.5);
  });

  it('星级0 → 返回首个倍率', () => {
    expect(getStarMultiplier(0)).toBe(STAR_MULTIPLIERS[0]);
  });

  it('负数星级 → 返回首个倍率', () => {
    expect(getStarMultiplier(-1)).toBe(STAR_MULTIPLIERS[0]);
  });

  it('超出最大星级 → 返回末尾倍率', () => {
    expect(getStarMultiplier(100)).toBe(STAR_MULTIPLIERS[STAR_MULTIPLIERS.length - 1]);
  });

  it('倍率随星级递增', () => {
    for (let i = 2; i <= 6; i++) {
      expect(getStarMultiplier(i)).toBeGreaterThan(getStarMultiplier(i - 1));
    }
  });

  it('所有合法星级返回正数', () => {
    for (let i = 1; i <= 6; i++) {
      expect(getStarMultiplier(i)).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════
// STAR_UP_GOLD_COST
// ═══════════════════════════════════════════
describe('STAR_UP_GOLD_COST', () => {
  it('长度至少为6（0→1到5→6）', () => {
    expect(STAR_UP_GOLD_COST.length).toBeGreaterThanOrEqual(6);
  });

  it('第一个为0（初始无消耗）', () => {
    expect(STAR_UP_GOLD_COST[0]).toBe(0);
  });

  it('消耗递增', () => {
    for (let i = 2; i < STAR_UP_GOLD_COST.length; i++) {
      expect(STAR_UP_GOLD_COST[i]).toBeGreaterThan(STAR_UP_GOLD_COST[i - 1]);
    }
  });

  it('所有值为非负数', () => {
    for (const cost of STAR_UP_GOLD_COST) {
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═══════════════════════════════════════════
// STAR_MULTIPLIERS
// ═══════════════════════════════════════════
describe('STAR_MULTIPLIERS', () => {
  it('长度 >= 7（索引0占位 + 1~6星）', () => {
    expect(STAR_MULTIPLIERS.length).toBeGreaterThanOrEqual(7);
  });

  it('所有倍率 >= 1.0', () => {
    for (const m of STAR_MULTIPLIERS) {
      expect(m).toBeGreaterThanOrEqual(1.0);
    }
  });
});

// ═══════════════════════════════════════════
// BREAKTHROUGH_TIERS
// ═══════════════════════════════════════════
describe('BREAKTHROUGH_TIERS', () => {
  it('非空', () => {
    expect(BREAKTHROUGH_TIERS.length).toBeGreaterThan(0);
  });

  it('levelCapAfter > levelCapBefore', () => {
    for (const tier of BREAKTHROUGH_TIERS) {
      expect(tier.levelCapAfter).toBeGreaterThan(tier.levelCapBefore);
    }
  });

  it('阶段的 levelCapBefore 递增', () => {
    for (let i = 1; i < BREAKTHROUGH_TIERS.length; i++) {
      expect(BREAKTHROUGH_TIERS[i].levelCapBefore).toBeGreaterThan(
        BREAKTHROUGH_TIERS[i - 1].levelCapBefore,
      );
    }
  });

  it('每项有 name', () => {
    for (const tier of BREAKTHROUGH_TIERS) {
      expect(tier.name).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════
// 突破常量
// ═══════════════════════════════════════════
describe('突破常量', () => {
  it('MAX_BREAKTHROUGH_STAGE > 0', () => {
    expect(MAX_BREAKTHROUGH_STAGE).toBeGreaterThan(0);
  });

  it('INITIAL_LEVEL_CAP < FINAL_LEVEL_CAP', () => {
    expect(INITIAL_LEVEL_CAP).toBeLessThan(FINAL_LEVEL_CAP);
  });

  it('INITIAL_LEVEL_CAP > 0', () => {
    expect(INITIAL_LEVEL_CAP).toBeGreaterThan(0);
  });
});
