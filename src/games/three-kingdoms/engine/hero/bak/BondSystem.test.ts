/**
 * BondSystem 单元测试
 *
 * 覆盖：
 * 1. 阵营羁绊检测 — 同乡之谊(2同)/同仇敌忾(3同)/众志成城(6同)/混搭协作(3+3)
 * 2. 羁绊预览 — 编队界面实时显示激活羁绊+属性加成预览
 * 3. 多级羁绊叠加
 * 4. 边界条件 — 空编队/单武将/全同阵营
 * 5. ISubsystem 接口
 */

import { BondSystem } from '../BondSystem';
import type { FormationHero } from '../BondSystem';
import type { ActiveBond, BondPreview, BondBonus } from '../../../core/heritage';

/** 创建带 mock deps 的 BondSystem */
function createSystem(): BondSystem {
  const sys = new BondSystem();
  const mockEventBus = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
  };
  const mockConfig = { get: jest.fn() };
  const mockRegistry = { get: jest.fn() };
  sys.init({
    eventBus: mockEventBus as any,
    config: mockConfig as any,
    registry: mockRegistry as any,
  });
  return sys;
}

/** 创建武将 */
function hero(id: string, faction: 'shu' | 'wei' | 'wu' | 'qun'): FormationHero {
  return { heroId: id, faction };
}

// ═══════════════════════════════════════════════════
// 1. ISubsystem 接口
// ═══════════════════════════════════════════════════

describe('BondSystem — ISubsystem', () => {
  it('name 应为 bond', () => {
    const sys = new BondSystem();
    expect(sys.name).toBe('bond');
  });

  it('init/update/reset 不抛异常', () => {
    const sys = createSystem();
    expect(() => sys.update(16)).not.toThrow();
    expect(() => sys.reset()).not.toThrow();
  });

  it('getState 返回版本信息', () => {
    const sys = createSystem();
    expect(sys.getState()).toEqual({ version: 1 });
  });
});

// ═══════════════════════════════════════════════════
// 2. 同乡之谊 — 2同阵营
// ═══════════════════════════════════════════════════

