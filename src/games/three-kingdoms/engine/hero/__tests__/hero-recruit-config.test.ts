/**
 * hero-recruit-config — 单元测试
 *
 * 覆盖：
 *   - 招募消耗配置
 *   - 概率表完整性和概率和为 1
 *   - 保底配置
 *   - UP 武将配置
 *   - 每日免费招募
 *   - 重复武将碎片转化
 *
 * @module engine/hero/__tests__/hero-recruit-config.test
 */

import { describe, it, expect } from 'vitest';
import {
  RECRUIT_COSTS,
  NORMAL_RATES,
  ADVANCED_RATES,
  RECRUIT_RATES,
  NORMAL_PITY,
  ADVANCED_PITY,
  RECRUIT_PITY,
  DEFAULT_UP_CONFIG,
  UP_HERO_DESCRIPTIONS,
  DAILY_FREE_CONFIG,
  DUPLICATE_FRAGMENT_REWARD,
  RECRUIT_SAVE_VERSION,
} from '../hero-recruit-config';
import { Quality } from '../hero.types';

// ─────────────────────────────────────────────
// 招募消耗
// ─────────────────────────────────────────────

describe('RECRUIT_COSTS', () => {
  it('应包含 normal 和 advanced 两种类型', () => {
    expect(RECRUIT_COSTS.normal).toBeDefined();
    expect(RECRUIT_COSTS.advanced).toBeDefined();
  });

  it('普通招募消耗招贤令', () => {
    expect(RECRUIT_COSTS.normal.resourceType).toBe('recruitToken');
    expect(RECRUIT_COSTS.normal.amount).toBeGreaterThan(0);
  });

  it('高级招募消耗招贤令', () => {
    expect(RECRUIT_COSTS.advanced.resourceType).toBe('recruitToken');
    expect(RECRUIT_COSTS.advanced.amount).toBeGreaterThan(0);
  });

  it('高级招募消耗 > 普通招募消耗', () => {
    expect(RECRUIT_COSTS.advanced.amount).toBeGreaterThan(RECRUIT_COSTS.normal.amount);
  });
});

// ─────────────────────────────────────────────
// 概率表
// ─────────────────────────────────────────────

describe('NORMAL_RATES', () => {
  it('应包含 5 种品质', () => {
    expect(NORMAL_RATES).toHaveLength(5);
  });

  it('概率之和应为 1', () => {
    const sum = NORMAL_RATES.reduce((acc, r) => acc + r.rate, 0);
    expect(sum).toBeCloseTo(1.0, 6);
  });

  it('普通招募传说概率为 0', () => {
    const legendary = NORMAL_RATES.find(r => r.quality === Quality.LEGENDARY);
    expect(legendary?.rate).toBe(0);
  });

  it('普通品质概率最高', () => {
    const commonRate = NORMAL_RATES.find(r => r.quality === Quality.COMMON)!.rate;
    for (const r of NORMAL_RATES) {
      expect(commonRate).toBeGreaterThanOrEqual(r.rate);
    }
  });
});

describe('ADVANCED_RATES', () => {
  it('应包含 5 种品质', () => {
    expect(ADVANCED_RATES).toHaveLength(5);
  });

  it('概率之和应为 1', () => {
    const sum = ADVANCED_RATES.reduce((acc, r) => acc + r.rate, 0);
    expect(sum).toBeCloseTo(1.0, 6);
  });

  it('高级招募传说概率 > 0', () => {
    const legendary = ADVANCED_RATES.find(r => r.quality === Quality.LEGENDARY);
    expect(legendary?.rate).toBeGreaterThan(0);
  });

  it('高级招募稀有+概率 > 普通招募', () => {
    const advRareRate = ADVANCED_RATES.filter(r =>
      [Quality.RARE, Quality.EPIC, Quality.LEGENDARY].includes(r.quality)
    ).reduce((acc, r) => acc + r.rate, 0);
    const normalRareRate = NORMAL_RATES.filter(r =>
      [Quality.RARE, Quality.EPIC, Quality.LEGENDARY].includes(r.quality)
    ).reduce((acc, r) => acc + r.rate, 0);
    expect(advRareRate).toBeGreaterThan(normalRareRate);
  });
});

describe('RECRUIT_RATES', () => {
  it('应包含 normal 和 advanced', () => {
    expect(RECRUIT_RATES.normal).toBeDefined();
    expect(RECRUIT_RATES.advanced).toBeDefined();
  });

  it('normal 指向 NORMAL_RATES', () => {
    expect(RECRUIT_RATES.normal).toBe(NORMAL_RATES);
  });

  it('advanced 指向 ADVANCED_RATES', () => {
    expect(RECRUIT_RATES.advanced).toBe(ADVANCED_RATES);
  });
});

