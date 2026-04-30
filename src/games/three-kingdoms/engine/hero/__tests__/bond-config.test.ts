/**
 * hero/bond-config.ts 单元测试
 *
 * 覆盖导出函数：
 * - getBondLevelByMinStar
 * - getBondLevelMultiplier
 *
 * 验证常量：
 * - BOND_STAR_LEVEL_MAP 结构完整性
 * - BOND_MULTIPLIER_CAP
 * - FACTION_BONDS / PARTNER_BONDS 数据完整性
 */

import { describe, it, expect } from 'vitest';
import {
  BondType,
  BOND_STAR_LEVEL_MAP,
  getBondLevelByMinStar,
  getBondLevelMultiplier,
  FACTION_BONDS,
  PARTNER_BONDS,
  BOND_MULTIPLIER_CAP,
  DISPATCH_FACTOR,
  ACTIVE_FACTOR,
} from '../bond-config';

// ═══════════════════════════════════════════
// BOND_STAR_LEVEL_MAP 常量验证
// ═══════════════════════════════════════════
describe('BOND_STAR_LEVEL_MAP', () => {
  it('至少包含3个等级', () => {
    expect(BOND_STAR_LEVEL_MAP.length).toBeGreaterThanOrEqual(3);
  });

  it('等级递增排列', () => {
    for (let i = 1; i < BOND_STAR_LEVEL_MAP.length; i++) {
      expect(BOND_STAR_LEVEL_MAP[i].level).toBeGreaterThan(BOND_STAR_LEVEL_MAP[i - 1].level);
      expect(BOND_STAR_LEVEL_MAP[i].minStar).toBeGreaterThan(BOND_STAR_LEVEL_MAP[i - 1].minStar);
    }
  });

  it('倍率随等级递增', () => {
    for (let i = 1; i < BOND_STAR_LEVEL_MAP.length; i++) {
      expect(BOND_STAR_LEVEL_MAP[i].multiplier).toBeGreaterThan(BOND_STAR_LEVEL_MAP[i - 1].multiplier);
    }
  });

  it('所有倍率 > 0', () => {
    for (const entry of BOND_STAR_LEVEL_MAP) {
      expect(entry.multiplier).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════
// getBondLevelByMinStar
// ═══════════════════════════════════════════
describe('getBondLevelByMinStar', () => {
  it('星级0 → 返回等级1（默认）', () => {
    expect(getBondLevelByMinStar(0)).toBe(1);
  });

  it('星级1 → Lv1', () => {
    expect(getBondLevelByMinStar(1)).toBe(1);
  });

  it('星级2 → Lv1', () => {
    expect(getBondLevelByMinStar(2)).toBe(1);
  });

  it('星级3 → Lv2', () => {
    expect(getBondLevelByMinStar(3)).toBe(2);
  });

  it('星级4 → Lv2', () => {
    expect(getBondLevelByMinStar(4)).toBe(2);
  });

  it('星级5 → Lv3', () => {
    expect(getBondLevelByMinStar(5)).toBe(3);
  });

  it('星级6 → Lv3（最高等级）', () => {
    expect(getBondLevelByMinStar(6)).toBe(3);
  });

  it('星级100 → Lv3（超高星级不溢出）', () => {
    expect(getBondLevelByMinStar(100)).toBe(3);
  });

  it('负数星级 → 返回等级1', () => {
    expect(getBondLevelByMinStar(-1)).toBe(1);
  });

  it('返回值在合法范围内', () => {
    for (let star = 0; star <= 10; star++) {
      const level = getBondLevelByMinStar(star);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(3);
    }
  });
});

// ═══════════════════════════════════════════
// getBondLevelMultiplier
// ═══════════════════════════════════════════
describe('getBondLevelMultiplier', () => {
  it('Lv1 → 1.0', () => {
    expect(getBondLevelMultiplier(1)).toBe(1.0);
  });

  it('Lv2 → 1.5', () => {
    expect(getBondLevelMultiplier(2)).toBe(1.5);
  });

  it('Lv3 → 2.0', () => {
    expect(getBondLevelMultiplier(3)).toBe(2.0);
  });

  it('不存在的等级 → 返回 1.0（默认）', () => {
    expect(getBondLevelMultiplier(0)).toBe(1.0);
    expect(getBondLevelMultiplier(99)).toBe(1.0);
    expect(getBondLevelMultiplier(-1)).toBe(1.0);
  });

  it('与 BOND_STAR_LEVEL_MAP 一致', () => {
    for (const entry of BOND_STAR_LEVEL_MAP) {
      expect(getBondLevelMultiplier(entry.level)).toBe(entry.multiplier);
    }
  });
});

// ═══════════════════════════════════════════
// 常量验证
// ═══════════════════════════════════════════
describe('常量验证', () => {
  it('BOND_MULTIPLIER_CAP 为 2.0', () => {
    expect(BOND_MULTIPLIER_CAP).toBe(2.0);
  });

  it('DISPATCH_FACTOR 为 0.5（派驻减半）', () => {
    expect(DISPATCH_FACTOR).toBe(0.5);
  });

  it('ACTIVE_FACTOR 为 1.0（激活满额）', () => {
    expect(ACTIVE_FACTOR).toBe(1.0);
  });

  it('FACTION_BONDS 非空', () => {
    expect(FACTION_BONDS.length).toBeGreaterThan(0);
  });

  it('PARTNER_BONDS 非空', () => {
    expect(PARTNER_BONDS.length).toBeGreaterThan(0);
  });

  it('FACTION_BONDS 每项有合法 faction', () => {
    const validFactions = ['shu', 'wei', 'wu', 'qun'];
    for (const bond of FACTION_BONDS) {
      expect(validFactions).toContain(bond.faction);
    }
  });

  it('PARTNER_BONDS 每项有参与武将列表', () => {
    for (const bond of PARTNER_BONDS) {
      expect(bond.generalIds.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════
// BondType 枚举
// ═══════════════════════════════════════════
describe('BondType', () => {
  it('包含 FACTION 和 PARTNER', () => {
    expect(BondType.FACTION).toBe('faction');
    expect(BondType.PARTNER).toBe('partner');
  });
});
