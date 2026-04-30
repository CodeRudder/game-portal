/**
 * awakening-config — 单元测试
 *
 * 覆盖：
 *   - 觉醒等级上限
 *   - 觉醒条件
 *   - 觉醒消耗
 *   - 101~120 级经验表
 *   - 属性加成
 *   - 觉醒技能配置
 *   - 觉醒被动效果
 *   - 品质视觉配置
 *
 * @module engine/hero/__tests__/awakening-config.test
 */

import { describe, it, expect } from 'vitest';
import {
  AWAKENING_MAX_LEVEL,
  PRE_AWAKENING_MAX_LEVEL,
  AWAKENING_REQUIREMENTS,
  AWAKENABLE_QUALITIES,
  AWAKENING_COST,
  AWAKENING_EXP_TIERS,
  AWAKENING_EXP_TABLE,
  AWAKENING_GOLD_TABLE,
  AWAKENING_STAT_MULTIPLIER,
  AWAKENING_SKILLS,
  AWAKENING_PASSIVE,
  AWAKENING_VISUAL,
  AWAKENING_SAVE_VERSION,
} from '../awakening-config';
import { Quality } from '../hero.types';

// ─────────────────────────────────────────────
// 等级上限
// ─────────────────────────────────────────────

describe('觉醒等级上限', () => {
  it('AWAKENING_MAX_LEVEL 为 120', () => {
    expect(AWAKENING_MAX_LEVEL).toBe(120);
  });

  it('PRE_AWAKENING_MAX_LEVEL 为 100', () => {
    expect(PRE_AWAKENING_MAX_LEVEL).toBe(100);
  });

  it('觉醒后等级上限 > 觉醒前', () => {
    expect(AWAKENING_MAX_LEVEL).toBeGreaterThan(PRE_AWAKENING_MAX_LEVEL);
  });
});

// ─────────────────────────────────────────────
// 觉醒条件
// ─────────────────────────────────────────────

