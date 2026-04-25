/**
 * HeroAttributeCompare 单元测试 — 属性对比和构成展开
 *
 * 覆盖功能点：
 * - ISubsystem 接口（name / init / update / getState / reset）
 * - F10.10 属性对比（当前 vs 模拟等级）
 * - F10.11 属性构成展开（基础+装备+科技+buff）
 * - 边界情况（无装备/无buff/空属性/reset后依赖清空/init前调用/simulateLevel=0）
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
// ISubsystem 接口
// ═══════════════════════════════════════════

describe('HeroAttributeCompare ISubsystem', () => {
  it('should expose correct name', () => {
    const system = new HeroAttributeCompare();
    expect(system.name).toBe('heroAttributeCompare');
  });

  it('should implement init / update / getState / reset without error', () => {
    const system = new HeroAttributeCompare();
    expect(() => system.init(makeMockCoreDeps())).not.toThrow();
    expect(() => system.update(16)).not.toThrow();
    expect(() => system.update(0)).not.toThrow();
  });

  it('should return initial state with null lastComparisonHeroId', () => {
    const system = new HeroAttributeCompare();
    const state = system.getState();
    expect(state).toEqual({ lastComparisonHeroId: null });
  });

  it('should return a defensive copy from getState', () => {
    const system = new HeroAttributeCompare();
    const s1 = system.getState();
    const s2 = system.getState();
    expect(s1).toEqual(s2);
    expect(s1).not.toBe(s2); // 不同引用
  });

  it('should reset state and clear deps', () => {
    const system = new HeroAttributeCompare();
    system.init(makeMockCoreDeps());
    system.setAttributeCompareDeps(
      createMockDeps({ getHeroAttrs: () => ({ attack: 100 }) }),
    );

    system.compareAttributes('guanyu', 5);
    expect(system.getState().lastComparisonHeroId).toBe('guanyu');

    system.reset();
    expect(system.getState().lastComparisonHeroId).toBeNull();

    // reset 后依赖被清空，compareAttributes 返回空结果
    const result = system.compareAttributes('guanyu', 5);
    expect(result.current).toEqual({});
    expect(result.simulated).toEqual({});
    expect(result.diff).toEqual({});
  });

  it('should allow methods before init without crashing', () => {
    const system = new HeroAttributeCompare();
    // 未调用 init，直接使用业务方法
    expect(() => system.compareAttributes('guanyu')).not.toThrow();
    expect(() => system.getAttributeBreakdown('guanyu')).not.toThrow();
  });
});

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

  it('should treat simulateLevel=0 as falsy and use current', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
      simulateLevel: () => ({ attack: 999 }),
    });
    system.setAttributeCompareDeps(deps);

    // simulateLevel=0 是 falsy，走 current 分支
    const result = system.compareAttributes('guanyu', 0);
    expect(result.simulated).toEqual({ attack: 100 });
    expect(result.diff).toEqual({ attack: 0 });
  });

  it('should compute positive diff when simulated > current', () => {
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

  it('should compute negative diff when simulated < current', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 200 }),
      simulateLevel: () => ({ attack: 150 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.compareAttributes('guanyu', 1);
    expect(result.diff.attack).toBe(-50);
  });

  it('should handle simulated with fewer attributes (negative diff for missing)', () => {
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

  it('should handle simulated with more attributes (new keys appear)', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
      simulateLevel: () => ({ attack: 150, intelligence: 200 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.compareAttributes('guanyu', 10);
    expect(result.diff.attack).toBe(50);
    expect(result.diff.intelligence).toBe(200);
  });

  it('should handle both current and simulated empty', () => {
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

  it('should save lastComparisonHeroId in state after compare', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
    });
    system.setAttributeCompareDeps(deps);

    system.compareAttributes('guanyu', 5);
    expect(system.getState().lastComparisonHeroId).toBe('guanyu');
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

  it('should pass correct heroId and level to simulateLevel', () => {
    const simulateSpy = vi.fn(() => ({ attack: 200 }));
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
      simulateLevel: simulateSpy,
    });
    system.setAttributeCompareDeps(deps);

    system.compareAttributes('liubei', 10);
    expect(simulateSpy).toHaveBeenCalledWith('liubei', 10);
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

  it('should handle no equipment bonus (empty)', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
      getEquipBonus: () => ({}),
      getTechBonus: () => ({ attack: 10 }),
      getBuffBonus: () => ({ attack: 5 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.getAttributeBreakdown('guanyu');
    expect(result.equipment).toEqual({});
    expect(result.total).toEqual({ attack: 115 });
  });

  it('should handle no buff bonus (empty)', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ attack: 100 }),
      getEquipBonus: () => ({ attack: 20 }),
      getTechBonus: () => ({ attack: 10 }),
      getBuffBonus: () => ({}),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.getAttributeBreakdown('guanyu');
    expect(result.buff).toEqual({});
    expect(result.total).toEqual({ attack: 130 });
  });

  it('should handle no tech bonus (empty)', () => {
    const deps = createMockDeps({
      getHeroAttrs: () => ({ defense: 50 }),
      getEquipBonus: () => ({ defense: 10 }),
      getTechBonus: () => ({}),
      getBuffBonus: () => ({ defense: 5 }),
    });
    system.setAttributeCompareDeps(deps);

    const result = system.getAttributeBreakdown('guanyu');
    expect(result.tech).toEqual({});
    expect(result.total).toEqual({ defense: 65 });
  });

  it('should handle all empty attributes (base + bonuses)', () => {
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

  it('should handle overlapping keys across all four sources', () => {
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

  it('should pass correct heroId to each dep callback', () => {
    const attrsSpy = vi.fn(() => ({ attack: 100 }));
    const equipSpy = vi.fn(() => ({ attack: 20 }));
    const techSpy = vi.fn(() => ({}));
    const buffSpy = vi.fn(() => ({}));

    const deps = createMockDeps({
      getHeroAttrs: attrsSpy,
      getEquipBonus: equipSpy,
      getTechBonus: techSpy,
      getBuffBonus: buffSpy,
    });
    system.setAttributeCompareDeps(deps);

    system.getAttributeBreakdown('zhaoyun');
    expect(attrsSpy).toHaveBeenCalledWith('zhaoyun');
    expect(equipSpy).toHaveBeenCalledWith('zhaoyun');
    expect(techSpy).toHaveBeenCalledWith('zhaoyun');
    expect(buffSpy).toHaveBeenCalledWith('zhaoyun');
  });
});

// ═══════════════════════════════════════════
// 依赖注入
// ═══════════════════════════════════════════

describe('HeroAttributeCompare setAttributeCompareDeps', () => {
  it('should override default empty deps with injected ones', () => {
    const system = new HeroAttributeCompare();
    system.init(makeMockCoreDeps());

    // 默认依赖返回空
    let result = system.getAttributeBreakdown('guanyu');
    expect(result.total).toEqual({});

    // 注入新依赖
    system.setAttributeCompareDeps(
      createMockDeps({ getHeroAttrs: () => ({ attack: 50 }) }),
    );
    result = system.getAttributeBreakdown('guanyu');
    expect(result.total).toEqual({ attack: 50 });
  });
});
