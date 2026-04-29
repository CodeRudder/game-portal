/**
 * EquipmentGenerator 单元测试
 *
 * 覆盖：UID生成、种子随机工具、装备生成（按部位/模板）、属性生成
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateUid,
  resetUidCounter,
  randInt,
  randFloat,
  seedPick,
  weightedPickRarity,
  isSlot,
  generateBySlot,
  generateByTemplate,
  genMainStat,
  genSubStats,
  genSpecialEffect,
} from '../EquipmentGenerator';
import type { EquipmentSlot, EquipmentRarity, EquipmentSource } from '../../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  RARITY_MAIN_STAT_MULTIPLIER,
  RARITY_SUB_STAT_MULTIPLIER,
  RARITY_SUB_STAT_COUNT,
  RARITY_SPECIAL_EFFECT_CHANCE,
  SLOT_MAIN_STAT_TYPE,
  SLOT_MAIN_STAT_BASE,
  SLOT_SUB_STAT_POOL,
  SLOT_SPECIAL_EFFECT_POOL,
  SLOT_NAME_PREFIXES,
  RARITY_NAME_PREFIX,
  TEMPLATE_MAP,
} from '../../../core/equipment';

// ═══════════════════════════════════════════════════
// UID 生成
// ═══════════════════════════════════════════════════

describe('EquipmentGenerator — UID 生成', () => {
  beforeEach(() => {
    resetUidCounter();
  });

  it('generateUid 应返回以 "eq_" 开头的字符串', () => {
    const uid = generateUid();
    expect(uid).toMatch(/^eq_/);
  });

  it('generateUid 应生成唯一值', () => {
    const uid1 = generateUid();
    const uid2 = generateUid();
    expect(uid1).not.toBe(uid2);
  });

  it('resetUidCounter 应重置计数器', () => {
    generateUid();
    generateUid();
    resetUidCounter();
    // 重置后计数器归零，但 uid 中含时间戳和随机部分，仍唯一
    const uid = generateUid();
    expect(uid).toMatch(/^eq_/);
  });
});

// ═══════════════════════════════════════════════════
// 种子随机工具
// ═══════════════════════════════════════════════════

describe('EquipmentGenerator — 种子随机工具', () => {
  describe('randInt', () => {
    it('应在 [min, max] 范围内返回整数', () => {
      for (let seed = 0; seed < 100; seed++) {
        const result = randInt(5, 10, seed);
        expect(result).toBeGreaterThanOrEqual(5);
        expect(result).toBeLessThanOrEqual(10);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('min === max 时应返回该值', () => {
      expect(randInt(7, 7, 42)).toBe(7);
      expect(randInt(0, 0, 999)).toBe(0);
    });

    it('相同种子应返回相同结果（确定性）', () => {
      const r1 = randInt(1, 100, 12345);
      const r2 = randInt(1, 100, 12345);
      expect(r1).toBe(r2);
    });
  });

  describe('randFloat', () => {
    it('应在 [min, max] 范围内返回浮点数', () => {
      for (let seed = 0; seed < 100; seed++) {
        const result = randFloat(1.0, 5.0, seed);
        expect(result).toBeGreaterThanOrEqual(1.0);
        expect(result).toBeLessThanOrEqual(5.0);
      }
    });

    it('相同种子应返回相同结果', () => {
      const r1 = randFloat(0, 10, 42);
      const r2 = randFloat(0, 10, 42);
      expect(r1).toBe(r2);
    });
  });

  describe('seedPick', () => {
    it('应从数组中选取一个元素', () => {
      const arr = ['a', 'b', 'c', 'd'];
      const result = seedPick(arr, 2);
      expect(arr).toContain(result);
    });

    it('相同种子应返回相同元素', () => {
      const arr = ['x', 'y', 'z'];
      expect(seedPick(arr, 7)).toBe(seedPick(arr, 7));
    });

    it('空数组时应返回 undefined', () => {
      const result = seedPick([], 0);
      expect(result).toBeUndefined();
    });
  });

  describe('weightedPickRarity', () => {
    it('应在权重非零时返回有效 key', () => {
      const weights = { green: 50, blue: 30, purple: 20 };
      const result = weightedPickRarity(weights, 42);
      expect(['green', 'blue', 'purple']).toContain(result);
    });

    it('所有权重为 0 时应返回第一个 key', () => {
      const weights = { a: 0, b: 0, c: 0 };
      expect(weightedPickRarity(weights, 42)).toBe('a');
    });

    it('单个权重非零时应返回该 key', () => {
      const weights = { white: 0, gold: 100 };
      // 不一定每次都是 gold，但高权重大概率是
      // 确定性验证：用固定种子
      const result = weightedPickRarity({ white: 0, gold: 100 }, 0);
      expect(result).toBe('gold');
    });

    it('空权重对象时应返回 undefined 或默认值', () => {
      const weights: Record<string, number> = {};
      const result = weightedPickRarity(weights, 42);
      // 源码: entries[0]?.[0] ?? 'white'
      expect(result).toBe('white');
    });
  });
});

// ═══════════════════════════════════════════════════
// isSlot
// ═══════════════════════════════════════════════════

describe('EquipmentGenerator — isSlot', () => {
  it('应识别合法装备部位', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      expect(isSlot(slot)).toBe(true);
    }
  });

  it('应拒绝非法字符串', () => {
    expect(isSlot('helmet')).toBe(false);
    expect(isSlot('')).toBe(false);
    expect(isSlot('Weapon')).toBe(false); // 大小写
  });
});

// ═══════════════════════════════════════════════════
// generateBySlot
// ═══════════════════════════════════════════════════

describe('EquipmentGenerator — generateBySlot', () => {
  beforeEach(() => {
    resetUidCounter();
  });

  const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory', 'mount'];
  const rarities: EquipmentRarity[] = ['white', 'green', 'blue', 'purple', 'gold'];
  const sources: EquipmentSource[] = ['campaign_drop', 'forge', 'shop', 'event', 'equipment_box'];

  it('应生成完整装备实例', () => {
    const eq = generateBySlot('weapon', 'blue', 'forge', 42);
    expect(eq).toBeDefined();
    expect(eq.uid).toMatch(/^eq_/);
    expect(eq.slot).toBe('weapon');
    expect(eq.rarity).toBe('blue');
    expect(eq.source).toBe('forge');
    expect(eq.enhanceLevel).toBe(0);
    expect(eq.isEquipped).toBe(false);
    expect(eq.equippedHeroId).toBeNull();
    expect(eq.seed).toBe(42);
    expect(eq.mainStat).toBeDefined();
    expect(eq.subStats).toBeInstanceOf(Array);
    expect(eq.templateId).toBe('tpl_weapon_blue');
  });

  it('应生成正确的名称（品质前缀+基础名）', () => {
    const eq = generateBySlot('weapon', 'white', 'campaign_drop', 0);
    // white 前缀为空
    expect(eq.name).toBeTruthy();
    expect(eq.name).not.toMatch(/^良·|^上·|^精·|^传·/);

    const eqGold = generateBySlot('weapon', 'gold', 'campaign_drop', 0);
    expect(eqGold.name).toMatch(/^传·/);
  });

  it('所有部位+品质组合都应生成成功', () => {
    for (const slot of slots) {
      for (const rarity of rarities) {
        const eq = generateBySlot(slot, rarity, 'forge', 42);
        expect(eq.slot).toBe(slot);
        expect(eq.rarity).toBe(rarity);
      }
    }
  });

  it('所有来源都应正确记录', () => {
    for (const source of sources) {
      const eq = generateBySlot('weapon', 'white', source, 42);
      expect(eq.source).toBe(source);
    }
  });

  it('相同种子应生成相同装备', () => {
    resetUidCounter();
    const eq1 = generateBySlot('armor', 'purple', 'forge', 999);
    resetUidCounter();
    const eq2 = generateBySlot('armor', 'purple', 'forge', 999);
    expect(eq1.mainStat.baseValue).toBe(eq2.mainStat.baseValue);
    expect(eq1.subStats.length).toBe(eq2.subStats.length);
    expect(eq1.name).toBe(eq2.name);
  });

  it('acquiredAt 应为合理时间戳', () => {
    const before = Date.now();
    const eq = generateBySlot('weapon', 'white', 'forge', 42);
    const after = Date.now();
    expect(eq.acquiredAt).toBeGreaterThanOrEqual(before);
    expect(eq.acquiredAt).toBeLessThanOrEqual(after);
  });
});

// ═══════════════════════════════════════════════════
// generateByTemplate
// ═══════════════════════════════════════════════════

describe('EquipmentGenerator — generateByTemplate', () => {
  beforeEach(() => {
    resetUidCounter();
  });

  it('有效模板应生成装备', () => {
    const templateId = 'sword_iron';
    const tpl = TEMPLATE_MAP.get(templateId);
    expect(tpl).toBeDefined();

    const eq = generateByTemplate(templateId, 'blue', 42);
    expect(eq).not.toBeNull();
    expect(eq!.templateId).toBe(templateId);
    expect(eq!.slot).toBe(tpl!.slot);
    expect(eq!.rarity).toBe('blue');
    expect(eq!.source).toBe('forge'); // 模板生成默认来源是 forge
  });

  it('无效模板应返回 null', () => {
    const eq = generateByTemplate('nonexistent_template', 'white', 42);
    expect(eq).toBeNull();
  });

  it('模板生成的主属性应与模板定义一致', () => {
    const templateId = 'sword_iron';
    const tpl = TEMPLATE_MAP.get(templateId)!;
    const eq = generateByTemplate(templateId, 'purple', 42);
    expect(eq).not.toBeNull();
    expect(eq!.mainStat.type).toBe(tpl.mainStatType);
    expect(eq!.mainStat.value).toBe(Math.floor(tpl.baseMainStat * RARITY_MAIN_STAT_MULTIPLIER.purple));
  });

  it('模板名称应包含品质前缀', () => {
    const eq = generateByTemplate('sword_iron', 'gold', 42);
    expect(eq).not.toBeNull();
    expect(eq!.name).toContain('传·');
  });
});

// ═══════════════════════════════════════════════════
// genMainStat
// ═══════════════════════════════════════════════════

describe('EquipmentGenerator — genMainStat', () => {
  it('应生成正确的主属性类型', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      const stat = genMainStat(slot, 'white', 42);
      expect(stat.type).toBe(SLOT_MAIN_STAT_TYPE[slot]);
    }
  });

  it('主属性 baseValue 应在配置范围内', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      const range = SLOT_MAIN_STAT_BASE[slot];
      // 多次种子验证范围
      for (let seed = 0; seed < 50; seed++) {
        const stat = genMainStat(slot, 'white', seed);
        expect(stat.baseValue).toBeGreaterThanOrEqual(range.min);
        expect(stat.baseValue).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it('主属性 value 应等于 baseValue × 品质倍率（取整）', () => {
    const stat = genMainStat('weapon', 'gold', 42);
    const expected = Math.floor(stat.baseValue * RARITY_MAIN_STAT_MULTIPLIER.gold);
    expect(stat.value).toBe(expected);
  });
});

// ═══════════════════════════════════════════════════
// genSubStats
// ═══════════════════════════════════════════════════

describe('EquipmentGenerator — genSubStats', () => {
  it('白色品质应有 0-1 条副属性', () => {
    const subs = genSubStats('weapon', 'white', 42);
    expect(subs.length).toBeGreaterThanOrEqual(0);
    expect(subs.length).toBeLessThanOrEqual(1);
  });

  it('金色品质副属性数量受池大小限制', () => {
    // weapon 池只有3种副属性，所以最多3条
    const subs = genSubStats('weapon', 'gold', 42);
    expect(subs.length).toBe(Math.min(4, SLOT_SUB_STAT_POOL.weapon.length));
  });

  it('副属性不应重复', () => {
    const subs = genSubStats('weapon', 'gold', 42);
    const types = subs.map(s => s.type);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(types.length);
  });

  it('副属性类型应在对应部位池中', () => {
    const pool = SLOT_SUB_STAT_POOL.weapon;
    const subs = genSubStats('weapon', 'purple', 42);
    for (const sub of subs) {
      expect(pool).toContain(sub.type);
    }
  });

  it('副属性数量应在品质配置范围内（受池大小限制）', () => {
    for (const rarity of ['white', 'green', 'blue', 'purple', 'gold'] as EquipmentRarity[]) {
      const [minC, maxC] = RARITY_SUB_STAT_COUNT[rarity];
      const poolSize = SLOT_SUB_STAT_POOL.weapon.length;
      for (let seed = 0; seed < 20; seed++) {
        const subs = genSubStats('weapon', rarity, seed);
        expect(subs.length).toBeGreaterThanOrEqual(Math.min(minC, poolSize));
        expect(subs.length).toBeLessThanOrEqual(Math.min(maxC, poolSize));
      }
    }
  });

  it('副属性 value 应为正数且 baseValue 应为整数', () => {
    const subs = genSubStats('weapon', 'blue', 42);
    for (const sub of subs) {
      expect(sub.baseValue).toBe(Math.floor(sub.baseValue));
      expect(sub.value).toBeGreaterThan(0);
      expect(sub.value).toBe(Math.floor(sub.value));
    }
  });
});

// ═══════════════════════════════════════════════════
// genSpecialEffect
// ═══════════════════════════════════════════════════

describe('EquipmentGenerator — genSpecialEffect', () => {
  it('白色品质不应有特殊词条', () => {
    const effect = genSpecialEffect('weapon', 'white', 42);
    expect(effect).toBeNull();
  });

  it('绿色品质不应有特殊词条', () => {
    const effect = genSpecialEffect('weapon', 'green', 42);
    expect(effect).toBeNull();
  });

  it('金色品质必出特殊词条', () => {
    // gold chance = 1.0
    const effect = genSpecialEffect('weapon', 'gold', 42);
    expect(effect).not.toBeNull();
    expect(effect!.type).toBeDefined();
    expect(effect!.value).toBeGreaterThan(0);
    expect(effect!.description).toBeTruthy();
  });

  it('特殊词条类型应在对应部位池中', () => {
    const pool = SLOT_SPECIAL_EFFECT_POOL.weapon;
    // 用多个种子尝试触发
    for (let seed = 0; seed < 200; seed++) {
      const effect = genSpecialEffect('weapon', 'purple', seed);
      if (effect) {
        expect(pool).toContain(effect.type);
      }
    }
  });

  it('特殊词条描述格式应正确', () => {
    const effect = genSpecialEffect('weapon', 'gold', 42);
    expect(effect).not.toBeNull();
    expect(effect!.description).toContain(effect!.type);
    expect(effect!.description).toContain('+');
    expect(effect!.description).toContain('%');
  });

  it('value 应保留一位小数', () => {
    const effect = genSpecialEffect('weapon', 'gold', 42);
    expect(effect).not.toBeNull();
    // value 应是 Math.floor(v * 10) / 10 格式
    const rounded = Math.floor(effect!.value * 10) / 10;
    expect(effect!.value).toBe(rounded);
  });
});
