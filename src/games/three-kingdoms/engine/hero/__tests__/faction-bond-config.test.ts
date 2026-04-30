/**
 * faction-bond-config — 单元测试
 *
 * 覆盖：
 *   - 阵营羁绊等级配置完整性（4阵营 × 4等级）
 *   - 搭档羁绊配置验证（14组）
 *   - 武将阵营映射正确性
 *   - 常量边界值
 *   - 羁绊效果单调递增
 *
 * @module engine/hero/__tests__/faction-bond-config.test
 */

import { describe, it, expect } from 'vitest';
import {
  EMPTY_BOND_EFFECT,
  SHU_TIERS,
  WEI_TIERS,
  WU_TIERS,
  NEUTRAL_TIERS,
  FACTION_TIER_MAP,
  PARTNER_BOND_CONFIGS,
  HERO_FACTION_MAP,
  MAX_FACTION_TIER_COUNT,
  ALL_FACTIONS,
  FACTION_NAMES,
} from '../faction-bond-config';
import type { FactionId, BondConfig, BondEffect, FactionTierDef } from '../faction-bond-config';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

describe('常量', () => {
  it('EMPTY_BOND_EFFECT 所有加成为 0', () => {
    expect(EMPTY_BOND_EFFECT.attackBonus).toBe(0);
    expect(EMPTY_BOND_EFFECT.defenseBonus).toBe(0);
    expect(EMPTY_BOND_EFFECT.hpBonus).toBe(0);
    expect(EMPTY_BOND_EFFECT.critBonus).toBe(0);
    expect(EMPTY_BOND_EFFECT.strategyBonus).toBe(0);
  });

  it('MAX_FACTION_TIER_COUNT 为 5', () => {
    expect(MAX_FACTION_TIER_COUNT).toBe(5);
  });

  it('ALL_FACTIONS 包含 4 个阵营', () => {
    expect(ALL_FACTIONS).toHaveLength(4);
    expect(ALL_FACTIONS).toContain('wei');
    expect(ALL_FACTIONS).toContain('shu');
    expect(ALL_FACTIONS).toContain('wu');
    expect(ALL_FACTIONS).toContain('neutral');
  });

  it('FACTION_NAMES 映射完整', () => {
    expect(FACTION_NAMES.wei).toBe('魏');
    expect(FACTION_NAMES.shu).toBe('蜀');
    expect(FACTION_NAMES.wu).toBe('吴');
    expect(FACTION_NAMES.neutral).toBe('群雄');
  });
});

// ─────────────────────────────────────────────
// 阵营羁绊等级
// ─────────────────────────────────────────────

