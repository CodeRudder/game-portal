/**
 * hero-config — 单元测试
 *
 * 覆盖：
 *   - 品质倍率表完整性
 *   - 升级经验表连续性和单调递增
 *   - 重复武将碎片转化表
 *   - 升星碎片消耗表
 *   - 战力计算系数
 *   - 武将定义数据完整性
 *   - GENERAL_DEF_MAP 查找表
 *
 * @module engine/hero/__tests__/hero-config.test
 */

import { describe, it, expect } from 'vitest';
import {
  QUALITY_MULTIPLIERS,
  LEVEL_EXP_TABLE,
  HERO_MAX_LEVEL,
  DUPLICATE_FRAGMENT_COUNT,
  STAR_UP_FRAGMENT_COST,
  MAX_STAR_LEVEL,
  SYNTHESIZE_REQUIRED_FRAGMENTS,
  POWER_WEIGHTS,
  LEVEL_COEFFICIENT_PER_LEVEL,
  HERO_SAVE_VERSION,
  GENERAL_DEFS,
  GENERAL_DEF_MAP,
} from '../hero-config';
import { Quality } from '../hero.types';

// ─────────────────────────────────────────────
// 品质倍率表
// ─────────────────────────────────────────────

describe('QUALITY_MULTIPLIERS', () => {
  it('应包含所有品质', () => {
    expect(Object.keys(QUALITY_MULTIPLIERS)).toHaveLength(5);
    for (const q of Object.values(Quality)) {
      expect(QUALITY_MULTIPLIERS[q]).toBeDefined();
    }
  });

  it('倍率应单调递增', () => {
    const qualities = [Quality.COMMON, Quality.FINE, Quality.RARE, Quality.EPIC, Quality.LEGENDARY];
    for (let i = 1; i < qualities.length; i++) {
      expect(QUALITY_MULTIPLIERS[qualities[i]]).toBeGreaterThan(QUALITY_MULTIPLIERS[qualities[i - 1]]);
    }
  });

  it('COMMON 倍率为 1.0', () => {
    expect(QUALITY_MULTIPLIERS[Quality.COMMON]).toBe(1.0);
  });

  it('LEGENDARY 倍率为 1.8', () => {
    expect(QUALITY_MULTIPLIERS[Quality.LEGENDARY]).toBe(1.8);
  });
});

// ─────────────────────────────────────────────
// 升级经验表
// ─────────────────────────────────────────────

describe('LEVEL_EXP_TABLE', () => {
  it('应覆盖 1~100 级', () => {
    let totalLevels = 0;
    for (const tier of LEVEL_EXP_TABLE) {
      totalLevels += tier.levelMax - tier.levelMin + 1;
    }
    expect(totalLevels).toBe(100);
  });

  it('等级段应无重叠且连续', () => {
    for (let i = 1; i < LEVEL_EXP_TABLE.length; i++) {
      expect(LEVEL_EXP_TABLE[i].levelMin).toBe(LEVEL_EXP_TABLE[i - 1].levelMax + 1);
    }
  });

  it('经验需求应单调递增', () => {
    for (let i = 1; i < LEVEL_EXP_TABLE.length; i++) {
      expect(LEVEL_EXP_TABLE[i].expPerLevel).toBeGreaterThanOrEqual(LEVEL_EXP_TABLE[i - 1].expPerLevel);
    }
  });

  it('铜钱消耗应单调递增', () => {
    for (let i = 1; i < LEVEL_EXP_TABLE.length; i++) {
      expect(LEVEL_EXP_TABLE[i].goldPerLevel).toBeGreaterThanOrEqual(LEVEL_EXP_TABLE[i - 1].goldPerLevel);
    }
  });

  it('第一段 (Lv1~10) 经验需求为 50/级', () => {
    expect(LEVEL_EXP_TABLE[0].expPerLevel).toBe(50);
  });

  it('最后一段 (Lv91~100) 经验需求为 9000/级', () => {
    const last = LEVEL_EXP_TABLE[LEVEL_EXP_TABLE.length - 1];
    expect(last.expPerLevel).toBe(9000);
    expect(last.levelMin).toBe(91);
    expect(last.levelMax).toBe(100);
  });
});