// ─────────────────────────────────────────────
// 保底配置
// ─────────────────────────────────────────────

describe('NORMAL_PITY', () => {
  it('十连保底阈值为 10', () => {
    expect(NORMAL_PITY.tenPullThreshold).toBe(10);
  });

  it('十连保底最低品质为 RARE', () => {
    expect(NORMAL_PITY.tenPullMinQuality).toBe(Quality.RARE);
  });

  it('普通池无硬保底（Infinity）', () => {
    expect(NORMAL_PITY.hardPityThreshold).toBe(Infinity);
  });
});

describe('ADVANCED_PITY', () => {
  it('十连保底阈值为 10', () => {
    expect(ADVANCED_PITY.tenPullThreshold).toBe(10);
  });

  it('十连保底最低品质为 RARE', () => {
    expect(ADVANCED_PITY.tenPullMinQuality).toBe(Quality.RARE);
  });

  it('硬保底阈值为 100', () => {
    expect(ADVANCED_PITY.hardPityThreshold).toBe(100);
  });

  it('硬保底最低品质为 LEGENDARY', () => {
    expect(ADVANCED_PITY.hardPityMinQuality).toBe(Quality.LEGENDARY);
  });
});

describe('RECRUIT_PITY', () => {
  it('应包含 normal 和 advanced', () => {
    expect(RECRUIT_PITY.normal).toBe(NORMAL_PITY);
    expect(RECRUIT_PITY.advanced).toBe(ADVANCED_PITY);
  });
});

// ─────────────────────────────────────────────
// UP 武将配置
// ─────────────────────────────────────────────

describe('DEFAULT_UP_CONFIG', () => {
  it('默认无 UP 武将', () => {
    expect(DEFAULT_UP_CONFIG.upGeneralId).toBeNull();
  });

  it('UP 概率为 50%', () => {
    expect(DEFAULT_UP_CONFIG.upRate).toBe(0.50);
  });
});

describe('UP_HERO_DESCRIPTIONS', () => {
  it('应至少有 8 个武将描述', () => {
    expect(Object.keys(UP_HERO_DESCRIPTIONS).length).toBeGreaterThanOrEqual(8);
  });

  it('每个描述非空', () => {
    for (const [heroId, desc] of Object.entries(UP_HERO_DESCRIPTIONS)) {
      expect(desc).toBeTruthy();
      expect(desc.length).toBeGreaterThan(0);
    }
  });

  it('描述中应包含"UP"关键词', () => {
    for (const desc of Object.values(UP_HERO_DESCRIPTIONS)) {
      expect(desc).toContain('UP');
    }
  });

  it('经典武将应有描述', () => {
    expect(UP_HERO_DESCRIPTIONS.guanyu).toBeDefined();
    expect(UP_HERO_DESCRIPTIONS.zhugeliang).toBeDefined();
    expect(UP_HERO_DESCRIPTIONS.lvbu).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// 每日免费招募
// ─────────────────────────────────────────────

describe('DAILY_FREE_CONFIG', () => {
  it('普通招募每日 1 次免费', () => {
    expect(DAILY_FREE_CONFIG.normal.freeCount).toBe(1);
  });

  it('高级招募无免费次数', () => {
    expect(DAILY_FREE_CONFIG.advanced.freeCount).toBe(0);
  });
});

// ─────────────────────────────────────────────
// 重复碎片转化
// ─────────────────────────────────────────────

describe('DUPLICATE_FRAGMENT_REWARD', () => {
  it('应包含所有品质', () => {
    for (const q of Object.values(Quality)) {
      expect(DUPLICATE_FRAGMENT_REWARD[q]).toBeDefined();
    }
  });

  it('品质越高碎片越多', () => {
    expect(DUPLICATE_FRAGMENT_REWARD[Quality.LEGENDARY]).toBeGreaterThan(
      DUPLICATE_FRAGMENT_REWARD[Quality.COMMON],
    );
  });
});

// ─────────────────────────────────────────────
// 存档版本
// ─────────────────────────────────────────────

describe('RECRUIT_SAVE_VERSION', () => {
  it('应为正整数', () => {
    expect(RECRUIT_SAVE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(RECRUIT_SAVE_VERSION)).toBe(true);
  });
});
