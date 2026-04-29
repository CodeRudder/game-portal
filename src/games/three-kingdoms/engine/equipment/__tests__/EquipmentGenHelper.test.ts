/**
 * EquipmentGenHelper 单元测试
 *
 * 覆盖：UID生成、种子随机工具、按部位/模板生成、属性生成
 * （与 EquipmentGenerator 类似但使用 EquipmentGenHelper 的导出）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateUid,
  resetUidCounter,
  seedPick,
  weightedPickRarity,
  isSlot,
  generateBySlot,
  generateByTemplate,
  genMainStat,
  genSubStats,
  genSpecialEffect,
} from '../EquipmentGenHelper';
import type { EquipmentSlot, EquipmentRarity } from '../../../core/equipment';
import {
  EQUIPMENT_SLOTS,
  RARITY_MAIN_STAT_MULTIPLIER,
  RARITY_SUB_STAT_MULTIPLIER,
  RARITY_SUB_STAT_COUNT,
  SLOT_MAIN_STAT_TYPE,
  SLOT_MAIN_STAT_BASE,
  SLOT_SUB_STAT_POOL,
  SLOT_NAME_PREFIXES,
  TEMPLATE_MAP,
} from '../../../core/equipment';

// ═══════════════════════════════════════════════════
// UID 生成
// ═══════════════════════════════════════════════════

describe('EquipmentGenHelper — UID 生成', () => {
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
});

// ═══════════════════════════════════════════════════
// seedPick
// ═══════════════════════════════════════════════════

describe('EquipmentGenHelper — seedPick', () => {
  it('应从数组中选取一个元素', () => {
    const arr = [10, 20, 30];
    const result = seedPick(arr, 1);
    expect(arr).toContain(result);
  });

  it('相同种子应返回相同结果', () => {
    const arr = ['a', 'b', 'c'];
    expect(seedPick(arr, 5)).toBe(seedPick(arr, 5));
  });
});

// ═══════════════════════════════════════════════════
// weightedPickRarity
// ═══════════════════════════════════════════════════

describe('EquipmentGenHelper — weightedPickRarity', () => {
  it('应在权重中选取', () => {
    const weights = { a: 50, b: 50 };
    const result = weightedPickRarity(weights, 42);
    expect(['a', 'b']).toContain(result);
  });

  it('全零权重应返回第一个 key', () => {
    expect(weightedPickRarity({ x: 0, y: 0 }, 42)).toBe('x');
  });

  it('空权重应返回默认值 white', () => {
    expect(weightedPickRarity({}, 42)).toBe('white');
  });
});

// ═══════════════════════════════════════════════════
// isSlot
// ═══════════════════════════════════════════════════

describe('EquipmentGenHelper — isSlot', () => {
  it('应识别合法部位', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      expect(isSlot(slot)).toBe(true);
    }
  });

  it('应拒绝非法字符串', () => {
    expect(isSlot('invalid')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// generateBySlot
// ═══════════════════════════════════════════════════

describe('EquipmentGenHelper — generateBySlot', () => {
  beforeEach(() => {
    resetUidCounter();
  });

  it('应生成完整装备实例', () => {
    const eq = generateBySlot('weapon', 'blue', 'forge', 42);
    expect(eq.uid).toMatch(/^eq_/);
    expect(eq.slot).toBe('weapon');
    expect(eq.rarity).toBe('blue');
    expect(eq.source).toBe('forge');
    expect(eq.enhanceLevel).toBe(0);
    expect(eq.isEquipped).toBe(false);
    expect(eq.equippedHeroId).toBeNull();
    expect(eq.seed).toBe(42);
  });

  it('所有部位都应成功生成', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      const eq = generateBySlot(slot, 'white', 'campaign_drop', 42);
      expect(eq.slot).toBe(slot);
    }
  });

  it('所有品质都应成功生成', () => {
    const rarities: EquipmentRarity[] = ['white', 'green', 'blue', 'purple', 'gold'];
    for (const rarity of rarities) {
      const eq = generateBySlot('weapon', rarity, 'forge', 42);
      expect(eq.rarity).toBe(rarity);
    }
  });
});

// ═══════════════════════════════════════════════════
// generateByTemplate
// ═══════════════════════════════════════════════════

describe('EquipmentGenHelper — generateByTemplate', () => {
  beforeEach(() => {
    resetUidCounter();
  });

  it('有效模板应生成装备', () => {
    const eq = generateByTemplate('sword_iron', 'blue', 42);
    expect(eq).not.toBeNull();
    expect(eq!.templateId).toBe('sword_iron');
    expect(eq!.slot).toBe('weapon');
    expect(eq!.source).toBe('forge');
  });

  it('无效模板应返回 null', () => {
    expect(generateByTemplate('nonexistent', 'white', 42)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════
// genMainStat
// ═══════════════════════════════════════════════════

describe('EquipmentGenHelper — genMainStat', () => {
  it('应返回正确的主属性类型', () => {
    expect(genMainStat('weapon', 'white', 42).type).toBe('attack');
    expect(genMainStat('armor', 'white', 42).type).toBe('defense');
    expect(genMainStat('accessory', 'white', 42).type).toBe('intelligence');
    expect(genMainStat('mount', 'white', 42).type).toBe('speed');
  });

  it('baseValue 应在配置范围内', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      const range = SLOT_MAIN_STAT_BASE[slot];
      for (let seed = 0; seed < 20; seed++) {
        const stat = genMainStat(slot, 'white', seed);
        expect(stat.baseValue).toBeGreaterThanOrEqual(range.min);
        expect(stat.baseValue).toBeLessThanOrEqual(range.max);
      }
    }
  });
});

// ═══════════════════════════════════════════════════
// genSubStats
// ═══════════════════════════════════════════════════

describe('EquipmentGenHelper — genSubStats', () => {
  it('副属性数量应在配置范围内（受池大小限制）', () => {
    const rarities: EquipmentRarity[] = ['white', 'green', 'blue', 'purple', 'gold'];
    for (const rarity of rarities) {
      const [minC, maxC] = RARITY_SUB_STAT_COUNT[rarity];
      const poolSize = SLOT_SUB_STAT_POOL.weapon.length;
      for (let seed = 0; seed < 20; seed++) {
        const subs = genSubStats('weapon', rarity, seed);
        expect(subs.length).toBeGreaterThanOrEqual(Math.min(minC, poolSize));
        expect(subs.length).toBeLessThanOrEqual(Math.min(maxC, poolSize));
      }
    }
  });

  it('副属性不应重复', () => {
    const subs = genSubStats('weapon', 'gold', 42);
    const types = subs.map(s => s.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('副属性类型应在部位池中', () => {
    const pool = SLOT_SUB_STAT_POOL.weapon;
    const subs = genSubStats('weapon', 'purple', 42);
    for (const sub of subs) {
      expect(pool).toContain(sub.type);
    }
  });
});

// ═══════════════════════════════════════════════════
// genSpecialEffect
// ═══════════════════════════════════════════════════

describe('EquipmentGenHelper — genSpecialEffect', () => {
  it('白色品质不应有特殊词条', () => {
    expect(genSpecialEffect('weapon', 'white', 42)).toBeNull();
  });

  it('绿色品质不应有特殊词条', () => {
    expect(genSpecialEffect('weapon', 'green', 42)).toBeNull();
  });

  it('金色品质必出特殊词条', () => {
    const effect = genSpecialEffect('weapon', 'gold', 42);
    expect(effect).not.toBeNull();
    expect(effect!.type).toBeDefined();
    expect(effect!.value).toBeGreaterThan(0);
    expect(effect!.description).toBeTruthy();
  });
});