// ─────────────────────────────────────────────
// 重复武将碎片转化
// ─────────────────────────────────────────────

describe('DUPLICATE_FRAGMENT_COUNT', () => {
  it('应包含所有品质', () => {
    for (const q of Object.values(Quality)) {
      expect(DUPLICATE_FRAGMENT_COUNT[q]).toBeDefined();
    }
  });

  it('品质越高碎片越多', () => {
    const qualities = [Quality.COMMON, Quality.FINE, Quality.RARE, Quality.EPIC, Quality.LEGENDARY];
    for (let i = 1; i < qualities.length; i++) {
      expect(DUPLICATE_FRAGMENT_COUNT[qualities[i]]).toBeGreaterThan(DUPLICATE_FRAGMENT_COUNT[qualities[i - 1]]);
    }
  });

  it('COMMON = 5, LEGENDARY = 80', () => {
    expect(DUPLICATE_FRAGMENT_COUNT[Quality.COMMON]).toBe(5);
    expect(DUPLICATE_FRAGMENT_COUNT[Quality.LEGENDARY]).toBe(80);
  });
});

// ─────────────────────────────────────────────
// 升星碎片消耗
// ─────────────────────────────────────────────

describe('STAR_UP_FRAGMENT_COST', () => {
  it('应有 6 个等级（0→5 星）', () => {
    expect(STAR_UP_FRAGMENT_COST).toHaveLength(6);
  });

  it('0→1 星消耗为 0', () => {
    expect(STAR_UP_FRAGMENT_COST[0]).toBe(0);
  });

  it('消耗应单调递增', () => {
    for (let i = 1; i < STAR_UP_FRAGMENT_COST.length; i++) {
      expect(STAR_UP_FRAGMENT_COST[i]).toBeGreaterThan(STAR_UP_FRAGMENT_COST[i - 1]);
    }
  });

  it('5→6 星消耗为 300', () => {
    expect(STAR_UP_FRAGMENT_COST[5]).toBe(300);
  });
});

// ─────────────────────────────────────────────
// MAX_STAR_LEVEL
// ─────────────────────────────────────────────

describe('MAX_STAR_LEVEL', () => {
  it('应为 6', () => {
    expect(MAX_STAR_LEVEL).toBe(6);
  });
});

// ─────────────────────────────────────────────
// 合成所需碎片
// ─────────────────────────────────────────────

describe('SYNTHESIZE_REQUIRED_FRAGMENTS', () => {
  it('应包含所有品质', () => {
    for (const q of Object.values(Quality)) {
      expect(SYNTHESIZE_REQUIRED_FRAGMENTS[q]).toBeDefined();
    }
  });

  it('品质越高所需碎片越多', () => {
    const qualities = [Quality.COMMON, Quality.FINE, Quality.RARE, Quality.EPIC, Quality.LEGENDARY];
    for (let i = 1; i < qualities.length; i++) {
      expect(SYNTHESIZE_REQUIRED_FRAGMENTS[qualities[i]]).toBeGreaterThan(SYNTHESIZE_REQUIRED_FRAGMENTS[qualities[i - 1]]);
    }
  });
});

// ─────────────────────────────────────────────
// 战力计算系数
// ─────────────────────────────────────────────

