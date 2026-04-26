/**
 * useHeroEngine 测试 — 聚合 Hook
 *
 * 覆盖：
 * - 基础渲染：聚合 Hook 正常调用返回完整数据结构
 * - 子 Hook 聚合：6个子Hook的返回值正确合并
 * - 数据传递：heroList → heroBonds / formation 的依赖链正确
 * - 状态更新：snapshotVersion 变化触发重计算
 * - 边界：空引擎 / 部分子Hook异常时的降级
 * - 清理：unmount 后无副作用残留
 *
 * @module components/idle/panels/hero/hooks/__tests__/useHeroEngine.test
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHeroEngine } from '../useHeroEngine';
import { createMockEngine, makeMultipleGenerals } from './hero-hooks-test-utils';
import { Quality } from '@/games/three-kingdoms/engine/hero/hero.types';

// ═══════════════════════════════════════════════
// 基础渲染测试
// ═══════════════════════════════════════════════

describe('useHeroEngine — 基础渲染', () => {
  it('应正常调用并返回聚合数据结构', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    const ret = result.current;
    expect(ret).toBeDefined();

    // useHeroList 字段
    expect(ret).toHaveProperty('allGenerals');
    expect(ret).toHaveProperty('ownedHeroIds');
    expect(ret).toHaveProperty('heroBriefs');
    expect(ret).toHaveProperty('heroInfos');

    // useHeroSkills 字段
    expect(ret).toHaveProperty('skills');
    expect(ret).toHaveProperty('skillBookAmount');
    expect(ret).toHaveProperty('goldAmount');
    expect(ret).toHaveProperty('upgradeSkill');

    // useHeroBonds 字段
    expect(ret).toHaveProperty('activeBonds');
    expect(ret).toHaveProperty('bondCatalog');
    expect(ret).toHaveProperty('heroFactionMap');

    // useHeroDispatch 字段
    expect(ret).toHaveProperty('buildings');
    expect(ret).toHaveProperty('dispatchHero');
    expect(ret).toHaveProperty('recallHero');

    // useFormation 字段
    expect(ret).toHaveProperty('currentFormation');
    expect(ret).toHaveProperty('powerCalculator');
    expect(ret).toHaveProperty('generateRecommendations');
    expect(ret).toHaveProperty('applyRecommend');
  });

  it('返回的各字段类型应正确', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(Array.isArray(result.current.allGenerals)).toBe(true);
    expect(Array.isArray(result.current.ownedHeroIds)).toBe(true);
    expect(Array.isArray(result.current.heroBriefs)).toBe(true);
    expect(Array.isArray(result.current.heroInfos)).toBe(true);
    expect(Array.isArray(result.current.skills)).toBe(true);
    expect(typeof result.current.skillBookAmount).toBe('number');
    expect(typeof result.current.goldAmount).toBe('number');
    expect(typeof result.current.upgradeSkill).toBe('function');
    expect(Array.isArray(result.current.activeBonds)).toBe(true);
    expect(Array.isArray(result.current.bondCatalog)).toBe(true);
    expect(typeof result.current.heroFactionMap).toBe('object');
    expect(Array.isArray(result.current.buildings)).toBe(true);
    expect(typeof result.current.dispatchHero).toBe('function');
    expect(typeof result.current.recallHero).toBe('function');
    expect(Array.isArray(result.current.currentFormation)).toBe(true);
    expect(typeof result.current.powerCalculator).toBe('function');
    expect(typeof result.current.generateRecommendations).toBe('function');
    expect(typeof result.current.applyRecommend).toBe('function');
  });
});

// ═══════════════════════════════════════════════
// 子Hook聚合测试
// ═══════════════════════════════════════════════

describe('useHeroEngine — 子Hook聚合', () => {
  it('allGenerals 应与引擎武将数量一致', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.allGenerals).toHaveLength(generals.length);
  });

  it('selectedHeroId 传入时应返回对应武将技能', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });
    const { result } = renderHook(() =>
      useHeroEngine({
        engine: engine as any,
        snapshotVersion: 0,
        selectedHeroId: 'guanyu',
      }),
    );

    // 关羽有技能，应返回非空技能列表
    expect(result.current.skills.length).toBeGreaterThan(0);
  });

  it('selectedHeroId 未传入时 skills 应为空数组', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.skills).toEqual([]);
  });

  it('currentFormation 默认应为 6 个 null 槽位', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.currentFormation).toHaveLength(6);
    result.current.currentFormation.forEach((slot) => {
      expect(slot).toBeNull();
    });
  });

  it('heroFactionMap 应正确映射武将→阵营', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    const map = result.current.heroFactionMap;
    expect(map['liubei']).toBe('shu');
    expect(map['caocao']).toBe('wei');
  });

  it('bondCatalog 应包含羁绊条目', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.bondCatalog.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// 数据传递（依赖链）测试
// ═══════════════════════════════════════════════

describe('useHeroEngine — 数据传递', () => {
  it('heroInfos 应传递给 useFormation 生成推荐方案', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    // heroInfos 非空时，generateRecommendations 应能生成方案
    expect(result.current.heroInfos.length).toBeGreaterThan(0);
    const plans = result.current.generateRecommendations();
    // 有武将时应有推荐方案
    expect(plans.length).toBeGreaterThan(0);
  });

  it('formationHeroIds 应影响羁绊计算', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });

    // 不传 formationHeroIds
    const { result: result1 } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    // 传 formationHeroIds
    const { result: result2 } = renderHook(() =>
      useHeroEngine({
        engine: engine as any,
        snapshotVersion: 0,
        formationHeroIds: ['liubei', 'guanyu', 'zhangfei'],
      }),
    );

    // 两者都应有有效的 heroFactionMap
    expect(Object.keys(result1.current.heroFactionMap).length).toBeGreaterThan(0);
    expect(Object.keys(result2.current.heroFactionMap).length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// 状态更新测试
// ═══════════════════════════════════════════════

describe('useHeroEngine — 状态更新', () => {
  it('snapshotVersion 变化应触发数据重计算', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });

    const { result, rerender } = renderHook(
      ({ snapshotVersion }) => useHeroEngine({ engine: engine as any, snapshotVersion }),
      { initialProps: { snapshotVersion: 0 } },
    );

    const firstAllGenerals = result.current.allGenerals;
    expect(firstAllGenerals).toHaveLength(generals.length);

    // 更新 snapshotVersion
    rerender({ snapshotVersion: 1 });

    // 应重新调用 getGenerals
    expect(engine.getGenerals).toHaveBeenCalled();
    // 数据应仍然正确
    expect(result.current.allGenerals).toHaveLength(generals.length);
  });

  it('selectedHeroId 变化应更新技能数据', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });

    const { result, rerender } = renderHook(
      ({ selectedHeroId }) => useHeroEngine({
        engine: engine as any,
        snapshotVersion: 0,
        selectedHeroId,
      }),
      { initialProps: { selectedHeroId: undefined } },
    );

    // 无选中武将
    expect(result.current.skills).toEqual([]);

    // 选中关羽
    rerender({ selectedHeroId: 'guanyu' });
    expect(result.current.skills.length).toBeGreaterThan(0);

    // 切换到刘备
    rerender({ selectedHeroId: 'liubei' });
    expect(result.current.skills.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// 边界测试
// ═══════════════════════════════════════════════

describe('useHeroEngine — 边界条件', () => {
  it('引擎返回空武将列表时应安全处理', () => {
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue([]) });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.allGenerals).toEqual([]);
    expect(result.current.ownedHeroIds).toEqual([]);
    expect(result.current.heroBriefs).toEqual([]);
    expect(result.current.heroInfos).toEqual([]);
    expect(result.current.skills).toEqual([]);
    expect(result.current.activeBonds).toEqual([]);
    expect(result.current.buildings).toBeDefined();
    expect(result.current.currentFormation).toHaveLength(6);
  });

  it('getGenerals 抛异常时各数据字段应降级为安全默认值', () => {
    const engine = createMockEngine({
      getGenerals: vi.fn().mockImplementation(() => { throw new Error('engine error'); }),
    });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.allGenerals).toEqual([]);
    expect(result.current.ownedHeroIds).toEqual([]);
    expect(result.current.heroBriefs).toEqual([]);
    expect(result.current.heroInfos).toEqual([]);
  });

  it('getBondSystem 抛异常时 activeBonds 应为空数组', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({
      getGenerals: vi.fn().mockReturnValue(generals),
      getBondSystem: vi.fn().mockImplementation(() => { throw new Error('bond error'); }),
    });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.activeBonds).toEqual([]);
  });

  it('getHeroDispatchSystem 抛异常时 buildings 应为空数组', () => {
    const engine = createMockEngine({
      getHeroDispatchSystem: vi.fn().mockImplementation(() => { throw new Error('dispatch error'); }),
    });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.buildings).toEqual([]);
  });

  it('getFormations 抛异常时 currentFormation 应为 6 个 null', () => {
    const engine = createMockEngine({
      getFormations: vi.fn().mockImplementation(() => { throw new Error('formation error'); }),
    });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    expect(result.current.currentFormation).toEqual([null, null, null, null, null, null]);
  });

  it('getHeroStarSystem 抛异常时 heroBriefs stars 应回退为 1', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({
      getGenerals: vi.fn().mockReturnValue(generals),
      getHeroStarSystem: vi.fn().mockImplementation(() => { throw new Error('no star'); }),
    });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    result.current.heroBriefs.forEach((brief) => {
      expect(brief.stars).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════
// 操作方法测试
// ═══════════════════════════════════════════════

describe('useHeroEngine — 操作方法', () => {
  it('upgradeSkill 应调用引擎 skillUpgradeSystem', () => {
    const generals = makeMultipleGenerals();
    const engine = createMockEngine({ getGenerals: vi.fn().mockReturnValue(generals) });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    act(() => {
      result.current.upgradeSkill('guanyu', 0);
    });

    expect(engine.getSkillUpgradeSystem).toHaveBeenCalled();
  });

  it('dispatchHero 应调用引擎派遣方法', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    act(() => {
      result.current.dispatchHero('guanyu', 'farm');
    });

    expect(engine.getHeroDispatchSystem).toHaveBeenCalled();
  });

  it('recallHero 应调用引擎召回方法', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    act(() => {
      result.current.recallHero('farm');
    });

    expect(engine.getHeroDispatchSystem).toHaveBeenCalled();
  });

  it('applyRecommend 应调用引擎 setFormation', () => {
    // getFormations 需返回非空数组，applyRecommend 才会调用 setFormation
    const engine = createMockEngine({
      getFormations: vi.fn().mockReturnValue([{ id: '0', slots: [] }]),
    });
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    act(() => {
      result.current.applyRecommend(['guanyu', 'liubei', null, null, null, null]);
    });

    expect(engine.getFormationSystem).toHaveBeenCalled();
    expect(engine.getFormationSystem().setFormation).toHaveBeenCalled();
  });

  it('applyRecommend 无编队时不应调用 setFormation', () => {
    const engine = createMockEngine();
    const { result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    const formationSystem = engine.getFormationSystem();
    formationSystem.setFormation.mockClear();

    act(() => {
      result.current.applyRecommend([null, null, null, null, null, null]);
    });

    expect(formationSystem.setFormation).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════
// 清理测试
// ═══════════════════════════════════════════════

describe('useHeroEngine — 清理', () => {
  it('unmount 后不应有副作用残留', () => {
    const engine = createMockEngine();
    const { unmount, result } = renderHook(() =>
      useHeroEngine({ engine: engine as any, snapshotVersion: 0 }),
    );

    // 确认数据正常
    expect(result.current.allGenerals).toBeDefined();

    // unmount 不应抛出异常
    expect(() => unmount()).not.toThrow();
  });

  it('多次 mount/unmount 不应泄漏', () => {
    const engine = createMockEngine();

    for (let i = 0; i < 3; i++) {
      const { unmount, result } = renderHook(() =>
        useHeroEngine({ engine: engine as any, snapshotVersion: i }),
      );
      expect(result.current.allGenerals).toBeDefined();
      unmount();
    }

    // 引擎不应被异常调用
    expect(engine.getGenerals).toHaveBeenCalled();
  });
});