describe('AWAKENING_REQUIREMENTS', () => {
  it('等级要求 100', () => {
    expect(AWAKENING_REQUIREMENTS.minLevel).toBe(100);
  });

  it('星级要求 6', () => {
    expect(AWAKENING_REQUIREMENTS.minStars).toBe(6);
  });

  it('突破阶段要求 4', () => {
    expect(AWAKENING_REQUIREMENTS.minBreakthrough).toBe(4);
  });

  it('最低品质 >= RARE', () => {
    expect(AWAKENING_REQUIREMENTS.minQualityOrder).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────
// 可觉醒品质
// ─────────────────────────────────────────────

describe('AWAKENABLE_QUALITIES', () => {
  it('应包含 3 种品质', () => {
    expect(AWAKENABLE_QUALITIES).toHaveLength(3);
  });

  it('应包含 RARE, EPIC, LEGENDARY', () => {
    expect(AWAKENABLE_QUALITIES).toContain(Quality.RARE);
    expect(AWAKENABLE_QUALITIES).toContain(Quality.EPIC);
    expect(AWAKENABLE_QUALITIES).toContain(Quality.LEGENDARY);
  });

  it('不应包含 COMMON 和 FINE', () => {
    expect(AWAKENABLE_QUALITIES).not.toContain(Quality.COMMON);
    expect(AWAKENABLE_QUALITIES).not.toContain(Quality.FINE);
  });
});

// ─────────────────────────────────────────────
// 觉醒消耗
// ─────────────────────────────────────────────

describe('AWAKENING_COST', () => {
  it('铜钱消耗 500000', () => {
    expect(AWAKENING_COST.copper).toBe(500000);
  });

  it('突破石消耗 100', () => {
    expect(AWAKENING_COST.breakthroughStones).toBe(100);
  });

  it('技能书消耗 50', () => {
    expect(AWAKENING_COST.skillBooks).toBe(50);
  });

  it('觉醒石消耗 30', () => {
    expect(AWAKENING_COST.awakeningStones).toBe(30);
  });

  it('碎片消耗 200', () => {
    expect(AWAKENING_COST.fragments).toBe(200);
  });

  it('所有消耗应 > 0', () => {
    for (const val of Object.values(AWAKENING_COST)) {
      expect(val).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────
// 101~120 级经验表
// ─────────────────────────────────────────────

describe('AWAKENING_EXP_TIERS', () => {
  it('应有 4 个等级段', () => {
    expect(AWAKENING_EXP_TIERS).toHaveLength(4);
  });

  it('覆盖 101~120 级', () => {
    expect(AWAKENING_EXP_TIERS[0].levelMin).toBe(101);
    expect(AWAKENING_EXP_TIERS[AWAKENING_EXP_TIERS.length - 1].levelMax).toBe(120);
  });

  it('等级段无重叠且连续', () => {
    for (let i = 1; i < AWAKENING_EXP_TIERS.length; i++) {
      expect(AWAKENING_EXP_TIERS[i].levelMin).toBe(AWAKENING_EXP_TIERS[i - 1].levelMax + 1);
    }
  });

  it('经验系数应单调递增', () => {
    for (let i = 1; i < AWAKENING_EXP_TIERS.length; i++) {
      expect(AWAKENING_EXP_TIERS[i].expPerLevel).toBeGreaterThan(AWAKENING_EXP_TIERS[i - 1].expPerLevel);
    }
  });
});

describe('AWAKENING_EXP_TABLE', () => {
  it('应有 20 个等级 (101~120)', () => {
    expect(Object.keys(AWAKENING_EXP_TABLE)).toHaveLength(20);
  });

  it('每个等级的经验需求 > 0', () => {
    for (const [level, exp] of Object.entries(AWAKENING_EXP_TABLE)) {
      expect(exp).toBeGreaterThan(0);
    }
  });

  it('经验需求应单调递增', () => {
    let prevExp = 0;
    for (let lv = 101; lv <= 120; lv++) {
      const exp = AWAKENING_EXP_TABLE[lv];
      expect(exp).toBeGreaterThan(prevExp);
      prevExp = exp;
    }
  });
});

describe('AWAKENING_GOLD_TABLE', () => {
  it('应有 20 个等级 (101~120)', () => {
    expect(Object.keys(AWAKENING_GOLD_TABLE)).toHaveLength(20);
  });

  it('每个等级的铜钱消耗 > 0', () => {
    for (const [, gold] of Object.entries(AWAKENING_GOLD_TABLE)) {
      expect(gold).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────
// 属性加成
// ─────────────────────────────────────────────

describe('AWAKENING_STAT_MULTIPLIER', () => {
  it('应为 1.5（全属性+50%）', () => {
    expect(AWAKENING_STAT_MULTIPLIER).toBe(1.5);
  });

  it('倍率应 > 1', () => {
    expect(AWAKENING_STAT_MULTIPLIER).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────
// 觉醒技能
// ─────────────────────────────────────────────

describe('AWAKENING_SKILLS', () => {
  it('应至少有 12 个武将觉醒技能', () => {
    expect(Object.keys(AWAKENING_SKILLS).length).toBeGreaterThanOrEqual(12);
  });

  it('每个技能应有唯一 ID', () => {
    const ids = Object.values(AWAKENING_SKILLS).map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每个技能应有名称和描述', () => {
    for (const [, skill] of Object.entries(AWAKENING_SKILLS)) {
      expect(skill.name).toBeTruthy();
      expect(skill.description).toBeTruthy();
    }
  });

  it('每个技能冷却应在 5~8 回合', () => {
    for (const [, skill] of Object.entries(AWAKENING_SKILLS)) {
      expect(skill.cooldown).toBeGreaterThanOrEqual(5);
      expect(skill.cooldown).toBeLessThanOrEqual(8);
    }
  });

  it('关羽觉醒技能配置正确', () => {
    const skill = AWAKENING_SKILLS.guanyu;
    expect(skill).toBeDefined();
    expect(skill.damageMultiplier).toBe(3.0);
    expect(skill.cooldown).toBe(5);
  });

  it('吕布觉醒技能配置正确', () => {
    const skill = AWAKENING_SKILLS.lvbu;
    expect(skill).toBeDefined();
    expect(skill.damageMultiplier).toBe(4.0);
    expect(skill.cooldown).toBe(8);
  });

  it('伤害倍率应 >= 0', () => {
    for (const [, skill] of Object.entries(AWAKENING_SKILLS)) {
      expect(skill.damageMultiplier).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─────────────────────────────────────────────
// 觉醒被动效果
// ─────────────────────────────────────────────

describe('AWAKENING_PASSIVE', () => {
  it('阵营攻击加成 3%', () => {
    expect(AWAKENING_PASSIVE.factionAtkBonus).toBe(0.03);
  });

  it('阵营最大叠加 3 次', () => {
    expect(AWAKENING_PASSIVE.factionMaxStacks).toBe(3);
  });

  it('全局属性加成 1%', () => {
    expect(AWAKENING_PASSIVE.globalStatBonus).toBe(0.01);
  });

  it('全局最大叠加 5 次', () => {
    expect(AWAKENING_PASSIVE.globalMaxStacks).toBe(5);
  });

  it('所有加成比例应 > 0', () => {
    expect(AWAKENING_PASSIVE.factionAtkBonus).toBeGreaterThan(0);
    expect(AWAKENING_PASSIVE.globalStatBonus).toBeGreaterThan(0);
    expect(AWAKENING_PASSIVE.resourceBonus).toBeGreaterThan(0);
    expect(AWAKENING_PASSIVE.expBonus).toBeGreaterThan(0);
  });

  it('所有最大叠加次数应 > 0', () => {
    expect(AWAKENING_PASSIVE.factionMaxStacks).toBeGreaterThan(0);
    expect(AWAKENING_PASSIVE.globalMaxStacks).toBeGreaterThan(0);
    expect(AWAKENING_PASSIVE.resourceMaxStacks).toBeGreaterThan(0);
    expect(AWAKENING_PASSIVE.expMaxStacks).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// 品质视觉配置
// ─────────────────────────────────────────────

describe('AWAKENING_VISUAL', () => {
  it('应包含所有 5 种品质', () => {
    expect(Object.keys(AWAKENING_VISUAL)).toHaveLength(5);
    for (const q of Object.values(Quality)) {
      expect(AWAKENING_VISUAL[q]).toBeDefined();
    }
  });

  it('COMMON 和 FINE 不可觉醒', () => {
    expect(AWAKENING_VISUAL[Quality.COMMON].effect).toBe('不可觉醒');
    expect(AWAKENING_VISUAL[Quality.FINE].effect).toBe('不可觉醒');
  });

  it('RARE 及以上应有视觉升级', () => {
    for (const q of AWAKENABLE_QUALITIES) {
      expect(AWAKENING_VISUAL[q].effect).not.toBe('不可觉醒');
      expect(AWAKENING_VISUAL[q].borderStyle).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────
// 存档版本
// ─────────────────────────────────────────────

describe('AWAKENING_SAVE_VERSION', () => {
  it('应为正整数', () => {
    expect(AWAKENING_SAVE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(AWAKENING_SAVE_VERSION)).toBe(true);
  });
});