describe('阵营羁绊等级配置', () => {
  const tierSets: [string, FactionTierDef[]][] = [
    ['蜀', SHU_TIERS],
    ['魏', WEI_TIERS],
    ['吴', WU_TIERS],
    ['群雄', NEUTRAL_TIERS],
  ];

  it.each(tierSets)('%s阵营应有4个等级', (_name, tiers) => {
    expect(tiers).toHaveLength(4);
  });

  it.each(tierSets)('%s阵营等级门槛应为 [2, 3, 4, 5]', (_name, tiers) => {
    expect(tiers.map(t => t.requiredCount)).toEqual([2, 3, 4, 5]);
  });

  it.each(tierSets)('%s阵营攻击加成应单调递增', (_name, tiers) => {
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].effect.attackBonus).toBeGreaterThanOrEqual(tiers[i - 1].effect.attackBonus);
    }
  });

  it('FACTION_TIER_MAP 包含所有阵营', () => {
    expect(Object.keys(FACTION_TIER_MAP)).toHaveLength(4);
    for (const faction of ALL_FACTIONS) {
      expect(FACTION_TIER_MAP[faction]).toBeDefined();
      expect(FACTION_TIER_MAP[faction]).toHaveLength(4);
    }
  });

  it('终极羁绊应有暴击加成', () => {
    for (const faction of ALL_FACTIONS) {
      const tiers = FACTION_TIER_MAP[faction];
      const ultimate = tiers[tiers.length - 1];
      expect(ultimate.effect.critBonus).toBeGreaterThan(0);
    }
  });

  it('初级羁绊应只有攻击加成', () => {
    for (const faction of ALL_FACTIONS) {
      const tiers = FACTION_TIER_MAP[faction];
      const basic = tiers[0];
      expect(basic.effect.attackBonus).toBeGreaterThan(0);
      expect(basic.effect.defenseBonus).toBe(0);
      expect(basic.effect.hpBonus).toBe(0);
      expect(basic.effect.critBonus).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────
// 搭档羁绊
// ─────────────────────────────────────────────

describe('搭档羁绊配置', () => {
  it('应有14组搭档羁绊', () => {
    expect(PARTNER_BOND_CONFIGS).toHaveLength(14);
  });

  it('所有搭档羁绊 type 为 partner', () => {
    for (const config of PARTNER_BOND_CONFIGS) {
      expect(config.type).toBe('partner');
    }
  });

  it('所有搭档羁绊 ID 唯一', () => {
    const ids = PARTNER_BOND_CONFIGS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('所有搭档羁绊 requiredHeroes 非空', () => {
    for (const config of PARTNER_BOND_CONFIGS) {
      expect(config.requiredHeroes.length).toBeGreaterThan(0);
    }
  });

  it('minCount 不超过 requiredHeroes 长度', () => {
    for (const config of PARTNER_BOND_CONFIGS) {
      expect(config.minCount).toBeLessThanOrEqual(config.requiredHeroes.length);
    }
  });

  it('桃园结义配置正确', () => {
    const taoyuan = PARTNER_BOND_CONFIGS.find(c => c.id === 'partner_taoyuan')!;
    expect(taoyuan).toBeDefined();
    expect(taoyuan.name).toBe('桃园结义');
    expect(taoyuan.requiredHeroes).toContain('liubei');
    expect(taoyuan.requiredHeroes).toContain('guanyu');
    expect(taoyuan.requiredHeroes).toContain('zhangfei');
    expect(taoyuan.minCount).toBe(3);
    // 全属性+10%
    expect(taoyuan.effect.attackBonus).toBe(0.10);
    expect(taoyuan.effect.defenseBonus).toBe(0.10);
    expect(taoyuan.effect.hpBonus).toBe(0.10);
    expect(taoyuan.effect.critBonus).toBe(0.10);
    expect(taoyuan.effect.strategyBonus).toBe(0.10);
  });

  it('卧龙凤雏配置正确', () => {
    const wolong = PARTNER_BOND_CONFIGS.find(c => c.id === 'partner_wolong_fengchu')!;
    expect(wolong.requiredHeroes).toEqual(['zhugeliang', 'pangtong']);
    expect(wolong.effect.strategyBonus).toBe(0.20);
    expect(wolong.effect.attackBonus).toBe(0);
  });

  it('每组羁绊至少有一种加成 > 0', () => {
    for (const config of PARTNER_BOND_CONFIGS) {
      const e = config.effect;
      const hasBonus = e.attackBonus > 0 || e.defenseBonus > 0 || e.hpBonus > 0
        || e.critBonus > 0 || e.strategyBonus > 0;
      expect(hasBonus).toBe(true);
    }
  });

  it('所有搭档羁绊武将都在 HERO_FACTION_MAP 中', () => {
    for (const config of PARTNER_BOND_CONFIGS) {
      for (const heroId of config.requiredHeroes) {
        expect(HERO_FACTION_MAP[heroId]).toBeDefined();
      }
    }
  });
});

// ─────────────────────────────────────────────
// 武将阵营映射
// ─────────────────────────────────────────────

describe('HERO_FACTION_MAP', () => {
  it('映射值只能是4种阵营之一', () => {
    for (const [heroId, faction] of Object.entries(HERO_FACTION_MAP)) {
      expect(ALL_FACTIONS).toContain(faction);
    }
  });

  it('蜀国武将数量 >= 8', () => {
    const shuHeroes = Object.entries(HERO_FACTION_MAP).filter(([, f]) => f === 'shu');
    expect(shuHeroes.length).toBeGreaterThanOrEqual(8);
  });

  it('魏国武将数量 >= 8', () => {
    const weiHeroes = Object.entries(HERO_FACTION_MAP).filter(([, f]) => f === 'wei');
    expect(weiHeroes.length).toBeGreaterThanOrEqual(8);
  });

  it('吴国武将数量 >= 8', () => {
    const wuHeroes = Object.entries(HERO_FACTION_MAP).filter(([, f]) => f === 'wu');
    expect(wuHeroes.length).toBeGreaterThanOrEqual(8);
  });

  it('群雄武将数量 >= 4', () => {
    const neutralHeroes = Object.entries(HERO_FACTION_MAP).filter(([, f]) => f === 'neutral');
    expect(neutralHeroes.length).toBeGreaterThanOrEqual(4);
  });

  it('经典武将映射正确', () => {
    expect(HERO_FACTION_MAP.liubei).toBe('shu');
    expect(HERO_FACTION_MAP.caocao).toBe('wei');
    expect(HERO_FACTION_MAP.sunquan).toBe('wu');
    expect(HERO_FACTION_MAP.lvbu).toBe('neutral');
    expect(HERO_FACTION_MAP.guanyu).toBe('shu');
    expect(HERO_FACTION_MAP.zhugeliang).toBe('shu');
    expect(HERO_FACTION_MAP.zhaoyun).toBe('shu');
    expect(HERO_FACTION_MAP.zhouyu).toBe('wu');
  });
});
