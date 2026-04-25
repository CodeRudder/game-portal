/**
 * HeroAttributeCompare 单元测试 — 属性对比和构成展开
 *
 * 覆盖功能点：
 * - F10.10 属性对比（当前 vs 模拟等级）
 * - F10.11 属性构成展开（基础+装备+科技+buff）
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HeroAttributeCompare } from '../HeroAttributeCompare';
import type { AttributeCompareDeps } from '../HeroAttributeCompare';

// ── 辅助函数 ──

function makeMockCoreDeps() {
  return {
    eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn(), has: vi.fn(), getAll: vi.fn(), unregister: vi.fn() },
  };
}

/** 创建可编程的 AttributeCompareDeps mock */
function createMockDeps(overrides?: Partial<AttributeCompareDeps>): AttributeCompareDeps {
  return {
    getHeroAttrs: overrides?.getHeroAttrs ?? (() => ({})),
    getEquipBonus: overrides?.getEquipBonus ?? (() => ({})),
    getTechBonus: overrides?.getTechBonus ?? (() => ({})),
    getBuffBonus: overrides?.getBuffBonus ?? (() => ({})),
    simulateLevel: overrides?.simulateLevel ?? (() => ({})),
  };
}

// ═══════════════════════════════════════════
// F10.10: 属性对比
// ═══════════════════════════════════════════

describe('HeroAttributeCompare compareAttributes (F10.10)', () => {
  let system: HeroAttributeCompare;

  beforeEach(() => {
    system = new HeroAttributeCompare();
    system.init(makeMockCoreDeps());
  });

  it('should return zero diff when no simulateLevel provided', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100, defense: 80 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.compareAttributes('guanyu');
    expect(result.heroId).toBe('guanyu');
    expect(result.current).toEqual({ attack: 100, defense: 80 });
    expect(result.simulated).toEqual({ attack: 100, defense: 80 });
    expect(result.diff).toEqual({ attack: 0, defense: 0 });
  });

  it('should compute diff between current and simulated level', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100, defense: 80 }),
      simulateLevel: (_id: string, level: number) => ({
        attack: 100 + level * 10,
        defense: 80 + level * 5,
      }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.compareAttributes('guanyu', 5);
    expect(result.current).toEqual({ attack: 100, defense: 80 });
    expect(result.simulated).toEqual({ attack: 150, defense: 105 });
    expect(result.diff).toEqual({ attack: 50, defense: 25 });
  });

  it('should handle simulated level with fewer attributes', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100, defense: 80, speed: 50 }),
      simulateLevel: () => ({ attack: 200 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.compareAttributes('guanyu', 10);
    expect(result.diff.attack).toBe(100);
    expect(result.diff.defense).toBe(-80);
    expect(result.diff.speed).toBe(-50);
  });

  it('should handle simulated level with more attributes', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
      simulateLevel: () => ({ attack: 150, intelligence: 200 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.compareAttributes('guanyu', 10);
    expect(result.diff.attack).toBe(50);
    expect(result.diff.intelligence).toBe(200);
  });

  it('should handle empty attributes', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({}),
      simulateLevel: () => ({}),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.compareAttributes('guanyu', 5);
    expect(result.current).toEqual({});
    expect(result.simulated).toEqual({});
    expect(result.diff).toEqual({});
  });

  it('should save lastComparisonHeroId in state', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
    });
    system.setAttributeCompareDeps(deps);

    system.compareAttributes('guanyu', 5);
    const state = system.getState();
    expect(state.lastComparisonHeroId).toBe('guanyu');
  });

  it('should update lastComparisonHeroId on each call', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
    });
    system.setAttributeCompareDeps(deps);

    system.compareAttributes('guanyu', 5);
    system.compareAttributes('zhangfei', 3);
    expect(system.getState().lastComparisonHeroId).toBe('zhangfei');
  });
});

// ═══════════════════════════════════════════
// F10.11: 属性构成展开
// ═══════════════════════════════════════════

describe('HeroAttributeCompare getAttributeBreakdown (F10.11)', () => {
  let system: HeroAttributeCompare;

  beforeEach(() => {
    system = new HeroAttributeCompare();
    system.init(makeMockCoreDeps());
  });

  it('should return breakdown with all source categories', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100, defense: 80 }),
      getEquipBonus: () => ({ attack: 20 }),
      getTechBonus: () => ({ defense: 10 }),
      getBuffBonus: () => ({ attack: 5, defense: 5 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.getAttributeBreakdown('guanyu');
    expect(result.heroId).toBe('guanyu');
    expect(result.base).toEqual({ attack: 100, defense: 80 });
    expect(result.equipment).toEqual({ attack: 20 });
    expect(result.tech).toEqual({ defense: 10 });
    expect(result.buff).toEqual({ attack: 5, defense: 5 });
  });

  it('should compute total as sum of all sources', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100, defense: 80 }),
      getEquipBonus: () => ({ attack: 20, defense: 10 }),
      getTechBonus: () => ({ attack: 10, defense: 5 }),
      getBuffBonus: () => ({ attack: 5, defense: 5 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.getAttributeBreakdown('guanyu');
    expect(result.total).toEqual({ attack: 135, defense: 100 });
  });

  it('should handle empty bonuses', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
      getEquipBonus: () => ({}),
      getTechBonus: () => ({}),
      getBuffBonus: () => ({}),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.getAttributeBreakdown('guanyu');
    expect(result.total).toEqual({ attack: 100 });
  });

  it('should handle all empty attributes', () => {
    const deps = createMockDeps();
    system.setAttributeCompareDeps(deps);

    const result = system.getAttributeBreakdown('guanyu');
    expect(result.base).toEqual({});
    expect(result.equipment).toEqual({});
    expect(result.tech).toEqual({});
    expect(result.buff).toEqual({});
    expect(result.total).toEqual({});
  });

  it('should include keys from all sources in total', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
      getEquipBonus: () => ({ defense: 50 }),
      getTechBonus: () => ({ speed: 30 }),
      getBuffBonus: () => ({ intelligence: 40 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.getAttributeBreakdown('guanyu');
    expect(result.total).toEqual({
      attack: 100,
      defense: 50,
      speed: 30,
      intelligence: 40,
    });
  });

  it('should handle overlapping keys across sources', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
      getEquipBonus: () => ({ attack: 30 }),
      getTechBonus: () => ({ attack: 20 }),
      getBuffBonus: () => ({ attack: 10 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.getAttributeBreakdown('guanyu');
    expect(result.total.attack).toBe(160);
  });
});

// ═══════════════════════════════════════════
// ISubsystem 接口
// ═══════════════════════════════════════════

describe('HeroAttributeCompare ISubsystem', () => {
  it('should implement name, init, update, getState, reset', () => {
    const system = new HeroAttributeCompare();
    expect(system.name).toBe('heroAttributeCompare');

    system.init(makeMockCoreDeps());
    expect(() => system.update(16)).not.toThrow();

    const state = system.getState();
    expect(state.lastComparisonHeroId).toBeNull();
  });

  it('should reset state on reset()', () => {
    const system = new HeroAttributeCompare();
    system.init(makeMockCoreDeps());
    system.setAttributeCompareDeps(createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
    }));

    system.compareAttributes('guanyu', 5);
    expect(system.getState().lastComparisonHeroId).toBe('guanyu');

    system.reset();
    expect(system.getState().lastComparisonHeroId).toBeNull();
  });
});