describe('BondSystem — 同乡之谊 (2同阵营)', () => {
  it('2名蜀国武将激活同乡之谊', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([
      hero('liubei', 'shu'),
      hero('guanyu', 'shu'),
    ]);

    expect(bonds).toHaveLength(1);
    expect(bonds[0].bond.id).toBe('fellowship');
    expect(bonds[0].matchingFaction).toBe('shu');
    expect(bonds[0].heroCount).toBe(2);
    expect(bonds[0].bonuses.attack).toBe(0.05);
  });

  it('2名魏国武将激活同乡之谊', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([
      hero('caocao', 'wei'),
      hero('xiahoudun', 'wei'),
    ]);

    expect(bonds).toHaveLength(1);
    expect(bonds[0].bond.id).toBe('fellowship');
    expect(bonds[0].matchingFaction).toBe('wei');
  });

  it('1名武将不激活任何羁绊', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([hero('liubei', 'shu')]);
    expect(bonds).toHaveLength(0);
  });

  it('不同阵营各1人不激活羁绊', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([
      hero('liubei', 'shu'),
      hero('caocao', 'wei'),
    ]);
    expect(bonds).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════
// 3. 同仇敌忾 — 3同阵营
// ═══════════════════════════════════════════════════

describe('BondSystem — 同仇敌忾 (3同阵营)', () => {
  it('3名同阵营武将激活同仇敌忾（同时激活同乡之谊）', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([
      hero('liubei', 'shu'),
      hero('guanyu', 'shu'),
      hero('zhangfei', 'shu'),
    ]);

    // 3同阵营同时满足2同和3同条件
    expect(bonds.length).toBeGreaterThanOrEqual(2);

    const solidarity = bonds.find(b => b.bond.id === 'solidarity');
    expect(solidarity).toBeDefined();
    expect(solidarity!.bonuses.attack).toBe(0.15);

    const fellowship = bonds.find(b => b.bond.id === 'fellowship');
    expect(fellowship).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════
// 4. 众志成城 — 6同阵营
// ═══════════════════════════════════════════════════

describe('BondSystem — 众志成城 (6同阵营)', () => {
  it('6名同阵营武将激活众志成城', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([
      hero('shu1', 'shu'), hero('shu2', 'shu'), hero('shu3', 'shu'),
      hero('shu4', 'shu'), hero('shu5', 'shu'), hero('shu6', 'shu'),
    ]);

    const unity = bonds.find(b => b.bond.id === 'unity');
    expect(unity).toBeDefined();
    expect(unity!.bonuses.attack).toBe(0.25);
    expect(unity!.bonuses.defense).toBe(0.15);
    expect(unity!.matchingFaction).toBe('shu');
  });

  it('6名同阵营同时激活所有同阵营羁绊', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([
      hero('shu1', 'shu'), hero('shu2', 'shu'), hero('shu3', 'shu'),
      hero('shu4', 'shu'), hero('shu5', 'shu'), hero('shu6', 'shu'),
    ]);

    expect(bonds.length).toBe(3); // fellowship + solidarity + unity
  });
});

// ═══════════════════════════════════════════════════
// 5. 混搭协作 — 3+3不同阵营
// ═══════════════════════════════════════════════════

describe('BondSystem — 混搭协作 (3+3不同阵营)', () => {
  it('3蜀+3魏激活混搭协作', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([
      hero('shu1', 'shu'), hero('shu2', 'shu'), hero('shu3', 'shu'),
      hero('wei1', 'wei'), hero('wei2', 'wei'), hero('wei3', 'wei'),
    ]);

    const diversity = bonds.find(b => b.bond.id === 'diversity');
    expect(diversity).toBeDefined();
    expect(diversity!.bonuses.attack).toBe(0.10);
    expect(diversity!.bonuses.specialEffect).toBeTruthy();
  });

  it('2蜀+3魏不激活混搭协作（蜀不足3）', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([
      hero('shu1', 'shu'), hero('shu2', 'shu'),
      hero('wei1', 'wei'), hero('wei2', 'wei'), hero('wei3', 'wei'),
    ]);

    const diversity = bonds.find(b => b.bond.id === 'diversity');
    expect(diversity).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════
// 6. 羁绊预览
// ═══════════════════════════════════════════════════

describe('BondSystem — 羁绊预览', () => {
  it('预览包含激活羁绊+总属性加成+阵营统计', () => {
    const sys = createSystem();
    const preview: BondPreview = sys.previewBonds([
      hero('liubei', 'shu'),
      hero('guanyu', 'shu'),
      hero('caocao', 'wei'),
    ]);

    expect(preview.activeBonds).toHaveLength(1);
    expect(preview.activeBonds[0].bond.id).toBe('fellowship');
    expect(preview.totalBonuses.attack).toBe(0.05);
    expect(preview.factionCounts.shu).toBe(2);
    expect(preview.factionCounts.wei).toBe(1);
    expect(preview.potentialBonds.length).toBeGreaterThan(0);
  });

  it('空编队预览无激活羁绊', () => {
    const sys = createSystem();
    const preview = sys.previewBonds([]);

    expect(preview.activeBonds).toHaveLength(0);
    expect(preview.totalBonuses).toEqual({});
    expect(preview.potentialBonds).toHaveLength(0);
  });

  it('预览潜在羁绊提示', () => {
    const sys = createSystem();
    const preview = sys.previewBonds([
      hero('liubei', 'shu'),
    ]);

    // 1名蜀国武将，差1名可激活同乡之谊
    const potential = preview.potentialBonds.find(p => p.bond.id === 'fellowship');
    expect(potential).toBeDefined();
    expect(potential!.remainingCount).toBe(1);
  });
});

// ═══════════════════════════════════════════════════
// 7. 属性加成汇总
// ═══════════════════════════════════════════════════

describe('BondSystem — 属性加成汇总', () => {
  it('多个羁绊加成正确叠加', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([
      hero('shu1', 'shu'), hero('shu2', 'shu'), hero('shu3', 'shu'),
    ]);

    const total = sys.aggregateBonuses(bonds);
    // fellowship: attack+5% + solidarity: attack+15% = attack+20%
    expect(total.attack).toBeCloseTo(0.20, 2);
  });

  it('无羁绊时加成为空', () => {
    const sys = createSystem();
    const total = sys.aggregateBonuses([]);
    expect(total).toEqual({});
  });
});

// ═══════════════════════════════════════════════════
// 8. 边界条件
// ═══════════════════════════════════════════════════

describe('BondSystem — 边界条件', () => {
  it('空编队返回空羁绊列表', () => {
    const sys = createSystem();
    expect(sys.detectBonds([])).toHaveLength(0);
  });

  it('getAllBondDefinitions 返回所有羁绊定义', () => {
    const sys = createSystem();
    const defs = sys.getAllBondDefinitions();
    expect(defs.length).toBe(4); // fellowship, solidarity, unity, diversity
  });

  it('getBondDefinition 按ID查找', () => {
    const sys = createSystem();
    const bond = sys.getBondDefinition('fellowship');
    expect(bond).toBeDefined();
    expect(bond!.name).toBe('同乡之谊');
  });

  it('getBondDefinition 不存在的ID返回undefined', () => {
    const sys = createSystem();
    expect(sys.getBondDefinition('nonexistent' as any)).toBeUndefined();
  });

  it('4个阵营各2人不激活任何羁绊', () => {
    const sys = createSystem();
    const bonds = sys.detectBonds([
      hero('s1', 'shu'), hero('s2', 'shu'),
      hero('w1', 'wei'), hero('w2', 'wei'),
      hero('u1', 'wu'), hero('u2', 'wu'),
      hero('q1', 'qun'), hero('q2', 'qun'),
    ]);

    // 2蜀+2魏+2吴+2群 → 同乡之谊对每个阵营都满足
    expect(bonds.length).toBeGreaterThanOrEqual(1);
    // 至少有4个同乡之谊（每个阵营各一个）
    const fellowships = bonds.filter(b => b.bond.id === 'fellowship');
    expect(fellowships.length).toBe(4);
  });
});