describe('POWER_WEIGHTS', () => {
  it('应包含 4 个属性权重', () => {
    expect(Object.keys(POWER_WEIGHTS)).toHaveLength(4);
    expect(POWER_WEIGHTS.attack).toBeDefined();
    expect(POWER_WEIGHTS.defense).toBeDefined();
    expect(POWER_WEIGHTS.intelligence).toBeDefined();
    expect(POWER_WEIGHTS.speed).toBeDefined();
  });

  it('攻击和智力权重最高 (2.0)', () => {
    expect(POWER_WEIGHTS.attack).toBe(2.0);
    expect(POWER_WEIGHTS.intelligence).toBe(2.0);
  });

  it('统率权重 1.5', () => {
    expect(POWER_WEIGHTS.defense).toBe(1.5);
  });

  it('政治权重 1.0', () => {
    expect(POWER_WEIGHTS.speed).toBe(1.0);
  });

  it('所有权重应 > 0', () => {
    for (const w of Object.values(POWER_WEIGHTS)) {
      expect(w).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────
// HERO_MAX_LEVEL
// ─────────────────────────────────────────────

describe('HERO_MAX_LEVEL', () => {
  it('应为 50', () => {
    expect(HERO_MAX_LEVEL).toBe(50);
  });
});

// ─────────────────────────────────────────────
// HERO_SAVE_VERSION
// ─────────────────────────────────────────────

describe('HERO_SAVE_VERSION', () => {
  it('应为正整数', () => {
    expect(HERO_SAVE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(HERO_SAVE_VERSION)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// GENERAL_DEFS 武将定义
// ─────────────────────────────────────────────

describe('GENERAL_DEFS', () => {
  it('应至少有 15 个武将', () => {
    expect(GENERAL_DEFS.length).toBeGreaterThanOrEqual(15);
  });

  it('所有武将 ID 唯一', () => {
    const ids = GENERAL_DEFS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每个武将应有 4 维基础属性', () => {
    for (const def of GENERAL_DEFS) {
      expect(def.baseStats.attack).toBeGreaterThan(0);
      expect(def.baseStats.defense).toBeGreaterThan(0);
      expect(def.baseStats.intelligence).toBeGreaterThanOrEqual(0);
      expect(def.baseStats.speed).toBeGreaterThan(0);
    }
  });

  it('每个武将至少有 1 个技能', () => {
    for (const def of GENERAL_DEFS) {
      expect(def.skills.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('品质分布应覆盖至少 3 种品质', () => {
    const qualities = new Set(GENERAL_DEFS.map(d => d.quality));
    expect(qualities.size).toBeGreaterThanOrEqual(3);
  });

  it('阵营分布应覆盖至少 3 个阵营', () => {
    const factions = new Set(GENERAL_DEFS.map(d => d.faction));
    expect(factions.size).toBeGreaterThanOrEqual(3);
  });

  it('传说武将最高属性应在 100~130 范围内', () => {
    const legends = GENERAL_DEFS.filter(d => d.quality === Quality.LEGENDARY);
    for (const legend of legends) {
      const maxStat = Math.max(
        legend.baseStats.attack,
        legend.baseStats.defense,
        legend.baseStats.intelligence,
        legend.baseStats.speed,
      );
      expect(maxStat).toBeGreaterThanOrEqual(100);
      expect(maxStat).toBeLessThanOrEqual(130);
    }
  });

  it('经典武将存在', () => {
    const ids = GENERAL_DEFS.map(d => d.id);
    expect(ids).toContain('liubei');
    expect(ids).toContain('guanyu');
    expect(ids).toContain('zhangfei');
    expect(ids).toContain('zhugeliang');
    expect(ids).toContain('lvbu');
  });
});

// ─────────────────────────────────────────────
// GENERAL_DEF_MAP 查找表
// ─────────────────────────────────────────────

describe('GENERAL_DEF_MAP', () => {
  it('大小应等于 GENERAL_DEFS', () => {
    expect(GENERAL_DEF_MAP.size).toBe(GENERAL_DEFS.length);
  });

  it('可通过 ID 查找到武将', () => {
    const liubei = GENERAL_DEF_MAP.get('liubei');
    expect(liubei).toBeDefined();
    expect(liubei!.name).toBe('刘备');
  });

  it('查找不存在的 ID 返回 undefined', () => {
    expect(GENERAL_DEF_MAP.get('nonexistent_hero')).toBeUndefined();
  });
});
